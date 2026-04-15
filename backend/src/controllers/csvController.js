import csv from 'csv-parser';
import { Readable } from 'stream';
import { supabaseAdmin } from '../config/db.js';

const REQUIRED_COLUMNS = [
  'sale_date',
  'transaction_id',
  'product_id',
  'product_name',
  'category',
  'quantity',
  'unit_price',
  'total_price'
];

const OPTIONAL_COLUMNS = ['customer_id'];
const FORBIDDEN_COLUMNS = ['id', 'created_at', 'uploaded_by'];

const BATCH_SIZE = 800;

function chunkArray(array, size) {
  const chunks = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

function stableCustomerId(transactionId) {
  const s = String(transactionId || '');
  let h = 0;
  for (let i = 0; i < s.length; i++) h = Math.imul(31, h) + s.charCodeAt(i) | 0;
  return Math.abs(h) % 2147483646 + 1;
}

function validateRow(row, rowIndex) {
  const errors = [];

  if (!row.sale_date || isNaN(Date.parse(row.sale_date)))
    errors.push(`Row ${rowIndex}: invalid sale_date "${row.sale_date}"`);

  if (!row.transaction_id || row.transaction_id.trim() === '')
    errors.push(`Row ${rowIndex}: transaction_id is empty`);

  if (!row.product_id || isNaN(parseInt(row.product_id)))
    errors.push(`Row ${rowIndex}: product_id must be a number`);

  if (!row.product_name || row.product_name.trim() === '')
    errors.push(`Row ${rowIndex}: product_name is empty`);

  if (!row.category || row.category.trim() === '')
    errors.push(`Row ${rowIndex}: category is empty`);

  if (!row.quantity || isNaN(parseInt(row.quantity)) || parseInt(row.quantity) <= 0)
    errors.push(`Row ${rowIndex}: quantity must be a positive number`);

  if (!row.unit_price || isNaN(parseFloat(row.unit_price)) || parseFloat(row.unit_price) <= 0)
    errors.push(`Row ${rowIndex}: unit_price must be a positive number`);

  if (!row.total_price || isNaN(parseFloat(row.total_price)) || parseFloat(row.total_price) <= 0)
    errors.push(`Row ${rowIndex}: total_price must be a positive number`);

  if (row.customer_id != null && String(row.customer_id).trim() !== '') {
    const c = parseInt(row.customer_id, 10);
    if (isNaN(c) || c <= 0)
      errors.push(`Row ${rowIndex}: customer_id must be a positive integer`);
  }

  return errors;
}

export async function uploadCSV(req, res) {
  if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

  const rows = [];
  const validationErrors = [];
  const startTime = Date.now();

  try {
    await new Promise((resolve, reject) => {
      let headersChecked = false;

      Readable.from(req.file.buffer)
        .pipe(csv())
        .on('headers', (headers) => {
          const normalizedHeaders = headers.map(h => h.trim().toLowerCase());

          const forbidden = normalizedHeaders.filter(h => FORBIDDEN_COLUMNS.includes(h));
          if (forbidden.length > 0) {
            reject(new Error(`CSV must not contain these columns: ${forbidden.join(', ')}`));
            return;
          }

          const missing = REQUIRED_COLUMNS.filter(r => !normalizedHeaders.includes(r));
          if (missing.length > 0) {
            reject(new Error(`CSV is missing required columns: ${missing.join(', ')}`));
            return;
          }

          const allowed = new Set([...REQUIRED_COLUMNS, ...OPTIONAL_COLUMNS]);
          const extra = normalizedHeaders.filter(h => !allowed.has(h));
          if (extra.length > 0) {
            reject(new Error(`CSV has unexpected columns: ${extra.join(', ')}`));
            return;
          }

          headersChecked = true;
        })
        .on('data', (row) => {
          if (!headersChecked) return;

          const errors = validateRow(row, rows.length + 1);
          if (errors.length > 0) {
            validationErrors.push(...errors);
          } else {
            const transactionId = row.transaction_id.trim();
            const customerId =
              row.customer_id != null && String(row.customer_id).trim() !== ''
                ? parseInt(row.customer_id, 10)
                : stableCustomerId(transactionId);

            rows.push({
              sale_date: row.sale_date,
              transaction_id: transactionId,
              product_id: parseInt(row.product_id),
              product_name: row.product_name.trim(),
              category: row.category.trim(),
              quantity: parseInt(row.quantity),
              unit_price: parseFloat(row.unit_price),
              total_price: parseFloat(row.total_price),
              customer_id: customerId,
              uploaded_by: req.user.id
            });
          }
        })
        .on('end', resolve)
        .on('error', reject);
    });

    if (validationErrors.length > 0) {
      await supabaseAdmin.from('csv_uploads').insert([{
        uploaded_by: req.user.id,
        file_name: req.file.originalname,
        upload_date: new Date().toISOString().split('T')[0],
        row_count: 0,
        status: 'failed',
        error_message: validationErrors.slice(0, 500).join(' | ')
      }]);

      return res.status(400).json({
        message: 'Validation failed',
        errors: validationErrors.slice(0, 20)
      });
    }

    if (rows.length === 0)
      return res.status(400).json({ message: 'CSV file is empty after validation' });

    const batches = chunkArray(rows, BATCH_SIZE);
    let insertedCount = 0;

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      let { error } = await supabaseAdmin.from('daily_sales').insert(batch);

      if (error && /customer_id/i.test(error.message || '')) {
        const fallback = batch.map(({ customer_id, ...rest }) => rest);
        const retry = await supabaseAdmin.from('daily_sales').insert(fallback);
        error = retry.error;
      }

      if (error) throw new Error(`Insert failed at batch ${i + 1}: ${error.message}`);

      insertedCount += batch.length;
    }

    const duration = ((Date.now() - startTime) / 1000).toFixed(1);

    await supabaseAdmin.from('csv_uploads').insert([{
      uploaded_by: req.user.id,
      file_name: req.file.originalname,
      upload_date: new Date().toISOString().split('T')[0],
      row_count: rows.length,
      status: 'processed',
      duration_seconds: parseFloat(duration)
    }]);

    res.status(201).json({
      message: `Successfully uploaded ${rows.length} rows`,
      duration: `${duration} seconds`,
      batches: batches.length
    });

  } catch (err) {
    await supabaseAdmin.from('csv_uploads').insert([{
      uploaded_by: req.user.id,
      file_name: req.file.originalname,
      upload_date: new Date().toISOString().split('T')[0],
      row_count: rows.length || 0,
      status: 'failed',
      error_message: err.message
    }]);

    res.status(400).json({ message: err.message });
  }
}

export async function getSalesRecords(req, res) {
  try {
    const {
      sortBy = 'time',
      order = 'desc',
      startDate = '',
      endDate = '',
      product = [],
      category = [],
      transaction = []
    } = req.query;

    const sortMap = {
      name: 'product_name',
      time: 'sale_date',
      price: 'total_price',
      sales: 'total_price'
    };

    const sortColumn = sortMap[sortBy] || 'sale_date';
    const asc = order.toLowerCase() === 'asc';

    const toArray = (value) => {
      if (Array.isArray(value)) return value.filter(v => v.trim()).map(v => v.trim());
      if (typeof value === 'string' && value.trim()) return [value.trim()];
      return [];
    };

    const productFilters = toArray(product).map(v => v.toLowerCase());
    const categoryFilters = toArray(category).map(v => v.toLowerCase());
    const transactionFilters = toArray(transaction).map(v => v.toLowerCase());

    let query = supabaseAdmin.from('daily_sales').select('*');

    if (startDate) query = query.gte('sale_date', startDate);
    if (endDate) query = query.lte('sale_date', endDate);

    const { data: records, error } = await query;
    if (error) return res.status(400).json({ message: error.message });

    let filteredRecords = (records || []).filter(row => {
      const productMatch = !productFilters.length || productFilters.some(f => row.product_name?.toLowerCase().includes(f));
      const categoryMatch = !categoryFilters.length || categoryFilters.some(f => row.category?.toLowerCase().includes(f));
      const transactionMatch = !transactionFilters.length || transactionFilters.some(f => row.transaction_id?.toLowerCase().includes(f));
      return productMatch && categoryMatch && transactionMatch;
    });

    filteredRecords.sort((a, b) => {
      const av = a[sortColumn];
      const bv = b[sortColumn];
      if (sortColumn === 'sale_date') return asc ? new Date(av) - new Date(bv) : new Date(bv) - new Date(av);
      if (typeof av === 'number') return asc ? av - bv : bv - av;
      return asc ? String(av).localeCompare(bv) : String(bv).localeCompare(av);
    });

    res.json({ records: filteredRecords });

  } catch {
    res.status(500).json({ message: 'Could not fetch sales records' });
  }
}

export async function getSaleCategories(req, res) {
  try {
    const { data, error } = await supabaseAdmin
      .from('daily_sales')
      .select('category')
      .not('category', 'is', null)
      .neq('category', '');

    if (error) return res.status(400).json({ message: error.message });

    const categories = Array.from(new Set((data || []).map(row => row.category))).sort();
    res.json({ categories });

  } catch {
    res.status(500).json({ message: 'Could not fetch categories' });
  }
}

export async function getCSV(req, res) {
  try {
    const { data, error } = await supabaseAdmin
      .from('csv_uploads')
      .select(`*, profiles (name, role)`)
      .order('created_at', { ascending: false });

    if (error) return res.status(400).json({ message: error.message });

    res.json({ uploads: data });

  } catch {
    res.status(500).json({ message: 'Server error' });
  }
}