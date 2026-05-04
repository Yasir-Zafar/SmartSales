import React, { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { Navbar } from '../components/Navbar';

const API_URL = 'http://localhost:5000/api';

/** Stock at or above this is considered healthy (no warning). */
const STOCK_OK_MIN = 10;

/**
 * Below STOCK_OK_MIN, four bands down to zero (mildest → max warning).
 * 7–9, 4–6, 1–3, 0
 */
function stockBand(qtyRaw) {
  const n = Number(qtyRaw);
  if (!Number.isFinite(n)) {
    return {
      key: 'unknown',
      label: 'Unknown',
      rowBg: '',
      cellTone: 'text-gray-200',
      qtyColor: 'text-gray-400',
      badgeClass:
        'inline-flex items-center rounded-full bg-gray-500/15 border border-gray-500/30 px-2 py-1 text-xs font-semibold text-gray-300',
    };
  }
  const q = Math.max(0, Math.floor(n));

  if (q >= STOCK_OK_MIN) {
    return {
      key: 'ok',
      label: 'OK',
      rowBg: '',
      cellTone: 'text-gray-200',
      qtyColor: 'text-teal-300',
      badgeClass:
        'inline-flex items-center rounded-full bg-teal-500/10 border border-teal-500/25 px-2 py-1 text-xs font-semibold text-teal-200',
    };
  }
  if (q >= 7) {
    return {
      key: 'watch',
      label: 'Watch',
      rowBg: 'bg-amber-950/35',
      cellTone: 'text-amber-100',
      qtyColor: 'text-amber-300',
      badgeClass:
        'inline-flex items-center rounded-full bg-amber-500/20 border border-amber-400/40 px-2 py-1 text-xs font-semibold text-amber-100',
    };
  }
  if (q >= 4) {
    return {
      key: 'low',
      label: 'Low',
      rowBg: 'bg-orange-950/40',
      cellTone: 'text-orange-100',
      qtyColor: 'text-orange-300',
      badgeClass:
        'inline-flex items-center rounded-full bg-orange-500/20 border border-orange-400/45 px-2 py-1 text-xs font-semibold text-orange-100',
    };
  }
  if (q >= 1) {
    return {
      key: 'urgent',
      label: 'Urgent',
      rowBg: 'bg-rose-950/45',
      cellTone: 'text-rose-100',
      qtyColor: 'text-rose-300',
      badgeClass:
        'inline-flex items-center rounded-full bg-rose-500/25 border border-rose-400/50 px-2 py-1 text-xs font-semibold text-rose-100',
    };
  }
  return {
    key: 'depleted',
    label: 'Depleted',
    rowBg: 'bg-red-950/55',
    cellTone: 'text-red-100',
    qtyColor: 'text-red-400',
    badgeClass:
      'inline-flex items-center rounded-full bg-red-600/30 border border-red-500/55 px-2 py-1 text-xs font-semibold text-red-50',
  };
}

const LEGEND = [
  { label: 'OK', className: stockBand(STOCK_OK_MIN).badgeClass },
  { label: 'Watch (7–9)', className: stockBand(8).badgeClass },
  { label: 'Low (4–6)', className: stockBand(5).badgeClass },
  { label: 'Urgent (1–3)', className: stockBand(2).badgeClass },
  { label: 'Depleted (0)', className: stockBand(0).badgeClass },
];

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

  const belowOkCount = useMemo(
    () =>
      filtered.filter((p) => {
        const q = Number(p?.stock_quantity ?? 0);
        return Number.isFinite(q) && q < STOCK_OK_MIN;
      }).length,
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
              Stock below {STOCK_OK_MIN} uses four warning levels (watch → depleted). Quantity 0 is the strongest alert.
            </p>
            <p className="text-sm text-gray-400 mt-2">
              Showing <span className="text-teal-300 font-semibold">{filtered.length}</span> products
              {belowOkCount ? (
                <>
                  {' '}
                  • <span className="text-amber-200 font-semibold">{belowOkCount}</span> below target (
                  {`<${STOCK_OK_MIN}`})
                </>
              ) : null}
            </p>
            <div className="mt-3 flex flex-wrap gap-2 items-center">
              <span className="text-xs text-gray-500 uppercase tracking-wide">Legend</span>
              {LEGEND.map((item) => (
                <span key={item.label} className={item.className}>
                  {item.label}
                </span>
              ))}
            </div>
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
                    const band = stockBand(p?.stock_quantity);
                    const qn = Number(p?.stock_quantity ?? 0);
                    const displayQty = Number.isFinite(qn) ? Math.max(0, Math.floor(qn)) : '—';
                    return (
                      <tr
                        key={p.id}
                        className={['hover:bg-gray-700/30', band.rowBg].filter(Boolean).join(' ')}
                      >
                        <td className={['px-3 py-2', band.cellTone].join(' ')}>{p?.name || '—'}</td>
                        <td className={['px-3 py-2 opacity-95', band.cellTone].join(' ')}>{p?.category || '—'}</td>
                        <td className={['px-3 py-2', band.cellTone].join(' ')}>
                          ${Number(p?.price ?? 0).toFixed(2)}
                        </td>
                        <td className={['px-3 py-2 font-semibold', band.qtyColor].join(' ')}>{displayQty}</td>
                        <td className="px-3 py-2">
                          <span className={band.badgeClass}>{band.label}</span>
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
