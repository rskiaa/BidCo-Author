import { Type } from '@google/genai';
import { getGeminiClient, GEMINI_TEXT_MODEL, withGeminiRetry } from './client.ts';
import { retrieveTopChunks } from './pdfAndRag.ts';

function parseJsonSafe<T>(raw: string | undefined, fallbackMsg: string): T {
  const cleaned = (raw || '').trim();
  if (!cleaned) {
    throw new Error(fallbackMsg);
  }
  return JSON.parse(cleaned) as T;
}

const citedFindingSchema = {
  type: Type.OBJECT,
  properties: {
    item: { type: Type.STRING },
    category: { type: Type.STRING },
    mandatory: { type: Type.BOOLEAN },
    sourcePage: { type: Type.STRING },
    evidenceQuote: { type: Type.STRING },
  },
  required: ['item', 'sourcePage', 'evidenceQuote'],
};

export async function runTenderDocumentAgent(params: {
  tenderTitle?: string;
  documentText: string;
}) {
  const ai = getGeminiClient();
  const clippedText = params.documentText.slice(0, 48000);

  const response = await withGeminiRetry(() =>
    ai.models.generateContent({
      model: GEMINI_TEXT_MODEL,
      contents: `Analyze the following government tender document thoroughly. Title hint: ${params.tenderTitle || 'Not provided'}.\n\nDOCUMENT CONTENT:\n${clippedText}`,
      config: {
        systemInstruction:
          'You are the Tender Document Understanding Agent for Bid Tender Writer. Extract accurate requirements strictly from the provided tender text. Every finding must include its sourcePage (e.g., "Page 2" or "Not specified") and a concise verbatim evidenceQuote. Never invent requirements, fees, dates, or clauses; if missing or ambiguous, explicitly write "Not specified in uploaded document" or "Requires clarification".',
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            executiveSummary: { type: Type.STRING },
            tenderMetadata: {
              type: Type.OBJECT,
              properties: {
                referenceNumber: { type: Type.STRING },
                issuingAuthority: { type: Type.STRING },
                estimatedValue: { type: Type.STRING },
                emdRequirement: { type: Type.STRING },
                tenderFee: { type: Type.STRING },
                performanceSecurity: { type: Type.STRING },
                submissionDeadline: { type: Type.STRING },
                bidValidityDays: { type: Type.STRING },
              },
              required: [
                'referenceNumber',
                'issuingAuthority',
                'estimatedValue',
                'emdRequirement',
                'tenderFee',
                'performanceSecurity',
                'submissionDeadline',
                'bidValidityDays',
              ],
            },
            eligibilityCriteria: { type: Type.ARRAY, items: citedFindingSchema },
            technicalSpecs: { type: Type.ARRAY, items: citedFindingSchema },
            financialRequirements: { type: Type.ARRAY, items: citedFindingSchema },
            importantDates: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  event: { type: Type.STRING },
                  dateValue: { type: Type.STRING },
                  sourcePage: { type: Type.STRING },
                  evidenceQuote: { type: Type.STRING },
                },
                required: ['event', 'dateValue', 'sourcePage', 'evidenceQuote'],
              },
            },
            mandatoryDocuments: { type: Type.ARRAY, items: citedFindingSchema },
            disqualificationConditions: { type: Type.ARRAY, items: citedFindingSchema },
            initialRisks: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  clause: { type: Type.STRING },
                  severity: { type: Type.STRING, enum: ['Low', 'Medium', 'High', 'Critical'] },
                  sourcePage: { type: Type.STRING },
                  evidenceQuote: { type: Type.STRING },
                },
                required: ['clause', 'severity', 'sourcePage', 'evidenceQuote'],
              },
            },
          },
          required: [
            'executiveSummary',
            'tenderMetadata',
            'eligibilityCriteria',
            'technicalSpecs',
            'financialRequirements',
            'importantDates',
            'mandatoryDocuments',
            'disqualificationConditions',
            'initialRisks',
          ],
        },
      },
    }),
  );

  return parseJsonSafe(response.text, 'Tender Document Agent returned an empty response.');
}

export async function runEligibilityAgent(params: {
  tenderTitle: string;
  tenderSummary: string;
  analysis?: Record<string, unknown> | null;
  chunks?: Array<{ pageNumber: number; sectionType?: string; content: string; embedding?: number[] }>;
  companyProfile: Record<string, unknown>;
}) {
  const ai = getGeminiClient();
  const ragChunks = params.chunks?.length
    ? await retrieveTopChunks(
        'eligibility criteria turnover net worth experience certifications mandatory documents disqualification',
        params.chunks,
        10,
      )
    : [];

  const evidenceBlock = ragChunks
    .map((c) => `[Page ${c.pageNumber} | ${c.sectionType}] ${c.content}`)
    .join('\n\n');

  const response = await withGeminiRetry(() =>
    ai.models.generateContent({
      model: GEMINI_TEXT_MODEL,
      contents: `Compare the tender eligibility requirements against the registered company profile.\n\nTENDER: ${params.tenderTitle}\nSUMMARY: ${params.tenderSummary}\n\nEXTRACTED ANALYSIS:\n${JSON.stringify(params.analysis || {}, null, 2).slice(0, 14000)}\n\nRAG TENDER CLAUSES:\n${evidenceBlock || 'No uploaded chunk context; rely on extracted analysis.'}\n\nCOMPANY PROFILE:\n${JSON.stringify(params.companyProfile, null, 2)}`,
      config: {
        systemInstruction:
          'You are the Eligibility Assessment Agent. Determine eligibility strictly as one of: "Eligible", "Potentially Eligible", "Ineligible", or "Insufficient Information". NEVER output an arbitrary percentage score as a legal eligibility determination. Compare turnover, net worth, years of operation, past experience, and certifications directly against company profile facts. If company profile lacks a required data point, mark status as "Missing Info" and overallStatus as "Insufficient Information" or "Potentially Eligible". Cite sourcePage and evidenceQuote.',
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            overallStatus: {
              type: Type.STRING,
              enum: ['Eligible', 'Potentially Eligible', 'Ineligible', 'Insufficient Information'],
            },
            summary: { type: Type.STRING },
            financialAssessment: { type: Type.STRING },
            experienceAssessment: { type: Type.STRING },
            certificationAssessment: { type: Type.STRING },
            comparisons: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  requirement: { type: Type.STRING },
                  category: { type: Type.STRING },
                  companyEvidence: { type: Type.STRING },
                  status: {
                    type: Type.STRING,
                    enum: ['Met', 'Partial', 'Not Met', 'Missing Info'],
                  },
                  sourcePage: { type: Type.STRING },
                  evidenceQuote: { type: Type.STRING },
                  remediationNote: { type: Type.STRING },
                },
                required: [
                  'requirement',
                  'category',
                  'companyEvidence',
                  'status',
                  'sourcePage',
                  'evidenceQuote',
                  'remediationNote',
                ],
              },
            },
            missingDocuments: { type: Type.ARRAY, items: { type: Type.STRING } },
            complianceGaps: { type: Type.ARRAY, items: { type: Type.STRING } },
            disqualificationRisks: { type: Type.ARRAY, items: { type: Type.STRING } },
          },
          required: [
            'overallStatus',
            'summary',
            'financialAssessment',
            'experienceAssessment',
            'certificationAssessment',
            'comparisons',
            'missingDocuments',
            'complianceGaps',
            'disqualificationRisks',
          ],
        },
      },
    }),
  );

  return parseJsonSafe(response.text, 'Eligibility Agent returned an empty response.');
}

export async function runProposalGeneratorAgent(params: {
  tenderTitle: string;
  tenderAuthority: string;
  tenderReference: string;
  templateType: string;
  targetSectionHeading?: string;
  tenderSummary: string;
  analysis?: Record<string, unknown> | null;
  chunks?: Array<{ pageNumber: number; sectionType?: string; content: string; embedding?: number[] }>;
  companyProfile: Record<string, unknown>;
  customInstructions?: string;
}) {
  const ai = getGeminiClient();
  const ragChunks = params.chunks?.length
    ? await retrieveTopChunks(
        `${params.templateType} ${params.targetSectionHeading || ''} technical specifications scope SLA deliverables compliance`,
        params.chunks,
        10,
      )
    : [];

  const evidenceBlock = ragChunks
    .map((c) => `[Page ${c.pageNumber} | ${c.sectionType}] ${c.content}`)
    .join('\n\n');

  const sectionDirective = params.targetSectionHeading
    ? `Regenerate ONLY the single section titled "${params.targetSectionHeading}" with rich, tender-aligned detail.`
    : `Generate structured sections tailored for template type "${params.templateType}" (include Executive Summary, Company Capability Statement, Technical Approach & Methodology, Implementation Plan & SLAs, Technical Compliance Matrix, and Supporting Documentation Checklist as appropriate for the template).`;

  const response = await withGeminiRetry(() =>
    ai.models.generateContent({
      model: GEMINI_TEXT_MODEL,
      contents: `${sectionDirective}\n\nTENDER: ${params.tenderTitle} (${params.tenderReference})\nAUTHORITY: ${params.tenderAuthority}\nSUMMARY: ${params.tenderSummary}\n\nEXTRACTED REQUIREMENTS:\n${JSON.stringify(params.analysis || {}, null, 2).slice(0, 12000)}\n\nRAG EVIDENCE:\n${evidenceBlock || 'Use extracted requirements and tender summary.'}\n\nCOMPANY PROFILE (FACTUAL CONTEXT ONLY):\n${JSON.stringify(params.companyProfile, null, 2)}\n\nUSER NOTES: ${params.customInstructions || 'None'}`,
      config: {
        systemInstruction:
          'You are the Technical Proposal Generation Agent for Bid Tender Writer. Write authoritative, crisp, compliance-ready government procurement prose. STRICT GROUNDING RULE: Never invent company certifications, past contract values, turnover figures, client names, or staff counts that are not present in the Company Profile. Whenever required data is missing, explicitly insert "[USER INPUT REQUIRED: <specific item>]" inside the prose and list it in missingInputs.',
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            sections: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  heading: { type: Type.STRING },
                  content: { type: Type.STRING },
                  missingInputs: { type: Type.ARRAY, items: { type: Type.STRING } },
                },
                required: ['id', 'heading', 'content', 'missingInputs'],
              },
            },
            complianceNotes: { type: Type.ARRAY, items: { type: Type.STRING } },
          },
          required: ['title', 'sections', 'complianceNotes'],
        },
      },
    }),
  );

  return parseJsonSafe(response.text, 'Proposal Generator Agent returned an empty response.');
}

export async function runComplianceVerificationAgent(params: {
  tenderTitle: string;
  sections: Array<{ heading: string; content: string }>;
  mandatoryRequirements: unknown;
}) {
  const ai = getGeminiClient();
  const response = await withGeminiRetry(() =>
    ai.models.generateContent({
      model: GEMINI_TEXT_MODEL,
      contents: `Verify this proposal draft against the tender's mandatory requirements.\n\nTENDER: ${params.tenderTitle}\nMANDATORY REQUIREMENTS:\n${JSON.stringify(params.mandatoryRequirements, null, 2).slice(0, 12000)}\n\nPROPOSAL DRAFT:\n${JSON.stringify(params.sections, null, 2).slice(0, 16000)}`,
      config: {
        systemInstruction:
          'You are the Compliance Verification Agent. Audit the proposal draft for unaddressed mandatory specifications, missing compliance declarations, or remaining [USER INPUT REQUIRED] placeholders. Return actionable verification notes.',
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            overallReadiness: {
              type: Type.STRING,
              enum: ['Ready for Internal Review', 'Needs User Inputs', 'Compliance Gaps Detected'],
            },
            verificationNotes: { type: Type.ARRAY, items: { type: Type.STRING } },
            unresolvedPlaceholders: { type: Type.ARRAY, items: { type: Type.STRING } },
          },
          required: ['overallReadiness', 'verificationNotes', 'unresolvedPlaceholders'],
        },
      },
    }),
  );

  return parseJsonSafe(response.text, 'Compliance Verification Agent returned an empty response.');
}

export async function runFinancialAnalysisAgent(params: {
  tenderTitle: string;
  tenderBudgetLakhs: number;
  emdLakhs: number;
  pbgPercent: number;
  costInputs: Record<string, number>;
  scenarios: unknown[];
  companyTurnoverLakhs?: number;
}) {
  const ai = getGeminiClient();
  const response = await withGeminiRetry(() =>
    ai.models.generateContent({
      model: GEMINI_TEXT_MODEL,
      contents: `Review this financial bid model for "${params.tenderTitle}".\nTender Budget: INR ${params.tenderBudgetLakhs} Lakhs\nEMD: INR ${params.emdLakhs} Lakhs\nPBG: ${params.pbgPercent}%\nCompany Annual Turnover: INR ${params.companyTurnoverLakhs ?? 'Not provided'} Lakhs\nCost Inputs: ${JSON.stringify(params.costInputs)}\nCalculated Scenarios: ${JSON.stringify(params.scenarios)}`,
      config: {
        systemInstruction:
          'You are the Financial Analysis Agent for Bid Tender Writer. Analyze cost structure, working capital lockup from EMD and Performance Bank Guarantee, margin sustainability, L1 price competitiveness vs budget ceiling, and financial eligibility turnover headroom. Never claim automatic bid submission. Provide clear, transparent commentary and select recommendedBidLakhs from the calculated scenarios.',
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            aiCommentary: { type: Type.STRING },
            recommendedBidLakhs: { type: Type.NUMBER },
            keyFinancialFlags: { type: Type.ARRAY, items: { type: Type.STRING } },
          },
          required: ['aiCommentary', 'recommendedBidLakhs', 'keyFinancialFlags'],
        },
      },
    }),
  );

  return parseJsonSafe(response.text, 'Financial Analysis Agent returned an empty response.');
}

export async function runRiskAssessmentAgent(params: {
  tenderTitle: string;
  tenderSummary: string;
  analysis?: Record<string, unknown> | null;
  chunks?: Array<{ pageNumber: number; sectionType?: string; content: string; embedding?: number[] }>;
}) {
  const ai = getGeminiClient();
  const ragChunks = params.chunks?.length
    ? await retrieveTopChunks(
        'liquidated damages penalty termination payment terms performance guarantee delivery timeline risk liability indemnity',
        params.chunks,
        10,
      )
    : [];

  const evidenceBlock = ragChunks
    .map((c) => `[Page ${c.pageNumber} | ${c.sectionType}] ${c.content}`)
    .join('\n\n');

  const response = await withGeminiRetry(() =>
    ai.models.generateContent({
      model: GEMINI_TEXT_MODEL,
      contents: `Perform a procurement contract & bid risk audit for "${params.tenderTitle}".\nSUMMARY: ${params.tenderSummary}\nANALYSIS:\n${JSON.stringify(params.analysis || {}, null, 2).slice(0, 12000)}\n\nRAG CLAUSES:\n${evidenceBlock || 'Use extracted analysis and summary.'}`,
      config: {
        systemInstruction:
          'You are the Risk Assessment Agent for Bid Tender Writer. Identify strict eligibility traps, financial exposure, liquidated damages, penalty clauses, delivery timeline compression, payment delays, performance bank guarantees, and ambiguous terms. Assign each risk a severity of Low, Medium, High, or Critical, provide a concrete mitigation, and cite sourcePage and verbatim evidenceQuote.',
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            overallRiskLevel: { type: Type.STRING, enum: ['Low', 'Medium', 'High', 'Critical'] },
            executiveSummary: { type: Type.STRING },
            risks: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  title: { type: Type.STRING },
                  category: { type: Type.STRING },
                  severity: { type: Type.STRING, enum: ['Low', 'Medium', 'High', 'Critical'] },
                  description: { type: Type.STRING },
                  mitigation: { type: Type.STRING },
                  sourcePage: { type: Type.STRING },
                  evidenceQuote: { type: Type.STRING },
                },
                required: [
                  'id',
                  'title',
                  'category',
                  'severity',
                  'description',
                  'mitigation',
                  'sourcePage',
                  'evidenceQuote',
                ],
              },
            },
          },
          required: ['overallRiskLevel', 'executiveSummary', 'risks'],
        },
      },
    }),
  );

  return parseJsonSafe(response.text, 'Risk Assessment Agent returned an empty response.');
}

export async function runTenderRagQa(params: {
  question: string;
  tenderTitle: string;
  chunks: Array<{ pageNumber: number; sectionType?: string; content: string; embedding?: number[] }>;
  sectionFilter?: string;
}) {
  const topChunks = await retrieveTopChunks(
    params.question,
    params.chunks,
    6,
    params.sectionFilter,
  );

  if (topChunks.length === 0) {
    return {
      answer: 'No indexed document chunks are available for this tender yet. Upload and index a PDF tender document first.',
      citations: [],
    };
  }

  const ai = getGeminiClient();
  const context = topChunks
    .map((c, idx) => `[Source ${idx + 1} | Page ${c.pageNumber} | ${c.sectionType}]\n${c.content}`)
    .join('\n\n');

  const response = await withGeminiRetry(() =>
    ai.models.generateContent({
      model: GEMINI_TEXT_MODEL,
      contents: `Tender: ${params.tenderTitle}\nQuestion: ${params.question}\n\nRETRIEVED DOCUMENT EVIDENCE:\n${context}`,
      config: {
        systemInstruction:
          'Answer the question strictly using the retrieved tender chunks. Cite page numbers inline (e.g., [Page 2]). If the retrieved chunks do not contain the answer, state clearly that the uploaded excerpt does not specify it.',
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            answer: { type: Type.STRING },
            citations: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  pageNumber: { type: Type.INTEGER },
                  excerpt: { type: Type.STRING },
                },
                required: ['pageNumber', 'excerpt'],
              },
            },
          },
          required: ['answer', 'citations'],
        },
      },
    }),
  );

  return parseJsonSafe<{ answer: string; citations: Array<{ pageNumber: number; excerpt: string }> }>(
    response.text,
    'RAG Q&A returned an empty response.',
  );
}
