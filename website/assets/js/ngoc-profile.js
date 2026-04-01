(() => {
  const API = '/api';
  const TOKEN_KEY = 'ngoc_customer_token';
  const USER_KEY = 'ngoc_customer_user';

  const elMsg = document.getElementById('msg');
  const $ = (id) => document.getElementById(id);

  function show(text, kind) {
    if (!elMsg) return;
    if (!text) {
      elMsg.innerHTML = '';
      return;
    }
    const cls = kind === 'ok' ? 'alert-success' : kind === 'err' ? 'alert-danger' : 'alert-secondary';
    elMsg.innerHTML = `<div class="alert ${cls} mb-0" role="alert">${escapeHtml(text)}</div>`;
  }

  function escapeHtml(s) {
    const d = document.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
  }

  function setBtnLoading(btn, isLoading, label) {
    if (!btn) return;
    if (isLoading) {
      btn.disabled = true;
      btn.setAttribute('data-prev', btn.innerHTML);
      btn.innerHTML =
        '<span class="spinner-border spinner-border-sm me-2" aria-hidden="true"></span>' +
        '<span role="status">' +
        escapeHtml(label || 'Đang xử lý...') +
        '</span>';
    } else {
      btn.disabled = false;
      const prev = btn.getAttribute('data-prev');
      if (prev) btn.innerHTML = prev;
      btn.removeAttribute('data-prev');
    }
  }

  function getToken() {
    return localStorage.getItem(TOKEN_KEY);
  }
  function setToken(t) {
    if (t) localStorage.setItem(TOKEN_KEY, t);
    else localStorage.removeItem(TOKEN_KEY);
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

  function fullAddress(p) {
    const parts = [p.address_line, p.ward, p.district, p.city, p.country, p.postal_code].filter(Boolean);
    return parts.join(', ');
  }

  function fill(p) {
    $('full_name').value = p.full_name || '';
    $('email').value = p.email || '';
    $('phone').value = p.phone || '';
    $('date_of_birth').value = p.date_of_birth ? String(p.date_of_birth).slice(0, 10) : '';
    $('gender').value = p.gender || 'unknown';
    $('note').value = p.note || '';

    $('address_line').value = p.address_line || '';
    $('ward').value = p.ward || '';
    $('district').value = p.district || '';
    $('city').value = p.city || '';
    $('country').value = p.country || '';
    $('postal_code').value = p.postal_code || '';

    $('displayName').textContent = p.full_name || p.username || '—';
    $('displayEmail').textContent = p.email || '—';
    $('avatarImg').src = p.avatar_url || '/wp-content/uploads/2024/04/cropped-logo-mona-ft-1-192x192.png';
    $('addrPreview').innerHTML =
      '<b>Địa chỉ:</b> ' + (fullAddress(p) ? fullAddress(p) : '<span style="color:#6b7280">Chưa có</span>');
  }

  async function loadProfile() {
    show('', '');
    setBtnLoading($('btnReload'), true, 'Đang tải...');
    try {
      const d = await apiJson('/profile');
      if (d && d.profile) fill(d.profile);
    } catch (e) {
      if (e && e.status === 401) {
        const ok = await refreshIfPossible();
        if (ok) return loadProfile();
        show('Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.', 'err');
        setToken(null);
        setTimeout(() => (window.location.href = '/my-account/'), 800);
        return;
      }
      show(e.message || 'Không tải được profile.', 'err');
    } finally {
      setBtnLoading($('btnReload'), false);
    }
  }

  async function onSaveProfile(ev) {
    ev.preventDefault();
    show('', '');
    const body = {
      full_name: $('full_name').value.trim(),
      phone: $('phone').value.trim(),
      date_of_birth: $('date_of_birth').value || null,
      gender: $('gender').value,
      note: $('note').value.trim()
    };
    if (body.phone && body.phone.length > 50) return show('Số điện thoại quá dài.', 'err');
    if (body.full_name && body.full_name.length > 190) return show('Họ tên quá dài.', 'err');
    const btn = $('btnSaveProfile') || ev.target.querySelector('button[type="submit"]');
    setBtnLoading(btn, true, 'Đang lưu...');
    try {
      const d = await apiJson('/profile', { method: 'PUT', body: JSON.stringify(body) });
      if (d && d.profile) fill(d.profile);
      show('Đã lưu thông tin cá nhân.', 'ok');
    } catch (e) {
      show(e.message || 'Lưu thất bại.', 'err');
    } finally {
      setBtnLoading(btn, false);
    }
  }

  async function onSaveAddress(ev) {
    ev.preventDefault();
    show('', '');
    const body = {
      address_line: $('address_line').value.trim(),
      ward: $('ward').value.trim(),
      district: $('district').value.trim(),
      city: $('city').value.trim(),
      country: $('country').value.trim(),
      postal_code: $('postal_code').value.trim()
    };
    const btn = $('btnSaveAddress') || ev.target.querySelector('button[type="submit"]');
    setBtnLoading(btn, true, 'Đang lưu...');
    try {
      const d = await apiJson('/profile/address', { method: 'PUT', body: JSON.stringify(body) });
      if (d && d.profile) fill(d.profile);
      show('Đã lưu địa chỉ.', 'ok');
    } catch (e) {
      show(e.message || 'Lưu thất bại.', 'err');
    } finally {
      setBtnLoading(btn, false);
    }
  }

  async function onUploadAvatar() {
    show('', '');
    const inp = $('avatarFile');
    const f = inp && inp.files && inp.files[0];
    if (!f) return show('Chọn ảnh trước khi upload.', 'err');
    if (f.size > 3 * 1024 * 1024) return show('Ảnh quá lớn (tối đa 3MB).', 'err');
    const t = getToken();
    if (!t) {
      const ok = await refreshIfPossible();
      if (!ok) {
        show('Vui lòng đăng nhập lại.', 'err');
        return (window.location.href = '/my-account/');
      }
    }

    const btn = $('btnUploadAvatar');
    setBtnLoading(btn, true, 'Đang upload...');
    const fd = new FormData();
    fd.append('avatar', f);
    try {
      const r = await fetch(API + '/profile/avatar', {
        method: 'POST',
        credentials: 'include',
        headers: { Authorization: 'Bearer ' + getToken() },
        body: fd
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error || 'Upload thất bại');
      $('avatarImg').src = d.avatar_url + (d.avatar_url.includes('?') ? '&' : '?') + 't=' + Date.now();
      show('Đã cập nhật avatar.', 'ok');
    } catch (e) {
      show(e.message || 'Upload thất bại.', 'err');
    } finally {
      setBtnLoading(btn, false);
    }
  }

  async function logout() {
    try {
      await fetch(API + '/auth/logout', { method: 'POST', credentials: 'include' });
    } catch (_) {}
    setToken(null);
    localStorage.removeItem(USER_KEY);
    window.location.href = '/';
  }

  function init() {
    $('btnReload').addEventListener('click', loadProfile);
    $('btnLogout').addEventListener('click', logout);
    $('formProfile').addEventListener('submit', onSaveProfile);
    $('formAddress').addEventListener('submit', onSaveAddress);
    $('btnUploadAvatar').addEventListener('click', onUploadAvatar);
    const avatarInput = $('avatarFile');
    if (avatarInput) {
      avatarInput.addEventListener('change', () => {
        const f = avatarInput.files && avatarInput.files[0];
        if (!f) return;
        if (!/^image\//.test(f.type)) return;
        const url = URL.createObjectURL(f);
        $('avatarImg').src = url;
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
      });
    }
    loadProfile();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();

