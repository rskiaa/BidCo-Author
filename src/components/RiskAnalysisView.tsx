import React, { useState } from 'react';
import { motion } from 'motion/react';
import { ShieldAlert, Sparkles } from 'lucide-react';
import { analyzeRisksWithAi } from '../lib/apiClient.ts';
import {
  fetchDocumentChunks,
  logActivity,
  makeSafeId,
  saveRiskReport,
} from '../lib/firestoreStore.ts';
import type {
  Organization,
  RiskReport,
  RiskSeverity,
  TenderAnalysis,
  TenderRecord,
  UserProfile,
} from '../types/procurement.ts';
import { SPRING_SNAPPY } from './NeonPrimitives.tsx';

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

const SEVERITY_ACCENTS: Record<string, string> = {
  Critical: '#EA4335',
  High: '#F87171',
  Medium: '#FBBC04',
  Low: '#34A853',
};

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
      <div className="neon-surface rounded-2xl p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-lg font-bold text-white">
            Contract &amp; Commercial Risk Intelligence
          </h2>
          <p className="text-xs text-[#9AA0A6] mt-0.5">
            Detects liquidated damages traps, payment term holds, strict eligibility gates, and
            timeline exposure with clause citations.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <select
            value={activeTender?.id || ''}
            onChange={(e) => onSelectTender(e.target.value)}
            className="px-3 py-2 text-sm neon-input rounded-xl max-w-xs"
          >
            {tenders.map((t) => (
              <option key={t.id} value={t.id}>
                {t.referenceNumber} — {t.title.slice(0, 40)}
              </option>
            ))}
          </select>
          <motion.button
            type="button"
            whileTap={{ scale: 0.97 }}
            disabled={!activeTender || running}
            onClick={handleRunRiskScan}
            className="inline-flex items-center gap-2 px-4 py-2.5 neon-btn-primary text-sm font-medium rounded-xl disabled:opacity-60 whitespace-nowrap"
          >
            <Sparkles className="w-4 h-4 text-white" />
            {running ? 'Scanning Clauses...' : 'Run Risk Audit'}
          </motion.button>
        </div>
      </div>

      {!activeRiskReport ? (
        <div className="neon-surface rounded-2xl p-12 text-center space-y-2">
          <ShieldAlert className="w-8 h-8 text-[#F87171] mx-auto" />
          <h3 className="font-display text-base font-semibold text-white">
            No Risk Audit Generated Yet
          </h3>
          <p className="text-sm text-[#9AA0A6] max-w-md mx-auto">
            Click “Run Risk Audit” to classify contractual, financial, and delivery risks across
            Low, Medium, High, and Critical levels.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="neon-surface rounded-2xl p-6 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs text-[#9AA0A6]">Overall Tender Risk Exposure</p>
                <h3 className="font-display text-xl font-bold text-white mt-0.5">
                  {activeRiskReport.overallRiskLevel} Risk Profile
                </h3>
              </div>

              <div className="flex flex-wrap gap-1 p-1 bg-white/[0.04] border border-white/[0.08] rounded-xl">
                {(['All', 'Critical', 'High', 'Medium', 'Low'] as const).map((lvl) => (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() => setSeverityFilter(lvl)}
                    className={`relative px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                      severityFilter === lvl ? 'text-white' : 'text-[#9AA0A6] hover:text-white'
                    }`}
                  >
                    {severityFilter === lvl && (
                      <motion.div
                        layoutId="riskSeverityTab"
                        transition={SPRING_SNAPPY}
                        className="absolute inset-0 rounded-lg bg-[#4285F4]/22 border border-[#4285F4]/50"
                      />
                    )}
                    <span className="relative z-10">{lvl}</span>
                  </button>
                ))}
              </div>
            </div>

            <p className="text-sm text-[#D2D8E2] leading-relaxed">
              {activeRiskReport.executiveSummary}
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3 border-t border-white/[0.08]">
              {severityCounts.map((s) => (
                <div
                  key={s.level}
                  className="p-3.5 rounded-xl bg-white/[0.03] border border-white/[0.08]"
                >
                  <div
                    className="h-[2px] w-8 rounded-full mb-2"
                    style={{ backgroundColor: SEVERITY_ACCENTS[s.level] }}
                    aria-hidden="true"
                  />
                  <p className="text-xs text-[#9AA0A6]">{s.level}</p>
                  <p className="font-mono tabular-nums text-xl font-bold text-white mt-0.5">
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
                className="neon-surface-interactive rounded-2xl p-5 space-y-2.5"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2">
                    <span
                      className={`font-semibold ${
                        risk.severity === 'Critical' || risk.severity === 'High'
                          ? 'text-[#F87171]'
                          : risk.severity === 'Medium'
                            ? 'text-[#FCD34D]'
                            : 'text-[#4ADE80]'
                      }`}
                    >
                      {risk.severity} Severity
                    </span>
                    <span aria-hidden="true" className="text-white/25">
                      ·
                    </span>
                    <span className="text-[#9AA0A6]">{risk.category}</span>
                  </div>
                  <span className="font-mono text-[#8AB4F8] font-medium">{risk.sourcePage}</span>
                </div>

                <h4 className="font-display text-base font-semibold text-white">{risk.title}</h4>
                <p className="text-sm text-[#C4CBD6] leading-relaxed">{risk.description}</p>

                <div className="grid md:grid-cols-2 gap-4 pt-3 border-t border-white/[0.08] text-xs">
                  <div>
                    <span className="font-semibold text-white">Source Clause Evidence: </span>
                    <span className="text-[#9AA0A6]">“{risk.evidenceQuote}”</span>
                  </div>
                  <div>
                    <span className="font-semibold text-[#8AB4F8]">Recommended Mitigation: </span>
                    <span className="text-[#C4CBD6]">{risk.mitigation}</span>
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
