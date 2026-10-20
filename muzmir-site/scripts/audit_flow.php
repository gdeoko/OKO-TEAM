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
foreach (['db','helpers','app_status','send_timing','club','orders','club_free'] as $m) require_once BASE_PATH . '/core/' . $m . '.php';
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

/** HTTP с отдельной cookie-банкой на роль (админ / участник). */
function http(string $jar, string $url, array $post = null, bool $follow = true): array {
    global $BASE;
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_SSL_VERIFYPEER => false, CURLOPT_SSL_VERIFYHOST => 0,
        CURLOPT_RESOLVE => [AUDIT_HOST . ':443:127.0.0.1', AUDIT_HOST . ':80:127.0.0.1'], CURLOPT_FOLLOWLOCATION => $follow, CURLOPT_MAXREDIRS => 5,
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
    // «Отправки» отдают токен только в JS-переменной — кнопки там работают через fetch.
    if (preg_match('~var CSRF = "([^"]+)"~', $r['body'], $m)) return $m[1];
    return '';
}
$AJAR = sys_get_temp_dir() . '/muzmir_flow_admin.txt';
$UJAR = sys_get_temp_dir() . '/muzmir_flow_user.txt';
@unlink($AJAR); @unlink($UJAR);

/* ───────────── 0. Вход админом и участником ───────────── */
sec('Вход');
$tok = csrf($AJAR, '/admin/');
// Учётные записи под проверку заводим сами: отладочных на боевом сервере нет.
require_once BASE_PATH . '/scripts/_audit_actors.php';
$ADM = audit_actor('admin');
$USR = audit_actor('user');
$r = http($AJAR, $BASE . '/admin/', ['_csrf' => $tok, 'do' => 'login',
        'email' => getenv('ADMIN_LOGIN') ?: $ADM['email'], 'password' => getenv('ADMIN_PASS') ?: $ADM['password']]);
chk('админ вошёл', stripos($r['body'], 'p=logout') !== false);

$tok = csrf($UJAR, '/login');
$r = http($UJAR, $BASE . '/login', ['_csrf' => $tok, 'csrf' => $tok, 'do' => 'login',
        'email' => $USR['email'], 'password' => $USR['password']]);
$cab = http($UJAR, $BASE . '/cabinet');
$userIn = stripos($cab['body'], 'Личный кабинет') !== false || stripos($cab['body'], 'Мои заявки') !== false;
chk('участник вошёл в кабинет', $userIn);

/* ───────────── 1. Запуск конкурсов из пульта ───────────── */
sec('Пульт запуска: гейт публикации');
// Прогон должен быть повторяемым: возвращаем стенд в «до запуска» и снимаем
// счётчики частоты (иначе повторный прогон упирается в защиту от флуда заявками).
/* КОНКУРСЫ ВОЗВРАЩАЕМ В ИСХОДНЫЙ ВИД ПРИ ЛЮБОМ ИСХОДЕ.
 *
 * Проверка сбрасывает признак «запущен» и открывает раздел итогов, чтобы увидеть
 * поведение сайта до и после публикации. Раньше она этого не возвращала: раздел
 * аттестационных результатов «Величия России» остался открытым за тринадцать дней
 * до срока, а признак запуска был сбит у всех открытых конкурсов. */
$GLOBALS['__compSnapshot'] = all("SELECT * FROM competitions");
register_shutdown_function(static function (): void {
    foreach ($GLOBALS['__compSnapshot'] ?? [] as $row) {
        $id = (int) $row['id'];
        unset($row['id']);
        try { update('competitions', $row, 'id=:id', ['id' => $id]); } catch (\Throwable $e) {}
    }
});
q("UPDATE competitions SET launched=0, results_published_at=NULL WHERE status='open'");
try { q("DELETE FROM rate_limit"); } catch (\Throwable $e) {}
$hidden = (int) scalar("SELECT COUNT(*) FROM competitions WHERE status='open' AND COALESCE(launched,0)=0");
$r = http($AJAR, $BASE . '/competitions');
chk('до запуска конкурсы на сайте не показываются',
    $hidden > 0 && stripos($r['body'], 'Мировые Таланты') === false, "не запущено: $hidden");

q("UPDATE competitions SET launched=1 WHERE status='open'");
$r = http($AJAR, $BASE . '/competitions');
/* ЖДЁМ ЖИВОЙ КОНКУРС, А НЕ ВПИСАННОЕ ИМЯ. Здесь стояло «Мировые Таланты» -
   конкурс, закрытый с 25.08.2026: с витрины он снят по правилу 49, и проверка
   краснела на правильной работе сайта. Мерка, которая ждёт вчерашнее значение,
   ломается ровно в день правки (правило 61). */
$__жив = one("SELECT name FROM competitions WHERE status='open' AND COALESCE(launched,0)=1
               AND (end_date IS NULL OR end_date='' OR date(end_date) >= date('now','localtime'))
             ORDER BY id DESC LIMIT 1");
chk('после запуска конкурсы появились в афише',
    $__жив && stripos($r['body'], (string) $__жив['name']) !== false,
    (string) ($__жив['name'] ?? 'идущих конкурсов нет'));

/* ───────────── 2. Подача заявок ───────────── */
sec('Подача заявки участником (платный и бесплатный конкурс)');
/* ПЛАТНЫЙ КОНКУРС БЕРЁМ ОТКРЫТЫЙ ВСЕМ, ЕСЛИ ТАКОЙ ЕСТЬ.
   С 16.10.2026 платный конкурс может принимать заявки только от членов Клуба
   (правило 72), и прогон от обычного участника упёрся бы в этот заслон на самой
   первой подаче - то есть восемьдесят проверок платного пути не выполнились бы
   вовсе. Порядок отбора ставит открытый всем первым, а если открытых всем нет,
   ниже заводится членство. */
$paid = one("SELECT * FROM competitions WHERE is_paid=1 AND status='open'
          ORDER BY COALESCE(club_entry_only,0), COALESCE(club_only,0), sort LIMIT 1");
$free = one("SELECT * FROM competitions WHERE is_paid=0 AND status='open' ORDER BY sort LIMIT 1");
chk('в базе есть платный конкурс', (bool) $paid, (string) ($paid['name'] ?? ''));
chk('в базе есть бесплатный конкурс', (bool) $free, (string) ($free['name'] ?? ''));

/* ПРИЁМ ТОЛЬКО ДЛЯ ЧЛЕНОВ КЛУБА: ЗАВОДИМ ЧЛЕНСТВО И ЗАНИМАЕМ СЛОТЫ ЛЬГОТЫ.
 *
 * Членства мало. У члена Клуба первые три заявки месяца принимаются БЕЗ
 * оргвзноса (правила 64, 65), и дверь применяет льготу сама: заявка выходит
 * оплаченной (`is_paid=1`, `club_free=1`), а дальше проверяется ПЛАТНЫЙ путь -
 * «заявка помечена неоплаченной», оплата, появление в списках. Поэтому слоты
 * месяца занимаем заранее, записями самого ВРЕМЕННОГО участника: живых заявок
 * это не касается, счёт льготы идёт по человеку и месяцу.
 *
 * Членство и эти записи убираются при любом исходе (_audit_actors.php). */
if ($paid && club_vhod_tolko_chlenam($paid)) {
    insert('club_members', [
        'user_id' => (int) $USR['id'], 'started_at' => date('Y-m-d H:i:s'),
        'expires_at' => date('Y-m-d H:i:s', strtotime('+1 month')),
        'source' => 'audit', 'active' => 1, 'period' => 'month', 'auto_renew' => 0,
    ]);
    chk('членство временному участнику выдано', club_is_active((int) $USR['id']),
        (string) ($paid['name'] ?? ''));
    for ($__i = 0; $__i < club_free_limit(); $__i++) {
        audit_actor_app((int) $USR['id'], [
            'competition_id' => (int) $paid['id'], 'club_free' => 1,
            'is_paid' => 1, 'amount_paid' => 0,
        ]);
    }
    chk('слоты льготы Клуба заняты, платный путь проверяется деньгами',
        club_free_left((int) $USR['id']) === 0, 'осталось ' . club_free_left((int) $USR['id']));
}

/**
 * ЗАЯВКА ПРОВЕРКИ ПОДАЁТСЯ ОТ ВРЕМЕННОГО УЧАСТНИКА, А НЕ ОТ ПОЧТЫ ЦЕНТРА.
 *
 * Здесь стояла okoteam.top@gmail.com — рабочая почта оргкомитета. Заявка
 * привязывалась к настоящей учётной записи центра, оставалась в базе навсегда
 * (проверка её не удаляла) и светилась в списках админки золотой галочкой
 * оргкомитета: владелец увидел «участницу», которая никакого членства не покупала.
 * Теперь заявки подаются от временного участника и удаляются после проверки.
 */
/* ССЫЛКА НА ВИДЕО В ЦЕНТРЕ УНИКАЛЬНА (core/link_unique.php), И ПРОВЕРКА ОБ ЭТО
   СПОТЫКАЛАСЬ. Здесь стоял ОДИН вписанный адрес на все подачи: первая заявка
   проходила, а вторая в тот же конкурс отбивалась как дубль ссылки. Из-за этого
   заявка с автосроком не создавалась, `$idAuto` оставался нулём, и дальше
   проверка падала насмерть - то есть всё после оценки не проверялось вовсе.
   Берём настоящие записи своего сообщества, по одной на подачу. */
function flow_video(): string {
    static $пул = [
        'https://vk.com/video-211325055_456239810',
        'https://vk.com/video-211325055_456239541',
        'https://vk.com/video-211325055_456239540',
        'https://vk.com/video-211325055_456239537',
        'https://vk.com/video-211325055_456239536',
        'https://vk.com/video-211325055_456239519',
        'https://vk.com/video-211325055_456239499',
        'https://vk.com/video-211325055_456239496',
    ];
    static $i = 0;
    $u = $пул[$i % count($пул)];
    $i++;
    return $u;
}

function submit_app(string $jar, array $comp, string $fio, string $title, string $group = ''): array {
    global $BASE, $USR;
    $tok = csrf($jar, '/apply?competition=' . $comp['slug']);
    /* КОЛЛЕКТИВ ПОДАЁТСЯ ОТДЕЛЬНЫМ ПРИЗНАКОМ. Именной диплом положен ТОЛЬКО
       участнику коллектива (слово владельца 15.10.2026, правило 30), и проверить
       его заказ на заявке СОЛИСТА нельзя: сервер такую позицию и не должен
       пропускать. У заявки коллектива сервер очищает ФИО и держит имя в
       `group_name` - поэтому и ищем её ниже по названию коллектива. */
    $r = http($jar, $BASE . '/api/v1/apply.php', [
        '_csrf' => $tok, 'csrf' => $tok,
        'competition_id' => (string) $comp['id'], 'competition' => (string) $comp['slug'],
        'is_group' => $group !== '' ? '1' : '0', 'group_name' => $group,
        'full_name' => $fio, 'email' => (string) $USR['email'], 'phone' => '+79995048899',
        'age_category' => '13-15 лет',
        'nomination' => 'Хореография', 'subgroup' => 'Народный танец', 'formation' => 'Соло',
        'work_title' => $title, 'teacher' => 'Петрова Анна Сергеевна',
        'institution' => 'ДШИ №1', 'city' => 'Москва',
        'video_url' => flow_video(),
        'agree_rules' => '1', 'agree_reg' => '1', 'agree_pd' => '1',
    ]);
    $j = json_decode($r['body'], true);
    // Запоминаем, что создали: удалим в конце, чем бы проверка ни кончилась. И
    // возвращаем НОМЕР СОЗДАННОЙ ЗАЯВКИ. Без него дальше бралась «последняя заявка
    // конкурса», и если подача не прошла, проверка оценивала и рассылала результат
    // по заявке ЖИВОГО участника: человек получал письмо с оценкой, которой жюри
    // ему не ставило.
    $made = $group !== ''
        ? one("SELECT id FROM applications WHERE competition_id=? AND group_name LIKE ? ORDER BY id DESC LIMIT 1",
              [(int) $comp['id'], '%' . mb_substr($group, 0, 20) . '%'])
        : one("SELECT id FROM applications WHERE competition_id=? AND full_name=? ORDER BY id DESC LIMIT 1",
              [(int) $comp['id'], $fio]);
    $newId = 0;
    if ($made && ($j['ok'] ?? false) === true) {
        $newId = (int) $made['id'];
        $GLOBALS['__audit_apps'][] = $newId;
    }
    return ['code' => $r['code'], 'json' => is_array($j) ? $j : [],
            'raw' => substr($r['body'], 0, 300), 'id' => $newId];
}

$a1 = submit_app($UJAR, $paid, 'Смирнова Ольга Ивановна', 'Аве Мария');
chk('заявка в платный конкурс принята', ($a1['json']['ok'] ?? false) === true,
    ($a1['json']['error'] ?? $a1['json']['message'] ?? $a1['raw']));
$a2 = submit_app($UJAR, $free, 'Кузнецов Пётр Алексеевич', 'Русский перепляс');
chk('заявка в бесплатный конкурс принята', ($a2['json']['ok'] ?? false) === true,
    ($a2['json']['error'] ?? $a2['json']['message'] ?? $a2['raw']));

// Берём ИМЕННО СВОИ заявки по возвращённому номеру. Здесь стояла «последняя
// заявка конкурса»: если подача не проходила, дальше оценивалась и рассылалась
// заявка живого участника.
$idPaid = (int) ($a1['id'] ?? 0);
$idFree = (int) ($a2['id'] ?? 0);
$appPaid = $idPaid ? one("SELECT * FROM applications WHERE id=?", [$idPaid]) : null;
$appFree = $idFree ? one("SELECT * FROM applications WHERE id=?", [$idFree]) : null;
chk('заявка платного сохранена в базе', (bool) $appPaid, 'id=' . ($appPaid['id'] ?? '-'));
chk('заявка бесплатного сохранена в базе', (bool) $appFree, 'id=' . ($appFree['id'] ?? '-'));
if (!$appPaid || !$appFree) { echo "\nсвои заявки не создались — дальше не идём, чужие не трогаем\n"; exit(1); }

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
/* СУММУ ИЩЕМ В ТОМ ВИДЕ, В КАКОМ ЕЁ ПЕЧАТАЮТ. Проверка искала «1000», а админка
   пишет «1 000 ₽» через пробел-разделитель разрядов - красное было в мерке. */
$__сум = (int) $paid['price'];
chk('в списке видна сумма оплаты',
    strpos($r['body'], number_format($__сум, 0, '.', ' ')) !== false
    || strpos($r['body'], number_format($__сум, 0, '.', ' ')) !== false
    || strpos($r['body'], (string) $__сум) !== false,
    number_format($__сум, 0, '.', ' ') . ' ₽');
$r = http($AJAR, $BASE . '/admin/?p=applications');
chk('бесплатная заявка помечена «Бесплатно»', stripos($r['body'], 'Бесплатно') !== false);

sec('Поиск в админке реально находит');
foreach ([['applications', 'смирнова'], ['applications', 'СМИРНОВА'], ['applications', 'Аве Мария'],
          ['grading', 'смирнова']] as [$p, $q]) {
    $r = http($AJAR, $BASE . '/admin/?p=' . $p . '&q=' . rawurlencode($q));
    $found = strpos($r['body'], 'Смирнова') !== false || strpos($r['body'], (string) $appPaid['number']) !== false;
    chk("поиск в «{$p}» по «{$q}» находит заявку", $found);
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
$idAuto = (int) ($a3['id'] ?? 0);
if (!$idAuto) { echo "\nсвоя заявка не создалась — оценку пропускаем, чужие не трогаем\n"; }
$appAuto = $idAuto ? one("SELECT * FROM applications WHERE id=?", [$idAuto]) : null;
if (!$appAuto) { $appAuto = ['id' => 0, 'result_send_at' => '', 'result' => '']; }
q("UPDATE applications SET is_paid=1 WHERE id=?", [$idAuto]);
$tok = csrf($AJAR, '/admin/?p=grading&id=' . $idAuto);
http($AJAR, $BASE . '/admin/?p=grading', ['_csrf' => $tok, 'do' => 'grade_result', 'id' => (string) $idAuto,
        'result' => 'ДИПЛОМАНТ II СТЕПЕНИ', 'extra_diploma' => '', 'auto_send' => '1']);
/* Повторное чтение без охраны и убивало проверку: при `$idAuto = 0` сюда
   приходил null, и `app_state(null)` валил скрипт насмерть. Охрана выше (строкой
   239) была, а здесь её не было - значит её не было вовсе. */
$appAuto = $idAuto ? one("SELECT * FROM applications WHERE id=?", [$idAuto]) : null;
if (!$appAuto) {
    bad('заявка с автосроком не создалась - блок оценки с автосроком пропущен');
    $appAuto = ['id' => 0, 'number' => '', 'result_send_at' => '', 'result' => '',
                'result_sent_at' => '', 'status' => 'new'];
}
$planAt  = trim((string) $appAuto['result_send_at']);
chk('план отправки проставлен', $planAt !== '', $planAt);
chk('план не в прошлом', $planAt === '' || strtotime($planAt) >= time() - 60, $planAt);
chk('план попадает в рабочее окно 09:00–18:00',
    $planAt !== '' && (int) date('G', strtotime($planAt)) >= 9 && (int) date('G', strtotime($planAt)) < 18,
    $planAt !== '' ? date('H:i', strtotime($planAt)) : '');
chk('план не в воскресенье', $planAt === '' || (int) date('w', strtotime($planAt)) !== 0,
    $planAt !== '' ? date('D d.m', strtotime($planAt)) : '');
// Смотрим ГЛАЗАМИ УЧАСТНИКА (второй аргумент — «для админки»): в админке заявка
// становится «Оценена» сразу после оценки, а участник до ухода письма обязан
// видеть «На оценке». Проверка передавала сюда админский взгляд и потому
// требовала от него невозможного.
chk('до отправки участник видит «На оценке»', app_state($appAuto, false)['code'] === 'judging',
    app_state($appAuto, true)['label']);
chk('участник НЕ видит результат до отправки', app_state($appAuto, false)['result_sent_at'] === '');

/* ───────────── 5. Кабинет участника ───────────── */
sec('Кабинет участника: видно только то, что дошло');
$cab = http($UJAR, $BASE . '/cabinet');
chk('кабинет открывается', $cab['code'] === 200, (string) $cab['code']);
chk('в кабинете есть отправленный результат', strpos($cab['body'], 'ЛАУРЕАТ I СТЕПЕНИ') !== false);
// Проверяем именно НАШУ заявку: строка звания может встречаться и у старых заявок,
// по которым результат уже дошёл.
$posAuto = strpos($cab['body'], (string) $appAuto['number']);
$cardAuto = $posAuto !== false ? substr($cab['body'], $posAuto, 3000) : '';
chk('в кабинете НЕТ ещё не отправленного результата',
    $cardAuto !== '' && strpos($cardAuto, 'ДИПЛОМАНТ II СТЕПЕНИ') === false,
    $cardAuto === '' ? 'карточка заявки не найдена' : '');
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
$r = http($AJAR, $BASE . '/admin/?p=dispatch', ['ajax' => '1', '_csrf' => $tok, 'do' => 'resched', 'kind' => 'result',
        'id' => (string) $idAuto, 'scheduled_at' => date('Y-m-d H:i', strtotime('+2 days 10:30'))]);
$appAuto = one("SELECT * FROM applications WHERE id=?", [$idAuto]);
chk('перенос отправки результата применился',
    trim((string) $appAuto['result_send_at']) !== '' && date('Y-m-d', strtotime((string) $appAuto['result_send_at'])) === date('Y-m-d', strtotime('+2 days')),
    (string) $appAuto['result_send_at'] . ' | ответ: ' . substr($r['body'], 0, 120));

$tok = csrf($AJAR, '/admin/?p=dispatch');
http($AJAR, $BASE . '/admin/?p=dispatch', ['ajax' => '1', '_csrf' => $tok, 'do' => 'cancel', 'kind' => 'result', 'id' => (string) $idAuto]);
$appAuto = one("SELECT * FROM applications WHERE id=?", [$idAuto]);
chk('отмена плановой отправки применилась', trim((string) $appAuto['result_send_at']) === '',
    (string) $appAuto['result_send_at']);

$tok = csrf($AJAR, '/admin/?p=dispatch');
$before = (int) scalar("SELECT COUNT(*) FROM mail_queue");
$rSend = http($AJAR, $BASE . '/admin/?p=dispatch', ['ajax' => '1', '_csrf' => $tok, 'do' => 'sendnow', 'kind' => 'result', 'id' => (string) $idAuto]);
$appAuto = one("SELECT * FROM applications WHERE id=?", [$idAuto]);
// На стенде SMTP недоступен: важно, что кнопка отработала и ЧЕСТНО сообщила итог,
// а письмо вернулось в очередь, а не потерялось молча.
$jSend = json_decode($rSend['body'], true);
chk('«Сейчас» вернуло понятный ответ', is_array($jSend) && array_key_exists('ok', $jSend),
    substr($rSend['body'], 0, 160));
chk('«Сейчас» либо отправило, либо объяснило причину',
    trim((string) $appAuto['result_sent_at']) !== '' || trim((string) ($jSend['msg'] ?? '')) !== '',
    trim((string) $appAuto['result_sent_at']) !== '' ? 'отправлено' : (string) ($jSend['msg'] ?? ''));

/* ───────────── 8. Заказ наград ───────────── */
sec('Заказ наград: состав строго по результату');
$r = http($UJAR, $BASE . '/awards?comp=' . (int) $paid['id'] . '&app=' . $idPaid);
chk('раздел наград по заявке открывается', $r['code'] === 200);
chk('в разделе зафиксирован результат заявки', strpos($r['body'], 'ЛАУРЕАТ I СТЕПЕНИ') !== false);
chk('видна плашка «заказ по заявке»', strpos($r['body'], 'aw-applock') !== false);
chk('есть образцы наград и корзина',
    strpos($r['body'], 'aw-card') !== false && strpos($r['body'], 'cartFab') !== false);
preg_match_all('~data-item="([^"]+)"~', $r['body'], $im);
$items = array_values(array_unique($im[1] ?? []));
chk('каталог наград собран', $items !== [], implode(', ', $items));
chk('лауреату не предлагается кубок', !in_array('Кубок Гран-при', $items, true));
chk('лауреату не предлагается медаль', !in_array('Медаль дипломанта', $items, true));
chk('лауреату предлагается статуэтка', in_array('Статуэтка лауреата', $items, true));
chk('кубок не задвоился', count(array_filter($items, fn($i) => str_contains($i, 'Кубок'))) <= 1);
// ПРАВИЛО (уточнено владельцем): в платном конкурсе ЭЛЕКТРОННЫЕ основной и
// дополнительный входят в оргвзнос и не заказываются, а их ОРИГИНАЛЫ заказать можно.
// Значит карточка в каталоге есть, но вид в ней — только «Оригинал».
chk('в платном есть оригинал основного диплома', in_array('Основной диплом', $items, true));
chk('в платном есть оригинал дополнительного диплома', in_array('Дополнительный диплом', $items, true));
foreach (['Основной диплом', 'Дополнительный диплом'] as $__di) {
    $__card = '';
    if (preg_match('~<article[^>]*data-item="' . preg_quote($__di, '~') . '"(.*?)</article>~s', $r['body'], $__m)) {
        $__card = $__m[1];
    }
    chk("«{$__di}»: электронный не предлагается (входит в участие)",
        $__card !== '' && strpos($__card, 'value="digital"') === false);
    chk("«{$__di}»: оригинал заказать можно",
        $__card !== '' && strpos($__card, 'value="original"') !== false);
    chk("«{$__di}»: есть пояснение про стоимость участия",
        $__card !== '' && strpos($__card, 'aw-inclusive') !== false);
}

$r = http($UJAR, $BASE . '/order-awards?app=' . $idPaid, null, false);
chk('старый адрес заказа ведёт в раздел наград с привязкой',
    in_array($r['code'], [301, 302], true)
    && str_contains((string) ($r['head'] ?? ''), 'app=' . $idPaid), (string) $r['code']);

sec('Заказ электронной награды: именной - коллективу и на ОДНОГО участника');
/* ПРОВЕРКА БЫЛА УСТАРЕВШЕЙ И КРАСНЕЛА НА ПРАВИЛЬНОЙ РАБОТЕ СЕРВЕРА.
 *
 * Она заказывала ИМЕННОЙ диплом на заявку СОЛИСТА и без ФИО получателя - сервер
 * отбивал обе вещи и был прав: именной выписывается на одного участника
 * КОЛЛЕКТИВА (слово владельца 15.10.2026; правила 30 и 31), а без имени печатать
 * нечего. Теперь заявка коллектива заводится здесь же, и проверяется ровно то,
 * что обещано людям на витрине: «Для одного из участников коллектива». */
$aGrp = submit_app($UJAR, $paid, 'Иванова Мария Петровна', 'Хоровод', 'Ансамбль «Проверка Потока»');
$idGrp = (int) ($aGrp['id'] ?? 0);
chk('заявка коллектива принята', $idGrp > 0,
    json_encode($aGrp['json']['fields'] ?? ($aGrp['json']['error'] ?? $aGrp['raw']), JSON_UNESCAPED_UNICODE));
if ($idGrp > 0) {
    q("UPDATE applications SET is_paid=1 WHERE id=?", [$idGrp]);
    $tok = csrf($AJAR, '/admin/?p=grading&id=' . $idGrp);
    http($AJAR, $BASE . '/admin/?p=grading', ['_csrf' => $tok, 'do' => 'grade_result',
        'id' => (string) $idGrp, 'result' => 'ЛАУРЕАТ I СТЕПЕНИ', 'extra_diploma' => '',
        'jury_comment' => 'Проверка потока', 'send_now' => '1']);

    $заказ = static function (array $items, string $amount) use ($UJAR, $BASE, $paid, $idGrp): array {
        $tok = csrf($UJAR, '/awards?comp=' . (int) $paid['id'] . '&app=' . $idGrp);
        $r = http($UJAR, $BASE . '/api/v1/order.php', [
            '_csrf' => $tok, 'csrf' => $tok, 'application_id' => (string) $idGrp,
            'competition' => (string) $paid['slug'], 'result' => 'ЛАУРЕАТ I СТЕПЕНИ',
            'items' => json_encode($items, JSON_UNESCAPED_UNICODE),
            'full_name' => 'Иванова Мария Петровна', 'email' => 'okoteam.top@gmail.com',
            'phone' => '+79995048899', 'amount' => $amount,
            /* ТРИ СОГЛАСИЯ ОБЯЗАТЕЛЬНЫ, И БЕЗ НИХ ПРОВЕРКА СЛЕПА. Сервер держит
               их в `$agreeMap` (api/v1/order.php) и отбивает заказ ДО разбора
               позиций - первый прогон получил «подтвердите, что ознакомились с
               положением» и записал это себе в зачёт как отказ по именному
               диплому. Отказ был, да только по другой причине. */
            'ord_agree_reg' => '1', 'ord_agree_pd' => '1', 'ord_agree_terms' => '1',
        ]);
        $j = json_decode($r['body'], true);
        return ['json' => is_array($j) ? $j : [], 'raw' => substr($r['body'], 0, 220)];
    };

    // Без ФИО получателя печатать нечего - сервер обязан отбить.
    $бф = $заказ([['item' => 'Именной диплом', 'kind' => 'digital']], '400');
    chk('именной без ФИО получателя отбит', ($бф['json']['ok'] ?? true) === false,
        substr((string) ($бф['json']['error'] ?? $бф['raw']), 0, 140));

    /* ДВОЕ В ОДНОМ ПОЛЕ: ЗАКАЗ ПРОХОДИТ, А ВЛАДЕЛЬЦУ ГОВОРЯТ СЛОВАМИ. Это не
       поблажка, а решение правила 30: позиция оплачена, а между выдачей и
       отправкой лежит пять рабочих дней - их хватает, чтобы поправить имя до
       того, как документ уйдёт. Поэтому проверяем не отказ, которого нет, а
       заслон, который есть: `named_fio_problem()` обязан назвать беду. Ждать
       здесь отказа значит требовать от кода обратного тому, что решил
       владелец. */
    $дв = $заказ([['item' => 'Именной диплом', 'kind' => 'digital',
                   'fio' => 'Петров Иван Сергеевич, Сидорова Анна Ивановна']], '400');
    chk('именной на двоих в одном поле принят (деньги уже взяты)',
        ($дв['json']['ok'] ?? false) === true,
        substr((string) ($дв['json']['error'] ?? $дв['raw']), 0, 140));
    require_once BASE_PATH . '/core/orders.php';
    $бедаДв = named_fio_problem('Петров Иван Сергеевич, Сидорова Анна Ивановна',
        ['group_name' => 'Ансамбль «Проверка Потока»']);
    chk('двое в одном поле названы владельцу словами', $бедаДв !== '', $бедаДв);
    chk('один участник бедой не считается',
        named_fio_problem('Петров Иван Сергеевич', ['group_name' => 'Ансамбль «Проверка Потока»']) === '');

    // А вот ОДИН участник коллектива - ровно то, что положено.
    $ок = $заказ([['item' => 'Именной диплом', 'kind' => 'digital',
                   'fio' => 'Петров Иван Сергеевич']], '400');
    chk('именной на одного участника коллектива принят', ($ок['json']['ok'] ?? false) === true,
        substr((string) ($ок['json']['error'] ?? $ок['raw']), 0, 160));
    $ord = one("SELECT * FROM awards_orders WHERE application_id=? ORDER BY id DESC LIMIT 1", [$idGrp]);
    chk('заказ сохранён', (bool) $ord, 'id=' . ($ord['id'] ?? '-'));
    // Имя получателя обязано лежать в составе заказа: по нему печатается бланк.
    chk('в заказе сохранено ФИО одного участника',
        strpos((string) ($ord['items'] ?? ''), 'Петров Иван Сергеевич') !== false,
        mb_substr((string) ($ord['items'] ?? ''), 0, 160));
    /* Отдельного списка заказов для уборки НЕ заводим: уборка в
       `_audit_actors.php` снимает `awards_orders` ПО НОМЕРУ ЗАЯВКИ, а заявка
       коллектива в этом списке уже стоит (её положил `submit_app`). Второй
       список значил бы вторую запись одного и того же - они расходятся молча. */
} else {
    bad('заявка коллектива не создалась - проверка именного пропущена');
}

sec('Сервер отклоняет запрещённый состав наград (подмена запроса)');
$tok = csrf($UJAR, '/awards?comp=' . (int) $paid['id'] . '&app=' . $idPaid);
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

$tok = csrf($UJAR, '/awards?comp=' . (int) $paid['id'] . '&app=' . $idPaid);
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
$r = http($UJAR, $BASE . '/awards?comp=' . (int) $free['id'] . '&app=' . $idFree);
chk('в бесплатном заказ наград открыт', $r['code'] === 200 && stripos($r['body'], 'ГРАН-ПРИ') !== false);
preg_match_all('~data-item="([^"]+)"~', $r['body'], $fm);
$fitems = array_values(array_unique($fm[1] ?? []));
chk('гран-при предлагается кубок', in_array('Кубок Гран-при', $fitems, true), implode(', ', $fitems));
chk('гран-при не предлагается статуэтка', !in_array('Статуэтка лауреата', $fitems, true));
chk('в бесплатном доступен основной диплом', in_array('Основной диплом', $fitems, true));

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
