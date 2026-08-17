<?php
/**
 * ДОБРАТЬ ВЛОЖЕНИЯ У ПИСЕМ, КОТОРЫЕ УЖЕ ЛЕЖАТ В БАЗЕ.
 *
 * Первые содержательные ответы ведомств пришли официальным письмом на бланке:
 * тело пустое, весь смысл в PDF. Тогда вложения ещё не сохранялись, и разобрать
 * эти ответы было нечем. Здесь письма перечитываются из ящика заново, файлы
 * ложатся на диск, текст из PDF приклеивается к телу, и тип ответа считается
 * ещё раз — уже по содержанию.
 */
declare(strict_types=1);
define('BASE_PATH', '/var/www/muzmir');
$GLOBALS['CFG'] = require BASE_PATH . '/config.php';
require_once BASE_PATH . '/core/db.php';
require_once BASE_PATH . '/core/helpers.php';
require_once BASE_PATH . '/core/mailer.php';
require_once BASE_PATH . '/core/inbox_reader.php';

$box = $argv[1] ?? 'kc';
$acc = mail_account_by_name(inbox_boxes()[$box] ?? $box);
$acc['host'] = 'imap.yandex.ru'; $acc['port'] = 993;
$days = (int) ($argv[2] ?? 7);
$since = date('d-M-Y', time() - $days * 86400);
$own = inbox_own_emails();
$fixed = 0;

foreach (['INBOX', 'Spam'] as $folder) {
    foreach (im_search($acc, 'SINCE ' . $since, $folder) as $id) {
        $raw = im_fetch($acc, $id, $folder);
        if (trim($raw) === '') continue;
        $m = im_parse($raw);
        $from = mb_strtolower(trim((string) $m['from']));
        if ($from === '' || in_array($from, $own, true) || !$m['attachments']) continue;
        $key = substr(sha1($box . '|' . $from . '|' . $m['subject'] . '|' . $m['date']), 0, 24);
        $row = one("SELECT id, attachments, body_text, kind, ministry_id, inst_id FROM inbox_messages WHERE msg_key=?", [$key]);
        if (!$row) continue;
        if (str_contains((string) $row['attachments'], '"file"')) continue;   // уже добрано

        $att = []; $text = '';
        foreach ($m['attachments'] as $a) {
            $data = (string) ($a['data'] ?? '');
            $name = (string) ($a['name'] ?? '');
            $rel  = inbox_save_attachment($box, $key, $name, $data);
            if ($rel !== '' && preg_match('~\.pdf$~i', $name)) $text .= "\n" . inbox_pdf_text(BASE_PATH . '/' . $rel);
            $att[] = ['name' => $name, 'mime' => (string) ($a['mime'] ?? ''), 'size' => strlen($data), 'file' => $rel];
        }
        $body = trim((string) $row['body_text'] . "\n" . $text);
        $kind = (string) $row['kind'];
        if (trim($text) !== '') {
            $k = inbox_classify($box, (string) $m['subject'], $body, false);
            if ((int) $row['ministry_id'] > 0) {
                $k = ['partner_accept' => 'ministry_approve', 'partner_decline' => 'ministry_decline',
                      'question' => 'ministry_question'][$k] ?? $k;
            }
            $kind = $k;
        }
        update('inbox_messages', [
            'attachments' => json_encode($att, JSON_UNESCAPED_UNICODE),
            'body_text'   => mb_substr($body, 0, 4000),
            'kind'        => $kind,
        ], 'id=:id', ['id' => (int) $row['id']]);
        printf("#%d %s → %s\n", (int) $row['id'], mb_substr($from, 0, 34), $kind);
        $fixed++;
    }
}
printf("добрано писем: %d\n", $fixed);
