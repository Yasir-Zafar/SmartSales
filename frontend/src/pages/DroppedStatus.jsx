import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { Navbar } from '../components/Navbar';

const API_URL = 'http://localhost:5000/api';

export const DroppedStatus = () => {
  const [statuses, setStatuses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    const loadStatuses = async () => {
      setLoading(true);
      setError('');
      try {
        const token = localStorage.getItem('token');
        const res = await axios.get(`${API_URL}/insights/alerts/dropped-status`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setStatuses(res.data?.statuses || []);
      } catch (e) {
        setStatuses([]);
        setError(e.response?.data?.message || 'Could not load dropped status');
      } finally {
        setLoading(false);
      }
    };

    loadStatuses();
  }, []);

  const filteredStatuses = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return statuses;
    return statuses.filter((row) => String(row?.product || '').toLowerCase().includes(q));
  }, [search, statuses]);

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <Navbar />
      <div className="max-w-6xl mx-auto p-6">
        <h2 className="text-3xl font-bold">Dropped Status</h2>
        <p className="text-gray-400 mt-1">
          Shows every product, including no-drop cases (0%) and values below 0.
        </p>

        <div className="mt-6 bg-gray-800 p-4 rounded-xl shadow-xl border border-gray-700">
          <label htmlFor="drop-search" className="text-xs text-gray-400 block mb-2">
            Search product
          </label>
          <input
            id="drop-search"
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Type product name..."
            className="w-full bg-gray-900 border border-gray-600 rounded px-3 py-2 text-sm text-white"
          />
        </div>

        <div className="mt-6 bg-gray-800 rounded-xl shadow-xl border border-gray-700 overflow-hidden">
          {loading ? (
            <p className="text-gray-400 text-sm p-6">Loading dropped status...</p>
          ) : error ? (
            <p className="text-red-400 text-sm p-6">{error}</p>
          ) : filteredStatuses.length === 0 ? (
            <p className="text-gray-400 text-sm p-6">No products found.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-900/60">
                  <tr>
                    <th className="text-left px-4 py-3 text-gray-300">Product</th>
                    <th className="text-right px-4 py-3 text-gray-300">Drop %</th>
                    <th className="text-right px-4 py-3 text-gray-300">Forecast 5d</th>
                    <th className="text-right px-4 py-3 text-gray-300">Baseline 5d</th>
                    <th className="text-center px-4 py-3 text-gray-300">Severity</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStatuses.map((row) => (
                    <tr key={row.product} className="border-t border-gray-700">
                      <td className="px-4 py-3 text-gray-100">{row.product}</td>
                      <td className="px-4 py-3 text-right text-gray-200">{row.drop_pct}%</td>
                      <td className="px-4 py-3 text-right text-gray-200">{row.ensemble_total_5d}</td>
                      <td className="px-4 py-3 text-right text-gray-200">{row.baseline_total_5d}</td>
                      <td className="px-4 py-3 text-center capitalize text-gray-300">{row.severity}</td>
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
