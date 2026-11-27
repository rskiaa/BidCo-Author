import React, { useEffect, useState } from 'react';
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

      // Persist immediately as v1 or next version
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
        mandatoryRequirements: activeAnalysis?.mandatoryDocuments || activeAnalysis?.technicalSpecs || [],
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
      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-lg font-bold text-[#202124]">
              Bid Tender Writer — AI Proposal Writing Studio
            </h2>
            <p className="text-xs text-[#5F6368] mt-0.5">
              Grounded strictly in tender evidence and {organization.name}’s verified profile.
              Unverified items are flagged as [USER INPUT REQUIRED].
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={sections.length === 0 || verifying}
              onClick={handleVerifyCompliance}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium border border-[#DADCE0] rounded-lg hover:bg-[#F1F3F4] text-[#3C4043] disabled:opacity-50"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-[#1A73E8]" />
              {verifying ? 'Verifying...' : 'Verify Compliance'}
            </button>
            <button
              type="button"
              disabled={sections.length === 0 || saving}
              onClick={handleSaveDraft}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium border border-[#DADCE0] rounded-lg hover:bg-[#F1F3F4] text-[#3C4043] disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              {saving ? 'Saving...' : 'Save Version'}
            </button>
            <button
              type="button"
              disabled={sections.length === 0}
              onClick={() => handleExport('docx')}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-[#E8F0FE] text-[#1967D2] border border-[#D2E3FC] rounded-lg hover:bg-[#D2E3FC]/70 disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5" />
              Export DOCX
            </button>
            <button
              type="button"
              disabled={sections.length === 0}
              onClick={() => handleExport('pdf')}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-[#1A73E8] text-white rounded-lg hover:bg-[#1557B0] disabled:opacity-50"
            >
              <Download className="w-3.5 h-3.5" />
              Export PDF
            </button>
          </div>
        </div>

        <div className="grid lg:grid-cols-12 gap-3 pt-2 border-t border-slate-100">
          <div className="lg:col-span-4">
            <label className="block text-[11px] font-medium text-slate-500 mb-1">
              Target Tender
            </label>
            <select
              value={activeTender?.id || ''}
              onChange={(e) => onSelectTender(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
            >
              {tenders.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.referenceNumber} — {t.title.slice(0, 42)}
                </option>
              ))}
            </select>
          </div>
          <div className="lg:col-span-3">
            <label className="block text-[11px] font-medium text-slate-500 mb-1">
              Document Type / Template
            </label>
            <select
              value={templateType}
              onChange={(e) => setTemplateType(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
            >
              {PROPOSAL_TEMPLATES.map((tpl) => (
                <option key={tpl} value={tpl}>
                  {tpl}
                </option>
              ))}
            </select>
          </div>
          <div className="lg:col-span-3">
            <label className="block text-[11px] font-medium text-slate-500 mb-1">
              Drafting Focus (Optional)
            </label>
            <input
              type="text"
              value={customInstructions}
              onChange={(e) => setCustomInstructions(e.target.value)}
              placeholder="e.g. Emphasize 99.5% SLA & local support"
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
            />
          </div>
          <div className="lg:col-span-2 flex items-end">
            <button
              type="button"
              disabled={!activeTender || generating}
              onClick={handleGenerateFull}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 bg-[#1A73E8] text-white text-sm font-medium rounded-lg hover:bg-[#1557B0] disabled:opacity-60 whitespace-nowrap"
            >
              <PenTool className="w-4 h-4 text-white" />
              {generating ? 'Drafting...' : 'Generate Draft'}
            </button>
          </div>
        </div>
      </div>

      {/* Compliance Verification Banner */}
      {verificationResult && (
        <div className="bg-white border border-[#DADCE0] rounded-xl p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-semibold text-[#202124]">
              <CheckCircle2 className="w-4 h-4 text-[#1E8E3E]" />
              Compliance Verification: {verificationResult.overallReadiness}
            </div>
          </div>
          <div className="grid md:grid-cols-2 gap-4 text-xs">
            <div>
              <p className="font-semibold text-[#3C4043] mb-1">Verification Notes</p>
              <ul className="list-disc pl-4 space-y-1 text-[#5F6368]">
                {verificationResult.verificationNotes.map((n, i) => (
                  <li key={i}>{n}</li>
                ))}
              </ul>
            </div>
            <div>
              <p className="font-semibold text-[#B06000] mb-1">Unresolved User Inputs</p>
              {verificationResult.unresolvedPlaceholders.length === 0 ? (
                <p className="text-[#1E8E3E]">No unresolved placeholders detected.</p>
              ) : (
                <ul className="list-disc pl-4 space-y-1 text-[#B06000]">
                  {verificationResult.unresolvedPlaceholders.map((p, i) => (
                    <li key={i}>{p}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Editor + Version History Split */}
      {sections.length === 0 ? (
        <div className="bg-white border border-[#DADCE0] rounded-xl p-12 text-center space-y-2">
          <PenTool className="w-8 h-8 text-[#5F6368] mx-auto" />
          <h3 className="font-display text-base font-semibold text-[#202124]">
            Ready to Write Proposal
          </h3>
          <p className="text-sm text-slate-500 max-w-md mx-auto">
            Choose a tender and proposal document type above, then click “Generate Draft” to build
            editable, tender-grounded sections ready for DOCX and PDF export.
          </p>
        </div>
      ) : (
        <div className="grid lg:grid-cols-12 gap-6">
          <div className="lg:col-span-9 space-y-4">
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <label className="block text-xs font-medium text-slate-500 mb-1">
                Proposal Title
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full font-display text-lg font-bold text-slate-900 px-3 py-2 border border-slate-200 rounded-lg"
              />
            </div>

            {sections.map((section) => (
              <div
                key={section.id}
                className="bg-white border border-slate-200 rounded-xl p-5 space-y-3"
              >
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
                    className="font-display text-base font-semibold text-[#202124] flex-1 px-2 py-1 border border-transparent hover:border-[#DADCE0] focus:border-[#1A73E8] rounded focus:outline-none"
                  />
                  <button
                    type="button"
                    disabled={regenSectionId === section.id}
                    onClick={() => handleRegenerateSection(section)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-[#DADCE0] rounded-lg hover:bg-[#F1F3F4] shrink-0 disabled:opacity-60"
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
                  className="w-full p-3.5 text-sm text-[#202124] leading-relaxed border border-[#DADCE0] rounded-lg focus:outline-none focus:border-[#1A73E8]"
                />

                {section.missingInputs && section.missingInputs.length > 0 && (
                  <div className="p-3 rounded-lg bg-[#FEF7E0] border border-[#FDE293] text-xs text-[#B06000]">
                    <span className="font-semibold">Inputs Required from Bidder: </span>
                    {section.missingInputs.join(' · ')}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="lg:col-span-3 space-y-4">
            <div className="bg-white border border-[#DADCE0] rounded-xl p-5 space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-[#202124]">
                <History className="w-4 h-4 text-[#1A73E8]" />
                Version History
              </div>
              {!existingProposal?.versions?.length ? (
                <p className="text-xs text-[#5F6368]">No saved versions yet.</p>
              ) : (
                <div className="space-y-2">
                  {existingProposal.versions.map((v) => (
                    <div
                      key={v.versionNumber}
                      className="p-3 rounded-lg border border-[#DADCE0] text-xs space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-semibold text-[#202124]">
                          Version {v.versionNumber}
                        </span>
                        <button
                          type="button"
                          onClick={() => restoreVersion(v.versionNumber)}
                          className="text-[#1A73E8] hover:underline font-medium"
                        >
                          Load
                        </button>
                      </div>
                      <p className="text-slate-600">{v.note}</p>
                      <p className="text-[11px] text-slate-400">
                        {v.savedBy} · {v.savedAt.slice(0, 10)}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {complianceNotes.length > 0 && (
              <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-2">
                <h4 className="text-xs font-semibold text-slate-900">AI Drafting Notes</h4>
                <ul className="list-disc pl-4 space-y-1.5 text-xs text-slate-600">
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
