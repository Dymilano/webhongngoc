/**
 * Đồng bộ danh mục (product-category), sản phẩm (product/*), bài viết (YYYY/MM/DD/slug)
 * từ thư mục website/ tĩnh vào SQLite (USE_DB=1).
 *
 * Chạy:  cd server && node scripts/sync-static-site.js
 * hoặc: npm run sync:website
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { pool, ready, isDbEnabled } = require('../lib/db');

const ROOT = path.join(__dirname, '..', '..');
const WEBSITE = path.join(ROOT, 'website');
const STOREFRONT = String(process.env.STOREFRONT_URL || 'http://127.0.0.1:5000').replace(/\/$/, '');

function absMediaUrl(u) {
  if (u == null || u === '') return null;
  const s = String(u).trim();
  if (!s) return null;
  if (/^https?:\/\//i.test(s)) return s;
  return STOREFRONT + (s.startsWith('/') ? s : '/' + s);
}

function walkFiles(dir, out, filter) {
  if (!fs.existsSync(dir)) return;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (ent.name === 'feed' || ent.name === 'node_modules') continue;
      walkFiles(p, out, filter);
    } else if (filter(p)) out.push(p);
  }
}

function read(p) {
  try {
    return fs.readFileSync(p, 'utf8');
  } catch {
    return '';
  }
}

function decodeTitle(t) {
  return String(t || '')
    .replace(/&#8211;/g, '–')
    .replace(/&#8217;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/\s*[–-]\s*Ngoc's clothes\s*$/i, '')
    .trim();
}

function stripTags(html) {
  return String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseVndAmount(htmlChunk) {
  const bdi = htmlChunk.match(/<bdi[^>]*>([\s\S]*?)<\/bdi>/i);
  const raw = bdi ? bdi[1] : htmlChunk;
  let text = String(raw).replace(/<[^>]+>/g, '');
  text = text.replace(/&[#a-z0-9]+;/gi, '');
  const digits = text.replace(/\D/g, '');
  return digits ? parseInt(digits, 10) : 0;
}

/** Giá chính trong vùng summary sản phẩm đơn */
function parseProductPrices(html) {
  const idx = html.indexOf('entry-summary');
  const slice = idx >= 0 ? html.slice(idx, idx + 20000) : html.slice(0, 25000);
  const priceBlock = slice.match(/<span class="price">([\s\S]*?)<\/span>\s*(?:<\/p>|<form|class="cart")/i);
  if (!priceBlock) {
    const loose = slice.match(/<span class="price">([\s\S]*?)<\/span>/);
    if (!loose) return { price: 0, sale_price: null };
    const inner = loose[1];
    const ins = inner.match(/<ins[^>]*>[\s\S]*?<\/ins>/i);
    const del = inner.match(/<del[^>]*>[\s\S]*?<\/del>/i);
    if (ins && del) {
      return { price: parseVndAmount(del[0]), sale_price: parseVndAmount(ins[0]) };
    }
    return { price: parseVndAmount(inner), sale_price: null };
  }
  const inner = priceBlock[1];
  const ins = inner.match(/<ins[^>]*>[\s\S]*?<\/ins>/i);
  const del = inner.match(/<del[^>]*>[\s\S]*?<\/del>/i);
  if (ins && del) {
    return { price: parseVndAmount(del[0]), sale_price: parseVndAmount(ins[0]) };
  }
  return { price: parseVndAmount(inner), sale_price: null };
}

/** WooCommerce variable: JSON có display_price */
function fallbackVariablePrice(html) {
  const m = html.match(/"display_price"\s*:\s*(\d+)/);
  return m ? parseInt(m[1], 10) : 0;
}

function parseProductMeta(html, folderSlug) {
  const postId =
    html.match(/\bpostid-(\d+)\b/) ||
    html.match(/name="add-to-cart"\s+value="(\d+)"/) ||
    html.match(/data-product_id="(\d+)"/);
  const legacy = postId ? parseInt(postId[1], 10) : null;

  const titleM = html.match(/<title>([^<]+)<\/title>/i);
  const name = decodeTitle(titleM ? titleM[1] : folderSlug);

  const slug = folderSlug;

  const og = html.match(/property="og:image"[^>]+content="([^"]+)"/i);
  let imageUrl = og ? og[1] : null;
  if (!imageUrl) {
    const img = html.match(/woocommerce-product-gallery__image[^>]*>[\s\S]*?<img[^>]+src="([^"]+)"/i);
    imageUrl = img ? img[1] : null;
  }
  imageUrl = absMediaUrl(imageUrl);

  let categoryLeafSlug = null;
  const posted = html.match(/<span class="posted_in"[^>]*>([\s\S]*?)<\/span>/i);
  if (posted) {
    const links = [...posted[0].matchAll(/\/product-category\/([^"]+)/g)];
    if (links.length) {
      const last = links[links.length - 1][1].replace(/\/$/, '');
      const segs = last.split('/').filter(Boolean);
      categoryLeafSlug = segs.length ? segs[segs.length - 1] : null;
    }
  }
  if (!categoryLeafSlug) {
    const pc = html.match(/product_cat-([a-z0-9_-]+)/i);
    if (pc) categoryLeafSlug = pc[1];
  }

  const prodDiv = html.match(/<div[^>]*\bpost-\d+[^>]*\bproduct\b[^>]*>/i);
  const featured = prodDiv && /\bfeatured\b/.test(prodDiv[0]);

  const short = html.match(
    /woocommerce-product-details__short-description[^>]*>([\s\S]*?)<\/div>/i
  );
  const description = short ? stripTags(short[1]).slice(0, 8000) : null;

  let { price, sale_price } = parseProductPrices(html);
  if (!price) {
    const fp = fallbackVariablePrice(html);
    if (fp) price = fp;
  }

  return {
    legacy_wp_id: legacy,
    name,
    slug,
    description,
    price: price || 0,
    sale_price: sale_price && sale_price < (price || 0) ? sale_price : null,
    image_url: imageUrl,
    category_leaf_slug: categoryLeafSlug,
    featured
  };
}

function parseCategoryTitle(html) {
  const m = html.match(/<title>([^<]+)<\/title>/i);
  return decodeTitle(m ? m[1] : '');
}

async function main() {
  if (!isDbEnabled()) {
    console.error('USE_DB=1 trong .env để chạy đồng bộ.');
    process.exit(1);
  }
  await ready;

  if (!fs.existsSync(WEBSITE)) {
    console.error('Không thấy thư mục website:', WEBSITE);
    process.exit(1);
  }

  const catFiles = [];
  const pcRoot = path.join(WEBSITE, 'product-category');
  walkFiles(
    pcRoot,
    catFiles,
    (p) => p.endsWith(`${path.sep}index.html`) && !p.includes(`${path.sep}feed${path.sep}`)
  );

  /** @type {{ rel: string, slug: string, parentSlug: string | null, name: string }[]} */
  const catRows = [];
  for (const fp of catFiles) {
    const rel = path.relative(pcRoot, fp).replace(/[/\\]index\.html$/, '').replace(/\\/g, '/');
    if (!rel || rel === 'index.html') continue;
    const segments = rel.split('/').filter(Boolean);
    const slug = segments[segments.length - 1];
    const parentSlug = segments.length > 1 ? segments[segments.length - 2] : null;
    const html = read(fp);
    let name = parseCategoryTitle(html) || slug;
    if (!name) name = slug;
    catRows.push({ rel, slug, parentSlug, name });
  }

  catRows.sort((a, b) => a.rel.split('/').length - b.rel.split('/').length);

  const slugToId = Object.create(null);

  for (const row of catRows) {
    let parentId = null;
    if (row.parentSlug) {
      parentId = slugToId[row.parentSlug];
      if (parentId == null) {
        console.warn('Thiếu parent cho', row.slug, '— bỏ qua parent');
      }
    }
    const [exist] = await pool.query('SELECT id FROM categories WHERE slug = ? LIMIT 1', [row.slug]);
    if (exist[0]) {
      slugToId[row.slug] = exist[0].id;
      continue;
    }
    const [ins] = await pool.query(
      `INSERT INTO categories (name, slug, parent_id, sort_order) VALUES (:name, :slug, :parent_id, 0)`,
      { name: row.name, slug: row.slug, parent_id: parentId }
    );
    slugToId[row.slug] = ins.insertId;
    console.log('Danh mục:', row.slug, '→', ins.insertId);
  }

  const productDirs = [];
  const prodRoot = path.join(WEBSITE, 'product');
  if (fs.existsSync(prodRoot)) {
    for (const ent of fs.readdirSync(prodRoot, { withFileTypes: true })) {
      if (!ent.isDirectory()) continue;
      const idx = path.join(prodRoot, ent.name, 'index.html');
      if (fs.existsSync(idx)) productDirs.push({ slug: ent.name, file: idx });
    }
  }

  let pOk = 0;
  let pSkip = 0;
  for (const { slug, file } of productDirs) {
    const html = read(file);
    const meta = parseProductMeta(html, slug);
    if (!meta.legacy_wp_id) {
      console.warn('Bỏ qua SP (không có post id):', slug);
      pSkip++;
      continue;
    }

    const cid = meta.category_leaf_slug ? slugToId[meta.category_leaf_slug] : null;
    if (meta.category_leaf_slug && cid == null) {
      console.warn('Không map được danh mục', meta.category_leaf_slug, 'cho', slug);
    }

    const [existing] = await pool.query('SELECT id FROM products WHERE legacy_wp_id = ? LIMIT 1', [
      meta.legacy_wp_id
    ]);
    if (existing[0]) {
      await pool.query(
        `UPDATE products SET
          category_id = :category_id,
          name = :name,
          slug = :slug,
          description = :description,
          price = :price,
          sale_price = :sale_price,
          stock = CASE WHEN stock IS NULL OR stock < 0 THEN 50 ELSE stock END,
          image_url = :image_url,
          featured = :featured,
          published = 1,
          updated_at = CURRENT_TIMESTAMP
         WHERE id = :id`,
        {
          id: existing[0].id,
          category_id: cid,
          name: meta.name,
          slug: meta.slug,
          description: meta.description,
          price: meta.price,
          sale_price: meta.sale_price,
          image_url: meta.image_url,
          featured: meta.featured ? 1 : 0
        }
      );
      console.log('Cập nhật SP', meta.slug, 'legacy', meta.legacy_wp_id);
    } else {
      const [ins] = await pool.query(
        `INSERT INTO products (category_id, legacy_wp_id, name, slug, description, sku, price, sale_price, stock, image_url, featured, published)
         VALUES (:category_id, :legacy_wp_id, :name, :slug, :description, NULL, :price, :sale_price, 50, :image_url, :featured, 1)`,
        {
          category_id: cid,
          legacy_wp_id: meta.legacy_wp_id,
          name: meta.name,
          slug: meta.slug,
          description: meta.description,
          price: meta.price,
          sale_price: meta.sale_price,
          image_url: meta.image_url,
          featured: meta.featured ? 1 : 0
        }
      );
      console.log('Thêm SP', meta.slug, 'id', ins.insertId, 'legacy', meta.legacy_wp_id);
    }
    pOk++;
  }

  const blogFiles = [];
  for (const y of ['2017', '2018', '2019', '2020']) {
    const ydir = path.join(WEBSITE, y);
    if (!fs.existsSync(ydir)) continue;
    walkFiles(ydir, blogFiles, (p) => {
      if (!p.endsWith('index.html') || p.includes(`${path.sep}feed${path.sep}`)) return false;
      const rel = path.relative(WEBSITE, p).replace(/\\/g, '/');
      return /^\d{4}\/\d{2}\/\d{2}\/[^/]+\/index\.html$/.test(rel);
    });
  }

  let bOk = 0;
  for (const fp of blogFiles) {
    const htmlContent = read(fp);
    const postId = htmlContent.match(/\bpostid-(\d+)\b/);
    const single = htmlContent.match(/single-post|post-template-default/);
    if (!single && !postId) continue;

    const parts = fp.split(path.sep);
    const slug = parts[parts.length - 2];
    const titleM = htmlContent.match(/<title>([^<]+)<\/title>/i);
    const title = decodeTitle(titleM ? titleM[1] : slug);

    let body = '';
    const ecPos = htmlContent.search(/class="[^"]*\bentry-content\b[^"]*"/i);
    if (ecPos >= 0) {
      const gt = htmlContent.indexOf('>', ecPos);
      if (gt >= 0) {
        const start = gt + 1;
        let chunk = htmlContent.slice(start, start + 120000);
        const endMark = chunk.search(/<footer\b|<section[^>]+nasa-breadcrumb|id="comments"|class="[^"]*nasa-blog/i);
        body = endMark > 0 ? chunk.slice(0, endMark) : chunk;
      }
    }
    const excerpt = stripTags(body).slice(0, 500);

    const og = htmlContent.match(/property="og:image"[^>]+content="([^"]+)"/i);
    const imageUrl = absMediaUrl(og ? og[1] : null);

    const [dup] = await pool.query('SELECT id FROM cms_posts WHERE slug = ? LIMIT 1', [slug]);
    if (dup[0]) {
      await pool.query(
        `UPDATE cms_posts SET type = 'post', title = :title, excerpt = :excerpt, body = :body, image_url = COALESCE(:image_url, image_url), published = 1, updated_at = CURRENT_TIMESTAMP WHERE id = :id`,
        {
          id: dup[0].id,
          title,
          excerpt,
          body: body.slice(0, 200000),
          image_url: imageUrl
        }
      );
      console.log('Cập nhật bài viết', slug);
    } else {
      await pool.query(
        `INSERT INTO cms_posts (type, title, slug, excerpt, body, image_url, sort_order, published, updated_at)
         VALUES ('post', :title, :slug, :excerpt, :body, :image_url, 0, 1, CURRENT_TIMESTAMP)`,
        {
          title,
          slug,
          excerpt,
          body: body.slice(0, 200000),
          image_url: imageUrl
        }
      );
      console.log('Thêm bài viết', slug);
    }
    bOk++;
  }

  const [roots] = await pool.query(
    `SELECT COUNT(*) AS n FROM categories WHERE parent_id IS NULL`
  );
  console.log(
    '\nXong. Danh mục:',
    catRows.length,
    '(cấp gốc:',
    roots[0] ? roots[0].n : 0,
    ') | Sản phẩm:',
    pOk,
    '(bỏ qua:',
    pSkip + ') | Bài viết:',
    bOk,
    '\nẢnh đã chuẩn hoá URL theo',
    STOREFRONT
  );
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
