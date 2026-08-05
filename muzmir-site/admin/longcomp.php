<?php
/**
 * ДЛИННЫЕ КОНКУРСЫ (results_mode='list') — отдельный раздел (Величие России и т.п.).
 *
 * Такие конкурсы НЕ идут в «Оценивание» и НЕ рассылают результаты по одному:
 * итоги копятся списком, редактируются здесь, и участник видит результат / может
 * заказать награды ТОЛЬКО после публикации (кнопка «Опубликовать результаты»,
 * дата публикации — competitions.results_date, по умолчанию 28-е число).
 *
 * Здесь: список длинных конкурсов, для выбранного — все заявки с полем звания
 * (сохранение списком), доп. диплом, счётчик готовности и публикация.
 */
declare(strict_types=1);

require_once BASE_PATH . '/admin/grading.php'; // RESULT_PRESETS(), EXTRA_PRESETS(), grade_result()

// Публикация результатов — мягкая миграция колонки.
try { db()->exec("ALTER TABLE competitions ADD COLUMN results_published_at TEXT"); } catch (\Throwable $e) {}

/* ------------------------------- POST -------------------------------- */
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if (!csrf_check()) { flash('Сессия устарела.', 'error'); admin_redirect('longcomp'); }
    $do  = input('do');
    $cid = (int) input('competition');

    if ($do === 'save_results' && $cid) {
        $results = $_POST['result'] ?? [];       // app_id => звание
        $extras  = $_POST['extra'] ?? [];        // app_id => доп. диплом
        $saved = 0;
        foreach ($results as $aid => $res) {
            $aid = (int) $aid; $res = trim((string) $res);
            if ($aid <= 0) continue;
            $extra = trim((string) ($extras[$aid] ?? ''));
            if ($res === '' && $extra === '') continue;
            // Пишем результат напрямую (без индивидуального письма — длинный конкурс).
            $data = ['status' => 'graded'];
            if ($res !== '')   $data['result'] = $res;
            if ($extra !== '') $data['extra_diploma'] = $extra;
            update('applications', $data, 'id=:id AND competition_id=:c', ['id' => $aid, 'c' => $cid]);
            q("UPDATE applications SET graded_at=? WHERE id=? AND (graded_at IS NULL OR graded_at='')",
              [date('Y-m-d H:i:s'), $aid]);
            $saved++;
        }
        audit('longcomp_save', 'competition', $cid, ['saved' => $saved]);
        flash('Сохранено результатов: ' . $saved . '. Рассылка — только после публикации.', 'success');
        admin_redirect('longcomp', ['competition' => $cid]);
    }

    if ($do === 'publish' && $cid) {
        update('competitions', ['results_published_at' => date('Y-m-d H:i:s')], 'id=:id', ['id' => $cid]);
        audit('longcomp_publish', 'competition', $cid, []);
        flash('Результаты опубликованы — участники видят звания и могут заказать награды. Рассылка дипломов пойдёт по расписанию (крон).', 'success');
        admin_redirect('longcomp', ['competition' => $cid]);
    }

    if ($do === 'unpublish' && $cid) {
        update('competitions', ['results_published_at' => null], 'id=:id', ['id' => $cid]);
        audit('longcomp_unpublish', 'competition', $cid, []);
        flash('Публикация снята — результаты снова скрыты от участников.', 'info');
        admin_redirect('longcomp', ['competition' => $cid]);
    }
    admin_redirect('longcomp');
}

/* ------------------------------- ДАННЫЕ ------------------------------ */
$longComps = all("SELECT * FROM competitions WHERE results_mode='list' ORDER BY sort, name");
$comp = (int) input('competition');
$current = $comp ? one("SELECT * FROM competitions WHERE id=? AND results_mode='list'", [$comp]) : null;

ob_start(); ?>
<div class="page-head">
  <h1>Длинные конкурсы</h1>
  <p class="muted small">Конкурсы с публикацией результатов списком (например «Величие России»). Итоги копятся здесь и НЕ рассылаются по одному — участник видит звание и может заказать награды только после публикации.</p>
</div>

<form method="get" class="filters">
  <input type="hidden" name="p" value="longcomp">
  <div class="field"><label>Конкурс</label>
    <select name="competition" onchange="this.form.submit()">
      <option value="">Выберите длинный конкурс…</option>
      <?php foreach ($longComps as $c): ?>
        <option value="<?= (int)$c['id'] ?>" <?= $comp===(int)$c['id']?'selected':'' ?>><?= h($c['name']) ?></option>
      <?php endforeach; ?>
    </select>
  </div>
</form>

<?php if (!$longComps): ?>
  <div class="card"><p class="muted">Длинных конкурсов (с режимом результатов «список») пока нет. Режим задаётся в разделе «Конкурсы» — «Результаты списком».</p></div>
<?php elseif (!$current): ?>
  <div class="card"><p class="muted">Выберите конкурс, чтобы сформировать и опубликовать результаты.</p></div>
<?php else:
  $apps = all("SELECT * FROM applications WHERE competition_id=? AND is_paid=1 AND status<>'rejected'
               ORDER BY (result IS NULL OR result='') DESC, full_name COLLATE NOCASE", [$comp]);
  $tot = count($apps);
  $done = 0; foreach ($apps as $a) if (trim((string)$a['result']) !== '') $done++;
  $pct = $tot ? (int) round($done / $tot * 100) : 0;
  $published = trim((string)($current['results_published_at'] ?? '')) !== '';
  $pubDate = trim((string)($current['results_date'] ?? ''));
?>
  <div class="card" style="margin-bottom:16px">
    <div class="section-title" style="margin-bottom:8px"><h3><?= h((string)$current['name']) ?></h3>
      <span class="badge <?= $published ? 'badge--open' : 'badge--muted' ?>"><?= $published ? 'Результаты опубликованы' : 'Черновик (скрыто от участников)' ?></span>
    </div>
    <div style="display:flex;align-items:center;gap:14px;flex-wrap:wrap;margin-bottom:8px">
      <div class="small muted">Оценено: <b style="color:var(--a-navy)"><?= $done ?></b> из <?= $tot ?> (<?= $pct ?>%)</div>
      <div style="flex:1;min-width:160px;height:8px;border-radius:6px;background:rgba(0,0,0,.08);overflow:hidden">
        <div style="width:<?= $pct ?>%;height:100%;background:var(--a-navy)"></div>
      </div>
      <?php if ($pubDate): ?><div class="small muted">Дата публикации: <b><?= h(date('d.m.Y', strtotime($pubDate))) ?></b></div><?php endif; ?>
    </div>
    <div class="toolbar" style="gap:8px">
      <?php if (!$published): ?>
        <form method="post" action="<?= url('/admin/') ?>" onsubmit="return confirm('Опубликовать результаты конкурса? Участники увидят звания и смогут заказать награды.')"><?= csrf_field() ?>
          <input type="hidden" name="do" value="publish"><input type="hidden" name="competition" value="<?= $comp ?>">
          <button class="btn btn--primary btn--sm"><?= admin_icon('check') ?>Опубликовать результаты</button>
        </form>
      <?php else: ?>
        <form method="post" action="<?= url('/admin/') ?>" onsubmit="return confirm('Снять публикацию? Результаты снова скроются от участников.')"><?= csrf_field() ?>
          <input type="hidden" name="do" value="unpublish"><input type="hidden" name="competition" value="<?= $comp ?>">
          <button class="btn btn--ghost btn--sm"><?= admin_icon('x') ?>Снять публикацию</button>
        </form>
      <?php endif; ?>
    </div>
  </div>

  <?php if (!$apps): ?>
    <div class="card"><p class="muted">По этому конкурсу пока нет принятых заявок.</p></div>
  <?php else: ?>
  <form method="post" action="<?= url('/admin/') ?>">
    <?= csrf_field() ?><input type="hidden" name="do" value="save_results"><input type="hidden" name="competition" value="<?= $comp ?>">
    <div class="toolbar" style="margin-bottom:10px">
      <span class="small muted">Заявок: <?= $tot ?>. Проставьте звания списком и сохраните — рассылка не пойдёт до публикации.</span>
      <button class="btn btn--primary btn--sm"><?= admin_icon('check') ?>Сохранить результаты</button>
    </div>
    <div class="table-wrap"><table class="tbl">
      <thead><tr><th>Участник</th><th>Номинация</th><th>Звание (итог)</th><th>Доп. диплом</th></tr></thead>
      <tbody>
        <?php foreach ($apps as $a): $aid=(int)$a['id']; ?>
          <tr>
            <td><?= h($a['is_group'] ? $a['group_name'] : $a['full_name']) ?><br><span class="small muted"><?= h((string)$a['number']) ?> · <?= h((string)$a['email']) ?></span></td>
            <td class="small"><?= h((string)$a['nomination']) ?></td>
            <td>
              <select name="result[<?= $aid ?>]" style="min-width:190px;padding:6px 9px;border:1px solid var(--a-line);border-radius:8px">
                <option value="">— не оценено —</option>
                <?php foreach (RESULT_PRESETS() as $r): ?>
                  <option value="<?= h($r) ?>" <?= (string)$a['result']===$r?'selected':'' ?>><?= h($r) ?></option>
                <?php endforeach; ?>
              </select>
            </td>
            <td>
              <select name="extra[<?= $aid ?>]" style="min-width:190px;padding:6px 9px;border:1px solid var(--a-line);border-radius:8px">
                <option value="">— нет —</option>
                <?php foreach (EXTRA_PRESETS() as $e): ?>
                  <option value="<?= h($e) ?>" <?= (string)($a['extra_diploma']??'')===$e?'selected':'' ?>><?= h($e) ?></option>
                <?php endforeach; ?>
              </select>
            </td>
          </tr>
        <?php endforeach; ?>
      </tbody>
    </table></div>
    <div class="toolbar" style="margin-top:10px">
      <button class="btn btn--primary btn--sm"><?= admin_icon('check') ?>Сохранить результаты</button>
    </div>
  </form>
  <?php endif; ?>
<?php endif; ?>
<?php
$content = ob_get_clean();
admin_layout('Длинные конкурсы', $content, 'longcomp');
