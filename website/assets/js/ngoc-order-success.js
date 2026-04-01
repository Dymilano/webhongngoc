/**
 * Order success page loader for /order-success/
 * Fetches order by order_code via GET /api/orders/public/:code
 */
(function () {
  const API = '/api';

  const qs = (sel, root) => (root || document).querySelector(sel);

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

  function pmLabel(s) {
    return s === 'bank' ? 'Chuyển khoản' : 'COD';
  }

  function getParam(name) {
    try {
      const u = new URL(window.location.href);
      return u.searchParams.get(name);
    } catch (_) {
      return null;
    }
  }

  async function load() {
    const host = qs('#ngoc-success-app');
    if (!host) return;
    const code = (getParam('order_code') || '').trim();
    if (!code) {
      host.innerHTML =
        '<div class="ngoc-hero"><div class="ngoc-ok" aria-hidden="true">!</div><div>' +
        '<div style="font-weight:950;font-size:20px">Không tìm thấy mã đơn</div>' +
        '<div class="ngoc-sub">Vui lòng kiểm tra lại đường dẫn hoặc vào “Đơn hàng của tôi”.</div>' +
        '</div></div>';
      return;
    }

    const r = await fetch(`${API}/orders/public/${encodeURIComponent(code)}`);
    const text = await r.text();
    let data = {};
    try {
      data = text ? JSON.parse(text) : {};
    } catch (_) {}
    if (!r.ok) {
      host.innerHTML =
        '<div class="ngoc-hero"><div class="ngoc-ok" aria-hidden="true">!</div><div>' +
        '<div style="font-weight:950;font-size:20px">Không tải được đơn hàng</div>' +
        '<div class="ngoc-sub">' +
        escapeHtml((data && data.error) || 'Đơn hàng không tồn tại hoặc đã bị ẩn.') +
        '</div></div></div>';
      return;
    }

    const o = data.order || {};
    const items = data.items || [];
    const lines = items
      .map((it) => {
        const qty = Number(it.quantity || 0);
        const unit = Number(it.unit_price || 0);
        const total = qty * unit;
        return (
          '<div class="ngoc-line">' +
          '<div class="ngoc-img"></div>' +
          '<div><div class="ngoc-name">' +
          escapeHtml(it.product_name || '') +
          '</div><div class="ngoc-meta">SL: ' +
          escapeHtml(qty) +
          ' • ' +
          escapeHtml(money(unit)) +
          '</div></div>' +
          '<div class="ngoc-right">' +
          escapeHtml(money(total)) +
          '</div></div>'
        );
      })
      .join('');

    host.innerHTML =
      '<div class="ngoc-hero">' +
      '<div class="ngoc-ok" aria-hidden="true">' +
      '<svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor"><path d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z"></path></svg>' +
      '</div>' +
      '<div>' +
      '<div style="font-weight:950;font-size:20px">Đặt hàng thành công</div>' +
      '<div class="ngoc-sub">Chúng tôi đã nhận đơn và sẽ liên hệ nếu cần xác nhận.</div>' +
      '</div>' +
      '</div>' +
      '<div class="ngoc-kv">' +
      '<div class="it"><div class="ngoc-k">Mã đơn hàng</div><div class="ngoc-v">' +
      escapeHtml(o.order_code || code) +
      '</div></div>' +
      '<div class="it"><div class="ngoc-k">Ngày đặt</div><div class="ngoc-v">' +
      escapeHtml(String(o.created_at || '').slice(0, 16) || '—') +
      '</div></div>' +
      '<div class="it"><div class="ngoc-k">Trạng thái</div><div class="ngoc-v">' +
      escapeHtml(statusLabel(o.status)) +
      '</div></div>' +
      '<div class="it"><div class="ngoc-k">Thanh toán</div><div class="ngoc-v">' +
      escapeHtml(pmLabel(o.payment_method)) +
      '</div></div>' +
      '</div>' +
      '<div class="mt-3">' +
      '<div class="ngoc-row"><span>Người nhận</span><strong>' +
      escapeHtml(o.customer_name || '') +
      '</strong></div>' +
      '<div class="ngoc-row"><span>Email</span><strong>' +
      escapeHtml(o.email || '') +
      '</strong></div>' +
      (o.phone
        ? '<div class="ngoc-row"><span>SĐT</span><strong>' + escapeHtml(o.phone) + '</strong></div>'
        : '') +
      (o.address
        ? '<div class="ngoc-row"><span>Địa chỉ</span><strong>' + escapeHtml(o.address) + '</strong></div>'
        : '') +
      '</div>' +
      '<div class="ngoc-lines">' +
      lines +
      '</div>' +
      '<div class="mt-3">' +
      (Number(o.discount_amount || 0) > 0
        ? '<div class="ngoc-row"><span>Giảm giá</span><strong>-' +
          escapeHtml(money(o.discount_amount)) +
          (o.coupon_code ? ' (' + escapeHtml(o.coupon_code) + ')' : '') +
          '</strong></div>'
        : '') +
      '<div class="ngoc-total"><span>Tổng thanh toán</span><span>' +
      escapeHtml(money(o.total)) +
      '</span></div>' +
      '</div>';
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', load);
  else load();
})();

