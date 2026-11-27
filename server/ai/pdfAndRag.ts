import { createRequire } from 'module';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { getGeminiClient, GEMINI_EMBEDDING_MODEL, GEMINI_TEXT_MODEL, withGeminiRetry } from './client.ts';

const require = createRequire(import.meta.url);
// pdf-parse v1 exports a function; handle both CJS and default exports safely
const pdfParseModule = require('pdf-parse');
const pdfParse: (
  buf: Buffer,
  options?: { pagerender?: (pageData: unknown) => Promise<string> },
) => Promise<{ numpages: number; text: string }> =
  typeof pdfParseModule === 'function' ? pdfParseModule : pdfParseModule.default;

export interface ParsedChunk {
  chunkIndex: number;
  pageNumber: number;
  sectionType: string;
  content: string;
  embedding: number[];
}

export interface ParsedPdfResult {
  pageCount: number;
  fullText: string;
  extractedPreview: string;
  chunks: ParsedChunk[];
  extractionMethod: 'pdf-parse' | 'gemini-multimodal-ocr';
}

function inferSectionType(text: string): string {
  const lower = text.toLowerCase();
  if (/eligib|turnover|net worth|experience|msme|start-?up|qualification|bidder/.test(lower)) {
    return 'Eligibility';
  }
  if (/emd|earnest money|tender fee|performance security|pbg|payment|financial|boq|price/.test(lower)) {
    return 'Financial';
  }
  if (/deadline|last date|pre-bid|opening date|validity|schedule|timeline/.test(lower)) {
    return 'Dates & Schedule';
  }
  if (/liquidated damages|penalty|termination|arbitration|indemnity|disqualif|blacklisted|risk/.test(lower)) {
    return 'Terms & Risk';
  }
  if (/technical|specification|architecture|sla|uptime|iso|certif|scope of work/.test(lower)) {
    return 'Technical Specs';
  }
  return 'General';
}

export function chunkPages(
  pages: Array<{ pageNumber: number; text: string }>,
  maxChunkChars = 950,
  overlapChars = 140,
): Array<{ chunkIndex: number; pageNumber: number; sectionType: string; content: string }> {
  const chunks: Array<{ chunkIndex: number; pageNumber: number; sectionType: string; content: string }> = [];
  let idx = 0;

  for (const page of pages) {
    const clean = page.text.replace(/\s+/g, ' ').trim();
    if (!clean) continue;

    if (clean.length <= maxChunkChars) {
      chunks.push({
        chunkIndex: idx++,
        pageNumber: page.pageNumber,
        sectionType: inferSectionType(clean),
        content: clean,
      });
      continue;
    }

    let start = 0;
    while (start < clean.length) {
      const end = Math.min(start + maxChunkChars, clean.length);
      const slice = clean.slice(start, end).trim();
      if (slice.length > 25) {
        chunks.push({
          chunkIndex: idx++,
          pageNumber: page.pageNumber,
          sectionType: inferSectionType(slice),
          content: slice,
        });
      }
      if (end >= clean.length) break;
      start = Math.max(start + 1, end - overlapChars);
    }
  }

  return chunks;
}

export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  const ai = getGeminiClient();
  const embeddings: number[][] = [];

  // Process in batches of 10 to keep payloads bounded
  for (let i = 0; i < texts.length; i += 10) {
    const batch = texts.slice(i, i + 10);
    const results = await Promise.all(
      batch.map((text) =>
        withGeminiRetry(async () => {
          const res = await ai.models.embedContent({
            model: GEMINI_EMBEDDING_MODEL,
            contents: text,
          });
          return res.embeddings?.[0]?.values ?? [];
        }),
      ),
    );
    embeddings.push(...results);
  }
  return embeddings;
}

export function cosineSimilarity(a: number[], b: number[]): number {
  if (!a.length || !b.length || a.length !== b.length) return 0;
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

export async function retrieveTopChunks(
  query: string,
  chunks: Array<{ pageNumber: number; sectionType?: string; content: string; embedding?: number[] }>,
  topK = 8,
  sectionFilter?: string,
): Promise<Array<{ pageNumber: number; sectionType: string; content: string; score: number }>> {
  const filtered = sectionFilter
    ? chunks.filter((c) => (c.sectionType || '').toLowerCase() === sectionFilter.toLowerCase())
    : chunks;
  const candidates = filtered.length > 0 ? filtered : chunks;
  if (candidates.length === 0) return [];

  const hasEmbeddings = candidates.some((c) => Array.isArray(c.embedding) && c.embedding.length > 0);
  if (hasEmbeddings) {
    const [queryEmbedding] = await embedTexts([query]);
    if (queryEmbedding && queryEmbedding.length > 0) {
      return candidates
        .map((c) => ({
          pageNumber: c.pageNumber,
          sectionType: c.sectionType || 'General',
          content: c.content,
          score: cosineSimilarity(queryEmbedding, c.embedding || []),
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, topK);
    }
  }

  // Fallback lexical overlap scoring if embeddings weren't stored on a legacy chunk
  const tokens = query
    .toLowerCase()
    .split(/\W+/)
    .filter((t) => t.length > 2);
  return candidates
    .map((c) => {
      const lower = c.content.toLowerCase();
      const hits = tokens.reduce((acc, tok) => acc + (lower.includes(tok) ? 1 : 0), 0);
      return {
        pageNumber: c.pageNumber,
        sectionType: c.sectionType || 'General',
        content: c.content,
        score: hits / Math.max(tokens.length, 1),
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}

export async function parseAndIndexPdf(buffer: Buffer): Promise<ParsedPdfResult> {
  // Verify %PDF- magic bytes
  if (buffer.subarray(0, 5).toString('ascii') !== '%PDF-') {
    throw new Error('Uploaded file is not a valid PDF document.');
  }

  const pages: Array<{ pageNumber: number; text: string }> = [];
  let pageCounter = 0;

  let parsedNumPages = 0;
  try {
    const data = await pdfParse(buffer, {
      pagerender: async (pageData: unknown) => {
        pageCounter += 1;
        const pNum = pageCounter;
        const typed = pageData as {
          getTextContent: () => Promise<{ items: Array<{ str?: string }> }>;
        };
        const textContent = await typed.getTextContent();
        const pageText = textContent.items.map((item) => item.str || '').join(' ');
        pages.push({ pageNumber: pNum, text: pageText });
        return `\n[Page ${pNum}]\n${pageText}`;
      },
    });
    parsedNumPages = data.numpages || pages.length || 1;
  } catch (err) {
    console.warn('pdf-parse encountered an issue, falling back to Gemini PDF reader:', err);
  }

  const combinedLen = pages.reduce((acc, p) => acc + p.text.trim().length, 0);
  let extractionMethod: 'pdf-parse' | 'gemini-multimodal-ocr' = 'pdf-parse';

  // Scanned or image-only PDF fallback using Gemini multimodal PDF understanding
  if (combinedLen < 120) {
    extractionMethod = 'gemini-multimodal-ocr';
    const ai = getGeminiClient();
    const ocrResult = await withGeminiRetry(() =>
      ai.models.generateContent({
        model: GEMINI_TEXT_MODEL,
        contents: {
          parts: [
            {
              inlineData: {
                mimeType: 'application/pdf',
                data: buffer.toString('base64'),
              },
            },
            {
              text: 'Extract the complete text and tables from this tender PDF accurately, preserving page markers in the exact format [Page 1], [Page 2], etc. Do not summarize or omit clauses.',
            },
          ],
        },
      }),
    );

    const extracted = (ocrResult.text || '').trim();
    if (!extracted) {
      throw new Error('Could not extract readable text from this PDF.');
    }

    pages.length = 0;
    const pageMatches = extracted.split(/\[Page\s+(\d+)\]/i);
    if (pageMatches.length > 2) {
      for (let i = 1; i < pageMatches.length; i += 2) {
        const pNum = Number(pageMatches[i]) || Math.ceil(i / 2);
        const content = (pageMatches[i + 1] || '').trim();
        if (content) pages.push({ pageNumber: pNum, text: content });
      }
    } else {
      pages.push({ pageNumber: 1, text: extracted });
    }
    parsedNumPages = Math.max(parsedNumPages, pages.length);
  }

  const rawChunks = chunkPages(pages).slice(0, 45);
  const embeddings = await embedTexts(rawChunks.map((c) => c.content));

  const chunks: ParsedChunk[] = rawChunks.map((chunk, i) => ({
    ...chunk,
    embedding: embeddings[i] || [],
  }));

  const fullText = pages
    .map((p) => `[Page ${p.pageNumber}]\n${p.text.trim()}`)
    .join('\n\n');

  return {
    pageCount: parsedNumPages || pages.length || 1,
    fullText,
    extractedPreview: fullText.slice(0, 7500),
    chunks,
    extractionMethod,
  };
}

export async function buildSampleTenderPdfBytes(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  const pageLines: Array<{ title: string; body: string[] }> = [
    {
      title: 'REQUEST FOR PROPOSAL (SAMPLE DEMO DATA) - SMART URBAN WATER SCADA & TELEMETRY',
      body: [
        'Tender Reference No: NIC/DEMO/UWSS/2026-27/048',
        'Issuing Authority: Directorate of Municipal Water Infrastructure (DEMO SAMPLE)',
        'Estimated Project Value: INR 480.00 Lakhs (INR 4.80 Crore)',
        'Earnest Money Deposit (EMD): INR 9.60 Lakhs (2% of Estimated Value) via BG / e-BG',
        'Tender Processing Fee: INR 11,800 (Non-refundable, inclusive of GST)',
        'Performance Bank Guarantee (PBG): 5% of Contract Value within 15 days of LOA',
        'Last Date for Bid Submission: 2026-12-28 15:00 IST | Pre-Bid Meeting: 2026-12-10 11:00 IST',
        'Bid Validity Period: 120 days from Technical Bid Opening',
      ],
    },
    {
      title: 'SECTION 2: MANDATORY ELIGIBILITY & QUALIFICATION CRITERIA',
      body: [
        'Clause 2.1 Legal Entity: Bidder must be a registered Company / LLP in India for at least 5 years.',
        'Clause 2.2 Financial Turnover: Minimum Average Annual Turnover of INR 350.00 Lakhs over the last',
        'three audited financial years (FY 2023-24, FY 2024-25, FY 2025-26). Net worth must be positive.',
        'Clause 2.3 Past Experience: At least 2 completed Government / Municipal SCADA, IoT Telemetry,',
        'or Enterprise Cloud Monitoring projects each valued >= INR 150.00 Lakhs in the last 5 years.',
        'Clause 2.4 Mandatory Certifications: Valid ISO 9001:2015, ISO/IEC 27001:2022 Information Security,',
        'and CMMI Level 3 (or CERT-In empanelled security audit certificate for the cloud portal).',
        'Clause 2.5 Mandatory Documents: GSTIN Certificate, PAN Card, Udyam MSME (if claiming EMD exemption),',
        'Audited Balance Sheets (3 Years), Non-Blacklisting Affidavit on INR 100 Stamp Paper.',
      ],
    },
    {
      title: 'SECTION 3: TECHNICAL SPECIFICATIONS, SLAs & RISK CLAUSES',
      body: [
        'Clause 3.1 Scope: Supply, installation, and 36-month O&M of 120 ultrasonic flow meters, RTUs,',
        'and a centralized cloud SCADA analytics platform hosted in MeitY-empanelled India Data Centers.',
        'Clause 3.2 System Uptime SLA: Minimum 99.5% monthly availability measured across central dashboard.',
        'Clause 3.3 Delivery Timeline: Commissioning of all 120 nodes within 16 weeks from Work Order.',
        'Clause 3.4 Liquidated Damages: Delay beyond 16 weeks attracts LD at 0.5% of contract value per week',
        'up to a maximum cap of 10% of total contract value; beyond 10% authority may terminate.',
        'Clause 3.5 Payment Terms: 50% on hardware delivery & inspection, 30% on Go-Live UAT sign-off,',
        'and 20% in equal quarterly O&M installments over 36 months. No mobilization advance is payable.',
        'Clause 3.6 Disqualification: Conditional bids, unsigned Annexures, or missing EMD lead to rejection.',
      ],
    },
  ];

  for (const pageSpec of pageLines) {
    const page = doc.addPage([595, 842]);
    let y = 790;
    page.drawText(pageSpec.title, { x: 48, y, size: 11, font: bold, color: rgb(0.06, 0.11, 0.22) });
    y -= 28;
    for (const line of pageSpec.body) {
      page.drawText(line, { x: 48, y, size: 10, font, color: rgb(0.15, 0.2, 0.28) });
      y -= 20;
    }
  }

  return doc.save();
}
