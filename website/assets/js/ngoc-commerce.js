/**
 * Lightweight commerce bridge for the static WP theme:
 * - Intercepts "add to cart" buttons (data-product_id / add-to-cart=)
 * - Stores cart in localStorage
 * - Renders cart + checkout on /shopping-cart/ and /checkout/
 * - Uses API products lookup by legacy WP id: /api/products/public-by-legacy/:legacy
 */
(function () {
  const API = '/api';
  const CART_KEY = 'ngoc_cart_v1';

  function readCart() {
    try {
      const raw = localStorage.getItem(CART_KEY);
      const j = raw ? JSON.parse(raw) : [];
      return Array.isArray(j) ? j : [];
    } catch (_) {
      return [];
    }
  }

  function writeCart(items) {
    localStorage.setItem(CART_KEY, JSON.stringify(items || []));
    updateCartBadges();
  }

  function addToCart(legacyId, qty) {
    const id = parseInt(legacyId, 10);
    const q = Math.max(1, parseInt(qty, 10) || 1);
    if (!Number.isFinite(id)) return;
    const cart = readCart();
    const hit = cart.find((x) => x && x.legacy_wp_id === id);
    if (hit) hit.quantity += q;
    else cart.push({ legacy_wp_id: id, quantity: q });
    writeCart(cart);
  }

  function removeFromCart(legacyId) {
    const id = parseInt(legacyId, 10);
    const cart = readCart().filter((x) => x && x.legacy_wp_id !== id);
    writeCart(cart);
  }

  function setQty(legacyId, qty) {
    const id = parseInt(legacyId, 10);
    const q = Math.max(0, parseInt(qty, 10) || 0);
    const cart = readCart();
    const hit = cart.find((x) => x && x.legacy_wp_id === id);
    if (!hit) return;
    if (q <= 0) return removeFromCart(id);
    hit.quantity = q;
    writeCart(cart);
  }

  function cartCount() {
    return readCart().reduce((s, x) => s + (x ? x.quantity : 0), 0);
  }

  function updateCartBadges() {
    const n = cartCount();
    document.querySelectorAll('.nasa-cart-count, .cart-number').forEach((el) => {
      el.textContent = String(n);
      el.classList.remove('hidden-tag', 'nasa-product-empty');
    });
  }

  async function fetchProductByLegacy(legacyId) {
    const r = await fetch(`${API}/products/public-by-legacy/${encodeURIComponent(legacyId)}`);
    if (!r.ok) return null;
    return r.json().catch(() => null);
  }

  function money(v) {
    const n = Number(v || 0);
    try {
      return n.toLocaleString('vi-VN') + '₫';
    } catch (_) {
      return String(n) + '₫';
    }
  }

  function parseLegacyIdFromLink(el) {
    if (!el) return null;
    const dp = el.getAttribute('data-product_id') || el.getAttribute('data-product-id');
    if (dp) return dp;
    // Single product button: <button name="add-to-cart" value="1273" ...>
    const nm = el.getAttribute('name');
    const val = el.getAttribute('value');
    if (nm && nm.toLowerCase() === 'add-to-cart' && val) return val;
    // Some templates store id in hidden inputs inside the form
    const form = el.closest ? el.closest('form') : null;
    if (form) {
      const btn = form.querySelector('button[name="add-to-cart"], input[name="add-to-cart"]');
      if (btn && btn.getAttribute('value')) return btn.getAttribute('value');
      const hid = form.querySelector('input[name="data-product_id"], input[name="product_id"]');
      if (hid && hid.getAttribute('value')) return hid.getAttribute('value');
    }
    const href = el.getAttribute('href') || '';
    const m = href.match(/[?&]add-to-cart=(\d+)/i);
    if (m) return m[1];
    return null;
  }

  function addToCartClickTarget(el) {
    return el && el.closest
      ? el.closest(
          [
            'a.ajax_add_to_cart',
            'a.add_to_cart_button',
            'a[href*="add-to-cart="]',
            'button.single_add_to_cart',
            'button.single_add_to_cart_button',
            'button.add_to_cart_button',
            'button[name="add-to-cart"]'
          ].join(', ')
        )
      : null;
  }

  function showCartNotice(text, isErr) {
    try {
      const wrap =
        document.querySelector('.woocommerce-notices-wrapper') ||
        (function () {
          const main = document.querySelector('main, #main, .site-main, .main-content, #content') || document.body;
          const d = document.createElement('div');
          d.className = 'woocommerce-notices-wrapper';
          main.prepend(d);
          return d;
        })();
      const cls = isErr ? 'woocommerce-error' : 'woocommerce-message';
      wrap.innerHTML = '<ul class="' + cls + '" role="alert"><li>' + escapeHtml(text) + '</li></ul>';
    } catch (_) {}
  }

  function bindAddToCart() {
    document.addEventListener(
      'click',
      function (e) {
        const node = addToCartClickTarget(e.target);
        if (!node) return;
        const legacy = parseLegacyIdFromLink(node);
        if (!legacy) {
          // If we cannot map product id, do not claim success.
          return showCartNotice('Không xác định được sản phẩm để thêm vào giỏ. Vui lòng thử lại.', true);
        }
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        const qn = node.getAttribute('data-quantity');
        const qty = qn ? Math.max(1, parseInt(qn, 10) || 1) : 1;
        addToCart(legacy, qty);
        showCartNotice('Đã thêm sản phẩm vào giỏ hàng.', false);
        try {
          const t = node.querySelector('.add_to_cart_text');
          if (t) t.textContent = 'Đã thêm';
        } catch (_) {}
      },
      true
    );
  }

  function ensureContainer(id) {
    let el = document.getElementById(id);
    if (el) return el;
    el = document.createElement('div');
    el.id = id;
    // put near top of main content
    const main = document.querySelector('main, #main, .site-main, .main-content, #content') || document.body;
    main.prepend(el);
    return el;
  }

  async function renderCartPage() {
    const host = ensureContainer('ngoc-cart-app');
    const cart = readCart();
    if (!cart.length) {
      host.innerHTML =
        '<div class="woocommerce-notices-wrapper"></div>' +
        '<div class="woocommerce"><p><strong>Giỏ hàng đang trống.</strong></p><p><a class="button" href=\"/\">Quay lại mua sắm</a></p></div>';
      return;
    }
    host.innerHTML = '<div class="woocommerce"><p>Đang tải giỏ hàng…</p></div>';

    const rows = [];
    for (const it of cart) {
      const p = await fetchProductByLegacy(it.legacy_wp_id);
      rows.push({ it, p });
    }

    const lineHtml = rows
      .map(({ it, p }) => {
        const name = p ? String(p.name || '') : `Sản phẩm #${it.legacy_wp_id}`;
        const price = p ? (p.sale_price != null ? p.sale_price : p.price) : 0;
        const img = p && p.image_url ? `<img src="${p.image_url}" style="width:64px;height:auto;border-radius:6px" />` : '';
        const total = Number(price || 0) * Number(it.quantity || 1);
        return `
          <tr>
            <td style="width:80px">${img}</td>
            <td>
              <div><strong>${escapeHtml(name)}</strong></div>
              <div class="small text-muted">ID: ${it.legacy_wp_id}</div>
            </td>
            <td>${money(price)}</td>
            <td style="width:120px">
              <input type="number" min="1" class="ngoc-qty" data-id="${it.legacy_wp_id}" value="${it.quantity}" style="width:90px">
            </td>
            <td>${money(total)}</td>
            <td style="width:110px"><button class="button ngoc-remove" data-id="${it.legacy_wp_id}">Xóa</button></td>
          </tr>
        `;
      })
      .join('');

    const grand = rows.reduce((s, { it, p }) => {
      const price = p ? (p.sale_price != null ? p.sale_price : p.price) : 0;
      return s + Number(price || 0) * Number(it.quantity || 1);
    }, 0);

    host.innerHTML = `
      <div class="woocommerce">
        <h2>Giỏ hàng</h2>
        <div class="table-responsive">
          <table class="shop_table shop_table_responsive">
            <thead><tr><th></th><th>Sản phẩm</th><th>Giá</th><th>SL</th><th>Tạm tính</th><th></th></tr></thead>
            <tbody>${lineHtml}</tbody>
          </table>
        </div>
        <p><strong>Tổng:</strong> ${money(grand)}</p>
        <p><a class="button alt" href="/checkout/">Tiến hành đặt hàng</a></p>
      </div>
    `;

    host.querySelectorAll('.ngoc-remove').forEach((b) => {
      b.addEventListener('click', () => {
        removeFromCart(b.getAttribute('data-id'));
        renderCartPage();
      });
    });
    host.querySelectorAll('.ngoc-qty').forEach((inp) => {
      inp.addEventListener('change', () => {
        setQty(inp.getAttribute('data-id'), inp.value);
        renderCartPage();
      });
    });
  }

  async function renderCheckoutPage() {
    const host = ensureContainer('ngoc-checkout-app');
    const cart = readCart();
    if (!cart.length) {
      host.innerHTML =
        '<div class="woocommerce"><p><strong>Chưa có sản phẩm trong giỏ.</strong></p><p><a class="button" href=\"/\">Quay lại mua sắm</a></p></div>';
      return;
    }
    let subtotal = 0;
    for (const x of cart) {
      const p = await fetchProductByLegacy(x.legacy_wp_id);
      if (!p) {
        host.innerHTML =
          '<div class="woocommerce"><p class="woocommerce-error">Không tải được giá sản phẩm (kiểm tra API).</p></div>';
        return;
      }
      const unit = p.sale_price != null ? Number(p.sale_price) : Number(p.price);
      subtotal += unit * x.quantity;
    }
    host.innerHTML = `
      <div class="woocommerce">
        <h2>Thanh toán</h2>
        <div class="woocommerce-notices-wrapper"></div>
        <form id="ngoc-checkout-form">
          <p><strong>Tạm tính:</strong> <span id="ngoc-co-sub">${money(subtotal)}</span></p>
          <p><label>Mã giảm giá</label><br>
            <input class="input-text" name="coupon_code" id="ngoc-co-coupon" style="max-width:200px;display:inline-block">
            <button type="button" class="button" id="ngoc-co-apply" style="display:inline-block;margin-left:8px">Áp dụng</button>
          </p>
          <p id="ngoc-co-discount-line" class="woocommerce-message" style="display:none"></p>
          <p><label>Họ tên *</label><input class="input-text" name="customer_name" required></p>
          <p><label>Email *</label><input class="input-text" type="email" name="email" required></p>
          <p><label>SĐT</label><input class="input-text" name="phone"></p>
          <p><label>Địa chỉ</label><input class="input-text" name="address"></p>
          <p><label>Ghi chú</label><textarea class="input-text" name="note" rows="3"></textarea></p>
          <p><label>Thanh toán</label>
            <select name="payment_method">
              <option value="cod">COD</option>
              <option value="bank">Chuyển khoản</option>
            </select>
          </p>
          <p><button class="button alt" type="submit">Đặt hàng</button></p>
          <div id="ngoc-checkout-result" style="margin-top:10px"></div>
        </form>
      </div>
    `;
    host.querySelector('#ngoc-co-apply').addEventListener('click', async function () {
      const code = host.querySelector('#ngoc-co-coupon').value.trim();
      const line = host.querySelector('#ngoc-co-discount-line');
      if (!code) {
        line.style.display = 'none';
        return;
      }
      const r = await fetch(`${API}/coupons/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code, subtotal: subtotal })
      });
      const j = await r.json().catch(function () {
        return {};
      });
      if (!r.ok) {
        line.style.display = 'block';
        line.className = 'woocommerce-error';
        line.textContent = j.error || 'Mã không hợp lệ';
        return;
      }
      line.style.display = 'block';
      line.className = 'woocommerce-message';
      line.innerHTML =
        'Giảm <strong>' +
        escapeHtml(money(j.discount)) +
        '</strong> — Thanh toán dự kiến: <strong>' +
        escapeHtml(money(j.final_subtotal)) +
        '</strong>';
    });
    host.querySelector('#ngoc-checkout-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      const couponRaw = String(fd.get('coupon_code') || '').trim();
      const payload = {
        customer_name: String(fd.get('customer_name') || ''),
        email: String(fd.get('email') || ''),
        phone: String(fd.get('phone') || ''),
        address: String(fd.get('address') || ''),
        note: String(fd.get('note') || ''),
        payment_method: String(fd.get('payment_method') || 'cod'),
        items: cart.map((x) => ({ legacy_wp_id: x.legacy_wp_id, quantity: x.quantity }))
      };
      if (couponRaw) payload.coupon_code = couponRaw;

      const r = await fetch(`${API}/orders/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        host.querySelector('#ngoc-checkout-result').innerHTML = `<div class="woocommerce-error">${escapeHtml(j.error || 'Lỗi đặt hàng')}</div>`;
        return;
      }
      writeCart([]);
      const disc = Number(j.discount_amount || 0);
      const extra =
        disc > 0
          ? ' Giảm ' + money(disc) + ', tổng thanh toán ' + money(j.total) + '.'
          : '';
      host.querySelector('#ngoc-checkout-result').innerHTML =
        `<div class="woocommerce-message">Đặt hàng thành công. Mã đơn: <strong>${escapeHtml(j.order_code || '')}</strong>.${extra}</div>`;
    });
  }

  function escapeHtml(s) {
    const d = document.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
  }

  function route() {
    const p = (location.pathname || '/').toLowerCase();
    if (p.startsWith('/shopping-cart')) return 'cart';
    if (p.startsWith('/checkout')) return 'checkout';
    return 'other';
  }

  /**
   * Theme "mini-cart" often intercepts click to open offcanvas/sidebar.
   * We provide a hard navigation to the dedicated cart page.
   */
  function bindCartLinkNavigation() {
    document.addEventListener(
      'click',
      function (e) {
        const a = e.target && e.target.closest ? e.target.closest('a.cart-link, a.mini-cart, a[href^="/shopping-cart"]') : null;
        if (!a) return;
        const href = a.getAttribute('href') || '';
        if (!href || href === '#' || href.toLowerCase().indexOf('/shopping-cart') === -1) return;
        // Force navigation even if theme scripts attempt to open offcanvas.
        e.preventDefault();
        e.stopPropagation();
        try {
          e.stopImmediatePropagation();
        } catch (_) {}
        window.location.href = href;
      },
      true
    );
  }

  document.addEventListener('DOMContentLoaded', function () {
    updateCartBadges();
    bindAddToCart();
    bindCartLinkNavigation();
    const r = route();
    // If the cart page provides a dedicated container, let that page own rendering.
    // This keeps the shared commerce script lightweight and avoids UI conflicts.
    if (r === 'cart' && !document.getElementById('ngoc-cart-page')) renderCartPage();
    if (r === 'checkout' && !document.getElementById('ngoc-checkout-page')) renderCheckoutPage();
  });
})();

