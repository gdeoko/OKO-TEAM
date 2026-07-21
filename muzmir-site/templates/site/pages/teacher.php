<?php
/**
 * Кабинет педагога/учреждения. Групповые заявки, импорт учеников из CSV,
 * единый отчёт для директора. Роль пользователя должна быть teacher (или выше).
 * Личный кабинет участника (templates/site/pages/cabinet.php) не затрагивается.
 */
require_login();
$user = current_user();
$uid = (int) $user['id'];

$teacherRoles = ['teacher', 'jury', 'moderator', 'designer', 'accountant', 'admin', 'owner'];

// --- «Стать педагогом»: включить роль teacher по запросу пользователя ---
if ($_SERVER['REQUEST_METHOD'] === 'POST' && input('action') === 'become_teacher') {
    if (!csrf_check()) {
        flash('Сессия устарела. Обновите страницу и попробуйте снова.', 'error');
    } elseif ($user['role'] === 'user') {
        update('users', ['role' => 'teacher'], 'id=:id', ['id' => $uid]);
        audit('become_teacher', 'user', $uid);
        flash('Готово. Вам открыт кабинет педагога.', 'success');
    }
    redirect('/teacher');
}

$isTeacher = in_array($user['role'], $teacherRoles, true);

// --- Экран для тех, у кого ещё нет роли педагога ---
if (!$isTeacher) {
    ob_start(); ?>
    <section class="section section--parchment">
      <div class="container" style="max-width:640px;text-align:center">
        <div class="section-head reveal">
          <p class="eyebrow">Кабинет педагога</p>
          <h2>Раздел для педагогов и учреждений</h2>
          <p>Здесь можно подать заявки сразу на несколько учеников, загрузить список из таблицы
             и получить единый отчёт для директора. Раздел открывается по Вашему запросу.</p>
        </div>
        <form method="post" action="<?= url('/teacher') ?>" class="reveal" style="display:inline-block">
          <?= csrf_field() ?>
          <input type="hidden" name="action" value="become_teacher">
          <button class="btn btn--primary btn--lg" type="submit">Стать педагогом</button>
        </form>
      </div>
    </section>
    <?php
    $content = ob_get_clean();
    render_page('Кабинет педагога', $content, [
        'active' => '/teacher',
        'meta'   => 'Кабинет педагога КЦ «Музыкальный Мир»: групповые заявки, импорт учеников, отчёт для директора.',
    ]);
    exit;
}

// --- Единый отчёт для директора: выгрузка CSV ---
if (($_GET['report'] ?? '') === 'csv') {
    $rows = all(
        "SELECT a.full_name, a.number, c.name AS comp_name, a.nomination, a.status, a.result, d.number AS diploma_number
         FROM applications a
         LEFT JOIN competitions c ON c.id = a.competition_id
         LEFT JOIN diplomas d ON d.application_id = a.id
         WHERE a.user_id = ? OR (a.teacher <> '' AND a.teacher = ?)
         ORDER BY c.name, a.full_name",
        [$uid, $user['full_name']]
    );
    $statusLabel = ['new' => 'Новая', 'paid' => 'Оплачена', 'judging' => 'На оценке',
                    'graded' => 'Оценена', 'sent' => 'Диплом отправлен', 'rejected' => 'Отклонена'];
    header('Content-Type: text/csv; charset=utf-8');
    header('Content-Disposition: attachment; filename="otchet-pedagoga-' . date('Y-m-d') . '.csv"');
    echo "\xEF\xBB\xBF"; // BOM — чтобы Excel корректно показал кириллицу
    $out = fopen('php://output', 'w');
    fputcsv($out, ['Ученик', 'Номер заявки', 'Конкурс', 'Номинация', 'Статус', 'Результат', 'Номер диплома'], ';');
    foreach ($rows as $r) {
        fputcsv($out, [
            $r['full_name'], $r['number'] ?: '', $r['comp_name'] ?: '', $r['nomination'] ?: '',
            $statusLabel[$r['status']] ?? $r['status'], $r['result'] ?: '', $r['diploma_number'] ?: '',
        ], ';');
    }
    fclose($out);
    exit;
}

// --- Данные для кабинета ---
$comps = all("SELECT id,slug,code,name,is_paid,price,status FROM competitions WHERE status IN ('open','judging') ORDER BY sort");

$filterComp = trim((string) input('competition', ''));
$sql = "SELECT a.*, c.name AS comp_name, c.slug AS comp_slug
        FROM applications a LEFT JOIN competitions c ON c.id = a.competition_id
        WHERE (a.user_id = ? OR (a.teacher <> '' AND a.teacher = ?))";
$params = [$uid, $user['full_name']];
if ($filterComp !== '') {
    $sql .= " AND (c.slug = ? OR c.id = ?)";
    $params[] = $filterComp;
    $params[] = ctype_digit($filterComp) ? (int) $filterComp : 0;
}
$sql .= " ORDER BY a.created_at DESC";
$myApps = all($sql, $params);

$allMyComps = all(
    "SELECT DISTINCT c.slug, c.name FROM applications a JOIN competitions c ON c.id = a.competition_id
     WHERE a.user_id = ? OR (a.teacher <> '' AND a.teacher = ?) ORDER BY c.name",
    [$uid, $user['full_name']]
);

$report = all(
    "SELECT a.full_name, a.number, c.name AS comp_name, a.nomination, a.status, a.result, d.number AS diploma_number, d.pdf_path
     FROM applications a
     LEFT JOIN competitions c ON c.id = a.competition_id
     LEFT JOIN diplomas d ON d.application_id = a.id
     WHERE a.user_id = ? OR (a.teacher <> '' AND a.teacher = ?)
     ORDER BY c.name, a.full_name",
    [$uid, $user['full_name']]
);

$ages = AGE_CATEGORIES();
$noms = array_keys(NOMINATIONS());
$forms = FORMATIONS();

$appStatus = ['new' => ['Новая', 'info'], 'paid' => ['Оплачена', 'info'], 'judging' => ['На оценке', 'warning'],
              'graded' => ['Оценена', 'success'], 'sent' => ['Диплом отправлен', 'success'], 'rejected' => ['Отклонена', 'error']];
$badge = fn(string $label, string $type) => '<span class="badge badge--' . ($type === 'success' ? 'open' : ($type === 'error' ? 'closed' : 'intl')) . '">' . h($label) . '</span>';

$icon = fn(string $p) => '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.6" style="flex:none">' . $p . '</svg>';
$icons = [
  'students' => $icon('<circle cx="9" cy="8" r="4"/><path d="M2 21v-1a6 6 0 0 1 6-6h2M16 11l2 2 4-4"/>'),
  'group'    => $icon('<circle cx="8" cy="8" r="3"/><circle cx="16" cy="8" r="3"/><path d="M2 20v-1a5 5 0 0 1 5-5h2M15 20v-1a5 5 0 0 1 5-5h0"/>'),
  'import'   => $icon('<path d="M12 3v12M7 10l5 5 5-5"/><path d="M4 20h16"/>'),
  'report'   => $icon('<path d="M6 2h9l5 5v15H6z"/><path d="M15 2v5h5M9 13h6M9 17h6M9 9h2"/>'),
];
$tabs = [
  ['students', 'Мои ученики и заявки'],
  ['group', 'Групповая подача'],
  ['import', 'Импорт из Excel/CSV'],
  ['report', 'Отчёт для директора'],
];

ob_start(); ?>
<style>
.tch{display:grid;grid-template-columns:250px 1fr;gap:32px;align-items:start}
.tch-side{position:sticky;top:96px;background:#fff;border:1px solid var(--line);border-radius:var(--radius);padding:20px;box-shadow:var(--shadow-card)}
.tch-user{display:flex;gap:12px;align-items:center;padding-bottom:16px;margin-bottom:12px;border-bottom:1px solid var(--line)}
.tch-ava{width:46px;height:46px;border-radius:50%;background:var(--grad-gold);color:#fff;display:flex;align-items:center;justify-content:center;font-family:var(--ff-head);font-size:1.2rem;flex:none}
.tch-nav{display:flex;flex-direction:column;gap:4px}
.tch-nav a{display:flex;align-items:center;gap:12px;padding:11px 14px;border-radius:var(--radius-sm);color:var(--navy);font-weight:600;font-size:.92rem}
.tch-nav a:hover{background:var(--gold-light)}
.tch-nav a.active{background:var(--grad-gold);color:#fff}
.tch-nav a.active svg{stroke:#fff}
.tch-panel{display:none}
.tch-panel.active{display:block}
.tch-card{background:#fff;border:1px solid var(--line);border-radius:var(--radius);padding:20px 22px;box-shadow:var(--shadow-card);margin-bottom:16px}
.tch-row{display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap;align-items:flex-start}
.tch-meta{color:var(--muted);font-size:.9rem;margin:6px 0 0}
.tch-empty{text-align:center;color:var(--muted);padding:40px 20px}
.t-table{width:100%;border-collapse:collapse;min-width:640px}
.t-table th,.t-table td{text-align:left;padding:11px 14px;border-bottom:1px solid var(--line);vertical-align:top;font-size:.9rem}
.t-table th{font-size:.76rem;text-transform:uppercase;letter-spacing:.05em;color:var(--muted)}
.t-table-wrap{overflow-x:auto}
.row-grid{display:grid;grid-template-columns:1.6fr 1fr 1fr 1fr 1.4fr auto;gap:10px;align-items:end;margin-bottom:12px;padding-bottom:12px;border-bottom:1px dashed var(--line)}
.row-grid .field{margin-bottom:0}
.row-grid .rm-row{height:44px;width:44px;flex:none;padding:0;color:var(--error);border-color:var(--error)}
@media(max-width:960px){.row-grid{grid-template-columns:1fr 1fr}.row-grid .rm-row{grid-column:span 2;width:100%}}
.discount-box{display:flex;justify-content:space-between;flex-wrap:wrap;gap:10px;align-items:center;background:var(--gold-light);border-radius:var(--radius-sm);padding:14px 18px;margin:16px 0}
.discount-box b{font-family:var(--ff-head);color:var(--gold-dark);font-size:1.3rem}
.file-drop{border:1.5px dashed var(--line);border-radius:var(--radius-sm);padding:20px;text-align:center;color:var(--muted)}
.import-err{color:var(--error);font-size:.86rem;margin:4px 0}
@media(max-width:860px){.tch{grid-template-columns:1fr}.tch-side{position:static}
  .tch-nav{flex-direction:row;overflow-x:auto;gap:6px}.tch-nav a{white-space:nowrap;padding:9px 12px}}
</style>
<section class="section">
  <div class="container">
    <div class="tch">
      <aside class="tch-side reveal">
        <div class="tch-user">
          <div class="tch-ava"><?= h(mb_strtoupper(mb_substr($user['full_name'] ?: $user['email'], 0, 1))) ?></div>
          <div style="min-width:0">
            <strong style="display:block;font-family:var(--ff-head)"><?= h($user['full_name'] ?: 'Педагог') ?></strong>
            <span style="color:var(--muted);font-size:.82rem;word-break:break-all"><?= h($user['email']) ?></span>
          </div>
        </div>
        <nav class="tch-nav" id="tchNav">
          <?php foreach ($tabs as $i => [$id, $label]): ?>
            <a href="#<?= $id ?>" data-tab="<?= $id ?>" class="<?= $i === 0 ? 'active' : '' ?>"><?= $icons[$id] ?> <?= h($label) ?></a>
          <?php endforeach; ?>
        </nav>
        <a class="cab-logout" style="display:block;text-align:center;margin-top:14px;color:var(--muted);font-size:.9rem" href="<?= url('/cabinet') ?>">Личный кабинет участника</a>
      </aside>

      <div class="tch-main">

        <!-- Мои ученики и заявки -->
        <div class="tch-panel active" id="ttab-students">
          <div class="section-head" style="margin-bottom:16px"><h2 style="margin:0">Мои ученики и заявки</h2></div>

          <form method="get" action="<?= url('/teacher') ?>" class="tch-card" style="display:flex;gap:14px;flex-wrap:wrap;align-items:end">
            <div class="field" style="margin:0;min-width:240px;flex:1">
              <label for="fComp">Фильтр по конкурсу</label>
              <select id="fComp" name="competition">
                <option value="">Все конкурсы</option>
                <?php foreach ($allMyComps as $c): ?>
                  <option value="<?= h($c['slug']) ?>" <?= $filterComp === $c['slug'] ? 'selected' : '' ?>><?= h($c['name']) ?></option>
                <?php endforeach; ?>
              </select>
            </div>
            <button class="btn btn--ghost" type="submit">Показать</button>
          </form>

          <?php if (!$myApps): ?>
            <div class="tch-card tch-empty"><p>Заявки, где Вы указаны педагогом или которые Вы подали, появятся здесь.</p></div>
          <?php else: foreach ($myApps as $a):
            [$sl, $st] = $appStatus[$a['status']] ?? [$a['status'], 'info']; ?>
            <div class="tch-card">
              <div class="tch-row">
                <div>
                  <strong style="font-family:var(--ff-head);font-size:1.05rem"><?= h($a['full_name']) ?></strong>
                  <p class="tch-meta">
                    <?php if ($a['number']): ?>№ <?= h($a['number']) ?> · <?php endif; ?>
                    <?= h($a['comp_name'] ?: 'Конкурс') ?> · <?= h($a['nomination'] ?: '') ?>
                  </p>
                  <p class="tch-meta">Подана <?= h(ru_date(substr((string) $a['created_at'], 0, 10))) ?></p>
                </div>
                <div style="text-align:right">
                  <?= $badge($sl, $st) ?>
                  <?php if (!empty($a['result'])): ?><p class="tch-meta" style="color:var(--gold-dark);font-weight:700"><?= h($a['result']) ?></p><?php endif; ?>
                </div>
              </div>
            </div>
          <?php endforeach; endif; ?>
        </div>

        <!-- Групповая подача -->
        <div class="tch-panel" id="ttab-group">
          <div class="section-head" style="margin-bottom:16px"><h2 style="margin:0">Групповая подача</h2>
            <p>Добавьте несколько учеников на один конкурс разом. Скидка за коллектив рассчитывается автоматически.</p>
          </div>

          <?php if (!$comps): ?>
            <div class="tch-card tch-empty"><p>Сейчас нет открытых конкурсов для приёма заявок.</p></div>
          <?php else: ?>
          <form id="groupForm" class="tch-card">
            <?= csrf_field() ?>
            <div class="grid grid-2">
              <div class="field">
                <label for="gComp">Конкурс</label>
                <select id="gComp" name="competition_id" required>
                  <option value="">Выберите конкурс</option>
                  <?php foreach ($comps as $c): ?>
                    <option value="<?= (int) $c['id'] ?>" data-paid="<?= (int) $c['is_paid'] ?>" data-price="<?= (int) $c['price'] ?>"><?= h($c['name']) ?></option>
                  <?php endforeach; ?>
                </select>
              </div>
              <div class="field">
                <label for="gFormation">Форма исполнения</label>
                <select id="gFormation" name="formation">
                  <option value="">Не указано</option>
                  <?php foreach ($forms as $f): ?><option value="<?= h($f) ?>"><?= h($f) ?></option><?php endforeach; ?>
                </select>
              </div>
            </div>
            <div class="grid grid-2">
              <div class="field">
                <label for="gGroupName">Название коллектива</label>
                <input type="text" id="gGroupName" name="group_name" placeholder="Образцовый ансамбль «Родник»">
              </div>
              <div class="field">
                <label for="gWorkTitle">Название номера (общее, необязательно)</label>
                <input type="text" id="gWorkTitle" name="work_title" placeholder="Сборный концертный номер">
              </div>
            </div>
            <div class="grid grid-2">
              <div class="field">
                <label for="gInstitution">Учреждение</label>
                <input type="text" id="gInstitution" name="institution" placeholder="Детская школа искусств №1" required>
              </div>
              <div class="field">
                <label for="gCity">Населённый пункт</label>
                <input type="text" id="gCity" name="city" placeholder="г. Москва" required>
              </div>
            </div>

            <label style="display:block;font-weight:600;margin:18px 0 8px">Ученики</label>
            <div id="groupRows">
              <div class="row-grid" data-row>
                <div class="field"><label>ФИО</label><input type="text" name="rows[0][full_name]" placeholder="Иванова Мария Петровна" required></div>
                <div class="field"><label>Дата рождения</label><input type="date" name="rows[0][birth_date]" max="<?= date('Y-m-d') ?>"></div>
                <div class="field"><label>Категория</label>
                  <select name="rows[0][age_category]" required>
                    <option value="">Выберите</option>
                    <?php foreach ($ages as $a): ?><option value="<?= h($a) ?>"><?= h($a) ?></option><?php endforeach; ?>
                  </select>
                </div>
                <div class="field"><label>Номинация</label>
                  <select name="rows[0][nomination]" required>
                    <option value="">Выберите</option>
                    <?php foreach ($noms as $n): ?><option value="<?= h($n) ?>"><?= h($n) ?></option><?php endforeach; ?>
                  </select>
                </div>
                <div class="field"><label>Ссылка на выступление</label><input type="url" name="rows[0][video_url]" placeholder="https://rutube.ru/video/..."></div>
                <button type="button" class="btn btn--ghost rm-row" title="Удалить ученика">&times;</button>
              </div>
            </div>
            <button type="button" class="btn btn--ghost" id="addRowBtn">Добавить ученика</button>

            <div class="discount-box">
              <span>Участников: <b id="gCount">1</b> · скидка коллектива: <b id="gDiscount">0%</b></span>
              <span>Сумма к оплате: <b id="gTotal">0 ₽</b></span>
            </div>

            <button class="btn btn--primary btn--lg btn--block" type="submit" id="gSubmit">Подать групповую заявку</button>
            <p id="gMsg" style="text-align:center;margin-top:14px"></p>
          </form>

          <template id="groupRowTpl">
            <div class="row-grid" data-row>
              <div class="field"><label>ФИО</label><input type="text" name="rows[__I__][full_name]" placeholder="Иванова Мария Петровна" required></div>
              <div class="field"><label>Дата рождения</label><input type="date" name="rows[__I__][birth_date]" max="<?= date('Y-m-d') ?>"></div>
              <div class="field"><label>Категория</label>
                <select name="rows[__I__][age_category]" required>
                  <option value="">Выберите</option>
                  <?php foreach ($ages as $a): ?><option value="<?= h($a) ?>"><?= h($a) ?></option><?php endforeach; ?>
                </select>
              </div>
              <div class="field"><label>Номинация</label>
                <select name="rows[__I__][nomination]" required>
                  <option value="">Выберите</option>
                  <?php foreach ($noms as $n): ?><option value="<?= h($n) ?>"><?= h($n) ?></option><?php endforeach; ?>
                </select>
              </div>
              <div class="field"><label>Ссылка на выступление</label><input type="url" name="rows[__I__][video_url]" placeholder="https://rutube.ru/video/..."></div>
              <button type="button" class="btn btn--ghost rm-row" title="Удалить ученика">&times;</button>
            </div>
          </template>
          <?php endif; ?>
        </div>

        <!-- Импорт из Excel/CSV -->
        <div class="tch-panel" id="ttab-import">
          <div class="section-head" style="margin-bottom:16px"><h2 style="margin:0">Импорт из Excel/CSV</h2>
            <p>Загрузите файл со списком учеников. Каждая строка — ФИО, возрастная категория, номинация, ссылка на выступление.
               Сначала покажем превью, заявки создаются только после подтверждения.</p>
          </div>

          <?php if (!$comps): ?>
            <div class="tch-card tch-empty"><p>Сейчас нет открытых конкурсов для приёма заявок.</p></div>
          <?php else: ?>
          <form id="importForm" class="tch-card" enctype="multipart/form-data">
            <?= csrf_field() ?>
            <div class="grid grid-2">
              <div class="field">
                <label for="iComp">Конкурс</label>
                <select id="iComp" name="competition_id" required>
                  <option value="">Выберите конкурс</option>
                  <?php foreach ($comps as $c): ?><option value="<?= (int) $c['id'] ?>"><?= h($c['name']) ?></option><?php endforeach; ?>
                </select>
              </div>
              <div class="field">
                <label for="iInstitution">Учреждение</label>
                <input type="text" id="iInstitution" name="institution" placeholder="Детская школа искусств №1" required>
              </div>
            </div>
            <div class="grid grid-2">
              <div class="field">
                <label for="iCity">Населённый пункт</label>
                <input type="text" id="iCity" name="city" placeholder="г. Москва" required>
              </div>
              <div class="field">
                <label style="display:flex;gap:10px;align-items:center;margin-top:30px">
                  <input type="checkbox" name="has_header" value="1" checked style="width:auto">
                  Первая строка файла — заголовки столбцов
                </label>
              </div>
            </div>
            <div class="field">
              <label for="iFile">Файл CSV</label>
              <div class="file-drop">
                <input type="file" id="iFile" name="file" accept=".csv,text/csv" required style="width:auto">
                <p class="hint" style="margin-top:10px">Столбцы через запятую или точку с запятой: ФИО; категория; номинация; ссылка.</p>
              </div>
            </div>
            <div style="display:flex;gap:12px;flex-wrap:wrap">
              <button class="btn btn--ghost" type="button" id="iPreviewBtn">Показать превью</button>
              <button class="btn btn--primary" type="button" id="iCommitBtn" disabled>Создать заявки</button>
            </div>
            <div id="iResult" style="margin-top:18px"></div>
          </form>
          <?php endif; ?>
        </div>

        <!-- Единый отчёт для директора -->
        <div class="tch-panel" id="ttab-report">
          <div class="section-head" style="margin-bottom:16px;display:flex;justify-content:space-between;flex-wrap:wrap;gap:12px;align-items:center">
            <div><h2 style="margin:0">Единый отчёт для директора</h2><p style="margin:4px 0 0">Сводная таблица по всем ученикам и результатам.</p></div>
            <a class="btn btn--primary" href="<?= url('/teacher') ?>?report=csv">Скачать отчёт (CSV)</a>
          </div>
          <?php if (!$report): ?>
            <div class="tch-card tch-empty"><p>Данных для отчёта пока нет.</p></div>
          <?php else: ?>
          <div class="tch-card t-table-wrap">
            <table class="t-table">
              <thead><tr><th>Ученик</th><th>Конкурс</th><th>Результат</th><th>Диплом</th></tr></thead>
              <tbody>
                <?php foreach ($report as $r): ?>
                  <tr>
                    <td><?= h($r['full_name']) ?><br><span class="tch-meta">№ <?= h($r['number']) ?></span></td>
                    <td><?= h($r['comp_name'] ?: '') ?><br><span class="tch-meta"><?= h($r['nomination'] ?: '') ?></span></td>
                    <td><?= h($r['result'] ?: '-') ?></td>
                    <td>
                      <?php if (!empty($r['diploma_number'])): ?>
                        № <?= h($r['diploma_number']) ?>
                        <?php if (!empty($r['pdf_path'])): ?><br><a href="<?= h(str_starts_with((string) $r['pdf_path'], 'http') ? $r['pdf_path'] : url($r['pdf_path'])) ?>" target="_blank" rel="noopener">Скачать</a><?php endif; ?>
                      <?php else: ?>-<?php endif; ?>
                    </td>
                  </tr>
                <?php endforeach; ?>
              </tbody>
            </table>
          </div>
          <?php endif; ?>
        </div>

      </div>
    </div>
  </div>
</section>
<script>
(function () {
  var nav = document.getElementById('tchNav');
  if (!nav) return;
  var links = nav.querySelectorAll('a[data-tab]');
  function show(id) {
    document.querySelectorAll('.tch-panel').forEach(function (p) { p.classList.toggle('active', p.id === 'ttab-' + id); });
    links.forEach(function (a) { a.classList.toggle('active', a.getAttribute('data-tab') === id); });
  }
  links.forEach(function (a) { a.addEventListener('click', function (e) { e.preventDefault(); var id = a.getAttribute('data-tab'); show(id); history.replaceState(null, '', '#' + id); }); });
  var h = (location.hash || '').replace('#', '');
  if (h && document.getElementById('ttab-' + h)) show(h);
})();

// --- Групповая подача: динамические строки + расчёт скидки ---
(function () {
  var form = document.getElementById('groupForm');
  if (!form) return;
  var rowsBox = document.getElementById('groupRows');
  var tpl = document.getElementById('groupRowTpl');
  var addBtn = document.getElementById('addRowBtn');
  var compSel = document.getElementById('gComp');
  var countEl = document.getElementById('gCount');
  var discEl = document.getElementById('gDiscount');
  var totalEl = document.getElementById('gTotal');
  var msg = document.getElementById('gMsg');
  var idx = 1;

  function discountFor(n) {
    if (n >= 10) return 20;
    if (n >= 5) return 15;
    if (n >= 3) return 10;
    return 0;
  }
  function money(n) { return n.toLocaleString('ru-RU') + ' ₽'; }
  function recompute() {
    var n = rowsBox.querySelectorAll('[data-row]').length;
    countEl.textContent = n;
    var opt = compSel.options[compSel.selectedIndex];
    var paid = opt ? parseInt(opt.getAttribute('data-paid'), 10) : 0;
    var price = opt ? parseInt(opt.getAttribute('data-price'), 10) || 0 : 0;
    var d = discountFor(n);
    discEl.textContent = d + '%';
    var total = paid ? Math.round(price * n * (100 - d) / 100) : 0;
    totalEl.textContent = money(total);
  }
  function refreshRemoveButtons() {
    var rows = rowsBox.querySelectorAll('[data-row]');
    rows.forEach(function (r) {
      var btn = r.querySelector('.rm-row');
      btn.style.visibility = rows.length > 1 ? 'visible' : 'hidden';
    });
  }

  addBtn.addEventListener('click', function () {
    var html = tpl.innerHTML.split('__I__').join(String(idx++));
    var wrap = document.createElement('div');
    wrap.innerHTML = html.trim();
    rowsBox.appendChild(wrap.firstElementChild);
    refreshRemoveButtons();
    recompute();
  });
  rowsBox.addEventListener('click', function (e) {
    if (e.target.classList.contains('rm-row')) {
      var rows = rowsBox.querySelectorAll('[data-row]');
      if (rows.length > 1) { e.target.closest('[data-row]').remove(); refreshRemoveButtons(); recompute(); }
    }
  });
  compSel.addEventListener('change', recompute);
  refreshRemoveButtons();
  recompute();

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (!form.checkValidity()) { form.reportValidity(); return; }
    var btn = document.getElementById('gSubmit');
    btn.disabled = true; btn.textContent = 'Отправляем...';
    var fd = new FormData(form);
    fetch('<?= url('/api/v1/teacher_group') ?>', { method: 'POST', body: fd })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        btn.disabled = false; btn.textContent = 'Подать групповую заявку';
        if (d && d.ok) {
          msg.style.color = 'var(--mint)';
          var txt = 'Заявки поданы. Номера: ' + (d.numbers || []).join(', ') + '.';
          if (d.payment && d.payment.confirmation_url) txt += ' Оплата: ' + d.payment.confirmation_url;
          msg.textContent = txt;
        } else {
          msg.style.color = 'var(--error)';
          msg.textContent = (d && d.error) || 'Не удалось подать групповую заявку.';
        }
      })
      .catch(function () {
        btn.disabled = false; btn.textContent = 'Подать групповую заявку';
        msg.style.color = 'var(--error)';
        msg.textContent = 'Не удалось отправить данные. Проверьте соединение и попробуйте снова.';
      });
  });
})();

// --- Импорт из Excel/CSV: превью и создание заявок ---
(function () {
  var form = document.getElementById('importForm');
  if (!form) return;
  var previewBtn = document.getElementById('iPreviewBtn');
  var commitBtn = document.getElementById('iCommitBtn');
  var resultBox = document.getElementById('iResult');

  function renderPreview(d) {
    var html = '<p><b>' + (d.total || 0) + '</b> строк в файле, к загрузке готово <b>' + (d.valid || 0) + '</b>.</p>';
    if (d.errors && d.errors.length) {
      html += '<div class="import-err">' + d.errors.map(function (er) { return 'Строка ' + er.row + ': ' + er.message; }).join('<br>') + '</div>';
    }
    if (d.preview && d.preview.length) {
      html += '<div class="t-table-wrap"><table class="t-table"><thead><tr><th>ФИО</th><th>Категория</th><th>Номинация</th><th>Ссылка</th></tr></thead><tbody>';
      d.preview.forEach(function (p) {
        html += '<tr><td>' + p.full_name + '</td><td>' + p.age_category + '</td><td>' + p.nomination + '</td><td>' + (p.video_url || '-') + '</td></tr>';
      });
      html += '</tbody></table></div>';
    }
    resultBox.innerHTML = html;
  }

  previewBtn.addEventListener('click', function () {
    if (!form.checkValidity()) { form.reportValidity(); return; }
    previewBtn.disabled = true; previewBtn.textContent = 'Читаем файл...';
    var fd = new FormData(form);
    fd.append('mode', 'preview');
    fetch('<?= url('/api/v1/teacher_import') ?>', { method: 'POST', body: fd })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        previewBtn.disabled = false; previewBtn.textContent = 'Показать превью';
        if (d && d.ok) {
          renderPreview(d);
          commitBtn.disabled = !(d.valid > 0);
        } else {
          resultBox.innerHTML = '<p class="import-err">' + ((d && d.error) || 'Не удалось прочитать файл.') + '</p>';
          commitBtn.disabled = true;
        }
      })
      .catch(function () {
        previewBtn.disabled = false; previewBtn.textContent = 'Показать превью';
        resultBox.innerHTML = '<p class="import-err">Не удалось отправить файл. Проверьте соединение.</p>';
      });
  });

  commitBtn.addEventListener('click', function () {
    commitBtn.disabled = true; commitBtn.textContent = 'Создаём заявки...';
    var fd = new FormData(form);
    fd.append('mode', 'commit');
    fetch('<?= url('/api/v1/teacher_import') ?>', { method: 'POST', body: fd })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        commitBtn.textContent = 'Создать заявки';
        if (d && d.ok) {
          resultBox.innerHTML = '<p style="color:var(--mint)">Создано заявок: <b>' + d.created + '</b>' +
            (d.numbers && d.numbers.length ? ' (' + d.numbers.join(', ') + ')' : '') + '.</p>';
          commitBtn.disabled = true;
        } else {
          commitBtn.disabled = false;
          resultBox.innerHTML = '<p class="import-err">' + ((d && d.error) || 'Не удалось создать заявки.') + '</p>';
        }
      })
      .catch(function () {
        commitBtn.disabled = false; commitBtn.textContent = 'Создать заявки';
        resultBox.innerHTML = '<p class="import-err">Не удалось отправить данные. Проверьте соединение.</p>';
      });
  });
})();
</script>
<?php
$content = ob_get_clean();
render_page('Кабинет педагога', $content, [
    'active' => '/teacher',
    'meta'   => 'Кабинет педагога КЦ «Музыкальный Мир»: групповые заявки, импорт учеников, единый отчёт для директора.',
]);
