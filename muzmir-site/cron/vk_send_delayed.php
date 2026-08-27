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
/* ПЕРЕД САМОЙ ОТПРАВКОЙ СМОТРИМ, НЕ ОТМЕНИЛИ ЛИ ОТВЕТ.
 *
 * Процесс спит до пяти минут. За это время оператор мог зайти в диалог и
 * ответить сам — тогда ответ бота снят (role='bot_cancelled', см.
 * chat_cancel_pending_bot) и включён перехват. Без этой проверки бот всё равно
 * писал человеку поверх живого ответа: сообщение уже было в аргументах
 * процесса, и база его не останавливала.
 *
 * Без row_id (старый вызов, шаблон вне графика) проверять нечего — шлём. */
if ($rowId > 0) {
    try {
        $row = one("SELECT role, vk_sent, session_key FROM chat_messages WHERE id=?", [$rowId]);
        if (!$row) {
            error_log("vk_send_delayed peer=$peer: строка ответа удалена — не отправляю");
            exit(0);
        }
        if ((string) $row['role'] !== 'assistant') {
            if (function_exists('_vk_log')) _vk_log("vk_send_delayed peer=$peer: ответ снят оператором — не отправляю");
            exit(0);
        }
        if ((int) ($row['vk_sent'] ?? 0) === 1) exit(0);   // сторож уже дослал
        // Перехват оператором мог включиться и без правки этой строки.
        if (is_file(BASE_PATH . '/core/chat_ops.php')) {
            require_once BASE_PATH . '/core/chat_ops.php';
            // Бота выключили целиком, пока ответ ждал своей минуты, — не отправляем.
            if (function_exists('chat_bot_enabled') && !chat_bot_enabled()) {
                q("UPDATE chat_messages SET role='bot_cancelled' WHERE id=?", [$rowId]);
                if (function_exists('_vk_log')) _vk_log("vk_send_delayed peer=$peer: бот выключен — не отправляю");
                exit(0);
            }
            if (function_exists('chat_operator_active')
                && chat_operator_active((string) $row['session_key'])) {
                q("UPDATE chat_messages SET role='bot_cancelled' WHERE id=?", [$rowId]);
                if (function_exists('_vk_log')) _vk_log("vk_send_delayed peer=$peer: в диалоге работает оператор — не отправляю");
                exit(0);
            }
        }
    } catch (\Throwable $e) { /* база недоступна — лучше отправить, чем промолчать */ }
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
