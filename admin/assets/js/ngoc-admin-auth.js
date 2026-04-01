/**
 * Chặn POST form Sneat (action index.html) — đăng nhập qua API /api/auth/login.
 */
(function () {
  const API = '/api';
  const TOKEN_KEY = 'ngoc_token';

  function showErr(id, msg) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = msg;
    el.classList.remove('d-none');
  }

  function hideErr(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.classList.add('d-none');
  }

  const path = (window.location.pathname || '').toLowerCase();
  const form = document.getElementById('formAuthentication');
  if (!form) return;

  if (path.endsWith('auth-login-basic.html')) {
    form.addEventListener('submit', async function (e) {
      e.preventDefault();
      hideErr('ngoc-login-err');
      const emailEl = document.getElementById('email');
      const passEl = document.getElementById('password');
      const login = (emailEl && emailEl.value ? emailEl.value : '').trim();
      const password = passEl && passEl.value ? passEl.value : '';
      if (!login || !password) {
        showErr('ngoc-login-err', 'Nhập email hoặc username và mật khẩu.');
        return;
      }
      try {
        const r = await fetch(API + '/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: login, password: password })
        });
        const data = await r.json().catch(function () {
          return {};
        });
        if (!r.ok) {
          showErr('ngoc-login-err', data.error || 'Đăng nhập thất bại');
          return;
        }
        if (data.token) localStorage.setItem(TOKEN_KEY, data.token);
        const role = data.user && data.user.role;
        if (role !== 'admin' && role !== 'super_admin' && role !== 'staff') {
          localStorage.removeItem(TOKEN_KEY);
          showErr('ngoc-login-err', 'Tài khoản không có quyền quản trị.');
          return;
        }
        window.location.href = '/html/index.html#/dashboard';
      } catch (err) {
        showErr('ngoc-login-err', err.message || 'Lỗi mạng');
      }
    });
    return;
  }

  if (path.endsWith('auth-register-basic.html')) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      window.alert('Form đăng ký mẫu Sneat không tạo tài khoản quản trị. Dùng tài khoản admin từ seed (.env / npm run seed).');
    });
    return;
  }

  if (path.endsWith('auth-forgot-password-basic.html')) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      window.alert('Quên mật khẩu chưa được cấu hình trên API.');
    });
  }
})();
