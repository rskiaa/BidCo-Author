import React, { useState } from 'react';
import { Download, FileText, FolderOpen } from 'lucide-react';
import { downloadProposalExport } from '../lib/apiClient.ts';
import type {
  GeneratedProposal,
  Organization,
  TenderDocument,
  TenderRecord,
} from '../types/procurement.ts';
import type { NavSection } from './SidebarLayout.tsx';

interface DocumentsVaultViewProps {
  organization: Organization;
  documents: TenderDocument[];
  proposals: GeneratedProposal[];
  tenders: TenderRecord[];
  onOpenTender: (tenderId: string, nav: NavSection) => void;
  onError: (msg: string) => void;
}

export function DocumentsVaultView({
  organization,
  documents,
  proposals,
  tenders,
  onOpenTender,
  onError,
}: DocumentsVaultViewProps) {
  const [previewDoc, setPreviewDoc] = useState<TenderDocument | null>(null);

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-xl p-6 flex items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-lg font-bold text-slate-900">
            Procurement Document &amp; Proposal Vault
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Central repository of indexed tender PDFs, RAG vector chunk counts, and exportable
            proposal drafts.
          </p>
        </div>
        <button
          type="button"
          onClick={() => onOpenTender(tenders[0]?.id || '', 'analyzer')}
          className="px-4 py-2 bg-[#1A73E8] text-white text-sm font-medium rounded-lg hover:bg-[#1557B0] whitespace-nowrap"
        >
          Upload New PDF
        </button>
      </div>

      {/* Uploaded Tender PDFs */}
      <div className="bg-white border border-[#DADCE0] rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-[#E8EAED] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FolderOpen className="w-4 h-4 text-[#1A73E8]" />
            <h3 className="font-display text-base font-semibold text-[#202124]">
              Indexed Tender PDFs
            </h3>
          </div>
          <span className="text-xs font-mono tabular-nums text-slate-500">
            {documents.length} files
          </span>
        </div>

        {documents.length === 0 ? (
          <div className="p-8 text-center text-sm text-slate-500">
            No tender PDFs uploaded yet. Upload a PDF in Document Analyzer to populate the vault.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {documents.map((docItem) => {
              const linkedTender = tenders.find((t) => t.id === docItem.tenderId);
              return (
                <div
                  key={docItem.id}
                  className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/70"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">
                      {docItem.fileName}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {linkedTender?.referenceNumber || 'Standalone'} ·{' '}
                      <span className="font-mono tabular-nums">
                        {docItem.pageCount} pages · {docItem.chunkCount} vector chunks
                      </span>
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() =>
                        setPreviewDoc(previewDoc?.id === docItem.id ? null : docItem)
                      }
                      className="px-3 py-1.5 text-xs font-medium border border-slate-300 rounded-lg hover:bg-slate-50"
                    >
                      {previewDoc?.id === docItem.id ? 'Hide Preview' : 'Text Preview'}
                    </button>
                    {docItem.tenderId && (
                      <button
                        type="button"
                        onClick={() => onOpenTender(docItem.tenderId!, 'analyzer')}
                        className="px-3 py-1.5 text-xs font-medium bg-[#1A73E8] text-white rounded-lg hover:bg-[#1557B0]"
                      >
                        Open Analysis
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {previewDoc && (
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-2">
          <h4 className="text-xs font-semibold text-slate-900">
            Extracted Text Preview — {previewDoc.fileName}
          </h4>
          <pre className="text-xs font-mono text-slate-700 whitespace-pre-wrap bg-slate-50 border border-slate-200 rounded-lg p-4 max-h-72 overflow-y-auto">
            {previewDoc.extractedPreview || 'No text preview stored.'}
          </pre>
        </div>
      )}

      {/* Generated Proposals */}
      <div className="bg-white border border-[#DADCE0] rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-[#E8EAED] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-[#1A73E8]" />
            <h3 className="font-display text-base font-semibold text-[#202124]">
              Written Proposal Drafts
            </h3>
          </div>
          <span className="text-xs font-mono tabular-nums text-[#5F6368]">
            {proposals.length} drafts
          </span>
        </div>

        {proposals.length === 0 ? (
          <div className="p-8 text-center text-sm text-[#5F6368]">
            No proposals generated yet. Open AI Bid Writer to draft your first proposal.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {proposals.map((prop) => {
              const linkedTender = tenders.find((t) => t.id === prop.tenderId);
              return (
                <div
                  key={prop.id}
                  className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-slate-50/70"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">{prop.title}</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {prop.templateType} · Version{' '}
                      <span className="font-mono">v{prop.currentVersion}</span> ·{' '}
                      {prop.sections.length} sections
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() =>
                        downloadProposalExport('docx', {
                          title: prop.title,
                          tenderTitle: linkedTender?.title || prop.title,
                          tenderReference: linkedTender?.referenceNumber || 'N/A',
                          authority: linkedTender?.authority || 'Issuing Authority',
                          organizationName: organization.name,
                          version: prop.currentVersion,
                          sections: prop.sections,
                        }).catch((e) => onError(e.message))
                      }
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg hover:bg-slate-50"
                    >
                      <Download className="w-3 h-3" />
                      DOCX
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        downloadProposalExport('pdf', {
                          title: prop.title,
                          tenderTitle: linkedTender?.title || prop.title,
                          tenderReference: linkedTender?.referenceNumber || 'N/A',
                          authority: linkedTender?.authority || 'Issuing Authority',
                          organizationName: organization.name,
                          version: prop.currentVersion,
                          sections: prop.sections,
                        }).catch((e) => onError(e.message))
                      }
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg hover:bg-slate-50"
                    >
                      <Download className="w-3 h-3" />
                      PDF
                    </button>
                    <button
                      type="button"
                      onClick={() => onOpenTender(prop.tenderId, 'coauthor')}
                      className="px-3 py-1.5 text-xs font-medium bg-[#1A73E8] text-white rounded-lg hover:bg-[#1557B0]"
                    >
                      Edit
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
