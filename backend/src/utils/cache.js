/**
 * Tiny in-memory TTL cache for expensive read aggregates.
 *
 * Some dashboard endpoints have to page the whole daily_sales table (PostgREST
 * has aggregates disabled, so there is no server-side SUM available). That is a
 * few seconds of round-trips, and the owner overview re-polls on a timer — so
 * without this, the same multi-second scan runs every 30 seconds per viewer.
 *
 * Deliberately process-local and unbounded-in-time only by TTL: the underlying
 * data changes just on CSV upload or model reload, so briefly stale reads are
 * acceptable where a slow dashboard is not. Anything that mutates sales data
 * should call `invalidateCache()`.
 */

const store = new Map();

/**
 * Returns the cached value for `key`, or runs `producer` and caches it.
 * Concurrent callers share one in-flight promise rather than each starting
 * their own scan.
 */
export async function cached(key, ttlMs, producer) {
  const hit = store.get(key);
  if (hit && hit.expiresAt > Date.now()) return hit.promise;

  const promise = Promise.resolve().then(producer);
  store.set(key, { promise, expiresAt: Date.now() + ttlMs });

  try {
    return await promise;
  } catch (err) {
    // Never cache a failure — the next request should retry immediately.
    store.delete(key);
    throw err;
  }
}

/** Drops one key, or the whole cache when called with no argument. */
export function invalidateCache(key) {
  if (key === undefined) store.clear();
  else store.delete(key);
}

export default { cached, invalidateCache };
