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
import { AnimatePresence, motion } from 'motion/react';
import {
  ArrowRight,
  Building2,
  Calculator,
  CheckCircle2,
  FileSearch,
  KeyRound,
  Mail,
  PenTool,
  ShieldCheck,
} from 'lucide-react';
import { auth, googleAuthProvider } from '../lib/firebase.ts';
import {
  createOrganizationAndProfile,
  seedDemoWorkspaceData,
} from '../lib/firestoreStore.ts';
import type { Organization, UserProfile } from '../types/procurement.ts';
import {
  EASE_OUT_EXPO,
  GoogleBrandMark,
  GoogleSpectrumBar,
  SPRING_SNAPPY,
} from './NeonPrimitives.tsx';

interface AuthScreenProps {
  onError: (msg: string) => void;
}

const WORKFLOW_SPOTLIGHTS = [
  {
    id: 'parse',
    label: 'PDF & RAG Extraction',
    accent: '#4285F4',
    accentGlow: 'rgba(66, 133, 244, 0.35)',
    icon: FileSearch,
    title: 'Page-cited tender intelligence',
    summary:
      'Upload multi-page government RFPs to extract eligibility criteria, EMD, BOQ specs, and disqualification clauses with exact page references.',
  },
  {
    id: 'eligibility',
    label: 'Eligibility Verification',
    accent: '#34A853',
    accentGlow: 'rgba(52, 168, 83, 0.35)',
    icon: ShieldCheck,
    title: 'Evidence-backed qualification matrix',
    summary:
      'Cross-check annual turnover, ISO certifications, and past government work orders against every mandatory tender gate before investing bid hours.',
  },
  {
    id: 'writer',
    label: 'AI Bid Writer',
    accent: '#FBBC04',
    accentGlow: 'rgba(251, 188, 4, 0.35)',
    icon: PenTool,
    title: 'Versioned technical proposal studio',
    summary:
      'Draft compliant methodologies, capability statements, and compliance matrices with instant DOCX and PDF export and full revision history.',
  },
  {
    id: 'finance',
    label: 'Financial & Risk',
    accent: '#EA4335',
    accentGlow: 'rgba(234, 67, 53, 0.35)',
    icon: Calculator,
    title: 'Margin modeling & clause risk audit',
    summary:
      'Simulate L1, balanced, and margin-protected bid prices alongside EMD/PBG lockup and automated detection of SLA penalty exposure.',
  },
];

export function AuthScreen({ onError }: AuthScreenProps) {
  const [mode, setMode] = useState<'login' | 'signup' | 'forgot'>('login');
  const [activeSpotlight, setActiveSpotlight] = useState(0);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [loading, setLoading] = useState(false);
  const [infoMessage, setInfoMessage] = useState('');
  const [imgFailed, setImgFailed] = useState(false);

  const currentSpotlight = WORKFLOW_SPOTLIGHTS[activeSpotlight];
  const SpotlightIcon = currentSpotlight.icon;

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
    <div className="min-h-screen bg-[#090B10] text-[#F1F3F4] flex flex-col google-neon-grid relative overflow-hidden">
      <GoogleSpectrumBar />

      {/* Ambient Google Neon Aurora Glows */}
      <div
        className="pointer-events-none fixed -top-32 -left-24 w-[480px] h-[480px] rounded-full blur-[120px] aurora-blob"
        style={{ background: 'rgba(66, 133, 244, 0.16)' }}
        aria-hidden="true"
      />
      <div
        className="pointer-events-none fixed bottom-[-120px] left-[28%] w-[420px] h-[420px] rounded-full blur-[120px] aurora-blob"
        style={{ background: 'rgba(52, 168, 83, 0.12)', animationDelay: '3s' }}
        aria-hidden="true"
      />
      <div
        className="pointer-events-none fixed top-[20%] right-[-100px] w-[360px] h-[360px] rounded-full blur-[120px] aurora-blob"
        style={{ background: 'rgba(251, 188, 4, 0.08)', animationDelay: '6s' }}
        aria-hidden="true"
      />

      <div className="flex-1 grid lg:grid-cols-12 relative z-10">
        {/* Left Interactive Google Neon Showcase */}
        <div className="lg:col-span-7 relative flex flex-col justify-between p-8 lg:p-14 border-b lg:border-b-0 lg:border-r border-white/[0.08]">
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.32, ease: EASE_OUT_EXPO }}
            className="flex items-center gap-3"
          >
            <GoogleBrandMark size={38} />
            <span className="font-display text-lg font-bold tracking-tight text-[#F1F3F4]">
              Bid Tender Writer
            </span>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.42, delay: 0.06, ease: EASE_OUT_EXPO }}
            className="max-w-2xl my-10 space-y-6"
          >
            <div>
              <p className="text-xs font-medium text-[#8AB4F8] mb-3 tracking-wide">
                Government Procurement &amp; Bid Authoring Studio
              </p>
              <h1 className="font-display text-3xl sm:text-4xl lg:text-[2.75rem] font-bold tracking-tight text-white leading-[1.12] mb-4">
                Write Compliant Government Tenders{' '}
                <span className="bg-gradient-to-r from-[#669DF6] via-[#4ADE80] to-[#FCD34D] bg-clip-text text-transparent">
                  Faster with Evidence.
                </span>
              </h1>
              <p className="text-[#A7B0C0] text-base leading-relaxed max-w-xl">
                Parse multi-page tender RFPs with page citations, verify company eligibility
                criteria, model L1 financial margins, and co-author submission-ready proposals.
              </p>
            </div>

            {/* Interactive Google 4-Color Capability Switcher */}
            <div className="space-y-3">
              <div className="flex flex-wrap gap-1.5 p-1.5 rounded-xl bg-white/[0.04] border border-white/[0.08]">
                {WORKFLOW_SPOTLIGHTS.map((item, idx) => {
                  const isActive = idx === activeSpotlight;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setActiveSpotlight(idx)}
                      className={`relative px-3 py-2 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 ${
                        isActive ? 'text-white' : 'text-[#9AA0A6] hover:text-[#F1F3F4]'
                      }`}
                    >
                      {isActive && (
                        <motion.div
                          layoutId="authSpotlightTab"
                          transition={SPRING_SNAPPY}
                          className="absolute inset-0 rounded-lg border"
                          style={{
                            backgroundColor: `${item.accent}24`,
                            borderColor: `${item.accent}75`,
                            boxShadow: `0 0 18px -6px ${item.accentGlow}`,
                          }}
                        />
                      )}
                      <span className="relative z-10">{item.label}</span>
                    </button>
                  );
                })}
              </div>

              <AnimatePresence mode="wait">
                <motion.div
                  key={currentSpotlight.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.2, ease: EASE_OUT_EXPO }}
                  className="neon-surface rounded-2xl p-5 flex items-start gap-4"
                  style={{
                    borderColor: `${currentSpotlight.accent}35`,
                  }}
                >
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border"
                    style={{
                      backgroundColor: `${currentSpotlight.accent}1A`,
                      borderColor: `${currentSpotlight.accent}45`,
                      color: currentSpotlight.accent,
                    }}
                  >
                    <SpotlightIcon className="w-5 h-5" />
                  </div>
                  <div className="min-w-0">
                    <h2 className="font-display text-sm font-semibold text-white">
                      {currentSpotlight.title}
                    </h2>
                    <p className="text-xs text-[#A7B0C0] leading-relaxed mt-1">
                      {currentSpotlight.summary}
                    </p>
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>

            {!imgFailed && (
              <div className="rounded-2xl overflow-hidden border border-white/10 bg-[#11151E] h-40 relative group">
                <img
                  src="/src/assets/images/auth_procurement_banner_1795758584396.jpg"
                  alt="Government civic architecture"
                  referrerPolicy="no-referrer"
                  onError={() => setImgFailed(true)}
                  className="w-full h-full object-cover opacity-75 group-hover:scale-[1.03] transition-transform duration-500"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#090B10] via-[#090B10]/40 to-transparent" />
                <div className="absolute bottom-3.5 left-4 right-4 flex items-center justify-between gap-2 text-xs">
                  <span className="font-medium text-[#F1F3F4]">
                    Public Sector RFP Analysis &amp; Bid Authoring Suite
                  </span>
                  <span className="text-[#8AB4F8] font-mono">DOCX · PDF · RAG</span>
                </div>
              </div>
            )}

            <div className="grid sm:grid-cols-2 gap-3 pt-2 text-xs text-[#C4CBD6]">
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-[#669DF6] shrink-0 mt-0.5" />
                <span>Page-cited PDF extraction &amp; vector RAG search</span>
              </div>
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-[#4ADE80] shrink-0 mt-0.5" />
                <span>Evidence-based eligibility &amp; gap verification</span>
              </div>
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-[#FCD34D] shrink-0 mt-0.5" />
                <span>Versioned proposal studio with DOCX &amp; PDF export</span>
              </div>
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-[#F87171] shrink-0 mt-0.5" />
                <span>Financial margin &amp; contract risk intelligence</span>
              </div>
            </div>
          </motion.div>

          <div className="text-xs text-[#7B8499] flex flex-wrap items-center justify-between gap-2">
            <span>Enterprise Procurement &amp; Bid Operations</span>
            <span>Human-in-the-loop submission control</span>
          </div>
        </div>

        {/* Right Glass Authentication Panel */}
        <div className="lg:col-span-5 flex items-center justify-center p-6 sm:p-12">
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.36, delay: 0.1, ease: EASE_OUT_EXPO }}
            className="w-full max-w-md neon-surface rounded-2xl p-7 sm:p-8"
          >
            <AnimatePresence mode="wait">
              <motion.div
                key={mode}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.18, ease: EASE_OUT_EXPO }}
                className="mb-7"
              >
                <h2 className="font-display text-2xl font-bold text-white mb-1.5">
                  {mode === 'login' && 'Sign in to Bid Tender Writer'}
                  {mode === 'signup' && 'Create your procurement account'}
                  {mode === 'forgot' && 'Reset your password'}
                </h2>
                <p className="text-sm text-[#9AA0A6]">
                  {mode === 'login' && 'Access your organization tenders, analyses, and bid drafts.'}
                  {mode === 'signup' &&
                    'Register to manage tenders and company eligibility credentials.'}
                  {mode === 'forgot' && 'Enter your registered email to receive a reset link.'}
                </p>
              </motion.div>
            </AnimatePresence>

            {infoMessage && (
              <div className="mb-5 p-3.5 rounded-xl bg-[#4285F4]/15 border border-[#4285F4]/40 text-xs text-[#AECBFA] leading-relaxed">
                {infoMessage}
              </div>
            )}

            {mode !== 'forgot' && (
              <>
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.985 }}
                  disabled={loading}
                  onClick={handleGoogleSignIn}
                  className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl border border-white/15 bg-white/[0.04] text-[#F1F3F4] font-medium text-sm hover:bg-white/[0.09] hover:border-[#4285F4]/50 transition-all disabled:opacity-60"
                >
                  <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
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
                </motion.button>

                <div className="my-6 flex items-center gap-3 text-xs text-[#7B8499]">
                  <div className="flex-1 h-px bg-white/10" />
                  <span>or use email &amp; password</span>
                  <div className="flex-1 h-px bg-white/10" />
                </div>
              </>
            )}

            <form onSubmit={handleEmailSubmit} className="space-y-4">
              {mode === 'signup' && (
                <div>
                  <label className="block text-xs font-medium text-[#C4CBD6] mb-1.5">
                    Full Name
                  </label>
                  <input
                    type="text"
                    required
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Aarav Mehta"
                    className="w-full px-3.5 py-2.5 text-sm rounded-xl neon-input"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-medium text-[#C4CBD6] mb-1.5">
                  Work Email
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-[#7B8499] absolute left-3.5 top-3" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="procurement@company.in"
                    className="w-full pl-10 pr-3.5 py-2.5 text-sm rounded-xl neon-input"
                  />
                </div>
              </div>

              {mode !== 'forgot' && (
                <div>
                  <label className="block text-xs font-medium text-[#C4CBD6] mb-1.5">
                    Password
                  </label>
                  <div className="relative">
                    <KeyRound className="w-4 h-4 text-[#7B8499] absolute left-3.5 top-3" />
                    <input
                      type="password"
                      required
                      minLength={6}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Minimum 6 characters"
                      className="w-full pl-10 pr-3.5 py-2.5 text-sm rounded-xl neon-input"
                    />
                  </div>
                </div>
              )}

              <motion.button
                type="submit"
                whileTap={{ scale: 0.985 }}
                disabled={loading}
                className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl neon-btn-primary text-sm font-medium disabled:opacity-60"
              >
                {loading
                  ? 'Processing...'
                  : mode === 'login'
                    ? 'Sign In'
                    : mode === 'signup'
                      ? 'Create Account'
                      : 'Send Reset Link'}
                <ArrowRight className="w-4 h-4" />
              </motion.button>
            </form>

            <div className="mt-6 flex items-center justify-between text-xs text-[#9AA0A6]">
              {mode === 'login' ? (
                <>
                  <button
                    type="button"
                    onClick={() => setMode('signup')}
                    className="hover:text-[#8AB4F8] underline underline-offset-4 transition-colors"
                  >
                    Need an account? Sign up
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode('forgot')}
                    className="hover:text-[#8AB4F8] underline underline-offset-4 transition-colors"
                  >
                    Forgot password?
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => setMode('login')}
                  className="hover:text-[#8AB4F8] underline underline-offset-4 transition-colors"
                >
                  Back to sign in
                </button>
              )}
            </div>
          </motion.div>
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
    <div className="min-h-screen bg-[#090B10] google-neon-grid flex flex-col">
      <GoogleSpectrumBar />
      <div className="flex-1 flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28, ease: EASE_OUT_EXPO }}
          className="max-w-md w-full neon-surface rounded-2xl p-8"
        >
          <h2 className="font-display text-xl font-bold text-white mb-2">
            Verify your email address
          </h2>
          <p className="text-sm text-[#A7B0C0] mb-6 leading-relaxed">
            Security rules require a verified email before reading or writing organization tender
            data. Please open the verification link sent to{' '}
            <span className="font-medium text-[#8AB4F8]">{email}</span>.
          </p>
          {sent && (
            <p className="text-xs text-[#4ADE80] bg-[#34A853]/15 border border-[#34A853]/40 rounded-xl p-3 mb-4">
              Verification email resent.
            </p>
          )}
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={onRefresh}
              className="px-4 py-2.5 neon-btn-primary text-sm font-medium rounded-xl"
            >
              I Have Verified
            </button>
            <button
              type="button"
              disabled={sending}
              onClick={handleResend}
              className="px-4 py-2.5 neon-btn-secondary text-sm font-medium rounded-xl"
            >
              {sending ? 'Sending...' : 'Resend Link'}
            </button>
            <button
              type="button"
              onClick={() => signOut(auth)}
              className="px-3 py-2 text-sm text-[#9AA0A6] hover:text-white transition-colors"
            >
              Sign Out
            </button>
          </div>
        </motion.div>
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
    <div className="min-h-screen bg-[#090B10] google-neon-grid flex flex-col">
      <GoogleSpectrumBar />
      <div className="py-10 px-4 sm:px-8 flex-1">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: EASE_OUT_EXPO }}
          className="max-w-3xl mx-auto neon-surface rounded-2xl p-7 sm:p-8"
        >
          <div className="flex items-center justify-between pb-6 mb-6 border-b border-white/[0.08]">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#4285F4]/18 border border-[#4285F4]/40 text-[#8AB4F8] flex items-center justify-center">
                <Building2 className="w-5 h-5" />
              </div>
              <div>
                <h1 className="font-display text-xl font-bold text-white">
                  Register Company Procurement Profile
                </h1>
                <p className="text-xs text-[#9AA0A6]">
                  Reused by Bid Tender Writer for eligibility checks and proposal authoring.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => signOut(auth)}
              className="text-xs text-[#9AA0A6] hover:text-white transition-colors"
            >
              Sign Out
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-[#C4CBD6] mb-1.5">
                  Legal Company / Organization Name *
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Vertex Civic Systems Pvt. Ltd."
                  className="w-full px-3.5 py-2.5 text-sm neon-input rounded-xl"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#C4CBD6] mb-1.5">
                  Primary Industry *
                </label>
                <select
                  value={industry}
                  onChange={(e) => setIndustry(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm neon-input rounded-xl"
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
                <label className="block text-xs font-medium text-[#C4CBD6] mb-1.5">
                  Business Category
                </label>
                <select
                  value={businessCategory}
                  onChange={(e) => setBusinessCategory(e.target.value)}
                  className="w-full px-3 py-2 text-sm neon-input rounded-xl"
                >
                  <option value="MSME / Private Limited">MSME / Private Limited</option>
                  <option value="DPIIT Recognized Startup">DPIIT Recognized Startup</option>
                  <option value="Mid-Market Enterprise">Mid-Market Enterprise</option>
                  <option value="LLP / Partnership">LLP / Partnership</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-[#C4CBD6] mb-1.5">
                  Headquarters City
                </label>
                <input
                  type="text"
                  value={headquarters}
                  onChange={(e) => setHeadquarters(e.target.value)}
                  className="w-full px-3 py-2 text-sm neon-input rounded-xl"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#C4CBD6] mb-1.5">
                  Years in Operation
                </label>
                <input
                  type="number"
                  min="0"
                  value={yearsInOperation}
                  onChange={(e) => setYearsInOperation(e.target.value)}
                  className="w-full px-3 py-2 text-sm neon-input rounded-xl font-mono tabular-nums"
                />
              </div>
            </div>

            <div className="grid sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-[#C4CBD6] mb-1.5">
                  Avg Annual Turnover (INR Lakhs)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={annualTurnoverLakhs}
                  onChange={(e) => setAnnualTurnoverLakhs(e.target.value)}
                  className="w-full px-3 py-2 text-sm neon-input rounded-xl font-mono tabular-nums"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#C4CBD6] mb-1.5">
                  Net Worth (INR Lakhs)
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={netWorthLakhs}
                  onChange={(e) => setNetWorthLakhs(e.target.value)}
                  className="w-full px-3 py-2 text-sm neon-input rounded-xl font-mono tabular-nums"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#C4CBD6] mb-1.5">
                  Team Size (Employees)
                </label>
                <input
                  type="number"
                  min="1"
                  value={employeeCount}
                  onChange={(e) => setEmployeeCount(e.target.value)}
                  className="w-full px-3 py-2 text-sm neon-input rounded-xl font-mono tabular-nums"
                />
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-[#C4CBD6] mb-1.5">
                  GSTIN (Optional)
                </label>
                <input
                  type="text"
                  value={gstin}
                  onChange={(e) => setGstin(e.target.value)}
                  placeholder="29ABCDE1234F1Z5"
                  className="w-full px-3 py-2 text-sm neon-input rounded-xl font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-[#C4CBD6] mb-1.5">
                  Udyam MSME Number (Optional)
                </label>
                <input
                  type="text"
                  value={udyamNumber}
                  onChange={(e) => setUdyamNumber(e.target.value)}
                  placeholder="UDYAM-KA-03-0012345"
                  className="w-full px-3 py-2 text-sm neon-input rounded-xl font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-[#C4CBD6] mb-1.5">
                Certifications (Comma-separated)
              </label>
              <input
                type="text"
                value={certificationsText}
                onChange={(e) => setCertificationsText(e.target.value)}
                className="w-full px-3 py-2 text-sm neon-input rounded-xl"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#C4CBD6] mb-1.5">
                Core Capabilities &amp; Technical Offerings
              </label>
              <textarea
                rows={3}
                value={capabilitiesSummary}
                onChange={(e) => setCapabilitiesSummary(e.target.value)}
                className="w-full px-3 py-2 text-sm neon-input rounded-xl"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-[#C4CBD6] mb-1.5">
                Verified Past Government / Enterprise Credentials
              </label>
              <textarea
                rows={2}
                value={pastProjectsSummary}
                onChange={(e) => setPastProjectsSummary(e.target.value)}
                className="w-full px-3 py-2 text-sm neon-input rounded-xl"
              />
            </div>

            <label className="flex items-start gap-2.5 p-3.5 rounded-xl bg-white/[0.03] border border-white/10 cursor-pointer hover:border-[#4285F4]/40 transition-colors">
              <input
                type="checkbox"
                checked={seedDemo}
                onChange={(e) => setSeedDemo(e.target.checked)}
                className="mt-0.5 rounded border-white/20 bg-[#0D1119] accent-[#4285F4]"
              />
              <span className="text-xs text-[#C4CBD6] leading-relaxed">
                Initialize workspace with clearly labeled <strong className="text-white">DEMO DATA</strong> sample tenders and
                analysis report so I can test eligibility, proposal writing, and financial scenarios
                immediately.
              </span>
            </label>

            <div className="pt-2 flex justify-end">
              <motion.button
                type="submit"
                whileTap={{ scale: 0.985 }}
                disabled={submitting}
                className="inline-flex items-center gap-2 px-5 py-2.5 neon-btn-primary text-sm font-medium rounded-xl disabled:opacity-60"
              >
                {submitting ? 'Creating Workspace...' : 'Launch Bid Tender Writer Workspace'}
                <ArrowRight className="w-4 h-4" />
              </motion.button>
            </div>
          </form>
        </motion.div>
      </div>
    </div>
  );
}
