const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const router = express.Router();

const ROOT = path.join(__dirname, '..', '..');
const WEBSITE_DIR = path.join(ROOT, 'website');
const UPLOAD_DIR = path.join(WEBSITE_DIR, 'uploads');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase().slice(0, 12);
    const safeExt = ['.png', '.jpg', '.jpeg', '.webp', '.gif'].includes(ext) ? ext : '';
    const name = `img_${Date.now()}_${Math.random().toString(16).slice(2)}${safeExt}`;
    cb(null, name);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok = /^image\//.test(file.mimetype);
    cb(ok ? null : new Error('Chỉ cho phép upload ảnh'), ok);
  }
});

router.post('/upload', requireAuth, requireAdmin, upload.single('file'), async (req, res) => {
  const f = req.file;
  if (!f) return res.status(400).json({ error: 'Thiếu file' });
  // URL public trên shop/admin
  res.json({
    url: `/uploads/${encodeURIComponent(f.filename)}`,
    filename: f.filename,
    size: f.size,
    mimetype: f.mimetype
  });
});

router.get('/list', requireAuth, requireAdmin, async (req, res) => {
  try {
    const files = fs
      .readdirSync(UPLOAD_DIR)
      .filter((n) => /^img_/.test(n))
      .slice(-500)
      .reverse()
      .map((name) => {
        const p = path.join(UPLOAD_DIR, name);
        const st = fs.statSync(p);
        return { name, url: `/uploads/${encodeURIComponent(name)}`, size: st.size, mtime: st.mtime.toISOString() };
      });
    res.json({ items: files });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Lỗi máy chủ' });
  }
});

router.delete('/:name', requireAuth, requireAdmin, async (req, res) => {
  try {
    const name = String(req.params.name || '');
    if (!/^img_[a-z0-9_]+\.(png|jpg|jpeg|webp|gif)?$/i.test(name)) {
      return res.status(400).json({ error: 'Tên file không hợp lệ' });
    }
    const p = path.join(UPLOAD_DIR, name);
    if (fs.existsSync(p)) fs.unlinkSync(p);
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Lỗi máy chủ' });
  }
});

module.exports = router;

