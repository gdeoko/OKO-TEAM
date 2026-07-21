<?php
/** Личный кабинет участника. Разделы: заявки, дипломы, награды, уведомления, профиль. */
require_login();
$user = current_user();
$uid = (int)$user['id'];
$isTeacher = in_array($user['role'], ['teacher','jury','moderator','admin','owner'], true);

// --- Обработка POST (настройки уведомлений, профиль, пароль, пересылка диплома) ---
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $action = input('action');
    if (!csrf_check()) {
        flash('Сессия устарела. Обновите страницу и попробуйте снова.', 'error');
    } elseif ($action === 'notify') {
        update('users', [
            'notify_email' => isset($_POST['notify_email']) ? 1 : 0,
            'notify_tg'    => isset($_POST['notify_tg']) ? 1 : 0,
        ], 'id=:id', ['id' => $uid]);
        flash('Настройки уведомлений сохранены.', 'success');
        redirect('/cabinet');
    } elseif ($action === 'profile') {
        $fio = input('full_name');
        $phone = input('phone');
        if (function_exists('v_fio') && $fio !== '') $fio = v_fio($fio);
        update('users', ['full_name' => $fio, 'phone' => $phone], 'id=:id', ['id' => $uid]);
        audit('profile_update', 'user', $uid);
        flash('Профиль обновлён.', 'success');
        redirect('/cabinet');
    } elseif ($action === 'password') {
        $cur = (string)($_POST['current_password'] ?? '');
        $new = (string)($_POST['new_password'] ?? '');
        $fresh = one("SELECT password_hash FROM users WHERE id=?", [$uid]);
        if (!$fresh['password_hash'] || !password_verify($cur, $fresh['password_hash'])) {
            flash('Текущий пароль указан неверно.', 'error');
        } elseif (mb_strlen($new) < 6) {
            flash('Новый пароль должен быть не короче 6 символов.', 'error');
        } else {
            update('users', ['password_hash' => password_hash($new, PASSWORD_DEFAULT)], 'id=:id', ['id' => $uid]);
            audit('password_change', 'user', $uid);
            flash('Пароль изменён.', 'success');
        }
        redirect('/cabinet');
    } elseif ($action === 'resend_diploma') {
        $dn = input('number');
        $d = one("SELECT d.* FROM diplomas d JOIN applications a ON a.id=d.application_id WHERE d.number=? AND a.user_id=?", [$dn, $uid]);
        if ($d && function_exists('mail_queue')) {
            $html = '<p>Здравствуйте, ' . h($user['full_name'] ?: 'участник') . '.</p><p>Ваш диплом № ' . h($dn) . ' во вложении.</p>';
            mail_queue($user['email'], $user['full_name'], 'Ваш диплом - КЦ «Музыкальный Мир»', $html, (string)($d['pdf_path'] ?? ''));
            flash('Диплом отправлен на Вашу почту.', 'success');
        } elseif ($d) {
            flash('Диплом готов к скачиванию в разделе «Дипломы».', 'info');
        } else {
            flash('Диплом не найден.', 'error');
        }
        redirect('/cabinet');
    }
}

// --- Данные ---
$apps = all("SELECT a.*, c.name AS comp_name, c.slug AS comp_slug
             FROM applications a LEFT JOIN competitions c ON c.id=a.competition_id
             WHERE a.user_id=? ORDER BY a.created_at DESC", [$uid]);
$diplomas = all("SELECT d.*, a.full_name, a.result AS app_result, c.name AS comp_name
                 FROM diplomas d
                 JOIN applications a ON a.id=d.application_id
                 LEFT JOIN competitions c ON c.id=a.competition_id
                 WHERE a.user_id=? ORDER BY d.created_at DESC", [$uid]);
$orders = all("SELECT * FROM awards_orders WHERE user_id=? ORDER BY created_at DESC", [$uid]);
$students = [];
if ($isTeacher && ($user['full_name'] ?? '') !== '') {
    $students = all("SELECT a.*, c.name AS comp_name FROM applications a
                     LEFT JOIN competitions c ON c.id=a.competition_id
                     WHERE a.teacher=? ORDER BY a.created_at DESC", [$user['full_name']]);
}

$appStatus = ['new'=>['Новая','info'],'paid'=>['Оплачена','info'],'judging'=>['На оценке','warning'],
              'graded'=>['Оценена','success'],'sent'=>['Диплом отправлен','success'],'rejected'=>['Отклонена','error']];
$orderStatus = ['new'=>['Оформлен','info'],'paid'=>['Оплачен','info'],'shipped'=>['Отправлен','warning'],'delivered'=>['Доставлен','success']];

$icon = fn(string $p) => '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.6" style="flex:none">' . $p . '</svg>';
$icons = [
  'apps'    => $icon('<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M9 15l2 2 4-4"/>'),
  'diploma' => $icon('<circle cx="12" cy="8" r="6"/><path d="M8.2 13.9 7 22l5-3 5 3-1.2-8.1"/>'),
  'awards'  => $icon('<path d="M3 3h18v4H3zM4 7l1 13h14l1-13"/><path d="M9 12h6"/>'),
  'notify'  => $icon('<path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/>'),
  'profile' => $icon('<circle cx="12" cy="8" r="4"/><path d="M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1"/>'),
  'students'=> $icon('<circle cx="9" cy="8" r="4"/><path d="M2 21v-1a6 6 0 0 1 6-6h2M16 11l2 2 4-4"/>'),
];
$badge = fn(string $label, string $type) => '<span class="badge badge--' . ($type==='success'?'open':($type==='error'?'closed':'intl')) . '">' . h($label) . '</span>';

$sections = [
  ['apps','Мои заявки'],
  ['diplomas','Дипломы'],
  ['awards','Заказы наград'],
  ['notify','Уведомления'],
  ['profile','Профиль'],
];
if ($isTeacher) $sections[] = ['students','Мои ученики'];

ob_start(); ?>
<style>
.cab{display:grid;grid-template-columns:260px 1fr;gap:32px;align-items:start}
.cab-side{position:sticky;top:96px;background:#fff;border:1px solid var(--line);border-radius:var(--radius);padding:20px;box-shadow:var(--shadow-card)}
.cab-user{display:flex;gap:12px;align-items:center;padding-bottom:16px;margin-bottom:12px;border-bottom:1px solid var(--line)}
.cab-ava{width:46px;height:46px;border-radius:50%;background:var(--grad-gold);color:#fff;display:flex;align-items:center;justify-content:center;font-family:var(--ff-head);font-size:1.2rem;flex:none}
.cab-nav{display:flex;flex-direction:column;gap:4px}
.cab-nav a{display:flex;align-items:center;gap:12px;padding:11px 14px;border-radius:var(--radius-sm);color:var(--navy);font-weight:600;font-size:.95rem}
.cab-nav a:hover{background:var(--gold-light)}
.cab-nav a.active{background:var(--grad-gold);color:#fff}
.cab-nav a.active svg{stroke:#fff}
.cab-panel{display:none}
.cab-panel.active{display:block}
.cab-card{background:#fff;border:1px solid var(--line);border-radius:var(--radius);padding:20px 22px;box-shadow:var(--shadow-card);margin-bottom:16px}
.cab-row{display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap;align-items:flex-start}
.cab-meta{color:var(--muted);font-size:.9rem;margin:6px 0 0}
.cab-empty{text-align:center;color:var(--muted);padding:40px 20px}
.cab-logout{display:block;text-align:center;margin-top:14px;color:var(--muted);font-size:.9rem}
@media(max-width:860px){.cab{grid-template-columns:1fr}.cab-side{position:static}
  .cab-nav{flex-direction:row;overflow-x:auto;gap:6px}.cab-nav a{white-space:nowrap;padding:9px 12px}}
</style>
<section class="section">
  <div class="container">
    <div class="cab">
      <aside class="cab-side reveal">
        <div class="cab-user">
          <div class="cab-ava"><?= h(mb_strtoupper(mb_substr($user['full_name'] ?: $user['email'], 0, 1))) ?></div>
          <div style="min-width:0">
            <strong style="display:block;font-family:var(--ff-head)"><?= h($user['full_name'] ?: 'Участник') ?></strong>
            <span style="color:var(--muted);font-size:.82rem;word-break:break-all"><?= h($user['email']) ?></span>
          </div>
        </div>
        <nav class="cab-nav" id="cabNav">
          <?php foreach ($sections as $i => [$id,$label]): ?>
            <a href="#<?= $id ?>" data-tab="<?= $id ?>" class="<?= $i===0?'active':'' ?>"><?= $icons[$id] ?> <?= h($label) ?></a>
          <?php endforeach; ?>
        </nav>
        <a class="cab-logout" href="<?= url('/logout') ?>">Выйти из аккаунта</a>
      </aside>

      <div class="cab-main">
        <!-- Заявки -->
        <div class="cab-panel active" id="tab-apps">
          <h2>Мои заявки</h2>
          <?php if (!$apps): ?>
            <div class="cab-card cab-empty">
              <p>У Вас пока нет заявок.</p>
              <a class="btn btn--primary" href="<?= url('/apply') ?>">Подать заявку</a>
            </div>
          <?php else: foreach ($apps as $a):
            [$sl,$st] = $appStatus[$a['status']] ?? [$a['status'],'info']; ?>
            <div class="cab-card">
              <div class="cab-row">
                <div>
                  <strong style="font-family:var(--ff-head);font-size:1.1rem"><?= h($a['comp_name'] ?: 'Конкурс') ?></strong>
                  <p class="cab-meta">
                    <?php if ($a['number']): ?>Заявка № <?= h($a['number']) ?> · <?php endif; ?>
                    <?= h($a['nomination'] ?: 'Номинация не указана') ?>
                    <?php if ($a['work_title']): ?> · «<?= h($a['work_title']) ?>»<?php endif; ?>
                  </p>
                  <p class="cab-meta">Подана <?= h(ru_date(substr((string)$a['created_at'],0,10))) ?></p>
                </div>
                <div style="text-align:right">
                  <?= $badge($sl,$st) ?>
                  <?php if (!empty($a['result'])): ?><p class="cab-meta" style="color:var(--gold-dark);font-weight:700"><?= h($a['result']) ?></p><?php endif; ?>
                </div>
              </div>
            </div>
          <?php endforeach; endif; ?>
        </div>

        <!-- Дипломы -->
        <div class="cab-panel" id="tab-diplomas">
          <h2>Мои результаты и дипломы</h2>
          <?php if (!$diplomas): ?>
            <div class="cab-card cab-empty"><p>Дипломы появятся здесь после оценки Ваших работ жюри.</p></div>
          <?php else: foreach ($diplomas as $d): ?>
            <div class="cab-card">
              <div class="cab-row">
                <div>
                  <strong style="font-family:var(--ff-head);font-size:1.1rem"><?= h($d['result'] ?: $d['app_result'] ?: 'Диплом') ?></strong>
                  <p class="cab-meta"><?= h($d['comp_name'] ?: 'Конкурс') ?> · <?= h($d['full_name']) ?></p>
                  <p class="cab-meta">Диплом № <?= h($d['number']) ?> · <?= h(ru_date(substr((string)$d['created_at'],0,10))) ?></p>
                </div>
                <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center">
                  <?php if (!empty($d['pdf_path'])): ?>
                    <a class="btn btn--ghost" href="<?= h(str_starts_with((string)$d['pdf_path'],'http') ? $d['pdf_path'] : url($d['pdf_path'])) ?>" target="_blank" rel="noopener">Скачать</a>
                  <?php endif; ?>
                  <form method="post" action="<?= url('/cabinet') ?>" style="margin:0">
                    <?= csrf_field() ?>
                    <input type="hidden" name="action" value="resend_diploma">
                    <input type="hidden" name="number" value="<?= h($d['number']) ?>">
                    <button class="btn btn--ghost" type="submit">Отправить на почту</button>
                  </form>
                  <a class="btn btn--ghost" href="<?= url('/verify/'.$d['number']) ?>" target="_blank" rel="noopener">Проверка</a>
                </div>
              </div>
            </div>
          <?php endforeach; endif; ?>
        </div>

        <!-- Заказы наград -->
        <div class="cab-panel" id="tab-awards">
          <h2>Мои заказы наград</h2>
          <?php if (!$orders): ?>
            <div class="cab-card cab-empty">
              <p>У Вас пока нет заказов наградной продукции.</p>
              <a class="btn btn--primary" href="<?= url('/order-awards') ?>">Заказать награды</a>
            </div>
          <?php else: foreach ($orders as $o):
            [$sl,$st] = $orderStatus[$o['status']] ?? [$o['status'],'info']; ?>
            <div class="cab-card">
              <div class="cab-row">
                <div>
                  <strong style="font-family:var(--ff-head);font-size:1.1rem"><?= h($o['items'] ?: 'Наградная продукция') ?></strong>
                  <p class="cab-meta"><?= h($o['competition'] ?: '') ?><?php if ($o['result']): ?> · <?= h($o['result']) ?><?php endif; ?></p>
                  <p class="cab-meta">Заказ от <?= h(ru_date(substr((string)$o['created_at'],0,10))) ?><?php if ($o['amount']): ?> · <?= h(money((int)$o['amount'])) ?><?php endif; ?></p>
                  <?php if (!empty($o['tracking'])): ?><p class="cab-meta">Трек-номер: <strong><?= h($o['tracking']) ?></strong></p><?php endif; ?>
                </div>
                <div style="text-align:right"><?= $badge($sl,$st) ?></div>
              </div>
            </div>
          <?php endforeach; endif; ?>
        </div>

        <!-- Уведомления -->
        <div class="cab-panel" id="tab-notify">
          <h2>Настройки уведомлений</h2>
          <div class="cab-card">
            <form method="post" action="<?= url('/cabinet') ?>">
              <?= csrf_field() ?>
              <input type="hidden" name="action" value="notify">
              <label style="display:flex;gap:12px;align-items:center;margin-bottom:16px;font-weight:600">
                <input type="checkbox" name="notify_email" value="1" style="width:auto" <?= (int)$user['notify_email'] ? 'checked' : '' ?>>
                Уведомления на электронную почту
              </label>
              <label style="display:flex;gap:12px;align-items:center;margin-bottom:20px;font-weight:600">
                <input type="checkbox" name="notify_tg" value="1" style="width:auto" <?= (int)$user['notify_tg'] ? 'checked' : '' ?>>
                Уведомления в Telegram
              </label>
              <p class="cab-meta" style="margin-bottom:16px">Сообщаем о статусе заявок, результатах оценки и готовности наградных документов.</p>
              <button class="btn btn--primary" type="submit">Сохранить</button>
            </form>
          </div>
        </div>

        <!-- Профиль -->
        <div class="cab-panel" id="tab-profile">
          <h2>Профиль</h2>
          <div class="cab-card">
            <h3 style="margin-top:0">Личные данные</h3>
            <form method="post" action="<?= url('/cabinet') ?>">
              <?= csrf_field() ?>
              <input type="hidden" name="action" value="profile">
              <div class="field">
                <label for="p_fio">Фамилия и имя</label>
                <input type="text" id="p_fio" name="full_name" value="<?= h($user['full_name']) ?>" placeholder="Иванова Мария">
              </div>
              <div class="field">
                <label for="p_phone">Телефон</label>
                <input type="tel" id="p_phone" name="phone" value="<?= h($user['phone']) ?>" placeholder="+7 (___) ___-__-__">
              </div>
              <div class="field">
                <label>Электронная почта</label>
                <input type="email" value="<?= h($user['email']) ?>" disabled>
                <div class="hint">Почта используется для входа и наградных документов.</div>
              </div>
              <button class="btn btn--primary" type="submit">Сохранить</button>
            </form>
          </div>
          <div class="cab-card">
            <h3 style="margin-top:0">Смена пароля</h3>
            <form method="post" action="<?= url('/cabinet') ?>">
              <?= csrf_field() ?>
              <input type="hidden" name="action" value="password">
              <div class="field">
                <label for="cur_pw">Текущий пароль</label>
                <input type="password" id="cur_pw" name="current_password" autocomplete="current-password" required>
              </div>
              <div class="field">
                <label for="new_pw">Новый пароль</label>
                <input type="password" id="new_pw" name="new_password" autocomplete="new-password" minlength="6" required>
              </div>
              <button class="btn btn--primary" type="submit">Изменить пароль</button>
            </form>
          </div>
        </div>

        <?php if ($isTeacher): ?>
        <!-- Мои ученики -->
        <div class="cab-panel" id="tab-students">
          <h2>Мои ученики</h2>
          <?php if (!$students): ?>
            <div class="cab-card cab-empty"><p>Заявки, где Вы указаны педагогом, появятся здесь.</p></div>
          <?php else: foreach ($students as $s):
            [$sl,$st] = $appStatus[$s['status']] ?? [$s['status'],'info']; ?>
            <div class="cab-card">
              <div class="cab-row">
                <div>
                  <strong style="font-family:var(--ff-head);font-size:1.05rem"><?= h($s['full_name']) ?></strong>
                  <p class="cab-meta"><?= h($s['comp_name'] ?: 'Конкурс') ?> · <?= h($s['nomination'] ?: '') ?></p>
                </div>
                <div style="text-align:right">
                  <?= $badge($sl,$st) ?>
                  <?php if (!empty($s['result'])): ?><p class="cab-meta" style="color:var(--gold-dark);font-weight:700"><?= h($s['result']) ?></p><?php endif; ?>
                </div>
              </div>
            </div>
          <?php endforeach; endif; ?>
        </div>
        <?php endif; ?>
      </div>
    </div>
  </div>
</section>
<script>
(function(){
  var nav=document.getElementById('cabNav');
  if(!nav)return;
  var links=nav.querySelectorAll('a[data-tab]');
  function show(id){
    document.querySelectorAll('.cab-panel').forEach(function(p){p.classList.toggle('active',p.id==='tab-'+id);});
    links.forEach(function(a){a.classList.toggle('active',a.getAttribute('data-tab')===id);});
  }
  links.forEach(function(a){a.addEventListener('click',function(e){e.preventDefault();var id=a.getAttribute('data-tab');show(id);history.replaceState(null,'','#'+id);});});
  var h=(location.hash||'').replace('#','');
  if(h&&document.getElementById('tab-'+h))show(h);
})();
</script>
<?php
$content = ob_get_clean();
render_page('Личный кабинет', $content, ['active' => '/cabinet', 'meta' => 'Личный кабинет участника КЦ «Музыкальный Мир»: заявки, дипломы, награды, настройки.']);
