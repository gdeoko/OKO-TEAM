<?php
/**
 * СКВОЗНОЙ АУДИТ ЖИЗНЕННОГО ЦИКЛА — через РЕАЛЬНЫЕ обработчики по HTTP.
 * Жмёт те же кнопки, что и человек: подача заявки, оплата, оценка, отправка результата,
 * изготовление и отправка наград, заказ электронных и оригиналов, кабинет участника.
 *
 *   BASE=http://127.0.0.1:8099 php scripts/audit_flow.php
 *
 * Работает ТОЛЬКО на тестовом стенде (сервер должен быть поднят с MUZMIR_DB_PATH).
 * Наружу ничего не отправляет: почта уходит в очередь, ВК не трогается.
 */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { fwrite(STDERR, "CLI only\n"); exit(1); }

define('BASE_PATH', dirname(__DIR__));
$GLOBALS['CFG'] = require BASE_PATH . '/config.php';
foreach (['db','helpers','app_status','send_timing','club','orders'] as $m) require_once BASE_PATH . '/core/' . $m . '.php';
db();

$BASE = rtrim((string) (getenv('BASE') ?: 'http://127.0.0.1:8099'), '/');
$FAIL = 0; $OK = 0;
function sec(string $s): void { echo "\n=== $s ===\n"; }
function ok(string $w, $i = ''): void { global $OK; $OK++; echo "  ok   $w" . ($i !== '' ? "  [$i]" : '') . "\n"; }
function bad(string $w, $i = ''): void { global $FAIL; $FAIL++; echo "  FAIL $w" . ($i !== '' ? "  $i" : '') . "\n"; }
function chk(string $w, $cond, $i = ''): void { $cond ? ok($w, $i) : bad($w, $i); }

/** HTTP с отдельной cookie-банкой на роль (админ / участник). */
function http(string $jar, string $url, array $post = null, bool $follow = true): array {
    global $BASE;
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true, CURLOPT_FOLLOWLOCATION => $follow, CURLOPT_MAXREDIRS => 5,
        CURLOPT_COOKIEJAR => $jar, CURLOPT_COOKIEFILE => $jar, CURLOPT_TIMEOUT => 60,
        CURLOPT_HEADER => true, CURLOPT_PROXY => '',
        // API требует свой Origin/Referer (защита от межсайтовых запросов) — эмулируем браузер.
        CURLOPT_HTTPHEADER => ['Origin: ' . $BASE, 'Referer: ' . $BASE . '/', 'X-Requested-With: XMLHttpRequest'],
    ]);
    if ($post !== null) { curl_setopt($ch, CURLOPT_POST, true); curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query($post)); }
    $raw = (string) curl_exec($ch);
    $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $hlen = (int) curl_getinfo($ch, CURLINFO_HEADER_SIZE);
    curl_close($ch);
    return ['code' => $code, 'body' => substr($raw, $hlen), 'head' => substr($raw, 0, $hlen)];
}
function csrf(string $jar, string $url): string {
    global $BASE;
    $r = http($jar, $BASE . $url);
    if (preg_match('~name="_csrf"\s+value="([^"]+)"~', $r['body'], $m)) return $m[1];
    if (preg_match('~name="csrf"\s+value="([^"]+)"~', $r['body'], $m)) return $m[1];
    if (preg_match('~<meta name="csrf-token" content="([^"]+)"~', $r['body'], $m)) return $m[1];
    return '';
}
$AJAR = sys_get_temp_dir() . '/muzmir_flow_admin.txt';
$UJAR = sys_get_temp_dir() . '/muzmir_flow_user.txt';
@unlink($AJAR); @unlink($UJAR);

/* ───────────── 0. Вход админом и участником ───────────── */
sec('Вход');
$tok = csrf($AJAR, '/admin/');
$r = http($AJAR, $BASE . '/admin/', ['_csrf' => $tok, 'do' => 'login',
        'email' => getenv('ADMIN_LOGIN') ?: 'admin@test.local', 'password' => getenv('ADMIN_PASS') ?: 'Test_12345']);
chk('админ вошёл', stripos($r['body'], 'p=logout') !== false);

$tok = csrf($UJAR, '/login');
$r = http($UJAR, $BASE . '/login', ['_csrf' => $tok, 'csrf' => $tok, 'do' => 'login',
        'email' => 'user@test.local', 'password' => 'Test_12345']);
$cab = http($UJAR, $BASE . '/cabinet');
$userIn = stripos($cab['body'], 'Личный кабинет') !== false || stripos($cab['body'], 'Мои заявки') !== false;
chk('участник вошёл в кабинет', $userIn);

/* ───────────── 1. Запуск конкурсов из пульта ───────────── */
sec('Пульт запуска: гейт публикации');
$hidden = (int) scalar("SELECT COUNT(*) FROM competitions WHERE status='open' AND COALESCE(launched,0)=0");
$r = http($AJAR, $BASE . '/competitions');
chk('до запуска конкурсы на сайте не показываются',
    $hidden > 0 && stripos($r['body'], 'Мировые Таланты') === false, "не запущено: $hidden");

q("UPDATE competitions SET launched=1 WHERE status='open'");
$r = http($AJAR, $BASE . '/competitions');
chk('после запуска конкурсы появились в афише', stripos($r['body'], 'Мировые Таланты') !== false);

/* ───────────── 2. Подача заявок ───────────── */
sec('Подача заявки участником (платный и бесплатный конкурс)');
$paid = one("SELECT * FROM competitions WHERE is_paid=1 AND status='open' ORDER BY sort LIMIT 1");
$free = one("SELECT * FROM competitions WHERE is_paid=0 AND status='open' ORDER BY sort LIMIT 1");
chk('в базе есть платный конкурс', (bool) $paid, (string) ($paid['name'] ?? ''));
chk('в базе есть бесплатный конкурс', (bool) $free, (string) ($free['name'] ?? ''));

function submit_app(string $jar, array $comp, string $fio, string $title): array {
    global $BASE;
    $tok = csrf($jar, '/apply?competition=' . $comp['slug']);
    $r = http($jar, $BASE . '/api/v1/apply.php', [
        '_csrf' => $tok, 'csrf' => $tok,
        'competition_id' => (string) $comp['id'], 'competition' => (string) $comp['slug'],
        'full_name' => $fio, 'email' => 'okoteam.top@gmail.com', 'phone' => '+79995048899',
        'birth_date' => '2010-05-14', 'age_category' => '13-15 лет',
        'nomination' => 'Хореография', 'subgroup' => 'Народный танец', 'formation' => 'Соло',
        'work_title' => $title, 'teacher' => 'Петрова Анна Сергеевна',
        'institution' => 'ДШИ №1', 'city' => 'Москва',
        'video_url' => 'https://vk.com/video-211325055_456239017',
        'agree_rules' => '1', 'agree_reg' => '1', 'agree_pd' => '1',
    ]);
    $j = json_decode($r['body'], true);
    return ['code' => $r['code'], 'json' => is_array($j) ? $j : [], 'raw' => substr($r['body'], 0, 300)];
}

$a1 = submit_app($UJAR, $paid, 'Смирнова Ольга Ивановна', 'Аве Мария');
chk('заявка в платный конкурс принята', ($a1['json']['ok'] ?? false) === true,
    ($a1['json']['error'] ?? $a1['json']['message'] ?? $a1['raw']));
$a2 = submit_app($UJAR, $free, 'Кузнецов Пётр Алексеевич', 'Русский перепляс');
chk('заявка в бесплатный конкурс принята', ($a2['json']['ok'] ?? false) === true,
    ($a2['json']['error'] ?? $a2['json']['message'] ?? $a2['raw']));

$appPaid = one("SELECT * FROM applications WHERE competition_id=? ORDER BY id DESC LIMIT 1", [(int) $paid['id']]);
$appFree = one("SELECT * FROM applications WHERE competition_id=? ORDER BY id DESC LIMIT 1", [(int) $free['id']]);
chk('заявка платного сохранена в базе', (bool) $appPaid, 'id=' . ($appPaid['id'] ?? '-'));
chk('заявка бесплатного сохранена в базе', (bool) $appFree, 'id=' . ($appFree['id'] ?? '-'));
if (!$appPaid || !$appFree) { echo "\nдальше без заявок нельзя\n"; exit(1); }
$idPaid = (int) $appPaid['id']; $idFree = (int) $appFree['id'];

sec('Статусы сразу после подачи');
chk('платная заявка — Новая', app_state($appPaid)['code'] === 'new', app_state($appPaid)['label']);
chk('бесплатная заявка — Новая', app_state($appFree)['code'] === 'new', app_state($appFree)['label']);
chk('платная заявка помечена неоплаченной', (int) ($appPaid['is_paid'] ?? 0) === 0, 'is_paid=' . (int) ($appPaid['is_paid'] ?? 0));

sec('Неоплаченная платная заявка не попадает в списки и оценку');
$r = http($AJAR, $BASE . '/admin/?p=applications');
chk('«Заявки»: неоплаченной платной нет в списке', strpos($r['body'], (string) $appPaid['number']) === false,
    'номер ' . $appPaid['number']);
$r = http($AJAR, $BASE . '/admin/?p=grading');
chk('«Оценка коротких»: неоплаченной платной нет', strpos($r['body'], (string) $appPaid['number']) === false);

/* ───────────── 3. Оплата ───────────── */
sec('Оплата платной заявки');
q("UPDATE applications SET is_paid=1 WHERE id=?", [$idPaid]);
insert('payments', ['application_id' => $idPaid, 'amount' => (int) $paid['price'], 'status' => 'succeeded',
                    'method' => 'test', 'purpose' => 'application', 'created_at' => date('Y-m-d H:i:s')]);
$r = http($AJAR, $BASE . '/admin/?p=applications');
chk('после оплаты заявка появилась в «Заявках»', strpos($r['body'], (string) $appPaid['number']) !== false);
chk('в списке видна сумма оплаты', strpos($r['body'], (string) (int) $paid['price']) !== false, $paid['price'] . ' ₽');
$r = http($AJAR, $BASE . '/admin/?p=applications');
chk('бесплатная заявка помечена «Бесплатно»', stripos($r['body'], 'Бесплатно') !== false);

sec('Поиск в админке реально находит');
foreach ([['applications', 'смирнова'], ['applications', 'СМИРНОВА'], ['applications', 'Аве Мария'],
          ['grading', 'смирнова'], ['dispatch', 'смирнова']] as [$p, $q]) {
    $r = http($AJAR, $BASE . '/admin/?p=' . $p . '&q=' . rawurlencode($q));
    $found = strpos($r['body'], 'Смирнова') !== false || strpos($r['body'], (string) $appPaid['number']) !== false;
    chk("поиск в «$p» по «$q» находит заявку", $found);
}
$r = http($AJAR, $BASE . '/admin/?p=applications&q=' . rawurlencode('заведомо-нет-такого'));
chk('поиск по несуществующему даёт пустой список, а не всё подряд',
    strpos($r['body'], 'Смирнова') === false);

/* ───────────── 4. Оценка ───────────── */
sec('Оценка короткого конкурса (кнопка «Отправить сейчас»)');
$tok = csrf($AJAR, '/admin/?p=grading&id=' . $idPaid);
$r = http($AJAR, $BASE . '/admin/?p=grading', ['_csrf' => $tok, 'do' => 'grade_result', 'id' => (string) $idPaid,
        'result' => 'ЛАУРЕАТ I СТЕПЕНИ', 'extra_diploma' => 'ЗА АРТИСТИЗМ',
        'jury_comment' => 'Тестовая аттестация', 'send_now' => '1']);
$appPaid = one("SELECT * FROM applications WHERE id=?", [$idPaid]);
chk('результат сохранён', (string) $appPaid['result'] === 'ЛАУРЕАТ I СТЕПЕНИ', (string) $appPaid['result']);
chk('доп. диплом сохранён', (string) $appPaid['extra_diploma'] === 'ЗА АРТИСТИЗМ');
chk('«отправить сейчас» проставило result_sent_at', trim((string) $appPaid['result_sent_at']) !== '',
    (string) $appPaid['result_sent_at']);
chk('статус стал «Оценена»', app_state($appPaid, true)['code'] === 'graded', app_state($appPaid, true)['label']);

sec('Оценка с автосроком (5 рабочих дней от подачи)');
$a3 = submit_app($UJAR, $paid, 'Волков Илья Романович', 'Полонез');
$appAuto = one("SELECT * FROM applications WHERE competition_id=? ORDER BY id DESC LIMIT 1", [(int) $paid['id']]);
$idAuto = (int) $appAuto['id'];
q("UPDATE applications SET is_paid=1 WHERE id=?", [$idAuto]);
$tok = csrf($AJAR, '/admin/?p=grading&id=' . $idAuto);
http($AJAR, $BASE . '/admin/?p=grading', ['_csrf' => $tok, 'do' => 'grade_result', 'id' => (string) $idAuto,
        'result' => 'ДИПЛОМАНТ II СТЕПЕНИ', 'extra_diploma' => '', 'auto_send' => '1']);
$appAuto = one("SELECT * FROM applications WHERE id=?", [$idAuto]);
$planAt  = trim((string) $appAuto['result_send_at']);
chk('план отправки проставлен', $planAt !== '', $planAt);
chk('план не в прошлом', $planAt === '' || strtotime($planAt) >= time() - 60, $planAt);
chk('план попадает в рабочее окно 09:00–18:00',
    $planAt !== '' && (int) date('G', strtotime($planAt)) >= 9 && (int) date('G', strtotime($planAt)) < 18,
    $planAt !== '' ? date('H:i', strtotime($planAt)) : '');
chk('план не в воскресенье', $planAt === '' || (int) date('w', strtotime($planAt)) !== 0,
    $planAt !== '' ? date('D d.m', strtotime($planAt)) : '');
chk('до отправки статус «На оценке»', app_state($appAuto, true)['code'] === 'judging',
    app_state($appAuto, true)['label']);
chk('участник НЕ видит результат до отправки', app_state($appAuto, false)['result_sent_at'] === '');

/* ───────────── 5. Кабинет участника ───────────── */
sec('Кабинет участника: видно только то, что дошло');
$cab = http($UJAR, $BASE . '/cabinet');
chk('кабинет открывается', $cab['code'] === 200, (string) $cab['code']);
chk('в кабинете есть отправленный результат', strpos($cab['body'], 'ЛАУРЕАТ I СТЕПЕНИ') !== false);
chk('в кабинете НЕТ ещё не отправленного результата',
    strpos($cab['body'], 'ДИПЛОМАНТ II СТЕПЕНИ') === false);
chk('заявка не пропала из кабинета', strpos($cab['body'], (string) $appPaid['number']) !== false,
    (string) $appPaid['number']);
chk('в кабинете нет PHP-шума', stripos($cab['body'], 'Warning:') === false && stripos($cab['body'], 'Undefined') === false);

/* ───────────── 6. Наградные документы ───────────── */
sec('Наградные документы: план 5 рабочих дней, гейтинг в кабинете');
require_once BASE_PATH . '/core/orders.php';
$dips = all("SELECT * FROM diplomas WHERE application_id=?", [$idPaid]);
echo "  · дипломов по заявке: " . count($dips) . "\n";
if (!$dips) {
    // Дипломы создаёт cron — прогоняем его.
    exec('MUZMIR_DB_PATH=' . escapeshellarg((string) cfgv('db_path', '')) . ' php ' . escapeshellarg(BASE_PATH . '/cron/send_diplomas.php') . ' 2>&1', $o, $rc);
    $dips = all("SELECT * FROM diplomas WHERE application_id=?", [$idPaid]);
}
chk('дипломы созданы', count($dips) > 0, count($dips) . ' шт');
if ($dips) {
    $unsent = array_filter($dips, fn($d) => trim((string) ($d['sent_at'] ?? '')) === '');
    chk('дипломы запланированы, но ещё не отправлены', count($unsent) > 0, count($unsent) . ' в плане');
    $appPaid = one("SELECT * FROM applications WHERE id=?", [$idPaid]);
    chk('статус заявки — «На изготовлении»', app_state($appPaid, true)['code'] === 'making',
        app_state($appPaid, true)['label']);
    $cab = http($UJAR, $BASE . '/cabinet');
    chk('неотправленные дипломы в кабинете не показываются',
        substr_count($cab['body'], 'Скачать диплом') === 0 || strpos($cab['body'], 'придут') !== false);
}

/* ───────────── 7. Отправки: «сейчас», перенос, отмена ───────────── */
sec('Раздел «Отправки»: кнопки работают');
$r = http($AJAR, $BASE . '/admin/?p=dispatch');
chk('раздел «Отправки» открывается', $r['code'] === 200);
chk('в «Отправках» видна запланированная отправка', strpos($r['body'], (string) $appAuto['number']) !== false
    || strpos($r['body'], 'Волков') !== false);

$tok = csrf($AJAR, '/admin/?p=dispatch');
$r = http($AJAR, $BASE . '/admin/?p=dispatch', ['_csrf' => $tok, 'do' => 'resched', 'kind' => 'result',
        'id' => (string) $idAuto, 'when' => date('Y-m-d H:i', strtotime('+2 days 10:30'))]);
$appAuto = one("SELECT * FROM applications WHERE id=?", [$idAuto]);
chk('перенос отправки результата применился',
    trim((string) $appAuto['result_send_at']) !== '' && date('Y-m-d', strtotime((string) $appAuto['result_send_at'])) === date('Y-m-d', strtotime('+2 days')),
    (string) $appAuto['result_send_at']);

$tok = csrf($AJAR, '/admin/?p=dispatch');
http($AJAR, $BASE . '/admin/?p=dispatch', ['_csrf' => $tok, 'do' => 'cancel', 'kind' => 'result', 'id' => (string) $idAuto]);
$appAuto = one("SELECT * FROM applications WHERE id=?", [$idAuto]);
chk('отмена плановой отправки применилась', trim((string) $appAuto['result_send_at']) === '',
    (string) $appAuto['result_send_at']);

$tok = csrf($AJAR, '/admin/?p=dispatch');
$before = (int) scalar("SELECT COUNT(*) FROM mail_queue");
http($AJAR, $BASE . '/admin/?p=dispatch', ['_csrf' => $tok, 'do' => 'sendnow', 'kind' => 'result', 'id' => (string) $idAuto]);
$appAuto = one("SELECT * FROM applications WHERE id=?", [$idAuto]);
chk('«Сейчас» отправило результат', trim((string) $appAuto['result_sent_at']) !== '',
    (string) $appAuto['result_sent_at']);

/* ───────────── 8. Заказ наград ───────────── */
sec('Заказ наград: состав строго по результату');
$r = http($UJAR, $BASE . '/order-awards?app=' . $idPaid);
chk('форма заказа по заявке открывается', $r['code'] === 200);
chk('в форме зафиксирован результат заявки', strpos($r['body'], 'ЛАУРЕАТ I СТЕПЕНИ') !== false);
chk('лауреату не предлагается кубок', strpos($r['body'], '"Кубок||original"') === false
    && !preg_match('~Кубок[^<]{0,40}Оригинал~u', $r['body']));
chk('лауреату предлагается статуэтка', stripos($r['body'], 'Статуэтка') !== false);
chk('в платном нет электронного основного диплома',
    !preg_match('~Основной диплом \- Электронная версия~u', $r['body']));

$r = http($UJAR, $BASE . '/order-awards');
chk('заказ без заявки показывает выбор заявок, а не мёртвую форму',
    stripos($r['body'], 'Выберите заявку') !== false || stripos($r['body'], 'Оценённых заявок пока нет') !== false
    || stripos($r['body'], 'Войдите в личный кабинет') !== false);
chk('на выборе заявок нет формы оплаты', stripos($r['body'], 'Оформить заказ и перейти к оплате') === false);

sec('Заказ электронной награды: попадает в «Заказы электронных»');
$tok = csrf($UJAR, '/order-awards?app=' . $idPaid);
$r = http($UJAR, $BASE . '/api/v1/order.php', [
    '_csrf' => $tok, 'csrf' => $tok, 'application_id' => (string) $idPaid,
    'competition' => (string) $paid['slug'], 'result' => 'ЛАУРЕАТ I СТЕПЕНИ',
    'items' => json_encode([['item' => 'Именной диплом', 'kind' => 'digital']], JSON_UNESCAPED_UNICODE),
    'full_name' => 'Смирнова Ольга Ивановна', 'email' => 'okoteam.top@gmail.com', 'phone' => '+79995048899',
    'amount' => '400',
]);
$j = json_decode($r['body'], true);
chk('заказ электронного именного диплома принят', ($j['ok'] ?? false) === true,
    ($j['error'] ?? $j['message'] ?? substr($r['body'], 0, 200)));
$ord = one("SELECT * FROM awards_orders WHERE application_id=? ORDER BY id DESC LIMIT 1", [$idPaid]);
chk('заказ сохранён', (bool) $ord, 'id=' . ($ord['id'] ?? '-'));

sec('Сервер отклоняет запрещённый состав наград (подмена запроса)');
$tok = csrf($UJAR, '/order-awards?app=' . $idPaid);
$r = http($UJAR, $BASE . '/api/v1/order.php', [
    '_csrf' => $tok, 'csrf' => $tok, 'application_id' => (string) $idPaid,
    'competition' => (string) $paid['slug'], 'result' => 'ГРАН-ПРИ',
    'items' => json_encode([['item' => 'Кубок', 'kind' => 'original']], JSON_UNESCAPED_UNICODE),
    'full_name' => 'Смирнова Ольга Ивановна', 'email' => 'okoteam.top@gmail.com', 'phone' => '+79995048899',
    'address' => 'г. Москва, ул. Солянка, д. 14', 'amount' => '1000',
]);
$j = json_decode($r['body'], true);
chk('кубок лауреату отклонён сервером', ($j['ok'] ?? true) === false,
    substr((string) ($j['error'] ?? $r['body']), 0, 160));

$tok = csrf($UJAR, '/order-awards?app=' . $idPaid);
$r = http($UJAR, $BASE . '/api/v1/order.php', [
    '_csrf' => $tok, 'csrf' => $tok, 'application_id' => (string) $idPaid,
    'competition' => (string) $paid['slug'],
    'items' => json_encode([['item' => 'Основной диплом', 'kind' => 'digital']], JSON_UNESCAPED_UNICODE),
    'full_name' => 'Смирнова Ольга Ивановна', 'email' => 'okoteam.top@gmail.com', 'phone' => '+79995048899',
    'amount' => '400',
]);
$j = json_decode($r['body'], true);
chk('электронный основной в платном отклонён сервером', ($j['ok'] ?? true) === false,
    substr((string) ($j['error'] ?? $r['body']), 0, 160));

/* ───────────── 9. Длинный бесплатный конкурс ───────────── */
sec('Длинный бесплатный конкурс: итоги пакетом 28-го');
$tok = csrf($AJAR, '/admin/?p=grading&id=' . $idFree);
http($AJAR, $BASE . '/admin/?p=grading', ['_csrf' => $tok, 'do' => 'grade_result', 'id' => (string) $idFree,
        'result' => 'ГРАН-ПРИ', 'extra_diploma' => '', 'send_now' => '1']);
$appFree = one("SELECT * FROM applications WHERE id=?", [$idFree]);
chk('результат длинного сохранён', (string) $appFree['result'] === 'ГРАН-ПРИ');
chk('письмо-результат по длинному НЕ ушло сразу', trim((string) $appFree['result_sent_at']) === '',
    (string) $appFree['result_sent_at']);
$appFreeFull = one("SELECT a.*, c.results_mode AS comp_results_mode, c.results_published_at AS comp_results_pub
                      FROM applications a LEFT JOIN competitions c ON c.id=a.competition_id WHERE a.id=?", [$idFree]);
chk('участник не видит результат до публикации', app_state($appFreeFull, false)['result'] === ''
    || app_state($appFreeFull, false)['code'] === 'new', app_state($appFreeFull, false)['label']);
$cab = http($UJAR, $BASE . '/cabinet');
chk('в кабинете нет результата длинного до публикации', strpos($cab['body'], 'ГРАН-ПРИ') === false);

q("UPDATE competitions SET results_published_at=? WHERE id=?", [date('Y-m-d H:i:s'), (int) $free['id']]);
$appFreeFull = one("SELECT a.*, c.results_mode AS comp_results_mode, c.results_published_at AS comp_results_pub
                      FROM applications a LEFT JOIN competitions c ON c.id=a.competition_id WHERE a.id=?", [$idFree]);
chk('после публикации участник видит результат',
    app_state($appFreeFull, false)['result'] === 'ГРАН-ПРИ', app_state($appFreeFull, false)['label']);

sec('Бесплатный конкурс: награды только по заказу');
$dipFree = (int) scalar("SELECT COUNT(*) FROM diplomas WHERE application_id=?", [$idFree]);
chk('в бесплатном дипломы сами не создаются', $dipFree === 0, "$dipFree шт");
$r = http($UJAR, $BASE . '/order-awards?app=' . $idFree);
chk('в бесплатном заказ наград открыт', $r['code'] === 200 && stripos($r['body'], 'ГРАН-ПРИ') !== false);
chk('гран-при предлагается кубок', stripos($r['body'], 'Кубок') !== false);
chk('в бесплатном доступен электронный основной диплом',
    (bool) preg_match('~Основной диплом[^<]{0,40}Электронная~u', $r['body']));

/* ───────────── 10. Почта: пулы и очередь ───────────── */
sec('Почта: письма легли в очередь с правильным пулом');
require_once BASE_PATH . '/core/mailer.php';
$rows = all("SELECT id, subject, priority FROM mail_queue ORDER BY id DESC LIMIT 20");
chk('очередь пополняется', count($rows) > 0, count($rows) . ' писем');
foreach ($rows as $mq) {
    $pool = mail_pool_for($mq);
    $chain = mail_pool_names($pool);
    if ($pool === 'bulk' && (in_array('main', $chain, true) || in_array('nagradi', $chain, true))) {
        bad('массовое письмо попало в личный ящик', (string) $mq['subject']);
    }
}
ok('ни одно массовое письмо не ушло бы с личных ящиков');

echo "\n" . str_repeat('─', 60) . "\n";
echo ($FAIL === 0 ? "СКВОЗНОЙ ПРОГОН ЧИСТ" : "ПРОВАЛОВ: $FAIL") . ", пройдено: $OK\n";
exit($FAIL === 0 ? 0 : 1);
