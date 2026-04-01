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

// Public: danh sách / chi tiết (cho storefront)
router.get('/public', async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 24));
    const offset = (page - 1) * limit;
    const categoryId = req.query.category_id ? parseInt(req.query.category_id, 10) : null;
    const featured = req.query.featured !== undefined ? Number(req.query.featured) : null;
    const minPrice = req.query.min_price !== undefined ? Number(req.query.min_price) : null;
    const maxPrice = req.query.max_price !== undefined ? Number(req.query.max_price) : null;

    let where = 'WHERE p.published = 1';
    const bind = { limit, offset };
    if (categoryId) {
      where += ' AND p.category_id = :cid';
      bind.cid = categoryId;
    }
    if (featured === 1) {
      where += ' AND p.featured = 1';
    }
    // filter by effective price (sale_price if present)
    if (!Number.isNaN(minPrice) && minPrice != null) {
      where += ' AND (CASE WHEN p.sale_price IS NOT NULL THEN p.sale_price ELSE p.price END) >= :minp';
      bind.minp = minPrice;
    }
    if (!Number.isNaN(maxPrice) && maxPrice != null) {
      where += ' AND (CASE WHEN p.sale_price IS NOT NULL THEN p.sale_price ELSE p.price END) <= :maxp';
      bind.maxp = maxPrice;
    }
    const [rows] = await pool.query(
      `SELECT p.*, c.name AS category_name, c.slug AS category_slug
       FROM products p
       LEFT JOIN categories c ON c.id = p.category_id
       ${where}
       ORDER BY p.id DESC
       LIMIT :limit OFFSET :offset`,
      bind
    );
    const countBind = Object.assign({}, bind);
    delete countBind.limit;
    delete countBind.offset;
    const [countRows] = await pool.query(
      `SELECT COUNT(*) AS total
       FROM products p
       LEFT JOIN categories c ON c.id = p.category_id
       ${where}`,
      countBind
    );
    const total = countRows && countRows[0] ? countRows[0].total : 0;
    res.json({ items: rows, page, limit, total: Number(total) });
  } catch (e) {
    if (e && e.code === 'DB_DISABLED') {
      return res.json({ items: [], page: 1, limit: 0, total: 0 });
    }
    console.error(e);
    res.status(500).json({ error: 'Lỗi máy chủ' });
  }
});

router.get('/public/:slug', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT p.*, c.name AS category_name FROM products p
       LEFT JOIN categories c ON c.id = p.category_id
       WHERE p.slug = ? AND p.published = 1 LIMIT 1`,
      [req.params.slug]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Không tìm thấy' });
    res.json(rows[0]);
  } catch (e) {
    if (e && e.code === 'DB_DISABLED') {
      return res.status(404).json({ error: 'Chưa có dữ liệu (DB đang tắt)' });
    }
    console.error(e);
    res.status(500).json({ error: 'Lỗi máy chủ' });
  }
});

// Public: lookup product by legacy WP id (for syncing static theme buttons)
router.get('/public-by-legacy/:legacy', async (req, res) => {
  try {
    const legacy = parseInt(req.params.legacy, 10);
    if (!Number.isFinite(legacy)) return res.status(400).json({ error: 'legacy id không hợp lệ' });
    const [rows] = await pool.query(
      `SELECT p.*, c.name AS category_name, c.slug AS category_slug
       FROM products p
       LEFT JOIN categories c ON c.id = p.category_id
       WHERE p.legacy_wp_id = ? AND p.published = 1
       LIMIT 1`,
      [legacy]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Không tìm thấy' });
    res.json(rows[0]);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Lỗi máy chủ' });
  }
});

// Admin
router.get('/', requireAuth, requireAdmin, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit, 10) || 50));
    const offset = (page - 1) * limit;
    const q = req.query.q ? `%${req.query.q}%` : null;
    const categoryId = req.query.category_id ? parseInt(req.query.category_id, 10) : null;
    const featured = req.query.featured !== undefined ? Number(req.query.featured) : null;
    const minPrice = req.query.min_price !== undefined ? Number(req.query.min_price) : null;
    const maxPrice = req.query.max_price !== undefined ? Number(req.query.max_price) : null;
    let sql = `SELECT p.*, c.name AS category_name FROM products p
               LEFT JOIN categories c ON c.id = p.category_id`;
    const params = { limit, offset };
    const clauses = [];
    if (q) {
      params.q = q;
      clauses.push('(p.name LIKE :q OR p.sku LIKE :q)');
    }
    if (categoryId) {
      params.cid = categoryId;
      clauses.push('p.category_id = :cid');
    }
    if (featured === 1) {
      clauses.push('p.featured = 1');
    }
    if (!Number.isNaN(minPrice) && minPrice != null) {
      params.minp = minPrice;
      clauses.push('(CASE WHEN p.sale_price IS NOT NULL THEN p.sale_price ELSE p.price END) >= :minp');
    }
    if (!Number.isNaN(maxPrice) && maxPrice != null) {
      params.maxp = maxPrice;
      clauses.push('(CASE WHEN p.sale_price IS NOT NULL THEN p.sale_price ELSE p.price END) <= :maxp');
    }
    if (clauses.length) {
      sql += ' WHERE ' + clauses.join(' AND ');
    }
    sql += ' ORDER BY p.id DESC LIMIT :limit OFFSET :offset';
    const [rows] = await pool.query(sql, params);
    const countParams = Object.assign({}, params);
    delete countParams.limit;
    delete countParams.offset;
    const [countRows] = await pool.query(
      `SELECT COUNT(*) AS total FROM products p` + (clauses.length ? ' WHERE ' + clauses.join(' AND ') : ''),
      countParams
    );
    const total = countRows && countRows[0] ? countRows[0].total : 0;
    res.json({ items: rows, page, limit, total: Number(total) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Lỗi máy chủ' });
  }
});

router.get('/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT * FROM products WHERE id = ? LIMIT 1', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Không tìm thấy' });
    res.json(rows[0]);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Lỗi máy chủ' });
  }
});

router.post('/', requireAuth, requireAdmin, async (req, res) => {
  try {
    const b = req.body || {};
    let slug = b.slug ? slugify(b.slug) : slugify(b.name);
    if (!slug) slug = 'sp-' + Date.now();
    const [exist] = await pool.query('SELECT id FROM products WHERE slug = ?', [slug]);
    if (exist.length) slug = slug + '-' + Date.now().toString(36);

    const [r] = await pool.query(
      `INSERT INTO products (category_id, legacy_wp_id, name, slug, description, sku, price, sale_price, stock, image_url, featured, published)
       VALUES (:category_id, :legacy_wp_id, :name, :slug, :description, :sku, :price, :sale_price, :stock, :image_url, :featured, :published)`,
      {
        category_id: b.category_id || null,
        legacy_wp_id: b.legacy_wp_id != null && b.legacy_wp_id !== '' ? parseInt(b.legacy_wp_id, 10) : null,
        name: b.name,
        slug,
        description: b.description || null,
        sku: b.sku || null,
        price: b.price != null ? Number(b.price) : 0,
        sale_price: b.sale_price != null ? Number(b.sale_price) : null,
        stock: b.stock != null ? parseInt(b.stock, 10) : 0,
        image_url: b.image_url || null,
        featured: b.featured ? 1 : 0,
        published: b.published === false || b.published === 0 ? 0 : 1
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
    const id = req.params.id;
    const b = req.body || {};
    const fields = [];
    const params = { id };
    const map = {
      name: 'name',
      description: 'description',
      sku: 'sku',
      price: 'price',
      sale_price: 'sale_price',
      stock: 'stock',
      image_url: 'image_url',
      legacy_wp_id: 'legacy_wp_id',
      featured: 'featured',
      published: 'published'
    };
    if (b.category_id !== undefined) {
      fields.push('category_id = :category_id');
      params.category_id = b.category_id === '' || b.category_id === null ? null : b.category_id;
    }
    for (const k of Object.keys(map)) {
      if (b[k] !== undefined) {
        fields.push(`${map[k]} = :${k}`);
        if (k === 'published') params[k] = b[k] === false || b[k] === 0 ? 0 : 1;
        else if (k === 'featured') params[k] = b[k] ? 1 : 0;
        else if (k === 'legacy_wp_id') params[k] = b[k] === null || b[k] === '' ? null : parseInt(b[k], 10);
        else if (k === 'price' || k === 'sale_price') params[k] = b[k] === null || b[k] === '' ? null : Number(b[k]);
        else if (k === 'stock') params[k] = parseInt(b[k], 10);
        else params[k] = b[k];
      }
    }
    if (b.slug !== undefined) {
      fields.push('slug = :slug');
      params.slug = slugify(b.slug) || slugify(b.name);
    }
    if (b.name !== undefined && b.slug === undefined) {
      // optional: keep slug stable unless name changes with explicit slug
    }
    if (!fields.length) return res.status(400).json({ error: 'Không có dữ liệu cập nhật' });
    await pool.query(`UPDATE products SET ${fields.join(', ')} WHERE id = :id`, params);
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Lỗi máy chủ' });
  }
});

router.delete('/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    await pool.query('DELETE FROM products WHERE id = ?', [req.params.id]);
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Lỗi máy chủ' });
  }
});

module.exports = router;
