const express = require('express');
const { pool } = require('../lib/db');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const router = express.Router();

function slugify(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 200);
}

router.get('/public', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, name, slug, parent_id, sort_order FROM categories ORDER BY sort_order ASC, name ASC'
    );
    res.json({ items: rows });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Lỗi máy chủ' });
  }
});

router.get('/', requireAuth, requireAdmin, async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT * FROM categories ORDER BY sort_order ASC, name ASC'
    );
    res.json({ items: rows });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Lỗi máy chủ' });
  }
});

router.post('/', requireAuth, requireAdmin, async (req, res) => {
  try {
    const b = req.body || {};
    let slug = b.slug ? slugify(b.slug) : slugify(b.name);
    if (!slug) slug = 'dm-' + Date.now();
    const [exist] = await pool.query('SELECT id FROM categories WHERE slug = ?', [slug]);
    if (exist.length) slug = slug + '-' + Date.now().toString(36);
    const [r] = await pool.query(
      `INSERT INTO categories (name, slug, parent_id, sort_order) VALUES (:name, :slug, :parent_id, :sort_order)`,
      {
        name: b.name,
        slug,
        parent_id: b.parent_id || null,
        sort_order: b.sort_order != null ? parseInt(b.sort_order, 10) : 0
      }
    );
    res.status(201).json({ id: r.insertId, slug });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Lỗi máy chủ' });
  }
});

router.put('/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const b = req.body || {};
    const fields = [];
    const params = { id: req.params.id };
    if (b.name !== undefined) {
      fields.push('name = :name');
      params.name = b.name;
    }
    if (b.slug !== undefined) {
      fields.push('slug = :slug');
      params.slug = slugify(b.slug);
    }
    if (b.parent_id !== undefined) {
      fields.push('parent_id = :parent_id');
      params.parent_id = b.parent_id || null;
    }
    if (b.sort_order !== undefined) {
      fields.push('sort_order = :sort_order');
      params.sort_order = parseInt(b.sort_order, 10);
    }
    if (!fields.length) return res.status(400).json({ error: 'Không có dữ liệu' });
    await pool.query(`UPDATE categories SET ${fields.join(', ')} WHERE id = :id`, params);
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Lỗi máy chủ' });
  }
});

router.delete('/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    await pool.query('DELETE FROM categories WHERE id = ?', [req.params.id]);
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Không xóa được (có thể còn sản phẩm con)' });
  }
});

module.exports = router;
