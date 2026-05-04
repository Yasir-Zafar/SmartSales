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
      cellTone: 'text-text-primary',
      qtyColor: 'text-text-muted',
      badgeClass:
        'inline-flex items-center rounded-full bg-gray-500/15 border border-surface-600/30 px-2 py-1 text-xs font-semibold text-text-secondary',
    };
  }
  const q = Math.max(0, Math.floor(n));

  if (q >= STOCK_OK_MIN) {
    return {
      key: 'ok',
      label: 'OK',
      rowBg: '',
      cellTone: 'text-text-primary',
      qtyColor: 'text-success',
      badgeClass:
        'inline-flex items-center rounded-full bg-accent/10 border border-success/25 px-2 py-1 text-xs font-semibold text-success',
    };
  }
  if (q >= 7) {
    return {
      key: 'watch',
      label: 'Watch',
      rowBg: 'bg-warning/5',
      cellTone: 'text-warning',
      qtyColor: 'text-warning',
      badgeClass:
        'inline-flex items-center rounded-full bg-warning/20 border border-warning/40 px-2 py-1 text-xs font-semibold text-warning',
    };
  }
  if (q >= 4) {
    return {
      key: 'low',
      label: 'Low',
      rowBg: 'bg-warning/10',
      cellTone: 'text-warning',
      qtyColor: 'text-warning',
      badgeClass:
        'inline-flex items-center rounded-full bg-warning/25 border border-warning/45 px-2 py-1 text-xs font-semibold text-warning',
    };
  }
  if (q >= 1) {
    return {
      key: 'urgent',
      label: 'Urgent',
      rowBg: 'bg-danger/5',
      cellTone: 'text-danger',
      qtyColor: 'text-danger',
      badgeClass:
        'inline-flex items-center rounded-full bg-danger/20 border border-danger/40 px-2 py-1 text-xs font-semibold text-danger',
    };
  }
  return {
    key: 'depleted',
    label: 'Depleted',
    rowBg: 'bg-danger/10',
    cellTone: 'text-danger',
    qtyColor: 'text-danger',
    badgeClass:
      'inline-flex items-center rounded-full bg-danger/30 border border-danger/55 px-2 py-1 text-xs font-semibold text-danger',
  };
}

export const OwnerInventory = () => {
  const [products, setProducts] = useState([]);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
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
    return products.filter((p) => {
      const name = String(p?.name || '').toLowerCase();
      const cat = String(p?.category || '').toLowerCase();
      const matchSearch = !q || name.includes(q) || cat.includes(q);
      if (statusFilter === 'all') return matchSearch;
      const band = stockBand(p?.stock_quantity);
      const matchStatus = band.key === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [products, query, statusFilter]);

  const belowOkCount = useMemo(
    () =>
      products.filter((p) => {
        const q = Number(p?.stock_quantity ?? 0);
        return Number.isFinite(q) && q < STOCK_OK_MIN;
      }).length,
    [products]
  );

  const LEGEND_ITEMS = [
    { key: 'ok', label: 'OK', className: stockBand(STOCK_OK_MIN).badgeClass },
    { key: 'watch', label: 'Watch (7–9)', className: stockBand(8).badgeClass },
    { key: 'low', label: 'Low (4–6)', className: stockBand(5).badgeClass },
    { key: 'urgent', label: 'Urgent (1–3)', className: stockBand(2).badgeClass },
    { key: 'depleted', label: 'Depleted (0)', className: stockBand(0).badgeClass },
  ];

  return (
    <div className="min-h-screen bg-surface-900 text-white">
      <Navbar />
      <div className="max-w-6xl mx-auto p-6">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
          <div>
            <h2 className="text-3xl font-bold text-text-primary">Inventory</h2>
            <p className="text-text-muted mt-1">
              Stock below {STOCK_OK_MIN} uses four warning levels (watch → depleted). Quantity 0 is the strongest alert.
            </p>
            <p className="text-sm text-text-muted mt-2">
              Showing <span className="text-text-primary font-semibold">{filtered.length}</span> products
              {belowOkCount ? (
                <>
                  {' '}
                  • <span className="text-warning font-semibold">{belowOkCount}</span> below target (
                  {`<${STOCK_OK_MIN}`})
                </>
              ) : null}
            </p>
          </div>

          <div className="w-full md:w-80">
            <label className="block text-sm text-text-secondary mb-1">Search</label>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Filter by name or category..."
              className="w-full border border-surface-700 rounded-md px-3 py-2 bg-surface-950 text-white"
            />
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2 items-center">
          <span className="text-xs text-text-faint uppercase tracking-wide">Filter:</span>
          <button
            onClick={() => setStatusFilter('all')}
            className={`text-xs px-2 py-1 rounded border transition ${statusFilter === 'all' ? 'bg-accent/20 text-accent border-accent/40' : 'bg-surface-700/50 text-text-muted border-surface-600/30 hover:border-accent/30'}`}
          >
            All
          </button>
          {LEGEND_ITEMS.map((item) => (
            <button
              key={item.key}
              onClick={() => setStatusFilter(item.key)}
              className={`text-xs px-2 py-1 rounded border transition ${statusFilter === item.key ? item.className.replace('rounded-full', 'rounded') + ' border-current' : 'bg-surface-700/50 text-text-muted border-surface-600/30 hover:border-accent/30'}`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="mt-4 bg-surface-800 border border-surface-700 rounded-xl p-5">
          {loading ? (
            <p className="text-text-muted">Loading inventory...</p>
          ) : error ? (
            <p className="text-danger">{error}</p>
          ) : filtered.length === 0 ? (
            <p className="text-text-muted">No products found.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-surface-700 text-sm">
                <thead className="text-left text-xs uppercase tracking-wide text-text-muted">
                  <tr>
                    <th className="px-3 py-2">Product</th>
                    <th className="px-3 py-2">Category</th>
                    <th className="px-3 py-2">Price</th>
                    <th className="px-3 py-2">Quantity</th>
                    <th className="px-3 py-2">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-700">
                  {filtered.map((p) => {
                    const band = stockBand(p?.stock_quantity);
                    const qn = Number(p?.stock_quantity ?? 0);
                    const displayQty = Number.isFinite(qn) ? Math.max(0, Math.floor(qn)) : '—';
                    return (
                      <tr
                        key={p.id}
                        className="hover:bg-surface-700/30"
                      >
                        <td className="px-3 py-2 text-text-primary">{p?.name || '—'}</td>
                        <td className="px-3 py-2 text-text-secondary">{p?.category || '—'}</td>
                        <td className="px-3 py-2 text-text-secondary">
                          ${Number(p?.price ?? 0).toFixed(2)}
                        </td>
                        <td className="px-3 py-2 font-semibold text-text-primary">{displayQty}</td>
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
