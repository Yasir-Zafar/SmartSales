import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.resolve(__dirname, '..', '..', 'data');
const thresholdsFile = path.join(dataDir, 'alert-thresholds.json');
const historyFile = path.join(dataDir, 'alert-history.json');
const countStateFile = path.join(dataDir, 'alert-count-state.json');
const revenueThresholdFile = path.join(dataDir, 'revenue-threshold.json');

const DEFAULT_THRESHOLD = 20;
const DEFAULT_REVENUE_THRESHOLD = 100;

async function ensureDir() {
  await fs.mkdir(dataDir, { recursive: true });
}

async function readJson(filePath, fallback) {
  try {
    const raw = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    if (err?.code === 'ENOENT') return fallback;
    throw err;
  }
}

async function writeJson(filePath, data) {
  await ensureDir();
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

function normalizeThresholdNumber(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return null;
  return Number(n.toFixed(2));
}

export async function getAlertThresholds() {
  const saved = await readJson(thresholdsFile, { threshold_pct: DEFAULT_THRESHOLD });
  const normalized = normalizeThresholdNumber(saved?.threshold_pct);
  return {
    threshold_pct: normalized == null ? DEFAULT_THRESHOLD : normalized,
  };
}

export async function setAlertThreshold(thresholdPct) {
  const normalized = normalizeThresholdNumber(thresholdPct);
  if (normalized == null) {
    throw new Error('Invalid threshold value');
  }

  const next = { threshold_pct: normalized };
  await writeJson(thresholdsFile, next);
  return next;
}

export async function resetAlertThreshold() {
  const next = { threshold_pct: DEFAULT_THRESHOLD };
  await writeJson(thresholdsFile, next);
  return next;
}

export function classifyAlertSeverity(dropPct, thresholds) {
  const threshold = normalizeThresholdNumber(thresholds?.threshold_pct);
  const pct = Number(dropPct);
  if (!Number.isFinite(pct) || threshold == null || pct < threshold) return null;
  if (pct >= threshold * 2) return 'high';
  if (pct >= threshold * 1.5) return 'medium';
  return 'low';
}

export async function appendAlertHistory(events) {
  if (!Array.isArray(events) || events.length === 0) return;
  const prior = await readJson(historyFile, []);
  const now = new Date().toISOString();
  const withTimestamps = events.map((event) => ({
    ...event,
    detected_at: event.detected_at || now,
  }));

  // Prevent rapid duplicate inserts caused by repeated notif polling.
  const recentWindow = prior.slice(-1000);
  const seen = new Set(
    recentWindow.map((event) => {
      const minute = String(event.detected_at || '').slice(0, 16);
      return `${event.product}|${event.severity}|${event.drop_pct}|${minute}`;
    })
  );

  const uniqueNew = withTimestamps.filter((event) => {
    const minute = String(event.detected_at || '').slice(0, 16);
    const key = `${event.product}|${event.severity}|${event.drop_pct}|${minute}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const next = [...prior, ...uniqueNew];
  await writeJson(historyFile, next.slice(-5000));
}

export async function getAlertHistory(limit = 500) {
  const rows = await readJson(historyFile, []);
  const safeLimit = Math.max(1, Math.min(Number(limit) || 500, 2000));
  return rows.slice(-safeLimit).reverse();
}

export async function getLastAlertCount() {
  const state = await readJson(countStateFile, { count: null, updated_at: null });
  const count = Number(state?.count);
  return {
    count: Number.isFinite(count) ? count : null,
    updated_at: state?.updated_at || null,
  };
}

export async function setLastAlertCount(count) {
  const n = Number(count);
  const next = {
    count: Number.isFinite(n) ? n : null,
    updated_at: new Date().toISOString(),
  };
  await writeJson(countStateFile, next);
  return next;
}

export async function getRevenueThreshold() {
  const saved = await readJson(revenueThresholdFile, { threshold: DEFAULT_REVENUE_THRESHOLD });
  const n = Number(saved?.threshold);
  return {
    threshold: Number.isFinite(n) && n > 0 ? Number(n.toFixed(2)) : DEFAULT_REVENUE_THRESHOLD,
  };
}

export async function setRevenueThreshold(threshold) {
  const n = Number(threshold);
  if (!Number.isFinite(n) || n < 0) {
    throw new Error('Invalid threshold value');
  }
  const next = { threshold: Number(n.toFixed(2)) };
  await writeJson(revenueThresholdFile, next);
  return next;
}

export async function resetRevenueThreshold() {
  const next = { threshold: DEFAULT_REVENUE_THRESHOLD };
  await writeJson(revenueThresholdFile, next);
  return next;
}
