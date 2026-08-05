import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Gauge, History, Target, TrendingUp, Activity, RefreshCw } from 'lucide-react';

import { api, errorMessage, isMlUnavailable } from '../lib/api';
import { num, titleCase, date } from '../lib/format';
import { staggerParent, staggerChild } from '../lib/motion';

import { PageHeader } from '../components/layout/PageHeader';
import { Card, CardHeader, Inset } from '../components/ui/Surface';
import { StatCard } from '../components/ui/StatCard';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { DataTable } from '../components/ui/DataTable';
import { EmptyState, MlOfflineState } from '../components/ui/EmptyState';
import { AIBadge, AIThinking } from '../components/ui/AIState';
import { LineArea } from '../components/charts/LineArea';
import { SERIES } from '../components/charts/ChartFrame';
import { Glossary } from '../components/ui/Hint';

/**
 * Product deep dive.
 *
 * The old analyst dashboard buried this behind a text box that required typing
 * the product name in exactly the lowercase form the ML artifacts use. It is now
 * a real URL you reach by selecting a row, and it merges what used to be three
 * separate panels: forecast detail, forecast-vs-actual, and prior runs.
 */

function ConfidenceMeter({ rating, reason }) {
  const levels = { High: 3, Medium: 2, Low: 1 };
  const level = levels[rating] || 0;
  const tone = level === 3 ? 'good' : level === 2 ? 'warning' : level === 1 ? 'critical' : 'neutral';
  const barTone = { good: 'bg-good', warning: 'bg-warn', critical: 'bg-critical', neutral: 'bg-ink-faint' }[tone];

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <span className="text-[12px] font-medium text-ink-soft">
          <Glossary k="confidence">Confidence</Glossary>
        </span>
        <Badge tone={tone}>{rating || 'Unknown'}</Badge>
      </div>
      {/* Three segments, not a percentage — the rating is genuinely ordinal. */}
      <div className="mt-2.5 flex gap-1" aria-hidden="true">
        {[1, 2, 3].map((step) => (
          <motion.span
            key={step}
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ delay: step * 0.08, duration: 0.4 }}
            className={`h-1.5 flex-1 origin-left rounded-full ${step <= level ? barTone : 'bg-hairline/10'}`}
          />
        ))}
      </div>
      {reason && <p className="mt-2 text-[11.5px] leading-relaxed text-ink-muted">{reason}</p>}
    </div>
  );
}

export function ForecastDetail() {
  const { product } = useParams();
  const key = decodeURIComponent(product || '').trim().toLowerCase();

  const [forecast, setForecast] = useState(null);
  const [comparison, setComparison] = useState(null);
  const [snapshots, setSnapshots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [mlDown, setMlDown] = useState(false);

  const load = useCallback(async () => {
    if (!key) return;
    setLoading(true);
    setError('');
    setMlDown(false);

    try {
      const forecastRes = await api.get(`/insights/analyst/forecast/${encodeURIComponent(key)}`);
      setForecast(forecastRes.data);
    } catch (err) {
      setMlDown(isMlUnavailable(err));
      setError(errorMessage(err, `No forecast available for “${key}”`));
      setForecast(null);
      setLoading(false);
      return;
    }

    // These two are supporting detail — a missing comparison is normal until a
    // forecast window has actually elapsed.
    const [comparisonRes, snapshotRes] = await Promise.all([
      api.get(`/insights/analyst/forecast-vs-actual/${encodeURIComponent(key)}`).catch(() => null),
      api.get(`/insights/analyst/forecast/${encodeURIComponent(key)}/snapshots`, { params: { limit: 8 } }).catch(() => null),
    ]);

    setComparison(comparisonRes?.data || null);
    setSnapshots(snapshotRes?.data?.snapshots || []);
    setLoading(false);
  }, [key]);

  useEffect(() => {
    load();
  }, [load]);

  const models = forecast?.forecast?.models;
  const analyst = forecast?.analyst;
  const metrics = forecast?.forecast?.metrics?.ensemble || {};

  // Every model's daily series on one chart, one shared y-axis of units.
  const dailySeries = useMemo(() => {
    if (!models?.ensemble?.daily) return [];
    return models.ensemble.daily.map((value, index) => ({
      label: `Day ${index + 1}`,
      ensemble: Number(value) || 0,
      lstm: Number(models.lstm?.daily?.[index] ?? 0),
      seasonal: Number(models.seasonal?.daily?.[index] ?? 0),
    }));
  }, [models]);

  const comparisonSeries = useMemo(
    () =>
      (comparison?.points || []).map((point) => ({
        label: point.date,
        forecast: Number(point.forecast || 0),
        actual: Number(point.actual || 0),
      })),
    [comparison]
  );

  const accuracy = comparison?.metrics?.mape_pct != null ? Math.max(0, 100 - comparison.metrics.mape_pct) : null;

  if (loading) {
    return (
      <div>
        <PageHeader title={titleCase(key)} description="Loading this product’s forecast detail." />
        <Card animate={false}>
          <AIThinking
            title={`Analysing ${titleCase(key)}`}
            steps={[
              'Contacting the model service',
              'Running the LSTM and seasonal models',
              'Blending the ensemble and scoring accuracy',
              'Comparing against recorded sales',
            ]}
          />
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <PageHeader
          title={titleCase(key)}
          actions={
            <Button size="sm" icon={ArrowLeft} onClick={() => window.history.back()}>
              Back
            </Button>
          }
        />
        <Card animate={false}>
          {mlDown ? (
            <MlOfflineState what="This forecast" onRetry={load} />
          ) : (
            <EmptyState
              icon={Target}
              title="No model for this product"
              description={`${error}. Only products with enough sales history get a trained model.`}
              action={load}
              actionLabel="Try again"
            />
          )}
        </Card>
      </div>
    );
  }

  return (
    <div>
      <Link
        to="/forecasts"
        className="mb-4 inline-flex items-center gap-1.5 text-[12.5px] font-medium text-ink-muted transition-colors hover:text-honey"
      >
        <ArrowLeft size={13} /> All forecasts
      </Link>

      <PageHeader
        title={titleCase(key)}
        description={
          forecast?.forecast?.forecast_start
            ? `Forecast window ${date(forecast.forecast.forecast_start)} – ${date(forecast.forecast.forecast_end)}`
            : 'Five-day demand detail for this product.'
        }
        actions={
          <>
            {forecast?.forecast?.category && <Badge tone="neutral">{titleCase(forecast.forecast.category)}</Badge>}
            <Button size="sm" icon={RefreshCw} onClick={load}>
              Refresh
            </Button>
          </>
        }
      />

      <motion.div variants={staggerParent} initial="initial" animate="animate" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="5-day total"
          numericValue={models?.ensemble?.total}
          format={(v) => `${num(v)} units`}
          icon={TrendingUp}
          accent
        />
        <StatCard
          label="Average per day"
          numericValue={models?.ensemble?.avg_daily}
          format={(v) => num(v)}
          icon={Activity}
        />
        <StatCard
          label="MAE"
          numericValue={metrics.mae}
          format={(v) => v.toFixed(3)}
          icon={Gauge}
          hint="Average miss in units — lower is better"
        />
        <StatCard
          label="RMSE"
          numericValue={metrics.rmse}
          format={(v) => v.toFixed(3)}
          icon={Gauge}
          hint="Penalises large misses — lower is better"
        />
      </motion.div>

      <motion.div variants={staggerParent} initial="initial" animate="animate" className="mt-4 grid items-start gap-4 lg:grid-cols-3">
        <motion.div variants={staggerChild} className="lg:col-span-2">
          <Card animate={false} className="h-full">
            <CardHeader
              title="Daily forecast by model"
              description="How each model sees the next five days, and where the blend lands."
              icon={TrendingUp}
              actions={<AIBadge />}
            />
            <div className="mt-5">
              {dailySeries.length ? (
                <LineArea
                  data={dailySeries}
                  series={[
                    { key: 'ensemble', label: 'Ensemble (used)', color: SERIES[0] },
                    { key: 'lstm', label: 'LSTM', color: SERIES[1] },
                    { key: 'seasonal', label: 'Seasonal', color: SERIES[2] },
                  ]}
                  height={260}
                  showArea={false}
                  formatValue={(v) => `${num(v)} units`}
                />
              ) : (
                <EmptyState title="No daily series" description="This product's model did not return a daily breakdown." />
              )}
            </div>
          </Card>
        </motion.div>

        <motion.div variants={staggerChild} className="space-y-4">
          <Card animate={false}>
            <CardHeader title="How much to trust this" icon={Gauge} />
            <div className="mt-4 space-y-4">
              <ConfidenceMeter rating={analyst?.confidence_rating} reason={analyst?.confidence_reason} />

              <Inset>
                <p className="text-[12px] font-medium text-ink-soft">
                  <Glossary k="trendDriver">Trend driver</Glossary>
                </p>
                <p className="mt-1 text-[13.5px] font-semibold text-ink">{analyst?.trend_driver || '—'}</p>
                <p className="mt-1 text-[11.5px] leading-relaxed text-ink-muted">{analyst?.trend_reason}</p>
              </Inset>

              <Inset>
                <p className="text-[12px] font-medium text-ink-soft">
                  <Glossary k="baseline">Historical daily average</Glossary>
                </p>
                <p className="mt-1 text-[13.5px] font-semibold text-ink tabular">
                  {analyst?.baseline_mean_daily != null ? `${num(analyst.baseline_mean_daily)} units/day` : '—'}
                </p>
              </Inset>
            </div>
          </Card>

          <Card animate={false}>
            <CardHeader title="Previous runs" description="Totals from earlier saved forecasts." icon={History} />
            <div className="mt-4">
              {snapshots.length || analyst?.previous_persisted_runs?.length ? (
                <ul className="space-y-2">
                  {(snapshots.length ? snapshots : analyst.previous_persisted_runs).slice(0, 6).map((run, index) => (
                    <li key={run.run_batch_id || index} className="flex items-center justify-between gap-3 text-[12px]">
                      <span className="truncate text-ink-muted">{date(run.created_at, { withTime: true })}</span>
                      <span className="shrink-0 font-semibold text-ink tabular">{num(run.ensemble_total_5d)}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-[12.5px] text-ink-muted">
                  No saved runs yet. Forecast snapshots are written each time the model is reloaded.
                </p>
              )}
            </div>
          </Card>
        </motion.div>
      </motion.div>

      {/* Forecast vs actual */}
      <motion.div variants={staggerParent} initial="initial" animate="animate" className="mt-4">
        <motion.div variants={staggerChild}>
          <Card animate={false}>
            <CardHeader
              title="Forecast versus what actually sold"
              description="Once a forecast window has passed, its predictions are scored against real sales."
              icon={Target}
            />

            {comparison ? (
              <div className="mt-5 grid gap-5 lg:grid-cols-5">
                <div className="lg:col-span-3">
                  <LineArea
                    data={comparisonSeries}
                    series={[
                      { key: 'forecast', label: 'Forecast', color: SERIES[0] },
                      { key: 'actual', label: 'Actual', color: SERIES[1] },
                    ]}
                    height={230}
                    formatValue={(v) => `${num(v)} units`}
                    formatLabel={(d) => date(d.label)}
                    showArea={false}
                  />
                </div>

                <div className="space-y-3 lg:col-span-2">
                  {accuracy != null && (
                    <Inset className="text-center">
                      <p className="text-[11.5px] text-ink-muted">Prediction accuracy</p>
                      <p
                        className={`mt-1 font-display text-3xl font-bold tabular ${
                          accuracy >= 80 ? 'text-good' : accuracy >= 60 ? 'text-warn' : 'text-critical'
                        }`}
                      >
                        {accuracy.toFixed(1)}%
                      </p>
                      <p className="mt-1 text-[11px] text-ink-faint">
                        100 minus <Glossary k="mape">MAPE</Glossary>
                      </p>
                    </Inset>
                  )}

                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { label: 'MAE', key: 'mae', glossary: 'mae' },
                      { label: 'RMSE', key: 'rmse', glossary: 'rmse' },
                      { label: 'MAPE', key: 'mape_pct', glossary: 'mape', suffix: '%' },
                    ].map((metric) => (
                      <Inset key={metric.key} className="text-center">
                        <p className="text-[10.5px] text-ink-faint">
                          <Glossary k={metric.glossary}>{metric.label}</Glossary>
                        </p>
                        <p className="mt-1 text-[15px] font-semibold text-ink tabular">
                          {comparison.metrics?.[metric.key] != null
                            ? `${comparison.metrics[metric.key]}${metric.suffix || ''}`
                            : '—'}
                        </p>
                      </Inset>
                    ))}
                  </div>

                  <Inset>
                    <div className="flex items-center justify-between text-[12px]">
                      <span className="text-ink-muted">Forecast total</span>
                      <span className="font-semibold text-ink tabular">{num(comparison.totals?.forecast)}</span>
                    </div>
                    <div className="mt-1.5 flex items-center justify-between text-[12px]">
                      <span className="text-ink-muted">Actual total</span>
                      <span className="font-semibold text-ink tabular">{num(comparison.totals?.actual)}</span>
                    </div>
                    <div className="mt-1.5 flex items-center justify-between border-t border-hairline/8 pt-1.5 text-[12px]">
                      <span className="text-ink-muted">Difference</span>
                      <span
                        className={`font-semibold tabular ${
                          Number(comparison.totals?.error || 0) >= 0 ? 'text-good' : 'text-critical'
                        }`}
                      >
                        {Number(comparison.totals?.error || 0) > 0 ? '+' : ''}
                        {num(comparison.totals?.error)}
                      </span>
                    </div>
                  </Inset>
                </div>

                <div className="lg:col-span-5">
                  {/* The table view that the accessibility pass requires: every
                      plotted value is also readable as text. */}
                  <DataTable
                    dense
                    columns={[
                      { key: 'date', header: 'Date', render: (row) => date(row.date) },
                      { key: 'forecast', header: 'Forecast', align: 'right', render: (row) => num(row.forecast) },
                      { key: 'actual', header: 'Actual', align: 'right', render: (row) => num(row.actual) },
                      {
                        key: 'error',
                        header: 'Difference',
                        align: 'right',
                        render: (row) => (
                          <span className={row.error > 0 ? 'text-good' : row.error < 0 ? 'text-critical' : 'text-ink-muted'}>
                            {row.error > 0 ? '+' : ''}
                            {num(row.error)}
                          </span>
                        ),
                      },
                    ]}
                    rows={comparison.points || []}
                    rowKey={(row) => row.date}
                  />
                </div>
              </div>
            ) : (
              <div className="mt-4">
                <EmptyState
                  icon={Target}
                  title="No comparison available yet"
                  description="This appears once a saved forecast window has passed and sales for those dates have been uploaded."
                />
              </div>
            )}
          </Card>
        </motion.div>
      </motion.div>
    </div>
  );
}

export default ForecastDetail;
