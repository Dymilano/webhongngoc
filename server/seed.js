require('dotenv').config();
const bcrypt = require('bcryptjs');
const { pool, ready } = require('./lib/db');

async function main() {
  await ready;
  const dialect = String(process.env.DB_DIALECT || 'mysql').toLowerCase();
  const isMysql = dialect === 'mysql';
  const email = process.env.ADMIN_EMAIL || 'admin@ngoc.local';
  const password = process.env.ADMIN_PASSWORD || 'Admin@123';
  const username = process.env.ADMIN_USERNAME || 'admin';
  const fullName = process.env.ADMIN_FULL_NAME || "Ngoc's Admin";
  const phone = process.env.ADMIN_PHONE || '0900000000';
  const hash = await bcrypt.hash(password, 10);

  if (isMysql) {
    await pool.query(
      `INSERT INTO users (username, full_name, phone, email, password_hash, role)
       VALUES (?, ?, ?, ?, ?, 'admin')
       ON DUPLICATE KEY UPDATE
         username=VALUES(username),
         full_name=VALUES(full_name),
         phone=VALUES(phone),
         password_hash=VALUES(password_hash),
         role='admin'`,
      [username, fullName, phone, email, hash]
    );
  } else {
    await pool.query(
      `INSERT INTO users (username, full_name, phone, email, password_hash, role)
       VALUES (?, ?, ?, ?, ?, 'admin')
       ON CONFLICT(email) DO UPDATE SET
         username=excluded.username,
         full_name=excluded.full_name,
         phone=excluded.phone,
         password_hash=excluded.password_hash,
         role='admin'`,
      [username, fullName, phone, email, hash]
    );
  }
  console.log('Admin:', username, '|', email, '| password:', password);

  const cats = [
    ['Nữ', 'nu'],
    ['Nam', 'nam'],
    ['Phụ kiện', 'phu-kien']
  ];
  for (const [name, slug] of cats) {
    if (isMysql) {
      await pool.query(`INSERT IGNORE INTO categories (name, slug, sort_order) VALUES (?, ?, 0)`, [name, slug]);
    } else {
      await pool.query(
        `INSERT INTO categories (name, slug, sort_order) VALUES (?, ?, 0)
         ON CONFLICT(slug) DO NOTHING`,
        [name, slug]
      );
    }
  }
  console.log('Đã thêm danh mục mẫu (nếu chưa có).');

  if (isMysql) {
    await pool.query(
      `INSERT INTO site_settings (setting_key, setting_value) VALUES ('site_name', ?)
       ON DUPLICATE KEY UPDATE setting_value=VALUES(setting_value)`,
      [JSON.stringify("Ngoc's clothes")]
    );
    await pool.query(
      `INSERT INTO site_settings (setting_key, setting_value) VALUES ('topbar_text', ?)
       ON DUPLICATE KEY UPDATE setting_value=VALUES(setting_value)`,
      [JSON.stringify('Đăng ký tài khoản nhận ngay ưu đãi 20% đơn hàng đầu tiên')]
    );
  } else {
    await pool.query(
      `INSERT INTO site_settings (setting_key, setting_value) VALUES ('site_name', ?)
       ON CONFLICT(setting_key) DO UPDATE SET setting_value=excluded.setting_value`,
      [JSON.stringify("Ngoc's clothes")]
    );
    await pool.query(
      `INSERT INTO site_settings (setting_key, setting_value) VALUES ('topbar_text', ?)
       ON CONFLICT(setting_key) DO UPDATE SET setting_value=excluded.setting_value`,
      [JSON.stringify('Đăng ký tài khoản nhận ngay ưu đãi 20% đơn hàng đầu tiên')]
    );
  }
  const shopUrl = process.env.STOREFRONT_URL || 'http://127.0.0.1:5000';
  if (isMysql) {
    await pool.query(
      `INSERT INTO site_settings (setting_key, setting_value) VALUES ('storefront_url', ?)
       ON DUPLICATE KEY UPDATE setting_value=VALUES(setting_value)`,
      [JSON.stringify(shopUrl)]
    );
  } else {
    await pool.query(
      `INSERT INTO site_settings (setting_key, setting_value) VALUES ('storefront_url', ?)
       ON CONFLICT(setting_key) DO UPDATE SET setting_value=excluded.setting_value`,
      [JSON.stringify(shopUrl)]
    );
  }

  // Seed products (needed for cart/checkout demo flows)
  const [pCountRows] = await pool.query('SELECT COUNT(*) AS n FROM products');
  const pCount = Number(pCountRows && pCountRows[0] ? pCountRows[0].n : 0);
  if (pCount < 3) {
    const [catRows] = await pool.query('SELECT id, slug FROM categories');
    const catBySlug = {};
    (catRows || []).forEach((c) => (catBySlug[String(c.slug)] = c.id));
    const catNu = catBySlug.nu || null;
    const catNam = catBySlug.nam || null;
    const catPk = catBySlug['phu-kien'] || null;

    const samples = [
      {
        category_id: catNu,
        legacy_wp_id: 1273,
        name: 'Áo thun nữ basic',
        slug: 'ao-thun-nu-basic',
        price: 199000,
        sale_price: 159000,
        stock: 50,
        image_url: '/wp-content/uploads/2024/04/cropped-logo-mona-ft-1-192x192.png',
        featured: 1,
        published: 1
      },
      {
        category_id: catNam,
        legacy_wp_id: 1274,
        name: 'Sơ mi nam slimfit',
        slug: 'so-mi-nam-slimfit',
        price: 299000,
        sale_price: null,
        stock: 35,
        image_url: '/wp-content/uploads/2024/04/cropped-logo-mona-ft-1-192x192.png',
        featured: 0,
        published: 1
      },
      {
        category_id: catPk,
        legacy_wp_id: 1275,
        name: 'Túi tote canvas',
        slug: 'tui-tote-canvas',
        price: 149000,
        sale_price: null,
        stock: 80,
        image_url: '/wp-content/uploads/2024/04/cropped-logo-mona-ft-1-192x192.png',
        featured: 1,
        published: 1
      }
    ];

    for (const s of samples) {
      if (isMysql) {
        await pool.query(
          `INSERT INTO products (category_id, legacy_wp_id, name, slug, description, sku, price, sale_price, stock, image_url, featured, published)
           VALUES (?, ?, ?, ?, NULL, NULL, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE
             category_id=VALUES(category_id),
             legacy_wp_id=VALUES(legacy_wp_id),
             name=VALUES(name),
             price=VALUES(price),
             sale_price=VALUES(sale_price),
             stock=VALUES(stock),
             image_url=VALUES(image_url),
             featured=VALUES(featured),
             published=VALUES(published)`,
          [
            s.category_id,
            s.legacy_wp_id,
            s.name,
            s.slug,
            s.price,
            s.sale_price,
            s.stock,
            s.image_url,
            s.featured,
            s.published
          ]
        );
      } else {
        await pool.query(
          `INSERT INTO products (category_id, legacy_wp_id, name, slug, description, sku, price, sale_price, stock, image_url, featured, published)
           VALUES (?, ?, ?, ?, NULL, NULL, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(slug) DO UPDATE SET
             category_id=excluded.category_id,
             legacy_wp_id=excluded.legacy_wp_id,
             name=excluded.name,
             price=excluded.price,
             sale_price=excluded.sale_price,
             stock=excluded.stock,
             image_url=excluded.image_url,
             featured=excluded.featured,
             published=excluded.published`,
          [
            s.category_id,
            s.legacy_wp_id,
            s.name,
            s.slug,
            s.price,
            s.sale_price,
            s.stock,
            s.image_url,
            s.featured,
            s.published
          ]
        );
      }
    }
    console.log('Đã thêm sản phẩm mẫu (nếu thiếu).');
  }

  console.log('Seed xong.');
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
