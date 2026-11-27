import React, { useEffect, useState } from 'react';
import { onAuthStateChanged, signOut, type User } from 'firebase/auth';
import { CheckCircle2, AlertTriangle, X } from 'lucide-react';
import { auth } from './lib/firebase.ts';
import {
  markNotificationRead,
  subscribeOrgSubcollection,
  subscribeOrganization,
  syncUserProfile,
} from './lib/firestoreStore.ts';
import type {
  ActivityLog,
  EligibilityAssessment,
  FinancialAnalysis,
  GeneratedProposal,
  NotificationItem,
  Organization,
  RiskReport,
  TeamMember,
  TenderAnalysis,
  TenderDocument,
  TenderRecord,
  UserProfile,
} from './types/procurement.ts';
import {
  AuthScreen,
  EmailVerifyGate,
  OrganizationOnboarding,
} from './components/AuthAndOnboarding.tsx';
import { SidebarLayout, type NavSection } from './components/SidebarLayout.tsx';
import { DashboardView } from './components/DashboardView.tsx';
import { DiscoverTendersView } from './components/DiscoverTendersView.tsx';
import { MyTendersView } from './components/MyTendersView.tsx';
import { DocumentAnalyzerView } from './components/DocumentAnalyzerView.tsx';
import { EligibilityCheckerView } from './components/EligibilityCheckerView.tsx';
import { ProposalCoAuthorView } from './components/ProposalCoAuthorView.tsx';
import { FinancialIntelligenceView } from './components/FinancialIntelligenceView.tsx';
import { RiskAnalysisView } from './components/RiskAnalysisView.tsx';
import { DocumentsVaultView } from './components/DocumentsVaultView.tsx';
import { TeamWorkspaceView } from './components/TeamWorkspaceView.tsx';
import { SettingsView } from './components/SettingsView.tsx';

export default function App() {
  const [authReady, setAuthReady] = useState(false);
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [orgLoading, setOrgLoading] = useState(false);

  const [activeNav, setActiveNav] = useState<NavSection>('dashboard');
  const [selectedTenderId, setSelectedTenderId] = useState<string>('');

  // Live Organization Collections
  const [tenders, setTenders] = useState<TenderRecord[]>([]);
  const [documents, setDocuments] = useState<TenderDocument[]>([]);
  const [analyses, setAnalyses] = useState<TenderAnalysis[]>([]);
  const [eligibilities, setEligibilities] = useState<EligibilityAssessment[]>([]);
  const [proposals, setProposals] = useState<GeneratedProposal[]>([]);
  const [financials, setFinancials] = useState<FinancialAnalysis[]>([]);
  const [risks, setRisks] = useState<RiskReport[]>([]);
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [activities, setActivities] = useState<ActivityLog[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);

  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const showNotice = (message: string) => {
    setToast({ type: 'success', message });
  };
  const showError = (message: string) => {
    setToast({ type: 'error', message });
  };

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(t);
  }, [toast]);

  // Listen to Firebase Auth state
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (user) => {
      setFirebaseUser(user);
      if (!user) {
        setUserProfile(null);
        setOrganization(null);
        setAuthReady(true);
        return;
      }

      if (!user.emailVerified) {
        setAuthReady(true);
        return;
      }

      try {
        setOrgLoading(true);
        const profile = await syncUserProfile({
          uid: user.uid,
          email: user.email || '',
          displayName: user.displayName || user.email?.split('@')[0] || 'User',
        });
        setUserProfile(profile);
      } catch (err) {
        showError(err instanceof Error ? err.message : 'Failed to load user profile.');
      } finally {
        setOrgLoading(false);
        setAuthReady(true);
      }
    });
    return () => unsub();
  }, []);

  // Subscribe to Organization & all subcollections when userProfile.orgId is set
  useEffect(() => {
    if (!firebaseUser || !firebaseUser.emailVerified || !userProfile?.orgId) {
      setOrganization(null);
      return;
    }

    const orgId = userProfile.orgId;
    const uid = firebaseUser.uid;
    const unsubs = [
      subscribeOrganization(orgId, (org) => setOrganization(org)),
      subscribeOrgSubcollection<TenderRecord>(orgId, 'tenders', uid, setTenders),
      subscribeOrgSubcollection<TenderDocument>(orgId, 'documents', uid, setDocuments),
      subscribeOrgSubcollection<TenderAnalysis>(orgId, 'analyses', uid, setAnalyses),
      subscribeOrgSubcollection<EligibilityAssessment>(orgId, 'eligibilities', uid, setEligibilities),
      subscribeOrgSubcollection<GeneratedProposal>(orgId, 'proposals', uid, setProposals),
      subscribeOrgSubcollection<FinancialAnalysis>(orgId, 'financials', uid, setFinancials),
      subscribeOrgSubcollection<RiskReport>(orgId, 'risks', uid, setRisks),
      subscribeOrgSubcollection<TeamMember>(orgId, 'members', uid, setMembers),
      subscribeOrgSubcollection<ActivityLog>(orgId, 'activities', uid, (items) =>
        setActivities([...items].reverse()),
      ),
      subscribeOrgSubcollection<NotificationItem>(orgId, 'notifications', uid, setNotifications),
    ];

    return () => {
      for (const u of unsubs) u();
    };
  }, [firebaseUser, userProfile?.orgId]);

  const handleSelectTender = (tenderId: string, nav?: NavSection) => {
    setSelectedTenderId(tenderId);
    if (nav) setActiveNav(nav);
  };

  if (!authReady || orgLoading) {
    return (
      <div className="min-h-screen bg-[#F8F9FA] flex items-center justify-center">
        <div className="flex items-center gap-3 text-sm text-[#5F6368]">
          <div className="w-5 h-5 border-2 border-[#1A73E8] border-t-transparent rounded-full animate-spin" />
          Loading Bid Tender Writer workspace...
        </div>
      </div>
    );
  }

  if (!firebaseUser) {
    return (
      <>
        {toast && <ToastBanner toast={toast} onClose={() => setToast(null)} />}
        <AuthScreen onError={showError} />
      </>
    );
  }

  if (!firebaseUser.emailVerified) {
    return (
      <>
        {toast && <ToastBanner toast={toast} onClose={() => setToast(null)} />}
        <EmailVerifyGate
          email={firebaseUser.email || ''}
          onError={showError}
          onRefresh={async () => {
            await firebaseUser.reload();
            if (auth.currentUser?.emailVerified) {
              const profile = await syncUserProfile({
                uid: auth.currentUser.uid,
                email: auth.currentUser.email || '',
                displayName: auth.currentUser.displayName || 'User',
              });
              setUserProfile(profile);
            } else {
              showError('Email is still marked unverified. Please click the link in your inbox.');
            }
          }}
        />
      </>
    );
  }

  if (!userProfile?.orgId || !organization) {
    return (
      <>
        {toast && <ToastBanner toast={toast} onClose={() => setToast(null)} />}
        {userProfile ? (
          <OrganizationOnboarding
            userProfile={userProfile}
            onError={showError}
            onComplete={(org) => {
              setUserProfile((prev) => (prev ? { ...prev, orgId: org.id } : prev));
              setOrganization(org);
              showNotice(`Workspace "${org.name}" ready.`);
            }}
          />
        ) : null}
      </>
    );
  }

  return (
    <>
      {toast && <ToastBanner toast={toast} onClose={() => setToast(null)} />}
      <SidebarLayout
        activeNav={activeNav}
        onSelectNav={setActiveNav}
        organization={organization}
        userProfile={userProfile}
        notifications={notifications}
        onMarkNotificationRead={(id) =>
          markNotificationRead(organization.id, id).catch((e) => showError(e.message))
        }
        onSignOut={() => signOut(auth)}
      >
        {activeNav === 'dashboard' && (
          <DashboardView
            organization={organization}
            tenders={tenders}
            analyses={analyses}
            eligibilities={eligibilities}
            proposals={proposals}
            risks={risks}
            onNavigate={setActiveNav}
            onSelectTender={handleSelectTender}
          />
        )}

        {activeNav === 'discover' && (
          <DiscoverTendersView
            organization={organization}
            userProfile={userProfile}
            savedTenders={tenders}
            onNotify={showNotice}
            onError={showError}
            onOpenTender={handleSelectTender}
          />
        )}

        {activeNav === 'my_tenders' && (
          <MyTendersView
            organization={organization}
            userProfile={userProfile}
            tenders={tenders}
            members={members}
            selectedTenderId={selectedTenderId}
            onSelectTender={handleSelectTender}
            onNotify={showNotice}
            onError={showError}
          />
        )}

        {activeNav === 'analyzer' && (
          <DocumentAnalyzerView
            organization={organization}
            userProfile={userProfile}
            tenders={tenders}
            analyses={analyses}
            documents={documents}
            selectedTenderId={selectedTenderId}
            onSelectTender={(id) => setSelectedTenderId(id)}
            onNotify={showNotice}
            onError={showError}
          />
        )}

        {activeNav === 'eligibility' && (
          <EligibilityCheckerView
            organization={organization}
            userProfile={userProfile}
            tenders={tenders}
            analyses={analyses}
            eligibilities={eligibilities}
            selectedTenderId={selectedTenderId}
            onSelectTender={(id) => setSelectedTenderId(id)}
            onNotify={showNotice}
            onError={showError}
          />
        )}

        {activeNav === 'coauthor' && (
          <ProposalCoAuthorView
            organization={organization}
            userProfile={userProfile}
            tenders={tenders}
            analyses={analyses}
            proposals={proposals}
            selectedTenderId={selectedTenderId}
            onSelectTender={(id) => setSelectedTenderId(id)}
            onNotify={showNotice}
            onError={showError}
          />
        )}

        {activeNav === 'financial' && (
          <FinancialIntelligenceView
            organization={organization}
            userProfile={userProfile}
            tenders={tenders}
            financials={financials}
            selectedTenderId={selectedTenderId}
            onSelectTender={(id) => setSelectedTenderId(id)}
            onNotify={showNotice}
            onError={showError}
          />
        )}

        {activeNav === 'risk' && (
          <RiskAnalysisView
            organization={organization}
            userProfile={userProfile}
            tenders={tenders}
            analyses={analyses}
            risks={risks}
            selectedTenderId={selectedTenderId}
            onSelectTender={(id) => setSelectedTenderId(id)}
            onNotify={showNotice}
            onError={showError}
          />
        )}

        {activeNav === 'documents' && (
          <DocumentsVaultView
            organization={organization}
            documents={documents}
            proposals={proposals}
            tenders={tenders}
            onOpenTender={handleSelectTender}
            onError={showError}
          />
        )}

        {activeNav === 'team' && (
          <TeamWorkspaceView
            organization={organization}
            userProfile={userProfile}
            members={members}
            activities={activities}
            onNotify={showNotice}
            onError={showError}
          />
        )}

        {activeNav === 'settings' && (
          <SettingsView
            organization={organization}
            userProfile={userProfile}
            onNotify={showNotice}
            onError={showError}
          />
        )}
      </SidebarLayout>
    </>
  );
}

function ToastBanner({
  toast,
  onClose,
}: {
  toast: { type: 'success' | 'error'; message: string };
  onClose: () => void;
}) {
  return (
    <div className="fixed bottom-5 right-5 z-50 max-w-md w-full sm:w-auto">
      <div
        className={`flex items-start gap-3 px-4 py-3 rounded-xl shadow-lg border text-xs font-medium ${
          toast.type === 'error'
            ? 'bg-[#FCE8E6] text-[#A50E0E] border-[#F6AEA9]'
            : 'bg-[#202124] text-white border-[#3C4043]'
        }`}
      >
        {toast.type === 'error' ? (
          <AlertTriangle className="w-4 h-4 text-[#D93025] shrink-0 mt-0.5" />
        ) : (
          <CheckCircle2 className="w-4 h-4 text-[#34A853] shrink-0 mt-0.5" />
        )}
        <p className="leading-relaxed flex-1">{toast.message}</p>
        <button
          type="button"
          onClick={onClose}
          className={`shrink-0 ${
            toast.type === 'error'
              ? 'text-[#A50E0E]/70 hover:text-[#A50E0E]'
              : 'text-[#9AA0A6] hover:text-white'
          }`}
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
