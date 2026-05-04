import React, { useEffect, useState } from 'react';
import { Users, CheckCircle, Ban, Crown } from 'lucide-react';
import axios from 'axios';
import { Navbar } from '../components/Navbar';

const API_URL = 'http://localhost:5000/api';

const roleBadge = (role) => {
  if (role === 'OWNER') return 'bg-accent/10 text-accent border border-accent/30';
  if (role === 'ADMIN') return 'bg-accent/10 text-accent border border-accent/30';
  if (role === 'ANALYST') return 'bg-success/10 text-success border border-success/30';
  if (role === 'STAFF') return 'bg-success/10 text-success border border-success/30';
  return 'bg-gray-500/10 text-text-muted border border-surface-600/30';
};

export const AdminViewUsers = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      setLoading(false);
      setError('Not authenticated');
      return;
    }

    const fetchUsers = async () => {
      try {
        const res = await axios.get(`${API_URL}/admin/users/list`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setUsers(res.data.users || []);
      } catch (err) {
        console.error(err);
        setError(err.response?.data?.message || 'Failed to load users');
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();
  }, []);

  const filteredUsers = users.filter((u) => {
    const q = search.toLowerCase();
    return (u.email || '').toLowerCase().includes(q) || (u.name || '').toLowerCase().includes(q) || (u.role || '').toLowerCase().includes(q);
  });

  const activeCount = users.filter((u) => u.active).length;
  const deactivatedCount = users.filter((u) => !u.active).length;
  const roleCounts = users.reduce((acc, u) => {
    acc[u.role] = (acc[u.role] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="min-h-screen flex flex-col bg-surface-900">
      <Navbar />
      <div className="p-8 max-w-7xl mx-auto w-full">
        <div className="mb-6">
          <h2 className="text-3xl font-bold text-text-primary">View Users</h2>
          <p className="text-text-muted mt-1">Manage and review all system users with roles and activity status.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-surface-800 border border-accent/20 rounded-xl p-5">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-surface-700 flex items-center justify-center text-accent">
                <Users size={18} />
              </div>
              <div>
                <p className="text-xs text-text-muted uppercase tracking-wide">Total Users</p>
                <p className="text-2xl font-bold text-text-primary">{users.length}</p>
              </div>
            </div>
          </div>
          <div className="bg-surface-800 border border-success/20 rounded-xl p-5">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-surface-700 flex items-center justify-center text-success">
                <CheckCircle size={18} />
              </div>
              <div>
                <p className="text-xs text-text-muted uppercase tracking-wide">Active</p>
                <p className="text-2xl font-bold text-text-primary">{activeCount}</p>
              </div>
            </div>
          </div>
          <div className="bg-surface-800 border border-danger/20 rounded-xl p-5">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-surface-700 flex items-center justify-center text-danger">
                <Ban size={18} />
              </div>
              <div>
                <p className="text-xs text-text-muted uppercase tracking-wide">Deactivated</p>
                <p className="text-2xl font-bold text-text-primary">{deactivatedCount}</p>
              </div>
            </div>
          </div>
          <div className="bg-surface-800 border border-accent/20 rounded-xl p-5">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-surface-700 flex items-center justify-center text-accent">
                <Crown size={18} />
              </div>
              <div>
                <p className="text-xs text-text-muted uppercase tracking-wide">Owners</p>
                <p className="text-2xl font-bold text-text-primary">{roleCounts.OWNER || 0}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-surface-800 border border-surface-700 rounded-xl overflow-hidden">
          <div className="px-6 py-4 border-b border-surface-700">
            <label htmlFor="user-search" className="text-xs text-text-faint mb-2 block">Search users</label>
            <input
              id="user-search"
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by email, name, or role..."
              className="w-full bg-surface-900 border border-surface-700 rounded-lg px-4 py-2 text-sm focus:border-accent-border focus:outline-none"
            />
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12 text-text-faint">
              <div className="animate-spin w-6 h-6 border-2 border-accent border-t-transparent rounded-full mr-3"></div>
              Loading users...
            </div>
          ) : error ? (
            <div className="p-6 text-danger bg-danger/10">{error}</div>
          ) : filteredUsers.length === 0 ? (
            <div className="p-6 text-text-faint text-center">No users found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-surface-900/60 text-xs uppercase tracking-wide text-text-muted">
                  <tr>
                    <th className="px-6 py-3 text-left">Email</th>
                    <th className="px-6 py-3 text-left">Name</th>
                    <th className="px-6 py-3 text-left">Role</th>
                    <th className="px-6 py-3 text-left">Status</th>
                    <th className="px-6 py-3 text-left">Last Login</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-700">
                  {filteredUsers.map((u) => (
                    <tr key={u.id} className="hover:bg-surface-800/50">
                      <td className="px-6 py-3 text-text-primary font-medium">{u.email}</td>
                      <td className="px-6 py-3 text-text-secondary">{u.name || '—'}</td>
                      <td className="px-6 py-3">
                        <span className={`inline-block px-2 py-1 rounded text-xs font-semibold ${roleBadge(u.role)}`}>
                          {u.role}
                        </span>
                      </td>
                      <td className="px-6 py-3">
                        <span className={`inline-flex items-center gap-1.5 ${u.active ? 'text-success' : 'text-danger'}`}>
                          <span className={`w-2 h-2 rounded-full ${u.active ? 'bg-success' : 'bg-danger'}`}></span>
                          {u.active ? 'Active' : 'Deactivated'}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-text-muted text-sm">
                        {u.last_logged_in ? new Date(u.last_logged_in).toLocaleString() : 'Never'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
