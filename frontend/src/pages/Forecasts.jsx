import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { TrendingUp, Search, ArrowRight, RefreshCw, Package, Layers } from 'lucide-react';

import { errorMessage, isMlUnavailable } from '../lib/api';
import { loadGet } from '../lib/dataCache';
import { num, titleCase } from '../lib/format';
import { staggerParent, staggerChild } from '../lib/motion';
import { useAuth } from '../context/AuthContext';

import { PageHeader } from '../components/layout/PageHeader';
import { Card, CardHeader } from '../components/ui/Surface';
import { StatCard } from '../components/ui/StatCard';
import { Button } from '../components/ui/Button';
import { SearchInput, Select } from '../components/ui/Field';
import { DataTable } from '../components/ui/DataTable';
import { EmptyState, MlOfflineState, NoResultsState } from '../components/ui/EmptyState';
import { AIBadge, AIThinking } from '../components/ui/AIState';
import { Badge } from '../components/ui/Badge';
import { HorizontalBars } from '../components/charts/Bars';
import { Glossary } from '../components/ui/Hint';

/**
 * Forecasts — the 5-day demand list.
 *
 * The old owner version was a bare scrolling table with no search, no sort and
 * no way to reach a product's detail. Every row is now a link into the deep
 * dive, and the same page serves owners and analysts rather than existing twice.
 */

const SORT_OPTIONS = [
  { value: 'ensemble_total', label: 'Highest predicted demand' },
  { value: 'product', label: 'Product name' },
  { value: 'mae', label: 'Best model accuracy' },
];

export function Forecasts() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [mlDown, setMlDown] = useState(false);
  const [query, setQuery] = useState('');
  const [sortBy, setSortBy] = useState('ensemble_total');
  const [limit, setLimit] = useState(50);

  const endpoint = user?.role === 'ANALYST' ? '/insights/analyst/forecasts' : '/insights/owner/forecasts';

  const load = useCallback(async (force = false) => {
    setLoading(true);
    setError('');
    setMlDown(false);

    try {
      const data = await loadGet(`forecasts:${endpoint}:${limit}:${sortBy}`, endpoint, { params: { limit, sort_by: sortBy } }, { force });
      setRows(data?.forecasts || []);
    } catch (primaryError) {
      // Fall back to the last persisted batch so the page still shows something
      // useful when the live model service is asleep.
      try {
        const snapshot = await loadGet('forecasts:latest', '/insights/owner/forecasts/latest');
        const mapped = (snapshot?.products || []).map((row) => ({
          product: row.product_name,
          category: row.category,
          ensemble_total_5d: row.ensemble_total_5d,
          fromSnapshot: true,
        }));
        if (mapped.length) {
          setRows(mapped.sort((a, b) => Number(b.ensemble_total_5d || 0) - Number(a.ensemble_total_5d || 0)));
          return;
        }
      } catch {
        /* no snapshot either */
      }

      setMlDown(isMlUnavailable(primaryError));
      setError(errorMessage(primaryError, 'Could not load forecasts'));
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [endpoint, limit, sortBy]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (row) =>
        String(row.product || '').toLowerCase().includes(q) ||
        String(row.category || '').toLowerCase().includes(q)
    );
  }, [rows, query]);

  const totals = useMemo(() => {
    const values = rows.map((row) => Number(row.ensemble_total_5d || 0)).filter(Number.isFinite);
    const sum = values.reduce((acc, value) => acc + value, 0);
    const categories = new Set(rows.map((row) => row.category).filter(Boolean));
    return { sum, count: values.length, categories: categories.size };
  }, [rows]);

  const usingSnapshot = rows.some((row) => row.fromSnapshot);

  const columns = [
    {
      key: 'product',
      header: 'Product',
      value: (row) => row.product,
      render: (row) => (
        <span className="font-medium text-ink">{titleCase(row.product)}</span>
      ),
    },
    {
      key: 'category',
      header: 'Category',
      value: (row) => row.category,
      render: (row) => (row.category ? <Badge tone="neutral">{titleCase(row.category)}</Badge> : '—'),
    },
    {
      key: 'ensemble_total_5d',
      header: '5-day forecast',
      align: 'right',
      value: (row) => Number(row.ensemble_total_5d || 0),
      render: (row) => (
        <span className="font-semibold text-ink tabular">{num(row.ensemble_total_5d)} units</span>
      ),
    },
    {
      key: 'open',
      header: '',
      sortable: false,
      align: 'right',
      width: 48,
      render: () => <ArrowRight size={14} className="inline text-ink-faint" aria-hidden="true" />,
    },
  ];

  return (
    <div>
      <PageHeader
        title="Demand forecasts"
        description="What the model expects each product to sell over the next five days. Select any row to see its accuracy and daily breakdown."
        actions={
          <Button size="sm" icon={RefreshCw} onClick={() => load(true)} loading={loading}>
            Refresh
          </Button>
        }
      />

      <motion.div variants={staggerParent} initial="initial" animate="animate" className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Products forecast"
          numericValue={totals.count}
          format={(v) => num(Math.round(v))}
          icon={Package}
          loading={loading}
          accent
        />
        <StatCard
          label="Combined 5-day demand"
          numericValue={totals.sum}
          format={(v) => `${num(Math.round(v))} units`}
          icon={TrendingUp}
          loading={loading}
          hint="Sum across every forecast product"
        />
        <StatCard
          label="Categories covered"
          numericValue={totals.categories}
          format={(v) => num(Math.round(v))}
          icon={Layers}
          loading={loading}
        />
      </motion.div>

      {usingSnapshot && (
        <Card className="mt-4 border-warn/25 bg-warn/6" animate={false}>
          <p className="text-[12.5px] text-ink-soft">
            The live model service is unavailable, so these figures come from the last saved forecast run.
            Start the ML service and refresh for current numbers.
          </p>
        </Card>
      )}

      <motion.div variants={staggerParent} initial="initial" animate="animate" className="mt-4 grid gap-4 lg:grid-cols-3">
        <motion.div variants={staggerChild} className="lg:col-span-2">
          <Card animate={false} className="h-full">
            <CardHeader
              title="All forecasts"
              description="Sorted by predicted demand. Search narrows by product or category."
              icon={TrendingUp}
              actions={<AIBadge />}
            />

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <div className="min-w-[200px] flex-1">
                <SearchInput
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search products or categories…"
                />
              </div>
              <Select
                value={sortBy}
                onChange={(event) => setSortBy(event.target.value)}
                size="sm"
                aria-label="Sort forecasts"
                className="w-auto min-w-[190px]"
              >
                {SORT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
              <Select
                value={limit}
                onChange={(event) => setLimit(Number(event.target.value))}
                size="sm"
                aria-label="Number of products"
                className="w-auto"
              >
                {[20, 50, 100, 200].map((value) => (
                  <option key={value} value={value}>
                    Top {value}
                  </option>
                ))}
              </Select>
            </div>

            <div className="mt-4">
              {loading ? (
                <AIThinking
                  title="Fetching forecasts"
                  steps={['Contacting the model service', 'Running each product’s ensemble', 'Ranking by predicted demand']}
                />
              ) : mlDown ? (
                <MlOfflineState what="Forecasts" onRetry={load} />
              ) : error ? (
                <EmptyState title="Could not load forecasts" description={error} action={load} actionLabel="Try again" />
              ) : !filtered.length ? (
                query ? (
                  <NoResultsState query={query} onClear={() => setQuery('')} />
                ) : (
                  <EmptyState
                    icon={Search}
                    title="No forecasts yet"
                    description="Reload the model from Data studio once sales data has been uploaded."
                  />
                )
              ) : (
                <DataTable
                  columns={columns}
                  rows={filtered}
                  rowKey={(row) => row.product}
                  maxHeight="30rem"
                  onRowClick={(row) => navigate(`/forecasts/${encodeURIComponent(row.product)}`)}
                  caption="Forecast demand by product for the next five days"
                  initialSort={{ key: 'ensemble_total_5d', direction: 'desc' }}
                />
              )}
            </div>
          </Card>
        </motion.div>

        <motion.div variants={staggerChild}>
          <Card animate={false} className="h-full">
            <CardHeader title="Top movers" description="The ten products with the highest predicted demand." icon={Package} />
            <div className="mt-4">
              {loading ? (
                <div className="space-y-3">
                  {Array.from({ length: 6 }).map((_, index) => (
                    <div key={index} className="skeleton h-7 w-full" />
                  ))}
                </div>
              ) : filtered.length ? (
                <HorizontalBars
                  data={[...filtered]
                    .sort((a, b) => Number(b.ensemble_total_5d || 0) - Number(a.ensemble_total_5d || 0))
                    .map((row) => ({ label: titleCase(row.product), value: Number(row.ensemble_total_5d || 0) }))}
                  formatValue={(v) => num(v)}
                  maxRows={10}
                />
              ) : (
                <p className="text-[13px] text-ink-muted">Nothing to rank yet.</p>
              )}
            </div>

            <div className="mt-5 border-t border-hairline/8 pt-4">
              <p className="text-[12px] leading-relaxed text-ink-muted">
                Each number blends two models — an{' '}
                <Glossary k="lstm">LSTM</Glossary> that learns recent patterns and a{' '}
                <Glossary k="seasonal">seasonal model</Glossary> that learns repeating cycles.
              </p>
            </div>
          </Card>
        </motion.div>
      </motion.div>
    </div>
  );
}

export default Forecasts;
