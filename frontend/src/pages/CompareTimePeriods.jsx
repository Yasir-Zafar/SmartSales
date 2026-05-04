import React, { useState } from 'react';
import axios from 'axios';
import qs from 'qs';
import { useAuth } from '../context/AuthContext';
import { Navbar } from '../components/Navbar';

const API_URL = 'http://localhost:5000/api';

export const CompareTimePeriods = () => {
  const { user } = useAuth();
  const [leftStartDate, setLeftStartDate] = useState('');
  const [leftEndDate, setLeftEndDate] = useState('');
  const [rightStartDate, setRightStartDate] = useState('');
  const [rightEndDate, setRightEndDate] = useState('');
  const [productFilters, setProductFilters] = useState(['']);
  const [categoryFilters, setCategoryFilters] = useState(['']);
  const [transactionFilters, setTransactionFilters] = useState(['']);
  const [sortBy, setSortBy] = useState('time');
  const [order, setOrder] = useState('desc');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [leftRecords, setLeftRecords] = useState([]);
  const [rightRecords, setRightRecords] = useState([]);

  const updateFilterValue = (setFilter, index, value) => {
    setFilter((prev) => prev.map((v, i) => (i === index ? value : v)));
  };

  const addFilterRow = (setFilter) => {
    setFilter((prev) => [...prev, '']);
  };

  const removeFilterRow = (setFilter, index) => {
    setFilter((prev) => prev.length > 1 ? prev.filter((_, i) => i !== index) : prev);
  };

  const fetchPeriod = async (startDate, endDate) => {
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
    return response.data.records || [];
  };

  const handleCompare = async (e) => {
    e.preventDefault();
    if (!leftStartDate || !leftEndDate || !rightStartDate || !rightEndDate) {
      setError('Select both period date ranges before comparing.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const [left, right] = await Promise.all([
        fetchPeriod(leftStartDate, leftEndDate),
        fetchPeriod(rightStartDate, rightEndDate),
      ]);
      setLeftRecords(left);
      setRightRecords(right);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || 'Could not load comparison data.');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setLeftStartDate('');
    setLeftEndDate('');
    setRightStartDate('');
    setRightEndDate('');
    setProductFilters(['']);
    setCategoryFilters(['']);
    setTransactionFilters(['']);
    setLeftRecords([]);
    setRightRecords([]);
    setError('');
  };

  const computeSummary = (records) => {
    const totalRevenue = records.reduce((s, r) => s + parseFloat(r.total_price || 0), 0);
    const totalQty = records.reduce((s, r) => s + (r.quantity || 0), 0);
    const uniqueTxns = new Set(records.map((r) => r.transaction_id)).size;
    const uniqueProducts = new Set(records.map((r) => r.product_name)).size;
    return { totalRevenue, totalQty, uniqueTxns, uniqueProducts, count: records.length };
  };

  const leftSummary = computeSummary(leftRecords);
  const rightSummary = computeSummary(rightRecords);

  const renderSummaryCards = (summary, label, accent) => (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
      {[
        { icon: '💰', title: 'Revenue', value: `$${summary.totalRevenue.toFixed(2)}` },
        { icon: '📦', title: 'Units Sold', value: summary.totalQty.toLocaleString() },
        { icon: '🧾', title: 'Transactions', value: summary.uniqueTxns.toLocaleString() },
        { icon: '🏷️', title: 'Products', value: summary.uniqueProducts.toLocaleString() },
      ].map((card) => (
        <div key={card.title} className={`bg-gray-900/60 border rounded-lg p-3 ${accent === 'left' ? 'border-teal-500/30' : 'border-violet-500/30'}`}>
          <div className="flex items-center gap-2">
            <span className="text-lg">{card.icon}</span>
            <div>
              <p className="text-xs text-gray-400 uppercase">{card.title}</p>
              <p className="text-lg font-bold text-gray-100">{card.value}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  const renderRecordsTable = (records, accent) => (
    <div className="overflow-x-auto bg-gray-900/60 rounded-lg border border-gray-700 mt-3">
      <table className="min-w-full divide-y divide-gray-700">
        <thead className="bg-gray-800 text-left text-xs uppercase tracking-wide text-gray-400">
          <tr>
            <th className="px-3 py-2">Date</th>
            <th className="px-3 py-2">Txn</th>
            <th className="px-3 py-2">Product</th>
            <th className="px-3 py-2">Category</th>
            <th className="px-3 py-2">Qty</th>
            <th className="px-3 py-2">Total</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-800">
          {!records.length ? (
            <tr>
              <td colSpan="6" className="px-3 py-6 text-center text-gray-500">No records found.</td>
            </tr>
          ) : (
            records.map((r, idx) => (
              <tr key={`${r.transaction_id}-${r.sale_date}-${idx}`} className="hover:bg-gray-800/50">
                <td className="px-3 py-2 text-sm text-gray-300">{r.sale_date || 'N/A'}</td>
                <td className="px-3 py-2 text-sm text-gray-400 font-mono text-xs">{r.transaction_id || 'N/A'}</td>
                <td className="px-3 py-2 text-sm text-gray-200">{r.product_name || 'N/A'}</td>
                <td className="px-3 py-2 text-sm text-gray-400">{r.category || 'N/A'}</td>
                <td className="px-3 py-2 text-sm text-gray-300">{r.quantity ?? '-'}</td>
                <td className={`px-3 py-2 text-sm font-semibold ${accent === 'left' ? 'text-teal-400' : 'text-violet-400'}`}>${parseFloat(r.total_price || 0).toFixed(2)}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <Navbar />
      <div className="max-w-7xl mx-auto p-6">
        <div className="mb-6">
          <h2 className="text-3xl font-bold">Compare Time Periods</h2>
          <p className="text-gray-400 mt-1">Select two date ranges, apply filters, and compare sales side by side.</p>
          <p className="text-gray-500 text-sm mt-1">Logged in as <span className="text-teal-400">{user?.email}</span></p>
        </div>

        {error && (
          <div className="bg-red-900/20 border border-red-700/50 text-red-300 px-4 py-3 rounded-lg mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleCompare} className="space-y-4">
          <div className="bg-gray-800/80 border border-gray-700 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wide mb-3">Date Ranges</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-gray-900/60 border border-teal-500/20 rounded-lg p-4">
                <p className="text-sm font-semibold text-teal-400 mb-3">Period A</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Start Date</label>
                    <input type="date" value={leftStartDate} onChange={(e) => setLeftStartDate(e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:border-teal-500 focus:outline-none" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">End Date</label>
                    <input type="date" value={leftEndDate} onChange={(e) => setLeftEndDate(e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:border-teal-500 focus:outline-none" />
                  </div>
                </div>
              </div>

              <div className="bg-gray-900/60 border border-violet-500/20 rounded-lg p-4">
                <p className="text-sm font-semibold text-violet-400 mb-3">Period B</p>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">Start Date</label>
                    <input type="date" value={rightStartDate} onChange={(e) => setRightStartDate(e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:border-violet-500 focus:outline-none" />
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 mb-1 block">End Date</label>
                    <input type="date" value={rightEndDate} onChange={(e) => setRightEndDate(e.target.value)} className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:border-violet-500 focus:outline-none" />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-gray-800/80 border border-gray-700 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wide mb-3">Filters</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm text-gray-400">Product</label>
                {productFilters.map((value, idx) => (
                  <div key={`product-${idx}`} className="flex gap-2">
                    <input
                      value={value}
                      onChange={(e) => updateFilterValue(setProductFilters, idx, e.target.value)}
                      placeholder="Product name..."
                      className="flex-1 bg-gray-900/60 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:border-teal-500 focus:outline-none"
                    />
                    {productFilters.length > 1 && (
                      <button type="button" onClick={() => removeFilterRow(setProductFilters, idx)} className="text-gray-500 hover:text-red-400 px-2 text-lg leading-5">
                        ×
                      </button>
                    )}
                  </div>
                ))}
                <button type="button" onClick={() => addFilterRow(setProductFilters)} className="text-xs text-teal-400 hover:text-teal-300">+ Add product filter</button>
              </div>

              <div className="space-y-2">
                <label className="text-sm text-gray-400">Category</label>
                {categoryFilters.map((value, idx) => (
                  <div key={`category-${idx}`} className="flex gap-2">
                    <input
                      value={value}
                      onChange={(e) => updateFilterValue(setCategoryFilters, idx, e.target.value)}
                      placeholder="Category..."
                      className="flex-1 bg-gray-900/60 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:border-teal-500 focus:outline-none"
                    />
                    {categoryFilters.length > 1 && (
                      <button type="button" onClick={() => removeFilterRow(setCategoryFilters, idx)} className="text-gray-500 hover:text-red-400 px-2 text-lg leading-5">
                        ×
                      </button>
                    )}
                  </div>
                ))}
                <button type="button" onClick={() => addFilterRow(setCategoryFilters)} className="text-xs text-teal-400 hover:text-teal-300">+ Add category filter</button>
              </div>
            </div>

            <div className="mt-4 space-y-2">
              <label className="text-sm text-gray-400">Transaction ID</label>
              {transactionFilters.map((value, idx) => (
                <div key={`transaction-${idx}`} className="flex gap-2">
                  <input
                    value={value}
                    onChange={(e) => updateFilterValue(setTransactionFilters, idx, e.target.value)}
                    placeholder="Transaction ID..."
                    className="flex-1 bg-gray-900/60 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:border-teal-500 focus:outline-none"
                  />
                  {transactionFilters.length > 1 && (
                    <button type="button" onClick={() => removeFilterRow(setTransactionFilters, idx)} className="text-gray-500 hover:text-red-400 px-2 text-lg leading-5">
                      ×
                    </button>
                  )}
                </div>
              ))}
              <button type="button" onClick={() => addFilterRow(setTransactionFilters)} className="text-xs text-teal-400 hover:text-teal-300">+ Add transaction filter</button>
            </div>
          </div>

          <div className="bg-gray-800/80 border border-gray-700 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wide mb-3">Sort & Actions</h3>
            <div className="flex flex-wrap gap-3 items-center">
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Sort By</label>
                <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:border-teal-500 focus:outline-none">
                  <option value="time">Time</option>
                  <option value="name">Product Name</option>
                  <option value="price">Total Price</option>
                  <option value="sales">Total Price</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Order</label>
                <select value={order} onChange={(e) => setOrder(e.target.value)} className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:border-teal-500 focus:outline-none">
                  <option value="desc">Descending</option>
                  <option value="asc">Ascending</option>
                </select>
              </div>
              <button type="submit" className="bg-teal-500 hover:bg-teal-400 text-gray-900 font-semibold rounded-lg px-6 py-2 transition mt-4">Compare</button>
              <button type="button" onClick={handleReset} className="bg-gray-700 hover:bg-gray-600 text-white rounded-lg px-6 py-2 transition mt-4">Reset</button>
            </div>
          </div>
        </form>

        <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-gray-800/80 border border-teal-500/20 rounded-xl p-5">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-teal-400">Period A</h3>
              <span className="text-xs text-gray-500">{leftStartDate || '—'} to {leftEndDate || '—'}</span>
            </div>
            {loading ? (
              <div className="flex items-center justify-center py-12 text-gray-500">
                <div className="animate-spin w-6 h-6 border-2 border-teal-500 border-t-transparent rounded-full mr-3"></div>
                Loading...
              </div>
            ) : (
              <>
                {leftRecords.length > 0 && renderSummaryCards(leftSummary, 'left')}
                {renderRecordsTable(leftRecords, 'left')}
              </>
            )}
          </div>

          <div className="bg-gray-800/80 border border-violet-500/20 rounded-xl p-5">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-violet-400">Period B</h3>
              <span className="text-xs text-gray-500">{rightStartDate || '—'} to {rightEndDate || '—'}</span>
            </div>
            {loading ? (
              <div className="flex items-center justify-center py-12 text-gray-500">
                <div className="animate-spin w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full mr-3"></div>
                Loading...
              </div>
            ) : (
              <>
                {rightRecords.length > 0 && renderSummaryCards(rightSummary, 'right')}
                {renderRecordsTable(rightRecords, 'right')}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
