import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  CheckCircle2,
  Download,
  History,
  PenTool,
  RefreshCw,
  Save,
  ShieldCheck,
} from 'lucide-react';
import {
  downloadProposalExport,
  generateProposalWithAi,
  verifyProposalComplianceWithAi,
} from '../lib/apiClient.ts';
import {
  fetchDocumentChunks,
  logActivity,
  makeSafeId,
  saveProposalRecord,
  updateTenderRecord,
} from '../lib/firestoreStore.ts';
import type {
  GeneratedProposal,
  Organization,
  ProposalSection,
  TenderAnalysis,
  TenderRecord,
  UserProfile,
} from '../types/procurement.ts';
import { EASE_OUT_EXPO } from './NeonPrimitives.tsx';

const PROPOSAL_TEMPLATES = [
  'Technical Proposal (Complete)',
  'Executive Summary',
  'Company Capability Statement',
  'Project Implementation Plan',
  'Technical Compliance Matrix',
  'Tender Questionnaire Responses',
  'Cover Letter',
  'Methodology Document',
  'Supporting Documentation Checklist',
];

interface ProposalCoAuthorViewProps {
  organization: Organization;
  userProfile: UserProfile;
  tenders: TenderRecord[];
  analyses: TenderAnalysis[];
  proposals: GeneratedProposal[];
  selectedTenderId: string;
  onSelectTender: (id: string) => void;
  onNotify: (msg: string) => void;
  onError: (msg: string) => void;
}

export function ProposalCoAuthorView({
  organization,
  userProfile,
  tenders,
  analyses,
  proposals,
  selectedTenderId,
  onSelectTender,
  onNotify,
  onError,
}: ProposalCoAuthorViewProps) {
  const activeTender =
    tenders.find((t) => t.id === selectedTenderId) || tenders[0] || null;
  const existingProposal = activeTender
    ? proposals.find((p) => p.tenderId === activeTender.id) || null
    : null;
  const activeAnalysis = activeTender
    ? analyses.find((a) => a.tenderId === activeTender.id) || null
    : null;

  const [templateType, setTemplateType] = useState(PROPOSAL_TEMPLATES[0]);
  const [title, setTitle] = useState('');
  const [sections, setSections] = useState<ProposalSection[]>([]);
  const [complianceNotes, setComplianceNotes] = useState<string[]>([]);
  const [customInstructions, setCustomInstructions] = useState('');
  const [generating, setGenerating] = useState(false);
  const [regenSectionId, setRegenSectionId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [verificationResult, setVerificationResult] = useState<{
    overallReadiness: string;
    verificationNotes: string[];
    unresolvedPlaceholders: string[];
  } | null>(null);

  useEffect(() => {
    if (existingProposal) {
      setTitle(existingProposal.title);
      setTemplateType(existingProposal.templateType);
      setSections(existingProposal.sections || []);
      setComplianceNotes(existingProposal.complianceNotes || []);
    } else if (activeTender) {
      setTitle(`Technical Proposal — ${activeTender.referenceNumber}`);
      setSections([]);
      setComplianceNotes([]);
    }
    setVerificationResult(null);
  }, [existingProposal, activeTender]);

  const handleGenerateFull = async () => {
    if (!activeTender) return;
    setGenerating(true);
    try {
      const chunks = activeTender.documentId
        ? await fetchDocumentChunks(organization.id, activeTender.documentId, userProfile.uid)
        : [];

      const res = await generateProposalWithAi({
        tenderTitle: activeTender.title,
        tenderAuthority: activeTender.authority,
        tenderReference: activeTender.referenceNumber,
        templateType,
        tenderSummary: activeTender.summary || '',
        analysis: activeAnalysis ? (activeAnalysis as unknown as Record<string, unknown>) : null,
        chunks: chunks.map((c) => ({
          pageNumber: c.pageNumber,
          sectionType: c.sectionType,
          content: c.content,
          embedding: c.embedding,
        })),
        companyProfile: {
          name: organization.name,
          industry: organization.industry,
          businessCategory: organization.businessCategory,
          yearsInOperation: organization.yearsInOperation,
          annualTurnoverLakhs: organization.annualTurnoverLakhs,
          certifications: organization.certifications,
          capabilitiesSummary: organization.capabilitiesSummary,
          pastProjectsSummary: organization.pastProjectsSummary,
        },
        customInstructions,
      });

      setTitle(res.proposal.title || `Proposal — ${activeTender.referenceNumber}`);
      setSections(res.proposal.sections || []);
      setComplianceNotes(res.proposal.complianceNotes || []);

      await persistProposal(
        res.proposal.title || title,
        res.proposal.sections || [],
        res.proposal.complianceNotes || [],
        `Generated ${templateType}`,
      );
      onNotify('Proposal draft generated and saved to Firestore.');
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Proposal generation failed.');
    } finally {
      setGenerating(false);
    }
  };

  const handleRegenerateSection = async (section: ProposalSection) => {
    if (!activeTender) return;
    setRegenSectionId(section.id);
    try {
      const chunks = activeTender.documentId
        ? await fetchDocumentChunks(organization.id, activeTender.documentId, userProfile.uid)
        : [];

      const res = await generateProposalWithAi({
        tenderTitle: activeTender.title,
        tenderAuthority: activeTender.authority,
        tenderReference: activeTender.referenceNumber,
        templateType,
        targetSectionHeading: section.heading,
        tenderSummary: activeTender.summary || '',
        analysis: activeAnalysis ? (activeAnalysis as unknown as Record<string, unknown>) : null,
        chunks: chunks.map((c) => ({
          pageNumber: c.pageNumber,
          sectionType: c.sectionType,
          content: c.content,
          embedding: c.embedding,
        })),
        companyProfile: {
          name: organization.name,
          industry: organization.industry,
          certifications: organization.certifications,
          capabilitiesSummary: organization.capabilitiesSummary,
          pastProjectsSummary: organization.pastProjectsSummary,
        },
        customInstructions,
      });

      const regenerated = res.proposal.sections?.[0];
      if (regenerated) {
        setSections((prev) =>
          prev.map((s) =>
            s.id === section.id
              ? { ...s, content: regenerated.content, missingInputs: regenerated.missingInputs }
              : s,
          ),
        );
        onNotify(`Regenerated "${section.heading}".`);
      }
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Section regeneration failed.');
    } finally {
      setRegenSectionId(null);
    }
  };

  const persistProposal = async (
    propTitle: string,
    propSections: ProposalSection[],
    notes: string[],
    versionNote: string,
  ) => {
    if (!activeTender) return;
    const isUpdate = Boolean(existingProposal);
    const nextVersion = existingProposal ? existingProposal.currentVersion + 1 : 1;
    const snapshot = {
      versionNumber: nextVersion,
      savedAt: new Date().toISOString(),
      savedBy: userProfile.displayName,
      note: versionNote,
      sections: propSections,
    };

    const versions = existingProposal
      ? [snapshot, ...(existingProposal.versions || [])].slice(0, 15)
      : [snapshot];

    await saveProposalRecord(
      organization,
      {
        id: existingProposal ? existingProposal.id : makeSafeId('prp'),
        tenderId: activeTender.id,
        title: propTitle || `Proposal — ${activeTender.referenceNumber}`,
        templateType,
        currentVersion: nextVersion,
        sections: propSections,
        complianceNotes: notes,
        versions,
      },
      isUpdate,
    );

    if (activeTender.status === 'Discovered' || activeTender.status === 'Eligibility Checking') {
      await updateTenderRecord(organization.id, activeTender.id, {
        status: 'Bid Preparation',
      });
    }

    await logActivity(organization, {
      actorUid: userProfile.uid,
      actorName: userProfile.displayName,
      tenderId: activeTender.id,
      actionType: 'PROPOSAL_SAVED',
      description: `Saved proposal v${nextVersion} for ${activeTender.referenceNumber}.`,
    });
  };

  const handleSaveDraft = async () => {
    if (!activeTender || sections.length === 0) return;
    setSaving(true);
    try {
      await persistProposal(title, sections, complianceNotes, 'Manual draft edit saved');
      onNotify('New proposal version saved.');
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Failed to save draft.');
    } finally {
      setSaving(false);
    }
  };

  const handleVerifyCompliance = async () => {
    if (!activeTender || sections.length === 0) return;
    setVerifying(true);
    try {
      const res = await verifyProposalComplianceWithAi({
        tenderTitle: activeTender.title,
        sections: sections.map((s) => ({ heading: s.heading, content: s.content })),
        mandatoryRequirements:
          activeAnalysis?.mandatoryDocuments || activeAnalysis?.technicalSpecs || [],
      });
      setVerificationResult(res.verification);
      onNotify(`Compliance verification complete: ${res.verification.overallReadiness}.`);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Compliance check failed.');
    } finally {
      setVerifying(false);
    }
  };

  const handleExport = async (format: 'docx' | 'pdf') => {
    if (!activeTender || sections.length === 0) return;
    try {
      await downloadProposalExport(format, {
        title: title || activeTender.title,
        tenderTitle: activeTender.title,
        tenderReference: activeTender.referenceNumber,
        authority: activeTender.authority,
        organizationName: organization.name,
        version: existingProposal?.currentVersion || 1,
        sections: sections.map((s) => ({ heading: s.heading, content: s.content })),
      });
      onNotify(`Exported ${format.toUpperCase()} document.`);
    } catch (err) {
      onError(err instanceof Error ? err.message : `Failed to export ${format.toUpperCase()}.`);
    }
  };

  const restoreVersion = (versionNum: number) => {
    const found = existingProposal?.versions?.find((v) => v.versionNumber === versionNum);
    if (found) {
      setSections(found.sections);
      onNotify(`Loaded v${versionNum} into editor. Click Save Version to commit.`);
    }
  };

  return (
    <div className="space-y-6">
      {/* Studio Toolbar */}
      <div className="neon-surface rounded-2xl p-6 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-lg font-bold text-white">
              Bid Tender Writer — AI Proposal Writing Studio
            </h2>
            <p className="text-xs text-[#9AA0A6] mt-0.5">
              Grounded strictly in tender evidence and {organization.name}’s verified profile.
              Unverified items are flagged as [USER INPUT REQUIRED].
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={sections.length === 0 || verifying}
              onClick={handleVerifyCompliance}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium neon-btn-secondary rounded-lg disabled:opacity-50"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-[#4ADE80]" />
              {verifying ? 'Verifying...' : 'Verify Compliance'}
            </button>
            <button
              type="button"
              disabled={sections.length === 0 || saving}
              onClick={handleSaveDraft}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium neon-btn-secondary rounded-lg disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              {saving ? 'Saving...' : 'Save Version'}
            </button>
            <button
              type="button"
              disabled={sections.length === 0}
              onClick={() => handleExport('docx')}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-[#4285F4]/18 text-[#8AB4F8] border border-[#4285F4]/45 rounded-lg hover:bg-[#4285F4]/28 transition-colors disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5" />
              Export DOCX
            </button>
            <motion.button
              type="button"
              whileTap={{ scale: 0.97 }}
              disabled={sections.length === 0}
              onClick={() => handleExport('pdf')}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium neon-btn-primary rounded-lg disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5" />
              Export PDF
            </motion.button>
          </div>
        </div>

        <div className="grid lg:grid-cols-12 gap-3 pt-3 border-t border-white/[0.08]">
          <div className="lg:col-span-4">
            <label className="block text-[11px] font-medium text-[#9AA0A6] mb-1">
              Target Tender
            </label>
            <select
              value={activeTender?.id || ''}
              onChange={(e) => onSelectTender(e.target.value)}
              className="w-full px-3 py-2 text-sm neon-input rounded-xl"
            >
              {tenders.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.referenceNumber} — {t.title.slice(0, 42)}
                </option>
              ))}
            </select>
          </div>
          <div className="lg:col-span-3">
            <label className="block text-[11px] font-medium text-[#9AA0A6] mb-1">
              Document Type / Template
            </label>
            <select
              value={templateType}
              onChange={(e) => setTemplateType(e.target.value)}
              className="w-full px-3 py-2 text-sm neon-input rounded-xl"
            >
              {PROPOSAL_TEMPLATES.map((tpl) => (
                <option key={tpl} value={tpl}>
                  {tpl}
                </option>
              ))}
            </select>
          </div>
          <div className="lg:col-span-3">
            <label className="block text-[11px] font-medium text-[#9AA0A6] mb-1">
              Drafting Focus (Optional)
            </label>
            <input
              type="text"
              value={customInstructions}
              onChange={(e) => setCustomInstructions(e.target.value)}
              placeholder="e.g. Emphasize 99.5% SLA & local support"
              className="w-full px-3 py-2 text-sm neon-input rounded-xl"
            />
          </div>
          <div className="lg:col-span-2 flex items-end">
            <motion.button
              type="button"
              whileTap={{ scale: 0.97 }}
              disabled={!activeTender || generating}
              onClick={handleGenerateFull}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 neon-btn-primary text-sm font-medium rounded-xl disabled:opacity-60 whitespace-nowrap"
            >
              <PenTool className="w-4 h-4 text-white" />
              {generating ? 'Drafting...' : 'Generate Draft'}
            </motion.button>
          </div>
        </div>
      </div>

      {/* Compliance Verification Banner */}
      <AnimatePresence>
        {verificationResult && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2, ease: EASE_OUT_EXPO }}
            className="neon-surface rounded-2xl p-5 space-y-3 border-[#34A853]/35"
          >
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <CheckCircle2 className="w-4 h-4 text-[#4ADE80]" />
              Compliance Verification: {verificationResult.overallReadiness}
            </div>
            <div className="grid md:grid-cols-2 gap-4 text-xs">
              <div>
                <p className="font-semibold text-[#C4CBD6] mb-1">Verification Notes</p>
                <ul className="list-disc pl-4 space-y-1 text-[#9AA0A6]">
                  {verificationResult.verificationNotes.map((n, i) => (
                    <li key={i}>{n}</li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="font-semibold text-[#FCD34D] mb-1">Unresolved User Inputs</p>
                {verificationResult.unresolvedPlaceholders.length === 0 ? (
                  <p className="text-[#4ADE80]">No unresolved placeholders detected.</p>
                ) : (
                  <ul className="list-disc pl-4 space-y-1 text-[#FCD34D]">
                    {verificationResult.unresolvedPlaceholders.map((p, i) => (
                      <li key={i}>{p}</li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Editor + Version History Split */}
      {sections.length === 0 ? (
        <div className="neon-surface rounded-2xl p-12 text-center space-y-2">
          <PenTool className="w-8 h-8 text-[#669DF6] mx-auto" />
          <h3 className="font-display text-base font-semibold text-white">
            Ready to Write Proposal
          </h3>
          <p className="text-sm text-[#9AA0A6] max-w-md mx-auto">
            Choose a tender and proposal document type above, then click “Generate Draft” to build
            editable, tender-grounded sections ready for DOCX and PDF export.
          </p>
        </div>
      ) : (
        <div className="grid lg:grid-cols-12 gap-6">
          <div className="lg:col-span-9 space-y-4">
            <div className="neon-surface rounded-2xl p-5">
              <label className="block text-xs font-medium text-[#9AA0A6] mb-1.5">
                Proposal Title
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full font-display text-lg font-bold text-white px-3.5 py-2 neon-input rounded-xl"
              />
            </div>

            {sections.map((section) => (
              <div key={section.id} className="neon-surface rounded-2xl p-5 space-y-3">
                <div className="flex items-center justify-between gap-3">
                  <input
                    type="text"
                    value={section.heading}
                    onChange={(e) =>
                      setSections((prev) =>
                        prev.map((s) =>
                          s.id === section.id ? { ...s, heading: e.target.value } : s,
                        ),
                      )
                    }
                    className="font-display text-base font-semibold text-white bg-transparent flex-1 px-2 py-1 border border-transparent hover:border-white/15 focus:border-[#4285F4] rounded-lg focus:outline-none"
                  />
                  <button
                    type="button"
                    disabled={regenSectionId === section.id}
                    onClick={() => handleRegenerateSection(section)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium neon-btn-secondary rounded-lg shrink-0 disabled:opacity-60"
                  >
                    <RefreshCw
                      className={`w-3.5 h-3.5 ${regenSectionId === section.id ? 'animate-spin' : ''}`}
                    />
                    Regenerate Section
                  </button>
                </div>

                <textarea
                  rows={8}
                  value={section.content}
                  onChange={(e) =>
                    setSections((prev) =>
                      prev.map((s) =>
                        s.id === section.id ? { ...s, content: e.target.value } : s,
                      ),
                    )
                  }
                  className="w-full p-3.5 text-sm leading-relaxed neon-input rounded-xl"
                />

                {section.missingInputs && section.missingInputs.length > 0 && (
                  <div className="p-3 rounded-xl bg-[#FBBC04]/12 border border-[#FBBC04]/35 text-xs text-[#FCD34D]">
                    <span className="font-semibold">Inputs Required from Bidder: </span>
                    {section.missingInputs.join(' · ')}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="lg:col-span-3 space-y-4">
            <div className="neon-surface rounded-2xl p-5 space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-white">
                <History className="w-4 h-4 text-[#8AB4F8]" />
                Version History
              </div>
              {!existingProposal?.versions?.length ? (
                <p className="text-xs text-[#7B8499]">No saved versions yet.</p>
              ) : (
                <div className="space-y-2">
                  {existingProposal.versions.map((v) => (
                    <div
                      key={v.versionNumber}
                      className="p-3 rounded-xl bg-white/[0.025] border border-white/[0.08] text-xs space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-semibold text-white">
                          Version {v.versionNumber}
                        </span>
                        <button
                          type="button"
                          onClick={() => restoreVersion(v.versionNumber)}
                          className="text-[#8AB4F8] hover:underline font-medium"
                        >
                          Load
                        </button>
                      </div>
                      <p className="text-[#A7B0C0]">{v.note}</p>
                      <p className="text-[11px] text-[#7B8499]">
                        {v.savedBy} · {v.savedAt.slice(0, 10)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {complianceNotes.length > 0 && (
              <div className="neon-surface rounded-2xl p-5 space-y-2">
                <h4 className="text-xs font-semibold text-white">AI Drafting Notes</h4>
                <ul className="list-disc pl-4 space-y-1.5 text-xs text-[#A7B0C0]">
                  {complianceNotes.map((n, i) => (
                    <li key={i}>{n}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
