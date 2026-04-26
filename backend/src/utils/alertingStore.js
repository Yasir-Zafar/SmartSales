import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.resolve(__dirname, '..', '..', 'data');
const thresholdsFile = path.join(dataDir, 'alert-thresholds.json');
const historyFile = path.join(dataDir, 'alert-history.json');

const DEFAULT_THRESHOLDS = {
  low: 10,
  medium: 20,
  high: 35,
};

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
  const saved = await readJson(thresholdsFile, DEFAULT_THRESHOLDS);
  const hasLow = Object.prototype.hasOwnProperty.call(saved || {}, 'low');
  const hasMedium = Object.prototype.hasOwnProperty.call(saved || {}, 'medium');
  const hasHigh = Object.prototype.hasOwnProperty.call(saved || {}, 'high');

  const low = hasLow ? (saved?.low == null ? null : normalizeThresholdNumber(saved?.low)) : DEFAULT_THRESHOLDS.low;
  const medium = hasMedium ? (saved?.medium == null ? null : normalizeThresholdNumber(saved?.medium)) : DEFAULT_THRESHOLDS.medium;
  const high = hasHigh ? (saved?.high == null ? null : normalizeThresholdNumber(saved?.high)) : DEFAULT_THRESHOLDS.high;

  return {
    low: low == null ? null : low,
    medium: medium == null ? null : medium,
    high: high == null ? null : high,
  };
}

export async function setAlertThreshold(level, thresholdPct) {
  const validLevels = ['low', 'medium', 'high'];
  if (!validLevels.includes(level)) {
    throw new Error('Invalid severity level');
  }
  const normalized = normalizeThresholdNumber(thresholdPct);
  if (normalized == null) {
    throw new Error('Invalid threshold value');
  }

  const thresholds = await getAlertThresholds();
  thresholds[level] = normalized;
  await writeJson(thresholdsFile, thresholds);
  return thresholds;
}

export async function deleteAlertThreshold(level) {
  const validLevels = ['low', 'medium', 'high'];
  if (!validLevels.includes(level)) {
    throw new Error('Invalid severity level');
  }

  const thresholds = await getAlertThresholds();
  thresholds[level] = null;
  await writeJson(thresholdsFile, thresholds);
  return thresholds;
}

function thresholdEntriesForMatching(thresholds) {
  const valid = Object.entries(thresholds || {})
    .map(([level, threshold]) => ({ level, threshold: normalizeThresholdNumber(threshold) }))
    .filter((entry) => entry.threshold != null)
    .sort((a, b) => b.threshold - a.threshold);
  return valid;
}

export function classifyAlertSeverity(dropPct, thresholds) {
  const entries = thresholdEntriesForMatching(thresholds);
  const pct = Number(dropPct);
  if (!Number.isFinite(pct)) return null;
  const match = entries.find((entry) => pct >= entry.threshold);
  return match ? match.level : null;
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
