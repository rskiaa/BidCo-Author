import React, { useState } from 'react';
import { motion } from 'motion/react';
import {
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  Compass,
  FileSearch,
  PenTool,
  ShieldAlert,
} from 'lucide-react';
import type {
  EligibilityAssessment,
  GeneratedProposal,
  Organization,
  RiskReport,
  TenderAnalysis,
  TenderRecord,
} from '../types/procurement.ts';
import type { NavSection } from './SidebarLayout.tsx';
import {
  AnimatedNumber,
  EASE_OUT_EXPO,
  StaggerContainer,
  StaggerItem,
} from './NeonPrimitives.tsx';

interface DashboardViewProps {
  organization: Organization;
  tenders: TenderRecord[];
  analyses: TenderAnalysis[];
  eligibilities: EligibilityAssessment[];
  proposals: GeneratedProposal[];
  risks: RiskReport[];
  onNavigate: (nav: NavSection) => void;
  onSelectTender: (tenderId: string, nav?: NavSection) => void;
}

const STATUS_ORDER = [
  'Discovered',
  'Under Review',
  'Eligibility Checking',
  'Bid Preparation',
  'Internal Review',
  'Submitted',
  'Won',
  'Lost',
] as const;

const BAR_COLORS: Record<string, string> = {
  Discovered: '#4285F4',
  'Under Review': '#669DF6',
  'Eligibility Checking': '#FBBC04',
  'Bid Preparation': '#4285F4',
  'Internal Review': '#FCD34D',
  Submitted: '#34A853',
  Won: '#4ADE80',
  Lost: '#EA4335',
};

export function DashboardView({
  organization,
  tenders,
  analyses,
  eligibilities,
  proposals,
  risks,
  onNavigate,
  onSelectTender,
}: DashboardViewProps) {
  const [hoveredSector, setHoveredSector] = useState<string | null>(null);

  const nowStr = new Date().toISOString().slice(0, 10);
  const in30Days = new Date(Date.now() + 30 * 86400 * 1000).toISOString().slice(0, 10);

  const totalTenders = tenders.length;
  const relevantTenders = tenders.filter(
    (t) =>
      !organization.industry ||
      (t.industry || '')
        .toLowerCase()
        .includes(organization.industry.split('&')[0].trim().toLowerCase()) ||
      t.isSaved,
  ).length;
  const underEvaluation = tenders.filter((t) =>
    ['Under Review', 'Eligibility Checking'].includes(t.status),
  ).length;
  const eligibleCount = tenders.filter(
    (t) => t.eligibilityStatus === 'Eligible' || t.eligibilityStatus === 'Potentially Eligible',
  ).length;
  const inPreparation = tenders.filter((t) =>
    ['Bid Preparation', 'Internal Review'].includes(t.status),
  ).length;
  const upcomingDeadlines = tenders
    .filter((t) => t.deadlineDate && t.deadlineDate >= nowStr && t.deadlineDate <= in30Days)
    .sort((a, b) => (a.deadlineDate || '').localeCompare(b.deadlineDate || ''));

  // Industry breakdown for interactive SVG donut chart
  const industryCounts = tenders.reduce<Record<string, number>>((acc, t) => {
    const key = t.industry || 'Uncategorized';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  const industryEntries = Object.entries(industryCounts).sort((a, b) => b[1] - a[1]);
  const donutColors = ['#4285F4', '#34A853', '#FBBC04', '#EA4335', '#669DF6', '#9AA0A6'];

  // AI Recommendations derived strictly from real database records
  const recommendations: Array<{
    title: string;
    detail: string;
    actionLabel: string;
    targetNav: NavSection;
    tenderId?: string;
    accent: string;
  }> = [];

  for (const t of tenders) {
    const hasAnalysis = analyses.some((a) => a.tenderId === t.id);
    const hasEligibility = eligibilities.some((e) => e.tenderId === t.id);
    const hasProposal = proposals.some((p) => p.tenderId === t.id);
    const hasRisk = risks.some((r) => r.tenderId === t.id);

    if (!hasAnalysis && recommendations.length < 4) {
      recommendations.push({
        title: `Run Document Analysis: ${t.referenceNumber}`,
        detail: `No structured requirement extraction saved yet for "${t.title}".`,
        actionLabel: 'Analyze Tender',
        targetNav: 'analyzer',
        tenderId: t.id,
        accent: '#4285F4',
      });
    } else if (!hasEligibility && recommendations.length < 4) {
      recommendations.push({
        title: `Verify Eligibility: ${t.referenceNumber}`,
        detail: `Compare ${organization.name}'s turnover & certifications against tender clauses.`,
        actionLabel: 'Check Eligibility',
        targetNav: 'eligibility',
        tenderId: t.id,
        accent: '#34A853',
      });
    } else if (!hasRisk && recommendations.length < 4) {
      recommendations.push({
        title: `Audit Contract Risks: ${t.referenceNumber}`,
        detail: `Scan for liquidated damages, payment holds, and delivery SLA risks.`,
        actionLabel: 'Run Risk Scan',
        targetNav: 'risk',
        tenderId: t.id,
        accent: '#EA4335',
      });
    } else if (!hasProposal && recommendations.length < 4) {
      recommendations.push({
        title: `Draft Technical Proposal: ${t.referenceNumber}`,
        detail: `Co-author compliant bid sections using indexed tender evidence.`,
        actionLabel: 'Open Bid Writer',
        targetNav: 'coauthor',
        tenderId: t.id,
        accent: '#FBBC04',
      });
    }
  }

  const kpiCards = [
    {
      label: 'Total Discovered',
      value: totalTenders,
      sub: 'Workspace records',
      accent: '#4285F4',
    },
    {
      label: 'Relevant Tenders',
      value: relevantTenders,
      sub: 'Industry / saved match',
      accent: '#34A853',
    },
    {
      label: 'Under Evaluation',
      value: underEvaluation,
      sub: 'Review & eligibility',
      accent: '#FBBC04',
    },
    {
      label: 'Eligible / Likely',
      value: eligibleCount,
      sub: 'Verified profile fit',
      accent: '#4ADE80',
    },
    {
      label: 'Bids in Preparation',
      value: inPreparation,
      sub: 'Active bid writing',
      accent: '#669DF6',
    },
    {
      label: 'Upcoming Deadlines',
      value: upcomingDeadlines.length,
      sub: 'Next 30 days',
      accent: '#EA4335',
    },
  ];

  const hoveredEntry = hoveredSector
    ? industryEntries.find(([ind]) => ind === hoveredSector)
    : null;

  return (
    <div className="space-y-6">
      {/* Hero Overview Banner */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: EASE_OUT_EXPO }}
        className="neon-surface rounded-2xl p-6 sm:p-7 relative overflow-hidden flex flex-col md:flex-row md:items-center justify-between gap-5"
      >
        <div
          className="pointer-events-none absolute -top-24 -right-24 w-72 h-72 rounded-full blur-[90px]"
          style={{ background: 'rgba(66, 133, 244, 0.18)' }}
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute -bottom-24 left-1/3 w-64 h-64 rounded-full blur-[90px]"
          style={{ background: 'rgba(52, 168, 83, 0.12)' }}
          aria-hidden="true"
        />

        <div className="relative z-10">
          <p className="text-xs font-medium text-[#8AB4F8] mb-1.5">
            Procurement Intelligence Overview · {organization.industry}
          </p>
          <h2 className="font-display text-2xl sm:text-3xl font-bold text-white tracking-tight">
            Bid Pipeline &amp; Readiness Summary
          </h2>
          <p className="text-sm text-[#A7B0C0] mt-1.5">
            Live workspace metrics backed by Firestore for {organization.name}.
          </p>
        </div>

        <div className="relative z-10 flex flex-wrap items-center gap-3 shrink-0">
          <motion.button
            type="button"
            whileTap={{ scale: 0.97 }}
            onClick={() => onNavigate('discover')}
            className="inline-flex items-center gap-2 px-4 py-2.5 neon-btn-secondary text-sm font-medium rounded-xl whitespace-nowrap"
          >
            <Compass className="w-4 h-4 text-[#4ADE80]" />
            Discover Tenders
          </motion.button>
          <motion.button
            type="button"
            whileTap={{ scale: 0.97 }}
            onClick={() => onNavigate('analyzer')}
            className="inline-flex items-center gap-2 px-4 py-2.5 neon-btn-primary text-sm font-medium rounded-xl whitespace-nowrap"
          >
            <FileSearch className="w-4 h-4 text-white" />
            Upload Tender PDF
          </motion.button>
        </div>
      </motion.div>

      {/* 6 KPI Metric Strip with Staggered Entrance & Spring Counters */}
      <StaggerContainer className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        {kpiCards.map((kpi) => (
          <StaggerItem key={kpi.label}>
            <motion.div
              whileHover={{ y: -3 }}
              transition={{ duration: 0.18, ease: EASE_OUT_EXPO }}
              className="neon-surface-interactive rounded-2xl p-4 h-full relative overflow-hidden"
            >
              <div
                className="h-[2px] w-10 rounded-full mb-3"
                style={{
                  backgroundColor: kpi.accent,
                  boxShadow: `0 0 12px ${kpi.accent}`,
                }}
                aria-hidden="true"
              />
              <p className="text-xs font-medium text-[#A7B0C0] truncate">{kpi.label}</p>
              <p className="text-2xl font-bold text-white mt-1.5">
                <AnimatedNumber value={kpi.value} />
              </p>
              <p className="text-[11px] text-[#7B8499] mt-1 truncate">{kpi.sub}</p>
            </motion.div>
          </StaggerItem>
        ))}
      </StaggerContainer>

      {/* Charts Row */}
      <div className="grid lg:grid-cols-12 gap-6">
        {/* Pipeline Distribution Chart */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.32, delay: 0.08, ease: EASE_OUT_EXPO }}
          className="lg:col-span-7 neon-surface rounded-2xl p-6"
        >
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="font-display text-base font-semibold text-white">
                Tender Workflow Distribution
              </h3>
              <p className="text-xs text-[#9AA0A6]">Count of tenders across bidding stages</p>
            </div>
            <span className="text-xs font-mono tabular-nums text-[#8AB4F8]">
              {totalTenders} total
            </span>
          </div>

          <div className="space-y-3.5">
            {STATUS_ORDER.map((status, idx) => {
              const count = tenders.filter((t) => t.status === status).length;
              const frac = totalTenders > 0 ? count / totalTenders : 0;
              const color = BAR_COLORS[status] || '#4285F4';
              return (
                <div
                  key={status}
                  className="grid grid-cols-12 items-center gap-3 text-xs group py-0.5"
                >
                  <span className="col-span-4 sm:col-span-3 text-[#C4CBD6] group-hover:text-white transition-colors font-medium truncate">
                    {status}
                  </span>
                  <div className="col-span-6 sm:col-span-7 h-2.5 bg-white/[0.06] rounded-full overflow-hidden">
                    <motion.div
                      initial={{ scaleX: 0 }}
                      animate={{ scaleX: frac }}
                      transition={{
                        duration: 0.55,
                        delay: 0.05 * idx,
                        ease: EASE_OUT_EXPO,
                      }}
                      className="h-full w-full origin-left rounded-full"
                      style={{
                        backgroundColor: color,
                        boxShadow: count > 0 ? `0 0 12px ${color}90` : 'none',
                      }}
                    />
                  </div>
                  <span className="col-span-2 text-right font-mono tabular-nums text-[#F1F3F4] font-medium">
                    {count}
                  </span>
                </div>
              );
            })}
          </div>
        </motion.div>

        {/* Industry Breakdown Interactive Neon Ring */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.32, delay: 0.12, ease: EASE_OUT_EXPO }}
          className="lg:col-span-5 neon-surface rounded-2xl p-6"
        >
          <h3 className="font-display text-base font-semibold text-white mb-1">
            Industry Categories
          </h3>
          <p className="text-xs text-[#9AA0A6] mb-5">Hover any sector to inspect distribution</p>

          {industryEntries.length === 0 ? (
            <div className="py-10 text-center text-xs text-[#7B8499]">
              Add or discover tenders to visualize sector distribution.
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row items-center gap-6">
              <svg viewBox="0 0 140 140" className="w-40 h-40 shrink-0 overflow-visible">
                <circle
                  cx="70"
                  cy="70"
                  r="52"
                  fill="transparent"
                  stroke="rgba(255,255,255,0.06)"
                  strokeWidth="16"
                />
                {(() => {
                  const radius = 52;
                  const circumference = 2 * Math.PI * radius;
                  let offset = 0;
                  return industryEntries.map(([ind, count], idx) => {
                    const frac = count / Math.max(totalTenders, 1);
                    const dash = frac * circumference;
                    const strokeDashoffset = -offset;
                    offset += dash;
                    const color = donutColors[idx % donutColors.length];
                    const isActive = hoveredSector === ind;
                    const isDimmed = hoveredSector !== null && !isActive;
                    return (
                      <motion.circle
                        key={ind}
                        cx="70"
                        cy="70"
                        r={radius}
                        fill="transparent"
                        stroke={color}
                        strokeWidth={isActive ? 20 : 16}
                        strokeDasharray={`${dash} ${circumference}`}
                        strokeDashoffset={strokeDashoffset}
                        transform="rotate(-90 70 70)"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: isDimmed ? 0.35 : 1 }}
                        transition={{ duration: 0.25 }}
                        style={{
                          cursor: 'pointer',
                          filter: isActive ? `drop-shadow(0 0 8px ${color})` : 'none',
                        }}
                        onMouseEnter={() => setHoveredSector(ind)}
                        onMouseLeave={() => setHoveredSector(null)}
                      />
                    );
                  });
                })()}
                <text
                  x="70"
                  y="66"
                  textAnchor="middle"
                  className="fill-white font-mono text-lg font-bold"
                >
                  {hoveredEntry ? hoveredEntry[1] : industryEntries.length}
                </text>
                <text
                  x="70"
                  y="84"
                  textAnchor="middle"
                  className="fill-[#9AA0A6] text-[10px]"
                >
                  {hoveredEntry ? 'tenders' : 'sectors'}
                </text>
              </svg>

              <div className="flex-1 w-full space-y-2">
                {industryEntries.slice(0, 6).map(([ind, count], idx) => {
                  const color = donutColors[idx % donutColors.length];
                  const isActive = hoveredSector === ind;
                  return (
                    <div
                      key={ind}
                      onMouseEnter={() => setHoveredSector(ind)}
                      onMouseLeave={() => setHoveredSector(null)}
                      className={`flex items-center justify-between text-xs gap-2 px-2.5 py-1.5 rounded-lg transition-colors cursor-default ${
                        isActive ? 'bg-white/[0.07]' : 'hover:bg-white/[0.04]'
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span
                          className="w-2.5 h-2.5 rounded-sm shrink-0"
                          style={{
                            backgroundColor: color,
                            boxShadow: isActive ? `0 0 8px ${color}` : 'none',
                          }}
                        />
                        <span className="text-[#D2D8E2] truncate">{ind}</span>
                      </div>
                      <span className="font-mono tabular-nums text-white font-medium">{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </motion.div>
      </div>

      {/* Deadlines + AI Copilot Next Best Actions */}
      <div className="grid lg:grid-cols-12 gap-6">
        <div className="lg:col-span-6 neon-surface rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <CalendarClock className="w-4 h-4 text-[#FCD34D]" />
              <h3 className="font-display text-base font-semibold text-white">
                Upcoming Submission Deadlines
              </h3>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('my_tenders')}
              className="text-xs font-medium text-[#8AB4F8] hover:underline"
            >
              View Pipeline
            </button>
          </div>

          {upcomingDeadlines.length === 0 ? (
            <p className="text-sm text-[#7B8499] py-8 text-center">
              No tender deadlines within the next 30 days.
            </p>
          ) : (
            <div className="divide-y divide-white/[0.07]">
              {upcomingDeadlines.slice(0, 5).map((t) => (
                <div
                  key={t.id}
                  className="py-3 flex items-center justify-between gap-4 hover:bg-white/[0.03] px-2.5 rounded-xl transition-colors"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[#F1F3F4] truncate">{t.title}</p>
                    <p className="text-xs text-[#9AA0A6] mt-0.5 truncate">
                      {t.referenceNumber} · {t.status}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-mono tabular-nums text-xs font-semibold text-[#FCD34D]">
                      {t.deadlineDate}
                    </p>
                    <button
                      type="button"
                      onClick={() => onSelectTender(t.id, 'my_tenders')}
                      className="text-[11px] text-[#8AB4F8] hover:underline mt-0.5"
                    >
                      Open
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="lg:col-span-6 neon-surface rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <PenTool className="w-4 h-4 text-[#669DF6]" />
              <h3 className="font-display text-base font-semibold text-white">
                AI Copilot Next Best Actions
              </h3>
            </div>
          </div>

          {recommendations.length === 0 ? (
            <div className="py-8 text-center text-sm text-[#7B8499]">
              All active tenders have analysis, eligibility, risk, and proposal drafts initialized.
            </div>
          ) : (
            <div className="space-y-3">
              {recommendations.map((rec, i) => (
                <motion.div
                  key={i}
                  whileHover={{ x: 2 }}
                  transition={{ duration: 0.16 }}
                  className="p-3.5 rounded-xl bg-white/[0.025] border border-white/[0.08] hover:border-[#4285F4]/40 transition-colors flex items-center justify-between gap-4"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-white truncate">{rec.title}</p>
                    <p className="text-xs text-[#9AA0A6] mt-0.5 truncate">{rec.detail}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      rec.tenderId
                        ? onSelectTender(rec.tenderId, rec.targetNav)
                        : onNavigate(rec.targetNav)
                    }
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 neon-btn-primary text-xs font-medium rounded-lg whitespace-nowrap shrink-0"
                  >
                    {rec.actionLabel}
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recently Analyzed Tenders Table */}
      <div className="neon-surface rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-white/[0.08] flex items-center justify-between">
          <div>
            <h3 className="font-display text-base font-semibold text-white">
              Recently Analyzed Tenders
            </h3>
            <p className="text-xs text-[#9AA0A6]">
              Structured AI analyses stored in your organization workspace
            </p>
          </div>
          <span className="text-xs font-mono tabular-nums text-[#8AB4F8]">
            {analyses.length} reports
          </span>
        </div>

        {analyses.length === 0 ? (
          <div className="p-8 text-center text-sm text-[#7B8499]">
            No tender documents analyzed yet. Open Document Analyzer to upload a PDF RFP.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-white/[0.03] text-xs text-[#9AA0A6] border-b border-white/[0.08]">
                <tr>
                  <th className="px-6 py-3 font-medium">Tender</th>
                  <th className="px-6 py-3 font-medium">Authority</th>
                  <th className="px-6 py-3 font-medium">Eligibility</th>
                  <th className="px-6 py-3 font-medium text-right">Estimated Value</th>
                  <th className="px-6 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06]">
                {analyses.slice(0, 6).map((anl) => {
                  const t = tenders.find((item) => item.id === anl.tenderId);
                  return (
                    <tr
                      key={anl.id}
                      className="hover:bg-[#4285F4]/[0.06] transition-colors"
                    >
                      <td className="px-6 py-3.5">
                        <p className="font-medium text-[#F1F3F4]">
                          {t?.title || anl.tenderMetadata?.referenceNumber || anl.tenderId}
                        </p>
                        <p className="text-xs text-[#9AA0A6] font-mono mt-0.5">
                          {t?.referenceNumber || anl.tenderMetadata?.referenceNumber || 'N/A'}
                        </p>
                      </td>
                      <td className="px-6 py-3.5 text-xs text-[#A7B0C0]">
                        {t?.authority || anl.tenderMetadata?.issuingAuthority || 'Not specified'}
                      </td>
                      <td className="px-6 py-3.5 text-xs">
                        <span className="inline-flex items-center gap-1.5 font-medium text-[#E8EAED]">
                          {t?.eligibilityStatus === 'Eligible' ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-[#4ADE80]" />
                          ) : (
                            <ShieldAlert className="w-3.5 h-3.5 text-[#FCD34D]" />
                          )}
                          {t?.eligibilityStatus || 'Pending'}
                        </span>
                      </td>
                      <td className="px-6 py-3.5 text-right font-mono tabular-nums text-xs text-[#F1F3F4]">
                        {t?.estimatedValueLakhs
                          ? `INR ${t.estimatedValueLakhs} L`
                          : anl.tenderMetadata?.estimatedValue || 'N/A'}
                      </td>
                      <td className="px-6 py-3.5 text-right">
                        <button
                          type="button"
                          onClick={() => onSelectTender(anl.tenderId, 'analyzer')}
                          className="text-xs font-medium text-[#8AB4F8] hover:underline"
                        >
                          Open Report
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
