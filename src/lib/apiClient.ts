import { auth } from './firebase.ts';
import type {
  CostInputs,
  BidScenario,
  DiscoveryTenderItem,
  ProposalSection,
} from '../types/procurement.ts';

async function getAuthHeaders(includeJsonContentType = true): Promise<Record<string, string>> {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('You must be signed in to run AI and backend actions.');
  }
  const token = await user.getIdToken();
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
  };
  if (includeJsonContentType) {
    headers['Content-Type'] = 'application/json';
  }
  return headers;
}

async function apiRequest<T>(url: string, options: RequestInit = {}): Promise<T> {
  const isFormData = options.body instanceof FormData;
  const authHeaders = await getAuthHeaders(!isFormData);
  const res = await fetch(url, {
    ...options,
    headers: {
      ...authHeaders,
      ...(options.headers || {}),
    },
  });

  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const payload = (await res.json()) as { error?: string };
      if (payload?.error) message = payload.error;
    } catch {
      // ignore non-json error body
    }
    throw new Error(message);
  }
  return (await res.json()) as T;
}

export async function fetchDiscoveryTenders(filters: Record<string, string>) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(filters)) {
    if (v) qs.set(k, v);
  }
  return apiRequest<{
    tenders: DiscoveryTenderItem[];
    integrations: Array<{
      portal: string;
      name: string;
      configured: boolean;
      mode: string;
      notes: string;
    }>;
  }>(`/api/tenders/discover?${qs.toString()}`);
}

export async function parseTenderPdf(file?: File, useSamplePdf = false) {
  if (file) {
    const fd = new FormData();
    fd.append('file', file);
    return apiRequest<{
      fileName: string;
      mimeType: string;
      fileSizeBytes: number;
      pageCount: number;
      extractionMethod: string;
      extractedPreview: string;
      fullText: string;
      chunks: Array<{
        chunkIndex: number;
        pageNumber: number;
        sectionType: string;
        content: string;
        embedding: number[];
      }>;
    }>('/api/tenders/parse-pdf', {
      method: 'POST',
      body: fd,
    });
  }

  return apiRequest<{
    fileName: string;
    mimeType: string;
    fileSizeBytes: number;
    pageCount: number;
    extractionMethod: string;
    extractedPreview: string;
    fullText: string;
    chunks: Array<{
      chunkIndex: number;
      pageNumber: number;
      sectionType: string;
      content: string;
      embedding: number[];
    }>;
  }>('/api/tenders/parse-pdf', {
    method: 'POST',
    body: JSON.stringify({ useSamplePdf }),
  });
}

export async function analyzeTenderWithAi(tenderTitle: string, documentText: string) {
  return apiRequest<{ analysis: Record<string, unknown> }>('/api/ai/analyze-tender', {
    method: 'POST',
    body: JSON.stringify({ tenderTitle, documentText }),
  });
}

export async function checkEligibilityWithAi(payload: {
  tenderTitle: string;
  tenderSummary: string;
  analysis?: Record<string, unknown> | null;
  chunks?: Array<{ pageNumber: number; sectionType?: string; content: string; embedding?: number[] }>;
  companyProfile: Record<string, unknown>;
}) {
  return apiRequest<{ eligibility: Record<string, unknown> }>('/api/ai/check-eligibility', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function generateProposalWithAi(payload: {
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
  return apiRequest<{
    proposal: {
      title: string;
      sections: ProposalSection[];
      complianceNotes: string[];
    };
  }>('/api/ai/generate-proposal', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function verifyProposalComplianceWithAi(payload: {
  tenderTitle: string;
  sections: Array<{ heading: string; content: string }>;
  mandatoryRequirements: unknown;
}) {
  return apiRequest<{
    verification: {
      overallReadiness: string;
      verificationNotes: string[];
      unresolvedPlaceholders: string[];
    };
  }>('/api/ai/verify-compliance', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function analyzeFinancialsWithAi(payload: {
  tenderTitle: string;
  tenderBudgetLakhs: number;
  emdLakhs: number;
  pbgPercent: number;
  costInputs: CostInputs;
  scenarios: BidScenario[];
  companyTurnoverLakhs?: number;
}) {
  return apiRequest<{
    result: {
      aiCommentary: string;
      recommendedBidLakhs: number;
      keyFinancialFlags: string[];
    };
  }>('/api/ai/analyze-financials', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function analyzeRisksWithAi(payload: {
  tenderTitle: string;
  tenderSummary: string;
  analysis?: Record<string, unknown> | null;
  chunks?: Array<{ pageNumber: number; sectionType?: string; content: string; embedding?: number[] }>;
}) {
  return apiRequest<{ riskReport: Record<string, unknown> }>('/api/ai/analyze-risks', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function askTenderRagQa(payload: {
  question: string;
  tenderTitle: string;
  chunks: Array<{ pageNumber: number; sectionType?: string; content: string; embedding?: number[] }>;
  sectionFilter?: string;
}) {
  return apiRequest<{
    answer: string;
    citations: Array<{ pageNumber: number; excerpt: string }>;
  }>('/api/ai/rag-qa', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function downloadProposalExport(
  format: 'docx' | 'pdf',
  payload: {
    title: string;
    tenderTitle: string;
    tenderReference: string;
    authority: string;
    organizationName: string;
    version: number;
    sections: Array<{ heading: string; content: string }>;
  },
) {
  const headers = await getAuthHeaders(true);
  const res = await fetch(`/api/export/${format}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    throw new Error(`Export ${format.toUpperCase()} failed (${res.status}).`);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${payload.title.replace(/[^a-zA-Z0-9_\-]+/g, '_').slice(0, 50)}_v${payload.version}.${format}`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export async function downloadSampleTenderPdf() {
  const headers = await getAuthHeaders(false);
  const res = await fetch('/api/tenders/sample-pdf', { headers });
  if (!res.ok) throw new Error('Failed to download sample PDF.');
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'DEMO_Water_SCADA_RFP_2026.pdf';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
