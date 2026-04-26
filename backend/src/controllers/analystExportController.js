import { supabaseAdmin } from '../config/db.js';

function stableCustomerId(transactionId) {
  const s = String(transactionId);
  let h = 0;
  for (let i = 0; i < s.length; i++) h = Math.imul(31, h) + s.charCodeAt(i) | 0;
  return Math.abs(h) % 2147483646 + 1;
}

function csvEscape(v) {
  const s = String(v ?? '');
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function buildTrainingCsvRows(records) {
  const header = [
    'transaction_id',
    'sale_date',
    'product_id',
    'product_name',
    'category',
    'customer_id',
    'quantity',
    'unit_price',
    'total_price',
  ].join(',');
  const lines = [header];
  for (const row of records) {
    const cid =
      row.customer_id != null && row.customer_id !== ''
        ? parseInt(row.customer_id, 10)
        : stableCustomerId(row.transaction_id);
    lines.push(
      [
        csvEscape(row.transaction_id),
        csvEscape(row.sale_date),
        row.product_id,
        csvEscape(String(row.product_name || '').trim().toLowerCase()),
        csvEscape(String(row.category || '').trim().toLowerCase()),
        cid,
        row.quantity,
        row.unit_price,
        row.total_price,
      ].join(',')
    );
  }
  return lines.join('\n');
}

export async function exportTrainingCsv(req, res) {
  try {
    const startDate = req.query.startDate || req.query.start;
    const endDate = req.query.endDate || req.query.end;
    if (!startDate || !endDate) {
      return res.status(400).json({ message: 'startDate and endDate are required (YYYY-MM-DD)' });
    }

    const { data: records, error } = await supabaseAdmin
      .from('daily_sales')
      .select('*')
      .gte('sale_date', startDate)
      .lte('sale_date', endDate)
      .order('sale_date', { ascending: true });

    if (error) return res.status(400).json({ message: error.message });

    const csv = buildTrainingCsvRows(records || []);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="smartsales_training_${startDate}_${endDate}.csv"`
    );
    return res.send(csv);
  } catch (err) {
    console.error('exportTrainingCsv', err);
    return res.status(500).json({ message: 'Could not export training CSV' });
  }
}

function isInternalMlCaller(req) {
  const expected = process.env.ML_INTERNAL_API_KEY;
  if (!expected) return false;
  const provided = req.headers['x-ml-internal-key'];
  return typeof provided === 'string' && provided === expected;
}

export async function exportTrainingCsvInternal(req, res) {
  if (!isInternalMlCaller(req)) {
    return res.status(403).json({ message: 'Forbidden: invalid internal key' });
  }
  return exportTrainingCsv(req, res);
}

export async function retrainReloadMl(req, res) {
  try {
    const startDate = req.body?.startDate || req.body?.start;
    const endDate = req.body?.endDate || req.body?.end;
    if (!startDate || !endDate) {
      return res.status(400).json({ message: 'startDate and endDate are required (YYYY-MM-DD)' });
    }

    const { data: records, error } = await supabaseAdmin
      .from('daily_sales')
      .select('*')
      .gte('sale_date', startDate)
      .lte('sale_date', endDate)
      .order('sale_date', { ascending: true });

    if (error) return res.status(400).json({ message: error.message });
    if (!records?.length) return res.status(400).json({ message: 'No rows in that date range' });

    const csv = buildTrainingCsvRows(records);
    const mlBase = (process.env.ML_BASE_URL || 'http://localhost:8000').replace(/\/+$/, '');
    const formData = new FormData();
    formData.append(
      'file',
      new Blob([csv], { type: 'text/csv' }),
      `smartsales_training_${startDate}_${endDate}.csv`
    );

    const mlRes = await fetch(`${mlBase}/reload`, { method: 'POST', body: formData });
    const text = await mlRes.text();
    let payload;
    try {
      payload = text ? JSON.parse(text) : null;
    } catch {
      payload = { message: text };
    }
    if (!mlRes.ok) {
      const msg = payload?.detail || payload?.message || 'ML reload failed';
      return res.status(400).json({ message: msg, ml: payload });
    }

    return res.json({
      message: 'ML service reloaded with exported daily_sales data',
      row_count: records.length,
      ml: payload,
    });
  } catch (err) {
    console.error('retrainReloadMl', err);
    return res.status(500).json({ message: err.message || 'Retrain failed' });
  }
}
