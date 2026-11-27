import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
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
import { EASE_OUT_EXPO, SPRING_SNAPPY } from './NeonPrimitives.tsx';

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
      <div className="neon-surface rounded-2xl p-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-[#8AB4F8] mb-1">
              <Globe2 className="w-4 h-4" />
              Procurement Portal Feed Architecture
            </div>
            <p className="text-sm text-[#A7B0C0]">
              Authorized connectors for GeM and CPPP/eProcure are supported via server-side API
              configuration. Unconfigured feeds display clearly labeled{' '}
              <strong className="text-white">DEMO DATA</strong> reference records without scraping
              restricted portals.
            </p>
          </div>
          <div className="flex flex-wrap gap-3 text-xs shrink-0">
            {integrations.map((intg) => (
              <div
                key={intg.portal}
                className="px-3.5 py-2 rounded-xl border border-white/10 bg-white/[0.03]"
              >
                <p className="font-semibold text-white">{intg.portal}</p>
                <p className={intg.configured ? 'text-[#4ADE80]' : 'text-[#9AA0A6]'}>
                  {intg.mode}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="neon-surface rounded-2xl p-5 space-y-4">
        <div className="grid md:grid-cols-12 gap-3">
          <div className="md:col-span-5 relative">
            <Search className="w-4 h-4 text-[#7B8499] absolute left-3.5 top-3" />
            <input
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && runSearch()}
              placeholder="Search tender title, authority, or reference number..."
              className="w-full pl-10 pr-3.5 py-2.5 text-sm neon-input rounded-xl"
            />
          </div>
          <div className="md:col-span-3">
            <select
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
              className="w-full px-3 py-2.5 text-sm neon-input rounded-xl"
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
              className="w-full px-3 py-2.5 text-sm neon-input rounded-xl"
            />
          </div>
          <div className="md:col-span-2 flex gap-2">
            <motion.button
              type="button"
              whileTap={{ scale: 0.97 }}
              onClick={runSearch}
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 neon-btn-primary text-sm font-medium rounded-xl whitespace-nowrap"
            >
              <Filter className="w-4 h-4" />
              Search
            </motion.button>
          </div>
        </div>

        <div className="grid sm:grid-cols-4 gap-3 pt-3 border-t border-white/[0.07]">
          <div>
            <label className="block text-[11px] font-medium text-[#9AA0A6] mb-1">
              Max Budget (INR Lakhs)
            </label>
            <input
              type="number"
              value={maxBudget}
              onChange={(e) => setMaxBudget(e.target.value)}
              placeholder="e.g. 600"
              className="w-full px-3 py-1.5 text-xs neon-input rounded-lg font-mono tabular-nums"
            />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-[#9AA0A6] mb-1">
              Max Turnover Req (INR Lakhs)
            </label>
            <div className="flex gap-1.5">
              <input
                type="number"
                value={maxTurnover}
                onChange={(e) => setMaxTurnover(e.target.value)}
                placeholder="e.g. 420"
                className="w-full px-3 py-1.5 text-xs neon-input rounded-lg font-mono tabular-nums"
              />
              {organization.annualTurnoverLakhs ? (
                <button
                  type="button"
                  onClick={handleMatchCompanyTurnover}
                  className="px-2.5 py-1.5 text-[11px] neon-btn-secondary rounded-lg whitespace-nowrap"
                >
                  My Fit
                </button>
              ) : null}
            </div>
          </div>
          <div>
            <label className="block text-[11px] font-medium text-[#9AA0A6] mb-1">
              Deadline Before
            </label>
            <input
              type="date"
              value={deadlineBefore}
              onChange={(e) => setDeadlineBefore(e.target.value)}
              className="w-full px-3 py-1.5 text-xs neon-input rounded-lg font-mono tabular-nums"
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
              className="text-xs text-[#9AA0A6] hover:text-[#8AB4F8] underline underline-offset-4 py-2 transition-colors"
            >
              Reset all filters
            </button>
          </div>
        </div>
      </div>

      {/* Results List */}
      <div className="neon-surface rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-white/[0.08] flex items-center justify-between">
          <h3 className="font-display text-base font-semibold text-white">
            Matching Government Tenders
          </h3>
          <span className="text-xs font-mono tabular-nums text-[#8AB4F8]">
            {results.length} records
          </span>
        </div>

        {loading ? (
          <div className="p-6 space-y-3">
            {[1, 2, 3].map((n) => (
              <div key={n} className="h-16 bg-white/[0.04] rounded-xl animate-pulse" />
            ))}
          </div>
        ) : results.length === 0 ? (
          <div className="p-10 text-center text-sm text-[#7B8499]">
            No tenders matched your active filter criteria. Try widening your budget or turnover
            threshold.
          </div>
        ) : (
          <div className="divide-y divide-white/[0.06]">
            {results.map((item) => {
              const saved = isAlreadySaved(item.referenceNumber);
              return (
                <div
                  key={item.externalId}
                  className="p-5 hover:bg-[#4285F4]/[0.06] transition-colors flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                >
                  <div className="space-y-1.5 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 text-xs text-[#9AA0A6]">
                      <span className="font-mono font-medium text-[#8AB4F8]">
                        {item.referenceNumber}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className="font-medium text-[#FCD34D]">{item.sourcePortal}</span>
                      <span aria-hidden="true">·</span>
                      <span>{item.industry}</span>
                      <span aria-hidden="true">·</span>
                      <span>{item.location}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedItem(item)}
                      className="text-left font-display text-base font-semibold text-white hover:text-[#8AB4F8] transition-colors"
                    >
                      {item.title}
                    </button>
                    <p className="text-xs text-[#A7B0C0]">
                      {item.authority} · {item.eligibilityHighlight}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-4 shrink-0">
                    <div className="text-right">
                      <p className="text-xs text-[#7B8499]">Est. Value</p>
                      <p className="font-mono tabular-nums text-sm font-semibold text-white">
                        INR {item.estimatedValueLakhs} L
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-[#7B8499]">Deadline</p>
                      <p className="font-mono tabular-nums text-sm font-medium text-[#FCD34D]">
                        {item.deadlineDate}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedItem(item)}
                        className="px-3 py-2 text-xs font-medium neon-btn-secondary rounded-lg whitespace-nowrap"
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
                          className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium bg-[#34A853]/18 text-[#4ADE80] border border-[#34A853]/40 rounded-lg whitespace-nowrap hover:bg-[#34A853]/28 transition-colors"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          In Workspace
                        </button>
                      ) : (
                        <motion.button
                          type="button"
                          whileTap={{ scale: 0.97 }}
                          disabled={savingId === item.externalId}
                          onClick={() => handleSaveToWorkspace(item)}
                          className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium neon-btn-primary rounded-lg whitespace-nowrap disabled:opacity-60"
                        >
                          <BookmarkPlus className="w-3.5 h-3.5" />
                          {savingId === item.externalId ? 'Saving...' : 'Save Tender'}
                        </motion.button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Tender Detail Spring Slide-Over */}
      <AnimatePresence>
        {selectedItem && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={() => setSelectedItem(null)}
            className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex justify-end"
          >
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={SPRING_SNAPPY}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-xl bg-[#0E121B] h-full overflow-y-auto p-6 sm:p-8 flex flex-col justify-between border-l border-white/12 shadow-[-20px_0_60px_rgba(0,0,0,0.85)]"
            >
              <div className="space-y-5">
                <div className="flex items-start justify-between gap-4 pb-4 border-b border-white/[0.08]">
                  <div>
                    <p className="text-xs font-mono text-[#FCD34D] font-medium">
                      {selectedItem.referenceNumber} · {selectedItem.sourcePortal}
                    </p>
                    <h3 className="font-display text-xl font-bold text-white mt-1">
                      {selectedItem.title}
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedItem(null)}
                    className="p-1.5 text-[#9AA0A6] hover:text-white transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-4 text-xs bg-white/[0.03] border border-white/[0.08] rounded-xl p-4">
                  <div>
                    <p className="text-[#7B8499]">Issuing Authority</p>
                    <p className="font-medium text-white mt-0.5">{selectedItem.authority}</p>
                  </div>
                  <div>
                    <p className="text-[#7B8499]">Location</p>
                    <p className="font-medium text-white mt-0.5">{selectedItem.location}</p>
                  </div>
                  <div>
                    <p className="text-[#7B8499]">Estimated Value</p>
                    <p className="font-mono tabular-nums font-semibold text-white mt-0.5">
                      INR {selectedItem.estimatedValueLakhs} Lakhs
                    </p>
                  </div>
                  <div>
                    <p className="text-[#7B8499]">EMD Requirement</p>
                    <p className="font-mono tabular-nums font-semibold text-white mt-0.5">
                      {selectedItem.emdAmountLakhs === 0
                        ? 'Exempt / INR 0'
                        : `INR ${selectedItem.emdAmountLakhs} Lakhs`}
                    </p>
                  </div>
                  <div>
                    <p className="text-[#7B8499]">Min Avg Turnover</p>
                    <p className="font-mono tabular-nums font-medium text-white mt-0.5">
                      INR {selectedItem.minTurnoverLakhs} Lakhs
                    </p>
                  </div>
                  <div>
                    <p className="text-[#7B8499]">Submission Deadline</p>
                    <p className="font-mono tabular-nums font-semibold text-[#FCD34D] mt-0.5">
                      {selectedItem.deadlineDate}
                    </p>
                  </div>
                </div>

                <div>
                  <h4 className="text-xs font-semibold text-white mb-1.5">Scope Summary</h4>
                  <p className="text-sm text-[#A7B0C0] leading-relaxed">{selectedItem.summary}</p>
                </div>

                <div>
                  <h4 className="text-xs font-semibold text-white mb-1.5">
                    Required Certifications
                  </h4>
                  <p className="text-sm text-[#A7B0C0]">
                    {selectedItem.requiredCertifications.join(' · ')}
                  </p>
                </div>
              </div>

              <div className="pt-6 border-t border-white/[0.08] flex items-center justify-between gap-3">
                <span className="text-xs text-[#7B8499] inline-flex items-center gap-1">
                  <ExternalLink className="w-3.5 h-3.5" />
                  Demo reference record
                </span>
                {!isAlreadySaved(selectedItem.referenceNumber) ? (
                  <button
                    type="button"
                    onClick={() => handleSaveToWorkspace(selectedItem)}
                    className="px-4 py-2 neon-btn-primary text-sm font-medium rounded-xl"
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
                    className="px-4 py-2 neon-btn-primary text-sm font-medium rounded-xl"
                  >
                    Check Eligibility
                  </button>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
