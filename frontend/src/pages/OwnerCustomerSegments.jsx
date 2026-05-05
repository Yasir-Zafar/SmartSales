import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { Navbar } from '../components/Navbar';

const API_URL = 'http://localhost:5000/api';

export const OwnerCustomerSegments = () => {
  const [customerId, setCustomerId] = useState('');
  const [allSegments, setAllSegments] = useState([]);
  const [segments, setSegments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const customerOptions = useMemo(
    () => allSegments.map((row) => String(row.customer_id)),
    [allSegments]
  );

  const loadAllSegments = async () => {
    setLoading(true);
    setError('');
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`${API_URL}/insights/owner/customer-segments`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const rows = res.data?.segments || [];
      setAllSegments(rows);
      setSegments(rows);
      if (!customerId && rows.length) {
        setCustomerId(String(rows[0].customer_id));
      }
    } catch (e) {
      setError(e.response?.data?.message || 'Could not load customer segments');
      setAllSegments([]);
      setSegments([]);
    } finally {
      setLoading(false);
    }
  };

  const loadSingleFromDropdown = () => {
    if (!customerId) {
      setError('Select a customer from the dropdown.');
      return;
    }
    const row = allSegments.find((seg) => String(seg.customer_id) === String(customerId));
    if (!row) {
      setError('Selected customer was not found.');
      return;
    }
    setError('');
    setSegments([row]);
  };

  useEffect(() => {
    loadAllSegments();
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-surface-900">
      <Navbar />
      <div className="p-8">
        <div className="bg-surface-800 rounded-xl shadow-xl p-6 border border-accent/20">
          <h2 className="text-2xl font-semibold text-text-primary">Customer Segment Membership</h2>
          <p className="text-sm text-text-muted mt-2">
            View which segment each customer belongs to, either for one customer or your full customer base.
          </p>

          <div className="mt-5 flex flex-wrap gap-3 items-center">
            <select
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              className="bg-surface-900 border border-surface-600 rounded-lg px-3 py-2 text-sm text-text-primary min-w-[180px]"
            >
              {!customerOptions.length ? (
                <option value="">No customers available</option>
              ) : (
                customerOptions.map((id) => (
                  <option key={id} value={id}>
                    Customer {id}
                  </option>
                ))
              )}
            </select>
            <button
              type="button"
              onClick={loadSingleFromDropdown}
              disabled={loading || !customerOptions.length}
              className="bg-accent hover:bg-accent-hover disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg"
            >
              Show Selected Customer
            </button>
            <button
              type="button"
              onClick={() => {
                setError('');
                setSegments(allSegments);
              }}
              disabled={loading}
              className="bg-accent hover:bg-accent-hover disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg"
            >
              Show All Customers
            </button>
            <button
              type="button"
              onClick={loadAllSegments}
              disabled={loading}
              className="bg-surface-700 hover:bg-surface-600 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg"
            >
              {loading ? 'Loading…' : 'Refresh List'}
            </button>
          </div>

          {error && <p className="text-danger text-sm mt-4">{error}</p>}
        </div>

        <div className="mt-6 bg-surface-800 rounded-xl shadow-xl p-6">
          <h3 className="text-lg font-semibold text-text-primary">Results</h3>
          <p className="text-xs text-text-faint mt-1">Customers found: {segments.length}</p>

          {!segments.length ? (
            <p className="text-sm text-text-muted mt-4">No segment data loaded yet.</p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead>
                  <tr className="text-text-muted border-b border-surface-700">
                    <th className="py-2 pr-4">Customer ID</th>
                    <th className="py-2 pr-4">Segment</th>
                    <th className="py-2 pr-4">Purchases</th>
                    <th className="py-2 pr-4">Total Spend</th>
                    <th className="py-2 pr-4">Recommendation</th>
                  </tr>
                </thead>
                <tbody>
                  {segments.map((row) => (
                    <tr key={row.customer_id} className="border-b border-surface-700">
                      <td className="py-2 pr-4 text-text-primary">{row.customer_id}</td>
                      <td className="py-2 pr-4 text-success">{row.segment_label}</td>
                      <td className="py-2 pr-4 text-text-secondary">{row.total_purchases ?? '—'}</td>
                      <td className="py-2 pr-4 text-text-secondary">
                        {row.total_spend != null ? Number(row.total_spend).toFixed(2) : '—'}
                      </td>
                      <td className="py-2 pr-4 text-text-muted">{row.recommendation || '—'}</td>
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
