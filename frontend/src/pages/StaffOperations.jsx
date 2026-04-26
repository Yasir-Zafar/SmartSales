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

  const today = summary?.today;
  const week = summary?.week;

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <Navbar />
      <div className="max-w-6xl mx-auto p-6">
        <h2 className="text-3xl font-bold">Staff Operations</h2>
        <p className="text-gray-400 mt-1">Live sales and restock guidance in one focused page.</p>

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
            <h4 className="text-sm text-gray-400">Today's Sales (Live)</h4>
            {sumLoading ? (
              <p className="text-gray-400 mt-2">Loading summary...</p>
            ) : sumError ? (
              <p className="text-red-400 mt-2">{sumError}</p>
            ) : (
              <>
                <p className="text-2xl text-teal-400 mt-2">${today?.revenue}</p>
                <p className="text-gray-500 text-sm">{today?.transactions} transactions</p>
              </>
            )}
          </div>
          <div className="bg-gray-800 p-6 rounded-xl shadow-xl">
            <h4 className="text-sm text-gray-400">This Week (Live)</h4>
            {sumLoading ? (
              <p className="text-gray-400 mt-2">Loading summary...</p>
            ) : sumError ? (
              <p className="text-red-400 mt-2">{sumError}</p>
            ) : (
              <>
                <p className="text-2xl text-purple-400 mt-2">${week?.revenue}</p>
                <p className="text-gray-500 text-sm">{week?.transactions} transactions</p>
                <WeekBarChart data={week?.dailyBreakdown || []} />
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
