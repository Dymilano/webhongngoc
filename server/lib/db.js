require('dotenv').config();

const USE_DB = String(process.env.USE_DB || '0') === '1';
const DB_DIALECT = String(process.env.DB_DIALECT || 'mysql').toLowerCase();

function disabledError() {
  const e = new Error('DB_DISABLED');
  e.code = 'DB_DISABLED';
  return e;
}

let pool;
let ready = Promise.resolve();

async function mysqlColumnExists(poolConn, table, column) {
  const [rows] = await poolConn.query(
    `SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ? LIMIT 1`,
    [table, column]
  );
  return rows && rows.length > 0;
}

/** Bổ sung cột dùng bởi API nhưng có thể thiếu trong DB MySQL cũ (schema.sql cũ). */
async function ensureMysqlSchema(poolConn) {
  // Ensure base tables exist so later ALTER/COLUMN checks don't fail on fresh DBs.
  // This lets the project run without manually importing schema.sql.
  await poolConn.query(`
    CREATE TABLE IF NOT EXISTS users (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      username VARCHAR(50) NOT NULL,
      full_name VARCHAR(190) DEFAULT NULL,
      phone VARCHAR(50) DEFAULT NULL,
      email VARCHAR(190) NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      role ENUM('user','staff','admin','super_admin') NOT NULL DEFAULT 'user',
      locked TINYINT(1) NOT NULL DEFAULT 0,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY email (email),
      UNIQUE KEY username (username)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  await poolConn.query(`
    CREATE TABLE IF NOT EXISTS categories (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      name VARCHAR(255) NOT NULL,
      slug VARCHAR(255) NOT NULL,
      parent_id INT UNSIGNED DEFAULT NULL,
      sort_order INT NOT NULL DEFAULT 0,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY slug (slug),
      KEY parent_id (parent_id),
      CONSTRAINT categories_parent FOREIGN KEY (parent_id) REFERENCES categories(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  await poolConn.query(`
    CREATE TABLE IF NOT EXISTS products (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      category_id INT UNSIGNED DEFAULT NULL,
      legacy_wp_id INT UNSIGNED DEFAULT NULL,
      name VARCHAR(500) NOT NULL,
      slug VARCHAR(500) NOT NULL,
      description MEDIUMTEXT,
      sku VARCHAR(100) DEFAULT NULL,
      price DECIMAL(12,2) NOT NULL DEFAULT '0.00',
      sale_price DECIMAL(12,2) DEFAULT NULL,
      stock INT NOT NULL DEFAULT 0,
      image_url VARCHAR(1000) DEFAULT NULL,
      featured TINYINT(1) NOT NULL DEFAULT 0,
      published TINYINT(1) NOT NULL DEFAULT 1,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY slug (slug(255)),
      KEY category_id (category_id),
      KEY idx_products_legacy_wp (legacy_wp_id),
      KEY published (published),
      CONSTRAINT products_category FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  await poolConn.query(`
    CREATE TABLE IF NOT EXISTS orders (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      order_code VARCHAR(32) NOT NULL,
      customer_name VARCHAR(255) NOT NULL,
      email VARCHAR(255) NOT NULL,
      phone VARCHAR(50) DEFAULT NULL,
      address TEXT,
      note TEXT,
      total DECIMAL(12,2) NOT NULL DEFAULT '0.00',
      discount_amount DECIMAL(12,2) NOT NULL DEFAULT '0.00',
      coupon_code VARCHAR(64) DEFAULT NULL,
      coupon_id INT UNSIGNED DEFAULT NULL,
      status ENUM('pending','processing','shipped','completed','cancelled') NOT NULL DEFAULT 'pending',
      payment_method VARCHAR(16) NOT NULL DEFAULT 'cod',
      payment_status VARCHAR(16) NOT NULL DEFAULT 'unpaid',
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY order_code (order_code),
      KEY status (status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  await poolConn.query(`
    CREATE TABLE IF NOT EXISTS order_items (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      order_id INT UNSIGNED NOT NULL,
      product_id INT UNSIGNED DEFAULT NULL,
      product_name VARCHAR(500) NOT NULL,
      quantity INT NOT NULL DEFAULT 1,
      unit_price DECIMAL(12,2) NOT NULL,
      PRIMARY KEY (id),
      KEY order_id (order_id),
      KEY product_id (product_id),
      CONSTRAINT order_items_order FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
      CONSTRAINT order_items_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // Server-side cart (Option A)
  await poolConn.query(`
    CREATE TABLE IF NOT EXISTS carts (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      user_id INT UNSIGNED NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uniq_user_id (user_id),
      CONSTRAINT carts_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
  await poolConn.query(`
    CREATE TABLE IF NOT EXISTS cart_items (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      cart_id INT UNSIGNED NOT NULL,
      product_id INT UNSIGNED DEFAULT NULL,
      legacy_wp_id INT UNSIGNED DEFAULT NULL,
      quantity INT NOT NULL DEFAULT 1,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY cart_id (cart_id),
      KEY product_id (product_id),
      KEY legacy_wp_id (legacy_wp_id),
      CONSTRAINT cart_items_cart FOREIGN KEY (cart_id) REFERENCES carts(id) ON DELETE CASCADE,
      CONSTRAINT cart_items_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  await poolConn.query(`
    CREATE TABLE IF NOT EXISTS site_settings (
      setting_key VARCHAR(100) NOT NULL,
      setting_value JSON DEFAULT NULL,
      PRIMARY KEY (setting_key)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  await poolConn.query(`
    CREATE TABLE IF NOT EXISTS cms_posts (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      type VARCHAR(32) NOT NULL DEFAULT 'post',
      title VARCHAR(500) NOT NULL,
      slug VARCHAR(255) NOT NULL,
      excerpt TEXT,
      body MEDIUMTEXT,
      image_url VARCHAR(1000) DEFAULT NULL,
      sort_order INT NOT NULL DEFAULT 0,
      published TINYINT(1) NOT NULL DEFAULT 1,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY slug (slug)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  await poolConn.query(`
    CREATE TABLE IF NOT EXISTS product_reviews (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      product_id INT UNSIGNED NOT NULL,
      user_id INT UNSIGNED DEFAULT NULL,
      author_name VARCHAR(255) NOT NULL,
      email VARCHAR(255) DEFAULT NULL,
      rating TINYINT UNSIGNED NOT NULL DEFAULT 5,
      comment TEXT,
      approved TINYINT(1) NOT NULL DEFAULT 0,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      KEY product_id (product_id),
      CONSTRAINT product_reviews_product FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  await poolConn.query(`
    CREATE TABLE IF NOT EXISTS coupons (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      code VARCHAR(64) NOT NULL,
      discount_type VARCHAR(16) NOT NULL DEFAULT 'percent',
      discount_value DECIMAL(12,2) NOT NULL DEFAULT '0.00',
      min_order DECIMAL(12,2) NOT NULL DEFAULT '0.00',
      max_uses INT UNSIGNED DEFAULT NULL,
      used_count INT UNSIGNED NOT NULL DEFAULT 0,
      starts_at DATETIME DEFAULT NULL,
      ends_at DATETIME DEFAULT NULL,
      active TINYINT(1) NOT NULL DEFAULT 1,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY code (code)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  if (!(await mysqlColumnExists(poolConn, 'products', 'legacy_wp_id'))) {
    await poolConn.query(
      'ALTER TABLE products ADD COLUMN legacy_wp_id INT UNSIGNED NULL AFTER category_id'
    );
  }
  if (!(await mysqlColumnExists(poolConn, 'products', 'featured'))) {
    await poolConn.query(
      'ALTER TABLE products ADD COLUMN featured TINYINT(1) NOT NULL DEFAULT 0 AFTER image_url'
    );
  }
  if (!(await mysqlColumnExists(poolConn, 'users', 'locked'))) {
    await poolConn.query(
      'ALTER TABLE users ADD COLUMN locked TINYINT(1) NOT NULL DEFAULT 0'
    );
  }
  const [roleRows] = await poolConn.query(
    `SELECT COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'role' LIMIT 1`
  );
  const ct = roleRows && roleRows[0] && String(roleRows[0].COLUMN_TYPE || '');
  // Ensure role supports 'user' (shop users) + admin roles.
  if (ct && (!ct.includes("'user'") || !ct.includes('super_admin'))) {
    await poolConn.query(
      "ALTER TABLE users MODIFY COLUMN role ENUM('user','staff','admin','super_admin') NOT NULL DEFAULT 'user'"
    );
  }
  // refresh tokens table for production-grade auth
  await poolConn.query(`
    CREATE TABLE IF NOT EXISTS user_refresh_tokens (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      user_id INT UNSIGNED NOT NULL,
      token_hash CHAR(64) NOT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      expires_at DATETIME NOT NULL,
      revoked_at DATETIME NULL,
      ip VARCHAR(64) NULL,
      user_agent VARCHAR(255) NULL,
      PRIMARY KEY (id),
      UNIQUE KEY uniq_token_hash (token_hash),
      KEY idx_user_id (user_id),
      KEY idx_expires_at (expires_at),
      CONSTRAINT fk_refresh_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // Profile fields (optional, safe migrations)
  const addUserCol = async (col, sql) => {
    if (!(await mysqlColumnExists(poolConn, 'users', col))) {
      await poolConn.query(`ALTER TABLE users ADD COLUMN ${sql}`);
    }
  };
  await addUserCol('date_of_birth', '`date_of_birth` date NULL');
  await addUserCol('gender', "`gender` enum('male','female','other','unknown') NOT NULL DEFAULT 'unknown'");
  await addUserCol('avatar_url', '`avatar_url` varchar(1000) DEFAULT NULL');
  await addUserCol('address_line', '`address_line` varchar(255) DEFAULT NULL');
  await addUserCol('ward', '`ward` varchar(120) DEFAULT NULL');
  await addUserCol('district', '`district` varchar(120) DEFAULT NULL');
  await addUserCol('city', '`city` varchar(120) DEFAULT NULL');
  await addUserCol('country', '`country` varchar(120) DEFAULT NULL');
  await addUserCol('postal_code', '`postal_code` varchar(32) DEFAULT NULL');
  await addUserCol('note', '`note` text');
  await addUserCol('updated_at', '`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP');

  // Orders: coupon/payment fields may be missing in older schemas.
  const addOrderCol = async (col, sql) => {
    if (!(await mysqlColumnExists(poolConn, 'orders', col))) {
      await poolConn.query(`ALTER TABLE orders ADD COLUMN ${sql}`);
    }
  };
  await addOrderCol('discount_amount', "`discount_amount` decimal(12,2) NOT NULL DEFAULT '0.00' AFTER total");
  await addOrderCol('coupon_code', '`coupon_code` varchar(64) DEFAULT NULL AFTER discount_amount');
  await addOrderCol('coupon_id', '`coupon_id` int unsigned DEFAULT NULL AFTER coupon_code');
  await addOrderCol('payment_method', "`payment_method` varchar(16) NOT NULL DEFAULT 'cod' AFTER status");
  await addOrderCol('payment_status', "`payment_status` varchar(16) NOT NULL DEFAULT 'unpaid' AFTER payment_method");

  // Product reviews may need approved column in some older DBs.
  const addReviewCol = async (col, sql) => {
    if (!(await mysqlColumnExists(poolConn, 'product_reviews', col))) {
      await poolConn.query(`ALTER TABLE product_reviews ADD COLUMN ${sql}`);
    }
  };
  await addReviewCol('approved', '`approved` tinyint(1) NOT NULL DEFAULT 0');

  try {
    await poolConn.query('CREATE INDEX idx_products_legacy_wp ON products (legacy_wp_id)');
  } catch (e) {
    if (e.errno !== 1061 && e.code !== 'ER_DUP_KEYNAME') throw e;
  }
}

if (USE_DB && DB_DIALECT === 'mysql') {
  const mysql = require('mysql2/promise');
  pool = mysql.createPool({
    host: process.env.MYSQL_HOST || '127.0.0.1',
    port: Number(process.env.MYSQL_PORT) || 3306,
    user: process.env.MYSQL_USER || 'root',
    password: process.env.MYSQL_PASSWORD || '',
    database: process.env.MYSQL_DATABASE || 'ngoc_clothes',
    waitForConnections: true,
    connectionLimit: 10,
    namedPlaceholders: true
  });
  ready = ensureMysqlSchema(pool);
} else if (USE_DB && DB_DIALECT === 'sqlite') {
  const fs = require('fs');
  const path = require('path');
  const sqlite3 = require('sqlite3');
  const { open } = require('sqlite');

  const sqlitePath = process.env.SQLITE_PATH || './data/ngocclothes.sqlite';
  const absPath = path.isAbsolute(sqlitePath) ? sqlitePath : path.join(__dirname, '..', sqlitePath);
  fs.mkdirSync(path.dirname(absPath), { recursive: true });

  const dbPromise = open({ filename: absPath, driver: sqlite3.Database });

  async function initSqlite(db) {
    await db.exec('PRAGMA foreign_keys = ON;');
    await db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE,
        full_name TEXT,
        phone TEXT,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'user',
        locked INTEGER NOT NULL DEFAULT 0,
        date_of_birth TEXT,
        gender TEXT NOT NULL DEFAULT 'unknown',
        avatar_url TEXT,
        address_line TEXT,
        ward TEXT,
        district TEXT,
        city TEXT,
        country TEXT,
        postal_code TEXT,
        note TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE TABLE IF NOT EXISTS user_refresh_tokens (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        token_hash TEXT NOT NULL UNIQUE,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        expires_at TEXT NOT NULL,
        revoked_at TEXT,
        ip TEXT,
        user_agent TEXT,
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
      );
      CREATE TABLE IF NOT EXISTS categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        slug TEXT NOT NULL UNIQUE,
        parent_id INTEGER,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY(parent_id) REFERENCES categories(id) ON DELETE SET NULL
      );
      CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        category_id INTEGER,
        legacy_wp_id INTEGER,
        name TEXT NOT NULL,
        slug TEXT NOT NULL UNIQUE,
        description TEXT,
        sku TEXT,
        price REAL NOT NULL DEFAULT 0,
        sale_price REAL,
        stock INTEGER NOT NULL DEFAULT 0,
        image_url TEXT,
        featured INTEGER NOT NULL DEFAULT 0,
        published INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY(category_id) REFERENCES categories(id) ON DELETE SET NULL
      );
      CREATE TABLE IF NOT EXISTS orders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_code TEXT NOT NULL UNIQUE,
        customer_name TEXT NOT NULL,
        email TEXT NOT NULL,
        phone TEXT,
        address TEXT,
        note TEXT,
        total REAL NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'pending',
        payment_method TEXT NOT NULL DEFAULT 'cod',
        payment_status TEXT NOT NULL DEFAULT 'unpaid',
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE TABLE IF NOT EXISTS order_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id INTEGER NOT NULL,
        product_id INTEGER,
        product_name TEXT NOT NULL,
        quantity INTEGER NOT NULL DEFAULT 1,
        unit_price REAL NOT NULL,
        FOREIGN KEY(order_id) REFERENCES orders(id) ON DELETE CASCADE,
        FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE SET NULL
      );
      CREATE TABLE IF NOT EXISTS carts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL UNIQUE,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
      );
      CREATE TABLE IF NOT EXISTS cart_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        cart_id INTEGER NOT NULL,
        product_id INTEGER,
        legacy_wp_id INTEGER,
        quantity INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY(cart_id) REFERENCES carts(id) ON DELETE CASCADE,
        FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE SET NULL
      );
      CREATE TABLE IF NOT EXISTS site_settings (
        setting_key TEXT PRIMARY KEY,
        setting_value TEXT
      );
      CREATE TABLE IF NOT EXISTS cms_posts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL DEFAULT 'post',
        title TEXT NOT NULL,
        slug TEXT NOT NULL UNIQUE,
        excerpt TEXT,
        body TEXT,
        image_url TEXT,
        sort_order INTEGER NOT NULL DEFAULT 0,
        published INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        updated_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE TABLE IF NOT EXISTS product_reviews (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        product_id INTEGER NOT NULL,
        user_id INTEGER,
        author_name TEXT NOT NULL,
        email TEXT,
        rating INTEGER NOT NULL DEFAULT 5,
        comment TEXT,
        approved INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE CASCADE
      );
      CREATE TABLE IF NOT EXISTS coupons (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        code TEXT NOT NULL UNIQUE,
        discount_type TEXT NOT NULL DEFAULT 'percent',
        discount_value REAL NOT NULL DEFAULT 0,
        min_order REAL NOT NULL DEFAULT 0,
        max_uses INTEGER,
        used_count INTEGER NOT NULL DEFAULT 0,
        starts_at TEXT,
        ends_at TEXT,
        active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
    `);

    // Lightweight migrations for existing DB files
    const ensureColumn = async (table, col, defSql) => {
      const cols = await db.all(`PRAGMA table_info(${table});`);
      if (!cols.some((c) => c.name === col)) {
        await db.exec(`ALTER TABLE ${table} ADD COLUMN ${defSql};`);
      }
    };
    await ensureColumn('users', 'locked', 'locked INTEGER NOT NULL DEFAULT 0');
    await ensureColumn('users', 'date_of_birth', 'date_of_birth TEXT');
    await ensureColumn('users', 'gender', "gender TEXT NOT NULL DEFAULT 'unknown'");
    await ensureColumn('users', 'avatar_url', 'avatar_url TEXT');
    await ensureColumn('users', 'address_line', 'address_line TEXT');
    await ensureColumn('users', 'ward', 'ward TEXT');
    await ensureColumn('users', 'district', 'district TEXT');
    await ensureColumn('users', 'city', 'city TEXT');
    await ensureColumn('users', 'country', 'country TEXT');
    await ensureColumn('users', 'postal_code', 'postal_code TEXT');
    await ensureColumn('users', 'note', 'note TEXT');
    // SQLite hạn chế ADD COLUMN với default là biểu thức (datetime('now')).
    // Thêm cột trước (nullable), rồi backfill sau.
    await ensureColumn('users', 'updated_at', 'updated_at TEXT');
    await ensureColumn('products', 'featured', 'featured INTEGER NOT NULL DEFAULT 0');
    await ensureColumn('products', 'legacy_wp_id', 'legacy_wp_id INTEGER');
    await ensureColumn('orders', 'payment_method', "payment_method TEXT NOT NULL DEFAULT 'cod'");
    await ensureColumn('orders', 'payment_status', "payment_status TEXT NOT NULL DEFAULT 'unpaid'");
    await ensureColumn('orders', 'discount_amount', 'discount_amount REAL NOT NULL DEFAULT 0');
    await ensureColumn('orders', 'coupon_code', 'coupon_code TEXT');
    await ensureColumn('orders', 'coupon_id', 'coupon_id INTEGER');
    // Coupons: older sqlite files may have a minimal coupons table; ensure all columns exist.
    await ensureColumn('coupons', 'discount_type', "discount_type TEXT NOT NULL DEFAULT 'percent'");
    await ensureColumn('coupons', 'discount_value', 'discount_value REAL NOT NULL DEFAULT 0');
    await ensureColumn('coupons', 'min_order', 'min_order REAL NOT NULL DEFAULT 0');
    await ensureColumn('coupons', 'max_uses', 'max_uses INTEGER');
    await ensureColumn('coupons', 'used_count', 'used_count INTEGER NOT NULL DEFAULT 0');
    await ensureColumn('coupons', 'starts_at', 'starts_at TEXT');
    await ensureColumn('coupons', 'ends_at', 'ends_at TEXT');
    await ensureColumn('coupons', 'active', 'active INTEGER NOT NULL DEFAULT 1');
    await ensureColumn('coupons', 'created_at', "created_at TEXT NOT NULL DEFAULT (datetime('now'))");

    // Reviews: ensure moderation flag exists for old sqlite files.
    await ensureColumn('product_reviews', 'approved', 'approved INTEGER NOT NULL DEFAULT 0');
    // Ensure role column is not dangerously defaulting to admin in older DB files.
    try {
      await db.exec(`UPDATE users SET role = 'user' WHERE role IS NULL OR TRIM(role) = ''`);
    } catch (_) {}
    try {
      await db.exec(`UPDATE users SET updated_at = datetime('now') WHERE updated_at IS NULL OR TRIM(updated_at) = ''`);
    } catch (_) {}

    // (tables cms_posts/product_reviews/coupons đã được tạo ở bước đầu)
  }

  // initialize once
  ready = dbPromise.then(initSqlite);

  function toPositional(sql, params) {
    if (!params || Array.isArray(params)) return { sql, params: params || [] };
    const keys = [];
    const outSql = sql.replace(/:(\w+)/g, (_, k) => {
      keys.push(k);
      return '?';
    });
    const outParams = keys.map((k) => params[k]);
    return { sql: outSql, params: outParams };
  }

  pool = {
    query: async (sql, params) => {
      const db = await dbPromise;
      const norm = toPositional(sql, params);
      const trimmed = String(norm.sql).trim().toLowerCase();
      if (trimmed.startsWith('select')) {
        const rows = await db.all(norm.sql, norm.params);
        return [rows];
      }
      const res = await db.run(norm.sql, norm.params);
      return [{ insertId: res.lastID, affectedRows: res.changes }];
    },
    getConnection: async () => {
      const db = await dbPromise;
      return {
        query: async (sql, params) => {
          const norm = toPositional(sql, params);
          const trimmed = String(norm.sql).trim().toLowerCase();
          if (trimmed.startsWith('select')) {
            const rows = await db.all(norm.sql, norm.params);
            return [rows];
          }
          const res = await db.run(norm.sql, norm.params);
          return [{ insertId: res.lastID, affectedRows: res.changes }];
        },
        beginTransaction: async () => db.exec('BEGIN IMMEDIATE;'),
        commit: async () => db.exec('COMMIT;'),
        rollback: async () => db.exec('ROLLBACK;'),
        release: () => {}
      };
    }
  };
} else {
  pool = {
    query: async () => {
      throw disabledError();
    },
    getConnection: async () => {
      throw disabledError();
    }
  };
}

function isDbEnabled() {
  return USE_DB;
}

module.exports = { pool, isDbEnabled, ready, DB_DIALECT };
