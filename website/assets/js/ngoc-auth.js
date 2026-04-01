/**
 * Đăng nhập & Đăng ký: hai tab → POST /api/auth/entry
 */
(function () {
  const API = '/api';
  const TOKEN_KEY = 'ngoc_customer_token';
  const USER_KEY = 'ngoc_customer_user';
  const PROFILE_URL = '/profile/';
  const LOGIN_URL = '/my-account/';
  const LOGOUT_API = '/auth/logout';
  const MENU_ID = 'ngoc-account-menu';

  function getToken() {
    return localStorage.getItem(TOKEN_KEY);
  }

  async function logout() {
    try {
      await fetch(API + LOGOUT_API, { method: 'POST', credentials: 'include' });
    } catch (_) {}
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    window.location.href = '/';
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

  function setAccountMenuLoggedIn(user) {
    const name = (user && (user.full_name || user.username || user.email)) ? (user.full_name || user.username || user.email) : 'Tài khoản';
    document.querySelectorAll('a.nasa-login-register-ajax').forEach(function (a) {
      a.setAttribute('href', PROFILE_URL);
      a.setAttribute('title', 'Hồ sơ cá nhân');
      // Disable theme's "login/register ajax" behavior when logged in
      a.setAttribute('data-enable', '0');
      const t = a.querySelector('.nasa-login-title');
      if (t) t.textContent = 'Hồ sơ';
      // also update aria text if any
      if (!t && a.textContent) a.textContent = 'Hồ sơ';
      a.setAttribute('data-ngoc-auth', 'logged-in');
      a.setAttribute('data-ngoc-user', name);
    });
  }

  function setAccountMenuLoggedOut() {
    document.querySelectorAll('a.nasa-login-register-ajax').forEach(function (a) {
      a.setAttribute('href', LOGIN_URL);
      a.setAttribute('title', 'Đăng nhập / Đăng ký');
      a.setAttribute('data-enable', '1');
      const t = a.querySelector('.nasa-login-title');
      if (t) t.textContent = 'Đăng nhập / Đăng ký';
      a.removeAttribute('data-ngoc-auth');
      a.removeAttribute('data-ngoc-user');
    });
  }

  function ensureMenuCss() {
    if (document.getElementById('ngoc-account-menu-css')) return;
    const st = document.createElement('style');
    st.id = 'ngoc-account-menu-css';
    st.textContent =
      '#' +
      MENU_ID +
      '{position:absolute;z-index:99999;min-width:220px;background:#fff;border:1px solid rgba(0,0,0,.08);box-shadow:0 18px 50px rgba(0,0,0,.18);border-radius:14px;padding:8px;backdrop-filter:saturate(120%);}' +
      '#' +
      MENU_ID +
      ' a,#' +
      MENU_ID +
      ' button{display:flex;align-items:center;gap:10px;width:100%;padding:12px 12px;border-radius:12px;border:none;background:transparent;color:#111827;text-align:left;cursor:pointer;font-weight:700;font-size:14px;line-height:1.15;}' +
      '#' +
      MENU_ID +
      ' a:hover,#' +
      MENU_ID +
      ' button:hover{background:rgba(0,0,0,.04);}' +
      '#' +
      MENU_ID +
      ' .muted{font-weight:500;font-size:12px;color:rgba(17,24,39,.62);margin-top:4px;}' +
      '#' +
      MENU_ID +
      ' .danger{color:#b91c1c;}' +
      '#' +
      MENU_ID +
      ' .row{display:flex;flex-direction:column;}' +
      '#' +
      MENU_ID +
      ' .hr{height:1px;background:rgba(0,0,0,.06);margin:6px 8px;}';
    document.head.appendChild(st);
  }

  function closeAccountMenu() {
    const el = document.getElementById(MENU_ID);
    if (el) el.remove();
  }

  function openAccountMenu(anchor) {
    closeAccountMenu();
    ensureMenuCss();

    const user = getCachedUser() || {};
    const wrap = document.createElement('div');
    wrap.id = MENU_ID;
    wrap.innerHTML =
      '<a href="' +
      PROFILE_URL +
      '" data-ngoc-menu="profile">' +
      '<span class="row"><span>Hồ sơ</span><span class="muted">Cập nhật & bổ sung thông tin</span></span>' +
      '</a>' +
      '<div class="hr"></div>' +
      '<button type="button" class="danger" data-ngoc-menu="logout">' +
      '<span class="row"><span>Đăng xuất</span><span class="muted">' +
      (user.email ? String(user.email) : 'Kết thúc phiên đăng nhập') +
      '</span></span>' +
      '</button>';

    document.body.appendChild(wrap);

    const r = anchor.getBoundingClientRect();
    const top = r.bottom + window.scrollY + 8;
    let left = r.left + window.scrollX;
    // keep within viewport
    const maxLeft = window.scrollX + window.innerWidth - wrap.offsetWidth - 10;
    if (left > maxLeft) left = Math.max(10 + window.scrollX, maxLeft);
    wrap.style.top = top + 'px';
    wrap.style.left = left + 'px';

    wrap.addEventListener('click', function (ev) {
      const t = ev.target && ev.target.closest ? ev.target.closest('[data-ngoc-menu]') : null;
      if (!t) return;
      const act = t.getAttribute('data-ngoc-menu');
      if (act === 'logout') {
        ev.preventDefault();
        logout();
      } else {
        closeAccountMenu();
      }
    });

    // close on outside click / escape
    setTimeout(function () {
      const onDoc = function (ev) {
        const inMenu = ev.target && ev.target.closest && ev.target.closest('#' + MENU_ID);
        const inAnchor = ev.target && ev.target.closest && ev.target.closest('a.nasa-login-register-ajax');
        if (!inMenu && !inAnchor) closeAccountMenu();
      };
      const onKey = function (ev) {
        if (ev.key === 'Escape') closeAccountMenu();
      };
      document.addEventListener('click', onDoc, true);
      document.addEventListener('keydown', onKey, true);
      // auto-clean listeners when menu closes
      const obs = new MutationObserver(function () {
        if (!document.getElementById(MENU_ID)) {
          document.removeEventListener('click', onDoc, true);
          document.removeEventListener('keydown', onKey, true);
          obs.disconnect();
        }
      });
      obs.observe(document.body, { childList: true, subtree: true });
    }, 0);
  }

  function noticeForForm(form) {
    const modal = form.closest('#nasa-login-register-form');
    if (modal) {
      const el = modal.querySelector('.nasa-message');
      if (el) return el;
    }
    const woo = form.closest('.woocommerce');
    if (woo) {
      let n = woo.querySelector('.woocommerce-notices-wrapper');
      if (!n) {
        n = document.createElement('div');
        n.className = 'woocommerce-notices-wrapper';
        woo.insertBefore(n, woo.firstChild);
      }
      return n;
    }
    return document.querySelector('.woocommerce-notices-wrapper');
  }

  function showMsg(form, text, isErr) {
    const wrap = noticeForForm(form);
    const html =
      '<ul class="woocommerce-' + (isErr ? 'error' : 'message') + '" role="alert"><li>' + text + '</li></ul>';
    if (wrap) {
      wrap.innerHTML = html;
      wrap.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    } else window.alert(text);
  }

  async function api(path, body) {
    const r = await fetch(API + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      credentials: 'include'
    });
    let data = {};
    try {
      data = await r.json();
    } catch (_) {}
    if (!r.ok) {
      const err = new Error(data.error || r.statusText || 'Lỗi');
      err.status = r.status;
      throw err;
    }
    return data;
  }

  function applySession(form, d) {
    localStorage.setItem(TOKEN_KEY, d.token);
    localStorage.setItem(USER_KEY, JSON.stringify(d.user));
    var ok =
      d.mode === 'register'
        ? 'Đăng ký thành công. Chào mừng bạn!'
        : d.mode === 'login'
          ? 'Đăng nhập thành công.'
          : 'Thành công.';
    showMsg(form, ok, false);
    const closeBtn = document.querySelector('.login-register-close, .nasa-close-login');
    setTimeout(function () {
      if (closeBtn) closeBtn.click();
      // Immediately reflect login state in header menu, then reload for pages that depend on session.
      setAccountMenuLoggedIn(d.user);
      window.location.reload();
    }, 400);
  }

  function buildSimpleForm() {
    const wrap = document.createElement('div');
    wrap.className = 'ngoc-auth-simple-outer';
    wrap.setAttribute('style', 'max-width:420px;margin:0 auto;padding:8px 4px;');
    wrap.innerHTML =
      '<div class="ngoc-auth-tabs" style="display:flex;margin:0 0 16px;border-radius:8px;overflow:hidden;border:1px solid #e0e0e0;">' +
      '<button type="button" class="ngoc-auth-tab" data-ngoc-tab="login" style="flex:1;padding:12px 8px;border:none;background:#696cff;color:#fff;font-weight:600;cursor:pointer;font-size:14px;">Đăng nhập</button>' +
      '<button type="button" class="ngoc-auth-tab" data-ngoc-tab="register" style="flex:1;padding:12px 8px;border:none;background:#f5f5f9;color:#566a7f;cursor:pointer;font-size:14px;">Đăng ký</button>' +
      '</div>' +
      '<div class="ngoc-auth-panel ngoc-auth-panel-login">' +
      '<form class="ngoc-auth-form ngoc-auth-form-login woocommerce-form" novalidate>' +
      '<p class="form-row form-row-wide">' +
      '<label class="left rtl-right" style="display:block;margin-bottom:6px;">Email <span class="required">*</span></label>' +
      '<input type="email" class="woocommerce-Input input-text ngoc-auth-email" required autocomplete="email" />' +
      '</p>' +
      '<p class="form-row form-row-wide">' +
      '<label class="left rtl-right" style="display:block;margin-bottom:6px;">Mật khẩu <span class="required">*</span></label>' +
      '<input type="password" class="woocommerce-Input input-text ngoc-auth-password" required minlength="6" autocomplete="current-password" />' +
      '</p>' +
      '<p class="form-row">' +
      '<button type="submit" class="woocommerce-button button woocommerce-Button nasa-fullwidth">Đăng nhập</button>' +
      '</p>' +
      '</form>' +
      '</div>' +
      '<div class="ngoc-auth-panel ngoc-auth-panel-register" style="display:none;">' +
      '<form class="ngoc-auth-form ngoc-auth-form-register woocommerce-form" novalidate>' +
      '<p class="form-row form-row-wide">' +
      '<label class="left rtl-right" style="display:block;margin-bottom:6px;">Email <span class="required">*</span></label>' +
      '<input type="email" class="woocommerce-Input input-text ngoc-auth-email" required autocomplete="email" />' +
      '</p>' +
      '<p class="form-row form-row-wide">' +
      '<label class="left rtl-right" style="display:block;margin-bottom:6px;">Mật khẩu <span class="required">*</span></label>' +
      '<input type="password" class="woocommerce-Input input-text ngoc-auth-password" required minlength="6" autocomplete="new-password" />' +
      '</p>' +
      '<p class="form-row form-row-wide">' +
      '<label class="left rtl-right" style="display:block;margin-bottom:6px;">Nhập lại mật khẩu <span class="required">*</span></label>' +
      '<input type="password" class="woocommerce-Input input-text ngoc-auth-password2" required minlength="6" autocomplete="new-password" />' +
      '</p>' +
      '<p class="form-row">' +
      '<button type="submit" class="woocommerce-button button woocommerce-Button nasa-fullwidth">Đăng ký tài khoản</button>' +
      '</p>' +
      '</form>' +
      '</div>' +
      '<p style="font-size:11px;color:#a0aec0;margin-top:12px;line-height:1.4;text-align:center;">Dùng email chưa đăng ký ở tab Đăng ký để tạo tài khoản mới.</p>';
    return wrap;
  }

  function switchTab(outer, mode) {
    const loginBtn = outer.querySelector('.ngoc-auth-tab[data-ngoc-tab="login"]');
    const regBtn = outer.querySelector('.ngoc-auth-tab[data-ngoc-tab="register"]');
    const pLogin = outer.querySelector('.ngoc-auth-panel-login');
    const pReg = outer.querySelector('.ngoc-auth-panel-register');
    if (!pLogin || !pReg) return;
    const active = '#696cff';
    const idle = '#f5f5f9';
    const activeFg = '#fff';
    const idleFg = '#566a7f';
    if (mode === 'login') {
      pLogin.style.display = 'block';
      pReg.style.display = 'none';
      if (loginBtn) {
        loginBtn.style.background = active;
        loginBtn.style.color = activeFg;
      }
      if (regBtn) {
        regBtn.style.background = idle;
        regBtn.style.color = idleFg;
      }
    } else {
      pLogin.style.display = 'none';
      pReg.style.display = 'block';
      if (loginBtn) {
        loginBtn.style.background = idle;
        loginBtn.style.color = idleFg;
      }
      if (regBtn) {
        regBtn.style.background = active;
        regBtn.style.color = activeFg;
      }
    }
  }

  function mountModal() {
    document.querySelectorAll('#nasa-login-register-form').forEach(function (root) {
      if (root.querySelector('.ngoc-auth-simple-outer')) return;
      const row = root.querySelector('#nasa_customer_login');
      const content = root.querySelector('.nasa-form-content');
      if (!content) return;
      if (row) row.setAttribute('hidden', 'hidden');
      if (row) row.style.display = 'none';
      const wrap = buildSimpleForm();
      content.insertBefore(wrap, content.firstChild);
      switchTab(wrap, 'login');
    });
  }

  function mountMyAccount() {
    const row = document.querySelector('#customer_login');
    if (!row) return;
    if (document.querySelector('.page-wrapper.my-account .ngoc-auth-simple-outer')) return;
    const woo = row.closest('.woocommerce');
    if (!woo) return;
    row.setAttribute('hidden', 'hidden');
    row.style.display = 'none';
    const wrap = buildSimpleForm();
    const notices = woo.querySelector('.woocommerce-notices-wrapper');
    if (notices) {
      notices.parentNode.insertBefore(wrap, notices.nextSibling);
    } else {
      woo.insertBefore(wrap, woo.firstChild);
    }
    switchTab(wrap, 'login');
  }

  async function onSubmit(e) {
    const form = e.target;
    if (!(form instanceof HTMLFormElement) || !form.classList.contains('ngoc-auth-form')) return;
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();

    const emailEl = form.querySelector('.ngoc-auth-email');
    const passEl = form.querySelector('.ngoc-auth-password');
    const email = ((emailEl && emailEl.value) || '').trim().toLowerCase();
    const password = ((passEl && passEl.value) || '').trim();

    if (!email || !password) {
      showMsg(form, 'Nhập email và mật khẩu.', true);
      return;
    }
    if (password.length < 6) {
      showMsg(form, 'Mật khẩu ít nhất 6 ký tự.', true);
      return;
    }

    if (form.classList.contains('ngoc-auth-form-register')) {
      const p2 = form.querySelector('.ngoc-auth-password2');
      const again = ((p2 && p2.value) || '').trim();
      if (again !== password) {
        showMsg(form, 'Hai lần nhập mật khẩu phải giống nhau.', true);
        return;
      }
    }

    const btn = form.querySelector('button[type="submit"]');
    const prev = btn ? btn.textContent : '';
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Đang xử lý...';
    }
    try {
      const intent = form.classList.contains('ngoc-auth-form-register') ? 'register' : 'login';
      const d = await api('/auth/entry', { identifier: email, password, intent });
      applySession(form, d);
    } catch (err) {
      showMsg(form, err.message || 'Không thực hiện được.', true);
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = prev;
      }
    }
  }

  function onClickTab(e) {
    const tab = e.target && e.target.closest ? e.target.closest('.ngoc-auth-tab') : null;
    if (!tab) return;
    const mode = tab.getAttribute('data-ngoc-tab');
    const outer = tab.closest('.ngoc-auth-simple-outer');
    if (!outer || !mode) return;
    e.preventDefault();
    switchTab(outer, mode);
  }

  function init() {
    mountModal();
    mountMyAccount();
    document.addEventListener('submit', onSubmit, true);
    document.addEventListener('click', onClickTab, true);

    // Ensure header account menu reflects current auth state on every page.
    const t = getToken();
    if (t) setAccountMenuLoggedIn(getCachedUser());
    else setAccountMenuLoggedOut();

    // When logged in: clicking the account link opens a 2-item menu (Profile / Logout).
    document.addEventListener(
      'click',
      function (ev) {
        const a = ev.target && ev.target.closest ? ev.target.closest('a.nasa-login-register-ajax') : null;
        if (!a) return;
        if (a.getAttribute('data-ngoc-auth') !== 'logged-in') return;
        ev.preventDefault();
        ev.stopPropagation();
        ev.stopImmediatePropagation();
        openAccountMenu(a);
      },
      true
    );

    document.addEventListener(
      'click',
      function (ev) {
        const t = ev.target;
        if (!t || !t.closest) return;
        if (
          t.closest('.nasa-login-register-ajax') ||
          t.closest('.nasa-switch-register') ||
          t.closest('.nasa-switch-login') ||
          t.closest('#nasa-login-register-form .login-register-close')
        ) {
          setTimeout(function () {
            mountModal();
            document.querySelectorAll('#nasa-login-register-form .ngoc-auth-simple-outer').forEach(function (w) {
              switchTab(w, 'login');
            });
          }, 100);
        }
      },
      true
    );
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
