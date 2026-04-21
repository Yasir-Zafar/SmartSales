import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let _metaCache = null;
let _metaCachePath = null;

/** Default: repo root `ml/artifact` (same layout as the FastAPI service ARTIFACTS_DIR). */
function defaultArtifactsDir() {
  return path.resolve(__dirname, '..', '..', '..', 'ml', 'artifact');
}

function normalizeProductKey(product) {
  return String(product || '').trim().toLowerCase();
}

export function getMlBaseUrl() {
  return process.env.ML_BASE_URL || 'http://localhost:8000';
}

export function getArtifactsDir() {
  return process.env.ML_ARTIFACTS_DIR || process.env.ARTIFACTS_DIR || defaultArtifactsDir();
}

export async function loadMeta() {
  const metaPath = path.resolve(getArtifactsDir(), 'models', '_meta.json');
  if (_metaCache && _metaCachePath === metaPath) return _metaCache;
  try {
    const raw = await fs.readFile(metaPath, 'utf-8');
    _metaCache = JSON.parse(raw);
    _metaCachePath = metaPath;
    return _metaCache;
  } catch (e) {
    if (e?.code === 'ENOENT') {
      const hint =
        'Set ML_ARTIFACTS_DIR to the folder that contains models/_meta.json (e.g. your Kaggle artifacts directory), ' +
        `or run training to generate it. Tried: ${metaPath}`;
      const err = new Error(hint);
      err.cause = e;
      throw err;
    }
    throw e;
  }
}

export function getHistoricalMeanDaily(meta, product) {
  const key = normalizeProductKey(product);
  const info = meta?.[key];
  const mean = info?.mean;
  return typeof mean === 'number' && Number.isFinite(mean) ? mean : null;
}

export function abnormalDropAlert({ product, ensemble_total_5d, mean_daily }) {
  if (typeof ensemble_total_5d !== 'number' || !Number.isFinite(ensemble_total_5d)) return null;
  if (typeof mean_daily !== 'number' || !Number.isFinite(mean_daily)) return null;

  // _meta.json mean is the historical daily mean used for normalization.
  // Compare 5d forecast total against a 5d baseline = mean_daily * 5.
  const baseline5d = mean_daily * 5;
  if (baseline5d <= 0) return null;

  const ratio = ensemble_total_5d / baseline5d;
  if (ratio < 0.7) {
    return {
      type: 'ABNORMAL_DROP',
      title: 'Abnormal Drop',
      product: normalizeProductKey(product),
      ensemble_total_5d,
      baseline_total_5d: Number(baseline5d.toFixed(2)),
      drop_pct: Number(((1 - ratio) * 100).toFixed(1)),
      severity: ratio < 0.5 ? 'high' : 'medium',
    };
  }
  return null;
}

export function confidenceRating({ mae, rmse, mean_daily }) {
  if (![mae, rmse, mean_daily].every((v) => typeof v === 'number' && Number.isFinite(v))) {
    return { rating: 'Unknown', reason: 'Missing MAE/RMSE/mean baseline' };
  }
  if (mean_daily <= 0) return { rating: 'Unknown', reason: 'Invalid mean baseline' };

  // Heuristic thresholds relative to historical mean (daily).
  if (mae < 0.2 * mean_daily && rmse < 0.3 * mean_daily) {
    return { rating: 'High', reason: 'Low error relative to historical average' };
  }
  if (mae < 0.35 * mean_daily && rmse < 0.5 * mean_daily) {
    return { rating: 'Medium', reason: 'Moderate error relative to historical average' };
  }
  return { rating: 'Low', reason: 'High error relative to historical average' };
}

function mean(arr) {
  if (!Array.isArray(arr) || arr.length === 0) return null;
  const s = arr.reduce((acc, v) => acc + (Number(v) || 0), 0);
  return s / arr.length;
}

export function trendDriverFromForecast(forecast) {
  const lstm = forecast?.models?.lstm?.daily;
  const seasonal = forecast?.models?.seasonal?.daily;
  const ensembleTotal = forecast?.models?.ensemble?.total;
  const lstmTotal = forecast?.models?.lstm?.total;
  const seasonalTotal = forecast?.models?.seasonal?.total;

  if (!Array.isArray(lstm) || !Array.isArray(seasonal) || lstm.length === 0 || seasonal.length === 0) {
    return { driver: 'Unknown', reason: 'Missing model series' };
  }

  const mSea = mean(seasonal) ?? 0;
  const denom = Math.max(1e-6, mSea);

  let maxRelDeviation = 0;
  for (let i = 0; i < Math.min(lstm.length, seasonal.length); i++) {
    const d = Math.abs((Number(lstm[i]) || 0) - (Number(seasonal[i]) || 0));
    maxRelDeviation = Math.max(maxRelDeviation, d / denom);
  }

  const totalGap = (typeof lstmTotal === 'number' && typeof seasonalTotal === 'number')
    ? Math.abs(lstmTotal - seasonalTotal) / Math.max(1e-6, Number(ensembleTotal) || (lstmTotal + seasonalTotal) / 2)
    : 0;

  // If LSTM diverges sharply from the seasonal baseline, assume recent spikes.
  if (maxRelDeviation > 0.6 || totalGap > 0.25) {
    return { driver: 'Recent Spikes', reason: 'Short-term model deviates strongly from seasonal baseline' };
  }
  return { driver: 'Cycles', reason: 'Seasonal baseline and short-term model broadly agree' };
}

export function staffActionFromInventoryRiskRow(row) {
  const product = normalizeProductKey(row?.product);
  const level = row?.risk_level;
  const total = typeof row?.ensemble_total_5d === 'number' ? row.ensemble_total_5d : null;
  const cv = typeof row?.demand_volatility_cv === 'number' ? row.demand_volatility_cv : null;

  if (!product) return { headline: 'Review item', message: 'Check this product in inventory.' };

  const levelText = level === 'high' ? 'High risk' : level === 'medium' ? 'Medium risk' : 'Risk';
  const volumeText = total != null ? `Expected demand is about ${Math.round(total)} units over 5 days.` : 'Expected demand is elevated.';

  if (cv != null && cv > 0.7) {
    return {
      headline: `${levelText}: stock carefully`,
      message: `Stock up on ${product}, but keep buffer stock and reorder often. ${volumeText} Daily demand is unpredictable.`,
    };
  }

  return {
    headline: `${levelText}: stock up`,
    message: `Stock up on ${product}. ${volumeText} Demand looks steady enough to plan replenishment.`,
  };
}

export function upsellMessageFromTopProducts(topProducts) {
  if (!Array.isArray(topProducts) || topProducts.length === 0) return null;
  const first = topProducts.find((p) => {
    if (typeof p === 'string' && p.trim() !== '') return true;
    if (p && typeof p === 'object' && typeof p.product === 'string' && p.product.trim() !== '') return true;
    return false;
  });
  if (!first) return null;
  const name = typeof first === 'string' ? first.trim() : String(first.product).trim();
  return `Customers like this usually buy ${name}.`;
}

