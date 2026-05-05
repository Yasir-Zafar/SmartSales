import React, { useState, useEffect } from 'react';
import axios from 'axios';
import qs from 'qs';
import { useAuth } from '../context/AuthContext';
import { Navbar } from '../components/Navbar';

const API_URL = 'http://localhost:5000/api';

export const OwnerSalesSummary = () => {
  const { user } = useAuth();
  const [category, setCategory] = useState('');
  const [categories, setCategories] = useState([]);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [records, setRecords] = useState([]);
  const [estimate, setEstimate] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [estimateError, setEstimateError] = useState('');

  const buildParams = () => ({
    category: category ? [category] : [],
    startDate: startDate || undefined,
    endDate: endDate || undefined,
  });

  const fetchSales = async () => {
    setLoading(true);
    setError('');
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_URL}/csv/records`, {
        headers: { Authorization: `Bearer ${token}` },
        params: buildParams(),
        paramsSerializer: (params) => qs.stringify(params, { arrayFormat: 'repeat' }),
      });
      setRecords(response.data.records || []);
      return response.data.records || [];
    } catch (err) {
      setError(err.response?.data?.message || 'Could not load sales summary');
      return [];
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await axios.get(`${API_URL}/csv/categories`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setCategories(response.data.categories || []);
      } catch (err) {
        console.error('Could not load categories', err);
      }
    };
    fetchCategories();
  }, []);

  const handleApply = async (e) => {
    e.preventDefault();
    setEstimate(null);
    setEstimateError('');
    if (!category) {
      setError('Please select a category to view sales.');
      return;
    }
    await fetchSales();
  };

  const handleEstimate = async (e) => {
    e.preventDefault();
    setEstimateError('');
    setError('');
    if (!category) {
      setEstimateError('Please select a category for estimate.');
      return;
    }
    const filteredRecords = await fetchSales();
    if (!filteredRecords.length) {
      setEstimate({
        totalQuantity: 0,
        totalRevenue: 0,
        averagePrice: 0,
        recordCount: 0,
      });
      return;
    }
    const totalQuantity = filteredRecords.reduce((sum, row) => sum + (row.quantity || 0), 0);
    const totalRevenue = filteredRecords.reduce((sum, row) => sum + (parseFloat(row.total_price) || 0), 0);
    const averagePrice = totalQuantity > 0 ? totalRevenue / totalQuantity : 0;
    setEstimate({
      totalQuantity,
      totalRevenue,
      averagePrice,
      recordCount: filteredRecords.length,
    });
  };

  return (
    <div className="min-h-screen bg-surface-900 text-white">
      <Navbar />
      <div className="max-w-6xl mx-auto p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h2 className="text-3xl font-bold">Sales Summary</h2>
            <p className="text-text-secondary mt-1">Owner-only sales summary. Select a category and optionally restrict by date range.</p>
            <p className="text-text-muted text-sm mt-1">Logged in as: <span className="font-semibold text-accent">{user?.email}</span></p>
          </div>
        </div>

        <form className="mt-6 space-y-4" onSubmit={handleApply}>
          <div className="bg-surface-800 border border-surface-700 rounded-xl p-5 space-y-4">
            <div>
              <label className="block text-sm text-text-secondary mb-1">Category <span className="text-danger">*</span></label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full border border-surface-700 rounded-md px-3 py-2 bg-surface-900 text-white"
                required
              >
                <option value="">Select a category</option>
                {categories.map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </select>
              <p className="text-xs text-text-faint mt-1">Category is required for all Sales Summary queries.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-text-secondary mb-1">Start date</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full border border-surface-700 rounded-md px-3 py-2 bg-surface-900 text-white"
                />
              </div>
              <div>
                <label className="block text-sm text-text-secondary mb-1">End date</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full border border-surface-700 rounded-md px-3 py-2 bg-surface-900 text-white"
                />
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center sm:gap-3">
              <button
                type="submit"
                className="inline-flex items-center justify-center bg-accent hover:bg-accent-hover text-white font-semibold rounded-md px-5 py-2 transition"
              >
                View Sales
              </button>
              <button
                type="button"
                onClick={handleEstimate}
                className="inline-flex items-center justify-center bg-accent hover:bg-accent-hover text-white font-semibold rounded-md px-5 py-2 transition"
              >
                Estimate
              </button>
              <button
                type="button"
                onClick={() => {
                  setCategory('');
                  setStartDate('');
                  setEndDate('');
                  setRecords([]);
                  setEstimate(null);
                  setError('');
                  setEstimateError('');
                }}
                className="inline-flex items-center justify-center bg-surface-700 hover:bg-surface-600 text-white font-semibold rounded-md px-5 py-2 transition"
              >
                Reset
              </button>
            </div>
            {error && <p className="text-danger text-sm">{error}</p>}
            {estimateError && <p className="text-warning text-sm">{estimateError}</p>}
          </div>
        </form>

        <div className="mt-6 grid gap-6 lg:grid-cols-2">
          <div className="bg-surface-800 border border-surface-700 rounded-xl p-5">
            <h3 className="text-lg font-semibold text-text-primary mb-3">Sales Summary Results</h3>
            {loading ? (
              <p className="text-text-muted">Loading sales...</p>
            ) : !records.length ? (
              <p className="text-text-muted">No sales records to display. Apply a category filter to view results.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-surface-700 text-sm">
                  <thead className="text-left text-xs uppercase tracking-wide text-text-muted">
                    <tr>
                      <th className="px-3 py-2">Date</th>
                      <th className="px-3 py-2">Product</th>
                      <th className="px-3 py-2">Category</th>
                      <th className="px-3 py-2">Qty</th>
                      <th className="px-3 py-2">Unit Price</th>
                      <th className="px-3 py-2">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-700">
                    {records.map((row) => (
                      <tr key={`${row.transaction_id}-${row.sale_date}-${row.product_id}`} className="hover:bg-surface-700/30">
                        <td className="px-3 py-2 text-text-primary">{row.sale_date || 'N/A'}</td>
                        <td className="px-3 py-2 text-text-primary">{row.product_name || 'N/A'}</td>
                        <td className="px-3 py-2 text-text-primary">{row.category || 'N/A'}</td>
                        <td className="px-3 py-2 text-text-primary">{row.quantity ?? '-'}</td>
                        <td className="px-3 py-2 text-text-primary">${parseFloat(row.unit_price || 0).toFixed(2)}</td>
                        <td className="px-3 py-2 text-text-primary">${parseFloat(row.total_price || 0).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="bg-surface-800 border border-surface-700 rounded-xl p-5">
            <h3 className="text-lg font-semibold text-text-primary mb-3">Estimate Stats</h3>
            {estimate ? (
              <div className="space-y-3 text-text-primary">
                <p><span className="font-semibold text-text-primary">Category:</span> {category || 'N/A'}</p>
                <p><span className="font-semibold text-text-primary">Records matched:</span> {estimate.recordCount}</p>
                <p><span className="font-semibold text-text-primary">Total quantity:</span> {estimate.totalQuantity}</p>
                <p><span className="font-semibold text-text-primary">Total revenue:</span> ${estimate.totalRevenue.toFixed(2)}</p>
                <p><span className="font-semibold text-text-primary">Avg revenue per unit:</span> ${estimate.averagePrice.toFixed(2)}</p>
              </div>
            ) : (
              <p className="text-text-muted">Choose a category and click Estimate to view total stats in the selected date range.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
