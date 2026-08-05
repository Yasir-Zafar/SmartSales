// Service-role client: daily_sales has RLS enabled, so the anon client this
// used to import returned zero rows for every caller.
import { supabaseAdmin as supabase } from "../config/db.js";

export async function getSalesSummary(req, res){
  try {
    // ── date helpers (UTC) ───────────────────────────────────────────────────
    const now = new Date();

    const todayStr = now.toISOString().split('T')[0]; // "YYYY-MM-DD"

    // start of current ISO week (Monday)
    const dayOfWeek = now.getUTCDay(); // 0 = Sun
    const diffToMonday = (dayOfWeek + 6) % 7;
    const weekStart = new Date(now);
    weekStart.setUTCDate(now.getUTCDate() - diffToMonday);
    const weekStartStr = weekStart.toISOString().split('T')[0];

    // ── today ────────────────────────────────────────────────────────────────
    const { data: todayRows, error: todayErr } = await supabase
      .from('daily_sales')
      .select('transaction_id, total_price, category')
      .gte('sale_date', todayStr)
      .lt('sale_date', new Date(now.getTime() + 86400000).toISOString().split('T')[0])

    if (todayErr) throw todayErr;

    const todayRevenue = todayRows.reduce((s, r) => s + Number(r.total_price), 0);
    const todayTxns = new Set(todayRows.map((r) => r.transaction_id)).size;
    const todayCategories = topCategories(todayRows);

    // ── this week ────────────────────────────────────────────────────────────
    const { data: weekRows, error: weekErr } = await supabase
      .from('daily_sales')
      .select('transaction_id, total_price, category, sale_date')
      .gte('sale_date', weekStartStr)
      .lte('sale_date', todayStr);

    if (weekErr) throw weekErr;

    const weekRevenue = weekRows.reduce((s, r) => s + Number(r.total_price), 0);
    const weekTxns = new Set(weekRows.map((r) => r.transaction_id)).size;
    const weekCategories = topCategories(weekRows);

    // ── daily breakdown for the week (for the mini bar chart) ────────────────
    const dailyMap = {};
    for (const row of weekRows) {
      dailyMap[row.sale_date] = (dailyMap[row.sale_date] || 0) + Number(row.total_price);
    }
    const dailyBreakdown = Object.entries(dailyMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, revenue]) => ({ date, revenue: +revenue.toFixed(2) }));

    res.json({
      today: {
        revenue: +todayRevenue.toFixed(2),
        transactions: todayTxns,
        topCategories: todayCategories,
      },
      week: {
        revenue: +weekRevenue.toFixed(2),
        transactions: weekTxns,
        topCategories: weekCategories,
        dailyBreakdown,
        startDate: weekStartStr,
      },
    });
  } catch (err) {
    console.error('[sales-summary]', err);
    res.status(500).json({ message: err.message || 'Failed to load sales summary' });
  }
};

// ── helper ───────────────────────────────────────────────────────────────────
function topCategories(rows, limit = 4) {
  const map = {};
  for (const r of rows) {
    const cat = r.category || 'other';
    map[cat] = (map[cat] || 0) + Number(r.total_price);
  }
  return Object.entries(map)
    .sort(([, a], [, b]) => b - a)
    .slice(0, limit)
    .map(([name, revenue]) => ({ name, revenue: +revenue.toFixed(2) }));
}