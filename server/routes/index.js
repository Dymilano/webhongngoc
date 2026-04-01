const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const authRoutes = require('./auth');
const productsRoutes = require('./products');
const categoriesRoutes = require('./categories');
const ordersRoutes = require('./orders');
const settingsRoutes = require('./settings');
const mediaRoutes = require('./media');
const usersRoutes = require('./users');
const profileRoutes = require('./profile');
const reportsRoutes = require('./reports');
const cmsRoutes = require('./cms');
const reviewsRoutes = require('./reviews');
const couponsRoutes = require('./coupons');
const cartRoutes = require('./cart');

const router = express.Router();

const corsOrigins = [
  'http://localhost:5000',
  'http://127.0.0.1:5000',
  'http://localhost:5050',
  'http://127.0.0.1:5050'
];
const extraOrigins = String(process.env.CORS_ORIGINS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);
const allowlist = new Set([...corsOrigins, ...extraOrigins]);
function isDevLocalOrigin(origin) {
  // Allow local dev across different ports (useful when moving between ports or tooling).
  return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(String(origin || ''));
}

router.use(
  cors({
    origin: (origin, cb) => {
      // Non-browser requests may have no Origin header.
      if (!origin) return cb(null, true);
      if (allowlist.has(origin) || isDevLocalOrigin(origin)) return cb(null, true);
      return cb(new Error('CORS_NOT_ALLOWED'));
    },
    credentials: true
  })
);

// Minimal baseline hardening (safe defaults; static assets are served by outer apps)
router.use(
  helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' }
  })
);
router.use(cookieParser());
router.use(express.json({ limit: '2mb' }));

// Throttle auth endpoints to reduce brute force risk
router.use(
  '/auth',
  rateLimit({
    windowMs: 10 * 60 * 1000,
    limit: 60,
    standardHeaders: 'draft-7',
    legacyHeaders: false
  }),
  authRoutes
);
router.use('/products', productsRoutes);
router.use('/categories', categoriesRoutes);
router.use('/orders', ordersRoutes);
router.use('/cart', cartRoutes);
router.use('/settings', settingsRoutes);
router.use('/media', mediaRoutes);
router.use('/users', usersRoutes);
router.use('/profile', profileRoutes);
router.use('/reports', reportsRoutes);
router.use('/cms', cmsRoutes);
router.use('/reviews', reviewsRoutes);
router.use('/coupons', couponsRoutes);

router.get('/health', (req, res) => {
  res.json({ ok: true, service: 'ngoc-clothes-api' });
});

module.exports = router;
