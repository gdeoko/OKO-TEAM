<?php
/**
 * ДЛИННЫЕ КОНКУРСЫ (results_mode='list') — раздел «Оценка длинных» (Величие России и т.п.).
 *
 * Полный функционал как в «Оценка коротких», НО результат не рассылается по одному —
 * итоги копятся списком и публикуются пакетом (кнопка «Опубликовать результаты»).
 *   • Два списка: «На аттестации» (без результата) и «Оценённые» (с результатом).
 *   • «Оценить» открывает ту же карточку grading (видео, комментарий, звание, доп, отклонение).
 *   • Результаты формируются таблицей по эталону: ФИО/коллектив · конкурсный номер · страна/город · результат.
 *   • Скачивание результатов в DOCX (эталон, 1 страница) + печать/PDF.
 */
declare(strict_types=1);

require_once BASE_PATH . '/core/presets.php';
require_once BASE_PATH . '/core/graded_list.php';
if (is_file(BASE_PATH . '/core/text_format.php')) require_once BASE_PATH . '/core/text_format.php';

try { db()->exec("ALTER TABLE competitions ADD COLUMN results_published_at TEXT"); } catch (\Throwable $e) {}

/* ------------------------------- POST -------------------------------- */
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if (!csrf_check()) { flash('Сессия устарела.', 'error'); admin_redirect('longcomp'); }
    // Перенос отправки, снятие отклонения и дублирование — общие для обоих разделов оценки.
    admin_graded_actions('longcomp', array_filter(['competition' => (int) input('competition'), 'q' => trim(input('q'))]));
    $do  = input('do');
    $cid = (int) input('competition');
    $aid = (int) input('id');

    if ($do === 'publish' && $cid) {
        update('competitions', ['results_published_at' => date('Y-m-d H:i:s')], 'id=:id', ['id' => $cid]);
        audit('longcomp_publish', 'competition', $cid, []);
        flash('Результаты опубликованы — участники видят звания и могут заказать награды. Рассылка дипломов пойдёт по расписанию.', 'success');
        admin_redirect('longcomp', ['competition' => $cid]);
    }
    if ($do === 'unpublish' && $cid) {
        update('competitions', ['results_published_at' => null], 'id=:id', ['id' => $cid]);
        audit('longcomp_unpublish', 'competition', $cid, []);
        flash('Публикация снята — результаты снова скрыты от участников.', 'info');
        admin_redirect('longcomp', ['competition' => $cid]);
    }
    if ($do === 'delete' && $aid) {
        q("DELETE FROM applications WHERE id=? AND competition_id=?", [$aid, $cid]);
        q("DELETE FROM diplomas WHERE application_id=? AND sent_at IS NULL", [$aid]);
        audit('longcomp_delete', 'application', $aid, ['competition' => $cid]);
        flash('Заявка удалена.', 'success');
        admin_redirect('longcomp', ['competition' => $cid]);
    }
    if ($do === 'reject' && $aid) {
        $reason = trim(input('reject_reason')) ?: 'Нарушение правил положения.';
        update('applications', ['status' => 'rejected', 'reject_reason' => $reason], 'id=:id', ['id' => $aid]);
        // Отклонённой работе наградные материалы не полагаются: снимаем бланки,
        // файлы и неотправленное письмо.
        require_once BASE_PATH . '/core/diploma_sync.php';
        dsync_drop($aid, 'заявка отклонена: ' . mb_substr($reason, 0, 80));
        audit('longcomp_reject', 'application', $aid, ['competition' => $cid, 'reason' => $reason]);
        flash('Заявка отклонена.', 'success');
        admin_redirect('longcomp', ['competition' => $cid]);
    }
    admin_redirect('longcomp');
}

/* --------------------- ДАННЫЕ + выбор конкурса ----------------------- */
$longComps = all("SELECT * FROM competitions WHERE results_mode='list' ORDER BY sort, name");
$comp = (int) input('competition');
if (!$comp && $longComps) $comp = (int) $longComps[0]['id'];
$current = $comp ? one("SELECT * FROM competitions WHERE id=? AND results_mode='list'", [$comp]) : null;

/* ------- Помощник: строка «страна/город» и «участник/коллектив» ------- */
$whoName = static fn(array $a): string => trim((string) $a['group_name']) !== ''
    ? trim((string) $a['group_name']) : trim((string) $a['full_name']);
// Страна и город — общим правилом (core/text_format.php::city_display): пустой
// город больше не превращается в «Россия», а нераспознанный не получает её
// приписку. Участник из Дубая в протоколе должен быть из Дубая.
$whoPlace = static fn(array $a): string => function_exists('city_display')
    ? city_display((string) ($a['city'] ?? ''), '—')
    : trim((string) ($a['city'] ?? ''));

/* --------------- Экспорт результатов в DOCX (эталон-шапка + таблица) -------------- */
if ($current && input('do') === 'results_doc') {
    require_once BASE_PATH . '/core/results_doc.php';
    try {
        $path = results_docx((int) $comp);
    } catch (\Throwable $e) {
        http_response_code(500);
        flash('Не удалось сформировать список результатов: ' . $e->getMessage(), 'error');
        admin_redirect('longcomp', ['competition' => $comp]);
    }
    $fn = 'РЕЗУЛЬТАТЫ КОНКУРСА ' . preg_replace('~[^\p{L}\p{N} ]+~u', '', (string) $current['name']) . '.docx';
    header('Content-Type: application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    header('Content-Disposition: attachment; filename="' . rawurlencode($fn) . '"; filename*=UTF-8\'\'' . rawurlencode($fn));
    header('Content-Length: ' . filesize($path));
    readfile($path);
    @unlink($path);
    exit;
}

ob_start(); ?>
<div class="page-head">
  <h1>Оценка длинных</h1>
  <p class="muted small">Полная оценка как у коротких, но результаты копятся списком и публикуются пакетом. «Оценить» открывает карточку с видео, комментарием, званием, доп. дипломом и отклонением.</p>
</div>

<form method="get" class="filters">
  <input type="hidden" name="p" value="longcomp">
  <div class="field"><label>Конкурс</label>
    <select name="competition" onchange="this.form.submit()">
      <?php foreach ($longComps as $c): ?>
        <option value="<?= (int)$c['id'] ?>" <?= $comp===(int)$c['id']?'selected':'' ?>><?= h($c['name']) ?></option>
      <?php endforeach; ?>
    </select>
  </div>
  <div class="field"><label>Поиск по обоим спискам</label><input name="q" value="<?= h(input('q')) ?>" placeholder="ФИО, коллектив, №, email, телефон, номер, звание"></div>
  <div class="field"><label>Сортировка очереди на аттестацию</label><select name="order" onchange="this.form.submit()">
    <option value="old" <?= input('order')!=='new'?'selected':'' ?>>Сначала старые заявки (по дате подачи)</option>
    <option value="new" <?= input('order')==='new'?'selected':'' ?>>Сначала новые заявки (по дате подачи)</option>
  </select></div>
  <?php // Архив «разобранных» всегда идёт снизу в порядке «последние оценённые сверху» —
        // единственный удобный порядок при проверке своих же недавних решений. Переключатель убран. ?>
  <button class="btn btn--primary btn--sm"><?= admin_icon('search') ?>Поиск</button>
  <?php if (trim(input('q')) !== ''): ?><a class="btn btn--ghost btn--sm" href="<?= a_link('longcomp', ['competition'=>$comp]) ?>">Сброс</a><?php endif; ?>
</form>

<?php if (!$longComps): ?>
  <div class="card"><p class="muted">Длинных конкурсов (режим результатов «список») пока нет. Режим задаётся в «Конкурсы» → «Результаты списком».</p></div>
<?php elseif (!$current): ?>
  <div class="card"><p class="muted">Конкурс не найден.</p></div>
<?php else:
  // Верхний список — только то, что ждёт аттестации. Отклонённые сюда не входят:
  // они уже разобраны и живут в нижнем списке вместе с оценёнными.
  // Сортировка — по ДАТЕ ПОДАЧИ (created_at), не по алфавиту: администратору важен
  // порядок поступления, а не имя. Переключатель «старые ↔ новые» — в фильтрах выше.
  $qOrder = input('order') === 'new' ? 'new' : 'old';
  $dir = $qOrder === 'new' ? 'DESC' : 'ASC';
  $all = all("SELECT * FROM applications WHERE competition_id=? AND is_paid=1 AND status<>'rejected'
              ORDER BY created_at $dir, id $dir", [$comp]);
  $qLong = trim(input('q'));
  if ($qLong !== '') {
      // Многословный поиск: «иванова вальс» найдёт строку, где есть оба фрагмента.
      $words = array_slice(preg_split('/\s+/u', mb_strtolower($qLong)) ?: [], 0, 5);
      $all = array_values(array_filter($all, function ($a) use ($words) {
          $hay = mb_strtolower(trim(implode(' ', [
              (string)($a['full_name'] ?? ''), (string)($a['group_name'] ?? ''), (string)($a['number'] ?? ''),
              (string)($a['email'] ?? ''), (string)($a['phone'] ?? ''), (string)($a['work_title'] ?? ''),
              (string)($a['teacher'] ?? ''), (string)($a['institution'] ?? ''), (string)($a['city'] ?? ''),
              (string)($a['nomination'] ?? ''), (string)($a['result'] ?? ''),
          ])));
          foreach ($words as $w) { if ($w !== '' && !str_contains($hay, $w)) return false; }
          return true;
      }));
  }
  $toGrade = array_values(array_filter($all, fn($a) => trim((string)$a['result']) === ''));
  $graded  = array_values(array_filter($all, fn($a) => trim((string)$a['result']) !== ''));
  // Нижний список — общий с короткими: оценённые И отклонённые, с полным набором
  // действий. Эталон-таблица результатов ниже строится отдельно и только из
  // оценённых: отклонённой заявке в списке итогов конкурса делать нечего.
  // Архив всегда «последние оценённые сверху» — переключатель убран, см. фильтры выше.
  $gradedRows = graded_rows($comp, $qLong, 'new', 'long');
  $tot = count($all); $done = count($graded);
  $pct = $tot ? (int) round($done / $tot * 100) : 0;
  $published = trim((string)($current['results_published_at'] ?? '')) !== '';
  $pubDate = trim((string)($current['results_date'] ?? ''));
?>
  <div class="card" style="margin-bottom:16px">
    <div class="section-title" style="margin-bottom:8px"><h3><?= h((string)$current['name']) ?></h3>
      <span class="badge <?= $published ? 'badge--open' : 'badge--muted' ?>"><?= $published ? 'Результаты опубликованы' : 'Черновик (скрыто)' ?></span>
    </div>
    <div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap;margin-bottom:10px">
      <div class="small muted">Оценено: <b style="color:var(--a-navy)"><?= $done ?></b> из <?= $tot ?> (<?= $pct ?>%)</div>
      <div style="flex:1;min-width:160px;height:8px;border-radius:6px;background:rgba(0,0,0,.08);overflow:hidden">
        <div style="width:<?= $pct ?>%;height:100%;background:var(--a-navy)"></div>
      </div>
      <?php if ($pubDate): ?><div class="small muted">Дата публикации: <b><?= h(date('d.m.Y', strtotime($pubDate))) ?></b></div><?php endif; ?>
    </div>
    <div class="toolbar" style="gap:8px;flex-wrap:wrap">
      <a class="btn btn--navy btn--sm" href="<?= a_link('longcomp', ['competition'=>$comp,'do'=>'results_doc']) ?>"><?= admin_icon('diplomas') ?>Скачать результаты (DOCX)</a>
      <?php // Выгрузки переехали сюда из «Оценки коротких»: там они стояли в панели
            // длинного конкурса и были единственной причиной, по которой длинный
            // конкурс вообще показывался в чужом разделе. ?>
      <a class="btn btn--navy btn--sm" href="<?= a_link('grading', ['action'=>'results_csv','competition'=>$comp]) ?>"><?= admin_icon('download') ?>CSV</a>
      <a class="btn btn--navy btn--sm" target="_blank" href="<?= a_link('grading', ['action'=>'results_html','competition'=>$comp]) ?>"><?= admin_icon('eye') ?>HTML для печати</a>
      <a class="btn btn--ghost btn--sm" href="<?= a_link('longcomp', ['competition'=>$comp]) ?>#results-preview">Открыть список</a>
      <?php if (!$published): ?>
        <form method="post" action="<?= url('/admin/') ?>" onsubmit="return confirm('Опубликовать результаты? Участники увидят звания и смогут заказать награды.')"><?= csrf_field() ?>
          <input type="hidden" name="do" value="publish"><input type="hidden" name="competition" value="<?= $comp ?>">
          <button class="btn btn--primary btn--sm"><?= admin_icon('check') ?>Опубликовать результаты</button>
        </form>
      <?php else: ?>
        <form method="post" action="<?= url('/admin/') ?>" onsubmit="return confirm('Снять публикацию?')"><?= csrf_field() ?>
          <input type="hidden" name="do" value="unpublish"><input type="hidden" name="competition" value="<?= $comp ?>">
          <button class="btn btn--ghost btn--sm"><?= admin_icon('x') ?>Снять публикацию</button>
        </form>
      <?php endif; ?>
    </div>
  </div>

  <?php
    // Текст поста-объявления результатов (по эталону) — для публикации рядом с PDF.
    $postText = "Результаты\n\nДля просмотра результатов конкурса откройте pdf файл, прикреплённый к данному посту "
        . "(РЕЗУЛЬТАТЫ КОНКУРСА «" . mb_strtoupper((string)$current['name']) . "».pdf).\n"
        . "📃Поиск осуществляется по:\n"
        . "• Фамилии и имени конкурсанта, название коллектива, название конкурсного номера";
  ?>
  <div class="card" style="margin-bottom:16px">
    <div class="section-title" style="margin-bottom:8px"><h3>Пост-объявление результатов (по эталону)</h3></div>
    <p class="small muted" style="margin:-4px 0 10px">Текст поста для публикации рядом с PDF-файлом результатов. Кнопка — скопировать. PDF/DOCX — выше «Скачать результаты».</p>
    <textarea id="postText" readonly style="width:100%;min-height:120px;padding:12px 14px;border:1px solid var(--a-line);border-radius:10px;font-size:.92rem;line-height:1.6;resize:vertical"><?= h($postText) ?></textarea>
    <div style="margin-top:8px"><button type="button" class="btn btn--navy btn--sm" onclick="var t=document.getElementById('postText');t.select();document.execCommand('copy');this.textContent='Скопировано ✓'">Скопировать текст поста</button></div>
  </div>

  <?php
  // Печать одной строки-заявки с действиями.
  $rowActions = function(array $a) use ($comp) {
    $aid = (int)$a['id'];
    ob_start(); ?>
      <a class="btn btn--navy btn--sm" href="<?= a_link('grading', ['id'=>$aid]) ?>"><?= admin_icon('grading') ?>Оценить</a>
      <?php // Отклонить — только ВНУТРИ заявки (после просмотра), в списке кнопки нет. ?>
      <form method="post" action="<?= url('/admin/') ?>" style="display:inline" onsubmit="return confirm('Удалить заявку безвозвратно?')"><?= csrf_field() ?>
        <input type="hidden" name="do" value="delete"><input type="hidden" name="competition" value="<?= $comp ?>"><input type="hidden" name="id" value="<?= $aid ?>">
        <button class="btn btn--ghost btn--sm">Удалить</button>
      </form>
    <?php return ob_get_clean();
  };
  ?>

  <!-- СПИСОК 1: НА АТТЕСТАЦИИ -->
  <?php
  /* ОЧЕРЕДЬ ДЛИННОГО КОНКУРСА — ТАКАЯ ЖЕ, КАК У КОРОТКИХ.
     Здесь стоял сокращённый список из трёх колонок, без даты подачи, без статуса
     и без подсказки аттестации. Подсказки при этом считались: по «Величию России»
     их было 250 при 444 заявках — просто показать их было негде, и раздел
     выглядел так, будто автоматическая оценка длинные не берёт вовсе.
     Один запрос на весь список: разборы берём пачкой, а не по строке. */
  $agHints = [];
  $agFails = [];
  if ($toGrade) {
      $ids = implode(',', array_map(static fn($r) => (int) $r['id'], $toGrade));
      try {
          foreach (all("SELECT application_id, title, total, reject_hint FROM grading_runs
                         WHERE status='ok' AND application_id IN ($ids)
                      ORDER BY id ASC") as $g) {
              $agHints[(int) $g['application_id']] = $g;   // последний разбор перекрывает ранний
          }
      } catch (\Throwable $e) { $agHints = []; }
      /* Запись не открылась — в списке это видно так же прямо, как подсказка:
         иначе работа выглядит необработанной и её ждут неделями. */
      try {
          foreach (all("SELECT application_id, COUNT(*) n, MAX(error) err FROM grading_runs
                         WHERE status='failed' AND application_id IN ($ids)
                      GROUP BY application_id") as $g) {
              $aid = (int) $g['application_id'];
              if (isset($agHints[$aid])) continue;
              $agFails[$aid] = $g;
          }
      } catch (\Throwable $e) { $agFails = []; }
  }
  ?>
  <div class="card" style="margin-bottom:16px">
    <div class="section-title" style="margin-bottom:8px"><h3>На аттестации <span class="badge badge--muted"><?= count($toGrade) ?></span></h3></div>
    <?php if (!$toGrade): ?>
      <p class="muted small">Все заявки оценены.</p>
    <?php else: ?>
    <div class="table-wrap"><table class="tbl">
      <thead><tr>
        <th>Участник</th><th>Конкурс</th><th>Конкурсный номер</th><th>Подана</th><th>Подсказка</th><th>Статус</th><th style="width:280px">Действия</th>
      </tr></thead>
      <tbody>
        <?php foreach ($toGrade as $a): ?>
          <tr>
            <td><b><?= h($whoName($a)) ?></b><?= vip_mark((int)($a['user_id'] ?? 0), '', (string)($a['email'] ?? '')) ?>
              <div class="small muted"><?= h((string)$a['number']) ?><?php $pl = $whoPlace($a); echo $pl !== '' ? ' · ' . h($pl) : ''; ?></div>
            </td>
            <td class="small"><?= h((string)$current['name']) ?></td>
            <td class="small"><?= h((string)$a['work_title']) ?></td>
            <td class="small"><?= h(date('d.m.y H:i', strtotime((string)$a['created_at']))) ?></td>
            <td class="small">
              <?php
              /* Нарушение положения читается как отказ, а не как низкая оценка:
                 в списке это видно сразу, вместе с пунктом. */
              $hint = $agHints[(int) $a['id']] ?? null;
              $rej  = $hint ? trim((string) ($hint['reject_hint'] ?? '')) : '';
              if ($rej !== ''): ?>
                <span style="color:#8B2F2F;font-weight:700">Отклонить</span>
                <div class="small" style="color:#8B2F2F;opacity:.85;line-height:1.3"><?= h(mb_substr(strtok($rej, "\n"), 0, 60)) ?></div>
              <?php elseif ($hint): ?>
                <span style="color:#39618f;font-weight:600"><?= h((string) $hint['title']) ?></span>
                <span class="muted"> · <?= number_format((float) $hint['total'], 1, ',', ' ') ?></span>
              <?php elseif (!empty($agFails[(int) $a['id']])): $f = $agFails[(int) $a['id']]; ?>
                <span style="color:#8B6F1F;font-weight:600">Запись недоступна</span>
                <div class="small" style="color:#8B6F1F;opacity:.85;line-height:1.3">
                  <?= h(mb_substr(preg_replace('~^запись не получена:\s*~u', '', (string) $f['err']) ?: '', 0, 54)) ?>
                </div>
              <?php else: ?>
                <span class="muted">—</span>
              <?php endif; ?>
            </td>
            <td><span class="badge badge--<?= h((string)$a['status']) ?>"><?= h(app_status_ru((string)$a['status'])) ?></span></td>
            <td style="white-space:nowrap"><?= $rowActions($a) ?></td>
          </tr>
        <?php endforeach; ?>
      </tbody>
    </table></div>
    <?php endif; ?>
  </div>

  <!-- СПИСОК 2: РАЗОБРАННЫЕ (оценённые + отклонённые), полный набор действий -->
  <div class="card" id="graded" style="margin-bottom:16px">
    <div class="section-title" style="margin-bottom:8px">
      <h3>Оценённые и отклонённые <span class="badge badge--gold"><?= count($gradedRows) ?></span></h3>
    </div>
    <p class="small muted" style="margin:-4px 0 12px">
      Всё, что уже разобрано. Отклонённые остаются здесь — решение по заявке принято, и проверить его
      должно быть где. «Изменить» открывает карточку оценки: там правится и результат, и сама заявка.
    </p>
    <?= admin_graded_table($gradedRows, 'longcomp', array_filter(['competition' => $comp, 'q' => $qLong])) ?>
  </div>

  <!-- СПИСОК 3: ЭТАЛОН-ТАБЛИЦА ИТОГОВ (то, что уйдёт в DOCX и в пост) -->
  <div class="card" id="results-preview">
    <div class="section-title" style="margin-bottom:8px"><h3>Список итогов по эталону <span class="badge badge--gold"><?= count($graded) ?></span></h3></div>
    <?php if (!$graded): ?>
      <p class="muted small">Оценённых заявок пока нет.</p>
    <?php else: ?>
    <p class="small muted" style="margin:0 0 10px">Ровно то, что попадёт в DOCX и в пост с итогами. Отклонённых здесь нет.</p>
    <div class="table-wrap"><table class="tbl">
      <thead><tr><th>Ф.И.О. участника / коллектив</th><th>Название конкурсного номера</th><th>Страна / город</th><th>Аттестационный результат</th><th style="width:280px">Действия</th></tr></thead>
      <tbody>
        <?php foreach ($graded as $a): ?>
          <tr>
            <td><?= h($whoName($a)) ?><?= vip_mark((int)($a['user_id'] ?? 0), '', (string)($a['email'] ?? '')) ?><br><span class="small muted"><?= h((string)$a['number']) ?></span></td>
            <td class="small"><?= h((string)$a['work_title']) ?></td>
            <td class="small"><?= h($whoPlace($a)) ?></td>
            <td><span class="badge badge--gold"><?= h((string)$a['result']) ?></span>
              <?php if (trim((string)($a['extra_diploma'] ?? '')) !== ''): ?><br><span class="small muted">доп: <?= h((string)$a['extra_diploma']) ?></span><?php endif; ?></td>
            <td style="white-space:nowrap"><?= $rowActions($a) ?></td>
          </tr>
        <?php endforeach; ?>
      </tbody>
    </table></div>
    <?php endif; ?>
  </div>
<?php endif; ?>
<?php
$content = ob_get_clean();
admin_layout('Оценка длинных', $content, 'longcomp');

