import React, { useEffect, useMemo, useState } from 'react';
import { Calculator, Save, Sparkles } from 'lucide-react';
import { analyzeFinancialsWithAi } from '../lib/apiClient.ts';
import { logActivity, makeSafeId, saveFinancialAnalysis } from '../lib/firestoreStore.ts';
import type {
  BidScenario,
  CostInputs,
  FinancialAnalysis,
  Organization,
  TenderRecord,
  UserProfile,
} from '../types/procurement.ts';

interface FinancialIntelligenceViewProps {
  organization: Organization;
  userProfile: UserProfile;
  tenders: TenderRecord[];
  financials: FinancialAnalysis[];
  selectedTenderId: string;
  onSelectTender: (id: string) => void;
  onNotify: (msg: string) => void;
  onError: (msg: string) => void;
}

export function FinancialIntelligenceView({
  organization,
  userProfile,
  tenders,
  financials,
  selectedTenderId,
  onSelectTender,
  onNotify,
  onError,
}: FinancialIntelligenceViewProps) {
  const activeTender =
    tenders.find((t) => t.id === selectedTenderId) || tenders[0] || null;
  const existing = activeTender
    ? financials.find((f) => f.tenderId === activeTender.id) || null
    : null;

  const [tenderBudgetLakhs, setTenderBudgetLakhs] = useState(480);
  const [emdLakhs, setEmdLakhs] = useState(9.6);
  const [pbgPercent, setPbgPercent] = useState(5);
  const [costInputs, setCostInputs] = useState<CostInputs>({
    directLaborLakhs: 145,
    materialsAndOemLakhs: 160,
    subcontractorsLakhs: 45,
    logisticsAndDeploymentLakhs: 22,
    overheadPercent: 8,
    contingencyPercent: 5,
    workingCapitalCostPercent: 2.5,
  });
  const [aiCommentary, setAiCommentary] = useState('');
  const [recommendedBidLakhs, setRecommendedBidLakhs] = useState<number>(0);
  const [flags, setFlags] = useState<string[]>([]);
  const [analyzing, setAnalyzing] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (existing) {
      setTenderBudgetLakhs(existing.tenderBudgetLakhs);
      setEmdLakhs(existing.emdLakhs ?? 0);
      setPbgPercent(existing.pbgPercent ?? 5);
      setCostInputs(existing.costInputs);
      setAiCommentary(existing.aiCommentary || '');
      setRecommendedBidLakhs(existing.recommendedBidLakhs || 0);
    } else if (activeTender) {
      const est = activeTender.estimatedValueLakhs || 300;
      setTenderBudgetLakhs(est);
      setEmdLakhs(activeTender.emdAmountLakhs ?? Number((est * 0.02).toFixed(2)));
      setPbgPercent(5);
      setCostInputs({
        directLaborLakhs: Number((est * 0.3).toFixed(1)),
        materialsAndOemLakhs: Number((est * 0.34).toFixed(1)),
        subcontractorsLakhs: Number((est * 0.1).toFixed(1)),
        logisticsAndDeploymentLakhs: Number((est * 0.05).toFixed(1)),
        overheadPercent: 8,
        contingencyPercent: 5,
        workingCapitalCostPercent: 2.5,
      });
      setAiCommentary('');
      setRecommendedBidLakhs(0);
    }
    setFlags([]);
  }, [existing, activeTender]);

  // Transparent deterministic cost arithmetic
  const calculations = useMemo(() => {
    const directSubtotal =
      costInputs.directLaborLakhs +
      costInputs.materialsAndOemLakhs +
      costInputs.subcontractorsLakhs +
      costInputs.logisticsAndDeploymentLakhs;

    const overheadAmount = directSubtotal * (costInputs.overheadPercent / 100);
    const contingencyAmount = directSubtotal * (costInputs.contingencyPercent / 100);
    const financingAmount = directSubtotal * (costInputs.workingCapitalCostPercent / 100);
    const totalBaseCost = Number(
      (directSubtotal + overheadAmount + contingencyAmount + financingAmount).toFixed(2),
    );

    const scenarioConfigs = [
      {
        name: 'Aggressive L1 (Lean)',
        strategy: 'Competitive price-led bid',
        targetMarginPercent: 7,
        notes: 'Minimized margin for L1 price competitiveness; tighter contingency buffer.',
      },
      {
        name: 'Balanced Target',
        strategy: 'Optimal margin & win probability',
        targetMarginPercent: 14,
        notes: 'Balanced gross margin covering SLA risk and O&M working capital.',
      },
      {
        name: 'Margin-Protected',
        strategy: 'High-risk / complex SLA buffer',
        targetMarginPercent: 21,
        notes: 'Protects profitability against liquidated damages and delayed milestone payments.',
      },
    ];

    const scenarios: BidScenario[] = scenarioConfigs.map((cfg) => {
      const bidPrice = Number((totalBaseCost / (1 - cfg.targetMarginPercent / 100)).toFixed(2));
      const grossProfit = Number((bidPrice - totalBaseCost).toFixed(2));
      const netMarginPercent = bidPrice > 0 ? Number(((grossProfit / bidPrice) * 100).toFixed(1)) : 0;
      const varianceVsBudget =
        tenderBudgetLakhs > 0
          ? Number((((bidPrice - tenderBudgetLakhs) / tenderBudgetLakhs) * 100).toFixed(1))
          : 0;
      const pbgLockupLakhs = Number((bidPrice * (pbgPercent / 100)).toFixed(2));

      return {
        name: cfg.name,
        strategy: cfg.strategy,
        targetMarginPercent: cfg.targetMarginPercent,
        baseCostLakhs: totalBaseCost,
        bidPriceLakhs: bidPrice,
        grossProfitLakhs: grossProfit,
        netMarginPercent,
        varianceVsBudgetPercent: varianceVsBudget,
        pbgLockupLakhs,
        notes: cfg.notes,
      };
    });

    return {
      directSubtotal: Number(directSubtotal.toFixed(2)),
      overheadAmount: Number(overheadAmount.toFixed(2)),
      contingencyAmount: Number(contingencyAmount.toFixed(2)),
      financingAmount: Number(financingAmount.toFixed(2)),
      totalBaseCost,
      scenarios,
    };
  }, [costInputs, pbgPercent, tenderBudgetLakhs]);

  const handleRunAiAnalysis = async () => {
    if (!activeTender) return;
    setAnalyzing(true);
    try {
      const res = await analyzeFinancialsWithAi({
        tenderTitle: activeTender.title,
        tenderBudgetLakhs,
        emdLakhs,
        pbgPercent,
        costInputs,
        scenarios: calculations.scenarios,
        companyTurnoverLakhs: organization.annualTurnoverLakhs,
      });
      setAiCommentary(res.result.aiCommentary);
      setRecommendedBidLakhs(res.result.recommendedBidLakhs);
      setFlags(res.result.keyFinancialFlags || []);
      onNotify('Financial bid intelligence updated.');
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Financial analysis failed.');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleSave = async () => {
    if (!activeTender) return;
    setSaving(true);
    try {
      await saveFinancialAnalysis(
        organization,
        {
          id: existing ? existing.id : makeSafeId('fin'),
          tenderId: activeTender.id,
          tenderBudgetLakhs,
          emdLakhs,
          pbgPercent,
          costInputs,
          scenarios: calculations.scenarios,
          aiCommentary,
          recommendedBidLakhs,
        },
        Boolean(existing),
      );
      await logActivity(organization, {
        actorUid: userProfile.uid,
        actorName: userProfile.displayName,
        tenderId: activeTender.id,
        actionType: 'FINANCIAL_MODEL_SAVED',
        description: `Saved financial bid scenarios for ${activeTender.referenceNumber} (Base Cost: INR ${calculations.totalBaseCost} L).`,
      });
      onNotify('Financial scenarios saved to Firestore.');
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Failed to save financial model.');
    } finally {
      setSaving(false);
    }
  };

  const updateCost = (key: keyof CostInputs, val: string) => {
    setCostInputs((prev) => ({ ...prev, [key]: Math.max(0, Number(val) || 0) }));
  };

  return (
    <div className="space-y-6">
      <div className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-lg font-bold text-slate-900">
            Financial Bid Intelligence &amp; Margin Modeling
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Transparent cost arithmetic and scenario modeling. All pricing decisions and
            portal submissions remain under human sign-off.
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
            disabled={!activeTender || analyzing}
            onClick={handleRunAiAnalysis}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#E8F0FE] text-[#1967D2] border border-[#D2E3FC] text-sm font-medium rounded-lg hover:bg-[#D2E3FC]/70 disabled:opacity-60"
          >
            <Sparkles className="w-4 h-4" />
            {analyzing ? 'Analyzing...' : 'AI Pricing Review'}
          </button>
          <button
            type="button"
            disabled={!activeTender || saving}
            onClick={handleSave}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#1A73E8] text-white text-sm font-medium rounded-lg hover:bg-[#1557B0] disabled:opacity-60"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : 'Save Model'}
          </button>
        </div>
      </div>

      {/* Cost Assumptions & Transparent Breakdown */}
      <div className="grid lg:grid-cols-12 gap-6">
        <div className="lg:col-span-5 bg-white border border-[#DADCE0] rounded-xl p-6 space-y-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-[#202124]">
            <Calculator className="w-4 h-4 text-[#1A73E8]" />
            Project Cost &amp; Tender Parameters (INR Lakhs)
          </div>

          <div className="grid grid-cols-3 gap-3 text-xs">
            <div>
              <label className="block text-slate-500 mb-1">Tender Ceiling</label>
              <input
                type="number"
                step="0.5"
                value={tenderBudgetLakhs}
                onChange={(e) => setTenderBudgetLakhs(Number(e.target.value) || 0)}
                className="w-full px-2.5 py-2 border border-slate-300 rounded-lg font-mono tabular-nums"
              />
            </div>
            <div>
              <label className="block text-slate-500 mb-1">EMD Lockup</label>
              <input
                type="number"
                step="0.1"
                value={emdLakhs}
                onChange={(e) => setEmdLakhs(Number(e.target.value) || 0)}
                className="w-full px-2.5 py-2 border border-slate-300 rounded-lg font-mono tabular-nums"
              />
            </div>
            <div>
              <label className="block text-slate-500 mb-1">PBG %</label>
              <input
                type="number"
                step="0.5"
                value={pbgPercent}
                onChange={(e) => setPbgPercent(Number(e.target.value) || 0)}
                className="w-full px-2.5 py-2 border border-slate-300 rounded-lg font-mono tabular-nums"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 text-xs pt-2 border-t border-slate-100">
            <div>
              <label className="block text-slate-600 mb-1">Direct Engineering Labor</label>
              <input
                type="number"
                step="0.5"
                value={costInputs.directLaborLakhs}
                onChange={(e) => updateCost('directLaborLakhs', e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono tabular-nums"
              />
            </div>
            <div>
              <label className="block text-slate-600 mb-1">Hardware / OEM / Licenses</label>
              <input
                type="number"
                step="0.5"
                value={costInputs.materialsAndOemLakhs}
                onChange={(e) => updateCost('materialsAndOemLakhs', e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono tabular-nums"
              />
            </div>
            <div>
              <label className="block text-slate-600 mb-1">Subcontractors &amp; Partners</label>
              <input
                type="number"
                step="0.5"
                value={costInputs.subcontractorsLakhs}
                onChange={(e) => updateCost('subcontractorsLakhs', e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono tabular-nums"
              />
            </div>
            <div>
              <label className="block text-slate-600 mb-1">Logistics &amp; Field Ops</label>
              <input
                type="number"
                step="0.5"
                value={costInputs.logisticsAndDeploymentLakhs}
                onChange={(e) => updateCost('logisticsAndDeploymentLakhs', e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono tabular-nums"
              />
            </div>
            <div>
              <label className="block text-slate-600 mb-1">Corporate Overhead (%)</label>
              <input
                type="number"
                step="0.5"
                value={costInputs.overheadPercent}
                onChange={(e) => updateCost('overheadPercent', e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono tabular-nums"
              />
            </div>
            <div>
              <label className="block text-slate-600 mb-1">Risk Contingency (%)</label>
              <input
                type="number"
                step="0.5"
                value={costInputs.contingencyPercent}
                onChange={(e) => updateCost('contingencyPercent', e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono tabular-nums"
              />
            </div>
          </div>

          <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-1.5 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-600">Direct Resource Subtotal</span>
              <span className="font-mono tabular-nums font-medium">
                INR {calculations.directSubtotal} L
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">Overhead ({costInputs.overheadPercent}%)</span>
              <span className="font-mono tabular-nums">INR {calculations.overheadAmount} L</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">Contingency ({costInputs.contingencyPercent}%)</span>
              <span className="font-mono tabular-nums">INR {calculations.contingencyAmount} L</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">
                Working Capital ({costInputs.workingCapitalCostPercent}%)
              </span>
              <span className="font-mono tabular-nums">INR {calculations.financingAmount} L</span>
            </div>
            <div className="flex justify-between pt-2 border-t border-slate-200 font-semibold text-slate-900">
              <span>All-In Break-Even Base Cost</span>
              <span className="font-mono tabular-nums">INR {calculations.totalBaseCost} L</span>
            </div>
          </div>
        </div>

        {/* Pricing Scenarios + AI Commentary */}
        <div className="lg:col-span-7 space-y-6">
          <div className="grid sm:grid-cols-3 gap-4">
            {calculations.scenarios.map((sc) => {
              const withinBudget = sc.varianceVsBudgetPercent <= 0;
              return (
                <div
                  key={sc.name}
                  className="bg-white border border-[#DADCE0] rounded-xl p-5 flex flex-col justify-between space-y-3"
                >
                  <div>
                    <p className="text-xs font-semibold text-[#1A73E8]">{sc.name}</p>
                    <p className="text-[11px] text-[#5F6368] mt-0.5">{sc.strategy}</p>
                    <p className="font-mono tabular-nums text-2xl font-bold text-[#202124] mt-3">
                      INR {sc.bidPriceLakhs} L
                    </p>
                    <p
                      className={`text-xs font-mono tabular-nums mt-1 ${
                        withinBudget ? 'text-[#1E8E3E]' : 'text-[#D93025]'
                      }`}
                    >
                      {sc.varianceVsBudgetPercent > 0 ? '+' : ''}
                      {sc.varianceVsBudgetPercent}% vs budget
                    </p>
                  </div>

                  <div className="pt-3 border-t border-[#E8EAED] space-y-1 text-xs">
                    <div className="flex justify-between">
                      <span className="text-[#5F6368]">Gross Profit</span>
                      <span className="font-mono tabular-nums font-medium text-[#202124]">
                        INR {sc.grossProfitLakhs} L
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#5F6368]">Net Margin</span>
                      <span className="font-mono tabular-nums font-medium text-[#202124]">
                        {sc.netMarginPercent}%
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#5F6368]">PBG Lockup ({pbgPercent}%)</span>
                      <span className="font-mono tabular-nums text-[#3C4043]">
                        INR {sc.pbgLockupLakhs} L
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="bg-white border border-[#DADCE0] rounded-xl p-6 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-base font-semibold text-[#202124]">
                AI Financial Strategy Assessment
              </h3>
              {recommendedBidLakhs > 0 && (
                <span className="font-mono tabular-nums text-xs font-semibold text-[#1A73E8]">
                  Reference Target: INR {recommendedBidLakhs} L
                </span>
              )}
            </div>
            {aiCommentary ? (
              <>
                <p className="text-sm text-slate-700 leading-relaxed">{aiCommentary}</p>
                {flags.length > 0 && (
                  <ul className="list-disc pl-4 space-y-1 text-xs text-slate-600 pt-2 border-t border-slate-100">
                    {flags.map((f, i) => (
                      <li key={i}>{f}</li>
                    ))}
                  </ul>
                )}
              </>
            ) : (
              <p className="text-sm text-slate-500">
                Adjust your cost assumptions on the left and click “AI Pricing Review” to evaluate
                L1 headroom, turnover capacity, and working capital lockup.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
