<?php
/**
 * ИМЕНА СОБЕСЕДНИКОВ ВК — ФОНОМ, А НЕ ПРИ ОТКРЫТИИ СТРАНИЦЫ.
 *
 * В админке диалог подписан именем человека, а имя знает только API ВКонтакте.
 * Раньше за ним ходили прямо во время отрисовки списка — по запросу на каждый
 * диалог, с таймаутом в 25 секунд и четырьмя попытками. Сотня диалогов в
 * списке превращала «Чат-бот» в страницу, которая грузится минутами и держит
 * процесс PHP; когда такие запросы копились, вставала вся админка.
 *
 * Теперь имена собираются здесь: небольшими порциями, раз в несколько минут, и
 * складываются в chat_dialogs.title. Страница читает готовое из базы и
 * открывается мгновенно. Не ответил ВК — не беда, попробуем в следующий раз.
 */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { fwrite(STDERR, "CLI only\n"); exit(1); }

define('BASE_PATH', dirname(__DIR__));
$GLOBALS['CFG'] = require BASE_PATH . '/config.php';
require_once BASE_PATH . '/cron/_lib.php';
require_once BASE_PATH . '/core/db.php';
require_once BASE_PATH . '/core/helpers.php';
require_once BASE_PATH . '/core/vk.php';
if (is_file(BASE_PATH . '/core/chat_dialogs.php')) require_once BASE_PATH . '/core/chat_dialogs.php';

if (!cron_lock('vk_names_fill', 600)) exit(0);

/* Порция маленькая намеренно: ВК разрешает три запроса в секунду, а спешить
 * некуда — имя нужно к следующему открытию админки, а не сию секунду. */
$limit = 25;
$rows = all("SELECT DISTINCT m.session_key
               FROM chat_messages m
          LEFT JOIN chat_dialogs d ON d.session_key = m.session_key
              WHERE m.session_key LIKE 'vk\\_%' ESCAPE '\\'
                AND COALESCE(d.title,'') = ''
           ORDER BY m.id DESC
              LIMIT ?", [$limit]);

$ok = 0; $fail = 0;
foreach ($rows as $r) {
    $sk   = (string) $r['session_key'];
    $peer = (int) substr($sk, 3);
    if ($peer <= 0) continue;
    $name = '';
    try { $name = trim(vk_user_name($peer)); } catch (\Throwable $e) { $name = ''; }
    if ($name === '') { $fail++; continue; }
    try {
        if (function_exists('chat_dialog_set')) chat_dialog_set($sk, ['title' => $name]);
        else {
            $has = one("SELECT session_key FROM chat_dialogs WHERE session_key=?", [$sk]);
            if ($has) update('chat_dialogs', ['title' => $name], 'session_key=:s', ['s' => $sk]);
            else      insert('chat_dialogs', ['session_key' => $sk, 'title' => $name]);
        }
        $ok++;
    } catch (\Throwable $e) { $fail++; }
    usleep(400000);   // три запроса в секунду — предел ВКонтакте
}

if ($ok > 0 || $fail > 0) cron_log('vk_names_fill', "имена ВК: сохранено $ok, не отдал $fail");
cron_unlock('vk_names_fill');
echo "сохранено $ok, не отдал $fail\n";
