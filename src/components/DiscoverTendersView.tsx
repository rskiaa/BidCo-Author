import React, { useEffect, useState } from 'react';
import {
  BookmarkPlus,
  CheckCircle2,
  ExternalLink,
  Filter,
  Globe2,
  Search,
  X,
} from 'lucide-react';
import { fetchDiscoveryTenders } from '../lib/apiClient.ts';
import { logActivity, makeSafeId, saveTenderRecord } from '../lib/firestoreStore.ts';
import type {
  DiscoveryTenderItem,
  Organization,
  TenderRecord,
  UserProfile,
} from '../types/procurement.ts';
import type { NavSection } from './SidebarLayout.tsx';

interface DiscoverTendersViewProps {
  organization: Organization;
  userProfile: UserProfile;
  savedTenders: TenderRecord[];
  onNotify: (msg: string) => void;
  onError: (msg: string) => void;
  onOpenTender: (tenderId: string, nav: NavSection) => void;
}

export function DiscoverTendersView({
  organization,
  userProfile,
  savedTenders,
  onNotify,
  onError,
  onOpenTender,
}: DiscoverTendersViewProps) {
  const [q, setQ] = useState('');
  const [industry, setIndustry] = useState('all');
  const [location, setLocation] = useState('');
  const [maxBudget, setMaxBudget] = useState('');
  const [maxTurnover, setMaxTurnover] = useState('');
  const [deadlineBefore, setDeadlineBefore] = useState('');
  const [loading, setLoading] = useState(true);
  const [results, setResults] = useState<DiscoveryTenderItem[]>([]);
  const [integrations, setIntegrations] = useState<
    Array<{ portal: string; name: string; configured: boolean; mode: string; notes: string }>
  >([]);
  const [selectedItem, setSelectedItem] = useState<DiscoveryTenderItem | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);

  const runSearch = async () => {
    setLoading(true);
    try {
      const data = await fetchDiscoveryTenders({
        q,
        industry,
        location,
        maxBudget,
        maxTurnover,
        deadlineBefore,
      });
      setResults(data.tenders);
      setIntegrations(data.integrations);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Failed to load tender feed.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void runSearch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isAlreadySaved = (refNum: string) =>
    savedTenders.some((t) => t.referenceNumber.includes(refNum));

  const handleSaveToWorkspace = async (item: DiscoveryTenderItem) => {
    setSavingId(item.externalId);
    try {
      const newId = makeSafeId('tnd');
      await saveTenderRecord(organization, {
        id: newId,
        referenceNumber: `${item.referenceNumber} (DEMO DATA)`,
        title: item.title,
        authority: item.authority,
        department: item.department,
        location: item.location,
        industry: item.industry,
        sourceType: item.sourceType,
        sourcePortal: item.sourcePortal,
        estimatedValueLakhs: item.estimatedValueLakhs,
        emdAmountLakhs: item.emdAmountLakhs,
        tenderFeeInr: item.tenderFeeInr,
        deadlineDate: item.deadlineDate,
        publishDate: item.publishDate,
        status: 'Discovered',
        eligibilityStatus: 'Not Checked',
        assignedToUid: userProfile.uid,
        assignedToName: userProfile.displayName,
        reminderEnabled: false,
        summary: item.summary,
        isSaved: true,
        checklist: item.requiredCertifications.map((cert, idx) => ({
          id: `cert_${idx}`,
          label: `Attach ${cert} Certificate`,
          completed: false,
          required: true,
        })),
      });

      await logActivity(organization, {
        actorUid: userProfile.uid,
        actorName: userProfile.displayName,
        tenderId: newId,
        actionType: 'TENDER_SAVED',
        description: `Saved tender ${item.referenceNumber} from discovery feed.`,
      });

      onNotify(`Saved "${item.referenceNumber}" to My Tenders.`);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Failed to save tender.');
    } finally {
      setSavingId(null);
    }
  };

  const handleMatchCompanyTurnover = () => {
    if (organization.annualTurnoverLakhs) {
      setMaxTurnover(String(organization.annualTurnoverLakhs));
    }
  };

  return (
    <div className="space-y-6">
      {/* Portal Adapter Notice */}
      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-[#1A73E8] mb-1">
              <Globe2 className="w-4 h-4" />
              Procurement Portal Feed Architecture
            </div>
            <p className="text-sm text-[#5F6368]">
              Authorized connectors for GeM and CPPP/eProcure are supported via server-side API
              configuration. Unconfigured feeds display clearly labeled{' '}
              <strong className="text-[#202124]">DEMO DATA</strong> reference records without
              scraping restricted portals.
            </p>
          </div>
          <div className="flex flex-wrap gap-3 text-xs shrink-0">
            {integrations.map((intg) => (
              <div
                key={intg.portal}
                className="px-3 py-2 rounded-lg border border-[#DADCE0] bg-[#F8F9FA]"
              >
                <p className="font-semibold text-[#202124]">{intg.portal}</p>
                <p className={intg.configured ? 'text-[#1E8E3E]' : 'text-[#5F6368]'}>
                  {intg.mode}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
        <div className="grid md:grid-cols-12 gap-3">
          <div className="md:col-span-5 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && runSearch()}
              placeholder="Search tender title, authority, or reference number..."
              className="w-full pl-10 pr-3.5 py-2.5 text-sm border border-[#DADCE0] rounded-lg focus:outline-none focus:border-[#1A73E8]"
            />
          </div>
          <div className="md:col-span-3">
            <select
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
              className="w-full px-3 py-2.5 text-sm border border-[#DADCE0] rounded-lg bg-white"
            >
              <option value="all">All Industries</option>
              <option value="IT & Cybersecurity">IT &amp; Cybersecurity</option>
              <option value="Water & Smart Infrastructure">Water &amp; Smart Infrastructure</option>
              <option value="IT & Software Services">IT &amp; Software Services</option>
              <option value="Smart Mobility & AI">Smart Mobility &amp; AI</option>
              <option value="Renewable Energy & EPC">Renewable Energy &amp; EPC</option>
              <option value="Healthcare IT">Healthcare IT</option>
            </select>
          </div>
          <div className="md:col-span-2">
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Location (e.g. Pune)"
              className="w-full px-3 py-2.5 text-sm border border-[#DADCE0] rounded-lg"
            />
          </div>
          <div className="md:col-span-2 flex gap-2">
            <button
              type="button"
              onClick={runSearch}
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-[#1A73E8] text-white text-sm font-medium rounded-lg hover:bg-[#1557B0] whitespace-nowrap"
            >
              <Filter className="w-4 h-4" />
              Search
            </button>
          </div>
        </div>

        <div className="grid sm:grid-cols-4 gap-3 pt-2 border-t border-slate-100">
          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1">
              Max Budget (INR Lakhs)
            </label>
            <input
              type="number"
              value={maxBudget}
              onChange={(e) => setMaxBudget(e.target.value)}
              placeholder="e.g. 600"
              className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg font-mono tabular-nums"
            />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1">
              Max Turnover Req (INR Lakhs)
            </label>
            <div className="flex gap-1.5">
              <input
                type="number"
                value={maxTurnover}
                onChange={(e) => setMaxTurnover(e.target.value)}
                placeholder="e.g. 420"
                className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg font-mono tabular-nums"
              />
              {organization.annualTurnoverLakhs ? (
                <button
                  type="button"
                  onClick={handleMatchCompanyTurnover}
                  className="px-2.5 py-1.5 text-[11px] border border-slate-300 rounded-lg hover:bg-slate-50 whitespace-nowrap"
                >
                  My Fit
                </button>
              ) : null}
            </div>
          </div>
          <div>
            <label className="block text-[11px] font-medium text-slate-500 mb-1">
              Deadline Before
            </label>
            <input
              type="date"
              value={deadlineBefore}
              onChange={(e) => setDeadlineBefore(e.target.value)}
              className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-lg font-mono tabular-nums"
            />
          </div>
          <div className="flex items-end">
            <button
              type="button"
              onClick={() => {
                setQ('');
                setIndustry('all');
                setLocation('');
                setMaxBudget('');
                setMaxTurnover('');
                setDeadlineBefore('');
              }}
              className="text-xs text-slate-500 hover:text-slate-900 underline underline-offset-2 py-2"
            >
              Reset all filters
            </button>
          </div>
        </div>
      </div>

      {/* Results Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
          <h3 className="font-display text-base font-semibold text-slate-900">
            Matching Government Tenders
          </h3>
          <span className="text-xs font-mono tabular-nums text-slate-500">
            {results.length} records
          </span>
        </div>

        {loading ? (
          <div className="p-8 space-y-3">
            {[1, 2, 3].map((n) => (
              <div key={n} className="h-14 bg-slate-100 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : results.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-500">
            No tenders matched your active filter criteria. Try widening your budget or turnover
            threshold.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {results.map((item) => {
              const saved = isAlreadySaved(item.referenceNumber);
              return (
                <div
                  key={item.externalId}
                  className="p-5 hover:bg-slate-50/70 transition-colors flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                >
                  <div className="space-y-1.5 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                      <span className="font-mono font-medium text-slate-700">
                        {item.referenceNumber}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="font-medium text-amber-700">{item.sourcePortal}</span>
                      <span aria-hidden="true">·</span>
                      <span>{item.industry}</span>
                      <span aria-hidden="true">·</span>
                      <span>{item.location}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedItem(item)}
                      className="text-left font-display text-base font-semibold text-[#202124] hover:text-[#1A73E8] transition-colors"
                    >
                      {item.title}
                    </button>
                    <p className="text-xs text-[#5F6368]">
                      {item.authority} · {item.eligibilityHighlight}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-4 shrink-0">
                    <div className="text-right">
                      <p className="text-xs text-[#5F6368]">Est. Value</p>
                      <p className="font-mono tabular-nums text-sm font-semibold text-[#202124]">
                        INR {item.estimatedValueLakhs} L
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-[#5F6368]">Deadline</p>
                      <p className="font-mono tabular-nums text-sm font-medium text-[#3C4043]">
                        {item.deadlineDate}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedItem(item)}
                        className="px-3 py-2 text-xs font-medium border border-[#DADCE0] rounded-lg hover:bg-[#F1F3F4] text-[#3C4043] whitespace-nowrap"
                      >
                        Details
                      </button>
                      {saved ? (
                        <button
                          type="button"
                          onClick={() => {
                            const match = savedTenders.find((t) =>
                              t.referenceNumber.includes(item.referenceNumber),
                            );
                            if (match) onOpenTender(match.id, 'my_tenders');
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-[#E6F4EA] text-[#137333] border border-[#CEEAD6] rounded-lg whitespace-nowrap"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          In Workspace
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={savingId === item.externalId}
                          onClick={() => handleSaveToWorkspace(item)}
                          className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-[#1A73E8] text-white rounded-lg hover:bg-[#1557B0] whitespace-nowrap disabled:opacity-60"
                        >
                          <BookmarkPlus className="w-3.5 h-3.5" />
                          {savingId === item.externalId ? 'Saving...' : 'Save Tender'}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Tender Detail Slide-Over */}
      {selectedItem && (
        <div className="fixed inset-0 z-50 bg-[#202124]/40 flex justify-end">
          <div className="w-full max-w-xl bg-white h-full overflow-y-auto p-6 sm:p-8 flex flex-col justify-between border-l border-[#DADCE0]">
            <div className="space-y-5">
              <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-200">
                <div>
                  <p className="text-xs font-mono text-amber-700 font-medium">
                    {selectedItem.referenceNumber} · {selectedItem.sourcePortal}
                  </p>
                  <h3 className="font-display text-xl font-bold text-slate-900 mt-1">
                    {selectedItem.title}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedItem(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-800"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4 text-xs bg-slate-50 border border-slate-200 rounded-xl p-4">
                <div>
                  <p className="text-slate-500">Issuing Authority</p>
                  <p className="font-medium text-slate-900 mt-0.5">{selectedItem.authority}</p>
                </div>
                <div>
                  <p className="text-slate-500">Location</p>
                  <p className="font-medium text-slate-900 mt-0.5">{selectedItem.location}</p>
                </div>
                <div>
                  <p className="text-slate-500">Estimated Value</p>
                  <p className="font-mono tabular-nums font-semibold text-slate-900 mt-0.5">
                    INR {selectedItem.estimatedValueLakhs} Lakhs
                  </p>
                </div>
                <div>
                  <p className="text-slate-500">EMD Requirement</p>
                  <p className="font-mono tabular-nums font-semibold text-slate-900 mt-0.5">
                    {selectedItem.emdAmountLakhs === 0
                      ? 'Exempt / INR 0'
                      : `INR ${selectedItem.emdAmountLakhs} Lakhs`}
                  </p>
                </div>
                <div>
                  <p className="text-slate-500">Min Avg Turnover</p>
                  <p className="font-mono tabular-nums font-medium text-slate-900 mt-0.5">
                    INR {selectedItem.minTurnoverLakhs} Lakhs
                  </p>
                </div>
                <div>
                  <p className="text-slate-500">Submission Deadline</p>
                  <p className="font-mono tabular-nums font-semibold text-amber-700 mt-0.5">
                    {selectedItem.deadlineDate}
                  </p>
                </div>
              </div>

              <div>
                <h4 className="text-xs font-semibold text-slate-900 mb-1.5">Scope Summary</h4>
                <p className="text-sm text-slate-600 leading-relaxed">{selectedItem.summary}</p>
              </div>

              <div>
                <h4 className="text-xs font-semibold text-slate-900 mb-1.5">
                  Required Certifications
                </h4>
                <p className="text-sm text-slate-600">
                  {selectedItem.requiredCertifications.join(' · ')}
                </p>
              </div>
            </div>

            <div className="pt-6 border-t border-slate-200 flex items-center justify-between gap-3">
              <span className="text-xs text-slate-500 inline-flex items-center gap-1">
                <ExternalLink className="w-3.5 h-3.5" />
                Demo reference record
              </span>
              {!isAlreadySaved(selectedItem.referenceNumber) ? (
                <button
                  type="button"
                  onClick={() => handleSaveToWorkspace(selectedItem)}
                  className="px-4 py-2 bg-[#1A73E8] text-white text-sm font-medium rounded-lg hover:bg-[#1557B0]"
                >
                  Save to My Tenders
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    const match = savedTenders.find((t) =>
                      t.referenceNumber.includes(selectedItem.referenceNumber),
                    );
                    if (match) onOpenTender(match.id, 'eligibility');
                    setSelectedItem(null);
                  }}
                  className="px-4 py-2 bg-[#1A73E8] text-white text-sm font-medium rounded-lg hover:bg-[#1557B0]"
                >
                  Check Eligibility
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
