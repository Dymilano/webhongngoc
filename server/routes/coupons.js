const express = require('express');
const { pool } = require('../lib/db');
const { requireAuth, requireAdmin } = require('../middleware/auth');
const { normalizeCode, rowToCoupon, computeDiscount } = require('../lib/coupon');

const router = express.Router();

router.post('/validate', async (req, res) => {
  try {
    const b = req.body || {};
    const code = normalizeCode(b.code);
    const subtotal = Number(b.subtotal);
    if (!code) return res.status(400).json({ error: 'Nhập mã giảm giá' });
    if (!Number.isFinite(subtotal) || subtotal < 0) {
      return res.status(400).json({ error: 'Tổng tiền không hợp lệ' });
    }
    const [rows] = await pool.query('SELECT * FROM coupons WHERE UPPER(TRIM(code)) = ? LIMIT 1', [code]);
    const row = rows[0];
    if (!row) return res.status(400).json({ error: 'Mã không tồn tại' });
    const c = rowToCoupon(row);
    const d = computeDiscount(subtotal, c);
    if (!d.ok) return res.status(400).json({ error: d.error });
    res.json({
      ok: true,
      discount: d.discount,
      final_subtotal: d.final_subtotal,
      code: c.code
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Lỗi máy chủ' });
  }
});

router.get('/', requireAuth, requireAdmin, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM coupons ORDER BY id DESC');
    res.json({ items: rows });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Lỗi máy chủ' });
  }
});

router.post('/', requireAuth, requireAdmin, async (req, res) => {
  try {
    const b = req.body || {};
    const code = normalizeCode(b.code);
    if (!code) return res.status(400).json({ error: 'Thiếu mã' });
    const discountType = b.discount_type === 'fixed' ? 'fixed' : 'percent';
    const discountValue = Number(b.discount_value);
    if (!Number.isFinite(discountValue) || discountValue <= 0) {
      return res.status(400).json({ error: 'Giá trị giảm không hợp lệ' });
    }
    if (discountType === 'percent' && discountValue > 100) {
      return res.status(400).json({ error: 'Phần trăm tối đa 100' });
    }
    const minOrder = Math.max(0, Number(b.min_order) || 0);
    const maxUses = b.max_uses != null && b.max_uses !== '' ? parseInt(b.max_uses, 10) : null;
    const startsAt = b.starts_at ? String(b.starts_at).trim() || null : null;
    const endsAt = b.ends_at ? String(b.ends_at).trim() || null : null;
    const active = b.active === false || b.active === 0 ? 0 : 1;

    await pool.query(
      `INSERT INTO coupons (code, discount_type, discount_value, min_order, max_uses, used_count, starts_at, ends_at, active)
       VALUES (:code, :discount_type, :discount_value, :min_order, :max_uses, 0, :starts_at, :ends_at, :active)`,
      {
        code,
        discount_type: discountType,
        discount_value: discountValue,
        min_order: minOrder,
        max_uses: maxUses != null && Number.isFinite(maxUses) ? maxUses : null,
        starts_at: startsAt,
        ends_at: endsAt,
        active
      }
    );
    const [rows] = await pool.query('SELECT * FROM coupons WHERE code = ? LIMIT 1', [code]);
    res.status(201).json(rows[0]);
  } catch (e) {
    const msg = e && e.message ? String(e.message) : '';
    if (e && (e.code === 'SQLITE_CONSTRAINT' || e.code === 'ER_DUP_ENTRY' || msg.includes('UNIQUE'))) {
      return res.status(400).json({ error: 'Mã đã tồn tại' });
    }
    console.error(e);
    res.status(500).json({ error: 'Lỗi máy chủ' });
  }
});

router.put('/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const id = req.params.id;
    const [existing] = await pool.query('SELECT * FROM coupons WHERE id = ? LIMIT 1', [id]);
    if (!existing[0]) return res.status(404).json({ error: 'Không tìm thấy' });
    const b = req.body || {};
    const code = b.code != null ? normalizeCode(b.code) : existing[0].code;
    if (!code) return res.status(400).json({ error: 'Thiếu mã' });
    const discountType = b.discount_type === 'fixed' ? 'fixed' : b.discount_type === 'percent' ? 'percent' : existing[0].discount_type;
    const discountValue = b.discount_value != null ? Number(b.discount_value) : Number(existing[0].discount_value);
    const minOrder = b.min_order != null ? Math.max(0, Number(b.min_order)) : Number(existing[0].min_order);
    const maxUses = b.max_uses !== undefined ? (b.max_uses === '' || b.max_uses == null ? null : parseInt(b.max_uses, 10)) : existing[0].max_uses;
    const startsAt = b.starts_at !== undefined ? (b.starts_at ? String(b.starts_at).trim() : null) : existing[0].starts_at;
    const endsAt = b.ends_at !== undefined ? (b.ends_at ? String(b.ends_at).trim() : null) : existing[0].ends_at;
    const active = b.active !== undefined ? (b.active === false || b.active === 0 ? 0 : 1) : existing[0].active;

    await pool.query(
      `UPDATE coupons SET
        code = :code,
        discount_type = :discount_type,
        discount_value = :discount_value,
        min_order = :min_order,
        max_uses = :max_uses,
        starts_at = :starts_at,
        ends_at = :ends_at,
        active = :active
       WHERE id = :id`,
      {
        id,
        code,
        discount_type: discountType,
        discount_value: discountValue,
        min_order: minOrder,
        max_uses: maxUses != null && Number.isFinite(maxUses) ? maxUses : null,
        starts_at: startsAt,
        ends_at: endsAt,
        active
      }
    );
    const [rows] = await pool.query('SELECT * FROM coupons WHERE id = ? LIMIT 1', [id]);
    res.json(rows[0]);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Lỗi máy chủ' });
  }
});

router.delete('/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    await pool.query('DELETE FROM coupons WHERE id = ?', [req.params.id]);
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Lỗi máy chủ' });
  }
});

module.exports = router;
