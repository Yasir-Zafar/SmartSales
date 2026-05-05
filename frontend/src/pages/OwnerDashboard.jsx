import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { Navbar } from '../components/Navbar';
import {
  FileText,
  TrendingUp,
  Package,
  AlertTriangle,
  Users,
  ChevronRight,
  Download,
} from 'lucide-react';

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
    const canvas = await html2canvas(element, { scale: 2, useCORS: true, backgroundColor: '#12121a' });
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF({ orientation: 'landscape', unit: 'px', format: [canvas.width / 2, canvas.height / 2] });
    pdf.addImage(imgData, 'PNG', 0, 0, canvas.width / 2, canvas.height / 2);
    pdf.save(filename);
  }, [filename]);
  return { exportRef, exportToPdf };
};

const StatCard = ({ icon: Icon, label, value, change, valueColor }) => (
  <div className="bg-surface-800 p-5 rounded-xl border border-surface-700">
    <div className="flex items-center gap-2 mb-2">
      <Icon className="w-4 h-4 text-text-muted" />
      <h4 className="text-xs font-medium text-text-muted uppercase tracking-wide">{label}</h4>
    </div>
    <p className={`text-2xl font-bold ${valueColor}`}>{value}</p>
    {change && <p className="text-xs text-text-faint mt-1">{change}</p>}
  </div>
);

const NavCard = ({ to, icon: Icon, title, subtitle, badge, children, accent }) => {
  const accentMap = {
    teal: 'border-success-border hover:border-success/50 hover:bg-success-glow',
    rose: 'border-danger-border hover:border-danger/50 hover:bg-danger-glow',
    violet: 'border-accent-border hover:border-accent/50 hover:bg-accent-glow',
    amber: 'border-warning-border hover:border-warning/50 hover:bg-warning-glow',
  };
  const iconMap = {
    teal: 'text-success',
    rose: 'text-danger',
    violet: 'text-accent',
    amber: 'text-warning',
  };

  return (
    <Link
      to={to}
      className={`group flex flex-col bg-surface-800 border rounded-xl p-5 transition-all duration-200 ${accentMap[accent] || accentMap.teal}`}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-9 h-9 rounded-lg bg-surface-700 flex items-center justify-center ${iconMap[accent] || iconMap.teal}`}>
            <Icon className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-text-primary">{title}</h3>
            <p className="text-text-secondary text-sm">{subtitle}</p>
          </div>
        </div>
        <ChevronRight className={`w-4 h-4 transition-transform group-hover:translate-x-0.5 ${iconMap[accent] || iconMap.teal}`} />
      </div>
      {badge && (
        <span className="mt-3 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-danger-glow text-danger border border-danger-border w-fit">
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
      const anomalyRes = await axios.get(`${API_URL}/insights/alerts/notifications/abnormal-drops`, { headers, params: { notify_owner: true } });
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
    { icon: TrendingUp, label: 'Total Revenue', value: liveKpis ? `$${Number(liveKpis.kpis?.total_revenue || 0).toLocaleString()}` : '—', change: liveKpis?.kpis?.revenue_change_pct != null ? `${liveKpis.kpis.revenue_change_pct >= 0 ? '+' : ''}${liveKpis.kpis.revenue_change_pct}% vs previous month` : 'No previous month baseline', valueColor: 'text-success' },
    { icon: Package, label: 'Total Sales (Units)', value: liveKpis ? Number(liveKpis.kpis?.total_units_sold || 0).toLocaleString() : '—', change: 'Updated from uploaded sales data', valueColor: 'text-accent' },
    { icon: Users, label: 'Active Customers', value: liveKpis ? Number(liveKpis.kpis?.active_customers || 0).toLocaleString() : '—', change: 'Distinct customers in all sales records', valueColor: 'text-warning' },
    { icon: TrendingUp, label: 'Month Revenue', value: liveKpis ? `$${Number(liveKpis.kpis?.current_month_revenue || 0).toLocaleString()}` : '—', change: liveKpis?.kpis?.revenue_change_pct != null ? `${liveKpis.kpis.revenue_change_pct >= 0 ? '+' : ''}${liveKpis.kpis.revenue_change_pct}% vs last month` : 'No previous month baseline', valueColor: 'text-success' },
  ];

  const highRiskItems = inventoryRisk.filter((r) => r.risk_level === 'high');
  const topForecasts = (forecastBatch?.products || []).sort((a, b) => (b.ensemble_total_5d || 0) - (a.ensemble_total_5d || 0)).slice(0, 3);

  return (
    <div className="min-h-screen flex flex-col bg-surface-900">
      <Navbar />
      <div ref={exportRef} className="p-8">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-text-primary">Owner Dashboard</h2>
            <p className="text-text-secondary mt-1">Welcome, <span className="text-accent">{user?.email}</span></p>
          </div>
          <button onClick={exportToPdf} className="flex items-center gap-2 px-4 py-2 bg-surface-700 hover:bg-surface-600 text-text-secondary text-sm font-medium rounded-lg transition-all">
            <Download className="w-4 h-4" />
            Export PDF
          </button>
        </div>

        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {kpiRows.map((stat) => <StatCard key={stat.label} {...stat} />)}
        </div>
        {kpiError && <p className="text-danger text-sm mt-3">{kpiError}</p>}

        <div className="mt-8">
          <h3 className="text-xs font-medium text-text-muted uppercase tracking-wide mb-4">Navigation</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            <NavCard to="/owner/sales-summary" icon={FileText} title="Sales Summary" subtitle="Filter sales by category and date range" accent="teal" />

            <NavCard to="/owner/forecasts" icon={TrendingUp} title="5-Day Sales Forecast" subtitle="AI-powered predictions and trends" accent="teal">
              {topForecasts.length > 0 ? (
                <div className="space-y-1.5">
                  {topForecasts.map((p) => (
                    <div key={p.product_name} className="flex justify-between text-sm">
                      <span className="text-text-secondary">{p.product_name}</span>
                      <span className="text-accent font-semibold">{p.ensemble_total_5d ?? '—'}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-text-faint text-xs">Forecast data not yet available</p>
              )}
            </NavCard>

            <NavCard to="/owner/inventory" icon={Package} title="Inventory" subtitle="Stock levels and warnings" accent="rose"
              badge={highRiskItems.length > 0 ? `${highRiskItems.length} high-risk item${highRiskItems.length > 1 ? 's' : ''}` : null}>
              {highRiskItems.length > 0 ? (
                <div className="space-y-1.5">
                  {highRiskItems.slice(0, 3).map((item) => (
                    <div key={item.product} className="flex justify-between text-sm">
                      <span className="text-text-secondary">{item.product}</span>
                      <span className="text-danger font-semibold">{item.ensemble_total_5d ?? '—'} est.</span>
                    </div>
                  ))}
                </div>
              ) : inventoryRisk.length > 0 ? (
                <p className="text-text-faint text-xs">No high-risk items — all clear</p>
              ) : (
                <p className="text-text-faint text-xs">Inventory risk data not yet available</p>
              )}
            </NavCard>

            <NavCard to="/owner/alerts" icon={AlertTriangle} title="Abnormal Drop Alerts" subtitle="Monitor sales anomalies and set thresholds" accent="rose"
              badge={anomalyCount > 0 ? `${anomalyCount} active alert${anomalyCount > 1 ? 's' : ''}` : null}>
              {anomalyCount > 0 ? (
                <p className="text-danger text-xs">Anomalies detected — review needed</p>
              ) : (
                <p className="text-text-faint text-xs">No current anomalies</p>
              )}
            </NavCard>

            <NavCard to="/owner/customer-segments" icon={Users} title="Customer Segments" subtitle="RFM-based customer grouping and insights" accent="violet" />
          </div>
        </div>
      </div>
    </div>
  );
};
