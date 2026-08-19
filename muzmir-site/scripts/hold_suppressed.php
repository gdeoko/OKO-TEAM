<?php
/**
 * ПРИДЕРЖАТЬ ПИСЬМА АДРЕСАМ, КОТОРЫЕ СЕРВИС ВСЁ РАВНО НЕ ОТПРАВИТ.
 *
 * У сервиса рассылок свой список подавления. Пока адрес в нём, письмо не
 * доставляется и даже не пытается уйти: сервис отвечает err_spam_skipped, а
 * очередь считает письмо отправленным. 19 августа в голове очереди оказалось
 * больше тысячи таких адресов, и живые получатели ждали за ними.
 *
 * Здесь письма к подавленным адресам снимаются с очереди со статусом
 * «ждёт снятия подавления». Как только подавление снято
 * (scripts/unisender_suppression.php), письмо ставится заново — это делает тот
 * же скрипт снятия.
 *
 *   php scripts/hold_suppressed.php          — посчитать
 *   php scripts/hold_suppressed.php --apply  — придержать
 */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { fwrite(STDERR, "CLI only\n"); exit(1); }

define('BASE_PATH', dirname(__DIR__));
$GLOBALS['CFG'] = require BASE_PATH . '/config.php';
require_once BASE_PATH . '/core/db.php';
require_once BASE_PATH . '/core/helpers.php';

$apply = in_array('--apply', $argv, true);
$line  = str_repeat('=', 78);
$n     = static fn($x): string => number_format((int) $x, 0, '.', ' ');

$key = trim((string) cfgv('unisender_api_key', ''));
if ($key === '') { fwrite(STDERR, "нет ключа сервиса рассылок\n"); exit(1); }

function hs_call(string $method, array $params): array {
    $ch = curl_init('https://go2.unisender.ru/ru/transactional/api/v1/' . $method);
    curl_setopt_array($ch, [
        CURLOPT_POST => 1, CURLOPT_RETURNTRANSFER => 1, CURLOPT_TIMEOUT => 30,
        CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
        CURLOPT_POSTFIELDS => json_encode(array_merge(
            ['api_key' => trim((string) cfgv('unisender_api_key', ''))], $params)),
    ]);
    $r = curl_exec($ch);
    curl_close($ch);
    $d = json_decode((string) $r, true);
    return is_array($d) ? $d : ['status' => 'error'];
}

echo "ПИСЬМА АДРЕСАМ В СПИСКЕ ПОДАВЛЕНИЯ\n$line\n";

$emails = [];
$cursor = '';
for ($page = 0; $page < 400; $page++) {
    $p = ['limit' => 500];
    if ($cursor !== '') $p['cursor'] = $cursor;
    $r = hs_call('suppression/list.json', $p);
    if (($r['status'] ?? '') !== 'success') break;
    foreach ($r['suppressions'] ?? [] as $s) {
        $e = mb_strtolower(trim((string) ($s['email'] ?? '')));
        if ($e !== '') $emails[$e] = 1;
    }
    $cursor = (string) ($r['cursor'] ?? '');
    if ($cursor === '') break;
}
printf("  адресов в списке подавления: %s\n", $n(count($emails)));
if (!$emails) exit(0);

$held = 0;
foreach (array_chunk(array_keys($emails), 400) as $chunk) {
    $in = implode(',', array_fill(0, count($chunk), '?'));
    if ($apply) {
        q("UPDATE mail_queue SET status='paused', error='ждёт снятия подавления у сервиса рассылок'
            WHERE status='queued' AND COALESCE(priority,0) > 0 AND LOWER(to_email) IN ($in)", $chunk);
        $held += (int) db()->query("SELECT changes()")->fetchColumn();
    } else {
        $held += (int) (scalar("SELECT COUNT(*) FROM mail_queue
                                 WHERE status='queued' AND COALESCE(priority,0) > 0
                                   AND LOWER(to_email) IN ($in)", $chunk) ?? 0);
    }
}
printf("  %s писем: %s\n", $apply ? 'придержано' : 'придержали бы', $n($held));
if (!$apply) echo "\n  сухой прогон: ничего не изменено\n";
