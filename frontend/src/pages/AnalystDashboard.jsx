import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { Navbar } from '../components/Navbar';

const API_URL = 'http://localhost:5000/api';

export const AnalystDashboard = () => {
  const { user } = useAuth();
  const [topProducts, setTopProducts] = useState([]);
  const [loadingChart, setLoadingChart] = useState(false);
  const [chartError, setChartError] = useState('');
  const [hoveredBar, setHoveredBar] = useState(null);

  useEffect(() => {
    const fetchTopProducts = async () => {
      setLoadingChart(true);
      setChartError('');
      try {
        const token = localStorage.getItem('token');
        const response = await axios.get(`${API_URL}/csv/records`, {
          headers: { Authorization: `Bearer ${token}` },
          params: { sortBy: 'sales', order: 'desc' },
        });
        const productsCount = response.data.records.reduce((acc, row) => {
          const name = row.product_name || 'Unknown';
          acc[name] = (acc[name] || 0) + (row.quantity || 0);
          return acc;
        }, {});
        const sorted = Object.entries(productsCount)
          .map(([name, qty]) => ({ name, qty }))
          .sort((a, b) => b.qty - a.qty)
          .slice(0, 10);
        setTopProducts(sorted);
      } catch (err) {
        console.error('Top products error', err);
        setChartError('Could not load top products');
      } finally {
        setLoadingChart(false);
      }
    };
    fetchTopProducts();
  }, []);

  const maxQty = topProducts.length ? Math.max(...topProducts.map((p) => p.qty)) : 0;

  // Nice Y-axis ticks
  const getYTicks = () => {
    if (!maxQty) return [0];
    const step = Math.ceil(maxQty / 5 / 10) * 10 || 1;
    const ticks = [];
    for (let i = 0; i <= maxQty + step; i += step) ticks.push(i);
    return ticks;
  };
  const yTicks = getYTicks();
  const chartMax = yTicks[yTicks.length - 1] || 1;

  return (
    <div className="min-h-screen flex flex-col bg-gray-900">
      <Navbar />
      <div className="p-8">
        <h2 className="text-2xl font-semibold text-gray-50">Analyst Dashboard</h2>
        <p className="text-gray-400 mt-2">Welcome, {user?.email}</p>

        {/* Stat cards */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="bg-gray-800 p-6 rounded-xl shadow-xl">
            <h4 className="text-sm font-medium text-gray-400 uppercase">Sales Trends</h4>
            <p className="text-3xl font-bold text-teal-500 mt-2">↑ 12.5%</p>
            <p className="text-xs text-gray-500 mt-1">30-day trend</p>
          </div>
          <div className="bg-gray-800 p-6 rounded-xl shadow-xl">
            <h4 className="text-sm font-medium text-gray-400 uppercase">Anomalies Detected</h4>
            <p className="text-3xl font-bold text-rose-500 mt-2">3</p>
            <p className="text-xs text-gray-500 mt-1">This week</p>
          </div>
          <div className="bg-gray-800 p-6 rounded-xl shadow-xl">
            <h4 className="text-sm font-medium text-gray-400 uppercase">Forecast Accuracy</h4>
            <p className="text-3xl font-bold text-purple-500 mt-2">94.2%</p>
            <p className="text-xs text-gray-500 mt-1">Last 7 days</p>
          </div>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-6">
          {/* Vertical Bar Chart */}
          <div className="bg-gray-800 p-6 rounded-xl shadow-xl">
            <h3 className="text-lg font-semibold text-gray-50 mb-1">Top 10 Products</h3>
            <p className="text-xs text-gray-500 mb-6">By total quantity sold</p>

            {loadingChart ? (
              <p className="text-gray-400">Loading chart...</p>
            ) : chartError ? (
              <p className="text-red-400">{chartError}</p>
            ) : !topProducts.length ? (
              <p className="text-gray-400">No product sales data available.</p>
            ) : (
              <div className="relative">
                {/* Chart area */}
                <div className="flex gap-0">
                  {/* Y-axis labels */}
                  <div className="flex flex-col-reverse justify-between pr-3 pb-10" style={{ minWidth: '40px' }}>
                    {yTicks.map((tick) => (
                      <span key={tick} className="text-xs text-gray-500 text-right leading-none">
                        {tick}
                      </span>
                    ))}
                  </div>

                  {/* Bars + X-axis */}
                  <div className="flex-1 flex flex-col">
                    {/* Grid lines + bars */}
                    <div
                      className="relative flex items-end gap-2 border-l border-b border-gray-700"
                      style={{ height: '260px' }}
                    >
                      {/* Horizontal grid lines */}
                      {yTicks.map((tick) => (
                        <div
                          key={tick}
                          className="absolute left-0 right-0 border-t border-gray-700/50"
                          style={{ bottom: `${(tick / chartMax) * 100}%` }}
                        />
                      ))}

                      {/* Bars */}
                      {topProducts.map((p, i) => {
                        const heightPct = (p.qty / chartMax) * 100;
                        const isHovered = hoveredBar === i;
                        return (
                          <div
                            key={p.name}
                            className="relative flex-1 flex flex-col justify-end group cursor-pointer"
                            style={{ height: '100%' }}
                            onMouseEnter={() => setHoveredBar(i)}
                            onMouseLeave={() => setHoveredBar(null)}
                          >
                            {/* Tooltip */}
                            {isHovered && (
                              <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 z-10 bg-gray-900 border border-teal-700 text-white rounded-lg px-4 py-3 whitespace-nowrap shadow-xl pointer-events-none">
                                <p className="text-sm font-bold text-teal-300 mb-1">{p.name}</p>
                                <p className="text-xs text-gray-400">Qty: <span className="font-bold text-white text-sm">{p.qty}</span></p>
                                {/* Arrow */}
                                <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-teal-700" />
                              </div>
                            )}

                            {/* The bar */}
                            <div
                              className="w-full rounded-t-md transition-all duration-150"
                              style={{
                                height: `${Math.max(2, heightPct)}%`,
                                background: isHovered
                                  ? 'linear-gradient(to top, #0d9488, #67e8f9)'
                                  : 'linear-gradient(to top, #0f766e, #2dd4bf)',
                                boxShadow: isHovered ? '0 0 12px rgba(45,212,191,0.4)' : 'none',
                              }}
                            />
                          </div>
                        );
                      })}
                    </div>

                    {/* X-axis labels */}
                    <div className="flex gap-2 mt-2">
                      {topProducts.map((p) => (
                        <div key={p.name} className="flex-1 text-center">
                          <span
                            className="text-xs text-gray-400 block overflow-hidden"
                            style={{
                              writingMode: 'vertical-rl',
                              transform: 'rotate(180deg)',
                              maxHeight: '80px',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                            title={p.name}
                          >
                            {p.name}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="bg-gray-800 p-6 rounded-xl shadow-xl">
            <h3 className="text-lg font-semibold text-gray-50 mb-4">Data Visualizations</h3>
            <p className="text-gray-400">Charts, graphs, and ML model insights</p>
          </div>
          <div className="bg-gray-800 p-6 rounded-xl shadow-xl">
            <h3 className="text-lg font-semibold text-gray-50 mb-4">Anomaly Reports</h3>
            <p className="text-gray-400">Unusual patterns and outlier detection</p>
          </div>
        </div>
      </div>
    </div>
  );
};