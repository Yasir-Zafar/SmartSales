import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Navbar } from '../components/Navbar';

const API_URL = 'http://localhost:5000/api';

export const OwnerAlerts = () => {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const token = localStorage.getItem('token');
        const res = await axios.get(`${API_URL}/insights/owner/alerts/abnormal-drops`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setAlerts(res.data?.alerts || []);
      } catch (e) {
        setError(e.response?.data?.message || 'Could not load abnormal drop alerts');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <Navbar />
      <div className="max-w-6xl mx-auto p-6">
        <h2 className="text-3xl font-bold">Owner Abnormal Drop Alerts</h2>
        <p className="text-gray-400 mt-1">High-level alerts for forecast drops versus baseline demand.</p>

        <div className="mt-6 bg-gray-800 p-6 rounded-xl shadow-xl">
          {loading ? (
            <p className="text-gray-400 text-sm">Loading alerts...</p>
          ) : error ? (
            <p className="text-red-400 text-sm">{error}</p>
          ) : alerts.length === 0 ? (
            <p className="text-gray-400 text-sm">No abnormal drops detected.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {alerts.map((alert, idx) => (
                <div
                  key={idx}
                  className={`border rounded-lg p-4 ${
                    alert.severity === 'high'
                      ? 'border-red-500 bg-red-900/20'
                      : alert.severity === 'medium'
                      ? 'border-yellow-500 bg-yellow-900/20'
                      : 'border-blue-500 bg-blue-900/20'
                  }`}
                >
                  <p className="text-gray-100 font-medium text-sm">{alert.product}</p>
                  <p className="text-xs text-gray-400 capitalize">{alert.category || 'N/A'}</p>
                  <p className="mt-2 text-xs text-gray-300">Forecast (5d): <span className="text-teal-300">{alert.ensemble_total_5d}</span></p>
                  <p className="text-xs text-gray-300">Baseline (5d): <span className="text-purple-300">{alert.baseline_total_5d}</span></p>
                  <p className="text-xs text-red-400 font-semibold mt-1">Drop: {alert.drop_pct}%</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
