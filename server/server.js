/**
 * Hai cổng:
 *  - PORT_SHOP (5000): website bán hàng (website/) + /api
 *  - PORT_ADMIN (5050): giao diện admin (thư mục admin/) + /api
 */
require('dotenv').config();
const express = require('express');
const path = require('path');
const { ready } = require('./lib/db');
const apiRouter = require('./routes');

const ROOT = path.join(__dirname, '..');
const SHOP_DIR = path.join(ROOT, 'website');
// Sneat Bootstrap 5 admin template
const ADMIN_DIST = path.join(ROOT, 'admin');
const SHOP_SHARED = SHOP_DIR;

const PORT_SHOP = Number(process.env.PORT_SHOP) || 5000;
const PORT_ADMIN = Number(process.env.PORT_ADMIN) || 5050;

function createShopApp(staticDir) {
  const app = express();
  app.use('/api', apiRouter);
  app.use('/uploads', express.static(path.join(SHOP_DIR, 'uploads'), { index: false }));
  // Bản export tĩnh không có thư mục /shop/ (WooCommerce archive); chuyển tới danh mục có sẵn
  app.get(['/shop', '/shop/'], (req, res) => {
    res.redirect(302, '/product-category/woman/');
  });
  app.use(express.static(staticDir, { index: 'index.html' }));
  return app;
}

function createAdminApp() {
  const app = express();
  app.use('/api', apiRouter);
  app.use('/uploads', express.static(path.join(SHOP_DIR, 'uploads'), { index: false }));
  // Mở http://localhost:5050/ → vào admin template (Sneat)
  app.get('/', (req, res) => {
    res.redirect(302, '/index.html');
  });
  app.use(express.static(ADMIN_DIST, { index: false }));
  return app;
}

const shopApp = createShopApp(SHOP_DIR);
const adminApp = createAdminApp();

adminApp.use('/shared', express.static(SHOP_SHARED, { index: false }));

ready
  .then(() => {
    shopApp.listen(PORT_SHOP, () => {
      console.log(`[Shop + API] http://127.0.0.1:${PORT_SHOP}/  (API: /api)`);
    });

    adminApp.listen(PORT_ADMIN, () => {
      console.log(`[Admin] http://127.0.0.1:${PORT_ADMIN}/  → index.html (có token → ngoc-app)`);
    });
  })
  .catch((err) => {
    console.error('[DB] Khởi tạo / migration thất bại:', err.message || err);
    process.exit(1);
  });
