/**
 * Gắn vào trang shop (cổng 5000): dùng API cùng origin.
 * Ví dụ trong index.html trước </body>:
 *   <script src="/assets/js/ngoc-storefront.js"></script>
 */
(function () {
  const API = '/api';

  async function getJson(path) {
    const r = await fetch(API + path);
    if (!r.ok) throw new Error((await r.json().catch(function () { return {}; })).error || r.statusText);
    return r.json();
  }

  /** Gọi sau DOM ready: gắn tên site + topbar từ DB (nếu có element) */
  window.NgocStorefront = {
    API: API,
    settings: function () {
      return getJson('/settings/public');
    },
    products: function (params) {
      const q = params && params.category_id ? '?category_id=' + encodeURIComponent(params.category_id) : '';
      return getJson('/products/public' + q);
    },
    checkout: function (payload) {
      return fetch(API + '/orders/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }).then(function (r) {
        return r.json().then(function (j) {
          if (!r.ok) throw new Error(j.error || r.statusText);
          return j;
        });
      });
    }
  };
})();
