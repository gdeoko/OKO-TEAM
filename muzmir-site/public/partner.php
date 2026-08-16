<?php
/**
 * public/partner.php — ЛК Информационного партнёра.
 * Один контроллер с разделами через ?a=<action>.
 *
 * Действия:
 *   login          — форма логина (email + пароль)
 *   logout         — выход
 *   (пусто/dash)   — дашборд: статистика + быстрые ссылки
 *   applications   — заявки от учреждения
 *   cert           — скачать сертификат PDF
 *   thanks         — форма заказа благодарностей + список выданных
 *   promo          — промокод + счётчик использований
 *
 * Публичный роут: /partner  → public/partner.php
 *                 /partner?a=... — разделы
 */
declare(strict_types=1);

// Контроллер вызывается двумя путями: напрямую и включением из роутера
// (public/index.php разводит /partner на публичную страницу программы и на
// кабинет). Поэтому окружение поднимаем только если его ещё нет.
if (!defined('BASE_PATH')) define('BASE_PATH', dirname(__DIR__));
if (empty($GLOBALS['CFG'])) $GLOBALS['CFG'] = require BASE_PATH . '/config.php';
require_once BASE_PATH . '/core/db.php';
require_once BASE_PATH . '/core/data.php';
require_once BASE_PATH . '/core/helpers.php';
require_once BASE_PATH . '/core/security.php';
require_once BASE_PATH . '/core/partner.php';
require_once BASE_PATH . '/core/partner_docs.php';

if (session_status() !== PHP_SESSION_ACTIVE) session_start();
db();

security_headers('/partner');

$action = trim((string) ($_GET['a'] ?? ''));
$post   = ($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'POST';
$base   = rtrim((string) cfgv('base_url', ''), '/');
$partner = partner_current();

/* ─────────────────────── ЛОГИН / ЛОГАУТ ─────────────────────── */

if ($action === 'logout') {
    partner_logout_session();
    header('Location: ' . $base . '/partner?a=login'); exit;
}

if ($action === 'login') {
    $err = '';
    if ($post) {
        if (!csrf_check()) $err = 'Сессия устарела. Обновите страницу.';
        else {
            $email = (string) input('email');
            $pass  = (string) input('password');
            $p = partner_login($email, $pass);
            if (!$p) $err = 'Неверный email или пароль. Проверьте данные из письма о принятии партнёрства.';
            else {
                partner_login_session((int) $p['id']);
                header('Location: ' . $base . '/partner'); exit;
            }
        }
    }
    partner_layout_login($base, $err);
    exit;
}

/* Без логина — редирект на форму */
if (!$partner) { header('Location: ' . $base . '/partner?a=login'); exit; }

/* ─────────────────────── ЗАЩИЩЁННЫЕ РАЗДЕЛЫ ─────────────────────── */

$instId = (int) $partner['id'];
$stats  = partner_stats($instId);

/** Скачать сертификат */
if ($action === 'cert') {
    $pdf = partner_cert_pdf($instId);
    if (!$pdf || !is_file($pdf)) { http_response_code(500); exit('Не удалось получить сертификат. Обратитесь в оргкомитет.'); }
    header('Content-Type: application/pdf');
    header('Content-Disposition: inline; filename="Сертификат_' . rawurlencode((string)$partner['partner_no']) . '.pdf"');
    header('Content-Length: ' . filesize($pdf));
    readfile($pdf);
    exit;
}

/** Форма благодарностей — обработка POST */
if ($action === 'thanks' && $post) {
    if (!csrf_check()) { flash('Сессия устарела.', 'error'); header('Location: ' . $base . '/partner?a=thanks'); exit; }

    // Автозаполнение из заявок: собираем уникальные ФИО педагогов
    $auto = [];
    try {
        $rows = all("SELECT DISTINCT LOWER(TRIM(teacher)) k, TRIM(teacher) fio
                       FROM applications
                      WHERE institution_id=? AND teacher IS NOT NULL AND TRIM(teacher)<>''", [$instId]);
        foreach ($rows as $r) if ($r['fio'] !== '') $auto[$r['k']] = $r['fio'];
    } catch (\Throwable $e) {}

    $selectedAuto = (array) input('auto', []);         // массив ключей выбранных ФИО из заявок
    $manualTeachers = array_filter(array_map('trim', (array) input('teachers_manual', [])));
    $managerFios    = array_filter(array_map('trim', (array) input('managers', [])));

    // Правило владельца: руководство — до 3 ФИО, ОДИН РАЗ за партнёрство
    if (!empty($managerFios) && (int) ($partner['partner_thanks_manager_used'] ?? 0) === 1) {
        flash('Руководству благодарности уже выдавались (лимит: один раз за партнёрство).', 'error');
        header('Location: ' . $base . '/partner?a=thanks'); exit;
    }
    if (count($managerFios) > 3) $managerFios = array_slice($managerFios, 0, 3);
    if (count($manualTeachers) > 3) $manualTeachers = array_slice($manualTeachers, 0, 3);

    $addedCount = 0;
    // Собираем полный список педагогов из auto+manual, дедуплицируем по нижнему регистру
    $teacherFios = [];
    foreach ($selectedAuto as $k) if (isset($auto[$k])) $teacherFios[$k] = $auto[$k];
    foreach ($manualTeachers as $fio) $teacherFios[mb_strtolower($fio)] = $fio;

    foreach ($teacherFios as $fio) {
        $fio = trim($fio); if ($fio === '') continue;
        // Дедуп: если по этому ФИО уже была благодарность — пропускаем
        try {
            // mb_lower, а не LOWER: встроенный LOWER в SQLite умеет только латиницу,
            // и «Иванов Иван» с «иванов иван» для него разные строки — дедуп по
            // русским ФИО не срабатывал вовсе.
            $exists = one("SELECT id FROM partner_thanks WHERE institution_id=? AND mb_lower(fio)=? LIMIT 1",
                          [$instId, mb_strtolower($fio)]);
            if ($exists) continue;
        } catch (\Throwable $e) {}
        $no = partner_thanks_next_no($instId, 'teacher');
        try {
            q("INSERT INTO partner_thanks (institution_id, role, fio, doc_number, status, scheduled_send_at)
               VALUES (?, 'teacher', ?, ?, 'queued', ?)",
              [$instId, $fio, $no, date('Y-m-d H:i:s', strtotime('+3 weekday'))]);
            $addedCount++;
        } catch (\Throwable $e) {}
    }
    foreach ($managerFios as $fio) {
        $fio = trim($fio); if ($fio === '') continue;
        try {
            // mb_lower, а не LOWER: встроенный LOWER в SQLite умеет только латиницу,
            // и «Иванов Иван» с «иванов иван» для него разные строки — дедуп по
            // русским ФИО не срабатывал вовсе.
            $exists = one("SELECT id FROM partner_thanks WHERE institution_id=? AND mb_lower(fio)=? LIMIT 1",
                          [$instId, mb_strtolower($fio)]);
            if ($exists) continue;
        } catch (\Throwable $e) {}
        $no = partner_thanks_next_no($instId, 'manager');
        try {
            q("INSERT INTO partner_thanks (institution_id, role, fio, doc_number, status, scheduled_send_at)
               VALUES (?, 'manager', ?, ?, 'queued', ?)",
              [$instId, $fio, $no, date('Y-m-d H:i:s', strtotime('+3 weekday'))]);
            $addedCount++;
        } catch (\Throwable $e) {}
    }
    if (!empty($managerFios)) {
        try { q("UPDATE institutions SET partner_thanks_manager_used=1 WHERE id=?", [$instId]); } catch (\Throwable $e) {}
    }
    if ($addedCount > 0) {
        partner_log_event($instId, 'thanks_requested', json_encode(['count' => $addedCount], JSON_UNESCAPED_UNICODE));
        flash('Заявка принята: ' . $addedCount . ' благодарностей. Придут на почту в течение 3 рабочих дней единым письмом.', 'success');
    } else {
        flash('Ничего не добавлено (возможно, все ФИО уже получили благодарность).', 'info');
    }
    header('Location: ' . $base . '/partner?a=thanks'); exit;
}

/* ─────────────────────── ВИД ─────────────────────── */

partner_layout_dashboard($base, $partner, $stats, $action, $instId);
exit;

/* ─────────────────────── ШАБЛОНЫ ─────────────────────── */

function partner_layout_login(string $base, string $err): void {
    ?><!doctype html>
    <html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Вход в кабинет партнёра · Культурный центр «Музыкальный Мир»</title>
    <link rel="icon" href="/favicon.ico">
    <style><?= partner_css() ?></style>
    </head><body>
    <div class="wrap wrap--narrow">
      <header class="p-hdr">
        <a href="<?= h($base) ?>/"><img src="<?= h($base) ?>/assets/img/logo_muzmir_256.png" alt="" width="46"></a>
        <div><b>Кабинет партнёра</b><br><span class="muted">Культурный центр «Музыкальный Мир»</span></div>
      </header>
      <div class="card">
        <h2 style="margin:0 0 6px">Вход в кабинет</h2>
        <p class="muted" style="margin:0 0 18px">Для учреждений — Информационных партнёров центра.</p>
        <?php if ($err !== ''): ?><div class="alert alert--err"><?= h($err) ?></div><?php endif; ?>
        <form method="post" autocomplete="on">
          <?= csrf_field() ?>
          <label>Email учреждения<input type="email" name="email" required autofocus placeholder="example@school.ru"></label>
          <label>Пароль<input type="password" name="password" required placeholder="из письма о принятии партнёрства"></label>
          <button class="btn btn--gold" type="submit">Войти в кабинет</button>
        </form>
        <p class="muted" style="margin:18px 0 0;font-size:13px">
          Логин и пароль были направлены на email учреждения после подтверждения партнёрства.
          Не получили или потеряли? Напишите на <a href="mailto:kc@музыкальный-мир.рф">kc@музыкальный-мир.рф</a>.
        </p>
      </div>
      <footer class="p-ftr">© Культурный центр «Музыкальный Мир» · <a href="<?= h($base) ?>/">на сайт</a></footer>
    </div>
    </body></html>
    <?php
}

function partner_layout_dashboard(string $base, array $p, array $s, string $action, int $instId): void {
    $flash = $_SESSION['flash'] ?? null;
    unset($_SESSION['flash']);
    ?><!doctype html>
    <html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Кабинет партнёра — <?= h((string)$p['name']) ?></title>
    <link rel="icon" href="/favicon.ico">
    <style><?= partner_css() ?></style>
    </head><body>
    <div class="wrap">
      <header class="p-hdr">
        <a href="<?= h($base) ?>/"><img src="<?= h($base) ?>/assets/img/logo_muzmir_256.png" alt="" width="46"></a>
        <div>
          <b><?= h((string)$p['name']) ?></b><br>
          <span class="muted"><?= h((string)($p['region'] ?? '')) ?> · партнёр <b><?= h((string)$p['partner_no']) ?></b></span>
        </div>
        <div class="p-user">
          <span class="muted"><?= h((string)$p['email']) ?></span>
          <a class="btn btn--ghost btn--sm" href="<?= h($base) ?>/partner?a=logout">Выйти</a>
        </div>
      </header>

      <nav class="p-nav">
        <a href="<?= h($base) ?>/partner"      class="<?= $action===''?'act':'' ?>">Обзор</a>
        <a href="<?= h($base) ?>/partner?a=applications" class="<?= $action==='applications'?'act':'' ?>">Заявки от учреждения</a>
        <a href="<?= h($base) ?>/partner?a=thanks"       class="<?= $action==='thanks'?'act':'' ?>">Благодарности</a>
        <a href="<?= h($base) ?>/partner?a=promo"        class="<?= $action==='promo'?'act':'' ?>">Промокод</a>
        <a href="<?= h($base) ?>/partner?a=cert">Скачать сертификат</a>
      </nav>

      <?php if ($flash): ?>
        <div class="alert alert--<?= h((string)($flash['type'] ?? 'info')) ?>"><?= h((string)($flash['text'] ?? '')) ?></div>
      <?php endif; ?>

      <?php
      if ($action === '')                partner_view_overview($base, $p, $s);
      elseif ($action === 'applications') partner_view_apps($base, $p, $instId);
      elseif ($action === 'thanks')       partner_view_thanks($base, $p, $s, $instId);
      elseif ($action === 'promo')        partner_view_promo($base, $p, $s);
      else                                partner_view_overview($base, $p, $s);
      ?>

      <footer class="p-ftr">
        © Культурный центр «Музыкальный Мир» ·
        <a href="mailto:kc@музыкальный-мир.рф">kc@музыкальный-мир.рф</a> · +7 (999) 504-88-99 ·
        <a href="<?= h($base) ?>/">на сайт</a>
      </footer>
    </div>
    </body></html>
    <?php
}

function partner_view_overview(string $base, array $p, array $s): void {
    $link = $base . '/p/' . rawurlencode((string)$p['partner_slug']);
    ?>
    <div class="card">
      <h2 style="margin:0 0 12px">Обзор</h2>
      <div class="grid grid--stats">
        <div class="stat"><b><?= (int)$s['apps_total'] ?></b><span>заявок от учреждения</span></div>
        <div class="stat"><b><?= (int)$s['apps_paid'] ?></b><span>из них оплачено</span></div>
        <div class="stat"><b><?= (int)$s['thanks_issued'] ?></b><span>благодарностей выдано</span></div>
        <div class="stat"><b><?= (int)$s['promo_uses'] ?>/<?= (int)$s['promo_max'] ?></b><span>использований промокода</span></div>
      </div>

      <?php if ($s['to_thanks'] > 0): ?>
        <div class="card card--sub"><b>До открытия бесплатных благодарностей:</b> ещё <b><?= (int)$s['to_thanks'] ?></b> заявок от Вашего учреждения.</div>
      <?php else: ?>
        <div class="card card--sub card--ok"><b>Благодарности доступны.</b>
          <a class="btn btn--gold btn--sm" href="<?= h($base) ?>/partner?a=thanks" style="margin-left:8px">Оформить</a></div>
      <?php endif; ?>

      <?php if ($s['to_promo'] > 0): ?>
        <div class="card card--sub"><b>До активации промокода −10%:</b> ещё <b><?= (int)$s['to_promo'] ?></b> заявок.</div>
      <?php else: ?>
        <div class="card card--sub card--ok"><b>Промокод активен:</b>
          <span class="promo"><?= h((string)$p['partner_promo_code']) ?></span>
          <span class="muted">осталось <?= max(0, (int)$s['promo_max'] - (int)$s['promo_uses']) ?> из <?= (int)$s['promo_max'] ?> использований</span></div>
      <?php endif; ?>

      <div class="card card--sub">
        <b>Персональная ссылка для педагогов и учеников:</b><br>
        <code><?= h($link) ?></code>
        <p class="muted" style="margin:8px 0 0;font-size:13px">Заявка, поданная по этой ссылке,
        автоматически привязывается к Вашему учреждению для учёта в партнёрской статистике.</p>
      </div>
    </div>

    <div class="grid grid--priv">
      <div class="card"><b>Приоритетная аттестация</b><br>
        <span class="muted">Электронные дипломы участников — за <b><?= (int)$s['priority_days'] ?></b> рабочих дня (стандарт 5).</span></div>
      <div class="card"><b>Сертификат Информационного партнёра</b><br>
        <a href="<?= h($base) ?>/partner?a=cert" class="btn btn--gold btn--sm" style="margin-top:6px">Скачать PDF</a></div>
      <div class="card"><b>Помощь</b><br>
        <span class="muted">По любым вопросам:<br>
        <a href="mailto:kc@музыкальный-мир.рф">kc@музыкальный-мир.рф</a> · +7 (999) 504-88-99</span></div>
    </div>
    <?php
}

function partner_view_apps(string $base, array $p, int $instId): void {
    try {
        $apps = all("SELECT a.id, a.number, a.full_name, a.group_name, a.work_title, a.teacher,
                            a.status, a.is_paid, a.result, a.created_at, c.name comp
                       FROM applications a LEFT JOIN competitions c ON c.id=a.competition_id
                      WHERE a.institution_id=? ORDER BY a.id DESC LIMIT 500", [$instId]);
    } catch (\Throwable $e) { $apps = []; }
    ?>
    <div class="card">
      <h2 style="margin:0 0 6px">Заявки от учреждения</h2>
      <p class="muted" style="margin:0 0 14px">Все заявки, поданные через персональную ссылку /p/<?= h((string)$p['partner_slug']) ?>.</p>
      <?php if (!$apps): ?>
        <p class="muted">Заявок пока нет. Раздайте педагогам вашу персональную ссылку, чтобы каждая заявка автоматически считалась к партнёрству.</p>
      <?php else: ?>
        <div class="table-wrap"><table>
          <thead><tr><th>№</th><th>Конкурс</th><th>Участник</th><th>Номер</th><th>Педагог</th><th>Статус</th><th>Оплата</th><th>Итог</th><th>Подана</th></tr></thead>
          <tbody>
          <?php foreach ($apps as $a): ?>
            <tr>
              <td><?= h((string)$a['number']) ?></td>
              <td><?= h((string)$a['comp']) ?></td>
              <td><?= h((string)($a['group_name'] ?: $a['full_name'])) ?></td>
              <td><?= h((string)$a['work_title']) ?></td>
              <td><?= h((string)$a['teacher']) ?></td>
              <td><span class="pill pill--<?= h((string)$a['status']) ?>"><?= h((string)$a['status']) ?></span></td>
              <td><?= (int)$a['is_paid'] ? '✓' : '—' ?></td>
              <td><?= h((string)$a['result']) ?></td>
              <td><?= h(date('d.m.y', strtotime((string)$a['created_at']))) ?></td>
            </tr>
          <?php endforeach; ?>
          </tbody>
        </table></div>
      <?php endif; ?>
    </div>
    <?php
}

function partner_view_thanks(string $base, array $p, array $s, int $instId): void {
    $formOpen = (int)$s['apps_total'] >= 5;

    // Список выданных благодарностей
    try {
        $issued = all("SELECT id, role, fio, doc_number, status, sent_at, scheduled_send_at
                         FROM partner_thanks WHERE institution_id=? ORDER BY id DESC", [$instId]);
    } catch (\Throwable $e) { $issued = []; }

    // Уникальные педагоги из заявок (ещё не в благодарностях)
    try {
        $rows = all("SELECT DISTINCT LOWER(TRIM(teacher)) k, TRIM(teacher) fio
                       FROM applications
                      WHERE institution_id=? AND teacher IS NOT NULL AND TRIM(teacher)<>''", [$instId]);
    } catch (\Throwable $e) { $rows = []; }
    $auto = [];
    foreach ($rows as $r) if ($r['fio'] !== '') $auto[$r['k']] = $r['fio'];
    $used = [];
    foreach ($issued as $i) $used[mb_strtolower((string)$i['fio'])] = true;
    $availAuto = [];
    foreach ($auto as $k => $fio) if (!isset($used[$k])) $availAuto[$k] = $fio;

    $managerUsed = (int) ($p['partner_thanks_manager_used'] ?? 0) === 1;
    ?>
    <div class="card">
      <h2 style="margin:0 0 6px">Благодарности</h2>
      <?php if (!$formOpen): ?>
        <p class="muted">Для заказа бесплатных благодарностей нужно, чтобы от учреждения поступило <b>5+ заявок</b>. Сейчас поступило <b><?= (int)$s['apps_total'] ?></b>.</p>
      <?php else: ?>
      <p class="muted" style="margin:0 0 14px">Форма оформляется 1 раз за партнёрство для руководства (до 3 ФИО) и без ограничений для педагогов (по одному разу на каждое новое ФИО). После отправки формы благодарности приходят на почту в течение 3 рабочих дней единым письмом.</p>

      <form method="post">
        <?= csrf_field() ?>
        <div class="thanks-block">
          <b>Педагоги-кураторы</b>
          <p class="muted" style="margin:4px 0 8px;font-size:13px">Автоматически подставляем ФИО педагогов из ваших заявок. Отметьте нужных.</p>
          <?php if ($availAuto): ?>
            <?php foreach ($availAuto as $k => $fio): ?>
              <label class="chk"><input type="checkbox" name="auto[]" value="<?= h($k) ?>"> <?= h($fio) ?></label>
            <?php endforeach; ?>
          <?php else: ?>
            <p class="muted">Нет новых педагогов из заявок (всем уже выдано).</p>
          <?php endif; ?>

          <p class="muted" style="margin:14px 0 6px;font-size:13px">Или добавьте до 3-х ФИО вручную (если нет в списке заявок):</p>
          <input type="text" name="teachers_manual[]" placeholder="Фамилия Имя Отчество">
          <input type="text" name="teachers_manual[]" placeholder="Фамилия Имя Отчество">
          <input type="text" name="teachers_manual[]" placeholder="Фамилия Имя Отчество">
        </div>

        <?php if (!$managerUsed): ?>
        <div class="thanks-block">
          <b>Руководство учреждения — один раз за партнёрство</b>
          <p class="muted" style="margin:4px 0 8px;font-size:13px">До 3-х ФИО. Больше на руководство нельзя.</p>
          <input type="text" name="managers[]" placeholder="Фамилия Имя Отчество">
          <input type="text" name="managers[]" placeholder="Фамилия Имя Отчество">
          <input type="text" name="managers[]" placeholder="Фамилия Имя Отчество">
        </div>
        <?php else: ?>
        <div class="thanks-block muted">Благодарности руководству уже выдавались (лимит: один раз за партнёрство).</div>
        <?php endif; ?>

        <button class="btn btn--gold" type="submit">Оформить благодарности</button>
      </form>
      <?php endif; ?>
    </div>

    <?php if ($issued): ?>
    <div class="card">
      <h3 style="margin:0 0 8px">Выданные благодарности</h3>
      <div class="table-wrap"><table>
        <thead><tr><th>№ документа</th><th>Кому</th><th>Роль</th><th>Статус</th><th>Отправлено</th></tr></thead>
        <tbody>
        <?php foreach ($issued as $t): ?>
          <tr>
            <td><?= h((string)$t['doc_number']) ?></td>
            <td><?= h((string)$t['fio']) ?></td>
            <td><?= ($t['role'] === 'manager' ? 'руководство' : 'педагог') ?></td>
            <td><span class="pill pill--<?= h((string)$t['status']) ?>"><?= h((string)$t['status']) ?></span></td>
            <td class="muted"><?= h($t['sent_at'] ? date('d.m.y H:i', strtotime((string)$t['sent_at'])) : ($t['scheduled_send_at'] ? 'запланировано на ' . date('d.m.y', strtotime((string)$t['scheduled_send_at'])) : '—')) ?></td>
          </tr>
        <?php endforeach; ?>
        </tbody>
      </table></div>
    </div>
    <?php endif; ?>
    <?php
}

function partner_view_promo(string $base, array $p, array $s): void {
    $active = (int)$s['apps_total'] >= 10;
    ?>
    <div class="card">
      <h2 style="margin:0 0 6px">Промокод -10%</h2>
      <?php if (!$active): ?>
        <p class="muted">Промокод активируется, когда от учреждения поступит <b>10+ заявок</b>. Сейчас поступило <b><?= (int)$s['apps_total'] ?></b>. Осталось <b><?= (int)$s['to_promo'] ?></b>.</p>
      <?php else: ?>
        <div class="promo-big"><?= h((string)$p['partner_promo_code']) ?></div>
        <p style="text-align:center;margin:12px 0 0" class="muted">
          Действует на <b><?= (int)$s['promo_max'] ?></b> использований · использовано <b><?= (int)$s['promo_uses'] ?></b> ·
          осталось <b><?= max(0, (int)$s['promo_max'] - (int)$s['promo_uses']) ?></b>.
        </p>
        <p class="muted" style="margin-top:14px;font-size:14px">Скидка 10% применяется к оргвзносу при подаче заявки или к заказу наградного материала. Введите код в поле «Промокод» на нашем сайте — скидка учтётся автоматически.</p>
      <?php endif; ?>
    </div>
    <?php
}

/* CSS ЛК партнёра — единый бежево-золотой стиль в тон сертификата. */
function partner_css(): string {
    return <<<CSS
*{margin:0;padding:0;box-sizing:border-box}
body{font:15px/1.5 -apple-system,Segoe UI,Roboto,sans-serif;color:#2A1E06;
  background:radial-gradient(120% 90% at 50% 0%,#FFFDF4 0%,#FDF6E2 46%,#F7E9C4 100%);min-height:100vh}
a{color:#8A6512}
.wrap{max-width:1100px;margin:0 auto;padding:22px 18px 60px}
.wrap--narrow{max-width:520px}
.p-hdr{display:flex;align-items:center;gap:14px;padding:8px 6px 22px}
.p-hdr>div:nth-child(2){flex:1}
.p-hdr .muted{font-size:13px}
.p-user{display:flex;align-items:center;gap:10px;font-size:13px}
.p-nav{display:flex;flex-wrap:wrap;gap:2px;background:#fff;border:1px solid #E9CE84;border-radius:10px;padding:4px;margin-bottom:16px;overflow:auto}
.p-nav a{padding:9px 14px;border-radius:7px;text-decoration:none;color:#5A4310;font-weight:600;white-space:nowrap;font-size:14px}
.p-nav a.act,.p-nav a:hover{background:linear-gradient(135deg,#C79322,#E9CE84);color:#2A1E06}
.card{background:#fff;border:1px solid #E9CE84;border-radius:12px;padding:20px 22px;margin:0 0 14px;box-shadow:0 4px 18px rgba(160,116,20,.06)}
.card--sub{background:#FDF6E2;padding:12px 18px;margin:8px 0;border-radius:8px}
.card--ok{background:#EAF7EF;border-color:#BFE6CC}
.grid{display:grid;gap:14px;margin-top:10px}
.grid--stats{grid-template-columns:repeat(auto-fit,minmax(180px,1fr))}
.grid--priv{grid-template-columns:repeat(auto-fit,minmax(240px,1fr));margin-top:0}
.stat{background:#FDF6E2;border:1px solid #E9CE84;border-radius:8px;padding:14px 16px}
.stat b{display:block;font-size:26px;font-weight:800;color:#5A4310}
.stat span{display:block;margin-top:4px;font-size:12px;color:#7A5A12;text-transform:uppercase;letter-spacing:.06em}
.muted{color:#7A5A12}
label{display:block;margin:0 0 10px;font-weight:600;font-size:14px;color:#5A4310}
label input,input[type=text],input[type=email],input[type=password]{display:block;width:100%;margin-top:4px;padding:10px 12px;border:1px solid #E9CE84;border-radius:6px;font:15px inherit;background:#fff}
input[type=text]{margin-bottom:6px}
.btn{display:inline-block;padding:11px 20px;border-radius:6px;text-decoration:none;font-weight:700;border:0;cursor:pointer;font-size:15px}
.btn--gold{background:linear-gradient(135deg,#C79322,#E9CE84);color:#2A1E06}
.btn--ghost{background:#fff;border:1px solid #E9CE84;color:#5A4310}
.btn--sm{padding:6px 14px;font-size:13px}
.alert{padding:12px 16px;border-radius:8px;margin:0 0 14px;font-size:14px}
.alert--err{background:#FDF1F1;border:1px solid #E6C0C0;color:#8C2F2F}
.alert--success{background:#EAF7EF;border:1px solid #BFE6CC;color:#1E7A46}
.alert--info{background:#FDF6E2;border:1px solid #E9CE84;color:#5A4310}
.promo{font-family:monospace;background:#fff;padding:3px 8px;border-radius:4px;font-weight:800;color:#5A4310}
.promo-big{font-family:monospace;font-size:32px;font-weight:800;color:#2A1E06;text-align:center;
  background:linear-gradient(135deg,#FDF6E2,#F7E9C4);border:2px dashed #C79322;border-radius:10px;padding:26px;letter-spacing:.08em}
.thanks-block{background:#FDF6E2;border:1px solid #E9CE84;border-radius:8px;padding:14px 18px;margin:0 0 14px}
.chk{display:block;margin:0 0 6px;font-weight:500;font-size:14px;color:#2A1E06;cursor:pointer}
.chk input{margin-right:8px}
.table-wrap{overflow:auto;margin-top:8px}
table{border-collapse:collapse;width:100%;font-size:13px}
th,td{padding:8px 10px;text-align:left;border-bottom:1px solid #E9CE84;vertical-align:top}
th{background:#FDF6E2;color:#5A4310;font-weight:700;font-size:12px;text-transform:uppercase;letter-spacing:.06em}
.pill{display:inline-block;padding:2px 8px;border-radius:99px;font-size:11px;font-weight:700;background:#EEE8D8;color:#5A4310}
.pill--paid,.pill--sent,.pill--generated{background:#EAF7EF;color:#1E7A46}
.pill--queued,.pill--new{background:#FDF6E2;color:#8A6512}
.pill--failed{background:#FDF1F1;color:#8C2F2F}
.p-ftr{text-align:center;color:#7A5A12;font-size:12px;padding:20px 0 0}
code{background:#FDF6E2;padding:3px 8px;border-radius:4px;font-size:13px;word-break:break-all;display:inline-block}
@media(max-width:640px){.p-hdr{flex-wrap:wrap}.p-user{width:100%;justify-content:space-between}}
CSS;
}

/** Мини-помощник для flash-сообщений (если ещё нет). */
if (!function_exists('flash')) {
    function flash(string $text, string $type = 'info'): void {
        if (session_status() !== PHP_SESSION_ACTIVE) session_start();
        $_SESSION['flash'] = ['text' => $text, 'type' => $type];
    }
}
