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
<?php /* ШРИФТЫ ПАНЕЛИ — СО СВОЕГО СЕРВЕРА.
     Здесь стояла ссылка на fonts.googleapis.com. Таблица стилей блокирует
     отрисовку: пока она не пришла, браузер не показывает страницу вообще —
     ни заголовка, ни меню, ни списка. Из дата-центра Google отвечает за 80 мс,
     с мобильного интернета в России — как повезёт, и панель на телефоне
     выглядит как «не открывается», хотя сервер отдал её за 50 мс.
     Файлы шрифтов лежат в public/assets/fonts, собраны scripts/fonts_localize.py. */ ?>
<link rel="stylesheet" href="<?= asset('css/fonts.css') ?>">
<link rel="stylesheet" href="<?= asset('css/admin.css') ?>">
<style>
/* ── Переключатель темы (кнопка в шапке) ─────────────────────── */
.theme-toggle{width:38px;height:38px;border-radius:50%;border:1px solid var(--a-line);background:#fff;
  display:inline-flex;align-items:center;justify-content:center;cursor:pointer;color:var(--a-navy-2);
  flex:0 0 auto;transition:.15s}
.theme-toggle:hover{border-color:var(--a-gold);transform:translateY(-1px)}
.theme-toggle svg{width:18px;height:18px;stroke:currentColor;fill:none;stroke-width:1.8}
.theme-toggle .ic-moon{display:none}
[data-theme=dark] .theme-toggle{background:#1c1b23;border-color:rgba(255,255,255,.12);color:var(--a-gold-2)}
[data-theme=dark] .theme-toggle .ic-sun{display:none}
[data-theme=dark] .theme-toggle .ic-moon{display:inline}

/* ── Тёмная тема админки (аккуратная, поверх admin.css) ───────── */
[data-theme=dark] body.admin{background:#0d0c11;color:#E7E3D6}
[data-theme=dark] a{color:var(--a-gold-2)}
[data-theme=dark] a:hover{color:#f0d987}
[data-theme=dark] h1,[data-theme=dark] h2,[data-theme=dark] h3,[data-theme=dark] h4{color:#F1ECDD}
[data-theme=dark] .card,[data-theme=dark] .stat,[data-theme=dark] .filters,
[data-theme=dark] .table-wrap,[data-theme=dark] table.tbl{background:#16151c;border-color:rgba(255,255,255,.08);color:#E7E3D6}
[data-theme=dark] .topbar{background:#141319;border-bottom-color:rgba(255,255,255,.08)}
[data-theme=dark] .topbar__user .who b{color:#F1ECDD}
[data-theme=dark] .stat__value{color:#F1ECDD}
[data-theme=dark] .stat__icon svg{stroke:#F1ECDD}
[data-theme=dark] .stat::before{opacity:.9}
[data-theme=dark] .muted,[data-theme=dark] .small.muted,[data-theme=dark] .stat__label,
[data-theme=dark] .stat__sub,[data-theme=dark] .kv dt,[data-theme=dark] .chart-x div{color:#9a978c}
[data-theme=dark] .kv dd{color:#E7E3D6}
[data-theme=dark] table.tbl th{background:#1f1e27;color:#F1ECDD;border-bottom-color:rgba(255,255,255,.09)}
[data-theme=dark] table.tbl td{border-bottom-color:rgba(255,255,255,.06)}
[data-theme=dark] table.tbl tbody tr:hover{background:#20202b}
[data-theme=dark] .btn--ghost{background:#1c1b23;color:var(--a-gold-2);border-color:var(--a-gold-dark)}
[data-theme=dark] .btn--ghost:hover{background:#242330}
[data-theme=dark] .field input,[data-theme=dark] .field select,[data-theme=dark] .field textarea{
  background:#1c1b23;color:#E7E3D6;border-color:rgba(255,255,255,.12)}
[data-theme=dark] .field label{color:#E7E3D6}
[data-theme=dark] .burger-admin span{background:#F1ECDD}
[data-theme=dark] hr{border-top-color:rgba(255,255,255,.08)}
[data-theme=dark] .tabs{border-bottom-color:rgba(255,255,255,.08)}
[data-theme=dark] .tabs a.active{color:#F1ECDD}
[data-theme=dark] .tag{background:#20202b;border-color:rgba(255,255,255,.08);color:#c9c5b8}
</style>
<script>
/* Инициализация темы до отрисовки (без мигания). Ключ localStorage — muzmir-admin-theme, дефолт light. */
window.MZTheme=(function(){var K='muzmir-admin-theme';
 function g(){try{return localStorage.getItem(K)||'light'}catch(e){return 'light'}}
 function a(t){document.documentElement.setAttribute('data-theme',t==='dark'?'dark':'light')}
 function s(t){try{localStorage.setItem(K,t)}catch(e){}a(t)}
 a(g());return{get:g,set:s,toggle:function(){s(g()==='dark'?'light':'dark')}};})();
</script>
</head>
<body class="admin">
<div class="admin-shell">
  <aside class="sidebar">
    <div class="sidebar__brand">
      <img src="<?= logo_web_src() ?>" alt="Логотип Культурного центра «Музыкальный Мир»">
      <div><b>Музыкальный&nbsp;Мир</b><span>Панель управления</span></div>
    </div>
    <nav class="sidebar__nav">
      <?php foreach ($modules as $key => $mrow): [$label, $minRole, $icon] = $mrow; ?>
        <?php if (!user_can($minRole)) continue; ?>
        <?php if (!empty($mrow[3])) continue; /* скрытый из сайдбара модуль (доступен по ссылке) */ ?>
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
        <button class="theme-toggle" type="button" onclick="MZTheme.toggle()" aria-label="Переключить тему" title="Светлая / тёмная тема">
          <svg class="ic-sun" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>
          <svg class="ic-moon" viewBox="0 0 24 24" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z"/></svg>
        </button>
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
<link rel="stylesheet" href="<?= asset('css/fonts.css') ?>">
<link rel="stylesheet" href="<?= asset('css/admin.css') ?>">
</head>
<body class="admin">
<div class="login-wrap">
  <div class="login-card">
    <img class="logo" src="<?= logo_web_src() ?>" alt="Логотип">
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

/* ═══════════════════ ДЛИННЫЕ СПИСКИ — ПОРЦИЯМИ ═══════════════════
 *
 * Страницы админки отдавали списки целиком: «Люди» — триста учётных записей,
 * пятьсот подписчиков и двести строк журнала на одной странице, «Отправка» —
 * шесть списков по три-пять сотен. Сервер справлялся за десятые доли секунды,
 * а вот телефон получал по две с половиной мегабайты разметки на каждый переход
 * и подолгу их раскладывал. Для владельца, который смотрит с телефона, это
 * ровно то же самое, что «не открывается».
 *
 * Порция по умолчанию — полсотни строк: столько видно за пару прокруток, и
 * этого хватает, чтобы найти нужное. Остальное — по кнопке «Показать ещё».
 * Поиск и фильтры работают по всей базе, а не по показанной порции: они уходят
 * в SQL, порция режет только вывод.
 */

/** Сколько строк показать. $key — своё имя у каждого списка на странице. */
function adm_take(int $per = 50, string $key = 'n'): int {
    $n = (int) input($key);
    return $n > 0 ? min(2000, max($per, $n)) : $per;
}

/** Кнопка «Показать ещё». Сохраняет текущие фильтры, меняет только порцию. */
function adm_more_button(bool $hasMore, int $shown, int $per = 50, string $key = 'n'): void {
    if (!$hasMore) return;
    $q = $_GET;
    $q[$key] = $shown + $per;
    unset($q['p']);
    $page = (string) ($_GET['p'] ?? 'dashboard');
    echo '<div style="margin-top:12px;text-align:center">'
       . '<a class="btn btn--ghost" href="' . h(a_link($page, $q)) . '">Показать ещё ' . (int) $per . '</a></div>';
}
