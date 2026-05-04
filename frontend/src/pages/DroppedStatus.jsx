import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { Navbar } from '../components/Navbar';

const API_URL = 'http://localhost:5000/api';

const severityBadge = (severity) => {
  if (severity === 'critical') return 'bg-red-500/10 text-red-400 border border-red-500/30';
  if (severity === 'high') return 'bg-orange-500/10 text-orange-400 border border-orange-500/30';
  if (severity === 'medium') return 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/30';
  return 'bg-gray-500/10 text-gray-400 border border-gray-600';
};

const dropColor = (dropPct) => {
  if (dropPct >= 50) return 'text-red-400';
  if (dropPct >= 25) return 'text-orange-400';
  if (dropPct > 0) return 'text-yellow-400';
  return 'text-teal-400';
};

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

  const criticalCount = statuses.filter((s) => s.severity === 'critical').length;
  const highCount = statuses.filter((s) => s.severity === 'high').length;
  const noDropCount = statuses.filter((s) => s.drop_pct === 0).length;

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <Navbar />
      <div className="max-w-7xl mx-auto p-6">
        <div className="mb-6">
          <h2 className="text-3xl font-bold">Dropped Status</h2>
          <p className="text-gray-400 mt-1">Complete product drop analysis including no-drop cases and forecast comparisons.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="bg-gray-800 border border-red-500/20 rounded-xl p-5">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🔴</span>
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide">Critical</p>
                <p className="text-2xl font-bold text-gray-100">{criticalCount}</p>
              </div>
            </div>
          </div>
          <div className="bg-gray-800 border border-orange-500/20 rounded-xl p-5">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🟠</span>
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide">High</p>
                <p className="text-2xl font-bold text-gray-100">{highCount}</p>
              </div>
            </div>
          </div>
          <div className="bg-gray-800 border border-teal-500/20 rounded-xl p-5">
            <div className="flex items-center gap-3">
              <span className="text-2xl">✅</span>
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wide">No Drop</p>
                <p className="text-2xl font-bold text-gray-100">{noDropCount}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-gray-800 border border-gray-700 rounded-xl overflow-hidden mb-6">
          <div className="px-5 py-4 border-b border-gray-700">
            <label htmlFor="drop-search" className="text-xs text-gray-500 mb-2 block">Search by product name</label>
            <input
              id="drop-search"
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Type product name..."
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-sm focus:border-teal-500 focus:outline-none"
            />
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12 text-gray-500">
              <div className="animate-spin w-6 h-6 border-2 border-teal-500 border-t-transparent rounded-full mr-3"></div>
              Loading dropped status...
            </div>
          ) : error ? (
            <div className="p-6 text-red-400 bg-red-900/10">{error}</div>
          ) : filteredStatuses.length === 0 ? (
            <div className="p-6 text-gray-500 text-center">No products found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-900/60 text-xs uppercase tracking-wide text-gray-400">
                  <tr>
                    <th className="text-left px-6 py-3">Product</th>
                    <th className="text-right px-6 py-3">Drop %</th>
                    <th className="text-right px-6 py-3">Forecast (5d)</th>
                    <th className="text-right px-6 py-3">Baseline (5d)</th>
                    <th className="text-center px-6 py-3">Severity</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-800">
                  {filteredStatuses.map((row) => (
                    <tr key={row.product} className="hover:bg-gray-800/50">
                      <td className="px-6 py-3 text-gray-100 font-medium">{row.product}</td>
                      <td className={`px-6 py-3 text-right font-semibold ${dropColor(row.drop_pct)}`}>{row.drop_pct}%</td>
                      <td className="px-6 py-3 text-right text-gray-300">{row.ensemble_total_5d}</td>
                      <td className="px-6 py-3 text-right text-gray-400">{row.baseline_total_5d}</td>
                      <td className="px-6 py-3 text-center">
                        <span className={`inline-block px-2 py-1 rounded text-xs font-semibold capitalize ${severityBadge(row.severity)}`}>
                          {row.severity}
                        </span>
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
