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
        $nickname = trim(input('nickname'));
        $category = trim(input('category'));
        if (function_exists('v_fio') && $fio !== '') $fio = v_fio($fio);
        $upd = ['full_name' => $fio, 'phone' => $phone, 'nickname' => $nickname];
        $allowedCats = ['participant','teacher','parent','director','other'];
        if (in_array($category, $allowedCats, true)) $upd['category'] = $category;
        if ($avatar === '' || preg_match('~^https?://~i', $avatar) || str_starts_with($avatar, 'data:image/')) $upd['avatar'] = $avatar;
        // Категория «Педагог» — если пользователь ещё не teacher/jury/moderator, поднимаем роль до teacher
        if ($category === 'teacher' && !in_array((string)($user['role'] ?? ''), ['teacher','jury','moderator','admin','owner'], true)) {
            $upd['role'] = 'teacher';
        }
        update('users', $upd, 'id=:id', ['id' => $uid]);
        audit('profile_update', 'user', $uid);
        flash('Профиль обновлён.', 'success');
        redirect('/cabinet#settings');
    } elseif ($action === 'music_toggle') {
        $off = (int) !empty($_POST['music_off']);
        update('users', ['music_off' => $off], 'id=:id', ['id' => $uid]);
        flash($off ? 'Фоновая музыка выключена.' : 'Фоновая музыка включена.', 'success');
        redirect('/cabinet#settings');
    } elseif ($action === 'unlink') {
        $prov = input('provider');
        $col = ['vk'=>'vk_id','max'=>'max_id','tg'=>'tg_id','phone'=>'phone'][$prov] ?? '';
        if ($col) {
            update('users', [$col => ''], 'id=:id', ['id' => $uid]);
            if ($prov === 'phone') update('users', ['phone_verified' => 0], 'id=:id', ['id' => $uid]);
            flash('Метод входа отвязан.', 'success');
        }
        redirect('/cabinet#settings');
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
  'diplomas' => $icon('<circle cx="12" cy="8" r="6"/><path d="M8.2 13.9 7 22l5-3 5 3-1.2-8.1"/>'),
  'students' => $icon('<circle cx="9" cy="8" r="4"/><path d="M2 21v-1a6 6 0 0 1 6-6h2M16 11l2 2 4-4"/>'),
  'awards'  => $icon('<path d="M3 3h18v4H3zM4 7l1 13h14l1-13"/><path d="M9 12h6"/>'),
  'settings'=> $icon('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>'),
  'students'=> $icon('<circle cx="9" cy="8" r="4"/><path d="M2 21v-1a6 6 0 0 1 6-6h2M16 11l2 2 4-4"/>'),
  'ref'     => $icon('<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/>'),
  'qr'      => $icon('<path d="M3 3h6v6H3zM15 3h6v6h-6zM3 15h6v6H3z"/><path d="M15 15h2v2h-2zM19 15h2M15 19h2v2M19 19h2v2"/>'),
  'dl'      => $icon('<path d="M12 3v12M7 11l5 4 5-4M4 21h16"/>'),
  'mail'    => $icon('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>'),
  'stats'   => $icon('<path d="M4 20V10M10 20V4M16 20v-6M22 20H2"/>'),
  'achievements' => $icon('<circle cx="12" cy="8" r="6"/><path d="M8.2 13.9 7 22l5-3 5 3-1.2-8.1"/>'),
  'theme'   => $icon('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>'),
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
  ['achievements','Достижения'],
  ['stats','Статистика'],
  ['settings','Настройки'],
];
if ($isTeacher) { $sections[] = ['students','Мои ученики']; $sections[] = ['ref','Реферальная программа']; }

/* --- Достижения (медали за прогресс, по образцу OKO app) --- */
$countApps    = count($apps);
$countDiplomas = count($diplomas);
$countGP = 0; $countL1 = 0;
foreach ($apps as $a) {
    $r = mb_strtolower((string)($a['result'] ?? ''));
    if (str_contains($r, 'гран')) $countGP++;
    elseif (str_contains($r, 'i степ') || str_contains($r, '1 степ')) $countL1++;
}
$achievements = [
  ['id'=>'first_step',  'title'=>'Первый шаг',        'desc'=>'Первая заявка на конкурс',            'done'=> $countApps >= 1,  'ic'=>'star'],
  ['id'=>'first_prize', 'title'=>'Первая награда',    'desc'=>'Первый диплом получен',               'done'=> $countDiplomas >= 1, 'ic'=>'medal'],
  ['id'=>'active_5',    'title'=>'Активный участник', 'desc'=>'5 заявок на конкурсы',                'done'=> $countApps >= 5,  'ic'=>'flame'],
  ['id'=>'active_10',   'title'=>'Постоянный участник','desc'=>'10 заявок на конкурсы',              'done'=> $countApps >= 10, 'ic'=>'flame'],
  ['id'=>'top_1',       'title'=>'Лауреат I',         'desc'=>'Диплом Лауреата I степени',           'done'=> $countL1 >= 1,    'ic'=>'trophy'],
  ['id'=>'grand_prix',  'title'=>'Гран-При',          'desc'=>'Абсолютная победа',                   'done'=> $countGP >= 1,    'ic'=>'crown'],
  ['id'=>'legend',      'title'=>'Легенда',           'desc'=>'3+ Гран-При на конкурсах центра',     'done'=> $countGP >= 3,    'ic'=>'crown'],
  ['id'=>'reg',         'title'=>'Регистрация',       'desc'=>'Аккаунт создан — Добро пожаловать!', 'done'=> true,             'ic'=>'star'],
];
$achDoneCount = 0; foreach ($achievements as $a) if ($a['done']) $achDoneCount++;

// Уровень участника (grow by number of апробаций + weighted results)
$levelPoints = $countApps * 5 + $countDiplomas * 10 + $countGP * 50 + $countL1 * 30;
$level = min(20, 1 + intdiv($levelPoints, 100));
$nextLevelAt = $level * 100;
$prevLevelAt = ($level - 1) * 100;
$levelPct = max(0, min(100, ($levelPoints - $prevLevelAt) * 100 / max(1, $nextLevelAt - $prevLevelAt)));

$achIcons = [
  'star'   => '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3 7h7l-5.5 4 2 7L12 16l-6.5 4 2-7L2 9h7z"/></svg>',
  'medal'  => '<svg viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="14" r="7"/><path d="M8 2h8l-2 6H10z" opacity=".8"/></svg>',
  'flame'  => '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2s6 4 6 10a6 6 0 0 1-12 0c0-3 2-4 2-4s0 2 2 3c0-3 1-5 2-6 0-1 0-2 0-3z"/></svg>',
  'trophy' => '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 4h12v4a6 6 0 0 1-12 0zM4 6h2v2a3 3 0 0 1-2 0zm14 0h2v2a3 3 0 0 1-2 0zM9 15h6v3H9z"/><rect x="7" y="18" width="10" height="3" rx="1"/></svg>',
  'crown'  => '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M2 8l4 5 6-9 6 9 4-5v10H2z"/></svg>',
];

/* --- Данные для панели «Статистика» (мини-аналитика по заявкам) --- */
$byMonth = [];
$byStatus = ['new'=>0,'paid'=>0,'judging'=>0,'graded'=>0,'sent'=>0,'rejected'=>0];
$byResult = ['gp'=>0,'laur1'=>0,'laur2'=>0,'laur3'=>0,'dipl'=>0,'other'=>0];
$totalPaid = 0;
foreach ($apps as $a) {
    $m = substr((string)($a['created_at'] ?? ''), 0, 7);
    if ($m !== '') $byMonth[$m] = ($byMonth[$m] ?? 0) + 1;
    $st = (string)($a['status'] ?? '');
    if (isset($byStatus[$st])) $byStatus[$st]++;
    $r = mb_strtolower((string)($a['result'] ?? ''));
    if     (str_contains($r, 'гран')) $byResult['gp']++;
    elseif (str_contains($r, 'i степ') || str_contains($r, '1 степ')) $byResult['laur1']++;
    elseif (str_contains($r, 'ii степ') || str_contains($r, '2 степ')) $byResult['laur2']++;
    elseif (str_contains($r, 'iii степ') || str_contains($r, '3 степ')) $byResult['laur3']++;
    elseif ($r !== '' && str_contains($r, 'дипл')) $byResult['dipl']++;
    elseif ($r !== '') $byResult['other']++;
    if (in_array($st, ['paid','judging','graded','sent'], true)) $totalPaid += (int)($a['amount_paid'] ?? 0);
}
ksort($byMonth);
$monthLabels = array_slice(array_keys($byMonth), -6);
$monthVals = array_values(array_intersect_key($byMonth, array_flip($monthLabels)));
$maxMonth = max([1, ...($monthVals ?: [0])]);

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
  box-shadow:0 12px 30px -8px rgba(139,111,31,.5),inset 0 0 24px color-mix(in srgb,var(--gold-fg) 16%,transparent),0 0 0 1px var(--glass-brd)}
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
  background:var(--grad-gold-text);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent}
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
  background:var(--grad-gold-text);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent}
.cab-kpi span{display:block;color:var(--muted);font-size:.8rem;margin-top:7px}
.cab-code{display:inline-flex;align-items:center;gap:10px;font-family:var(--ff-body);font-weight:800;letter-spacing:.08em;
  font-size:1.05rem;padding:8px 16px;border-radius:var(--radius-sm);background:var(--gold-soft);color:var(--gold);border:1px dashed var(--glass-brd)}
.cab-copy{cursor:pointer;background:none;border:none;color:var(--gold-2);display:inline-flex;padding:4px}
.cab-logout{display:inline-flex;align-items:center;gap:8px;margin-top:8px;color:var(--muted);font-size:.9rem;font-weight:600}
.cab-logout:hover{color:var(--error)}
.scroll-x{overflow-x:auto;-webkit-overflow-scrolling:touch}
/* Контраст: золотой ТЕКСТ на светлой теме тускнеет — затемняем до gold-ink (как в style.css) */
:root:not([data-theme="dark"]) .cab-role,
:root:not([data-theme="dark"]) .cab-result,
:root:not([data-theme="dark"]) .cab-code{color:var(--gold-ink)}
/* --- Кнопка «Паспорт участника» --- */
.cab-passport{margin-bottom:16px}
@media(max-width:560px){
  .cab-ava{width:66px;height:66px;border-radius:20px;font-size:1.7rem}
  .cab-stats{gap:8px}
  .cab-step small{font-size:.6rem}
}
@media(prefers-reduced-motion:reduce){
  .cab-panel.active{animation:none}
  .cab-card,.cab-stat,.cab-step,.cab-step::before,.cab-dot,.switch-ui,.switch-ui::after{transition:none}
  .cab-card:hover,.cab-stat:hover{transform:none}
  .cab-bar i{transition:none}
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
            <?php if ($avatar !== ''): ?><img src="<?= h($avatar) ?>" alt="Фото профиля: <?= h($user['full_name'] ?: 'участник') ?>" loading="lazy"><?php else: ?><?= h($initials) ?><?php endif; ?>
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
              <?php if (!empty($a['result'])): ?>
                <p class="cab-result"><?= h($a['result']) ?></p>
                <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:12px">
                  <a class="btn btn--primary" href="<?= url('/order-awards?app=' . (int)$a['id']) ?>">Заказать награду</a>
                  <span class="hint" style="align-self:center">Данные подставятся из заявки — вводить заново не нужно.</span>
                </div>
              <?php else: ?>
                <p class="cab-meta" style="margin-top:10px;opacity:.85">Награды можно будет заказать после оглашения результата.</p>
              <?php endif; ?>
            </div>
          <?php endforeach; endif; ?>
        </div>

        <!-- Мои дипломы -->
        <div class="cab-panel" id="tab-diplomas" role="tabpanel">
          <h2>Мои дипломы</h2>
          <?php if ($diplomas): ?>
            <a class="btn btn--primary cab-passport" href="<?= url('/api/v1/passport') ?>" rel="nofollow"><?= $icons['dl'] ?> Скачать паспорт участника (все дипломы, PDF)</a>
          <?php endif; ?>
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

        <!-- Достижения (OKO-style) -->
        <div class="cab-panel" id="tab-achievements" role="tabpanel">
          <h2>Достижения</h2>

          <div class="cab-card cab-level">
            <div class="cab-level-head">
              <div>
                <p class="eyebrow" style="margin:0">Уровень участника</p>
                <b class="cab-level-num">Уровень <?= (int)$level ?></b>
              </div>
              <div class="cab-level-count"><?= (int)$achDoneCount ?> / <?= count($achievements) ?> открыто</div>
            </div>
            <div class="cab-level-bar"><i style="width:<?= (int)$levelPct ?>%"></i></div>
            <div class="cab-level-hint">
              <?php if ($level < 20): ?>
                До уровня <?= (int)$level + 1 ?>: <?= max(0, $nextLevelAt - $levelPoints) ?> очков (за заявку +5, диплом +10, Лауреат I +30, Гран-При +50)
              <?php else: ?>
                Максимальный уровень — Легенда центра.
              <?php endif; ?>
            </div>
          </div>

          <div class="ach-grid">
            <?php foreach ($achievements as $ach): ?>
              <div class="ach-tile<?= $ach['done'] ? ' done' : '' ?>">
                <div class="ach-ic"><?= $achIcons[$ach['ic']] ?? $achIcons['star'] ?></div>
                <div class="ach-body">
                  <b><?= h($ach['title']) ?></b>
                  <span><?= h($ach['desc']) ?></span>
                </div>
                <?php if ($ach['done']): ?>
                  <span class="ach-check" aria-label="Открыто">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
                  </span>
                <?php else: ?>
                  <span class="ach-lock" aria-label="Закрыто">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="10" width="16" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>
                  </span>
                <?php endif; ?>
              </div>
            <?php endforeach; ?>
          </div>
        </div>

        <!-- Статистика -->
        <div class="cab-panel" id="tab-stats" role="tabpanel">
          <h2>Статистика и аналитика</h2>
          <div class="cab-kpis">
            <div class="cab-kpi"><b><?= (int)count($apps) ?></b><span>Всего заявок</span></div>
            <div class="cab-kpi"><b><?= (int)count($diplomas) ?></b><span>Дипломов</span></div>
            <div class="cab-kpi"><b><?= (int)$byResult['gp'] + (int)$byResult['laur1'] ?></b><span>Гран-При и I ст.</span></div>
            <div class="cab-kpi"><b><?= (int)$totalPaid ?> ₽</b><span>Оплачено всего</span></div>
          </div>

          <div class="cab-card">
            <h3 style="margin-top:0;font-family:var(--ff-serif)">Активность по месяцам</h3>
            <?php if (!$monthVals): ?>
              <p style="color:var(--muted);margin:0">Данных пока нет — подайте первую заявку.</p>
            <?php else: ?>
            <div class="cab-bars">
              <?php foreach ($monthVals as $i => $v):
                $pct = round($v * 100 / $maxMonth);
                $ml = $monthLabels[$i] ?? '';
                $mm = ['01'=>'Янв','02'=>'Фев','03'=>'Мар','04'=>'Апр','05'=>'Май','06'=>'Июн','07'=>'Июл','08'=>'Авг','09'=>'Сен','10'=>'Окт','11'=>'Ноя','12'=>'Дек'][substr($ml,5,2)] ?? substr($ml,5,2);
              ?>
              <div class="cab-bar-col" style="--h:<?= $pct ?>%" title="<?= h($ml) ?>: <?= (int)$v ?>">
                <div class="cab-bar-fill"><span><?= (int)$v ?></span></div>
                <small><?= h($mm) ?></small>
              </div>
              <?php endforeach; ?>
            </div>
            <?php endif; ?>
          </div>

          <div class="cab-card">
            <h3 style="margin-top:0;font-family:var(--ff-serif)">Распределение результатов</h3>
            <?php
              $rTot = array_sum($byResult);
              $rLabels = ['gp'=>'Гран-При','laur1'=>'Лауреат I','laur2'=>'Лауреат II','laur3'=>'Лауреат III','dipl'=>'Дипломант','other'=>'Другое'];
            ?>
            <?php if (!$rTot): ?>
              <p style="color:var(--muted);margin:0">Результаты появятся после оценки заявок жюри.</p>
            <?php else: ?>
              <div class="cab-legend">
                <?php foreach ($byResult as $k => $v): if(!$v) continue; $pct = round($v*100/$rTot); ?>
                  <div class="cab-legend-row">
                    <span class="cab-legend-lbl"><?= h($rLabels[$k]) ?></span>
                    <span class="cab-legend-bar"><i style="width:<?= $pct ?>%"></i></span>
                    <span class="cab-legend-num"><?= (int)$v ?> <small>(<?= $pct ?>%)</small></span>
                  </div>
                <?php endforeach; ?>
              </div>
            <?php endif; ?>
          </div>

          <div class="cab-card">
            <h3 style="margin-top:0;font-family:var(--ff-serif)">Статусы заявок</h3>
            <div class="cab-legend">
              <?php foreach ($byStatus as $k => $v): $lbl = $appStatus[$k][0] ?? $k; $t = $appStatus[$k][1] ?? 'info'; ?>
                <div class="cab-legend-row">
                  <span class="cab-legend-lbl"><?= h($lbl) ?></span>
                  <span class="cab-legend-bar"><i style="width:<?= (int)count($apps) ? round($v*100/count($apps)) : 0 ?>%;background:var(--<?= $t==='success'?'grad-gold':($t==='error'?'error':'gold-2') ?>,var(--grad-gold))"></i></span>
                  <span class="cab-legend-num"><?= (int)$v ?></span>
                </div>
              <?php endforeach; ?>
            </div>
          </div>
        </div>

        <!-- Настройки -->
        <div class="cab-panel" id="tab-settings" role="tabpanel">
          <h2>Настройки</h2>

          <div class="cab-card">
            <h3 style="margin-top:0;font-family:var(--ff-serif)">Тема приложения</h3>
            <div class="theme-picker">
              <button type="button" class="theme-opt" data-theme-set="light" aria-pressed="false">
                <span class="theme-preview theme-preview--light"><i></i><i></i><i></i></span>
                <span>Светлая</span>
              </button>
              <button type="button" class="theme-opt" data-theme-set="dark" aria-pressed="false">
                <span class="theme-preview theme-preview--dark"><i></i><i></i><i></i></span>
                <span>Тёмная</span>
              </button>
            </div>
            <p class="hint" style="margin-top:12px">Тема сохраняется на устройстве. По умолчанию — светлая.</p>
          </div>

          <div class="cab-card">
            <h3 style="margin-top:0;font-family:var(--ff-serif)">Профиль</h3>
            <form method="post" action="<?= url('/cabinet') ?>" enctype="multipart/form-data" id="profileForm">
              <?= csrf_field() ?>
              <input type="hidden" name="action" value="profile">
              <input type="hidden" id="p_ava_hidden" name="avatar" value="<?= h($avatar) ?>">
              <div class="cab-avaedit">
                <div class="cab-ava" id="cabAvaPreview">
                  <?php if ($avatar !== ''): ?><img src="<?= h($avatar) ?>" alt="Текущее фото профиля" loading="lazy"><?php else: ?><?= h($initials) ?><?php endif; ?>
                </div>
                <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:8px">
                  <label class="btn btn--ghost btn--sm" for="p_ava_file" style="cursor:pointer;text-align:center">Загрузить фото</label>
                  <input type="file" id="p_ava_file" accept="image/*" hidden>
                  <button type="button" class="btn btn--ghost btn--sm" id="p_ava_clear" style="min-height:36px;font-size:.82rem">Удалить фото</button>
                  <div class="hint" style="font-size:.72rem;margin:0">JPG/PNG до 3 МБ. Сохранится в профиль.</div>
                </div>
              </div>

              <div class="field">
                <label>Категория</label>
                <div class="cat-picker">
                  <?php
                    $curCat = (string)($user['category'] ?? '');
                    if ($curCat === '') $curCat = $isTeacher ? 'teacher' : 'participant';
                    $cats = [
                      'participant' => ['Участник', '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>'],
                      'teacher'     => ['Педагог',  '<path d="M12 3l10 5-10 5L2 8z"/><path d="M6 10v6a6 6 0 0 0 12 0v-6"/>'],
                      'parent'      => ['Родитель', '<circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.4"/><path d="M2 21a7 7 0 0 1 14 0M13 21a5 5 0 0 1 9 0"/>'],
                      'director'    => ['Директор', '<path d="M3 21h18M5 21V10l7-5 7 5v11M9 21v-6h6v6"/>'],
                      'other'       => ['Другое',   '<circle cx="12" cy="12" r="10"/><path d="M9 9a3 3 0 0 1 6 0c0 2-3 2.5-3 4M12 17h.01"/>'],
                    ];
                    foreach ($cats as $key => [$lbl, $svg]):
                  ?>
                    <label class="cat-opt <?= $curCat===$key?'is-on':'' ?>">
                      <input type="radio" name="category" value="<?= h($key) ?>" <?= $curCat===$key?'checked':'' ?>>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><?= $svg ?></svg>
                      <span><?= h($lbl) ?></span>
                    </label>
                  <?php endforeach; ?>
                </div>
              </div>

              <div class="field">
                <label for="p_fio">Фамилия, имя, отчество</label>
                <input type="text" id="p_fio" name="full_name" value="<?= h($user['full_name']) ?>" placeholder="Иванова Мария Петровна">
              </div>
              <div class="field">
                <label for="p_nick">Никнейм</label>
                <input type="text" id="p_nick" name="nickname" value="<?= h($user['nickname'] ?? '') ?>" placeholder="как обращаться" maxlength="30">
                <div class="hint">Короткое имя для приветствия. Не отображается в дипломе.</div>
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

          <!-- Привязанные способы входа -->
          <div class="cab-card">
            <h3 style="margin-top:0;font-family:var(--ff-serif)">Способы входа</h3>
            <p class="hint" style="margin:0 0 14px">Привяжите несколько способов — заходите как удобно.</p>
            <?php
              $linked = [
                'email' => (bool)($user['email'] ?? ''),
                'vk'    => !empty($user['vk_id']),
                'max'   => !empty($user['max_id']),
                'tg'    => !empty($user['tg_id']),
                'phone' => !empty($user['phone']) && !empty($user['phone_verified']),
              ];
              $methods = [
                'email' => ['Почта',    '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>', url('/login')],
                'vk'    => ['ВКонтакте','<path d="M13.2 17.4c-5.5 0-8.9-3.8-9-10.1h2.8c.1 4.6 2.2 6.6 3.8 7V7.3h2.6v4c1.6-.2 3.3-2 3.9-4h2.6c-.5 2.5-2.2 4.3-3.4 5 1.2.6 3.2 2.2 3.9 5.1h-2.9c-.6-1.9-2.1-3.4-4.1-3.6v3.6h-.2z"/>', url('/api/v1/oauth_vk?bind=1')],
                'max'   => ['MAX',      '<path d="M4 19V6l8 6 8-6v13"/>', url('/api/v1/oauth_max?bind=1')],
                'tg'    => ['Telegram', '<path d="M22 4L2 12l6 2 2 6 4-4 6 4z"/>', 'https://t.me/kc_muz_mir_bot?start=link_'.$uid],
                'phone' => ['Телефон',  '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L20 13l2 4v3a1 1 0 0 1-1 1A17 17 0 0 1 4 5a1 1 0 0 1 1-1z"/>', '#'],
              ];
            ?>
            <div class="link-list">
              <?php foreach ($methods as $k => [$lbl, $svg, $bindUrl]): $on = $linked[$k]; ?>
                <div class="link-row <?= $on ? 'is-on' : '' ?>">
                  <span class="link-ic"><svg viewBox="0 0 24 24" fill="<?= $k==='vk'?'currentColor':'none' ?>" stroke="<?= $k==='vk'?'none':'currentColor' ?>" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><?= $svg ?></svg></span>
                  <div class="link-body">
                    <b><?= h($lbl) ?></b>
                    <span><?= $on ? 'Привязан' : 'Не привязан' ?></span>
                  </div>
                  <?php if ($on): ?>
                    <?php if ($k !== 'email'): // email — основной, нельзя отвязать ?>
                      <form method="post" action="<?= url('/cabinet') ?>" style="margin:0">
                        <?= csrf_field() ?>
                        <input type="hidden" name="action" value="unlink">
                        <input type="hidden" name="provider" value="<?= h($k) ?>">
                        <button type="submit" class="btn btn--ghost btn--sm" style="min-height:34px">Отвязать</button>
                      </form>
                    <?php else: ?>
                      <span class="link-ok">Основной</span>
                    <?php endif; ?>
                  <?php else: ?>
                    <a class="btn btn--primary btn--sm" href="<?= h($bindUrl) ?>" style="min-height:34px">Привязать</a>
                  <?php endif; ?>
                </div>
              <?php endforeach; ?>
            </div>
          </div>

          <!-- Тумблер фоновой музыки -->
          <div class="cab-card">
            <h3 style="margin-top:0;font-family:var(--ff-serif)">Фоновая музыка</h3>
            <form method="post" action="<?= url('/cabinet') ?>">
              <?= csrf_field() ?>
              <input type="hidden" name="action" value="music_toggle">
              <label class="switch">
                <span class="switch-txt"><strong>Классическая музыка в приложении</strong><span>Автоматически играет фоном (Вивальди, Моцарт, Бах, Шопен). Можно отключить.</span></span>
                <input type="checkbox" name="music_off" value="1" <?= !empty($user['music_off']) ? 'checked' : '' ?> onchange="this.form.submit()">
                <span class="switch-ui" aria-hidden="true"></span>
              </label>
              <div style="text-align:right;margin-top:8px"><small style="color:var(--muted)">Настройка сохраняется автоматически</small></div>
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
  // Category picker — визуальный тумблер (aria-pressed)
  document.querySelectorAll('.cat-opt input[type=radio]').forEach(function(inp){
    inp.addEventListener('change', function(){
      document.querySelectorAll('.cat-opt').forEach(function(l){ l.classList.remove('is-on'); });
      inp.closest('.cat-opt').classList.add('is-on');
    });
  });
  // Аватар: загрузка файла → base64 → hidden input + предпросмотр
  var avaFile = document.getElementById('p_ava_file');
  var avaHidden = document.getElementById('p_ava_hidden');
  var avaPrev = document.getElementById('cabAvaPreview');
  var avaClear = document.getElementById('p_ava_clear');
  if (avaFile) avaFile.addEventListener('change', function(){
    var f = avaFile.files && avaFile.files[0]; if (!f) return;
    if (f.size > 3*1024*1024) { alert('Файл слишком большой (макс 3 МБ)'); return; }
    var fr = new FileReader();
    fr.onload = function(){
      // Сожмём через canvas до 512×512 max
      var img = new Image();
      img.onload = function(){
        var c = document.createElement('canvas');
        var s = Math.min(512, Math.max(img.width, img.height));
        var scale = s / Math.max(img.width, img.height);
        c.width = Math.round(img.width * scale);
        c.height = Math.round(img.height * scale);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        var b64 = c.toDataURL('image/jpeg', .85);
        avaHidden.value = b64;
        avaPrev.innerHTML = '<img src="' + b64 + '" alt="Новое фото" loading="lazy">';
      };
      img.src = fr.result;
    };
    fr.readAsDataURL(f);
  });
  if (avaClear) avaClear.addEventListener('click', function(){
    if (!confirm('Удалить фото профиля?')) return;
    avaHidden.value = '';
    var initials = (document.getElementById('p_fio').value || '').split(/\s+/).map(function(w){return w[0]||'';}).join('').slice(0,2).toUpperCase() || '?';
    avaPrev.innerHTML = initials;
  });
  // Theme-picker: тумблер темы в настройках профиля
  function applyTheme(t){
    try{ localStorage.setItem('muzmir-theme', t); }catch(e){}
    document.documentElement.dataset.theme = t;
    document.querySelectorAll('.theme-opt').forEach(function(b){
      b.setAttribute('aria-pressed', b.getAttribute('data-theme-set')===t ? 'true':'false');
    });
    var mtc = document.getElementById('metaThemeColor');
    if (mtc) mtc.setAttribute('content', t==='dark' ? '#0b0a0d' : '#FFFCF5');
  }
  var curT = (document.documentElement.dataset.theme || 'light');
  applyTheme(curT);
  document.querySelectorAll('.theme-opt').forEach(function(b){
    b.addEventListener('click', function(){ applyTheme(b.getAttribute('data-theme-set')); });
  });
})();
</script>
<?php
$content = ob_get_clean();
render_page('Личный кабинет', $content, ['active' => '/cabinet', 'meta' => 'Личный кабинет участника КЦ «Музыкальный Мир»: заявки, дипломы, награды, настройки.']);
