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
    $rows = all("SELECT a.*, c.name comp, c.is_paid comp_paid FROM applications a
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
        // Переносы статусов «на оценку»/«в новые» убраны: очередь оценивания собирает
        // все неоценённые заявки автоматически (admin/grading.php).
        $map = ['mark_paid'=>['is_paid'=>1,'status'=>'paid'], 'reject'=>['status'=>'rejected']];
        if (isset($map[$act])) {
            $set = implode(',', array_map(fn($k)=>"$k=?", array_keys($map[$act])));
            q("UPDATE applications SET $set WHERE id IN ($in)", array_merge(array_values($map[$act]), $ids));
            audit('applications_bulk', 'application', null, ['action'=>$act,'ids'=>$ids]);
            flash('Обновлено заявок: ' . count($ids) . '.', 'success');
        } elseif ($act === 'mark_new') {
            // Вернуть в «новые» и снять оценку (исправление ошибочно оценённых).
            q("UPDATE applications SET status='new',score=NULL,result='',graded_at=NULL,jury_comment='' WHERE id IN ($in)", $ids);
            audit('applications_bulk', 'application', null, ['action'=>'mark_new','ids'=>$ids]);
            flash('Возвращено в новые: ' . count($ids) . '.', 'success');
        } elseif ($act === 'delete') {
            q("DELETE FROM applications WHERE id IN ($in)", $ids);
            audit('applications_bulk', 'application', null, ['action'=>'delete','ids'=>$ids]);
            flash('Удалено заявок: ' . count($ids) . '.', 'success');
        } elseif ($act === 'flag_suspicious') {
            q("UPDATE applications SET flag='suspicious' WHERE id IN ($in)", $ids);
            audit('applications_flag', 'application', null, ['ids'=>$ids]);
            flash('Отмечено как подозрительные: ' . count($ids) . '.', 'success');
        }
    }
    admin_redirect('applications', array_filter(['competition'=>input('competition'),'status'=>input('status')]));
}

/* ---------- Смена статуса одной заявки (аварийная; переносы «на оценку» убраны —
              статус-цепочка подана→оценена→исполнена работает автоматически) ---------- */
if ($_SERVER['REQUEST_METHOD'] === 'POST' && input('do') === 'set_status') {
    if (!csrf_check()) { flash('Сессия устарела.', 'error'); admin_redirect('applications'); }
    $id = (int) input('id');
    $st = input('status');
    if (in_array($st, ['new','submitted','pending','paid','judging','graded','sent','done','rejected'], true)) {
        $extra = $st === 'paid' ? ',is_paid=1' : '';
        // Возврат в «до-аттестации» — снимаем оценку/результат (это исправляет ошибочно оценённые заявки).
        if (in_array($st, ['new','submitted','pending','judging'], true)) $extra .= ",score=NULL,result='',graded_at=NULL,jury_comment=''";
        q("UPDATE applications SET status=? $extra WHERE id=?", [$st, $id]);
        audit('application_status', 'application', $id, ['status'=>$st]);
        flash('Статус заявки обновлён.', 'success');
    }
    admin_redirect('applications', ['id' => $id]);
}

/* ---------- Удаление одной заявки ---------- */
if ($_SERVER['REQUEST_METHOD'] === 'POST' && input('do') === 'delete_app') {
    if (!csrf_check()) { flash('Сессия устарела.', 'error'); admin_redirect('applications'); }
    $id = (int) input('id');
    if ($id > 0) {
        q("DELETE FROM applications WHERE id=?", [$id]);
        audit('application_delete', 'application', $id, []);
        flash('Заявка удалена.', 'success');
    }
    admin_redirect('applications');
}

/* ---------- Редактирование полей заявки (перед печатью диплома) ---------- */
if ($_SERVER['REQUEST_METHOD'] === 'POST' && input('do') === 'edit_app') {
    if (!csrf_check()) { flash('Сессия устарела.', 'error'); admin_redirect('applications'); }
    $id = (int) input('id');
    $cur = one("SELECT * FROM applications WHERE id=?", [$id]);
    if (!$cur) { flash('Заявка не найдена.', 'error'); admin_redirect('applications'); }

    $data = [
        'full_name'    => trim((string) input('full_name')),
        'group_name'   => trim((string) input('group_name')),
        'teacher'      => trim((string) input('teacher')),
        'nomination'   => trim((string) input('nomination')),
        'work_title'   => trim((string) input('work_title')),
        'institution'  => trim((string) input('institution')),
        'city'         => trim((string) input('city')),
        'age_category' => trim((string) input('age_category')),
    ];

    // Валидация по справочникам (если доступны). Пустое значение допустимо.
    if ($data['nomination'] !== '' && function_exists('NOMINATIONS')
        && !array_key_exists($data['nomination'], NOMINATIONS())) {
        flash('Недопустимая номинация — выберите из списка.', 'error');
        admin_redirect('applications', ['id' => $id]);
    }
    if ($data['age_category'] !== '' && function_exists('AGE_CATEGORIES')
        && !in_array($data['age_category'], AGE_CATEGORIES(), true)) {
        flash('Недопустимая возрастная категория — выберите из списка.', 'error');
        admin_redirect('applications', ['id' => $id]);
    }

    update('applications', $data, 'id=:id', ['id' => $id]);
    // Аудит только реально изменившихся полей.
    $changed = [];
    foreach ($data as $k => $v) if ((string)($cur[$k] ?? '') !== (string)$v) $changed[$k] = $v;
    audit('application_edit', 'application', $id, ['changed' => array_keys($changed)]);
    flash($changed ? 'Данные заявки обновлены (' . count($changed) . ').' : 'Изменений нет.', $changed ? 'success' : 'info');
    admin_redirect('applications', ['id' => $id]);
}

/* ================= КАРТОЧКА ЗАЯВКИ ================= */
if ($id = (int) input('id')) {
    $a = one("SELECT a.*, c.name comp, c.slug comp_slug, c.is_paid comp_paid FROM applications a
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
          <dt>Оплата</dt><dd><?= (int)($a['comp_paid'] ?? 1) === 0 ? '<span class="badge badge--muted">Бесплатный конкурс</span>' : ($a['is_paid'] ? '<span class="badge badge--paid">Оплачено</span>' : '<span class="badge badge--muted">Не оплачено</span>') ?></dd>
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
          <h3>Статус</h3>
          <p class="small muted" style="margin:-4px 0 10px">Статусы движутся автоматически: подана → оценена (после итога в «Оценивании») → исполнена (после отправки диплома). Ручная смена — только для аварийных случаев.</p>
          <form method="post" action="<?= url('/admin/?p=applications') ?>" class="field--inline">
            <?= csrf_field() ?><input type="hidden" name="do" value="set_status"><input type="hidden" name="id" value="<?= $id ?>">
            <select name="status" style="max-width:220px">
              <?php foreach (['new','submitted','pending','paid','judging','graded','sent','done','rejected'] as $s): ?>
                <option value="<?= $s ?>" <?= $a['status']===$s?'selected':'' ?>><?= h(app_status_ru($s)) ?></option>
              <?php endforeach; ?>
            </select>
            <button class="btn btn--primary btn--sm">Применить</button>
          </form>
          <p class="small muted" style="margin:8px 0 0">Возврат в «Новая/Подана» автоматически снимает оценку и результат.</p>
          <form method="post" action="<?= url('/admin/?p=applications') ?>" style="margin-top:10px" onsubmit="return confirm('Удалить заявку без возможности восстановления?')">
            <?= csrf_field() ?><input type="hidden" name="do" value="delete_app"><input type="hidden" name="id" value="<?= $id ?>">
            <button class="btn btn--ghost btn--sm" style="color:var(--error,#c0392b);border-color:var(--error,#c0392b)"><?= admin_icon('trash') ?? '' ?>Удалить заявку</button>
          </form>
        </div>
        <div class="card" style="margin-bottom:18px">
          <h3>Редактировать данные заявки</h3>
          <p class="small muted" style="margin:-4px 0 12px">Скорректируйте поля перед печатью диплома — они попадут в PDF и верификацию.</p>
          <form method="post" action="<?= url('/admin/?p=applications') ?>">
            <?= csrf_field() ?><input type="hidden" name="do" value="edit_app"><input type="hidden" name="id" value="<?= $id ?>">
            <div class="field"><label><?= $a['is_group'] ? 'Контактное лицо (ФИО)' : 'ФИО участника' ?></label>
              <input name="full_name" value="<?= h((string)$a['full_name']) ?>"></div>
            <?php if ($a['is_group']): ?>
              <div class="field"><label>Название коллектива</label>
                <input name="group_name" value="<?= h((string)$a['group_name']) ?>"></div>
            <?php else: ?>
              <input type="hidden" name="group_name" value="<?= h((string)$a['group_name']) ?>">
            <?php endif; ?>
            <div class="field"><label>Педагог</label>
              <input name="teacher" value="<?= h((string)$a['teacher']) ?>"></div>
            <div class="field"><label>Номинация</label>
              <select name="nomination">
                <option value="">— не указана —</option>
                <?php foreach (array_keys(NOMINATIONS()) as $n): ?>
                  <option value="<?= h($n) ?>" <?= (string)$a['nomination']===$n?'selected':'' ?>><?= h($n) ?></option>
                <?php endforeach; ?>
              </select></div>
            <div class="field"><label>Возрастная категория</label>
              <select name="age_category">
                <option value="">— не указана —</option>
                <?php foreach (AGE_CATEGORIES() as $cat): ?>
                  <option value="<?= h($cat) ?>" <?= (string)$a['age_category']===$cat?'selected':'' ?>><?= h($cat) ?></option>
                <?php endforeach; ?>
              </select></div>
            <div class="field"><label>Произведение</label>
              <input name="work_title" value="<?= h((string)$a['work_title']) ?>"></div>
            <div class="field"><label>Учреждение</label>
              <input name="institution" value="<?= h((string)$a['institution']) ?>"></div>
            <div class="field"><label>Город</label>
              <input name="city" value="<?= h((string)$a['city']) ?>"></div>
            <button class="btn btn--primary btn--sm"><?= admin_icon('check') ?>Сохранить данные</button>
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
    <?php foreach (['new','submitted','pending','paid','judging','graded','sent','done','rejected'] as $s): ?><option value="<?= $s ?>" <?= input('status')===$s?'selected':'' ?>><?= h(app_status_ru($s)) ?></option><?php endforeach; ?>
  </select></div>
  <div class="field"><label>С даты</label><input type="date" name="date_from" value="<?= h(input('date_from')) ?>"></div>
  <div class="field"><label>По дату</label><input type="date" name="date_to" value="<?= h(input('date_to')) ?>"></div>
  <button class="btn btn--primary btn--sm">Фильтр</button>
  <a class="btn btn--ghost btn--sm" href="<?= a_link('applications') ?>">Сброс</a>
</form>

<form method="post" action="<?= url('/admin/?p=applications') ?>">
  <?= csrf_field() ?><input type="hidden" name="do" value="bulk">
  <input type="hidden" name="competition" value="<?= h(input('competition')) ?>"><input type="hidden" name="status" value="<?= h(input('status')) ?>">
  <div class="toolbar">
    <select name="bulk_action" style="max-width:240px">
      <option value="">Массовое действие…</option>
      <option value="mark_paid">Отметить оплаченными</option>
      <option value="mark_new">Вернуть в «Новые» (снять оценку)</option>
      <option value="flag_suspicious">Отметить подозрительными</option>
      <option value="reject">Отклонить</option>
      <option value="delete">Удалить заявки</option>
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
            <td><?= (int)($a['comp_paid'] ?? 1) === 0 ? '<span class="badge badge--muted small">беспл.</span>' : ($a['is_paid'] ? '✓' : '—') ?></td>
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
