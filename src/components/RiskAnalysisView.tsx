import React, { useState } from 'react';
import { ShieldAlert, Sparkles } from 'lucide-react';
import { analyzeRisksWithAi } from '../lib/apiClient.ts';
import { fetchDocumentChunks, logActivity, makeSafeId, saveRiskReport } from '../lib/firestoreStore.ts';
import type {
  Organization,
  RiskReport,
  RiskSeverity,
  TenderAnalysis,
  TenderRecord,
  UserProfile,
} from '../types/procurement.ts';

interface RiskAnalysisViewProps {
  organization: Organization;
  userProfile: UserProfile;
  tenders: TenderRecord[];
  analyses: TenderAnalysis[];
  risks: RiskReport[];
  selectedTenderId: string;
  onSelectTender: (id: string) => void;
  onNotify: (msg: string) => void;
  onError: (msg: string) => void;
}

export function RiskAnalysisView({
  organization,
  userProfile,
  tenders,
  analyses,
  risks,
  selectedTenderId,
  onSelectTender,
  onNotify,
  onError,
}: RiskAnalysisViewProps) {
  const [running, setRunning] = useState(false);
  const [severityFilter, setSeverityFilter] = useState<'All' | RiskSeverity>('All');

  const activeTender =
    tenders.find((t) => t.id === selectedTenderId) || tenders[0] || null;
  const activeAnalysis = activeTender
    ? analyses.find((a) => a.tenderId === activeTender.id) || null
    : null;
  const activeRiskReport = activeTender
    ? risks.find((r) => r.tenderId === activeTender.id) || null
    : null;

  const handleRunRiskScan = async () => {
    if (!activeTender) return;
    setRunning(true);
    try {
      const chunks = activeTender.documentId
        ? await fetchDocumentChunks(organization.id, activeTender.documentId, userProfile.uid)
        : [];

      const res = await analyzeRisksWithAi({
        tenderTitle: activeTender.title,
        tenderSummary: activeTender.summary || '',
        analysis: activeAnalysis ? (activeAnalysis as unknown as Record<string, unknown>) : null,
        chunks: chunks.map((c) => ({
          pageNumber: c.pageNumber,
          sectionType: c.sectionType,
          content: c.content,
          embedding: c.embedding,
        })),
      });

      const report = res.riskReport as unknown as Omit<
        RiskReport,
        'id' | 'orgId' | 'ownerId' | 'memberUids' | 'tenderId' | 'createdAt' | 'updatedAt'
      >;

      await saveRiskReport(organization, {
        id: makeSafeId('rsk'),
        tenderId: activeTender.id,
        ...report,
      });

      await logActivity(organization, {
        actorUid: userProfile.uid,
        actorName: userProfile.displayName,
        tenderId: activeTender.id,
        actionType: 'RISK_AUDIT_COMPLETED',
        description: `Completed risk assessment for ${activeTender.referenceNumber} (${report.overallRiskLevel} overall risk).`,
      });

      onNotify(`Risk report generated (${report.overallRiskLevel}).`);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Risk analysis failed.');
    } finally {
      setRunning(false);
    }
  };

  const filteredRisks = (activeRiskReport?.risks || []).filter((r) =>
    severityFilter === 'All' ? true : r.severity === severityFilter,
  );

  const severityCounts = (['Critical', 'High', 'Medium', 'Low'] as const).map((lvl) => ({
    level: lvl,
    count: (activeRiskReport?.risks || []).filter((r) => r.severity === lvl).length,
  }));

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-lg font-bold text-slate-900">
            Contract &amp; Commercial Risk Intelligence
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Detects liquidated damages traps, payment term holds, strict eligibility gates, and
            timeline exposure with clause citations.
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
                {t.referenceNumber} — {t.title.slice(0, 40)}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={!activeTender || running}
            onClick={handleRunRiskScan}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#1A73E8] text-white text-sm font-medium rounded-lg hover:bg-[#1557B0] disabled:opacity-60 whitespace-nowrap"
          >
            <Sparkles className="w-4 h-4 text-white" />
            {running ? 'Scanning Clauses...' : 'Run Risk Audit'}
          </button>
        </div>
      </div>

      {!activeRiskReport ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center space-y-2">
          <ShieldAlert className="w-8 h-8 text-slate-400 mx-auto" />
          <h3 className="font-display text-base font-semibold text-slate-900">
            No Risk Audit Generated Yet
          </h3>
          <p className="text-sm text-slate-500 max-w-md mx-auto">
            Click “Run Risk Audit” to classify contractual, financial, and delivery risks across
            Low, Medium, High, and Critical levels.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs text-slate-500">Overall Tender Risk Exposure</p>
                <h3 className="font-display text-xl font-bold text-slate-900 mt-0.5">
                  {activeRiskReport.overallRiskLevel} Risk Profile
                </h3>
              </div>

              <div className="flex flex-wrap gap-1 p-1 bg-slate-100 rounded-lg">
                {(['All', 'Critical', 'High', 'Medium', 'Low'] as const).map((lvl) => (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() => setSeverityFilter(lvl)}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                      severityFilter === lvl
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {lvl}
                  </button>
                ))}
              </div>
            </div>

            <p className="text-sm text-slate-700 leading-relaxed">
              {activeRiskReport.executiveSummary}
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-slate-100">
              {severityCounts.map((s) => (
                <div key={s.level} className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                  <p className="text-xs text-slate-500">{s.level}</p>
                  <p className="font-mono tabular-nums text-xl font-bold text-slate-900 mt-0.5">
                    {s.count}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            {filteredRisks.map((risk) => (
              <div
                key={risk.id}
                className="bg-white border border-slate-200 rounded-xl p-5 space-y-2.5"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2">
                    <span
                      className={`font-semibold ${
                        risk.severity === 'Critical' || risk.severity === 'High'
                          ? 'text-[#D93025]'
                          : risk.severity === 'Medium'
                            ? 'text-[#B06000]'
                            : 'text-[#1E8E3E]'
                      }`}
                    >
                      {risk.severity} Severity
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="text-[#5F6368]">{risk.category}</span>
                  </div>
                  <span className="font-mono text-[#1A73E8] font-medium">{risk.sourcePage}</span>
                </div>

                <h4 className="font-display text-base font-semibold text-[#202124]">
                  {risk.title}
                </h4>
                <p className="text-sm text-[#3C4043] leading-relaxed">{risk.description}</p>

                <div className="grid md:grid-cols-2 gap-4 pt-2 border-t border-[#E8EAED] text-xs">
                  <div>
                    <span className="font-semibold text-[#202124]">Source Clause Evidence: </span>
                    <span className="text-[#5F6368]">“{risk.evidenceQuote}”</span>
                  </div>
                  <div>
                    <span className="font-semibold text-[#1967D2]">Recommended Mitigation: </span>
                    <span className="text-[#3C4043]">{risk.mitigation}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
