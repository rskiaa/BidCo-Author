import React, { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Bell,
  Briefcase,
  Calculator,
  CheckSquare,
  Compass,
  FileSearch,
  FileText,
  FolderOpen,
  LayoutDashboard,
  LogOut,
  Menu,
  PenTool,
  Settings,
  ShieldAlert,
  Users,
  X,
} from 'lucide-react';
import type { NotificationItem, Organization, UserProfile } from '../types/procurement.ts';
import {
  EASE_OUT_EXPO,
  GoogleBrandMark,
  GoogleSpectrumBar,
  SPRING_SNAPPY,
} from './NeonPrimitives.tsx';

export { GoogleBrandMark };

export type NavSection =
  | 'dashboard'
  | 'discover'
  | 'my_tenders'
  | 'analyzer'
  | 'eligibility'
  | 'coauthor'
  | 'financial'
  | 'risk'
  | 'documents'
  | 'team'
  | 'settings';

export const NAV_ITEMS: Array<{
  id: NavSection;
  label: string;
  accent: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: 'dashboard', label: 'Dashboard', accent: '#4285F4', icon: LayoutDashboard },
  { id: 'discover', label: 'Discover Tenders', accent: '#34A853', icon: Compass },
  { id: 'my_tenders', label: 'My Tenders', accent: '#FBBC04', icon: Briefcase },
  { id: 'analyzer', label: 'Document Analyzer', accent: '#4285F4', icon: FileSearch },
  { id: 'eligibility', label: 'Eligibility Checker', accent: '#34A853', icon: CheckSquare },
  { id: 'coauthor', label: 'AI Bid Writer', accent: '#4285F4', icon: PenTool },
  { id: 'financial', label: 'Financial Intelligence', accent: '#FBBC04', icon: Calculator },
  { id: 'risk', label: 'Risk Analysis', accent: '#EA4335', icon: ShieldAlert },
  { id: 'documents', label: 'Documents', accent: '#4285F4', icon: FolderOpen },
  { id: 'team', label: 'Team Workspace', accent: '#34A853', icon: Users },
  { id: 'settings', label: 'Settings', accent: '#9AA0A6', icon: Settings },
];

interface SidebarLayoutProps {
  activeNav: NavSection;
  onSelectNav: (nav: NavSection) => void;
  organization: Organization;
  userProfile: UserProfile;
  notifications: NotificationItem[];
  onMarkNotificationRead: (id: string) => void;
  onSignOut: () => void;
  children: React.ReactNode;
}

export function SidebarLayout({
  activeNav,
  onSelectNav,
  organization,
  userProfile,
  notifications,
  onMarkNotificationRead,
  onSignOut,
  children,
}: SidebarLayoutProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);

  const unreadCount = notifications.filter((n) => !n.isRead).length;
  const activeItem = NAV_ITEMS.find((i) => i.id === activeNav) || NAV_ITEMS[0];

  const handleNavClick = (id: NavSection) => {
    onSelectNav(id);
    setMobileOpen(false);
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#090B10] text-[#F1F3F4] google-neon-grid">
      {/* Flowing Google 4-color neon top hairline */}
      <GoogleSpectrumBar sticky />

      <div className="flex-1 flex min-w-0 relative">
        {/* Mobile Backdrop */}
        <AnimatePresence>
          {mobileOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="fixed inset-0 z-40 bg-black/70 backdrop-blur-xs lg:hidden"
              onClick={() => setMobileOpen(false)}
            />
          )}
        </AnimatePresence>

        {/* Left Sidebar — Obsidian Neon Navigation Rail */}
        <aside
          className={`fixed lg:static inset-y-0 left-0 z-50 w-64 shrink-0 bg-[#0D1017]/95 backdrop-blur-xl text-[#A7B0C0] flex flex-col border-r border-white/[0.08] transition-transform duration-200 ${
            mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
          }`}
        >
          <div className="h-16 px-4 flex items-center justify-between border-b border-white/[0.07]">
            <button
              type="button"
              onClick={() => handleNavClick('dashboard')}
              className="flex items-center gap-2.5 min-w-0 text-left group"
            >
              <GoogleBrandMark size={34} />
              <span className="font-display font-bold text-[15px] text-[#F1F3F4] tracking-tight truncate group-hover:text-[#8AB4F8] transition-colors">
                Bid Tender Writer
              </span>
            </button>
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              className="lg:hidden p-1.5 text-[#9AA0A6] hover:text-white transition-colors"
              aria-label="Close navigation"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="px-4 py-3.5 border-b border-white/[0.07] bg-white/[0.02]">
            <p className="text-[11px] font-medium text-[#7B8499] truncate">Active Organization</p>
            <p className="text-sm font-semibold text-[#F1F3F4] truncate mt-0.5">
              {organization.name}
            </p>
          </div>

          <nav className="flex-1 overflow-y-auto px-2.5 py-3 space-y-1">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = item.id === activeNav;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleNavClick(item.id)}
                  className={`relative w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors whitespace-nowrap shrink-0 ${
                    isActive
                      ? 'text-white'
                      : 'text-[#A7B0C0] hover:text-[#F1F3F4] hover:bg-white/[0.04]'
                  }`}
                >
                  {isActive && (
                    <motion.div
                      layoutId="activeNavGlow"
                      transition={SPRING_SNAPPY}
                      className="absolute inset-0 rounded-xl bg-[#4285F4]/18 border border-[#4285F4]/45 shadow-[0_0_22px_-6px_rgba(66,133,244,0.65)]"
                    />
                  )}
                  <Icon
                    className={`w-4 h-4 shrink-0 relative z-10 transition-colors ${
                      isActive ? 'text-[#8AB4F8]' : 'text-[#7B8499]'
                    }`}
                  />
                  <span className="truncate relative z-10">{item.label}</span>
                </button>
              );
            })}
          </nav>

          <div className="p-3 border-t border-white/[0.07] bg-white/[0.015]">
            <div className="flex items-center justify-between gap-2 px-2 py-1.5">
              <div className="min-w-0">
                <p className="text-xs font-medium text-[#F1F3F4] truncate">
                  {userProfile.displayName}
                </p>
                <p className="text-[11px] text-[#7B8499] truncate">{userProfile.email}</p>
              </div>
              <button
                type="button"
                onClick={onSignOut}
                title="Sign out"
                className="p-2 rounded-lg text-[#9AA0A6] hover:text-[#F87171] hover:bg-[#EA4335]/10 transition-colors shrink-0"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </aside>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-16 bg-[#0D1017]/85 backdrop-blur-xl border-b border-white/[0.08] px-4 sm:px-8 flex items-center justify-between gap-6 sticky top-[3px] z-30">
            <div className="flex items-center gap-3 min-w-0">
              <button
                type="button"
                onClick={() => setMobileOpen(true)}
                className="lg:hidden p-2 -ml-2 text-[#A7B0C0] hover:text-white"
                aria-label="Open navigation"
              >
                <Menu className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-2 text-sm min-w-0">
                <span className="text-[#7B8499] hidden sm:inline whitespace-nowrap">
                  {organization.name}
                </span>
                <span className="text-white/20 hidden sm:inline">/</span>
                <h1 className="font-display font-semibold text-[#F1F3F4] truncate">
                  {activeItem.label}
                </h1>
              </div>
            </div>

            <div className="flex items-center gap-3 shrink-0 relative">
              <motion.button
                type="button"
                whileTap={{ scale: 0.97 }}
                onClick={() => handleNavClick('analyzer')}
                className="hidden sm:inline-flex items-center gap-2 px-4 py-2 rounded-lg neon-btn-primary text-xs font-medium whitespace-nowrap shrink-0"
              >
                <FileText className="w-3.5 h-3.5" />
                Analyze Tender PDF
              </motion.button>

              <button
                type="button"
                onClick={() => setNotifOpen((v) => !v)}
                className="relative p-2 rounded-lg border border-white/12 bg-white/[0.03] text-[#A7B0C0] hover:text-white hover:border-[#4285F4]/50 hover:bg-[#4285F4]/10 transition-colors"
                aria-label="Notifications"
              >
                <Bell className="w-4 h-4" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 px-1.5 py-0.5 bg-[#EA4335] text-white text-[10px] font-mono font-semibold rounded-full shadow-[0_0_10px_rgba(234,67,53,0.75)]">
                    {unreadCount}
                  </span>
                )}
              </button>

              <AnimatePresence>
                {notifOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 8, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 6, scale: 0.97 }}
                    transition={{ duration: 0.16, ease: EASE_OUT_EXPO }}
                    className="absolute right-0 top-12 w-80 bg-[#11151E]/95 backdrop-blur-xl border border-white/12 rounded-2xl shadow-[0_24px_50px_-16px_rgba(0,0,0,0.85)] z-50 p-4"
                  >
                    <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-white/[0.08]">
                      <span className="text-xs font-semibold text-[#F1F3F4]">
                        Reminders &amp; Alerts
                      </span>
                      <button
                        type="button"
                        onClick={() => setNotifOpen(false)}
                        className="text-xs text-[#9AA0A6] hover:text-white transition-colors"
                      >
                        Close
                      </button>
                    </div>
                    {notifications.length === 0 ? (
                      <p className="text-xs text-[#7B8499] py-4 text-center">
                        No notifications yet.
                      </p>
                    ) : (
                      <div className="space-y-2 max-h-72 overflow-y-auto">
                        {notifications.slice(0, 8).map((n) => (
                          <div
                            key={n.id}
                            className={`p-2.5 rounded-xl border text-xs transition-colors ${
                              n.isRead
                                ? 'bg-white/[0.02] border-white/[0.06] text-[#9AA0A6]'
                                : 'bg-[#4285F4]/12 border-[#4285F4]/35 text-[#F1F3F4]'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <span className="font-semibold text-[#F1F3F4]">{n.title}</span>
                              {!n.isRead && (
                                <button
                                  type="button"
                                  onClick={() => onMarkNotificationRead(n.id)}
                                  className="text-[11px] text-[#8AB4F8] hover:underline shrink-0"
                                >
                                  Mark read
                                </button>
                              )}
                            </div>
                            <p className="leading-relaxed">{n.message}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </header>

          <main className="flex-1 p-4 sm:p-8 max-w-[1440px] w-full mx-auto">{children}</main>
        </div>
      </div>
    </div>
  );
}
