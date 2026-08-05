import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Receipt,
  Banknote,
  Package,
  Download,
  Plus,
  X,
  Filter,
  RotateCcw,
  CalendarRange,
  GitCompareArrows,
  LayoutList,
} from 'lucide-react';

import { api, errorMessage } from '../lib/api';
import { money, num, titleCase, date, downloadBlob, toCsv } from '../lib/format';
import { staggerParent } from '../lib/motion';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useTabParam } from '../hooks/useTabParam';

import { PageHeader } from '../components/layout/PageHeader';
import { Card, CardHeader, Inset } from '../components/ui/Surface';
import { StatCard } from '../components/ui/StatCard';
import { Button, IconButton } from '../components/ui/Button';
import { Input, Select } from '../components/ui/Field';
import { Tabs } from '../components/ui/Tabs';
import { DataTable } from '../components/ui/DataTable';
import { Badge } from '../components/ui/Badge';
import { EmptyState } from '../components/ui/EmptyState';
import { Skeleton, SkeletonStats } from '../components/ui/Skeleton';
import { LineArea } from '../components/charts/LineArea';
import { HorizontalBars } from '../components/charts/Bars';
import { Glossary } from '../components/ui/Hint';

/**
 * Sales — the records explorer and the daily summary.
 *
 * Replaces three near-identical pages (owner sales summary, analyst sales
 * records, staff detailed summary). Which tabs appear depends on which
 * endpoints the signed-in role is actually allowed to call, so the UI never
 * offers something the API will refuse.
 */

// ── Repeatable filter rows (product / category / transaction) ────────────────

function FilterList({ label, values, onChange, placeholder }) {
  const update = (index, value) => onChange(values.map((v, i) => (i === index ? value : v)));
  const add = () => onChange([...values, '']);
  const remove = (index) => onChange(values.length > 1 ? values.filter((_, i) => i !== index) : ['']);

  return (
    <div className="space-y-2">
      <label className="block text-[13px] font-medium text-ink-soft">{label}</label>
      {values.map((value, index) => (
        <div key={index} className="flex gap-2">
          <Input
            value={value}
            onChange={(event) => update(index, event.target.value)}
            placeholder={placeholder}
            size="sm"
            className="flex-1"
          />
          {values.length > 1 && (
            <IconButton icon={X} label={`Remove ${label} filter`} size="sm" onClick={() => remove(index)} />
          )}
        </div>
      ))}
      <button
        type="button"
        onClick={add}
        className="inline-flex items-center gap-1 text-[12px] font-medium text-honey transition-opacity hover:opacity-80"
      >
        <Plus size={11} /> Add another
      </button>
    </div>
  );
}

// ── Records explorer (OWNER / ANALYST / ADMIN) ───────────────────────────────

function RecordsExplorer() {
  const toast = useToast();
  const navigate = useNavigate();

  const [records, setRecords] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [productFilters, setProductFilters] = useState(['']);
  const [categoryFilters, setCategoryFilters] = useState(['']);
  const [transactionFilters, setTransactionFilters] = useState(['']);
  const [category, setCategory] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [sortBy, setSortBy] = useState('time');
  const [order, setOrder] = useState('desc');
  const [showFilters, setShowFilters] = useState(false);

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/csv/records', {
        params: {
          sortBy,
          order,
          product: productFilters.filter(Boolean),
          category: [category, ...categoryFilters].filter(Boolean),
          transaction: transactionFilters.filter(Boolean),
          startDate: startDate || undefined,
          endDate: endDate || undefined,
        },
      });
      setRecords(res.data?.records || []);
    } catch (err) {
      setError(errorMessage(err, 'Could not load sales records'));
      setRecords([]);
    } finally {
      setLoading(false);
    }
  }, [sortBy, order, productFilters, categoryFilters, transactionFilters, category, startDate, endDate]);

  useEffect(() => {
    api
      .get('/csv/categories')
      .then((res) => setCategories(res.data?.categories || []))
      .catch(() => setCategories([]));
  }, []);

  // Sorting is a server round-trip, so it re-runs on change; the filter form is
  // explicit (Apply) because typing into six fields should not fire six queries.
  useEffect(() => {
    fetchRecords();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortBy, order]);

  /**
   * The old owner page hid these totals behind an "Estimate" button that
   * re-ran the same query. They are derived from whatever is on screen, so they
   * are simply always shown.
   */
  const totals = useMemo(() => {
    const revenue = records.reduce((sum, row) => sum + parseFloat(row.total_price || 0), 0);
    const units = records.reduce((sum, row) => sum + (row.quantity || 0), 0);
    const transactions = new Set(records.map((row) => row.transaction_id)).size;
    const products = new Set(records.map((row) => row.product_name)).size;
    return {
      revenue,
      units,
      transactions,
      products,
      averageUnitRevenue: units > 0 ? revenue / units : 0,
    };
  }, [records]);

  const trend = useMemo(() => {
    const byDate = {};
    for (const row of records) {
      const key = String(row.sale_date || '').slice(0, 10);
      if (!key) continue;
      byDate[key] = (byDate[key] || 0) + parseFloat(row.total_price || 0);
    }
    return Object.entries(byDate)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([label, revenue]) => ({ label, revenue }));
  }, [records]);

  const topProducts = useMemo(() => {
    const byProduct = {};
    for (const row of records) {
      const name = row.product_name || 'Unknown';
      byProduct[name] = (byProduct[name] || 0) + parseFloat(row.total_price || 0);
    }
    return Object.entries(byProduct)
      .map(([label, value]) => ({ label: titleCase(label), value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 8);
  }, [records]);

  const exportCsv = () => {
    if (!records.length) return;
    const csv = toCsv(
      ['Date', 'Transaction', 'Product', 'Category', 'Quantity', 'Unit price', 'Total'],
      records.map((row) => [
        row.sale_date,
        row.transaction_id,
        row.product_name,
        row.category,
        row.quantity,
        parseFloat(row.unit_price || 0).toFixed(2),
        parseFloat(row.total_price || 0).toFixed(2),
      ])
    );
    const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), `smartsales-records-${stamp}.csv`);
    toast.success('Export ready', `${num(records.length)} rows downloaded.`);
  };

  const resetFilters = () => {
    setProductFilters(['']);
    setCategoryFilters(['']);
    setTransactionFilters(['']);
    setCategory('');
    setStartDate('');
    setEndDate('');
  };

  const activeFilterCount =
    productFilters.filter(Boolean).length +
    categoryFilters.filter(Boolean).length +
    transactionFilters.filter(Boolean).length +
    (category ? 1 : 0) +
    (startDate ? 1 : 0) +
    (endDate ? 1 : 0);

  return (
    <div className="space-y-4">
      <motion.div variants={staggerParent} initial="initial" animate="animate" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Revenue"
          numericValue={totals.revenue}
          format={(v) => money(v, { compact: true })}
          icon={Banknote}
          accent
          loading={loading}
          hint={`${num(totals.products)} distinct products`}
        />
        <StatCard label="Units sold" numericValue={totals.units} format={(v) => num(Math.round(v))} icon={Package} loading={loading} />
        <StatCard label="Transactions" numericValue={totals.transactions} format={(v) => num(Math.round(v))} icon={Receipt} loading={loading} />
        <StatCard
          label="Revenue per unit"
          numericValue={totals.averageUnitRevenue}
          format={(v) => money(v)}
          icon={LayoutList}
          loading={loading}
          hint="Across the current selection"
        />
      </motion.div>

      <Card animate={false}>
        <CardHeader
          title="Filters"
          description="Narrow the result set. Every figure on this page reflects what is currently selected."
          icon={Filter}
          actions={
            <>
              {activeFilterCount > 0 && <Badge tone="honey">{activeFilterCount} active</Badge>}
              <Button size="sm" variant="ghost" onClick={() => setShowFilters((open) => !open)}>
                {showFilters ? 'Hide' : 'Show'}
              </Button>
            </>
          }
        />

        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Select
            label="Category"
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            size="sm"
          >
            <option value="">All categories</option>
            {categories.map((item) => (
              <option key={item} value={item}>
                {titleCase(item)}
              </option>
            ))}
          </Select>
          <Input label="From" type="date" size="sm" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
          <Input label="To" type="date" size="sm" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
          <div className="grid grid-cols-2 gap-2">
            <Select label="Sort by" value={sortBy} onChange={(event) => setSortBy(event.target.value)} size="sm">
              <option value="time">Date</option>
              <option value="name">Product</option>
              <option value="price">Total</option>
            </Select>
            <Select label="Order" value={order} onChange={(event) => setOrder(event.target.value)} size="sm">
              <option value="desc">Descending</option>
              <option value="asc">Ascending</option>
            </Select>
          </div>
        </div>

        {showFilters && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="mt-4 grid gap-4 overflow-hidden border-t border-hairline/8 pt-4 sm:grid-cols-3"
          >
            <FilterList label="Product name contains" values={productFilters} onChange={setProductFilters} placeholder="e.g. banana" />
            <FilterList label="Category contains" values={categoryFilters} onChange={setCategoryFilters} placeholder="e.g. dairy" />
            <FilterList label="Transaction ID contains" values={transactionFilters} onChange={setTransactionFilters} placeholder="e.g. TX-1042" />
          </motion.div>
        )}

        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant="primary" size="sm" icon={Filter} onClick={fetchRecords} loading={loading}>
            Apply filters
          </Button>
          <Button size="sm" icon={RotateCcw} onClick={resetFilters}>
            Reset
          </Button>
          <Button size="sm" icon={Download} onClick={exportCsv} disabled={!records.length}>
            Export {records.length ? `${num(records.length)} rows` : 'CSV'}
          </Button>
          <Button size="sm" variant="ghost" icon={GitCompareArrows} onClick={() => navigate('/sales/compare')}>
            Compare two periods
          </Button>
        </div>
      </Card>

      {records.length > 0 && (
        <div className="grid items-start gap-4 lg:grid-cols-3">
          <Card animate={false} className="lg:col-span-2">
            <CardHeader title="Revenue over the selected range" icon={Banknote} />
            <div className="mt-4">
              {trend.length > 1 ? (
                <LineArea
                  data={trend}
                  series={[{ key: 'revenue', label: 'Revenue' }]}
                  height={210}
                  formatY={(v) => money(v, { compact: true })}
                  formatValue={(v) => money(v)}
                  formatLabel={(d) => date(d.label)}
                />
              ) : (
                <p className="py-8 text-center text-[13px] text-ink-muted">
                  Select a wider date range to see a trend line.
                </p>
              )}
            </div>
          </Card>

          <Card animate={false}>
            <CardHeader title="Top products by revenue" icon={Package} />
            <div className="mt-4">
              <HorizontalBars data={topProducts} formatValue={(v) => money(v, { compact: true })} maxRows={8} />
            </div>
          </Card>
        </div>
      )}

      <Card animate={false}>
        <CardHeader
          title="Sales records"
          description={loading ? 'Loading…' : `${num(records.length)} rows match the current filters.`}
          icon={Receipt}
        />
        <div className="mt-4">
          {error ? (
            <EmptyState title="Could not load records" description={error} action={fetchRecords} actionLabel="Try again" />
          ) : !loading && !records.length ? (
            <EmptyState
              icon={Receipt}
              title="No records match"
              description="Widen the date range or clear a filter to see results."
              action={resetFilters}
              actionLabel="Reset filters"
            />
          ) : (
            <DataTable
              loading={loading}
              columns={[
                { key: 'sale_date', header: 'Date', value: (row) => row.sale_date, render: (row) => date(row.sale_date) },
                {
                  key: 'transaction_id',
                  header: 'Transaction',
                  className: 'font-mono text-[11.5px] text-ink-faint',
                },
                {
                  key: 'product_name',
                  header: 'Product',
                  render: (row) => <span className="font-medium text-ink">{titleCase(row.product_name)}</span>,
                },
                {
                  key: 'category',
                  header: 'Category',
                  render: (row) => (row.category ? titleCase(row.category) : '—'),
                },
                {
                  key: 'quantity',
                  header: 'Qty',
                  align: 'right',
                  value: (row) => Number(row.quantity || 0),
                  render: (row) => <span className="tabular">{num(row.quantity)}</span>,
                },
                {
                  key: 'unit_price',
                  header: 'Unit price',
                  align: 'right',
                  value: (row) => Number(row.unit_price || 0),
                  render: (row) => <span className="tabular text-ink-muted">{money(row.unit_price)}</span>,
                },
                {
                  key: 'total_price',
                  header: 'Total',
                  align: 'right',
                  value: (row) => Number(row.total_price || 0),
                  render: (row) => <span className="font-semibold text-ink tabular">{money(row.total_price)}</span>,
                },
              ]}
              rows={records}
              rowKey={(row, index) => `${row.transaction_id}-${row.product_id}-${index}`}
              maxHeight="38rem"
              dense
              caption="Individual sales line items"
            />
          )}
        </div>
      </Card>
    </div>
  );
}

// ── Daily summary (STAFF / ADMIN) ────────────────────────────────────────────

function DailySummary() {
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/insights/staff/sales-summary');
      setSummary(res.data);
    } catch (err) {
      setError(errorMessage(err, 'Could not load the sales summary'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const today = summary?.today;
  const week = summary?.week;
  const daily = useMemo(
    () => (week?.dailyBreakdown || []).map((row) => ({ label: row.date, revenue: Number(row.revenue || 0) })),
    [week]
  );

  if (error) {
    return (
      <Card animate={false}>
        <EmptyState title="Could not load the summary" description={error} action={load} actionLabel="Try again" />
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {loading ? (
        <SkeletonStats count={4} />
      ) : (
        <motion.div variants={staggerParent} initial="initial" animate="animate" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Latest day revenue"
            numericValue={Number(today?.revenue || 0)}
            format={(v) => money(v)}
            icon={Banknote}
            accent
            hint={today?.date ? date(today.date) : undefined}
          />
          <StatCard
            label="Latest day transactions"
            numericValue={Number(today?.transactions || 0)}
            format={(v) => num(Math.round(v))}
            icon={Receipt}
          />
          <StatCard
            label="7-day revenue"
            numericValue={Number(week?.revenue || 0)}
            format={(v) => money(v, { compact: true })}
            icon={Banknote}
          />
          <StatCard
            label="7-day transactions"
            numericValue={Number(week?.transactions || 0)}
            format={(v) => num(Math.round(v))}
            icon={Receipt}
            hint={week?.start_date ? `${date(week.start_date)} – ${date(week.end_date)}` : undefined}
          />
        </motion.div>
      )}

      {summary?.source?.anchor_date && (
        <Inset className="flex flex-wrap items-center gap-2 text-[12px] text-ink-muted">
          <CalendarRange size={13} className="shrink-0" aria-hidden="true" />
          <span>
            Figures are anchored to your most recent <Glossary k="anchorDate">sale date</Glossary>,{' '}
            {date(summary.source.anchor_date)} — not today's calendar date.
          </span>
        </Inset>
      )}

      <Card animate={false}>
        <CardHeader title="Revenue across the last 7 days" description="Hover any point for that day's takings." icon={Banknote} />
        <div className="mt-4">
          {loading ? (
            <Skeleton className="h-[230px] w-full" />
          ) : daily.length ? (
            <LineArea
              data={daily}
              series={[{ key: 'revenue', label: 'Revenue' }]}
              height={240}
              formatY={(v) => money(v, { compact: true })}
              formatValue={(v) => money(v)}
              formatLabel={(d) => date(d.label)}
            />
          ) : (
            <EmptyState title="No daily data" description="Upload sales to see the weekly trend." />
          )}
        </div>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {[
          { title: 'Top items — latest day', items: today?.top_items, empty: 'Nothing sold on the latest day.' },
          { title: 'Top items — last 7 days', items: week?.top_items, empty: 'No sales in the last seven days.' },
        ].map((panel) => (
          <Card key={panel.title} animate={false}>
            <CardHeader title={panel.title} description="Ranked by revenue." icon={Package} />
            <div className="mt-4">
              {loading ? (
                <Skeleton className="h-40 w-full" />
              ) : panel.items?.length ? (
                <DataTable
                  dense
                  columns={[
                    {
                      key: 'product_name',
                      header: 'Product',
                      render: (row) => <span className="font-medium text-ink">{titleCase(row.product_name)}</span>,
                    },
                    {
                      key: 'quantity',
                      header: 'Units',
                      align: 'right',
                      value: (row) => Number(row.quantity || 0),
                      render: (row) => <span className="tabular">{num(row.quantity)}</span>,
                    },
                    {
                      key: 'revenue',
                      header: 'Revenue',
                      align: 'right',
                      value: (row) => Number(row.revenue || 0),
                      render: (row) => <span className="font-semibold text-ink tabular">{money(row.revenue)}</span>,
                    },
                  ]}
                  rows={panel.items}
                  rowKey={(row) => row.product_name}
                />
              ) : (
                <EmptyState title="Nothing to show" description={panel.empty} />
              )}
            </div>
          </Card>
        ))}
      </div>

      <Card animate={false}>
        <CardHeader title="Day by day" description="Every day in the current seven-day window." icon={CalendarRange} />
        <div className="mt-4">
          <DataTable
            loading={loading}
            columns={[
              { key: 'date', header: 'Date', render: (row) => date(row.date) },
              {
                key: 'revenue',
                header: 'Revenue',
                align: 'right',
                value: (row) => Number(row.revenue || 0),
                render: (row) => <span className="font-semibold text-ink tabular">{money(row.revenue)}</span>,
              },
              {
                key: 'transactions',
                header: 'Transactions',
                align: 'right',
                value: (row) => Number(row.transactions || 0),
                render: (row) => <span className="tabular">{num(row.transactions)}</span>,
              },
            ]}
            rows={week?.dailyBreakdown || []}
            rowKey={(row) => row.date}
            empty={<EmptyState title="No daily breakdown" description="Upload sales data to populate this." />}
          />
        </div>
      </Card>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export function Sales() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const role = user?.role;

  // Tabs mirror endpoint permissions exactly: /csv/records is owner/analyst/admin,
  // /insights/staff/sales-summary is staff/admin.
  const canExplore = ['OWNER', 'ANALYST', 'ADMIN'].includes(role);
  const canSummarise = ['STAFF', 'ADMIN'].includes(role);

  const availableTabs = [
    ...(canSummarise ? [{ id: 'summary', label: 'Daily summary', icon: CalendarRange }] : []),
    ...(canExplore ? [{ id: 'explorer', label: 'Records explorer', icon: Receipt }] : []),
  ];

  const [tab, setTab] = useTabParam(availableTabs[0]?.id || 'summary', availableTabs.map((t) => t.id));

  if (!availableTabs.length) {
    return (
      <div>
        <PageHeader title="Sales" />
        <Card animate={false}>
          <EmptyState title="No sales views for your role" description="Ask an administrator if you need access." />
        </Card>
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="Sales"
        description={
          tab === 'summary'
            ? 'What sold on the most recent day of data, and across the seven days before it.'
            : 'Query every sales line item, see the totals update as you filter, and export the result.'
        }
        actions={
          canExplore && (
            <Button size="sm" icon={GitCompareArrows} onClick={() => navigate('/sales/compare')}>
              Compare periods
            </Button>
          )
        }
      />

      {availableTabs.length > 1 && (
        <div className="mb-4">
          <Tabs tabs={availableTabs} value={tab} onChange={setTab} layoutId="sales-tabs" />
        </div>
      )}

      {tab === 'summary' ? <DailySummary /> : <RecordsExplorer />}
    </div>
  );
}

export default Sales;
