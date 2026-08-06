import { api } from './api';

/**
 * Client-side read cache with request de-duplication.
 *
 * Pages used to fetch on mount, so opening a tab meant waiting for the model
 * service every single time. With this, the app warms the data it knows a role
 * will need as soon as they sign in, and a tab renders from memory instead of
 * from a network round-trip.
 *
 * Deliberately small: a Map, a TTL and an in-flight registry. Anything more
 * (normalisation, background revalidation queues) would be a state library, and
 * this app does not need one.
 */

const store = new Map();   // key -> { value, expiresAt }
const inflight = new Map(); // key -> Promise

const DEFAULT_TTL = 60_000;

/** Reads a fresh cache entry, or undefined if missing/stale. */
export function peek(key) {
  const hit = store.get(key);
  if (hit && hit.expiresAt > Date.now()) return hit.value;
  return undefined;
}

/**
 * Returns cached data when fresh, otherwise fetches it. Concurrent callers for
 * the same key share one request rather than each firing their own.
 */
export function load(key, fetcher, { ttl = DEFAULT_TTL, force = false } = {}) {
  if (!force) {
    const hit = peek(key);
    if (hit !== undefined) return Promise.resolve(hit);

    const pending = inflight.get(key);
    if (pending) return pending;
  }

  const promise = Promise.resolve()
    .then(fetcher)
    .then((value) => {
      store.set(key, { value, expiresAt: Date.now() + ttl });
      return value;
    })
    .finally(() => {
      inflight.delete(key);
    });

  inflight.set(key, promise);
  return promise;
}

/** Convenience wrapper for plain GETs. */
export function loadGet(key, url, config, options) {
  return load(key, () => api.get(url, config).then((res) => res.data), options);
}

export function invalidate(prefix) {
  if (prefix === undefined) {
    store.clear();
    return;
  }
  for (const key of [...store.keys()]) {
    if (key.startsWith(prefix)) store.delete(key);
  }
}

// ── Prefetch ─────────────────────────────────────────────────────────────────

/**
 * What each role is likely to open, warmed in the background right after
 * sign-in. Failures are swallowed on purpose: this is opportunistic, and the
 * page itself still renders a proper error state if it genuinely cannot load.
 */
const PREFETCH_BY_ROLE = {
  OWNER: [
    ['kpis', '/insights/owner/kpis/live'],
    ['forecasts:owner', '/insights/owner/forecasts', { params: { limit: 50, sort_by: 'ensemble_total' } }],
    ['forecasts:latest', '/insights/owner/forecasts/latest'],
    ['anomalies:active', '/insights/alerts/notifications/abnormal-drops'],
    ['anomalies:status', '/insights/alerts/dropped-status'],
    ['inventory:risk', '/insights/staff/inventory/risk'],
    ['products', '/products'],
    ['segments:members', '/insights/owner/customer-segments'],
    ['categories', '/csv/categories'],
  ],
  ANALYST: [
    ['forecasts:analyst', '/insights/analyst/forecasts', { params: { limit: 50, sort_by: 'ensemble_total' } }],
    ['anomalies:active', '/insights/alerts/notifications/abnormal-drops'],
    ['anomalies:status', '/insights/alerts/dropped-status'],
    ['anomalies:history', '/insights/alerts/history/abnormal-drops', { params: { limit: 2000 } }],
    ['segments:profiles', '/insights/analyst/segments'],
    ['categories', '/csv/categories'],
    ['uploads', '/csv'],
  ],
  STAFF: [
    ['sales:summary', '/insights/staff/sales-summary'],
    ['inventory:risk', '/insights/staff/inventory/risk'],
    ['products', '/products'],
    ['uploads', '/csv'],
    ['categories', '/csv/categories'],
  ],
  ADMIN: [
    ['kpis', '/insights/owner/kpis/live'],
    ['forecasts:owner', '/insights/owner/forecasts', { params: { limit: 50, sort_by: 'ensemble_total' } }],
    ['anomalies:active', '/insights/alerts/notifications/abnormal-drops'],
    ['anomalies:status', '/insights/alerts/dropped-status'],
    ['inventory:risk', '/insights/staff/inventory/risk'],
    ['products', '/products'],
    ['uploads', '/csv'],
    ['users', '/admin/users/list'],
    ['categories', '/csv/categories'],
  ],
};

let prefetchedFor = null;

/**
 * Warms the cache for a role. Requests go out in small waves so a slow model
 * service cannot saturate the browser's connection pool and delay whatever the
 * user actually clicked on first.
 */
export async function prefetchForRole(role) {
  if (!role || prefetchedFor === role) return;
  prefetchedFor = role;

  const entries = PREFETCH_BY_ROLE[role] || [];
  const WAVE = 3;

  for (let i = 0; i < entries.length; i += WAVE) {
    const wave = entries.slice(i, i + WAVE);
    // eslint-disable-next-line no-await-in-loop
    await Promise.all(
      wave.map(([key, url, config]) =>
        loadGet(key, url, config, { ttl: 120_000 }).catch(() => undefined)
      )
    );
  }
}

export function resetPrefetch() {
  prefetchedFor = null;
  invalidate();
}

const dataCache = { peek, load, loadGet, invalidate, prefetchForRole, resetPrefetch };
export default dataCache;
