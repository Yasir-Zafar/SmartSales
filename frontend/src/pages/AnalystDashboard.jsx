import React from 'react';
import { useAuth } from '../context/AuthContext';
import { Navbar } from '../components/Navbar';

export const AnalystDashboard = () => {
  const { user } = useAuth();
  return (
    <div className="min-h-screen flex flex-col bg-gray-900">
      <Navbar />
      <div className="p-8">
        <h2 className="text-2xl font-semibold text-gray-50">Analyst Dashboard</h2>
        <p className="text-gray-400 mt-2">Welcome, {user?.email}</p>
        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="bg-gray-800 p-6 rounded-xl shadow-xl">
            <h4 className="text-sm font-medium text-gray-400 uppercase">Sales Trends</h4>
            <p className="text-3xl font-bold text-teal-500 mt-2">↑ 12.5%</p>
            <p className="text-xs text-gray-500 mt-1">30-day trend</p>
          </div>
          <div className="bg-gray-800 p-6 rounded-xl shadow-xl">
            <h4 className="text-sm font-medium text-gray-400 uppercase">Anomalies Detected</h4>
            <p className="text-3xl font-bold text-rose-500 mt-2">3</p>
            <p className="text-xs text-gray-500 mt-1">This week</p>
          </div>
          <div className="bg-gray-800 p-6 rounded-xl shadow-xl">
            <h4 className="text-sm font-medium text-gray-400 uppercase">Forecast Accuracy</h4>
            <p className="text-3xl font-bold text-purple-500 mt-2">94.2%</p>
            <p className="text-xs text-gray-500 mt-1">Last 7 days</p>
          </div>
        </div>
        <div className="mt-8 grid grid-cols-1 gap-6">
          <div className="bg-gray-800 p-6 rounded-xl shadow-xl">
            <h3 className="text-lg font-semibold text-gray-50 mb-4">Data Visualizations</h3>
            <p className="text-gray-400">Charts, graphs, and ML model insights</p>
          </div>
          <div className="bg-gray-800 p-6 rounded-xl shadow-xl">
            <h3 className="text-lg font-semibold text-gray-50 mb-4">Anomaly Reports</h3>
            <p className="text-gray-400">Unusual patterns and outlier detection</p>
          </div>
        </div>
      </div>
    </div>
  );
};

