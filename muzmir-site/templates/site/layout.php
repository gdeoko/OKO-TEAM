<?php
/** Базовый лейаут публичного сайта. Переменные: $title,$content,$meta_description,$og_image,$active. */
$nav = [
  '/' => 'Главная', '/competitions' => 'Конкурсы',
  '/awards' => 'Награды', '/concerts' => 'Концерты', '/about' => 'О нас',
  '/faq' => 'Вопросы', '/contacts' => 'Контакты',
];
$partners = [
  ['emblem_minkultury_rf','Минкультуры РФ','https://culture.gov.ru'],
  ['emblem_minobrazovaniya','Минобрнауки РФ','https://minobrnauki.gov.ru'],
  ['emblem_roskomnadzor','Роскомнадзор','https://rkn.gov.ru'],
  ['prokultura_full_horizontal','PROКультура.РФ','https://pro.culture.ru'],
  ['natsproekty_kultura','Нацпроекты «Культура»','https://национальныепроекты.рф'],
];
$u = current_user();
// Контекст Telegram Mini App: ?tg=1 (кнопка бота) или кука сессии (держит контекст на всех страницах).
$inTg = isset($_GET['tg']) || !empty($_COOKIE['mz_tg']);
// Кол-во непрочитанных уведомлений — бейдж в нижнем меню
$unreadNotif = 0;
if ($u && is_file(BASE_PATH . '/core/notifications.php')) {
    require_once BASE_PATH . '/core/notifications.php';
    $unreadNotif = notify_unread_count((int) $u['id']);
}
?><!doctype html>
<html lang="ru"<?= $inTg ? ' class="in-tg"' : '' ?>>
<head>
<script>document.documentElement.className+=' js';document.documentElement.dataset.theme='light';try{if(!localStorage.getItem('mz-theme-reset-v3')){localStorage.setItem('muzmir-theme','light');localStorage.setItem('mz-theme-reset-v3','1');}var t=localStorage.getItem('muzmir-theme');if(t==='dark')document.documentElement.dataset.theme='dark';}catch(e){}<?php if (!empty($u['music_off'])): ?>window.MZ_MUSIC_OFF=true;<?php endif; ?></script>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<?php
  $canon = rtrim(cfgv('base_url'), '/') . (parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/');
  $full_title = $title . ' — ' . cfgv('org_name');
  $og_img = !empty($og_image) ? $og_image : asset('img/og_muzmir.png');
?>
<title><?= h($full_title) ?></title>
<meta name="description" content="<?= h($meta_description) ?>">
<meta name="theme-color" content="#FFFCF5" id="metaThemeColor">
<script>try{if(document.documentElement.dataset.theme==='dark'){document.getElementById('metaThemeColor').setAttribute('content','#0b0a0d');}}catch(e){}</script>
<link rel="canonical" href="<?= h($canon) ?>">
<meta property="og:title" content="<?= h($full_title) ?>">
<meta property="og:description" content="<?= h($meta_description) ?>">
<meta property="og:image" content="<?= h($og_img) ?>">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:type" content="website">
<meta property="og:url" content="<?= h($canon) ?>">
<meta property="og:site_name" content="<?= h(cfgv('org_name')) ?>">
<meta property="og:locale" content="ru_RU">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="<?= h($full_title) ?>">
<meta name="twitter:description" content="<?= h($meta_description) ?>">
<meta name="twitter:image" content="<?= h($og_img) ?>">
<link rel="icon" href="<?= asset('img/logo_muzmir_256.png') ?>">
<link rel="apple-touch-icon" href="<?= asset('img/logo_muzmir_256.png') ?>">
<link rel="manifest" href="<?= url('manifest.webmanifest') ?>">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&family=Marck+Script&family=Playfair+Display:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
<link rel="preload" as="style" href="<?= asset('css/style.css') ?>">
<link rel="stylesheet" href="<?= asset('css/style.css') ?>">
<style id="mz-critical-nav">
/* CRITICAL: нижнее меню ВСЕГДА закреплено на экране (перекрывает любой кэш style.css). */
html body nav.appnav,
html body nav.appnav.appnav{
  position:fixed !important;
  left:0 !important;
  right:0 !important;
  bottom:0 !important;
  top:auto !important;
  z-index:2147483000 !important;
  display:block !important;
  transform:none !important;
  filter:none !important;
  contain:none !important;
  will-change:auto !important;
  padding:8px max(6px,env(safe-area-inset-left)) calc(8px + env(safe-area-inset-bottom)) max(6px,env(safe-area-inset-right)) !important;
  background:color-mix(in srgb, var(--bg,#fffcf5) 88%, transparent) !important;
  backdrop-filter:blur(14px) saturate(1.2) !important;
  -webkit-backdrop-filter:blur(14px) saturate(1.2) !important;
  border-top:1px solid var(--line,rgba(0,0,0,.08)) !important;
  pointer-events:auto !important;
  visibility:visible !important;
  opacity:1 !important;
}
html body,html.in-tg body{
  padding-bottom:calc(84px + env(safe-area-inset-bottom)) !important;
  /* ВАЖНО: никаких transform/filter/perspective/contain на body — они ломают position:fixed у детей. */
  transform:none !important;
  filter:none !important;
  perspective:none !important;
  contain:none !important;
}
html body main{padding-bottom:calc(24px + env(safe-area-inset-bottom)) !important}
/* CRITICAL: шапка ВСЕГДА закреплена сверху и НЕПРОЗРАЧНА (контент не просвечивает под ней). */
html body header.app-header{
  position:fixed !important;
  top:0 !important; left:0 !important; right:0 !important;
  z-index:2147482000 !important;
  background:var(--bg,#fffcf5) !important;
  border-bottom:1px solid var(--line,rgba(0,0,0,.08)) !important;
  box-shadow:0 2px 14px rgba(20,16,6,.06) !important;
  backdrop-filter:none !important;
  padding-top:calc(6px + env(safe-area-inset-top,0)) !important;
  padding-bottom:6px !important;
  padding-left:env(safe-area-inset-left,0) !important;
  padding-right:env(safe-area-inset-right,0) !important;
  transform:none !important;
}
[data-theme="dark"] html body header.app-header,
html[data-theme="dark"] body header.app-header{background:#141019 !important;border-bottom-color:rgba(232,194,90,.14) !important}
/* Отступ сверху под фиксированную шапку */
html body{padding-top:calc(58px + env(safe-area-inset-top,0)) !important}
</style>
</head>
<body<?= $u ? ' class="is-auth"' : '' ?>>
<div class="app-bg" aria-hidden="true"></div>

<header class="header app-header"><div class="container">
  <a class="brand" href="<?= url('/') ?>">
    <img src="<?= asset('img/logo_muzmir_256.png') ?>" alt="Логотип КЦ «Музыкальный Мир»" width="40" height="40">
    <span>Музыкальный<br>Мир</span>
  </a>
  <div class="app-header-actions">
    <a class="app-icon-btn" href="<?= url('/menu') ?>#menuSearch" aria-label="Поиск по разделам" title="Поиск">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>
    </a>
    <?php if ($u): ?>
      <a class="app-icon-btn" href="<?= url('/notifications') ?>" aria-label="Уведомления" title="Уведомления">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0"/></svg>
        <?php if ($unreadNotif > 0): ?><span class="app-icon-badge"><?= $unreadNotif > 9 ? '9+' : (int)$unreadNotif ?></span><?php endif; ?>
      </a>
    <?php endif; ?>
  </div>
</div></header>

<main>
<?php foreach (flashes() as [$type, $msg]): ?>
  <div class="container" style="margin-top:16px"><div class="flash flash--<?= h($type) ?>"><?= h($msg) ?></div></div>
<?php endforeach; ?>
<?= $content ?>
</main>

<?php /* Footer убран — приложение без подвала, вся навигация в нижнем меню и /menu */ ?>

<nav class="appnav" aria-label="Нижняя навигация">
  <div class="appnav-inner">
    <span class="appnav-ind" aria-hidden="true"></span>
    <a href="<?= url('/') ?>" class="<?= $active==='/'?'active':'' ?>">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/></svg>Главная</a>
    <a href="<?= url('/menu') ?>" class="<?= $active==='/menu'?'active':'' ?>">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>Меню</a>
    <a href="<?= url('/apply') ?>" class="appnav-cta<?= $active==='/apply'?' active':'' ?>" aria-label="Подать заявку">
      <span class="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M12 5v14M5 12h14"/></svg></span>Заявка</a>
    <a href="<?= url('/awards') ?>" class="<?= $active==='/awards'?'active':'' ?>">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3"/></svg>Награды</a>
    <a href="<?= url($u ? '/cabinet' : '/login') ?>" class="<?= in_array($active,['/cabinet','/login','/register','/notifications'])?'active':'' ?>">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg><?= $u?'Профиль':'Вход' ?>
      <?php if ($unreadNotif > 0): ?><span class="appnav-badge" title="Непрочитанных уведомлений: <?= (int)$unreadNotif ?>"><?= $unreadNotif > 99 ? '99+' : (int)$unreadNotif ?></span><?php endif; ?>
    </a>
  </div>
</nav>

<a class="chat-fab" id="chatFab" href="https://t.me/kc_muz_mir_bot" target="_blank" rel="noopener" aria-label="Поддержка в Telegram" title="Написать в Telegram-бот">
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 2 11 13M22 2l-7 20-4-9-9-4z"/></svg>
</a>

<?php /* auth-modal удалён — теперь /login отдельная страница с тем же анимационным фоном */ ?>

<?php
  // JSON-LD: организация (глобально) из cfgv().
  $addrParts = array_map('trim', explode(',', (string) cfgv('org_address')));
  $postal    = (isset($addrParts[0]) && ctype_digit($addrParts[0])) ? $addrParts[0] : '125009';
  $locality  = isset($addrParts[1]) ? preg_replace('/^г\.?\s*/u', '', $addrParts[1]) : 'Москва';
  $street    = trim(implode(', ', array_slice($addrParts, (isset($addrParts[0]) && ctype_digit($addrParts[0])) ? 2 : 1)));
  $org_ld = [
    '@context'   => 'https://schema.org',
    '@type'      => 'Organization',
    'name'       => cfgv('org_name'),
    'legalName'  => 'Культурный центр «Музыкальный Мир»',
    'url'        => rtrim(cfgv('base_url'), '/') . '/',
    'logo'       => asset('img/logo_muzmir_main.png'),
    'telephone'  => cfgv('org_phone_raw'),
    'email'      => cfgv('org_email'),
    'address'    => [
      '@type'           => 'PostalAddress',
      'postalCode'      => $postal,
      'addressLocality' => $locality,
      'streetAddress'   => $street !== '' ? $street : 'ул. Солянка, д.14, стр.7',
      'addressCountry'  => 'RU',
    ],
    'sameAs'     => array_values(array_filter([cfgv('org_vk'), cfgv('org_tg_channel')])),
  ];
?>
<script type="application/ld+json"><?= json_encode($org_ld, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) ?></script>
<?php if (!empty($jsonld)): ?>
  <?php if (is_string($jsonld)): ?>
<script type="application/ld+json"><?= $jsonld ?></script>
  <?php else: ?>
    <?php
      $ld_items = (isset($jsonld['@context']) || isset($jsonld['@type'])) ? [$jsonld] : $jsonld;
      foreach ($ld_items as $ld_obj):
        if (!is_array($ld_obj)) continue; ?>
<script type="application/ld+json"><?= json_encode($ld_obj, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) ?></script>
    <?php endforeach; ?>
  <?php endif; ?>
<?php endif; ?>

<?php if (cfgv('metrika_id')): ?>
<script>(function(m,e,t,r,i,k,a){m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};m[i].l=1*new Date();for(var j=0;j<document.scripts.length;j++){if(document.scripts[j].src===r){return}}k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)})(window,document,"script","https://mc.yandex.ru/metrika/tag.js","ym");ym(<?= (int)cfgv('metrika_id') ?>,"init",{clickmap:true,trackLinks:true,accurateTrackBounce:true});</script>
<?php endif; ?>
<?php require BASE_PATH . '/templates/site/partials/popups.php'; ?>
<script>
// Приём сигнала от свежего SW: если SW обновился — перезагружаем страницу автоматически (1 раз).
if('serviceWorker' in navigator){
  navigator.serviceWorker.addEventListener('message',function(e){
    if(e&&e.data&&e.data.type==='mz-sw-reload'){
      if(!sessionStorage.getItem('mz-sw-reloaded')){sessionStorage.setItem('mz-sw-reloaded','1');location.reload();}
    }
  });
}
// Страховка нижнего меню: если какой-то скрипт/стиль перебил fixed — переприменяем каждые 500 мс первые 3 сек.
(function(){
  var tries = 0;
  function reassert(){
    var el = document.querySelector('.appnav'); if(!el) return;
    var st = getComputedStyle(el);
    if (st.position !== 'fixed') {
      el.style.setProperty('position','fixed','important');
      el.style.setProperty('left','0','important');
      el.style.setProperty('right','0','important');
      el.style.setProperty('bottom','0','important');
      el.style.setProperty('z-index','2147483000','important');
      el.style.setProperty('display','block','important');
    }
  }
  var iv = setInterval(function(){ reassert(); if(++tries>=6) clearInterval(iv); }, 500);
  window.addEventListener('load', reassert);
  document.addEventListener('mz-spa-navigate', reassert);
})();

// Клавиатура: при фокусе на input/textarea — прячем appnav (не поднимается с клавиатурой)
(function(){
  var kbSel = 'input:not([type=checkbox]):not([type=radio]):not([type=file]):not([type=submit]):not([type=button]),textarea,[contenteditable="true"]';
  function onFocusIn(e){ if(e.target && e.target.matches && e.target.matches(kbSel)){ document.body.classList.add('mz-kbd-open'); } }
  function onFocusOut(e){
    setTimeout(function(){
      var a=document.activeElement;
      if(!a || !a.matches || !a.matches(kbSel)) document.body.classList.remove('mz-kbd-open');
    }, 60);
  }
  document.addEventListener('focusin', onFocusIn);
  document.addEventListener('focusout', onFocusOut);
  // Дублируем через visualViewport (Android/iOS)
  if(window.visualViewport){
    var vv = window.visualViewport;
    vv.addEventListener('resize', function(){
      var kbUp = (window.innerHeight - vv.height) > 140;
      document.body.classList.toggle('mz-kbd-open', kbUp);
    });
  }
})();

// Авто +7 для телефона: любое поле type=tel или name=phone стартует с +7, ввод только цифр
(function(){
  function fmtRu(v){
    var d = v.replace(/\D/g,'');
    if(d.length>0 && d[0]==='8') d = '7' + d.slice(1);
    if(d.length>0 && d[0]!=='7') d = '7' + d;
    d = d.slice(0,11);
    var r = '+7';
    if(d.length>1) r += ' ('+d.slice(1,4);
    if(d.length>=5) r += ') '+d.slice(4,7);
    if(d.length>=8) r += '-'+d.slice(7,9);
    if(d.length>=10) r += '-'+d.slice(9,11);
    return r;
  }
  function bind(el){
    if(!el || el.dataset.tel7) return; el.dataset.tel7='1';
    el.setAttribute('inputmode','tel');
    if(!el.value) el.value = '+7 (';
    el.addEventListener('focus', function(){ if(!el.value || el.value.length<3) el.value='+7 ('; });
    el.addEventListener('input', function(){ el.value = fmtRu(el.value); });
    el.addEventListener('blur', function(){ if(el.value==='+7' || el.value==='+7 (' ) el.value=''; });
    el.addEventListener('keydown', function(e){
      if(e.key==='Backspace' && (el.value.length<=4)){ e.preventDefault(); el.value=''; }
    });
  }
  function scan(root){
    var els = (root||document).querySelectorAll('input[type=tel],input[name=phone],input[name*=phone i],input[data-tel]');
    els.forEach(bind);
  }
  scan(document);
  document.addEventListener('mz-spa-navigate', function(){ scan(document); });
  new MutationObserver(function(muts){ muts.forEach(function(m){ if(m.addedNodes){ m.addedNodes.forEach(function(n){ if(n.nodeType===1) scan(n); }); } }); }).observe(document.body,{childList:true,subtree:true});
})();

// Валидации live: email, url — красная рамка при невалидном значении
(function(){
  function validEmail(v){ return /^[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}$/i.test(v.trim()); }
  function validUrl(v){ try{ var u=new URL(v.trim().startsWith('http')?v.trim():'https://'+v.trim()); return !!u.hostname && u.hostname.indexOf('.')>0; }catch(e){return false;} }
  function mark(el, ok){ el.classList.toggle('is-invalid', !ok && el.value.trim()!==''); }
  function bind(el){
    if(el.dataset.vlBound) return; el.dataset.vlBound='1';
    var kind = (el.type==='email'||/mail/i.test(el.name)) ? 'email'
             : (el.type==='url' ||/(url|link|ссыл)/i.test(el.name)) ? 'url' : '';
    if(!kind) return;
    el.addEventListener('blur', function(){ mark(el, kind==='email' ? validEmail(el.value) : validUrl(el.value)); });
    el.addEventListener('input', function(){ if(el.classList.contains('is-invalid')) mark(el, kind==='email' ? validEmail(el.value) : validUrl(el.value)); });
  }
  function scan(root){ (root||document).querySelectorAll('input').forEach(bind); }
  scan(document);
  document.addEventListener('mz-spa-navigate', function(){ scan(document); });
})();
</script>
<script src="<?= asset('js/app.js') ?>" defer></script>
<script src="<?= asset('js/music.js') ?>" defer></script>
<script src="<?= asset('js/spa.js') ?>" defer></script>
<script src="<?= asset('js/motion.js') ?>" defer></script>
<script src="<?= asset('js/funnel.js') ?>" defer></script>
<?php if ($inTg): ?>
<!-- Telegram Mini App: тот же сайт открывается нативно в боте (автологин, тема, expand, back). -->
<script>
(function(){
  document.documentElement.classList.add('in-tg');
  try{ document.cookie = 'mz_tg=1; path=/; max-age=86400; samesite=lax'; }catch(e){}
  function init(){
    var tg = window.Telegram && window.Telegram.WebApp; if(!tg) return;
    try{ tg.ready(); tg.expand && tg.expand(); }catch(e){}
    // Тема — светлая по умолчанию всегда (не подхватываем TG dark-scheme).
    try{ if(!localStorage.getItem('muzmir-theme')){ document.documentElement.dataset.theme='light'; localStorage.setItem('muzmir-theme','light'); } }catch(e){}
    // Кнопка «назад» Telegram
    try{ if(tg.BackButton){ if(location.pathname!=='/' ) tg.BackButton.show(); else tg.BackButton.hide();
      tg.BackButton.onClick(function(){ if(history.length>1) history.back(); else { location.href='/?tg=1'; } }); } }catch(e){}
    // Автологин по initData (один раз за запуск), если не авторизован
    try{
      if(tg.initData && !document.body.classList.contains('is-auth') && !sessionStorage.getItem('mz_tg_auth')){
        sessionStorage.setItem('mz_tg_auth','1');
        fetch('/api/v1/tma_auth',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:'initData='+encodeURIComponent(tg.initData)})
          .then(function(r){return r.json();}).then(function(d){ if(d&&d.ok){ location.reload(); } }).catch(function(){});
      }
    }catch(e){}
  }
  if(window.Telegram && window.Telegram.WebApp){ init(); }
  else { var s=document.createElement('script'); s.src='https://telegram.org/js/telegram-web-app.js'; s.async=true; s.onload=init; document.head.appendChild(s); }
})();
</script>
<?php endif; ?>
</body>
</html>
