import React from 'react';
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
  const nowStr = new Date().toISOString().slice(0, 10);
  const in30Days = new Date(Date.now() + 30 * 86400 * 1000).toISOString().slice(0, 10);

  const totalTenders = tenders.length;
  const relevantTenders = tenders.filter((t) =>
    !organization.industry ||
    (t.industry || '').toLowerCase().includes(organization.industry.split('&')[0].trim().toLowerCase()) ||
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

  // Industry breakdown for SVG donut chart
  const industryCounts = tenders.reduce<Record<string, number>>((acc, t) => {
    const key = t.industry || 'Uncategorized';
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  const industryEntries = Object.entries(industryCounts).sort((a, b) => b[1] - a[1]);
  const donutColors = ['#4285F4', '#34A853', '#FBBC04', '#EA4335', '#1A73E8', '#5F6368'];

  // AI Recommendations derived strictly from real database records
  const recommendations: Array<{
    title: string;
    detail: string;
    actionLabel: string;
    targetNav: NavSection;
    tenderId?: string;
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
      });
    } else if (!hasEligibility && recommendations.length < 4) {
      recommendations.push({
        title: `Verify Eligibility: ${t.referenceNumber}`,
        detail: `Compare ${organization.name}'s turnover & certifications against tender clauses.`,
        actionLabel: 'Check Eligibility',
        targetNav: 'eligibility',
        tenderId: t.id,
      });
    } else if (!hasRisk && recommendations.length < 4) {
      recommendations.push({
        title: `Audit Contract Risks: ${t.referenceNumber}`,
        detail: `Scan for liquidated damages, payment holds, and delivery SLA risks.`,
        actionLabel: 'Run Risk Scan',
        targetNav: 'risk',
        tenderId: t.id,
      });
    } else if (!hasProposal && recommendations.length < 4) {
      recommendations.push({
        title: `Draft Technical Proposal: ${t.referenceNumber}`,
        detail: `Co-author compliant bid sections using indexed tender evidence.`,
        actionLabel: 'Open Co-Author',
        targetNav: 'coauthor',
        tenderId: t.id,
      });
    }
  }

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white border border-[#DADCE0] rounded-xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <p className="text-xs font-medium text-[#1A73E8] mb-1">
            Procurement Intelligence Overview · {organization.industry}
          </p>
          <h2 className="font-display text-2xl font-bold text-[#202124]">
            Bid Pipeline &amp; Readiness Summary
          </h2>
          <p className="text-sm text-[#5F6368] mt-1">
            Live workspace metrics backed by Firestore for {organization.name}.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => onNavigate('discover')}
            className="inline-flex items-center gap-2 px-4 py-2 border border-[#DADCE0] bg-white text-[#3C4043] text-sm font-medium rounded-lg hover:bg-[#F1F3F4] whitespace-nowrap"
          >
            <Compass className="w-4 h-4 text-[#1A73E8]" />
            Discover Tenders
          </button>
          <button
            type="button"
            onClick={() => onNavigate('analyzer')}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#1A73E8] text-white text-sm font-medium rounded-lg hover:bg-[#1557B0] whitespace-nowrap"
          >
            <FileSearch className="w-4 h-4 text-white" />
            Upload Tender PDF
          </button>
        </div>
      </div>

      {/* 6 KPI Metric Strip */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
        {[
          { label: 'Total Discovered', value: totalTenders, sub: 'Workspace records' },
          { label: 'Relevant Tenders', value: relevantTenders, sub: 'Industry / saved match' },
          { label: 'Under Evaluation', value: underEvaluation, sub: 'Review & eligibility' },
          { label: 'Eligible / Likely', value: eligibleCount, sub: 'Verified profile fit' },
          { label: 'Bids in Preparation', value: inPreparation, sub: 'Active co-authoring' },
          { label: 'Upcoming Deadlines', value: upcomingDeadlines.length, sub: 'Next 30 days' },
        ].map((kpi) => (
          <div key={kpi.label} className="bg-white border border-slate-200 rounded-xl p-4">
            <p className="text-xs font-medium text-slate-500 truncate">{kpi.label}</p>
            <p className="font-mono tabular-nums text-2xl font-bold text-slate-900 mt-1.5">
              {kpi.value}
            </p>
            <p className="text-[11px] text-slate-400 mt-1 truncate">{kpi.sub}</p>
          </div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid lg:grid-cols-12 gap-6">
        {/* Pipeline Distribution Chart */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h3 className="font-display text-base font-semibold text-slate-900">
                Tender Workflow Distribution
              </h3>
              <p className="text-xs text-slate-500">Count of tenders across bidding stages</p>
            </div>
            <span className="text-xs font-mono tabular-nums text-slate-500">
              {totalTenders} total
            </span>
          </div>

          <div className="space-y-3">
            {STATUS_ORDER.map((status) => {
              const count = tenders.filter((t) => t.status === status).length;
              const pct = totalTenders > 0 ? Math.round((count / totalTenders) * 100) : 0;
              return (
                <div key={status} className="grid grid-cols-12 items-center gap-3 text-xs">
                  <span className="col-span-4 sm:col-span-3 text-[#3C4043] font-medium truncate">
                    {status}
                  </span>
                  <div className="col-span-6 sm:col-span-7 h-2.5 bg-[#F1F3F4] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#1A73E8] rounded-full transition-all duration-300"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="col-span-2 text-right font-mono tabular-nums text-[#3C4043]">
                    {count}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Industry Breakdown SVG Ring */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6">
          <h3 className="font-display text-base font-semibold text-slate-900 mb-1">
            Industry Categories
          </h3>
          <p className="text-xs text-slate-500 mb-5">Portfolio split by sector</p>

          {industryEntries.length === 0 ? (
            <div className="py-10 text-center text-xs text-slate-500">
              Add or discover tenders to visualize sector distribution.
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row items-center gap-6">
              <svg viewBox="0 0 140 140" className="w-36 h-36 shrink-0">
                {(() => {
                  const radius = 52;
                  const circumference = 2 * Math.PI * radius;
                  let offset = 0;
                  return industryEntries.map(([ind, count], idx) => {
                    const frac = count / Math.max(totalTenders, 1);
                    const dash = frac * circumference;
                    const strokeDashoffset = -offset;
                    offset += dash;
                    return (
                      <circle
                        key={ind}
                        cx="70"
                        cy="70"
                        r={radius}
                        fill="transparent"
                        stroke={donutColors[idx % donutColors.length]}
                        strokeWidth="18"
                        strokeDasharray={`${dash} ${circumference}`}
                        strokeDashoffset={strokeDashoffset}
                        transform="rotate(-90 70 70)"
                      />
                    );
                  });
                })()}
                <text
                  x="70"
                  y="66"
                  textAnchor="middle"
                  className="fill-slate-900 font-mono text-lg font-bold"
                >
                  {industryEntries.length}
                </text>
                <text
                  x="70"
                  y="84"
                  textAnchor="middle"
                  className="fill-slate-500 text-[10px]"
                >
                  sectors
                </text>
              </svg>

              <div className="flex-1 w-full space-y-2">
                {industryEntries.slice(0, 6).map(([ind, count], idx) => (
                  <div key={ind} className="flex items-center justify-between text-xs gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      <span
                        className="w-2.5 h-2.5 rounded-sm shrink-0"
                        style={{ backgroundColor: donutColors[idx % donutColors.length] }}
                      />
                      <span className="text-slate-700 truncate">{ind}</span>
                    </div>
                    <span className="font-mono tabular-nums text-slate-900 font-medium">
                      {count}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Deadlines + AI Recommendations */}
      <div className="grid lg:grid-cols-12 gap-6">
        <div className="lg:col-span-6 bg-white border border-[#DADCE0] rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <CalendarClock className="w-4 h-4 text-[#F9AB00]" />
              <h3 className="font-display text-base font-semibold text-[#202124]">
                Upcoming Submission Deadlines
              </h3>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('my_tenders')}
              className="text-xs font-medium text-[#1A73E8] hover:underline"
            >
              View Pipeline
            </button>
          </div>

          {upcomingDeadlines.length === 0 ? (
            <p className="text-sm text-[#5F6368] py-8 text-center">
              No tender deadlines within the next 30 days.
            </p>
          ) : (
            <div className="divide-y divide-[#E8EAED]">
              {upcomingDeadlines.slice(0, 5).map((t) => (
                <div
                  key={t.id}
                  className="py-3 flex items-center justify-between gap-4 hover:bg-[#F8F9FA] px-2 rounded-lg"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[#202124] truncate">{t.title}</p>
                    <p className="text-xs text-[#5F6368] mt-0.5 truncate">
                      {t.referenceNumber} · {t.status}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-mono tabular-nums text-xs font-semibold text-[#B06000]">
                      {t.deadlineDate}
                    </p>
                    <button
                      type="button"
                      onClick={() => onSelectTender(t.id, 'my_tenders')}
                      className="text-[11px] text-[#1A73E8] hover:underline mt-0.5"
                    >
                      Open
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="lg:col-span-6 bg-white border border-[#DADCE0] rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <PenTool className="w-4 h-4 text-[#1A73E8]" />
              <h3 className="font-display text-base font-semibold text-[#202124]">
                AI Copilot Next Best Actions
              </h3>
            </div>
          </div>

          {recommendations.length === 0 ? (
            <div className="py-8 text-center text-sm text-[#5F6368]">
              All active tenders have analysis, eligibility, risk, and proposal drafts initialized.
            </div>
          ) : (
            <div className="space-y-3">
              {recommendations.map((rec, i) => (
                <div
                  key={i}
                  className="p-3.5 rounded-lg border border-[#DADCE0] flex items-center justify-between gap-4"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-[#202124] truncate">{rec.title}</p>
                    <p className="text-xs text-[#5F6368] mt-0.5 truncate">{rec.detail}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      rec.tenderId
                        ? onSelectTender(rec.tenderId, rec.targetNav)
                        : onNavigate(rec.targetNav)
                    }
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#1A73E8] text-white text-xs font-medium rounded-lg hover:bg-[#1557B0] whitespace-nowrap shrink-0"
                  >
                    {rec.actionLabel}
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recently Analyzed Tenders Table */}
      <div className="bg-white border border-[#DADCE0] rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-[#E8EAED] flex items-center justify-between">
          <div>
            <h3 className="font-display text-base font-semibold text-[#202124]">
              Recently Analyzed Tenders
            </h3>
            <p className="text-xs text-[#5F6368]">
              Structured AI analyses stored in your organization workspace
            </p>
          </div>
          <span className="text-xs font-mono tabular-nums text-[#5F6368]">
            {analyses.length} reports
          </span>
        </div>

        {analyses.length === 0 ? (
          <div className="p-8 text-center text-sm text-[#5F6368]">
            No tender documents analyzed yet. Open Document Analyzer to upload a PDF RFP.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-[#F8F9FA] text-xs text-[#5F6368] border-b border-[#E8EAED]">
                <tr>
                  <th className="px-6 py-3 font-medium">Tender</th>
                  <th className="px-6 py-3 font-medium">Authority</th>
                  <th className="px-6 py-3 font-medium">Eligibility</th>
                  <th className="px-6 py-3 font-medium text-right">Estimated Value</th>
                  <th className="px-6 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8EAED]">
                {analyses.slice(0, 6).map((anl) => {
                  const t = tenders.find((item) => item.id === anl.tenderId);
                  return (
                    <tr key={anl.id} className="hover:bg-[#F8F9FA]">
                      <td className="px-6 py-3.5">
                        <p className="font-medium text-[#202124]">
                          {t?.title || anl.tenderMetadata?.referenceNumber || anl.tenderId}
                        </p>
                        <p className="text-xs text-[#5F6368] font-mono mt-0.5">
                          {t?.referenceNumber || anl.tenderMetadata?.referenceNumber || 'N/A'}
                        </p>
                      </td>
                      <td className="px-6 py-3.5 text-xs text-[#5F6368]">
                        {t?.authority || anl.tenderMetadata?.issuingAuthority || 'Not specified'}
                      </td>
                      <td className="px-6 py-3.5 text-xs">
                        <span className="inline-flex items-center gap-1.5 font-medium text-[#3C4043]">
                          {t?.eligibilityStatus === 'Eligible' ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-[#1E8E3E]" />
                          ) : (
                            <ShieldAlert className="w-3.5 h-3.5 text-[#F9AB00]" />
                          )}
                          {t?.eligibilityStatus || 'Pending'}
                        </span>
                      </td>
                      <td className="px-6 py-3.5 text-right font-mono tabular-nums text-xs text-[#202124]">
                        {t?.estimatedValueLakhs
                          ? `INR ${t.estimatedValueLakhs} L`
                          : anl.tenderMetadata?.estimatedValue || 'N/A'}
                      </td>
                      <td className="px-6 py-3.5 text-right">
                        <button
                          type="button"
                          onClick={() => onSelectTender(anl.tenderId, 'analyzer')}
                          className="text-xs font-medium text-[#1A73E8] hover:underline"
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
