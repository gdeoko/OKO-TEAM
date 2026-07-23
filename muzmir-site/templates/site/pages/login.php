<?php
/**
 * Вход в личный кабинет - 1 клик (ВК / MAX) или почта / телефон.
 * Дизайн V3: премиум-карточка по центру, светлая тема, лого, «Вы», без эмодзи.
 * Соц-вход - через /api/v1/oauth_vk|oauth_max. Почта/телефон - JSON /api/v1/auth_email|auth_phone.
 * Серверный POST email+пароль сохранён как надёжный запасной путь без JavaScript.
 */

// Уже авторизованы - в кабинет.
if (current_user()) redirect('/cabinet');

$next = input('next');
if ($next === '' || $next[0] !== '/' || str_starts_with($next, '//')) $next = '/cabinet';

$email = '';
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $email = input('email');
    $password = (string)($_POST['password'] ?? '');
    if (!csrf_check()) {
        flash('Сессия устарела. Обновите страницу и попробуйте снова.', 'error');
    } elseif (!rate_ok('login:' . client_ip(), 20, 900)) {
        flash('Слишком много попыток входа. Подождите немного и попробуйте снова.', 'error');
    } else {
        $u = attempt_login($email, $password);
        if ($u) {
            login_user((int)$u['id']);
            audit('login', 'user', (int)$u['id']);
            redirect($next);
        }
        flash('Неверная почта или пароль. Проверьте данные и повторите вход.', 'error');
    }
}

// Доступность соц-входа по наличию ключей (иначе - кнопка отключается аккуратно).
$vkReady     = (bool) (cfgv('vk_client_id') && cfgv('vk_client_secret'));
$maxReady    = (bool) (cfgv('max_client_id') && cfgv('max_client_secret'));

// SVG-иконки (без эмодзи, в стиле бренда).
$svgVk     = '<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true"><path d="M13.2 17.4c-5.5 0-8.9-3.8-9-10.1h2.8c.1 4.6 2.2 6.6 3.8 7V7.3h2.6v4c1.6-.2 3.3-2 3.9-4h2.6c-.5 2.5-2.2 4.3-3.4 5 1.2.6 3.2 2.2 3.9 5.1h-2.9c-.6-1.9-2.1-3.4-4.1-3.6v3.6h-.2z"/></svg>';
$svgMax    = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 19V6l8 7 8-7v13"/></svg>';
$svgPhone  = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3.1-8.7A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.7 2z"/></svg>';

ob_start(); ?>
<style>
/* Ровные соц-кнопки: единый ритм, аккуратный перенос длинных подписей */
.auth-social .auth-btn{margin-bottom:0}
.auth-btn span{overflow-wrap:anywhere}
</style>
<section class="section auth-page">
  <div class="container" style="max-width:440px">
    <div class="card reveal auth-shell" style="padding:34px 26px 30px">

      <div class="auth-head" style="text-align:center;margin-bottom:22px">
        <img src="<?= asset('img/logo_muzmir_256.png') ?>" alt="КЦ «Музыкальный Мир»" width="64" height="64"
             style="width:64px;height:64px;border-radius:50%;border:1px solid var(--glass-brd);margin:0 auto 12px;display:block">
        <p class="eyebrow" style="margin-bottom:2px">Личный кабинет</p>
        <h1 style="font-size:1.9rem;margin:0 0 6px">Вход</h1>
        <p style="color:var(--muted);font-size:.9rem;margin:0">Войдите в один клик - мы сохраним Ваши заявки, результаты и наградные документы.</p>
      </div>

      <div class="auth-social" style="display:grid;gap:12px">
        <?php if ($vkReady): ?>
          <a class="auth-btn auth-btn--vk" href="<?= url('/api/v1/oauth_vk') ?>" rel="nofollow"><?= $svgVk ?><span>Войти через ВКонтакте</span></a>
        <?php else: ?>
          <button type="button" class="auth-btn auth-btn--vk" disabled style="opacity:.55;cursor:not-allowed"><?= $svgVk ?><span>Вход через ВКонтакте</span></button>
        <?php endif; ?>
        <?php if ($maxReady): ?>
          <a class="auth-btn auth-btn--max" href="<?= url('/api/v1/oauth_max') ?>" rel="nofollow"><?= $svgMax ?><span>Войти через MAX</span></a>
        <?php else: ?>
          <button type="button" class="auth-btn auth-btn--max" disabled style="opacity:.55;cursor:not-allowed"><?= $svgMax ?><span>Вход через MAX</span></button>
        <?php endif; ?>
      </div>

      <div class="auth-sep"><span>или по почте</span></div>

      <form id="authEmailForm" method="post" action="<?= url('/login') ?>" novalidate>
        <?= csrf_field() ?>
        <input type="hidden" name="next" value="<?= h($next) ?>">
        <div class="field">
          <label for="email">Электронная почта</label>
          <input type="email" id="email" name="email" value="<?= h($email) ?>" placeholder="you@example.ru" autocomplete="email" inputmode="email" required>
        </div>
        <div class="field" data-pass-field>
          <label for="password">Пароль</label>
          <input type="password" id="password" name="password" placeholder="Ваш пароль" autocomplete="current-password" required>
          <div class="hint"><a href="<?= url('/forgot') ?>">Забыли пароль?</a></div>
        </div>
        <button class="btn btn--primary btn--block btn--lg" type="submit">Войти</button>
        <button type="button" class="auth-link" data-code-login
                style="display:block;width:100%;margin-top:12px;background:none;border:none;color:var(--gold-ink);font:inherit;font-size:.86rem;cursor:pointer">
          Войти по коду из письма
        </button>
      </form>

      <div style="margin-top:14px">
        <button type="button" class="auth-btn auth-btn--phone" data-phone-toggle aria-expanded="false" aria-controls="authPhoneForm"><?= $svgPhone ?><span>Войти по телефону</span></button>
      </div>

      <form id="authPhoneForm" novalidate hidden style="margin-top:4px">
        <div class="field">
          <label for="phone">Номер телефона</label>
          <input type="tel" id="phone" name="phone" placeholder="+7 900 000-00-00" autocomplete="tel" inputmode="tel">
        </div>
        <div class="field" data-otp-field hidden>
          <label for="phoneCode">Код из SMS</label>
          <input type="text" id="phoneCode" name="code" placeholder="Код из сообщения" inputmode="numeric" autocomplete="one-time-code" maxlength="6">
        </div>
        <button class="btn btn--primary btn--block btn--lg" type="submit" data-phase="request">Получить код</button>
      </form>

      <p style="text-align:center;margin:22px 0 0;color:var(--muted);font-size:.9rem">
        Нет аккаунта? <a href="<?= url('/register') ?>">Зарегистрируйтесь</a>
      </p>
      <p class="auth-note" style="text-align:center;margin:12px 0 0;color:var(--muted);font-size:.76rem;line-height:1.5">
        Продолжая, Вы принимаете <a href="<?= url('/agreement') ?>">пользовательское соглашение</a> и <a href="<?= url('/privacy') ?>">политику конфиденциальности</a>.
      </p>
    </div>
  </div>
</section>

<script>
(function () {
  'use strict';
  var origin = location.origin;
  function toast(m, t) { if (window.toast) window.toast(m, t || ''); }
  function api(path, body) {
    return fetch(origin + path, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body || {})
    }).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (d) { return { ok: r.ok, status: r.status, data: d }; });
    });
  }
  function done(res) {
    toast('Вход выполнен.', 'success');
    var to = (res.data && res.data.redirect) || '/cabinet';
    setTimeout(function () { location.href = to; }, 500);
  }
  function fail(res, fb) { toast((res && res.data && (res.data.error || res.data.message)) || fb || 'Не удалось выполнить вход.', 'error'); }
  function load(btn, on) { if (!btn) return; btn.classList.toggle('is-loading', on); btn.disabled = on; }

  // --- Почта: пароль (1 клик) или код из письма ---
  var ef = document.getElementById('authEmailForm');
  if (ef) {
    var codeMode = false;
    var pf = ef.querySelector('[data-pass-field]');
    var pass = document.getElementById('password');
    var codeBtn = ef.querySelector('[data-code-login]');
    if (codeBtn) codeBtn.addEventListener('click', function () {
      var em = ef.email.value.trim();
      if (!em) { toast('Введите почту, чтобы получить код.', 'error'); return; }
      this.disabled = true; this.textContent = 'Отправляем код…';
      var self = this;
      api('/api/v1/auth_email', { action: 'request', email: em }).then(function (res) {
        self.disabled = false;
        if (res.ok && res.data && res.data.ok !== false) {
          codeMode = true;
          pf.querySelector('label').textContent = 'Код из письма';
          pass.type = 'text'; pass.value = ''; pass.name = 'code'; pass.required = false;
          pass.setAttribute('inputmode', 'numeric'); pass.placeholder = '6-значный код'; pass.focus();
          var hint = pf.querySelector('.hint'); if (hint) hint.remove();
          self.textContent = 'Отправить код повторно';
          toast('Код отправлен на почту.', 'success');
        } else { self.textContent = 'Войти по коду из письма'; fail(res, 'Не удалось отправить код.'); }
      }).catch(function () { self.disabled = false; self.textContent = 'Войти по коду из письма'; toast('Сеть недоступна.', 'error'); });
    });
    ef.addEventListener('submit', function (e) {
      e.preventDefault();
      var em = ef.email.value.trim();
      if (!em) { toast('Укажите почту.', 'error'); return; }
      var btn = ef.querySelector('button[type="submit"]');
      var body = codeMode
        ? { action: 'verify', email: em, code: pass.value.trim() }
        : { action: 'request', email: em, password: pass.value };
      load(btn, true);
      api('/api/v1/auth_email', body).then(function (res) {
        load(btn, false);
        if (res.ok && res.data && res.data.ok === true) done(res);
        else fail(res);
      }).catch(function () { load(btn, false); ef.submit(); }); // сеть/JSON недоступны - обычный серверный вход
    });
  }

  // --- Телефон: раскрытие + OTP ---
  var toggle = document.querySelector('[data-phone-toggle]');
  var pff = document.getElementById('authPhoneForm');
  if (toggle && pff) {
    toggle.addEventListener('click', function () {
      var open = pff.hidden;
      pff.hidden = !open;
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      if (open) { var i = pff.querySelector('#phone'); if (i) i.focus(); }
    });
    var otp = pff.querySelector('[data-otp-field]');
    var pbtn = pff.querySelector('button[type="submit"]');
    pff.addEventListener('submit', function (e) {
      e.preventDefault();
      var ph = pff.phone.value.trim();
      if (!ph) { toast('Введите номер телефона.', 'error'); return; }
      var phase = pbtn.getAttribute('data-phase');
      if (phase === 'request') {
        load(pbtn, true);
        api('/api/v1/auth_phone', { action: 'request', phone: ph }).then(function (res) {
          load(pbtn, false);
          if (res.ok && res.data && res.data.ok !== false && !res.data.sms_unavailable) {
            otp.hidden = false; pbtn.setAttribute('data-phase', 'verify'); pbtn.textContent = 'Подтвердить и войти';
            var c = document.getElementById('phoneCode'); if (c) c.focus();
            toast('Код отправлен по SMS.', 'success');
          } else if (res.data && res.data.sms_unavailable) {
            toast(res.data.message || 'SMS-вход временно недоступен. Войдите через ВК, MAX или почту.', 'error');
          } else { fail(res, 'Не удалось отправить код.'); }
        }).catch(function () { load(pbtn, false); toast('Сеть недоступна.', 'error'); });
      } else {
        load(pbtn, true);
        api('/api/v1/auth_phone', { action: 'verify', phone: ph, code: document.getElementById('phoneCode').value.trim() }).then(function (res) {
          load(pbtn, false);
          if (res.ok && res.data && res.data.ok === true) done(res); else fail(res);
        }).catch(function () { load(pbtn, false); toast('Сеть недоступна.', 'error'); });
      }
    });
  }
})();
</script>
<?php
$content = ob_get_clean();
render_page('Вход', $content, ['active' => '/login', 'meta' => 'Вход в личный кабинет участника КЦ «Музыкальный Мир».']);
