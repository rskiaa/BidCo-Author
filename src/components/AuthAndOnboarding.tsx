import React, { useState } from 'react';
import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
} from 'firebase/auth';
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  KeyRound,
  Mail,
} from 'lucide-react';
import { auth, googleAuthProvider } from '../lib/firebase.ts';
import {
  createOrganizationAndProfile,
  seedDemoWorkspaceData,
} from '../lib/firestoreStore.ts';
import type { Organization, UserProfile } from '../types/procurement.ts';
import { GoogleBrandMark } from './SidebarLayout.tsx';

interface AuthScreenProps {
  onError: (msg: string) => void;
}

export function AuthScreen({ onError }: AuthScreenProps) {
  const [mode, setMode] = useState<'login' | 'signup' | 'forgot'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  const [infoMessage, setInfoMessage] = useState('');
  const [imgFailed, setImgFailed] = useState(false);

  const handleGoogleSignIn = async () => {
    setLoading(true);
    setInfoMessage('');
    try {
      await signInWithPopup(auth, googleAuthProvider);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Google sign-in failed.';
      onError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setInfoMessage('');
    try {
      if (mode === 'forgot') {
        await sendPasswordResetEmail(auth, email.trim());
        setInfoMessage('Password reset email sent. Check your inbox to reset your password.');
      } else if (mode === 'signup') {
        const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
        if (displayName.trim()) {
          await updateProfile(cred.user, { displayName: displayName.trim() });
        }
        await sendEmailVerification(cred.user);
        setInfoMessage(
          'Account created. A verification link has been sent to your email address. Please verify your email before accessing workspace data.',
        );
      } else {
        await signInWithEmailAndPassword(auth, email.trim(), password);
      }
    } catch (err: unknown) {
      const code = (err as { code?: string })?.code || '';
      if (code === 'auth/operation-not-allowed') {
        onError(
          'Email/Password sign-in is not yet enabled in this Firebase project. Enable Email/Password in Firebase Console > Authentication > Sign-in method, or use Google Sign-In above.',
        );
      } else {
        onError(err instanceof Error ? err.message : 'Authentication failed.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-[#202124] flex flex-col">
      <div className="h-[3px] w-full flex shrink-0">
        <div className="flex-1 bg-[#4285F4]" />
        <div className="flex-1 bg-[#EA4335]" />
        <div className="flex-1 bg-[#FBBC04]" />
        <div className="flex-1 bg-[#34A853]" />
      </div>

      <div className="flex-1 grid lg:grid-cols-12">
        {/* Left Brand & Workspace Showcase (Clean Google Light Surface) */}
        <div className="lg:col-span-6 relative flex flex-col justify-between p-8 lg:p-12 overflow-hidden bg-[#F8F9FA] border-b lg:border-b-0 lg:border-r border-[#DADCE0]">
          <div className="relative z-10 flex items-center gap-3">
            <GoogleBrandMark size={36} />
            <span className="font-display text-lg font-bold tracking-tight text-[#202124]">
              Bid Tender Writer
            </span>
          </div>

          <div className="relative z-10 max-w-xl my-10 space-y-6">
            <div>
              <p className="text-xs font-semibold tracking-wider uppercase text-[#1A73E8] mb-2.5">
                Government Procurement Intelligence
              </p>
              <h1 className="font-display text-3xl lg:text-4xl font-bold tracking-tight text-[#202124] leading-tight mb-3">
                Write Compliant Government Tenders Faster.
              </h1>
              <p className="text-[#5F6368] text-base leading-relaxed">
                Parse complex tender RFPs with page-cited evidence, evaluate eligibility against
                your company credentials, model financial margins, and draft compliant technical
                proposals in one clean workspace.
              </p>
            </div>

            {!imgFailed && (
              <div className="rounded-xl overflow-hidden border border-[#DADCE0] bg-white h-44 relative">
                <img
                  src="/src/assets/images/auth_procurement_banner_1795758584396.jpg"
                  alt="Government civic architecture"
                  referrerPolicy="no-referrer"
                  onError={() => setImgFailed(true)}
                  className="w-full h-full object-cover opacity-90"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#202124]/60 via-transparent to-transparent" />
                <p className="absolute bottom-3 left-4 text-xs font-medium text-white">
                  Public Sector RFP Analysis &amp; Bid Authoring Suite
                </p>
              </div>
            )}

            <div className="grid sm:grid-cols-2 gap-3.5 pt-4 border-t border-[#DADCE0] text-sm text-[#3C4043]">
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-[#1A73E8] shrink-0 mt-0.5" />
                <span>Page-cited PDF extraction &amp; vector RAG search</span>
              </div>
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-[#34A853] shrink-0 mt-0.5" />
                <span>Evidence-based eligibility &amp; gap verification</span>
              </div>
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-[#F9AB00] shrink-0 mt-0.5" />
                <span>Versioned proposal studio with DOCX &amp; PDF export</span>
              </div>
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-[#EA4335] shrink-0 mt-0.5" />
                <span>Financial margin &amp; contract risk intelligence</span>
              </div>
            </div>
          </div>

          <div className="relative z-10 text-xs text-[#5F6368] flex items-center justify-between">
            <span>Enterprise Procurement &amp; Bid Operations</span>
            <span>Human-in-the-loop submission control</span>
          </div>
        </div>

        {/* Right Authentication Form */}
        <div className="lg:col-span-6 bg-white text-[#202124] flex items-center justify-center p-6 sm:p-12">
          <div className="w-full max-w-md">
            <div className="mb-8">
              <h2 className="font-display text-2xl font-bold text-[#202124] mb-1.5">
                {mode === 'login' && 'Sign in to Bid Tender Writer'}
                {mode === 'signup' && 'Create your procurement account'}
                {mode === 'forgot' && 'Reset your password'}
              </h2>
              <p className="text-sm text-[#5F6368]">
                {mode === 'login' && 'Access your organization tenders, analyses, and bid drafts.'}
                {mode === 'signup' &&
                  'Register to manage tenders and company eligibility credentials.'}
                {mode === 'forgot' && 'Enter your registered email to receive a reset link.'}
              </p>
            </div>

            {infoMessage && (
              <div className="mb-5 p-3.5 rounded-lg bg-[#E8F0FE] border border-[#D2E3FC] text-sm text-[#174EA6]">
                {infoMessage}
              </div>
            )}

            {mode !== 'forgot' && (
              <>
                <button
                  type="button"
                  disabled={loading}
                  onClick={handleGoogleSignIn}
                  className="w-full flex items-center justify-center gap-3 px-4 py-2.5 rounded-lg border border-[#DADCE0] bg-white text-[#3C4043] font-medium text-sm hover:bg-[#F8F9FA] transition-colors disabled:opacity-60"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24" aria-hidden="true">
                    <path
                      fill="#4285F4"
                      d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17Z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.11-6.72-4.96H1.29v3.14C3.26 21.3 7.31 24 12 24Z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.28 14.24c-.24-.72-.38-1.49-.38-2.24s.14-1.52.38-2.24V6.62H1.29C.47 8.24 0 10.06 0 12s.47 3.76 1.29 5.38l3.99-3.14Z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.29 6.62l3.99 3.14c.95-2.85 3.6-4.96 6.72-4.96Z"
                    />
                  </svg>
                  Continue with Google
                </button>

                <div className="my-6 flex items-center gap-3 text-xs text-[#80868B]">
                  <div className="flex-1 h-px bg-[#E8EAED]" />
                  <span>or use email &amp; password</span>
                  <div className="flex-1 h-px bg-[#E8EAED]" />
                </div>
              </>
            )}

            <form onSubmit={handleEmailSubmit} className="space-y-4">
              {mode === 'signup' && (
                <div>
                  <label className="block text-xs font-medium text-[#3C4043] mb-1.5">
                    Full Name
                  </label>
                  <input
                    type="text"
                    required
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Aarav Mehta"
                    className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-[#DADCE0] focus:outline-none focus:ring-2 focus:ring-[#1A73E8]/20 focus:border-[#1A73E8]"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-[#3C4043] mb-1.5">
                  Work Email
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-[#80868B] absolute left-3.5 top-3" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="procurement@company.in"
                    className="w-full pl-10 pr-3.5 py-2.5 text-sm rounded-lg border border-[#DADCE0] focus:outline-none focus:ring-2 focus:ring-[#1A73E8]/20 focus:border-[#1A73E8]"
                  />
                </div>
              </div>

              {mode !== 'forgot' && (
                <div>
                  <label className="block text-xs font-medium text-[#3C4043] mb-1.5">
                    Password
                  </label>
                  <div className="relative">
                    <KeyRound className="w-4 h-4 text-[#80868B] absolute left-3.5 top-3" />
                    <input
                      type="password"
                      required
                      minLength={6}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Minimum 6 characters"
                      className="w-full pl-10 pr-3.5 py-2.5 text-sm rounded-lg border border-[#DADCE0] focus:outline-none focus:ring-2 focus:ring-[#1A73E8]/20 focus:border-[#1A73E8]"
                    />
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-[#1A73E8] text-white text-sm font-medium hover:bg-[#1557B0] transition-colors disabled:opacity-60"
              >
                {loading
                  ? 'Processing...'
                  : mode === 'login'
                    ? 'Sign In'
                    : mode === 'signup'
                      ? 'Create Account'
                      : 'Send Reset Link'}
                <ArrowRight className="w-4 h-4" />
              </button>
            </form>

            <div className="mt-6 flex items-center justify-between text-xs text-[#5F6368]">
              {mode === 'login' ? (
                <>
                  <button
                    type="button"
                    onClick={() => setMode('signup')}
                    className="hover:text-[#1A73E8] underline underline-offset-2"
                  >
                    Need an account? Sign up
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode('forgot')}
                    className="hover:text-[#1A73E8] underline underline-offset-2"
                  >
                    Forgot password?
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => setMode('login')}
                  className="hover:text-[#1A73E8] underline underline-offset-2"
                >
                  Back to sign in
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

interface EmailVerifyGateProps {
  email: string;
  onRefresh: () => Promise<void>;
  onError: (msg: string) => void;
}

export function EmailVerifyGate({ email, onRefresh, onError }: EmailVerifyGateProps) {
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const handleResend = async () => {
    if (!auth.currentUser) return;
    setSending(true);
    try {
      await sendEmailVerification(auth.currentUser);
      setSent(true);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Could not send verification email.');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] flex items-center justify-center p-6">
      <div className="max-w-md w-full bg-white border border-[#DADCE0] rounded-xl p-8">
        <h2 className="font-display text-xl font-bold text-[#202124] mb-2">
          Verify your email address
        </h2>
        <p className="text-sm text-[#5F6368] mb-6">
          Security rules require a verified email before reading or writing organization tender
          data. Please open the verification link sent to{' '}
          <span className="font-medium text-[#202124]">{email}</span>.
        </p>
        {sent && (
          <p className="text-xs text-[#137333] bg-[#E6F4EA] border border-[#CEEAD6] rounded-lg p-3 mb-4">
            Verification email resent.
          </p>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={onRefresh}
            className="px-4 py-2 bg-[#1A73E8] text-white text-sm font-medium rounded-lg hover:bg-[#1557B0]"
          >
            I Have Verified
          </button>
          <button
            type="button"
            disabled={sending}
            onClick={handleResend}
            className="px-4 py-2 border border-[#DADCE0] text-[#3C4043] text-sm font-medium rounded-lg hover:bg-[#F1F3F4]"
          >
            {sending ? 'Sending...' : 'Resend Link'}
          </button>
          <button
            type="button"
            onClick={() => signOut(auth)}
            className="px-3 py-2 text-sm text-[#5F6368] hover:text-[#202124]"
          >
            Sign Out
          </button>
        </div>
      </div>
    </div>
  );
}

interface OrgOnboardingProps {
  userProfile: UserProfile;
  onComplete: (org: Organization) => void;
  onError: (msg: string) => void;
}

export function OrganizationOnboarding({ userProfile, onComplete, onError }: OrgOnboardingProps) {
  const [name, setName] = useState('');
  const [industry, setIndustry] = useState('IT & Cybersecurity');
  const [businessCategory, setBusinessCategory] = useState('MSME / Private Limited');
  const [headquarters, setHeadquarters] = useState('Bengaluru, Karnataka');
  const [gstin, setGstin] = useState('');
  const [udyamNumber, setUdyamNumber] = useState('');
  const [yearsInOperation, setYearsInOperation] = useState('6');
  const [annualTurnoverLakhs, setAnnualTurnoverLakhs] = useState('420');
  const [netWorthLakhs, setNetWorthLakhs] = useState('165');
  const [employeeCount, setEmployeeCount] = useState('48');
  const [certificationsText, setCertificationsText] = useState(
    'ISO 9001:2015, ISO/IEC 27001:2022',
  );
  const [capabilitiesSummary, setCapabilitiesSummary] = useState(
    'Enterprise cloud architecture, municipal IoT SCADA integration, cybersecurity operations, and e-Governance SaaS delivery.',
  );
  const [pastProjectsSummary, setPastProjectsSummary] = useState(
    'Completed 2 state government cloud & telemetry modernization contracts valued at INR 190 Lakhs and INR 210 Lakhs.',
  );
  const [seedDemo, setSeedDemo] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);
    try {
      const certs = certificationsText
        .split(',')
        .map((c) => c.trim())
        .filter(Boolean)
        .slice(0, 25);

      const org = await createOrganizationAndProfile({
        uid: userProfile.uid,
        email: userProfile.email,
        displayName: userProfile.displayName,
        orgInput: {
          name: name.trim(),
          industry,
          businessCategory,
          headquarters: headquarters.trim(),
          gstin: gstin.trim(),
          udyamNumber: udyamNumber.trim(),
          yearsInOperation: Number(yearsInOperation) || 0,
          annualTurnoverLakhs: Number(annualTurnoverLakhs) || 0,
          netWorthLakhs: Number(netWorthLakhs) || 0,
          employeeCount: Number(employeeCount) || 0,
          certifications: certs,
          capabilitiesSummary: capabilitiesSummary.trim(),
          pastProjectsSummary: pastProjectsSummary.trim(),
        },
      });

      if (seedDemo) {
        await seedDemoWorkspaceData(org, userProfile.uid, userProfile.displayName);
      }
      onComplete(org);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Failed to create organization.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8F9FA] py-10 px-4 sm:px-8">
      <div className="max-w-3xl mx-auto bg-white border border-[#DADCE0] rounded-xl p-8">
        <div className="flex items-center justify-between pb-6 mb-6 border-b border-[#E8EAED]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-[#E8F0FE] text-[#1A73E8] flex items-center justify-center">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-display text-xl font-bold text-[#202124]">
                Register Company Procurement Profile
              </h1>
              <p className="text-xs text-[#5F6368]">
                Reused by Bid Tender Writer for eligibility checks and proposal authoring.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => signOut(auth)}
            className="text-xs text-[#5F6368] hover:text-[#202124]"
          >
            Sign Out
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-[#3C4043] mb-1">
                Legal Company / Organization Name *
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Vertex Civic Systems Pvt. Ltd."
                className="w-full px-3 py-2 text-sm border border-[#DADCE0] rounded-lg focus:outline-none focus:border-[#1A73E8]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#3C4043] mb-1">
                Primary Industry *
              </label>
              <select
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-[#DADCE0] rounded-lg bg-white focus:outline-none focus:border-[#1A73E8]"
              >
                <option value="IT & Cybersecurity">IT &amp; Cybersecurity</option>
                <option value="Water & Smart Infrastructure">Water &amp; Smart Infrastructure</option>
                <option value="IT & Software Services">IT &amp; Software Services</option>
                <option value="Smart Mobility & AI">Smart Mobility &amp; AI</option>
                <option value="Renewable Energy & EPC">Renewable Energy &amp; EPC</option>
                <option value="Healthcare IT">Healthcare IT</option>
                <option value="Civil & Construction">Civil &amp; Construction</option>
              </select>
            </div>
          </div>

          <div className="grid sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Business Category
              </label>
              <select
                value={businessCategory}
                onChange={(e) => setBusinessCategory(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg bg-white"
              >
                <option value="MSME / Private Limited">MSME / Private Limited</option>
                <option value="DPIIT Recognized Startup">DPIIT Recognized Startup</option>
                <option value="Mid-Market Enterprise">Mid-Market Enterprise</option>
                <option value="LLP / Partnership">LLP / Partnership</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Headquarters City
              </label>
              <input
                type="text"
                value={headquarters}
                onChange={(e) => setHeadquarters(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Years in Operation
              </label>
              <input
                type="number"
                min="0"
                value={yearsInOperation}
                onChange={(e) => setYearsInOperation(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono tabular-nums"
              />
            </div>
          </div>

          <div className="grid sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Avg Annual Turnover (INR Lakhs)
              </label>
              <input
                type="number"
                min="0"
                step="0.1"
                value={annualTurnoverLakhs}
                onChange={(e) => setAnnualTurnoverLakhs(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono tabular-nums"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Net Worth (INR Lakhs)
              </label>
              <input
                type="number"
                min="0"
                step="0.1"
                value={netWorthLakhs}
                onChange={(e) => setNetWorthLakhs(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono tabular-nums"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Team Size (Employees)
              </label>
              <input
                type="number"
                min="1"
                value={employeeCount}
                onChange={(e) => setEmployeeCount(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono tabular-nums"
              />
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                GSTIN (Optional)
              </label>
              <input
                type="text"
                value={gstin}
                onChange={(e) => setGstin(e.target.value)}
                placeholder="29ABCDE1234F1Z5"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Udyam MSME Number (Optional)
              </label>
              <input
                type="text"
                value={udyamNumber}
                onChange={(e) => setUdyamNumber(e.target.value)}
                placeholder="UDYAM-KA-03-0012345"
                className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg font-mono"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Certifications (Comma-separated)
            </label>
            <input
              type="text"
              value={certificationsText}
              onChange={(e) => setCertificationsText(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Core Capabilities &amp; Technical Offerings
            </label>
            <textarea
              rows={3}
              value={capabilitiesSummary}
              onChange={(e) => setCapabilitiesSummary(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Verified Past Government / Enterprise Credentials
            </label>
            <textarea
              rows={2}
              value={pastProjectsSummary}
              onChange={(e) => setPastProjectsSummary(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg"
            />
          </div>

          <label className="flex items-start gap-2.5 p-3.5 rounded-lg bg-[#F8F9FA] border border-[#DADCE0] cursor-pointer">
            <input
              type="checkbox"
              checked={seedDemo}
              onChange={(e) => setSeedDemo(e.target.checked)}
              className="mt-0.5 rounded border-[#DADCE0] text-[#1A73E8]"
            />
            <span className="text-xs text-[#3C4043] leading-relaxed">
              Initialize workspace with clearly labeled <strong>DEMO DATA</strong> sample tenders and
              analysis report so I can test eligibility, proposal writing, and financial scenarios
              immediately.
            </span>
          </label>

          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#1A73E8] text-white text-sm font-medium rounded-lg hover:bg-[#1557B0] disabled:opacity-60"
            >
              {submitting ? 'Creating Workspace...' : 'Launch Bid Tender Writer Workspace'}
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
