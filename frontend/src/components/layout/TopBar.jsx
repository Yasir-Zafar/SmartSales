import React, { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Search,
  Menu,
  Moon,
  Sun,
  Bell,
  LogOut,
  Settings as SettingsIcon,
  ChevronDown,
  RefreshCw,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { initials, relativeTime } from '../../lib/format';
import { ROLE_META } from '../../lib/nav';
import { DURATION, EASE } from '../../lib/motion';
import { IconButton } from '../ui/Button';
import { RoleBadge, LiveDot } from '../ui/Badge';

/**
 * Top bar.
 *
 * Carries the things that are true everywhere — where you are, how fresh the
 * data is, what needs attention, and who you are signed in as — so individual
 * pages never have to re-render a "Welcome, user@example.com" line.
 */

export function TopBar({
  title,
  subtitle,
  onOpenSidebar,
  onOpenCommand,
  anomalyCount = 0,
  lastUpdated,
  onRefresh,
  refreshing = false,
}) {
  const { user, logout } = useAuth();
  const { isDark, toggle } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!menuOpen) return undefined;
    const onClickAway = (event) => {
      if (!menuRef.current?.contains(event.target)) setMenuOpen(false);
    };
    document.addEventListener('mousedown', onClickAway);
    return () => document.removeEventListener('mousedown', onClickAway);
  }, [menuOpen]);

  const handleLogout = async () => {
    setMenuOpen(false);
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <header className="sticky top-0 z-40 border-b border-hairline/8 bg-canvas/80 backdrop-blur-xl">
      <div className="flex h-16 items-center gap-3 px-4 sm:px-6">
        <IconButton icon={Menu} label="Open navigation" onClick={onOpenSidebar} className="lg:hidden" />

        <div className="min-w-0 flex-1">
          <h1 className="truncate font-display text-[17px] font-semibold leading-tight tracking-tight text-ink">
            {title}
          </h1>
          {subtitle && <p className="truncate text-[12px] text-ink-muted">{subtitle}</p>}
        </div>

        {/* Freshness: the app polls, so say plainly when the numbers last moved. */}
        {lastUpdated && (
          <div className="hidden items-center gap-2 xl:flex">
            <LiveDot active label={`Updated ${relativeTime(lastUpdated)}`} />
            {onRefresh && (
              <IconButton
                icon={RefreshCw}
                label="Refresh data"
                size="sm"
                onClick={onRefresh}
                className={refreshing ? 'animate-spin' : ''}
              />
            )}
          </div>
        )}

        {/* Command palette trigger — visible so the shortcut is discoverable. */}
        <button
          type="button"
          onClick={onOpenCommand}
          className="hidden items-center gap-2 rounded-xl border border-hairline/10 bg-panel/70 py-2 pl-3 pr-2 text-[13px] text-ink-muted transition-colors hover:border-honey/30 hover:text-ink md:flex"
        >
          <Search size={14} aria-hidden="true" />
          <span>Search…</span>
          <kbd className="rounded-md border border-hairline/12 bg-sunken px-1.5 py-0.5 font-sans text-[10px] text-ink-faint">
            ⌘K
          </kbd>
        </button>

        <IconButton icon={Search} label="Search" onClick={onOpenCommand} className="md:hidden" />

        <Link
          to="/anomalies"
          className="relative inline-flex h-9 w-9 items-center justify-center rounded-[10px] text-ink-soft transition-colors hover:bg-hairline/8 hover:text-ink"
          aria-label={anomalyCount > 0 ? `${anomalyCount} anomaly alerts` : 'Alerts'}
          title={anomalyCount > 0 ? `${anomalyCount} products flagged` : 'No active alerts'}
        >
          <Bell size={16} aria-hidden="true" />
          {anomalyCount > 0 && (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-critical px-1 text-[9px] font-bold text-white tabular"
            >
              {anomalyCount > 99 ? '99+' : anomalyCount}
            </motion.span>
          )}
        </Link>

        <IconButton
          icon={isDark ? Sun : Moon}
          label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
          onClick={toggle}
        />

        {/* Account */}
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            aria-expanded={menuOpen}
            aria-haspopup="menu"
            className="flex items-center gap-2 rounded-xl py-1 pl-1 pr-1.5 transition-colors hover:bg-hairline/8"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-honey/15 text-[12px] font-bold text-honey">
              {initials(user?.name || user?.email)}
            </span>
            <ChevronDown size={13} className="hidden text-ink-faint sm:block" aria-hidden="true" />
          </button>

          <AnimatePresence>
            {menuOpen && (
              <motion.div
                role="menu"
                initial={{ opacity: 0, y: -6, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -4, scale: 0.98 }}
                transition={{ duration: DURATION.fast, ease: EASE }}
                className="absolute right-0 top-full mt-2 w-60 overflow-hidden rounded-card bg-panel shadow-lift"
                style={{ border: '1px solid rgb(var(--hairline) / 0.1)' }}
              >
                <div className="border-b border-hairline/8 p-3.5">
                  <p className="truncate text-[13.5px] font-semibold text-ink">{user?.name || 'Signed in'}</p>
                  <p className="truncate text-[12px] text-ink-muted">{user?.email}</p>
                  <div className="mt-2 flex items-center gap-2">
                    <RoleBadge role={user?.role} size="xs" />
                    <span className="truncate text-[11px] text-ink-faint">{ROLE_META[user?.role]?.label}</span>
                  </div>
                </div>

                <div className="p-1.5">
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setMenuOpen(false);
                      navigate('/settings');
                    }}
                    className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] text-ink-soft transition-colors hover:bg-hairline/8 hover:text-ink"
                  >
                    <SettingsIcon size={14} aria-hidden="true" />
                    Settings &amp; security
                  </button>
                  <button
                    type="button"
                    role="menuitem"
                    onClick={handleLogout}
                    className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] text-critical transition-colors hover:bg-critical/10"
                  >
                    <LogOut size={14} aria-hidden="true" />
                    Sign out
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </header>
  );
}

export default TopBar;
