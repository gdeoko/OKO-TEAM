<?php
/**
 * НАЙТИ В ЯЩИКЕ ПИСЬМА ПРОВЕРКИ ОБРАТНОГО АДРЕСА И ПОКАЗАТЬ ИХ ЗАГОЛОВКИ.
 *
 * Отдельно от отправки: письмо через сервис рассылок может идти дольше, чем
 * готов ждать тест, и падает оно нередко в «Спам» — свой же домен Яндекс
 * подозревает не меньше чужого. Поэтому смотрим обе папки и не спешим.
 *
 *   php scripts/check_replyto.php
 */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { fwrite(STDERR, "CLI only\n"); exit(1); }

define('BASE_PATH', dirname(__DIR__));
$GLOBALS['CFG'] = require BASE_PATH . '/config.php';
require_once BASE_PATH . '/core/db.php';
require_once BASE_PATH . '/core/helpers.php';
require_once BASE_PATH . '/core/mailer.php';
require_once BASE_PATH . '/core/imap_read.php';

$acc = mail_account_by_name('kc');
$acc['host'] = 'imap.yandex.ru'; $acc['port'] = 993;
$found = 0;

foreach (['INBOX' => 'входящие', 'Spam' => 'спам'] as $folder => $ru) {
    $ids = im_search($acc, 'SUBJECT "Проверка обратного адреса"', $folder);
    foreach ($ids as $id) {
        $raw = im_fetch($acc, (int) $id, $folder);
        if (trim($raw) === '') continue;
        $head = explode("\r\n\r\n", $raw, 2)[0];
        $get = static function (string $name) use ($head): string {
            return preg_match('~^' . preg_quote($name, '~') . ':\s*(.+)$~mi', $head, $m)
                ? im_decode_header(trim($m[1])) : '';
        };
        $found++;
        printf("── %s [%s]\n   от:        %s\n   ответ на:  %s\n   дата:      %s\n\n",
            $get('Subject'), $ru, $get('From'), $get('Reply-To') ?: '(не задан)', $get('Date'));
    }
}
echo $found === 0 ? "писем проверки в ящике пока нет\n" : "найдено писем: $found\n";
