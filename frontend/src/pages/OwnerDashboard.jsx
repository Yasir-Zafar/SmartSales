import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { Navbar } from '../components/Navbar';

const API_URL = 'http://localhost:5000/api';
const KPI_REFRESH_MS = 15000;

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

// ─── Main Component ───────────────────────────────────────────────────────────
export const OwnerDashboard = () => {
  const { user } = useAuth();
  const [forecastBatch, setForecastBatch] = useState(null);
  const [liveKpis, setLiveKpis] = useState(null);
  const [kpiError, setKpiError] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('token');
    const load = async () => {
      try {
        const [fcRes, kpiRes] = await Promise.all([
          axios.get(`${API_URL}/insights/owner/forecasts/latest`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
          axios.get(`${API_URL}/insights/owner/kpis/live`, {
            headers: { Authorization: `Bearer ${token}` },
          }),
        ]);
        setForecastBatch(fcRes.data);
        setLiveKpis(kpiRes.data);
        setKpiError('');
      } catch (e) {
        console.error('Owner forecasts load failed', e);
        setKpiError('Could not load live KPI data');
      }
    };

    load();
    const id = setInterval(load, KPI_REFRESH_MS);
    return () => clearInterval(id);
  }, []);

  const { exportRef, exportToPdf } = usePdfExport('owner-dashboard.pdf');

  const kpiRows = [
    {
      label: 'Total Revenue',
      value: liveKpis ? `$${Number(liveKpis.kpis?.total_revenue || 0).toLocaleString()}` : '—',
      change: liveKpis?.kpis?.revenue_change_pct != null
        ? `${liveKpis.kpis.revenue_change_pct >= 0 ? '+' : ''}${liveKpis.kpis.revenue_change_pct}% vs previous month`
        : 'No previous month baseline',
      valueColor: 'text-teal-500',
    },
    {
      label: 'Total Sales (Units)',
      value: liveKpis ? Number(liveKpis.kpis?.total_units_sold || 0).toLocaleString() : '—',
      change: 'Updated from uploaded sales data',
      valueColor: 'text-pink-500',
    },
    {
      label: 'Active Customers',
      value: liveKpis ? Number(liveKpis.kpis?.active_customers || 0).toLocaleString() : '—',
      change: 'Distinct customers in all sales records',
      valueColor: 'text-purple-500',
    },
    {
      label: 'Latest Month Revenue',
      value: liveKpis ? `$${Number(liveKpis.kpis?.current_month_revenue || 0).toLocaleString()}` : '—',
      change: liveKpis?.latest_upload_at
        ? `Latest upload: ${new Date(liveKpis.latest_upload_at).toLocaleString()}`
        : liveKpis?.anchored_latest_sale_date
          ? `Anchored to sales month: ${liveKpis.anchored_latest_sale_date}`
          : 'No upload history available',
      valueColor: 'text-green-500',
    },
  ];

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
          {kpiRows.map((stat) => (
            <StatCard key={stat.label} {...stat} />
          ))}
        </div>
        {kpiError && <p className="text-red-400 text-sm mt-3">{kpiError}</p>}

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

        <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-gray-800 p-6 rounded-xl shadow-xl border border-rose-500/20">
            <h3 className="text-lg font-semibold text-gray-50 mb-2">Inventory</h3>
            <p className="text-gray-400 text-sm mb-4">See all products and stock levels. Below 10 units shows tiered warnings by severity.</p>
            <Link
              to="/owner/inventory"
              className="inline-flex items-center justify-center bg-rose-500 hover:bg-rose-400 text-gray-900 font-semibold rounded-md px-4 py-2"
            >
              Open Inventory
            </Link>
          </div>
          <div className="bg-gray-800 p-6 rounded-xl shadow-xl border border-red-500/20">
            <h3 className="text-lg font-semibold text-gray-50 mb-2">Abnormal Drop Alerts</h3>
            <p className="text-gray-400 text-sm mb-4">Moved to a dedicated page for easier monitoring.</p>
            <Link
              to="/owner/alerts"
              className="inline-flex items-center justify-center bg-red-500 hover:bg-red-400 text-gray-900 font-semibold rounded-md px-4 py-2"
            >
              Open Alerts Page
            </Link>
          </div>
          <div className="bg-gray-800 p-6 rounded-xl shadow-xl border border-teal-500/20">
            <h3 className="text-lg font-semibold text-gray-50 mb-2">5-Day Sales Forecast</h3>
            <p className="text-gray-400 text-sm mb-4">Moved from Analyst to a dedicated owner page.</p>
            <Link
              to="/owner/forecasts"
              className="inline-flex items-center justify-center bg-teal-500 hover:bg-teal-400 text-gray-900 font-semibold rounded-md px-4 py-2"
            >
              Open Forecast Page
            </Link>
            <p className="text-xs text-gray-500 mt-3">
              Latest batch: {forecastBatch?.created_at ? new Date(forecastBatch.created_at).toLocaleString() : 'N/A'}
            </p>
          </div>
        </div>

        <div className="mt-8">
          <div className="bg-gray-800 p-6 rounded-xl shadow-xl border border-violet-500/20">
            <h3 className="text-lg font-semibold text-gray-50 mb-2">Customer Segment Membership</h3>
            <p className="text-gray-400 text-sm mb-4">
              See what segment each customer belongs to for clearer consumer-base insights.
            </p>
            <Link
              to="/owner/customer-segments"
              className="inline-flex items-center justify-center bg-violet-500 hover:bg-violet-400 text-gray-900 font-semibold rounded-md px-4 py-2"
            >
              Open Customer Segments
            </Link>
          </div>
        </div>

      </div>
    </div>
  );
};