import { supabaseAdmin } from '../config/db.js';
import { getMlBaseUrl, loadMeta, getHistoricalMeanDaily, abnormalDropAlert, confidenceRating, trendDriverFromForecast, staffActionFromInventoryRiskRow, upsellMessageFromTopProducts } from '../utils/mlInsights.js';

async function mlGet(path, query = {}) {
  const base = getMlBaseUrl().replace(/\/+$/, '');
  const url = new URL(`${base}${path.startsWith('/') ? '' : '/'}${path}`);
  Object.entries(query).forEach(([k, v]) => {
    if (v === undefined || v === null || v === '') return;
    url.searchParams.set(k, String(v));
  });

  const res = await fetch(url.toString());
  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { message: text };
  }
  if (!res.ok) {
    const msg = data?.detail || data?.message || `ML request failed (${res.status})`;
    const err = new Error(msg);
    err.status = res.status;
    err.payload = data;
    throw err;
  }
  return data;
}

export async function ownerAbnormalDrops(req, res) {
  try {
    const meta = await loadMeta();
    const product = req.query.product ? String(req.query.product) : null;

    if (product) {
      const fc = await mlGet(`/forecast/${encodeURIComponent(product)}`);
      const meanDaily = getHistoricalMeanDaily(meta, fc.product);
      const alert = abnormalDropAlert({
        product: fc.product,
        ensemble_total_30d: fc?.models?.ensemble?.total_30d,
        mean_daily: meanDaily,
      });
      return res.json({ alerts: alert ? [alert] : [] });
    }

    const rows = await mlGet('/forecasts', { limit: 200, sort_by: 'product' });
    const alerts = [];
    for (const r of rows?.forecasts || []) {
      const meanDaily = getHistoricalMeanDaily(meta, r.product);
      const alert = abnormalDropAlert({
        product: r.product,
        ensemble_total_30d: r.ensemble_total_30d,
        mean_daily: meanDaily,
      });
      if (alert) alerts.push(alert);
    }

    alerts.sort((a, b) => (a.severity === 'high' ? -1 : 1) - (b.severity === 'high' ? -1 : 1));
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
      .select('run_batch_id, created_at, ensemble_total_30d, metrics')
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
        ensemble_total_30d: r.ensemble_total_30d,
        staff_action: staff,
      };
    });

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
    const msg = upsellMessageFromTopProducts(seg?.top_products_for_segment);

    return res.json({
      customer_id: seg.customer_id,
      segment_label: seg.segment_label,
      recommendation: seg.recommendation,
      upsell_message: msg,
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
