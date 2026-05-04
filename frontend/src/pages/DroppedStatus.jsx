import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { Navbar } from '../components/Navbar';

const API_URL = 'http://localhost:5000/api';

const severityBadge = (severity) => {
  if (severity === 'critical') return 'bg-danger/10 text-danger border border-danger/30';
  if (severity === 'high') return 'bg-warning/10 text-warning border border-warning/30';
  if (severity === 'medium') return 'bg-accent/10 text-accent border border-accent/30';
  return 'bg-surface-600/30 text-text-muted border border-surface-600/30';
};

const dropColor = (dropPct) => {
  if (dropPct >= 50) return 'text-danger';
  if (dropPct >= 25) return 'text-warning';
  if (dropPct > 0) return 'text-warning';
  return 'text-text-faint';
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

  return (
    <div className="min-h-screen bg-surface-900 text-white">
      <Navbar />
      <div className="max-w-7xl mx-auto p-6">
        <div className="mb-6">
          <h2 className="text-3xl font-bold text-text-primary">Dropped Status</h2>
          <p className="text-text-muted mt-1">Complete product drop analysis including no-drop cases and forecast comparisons.</p>
        </div>

        <div className="bg-surface-800 border border-surface-700 rounded-xl overflow-hidden mb-6">
          <div className="px-5 py-4 border-b border-surface-700">
            <label htmlFor="drop-search" className="text-xs text-text-faint mb-2 block">Search by product name</label>
            <input
              id="drop-search"
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Type product name..."
              className="w-full bg-surface-900 border border-surface-700 rounded-lg px-4 py-2 text-sm focus:border-success focus:outline-none"
            />
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-12 text-text-faint">
              <div className="animate-spin w-6 h-6 border-2 border-accent border-t-transparent rounded-full mr-3"></div>
              Loading dropped status...
            </div>
          ) : error ? (
            <div className="p-6 text-danger bg-danger-glow">{error}</div>
          ) : filteredStatuses.length === 0 ? (
            <div className="p-6 text-text-faint text-center">No products found.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-surface-900/60 text-xs uppercase tracking-wide text-text-muted">
                  <tr>
                    <th className="text-left px-6 py-3">Product</th>
                    <th className="text-right px-6 py-3">Drop %</th>
                    <th className="text-right px-6 py-3">Forecast (5d)</th>
                    <th className="text-right px-6 py-3">Baseline (5d)</th>
                    <th className="text-center px-6 py-3">Severity</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-700">
                  {filteredStatuses.map((row) => (
                    <tr key={row.product} className="hover:bg-surface-800/50">
                      <td className="px-6 py-3 text-text-primary font-medium">{row.product}</td>
                      <td className={`px-6 py-3 text-right font-semibold ${dropColor(row.drop_pct)}`}>{row.drop_pct}%</td>
                      <td className="px-6 py-3 text-right text-text-secondary">{row.ensemble_total_5d}</td>
                      <td className="px-6 py-3 text-right text-text-muted">{row.baseline_total_5d}</td>
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
