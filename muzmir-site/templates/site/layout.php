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
  ['prokultura_full_horizontal','Про.Культура.РФ','https://pro.culture.ru'],
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
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover,interactive-widget=resizes-visual">
<?php
  $canon = rtrim(cfgv('base_url'), '/') . (parse_url($_SERVER['REQUEST_URI'] ?? '/', PHP_URL_PATH) ?: '/');
  $full_title = $title . ' — ' . cfgv('org_name');
  $og_img = !empty($og_image) ? $og_image : asset('img/og_muzmir.png');
?>
<title><?= h($full_title) ?></title>
<meta name="description" content="<?= h($meta_description) ?>">
<meta name="theme-color" content="#FAF4E6" id="metaThemeColor">
<script>try{if(document.documentElement.dataset.theme==='dark'){document.getElementById('metaThemeColor').setAttribute('content','#0A1330');}}catch(e){}</script>
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
  z-index:900 !important;
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
/* Клавиатура открыта — нижнее меню уезжает вниз (не «повисает» посередине над клавой). */
html body.mz-kb nav.appnav,html body.mz-kb nav.appnav.appnav{transform:translateY(130%) !important;transition:transform .18s ease}
/* CRITICAL: шапка STICKY сверху (в потоке — НЕ перекрывает контент), непрозрачная. */
html body header.app-header{
  position:sticky !important;
  top:0 !important;
  z-index:900 !important;
  background:color-mix(in srgb, var(--bg,#faf4e6) 78%, transparent) !important;
  border-bottom:1px solid var(--glass-brd,rgba(180,130,28,.3)) !important;
  box-shadow:0 4px 22px rgba(21,34,76,.08) !important;
  backdrop-filter:blur(16px) saturate(1.35) !important;
  -webkit-backdrop-filter:blur(16px) saturate(1.35) !important;
  margin:0 !important;
  padding-top:calc(6px + env(safe-area-inset-top,0)) !important;
  padding-bottom:6px !important;
  padding-left:env(safe-area-inset-left,0) !important;
  padding-right:env(safe-area-inset-right,0) !important;
  transform:none !important;
}
[data-theme="dark"] html body header.app-header,
html[data-theme="dark"] body header.app-header{background:color-mix(in srgb,#0C1738 76%,transparent) !important;border-bottom-color:rgba(226,190,96,.20) !important}
/* Никакого padding-top на body — sticky-шапка сама занимает место */
html body{padding-top:0 !important}
/* ПК ≥1024px: НИЖНЕЕ меню остаётся (как в приложении) — центрированный «док».
   Верхние ссылки-меню в шапке прячем: структура ровно как в мобильной версии,
   только шире. Контент — шире по ширине экрана (см. .container ниже). */
@media(min-width:1024px){
  html body nav.appnav,html body nav.appnav.appnav{
    left:50% !important;right:auto !important;transform:translateX(-50%) !important;
    bottom:16px !important;width:min(640px,86vw) !important;top:auto !important;
    border:1px solid var(--line,rgba(0,0,0,.12)) !important;border-radius:24px !important;
    box-shadow:0 18px 50px rgba(21,34,76,.22) !important;
    padding:8px 18px calc(8px + env(safe-area-inset-bottom)) !important}
  html body.mz-kb nav.appnav,html body.mz-kb nav.appnav.appnav{transform:translateX(-50%) translateY(170%) !important}
  header.app-header .pc-nav{display:none !important}
  html body{padding-bottom:calc(100px + env(safe-area-inset-bottom)) !important}
  html body main{padding-bottom:calc(44px + env(safe-area-inset-bottom)) !important}
}
/* Шире контент на больших экранах — меньше пустых полей по краям. */
@media(min-width:1440px){ .container{max-width:1360px} }
@media(min-width:1720px){ .container{max-width:1520px} }
@media(min-width:2200px){ .container{max-width:1680px} }
</style>
</head>
<body<?= $u ? ' class="is-auth"' : '' ?>>
<div class="app-bg" aria-hidden="true">
  <!-- Тёмная тема: реальное видео Земли из космоса -->
  <video class="bg-earth" autoplay muted loop playsinline preload="auto" disablepictureinpicture>
    <source src="<?= url('/assets/video/bg/earth.mp4') ?>" type="video/mp4">
  </video>
  <!-- Светлая тема: реальное небо + настоящие облака (без радуги) -->
  <div class="bg-sky"></div>
  <div class="bg-clouds">
    <span class="bg-cloud bg-cloud--1"></span>
    <span class="bg-cloud bg-cloud--2"></span>
    <span class="bg-cloud bg-cloud--3"></span>
  </div>
  <!-- Затемняющая вуаль для читаемости текста -->
  <div class="bg-scrim"></div>
  <!-- Оверлей «магии»: ноты, звёзды, кометы -->
  <canvas id="mzBgArt"></canvas>
</div>
<style id="mz-bgart-css">
.app-bg{position:fixed;inset:0;z-index:-1;overflow:hidden;background:#0C1738}
:root:not([data-theme="dark"]) .app-bg{background:#BFDDF3}
.app-bg #mzBgArt{position:absolute;inset:0;width:100%;height:100%;display:block;z-index:4}
/* ── Тёмная тема: видео настоящей Земли ── */
.bg-earth{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;z-index:1;opacity:0;transition:opacity .9s ease}
[data-theme="dark"] .bg-earth{opacity:1}
/* ── Светлая тема: небо-градиент + облака ── */
.bg-sky{position:absolute;inset:0;z-index:1;opacity:1;transition:opacity .9s ease;
  background:linear-gradient(180deg,#8FC3EC 0%,#A9D2F0 34%,#CDE6F6 68%,#EAF4FB 100%)}
[data-theme="dark"] .bg-sky{opacity:0}
.bg-clouds{position:absolute;inset:0;z-index:2;overflow:hidden;opacity:1;transition:opacity .9s ease}
[data-theme="dark"] .bg-clouds{opacity:0}
.bg-cloud{position:absolute;background-image:url('<?= url('/assets/img/bg/clouds.png') ?>');
  background-size:contain;background-repeat:no-repeat;background-position:center;will-change:transform;pointer-events:none}
.bg-cloud--1{width:min(70vw,820px);height:44vh;left:-14vw;bottom:6vh;opacity:.9;animation:bgCloud1 90s ease-in-out infinite}
.bg-cloud--2{width:min(60vw,700px);height:38vh;right:-12vw;top:8vh;opacity:.8;animation:bgCloud2 120s ease-in-out infinite}
.bg-cloud--3{width:min(50vw,600px);height:32vh;left:22vw;top:34vh;opacity:.55;animation:bgCloud3 150s ease-in-out infinite}
@keyframes bgCloud1{0%,100%{transform:translateX(-4vw)}50%{transform:translateX(10vw)}}
@keyframes bgCloud2{0%,100%{transform:scaleX(-1) translateX(-3vw)}50%{transform:scaleX(-1) translateX(-11vw)}}
@keyframes bgCloud3{0%,100%{transform:translateX(0)}50%{transform:translateX(-9vw)}}
/* ── Вуаль читаемости: чуть темнит видео/небо ── */
.bg-scrim{position:absolute;inset:0;z-index:3;pointer-events:none;
  background:radial-gradient(120% 90% at 50% 12%,rgba(12,23,56,0) 0%,rgba(12,23,56,.28) 100%)}
:root:not([data-theme="dark"]) .bg-scrim{background:linear-gradient(180deg,rgba(255,255,255,.10) 0%,rgba(255,255,255,.30) 100%)}
@media(prefers-reduced-motion:reduce){.bg-cloud{animation:none !important}}
.app-bg-video,.ab-rays,.ab-glow,.ab-stars,.ab-fly,.app-bg-tint{display:none !important}
</style>
<script src="<?= asset('js/bg-art.js') ?>" defer></script>

<header class="header app-header"><div class="container">
  <a class="brand" href="<?= url('/') ?>">
    <img src="<?= asset('img/logo_muzmir_256.png') ?>" alt="Логотип Культурного центра «Музыкальный Мир»" width="40" height="40">
    <span>Музыкальный<br>Мир</span>
  </a>
  <?php $act = $active ?? ''; ?>
  <nav class="pc-nav" aria-label="Основная навигация">
    <a href="<?= url('/') ?>" class="<?= $act === '/' ? 'is-active' : '' ?>">Главная</a>
    <a href="<?= url('/competitions') ?>" class="<?= $act === '/competitions' ? 'is-active' : '' ?>">Афиша</a>
    <a href="<?= url('/apply') ?>" class="<?= $act === '/apply' ? 'is-active' : '' ?>">Подать заявку</a>
    <a href="<?= url('/awards') ?>" class="<?= $act === '/awards' ? 'is-active' : '' ?>">Награды</a>
    <a href="<?= url('/calendar') ?>" class="<?= $act === '/calendar' ? 'is-active' : '' ?>">Календарь</a>
    <a href="<?= url('/club') ?>" class="<?= $act === '/club' ? 'is-active' : '' ?>">ВИП-клуб</a>
    <a href="<?= url($u ? '/cabinet' : '/login') ?>" class="<?= in_array($act, ['/cabinet','/login','/register','/notifications'], true) ? 'is-active' : '' ?>"><?= $u ? 'Профиль' : 'Вход' ?></a>
  </nav>
  <div class="app-header-actions">
    <a class="app-icon-btn" href="<?= url('/menu') ?>#menuSearch" aria-label="Поиск по разделам" title="Поиск">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>
    </a>
    <a class="app-icon-btn" href="<?= url('/chat') ?>" aria-label="Чат поддержки" title="Чат поддержки">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.8a8.3 8.3 0 0 1-8.5 8.2 8.9 8.9 0 0 1-3.8-.8l-5.2 1.2 1.2-4.9a8.1 8.1 0 0 1-1.2-4.2A8.3 8.3 0 0 1 12 3.5a8.3 8.3 0 0 1 9 8.3z"/></svg>
      <span class="app-icon-badge" id="chatBadge" style="display:none">1</span>
    </a>
    <button type="button" class="app-icon-btn" id="themeToggle" aria-label="Сменить тему" title="Тёмная / светлая тема">
      <svg class="ic-moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>
      <svg class="ic-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" style="display:none"><circle cx="12" cy="12" r="4.5"/><path d="M12 2v2M12 20v2M4 12H2M22 12h-2M5 5l1.4 1.4M17.6 17.6L19 19M5 19l1.4-1.4M17.6 6.4L19 5"/></svg>
    </button>
    <?php /* Колокольчик показываем всегда; для гостя ведёт на вход. */ ?>
      <a class="app-icon-btn" href="<?= url($u ? '/notifications' : '/login') ?>" aria-label="Уведомления" title="Уведомления">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0"/></svg>
        <?php if ($u && $unreadNotif > 0): ?><span class="app-icon-badge"><?= $unreadNotif > 9 ? '9+' : (int)$unreadNotif ?></span><?php endif; ?>
      </a>
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

<?php /* Плавающая ВК-иконка убрана (мешала) — ВКонтакте остаётся ссылкой в разделе «Контакты». */ ?>

<?php /* Фоновая музыка играет всегда (music.js), без видимого плеера. Выключить — в настройках профиля. */ ?>

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
    'sameAs'     => array_values(array_filter([cfgv('org_vk')])),
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

// Нижнее меню прибито к низу. Когда открыта экранная клавиатура — уводим его
// вниз (класс mz-kb), чтобы оно не «поднималось» и не висело посередине над клавой.
// Детект по visualViewport: высота видимой области заметно меньше окна = клавиатура.
(function(){
  var vv = window.visualViewport; if(!vv) return;
  var body = document.body;
  function upd(){
    var kbOpen = (window.innerHeight - vv.height) > 140; // порог ~клавиатура
    body.classList.toggle('mz-kb', kbOpen);
  }
  vv.addEventListener('resize', upd);
  vv.addEventListener('scroll', upd);
  upd();
})();

// Плавная прокрутка к якорям на той же странице (кнопки «К оплате», якоря
// календаря и т.п.), с учётом высоты залипающей шапки. Надёжнее нативной.
(function(){
  function headerH(){ var h=document.querySelector('header.app-header'); return h?h.getBoundingClientRect().height:60; }
  document.addEventListener('click', function(e){
    var a = e.target.closest && e.target.closest('a[href^="#"]');
    if(!a) return;
    var id = a.getAttribute('href');
    if(!id || id === '#' || id.length < 2) return;
    var target;
    try { target = document.querySelector(id); } catch(_){ return; }
    if(!target) return;
    e.preventDefault();
    var y = target.getBoundingClientRect().top + window.pageYOffset - headerH() - 12;
    window.scrollTo({ top: Math.max(0, y), behavior: 'smooth' });
    if(history.replaceState) history.replaceState(null, '', id);
  }, false);
})();

// Переключатель темы в шапке (тёмная/светлая), сохраняется в localStorage.
(function(){
  var btn = document.getElementById('themeToggle'); if(!btn) return;
  function sync(){
    var dark = document.documentElement.dataset.theme === 'dark';
    var moon = btn.querySelector('.ic-moon'), sun = btn.querySelector('.ic-sun');
    if(moon) moon.style.display = dark ? 'none' : '';
    if(sun) sun.style.display = dark ? '' : 'none';
    var mtc = document.getElementById('metaThemeColor');
    if(mtc) mtc.setAttribute('content', dark ? '#0A1330' : '#FAF4E6');
  }
  sync();
  btn.addEventListener('click', function(){
    var dark = document.documentElement.dataset.theme === 'dark';
    var next = dark ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    try{ localStorage.setItem('muzmir-theme', next); }catch(e){}
    sync();
  });
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

/* Всплывающее чат-приветствие убрано по просьбе владельца (мешало). Чат
   доступен из иконки в шапке и из нижнего меню. */
</script>
<script src="<?= asset('js/app.js') ?>" defer></script>
<script src="<?= asset('js/music.js') ?>" defer></script>
<script src="<?= asset('js/spa.js') ?>" defer></script>
<script src="<?= asset('js/motion.js') ?>" defer></script>
<script src="<?= asset('js/funnel.js') ?>" defer></script>
</body>
</html>
