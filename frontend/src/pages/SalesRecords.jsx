import React, { useState, useEffect } from 'react';
import axios from 'axios';
import qs from 'qs';
import { useAuth } from '../context/AuthContext';
import { Navbar } from '../components/Navbar';

const API_URL = 'http://localhost:5000/api';

export const SalesRecords = () => {
  const { user } = useAuth();
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sortBy, setSortBy] = useState('time');
  const [order, setOrder] = useState('desc');
  const [productFilters, setProductFilters] = useState(['']);
  const [categoryFilters, setCategoryFilters] = useState(['']);
  const [transactionFilters, setTransactionFilters] = useState(['']);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const fetchSales = async () => {
    setLoading(true);
    setError('');
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_URL}/csv/records`, {
        headers: { Authorization: `Bearer ${token}` },
        params: {
          sortBy,
          order,
          product: productFilters.filter(Boolean),
          category: categoryFilters.filter(Boolean),
          transaction: transactionFilters.filter(Boolean),
          startDate,
          endDate,
        },
        paramsSerializer: (params) => qs.stringify(params, { arrayFormat: 'repeat' }),
      });
      setRecords(response.data.records || []);
    } catch (err) {
      console.error('Sales fetch error', err);
      setError(err.response?.data?.message || 'Could not load records');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSales();
  }, [sortBy, order]);

  const handleApply = async (e) => {
    e.preventDefault();
    await fetchSales();
  };

  const updateFilterValue = (setFilter, index, value) => {
    setFilter((prev) => prev.map((v, i) => i === index ? value : v));
  };

  const addFilterRow = (setFilter) => {
    setFilter((prev) => [...prev, '']);
  };

  const csvEscape = (value) => {
    const str = value == null ? '' : String(value);
    if (str.includes('"') || str.includes(',') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const handleExportCsv = () => {
    if (!records.length) return;

    const headers = [
      'Date',
      'Transaction',
      'Product',
      'Category',
      'Qty',
      'Unit Price',
      'Total Price',
    ];

    const rows = records.map((r) => [
      r.sale_date || 'N/A',
      r.transaction_id || 'N/A',
      r.product_name || 'N/A',
      r.category || 'N/A',
      r.quantity ?? '-',
      parseFloat(r.unit_price || 0).toFixed(2),
      parseFloat(r.total_price || 0).toFixed(2),
    ]);

    const csv = [headers, ...rows]
      .map((row) => row.map(csvEscape).join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const now = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    const a = document.createElement('a');
    a.href = url;
    a.download = `sales-records-filtered-${now}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };


  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <Navbar />
      <div className="max-w-6xl mx-auto p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h2 className="text-3xl font-bold">Sales Records</h2>
            <p className="text-gray-300 mt-1">Data from your daily_sales table. Filter by product, category, transaction, and date.</p>
            <p className="text-gray-400 text-sm mt-1">Logged in as: <span className="font-semibold text-teal-300">{user?.email}</span></p>
          </div>
          <div className="flex items-center gap-2">
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-2">
              <label className="text-xs text-gray-400">Sort by</label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="mt-1 bg-gray-900 border border-gray-700 rounded px-2 py-1 text-sm"
              >
                <option value="time">Time</option>
                <option value="name">Product Name</option>
                <option value="price">Total Price</option>
                <option value="sales">Total Price</option>
              </select>
            </div>
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-2">
              <label className="text-xs text-gray-400">Order</label>
              <select
                value={order}
                onChange={(e) => setOrder(e.target.value)}
                className="mt-1 bg-gray-900 border border-gray-700 rounded px-2 py-1 text-sm"
              >
                <option value="desc">Desc</option>
                <option value="asc">Asc</option>
              </select>
            </div>
          </div>
        </div>

        <form onSubmit={handleApply} className="mt-4 space-y-3">
          <div className="bg-gray-800 border border-gray-700 rounded-md p-3">
            <p className="text-gray-300 text-sm">Use filters below and click Apply filters to query sales records.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-sm text-gray-300">Product</label>
                <button type="button" onClick={() => addFilterRow(setProductFilters)} className="text-xs text-teal-300">+ Add</button>
              </div>
              {productFilters.map((value, idx) => (
                <input
                  key={`product-${idx}`}
                  value={value}
                  onChange={(e) => updateFilterValue(setProductFilters, idx, e.target.value)}
                  placeholder={`Product filter #${idx + 1}`}
                  className="w-full mb-1 border border-gray-700 rounded-md px-3 py-2 bg-gray-800 text-white"
                />
              ))}
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-sm text-gray-300">Category</label>
                <button type="button" onClick={() => addFilterRow(setCategoryFilters)} className="text-xs text-teal-300">+ Add</button>
              </div>
              {categoryFilters.map((value, idx) => (
                <input
                  key={`category-${idx}`}
                  value={value}
                  onChange={(e) => updateFilterValue(setCategoryFilters, idx, e.target.value)}
                  placeholder={`Category filter #${idx + 1}`}
                  className="w-full mb-1 border border-gray-700 rounded-md px-3 py-2 bg-gray-800 text-white"
                />
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-sm text-gray-300">Transaction ID</label>
                <button type="button" onClick={() => addFilterRow(setTransactionFilters)} className="text-xs text-teal-300">+ Add</button>
              </div>
              {transactionFilters.map((value, idx) => (
                <input
                  key={`tx-${idx}`}
                  value={value}
                  onChange={(e) => updateFilterValue(setTransactionFilters, idx, e.target.value)}
                  placeholder={`Transaction ID #${idx + 1}`}
                  className="w-full mb-1 border border-gray-700 rounded-md px-3 py-2 bg-gray-800 text-white"
                />
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm text-gray-300">Start date</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full mt-1 border border-gray-700 rounded-md px-3 py-2 bg-gray-800 text-white"
                />
              </div>
              <div>
                <label className="text-sm text-gray-300">End date</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full mt-1 border border-gray-700 rounded-md px-3 py-2 bg-gray-800 text-white"
                />
              </div>
            </div>
          </div>

          <div className="flex gap-2 flex-wrap">
            <button
              type="submit"
              className="bg-teal-500 hover:bg-teal-400 text-gray-900 font-semibold rounded-md px-4 py-2 transition"
            >
              Apply filters
            </button>
            <button
              type="button"
              onClick={() => {
                setProductFilters(['']);
                setCategoryFilters(['']);
                setTransactionFilters(['']);
                setStartDate('');
                setEndDate('');
                fetchSales();
              }}
              className="bg-gray-700 hover:bg-gray-600 text-white rounded-md px-4 py-2 transition"
            >
              Reset
            </button>
            <button
              type="button"
              onClick={handleExportCsv}
              disabled={!records.length}
              className="bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-md px-4 py-2 transition"
            >
              Export filtered CSV
            </button>
          </div>
        </form>

        <div className="mt-4">
          {error && <div className="text-red-400 mb-2">{error}</div>}
          {loading ? (
            <div className="p-4 bg-gray-800 rounded-md">Loading records...</div>
          ) : (
            <div className="overflow-x-auto bg-gray-800 rounded-lg border border-gray-700 mt-2">
              <table className="min-w-full divide-y divide-gray-700">
                <thead className="bg-gray-900 text-left text-xs uppercase tracking-wide text-gray-300">
                  <tr>
                    <th className="px-3 py-2">Date</th>
                    <th className="px-3 py-2">Transaction</th>
                    <th className="px-3 py-2">Product</th>
                    <th className="px-3 py-2">Category</th>
                    <th className="px-3 py-2">Qty</th>
                    <th className="px-3 py-2">Unit Price</th>
                    <th className="px-3 py-2">Total Price</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {!records.length ? (
                    <tr>
                      <td colSpan="7" className="px-3 py-4 text-gray-400">No records found.</td>
                    </tr>
                  ) : records.map((r) => (
                    <tr key={`${r.transaction_id}-${r.sale_date}-${r.product_id}`} className="hover:bg-gray-700/30">
                      <td className="px-3 py-2 text-sm">{r.sale_date || 'N/A'}</td>
                      <td className="px-3 py-2 text-sm">{r.transaction_id || 'N/A'}</td>
                      <td className="px-3 py-2 text-sm">{r.product_name || 'N/A'}</td>
                      <td className="px-3 py-2 text-sm">{r.category || 'N/A'}</td>
                      <td className="px-3 py-2 text-sm">{r.quantity ?? '-'}</td>
                      <td className="px-3 py-2 text-sm">${parseFloat(r.unit_price || 0).toFixed(2)}</td>
                      <td className="px-3 py-2 text-sm">${parseFloat(r.total_price || 0).toFixed(2)}</td>
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
