import React from 'react';
import { useAuth } from '../context/AuthContext';
import { Navbar } from '../components/Navbar';

export const StaffDashboard = () => {
  const { user } = useAuth();
  return (
    <div className="min-h-screen flex flex-col bg-gray-900">
      <Navbar />
      <div className="p-8">
        <h2 className="text-2xl font-semibold text-gray-50">Staff Dashboard</h2>
        <p className="text-gray-400 mt-2">Welcome, {user?.email}</p>
        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-gray-800 p-6 rounded-xl shadow-xl">
            <h4 className="text-sm font-medium text-gray-400 uppercase">Today's Sales</h4>
            <p className="text-3xl font-bold text-teal-500 mt-2">$4,250</p>
            <p className="text-xs text-gray-500 mt-1">24 transactions</p>
          </div>
          <div className="bg-gray-800 p-6 rounded-xl shadow-xl">
            <h4 className="text-sm font-medium text-gray-400 uppercase">Pending Orders</h4>
            <p className="text-3xl font-bold text-pink-500 mt-2">12</p>
            <p className="text-xs text-gray-500 mt-1">Need attention</p>
          </div>
        </div>
        <div className="mt-8 grid grid-cols-1 gap-6">
          <div className="bg-gray-800 p-6 rounded-xl shadow-xl">
            <h3 className="text-lg font-semibold text-gray-50 mb-4">Recent Transactions</h3>
            <p className="text-gray-400">Latest sales and customer orders</p>
          </div>
          <div className="bg-gray-800 p-6 rounded-xl shadow-xl">
            <h3 className="text-lg font-semibold text-gray-50 mb-4">Quick Actions</h3>
            <p className="text-gray-400">Process orders, update inventory</p>
          </div>
        </div>
      </div>
    </div>
  );
};

