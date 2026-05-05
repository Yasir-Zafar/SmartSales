import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { Navbar } from '../components/Navbar';

const API_URL = 'http://localhost:5000/api';
const PIE_COLORS = ['#8b5cf6', '#14b8a6', '#f59e0b', '#f43f5e', '#6366f1', '#22d3ee', '#84cc16'];
const BAR_GRADIENTS = [
  ['#6d5dab', '#8b7bc7'],
  ['#0f8f82', '#2bb5a8'],
  ['#c47f0e', '#e0a830'],
  ['#c2354e', '#df5270'],
  ['#4e52c4', '#6d70d8'],
  ['#0f8f82', '#3cc4b4'],
  ['#c47f0e', '#e0bc50'],
  ['#6d5dab', '#a090d0'],
  ['#c2354e', '#e06078'],
  ['#4e52c4', '#7d80e0'],
];
const ANOMALY_REFRESH_MS = 10 * 60 * 1000;

const createArc = (cx, cy, r, startAngle, endAngle) => {
  const start = { x: cx + r * Math.cos(startAngle), y: cy + r * Math.sin(startAngle) };
  const end = { x: cx + r * Math.cos(endAngle), y: cy + r * Math.sin(endAngle) };
  const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;
  return `M ${cx} ${cy} L ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 1 ${end.x} ${end.y} Z`;
};

export const AnalystDashboard = () => {
  const { user } = useAuth();
  const [topProducts, setTopProducts] = useState([]);
  const [loadingChart, setLoadingChart] = useState(false);
  const [chartError, setChartError] = useState('');
  const [hoveredBar, setHoveredBar] = useState(null);
  const [anomalyCount, setAnomalyCount] = useState(0);
  const [anomalyRefreshing, setAnomalyRefreshing] = useState(false);
  const [anomalyError, setAnomalyError] = useState('');

  const [retrainOpen, setRetrainOpen] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [retrainBusy, setRetrainBusy] = useState(false);
  const [retrainMsg, setRetrainMsg] = useState(null);

  const [segments, setSegments] = useState([]);
  const [segLoading, setSegLoading] = useState(false);
  const [segError, setSegError] = useState('');

  const [productQ, setProductQ] = useState('');
  const [fcLoading, setFcLoading] = useState(false);
  const [fcError, setFcError] = useState('');
  const [forecastData, setForecastData] = useState(null);
  const [comparisonData, setComparisonData] = useState(null);

  useEffect(() => {
    const fetchTopProducts = async () => {
      setLoadingChart(true);
      setChartError('');
      try {
        const token = localStorage.getItem('token');
        const response = await axios.get(`${API_URL}/csv/records`, {
          headers: { Authorization: `Bearer ${token}` },
          params: { sortBy: 'sales', order: 'desc' },
        });
        const productsCount = response.data.records.reduce((acc, row) => {
          const name = row.product_name || 'Unknown';
          acc[name] = (acc[name] || 0) + (row.quantity || 0);
          return acc;
        }, {});
        const sorted = Object.entries(productsCount)
          .map(([name, qty]) => ({ name, qty }))
          .sort((a, b) => b.qty - a.qty)
          .slice(0, 10);
        setTopProducts(sorted);
      } catch (err) {
        console.error('Top products error', err);
        setChartError('Could not load top products');
      } finally {
        setLoadingChart(false);
      }
    };
    fetchTopProducts();
  }, []);

  const loadAnomalyCount = async () => {
    setAnomalyRefreshing(true);
    setAnomalyError('');
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API_URL}/insights/alerts/notifications/abnormal-drops`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setAnomalyCount(Number(res.data?.count || 0));
    } catch (e) {
      setAnomalyError(e.response?.data?.message || 'Could not refresh anomaly count');
    } finally {
      setAnomalyRefreshing(false);
    }
  };

  useEffect(() => {
    loadAnomalyCount();
    const id = setInterval(loadAnomalyCount, ANOMALY_REFRESH_MS);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const loadSeg = async () => {
      setSegLoading(true);
      setSegError('');
      try {
        const token = localStorage.getItem('token');
        const res = await axios.get(`${API_URL}/insights/analyst/segments`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setSegments(res.data?.segments || []);
      } catch (e) {
        setSegError(e.response?.data?.message || 'Could not load segments (is ML service running?)');
      } finally {
        setSegLoading(false);
      }
    };
    loadSeg();
  }, []);

  const maxQty = topProducts.length ? Math.max(...topProducts.map((p) => p.qty)) : 0;
  const getYTicks = () => {
    if (!maxQty) return [0];
    const step = Math.ceil(maxQty / 5 / 10) * 10 || 1;
    const ticks = [];
    for (let i = 0; i <= maxQty + step; i += step) ticks.push(i);
    return ticks;
  };
  const yTicks = getYTicks();
  const chartMax = yTicks[yTicks.length - 1] || 1;

  const downloadExport = async () => {
    if (!startDate || !endDate) { setRetrainMsg({ ok: false, text: 'Choose start and end dates.' }); return; }
    const token = localStorage.getItem('token');
    const url = `${API_URL}/analyst/training-export?startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setRetrainMsg({ ok: false, text: j.message || 'Export failed' });
      return;
    }
    const blob = await res.blob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `smartsales_training_${startDate}_${endDate}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
    setRetrainMsg({ ok: true, text: 'CSV downloaded.' });
  };

  const runRetrain = async () => {
    if (!startDate || !endDate) { setRetrainMsg({ ok: false, text: 'Choose start and end dates.' }); return; }
    setRetrainBusy(true);
    setRetrainMsg(null);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.post(`${API_URL}/analyst/retrain`, { startDate, endDate }, { headers: { Authorization: `Bearer ${token}` } });
      setRetrainMsg({ ok: true, text: res.data?.message || 'ML reloaded.', detail: res.data?.ml });
    } catch (e) {
      setRetrainMsg({ ok: false, text: e.response?.data?.message || e.message || 'Retrain failed' });
    } finally { setRetrainBusy(false); }
  };

  const loadForecast = async () => {
    const p = productQ.trim().toLowerCase();
    if (!p) return;
    setFcLoading(true);
    setFcError('');
    setForecastData(null);
    setComparisonData(null);
    try {
      const token = localStorage.getItem('token');
      const [forecastRes, compareRes] = await Promise.all([
        axios.get(`${API_URL}/insights/analyst/forecast/${encodeURIComponent(p)}`, { headers: { Authorization: `Bearer ${token}` } }),
        axios.get(`${API_URL}/insights/analyst/forecast-vs-actual/${encodeURIComponent(p)}`, { headers: { Authorization: `Bearer ${token}` } }).catch(() => null),
      ]);
      setForecastData(forecastRes.data);
      setComparisonData(compareRes?.data || null);
    } catch (e) {
      setFcError(e.response?.data?.message || 'Forecast unavailable');
    } finally { setFcLoading(false); }
  };

  const ens = forecastData?.forecast?.models?.ensemble;
  const metrics = forecastData?.forecast?.metrics?.ensemble || {};
  const pieTotal = segments.reduce((sum, s) => sum + Number(s?.size || 0), 0);
  const pieData = segments.map((s, idx) => ({ label: s?.label || `Segment ${idx + 1}`, size: Number(s?.size || 0), color: PIE_COLORS[idx % PIE_COLORS.length] })).filter((s) => s.size > 0);

  const compMape = comparisonData?.metrics?.mape_pct;
  const compAccuracy = compMape != null ? Math.max(0, 100 - compMape) : null;

  return (
    <div className="min-h-screen flex flex-col bg-surface-900">
      <Navbar />
      <div className="p-8">

        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold text-text-primary">Analyst Dashboard</h2>
            <p className="text-text-muted mt-2">Welcome, <span className="text-accent">{user?.email}</span></p>
          </div>
          <button
            type="button"
            onClick={() => { setRetrainOpen(true); setRetrainMsg(null); }}
            className="bg-accent hover:bg-accent-hover text-white text-sm font-medium px-4 py-2 rounded-lg"
          >
            Retrain
          </button>
        </div>

        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-surface-800 p-6 rounded-xl shadow-xl">
            <h4 className="text-sm font-medium text-text-muted uppercase">Anomalies Detected</h4>
            <p className="text-3xl font-bold text-danger mt-2">{anomalyCount}</p>
            <div className="flex items-center justify-between mt-2 gap-2">
              <p className="text-xs text-text-faint">Current above-threshold count</p>
              <button
                type="button"
                onClick={loadAnomalyCount}
                disabled={anomalyRefreshing}
                className="text-xs px-2 py-1 rounded bg-surface-700 hover:bg-surface-600 disabled:opacity-60"
              >
                {anomalyRefreshing ? 'Refreshing…' : 'Refresh'}
              </button>
            </div>
            {anomalyError && <p className="text-xs text-danger mt-2">{anomalyError}</p>}
          </div>

          <div className="bg-surface-800 p-6 rounded-xl shadow-xl">
            <h4 className="text-sm font-medium text-text-muted uppercase">Segments Tracked</h4>
            <p className="text-3xl font-bold text-warning mt-2">{segments.length || '—'}</p>
            <p className="text-xs text-text-faint mt-1">
              {pieTotal > 0 ? `${pieTotal} customers classified` : 'Run ML to segment customers'}
            </p>
          </div>

          <div className="bg-surface-800 p-6 rounded-xl shadow-xl">
            <h4 className="text-sm font-medium text-text-muted uppercase">Products Analyzed</h4>
            <p className="text-3xl font-bold text-teal-400 mt-2">{topProducts.length || '—'}</p>
            <p className="text-xs text-text-faint mt-1">Showing top sellers by volume</p>
          </div>
        </div>

        <div className="mt-8">
          <div className="bg-surface-800 p-6 rounded-xl shadow-xl">
            <h3 className="text-lg font-semibold text-text-primary mb-4">Product forecast &amp; accuracy</h3>
            <p className="text-xs text-text-faint mb-3">Enter a product name (lowercase, as in ML artifacts).</p>
            <div className="flex gap-2 flex-wrap">
              <input
                className="flex-1 min-w-[180px] bg-surface-900 border border-surface-600 rounded-lg px-3 py-2 text-sm text-text-primary"
                placeholder="e.g. banana"
                value={productQ}
                onChange={(e) => setProductQ(e.target.value)}
              />
              <button
                type="button"
                onClick={loadForecast}
                disabled={fcLoading}
                className="bg-accent hover:bg-accent-hover disabled:opacity-50 text-white text-sm px-4 py-2 rounded-lg"
              >
                {fcLoading ? 'Loading…' : 'Load'}
              </button>
            </div>
            {fcError && <p className="text-danger text-sm mt-3">{fcError}</p>}

            {forecastData && (
              <div className="mt-5 grid grid-cols-1 lg:grid-cols-2 gap-6">

                <div className="space-y-3">
                  <h4 className="text-sm font-semibold text-text-secondary uppercase tracking-wide">Forecast details</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-surface-900 rounded-lg p-3">
                      <p className="text-xs text-text-faint">5-day total</p>
                      <p className="text-xl font-bold text-success">{ens?.total ?? '—'}</p>
                    </div>
                    <div className="bg-surface-900 rounded-lg p-3">
                      <p className="text-xs text-text-faint">Avg daily</p>
                      <p className="text-xl font-bold text-teal-400">{ens?.avg_daily ?? '—'}</p>
                    </div>
                    <div className="bg-surface-900 rounded-lg p-3">
                      <p className="text-xs text-text-faint">MAE</p>
                      <p className="text-xl font-bold text-text-primary">{metrics.mae != null ? metrics.mae.toFixed(3) : '—'}</p>
                    </div>
                    <div className="bg-surface-900 rounded-lg p-3">
                      <p className="text-xs text-text-faint">RMSE</p>
                      <p className="text-xl font-bold text-text-primary">{metrics.rmse != null ? metrics.rmse.toFixed(3) : '—'}</p>
                    </div>
                  </div>
                  <div className="bg-surface-900 rounded-lg p-3">
                    <p className="text-xs text-text-faint mb-1">Confidence</p>
                    <span className={`text-sm font-semibold ${
                      forecastData.analyst?.confidence_rating === 'High' ? 'text-success' :
                      forecastData.analyst?.confidence_rating === 'Medium' ? 'text-warning' :
                      'text-danger'
                    }`}>
                      {forecastData.analyst?.confidence_rating}
                    </span>
                    <span className="text-xs text-text-muted ml-2">{forecastData.analyst?.confidence_reason}</span>
                  </div>
                  <div className="bg-surface-900 rounded-lg p-3">
                    <p className="text-xs text-text-faint mb-1">Trend driver</p>
                    <p className="text-sm text-text-secondary">{forecastData.analyst?.trend_driver}</p>
                    <p className="text-xs text-text-muted mt-1">{forecastData.analyst?.trend_reason}</p>
                  </div>
                  {forecastData.analyst?.previous_persisted_runs?.length > 0 && (
                    <div className="bg-surface-900 rounded-lg p-3">
                      <p className="text-xs text-text-faint mb-2">Recent persisted forecast totals</p>
                      <ul className="space-y-1">
                        {forecastData.analyst.previous_persisted_runs.slice(0, 4).map((r, i) => (
                          <li key={i} className="text-xs text-text-muted flex justify-between">
                            <span>{r.created_at ? new Date(r.created_at).toLocaleString() : '—'}</span>
                            <span className="text-teal-400 font-semibold">{r.ensemble_total_5d ?? 'N/A'}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                <div>
                  {comparisonData ? (
                    <div className="space-y-3">
                      <h4 className="text-sm font-semibold text-text-secondary uppercase tracking-wide">
                        Forecast vs actual
                      </h4>
                      <p className="text-xs text-text-faint">
                        {comparisonData.forecast_window?.start} to {comparisonData.forecast_window?.end}
                      </p>

                      {compAccuracy != null && (
                        <div className="bg-surface-900 rounded-lg p-4 text-center">
                          <p className="text-xs text-text-faint mb-1">Prediction accuracy</p>
                          <p className={`text-3xl font-bold ${compAccuracy >= 80 ? 'text-success' : compAccuracy >= 60 ? 'text-warning' : 'text-danger'}`}>
                            {compAccuracy.toFixed(1)}%
                          </p>
                        </div>
                      )}

                      <div className="grid grid-cols-3 gap-2">
                        <div className="bg-surface-900 rounded-lg p-3 text-center">
                          <p className="text-xs text-text-faint">MAE</p>
                          <p className="text-lg font-bold text-success">{comparisonData.metrics?.mae ?? '—'}</p>
                        </div>
                        <div className="bg-surface-900 rounded-lg p-3 text-center">
                          <p className="text-xs text-text-faint">RMSE</p>
                          <p className="text-lg font-bold text-teal-400">{comparisonData.metrics?.rmse ?? '—'}</p>
                        </div>
                        <div className="bg-surface-900 rounded-lg p-3 text-center">
                          <p className="text-xs text-text-faint">MAPE</p>
                          <p className="text-lg font-bold text-warning">{comparisonData.metrics?.mape_pct != null ? `${comparisonData.metrics.mape_pct}%` : '—'}</p>
                        </div>
                      </div>

                      <div className="bg-surface-900 rounded-lg p-3 flex justify-between text-sm">
                        <div>
                          <p className="text-xs text-text-faint">Forecast total</p>
                          <p className="text-success font-semibold">{comparisonData.totals?.forecast ?? '—'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-text-faint">Actual total</p>
                          <p className="text-text-secondary font-semibold">{comparisonData.totals?.actual ?? '—'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-text-faint">Error</p>
                          <p className={`font-semibold ${(comparisonData.totals?.error || 0) >= 0 ? 'text-warning' : 'text-danger'}`}>
                            {comparisonData.totals?.error ?? '—'}
                          </p>
                        </div>
                      </div>

                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="text-text-faint border-b border-surface-700">
                              <th className="py-2 pr-3 text-left font-medium">Date</th>
                              <th className="py-2 pr-3 text-right font-medium">Forecast</th>
                              <th className="py-2 pr-3 text-right font-medium">Actual</th>
                              <th className="py-2 text-right font-medium">Error</th>
                            </tr>
                          </thead>
                          <tbody>
                            {(comparisonData.points || []).map((point) => (
                              <tr key={point.date} className="border-b border-surface-700 hover:bg-surface-700/20">
                                <td className="py-2 pr-3 text-text-muted">{point.date}</td>
                                <td className="py-2 pr-3 text-right text-teal-400">{point.forecast}</td>
                                <td className="py-2 pr-3 text-right text-text-secondary">{point.actual}</td>
                                <td className={`py-2 text-right font-medium ${point.error > 0 ? 'text-warning' : point.error < 0 ? 'text-danger' : 'text-text-muted'}`}>
                                  {point.error > 0 ? '+' : ''}{point.error}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-surface-900 rounded-lg p-8 text-center">
                      <p className="text-text-faint text-sm">No forecast-vs-actual data available yet.</p>
                      <p className="text-text-faint text-xs mt-1">Upload sales data past a forecast window to see comparisons.</p>
                    </div>
                  )}
                </div>

              </div>
            )}
          </div>
        </div>

        <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-surface-800 p-6 rounded-xl shadow-xl">
            <h3 className="text-lg font-semibold text-text-primary mb-1">Customer segment distribution</h3>
            <p className="text-xs text-text-faint mb-4">Customer segment sizes.</p>
            {segLoading ? (
              <p className="text-text-muted text-sm">Loading…</p>
            ) : segError ? (
              <p className="text-danger text-sm">{segError}</p>
            ) : !pieData.length || pieTotal <= 0 ? (
              <p className="text-text-muted text-sm">No segment distribution data available.</p>
            ) : (
              <div className="flex flex-col sm:flex-row gap-6 items-center">
                <div className="flex-shrink-0">
                  <svg viewBox="0 0 320 320" className="w-52 h-52">
                    {(() => {
                      let currentAngle = -Math.PI / 2;
                      return pieData.map((segment) => {
                        const portion = segment.size / pieTotal;
                        const nextAngle = currentAngle + portion * Math.PI * 2;
                        const midAngle = (currentAngle + nextAngle) / 2;
                        const labelX = 160 + 110 * Math.cos(midAngle);
                        const labelY = 160 + 110 * Math.sin(midAngle);
                        const path = createArc(160, 160, 90, currentAngle, nextAngle);
                        const percent = (portion * 100).toFixed(1);
                        currentAngle = nextAngle;
                        return (
                          <g key={segment.label}>
                            <path d={path} fill={segment.color} stroke="var(--color-surface-900)" strokeWidth="2" />
                            <text x={labelX} y={labelY} fill="#fff" fontSize="10" textAnchor="middle" dominantBaseline="middle">{percent}%</text>
                          </g>
                        );
                      });
                    })()}
                  </svg>
                </div>
                <div className="space-y-2 flex-1">
                  {pieData.map((segment) => {
                    const pct = ((segment.size / pieTotal) * 100).toFixed(1);
                    return (
                      <div key={segment.label} className="flex items-center gap-3 text-sm">
                        <span className="inline-block h-3 w-3 rounded-full" style={{ backgroundColor: segment.color }} />
                        <span className="text-text-primary">{segment.label}</span>
                        <span className="text-text-faint">({segment.size})</span>
                        <span className="text-teal-400 ml-auto">{pct}%</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          <div className="bg-surface-800 p-6 rounded-xl shadow-xl">
            <h3 className="text-lg font-semibold text-text-primary mb-1">Popular products by segment</h3>
            <p className="text-xs text-text-faint mb-4">Top products per customer segment.</p>
            {segLoading ? (
              <p className="text-text-muted text-sm">Loading…</p>
            ) : segError ? (
              <p className="text-danger text-sm">{segError}</p>
            ) : (
              <div className="max-h-72 overflow-y-auto space-y-2">
                {segments.map((s) => (
                  <div key={s.segment_id ?? s.label} className="border border-surface-700 rounded-lg p-3">
                    <div className="flex items-center justify-between">
                      <p className="text-teal-400 font-medium text-sm">{s.label}</p>
                      <p className="text-xs text-text-faint">Size: {s.size}</p>
                    </div>
                    <p className="text-xs text-text-muted mt-1">
                      {(s.top_products || [])
                        .slice(0, 5)
                        .map((p) => (typeof p === 'string' ? p : p?.product))
                        .filter(Boolean)
                        .join(', ') || '—'}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="mt-8 bg-surface-800 p-6 rounded-xl shadow-xl">
          <h3 className="text-lg font-semibold text-text-primary mb-1">Top 10 Products</h3>
          <p className="text-xs text-text-faint mb-6">By total quantity sold</p>

          {loadingChart ? (
            <p className="text-text-muted">Loading chart...</p>
          ) : chartError ? (
            <p className="text-danger">{chartError}</p>
          ) : !topProducts.length ? (
            <p className="text-text-muted">No product sales data available.</p>
          ) : (
            <div className="relative">
              <div className="flex gap-0">
                <div className="flex flex-col-reverse justify-between pr-3 pb-10" style={{ minWidth: '40px' }}>
                  {yTicks.map((tick) => (
                    <span key={tick} className="text-xs text-text-faint text-right leading-none">{tick}</span>
                  ))}
                </div>
                <div className="flex-1 flex flex-col">
                  <div className="relative flex items-end gap-2 border-l border-b border-surface-700" style={{ height: '260px' }}>
                    {yTicks.map((tick) => (
                      <div key={tick} className="absolute left-0 right-0 border-t border-surface-700/50" style={{ bottom: `${(tick / chartMax) * 100}%` }} />
                    ))}
                    {topProducts.map((p, i) => {
                      const heightPct = (p.qty / chartMax) * 100;
                      const isHovered = hoveredBar === i;
                      const grad = BAR_GRADIENTS[i % BAR_GRADIENTS.length];
                      return (
                        <div
                          key={p.name}
                          className="relative flex-1 flex flex-col justify-end group cursor-pointer"
                          style={{ height: '100%' }}
                          onMouseEnter={() => setHoveredBar(i)}
                          onMouseLeave={() => setHoveredBar(null)}
                        >
                          {isHovered && (
                            <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 z-10 bg-surface-900 border border-surface-600 text-white rounded-lg px-4 py-3 whitespace-nowrap shadow-xl pointer-events-none">
                              <p className="text-sm font-bold text-text-primary mb-1">{p.name}</p>
                              <p className="text-xs text-text-faint">Qty: <span className="font-bold text-text-primary text-sm">{p.qty}</span></p>
                              <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-surface-600" />
                            </div>
                          )}
                          <div
                            className="w-full rounded-t-md transition-all duration-150"
                            style={{
                              height: `${Math.max(2, heightPct)}%`,
                              background: isHovered ? `linear-gradient(to top, ${grad[1]}, ${grad[0]})` : `linear-gradient(to top, ${grad[0]}, ${grad[1]}80)`,
                              boxShadow: isHovered ? `0 0 12px ${grad[0]}50` : 'none',
                            }}
                          />
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex gap-2 mt-2">
                    {topProducts.map((p) => (
                      <div key={p.name} className="flex-1 text-center">
                        <span className="text-xs text-text-muted block overflow-hidden" style={{ writingMode: 'vertical-rl', transform: 'rotate(180deg)', maxHeight: '80px', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={p.name}>{p.name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

      </div>

      {retrainOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-surface-800 rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6">
            <h3 className="text-lg font-semibold text-text-primary mb-2">Retrain — export daily sales</h3>
            <p className="text-xs text-text-faint mb-4">Exports the flat CSV (ML training format) from <code className="text-text-muted">daily_sales</code> for the selected period. Download only, or push to ML service.</p>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-text-faint">Start date</label>
                <input type="date" className="w-full mt-1 bg-surface-900 border border-surface-600 rounded-lg px-3 py-2 text-sm text-text-primary" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </div>
              <div>
                <label className="text-xs text-text-faint">End date</label>
                <input type="date" className="w-full mt-1 bg-surface-900 border border-surface-600 rounded-lg px-3 py-2 text-sm text-text-primary" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              </div>
            </div>
            {retrainMsg && (
              <div className={`mt-4 text-sm rounded-lg px-3 py-2 ${retrainMsg.ok ? 'bg-success/40 text-success' : 'bg-danger/40 text-danger'}`}>{retrainMsg.text}</div>
            )}
            <div className="flex flex-wrap gap-2 mt-6">
              <button type="button" onClick={() => setRetrainOpen(false)} className="flex-1 min-w-[100px] bg-surface-700 hover:bg-surface-600 text-text-primary text-sm py-2 rounded-lg">Close</button>
              <button type="button" onClick={downloadExport} className="flex-1 min-w-[100px] bg-surface-600 hover:bg-surface-500 text-white text-sm py-2 rounded-lg">Download CSV</button>
              <button type="button" onClick={runRetrain} disabled={retrainBusy} className="flex-1 min-w-[100px] bg-accent hover:bg-accent-hover disabled:opacity-50 text-white text-sm py-2 rounded-lg">{retrainBusy ? '…' : 'Reload ML'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
