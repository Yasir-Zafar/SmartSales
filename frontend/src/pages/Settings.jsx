import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Palette,
  ShieldCheck,
  KeyRound,
  MonitorSmartphone,
  LogOut,
  Monitor,
  Moon,
  Sun,
  Trash2,
  CheckCircle2,
  Info,
} from 'lucide-react';

import { api, errorMessage } from '../lib/api';
import { date, relativeTime, initials } from '../lib/format';
import { staggerParent, staggerChild } from '../lib/motion';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';
import { useTabParam } from '../hooks/useTabParam';
import { ROLE_META } from '../lib/nav';

import { PageHeader } from '../components/layout/PageHeader';
import { Card, CardHeader, Inset } from '../components/ui/Surface';
import { Button, IconButton } from '../components/ui/Button';
import { Input } from '../components/ui/Field';
import { Tabs } from '../components/ui/Tabs';
import { RoleBadge, Badge } from '../components/ui/Badge';
import { EmptyState } from '../components/ui/EmptyState';
import { Skeleton } from '../components/ui/Skeleton';
import { Modal } from '../components/ui/Modal';

/**
 * Settings — appearance, password and sessions.
 *
 * Entirely new. The old app had no way to change your own password, no way to
 * see where you were signed in, and no theme control. All three are things the
 * new auth layer makes possible, so they get a home.
 */

const TABS = ['appearance', 'security', 'sessions'];

const THEME_OPTIONS = [
  { value: null, label: 'Match system', icon: Monitor, description: 'Follow your device setting' },
  { value: 'light', label: 'Light', icon: Sun, description: 'Warm paper, dark ink' },
  { value: 'dark', label: 'Dark', icon: Moon, description: 'Deep ink, honey accents' },
];

/** Parses a user-agent into something a person can recognise. */
function describeDevice(userAgent) {
  const ua = String(userAgent || '');
  if (!ua) return 'Unknown device';

  const browser =
    /edg/i.test(ua) ? 'Edge'
    : /chrome|chromium/i.test(ua) ? 'Chrome'
    : /firefox/i.test(ua) ? 'Firefox'
    : /safari/i.test(ua) ? 'Safari'
    : 'Browser';

  const platform =
    /windows/i.test(ua) ? 'Windows'
    : /macintosh|mac os/i.test(ua) ? 'macOS'
    : /android/i.test(ua) ? 'Android'
    : /iphone|ipad/i.test(ua) ? 'iOS'
    : /linux/i.test(ua) ? 'Linux'
    : 'Unknown platform';

  return `${browser} on ${platform}`;
}

export function Settings() {
  const { user, logout, logoutEverywhere } = useAuth();
  const { preference, setTheme } = useTheme();
  const toast = useToast();
  const navigate = useNavigate();
  const [tab, setTab] = useTabParam('appearance', TABS);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

  const [sessions, setSessions] = useState([]);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [sessionsError, setSessionsError] = useState('');
  const [confirmLogoutAll, setConfirmLogoutAll] = useState(false);
  const [signingOutAll, setSigningOutAll] = useState(false);

  const loadSessions = useCallback(async () => {
    setLoadingSessions(true);
    setSessionsError('');
    try {
      const res = await api.get('/auth/sessions');
      setSessions(res.data?.sessions || []);
    } catch (err) {
      setSessionsError(errorMessage(err, 'Could not load your active sessions'));
    } finally {
      setLoadingSessions(false);
    }
  }, []);

  useEffect(() => {
    if (tab === 'sessions') loadSessions();
  }, [tab, loadSessions]);

  const changePassword = async (event) => {
    event.preventDefault();

    if (newPassword !== confirmPassword) {
      toast.error('Those passwords do not match', 'Retype the new password to confirm it.');
      return;
    }

    setChangingPassword(true);
    try {
      await api.post('/auth/change-password', { currentPassword, newPassword });
      toast.success('Password changed', 'You have been signed out everywhere. Sign in again with the new password.');
      // The server revoked every session, so the local one is gone too.
      setTimeout(() => navigate('/login', { replace: true }), 1200);
    } catch (err) {
      const problems = err.response?.data?.problems;
      toast.error(
        'Could not change your password',
        problems?.length ? `Password ${problems.join(', ')}` : errorMessage(err)
      );
    } finally {
      setChangingPassword(false);
    }
  };

  const endSession = async (id) => {
    try {
      await api.delete(`/auth/sessions/${id}`);
      toast.success('Session ended', 'That device has been signed out.');
      await loadSessions();
    } catch (err) {
      toast.error('Could not end that session', errorMessage(err));
    }
  };

  const signOutEverywhere = async () => {
    setSigningOutAll(true);
    try {
      await logoutEverywhere();
      navigate('/login', { replace: true });
    } catch (err) {
      toast.error('Could not sign out everywhere', errorMessage(err));
      setSigningOutAll(false);
      setConfirmLogoutAll(false);
    }
  };

  const passwordChecks = [
    { label: 'At least 10 characters', pass: newPassword.length >= 10 },
    { label: 'A lowercase letter', pass: /[a-z]/.test(newPassword) },
    { label: 'An uppercase letter', pass: /[A-Z]/.test(newPassword) },
    { label: 'A number', pass: /[0-9]/.test(newPassword) },
    { label: 'A symbol', pass: /[^A-Za-z0-9]/.test(newPassword) },
  ];
  const passwordValid = passwordChecks.every((check) => check.pass);

  return (
    <div>
      <PageHeader
        title="Settings"
        description="How the app looks, how your account is secured, and where you are currently signed in."
      />

      <motion.div variants={staggerParent} initial="initial" animate="animate">
        <motion.div variants={staggerChild}>
          <Card animate={false}>
            <div className="flex flex-wrap items-center gap-4">
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-honey/12 text-[17px] font-bold text-honey">
                {initials(user?.name || user?.email)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[16px] font-semibold text-ink">{user?.name || 'Your account'}</p>
                <p className="truncate text-[13px] text-ink-muted">{user?.email}</p>
              </div>
              <div className="text-right">
                <RoleBadge role={user?.role} />
                <p className="mt-1.5 max-w-[16rem] text-[11.5px] text-ink-faint">{ROLE_META[user?.role]?.blurb}</p>
              </div>
            </div>
          </Card>
        </motion.div>
      </motion.div>

      <div className="mt-6">
        <Tabs
          tabs={[
            { id: 'appearance', label: 'Appearance', icon: Palette },
            { id: 'security', label: 'Password', icon: KeyRound },
            { id: 'sessions', label: 'Sessions', icon: MonitorSmartphone, count: sessions.length || undefined },
          ]}
          value={tab}
          onChange={setTab}
          layoutId="settings-tabs"
        />
      </div>

      <div className="mt-4">
        {/* ── Appearance ───────────────────────────────────────────────── */}
        {tab === 'appearance' && (
          <Card animate={false}>
            <CardHeader
              title="Theme"
              description="Both themes are designed separately rather than one being an inverted copy of the other."
              icon={Palette}
            />
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              {THEME_OPTIONS.map((option) => {
                const active = preference === option.value;
                return (
                  <button
                    key={option.label}
                    type="button"
                    onClick={() => setTheme(option.value)}
                    aria-pressed={active}
                    className={`rounded-xl border p-4 text-left transition-[border-color,background-color,transform] duration-200 hover:-translate-y-0.5 ${
                      active ? 'border-honey/45 bg-honey/8' : 'border-hairline/10 hover:border-honey/25'
                    }`}
                  >
                    <span className="flex items-center justify-between">
                      <span
                        className={`flex h-9 w-9 items-center justify-center rounded-lg ${
                          active ? 'bg-honey/15 text-honey' : 'bg-hairline/8 text-ink-muted'
                        }`}
                      >
                        <option.icon size={16} aria-hidden="true" />
                      </span>
                      {active && <CheckCircle2 size={15} className="text-honey" aria-hidden="true" />}
                    </span>
                    <p className="mt-3 text-[13.5px] font-semibold text-ink">{option.label}</p>
                    <p className="mt-0.5 text-[12px] text-ink-muted">{option.description}</p>
                  </button>
                );
              })}
            </div>

            <Inset className="mt-5">
              <p className="flex items-start gap-2 text-[12px] leading-relaxed text-ink-muted">
                <Info size={13} className="mt-px shrink-0" aria-hidden="true" />
                Chart colours are chosen per theme and checked for colour-vision deficiency against each
                background, so nothing becomes indistinguishable when you switch.
              </p>
            </Inset>
          </Card>
        )}

        {/* ── Password ─────────────────────────────────────────────────── */}
        {tab === 'security' && (
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <Card animate={false}>
                <CardHeader
                  title="Change your password"
                  description="Your current password is required, and every device is signed out once it changes."
                  icon={KeyRound}
                />
                <form onSubmit={changePassword} className="mt-5 max-w-md space-y-4">
                  <Input
                    label="Current password"
                    type="password"
                    autoComplete="current-password"
                    required
                    value={currentPassword}
                    onChange={(event) => setCurrentPassword(event.target.value)}
                  />
                  <Input
                    label="New password"
                    type="password"
                    autoComplete="new-password"
                    required
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                  />
                  <Input
                    label="Confirm new password"
                    type="password"
                    autoComplete="new-password"
                    required
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    error={
                      confirmPassword && confirmPassword !== newPassword ? 'These do not match.' : undefined
                    }
                  />

                  {newPassword && (
                    <ul className="space-y-1.5">
                      {passwordChecks.map((check) => (
                        <li
                          key={check.label}
                          className={`flex items-center gap-2 text-[12px] ${check.pass ? 'text-good' : 'text-ink-faint'}`}
                        >
                          <CheckCircle2 size={12} className={check.pass ? '' : 'opacity-35'} aria-hidden="true" />
                          {check.label}
                        </li>
                      ))}
                    </ul>
                  )}

                  <Button
                    type="submit"
                    variant="primary"
                    icon={KeyRound}
                    loading={changingPassword}
                    disabled={!passwordValid || !currentPassword || newPassword !== confirmPassword}
                  >
                    Change password
                  </Button>
                </form>
              </Card>
            </div>

            <Card animate={false}>
              <CardHeader title="How your session is protected" icon={ShieldCheck} />
              <ul className="mt-4 space-y-3 text-[12.5px] leading-relaxed text-ink-muted">
                {[
                  'Your session lives in cookies the page’s JavaScript cannot read, so a script injection cannot steal it.',
                  'A short-lived access token is renewed silently from a refresh token that rotates on every use.',
                  'If an old refresh token is ever replayed, every session on your account is revoked automatically.',
                  'Changing a role, resetting a password or deactivating an account cuts existing sessions immediately.',
                ].map((line) => (
                  <li key={line} className="flex gap-2">
                    <ShieldCheck size={13} className="mt-0.5 shrink-0 text-good" aria-hidden="true" />
                    {line}
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        )}

        {/* ── Sessions ─────────────────────────────────────────────────── */}
        {tab === 'sessions' && (
          <Card animate={false}>
            <CardHeader
              title="Where you are signed in"
              description="One entry per device. Ending a session signs that device out immediately."
              icon={MonitorSmartphone}
              actions={
                <Button
                  size="sm"
                  variant="danger"
                  icon={LogOut}
                  onClick={() => setConfirmLogoutAll(true)}
                  disabled={!sessions.length}
                >
                  Sign out everywhere
                </Button>
              }
            />

            <div className="mt-5">
              {loadingSessions ? (
                <div className="space-y-2.5">
                  {Array.from({ length: 3 }).map((_, index) => (
                    <Skeleton key={index} className="h-[72px] w-full" />
                  ))}
                </div>
              ) : sessionsError ? (
                <EmptyState title="Could not load sessions" description={sessionsError} action={loadSessions} actionLabel="Try again" />
              ) : !sessions.length ? (
                <EmptyState
                  icon={MonitorSmartphone}
                  title="No other sessions"
                  description="You are only signed in here."
                />
              ) : (
                <ul className="space-y-2.5">
                  {sessions.map((session, index) => (
                    <motion.li
                      key={session.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="flex flex-wrap items-center gap-3 rounded-xl border border-hairline/8 p-4"
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-hairline/8 text-ink-muted">
                        <MonitorSmartphone size={16} aria-hidden="true" />
                      </span>

                      <div className="min-w-0 flex-1">
                        <p className="text-[13.5px] font-medium text-ink">{describeDevice(session.user_agent)}</p>
                        <p className="mt-0.5 text-[11.5px] text-ink-faint">
                          Last used {relativeTime(session.last_used_at)}
                          {session.ip_address ? ` · ${session.ip_address}` : ''} · started{' '}
                          {date(session.created_at)}
                        </p>
                      </div>

                      {index === 0 && (
                        <Badge tone="good" icon={CheckCircle2}>
                          Most recent
                        </Badge>
                      )}

                      <IconButton
                        icon={Trash2}
                        label="End this session"
                        size="sm"
                        variant="danger"
                        onClick={() => endSession(session.id)}
                      />
                    </motion.li>
                  ))}
                </ul>
              )}
            </div>

            <Inset className="mt-5">
              <p className="text-[12px] leading-relaxed text-ink-muted">
                Sessions expire on their own after a week of inactivity. Ending one here revokes its refresh
                token on the server, so it cannot be resumed.
              </p>
            </Inset>
          </Card>
        )}
      </div>

      <div className="mt-6 flex justify-end">
        <Button
          variant="ghost"
          icon={LogOut}
          onClick={async () => {
            await logout();
            navigate('/login', { replace: true });
          }}
        >
          Sign out of this device
        </Button>
      </div>

      <Modal
        open={confirmLogoutAll}
        onClose={() => setConfirmLogoutAll(false)}
        title="Sign out everywhere?"
        description="Every device, including this one, will be signed out."
        icon={LogOut}
        size="sm"
        busy={signingOutAll}
        footer={
          <>
            <Button onClick={() => setConfirmLogoutAll(false)} disabled={signingOutAll}>
              Cancel
            </Button>
            <Button variant="danger" icon={LogOut} onClick={signOutEverywhere} loading={signingOutAll}>
              Sign out everywhere
            </Button>
          </>
        }
      >
        <p className="text-[13px] leading-relaxed text-ink-soft">
          Use this if you have signed in on a device you no longer control. You will need to sign in again here
          afterwards.
        </p>
      </Modal>
    </div>
  );
}

export default Settings;
