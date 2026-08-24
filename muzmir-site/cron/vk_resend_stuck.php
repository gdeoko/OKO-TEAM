<?php
/**
 * СТОРОЖ ОТЛОЖЕННЫХ ОТВЕТОВ ВКОНТАКТЕ.
 *
 * Ответ бота в ВК отправляет отсоединённый процесс (cron/vk_send_delayed.php),
 * который спит до своего срока. Пока пауза была двадцать секунд, потеря такого
 * процесса почти ничего не стоила. С пятиминутной очередью (chat_delay_regular_sec)
 * цена другая: перезапуск php-fpm, деплой, нехватка памяти — и человек в ВК не
 * получает ответа вовсе, причём молча: в истории ответ есть, у человека его нет.
 *
 * Здесь досылается всё, чей срок прошёл больше двух минут назад и что до сих пор
 * не помечено отправленным. Двухминутный зазор — чтобы не обгонять живой процесс,
 * который просто чуть задержался.
 *
 * Запуск: раз в минуту из крона.
 *   * * * * * php /var/www/muzmir/cron/vk_resend_stuck.php
 */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { fwrite(STDERR, "CLI only\n"); exit(1); }

define('BASE_PATH', dirname(__DIR__));
$GLOBALS['CFG'] = require BASE_PATH . '/config.php';
require_once BASE_PATH . '/core/db.php';
require_once BASE_PATH . '/core/helpers.php';
require_once BASE_PATH . '/core/vk.php';

/* Старше суток не трогаем вовсе. Если ответ пролежал сутки, досылать его поздно:
 * человек давно ушёл, и внезапное сообщение «по вчерашнему вопросу» выглядит
 * сбоем. Такие строки просто закрываем, чтобы сторож не перебирал их вечно. */
try {
    q("UPDATE chat_messages SET vk_sent=1
        WHERE vk_sent=0 AND COALESCE(vk_send_at,'') <> ''
          AND vk_send_at < datetime('now','localtime','-1 day')");
} catch (\Throwable $e) { exit(0); }

$stuck = [];
try {
    $stuck = all("SELECT id, session_key, text FROM chat_messages
                   WHERE vk_sent=0 AND COALESCE(vk_send_at,'') <> ''
                     AND vk_send_at <= datetime('now','localtime','-2 minutes')
                   ORDER BY id ASC LIMIT 50");
} catch (\Throwable $e) { exit(0); }

if (!$stuck) exit(0);

$sent = $failed = 0;
foreach ($stuck as $row) {
    // session_key для ВК — 'vk_<peer_id>' (api/v1/webhook_vk.php).
    $peer = (int) preg_replace('~^vk_~', '', (string) $row['session_key']);
    $text = trim((string) $row['text']);
    if ($peer <= 0 || $text === '') {
        try { q("UPDATE chat_messages SET vk_sent=1 WHERE id=?", [(int) $row['id']]); } catch (\Throwable $e) {}
        continue;
    }
    $r = vk_dm_send($peer, $text, '', random_int(1, 2000000000));
    if (isset($r['response'])) {
        $sent++;
        try { q("UPDATE chat_messages SET vk_sent=1 WHERE id=?", [(int) $row['id']]); } catch (\Throwable $e) {}
        if (function_exists('_vk_log')) _vk_log("vk_resend_stuck peer=$peer дослан ответ id=" . (int) $row['id']);
    } else {
        $failed++;
        $why = json_encode($r['error'] ?? $r, JSON_UNESCAPED_UNICODE);
        error_log("vk_resend_stuck peer=$peer не доставлено: $why");
        /* Постоянные отказы ВК (901/902 — сообщения от сообщества запрещены,
         * 7 — нет прав) повторять бессмысленно: закрываем строку, иначе сторож
         * будет долбиться в неё каждую минуту сутки подряд. */
        $code = (int) ($r['error']['error_code'] ?? 0);
        if (in_array($code, [7, 900, 901, 902, 914, 917], true)) {
            try { q("UPDATE chat_messages SET vk_sent=1 WHERE id=?", [(int) $row['id']]); } catch (\Throwable $e) {}
        }
    }
    usleep(300000);   // ВК не любит очередь запросов без пауз
}

echo "vk_resend_stuck: найдено " . count($stuck) . ", дослано $sent, не удалось $failed\n";
