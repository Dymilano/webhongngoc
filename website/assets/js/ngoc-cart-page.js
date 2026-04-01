/**
 * Dedicated cart page UI for /shopping-cart/
 * Data source: localStorage key "ngoc_cart_v1" (shared with ngoc-commerce.js)
 * Product lookup: GET /api/products/public-by-legacy/:legacy
 */
(function () {
  const API = '/api';
  const CART_KEY = 'ngoc_cart_v1';
  const TOKEN_KEY = 'ngoc_customer_token';
  /** @type {number|null} */
  let __ngocPulseLegacy = null;

  function qs(sel, root) {
    return (root || document).querySelector(sel);
  }
  function qsa(sel, root) {
    return Array.from((root || document).querySelectorAll(sel));
  }

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

  function getToken() {
    return localStorage.getItem(TOKEN_KEY);
  }

  async function apiCart(method, path, body) {
    const t = getToken();
    const headers = { 'Content-Type': 'application/json' };
    if (t) headers.Authorization = 'Bearer ' + t;
    const r = await fetch(API + path, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      credentials: 'include'
    });
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

  function buildProductsByLegacyFromServerItems(items) {
    const map = {};
    (items || []).forEach((x) => {
      if (!x) return;
      const p = x.product;
      const legacy = p && p.legacy_wp_id != null ? p.legacy_wp_id : (x.legacy_wp_id != null ? x.legacy_wp_id : null);
      if (legacy == null) return;
      if (p) map[String(legacy)] = p;
    });
    return map;
  }

  function buildLocalCartFromServerItems(items) {
    return (items || [])
      .map((x) => {
        const p = x && x.product ? x.product : null;
        const legacy = p && p.legacy_wp_id != null ? p.legacy_wp_id : (x && x.legacy_wp_id != null ? x.legacy_wp_id : null);
        if (!Number.isFinite(Number(legacy))) return null;
        return { legacy_wp_id: Number(legacy), quantity: normalizeQty(x.quantity), cart_item_id: x.cart_item_id };
      })
      .filter(Boolean);
  }

  function writeCart(items) {
    localStorage.setItem(CART_KEY, JSON.stringify(items || []));
    // Let the shared script update header badges if it's present.
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

  function showNotice(msg, type) {
    const wrap = qs('.woocommerce-notices-wrapper') || qs('#ngoc-cart-page-notices');
    if (!wrap) return;
    const t = (type || 'success').toLowerCase();
    const cls = t === 'error' ? 'woocommerce-error' : 'woocommerce-message';
    wrap.innerHTML = `<ul class="${cls}" role="alert"><li>${escapeHtml(msg)}</li></ul>`;
  }

  async function fetchProductByLegacy(legacyId) {
    const r = await fetch(`${API}/products/public-by-legacy/${encodeURIComponent(legacyId)}`);
    if (!r.ok) return null;
    return r.json().catch(() => null);
  }

  function renderSkeleton(host) {
    host.innerHTML = `
      <div class="ngoc-cart-shell">
        <div class="ngoc-cart-top">
          <div class="ngoc-cart-title">
            <div class="ngoc-breadcrumb"><a href="/">Trang chủ</a> / <strong>Giỏ hàng</strong></div>
            <h2>Giỏ hàng của tôi</h2>
            <p>Kiểm tra sản phẩm trước khi thanh toán.</p>
          </div>
        </div>

        <div id="ngoc-cart-page-notices" class="woocommerce-notices-wrapper"></div>

        <div class="ngoc-cart-grid">
        <section class="ngoc-cart-left" aria-label="Danh sách sản phẩm">
          <div class="ngoc-card">
            <div class="ngoc-card-body">
              <div class="ngoc-loading">
                <div class="ngoc-spinner" aria-hidden="true"></div>
                <div>
                  <div class="ngoc-loading-title">Đang tải giỏ hàng…</div>
                  <div class="ngoc-loading-sub">Vui lòng chờ trong giây lát.</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <aside class="ngoc-cart-right" aria-label="Tóm tắt đơn hàng">
          <div class="ngoc-card ngoc-sticky ngoc-sum-card">
            <div class="ngoc-card-body">
              <div class="ngoc-sum-title">Tóm tắt đơn hàng</div>
              <div class="ngoc-sum-row"><span>Tổng sản phẩm</span><span class="ngoc-sum-muted">—</span></div>
              <div class="ngoc-sum-row"><span>Tạm tính</span><span class="ngoc-sum-muted">—</span></div>
              <div class="ngoc-sum-row"><span>Phí vận chuyển</span><span class="ngoc-sum-muted">—</span></div>
              <div class="ngoc-sum-row"><span>Giảm giá</span><span class="ngoc-sum-muted">—</span></div>
              <div class="ngoc-sum-divider"></div>
              <div class="ngoc-sum-total"><span>Tổng thanh toán</span><span class="ngoc-sum-muted">—</span></div>
              <a class="ngoc-btn ngoc-btn-primary ngoc-btn-block ngoc-btn-lg" href="/checkout/" aria-disabled="true">Tiến hành thanh toán</a>
              <a class="ngoc-btn ngoc-btn-ghost ngoc-btn-block" href="/shop/">Tiếp tục mua sắm</a>
            </div>
          </div>
        </aside>
        </div>
      </div>
    `;
  }

  function renderEmpty(host) {
    host.innerHTML = `
      <div class="ngoc-cart-shell">
        <div class="ngoc-cart-top">
          <div class="ngoc-cart-title">
            <div class="ngoc-breadcrumb"><a href="/">Trang chủ</a> / <strong>Giỏ hàng</strong></div>
            <h2>Giỏ hàng của tôi</h2>
            <p>Giỏ hàng đang trống. Hãy chọn thêm sản phẩm bạn yêu thích.</p>
          </div>
        </div>

        <div id="ngoc-cart-page-notices" class="woocommerce-notices-wrapper"></div>

        <div class="ngoc-empty">
          <div class="ngoc-empty-icon" aria-hidden="true">
            <svg width="42" height="42" viewBox="0 0 32 32" fill="currentColor">
              <path d="M3.205 3.205v25.59h25.59v-25.59h-25.59zM27.729 27.729h-23.457v-23.457h23.457v23.457z" />
              <path d="M9.068 13.334c0 3.828 3.104 6.931 6.931 6.931s6.93-3.102 6.93-6.931v-3.732h1.067v-1.066h-3.199v1.066h1.065v3.732c0 3.234-2.631 5.864-5.864 5.864-3.234 0-5.865-2.631-5.865-5.864v-3.732h1.067v-1.066h-3.199v1.066h1.065v3.732z"/>
            </svg>
          </div>
          <h3>Giỏ hàng của bạn đang trống</h3>
          <p>Trước khi thanh toán, bạn cần thêm ít nhất 1 sản phẩm vào giỏ.</p>
          <div class="ngoc-empty-actions">
            <a class="ngoc-btn ngoc-btn-primary ngoc-btn-lg" href="/shop/">Quay lại mua sắm</a>
            <a class="ngoc-btn ngoc-btn-ghost" href="/">Về trang chủ</a>
          </div>
        </div>
      </div>
    `;
  }

  function renderCart(host, state) {
    const { lines, subtotal, count } = state;
    const shipping = 0;
    const discount = 0;
    const total = Math.max(0, subtotal + shipping - discount);

    const itemsHtml = lines
      .map((x) => {
        const p = x.product;
        const it = x.item;
        const name = p ? String(p.name || '') : `Sản phẩm #${it.legacy_wp_id}`;
        const unit = p ? (p.sale_price != null ? Number(p.sale_price) : Number(p.price)) : 0;
        const img = p && p.image_url ? String(p.image_url) : '';
        const variant = it && it.variant ? String(it.variant) : '';
        const lineTotal = unit * Number(it.quantity || 1);
        const detailUrl = p && p.slug ? `/product/${p.slug}/` : '#';

        return `
          <article class="ngoc-line ngoc-card" data-id="${escapeHtml(it.legacy_wp_id)}">
            <div class="ngoc-card-body ngoc-line-body">
              <a class="ngoc-line-img" href="${escapeHtml(detailUrl)}" ${detailUrl === '#' ? 'aria-disabled="true"' : ''}>
                ${
                  img
                    ? `<img src="${escapeHtml(img)}" alt="${escapeHtml(name)}" loading="lazy" />`
                    : `<div class="ngoc-img-ph" aria-hidden="true"></div>`
                }
              </a>

              <div class="ngoc-line-info">
                <div class="ngoc-line-top">
                  <div class="ngoc-line-title">
                    <a href="${escapeHtml(detailUrl)}" class="ngoc-line-name" ${detailUrl === '#' ? 'aria-disabled="true"' : ''}>${escapeHtml(
                      name
                    )}</a>
                    ${variant ? `<div class="ngoc-line-variant">${escapeHtml(variant)}</div>` : ''}
                  </div>
                  <button class="ngoc-icon-btn ngoc-remove" type="button" aria-label="Xóa sản phẩm" title="Xóa" data-id="${escapeHtml(
                    it.legacy_wp_id
                  )}">×</button>
                </div>

                <div class="ngoc-line-bottom">
                  <div class="ngoc-price">
                    <div class="ngoc-unit">${money(unit)}</div>
                    <div class="ngoc-micro">Đơn giá</div>
                  </div>

                  <div class="ngoc-qty" aria-label="Số lượng">
                    <button class="ngoc-qty-btn ngoc-dec" type="button" data-id="${escapeHtml(it.legacy_wp_id)}" aria-label="Giảm">−</button>
                    <input class="ngoc-qty-input" inputmode="numeric" pattern="[0-9]*" type="number" min="1" step="1" value="${escapeHtml(
                      it.quantity
                    )}" data-id="${escapeHtml(it.legacy_wp_id)}" aria-label="Nhập số lượng" />
                    <button class="ngoc-qty-btn ngoc-inc" type="button" data-id="${escapeHtml(it.legacy_wp_id)}" aria-label="Tăng">+</button>
                  </div>

                  <div class="ngoc-subtotal">
                    <div class="ngoc-line-total">${money(lineTotal)}</div>
                    <div class="ngoc-micro">Thành tiền</div>
                  </div>
                </div>
              </div>
            </div>
          </article>
        `;
      })
      .join('');

    host.innerHTML = `
      <div class="ngoc-cart-shell">
        <div class="ngoc-cart-top">
          <div class="ngoc-cart-title">
            <div class="ngoc-breadcrumb"><a href="/">Trang chủ</a> / <strong>Giỏ hàng</strong></div>
            <h2>Giỏ hàng của tôi</h2>
            <p>Kiểm tra sản phẩm trước khi thanh toán.</p>
          </div>
        </div>

        <div id="ngoc-cart-page-notices" class="woocommerce-notices-wrapper"></div>

        <div class="ngoc-cart-grid">
        <section class="ngoc-cart-left" aria-label="Danh sách sản phẩm">
          <div class="ngoc-list-head">
            <div class="ngoc-list-meta">
              <span class="ngoc-pill">${escapeHtml(count)} sản phẩm</span>
              <span class="ngoc-muted">•</span>
              <span class="ngoc-muted">Bạn có thể chỉnh sửa số lượng trực tiếp.</span>
            </div>
            <button class="ngoc-btn ngoc-btn-ghost ngoc-clear" type="button">Xóa tất cả</button>
          </div>
          <div class="ngoc-lines">${itemsHtml}</div>
        </section>

        <aside class="ngoc-cart-right" aria-label="Tóm tắt đơn hàng">
          <div class="ngoc-card ngoc-sticky ngoc-sum-card">
            <div class="ngoc-card-body">
              <div class="ngoc-sum-title">Tóm tắt đơn hàng</div>
              <div class="ngoc-sum-row"><span>Tổng sản phẩm</span><span>${escapeHtml(count)}</span></div>
              <div class="ngoc-sum-row"><span>Tạm tính</span><span>${escapeHtml(money(subtotal))}</span></div>
              <div class="ngoc-sum-row"><span>Phí vận chuyển</span><span>${escapeHtml(money(shipping))}</span></div>
              <div class="ngoc-sum-row"><span>Giảm giá</span><span>${escapeHtml(money(discount))}</span></div>
              <div class="ngoc-sum-divider"></div>
              <div class="ngoc-sum-total"><span>Tổng thanh toán</span><span>${escapeHtml(money(total))}</span></div>
              <a class="ngoc-btn ngoc-btn-primary ngoc-btn-block ngoc-btn-lg" href="/checkout/">Tiến hành thanh toán</a>
              <a class="ngoc-btn ngoc-btn-ghost ngoc-btn-block" href="/shop/">Tiếp tục mua sắm</a>
              <div class="ngoc-sum-foot">Thanh toán an toàn • Cập nhật tức thì</div>
            </div>
          </div>
        </aside>
        </div>
      </div>
    `;

    if (__ngocPulseLegacy != null) {
      const pid = __ngocPulseLegacy;
      __ngocPulseLegacy = null;
      requestAnimationFrame(() => {
        const wrap = host.querySelector(`.ngoc-line[data-id="${String(pid)}"] .ngoc-qty`);
        if (!wrap) return;
        wrap.classList.remove('ngoc-qty-pulse');
        void wrap.offsetWidth;
        wrap.classList.add('ngoc-qty-pulse');
        wrap.addEventListener(
          'animationend',
          () => {
            wrap.classList.remove('ngoc-qty-pulse');
          },
          { once: true }
        );
      });
    }
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

    return { lines, count, subtotal };
  }

  function mutateCart(fn) {
    const cart = readCart();
    const next = fn(cart.slice());
    writeCart(next);
    return next;
  }

  function bindHandlersLocal(host, productsByLegacy) {
    const setBusy = (busy) => host.classList.toggle('ngoc-busy', !!busy);

    const rerender = () => {
      const cart = readCart();
      if (!cart.length) return renderEmpty(host);
      const st = computeState(cart, productsByLegacy);
      renderCart(host, st);
      bindHandlersLocal(host, productsByLegacy);
    };

    const applyQty = async (legacyId, qty) => {
      setBusy(true);
      try {
        const id = parseInt(String(legacyId), 10);
        mutateCart((cart) => {
          const hit = cart.find((x) => x && x.legacy_wp_id === id);
          if (!hit) return cart;
          hit.quantity = normalizeQty(qty);
          return cart.filter((x) => x && x.quantity > 0);
        });
        if (Number.isFinite(id)) __ngocPulseLegacy = id;
        rerender();
      } finally {
        setBusy(false);
      }
    };

    qsa('.ngoc-inc', host).forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        const cart = readCart();
        const hit = cart.find((x) => x && String(x.legacy_wp_id) === String(id));
        const next = (hit ? normalizeQty(hit.quantity) : 1) + 1;
        await applyQty(id, next);
      });
    });

    qsa('.ngoc-dec', host).forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        const cart = readCart();
        const hit = cart.find((x) => x && String(x.legacy_wp_id) === String(id));
        const next = Math.max(1, (hit ? normalizeQty(hit.quantity) : 1) - 1);
        await applyQty(id, next);
      });
    });

    qsa('.ngoc-qty-input', host).forEach((inp) => {
      let t = null;
      const commit = async () => {
        const id = inp.getAttribute('data-id');
        await applyQty(id, inp.value);
        showNotice('Đã cập nhật số lượng.', 'success');
      };
      inp.addEventListener('input', () => {
        if (t) clearTimeout(t);
        t = setTimeout(commit, 250);
      });
      inp.addEventListener('change', commit);
    });

    qsa('.ngoc-remove', host).forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        const ok = confirm('Xóa sản phẩm này khỏi giỏ hàng?');
        if (!ok) return;
        setBusy(true);
        try {
          mutateCart((cart) => cart.filter((x) => x && String(x.legacy_wp_id) !== String(id)));
          rerender();
          showNotice('Đã xóa sản phẩm khỏi giỏ hàng.', 'success');
        } finally {
          setBusy(false);
        }
      });
    });

    const clearBtn = qs('.ngoc-clear', host);
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        const ok = confirm('Xóa tất cả sản phẩm trong giỏ hàng?');
        if (!ok) return;
        writeCart([]);
        renderEmpty(host);
        showNotice('Giỏ hàng đã được làm trống.', 'success');
      });
    }
  }

  function bindHandlersServer(host, serverItems) {
    const setBusy = (busy) => host.classList.toggle('ngoc-busy', !!busy);

    const rerender = async () => {
      const d = await apiCart('GET', '/cart', null);
      const items = d && d.items ? d.items : [];
      if (!items.length) return renderEmpty(host);
      const productsByLegacy = buildProductsByLegacyFromServerItems(items);
      const cart = buildLocalCartFromServerItems(items);
      const st = computeState(cart, productsByLegacy);
      renderCart(host, st);
      bindHandlersServer(host, items);
    };

    const findCartItemIdByLegacy = (legacyId) => {
      const hit = (serverItems || []).find((x) => {
        const p = x && x.product ? x.product : null;
        const legacy = p && p.legacy_wp_id != null ? p.legacy_wp_id : null;
        return String(legacy) === String(legacyId);
      });
      return hit ? hit.cart_item_id : null;
    };

    const applyQty = async (legacyId, qty) => {
      setBusy(true);
      try {
        const cartItemId = findCartItemIdByLegacy(legacyId);
        if (!cartItemId) return;
        const idNum = parseInt(String(legacyId), 10);
        if (Number.isFinite(idNum)) __ngocPulseLegacy = idNum;
        await apiCart('PATCH', `/cart/items/${encodeURIComponent(cartItemId)}`, { quantity: normalizeQty(qty) });
        await rerender();
      } catch (e) {
        showNotice(e.message || 'Không cập nhật được số lượng.', 'error');
      } finally {
        setBusy(false);
      }
    };

    qsa('.ngoc-inc', host).forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        const input = qs(`.ngoc-qty-input[data-id="${String(id)}"]`, host);
        const curr = input ? normalizeQty(input.value) : 1;
        await applyQty(id, curr + 1);
      });
    });
    qsa('.ngoc-dec', host).forEach((btn) => {
      btn.addEventListener('click', async () => {
        const id = btn.getAttribute('data-id');
        const input = qs(`.ngoc-qty-input[data-id="${String(id)}"]`, host);
        const curr = input ? normalizeQty(input.value) : 1;
        await applyQty(id, Math.max(1, curr - 1));
      });
    });

    qsa('.ngoc-qty-input', host).forEach((inp) => {
      let t = null;
      const commit = async () => {
        const id = inp.getAttribute('data-id');
        await applyQty(id, inp.value);
        showNotice('Đã cập nhật số lượng.', 'success');
      };
      inp.addEventListener('input', () => {
        if (t) clearTimeout(t);
        t = setTimeout(commit, 250);
      });
      inp.addEventListener('change', commit);
    });

    qsa('.ngoc-remove', host).forEach((btn) => {
      btn.addEventListener('click', async () => {
        const legacyId = btn.getAttribute('data-id');
        const ok = confirm('Xóa sản phẩm này khỏi giỏ hàng?');
        if (!ok) return;
        setBusy(true);
        try {
          const cartItemId = findCartItemIdByLegacy(legacyId);
          if (cartItemId) await apiCart('DELETE', `/cart/items/${encodeURIComponent(cartItemId)}`, null);
          await rerender();
          showNotice('Đã xóa sản phẩm khỏi giỏ hàng.', 'success');
        } catch (e) {
          showNotice(e.message || 'Không xóa được sản phẩm.', 'error');
        } finally {
          setBusy(false);
        }
      });
    });

    const clearBtn = qs('.ngoc-clear', host);
    if (clearBtn) {
      clearBtn.addEventListener('click', async () => {
        const ok = confirm('Xóa tất cả sản phẩm trong giỏ hàng?');
        if (!ok) return;
        setBusy(true);
        try {
          await apiCart('DELETE', '/cart', null);
          renderEmpty(host);
          showNotice('Giỏ hàng đã được làm trống.', 'success');
        } catch (e) {
          showNotice(e.message || 'Không xóa được giỏ hàng.', 'error');
        } finally {
          setBusy(false);
        }
      });
    }
  }

  async function init() {
    const host = document.getElementById('ngoc-cart-page');
    if (!host) return;

    renderSkeleton(host);

    const token = getToken();
    if (token) {
      try {
        const d = await apiCart('GET', '/cart', null);
        const items = d && d.items ? d.items : [];
        if (!items.length) return renderEmpty(host);
        const productsByLegacy = buildProductsByLegacyFromServerItems(items);
        const cart = buildLocalCartFromServerItems(items);
        const st = computeState(cart, productsByLegacy);
        if (!st.lines.length) return renderEmpty(host);
        renderCart(host, st);
        bindHandlersServer(host, items);
        return;
      } catch (e) {
        // fall back to local cart if API is not available for any reason
      }
    }

    const cart = readCart();
    if (!cart.length) return renderEmpty(host);

    // Fetch product details in parallel for snappy UI.
    const ids = Array.from(
      new Set(
        cart
          .map((x) => (x && Number.isFinite(Number(x.legacy_wp_id)) ? Number(x.legacy_wp_id) : null))
          .filter((x) => x != null)
      )
    );

    const productsByLegacy = {};
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

    const st = computeState(cart, productsByLegacy);
    if (!st.lines.length) return renderEmpty(host);

    renderCart(host, st);
    bindHandlersLocal(host, productsByLegacy);
  }

  document.addEventListener('DOMContentLoaded', init);
})();

