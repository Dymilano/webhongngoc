/**
 * API quản trị — token: ngoc_token
 */
(function () {
  const API = '/api';
  const TOKEN_KEY = 'ngoc_token';

  window.NgocAdmin = {
    API: API,
    /** URL gốc website bán hàng (cổng shop), không có / cuối */
    shopPublicUrl: null,
    publicSiteName: null,
    getShopOrigin: function () {
      if (window.NgocAdmin.shopPublicUrl) return String(window.NgocAdmin.shopPublicUrl).replace(/\/$/, '');
      try {
        var m = document.querySelector('meta[name="ngoc-shop-url"]');
        if (m && m.getAttribute('content')) return m.getAttribute('content').replace(/\/$/, '');
      } catch (_) {}
      return window.location.protocol + '//' + window.location.hostname + ':5000';
    },
    /** Đọc /api/settings/public (không cần đăng nhập) để lấy storefront_url, site_name */
    fetchPublicMeta: async function () {
      try {
        var r = await fetch(API + '/settings/public');
        var d = await r.json().catch(function () {
          return {};
        });
        if (d && typeof d.storefront_url === 'string' && d.storefront_url.trim()) {
          window.NgocAdmin.shopPublicUrl = d.storefront_url.trim().replace(/\/$/, '');
        }
        if (d && d.site_name != null) {
          window.NgocAdmin.publicSiteName = typeof d.site_name === 'string' ? d.site_name : String(d.site_name);
        }
      } catch (_) {}
      return window.NgocAdmin.getShopOrigin();
    },
    /** Gắn href cho các thẻ có data-ngoc-shop-link + data-shop-path (sau fetchPublicMeta) */
    bindShopLinkElements: function () {
      var shop = window.NgocAdmin.getShopOrigin();
      document.querySelectorAll('[data-ngoc-shop-link]').forEach(function (el) {
        var p = el.getAttribute('data-shop-path') || '/';
        el.href = shop + (p.charAt(0) === '/' ? p : '/' + p);
      });
    },
    /** Ảnh sản phẩm lưu dạng /wp-content/... — hiển thị đúng trên cổng admin (5050) */
    resolveShopAssetUrl: function (url) {
      if (url == null || url === '') return '';
      var s = String(url).trim();
      if (!s) return '';
      if (/^https?:\/\//i.test(s)) return s;
      var origin = window.NgocAdmin.getShopOrigin();
      if (s.charAt(0) === '/') return origin + s;
      return origin + '/' + s;
    },
    getToken: function () {
      return localStorage.getItem(TOKEN_KEY);
    },
    setToken: function (t) {
      if (t) localStorage.setItem(TOKEN_KEY, t);
      else localStorage.removeItem(TOKEN_KEY);
    },
    authHeaders: function () {
      const t = window.NgocAdmin.getToken();
      const h = { 'Content-Type': 'application/json' };
      if (t) h.Authorization = 'Bearer ' + t;
      return h;
    },
    api: async function (path, opts) {
      const r = await fetch(
        API + path,
        Object.assign({}, opts, {
          credentials: 'include',
          headers: Object.assign(window.NgocAdmin.authHeaders(), (opts && opts.headers) || {})
        })
      );
      const text = await r.text();
      let data = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch (_) {}
      if (!r.ok) {
        const err = new Error(data.error || r.statusText || 'Lỗi');
        err.status = r.status;
        throw err;
      }
      return data;
    },
    logout: function () {
      window.NgocAdmin.setToken(null);
      window.location.href = '/html/auth-login-basic.html';
    },
    /** Trả về false nếu đã redirect */
    requireAdminPage: async function () {
      if (!window.NgocAdmin.getToken()) {
        window.location.href = '/html/auth-login-basic.html';
        return false;
      }
      try {
        const me = await window.NgocAdmin.api('/auth/me');
        window.NgocAdmin.currentUser = me.user;
        const role = me.user && me.user.role;
        if (!['admin', 'super_admin', 'staff'].includes(role)) {
          window.alert('Tài khoản không có quyền quản trị.');
          await window.NgocAdmin.fetchPublicMeta();
          window.location.href = window.NgocAdmin.getShopOrigin() + '/';
          return false;
        }
        await window.NgocAdmin.fetchPublicMeta();
        window.NgocAdmin.bindShopLinkElements();
        return true;
      } catch (e) {
        window.NgocAdmin.setToken(null);
        window.location.href = '/html/auth-login-basic.html';
        return false;
      }
    },
    isSuperAdmin: function () {
      return window.NgocAdmin.currentUser && window.NgocAdmin.currentUser.role === 'super_admin';
    }
  };
})();
