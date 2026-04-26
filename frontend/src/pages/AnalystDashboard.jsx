import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { Navbar } from '../components/Navbar';

const API_URL = 'http://localhost:5000/api';

export const AnalystDashboard = () => {
  const { user } = useAuth();
  const [topProducts, setTopProducts] = useState([]);
  const [loadingChart, setLoadingChart] = useState(false);
  const [chartError, setChartError] = useState('');
  const [hoveredBar, setHoveredBar] = useState(null);

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

  const [allForecasts, setAllForecasts] = useState([]);
  const [forecastsLoading, setForecastsLoading] = useState(false);
  const [forecastsError, setForecastsError] = useState('');

  const [abnormalDrops, setAbnormalDrops] = useState([]);
  const [dropsLoading, setDropsLoading] = useState(false);
  const [dropsError, setDropsError] = useState('');

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

  useEffect(() => {
    const loadForecasts = async () => {
      setForecastsLoading(true);
      setForecastsError('');
      try {
        const token = localStorage.getItem('token');
        const res = await axios.get(`${API_URL}/insights/analyst/forecasts`, {
          headers: { Authorization: `Bearer ${token}` },
          params: { limit: 20, sort_by: 'ensemble_total' },
        });
        setAllForecasts(res.data?.forecasts || []);
      } catch (e) {
        setForecastsError(e.response?.data?.message || 'Could not load forecasts');
      } finally {
        setForecastsLoading(false);
      }
    };
    loadForecasts();
  }, []);

  useEffect(() => {
    const loadDrops = async () => {
      setDropsLoading(true);
      setDropsError('');
      try {
        const token = localStorage.getItem('token');
        const res = await axios.get(`${API_URL}/insights/analyst/abnormal-drops`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setAbnormalDrops(res.data?.alerts || []);
      } catch (e) {
        setDropsError(e.response?.data?.message || 'Could not load abnormal drop alerts');
      } finally {
        setDropsLoading(false);
      }
    };
    loadDrops();
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
    if (!startDate || !endDate) {
      setRetrainMsg({ ok: false, text: 'Choose start and end dates.' });
      return;
    }
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
    if (!startDate || !endDate) {
      setRetrainMsg({ ok: false, text: 'Choose start and end dates.' });
      return;
    }
    setRetrainBusy(true);
    setRetrainMsg(null);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.post(
        `${API_URL}/analyst/retrain`,
        { startDate, endDate },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setRetrainMsg({
        ok: true,
        text: res.data?.message || 'ML reloaded.',
        detail: res.data?.ml,
      });
    } catch (e) {
      setRetrainMsg({
        ok: false,
        text: e.response?.data?.message || e.message || 'Retrain failed',
      });
    } finally {
      setRetrainBusy(false);
    }
  };

  const loadForecast = async () => {
    const p = productQ.trim().toLowerCase();
    if (!p) return;
    setFcLoading(true);
    setFcError('');
    setForecastData(null);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API_URL}/insights/analyst/forecast/${encodeURIComponent(p)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setForecastData(res.data);
    } catch (e) {
      setFcError(e.response?.data?.message || 'Forecast unavailable');
    } finally {
      setFcLoading(false);
    }
  };

  const ens = forecastData?.forecast?.models?.ensemble;
  const metrics = forecastData?.forecast?.metrics?.ensemble || {};

  return (
    <div className="min-h-screen flex flex-col bg-gray-900">
      <Navbar />
      <div className="p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold text-gray-50">Analyst Dashboard</h2>
            <p className="text-gray-400 mt-2">Welcome, {user?.email}</p>
          </div>
          <button
            type="button"
            onClick={() => {
              setRetrainOpen(true);
              setRetrainMsg(null);
            }}
            className="bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium px-4 py-2 rounded-lg"
          >
            Retrain
          </button>
        </div>

        {/* Stat cards */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="bg-gray-800 p-6 rounded-xl shadow-xl">
            <h4 className="text-sm font-medium text-gray-400 uppercase">Sales Trends</h4>
            <p className="text-3xl font-bold text-teal-500 mt-2">↑ 12.5%</p>
            <p className="text-xs text-gray-500 mt-1">30-day trend</p>
          </div>
          <div className="bg-gray-800 p-6 rounded-xl shadow-xl">
            <h4 className="text-sm font-medium text-gray-400 uppercase">Anomalies Detected</h4>
            <p className="text-3xl font-bold text-rose-500 mt-2">3</p>
            <p className="text-xs text-gray-500 mt-1">This week</p>
          </div>
          <div className="bg-gray-800 p-6 rounded-xl shadow-xl">
            <h4 className="text-sm font-medium text-gray-400 uppercase">Forecast Accuracy</h4>
            <p className="text-3xl font-bold text-purple-500 mt-2">94.2%</p>
            <p className="text-xs text-gray-500 mt-1">Last 7 days</p>
          </div>
        </div>

        <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Abnormal Drop Alerts */}
          <div className="bg-gray-800 p-6 rounded-xl shadow-xl">
            <h3 className="text-lg font-semibold text-gray-50 mb-4">Abnormal Drop Alerts</h3>
            {dropsLoading ? (
              <p className="text-gray-400 text-sm">Loading drop alerts…</p>
            ) : dropsError ? (
              <p className="text-red-400 text-sm">{dropsError}</p>
            ) : abnormalDrops.length === 0 ? (
              <p className="text-gray-400 text-sm">No abnormal drops detected</p>
            ) : (
              <div className="max-h-96 overflow-y-auto space-y-3">
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
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="text-gray-100 font-medium text-sm">{drop.product}</p>
                        <p className="text-xs text-gray-400">{drop.category}</p>
                      </div>
                      <span className={`text-xs font-bold px-2 py-1 rounded ${
                        drop.severity === 'high'
                          ? 'bg-red-500 text-white'
                          : drop.severity === 'medium'
                          ? 'bg-yellow-500 text-gray-900'
                          : 'bg-blue-500 text-white'
                      }`}>
                        {drop.severity.toUpperCase()}
                      </span>
                    </div>
                    <div className="mt-2 text-xs text-gray-300 space-y-1">
                      <p>Forecast (5d): <span className="text-teal-400 font-semibold">{drop.ensemble_total_5d}</span></p>
                      <p>Baseline (5d): <span className="text-purple-400 font-semibold">{drop.baseline_total_5d}</span></p>
                      <p className="text-red-400 font-bold">Drop: {drop.drop_pct}%</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 5-Day Sales Forecast */}
          <div className="bg-gray-800 p-6 rounded-xl shadow-xl">
            <h3 className="text-lg font-semibold text-gray-50 mb-4">5-Day Sales Forecast</h3>
            <p className="text-xs text-gray-500 mb-3">Top 20 products by forecasted sales volume</p>
            {forecastsLoading ? (
              <p className="text-gray-400 text-sm">Loading forecasts…</p>
            ) : forecastsError ? (
              <p className="text-red-400 text-sm">{forecastsError}</p>
            ) : allForecasts.length === 0 ? (
              <p className="text-gray-400 text-sm">No forecast data available. Upload sales data first.</p>
            ) : (
              <div className="max-h-96 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-gray-800 border-b border-gray-700">
                    <tr className="text-left text-gray-400 text-xs">
                      <th className="pb-2 pr-2">Product</th>
                      <th className="pb-2 px-2">Category</th>
                      <th className="pb-2 pl-2 text-right">5d Total</th>
                    </tr>
                  </thead>
                  <tbody className="text-gray-300">
                    {allForecasts.map((fc, idx) => (
                      <tr key={idx} className="border-b border-gray-700/50 hover:bg-gray-700/30">
                        <td className="py-2 pr-2">{fc.product}</td>
                        <td className="py-2 px-2 text-xs text-gray-400">{fc.category}</td>
                        <td className="py-2 pl-2 text-right">
                          <span className="text-teal-400 font-semibold">{fc.ensemble_total_5d}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-gray-800 p-6 rounded-xl shadow-xl">
            <h3 className="text-lg font-semibold text-gray-50 mb-4">Product forecast &amp; accuracy</h3>
            <p className="text-xs text-gray-500 mb-3">Enter a product name (lowercase, as in ML artifacts).</p>
            <div className="flex gap-2 flex-wrap">
              <input
                className="flex-1 min-w-[180px] bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-200"
                placeholder="e.g. banana"
                value={productQ}
                onChange={(e) => setProductQ(e.target.value)}
              />
              <button
                type="button"
                onClick={loadForecast}
                disabled={fcLoading}
                className="bg-teal-600 hover:bg-teal-500 disabled:opacity-50 text-white text-sm px-4 py-2 rounded-lg"
              >
                {fcLoading ? 'Loading…' : 'Load'}
              </button>
            </div>
            {fcError && <p className="text-red-400 text-sm mt-3">{fcError}</p>}
            {forecastData && (
              <div className="mt-4 space-y-2 text-sm">
                <p className="text-gray-300">
                  <span className="text-gray-500">5-day total (ensemble):</span>{' '}
                  <span className="text-teal-400 font-semibold">{ens?.total || 'N/A'}</span>
                </p>
                <p className="text-gray-300">
                  <span className="text-gray-500">Avg daily (ensemble):</span>{' '}
                  <span className="text-purple-400 font-semibold">{ens?.avg_daily || 'N/A'}</span>
                </p>
                <p className="text-gray-300">
                  <span className="text-gray-500">MAE (ensemble):</span>{' '}
                  {metrics.mae != null ? metrics.mae.toFixed(4) : '—'}
                </p>
                <p className="text-gray-300">
                  <span className="text-gray-500">RMSE (ensemble):</span>{' '}
                  {metrics.rmse != null ? metrics.rmse.toFixed(4) : '—'}
                </p>
                <p className="text-gray-300">
                  <span className="text-gray-500">Confidence:</span>{' '}
                  <span className={`font-semibold ${
                    forecastData.analyst?.confidence_rating === 'High' ? 'text-green-400' :
                    forecastData.analyst?.confidence_rating === 'Medium' ? 'text-yellow-400' :
                    'text-red-400'
                  }`}>
                    {forecastData.analyst?.confidence_rating}
                  </span> — {forecastData.analyst?.confidence_reason}
                </p>
                <p className="text-gray-400 text-xs">
                  Trend driver: <span className="text-teal-300">{forecastData.analyst?.trend_driver}</span> — {forecastData.analyst?.trend_reason}
                </p>
                {forecastData.analyst?.previous_persisted_runs?.length > 0 && (
                  <div className="mt-3 border-t border-gray-700 pt-3">
                    <p className="text-gray-500 text-xs mb-2">Recent persisted forecast totals (5-day, same product)</p>
                    <ul className="text-xs text-gray-400 space-y-1">
                      {forecastData.analyst.previous_persisted_runs.map((r, i) => (
                        <li key={i}>
                          {r.created_at ? new Date(r.created_at).toLocaleString() : '—'} — total{' '}
                          {r.ensemble_total_5d || 'N/A'}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="bg-gray-800 p-6 rounded-xl shadow-xl">
            <h3 className="text-lg font-semibold text-gray-50 mb-4">Popular products by segment</h3>
            {segLoading ? (
              <p className="text-gray-400 text-sm">Loading segments…</p>
            ) : segError ? (
              <p className="text-red-400 text-sm">{segError}</p>
            ) : (
              <div className="max-h-72 overflow-y-auto space-y-3">
                {segments.map((s) => (
                  <div key={s.segment_id ?? s.label} className="border border-gray-700 rounded-lg p-3">
                    <p className="text-teal-400 font-medium text-sm">{s.label}</p>
                    <p className="text-xs text-gray-500">Size: {s.size}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      Top products:{' '}
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

        <div className="mt-8 grid grid-cols-1 gap-6">
          {/* Vertical Bar Chart */}
          <div className="bg-gray-800 p-6 rounded-xl shadow-xl">
            <h3 className="text-lg font-semibold text-gray-50 mb-1">Top 10 Products</h3>
            <p className="text-xs text-gray-500 mb-6">By total quantity sold</p>

            {loadingChart ? (
              <p className="text-gray-400">Loading chart...</p>
            ) : chartError ? (
              <p className="text-red-400">{chartError}</p>
            ) : !topProducts.length ? (
              <p className="text-gray-400">No product sales data available.</p>
            ) : (
              <div className="relative">
                <div className="flex gap-0">
                  <div className="flex flex-col-reverse justify-between pr-3 pb-10" style={{ minWidth: '40px' }}>
                    {yTicks.map((tick) => (
                      <span key={tick} className="text-xs text-gray-500 text-right leading-none">
                        {tick}
                      </span>
                    ))}
                  </div>

                  <div className="flex-1 flex flex-col">
                    <div
                      className="relative flex items-end gap-2 border-l border-b border-gray-700"
                      style={{ height: '260px' }}
                    >
                      {yTicks.map((tick) => (
                        <div
                          key={tick}
                          className="absolute left-0 right-0 border-t border-gray-700/50"
                          style={{ bottom: `${(tick / chartMax) * 100}%` }}
                        />
                      ))}

                      {topProducts.map((p, i) => {
                        const heightPct = (p.qty / chartMax) * 100;
                        const isHovered = hoveredBar === i;
                        return (
                          <div
                            key={p.name}
                            className="relative flex-1 flex flex-col justify-end group cursor-pointer"
                            style={{ height: '100%' }}
                            onMouseEnter={() => setHoveredBar(i)}
                            onMouseLeave={() => setHoveredBar(null)}
                          >
                            {isHovered && (
                              <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 z-10 bg-gray-900 border border-teal-700 text-white rounded-lg px-4 py-3 whitespace-nowrap shadow-xl pointer-events-none">
                                <p className="text-sm font-bold text-teal-300 mb-1">{p.name}</p>
                                <p className="text-xs text-gray-400">
                                  Qty: <span className="font-bold text-white text-sm">{p.qty}</span>
                                </p>
                                <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-teal-700" />
                              </div>
                            )}

                            <div
                              className="w-full rounded-t-md transition-all duration-150"
                              style={{
                                height: `${Math.max(2, heightPct)}%`,
                                background: isHovered
                                  ? 'linear-gradient(to top, #0d9488, #67e8f9)'
                                  : 'linear-gradient(to top, #0f766e, #2dd4bf)',
                                boxShadow: isHovered ? '0 0 12px rgba(45,212,191,0.4)' : 'none',
                              }}
                            />
                          </div>
                        );
                      })}
                    </div>

                    <div className="flex gap-2 mt-2">
                      {topProducts.map((p) => (
                        <div key={p.name} className="flex-1 text-center">
                          <span
                            className="text-xs text-gray-400 block overflow-hidden"
                            style={{
                              writingMode: 'vertical-rl',
                              transform: 'rotate(180deg)',
                              maxHeight: '80px',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                            title={p.name}
                          >
                            {p.name}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {retrainOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md mx-4 p-6">
            <h3 className="text-lg font-semibold text-gray-50 mb-2">Retrain — export daily sales</h3>
            <p className="text-xs text-gray-500 mb-4">
              Exports the flat CSV (ML training format) from <code className="text-gray-400">daily_sales</code> for
              the selected period. You can download only, or push to the ML service (reload).
            </p>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-gray-500">Start date</label>
                <input
                  type="date"
                  className="w-full mt-1 bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-200"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs text-gray-500">End date</label>
                <input
                  type="date"
                  className="w-full mt-1 bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-200"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </div>
            {retrainMsg && (
              <div
                className={`mt-4 text-sm rounded-lg px-3 py-2 ${
                  retrainMsg.ok ? 'bg-teal-900/40 text-teal-200' : 'bg-red-900/40 text-red-200'
                }`}
              >
                {retrainMsg.text}
              </div>
            )}
            <div className="flex flex-wrap gap-2 mt-6">
              <button
                type="button"
                onClick={() => setRetrainOpen(false)}
                className="flex-1 min-w-[100px] bg-gray-700 hover:bg-gray-600 text-gray-200 text-sm py-2 rounded-lg"
              >
                Close
              </button>
              <button
                type="button"
                onClick={downloadExport}
                className="flex-1 min-w-[100px] bg-gray-600 hover:bg-gray-500 text-white text-sm py-2 rounded-lg"
              >
                Download CSV
              </button>
              <button
                type="button"
                onClick={runRetrain}
                disabled={retrainBusy}
                className="flex-1 min-w-[100px] bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-sm py-2 rounded-lg"
              >
                {retrainBusy ? '…' : 'Reload ML'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
