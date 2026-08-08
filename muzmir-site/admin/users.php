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
        admin_redirect('users', input('back_profile') === '1' ? ['action'=>'profile','id'=>$uid] : ['tab'=>'users']);
    }

    /* ---- Полное управление профилем пользователя из админки ---- */
    if (in_array($do, ['cancel_vip','grant_vip','del_diploma','del_order','set_avatar','user_pass'], true)) {
        $uid = (int) input('uid');
        $u = one("SELECT * FROM users WHERE id=?", [$uid]);
        if (!$u) { flash('Пользователь не найден.', 'error'); admin_redirect('users', ['tab'=>'users']); }
        $backP = ['action'=>'profile','id'=>$uid];
        if (is_file(BASE_PATH . '/core/club.php')) require_once BASE_PATH . '/core/club.php';

        if ($do === 'cancel_vip') {
            if (function_exists('club_boot')) club_boot();
            q("UPDATE club_members SET active=0 WHERE user_id=?", [$uid]);
            audit('club_cancel', 'user', $uid);
            flash('Членство ВИП-клуба отменено.', 'success');
            admin_redirect('users', $backP);
        }
        if ($do === 'grant_vip') {
            $months = (int) input('months') === 12 ? 12 : 1;
            if (function_exists('club_grant')) club_grant($uid, $months, 'manual');
            audit('club_grant', 'user', $uid, ['months'=>$months]);
            flash('ВИП-клуб выдан на ' . ($months === 12 ? '1 год' : '1 месяц') . '.', 'success');
            admin_redirect('users', $backP);
        }
        if ($do === 'del_diploma') {
            $did = (int) input('did');
            // Диплом должен принадлежать заявке этого пользователя.
            $d = one("SELECT d.id FROM diplomas d JOIN applications a ON a.id=d.application_id WHERE d.id=? AND a.user_id=?", [$did, $uid]);
            if ($d) { q("DELETE FROM diplomas WHERE id=?", [$did]); audit('diploma_delete', 'diploma', $did, ['user'=>$uid]); flash('Диплом удалён.', 'success'); }
            else flash('Диплом не найден у этого пользователя.', 'warning');
            admin_redirect('users', $backP);
        }
        if ($do === 'del_order') {
            $oid = (int) input('oid');
            $o = one("SELECT id FROM awards_orders WHERE id=? AND user_id=?", [$oid, $uid]);
            if ($o) { q("DELETE FROM awards_orders WHERE id=?", [$oid]); audit('order_delete', 'awards_orders', $oid, ['user'=>$uid]); flash('Заказ наград удалён.', 'success'); }
            else flash('Заказ не найден у этого пользователя.', 'warning');
            admin_redirect('users', $backP);
        }
        if ($do === 'set_avatar') {
            $f = $_FILES['avatar'] ?? null;
            if ($f && ($f['error'] ?? 1) === UPLOAD_ERR_OK) {
                $ext = strtolower(pathinfo((string)$f['name'], PATHINFO_EXTENSION));
                if ($ext === 'jpeg') $ext = 'jpg';
                $mime = function_exists('mime_content_type') ? (string) mime_content_type($f['tmp_name']) : '';
                if (in_array($ext, ['jpg','png','webp'], true) && ($mime === '' || str_starts_with($mime, 'image/')) && (int)$f['size'] <= 8*1024*1024) {
                    $dir = BASE_PATH . '/public/uploads/avatars';
                    if (!is_dir($dir)) @mkdir($dir, 0775, true);
                    $fn = 'u' . $uid . '-' . substr(md5((string)$uid . $f['name'] . (string)$f['size']), 0, 8) . '.' . $ext;
                    if (@move_uploaded_file($f['tmp_name'], $dir . '/' . $fn)) {
                        @chmod($dir . '/' . $fn, 0644);
                        update('users', ['avatar' => 'uploads/avatars/' . $fn], 'id=:id', ['id'=>$uid]);
                        audit('user_avatar', 'user', $uid);
                        flash('Аватар обновлён.', 'success');
                    } else flash('Не удалось сохранить файл.', 'error');
                } else flash('Аватар должен быть изображением jpg/png/webp до 8 МБ.', 'error');
            } elseif (input('avatar_clear') === '1') {
                update('users', ['avatar' => ''], 'id=:id', ['id'=>$uid]);
                flash('Аватар удалён.', 'success');
            }
            admin_redirect('users', $backP);
        }
        if ($do === 'user_pass') {
            $pw = (string) ($_POST['new_password'] ?? '');
            if (mb_strlen($pw) < 6) { flash('Пароль минимум 6 символов.', 'error'); admin_redirect('users', $backP); }
            update('users', ['password_hash' => password_hash($pw, PASSWORD_DEFAULT)], 'id=:id', ['id'=>$uid]);
            audit('user_pass_reset', 'user', $uid);
            flash('Пароль пользователя изменён.', 'success');
            admin_redirect('users', $backP);
        }
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

/* ================= ПОЛНЫЙ ПРОФИЛЬ ПОЛЬЗОВАТЕЛЯ (для админа) ================= */
if (input('action') === 'profile') {
    $pu = one("SELECT * FROM users WHERE id=?", [(int) input('id')]);
    if (!$pu) { flash('Пользователь не найден.', 'error'); admin_redirect('users', ['tab'=>'users']); }
    $puid = (int) $pu['id'];
    if (is_file(BASE_PATH . '/core/club.php')) require_once BASE_PATH . '/core/club.php';
    $club = function_exists('club_status') ? club_status($puid) : ['active'=>false,'expires_at'=>null];
    $isVip = function_exists('is_vip_user') ? is_vip_user($puid, (string)$pu['role']) : !empty($club['active']);
    $pApps = all("SELECT a.*, c.name comp, c.slug cslug, c.results_mode rmode FROM applications a
                  LEFT JOIN competitions c ON c.id=a.competition_id WHERE a.user_id=? ORDER BY a.id DESC", [$puid]);
    $pDips = all("SELECT d.*, a.number anum, a.full_name, a.group_name FROM diplomas d
                  JOIN applications a ON a.id=d.application_id WHERE a.user_id=? ORDER BY d.id DESC", [$puid]);
    $pOrders = all("SELECT * FROM awards_orders WHERE user_id=? ORDER BY id DESC", [$puid]);
    $ini = mb_strtoupper(mb_substr(trim((string)($pu['full_name'] ?: $pu['email'] ?: '?')), 0, 1));
    $logins = [];
    if (!empty($pu['email'])) $logins[] = 'почта';
    if (!empty($pu['phone']) && (int)($pu['phone_verified']??0)===1) $logins[] = 'телефон';
    if (!empty($pu['vk_id'])) $logins[] = 'ВК';
    if (!empty($pu['max_id'])) $logins[] = 'МАКС';
    if (!empty($pu['google_id'])) $logins[] = 'Google';
    $stMap = ['new'=>'Новая','paid'=>'Оплачена','judging'=>'На оценке','graded'=>'Оценена','sent'=>'Отправлена','rejected'=>'Отклонена'];

    ob_start(); ?>
    <div class="admin-head" style="display:flex;align-items:center;gap:12px;flex-wrap:wrap">
      <a class="btn btn--ghost btn--sm" href="<?= a_link('users', ['tab'=>'users']) ?>"><?= admin_icon('back') ?>К списку</a>
      <h1 style="margin:0">Профиль участника</h1>
    </div>

    <div class="card up-head">
      <form method="post" action="<?= url('/admin/') ?>" enctype="multipart/form-data" class="up-ava-form">
        <?= csrf_field() ?><input type="hidden" name="do" value="set_avatar"><input type="hidden" name="uid" value="<?= $puid ?>">
        <label class="up-ava" title="Сменить аватар">
          <?php if (trim((string)$pu['avatar'])!==''): ?>
            <img src="<?= h(preg_match('~^https?://~',$pu['avatar'])?$pu['avatar']:url('/'.ltrim($pu['avatar'],'/'))) ?>" alt="">
          <?php else: ?><span class="up-ava-ini"><?= h($ini) ?></span><?php endif; ?>
          <input type="file" name="avatar" accept="image/*" onchange="this.form.submit()" hidden>
          <span class="up-ava-edit"><?= admin_icon('edit') ?></span>
        </label>
      </form>
      <div class="up-head-info">
        <div class="up-name"><?= h($pu['full_name'] ?: '(без имени)') ?><?php if ($isVip): ?> <?= vip_badge() ?><?php endif; ?></div>
        <div class="up-sub"><?= h($pu['email']) ?><?= $pu['phone'] ? ' · ' . h($pu['phone']) : '' ?></div>
        <div class="up-badges">
          <span class="badge badge--<?= role_badge_class((string)$pu['role']) ?>"><?= h($pu['role']) ?></span>
          <?php if (!empty($pu['category'])): ?><span class="tag"><?= $pu['category']==='teacher'?'Педагог':'Участник' ?></span><?php endif; ?>
          <?php if ((int)($pu['blocked']??0)===1): ?><span class="badge badge--rejected">Заблокирован</span><?php endif; ?>
          <?php if ($logins): ?><span class="tag">вход: <?= h(implode(', ', $logins)) ?></span><?php endif; ?>
          <span class="tag">ID <?= $puid ?></span>
        </div>
      </div>
    </div>

    <div class="up-cols">
      <!-- Редактирование профиля -->
      <div class="card">
        <h3 style="margin:0 0 12px"><?= admin_icon('edit') ?>Данные профиля</h3>
        <form method="post" action="<?= url('/admin/') ?>" class="up-form">
          <?= csrf_field() ?><input type="hidden" name="do" value="edit_user"><input type="hidden" name="uid" value="<?= $puid ?>"><input type="hidden" name="back_profile" value="1">
          <div class="field"><label>ФИО</label><input name="full_name" value="<?= h((string)$pu['full_name']) ?>"></div>
          <div class="field"><label>Email</label><input name="email" type="email" value="<?= h((string)$pu['email']) ?>" required></div>
          <div class="field"><label>Телефон</label><input name="phone" value="<?= h((string)$pu['phone']) ?>"></div>
          <div class="field"><label>Никнейм</label><input name="nickname" value="<?= h((string)($pu['nickname']??'')) ?>"></div>
          <div class="field"><label>Категория</label><select name="category"><option value="">—</option><option value="participant" <?= ($pu['category']??'')==='participant'?'selected':'' ?>>Участник</option><option value="teacher" <?= ($pu['category']??'')==='teacher'?'selected':'' ?>>Педагог</option></select></div>
          <?php if ($pu['role'] !== 'owner' && $puid !== (int)(current_user()['id']??0)): ?>
          <div class="field"><label>Роль</label><select name="role"><?php foreach (['user'=>'Участник','jury'=>'Жюри','moderator'=>'Модератор','admin'=>'Админ'] as $rv=>$rl): ?><option value="<?= $rv ?>" <?= $pu['role']===$rv?'selected':'' ?>><?= $rl ?></option><?php endforeach; ?></select></div>
          <?php else: ?><input type="hidden" name="role" value="<?= h((string)$pu['role']) ?>"><?php endif; ?>
          <button class="btn btn--primary btn--sm" type="submit"><?= admin_icon('check') ?>Сохранить</button>
        </form>
        <details style="margin-top:12px"><summary class="btn btn--ghost btn--sm">Сменить пароль</summary>
          <form method="post" action="<?= url('/admin/') ?>" style="margin-top:8px;display:flex;gap:8px;flex-wrap:wrap">
            <?= csrf_field() ?><input type="hidden" name="do" value="user_pass"><input type="hidden" name="uid" value="<?= $puid ?>">
            <input name="new_password" type="text" placeholder="Новый пароль (мин. 6)" style="flex:1;min-width:180px">
            <button class="btn btn--navy btn--sm" onclick="return confirm('Сменить пароль пользователю?')">Задать</button>
          </form>
        </details>
      </div>

      <!-- ВИП-клуб -->
      <div class="card">
        <h3 style="margin:0 0 12px"><?= admin_icon('trophy') ?>ВИП-клуб</h3>
        <?php if (!empty($club['active'])): ?>
          <p style="margin:0 0 10px">Статус: <b style="color:#1E7A44">активен</b><?= $club['expires_at'] ? ' до ' . h(date('d.m.Y', strtotime((string)$club['expires_at']))) : '' ?>. Скидка <?= (int)($club['discount']??0) ?>%.</p>
          <form method="post" action="<?= url('/admin/') ?>" style="display:inline">
            <?= csrf_field() ?><input type="hidden" name="do" value="cancel_vip"><input type="hidden" name="uid" value="<?= $puid ?>">
            <button class="btn btn--ghost btn--sm" style="color:#8b2f2f;border-color:#d99" onclick="return confirm('Отменить членство ВИП-клуба?')"><?= admin_icon('x') ?>Отменить подписку</button>
          </form>
        <?php elseif ($isVip): ?>
          <p style="margin:0 0 10px">ВИП по роли (владелец/оргкомитет) — бессрочно.</p>
        <?php else: ?>
          <p style="margin:0 0 10px" class="muted">Членство не активно.</p>
          <form method="post" action="<?= url('/admin/') ?>" style="display:flex;gap:8px;flex-wrap:wrap">
            <?= csrf_field() ?><input type="hidden" name="do" value="grant_vip"><input type="hidden" name="uid" value="<?= $puid ?>">
            <button class="btn btn--ghost btn--sm" name="months" value="1">Выдать на месяц</button>
            <button class="btn btn--primary btn--sm" name="months" value="12">Выдать на год</button>
          </form>
        <?php endif; ?>
      </div>
    </div>

    <!-- Заявки -->
    <div class="card">
      <h3 style="margin:0 0 12px"><?= admin_icon('applications') ?>Заявки (<?= count($pApps) ?>)</h3>
      <?php if (!$pApps): ?><p class="muted" style="margin:0">Заявок нет.</p><?php else: ?>
      <div class="table-wrap"><table class="tbl"><thead><tr><th>№</th><th>Конкурс</th><th>Участник/коллектив</th><th>Номер</th><th>Статус</th><th>Итог</th><th></th></tr></thead><tbody>
        <?php foreach ($pApps as $a): $isG = (int)($a['is_group']??0)===1; ?>
          <tr>
            <td class="small"><?= h((string)$a['number']) ?></td>
            <td class="small"><?= h((string)($a['comp']??'—')) ?></td>
            <td class="small"><?= h($isG ? (string)$a['group_name'] : (string)$a['full_name']) ?><?php if($isG): ?> <span class="tag">коллектив</span><?php endif; ?></td>
            <td class="small"><?= h((string)$a['work_title']) ?></td>
            <td><span class="badge badge--<?= h((string)$a['status']) ?>"><?= h($stMap[$a['status']] ?? $a['status']) ?></span></td>
            <td class="small"><?= h((string)$a['result']) ?: '—' ?></td>
            <td style="white-space:nowrap;text-align:right">
              <a class="btn btn--ghost btn--sm" href="<?= a_link(((string)($a['rmode']??''))==='list'?'longcomp':'grading', ['id'=>$a['id']]) ?>" title="Оценить/открыть в оценке"><?= admin_icon('grading') ?></a>
              <a class="btn btn--ghost btn--sm" href="<?= a_link('applications', ['id'=>$a['id']]) ?>" title="Редактировать заявку"><?= admin_icon('edit') ?></a>
            </td>
          </tr>
        <?php endforeach; ?>
      </tbody></table></div>
      <?php endif; ?>
    </div>

    <!-- Дипломы -->
    <div class="card">
      <h3 style="margin:0 0 12px"><?= admin_icon('diplomas') ?>Дипломы (<?= count($pDips) ?>)</h3>
      <?php if (!$pDips): ?><p class="muted" style="margin:0">Дипломов нет.</p><?php else: ?>
      <div class="table-wrap"><table class="tbl"><thead><tr><th>Номер</th><th>Тип</th><th>Итог</th><th>Отправлен</th><th></th></tr></thead><tbody>
        <?php $dtMap=['main'=>'Основной','extra'=>'Дополнительный','named'=>'Именной','thanks'=>'Благодарность']; foreach ($pDips as $d): ?>
          <tr>
            <td class="small"><?= h((string)$d['number']) ?></td>
            <td class="small"><?= h($dtMap[$d['type']] ?? $d['type']) ?></td>
            <td class="small"><?= h((string)$d['result']) ?: '—' ?></td>
            <td class="small"><?= $d['sent_at'] ? h(date('d.m.Y', strtotime((string)$d['sent_at']))) : '<span class="muted">в очереди</span>' ?></td>
            <td style="white-space:nowrap;text-align:right">
              <a class="btn btn--ghost btn--sm" href="<?= h(url('/verify/'.rawurlencode((string)$d['number']))) ?>" target="_blank" rel="noopener" title="Проверить/посмотреть"><?= admin_icon('eye') ?></a>
              <form method="post" action="<?= url('/admin/') ?>" style="display:inline">
                <?= csrf_field() ?><input type="hidden" name="do" value="del_diploma"><input type="hidden" name="uid" value="<?= $puid ?>"><input type="hidden" name="did" value="<?= $d['id'] ?>">
                <button class="btn btn--ghost btn--sm" style="color:#8b2f2f" onclick="return confirm('Удалить этот диплом?')" title="Удалить"><?= admin_icon('trash') ?></button>
              </form>
            </td>
          </tr>
        <?php endforeach; ?>
      </tbody></table></div>
      <?php endif; ?>
    </div>

    <!-- Заказы наград -->
    <div class="card">
      <h3 style="margin:0 0 12px"><?= admin_icon('trophy') ?>Заказы наград (<?= count($pOrders) ?>)</h3>
      <?php if (!$pOrders): ?><p class="muted" style="margin:0">Заказов нет.</p><?php else: ?>
      <div class="table-wrap"><table class="tbl"><thead><tr><th>№</th><th>Конкурс</th><th>Состав</th><th>Сумма</th><th>Статус</th><th>Трек</th><th></th></tr></thead><tbody>
        <?php foreach ($pOrders as $o): $items = json_decode((string)$o['items'], true) ?: []; $itemsTxt = implode(', ', array_map(fn($it)=> (string)($it['item']??''), is_array($items)?$items:[])); ?>
          <tr>
            <td class="small">#<?= (int)$o['id'] ?></td>
            <td class="small"><?= h((string)$o['competition']) ?></td>
            <td class="small"><?= h(mb_substr($itemsTxt,0,60)) ?></td>
            <td class="small"><?= money((int)$o['amount']) ?></td>
            <td><span class="badge"><?= h((string)$o['status']) ?></span></td>
            <td class="small"><?= h((string)($o['tracking']??'')) ?: '—' ?></td>
            <td style="white-space:nowrap;text-align:right">
              <a class="btn btn--ghost btn--sm" href="<?= a_link('orders') ?>" title="Открыть в заказах"><?= admin_icon('eye') ?></a>
              <form method="post" action="<?= url('/admin/') ?>" style="display:inline">
                <?= csrf_field() ?><input type="hidden" name="do" value="del_order"><input type="hidden" name="uid" value="<?= $puid ?>"><input type="hidden" name="oid" value="<?= $o['id'] ?>">
                <button class="btn btn--ghost btn--sm" style="color:#8b2f2f" onclick="return confirm('Удалить этот заказ?')" title="Удалить"><?= admin_icon('trash') ?></button>
              </form>
            </td>
          </tr>
        <?php endforeach; ?>
      </tbody></table></div>
      <?php endif; ?>
    </div>

    <style>
      .up-head{display:flex;gap:18px;align-items:center;flex-wrap:wrap}
      .up-ava{position:relative;display:block;width:76px;height:76px;border-radius:50%;overflow:hidden;cursor:pointer;background:var(--grad-gold,#e8c25a);color:#1a1400}
      .up-ava img{width:100%;height:100%;object-fit:cover}
      .up-ava-ini{display:flex;width:100%;height:100%;align-items:center;justify-content:center;font-family:var(--ff-head,Georgia);font-size:30px}
      .up-ava-edit{position:absolute;right:0;bottom:0;width:26px;height:26px;background:#17307A;color:#fff;border-radius:50%;display:flex;align-items:center;justify-content:center}
      .up-ava-edit svg{width:14px;height:14px}
      .up-name{font-size:1.3rem;font-weight:700}
      .up-sub{color:var(--muted,#667);font-size:.9rem;margin:2px 0 8px}
      .up-badges{display:flex;gap:6px;flex-wrap:wrap;align-items:center}
      .up-cols{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin:16px 0}
      .up-form .field{margin-bottom:10px}
      @media(max-width:720px){.up-cols{grid-template-columns:1fr}}
    </style>
    <?php
    $content = ob_get_clean();
    admin_layout('Профиль: ' . ($pu['full_name'] ?: $pu['email']), $content, 'users');
    return;
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
  if ($qs) {
      [$sq, $sa] = search_like(['email','full_name','phone'], (string) $qs);   // кириллица в любом регистре
      if ($sq !== '') { $w[] = "($sq)"; $ua = array_merge($ua, $sa); }
  }
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
              <span><b><a href="<?= a_link('users', ['action'=>'profile','id'=>$u['id']]) ?>" style="color:inherit;text-decoration:none;border-bottom:1px dashed rgba(0,0,0,.25)"><?= h($u['full_name'] ?: '—') ?></a><?php if($u['id']==$meId): ?> <span class="u-me">вы</span><?php endif; ?><?php if($isBlocked): ?> <span class="badge badge--muted">заблокирован</span><?php endif; ?></b><span class="small muted"><?= h($u['email']) ?></span></span>
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
            <div style="display:flex;gap:6px;flex-wrap:wrap">
              <a class="btn btn--navy btn--sm" href="<?= a_link('users', ['action'=>'profile','id'=>$u['id']]) ?>"><?= admin_icon('eye') ?>Профиль</a>
              <?php if ($u['role'] !== 'owner' && $u['id'] != $meId): ?>
              <form method="post" action="<?= url('/admin/') ?>">
                <?= csrf_field() ?><input type="hidden" name="do" value="<?= $isBlocked ? 'unblock_user' : 'block_user' ?>"><input type="hidden" name="uid" value="<?= $u['id'] ?>">
                <button class="btn btn--ghost btn--sm" type="submit"><?= $isBlocked ? 'Разблокировать' : 'Блокировать' ?></button>
              </form>
              <form method="post" action="<?= url('/admin/') ?>" onsubmit="return confirm('Удалить пользователя <?= h(addslashes($u['email'] ?: (string)$u['id'])) ?> без возможности восстановления?')">
                <?= csrf_field() ?><input type="hidden" name="do" value="delete_user"><input type="hidden" name="uid" value="<?= $u['id'] ?>">
                <button class="btn btn--sm" type="submit" style="background:#8b2f2f;color:#fff">Удалить</button>
              </form>
              <?php endif; ?>
            </div>
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
  $seg = input('seg'); $src = input('seg_source'); $sq = trim(input('q'));
  $w = []; $sa = [];
  if ($seg) { $w[] = "tags LIKE ?"; $sa[] = "%$seg%"; }
  if ($src) { $w[] = "source=?"; $sa[] = $src; }
  if ($sq !== '') {
      [$_sq, $_sa] = search_like(['email','name'], $sq);
      if ($_sq !== '') { $w[] = "($_sq)"; $sa = array_merge($sa, $_sa); }
  }
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
    <div class="field"><label>Поиск</label><input name="q" value="<?= h($sq) ?>" placeholder="email или имя"></div>
    <div class="field"><label>Сегмент (тег)</label><select name="seg"><option value="">Все</option>
      <?php foreach (array_keys($allTags) as $t): ?><option value="<?= h($t) ?>" <?= $seg===$t?'selected':'' ?>><?= h($t) ?></option><?php endforeach; ?></select></div>
    <div class="field"><label>Источник</label><select name="seg_source"><option value="">Все</option>
      <?php foreach ($sources as $s): ?><option value="<?= h($s['source']) ?>" <?= $src===$s['source']?'selected':'' ?>><?= h($s['source']) ?></option><?php endforeach; ?></select></div>
    <button class="btn btn--primary btn--sm"><?= admin_icon('search') ?>Поиск</button>
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
