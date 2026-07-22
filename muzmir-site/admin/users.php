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

/* ---------- Обзорные счётчики ---------- */
$uTotal   = (int) scalar("SELECT COUNT(*) FROM users");
$uStaff   = (int) scalar("SELECT COUNT(*) FROM users WHERE role IN ('jury','designer','accountant','moderator','admin','owner')");
$sTotal   = (int) scalar("SELECT COUNT(*) FROM subscribers");
$sActive  = (int) scalar("SELECT COUNT(*) FROM subscribers WHERE active=1");
$aTotal   = (int) scalar("SELECT COUNT(*) FROM audit_log");

/** Класс цветного бейджа для роли. */
function role_badge_class(string $r): string {
    return [
        'owner'=>'gold','admin'=>'graded','moderator'=>'new','jury'=>'sent',
        'designer'=>'judging','accountant'=>'open','teacher'=>'muted','user'=>'muted',
    ][$r] ?? 'muted';
}
/** Класс бейджа для типа действия аудита. */
function audit_badge_class(string $a): string {
    if (str_contains($a,'delete')) return 'rejected';
    if (str_contains($a,'export')) return 'new';
    if (str_contains($a,'import')||str_contains($a,'save')||str_contains($a,'create')) return 'paid';
    if (str_contains($a,'role'))   return 'graded';
    if (str_contains($a,'merge')||str_contains($a,'tag')||str_contains($a,'flag')||str_contains($a,'moderate')) return 'judging';
    if (str_contains($a,'login')||str_contains($a,'logout')) return 'muted';
    return 'muted';
}

ob_start(); ?>
<style>
/* ===== Users premium (scoped) ===== */
.u-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:22px}
.u-avatar{width:34px;height:34px;border-radius:50%;background:var(--grad-gold);color:#1a1400;font-family:var(--ff-head);
  font-weight:700;display:inline-flex;align-items:center;justify-content:center;font-size:.95rem;flex:0 0 auto;overflow:hidden}
.u-avatar img{width:100%;height:100%;object-fit:cover}
.u-idcell{display:flex;align-items:center;gap:11px}
.u-idcell b{display:block;line-height:1.15}
.u-me{font-size:.66rem;font-weight:800;color:var(--a-gold-deep,#8B6F1F);text-transform:uppercase;letter-spacing:.05em}
.u-chips{display:flex;flex-wrap:wrap;gap:7px;margin:2px 0 4px}
.u-chip{font:600 .78rem/1 var(--ff-body);padding:6px 11px;border-radius:999px;border:1.5px solid var(--a-line);
  background:#fff;color:var(--a-navy-2);text-decoration:none;transition:.14s}
.u-chip:hover{border-color:var(--a-gold)}
.u-chip.is-on{background:var(--grad-gold);border-color:transparent;color:#1a1400}
.u-audit-meta{margin-top:4px}
.u-audit-meta summary{cursor:pointer;font-size:.76rem;color:var(--a-muted);list-style:none}
.u-audit-meta summary::-webkit-details-marker{display:none}
.u-audit-meta summary::before{content:"показать данные";}
.u-audit-meta[open] summary::before{content:"скрыть данные";}
.u-audit-meta pre{margin:6px 0 0;background:var(--a-parchment);border:1px solid var(--a-line);border-radius:8px;
  padding:9px 11px;font-size:.76rem;white-space:pre-wrap;word-break:break-word;color:var(--a-ink)}
@media (max-width:820px){.u-stats{grid-template-columns:1fr}}
</style>

<div class="section-title"><h2>Пользователи и подписчики</h2></div>

<div class="u-stats">
  <div class="stat"><div class="stat__icon"><?= admin_icon('users') ?></div>
    <div class="stat__label">Аккаунты</div><div class="stat__value"><?= number_format($uTotal,0,',',' ') ?></div>
    <div class="stat__sub"><?= $uStaff ?> с ролью в панели</div></div>
  <div class="stat"><div class="stat__icon"><?= admin_icon('newsletter') ?></div>
    <div class="stat__label">Подписчики</div><div class="stat__value"><?= number_format($sTotal,0,',',' ') ?></div>
    <div class="stat__sub"><?= $sActive ?> активных</div></div>
  <div class="stat"><div class="stat__icon"><?= admin_icon('clock') ?></div>
    <div class="stat__label">Записей аудита</div><div class="stat__value"><?= number_format($aTotal,0,',',' ') ?></div>
    <div class="stat__sub">журнал действий</div></div>
</div>

<div class="tabs">
  <a href="<?= a_link('users', ['tab'=>'users']) ?>" class="<?= $tab==='users'?'active':'' ?>">Пользователи</a>
  <a href="<?= a_link('users', ['tab'=>'subs']) ?>" class="<?= $tab==='subs'?'active':'' ?>">Подписчики</a>
  <a href="<?= a_link('users', ['tab'=>'audit']) ?>" class="<?= $tab==='audit'?'active':'' ?>">Аудит-лог</a>
</div>

<?php if ($tab === 'users'):
  $qs = input('q');
  $rf = input('role');
  $w = []; $ua = [];
  if ($qs) { $w[] = "(email LIKE ? OR full_name LIKE ? OR phone LIKE ?)"; $ua[]="%$qs%"; $ua[]="%$qs%"; $ua[]="%$qs%"; }
  if ($rf && isset(ROLE_RANK[$rf])) { $w[] = "role=?"; $ua[] = $rf; }
  $where = $w ? 'WHERE ' . implode(' AND ', $w) : '';
  $users = all("SELECT * FROM users $where ORDER BY (role='owner') DESC, id DESC LIMIT 300", $ua);
  $roles = array_keys(ROLE_RANK);
  $meId  = (int)(current_user()['id'] ?? 0); ?>
  <form method="get" class="filters"><input type="hidden" name="p" value="users"><input type="hidden" name="tab" value="users">
    <div class="field"><label>Поиск</label><input name="q" value="<?= h($qs) ?>" placeholder="email, имя или телефон"></div>
    <div class="field"><label>Роль</label><select name="role"><option value="">Все роли</option>
      <?php foreach ($roles as $r): ?><option value="<?= $r ?>" <?= $rf===$r?'selected':'' ?>><?= h(role_ru($r)) ?></option><?php endforeach; ?>
    </select></div>
    <button class="btn btn--primary btn--sm">Найти</button>
    <?php if ($qs||$rf): ?><a class="btn btn--ghost btn--sm" href="<?= a_link('users',['tab'=>'users']) ?>">Сброс</a><?php endif; ?>
  </form>
  <div class="table-wrap"><table class="tbl">
    <thead><tr><th>ID</th><th>Пользователь</th><th>Телефон</th><th>Роль</th><th>Регистрация</th><th>Назначить роль</th></tr></thead>
    <tbody>
      <?php if (!$users): ?><tr><td colspan="6" class="muted" style="text-align:center;padding:26px">По запросу никого не найдено</td></tr><?php endif; ?>
      <?php foreach ($users as $u): $ini = mb_strtoupper(mb_substr($u['full_name'] ?: $u['email'] ?: '?',0,1)); ?>
        <tr>
          <td class="small"><?= $u['id'] ?></td>
          <td>
            <div class="u-idcell">
              <span class="u-avatar"><?php if(trim((string)$u['avatar'])!==''): ?><img src="<?= h($u['avatar']) ?>" alt="" loading="lazy" onerror="this.replaceWith(document.createTextNode('<?= h($ini) ?>'))"><?php else: ?><?= h($ini) ?><?php endif; ?></span>
              <span><b><?= h($u['full_name'] ?: '—') ?><?php if($u['id']==$meId): ?> <span class="u-me">вы</span><?php endif; ?></b><span class="small muted"><?= h($u['email']) ?></span></span>
            </div>
          </td>
          <td class="small"><?= h($u['phone'] ?: '—') ?></td>
          <td><span class="badge badge--<?= role_badge_class($u['role']) ?>"><?= h(role_ru($u['role'])) ?></span></td>
          <td class="small"><?= h(date('d.m.y', strtotime($u['created_at']))) ?></td>
          <td>
            <?php if ($u['role'] !== 'owner'): ?>
            <form method="post" action="<?= url('/admin/') ?>" class="field--inline">
              <?= csrf_field() ?><input type="hidden" name="do" value="set_role"><input type="hidden" name="uid" value="<?= $u['id'] ?>">
              <select name="role" style="max-width:160px" onchange="this.form.submit()">
                <?php foreach ($roles as $r): if ($r==='owner') continue; ?><option value="<?= $r ?>" <?= $u['role']===$r?'selected':'' ?>><?= h(role_ru($r)) ?></option><?php endforeach; ?>
              </select>
            </form>
            <?php else: ?><span class="small muted">защищено</span><?php endif; ?>
          </td>
        </tr>
      <?php endforeach; ?>
    </tbody>
  </table></div>
  <p class="small muted" style="margin-top:10px">Показано <?= count($users) ?><?= count($users)>=300?' (первые 300)':'' ?>. Роль применяется мгновенно и пишется в аудит-лог.</p>

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
      <h3>Импорт подписчиков (CSV)</h3>
      <p class="small muted">Колонки через «;»: <span class="tag">email</span><span class="tag">name</span><span class="tag">source</span><span class="tag">tags</span>. Строка-заголовок допускается, дубли по email пропускаются.</p>
      <form method="post" action="<?= url('/admin/') ?>" enctype="multipart/form-data" class="field--inline">
        <?= csrf_field() ?><input type="hidden" name="do" value="import_subs">
        <input type="file" name="csv" accept=".csv,text/csv" required style="flex:1">
        <button class="btn btn--primary btn--sm"><?= admin_icon('download') ?>Импорт</button>
      </form>
    </div>
    <div class="card">
      <h3>Обслуживание базы</h3>
      <div class="toolbar" style="margin-bottom:8px">
        <a class="btn btn--ghost btn--sm" href="<?= a_link('users', ['action'=>'export_subs']) ?>"><?= admin_icon('download') ?>Экспорт CSV</a>
        <form method="post" action="<?= url('/admin/') ?>" style="display:inline">
          <?= csrf_field() ?><input type="hidden" name="do" value="merge_subs">
          <button class="btn btn--navy btn--sm" onclick="return confirm('Найти и слить дубли по email? Теги будут объединены.')"><?= admin_icon('users') ?>Слить дубли</button>
        </form>
      </div>
      <div class="kv" style="grid-template-columns:auto 1fr">
        <dt>Активных</dt><dd><b><?= $sActive ?></b> из <?= $sTotal ?></dd>
        <dt>Сегментов (тегов)</dt><dd><?= count($allTags) ?></dd>
        <dt>Источников</dt><dd><?= count($sources) ?></dd>
      </div>
    </div>
  </div>

  <?php if ($allTags): ?>
  <div class="u-chips">
    <a class="u-chip <?= $seg===''?'is-on':'' ?>" href="<?= a_link('users',['tab'=>'subs']+($src?['seg_source'=>$src]:[])) ?>">Все теги</a>
    <?php foreach (array_keys($allTags) as $t): ?>
      <a class="u-chip <?= $seg===$t?'is-on':'' ?>" href="<?= a_link('users',['tab'=>'subs','seg'=>$t]+($src?['seg_source'=>$src]:[])) ?>"><?= h($t) ?></a>
    <?php endforeach; ?>
  </div>
  <?php endif; ?>

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
      <span class="small muted">Показано: <?= count($subs) ?><?= count($subs)>=500?' (первые 500)':'' ?> · выбрано <b id="selCnt">0</b></span>
    </div>
    <div class="table-wrap"><table class="tbl">
      <thead><tr><th class="checkbox-cell"><input type="checkbox" id="chkAll"></th>
        <th>Email</th><th>Имя</th><th>Источник</th><th>Теги</th><th>Активен</th></tr></thead>
      <tbody>
        <?php if (!$subs): ?><tr><td colspan="6" class="muted" style="text-align:center;padding:26px">Подписчиков нет</td></tr><?php endif; ?>
        <?php foreach ($subs as $s): ?>
          <tr>
            <td class="checkbox-cell"><input type="checkbox" class="rowchk" name="ids[]" value="<?= $s['id'] ?>"></td>
            <td class="small"><?= h($s['email']) ?></td>
            <td><?= h($s['name'] ?: '—') ?></td>
            <td class="small"><?php if($s['source']!==''): ?><span class="tag"><?= h($s['source']) ?></span><?php else: ?>—<?php endif; ?></td>
            <td><?php foreach (array_filter(array_map('trim', explode(',', (string)$s['tags']))) as $t): ?><span class="tag"><?= h($t) ?></span><?php endforeach; ?></td>
            <td><?= $s['active'] ? '<span class="badge badge--paid">да</span>' : '<span class="badge badge--muted">нет</span>' ?></td>
          </tr>
        <?php endforeach; ?>
      </tbody>
    </table></div>
  </form>
  <script>
  (function(){
    var all=document.getElementById('chkAll'), cnt=document.getElementById('selCnt');
    function boxes(){return Array.prototype.slice.call(document.querySelectorAll('.rowchk'));}
    function upd(){cnt.textContent=boxes().filter(function(c){return c.checked;}).length;}
    if(all)all.addEventListener('click',function(){boxes().forEach(function(c){c.checked=all.checked;});upd();});
    document.addEventListener('change',function(e){if(e.target&&e.target.classList.contains('rowchk'))upd();});
    upd();
  })();
  </script>

<?php else:
  $af = input('af'); $uf = (int) input('uf');
  $w = []; $la = [];
  if ($af) { $w[] = "l.action=?"; $la[] = $af; }
  if ($uf) { $w[] = "l.user_id=?"; $la[] = $uf; }
  $where = $w ? 'WHERE ' . implode(' AND ', $w) : '';
  $logs = all("SELECT l.*, u.full_name, u.email FROM audit_log l LEFT JOIN users u ON u.id=l.user_id
               $where ORDER BY l.id DESC LIMIT 200", $la);
  $actions = all("SELECT DISTINCT action FROM audit_log WHERE action<>'' ORDER BY action");
  $actors  = all("SELECT DISTINCT l.user_id, u.full_name, u.email FROM audit_log l
                  LEFT JOIN users u ON u.id=l.user_id WHERE l.user_id IS NOT NULL ORDER BY u.full_name"); ?>
  <form method="get" class="filters"><input type="hidden" name="p" value="users"><input type="hidden" name="tab" value="audit">
    <div class="field"><label>Действие</label><select name="af"><option value="">Все действия</option>
      <?php foreach ($actions as $a): ?><option value="<?= h($a['action']) ?>" <?= $af===$a['action']?'selected':'' ?>><?= h($a['action']) ?></option><?php endforeach; ?></select></div>
    <div class="field"><label>Пользователь</label><select name="uf"><option value="">Все</option>
      <?php foreach ($actors as $ac): ?><option value="<?= (int)$ac['user_id'] ?>" <?= $uf===(int)$ac['user_id']?'selected':'' ?>><?= h($ac['full_name'] ?: $ac['email'] ?: ('#'.$ac['user_id'])) ?></option><?php endforeach; ?></select></div>
    <button class="btn btn--primary btn--sm">Фильтр</button>
    <?php if ($af||$uf): ?><a class="btn btn--ghost btn--sm" href="<?= a_link('users',['tab'=>'audit']) ?>">Сброс</a><?php endif; ?>
  </form>
  <div class="table-wrap"><table class="tbl">
    <thead><tr><th>Время</th><th>Пользователь</th><th>Действие</th><th>Объект</th><th>IP</th></tr></thead>
    <tbody>
      <?php if (!$logs): ?><tr><td colspan="5" class="muted" style="text-align:center;padding:26px">Журнал пуст</td></tr><?php endif; ?>
      <?php foreach ($logs as $l): $meta = trim((string)$l['meta']); $hasMeta = $meta!=='' && $meta!=='[]' && $meta!=='{}' && $meta!=='null'; ?>
        <tr>
          <td class="small" style="white-space:nowrap"><?= h(date('d.m.y H:i', strtotime($l['created_at']))) ?></td>
          <td class="small"><?= h($l['full_name'] ?: $l['email'] ?: 'система') ?></td>
          <td><span class="badge badge--<?= audit_badge_class($l['action']) ?>"><?= h($l['action']) ?></span>
            <?php if ($hasMeta): ?><details class="u-audit-meta"><summary></summary><pre><?= h($meta) ?></pre></details><?php endif; ?></td>
          <td class="small"><?= h($l['entity']) ?><?= $l['entity_id'] ? ' #'.$l['entity_id'] : '' ?></td>
          <td class="small muted"><?= h($l['ip']) ?></td>
        </tr>
      <?php endforeach; ?>
    </tbody>
  </table></div>
  <p class="small muted" style="margin-top:10px">Последние 200 записей<?= ($af||$uf)?' по фильтру':'' ?>. Журнал только для чтения.</p>
<?php endif; ?>
<?php
$content = ob_get_clean();
admin_layout('Пользователи', $content, 'users');
