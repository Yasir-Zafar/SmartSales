/**
 * Pagination helper for Supabase/PostgREST reads.
 *
 * PostgREST enforces a server-side `max-rows` cap (1000 on Supabase) on every
 * request. A plain `.select()` therefore returns *at most* 1000 rows and gives
 * no indication it truncated — and `.limit(50000)` does not raise the cap
 * either. Any query that aggregates a whole table (revenue totals, customer
 * segmentation, model training exports) silently computed from a slice of the
 * data instead of all of it.
 *
 * Server-side aggregates (`total_price.sum()`) would avoid the round-trips
 * entirely, but this project's PostgREST has them disabled
 * ("Use of aggregate functions is not allowed"), so paging is the only option.
 *
 * Pages are fetched in CONCURRENT WAVES. Walking 37k rows one page at a time
 * against a remote region took ~8.7s; requesting a wave at a time brings it
 * under ~2s, which matters because the owner dashboard polls on a timer.
 * A wave stops the walk as soon as any page comes back short, so a small
 * result set still costs a single request.
 *
 * @param buildQuery () => PostgrestFilterBuilder — must return a FRESH query
 *   each call; a builder is single-use and cannot be re-ranged. Deliberately
 *   never re-invokes `.select()` on the caller's builder, which would clobber
 *   their column list.
 */

const PAGE_SIZE = 1000;
const WAVE = 8;

export async function fetchAllRows(buildQuery, { pageSize = PAGE_SIZE, maxRows = 500_000 } = {}) {
  const rows = [];
  let page = 0;

  for (;;) {
    const wave = Array.from({ length: WAVE }, (_, i) => page + i);

    const results = await Promise.all(
      wave.map(async (p) => {
        const from = p * pageSize;
        const { data, error } = await buildQuery().range(from, from + pageSize - 1);
        if (error) throw error;
        return data || [];
      })
    );

    for (const chunk of results) rows.push(...chunk);

    // Any short page means the result set ended inside this wave.
    const reachedEnd = results.some((chunk) => chunk.length < pageSize);
    if (reachedEnd) break;

    page += WAVE;

    if (rows.length >= maxRows) {
      console.warn(`[fetchAllRows] stopped at ${maxRows} rows; result set is larger.`);
      break;
    }
  }

  return rows;
}

export default fetchAllRows;
