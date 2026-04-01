const express = require('express');
const bcrypt = require('bcryptjs');
const { pool } = require('../lib/db');
const { requireAuth, requireAdmin, requireSuperAdmin } = require('../middleware/auth');

const router = express.Router();

router.get('/', requireAuth, requireAdmin, async (req, res) => {
  try {
    const q = req.query.q ? `%${req.query.q}%` : null;
    let sql = 'SELECT id, username, full_name, phone, email, role, locked, created_at FROM users';
    const params = {};
    if (q) {
      sql += ' WHERE username LIKE :q OR full_name LIKE :q OR email LIKE :q OR phone LIKE :q';
      params.q = q;
    }
    sql += ' ORDER BY id DESC LIMIT 200';
    const [rows] = await pool.query(sql, params);
    res.json({ items: rows });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Lỗi máy chủ' });
  }
});

function normalizeRole(role, actor) {
  const r = String(role || 'user').toLowerCase();
  const actorRole = actor && actor.role;
  if (r === 'super_admin') {
    return actorRole === 'super_admin' ? 'super_admin' : 'admin';
  }
  if (['admin', 'staff', 'user'].includes(r)) return r;
  return 'user';
}

router.post('/', requireAuth, requireAdmin, async (req, res) => {
  try {
    const b = req.body || {};
    if (!b.email || !b.username || !b.password) {
      return res.status(400).json({ error: 'Thiếu email/username/password' });
    }
    const hash = await bcrypt.hash(String(b.password), 10);
    const role = normalizeRole(b.role, req.user);
    const locked = b.locked ? 1 : 0;
    const [r] = await pool.query(
      `INSERT INTO users (username, full_name, phone, email, password_hash, role, locked)
       VALUES (:username, :full_name, :phone, :email, :password_hash, :role, :locked)`,
      {
        username: b.username,
        full_name: b.full_name || null,
        phone: b.phone || null,
        email: b.email,
        password_hash: hash,
        role,
        locked
      }
    );
    res.status(201).json({ id: r.insertId });
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
    const add = (col, key, val) => {
      fields.push(`${col} = :${key}`);
      params[key] = val;
    };
    if (b.username !== undefined) add('username', 'username', b.username);
    if (b.full_name !== undefined) add('full_name', 'full_name', b.full_name || null);
    if (b.phone !== undefined) add('phone', 'phone', b.phone || null);
    if (b.email !== undefined) add('email', 'email', b.email);
    if (b.role !== undefined) add('role', 'role', normalizeRole(b.role, req.user));
    if (b.locked !== undefined) add('locked', 'locked', b.locked ? 1 : 0);
    if (b.password) {
      const hash = await bcrypt.hash(String(b.password), 10);
      add('password_hash', 'password_hash', hash);
    }
    if (!fields.length) return res.status(400).json({ error: 'Không có dữ liệu' });
    await pool.query(`UPDATE users SET ${fields.join(', ')} WHERE id = :id`, params);
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Lỗi máy chủ' });
  }
});

router.delete('/:id', requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    await pool.query('DELETE FROM users WHERE id = ?', [req.params.id]);
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Lỗi máy chủ' });
  }
});

module.exports = router;

