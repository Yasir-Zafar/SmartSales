import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Navbar } from '../components/Navbar';

const API_URL = 'http://localhost:5000/api';

export const AdminViewUsers = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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

  return (
    <div className="min-h-screen flex flex-col bg-gray-900">
      <Navbar />
      <div className="p-8">
        <div className="flex items-end justify-between mb-4">
          <div>
            <h2 className="text-2xl font-semibold text-gray-50">View Users</h2>
            <p className="text-gray-400 mt-1">All users including role and last login.</p>
          </div>
        </div>

        <div className="bg-gray-800 p-4 rounded-xl border border-gray-700">
          {loading ? (
            <p className="text-gray-300">Loading users...</p>
          ) : error ? (
            <p className="text-rose-300">{error}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-gray-200 border border-gray-700">
                <thead className="bg-gray-900 text-xs uppercase tracking-wider text-gray-400">
                  <tr>
                    <th className="px-3 py-2 border border-gray-700">Email</th>
                    <th className="px-3 py-2 border border-gray-700">Name</th>
                    <th className="px-3 py-2 border border-gray-700">Role</th>
                    <th className="px-3 py-2 border border-gray-700">Status</th>
                    <th className="px-3 py-2 border border-gray-700">Last Login</th>
                  </tr>
                </thead>
                <tbody>
                  {users.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-3 py-3 text-center text-gray-400">
                        No users found
                      </td>
                    </tr>
                  ) : (
                    users.map((u) => (
                      <tr key={u.id} className="odd:bg-gray-800 even:bg-gray-900">
                        <td className="px-3 py-2 border border-gray-700">{u.email}</td>
                        <td className="px-3 py-2 border border-gray-700">{u.name || '—'}</td>
                        <td className="px-3 py-2 border border-gray-700">{u.role}</td>
                        <td className="px-3 py-2 border border-gray-700">
                          <span className={u.active ? 'text-teal-300' : 'text-rose-300'}>
                            {u.active ? 'Active' : 'Deactivated'}
                          </span>
                        </td>
                        <td className="px-3 py-2 border border-gray-700">
                          {u.last_logged_in ? new Date(u.last_logged_in).toLocaleString() : 'Never'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};