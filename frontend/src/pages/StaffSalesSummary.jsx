import React, { useEffect, useMemo, useState } from 'react';
import { Navbar } from '../components/Navbar';

const API_URL = 'http://localhost:5000/api';

export const StaffSalesSummary = () => {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadSummary = async () => {
      setLoading(true);
      setError('');
      try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${API_URL}/insights/staff/sales-summary`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Could not load sales summary');
        setSummary(data);
      } catch (e) {
        setError(e.message || 'Could not load sales summary');
      } finally {
        setLoading(false);
      }
    };
    loadSummary();
  }, []);

  const todayItems = summary?.today?.top_items || [];
  const weekItems = summary?.week?.top_items || [];
  const dailyBreakdown = useMemo(() => summary?.week?.dailyBreakdown || [], [summary]);

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <Navbar />
      <div className="max-w-7xl mx-auto p-6">
        <h2 className="text-3xl font-bold">Detailed Sales Summary</h2>
        <p className="text-gray-400 mt-1">Latest day and 7-day sales performance with item-level breakdowns.</p>
        {summary?.source?.anchor_date && (
          <p className="text-xs text-gray-500 mt-2">
            Anchored to latest `daily_sales.sale_date`: {summary.source.anchor_date}
          </p>
        )}

        {loading ? (
          <p className="text-gray-400 mt-6">Loading summary...</p>
        ) : error ? (
          <p className="text-red-400 mt-6">{error}</p>
        ) : (
          <>
            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-gray-800 p-6 rounded-xl shadow-xl">
                <h3 className="text-sm text-gray-400">Latest Day</h3>
                <p className="text-3xl text-teal-400 mt-2">${summary?.today?.revenue || '0.00'}</p>
                <p className="text-gray-500 text-sm">{summary?.today?.transactions || 0} transactions</p>
                {summary?.today?.date && <p className="text-gray-500 text-xs mt-1">Date: {summary.today.date}</p>}
              </div>
              <div className="bg-gray-800 p-6 rounded-xl shadow-xl">
                <h3 className="text-sm text-gray-400">Latest 7-Day Window</h3>
                <p className="text-3xl text-violet-400 mt-2">${summary?.week?.revenue || '0.00'}</p>
                <p className="text-gray-500 text-sm">{summary?.week?.transactions || 0} transactions</p>
                {summary?.week?.start_date && summary?.week?.end_date && (
                  <p className="text-gray-500 text-xs mt-1">
                    Window: {summary.week.start_date} to {summary.week.end_date}
                  </p>
                )}
              </div>
            </div>

            <div className="mt-6 grid grid-cols-1 xl:grid-cols-2 gap-6">
              <div className="bg-gray-800 p-6 rounded-xl shadow-xl overflow-x-auto">
                <h3 className="text-lg font-semibold text-gray-50">Top Items (Latest Day)</h3>
                <table className="w-full text-sm mt-4">
                  <thead>
                    <tr className="text-gray-400 border-b border-gray-700">
                      <th className="py-2 pr-3 text-left">Product</th>
                      <th className="py-2 pr-3 text-left">Quantity</th>
                      <th className="py-2 pr-3 text-left">Revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {todayItems.length === 0 ? (
                      <tr>
                        <td className="py-3 text-gray-500" colSpan={3}>No item sales for latest day.</td>
                      </tr>
                    ) : (
                      todayItems.map((item) => (
                        <tr key={item.product_name} className="border-b border-gray-800">
                          <td className="py-2 pr-3 text-gray-200">{item.product_name}</td>
                          <td className="py-2 pr-3 text-teal-300">{item.quantity}</td>
                          <td className="py-2 pr-3 text-gray-300">${Number(item.revenue || 0).toFixed(2)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div className="bg-gray-800 p-6 rounded-xl shadow-xl overflow-x-auto">
                <h3 className="text-lg font-semibold text-gray-50">Top Items (Latest 7 Days)</h3>
                <table className="w-full text-sm mt-4">
                  <thead>
                    <tr className="text-gray-400 border-b border-gray-700">
                      <th className="py-2 pr-3 text-left">Product</th>
                      <th className="py-2 pr-3 text-left">Quantity</th>
                      <th className="py-2 pr-3 text-left">Revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {weekItems.length === 0 ? (
                      <tr>
                        <td className="py-3 text-gray-500" colSpan={3}>No item sales for latest 7-day window.</td>
                      </tr>
                    ) : (
                      weekItems.map((item) => (
                        <tr key={item.product_name} className="border-b border-gray-800">
                          <td className="py-2 pr-3 text-gray-200">{item.product_name}</td>
                          <td className="py-2 pr-3 text-violet-300">{item.quantity}</td>
                          <td className="py-2 pr-3 text-gray-300">${Number(item.revenue || 0).toFixed(2)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="mt-6 bg-gray-800 p-6 rounded-xl shadow-xl overflow-x-auto">
              <h3 className="text-lg font-semibold text-gray-50">Daily Breakdown (Latest 7-Day Window)</h3>
              <table className="w-full text-sm mt-4">
                <thead>
                  <tr className="text-gray-400 border-b border-gray-700">
                    <th className="py-2 pr-3 text-left">Date</th>
                    <th className="py-2 pr-3 text-left">Revenue</th>
                    <th className="py-2 pr-3 text-left">Transactions</th>
                  </tr>
                </thead>
                <tbody>
                  {dailyBreakdown.length === 0 ? (
                    <tr>
                      <td className="py-3 text-gray-500" colSpan={3}>No daily data available.</td>
                    </tr>
                  ) : (
                    dailyBreakdown.map((row) => (
                      <tr key={row.date} className="border-b border-gray-800">
                        <td className="py-2 pr-3 text-gray-200">{row.date}</td>
                        <td className="py-2 pr-3 text-teal-300">${Number(row.revenue || 0).toFixed(2)}</td>
                        <td className="py-2 pr-3 text-gray-300">{row.transactions || 0}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
