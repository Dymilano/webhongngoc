/**
 * Dedicated Checkout page UI for /checkout/
 * - Data: localStorage["ngoc_cart_v1"]
 * - Product lookup: GET /api/products/public-by-legacy/:legacy
 * - Coupon validate: POST /api/coupons/validate
 * - Create order: POST /api/orders/checkout
 * - Prefill user profile if logged in: GET /api/profile (Authorization Bearer)
 */
(function () {
  const API = '/api';
  const CART_KEY = 'ngoc_cart_v1';
  const TOKEN_KEY = 'ngoc_customer_token';
  const CHECKOUT_DRAFT_KEY = 'ngoc_checkout_form_v1';

  const qs = (sel, root) => (root || document).querySelector(sel);
  const qsa = (sel, root) => Array.from((root || document).querySelectorAll(sel));

  function escapeHtml(s) {
    const d = document.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
  }

  function money(v) {
    const n = Number(v || 0);
    try {
      return n.toLocaleString('vi-VN') + '₫';
    } catch (_) {
      return String(n) + '₫';
    }
  }

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
    try {
      document.querySelectorAll('.nasa-cart-count, .cart-number').forEach((el) => {
        const n = (items || []).reduce((s, x) => s + (x ? Number(x.quantity || 0) : 0), 0);
        el.textContent = String(n);
        el.classList.remove('hidden-tag', 'nasa-product-empty');
      });
    } catch (_) {}
  }

  function normalizeQty(v) {
    const q = parseInt(String(v || '').trim(), 10);
    return Number.isFinite(q) ? Math.max(1, q) : 1;
  }

  function getToken() {
    return localStorage.getItem(TOKEN_KEY);
  }

  async function apiJson(path, opts) {
    const t = getToken();
    const headers = Object.assign({ 'Content-Type': 'application/json' }, (opts && opts.headers) || {});
    if (t) headers.Authorization = 'Bearer ' + t;
    const r = await fetch(API + path, Object.assign({ credentials: 'include' }, opts || {}, { headers }));
    const text = await r.text();
    let data = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch (_) {}
    if (!r.ok) {
      const err = new Error((data && data.error) || r.statusText || 'Lỗi');
      err.status = r.status;
      err.data = data;
      throw err;
    }
    return data;
  }

  async function refreshIfPossible() {
    try {
      const r = await fetch(API + '/auth/refresh', { method: 'POST', credentials: 'include' });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) return false;
      if (d && d.token) localStorage.setItem(TOKEN_KEY, d.token);
      return true;
    } catch (_) {
      return false;
    }
  }

  async function fetchProductByLegacy(legacyId) {
    const r = await fetch(`${API}/products/public-by-legacy/${encodeURIComponent(legacyId)}`);
    if (!r.ok) return null;
    return r.json().catch(() => null);
  }

  async function fetchServerCart() {
    const t = getToken();
    if (!t) return null;
    try {
      const d = await apiJson('/cart', { method: 'GET' });
      return d && typeof d === 'object' ? d : null;
    } catch (e) {
      // If token expired, attempt refresh once.
      if (e && e.status === 401) {
        const ok = await refreshIfPossible();
        if (ok) return fetchServerCart();
      }
      return null;
    }
  }

  function serverCartToLocalItems(serverCart) {
    const items = (serverCart && serverCart.items) ? serverCart.items : [];
    return items
      .map((x) => {
        const p = x && x.product ? x.product : null;
        const legacy = p && p.legacy_wp_id != null ? p.legacy_wp_id : (x && x.legacy_wp_id != null ? x.legacy_wp_id : null);
        if (!Number.isFinite(Number(legacy))) return null;
        return { legacy_wp_id: Number(legacy), quantity: normalizeQty(x.quantity) };
      })
      .filter(Boolean);
  }

  function serverProductsByLegacy(serverCart) {
    const out = {};
    const items = (serverCart && serverCart.items) ? serverCart.items : [];
    items.forEach((x) => {
      const p = x && x.product ? x.product : null;
      const legacy = p && p.legacy_wp_id != null ? p.legacy_wp_id : null;
      if (legacy != null && p) out[String(legacy)] = p;
    });
    return out;
  }

  function toast(host, msg, kind) {
    const root = document.createElement('div');
    root.className = 'ngoc-toast';
    root.innerHTML = `<div class="ngoc-alert ${kind === 'ok' ? 'ok' : 'err'}">${escapeHtml(msg)}</div>`;
    document.body.appendChild(root);
    setTimeout(() => {
      try {
        root.remove();
      } catch (_) {}
    }, 3600);
  }

  function loadDraft() {
    try {
      const raw = sessionStorage.getItem(CHECKOUT_DRAFT_KEY);
      const j = raw ? JSON.parse(raw) : null;
      return j && typeof j === 'object' ? j : null;
    } catch (_) {
      return null;
    }
  }

  function saveDraft(data) {
    try {
      sessionStorage.setItem(CHECKOUT_DRAFT_KEY, JSON.stringify(data || {}));
    } catch (_) {}
  }

  function collectDraft(host) {
    const get = (name) => (qs(`[name="${name}"]`, host) ? qs(`[name="${name}"]`, host).value : '');
    const pay = qs('[name="payment_method"]:checked', host);
    return {
      customer_name: get('customer_name'),
      phone: get('phone'),
      email: get('email'),
      address_line: get('address_line'),
      ward: get('ward'),
      district: get('district'),
      city: get('city'),
      country: get('country'),
      postal_code: get('postal_code'),
      note: get('note'),
      coupon_code: get('coupon_code'),
      payment_method: pay ? pay.value : 'cod'
    };
  }

  function fillDraft(host, d) {
    if (!d) return;
    const set = (name, val) => {
      const el = qs(`[name="${name}"]`, host);
      if (!el) return;
      el.value = val == null ? '' : String(val);
    };
    set('customer_name', d.customer_name);
    set('phone', d.phone);
    set('email', d.email);
    set('address_line', d.address_line);
    set('ward', d.ward);
    set('district', d.district);
    set('city', d.city);
    set('country', d.country);
    set('postal_code', d.postal_code);
    set('note', d.note);
    set('coupon_code', d.coupon_code);
    const pm = String(d.payment_method || '').trim();
    if (pm) {
      const r = qs(`[name="payment_method"][value="${pm}"]`, host);
      if (r) r.checked = true;
    }
  }

  function addressText(d) {
    const parts = [d.address_line, d.ward, d.district, d.city, d.country, d.postal_code]
      .map((x) => (x == null ? '' : String(x).trim()))
      .filter(Boolean);
    return parts.join(', ');
  }

  function setBusy(host, busy) {
    host.classList.toggle('ngoc-busy', !!busy);
  }

  function setFieldError(host, name, msg) {
    const field = qs(`[data-field="${name}"]`, host);
    if (!field) return;
    field.classList.toggle('is-error', !!msg);
    const err = qs('.ngoc-err', field);
    if (err) err.textContent = msg || '';
  }

  function clearErrors(host) {
    qsa('.ngoc-field', host).forEach((f) => f.classList.remove('is-error'));
    qsa('.ngoc-err', host).forEach((e) => (e.textContent = ''));
  }

  function validate(host) {
    clearErrors(host);
    const d = collectDraft(host);
    const errors = {};
    const req = (k, label) => {
      if (!String(d[k] || '').trim()) errors[k] = `Vui lòng nhập ${label}.`;
    };
    req('customer_name', 'họ và tên');
    req('phone', 'số điện thoại');
    req('email', 'email');
    req('address_line', 'địa chỉ');
    req('district', 'quận/huyện');
    req('city', 'tỉnh/thành phố');
    req('country', 'quốc gia');
    // ward + postal_code optional but supported

    if (d.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(d.email).trim())) {
      errors.email = 'Email không hợp lệ.';
    }
    if (d.phone && !/^[0-9+\-().\s]{6,25}$/.test(String(d.phone).trim())) {
      errors.phone = 'Số điện thoại không hợp lệ.';
    }

    Object.keys(errors).forEach((k) => setFieldError(host, k, errors[k]));
    return { ok: Object.keys(errors).length === 0, data: d, errors };
  }

  function renderEmpty(host) {
    host.innerHTML = `
      <div class="ngoc-shell">
        <div class="ngoc-head">
          <div>
            <div class="ngoc-breadcrumb"><a href="/">Trang chủ</a> / <a href="/shopping-cart/">Giỏ hàng</a> / <strong>Thanh toán</strong></div>
            <h2 class="ngoc-h2">Thanh toán</h2>
            <p class="ngoc-sub">Giỏ hàng đang trống. Vui lòng thêm sản phẩm trước khi thanh toán.</p>
          </div>
        </div>
        <div class="ngoc-card">
          <div class="ngoc-card-body">
            <div class="ngoc-alert err">Bạn chưa có sản phẩm nào trong giỏ hàng.</div>
            <div class="d-flex gap-2 flex-wrap">
              <a class="ngoc-btn ngoc-btn-primary ngoc-btn-lg" href="/shop/">Quay lại mua sắm</a>
              <a class="ngoc-btn" href="/shopping-cart/">Xem giỏ hàng</a>
              <a class="ngoc-btn" href="/">Về trang chủ</a>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  function render(host, state) {
    const { lines, count, subtotal, unknownProductCount } = state;
    const shippingFee = 0;
    const discount = Number(state.discount || 0);
    const total = Math.max(0, subtotal + shippingFee - discount);
    const warnMissing =
      unknownProductCount > 0
        ? `<div class="ngoc-alert err" style="display:block;margin-bottom:12px">Một số sản phẩm chưa có trong CSDL — tạm tính có thể thiếu. Trong thư mục <code style="font-size:12px">server</code> chạy <code style="font-size:12px">npm run seed</code> rồi tải lại. (${unknownProductCount} dòng thiếu)</div>`
        : '';

    const sumLines = lines
      .slice(0, 6)
      .map((x) => {
        const p = x.product;
        const it = x.item;
        const name = p ? String(p.name || '') : `Sản phẩm #${it.legacy_wp_id}`;
        const img = p && p.image_url ? String(p.image_url) : '';
        const unit = p ? (p.sale_price != null ? Number(p.sale_price) : Number(p.price)) : 0;
        const lineTotal = p ? unit * Number(it.quantity || 1) : null;
        const unitStr = p ? money(unit) : 'Chưa có trong CSDL';
        const lineStr = p ? money(lineTotal) : '—';
        return `
          <div class="ngoc-sum-line">
            <div class="ngoc-sum-img">${img ? `<img src="${escapeHtml(img)}" alt="${escapeHtml(name)}" loading="lazy" />` : ''}</div>
            <div>
              <div class="ngoc-sum-name">${escapeHtml(name)}</div>
              <div class="ngoc-sum-meta">SL: ${escapeHtml(it.quantity)} • ${
          p
            ? escapeHtml(unitStr)
            : '<span style="color:#b45309;font-weight:600">' + escapeHtml(unitStr) + '</span>'
        }</div>
            </div>
            <div class="ngoc-sum-right">
              <div class="ngoc-sum-name">${
                p ? escapeHtml(lineStr) : '<span style="color:#b45309">' + escapeHtml(lineStr) + '</span>'
              }</div>
            </div>
          </div>
        `;
      })
      .join('');

    host.innerHTML = `
      <div class="ngoc-shell">
        <div class="ngoc-head">
          <div>
            <div class="ngoc-breadcrumb"><a href="/">Trang chủ</a> / <a href="/shopping-cart/">Giỏ hàng</a> / <strong>Thanh toán</strong></div>
            <h2 class="ngoc-h2">Thanh toán</h2>
            <p class="ngoc-sub">Vui lòng kiểm tra thông tin nhận hàng và xác nhận đặt đơn.</p>
          </div>
          <span class="ngoc-pill">${escapeHtml(count)} sản phẩm</span>
        </div>
        ${warnMissing}

        <div class="ngoc-grid">
          <section class="ngoc-card" aria-label="Thông tin thanh toán">
            <div class="ngoc-card-body">
              <form id="ngoc-checkout-form" novalidate>
                <div class="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-2">
                  <div>
                    <div style="font-weight:950;font-size:16px">Thông tin người nhận</div>
                    <div class="ngoc-muted" style="font-size:12px;margin-top:2px">* Bắt buộc</div>
                  </div>
                  <a class="ngoc-btn" href="/shopping-cart/">Quay lại giỏ hàng</a>
                </div>

                <div class="ngoc-form-grid">
                  <div class="ngoc-field" data-field="customer_name">
                    <label class="ngoc-label">Họ và tên <span class="ngoc-req">*</span></label>
                    <input class="ngoc-input" name="customer_name" autocomplete="name" />
                    <div class="ngoc-err"></div>
                  </div>
                  <div class="ngoc-field" data-field="phone">
                    <label class="ngoc-label">Số điện thoại <span class="ngoc-req">*</span></label>
                    <input class="ngoc-input" name="phone" inputmode="tel" autocomplete="tel" />
                    <div class="ngoc-err"></div>
                  </div>
                  <div class="ngoc-field full" data-field="email">
                    <label class="ngoc-label">Email <span class="ngoc-req">*</span></label>
                    <input class="ngoc-input" name="email" inputmode="email" autocomplete="email" />
                    <div class="ngoc-err"></div>
                  </div>
                </div>

                <div class="mt-3" style="font-weight:950;font-size:16px">Địa chỉ giao hàng</div>
                <div class="ngoc-form-grid mt-2">
                  <div class="ngoc-field full" data-field="address_line">
                    <label class="ngoc-label">Số nhà, tên đường <span class="ngoc-req">*</span></label>
                    <input class="ngoc-input" name="address_line" autocomplete="street-address" />
                    <div class="ngoc-err"></div>
                  </div>
                  <div class="ngoc-field" data-field="ward">
                    <label class="ngoc-label">Phường/Xã</label>
                    <input class="ngoc-input" name="ward" />
                    <div class="ngoc-err"></div>
                  </div>
                  <div class="ngoc-field" data-field="district">
                    <label class="ngoc-label">Quận/Huyện <span class="ngoc-req">*</span></label>
                    <input class="ngoc-input" name="district" />
                    <div class="ngoc-err"></div>
                  </div>
                  <div class="ngoc-field" data-field="city">
                    <label class="ngoc-label">Tỉnh/Thành phố <span class="ngoc-req">*</span></label>
                    <input class="ngoc-input" name="city" />
                    <div class="ngoc-err"></div>
                  </div>
                  <div class="ngoc-field" data-field="country">
                    <label class="ngoc-label">Quốc gia <span class="ngoc-req">*</span></label>
                    <input class="ngoc-input" name="country" value="Việt Nam" />
                    <div class="ngoc-err"></div>
                  </div>
                  <div class="ngoc-field" data-field="postal_code">
                    <label class="ngoc-label">Mã bưu điện</label>
                    <input class="ngoc-input" name="postal_code" inputmode="numeric" />
                    <div class="ngoc-err"></div>
                  </div>
                </div>

                <div class="mt-3" style="font-weight:950;font-size:16px">Ghi chú đơn hàng</div>
                <div class="ngoc-field full mt-2" data-field="note">
                  <label class="ngoc-label">Ghi chú (tuỳ chọn)</label>
                  <textarea class="ngoc-textarea" name="note" placeholder="Ví dụ: Giao giờ hành chính, gọi trước khi giao…"></textarea>
                  <div class="ngoc-err"></div>
                </div>

                <div class="mt-3 d-flex align-items-center justify-content-between gap-2 flex-wrap">
                  <div>
                    <div style="font-weight:950;font-size:16px">Phương thức thanh toán</div>
                    <div class="ngoc-muted" style="font-size:12px;margin-top:2px">Chọn 1 phương thức phù hợp</div>
                  </div>
                </div>

                <div class="ngoc-pay mt-2">
                  <label class="ngoc-pay-opt">
                    <input type="radio" name="payment_method" value="cod" checked />
                    <div>
                      <div class="ngoc-pay-title">Thanh toán khi nhận hàng (COD)</div>
                      <div class="ngoc-pay-desc">Thanh toán cho shipper khi nhận đủ hàng.</div>
                    </div>
                  </label>
                  <label class="ngoc-pay-opt">
                    <input type="radio" name="payment_method" value="bank" />
                    <div>
                      <div class="ngoc-pay-title">Chuyển khoản ngân hàng</div>
                      <div class="ngoc-pay-desc">Chúng tôi sẽ hiển thị hướng dẫn chuyển khoản sau khi đặt hàng.</div>
                    </div>
                  </label>
                  <label class="ngoc-pay-opt" style="opacity:.75">
                    <input type="radio" name="payment_method" value="ewallet" disabled />
                    <div>
                      <div class="ngoc-pay-title">Ví điện tử (sắp có)</div>
                      <div class="ngoc-pay-desc">Tính năng sẽ được cập nhật trong phiên bản sau.</div>
                    </div>
                  </label>
                  <label class="ngoc-pay-opt" style="opacity:.75">
                    <input type="radio" name="payment_method" value="online" disabled />
                    <div>
                      <div class="ngoc-pay-title">Thanh toán online (sắp có)</div>
                      <div class="ngoc-pay-desc">Tính năng sẽ được cập nhật trong phiên bản sau.</div>
                    </div>
                  </label>
                </div>

                <div class="mt-3 ngoc-alert" id="ngoc-form-alert" style="display:none"></div>

                <button class="ngoc-btn ngoc-btn-primary ngoc-btn-block ngoc-btn-lg mt-2" type="submit" id="ngoc-place-order">
                  Đặt hàng
                </button>
                <div class="ngoc-muted" style="font-size:12px;margin-top:10px">
                  Bằng việc nhấn “Đặt hàng”, bạn xác nhận thông tin là chính xác.
                </div>
              </form>
            </div>
          </section>

          <aside class="ngoc-card ngoc-sticky ngoc-sum-card" aria-label="Tóm tắt đơn hàng">
            <div class="ngoc-card-body">
              <div class="ngoc-sum-title">Tóm tắt đơn hàng</div>
              <div class="ngoc-sum-lines">${sumLines || ''}</div>

              <div class="ngoc-field full" data-field="coupon_code">
                <label class="ngoc-label">Mã giảm giá</label>
                <div class="d-flex gap-2">
                  <input class="ngoc-input" name="coupon_code" placeholder="VD: SALE10" />
                  <button class="ngoc-btn" type="button" id="ngoc-apply-coupon">Áp dụng</button>
                </div>
                <div class="ngoc-err"></div>
              </div>

              <div class="mt-2">
                <div class="ngoc-sum-row"><span>Tổng số lượng</span><span>${escapeHtml(count)}</span></div>
                <div class="ngoc-sum-row"><span>Tạm tính</span><span id="ngoc-subtotal">${escapeHtml(money(subtotal))}</span></div>
                <div class="ngoc-sum-row"><span>Phí vận chuyển</span><span id="ngoc-ship">${escapeHtml(money(shippingFee))}</span></div>
                <div class="ngoc-sum-row"><span>Giảm giá</span><span id="ngoc-discount">-${escapeHtml(money(discount))}</span></div>
                <div class="ngoc-sum-total"><span>Tổng thanh toán</span><span id="ngoc-total">${escapeHtml(money(total))}</span></div>
              </div>

              <div class="ngoc-muted" style="font-size:12px;margin-top:10px">
                Thanh toán an toàn • Thông tin được lưu cục bộ để tiện thao tác
              </div>
            </div>
          </aside>
        </div>
      </div>
    `;
  }

  function computeState(cart, productsByLegacy) {
    const lines = cart
      .filter((x) => x && Number.isFinite(Number(x.legacy_wp_id)) && Number(x.quantity) > 0)
      .map((it) => {
        const key = String(it.legacy_wp_id);
        const p = productsByLegacy[key] || null;
        return { item: { ...it, quantity: normalizeQty(it.quantity) }, product: p };
      });
    const count = lines.reduce((s, x) => s + Number(x.item.quantity || 0), 0);
    const subtotal = lines.reduce((s, x) => {
      const p = x.product;
      const unit = p ? (p.sale_price != null ? Number(p.sale_price) : Number(p.price)) : 0;
      return s + unit * Number(x.item.quantity || 1);
    }, 0);
    const unknownProductCount = lines.reduce((n, x) => n + (x.product ? 0 : 1), 0);
    return { lines, count, subtotal, discount: 0, unknownProductCount };
  }

  function setSummary(host, st) {
    const shippingFee = 0;
    const discount = Number(st.discount || 0);
    const total = Math.max(0, st.subtotal + shippingFee - discount);
    const elSub = qs('#ngoc-subtotal', host);
    const elDis = qs('#ngoc-discount', host);
    const elTot = qs('#ngoc-total', host);
    if (elSub) elSub.textContent = money(st.subtotal);
    if (elDis) elDis.textContent = '-' + money(discount);
    if (elTot) elTot.textContent = money(total);
  }

  async function tryPrefillFromProfile(host) {
    const t = getToken();
    if (!t) return;
    try {
      const d = await apiJson('/profile', { method: 'GET', headers: {} });
      const p = d && d.profile ? d.profile : null;
      if (!p) return;
      const draft = loadDraft() || {};
      const next = Object.assign({}, draft);
      if (!next.customer_name) next.customer_name = p.full_name || p.username || '';
      if (!next.email) next.email = p.email || '';
      if (!next.phone) next.phone = p.phone || '';
      if (!next.address_line) next.address_line = p.address_line || '';
      if (!next.ward) next.ward = p.ward || '';
      if (!next.district) next.district = p.district || '';
      if (!next.city) next.city = p.city || '';
      if (!next.country) next.country = p.country || 'Việt Nam';
      if (!next.postal_code) next.postal_code = p.postal_code || '';
      saveDraft(next);
      fillDraft(host, next);
    } catch (e) {
      if (e && e.status === 401) {
        const ok = await refreshIfPossible();
        if (ok) return tryPrefillFromProfile(host);
      }
    }
  }

  function bindDraftAutosave(host) {
    const form = qs('#ngoc-checkout-form', host);
    if (!form) return;
    const onAny = () => saveDraft(collectDraft(host));
    ['input', 'change'].forEach((ev) => form.addEventListener(ev, onAny, true));
  }

  function showFormAlert(host, text, kind) {
    const el = qs('#ngoc-form-alert', host);
    if (!el) return;
    el.style.display = text ? 'block' : 'none';
    el.className = 'ngoc-alert ' + (kind === 'ok' ? 'ok' : 'err');
    el.textContent = text || '';
  }

  function firstErrorField(host) {
    return qs('.ngoc-field.is-error', host);
  }

  function bindHandlers(host, productsByLegacy, st) {
    const applyCouponBtn = qs('#ngoc-apply-coupon', host);
    if (applyCouponBtn) {
      applyCouponBtn.addEventListener('click', async () => {
        const code = (qs('[name="coupon_code"]', host)?.value || '').trim();
        if (!code) {
          st.discount = 0;
          setSummary(host, st);
          showFormAlert(host, 'Bạn chưa nhập mã giảm giá.', 'err');
          return;
        }
        setBusy(host, true);
        try {
          const d = await apiJson('/coupons/validate', {
            method: 'POST',
            body: JSON.stringify({ code, subtotal: st.subtotal })
          });
          st.discount = Number(d.discount || 0);
          setSummary(host, st);
          showFormAlert(host, `Đã áp dụng mã ${d.code || code}. Giảm ${money(st.discount)}.`, 'ok');
          saveDraft(Object.assign({}, collectDraft(host), { coupon_code: code }));
        } catch (e) {
          st.discount = 0;
          setSummary(host, st);
          showFormAlert(host, e.message || 'Không áp dụng được mã.', 'err');
          setFieldError(host, 'coupon_code', e.message || 'Mã không hợp lệ.');
        } finally {
          setBusy(host, false);
        }
      });
    }

    const form = qs('#ngoc-checkout-form', host);
    if (!form) return;
    form.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      showFormAlert(host, '', 'err');
      const v = validate(host);
      if (!v.ok) {
        const fe = firstErrorField(host);
        if (fe) fe.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }

      let cart = readCart();
      const token = getToken();
      if (token) {
        let sc = await fetchServerCart();
        if (sc && Array.isArray(sc.items)) {
          if (sc.items.length === 0 && cart.length > 0) {
            try {
              await apiJson('/cart', {
                method: 'PUT',
                body: JSON.stringify({
                  items: cart.map((x) => ({
                    legacy_wp_id: x.legacy_wp_id,
                    quantity: normalizeQty(x.quantity)
                  }))
                })
              });
              sc = await fetchServerCart();
            } catch (_) {}
          }
          if (sc && sc.items && sc.items.length) {
            cart = serverCartToLocalItems(sc);
            try {
              writeCart(cart);
            } catch (_) {}
          }
        }
      }
      if (!cart.length) return renderEmpty(host);

      const draft = v.data;
      const payload = {
        customer_name: String(draft.customer_name || '').trim(),
        email: String(draft.email || '').trim(),
        phone: String(draft.phone || '').trim(),
        address: addressText(draft) || null,
        note: String(draft.note || '').trim() || null,
        payment_method: draft.payment_method === 'bank' ? 'bank' : 'cod',
        items: cart.map((x) => ({ legacy_wp_id: x.legacy_wp_id, quantity: normalizeQty(x.quantity) }))
      };
      const code = String(draft.coupon_code || '').trim();
      if (code) payload.coupon_code = code;

      setBusy(host, true);
      const btn = qs('#ngoc-place-order', host);
      const prev = btn ? btn.textContent : '';
      if (btn) btn.textContent = 'Đang đặt hàng…';
      try {
        const d = await apiJson('/orders/checkout', { method: 'POST', body: JSON.stringify(payload) });
        if (token) {
          try {
            await apiJson('/cart', { method: 'DELETE' });
          } catch (_) {}
        }
        writeCart([]);
        sessionStorage.removeItem(CHECKOUT_DRAFT_KEY);
        toast(host, 'Đặt hàng thành công. Đang chuyển trang…', 'ok');
        const codeOut = d.order_code || '';
        const idOut = d.order_id != null ? String(d.order_id) : '';
        setTimeout(() => {
          window.location.href =
            '/order-success/?order_code=' + encodeURIComponent(codeOut) + (idOut ? '&order_id=' + encodeURIComponent(idOut) : '');
        }, 450);
      } catch (e) {
        const msg = e && e.message ? e.message : 'Không tạo được đơn hàng.';
        showFormAlert(host, msg, 'err');
        toast(host, msg, 'err');
      } finally {
        if (btn) btn.textContent = prev || 'Đặt hàng';
        setBusy(host, false);
      }
    });
  }

  async function init() {
    const host = document.getElementById('ngoc-checkout-page');
    if (!host) return;

    const token = getToken();
    let cart = readCart();
    let productsByLegacy = null;
    if (token) {
      let sc = await fetchServerCart();
      if (sc && Array.isArray(sc.items)) {
        if (sc.items.length === 0 && cart.length > 0) {
          try {
            await apiJson('/cart', {
              method: 'PUT',
              body: JSON.stringify({
                items: cart.map((x) => ({
                  legacy_wp_id: x.legacy_wp_id,
                  quantity: normalizeQty(x.quantity)
                }))
              })
            });
            sc = await fetchServerCart();
            if (sc && sc.items && sc.items.length) {
              writeCart(serverCartToLocalItems(sc));
            }
          } catch (_) {
            /* dùng cart local đã đọc */
          }
        }
        if (sc && sc.items && sc.items.length) {
          productsByLegacy = serverProductsByLegacy(sc);
          cart = serverCartToLocalItems(sc);
        }
      }
    }
    if (!cart.length) return renderEmpty(host);

    host.innerHTML = `<div class="ngoc-shell"><div class="ngoc-card"><div class="ngoc-card-body">Đang tải thông tin đơn hàng…</div></div></div>`;

    const ids = Array.from(
      new Set(
        cart
          .map((x) => (x && Number.isFinite(Number(x.legacy_wp_id)) ? Number(x.legacy_wp_id) : null))
          .filter((x) => x != null)
      )
    );

    if (!productsByLegacy) {
      productsByLegacy = {};
      const results = await Promise.all(
        ids.map(async (id) => {
          try {
            const p = await fetchProductByLegacy(id);
            return [String(id), p];
          } catch (_) {
            return [String(id), null];
          }
        })
      );
      results.forEach(([k, p]) => (productsByLegacy[k] = p));
    }

    const st = computeState(cart, productsByLegacy);
    if (!st.lines.length) return renderEmpty(host);

    render(host, st);

    // Draft: prefer sessionStorage; then try prefill from profile when logged-in.
    fillDraft(host, loadDraft());
    bindDraftAutosave(host);
    await tryPrefillFromProfile(host);
    bindHandlers(host, productsByLegacy, st);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();

