<?php
/** Пользователи: участники/подписчики, импорт/экспорт CSV, сегменты, теги, merge, роли, аудит. */
declare(strict_types=1);

/* ---------- Экспорт подписчиков (до вывода) ---------- */
if (input('action') === 'export_subs') {
    $rows = all("SELECT email,name,source,tags,active,created_at FROM subscribers ORDER BY id");
    audit('subscribers_export', 'subscriber', null, ['count'=>count($rows)]);
    header('Content-Type: text/csv; charset=utf-8');
    header('Content-Disposition: attachment; filename="subscribers-' . date('Y-m-d') . '.csv"');
    $out = fopen('php://output', 'w'); fprintf($out, "\xEF\xBB\xBF");
    fputcsv($out, ['email','name','source','tags','active','created_at'], ';');
    foreach ($rows as $r) fputcsv($out, $r, ';');
    fclose($out); exit;
}

/* ---------- POST-экшены ---------- */
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    if (!csrf_check()) { flash('Сессия устарела.', 'error'); admin_redirect('users'); }
    $do = input('do');

    if ($do === 'set_role') {
        $uid = (int) input('uid');
        $role = input('role');
        if (isset(ROLE_RANK[$role])) {
            // владельца понижать нельзя
            $target = one("SELECT role FROM users WHERE id=?", [$uid]);
            if ($target && $target['role'] !== 'owner') {
                update('users', ['role'=>$role], 'id=:wid', ['wid'=>$uid]);
                audit('user_role', 'user', $uid, ['role'=>$role]);
                flash('Роль обновлена.', 'success');
            } else flash('Роль владельца изменить нельзя.', 'warning');
        }
        admin_redirect('users', ['tab'=>'users']);
    }

    if ($do === 'import_subs' && isset($_FILES['csv']) && is_uploaded_file($_FILES['csv']['tmp_name'])) {
        $fh = fopen($_FILES['csv']['tmp_name'], 'r');
        $n = 0; $head = null;
        while (($line = fgetcsv($fh, 0, ';')) !== false) {
            if ($line === [null] || $line === false) continue;
            if ($head === null && !filter_var($line[0] ?? '', FILTER_VALIDATE_EMAIL)) { $head = $line; continue; }
            $email = mb_strtolower(trim((string)($line[0] ?? '')));
            if (!filter_var($email, FILTER_VALIDATE_EMAIL)) continue;
            q("INSERT OR IGNORE INTO subscribers(email,name,source,tags,unsub_token) VALUES(?,?,?,?,?)",
              [$email, trim((string)($line[1] ?? '')), 'import', trim((string)($line[3] ?? '')), bin2hex(random_bytes(8))]);
            $n++;
        }
        fclose($fh);
        audit('subscribers_import', 'subscriber', null, ['rows'=>$n]);
        flash("Импортировано строк: $n (дубли пропущены).", 'success');
        admin_redirect('users', ['tab'=>'subs']);
    }

    if ($do === 'tag_subs') {
        $ids = array_map('intval', $_POST['ids'] ?? []);
        $tag = trim(input('tag'));
        if ($ids && $tag !== '') {
            foreach ($ids as $sid) {
                $cur = (string) scalar("SELECT tags FROM subscribers WHERE id=?", [$sid]);
                $tags = array_filter(array_map('trim', explode(',', $cur)));
                if (!in_array($tag, $tags, true)) $tags[] = $tag;
                update('subscribers', ['tags'=>implode(', ', $tags)], 'id=:wid', ['wid'=>$sid]);
            }
            audit('subscribers_tag', 'subscriber', null, ['tag'=>$tag,'count'=>count($ids)]);
            flash('Тег добавлен ' . count($ids) . ' подписчикам.', 'success');
        }
        admin_redirect('users', ['tab'=>'subs']);
    }

    if ($do === 'merge_subs') {
        // Слияние дублей по нормализованному email: оставляем меньший id, объединяем теги.
        $groups = all("SELECT lower(trim(email)) e, COUNT(*) c FROM subscribers GROUP BY e HAVING c>1");
        $removed = 0;
        foreach ($groups as $g) {
            $dupes = all("SELECT * FROM subscribers WHERE lower(trim(email))=? ORDER BY id", [$g['e']]);
            $keep = array_shift($dupes);
            $tags = array_filter(array_map('trim', explode(',', (string)$keep['tags'])));
            foreach ($dupes as $d) {
                foreach (array_filter(array_map('trim', explode(',', (string)$d['tags']))) as $t) if (!in_array($t,$tags,true)) $tags[]=$t;
                q("DELETE FROM subscribers WHERE id=?", [$d['id']]); $removed++;
            }
            update('subscribers', ['tags'=>implode(', ',$tags)], 'id=:wid', ['wid'=>$keep['id']]);
        }
        audit('subscribers_merge', 'subscriber', null, ['removed'=>$removed]);
        flash($removed ? "Удалено дублей: $removed." : 'Дубли не найдены.', $removed ? 'success' : 'info');
        admin_redirect('users', ['tab'=>'subs']);
    }
}

$tab = input('tab') ?: 'users';

ob_start(); ?>
<div class="section-title"><h2>Пользователи и подписчики</h2></div>
<div class="tabs">
  <a href="<?= a_link('users', ['tab'=>'users']) ?>" class="<?= $tab==='users'?'active':'' ?>">Пользователи</a>
  <a href="<?= a_link('users', ['tab'=>'subs']) ?>" class="<?= $tab==='subs'?'active':'' ?>">Подписчики</a>
  <a href="<?= a_link('users', ['tab'=>'audit']) ?>" class="<?= $tab==='audit'?'active':'' ?>">Аудит-лог</a>
</div>

<?php if ($tab === 'users'):
  $qs = input('q');
  $w = $qs ? "WHERE email LIKE ? OR full_name LIKE ?" : "";
  $ua = $qs ? ["%$qs%","%$qs%"] : [];
  $users = all("SELECT * FROM users $w ORDER BY (role='owner') DESC, id DESC LIMIT 300", $ua);
  $roles = array_keys(ROLE_RANK); ?>
  <form method="get" class="filters"><input type="hidden" name="p" value="users"><input type="hidden" name="tab" value="users">
    <div class="field"><label>Поиск</label><input name="q" value="<?= h($qs) ?>" placeholder="email или имя"></div>
    <button class="btn btn--primary btn--sm">Найти</button>
  </form>
  <div class="table-wrap"><table class="tbl">
    <thead><tr><th>ID</th><th>Имя / email</th><th>Телефон</th><th>Роль</th><th>Регистрация</th><th></th></tr></thead>
    <tbody>
      <?php foreach ($users as $u): ?>
        <tr>
          <td><?= $u['id'] ?></td>
          <td><b><?= h($u['full_name'] ?: '—') ?></b><br><span class="small muted"><?= h($u['email']) ?></span></td>
          <td class="small"><?= h($u['phone'] ?: '—') ?></td>
          <td><span class="badge badge--<?= $u['role']==='owner'?'gold':'muted' ?>"><?= h(role_ru($u['role'])) ?></span></td>
          <td class="small"><?= h(date('d.m.y', strtotime($u['created_at']))) ?></td>
          <td>
            <?php if ($u['role'] !== 'owner'): ?>
            <form method="post" action="<?= url('/admin/') ?>" class="field--inline">
              <?= csrf_field() ?><input type="hidden" name="do" value="set_role"><input type="hidden" name="uid" value="<?= $u['id'] ?>">
              <select name="role" style="max-width:150px" onchange="this.form.submit()">
                <?php foreach ($roles as $r): if ($r==='owner') continue; ?><option value="<?= $r ?>" <?= $u['role']===$r?'selected':'' ?>><?= h(role_ru($r)) ?></option><?php endforeach; ?>
              </select>
            </form>
            <?php endif; ?>
          </td>
        </tr>
      <?php endforeach; ?>
    </tbody>
  </table></div>

<?php elseif ($tab === 'subs'):
  $seg = input('seg'); $src = input('seg_source');
  $w = []; $sa = [];
  if ($seg) { $w[] = "tags LIKE ?"; $sa[] = "%$seg%"; }
  if ($src) { $w[] = "source=?"; $sa[] = $src; }
  $where = $w ? 'WHERE ' . implode(' AND ', $w) : '';
  $subs = all("SELECT * FROM subscribers $where ORDER BY id DESC LIMIT 500", $sa);
  $sources = all("SELECT DISTINCT source FROM subscribers WHERE source<>''");
  $allTags = [];
  foreach (all("SELECT tags FROM subscribers WHERE tags<>''") as $t)
    foreach (array_filter(array_map('trim', explode(',', $t['tags']))) as $x) $allTags[$x] = true; ?>

  <div class="grid grid-2" style="margin-bottom:18px">
    <div class="card">
      <h3>Импорт CSV</h3>
      <p class="small muted">Колонки: email; name; source; tags. Первая строка-заголовок допускается. Дубли пропускаются.</p>
      <form method="post" action="<?= url('/admin/') ?>" enctype="multipart/form-data" class="field--inline">
        <?= csrf_field() ?><input type="hidden" name="do" value="import_subs">
        <input type="file" name="csv" accept=".csv,text/csv" required>
        <button class="btn btn--primary btn--sm"><?= admin_icon('download') ?>Импорт</button>
      </form>
    </div>
    <div class="card">
      <h3>Обслуживание</h3>
      <div class="toolbar">
        <a class="btn btn--ghost btn--sm" href="<?= a_link('users', ['action'=>'export_subs']) ?>"><?= admin_icon('download') ?>Экспорт CSV</a>
        <form method="post" action="<?= url('/admin/') ?>" style="display:inline">
          <?= csrf_field() ?><input type="hidden" name="do" value="merge_subs">
          <button class="btn btn--navy btn--sm" onclick="return confirm('Найти и слить дубли по email?')"><?= admin_icon('users') ?>Слить дубли</button>
        </form>
      </div>
      <p class="small muted" style="margin-top:8px">Всего активных: <?= (int)scalar("SELECT COUNT(*) FROM subscribers WHERE active=1") ?> из <?= (int)scalar("SELECT COUNT(*) FROM subscribers") ?></p>
    </div>
  </div>

  <form method="get" class="filters"><input type="hidden" name="p" value="users"><input type="hidden" name="tab" value="subs">
    <div class="field"><label>Сегмент (тег)</label><select name="seg"><option value="">Все</option>
      <?php foreach (array_keys($allTags) as $t): ?><option value="<?= h($t) ?>" <?= $seg===$t?'selected':'' ?>><?= h($t) ?></option><?php endforeach; ?></select></div>
    <div class="field"><label>Источник</label><select name="seg_source"><option value="">Все</option>
      <?php foreach ($sources as $s): ?><option value="<?= h($s['source']) ?>" <?= $src===$s['source']?'selected':'' ?>><?= h($s['source']) ?></option><?php endforeach; ?></select></div>
    <button class="btn btn--primary btn--sm">Фильтр</button>
    <a class="btn btn--ghost btn--sm" href="<?= a_link('users', ['tab'=>'subs']) ?>">Сброс</a>
  </form>

  <form method="post" action="<?= url('/admin/') ?>">
    <?= csrf_field() ?><input type="hidden" name="do" value="tag_subs">
    <div class="toolbar">
      <input name="tag" placeholder="Новый тег" style="max-width:200px;padding:8px 12px;border:1.5px solid var(--a-line);border-radius:9px">
      <button class="btn btn--navy btn--sm"><?= admin_icon('plus') ?>Присвоить тег выбранным</button>
      <span class="small muted">Показано: <?= count($subs) ?></span>
    </div>
    <div class="table-wrap"><table class="tbl">
      <thead><tr><th class="checkbox-cell"><input type="checkbox" onclick="document.querySelectorAll('.rowchk').forEach(c=>c.checked=this.checked)"></th>
        <th>Email</th><th>Имя</th><th>Источник</th><th>Теги</th><th>Активен</th></tr></thead>
      <tbody>
        <?php if (!$subs): ?><tr><td colspan="6" class="muted" style="text-align:center;padding:26px">Подписчиков нет</td></tr><?php endif; ?>
        <?php foreach ($subs as $s): ?>
          <tr>
            <td class="checkbox-cell"><input type="checkbox" class="rowchk" name="ids[]" value="<?= $s['id'] ?>"></td>
            <td class="small"><?= h($s['email']) ?></td>
            <td><?= h($s['name'] ?: '—') ?></td>
            <td class="small"><?= h($s['source'] ?: '—') ?></td>
            <td><?php foreach (array_filter(array_map('trim', explode(',', (string)$s['tags']))) as $t): ?><span class="tag"><?= h($t) ?></span><?php endforeach; ?></td>
            <td><?= $s['active'] ? '✓' : '—' ?></td>
          </tr>
        <?php endforeach; ?>
      </tbody>
    </table></div>
  </form>

<?php else:
  $logs = all("SELECT l.*, u.full_name, u.email FROM audit_log l LEFT JOIN users u ON u.id=l.user_id
               ORDER BY l.id DESC LIMIT 200"); ?>
  <div class="table-wrap"><table class="tbl">
    <thead><tr><th>Время</th><th>Пользователь</th><th>Действие</th><th>Объект</th><th>IP</th></tr></thead>
    <tbody>
      <?php if (!$logs): ?><tr><td colspan="5" class="muted" style="text-align:center;padding:26px">Журнал пуст</td></tr><?php endif; ?>
      <?php foreach ($logs as $l): ?>
        <tr>
          <td class="small"><?= h(date('d.m.y H:i', strtotime($l['created_at']))) ?></td>
          <td class="small"><?= h($l['full_name'] ?: $l['email'] ?: 'система') ?></td>
          <td><span class="badge badge--muted"><?= h($l['action']) ?></span></td>
          <td class="small"><?= h($l['entity']) ?><?= $l['entity_id'] ? ' #'.$l['entity_id'] : '' ?></td>
          <td class="small muted"><?= h($l['ip']) ?></td>
        </tr>
      <?php endforeach; ?>
    </tbody>
  </table></div>
<?php endif; ?>
<?php
$content = ob_get_clean();
admin_layout('Пользователи', $content, 'users');
