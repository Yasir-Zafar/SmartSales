import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { Navbar } from '../components/Navbar';

const API_URL = 'http://localhost:5000/api';

// ─── Line Chart ───────────────────────────────────────────────────────────────
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

// ─── PDF Export Hook ──────────────────────────────────────────────────────────
const usePdfExport = (filename = 'dashboard.pdf') => {
  const exportRef = useRef(null);

  const exportToPdf = useCallback(async () => {
    const element = exportRef.current;
    if (!element) return;

    const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
      import('html2canvas'),
      import('jspdf'),
    ]);

    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#111827',
    });

    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF({
      orientation: 'landscape',
      unit: 'px',
      format: [canvas.width / 2, canvas.height / 2],
    });

    pdf.addImage(imgData, 'PNG', 0, 0, canvas.width / 2, canvas.height / 2);
    pdf.save(filename);
  }, [filename]);

  return { exportRef, exportToPdf };
};

// ─── Stat Card ────────────────────────────────────────────────────────────────
const StatCard = ({ label, value, change, valueColor }) => (
  <div className="bg-gray-800 p-6 rounded-xl shadow-xl">
    <h4 className="text-sm font-medium text-gray-400 uppercase">{label}</h4>
    <p className={`text-3xl font-bold mt-2 ${valueColor}`}>{value}</p>
    {change && <p className="text-xs text-gray-500 mt-1">{change}</p>}
  </div>
);

// ─── Config ───────────────────────────────────────────────────────────────────
const STATS = [
  { label: 'Total Revenue', value: '$124,500', change: '+12.5% from last month', valueColor: 'text-teal-500' },
  { label: 'Total Sales', value: '1,842', change: '+8.2% from last month', valueColor: 'text-pink-500' },
  { label: 'Active Customers', value: '1,240', change: '+5.1% from last month', valueColor: 'text-purple-500' },
  { label: 'Profit Margin', value: '34.2%', change: '+2.1% from last month', valueColor: 'text-green-500' },
];

// ─── Main Component ───────────────────────────────────────────────────────────
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
    const parseArr = (v) => {
      if (Array.isArray(v)) return v;
      if (typeof v === 'string') {
        try { return JSON.parse(v); } catch { return []; }
      }
      return [];
    };
    const ensembleVals = parseArr(selected.ensemble_daily);
    const lstmVals = parseArr(selected.lstm_daily);
    const seasonalVals = parseArr(selected.seasonal_daily);

    // Only return series if we have data
    if (ensembleVals.length === 0 && lstmVals.length === 0 && seasonalVals.length === 0) {
      return [];
    }

    return [
      { key: 'ensemble', values: ensembleVals },
      { key: 'lstm', values: lstmVals },
      { key: 'seasonal', values: seasonalVals },
    ];
  }, [selected]);

  const { exportRef, exportToPdf } = usePdfExport('owner-dashboard.pdf');

  return (
    <div className="min-h-screen flex flex-col bg-gray-900">
      <Navbar />

      <div ref={exportRef} className="p-8">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-gray-50">Owner Dashboard</h2>
            <p className="text-gray-400 mt-2">Welcome, {user?.email}</p>
          </div>
          <button
            onClick={exportToPdf}
            className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white text-sm font-medium rounded-lg"
          >
            Export PDF
          </button>
        </div>

        {/* Stat Cards */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {STATS.map((stat) => (
            <StatCard key={stat.label} {...stat} />
          ))}
        </div>

        {/* Sales Summary + Forecast Card */}
        <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-teal-700/5 border border-teal-500/30 p-6 rounded-xl shadow-xl">
            <h3 className="text-lg font-semibold text-teal-200 mb-4">Sales Summary</h3>
            <p className="text-gray-300 mb-4">View owner-only sales by category and optional date range.</p>
            <Link
              to="/owner/sales-summary"
              className="inline-flex items-center justify-center bg-teal-500 hover:bg-teal-400 text-gray-900 font-semibold rounded-md px-4 py-2"
            >
              Open Sales Summary
            </Link>
          </div>

          <div className="bg-gray-800 p-6 rounded-xl shadow-xl">
            <h3 className="text-lg font-semibold text-gray-50 mb-4">Sales Forecast</h3>
            <p className="text-gray-400">AI-powered sales predictions and trends</p>
          </div>
        </div>

        {/* Alerts */}
        {alerts.length > 0 && (
          <div className="mt-8 bg-gray-800 p-6 rounded-xl shadow-xl">
            <h3 className="text-lg font-semibold text-gray-50 mb-4">Abnormal Drop Alerts</h3>
            <ul className="space-y-2">
              {alerts.map((a, i) => (
                <li key={i} className="text-sm text-red-400">{JSON.stringify(a)}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Forecast Chart */}
        <div className="mt-8 bg-gray-800 p-6 rounded-xl shadow-xl">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-50">5-Day Sales Forecast</h3>
            {products.length > 0 && (
              <select
                value={selectedProduct}
                onChange={(e) => setSelectedProduct(e.target.value)}
                className="bg-gray-700 text-gray-200 text-sm px-3 py-1.5 rounded-lg border border-gray-600 focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                {products.map((p) => (
                  <option key={p.product_name} value={p.product_name}>
                    {p.product_name}
                  </option>
                ))}
              </select>
            )}
          </div>

          {loading && <p className="text-gray-400 text-sm">Loading forecasts…</p>}
          {error && <p className="text-red-400 text-sm">{error}</p>}
          {!loading && !error && products.length === 0 && (
            <p className="text-gray-400 text-sm">No forecast data available. Upload sales data first.</p>
          )}
          {!loading && !error && chartSeries.length > 0 && (
            <>
              <LineChart series={chartSeries} legend="Ensemble · LSTM · Seasonal (5-day forecast)" />
              {selected && (
                <div className="mt-4 grid grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-gray-500">Ensemble Total</p>
                    <p className="text-teal-400 font-semibold text-lg">
                      {selected.ensemble_total_5d || 'N/A'}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500">Forecast Period</p>
                    <p className="text-gray-300">
                      {selected.forecast_start} to {selected.forecast_end}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-500">Category</p>
                    <p className="text-gray-300 capitalize">{selected.category || 'N/A'}</p>
                  </div>
                </div>
              )}
            </>
          )}
          {!loading && !error && chartSeries.length === 0 && products.length > 0 && (
            <p className="text-amber-400 text-sm">No chart data available for this product.</p>
          )}
        </div>

      </div>
    </div>
  );
};