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

  const [revThreshold, setRevThreshold] = useState(100);
  const [revForm, setRevForm] = useState('');
  const [revForecast, setRevForecast] = useState(null);
  const [revLoading, setRevLoading] = useState(false);

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

  const loadRevenueAlert = async () => {
    setRevLoading(true);
    try {
      const token = localStorage.getItem('token');
      const headers = { Authorization: `Bearer ${token}` };
      const [cfgRes, alertRes] = await Promise.all([
        axios.get(`${API_URL}/insights/owner/alerts/revenue-threshold/threshold`, { headers }),
        axios.get(`${API_URL}/insights/owner/alerts/revenue-threshold`, { headers }),
      ]);
      const threshold = cfgRes.data?.threshold ?? 100;
      setRevThreshold(threshold);
      setRevForm(String(threshold));
      setRevForecast(alertRes.data);
    } catch {
    } finally {
      setRevLoading(false);
    }
  };

  useEffect(() => {
    loadPage();
    loadRevenueAlert();
    const id = setInterval(() => {
      loadPage();
      loadRevenueAlert();
    }, ANOMALY_REFRESH_MS);
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

  const handleRevSave = async () => {
    setSaveError('');
    try {
      const token = localStorage.getItem('token');
      await axios.put(
        `${API_URL}/insights/owner/alerts/revenue-threshold/threshold`,
        { threshold: revForm },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      await loadRevenueAlert();
    } catch (e) {
      setSaveError(e.response?.data?.message || 'Could not update revenue threshold');
    }
  };

  const handleRevReset = async () => {
    setSaveError('');
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`${API_URL}/insights/owner/alerts/revenue-threshold/threshold`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      await loadRevenueAlert();
    } catch (e) {
      setSaveError(e.response?.data?.message || 'Could not reset revenue threshold');
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <Navbar />
      <div className="max-w-6xl mx-auto p-6">
        <h2 className="text-3xl font-bold">Owner Alerts</h2>
        <p className="text-gray-400 mt-1">Monitor anomalies and forecasted revenue thresholds.</p>

        {/* Revenue Threshold */}
        <div className="mt-6 bg-gray-800 p-6 rounded-xl shadow-xl border border-amber-500/20">
          <h3 className="text-lg font-semibold text-gray-50 mb-1">Forecasted Revenue Alert</h3>
          <p className="text-xs text-gray-400 mb-4">Set a minimum revenue threshold. If the 5-day forecasted total falls below it, you will be alerted.</p>

          {revLoading ? (
            <p className="text-gray-400 text-sm">Loading...</p>
          ) : (
            <>
              {revForecast && (
                <div className={`mb-4 rounded-lg p-4 border ${revForecast.breached ? 'bg-red-900/20 border-red-500/40' : 'bg-green-900/20 border-green-500/40'}`}>
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-xs text-gray-400">Forecasted 5-day revenue</p>
                      <p className="text-2xl font-bold text-teal-400">${revForecast.total_forecast_revenue}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-400">Threshold</p>
                      <p className="text-2xl font-bold text-gray-200">${revForecast.threshold}</p>
                    </div>
                  </div>
                  {revForecast.breached ? (
                    <p className="text-sm text-red-300 mt-2 font-medium">
                      Warning: Forecasted revenue is ${revForecast.shortfall} below your threshold.
                    </p>
                  ) : (
                    <p className="text-sm text-green-300 mt-2">Forecasted revenue is above threshold.</p>
                  )}
                </div>
              )}

              <div className="border border-gray-700 rounded-lg p-4 bg-gray-900/60 max-w-lg">
                <p className="text-xs text-gray-400">Current threshold: ${revThreshold}</p>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={revForm}
                  onChange={(e) => setRevForm(e.target.value)}
                  placeholder="Revenue threshold ($)"
                  className="mt-3 w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 text-sm text-white"
                />
                <div className="mt-3 flex gap-2">
                  <button onClick={handleRevSave} className="px-3 py-1.5 text-xs rounded bg-amber-600 hover:bg-amber-500">Save Threshold</button>
                  <button onClick={handleRevReset} className="px-3 py-1.5 text-xs rounded bg-gray-600 hover:bg-gray-500">Reset Default</button>
                </div>
              </div>

              {revForecast?.by_product?.length > 0 && (
                <div className="mt-4">
                  <p className="text-xs text-gray-500 mb-2">Top products by forecasted revenue</p>
                  <div className="max-h-40 overflow-y-auto space-y-1">
                    {revForecast.by_product.map((p) => (
                      <div key={p.product} className="flex justify-between text-sm">
                        <span className="text-gray-300">{p.product}</span>
                        <span className="text-teal-400 font-semibold">${p.forecast_revenue}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Abnormal Drop Alerts */}
        <div className="mt-6 bg-gray-800 p-6 rounded-xl shadow-xl border border-teal-500/20">
          <h3 className="text-lg font-semibold text-gray-50 mb-1">Abnormal Drop Alerts</h3>
          <p className="text-xs text-gray-400 mb-4">Set anomaly threshold and monitor abnormal sales drops.</p>

          <div className="border border-gray-700 rounded-lg p-4 bg-gray-900/60 max-w-lg">
            <p className="text-xs text-gray-400">Current threshold: {thresholds.threshold_pct}%</p>
            {saveError && <p className="text-red-400 text-xs mt-2">{saveError}</p>}
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
              <button onClick={handleThresholdSave} className="px-3 py-1.5 text-xs rounded bg-teal-600 hover:bg-teal-500">Save Threshold</button>
              <button onClick={handleThresholdReset} className="px-3 py-1.5 text-xs rounded bg-red-600 hover:bg-red-500">Reset Default</button>
            </div>
          </div>

          <div className="mt-6 flex items-center justify-between gap-3">
            <div>
              <p className="text-xs text-gray-400">
                Current above-threshold anomalies: <span className="text-teal-300 font-semibold">{anomalyCount}</span>
                {previousCount != null ? ` (previous: ${previousCount})` : ''}
              </p>
              {refreshMsg && <p className="text-xs text-violet-300 mt-1">{refreshMsg}</p>}
            </div>
            <button onClick={loadPage} className="px-3 py-1.5 text-xs rounded bg-violet-600 hover:bg-violet-500">Refresh Count</button>
          </div>

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
