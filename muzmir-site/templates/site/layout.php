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
?><!doctype html>
<html lang="ru"<?= $inTg ? ' class="in-tg"' : '' ?>>
<head>
<script>document.documentElement.className+=' js';try{document.documentElement.dataset.theme=localStorage.getItem('muzmir-theme')||'light';}catch(e){document.documentElement.dataset.theme='light';}</script>
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
<style>
.header{padding-top:env(safe-area-inset-top,0);padding-left:env(safe-area-inset-left,0);padding-right:env(safe-area-inset-right,0)}
.appnav{padding-bottom:env(safe-area-inset-bottom,0);padding-left:env(safe-area-inset-left,0);padding-right:env(safe-area-inset-right,0)}
</style>
</head>
<body<?= $u ? ' class="is-auth"' : '' ?>>
<div class="bg-fx" aria-hidden="true"></div>
<div class="topbar"><div class="container">
  <a href="tel:<?= h(cfgv('org_phone_raw')) ?>"><?= h(cfgv('org_phone')) ?></a>
  <span><?= h(cfgv('org_reg')) ?></span>
</div></div>

<header class="header"><div class="container">
  <a class="brand" href="<?= url('/') ?>">
    <img src="<?= asset('img/logo_muzmir_256.png') ?>" alt="Логотип КЦ «Музыкальный Мир»" width="44" height="44">
    <span>Музыкальный<br>Мир</span>
  </a>
  <nav class="nav" id="nav">
    <?php foreach ($nav as $href => $label): ?>
      <a href="<?= url($href) ?>" class="<?= $active === $href ? 'active' : '' ?>"><?= h($label) ?></a>
    <?php endforeach; ?>
    <div class="nav-cta-mobile">
      <?php if ($u): ?>
        <a class="btn btn--ghost" href="<?= url('/cabinet') ?>">Кабинет</a>
        <?php if (user_can('moderator')): ?><a class="btn btn--primary" href="<?= url('/admin') ?>">Панель управления</a><?php endif; ?>
      <?php else: ?>
        <button type="button" class="btn btn--ghost" data-auth-open aria-haspopup="dialog" aria-controls="authModal">Войти</button>
        <a class="btn btn--primary" href="<?= url('/apply') ?>">Подать заявку</a>
      <?php endif; ?>
    </div>
  </nav>
  <div class="nav-actions">
    <button class="theme-toggle" id="themeToggle" aria-label="Сменить тему" title="Сменить тему">
      <svg class="icon-moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>
    </button>
    <?php if ($u): ?>
      <a class="btn btn--ghost" href="<?= url('/cabinet') ?>">Кабинет</a>
      <?php if (user_can('moderator')): ?><a class="btn btn--primary" href="<?= url('/admin') ?>">Админка</a><?php endif; ?>
    <?php else: ?>
      <button type="button" class="btn btn--ghost" data-auth-open aria-haspopup="dialog" aria-controls="authModal">Войти</button>
      <a class="btn btn--primary" href="<?= url('/apply') ?>">Подать заявку</a>
    <?php endif; ?>
    <button class="burger" id="burger" aria-label="Меню" aria-controls="nav" aria-expanded="false"><span></span><span></span><span></span></button>
  </div>
</div></header>

<main>
<?php foreach (flashes() as [$type, $msg]): ?>
  <div class="container" style="margin-top:16px"><div class="flash flash--<?= h($type) ?>"><?= h($msg) ?></div></div>
<?php endforeach; ?>
<?= $content ?>
</main>

<footer class="footer"><div class="container">
  <div class="footer-grid">
    <div class="footer-brand">
      <img src="<?= asset('img/logo_muzmir_256.png') ?>" alt="Логотип" width="56" height="56">
      <p><?= h(cfgv('org_full')) ?></p>
      <p style="opacity:.7;font-size:.85rem"><?= h(cfgv('org_reg')) ?></p>
    </div>
    <div>
      <h4>Разделы</h4>
      <ul>
        <?php foreach (['/competitions'=>'Конкурсы','/apply'=>'Подать заявку','/awards'=>'Награды','/order-awards'=>'Заказ наград','/concerts'=>'Концерты','/blog'=>'Блог','/about'=>'О нас'] as $hr=>$lb): ?>
          <li><a href="<?= url($hr) ?>"><?= h($lb) ?></a></li>
        <?php endforeach; ?>
      </ul>
    </div>
    <div>
      <h4>Информация</h4>
      <ul>
        <li><a href="<?= url('/goals') ?>">Цели и задачи</a></li>
        <li><a href="<?= url('/ministry-support') ?>">Поддержка министерства</a></li>
        <li><a href="<?= url('/faq') ?>">Вопросы и ответы</a></li>
        <li><a href="<?= url('/reviews') ?>">Отзывы</a></li>
        <li><a href="<?= url('/agreement') ?>">Пользовательское соглашение</a></li>
        <li><a href="<?= url('/privacy') ?>">Политика конфиденциальности</a></li>
      </ul>
    </div>
    <div>
      <h4>Контакты</h4>
      <ul>
        <li><?= h(cfgv('org_address')) ?></li>
        <li><a href="tel:<?= h(cfgv('org_phone_raw')) ?>"><?= h(cfgv('org_phone')) ?></a></li>
        <li><a href="mailto:<?= h(cfgv('org_email')) ?>"><?= h(cfgv('org_email')) ?></a></li>
        <li><?= h(cfgv('org_hours')) ?></li>
        <li><a href="<?= h(cfgv('org_vk')) ?>" target="_blank" rel="noopener">ВКонтакте</a> · <a href="<?= h(cfgv('org_tg_channel')) ?>" target="_blank" rel="noopener">Telegram</a></li>
      </ul>
    </div>
  </div>
  <div class="footer-partners">
    <?php foreach ($partners as [$img,$alt,$link]): ?>
      <a href="<?= h($link) ?>" target="_blank" rel="noopener" title="<?= h($alt) ?>"><img src="<?= asset('img/'.$img.'.webp') ?>" alt="<?= h($alt) ?>" loading="lazy"></a>
    <?php endforeach; ?>
  </div>
  <div class="footer-bottom">
    <span>© <?= h(cfgv('year')) ?> <?= h(cfgv('org_full')) ?></span>
    <span>При информационной поддержке Министерств культуры и образования субъектов Российской Федерации</span>
  </div>
</div></footer>

<nav class="appnav" aria-label="Нижняя навигация">
  <div class="appnav-inner">
    <span class="appnav-ind" aria-hidden="true"></span>
    <a href="<?= url('/') ?>" class="<?= $active==='/'?'active':'' ?>">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/></svg>Главная</a>
    <a href="<?= url('/awards') ?>" class="<?= $active==='/awards'?'active':'' ?>">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="12" cy="8" r="6"/><path d="M8.2 13.9 7 22l5-3 5 3-1.2-8.1"/></svg>Награды</a>
    <a href="<?= url('/competitions') ?>" class="appnav-cta" aria-label="Конкурсы и подача заявки">
      <span class="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3"/></svg></span>Конкурсы</a>
    <a href="#" data-sections-open class="<?= in_array($active,['/concerts','/about','/faq','/contacts','/reviews','/ministry-support','/blog','/gala','/calendar','/club','/goals'])?'active':'' ?>" aria-label="Все разделы сайта">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>Разделы</a>
    <a href="<?= url($u ? '/cabinet' : '/login') ?>" class="<?= in_array($active,['/cabinet','/login'])?'active':'' ?>">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg><?= $u?'Кабинет':'Вход' ?></a>
  </div>
</nav>
<?php require BASE_PATH . '/templates/site/partials/sections_menu.php'; ?>

<button class="chat-fab" id="chatFab" aria-label="Поддержка">
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 11.5a8.38 8.38 0 0 1-8.5 8.5 8.5 8.5 0 0 1-3.8-.9L3 21l1.9-5.7A8.5 8.5 0 1 1 21 11.5z"/></svg>
</button>

<?php if (!$u): ?>
<div class="auth-modal" id="authModal" hidden role="dialog" aria-modal="true" aria-labelledby="authTitle">
  <div class="auth-overlay" data-auth-close></div>
  <div class="auth-card" role="document">
    <button type="button" class="auth-close" data-auth-close aria-label="Закрыть">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 6l12 12M18 6L6 18"/></svg>
    </button>
    <div class="auth-head">
      <img src="<?= asset('img/logo_muzmir_256.png') ?>" alt="" width="48" height="48">
      <h2 id="authTitle">Вход в личный кабинет</h2>
      <p>Войдите удобным способом - мы сохраним Ваши заявки и награды.</p>
    </div>

    <div class="auth-social">
      <a class="auth-btn auth-btn--vk" href="<?= url('/api/v1/oauth_vk.php') ?>" rel="nofollow">
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12.8 16.9c-5.4 0-8.9-3.8-9-10h2.8c.1 4.5 2.1 6.4 3.6 6.8V6.9h2.6v3.9c1.5-.2 3-1.9 3.6-3.9h2.6c-.4 2.4-2 4.1-3.2 4.8 1.2.6 3 2.1 3.7 4.2h-2.9c-.5-1.6-1.9-2.9-3.8-3.1v3.1h-.6z"/></svg>
        <span>Войти через ВКонтакте</span>
      </a>
      <a class="auth-btn auth-btn--max" href="<?= url('/api/v1/oauth_max.php') ?>" rel="nofollow">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M4 19V6l8 6 8-6v13"/></svg>
        <span>Войти через MAX</span>
      </a>
    </div>

    <div class="auth-sep"><span>или</span></div>

    <div class="auth-methods">
      <button type="button" class="auth-btn auth-btn--email" data-auth-method="email" aria-expanded="false" aria-controls="authFormEmail">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/></svg>
        <span>Почта</span>
      </button>
      <button type="button" class="auth-btn auth-btn--phone" data-auth-method="phone" aria-expanded="false" aria-controls="authFormPhone">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L20 13l2 4v3a1 1 0 0 1-1 1A17 17 0 0 1 4 5a1 1 0 0 1 1-1z"/></svg>
        <span>Телефон</span>
      </button>
    </div>

    <form class="auth-form" id="authFormEmail" method="post" action="<?= url('/login') ?>" hidden>
      <div class="field">
        <input type="email" name="email" id="authEmail" placeholder=" " autocomplete="email" required>
        <label for="authEmail">Электронная почта</label>
      </div>
      <div class="field">
        <input type="password" name="password" id="authPass" placeholder=" " autocomplete="current-password" required>
        <label for="authPass">Пароль</label>
      </div>
      <button type="submit" class="btn btn--primary btn--block">Войти</button>
    </form>

    <form class="auth-form" id="authFormPhone" method="post" action="<?= url('/login/phone') ?>" hidden>
      <div class="field">
        <input type="tel" name="phone" id="authPhone" placeholder=" " autocomplete="tel" inputmode="tel" required>
        <label for="authPhone">Номер телефона</label>
      </div>
      <div class="field auth-otp" hidden>
        <input type="text" name="code" id="authOtp" placeholder=" " inputmode="numeric" autocomplete="one-time-code" maxlength="6">
        <label for="authOtp">Код из сообщения</label>
      </div>
      <button type="submit" class="btn btn--primary btn--block">Получить код</button>
    </form>

    <p class="auth-note">Нажимая кнопку, Вы принимаете <a href="<?= url('/agreement') ?>">пользовательское соглашение</a> и <a href="<?= url('/privacy') ?>">политику конфиденциальности</a>.</p>
  </div>
</div>
<?php endif; ?>

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
<script src="<?= asset('js/app.js') ?>" defer></script>
<?php if ($inTg): ?>
<!-- Telegram Mini App: тот же сайт открывается нативно в боте (автологин, тема, expand, back). -->
<script>
(function(){
  document.documentElement.classList.add('in-tg');
  try{ document.cookie = 'mz_tg=1; path=/; max-age=86400; samesite=lax'; }catch(e){}
  function init(){
    var tg = window.Telegram && window.Telegram.WebApp; if(!tg) return;
    try{ tg.ready(); tg.expand && tg.expand(); }catch(e){}
    try{ if(tg.colorScheme){ document.documentElement.dataset.theme = tg.colorScheme; localStorage.setItem('muzmir-theme', tg.colorScheme);} }catch(e){}
    try{ tg.onEvent && tg.onEvent('themeChanged', function(){ document.documentElement.dataset.theme = tg.colorScheme; }); }catch(e){}
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
