import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ShieldAlert, Sparkles } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Button } from './ui/Button';

/**
 * Route guard.
 *
 * Two fixes over the old version: an unauthenticated visitor is *remembered*
 * and sent back to where they were headed after signing in, and a signed-in
 * user hitting a page their role cannot see gets an explanation instead of
 * being bounced to the login screen as if they were logged out.
 */

function BootScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-canvas">
      <motion.div
        initial={{ opacity: 0, scale: 0.94 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4 }}
        className="flex flex-col items-center gap-4"
      >
        <span className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-honey text-[rgb(var(--honey-ink))]">
          <span className="absolute inset-0 animate-pulse-ring rounded-2xl bg-honey/40" aria-hidden="true" />
          <Sparkles size={22} aria-hidden="true" />
        </span>
        <p className="text-[13px] text-ink-muted">Restoring your session…</p>
      </motion.div>
    </div>
  );
}

export function ProtectedRoute({ children, roles }) {
  const { user, loading, isAuthenticated } = useAuth();
  const location = useLocation();

  if (loading) return <BootScreen />;

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }

  if (roles && !roles.includes(user.role)) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center px-6 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-critical/12 text-critical">
          <ShieldAlert size={22} aria-hidden="true" />
        </span>
        <h2 className="mt-4 font-display text-xl font-semibold text-ink">This page is not part of your role</h2>
        <p className="mt-2 max-w-md text-[13.5px] leading-relaxed text-ink-muted">
          You are signed in as <span className="font-semibold text-ink">{user.role}</span>, which does not have
          access to this area. If you need it, ask an administrator to change your role.
        </p>
        <Button variant="primary" size="sm" className="mt-5" onClick={() => window.history.back()}>
          Go back
        </Button>
      </div>
    );
  }

  return children;
}

export default ProtectedRoute;
