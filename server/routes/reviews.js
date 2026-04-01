const express = require('express');
const { pool } = require('../lib/db');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const router = express.Router();

router.get('/public/:productId', async (req, res) => {
  try {
    const pid = req.params.productId;
    const [rows] = await pool.query(
      `SELECT id, product_id, author_name, rating, comment, created_at
       FROM product_reviews WHERE product_id = ? AND approved = 1 ORDER BY id DESC LIMIT 100`,
      [pid]
    );
    res.json({ items: rows });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Lỗi máy chủ' });
  }
});

router.post('/submit', async (req, res) => {
  try {
    const b = req.body || {};
    const productId = parseInt(b.product_id, 10);
    const author = (b.author_name || '').trim();
    const rating = Math.min(5, Math.max(1, parseInt(b.rating, 10) || 5));
    if (!productId || !author) {
      return res.status(400).json({ error: 'Thiếu sản phẩm hoặc tên người gửi' });
    }
    const [prows] = await pool.query('SELECT id FROM products WHERE id = ? AND published = 1 LIMIT 1', [productId]);
    if (!prows[0]) return res.status(400).json({ error: 'Sản phẩm không hợp lệ' });
    const email = (b.email || '').trim() || null;
    const comment = b.comment != null ? String(b.comment).slice(0, 5000) : '';
    const userId = b.user_id ? parseInt(b.user_id, 10) : null;
    await pool.query(
      `INSERT INTO product_reviews (product_id, user_id, author_name, email, rating, comment, approved)
       VALUES (:product_id, :user_id, :author_name, :email, :rating, :comment, 0)`,
      {
        product_id: productId,
        user_id: userId || null,
        author_name: author,
        email,
        rating,
        comment
      }
    );
    res.status(201).json({ ok: true, message: 'Đánh giá đã gửi, chờ duyệt' });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Lỗi máy chủ' });
  }
});

router.get('/', requireAuth, requireAdmin, async (req, res) => {
  try {
    const approved = req.query.approved;
    let where = '';
    const params = [];
    if (approved === '0' || approved === '1') {
      where = 'WHERE r.approved = ?';
      params.push(Number(approved));
    }
    const [rows] = await pool.query(
      `SELECT r.*, p.name AS product_name, p.slug AS product_slug
       FROM product_reviews r
       LEFT JOIN products p ON p.id = r.product_id
       ${where}
       ORDER BY r.id DESC LIMIT 500`,
      params
    );
    res.json({ items: rows });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Lỗi máy chủ' });
  }
});

router.patch('/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const id = req.params.id;
    const approved = req.body && req.body.approved;
    if (approved !== true && approved !== false && approved !== 0 && approved !== 1) {
      return res.status(400).json({ error: 'Thiếu approved' });
    }
    const val = approved === true || approved === 1 ? 1 : 0;
    await pool.query('UPDATE product_reviews SET approved = ? WHERE id = ?', [val, id]);
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Lỗi máy chủ' });
  }
});

router.delete('/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    await pool.query('DELETE FROM product_reviews WHERE id = ?', [req.params.id]);
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Lỗi máy chủ' });
  }
});

module.exports = router;
