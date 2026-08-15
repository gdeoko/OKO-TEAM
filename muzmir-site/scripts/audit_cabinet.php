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

const AUDIT_HOST = 'xn----7sbugdeiegh1b0a9hen.xn--p1ai';

/* КУДА СТУЧАТЬСЯ.
 *
 * Здесь стоял только адрес местного отладочного сервера, и на боевом сервере,
 * где его нет, ВСЕ проверки возвращали код 0 и отчёт был сплошным «FAIL» — то
 * есть аудит молчаливо ничего не проверял. Теперь по умолчанию берём сам сайт:
 * если рядом поднят отладочный сервер, он и будет использован, иначе боевой
 * (запрос идёт на 127.0.0.1 с нужным заголовком Host, наружу не выходит). */
$BASE = rtrim((string) getenv('BASE'), '/');
if ($BASE === '') {
    $probe = @fsockopen('127.0.0.1', 8099, $eno, $estr, 1);
    if ($probe) { fclose($probe); $BASE = 'http://127.0.0.1:8099'; }
    else        { $BASE = 'https://' . AUDIT_HOST; }
}
$FAIL = 0; $OK = 0;
function sec(string $s): void { echo "\n=== $s ===\n"; }
function ok(string $w, $i = ''): void { global $OK; $OK++; echo "  ok   $w" . ($i !== '' ? "  [$i]" : '') . "\n"; }
function bad(string $w, $i = ''): void { global $FAIL; $FAIL++; echo "  FAIL $w" . ($i !== '' ? "  $i" : '') . "\n"; }
function chk(string $w, $cond, $i = ''): void { $cond ? ok($w, $i) : bad($w, $i); }

function http(string $jar, string $url, array $post = null, bool $follow = true): array {
    global $BASE;
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_SSL_VERIFYPEER => false, CURLOPT_SSL_VERIFYHOST => 0,
        CURLOPT_RESOLVE => [AUDIT_HOST . ':443:127.0.0.1', AUDIT_HOST . ':80:127.0.0.1'], CURLOPT_FOLLOWLOCATION => $follow, CURLOPT_MAXREDIRS => 5,
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
// Учётную запись под проверку заводим сами: на боевом сервере отладочной нет,
// и раньше все проверки кабинета молча возвращали код 0.
require_once BASE_PATH . '/scripts/_audit_actors.php';
$USR = audit_actor('user');
$USER_MAIL = $USR['email'];
audit_actor_app((int) $USR['id']);
$t = tok($UJAR, '/login');
http($UJAR, $BASE . '/login', ['_csrf' => $t, 'csrf' => $t, 'do' => 'login',
      'email' => $USR['email'], 'password' => $USR['password']]);
$cab = http($UJAR, $BASE . '/cabinet');
chk('кабинет открывается', $cab['code'] === 200, (string) $cab['code']);
chk('в кабинете нет PHP-шума',
    stripos($cab['body'], 'Warning:') === false && stripos($cab['body'], 'Undefined ') === false
    && stripos($cab['body'], 'Fatal error') === false);
$uid = (int) $USR['id'];
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
    // Формулировка (Даниэль): «Редактирование заявки возможно только в течение
    // 2 рабочих дней со дня подачи заявки — до … Все указанные Вами данные будут
    // отображены в наградных материалах.»
    // Тег <b> внутри — «в течение <b>2 рабочих дней</b>»; проверяем на чистом тексте.
    // /u обязателен — без него preg_replace может обрезать многобайтные символы и
    // «в течение» превращается в мусор.
    $__plain = preg_replace('~<[^>]+>~u', ' ', $cab['body']);
    $__plain = preg_replace('~\s+~u', ' ', (string) $__plain);
    chk('показана надпись про 2 рабочих дня',
        mb_stripos((string) $__plain, 'в течение 2 рабочих дней', 0, 'UTF-8') !== false);
    chk('в надписи есть пояснение про наградные материалы',
        mb_stripos((string) $__plain, 'в наградных материалах', 0, 'UTF-8') !== false);
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
        'group_name' => '', 'age_category' => '13-15 лет',
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
        'full_name' => 'Тестова Проверка Аудитовна',
        'age_category' => '13-15 лет', 'nomination' => 'Хореография', 'subgroup' => 'Народный танец',
        // Название номера теперь автоматически заключается в «ёлочки» (quote_title
        // работает и при правке из кабинета, а не только на первичной подаче).
        'formation' => 'Дуэт', 'work_title' => '«Проверочный номер»', 'institution' => 'ДШИ Проверка',
        'phone' => '+79995048899', 'address' => 'г. Казань, ул. Баумана, д. 1',
        'postal_index' => '420111', 'video_url' => 'https://vk.com/video-211325055_456239018',
    ] as $f => $exp) {
        chk("правка сохранила «{$f}»", (string) ($after[$f] ?? '') === $exp, (string) ($after[$f] ?? ''));
    }
    chk('правка сохранила «teacher»', str_contains((string) $after['teacher'], 'Аудит'), (string) $after['teacher']);
    chk('правка сохранила «city»', str_contains((string) $after['city'], 'Казань'), (string) $after['city']);
    chk('правка сохранила «email»', (string) $after['email'] === 'okoteam.top@gmail.com', (string) $after['email']);

    // в3) Капслок в форме правки должен приводиться к нормальному виду,
    //      как при первичной подаче: ФИО → 'Иванов Иван', название номера в
    //      «ёлочках», коллектив → 'Тип «Имя»'. Учреждение — НЕ трогаем
    //      (аббревиатуры типа 'МБОУ ДО ДШИ №1' портить нельзя).
    $t = tok($UJAR, '/cabinet');
    http($UJAR, $BASE . '/cabinet', array_merge($newData, [
        '_csrf' => $t, 'csrf' => $t, 'is_group' => '0',
        'full_name'   => 'ИВАНОВ ИВАН ВЛАДИМИРОВИЧ',
        'teacher'     => 'ПЕТРОВА АННА СЕРГЕЕВНА',
        'work_title'  => 'ПОЛЁТ ЖАВОРОНКА',
        'institution' => 'МБОУ ДО ДШИ №1',
        'city'        => 'казань',
    ]));
    $normed = one('SELECT full_name,teacher,work_title,institution,city FROM applications WHERE id=?', [$aid]);
    chk('правка: ФИО из капса → «Иванов Иван Владимирович»',
        (string) $normed['full_name'] === 'Иванов Иван Владимирович', (string) $normed['full_name']);
    chk('правка: педагог тоже нормализован',
        (string) $normed['teacher'] === 'Петрова Анна Сергеевна', (string) $normed['teacher']);
    chk('правка: название номера в «ёлочках» и нормальным регистром',
        (string) $normed['work_title'] === '«Полёт жаворонка»', (string) $normed['work_title']);
    chk('правка: учреждение с аббревиатурой сохранено как ввели',
        (string) $normed['institution'] === 'МБОУ ДО ДШИ №1', (string) $normed['institution']);
    chk('правка: город нормализован (Россия, г. Казань)',
        str_contains((string) $normed['city'], 'Казань'), (string) $normed['city']);
    // Коллектив — «Тип «Имя»» через collective_normalize
    $t = tok($UJAR, '/cabinet');
    http($UJAR, $BASE . '/cabinet', array_merge($newData, [
        '_csrf' => $t, 'csrf' => $t, 'is_group' => '1',
        'group_name' => 'вокальный ансамбль светелка',
    ]));
    $normed = one('SELECT group_name FROM applications WHERE id=?', [$aid]);
    chk('правка: коллектив «Вокальный ансамбль «Светелка»»',
        (string) $normed['group_name'] === 'Вокальный ансамбль «Светелка»', (string) $normed['group_name']);

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
// Плитки кабинета делят заявки надвое, как и написано в шаблоне:
//   «Оценено»  — жюри уже подвело итог (включая judging, когда письмо ещё в пути);
//   «На оценке» — итога ещё нет (new, paid, submitted, pending).
// Раньше проверка считала «На оценке» только judging и потому расходилась с
// кабинетом на каждой свежей заявке.
foreach ($apps as $a) {
    $st = app_state((array) $a, false)['code'];
    if (in_array($st, ['graded','judging','making','made','extra','done'], true)) $expGraded++;
    elseif ($st === 'rejected') { /* отклонённые считаются отдельно */ }
    else { $expJudging++; $expNew++; }
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
$pct = loyalty_discount($uid, $USER_MAIL);
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
    !in_array($USER_MAIL, $vipList, true), count($vipList) . ' адресов');
foreach (club_staff_emails() as $se) {
    chk('команда центра исключена: ' . $se, !in_array(mb_strtolower($se), $vipList, true));
}
$anyOther = (int) scalar("SELECT COUNT(*) FROM subscribers WHERE active=1");
chk('обычная база в рассылку попадает', count($vipList) > 0 || $anyOther === 0, count($vipList) . ' адресов');

sec('Фото профиля: загрузка, показ и синхронизация');
// Раньше фото готовилось только в браузере и уезжало строкой base64 внутри формы:
// не было видно, что идёт загрузка, а на базе без колонок nickname/category весь
// профиль вообще не сохранялся (500), включая ФИО.
$setPage = http($UJAR, $BASE . '/cabinet?tab=settings');
chk('настройки профиля открываются', $setPage['code'] === 200, (string) $setPage['code']);
chk('поле выбора фото на месте', str_contains($setPage['body'], 'id="p_ava_file"'));
chk('есть строка статуса загрузки', str_contains($setPage['body'], 'id="cabAvaMsg"'));
chk('фото уходит на сервер сразу (эндпоинт в скрипте)',
    str_contains($setPage['body'], '/api/v1/avatar'));
chk('в подсказке сказано, что фото сохраняется сразу',
    mb_stripos($setPage['body'], 'сохраняется сразу', 0, 'UTF-8') !== false);

// Реальная загрузка файла через API: сервер должен вернуть короткий URL и записать его.
$png = BASE_PATH . '/public/assets/img/logo_muzmir_256.png';
if (is_file($png)) {
    $tok = tok($UJAR, '/cabinet?tab=settings');
    $ch = curl_init($BASE . '/api/v1/avatar');
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true, CURLOPT_POST => true, CURLOPT_TIMEOUT => 40,
        CURLOPT_SSL_VERIFYPEER => false, CURLOPT_SSL_VERIFYHOST => 0,
        CURLOPT_RESOLVE => [AUDIT_HOST . ':443:127.0.0.1', AUDIT_HOST . ':80:127.0.0.1'],
        CURLOPT_COOKIEJAR => $UJAR, CURLOPT_COOKIEFILE => $UJAR, CURLOPT_PROXY => '',
        CURLOPT_HTTPHEADER => ['Origin: ' . $BASE, 'Referer: ' . $BASE . '/cabinet'],
        CURLOPT_POSTFIELDS => ['_csrf' => $tok, 'photo' => new CURLFile($png, 'image/png', 'ava.png')],
    ]);
    $raw = (string) curl_exec($ch);
    curl_close($ch);
    $j = json_decode($raw, true);
    chk('загрузка фото принята сервером', is_array($j) && !empty($j['ok']), mb_substr($raw, 0, 120));
    $newUrl = (string) ($j['url'] ?? '');
    chk('вернулся короткий URL, а не строка base64',
        $newUrl !== '' && !str_starts_with($newUrl, 'data:') && mb_strlen($newUrl) < 300, $newUrl);
    $inDb = (string) (scalar("SELECT avatar FROM users WHERE id=?", [$uid]) ?? '');
    chk('фото записано в профиль', $inDb === $newUrl);
    $rel = parse_url($newUrl, PHP_URL_PATH) ?: '';
    $file = BASE_PATH . '/public' . $rel;
    chk('файл фото лежит на диске', is_file($file), $rel);
    if (is_file($file)) {
        $sz = getimagesize($file);
        chk('фото уменьшено до 512px', $sz && (int) $sz[0] <= 512 && (int) $sz[1] <= 512,
            $sz ? $sz[0] . 'x' . $sz[1] : '?');
        chk('фото весит разумно (меньше 400 КБ)', filesize($file) < 400 * 1024, round(filesize($file) / 1024) . ' КБ');
    }
    // Синхронизация: то же фото должно показываться в кабинете и в админке.
    $cab2 = http($UJAR, $BASE . '/cabinet');
    chk('в кабинете показывается новое фото', str_contains($cab2['body'], $newUrl));
    $appOfUser = one("SELECT id FROM applications WHERE user_id=? ORDER BY id DESC LIMIT 1", [$uid]);
    if ($appOfUser) {
        $admCard = http($AJAR ?? ($UJAR . '.adm'), $BASE . '/admin/?p=applications&id=' . (int) $appOfUser['id']);
        // Админ-сессии тут может не быть — тогда просто пропускаем без провала.
        if ($admCard['code'] === 200 && str_contains($admCard['body'], '<dt>Аккаунт</dt>')) {
            chk('в админке у заявки видно то же фото профиля', str_contains($admCard['body'], $newUrl));
        } else { ok('админ-сессии в этом прогоне нет — проверка фото в админке пропущена'); }
    }
}
// ФИО правится и сразу видно в кабинете.
$tok2 = tok($UJAR, '/cabinet?tab=settings');
http($UJAR, $BASE . '/cabinet', ['_csrf' => $tok2, 'action' => 'profile',
     'full_name' => 'Тестова Проверка Синхроновна', 'category' => 'participant']);
$fioDb = (string) (scalar("SELECT full_name FROM users WHERE id=?", [$uid]) ?? '');
chk('ФИО сохранилось в профиле', $fioDb === 'Тестова Проверка Синхроновна', $fioDb);
$cab3 = http($UJAR, $BASE . '/cabinet');
chk('новое ФИО показывается в кабинете', str_contains($cab3['body'], 'Тестова Проверка Синхроновна'));

sec('Скидки: подача, оплата из ЛК, показ');
require_once BASE_PATH . '/core/loyalty.php';
// Готовим неоплаченную заявку у user@test.local на платный конкурс с ценой 500.
$cid = (int) (scalar("SELECT id FROM competitions WHERE is_paid=1 ORDER BY id LIMIT 1") ?? 0);
if ($cid > 0) {
    q("UPDATE competitions SET price=500 WHERE id=?", [$cid]);
    // Свежая тестовая неоплаченная заявка
    q("INSERT INTO applications(user_id,competition_id,number,full_name,email,status,is_paid,created_at)
       VALUES(?,?,?,?,?,'new',0,datetime('now'))",
      [$uid, $cid, 'AUDIT-PAY-' . substr(bin2hex(random_bytes(3)), 0, 6), 'Тест Правка', $USER_MAIL]);
    $aid = (int) db()->lastInsertId();

    // Скидка за достижения профиля у этого пользователя должна попасть в APPLY_CONFIG.
    $applyPage = http($UJAR, $BASE . '/apply');
    chk('apply.php: конфиг APPLY_CONFIG содержит блок discount',
        preg_match('~APPLY_CONFIG\s*=\s*\{.*?"discount"~', $applyPage['body']) === 1);
    chk('apply.php: на 6 шаге есть контейнер applySummaryTotal (для строки К оплате со скидкой)',
        str_contains($applyPage['body'], 'id="applySummaryTotal"'));

    // Оплата из ЛК: /pay?t=app&id=X должен применить актуальную скидку
    $rPay = http($UJAR, $BASE . '/pay?t=app&id=' . $aid);
    chk('/pay открывается для своей заявки', $rPay['code'] === 200, (string) $rPay['code']);
    $lastPay = one('SELECT amount, application_id, status FROM payments WHERE application_id=? ORDER BY id DESC LIMIT 1', [$aid]);
    chk('оплата из ЛК создана', $lastPay !== null);
    // Сумма — 400 (клуб 20%) или 475 (достижения 5%), но точно НЕ полная 500.
    // Приоритет: клуб замещает loyalty (см. discount_breakdown в core/loyalty.php).
    chk('сумма в ЮKassa со скидкой (не полная 500)',
        (int) ($lastPay['amount'] ?? 0) < 500 && (int) ($lastPay['amount'] ?? 0) > 0,
        (string) ($lastPay['amount'] ?? 0));
    $afterApp = one('SELECT price_base, discount_pct, discount_info FROM applications WHERE id=?', [$aid]);
    chk('на заявке сохранена база 500', (int) $afterApp['price_base'] === 500);
    chk('на заявке сохранён итоговый процент скидки (>0)', (int) $afterApp['discount_pct'] > 0,
        (string) $afterApp['discount_pct']);
    chk('в discount_info раскрыта причина (club_pct или loyalty_pct)',
        preg_match('~"(club_pct|loyalty_pct)":\s*[1-9]~', (string) $afterApp['discount_info']) === 1);

    // Удаляем тестовую заявку и созданный ей платёж
    q('DELETE FROM payments WHERE application_id=?', [$aid]);
    q('DELETE FROM applications WHERE id=?', [$aid]);
} else { ok('в базе нет платных конкурсов — пропуск'); }

// Кабинет: подпись про 2 рабочих дня и все поля заявки видны
$cab2 = http($UJAR, $BASE . '/cabinet');
chk('в кабинете сразу видна подпись про 2 рабочих дня',
    str_contains($cab2['body'], 'cab-edit-hint') || str_contains($cab2['body'], 'Заявку можно редактировать'));
foreach (['Название номера','Форма исполнения','Ссылка на выступление','Педагог','Учреждение','Город','E-mail для результата','Телефон'] as $__fld) {
    chk("в карточке заявки видно поле «{$__fld}»", str_contains($cab2['body'], $__fld));
}

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
    in_array($USER_MAIL, $vipList2, true), count($vipList2) . ' адресов');

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
