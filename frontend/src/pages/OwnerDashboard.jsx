import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { Navbar } from '../components/Navbar';

const API_URL = 'http://localhost:5000/api';

function LineChart({ series, legend, height = 220 }) {
  const w = 600;
  const pad = 24;
  if (!series?.length) return <p className="text-gray-500 text-sm">No series data.</p>;

  const all = series.flatMap((s) => s.values || []);
  const minV = Math.min(...all, 0);
  const maxV = Math.max(...all, 1);
  const span = maxV - minV || 1;
  const innerW = w - pad * 2;
  const innerH = height - pad * 2;

  const pointsFor = (values) =>
    (values || []).map((v, i) => {
      const x = pad + (i / Math.max(values.length - 1, 1)) * innerW;
      const y = pad + innerH - ((Number(v) - minV) / span) * innerH;
      return `${x},${y}`;
    });

  const colors = ['#2dd4bf', '#f472b6', '#a78bfa'];

  return (
    <div>
      <p className="text-xs text-gray-500 mb-2">{legend}</p>
      <svg viewBox={`0 0 ${w} ${height}`} className="w-full max-w-3xl h-auto">
        {[0, 0.25, 0.5, 0.75, 1].map((t) => {
          const y = pad + innerH - t * innerH;
          return (
            <line key={t} x1={pad} y1={y} x2={w - pad} y2={y} stroke="#374151" strokeWidth="1" />
          );
        })}
        {series.map((s, idx) => (
          <polyline
            key={s.key}
            fill="none"
            stroke={colors[idx % colors.length]}
            strokeWidth="2"
            points={pointsFor(s.values).join(' ')}
          />
        ))}
      </svg>
    </div>
  );
}

export const OwnerDashboard = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [alerts, setAlerts] = useState([]);
  const [forecastBatch, setForecastBatch] = useState(null);
  const [selectedProduct, setSelectedProduct] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('token');
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const [fcRes, alRes] = await Promise.all([
          axios.get(`${API_URL}/insights/owner/forecasts/latest`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          axios.get(`${API_URL}/insights/owner/alerts/abnormal-drops`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);
        setForecastBatch(fcRes.data);
        setAlerts(alRes.data?.alerts || []);
      } catch (e) {
        setError(e.response?.data?.message || e.message || 'Could not load forecasts');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const products = forecastBatch?.products || [];

  const selected = useMemo(
    () => products.find((p) => p.product_name === selectedProduct),
    [products, selectedProduct]
  );

  useEffect(() => {
    if (!selectedProduct && products[0]?.product_name) {
      setSelectedProduct(products[0].product_name);
    }
  }, [products, selectedProduct]);

  const chartSeries = useMemo(() => {
    if (!selected) return [];
    const ens = selected.ensemble_daily;
    const lstm = selected.lstm_daily;
    const sea = selected.seasonal_daily;
    const parseArr = (v) => {
      if (Array.isArray(v)) return v;
      if (typeof v === 'string') {
        try {
          return JSON.parse(v);
        } catch {
          return [];
        }
      }
      return [];
    };
    return [
      { key: 'ensemble', label: 'Ensemble', values: parseArr(ens) },
      { key: 'lstm', label: 'LSTM', values: parseArr(lstm) },
      { key: 'seasonal', label: 'Seasonal', values: parseArr(sea) },
    ];
  }, [selected]);

  return (
    <div className="min-h-screen flex flex-col bg-gray-900">
      <Navbar />
      <div className="p-8">
        <h2 className="text-2xl font-semibold text-gray-50">Owner Dashboard</h2>
        <p className="text-gray-400 mt-2">Welcome, {user?.email}</p>

        {loading ? (
          <p className="text-gray-400 mt-8">Loading forecasts…</p>
        ) : error ? (
          <p className="text-red-400 mt-8">{error}</p>
        ) : (
          <>
            <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-gray-800 p-6 rounded-xl shadow-xl">
                <h3 className="text-lg font-semibold text-gray-50 mb-2">Alerts</h3>
                <p className="text-xs text-gray-500 mb-4">
                  Triggered when the 30-day ensemble forecast is more than 30% below the historical daily mean
                  (from model metadata).
                </p>
                {!alerts.length ? (
                  <p className="text-gray-400 text-sm">No abnormal drops detected.</p>
                ) : (
                  <ul className="space-y-2">
                    {alerts.map((a, i) => (
                      <li
                        key={i}
                        className="text-sm border border-amber-700/50 bg-amber-950/30 rounded-lg px-3 py-2 text-amber-100"
                      >
                        <span className="font-medium capitalize">{a.severity}</span> — {a.product}: forecast{' '}
                        {a.ensemble_total_30d} vs baseline ~{a.baseline_total_30d} (
                        {a.drop_pct}% below)
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="bg-gray-800 p-6 rounded-xl shadow-xl">
                <h3 className="text-lg font-semibold text-gray-50 mb-2">Latest forecast run</h3>
                <p className="text-xs text-gray-500">
                  {forecastBatch?.created_at
                    ? new Date(forecastBatch.created_at).toLocaleString()
                    : 'No persisted forecasts yet — run Analyst Retrain after ML is up.'}
                </p>
                <p className="text-xs text-gray-600 mt-1 font-mono truncate">
                  {forecastBatch?.run_batch_id || '—'}
                </p>
              </div>
            </div>

            <div className="mt-8 bg-gray-800 p-6 rounded-xl shadow-xl">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
                <div>
                  <h3 className="text-lg font-semibold text-gray-50">30-day quantity forecast (per product)</h3>
                  <p className="text-xs text-gray-500 mt-1">Persisted by the ML service after each reload.</p>
                </div>
                <div className="flex items-center gap-2">
                  <label className="text-sm text-gray-400">Product</label>
                  <select
                    className="bg-gray-900 border border-gray-600 text-gray-200 text-sm rounded-lg px-3 py-2 min-w-[200px]"
                    value={selectedProduct}
                    onChange={(e) => setSelectedProduct(e.target.value)}
                  >
                    {products.map((p) => (
                      <option key={p.product_name} value={p.product_name}>
                        {p.product_name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {selected ? (
                <>
                  <p className="text-sm text-gray-400 mb-4">
                    30-day total (ensemble):{' '}
                    <span className="text-teal-400 font-semibold">{selected.ensemble_total_30d}</span>
                  </p>
                  <div className="overflow-x-auto">
                    <LineChart
                      series={chartSeries}
                      legend="Ensemble (teal) · LSTM (pink) · Seasonal (purple) — daily units sold"
                      height={240}
                    />
                  </div>
                  <div className="mt-4 flex flex-wrap gap-4 text-xs text-gray-500">
                    <span className="flex items-center gap-1">
                      <span className="w-3 h-3 rounded-full bg-teal-400" /> Ensemble
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-3 h-3 rounded-full bg-pink-400" /> LSTM
                    </span>
                    <span className="flex items-center gap-1">
                      <span className="w-3 h-3 rounded-full bg-violet-400" /> Seasonal
                    </span>
                  </div>
                </>
              ) : (
                <p className="text-gray-500">No forecast snapshots available.</p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};
