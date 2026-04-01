const express = require('express');
const { pool } = require('../lib/db');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const router = express.Router();

function slugify(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'item-' + Date.now();
}

router.get('/public', async (req, res) => {
  try {
    const type = req.query.type;
    let where = 'WHERE published = 1';
    const params = [];
    if (type) {
      where += ' AND type = ?';
      params.push(type);
    }
    const [rows] = await pool.query(
      `SELECT id, type, title, slug, excerpt, body, image_url, sort_order, published, created_at, updated_at
       FROM cms_posts ${where} ORDER BY sort_order ASC, id DESC`,
      params
    );
    res.json({ items: rows });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Lỗi máy chủ' });
  }
});

router.get('/public/slug/:slug', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, type, title, slug, excerpt, body, image_url, sort_order, published, created_at, updated_at
       FROM cms_posts WHERE slug = ? AND published = 1 LIMIT 1`,
      [req.params.slug]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Không tìm thấy' });
    res.json(rows[0]);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Lỗi máy chủ' });
  }
});

router.get('/admin', requireAuth, requireAdmin, async (req, res) => {
  try {
    const type = req.query.type;
    let where = '';
    const params = [];
    if (type) {
      where = 'WHERE type = ?';
      params.push(type);
    }
    const [rows] = await pool.query(
      `SELECT id, type, title, slug, excerpt, body, image_url, sort_order, published, created_at, updated_at
       FROM cms_posts ${where} ORDER BY sort_order ASC, id DESC`,
      params
    );
    res.json({ items: rows });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Lỗi máy chủ' });
  }
});

router.post('/admin', requireAuth, requireAdmin, async (req, res) => {
  try {
    const b = req.body || {};
    const title = (b.title || '').trim();
    if (!title) return res.status(400).json({ error: 'Thiếu tiêu đề' });
    const type = ['post', 'banner', 'page'].includes(b.type) ? b.type : 'post';
    let slug = (b.slug || '').trim() ? slugify(b.slug) : slugify(title);
    const [dup] = await pool.query('SELECT id FROM cms_posts WHERE slug = ? LIMIT 1', [slug]);
    if (dup[0]) slug = slug + '-' + Date.now().toString(36);
    await pool.query(
      `INSERT INTO cms_posts (type, title, slug, excerpt, body, image_url, sort_order, published, updated_at)
       VALUES (:type, :title, :slug, :excerpt, :body, :image_url, :sort_order, :published, CURRENT_TIMESTAMP)`,
      {
        type,
        title,
        slug,
        excerpt: b.excerpt != null ? String(b.excerpt) : null,
        body: b.body != null ? String(b.body) : null,
        image_url: b.image_url != null ? String(b.image_url).trim() || null : null,
        sort_order: Math.max(0, parseInt(b.sort_order, 10) || 0),
        published: b.published === false || b.published === 0 ? 0 : 1
      }
    );
    const [rows] = await pool.query('SELECT * FROM cms_posts WHERE slug = ? LIMIT 1', [slug]);
    res.status(201).json(rows[0]);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Lỗi máy chủ' });
  }
});

router.put('/admin/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const id = req.params.id;
    const [rows] = await pool.query('SELECT * FROM cms_posts WHERE id = ? LIMIT 1', [id]);
    if (!rows[0]) return res.status(404).json({ error: 'Không tìm thấy' });
    const b = req.body || {};
    const title = (b.title || rows[0].title || '').trim();
    let slug = slugify(b.slug || rows[0].slug);
    if (slug !== rows[0].slug) {
      const [dup] = await pool.query('SELECT id FROM cms_posts WHERE slug = ? AND id != ? LIMIT 1', [slug, id]);
      if (dup[0]) slug = slug + '-' + Date.now().toString(36);
    }
    const type = ['post', 'banner', 'page'].includes(b.type) ? b.type : rows[0].type;
    await pool.query(
      `UPDATE cms_posts SET
        type = :type,
        title = :title,
        slug = :slug,
        excerpt = :excerpt,
        body = :body,
        image_url = :image_url,
        sort_order = :sort_order,
        published = :published,
        updated_at = CURRENT_TIMESTAMP
       WHERE id = :id`,
      {
        id,
        type,
        title,
        slug,
        excerpt: b.excerpt != null ? String(b.excerpt) : rows[0].excerpt,
        body: b.body != null ? String(b.body) : rows[0].body,
        image_url: b.image_url != null ? String(b.image_url).trim() || null : rows[0].image_url,
        sort_order: Math.max(0, parseInt(b.sort_order, 10) || rows[0].sort_order || 0),
        published: b.published === false || b.published === 0 ? 0 : 1
      }
    );
    const [out] = await pool.query('SELECT * FROM cms_posts WHERE id = ? LIMIT 1', [id]);
    res.json(out[0]);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Lỗi máy chủ' });
  }
});

router.delete('/admin/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    await pool.query('DELETE FROM cms_posts WHERE id = ?', [req.params.id]);
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Lỗi máy chủ' });
  }
});

module.exports = router;
