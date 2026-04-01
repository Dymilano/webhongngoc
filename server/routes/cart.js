const express = require('express');
const { pool } = require('../lib/db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

function normQty(v) {
  const q = parseInt(String(v || '').trim(), 10);
  return Number.isFinite(q) ? Math.max(1, q) : 1;
}

async function ensureCartId(userId) {
  const [rows] = await pool.query('SELECT id FROM carts WHERE user_id = ? LIMIT 1', [userId]);
  if (rows && rows[0] && rows[0].id) return rows[0].id;
  const [ins] = await pool.query('INSERT INTO carts (user_id) VALUES (?)', [userId]);
  return ins.insertId;
}

async function resolveProduct(line) {
  const pid = line && line.product_id;
  const legacy = line && line.legacy_wp_id;
  let prows = [];
  if (pid) {
    [prows] = await pool.query(
      'SELECT id, legacy_wp_id, name, price, sale_price, stock, image_url, slug, published FROM products WHERE id = ? LIMIT 1',
      [pid]
    );
  } else if (legacy) {
    [prows] = await pool.query(
      'SELECT id, legacy_wp_id, name, price, sale_price, stock, image_url, slug, published FROM products WHERE legacy_wp_id = ? LIMIT 1',
      [legacy]
    );
  }
  return prows && prows[0] ? prows[0] : null;
}

async function getCartPayload(userId) {
  const [cartRows] = await pool.query('SELECT id FROM carts WHERE user_id = ? LIMIT 1', [userId]);
  const cartId = cartRows && cartRows[0] ? cartRows[0].id : null;
  if (!cartId) return { items: [], subtotal: 0, count: 0 };

  const [rows] = await pool.query(
    `SELECT ci.id AS cart_item_id, ci.quantity, ci.product_id, ci.legacy_wp_id,
            p.name, p.slug, p.image_url, p.price, p.sale_price, p.stock, p.published
     FROM cart_items ci
     LEFT JOIN products p ON p.id = ci.product_id
     WHERE ci.cart_id = ?
     ORDER BY ci.id DESC`,
    [cartId]
  );

  const items = (rows || [])
    .filter((r) => r && Number(r.quantity) > 0)
    .map((r) => {
      const unit = r.sale_price != null ? Number(r.sale_price) : Number(r.price || 0);
      return {
        cart_item_id: r.cart_item_id,
        quantity: Number(r.quantity || 1),
        product: r && r.name ? {
          id: r.product_id,
          legacy_wp_id: r.legacy_wp_id,
          name: r.name,
          slug: r.slug,
          image_url: r.image_url,
          price: Number(r.price || 0),
          sale_price: r.sale_price == null ? null : Number(r.sale_price),
          stock: r.stock == null ? null : Number(r.stock),
          published: r.published == null ? 0 : Number(r.published)
        } : null,
        unit_price: unit,
        line_total: unit * Number(r.quantity || 1)
      };
    });

  const subtotal = items.reduce((s, x) => s + Number(x.line_total || 0), 0);
  const count = items.reduce((s, x) => s + Number(x.quantity || 0), 0);
  return { items, subtotal, count };
}

// GET /api/cart
router.get('/', requireAuth, async (req, res) => {
  try {
    const userId = req.user && req.user.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const data = await getCartPayload(userId);
    return res.json(data);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Lỗi máy chủ' });
  }
});

// PUT /api/cart  { items: [{product_id?|legacy_wp_id, quantity}] } (replace)
router.put('/', requireAuth, async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const userId = req.user && req.user.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const items = Array.isArray(req.body && req.body.items) ? req.body.items : [];

    await conn.beginTransaction();
    const [cartRows] = await conn.query('SELECT id FROM carts WHERE user_id = ? LIMIT 1', [userId]);
    const cartId = cartRows && cartRows[0] ? cartRows[0].id : (await (async () => {
      const [ins] = await conn.query('INSERT INTO carts (user_id) VALUES (?)', [userId]);
      return ins.insertId;
    })());

    await conn.query('DELETE FROM cart_items WHERE cart_id = ?', [cartId]);

    for (const line of items) {
      const p = await resolveProduct(line);
      if (!p || !p.published) continue;
      const qty = normQty(line.quantity);
      await conn.query(
        'INSERT INTO cart_items (cart_id, product_id, legacy_wp_id, quantity) VALUES (?, ?, ?, ?)',
        [cartId, p.id, p.legacy_wp_id || null, qty]
      );
    }

    await conn.commit();
    const out = await getCartPayload(userId);
    return res.json(out);
  } catch (e) {
    await conn.rollback();
    console.error(e);
    return res.status(500).json({ error: 'Lỗi máy chủ' });
  } finally {
    conn.release();
  }
});

// POST /api/cart/items  {product_id?|legacy_wp_id, quantity} (upsert by product_id)
router.post('/items', requireAuth, async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const userId = req.user && req.user.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const p = await resolveProduct(req.body || {});
    if (!p || !p.published) return res.status(400).json({ error: 'Sản phẩm không hợp lệ' });
    const qty = normQty(req.body && req.body.quantity);

    await conn.beginTransaction();
    const cartId = await ensureCartId(userId);
    const [exist] = await conn.query(
      'SELECT id FROM cart_items WHERE cart_id = ? AND product_id = ? LIMIT 1',
      [cartId, p.id]
    );
    if (exist && exist[0] && exist[0].id) {
      await conn.query('UPDATE cart_items SET quantity = ? WHERE id = ?', [qty, exist[0].id]);
    } else {
      await conn.query(
        'INSERT INTO cart_items (cart_id, product_id, legacy_wp_id, quantity) VALUES (?, ?, ?, ?)',
        [cartId, p.id, p.legacy_wp_id || null, qty]
      );
    }
    await conn.commit();
    const out = await getCartPayload(userId);
    return res.json(out);
  } catch (e) {
    await conn.rollback();
    console.error(e);
    return res.status(500).json({ error: 'Lỗi máy chủ' });
  } finally {
    conn.release();
  }
});

// PATCH /api/cart/items/:id  {quantity}
router.patch('/items/:id', requireAuth, async (req, res) => {
  try {
    const userId = req.user && req.user.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'ID không hợp lệ' });
    const qty = normQty(req.body && req.body.quantity);

    const [cartRows] = await pool.query('SELECT id FROM carts WHERE user_id = ? LIMIT 1', [userId]);
    const cartId = cartRows && cartRows[0] ? cartRows[0].id : null;
    if (!cartId) return res.json({ items: [], subtotal: 0, count: 0 });

    await pool.query('UPDATE cart_items SET quantity = ? WHERE id = ? AND cart_id = ?', [qty, id, cartId]);
    const out = await getCartPayload(userId);
    return res.json(out);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Lỗi máy chủ' });
  }
});

// DELETE /api/cart/items/:id
router.delete('/items/:id', requireAuth, async (req, res) => {
  try {
    const userId = req.user && req.user.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'ID không hợp lệ' });

    const [cartRows] = await pool.query('SELECT id FROM carts WHERE user_id = ? LIMIT 1', [userId]);
    const cartId = cartRows && cartRows[0] ? cartRows[0].id : null;
    if (!cartId) return res.json({ items: [], subtotal: 0, count: 0 });

    await pool.query('DELETE FROM cart_items WHERE id = ? AND cart_id = ?', [id, cartId]);
    const out = await getCartPayload(userId);
    return res.json(out);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Lỗi máy chủ' });
  }
});

// DELETE /api/cart (clear)
router.delete('/', requireAuth, async (req, res) => {
  try {
    const userId = req.user && req.user.id;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });
    const [cartRows] = await pool.query('SELECT id FROM carts WHERE user_id = ? LIMIT 1', [userId]);
    const cartId = cartRows && cartRows[0] ? cartRows[0].id : null;
    if (!cartId) return res.json({ ok: true });
    await pool.query('DELETE FROM cart_items WHERE cart_id = ?', [cartId]);
    return res.json({ ok: true });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Lỗi máy chủ' });
  }
});

module.exports = router;

