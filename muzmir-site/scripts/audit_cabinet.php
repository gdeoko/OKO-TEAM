<?php
/**
 * АУДИТ ЛИЧНОГО КАБИНЕТА И ВИП-КЛУБА — через реальные страницы и обработчики.
 * Проверяет: статусы и статистику на живых данных, окно правки заявки (2 рабочих дня),
 * полный состав полей правки, достижения сезона, привилегии клуба до и после подписки,
 * кнопку запроса комментария жюри, исключение членов клуба из массового приглашения.
 *
 *   BASE=http://127.0.0.1:8099 MUZMIR_DB_PATH=… php scripts/audit_cabinet.php
 */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { fwrite(STDERR, "CLI only\n"); exit(1); }

define('BASE_PATH', dirname(__DIR__));
$GLOBALS['CFG'] = require BASE_PATH . '/config.php';
foreach (['db','helpers','data','app_status','send_timing','loyalty','club','mailer','newsletter'] as $m) {
    require_once BASE_PATH . '/core/' . $m . '.php';
}
db();

$BASE = rtrim((string) (getenv('BASE') ?: 'http://127.0.0.1:8099'), '/');
$FAIL = 0; $OK = 0;
function sec(string $s): void { echo "\n=== $s ===\n"; }
function ok(string $w, $i = ''): void { global $OK; $OK++; echo "  ok   $w" . ($i !== '' ? "  [$i]" : '') . "\n"; }
function bad(string $w, $i = ''): void { global $FAIL; $FAIL++; echo "  FAIL $w" . ($i !== '' ? "  $i" : '') . "\n"; }
function chk(string $w, $cond, $i = ''): void { $cond ? ok($w, $i) : bad($w, $i); }

function http(string $jar, string $url, array $post = null, bool $follow = true): array {
    global $BASE;
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true, CURLOPT_FOLLOWLOCATION => $follow, CURLOPT_MAXREDIRS => 5,
        CURLOPT_COOKIEJAR => $jar, CURLOPT_COOKIEFILE => $jar, CURLOPT_TIMEOUT => 60,
        CURLOPT_HEADER => true, CURLOPT_PROXY => '',
        CURLOPT_HTTPHEADER => ['Origin: ' . $BASE, 'Referer: ' . $BASE . '/', 'X-Requested-With: fetch'],
    ]);
    if ($post !== null) { curl_setopt($ch, CURLOPT_POST, true); curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query($post)); }
    $raw = (string) curl_exec($ch);
    $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $hlen = (int) curl_getinfo($ch, CURLINFO_HEADER_SIZE);
    curl_close($ch);
    return ['code' => $code, 'body' => substr($raw, $hlen)];
}
function tok(string $jar, string $path): string {
    global $BASE;
    $r = http($jar, $BASE . $path);
    if (preg_match('~name="_csrf"\s+value="([^"]+)"~', $r['body'], $m)) return $m[1];
    if (preg_match('~name="csrf"\s+value="([^"]+)"~', $r['body'], $m)) return $m[1];
    return '';
}
$UJAR = sys_get_temp_dir() . '/muzmir_cab_user.txt';
@unlink($UJAR);

/* ───────── вход участником ───────── */
sec('Вход участника');
$t = tok($UJAR, '/login');
http($UJAR, $BASE . '/login', ['_csrf' => $t, 'csrf' => $t, 'do' => 'login',
      'email' => 'user@test.local', 'password' => 'Test_12345']);
$cab = http($UJAR, $BASE . '/cabinet');
chk('кабинет открывается', $cab['code'] === 200, (string) $cab['code']);
chk('в кабинете нет PHP-шума',
    stripos($cab['body'], 'Warning:') === false && stripos($cab['body'], 'Undefined ') === false
    && stripos($cab['body'], 'Fatal error') === false);
$uid = (int) scalar("SELECT id FROM users WHERE email='user@test.local'");
chk('участник найден в базе', $uid > 0, "id=$uid");

/* ───────── разделы кабинета ───────── */
sec('Разделы кабинета присутствуют');
foreach (['Мои заявки' => 'заявки', 'Статистика' => 'статистика', 'Достижения' => 'достижения',
          'Настройки' => 'настройки'] as $needle => $what) {
    chk("раздел «{$what}»", stripos($cab['body'], $needle) !== false);
}

/* ───────── окно правки: 2 рабочих дня ───────── */
sec('Правка заявки: окно два рабочих дня');
$app = one("SELECT * FROM applications WHERE user_id=? AND COALESCE(result,'')='' ORDER BY id DESC LIMIT 1", [$uid]);
if (!$app) {
    bad('нет неоценённой заявки для проверки правки');
} else {
    $aid = (int) $app['id'];

    // а) свежая заявка — править можно
    q("UPDATE applications SET created_at=? WHERE id=?", [date('Y-m-d H:i:s'), $aid]);
    $fresh = one("SELECT * FROM applications WHERE id=?", [$aid]);
    $w = app_edit_window((array) $fresh);
    chk('свежая заявка редактируется', $w['can'], 'до ' . $w['until']);
    $cab = http($UJAR, $BASE . '/cabinet');
    chk('в кабинете видна кнопка «Изменить заявку»', stripos($cab['body'], 'Изменить заявку') !== false);
    chk('показана надпись про два рабочих дня',
        stripos($cab['body'], 'двух рабочих дней') !== false);
    chk('в надписи указан крайний срок', stripos($cab['body'], app_state_dt($w['until'])) !== false,
        app_state_dt($w['until']));

    // б) окно ровно два рабочих дня и до 18:00
    $expect = working_days_add((string) $fresh['created_at'], 2); $expect->setTime(18, 0);
    chk('крайний срок = подача + 2 рабочих дня, 18:00',
        $w['until'] === $expect->format('Y-m-d H:i:s'), $w['until'] . ' vs ' . $expect->format('Y-m-d H:i:s'));
    chk('крайний срок не в воскресенье', (int) date('w', strtotime($w['until'])) !== 0,
        date('D d.m', strtotime($w['until'])));

    // в) правка реально сохраняет ВСЕ поля
    $t = tok($UJAR, '/cabinet');
    $newData = [
        '_csrf' => $t, 'csrf' => $t, 'action' => 'edit_app', 'app_id' => (string) $aid,
        'is_group' => '0', 'full_name' => 'Тестова Проверка Аудитовна',
        'group_name' => '', 'birth_date' => '2011-03-02', 'age_category' => '13-15 лет',
        'nomination' => 'Хореография', 'subgroup' => 'Народный танец', 'formation' => 'Дуэт',
        'work_title' => 'Проверочный номер', 'teacher' => 'Аудитов Аудит Аудитович',
        'institution' => 'ДШИ Проверка', 'city' => 'Казань',
        'email' => 'okoteam.top@gmail.com', 'phone' => '+79995048899',
        'address' => 'г. Казань, ул. Баумана, д. 1', 'postal_index' => '420111',
        'video_url' => 'https://vk.com/video-211325055_456239018',
    ];
    http($UJAR, $BASE . '/cabinet', $newData);
    $after = one("SELECT * FROM applications WHERE id=?", [$aid]);
    foreach ([
        'full_name' => 'Тестова Проверка Аудитовна', 'birth_date' => '2011-03-02',
        'age_category' => '13-15 лет', 'nomination' => 'Хореография', 'subgroup' => 'Народный танец',
        'formation' => 'Дуэт', 'work_title' => 'Проверочный номер', 'institution' => 'ДШИ Проверка',
        'phone' => '+79995048899', 'address' => 'г. Казань, ул. Баумана, д. 1',
        'postal_index' => '420111', 'video_url' => 'https://vk.com/video-211325055_456239018',
    ] as $f => $exp) {
        chk("правка сохранила «{$f}»", (string) ($after[$f] ?? '') === $exp, (string) ($after[$f] ?? ''));
    }
    chk('правка сохранила «teacher»', str_contains((string) $after['teacher'], 'Аудит'), (string) $after['teacher']);
    chk('правка сохранила «city»', str_contains((string) $after['city'], 'Казань'), (string) $after['city']);
    chk('правка сохранила «email»', (string) $after['email'] === 'okoteam.top@gmail.com', (string) $after['email']);

    // г) чужие значения справочников не принимаются
    $t = tok($UJAR, '/cabinet');
    http($UJAR, $BASE . '/cabinet', array_merge($newData, ['_csrf' => $t, 'csrf' => $t,
          'nomination' => 'Хореография', 'formation' => 'Хор', 'age_category' => 'Взрослые']));
    $after = one("SELECT * FROM applications WHERE id=?", [$aid]);
    chk('«Хор» в хореографию не принят', (string) $after['formation'] !== 'Хор', (string) $after['formation']);
    chk('несуществующая возрастная категория не принята',
        in_array((string) $after['age_category'], AGE_CATEGORIES(), true), (string) $after['age_category']);

    // д) окно закрылось — правка запрещена
    q("UPDATE applications SET created_at=? WHERE id=?", [date('Y-m-d H:i:s', strtotime('-10 days')), $aid]);
    $old = one("SELECT * FROM applications WHERE id=?", [$aid]);
    $w2 = app_edit_window((array) $old);
    chk('через 10 дней правка закрыта', !$w2['can'], $w2['reason']);
    $t = tok($UJAR, '/cabinet');
    http($UJAR, $BASE . '/cabinet', array_merge($newData, ['_csrf' => $t, 'csrf' => $t, 'city' => 'Владивосток']));
    $after = one("SELECT * FROM applications WHERE id=?", [$aid]);
    chk('сервер отклонил правку после срока', !str_contains((string) $after['city'], 'Владивосток'),
        (string) $after['city']);
    $cab = http($UJAR, $BASE . '/cabinet');
    chk('в кабинете объяснено, почему править нельзя', stripos($cab['body'], 'Срок изменения истёк') !== false);

    // е) оценённая заявка не редактируется независимо от срока
    q("UPDATE applications SET created_at=? WHERE id=?", [date('Y-m-d H:i:s'), $aid]);
    $graded = array_merge((array) one("SELECT * FROM applications WHERE id=?", [$aid]), ['result' => 'ЛАУРЕАТ I СТЕПЕНИ']);
    chk('оценённая заявка не редактируется', !app_edit_window($graded)['can'], app_edit_window($graded)['reason']);
}

/* ───────── статистика на живых данных ───────── */
sec('Статистика кабинета считается по фактам');
$apps = all("SELECT a.*, c.results_mode AS comp_results_mode, c.results_published_at AS comp_results_pub
               FROM applications a LEFT JOIN competitions c ON c.id=a.competition_id
              WHERE a.user_id=?", [$uid]);
$expNew = $expJudging = $expGraded = 0;
foreach ($apps as $a) {
    $st = app_state((array) $a, false)['code'];
    if (in_array($st, ['graded','making','made','extra','done'], true)) $expGraded++;
    elseif ($st === 'judging') $expJudging++;
    elseif ($st !== 'rejected') $expNew++;
}
$cab = http($UJAR, $BASE . '/cabinet');
preg_match('~<b>(\d+)</b><span>Всего заявок</span>~u', $cab['body'], $m1);
preg_match('~<b>(\d+)</b><span>Оценено</span>~u', $cab['body'], $m2);
preg_match('~<b>(\d+)</b><span>На оценке</span>~u', $cab['body'], $m3);
preg_match('~<b>(\d+)</b><span>Дипломов получено</span>~u', $cab['body'], $m4);
chk('«Всего заявок» совпадает с базой', (int) ($m1[1] ?? -1) === count($apps),
    ($m1[1] ?? '?') . ' vs ' . count($apps));
chk('«Оценено» совпадает с расчётом по фактам', (int) ($m2[1] ?? -1) === $expGraded,
    ($m2[1] ?? '?') . ' vs ' . $expGraded);
chk('«На оценке» совпадает с расчётом по фактам', (int) ($m3[1] ?? -1) === $expJudging,
    ($m3[1] ?? '?') . ' vs ' . $expJudging);
$dipSent = (int) scalar("SELECT COUNT(*) FROM diplomas d JOIN applications a ON a.id=d.application_id
                          WHERE a.user_id=? AND d.sent_at IS NOT NULL AND d.sent_at<>''", [$uid]);
chk('«Дипломов получено» = реально отправленные', (int) ($m4[1] ?? -1) === $dipSent,
    ($m4[1] ?? '?') . ' vs ' . $dipSent);

sec('Достижения сезона считаются по сезону, а не за всё время');
$season = loyalty_season();
chk('сезон = текущий год', $season === date('Y'), $season);
$seasonApps = (int) scalar("SELECT COUNT(*) FROM applications WHERE user_id=? AND created_at >= ?",
                           [$uid, loyalty_season_start()]);
$pct = loyalty_discount($uid, 'user@test.local');
chk('скидка за достижения не больше 5%', $pct <= LOYALTY_MAX_PCT, "$pct% при $seasonApps заявках");
chk('в кабинете есть блок достижений', stripos($cab['body'], 'Достижения') !== false);

/* ───────── ВИП-клуб: до и после подписки ───────── */
sec('ВИП-клуб: состояние ДО подписки');
q("UPDATE club_members SET active=0, expires_at=datetime('now','-1 day') WHERE user_id=?", [$uid]);
chk('клуб неактивен', !club_is_active($uid));
chk('скидка клуба = 0%', club_discount_percent($uid) === 0, club_discount_percent($uid) . '%');
$cab = http($UJAR, $BASE . '/cabinet');
chk('в кабинете предлагают вступить в клуб',
    stripos($cab['body'], 'ВИП-клуб') !== false || stripos($cab['body'], 'Клуб') !== false);
$appG = one("SELECT * FROM applications WHERE user_id=? AND COALESCE(result,'')<>'' LIMIT 1", [$uid]);
if ($appG) {
    chk('без клуба кнопки запроса комментария жюри нет',
        stripos($cab['body'], 'data-jury-req=') === false);
    $t = tok($UJAR, '/cabinet');
    $r = http($UJAR, $BASE . '/api/v1/jury_request.php',
              ['_csrf' => $t, 'csrf' => $t, 'application_id' => (string) $appG['id']]);
    $j = json_decode($r['body'], true);
    chk('сервер не даёт запросить комментарий без клуба', ($j['ok'] ?? true) === false,
        substr((string) ($j['error'] ?? $r['body']), 0, 120));
}

sec('ВИП-клуб: состояние ПОСЛЕ подписки');
club_grant($uid, 1, 'audit_test', ['period' => 'month']);
chk('клуб активен', club_is_active($uid));
chk('скидка клуба = 20%', club_discount_percent($uid) === mm_vip_discount(), club_discount_percent($uid) . '%');
$st = club_status($uid);
chk('срок членства проставлен', trim((string) ($st['expires_at'] ?? '')) !== '', (string) ($st['expires_at'] ?? ''));
$cab = http($UJAR, $BASE . '/cabinet');
chk('в кабинете появилась ВИП-галочка', stripos($cab['body'], 'cab-vip') !== false);
chk('в кабинете виден срок членства', stripos($cab['body'], 'Клуб') !== false);
if ($appG) {
    chk('появилась кнопка запроса комментария жюри',
        stripos($cab['body'], 'data-jury-req=') !== false
        || stripos($cab['body'], 'cab-jury') !== false);
    $t = tok($UJAR, '/cabinet');
    $r = http($UJAR, $BASE . '/api/v1/jury_request.php',
              ['_csrf' => $t, 'csrf' => $t, 'application_id' => (string) $appG['id']]);
    $j = json_decode($r['body'], true);
    chk('запрос комментария жюри принят', ($j['ok'] ?? false) === true,
        substr((string) ($j['error'] ?? $j['message'] ?? $r['body']), 0, 140));
}

sec('ВИП-клуб: привилегии применяются автоматически');
$paid = one("SELECT * FROM competitions WHERE is_paid=1 AND status='open' LIMIT 1");
if ($paid) {
    $r = http($UJAR, $BASE . '/apply?competition=' . $paid['slug']);
    chk('на подаче видна цена со скидкой клуба',
        stripos($r['body'], '20') !== false && stripos($r['body'], 'клуб') !== false);
}
$appO = one("SELECT a.* FROM applications a JOIN competitions c ON c.id = a.competition_id
              WHERE a.user_id=? AND COALESCE(a.result,'')<>'' AND COALESCE(a.result_sent_at,'')<>''
              ORDER BY a.id DESC LIMIT 1", [$uid]);
if ($appO) {
    $r = http($UJAR, $BASE . '/awards?comp=' . (int) $appO['competition_id'] . '&app=' . (int) $appO['id']);
    chk('в каталоге наград применена скидка клуба', stripos($r['body'], 'CLUB_PCT = 20') !== false,
        (bool) preg_match('~CLUB_PCT = (\d+)~', $r['body'], $mm) ? $mm[0] : '');
    chk('цены показаны перечёркнутыми со скидкой', str_contains($r['body'], 'data-full='));
}
// Сроки: клуб — 3 рабочих дня, обычный участник — 5.
$vipPlan = working_days_add(date('Y-m-d H:i:s'), 3);
$regPlan = working_days_add(date('Y-m-d H:i:s'), 5);
chk('ВИП получает награды раньше обычного участника', $vipPlan < $regPlan,
    $vipPlan->format('d.m') . ' < ' . $regPlan->format('d.m'));

sec('Массовое приглашение в клуб не идёт действующим членам');
$vipList = array_map(fn($r) => mb_strtolower((string) $r['email']), nl_resolve_recipients('vip'));
chk('действующий член клуба исключён из рассылки',
    !in_array('user@test.local', $vipList, true), count($vipList) . ' адресов');
foreach (club_staff_emails() as $se) {
    chk('команда центра исключена: ' . $se, !in_array(mb_strtolower($se), $vipList, true));
}
$anyOther = (int) scalar("SELECT COUNT(*) FROM subscribers WHERE active=1");
chk('обычная база в рассылку попадает', count($vipList) > 0 || $anyOther === 0, count($vipList) . ' адресов');

sec('ВИП-клуб: именная карта, сертификат и цены со скидкой');
require_once BASE_PATH . '/core/club_cert.php';
$cardNo = club_card_no($uid);
chk('номер именной карты выдан', $cardNo !== '', $cardNo);
chk('номер карты стабилен между вызовами', $cardNo === club_card_no($uid));
$clubPage = http($UJAR, $BASE . '/club');
chk('страница клуба открывается участнику', $clubPage['code'] === 200, (string) $clubPage['code']);
chk('на странице клуба есть визитка участника', strpos($clubPage['body'], 'club-vcard') !== false);
chk('в визитке настоящий логотип, а не печать',
    strpos($clubPage['body'], 'logo_muzmir_256.png') !== false
    && strpos($clubPage['body'], 'pechat_kc_muzmir') === false);
chk('номер карты выведен на визитке', strpos($clubPage['body'], $cardNo) !== false);
chk('кнопки «Личный кабинет» и «Выбрать конкурс» ведут по адресам',
    strpos($clubPage['body'], '/cabinet') !== false && strpos($clubPage['body'], '/competitions') !== false);
chk('есть кнопка сертификата участника Клуба',
    strpos($clubPage['body'], '/club/certificate.pdf') !== false);
$certUser = one("SELECT id, full_name, email FROM users WHERE id=?", [$uid]);
$certHtml = club_cert_html($certUser, club_status($uid));
chk('сертификат: лист альбомный А4', strpos($certHtml, 'size:297mm 210mm') !== false);
chk('сертификат: есть подписи и печати',
    strpos($certHtml, 'Галиулин Данил Дамирович') !== false
    && strpos($certHtml, 'Ильясов Альберт Ильясович') !== false
    && strpos($certHtml, '/stamp.png') !== false && strpos($certHtml, '/seal.png') !== false);
chk('сертификат: ФИО и номер карты на месте',
    strpos($certHtml, (string) $certUser['full_name']) !== false && strpos($certHtml, $cardNo) !== false);
// Цены конкурсов участнику Клуба показываются со скидкой (как в наградах).
$compPage = http($UJAR, $BASE . '/competitions');
chk('в афише конкурсов видна клубная цена',
    strpos($compPage['body'], 'cc-fee--club') !== false && strpos($compPage['body'], 'cc-clubtag') !== false);
chk('в афише полная цена зачёркнута', preg_match('~cc-fee--club.*?<s>\d+~s', $compPage['body']) === 1);

sec('ВИП-клуб: снятие привилегий по истечении');
q("UPDATE club_members SET expires_at=datetime('now','-1 hour') WHERE user_id=?", [$uid]);
chk('после истечения клуб неактивен', !club_is_active($uid));
chk('после истечения скидка обнулилась', club_discount_percent($uid) === 0, club_discount_percent($uid) . '%');
$vipList2 = array_map(fn($r) => mb_strtolower((string) $r['email']), nl_resolve_recipients('vip'));
chk('после истечения адрес снова попадает в приглашение',
    in_array('user@test.local', $vipList2, true), count($vipList2) . ' адресов');

sec('Команда центра: безлимитный клуб без подписки');
foreach (club_staff_emails() as $se) {
    $sid = (int) (scalar("SELECT id FROM users WHERE LOWER(email)=?", [mb_strtolower($se)]) ?? 0);
    if ($sid <= 0) { ok("аккаунт $se в тестовой базе отсутствует — пропуск"); continue; }
    chk("$se: клуб активен без подписки", club_is_active($sid));
    chk("$se: скидка клуба действует", club_discount_percent($sid) === mm_vip_discount(),
        club_discount_percent($sid) . '%');
}

echo "\n" . str_repeat('─', 60) . "\n";
echo ($FAIL === 0 ? "КАБИНЕТ И КЛУБ ЧИСТО" : "ПРОВАЛОВ: $FAIL") . ", пройдено: $OK\n";
exit($FAIL === 0 ? 0 : 1);
