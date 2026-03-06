import React from 'react';
import { useAuth } from '../context/AuthContext';
import { Navbar } from '../components/Navbar';

export const OwnerDashboard = () => {
  const { user } = useAuth();
  return (
    <div className="min-h-screen flex flex-col bg-gray-900">
      <Navbar />
      <div className="p-8">
        <h2 className="text-2xl font-semibold text-gray-50">Owner Dashboard</h2>
        <p className="text-gray-400 mt-2">Welcome, {user?.email}</p>
        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-gray-800 p-6 rounded-xl shadow-xl">
            <h4 className="text-sm font-medium text-gray-400 uppercase">Total Revenue</h4>
            <p className="text-3xl font-bold text-teal-500 mt-2">$124,500</p>
            <p className="text-xs text-gray-500 mt-1">+12.5% from last month</p>
          </div>
          <div className="bg-gray-800 p-6 rounded-xl shadow-xl">
            <h4 className="text-sm font-medium text-gray-400 uppercase">Total Sales</h4>
            <p className="text-3xl font-bold text-pink-500 mt-2">1,842</p>
            <p className="text-xs text-gray-500 mt-1">+8.2% from last month</p>
          </div>
          <div className="bg-gray-800 p-6 rounded-xl shadow-xl">
            <h4 className="text-sm font-medium text-gray-400 uppercase">Active Customers</h4>
            <p className="text-3xl font-bold text-purple-500 mt-2">1,240</p>
            <p className="text-xs text-gray-500 mt-1">+5.1% from last month</p>
          </div>
          <div className="bg-gray-800 p-6 rounded-xl shadow-xl">
            <h4 className="text-sm font-medium text-gray-400 uppercase">Profit Margin</h4>
            <p className="text-3xl font-bold text-green-500 mt-2">34.2%</p>
            <p className="text-xs text-gray-500 mt-1">+2.1% from last month</p>
          </div>
        </div>
        <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-gray-800 p-6 rounded-xl shadow-xl">
            <h3 className="text-lg font-semibold text-gray-50 mb-4">Sales Forecast</h3>
            <p className="text-gray-400">AI-powered sales predictions and trends</p>
          </div>
          <div className="bg-gray-800 p-6 rounded-xl shadow-xl">
            <h3 className="text-lg font-semibold text-gray-50 mb-4">Customer Segmentation</h3>
            <p className="text-gray-400">Customer groups and behavior analysis</p>
          </div>
        </div>
      </div>
    </div>
  );
};

