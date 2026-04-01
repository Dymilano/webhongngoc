const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { pool, DB_DIALECT } = require('../lib/db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

function clientIp(req) {
  const xff = req.headers['x-forwarded-for'];
  if (typeof xff === 'string' && xff.length) return xff.split(',')[0].trim();
  return req.ip || (req.socket && req.socket.remoteAddress) || '—';
}

/** Ẩn bớt định danh khi ghi log (trừ khi AUTH_LOG_FULL_EMAIL=1). */
function logIdentifier(raw) {
  const full = process.env.AUTH_LOG_FULL_EMAIL === '1';
  const s = String(raw || '').trim();
  if (!s) return '(trống)';
  if (full) return s;
  const at = s.indexOf('@');
  if (at > 0) {
    const local = s.slice(0, at);
    const dom = s.slice(at);
    if (local.length <= 1) return `*${dom}`;
    return `${local[0]}***${dom}`;
  }
  return s.length > 2 ? `${s.slice(0, 2)}***` : '***';
}

/**
 * Log đăng nhập / đăng ký: một dòng JSON, không ghi mật khẩu hay token.
 * action: entry_login | entry_register | entry_denied_* | register | login | ...
 */
function logAuth(req, action, extra) {
  const line = {
    t: new Date().toISOString(),
    action,
    ip: clientIp(req),
    ...(extra && typeof extra === 'object' ? extra : {})
  };
  console.log('[auth]', JSON.stringify(line));
}

function signUserToken(user) {
  const secret = process.env.JWT_SECRET || 'dev-secret';
  const expiresIn = process.env.JWT_ACCESS_EXPIRES || process.env.JWT_EXPIRES || '15m';
  return jwt.sign({ id: user.id, email: user.email, role: user.role }, secret, { expiresIn });
}

function userPayload(user) {
  return {
    id: user.id,
    username: user.username,
    full_name: user.full_name,
    phone: user.phone,
    email: user.email,
    role: user.role
  };
}

function refreshCookieOptions() {
  const isProd = String(process.env.NODE_ENV || '').toLowerCase() === 'production';
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProd, // require HTTPS in production
    path: '/api/auth/refresh'
  };
}

function sha256Hex(s) {
  return crypto.createHash('sha256').update(String(s)).digest('hex');
}

function newRefreshToken() {
  return crypto.randomBytes(48).toString('base64url');
}

function nowPlusDays(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
}

function formatDbDate(d) {
  // MySQL DATETIME prefers "YYYY-MM-DD HH:MM:SS"; SQLite uses TEXT so ISO is fine.
  if (String(DB_DIALECT || '').toLowerCase() === 'mysql') {
    return d.toISOString().slice(0, 19).replace('T', ' ');
  }
  return d.toISOString();
}

function parseDbDate(raw) {
  if (!raw) return null;
  if (raw instanceof Date) return raw;
  const s = String(raw).trim();
  if (!s) return null;
  // Accept "YYYY-MM-DD HH:MM:SS" (MySQL) or ISO strings (SQLite)
  const iso = s.includes('T') ? s : s.replace(' ', 'T') + 'Z';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

async function issueSession(req, res, user) {
  const accessToken = signUserToken(user);
  const refreshToken = newRefreshToken();
  const tokenHash = sha256Hex(refreshToken);
  const expiresAt = nowPlusDays(Number(process.env.JWT_REFRESH_DAYS) || 30);
  await pool.query(
    `INSERT INTO user_refresh_tokens (user_id, token_hash, expires_at, ip, user_agent)
     VALUES (:user_id, :token_hash, :expires_at, :ip, :user_agent)`,
    {
      user_id: user.id,
      token_hash: tokenHash,
      expires_at: formatDbDate(expiresAt),
      ip: clientIp(req),
      user_agent: String(req.headers['user-agent'] || '').slice(0, 255)
    }
  );
  res.cookie('ngoc_rt', refreshToken, Object.assign(refreshCookieOptions(), { expires: expiresAt }));
  return { accessToken };
}

function isEmail(s) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(s || '').trim());
}

function normalizeEmail(s) {
  return String(s || '').trim().toLowerCase();
}

function normalizeUsername(s) {
  return String(s || '').trim();
}

function badRequest(res, msg) {
  return res.status(400).json({ error: msg });
}

/**
 * Một nút: cùng email + mật khẩu — đã có tài khoản thì đăng nhập, chưa có thì đăng ký và đăng nhập luôn.
 * Body: { identifier | email | username, password, phone?, full_name?, preferred_username? }
 */
router.post('/entry', async (req, res) => {
  try {
    const b = req.body || {};
    const password = String(b.password || '');
    const raw = String(b.identifier || b.email || b.username || '').trim();
    const intent = String(b.intent || '').toLowerCase().trim(); // 'login' | 'register'
    const phone = b.phone ? String(b.phone).trim() : null;
    const fullName = b.full_name ? String(b.full_name).trim() : null;
    const preferredUsername = b.preferred_username ? String(b.preferred_username).trim() : '';

    if (!raw || !password) {
      logAuth(req, 'entry_denied_validation', { reason: 'missing_fields', id: logIdentifier(raw) });
      return res.status(400).json({ error: 'Nhập email (hoặc tên đăng nhập) và mật khẩu.' });
    }
    if (password.length < 6) {
      logAuth(req, 'entry_denied_validation', { reason: 'password_short', id: logIdentifier(raw) });
      return res.status(400).json({ error: 'Mật khẩu tối thiểu 6 ký tự.' });
    }

    const emailLike = isEmail(raw);

    let user;
    try {
      const [rows] = await pool.query(
        `SELECT id, username, full_name, phone, email, password_hash, role, locked FROM users
         WHERE LOWER(TRIM(email)) = LOWER(TRIM(?)) OR LOWER(TRIM(username)) = LOWER(TRIM(?))
         LIMIT 1`,
        [raw, raw]
      );
      user = rows[0];

      if (user) {
        if (user.locked) {
          logAuth(req, 'entry_denied_locked', { userId: user.id, id: logIdentifier(raw) });
          return res.status(403).json({ error: 'Tài khoản đang bị khóa.' });
        }
        if (!(await bcrypt.compare(password, user.password_hash))) {
          logAuth(req, 'entry_denied_bad_password', { userId: user.id, id: logIdentifier(raw) });
          if (intent === 'register' && emailLike) {
            return res.status(409).json({ error: 'Email đã tồn tại. Hãy chuyển sang tab Đăng nhập.' });
          }
          return res.status(401).json({ error: 'Sai mật khẩu.' });
        }
        const { accessToken } = await issueSession(req, res, user);
        logAuth(req, 'entry_login', { userId: user.id, id: logIdentifier(raw) });
        return res.json({ token: accessToken, user: userPayload(user), mode: 'login' });
      }
    } catch (e) {
      if (e && e.code === 'DB_DISABLED') {
        return res.status(503).json({ error: 'Hệ thống chưa bật cơ sở dữ liệu (USE_DB=0).' });
      }
      if (e && (e.code === 'ECONNREFUSED' || e.code === 'ENOTFOUND')) {
        return res.status(503).json({ error: 'Không kết nối được MySQL. Hãy bật MySQL rồi thử lại.' });
      }
      throw e;
    }

    if (!emailLike) {
      logAuth(req, 'entry_denied_register_need_email', { id: logIdentifier(raw) });
      return res.status(404).json({
        error: 'Chưa có tài khoản với tên này. Đăng ký mới cần dùng địa chỉ email hợp lệ.'
      });
    }

    if (intent === 'login') {
      logAuth(req, 'entry_denied_not_found', { id: logIdentifier(raw) });
      return res.status(404).json({ error: 'Tài khoản không tồn tại. Hãy chuyển sang tab Đăng ký.' });
    }

    const email = normalizeEmail(raw);
    let base =
      (preferredUsername && /^[a-zA-Z0-9._-]+$/.test(preferredUsername) ? preferredUsername : '') ||
      email
        .split('@')[0]
        .replace(/[^a-zA-Z0-9._-]/g, '')
        .slice(0, 48);
    if (!base) base = 'user';
    let username = base;
    for (let attempt = 0; attempt < 25; attempt++) {
      const candidate = attempt === 0 ? username : `${base}${1000 + Math.floor(Math.random() * 8999)}`;
      const [dup] = await pool.query('SELECT id FROM users WHERE username = ? LIMIT 1', [candidate]);
      if (!dup[0]) {
        username = candidate;
        break;
      }
      if (attempt === 24) {
        username = `${base}${Date.now().toString(36)}`;
      }
    }

    const hash = await bcrypt.hash(password, 12);
    const [ins] = await pool.query(
      `INSERT INTO users (username, full_name, phone, email, password_hash, role, locked)
       VALUES (:username, :full_name, :phone, :email, :password_hash, 'user', 0)`,
      {
        username,
        full_name: fullName || username,
        phone,
        email,
        password_hash: hash
      }
    );
    const newUser = {
      id: ins.insertId,
      username,
      full_name: fullName || username,
      phone,
      email,
      role: 'user'
    };
    const { accessToken } = await issueSession(req, res, newUser);
    logAuth(req, 'entry_register', { userId: newUser.id, id: logIdentifier(raw), username: newUser.username });
    return res.status(201).json({ token: accessToken, user: userPayload(newUser), mode: 'register' });
  } catch (e) {
    console.error('[auth] entry error', e);
    if (String(e && e.message || '')
      .toLowerCase()
      .includes('unique')) {
      const rid = String(
        (req.body || {}).identifier || (req.body || {}).email || (req.body || {}).username || ''
      ).trim();
      logAuth(req, 'entry_denied_duplicate_email', { id: logIdentifier(rid) });
      return res.status(409).json({ error: 'Email đã được dùng. Hãy đăng nhập.' });
    }
    res.status(500).json({ error: 'Lỗi máy chủ' });
  }
});

router.post('/register', async (req, res) => {
  try {
    const b = req.body || {};
    const username = normalizeUsername(b.username);
    const email = normalizeEmail(b.email);
    const phone = b.phone ? String(b.phone).trim() : null;
    const fullName = b.full_name ? String(b.full_name).trim() : null;
    const password = String(b.password || '');
    if (!username || !email || !password) {
      logAuth(req, 'register_denied_validation', { reason: 'missing_fields' });
      return res.status(400).json({ error: 'Thiếu username/email/password' });
    }
    if (!isEmail(email)) return badRequest(res, 'Email không hợp lệ');
    if (password.length < 6) {
      logAuth(req, 'register_denied_validation', { reason: 'password_short', id: logIdentifier(email) });
      return res.status(400).json({ error: 'Mật khẩu tối thiểu 6 ký tự' });
    }

    const hash = await bcrypt.hash(password, 12);
    const [r] = await pool.query(
      `INSERT INTO users (username, full_name, phone, email, password_hash, role, locked)
       VALUES (:username, :full_name, :phone, :email, :password_hash, 'user', 0)`,
      {
        username,
        full_name: fullName,
        phone,
        email,
        password_hash: hash
      }
    );
    logAuth(req, 'register_ok', { userId: r.insertId, username, id: logIdentifier(email) });
    const u = { id: r.insertId, username, full_name: fullName, phone, email, role: 'user' };
    const { accessToken } = await issueSession(req, res, u);
    res.status(201).json({ token: accessToken, user: userPayload(u) });
  } catch (e) {
    console.error('[auth] register error', e);
    // SQLite unique constraint
    if (String(e && e.message || '').toLowerCase().includes('unique')) {
      const em = String((req.body || {}).email || '').trim();
      logAuth(req, 'register_denied_duplicate', { id: logIdentifier(em) });
      return res.status(409).json({ error: 'Email hoặc username đã tồn tại' });
    }
    res.status(500).json({ error: 'Lỗi máy chủ' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const b = req.body || {};
    const password = String(b.password || '');
    const loginId = String(b.email || b.username || '').trim();
    if (!loginId || !password) {
      logAuth(req, 'login_denied_validation', { reason: 'missing_fields' });
      return res.status(400).json({ error: 'Email và mật khẩu là bắt buộc' });
    }
    let user;
    try {
      const [rows] = await pool.query(
        `SELECT id, username, full_name, phone, email, password_hash, role, locked FROM users
         WHERE LOWER(TRIM(email)) = LOWER(TRIM(?)) OR LOWER(TRIM(username)) = LOWER(TRIM(?))
         LIMIT 1`,
        [loginId, loginId]
      );
      user = rows[0];
      if (user && user.locked) {
        logAuth(req, 'login_denied_locked', { userId: user.id, id: logIdentifier(loginId) });
        return res.status(403).json({ error: 'Tài khoản đang bị khóa' });
      }
      if (!user || !(await bcrypt.compare(password, user.password_hash))) {
        logAuth(req, 'login_denied_bad_credentials', {
          userId: user ? user.id : null,
          id: logIdentifier(loginId),
          found: !!user
        });
        return res.status(401).json({ error: 'Sai email hoặc mật khẩu' });
      }
    } catch (e) {
      // Offline mode (USE_DB=0): allow admin login via env credentials
      if (e && e.code === 'DB_DISABLED') {
        const envEmail = process.env.ADMIN_EMAIL || 'admin@ngoc.local';
        const envUser = process.env.ADMIN_USERNAME || 'admin';
        const envPass = process.env.ADMIN_PASSWORD || 'Admin@123';
        const okLogin =
          loginId === envEmail ||
          loginId.toLowerCase() === envEmail.toLowerCase() ||
          loginId === envUser ||
          loginId.toLowerCase() === envUser.toLowerCase();
        if (!okLogin || password !== envPass) {
          logAuth(req, 'login_denied_bad_credentials', { mode: 'offline_admin', id: logIdentifier(loginId) });
          return res.status(401).json({ error: 'Sai email hoặc mật khẩu' });
        }
        user = {
          id: 0,
          username: process.env.ADMIN_USERNAME || 'admin',
          full_name: process.env.ADMIN_FULL_NAME || "Ngoc's Admin",
          phone: process.env.ADMIN_PHONE || '',
          email: envEmail,
          role: 'admin',
          locked: 0
        };
      } else if (e && (e.code === 'ECONNREFUSED' || e.code === 'ENOTFOUND')) {
        return res.status(503).json({
          error: 'Không kết nối được MySQL. Hãy bật MySQL (port 3306) rồi thử lại.'
        });
      } else {
        throw e;
      }
    }
    const { accessToken } = user.id === 0 ? { accessToken: signUserToken(user) } : await issueSession(req, res, user);
    logAuth(req, 'login_ok', {
      userId: user.id,
      id: logIdentifier(loginId),
      role: user.role,
      offlineAdmin: user.id === 0
    });
    res.json({
      token: accessToken,
      user: userPayload(user)
    });
  } catch (e) {
    console.error('[auth] login error', e);
    res.status(500).json({ error: 'Lỗi máy chủ' });
  }
});

router.post('/refresh', async (req, res) => {
  try {
    const rt = req.cookies && req.cookies.ngoc_rt;
    if (!rt) return res.status(401).json({ error: 'Unauthorized' });
    const tokenHash = sha256Hex(rt);
    const [rows] = await pool.query(
      `SELECT t.id, t.user_id, t.expires_at, t.revoked_at, u.id as uid, u.username, u.full_name, u.phone, u.email, u.role, u.locked
       FROM user_refresh_tokens t
       JOIN users u ON u.id = t.user_id
       WHERE t.token_hash = ? LIMIT 1`,
      [tokenHash]
    );
    const row = rows[0];
    if (!row || row.revoked_at) return res.status(401).json({ error: 'Unauthorized' });
    const exp = parseDbDate(row.expires_at);
    if (!exp || exp.getTime() < Date.now()) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    if (row.locked) return res.status(403).json({ error: 'Tài khoản đang bị khóa' });

    // rotate refresh token
    await pool.query(`UPDATE user_refresh_tokens SET revoked_at = CURRENT_TIMESTAMP WHERE id = ?`, [row.id]);
    const user = {
      id: row.uid,
      username: row.username,
      full_name: row.full_name,
      phone: row.phone,
      email: row.email,
      role: row.role
    };
    const { accessToken } = await issueSession(req, res, user);
    return res.json({ token: accessToken, user: userPayload(user) });
  } catch (e) {
    console.error('[auth] refresh error', e);
    return res.status(500).json({ error: 'Lỗi máy chủ' });
  }
});

router.post('/logout', async (req, res) => {
  try {
    const rt = req.cookies && req.cookies.ngoc_rt;
    if (rt) {
      const tokenHash = sha256Hex(rt);
      try {
        await pool.query(`UPDATE user_refresh_tokens SET revoked_at = CURRENT_TIMESTAMP WHERE token_hash = ?`, [tokenHash]);
      } catch (_) {}
    }
    res.clearCookie('ngoc_rt', refreshCookieOptions());
    return res.json({ ok: true });
  } catch (e) {
    console.error('[auth] logout error', e);
    return res.status(500).json({ error: 'Lỗi máy chủ' });
  }
});

router.get('/me', requireAuth, async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT id, username, full_name, phone, email, role FROM users WHERE id = ? LIMIT 1', [
      req.user.id
    ]);
    const user = rows[0];
    if (!user) return res.status(404).json({ error: 'Không tìm thấy user' });
    res.json({ user });
  } catch (e) {
    console.error(e);
    if (e && e.code === 'DB_DISABLED') {
      return res.status(503).json({
        error: 'Database đang tạm tắt (USE_DB=0).'
      });
    }
    if (e && (e.code === 'ECONNREFUSED' || e.code === 'ENOTFOUND')) {
      return res.status(503).json({
        error: 'Không kết nối được MySQL. Hãy bật MySQL (port 3306) rồi thử lại.'
      });
    }
    res.status(500).json({ error: 'Lỗi máy chủ' });
  }
});

module.exports = router;
