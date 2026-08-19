<?php
/**
 * ПЕРЕСОБРАТЬ ТЕЛА ПИСЕМ УЧРЕЖДЕНИЯМ, КОТОРЫЕ ЕЩЁ НЕ УШЛИ.
 *
 * Письмо учреждению собирается в момент постановки в очередь, а очередь идёт
 * неделями по дневной норме. Значит правка письма достаётся только новым
 * получателям, а тысячи уже стоящих в очереди уйдут в старой вёрстке: с
 * партнёрством в самом конце, после четырёх конкурсов и восьми ссылок, и с
 * кнопкой, которая ведёт на общую форму вместо ссылки учреждения.
 *
 * Здесь тело и тема пересобираются на месте. Номер исходящего, вложение с
 * обращением и адресат не меняются: письмо остаётся тем же самым официальным
 * обращением, меняется только его вид. Лист А4 второй раз не рисуется — он уже
 * лежит на диске под своим номером (core/pdf_letter.php умеет его отдавать).
 *
 *   php scripts/requeue_inst_letters.php            — посчитать
 *   php scripts/requeue_inst_letters.php --apply    — пересобрать
 *   php scripts/requeue_inst_letters.php --apply --limit=500
 */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { fwrite(STDERR, "CLI only\n"); exit(1); }

define('BASE_PATH', dirname(__DIR__));
$GLOBALS['CFG'] = require BASE_PATH . '/config.php';
require_once BASE_PATH . '/core/db.php';
require_once BASE_PATH . '/core/helpers.php';
require_once BASE_PATH . '/core/institutions.php';
require_once BASE_PATH . '/core/letter_mail.php';
require_once BASE_PATH . '/core/letter_texts.php';
require_once BASE_PATH . '/core/partner.php';

$apply = in_array('--apply', $argv, true);
$limit = 0;
foreach ($argv as $a) if (preg_match('~^--limit=(\d+)$~', $a, $m)) $limit = (int) $m[1];
$line = str_repeat('=', 78);
$n    = static fn($x): string => number_format((int) $x, 0, '.', ' ');

/* Конкурсы сезона — те же, что в письме при постановке в очередь. */
$comps = all("SELECT * FROM competitions WHERE status='open' ORDER BY sort, id");
if (!$comps) { fwrite(STDERR, "нет открытых конкурсов — письма собирать не из чего\n"); exit(1); }

$rows = all("SELECT id, to_email, subject FROM mail_queue
              WHERE status='queued' AND campaign_type='inst' ORDER BY id"
            . ($limit > 0 ? " LIMIT $limit" : ''));

echo "ПЕРЕСБОРКА ПИСЕМ УЧРЕЖДЕНИЯМ\n$line\n";
printf("  писем в очереди: %s\n", $n(count($rows)));
if (!$rows) exit(0);
if (!$apply) { echo "  сухой прогон: ничего не изменено (запустить с --apply)\n"; exit(0); }

$done = $skip = $fail = 0;
$t0 = microtime(true);
foreach ($rows as $r) {
    $email = mb_strtolower(trim((string) $r['to_email']));
    if ($email === '') { $skip++; continue; }

    $inst = one("SELECT * FROM institutions WHERE LOWER(email)=? LIMIT 1", [$email]);
    if (!$inst) { $skip++; continue; }

    // Номер исходящего берём из реестра обращений: письмо уже зарегистрировано,
    // и менять номер нельзя — по нему учреждение заводит входящее.
    $number = (string) (scalar("SELECT number FROM official_letters
                                 WHERE LOWER(email)=? AND kind='support' ORDER BY id DESC LIMIT 1", [$email]) ?? '');
    if ($number === '') {
        // Номера нет только у писем, поставленных до реестра. Достаём из темы.
        if (preg_match('~исх\.\s*№\s*([0-9/]+)~u', (string) $r['subject'], $m)) $number = $m[1];
    }
    if ($number === '') { $skip++; continue; }

    // Ссылка отписки — своя у учреждения, ровно та же, что при постановке в очередь
    // (core/invite_queue.php): токен учреждения, а не запись в базе участников.
    $base  = rtrim((string) cfgv('base_url', ''), '/');
    $unsub = $base . '/api/v1/unsubscribe.php?token=' . urlencode(inst_unsub_token((int) $inst['id']));

    try {
        $mail = lm_mail_institution($inst, $number, $comps, $unsub);
        if (empty($mail['html'])) { $fail++; continue; }
        q("UPDATE mail_queue SET subject=?, body=? WHERE id=?",
          [(string) $mail['subject'], (string) $mail['html'], (int) $r['id']]);
        $done++;
    } catch (\Throwable $e) { $fail++; }

    if ($done > 0 && $done % 500 === 0) {
        printf("  пересобрано %s из %s (%.0f с)\n", $n($done), $n(count($rows)), microtime(true) - $t0);
    }
}

printf("\n$line\n  пересобрано: %s, пропущено: %s, сбоев: %s, за %.0f с\n",
    $n($done), $n($skip), $n($fail), microtime(true) - $t0);
