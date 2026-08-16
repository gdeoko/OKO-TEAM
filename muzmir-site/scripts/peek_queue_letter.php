<?php
/**
 * ЗАГЛЯНУТЬ В ПИСЬМО ИЗ ОЧЕРЕДИ.
 *
 * Показывает текст письма без разметки: чем оно кончается, какие в нём якоря,
 * есть ли кнопки. Нужен, когда правка очереди не находит место для вставки и
 * гадать, что там за шаблон, дороже, чем посмотреть.
 *
 *   php scripts/peek_queue_letter.php                 — первое письмо кампании inst без кнопки
 *   php scripts/peek_queue_letter.php 12345           — конкретное письмо по id
 */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { fwrite(STDERR, "CLI only\n"); exit(1); }

define('BASE_PATH', dirname(__DIR__));
$GLOBALS['CFG'] = require BASE_PATH . '/config.php';
require_once BASE_PATH . '/core/db.php';
require_once BASE_PATH . '/core/helpers.php';

$id = (int) ($argv[1] ?? 0);
$row = $id > 0
    ? one("SELECT id, subject, body FROM mail_queue WHERE id=?", [$id])
    : one("SELECT id, subject, body FROM mail_queue
            WHERE status IN ('queued','paused') AND campaign_type='inst'
              AND body NOT LIKE '%partner-join%' LIMIT 1");

if (!$row) { echo "не найдено\n"; exit(0); }

printf("письмо #%d: %s\n%s\n", (int) $row['id'], (string) $row['subject'], str_repeat('=', 78));
$txt = preg_replace('~\s+~u', ' ', strip_tags((string) $row['body']));
echo mb_substr((string) $txt, 0, 2500), "\n";
echo str_repeat('-', 78), "\n";
echo "хвост:\n", mb_substr((string) $txt, -700), "\n";
