const express = require('express');
const { pool, DB_DIALECT } = require('../lib/db');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const router = express.Router();

router.get('/public', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT setting_key, setting_value FROM site_settings');
    const out = {};
    for (const r of rows) {
      try {
        out[r.setting_key] =
          typeof r.setting_value === 'string' ? JSON.parse(r.setting_value) : r.setting_value;
      } catch {
        out[r.setting_key] = r.setting_value;
      }
    }
    res.json(out);
  } catch (e) {
    if (e && e.code === 'DB_DISABLED') {
      return res.json({});
    }
    console.error(e);
    res.status(500).json({ error: 'Lỗi máy chủ' });
  }
});

router.get('/', requireAuth, requireAdmin, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT setting_key, setting_value FROM site_settings');
    const out = {};
    for (const r of rows) {
      let val = r.setting_value;
      if (val != null && typeof val === 'string') {
        try {
          val = JSON.parse(val);
        } catch (_) {}
      }
      out[r.setting_key] = val;
    }
    res.json(out);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Lỗi máy chủ' });
  }
});

router.put('/', requireAuth, requireAdmin, async (req, res) => {
  try {
    const body = req.body || {};
    const isMysql = String(DB_DIALECT || '').toLowerCase() === 'mysql';
    for (const key of Object.keys(body)) {
      const val = body[key];
      const json = JSON.stringify(val);
      if (isMysql) {
        await pool.query(
          `INSERT INTO site_settings (setting_key, setting_value) VALUES (?, ?)
           ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
          [key, json]
        );
      } else {
        await pool.query(
          `INSERT INTO site_settings (setting_key, setting_value) VALUES (?, ?)
           ON CONFLICT(setting_key) DO UPDATE SET setting_value=excluded.setting_value`,
          [key, json]
        );
      }
    }
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Lỗi máy chủ' });
  }
});

module.exports = router;
