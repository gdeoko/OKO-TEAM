<?php
/**
 * ДОСЛАТЬ ОБРАЩЕНИЯ, КОТОРЫЕ НЕ УШЛИ.
 *
 * Волна обращений 01.10.2026 ушла по 679 ведомствам, а шесть писем сервис
 * рассылок отклонил своей памятью: «No valid recipients, permanent_unavailable».
 * Строки очереди встали в failed, и шесть ведомств остались без документа —
 * при том, что в реестре у них уже выписан исходящий номер.
 *
 * Пересобирать обращение с НОВЫМ номером нельзя: номер выписывается один раз и
 * числится в реестре. Поэтому здесь документ собирается заново ПОД ТЕМ ЖЕ
 * номером (PDF из data/letters крон уборки давно стёр), с адреса снимается
 * пометка сервиса, и письмо возвращается в очередь.
 *
 *   php scripts/ministry_resend_failed.php          — показать, что будет сделано
 *   php scripts/ministry_resend_failed.php --apply  — сделать
 */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { fwrite(STDERR, "CLI only\n"); exit(1); }

define('BASE_PATH', dirname(__DIR__));
$GLOBALS['CFG'] = require BASE_PATH . '/config.php';
require_once BASE_PATH . '/core/db.php';
require_once BASE_PATH . '/core/helpers.php';
require_once BASE_PATH . '/core/ministries.php';
require_once BASE_PATH . '/core/ministry_mailing.php';
require_once BASE_PATH . '/core/letter_mail.php';
require_once BASE_PATH . '/core/official_letter.php';

$apply = in_array('--apply', $argv, true);
$key   = trim((string) cfgv('unisender_api_key', ''));
$base  = rtrim((string) cfgv('unisender_api_url', 'https://go2.unisender.ru/ru/transactional/api/v1'), '/') . '/';

/** Снять у сервиса пометку «адрес недоступен». Отписки и жалобы НЕ трогаем. */
function mrf_unsuppress(string $email, string $base, string $key): string {
    $ch = curl_init($base . 'suppression/delete.json');
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => json_encode(['api_key' => $key, 'email' => $email,
                                           'cause' => 'permanent_unavailable'], JSON_UNESCAPED_UNICODE),
        CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
        CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 25,
    ]);
    $raw = (string) curl_exec($ch);
    curl_close($ch);
    $j = json_decode($raw, true);
    return (string) ($j['status'] ?? mb_substr($raw, 0, 80));
}

$free = ol_comps(true);
if (!$free) { fwrite(STDERR, "нет ни одного бесплатного конкурса — пересобирать обращение не из чего\n"); exit(1); }

$rows = all("SELECT id, to_email, subject, attach, error FROM mail_queue
              WHERE status='failed' AND COALESCE(campaign_type,'')='official' ORDER BY id");
if (!$rows) { echo "недоставленных обращений нет\n"; exit(0); }

echo ($apply ? "ДОСЫЛКА" : "ПОКАЗ (ничего не меняется)") . ": обращений " . count($rows) . "\n\n";
$done = 0; $skip = 0;

foreach ($rows as $q) {
    $email = mb_strtolower(trim((string) $q['to_email']));
    $min   = one("SELECT * FROM ministries WHERE LOWER(email)=?", [$email]);
    if (!$min) { printf("  %-28s ведомства нет в реестре — пропуск\n", $email); $skip++; continue; }

    // Номер берём из реестра обращений: он уже выписан этому адресу в этом сезоне
    // и ещё не отмечен отправленным. Новый номер не выписываем.
    $L = one("SELECT * FROM official_letters WHERE LOWER(email)=? AND kind='support'
                AND COALESCE(sent_at,'')='' ORDER BY id DESC LIMIT 1", [$email]);
    if (!$L) { printf("  %-28s в реестре нет неотправленного обращения — пропуск\n", $email); $skip++; continue; }
    $number = (string) $L['number'];

    if (!$apply) {
        printf("  %-28s №%s  %s\n", $email, $number, mb_substr((string) $min['org'], 0, 46));
        continue;
    }

    $st = mrf_unsuppress($email, $base, $key);
    $m  = (array) $min;
    $m['branch'] = (string) ($m['branch'] ?? 'main');
    try { $mail = lm_mail_support($m, $number, $free); }
    catch (\Throwable $e) { printf("  %-28s документ не собрался: %s\n", $email, $e->getMessage()); $skip++; continue; }

    $pdf = (string) ($mail['pdf'] ?? '');
    if ($pdf === '' || !is_file($pdf)) { printf("  %-28s PDF не собрался — пропуск\n", $email); $skip++; continue; }

    $files = array_merge([$pdf], mm_attachments($free));
    if ((int) ($m['needs_cover'] ?? 0) === 1) {
        $cover = lm_cover_pdf($m, $number, ['Положение о конкурсе (бесплатное участие)', 'Афиша конкурса']);
        if ($cover !== '') array_unshift($files, $cover);
    }

    update('mail_queue', [
        'status' => 'queued', 'tries' => 0, 'soft_tries' => 0, 'error' => '',
        'attach' => json_encode(array_values($files), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
        'body'   => (string) ($mail['html'] ?? ''),
    ], 'id=:id', ['id' => (int) $q['id']]);

    printf("  %-28s №%s  сервис: %-8s документ собран, письмо в очереди\n", $email, $number, $st);
    $done++;
}

if ($apply) echo "\nготово: вернулось в очередь $done, пропущено $skip\n";
else echo "\nзапуск с правками: php scripts/ministry_resend_failed.php --apply\n";
