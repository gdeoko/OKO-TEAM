<?php
/**
 * ПРОВЕРКА ОЧЕРЕДИ В ЧАТЕ: КЛУБУ МОМЕНТАЛЬНО, ОСТАЛЬНЫМ В СРОК.
 *
 * Привилегия Клуба должна быть настоящей, а не написанной на странице. Здесь
 * проверяется весь путь: определение участника Клуба, срок ответа для обоих
 * случаев, отложенный показ сообщения в истории и обещание словами.
 *
 * Настоящих участников не трогает: временный пользователь и временное членство
 * заводятся на собственный ящик центра и удаляются в конце, что бы ни случилось
 * по дороге.
 *
 *   php scripts/audit_chat_priority.php
 */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { fwrite(STDERR, "CLI only\n"); exit(1); }

define('BASE_PATH', dirname(__DIR__));
$GLOBALS['CFG'] = require BASE_PATH . '/config.php';
require_once BASE_PATH . '/core/db.php';
require_once BASE_PATH . '/core/helpers.php';
require_once BASE_PATH . '/core/club.php';
require_once BASE_PATH . '/core/chat_priority.php';

$line = str_repeat('=', 78);
$ok = $bad = 0;
$say = function (bool $good, string $what, string $note = '') use (&$ok, &$bad): void {
    if ($good) { $ok++;  printf("  [ок]   %s%s\n", $what, $note !== '' ? ' — ' . $note : ''); }
    else       { $bad++; printf("  [СБОЙ] %s%s\n", $what, $note !== '' ? ' — ' . $note : ''); }
};

echo "ОЧЕРЕДЬ ОТВЕТОВ В ЧАТЕ\n$line\n";

$mail = 'audit-chat-' . substr(bin2hex(random_bytes(3)), 0, 6) . '@example.invalid';
$uid  = (int) insert('users', [
    'email' => $mail, 'full_name' => 'Проверка Очереди', 'role' => 'user',
    'password_hash' => password_hash(bin2hex(random_bytes(8)), PASSWORD_DEFAULT),
]);
$sessionKey = 'audit_' . $uid;

try {
    /* 1. Обычный участник */
    $say(!chat_is_vip($uid), 'без членства участник не считается клубным');
    $delay = chat_reply_delay_sec($uid);
    $say($delay > 0, 'обычному назначена очередь', $delay . ' с');
    $say($delay <= 900, 'очередь не превышает обещанные 15 минут');
    $say(chat_reply_delay_sec(null) === $delay, 'гость обслуживается как обычный участник');

    // Пауза не объявляет о себе: пока ответ ждёт своего срока, в чат не уходит
    // ничего. Проверяем именно молчание — фраза «отвечу в течение пяти минут»
    // возвращалась в код дважды, и оба раза владелец видел её у себя в чате.
    $say(chat_wait_notice($delay, 'Мария', true) === '',
         'подтверждение приёма вопроса не отправляется');

    /* 2. Участник Клуба */
    club_boot();
    $until = date('Y-m-d H:i:s', strtotime('+30 days'));
    q("INSERT INTO club_members (user_id, active, expires_at) VALUES (:u,1,:p)",
      ['u' => $uid, 'p' => $until]);
    $say(chat_is_vip($uid), 'членство распознано');
    $say(chat_reply_delay_sec($uid) === 0, 'участнику Клуба ответ моментальный');

    /* 3. Отложенный показ в истории */
    $future = date('Y-m-d H:i:s', time() + 300);
    $mid = (int) insert('chat_messages', [
        'user_id' => $uid, 'session_key' => $sessionKey, 'role' => 'assistant',
        'text' => 'ответ в очереди', 'file' => '', 'visible_at' => $future,
    ]);
    $now = (int) (scalar("SELECT COUNT(*) FROM chat_messages
                           WHERE id=? AND (COALESCE(visible_at,'')='' OR visible_at <= datetime('now','localtime'))",
                         [$mid]) ?? 0);
    $say($now === 0, 'отложенный ответ пока не виден участнику');

    q("UPDATE chat_messages SET visible_at=datetime('now','localtime','-1 minute') WHERE id=?", [$mid]);
    $later = (int) (scalar("SELECT COUNT(*) FROM chat_messages
                             WHERE id=? AND (COALESCE(visible_at,'')='' OR visible_at <= datetime('now','localtime'))",
                           [$mid]) ?? 0);
    $say($later === 1, 'по наступлении срока ответ появляется');

    $plain = (int) insert('chat_messages', [
        'user_id' => $uid, 'session_key' => $sessionKey, 'role' => 'assistant',
        'text' => 'моментальный ответ', 'file' => '',
    ]);
    $seen = (int) (scalar("SELECT COUNT(*) FROM chat_messages
                            WHERE id=? AND (COALESCE(visible_at,'')='' OR visible_at <= datetime('now','localtime'))",
                          [$plain]) ?? 0);
    $say($seen === 1, 'ответ без отметки времени виден сразу');

    /* 4. Обещания на витрине совпадают с поведением */
    $club = @file_get_contents(BASE_PATH . '/templates/site/pages/club.php') ?: '';
    $say(!str_contains($club, 'Ответ в течение 24 часов'), 'со страницы Клуба убрано обещание про сутки');
    $say(str_contains($club, 'Моментальный ответ'), 'страница Клуба обещает моментальный ответ');
    $camp = @file_get_contents(BASE_PATH . '/core/mail_campaigns.php') ?: '';
    $say(!str_contains($camp, 'Ответ в течение 24 часов'), 'из письма о Клубе убрано обещание про сутки');

} catch (\Throwable $e) {
    $say(false, 'проверка прервана', $e->getMessage());
} finally {
    q("DELETE FROM chat_messages WHERE session_key=?", [$sessionKey]);
    try { q("DELETE FROM club_members WHERE user_id=?", [$uid]); } catch (\Throwable $e) {}
    q("DELETE FROM users WHERE id=?", [$uid]);
    $left = (int) (scalar("SELECT COUNT(*) FROM users WHERE id=?", [$uid]) ?? 0);
    $say($left === 0, 'временные записи удалены');
}

echo "\n$line\nПРОЙДЕНО: $ok · СБОЕВ: $bad\n";
exit($bad > 0 ? 1 : 0);
