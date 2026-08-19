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
// Единый разбор причины отказа: голый код ничего не доказывает (см. шапку файла).
if (!function_exists('mrep_bounce_is_proof')) require_once BASE_PATH . '/core/mail_reputation.php';

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

/**
 * ПРИЧИНА ОТКАЗА ИМЕННО ПО ЭТОМУ АДРЕСУ.
 *
 * DSN на нескольких получателей описывает каждого своим блоком (Final-Recipient,
 * Action, Status, Diagnostic-Code). Проверять письмо целиком нельзя: одна строка
 * «user unknown» про одного получателя вычеркнула бы из базы всех остальных из
 * того же письма. Берём текст ПОСЛЕ адреса (пояснение почтовика всегда идёт за
 * ним) и обрываем на границе его блока: на «Final-Recipient» следующего или на
 * первой пустой строке. Промахнуться лучше в сторону «не понял причину»: тогда
 * адрес просто остаётся жить.
 */
function bounce_reason_near(string $msg, string $addr): string {
    $parts = [];
    $len = strlen($msg);
    $pos = 0;
    while (count($parts) < 5 && ($p = stripos($msg, $addr, $pos)) !== false) {
        $start = $p + strlen($addr);
        $end   = min($len, $start + 600);
        $next  = stripos($msg, 'Final-Recipient', $start);
        if ($next !== false && $next < $end) $end = $next;
        $chunk = substr($msg, $start, max(0, $end - $start));
        // Пустая строка разделяет блоки получателей и в машинной части DSN, и в
        // человеческом тексте, а пояснение почтовика пустых строк внутри не имеет.
        if (preg_match('/\R[ \t]*\R/', $chunk, $bm, PREG_OFFSET_CAPTURE)) {
            $chunk = substr($chunk, 0, $bm[0][1]);
        }
        if ($chunk !== '') $parts[] = $chunk;
        $pos = $start;
    }
    return implode("\n", $parts);
}

/**
 * ПРИЧИНА ОТКАЗА В ВИДЕ, ПРИГОДНОМ ДЛЯ ЖУРНАЛА.
 *
 * Отчёт почтовика приходит в какой угодно кодировке: KOI8-R от старого шлюза,
 * windows-1251 от ведомственной почты, обрезанный посреди символа UTF-8. Функции
 * с модификатором /u на такой строке возвращают null, и дальше mb_substr(null)
 * под strict_types роняет весь разбор отказов: крон умирает на первом же кривом
 * письме, а мёртвые адреса остаются в базе и тратят отправку каждую волну.
 *
 * Поэтому склейка пробелов делается без /u, а всё, что не похоже на печатный
 * текст, заменяется точкой: журналу нужна узнаваемая причина, а не точная копия.
 */
function bounce_clean_reason(string $reason, int $limit = 120): string {
    $s = (string) preg_replace('/\s+/', ' ', trim($reason));
    if (!mb_check_encoding($s, 'UTF-8')) {
        $conv = @mb_convert_encoding($s, 'UTF-8', 'Windows-1251, KOI8-R, ISO-8859-5');
        $s = is_string($conv) && mb_check_encoding($conv, 'UTF-8') ? $conv
           : (string) preg_replace('/[^\x20-\x7E]/', '.', $s);
    }
    return mb_substr($s, 0, $limit);
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

    // КОД БЕЗ ПОЯСНЕНИЯ НИЧЕГО НЕ ДОКАЗЫВАЕТ. Голые 550 и 5.0.0 стояли здесь в
    // признаках «жёсткого отказа», хотя «550 Message rejected under suspicion of
    // SPAM» — это про канал, а не про адрес: ровно на такой логике 10.08 из базы
    // ушли 2 695 живых адресов. Решение принимает единый разбор
    // mrep_bounce_is_proof() и только по тексту рядом с конкретным адресом.
    foreach (array_unique(array_map('mb_strtolower', $cands)) as $addr) {
        $addr = trim($addr);
        if ($addr === '' || !filter_var($addr, FILTER_VALIDATE_EMAIL)) continue;
        // Не трогаем собственные служебные адреса.
        if (stripos($addr, 'yandex') !== false && stripos($addr, 'daemon') !== false) continue;
        $reason = bounce_reason_near($msg, $addr);
        if (!mrep_bounce_is_proof($reason)) continue;   // молчаливый и мягкий отказ адрес не хоронят
        $sub = one("SELECT active FROM subscribers WHERE email=?", [$addr]);
        if ($sub && (int) $sub['active'] === 1) {
            // Причину пишем в лог: без неё разобрать ошибочную чистку потом нечем.
            // Текст берём через bounce_clean_reason(): отчёт почтовика приходит в
            // какой угодно кодировке, а preg_replace с /u на битом UTF-8 возвращает
            // null, и под strict_types весь разбор отказов падал бы на первом же
            // таком письме, оставляя мёртвые адреса в базе.
            nl_mark_bounced($addr, 'imap-dsn: ' . bounce_clean_reason($reason));
            $marked++;
        }
    }

    // Помечаем обработанное как прочитанное, чтобы не разбирать повторно.
    bounce_imap($imapHost, $imapPort, $user, $pass, 'INBOX', 'STORE ' . $seq . ' +FLAGS (\\Seen)');
}

mail_log("[bounce] IMAP разобрано писем: $scanned, выведено адресов: $marked; SMTP-прунинг: $prunedFailed");
echo "bounces: imap_marked=$marked scanned=$scanned smtp_failed_pruned=$prunedFailed\n";
