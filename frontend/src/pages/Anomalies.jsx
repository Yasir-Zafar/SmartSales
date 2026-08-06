import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Siren,
  ListFilter,
  History,
  ShieldAlert,
  RefreshCw,
  Save,
  RotateCcw,
  CheckCircle2,
  TrendingDown,
  Banknote,
} from 'lucide-react';

import { api, errorMessage, isMlUnavailable } from '../lib/api';
import { loadGet, invalidate } from '../lib/dataCache';
import { money, num, titleCase, date } from '../lib/format';
import { staggerParent, staggerChild } from '../lib/motion';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useTabParam } from '../hooks/useTabParam';

import { PageHeader } from '../components/layout/PageHeader';
import { Card, CardHeader, Inset } from '../components/ui/Surface';
import { StatCard } from '../components/ui/StatCard';
import { Button } from '../components/ui/Button';
import { Input, SearchInput } from '../components/ui/Field';
import { Tabs, SegmentedControl } from '../components/ui/Tabs';
import { DataTable } from '../components/ui/DataTable';
import { SeverityChip, Badge } from '../components/ui/Badge';
import { EmptyState, MlOfflineState, NoResultsState } from '../components/ui/EmptyState';
import { AIBadge, AIThinking } from '../components/ui/AIState';
import { VerticalBars } from '../components/charts/Bars';
import { Glossary } from '../components/ui/Hint';

/**
 * Anomalies — one home for everything alert-shaped.
 *
 * This merges four screens that used to be scattered across two roles: the
 * owner's threshold page, the analyst's frequency chart, the shared dropped-status
 * table, and the revenue-threshold guard — which had working endpoints but no UI
 * at all until now.
 */

const TABS = ['active', 'status', 'history', 'revenue'];

const TIMEFRAMES = [
  { value: '1h', label: '1h' },
  { value: '24h', label: '24h' },
  { value: '7d', label: '7d' },
  { value: '30d', label: '30d' },
];

const TIMEFRAME_MS = {
  '1h': 60 * 60 * 1000,
  '24h': 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
  '30d': 30 * 24 * 60 * 60 * 1000,
};

export function Anomalies() {
  const { user } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [tab, setTab] = useTabParam('active', TABS);

  const isOwnerLike = ['OWNER', 'ADMIN'].includes(user?.role);

  const [alerts, setAlerts] = useState([]);
  const [statuses, setStatuses] = useState([]);
  const [history, setHistory] = useState([]);
  const [threshold, setThreshold] = useState(20);
  const [thresholdInput, setThresholdInput] = useState('20');
  const [savingThreshold, setSavingThreshold] = useState(false);

  const [revenue, setRevenue] = useState(null);
  const [revenueInput, setRevenueInput] = useState('');
  const [savingRevenue, setSavingRevenue] = useState(false);

  const [loading, setLoading] = useState(true);
  const [mlDown, setMlDown] = useState(false);
  const [error, setError] = useState('');

  const [severityFilter, setSeverityFilter] = useState('all');
  const [statusQuery, setStatusQuery] = useState('');
  const [timeframe, setTimeframe] = useState('24h');

  const load = useCallback(async (force = false) => {
    setLoading(true);
    setError('');
    setMlDown(false);

    try {
      const [alertsData, statusData, historyData] = await Promise.all([
        loadGet('anomalies:active', '/insights/alerts/notifications/abnormal-drops', {
          params: isOwnerLike ? { notify_owner: true } : undefined,
        }, { force }),
        loadGet('anomalies:status', '/insights/alerts/dropped-status', undefined, { force }),
        loadGet('anomalies:history', '/insights/alerts/history/abnormal-drops', { params: { limit: 2000 } }, { force }),
      ]);

      setAlerts(alertsData?.alerts || []);
      setStatuses(statusData?.statuses || []);
      setHistory(historyData?.history || []);
    } catch (err) {
      setMlDown(isMlUnavailable(err));
      setError(errorMessage(err, 'Could not load anomaly data'));
    } finally {
      setLoading(false);
    }

    if (isOwnerLike) {
      try {
        const res = await api.get('/insights/owner/alerts/abnormal-drops/thresholds');
        const value = res.data?.thresholds?.threshold_pct ?? 20;
        setThreshold(value);
        setThresholdInput(String(value));
      } catch {
        /* threshold panel just shows its default */
      }
    }
  }, [isOwnerLike]);

  const loadRevenue = useCallback(async () => {
    if (!isOwnerLike) return;
    try {
      const [alertRes, configRes] = await Promise.all([
        api.get('/insights/owner/alerts/revenue-threshold'),
        api.get('/insights/owner/alerts/revenue-threshold/threshold'),
      ]);
      setRevenue(alertRes.data);
      setRevenueInput(String(configRes.data?.threshold ?? ''));
    } catch {
      setRevenue(null);
    }
  }, [isOwnerLike]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (tab === 'revenue') loadRevenue();
  }, [tab, loadRevenue]);

  const saveThreshold = async () => {
    setSavingThreshold(true);
    try {
      await api.put('/insights/owner/alerts/abnormal-drops/thresholds', {
        threshold_pct: Number(thresholdInput),
      });
      toast.success('Threshold updated', `Products are flagged once they drop ${thresholdInput}% below baseline.`);
      invalidate('anomalies:');
      await load(true);
    } catch (err) {
      toast.error('Could not save the threshold', errorMessage(err));
    } finally {
      setSavingThreshold(false);
    }
  };

  const resetThreshold = async () => {
    setSavingThreshold(true);
    try {
      await api.delete('/insights/owner/alerts/abnormal-drops/thresholds');
      toast.info('Threshold reset', 'Back to the 20% default.');
      invalidate('anomalies:');
      await load(true);
    } catch (err) {
      toast.error('Could not reset the threshold', errorMessage(err));
    } finally {
      setSavingThreshold(false);
    }
  };

  const saveRevenueThreshold = async () => {
    setSavingRevenue(true);
    try {
      await api.put('/insights/owner/alerts/revenue-threshold/threshold', {
        threshold: Number(revenueInput),
      });
      toast.success('Revenue guard updated', `You will be warned below ${money(Number(revenueInput))}.`);
      await loadRevenue();
    } catch (err) {
      toast.error('Could not save the revenue guard', errorMessage(err));
    } finally {
      setSavingRevenue(false);
    }
  };

  const resetRevenueThreshold = async () => {
    setSavingRevenue(true);
    try {
      await api.delete('/insights/owner/alerts/revenue-threshold/threshold');
      toast.info('Revenue guard reset', 'Back to the default value.');
      await loadRevenue();
    } catch (err) {
      toast.error('Could not reset the revenue guard', errorMessage(err));
    } finally {
      setSavingRevenue(false);
    }
  };

  // ── Derived ────────────────────────────────────────────────────────────────

  const filteredAlerts = useMemo(
    () => (severityFilter === 'all' ? alerts : alerts.filter((alert) => alert.severity === severityFilter)),
    [alerts, severityFilter]
  );

  const filteredStatuses = useMemo(() => {
    const q = statusQuery.trim().toLowerCase();
    if (!q) return statuses;
    return statuses.filter((row) => String(row.product || '').toLowerCase().includes(q));
  }, [statuses, statusQuery]);

  const severityCounts = useMemo(
    () =>
      alerts.reduce(
        (acc, alert) => {
          acc[alert.severity] = (acc[alert.severity] || 0) + 1;
          return acc;
        },
        { high: 0, medium: 0, low: 0 }
      ),
    [alerts]
  );

  const historyInWindow = useMemo(() => {
    const cutoff = Date.now() - (TIMEFRAME_MS[timeframe] ?? Infinity);
    return history.filter((event) => {
      if (!event?.detected_at) return false;
      const ts = new Date(event.detected_at).getTime();
      return Number.isFinite(ts) && ts >= cutoff;
    });
  }, [history, timeframe]);

  // Bucket detections by hour so the bar chart stays readable over 30 days.
  const historySeries = useMemo(() => {
    const buckets = {};
    for (const event of historyInWindow) {
      const d = new Date(event.detected_at);
      if (Number.isNaN(d.getTime())) continue;
      d.setMinutes(0, 0, 0);
      const key = d.toISOString();
      buckets[key] = (buckets[key] || 0) + 1;
    }
    return Object.entries(buckets)
      .sort(([a], [b]) => new Date(a) - new Date(b))
      .slice(-48)
      .map(([ts, count]) => ({
        label: new Date(ts).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric' }),
        shortLabel: new Date(ts).toLocaleTimeString(undefined, { hour: 'numeric' }),
        value: count,
      }));
  }, [historyInWindow]);

  const peak = historySeries.reduce((max, point) => Math.max(max, point.value), 0);

  const tabs = [
    { id: 'active', label: 'Active alerts', icon: Siren, count: alerts.length },
    { id: 'status', label: 'All products', icon: ListFilter, count: statuses.length },
    { id: 'history', label: 'History', icon: History },
    ...(isOwnerLike ? [{ id: 'revenue', label: 'Revenue guard', icon: ShieldAlert }] : []),
  ];

  return (
    <div>
      <PageHeader
        title="Anomaly monitor"
        description="Products whose predicted five-day demand falls meaningfully below their usual baseline, plus the thresholds that decide what counts as a problem."
        actions={
          <Button size="sm" icon={RefreshCw} onClick={() => load(true)} loading={loading}>
            Refresh
          </Button>
        }
      />

      <motion.div variants={staggerParent} initial="initial" animate="animate" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Active alerts"
          numericValue={alerts.length}
          format={(v) => num(Math.round(v))}
          icon={Siren}
          accent={alerts.length > 0}
          loading={loading}
          hint={`Above the ${threshold}% threshold`}
        />
        <StatCard label="High severity" numericValue={severityCounts.high} format={(v) => num(Math.round(v))} icon={TrendingDown} loading={loading} />
        <StatCard label="Products checked" numericValue={statuses.length} format={(v) => num(Math.round(v))} icon={ListFilter} loading={loading} />
        <StatCard
          label={`Detections (${timeframe})`}
          numericValue={historyInWindow.length}
          format={(v) => num(Math.round(v))}
          icon={History}
          loading={loading}
          hint={peak ? `Peak ${peak} in one hour` : undefined}
        />
      </motion.div>

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <Tabs tabs={tabs} value={tab} onChange={setTab} layoutId="anomaly-tabs" />
        {tab === 'active' && (
          <SegmentedControl
            value={severityFilter}
            onChange={setSeverityFilter}
            options={[
              { value: 'all', label: `All (${alerts.length})` },
              { value: 'high', label: `High (${severityCounts.high})` },
              { value: 'medium', label: `Medium (${severityCounts.medium})` },
              { value: 'low', label: `Low (${severityCounts.low})` },
            ]}
          />
        )}
        {tab === 'history' && <SegmentedControl value={timeframe} onChange={setTimeframe} options={TIMEFRAMES} />}
      </div>

      <div className="mt-4">
        {loading ? (
          <Card animate={false}>
            <AIThinking
              title="Checking every product for abnormal drops"
              steps={[
                'Contacting the model service',
                'Forecasting five-day demand per product',
                'Comparing against each historical baseline',
                'Applying your severity threshold',
              ]}
            />
          </Card>
        ) : mlDown ? (
          <Card animate={false}>
            <MlOfflineState what="Anomaly detection" onRetry={load} />
          </Card>
        ) : error ? (
          <Card animate={false}>
            <EmptyState title="Could not load anomalies" description={error} action={load} actionLabel="Try again" />
          </Card>
        ) : (
          <>
            {/* ── Active alerts ─────────────────────────────────────────── */}
            {tab === 'active' && (
              <div className="grid items-start gap-4 lg:grid-cols-3">
                <div className="lg:col-span-2">
                  <Card animate={false} className="h-full">
                    <CardHeader
                      title="Products flagged right now"
                      description="Each shows how far the forecast sits below its historical baseline."
                      icon={Siren}
                      actions={<AIBadge />}
                    />
                    <div className="mt-4">
                      {!filteredAlerts.length ? (
                        <EmptyState
                          icon={CheckCircle2}
                          tone="honey"
                          title={alerts.length ? 'Nothing at this severity' : 'No anomalies right now'}
                          description={
                            alerts.length
                              ? 'Try a different severity filter.'
                              : `No product is forecast to fall more than ${threshold}% below its baseline.`
                          }
                        />
                      ) : (
                        <ul className="space-y-2.5">
                          {filteredAlerts.map((alert, index) => (
                            <motion.li
                              key={`${alert.product}-${index}`}
                              variants={staggerChild}
                              initial="initial"
                              animate="animate"
                            >
                              <button
                                type="button"
                                onClick={() => navigate(`/forecasts/${encodeURIComponent(alert.product)}`)}
                                className="flex w-full items-center gap-4 rounded-xl border border-hairline/8 p-3.5 text-left transition-[border-color,background-color] hover:border-critical/30 hover:bg-critical/4"
                              >
                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-[13.5px] font-semibold text-ink">
                                    {titleCase(alert.product)}
                                  </p>
                                  <p className="mt-0.5 text-[11.5px] text-ink-muted">
                                    Forecast {num(alert.ensemble_total_5d)} units vs baseline{' '}
                                    {num(alert.baseline_total_5d)}
                                  </p>
                                </div>
                                <div className="shrink-0 text-right">
                                  <p className="text-[15px] font-bold text-critical tabular">
                                    −{num(alert.drop_pct)}%
                                  </p>
                                  <div className="mt-1">
                                    <SeverityChip severity={alert.severity} />
                                  </div>
                                </div>
                              </button>
                            </motion.li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </Card>
                </div>

                <div className="space-y-4">
                  {isOwnerLike ? (
                    <Card animate={false}>
                      <CardHeader
                        title="Sensitivity"
                        description="How far below baseline a product must fall before it counts."
                        icon={ShieldAlert}
                      />
                      <div className="mt-4 space-y-3">
                        <Input
                          label="Drop threshold"
                          type="number"
                          min="0"
                          max="100"
                          step="0.5"
                          value={thresholdInput}
                          onChange={(event) => setThresholdInput(event.target.value)}
                          hint={`Currently ${threshold}%. Higher means fewer, more serious alerts.`}
                        />
                        <div className="flex gap-2">
                          <Button
                            variant="primary"
                            size="sm"
                            icon={Save}
                            onClick={saveThreshold}
                            loading={savingThreshold}
                            className="flex-1"
                          >
                            Save
                          </Button>
                          <Button size="sm" icon={RotateCcw} onClick={resetThreshold} disabled={savingThreshold}>
                            Reset
                          </Button>
                        </div>
                      </div>

                      <div className="mt-5 border-t border-hairline/8 pt-4">
                        <p className="text-[11.5px] leading-relaxed text-ink-muted">
                          Severity is derived from this number: at or above it is <strong>low</strong>, 1.5× is{' '}
                          <strong>medium</strong>, and 2× is <strong>high</strong>.
                        </p>
                      </div>
                    </Card>
                  ) : (
                    <Card animate={false}>
                      <CardHeader title="Current sensitivity" icon={ShieldAlert} />
                      <p className="mt-3 font-display text-3xl font-bold text-ink tabular">{threshold}%</p>
                      <p className="mt-1.5 text-[12px] leading-relaxed text-ink-muted">
                        Set by the owner. A product is flagged once its forecast falls this far below its{' '}
                        <Glossary k="baseline">baseline</Glossary>.
                      </p>
                    </Card>
                  )}

                  <Card animate={false}>
                    <CardHeader title="Severity mix" icon={TrendingDown} />
                    <ul className="mt-4 space-y-2.5">
                      {[
                        { key: 'high', label: 'High' },
                        { key: 'medium', label: 'Medium' },
                        { key: 'low', label: 'Low' },
                      ].map((row) => (
                        <li key={row.key} className="flex items-center justify-between gap-3">
                          <SeverityChip severity={row.key} />
                          <span className="text-[13px] font-semibold text-ink tabular">
                            {severityCounts[row.key] || 0}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </Card>
                </div>
              </div>
            )}

            {/* ── All products ──────────────────────────────────────────── */}
            {tab === 'status' && (
              <Card animate={false}>
                <CardHeader
                  title="Every product, flagged or not"
                  description="The full picture including products that are performing normally — useful for confirming nothing was missed."
                  icon={ListFilter}
                  actions={<AIBadge />}
                />
                <div className="mt-4 max-w-sm">
                  <SearchInput
                    value={statusQuery}
                    onChange={(event) => setStatusQuery(event.target.value)}
                    placeholder="Search products…"
                  />
                </div>
                <div className="mt-4">
                  {!filteredStatuses.length ? (
                    statusQuery ? (
                      <NoResultsState query={statusQuery} onClear={() => setStatusQuery('')} />
                    ) : (
                      <EmptyState title="No products analysed" description="Reload the model once sales data is uploaded." />
                    )
                  ) : (
                    <DataTable
                      columns={[
                        {
                          key: 'product',
                          header: 'Product',
                          value: (row) => row.product,
                          render: (row) => <span className="font-medium text-ink">{titleCase(row.product)}</span>,
                        },
                        {
                          key: 'drop_pct',
                          header: 'Drop',
                          align: 'right',
                          value: (row) => Number(row.drop_pct),
                          render: (row) => (
                            <span
                              className={`font-semibold tabular ${
                                row.drop_pct >= 50 ? 'text-critical' : row.drop_pct >= 25 ? 'text-serious' : row.drop_pct > 0 ? 'text-warn' : 'text-ink-faint'
                              }`}
                            >
                              {row.drop_pct > 0 ? `−${num(row.drop_pct)}%` : '—'}
                            </span>
                          ),
                        },
                        {
                          key: 'ensemble_total_5d',
                          header: 'Forecast (5d)',
                          align: 'right',
                          value: (row) => Number(row.ensemble_total_5d),
                          render: (row) => <span className="tabular">{num(row.ensemble_total_5d)}</span>,
                        },
                        {
                          key: 'baseline_total_5d',
                          header: 'Baseline (5d)',
                          align: 'right',
                          value: (row) => Number(row.baseline_total_5d),
                          render: (row) => <span className="tabular text-ink-muted">{num(row.baseline_total_5d)}</span>,
                        },
                        {
                          key: 'severity',
                          header: 'Status',
                          align: 'center',
                          value: (row) => row.severity,
                          render: (row) => <SeverityChip severity={row.severity} />,
                        },
                      ]}
                      rows={filteredStatuses}
                      rowKey={(row) => row.product}
                      maxHeight="34rem"
                      onRowClick={(row) => navigate(`/forecasts/${encodeURIComponent(row.product)}`)}
                      initialSort={{ key: 'drop_pct', direction: 'desc' }}
                      caption="Forecast versus baseline for every analysed product"
                    />
                  )}
                </div>
              </Card>
            )}

            {/* ── History ───────────────────────────────────────────────── */}
            {tab === 'history' && (
              <div className="grid items-start gap-4 lg:grid-cols-3">
                <div className="lg:col-span-2">
                  <Card animate={false} className="h-full">
                    <CardHeader
                      title="How often anomalies fire"
                      description="Detections grouped by hour. A tall bar means many products tripped at once."
                      icon={History}
                    />
                    <div className="mt-5">
                      {historySeries.length ? (
                        <VerticalBars
                          data={historySeries}
                          height={250}
                          formatValue={(v) => `${v} detection${v === 1 ? '' : 's'}`}
                          ariaLabel="Anomaly detections per hour"
                        />
                      ) : (
                        <EmptyState
                          icon={History}
                          title="Nothing recorded in this window"
                          description="History builds up as the app checks for anomalies over time. Try a wider timeframe."
                        />
                      )}
                    </div>
                  </Card>
                </div>

                <Card animate={false}>
                  <CardHeader title="Most recent detections" icon={Siren} />
                  <div className="mt-4 max-h-[22rem] overflow-y-auto scroll-fade">
                    {historyInWindow.length ? (
                      <ul className="space-y-2">
                        {historyInWindow
                          .slice(0, 60)
                          .map((event, index) => (
                            <li
                              key={`${event.product}-${event.detected_at}-${index}`}
                              className="flex items-center justify-between gap-3 rounded-lg border border-hairline/8 p-2.5"
                            >
                              <div className="min-w-0">
                                <p className="truncate text-[12.5px] font-medium text-ink">
                                  {titleCase(event.product)}
                                </p>
                                <p className="text-[11px] text-ink-faint">
                                  {date(event.detected_at, { withTime: true })}
                                </p>
                              </div>
                              <SeverityChip severity={event.severity} size="xs" />
                            </li>
                          ))}
                      </ul>
                    ) : (
                      <p className="py-6 text-center text-[13px] text-ink-muted">No detections in this window.</p>
                    )}
                  </div>
                </Card>
              </div>
            )}

            {/* ── Revenue guard ─────────────────────────────────────────── */}
            {tab === 'revenue' && (
              <div className="grid items-start gap-4 lg:grid-cols-3">
                <div className="lg:col-span-2">
                  <Card animate={false} className="h-full">
                    <CardHeader
                      title="Forecast revenue guard"
                      description="Warns you when total predicted revenue for the forecast window falls below a floor you set."
                      icon={Banknote}
                      actions={<AIBadge />}
                    />

                    {revenue ? (
                      <>
                        <div className="mt-5 grid gap-3 sm:grid-cols-3">
                          <Inset className="text-center">
                            <p className="text-[11.5px] text-ink-muted">Forecast revenue</p>
                            <p className="mt-1 font-display text-2xl font-bold text-ink tabular">
                              {money(revenue.total_forecast_revenue, { compact: true })}
                            </p>
                            <p className="mt-0.5 text-[11px] text-ink-faint">
                              over {revenue.forecast_horizon_days} days
                            </p>
                          </Inset>
                          <Inset className="text-center">
                            <p className="text-[11.5px] text-ink-muted">Your floor</p>
                            <p className="mt-1 font-display text-2xl font-bold text-ink tabular">
                              {money(revenue.threshold, { compact: true })}
                            </p>
                          </Inset>
                          <Inset className="text-center">
                            <p className="text-[11.5px] text-ink-muted">Status</p>
                            <div className="mt-2 flex justify-center">
                              {revenue.breached ? (
                                <Badge tone="critical" icon={ShieldAlert} size="sm">
                                  Below floor
                                </Badge>
                              ) : (
                                <Badge tone="good" icon={CheckCircle2} size="sm">
                                  On track
                                </Badge>
                              )}
                            </div>
                            {revenue.breached && (
                              <p className="mt-1.5 text-[11px] text-critical tabular">
                                short by {money(revenue.shortfall)}
                              </p>
                            )}
                          </Inset>
                        </div>

                        {revenue.by_product?.length > 0 && (
                          <div className="mt-5">
                            <p className="mb-3 text-[12px] font-medium text-ink-soft">
                              Biggest contributors to forecast revenue
                            </p>
                            <DataTable
                              dense
                              columns={[
                                {
                                  key: 'product',
                                  header: 'Product',
                                  render: (row) => titleCase(row.product ?? row.product_name),
                                },
                                {
                                  key: 'revenue',
                                  header: 'Forecast revenue',
                                  align: 'right',
                                  value: (row) => Number(row.forecast_revenue ?? row.revenue ?? 0),
                                  render: (row) => (
                                    <span className="tabular">
                                      {money(row.forecast_revenue ?? row.revenue ?? 0)}
                                    </span>
                                  ),
                                },
                              ]}
                              rows={revenue.by_product}
                              rowKey={(row, index) => `${row.product ?? row.product_name}-${index}`}
                            />
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="mt-4">
                        <MlOfflineState what="The revenue guard" onRetry={loadRevenue} />
                      </div>
                    )}
                  </Card>
                </div>

                <Card animate={false}>
                  <CardHeader title="Set your floor" description="The minimum forecast revenue you are comfortable with." icon={ShieldAlert} />
                  <div className="mt-4 space-y-3">
                    <Input
                      label="Revenue floor"
                      type="number"
                      min="0"
                      step="10"
                      value={revenueInput}
                      onChange={(event) => setRevenueInput(event.target.value)}
                      hint="You will be warned when the forecast total drops below this."
                    />
                    <div className="flex gap-2">
                      <Button
                        variant="primary"
                        size="sm"
                        icon={Save}
                        onClick={saveRevenueThreshold}
                        loading={savingRevenue}
                        className="flex-1"
                      >
                        Save
                      </Button>
                      <Button size="sm" icon={RotateCcw} onClick={resetRevenueThreshold} disabled={savingRevenue}>
                        Reset
                      </Button>
                    </div>
                  </div>
                </Card>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default Anomalies;
