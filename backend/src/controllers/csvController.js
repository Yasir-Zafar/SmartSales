import csv from 'csv-parser';
import { Readable } from 'stream';
import { supabaseAdmin } from '../config/db.js';

// Exactly these columns, nothing more, nothing less
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

const FORBIDDEN_COLUMNS = ['id', 'created_at', 'uploaded_by'];

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

  return errors;
}

export async function uploadCSV(req, res) {
  if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

  const rows = [];
  const validationErrors = [];

  try {
    await new Promise((resolve, reject) => {
      let headersChecked = false;

      Readable.from(req.file.buffer)
        .pipe(csv())
        .on('headers', (headers) => {
          // Check for forbidden columns
          const forbidden = headers.filter(h => FORBIDDEN_COLUMNS.includes(h.trim().toLowerCase()));
          if (forbidden.length > 0) {
            reject(new Error(`CSV must not contain these columns: ${forbidden.join(', ')}`));
            return;
          }

          // Check all required columns are present
          const missing = REQUIRED_COLUMNS.filter(r => !headers.map(h => h.trim().toLowerCase()).includes(r));
          if (missing.length > 0) {
            reject(new Error(`CSV is missing required columns: ${missing.join(', ')}`));
            return;
          }

          // Check for unexpected extra columns
          const extra = headers.filter(h => !REQUIRED_COLUMNS.includes(h.trim().toLowerCase()));
          if (extra.length > 0) {
            reject(new Error(`CSV has unexpected columns: ${extra.join(', ')}`));
            return;
          }

          headersChecked = true;
        })
        .on('data', (row, index) => {
          if (!headersChecked) return;
          const errors = validateRow(row, rows.length + 1);
          if (errors.length > 0) {
            validationErrors.push(...errors);
          } else {
            rows.push({
              sale_date:      row.sale_date,
              transaction_id: row.transaction_id.trim(),
              product_id:     parseInt(row.product_id),
              product_name:   row.product_name.trim(),
              category:       row.category.trim(),
              quantity:       parseInt(row.quantity),
              unit_price:     parseFloat(row.unit_price),
              total_price:    parseFloat(row.total_price),
              uploaded_by:    req.user.id
            });
          }
        })
        .on('end', resolve)
        .on('error', reject);
    });

    // If any row-level validation failed, reject the whole upload
    if (validationErrors.length > 0) {
      await supabaseAdmin.from('csv_uploads').insert([{
        uploaded_by:   req.user.id,
        file_name:     req.file.originalname,
        upload_date:   new Date().toISOString().split('T')[0],
        row_count:     0,
        status:        'failed',
        error_message: validationErrors.join(' | ')
      }]);
      return res.status(400).json({ message: 'Validation failed', errors: validationErrors });
    }

    if (rows.length === 0)
      return res.status(400).json({ message: 'CSV file is empty' });

    const { error } = await supabaseAdmin.from('daily_sales').insert(rows);

    if (error) {
      console.error('Supabase insert error:', error);
      return res.status(400).json({ message: error.message });
    }

    await supabaseAdmin.from('csv_uploads').insert([{
      uploaded_by:  req.user.id,
      file_name:    req.file.originalname,
      upload_date:  new Date().toISOString().split('T')[0],
      row_count:    rows.length,
      status:       'processed'
    }]);

    res.status(201).json({ message: `Successfully uploaded ${rows.length} rows` });

  } catch (err) {
    console.error('CSV upload error:', err);

    await supabaseAdmin.from('csv_uploads').insert([{
      uploaded_by:   req.user.id,
      file_name:     req.file.originalname,
      upload_date:   new Date().toISOString().split('T')[0],
      row_count:     0,
      status:        'failed',
      error_message: err.message
    }]);

    res.status(400).json({ message: err.message });
  }
};

export async function getCSV(req, res){
  try {
    const { data, error } = await supabaseAdmin
      .from('csv_uploads')
      .select(`
        *,
        profiles (name, role)
      `)
      .order('created_at', { ascending: false });

    if (error) return res.status(400).json({ message: error.message });

    res.json({ uploads: data });
  } catch (err) {
    console.error('Upload history error:', err);
    res.status(500).json({ message: 'Server error' });
  }
}