import { useState } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { createPortal } from 'react-dom';
import {
  Menu, Sun, Moon, LogOut, Command,
  LayoutDashboard, CheckSquare, BookOpen, GraduationCap,
  LineChart, Receipt, Wallet, ArrowDownLeft, ArrowUpRight, PieChart, Target,
  Wrench, Code, FileText, ClipboardCheck, Bug, Map,
} from 'lucide-react';
import api from '../../lib/api';
import { useTheme } from '../../hooks/useTheme';
import { useToast } from '../../hooks/useToast';
import { Button } from '../ui/Button';
import { QuickCapture } from '../shared/QuickCapture';

// Single source of truth for nav, grouped into labelled sections. The Finance
// module fans out into its own section after the multi-account upgrade.
const NAV_SECTIONS = [
  {
    items: [
      { to: '/',     label: 'Dashboard', icon: LayoutDashboard, end: true },
      { to: '/todo', label: 'To-Do',     icon: CheckSquare },
    ],
  },
  {
    label: 'Finance',
    items: [
      { to: '/finance/dashboard',   label: 'Overview',     icon: LineChart },
      { to: '/finance',             label: 'Transactions', icon: Receipt, end: true },
      { to: '/finance/accounts',    label: 'Accounts',     icon: Wallet },
      { to: '/finance/receivables', label: 'Receivables',  icon: ArrowDownLeft },
      { to: '/finance/payables',    label: 'Payables',     icon: ArrowUpRight },
      { to: '/finance/portfolio',   label: 'Portfolio',    icon: PieChart },
      { to: '/finance/budget',      label: 'Budget',       icon: Target },
    ],
  },
  {
    label: 'Knowledge',
    items: [
      { to: '/research', label: 'Research', icon: BookOpen },
      { to: '/learning', label: 'Learning', icon: GraduationCap },
    ],
  },
  {
    label: 'Engineering',
    items: [
      { to: '/engineer',          label: 'Projects',  icon: Wrench, end: true },
      { to: '/engineer/snippets', label: 'Snippets',  icon: Code },
      { to: '/engineer/docs',     label: 'Docs',      icon: FileText },
      { to: '/engineer/checkins', label: 'Check-ins', icon: ClipboardCheck },
      { to: '/engineer/issues',   label: 'Issues',    icon: Bug },
      { to: '/engineer/roadmap',  label: 'Roadmap',   icon: Map },
    ],
  },
];

const navLinkClass = ({ isActive }) =>
  `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors duration-150 ${
    isActive
      ? 'bg-moss-50 dark:bg-moss-950/50 text-moss-700 dark:text-moss-400'
      : 'text-stone-600 dark:text-gray-400 hover:bg-stone-100 dark:hover:bg-gray-700 hover:text-stone-900 dark:hover:text-gray-100'
  }`;

/**
 * Shared inner content for both the fixed desktop sidebar and the mobile drawer.
 * @param {{ onNavigate?: () => void }} props
 */
function SidebarContent({ onNavigate }) {
  const { isDark, toggle } = useTheme();
  const navigate = useNavigate();
  const { addToast } = useToast();
  const [loggingOut, setLoggingOut] = useState(false);

  /**
   * Destroy the server session, then redirect to /login. We navigate even if the
   * request fails so the user is never stranded in a half-authenticated state.
   */
  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await api.post('/api/auth/logout');
      addToast({ type: 'success', title: 'Signed out' });
    } catch (err) {
      addToast({ type: 'error', title: 'Logout failed', message: err.message });
    } finally {
      onNavigate?.();
      navigate('/login', { replace: true });
    }
  };

  return (
    <>
      {/* Logo — "Stoic Garden": moss wordmark with an ember innovation dot */}
      <div className="h-16 flex items-center px-6 border-b border-stone-200 dark:border-gray-700">
        <div>
          <p className="text-sm font-bold text-moss-700 dark:text-moss-400 tracking-tight">
            Rafli's Suite
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-ember-500 ml-1 align-middle" />
          </p>
          <p className="text-[10px] text-stone-400 dark:text-gray-500 tracking-widest uppercase">
            Laboratory
          </p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-4">
        {NAV_SECTIONS.map((section, i) => (
          <div key={section.label ?? `section-${i}`} className="space-y-1">
            {section.label && (
              <p className="px-3 mb-1 text-[10px] font-semibold text-terracotta-400 dark:text-terracotta-400 tracking-widest uppercase">
                {section.label}
              </p>
            )}
            {section.items.map(({ to, label, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end ?? false}
                className={navLinkClass}
                onClick={onNavigate}
              >
                <Icon size={18} />
                {label}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      {/* Footer: quick capture + theme toggle */}
      <div className="p-4 border-t border-stone-200 dark:border-gray-700 space-y-2">
        {/* Quick capture trigger — the global Cmd/Ctrl+K listener lives in
            <QuickCapture/>; this button just opens it via a window event. */}
        <button
          onClick={() => { onNavigate?.(); window.dispatchEvent(new Event('open-quick-capture')); }}
          className="w-full flex items-center justify-between gap-3 px-3 py-2 rounded-lg text-sm font-medium
            text-stone-600 dark:text-gray-400
            hover:bg-stone-100 dark:hover:bg-gray-700
            transition-colors duration-150"
        >
          <span className="flex items-center gap-3">
            <Command size={18} />
            Quick capture
          </span>
          <kbd className="px-1.5 py-0.5 text-[10px] bg-stone-200 dark:bg-gray-700 rounded">⌘K</kbd>
        </button>

        <button
          onClick={toggle}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium
            text-stone-600 dark:text-gray-400
            hover:bg-stone-100 dark:hover:bg-gray-700
            transition-colors duration-150"
        >
          {isDark ? <Sun size={18} /> : <Moon size={18} />}
          {isDark ? 'Light mode' : 'Dark mode'}
        </button>

        {/* Logout — POST /api/auth/logout then redirect to /login */}
        <Button
          variant="ghost"
          size="md"
          onClick={handleLogout}
          disabled={loggingOut}
          aria-label="Log out"
          className="w-full justify-start"
        >
          <LogOut size={18} />
          {loggingOut ? 'Signing out…' : 'Log out'}
        </Button>
      </div>
    </>
  );
}

/**
 * AppLayout — owns the entire visual frame: sidebar, mobile drawer, top bar,
 * and the routed page via <Outlet />. Pages never render the sidebar or
 * apply a sidebar offset themselves (see SKILL.md §9.3).
 */
export function AppLayout() {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <div className="min-h-screen bg-stone-50 dark:bg-gray-900">

      {/* Desktop sidebar — fixed, lg+ only */}
      <aside className="hidden lg:flex fixed left-0 top-0 h-full w-64 bg-white dark:bg-gray-800 border-r border-stone-200 dark:border-gray-700 flex-col z-30">
        <SidebarContent />
      </aside>

      {/* Mobile drawer + backdrop — below lg only, rendered via portal */}
      {drawerOpen && createPortal(
        <div className="lg:hidden">
          <div
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
            onClick={() => setDrawerOpen(false)}
          />
          <aside className="fixed left-0 top-0 h-full w-64 z-40 bg-white dark:bg-gray-800 border-r border-stone-200 dark:border-gray-700 flex flex-col">
            <SidebarContent onNavigate={() => setDrawerOpen(false)} />
          </aside>
        </div>,
        document.body
      )}

      {/* Main region — offset for the fixed sidebar at lg+ */}
      <div className="lg:pl-64">

        {/* Mobile top bar with hamburger — hidden at lg+ */}
        <header className="lg:hidden h-16 flex items-center gap-3 px-4 border-b border-stone-200 dark:border-gray-700 bg-white dark:bg-gray-800">
          <button
            onClick={() => setDrawerOpen(true)}
            aria-label="Open navigation"
            className="p-2 rounded-md text-stone-600 dark:text-gray-400 hover:bg-stone-100 dark:hover:bg-gray-700 transition-colors duration-150"
          >
            <Menu size={20} />
          </button>
          <p className="text-sm font-bold text-stone-900 dark:text-gray-50 tracking-tight">
            Rafli's Suite
          </p>
        </header>

        <main className="min-h-screen">
          <Outlet />
        </main>

      </div>

      {/* Global quick-capture palette — single instance owns the Cmd/Ctrl+K
          shortcut app-wide (mounting twice would double-toggle). */}
      <QuickCapture />
    </div>
  );
}
