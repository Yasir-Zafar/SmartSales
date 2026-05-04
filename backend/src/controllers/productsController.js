import { supabaseAdmin } from '../config/db.js';

/** List catalog rows for owner/staff inventory UI */
export async function listProducts(req, res) {
  try {
    const { data, error } = await supabaseAdmin
      .from('products')
      .select('id, name, category, price, cost_price, stock_quantity')
      .order('name', { ascending: true });

    if (error) return res.status(400).json({ message: error.message });
    return res.json({ products: data || [] });
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
}
