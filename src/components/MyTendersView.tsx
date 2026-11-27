import React, { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Bell,
  BellOff,
  CheckSquare,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';
import {
  createNotification,
  deleteTenderRecord,
  logActivity,
  makeSafeId,
  saveTenderRecord,
  updateTenderRecord,
} from '../lib/firestoreStore.ts';
import type {
  Organization,
  TeamMember,
  TenderRecord,
  TenderStatus,
  UserProfile,
} from '../types/procurement.ts';
import type { NavSection } from './SidebarLayout.tsx';
import { EASE_OUT_EXPO } from './NeonPrimitives.tsx';

const ALL_STATUSES: TenderStatus[] = [
  'Discovered',
  'Under Review',
  'Eligibility Checking',
  'Bid Preparation',
  'Internal Review',
  'Submitted',
  'Won',
  'Lost',
];

interface MyTendersViewProps {
  organization: Organization;
  userProfile: UserProfile;
  tenders: TenderRecord[];
  members: TeamMember[];
  selectedTenderId: string;
  onSelectTender: (tenderId: string, nav?: NavSection) => void;
  onNotify: (msg: string) => void;
  onError: (msg: string) => void;
}

export function MyTendersView({
  organization,
  userProfile,
  tenders,
  members,
  selectedTenderId,
  onSelectTender,
  onNotify,
  onError,
}: MyTendersViewProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | TenderStatus>('all');
  const [showCreate, setShowCreate] = useState(false);

  const [refNum, setRefNum] = useState('');
  const [title, setTitle] = useState('');
  const [authority, setAuthority] = useState('');
  const [industry, setIndustry] = useState(organization.industry || 'IT & Cybersecurity');
  const [budget, setBudget] = useState('250');
  const [emd, setEmd] = useState('5');
  const [deadline, setDeadline] = useState('2026-12-30');
  const [summary, setSummary] = useState('');

  const filtered = tenders.filter((t) => {
    if (statusFilter !== 'all' && t.status !== statusFilter) return false;
    if (
      searchTerm.trim() &&
      !`${t.title} ${t.referenceNumber} ${t.authority}`
        .toLowerCase()
        .includes(searchTerm.toLowerCase())
    ) {
      return false;
    }
    return true;
  });

  const activeTender =
    tenders.find((t) => t.id === selectedTenderId) || filtered[0] || tenders[0] || null;

  const handleStatusChange = async (tender: TenderRecord, newStatus: TenderStatus) => {
    try {
      await updateTenderRecord(organization.id, tender.id, { status: newStatus });
      await logActivity(organization, {
        actorUid: userProfile.uid,
        actorName: userProfile.displayName,
        tenderId: tender.id,
        actionType: 'STATUS_UPDATED',
        description: `Moved ${tender.referenceNumber} to "${newStatus}".`,
      });
      onNotify(`Updated status to ${newStatus}.`);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Failed to update status.');
    }
  };

  const handleAssigneeChange = async (tender: TenderRecord, memberUid: string) => {
    const member = members.find((m) => (m.uid || m.id) === memberUid);
    try {
      await updateTenderRecord(organization.id, tender.id, {
        assignedToUid: memberUid,
        assignedToName: member?.displayName || userProfile.displayName,
      });
      await logActivity(organization, {
        actorUid: userProfile.uid,
        actorName: userProfile.displayName,
        tenderId: tender.id,
        actionType: 'TENDER_ASSIGNED',
        description: `Assigned ${tender.referenceNumber} to ${member?.displayName || 'Team Member'}.`,
      });
      onNotify('Tender assignee updated.');
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Failed to update assignee.');
    }
  };

  const handleToggleReminder = async (tender: TenderRecord) => {
    const next = !tender.reminderEnabled;
    try {
      await updateTenderRecord(organization.id, tender.id, { reminderEnabled: next });
      if (next) {
        await createNotification(organization, {
          tenderId: tender.id,
          title: `Reminder Active: ${tender.referenceNumber}`,
          message: `Submission deadline tracked for ${tender.deadlineDate || 'upcoming date'}.`,
          severity: 'info',
        });
      }
      onNotify(next ? 'Deadline reminder enabled.' : 'Deadline reminder paused.');
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Failed to update reminder.');
    }
  };

  const handleToggleChecklist = async (tender: TenderRecord, itemId: string) => {
    const updated = (tender.checklist || []).map((c) =>
      c.id === itemId ? { ...c, completed: !c.completed } : c,
    );
    try {
      await updateTenderRecord(organization.id, tender.id, { checklist: updated });
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Failed to update checklist.');
    }
  };

  const handleCreateManualTender = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !refNum.trim() || !authority.trim()) return;
    try {
      const id = makeSafeId('tnd');
      await saveTenderRecord(organization, {
        id,
        referenceNumber: refNum.trim(),
        title: title.trim(),
        authority: authority.trim(),
        industry,
        sourceType: 'UPLOADED_PDF',
        sourcePortal: 'Manual Entry',
        estimatedValueLakhs: Number(budget) || 0,
        emdAmountLakhs: Number(emd) || 0,
        deadlineDate: deadline,
        status: 'Under Review',
        eligibilityStatus: 'Not Checked',
        assignedToUid: userProfile.uid,
        assignedToName: userProfile.displayName,
        reminderEnabled: true,
        summary: summary.trim(),
        isSaved: true,
        checklist: [
          { id: 'c1', label: 'Upload & Analyze Tender PDF', completed: false, required: true },
          { id: 'c2', label: 'Run Eligibility Verification', completed: false, required: true },
          { id: 'c3', label: 'Prepare Technical Proposal', completed: false, required: true },
        ],
      });
      await logActivity(organization, {
        actorUid: userProfile.uid,
        actorName: userProfile.displayName,
        tenderId: id,
        actionType: 'TENDER_CREATED',
        description: `Created tender ${refNum.trim()} manually.`,
      });
      setShowCreate(false);
      setRefNum('');
      setTitle('');
      setAuthority('');
      setSummary('');
      onSelectTender(id);
      onNotify('Tender added to workspace.');
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Failed to create tender.');
    }
  };

  const handleDelete = async (tender: TenderRecord) => {
    try {
      await deleteTenderRecord(organization.id, tender.id);
      onNotify(`Removed "${tender.referenceNumber}".`);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Failed to delete tender.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="neon-surface rounded-2xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3 flex-1">
          <div className="relative flex-1 min-w-[220px] max-w-md">
            <Search className="w-4 h-4 text-[#7B8499] absolute left-3.5 top-3" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Filter workspace tenders..."
              className="w-full pl-10 pr-3.5 py-2 text-sm neon-input rounded-xl"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'all' | TenderStatus)}
            className="px-3 py-2 text-sm neon-input rounded-xl"
          >
            <option value="all">All Statuses ({tenders.length})</option>
            {ALL_STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <motion.button
          type="button"
          whileTap={{ scale: 0.97 }}
          onClick={() => setShowCreate((v) => !v)}
          className="inline-flex items-center gap-2 px-4 py-2.5 neon-btn-primary text-sm font-medium rounded-xl whitespace-nowrap shrink-0"
        >
          <Plus className="w-4 h-4" />
          Add Tender Manually
        </motion.button>
      </div>

      <AnimatePresence>
        {showCreate && (
          <motion.form
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2, ease: EASE_OUT_EXPO }}
            onSubmit={handleCreateManualTender}
            className="neon-surface rounded-2xl p-6 space-y-4 border-[#4285F4]/35"
          >
            <h3 className="font-display text-base font-semibold text-white">New Tender Record</h3>
            <div className="grid sm:grid-cols-3 gap-4">
              <input
                type="text"
                required
                placeholder="Reference No (e.g. GEM/2026/B/102)"
                value={refNum}
                onChange={(e) => setRefNum(e.target.value)}
                className="px-3 py-2 text-sm neon-input rounded-xl font-mono"
              />
              <input
                type="text"
                required
                placeholder="Tender Title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="px-3 py-2 text-sm neon-input rounded-xl sm:col-span-2"
              />
            </div>
            <div className="grid sm:grid-cols-4 gap-4">
              <input
                type="text"
                required
                placeholder="Issuing Authority"
                value={authority}
                onChange={(e) => setAuthority(e.target.value)}
                className="px-3 py-2 text-sm neon-input rounded-xl"
              />
              <input
                type="text"
                placeholder="Industry"
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
                className="px-3 py-2 text-sm neon-input rounded-xl"
              />
              <input
                type="number"
                placeholder="Budget (INR Lakhs)"
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
                className="px-3 py-2 text-sm neon-input rounded-xl font-mono"
              />
              <input
                type="date"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                className="px-3 py-2 text-sm neon-input rounded-xl font-mono"
              />
            </div>
            <div className="grid sm:grid-cols-4 gap-4">
              <input
                type="number"
                placeholder="EMD (INR Lakhs)"
                value={emd}
                onChange={(e) => setEmd(e.target.value)}
                className="px-3 py-2 text-sm neon-input rounded-xl font-mono"
              />
              <input
                type="text"
                placeholder="Scope Summary"
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                className="px-3 py-2 text-sm neon-input rounded-xl sm:col-span-3"
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowCreate(false)}
                className="px-4 py-2 text-sm neon-btn-secondary rounded-xl"
              >
                Cancel
              </button>
              <button type="submit" className="px-4 py-2 text-sm neon-btn-primary rounded-xl">
                Save Tender
              </button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      {/* Workspace Split: Table + Selected Tender Control Panel */}
      <div className="grid xl:grid-cols-12 gap-6">
        <div className="xl:col-span-7 neon-surface rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-white/[0.08] flex items-center justify-between">
            <h3 className="font-display text-base font-semibold text-white">Tracked Tenders</h3>
            <span className="text-xs font-mono tabular-nums text-[#8AB4F8]">
              {filtered.length} active
            </span>
          </div>

          {filtered.length === 0 ? (
            <div className="p-10 text-center text-sm text-[#7B8499]">
              No tenders in workspace. Save tenders from Discover Tenders or upload a PDF.
            </div>
          ) : (
            <div className="divide-y divide-white/[0.06]">
              {filtered.map((t) => {
                const isSelected = activeTender?.id === t.id;
                return (
                  <div
                    key={t.id}
                    onClick={() => onSelectTender(t.id)}
                    className={`p-4 cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-[#4285F4]/14'
                        : 'hover:bg-white/[0.03]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs font-mono text-[#8AB4F8] truncate">
                          {t.referenceNumber} · {t.sourcePortal || t.sourceType}
                        </p>
                        <p className="font-medium text-sm text-white mt-0.5 line-clamp-2">
                          {t.title}
                        </p>
                        <p className="text-xs text-[#9AA0A6] mt-1">
                          {t.authority} · Deadline: {t.deadlineDate || 'TBD'} · Eligibility:{' '}
                          <span className="font-medium text-[#E8EAED]">
                            {t.eligibilityStatus || 'Not Checked'}
                          </span>
                        </p>
                      </div>
                      <select
                        value={t.status}
                        onClick={(e) => e.stopPropagation()}
                        onChange={(e) => handleStatusChange(t, e.target.value as TenderStatus)}
                        className="px-2.5 py-1.5 text-xs neon-input rounded-lg shrink-0"
                      >
                        {ALL_STATUSES.map((s) => (
                          <option key={s} value={s}>
                            {s}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="xl:col-span-5">
          {!activeTender ? (
            <div className="neon-surface rounded-2xl p-8 text-center text-sm text-[#7B8499]">
              Select a tender to manage team assignment, checklists, and AI copilot modules.
            </div>
          ) : (
            <motion.div
              key={activeTender.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, ease: EASE_OUT_EXPO }}
              className="neon-surface rounded-2xl p-6 space-y-5"
            >
              <div className="flex items-start justify-between gap-3 pb-4 border-b border-white/[0.08]">
                <div>
                  <p className="text-xs font-mono text-[#8AB4F8] font-medium">
                    {activeTender.referenceNumber}
                  </p>
                  <h3 className="font-display text-lg font-bold text-white mt-1">
                    {activeTender.title}
                  </h3>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleToggleReminder(activeTender)}
                    title="Toggle deadline reminder"
                    className={`p-2 rounded-lg border transition-colors ${
                      activeTender.reminderEnabled
                        ? 'border-[#4285F4]/45 bg-[#4285F4]/18 text-[#8AB4F8]'
                        : 'border-white/12 text-[#9AA0A6] hover:text-white'
                    }`}
                  >
                    {activeTender.reminderEnabled ? (
                      <Bell className="w-4 h-4" />
                    ) : (
                      <BellOff className="w-4 h-4" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(activeTender)}
                    title="Remove tender"
                    className="p-2 rounded-lg border border-white/12 text-[#9AA0A6] hover:text-[#F87171] hover:border-[#EA4335]/40 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block text-[#9AA0A6] mb-1">Assigned Bid Owner</label>
                  <select
                    value={activeTender.assignedToUid || userProfile.uid}
                    onChange={(e) => handleAssigneeChange(activeTender, e.target.value)}
                    className="w-full px-2.5 py-2 neon-input rounded-lg"
                  >
                    {members.length === 0 ? (
                      <option value={userProfile.uid}>{userProfile.displayName}</option>
                    ) : (
                      members.map((m) => (
                        <option key={m.id} value={m.uid || m.id}>
                          {m.displayName} ({m.role})
                        </option>
                      ))
                    )}
                  </select>
                </div>
                <div>
                  <label className="block text-[#9AA0A6] mb-1">Estimated Value / EMD</label>
                  <div className="px-3 py-2 border border-white/10 rounded-lg bg-white/[0.03] font-mono tabular-nums text-white">
                    INR {activeTender.estimatedValueLakhs ?? 0} L · EMD{' '}
                    {activeTender.emdAmountLakhs ?? 0} L
                  </div>
                </div>
              </div>

              <div>
                <h4 className="text-xs font-semibold text-white mb-2 flex items-center gap-1.5">
                  <CheckSquare className="w-3.5 h-3.5 text-[#4ADE80]" />
                  Submission Document Checklist
                </h4>
                {(activeTender.checklist || []).length === 0 ? (
                  <p className="text-xs text-[#7B8499]">No checklist items yet.</p>
                ) : (
                  <div className="space-y-2">
                    {(activeTender.checklist || []).map((chk) => (
                      <label
                        key={chk.id}
                        className="flex items-center gap-2.5 p-2.5 rounded-xl border border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.05] cursor-pointer text-xs transition-colors"
                      >
                        <input
                          type="checkbox"
                          checked={chk.completed}
                          onChange={() => handleToggleChecklist(activeTender, chk.id)}
                          className="rounded border-white/20 bg-[#0D1119] accent-[#34A853]"
                        />
                        <span
                          className={
                            chk.completed ? 'line-through text-[#7B8499]' : 'text-[#F1F3F4]'
                          }
                        >
                          {chk.label}
                        </span>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              <div className="pt-3 border-t border-white/[0.08]">
                <p className="text-xs font-semibold text-white mb-2.5">
                  Launch Copilot Module for this Tender
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => onSelectTender(activeTender.id, 'analyzer')}
                    className="px-3 py-2 text-xs font-medium neon-btn-secondary rounded-lg"
                  >
                    Document Analyzer
                  </button>
                  <button
                    type="button"
                    onClick={() => onSelectTender(activeTender.id, 'eligibility')}
                    className="px-3 py-2 text-xs font-medium neon-btn-secondary rounded-lg"
                  >
                    Eligibility Checker
                  </button>
                  <button
                    type="button"
                    onClick={() => onSelectTender(activeTender.id, 'coauthor')}
                    className="px-3 py-2 text-xs font-medium neon-btn-primary rounded-lg"
                  >
                    AI Bid Writer
                  </button>
                  <button
                    type="button"
                    onClick={() => onSelectTender(activeTender.id, 'financial')}
                    className="px-3 py-2 text-xs font-medium neon-btn-secondary rounded-lg"
                  >
                    Financial &amp; Risk
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}
