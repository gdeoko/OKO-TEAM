<?php
/**
 * Регистрация — пошаговая форма с OTP-верификацией почты.
 * 1) Ввод email → отправка 6-значного кода через /api/v1/auth_email (action=request)
 * 2) Ввод кода → верификация → сразу создаёт profile и логинит
 * 3) Настройка профиля (ФИО, никнейм, категория, аватар) — редактируется в /cabinet#settings позже
 * Альтернативы: ВК / MAX / телефон.
 */
if (current_user()) redirect('/cabinet');

$vkReady  = (bool) (cfgv('vk_client_id') && cfgv('vk_client_secret'));
$maxReady = (bool) (cfgv('max_client_id') && cfgv('max_client_secret'));

$svgVk    = '<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true"><path d="M13.2 17.4c-5.5 0-8.9-3.8-9-10.1h2.8c.1 4.6 2.2 6.6 3.8 7V7.3h2.6v4c1.6-.2 3.3-2 3.9-4h2.6c-.5 2.5-2.2 4.3-3.4 5 1.2.6 3.2 2.2 3.9 5.1h-2.9c-.6-1.9-2.1-3.4-4.1-3.6v3.6h-.2z"/></svg>';
$svgMax   = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M4 19V6l8 6 8-6v13"/></svg>';
$svgPhone = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L20 13l2 4v3a1 1 0 0 1-1 1A17 17 0 0 1 4 5a1 1 0 0 1 1-1z"/></svg>';
$svgMail  = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/></svg>';

ob_start(); ?>
<section class="section auth-page">
  <div class="container" style="max-width:460px">
    <div class="reveal in auth-shell" id="regShell">
      <div class="auth-head" style="text-align:center;margin-bottom:22px">
        <img src="<?= asset('img/logo_muzmir_256.png') ?>" alt="Культурного центра «Музыкальный Мир»" width="72" height="72"
             style="width:72px;height:72px;border-radius:50%;border:1px solid var(--glass-brd);margin:0 auto 14px;display:block;filter:drop-shadow(0 8px 20px rgba(201,168,76,.28))">
        <p class="eyebrow eyebrow--script" style="margin-bottom:2px">Присоединяйтесь</p>
        <h1 style="font-size:1.9rem;margin:0 0 6px;background:var(--grad-gold);-webkit-background-clip:text;background-clip:text;color:transparent">Регистрация</h1>
        <p style="color:var(--muted);font-size:.92rem;margin:0">Создайте профиль за 30 секунд — код на почту, никакого пароля запоминать не нужно.</p>
      </div>

      <!-- Шаги -->
      <div class="reg-steps" role="tablist" aria-label="Шаги регистрации">
        <span class="reg-step is-on" data-step="method">1</span>
        <span class="reg-line"></span>
        <span class="reg-step" data-step="code">2</span>
        <span class="reg-line"></span>
        <span class="reg-step" data-step="profile">3</span>
      </div>

      <!-- Шаг 1: выбор метода -->
      <div class="reg-panel is-on" data-panel="method">
        <div class="auth-social" style="display:grid;gap:10px">
          <?php if ($vkReady): ?>
            <a class="auth-btn auth-btn--vk" href="<?= url('/api/v1/oauth_vk') ?>" rel="nofollow"><?= $svgVk ?><span>Через ВКонтакте</span></a>
          <?php endif; ?>
        </div>

        <?php if ($vkReady || $maxReady): ?><div class="auth-sep"><span>или почта / телефон</span></div><?php endif; ?>

        <form id="regEmailForm" novalidate>
          <div class="field">
            <label for="reg_email">Электронная почта</label>
            <input type="email" id="reg_email" name="email" placeholder="ваша@почта.рф" autocomplete="email" inputmode="email" required>
            <div class="hint">Пришлём 6-значный код для подтверждения — пароль настроите потом.</div>
          </div>
          <button class="btn btn--primary btn--block btn--lg" type="submit"><?= $svgMail ?> Отправить код</button>
        </form>

        <details class="reg-phone">
          <summary><?= $svgPhone ?> Регистрация по телефону</summary>
          <form id="regPhoneForm" novalidate style="margin-top:10px">
            <div class="field">
              <label for="reg_phone">Номер телефона</label>
              <input type="tel" id="reg_phone" name="phone" placeholder="+7 (___) ___-__-__" autocomplete="tel" inputmode="tel">
              <div class="hint">Мы отправим SMS с кодом.</div>
            </div>
            <button class="btn btn--primary btn--block" type="submit"><?= $svgPhone ?> Отправить SMS</button>
          </form>
        </details>

        <p class="auth-note" style="text-align:center;margin-top:16px;color:var(--muted);font-size:.8rem">
          Нажимая, Вы принимаете <a href="<?= url('/agreement') ?>">пользовательское соглашение</a> и <a href="<?= url('/privacy') ?>">политику конфиденциальности</a>.
        </p>
        <p class="auth-note" style="text-align:center;margin-top:8px">
          Уже есть аккаунт? <a href="<?= url('/login') ?>" style="color:var(--gold-ink);font-weight:700">Войти</a>
        </p>
      </div>

      <!-- Шаг 2: ввод кода -->
      <div class="reg-panel" data-panel="code">
        <p style="color:var(--muted);font-size:.94rem;text-align:center;margin:0 0 20px">
          Код отправлен на <b id="regEmailShown" style="color:var(--gold-ink)"></b>.<br>
          Введите 6 цифр из письма (проверьте «Спам» если не пришло).
        </p>
        <form id="regCodeForm" novalidate>
          <div class="field code-field">
            <input type="text" id="reg_code" name="code" inputmode="numeric" pattern="\d{6}" maxlength="6" autocomplete="one-time-code" placeholder="000000" required>
          </div>
          <button class="btn btn--primary btn--block btn--lg" type="submit">Подтвердить код</button>
          <div style="display:flex;justify-content:space-between;margin-top:10px;font-size:.86rem">
            <a href="#" data-back-method style="color:var(--muted)">← Другая почта</a>
            <a href="#" data-resend-code style="color:var(--gold-ink);font-weight:700">Отправить ещё раз</a>
          </div>
          <div id="regResendCd" style="text-align:right;color:var(--muted);font-size:.78rem;margin-top:4px"></div>
        </form>
      </div>

      <!-- Шаг 3: имя + категория + аватар -->
      <div class="reg-panel" data-panel="profile">
        <p style="color:var(--muted);font-size:.94rem;text-align:center;margin:0 0 16px">
          Отлично, аккаунт создан! Заполните профиль — это можно всегда изменить в настройках.
        </p>
        <form id="regProfileForm" novalidate action="<?= url('/cabinet') ?>" method="post" enctype="multipart/form-data">
          <?= csrf_field() ?>
          <input type="hidden" name="action" value="profile">
          <input type="hidden" id="regAvaHidden" name="avatar" value="">
          <div class="cab-avaedit">
            <div class="cab-ava" id="regAvaPreview" style="width:76px;height:76px;font-size:1.6rem" data-init="?"></div>
            <label class="btn btn--ghost btn--sm" for="regAvaFile" style="cursor:pointer;flex:1;text-align:center;min-height:44px;display:flex;align-items:center;justify-content:center">Загрузить фото</label>
            <input type="file" id="regAvaFile" accept="image/*" hidden>
          </div>
          <div class="field">
            <label for="reg_fio">Фамилия, имя, отчество</label>
            <input type="text" id="reg_fio" name="full_name" placeholder="Иванова Мария Петровна" autocomplete="name" required>
          </div>
          <div class="field">
            <label for="reg_nick">Никнейм</label>
            <input type="text" id="reg_nick" name="nickname" placeholder="как обращаться" maxlength="30">
          </div>
          <div class="field">
            <label for="reg_promo">Промокод педагога (если есть)</label>
            <input type="text" id="reg_promo" name="promo_code" placeholder="Например, ABCD1234" maxlength="16" autocapitalize="characters" style="text-transform:uppercase">
            <div class="hint">Подставится автоматически при подаче заявки — участник получит скидку.</div>
          </div>
          <div class="field">
            <label>Категория</label>
            <div class="cat-picker">
              <label class="cat-opt is-on"><input type="radio" name="category" value="participant" checked><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg><span>Участник</span></label>
              <label class="cat-opt"><input type="radio" name="category" value="teacher"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l10 5-10 5L2 8z"/><path d="M6 10v6a6 6 0 0 0 12 0v-6"/></svg><span>Педагог</span></label>
              <label class="cat-opt"><input type="radio" name="category" value="parent"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.4"/><path d="M2 21a7 7 0 0 1 14 0M13 21a5 5 0 0 1 9 0"/></svg><span>Родитель</span></label>
              <label class="cat-opt"><input type="radio" name="category" value="other"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9 9a3 3 0 0 1 6 0c0 2-3 2.5-3 4M12 17h.01"/></svg><span>Другое</span></label>
            </div>
          </div>
          <button class="btn btn--primary btn--block btn--lg" type="submit">Готово — в кабинет</button>
        </form>
      </div>
    </div>
  </div>
</section>

<script>
(function(){
  var shell = document.getElementById('regShell');
  var steps = {method: 0, code: 1, profile: 2};
  function goto(step){
    shell.querySelectorAll('.reg-panel').forEach(function(p){ p.classList.toggle('is-on', p.getAttribute('data-panel')===step); });
    shell.querySelectorAll('.reg-step').forEach(function(s){
      var i = steps[s.getAttribute('data-step')];
      s.classList.toggle('is-on', i === steps[step]);
      s.classList.toggle('is-done', i < steps[step]);
    });
  }

  var pendingEmail = '';
  function apiEmail(action, data){
    var body = new URLSearchParams();
    body.set('action', action);
    Object.keys(data||{}).forEach(function(k){ body.set(k, data[k]); });
    return fetch('/api/v1/auth_email', {method:'POST', credentials:'same-origin', body:body, headers:{'Content-Type':'application/x-www-form-urlencoded'}}).then(function(r){return r.json();});
  }

  document.getElementById('regEmailForm').addEventListener('submit', function(e){
    e.preventDefault();
    var em = document.getElementById('reg_email').value.trim();
    if (!/^[^@]+@[^@]+\.[a-z]{2,}$/i.test(em)) { alert('Проверьте email'); return; }
    var btn = e.target.querySelector('button[type=submit]');
    btn.disabled = true; btn.textContent = 'Отправляем…';
    apiEmail('request', {email: em}).then(function(d){
      btn.disabled = false; btn.innerHTML = 'Отправить код';
      if (!d.ok) { alert(d.error || 'Ошибка. Попробуйте позже.'); return; }
      pendingEmail = em;
      document.getElementById('regEmailShown').textContent = em;
      goto('code');
      startResendCd();
      setTimeout(function(){ document.getElementById('reg_code').focus(); }, 200);
    });
  });

  document.querySelector('[data-back-method]').addEventListener('click', function(e){e.preventDefault(); goto('method');});

  var cdIv = null, cdLeft = 60;
  function startResendCd(){
    cdLeft = 60;
    var box = document.getElementById('regResendCd');
    var link = document.querySelector('[data-resend-code]');
    link.style.pointerEvents = 'none'; link.style.opacity = '.4';
    if (cdIv) clearInterval(cdIv);
    cdIv = setInterval(function(){
      cdLeft--;
      if (cdLeft <= 0) { clearInterval(cdIv); box.textContent = ''; link.style.pointerEvents = ''; link.style.opacity = ''; return; }
      box.textContent = 'Повторно можно через ' + cdLeft + ' с';
    }, 1000);
  }
  document.querySelector('[data-resend-code]').addEventListener('click', function(e){
    e.preventDefault();
    if (!pendingEmail) return;
    apiEmail('request', {email: pendingEmail}).then(function(){ startResendCd(); });
  });

  document.getElementById('regCodeForm').addEventListener('submit', function(e){
    e.preventDefault();
    var code = document.getElementById('reg_code').value.trim();
    if (!/^\d{6}$/.test(code)) { alert('Введите 6 цифр'); return; }
    var btn = e.target.querySelector('button[type=submit]');
    btn.disabled = true; btn.textContent = 'Проверяем…';
    apiEmail('verify', {email: pendingEmail, code: code}).then(function(d){
      btn.disabled = false; btn.innerHTML = 'Подтвердить код';
      if (!d.ok) { alert(d.error || 'Код неверный или устарел'); return; }
      // Успех — авторизация установлена сервером. Переходим к шагу 3.
      goto('profile');
      var e2 = pendingEmail;
      document.getElementById('regAvaPreview').setAttribute('data-init', e2[0].toUpperCase());
      document.getElementById('regAvaPreview').textContent = e2[0].toUpperCase();
    });
  });

  // Category picker
  shell.querySelectorAll('.cat-opt input').forEach(function(inp){
    inp.addEventListener('change', function(){
      shell.querySelectorAll('.cat-opt').forEach(function(l){l.classList.remove('is-on');});
      inp.closest('.cat-opt').classList.add('is-on');
    });
  });
  // Avatar
  var af = document.getElementById('regAvaFile'), ah = document.getElementById('regAvaHidden'), ap = document.getElementById('regAvaPreview');
  if (af) af.addEventListener('change', function(){
    var f = af.files[0]; if (!f) return;
    if (f.size > 3*1024*1024) { alert('Файл слишком большой (макс 3 МБ)'); return; }
    var fr = new FileReader();
    fr.onload = function(){
      var img = new Image();
      img.onload = function(){
        var c = document.createElement('canvas');
        var scale = 512 / Math.max(img.width, img.height);
        c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        var b64 = c.toDataURL('image/jpeg', .85);
        ah.value = b64;
        ap.innerHTML = '<img src="'+b64+'" alt="Аватар" loading="lazy">';
      };
      img.src = fr.result;
    };
    fr.readAsDataURL(f);
  });
  // Init preview from email
  document.getElementById('reg_email') && document.getElementById('reg_email').addEventListener('blur', function(){
    var v = this.value.trim();
    if (v && ap.textContent === '?') ap.textContent = v[0].toUpperCase();
  });
  // Промокод: префилл из ?promo=/localStorage, сохранение в localStorage для автоподстановки в заявке.
  (function(){
    var pf = document.getElementById('reg_promo'); if (!pf) return;
    try {
      var qp = new URLSearchParams(location.search);
      var code = (qp.get('promo') || qp.get('ref') || qp.get('code') || localStorage.getItem('muzmir_ref_code') || '').toUpperCase().replace(/[^A-Z0-9]/g,'');
      if (code) pf.value = code;
    } catch(e){}
    pf.addEventListener('input', function(){
      var c = this.value.toUpperCase().replace(/[^A-Z0-9]/g,'');
      try { if (c) localStorage.setItem('muzmir_ref_code', c); } catch(e){}
    });
  })();
})();
</script>
<?php
$content = ob_get_clean();
render_page('Регистрация', $content, ['active' => '/register', 'meta' => 'Регистрация в Культурного центра «Музыкальный Мир»: код на почту без пароля, ВК, MAX, телефон. Профиль за 30 секунд.']);
