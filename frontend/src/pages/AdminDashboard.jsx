import React from 'react';
import { useAuth } from '../context/AuthContext';
import { Navbar } from '../components/Navbar';

export const AdminDashboard = () => {
  const { user } = useAuth();

  return (
    <div className="min-h-screen flex flex-col bg-gray-900">
      <Navbar />
      <div className="p-8">
        <h2 className="text-2xl font-semibold text-gray-50">Admin Dashboard</h2>
        <p className="text-gray-400 mt-2">Welcome, {user?.email}</p>

        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-gray-800 p-6 rounded-xl shadow-xl border border-gray-700">
            <h4 className="text-sm font-medium text-gray-400 uppercase">Total Users</h4>
            <p className="text-3xl font-bold text-teal-500 mt-2">8</p>
            <p className="text-xs text-gray-500 mt-1">Active accounts</p>
          </div>
          <div className="bg-gray-800 p-6 rounded-xl shadow-xl border border-gray-700">
            <h4 className="text-sm font-medium text-gray-400 uppercase">Owners</h4>
            <p className="text-3xl font-bold text-pink-500 mt-2">1</p>
            <p className="text-xs text-gray-500 mt-1">Full access</p>
          </div>
          <div className="bg-gray-800 p-6 rounded-xl shadow-xl border border-gray-700">
            <h4 className="text-sm font-medium text-gray-400 uppercase">Analysts</h4>
            <p className="text-3xl font-bold text-purple-500 mt-2">2</p>
            <p className="text-xs text-gray-500 mt-1">Data access</p>
          </div>
          <div className="bg-gray-800 p-6 rounded-xl shadow-xl border border-gray-700">
            <h4 className="text-sm font-medium text-gray-400 uppercase">Staff</h4>
            <p className="text-3xl font-bold text-green-500 mt-2">5</p>
            <p className="text-xs text-gray-500 mt-1">Basic access</p>
          </div>
        </div>

        <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-gray-800 p-6 rounded-xl shadow-xl border border-gray-700">
            <h3 className="text-lg font-semibold text-gray-50 mb-4">Recent Activity</h3>
            <p className="text-gray-400 text-sm">Last user created 2 hours ago</p>
            <p className="text-gray-500 text-xs mt-2">by admin@smartsales.com</p>
          </div>
          <div className="bg-gray-800 p-6 rounded-xl shadow-xl border border-gray-700">
            <h3 className="text-lg font-semibold text-gray-50 mb-4">Quick Actions</h3>
            <p className="text-gray-400 text-sm">Manage users and permissions</p>
            <p className="text-gray-500 text-xs mt-2">Use the Create User page to add new accounts</p>
          </div>
        </div>
      </div>
    </div>
  );
};

