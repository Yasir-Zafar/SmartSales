import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Navbar } from '../components/Navbar';

const API_URL = 'http://localhost:5000/api';

export const AnalystAbnormalDrops = () => {
  const [notifications, setNotifications] = useState([]);
  const [history, setHistory] = useState([]);
  const [timeframe, setTimeframe] = useState('24h');

  useEffect(() => {
    const loadDrops = async () => {
      try {
        const token = localStorage.getItem('token');
        const headers = { Authorization: `Bearer ${token}` };
        const [notifsRes, historyRes] = await Promise.all([
          axios.get(`${API_URL}/insights/alerts/notifications/abnormal-drops`, { headers }),
          axios.get(`${API_URL}/insights/alerts/history/abnormal-drops?limit=2000`, { headers }),
        ]);
        setNotifications(notifsRes.data?.alerts || []);
        setHistory(historyRes.data?.history || []);
      } catch (e) {
        setNotifications([]);
        setHistory([]);
      }
    };
    loadDrops();
  }, []);

  const severityClass = (severity) => {
    if (severity === 'high') return 'border-red-500 bg-red-900/20';
    if (severity === 'medium') return 'border-yellow-500 bg-yellow-900/20';
    return 'border-blue-500 bg-blue-900/20';
  };

  const timeframeCutoff = (() => {
    const now = Date.now();
    if (timeframe === '1h') return now - 60 * 60 * 1000;
    if (timeframe === '24h') return now - 24 * 60 * 60 * 1000;
    if (timeframe === '7d') return now - 7 * 24 * 60 * 60 * 1000;
    if (timeframe === '30d') return now - 30 * 24 * 60 * 60 * 1000;
    return null;
  })();

  const filteredHistory = history.filter((item) => {
    if (!item?.detected_at) return false;
    if (timeframeCutoff == null) return true;
    const ts = new Date(item.detected_at).getTime();
    if (Number.isNaN(ts)) return false;
    return ts >= timeframeCutoff;
  });

  const groupedByMinute = [...filteredHistory]
    .filter((item) => item?.detected_at)
    .reduce((acc, item) => {
      const d = new Date(item.detected_at);
      if (Number.isNaN(d.getTime())) return acc;
      d.setSeconds(0, 0);
      const key = d.toISOString();
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

  const series = Object.entries(groupedByMinute)
    .sort((a, b) => new Date(a[0]) - new Date(b[0]))
    .map(([ts, count]) => ({
      ts,
      count,
      label: new Date(ts).toLocaleString(),
    }));

  const maxCount = series.reduce((m, item) => Math.max(m, item.count), 0);

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <Navbar />
      <div className="max-w-6xl mx-auto p-6">
        <h2 className="text-3xl font-bold">Analyst Abnormal Drop Alerts</h2>
        <p className="text-gray-400 mt-1">Shared notifications and full timestamped drop-alert history.</p>

        <div className="mt-6 bg-gray-800 p-6 rounded-xl shadow-xl">
          <h3 className="text-xl font-semibold">Notifs</h3>
          <div className="mt-4 max-h-56 overflow-y-auto space-y-2">
            {notifications.length === 0 ? (
              <p className="text-gray-400 text-sm">No active notifications.</p>
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

        <div className="mt-6 bg-gray-800 p-6 rounded-xl shadow-xl">
          <h3 className="text-xl font-semibold">Alert Count Over Time</h3>
          <div className="mt-3 flex items-center gap-2">
            <label htmlFor="timeframe" className="text-xs text-gray-400">Timeframe</label>
            <select
              id="timeframe"
              value={timeframe}
              onChange={(e) => setTimeframe(e.target.value)}
              className="bg-gray-900 border border-gray-700 text-sm rounded px-2 py-1"
            >
              <option value="1h">Last 1 hour</option>
              <option value="24h">Last 24 hours</option>
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
              <option value="all">All stored</option>
            </select>
            <span className="text-xs text-gray-500">{filteredHistory.length} events</span>
          </div>
          {series.length === 0 ? (
            <p className="text-gray-400 text-sm mt-3">No stored alert history yet.</p>
          ) : (
            <>
              <div className="mt-4 h-60 border border-gray-700 rounded-lg bg-gray-900/60 p-4">
                <div className="h-full flex items-end gap-1 overflow-x-auto">
                  {series.map((point) => {
                    const heightPct = Math.max(6, (point.count / Math.max(1, maxCount)) * 100);
                    return (
                      <div key={point.ts} className="flex flex-col items-center justify-end min-w-[14px] h-full">
                        <div
                          className="w-3 bg-teal-400 rounded-t"
                          style={{ height: `${heightPct}%` }}
                          title={`${point.label} | alerts: ${point.count}`}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="mt-3 text-xs text-gray-400 flex justify-between gap-4">
                <span>Start: {series[0].label}</span>
                <span>End: {series[series.length - 1].label}</span>
                <span>Max Alerts: {maxCount}</span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
