import React, { useState, useEffect } from 'react';
import axios from 'axios';
import qs from 'qs';
import { useAuth } from '../context/AuthContext';
import { Navbar } from '../components/Navbar';
import { FileText, DollarSign, Package, Receipt } from 'lucide-react';

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

  const removeFilterRow = (setFilter, index) => {
    setFilter((prev) => prev.length > 1 ? prev.filter((_, i) => i !== index) : prev);
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
      'Total Price',
    ];

    const rows = records.map((r) => [
      r.sale_date || 'N/A',
      r.transaction_id || 'N/A',
      r.product_name || 'N/A',
      r.category || 'N/A',
      r.quantity ?? '-',
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

  const totalRevenue = records.reduce((s, r) => s + parseFloat(r.total_price || 0), 0);
  const totalUnits = records.reduce((s, r) => s + (r.quantity || 0), 0);
  const uniqueTxns = new Set(records.map((r) => r.transaction_id)).size;

  return (
    <div className="min-h-screen bg-surface-900 text-white">
      <Navbar />
      <div className="max-w-7xl mx-auto p-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-6">
          <div>
            <h2 className="text-3xl font-bold">Sales Records</h2>
            <p className="text-text-muted mt-1">Query and export filtered sales data from your daily_sales table.</p>
            <p className="text-text-faint text-sm mt-1">Logged in as <span className="text-accent">{user?.email}</span></p>
          </div>
          <div className="flex items-center gap-3">
            <div>
              <label className="text-xs text-text-faint mb-1 block">Sort By</label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="bg-surface-800 border border-surface-700 rounded-lg px-3 py-2 text-sm focus:border-accent-border focus:outline-none"
              >
                <option value="time">Time</option>
                <option value="name">Product Name</option>
                <option value="price">Total Price</option>
                <option value="sales">Total Price</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-text-faint mb-1 block">Order</label>
              <select
                value={order}
                onChange={(e) => setOrder(e.target.value)}
                className="bg-surface-800 border border-surface-700 rounded-lg px-3 py-2 text-sm focus:border-accent-border focus:outline-none"
              >
                <option value="desc">Descending</option>
                <option value="asc">Ascending</option>
              </select>
            </div>
          </div>
        </div>

        {records.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
            {[
              { label: 'Records', value: records.length.toLocaleString(), Icon: FileText, color: 'text-accent' },
              { label: 'Revenue', value: `$${totalRevenue.toFixed(2)}`, Icon: DollarSign, color: 'text-warning' },
              { label: 'Units Sold', value: totalUnits.toLocaleString(), Icon: Package, color: 'text-success' },
              { label: 'Transactions', value: uniqueTxns.toLocaleString(), Icon: Receipt, color: 'text-danger' },
            ].map((card) => (
              <div key={card.label} className="bg-surface-800 border border-surface-700 rounded-xl p-4">
                <div className="flex items-center gap-3">
                  <card.Icon className={`w-5 h-5 ${card.color}`} />
                  <div>
                    <p className="text-xs text-text-muted uppercase">{card.label}</p>
                    <p className="text-lg font-bold text-text-primary">{card.value}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <form onSubmit={handleApply} className="space-y-4 mb-6">
          <div className="bg-surface-800/80 border border-surface-700 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-text-secondary uppercase tracking-wide mb-3">Filters</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm text-text-muted">Product</label>
                {productFilters.map((value, idx) => (
                  <div key={`product-${idx}`} className="flex gap-2">
                    <input
                      value={value}
                      onChange={(e) => updateFilterValue(setProductFilters, idx, e.target.value)}
                      placeholder="Product name..."
                      className="flex-1 bg-surface-900/60 border border-surface-700 rounded-lg px-3 py-2 text-sm focus:border-accent-border focus:outline-none"
                    />
                    {productFilters.length > 1 && (
                      <button type="button" onClick={() => removeFilterRow(setProductFilters, idx)} className="text-text-faint hover:text-danger px-2 text-lg leading-5">
                        ×
                      </button>
                    )}
                  </div>
                ))}
                <button type="button" onClick={() => addFilterRow(setProductFilters)} className="text-xs text-accent hover:text-accent-hover">+ Add product filter</button>
              </div>

              <div className="space-y-2">
                <label className="text-sm text-text-muted">Category</label>
                {categoryFilters.map((value, idx) => (
                  <div key={`category-${idx}`} className="flex gap-2">
                    <input
                      value={value}
                      onChange={(e) => updateFilterValue(setCategoryFilters, idx, e.target.value)}
                      placeholder="Category..."
                      className="flex-1 bg-surface-900/60 border border-surface-700 rounded-lg px-3 py-2 text-sm focus:border-accent-border focus:outline-none"
                    />
                    {categoryFilters.length > 1 && (
                      <button type="button" onClick={() => removeFilterRow(setCategoryFilters, idx)} className="text-text-faint hover:text-danger px-2 text-lg leading-5">
                        ×
                      </button>
                    )}
                  </div>
                ))}
                <button type="button" onClick={() => addFilterRow(setCategoryFilters)} className="text-xs text-accent hover:text-accent-hover">+ Add category filter</button>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm text-text-muted">Transaction ID</label>
                {transactionFilters.map((value, idx) => (
                  <div key={`tx-${idx}`} className="flex gap-2">
                    <input
                      value={value}
                      onChange={(e) => updateFilterValue(setTransactionFilters, idx, e.target.value)}
                      placeholder="Transaction ID..."
                      className="flex-1 bg-surface-900/60 border border-surface-700 rounded-lg px-3 py-2 text-sm focus:border-accent-border focus:outline-none"
                    />
                    {transactionFilters.length > 1 && (
                      <button type="button" onClick={() => removeFilterRow(setTransactionFilters, idx)} className="text-text-faint hover:text-danger px-2 text-lg leading-5">
                        ×
                      </button>
                    )}
                  </div>
                ))}
                <button type="button" onClick={() => addFilterRow(setTransactionFilters)} className="text-xs text-accent hover:text-accent-hover">+ Add transaction filter</button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-sm text-text-muted">Start Date</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="w-full mt-1 bg-surface-900/60 border border-surface-700 rounded-lg px-3 py-2 text-sm focus:border-accent-border focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-sm text-text-muted">End Date</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full mt-1 bg-surface-900/60 border border-surface-700 rounded-lg px-3 py-2 text-sm focus:border-accent-border focus:outline-none"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="flex gap-3 flex-wrap">
            <button
              type="submit"
              className="bg-accent hover:bg-accent-hover text-white font-semibold rounded-lg px-6 py-2 transition"
            >
              Apply Filters
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
              className="bg-surface-700 hover:bg-surface-600 text-white rounded-lg px-6 py-2 transition"
            >
              Reset
            </button>
            <button
              type="button"
              onClick={handleExportCsv}
              disabled={!records.length}
              className="bg-accent hover:bg-accent-hover disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-lg px-6 py-2 transition"
            >
              Export CSV
            </button>
          </div>
        </form>

        {error && <div className="bg-danger/20 border border-danger/50 text-danger px-4 py-3 rounded-lg mb-4">{error}</div>}

        {loading ? (
          <div className="flex items-center justify-center py-12 bg-surface-800 rounded-xl text-text-faint">
            <div className="animate-spin w-6 h-6 border-2 border-accent border-t-transparent rounded-full mr-3"></div>
            Loading records...
          </div>
        ) : (
          <div className="overflow-x-auto bg-surface-800 rounded-xl border border-surface-700">
            <table className="min-w-full divide-y divide-surface-700">
              <thead className="bg-surface-900/60 text-left text-xs uppercase tracking-wide text-text-muted">
                <tr>
                  <th className="px-6 py-3">Date</th>
                  <th className="px-6 py-3">Transaction</th>
                  <th className="px-6 py-3">Product</th>
                  <th className="px-6 py-3">Category</th>
                  <th className="px-6 py-3">Qty</th>
                  <th className="px-6 py-3">Total Price</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-700">
                {!records.length ? (
                  <tr>
                    <td colSpan="6" className="px-6 py-8 text-center text-text-faint">No records found.</td>
                  </tr>
                ) : records.map((r) => (
                  <tr key={`${r.transaction_id}-${r.sale_date}-${r.product_id}`} className="hover:bg-surface-800/50">
                    <td className="px-6 py-3 text-sm text-text-secondary">{r.sale_date || 'N/A'}</td>
                    <td className="px-6 py-3 text-sm text-text-muted font-mono text-xs">{r.transaction_id || 'N/A'}</td>
                    <td className="px-6 py-3 text-sm text-text-primary font-medium">{r.product_name || 'N/A'}</td>
                    <td className="px-6 py-3 text-sm text-text-muted">{r.category || 'N/A'}</td>
                    <td className="px-6 py-3 text-sm text-text-secondary">{r.quantity ?? '-'}</td>
                    <td className="px-6 py-3 text-sm font-semibold text-success">${parseFloat(r.total_price || 0).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
