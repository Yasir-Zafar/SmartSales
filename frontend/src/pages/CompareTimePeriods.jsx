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

  const renderRecordsTable = (records) => (
    <div className="overflow-x-auto bg-gray-800 rounded-lg border border-gray-700 mt-2">
      <table className="min-w-full divide-y divide-gray-700">
        <thead className="bg-gray-900 text-left text-xs uppercase tracking-wide text-gray-300">
          <tr>
            <th className="px-3 py-2">Date</th>
            <th className="px-3 py-2">Txn</th>
            <th className="px-3 py-2">Product</th>
            <th className="px-3 py-2">Category</th>
            <th className="px-3 py-2">Qty</th>
            <th className="px-3 py-2">Total</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-700">
          {!records.length ? (
            <tr>
              <td colSpan="6" className="px-3 py-4 text-gray-400">No records found.</td>
            </tr>
          ) : (
            records.map((r, idx) => (
              <tr key={`${r.transaction_id}-${r.sale_date}-${idx}`} className="hover:bg-gray-700/30">
                <td className="px-3 py-2 text-sm">{r.sale_date || 'N/A'}</td>
                <td className="px-3 py-2 text-sm">{r.transaction_id || 'N/A'}</td>
                <td className="px-3 py-2 text-sm">{r.product_name || 'N/A'}</td>
                <td className="px-3 py-2 text-sm">{r.category || 'N/A'}</td>
                <td className="px-3 py-2 text-sm">{r.quantity ?? '-'}</td>
                <td className="px-3 py-2 text-sm">${parseFloat(r.total_price || 0).toFixed(2)}</td>
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
      <div className="max-w-6xl mx-auto p-6">
        <div className="mb-4">
          <h2 className="text-3xl font-bold">Compare Time Periods</h2>
          <p className="text-gray-300 mt-1">Select two period ranges, then apply filters to compare sales side by side.</p>
          <p className="text-gray-400 text-sm mt-1">Logged in as: <span className="font-semibold text-teal-300">{user?.email}</span></p>
        </div>

        {error && <div className="text-rose-300 bg-red-900/20 border border-red-700 p-2 rounded mb-3">{error}</div>}

        <form onSubmit={handleCompare} className="space-y-4 bg-gray-800 border border-gray-700 rounded-md p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="bg-gray-900 p-3 rounded-md">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-gray-200">Period A</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <label className="text-xs text-gray-300">Start</label>
                <label className="text-xs text-gray-300">End</label>
                <input type="date" value={leftStartDate} onChange={(e) => setLeftStartDate(e.target.value)} className="bg-gray-800 border border-gray-600 rounded px-2 py-1 text-sm" />
                <input type="date" value={leftEndDate} onChange={(e) => setLeftEndDate(e.target.value)} className="bg-gray-800 border border-gray-600 rounded px-2 py-1 text-sm" />
              </div>
            </div>

            <div className="bg-gray-900 p-3 rounded-md">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm text-gray-200">Period B</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <label className="text-xs text-gray-300">Start</label>
                <label className="text-xs text-gray-300">End</label>
                <input type="date" value={rightStartDate} onChange={(e) => setRightStartDate(e.target.value)} className="bg-gray-800 border border-gray-600 rounded px-2 py-1 text-sm" />
                <input type="date" value={rightEndDate} onChange={(e) => setRightEndDate(e.target.value)} className="bg-gray-800 border border-gray-600 rounded px-2 py-1 text-sm" />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="bg-gray-900 p-3 rounded-md">
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
                  className="w-full mb-1 border border-gray-700 rounded-md px-2 py-1 bg-gray-800 text-white text-sm"
                />
              ))}
            </div>
            <div className="bg-gray-900 p-3 rounded-md">
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
                  className="w-full mb-1 border border-gray-700 rounded-md px-2 py-1 bg-gray-800 text-white text-sm"
                />
              ))}
            </div>
          </div>

          <div className="bg-gray-900 p-3 rounded-md">
            <div className="flex items-center justify-between mb-1">
              <label className="text-sm text-gray-300">Transaction ID</label>
              <button type="button" onClick={() => addFilterRow(setTransactionFilters)} className="text-xs text-teal-300">+ Add</button>
            </div>
            {transactionFilters.map((value, idx) => (
              <input
                key={`transaction-${idx}`}
                value={value}
                onChange={(e) => updateFilterValue(setTransactionFilters, idx, e.target.value)}
                placeholder={`Transaction ID #${idx + 1}`}
                className="w-full mb-1 border border-gray-700 rounded-md px-2 py-1 bg-gray-800 text-white text-sm"
              />
            ))}
          </div>

          <div className="flex flex-wrap gap-2">
            <div className="bg-gray-800 border border-gray-700 rounded p-2">
              <label className="text-xs text-gray-400">Sort by</label>
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="mt-1 bg-gray-900 border border-gray-700 rounded px-2 py-1 text-sm">
                <option value="time">Time</option>
                <option value="name">Product Name</option>
                <option value="price">Total Price</option>
                <option value="sales">Total Price</option>
              </select>
            </div>
            <div className="bg-gray-800 border border-gray-700 rounded p-2">
              <label className="text-xs text-gray-400">Order</label>
              <select value={order} onChange={(e) => setOrder(e.target.value)} className="mt-1 bg-gray-900 border border-gray-700 rounded px-2 py-1 text-sm">
                <option value="desc">Desc</option>
                <option value="asc">Asc</option>
              </select>
            </div>
            <button type="submit" className="bg-teal-500 hover:bg-teal-400 text-gray-900 font-semibold rounded px-4 py-2">Compare</button>
            <button type="button" onClick={handleReset} className="bg-gray-700 hover:bg-gray-600 text-white rounded px-4 py-2">Reset</button>
          </div>
        </form>

        <div className="mt-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-gray-800 border border-gray-700 rounded p-3">
            <h3 className="text-sm font-semibold text-gray-200">Period A ({leftStartDate || 'none'} to {leftEndDate || 'none'})</h3>
            {loading ? <p className="text-gray-300">Loading...</p> : renderRecordsTable(leftRecords)}
          </div>
          <div className="bg-gray-800 border border-gray-700 rounded p-3">
            <h3 className="text-sm font-semibold text-gray-200">Period B ({rightStartDate || 'none'} to {rightEndDate || 'none'})</h3>
            {loading ? <p className="text-gray-300">Loading...</p> : renderRecordsTable(rightRecords)}
          </div>
        </div>
      </div>
    </div>
  );
};
