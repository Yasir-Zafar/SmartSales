import React, { useEffect, useState } from 'react';
import { AlertTriangle, BarChart3, TrendingUp } from 'lucide-react';
import axios from 'axios';
import { Navbar } from '../components/Navbar';

const API_URL = 'http://localhost:5000/api';

const severityBadge = (severity) => {
  if (severity === 'critical') return 'bg-danger/10 text-danger border border-danger/30';
  if (severity === 'high') return 'bg-warning/10 text-warning border border-warning/30';
  if (severity === 'medium') return 'bg-warning/10 text-warning border border-warning/30';
  return 'bg-surface-600/30 text-text-muted border border-surface-600/30';
};

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
  const activeAlerts = notifications.length;
  const totalEvents = filteredHistory.length;

  return (
    <div className="min-h-screen bg-surface-900 text-white">
      <Navbar />
      <div className="max-w-7xl mx-auto p-6">
        <div className="mb-6">
          <h2 className="text-3xl font-bold">Abnormal Drop Alerts</h2>
          <p className="text-text-muted mt-1">Monitor and analyze detected sales anomalies with timestamps and severity.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="bg-surface-800 border border-danger/20 rounded-xl p-5">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-surface-700 flex items-center justify-center text-danger">
                <AlertTriangle size={18} />
              </div>
              <div>
                <p className="text-xs text-text-muted uppercase tracking-wide">Active Alerts</p>
                <p className="text-2xl font-bold text-text-primary">{activeAlerts}</p>
              </div>
            </div>
          </div>
          <div className="bg-surface-800 border border-success/20 rounded-xl p-5">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-surface-700 flex items-center justify-center text-success">
                <BarChart3 size={18} />
              </div>
              <div>
                <p className="text-xs text-text-muted uppercase tracking-wide">Events ({timeframe})</p>
                <p className="text-2xl font-bold text-text-primary">{totalEvents}</p>
              </div>
            </div>
          </div>
          <div className="bg-surface-800 border border-accent/20 rounded-xl p-5">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-surface-700 flex items-center justify-center text-accent">
                <TrendingUp size={18} />
              </div>
              <div>
                <p className="text-xs text-text-muted uppercase tracking-wide">Peak Alerts</p>
                <p className="text-2xl font-bold text-text-primary">{maxCount}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-surface-800 border border-surface-700 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-surface-700">
              <h3 className="text-lg font-semibold text-text-primary">Active Notifications</h3>
            </div>
            <div className="p-4 max-h-96 overflow-y-auto space-y-2">
              {notifications.length === 0 ? (
                <p className="text-text-faint text-sm text-center py-6">No active notifications.</p>
              ) : (
                notifications.map((alert, idx) => (
                  <div key={`${alert.product}-${idx}`} className="border border-surface-700 bg-surface-900/60 rounded-lg p-3">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-text-primary">{alert.product}</p>
                      <span className={`px-2 py-0.5 rounded text-xs font-semibold capitalize ${severityBadge(alert.severity)}`}>
                        {alert.severity}
                      </span>
                    </div>
                    <p className="text-xs text-text-muted mt-1">Drop <span className="text-danger font-semibold">{alert.drop_pct}%</span></p>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="lg:col-span-2 bg-surface-800 border border-surface-700 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-surface-700 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-text-primary">Alert Frequency</h3>
              <div className="flex items-center gap-3">
                <label htmlFor="timeframe" className="text-xs text-text-faint">Timeframe</label>
                <select
                  id="timeframe"
                  value={timeframe}
                  onChange={(e) => setTimeframe(e.target.value)}
                  className="bg-surface-900 border border-surface-700 text-sm rounded-lg px-3 py-1.5 focus:border-success focus:outline-none"
                >
                  <option value="1h">Last 1 hour</option>
                  <option value="24h">Last 24 hours</option>
                  <option value="7d">Last 7 days</option>
                  <option value="30d">Last 30 days</option>
                  <option value="all">All stored</option>
                </select>
              </div>
            </div>
            <div className="p-5">
              {series.length === 0 ? (
                <p className="text-text-faint text-sm text-center py-6">No stored alert history yet.</p>
              ) : (
                <>
                  <div className="h-60 border border-surface-700 rounded-lg bg-surface-900/60 p-4">
                    <div className="h-full flex items-end gap-1 overflow-x-auto">
                      {series.map((point) => {
                        const heightPct = Math.max(6, (point.count / Math.max(1, maxCount)) * 100);
                        return (
                          <div key={point.ts} className="flex flex-col items-center justify-end min-w-[14px] h-full">
                            <div
                              className="w-3 bg-accent rounded-t hover:bg-accent-hover transition"
                              style={{ height: `${heightPct}%` }}
                              title={`${point.label} | alerts: ${point.count}`}
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  <div className="mt-3 text-xs text-text-faint flex justify-between gap-4">
                    <span>Start: {series[0].label}</span>
                    <span>End: {series[series.length - 1].label}</span>
                    <span>Peak: {maxCount} alerts/min</span>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
