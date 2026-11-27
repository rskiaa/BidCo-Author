import React, { useState } from 'react';
import { Building2, Database, Save, UserCheck } from 'lucide-react';
import {
  seedDemoWorkspaceData,
  updateOrganizationProfile,
  updateUserProfileFields,
} from '../lib/firestoreStore.ts';
import type { Organization, UserProfile } from '../types/procurement.ts';

interface SettingsViewProps {
  organization: Organization;
  userProfile: UserProfile;
  onNotify: (msg: string) => void;
  onError: (msg: string) => void;
}

export function SettingsView({
  organization,
  userProfile,
  onNotify,
  onError,
}: SettingsViewProps) {
  const [orgName, setOrgName] = useState(organization.name);
  const [industry, setIndustry] = useState(organization.industry);
  const [businessCategory, setBusinessCategory] = useState(
    organization.businessCategory || 'MSME / Private Limited',
  );
  const [headquarters, setHeadquarters] = useState(organization.headquarters || '');
  const [registrationNumber, setRegistrationNumber] = useState(
    organization.registrationNumber || '',
  );
  const [gstin, setGstin] = useState(organization.gstin || '');
  const [panNumber, setPanNumber] = useState(organization.panNumber || '');
  const [udyamNumber, setUdyamNumber] = useState(organization.udyamNumber || '');
  const [yearsInOperation, setYearsInOperation] = useState(
    String(organization.yearsInOperation ?? 0),
  );
  const [annualTurnoverLakhs, setAnnualTurnoverLakhs] = useState(
    String(organization.annualTurnoverLakhs ?? 0),
  );
  const [netWorthLakhs, setNetWorthLakhs] = useState(String(organization.netWorthLakhs ?? 0));
  const [employeeCount, setEmployeeCount] = useState(String(organization.employeeCount ?? 0));
  const [certificationsText, setCertificationsText] = useState(
    (organization.certifications || []).join(', '),
  );
  const [capabilitiesSummary, setCapabilitiesSummary] = useState(
    organization.capabilitiesSummary || '',
  );
  const [pastProjectsSummary, setPastProjectsSummary] = useState(
    organization.pastProjectsSummary || '',
  );

  const [displayName, setDisplayName] = useState(userProfile.displayName);
  const [jobTitle, setJobTitle] = useState(userProfile.jobTitle || 'Bid Manager');
  const [savingOrg, setSavingOrg] = useState(false);
  const [savingUser, setSavingUser] = useState(false);
  const [seeding, setSeeding] = useState(false);

  const isOwner = organization.ownerId === userProfile.uid;

  const handleSaveOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingOrg(true);
    try {
      await updateOrganizationProfile(organization.id, {
        name: orgName.trim(),
        industry,
        businessCategory,
        headquarters: headquarters.trim(),
        registrationNumber: registrationNumber.trim(),
        gstin: gstin.trim(),
        panNumber: panNumber.trim(),
        udyamNumber: udyamNumber.trim(),
        yearsInOperation: Number(yearsInOperation) || 0,
        annualTurnoverLakhs: Number(annualTurnoverLakhs) || 0,
        netWorthLakhs: Number(netWorthLakhs) || 0,
        employeeCount: Number(employeeCount) || 0,
        certifications: certificationsText
          .split(',')
          .map((c) => c.trim())
          .filter(Boolean)
          .slice(0, 25),
        capabilitiesSummary: capabilitiesSummary.trim(),
        pastProjectsSummary: pastProjectsSummary.trim(),
      });
      onNotify('Company procurement profile saved.');
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Failed to update company profile.');
    } finally {
      setSavingOrg(false);
    }
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingUser(true);
    try {
      await updateUserProfileFields(userProfile.uid, {
        displayName: displayName.trim(),
        jobTitle: jobTitle.trim(),
      });
      onNotify('User profile updated.');
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Failed to update user profile.');
    } finally {
      setSavingUser(false);
    }
  };

  const handleLoadDemo = async () => {
    setSeeding(true);
    try {
      await seedDemoWorkspaceData(organization, userProfile.uid, userProfile.displayName);
      onNotify('Added sample DEMO DATA tender records to workspace.');
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Failed to load demo tenders.');
    } finally {
      setSeeding(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Company Profile Form */}
      <form
        onSubmit={handleSaveOrg}
        className="bg-white border border-slate-200 rounded-xl p-6 space-y-5"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-200">
          <div className="flex items-center gap-2.5">
            <Building2 className="w-5 h-5 text-[#1A73E8]" />
            <div>
              <h2 className="font-display text-base font-bold text-[#202124]">
                Company Profile &amp; Procurement Credentials
              </h2>
              <p className="text-xs text-[#5F6368]">
                Used automatically by Eligibility Checker and AI Bid Writer.
              </p>
            </div>
          </div>
          <button
            type="submit"
            disabled={!isOwner || savingOrg}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#1A73E8] text-white text-sm font-medium rounded-lg hover:bg-[#1557B0] disabled:opacity-60"
          >
            <Save className="w-4 h-4" />
            {savingOrg ? 'Saving...' : 'Save Company Profile'}
          </button>
        </div>

        <div className="grid sm:grid-cols-3 gap-4 text-xs">
          <div>
            <label className="block text-slate-600 font-medium mb-1">Company Legal Name</label>
            <input
              type="text"
              required
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-slate-600 font-medium mb-1">Industry</label>
            <input
              type="text"
              required
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-slate-600 font-medium mb-1">Business Category</label>
            <input
              type="text"
              value={businessCategory}
              onChange={(e) => setBusinessCategory(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
            />
          </div>
        </div>

        <div className="grid sm:grid-cols-4 gap-4 text-xs">
          <div>
            <label className="block text-slate-600 font-medium mb-1">Headquarters</label>
            <input
              type="text"
              value={headquarters}
              onChange={(e) => setHeadquarters(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-slate-600 font-medium mb-1">CIN / Reg No.</label>
            <input
              type="text"
              value={registrationNumber}
              onChange={(e) => setRegistrationNumber(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono"
            />
          </div>
          <div>
            <label className="block text-slate-600 font-medium mb-1">GSTIN</label>
            <input
              type="text"
              value={gstin}
              onChange={(e) => setGstin(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono"
            />
          </div>
          <div>
            <label className="block text-slate-600 font-medium mb-1">PAN / Udyam MSME</label>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="PAN"
                value={panNumber}
                onChange={(e) => setPanNumber(e.target.value)}
                className="w-1/2 px-2.5 py-2 text-sm border border-slate-300 rounded-lg font-mono"
              />
              <input
                type="text"
                placeholder="Udyam"
                value={udyamNumber}
                onChange={(e) => setUdyamNumber(e.target.value)}
                className="w-1/2 px-2.5 py-2 text-sm border border-slate-300 rounded-lg font-mono"
              />
            </div>
          </div>
        </div>

        <div className="grid sm:grid-cols-4 gap-4 text-xs">
          <div>
            <label className="block text-slate-600 font-medium mb-1">Years in Operation</label>
            <input
              type="number"
              value={yearsInOperation}
              onChange={(e) => setYearsInOperation(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono tabular-nums"
            />
          </div>
          <div>
            <label className="block text-slate-600 font-medium mb-1">
              Annual Turnover (INR Lakhs)
            </label>
            <input
              type="number"
              step="0.1"
              value={annualTurnoverLakhs}
              onChange={(e) => setAnnualTurnoverLakhs(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono tabular-nums"
            />
          </div>
          <div>
            <label className="block text-slate-600 font-medium mb-1">Net Worth (INR Lakhs)</label>
            <input
              type="number"
              step="0.1"
              value={netWorthLakhs}
              onChange={(e) => setNetWorthLakhs(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono tabular-nums"
            />
          </div>
          <div>
            <label className="block text-slate-600 font-medium mb-1">Employee Count</label>
            <input
              type="number"
              value={employeeCount}
              onChange={(e) => setEmployeeCount(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono tabular-nums"
            />
          </div>
        </div>

        <div className="text-xs">
          <label className="block text-slate-600 font-medium mb-1">
            Certifications (comma-separated)
          </label>
          <input
            type="text"
            value={certificationsText}
            onChange={(e) => setCertificationsText(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
          />
        </div>

        <div className="grid sm:grid-cols-2 gap-4 text-xs">
          <div>
            <label className="block text-slate-600 font-medium mb-1">Capabilities Summary</label>
            <textarea
              rows={3}
              value={capabilitiesSummary}
              onChange={(e) => setCapabilitiesSummary(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-slate-600 font-medium mb-1">
              Past Government / Enterprise Projects
            </label>
            <textarea
              rows={3}
              value={pastProjectsSummary}
              onChange={(e) => setPastProjectsSummary(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
            />
          </div>
        </div>
      </form>

      {/* User Profile + Demo Data Tools */}
      <div className="grid lg:grid-cols-2 gap-6">
        <form
          onSubmit={handleSaveUser}
          className="bg-white border border-slate-200 rounded-xl p-6 space-y-4"
        >
          <div className="flex items-center gap-2 pb-3 border-b border-[#E8EAED]">
            <UserCheck className="w-4 h-4 text-[#1A73E8]" />
            <h3 className="font-display text-base font-semibold text-[#202124]">Your Profile</h3>
          </div>
          <div className="grid sm:grid-cols-2 gap-3 text-xs">
            <div>
              <label className="block text-[#5F6368] font-medium mb-1">Display Name</label>
              <input
                type="text"
                required
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-[#DADCE0] rounded-lg"
              />
            </div>
            <div>
              <label className="block text-[#5F6368] font-medium mb-1">Job Title</label>
              <input
                type="text"
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-[#DADCE0] rounded-lg"
              />
            </div>
          </div>
          <p className="text-xs text-[#5F6368]">
            Email: {userProfile.email} · Role: {userProfile.role}
          </p>
          <button
            type="submit"
            disabled={savingUser}
            className="px-4 py-2 bg-[#1A73E8] text-white text-xs font-medium rounded-lg hover:bg-[#1557B0]"
          >
            {savingUser ? 'Updating...' : 'Save User Profile'}
          </button>
        </form>

        <div className="bg-white border border-[#DADCE0] rounded-xl p-6 space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-[#E8EAED]">
            <Database className="w-4 h-4 text-[#1A73E8]" />
            <h3 className="font-display text-base font-semibold text-[#202124]">
              Demonstration &amp; Portal Environment
            </h3>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            Seed clearly labeled <strong>DEMO DATA</strong> tender records and sample analyses into
            your workspace to demonstrate end-to-end workflows, or configure GeM / CPPP / Document
            AI environment variables on the server for live authorized portal feeds.
          </p>
          <button
            type="button"
            disabled={seeding}
            onClick={handleLoadDemo}
            className="px-4 py-2 border border-slate-300 text-slate-800 text-xs font-medium rounded-lg hover:bg-slate-50"
          >
            {seeding ? 'Loading...' : 'Load Sample DEMO DATA Tenders'}
          </button>
        </div>
      </div>
    </div>
  );
}
