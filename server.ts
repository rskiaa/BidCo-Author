import 'dotenv/config';
import express, { type Request, type Response } from 'express';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import { requireAuth, type AuthRequest } from './server/middleware/auth.ts';
import { formatGeminiError } from './server/ai/client.ts';
import {
  buildSampleTenderPdfBytes,
  parseAndIndexPdf,
  retrieveTopChunks,
} from './server/ai/pdfAndRag.ts';
import {
  runComplianceVerificationAgent,
  runEligibilityAgent,
  runFinancialAnalysisAgent,
  runProposalGeneratorAgent,
  runRiskAssessmentAgent,
  runTenderDocumentAgent,
  runTenderRagQa,
} from './server/ai/agents.ts';
import {
  filterDiscoveryTenders,
  getPortalIntegrationStatuses,
} from './server/services/discoveryService.ts';
import { generateProposalDocx, generateProposalPdf } from './server/services/exportService.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '25mb' }));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'application/pdf' || file.originalname.toLowerCase().endsWith('.pdf')) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF tender documents are accepted.'));
    }
  },
});

app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    ok: true,
    service: 'Bid Tender Writer API',
    geminiConfigured: Boolean(
      process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== 'MY_GEMINI_API_KEY',
    ),
  });
});

// Discovery & Portal Adapter Status
app.get('/api/tenders/discover', requireAuth, (req: AuthRequest, res: Response) => {
  const { q, industry, location, department, minBudget, maxBudget, maxTurnover, deadlineBefore } =
    req.query;

  const results = filterDiscoveryTenders({
    q: typeof q === 'string' ? q : undefined,
    industry: typeof industry === 'string' ? industry : undefined,
    location: typeof location === 'string' ? location : undefined,
    department: typeof department === 'string' ? department : undefined,
    minBudgetLakhs: typeof minBudget === 'string' && minBudget ? Number(minBudget) : undefined,
    maxBudgetLakhs: typeof maxBudget === 'string' && maxBudget ? Number(maxBudget) : undefined,
    maxTurnoverLakhs:
      typeof maxTurnover === 'string' && maxTurnover ? Number(maxTurnover) : undefined,
    deadlineBefore: typeof deadlineBefore === 'string' ? deadlineBefore : undefined,
  });

  res.json({
    tenders: results,
    integrations: getPortalIntegrationStatuses(),
  });
});

// Sample Tender PDF Download / Test Pipeline Artifact
app.get('/api/tenders/sample-pdf', requireAuth, async (_req: AuthRequest, res: Response) => {
  try {
    const bytes = await buildSampleTenderPdfBytes();
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="DEMO_Water_SCADA_RFP_2026.pdf"',
    );
    res.send(Buffer.from(bytes));
  } catch (err) {
    console.error('Sample PDF generation failed:', err);
    res.status(500).json({ error: 'Failed to generate sample tender PDF.' });
  }
});

// Parse Uploaded PDF, Chunk, Embed with Gemini, and optionally Analyze immediately
app.post(
  '/api/tenders/parse-pdf',
  requireAuth,
  upload.single('file'),
  async (req: AuthRequest, res: Response) => {
    try {
      let buffer: Buffer | null = null;
      let fileName = 'tender-document.pdf';

      if (req.file) {
        buffer = req.file.buffer;
        fileName = req.file.originalname;
      } else if (req.body?.useSamplePdf === true || req.body?.useSamplePdf === 'true') {
        const bytes = await buildSampleTenderPdfBytes();
        buffer = Buffer.from(bytes);
        fileName = 'DEMO_Water_SCADA_RFP_2026.pdf';
      }

      if (!buffer) {
        res.status(400).json({ error: 'Please upload a valid PDF file.' });
        return;
      }

      const parsed = await parseAndIndexPdf(buffer);
      res.json({
        fileName,
        mimeType: 'application/pdf',
        fileSizeBytes: buffer.length,
        pageCount: parsed.pageCount,
        extractionMethod: parsed.extractionMethod,
        extractedPreview: parsed.extractedPreview,
        fullText: parsed.fullText,
        chunks: parsed.chunks,
      });
    } catch (err) {
      const formatted = formatGeminiError(err);
      console.error('PDF parsing error:', err);
      res.status(formatted.status).json({ error: formatted.message });
    }
  },
);

// Agent 1: Tender Document Understanding
app.post('/api/ai/analyze-tender', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { tenderTitle, documentText } = req.body || {};
    if (!documentText || typeof documentText !== 'string' || documentText.trim().length < 40) {
      res.status(400).json({ error: 'Tender text must be at least 40 characters to analyze.' });
      return;
    }
    const analysis = await runTenderDocumentAgent({ tenderTitle, documentText });
    res.json({ analysis });
  } catch (err) {
    const formatted = formatGeminiError(err);
    console.error('Analyze tender error:', err);
    res.status(formatted.status).json({ error: formatted.message });
  }
});

// Agent 2: Evidence-Based Eligibility Checker
app.post('/api/ai/check-eligibility', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { tenderTitle, tenderSummary, analysis, chunks, companyProfile } = req.body || {};
    if (!tenderTitle || !companyProfile) {
      res.status(400).json({ error: 'Tender details and company profile are required.' });
      return;
    }
    const eligibility = await runEligibilityAgent({
      tenderTitle,
      tenderSummary: tenderSummary || '',
      analysis: analysis || null,
      chunks: Array.isArray(chunks) ? chunks : [],
      companyProfile,
    });
    res.json({ eligibility });
  } catch (err) {
    const formatted = formatGeminiError(err);
    console.error('Eligibility check error:', err);
    res.status(formatted.status).json({ error: formatted.message });
  }
});

// Agent 4: Proposal Co-Author (Full or Single-Section Regeneration)
app.post('/api/ai/generate-proposal', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const {
      tenderTitle,
      tenderAuthority,
      tenderReference,
      templateType,
      targetSectionHeading,
      tenderSummary,
      analysis,
      chunks,
      companyProfile,
      customInstructions,
    } = req.body || {};

    if (!tenderTitle || !templateType || !companyProfile) {
      res.status(400).json({ error: 'Tender title, template type, and company profile are required.' });
      return;
    }

    const proposal = await runProposalGeneratorAgent({
      tenderTitle,
      tenderAuthority: tenderAuthority || 'Issuing Authority',
      tenderReference: tenderReference || 'N/A',
      templateType,
      targetSectionHeading,
      tenderSummary: tenderSummary || '',
      analysis: analysis || null,
      chunks: Array.isArray(chunks) ? chunks : [],
      companyProfile,
      customInstructions,
    });
    res.json({ proposal });
  } catch (err) {
    const formatted = formatGeminiError(err);
    console.error('Proposal generation error:', err);
    res.status(formatted.status).json({ error: formatted.message });
  }
});

// Agent 3: Compliance Verification
app.post('/api/ai/verify-compliance', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { tenderTitle, sections, mandatoryRequirements } = req.body || {};
    if (!tenderTitle || !Array.isArray(sections)) {
      res.status(400).json({ error: 'Tender title and proposal sections are required.' });
      return;
    }
    const verification = await runComplianceVerificationAgent({
      tenderTitle,
      sections,
      mandatoryRequirements: mandatoryRequirements || [],
    });
    res.json({ verification });
  } catch (err) {
    const formatted = formatGeminiError(err);
    console.error('Compliance verification error:', err);
    res.status(formatted.status).json({ error: formatted.message });
  }
});

// Agent 5: Financial Analysis
app.post('/api/ai/analyze-financials', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const {
      tenderTitle,
      tenderBudgetLakhs,
      emdLakhs,
      pbgPercent,
      costInputs,
      scenarios,
      companyTurnoverLakhs,
    } = req.body || {};

    if (!tenderTitle || typeof tenderBudgetLakhs !== 'number' || !costInputs) {
      res.status(400).json({ error: 'Valid tender budget and cost inputs are required.' });
      return;
    }

    const result = await runFinancialAnalysisAgent({
      tenderTitle,
      tenderBudgetLakhs,
      emdLakhs: typeof emdLakhs === 'number' ? emdLakhs : 0,
      pbgPercent: typeof pbgPercent === 'number' ? pbgPercent : 5,
      costInputs,
      scenarios: Array.isArray(scenarios) ? scenarios : [],
      companyTurnoverLakhs,
    });
    res.json({ result });
  } catch (err) {
    const formatted = formatGeminiError(err);
    console.error('Financial analysis error:', err);
    res.status(formatted.status).json({ error: formatted.message });
  }
});

// Agent 6: Risk Assessment
app.post('/api/ai/analyze-risks', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { tenderTitle, tenderSummary, analysis, chunks } = req.body || {};
    if (!tenderTitle) {
      res.status(400).json({ error: 'Tender title is required for risk analysis.' });
      return;
    }

    const riskReport = await runRiskAssessmentAgent({
      tenderTitle,
      tenderSummary: tenderSummary || '',
      analysis: analysis || null,
      chunks: Array.isArray(chunks) ? chunks : [],
    });
    res.json({ riskReport });
  } catch (err) {
    const formatted = formatGeminiError(err);
    console.error('Risk analysis error:', err);
    res.status(formatted.status).json({ error: formatted.message });
  }
});

// RAG Semantic Search & Tender Q&A
app.post('/api/ai/rag-qa', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { question, tenderTitle, chunks, sectionFilter } = req.body || {};
    if (!question || !Array.isArray(chunks)) {
      res.status(400).json({ error: 'Question and indexed document chunks are required.' });
      return;
    }
    const result = await runTenderRagQa({
      question,
      tenderTitle: tenderTitle || 'Tender Document',
      chunks,
      sectionFilter,
    });
    res.json(result);
  } catch (err) {
    const formatted = formatGeminiError(err);
    console.error('RAG Q&A error:', err);
    res.status(formatted.status).json({ error: formatted.message });
  }
});

app.post('/api/ai/rag-search', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { query, chunks, topK, sectionFilter } = req.body || {};
    if (!query || !Array.isArray(chunks)) {
      res.status(400).json({ error: 'Query and chunks are required.' });
      return;
    }
    const matches = await retrieveTopChunks(query, chunks, topK || 6, sectionFilter);
    res.json({ matches });
  } catch (err) {
    const formatted = formatGeminiError(err);
    res.status(formatted.status).json({ error: formatted.message });
  }
});

// Proposal Export: DOCX & PDF
app.post('/api/export/docx', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { title, tenderTitle, tenderReference, authority, organizationName, version, sections } =
      req.body || {};
    if (!title || !Array.isArray(sections)) {
      res.status(400).json({ error: 'Proposal title and sections are required.' });
      return;
    }

    const buffer = await generateProposalDocx({
      title,
      tenderTitle: tenderTitle || title,
      tenderReference: tenderReference || 'N/A',
      authority: authority || 'Issuing Authority',
      organizationName: organizationName || 'Registered Bidder',
      version: Number(version) || 1,
      sections,
    });

    const safeFile = `${title.replace(/[^a-zA-Z0-9_\-]+/g, '_').slice(0, 60)}_v${Number(version) || 1}.docx`;
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    );
    res.setHeader('Content-Disposition', `attachment; filename="${safeFile}"`);
    res.send(buffer);
  } catch (err) {
    console.error('DOCX export error:', err);
    res.status(500).json({ error: 'Failed to export DOCX proposal.' });
  }
});

app.post('/api/export/pdf', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { title, tenderTitle, tenderReference, authority, organizationName, version, sections } =
      req.body || {};
    if (!title || !Array.isArray(sections)) {
      res.status(400).json({ error: 'Proposal title and sections are required.' });
      return;
    }

    const pdfBytes = await generateProposalPdf({
      title,
      tenderTitle: tenderTitle || title,
      tenderReference: tenderReference || 'N/A',
      authority: authority || 'Issuing Authority',
      organizationName: organizationName || 'Registered Bidder',
      version: Number(version) || 1,
      sections,
    });

    const safeFile = `${title.replace(/[^a-zA-Z0-9_\-]+/g, '_').slice(0, 60)}_v${Number(version) || 1}.pdf`;
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${safeFile}"`);
    res.send(Buffer.from(pdfBytes));
  } catch (err) {
    console.error('PDF export error:', err);
    res.status(500).json({ error: 'Failed to export PDF proposal.' });
  }
});

// Multer error handler
app.use((err: unknown, _req: Request, res: Response, _next: express.NextFunction) => {
  const message = err instanceof Error ? err.message : 'Request processing failed.';
  res.status(400).json({ error: message });
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Bid Tender Writer server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
