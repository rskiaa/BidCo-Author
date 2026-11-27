import React, { useEffect, useState } from 'react';
import {
  Download,
  FileSearch,
  FileUp,
  MessageSquareText,
  Send,
  Sparkles,
} from 'lucide-react';
import {
  analyzeTenderWithAi,
  askTenderRagQa,
  downloadSampleTenderPdf,
  parseTenderPdf,
} from '../lib/apiClient.ts';
import {
  fetchDocumentChunks,
  logActivity,
  makeSafeId,
  saveDocumentAndChunks,
  saveTenderAnalysis,
  saveTenderRecord,
  updateTenderRecord,
} from '../lib/firestoreStore.ts';
import type {
  DocumentChunk,
  Organization,
  TenderAnalysis,
  TenderDocument,
  TenderRecord,
  UserProfile,
} from '../types/procurement.ts';

interface DocumentAnalyzerViewProps {
  organization: Organization;
  userProfile: UserProfile;
  tenders: TenderRecord[];
  analyses: TenderAnalysis[];
  documents: TenderDocument[];
  selectedTenderId: string;
  onSelectTender: (id: string) => void;
  onNotify: (msg: string) => void;
  onError: (msg: string) => void;
}

type ReportTab =
  | 'overview'
  | 'eligibility'
  | 'technical'
  | 'financial'
  | 'dates'
  | 'risks';

export function DocumentAnalyzerView({
  organization,
  userProfile,
  tenders,
  analyses,
  documents,
  selectedTenderId,
  onSelectTender,
  onNotify,
  onError,
}: DocumentAnalyzerViewProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [processingStage, setProcessingStage] = useState<string>('');
  const [activeTab, setActiveTab] = useState<ReportTab>('overview');
  const [ragQuestion, setRagQuestion] = useState('');
  const [ragLoading, setRagLoading] = useState(false);
  const [ragAnswer, setRagAnswer] = useState<{
    answer: string;
    citations: Array<{ pageNumber: number; excerpt: string }>;
  } | null>(null);
  const [chunks, setChunks] = useState<DocumentChunk[]>([]);

  const activeTender =
    tenders.find((t) => t.id === selectedTenderId) || tenders[0] || null;
  const activeAnalysis = activeTender
    ? analyses.find((a) => a.tenderId === activeTender.id) || null
    : null;
  const activeDoc = activeTender?.documentId
    ? documents.find((d) => d.id === activeTender.documentId) || null
    : activeTender
      ? documents.find((d) => d.tenderId === activeTender.id) || null
      : null;

  useEffect(() => {
    setRagAnswer(null);
    if (activeDoc) {
      void fetchDocumentChunks(organization.id, activeDoc.id, userProfile.uid)
        .then(setChunks)
        .catch(() => setChunks([]));
    } else {
      setChunks([]);
    }
  }, [activeDoc, organization.id, userProfile.uid]);

  const runPdfPipeline = async (useSample = false) => {
    if (!useSample && !selectedFile) {
      onError('Please choose a PDF tender file first, or run the Sample RFP PDF pipeline.');
      return;
    }

    try {
      setProcessingStage('1/3 Extracting text and tables from PDF...');
      const parsed = await parseTenderPdf(useSample ? undefined : selectedFile || undefined, useSample);

      setProcessingStage('2/3 Running Gemini Tender Document Understanding Agent...');
      const aiRes = await analyzeTenderWithAi(
        activeTender?.title || parsed.fileName,
        parsed.fullText,
      );
      const report = aiRes.analysis as unknown as Omit<
        TenderAnalysis,
        'id' | 'orgId' | 'ownerId' | 'memberUids' | 'tenderId' | 'createdAt' | 'updatedAt'
      >;

      setProcessingStage('3/3 Saving indexed chunks & structured report to Firestore...');
      let targetTenderId = activeTender?.id;
      if (!targetTenderId || useSample) {
        targetTenderId = makeSafeId('tnd');
        await saveTenderRecord(organization, {
          id: targetTenderId,
          referenceNumber:
            report.tenderMetadata?.referenceNumber ||
            (useSample ? 'NIC/DEMO/UWSS/2026-27/048 (DEMO PDF)' : `PDF-${Date.now()}`),
          title: useSample
            ? 'Smart Urban Water SCADA & Telemetry (Parsed Sample PDF)'
            : parsed.fileName.replace(/\.pdf$/i, ''),
          authority: report.tenderMetadata?.issuingAuthority || 'Issuing Authority',
          industry: organization.industry,
          sourceType: useSample ? 'DEMO_DATA' : 'UPLOADED_PDF',
          sourcePortal: useSample ? 'Sample PDF (DEMO DATA)' : 'Uploaded Tender PDF',
          status: 'Under Review',
          eligibilityStatus: 'Not Checked',
          assignedToUid: userProfile.uid,
          assignedToName: userProfile.displayName,
          summary: report.executiveSummary,
          isSaved: true,
        });
      }

      const docId = makeSafeId('doc');
      await saveDocumentAndChunks(
        organization,
        {
          id: docId,
          tenderId: targetTenderId,
          fileName: parsed.fileName,
          mimeType: parsed.mimeType,
          fileSizeBytes: parsed.fileSizeBytes,
          pageCount: parsed.pageCount,
          chunkCount: parsed.chunks.length,
          extractedPreview: parsed.extractedPreview,
        },
        parsed.chunks,
      );

      await updateTenderRecord(organization.id, targetTenderId, {
        documentId: docId,
        summary: report.executiveSummary.slice(0, 3900),
      });

      const analysisId = makeSafeId('anl');
      await saveTenderAnalysis(organization, {
        id: analysisId,
        tenderId: targetTenderId,
        documentId: docId,
        ...report,
      });

      await logActivity(organization, {
        actorUid: userProfile.uid,
        actorName: userProfile.displayName,
        tenderId: targetTenderId,
        actionType: 'PDF_ANALYZED',
        description: `Parsed "${parsed.fileName}" (${parsed.pageCount} pages, ${parsed.chunks.length} RAG chunks) via ${parsed.extractionMethod}.`,
      });

      onSelectTender(targetTenderId);
      setSelectedFile(null);
      onNotify(
        `Analyzed "${parsed.fileName}" (${parsed.pageCount} pages, ${parsed.chunks.length} vector chunks indexed).`,
      );
    } catch (err) {
      onError(err instanceof Error ? err.message : 'PDF analysis failed.');
    } finally {
      setProcessingStage('');
    }
  };

  const handleAskRag = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ragQuestion.trim() || !activeTender) return;
    setRagLoading(true);
    try {
      const res = await askTenderRagQa({
        question: ragQuestion.trim(),
        tenderTitle: activeTender.title,
        chunks: chunks.map((c) => ({
          pageNumber: c.pageNumber,
          sectionType: c.sectionType,
          content: c.content,
          embedding: c.embedding,
        })),
      });
      setRagAnswer(res);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'RAG Q&A failed.');
    } finally {
      setRagLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Upload & Tender Target Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-lg font-bold text-slate-900">
              AI Tender Document Analyzer &amp; Vector Indexer
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Extracts text &amp; tables, creates Gemini vector embeddings for RAG, and produces a
              page-cited structured analysis report.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => downloadSampleTenderPdf().catch((e) => onError(e.message))}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium border border-[#DADCE0] rounded-lg hover:bg-[#F1F3F4] text-[#3C4043]"
            >
              <Download className="w-3.5 h-3.5" />
              Download Sample RFP PDF
            </button>
            <button
              type="button"
              disabled={Boolean(processingStage)}
              onClick={() => runPdfPipeline(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium bg-[#E8F0FE] text-[#1967D2] border border-[#D2E3FC] rounded-lg hover:bg-[#D2E3FC]/70 disabled:opacity-60"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Test Full Pipeline with Sample PDF
            </button>
          </div>
        </div>

        <div className="grid lg:grid-cols-12 gap-4 items-center">
          <div className="lg:col-span-4">
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Target Workspace Tender (or creates new)
            </label>
            <select
              value={activeTender?.id || ''}
              onChange={(e) => onSelectTender(e.target.value)}
              className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-lg bg-white"
            >
              <option value="">Create new tender from uploaded PDF</option>
              {tenders.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.referenceNumber} — {t.title.slice(0, 55)}
                </option>
              ))}
            </select>
          </div>

          <div className="lg:col-span-5">
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Upload Tender PDF (Max 20 MB)
            </label>
            <input
              type="file"
              accept="application/pdf,.pdf"
              onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
              className="block w-full text-xs text-slate-600 file:mr-3 file:py-2 file:px-3.5 file:rounded-lg file:border file:border-slate-300 file:text-xs file:font-medium file:bg-slate-50 file:text-slate-800 hover:file:bg-slate-100"
            />
          </div>

          <div className="lg:col-span-3 flex items-end pt-4 lg:pt-5">
            <button
              type="button"
              disabled={!selectedFile || Boolean(processingStage)}
              onClick={() => runPdfPipeline(false)}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-[#1A73E8] text-white text-sm font-medium rounded-lg hover:bg-[#1557B0] disabled:opacity-50"
            >
              <FileUp className="w-4 h-4" />
              Parse &amp; Analyze PDF
            </button>
          </div>
        </div>

        {processingStage && (
          <div className="p-3.5 rounded-lg bg-[#E8F0FE] border border-[#D2E3FC] text-xs font-medium text-[#174EA6] flex items-center gap-2.5">
            <div className="w-4 h-4 border-2 border-[#1A73E8] border-t-transparent rounded-full animate-spin" />
            {processingStage}
          </div>
        )}
      </div>

      {/* RAG Q&A over Indexed Chunks */}
      {activeDoc && chunks.length > 0 && (
        <div className="bg-white border border-[#DADCE0] rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-semibold text-[#202124]">
              <MessageSquareText className="w-4 h-4 text-[#1A73E8]" />
              Ask Tender Document (Vector RAG · {chunks.length} indexed chunks from{' '}
              {activeDoc.fileName})
            </div>
            <span className="text-xs font-mono text-[#5F6368]">{activeDoc.pageCount} pages</span>
          </div>

          <form onSubmit={handleAskRag} className="flex gap-2">
            <input
              type="text"
              value={ragQuestion}
              onChange={(e) => setRagQuestion(e.target.value)}
              placeholder="Ask e.g. 'What is the EMD amount and liquidated damages cap?'"
              className="flex-1 px-3.5 py-2 text-sm border border-[#DADCE0] rounded-lg focus:outline-none focus:border-[#1A73E8]"
            />
            <button
              type="submit"
              disabled={ragLoading || !ragQuestion.trim()}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#1A73E8] text-white text-sm font-medium rounded-lg hover:bg-[#1557B0] disabled:opacity-60"
            >
              <Send className="w-3.5 h-3.5" />
              {ragLoading ? 'Searching...' : 'Ask'}
            </button>
          </form>

          {ragAnswer && (
            <div className="p-4 rounded-lg bg-[#F8F9FA] border border-[#DADCE0] space-y-2 text-sm">
              <p className="text-[#202124] leading-relaxed">{ragAnswer.answer}</p>
              {ragAnswer.citations.length > 0 && (
                <div className="pt-2 border-t border-[#E8EAED] space-y-1.5">
                  <p className="text-xs font-semibold text-[#5F6368]">Retrieved Citations:</p>
                  {ragAnswer.citations.map((c, idx) => (
                    <p key={idx} className="text-xs text-[#5F6368]">
                      <span className="font-mono font-semibold text-[#1A73E8]">
                        [Page {c.pageNumber}]
                      </span>{' '}
                      “{c.excerpt}”
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Structured Analysis Report */}
      {!activeAnalysis ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center space-y-3">
          <FileSearch className="w-8 h-8 text-slate-400 mx-auto" />
          <h3 className="font-display text-base font-semibold text-slate-900">
            No Analysis Report Selected
          </h3>
          <p className="text-sm text-slate-500 max-w-md mx-auto">
            Upload a tender PDF above or click “Test Full Pipeline with Sample PDF” to extract
            requirements, dates, EMD, technical specs, and risks with page citations.
          </p>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-display text-base font-bold text-slate-900">
                Structured Tender Analysis Report
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                {activeTender?.referenceNumber} · Evidence cited from source pages
              </p>
            </div>
            <div className="flex flex-wrap gap-1 p-1 bg-slate-100 rounded-lg">
              {(
                [
                  ['overview', 'Executive Overview'],
                  ['eligibility', 'Eligibility'],
                  ['technical', 'Technical Specs'],
                  ['financial', 'Financial & EMD'],
                  ['dates', 'Important Dates'],
                  ['risks', 'Disqualification & Risks'],
                ] as const
              ).map(([tabId, label]) => (
                <button
                  key={tabId}
                  type="button"
                  onClick={() => setActiveTab(tabId)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                    activeTab === tabId
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="p-6">
            {activeTab === 'overview' && (
              <div className="space-y-6">
                <div>
                  <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                    Executive Summary
                  </h4>
                  <p className="text-sm text-slate-800 leading-relaxed">
                    {activeAnalysis.executiveSummary}
                  </p>
                </div>

                {activeAnalysis.tenderMetadata && (
                  <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-4 border-t border-slate-200 text-xs">
                    {[
                      ['Reference No', activeAnalysis.tenderMetadata.referenceNumber],
                      ['Issuing Authority', activeAnalysis.tenderMetadata.issuingAuthority],
                      ['Estimated Value', activeAnalysis.tenderMetadata.estimatedValue],
                      ['EMD Requirement', activeAnalysis.tenderMetadata.emdRequirement],
                      ['Tender Fee', activeAnalysis.tenderMetadata.tenderFee],
                      ['Performance Security', activeAnalysis.tenderMetadata.performanceSecurity],
                      ['Submission Deadline', activeAnalysis.tenderMetadata.submissionDeadline],
                      ['Bid Validity', activeAnalysis.tenderMetadata.bidValidityDays],
                    ].map(([k, v]) => (
                      <div key={k} className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                        <p className="text-slate-500">{k}</p>
                        <p className="font-medium text-slate-900 mt-1">{v || 'Not specified'}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {activeTab === 'eligibility' && (
              <FindingsList
                items={activeAnalysis.eligibilityCriteria || []}
                emptyText="No explicit eligibility clauses extracted."
              />
            )}

            {activeTab === 'technical' && (
              <FindingsList
                items={activeAnalysis.technicalSpecs || []}
                emptyText="No technical specifications extracted."
              />
            )}

            {activeTab === 'financial' && (
              <div className="space-y-6">
                <FindingsList
                  items={activeAnalysis.financialRequirements || []}
                  emptyText="No financial requirements extracted."
                />
                <div className="pt-4 border-t border-slate-200">
                  <h4 className="text-sm font-semibold text-slate-900 mb-3">
                    Mandatory Submission Documents
                  </h4>
                  <FindingsList
                    items={activeAnalysis.mandatoryDocuments || []}
                    emptyText="No mandatory document checklist extracted."
                  />
                </div>
              </div>
            )}

            {activeTab === 'dates' && (
              <div className="divide-y divide-slate-100">
                {(activeAnalysis.importantDates || []).length === 0 ? (
                  <p className="text-sm text-slate-500">No dates extracted.</p>
                ) : (
                  (activeAnalysis.importantDates || []).map((d, idx) => (
                    <div key={idx} className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium text-[#202124]">{d.event}</p>
                        <p className="text-xs text-[#5F6368] mt-0.5">
                          <span className="font-mono text-[#1A73E8]">{d.sourcePage}</span> · “
                          {d.evidenceQuote}”
                        </p>
                      </div>
                      <span className="font-mono tabular-nums text-sm font-semibold text-[#202124] shrink-0">
                        {d.dateValue}
                      </span>
                    </div>
                  ))
                )}
              </div>
            )}

            {activeTab === 'risks' && (
              <div className="space-y-6">
                <div>
                  <h4 className="text-sm font-semibold text-[#202124] mb-3">
                    Disqualification Conditions
                  </h4>
                  <FindingsList
                    items={activeAnalysis.disqualificationConditions || []}
                    emptyText="No explicit disqualification triggers extracted."
                  />
                </div>
                <div className="pt-4 border-t border-[#E8EAED]">
                  <h4 className="text-sm font-semibold text-[#202124] mb-3">
                    Initial Risk &amp; Ambiguity Clauses
                  </h4>
                  <div className="space-y-3">
                    {(activeAnalysis.initialRisks || []).map((r, idx) => (
                      <div key={idx} className="p-4 rounded-lg border border-[#DADCE0]">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <span className="text-xs font-semibold text-[#B06000]">
                            Severity: {r.severity}
                          </span>
                          <span className="text-xs font-mono text-[#1A73E8]">{r.sourcePage}</span>
                        </div>
                        <p className="text-sm font-medium text-[#202124]">{r.clause}</p>
                        <p className="text-xs text-[#5F6368] mt-1">Evidence: “{r.evidenceQuote}”</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function FindingsList({
  items,
  emptyText,
}: {
  items: Array<{
    item: string;
    category?: string;
    mandatory?: boolean;
    sourcePage: string;
    evidenceQuote: string;
  }>;
  emptyText: string;
}) {
  if (items.length === 0) {
    return <p className="text-sm text-[#5F6368]">{emptyText}</p>;
  }
  return (
    <div className="space-y-3">
      {items.map((f, idx) => (
        <div key={idx} className="p-4 rounded-lg border border-[#DADCE0] space-y-1.5">
          <div className="flex items-center justify-between gap-3 text-xs">
            <span className="text-[#5F6368]">
              {f.category || 'Requirement'} · {f.mandatory === false ? 'Optional' : 'Mandatory'}
            </span>
            <span className="font-mono font-medium text-[#1A73E8]">{f.sourcePage}</span>
          </div>
          <p className="text-sm font-medium text-[#202124]">{f.item}</p>
          <p className="text-xs text-[#5F6368]">Source quote: “{f.evidenceQuote}”</p>
        </div>
      ))}
    </div>
  );
}
