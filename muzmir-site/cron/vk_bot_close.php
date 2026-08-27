<?php
/**
 * Завершение диалогов бота ВК при молчании пользователя.
 * Запуск раз в ~10 минут через cron (см. scripts/crontab.txt).
 *   php /var/www/muzmir/cron/vk_bot_close.php >/dev/null 2>&1
 *
 * Логика (только диалоги ВК, session_key = vk_<peer>):
 *   последний в диалоге — наш ответ, пользователь молчит 30+ минут → шлём финал
 *   «Благодарим Вас за обращение…» и помечаем диалог завершённым.
 *
 * СТУПЕНЬ «ЕСТЬ ЛИ У ВАС ЕЩЁ ВОПРОСЫ?» УБРАНА.
 *
 * Она была лишней и местами нелепой: человек писал ночью, бот отвечал, что сейчас
 * нерабочее время, — и через полчаса сам же спрашивал, есть ли ещё вопросы. Ответа
 * на такое не ждут. Решение владельца: по факту вопрос — по факту ответ, без
 * дежурных фраз. Молчит человек — просто вежливо закрываем диалог.
 *
 * Роль 'assistant_followup' в старых записях остаётся: удалять историю переписки
 * незачем, а новых записей с ней больше не появляется.
 */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { fwrite(STDERR, "CLI only\n"); exit(1); }

define('BASE_PATH', dirname(__DIR__));
$GLOBALS['CFG'] = require BASE_PATH . '/config.php';
require_once BASE_PATH . '/core/db.php';
require_once BASE_PATH . '/core/helpers.php';
require_once BASE_PATH . '/core/vk.php';
require_once BASE_PATH . '/core/chat_brain.php';
require_once BASE_PATH . '/core/chat_ops.php';
require_once __DIR__ . '/_lib.php';

const JOB = 'vk_bot_close';
if (!cron_lock(JOB, 600)) exit(0);

try {
    if (trim((string) cfgv('vk_token', '')) === '') { cron_unlock(JOB); exit(0); }
    // Бот выключен целиком (chat_bot_enabled=0) — молчим и здесь. Иначе человек,
    // которому бот не ответил, получил бы от него «благодарим за обращение».
    if (function_exists('chat_bot_enabled') && !chat_bot_enabled()) { cron_unlock(JOB); exit(0); }

    // Последнее сообщение каждого диалога ВК.
    $lastRows = all(
        "SELECT cm.session_key, cm.role, cm.created_at, cm.id
           FROM chat_messages cm
           JOIN (SELECT session_key, MAX(id) mid FROM chat_messages
                  WHERE session_key LIKE 'vk\\_%' ESCAPE '\\' GROUP BY session_key) t
             ON t.session_key = cm.session_key AND t.mid = cm.id"
    );

    $nClose = 0;
    foreach ($lastRows as $r) {
        $sk   = (string) $r['session_key'];
        $peer = (int) substr($sk, 3);
        if ($peer <= 0 || $peer >= 2000000000) continue;
        $role = (string) $r['role'];
        $ageOk = static function (string $ts): bool {
            $t = strtotime($ts . ' UTC') ?: strtotime($ts);
            return $t > 0 && (time() - $t) >= 30 * 60 && (time() - $t) <= 2 * 86400;
        };

        // Молчание после нашего ответа — закрываем диалог. Промежуточного
        // «есть ли ещё вопросы?» больше нет, см. пояснение в шапке файла.
        // 'assistant_followup' оставлен в условии ради диалогов, где этот вопрос
        // успел уйти до правки: их тоже надо довести до конца.
        if (($role === 'assistant' || $role === 'assistant_followup') && $ageOk((string) $r['created_at'])) {
            $hasUser = (int) scalar("SELECT COUNT(*) FROM chat_messages WHERE session_key=? AND role='user' AND text<>''", [$sk]);
            if (!$hasUser) continue;
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

    cron_log(JOB, "closing={$nClose}");
} catch (\Throwable $e) {
    cron_log(JOB, 'err: ' . $e->getMessage());
}
cron_unlock(JOB);
