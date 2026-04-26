import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Navbar } from '../components/Navbar';

const API_URL = 'http://localhost:5000/api';

export const OwnerAlerts = () => {
  const [notifications, setNotifications] = useState([]);
  const [thresholds, setThresholds] = useState({ low: null, medium: null, high: null });
  const [thresholdForm, setThresholdForm] = useState({ low: '', medium: '', high: '' });
  const [saveError, setSaveError] = useState('');

  const loadPage = async () => {
    try {
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };
      const [notificationsRes, thresholdsRes] = await Promise.all([
        axios.get(`${API_URL}/insights/alerts/notifications/abnormal-drops`, { headers }),
        axios.get(`${API_URL}/insights/owner/alerts/abnormal-drops/thresholds`, { headers }),
      ]);
      const nextThresholds = thresholdsRes.data?.thresholds || { low: null, medium: null, high: null };
      setNotifications(notificationsRes.data?.alerts || []);
      setThresholds(nextThresholds);
      setThresholdForm({
        low: nextThresholds.low == null ? '' : String(nextThresholds.low),
        medium: nextThresholds.medium == null ? '' : String(nextThresholds.medium),
        high: nextThresholds.high == null ? '' : String(nextThresholds.high),
      });
    } catch (e) {
      setSaveError(e.response?.data?.message || 'Could not load notifications/thresholds');
    }
  };

  useEffect(() => {
    loadPage();
  }, []);

  const severityClass = (severity) => {
    if (severity === 'high') return 'border-red-500 bg-red-900/20';
    if (severity === 'medium') return 'border-yellow-500 bg-yellow-900/20';
    return 'border-blue-500 bg-blue-900/20';
  };

  const handleThresholdSave = async (level) => {
    setSaveError('');
    try {
      const token = localStorage.getItem('token');
      await axios.put(
        `${API_URL}/insights/owner/alerts/abnormal-drops/thresholds/${level}`,
        { threshold_pct: thresholdForm[level] },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      await loadPage();
    } catch (e) {
      setSaveError(e.response?.data?.message || `Could not update ${level} threshold`);
    }
  };

  const handleThresholdDelete = async (level) => {
    setSaveError('');
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API_URL}/insights/owner/alerts/abnormal-drops/thresholds/${level}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      await loadPage();
    } catch (e) {
      setSaveError(e.response?.data?.message || `Could not delete ${level} threshold`);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <Navbar />
      <div className="max-w-6xl mx-auto p-6">
        <h2 className="text-3xl font-bold">Owner Abnormal Drop Alerts</h2>
        <p className="text-gray-400 mt-1">Set severity thresholds and monitor shared abnormal-drop notifications.</p>

        <div className="mt-6 bg-gray-800 p-6 rounded-xl shadow-xl">
          <h3 className="text-xl font-semibold text-white">Threshold Controls</h3>
          <p className="text-xs text-gray-400 mt-1">Owner can set or delete thresholds for low, medium, and high severities.</p>
          {saveError && <p className="text-red-400 text-xs mt-3">{saveError}</p>}
          <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
            {['low', 'medium', 'high'].map((level) => (
              <div key={level} className="border border-gray-700 rounded-lg p-4 bg-gray-900/60">
                <p className="text-sm font-semibold capitalize">{level}</p>
                <p className="text-xs text-gray-400 mt-1">Current: {thresholds[level] == null ? 'Deleted' : `${thresholds[level]}%`}</p>
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  value={thresholdForm[level]}
                  onChange={(e) => setThresholdForm((prev) => ({ ...prev, [level]: e.target.value }))}
                  placeholder="Threshold %"
                  className="mt-3 w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm text-white"
                />
                <div className="mt-3 flex gap-2">
                  <button
                    onClick={() => handleThresholdSave(level)}
                    className="px-3 py-1.5 text-xs rounded bg-teal-600 hover:bg-teal-500"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => handleThresholdDelete(level)}
                    className="px-3 py-1.5 text-xs rounded bg-red-600 hover:bg-red-500"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-6 bg-gray-800 p-6 rounded-xl shadow-xl">
          <h3 className="text-xl font-semibold text-white">Notifs</h3>
          <div className="mt-4 max-h-56 overflow-y-auto space-y-2">
            {notifications.length === 0 ? (
              <p className="text-gray-400 text-sm">No current notifications.</p>
            ) : (
              notifications.map((alert, idx) => (
                <div key={`${alert.product}-${idx}`} className={`border rounded-lg p-3 ${severityClass(alert.severity)}`}>
                  <p className="text-sm font-medium text-gray-100">{alert.product}</p>
                  <p className="text-xs text-gray-300">Drop {alert.drop_pct}% ({alert.severity})</p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
