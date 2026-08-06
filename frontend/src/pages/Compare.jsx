import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, GitCompareArrows, RotateCcw, TrendingUp, TrendingDown, Minus, Filter } from 'lucide-react';

import { api, errorMessage } from '../lib/api';
import { money, num, titleCase, date } from '../lib/format';
import { staggerParent, staggerChild } from '../lib/motion';

import { PageHeader } from '../components/layout/PageHeader';
import { Card, CardHeader, Inset } from '../components/ui/Surface';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Field';
import { DataTable } from '../components/ui/DataTable';
import { EmptyState } from '../components/ui/EmptyState';
import { Skeleton } from '../components/ui/Skeleton';
import { SERIES } from '../components/charts/ChartFrame';
import { HorizontalBars } from '../components/charts/Bars';

/**
 * Compare two periods.
 *
 * The old version showed two independent tables and left the reader to do the
 * arithmetic. This one computes the deltas — that comparison is the entire
 * reason the page exists.
 */

function Delta({ current, previous, format = num, invert = false }) {
  const a = Number(current) || 0;
  const b = Number(previous) || 0;

  if (b === 0) {
    return <span className="text-[12px] text-ink-faint">no baseline</span>;
  }

  const change = ((a - b) / Math.abs(b)) * 100;
  const positive = invert ? change < 0 : change > 0;
  const flat = Math.abs(change) < 0.05;
  const Icon = flat ? Minus : change > 0 ? TrendingUp : TrendingDown;
  const tone = flat ? 'text-ink-muted' : positive ? 'text-good' : 'text-critical';

  return (
    <span className={`inline-flex items-center gap-1 text-[12px] font-semibold ${tone}`}>
      <Icon size={12} aria-hidden="true" />
      {change > 0 ? '+' : ''}
      {change.toFixed(1)}%
      <span className="font-normal text-ink-faint">({format(a - b)})</span>
    </span>
  );
}

const PERIOD_META = {
  a: { label: 'Period A', color: SERIES[0] },
  b: { label: 'Period B', color: SERIES[1] },
};

export function Compare() {
  const [ranges, setRanges] = useState({ aStart: '', aEnd: '', bStart: '', bEnd: '' });
  const [productFilter, setProductFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');

  const [results, setResults] = useState({ a: null, b: null });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const setRange = (key) => (event) => setRanges((current) => ({ ...current, [key]: event.target.value }));

  const fetchPeriod = async (startDate, endDate) => {
    const res = await api.get('/csv/records', {
      params: {
        sortBy: 'time',
        order: 'desc',
        startDate,
        endDate,
        product: productFilter ? [productFilter] : [],
        category: categoryFilter ? [categoryFilter] : [],
        // Both periods are reduced to totals and a ranked diff, so they need
        // every matching row; nothing here renders per-row.
        limit: 0,
      },
    });
    return res.data?.records || [];
  };

  const compare = async (event) => {
    event.preventDefault();
    const { aStart, aEnd, bStart, bEnd } = ranges;

    if (!aStart || !aEnd || !bStart || !bEnd) {
      setError('Pick a start and end date for both periods.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const [a, b] = await Promise.all([fetchPeriod(aStart, aEnd), fetchPeriod(bStart, bEnd)]);
      setResults({ a, b });
    } catch (err) {
      setError(errorMessage(err, 'Could not load the comparison'));
    } finally {
      setLoading(false);
    }
  };

  const reset = () => {
    setRanges({ aStart: '', aEnd: '', bStart: '', bEnd: '' });
    setProductFilter('');
    setCategoryFilter('');
    setResults({ a: null, b: null });
    setError('');
  };

  const summarise = (records) => {
    if (!records) return null;
    return {
      revenue: records.reduce((sum, row) => sum + parseFloat(row.total_price || 0), 0),
      units: records.reduce((sum, row) => sum + (row.quantity || 0), 0),
      transactions: new Set(records.map((row) => row.transaction_id)).size,
      products: new Set(records.map((row) => row.product_name)).size,
      rows: records.length,
    };
  };

  const summaryA = useMemo(() => summarise(results.a), [results.a]);
  const summaryB = useMemo(() => summarise(results.b), [results.b]);
  const hasResults = Boolean(summaryA && summaryB);

  /** Per-product revenue in both periods, ranked by the size of the swing. */
  const productShifts = useMemo(() => {
    if (!hasResults) return [];

    const totals = {};
    const add = (records, key) => {
      for (const row of records) {
        const name = row.product_name || 'Unknown';
        totals[name] = totals[name] || { product: name, a: 0, b: 0 };
        totals[name][key] += parseFloat(row.total_price || 0);
      }
    };
    add(results.a, 'a');
    add(results.b, 'b');

    return Object.values(totals)
      .map((entry) => ({ ...entry, change: entry.b - entry.a }))
      .sort((x, y) => Math.abs(y.change) - Math.abs(x.change))
      .slice(0, 12);
  }, [results, hasResults]);

  const METRICS = [
    { key: 'revenue', label: 'Revenue', format: (v) => money(v, { compact: true }), rawFormat: money },
    { key: 'units', label: 'Units sold', format: (v) => num(Math.round(v)), rawFormat: (v) => num(Math.round(v)) },
    { key: 'transactions', label: 'Transactions', format: (v) => num(Math.round(v)), rawFormat: (v) => num(Math.round(v)) },
    { key: 'products', label: 'Distinct products', format: (v) => num(Math.round(v)), rawFormat: (v) => num(Math.round(v)) },
  ];

  return (
    <div>
      <Link
        to="/sales"
        className="mb-4 inline-flex items-center gap-1.5 text-[12.5px] font-medium text-ink-muted transition-colors hover:text-honey"
      >
        <ArrowLeft size={13} /> Back to sales
      </Link>

      <PageHeader
        title="Compare two periods"
        description="Pick two date ranges and see exactly how much moved between them — not two tables side by side, but the difference itself."
      />

      <Card animate={false}>
        <CardHeader title="Choose your periods" icon={GitCompareArrows} />

        <form onSubmit={compare} className="mt-4 space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            {[
              { key: 'a', startKey: 'aStart', endKey: 'aEnd' },
              { key: 'b', startKey: 'bStart', endKey: 'bEnd' },
            ].map((period) => (
              <div
                key={period.key}
                className="rounded-xl border p-4"
                style={{ borderColor: `color-mix(in srgb, ${PERIOD_META[period.key].color} 30%, transparent)` }}
              >
                <div className="mb-3 flex items-center gap-2">
                  <span
                    className="h-2.5 w-2.5 rounded-[3px]"
                    style={{ background: PERIOD_META[period.key].color }}
                    aria-hidden="true"
                  />
                  <p className="text-[13px] font-semibold text-ink">{PERIOD_META[period.key].label}</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Input label="From" type="date" size="sm" value={ranges[period.startKey]} onChange={setRange(period.startKey)} />
                  <Input label="To" type="date" size="sm" value={ranges[period.endKey]} onChange={setRange(period.endKey)} />
                </div>
              </div>
            ))}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <Input
              label="Only this product (optional)"
              size="sm"
              value={productFilter}
              onChange={(event) => setProductFilter(event.target.value)}
              placeholder="e.g. banana"
            />
            <Input
              label="Only this category (optional)"
              size="sm"
              value={categoryFilter}
              onChange={(event) => setCategoryFilter(event.target.value)}
              placeholder="e.g. produce"
            />
          </div>

          {error && <p className="text-[12.5px] text-critical">{error}</p>}

          <div className="flex flex-wrap gap-2">
            <Button type="submit" variant="primary" size="sm" icon={Filter} loading={loading}>
              Compare
            </Button>
            <Button type="button" size="sm" icon={RotateCcw} onClick={reset}>
              Reset
            </Button>
          </div>
        </form>
      </Card>

      {loading && (
        <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-28 w-full" />
          ))}
        </div>
      )}

      {!loading && hasResults && (
        <>
          <motion.div
            variants={staggerParent}
            initial="initial"
            animate="animate"
            className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4"
          >
            {METRICS.map((metric) => (
              <motion.div key={metric.key} variants={staggerChild}>
                <Card animate={false} className="h-full">
                  <p className="text-2xs font-semibold uppercase tracking-[0.13em] text-ink-faint">{metric.label}</p>

                  <div className="mt-3 space-y-2">
                    {[
                      { period: 'a', value: summaryA[metric.key] },
                      { period: 'b', value: summaryB[metric.key] },
                    ].map((entry) => (
                      <div key={entry.period} className="flex items-center justify-between gap-3">
                        <span className="flex items-center gap-1.5 text-[11.5px] text-ink-muted">
                          <span
                            className="h-2 w-2 rounded-[2px]"
                            style={{ background: PERIOD_META[entry.period].color }}
                            aria-hidden="true"
                          />
                          {PERIOD_META[entry.period].label}
                        </span>
                        <span className="font-display text-[16px] font-semibold text-ink tabular">
                          {metric.format(entry.value)}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="mt-3 border-t border-hairline/8 pt-2.5">
                    <Delta current={summaryB[metric.key]} previous={summaryA[metric.key]} format={metric.rawFormat} />
                  </div>
                </Card>
              </motion.div>
            ))}
          </motion.div>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <Card animate={false}>
              <CardHeader
                title="Where revenue moved"
                description={`Products with the biggest swing between ${date(ranges.aStart)} – ${date(ranges.aEnd)} and ${date(ranges.bStart)} – ${date(ranges.bEnd)}.`}
                icon={GitCompareArrows}
              />
              <div className="mt-4">
                {productShifts.length ? (
                  <DataTable
                    dense
                    columns={[
                      {
                        key: 'product',
                        header: 'Product',
                        render: (row) => <span className="font-medium text-ink">{titleCase(row.product)}</span>,
                      },
                      {
                        key: 'a',
                        header: 'Period A',
                        align: 'right',
                        value: (row) => row.a,
                        render: (row) => <span className="tabular text-ink-muted">{money(row.a)}</span>,
                      },
                      {
                        key: 'b',
                        header: 'Period B',
                        align: 'right',
                        value: (row) => row.b,
                        render: (row) => <span className="tabular text-ink-muted">{money(row.b)}</span>,
                      },
                      {
                        key: 'change',
                        header: 'Change',
                        align: 'right',
                        value: (row) => row.change,
                        render: (row) => (
                          <span className={`font-semibold tabular ${row.change > 0 ? 'text-good' : row.change < 0 ? 'text-critical' : 'text-ink-muted'}`}>
                            {row.change > 0 ? '+' : ''}
                            {money(row.change)}
                          </span>
                        ),
                      },
                    ]}
                    rows={productShifts}
                    rowKey={(row) => row.product}
                    initialSort={{ key: 'change', direction: 'desc' }}
                    maxHeight="26rem"
                  />
                ) : (
                  <EmptyState title="Nothing to compare" description="Neither period returned any records." />
                )}
              </div>
            </Card>

            <Card animate={false}>
              <CardHeader title="Top products in each period" description="Ranked by revenue within that period." icon={TrendingUp} />
              <div className="mt-4 grid gap-6 sm:grid-cols-2">
                {[
                  { key: 'a', records: results.a },
                  { key: 'b', records: results.b },
                ].map((entry) => {
                  const byProduct = {};
                  for (const row of entry.records) {
                    const name = row.product_name || 'Unknown';
                    byProduct[name] = (byProduct[name] || 0) + parseFloat(row.total_price || 0);
                  }
                  const ranked = Object.entries(byProduct)
                    .map(([label, value]) => ({ label: titleCase(label), value }))
                    .sort((x, y) => y.value - x.value)
                    .slice(0, 5);

                  return (
                    <div key={entry.key}>
                      <p className="mb-3 flex items-center gap-1.5 text-[12px] font-semibold text-ink-soft">
                        <span
                          className="h-2 w-2 rounded-[2px]"
                          style={{ background: PERIOD_META[entry.key].color }}
                          aria-hidden="true"
                        />
                        {PERIOD_META[entry.key].label}
                      </p>
                      {ranked.length ? (
                        <HorizontalBars
                          data={ranked}
                          color={PERIOD_META[entry.key].color}
                          formatValue={(v) => money(v, { compact: true })}
                          maxRows={5}
                        />
                      ) : (
                        <p className="text-[12.5px] text-ink-muted">No sales in this period.</p>
                      )}
                    </div>
                  );
                })}
              </div>

              <Inset className="mt-5">
                <p className="text-[12px] leading-relaxed text-ink-muted">
                  Period A returned {num(summaryA.rows)} line items, Period B returned {num(summaryB.rows)}. Both
                  use the same product and category filters, so the comparison is like for like.
                </p>
              </Inset>
            </Card>
          </div>
        </>
      )}

      {!loading && !hasResults && (
        <Card className="mt-4" animate={false}>
          <EmptyState
            icon={GitCompareArrows}
            title="Pick two periods to begin"
            description="A common use is this month versus last month, or a promotion week versus the week before it."
          />
        </Card>
      )}
    </div>
  );
}

export default Compare;
