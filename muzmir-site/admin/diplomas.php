<?php
/** Дипломы: шаблоны по конкурсам, массовая генерация PDF, рассылка на email, история. */
declare(strict_types=1);

$comp = (int) input('competition');

/* ---------- Шаблон конкурса ---------- */
if ($_SERVER['REQUEST_METHOD'] === 'POST' && input('do') === 'save_template') {
    if (!csrf_check()) { flash('Сессия устарела.', 'error'); admin_redirect('diplomas'); }
    $cid = (int) input('competition');
    update('competitions', ['diploma_template' => trim(input('diploma_template'))], 'id=:wid', ['wid' => $cid]);
    audit('diploma_template', 'competition', $cid);
    flash('Шаблон диплома сохранён.', 'success');
    admin_redirect('diplomas', ['competition' => $cid]);
}

/* ---------- Массовая генерация дипломов ---------- */
if ($_SERVER['REQUEST_METHOD'] === 'POST' && input('do') === 'generate') {
    if (!csrf_check()) { flash('Сессия устарела.', 'error'); admin_redirect('diplomas'); }
    $ids = array_map('intval', $_POST['ids'] ?? []);
    $made = 0; $pdfok = 0;
    foreach ($ids as $appId) {
        $app = one("SELECT a.*, c.code FROM applications a LEFT JOIN competitions c ON c.id=a.competition_id WHERE a.id=?", [$appId]);
        if (!$app || !$app['result']) continue;
        if (one("SELECT id FROM diplomas WHERE application_id=? AND type='main'", [$appId])) continue;
        $number = strtoupper($app['code'] ?: 'D') . '-' . date('Y') . '-' . str_pad((string)$appId, 5, '0', STR_PAD_LEFT);
        $pdfPath = '';
        if (function_exists('pdf_diploma')) {
            try { $pdfPath = pdf_diploma($app, 'main'); $pdfok++; } catch (Throwable $e) { $pdfPath = ''; }
        }
        insert('diplomas', ['number'=>$number,'application_id'=>$appId,'type'=>'main','result'=>$app['result'],'pdf_path'=>$pdfPath]);
        $made++;
    }
    audit('diplomas_generate', 'diploma', null, ['made'=>$made,'pdf'=>$pdfok]);
    if (!function_exists('pdf_diploma')) flash("Создано записей: $made. Генератор pdf_diploma пока не подключён — PDF добавятся позже.", 'warning');
    else flash("Сгенерировано дипломов: $made (PDF: $pdfok).", 'success');
    admin_redirect('diplomas', array_filter(['competition'=>$comp]));
}

/* ---------- Массовая отправка на email ---------- */
if ($_SERVER['REQUEST_METHOD'] === 'POST' && input('do') === 'send') {
    if (!csrf_check()) { flash('Сессия устарела.', 'error'); admin_redirect('diplomas'); }
    $ids = array_map('intval', $_POST['dids'] ?? []);
    $queued = 0;
    foreach ($ids as $did) {
        $d = one("SELECT d.*, a.email, a.full_name, a.group_name, a.is_group, c.name comp
                  FROM diplomas d JOIN applications a ON a.id=d.application_id
                  LEFT JOIN competitions c ON c.id=a.competition_id WHERE d.id=?", [$did]);
        if (!$d || !$d['email']) continue;
        $name = $d['is_group'] ? $d['group_name'] : $d['full_name'];
        $subject = 'Ваш диплом · ' . $d['comp'];
        $body = function_exists('mail_template')
            ? mail_template('diploma', ['name'=>$name,'result'=>$d['result'],'comp'=>$d['comp'],'number'=>$d['number']])
            : '<p>Здравствуйте, ' . h($name) . '.</p><p>Поздравляем с результатом «' . h($d['result']) . '» в конкурсе «' . h($d['comp']) . '». Ваш диплом № ' . h($d['number']) . ' во вложении.</p>';
        insert('mail_queue', ['to_email'=>$d['email'],'to_name'=>$name,'subject'=>$subject,'body'=>$body,'attach'=>$d['pdf_path'] ?: '']);
        q("UPDATE diplomas SET sent_at=datetime('now') WHERE id=?", [$did]);
        q("UPDATE applications SET status='sent' WHERE id=?", [$d['application_id']]);
        $queued++;
    }
    audit('diplomas_send', 'diploma', null, ['queued'=>$queued]);
    flash("Поставлено в очередь писем: $queued.", 'success');
    admin_redirect('diplomas', array_filter(['competition'=>$comp,'tab'=>'sent']));
}

/* ---------- Повторная отправка ---------- */
if ($_SERVER['REQUEST_METHOD'] === 'POST' && input('do') === 'resend') {
    if (!csrf_check()) { flash('Сессия устарела.', 'error'); admin_redirect('diplomas'); }
    $did = (int) input('did');
    $d = one("SELECT d.*, a.email, a.full_name, a.group_name, a.is_group, c.name comp
              FROM diplomas d JOIN applications a ON a.id=d.application_id
              LEFT JOIN competitions c ON c.id=a.competition_id WHERE d.id=?", [$did]);
    if ($d && $d['email']) {
        $name = $d['is_group'] ? $d['group_name'] : $d['full_name'];
        $body = '<p>Здравствуйте, ' . h($name) . '.</p><p>Повторно направляем Ваш диплом № ' . h($d['number']) . ' по конкурсу «' . h($d['comp']) . '».</p>';
        insert('mail_queue', ['to_email'=>$d['email'],'to_name'=>$name,'subject'=>'Ваш диплом (повторно) · '.$d['comp'],'body'=>$body,'attach'=>$d['pdf_path'] ?: '']);
        q("UPDATE diplomas SET sent_at=datetime('now') WHERE id=?", [$did]);
        audit('diploma_resend', 'diploma', $did);
        flash('Диплом повторно поставлен в очередь.', 'success');
    }
    admin_redirect('diplomas', array_filter(['competition'=>$comp,'tab'=>'sent']));
}

$comps = all("SELECT id,name,status FROM competitions ORDER BY sort,name");
$current = $comp ? one("SELECT * FROM competitions WHERE id=?", [$comp]) : null;
$tab = input('tab') ?: 'ready';

ob_start(); ?>
<div class="section-title"><h2>Дипломы</h2></div>

<form method="get" class="filters">
  <input type="hidden" name="p" value="diplomas">
  <div class="field"><label>Конкурс</label><select name="competition" onchange="this.form.submit()"><option value="">Выберите конкурс…</option>
    <?php foreach ($comps as $c): ?><option value="<?= $c['id'] ?>" <?= $comp===(int)$c['id']?'selected':'' ?>><?= h($c['name']) ?> · <?= h(comp_status_ru($c['status'])) ?></option><?php endforeach; ?>
  </select></div>
</form>

<?php if (!$current): ?>
  <div class="card empty"><?= admin_icon('diplomas') ?><p class="muted">Выберите конкурс, чтобы работать с дипломами.</p></div>
<?php else: ?>

  <div class="card" style="margin-bottom:18px">
    <form method="post" action="<?= url('/admin/') ?>" class="field--inline" style="align-items:flex-end;gap:12px">
      <?= csrf_field() ?><input type="hidden" name="do" value="save_template"><input type="hidden" name="competition" value="<?= $comp ?>">
      <div class="field" style="flex:1;margin:0"><label>Шаблон диплома (URL или путь к фону/макету)</label>
        <input name="diploma_template" value="<?= h($current['diploma_template']) ?>" placeholder="assets/img/diploma_bg.png"></div>
      <button class="btn btn--primary btn--sm"><?= admin_icon('check') ?>Сохранить шаблон</button>
    </form>
  </div>

  <div class="tabs">
    <a href="<?= a_link('diplomas', ['competition'=>$comp,'tab'=>'ready']) ?>" class="<?= $tab==='ready'?'active':'' ?>">К генерации</a>
    <a href="<?= a_link('diplomas', ['competition'=>$comp,'tab'=>'sent']) ?>" class="<?= $tab==='sent'?'active':'' ?>">Готовые и отправка</a>
  </div>

  <?php if ($tab === 'ready'):
    $ready = all("SELECT a.* FROM applications a WHERE a.competition_id=? AND a.result<>''
                  AND a.id NOT IN (SELECT application_id FROM diplomas WHERE type='main') ORDER BY a.id", [$comp]); ?>
    <form method="post" action="<?= url('/admin/') ?>">
      <?= csrf_field() ?><input type="hidden" name="do" value="generate"><input type="hidden" name="competition" value="<?= $comp ?>">
      <div class="toolbar">
        <span class="small muted">Оценённых без диплома: <?= count($ready) ?></span>
        <button class="btn btn--primary btn--sm" onclick="return confirm('Сгенерировать дипломы для выбранных?')"><?= admin_icon('diplomas') ?>Сгенерировать выбранные</button>
      </div>
      <div class="table-wrap"><table class="tbl">
        <thead><tr><th class="checkbox-cell"><input type="checkbox" onclick="document.querySelectorAll('.rowchk').forEach(c=>c.checked=this.checked)"></th>
          <th>Участник</th><th>Номинация</th><th>Балл</th><th>Результат</th></tr></thead>
        <tbody>
          <?php if (!$ready): ?><tr><td colspan="5" class="muted" style="text-align:center;padding:26px">Нет оценённых заявок без диплома. Дипломы генерируются после закрытия оценивания.</td></tr><?php endif; ?>
          <?php foreach ($ready as $a): ?>
            <tr><td class="checkbox-cell"><input type="checkbox" class="rowchk" name="ids[]" value="<?= $a['id'] ?>"></td>
              <td><?= h($a['is_group']?$a['group_name']:$a['full_name']) ?></td>
              <td class="small"><?= h($a['nomination']) ?></td>
              <td><?= h((string)$a['score']) ?></td>
              <td><span class="badge badge--gold"><?= h($a['result']) ?></span></td></tr>
          <?php endforeach; ?>
        </tbody>
      </table></div>
    </form>

  <?php else:
    $dips = all("SELECT d.*, a.full_name, a.group_name, a.is_group, a.email
                 FROM diplomas d JOIN applications a ON a.id=d.application_id
                 WHERE a.competition_id=? ORDER BY d.id DESC", [$comp]); ?>
    <form method="post" action="<?= url('/admin/') ?>">
      <?= csrf_field() ?><input type="hidden" name="do" value="send"><input type="hidden" name="competition" value="<?= $comp ?>">
      <div class="toolbar">
        <span class="small muted">Всего дипломов: <?= count($dips) ?></span>
        <button class="btn btn--navy btn--sm" onclick="return confirm('Поставить письма с дипломами в очередь?')"><?= admin_icon('send') ?>Отправить выбранные на email</button>
      </div>
      <div class="table-wrap"><table class="tbl">
        <thead><tr><th class="checkbox-cell"><input type="checkbox" onclick="document.querySelectorAll('.rowchk').forEach(c=>c.checked=this.checked)"></th>
          <th>Номер</th><th>Участник</th><th>Результат</th><th>PDF</th><th>Отправлен</th><th></th></tr></thead>
        <tbody>
          <?php if (!$dips): ?><tr><td colspan="7" class="muted" style="text-align:center;padding:26px">Дипломы ещё не сгенерированы</td></tr><?php endif; ?>
          <?php foreach ($dips as $d): ?>
            <tr>
              <td class="checkbox-cell"><input type="checkbox" class="rowchk" name="dids[]" value="<?= $d['id'] ?>"></td>
              <td class="small"><?= h($d['number']) ?></td>
              <td><?= h($d['is_group']?$d['group_name']:$d['full_name']) ?><br><span class="small muted"><?= h($d['email']) ?></span></td>
              <td><span class="badge badge--gold"><?= h($d['result']) ?></span></td>
              <td><?= $d['pdf_path'] ? '<a href="'.h(url($d['pdf_path'])).'" target="_blank">файл</a>' : '<span class="small muted">нет</span>' ?></td>
              <td class="small"><?= $d['sent_at'] ? h(date('d.m.y H:i', strtotime($d['sent_at']))) : '<span class="badge badge--muted">нет</span>' ?></td>
              <td><?php if ($d['sent_at']): ?>
                <button form="resend<?= $d['id'] ?>" class="btn btn--ghost btn--sm" title="Повторить"><?= admin_icon('send') ?></button>
              <?php endif; ?></td>
            </tr>
          <?php endforeach; ?>
        </tbody>
      </table></div>
    </form>
    <?php foreach ($dips as $d): if (!$d['sent_at']) continue; ?>
      <form method="post" action="<?= url('/admin/') ?>" id="resend<?= $d['id'] ?>" style="display:none">
        <?= csrf_field() ?><input type="hidden" name="do" value="resend"><input type="hidden" name="did" value="<?= $d['id'] ?>"><input type="hidden" name="competition" value="<?= $comp ?>">
      </form>
    <?php endforeach; ?>
  <?php endif; ?>

<?php endif; ?>
<?php
$content = ob_get_clean();
admin_layout('Дипломы', $content, 'diplomas');
