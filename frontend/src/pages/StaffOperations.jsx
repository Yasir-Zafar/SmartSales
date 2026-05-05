import React, { useEffect, useState } from 'react';
import { Navbar } from '../components/Navbar';
import { TrendingUp } from 'lucide-react';

const API_URL = 'http://localhost:5000/api';

const StatCard = ({ icon: Icon, label, value, valueColor }) => (
  <div className="bg-surface-800 p-5 rounded-xl border border-surface-700">
    <div className="flex items-center gap-2 mb-2">
      <Icon className="w-4 h-4 text-text-muted" />
      <h4 className="text-xs font-medium text-text-muted uppercase tracking-wide">{label}</h4>
    </div>
    <p className={`text-2xl font-bold ${valueColor}`}>{value}</p>
  </div>
);

function WeekBarChart({ data }) {
  if (!data?.length) return <p className="text-text-faint text-xs mt-3">No daily data for chart.</p>;
  const valid = data.filter((d) => d.revenue != null);
  if (!valid.length) return <p className="text-text-faint text-xs mt-3">No valid revenue data.</p>;
  const max = Math.max(...valid.map((d) => d.revenue), 1);
  const width = 340;
  const height = 72;
  const barW = Math.max(4, Math.floor(width / valid.length) - 4);

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto mt-3" style={{ color: 'var(--accent)' }} aria-label="7-day revenue bar chart">
      {valid.map((d, i) => {
        const barH = Math.max(4, (d.revenue / max) * (height - 20));
        const x = i * (width / valid.length) + 2;
        const y = height - 14 - barH;
        return <rect key={d.date + i} x={x} y={y} width={barW} height={barH} rx="3" fill="currentColor" opacity="0.85" />;
      })}
    </svg>
  );
}

export const StaffOperations = () => {
  const [summary, setSummary] = useState(null);
  const [sumLoading, setSumLoading] = useState(true);
  const [sumError, setSumError] = useState('');
  const [invRisks, setInvRisks] = useState([]);
  const [invLoading, setInvLoading] = useState(true);
  const [invErr, setInvErr] = useState('');

  const [custId, setCustId] = useState('');
  const [upsell, setUpsell] = useState(null);
  const [upsellLoading, setUpsellLoading] = useState(false);
  const [upsellError, setUpsellError] = useState('');

  useEffect(() => {
    const loadSummary = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${API_URL}/insights/staff/sales-summary`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Could not load sales summary');
        setSummary(data);
      } catch (e) {
        setSumError(e.message || 'Could not load sales summary');
      } finally {
        setSumLoading(false);
      }
    };

    const loadInv = async () => {
      setInvLoading(true);
      setInvErr('');
      try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${API_URL}/insights/staff/inventory/risk`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.message || 'Failed to load recommendations');
        setInvRisks(data.risks || []);
      } catch (e) {
        setInvErr(e.message || 'Could not load inventory guidance');
      } finally {
        setInvLoading(false);
      }
    };

    loadSummary();
    loadInv();
  }, []);

  const loadUpsell = async () => {
    const id = Number(custId);
    if (!id) return;
    setUpsellLoading(true);
    setUpsellError('');
    setUpsell(null);
    try {
      const token = localStorage.getItem('token');
      const res = await fetch(`${API_URL}/insights/staff/customers/${id}/upsell`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Could not load recommendation');
      setUpsell(data);
    } catch (e) {
      setUpsellError(e.message || 'No recommendation available');
    } finally {
      setUpsellLoading(false);
    }
  };

  const today = summary?.today;
  const week = summary?.week;

  return (
    <div className="min-h-screen flex flex-col bg-surface-900">
      <Navbar />
      <div className="p-8">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-text-primary">Staff Operations</h2>
            <p className="text-text-secondary mt-1">Live sales, restock guidance, and customer upsell recommendations.</p>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <StatCard icon={TrendingUp} label="Today Revenue" value={sumLoading ? '—' : `$${Number(today?.revenue || 0).toLocaleString()}`} valueColor="text-success" />
          <StatCard icon={TrendingUp} label="7-Day Revenue" value={sumLoading ? '—' : `$${Number(week?.revenue || 0).toLocaleString()}`} valueColor="text-accent" />
          <StatCard icon={TrendingUp} label="Today Transactions" value={sumLoading ? '—' : Number(today?.transactions || 0).toLocaleString()} valueColor="text-warning" />
        </div>
        {sumError && <p className="text-danger text-sm mt-3">{sumError}</p>}

        {!sumLoading && !sumError && (
          <div className="mt-6 bg-surface-800 border border-surface-700 p-5 rounded-xl">
            <p className="text-xs text-text-muted uppercase tracking-wide mb-3">7-Day Revenue Chart</p>
            <WeekBarChart data={week?.dailyBreakdown || []} />
            {week?.start_date && week?.end_date && (
              <p className="text-text-faint text-xs mt-2">Window: {week.start_date} to {week.end_date}</p>
            )}
          </div>
        )}

        <div className="mt-8">
          <h3 className="text-xs font-medium text-text-muted uppercase tracking-wide mb-4">Tools</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-surface-800 border border-accent-border p-6 rounded-xl">
              <h3 className="text-lg font-semibold text-text-primary mb-2">Customer Upsell Recommendations</h3>
              <p className="text-xs text-text-muted mb-4">Enter a customer ID to see their segment and recommended products to upsell.</p>

              <div className="flex gap-2 max-w-sm">
                <input
                  type="number"
                  min="1"
                  value={custId}
                  onChange={(e) => setCustId(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') loadUpsell(); }}
                  placeholder="Customer ID"
                  className="flex-1 bg-surface-900 border border-surface-600 rounded-lg px-3 py-2 text-sm text-text-primary"
                />
                <button
                  onClick={loadUpsell}
                  disabled={upsellLoading || !custId}
                  className="bg-accent hover:bg-accent-hover disabled:opacity-50 text-white text-sm px-4 py-2 rounded-lg"
                >
                  {upsellLoading ? 'Loading…' : 'Look Up'}
                </button>
              </div>

              {upsellError && <p className="text-danger text-sm mt-3">{upsellError}</p>}

              {upsell && (
                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="bg-surface-900 rounded-lg p-4">
                    <p className="text-xs text-text-faint mb-1">Customer #{upsell.customer_id}</p>
                    <p className="text-sm font-medium text-accent mb-3">Segment: {upsell.segment_label}</p>
                    <p className="text-sm text-text-secondary">{upsell.upsell_message}</p>
                  </div>
                  {upsell.top_products_for_segment?.length > 0 && (
                    <div className="bg-surface-900 rounded-lg p-4">
                      <p className="text-xs text-text-faint mb-2">Recommended products for this segment</p>
                      <ul className="space-y-1">
                        {upsell.top_products_for_segment.slice(0, 5).map((p, i) => (
                          <li key={i} className="text-sm text-success">
                            {typeof p === 'string' ? p : p?.product || '—'}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="bg-surface-800 border border-surface-700 p-6 rounded-xl">
              <h3 className="text-lg font-semibold text-text-primary mb-2">Restock Guidance</h3>
              {invLoading ? (
                <p className="text-text-secondary text-sm">Loading...</p>
              ) : invErr ? (
                <p className="text-warning text-sm">{invErr}</p>
              ) : invRisks.length === 0 ? (
                <p className="text-text-faint text-sm">No high-priority restock items right now.</p>
              ) : (
                <ul className="space-y-3">
                  {invRisks.slice(0, 8).map((r) => (
                    <li key={r.product} className="border border-surface-700 rounded-lg p-3">
                      <p className="text-success font-medium text-sm capitalize">{r.product}</p>
                      <p className="text-text-secondary text-sm mt-1">{r.staff_action?.message}</p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
