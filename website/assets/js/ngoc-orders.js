(() => {
  const API = '/api';
  const TOKEN_KEY = 'ngoc_customer_token';
  const USER_KEY = 'ngoc_customer_user';

  const elMsg = document.getElementById('msg');
  const elApp = document.getElementById('app');
  const elModal = document.getElementById('modal');
  const elModalTitle = document.getElementById('modalTitle');
  const elModalBody = document.getElementById('modalBody');

  function show(text, kind) {
    if (!elMsg) return;
    elMsg.className = 'ngoc-msg ' + (kind === 'err' ? 'err' : kind === 'ok' ? 'ok' : '');
    elMsg.textContent = text || '';
    elMsg.style.display = text ? 'block' : 'none';
  }

  function getToken() {
    return localStorage.getItem(TOKEN_KEY);
  }
  function setToken(t) {
    if (t) localStorage.setItem(TOKEN_KEY, t);
    else localStorage.removeItem(TOKEN_KEY);
  }
  function safeJsonParse(s) {
    try {
      return JSON.parse(s);
    } catch (_) {
      return null;
    }
  }
  function getCachedUser() {
    const raw = localStorage.getItem(USER_KEY);
    const u = raw ? safeJsonParse(raw) : null;
    return u && typeof u === 'object' ? u : null;
  }

  async function refreshIfPossible() {
    try {
      const r = await fetch(API + '/auth/refresh', { method: 'POST', credentials: 'include' });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) return false;
      if (d && d.token) setToken(d.token);
      if (d && d.user) localStorage.setItem(USER_KEY, JSON.stringify(d.user));
      return true;
    } catch (_) {
      return false;
    }
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
      throw err;
    }
    return data;
  }

  function money(v) {
    const n = Number(v || 0);
    try {
      return n.toLocaleString('vi-VN') + '₫';
    } catch (_) {
      return String(n) + '₫';
    }
  }

  function statusLabel(s) {
    const m = {
      pending: 'Chờ xử lý',
      processing: 'Đang xử lý',
      shipped: 'Đang giao',
      completed: 'Hoàn thành',
      cancelled: 'Đã huỷ'
    };
    return m[s] || s || '—';
  }

  function escapeHtml(s) {
    const d = document.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
  }

  function openModal(title, html) {
    elModalTitle.textContent = title;
    elModalBody.innerHTML = html;
    elModal.classList.add('open');
  }

  function closeModal() {
    elModal.classList.remove('open');
  }

  async function load() {
    show('', '');
    elApp.innerHTML = '<p>Đang tải…</p>';
    try {
      const d = await apiJson('/orders/my?limit=50');
      const items = d.items || [];
      if (!items.length) {
        const u = getCachedUser();
        elApp.innerHTML =
          '<p><strong>Chưa có đơn hàng.</strong></p>' +
          (u && u.email ? '<p class="ngoc-note">Email tài khoản: <code>' + escapeHtml(u.email) + '</code></p>' : '') +
          '<p><a class="button" href="/shopping-cart/">Xem giỏ hàng</a> <a class="button" href="/">Tiếp tục mua sắm</a></p>';
        return;
      }

      const rows = items
        .map((o) => {
          return (
            '<tr>' +
            '<td><strong>' +
            escapeHtml(o.order_code) +
            '</strong><div class="ngoc-note">' +
            escapeHtml((o.created_at || '').slice(0, 16)) +
            '</div></td>' +
            '<td>' +
            escapeHtml(statusLabel(o.status)) +
            '</td>' +
            '<td>' +
            escapeHtml(money(o.total)) +
            (Number(o.discount_amount) > 0
              ? '<div class="ngoc-note">Giảm: ' + escapeHtml(money(o.discount_amount)) + '</div>'
              : '') +
            '</td>' +
            '<td><button class="button" data-act="view" data-id="' +
            o.id +
            '">Chi tiết</button></td>' +
            '</tr>'
          );
        })
        .join('');

      elApp.innerHTML =
        '<div class="table-responsive">' +
        '<table class="shop_table shop_table_responsive">' +
        '<thead><tr><th>Mã đơn</th><th>Trạng thái</th><th>Tổng</th><th></th></tr></thead>' +
        '<tbody>' +
        rows +
        '</tbody></table></div>' +
        '<p class="ngoc-note">Đơn hàng được lọc theo email của tài khoản đang đăng nhập.</p>';

      elApp.querySelectorAll('button[data-act="view"]').forEach((b) => {
        b.addEventListener('click', async () => {
          const id = b.getAttribute('data-id');
          try {
            b.disabled = true;
            b.textContent = 'Đang tải…';
            const detail = await apiJson('/orders/my/' + encodeURIComponent(id));
            const o = detail.order || {};
            const its = detail.items || [];
            const lines = its
              .map((it) => {
                return (
                  '<tr><td>' +
                  escapeHtml(it.product_name) +
                  '</td><td>' +
                  escapeHtml(String(it.quantity || 0)) +
                  '</td><td>' +
                  escapeHtml(money(it.unit_price)) +
                  '</td><td>' +
                  escapeHtml(money(Number(it.quantity || 0) * Number(it.unit_price || 0))) +
                  '</td></tr>'
                );
              })
              .join('');
            const html =
              '<p><strong>Khách:</strong> ' +
              escapeHtml(o.customer_name || '') +
              '<br><strong>Email:</strong> ' +
              escapeHtml(o.email || '') +
              (o.phone ? '<br><strong>SĐT:</strong> ' + escapeHtml(o.phone) : '') +
              (o.address ? '<br><strong>Địa chỉ:</strong> ' + escapeHtml(o.address) : '') +
              '</p>' +
              '<p><strong>Trạng thái:</strong> ' +
              escapeHtml(statusLabel(o.status)) +
              '</p>' +
              '<div class="table-responsive"><table class="shop_table shop_table_responsive">' +
              '<thead><tr><th>Sản phẩm</th><th>SL</th><th>Giá</th><th>Tạm</th></tr></thead><tbody>' +
              lines +
              '</tbody></table></div>' +
              (Number(o.discount_amount) > 0
                ? '<p><strong>Giảm:</strong> ' + escapeHtml(money(o.discount_amount)) + '</p>'
                : '') +
              '<p><strong>Tổng thanh toán:</strong> ' +
              escapeHtml(money(o.total)) +
              '</p>';
            openModal('Đơn ' + (o.order_code || '#' + id), html);
          } catch (e) {
            if (e && e.status === 401) {
              const ok = await refreshIfPossible();
              if (ok) return load();
            }
            show(e.message || 'Không tải được chi tiết.', 'err');
          } finally {
            b.disabled = false;
            b.textContent = 'Chi tiết';
          }
        });
      });
    } catch (e) {
      if (e && e.status === 401) {
        const ok = await refreshIfPossible();
        if (ok) return load();
        show('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.', 'err');
        setToken(null);
        setTimeout(() => (window.location.href = '/my-account/'), 700);
        return;
      }
      show(e.message || 'Không tải được đơn hàng.', 'err');
      elApp.innerHTML = '<p>Không tải được.</p>';
    }
  }

  function init() {
    document.getElementById('btnReload').addEventListener('click', load);
    document.getElementById('btnClose').addEventListener('click', closeModal);
    elModal.addEventListener('click', (e) => {
      if (e.target === elModal) closeModal();
    });
    load();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();

