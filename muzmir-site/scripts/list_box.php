<?php
/**
 * ПОКАЗАТЬ, ЧТО ЛЕЖИТ В ЯЩИКЕ ЗА ПОСЛЕДНИЕ ДНИ — ТЕМА, ОТПРАВИТЕЛЬ, ОБРАТНЫЙ АДРЕС.
 *
 * Поиск по IMAP с русской строкой через curl не работает (нужен CHARSET и
 * литерал), поэтому не ищем, а перебираем письма за срок и смотрим заголовки
 * сами. Помогает понять, дошло ли конкретное письмо и куда именно.
 *
 *   php scripts/list_box.php kc 1        — ящик kc@, за 1 день
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
$accName = inbox_boxes()[$alias] ?? $alias;
$acc = mail_account_by_name($accName);
if (!$acc || empty($acc['user'])) { echo "ящик «$alias» не настроен\n"; exit(1); }
$acc['host'] = 'imap.yandex.ru'; $acc['port'] = 993;

$since = date('d-M-Y', time() - $days * 86400);
foreach (['INBOX' => 'входящие', 'Spam' => 'спам'] as $folder => $ru) {
    $ids = im_search($acc, 'SINCE ' . $since, $folder);
    printf("\n%s (%s): писем %d\n%s\n", $alias, $ru, count($ids), str_repeat('-', 78));
    foreach ($ids as $id) {
        $raw = im_fetch($acc, (int) $id, $folder);
        if (trim($raw) === '') continue;
        $head = explode("\r\n\r\n", $raw, 2)[0];
        $get = static fn(string $n): string => preg_match('~^' . preg_quote($n, '~') . ':\s*(.+)$~mi', $head, $m)
            ? im_decode_header(trim($m[1])) : '';
        printf("  %-20s %-40s ответ на: %s\n",
            mb_substr($get('From'), 0, 20),
            mb_substr($get('Subject'), 0, 40),
            $get('Reply-To') ?: '(не задан)');
    }
}
