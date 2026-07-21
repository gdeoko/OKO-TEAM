<?php
/** Лейаут админ-панели: тёмно-синий+золото сайдбар, шапка, роль-меню. */
declare(strict_types=1);

/**
 * Рендер страницы админки в общий каркас.
 * $active — ключ текущего модуля (для подсветки меню).
 */
function admin_layout(string $title, string $content, string $active = 'dashboard'): void {
    $u = current_user();
    $modules = admin_modules();
    $initial = mb_strtoupper(mb_substr($u['full_name'] ?: $u['email'] ?? '?', 0, 1));
    ?><!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title><?= h($title) ?> — Панель · <?= h(cfgv('org_short')) ?></title>
<meta name="robots" content="noindex,nofollow">
<link rel="icon" href="<?= asset('img/logo_muzmir_256.png') ?>">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700;800&family=Manrope:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<link rel="stylesheet" href="<?= asset('css/admin.css') ?>">
</head>
<body class="admin">
<div class="admin-shell">
  <aside class="sidebar">
    <div class="sidebar__brand">
      <img src="<?= logo_data_uri() ?>" alt="Логотип КЦ «Музыкальный Мир»">
      <div><b>Музыкальный&nbsp;Мир</b><span>Панель управления</span></div>
    </div>
    <nav class="sidebar__nav">
      <?php foreach ($modules as $key => [$label, $minRole, $icon]): ?>
        <?php if (!user_can($minRole)) continue; ?>
        <a href="<?= a_link($key) ?>" class="<?= $active === $key ? 'active' : '' ?>">
          <?= admin_icon($icon) ?><span><?= h($label) ?></span>
        </a>
      <?php endforeach; ?>
    </nav>
    <div class="sidebar__foot">
      <a href="<?= url('/') ?>" target="_blank" rel="noopener">Открыть сайт</a><br>
      <span>Роль: <?= h(role_ru($u['role'] ?? '')) ?></span>
    </div>
  </aside>

  <div class="sb-backdrop" onclick="document.body.classList.remove('sb-open')"></div>

  <div class="main">
    <header class="topbar">
      <div class="topbar__title">
        <button class="burger-admin" onclick="document.body.classList.toggle('sb-open')" aria-label="Меню"><span></span><span></span><span></span></button>
        <h1><?= h($title) ?></h1>
      </div>
      <div class="topbar__user">
        <div class="who" style="text-align:right">
          <b><?= h($u['full_name'] ?: $u['email']) ?></b>
          <span><?= h(role_ru($u['role'] ?? '')) ?></span>
        </div>
        <div class="avatar"><?= h($initial) ?></div>
        <a class="btn btn--ghost btn--sm" href="<?= a_link('logout') ?>" title="Выйти"><?= admin_icon('logout') ?><span>Выход</span></a>
      </div>
    </header>

    <div class="content">
      <?php foreach (flashes() as [$type, $msg]): ?>
        <div class="flash flash--<?= h($type) ?>"><?= h($msg) ?></div>
      <?php endforeach; ?>
      <?= $content ?>
    </div>
  </div>
</div>
</body>
</html>
<?php
}

/** Экран входа (без сайдбара). */
function admin_login_layout(string $error = '', string $email = ''): void {
    ?><!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Вход в панель — <?= h(cfgv('org_short')) ?></title>
<meta name="robots" content="noindex,nofollow">
<link rel="icon" href="<?= asset('img/logo_muzmir_256.png') ?>">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700;800&family=Manrope:wght@400;500;600;700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="<?= asset('css/admin.css') ?>">
</head>
<body class="admin">
<div class="login-wrap">
  <div class="login-card">
    <img class="logo" src="<?= logo_data_uri() ?>" alt="Логотип">
    <h1>Панель управления</h1>
    <p class="sub"><?= h(cfgv('org_name')) ?></p>
    <?php if ($error): ?><div class="flash flash--error" style="text-align:left"><?= h($error) ?></div><?php endif; ?>
    <form method="post" action="<?= url('/admin/') ?>" novalidate>
      <?= csrf_field() ?>
      <input type="hidden" name="do" value="login">
      <div class="field">
        <label for="email">Электронная почта</label>
        <input type="email" id="email" name="email" value="<?= h($email) ?>" autocomplete="username" required autofocus>
      </div>
      <div class="field">
        <label for="password">Пароль</label>
        <input type="password" id="password" name="password" autocomplete="current-password" required>
      </div>
      <button class="btn btn--primary btn--block" type="submit">Войти</button>
    </form>
    <p class="small muted" style="margin-top:20px"><a href="<?= url('/') ?>">← Вернуться на сайт</a></p>
  </div>
</div>
</body>
</html>
<?php
}
