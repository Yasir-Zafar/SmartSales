import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Upload, RefreshCcw, Moon, Sun, LogOut, Sparkles } from 'lucide-react';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { CommandPalette } from './CommandPalette';
import { Backdrop } from '../Backdrop';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { ALL_NAV_ITEMS } from '../../lib/nav';
import { api } from '../../lib/api';
import { DURATION, EASE, pageVariants } from '../../lib/motion';

/**
 * The application frame.
 *
 * One shell hosts every screen, which is why pages no longer each import a
 * Navbar and re-implement the page chrome. It also owns the two pieces of
 * cross-page state — the anomaly count in the bell, and the command palette —
 * so twelve pages are not each polling the same endpoint.
 */

const ANOMALY_POLL_MS = 5 * 60 * 1000;
const SIDEBAR_STORAGE_KEY = 'smartsales:sidebar-collapsed';

export function AppShell() {
  const { user, logout } = useAuth();
  const { isDark, toggle } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();

  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(SIDEBAR_STORAGE_KEY) === 'true';
    } catch {
      return false;
    }
  });
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [commandOpen, setCommandOpen] = useState(false);
  const [anomalyCount, setAnomalyCount] = useState(0);

  const role = user?.role;

  const toggleCollapsed = useCallback(() => {
    setCollapsed((current) => {
      const next = !current;
      try {
        localStorage.setItem(SIDEBAR_STORAGE_KEY, String(next));
      } catch {
        /* non-fatal */
      }
      return next;
    });
  }, []);

  // Global shortcut. Cmd+K on macOS, Ctrl+K elsewhere.
  useEffect(() => {
    const onKeyDown = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setCommandOpen((open) => !open);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  // Close the mobile drawer whenever the route changes.
  useEffect(() => setDrawerOpen(false), [location.pathname]);

  // Shared anomaly count for the bell badge and the sidebar dot.
  useEffect(() => {
    if (!['OWNER', 'ANALYST', 'ADMIN'].includes(role)) return undefined;

    let cancelled = false;
    const load = async () => {
      try {
        const res = await api.get('/insights/alerts/notifications/abnormal-drops');
        if (!cancelled) setAnomalyCount(Number(res.data?.count || 0));
      } catch {
        // The ML service being down should not spam the console or the UI here;
        // the Anomalies page explains it properly when the user goes looking.
      }
    };

    load();
    const timer = setInterval(load, ANOMALY_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [role]);

  const currentItem = useMemo(() => {
    const matches = ALL_NAV_ITEMS.filter((item) => location.pathname.startsWith(item.to));
    // Longest prefix wins so /sales/compare does not resolve to /sales.
    return matches.sort((a, b) => b.to.length - a.to.length)[0];
  }, [location.pathname]);

  const commandActions = useMemo(
    () => [
      {
        id: 'action-upload',
        kind: 'action',
        label: 'Upload sales CSV',
        description: 'Add a new day of sales data',
        keywords: ['upload', 'import', 'csv', 'add data'],
        icon: Upload,
        roles: ['STAFF', 'ADMIN'],
        run: () => navigate('/data?tab=upload'),
      },
      {
        id: 'action-retrain',
        kind: 'action',
        label: 'Retrain the model',
        description: 'Export a training window and reload the AI service',
        keywords: ['retrain', 'train', 'model', 'reload', 'ml'],
        icon: RefreshCcw,
        roles: ['ANALYST', 'ADMIN'],
        run: () => navigate('/data?tab=training'),
      },
      {
        id: 'action-theme',
        kind: 'action',
        label: isDark ? 'Switch to light theme' : 'Switch to dark theme',
        description: 'Change the appearance of the app',
        keywords: ['theme', 'dark', 'light', 'appearance', 'mode'],
        icon: isDark ? Sun : Moon,
        run: toggle,
      },
      {
        id: 'action-logout',
        kind: 'action',
        label: 'Sign out',
        description: 'End this session on this device',
        keywords: ['logout', 'sign out', 'exit', 'leave'],
        icon: LogOut,
        run: async () => {
          await logout();
          navigate('/login', { replace: true });
        },
      },
    ],
    [isDark, toggle, logout, navigate]
  );

  const sidebarWidth = collapsed ? 76 : 264;

  return (
    <div className="relative min-h-screen">
      <Backdrop />

      <div className="relative z-10 flex min-h-screen">
        {/* Desktop rail */}
        <motion.aside
          animate={{ width: sidebarWidth }}
          transition={{ duration: DURATION.base, ease: EASE }}
          className="sticky top-0 hidden h-screen shrink-0 border-r border-hairline/8 bg-panel/55 backdrop-blur-xl lg:block"
        >
          <Sidebar collapsed={collapsed} onToggleCollapse={toggleCollapsed} badges={{ anomalies: anomalyCount }} />
        </motion.aside>

        {/* Mobile drawer */}
        <AnimatePresence>
          {drawerOpen && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setDrawerOpen(false)}
                className="fixed inset-0 z-50 bg-canvas/70 backdrop-blur-sm lg:hidden"
              />
              <motion.aside
                initial={{ x: '-100%' }}
                animate={{ x: 0 }}
                exit={{ x: '-100%' }}
                transition={{ duration: DURATION.base, ease: EASE }}
                className="fixed inset-y-0 left-0 z-50 w-[264px] border-r border-hairline/10 bg-panel shadow-lift lg:hidden"
              >
                <Sidebar
                  collapsed={false}
                  onToggleCollapse={toggleCollapsed}
                  badges={{ anomalies: anomalyCount }}
                  onNavigate={() => setDrawerOpen(false)}
                />
              </motion.aside>
            </>
          )}
        </AnimatePresence>

        {/* Main column */}
        <div className="flex min-w-0 flex-1 flex-col">
          <TopBar
            title={currentItem?.label || 'SmartSales'}
            subtitle={currentItem?.description}
            onOpenSidebar={() => setDrawerOpen(true)}
            onOpenCommand={() => setCommandOpen(true)}
            anomalyCount={anomalyCount}
          />

          <main className="min-w-0 flex-1 px-4 pb-14 pt-6 sm:px-6">
            <AnimatePresence mode="wait">
              <motion.div
                key={location.pathname}
                variants={pageVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                className="mx-auto w-full max-w-[1400px]"
              >
                <Outlet />
              </motion.div>
            </AnimatePresence>
          </main>

          <footer className="border-t border-hairline/6 px-6 py-4">
            <p className="flex items-center gap-1.5 text-[11.5px] text-ink-faint">
              <Sparkles size={11} aria-hidden="true" />
              SmartSales — sales intelligence for retail teams
            </p>
          </footer>
        </div>
      </div>

      <CommandPalette
        open={commandOpen}
        onClose={() => setCommandOpen(false)}
        role={role}
        actions={commandActions}
      />
    </div>
  );
}

export default AppShell;
