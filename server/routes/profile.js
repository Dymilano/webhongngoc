const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { pool } = require('../lib/db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

function pickProfileRow(r) {
  if (!r) return null;
  return {
    id: r.id,
    username: r.username,
    full_name: r.full_name,
    email: r.email,
    phone: r.phone,
    date_of_birth: r.date_of_birth || null,
    gender: r.gender || 'unknown',
    avatar_url: r.avatar_url || null,
    address_line: r.address_line || null,
    ward: r.ward || null,
    district: r.district || null,
    city: r.city || null,
    country: r.country || null,
    postal_code: r.postal_code || null,
    note: r.note || null,
    created_at: r.created_at,
    updated_at: r.updated_at
  };
}

function trimOrNull(v, maxLen) {
  if (v == null) return null;
  const s = String(v).trim();
  if (!s) return null;
  if (maxLen && s.length > maxLen) return s.slice(0, maxLen);
  return s;
}

function normalizeGender(v) {
  const g = String(v || '').toLowerCase().trim();
  if (['male', 'female', 'other', 'unknown'].includes(g)) return g;
  return 'unknown';
}

function normalizeDob(v) {
  const s = String(v || '').trim();
  if (!s) return null;
  // Accept YYYY-MM-DD
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return '__invalid__';
  const d = new Date(s + 'T00:00:00Z');
  if (Number.isNaN(d.getTime())) return '__invalid__';
  // Reject future dates
  if (d.getTime() > Date.now()) return '__invalid__';
  return s;
}

router.get('/', requireAuth, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, username, full_name, phone, email, date_of_birth, gender, avatar_url,
              address_line, ward, district, city, country, postal_code, note, role, locked, created_at, updated_at
       FROM users WHERE id = ? LIMIT 1`,
      [req.user.id]
    );
    const user = rows[0];
    if (!user) return res.status(404).json({ error: 'Không tìm thấy user' });
    if (user.locked) return res.status(403).json({ error: 'Tài khoản đang bị khóa' });
    return res.json({ profile: pickProfileRow(user) });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Lỗi máy chủ' });
  }
});

router.put('/', requireAuth, async (req, res) => {
  try {
    const b = req.body || {};
    const fullName = trimOrNull(b.full_name, 190);
    const phone = trimOrNull(b.phone, 50);
    const dob = normalizeDob(b.date_of_birth);
    const gender = normalizeGender(b.gender);
    const note = trimOrNull(b.note, 2000);

    if (dob === '__invalid__') return res.status(400).json({ error: 'Ngày sinh không hợp lệ (YYYY-MM-DD)' });
    if (phone && !/^[0-9+\-().\s]{6,25}$/.test(phone)) {
      return res.status(400).json({ error: 'Số điện thoại không hợp lệ' });
    }

    await pool.query(
      `UPDATE users
       SET full_name = :full_name,
           phone = :phone,
           date_of_birth = :date_of_birth,
           gender = :gender,
           note = :note
       WHERE id = :id`,
      {
        id: req.user.id,
        full_name: fullName,
        phone,
        date_of_birth: dob,
        gender,
        note
      }
    );

    const [rows] = await pool.query(
      `SELECT id, username, full_name, phone, email, date_of_birth, gender, avatar_url,
              address_line, ward, district, city, country, postal_code, note, created_at, updated_at
       FROM users WHERE id = ? LIMIT 1`,
      [req.user.id]
    );
    return res.json({ profile: pickProfileRow(rows[0]) });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Lỗi máy chủ' });
  }
});

router.put('/address', requireAuth, async (req, res) => {
  try {
    const b = req.body || {};
    const address_line = trimOrNull(b.address_line, 255);
    const ward = trimOrNull(b.ward, 120);
    const district = trimOrNull(b.district, 120);
    const city = trimOrNull(b.city, 120);
    const country = trimOrNull(b.country, 120);
    const postal_code = trimOrNull(b.postal_code, 32);

    await pool.query(
      `UPDATE users
       SET address_line = :address_line,
           ward = :ward,
           district = :district,
           city = :city,
           country = :country,
           postal_code = :postal_code
       WHERE id = :id`,
      { id: req.user.id, address_line, ward, district, city, country, postal_code }
    );

    const [rows] = await pool.query(
      `SELECT id, username, full_name, phone, email, date_of_birth, gender, avatar_url,
              address_line, ward, district, city, country, postal_code, note, created_at, updated_at
       FROM users WHERE id = ? LIMIT 1`,
      [req.user.id]
    );
    return res.json({ profile: pickProfileRow(rows[0]) });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Lỗi máy chủ' });
  }
});

// Avatar upload (user self)
const ROOT = path.join(__dirname, '..', '..');
const WEBSITE_DIR = path.join(ROOT, 'website');
const UPLOAD_DIR = path.join(WEBSITE_DIR, 'uploads', 'avatars');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase().slice(0, 12);
    const safeExt = ['.png', '.jpg', '.jpeg', '.webp', '.gif'].includes(ext) ? ext : '';
    const name = `av_${req.user.id}_${Date.now()}_${Math.random().toString(16).slice(2)}${safeExt}`;
    cb(null, name);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 3 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = /^image\//.test(file.mimetype);
    cb(ok ? null : new Error('Chỉ cho phép upload ảnh'), ok);
  }
});

router.post('/avatar', requireAuth, upload.single('avatar'), async (req, res) => {
  try {
    const f = req.file;
    if (!f) return res.status(400).json({ error: 'Thiếu file avatar' });
    const url = `/uploads/avatars/${encodeURIComponent(f.filename)}`;
    await pool.query('UPDATE users SET avatar_url = :url WHERE id = :id', { id: req.user.id, url });
    return res.json({ avatar_url: url });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: 'Lỗi máy chủ' });
  }
});

module.exports = router;

