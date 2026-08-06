import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { Boxes, PackageSearch, ClipboardList, RefreshCw, AlertOctagon, CheckCircle2, Layers } from 'lucide-react';

import { errorMessage, isMlUnavailable } from '../lib/api';
import { loadGet } from '../lib/dataCache';
import { money, num, titleCase } from '../lib/format';
import { staggerParent, staggerChild } from '../lib/motion';
import { useTabParam } from '../hooks/useTabParam';

import { PageHeader } from '../components/layout/PageHeader';
import { Card, CardHeader } from '../components/ui/Surface';
import { StatCard } from '../components/ui/StatCard';
import { Button } from '../components/ui/Button';
import { SearchInput, Select } from '../components/ui/Field';
import { Tabs, SegmentedControl } from '../components/ui/Tabs';
import { DataTable } from '../components/ui/DataTable';
import { StockChip, stockBand, Badge, STOCK_OK_MIN } from '../components/ui/Badge';
import { EmptyState, MlOfflineState, NoResultsState } from '../components/ui/EmptyState';
import { AIBadge, AIThinking } from '../components/ui/AIState';
import { Glossary } from '../components/ui/Hint';

/**
 * Inventory — stock on hand, plus what the model says to do about it.
 *
 * Merges the owner/staff products table with the staff "restock guidance" panel
 * that used to live on a separate Operations page. Both answer the same
 * question, so they belong on the same screen.
 */

const TABS = ['stock', 'restock'];

const BAND_FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'ok', label: 'In stock' },
  { value: 'watch', label: 'Watch' },
  { value: 'low', label: 'Low' },
  { value: 'urgent', label: 'Urgent' },
  { value: 'depleted', label: 'Out' },
];

const RISK_TONE = { high: 'critical', medium: 'serious', low: 'warning' };

export function Inventory() {
  const [tab, setTab] = useTabParam('stock', TABS);

  const [products, setProducts] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [productsError, setProductsError] = useState('');

  const [risks, setRisks] = useState([]);
  const [loadingRisks, setLoadingRisks] = useState(true);
  const [risksMlDown, setRisksMlDown] = useState(false);

  const [query, setQuery] = useState('');
  const [band, setBand] = useState('all');
  const [category, setCategory] = useState('');
  const [riskLevel, setRiskLevel] = useState('all');

  const loadProducts = useCallback(async (force = false) => {
    setLoadingProducts(true);
    setProductsError('');
    try {
      const data = await loadGet('products', '/products', undefined, { force });
      setProducts(data?.products || []);
    } catch (err) {
      setProductsError(errorMessage(err, 'Could not load the product catalog'));
    } finally {
      setLoadingProducts(false);
    }
  }, []);

  const loadRisks = useCallback(async (force = false) => {
    setLoadingRisks(true);
    setRisksMlDown(false);
    try {
      const data = await loadGet('inventory:risk', '/insights/staff/inventory/risk', undefined, { force });
      setRisks(data?.risks || []);
    } catch (err) {
      setRisksMlDown(isMlUnavailable(err));
      setRisks([]);
    } finally {
      setLoadingRisks(false);
    }
  }, []);

  useEffect(() => {
    loadProducts();
    loadRisks();
  }, [loadProducts, loadRisks]);

  const categories = useMemo(
    () => [...new Set(products.map((product) => product.category).filter(Boolean))].sort(),
    [products]
  );

  const filteredProducts = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter((product) => {
      const matchesQuery =
        !q ||
        String(product.name || '').toLowerCase().includes(q) ||
        String(product.category || '').toLowerCase().includes(q);
      const matchesCategory = !category || product.category === category;
      const matchesBand = band === 'all' || stockBand(product.stock_quantity).key === band;
      return matchesQuery && matchesCategory && matchesBand;
    });
  }, [products, query, category, band]);

  const counts = useMemo(() => {
    const result = { ok: 0, watch: 0, low: 0, urgent: 0, depleted: 0, unknown: 0 };
    for (const product of products) result[stockBand(product.stock_quantity).key] += 1;
    return result;
  }, [products]);

  const needsAttention = counts.watch + counts.low + counts.urgent + counts.depleted;
  const stockValue = useMemo(
    () =>
      products.reduce(
        (sum, product) => sum + Number(product.price || 0) * Math.max(0, Number(product.stock_quantity || 0)),
        0
      ),
    [products]
  );

  const filteredRisks = useMemo(
    () => (riskLevel === 'all' ? risks : risks.filter((risk) => risk.risk_level === riskLevel)),
    [risks, riskLevel]
  );

  const riskCounts = useMemo(
    () =>
      risks.reduce(
        (acc, risk) => {
          acc[risk.risk_level] = (acc[risk.risk_level] || 0) + 1;
          return acc;
        },
        { high: 0, medium: 0, low: 0 }
      ),
    [risks]
  );

  return (
    <div>
      <PageHeader
        title="Inventory"
        description={`Stock on hand across your catalog, and where the model expects shortages. Anything under ${STOCK_OK_MIN} units gets a warning band.`}
        actions={
          <Button
            size="sm"
            icon={RefreshCw}
            onClick={() => {
              loadProducts(true);
              loadRisks(true);
            }}
            loading={loadingProducts || loadingRisks}
          >
            Refresh
          </Button>
        }
      />

      <motion.div variants={staggerParent} initial="initial" animate="animate" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Products"
          numericValue={products.length}
          format={(v) => num(Math.round(v))}
          icon={Boxes}
          loading={loadingProducts}
          accent
        />
        <StatCard
          label="Need attention"
          numericValue={needsAttention}
          format={(v) => num(Math.round(v))}
          icon={AlertOctagon}
          loading={loadingProducts}
          hint={`Below ${STOCK_OK_MIN} units in stock`}
        />
        <StatCard
          label="Out of stock"
          numericValue={counts.depleted}
          format={(v) => num(Math.round(v))}
          icon={AlertOctagon}
          loading={loadingProducts}
        />
        <StatCard
          label="Stock value"
          numericValue={stockValue}
          format={(v) => money(v, { compact: true })}
          icon={Layers}
          loading={loadingProducts}
          hint="Quantity on hand × unit price"
        />
      </motion.div>

      <div className="mt-6">
        <Tabs
          tabs={[
            { id: 'stock', label: 'Stock levels', icon: Boxes, count: products.length },
            { id: 'restock', label: 'What to restock', icon: ClipboardList, count: risks.length },
          ]}
          value={tab}
          onChange={setTab}
          layoutId="inventory-tabs"
        />
      </div>

      <div className="mt-4">
        {tab === 'stock' && (
          <Card animate={false}>
            <CardHeader
              title="Stock levels"
              description="Five bands from healthy down to out of stock, so urgency is visible at a glance."
              icon={Boxes}
            />

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <div className="min-w-[200px] flex-1">
                <SearchInput
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search by product or category…"
                />
              </div>
              <Select
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                size="sm"
                aria-label="Filter by category"
                className="w-auto min-w-[160px]"
              >
                <option value="">All categories</option>
                {categories.map((item) => (
                  <option key={item} value={item}>
                    {titleCase(item)}
                  </option>
                ))}
              </Select>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <SegmentedControl
                value={band}
                onChange={setBand}
                options={BAND_FILTERS.map((filter) => ({
                  ...filter,
                  label: filter.value === 'all' ? `All (${products.length})` : `${filter.label} (${counts[filter.value] || 0})`,
                }))}
                layoutId="stock-band-filter"
              />
            </div>

            <div className="mt-4">
              {loadingProducts ? (
                <DataTable columns={Array(5).fill({ key: 'x', header: '' })} rows={[]} loading />
              ) : productsError ? (
                <EmptyState title="Could not load inventory" description={productsError} action={loadProducts} actionLabel="Try again" />
              ) : !filteredProducts.length ? (
                query || category || band !== 'all' ? (
                  <NoResultsState
                    query={query}
                    onClear={() => {
                      setQuery('');
                      setCategory('');
                      setBand('all');
                    }}
                  />
                ) : (
                  <EmptyState icon={PackageSearch} title="No products yet" description="Your product catalog is empty." />
                )
              ) : (
                <DataTable
                  columns={[
                    {
                      key: 'name',
                      header: 'Product',
                      value: (row) => row.name,
                      render: (row) => <span className="font-medium text-ink">{titleCase(row.name)}</span>,
                    },
                    {
                      key: 'category',
                      header: 'Category',
                      value: (row) => row.category,
                      render: (row) => (row.category ? <Badge tone="neutral">{titleCase(row.category)}</Badge> : '—'),
                    },
                    {
                      key: 'price',
                      header: 'Price',
                      align: 'right',
                      value: (row) => Number(row.price || 0),
                      render: (row) => <span className="tabular">{money(row.price)}</span>,
                    },
                    {
                      key: 'stock_quantity',
                      header: 'In stock',
                      align: 'right',
                      value: (row) => Number(row.stock_quantity || 0),
                      render: (row) => (
                        <span className="font-semibold text-ink tabular">
                          {Number.isFinite(Number(row.stock_quantity))
                            ? Math.max(0, Math.floor(Number(row.stock_quantity)))
                            : '—'}
                        </span>
                      ),
                    },
                    {
                      key: 'band',
                      header: 'Status',
                      align: 'center',
                      value: (row) => Number(row.stock_quantity || 0),
                      render: (row) => <StockChip quantity={row.stock_quantity} />,
                    },
                  ]}
                  rows={filteredProducts}
                  rowKey={(row) => row.id}
                  maxHeight="36rem"
                  initialSort={{ key: 'stock_quantity', direction: 'asc' }}
                  caption="Product catalog with stock levels"
                />
              )}
            </div>
          </Card>
        )}

        {tab === 'restock' && (
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="lg:col-span-2">
              <Card animate={false} className="h-full">
                <CardHeader
                  title="Restock guidance"
                  description="Ranked by how likely each product is to run short, using predicted demand and how erratic its sales are."
                  icon={ClipboardList}
                  actions={<AIBadge />}
                />

                <div className="mt-4">
                  <SegmentedControl
                    value={riskLevel}
                    onChange={setRiskLevel}
                    options={[
                      { value: 'all', label: `All (${risks.length})` },
                      { value: 'high', label: `High (${riskCounts.high})` },
                      { value: 'medium', label: `Medium (${riskCounts.medium})` },
                      { value: 'low', label: `Low (${riskCounts.low})` },
                    ]}
                    layoutId="risk-filter"
                  />
                </div>

                <div className="mt-4">
                  {loadingRisks ? (
                    <AIThinking
                      title="Working out what to restock"
                      steps={[
                        'Contacting the model service',
                        'Forecasting demand per product',
                        'Measuring how volatile each product is',
                        'Ranking by shortage risk',
                      ]}
                    />
                  ) : risksMlDown ? (
                    <MlOfflineState what="Restock guidance" onRetry={loadRisks} />
                  ) : !filteredRisks.length ? (
                    <EmptyState
                      icon={CheckCircle2}
                      tone="honey"
                      title={risks.length ? 'Nothing at this risk level' : 'Nothing urgent right now'}
                      description={
                        risks.length
                          ? 'Try a different risk filter.'
                          : 'No product is currently predicted to run short.'
                      }
                    />
                  ) : (
                    <ul className="space-y-2.5">
                      {filteredRisks.map((risk) => (
                        <motion.li key={risk.product} variants={staggerChild} initial="initial" animate="animate">
                          <div className="rounded-xl border border-hairline/8 p-4 transition-colors hover:border-honey/25">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="text-[13.5px] font-semibold text-ink">{titleCase(risk.product)}</p>
                                {risk.category && (
                                  <p className="mt-0.5 text-[11.5px] text-ink-faint">{titleCase(risk.category)}</p>
                                )}
                              </div>
                              <Badge tone={RISK_TONE[risk.risk_level] || 'neutral'} icon={AlertOctagon}>
                                {risk.risk_level} risk
                              </Badge>
                            </div>

                            <p className="mt-2.5 text-[12.5px] leading-relaxed text-ink-soft">
                              {risk.staff_action?.message}
                            </p>

                            {risk.reasons?.length > 0 && (
                              <div className="mt-2.5 flex flex-wrap gap-1.5">
                                {risk.reasons.map((reason) => (
                                  <span
                                    key={reason}
                                    className="rounded-md bg-hairline/8 px-1.5 py-0.5 text-[10.5px] text-ink-muted"
                                  >
                                    {reason}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </motion.li>
                      ))}
                    </ul>
                  )}
                </div>
              </Card>
            </div>

            <Card animate={false}>
              <CardHeader title="How this is worked out" icon={PackageSearch} />
              <div className="mt-4 space-y-3 text-[12.5px] leading-relaxed text-ink-muted">
                <p>
                  Each product's <Glossary k="riskLevel">risk level</Glossary> comes from two things: how many
                  units the model expects to sell over the next five days, and how much its daily sales bounce
                  around.
                </p>
                <p>
                  Steady demand means you can plan a normal replenishment. Erratic demand means keeping buffer
                  stock and reordering more often, even at the same total volume.
                </p>
                <p>
                  Products with near-zero predicted demand are filtered out — flagging them would be noise
                  rather than a signal.
                </p>
              </div>

              <div className="mt-5 border-t border-hairline/8 pt-4">
                <p className="mb-2.5 text-[12px] font-medium text-ink-soft">Stock bands used on the other tab</p>
                <ul className="space-y-1.5">
                  {[
                    { quantity: 12, range: `${STOCK_OK_MIN} or more` },
                    { quantity: 8, range: '7 – 9' },
                    { quantity: 5, range: '4 – 6' },
                    { quantity: 2, range: '1 – 3' },
                    { quantity: 0, range: '0' },
                  ].map((entry) => (
                    <li key={entry.range} className="flex items-center justify-between gap-3">
                      <StockChip quantity={entry.quantity} />
                      <span className="text-[11.5px] text-ink-faint tabular">{entry.range}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}

export default Inventory;
