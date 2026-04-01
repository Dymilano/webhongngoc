/**
 * Gắn ngoc-storefront / ngoc-commerce / ngoc-auth trước </body> cho các trang static còn thiếu
 * (để giỏ hàng + đăng ký API hoạt động trên mọi trang có nút thêm giỏ hoặc form đăng ký).
 */
const fs = require('fs');
const path = require('path');

const WEBSITE = path.join(__dirname, '..', '..', 'website');

function walkHtml(dir, out) {
  if (!fs.existsSync(dir)) return;
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) walkHtml(p, out);
    else if (name.endsWith('.html')) out.push(p);
  }
}

function needsNgoc(s) {
  return (
    s.includes('nasa-login-register-form') ||
    s.includes('woocommerce-form-register') ||
    s.includes('ajax_add_to_cart') ||
    s.includes('single_add_to_cart') ||
    s.includes('add-to-cart=')
  );
}

function patch() {
  const files = [];
  walkHtml(WEBSITE, files);
  let count = 0;
  for (const f of files) {
    let s = fs.readFileSync(f, 'utf8');
    if (!needsNgoc(s) || !s.includes('</body>')) continue;

    const insert = [];
    if (!s.includes('ngoc-storefront.js')) insert.push('<script src="/assets/js/ngoc-storefront.js"></script>');
    if (!s.includes('ngoc-commerce.js')) insert.push('<script src="/assets/js/ngoc-commerce.js"></script>');
    if (!s.includes('ngoc-auth.js')) insert.push('<script src="/assets/js/ngoc-auth.js"></script>');
    if (!insert.length) continue;

    const block = insert.join('\n') + '\n';
    s = s.replace(/<\/body>/i, block + '</body>');
    fs.writeFileSync(f, s);
    count++;
    console.log('OK', path.relative(WEBSITE, f));
  }
  console.log('Xong. Đã cập nhật', count, 'file.');
}

patch();
