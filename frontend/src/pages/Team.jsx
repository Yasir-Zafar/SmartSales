import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Users,
  UserPlus,
  UserCog,
  Search,
  ShieldCheck,
  ShieldOff,
  KeyRound,
  RefreshCcw,
  CheckCircle2,
  Ban,
  Crown,
  AlertTriangle,
} from 'lucide-react';

import { api, errorMessage } from '../lib/api';
import { num, date, initials, relativeTime } from '../lib/format';
import { staggerParent } from '../lib/motion';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useTabParam } from '../hooks/useTabParam';
import { ROLE_META } from '../lib/nav';

import { PageHeader } from '../components/layout/PageHeader';
import { Card, CardHeader, Inset } from '../components/ui/Surface';
import { StatCard } from '../components/ui/StatCard';
import { Button } from '../components/ui/Button';
import { Input, Select, SearchInput } from '../components/ui/Field';
import { Tabs } from '../components/ui/Tabs';
import { DataTable } from '../components/ui/DataTable';
import { RoleBadge, Badge } from '../components/ui/Badge';
import { EmptyState, NoResultsState } from '../components/ui/EmptyState';
import { Modal } from '../components/ui/Modal';

/**
 * Team — account administration.
 *
 * Was three separate admin pages (view users, create user, edit user) with a
 * lookup form that only accepted an exact email. Now it is one page: the
 * directory is the entry point, and managing someone starts by selecting their
 * row.
 */

const TABS = ['directory', 'invite', 'manage'];

const ROLE_OPTIONS = [
  { value: 'OWNER', label: 'Owner — full business access' },
  { value: 'ANALYST', label: 'Analyst — model accuracy and exports' },
  { value: 'STAFF', label: 'Staff — daily operations' },
];

/** Live feedback so an admin is not guessing at the server's password policy. */
function PasswordStrength({ value }) {
  const checks = [
    { label: '10+ characters', pass: value.length >= 10 },
    { label: 'lowercase', pass: /[a-z]/.test(value) },
    { label: 'uppercase', pass: /[A-Z]/.test(value) },
    { label: 'number', pass: /[0-9]/.test(value) },
    { label: 'symbol', pass: /[^A-Za-z0-9]/.test(value) },
  ];
  const passed = checks.filter((check) => check.pass).length;

  return (
    <div className="mt-2">
      <div className="flex gap-1" aria-hidden="true">
        {checks.map((check, index) => (
          <span
            key={check.label}
            className={`h-1 flex-1 rounded-full transition-colors ${
              index < passed ? (passed === 5 ? 'bg-good' : passed >= 3 ? 'bg-warn' : 'bg-critical') : 'bg-hairline/12'
            }`}
          />
        ))}
      </div>
      <p className="mt-1.5 text-[11.5px] text-ink-faint">
        Needs: {checks.filter((check) => !check.pass).map((check) => check.label).join(', ') || 'nothing — this one is good'}
      </p>
    </div>
  );
}

export function Team() {
  const { user: currentUser } = useAuth();
  const toast = useToast();
  const [tab, setTab] = useTabParam('directory', TABS);

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');

  // Invite form
  const [invite, setInvite] = useState({ name: '', email: '', password: '', role: 'STAFF' });
  const [inviting, setInviting] = useState(false);

  // Manage
  const [selected, setSelected] = useState(null);
  const [newRole, setNewRole] = useState('STAFF');
  const [newPassword, setNewPassword] = useState('');
  const [busyAction, setBusyAction] = useState(null);
  const [confirmDeactivate, setConfirmDeactivate] = useState(false);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/admin/users/list');
      setUsers(res.data?.users || []);
    } catch (err) {
      setError(errorMessage(err, 'Could not load the user list'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  // Keep the manage panel in step with the freshly-loaded list.
  useEffect(() => {
    if (!selected) return;
    const updated = users.find((entry) => entry.id === selected.id);
    if (updated) {
      setSelected(updated);
      setNewRole(updated.role);
    }
  }, [users, selected?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return users;
    return users.filter(
      (entry) =>
        String(entry.email || '').toLowerCase().includes(q) ||
        String(entry.name || '').toLowerCase().includes(q) ||
        String(entry.role || '').toLowerCase().includes(q)
    );
  }, [users, query]);

  const stats = useMemo(
    () => ({
      total: users.length,
      active: users.filter((entry) => entry.active).length,
      deactivated: users.filter((entry) => !entry.active).length,
      owners: users.filter((entry) => entry.role === 'OWNER').length,
    }),
    [users]
  );

  const selectUser = (entry) => {
    setSelected(entry);
    setNewRole(entry.role);
    setNewPassword('');
    setTab('manage');
  };

  const createUser = async (event) => {
    event.preventDefault();
    setInviting(true);
    try {
      await api.post('/admin/create-user', invite);
      toast.success('Account created', `${invite.email} can now sign in as ${invite.role}.`);
      setInvite({ name: '', email: '', password: '', role: 'STAFF' });
      await loadUsers();
      setTab('directory');
    } catch (err) {
      const problems = err.response?.data?.problems;
      toast.error(
        'Could not create the account',
        problems?.length ? `Password ${problems.join(', ')}` : errorMessage(err)
      );
    } finally {
      setInviting(false);
    }
  };

  const changeRole = async () => {
    if (!selected) return;
    setBusyAction('role');
    try {
      const res = await api.patch(`/admin/users/${selected.id}/role`, { role: newRole });
      toast.success('Role updated', res.data?.message);
      await loadUsers();
    } catch (err) {
      toast.error('Could not change the role', errorMessage(err));
    } finally {
      setBusyAction(null);
    }
  };

  const resetPassword = async () => {
    if (!selected || !newPassword) return;
    setBusyAction('password');
    try {
      const res = await api.patch(`/admin/users/${selected.id}/password`, { password: newPassword });
      toast.success('Password reset', res.data?.message);
      setNewPassword('');
    } catch (err) {
      const problems = err.response?.data?.problems;
      toast.error('Could not reset the password', problems?.length ? `Password ${problems.join(', ')}` : errorMessage(err));
    } finally {
      setBusyAction(null);
    }
  };

  const toggleActive = async () => {
    if (!selected) return;
    setBusyAction('status');
    setConfirmDeactivate(false);
    try {
      const res = await api.patch(`/admin/users/${selected.id}/status`, { active: !selected.active });
      toast.success(selected.active ? 'Account deactivated' : 'Account reactivated', res.data?.message);
      await loadUsers();
    } catch (err) {
      toast.error('Could not change the account status', errorMessage(err));
    } finally {
      setBusyAction(null);
    }
  };

  const isSelf = selected?.id === currentUser?.id;

  return (
    <div>
      <PageHeader
        title="Team"
        description="Create accounts, set what each person can reach, and cut off access when someone leaves."
        actions={
          <Button size="sm" icon={RefreshCcw} onClick={loadUsers} loading={loading}>
            Refresh
          </Button>
        }
      />

      <motion.div variants={staggerParent} initial="initial" animate="animate" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="People" numericValue={stats.total} format={(v) => num(Math.round(v))} icon={Users} accent loading={loading} />
        <StatCard label="Active" numericValue={stats.active} format={(v) => num(Math.round(v))} icon={CheckCircle2} loading={loading} />
        <StatCard label="Deactivated" numericValue={stats.deactivated} format={(v) => num(Math.round(v))} icon={Ban} loading={loading} />
        <StatCard label="Owners" numericValue={stats.owners} format={(v) => num(Math.round(v))} icon={Crown} loading={loading} />
      </motion.div>

      <div className="mt-6">
        <Tabs
          tabs={[
            { id: 'directory', label: 'Directory', icon: Users, count: users.length },
            { id: 'invite', label: 'Add someone', icon: UserPlus },
            { id: 'manage', label: 'Manage access', icon: UserCog },
          ]}
          value={tab}
          onChange={setTab}
          layoutId="team-tabs"
        />
      </div>

      <div className="mt-4">
        {/* ── Directory ────────────────────────────────────────────────── */}
        {tab === 'directory' && (
          <Card animate={false}>
            <CardHeader
              title="Everyone with an account"
              description="Select a row to change that person's role, reset their password or revoke access."
              icon={Users}
            />
            <div className="mt-4 max-w-sm">
              <SearchInput
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search by name, email or role…"
              />
            </div>

            <div className="mt-4">
              {error ? (
                <EmptyState title="Could not load users" description={error} action={loadUsers} actionLabel="Try again" />
              ) : !loading && !filtered.length ? (
                query ? (
                  <NoResultsState query={query} onClear={() => setQuery('')} />
                ) : (
                  <EmptyState icon={UserPlus} title="No accounts yet" description="Add your first team member." />
                )
              ) : (
                <DataTable
                  loading={loading}
                  columns={[
                    {
                      key: 'name',
                      header: 'Person',
                      value: (row) => row.name || row.email,
                      render: (row) => (
                        <span className="flex items-center gap-2.5">
                          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-honey/12 text-[10.5px] font-bold text-honey">
                            {initials(row.name || row.email)}
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate font-medium text-ink">{row.name || '—'}</span>
                            <span className="block truncate text-[11.5px] text-ink-faint">{row.email}</span>
                          </span>
                        </span>
                      ),
                    },
                    {
                      key: 'role',
                      header: 'Role',
                      value: (row) => row.role,
                      render: (row) => <RoleBadge role={row.role} />,
                    },
                    {
                      key: 'active',
                      header: 'Status',
                      value: (row) => (row.active ? 1 : 0),
                      render: (row) =>
                        row.active ? (
                          <Badge tone="good" icon={ShieldCheck}>
                            Active
                          </Badge>
                        ) : (
                          <Badge tone="critical" icon={ShieldOff}>
                            Deactivated
                          </Badge>
                        ),
                    },
                    {
                      key: 'last_logged_in',
                      header: 'Last signed in',
                      align: 'right',
                      value: (row) => (row.last_logged_in ? new Date(row.last_logged_in).getTime() : 0),
                      render: (row) =>
                        row.last_logged_in ? (
                          <span title={date(row.last_logged_in, { withTime: true })} className="text-ink-muted">
                            {relativeTime(row.last_logged_in)}
                          </span>
                        ) : (
                          <span className="text-ink-faint">Never</span>
                        ),
                    },
                  ]}
                  rows={filtered}
                  rowKey={(row) => row.id}
                  onRowClick={selectUser}
                  maxHeight="34rem"
                  caption="All user accounts"
                />
              )}
            </div>
          </Card>
        )}

        {/* ── Invite ───────────────────────────────────────────────────── */}
        {tab === 'invite' && (
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <Card animate={false}>
                <CardHeader
                  title="Create an account"
                  description="The person can sign in immediately with the password you set here."
                  icon={UserPlus}
                />
                <form onSubmit={createUser} className="mt-5 space-y-4">
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Input
                      label="Full name"
                      value={invite.name}
                      onChange={(event) => setInvite({ ...invite, name: event.target.value })}
                      placeholder="Jordan Ellis"
                    />
                    <Input
                      label="Email"
                      type="email"
                      required
                      value={invite.email}
                      onChange={(event) => setInvite({ ...invite, email: event.target.value })}
                      placeholder="jordan@company.com"
                    />
                  </div>

                  <div>
                    <Input
                      label="Temporary password"
                      type="text"
                      required
                      value={invite.password}
                      onChange={(event) => setInvite({ ...invite, password: event.target.value })}
                      placeholder="Something they can change later"
                    />
                    <PasswordStrength value={invite.password} />
                  </div>

                  <Select
                    label="Role"
                    value={invite.role}
                    onChange={(event) => setInvite({ ...invite, role: event.target.value })}
                    hint="Admin accounts can only be granted by promoting an existing user."
                  >
                    {ROLE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </Select>

                  <Button type="submit" variant="primary" icon={UserPlus} loading={inviting}>
                    Create account
                  </Button>
                </form>
              </Card>
            </div>

            <Card animate={false}>
              <CardHeader title="What each role can do" icon={ShieldCheck} />
              <ul className="mt-4 space-y-3">
                {['OWNER', 'ANALYST', 'STAFF', 'ADMIN'].map((role) => (
                  <li key={role} className="rounded-xl border border-hairline/8 p-3">
                    <RoleBadge role={role} />
                    <p className="mt-2 text-[12px] leading-relaxed text-ink-muted">{ROLE_META[role].blurb}</p>
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        )}

        {/* ── Manage ───────────────────────────────────────────────────── */}
        {tab === 'manage' && (
          <>
            {!selected ? (
              <Card animate={false}>
                <EmptyState
                  icon={Search}
                  title="Pick someone to manage"
                  description="Open the Directory tab and select a row — no need to remember their exact email address."
                  action={() => setTab('directory')}
                  actionLabel="Open the directory"
                />
              </Card>
            ) : (
              <div className="grid gap-4 lg:grid-cols-3">
                <Card animate={false}>
                  <div className="flex items-center gap-3">
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-honey/12 text-[15px] font-bold text-honey">
                      {initials(selected.name || selected.email)}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-[15px] font-semibold text-ink">{selected.name || '—'}</p>
                      <p className="truncate text-[12.5px] text-ink-muted">{selected.email}</p>
                    </div>
                  </div>

                  <div className="mt-4 space-y-2.5">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-[12.5px] text-ink-muted">Role</span>
                      <RoleBadge role={selected.role} />
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-[12.5px] text-ink-muted">Status</span>
                      {selected.active ? (
                        <Badge tone="good" icon={ShieldCheck}>
                          Active
                        </Badge>
                      ) : (
                        <Badge tone="critical" icon={ShieldOff}>
                          Deactivated
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-[12.5px] text-ink-muted">Last signed in</span>
                      <span className="text-[12.5px] text-ink-soft">
                        {selected.last_logged_in ? relativeTime(selected.last_logged_in) : 'Never'}
                      </span>
                    </div>
                  </div>

                  <Button size="sm" className="mt-5 w-full" onClick={() => setTab('directory')}>
                    Choose someone else
                  </Button>
                </Card>

                <div className="space-y-4 lg:col-span-2">
                  <Card animate={false}>
                    <CardHeader
                      title="Change role"
                      description="Takes effect immediately — the person is signed out and must sign in again."
                      icon={UserCog}
                    />
                    <div className="mt-4 flex flex-wrap items-end gap-3">
                      <Select
                        label="New role"
                        value={newRole}
                        onChange={(event) => setNewRole(event.target.value)}
                        containerClassName="min-w-[240px] flex-1"
                      >
                        {[...ROLE_OPTIONS, { value: 'ADMIN', label: 'Admin — user management' }].map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </Select>
                      <Button
                        variant="primary"
                        onClick={changeRole}
                        loading={busyAction === 'role'}
                        disabled={newRole === selected.role}
                      >
                        Apply
                      </Button>
                    </div>
                    {isSelf && newRole !== 'ADMIN' && (
                      <Inset className="mt-3 border-warn/28 bg-warn/6">
                        <p className="flex items-start gap-2 text-[12px] text-ink-soft">
                          <AlertTriangle size={13} className="mt-px shrink-0 text-warn" aria-hidden="true" />
                          This is your own account. Removing your admin role will lock you out of this page.
                        </p>
                      </Inset>
                    )}
                  </Card>

                  <Card animate={false}>
                    <CardHeader
                      title="Reset password"
                      description="Sets a new password and signs the person out of every device."
                      icon={KeyRound}
                    />
                    <div className="mt-4">
                      <div className="flex flex-wrap items-start gap-3">
                        <div className="min-w-[240px] flex-1">
                          <Input
                            label="New password"
                            type="text"
                            value={newPassword}
                            onChange={(event) => setNewPassword(event.target.value)}
                            placeholder="Give them something to change later"
                          />
                          {newPassword && <PasswordStrength value={newPassword} />}
                        </div>
                        <Button
                          variant="primary"
                          onClick={resetPassword}
                          loading={busyAction === 'password'}
                          disabled={!newPassword}
                          className="mt-[26px]"
                        >
                          Reset
                        </Button>
                      </div>
                    </div>
                  </Card>

                  <Card animate={false} className={selected.active ? 'border-critical/22' : 'border-good/22'}>
                    <CardHeader
                      title={selected.active ? 'Revoke access' : 'Restore access'}
                      description={
                        selected.active
                          ? 'Ends every session immediately and blocks future sign-ins. Their historical data is kept.'
                          : 'Lets this person sign in again with their existing password.'
                      }
                      icon={selected.active ? ShieldOff : ShieldCheck}
                    />
                    <div className="mt-4">
                      <Button
                        variant={selected.active ? 'danger' : 'primary'}
                        icon={selected.active ? ShieldOff : ShieldCheck}
                        onClick={() => (selected.active ? setConfirmDeactivate(true) : toggleActive())}
                        loading={busyAction === 'status'}
                      >
                        {selected.active ? 'Deactivate this account' : 'Reactivate this account'}
                      </Button>
                    </div>
                  </Card>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      <Modal
        open={confirmDeactivate}
        onClose={() => setConfirmDeactivate(false)}
        title="Deactivate this account?"
        description={`${selected?.name || selected?.email} will be signed out everywhere and will not be able to sign back in.`}
        icon={ShieldOff}
        size="sm"
        busy={busyAction === 'status'}
        footer={
          <>
            <Button onClick={() => setConfirmDeactivate(false)} disabled={busyAction === 'status'}>
              Cancel
            </Button>
            <Button variant="danger" icon={ShieldOff} onClick={toggleActive} loading={busyAction === 'status'}>
              Deactivate
            </Button>
          </>
        }
      >
        <p className="text-[13px] leading-relaxed text-ink-soft">
          Their uploads and history stay intact for the audit trail. You can reactivate the account at any time.
        </p>
        {isSelf && (
          <Inset className="mt-3 border-critical/28 bg-critical/6">
            <p className="flex items-start gap-2 text-[12.5px] text-critical">
              <AlertTriangle size={13} className="mt-px shrink-0" aria-hidden="true" />
              This is your own account — you will be signed out immediately and cannot undo this yourself.
            </p>
          </Inset>
        )}
      </Modal>
    </div>
  );
}

export default Team;
