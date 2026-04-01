(function () {
  const U = window.NgocAdminUi;

  function money(n) {
    return U.money(n);
  }

  async function uploadImage(file) {
    const t = NgocAdmin.getToken();
    const fd = new FormData();
    fd.append('file', file);
    const r = await fetch(NgocAdmin.API + '/media/upload', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + t },
      body: fd
    });
    const j = await r.json().catch(function () {
      return {};
    });
    if (!r.ok) throw new Error(j.error || 'Upload thất bại');
    return j.url;
  }

  const V = {};

  V.dashboard = async function (root) {
    const d = await NgocAdmin.api('/reports/dashboard');
    const t = d.totals || {};
    const series = d.series || [];
    const latest = d.latestOrders || [];
    const top = d.topProducts || [];
    root.innerHTML =
      '<div class="row">' +
      '  <div class="col-lg-8 mb-4 order-0">' +
      '    <div class="card">' +
      '      <div class="d-flex align-items-end row">' +
      '        <div class="col-sm-7">' +
      '          <div class="card-body">' +
      '            <h5 class="card-title text-primary mb-2">Tổng quan cửa hàng</h5>' +
      '            <p class="mb-3 text-muted">Số liệu theo cơ sở dữ liệu (đồng bộ từ website qua script và đơn hàng khách). Cập nhật khi có thay đổi trong admin hoặc sau khi chạy đồng bộ.</p>' +
      '            <a href="#/products" class="btn btn-sm btn-outline-primary">Thêm sản phẩm</a>' +
      '          </div>' +
      '        </div>' +
      '        <div class="col-sm-5 text-center text-sm-left">' +
      '          <div class="card-body pb-0 px-0 px-md-4">' +
      '            <img src="../assets/img/illustrations/man-with-laptop-light.png" height="140" alt="Admin" />' +
      '          </div>' +
      '        </div>' +
      '      </div>' +
      '    </div>' +
      '  </div>' +
      '  <div class="col-lg-4 col-md-4 order-1">' +
      '    <div class="row">' +
      '      <div class="col-lg-6 col-md-12 col-6 mb-4">' +
      '        <div class="card">' +
      '          <div class="card-body">' +
      '            <div class="card-title d-flex align-items-start justify-content-between">' +
      '              <div class="avatar flex-shrink-0">' +
      '                <img src="../assets/img/icons/unicons/wallet.png" alt="Doanh thu" class="rounded" />' +
      '              </div>' +
      '            </div>' +
      '            <span class="fw-semibold d-block mb-1">Doanh thu</span>' +
      '            <h3 class="card-title mb-2" id="ngoc-kpi-revenue">0 ₫</h3>' +
      '            <small class="text-muted">Tổng (không tính huỷ)</small>' +
      '          </div>' +
      '        </div>' +
      '      </div>' +
      '      <div class="col-lg-6 col-md-12 col-6 mb-4">' +
      '        <div class="card">' +
      '          <div class="card-body">' +
      '            <div class="card-title d-flex align-items-start justify-content-between">' +
      '              <div class="avatar flex-shrink-0">' +
      '                <img src="../assets/img/icons/unicons/chart.png" alt="Đơn hàng" class="rounded" />' +
      '              </div>' +
      '            </div>' +
      '            <span class="fw-semibold d-block mb-1">Đơn hàng</span>' +
      '            <h3 class="card-title text-nowrap mb-1" id="ngoc-kpi-orders">0</h3>' +
      '            <small class="text-muted">Tổng số đơn</small>' +
      '          </div>' +
      '        </div>' +
      '      </div>' +
      '    </div>' +
      '  </div>' +
      '</div>' +
      '' +
      '<div class="row">' +
      '  <div class="col-12 col-lg-8 order-2 order-md-3 order-lg-2 mb-4">' +
      '    <div class="card">' +
      '      <div class="row row-bordered g-0">' +
      '        <div class="col-md-8">' +
      '          <h5 class="card-header m-0 me-2 pb-3">Doanh thu & số đơn (14 ngày)</h5>' +
      '          <div id="ngoc-chart-dash" class="px-2"></div>' +
      '        </div>' +
      '        <div class="col-md-4">' +
      '          <div class="card-body">' +
      '            <div class="d-flex justify-content-between flex-wrap gap-2">' +
      '              <div><small class="text-muted d-block">Người dùng</small><h6 class="mb-0" id="ngoc-kpi-users">0</h6></div>' +
      '              <div><small class="text-muted d-block">Sản phẩm</small><h6 class="mb-0" id="ngoc-kpi-products">0</h6></div>' +
      '            </div>' +
      '            <div class="d-flex justify-content-between flex-wrap gap-2 mt-2 pt-2 border-top">' +
      '              <div><small class="text-muted d-block">Danh mục</small><h6 class="mb-0" id="ngoc-kpi-categories">0</h6></div>' +
      '              <div><small class="text-muted d-block">Bài viết (web)</small><h6 class="mb-0" id="ngoc-kpi-posts">0</h6></div>' +
      '            </div>' +
      '            <div class="d-flex justify-content-between flex-wrap gap-2 mt-2">' +
      '              <div><small class="text-muted d-block">Đánh giá chờ duyệt</small><h6 class="mb-0" id="ngoc-kpi-reviews">0</h6></div>' +
      '              <div><small class="text-muted d-block">Coupon đang bật</small><h6 class="mb-0" id="ngoc-kpi-coupons">0</h6></div>' +
      '            </div>' +
      '            <div class="mt-3 small">' +
      '              <div class="mb-2"><strong>Đơn mới</strong></div>' +
      '              <div id="ngoc-dash-latest" class="text-muted"></div>' +
      '            </div>' +
      '            <div class="mt-3 small">' +
      '              <div class="mb-2"><strong>Bán chạy</strong></div>' +
      '              <div id="ngoc-dash-top" class="text-muted"></div>' +
      '            </div>' +
      '          </div>' +
      '        </div>' +
      '      </div>' +
      '    </div>' +
      '  </div>' +
      '</div>';

    var elRevenue = document.getElementById('ngoc-kpi-revenue');
    if (elRevenue) elRevenue.textContent = money(t.revenue || 0);
    var elOrders = document.getElementById('ngoc-kpi-orders');
    if (elOrders) elOrders.textContent = String(t.orders || 0);
    var elUsers = document.getElementById('ngoc-kpi-users');
    if (elUsers) elUsers.textContent = String(t.users || 0);
    var elProducts = document.getElementById('ngoc-kpi-products');
    if (elProducts) elProducts.textContent = String(t.products || 0);
    var elCat = document.getElementById('ngoc-kpi-categories');
    if (elCat) elCat.textContent = String(t.categories != null ? t.categories : 0);
    var elPosts = document.getElementById('ngoc-kpi-posts');
    if (elPosts) elPosts.textContent = String(t.posts != null ? t.posts : 0);
    var elRev = document.getElementById('ngoc-kpi-reviews');
    if (elRev) elRev.textContent = String(t.reviewsPending != null ? t.reviewsPending : 0);
    var elCoup = document.getElementById('ngoc-kpi-coupons');
    if (elCoup) elCoup.textContent = String(t.couponsActive != null ? t.couponsActive : 0);

    document.getElementById('ngoc-dash-latest').innerHTML =
      latest.length > 0
        ? latest
            .map(function (o) {
              return (
                '<div class="mb-2"><strong>' +
                U.escapeHtml(o.order_code) +
                '</strong><br><span class="text-muted">' +
                U.escapeHtml(o.customer_name) +
                ' — ' +
                money(o.total) +
                '</span></div>'
              );
            })
            .join('')
        : '<span class="text-muted">Chưa có đơn</span>';

    document.getElementById('ngoc-dash-top').innerHTML =
      top.length > 0
        ? top
            .map(function (p) {
              return (
                '<div class="mb-2"><strong>' +
                U.escapeHtml(p.product_name) +
                '</strong><br><span class="text-muted">Đã bán: ' +
                (p.qty || 0) +
                '</span></div>'
              );
            })
            .join('')
        : '<span class="text-muted">Chưa có dữ liệu</span>';

    const el = document.querySelector('#ngoc-chart-dash');
    if (el && typeof ApexCharts !== 'undefined') {
      const chart = new ApexCharts(el, {
        chart: { type: 'area', height: 320, toolbar: { show: false }, zoom: { enabled: false } },
        dataLabels: { enabled: false },
        stroke: { curve: 'smooth', width: 2 },
        series: [
          { name: 'Doanh thu', data: series.map(function (x) { return Number(x.revenue || 0); }) },
          { name: 'Số đơn', data: series.map(function (x) { return Number(x.orders || 0); }) }
        ],
        xaxis: { categories: series.map(function (x) { return x.d || ''; }) },
        colors: ['#696cff', '#ff3e1d'],
        fill: { type: 'gradient', gradient: { opacityFrom: 0.35, opacityTo: 0.05 } }
      });
      chart.render();
      window.NgocAdminChartDestroy = function () {
        chart.destroy();
      };
    }
  };

  V.users = async function (root) {
    let q = '';
    let usersCache = [];
    function renderTable(items) {
      return (
        '<table class="table table-bordered table-sm"><thead><tr>' +
        '<th>ID</th><th>Username</th><th>Email</th><th>Họ tên</th><th>SĐT</th><th>Vai trò</th><th>Khóa</th><th></th></tr></thead><tbody>' +
        items
          .map(function (u) {
            return (
              '<tr>' +
              '<td>' +
              u.id +
              '</td>' +
              '<td>' +
              U.escapeHtml(u.username) +
              '</td>' +
              '<td>' +
              U.escapeHtml(u.email) +
              '</td>' +
              '<td>' +
              U.escapeHtml(u.full_name || '') +
              '</td>' +
              '<td>' +
              U.escapeHtml(u.phone || '') +
              '</td>' +
              '<td>' +
              U.escapeHtml(u.role) +
              '</td>' +
              '<td>' +
              (u.locked ? 'Có' : 'Không') +
              '</td>' +
              '<td><button type="button" class="btn btn-sm btn-outline-primary ngoc-u-edit" data-id="' +
              u.id +
              '">Sửa</button> ' +
              (NgocAdmin.isSuperAdmin()
                ? '<button type="button" class="btn btn-sm btn-outline-danger ngoc-u-del" data-id="' +
                  u.id +
                  '">Xóa</button>'
                : '') +
              '</td></tr>'
            );
          })
          .join('') +
        '</tbody></table>'
      );
    }

    async function load() {
      const url = '/users?q=' + encodeURIComponent(q);
      const data = await NgocAdmin.api(url);
      usersCache = data.items || [];
      root.querySelector('#ngoc-users-wrap').innerHTML = renderTable(usersCache);
      root.querySelectorAll('.ngoc-u-edit').forEach(function (btn) {
        btn.addEventListener('click', function () {
          openEdit(parseInt(btn.getAttribute('data-id'), 10));
        });
      });
      root.querySelectorAll('.ngoc-u-del').forEach(function (btn) {
        btn.addEventListener('click', async function () {
          if (!confirm('Xóa user này?')) return;
          await NgocAdmin.api('/users/' + btn.getAttribute('data-id'), { method: 'DELETE' });
          await load();
        });
      });
    }

    function openEdit(id) {
      const u = usersCache.find(function (x) {
        return x.id === id;
      });
      if (!u) return;
      const html =
        '<div class="modal fade" id="ngocModalUser" tabindex="-1">' +
        '<div class="modal-dialog"><div class="modal-content">' +
        '<div class="modal-header"><h5 class="modal-title">Sửa người dùng</h5>' +
        '<button type="button" class="btn-close" data-bs-dismiss="modal"></button></div>' +
        '<div class="modal-body">' +
        '<div class="mb-2"><label class="form-label">Username</label><input class="form-control" id="nu-user" value="' +
        U.escapeHtml(u.username) +
        '"></div>' +
        '<div class="mb-2"><label class="form-label">Email</label><input class="form-control" id="nu-email" value="' +
        U.escapeHtml(u.email) +
        '"></div>' +
        '<div class="mb-2"><label class="form-label">Họ tên</label><input class="form-control" id="nu-fn" value="' +
        U.escapeHtml(u.full_name) +
        '"></div>' +
        '<div class="mb-2"><label class="form-label">SĐT</label><input class="form-control" id="nu-phone" value="' +
        U.escapeHtml(u.phone || '') +
        '">' +
        '</div>' +
        '<div class="mb-2"><label class="form-label">Vai trò</label>' +
        '<select class="form-select" id="nu-role"><option value="user">user</option><option value="staff">staff</option><option value="admin">admin</option>' +
        (NgocAdmin.isSuperAdmin() ? '<option value="super_admin">super_admin</option>' : '') +
        '</select></div>' +
        '<div class="mb-2 form-check"><input type="checkbox" class="form-check-input" id="nu-lock"><label class="form-check-label" for="nu-lock">Khóa tài khoản</label></div>' +
        '<div class="mb-2"><label class="form-label">Mật khẩu mới (để trống nếu giữ)</label><input type="password" class="form-control" id="nu-pw"></div>' +
        '</div><div class="modal-footer">' +
        '<button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Đóng</button>' +
        '<button type="button" class="btn btn-primary" id="nu-save">Lưu</button></div></div></div></div>';
      document.body.insertAdjacentHTML('beforeend', html);
      document.getElementById('nu-role').value = u.role;
      document.getElementById('nu-lock').checked = !!u.locked;
      const modalEl = document.getElementById('ngocModalUser');
      const modal = new bootstrap.Modal(modalEl);
      document.getElementById('nu-save').addEventListener('click', async function () {
        const body = {
          username: document.getElementById('nu-user').value,
          email: document.getElementById('nu-email').value,
          full_name: document.getElementById('nu-fn').value,
          phone: document.getElementById('nu-phone').value || null,
          role: document.getElementById('nu-role').value,
          locked: document.getElementById('nu-lock').checked ? 1 : 0
        };
        const pw = document.getElementById('nu-pw').value;
        if (pw) body.password = pw;
        await NgocAdmin.api('/users/' + id, { method: 'PUT', body: JSON.stringify(body) });
        modal.hide();
        modalEl.remove();
        await load();
      });
      modalEl.addEventListener(
        'hidden.bs.modal',
        function () {
          modalEl.remove();
        },
        { once: true }
      );
      modal.show();
    }

    root.innerHTML =
      '<div class="d-flex flex-wrap gap-2 mb-3">' +
      '<input type="search" class="form-control" style="max-width:280px" id="ngoc-u-q" placeholder="Tìm username, email…">' +
      '<button type="button" class="btn btn-primary" id="ngoc-u-search">Tìm</button>' +
      '<button type="button" class="btn btn-success" id="ngoc-u-add">Thêm user</button></div>' +
      '<div id="ngoc-users-wrap"></div>';

    root.querySelector('#ngoc-u-search').addEventListener('click', async function () {
      q = root.querySelector('#ngoc-u-q').value.trim();
      await load();
    });
    root.querySelector('#ngoc-u-add').addEventListener('click', function () {
      const html =
        '<div class="modal fade" id="ngocModalUserAdd" tabindex="-1">' +
        '<div class="modal-dialog"><div class="modal-content">' +
        '<div class="modal-header"><h5 class="modal-title">Thêm người dùng</h5>' +
        '<button type="button" class="btn-close" data-bs-dismiss="modal"></button></div>' +
        '<div class="modal-body">' +
        '<div class="mb-2"><label class="form-label">Username *</label><input class="form-control" id="na-user"></div>' +
        '<div class="mb-2"><label class="form-label">Email *</label><input class="form-control" id="na-email"></div>' +
        '<div class="mb-2"><label class="form-label">Mật khẩu *</label><input type="password" class="form-control" id="na-pw"></div>' +
        '<div class="mb-2"><label class="form-label">Họ tên</label><input class="form-control" id="na-fn"></div>' +
        '<div class="mb-2"><label class="form-label">Vai trò</label>' +
        '<select class="form-select" id="na-role"><option value="user">user</option><option value="staff">staff</option><option value="admin">admin</option>' +
        (NgocAdmin.isSuperAdmin() ? '<option value="super_admin">super_admin</option>' : '') +
        '</select></div></div>' +
        '<div class="modal-footer">' +
        '<button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Đóng</button>' +
        '<button type="button" class="btn btn-primary" id="na-save">Tạo</button></div></div></div></div>';
      document.body.insertAdjacentHTML('beforeend', html);
      const modalEl = document.getElementById('ngocModalUserAdd');
      const modal = new bootstrap.Modal(modalEl);
      document.getElementById('na-save').addEventListener('click', async function () {
        await NgocAdmin.api('/users', {
          method: 'POST',
          body: JSON.stringify({
            username: document.getElementById('na-user').value.trim(),
            email: document.getElementById('na-email').value.trim(),
            password: document.getElementById('na-pw').value,
            full_name: document.getElementById('na-fn').value.trim() || null,
            role: document.getElementById('na-role').value
          })
        });
        modal.hide();
        modalEl.remove();
        await load();
      });
      modalEl.addEventListener(
        'hidden.bs.modal',
        function () {
          modalEl.remove();
        },
        { once: true }
      );
      modal.show();
    });

    await load();
  };

  V.categories = async function (root) {
    async function load() {
      const data = await NgocAdmin.api('/categories');
      const items = data.items || [];
      root.innerHTML =
        '<div class="mb-3"><button type="button" class="btn btn-primary" id="nc-add">Thêm danh mục</button></div>' +
        '<table class="table table-bordered table-sm"><thead><tr><th>ID</th><th>Tên</th><th>Slug</th><th>Thứ tự</th><th></th></tr></thead><tbody>' +
        items
          .map(function (c) {
            return (
              '<tr><td>' +
              c.id +
              '</td><td>' +
              U.escapeHtml(c.name) +
              '</td><td>' +
              U.escapeHtml(c.slug) +
              '</td><td>' +
              (c.sort_order ?? 0) +
              '</td><td><button type="button" class="btn btn-sm btn-outline-primary ngoc-c-edit" data-id="' +
              c.id +
              '">Sửa</button> <button type="button" class="btn btn-sm btn-outline-danger ngoc-c-del" data-id="' +
              c.id +
              '">Xóa</button></td></tr>'
            );
          })
          .join('') +
        '</tbody></table>';

      root.querySelector('#nc-add').addEventListener('click', function () {
        const name = prompt('Tên danh mục');
        if (!name) return;
        NgocAdmin.api('/categories', {
          method: 'POST',
          body: JSON.stringify({ name: name, sort_order: 0 })
        }).then(load);
      });
      root.querySelectorAll('.ngoc-c-edit').forEach(function (btn) {
        btn.addEventListener('click', async function () {
          const id = btn.getAttribute('data-id');
          const row = items.find(function (x) {
            return String(x.id) === id;
          });
          if (!row) return;
          const name = prompt('Tên', row.name);
          if (name == null) return;
          const sort = prompt('Thứ tự', String(row.sort_order ?? 0));
          await NgocAdmin.api('/categories/' + id, {
            method: 'PUT',
            body: JSON.stringify({ name: name, sort_order: parseInt(sort, 10) || 0 })
          });
          await load();
        });
      });
      root.querySelectorAll('.ngoc-c-del').forEach(function (btn) {
        btn.addEventListener('click', async function () {
          if (!confirm('Xóa danh mục?')) return;
          await NgocAdmin.api('/categories/' + btn.getAttribute('data-id'), { method: 'DELETE' });
          await load();
        });
      });
    }
    await load();
  };

  V.products = async function (root) {
    let page = 1;
    const limit = 20;
    let filters = { q: '', category_id: '', min_price: '', max_price: '', featured: '' };

    async function load() {
      const qs = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (filters.q) qs.set('q', filters.q);
      if (filters.category_id) qs.set('category_id', filters.category_id);
      if (filters.min_price !== '') qs.set('min_price', filters.min_price);
      if (filters.max_price !== '') qs.set('max_price', filters.max_price);
      if (filters.featured !== '') qs.set('featured', filters.featured);
      const data = await NgocAdmin.api('/products?' + qs.toString());
      const cats = await NgocAdmin.api('/categories');
      const catOpts =
        '<option value="">— Danh mục —</option>' +
        (cats.items || [])
          .map(function (c) {
            return '<option value="' + c.id + '">' + U.escapeHtml(c.name) + '</option>';
          })
          .join('');
      const items = data.items || [];
      root.innerHTML =
        '<div class="row g-2 mb-3 align-items-end">' +
        '<div class="col-md-3"><label class="form-label small">Tìm kiếm</label><input class="form-control form-control-sm" id="np-q" value="' +
        U.escapeHtml(filters.q) +
        '"></div>' +
        '<div class="col-md-2"><label class="form-label small">Danh mục</label><select class="form-select form-select-sm" id="np-cat">' +
        catOpts +
        '</select></div>' +
        '<div class="col-md-2"><label class="form-label small">Giá từ</label><input type="number" class="form-control form-control-sm" id="np-min" value="' +
        U.escapeHtml(filters.min_price) +
        '"></div>' +
        '<div class="col-md-2"><label class="form-label small">Đến</label><input type="number" class="form-control form-control-sm" id="np-max" value="' +
        U.escapeHtml(filters.max_price) +
        '"></div>' +
        '<div class="col-md-2"><label class="form-label small">Nổi bật</label><select class="form-select form-select-sm" id="np-feat"><option value="">Tất cả</option><option value="1">Có</option><option value="0">Không</option></select></div>' +
        '<div class="col-md-1"><button type="button" class="btn btn-sm btn-primary w-100" id="np-go">Lọc</button></div></div>' +
        '<div class="mb-2"><button type="button" class="btn btn-success btn-sm" id="np-add">Thêm sản phẩm</button></div>' +
        '<div class="table-responsive"><table class="table table-sm table-bordered"><thead><tr><th>ID</th><th>Ảnh</th><th>Tên</th><th>Giá</th><th></th></tr></thead><tbody id="np-tb"></tbody></table></div>' +
        '<div class="d-flex gap-2 mt-2"><button type="button" class="btn btn-sm btn-outline-secondary" id="np-prev">Trước</button><span class="py-1">Trang ' +
        page +
        ' / ' +
        Math.max(1, Math.ceil((data.total || 0) / limit)) +
        '</span><button type="button" class="btn btn-sm btn-outline-secondary" id="np-next">Sau</button></div>';

      if (filters.category_id) root.querySelector('#np-cat').value = filters.category_id;
      if (filters.featured !== '') root.querySelector('#np-feat').value = filters.featured;

      document.getElementById('np-tb').innerHTML = items
        .map(function (p) {
          const imgSrc = p.image_url ? NgocAdmin.resolveShopAssetUrl(p.image_url) : '';
          const img = imgSrc
            ? '<img src="' + U.escapeHtml(imgSrc) + '" style="width:48px;height:48px;object-fit:cover;border-radius:6px" alt="">'
            : '—';
          const price =
            p.sale_price != null ? money(p.sale_price) + ' <s class="text-muted small">' + money(p.price) + '</s>' : money(p.price);
          return (
            '<tr><td>' +
            p.id +
            '</td><td>' +
            img +
            '</td><td>' +
            U.escapeHtml(p.name) +
            '<div class="small text-muted">' +
            U.escapeHtml(p.category_name || '') +
            ' · SL: ' +
            (p.stock ?? 0) +
            (p.featured ? ' · <span class="badge bg-label-warning">Nổi bật</span>' : '') +
            '</div></td><td>' +
            price +
            '</td><td><button type="button" class="btn btn-sm btn-primary np-edit" data-id="' +
            p.id +
            '">Sửa</button> <button type="button" class="btn btn-sm btn-danger np-del" data-id="' +
            p.id +
            '">Xóa</button></td></tr>'
          );
        })
        .join('');

      root.querySelector('#np-go').addEventListener('click', function () {
        filters.q = root.querySelector('#np-q').value.trim();
        filters.category_id = root.querySelector('#np-cat').value;
        filters.min_price = root.querySelector('#np-min').value;
        filters.max_price = root.querySelector('#np-max').value;
        filters.featured = root.querySelector('#np-feat').value;
        page = 1;
        load();
      });
      root.querySelector('#np-prev').addEventListener('click', function () {
        if (page > 1) {
          page--;
          load();
        }
      });
      root.querySelector('#np-next').addEventListener('click', function () {
        const maxP = Math.max(1, Math.ceil((data.total || 0) / limit));
        if (page < maxP) {
          page++;
          load();
        }
      });
      root.querySelectorAll('.np-edit').forEach(function (b) {
        b.addEventListener('click', function () {
          editProduct(parseInt(b.getAttribute('data-id'), 10));
        });
      });
      root.querySelectorAll('.np-del').forEach(function (b) {
        b.addEventListener('click', async function () {
          if (!confirm('Xóa sản phẩm?')) return;
          try {
            await NgocAdmin.api('/products/' + b.getAttribute('data-id'), { method: 'DELETE' });
            await load();
          } catch (err) {
            alert(err.message || 'Không xóa được');
          }
        });
      });
      root.querySelector('#np-add').addEventListener('click', function () {
        editProduct(null);
      });
    }

    async function editProduct(id) {
      const cats = await NgocAdmin.api('/categories');
      const catOpts =
        '<option value="">—</option>' +
        (cats.items || [])
          .map(function (c) {
            return '<option value="' + c.id + '">' + U.escapeHtml(c.name) + '</option>';
          })
          .join('');
      let p = {
        name: '',
        slug: '',
        description: '',
        sku: '',
        price: 0,
        sale_price: '',
        stock: 0,
        image_url: '',
        category_id: '',
        featured: 0,
        published: 1,
        legacy_wp_id: ''
      };
      if (id) {
        p = await NgocAdmin.api('/products/' + id);
      }
      const html =
        '<div class="modal fade" id="ngocModalPr" tabindex="-1"><div class="modal-dialog modal-lg"><div class="modal-content">' +
        '<div class="modal-header"><h5 class="modal-title">' +
        (id ? 'Sửa sản phẩm' : 'Thêm sản phẩm') +
        '</h5><button type="button" class="btn-close" data-bs-dismiss="modal"></button></div>' +
        '<div class="modal-body">' +
        '<div class="row g-2">' +
        '<div class="col-md-8"><label class="form-label">Tên *</label><input class="form-control" id="pr-name" value="' +
        U.escapeHtml(p.name) +
        '"></div>' +
        '<div class="col-md-4"><label class="form-label">Slug</label><input class="form-control" id="pr-slug" value="' +
        U.escapeHtml(p.slug || '') +
        '"></div>' +
        '<div class="col-md-4"><label class="form-label">Danh mục</label><select class="form-select" id="pr-cat">' +
        catOpts +
        '</select></div>' +
        '<div class="col-md-4"><label class="form-label">Giá</label><input type="number" class="form-control" id="pr-price" value="' +
        (p.price ?? 0) +
        '"></div>' +
        '<div class="col-md-4"><label class="form-label">Giá KM</label><input type="number" class="form-control" id="pr-sale" value="' +
        (p.sale_price != null ? p.sale_price : '') +
        '"></div>' +
        '<div class="col-md-4"><label class="form-label">Tồn kho</label><input type="number" class="form-control" id="pr-stock" value="' +
        (p.stock ?? 0) +
        '"></div>' +
        '<div class="col-12"><label class="form-label">Mô tả</label><textarea class="form-control" rows="3" id="pr-desc">' +
        U.escapeHtml(p.description || '') +
        '</textarea></div>' +
        '<div class="col-md-8"><label class="form-label">URL ảnh</label><input class="form-control" id="pr-img" value="' +
        U.escapeHtml(p.image_url || '') +
        '"></div>' +
        '<div class="col-md-4"><label class="form-label">Upload ảnh</label><input type="file" class="form-control" id="pr-file" accept="image/*"></div>' +
        '<div class="col-md-4"><label class="form-label">SKU</label><input class="form-control" id="pr-sku" value="' +
        U.escapeHtml(p.sku || '') +
        '"></div>' +
        '<div class="col-md-4"><label class="form-label">Legacy WP ID</label><input class="form-control" id="pr-leg" value="' +
        (p.legacy_wp_id != null ? p.legacy_wp_id : '') +
        '"></div>' +
        '<div class="col-md-4 form-check mt-4"><input type="checkbox" class="form-check-input" id="pr-feat"><label class="form-check-label" for="pr-feat">Nổi bật</label></div>' +
        '<div class="col-md-4 form-check mt-4"><input type="checkbox" class="form-check-input" id="pr-pub" checked><label class="form-check-label" for="pr-pub">Hiển thị</label></div>' +
        '</div></div><div class="modal-footer">' +
        '<button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Đóng</button>' +
        '<button type="button" class="btn btn-primary" id="pr-save">Lưu</button></div></div></div></div>';
      document.body.insertAdjacentHTML('beforeend', html);
      if (p.category_id) document.getElementById('pr-cat').value = String(p.category_id);
      document.getElementById('pr-feat').checked = !!p.featured;
      document.getElementById('pr-pub').checked = p.published !== 0;
      document.getElementById('pr-file').addEventListener('change', async function (ev) {
        const f = ev.target.files && ev.target.files[0];
        if (!f) return;
        try {
          const url = await uploadImage(f);
          document.getElementById('pr-img').value = url;
        } catch (err) {
          alert(err.message);
        }
      });
      const modalEl = document.getElementById('ngocModalPr');
      const modal = new bootstrap.Modal(modalEl);
      document.getElementById('pr-save').addEventListener('click', async function () {
        const body = {
          name: document.getElementById('pr-name').value.trim(),
          slug: document.getElementById('pr-slug').value.trim() || undefined,
          description: document.getElementById('pr-desc').value,
          sku: document.getElementById('pr-sku').value.trim() || null,
          price: Number(document.getElementById('pr-price').value),
          sale_price: document.getElementById('pr-sale').value === '' ? null : Number(document.getElementById('pr-sale').value),
          stock: parseInt(document.getElementById('pr-stock').value, 10) || 0,
          image_url: document.getElementById('pr-img').value.trim() || null,
          category_id: document.getElementById('pr-cat').value || null,
          featured: document.getElementById('pr-feat').checked,
          published: document.getElementById('pr-pub').checked,
          legacy_wp_id: document.getElementById('pr-leg').value === '' ? null : document.getElementById('pr-leg').value
        };
        if (!body.name) {
          alert('Nhập tên sản phẩm.');
          return;
        }
        try {
          if (id) {
            await NgocAdmin.api('/products/' + id, { method: 'PUT', body: JSON.stringify(body) });
          } else {
            await NgocAdmin.api('/products', { method: 'POST', body: JSON.stringify(body) });
          }
          modal.hide();
          modalEl.remove();
          await load();
        } catch (err) {
          alert(err.message || 'Lưu thất bại');
        }
      });
      modalEl.addEventListener(
        'hidden.bs.modal',
        function () {
          modalEl.remove();
        },
        { once: true }
      );
      modal.show();
    }

    await load();
  };

  V.orders = async function (root) {
    let page = 1;
    const limit = 20;
    let st = '';
    let q = '';
    let from = '';
    let to = '';

    async function load() {
      const qs = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (st) qs.set('status', st);
      if (q) qs.set('q', q);
      if (from) qs.set('from', from);
      if (to) qs.set('to', to);
      const data = await NgocAdmin.api('/orders?' + qs.toString());
      const items = data.items || [];
      root.innerHTML =
        '<div class="row g-2 mb-3">' +
        '<div class="col-md-2"><select class="form-select form-select-sm" id="ord-st"><option value="">Mọi trạng thái</option>' +
        '<option value="pending">Chờ xử lý</option><option value="processing">Đang xử lý</option><option value="shipped">Đang giao</option><option value="completed">Đã giao</option><option value="cancelled">Đã huỷ</option></select></div>' +
        '<div class="col-md-3"><input class="form-control form-control-sm" id="ord-q" placeholder="Mã đơn, tên, SĐT…" value="' +
        U.escapeHtml(q) +
        '"></div>' +
        '<div class="col-md-2"><input type="date" class="form-control form-control-sm" id="ord-from" value="' +
        U.escapeHtml(from) +
        '"></div>' +
        '<div class="col-md-2"><input type="date" class="form-control form-control-sm" id="ord-to" value="' +
        U.escapeHtml(to) +
        '"></div>' +
        '<div class="col-md-2"><button type="button" class="btn btn-sm btn-primary" id="ord-go">Lọc</button></div></div>' +
        '<div class="table-responsive"><table class="table table-sm table-bordered"><thead><tr><th>Mã</th><th>Khách</th><th>Tổng</th><th>TT</th><th>Ngày</th><th></th></tr></thead><tbody id="ord-tb"></tbody></table></div>' +
        '<div class="d-flex gap-2"><button type="button" class="btn btn-sm btn-outline-secondary" id="ord-prev">Trước</button>' +
        '<button type="button" class="btn btn-sm btn-outline-secondary" id="ord-next">Sau</button></div>';

      if (st) root.querySelector('#ord-st').value = st;
      root.querySelector('#ord-go').addEventListener('click', function () {
        st = root.querySelector('#ord-st').value;
        q = root.querySelector('#ord-q').value.trim();
        from = root.querySelector('#ord-from').value;
        to = root.querySelector('#ord-to').value;
        page = 1;
        load();
      });
      root.querySelector('#ord-prev').addEventListener('click', function () {
        if (page > 1) {
          page--;
          load();
        }
      });
      root.querySelector('#ord-next').addEventListener('click', function () {
        const maxP = Math.max(1, Math.ceil((data.total || 0) / limit));
        if (page < maxP) {
          page++;
          load();
        }
      });

      document.getElementById('ord-tb').innerHTML = items
        .map(function (o) {
          return (
            '<tr><td>' +
            U.escapeHtml(o.order_code) +
            '</td><td>' +
            U.escapeHtml(o.customer_name) +
            '<div class="small text-muted">' +
            U.escapeHtml(o.email || '') +
            '</div></td><td>' +
            money(o.total) +
            '</td><td><span class="badge ' +
            U.statusBadgeClass(o.status) +
            '">' +
            U.orderStatus(o.status) +
            '</span></td><td class="small">' +
            U.escapeHtml((o.created_at || '').slice(0, 16)) +
            '</td><td><button type="button" class="btn btn-sm btn-primary ord-view" data-id="' +
            o.id +
            '">Chi tiết</button></td></tr>'
          );
        })
        .join('');

      root.querySelectorAll('.ord-view').forEach(function (b) {
        b.addEventListener('click', async function () {
          const id = b.getAttribute('data-id');
          const detail = await NgocAdmin.api('/orders/' + id);
          const o = detail.order;
          const items = detail.items || [];
          const stHtml =
            '<select class="form-select form-select-sm mb-2" id="ord-new-st">' +
            ['pending', 'processing', 'shipped', 'completed', 'cancelled']
              .map(function (s) {
                return (
                  '<option value="' +
                  s +
                  '"' +
                  (o.status === s ? ' selected' : '') +
                  '>' +
                  U.orderStatus(s) +
                  '</option>'
                );
              })
              .join('') +
            '</select>' +
            '<button type="button" class="btn btn-sm btn-primary mb-2" id="ord-save-st">Cập nhật trạng thái</button>';
          const payHtml =
            '<div class="mt-2"><label class="small">Thanh toán</label>' +
            '<select class="form-select form-select-sm mb-1" id="ord-pay-m"><option value="cod">COD</option><option value="bank">Chuyển khoản</option></select>' +
            '<select class="form-select form-select-sm mb-1" id="ord-pay-s"><option value="unpaid">Chưa TT</option><option value="paid">Đã TT</option><option value="refunded">Hoàn tiền</option></select>' +
            '<button type="button" class="btn btn-sm btn-outline-primary" id="ord-save-pay">Cập nhật TT</button></div>';
          const lines = items
            .map(function (it) {
              return (
                '<tr><td>' +
                U.escapeHtml(it.product_name) +
                '</td><td>' +
                it.quantity +
                '</td><td>' +
                money(it.unit_price) +
                '</td><td>' +
                money(Number(it.quantity) * Number(it.unit_price)) +
                '</td></tr>'
              );
            })
            .join('');
          const modalHtml =
            '<div class="modal fade" id="ngocOrdModal" tabindex="-1"><div class="modal-dialog modal-lg"><div class="modal-content">' +
            '<div class="modal-header"><h5 class="modal-title">' +
            U.escapeHtml(o.order_code) +
            '</h5><button class="btn-close" data-bs-dismiss="modal"></button></div>' +
            '<div class="modal-body">' +
            '<p><strong>Khách:</strong> ' +
            U.escapeHtml(o.customer_name) +
            '<br><strong>Email:</strong> ' +
            U.escapeHtml(o.email) +
            '<br><strong>SĐT:</strong> ' +
            U.escapeHtml(o.phone || '') +
            '<br><strong>Địa chỉ:</strong> ' +
            U.escapeHtml(o.address || '') +
            '</p>' +
            '<table class="table table-sm"><thead><tr><th>SP</th><th>SL</th><th>Đơn giá</th><th>Tạm</th></tr></thead><tbody>' +
            lines +
            '</tbody></table>' +
            (Number(o.discount_amount) > 0
              ? '<p><strong>Tạm tính (ước lượng):</strong> ' +
                money(Number(o.total) + Number(o.discount_amount)) +
                '</p><p><strong>Giảm giá' +
                (o.coupon_code ? ' (' + U.escapeHtml(o.coupon_code) + ')' : '') +
                ':</strong> −' +
                money(o.discount_amount) +
                '</p>'
              : '') +
            '<p><strong>Tổng thanh toán:</strong> ' +
            money(o.total) +
            '</p>' +
            stHtml +
            payHtml +
            '<button type="button" class="btn btn-sm btn-secondary mt-2" id="ord-print">In hóa đơn</button>' +
            '</div><div class="modal-footer"><button class="btn btn-secondary" data-bs-dismiss="modal">Đóng</button></div></div></div></div>';
          document.body.insertAdjacentHTML('beforeend', modalHtml);
          const mel = document.getElementById('ngocOrdModal');
          document.getElementById('ord-pay-m').value = o.payment_method || 'cod';
          document.getElementById('ord-pay-s').value = o.payment_status || 'unpaid';
          const md = new bootstrap.Modal(mel);
          document.getElementById('ord-save-st').addEventListener('click', async function () {
            const ns = document.getElementById('ord-new-st').value;
            await NgocAdmin.api('/orders/' + id + '/status', {
              method: 'PATCH',
              body: JSON.stringify({ status: ns })
            });
            md.hide();
            mel.remove();
            await load();
          });
          document.getElementById('ord-save-pay').addEventListener('click', async function () {
            await NgocAdmin.api('/orders/' + id + '/payment', {
              method: 'PATCH',
              body: JSON.stringify({
                payment_method: document.getElementById('ord-pay-m').value,
                payment_status: document.getElementById('ord-pay-s').value
              })
            });
            alert('Đã cập nhật thanh toán');
          });
          document.getElementById('ord-print').addEventListener('click', function () {
            const tableHtml =
              '<table><thead><tr><th>Sản phẩm</th><th>SL</th><th>Đơn giá</th><th>Tạm</th></tr></thead><tbody>' +
              lines +
              '</tbody></table>';
            const w = window.open('', '_blank');
            w.document.write('<!DOCTYPE html><html><head><meta charset="utf-8"><title>' + o.order_code + '</title>');
            w.document.write(
              '<style>body{font-family:Public Sans,sans-serif;padding:24px} table{width:100%;border-collapse:collapse} td,th{border:1px solid #ddd;padding:8px}</style></head><body>'
            );
            w.document.write('<h2>Hóa đơn ' + U.escapeHtml(o.order_code) + '</h2>');
            w.document.write('<p>' + U.escapeHtml(o.customer_name) + ' — ' + U.escapeHtml(o.email) + '</p>');
            w.document.write(tableHtml);
            if (Number(o.discount_amount) > 0) {
              w.document.write(
                '<p><strong>Giảm giá' +
                  (o.coupon_code ? ' (' + U.escapeHtml(o.coupon_code) + ')' : '') +
                  ':</strong> −' +
                  money(o.discount_amount) +
                  '</p>'
              );
            }
            w.document.write('<p><strong>Tổng:</strong> ' + money(o.total) + '</p>');
            w.document.write('</body></html>');
            w.document.close();
            w.print();
          });
          mel.addEventListener(
            'hidden.bs.modal',
            function () {
              mel.remove();
            },
            { once: true }
          );
          md.show();
        });
      });
    }
    await load();
  };

  V.payments = async function (root) {
    const data = await NgocAdmin.api('/orders?limit=80');
    const items = data.items || [];
    root.innerHTML =
      '<p class="text-muted mb-3">Phương thức: <strong>COD</strong> (thanh toán khi nhận), <strong>Chuyển khoản</strong>. Xác nhận thanh toán trong cột thao tác (mở chi tiết đơn).</p>' +
      '<div class="table-responsive"><table class="table table-sm table-bordered"><thead><tr><th>Mã</th><th>Khách</th><th>Tổng</th><th>TT đơn</th><th>Phương thức</th><th>TT thanh toán</th><th></th></tr></thead><tbody>' +
      items
        .map(function (o) {
          return (
            '<tr><td>' +
            U.escapeHtml(o.order_code) +
            '</td><td>' +
            U.escapeHtml(o.customer_name) +
            '</td><td>' +
            money(o.total) +
            '</td><td><span class="badge ' +
            U.statusBadgeClass(o.status) +
            '">' +
            U.orderStatus(o.status) +
            '</span></td><td>' +
            U.paymentMethod(o.payment_method) +
            '</td><td>' +
            U.paymentStatus(o.payment_status) +
            '</td><td><a href="#/orders" class="btn btn-sm btn-outline-secondary">Quản lý ở Đơn hàng</a></td></tr>'
          );
        })
        .join('') +
      '</tbody></table></div>' +
      '<p class="small text-muted">Để <strong>xác nhận thanh toán</strong> và đổi trạng thái, vào menu <a href="#/orders">Đơn hàng</a> → Chi tiết đơn.</p>';
  };

  V.reports = async function (root) {
    let group = 'day';
    async function render() {
      const rev = await NgocAdmin.api('/reports/revenue?group=' + encodeURIComponent(group));
      const tc = await NgocAdmin.api('/reports/top-customers');
      const dash = await NgocAdmin.api('/reports/dashboard');
      const items = rev.items || [];
      const groupLabel =
        group === 'year' ? 'năm' : group === 'month' ? 'tháng' : 'ngày';
      root.innerHTML =
        '<div class="mb-3 d-flex align-items-center gap-2 flex-wrap">' +
        '<label class="mb-0 small text-muted">Nhóm theo</label>' +
        '<select class="form-select form-select-sm" id="ngoc-rep-group" style="max-width:180px">' +
        '<option value="day"' +
        (group === 'day' ? ' selected' : '') +
        '>Theo ngày</option>' +
        '<option value="month"' +
        (group === 'month' ? ' selected' : '') +
        '>Theo tháng</option>' +
        '<option value="year"' +
        (group === 'year' ? ' selected' : '') +
        '>Theo năm</option>' +
        '</select>' +
        '</div>' +
        '<h5 class="mb-3">Doanh thu theo ' +
        groupLabel +
        ' (toàn bộ dữ liệu trong DB)</h5>' +
        '<div id="ngoc-rep-chart" class="mb-4"></div>' +
        '<h5>Khách mua nhiều nhất</h5>' +
        '<div class="table-responsive mb-4"><table class="table table-sm table-bordered"><thead><tr><th>Email</th><th>Tên</th><th>Tổng chi</th><th>Số đơn</th></tr></thead><tbody>' +
        (tc.items || [])
          .map(function (r) {
            return (
              '<tr><td>' +
              U.escapeHtml(r.email) +
              '</td><td>' +
              U.escapeHtml(r.customer_name) +
              '</td><td>' +
              money(r.revenue) +
              '</td><td>' +
              (r.orders || 0) +
              '</td></tr>'
            );
          })
          .join('') +
        '</tbody></table></div>' +
        '<h5>Sản phẩm bán chạy</h5><div class="small" id="ngoc-rep-top"></div>';

      document.getElementById('ngoc-rep-top').innerHTML = (dash.topProducts || [])
        .map(function (p) {
          return '<div>' + U.escapeHtml(p.product_name) + ' — ' + (p.qty || 0) + ' sp</div>';
        })
        .join('');

      root.querySelector('#ngoc-rep-group').addEventListener('change', async function () {
        group = this.value;
        if (typeof window.NgocAdminChartDestroy === 'function') {
          window.NgocAdminChartDestroy();
        }
        await render();
      });

      const el = document.querySelector('#ngoc-rep-chart');
      if (el && typeof ApexCharts !== 'undefined') {
        const chart = new ApexCharts(el, {
          chart: { type: 'bar', height: 320, toolbar: { show: false } },
          series: [{ name: 'Doanh thu', data: items.map(function (x) { return Number(x.revenue || 0); }) }],
          xaxis: { categories: items.map(function (x) { return x.k || ''; }) },
          colors: ['#696cff']
        });
        chart.render();
        window.NgocAdminChartDestroy = function () {
          chart.destroy();
        };
      }
    }
    await render();
  };

  V.settings = async function (root) {
    const s = await NgocAdmin.api('/settings');
    const siteName = typeof s.site_name === 'string' ? s.site_name : "Ngọc's clothes";
    const topbar = typeof s.topbar_text === 'string' ? s.topbar_text : '';
    const logo = s.logo_url || '';
    const systemEmail = typeof s.system_email === 'string' ? s.system_email : '';
    const storefront =
      typeof s.storefront_url === 'string' && s.storefront_url
        ? s.storefront_url
        : typeof NgocAdmin.getShopOrigin === 'function'
          ? NgocAdmin.getShopOrigin()
          : '';
    root.innerHTML =
      '<div class="card max-width-600"><div class="card-body">' +
      '<div class="mb-3"><label class="form-label">Tên website</label><input class="form-control" id="set-name" value="' +
      U.escapeHtml(siteName) +
      '"></div>' +
      '<div class="mb-3"><label class="form-label">URL website bán hàng (cửa hàng chính)</label><input class="form-control" id="set-shop" value="' +
      U.escapeHtml(storefront) +
      '" placeholder="http://127.0.0.1:5000"></div>' +
      '<p class="text-muted small">Dùng cho nút « Xem cửa hàng » và liên kết trong quản trị. Không thêm dấu / ở cuối.</p>' +
      '<div class="mb-3"><label class="form-label">Email hệ thống (thông báo / liên hệ)</label><input type="email" class="form-control" id="set-email" value="' +
      U.escapeHtml(systemEmail) +
      '" placeholder="shop@example.com"></div>' +
      '<div class="mb-3"><label class="form-label">Thanh thông báo (topbar)</label><input class="form-control" id="set-top" value="' +
      U.escapeHtml(topbar) +
      '"></div>' +
      '<div class="mb-3"><label class="form-label">URL logo (tuỳ chọn)</label><input class="form-control" id="set-logo" value="' +
      U.escapeHtml(logo) +
      '"></div>' +
      '<button type="button" class="btn btn-primary" id="set-save">Lưu cài đặt</button></div></div>';
    root.querySelector('#set-save').addEventListener('click', async function () {
      const shop = root.querySelector('#set-shop').value.trim().replace(/\/$/, '');
      await NgocAdmin.api('/settings', {
        method: 'PUT',
        body: JSON.stringify({
          site_name: root.querySelector('#set-name').value,
          storefront_url: shop || null,
          system_email: root.querySelector('#set-email').value.trim() || null,
          topbar_text: root.querySelector('#set-top').value,
          logo_url: root.querySelector('#set-logo').value.trim() || null
        })
      });
      NgocAdmin.shopPublicUrl = shop || null;
      await NgocAdmin.fetchPublicMeta();
      if (typeof NgocAdmin.bindShopLinkElements === 'function') {
        NgocAdmin.bindShopLinkElements();
      }
      alert('Đã lưu.');
    });
  };

  V.media = async function (root) {
    async function load() {
      const data = await NgocAdmin.api('/media/list');
      const items = data.items || [];
      root.innerHTML =
        '<div class="mb-3"><input type="file" class="form-control" id="med-f" accept="image/*"> ' +
        '<button type="button" class="btn btn-primary btn-sm" id="med-up">Upload</button></div>' +
        '<div class="row g-2" id="med-grid"></div>';
      document.getElementById('med-grid').innerHTML = items
        .map(function (f) {
          return (
            '<div class="col-6 col-md-3 col-lg-2">' +
            '<div class="card"><img src="' +
            U.escapeHtml(f.url) +
            '" class="card-img-top" style="height:120px;object-fit:cover" loading="lazy">' +
            '<div class="card-body p-2 small"><button type="button" class="btn btn-sm btn-danger med-del" data-name="' +
            U.escapeHtml(f.name) +
            '">Xóa</button></div></div></div>'
          );
        })
        .join('');
      root.querySelector('#med-up').addEventListener('click', async function () {
        const inp = root.querySelector('#med-f');
        if (!inp.files || !inp.files[0]) return;
        await uploadImage(inp.files[0]);
        await load();
      });
      root.querySelectorAll('.med-del').forEach(function (b) {
        b.addEventListener('click', async function () {
          if (!confirm('Xóa ảnh?')) return;
          await NgocAdmin.api('/media/' + encodeURIComponent(b.getAttribute('data-name')), { method: 'DELETE' });
          await load();
        });
      });
    }
    await load();
  };

  V.content = async function (root) {
    let typeFilter = '';
    async function openModal(row) {
      const isEdit = row && row.id;
      const m = document.createElement('div');
      m.innerHTML =
        '<div class="modal fade" id="ngocCmsModal" tabindex="-1"><div class="modal-dialog modal-lg"><div class="modal-content">' +
        '<div class="modal-header"><h5 class="modal-title">' +
        (isEdit ? 'Sửa nội dung' : 'Thêm nội dung') +
        '</h5><button class="btn-close" data-bs-dismiss="modal"></button></div>' +
        '<div class="modal-body">' +
        '<div class="mb-2"><label class="form-label">Loại</label><select class="form-select" id="cms-type">' +
        '<option value="post">Bài viết</option><option value="banner">Banner</option><option value="page">Trang</option></select></div>' +
        '<div class="mb-2"><label class="form-label">Tiêu đề *</label><input class="form-control" id="cms-title"></div>' +
        '<div class="mb-2"><label class="form-label">Slug (tuỳ chọn)</label><input class="form-control" id="cms-slug" placeholder="de-trong"></div>' +
        '<div class="mb-2"><label class="form-label">Mô tả ngắn</label><textarea class="form-control" id="cms-excerpt" rows="2"></textarea></div>' +
        '<div class="mb-2"><label class="form-label">Nội dung</label><textarea class="form-control" id="cms-body" rows="6"></textarea></div>' +
        '<div class="mb-2"><label class="form-label">Ảnh (URL)</label><input class="form-control" id="cms-img"></div>' +
        '<div class="row"><div class="col-6 mb-2"><label class="form-label">Thứ tự</label><input type="number" class="form-control" id="cms-sort" value="0"></div>' +
        '<div class="col-6 mb-2"><label class="form-label">Hiển thị</label><select class="form-select" id="cms-pub"><option value="1">Có</option><option value="0">Ẩn</option></select></div></div>' +
        '</div><div class="modal-footer"><button class="btn btn-secondary" data-bs-dismiss="modal">Huỷ</button>' +
        '<button class="btn btn-primary" id="cms-save">Lưu</button></div></div></div></div>';
      document.body.appendChild(m.firstChild);
      const el = document.getElementById('ngocCmsModal');
      if (row) {
        document.getElementById('cms-type').value = row.type || 'post';
        document.getElementById('cms-title').value = row.title || '';
        document.getElementById('cms-slug').value = row.slug || '';
        document.getElementById('cms-excerpt').value = row.excerpt || '';
        document.getElementById('cms-body').value = row.body || '';
        document.getElementById('cms-img').value = row.image_url || '';
        document.getElementById('cms-sort').value = String(row.sort_order != null ? row.sort_order : 0);
        document.getElementById('cms-pub').value = row.published === 0 || row.published === false ? '0' : '1';
      }
      const modal = new bootstrap.Modal(el);
      document.getElementById('cms-save').addEventListener('click', async function () {
        const body = {
          type: document.getElementById('cms-type').value,
          title: document.getElementById('cms-title').value,
          slug: document.getElementById('cms-slug').value.trim() || undefined,
          excerpt: document.getElementById('cms-excerpt').value,
          body: document.getElementById('cms-body').value,
          image_url: document.getElementById('cms-img').value.trim(),
          sort_order: parseInt(document.getElementById('cms-sort').value, 10) || 0,
          published: document.getElementById('cms-pub').value === '1'
        };
        if (!String(body.title || '').trim()) {
          alert('Nhập tiêu đề.');
          return;
        }
        try {
          if (isEdit) {
            await NgocAdmin.api('/cms/admin/' + row.id, { method: 'PUT', body: JSON.stringify(body) });
          } else {
            await NgocAdmin.api('/cms/admin', { method: 'POST', body: JSON.stringify(body) });
          }
          modal.hide();
          el.remove();
          await load();
        } catch (err) {
          alert(err.message || 'Lưu thất bại');
        }
      });
      el.addEventListener(
        'hidden.bs.modal',
        function () {
          el.remove();
        },
        { once: true }
      );
      modal.show();
    }
    async function load() {
      const qs = typeFilter ? '?type=' + encodeURIComponent(typeFilter) : '';
      const data = await NgocAdmin.api('/cms/admin' + qs);
      const items = data.items || [];
      root.innerHTML =
        '<div class="d-flex flex-wrap gap-2 mb-3 align-items-center">' +
        '<select class="form-select form-select-sm" id="cms-filter" style="max-width:200px">' +
        '<option value="">Mọi loại</option><option value="post">Bài viết</option><option value="banner">Banner</option><option value="page">Trang</option></select>' +
        '<button type="button" class="btn btn-sm btn-primary" id="cms-add">Thêm</button></div>' +
        '<div class="table-responsive"><table class="table table-sm table-bordered"><thead><tr><th>Loại</th><th>Tiêu đề</th><th>Slug</th><th>TT</th><th></th></tr></thead><tbody id="cms-tb"></tbody></table></div>' +
        '<p class="small text-muted">API công khai: <code>/api/cms/public</code> và <code>/api/cms/public/slug/:slug</code></p>';
      if (typeFilter) root.querySelector('#cms-filter').value = typeFilter;
      root.querySelector('#cms-filter').addEventListener('change', function () {
        typeFilter = this.value;
        load();
      });
      root.querySelector('#cms-add').addEventListener('click', function () {
        openModal(null);
      });
      document.getElementById('cms-tb').innerHTML = items
        .map(function (it) {
          return (
            '<tr><td>' +
            U.escapeHtml(it.type) +
            '</td><td>' +
            U.escapeHtml(it.title) +
            '</td><td><code class="small">' +
            U.escapeHtml(it.slug) +
            '</code></td><td>' +
            (it.published ? '<span class="badge bg-success">Hiện</span>' : '<span class="badge bg-secondary">Ẩn</span>') +
            '</td><td><button type="button" class="btn btn-sm btn-outline-primary cms-edit" data-id="' +
            it.id +
            '">Sửa</button> ' +
            '<button type="button" class="btn btn-sm btn-outline-danger cms-del" data-id="' +
            it.id +
            '">Xóa</button></td></tr>'
          );
        })
        .join('');
      root.querySelectorAll('.cms-edit').forEach(function (btn) {
        btn.addEventListener('click', async function () {
          const id = btn.getAttribute('data-id');
          const row = items.find(function (x) {
            return String(x.id) === String(id);
          });
          if (row) openModal(row);
        });
      });
      root.querySelectorAll('.cms-del').forEach(function (btn) {
        btn.addEventListener('click', async function () {
          if (!confirm('Xóa mục này?')) return;
          try {
            await NgocAdmin.api('/cms/admin/' + btn.getAttribute('data-id'), { method: 'DELETE' });
            await load();
          } catch (err) {
            alert(err.message || 'Không xóa được');
          }
        });
      });
    }
    await load();
  };

  V.reviews = async function (root) {
    let filter = '';
    async function load() {
      const qs = filter === 'pending' ? '?approved=0' : '';
      const data = await NgocAdmin.api('/reviews' + qs);
      const items = data.items || [];
      root.innerHTML =
        '<div class="mb-3 d-flex flex-wrap gap-2 align-items-center">' +
        '<select class="form-select form-select-sm" id="rev-filter" style="max-width:220px">' +
        '<option value="">Tất cả</option><option value="pending">Chờ duyệt</option></select></div>' +
        '<div class="table-responsive"><table class="table table-sm table-bordered"><thead><tr><th>SP</th><th>Người gửi</th><th>Điểm</th><th>Nội dung</th><th>TT</th><th></th></tr></thead><tbody id="rev-tb"></tbody></table></div>' +
        '<p class="small text-muted">Khách gửi qua <code>POST /api/reviews/submit</code> (cần truyền product_id).</p>';
      if (filter) root.querySelector('#rev-filter').value = filter;
      root.querySelector('#rev-filter').addEventListener('change', function () {
        filter = this.value;
        load();
      });
      document.getElementById('rev-tb').innerHTML = items
        .map(function (r) {
          return (
            '<tr><td class="small">' +
            U.escapeHtml(r.product_name || '#' + r.product_id) +
            '</td><td>' +
            U.escapeHtml(r.author_name) +
            '<div class="small text-muted">' +
            U.escapeHtml(r.email || '') +
            '</div></td><td>' +
            (r.rating || 0) +
            '</td><td class="small">' +
            U.escapeHtml((r.comment || '').slice(0, 200)) +
            '</td><td>' +
            (r.approved
              ? '<span class="badge bg-success">Đã duyệt</span>'
              : '<span class="badge bg-warning text-dark">Chờ</span>') +
            '</td><td>' +
            (r.approved
              ? '<button type="button" class="btn btn-sm btn-outline-secondary rev-hide" data-id="' +
                r.id +
                '">Ẩn</button>'
              : '<button type="button" class="btn btn-sm btn-primary rev-ok" data-id="' +
                r.id +
                '">Duyệt</button>') +
            ' <button type="button" class="btn btn-sm btn-outline-danger rev-del" data-id="' +
            r.id +
            '">Xóa</button></td></tr>'
          );
        })
        .join('');
      root.querySelectorAll('.rev-ok').forEach(function (b) {
        b.addEventListener('click', async function () {
          await NgocAdmin.api('/reviews/' + b.getAttribute('data-id'), {
            method: 'PATCH',
            body: JSON.stringify({ approved: true })
          });
          await load();
        });
      });
      root.querySelectorAll('.rev-hide').forEach(function (b) {
        b.addEventListener('click', async function () {
          await NgocAdmin.api('/reviews/' + b.getAttribute('data-id'), {
            method: 'PATCH',
            body: JSON.stringify({ approved: false })
          });
          await load();
        });
      });
      root.querySelectorAll('.rev-del').forEach(function (b) {
        b.addEventListener('click', async function () {
          if (!confirm('Xóa đánh giá?')) return;
          await NgocAdmin.api('/reviews/' + b.getAttribute('data-id'), { method: 'DELETE' });
          await load();
        });
      });
    }
    await load();
  };

  V.coupons = async function (root) {
    async function openModal(row) {
      const isEdit = row && row.id;
      const m = document.createElement('div');
      m.innerHTML =
        '<div class="modal fade" id="ngocCpModal" tabindex="-1"><div class="modal-dialog"><div class="modal-content">' +
        '<div class="modal-header"><h5 class="modal-title">' +
        (isEdit ? 'Sửa mã' : 'Thêm mã') +
        '</h5><button class="btn-close" data-bs-dismiss="modal"></button></div>' +
        '<div class="modal-body">' +
        '<div class="mb-2"><label class="form-label">Mã *</label><input class="form-control" id="cp-code" placeholder="SALE10"></div>' +
        '<div class="mb-2"><label class="form-label">Loại</label><select class="form-select" id="cp-type"><option value="percent">Phần trăm</option><option value="fixed">Số tiền cố định</option></select></div>' +
        '<div class="mb-2"><label class="form-label">Giá trị</label><input type="number" step="0.01" class="form-control" id="cp-val"></div>' +
        '<div class="mb-2"><label class="form-label">Đơn tối thiểu (₫)</label><input type="number" step="1" class="form-control" id="cp-min" value="0"></div>' +
        '<div class="mb-2"><label class="form-label">Giới hạn lượt (để trống = không giới hạn)</label><input type="number" class="form-control" id="cp-max"></div>' +
        '<div class="row"><div class="col-6 mb-2"><label class="form-label">Bắt đầu</label><input type="datetime-local" class="form-control" id="cp-start"></div>' +
        '<div class="col-6 mb-2"><label class="form-label">Kết thúc</label><input type="datetime-local" class="form-control" id="cp-end"></div></div>' +
        '<div class="mb-2"><label class="form-label">Kích hoạt</label><select class="form-select" id="cp-act"><option value="1">Có</option><option value="0">Tắt</option></select></div>' +
        '</div><div class="modal-footer"><button class="btn btn-secondary" data-bs-dismiss="modal">Huỷ</button>' +
        '<button class="btn btn-primary" id="cp-save">Lưu</button></div></div></div></div>';
      document.body.appendChild(m.firstChild);
      const el = document.getElementById('ngocCpModal');
      function toLocalInput(iso) {
        if (!iso) return '';
        const d = new Date(iso);
        if (Number.isNaN(d.getTime())) return '';
        const pad = function (n) {
          return n < 10 ? '0' + n : String(n);
        };
        return (
          d.getFullYear() +
          '-' +
          pad(d.getMonth() + 1) +
          '-' +
          pad(d.getDate()) +
          'T' +
          pad(d.getHours()) +
          ':' +
          pad(d.getMinutes())
        );
      }
      if (row) {
        document.getElementById('cp-code').value = row.code || '';
        document.getElementById('cp-type').value = row.discount_type === 'fixed' ? 'fixed' : 'percent';
        document.getElementById('cp-val').value = row.discount_value != null ? String(row.discount_value) : '';
        document.getElementById('cp-min').value = row.min_order != null ? String(row.min_order) : '0';
        document.getElementById('cp-max').value = row.max_uses != null ? String(row.max_uses) : '';
        document.getElementById('cp-start').value = toLocalInput(row.starts_at);
        document.getElementById('cp-end').value = toLocalInput(row.ends_at);
        document.getElementById('cp-act').value = row.active === 0 || row.active === false ? '0' : '1';
      }
      const modal = new bootstrap.Modal(el);
      document.getElementById('cp-save').addEventListener('click', async function () {
        const body = {
          code: document.getElementById('cp-code').value.trim(),
          discount_type: document.getElementById('cp-type').value,
          discount_value: parseFloat(document.getElementById('cp-val').value),
          min_order: parseFloat(document.getElementById('cp-min').value) || 0,
          max_uses: document.getElementById('cp-max').value.trim(),
          starts_at: document.getElementById('cp-start').value || null,
          ends_at: document.getElementById('cp-end').value || null,
          active: document.getElementById('cp-act').value === '1'
        };
        if (isEdit) {
          await NgocAdmin.api('/coupons/' + row.id, { method: 'PUT', body: JSON.stringify(body) });
        } else {
          await NgocAdmin.api('/coupons', { method: 'POST', body: JSON.stringify(body) });
        }
        modal.hide();
        el.remove();
        await load();
      });
      el.addEventListener(
        'hidden.bs.modal',
        function () {
          el.remove();
        },
        { once: true }
      );
      modal.show();
    }
    async function load() {
      const data = await NgocAdmin.api('/coupons');
      const items = data.items || [];
      root.innerHTML =
        '<p class="text-muted small">Áp dụng tại cửa hàng: nhập mã ở bước thanh toán. API <code>POST /api/coupons/validate</code></p>' +
        '<div class="mb-3"><button type="button" class="btn btn-sm btn-primary" id="cp-add">Thêm mã</button></div>' +
        '<div class="table-responsive"><table class="table table-sm table-bordered"><thead><tr><th>Mã</th><th>Loại</th><th>Giá trị</th><th>Đã dùng</th><th>TT</th><th></th></tr></thead><tbody id="cp-tb"></tbody></table></div>';
      root.querySelector('#cp-add').addEventListener('click', function () {
        openModal(null);
      });
      document.getElementById('cp-tb').innerHTML = items
        .map(function (c) {
          const typ = c.discount_type === 'fixed' ? 'Cố định' : '%';
          const val =
            c.discount_type === 'fixed' ? money(c.discount_value) : String(c.discount_value) + '%';
          return (
            '<tr><td><strong>' +
            U.escapeHtml(c.code) +
            '</strong></td><td>' +
            typ +
            '</td><td>' +
            U.escapeHtml(val) +
            '</td><td>' +
            (c.used_count || 0) +
            (c.max_uses != null ? ' / ' + c.max_uses : '') +
            '</td><td>' +
            (c.active ? '<span class="badge bg-success">Bật</span>' : '<span class="badge bg-secondary">Tắt</span>') +
            '</td><td><button type="button" class="btn btn-sm btn-outline-primary cp-edit" data-id="' +
            c.id +
            '">Sửa</button> ' +
            '<button type="button" class="btn btn-sm btn-outline-danger cp-del" data-id="' +
            c.id +
            '">Xóa</button></td></tr>'
          );
        })
        .join('');
      root.querySelectorAll('.cp-edit').forEach(function (b) {
        b.addEventListener('click', function () {
          const id = b.getAttribute('data-id');
          const row = items.find(function (x) {
            return String(x.id) === String(id);
          });
          if (row) openModal(row);
        });
      });
      root.querySelectorAll('.cp-del').forEach(function (b) {
        b.addEventListener('click', async function () {
          if (!confirm('Xóa mã này?')) return;
          await NgocAdmin.api('/coupons/' + b.getAttribute('data-id'), { method: 'DELETE' });
          await load();
        });
      });
    }
    await load();
  };

  V.security = async function (root) {
    const u = NgocAdmin.currentUser || {};
    root.innerHTML =
      '<div class="card"><div class="card-body">' +
      '<p><strong>Đã đăng nhập:</strong> ' +
      U.escapeHtml(u.email || '') +
      '</p>' +
      '<p><strong>Vai trò:</strong> ' +
      U.escapeHtml(u.role || '') +
      '</p>' +
      '<p class="text-muted small">Super admin: xóa user; Staff/Admin: quản lý cửa hàng.</p>' +
      '<button type="button" class="btn btn-danger" onclick="NgocAdmin.logout()">Đăng xuất</button>' +
      '</div></div>';
  };

  window.NgocViews = V;
})();
