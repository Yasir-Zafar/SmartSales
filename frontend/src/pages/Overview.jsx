import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  Banknote,
  Boxes,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Package,
  Receipt,
  Siren,
  Sparkles,
  TrendingUp,
  Upload,
  Users,
  XCircle,
} from 'lucide-react';

import { api, errorMessage } from '../lib/api';
import { money, num, relativeTime, titleCase, date } from '../lib/format';
import { staggerParent, staggerChild } from '../lib/motion';
import { useAuth } from '../context/AuthContext';
import { usePdfExport } from '../hooks/usePdfExport';

import { PageHeader } from '../components/layout/PageHeader';
import { Card, CardHeader } from '../components/ui/Surface';
import { StatCard } from '../components/ui/StatCard';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { SkeletonStats, SkeletonText, Skeleton } from '../components/ui/Skeleton';
import { EmptyState, MlOfflineState } from '../components/ui/EmptyState';
import { AIBadge } from '../components/ui/AIState';
import { HorizontalBars } from '../components/charts/Bars';
import { LineArea } from '../components/charts/LineArea';

/**
 * Overview — one route, four dashboards.
 *
 * Previously /owner, /analyst, /staff and /admin were four separate pages that
 * each rebuilt a navbar, a stat row and a grid of navigation tiles. They are now
 * one route that renders the panels relevant to the signed-in role, so "home"
 * means the same thing to everyone.
 */

// ── Shared pieces ────────────────────────────────────────────────────────────

/** A next-step tile. Replaces the old grid of link-cards that duplicated the nav. */
function ActionTile({ to, icon: Icon, title, description, meta, tone = 'honey' }) {
  const tones = {
    honey: 'bg-honey/12 text-honey',
    series1: 'bg-series-1/12 text-series-1',
    series2: 'bg-series-2/12 text-series-2',
    series3: 'bg-series-3/12 text-series-3',
    critical: 'bg-critical/12 text-critical',
  };

  return (
    <motion.div variants={staggerChild}>
      <Link
        to={to}
        className="surface group flex h-full flex-col p-4 transition-[transform,border-color,box-shadow] duration-300 ease-smooth hover:-translate-y-0.5 hover:border-honey/28 hover:shadow-lift"
      >
        <div className="flex items-start gap-3">
          <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${tones[tone]}`}>
            <Icon size={16} aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[13.5px] font-semibold text-ink">{title}</p>
            <p className="mt-0.5 text-[12px] leading-relaxed text-ink-muted">{description}</p>
          </div>
          <ArrowRight
            size={14}
            className="mt-1 shrink-0 text-ink-faint transition-transform duration-300 group-hover:translate-x-0.5 group-hover:text-honey"
            aria-hidden="true"
          />
        </div>
        {meta && <div className="mt-3 border-t border-hairline/8 pt-3">{meta}</div>}
      </Link>
    </motion.div>
  );
}

/** Dismissible role-specific orientation. The single biggest learning-curve fix. */
function GettingStarted({ role }) {
  const storageKey = `smartsales:onboarded:${role}`;
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(storageKey) === 'true';
    } catch {
      return false;
    }
  });

  const steps = {
    OWNER: [
      'Check the headline numbers below — they refresh from your uploaded sales.',
      'Open Anomalies to set the drop threshold that decides what counts as a problem.',
      'Use Forecasts to see which products the model expects to move next.',
    ],
    ANALYST: [
      'Search a product in Forecasts to see its accuracy, confidence and trend driver.',
      'Anomalies shows what tripped the threshold and how often it happens.',
      'Data studio exports a training window and reloads the model with it.',
    ],
    STAFF: [
      'Upload today’s sales CSV from Data studio — everything else follows from it.',
      'Inventory tells you what to restock and how urgently.',
      'Customers looks up a shopper and suggests what to offer them.',
    ],
    ADMIN: [
      'Team is where you create accounts and assign roles.',
      'Changing a role or deactivating an account signs that person out immediately.',
      'You can see every other role’s pages for support purposes.',
    ],
  }[role];

  if (dismissed || !steps) return null;

  const dismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem(storageKey, 'true');
    } catch {
      /* non-fatal */
    }
  };

  return (
    <motion.div variants={staggerChild} className="mb-6">
      <Card className="border-honey/22 bg-honey/[0.04]" animate={false}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex gap-3">
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-honey/15 text-honey">
              <Sparkles size={15} aria-hidden="true" />
            </span>
            <div>
              <p className="text-[14px] font-semibold text-ink">Getting started as {role.toLowerCase()}</p>
              <ol className="mt-2.5 space-y-1.5">
                {steps.map((step, index) => (
                  <li key={step} className="flex gap-2.5 text-[12.5px] leading-relaxed text-ink-soft">
                    <span className="mt-px flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-honey/15 text-[10px] font-bold text-honey">
                      {index + 1}
                    </span>
                    {step}
                  </li>
                ))}
              </ol>
            </div>
          </div>
          <Button size="xs" variant="ghost" onClick={dismiss}>
            Got it
          </Button>
        </div>
      </Card>
    </motion.div>
  );
}

// ── Owner ────────────────────────────────────────────────────────────────────

function OwnerOverview() {
  const [kpis, setKpis] = useState(null);
  const [forecasts, setForecasts] = useState([]);
  const [risks, setRisks] = useState([]);
  const [anomalies, setAnomalies] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { exportRef, exportToPdf, exporting } = usePdfExport('smartsales-owner-overview.pdf');

  const load = useCallback(async () => {
    setError('');
    try {
      const [kpiRes, forecastRes] = await Promise.all([
        api.get('/insights/owner/kpis/live'),
        api.get('/insights/owner/forecasts/latest'),
      ]);
      setKpis(kpiRes.data);
      setForecasts(forecastRes.data?.products || []);
    } catch (err) {
      setError(errorMessage(err, 'Could not load your live figures'));
    } finally {
      setLoading(false);
    }

    // The two ML-backed panels fail independently — one being down should not
    // blank the whole dashboard.
    try {
      const riskRes = await api.get('/insights/staff/inventory/risk');
      setRisks(riskRes.data?.risks || []);
    } catch {
      setRisks([]);
    }
    try {
      const anomalyRes = await api.get('/insights/alerts/notifications/abnormal-drops', {
        params: { notify_owner: true },
      });
      setAnomalies(Number(anomalyRes.data?.count || 0));
    } catch {
      setAnomalies(0);
    }
  }, []);

  useEffect(() => {
    load();
    // Keeps the owner's figures live without a manual refresh.
    const timer = setInterval(load, 30_000);
    return () => clearInterval(timer);
  }, [load]);

  const k = kpis?.kpis;
  const highRisk = risks.filter((risk) => risk.risk_level === 'high');
  const topForecasts = useMemo(
    () =>
      [...forecasts]
        .sort((a, b) => (b.ensemble_total_5d || 0) - (a.ensemble_total_5d || 0))
        .slice(0, 6)
        .map((row) => ({ label: titleCase(row.product_name), value: Number(row.ensemble_total_5d || 0) })),
    [forecasts]
  );

  return (
    <div ref={exportRef}>
      <PageHeader
        title="Business overview"
        description="Live revenue, demand and risk across everything you have uploaded."
        actions={
          <Button size="sm" icon={Download} onClick={exportToPdf} loading={exporting}>
            Export PDF
          </Button>
        }
      />

      <GettingStarted role="OWNER" />

      {error && (
        <Card className="mb-6 border-critical/28 bg-critical/6" animate={false}>
          <p className="text-[13px] text-critical">{error}</p>
        </Card>
      )}

      {loading ? (
        <SkeletonStats count={4} />
      ) : (
        <motion.div variants={staggerParent} initial="initial" animate="animate" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Total revenue"
            numericValue={k?.total_revenue}
            format={(v) => money(v, { compact: true })}
            icon={Banknote}
            accent
            delta={k?.revenue_change_pct}
            deltaLabel={k?.revenue_change_pct != null ? 'vs previous month' : 'no previous month to compare'}
          />
          <StatCard
            label="Units sold"
            numericValue={k?.total_units_sold}
            format={(v) => num(Math.round(v))}
            icon={Package}
            hint="Across every uploaded sale"
          />
          <StatCard
            label="Active customers"
            numericValue={k?.active_customers}
            format={(v) => num(Math.round(v))}
            icon={Users}
            hint="Distinct customers on record"
          />
          <StatCard
            label="This month"
            numericValue={k?.current_month_revenue}
            format={(v) => money(v, { compact: true })}
            icon={TrendingUp}
            delta={k?.revenue_change_pct}
            deltaLabel="month over month"
          />
        </motion.div>
      )}

      {kpis?.anchored_latest_sale_date && (
        <p className="mt-3 text-[12px] text-ink-faint">
          Anchored to your latest sale date, {date(kpis.anchored_latest_sale_date)}
          {kpis.latest_upload_at ? ` · last upload ${relativeTime(kpis.latest_upload_at)}` : ''}
        </p>
      )}

      <motion.div variants={staggerParent} initial="initial" animate="animate" className="mt-6 grid items-start gap-4 lg:grid-cols-3">
        <motion.div variants={staggerChild} className="lg:col-span-2">
          <Card animate={false} className="h-full">
            <CardHeader
              title="Highest predicted demand"
              description="Units the model expects to sell over the next five days."
              icon={TrendingUp}
              actions={<AIBadge />}
            />
            <div className="mt-5">
              {loading ? (
                <SkeletonText lines={5} />
              ) : topForecasts.length ? (
                <HorizontalBars data={topForecasts} formatValue={(v) => `${num(v)} units`} maxRows={6} />
              ) : (
                <MlOfflineState what="Forecasts" onRetry={load} />
              )}
            </div>
            {topForecasts.length > 0 && (
              <Link
                to="/forecasts"
                className="mt-5 inline-flex items-center gap-1.5 text-[12.5px] font-medium text-honey hover:underline"
              >
                See all forecasts <ArrowRight size={13} />
              </Link>
            )}
          </Card>
        </motion.div>

        <motion.div variants={staggerChild} className="space-y-4">
          <Card animate={false}>
            <CardHeader title="Needs attention" description="Where to look first today." icon={Siren} />
            <div className="mt-4 space-y-2.5">
              <Link
                to="/anomalies"
                className="flex items-center justify-between gap-3 rounded-xl border border-hairline/8 p-3 transition-colors hover:border-critical/30 hover:bg-critical/5"
              >
                <span className="text-[13px] text-ink-soft">Products with abnormal drops</span>
                <Badge tone={anomalies > 0 ? 'critical' : 'good'} icon={anomalies > 0 ? Siren : CheckCircle2}>
                  {anomalies > 0 ? anomalies : 'None'}
                </Badge>
              </Link>

              <Link
                to="/inventory"
                className="flex items-center justify-between gap-3 rounded-xl border border-hairline/8 p-3 transition-colors hover:border-warn/30 hover:bg-warn/5"
              >
                <span className="text-[13px] text-ink-soft">High-risk stock items</span>
                <Badge tone={highRisk.length > 0 ? 'serious' : 'good'} icon={highRisk.length > 0 ? Boxes : CheckCircle2}>
                  {highRisk.length > 0 ? highRisk.length : 'Clear'}
                </Badge>
              </Link>
            </div>

            {highRisk.length > 0 && (
              <ul className="mt-4 space-y-1.5 border-t border-hairline/8 pt-4">
                {highRisk.slice(0, 4).map((item) => (
                  <li key={item.product} className="flex items-center justify-between gap-3 text-[12.5px]">
                    <span className="truncate text-ink-muted">{titleCase(item.product)}</span>
                    <span className="shrink-0 text-ink-faint tabular">{num(item.ensemble_total_5d)} est.</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <ActionTile
            to="/customers"
            icon={Users}
            title="Customer segments"
            description="See who your best customers are and what to offer them."
            tone="series1"
          />
        </motion.div>
      </motion.div>

      <motion.div variants={staggerParent} initial="initial" animate="animate" className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <ActionTile
          to="/sales"
          icon={Receipt}
          title="Sales explorer"
          description="Filter by category and date range, and estimate totals."
          tone="series3"
        />
        <ActionTile
          to="/sales/compare"
          icon={FileSpreadsheet}
          title="Compare periods"
          description="Put two date ranges side by side."
          tone="series2"
        />
        <ActionTile
          to="/inventory"
          icon={Boxes}
          title="Inventory"
          description="Stock levels with five warning bands and restock advice."
          tone="critical"
        />
      </motion.div>
    </div>
  );
}

// ── Analyst ──────────────────────────────────────────────────────────────────

function AnalystOverview() {
  const [topProducts, setTopProducts] = useState([]);
  const [segments, setSegments] = useState([]);
  const [anomalies, setAnomalies] = useState(0);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const [loadingSegments, setLoadingSegments] = useState(true);
  const [productsError, setProductsError] = useState('');
  const [segmentsFailed, setSegmentsFailed] = useState(false);

  const loadProducts = useCallback(async () => {
    setLoadingProducts(true);
    setProductsError('');
    try {
      const res = await api.get('/csv/records', { params: { sortBy: 'sales', order: 'desc' } });
      const totals = (res.data.records || []).reduce((acc, row) => {
        const name = row.product_name || 'Unknown';
        acc[name] = (acc[name] || 0) + (row.quantity || 0);
        return acc;
      }, {});
      setTopProducts(
        Object.entries(totals)
          .map(([label, value]) => ({ label: titleCase(label), value }))
          .sort((a, b) => b.value - a.value)
          .slice(0, 10)
      );
    } catch (err) {
      setProductsError(errorMessage(err, 'Could not load product sales'));
    } finally {
      setLoadingProducts(false);
    }
  }, []);

  const loadSegments = useCallback(async () => {
    setLoadingSegments(true);
    setSegmentsFailed(false);
    try {
      const res = await api.get('/insights/analyst/segments');
      setSegments(res.data?.segments || []);
    } catch {
      setSegmentsFailed(true);
      setSegments([]);
    } finally {
      setLoadingSegments(false);
    }
  }, []);

  useEffect(() => {
    loadProducts();
    loadSegments();
    api
      .get('/insights/alerts/notifications/abnormal-drops')
      .then((res) => setAnomalies(Number(res.data?.count || 0)))
      .catch(() => setAnomalies(0));
  }, [loadProducts, loadSegments]);

  const customersClassified = segments.reduce((sum, segment) => sum + Number(segment?.size || 0), 0);

  return (
    <div>
      <PageHeader
        title="Analyst overview"
        description="Model health, product volume and customer structure at a glance."
      />

      <GettingStarted role="ANALYST" />

      <motion.div variants={staggerParent} initial="initial" animate="animate" className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Active anomalies"
          numericValue={anomalies}
          format={(v) => num(Math.round(v))}
          icon={Siren}
          accent={anomalies > 0}
          hint="Products above the current drop threshold"
        />
        <StatCard
          label="Segments tracked"
          numericValue={segments.length}
          format={(v) => num(Math.round(v))}
          icon={Users}
          loading={loadingSegments}
          hint={customersClassified ? `${num(customersClassified)} customers classified` : 'Reload the model to segment'}
        />
        <StatCard
          label="Products analysed"
          numericValue={topProducts.length}
          format={(v) => num(Math.round(v))}
          icon={Package}
          loading={loadingProducts}
          hint="Top sellers by units in your data"
        />
      </motion.div>

      <motion.div variants={staggerParent} initial="initial" animate="animate" className="mt-4 grid items-start gap-4 lg:grid-cols-3">
        <motion.div variants={staggerChild} className="lg:col-span-2">
          <Card animate={false} className="h-full">
            <CardHeader
              title="Top 10 products by units sold"
              description="Straight from your uploaded sales — no model involved."
              icon={Package}
            />
            <div className="mt-5">
              {loadingProducts ? (
                <SkeletonText lines={6} />
              ) : productsError ? (
                <EmptyState title="Could not load product sales" description={productsError} action={loadProducts} actionLabel="Try again" />
              ) : topProducts.length ? (
                <HorizontalBars data={topProducts} formatValue={(v) => `${num(v)} units`} maxRows={10} />
              ) : (
                <EmptyState
                  icon={Upload}
                  title="No sales uploaded yet"
                  description="Once a staff member uploads a sales CSV, product volumes appear here."
                />
              )}
            </div>
          </Card>
        </motion.div>

        <motion.div variants={staggerChild} className="space-y-4">
          <Card animate={false}>
            <CardHeader title="Segment sizes" description="How your customer base splits." icon={Users} actions={<AIBadge />} />
            <div className="mt-4">
              {loadingSegments ? (
                <SkeletonText lines={4} />
              ) : segmentsFailed ? (
                <MlOfflineState what="Segments" onRetry={loadSegments} />
              ) : segments.length ? (
                <ul className="space-y-2">
                  {segments.map((segment) => (
                    <li key={segment.segment_id ?? segment.label} className="flex items-center justify-between gap-3 text-[12.5px]">
                      <span className="truncate text-ink-soft">{segment.label}</span>
                      <span className="shrink-0 font-semibold text-ink tabular">{num(segment.size)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState title="No segments yet" description="Reload the model from Data studio to build segments." />
              )}
            </div>
            <Link
              to="/customers"
              className="mt-4 inline-flex items-center gap-1.5 text-[12.5px] font-medium text-honey hover:underline"
            >
              Explore segments <ArrowRight size={13} />
            </Link>
          </Card>

          <ActionTile
            to="/forecasts"
            icon={TrendingUp}
            title="Forecast accuracy"
            description="Look up a product to see its MAE, RMSE and confidence."
            tone="series1"
          />
        </motion.div>
      </motion.div>

      <motion.div variants={staggerParent} initial="initial" animate="animate" className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <ActionTile to="/anomalies" icon={Siren} title="Anomaly analysis" description="Frequency over time and severity breakdown." tone="critical" />
        <ActionTile to="/sales" icon={Receipt} title="Sales records" description="Multi-filter query and CSV export." tone="series3" />
        <ActionTile to="/data" icon={FileSpreadsheet} title="Data studio" description="Export a training window and reload the model." tone="series2" />
      </motion.div>
    </div>
  );
}

// ── Staff ────────────────────────────────────────────────────────────────────

function StaffOverview() {
  const navigate = useNavigate();
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

  const chartData = useMemo(
    () =>
      (week?.dailyBreakdown || []).map((row) => ({
        label: row.date,
        revenue: Number(row.revenue || 0),
      })),
    [week]
  );

  return (
    <div>
      <PageHeader
        title="Today at a glance"
        description="What sold today, what sold this week, and what needs doing next."
        actions={
          <Button size="sm" variant="primary" icon={Upload} onClick={() => navigate('/data?tab=upload')}>
            Upload sales
          </Button>
        }
      />

      <GettingStarted role="STAFF" />

      {error && (
        <Card className="mb-6 border-critical/28 bg-critical/6" animate={false}>
          <p className="text-[13px] text-critical">{error}</p>
        </Card>
      )}

      {loading ? (
        <SkeletonStats count={3} />
      ) : (
        <motion.div variants={staggerParent} initial="initial" animate="animate" className="grid gap-4 sm:grid-cols-3">
          <StatCard
            label="Latest day revenue"
            numericValue={Number(today?.revenue || 0)}
            format={(v) => money(v)}
            icon={Banknote}
            accent
            hint={today?.date ? date(today.date) : undefined}
          />
          <StatCard
            label="7-day revenue"
            numericValue={Number(week?.revenue || 0)}
            format={(v) => money(v, { compact: true })}
            icon={TrendingUp}
            hint={week?.start_date ? `${date(week.start_date)} – ${date(week.end_date)}` : undefined}
          />
          <StatCard
            label="Transactions"
            numericValue={Number(today?.transactions || 0)}
            format={(v) => num(Math.round(v))}
            icon={Receipt}
            hint="On the latest day of sales"
          />
        </motion.div>
      )}

      <motion.div variants={staggerParent} initial="initial" animate="animate" className="mt-4 grid items-start gap-4 lg:grid-cols-3">
        <motion.div variants={staggerChild} className="lg:col-span-2">
          <Card animate={false} className="h-full">
            <CardHeader
              title="Revenue across the last 7 days"
              description="Hover any day for its exact takings."
              icon={TrendingUp}
            />
            <div className="mt-4">
              {loading ? (
                <Skeleton className="h-[220px] w-full" />
              ) : chartData.length ? (
                <LineArea
                  data={chartData}
                  series={[{ key: 'revenue', label: 'Revenue' }]}
                  height={230}
                  formatY={(v) => money(v, { compact: true })}
                  formatValue={(v) => money(v)}
                  formatLabel={(d) => date(d.label)}
                />
              ) : (
                <EmptyState icon={Upload} title="No sales in the last week" description="Upload a sales CSV to see the trend here." />
              )}
            </div>
          </Card>
        </motion.div>

        <motion.div variants={staggerChild}>
          <Card animate={false} className="h-full">
            <CardHeader title="Top items today" description="Ranked by revenue." icon={Package} />
            <div className="mt-4">
              {loading ? (
                <SkeletonText lines={5} />
              ) : today?.top_items?.length ? (
                <HorizontalBars
                  data={today.top_items.map((item) => ({
                    label: titleCase(item.product_name),
                    value: Number(item.revenue || 0),
                  }))}
                  formatValue={(v) => money(v)}
                  maxRows={5}
                />
              ) : (
                <EmptyState title="Nothing sold yet" description="Top items appear once the latest day has sales." />
              )}
            </div>
          </Card>
        </motion.div>
      </motion.div>

      <motion.div variants={staggerParent} initial="initial" animate="animate" className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <ActionTile to="/data?tab=upload" icon={Upload} title="Upload today's sales" description="Drop in the daily CSV — it is validated before anything is saved." />
        <ActionTile to="/inventory?tab=restock" icon={Boxes} title="What to restock" description="Model-ranked list of items at risk of running out." tone="critical" />
        <ActionTile to="/customers?tab=upsell" icon={Users} title="Customer lookup" description="Find a customer's segment and what to recommend." tone="series1" />
      </motion.div>
    </div>
  );
}

// ── Admin ────────────────────────────────────────────────────────────────────

function AdminOverview() {
  const [uploads, setUploads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/csv');
      setUploads(res.data?.uploads || []);
    } catch (err) {
      setError(errorMessage(err, 'Could not load upload history'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const processed = uploads.filter((upload) => upload.status === 'processed').length;
  const failed = uploads.filter((upload) => upload.status === 'failed').length;
  const totalRows = uploads.reduce((sum, upload) => sum + (upload.row_count || 0), 0);

  return (
    <div>
      <PageHeader
        title="Platform overview"
        description="Account administration plus a read-only view of every other role's data."
      />

      <GettingStarted role="ADMIN" />

      {error && (
        <Card className="mb-6 border-critical/28 bg-critical/6" animate={false}>
          <p className="text-[13px] text-critical">{error}</p>
        </Card>
      )}

      {loading ? (
        <SkeletonStats count={4} />
      ) : (
        <motion.div variants={staggerParent} initial="initial" animate="animate" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Total uploads" numericValue={uploads.length} format={(v) => num(Math.round(v))} icon={Upload} accent />
          <StatCard label="Processed" numericValue={processed} format={(v) => num(Math.round(v))} icon={CheckCircle2} />
          <StatCard label="Failed" numericValue={failed} format={(v) => num(Math.round(v))} icon={XCircle} />
          <StatCard label="Rows ingested" numericValue={totalRows} format={(v) => num(Math.round(v))} icon={FileSpreadsheet} />
        </motion.div>
      )}

      <motion.div variants={staggerParent} initial="initial" animate="animate" className="mt-4 grid items-start gap-4 lg:grid-cols-3">
        <motion.div variants={staggerChild} className="lg:col-span-2">
          <Card animate={false} className="h-full">
            <CardHeader
              title="Recent uploads"
              description="Every CSV ingestion, who ran it and whether it succeeded."
              icon={FileSpreadsheet}
              actions={
                <Link to="/data" className="text-[12.5px] font-medium text-honey hover:underline">
                  Full history
                </Link>
              }
            />
            <div className="mt-4">
              {loading ? (
                <SkeletonText lines={5} />
              ) : uploads.length ? (
                <ul className="divide-y divide-hairline/6">
                  {uploads.slice(0, 6).map((upload) => (
                    <li key={upload.id} className="flex items-center justify-between gap-3 py-2.5">
                      <div className="min-w-0">
                        <p className="truncate text-[13px] font-medium text-ink">{upload.file_name}</p>
                        <p className="text-[11.5px] text-ink-faint">
                          {date(upload.upload_date)} · {num(upload.row_count)} rows ·{' '}
                          {upload.profiles?.name || 'unknown uploader'}
                        </p>
                      </div>
                      <Badge
                        tone={upload.status === 'processed' ? 'good' : upload.status === 'failed' ? 'critical' : 'warning'}
                        icon={upload.status === 'processed' ? CheckCircle2 : XCircle}
                      >
                        {upload.status}
                      </Badge>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState title="No uploads yet" description="Upload history appears here once staff start adding sales data." />
              )}
            </div>
          </Card>
        </motion.div>

        <motion.div variants={staggerChild} className="space-y-4">
          <ActionTile to="/team?tab=invite" icon={Users} title="Create an account" description="Provision an owner, analyst or staff login." />
          <ActionTile to="/team?tab=manage" icon={Siren} title="Manage access" description="Change a role, reset a password, deactivate an account." tone="critical" />
          <ActionTile to="/forecasts" icon={TrendingUp} title="Inspect the model" description="Admins can see every role's insight pages." tone="series1" />
        </motion.div>
      </motion.div>
    </div>
  );
}

// ── Router ───────────────────────────────────────────────────────────────────

export function Overview() {
  const { user } = useAuth();

  switch (user?.role) {
    case 'OWNER':
      return <OwnerOverview />;
    case 'ANALYST':
      return <AnalystOverview />;
    case 'STAFF':
      return <StaffOverview />;
    case 'ADMIN':
      return <AdminOverview />;
    default:
      return (
        <EmptyState
          title="No role assigned"
          description="Your account has no role yet. Ask an administrator to assign one."
        />
      );
  }
}

export default Overview;
