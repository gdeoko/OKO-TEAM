<?php
/**
 * ВОССТАНОВЛЕНИЕ БЛАНКОВ ОБРАЩЕНИЙ ДЛЯ ПИСЕМ, КОТОРЫЕ ЕЩЁ НЕ УШЛИ.
 *
 * Бланк обращения — картинка, собранная из данных реестра: номер, адресат,
 * должность, организация, регион. Значит, потерянный файл не потерян навсегда:
 * его можно собрать заново по той же записи, с тем же номером и по тому же
 * пути, и письмо в очереди даже не заметит подмены.
 *
 * Нужен, если бланки удалили раньше времени (например, чисткой диска), а письма
 * с ними ещё стоят в очереди: без вложения такое письмо ушло бы пустым.
 *
 *   php scripts/repair_letter_pdfs.php            — показать, чего не хватает
 *   php scripts/repair_letter_pdfs.php --apply    — собрать заново
 *   php scripts/repair_letter_pdfs.php --apply 500 — не больше 500 за прогон
 */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { fwrite(STDERR, "CLI only\n"); exit(1); }

define('BASE_PATH', dirname(__DIR__));
$GLOBALS['CFG'] = require BASE_PATH . '/config.php';
require_once BASE_PATH . '/core/db.php';
require_once BASE_PATH . '/core/helpers.php';
require_once BASE_PATH . '/core/official_letter.php';
require_once BASE_PATH . '/core/letter_texts.php';
require_once BASE_PATH . '/core/pdf_letter.php';

$apply = in_array('--apply', $argv, true);
$limit = 0;
foreach ($argv as $a) if (ctype_digit((string) $a)) $limit = (int) $a;
$line = str_repeat('=', 78);

echo "БЛАНКИ ДЛЯ ПИСЕМ В ОЧЕРЕДИ\n$line\n";

$rows = all("SELECT id, to_email, attach FROM mail_queue
              WHERE status IN ('queued','paused') AND COALESCE(attach,'')<>''
           ORDER BY id");
$missing = [];
$filesOk = 0;
foreach ($rows as $r) {
    $list = json_decode((string) $r['attach'], true);
    if (!is_array($list)) $list = [(string) $r['attach']];
    foreach ($list as $f) {
        $f = (string) $f;
        if (mb_strpos($f, '/data/letters/') === false) continue;   // положение и афиша лежат отдельно
        if (is_file($f)) { $filesOk++; continue; }
        $missing[(int) $r['id']] = $f;
    }
}
printf("  писем в очереди с вложениями:  %6d\n", count($rows));
printf("  бланков на месте:              %6d\n", $filesOk);
printf("  бланков не хватает:            %6d\n", count($missing));

if (!$missing) { echo "\nвсё на месте\n"; exit(0); }
if (!$apply) { echo "\nничего не делали — запустите с --apply\n"; exit(0); }

echo "\nСОБИРАЕМ ЗАНОВО\n$line\n";
$done = 0; $fail = 0; $skip = 0;
$t0 = microtime(true);
foreach ($missing as $qid => $path) {
    if ($limit > 0 && $done >= $limit) break;
    $L = one("SELECT * FROM official_letters WHERE queue_id=?", [$qid]);
    if (!$L) { $skip++; continue; }
    try {
        // Тот же вызов, что и при первой сборке: номер прежний, значит и путь
        // получится прежний, и вложение письма никуда не поедет.
        $out = pdf_official_letter([
            'number'      => (string) $L['number'],
            'kind'        => (string) $L['kind'],
            'org'         => (string) $L['org'],
            'person'      => (string) $L['person'],
            'person_role' => (string) $L['person_role'],
            'region'      => (string) $L['region'],
            'plain'       => (string) $L['kind'] === 'support',
            'date'        => substr((string) $L['created_at'], 0, 10),
        ]);
        if ($out !== '' && is_file($out) && $out === $path) { $done++; }
        elseif ($out !== '' && is_file($out)) {
            // Путь разошёлся (например, поменялись правила имени файла) —
            // не бросаем письмо, а поправляем ссылку на вложение.
            $list = json_decode((string) (scalar("SELECT attach FROM mail_queue WHERE id=?", [$qid]) ?? ''), true);
            if (is_array($list)) {
                foreach ($list as $i => $f) if ((string) $f === $path) $list[$i] = $out;
                q("UPDATE mail_queue SET attach=? WHERE id=?", [json_encode($list, JSON_UNESCAPED_UNICODE), $qid]);
            }
            $done++;
        } else { $fail++; }
    } catch (\Throwable $e) { $fail++; }
    if ($done % 500 === 0 && $done > 0) printf("  собрано %d, %.0f с.\n", $done, microtime(true) - $t0);
}
printf("\nсобрано: %d, не удалось: %d, без записи в реестре: %d, %.0f с.\n",
    $done, $fail, $skip, microtime(true) - $t0);
