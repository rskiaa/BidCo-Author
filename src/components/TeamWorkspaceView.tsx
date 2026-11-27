import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Activity, Trash2, UserPlus, Users } from 'lucide-react';
import {
  deleteTeamMember,
  logActivity,
  makeSafeId,
  saveTeamMember,
  updateTeamMemberRole,
} from '../lib/firestoreStore.ts';
import type {
  ActivityLog,
  Organization,
  TeamMember,
  UserProfile,
  UserRole,
} from '../types/procurement.ts';

interface TeamWorkspaceViewProps {
  organization: Organization;
  userProfile: UserProfile;
  members: TeamMember[];
  activities: ActivityLog[];
  onNotify: (msg: string) => void;
  onError: (msg: string) => void;
}

export function TeamWorkspaceView({
  organization,
  userProfile,
  members,
  activities,
  onNotify,
  onError,
}: TeamWorkspaceViewProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [department, setDepartment] = useState('Bid & Proposals');
  const [role, setRole] = useState<UserRole>('bid_manager');
  const [adding, setAdding] = useState(false);

  const isOrgOwner = organization.ownerId === userProfile.uid;

  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) return;
    setAdding(true);
    try {
      const id = makeSafeId('mbr');
      await saveTeamMember(organization, {
        id,
        email: email.trim(),
        displayName: name.trim(),
        role,
        status: 'invited',
        department: department.trim(),
      });
      await logActivity(organization, {
        actorUid: userProfile.uid,
        actorName: userProfile.displayName,
        actionType: 'MEMBER_INVITED',
        description: `Added ${name.trim()} (${role}) to organization team roster.`,
      });
      setName('');
      setEmail('');
      onNotify(`Added ${name.trim()} to team roster.`);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Failed to add team member.');
    } finally {
      setAdding(false);
    }
  };

  const handleRoleUpdate = async (member: TeamMember, newRole: UserRole) => {
    try {
      await updateTeamMemberRole(organization.id, member.id, newRole);
      onNotify(`Updated ${member.displayName}'s role to ${newRole}.`);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Failed to update role.');
    }
  };

  const handleRemove = async (member: TeamMember) => {
    if (member.uid === organization.ownerId) {
      onError('Cannot remove the organization owner.');
      return;
    }
    try {
      await deleteTeamMember(organization.id, member.id);
      onNotify(`Removed ${member.displayName}.`);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Failed to remove team member.');
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid lg:grid-cols-12 gap-6">
        {/* Team Members & RBAC */}
        <div className="lg:col-span-7 space-y-6">
          <div className="neon-surface rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <UserPlus className="w-4 h-4 text-[#8AB4F8]" />
              <h2 className="font-display text-base font-bold text-white">
                Invite Team Member (RBAC)
              </h2>
            </div>

            {!isOrgOwner ? (
              <p className="text-xs text-[#9AA0A6]">
                Only the organization owner can invite or modify member permissions.
              </p>
            ) : (
              <form onSubmit={handleAddMember} className="grid sm:grid-cols-2 gap-3">
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Full Name"
                  className="px-3 py-2 text-sm neon-input rounded-xl"
                />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="colleague@company.in"
                  className="px-3 py-2 text-sm neon-input rounded-xl"
                />
                <input
                  type="text"
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  placeholder="Department (e.g. Finance, Technical)"
                  className="px-3 py-2 text-sm neon-input rounded-xl"
                />
                <div className="flex gap-2">
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value as UserRole)}
                    className="flex-1 px-3 py-2 text-sm neon-input rounded-xl"
                  >
                    <option value="bid_manager">Bid Manager</option>
                    <option value="reviewer">Reviewer</option>
                    <option value="viewer">Viewer</option>
                    <option value="admin">Admin</option>
                  </select>
                  <motion.button
                    type="submit"
                    whileTap={{ scale: 0.97 }}
                    disabled={adding}
                    className="px-4 py-2 neon-btn-primary text-sm font-medium rounded-xl whitespace-nowrap"
                  >
                    {adding ? 'Adding...' : 'Add'}
                  </motion.button>
                </div>
              </form>
            )}
          </div>

          <div className="neon-surface rounded-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-white/[0.08] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-[#4ADE80]" />
                <h3 className="font-display text-base font-semibold text-white">Team Directory</h3>
              </div>
              <span className="text-xs font-mono tabular-nums text-[#8AB4F8]">
                {members.length} members
              </span>
            </div>

            <div className="divide-y divide-white/[0.06]">
              {members.map((m) => (
                <div
                  key={m.id}
                  className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:bg-white/[0.025] transition-colors"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-white">{m.displayName}</p>
                    <p className="text-xs text-[#9AA0A6]">
                      {m.email} · {m.department || 'Procurement'} · {m.status}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <select
                      disabled={!isOrgOwner || m.uid === organization.ownerId}
                      value={m.role}
                      onChange={(e) => handleRoleUpdate(m, e.target.value as UserRole)}
                      className="px-2.5 py-1.5 text-xs neon-input rounded-lg disabled:opacity-60"
                    >
                      <option value="admin">Admin</option>
                      <option value="bid_manager">Bid Manager</option>
                      <option value="reviewer">Reviewer</option>
                      <option value="viewer">Viewer</option>
                    </select>
                    {isOrgOwner && m.uid !== organization.ownerId && (
                      <button
                        type="button"
                        onClick={() => handleRemove(m)}
                        className="p-1.5 text-[#9AA0A6] hover:text-[#F87171] transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Activity Audit Trail */}
        <div className="lg:col-span-5 neon-surface rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-white/[0.08] flex items-center gap-2">
            <Activity className="w-4 h-4 text-[#FCD34D]" />
            <h3 className="font-display text-base font-semibold text-white">
              Workspace Activity Trail
            </h3>
          </div>
          {activities.length === 0 ? (
            <div className="p-8 text-center text-sm text-[#7B8499]">
              No activity events logged yet.
            </div>
          ) : (
            <div className="divide-y divide-white/[0.06] max-h-[540px] overflow-y-auto">
              {activities.slice(0, 25).map((act) => (
                <div key={act.id} className="p-4 text-xs space-y-1 hover:bg-white/[0.02] transition-colors">
                  <div className="flex items-center justify-between text-[#9AA0A6]">
                    <span className="font-mono font-medium text-[#8AB4F8]">{act.actionType}</span>
                    <span>{act.actorName}</span>
                  </div>
                  <p className="text-sm text-[#E8EAED]">{act.description}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
