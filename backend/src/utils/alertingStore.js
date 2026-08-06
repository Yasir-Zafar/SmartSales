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

/**
 * Per-file write queue.
 *
 * These stores are read-modify-write over a JSON file, and the anomalies page
 * hits several of them at once (the notifications call appends history while
 * the history call reads it). Without serialising, concurrent appends lost
 * each other's events.
 */
const writeQueues = new Map();

function withFileLock(filePath, task) {
  const previous = writeQueues.get(filePath) || Promise.resolve();
  // Swallow the predecessor's rejection so one failure cannot poison the chain.
  const next = previous.catch(() => {}).then(task);
  writeQueues.set(
    filePath,
    next.catch(() => {})
  );
  return next;
}

async function readJson(filePath, fallback) {
  try {
    const raw = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    if (err?.code === 'ENOENT') return fallback;
    // A malformed or half-written file must not take an endpoint down with a
    // 500 — the alert history is derived data and can be rebuilt by the next
    // detection run.
    if (err instanceof SyntaxError) {
      console.warn(`[alertingStore] ${path.basename(filePath)} was unreadable; starting fresh.`);
      return fallback;
    }
    throw err;
  }
}

/**
 * Writes via a temp file + rename. `fs.writeFile` truncates first, so a reader
 * landing mid-write saw an empty or partial file and threw a JSON parse error.
 * Rename is atomic within a filesystem, so a reader sees either the old file or
 * the new one — never a torn one.
 *
 * The temp name must be unique PER CALL, not just per process: two concurrent
 * writers sharing one temp path meant the first rename moved the file out from
 * under the second, which then failed with ENOENT and surfaced as a 500.
 */
let tempCounter = 0;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function writeJson(filePath, data) {
  await ensureDir();
  const temp = `${filePath}.${process.pid}.${Date.now()}.${tempCounter++}.tmp`;
  try {
    await fs.writeFile(temp, JSON.stringify(data, null, 2), 'utf-8');

    // Windows refuses to rename over a file another handle currently has open
    // (EPERM/EBUSY) — a concurrent reader, or an antivirus scanner, is enough.
    // The condition is transient, so retry briefly before giving up.
    for (let attempt = 0; ; attempt++) {
      try {
        await fs.rename(temp, filePath);
        return;
      } catch (err) {
        const transient = err?.code === 'EPERM' || err?.code === 'EBUSY' || err?.code === 'EACCES';
        if (!transient || attempt >= 5) throw err;
        await sleep(15 * (attempt + 1));
      }
    }
  } catch (err) {
    // Never leave a stray temp file behind if the write or rename failed.
    await fs.unlink(temp).catch(() => {});
    throw err;
  }
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
  // Serialised: the read and the write must be one indivisible step, or two
  // concurrent detection runs each overwrite the other's appended events.
  return withFileLock(historyFile, () => appendAlertHistoryLocked(events));
}

async function appendAlertHistoryLocked(events) {
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
  // Reads share the write lock so this process never holds the file open while
  // an append tries to rename over it — which on Windows fails outright.
  const rows = await withFileLock(historyFile, () => readJson(historyFile, []));
  const safeLimit = Math.max(1, Math.min(Number(limit) || 500, 2000));
  return rows.slice(-safeLimit).reverse();
}

export async function getLastAlertCount() {
  const state = await withFileLock(countStateFile, () =>
    readJson(countStateFile, { count: null, updated_at: null })
  );
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
  await withFileLock(countStateFile, () => writeJson(countStateFile, next));
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
