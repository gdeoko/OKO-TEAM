<?php
/**
 * Отложенная «человеческая» отправка ответа бота ВК с индикатором «печатает…».
 * Запускается ОТСОЕДИНЁННО из вебхука (exec … &), чтобы НЕ держать php-fpm воркер
 * 20-30 секунд (иначе на пуле из 5 воркеров подвиснет весь сайт).
 *
 * Аргументы: <peer_id> <delay_seconds> <base64(text)>
 * Логика: пингуем «печатает…» каждые ~7 сек, ждём delay, затем шлём сообщение.
 */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { fwrite(STDERR, "CLI only\n"); exit(1); }

$peer  = (int) ($argv[1] ?? 0);
$delay = (int) ($argv[2] ?? 20);
$text  = (string) base64_decode((string) ($argv[3] ?? ''), true);
if ($peer <= 0 || $text === '') exit(0);
$delay = max(3, min(40, $delay)); // защита от абсурдных значений

define('BASE_PATH', dirname(__DIR__));
$GLOBALS['CFG'] = require BASE_PATH . '/config.php';
require_once BASE_PATH . '/core/db.php';
require_once BASE_PATH . '/core/helpers.php';
require_once BASE_PATH . '/core/vk.php';

$start = time();
while (time() - $start < $delay) {
    vk_typing($peer);
    sleep((int) max(1, min(7, $delay - (time() - $start))));
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
