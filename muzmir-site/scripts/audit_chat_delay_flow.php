<?php
/**
 * ДОХОДИТ ЛИ ОТЛОЖЕННЫЙ ОТВЕТ ДО ОКНА ЧАТА.
 *
 * Проверка очереди (audit_chat_priority.php) смотрит на строки в базе по их id и
 * этого мало: окно чата забирает историю не по id, а по `since` — номеру
 * последнего показанного сообщения. Пока подтверждение «отвечу через пять минут»
 * вставлялось ПОСЛЕ отложенного ответа, оно получало больший номер: вкладка
 * забирала подтверждение, двигала since за него, и ответ с меньшим номером уже
 * никогда не проходил условие id > since. Человек получал обещание и не получал
 * ответа — а по базе всё выглядело правильно.
 *
 * Поэтому здесь воспроизводится ровно то, что делает вкладка: отправили вопрос,
 * забрали историю до срока, дождались срока, забрали историю ещё раз тем же
 * since. Ответ обязан прийти во второй заход.
 *
 *   php scripts/audit_chat_delay_flow.php
 */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { fwrite(STDERR, "CLI only\n"); exit(1); }

define('BASE_PATH', dirname(__DIR__));
$GLOBALS['CFG'] = require BASE_PATH . '/config.php';
require_once BASE_PATH . '/core/db.php';
require_once BASE_PATH . '/core/helpers.php';
require_once BASE_PATH . '/core/chat_ops.php';
require_once BASE_PATH . '/core/chat_priority.php';

$line = str_repeat('=', 78);
$ok = $bad = 0;
$say = function (bool $good, string $what, string $note = '') use (&$ok, &$bad): void {
    if ($good) { $ok++;  printf("  [ок]   %s%s\n", $what, $note !== '' ? ' — ' . $note : ''); }
    else       { $bad++; printf("  [СБОЙ] %s%s\n", $what, $note !== '' ? ' — ' . $note : ''); }
};

/** Ровно тот запрос, которым окно чата добирает новое (api/v1/chat.php, action=history). */
$history = function (string $sessionKey, int $since): array {
    return all("SELECT id, role, text FROM chat_messages
                 WHERE session_key=? AND id>?
                   AND (COALESCE(visible_at,'') = '' OR visible_at <= datetime('now','localtime'))
                 ORDER BY id ASC LIMIT 100", [$sessionKey, $since]);
};

echo "ОТЛОЖЕННЫЙ ОТВЕТ В ОКНЕ ЧАТА\n$line\n";

$sessionKey = 'audit_flow_' . bin2hex(random_bytes(4));
$delay      = chat_reply_delay_sec(null);   // как гостю: без Клуба

try {
    $say($delay > 0, 'очередь для обычного участника включена', $delay . ' с');

    // Вопрос человека.
    $qid = (int) insert('chat_messages', ['user_id' => null, 'session_key' => $sessionKey,
                                          'role' => 'user', 'text' => 'Сколько стоит участие?', 'file' => '']);

    /* Так же, как в api/v1/chat.php: в базу ложится ТОЛЬКО отложенный ответ.
     * Срок берём заведомо близкий, чтобы не ждать пять минут: проверяется
     * поведение истории, а не длина паузы. */
    $say(chat_wait_notice($delay, 'Мария', true) === '',
         'подтверждение приёма вопроса не собирается вовсе');

    $aid = (int) insert('chat_messages', ['user_id' => null, 'session_key' => $sessionKey,
                                          'role' => 'assistant', 'text' => 'Участие стоит 1 000 ₽.',
                                          'file' => '', 'visible_at' => date('Y-m-d H:i:s', time() + 60)]);

    // Первый заход вкладки: показан вопрос, добираем всё после него.
    $first = $history($sessionKey, $qid);
    $texts = array_column($first, 'text');
    $say(count($first) === 0, 'до срока в чат не приходит ничего', 'сообщений: ' . count($first));
    $say(!in_array('Участие стоит 1 000 ₽.', $texts, true), 'готовый ответ до срока не виден');

    /* Раз до срока показывать нечего, вкладка не двигает `since` вперёд — и
     * ответ с меньшим номером не потеряется. Именно на этом ломалась прежняя
     * схема с подтверждением: оно получало больший id, вкладка запоминала его,
     * и ответ не проходил условие id > since уже никогда. */
    $since = $qid;
    foreach ($first as $r) $since = max($since, (int) $r['id']);
    $say($since === $qid, 'номер последнего показанного остался на вопросе', "since=$since");

    // Срок наступил.
    q("UPDATE chat_messages SET visible_at=datetime('now','localtime','-1 minute') WHERE id=?", [$aid]);
    $second = $history($sessionKey, $since);
    $got    = array_column($second, 'text');
    $say(in_array('Участие стоит 1 000 ₽.', $got, true),
         'после срока ответ доходит тем же опросом истории', 'сообщений: ' . count($second));
    $say(count($got) === 1, 'приходит только ответ, ничего лишнего');

} catch (\Throwable $e) {
    $say(false, 'проверка прервана', $e->getMessage());
} finally {
    q("DELETE FROM chat_messages WHERE session_key=?", [$sessionKey]);
    $left = (int) (scalar("SELECT COUNT(*) FROM chat_messages WHERE session_key=?", [$sessionKey]) ?? 0);
    $say($left === 0, 'временные сообщения удалены');
}

echo "\n$line\nПРОЙДЕНО: $ok · СБОЕВ: $bad\n";
exit($bad > 0 ? 1 : 0);
