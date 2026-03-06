import React, { useState } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { Navbar } from '../components/Navbar';

const API_URL = 'http://localhost:5000/api';

export const AdminCreateUser = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState('STAFF');
  const [message, setMessage] = useState('');
  const { user } = useAuth();

  const handleCreateUser = async (e) => {
    e.preventDefault();
    const token = localStorage.getItem('token');
    try {
      await axios.post(`${API_URL}/admin/create-user`,
        { email, password, role, name },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setMessage('User created successfully!');
      setEmail('');
      setPassword('');
      setName('');
    } catch (err) {
      setMessage(err.response?.data?.message || 'Error creating user');
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-900">
      <Navbar />
      <div className="p-8">
        <h2 className="text-2xl font-semibold text-gray-50">Create User Account</h2>
        <p className="text-gray-400 mt-2">Welcome, {user?.email}</p>

        <div className="mt-8 max-w-2xl">
          <div className="bg-gray-800 p-8 rounded-xl shadow-xl border border-gray-700">
            <h3 className="text-xl font-semibold text-gray-50 mb-2">New User Account Details</h3>
            <p className="text-gray-400 mb-6 text-sm">
              Assign roles (Owner, Analyst, Staff) to control user access and permissions.
            </p>
            {message && (
              <p className={`my-4 px-4 py-2 rounded-lg ${message.includes('successfully') ? 'bg-teal-600/20 text-teal-400 border border-teal-600/50' : 'bg-rose-600/20 text-rose-400 border border-rose-600/50'}`}>
                {message}
              </p>
            )}
            <form onSubmit={handleCreateUser}>
              <div className="mb-6">
                <label className="block mb-2 text-sm text-gray-400">Full Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="John Doe"
                  className="w-full px-4 py-3 bg-gray-900 border border-gray-600 rounded-lg text-gray-50 focus:outline-none focus:ring-2 focus:ring-teal-600 focus:border-transparent transition-all"
                />
              </div>
              <div className="mb-6">
                <label className="block mb-2 text-sm text-gray-400">Email Address</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="user@smartsales.com"
                  className="w-full px-4 py-3 bg-gray-900 border border-gray-600 rounded-lg text-gray-50 focus:outline-none focus:ring-2 focus:ring-teal-600 focus:border-transparent transition-all"
                />
              </div>
              <div className="mb-6">
                <label className="block mb-2 text-sm text-gray-400">Temporary Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  className="w-full px-4 py-3 bg-gray-900 border border-gray-600 rounded-lg text-gray-50 focus:outline-none focus:ring-2 focus:ring-teal-600 focus:border-transparent transition-all"
                />
              </div>
              <div className="mb-8">
                <label className="block mb-2 text-sm text-gray-400">User Role</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-900 border border-gray-600 rounded-lg text-gray-50 focus:outline-none focus:ring-2 focus:ring-teal-600 focus:border-transparent transition-all cursor-pointer"
                >
                  <option value="OWNER">Owner (Full Business Access)</option>
                  <option value="ANALYST">Analyst (Data Visualization)</option>
                  <option value="STAFF">Staff (Daily Operations)</option>
                </select>
              </div>
              <button
                type="submit"
                className="w-full bg-teal-600 hover:bg-teal-700 text-white font-semibold py-3 px-4 rounded-lg transition-colors shadow-lg"
              >
                Provision Account
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

