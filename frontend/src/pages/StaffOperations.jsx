import React, { useEffect, useState } from 'react';
import { Navbar } from '../components/Navbar';

const API_URL = 'http://localhost:5000/api';

function WeekBarChart({ data }) {
  if (!data?.length) return null;
  const max = Math.max(...data.map((d) => d.revenue), 1);
  const width = 340;
  const height = 72;
  const barW = Math.floor(width / data.length) - 4;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto mt-3">
      {data.map((d, i) => {
        const barH = Math.max(4, (d.revenue / max) * (height - 20));
        const x = i * (width / data.length) + 2;
        const y = height - 14 - barH;
        return <rect key={d.date + i} x={x} y={y} width={barW} height={barH} rx="3" fill="#2dd4bf" opacity="0.85" />;
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
    <div className="min-h-screen bg-gray-900 text-white">
      <Navbar />
      <div className="max-w-6xl mx-auto p-6">
        <h2 className="text-3xl font-bold">Staff Operations</h2>
        <p className="text-gray-400 mt-1">Live sales, restock guidance, and customer upsell recommendations.</p>

        <div className="mt-6 bg-gray-800 p-6 rounded-xl shadow-xl border border-violet-500/20">
          <h3 className="text-lg font-semibold text-gray-50 mb-2">Customer Upsell Recommendations</h3>
          <p className="text-xs text-gray-400 mb-4">Enter a customer ID to see their segment and recommended products to upsell.</p>

          <div className="flex gap-2 max-w-sm">
            <input
              type="number"
              min="1"
              value={custId}
              onChange={(e) => setCustId(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') loadUpsell(); }}
              placeholder="Customer ID"
              className="flex-1 bg-gray-900 border border-gray-600 rounded-lg px-3 py-2 text-sm text-gray-200"
            />
            <button
              onClick={loadUpsell}
              disabled={upsellLoading || !custId}
              className="bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white text-sm px-4 py-2 rounded-lg"
            >
              {upsellLoading ? 'Loading…' : 'Look Up'}
            </button>
          </div>

          {upsellError && <p className="text-red-400 text-sm mt-3">{upsellError}</p>}

          {upsell && (
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-gray-900 rounded-lg p-4">
                <p className="text-xs text-gray-500 mb-1">Customer #{upsell.customer_id}</p>
                <p className="text-sm font-medium text-violet-400 mb-3">Segment: {upsell.segment_label}</p>
                <p className="text-sm text-gray-300">{upsell.upsell_message}</p>
              </div>
              {upsell.top_products_for_segment?.length > 0 && (
                <div className="bg-gray-900 rounded-lg p-4">
                  <p className="text-xs text-gray-500 mb-2">Recommended products for this segment</p>
                  <ul className="space-y-1">
                    {upsell.top_products_for_segment.slice(0, 5).map((p, i) => (
                      <li key={i} className="text-sm text-teal-300">
                        {typeof p === 'string' ? p : p?.product || '—'}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="mt-6 bg-gray-800 p-6 rounded-xl shadow-xl">
          <h3 className="text-lg font-semibold text-gray-50 mb-2">Restock guidance</h3>
          {invLoading ? (
            <p className="text-gray-400 text-sm">Loading...</p>
          ) : invErr ? (
            <p className="text-amber-400 text-sm">{invErr}</p>
          ) : invRisks.length === 0 ? (
            <p className="text-gray-500 text-sm">No high-priority restock items right now.</p>
          ) : (
            <ul className="space-y-3">
              {invRisks.slice(0, 8).map((r) => (
                <li key={r.product} className="border border-gray-700 rounded-lg p-3">
                  <p className="text-teal-400 font-medium text-sm capitalize">{r.product}</p>
                  <p className="text-gray-300 text-sm mt-1">{r.staff_action?.message}</p>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-gray-800 p-6 rounded-xl shadow-xl">
            <h4 className="text-sm text-gray-400">Latest Day Sales</h4>
            {sumLoading ? (
              <p className="text-gray-400 mt-2">Loading summary...</p>
            ) : sumError ? (
              <p className="text-red-400 mt-2">{sumError}</p>
            ) : (
              <>
                <p className="text-2xl text-teal-400 mt-2">${today?.revenue}</p>
                <p className="text-gray-500 text-sm">{today?.transactions} transactions</p>
                {today?.date && <p className="text-gray-500 text-xs mt-1">Date: {today.date}</p>}
              </>
            )}
          </div>
          <div className="bg-gray-800 p-6 rounded-xl shadow-xl">
            <h4 className="text-sm text-gray-400">Latest 7-Day Window</h4>
            {sumLoading ? (
              <p className="text-gray-400 mt-2">Loading summary...</p>
            ) : sumError ? (
              <p className="text-red-400 mt-2">{sumError}</p>
            ) : (
              <>
                <p className="text-2xl text-purple-400 mt-2">${week?.revenue}</p>
                <p className="text-gray-500 text-sm">{week?.transactions} transactions</p>
                {week?.start_date && week?.end_date && (
                  <p className="text-gray-500 text-xs mt-1">
                    Window: {week.start_date} to {week.end_date}
                  </p>
                )}
                <WeekBarChart data={week?.dailyBreakdown || []} />
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
