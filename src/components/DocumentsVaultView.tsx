import React, { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Download, FileText, FolderOpen } from 'lucide-react';
import { downloadProposalExport } from '../lib/apiClient.ts';
import type {
  GeneratedProposal,
  Organization,
  TenderDocument,
  TenderRecord,
} from '../types/procurement.ts';
import type { NavSection } from './SidebarLayout.tsx';
import { EASE_OUT_EXPO } from './NeonPrimitives.tsx';

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
      <div className="neon-surface rounded-2xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-lg font-bold text-white">
            Procurement Document &amp; Proposal Vault
          </h2>
          <p className="text-xs text-[#9AA0A6] mt-0.5">
            Central repository of indexed tender PDFs, RAG vector chunk counts, and exportable
            proposal drafts.
          </p>
        </div>
        <motion.button
          type="button"
          whileTap={{ scale: 0.97 }}
          onClick={() => onOpenTender(tenders[0]?.id || '', 'analyzer')}
          className="px-4 py-2.5 neon-btn-primary text-sm font-medium rounded-xl whitespace-nowrap shrink-0"
        >
          Upload New PDF
        </motion.button>
      </div>

      {/* Uploaded Tender PDFs */}
      <div className="neon-surface rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-white/[0.08] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FolderOpen className="w-4 h-4 text-[#8AB4F8]" />
            <h3 className="font-display text-base font-semibold text-white">
              Indexed Tender PDFs
            </h3>
          </div>
          <span className="text-xs font-mono tabular-nums text-[#8AB4F8]">
            {documents.length} files
          </span>
        </div>

        {documents.length === 0 ? (
          <div className="p-8 text-center text-sm text-[#7B8499]">
            No tender PDFs uploaded yet. Upload a PDF in Document Analyzer to populate the vault.
          </div>
        ) : (
          <div className="divide-y divide-white/[0.06]">
            {documents.map((docItem) => {
              const linkedTender = tenders.find((t) => t.id === docItem.tenderId);
              return (
                <div
                  key={docItem.id}
                  className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-white/[0.03] transition-colors"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-white truncate">{docItem.fileName}</p>
                    <p className="text-xs text-[#9AA0A6] mt-0.5">
                      {linkedTender?.referenceNumber || 'Standalone'} ·{' '}
                      <span className="font-mono tabular-nums text-[#8AB4F8]">
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
                      className="px-3 py-1.5 text-xs font-medium neon-btn-secondary rounded-lg"
                    >
                      {previewDoc?.id === docItem.id ? 'Hide Preview' : 'Text Preview'}
                    </button>
                    {docItem.tenderId && (
                      <button
                        type="button"
                        onClick={() => onOpenTender(docItem.tenderId!, 'analyzer')}
                        className="px-3 py-1.5 text-xs font-medium neon-btn-primary rounded-lg"
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

      <AnimatePresence>
        {previewDoc && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2, ease: EASE_OUT_EXPO }}
            className="neon-surface rounded-2xl p-6 space-y-2.5"
          >
            <h4 className="text-xs font-semibold text-[#8AB4F8]">
              Extracted Text Preview — {previewDoc.fileName}
            </h4>
            <pre className="text-xs font-mono text-[#D2D8E2] whitespace-pre-wrap bg-[#0A0D14] border border-white/[0.08] rounded-xl p-4 max-h-72 overflow-y-auto">
              {previewDoc.extractedPreview || 'No text preview stored.'}
            </pre>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Generated Proposals */}
      <div className="neon-surface rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-white/[0.08] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-[#4ADE80]" />
            <h3 className="font-display text-base font-semibold text-white">
              Written Proposal Drafts
            </h3>
          </div>
          <span className="text-xs font-mono tabular-nums text-[#4ADE80]">
            {proposals.length} drafts
          </span>
        </div>

        {proposals.length === 0 ? (
          <div className="p-8 text-center text-sm text-[#7B8499]">
            No proposals generated yet. Open AI Bid Writer to draft your first proposal.
          </div>
        ) : (
          <div className="divide-y divide-white/[0.06]">
            {proposals.map((prop) => {
              const linkedTender = tenders.find((t) => t.id === prop.tenderId);
              return (
                <div
                  key={prop.id}
                  className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-white/[0.03] transition-colors"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-white truncate">{prop.title}</p>
                    <p className="text-xs text-[#9AA0A6] mt-0.5">
                      {prop.templateType} · Version{' '}
                      <span className="font-mono text-[#8AB4F8]">v{prop.currentVersion}</span> ·{' '}
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
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs neon-btn-secondary rounded-lg"
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
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs neon-btn-secondary rounded-lg"
                    >
                      <Download className="w-3 h-3" />
                      PDF
                    </button>
                    <button
                      type="button"
                      onClick={() => onOpenTender(prop.tenderId, 'coauthor')}
                      className="px-3 py-1.5 text-xs font-medium neon-btn-primary rounded-lg"
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
