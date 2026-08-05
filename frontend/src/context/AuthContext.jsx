import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  api,
  clearSessionEstablished,
  errorMessage,
  markSessionEstablished,
  onSessionEnded,
  refreshSession,
} from '../lib/api';

const AuthContext = createContext(null);

/**
 * Session state.
 *
 * Nothing about the session is stored in localStorage any more — the tokens
 * live in httpOnly cookies the page cannot read. "Am I signed in?" is answered
 * by asking the server once on boot, and kept true by refreshing on a timer
 * before the 15-minute access token can lapse.
 */

// Refresh comfortably inside the access token's lifetime so a slow network or a
// sleeping laptop still lands the renewal before expiry.
const PROACTIVE_REFRESH_MS = 12 * 60 * 1000;

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [status, setStatus] = useState('loading'); // loading | authenticated | anonymous
  const [sessionNotice, setSessionNotice] = useState(null);
  const refreshTimer = useRef(null);

  const clearTimer = useCallback(() => {
    if (refreshTimer.current) {
      clearInterval(refreshTimer.current);
      refreshTimer.current = null;
    }
  }, []);

  const applyUser = useCallback((nextUser) => {
    setUser(nextUser);
    setStatus(nextUser ? 'authenticated' : 'anonymous');
    if (nextUser) markSessionEstablished();
    else clearSessionEstablished();
  }, []);

  // Boot: ask the server who we are. A 401 here just means "not signed in".
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const res = await api.get('/auth/me');
        if (!cancelled) applyUser(res.data.user);
      } catch (error) {
        if (cancelled) return;
        // The access cookie may simply have aged out while the tab was closed;
        // the refresh cookie can still resurrect the session silently.
        if (error?.response?.status === 401) {
          try {
            const refreshed = await refreshSession();
            if (!cancelled) applyUser(refreshed.user);
            return;
          } catch {
            /* falls through to anonymous */
          }
        }
        if (!cancelled) applyUser(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [applyUser]);

  // Keep the session warm while the user is actually using the app.
  useEffect(() => {
    clearTimer();
    if (status !== 'authenticated') return undefined;

    refreshTimer.current = setInterval(() => {
      if (document.visibilityState === 'hidden') return;
      refreshSession().catch(() => {
        /* the response interceptor handles a hard failure */
      });
    }, PROACTIVE_REFRESH_MS);

    return clearTimer;
  }, [status, clearTimer]);

  // The API layer shouts when a session is definitively over (revoked, reused,
  // deactivated). Turn that into one clean sign-out with an explanation.
  useEffect(
    () =>
      onSessionEnded((reason) => {
        const notices = {
          REFRESH_REUSE: 'Your session was ended because the same sign-in was detected on another device.',
          ACCOUNT_DISABLED: 'This account has been deactivated. Contact your administrator.',
          TOKEN_STALE: 'Your access changed, so you have been signed out. Please sign in again.',
          SESSION_ENDED: 'Your session expired. Please sign in again.',
        };
        setSessionNotice(notices[reason] || 'Your session expired. Please sign in again.');
        applyUser(null);
      }),
    [applyUser]
  );

  const login = useCallback(
    async (email, password) => {
      setSessionNotice(null);
      const res = await api.post('/auth/login', { email, password });
      applyUser(res.data.user);
      return res.data.user;
    },
    [applyUser]
  );

  const logout = useCallback(async () => {
    try {
      await api.post('/auth/logout');
    } catch {
      // The cookies get cleared server-side on a best-effort basis; either way
      // the local session ends here.
    }
    setSessionNotice(null);
    applyUser(null);
  }, [applyUser]);

  const logoutEverywhere = useCallback(async () => {
    await api.post('/auth/logout-all');
    setSessionNotice(null);
    applyUser(null);
  }, [applyUser]);

  const value = useMemo(
    () => ({
      user,
      role: user?.role || null,
      status,
      loading: status === 'loading',
      isAuthenticated: status === 'authenticated',
      sessionNotice,
      clearSessionNotice: () => setSessionNotice(null),
      login,
      logout,
      logoutEverywhere,
      errorMessage,
    }),
    [user, status, sessionNotice, login, logout, logoutEverywhere]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
};

export default AuthContext;
