<?php
/**
 * ЧЕМ ПОДПИСАНО НАШЕ ПИСЬМО И ЧТО О НЁМ ДУМАЕТ ПОЧТА ПОЛУЧАТЕЛЯ.
 *
 * Письма от собственного домена ложатся в «Спам» даже в наш же ящик. Причина
 * почти всегда в подписи: если сервис рассылок подписывает письмо СВОИМ доменом,
 * а не нашим, проверка DMARC не сходится, и почтовик относится к письму как к
 * чужому. Здесь мы берём последнее наше письмо и читаем то, что обычно скрыто:
 * кто подписал, что решили SPF, DKIM и DMARC, какой балл выставил спам-фильтр.
 *
 *   php scripts/check_auth_headers.php [ящик] [дней]
 */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { fwrite(STDERR, "CLI only\n"); exit(1); }

define('BASE_PATH', dirname(__DIR__));
$GLOBALS['CFG'] = require BASE_PATH . '/config.php';
require_once BASE_PATH . '/core/db.php';
require_once BASE_PATH . '/core/helpers.php';
require_once BASE_PATH . '/core/mailer.php';
require_once BASE_PATH . '/core/imap_read.php';
require_once BASE_PATH . '/core/inbox_reader.php';

$alias = $argv[1] ?? 'kc';
$days  = max(1, (int) ($argv[2] ?? 1));
$acc = mail_account_by_name(inbox_boxes()[$alias] ?? $alias);
if (!$acc || empty($acc['user'])) { echo "ящик «$alias» не настроен\n"; exit(1); }
$acc['host'] = 'imap.yandex.ru'; $acc['port'] = 993;

$since = date('d-M-Y', time() - $days * 86400);
$shown = 0;
foreach (['Spam' => 'спам', 'INBOX' => 'входящие'] as $folder => $ru) {
    foreach (array_reverse(im_search($acc, 'SINCE ' . $since, $folder)) as $id) {
        if ($shown >= 3) break 2;
        $raw = im_fetch($acc, (int) $id, $folder);
        if (trim($raw) === '') continue;
        $head = explode("\r\n\r\n", $raw, 2)[0];
        $get = static function (string $n) use ($head): string {
            return preg_match('~^' . preg_quote($n, '~') . ':\s*(.+(?:\r?\n[ \t].+)*)$~mi', $head, $m)
                ? trim(preg_replace('~\r?\n[ \t]+~', ' ', $m[1]) ?? '') : '';
        };
        $from = im_decode_header($get('From'));
        // Смотрим только СВОИ письма: чужие подписи нас здесь не интересуют.
        if (mb_stripos($from, 'xn----7sbugdeiegh1b0a9hen') === false
            && mb_stripos($from, 'музыкальный-мир') === false) continue;
        $shown++;
        $dkim = $get('DKIM-Signature');
        $d = preg_match('~[;\s]d=([^;\s]+)~', $dkim, $m) ? $m[1] : '(нет подписи)';
        printf("── %s [%s]\n", mb_substr(im_decode_header($get('Subject')), 0, 60), $ru);
        printf("   от:            %s\n", mb_substr($from, 0, 70));
        printf("   подписал домен: %s\n", $d);
        printf("   конверт:       %s\n", $get('Return-Path') ?: '(нет)');
        printf("   проверки:      %s\n", mb_substr($get('Authentication-Results') ?: '(нет)', 0, 300));
        printf("   отписка одним щелчком: %s\n",
            $get('List-Unsubscribe') !== '' ? 'есть' : 'НЕТ — почта не покажет кнопку «Отписаться»');
        foreach (['X-Yandex-Spam', 'X-Spam-Flag', 'X-Spam-Status', 'X-Yandex-Filter-Verdict'] as $h) {
            $v = $get($h);
            if ($v !== '') printf("   %-14s %s\n", $h . ':', mb_substr($v, 0, 120));
        }
        // Сходится ли подпись с адресом отправителя — от этого зависит DMARC.
        $fromDom = preg_match('~@([^>\s]+)~', $from, $m2) ? mb_strtolower($m2[1]) : '';
        $align = $d !== '(нет подписи)' && $fromDom !== ''
                 && (mb_stripos($fromDom, $d) !== false || mb_stripos($d, $fromDom) !== false);
        printf("   подпись и отправитель сходятся: %s\n\n", $align ? 'да' : 'НЕТ — для DMARC это чужое письмо');
    }
}
if ($shown === 0) echo "своих писем за этот срок в ящике нет\n";
