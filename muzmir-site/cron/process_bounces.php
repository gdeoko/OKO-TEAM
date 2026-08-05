<?php
/**
 * Очистка базы от «отказов» (bounce): читает почтовый ящик news@ по IMAP,
 * находит уведомления о недоставке (Mailer-Daemon / DSN), извлекает несуществующие
 * или заблокированные адреса и выводит их из базы подписчиков (active=0, тег bounced).
 * Так база остаётся чистой, а дневная квота рассылки заполняется живыми адресами.
 *
 * Требование: у ящика news@ включён протокол IMAP (Яндекс 360 → Почтовые программы).
 * Если IMAP выключен/недоступен — крон тихо завершается (не фейлит расписание).
 * Дополнительно чистит адреса, письма которым окончательно провалились на SMTP.
 *
 * Запуск: php cron/process_bounces.php  (в кроне — раз в 30–60 минут).
 */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { fwrite(STDERR, "CLI only\n"); exit(1); }

define('BASE_PATH', dirname(__DIR__));
$GLOBALS['CFG'] = require BASE_PATH . '/config.php';
require_once BASE_PATH . '/core/db.php';
require_once BASE_PATH . '/core/helpers.php';
require_once BASE_PATH . '/core/mailer.php';
require_once BASE_PATH . '/core/newsletter.php';

/* --- 1) Всегда: прунинг окончательно провалившихся на SMTP (не требует IMAP). --- */
$prunedFailed = nl_prune_failed();

/* --- 2) IMAP: чтение bounce-уведомлений ящика news@. --- */
$senders = function_exists('mail_senders') ? mail_senders() : [];
$news = $senders['news'] ?? [];
if (empty($news['user']) || empty($news['pass'])) {
    mail_log('[bounce] нет учётных данных news@ — пропуск IMAP (SMTP-прунинг: ' . $prunedFailed . ')');
    exit(0);
}

$imapHost = (string) (cfgv('imap_host', '') ?: 'imap.yandex.ru');
$imapPort = (int) (cfgv('imap_port', 0) ?: 993);
$user = (string) $news['user'];
$pass = (string) $news['pass'];

/** Выполняет IMAP-команду через cURL, возвращает [ok, body]. */
function bounce_imap(string $host, int $port, string $user, string $pass, string $mailbox, string $customReq = ''): array {
    $ch = curl_init();
    $url = 'imaps://' . $host . ':' . $port . '/' . rawurlencode($mailbox);
    $opts = [
        CURLOPT_URL            => $url,
        CURLOPT_USERNAME       => $user,
        CURLOPT_PASSWORD       => $pass,
        CURLOPT_USE_SSL        => CURLUSESSL_ALL,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CONNECTTIMEOUT => 15,
        CURLOPT_TIMEOUT        => 40,
        CURLOPT_SSL_VERIFYPEER => true,
        CURLOPT_SSL_VERIFYHOST => 2,
    ];
    if ($customReq !== '') $opts[CURLOPT_CUSTOMREQUEST] = $customReq;
    curl_setopt_array($ch, $opts);
    $out = curl_exec($ch);
    $err = curl_error($ch);
    curl_close($ch);
    if ($out === false) return [false, $err];
    return [true, (string) $out];
}

// Ищем недавние письма от почтовых демонов (за 14 дней).
$since = date('d-M-Y', time() - 14 * 86400);
[$ok, $body] = bounce_imap($imapHost, $imapPort, $user, $pass, 'INBOX',
    'SEARCH SINCE ' . $since . ' OR FROM "mailer-daemon" OR FROM "postmaster" SUBJECT "Undelivered"');
if (!$ok) {
    // IMAP, вероятно, выключен для ящика — не критично.
    mail_log('[bounce] IMAP недоступен (' . $body . '); SMTP-прунинг: ' . $prunedFailed);
    exit(0);
}

// Разбор списка порядковых номеров из ответа SEARCH.
$ids = [];
if (preg_match('/\*\s*SEARCH([0-9\s]*)/i', $body, $m)) {
    foreach (preg_split('/\s+/', trim($m[1])) as $n) {
        if ($n !== '' && ctype_digit($n)) $ids[] = (int) $n;
    }
}
$ids = array_slice(array_unique($ids), -300);   // разумный потолок за прогон

$marked = 0; $scanned = 0;
foreach ($ids as $seq) {
    [$fok, $msg] = bounce_imap($imapHost, $imapPort, $user, $pass, 'INBOX', 'FETCH ' . $seq . ' BODY[]');
    if (!$fok || $msg === '') continue;
    $scanned++;

    // Извлекаем адреса-«отказники» из типовых полей DSN и текста.
    $cands = [];
    if (preg_match_all('/Final-Recipient:\s*rfc822;\s*<?([^\s<>]+@[^\s<>]+)>?/i', $msg, $mm)) $cands = array_merge($cands, $mm[1]);
    if (preg_match_all('/X-Failed-Recipients:\s*<?([^\s<>]+@[^\s<>]+)>?/i', $msg, $mm)) $cands = array_merge($cands, $mm[1]);
    if (preg_match_all('/Original-Recipient:\s*rfc822;\s*<?([^\s<>]+@[^\s<>]+)>?/i', $msg, $mm)) $cands = array_merge($cands, $mm[1]);
    // «<addr>: ... does not exist / user unknown / 550 5.1.1»
    if (preg_match_all('/<([^\s<>]+@[^\s<>]+)>[^\n]{0,80}(?:5\.1\.1|does not exist|user unknown|no such user|mailbox unavailable|not found|заблокир|не существ)/iu', $msg, $mm)) $cands = array_merge($cands, $mm[1]);

    $isHard = (bool) preg_match('/(5\.1\.1|5\.0\.0|550|does not exist|user unknown|no such user|mailbox (?:unavailable|not found)|account (?:disabled|unavailable)|не существ|заблокир)/iu', $msg);
    if (!$isHard) continue;   // мягкие/временные ошибки не выводим из базы

    foreach (array_unique(array_map('mb_strtolower', $cands)) as $addr) {
        $addr = trim($addr);
        if ($addr === '' || !filter_var($addr, FILTER_VALIDATE_EMAIL)) continue;
        // Не трогаем собственные служебные адреса.
        if (stripos($addr, 'yandex') !== false && stripos($addr, 'daemon') !== false) continue;
        $sub = one("SELECT active FROM subscribers WHERE email=?", [$addr]);
        if ($sub && (int) $sub['active'] === 1) { nl_mark_bounced($addr, 'imap-dsn'); $marked++; }
    }

    // Помечаем обработанное как прочитанное, чтобы не разбирать повторно.
    bounce_imap($imapHost, $imapPort, $user, $pass, 'INBOX', 'STORE ' . $seq . ' +FLAGS (\\Seen)');
}

mail_log("[bounce] IMAP разобрано писем: $scanned, выведено адресов: $marked; SMTP-прунинг: $prunedFailed");
echo "bounces: imap_marked=$marked scanned=$scanned smtp_failed_pruned=$prunedFailed\n";
