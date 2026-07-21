<?php
/** Заявки: таблица с фильтрами, карточка, массовые действия, экспорт CSV. */
declare(strict_types=1);

/** Собираем WHERE из фильтров. */
function apps_filter(): array {
    $w = []; $a = [];
    if ($c = (int) input('competition')) { $w[] = 'a.competition_id=?'; $a[] = $c; }
    if ($n = input('nomination')) { $w[] = 'a.nomination=?'; $a[] = $n; }
    if ($cat = input('category')) { $w[] = 'a.age_category=?'; $a[] = $cat; }
    if ($s = input('status')) { $w[] = 'a.status=?'; $a[] = $s; }
    if ($d1 = input('date_from')) { $w[] = 'date(a.created_at)>=?'; $a[] = $d1; }
    if ($d2 = input('date_to')) { $w[] = 'date(a.created_at)<=?'; $a[] = $d2; }
    if ($qs = input('q')) { $w[] = '(a.full_name LIKE ? OR a.number LIKE ? OR a.email LIKE ?)'; $a[]="%$qs%"; $a[]="%$qs%"; $a[]="%$qs%"; }
    return [$w ? 'WHERE ' . implode(' AND ', $w) : '', $a];
}

/* ---------- Экспорт CSV (до любого вывода) ---------- */
if (input('action') === 'export') {
    [$where, $args] = apps_filter();
    $rows = all("SELECT a.*, c.name comp FROM applications a
                 LEFT JOIN competitions c ON c.id=a.competition_id $where ORDER BY a.id DESC", $args);
    audit('applications_export', 'application', null, ['count' => count($rows)]);
    header('Content-Type: text/csv; charset=utf-8');
    header('Content-Disposition: attachment; filename="applications-' . date('Y-m-d') . '.csv"');
    $out = fopen('php://output', 'w');
    fprintf($out, "\xEF\xBB\xBF"); // BOM для Excel
    fputcsv($out, ['Номер','Конкурс','ФИО/Коллектив','Номинация','Форма','Категория','Произведение','Педагог','Учреждение','Город','Email','Телефон','Видео','Статус','Оплата','Балл','Результат','Создана'], ';');
    foreach ($rows as $r) {
        fputcsv($out, [
            $r['number'], $r['comp'], $r['is_group'] ? $r['group_name'] : $r['full_name'],
            $r['nomination'], $r['formation'], $r['age_category'], $r['work_title'],
            $r['teacher'], $r['institution'], $r['city'], $r['email'], $r['phone'],
            $r['video_url'], app_status_ru($r['status']), $r['is_paid'] ? 'да' : 'нет',
            $r['score'], $r['result'], $r['created_at'],
        ], ';');
    }
    fclose($out);
    exit;
}

/* ---------- Массовые действия ---------- */
if ($_SERVER['REQUEST_METHOD'] === 'POST' && input('do') === 'bulk') {
    if (!csrf_check()) { flash('Сессия устарела.', 'error'); admin_redirect('applications'); }
    $ids = array_map('intval', $_POST['ids'] ?? []);
    $act = input('bulk_action');
    if ($ids && $act) {
        $in = implode(',', array_fill(0, count($ids), '?'));
        $map = ['mark_paid'=>['is_paid'=>1,'status'=>'paid'], 'to_judging'=>['status'=>'judging'],
                'reject'=>['status'=>'rejected'], 'mark_new'=>['status'=>'new']];
        if (isset($map[$act])) {
            $set = implode(',', array_map(fn($k)=>"$k=?", array_keys($map[$act])));
            q("UPDATE applications SET $set WHERE id IN ($in)", array_merge(array_values($map[$act]), $ids));
            audit('applications_bulk', 'application', null, ['action'=>$act,'ids'=>$ids]);
            flash('Обновлено заявок: ' . count($ids) . '.', 'success');
        } elseif ($act === 'flag_suspicious') {
            q("UPDATE applications SET flag='suspicious' WHERE id IN ($in)", $ids);
            audit('applications_flag', 'application', null, ['ids'=>$ids]);
            flash('Отмечено как подозрительные: ' . count($ids) . '.', 'success');
        }
    }
    admin_redirect('applications', array_filter(['competition'=>input('competition'),'status'=>input('status')]));
}

/* ---------- Смена статуса одной заявки ---------- */
if ($_SERVER['REQUEST_METHOD'] === 'POST' && input('do') === 'set_status') {
    if (!csrf_check()) { flash('Сессия устарела.', 'error'); admin_redirect('applications'); }
    $id = (int) input('id');
    $st = input('status');
    if (in_array($st, ['new','paid','judging','graded','sent','rejected'], true)) {
        $extra = $st === 'paid' ? ',is_paid=1' : '';
        q("UPDATE applications SET status=? $extra WHERE id=?", [$st, $id]);
        audit('application_status', 'application', $id, ['status'=>$st]);
        flash('Статус заявки обновлён.', 'success');
    }
    admin_redirect('applications', ['id' => $id]);
}

/* ================= КАРТОЧКА ЗАЯВКИ ================= */
if ($id = (int) input('id')) {
    $a = one("SELECT a.*, c.name comp, c.slug comp_slug FROM applications a
              LEFT JOIN competitions c ON c.id=a.competition_id WHERE a.id=?", [$id]);
    if (!$a) { flash('Заявка не найдена.', 'error'); admin_redirect('applications'); }
    $grades = all("SELECT g.*, u.full_name jury FROM jury_grades g LEFT JOIN users u ON u.id=g.jury_id
                   WHERE g.application_id=? ORDER BY g.id DESC", [$id]);

    ob_start(); ?>
    <div class="toolbar">
      <a class="btn btn--ghost btn--sm" href="<?= a_link('applications') ?>"><?= admin_icon('back') ?>К списку</a>
      <?php if (admin_can('grading')): ?><a class="btn btn--navy btn--sm" href="<?= a_link('grading', ['id'=>$id]) ?>"><?= admin_icon('grading') ?>Оценить</a><?php endif; ?>
    </div>
    <div class="grid grid-2">
      <div class="card">
        <div class="section-title"><h3><?= h($a['number'] ?: '#'.$a['id']) ?></h3>
          <span class="badge badge--<?= h($a['status']) ?>"><?= h(app_status_ru($a['status'])) ?></span></div>
        <dl class="kv">
          <dt>Конкурс</dt><dd><?= h($a['comp']) ?></dd>
          <dt><?= $a['is_group'] ? 'Коллектив' : 'Участник' ?></dt><dd><?= h($a['is_group'] ? $a['group_name'] : $a['full_name']) ?></dd>
          <?php if ($a['is_group']): ?><dt>Контактное лицо</dt><dd><?= h($a['full_name']) ?></dd><?php endif; ?>
          <dt>Номинация</dt><dd><?= h($a['nomination']) ?><?= $a['subgroup'] ? ' · '.h($a['subgroup']) : '' ?></dd>
          <dt>Форма</dt><dd><?= h($a['formation']) ?></dd>
          <dt>Категория</dt><dd><?= h($a['age_category']) ?></dd>
          <dt>Произведение</dt><dd><?= h($a['work_title']) ?></dd>
          <dt>Педагог</dt><dd><?= h($a['teacher'] ?: '—') ?></dd>
          <dt>Учреждение</dt><dd><?= h($a['institution'] ?: '—') ?></dd>
          <dt>Город</dt><dd><?= h($a['city'] ?: '—') ?></dd>
          <dt>Email</dt><dd><a href="mailto:<?= h($a['email']) ?>"><?= h($a['email']) ?></a></dd>
          <dt>Телефон</dt><dd><?= h($a['phone'] ?: '—') ?></dd>
          <dt>Оплата</dt><dd><?= $a['is_paid'] ? '<span class="badge badge--paid">Оплачено</span>' : '<span class="badge badge--muted">Не оплачено</span>' ?></dd>
          <?php if ($a['score'] !== null): ?><dt>Балл / результат</dt><dd><b><?= h((string)$a['score']) ?></b> · <?= h($a['result']) ?></dd><?php endif; ?>
          <?php if ($a['flag']): ?><dt>Метка</dt><dd><span class="badge badge--rejected"><?= h($a['flag']) ?></span></dd><?php endif; ?>
          <dt>Создана</dt><dd><?= h($a['created_at']) ?></dd>
        </dl>
      </div>
      <div>
        <div class="card" style="margin-bottom:18px">
          <h3>Конкурсная работа</h3>
          <?php if ($a['video_url']): ?>
            <p><span class="tag"><?= h($a['video_platform'] ?: 'видео') ?></span></p>
            <a class="btn btn--navy btn--block" href="<?= h($a['video_url']) ?>" target="_blank" rel="noopener"><?= admin_icon('eye') ?>Открыть видео</a>
          <?php else: ?><p class="muted">Ссылка на видео не указана.</p><?php endif; ?>
        </div>
        <div class="card" style="margin-bottom:18px">
          <h3>Сменить статус</h3>
          <form method="post" action="<?= url('/admin/') ?>" class="field--inline">
            <?= csrf_field() ?><input type="hidden" name="do" value="set_status"><input type="hidden" name="id" value="<?= $id ?>">
            <select name="status" style="max-width:220px">
              <?php foreach (['new','paid','judging','graded','sent','rejected'] as $s): ?>
                <option value="<?= $s ?>" <?= $a['status']===$s?'selected':'' ?>><?= h(app_status_ru($s)) ?></option>
              <?php endforeach; ?>
            </select>
            <button class="btn btn--primary btn--sm">Применить</button>
          </form>
        </div>
        <div class="card">
          <h3>Оценки жюри</h3>
          <?php if (!$grades): ?><p class="muted">Оценок пока нет.</p><?php else: ?>
            <dl class="kv"><?php foreach ($grades as $g): ?>
              <dt><?= h($g['jury'] ?: 'Жюри #'.$g['jury_id']) ?></dt><dd><b><?= h((string)$g['score']) ?></b><?= $g['note'] ? ' · <span class="small muted">'.h($g['note']).'</span>' : '' ?></dd>
            <?php endforeach; ?></dl>
          <?php endif; ?>
        </div>
      </div>
    </div>
    <?php
    $content = ob_get_clean();
    admin_layout('Заявка ' . ($a['number'] ?: '#'.$a['id']), $content, 'applications');
    exit;
}

/* ================= СПИСОК С ФИЛЬТРАМИ ================= */
[$where, $args] = apps_filter();
$total = (int) scalar("SELECT COUNT(*) FROM applications a $where", $args);
$page  = max(1, (int) input('pg', '1'));
$per   = 50; $off = ($page - 1) * $per;
$rows = all("SELECT a.*, c.name comp FROM applications a
             LEFT JOIN competitions c ON c.id=a.competition_id
             $where ORDER BY a.id DESC LIMIT $per OFFSET $off", $args);
$comps = all("SELECT id,name FROM competitions ORDER BY sort,name");
$pages = (int) ceil($total / $per);
$qs = fn(array $ex=[]) => a_link('applications', array_filter(array_merge($_GET, $ex, ['p'=>null]), fn($v)=>$v!==null && $v!==''));

ob_start(); ?>
<div class="section-title">
  <h2>Заявки <span class="small muted">(<?= $total ?>)</span></h2>
  <a class="btn btn--ghost" href="<?= a_link('applications', array_filter(['action'=>'export']+$_GET, fn($v)=>$v!=='')) ?>"><?= admin_icon('download') ?>Экспорт CSV</a>
</div>

<form method="get" class="filters">
  <input type="hidden" name="p" value="applications">
  <div class="field"><label>Поиск</label><input name="q" value="<?= h(input('q')) ?>" placeholder="ФИО, номер, email"></div>
  <div class="field"><label>Конкурс</label><select name="competition"><option value="">Все</option>
    <?php foreach ($comps as $c): ?><option value="<?= $c['id'] ?>" <?= (int)input('competition')===(int)$c['id']?'selected':'' ?>><?= h($c['name']) ?></option><?php endforeach; ?>
  </select></div>
  <div class="field"><label>Номинация</label><select name="nomination"><option value="">Все</option>
    <?php foreach (array_keys(NOMINATIONS()) as $n): ?><option value="<?= h($n) ?>" <?= input('nomination')===$n?'selected':'' ?>><?= h($n) ?></option><?php endforeach; ?>
  </select></div>
  <div class="field"><label>Категория</label><select name="category"><option value="">Все</option>
    <?php foreach (AGE_CATEGORIES() as $cat): ?><option value="<?= h($cat) ?>" <?= input('category')===$cat?'selected':'' ?>><?= h($cat) ?></option><?php endforeach; ?>
  </select></div>
  <div class="field"><label>Статус</label><select name="status"><option value="">Любой</option>
    <?php foreach (['new','paid','judging','graded','sent','rejected'] as $s): ?><option value="<?= $s ?>" <?= input('status')===$s?'selected':'' ?>><?= h(app_status_ru($s)) ?></option><?php endforeach; ?>
  </select></div>
  <div class="field"><label>С даты</label><input type="date" name="date_from" value="<?= h(input('date_from')) ?>"></div>
  <div class="field"><label>По дату</label><input type="date" name="date_to" value="<?= h(input('date_to')) ?>"></div>
  <button class="btn btn--primary btn--sm">Фильтр</button>
  <a class="btn btn--ghost btn--sm" href="<?= a_link('applications') ?>">Сброс</a>
</form>

<form method="post" action="<?= url('/admin/') ?>">
  <?= csrf_field() ?><input type="hidden" name="do" value="bulk">
  <input type="hidden" name="competition" value="<?= h(input('competition')) ?>"><input type="hidden" name="status" value="<?= h(input('status')) ?>">
  <div class="toolbar">
    <select name="bulk_action" style="max-width:240px">
      <option value="">Массовое действие…</option>
      <option value="mark_paid">Отметить оплаченными</option>
      <option value="to_judging">Отправить на оценку</option>
      <option value="mark_new">Вернуть в «Новые»</option>
      <option value="flag_suspicious">Отметить подозрительными</option>
      <option value="reject">Отклонить</option>
    </select>
    <button class="btn btn--navy btn--sm" onclick="return confirm('Применить к выбранным заявкам?')"><?= admin_icon('check') ?>Применить</button>
  </div>

  <div class="table-wrap">
    <table class="tbl">
      <thead><tr>
        <th class="checkbox-cell"><input type="checkbox" onclick="document.querySelectorAll('.rowchk').forEach(c=>c.checked=this.checked)"></th>
        <th>Номер</th><th>Участник</th><th>Конкурс</th><th>Номинация</th><th>Статус</th><th>Опл.</th><th>Дата</th>
      </tr></thead>
      <tbody>
        <?php if (!$rows): ?><tr><td colspan="8" class="muted" style="text-align:center;padding:28px">Заявок по фильтру нет</td></tr><?php endif; ?>
        <?php foreach ($rows as $a): ?>
          <tr>
            <td class="checkbox-cell"><input type="checkbox" class="rowchk" name="ids[]" value="<?= $a['id'] ?>"></td>
            <td><a href="<?= a_link('applications', ['id'=>$a['id']]) ?>"><b><?= h($a['number'] ?: '#'.$a['id']) ?></b></a><?= $a['flag'] ? ' <span class="badge badge--rejected small">'.h($a['flag']).'</span>' : '' ?></td>
            <td><?= h($a['is_group'] ? $a['group_name'] : $a['full_name']) ?></td>
            <td class="small"><?= h($a['comp']) ?></td>
            <td class="small"><?= h($a['nomination']) ?></td>
            <td><span class="badge badge--<?= h($a['status']) ?>"><?= h(app_status_ru($a['status'])) ?></span></td>
            <td><?= $a['is_paid'] ? '✓' : '—' ?></td>
            <td class="small"><?= h(date('d.m.y', strtotime($a['created_at']))) ?></td>
          </tr>
        <?php endforeach; ?>
      </tbody>
    </table>
  </div>
</form>

<?php if ($pages > 1): ?>
<div class="toolbar" style="margin-top:16px;justify-content:center">
  <?php for ($i=1;$i<=$pages;$i++): ?>
    <a class="btn btn--sm <?= $i===$page?'btn--primary':'btn--ghost' ?>" href="<?= $qs(['pg'=>$i]) ?>"><?= $i ?></a>
  <?php endfor; ?>
</div>
<?php endif; ?>
<?php
$content = ob_get_clean();
admin_layout('Заявки', $content, 'applications');
