(function () {
  const TITLES = {
    dashboard: 'Tổng quan',
    users: 'Quản lý người dùng',
    categories: 'Danh mục',
    products: 'Sản phẩm',
    orders: 'Đơn hàng',
    payments: 'Thanh toán',
    reports: 'Thống kê & báo cáo',
    content: 'Nội dung website',
    reviews: 'Đánh giá',
    coupons: 'Khuyến mãi',
    settings: 'Cài đặt website',
    security: 'Bảo mật',
    media: 'Thư viện ảnh'
  };

  function getRoute() {
    const h = (location.hash || '').replace(/^#\/?/, '');
    if (!h || h === 'dashboard') return 'dashboard';
    return h.split('/')[0].split('?')[0];
  }

  function setActive(route) {
    document.querySelectorAll('.ngoc-menu-item').forEach(function (el) {
      el.classList.toggle('active', el.getAttribute('data-route') === route);
    });
  }

  function setPageTitle(route) {
    const t = document.getElementById('ngoc-page-title');
    if (!t) return;
    if (route === 'dashboard') {
      t.textContent = TITLES.dashboard;
      document.title = 'Tổng quan | Ngọc Clothes — Quản trị';
    } else {
      t.textContent = TITLES[route] || 'Quản trị';
      document.title = (TITLES[route] || 'Quản trị') + ' | Ngọc Clothes — Quản trị';
    }
  }

  async function navigate() {
    const route = getRoute();
    const dashEl = document.getElementById('ngoc-page-dashboard');
    const appEl = document.getElementById('ngoc-page-app');
    const root = document.getElementById('ngoc-root');

    if (route === 'dashboard') {
      if (dashEl) dashEl.classList.remove('d-none');
      if (appEl) appEl.classList.add('d-none');
      setActive('dashboard');
      setPageTitle('dashboard');
      if (window.NgocAdminChartDestroy) {
        try {
          window.NgocAdminChartDestroy();
        } catch (_) {}
        window.NgocAdminChartDestroy = null;
      }
      if (typeof window.NgocSneatDashboardInit === 'function') {
        await window.NgocSneatDashboardInit();
      }
      return;
    }

    if (dashEl) dashEl.classList.add('d-none');
    if (appEl) appEl.classList.remove('d-none');
    if (typeof window.NgocSneatDashboardDestroy === 'function') {
      window.NgocSneatDashboardDestroy();
    }

    setActive(route);
    setPageTitle(route);

    if (window.NgocAdminChartDestroy) {
      try {
        window.NgocAdminChartDestroy();
      } catch (_) {}
      window.NgocAdminChartDestroy = null;
    }

    if (!root) return;
    const fn = window.NgocViews && window.NgocViews[route];
    if (!fn) {
      root.innerHTML = '<div class="alert alert-warning">Trang không tồn tại.</div>';
      return;
    }
    root.innerHTML = '<div class="text-center py-5 text-muted">Đang tải…</div>';
    try {
      await fn(root);
    } catch (e) {
      root.innerHTML =
        '<div class="alert alert-danger">' + NgocAdminUi.escapeHtml(e.message || 'Lỗi') + '</div>';
    }
  }

  async function boot() {
    const ok = await NgocAdmin.requireAdminPage();
    if (!ok) return;
    try {
      await NgocAdmin.fetchPublicMeta();
      NgocAdmin.bindShopLinkElements();
      const brand = document.getElementById('ngoc-site-brand');
      if (brand && NgocAdmin.publicSiteName) {
        brand.textContent = NgocAdmin.publicSiteName;
      }
      const sn = document.getElementById('ngoc-site-name');
      if (sn && NgocAdmin.publicSiteName) {
        sn.textContent = NgocAdmin.publicSiteName;
      }
    } catch (_) {}
    window.addEventListener('hashchange', function () {
      navigate();
    });
    await navigate();
  }

  document.addEventListener('DOMContentLoaded', boot);
})();
