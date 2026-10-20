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
    if (!vk_configured()) { cron_unlock(JOB); exit(0); }

    /* ПРОЩАНИЕ - СЛОВО ЦЕНТРА ПО СВОЕЙ ВОЛЕ, А НЕ ОТВЕТ НА ВОПРОС, И ПОТОМУ
       ЖДЁТ РАБОЧИХ ЧАСОВ (правило 7: наружу ничего не уходит ночью и в
       воскресенье). Сторож ходит каждые десять минут круглосуточно, и окна у
       него не стояло: человек, спросивший в 23:20 и ушедший спать, получал в
       полночь «Благодарим Вас за обращение» - в тот самый час, про который сам
       же этот текст обещает «ВЫХОДНОЙ».
       Часы берём СВОИ, объявленные центром (`chat_is_working_hours`: пн-пт
       09-18, сб 09-16, вс выходной), а не общее окно охвата 09-19: бот не имеет
       права писать в час, когда его собственное прощание обещает тишину.
       Ответы на вопросы это не трогает: их держит отдельная мерка
       `chat_offhours_hold`, и ночной вопрос получает ответ утром. */
    if (function_exists('chat_is_working_hours') && !chat_is_working_hours()) {
        cron_log(JOB, 'нерабочее время - прощания ждут утра');
        cron_unlock(JOB); exit(0);
    }
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
        /* ВЕРХНЯЯ ГРАНИЦА - ДВЕНАДЦАТЬ ЧАСОВ, А НЕ ДВОЕ СУТОК.
           Двое суток стояли, пока сторож работал круглосуточно: разговор,
           затихший вечером, он закрывал в ту же ночь. С рабочими часами
           (см. выше) такой разговор дождался бы утра, и человек получал бы
           «Благодарим Вас за обращение» через четырнадцать часов после своего
           последнего слова - про беседу, о которой уже забыл. Прощание имеет
           смысл по свежему следу; опоздало - молчим, это вежливее. */
        $ageOk = static function (string $ts): bool {
            $t = strtotime($ts . ' UTC') ?: strtotime($ts);
            return $t > 0 && (time() - $t) >= 30 * 60 && (time() - $t) <= 12 * 3600;
        };

        // Молчание после нашего ответа — закрываем диалог. Промежуточного
        // «есть ли ещё вопросы?» больше нет, см. пояснение в шапке файла.
        // 'assistant_followup' оставлен в условии ради диалогов, где этот вопрос
        // успел уйти до правки: их тоже надо довести до конца.
        if (($role === 'assistant' || $role === 'assistant_followup') && $ageOk((string) $r['created_at'])) {
            $hasUser = (int) scalar("SELECT COUNT(*) FROM chat_messages WHERE session_key=? AND role='user' AND text<>''", [$sk]);
            if (!$hasUser) continue;

            /* ИСТОРИЮ СНАЧАЛА ВЫРАВНИВАЕМ ПО ВК, И ТОЛЬКО ПОТОМ СУДИМ.
               Оператор отвечает и прощается прямо из интерфейса ВКонтакте, а в
               базе таких сообщений нет вовсе. 14.10.2026 сторож именно поэтому
               не увидел операторского прощания в 15:03 и попрощался сам в 18:40:
               участница получила пятое прощание и третье приглашение
               зарегистрироваться, не написав ни слова после «спасибо». */
            if (function_exists('vk_import_outgoing')) vk_import_outgoing($peer, $sk);

            $name = vk_user_name($peer);
            /* Тот же вопрос, что и в живом ответе: есть ли у этой страницы кабинет
               на сайте. Нет - прощание уходит с приглашением зарегистрироваться.
               Смотрим не только привязку `users.vk_id` (её почти ни у кого нет), а
               `chat_vk_kabinet_est` - см. пояснение у самой функции. */
            $естьКабинет = function_exists('chat_vk_kabinet_est')
                ? chat_vk_kabinet_est($peer)
                : ((int) (scalar("SELECT id FROM users WHERE vk_id = ?", [(string) $peer]) ?: 0) > 0);

            $msg = chat_closing_message($name, $естьКабинет ? 1 : null, $sk);
            /* ПУСТО - ЗНАЧИТ ПРОЩАНИЕ УЖЕ БЫЛО после последнего слова участника
               (его мог сказать и оператор руками). Молчим: диалог и так закрыт. */
            if (trim($msg) === '') { chat_mark_dialog_end($sk); continue; }

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
