const express = require('express');
const { pool, DB_DIALECT } = require('../lib/db');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const router = express.Router();

function ordersSince14DaysSql() {
  const d = String(DB_DIALECT || 'sqlite').toLowerCase();
  if (d === 'sqlite') {
    return `created_at >= datetime('now','-14 day')`;
  }
  return `created_at >= DATE_SUB(NOW(), INTERVAL 14 DAY)`;
}

router.get('/dashboard', requireAuth, requireAdmin, async (req, res) => {
  try {
    const [orderCountRows] = await pool.query('SELECT COUNT(*) AS n FROM orders');
    const [revenueRows] = await pool.query("SELECT COALESCE(SUM(total),0) AS s FROM orders WHERE status != 'cancelled'");
    const [userCountRows] = await pool.query('SELECT COUNT(*) AS n FROM users');
    const [productCountRows] = await pool.query('SELECT COUNT(*) AS n FROM products');

    let categories = 0;
    let posts = 0;
    let reviewsPending = 0;
    let couponsActive = 0;
    try {
      const [r] = await pool.query('SELECT COUNT(*) AS n FROM categories');
      categories = Number(r?.[0]?.n || 0);
    } catch (_) {}
    try {
      const [r] = await pool.query("SELECT COUNT(*) AS n FROM cms_posts WHERE published = 1");
      posts = Number(r?.[0]?.n || 0);
    } catch (_) {}
    try {
      const [r] = await pool.query('SELECT COUNT(*) AS n FROM product_reviews WHERE approved = 0');
      reviewsPending = Number(r?.[0]?.n || 0);
    } catch (_) {}
    try {
      const [r] = await pool.query('SELECT COUNT(*) AS n FROM coupons WHERE active = 1');
      couponsActive = Number(r?.[0]?.n || 0);
    } catch (_) {}

    const [latestOrders] = await pool.query(
      `SELECT id, order_code, customer_name, total, status, created_at
       FROM orders ORDER BY id DESC LIMIT 8`
    );

    const [topProducts] = await pool.query(
      `SELECT oi.product_id, oi.product_name, SUM(oi.quantity) AS qty
       FROM order_items oi
       JOIN orders o ON o.id = oi.order_id
       WHERE o.status != 'cancelled'
       GROUP BY oi.product_id, oi.product_name
       ORDER BY qty DESC
       LIMIT 8`
    );

    const since = ordersSince14DaysSql();
    const [series] = await pool.query(
      `SELECT substr(created_at, 1, 10) AS d,
              COUNT(*) AS orders,
              SUM(CASE WHEN status != 'cancelled' THEN total ELSE 0 END) AS revenue
       FROM orders
       WHERE ${since}
       GROUP BY substr(created_at, 1, 10)
       ORDER BY d ASC`
    );

    res.json({
      totals: {
        orders: Number(orderCountRows?.[0]?.n || 0),
        revenue: Number(revenueRows?.[0]?.s || 0),
        users: Number(userCountRows?.[0]?.n || 0),
        products: Number(productCountRows?.[0]?.n || 0),
        categories,
        posts,
        reviewsPending,
        couponsActive
      },
      latestOrders,
      topProducts,
      series
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Lỗi máy chủ' });
  }
});

router.get('/top-customers', requireAuth, requireAdmin, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT o.email, o.customer_name,
              SUM(CASE WHEN o.status != 'cancelled' THEN o.total ELSE 0 END) AS revenue,
              COUNT(*) AS orders
       FROM orders o
       GROUP BY o.email, o.customer_name
       ORDER BY revenue DESC
       LIMIT 20`
    );
    res.json({ items: rows });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Lỗi máy chủ' });
  }
});

router.get('/revenue', requireAuth, requireAdmin, async (req, res) => {
  try {
    const group = (req.query.group || 'day').toLowerCase(); // day|month|year
    const fmt = group === 'year' ? 4 : group === 'month' ? 7 : 10;
    const [rows] = await pool.query(
      `SELECT substr(created_at, 1, ${fmt}) AS k,
              COUNT(*) AS orders,
              SUM(CASE WHEN status != 'cancelled' THEN total ELSE 0 END) AS revenue
       FROM orders
       GROUP BY substr(created_at, 1, ${fmt})
       ORDER BY k ASC`
    );
    res.json({ group, items: rows });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Lỗi máy chủ' });
  }
});

module.exports = router;

