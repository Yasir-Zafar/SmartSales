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

//const API_URL = 'http://localhost:5000/api';

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

// ─── PDF Export Hook ────────────────────────────────────────────────────────
// Drop new cards/sections anywhere inside <div ref={exportRef}> and they'll
// automatically appear in the exported PDF — no changes needed here.
const usePdfExport = (filename = 'dashboard.pdf') => {
  const exportRef = useRef(null);

  const exportToPdf = useCallback(async () => {
    const element = exportRef.current;
    if (!element) return;

    // Dynamically import to keep bundle lean
    const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
      import('html2canvas'),
      import('jspdf'),
    ]);

    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#111827', // matches bg-gray-900
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

// ─── Stat Card ───────────────────────────────────────────────────────────────
// Add new metric cards by just adding an entry to the STATS array below.
const StatCard = ({ label, value, change, valueColor }) => (
  <div className="bg-gray-800 p-6 rounded-xl shadow-xl">
    <h4 className="text-sm font-medium text-gray-400 uppercase">{label}</h4>
    <p className={`text-3xl font-bold mt-2 ${valueColor}`}>{value}</p>
    {change && <p className="text-xs text-gray-500 mt-1">{change}</p>}
  </div>
);

// ─── Config — edit this to add/remove stat cards ─────────────────────────────
const STATS = [
  { label: 'Total Revenue',    value: '$124,500', change: '+12.5% from last month', valueColor: 'text-teal-500'   },
  { label: 'Total Sales',      value: '1,842',    change: '+8.2% from last month',  valueColor: 'text-pink-500'   },
  { label: 'Active Customers', value: '1,240',    change: '+5.1% from last month',  valueColor: 'text-purple-500' },
  { label: 'Profit Margin',    value: '34.2%',    change: '+2.1% from last month',  valueColor: 'text-green-500'  },
];

// ─── Main Component ──────────────────────────────────────────────────────────
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

  const { exportRef, exportToPdf } = usePdfExport('owner-dashboard.pdf');

  return (
    <div className="min-h-screen flex flex-col bg-gray-900">
      <Navbar />

      {/* ↓ Everything inside this div is captured in the PDF export */}
      <div ref={exportRef} className="p-8">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-gray-50">Owner Dashboard</h2>
            <p className="text-gray-400 mt-2">Welcome, {user?.email}</p>
          </div>
          <button
            onClick={exportToPdf}
            className="px-4 py-2 bg-teal-600 hover:bg-teal-500 text-white text-sm font-medium rounded-lg transition-colors"
          >
            Export PDF
          </button>
        </div>

        {/* Stat Cards — driven by STATS array above */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {STATS.map((stat) => (
            <StatCard key={stat.label} {...stat} />
          ))}
        </div>

        {/* Content Sections — add more <div> blocks here freely */}
        <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-gray-800 p-6 rounded-xl shadow-xl">
            <h3 className="text-lg font-semibold text-gray-50 mb-4">Sales Forecast</h3>
            <p className="text-gray-400">AI-powered sales predictions and trends</p>
          </div>
          <div className="bg-gray-800 p-6 rounded-xl shadow-xl">
            <h3 className="text-lg font-semibold text-gray-50 mb-4">Customer Segmentation</h3>
            <p className="text-gray-400">Customer groups and behavior analysis</p>
          </div>
        </div>

        {/* Add future sections below — they'll export automatically */}

      </div>
    </div>
  );
};