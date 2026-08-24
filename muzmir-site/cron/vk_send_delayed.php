<?php
/**
 * Отложенная «человеческая» отправка ответа бота ВК с индикатором «печатает…».
 * Запускается ОТСОЕДИНЁННО из вебхука (exec … &), чтобы НЕ держать php-fpm воркер
 * 20-30 секунд (иначе на пуле из 5 воркеров подвиснет весь сайт).
 *
 * Аргументы: <peer_id> <delay_seconds> <base64(text)> [row_id]
 * Логика: пингуем «печатает…» каждые ~7 сек, ждём delay, затем шлём сообщение.
 *
 * row_id — строка ответа в chat_messages. По ней сторож (cron/vk_resend_stuck.php)
 * понимает, дошёл ли ответ: этот процесс спит до пяти минут и может не пережить
 * перезапуск php-fpm или деплой, а человек в ВК останется без ответа молча.
 */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { fwrite(STDERR, "CLI only\n"); exit(1); }

$peer  = (int) ($argv[1] ?? 0);
$delay = (int) ($argv[2] ?? 20);
$text  = (string) base64_decode((string) ($argv[3] ?? ''), true);
$rowId = (int) ($argv[4] ?? 0);
if ($peer <= 0 || $text === '') exit(0);
// Предел поднят с сорока секунд до пятнадцати минут: обычный участник ждёт
// ответа в очереди (core/chat_priority.php), и эта очередь исполняется здесь.
$delay = max(3, min(900, $delay));

define('BASE_PATH', dirname(__DIR__));
$GLOBALS['CFG'] = require BASE_PATH . '/config.php';
require_once BASE_PATH . '/core/db.php';
require_once BASE_PATH . '/core/helpers.php';
require_once BASE_PATH . '/core/vk.php';

/* «Печатает…» показываем только последние полминуты ожидания. Индикатор,
 * висящий пять минут подряд, выглядит не как работа, а как зависший бот. */
$start = time();
$typeFrom = max(0, $delay - 30);
while (time() - $start < $delay) {
    $left = $delay - (time() - $start);
    if (time() - $start >= $typeFrom) {
        vk_typing($peer);
        sleep((int) max(1, min(7, $left)));
    } else {
        sleep((int) max(1, min(20, $typeFrom - (time() - $start))));
    }
}
// РЕЗУЛЬТАТ ОТПРАВКИ ПРОВЕРЯЕМ. Раньше возврат просто отбрасывался, а vk_api
// логирует только временные коды (1/6/9/10/29). Постоянные отказы — запрет
// сообщений от сообщества (901/902), недействительный токен, 914 — уходили молча:
// человек в ВК не получал ответа, а в логах не было ни строчки, почему.
$r = vk_dm_send($peer, $text, '', random_int(1, 2000000000));
if (!isset($r['response'])) {
    $why = json_encode($r['error'] ?? $r, JSON_UNESCAPED_UNICODE);
    if (function_exists('_vk_log')) _vk_log("vk_send_delayed peer=$peer НЕ ДОСТАВЛЕНО: $why");
    error_log("vk_send_delayed peer=$peer не доставлено: $why");
    exit(1);
}
// Отметка «ушло» — иначе сторож пошлёт этот же ответ второй раз.
if ($rowId > 0) {
    try { q("UPDATE chat_messages SET vk_sent=1 WHERE id=?", [$rowId]); } catch (\Throwable $e) {}
}
