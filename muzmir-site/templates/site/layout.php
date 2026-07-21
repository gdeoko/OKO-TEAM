<?php
/** Базовый лейаут публичного сайта. Переменные: $title,$content,$meta_description,$og_image,$active. */
$nav = [
  '/' => 'Главная', '/competitions' => 'Конкурсы', '/apply' => 'Подать заявку',
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
?><!doctype html>
<html lang="ru">
<head>
<script>document.documentElement.className+=' js';</script>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title><?= h($title) ?> — <?= h(cfgv('org_name')) ?></title>
<meta name="description" content="<?= h($meta_description) ?>">
<meta name="theme-color" content="#FFFCF5">
<meta property="og:title" content="<?= h($title) ?> — <?= h(cfgv('org_name')) ?>">
<meta property="og:description" content="<?= h($meta_description) ?>">
<meta property="og:image" content="<?= h($og_image) ?>">
<meta property="og:type" content="website">
<link rel="icon" href="<?= asset('img/logo_muzmir_256.png') ?>">
<link rel="apple-touch-icon" href="<?= asset('img/logo_muzmir_256.png') ?>">
<link rel="manifest" href="<?= url('manifest.webmanifest') ?>">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700;800&family=Manrope:wght@400;500;600;700&family=Marck+Script&display=swap" rel="stylesheet">
<link rel="stylesheet" href="<?= asset('css/style.css') ?>">
</head>
<body>
<div class="topbar"><div class="container">
  <a href="tel:<?= h(cfgv('org_phone_raw')) ?>"><?= h(cfgv('org_phone')) ?></a>
  <span><?= h(cfgv('org_reg')) ?></span>
</div></div>

<header class="header"><div class="container">
  <a class="brand" href="<?= url('/') ?>">
    <img src="<?= asset('img/logo_muzmir_256.png') ?>" alt="Логотип КЦ «Музыкальный Мир»">
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
        <a class="btn btn--ghost" href="<?= url('/login') ?>">Войти</a>
        <a class="btn btn--primary" href="<?= url('/apply') ?>">Подать заявку</a>
      <?php endif; ?>
    </div>
  </nav>
  <div class="nav-actions">
    <?php if ($u): ?>
      <a class="btn btn--ghost" href="<?= url('/cabinet') ?>">Кабинет</a>
      <?php if (user_can('moderator')): ?><a class="btn btn--primary" href="<?= url('/admin') ?>">Админка</a><?php endif; ?>
    <?php else: ?>
      <a class="btn btn--ghost" href="<?= url('/login') ?>">Войти</a>
      <a class="btn btn--primary" href="<?= url('/apply') ?>">Подать заявку</a>
    <?php endif; ?>
    <button class="burger" id="burger" aria-label="Меню"><span></span><span></span><span></span></button>
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
      <img src="<?= asset('img/logo_muzmir_256.png') ?>" alt="Логотип">
      <p><?= h(cfgv('org_full')) ?></p>
      <p style="opacity:.7;font-size:.85rem"><?= h(cfgv('org_reg')) ?></p>
    </div>
    <div>
      <h4>Разделы</h4>
      <ul>
        <?php foreach (['/competitions'=>'Конкурсы','/apply'=>'Подать заявку','/awards'=>'Награды','/concerts'=>'Концерты','/about'=>'О нас'] as $hr=>$lb): ?>
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

<button class="chat-fab" id="chatFab" aria-label="Поддержка">
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 11.5a8.38 8.38 0 0 1-8.5 8.5 8.5 8.5 0 0 1-3.8-.9L3 21l1.9-5.7A8.5 8.5 0 1 1 21 11.5z"/></svg>
</button>

<?php if (cfgv('metrika_id')): ?>
<script>(function(m,e,t,r,i,k,a){m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};m[i].l=1*new Date();for(var j=0;j<document.scripts.length;j++){if(document.scripts[j].src===r){return}}k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)})(window,document,"script","https://mc.yandex.ru/metrika/tag.js","ym");ym(<?= (int)cfgv('metrika_id') ?>,"init",{clickmap:true,trackLinks:true,accurateTrackBounce:true});</script>
<?php endif; ?>
<script src="<?= asset('js/app.js') ?>" defer></script>
</body>
</html>
