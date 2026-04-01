const express = require('express');
const crypto = require('crypto');
const { pool } = require('../lib/db');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { normalizeCode, rowToCoupon, computeDiscount } = require('../lib/coupon');

const router = express.Router();

function orderCode() {
  return 'ORD-' + Date.now().toString(36).toUpperCase() + '-' + crypto.randomBytes(3).toString('hex').toUpperCase();
}

function normEmail(s) {
  return String(s || '').trim().toLowerCase();
}

// Public success page lookup by order_code (no auth) – used by /order-success/
// NOTE: Must be defined BEFORE any "/:id" routes to avoid shadowing.
router.get('/public/:orderCode', async (req, res) => {
  try {
    const code = String(req.params.orderCode || '').trim();
    if (!/^ORD-[A-Z0-9]+-[A-Z0-9]+$/i.test(code)) {
      return res.status(400).json({ error: 'Mã đơn không hợp lệ' });
    }
    const [orders] = await pool.query(
      `SELECT id, order_code, customer_name, email, phone, address, note, total, discount_amount, coupon_code,
              status, payment_method, payment_status, created_at
       FROM orders
       WHERE order_code = ? LIMIT 1`,
      [code]
    );
    const o = orders[0];
    if (!o) return res.status(404).json({ error: 'Không tìm thấy đơn hàng' });
    const [items] = await pool.query('SELECT product_name, quantity, unit_price FROM order_items WHERE order_id = ?', [o.id]);
    return res.json({ order: o, items });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Lỗi máy chủ' });
  }
});

// Đặt hàng từ storefront (public)
router.post('/checkout', async (req, res) => {
  const conn = await pool.getConnection();
  try {
    const b = req.body || {};
    const items = Array.isArray(b.items) ? b.items : [];
    if (!b.customer_name || !b.email || !items.length) {
      return res.status(400).json({ error: 'Thiếu thông tin đơn hàng hoặc sản phẩm' });
    }
    const paymentMethod = b.payment_method === 'bank' ? 'bank' : 'cod';
    await conn.beginTransaction();

    let total = 0;
    const lines = [];
    for (const line of items) {
      // Support both internal product_id and legacy_wp_id (from static WP theme)
      const pid = line.product_id;
      const legacy = line.legacy_wp_id;
      const qty = Math.max(1, parseInt(line.quantity, 10) || 1);
      let prows;
      if (pid) {
        [prows] = await conn.query('SELECT id, name, price, sale_price, stock, published FROM products WHERE id = ?', [pid]);
      } else if (legacy) {
        [prows] = await conn.query(
          'SELECT id, name, price, sale_price, stock, published FROM products WHERE legacy_wp_id = ?',
          [legacy]
        );
      } else {
        prows = [];
      }
      const p = prows[0];
      if (!p || !p.published) {
        await conn.rollback();
        return res.status(400).json({ error: `Sản phẩm không hợp lệ` });
      }
      const stockNum = Number(p.stock);
      if (!Number.isFinite(stockNum) || stockNum < qty) {
        await conn.rollback();
        return res.status(400).json({
          error: `Không đủ hàng: "${p.name}" (còn ${Number.isFinite(stockNum) ? stockNum : 0}, cần ${qty}).`
        });
      }
      const unit = p.sale_price != null ? Number(p.sale_price) : Number(p.price);
      total += unit * qty;
      lines.push({ product_id: p.id, product_name: p.name, quantity: qty, unit_price: unit });
    }

    const subtotal = total;
    let discountAmount = 0;
    let couponId = null;
    let couponCodeNorm = null;
    const rawCoupon = b.coupon_code;
    if (rawCoupon && String(rawCoupon).trim()) {
      const norm = normalizeCode(rawCoupon);
      const [crows] = await conn.query('SELECT * FROM coupons WHERE UPPER(TRIM(code)) = ? LIMIT 1', [norm]);
      if (!crows[0]) {
        await conn.rollback();
        return res.status(400).json({ error: 'Mã giảm giá không tồn tại' });
      }
      const c = rowToCoupon(crows[0]);
      const d = computeDiscount(subtotal, c);
      if (!d.ok) {
        await conn.rollback();
        return res.status(400).json({ error: d.error });
      }
      discountAmount = d.discount;
      couponId = c.id;
      couponCodeNorm = c.code;
    }
    const finalTotal = Math.max(0, Math.round((subtotal - discountAmount) * 100) / 100);

    const code = orderCode();
    const [or] = await conn.query(
      `INSERT INTO orders (order_code, customer_name, email, phone, address, note, total, discount_amount, coupon_code, coupon_id, status, payment_method, payment_status)
       VALUES (:order_code, :customer_name, :email, :phone, :address, :note, :total, :discount_amount, :coupon_code, :coupon_id, 'pending', :payment_method, 'unpaid')`,
      {
        order_code: code,
        customer_name: b.customer_name,
        email: b.email,
        phone: b.phone || null,
        address: b.address || null,
        note: b.note || null,
        total: finalTotal,
        discount_amount: discountAmount,
        coupon_code: couponCodeNorm,
        coupon_id: couponId,
        payment_method: paymentMethod
      }
    );
    const orderId = or.insertId;

    for (const line of lines) {
      await conn.query(
        `INSERT INTO order_items (order_id, product_id, product_name, quantity, unit_price)
         VALUES (:order_id, :product_id, :product_name, :quantity, :unit_price)`,
        {
          order_id: orderId,
          product_id: line.product_id,
          product_name: line.product_name,
          quantity: line.quantity,
          unit_price: line.unit_price
        }
      );
      await conn.query('UPDATE products SET stock = stock - ? WHERE id = ?', [line.quantity, line.product_id]);
    }

    if (couponId) {
      const [upd] = await conn.query(
        `UPDATE coupons SET used_count = used_count + 1 WHERE id = ? AND (max_uses IS NULL OR used_count < max_uses)`,
        [couponId]
      );
      const affected = upd && upd.affectedRows;
      if (!affected) {
        await conn.rollback();
        return res.status(400).json({ error: 'Mã giảm giá không còn lượt' });
      }
    }

    await conn.commit();
    res.status(201).json({
      order_id: orderId,
      order_code: code,
      total: finalTotal,
      subtotal,
      discount_amount: discountAmount
    });
  } catch (e) {
    await conn.rollback();
    console.error(e);
    res.status(500).json({ error: 'Không tạo được đơn hàng' });
  } finally {
    conn.release();
  }
});

// Alias for common REST shape: POST /api/orders
router.post('/', async (req, res) => {
  // Delegate to the same checkout logic.
  req.url = '/checkout';
  return router.handle(req, res);
});

// User: lịch sử đơn hàng theo email của tài khoản đang đăng nhập
router.get('/my', requireAuth, async (req, res) => {
  try {
    const email = normEmail(req.user && req.user.email);
    if (!email) return res.status(400).json({ error: 'Thiếu email user' });

    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const offset = (page - 1) * limit;

    const [rows] = await pool.query(
      `SELECT id, order_code, customer_name, email, phone, address, note, total, discount_amount, coupon_code,
              status, payment_method, payment_status, created_at
       FROM orders
       WHERE LOWER(TRIM(email)) = LOWER(TRIM(?))
       ORDER BY id DESC
       LIMIT ? OFFSET ?`,
      [email, limit, offset]
    );
    const [countRows] = await pool.query(
      `SELECT COUNT(*) AS total
       FROM orders
       WHERE LOWER(TRIM(email)) = LOWER(TRIM(?))`,
      [email]
    );
    const total = countRows && countRows[0] ? countRows[0].total : 0;
    return res.json({ items: rows, page, limit, total: Number(total) });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Lỗi máy chủ' });
  }
});

router.get('/my/:id', requireAuth, async (req, res) => {
  try {
    const email = normEmail(req.user && req.user.email);
    const id = parseInt(req.params.id, 10);
    if (!Number.isFinite(id)) return res.status(400).json({ error: 'ID không hợp lệ' });

    const [orders] = await pool.query(
      `SELECT * FROM orders
       WHERE id = ? AND LOWER(TRIM(email)) = LOWER(TRIM(?))
       LIMIT 1`,
      [id, email]
    );
    if (!orders[0]) return res.status(404).json({ error: 'Không tìm thấy' });
    const [items] = await pool.query('SELECT * FROM order_items WHERE order_id = ?', [id]);
    return res.json({ order: orders[0], items });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Lỗi máy chủ' });
  }
});

router.get('/', requireAuth, requireAdmin, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 30));
    const offset = (page - 1) * limit;
    const status = req.query.status;
    const q = req.query.q ? `%${req.query.q}%` : null;
    const from = req.query.from; // YYYY-MM-DD
    const to = req.query.to;     // YYYY-MM-DD
    let where = '';
    const bind = { limit, offset };
    const clauses = [];
    if (status) { clauses.push('o.status = :st'); bind.st = status; }
    if (q) {
      clauses.push('(o.order_code LIKE :q OR o.customer_name LIKE :q OR o.email LIKE :q OR o.phone LIKE :q)');
      bind.q = q;
    }
    if (from) { clauses.push("substr(o.created_at,1,10) >= :from"); bind.from = from; }
    if (to) { clauses.push("substr(o.created_at,1,10) <= :to"); bind.to = to; }
    if (clauses.length) where = 'WHERE ' + clauses.join(' AND ');
    const [rows] = await pool.query(
      `SELECT o.* FROM orders o ${where} ORDER BY o.id DESC LIMIT :limit OFFSET :offset`,
      bind
    );
    const countBind = Object.assign({}, bind);
    delete countBind.limit;
    delete countBind.offset;
    const [countRows] = await pool.query(`SELECT COUNT(*) AS total FROM orders o ${where}`, countBind);
    const total = countRows && countRows[0] ? countRows[0].total : 0;
    res.json({ items: rows, page, limit, total: Number(total) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Lỗi máy chủ' });
  }
});

router.get('/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const [orders] = await pool.query('SELECT * FROM orders WHERE id = ? LIMIT 1', [req.params.id]);
    if (!orders[0]) return res.status(404).json({ error: 'Không tìm thấy' });
    const [items] = await pool.query('SELECT * FROM order_items WHERE order_id = ?', [req.params.id]);
    res.json({ order: orders[0], items });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Lỗi máy chủ' });
  }
});

router.patch('/:id/status', requireAuth, requireAdmin, async (req, res) => {
  try {
    const status = req.body && req.body.status;
    const allowed = ['pending', 'processing', 'shipped', 'completed', 'cancelled'];
    if (!allowed.includes(status)) return res.status(400).json({ error: 'Status không hợp lệ' });
    await pool.query('UPDATE orders SET status = ? WHERE id = ?', [status, req.params.id]);
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Lỗi máy chủ' });
  }
});

router.patch('/:id/payment', requireAuth, requireAdmin, async (req, res) => {
  try {
    const id = req.params.id;
    const method = req.body && req.body.payment_method;
    const pstatus = req.body && req.body.payment_status;
    const allowedM = ['cod', 'bank'];
    const allowedS = ['unpaid', 'paid', 'refunded'];
    if (method && !allowedM.includes(method)) return res.status(400).json({ error: 'payment_method không hợp lệ' });
    if (pstatus && !allowedS.includes(pstatus)) return res.status(400).json({ error: 'payment_status không hợp lệ' });
    const fields = [];
    const params = { id };
    if (method) { fields.push('payment_method = :m'); params.m = method; }
    if (pstatus) { fields.push('payment_status = :s'); params.s = pstatus; }
    if (!fields.length) return res.status(400).json({ error: 'Không có dữ liệu' });
    await pool.query(`UPDATE orders SET ${fields.join(', ')} WHERE id = :id`, params);
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Lỗi máy chủ' });
  }
});

module.exports = router;
