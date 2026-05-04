import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { Navbar } from '../components/Navbar';

const API_URL = 'http://localhost:5000/api';
const KPI_REFRESH_MS = 15000;

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

const StatCard = ({ label, value, change, valueColor }) => (
  <div className="bg-gray-800 p-6 rounded-xl shadow-xl">
    <h4 className="text-sm font-medium text-gray-400 uppercase">{label}</h4>
    <p className={`text-3xl font-bold mt-2 ${valueColor}`}>{value}</p>
    {change && <p className="text-xs text-gray-500 mt-1">{change}</p>}
  </div>
);

const NavCard = ({ to, icon, title, subtitle, badge, children, accent }) => {
  const accentMap = {
    teal: 'border-teal-500/20 hover:border-teal-500/50 hover:bg-teal-900/10',
    rose: 'border-rose-500/20 hover:border-rose-500/50 hover:bg-rose-900/10',
    red: 'border-red-500/20 hover:border-red-500/50 hover:bg-red-900/10',
    violet: 'border-violet-500/20 hover:border-violet-500/50 hover:bg-violet-900/10',
  };
  const arrowMap = {
    teal: 'text-teal-400 group-hover:translate-x-1',
    rose: 'text-rose-400 group-hover:translate-x-1',
    red: 'text-red-400 group-hover:translate-x-1',
    violet: 'text-violet-400 group-hover:translate-x-1',
  };

  return (
    <Link
      to={to}
      className={`group flex flex-col bg-gray-800 border rounded-xl shadow-xl p-5 transition-all duration-200 ${accentMap[accent] || accentMap.teal}`}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <span className="text-xl">{icon}</span>
          <div>
            <h3 className="text-lg font-semibold text-gray-50">{title}</h3>
            <p className="text-gray-400 text-sm">{subtitle}</p>
          </div>
        </div>
        <svg className={`w-5 h-5 transition-transform ${arrowMap[accent] || arrowMap.teal}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </div>
      {badge && (
        <span className="mt-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-500/20 text-red-300 border border-red-500/30 w-fit">
          {badge}
        </span>
      )}
      {children && <div className="mt-3">{children}</div>}
    </Link>
  );
};

export const OwnerDashboard = () => {
  const { user } = useAuth();
  const [forecastBatch, setForecastBatch] = useState(null);
  const [liveKpis, setLiveKpis] = useState(null);
  const [kpiError, setKpiError] = useState('');
  const [inventoryRisk, setInventoryRisk] = useState([]);
  const [anomalyCount, setAnomalyCount] = useState(0);

  const fetchData = useCallback(async () => {
    const token = localStorage.getItem('token');
    const headers = { Authorization: `Bearer ${token}` };

    try {
      const [fcRes, kpiRes] = await Promise.all([
        axios.get(`${API_URL}/insights/owner/forecasts/latest`, { headers }),
        axios.get(`${API_URL}/insights/owner/kpis/live`, { headers }),
      ]);
      setForecastBatch(fcRes.data);
      setLiveKpis(kpiRes.data);
      setKpiError('');
    } catch (e) {
      console.error('Owner dashboard KPI/forecast load failed', e);
      setKpiError('Could not load live data');
    }

    try {
      const riskRes = await axios.get(`${API_URL}/insights/staff/inventory/risk`, { headers });
      setInventoryRisk(riskRes.data?.risks || []);
    } catch {
      setInventoryRisk([]);
    }

    try {
      const anomalyRes = await axios.get(`${API_URL}/insights/alerts/notifications/abnormal-drops`, {
        headers,
        params: { notify_owner: true },
      });
      setAnomalyCount(Number(anomalyRes.data?.count || 0));
    } catch {
      setAnomalyCount(0);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const id = setInterval(fetchData, KPI_REFRESH_MS);
    return () => clearInterval(id);
  }, [fetchData]);

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
      label: 'Total Profit',
      value: liveKpis ? `$${Number(liveKpis.kpis?.total_profit || 0).toLocaleString()}` : '—',
      change: liveKpis?.kpis?.profit_margin_pct != null
        ? `${liveKpis.kpis.profit_margin_pct}% margin`
        : 'Set cost prices to calculate',
      valueColor: liveKpis?.kpis?.total_profit >= 0 ? 'text-emerald-400' : 'text-red-400',
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
      label: 'Month Revenue',
      value: liveKpis ? `$${Number(liveKpis.kpis?.current_month_revenue || 0).toLocaleString()}` : '—',
      change: liveKpis?.kpis?.revenue_change_pct != null
        ? `${liveKpis.kpis.revenue_change_pct >= 0 ? '+' : ''}${liveKpis.kpis.revenue_change_pct}% vs last month`
        : 'No previous month baseline',
      valueColor: 'text-teal-500',
    },
    {
      label: 'Month Profit',
      value: liveKpis ? `$${Number(liveKpis.kpis?.current_month_profit || 0).toLocaleString()}` : '—',
      change: liveKpis?.kpis?.profit_change_pct != null
        ? `${liveKpis.kpis.profit_change_pct >= 0 ? '+' : ''}${liveKpis.kpis.profit_change_pct}% vs last month`
        : 'No previous month baseline',
      valueColor: liveKpis?.kpis?.current_month_profit >= 0 ? 'text-emerald-400' : 'text-red-400',
    },
  ];

  const highRiskItems = inventoryRisk.filter((r) => r.risk_level === 'high');
  const topForecasts = (forecastBatch?.products || [])
    .sort((a, b) => (b.ensemble_total_5d || 0) - (a.ensemble_total_5d || 0))
    .slice(0, 3);

  return (
    <div className="min-h-screen flex flex-col bg-gray-900">
      <Navbar />

      <div ref={exportRef} className="p-8">

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

        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {kpiRows.map((stat) => (
            <StatCard key={stat.label} {...stat} />
          ))}
        </div>
        {kpiError && <p className="text-red-400 text-sm mt-3">{kpiError}</p>}

        <div className="mt-8">
          <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wide mb-4">Navigate</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">

            <NavCard
              to="/owner/sales-summary"
              icon="📊"
              title="Sales Summary"
              subtitle="Filter sales by category and date range"
              accent="teal"
            />

            <NavCard
              to="/owner/forecasts"
              icon="📈"
              title="5-Day Sales Forecast"
              subtitle="AI-powered predictions and trends"
              accent="teal"
            >
              {topForecasts.length > 0 ? (
                <div className="space-y-1.5">
                  {topForecasts.map((p) => (
                    <div key={p.product_name} className="flex justify-between text-sm">
                      <span className="text-gray-300">{p.product_name}</span>
                      <span className="text-teal-400 font-semibold">{p.ensemble_total_5d ?? '—'}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-xs">Forecast data not yet available</p>
              )}
            </NavCard>

            <NavCard
              to="/owner/inventory"
              icon="📦"
              title="Inventory"
              subtitle="Stock levels and warnings"
              accent="rose"
              badge={highRiskItems.length > 0 ? `${highRiskItems.length} high-risk item${highRiskItems.length > 1 ? 's' : ''}` : null}
            >
              {highRiskItems.length > 0 ? (
                <div className="space-y-1.5">
                  {highRiskItems.slice(0, 3).map((item) => (
                    <div key={item.product} className="flex justify-between text-sm">
                      <span className="text-gray-300">{item.product}</span>
                      <span className="text-rose-400 font-semibold">{item.ensemble_total_5d ?? '—'} est.</span>
                    </div>
                  ))}
                </div>
              ) : inventoryRisk.length > 0 ? (
                <p className="text-green-400 text-xs">No high-risk items — all clear</p>
              ) : (
                <p className="text-gray-500 text-xs">Inventory risk data not yet available</p>
              )}
            </NavCard>

            <NavCard
              to="/owner/alerts"
              icon="🚨"
              title="Abnormal Drop Alerts"
              subtitle="Monitor sales anomalies and set thresholds"
              accent="red"
              badge={anomalyCount > 0 ? `${anomalyCount} active alert${anomalyCount > 1 ? 's' : ''}` : null}
            >
              {anomalyCount > 0 ? (
                <p className="text-red-400 text-xs">Anomalies detected — review needed</p>
              ) : (
                <p className="text-green-400 text-xs">No current anomalies</p>
              )}
            </NavCard>

            <NavCard
              to="/owner/customer-segments"
              icon="👥"
              title="Customer Segments"
              subtitle="RFM-based customer grouping and insights"
              accent="violet"
            />

          </div>
        </div>

      </div>
    </div>
  );
};
