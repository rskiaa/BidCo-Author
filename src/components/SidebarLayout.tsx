import React, { useState } from 'react';
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
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'discover', label: 'Discover Tenders', icon: Compass },
  { id: 'my_tenders', label: 'My Tenders', icon: Briefcase },
  { id: 'analyzer', label: 'Document Analyzer', icon: FileSearch },
  { id: 'eligibility', label: 'Eligibility Checker', icon: CheckSquare },
  { id: 'coauthor', label: 'AI Bid Writer', icon: PenTool },
  { id: 'financial', label: 'Financial Intelligence', icon: Calculator },
  { id: 'risk', label: 'Risk Analysis', icon: ShieldAlert },
  { id: 'documents', label: 'Documents', icon: FolderOpen },
  { id: 'team', label: 'Team Workspace', icon: Users },
  { id: 'settings', label: 'Settings', icon: Settings },
];

export function GoogleBrandMark({ size = 32 }: { size?: number }) {
  return (
    <div
      style={{ width: size, height: size }}
      className="rounded-lg bg-white border border-[#DADCE0] flex items-center justify-center shrink-0 shadow-xs"
      aria-hidden="true"
    >
      <svg viewBox="0 0 24 24" className="w-4.5 h-4.5" fill="none">
        <path
          d="M6 3.5H13.5L18.5 8.5V19.5C18.5 20.0523 18.0523 20.5 17.5 20.5H6C5.44772 20.5 5 20.0523 5 19.5V4.5C5 3.94772 5.44772 3.5 6 3.5Z"
          stroke="#4285F4"
          strokeWidth="2"
        />
        <path d="M13.5 3.5V8.5H18.5" stroke="#34A853" strokeWidth="2" strokeLinejoin="round" />
        <path d="M8.5 12.5H15" stroke="#FBBC04" strokeWidth="2" strokeLinecap="round" />
        <path d="M8.5 16H13" stroke="#EA4335" strokeWidth="2" strokeLinecap="round" />
      </svg>
    </div>
  );
}

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
    <div className="min-h-screen flex flex-col bg-[#F8F9FA] text-[#202124]">
      {/* Google 4-color top hairline */}
      <div className="h-[3px] w-full flex shrink-0 sticky top-0 z-50">
        <div className="flex-1 bg-[#4285F4]" />
        <div className="flex-1 bg-[#EA4335]" />
        <div className="flex-1 bg-[#FBBC04]" />
        <div className="flex-1 bg-[#34A853]" />
      </div>

      <div className="flex-1 flex min-w-0">
        {/* Mobile Backdrop */}
        {mobileOpen && (
          <div
            className="fixed inset-0 z-40 bg-[#202124]/40 lg:hidden"
            onClick={() => setMobileOpen(false)}
          />
        )}

        {/* Left Sidebar (Clean Google Workspace White Rail) */}
        <aside
          className={`fixed lg:static inset-y-0 left-0 z-50 w-64 shrink-0 bg-white text-[#3C4043] flex flex-col border-r border-[#DADCE0] transition-transform duration-150 ${
            mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
          }`}
        >
          <div className="h-16 px-4 flex items-center justify-between border-b border-[#E8EAED]">
            <div className="flex items-center gap-2.5 min-w-0">
              <GoogleBrandMark size={32} />
              <span className="font-display font-bold text-[15px] text-[#202124] tracking-tight truncate">
                Bid Tender Writer
              </span>
            </div>
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              className="lg:hidden p-1.5 text-[#5F6368] hover:text-[#202124]"
              aria-label="Close navigation"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="px-4 py-3.5 border-b border-[#E8EAED] bg-[#F8F9FA]/70">
            <p className="text-[11px] font-medium text-[#5F6368] truncate">Active Organization</p>
            <p className="text-sm font-semibold text-[#202124] truncate mt-0.5">
              {organization.name}
            </p>
          </div>

          <nav className="flex-1 overflow-y-auto px-2.5 py-3 space-y-0.5">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = item.id === activeNav;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleNavClick(item.id)}
                  className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-full text-sm font-medium transition-colors whitespace-nowrap shrink-0 ${
                    isActive
                      ? 'bg-[#E8F0FE] text-[#1967D2]'
                      : 'text-[#3C4043] hover:bg-[#F1F3F4] hover:text-[#202124]'
                  }`}
                >
                  <Icon
                    className={`w-4 h-4 shrink-0 ${isActive ? 'text-[#1A73E8]' : 'text-[#5F6368]'}`}
                  />
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}
          </nav>

          <div className="p-3 border-t border-[#E8EAED]">
            <div className="flex items-center justify-between gap-2 px-2 py-1.5">
              <div className="min-w-0">
                <p className="text-xs font-medium text-[#202124] truncate">
                  {userProfile.displayName}
                </p>
                <p className="text-[11px] text-[#5F6368] truncate">{userProfile.email}</p>
              </div>
              <button
                type="button"
                onClick={onSignOut}
                title="Sign out"
                className="p-2 rounded-lg text-[#5F6368] hover:text-[#202124] hover:bg-[#F1F3F4] transition-colors shrink-0"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </aside>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-16 bg-white border-b border-[#DADCE0] px-4 sm:px-8 flex items-center justify-between gap-6 sticky top-[3px] z-30">
            <div className="flex items-center gap-3 min-w-0">
              <button
                type="button"
                onClick={() => setMobileOpen(true)}
                className="lg:hidden p-2 -ml-2 text-[#5F6368] hover:text-[#202124]"
                aria-label="Open navigation"
              >
                <Menu className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-2 text-sm min-w-0">
                <span className="text-[#5F6368] hidden sm:inline whitespace-nowrap">
                  {organization.name}
                </span>
                <span className="text-[#DADCE0] hidden sm:inline">/</span>
                <h1 className="font-display font-semibold text-[#202124] truncate">
                  {activeItem.label}
                </h1>
              </div>
            </div>

            <div className="flex items-center gap-3 shrink-0 relative">
              <button
                type="button"
                onClick={() => handleNavClick('analyzer')}
                className="hidden sm:inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#1A73E8] text-white text-xs font-medium hover:bg-[#1557B0] transition-colors whitespace-nowrap shrink-0 shadow-xs"
              >
                <FileText className="w-3.5 h-3.5" />
                Analyze Tender PDF
              </button>

              <button
                type="button"
                onClick={() => setNotifOpen((v) => !v)}
                className="relative p-2 rounded-lg border border-[#DADCE0] text-[#5F6368] hover:text-[#202124] hover:bg-[#F1F3F4] transition-colors"
                aria-label="Notifications"
              >
                <Bell className="w-4 h-4" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 px-1.5 py-0.2 bg-[#D93025] text-white text-[10px] font-mono font-semibold rounded-full">
                    {unreadCount}
                  </span>
                )}
              </button>

              {notifOpen && (
                <div className="absolute right-0 top-12 w-80 bg-white border border-[#DADCE0] rounded-xl shadow-lg z-50 p-4">
                  <div className="flex items-center justify-between pb-2.5 mb-2.5 border-b border-[#E8EAED]">
                    <span className="text-xs font-semibold text-[#202124]">
                      Reminders &amp; Alerts
                    </span>
                    <button
                      type="button"
                      onClick={() => setNotifOpen(false)}
                      className="text-xs text-[#5F6368] hover:text-[#202124]"
                    >
                      Close
                    </button>
                  </div>
                  {notifications.length === 0 ? (
                    <p className="text-xs text-[#5F6368] py-4 text-center">No notifications yet.</p>
                  ) : (
                    <div className="space-y-2 max-h-72 overflow-y-auto">
                      {notifications.slice(0, 8).map((n) => (
                        <div
                          key={n.id}
                          className={`p-2.5 rounded-lg border text-xs ${
                            n.isRead
                              ? 'bg-white border-[#E8EAED] text-[#5F6368]'
                              : 'bg-[#E8F0FE]/60 border-[#D2E3FC] text-[#202124]'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <span className="font-semibold text-[#202124]">{n.title}</span>
                            {!n.isRead && (
                              <button
                                type="button"
                                onClick={() => onMarkNotificationRead(n.id)}
                                className="text-[11px] text-[#1A73E8] hover:underline shrink-0"
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
                </div>
              )}
            </div>
          </header>

          <main className="flex-1 p-4 sm:p-8 max-w-[1440px] w-full mx-auto">{children}</main>
        </div>
      </div>
    </div>
  );
}
