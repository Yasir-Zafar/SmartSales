import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Navbar } from '../components/Navbar';

const API_URL = 'http://localhost:5000/api';

export const OwnerFiveDayForecast = () => {
  const [forecasts, setForecasts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError('');
      const token = localStorage.getItem('token');
      try {
        const res = await axios.get(`${API_URL}/insights/owner/forecasts`, {
          headers: { Authorization: `Bearer ${token}` },
          params: { limit: 20, sort_by: 'ensemble_total' },
        });
        setForecasts(res.data?.forecasts || []);
      } catch (primaryErr) {
        try {
          // Fallback for older backend processes that don't have /owner/forecasts yet.
          const snapshotRes = await axios.get(`${API_URL}/insights/owner/forecasts/latest`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          const mapped = (snapshotRes.data?.products || []).map((row) => ({
            product: row.product_name,
            category: row.category,
            ensemble_total_5d: row.ensemble_total_5d,
          }));
          mapped.sort((a, b) => Number(b.ensemble_total_5d || 0) - Number(a.ensemble_total_5d || 0));
          if (mapped.length > 0) {
            setForecasts(mapped.slice(0, 20));
            return;
          }
        } catch {}

        try {
          // Last fallback: call ML service directly (same source analyst used).
          const mlRes = await axios.get('http://localhost:8000/forecasts', {
            params: { limit: 20, sort_by: 'ensemble_total' },
          });
          setForecasts(mlRes.data?.forecasts || []);
          return;
        } catch {}

        setError(primaryErr.response?.data?.message || 'Could not load 5-day forecast');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  return (
    <div className="min-h-screen bg-surface-900 text-white">
      <Navbar />
      <div className="max-w-6xl mx-auto p-6">
        <h2 className="text-3xl font-bold">Owner 5-Day Sales Forecast</h2>
        <p className="text-text-muted mt-1">Top forecasted products for the next 5 days.</p>

        <div className="mt-6 bg-surface-800 p-6 rounded-xl shadow-xl">
          {loading ? (
            <p className="text-text-muted text-sm">Loading forecasts...</p>
          ) : error ? (
            <p className="text-danger text-sm">{error}</p>
          ) : forecasts.length === 0 ? (
            <p className="text-text-muted text-sm">No forecast data available. Reload ML first.</p>
          ) : (
            <div className="max-h-[32rem] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-surface-800 border-b border-surface-700">
                  <tr className="text-left text-text-muted text-xs">
                    <th className="pb-2 pr-2">Product</th>
                    <th className="pb-2 px-2">Category</th>
                    <th className="pb-2 pl-2 text-right">5d Total</th>
                  </tr>
                </thead>
                <tbody className="text-text-secondary">
                  {forecasts.map((row, idx) => (
                    <tr key={`${row.product}-${idx}`} className="border-b border-surface-700/50 hover:bg-surface-700/30">
                      <td className="py-2 pr-2">{row.product}</td>
                      <td className="py-2 px-2 text-xs text-text-muted">{row.category || 'N/A'}</td>
                      <td className="py-2 pl-2 text-right">
                        <span className="text-success font-semibold">{row.ensemble_total_5d ?? 'N/A'}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
