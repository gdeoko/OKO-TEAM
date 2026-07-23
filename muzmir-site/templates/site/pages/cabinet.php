<?php
/** Личный кабинет участника. Разделы: заявки, дипломы, награды, настройки, реферальная программа. */
require_login();
$user = current_user();
$uid = (int)$user['id'];
$isTeacher = in_array($user['role'], ['teacher','jury','moderator','admin','owner'], true);

// --- Обработка POST (настройки уведомлений, профиль, пароль, пересылка диплома, реф-код) ---
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
        $avatar = trim(input('avatar'));
        if (function_exists('v_fio') && $fio !== '') $fio = v_fio($fio);
        $upd = ['full_name' => $fio, 'phone' => $phone];
        // Фото профиля: принимаем только http(s)-ссылку (подтягивается из соц-входа ВК/MAX либо задаётся вручную).
        if ($avatar === '' || preg_match('~^https?://~i', $avatar)) $upd['avatar'] = $avatar;
        update('users', $upd, 'id=:id', ['id' => $uid]);
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
    } elseif ($action === 'referral_create' && $isTeacher && user_can('teacher')) {
        if (is_file(BASE_PATH . '/core/loyalty.php')) require_once BASE_PATH . '/core/loyalty.php';
        if (function_exists('referral_create')) {
            $ref = referral_create($uid, trim(input('code')), (int)input('percent', '5'), (int)input('reward_percent', '10'));
            audit('referral_create', 'referrals', (int)($ref['id'] ?? 0), ['code' => $ref['code'] ?? '']);
            flash('Промокод «' . ($ref['code'] ?? '') . '» создан.', 'success');
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
$refCodes = []; $refUses = 0; $refReward = 0;
if ($isTeacher && ($user['full_name'] ?? '') !== '') {
    $students = all("SELECT a.*, c.name AS comp_name FROM applications a
                     LEFT JOIN competitions c ON c.id=a.competition_id
                     WHERE a.teacher=? ORDER BY a.created_at DESC", [$user['full_name']]);
}
if ($isTeacher) {
    if (is_file(BASE_PATH . '/core/loyalty.php')) require_once BASE_PATH . '/core/loyalty.php';
    if (function_exists('referral_stats')) {
        $refCodes = referral_stats($uid);
        foreach ($refCodes as $c) { $refUses += (int)$c['uses']; $refReward += (int)$c['reward_total']; }
    }
}

$appStatus = ['new'=>['Новая','info'],'paid'=>['Оплачена','info'],'judging'=>['На оценке','warning'],
              'graded'=>['Оценена','success'],'sent'=>['Диплом отправлен','success'],'rejected'=>['Отклонена','error']];
$orderStatus = ['new'=>['Оформлен','info'],'paid'=>['Оплачен','info'],'shipped'=>['Отправлен','warning'],'delivered'=>['Доставлен','success']];
// Конвейер статуса заявки для инфографики-прогресса.
$pipeline = ['new','paid','judging','graded','sent'];
$pipeLabels = ['Подана','Оплата','Оценка','Оценена','Диплом'];
$roleLabels = ['user'=>'Участник','teacher'=>'Педагог','jury'=>'Член жюри','designer'=>'Дизайнер',
               'accountant'=>'Бухгалтер','moderator'=>'Модератор','admin'=>'Администратор','owner'=>'Владелец'];

$icon = fn(string $p) => '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.6" style="flex:none">' . $p . '</svg>';
$icons = [
  'apps'    => $icon('<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M9 15l2 2 4-4"/>'),
  'diploma' => $icon('<circle cx="12" cy="8" r="6"/><path d="M8.2 13.9 7 22l5-3 5 3-1.2-8.1"/>'),
  'awards'  => $icon('<path d="M3 3h18v4H3zM4 7l1 13h14l1-13"/><path d="M9 12h6"/>'),
  'settings'=> $icon('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>'),
  'students'=> $icon('<circle cx="9" cy="8" r="4"/><path d="M2 21v-1a6 6 0 0 1 6-6h2M16 11l2 2 4-4"/>'),
  'ref'     => $icon('<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/>'),
  'qr'      => $icon('<path d="M3 3h6v6H3zM15 3h6v6h-6zM3 15h6v6H3z"/><path d="M15 15h2v2h-2zM19 15h2M15 19h2v2M19 19h2v2"/>'),
  'dl'      => $icon('<path d="M12 3v12M7 11l5 4 5-4M4 21h16"/>'),
  'mail'    => $icon('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>'),
];
$badgeMap = ['success'=>'open','error'=>'closed','warning'=>'judging','info'=>'intl'];
$badge = fn(string $label, string $type) => '<span class="badge badge--' . ($badgeMap[$type] ?? 'intl') . '">' . h($label) . '</span>';

// Инициалы для монограммы (если нет фото).
$initials = '';
$nameSrc = trim((string)($user['full_name'] ?? ''));
if ($nameSrc !== '') {
    foreach (preg_split('~\s+~u', $nameSrc) as $w) { if ($w !== '') $initials .= mb_substr($w, 0, 1); if (mb_strlen($initials) >= 2) break; }
} else {
    $initials = mb_substr((string)$user['email'], 0, 1);
}
$initials = mb_strtoupper($initials);
$avatar = trim((string)($user['avatar'] ?? ''));

$sections = [
  ['apps','Мои заявки'],
  ['diplomas','Мои дипломы'],
  ['awards','Награды и заказы'],
  ['settings','Настройки'],
];
if ($isTeacher) { $sections[] = ['students','Мои ученики']; $sections[] = ['ref','Реферальная программа']; }

ob_start(); ?>
<style>
.cab{max-width:960px;margin:0 auto}
/* --- Шапка профиля --- */
.cab-hero{position:relative;overflow:hidden;border-radius:var(--radius-lg);padding:30px 30px 26px;margin-bottom:24px;
  background:
    radial-gradient(680px 320px at 100% -30%,var(--gold-soft),transparent 62%),
    radial-gradient(520px 300px at -10% 130%,var(--gold-soft),transparent 60%),
    var(--panel);
  border:1px solid var(--glass-brd);box-shadow:var(--shadow-3d);backdrop-filter:blur(18px)}
.cab-hero::before{content:"";position:absolute;inset:0;z-index:0;pointer-events:none;opacity:.5;
  background:repeating-linear-gradient(180deg,transparent 0 13px,var(--line) 13px 14px);
  -webkit-mask:radial-gradient(120% 90% at 88% -10%,#000,transparent 62%);
  mask:radial-gradient(120% 90% at 88% -10%,#000,transparent 62%)}
.cab-hero::after{content:"";position:absolute;left:0;right:0;top:0;height:3px;z-index:2;background:var(--grad-gold);opacity:.9}
.cab-hero-note{position:absolute;top:-14px;right:-6px;width:150px;height:150px;z-index:0;color:var(--gold);opacity:.09;pointer-events:none}
.cab-hero-top{position:relative;z-index:1;display:flex;gap:20px;align-items:center;flex-wrap:wrap}
.cab-ava{width:88px;height:88px;border-radius:26px;flex:none;position:relative;overflow:hidden;
  background:var(--grad-gold);color:var(--gold-fg);display:flex;align-items:center;justify-content:center;
  font-family:var(--ff-display);font-weight:800;font-size:2.2rem;
  box-shadow:0 12px 30px -8px rgba(139,111,31,.5),inset 0 0 24px rgba(26,18,6,.16),0 0 0 1px var(--glass-brd)}
.cab-ava::after{content:"";position:absolute;inset:0;border-radius:inherit;pointer-events:none;
  box-shadow:inset 0 1px 0 rgba(255,255,255,.4);background:linear-gradient(160deg,rgba(255,255,255,.28),transparent 45%)}
.cab-ava img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
.cab-id{min-width:0;flex:1}
.cab-id h1{font-family:var(--ff-display);font-size:clamp(1.55rem,4.5vw,2.2rem);line-height:1.08;margin:0 0 9px;overflow-wrap:anywhere}
.cab-role{display:inline-flex;align-items:center;gap:6px;font-size:.72rem;font-weight:800;letter-spacing:.07em;text-transform:uppercase;
  padding:5px 13px;border-radius:999px;background:var(--gold-soft);color:var(--gold-2);border:1px solid var(--glass-brd);
  box-shadow:inset 0 0 12px var(--gold-soft)}
.cab-role::before{content:"";width:6px;height:6px;border-radius:50%;background:var(--grad-gold);box-shadow:0 0 8px var(--gold)}
.cab-email{display:block;color:var(--muted);font-size:.88rem;margin-top:10px;overflow-wrap:anywhere}
.cab-stats{position:relative;z-index:1;display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-top:24px}
.cab-stat{position:relative;overflow:hidden;text-align:center;padding:17px 8px 15px;border-radius:var(--radius-sm);
  background:linear-gradient(180deg,var(--glass),transparent);border:1px solid var(--glass-brd);
  box-shadow:var(--shadow-soft);transition:transform .25s cubic-bezier(.2,.8,.2,1),box-shadow .25s}
.cab-stat::before{content:"";position:absolute;left:22%;right:22%;top:0;height:2px;border-radius:2px;background:var(--grad-gold);opacity:.7}
.cab-stat:hover{transform:translateY(-4px);box-shadow:var(--shadow-card),var(--shadow-glow)}
.cab-stat b{display:block;font-family:var(--ff-display);font-size:clamp(1.8rem,5vw,2.5rem);line-height:1;
  background:var(--grad-gold);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent}
.cab-stat span{display:block;color:var(--muted);font-size:.76rem;letter-spacing:.04em;margin-top:6px}
/* --- Вкладки (горизонтальный скролл на мобилке) --- */
.cab-tabs{display:flex;gap:8px;margin-bottom:22px;overflow-x:auto;scrollbar-width:none;-webkit-overflow-scrolling:touch;
  padding:5px;scroll-snap-type:x proximity;background:var(--panel);border:1px solid var(--glass-brd);border-radius:999px;backdrop-filter:blur(10px)}
.cab-tabs::-webkit-scrollbar{display:none}
.cab-tab{display:inline-flex;align-items:center;gap:8px;white-space:nowrap;flex:none;scroll-snap-align:start;
  padding:11px 18px;border-radius:999px;color:var(--text-dim);font-weight:700;font-size:.9rem;cursor:pointer;
  background:none;border:none;transition:color .2s,background .2s,box-shadow .2s;min-height:44px}
.cab-tab:hover{color:var(--text)}
.cab-tab.active{background:var(--grad-gold);color:var(--gold-fg);box-shadow:var(--shadow-btn)}
.cab-tab.active svg{stroke:var(--gold-fg)}
.cab-tab svg{width:18px;height:18px}
/* --- Панели / карточки --- */
.cab-panel{display:none}
.cab-panel.active{display:block;animation:cabFade .45s cubic-bezier(.2,.8,.2,1)}
@keyframes cabFade{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
.cab-panel h2{font-family:var(--ff-display);font-size:clamp(1.4rem,4vw,1.9rem);margin:0 0 16px}
.cab-card{position:relative;overflow:hidden;background:var(--panel);border:1px solid var(--glass-brd);border-radius:var(--radius);padding:20px 22px;
  box-shadow:var(--shadow-card);margin-bottom:16px;backdrop-filter:blur(14px);transition:transform .25s,box-shadow .25s}
.cab-card::before{content:"";position:absolute;left:0;top:0;bottom:0;width:3px;background:var(--grad-gold);opacity:0;transition:opacity .25s}
.cab-card:hover{transform:translateY(-3px);box-shadow:var(--shadow-card),var(--shadow-glow)}
.cab-card:hover::before{opacity:.85}
.cab-card.cab-empty::before,.cab-card.cab-empty:hover{transform:none}
.cab-row{display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap;align-items:flex-start}
.cab-ttl{font-family:var(--ff-serif);font-size:1.12rem;font-weight:700;overflow-wrap:anywhere}
.cab-meta{color:var(--muted);font-size:.9rem;margin:6px 0 0;overflow-wrap:anywhere}
.cab-result{color:var(--gold-2);font-weight:800;margin-top:6px}
.cab-empty{text-align:center;color:var(--muted);padding:44px 20px}
.cab-empty svg{width:40px;height:40px;opacity:.5;margin:0 auto 12px;display:block}
.cab-actions{display:flex;gap:10px;flex-wrap:wrap;align-items:center}
/* --- Прогресс-конвейер заявки --- */
.cab-steps{display:flex;align-items:flex-start;gap:0;margin-top:18px}
.cab-step{flex:1;text-align:center;position:relative;min-width:0}
.cab-step::before{content:"";position:absolute;top:9px;left:-50%;width:100%;height:2px;background:var(--line)}
.cab-step:first-child::before{display:none}
.cab-step.done::before{background:var(--grad-gold)}
.cab-dot{width:22px;height:22px;border-radius:50%;margin:0 auto;position:relative;z-index:1;
  background:var(--panel-solid);border:2px solid var(--line);transition:.3s}
.cab-step.done .cab-dot{background:var(--grad-gold);border-color:transparent;box-shadow:0 4px 12px -3px rgba(139,111,31,.5)}
.cab-step.done .cab-dot::after{content:"";position:absolute;left:7px;top:4px;width:5px;height:9px;
  border:solid var(--gold-fg);border-width:0 2px 2px 0;transform:rotate(42deg)}
.cab-step.here .cab-dot{box-shadow:0 0 0 5px var(--gold-soft)}
.cab-step.here .cab-dot::after{opacity:.55}
.cab-step small{display:block;font-size:.68rem;color:var(--muted);margin-top:7px;overflow-wrap:anywhere}
.cab-step.done small{color:var(--text-dim);font-weight:700}
.cab-bar{height:8px;border-radius:999px;background:var(--gold-soft);overflow:hidden;margin-top:16px}
.cab-bar i{display:block;height:100%;border-radius:999px;background:var(--grad-gold);width:0;transition:width 1s cubic-bezier(.2,.8,.2,1)}
.cab-reject{margin-top:14px;color:var(--error);font-weight:700;font-size:.9rem}
/* --- Тумблер --- */
.switch{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:16px 0;border-bottom:1px solid var(--line)}
.switch:last-of-type{border-bottom:none}
.switch-txt strong{display:block;font-weight:700;font-size:.98rem}
.switch-txt span{display:block;color:var(--muted);font-size:.82rem;margin-top:3px}
.switch input{position:absolute;opacity:0;width:0;height:0}
.switch-ui{flex:none;width:52px;height:30px;border-radius:999px;background:var(--line);position:relative;cursor:pointer;transition:.3s;border:1px solid var(--glass-brd)}
.switch-ui::after{content:"";position:absolute;top:3px;left:3px;width:22px;height:22px;border-radius:50%;background:var(--panel-solid);box-shadow:0 2px 6px rgba(0,0,0,.2);transition:.3s}
.switch input:checked + .switch-ui{background:var(--grad-gold)}
.switch input:checked + .switch-ui::after{transform:translateX(22px)}
.switch input:focus-visible + .switch-ui{box-shadow:0 0 0 3px var(--gold-soft)}
/* --- Аватар-редактор в настройках --- */
.cab-avaedit{display:flex;gap:16px;align-items:center;margin-bottom:18px}
.cab-avaedit .cab-ava{width:60px;height:60px;border-radius:18px;font-size:1.5rem}
/* --- Реферальные KPI --- */
.cab-kpis{display:grid;grid-template-columns:repeat(2,1fr);gap:12px;margin-bottom:18px}
.cab-kpi{position:relative;overflow:hidden;padding:20px 18px;border-radius:var(--radius-sm);
  background:radial-gradient(200px 120px at 100% 0,var(--gold-soft),transparent 70%),var(--panel);
  border:1px solid var(--glass-brd);text-align:center;backdrop-filter:blur(10px);box-shadow:var(--shadow-soft)}
.cab-kpi::before{content:"";position:absolute;left:0;top:0;right:0;height:2px;background:var(--grad-gold);opacity:.7}
.cab-kpi b{display:block;font-family:var(--ff-display);font-size:2.1rem;line-height:1;
  background:var(--grad-gold);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent}
.cab-kpi span{display:block;color:var(--muted);font-size:.8rem;margin-top:7px}
.cab-code{display:inline-flex;align-items:center;gap:10px;font-family:var(--ff-body);font-weight:800;letter-spacing:.08em;
  font-size:1.05rem;padding:8px 16px;border-radius:var(--radius-sm);background:var(--gold-soft);color:var(--gold);border:1px dashed var(--glass-brd)}
.cab-copy{cursor:pointer;background:none;border:none;color:var(--gold-2);display:inline-flex;padding:4px}
.cab-logout{display:inline-flex;align-items:center;gap:8px;margin-top:8px;color:var(--muted);font-size:.9rem;font-weight:600}
.cab-logout:hover{color:var(--error)}
.scroll-x{overflow-x:auto;-webkit-overflow-scrolling:touch}
@media(max-width:560px){
  .cab-ava{width:66px;height:66px;border-radius:20px;font-size:1.7rem}
  .cab-stats{gap:8px}
  .cab-step small{font-size:.6rem}
}
</style>
<section class="section">
  <div class="container">
    <div class="cab">

      <!-- Шапка профиля -->
      <div class="cab-hero reveal">
        <svg class="cab-hero-note" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" aria-hidden="true"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
        <div class="cab-hero-top">
          <div class="cab-ava">
            <?php if ($avatar !== ''): ?><img src="<?= h($avatar) ?>" alt="" loading="lazy"><?php else: ?><?= h($initials) ?><?php endif; ?>
          </div>
          <div class="cab-id">
            <h1><?= h($user['full_name'] ?: 'Участник') ?></h1>
            <span class="cab-role"><?= h($roleLabels[$user['role']] ?? 'Участник') ?></span>
            <span class="cab-email"><?= h($user['email']) ?></span>
          </div>
        </div>
        <div class="cab-stats">
          <div class="cab-stat"><b><?= count($apps) ?></b><span>Заявок</span></div>
          <div class="cab-stat"><b><?= count($diplomas) ?></b><span>Дипломов</span></div>
          <div class="cab-stat"><b><?= count($orders) ?></b><span>Заказов</span></div>
        </div>
      </div>

      <!-- Вкладки -->
      <div class="cab-tabs scroll-x" id="cabTabs" role="tablist">
        <?php foreach ($sections as $i => [$id,$label]): ?>
          <button type="button" class="cab-tab <?= $i===0?'active':'' ?>" data-tab="<?= $id ?>" role="tab" aria-selected="<?= $i===0?'true':'false' ?>"><?= $icons[$id] ?><span><?= h($label) ?></span></button>
        <?php endforeach; ?>
      </div>

      <div class="cab-main">

        <!-- Мои заявки -->
        <div class="cab-panel active" id="tab-apps" role="tabpanel">
          <h2>Мои заявки</h2>
          <?php if (!$apps): ?>
            <div class="cab-card cab-empty">
              <?= $icons['apps'] ?>
              <p>У Вас пока нет заявок.</p>
              <a class="btn btn--primary" href="<?= url('/apply') ?>">Подать заявку</a>
            </div>
          <?php else: foreach ($apps as $k => $a):
            [$sl,$st] = $appStatus[$a['status']] ?? [$a['status'],'info'];
            $isRej = $a['status'] === 'rejected';
            $cur = array_search($a['status'], $pipeline, true);
            if ($cur === false) $cur = 0;
            $pct = $isRej ? 100 : (int)round(($cur + 1) / count($pipeline) * 100); ?>
            <div class="cab-card reveal" style="--i:<?= $k ?>">
              <div class="cab-row">
                <div style="min-width:0">
                  <span class="cab-ttl"><?= h($a['comp_name'] ?: 'Конкурс') ?></span>
                  <p class="cab-meta">
                    <?php if ($a['number']): ?>Заявка № <?= h($a['number']) ?> - <?php endif; ?>
                    <?= h($a['nomination'] ?: 'Номинация не указана') ?>
                    <?php if ($a['work_title']): ?> - «<?= h($a['work_title']) ?>»<?php endif; ?>
                  </p>
                  <p class="cab-meta">Подана <?= h(ru_date(substr((string)$a['created_at'],0,10))) ?></p>
                </div>
                <div style="text-align:right"><?= $badge($sl,$st) ?></div>
              </div>
              <?php if ($isRej): ?>
                <p class="cab-reject">Заявка отклонена. Свяжитесь с нами для уточнения.</p>
              <?php else: ?>
                <div class="cab-steps">
                  <?php foreach ($pipeLabels as $pi => $pl): ?>
                    <div class="cab-step <?= $pi <= $cur ? 'done' : '' ?> <?= $pi === $cur ? 'here' : '' ?>"><span class="cab-dot"></span><small><?= h($pl) ?></small></div>
                  <?php endforeach; ?>
                </div>
                <div class="cab-bar"><i data-w="<?= $pct ?>"></i></div>
              <?php endif; ?>
              <?php if (!empty($a['result'])): ?><p class="cab-result"><?= h($a['result']) ?></p><?php endif; ?>
            </div>
          <?php endforeach; endif; ?>
        </div>

        <!-- Мои дипломы -->
        <div class="cab-panel" id="tab-diplomas" role="tabpanel">
          <h2>Мои дипломы</h2>
          <?php if (!$diplomas): ?>
            <div class="cab-card cab-empty"><?= $icons['diploma'] ?><p>Дипломы появятся здесь после оценки Ваших работ жюри.</p></div>
          <?php else: foreach ($diplomas as $k => $d): ?>
            <div class="cab-card reveal" style="--i:<?= $k ?>">
              <div class="cab-row">
                <div style="min-width:0">
                  <span class="cab-ttl"><?= h($d['result'] ?: $d['app_result'] ?: 'Диплом') ?></span>
                  <p class="cab-meta"><?= h($d['comp_name'] ?: 'Конкурс') ?> - <?= h($d['full_name']) ?></p>
                  <p class="cab-meta">Диплом № <?= h($d['number']) ?> - <?= h(ru_date(substr((string)$d['created_at'],0,10))) ?></p>
                </div>
                <div><?= $badge('Готов','success') ?></div>
              </div>
              <div class="cab-actions" style="margin-top:16px">
                <?php if (!empty($d['pdf_path'])): ?>
                  <a class="btn btn--primary" href="<?= h(str_starts_with((string)$d['pdf_path'],'http') ? $d['pdf_path'] : url($d['pdf_path'])) ?>" target="_blank" rel="noopener"><?= $icons['dl'] ?> Скачать PDF</a>
                <?php endif; ?>
                <form method="post" action="<?= url('/cabinet') ?>" style="margin:0">
                  <?= csrf_field() ?>
                  <input type="hidden" name="action" value="resend_diploma">
                  <input type="hidden" name="number" value="<?= h($d['number']) ?>">
                  <button class="btn btn--ghost" type="submit"><?= $icons['mail'] ?> На почту</button>
                </form>
                <a class="btn btn--ghost" href="<?= url('/verify/'.$d['number']) ?>" target="_blank" rel="noopener"><?= $icons['qr'] ?> Проверка QR</a>
              </div>
            </div>
          <?php endforeach; endif; ?>
        </div>

        <!-- Награды и заказы -->
        <div class="cab-panel" id="tab-awards" role="tabpanel">
          <h2>Награды и заказы</h2>
          <?php if (!$orders): ?>
            <div class="cab-card cab-empty">
              <?= $icons['awards'] ?>
              <p>У Вас пока нет заказов наградной продукции.</p>
              <a class="btn btn--primary" href="<?= url('/order-awards') ?>">Заказать награды</a>
            </div>
          <?php else: foreach ($orders as $k => $o):
            [$sl,$st] = $orderStatus[$o['status']] ?? [$o['status'],'info']; ?>
            <div class="cab-card reveal" style="--i:<?= $k ?>">
              <div class="cab-row">
                <div style="min-width:0">
                  <span class="cab-ttl"><?= h($o['items'] ?: 'Наградная продукция') ?></span>
                  <p class="cab-meta"><?= h($o['competition'] ?: '') ?><?php if ($o['result']): ?> - <?= h($o['result']) ?><?php endif; ?></p>
                  <p class="cab-meta">Заказ от <?= h(ru_date(substr((string)$o['created_at'],0,10))) ?><?php if ($o['amount']): ?> - <?= h(money((int)$o['amount'])) ?><?php endif; ?></p>
                  <?php if (!empty($o['tracking'])): ?><p class="cab-meta">Трек-номер: <strong><?= h($o['tracking']) ?></strong></p><?php endif; ?>
                </div>
                <div style="text-align:right"><?= $badge($sl,$st) ?></div>
              </div>
            </div>
          <?php endforeach; endif; ?>
        </div>

        <!-- Настройки -->
        <div class="cab-panel" id="tab-settings" role="tabpanel">
          <h2>Настройки</h2>

          <div class="cab-card">
            <h3 style="margin-top:0;font-family:var(--ff-serif)">Профиль</h3>
            <form method="post" action="<?= url('/cabinet') ?>">
              <?= csrf_field() ?>
              <input type="hidden" name="action" value="profile">
              <div class="cab-avaedit">
                <div class="cab-ava">
                  <?php if ($avatar !== ''): ?><img src="<?= h($avatar) ?>" alt="" loading="lazy"><?php else: ?><?= h($initials) ?><?php endif; ?>
                </div>
                <div class="field" style="flex:1;margin:0;min-width:0">
                  <label for="p_ava">Фото профиля</label>
                  <input type="url" id="p_ava" name="avatar" value="<?= h($avatar) ?>" placeholder="Подтягивается из входа ВК / MAX">
                  <div class="hint">Фото берётся из социального входа. Можно указать свою ссылку.</div>
                </div>
              </div>
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
              <button class="btn btn--primary" type="submit">Сохранить профиль</button>
            </form>
          </div>

          <div class="cab-card">
            <h3 style="margin-top:0;font-family:var(--ff-serif)">Подписка и уведомления</h3>
            <form method="post" action="<?= url('/cabinet') ?>">
              <?= csrf_field() ?>
              <input type="hidden" name="action" value="notify">
              <label class="switch">
                <span class="switch-txt"><strong>Рассылка на почту</strong><span>Статусы заявок, результаты, готовность дипломов</span></span>
                <input type="checkbox" name="notify_email" value="1" <?= (int)$user['notify_email'] ? 'checked' : '' ?>>
                <span class="switch-ui" aria-hidden="true"></span>
              </label>
              <label class="switch">
                <span class="switch-txt"><strong>Уведомления в Telegram</strong><span>Быстрые оповещения в мессенджере</span></span>
                <input type="checkbox" name="notify_tg" value="1" <?= (int)$user['notify_tg'] ? 'checked' : '' ?>>
                <span class="switch-ui" aria-hidden="true"></span>
              </label>
              <button class="btn btn--primary" type="submit" style="margin-top:18px">Сохранить</button>
            </form>
          </div>

          <div class="cab-card">
            <h3 style="margin-top:0;font-family:var(--ff-serif)">Смена пароля</h3>
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

          <a class="cab-logout" href="<?= url('/logout') ?>"><?= $icon('<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>') ?> Выйти из аккаунта</a>
        </div>

        <?php if ($isTeacher): ?>
        <!-- Мои ученики -->
        <div class="cab-panel" id="tab-students" role="tabpanel">
          <h2>Мои ученики</h2>
          <?php if (!$students): ?>
            <div class="cab-card cab-empty"><?= $icons['students'] ?><p>Заявки, где Вы указаны педагогом, появятся здесь.</p></div>
          <?php else: foreach ($students as $k => $s):
            [$sl,$st] = $appStatus[$s['status']] ?? [$s['status'],'info']; ?>
            <div class="cab-card reveal" style="--i:<?= $k ?>">
              <div class="cab-row">
                <div style="min-width:0">
                  <span class="cab-ttl"><?= h($s['full_name']) ?></span>
                  <p class="cab-meta"><?= h($s['comp_name'] ?: 'Конкурс') ?> - <?= h($s['nomination'] ?: '') ?></p>
                </div>
                <div style="text-align:right">
                  <?= $badge($sl,$st) ?>
                  <?php if (!empty($s['result'])): ?><p class="cab-result"><?= h($s['result']) ?></p><?php endif; ?>
                </div>
              </div>
            </div>
          <?php endforeach; endif; ?>
        </div>

        <!-- Реферальная программа -->
        <div class="cab-panel" id="tab-ref" role="tabpanel">
          <h2>Реферальная программа</h2>
          <div class="cab-kpis">
            <div class="cab-kpi"><b><?= (int)$refUses ?></b><span>Оплаченных применений</span></div>
            <div class="cab-kpi"><b><?= h(money((int)$refReward)) ?></b><span>Начислено вознаграждений</span></div>
          </div>

          <?php if ($refCodes): foreach ($refCodes as $k => $c): ?>
            <div class="cab-card reveal" style="--i:<?= $k ?>">
              <div class="cab-row">
                <div>
                  <span class="cab-code" data-code="<?= h($c['code']) ?>"><?= h($c['code']) ?>
                    <button type="button" class="cab-copy" title="Скопировать"><?= $icon('<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h8"/>') ?></button>
                  </span>
                  <p class="cab-meta">Скидка ученику <?= (int)$c['percent'] ?>% - Ваше вознаграждение <?= (int)$c['reward_percent'] ?>%</p>
                </div>
                <div style="text-align:right">
                  <?= $badge($c['active'] ? 'Активен' : 'Выключен', $c['active'] ? 'success' : 'error') ?>
                  <p class="cab-meta">Применений: <strong><?= (int)$c['uses'] ?></strong></p>
                </div>
              </div>
            </div>
          <?php endforeach; endif; ?>

          <div class="cab-card">
            <h3 style="margin-top:0;font-family:var(--ff-serif)">Создать промокод</h3>
            <form method="post" action="<?= url('/cabinet') ?>">
              <?= csrf_field() ?>
              <input type="hidden" name="action" value="referral_create">
              <div class="grid grid-2" style="display:grid;grid-template-columns:1fr 1fr;gap:14px">
                <div class="field" style="margin-bottom:0">
                  <label for="r_code">Свой код (необязательно)</label>
                  <input type="text" id="r_code" name="code" maxlength="16" placeholder="Сгенерируем автоматически">
                </div>
                <div class="field" style="margin-bottom:0">
                  <label for="r_pct">Скидка ученику, %</label>
                  <input type="number" id="r_pct" name="percent" value="5" min="1" max="30">
                </div>
              </div>
              <p class="cab-meta" style="margin:14px 0">Поделитесь кодом с учениками - они получают скидку, а Вам начисляется вознаграждение после оплаты.</p>
              <button class="btn btn--primary" type="submit">Создать промокод</button>
            </form>
          </div>
        </div>
        <?php endif; ?>

      </div>
    </div>
  </div>
</section>
<script>
(function(){
  var tabs=document.getElementById('cabTabs');
  if(!tabs)return;
  var btns=tabs.querySelectorAll('.cab-tab');
  function fillBars(id){
    document.querySelectorAll('#tab-'+id+' .cab-bar i').forEach(function(el){
      requestAnimationFrame(function(){el.style.width=(el.getAttribute('data-w')||0)+'%';});
    });
  }
  function show(id){
    document.querySelectorAll('.cab-panel').forEach(function(p){p.classList.toggle('active',p.id==='tab-'+id);});
    btns.forEach(function(b){var on=b.getAttribute('data-tab')===id;b.classList.toggle('active',on);b.setAttribute('aria-selected',on?'true':'false');});
    fillBars(id);
  }
  btns.forEach(function(b){b.addEventListener('click',function(){var id=b.getAttribute('data-tab');show(id);history.replaceState(null,'','#'+id);
    b.scrollIntoView({inline:'center',block:'nearest',behavior:'smooth'});});});
  var h=(location.hash||'').replace('#','');
  if(h&&document.getElementById('tab-'+h))show(h); else fillBars('apps');
  // Копирование реф-кода
  document.querySelectorAll('.cab-copy').forEach(function(btn){
    btn.addEventListener('click',function(){
      var code=btn.closest('.cab-code').getAttribute('data-code')||'';
      if(navigator.clipboard)navigator.clipboard.writeText(code);
      if(window.toast)window.toast('Промокод скопирован','success');
    });
  });
})();
</script>
<?php
$content = ob_get_clean();
render_page('Личный кабинет', $content, ['active' => '/cabinet', 'meta' => 'Личный кабинет участника КЦ «Музыкальный Мир»: заявки, дипломы, награды, настройки.']);
