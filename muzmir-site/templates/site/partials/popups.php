<?php
/**
 * Всплывающие окна и глобальные UX-механики сайта (self-contained).
 * Подключается в layout.php перед </body>. На виджете/TMA/админке НЕ подключается
 * (у них свой layout). Содержит:
 *  1. Cookie / 152-ФЗ баннер согласия на обработку данных.
 *  2. Лид-поп-ап (exit-intent + скролл/таймер): чек-лист подготовки → подписка (core subscribe API, с CSRF).
 *  3. Глобальный обработчик кнопок «Поделиться» ([data-share]) — navigator.share + фолбэк copy.
 *  4. PWA-баннер «Установить приложение» (beforeinstallprompt).
 * Иконки — SVG, без эмодзи. Тема наследуется (светлая по умолчанию + тёмная).
 */
?>
<style>
/* ── Общие слои поверх сайта ── */
.mz-pop,.mz-cookie,.mz-install{font-family:var(--ff-body)}
/* Cookie-баннер */
.mz-cookie{position:fixed;left:16px;right:16px;bottom:16px;z-index:120;max-width:720px;margin:0 auto;
  background:var(--panel,#fff);border:1px solid var(--glass-brd,#e7ddc7);border-radius:var(--radius,16px);
  box-shadow:var(--shadow-card,0 18px 50px rgba(30,25,10,.16));padding:16px 18px;
  display:none;grid-template-columns:1fr auto;gap:14px 18px;align-items:center;backdrop-filter:blur(10px)}
.mz-cookie.on{display:grid;animation:mzUp .4s cubic-bezier(.2,.8,.2,1)}
.mz-cookie p{margin:0;font-size:.9rem;line-height:1.5;color:var(--text-dim,#4a4535)}
.mz-cookie a{color:var(--gold-ink,#8a6d1f);text-decoration:underline}
[data-theme="dark"] .mz-cookie a{color:var(--gold,#e8c25a)}
.mz-cookie .mz-cc-btn{white-space:nowrap}
@media(max-width:560px){.mz-cookie{grid-template-columns:1fr}}

/* Лид-поп-ап */
.mz-pop{position:fixed;inset:0;z-index:130;display:none;align-items:center;justify-content:center;padding:20px;
  background:rgba(20,16,6,.55);backdrop-filter:blur(4px)}
.mz-pop.on{display:flex;animation:mzFade .3s ease}
.mz-pop-card{position:relative;width:min(460px,100%);background:var(--panel,#fff);
  border:1px solid var(--glass-brd,#e7ddc7);border-radius:var(--radius,18px);
  box-shadow:0 30px 80px rgba(20,16,6,.4);padding:30px 26px 26px;overflow:hidden;
  animation:mzPopIn .42s cubic-bezier(.2,.8,.2,1)}
.mz-pop-card::before{content:"";position:absolute;left:50%;top:-40%;width:80%;height:70%;transform:translateX(-50%);
  background:radial-gradient(60% 60% at 50% 50%,var(--gold-soft,rgba(201,168,76,.14)),transparent 70%);pointer-events:none}
.mz-pop-x{position:absolute;top:12px;right:12px;width:34px;height:34px;border-radius:50%;border:none;cursor:pointer;
  background:var(--gold-soft,#f4ecd6);color:var(--gold-ink,#8a6d1f);display:flex;align-items:center;justify-content:center;z-index:2}
.mz-pop-x svg{width:18px;height:18px}
.mz-pop-ic{width:56px;height:56px;border-radius:16px;display:flex;align-items:center;justify-content:center;margin:0 auto 12px;
  background:var(--grad-gold,linear-gradient(135deg,#e6c766,#c9a84c));color:var(--gold-fg,#1a1206);box-shadow:var(--shadow-btn,0 10px 26px rgba(201,168,76,.4))}
.mz-pop-ic svg{width:28px;height:28px}
.mz-pop h3{font-family:var(--ff-display,serif);font-size:1.5rem;line-height:1.15;text-align:center;margin:0 0 8px;
  background:var(--grad-gold-text,linear-gradient(135deg,#b8923a,#8a6d1f));-webkit-background-clip:text;background-clip:text;color:transparent}
.mz-pop p{text-align:center;color:var(--text-dim,#4a4535);font-size:.96rem;line-height:1.55;margin:0 0 18px}
.mz-pop form{display:flex;flex-direction:column;gap:10px}
.mz-pop input[type=email]{width:100%;max-width:100%;padding:14px 16px;border-radius:12px;border:1.5px solid var(--glass-brd,#e7ddc7);
  background:var(--bg,#fffcf5);color:var(--text,#1b2340);font-size:1rem;font-family:inherit}
.mz-pop input[type=email]:focus{outline:2px solid var(--gold,#c9a84c);outline-offset:1px}
.mz-pop .mz-note{font-size:.76rem;color:var(--muted,#8b8straszy);text-align:center;margin:2px 0 0;line-height:1.4}
.mz-pop .mz-ok{text-align:center;color:var(--mint,#5f9e6a);font-weight:700;padding:10px 0}
/* PWA install */
.mz-install{position:fixed;left:16px;right:16px;bottom:16px;z-index:115;max-width:420px;margin:0 auto;
  background:var(--panel,#fff);border:1px solid var(--glass-brd,#e7ddc7);border-radius:14px;box-shadow:var(--shadow-card,0 14px 40px rgba(30,25,10,.16));
  padding:12px 14px;display:none;grid-template-columns:auto 1fr auto;gap:12px;align-items:center}
.mz-install.on{display:grid;animation:mzUp .4s cubic-bezier(.2,.8,.2,1)}
.mz-install img{width:38px;height:38px;border-radius:9px}
.mz-install b{font-size:.9rem;color:var(--text,#1b2340);display:block;line-height:1.2}
.mz-install span{font-size:.76rem;color:var(--muted,#8b8674)}
.mz-install .mz-ib{display:flex;gap:6px}
.mz-install .mz-ix{background:none;border:none;color:var(--muted,#8b8674);cursor:pointer;font-size:1.1rem;padding:0 6px}
/* Share toast */
.mz-toast{position:fixed;left:50%;bottom:24px;transform:translateX(-50%) translateY(20px);z-index:140;
  background:var(--ink,#1b2340);color:#fff;padding:11px 20px;border-radius:999px;font-size:.88rem;font-weight:600;
  box-shadow:0 12px 30px rgba(0,0,0,.28);opacity:0;pointer-events:none;transition:opacity .25s,transform .25s}
.mz-toast.on{opacity:1;transform:translateX(-50%) translateY(0)}
@keyframes mzUp{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:translateY(0)}}
@keyframes mzFade{from{opacity:0}to{opacity:1}}
@keyframes mzPopIn{from{opacity:0;transform:translateY(30px) scale(.96)}to{opacity:1;transform:none}}
@media(prefers-reduced-motion:reduce){.mz-cookie.on,.mz-pop.on,.mz-install.on,.mz-pop-card{animation:none}.mz-toast{transition:opacity .2s}}
</style>

<!-- 1. Cookie / 152-ФЗ -->
<div class="mz-cookie" id="mzCookie" role="dialog" aria-live="polite" aria-label="Использование cookie">
  <p>Мы используем файлы cookie и обрабатываем данные для работы сайта, аналитики и приёма заявок в соответствии с
     <a href="<?= url('/privacy') ?>">Политикой конфиденциальности</a>. Продолжая пользоваться сайтом, Вы соглашаетесь с этим.</p>
  <button class="btn btn--primary mz-cc-btn" type="button" id="mzCookieOk">Принять</button>
</div>

<!-- 2. Лид-поп-ап: чек-лист -->
<div class="mz-pop" id="mzLead" role="dialog" aria-modal="true" aria-labelledby="mzLeadT">
  <div class="mz-pop-card">
    <button class="mz-pop-x" type="button" id="mzLeadX" aria-label="Закрыть">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
    </button>
    <div class="mz-pop-ic" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
    </div>
    <h3 id="mzLeadT">Чек-лист подготовки к конкурсу</h3>
    <p>Оставьте почту — пришлём бесплатный чек-лист «Как записать конкурсный номер и подать заявку без ошибок», а также анонсы новых конкурсов центра.</p>
    <form id="mzLeadForm" novalidate>
      <?= csrf_field() ?>
      <input type="hidden" name="source" value="popup_checklist">
      <input type="email" name="email" placeholder="Ваш e-mail" autocomplete="email" required>
      <button class="btn btn--primary btn--block" type="submit">Получить чек-лист</button>
      <p class="mz-note">Нажимая кнопку, Вы соглашаетесь на обработку персональных данных. Отписаться можно в один клик.</p>
    </form>
    <div class="mz-ok" id="mzLeadOk" hidden>Спасибо! Проверьте почту — чек-лист уже летит к Вам.</div>
  </div>
</div>

<!-- 4. PWA install -->
<div class="mz-install" id="mzInstall" role="dialog" aria-label="Установить приложение">
  <img src="<?= asset('img/logo_muzmir_192.png') ?>" alt="" width="38" height="38">
  <div><b>Установить приложение</b><span>Быстрый доступ к конкурсам с главного экрана</span></div>
  <div class="mz-ib">
    <button class="btn btn--primary" type="button" id="mzInstallGo" style="padding:9px 16px;min-height:auto">Установить</button>
    <button class="mz-ix" type="button" id="mzInstallX" aria-label="Скрыть">×</button>
  </div>
</div>

<div class="mz-toast" id="mzToast" role="status" aria-live="polite"></div>

<script>
(function(){
  var LS = window.localStorage, path = location.pathname || '/';
  function seen(k){ try{return LS.getItem(k)==='1';}catch(e){return false;} }
  function mark(k){ try{LS.setItem(k,'1');}catch(e){} }
  function toast(msg){ var t=document.getElementById('mzToast'); if(!t)return; t.textContent=msg; t.classList.add('on'); setTimeout(function(){t.classList.remove('on');},2200); }

  /* ---- 3. Глобальный «Поделиться» ---- */
  document.addEventListener('click', function(e){
    var b = e.target.closest('[data-share]'); if(!b) return;
    e.preventDefault();
    var dsv = b.getAttribute('data-share') || '';           // некоторые кнопки хранят URL прямо в data-share="..."
    var url = b.getAttribute('data-share-url') || b.getAttribute('data-url') || (/^https?:/.test(dsv) ? dsv : '') || location.href;
    var title = b.getAttribute('data-share-title') || b.getAttribute('data-title') || document.title;
    if(navigator.share){ navigator.share({title:title,url:url}).catch(function(){}); return; }
    if(navigator.clipboard){ navigator.clipboard.writeText(url).then(function(){toast('Ссылка скопирована');},function(){toast(url);}); }
    else { toast(url); }
  }, false);

  /* ---- 1. Cookie 152-ФЗ ---- */
  var ck = document.getElementById('mzCookie');
  if(ck && !seen('mz-cookie-ok')){
    setTimeout(function(){ ck.classList.add('on'); }, 900);
    var okb = document.getElementById('mzCookieOk');
    if(okb) okb.addEventListener('click', function(){ mark('mz-cookie-ok'); ck.classList.remove('on'); });
  }

  /* ---- 2. Лид-поп-ап: exit-intent + скролл/таймер, 1 раз ---- */
  var pop = document.getElementById('mzLead');
  var noLead = /^\/(apply|login|register|cabinet|order-awards|reset-password|forgot|tma|widget)/.test(path);
  if(pop && !seen('mz-lead-seen') && !noLead){
    var shown=false;
    function showLead(){
      if(shown||seen('mz-lead-seen'))return; shown=true; mark('mz-lead-seen');
      pop.classList.add('on');
      var inp=pop.querySelector('input[type=email]'); if(inp) setTimeout(function(){try{inp.focus();}catch(e){}},250);
    }
    function closeLead(){ pop.classList.remove('on'); }
    document.getElementById('mzLeadX').addEventListener('click', closeLead);
    pop.addEventListener('click', function(e){ if(e.target===pop) closeLead(); });
    document.addEventListener('keydown', function(e){ if(e.key==='Escape'&&pop.classList.contains('on')) closeLead(); });
    // триггеры
    var t=setTimeout(showLead, 45000);
    document.addEventListener('mouseout', function(e){ if(e.clientY<=0 && !e.relatedTarget){ showLead(); } });
    window.addEventListener('scroll', function(){
      var sc=(window.scrollY+window.innerHeight)/document.documentElement.scrollHeight;
      if(sc>0.6) showLead();
    }, {passive:true});
    // сабмит
    var f=document.getElementById('mzLeadForm');
    f.addEventListener('submit', function(e){
      e.preventDefault();
      var fd=new FormData(f), btn=f.querySelector('button[type=submit]');
      if(btn){btn.disabled=true;btn.textContent='Отправляем…';}
      fetch('<?= url('/api/v1/subscribe') ?>', {method:'POST', body:fd, headers:{'X-Requested-With':'fetch'}})
        .then(function(r){return r.json().catch(function(){return{};});})
        .then(function(d){
          f.style.display='none';
          var ok=document.getElementById('mzLeadOk'); if(ok) ok.hidden=false;
          setTimeout(closeLead, 2600);
        })
        .catch(function(){ if(btn){btn.disabled=false;btn.textContent='Получить чек-лист';} toast('Не удалось отправить, попробуйте позже'); });
    });
  }

  /* ---- 4. PWA install ---- */
  var deferred=null, inst=document.getElementById('mzInstall');
  window.addEventListener('beforeinstallprompt', function(e){
    e.preventDefault(); deferred=e;
    if(inst && !seen('mz-install-dismissed')){ setTimeout(function(){inst.classList.add('on');}, 6000); }
  });
  if(inst){
    document.getElementById('mzInstallGo').addEventListener('click', function(){
      inst.classList.remove('on');
      if(deferred){ deferred.prompt(); deferred.userChoice.finally(function(){ mark('mz-install-dismissed'); deferred=null; }); }
    });
    document.getElementById('mzInstallX').addEventListener('click', function(){ inst.classList.remove('on'); mark('mz-install-dismissed'); });
  }
})();
</script>
