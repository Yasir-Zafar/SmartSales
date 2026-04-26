import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Navbar } from '../components/Navbar';

const API_URL = 'http://localhost:5000/api';

export const AnalystAbnormalDrops = () => {
  const [abnormalDrops, setAbnormalDrops] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadDrops = async () => {
      setLoading(true);
      setError('');
      try {
        const token = localStorage.getItem('token');
        const res = await axios.get(`${API_URL}/insights/analyst/abnormal-drops`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setAbnormalDrops(res.data?.alerts || []);
      } catch (e) {
        setError(e.response?.data?.message || 'Could not load abnormal drop alerts');
      } finally {
        setLoading(false);
      }
    };
    loadDrops();
  }, []);

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <Navbar />
      <div className="max-w-6xl mx-auto p-6">
        <h2 className="text-3xl font-bold">Analyst Abnormal Drop Alerts</h2>
        <p className="text-gray-400 mt-1">Detailed drop alerts with severity and forecast baseline context.</p>
        <div className="mt-6 bg-gray-800 p-6 rounded-xl shadow-xl">
          {loading ? (
            <p className="text-gray-400 text-sm">Loading drop alerts...</p>
          ) : error ? (
            <p className="text-red-400 text-sm">{error}</p>
          ) : abnormalDrops.length === 0 ? (
            <p className="text-gray-400 text-sm">No abnormal drops detected.</p>
          ) : (
            <div className="max-h-[32rem] overflow-y-auto space-y-3">
              {abnormalDrops.map((drop, idx) => (
                <div
                  key={idx}
                  className={`border rounded-lg p-3 ${
                    drop.severity === 'high'
                      ? 'border-red-500 bg-red-900/20'
                      : drop.severity === 'medium'
                      ? 'border-yellow-500 bg-yellow-900/20'
                      : 'border-blue-500 bg-blue-900/20'
                  }`}
                >
                  <p className="text-gray-100 font-medium text-sm">{drop.product}</p>
                  <p className="text-xs text-gray-400">{drop.category}</p>
                  <p className="mt-2 text-xs text-gray-300">Forecast (5d): <span className="text-teal-300">{drop.ensemble_total_5d}</span></p>
                  <p className="text-xs text-gray-300">Baseline (5d): <span className="text-purple-300">{drop.baseline_total_5d}</span></p>
                  <p className="text-xs text-red-400 font-semibold mt-1">Drop: {drop.drop_pct}%</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
