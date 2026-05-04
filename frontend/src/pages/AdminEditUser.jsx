import React, { useState } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { Navbar } from '../components/Navbar';

const API_URL = 'http://localhost:5000/api';

export const AdminEditUser = () => {
  const [searchEmail, setSearchEmail] = useState('');
  const [selectedUser, setSelectedUser] = useState(null);
  const [lookupMessage, setLookupMessage] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordMessage, setPasswordMessage] = useState('');
  const [role, setRole] = useState('STAFF');
  const [roleMessage, setRoleMessage] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [loadingLookup, setLoadingLookup] = useState(false);
  const [loadingPassword, setLoadingPassword] = useState(false);
  const [loadingRole, setLoadingRole] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState(false);

  const { user: adminUser } = useAuth();

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;

  const handleFindUser = async (e) => {
    e.preventDefault();
    setLookupMessage('');
    setSelectedUser(null);
    setPasswordMessage('');
    setRoleMessage('');
    setStatusMessage('');

    if (!searchEmail) {
      setLookupMessage('Please enter an email to search.');
      return;
    }

    try {
      setLoadingLookup(true);
      const res = await axios.post(
        `${API_URL}/admin/users/find-by-email`,
        { email: searchEmail },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const foundUser = res.data.user;
      setSelectedUser(foundUser);
      setRole(foundUser.role || 'STAFF');
      setLookupMessage('User loaded successfully.');
    } catch (err) {
      setSelectedUser(null);
      setLookupMessage(err.response?.data?.message || 'Error finding user');
    } finally {
      setLoadingLookup(false);
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setPasswordMessage('');

    if (!selectedUser) {
      setPasswordMessage('Please load a user first.');
      return;
    }

    if (!newPassword || !confirmPassword) {
      setPasswordMessage('Please enter and confirm the new password.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordMessage('Passwords do not match.');
      return;
    }

    try {
      setLoadingPassword(true);
      await axios.patch(
        `${API_URL}/admin/users/${selectedUser.id}/password`,
        { password: newPassword },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setPasswordMessage('Password reset successfully.');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setPasswordMessage(err.response?.data?.message || 'Error resetting password');
    } finally {
      setLoadingPassword(false);
    }
  };

  const handleUpdateRole = async (e) => {
    e.preventDefault();
    setRoleMessage('');

    if (!selectedUser) {
      setRoleMessage('Please load a user first.');
      return;
    }

    try {
      setLoadingRole(true);
      const res = await axios.patch(
        `${API_URL}/admin/users/${selectedUser.id}/role`,
        { role },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.data.user) {
        setSelectedUser(res.data.user);
      } else {
        setSelectedUser((prev) => prev ? { ...prev, role } : prev);
      }
      setRoleMessage('Role updated successfully.');
    } catch (err) {
      setRoleMessage(err.response?.data?.message || 'Error updating role');
    } finally {
      setLoadingRole(false);
    }
  };

  const handleToggleStatus = async () => {
    setStatusMessage('');

    if (!selectedUser) {
      setStatusMessage('Please load a user first.');
      return;
    }

    try {
      setLoadingStatus(true);
      const res = await axios.patch(
        `${API_URL}/admin/users/${selectedUser.id}/status`,
        { active: !selectedUser.active },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.data.user) {
        setSelectedUser(res.data.user);
      } else {
        setSelectedUser((prev) => prev ? { ...prev, active: !prev.active } : prev);
      }
      setStatusMessage(
        !selectedUser.active ? 'User reactivated successfully.' : 'User deactivated successfully.'
      );
    } catch (err) {
      setStatusMessage(err.response?.data?.message || 'Error updating user status');
    } finally {
      setLoadingStatus(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-surface-900">
      <Navbar />
      <div className="p-8 flex flex-col items-center">
        <h2 className="text-2xl font-semibold text-text-primary">Edit User</h2>
        <p className="text-text-muted mt-2">Welcome, <span className="text-accent">{adminUser?.email}</span></p>

        <div className="mt-8 max-w-3xl w-full space-y-8">
          {/* User Lookup */}
          <div className="bg-surface-800 p-8 rounded-xl shadow-xl border border-surface-700">
            <h3 className="text-xl font-semibold text-text-primary mb-2">Find User by Email</h3>
            <p className="text-text-muted mb-4 text-sm">
              Search for an existing account to reset password, update role, or deactivate the user.
            </p>
            {lookupMessage && (
              <p
                className={`mb-4 px-4 py-2 rounded-lg ${
                  lookupMessage.includes('success')
                    ? 'bg-success/20 text-success border border-success/50'
                    : 'bg-danger/20 text-danger border border-rose-600/50'
                }`}
              >
                {lookupMessage}
              </p>
            )}
            <form onSubmit={handleFindUser} className="flex flex-col md:flex-row gap-4 items-stretch md:items-end">
              <div className="flex-1">
                <label className="block mb-2 text-sm text-text-muted">User Email</label>
                <input
                  type="email"
                  value={searchEmail}
                  onChange={(e) => setSearchEmail(e.target.value)}
                  placeholder="user@smartsales.com"
                  className="w-full px-4 py-3 bg-surface-900 border border-surface-600 rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-transparent transition-all"
                />
              </div>
              <button
                type="submit"
                disabled={loadingLookup}
                    className="md:w-auto w-full bg-accent hover:bg-accent-hover disabled:bg-accent text-white font-semibold py-3 px-6 rounded-lg transition-colors shadow-lg"
              >
                {loadingLookup ? 'Searching...' : 'Find User'}
              </button>
            </form>
          </div>

          {/* User Summary and Actions */}
          {selectedUser && (
            <>
              {/* Summary */}
              <div className="bg-surface-800 p-6 rounded-xl shadow-xl border border-surface-700">
                <h3 className="text-lg font-semibold text-text-primary mb-4">User Summary</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-text-muted">Name</p>
                    <p className="text-text-primary font-medium">{selectedUser.name || '—'}</p>
                  </div>
                  <div>
                    <p className="text-text-muted">Email</p>
                    <p className="text-text-primary font-medium">{selectedUser.email}</p>
                  </div>
                  <div>
                    <p className="text-text-muted">Role</p>
                    <p className="text-text-primary font-medium">{selectedUser.role}</p>
                  </div>
                  <div>
                    <p className="text-text-muted">Status</p>
                    <p
                      className={`font-medium ${
                        selectedUser.active ? 'text-success' : 'text-danger'
                      }`}
                    >
                      {selectedUser.active ? 'Active' : 'Deactivated'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Reset Password */}
              <div className="bg-surface-800 p-6 rounded-xl shadow-xl border border-surface-700">
                <h3 className="text-lg font-semibold text-text-primary mb-2">Reset Password</h3>
                <p className="text-text-muted mb-4 text-sm">
                  Set a new password for this user. They will use it the next time they sign in.
                </p>
                {passwordMessage && (
                  <p
                    className={`mb-4 px-4 py-2 rounded-lg ${
                      passwordMessage.includes('success')
                        ? 'bg-success/20 text-success border border-success/50'
                        : 'bg-danger/20 text-danger border border-rose-600/50'
                    }`}
                  >
                    {passwordMessage}
                  </p>
                )}
                <form onSubmit={handleResetPassword} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                  <div>
                    <label className="block mb-2 text-sm text-text-muted">New Password</label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full px-4 py-3 bg-surface-900 border border-surface-600 rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-transparent transition-all"
                    />
                  </div>
                  <div>
                    <label className="block mb-2 text-sm text-text-muted">Confirm Password</label>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full px-4 py-3 bg-surface-900 border border-surface-600 rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-transparent transition-all"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={loadingPassword}
                    className="w-full bg-accent hover:bg-accent-hover disabled:bg-accent text-white font-semibold py-3 px-4 rounded-lg transition-colors shadow-lg"
                  >
                    {loadingPassword ? 'Saving...' : 'Reset Password'}
                  </button>
                </form>
              </div>

              {/* Update Role */}
              <div className="bg-surface-800 p-6 rounded-xl shadow-xl border border-surface-700">
                <h3 className="text-lg font-semibold text-text-primary mb-2">Update Role</h3>
                <p className="text-text-muted mb-4 text-sm">
                  Change the user&apos;s role to adjust their access within SmartSales.
                </p>
                {roleMessage && (
                  <p
                    className={`mb-4 px-4 py-2 rounded-lg ${
                      roleMessage.includes('success')
                        ? 'bg-success/20 text-success border border-success/50'
                        : 'bg-danger/20 text-danger border border-rose-600/50'
                    }`}
                  >
                    {roleMessage}
                  </p>
                )}
                <form onSubmit={handleUpdateRole} className="flex flex-col md:flex-row gap-4 items-stretch md:items-end">
                  <div className="flex-1">
                    <label className="block mb-2 text-sm text-text-muted">User Role</label>
                    <select
                      value={role}
                      onChange={(e) => setRole(e.target.value)}
                      className="w-full px-4 py-3 bg-surface-900 border border-surface-600 rounded-lg text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-transparent transition-all cursor-pointer"
                    >
                      <option value="OWNER">Owner (Full Business Access)</option>
                      <option value="ANALYST">Analyst (Data Visualization)</option>
                      <option value="STAFF">Staff (Daily Operations)</option>
                      <option value="ADMIN">Admin (User Management)</option>
                    </select>
                  </div>
                  <button
                    type="submit"
                    disabled={loadingRole}
                className="md:w-auto w-full bg-accent hover:bg-accent-hover disabled:bg-accent text-accent-text font-semibold py-3 px-6 rounded-lg transition-colors shadow-lg"
                  >
                    {loadingRole ? 'Updating...' : 'Update Role'}
                  </button>
                </form>
              </div>

              {/* Deactivate / Reactivate */}
              <div className="bg-surface-800 p-6 rounded-xl shadow-xl border border-surface-700">
                <h3 className="text-lg font-semibold text-text-primary mb-2">Account Status</h3>
                <p className="text-text-muted mb-4 text-sm">
                  Deactivate a user to prevent login while keeping their data for records and audit history.
                </p>
                {statusMessage && (
                  <p
                    className={`mb-4 px-4 py-2 rounded-lg ${
                      statusMessage.includes('success')
                        ? 'bg-success/20 text-success border border-success/50'
                        : 'bg-danger/20 text-danger border border-rose-600/50'
                    }`}
                  >
                    {statusMessage}
                  </p>
                )}
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                  <div>
                    <p className="text-text-muted text-sm">Current Status</p>
                    <p
                      className={`mt-1 font-medium ${
                        selectedUser.active ? 'text-success' : 'text-danger'
                      }`}
                    >
                      {selectedUser.active ? 'Active - can sign in' : 'Deactivated - cannot sign in'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleToggleStatus}
                    disabled={loadingStatus}
                    className={`w-full md:w-auto font-semibold py-3 px-6 rounded-lg transition-colors shadow-lg ${
                      selectedUser.active
                        ? 'bg-danger hover:bg-danger disabled:bg-danger text-white'
                        : 'bg-accent hover:bg-accent-hover disabled:bg-accent text-white'
                    }`}
                  >
                    {loadingStatus
                      ? 'Updating...'
                      : selectedUser.active
                      ? 'Deactivate User'
                      : 'Reactivate User'}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

