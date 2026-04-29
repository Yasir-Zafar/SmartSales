import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Navbar } from '../components/Navbar';

const API_URL = 'http://localhost:5000/api';
const ANOMALY_REFRESH_MS = 10 * 60 * 1000;

export const OwnerAlerts = () => {
  const [notifications, setNotifications] = useState([]);
  const [thresholds, setThresholds] = useState({ threshold_pct: 20 });
  const [thresholdForm, setThresholdForm] = useState('');
  const [anomalyCount, setAnomalyCount] = useState(0);
  const [previousCount, setPreviousCount] = useState(null);
  const [refreshMsg, setRefreshMsg] = useState('');
  const [saveError, setSaveError] = useState('');

  const loadPage = async () => {
    try {
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };
      const [notificationsRes, thresholdsRes] = await Promise.all([
        axios.get(`${API_URL}/insights/alerts/notifications/abnormal-drops`, {
          headers,
          params: { notify_owner: true },
        }),
        axios.get(`${API_URL}/insights/owner/alerts/abnormal-drops/thresholds`, { headers }),
      ]);
      const nextThresholds = thresholdsRes.data?.thresholds || { threshold_pct: 20 };
      setNotifications(notificationsRes.data?.alerts || []);
      setAnomalyCount(Number(notificationsRes.data?.count || 0));
      setPreviousCount(notificationsRes.data?.previous_count ?? null);
      setRefreshMsg(
        notificationsRes.data?.changed
          ? `Anomaly count changed (${notificationsRes.data?.previous_count ?? 'N/A'} -> ${notificationsRes.data?.count ?? 0}).`
          : ''
      );
      setThresholds(nextThresholds);
      setThresholdForm(String(nextThresholds.threshold_pct ?? 20));
    } catch (e) {
      setSaveError(e.response?.data?.message || 'Could not load notifications/thresholds');
    }
  };

  useEffect(() => {
    loadPage();
    const id = setInterval(loadPage, ANOMALY_REFRESH_MS);
    return () => clearInterval(id);
  }, []);

  const handleThresholdSave = async () => {
    setSaveError('');
    try {
      const token = localStorage.getItem('token');
      await axios.put(
        `${API_URL}/insights/owner/alerts/abnormal-drops/thresholds`,
        { threshold_pct: thresholdForm },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      await loadPage();
    } catch (e) {
      setSaveError(e.response?.data?.message || 'Could not update threshold');
    }
  };

  const handleThresholdReset = async () => {
    setSaveError('');
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API_URL}/insights/owner/alerts/abnormal-drops/thresholds`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      await loadPage();
    } catch (e) {
      setSaveError(e.response?.data?.message || 'Could not reset threshold');
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <Navbar />
      <div className="max-w-6xl mx-auto p-6">
        <h2 className="text-3xl font-bold">Owner Abnormal Drop Alerts</h2>
        <p className="text-gray-400 mt-1">Set one anomaly threshold and monitor live abnormal-drop count notifications.</p>

        <div className="mt-6 bg-gray-800 p-6 rounded-xl shadow-xl">
          <h3 className="text-xl font-semibold text-white">Threshold Controls</h3>
          <p className="text-xs text-gray-400 mt-1">An anomaly is counted when drop % is greater than or equal to this threshold.</p>
          {saveError && <p className="text-red-400 text-xs mt-3">{saveError}</p>}
          <div className="mt-4 border border-gray-700 rounded-lg p-4 bg-gray-900/60 max-w-lg">
            <p className="text-xs text-gray-400">Current threshold: {thresholds.threshold_pct}%</p>
            <input
              type="number"
              min="0"
              step="0.1"
              value={thresholdForm}
              onChange={(e) => setThresholdForm(e.target.value)}
              placeholder="Threshold %"
              className="mt-3 w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm text-white"
            />
            <div className="mt-3 flex gap-2">
              <button
                onClick={handleThresholdSave}
                className="px-3 py-1.5 text-xs rounded bg-teal-600 hover:bg-teal-500"
              >
                Save Threshold
              </button>
              <button
                onClick={handleThresholdReset}
                className="px-3 py-1.5 text-xs rounded bg-red-600 hover:bg-red-500"
              >
                Reset Default
              </button>
            </div>
          </div>
        </div>

        <div className="mt-6 bg-gray-800 p-6 rounded-xl shadow-xl">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-xl font-semibold text-white">Live anomaly count</h3>
              <p className="text-xs text-gray-400 mt-1">
                Current above-threshold anomalies: <span className="text-teal-300 font-semibold">{anomalyCount}</span>
                {previousCount != null ? ` (previous: ${previousCount})` : ''}
              </p>
              {refreshMsg && <p className="text-xs text-violet-300 mt-1">{refreshMsg}</p>}
            </div>
            <button
              onClick={loadPage}
              className="px-3 py-1.5 text-xs rounded bg-violet-600 hover:bg-violet-500"
            >
              Refresh Count
            </button>
          </div>
        </div>

        <div className="mt-6 bg-gray-800 p-6 rounded-xl shadow-xl">
          <h3 className="text-xl font-semibold text-white">Notifs</h3>
          <div className="mt-4 max-h-56 overflow-y-auto space-y-2">
            {notifications.length === 0 ? (
              <p className="text-gray-400 text-sm">No current notifications.</p>
            ) : (
              notifications.map((alert, idx) => (
                <div key={`${alert.product}-${idx}`} className="border border-teal-500/40 bg-teal-900/20 rounded-lg p-3">
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
