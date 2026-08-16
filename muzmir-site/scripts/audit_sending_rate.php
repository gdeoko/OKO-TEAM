<?php
/**
 * ТЕМП РАССЫЛКИ — СЧИТАЕМ, А НЕ НАДЕЕМСЯ.
 *
 * Норма поднята до четырёх тысяч писем в день на каждую волну, с ростом на
 * тысячу в сутки. Норма — это разрешение, а не способность: письма уходят
 * пачками по расписанию, и если пачка мала или расписание считает не так,
 * дневная норма просто не выберется, а понять это можно будет только вечером
 * по недосланным письмам.
 *
 * Здесь темп проверяется арифметикой на настоящих настройках: сколько прогонов
 * крона поместится в окно, сколько писем разрешено взять за прогон, сколько
 * писем к этому часу положено по графику. Плюс проверяются предохранители:
 * остановка роста при плохой доставляемости, месячный потолок пакета и приём
 * событий доставки.
 *
 * Ничего не отправляет.
 *
 *   php scripts/audit_sending_rate.php
 */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { fwrite(STDERR, "CLI only\n"); exit(1); }

define('BASE_PATH', dirname(__DIR__));
$GLOBALS['CFG'] = require BASE_PATH . '/config.php';
require_once BASE_PATH . '/core/db.php';
require_once BASE_PATH . '/core/data.php';
require_once BASE_PATH . '/core/helpers.php';
require_once BASE_PATH . '/core/mailer.php';
require_once BASE_PATH . '/core/newsletter.php';

$OK = 0; $BAD = 0; $line = str_repeat('=', 78);
function ok(string $s, string $x = ''): void  { global $OK; $OK++; echo "  [ок]   $s" . ($x !== '' ? " — $x" : '') . "\n"; }
function bad(string $s, string $x = ''): void { global $BAD; $BAD++; echo "  [СБОЙ] $s" . ($x !== '' ? " — $x" : '') . "\n"; }

echo "ТЕМП РАССЫЛКИ\n$line\n";

$hFrom  = (int) setting('nl_window_hour_from', '9');
$hTo    = (int) setting('nl_window_hour_to', '18');
$winMin = max(1, ($hTo - $hFrom) * 60);
$burst  = nl_box_burst_cap();
$ladder = array_values(array_filter(array_map('intval',
    preg_split('~[^0-9]+~', (string) setting('nl_warmup_ladder', ''))), fn($n) => $n > 0));

printf("  окно отправки: %02d:00-%02d:00 — %d минут, крон раз в минуту\n", $hFrom, $hTo, $winMin);
printf("  писем за один прогон крона: %d\n", $burst);
printf("  ящиков в массовом пуле: %d\n", count(mail_fallback_accounts([], 'bulk')));

/* ── 1. Хватит ли пропускной способности на каждую ступень ────────────────── */
echo "\n1. ХВАТИТ ЛИ ПРОПУСКНОЙ СПОСОБНОСТИ\n$line\n";
$boxes = max(1, count(mail_fallback_accounts([], 'bulk')));
$maxPerDay = $winMin * $burst * $boxes;
printf("  предел за день: %d минут × %d писем × %d ящик = %s писем\n",
    $winMin, $burst, $boxes, number_format($maxPerDay, 0, '.', ' '));
foreach ($ladder as $d => $cap) {
    if ($d > 5) break;
    $label = sprintf('день %d: норма %s', $d, number_format($cap, 0, '.', ' '));
    $cap <= $maxPerDay
        ? ok($label, 'проходит, запас ' . number_format($maxPerDay - $cap, 0, '.', ' '))
        : bad($label, 'НЕ ПРОЙДЁТ: предел ' . number_format($maxPerDay, 0, '.', ' ')
            . ', не хватит ' . number_format($cap - $maxPerDay, 0, '.', ' '));
}

/* ── 2. Ровно ли ложится норма на окно ────────────────────────────────────── */
echo "\n2. РОВНО ЛИ НОРМА ЛОЖИТСЯ НА ОКНО\n$line\n";
$cap = $ladder[0] ?? 8000;
$prev = 0; $maxStep = 0; $bad2 = false;
for ($m = 0; $m <= $winMin; $m += 30) {
    $due = (int) max(1, ceil($cap * (min($m, $winMin - 1) + 1) / $winMin));
    $step = $due - $prev;
    if ($m > 0 && $step > $burst * 30) $bad2 = true;      // за 30 минут крон успевает 30 прогонов
    $maxStep = max($maxStep, $step);
    $prev = $due;
}
$bad2 ? bad('график обгоняет пропускную способность', 'за полчаса нужно ' . $maxStep . ', а крон даст ' . ($burst * 30))
      : ok('график по силам крону', 'за полчаса максимум ' . $maxStep . ' при возможных ' . ($burst * 30));

$gap = nl_box_gap_sec('unisender');
$gap > 0 && $gap <= 120
    ? ok('пауза между письмами сервиса рассчитана', $gap . ' с.')
    : bad('пауза между письмами вне разумного', $gap . ' с.');

/* ── 3. Деление между волнами ─────────────────────────────────────────────── */
echo "\n3. ДЕЛЕНИЕ МЕЖДУ ВОЛНАМИ\n$line\n";
$split = nl_daily_split();
$sum = array_sum($split);
printf("  своя база %d, учреждения %d, клуб %d, кабинет %d — всего %d\n",
    $split['konkurs'] ?? 0, $split['inst'] ?? 0, $split['vip'] ?? 0, $split['kabinet'] ?? 0, $sum);
$sum === nl_daily_cap() ? ok('дневная норма разложена без потерь')
                        : bad('сумма долей не равна норме', $sum . ' против ' . nl_daily_cap());
($split['konkurs'] ?? 0) > 0 && ($split['inst'] ?? 0) > 0
    ? ok('обе волны идут одновременно')
    : bad('одна из волн осталась без квоты');

/* ── 4. Предохранители ────────────────────────────────────────────────────── */
echo "\n4. ПРЕДОХРАНИТЕЛИ\n$line\n";
$src = (string) @file_get_contents(BASE_PATH . '/core/newsletter.php');
mb_strpos($src, 'failToday > ($sentToday + $failToday) * 0.05') !== false
    ? ok('рост нормы останавливается при доле отказов выше 5%')
    : bad('нет остановки роста при плохой доставляемости');
mb_strpos($src, 'nl_service_month_left') !== false
    ? ok('месячный пакет ограничивает дневную норму')
    : bad('месячный пакет не учитывается');
mb_strpos($src, 'nl_box_blocked_today') !== false
    ? ok('ящик, который начал отбивать письма, замолкает до завтра')
    : bad('нет защиты от суточного лимита отправителя');

$left = nl_service_month_left();
$need = (int) (scalar("SELECT COUNT(*) FROM mail_queue WHERE status='queued'") ?? 0)
      + (int) (scalar("SELECT COUNT(*) FROM institutions WHERE status='new' AND TRIM(COALESCE(email,''))<>''") ?? 0);
$left >= $need
    ? ok('оплаченного пакета хватает на всю оставшуюся базу',
         'остаток ' . number_format($left, 0, '.', ' ') . ', нужно ' . number_format($need, 0, '.', ' '))
    : bad('пакета не хватит', 'остаток ' . $left . ', нужно ' . $need);

/* ── 5. За сколько дней разойдётся база ───────────────────────────────────── */
echo "\n5. ЗА СКОЛЬКО РАЗОЙДЁТСЯ БАЗА\n$line\n";
$queueK = (int) (scalar("SELECT COUNT(*) FROM mail_queue WHERE status='queued' AND campaign_type='konkurs'") ?? 0);
$queueI = (int) (scalar("SELECT COUNT(*) FROM mail_queue WHERE status='queued' AND campaign_type='inst'") ?? 0);
$waitI  = (int) (scalar("SELECT COUNT(*) FROM institutions WHERE status='new' AND TRIM(COALESCE(email,''))<>''") ?? 0);
$dayTo  = (int) setting('nl_window_day_to', '24');
printf("  своя база: %s писем, учреждения: %s в очереди + %s ждут\n",
    number_format($queueK, 0, '.', ' '), number_format($queueI, 0, '.', ' '), number_format($waitI, 0, '.', ' '));

$start = strtotime((string) setting('nl_warmup_started', '') ?: 'tomorrow');
$leftK = $queueK; $leftI = $queueI + $waitI; $days = 0; $lastDay = '';
for ($d = 0; $d < 30 && ($leftK > 0 || $leftI > 0); $d++) {
    $ts = $start + $d * 86400;
    if ((int) date('N', $ts) === 7 && (string) setting('nl_window_sunday', '0') !== '1') continue;
    if ((int) date('j', $ts) > $dayTo) break;
    $capD = $ladder[min($d, count($ladder) - 1)] ?? 8000;
    $leftK = max(0, $leftK - (int) floor($capD / 2));
    $leftI = max(0, $leftI - (int) floor($capD / 2));
    $days++; $lastDay = date('d.m', $ts);
}
$leftK === 0 && $leftI === 0
    ? ok('вся база успевает до закрытия окна', "рабочих дней: $days, последний — $lastDay")
    : bad('база не успевает до закрытия окна',
          'останется своей базы ' . $leftK . ', учреждений ' . $leftI . ' (окно до ' . $dayTo . ' числа)');

/* ── 6. Приём событий доставки ────────────────────────────────────────────── */
echo "\n6. ПРИЁМ СОБЫТИЙ ДОСТАВКИ\n$line\n";
$key = trim((string) cfgv('unisender_api_key', ''));
if ($key === '') { bad('ключ сервиса рассылок не задан'); }
else {
    // Подписываем пробное событие ровно так, как это делает сервис: auth — это
    // md5 всего тела, в котором значение auth заменено на ключ.
    $probe = 'audit-probe-' . substr(bin2hex(random_bytes(4)), 0, 8) . '@example.test';
    $body = ['auth' => 'PLACEHOLDER', 'events_by_user' => [[
        'user_id' => 1, 'project_id' => '', 'events' => [[
            'event_name' => 'transactional_email_status',
            'event_data' => ['email' => $probe, 'status' => 'delivered',
                             'event_time' => date('Y-m-d H:i:s'), 'job_id' => 'audit'],
        ]],
    ]]];
    $raw = json_encode($body, JSON_UNESCAPED_UNICODE);
    $sig = md5(str_replace('PLACEHOLDER', $key, $raw));
    $raw = str_replace('PLACEHOLDER', $sig, $raw);

    $url = rtrim((string) cfgv('base_url'), '/') . '/api/v1/mail_events';
    $ch = curl_init($url);
    curl_setopt_array($ch, [CURLOPT_POST => true, CURLOPT_POSTFIELDS => $raw,
        CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
        CURLOPT_RETURNTRANSFER => true, CURLOPT_SSL_VERIFYPEER => false, CURLOPT_TIMEOUT => 20]);
    $resp = (string) curl_exec($ch);
    $code = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    curl_close($ch);
    $code === 200 ? ok('приёмник событий отвечает', 'HTTP 200 «' . trim($resp) . '»')
                  : bad('приёмник событий не ответил', 'HTTP ' . $code);
    $saved = (int) (scalar("SELECT COUNT(*) FROM mail_events WHERE email=?", [$probe]) ?? 0);
    $saved > 0 ? ok('событие с верной подписью записано')
               : bad('событие с верной подписью не записано');
    // Событие с подделанной подписью записываться не должно.
    $fake = str_replace($sig, str_repeat('0', 32), $raw);
    $ch = curl_init($url);
    curl_setopt_array($ch, [CURLOPT_POST => true, CURLOPT_POSTFIELDS => $fake,
        CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
        CURLOPT_RETURNTRANSFER => true, CURLOPT_SSL_VERIFYPEER => false, CURLOPT_TIMEOUT => 20]);
    curl_exec($ch); curl_close($ch);
    $after = (int) (scalar("SELECT COUNT(*) FROM mail_events WHERE email=?", [$probe]) ?? 0);
    $after === $saved ? ok('событие с чужой подписью отброшено')
                      : bad('событие с чужой подписью записалось');
    try { q("DELETE FROM mail_events WHERE email=?", [$probe]); } catch (\Throwable $e) {}
}

echo "\n$line\n";
printf("ПРОЙДЕНО: %d · СБОЕВ: %d\n", $OK, $BAD);
exit($BAD > 0 ? 1 : 0);
