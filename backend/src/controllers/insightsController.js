import { getMlBaseUrl, loadMeta, getHistoricalMeanDaily, abnormalDropAlert, confidenceRating, trendDriverFromForecast, staffActionFromInventoryRiskRow, normalizeUpsellRecommendation } from '../utils/mlInsights.js';
import { appendAlertHistory, classifyAlertSeverity, getAlertHistory, getAlertThresholds, getLastAlertCount, resetAlertThreshold, setAlertThreshold, setLastAlertCount, getRevenueThreshold, setRevenueThreshold, resetRevenueThreshold } from '../utils/alertingStore.js';
import { sendOwnerAnomalyCountChangeEmail } from '../utils/ownerAlertMailer.js';
import { supabaseAdmin } from '../config/db.js';
import { fetchAllRows } from '../utils/fetchAllRows.js';
import { cached } from '../utils/cache.js';

const TEST_ALERT_RECIPIENTS = ['dpix720@gmail.com', 'l233029@lhr.nu.edu.pk'];

/**
 * The model service recomputes from a fixed in-memory dataset, so the same
 * request returns the same answer until someone reloads it. Caching here makes
 * every ML-backed endpoint fast after the first caller — which is what lets the
 * app prefetch on sign-in and have each tab open instantly.
 *
 * Errors are never cached (see `cached`), so a service that is still warming up
 * is retried rather than remembered as broken.
 */
const ML_CACHE_TTL_MS = 60_000;

async function mlGet(path, query = {}, { ttlMs = ML_CACHE_TTL_MS } = {}) {
  const base = getMlBaseUrl().replace(/\/+$/, '');
  const url = new URL(`${base}${path.startsWith('/') ? '' : '/'}${path}`);
  Object.entries(query).forEach(([k, v]) => {
    if (v === undefined || v === null || v === '') return;
    url.searchParams.set(k, String(v));
  });

  return cached(`ml:${url.toString()}`, ttlMs, () => mlFetch(url));
}

async function mlFetch(url) {
  const res = await fetch(url.toString());
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { message: text };
  }
  if (!res.ok) {
    const rawMsg = data?.detail ?? data?.message;
    const msg = typeof rawMsg === 'string'
      ? rawMsg
      : rawMsg != null
        ? JSON.stringify(rawMsg)
        : `ML request failed (${res.status})`;
    const err = new Error(msg);
    err.status = res.status;
    err.payload = data;
    throw err;
  }
  return data;
}

async function computeAbnormalDropAlerts({ product = null, severity = null, minDropPct = null, recordHistory = false }) {
  const meta = await loadMeta();
  const thresholds = await getAlertThresholds();

  if (product) {
    const fc = await mlGet(`/forecast/${encodeURIComponent(product)}`);
    const meanDaily = getHistoricalMeanDaily(meta, fc.product);
    const alert = abnormalDropAlert({
      product: fc.product,
      ensemble_total_5d: fc?.models?.ensemble?.total,
      mean_daily: meanDaily,
    });
    if (!alert) return [];
    const classifiedSeverity = classifyAlertSeverity(alert.drop_pct, thresholds);
    if (!classifiedSeverity) return [];
    alert.severity = classifiedSeverity;
    if (severity && alert.severity !== severity) return [];
    if (minDropPct != null && Number(alert.drop_pct) < Number(minDropPct)) return [];
    return [alert];
  }

  const rows = await mlGet('/forecasts', { limit: 200, sort_by: 'product' });
  const alerts = [];
  for (const r of rows?.forecasts || []) {
    const meanDaily = getHistoricalMeanDaily(meta, r.product);
    const alert = abnormalDropAlert({
      product: r.product,
      ensemble_total_5d: r.ensemble_total_5d,
      mean_daily: meanDaily,
    });
    if (!alert) continue;
    const classifiedSeverity = classifyAlertSeverity(alert.drop_pct, thresholds);
    if (!classifiedSeverity) continue;
    alerts.push({ ...alert, severity: classifiedSeverity });
  }

  let filtered = alerts;
  if (severity) {
    filtered = filtered.filter((a) => a.severity === severity);
  }
  if (minDropPct != null) {
    filtered = filtered.filter((a) => Number(a.drop_pct) >= Number(minDropPct));
  }

  const rank = { high: 3, medium: 2, low: 1 };
  filtered.sort((a, b) => (rank[b.severity] || 0) - (rank[a.severity] || 0) || Number(b.drop_pct) - Number(a.drop_pct));

  if (recordHistory) {
    await appendAlertHistory(
      filtered.map((alert) => ({
        type: alert.type,
        product: alert.product,
        severity: alert.severity,
        drop_pct: alert.drop_pct,
        baseline_total_5d: alert.baseline_total_5d,
        ensemble_total_5d: alert.ensemble_total_5d,
      }))
    );
  }
  return filtered;
}

function buildDropStatusRow({ product, ensembleTotal5d, meanDaily, thresholds }) {
  if (typeof ensembleTotal5d !== 'number' || !Number.isFinite(ensembleTotal5d)) return null;
  if (typeof meanDaily !== 'number' || !Number.isFinite(meanDaily)) return null;

  const baseline5dRaw = meanDaily * 5;
  if (!Number.isFinite(baseline5dRaw) || baseline5dRaw <= 0) return null;

  const dropPctRaw = ((baseline5dRaw - ensembleTotal5d) / baseline5dRaw) * 100;
  const dropPct = Math.max(0, Number(dropPctRaw.toFixed(1)));
  const severity = classifyAlertSeverity(dropPct, thresholds) || 'none';

  return {
    product: String(product || '').trim().toLowerCase(),
    baseline_total_5d: Number(baseline5dRaw.toFixed(2)),
    ensemble_total_5d: Number(ensembleTotal5d.toFixed(2)),
    drop_pct: dropPct,
    severity,
  };
}

export async function getAbnormalDropThresholds(req, res) {
  try {
    const thresholds = await getAlertThresholds();
    return res.json({ thresholds });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
}

export async function updateAbnormalDropThreshold(req, res) {
  try {
    const thresholdPct = req.body?.threshold_pct;
    const thresholds = await setAlertThreshold(thresholdPct);
    return res.json({ thresholds });
  } catch (err) {
    const status = /invalid/i.test(err.message) ? 400 : 500;
    return res.status(status).json({ message: err.message });
  }
}

export async function removeAbnormalDropThreshold(req, res) {
  try {
    const thresholds = await resetAlertThreshold();
    return res.json({ thresholds });
  } catch (err) {
    const status = /invalid/i.test(err.message) ? 400 : 500;
    return res.status(status).json({ message: err.message });
  }
}

export async function sharedDropAlertNotifications(req, res) {
  try {
    const alerts = await computeAbnormalDropAlerts({ recordHistory: true });
    const count = alerts.length;
    const previous = await getLastAlertCount();
    const previousCount = previous.count;
    let emailSent = false;
    let emailError = null;
    const notifyOwner = String(req.query.notify_owner || '').toLowerCase() === 'true';

    const changed = Number.isFinite(previousCount) && previousCount !== count;
    if (changed && notifyOwner) {
      console.log(`[alerts] anomaly count changed: ${previousCount} -> ${count}. Preparing owner email notifications.`);
      try {
        for (const to of TEST_ALERT_RECIPIENTS) {
          console.log(`[alerts] anomaly changed, sending email to: ${to}`);
          try {
            await sendOwnerAnomalyCountChangeEmail({
              to,
              previousCount,
              currentCount: count,
            });
            emailSent = true;
            console.log(`[alerts] email send success: ${to}`);
          } catch (sendErr) {
            console.error(`[alerts] email send failed: ${to} | ${sendErr.message}`);
            throw sendErr;
          }
        }
      } catch (mailErr) {
        emailError = mailErr.message;
        console.error(`[alerts] owner notification flow failed: ${mailErr.message}`);
      }
    } else if (changed && !notifyOwner) {
      console.log(`[alerts] anomaly count changed: ${previousCount} -> ${count}. Email suppressed (notify_owner=false).`);
    } else if (notifyOwner) {
      console.log(`[alerts] anomaly count unchanged (${count}). No owner email sent.`);
    }

    await setLastAlertCount(count);
    return res.json({ count, previous_count: previousCount, changed, email_sent: emailSent, email_error: emailError, alerts });
  } catch (err) {
    return res.status(err.status || 500).json({ message: err.message });
  }
}

export async function abnormalDropAlertHistory(req, res) {
  try {
    const history = await getAlertHistory(req.query.limit);
    return res.json({ count: history.length, history });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
}

export async function droppedStatus(req, res) {
  try {
    const queryProduct = String(req.query.product || '').trim().toLowerCase();
    const meta = await loadMeta();
    const thresholds = await getAlertThresholds();
    const rows = await mlGet('/forecasts', { limit: 200, sort_by: 'product' });

    const statuses = (rows?.forecasts || [])
      .map((r) => {
        const product = String(r?.product || '').trim().toLowerCase();
        if (!product) return null;
        const meanDaily = getHistoricalMeanDaily(meta, product);
        return buildDropStatusRow({
          product,
          ensembleTotal5d: r?.ensemble_total_5d,
          meanDaily,
          thresholds,
        });
      })
      .filter((row) => row && (!queryProduct || row.product.includes(queryProduct)))
      .sort((a, b) => Number(b.drop_pct) - Number(a.drop_pct));

    return res.json({ count: statuses.length, statuses });
  } catch (err) {
    return res.status(err.status || 500).json({ message: err.message });
  }
}

export async function ownerAbnormalDrops(req, res) {
  try {
    const product = req.query.product ? String(req.query.product) : null;
    const alerts = await computeAbnormalDropAlerts({
      product,
      severity: req.query.severity ? String(req.query.severity) : null,
      minDropPct: req.query.min_drop_pct,
    });
    return res.json({ count: alerts.length, alerts });
  } catch (err) {
    return res.status(err.status || 500).json({ message: err.message });
  }
}

export async function analystForecast(req, res) {
  try {
    const product = req.params.product;
    const meta = await loadMeta();
    const fc = await mlGet(`/forecast/${encodeURIComponent(product)}`);

    const meanDaily = getHistoricalMeanDaily(meta, fc.product);
    const m = fc?.metrics?.ensemble || fc?.metrics?.[fc?.best_model] || {};
    const trust = confidenceRating({ mae: m?.mae, rmse: m?.rmse, mean_daily: meanDaily });
    const trend = trendDriverFromForecast(fc);

    const { data: prior } = await supabaseAdmin
      .from('ml_forecast_snapshots')
      .select('run_batch_id, created_at, ensemble_total_5d, metrics')
      .eq('product_name', fc.product)
      .order('created_at', { ascending: false })
      .limit(5);

    return res.json({
      forecast: fc,
      analyst: {
        confidence_rating: trust.rating,
        confidence_reason: trust.reason,
        trend_driver: trend.driver,
        trend_reason: trend.reason,
        baseline_mean_daily: meanDaily,
        metrics_raw: fc?.metrics || {},
        mae_ensemble: fc?.metrics?.ensemble?.mae ?? null,
        rmse_ensemble: fc?.metrics?.ensemble?.rmse ?? null,
        previous_persisted_runs: prior || [],
      },
    });
  } catch (err) {
    return res.status(err.status || 500).json({ message: err.message });
  }
}

export async function staffInventoryRisk(req, res) {
  try {
    const data = await mlGet('/inventory/risk', {
      level: req.query.level,
      category: req.query.category,
    });

    const risks = (data?.risks || []).map((r) => {
      const staff = staffActionFromInventoryRiskRow(r);
      return {
        product: r.product,
        category: r.category,
        risk_level: r.risk_level,
        reasons: r.reasons,
        ensemble_total_5d: r.ensemble_total_5d,
        staff_action: staff,
      };
    })
      // Hide model-noise cards that recommend action for near-zero demand.
      .filter((r) => Number(r.ensemble_total_5d || 0) >= 1);

    return res.json({ count: risks.length, risks });
  } catch (err) {
    return res.status(err.status || 500).json({ message: err.message });
  }
}

export async function staffCustomerUpsell(req, res) {
  try {
    const customerId = Number(req.params.customerId);
    if (!Number.isFinite(customerId)) return res.status(400).json({ message: 'Invalid customerId' });

    const seg = await mlGet(`/segments/${customerId}`);
    const recommendation = normalizeUpsellRecommendation(seg?.recommendation, seg?.top_products_for_segment);

    return res.json({
      customer_id: seg.customer_id,
      segment_label: seg.segment_label,
      recommendation,
      upsell_message: recommendation,
      top_products_for_segment: seg.top_products_for_segment,
    });
  } catch (err) {
    return res.status(err.status || 500).json({ message: err.message });
  }
}

export async function ownerLatestForecasts(req, res) {
  try {
    const { data: last, error: lastErr } = await supabaseAdmin
      .from('ml_forecast_snapshots')
      .select('run_batch_id, created_at')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lastErr) return res.status(400).json({ message: lastErr.message });
    if (!last?.run_batch_id) {
      return res.json({ run_batch_id: null, created_at: null, products: [] });
    }

    const { data: rows, error } = await supabaseAdmin
      .from('ml_forecast_snapshots')
      .select('*')
      .eq('run_batch_id', last.run_batch_id)
      .order('product_name', { ascending: true });

    if (error) return res.status(400).json({ message: error.message });

    return res.json({
      run_batch_id: last.run_batch_id,
      created_at: last.created_at,
      products: rows || [],
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
}

export async function ownerLiveKpis(req, res) {
  try {
    // Cached: this pages the whole sales table, and the owner overview re-polls
    // every 30s. TTL matches that interval so a viewer never waits twice for
    // the same scan, while an upload still shows up within half a minute.
    const payload = await cached('owner:kpis:live', 30_000, () => computeOwnerLiveKpis());
    return res.json(payload);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
}

async function computeOwnerLiveKpis() {
  {
    const { data: latestSaleRow, error: latestSaleErr } = await supabaseAdmin
      .from('daily_sales')
      .select('sale_date')
      .order('sale_date', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latestSaleErr) throw new Error(latestSaleErr.message);

    const anchor = latestSaleRow?.sale_date ? new Date(String(latestSaleRow.sale_date).split('T')[0]) : new Date();
    const monthStart = new Date(anchor.getFullYear(), anchor.getMonth(), 1).toISOString().split('T')[0];
    const monthEnd = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0).toISOString().split('T')[0];
    const prevMonthStart = new Date(anchor.getFullYear(), anchor.getMonth() - 1, 1).toISOString().split('T')[0];
    const prevMonthEnd = new Date(anchor.getFullYear(), anchor.getMonth(), 0).toISOString().split('T')[0];

    // These three aggregate whole date ranges, so they must page past the
    // 1000-row PostgREST cap — otherwise total revenue, units and the customer
    // count are computed from an arbitrary 1000-row slice of the table.
    const [allSales, currMonth, prevMonth, { data: latestUpload, error: uploadErr }] = await Promise.all([
      fetchAllRows(() =>
        supabaseAdmin
          .from('daily_sales')
          .select('total_price, quantity, customer_id, product_id')
          .order('id', { ascending: true })
      ),
      fetchAllRows(() =>
        supabaseAdmin
          .from('daily_sales')
          .select('total_price, quantity, product_id')
          .gte('sale_date', monthStart)
          .lte('sale_date', monthEnd)
          .order('id', { ascending: true })
      ),
      fetchAllRows(() =>
        supabaseAdmin
          .from('daily_sales')
          .select('total_price, quantity, product_id')
          .gte('sale_date', prevMonthStart)
          .lte('sale_date', prevMonthEnd)
          .order('id', { ascending: true })
      ),
      supabaseAdmin.from('csv_uploads').select('created_at, upload_date').order('created_at', { ascending: false }).limit(1).maybeSingle(),
    ]);

    if (uploadErr) throw new Error(uploadErr.message);

    const totalRevenue = allSales.reduce((sum, row) => sum + Number(row.total_price || 0), 0);
    const totalSales = allSales.reduce((sum, row) => sum + Number(row.quantity || 0), 0);
    const activeCustomers = new Set(allSales.map((row) => row.customer_id).filter((id) => id != null)).size;
    const totalProfit = 0;
    const profitMarginPct = 0;

    const currentMonthRevenue = (currMonth || []).reduce((sum, row) => sum + Number(row.total_price || 0), 0);
    const currentMonthProfit = 0;

    const previousMonthRevenue = (prevMonth || []).reduce((sum, row) => sum + Number(row.total_price || 0), 0);
    const previousMonthProfit = 0;
    const profitChangePct = previousMonthProfit !== 0
      ? Number((((currentMonthProfit - previousMonthProfit) / Math.abs(previousMonthProfit)) * 100).toFixed(1))
      : null;
    const revenueChangePct = previousMonthRevenue > 0
      ? Number((((currentMonthRevenue - previousMonthRevenue) / previousMonthRevenue) * 100).toFixed(1))
      : null;

    return {
      updated_at: new Date().toISOString(),
      anchored_latest_sale_date: latestSaleRow?.sale_date || null,
      latest_upload_at: latestUpload?.created_at || latestUpload?.upload_date || null,
      kpis: {
        total_revenue: Number(totalRevenue.toFixed(2)),
        total_units_sold: totalSales,
        total_profit: Number(totalProfit.toFixed(2)),
        profit_margin_pct: profitMarginPct,
        active_customers: activeCustomers,
        current_month_revenue: Number(currentMonthRevenue.toFixed(2)),
        current_month_profit: Number(currentMonthProfit.toFixed(2)),
        previous_month_revenue: Number(previousMonthRevenue.toFixed(2)),
        revenue_change_pct: revenueChangePct,
        profit_change_pct: profitChangePct,
      },
    };
  }
}

export async function ownerForecasts(req, res) {
  try {
    const data = await mlGet('/forecasts', {
      limit: req.query.limit || 50,
      sort_by: req.query.sort_by || 'ensemble_total',
      category: req.query.category,
    });
    return res.json(data);
  } catch (err) {
    return res.status(err.status || 500).json({ message: err.message });
  }
}

function labelSegment(ratio) {
  if (ratio >= 0.8) return { label: 'Champions', recommendation: 'Send loyalty rewards and early access to new products.' };
  if (ratio >= 0.5) return { label: 'Loyal Customers', recommendation: 'Upsell premium alternatives and bundle deals.' };
  if (ratio >= 0.3) return { label: 'Potential Loyalists', recommendation: 'Offer a loyalty program invitation.' };
  if (ratio >= 0.1) return { label: 'At Risk', recommendation: 'Send a win-back offer or personalised discount.' };
  return { label: 'Lost', recommendation: 'Send a re-engagement campaign with a strong incentive.' };
}

function computeLabelsFromDB(rows) {
  const allDates = new Set();
  const customerMap = {};

  for (const row of rows) {
    const cid = Number(row.customer_id);
    if (!Number.isFinite(cid) || !row.sale_date) continue;

    allDates.add(String(row.sale_date));

    if (!customerMap[cid]) {
      customerMap[cid] = {
        customer_id: cid,
        shopping_days: new Set(),
      };
    }

    customerMap[cid].shopping_days.add(String(row.sale_date));
  }

  const totalDays = allDates.size || 1;

  const labels = {};
  for (const [cid, c] of Object.entries(customerMap)) {
    const ratio = c.shopping_days.size / totalDays;
    labels[Number(cid)] = labelSegment(ratio);
  }

  return labels;
}

export async function ownerCustomerSegments(req, res) {
  try {
    const queryCustomerId = req.query.customer_id != null
      ? Number(req.query.customer_id)
      : null;

    if (req.query.customer_id != null && !Number.isFinite(queryCustomerId)) {
      return res.status(400).json({ message: 'Invalid customer_id' });
    }

    // Every field this endpoint returns is derived from the sales table, so it
    // is computed in one cached scan.
    //
    // This previously issued one ML request PER CUSTOMER, sequentially — 128
    // round-trips for a typical dataset. Worse, a failed call was swallowed
    // silently, so if the model service was still warming up the loop skipped
    // every customer and returned an empty list. The UI then said "no segments"
    // after a long wait, and a later refresh (model now warm) worked. The tier
    // label already came from the local ratio calculation, and the only ML
    // fields used were purchase count and spend, both of which are plain
    // aggregates of the same rows. So there is nothing here the model needs to
    // answer, and the endpoint no longer depends on it being up.
    // The finished list is cached, not just the raw scan: labelling walks every
    // sales row, and repeating that per request cost ~1s even on a cache hit.
    const allSegments = await cached('segments:computed', 60_000, async () => {
      const rows = await fetchAllRows(() =>
        supabaseAdmin
          .from('daily_sales')
          .select('customer_id, sale_date, transaction_id, total_price')
          .order('id', { ascending: true })
      );

      const labelMap = computeLabelsFromDB(rows);

      // Purchases = distinct transactions (a basket is one purchase, not N lines).
      const totals = {};
      for (const row of rows) {
        const cid = Number(row.customer_id);
        if (!Number.isFinite(cid)) continue;
        if (!totals[cid]) totals[cid] = { transactions: new Set(), spend: 0 };
        if (row.transaction_id) totals[cid].transactions.add(String(row.transaction_id));
        totals[cid].spend += Number(row.total_price || 0);
      }

      const TIER_ORDER = ['Champions', 'Loyal Customers', 'Potential Loyalists', 'At Risk', 'Lost'];

      return Object.keys(labelMap)
        .map(Number)
        .sort((a, b) => a - b)
        .map((customerId) => {
          const { label, recommendation } = labelMap[customerId];
          const agg = totals[customerId] || { transactions: new Set(), spend: 0 };
          return {
            customer_id: customerId,
            // Kept for API compatibility; the tier's rank is the meaningful value.
            segment_id: TIER_ORDER.indexOf(label),
            segment_label: label,
            recommendation,
            total_purchases: agg.transactions.size,
            total_spend: Number(agg.spend.toFixed(2)),
          };
        });
    });

    const segments = queryCustomerId != null
      ? allSegments.filter((s) => s.customer_id === queryCustomerId)
      : allSegments;

    if (queryCustomerId != null && segments.length === 0) {
      return res.status(404).json({ message: `Customer ${queryCustomerId} not found` });
    }

    return res.json({ segments });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
}

export async function ownerRevenueThresholdAlert(req, res) {
  try {
    const forecastData = await mlGet('/forecast/total-revenue');
    const thresholdCfg = await getRevenueThreshold();
    const totalForecast = forecastData.total_forecast_revenue;
    const threshold = thresholdCfg.threshold;
    const breached = totalForecast < threshold;
    const shortfall = breached ? Number((threshold - totalForecast).toFixed(2)) : null;

    return res.json({
      total_forecast_revenue: Number(totalForecast.toFixed(2)),
      threshold,
      forecast_horizon_days: forecastData.forecast_horizon_days,
      breached,
      shortfall,
      by_product: forecastData.by_product?.slice(0, 10) || [],
    });
  } catch (err) {
    return res.status(err.status || 500).json({ message: err.message });
  }
}

export async function getOwnerRevenueThreshold(req, res) {
  try {
    const cfg = await getRevenueThreshold();
    return res.json(cfg);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
}

export async function setOwnerRevenueThreshold(req, res) {
  try {
    const threshold = req.body?.threshold;
    if (threshold == null || Number(threshold) < 0) {
      return res.status(400).json({ message: 'threshold must be a non-negative number' });
    }
    const cfg = await setRevenueThreshold(threshold);
    return res.json(cfg);
  } catch (err) {
    return res.status(400).json({ message: err.message });
  }
}

export async function resetOwnerRevenueThreshold(req, res) {
  try {
    const cfg = await resetRevenueThreshold();
    return res.json(cfg);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
}

export async function analystSegments(req, res) {
  try {
    const data = await mlGet('/segments');
    return res.json(data);
  } catch (err) {
    return res.status(err.status || 500).json({ message: err.message });
  }
}

export async function analystForecastSnapshots(req, res) {
  try {
    const product = String(req.params.product || '').trim().toLowerCase();
    if (!product) return res.status(400).json({ message: 'product required' });
    const limit = Math.min(parseInt(req.query.limit, 10) || 5, 20);

    const { data, error } = await supabaseAdmin
      .from('ml_forecast_snapshots')
      .select('*')
      .eq('product_name', product)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) return res.status(400).json({ message: error.message });
    return res.json({ product, snapshots: data || [] });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
}

function toIsoDate(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().split('T')[0];
}

function buildDateRange(startIso, days) {
  const start = new Date(startIso);
  if (Number.isNaN(start.getTime())) return [];
  return Array.from({ length: days }, (_, idx) => {
    const d = new Date(start);
    d.setDate(start.getDate() + idx);
    return d.toISOString().split('T')[0];
  });
}

export async function analystForecastVsActual(req, res) {
  try {
    const product = String(req.params.product || '').trim().toLowerCase();
    if (!product) return res.status(400).json({ message: 'product required' });

    const { data: latest, error: snapErr } = await supabaseAdmin
      .from('ml_forecast_snapshots')
      .select('created_at, forecast_start, forecast_end, ensemble_daily, ensemble_total_5d')
      .eq('product_name', product)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (snapErr) return res.status(400).json({ message: snapErr.message });
    if (!latest) return res.status(404).json({ message: `No forecast snapshot found for ${product}` });

    const forecastDailyRaw = Array.isArray(latest.ensemble_daily) ? latest.ensemble_daily : [];
    const forecastDaily = forecastDailyRaw
      .map((v) => Number(v))
      .filter((v) => Number.isFinite(v))
      .slice(0, 5);

    if (!forecastDaily.length) {
      return res.status(422).json({ message: 'Snapshot missing usable daily forecast values' });
    }

    const forecastStart = toIsoDate(latest.forecast_start);
    const dateRange = buildDateRange(forecastStart, forecastDaily.length);
    if (!forecastStart || !dateRange.length) {
      return res.status(422).json({ message: 'Snapshot has invalid forecast window' });
    }
    const forecastEnd = dateRange[dateRange.length - 1];

    const { data: actualRows, error: actualErr } = await supabaseAdmin
      .from('daily_sales')
      .select('sale_date, quantity')
      .ilike('product_name', product)
      .gte('sale_date', forecastStart)
      .lte('sale_date', forecastEnd);

    if (actualErr) return res.status(400).json({ message: actualErr.message });

    const actualByDate = {};
    for (const row of actualRows || []) {
      const d = toIsoDate(row.sale_date);
      if (!d) continue;
      actualByDate[d] = (actualByDate[d] || 0) + Number(row.quantity || 0);
    }

    const points = dateRange.map((date, idx) => {
      const forecast = Number(forecastDaily[idx].toFixed(2));
      const actual = Number((actualByDate[date] || 0).toFixed(2));
      const error = Number((actual - forecast).toFixed(2));
      return { date, forecast, actual, error };
    });

    const n = points.length;
    const mae = n ? Number((points.reduce((s, p) => s + Math.abs(p.error), 0) / n).toFixed(3)) : null;
    const rmse = n ? Number((Math.sqrt(points.reduce((s, p) => s + (p.error ** 2), 0) / n)).toFixed(3)) : null;
    const mapeDenomCount = points.filter((p) => p.actual > 0).length;
    const mape = mapeDenomCount
      ? Number((
        (points.filter((p) => p.actual > 0).reduce((s, p) => s + (Math.abs(p.error) / p.actual), 0) / mapeDenomCount) * 100
      ).toFixed(2))
      : null;

    const totalForecast = Number(points.reduce((s, p) => s + p.forecast, 0).toFixed(2));
    const totalActual = Number(points.reduce((s, p) => s + p.actual, 0).toFixed(2));

    return res.json({
      product,
      snapshot_created_at: latest.created_at,
      forecast_window: { start: forecastStart, end: forecastEnd, days: n },
      totals: {
        forecast: totalForecast,
        actual: totalActual,
        error: Number((totalActual - totalForecast).toFixed(2)),
      },
      metrics: { mae, rmse, mape_pct: mape },
      points,
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
}

export async function staffSalesSummary(req, res) {
  try {
    const normalizeSaleDate = (value) => {
      if (!value) return null;
      const raw = String(value).trim();
      // Fast-path ISO date-like strings.
      const isoLike = raw.match(/^(\d{4}-\d{2}-\d{2})/);
      if (isoLike) return isoLike[1];
      const d = new Date(raw);
      if (!Number.isNaN(d.getTime())) return d.toISOString().split('T')[0];
      return null;
    };

    // Anchor on the newest/oldest sale_date directly rather than pulling every
    // row to sort client-side. The old `.limit(50000)` also could not beat
    // PostgREST's 1000-row cap, so the "latest day" was whichever date happened
    // to fall in the first arbitrary 1000 rows.
    const [{ data: maxRow, error: maxErr }, { data: minRow, error: minErr }, { count: dateCount }] = await Promise.all([
      supabaseAdmin.from('daily_sales').select('sale_date').order('sale_date', { ascending: false }).limit(1).maybeSingle(),
      supabaseAdmin.from('daily_sales').select('sale_date').order('sale_date', { ascending: true }).limit(1).maybeSingle(),
      supabaseAdmin.from('daily_sales').select('*', { count: 'exact', head: true }),
    ]);

    const latestErr = maxErr || minErr;
    if (latestErr) return res.status(400).json({ message: latestErr.message });

    const maxDate = normalizeSaleDate(maxRow?.sale_date);
    const minDate = normalizeSaleDate(minRow?.sale_date);
    const parsedDates = maxDate ? [minDate || maxDate, maxDate] : [];

    if (parsedDates.length === 0) {
      return res.json({
        source: { anchor_date: null, parsed_dates_count: 0, min_date: null, max_date: null },
        today: { date: null, revenue: '0.00', transactions: 0, top_items: [] },
        week: { start_date: null, end_date: null, revenue: '0.00', transactions: 0, dailyBreakdown: [], top_items: [] },
      });
    }

    parsedDates.sort();
    const todayIso = parsedDates[parsedDates.length - 1];
    const todayStart = new Date(todayIso);
    const nextDay = new Date(todayStart);
    nextDay.setDate(nextDay.getDate() + 1);
    const nextDayIso = nextDay.toISOString().split('T')[0];
    const weekStart = new Date(todayStart);
    weekStart.setDate(weekStart.getDate() - 6);
    const weekStartIso = weekStart.toISOString().split('T')[0];

    // Today's sales
    const todayData = await fetchAllRows(() =>
      supabaseAdmin
        .from('daily_sales')
        .select('total_price, quantity, product_name')
        .gte('sale_date', todayIso)
        .lt('sale_date', nextDayIso)
        .order('id', { ascending: true })
    );

    const todayRevenue = todayData.reduce((sum, row) => sum + Number(row.total_price || 0), 0);
    const todayTransactions = todayData.length;

    // Week's sales — seven days of a busy shop exceeds 1000 rows easily.
    const weekData = await fetchAllRows(() =>
      supabaseAdmin
        .from('daily_sales')
        .select('sale_date, total_price, quantity, product_name')
        .gte('sale_date', weekStartIso)
        .lte('sale_date', todayIso)
        .order('id', { ascending: true })
    );

    const weekRevenue = weekData.reduce((sum, row) => sum + Number(row.total_price || 0), 0);
    const weekTransactions = weekData.length;

    const aggregateTopItems = (rows, limit = 5) => {
      const map = {};
      for (const row of rows || []) {
        const name = String(row.product_name || '').trim() || 'Unknown';
        if (!map[name]) {
          map[name] = { product_name: name, quantity: 0, revenue: 0 };
        }
        map[name].quantity += Number(row.quantity || 0);
        map[name].revenue += Number(row.total_price || 0);
      }
      return Object.values(map)
        // "Top sales items" should prioritize revenue first.
        .sort((a, b) => b.revenue - a.revenue || b.quantity - a.quantity)
        .slice(0, limit)
        .map((item) => ({
          product_name: item.product_name,
          quantity: Number(item.quantity.toFixed(2)),
          revenue: Number(item.revenue.toFixed(2)),
        }));
    };

    const todayTopItems = aggregateTopItems(todayData, 5);
    const weekTopItems = aggregateTopItems(weekData, 5);

    // Daily breakdown for the week
    const dailyBreakdown = {};
    weekData.forEach(row => {
      const date = row.sale_date;
      if (!dailyBreakdown[date]) {
        dailyBreakdown[date] = { date, revenue: 0, transactions: 0 };
      }
      dailyBreakdown[date].revenue += Number(row.total_price || 0);
      dailyBreakdown[date].transactions += 1;
    });

    const dailyArray = Object.values(dailyBreakdown).sort((a, b) =>
      new Date(a.date) - new Date(b.date)
    );

    return res.json({
      source: {
        anchor_date: todayIso,
        // Real row count from the server, not the length of a client-side sample.
        parsed_dates_count: dateCount ?? 0,
        min_date: parsedDates[0],
        max_date: parsedDates[parsedDates.length - 1],
      },
      today: {
        date: todayIso,
        revenue: todayRevenue.toFixed(2),
        transactions: todayTransactions,
        top_items: todayTopItems,
      },
      week: {
        start_date: weekStartIso,
        end_date: todayIso,
        revenue: weekRevenue.toFixed(2),
        transactions: weekTransactions,
        dailyBreakdown: dailyArray,
        top_items: weekTopItems,
      },
    });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
}

export async function analystForecasts(req, res) {
  try {
    const data = await mlGet('/forecasts', {
      limit: req.query.limit || 50,
      sort_by: req.query.sort_by || 'ensemble_total',
      category: req.query.category,
    });
    return res.json(data);
  } catch (err) {
    return res.status(err.status || 500).json({ message: err.message });
  }
}

export async function analystAbnormalDrops(req, res) {
  try {
    const alerts = await computeAbnormalDropAlerts({
      product: req.query.product ? String(req.query.product) : null,
      severity: req.query.severity ? String(req.query.severity) : null,
      minDropPct: req.query.min_drop_pct,
    });
    return res.json({ count: alerts.length, alerts });
  } catch (err) {
    return res.status(err.status || 500).json({ message: err.message });
  }
}
