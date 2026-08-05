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

    // Мягко гарантируем колонку blocked (для блокировки аккаунтов).
    try { db()->exec("ALTER TABLE users ADD COLUMN blocked INTEGER DEFAULT 0"); } catch (\Throwable $e) {}

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

    if ($do === 'block_user' || $do === 'unblock_user') {
        $uid = (int) input('uid');
        $target = one("SELECT role FROM users WHERE id=?", [$uid]);
        $me = (int) (current_user()['id'] ?? 0);
        if ($target && $target['role'] !== 'owner' && $uid !== $me) {
            $b = $do === 'block_user' ? 1 : 0;
            update('users', ['blocked'=>$b], 'id=:wid', ['wid'=>$uid]);
            audit($b ? 'user_block' : 'user_unblock', 'user', $uid);
            flash($b ? 'Пользователь заблокирован.' : 'Пользователь разблокирован.', 'success');
        } else flash('Этого пользователя изменить нельзя.', 'warning');
        admin_redirect('users', ['tab'=>'users']);
    }

    if ($do === 'delete_user') {
        $uid = (int) input('uid');
        $target = one("SELECT role FROM users WHERE id=?", [$uid]);
        $me = (int) (current_user()['id'] ?? 0);
        if ($target && $target['role'] !== 'owner' && $uid !== $me) {
            q("DELETE FROM users WHERE id=?", [$uid]);
            audit('user_delete', 'user', $uid);
            flash('Пользователь удалён.', 'success');
        } else flash('Владельца и себя удалить нельзя.', 'warning');
        admin_redirect('users', ['tab'=>'users']);
    }

    if ($do === 'edit_user') {
        $uid = (int) input('uid');
        $target = one("SELECT * FROM users WHERE id=?", [$uid]);
        $me = (int) (current_user()['id'] ?? 0);
        if (!$target) { flash('Пользователь не найден.', 'error'); admin_redirect('users', ['tab'=>'users']); }
        $email = mb_strtolower(input('email'));
        if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
            flash('Некорректный email.', 'error'); admin_redirect('users', ['tab'=>'users']);
        }
        // email должен быть уникален среди других аккаунтов
        $dupe = one("SELECT id FROM users WHERE lower(email)=? AND id<>?", [$email, $uid]);
        if ($dupe) { flash('Этот email уже занят другим аккаунтом.', 'error'); admin_redirect('users', ['tab'=>'users']); }

        $data = [
            'full_name' => input('full_name'),
            'email'     => $email,
            'phone'     => input('phone'),
            'nickname'  => input('nickname'),
            'category'  => input('category'),
        ];

        // Роль: владельца понижать нельзя; свою роль менять нельзя (защита от само-понижения).
        $role = input('role');
        if (isset(ROLE_RANK[$role]) && $role !== $target['role']) {
            if ($target['role'] === 'owner') {
                flash('Роль владельца изменить нельзя — остальные поля сохранены.', 'warning');
            } elseif ($uid === $me) {
                flash('Свою роль изменить нельзя — остальные поля сохранены.', 'warning');
            } elseif ($role === 'owner') {
                flash('Назначить роль «Владелец» нельзя — остальные поля сохранены.', 'warning');
            } else {
                $data['role'] = $role;
            }
        }

        update('users', $data, 'id=:wid', ['wid'=>$uid]);
        audit('user_edit', 'user', $uid, ['fields'=>array_keys($data)]);
        flash('Профиль участника обновлён.', 'success');
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

    if ($do === 'sub_delete') {
        $sid = (int) input('sid');
        if ($sid && one("SELECT id FROM subscribers WHERE id=?", [$sid])) {
            q("DELETE FROM subscribers WHERE id=?", [$sid]);
            audit('subscriber_delete', 'subscriber', $sid);
            flash('Подписчик удалён.', 'success');
        } else flash('Подписчик не найден.', 'warning');
        admin_redirect('users', ['tab'=>'subs']);
    }

    if ($do === 'sub_toggle') {
        $sid = (int) input('sid');
        $cur = one("SELECT active FROM subscribers WHERE id=?", [$sid]);
        if ($cur !== null) {
            $na = (int)$cur['active'] === 1 ? 0 : 1;
            update('subscribers', ['active'=>$na], 'id=:wid', ['wid'=>$sid]);
            audit($na ? 'subscriber_enable' : 'subscriber_disable', 'subscriber', $sid);
            flash($na ? 'Подписчик включён.' : 'Подписчик отключён.', 'success');
        } else flash('Подписчик не найден.', 'warning');
        admin_redirect('users', ['tab'=>'subs']);
    }

    if ($do === 'sub_edit') {
        $sid = (int) input('sid');
        if ($sid && one("SELECT id FROM subscribers WHERE id=?", [$sid])) {
            $tags = implode(', ', array_filter(array_map('trim', explode(',', input('tags')))));
            update('subscribers', ['name'=>input('name'), 'tags'=>$tags], 'id=:wid', ['wid'=>$sid]);
            audit('subscriber_edit', 'subscriber', $sid, ['name'=>input('name')]);
            flash('Данные подписчика обновлены.', 'success');
        } else flash('Подписчик не найден.', 'warning');
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
/* ===== Инлайн-редактирование / профиль ===== */
.u-detailrow>td{padding:0!important;border-top:none!important;background:transparent}
.u-tools{display:flex;flex-wrap:wrap;gap:8px;padding:2px 0 12px}
details.u-d{display:inline-block}
details.u-d>summary{list-style:none;cursor:pointer;user-select:none}
details.u-d>summary::-webkit-details-marker{display:none}
details.u-d>summary::marker{content:""}
details.u-d[open]>summary{border-color:var(--a-gold)}
.u-panel{margin:8px 0 4px;padding:15px;border:1px solid var(--a-line);border-radius:12px;background:#fff;max-width:680px;box-shadow:0 6px 20px rgba(20,16,4,.06)}
.u-panel .field{margin:0}
.u-panel label{display:block;font-size:.68rem;font-weight:800;color:var(--a-muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:5px}
.u-panel input,.u-panel select{width:100%;padding:9px 12px;border:1.5px solid var(--a-line);border-radius:9px;font:inherit;background:#fff;color:var(--a-ink)}
.u-panel input:disabled{background:var(--a-parchment);color:var(--a-muted)}
.u-form-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px}
@media(max-width:640px){.u-form-grid{grid-template-columns:1fr}}
.u-profile-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:10px;margin-bottom:14px}
.u-pm{background:var(--a-parchment);border:1px solid var(--a-line);border-radius:10px;padding:10px 12px}
.u-pm .k{font-size:.66rem;text-transform:uppercase;letter-spacing:.05em;color:var(--a-muted);font-weight:800}
.u-pm .v{font-weight:700;color:var(--a-ink);margin-top:3px;font-size:.95rem}
.u-logins{display:flex;flex-wrap:wrap;gap:6px}
.u-applist{margin:0;padding:0;list-style:none;display:flex;flex-direction:column;gap:6px}
.u-applist li{display:flex;align-items:center;gap:9px;flex-wrap:wrap;font-size:.86rem;padding:7px 10px;border:1px solid var(--a-line);border-radius:9px;background:#fff}
.u-applist li .num{font-family:var(--ff-head,inherit);font-weight:700;color:var(--a-navy-2)}
details.u-d>summary svg{width:15px;height:15px;vertical-align:-2px;margin-right:4px}
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
  $meId  = (int)(current_user()['id'] ?? 0);
  // Кол-во заявок по пользователям (одним запросом, для карточки профиля).
  $appCounts = [];
  foreach (all("SELECT user_id, COUNT(*) c FROM applications WHERE user_id IS NOT NULL GROUP BY user_id") as $ac)
      $appCounts[(int)$ac['user_id']] = (int)$ac['c']; ?>
  <form method="get" class="filters"><input type="hidden" name="p" value="users"><input type="hidden" name="tab" value="users">
    <div class="field"><label>Поиск</label><input name="q" value="<?= h($qs) ?>" placeholder="email, имя или телефон"></div>
    <div class="field"><label>Роль</label><select name="role"><option value="">Все роли</option>
      <?php foreach ($roles as $r): ?><option value="<?= $r ?>" <?= $rf===$r?'selected':'' ?>><?= h(role_ru($r)) ?></option><?php endforeach; ?>
    </select></div>
    <button class="btn btn--primary btn--sm">Найти</button>
    <?php if ($qs||$rf): ?><a class="btn btn--ghost btn--sm" href="<?= a_link('users',['tab'=>'users']) ?>">Сброс</a><?php endif; ?>
  </form>
  <div class="table-wrap"><table class="tbl">
    <thead><tr><th>ID</th><th>Пользователь</th><th>Телефон</th><th>Роль</th><th>Регистрация</th><th>Назначить роль</th><th>Действия</th></tr></thead>
    <tbody>
      <?php if (!$users): ?><tr><td colspan="7" class="muted" style="text-align:center;padding:26px">По запросу никого не найдено</td></tr><?php endif; ?>
      <?php foreach ($users as $u): $ini = mb_strtoupper(mb_substr($u['full_name'] ?: $u['email'] ?: '?',0,1)); $isBlocked = (int)($u['blocked'] ?? 0) === 1; ?>
        <tr<?= $isBlocked ? ' style="opacity:.6"' : '' ?>>
          <td class="small"><?= $u['id'] ?></td>
          <td>
            <div class="u-idcell">
              <span class="u-avatar"><?php if(trim((string)$u['avatar'])!==''): ?><img src="<?= h($u['avatar']) ?>" alt="" loading="lazy" onerror="this.replaceWith(document.createTextNode('<?= h($ini) ?>'))"><?php else: ?><?= h($ini) ?><?php endif; ?></span>
              <span><b><?= h($u['full_name'] ?: '—') ?><?php if($u['id']==$meId): ?> <span class="u-me">вы</span><?php endif; ?><?php if($isBlocked): ?> <span class="badge badge--muted">заблокирован</span><?php endif; ?></b><span class="small muted"><?= h($u['email']) ?></span></span>
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
          <td>
            <?php if ($u['role'] !== 'owner' && $u['id'] != $meId): ?>
            <div style="display:flex;gap:6px;flex-wrap:wrap">
              <form method="post" action="<?= url('/admin/') ?>">
                <?= csrf_field() ?><input type="hidden" name="do" value="<?= $isBlocked ? 'unblock_user' : 'block_user' ?>"><input type="hidden" name="uid" value="<?= $u['id'] ?>">
                <button class="btn btn--ghost btn--sm" type="submit"><?= $isBlocked ? 'Разблокировать' : 'Блокировать' ?></button>
              </form>
              <form method="post" action="<?= url('/admin/') ?>" onsubmit="return confirm('Удалить пользователя <?= h(addslashes($u['email'] ?: (string)$u['id'])) ?> без возможности восстановления?')">
                <?= csrf_field() ?><input type="hidden" name="do" value="delete_user"><input type="hidden" name="uid" value="<?= $u['id'] ?>">
                <button class="btn btn--sm" type="submit" style="background:#8b2f2f;color:#fff">Удалить</button>
              </form>
            </div>
            <?php else: ?><span class="small muted">—</span><?php endif; ?>
          </td>
        </tr>
        <?php
          // Способы входа
          $logins = [];
          if (trim((string)($u['password_hash'] ?? '')) !== '') $logins[] = 'Email/пароль';
          if (trim((string)($u['google_id'] ?? '')) !== '')     $logins[] = 'Google';
          if (trim((string)($u['tg_id'] ?? '')) !== '')         $logins[] = 'Telegram';
          if (trim((string)($u['vk_id'] ?? '')) !== '')         $logins[] = 'VK';
          if (trim((string)($u['max_id'] ?? '')) !== '')        $logins[] = 'MAX';
          $uApps = (int)($appCounts[(int)$u['id']] ?? 0);
          $uAppRows = $uApps ? all("SELECT id, number, status, created_at FROM applications WHERE user_id=? ORDER BY id DESC LIMIT 10", [$u['id']]) : [];
          $roleLocked = ($u['role'] === 'owner') || ((int)$u['id'] === $meId);
        ?>
        <tr class="u-detailrow"><td colspan="7">
          <div class="u-tools">
            <details class="u-d">
              <summary class="btn btn--ghost btn--sm"><?= admin_icon('edit') ?>Изменить</summary>
              <div class="u-panel">
                <form method="post" action="<?= url('/admin/') ?>">
                  <?= csrf_field() ?><input type="hidden" name="do" value="edit_user"><input type="hidden" name="uid" value="<?= $u['id'] ?>">
                  <div class="u-form-grid">
                    <div class="field"><label>Имя</label><input name="full_name" value="<?= h((string)$u['full_name']) ?>" placeholder="ФИО"></div>
                    <div class="field"><label>Email</label><input name="email" type="email" value="<?= h((string)$u['email']) ?>" required></div>
                    <div class="field"><label>Телефон</label><input name="phone" value="<?= h((string)$u['phone']) ?>"></div>
                    <div class="field"><label>Никнейм</label><input name="nickname" value="<?= h((string)($u['nickname'] ?? '')) ?>"></div>
                    <div class="field"><label>Категория</label><input name="category" value="<?= h((string)($u['category'] ?? '')) ?>"></div>
                    <div class="field"><label>Роль</label>
                      <?php if ($roleLocked): ?>
                        <input value="<?= h(role_ru($u['role'])) ?>" disabled>
                        <input type="hidden" name="role" value="<?= h($u['role']) ?>">
                        <span class="small muted"><?= $u['role']==='owner' ? 'роль владельца защищена' : 'свою роль изменить нельзя' ?></span>
                      <?php else: ?>
                        <select name="role">
                          <?php foreach ($roles as $r): if ($r==='owner') continue; ?><option value="<?= $r ?>" <?= $u['role']===$r?'selected':'' ?>><?= h(role_ru($r)) ?></option><?php endforeach; ?>
                        </select>
                      <?php endif; ?>
                    </div>
                  </div>
                  <button class="btn btn--primary btn--sm" type="submit"><?= admin_icon('check') ?>Сохранить профиль</button>
                </form>
              </div>
            </details>
            <details class="u-d">
              <summary class="btn btn--ghost btn--sm"><?= admin_icon('eye') ?>Профиль</summary>
              <div class="u-panel">
                <div class="u-profile-grid">
                  <div class="u-pm"><div class="k">ID</div><div class="v">#<?= $u['id'] ?></div></div>
                  <div class="u-pm"><div class="k">Регистрация</div><div class="v"><?= h(date('d.m.Y', strtotime($u['created_at']))) ?></div></div>
                  <div class="u-pm"><div class="k">Последний вход</div><div class="v"><?= !empty($u['last_login']) ? h(date('d.m.Y H:i', strtotime($u['last_login']))) : '—' ?></div></div>
                  <div class="u-pm"><div class="k">Заявок</div><div class="v"><?= $uApps ?></div></div>
                  <div class="u-pm"><div class="k">Email подтверждён</div><div class="v"><?= (int)($u['email_verified'] ?? 0) ? 'да' : 'нет' ?></div></div>
                  <div class="u-pm"><div class="k">Город</div><div class="v"><?= h((string)($u['city'] ?? '')) ?: '—' ?></div></div>
                </div>
                <div style="margin-bottom:12px">
                  <div class="k small muted" style="font-weight:800;text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px">Способы входа</div>
                  <div class="u-logins">
                    <?php if ($logins): foreach ($logins as $lg): ?><span class="tag"><?= h($lg) ?></span><?php endforeach; else: ?><span class="small muted">не заданы</span><?php endif; ?>
                  </div>
                </div>
                <div>
                  <div class="k small muted" style="font-weight:800;text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px">Заявки<?= $uApps>10 ? ' (последние 10 из '.$uApps.')' : '' ?></div>
                  <?php if ($uAppRows): ?>
                    <ul class="u-applist">
                      <?php foreach ($uAppRows as $ap): ?>
                        <li><span class="num"><?= h((string)($ap['number'] ?: ('#'.$ap['id']))) ?></span>
                          <span class="badge badge--<?= role_badge_class('user') ?>" style="background:var(--a-parchment);border:1px solid var(--a-line);color:var(--a-ink)"><?= h(app_status_ru((string)$ap['status'])) ?></span>
                          <span class="small muted"><?= h(date('d.m.y', strtotime($ap['created_at']))) ?></span>
                        </li>
                      <?php endforeach; ?>
                    </ul>
                  <?php else: ?><span class="small muted">заявок нет</span><?php endif; ?>
                </div>
              </div>
            </details>
          </div>
        </td></tr>
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
        <th>Email</th><th>Имя</th><th>Источник</th><th>Теги</th><th>Активен</th><th>Действия</th></tr></thead>
      <tbody>
        <?php if (!$subs): ?><tr><td colspan="7" class="muted" style="text-align:center;padding:26px">Подписчиков нет</td></tr><?php endif; ?>
        <?php foreach ($subs as $s): ?>
          <tr>
            <td class="checkbox-cell"><input type="checkbox" class="rowchk" name="ids[]" value="<?= $s['id'] ?>"></td>
            <td class="small"><?= h($s['email']) ?></td>
            <td><?= h($s['name'] ?: '—') ?></td>
            <td class="small"><?php if($s['source']!==''): ?><span class="tag"><?= h($s['source']) ?></span><?php else: ?>—<?php endif; ?></td>
            <td><?php foreach (array_filter(array_map('trim', explode(',', (string)$s['tags']))) as $t): ?><span class="tag"><?= h($t) ?></span><?php endforeach; ?></td>
            <td><?= $s['active'] ? '<span class="badge badge--paid">да</span>' : '<span class="badge badge--muted">нет</span>' ?></td>
            <td>
              <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:flex-start">
                <button form="s_tog_<?= $s['id'] ?>" type="submit" class="btn btn--ghost btn--sm"><?= $s['active'] ? 'Выключить' : 'Включить' ?></button>
                <details class="u-d">
                  <summary class="btn btn--ghost btn--sm"><?= admin_icon('edit') ?>Изменить</summary>
                  <div class="u-panel" style="min-width:260px">
                    <div class="u-form-grid" style="grid-template-columns:1fr;margin-bottom:12px">
                      <div class="field"><label>Имя</label><input form="s_edit_<?= $s['id'] ?>" name="name" value="<?= h((string)$s['name']) ?>"></div>
                      <div class="field"><label>Теги (через запятую)</label><input form="s_edit_<?= $s['id'] ?>" name="tags" value="<?= h((string)$s['tags']) ?>"></div>
                    </div>
                    <button form="s_edit_<?= $s['id'] ?>" type="submit" class="btn btn--primary btn--sm"><?= admin_icon('check') ?>Сохранить</button>
                  </div>
                </details>
                <button form="s_del_<?= $s['id'] ?>" type="submit" class="btn btn--sm" style="background:#8b2f2f;color:#fff" onclick="return confirm('Удалить подписчика <?= h(addslashes($s['email'])) ?>?')">Удалить</button>
              </div>
            </td>
          </tr>
        <?php endforeach; ?>
      </tbody>
    </table></div>
  </form>
  <?php /* Мини-формы построчных действий (вне основной формы — вложенные формы недопустимы) */ ?>
  <?php foreach ($subs as $s): ?>
    <form id="s_tog_<?= $s['id'] ?>" method="post" action="<?= url('/admin/') ?>" style="display:none"><?= csrf_field() ?><input type="hidden" name="do" value="sub_toggle"><input type="hidden" name="sid" value="<?= $s['id'] ?>"></form>
    <form id="s_del_<?= $s['id'] ?>" method="post" action="<?= url('/admin/') ?>" style="display:none"><?= csrf_field() ?><input type="hidden" name="do" value="sub_delete"><input type="hidden" name="sid" value="<?= $s['id'] ?>"></form>
    <form id="s_edit_<?= $s['id'] ?>" method="post" action="<?= url('/admin/') ?>" style="display:none"><?= csrf_field() ?><input type="hidden" name="do" value="sub_edit"><input type="hidden" name="sid" value="<?= $s['id'] ?>"></form>
  <?php endforeach; ?>
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
