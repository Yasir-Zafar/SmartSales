import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { Navbar } from '../components/Navbar';

const API_URL = 'http://localhost:5000/api';
const LOW_STOCK_THRESHOLD = 2;

export const OwnerInventory = () => {
  const [products, setProducts] = useState([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError('');
      try {
        const token = localStorage.getItem('token');
        const res = await axios.get(`${API_URL}/products`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setProducts(res.data?.products || []);
      } catch (e) {
        setError(e.response?.data?.message || 'Could not load inventory');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) => {
      const name = String(p?.name || '').toLowerCase();
      const cat = String(p?.category || '').toLowerCase();
      return name.includes(q) || cat.includes(q);
    });
  }, [products, query]);

  const lowStockCount = useMemo(
    () => filtered.filter((p) => Number(p?.stock_quantity ?? 0) < LOW_STOCK_THRESHOLD).length,
    [filtered]
  );

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <Navbar />
      <div className="max-w-6xl mx-auto p-6">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <h2 className="text-3xl font-bold">Inventory</h2>
            <p className="text-gray-400 mt-1">
              Products, prices, and stock levels. Items with quantity under {LOW_STOCK_THRESHOLD} are highlighted in red.
            </p>
            <p className="text-sm text-gray-400 mt-2">
              Showing <span className="text-teal-300 font-semibold">{filtered.length}</span> products
              {lowStockCount ? (
                <>
                  {' '}• <span className="text-rose-300 font-semibold">{lowStockCount}</span> low stock
                </>
              ) : null}
            </p>
          </div>

          <div className="w-full md:w-80">
            <label className="block text-sm text-gray-300 mb-1">Search</label>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter by name or category..."
              className="w-full border border-gray-700 rounded-md px-3 py-2 bg-gray-950 text-white"
            />
          </div>
        </div>

        <div className="mt-6 bg-gray-800 border border-gray-700 rounded-xl p-5">
          {loading ? (
            <p className="text-gray-400">Loading inventory...</p>
          ) : error ? (
            <p className="text-rose-300">{error}</p>
          ) : filtered.length === 0 ? (
            <p className="text-gray-400">No products found.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-700 text-sm">
                <thead className="text-left text-xs uppercase tracking-wide text-gray-400">
                  <tr>
                    <th className="px-3 py-2">Product</th>
                    <th className="px-3 py-2">Category</th>
                    <th className="px-3 py-2">Price</th>
                    <th className="px-3 py-2">Quantity</th>
                    <th className="px-3 py-2">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-700">
                  {filtered.map((p) => {
                    const qty = Number(p?.stock_quantity ?? 0);
                    const isLow = qty < LOW_STOCK_THRESHOLD;
                    return (
                      <tr
                        key={p.id}
                        className={[
                          'hover:bg-gray-700/30',
                          isLow ? 'bg-rose-900/20' : '',
                        ].join(' ')}
                      >
                        <td className={['px-3 py-2', isLow ? 'text-rose-200' : 'text-gray-200'].join(' ')}>
                          {p?.name || '—'}
                        </td>
                        <td className={['px-3 py-2', isLow ? 'text-rose-200/90' : 'text-gray-200'].join(' ')}>
                          {p?.category || '—'}
                        </td>
                        <td className={['px-3 py-2', isLow ? 'text-rose-200' : 'text-gray-200'].join(' ')}>
                          ${Number(p?.price ?? 0).toFixed(2)}
                        </td>
                        <td className={['px-3 py-2 font-semibold', isLow ? 'text-rose-300' : 'text-teal-300'].join(' ')}>
                          {Number.isFinite(qty) ? qty : '—'}
                        </td>
                        <td className="px-3 py-2">
                          {isLow ? (
                            <span className="inline-flex items-center rounded-full bg-rose-500/15 border border-rose-500/30 px-2 py-1 text-xs font-semibold text-rose-200">
                              Stockout risk
                            </span>
                          ) : (
                            <span className="inline-flex items-center rounded-full bg-teal-500/10 border border-teal-500/20 px-2 py-1 text-xs font-semibold text-teal-200">
                              OK
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

