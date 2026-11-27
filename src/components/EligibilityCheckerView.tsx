import React, { useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  CheckSquare,
  HelpCircle,
  Play,
  XCircle,
} from 'lucide-react';
import { checkEligibilityWithAi } from '../lib/apiClient.ts';
import {
  fetchDocumentChunks,
  logActivity,
  makeSafeId,
  saveEligibilityAssessment,
  updateTenderRecord,
} from '../lib/firestoreStore.ts';
import type {
  EligibilityAssessment,
  Organization,
  TenderAnalysis,
  TenderRecord,
  UserProfile,
} from '../types/procurement.ts';

interface EligibilityCheckerViewProps {
  organization: Organization;
  userProfile: UserProfile;
  tenders: TenderRecord[];
  analyses: TenderAnalysis[];
  eligibilities: EligibilityAssessment[];
  selectedTenderId: string;
  onSelectTender: (id: string) => void;
  onNotify: (msg: string) => void;
  onError: (msg: string) => void;
}

export function EligibilityCheckerView({
  organization,
  userProfile,
  tenders,
  analyses,
  eligibilities,
  selectedTenderId,
  onSelectTender,
  onNotify,
  onError,
}: EligibilityCheckerViewProps) {
  const [running, setRunning] = useState(false);

  const activeTender =
    tenders.find((t) => t.id === selectedTenderId) || tenders[0] || null;
  const activeAnalysis = activeTender
    ? analyses.find((a) => a.tenderId === activeTender.id) || null
    : null;
  const activeReport = activeTender
    ? eligibilities.find((e) => e.tenderId === activeTender.id) || null
    : null;

  const handleRunEligibility = async () => {
    if (!activeTender) return;
    setRunning(true);
    try {
      const chunks = activeTender.documentId
        ? await fetchDocumentChunks(organization.id, activeTender.documentId, userProfile.uid)
        : [];

      const res = await checkEligibilityWithAi({
        tenderTitle: activeTender.title,
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
          netWorthLakhs: organization.netWorthLakhs,
          employeeCount: organization.employeeCount,
          certifications: organization.certifications,
          capabilitiesSummary: organization.capabilitiesSummary,
          pastProjectsSummary: organization.pastProjectsSummary,
          gstin: organization.gstin,
          udyamNumber: organization.udyamNumber,
        },
      });

      const report = res.eligibility as unknown as Omit<
        EligibilityAssessment,
        'id' | 'orgId' | 'ownerId' | 'memberUids' | 'tenderId' | 'createdAt' | 'updatedAt'
      >;

      await saveEligibilityAssessment(organization, {
        id: makeSafeId('elg'),
        tenderId: activeTender.id,
        ...report,
      });

      await updateTenderRecord(organization.id, activeTender.id, {
        eligibilityStatus: report.overallStatus,
        status:
          activeTender.status === 'Discovered' || activeTender.status === 'Under Review'
            ? 'Eligibility Checking'
            : activeTender.status,
      });

      await logActivity(organization, {
        actorUid: userProfile.uid,
        actorName: userProfile.displayName,
        tenderId: activeTender.id,
        actionType: 'ELIGIBILITY_EVALUATED',
        description: `Evaluated eligibility for ${activeTender.referenceNumber}: ${report.overallStatus}.`,
      });

      onNotify(`Eligibility assessment saved: ${report.overallStatus}.`);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Eligibility evaluation failed.');
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Control Header */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex-1 min-w-0">
          <h2 className="font-display text-lg font-bold text-slate-900">
            Evidence-Based Eligibility &amp; Compliance Checker
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Compares tender clauses against {organization.name}’s verified financial turnover,
            certifications, and credentials without arbitrary percentage scores.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <select
            value={activeTender?.id || ''}
            onChange={(e) => onSelectTender(e.target.value)}
            className="px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white max-w-xs"
          >
            {tenders.map((t) => (
              <option key={t.id} value={t.id}>
                {t.referenceNumber} — {t.title.slice(0, 42)}
              </option>
            ))}
          </select>

          <button
            type="button"
            disabled={!activeTender || running}
            onClick={handleRunEligibility}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#1A73E8] text-white text-sm font-medium rounded-lg hover:bg-[#1557B0] disabled:opacity-60 whitespace-nowrap"
          >
            <Play className="w-4 h-4 text-white" />
            {running ? 'Evaluating...' : 'Run Eligibility Check'}
          </button>
        </div>
      </div>

      {/* Company Context Snapshot */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 grid sm:grid-cols-4 gap-4 text-xs">
        <div>
          <p className="text-slate-500">Registered Company</p>
          <p className="font-semibold text-slate-900 mt-0.5">{organization.name}</p>
        </div>
        <div>
          <p className="text-slate-500">Avg Annual Turnover</p>
          <p className="font-mono tabular-nums font-semibold text-slate-900 mt-0.5">
            INR {organization.annualTurnoverLakhs ?? 0} Lakhs
          </p>
        </div>
        <div>
          <p className="text-slate-500">Experience / Age</p>
          <p className="font-mono tabular-nums font-semibold text-slate-900 mt-0.5">
            {organization.yearsInOperation ?? 0} Years
          </p>
        </div>
        <div>
          <p className="text-slate-500">Certifications on File</p>
          <p className="font-medium text-slate-900 mt-0.5 truncate">
            {(organization.certifications || []).join(', ') || 'None specified'}
          </p>
        </div>
      </div>

      {!activeReport ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center space-y-2">
          <CheckSquare className="w-8 h-8 text-slate-400 mx-auto" />
          <h3 className="font-display text-base font-semibold text-slate-900">
            No Eligibility Assessment Run Yet
          </h3>
          <p className="text-sm text-slate-500 max-w-md mx-auto">
            Click “Run Eligibility Check” above to generate a clause-by-clause compliance table and
            missing document checklist.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Determination Banner */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                {activeReport.overallStatus === 'Eligible' && (
                  <CheckCircle2 className="w-5 h-5 text-[#1E8E3E]" />
                )}
                {activeReport.overallStatus === 'Potentially Eligible' && (
                  <AlertCircle className="w-5 h-5 text-[#F9AB00]" />
                )}
                {activeReport.overallStatus === 'Ineligible' && (
                  <XCircle className="w-5 h-5 text-[#D93025]" />
                )}
                {activeReport.overallStatus === 'Insufficient Information' && (
                  <HelpCircle className="w-5 h-5 text-[#5F6368]" />
                )}
                <h3 className="font-display text-lg font-bold text-[#202124]">
                  Determination: {activeReport.overallStatus}
                </h3>
              </div>
              <span className="text-xs text-slate-500">
                Legal verification rests on documentary proof
              </span>
            </div>

            <p className="text-sm text-slate-700 leading-relaxed">{activeReport.summary}</p>

            <div className="grid md:grid-cols-3 gap-4 pt-4 border-t border-slate-200 text-xs">
              <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200">
                <p className="font-semibold text-slate-900 mb-1">Financial Eligibility</p>
                <p className="text-slate-600 leading-relaxed">
                  {activeReport.financialAssessment}
                </p>
              </div>
              <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200">
                <p className="font-semibold text-slate-900 mb-1">Experience Requirements</p>
                <p className="text-slate-600 leading-relaxed">
                  {activeReport.experienceAssessment}
                </p>
              </div>
              <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200">
                <p className="font-semibold text-slate-900 mb-1">Certifications &amp; Statutory</p>
                <p className="text-slate-600 leading-relaxed">
                  {activeReport.certificationAssessment}
                </p>
              </div>
            </div>
          </div>

          {/* Requirement-by-Requirement Table */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200">
              <h3 className="font-display text-base font-semibold text-slate-900">
                Requirement-by-Requirement Comparison
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="px-5 py-3 font-medium">Tender Requirement</th>
                    <th className="px-5 py-3 font-medium">Company Evidence</th>
                    <th className="px-5 py-3 font-medium">Status</th>
                    <th className="px-5 py-3 font-medium">Citation</th>
                    <th className="px-5 py-3 font-medium">Remediation</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(activeReport.comparisons || []).map((row, idx) => (
                    <tr key={idx} className="align-top hover:bg-slate-50/70">
                      <td className="px-5 py-3.5 text-slate-900 font-medium max-w-xs">
                        <p>{row.requirement}</p>
                        <p className="text-[11px] text-slate-400 mt-0.5">{row.category}</p>
                      </td>
                      <td className="px-5 py-3.5 text-slate-700 max-w-xs">
                        {row.companyEvidence}
                      </td>
                      <td className="px-5 py-3.5 font-semibold whitespace-nowrap">
                        <span
                          className={
                            row.status === 'Met'
                              ? 'text-[#1E8E3E]'
                              : row.status === 'Partial'
                                ? 'text-[#B06000]'
                                : row.status === 'Not Met'
                                  ? 'text-[#D93025]'
                                  : 'text-[#5F6368]'
                          }
                        >
                          {row.status}
                        </span>
                      </td>
                      <td className="px-5 py-3.5 text-[#5F6368] max-w-xs">
                        <span className="font-mono text-[#1A73E8]">{row.sourcePage}</span>
                        <p className="mt-0.5 line-clamp-2">“{row.evidenceQuote}”</p>
                      </td>
                      <td className="px-5 py-3.5 text-[#5F6368] max-w-xs">
                        {row.remediationNote}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Missing Docs, Gaps & Disqualification */}
          <div className="grid md:grid-cols-3 gap-6">
            <div className="bg-white border border-[#DADCE0] rounded-xl p-5">
              <h4 className="text-sm font-semibold text-[#202124] mb-3">
                Missing Document Checklist
              </h4>
              <ul className="space-y-2 text-xs text-[#3C4043] list-disc pl-4">
                {(activeReport.missingDocuments || []).map((d, i) => (
                  <li key={i}>{d}</li>
                ))}
              </ul>
            </div>
            <div className="bg-white border border-[#DADCE0] rounded-xl p-5">
              <h4 className="text-sm font-semibold text-[#202124] mb-3">Compliance Gaps</h4>
              <ul className="space-y-2 text-xs text-[#3C4043] list-disc pl-4">
                {(activeReport.complianceGaps || []).map((g, i) => (
                  <li key={i}>{g}</li>
                ))}
              </ul>
            </div>
            <div className="bg-white border border-[#DADCE0] rounded-xl p-5">
              <h4 className="text-sm font-semibold text-[#D93025] mb-3">
                Potential Disqualification Risks
              </h4>
              <ul className="space-y-2 text-xs text-[#3C4043] list-disc pl-4">
                {(activeReport.disqualificationRisks || []).map((r, i) => (
                  <li key={i}>{r}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
