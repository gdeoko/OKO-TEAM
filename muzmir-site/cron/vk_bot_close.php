<?php
/**
 * Двухступенчатое завершение диалогов бота ВК при молчании пользователя.
 * Запуск раз в ~10 минут через cron (см. scripts/crontab.txt).
 *   php /var/www/muzmir/cron/vk_bot_close.php >/dev/null 2>&1
 *
 * Логика (только диалоги ВК, session_key = vk_<peer>):
 *  1) Если последний в диалоге — наш обычный ответ (role='assistant') и с момента
 *     ответа прошло >= 30 минут, а пользователь молчит → шлём «Есть ли у Вас ещё
 *     вопросы?» (role='assistant_followup').
 *  2) Если последний — уже наш вопрос «ещё вопросы?» (role='assistant_followup')
 *     и снова >= 30 минут тишины → шлём финал «Благодарим Вас за обращение… С
 *     уважением…» (chat_closing_message) и помечаем диалог завершённым (dialog_end).
 * Если пользователь ответит — вебхук запишет его сообщение и наш новый ответ,
 * и цикл начнётся заново (либо, при «спасибо», вебхук сразу пришлёт финал).
 */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { fwrite(STDERR, "CLI only\n"); exit(1); }

define('BASE_PATH', dirname(__DIR__));
$GLOBALS['CFG'] = require BASE_PATH . '/config.php';
require_once BASE_PATH . '/core/db.php';
require_once BASE_PATH . '/core/helpers.php';
require_once BASE_PATH . '/core/vk.php';
require_once BASE_PATH . '/core/chat_brain.php';
require_once __DIR__ . '/_lib.php';

const JOB = 'vk_bot_close';
if (!cron_lock(JOB, 600)) exit(0);

try {
    if (trim((string) cfgv('vk_token', '')) === '') { cron_unlock(JOB); exit(0); }

    // Последнее сообщение каждого диалога ВК.
    $lastRows = all(
        "SELECT cm.session_key, cm.role, cm.created_at, cm.id
           FROM chat_messages cm
           JOIN (SELECT session_key, MAX(id) mid FROM chat_messages
                  WHERE session_key LIKE 'vk\\_%' ESCAPE '\\' GROUP BY session_key) t
             ON t.session_key = cm.session_key AND t.mid = cm.id"
    );

    $nFollow = 0; $nClose = 0;
    foreach ($lastRows as $r) {
        $sk   = (string) $r['session_key'];
        $peer = (int) substr($sk, 3);
        if ($peer <= 0 || $peer >= 2000000000) continue;
        $role = (string) $r['role'];
        $ageOk = static function (string $ts): bool {
            $t = strtotime($ts . ' UTC') ?: strtotime($ts);
            return $t > 0 && (time() - $t) >= 30 * 60 && (time() - $t) <= 2 * 86400;
        };

        // Шаг 1 — «Есть ли ещё вопросы?» после обычного ответа.
        if ($role === 'assistant' && $ageOk((string) $r['created_at'])) {
            $hasUser = (int) scalar("SELECT COUNT(*) FROM chat_messages WHERE session_key=? AND role='user' AND text<>''", [$sk]);
            if (!$hasUser) continue;
            $q = 'Есть ли у Вас ещё вопросы? Будем рады помочь. 🙂';
            $res = vk_dm_send($peer, $q, '', random_int(1, 2000000000));
            if (isset($res['response'])) {
                insert('chat_messages', ['user_id' => null, 'session_key' => $sk, 'role' => 'assistant_followup', 'text' => $q, 'file' => '']);
                $nFollow++;
            }
            usleep(200000);
            continue;
        }

        // Шаг 2 — финал после «ещё вопросы?» без ответа.
        if ($role === 'assistant_followup' && $ageOk((string) $r['created_at'])) {
            $name = vk_user_name($peer);
            $msg  = chat_closing_message($name);
            $res  = vk_dm_send($peer, $msg, '', random_int(1, 2000000000));
            if (isset($res['response'])) {
                insert('chat_messages', ['user_id' => null, 'session_key' => $sk, 'role' => 'assistant', 'text' => $msg, 'file' => '']);
                chat_mark_dialog_end($sk);
                $nClose++;
            }
            usleep(200000);
        }
    }

    cron_log(JOB, "followup={$nFollow} closing={$nClose}");
} catch (\Throwable $e) {
    cron_log(JOB, 'err: ' . $e->getMessage());
}
cron_unlock(JOB);
