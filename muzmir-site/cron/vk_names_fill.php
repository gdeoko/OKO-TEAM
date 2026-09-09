<?php
/**
 * ИМЕНА СОБЕСЕДНИКОВ ВК — ФОНОМ, ОДНИМ ЗАПРОСОМ И РЕДКО.
 *
 * В админке диалог подписан именем человека, а имя знает только API ВКонтакте.
 * Раньше за ним ходили прямо во время отрисовки списка — по запросу на каждый
 * диалог; сотня диалогов превращала «Чат-бот» в страницу, которая грузится
 * минутами и держит процесс PHP. Поэтому имена собираются здесь, фоном.
 *
 * НО СОБИРАТЬ ИХ ТОЖЕ НАДО ПО-ЧЕЛОВЕЧЕСКИ.
 *
 * Первая версия этого задания спрашивала ВК ПО ОДНОМУ имени за запрос —
 * двадцать пять запросов каждые семь минут, а повтор в core/vk.php превращал
 * каждый в четыре. 8 сентября в 15:30 ВКонтакте закрыл токен сообщества
 * «Flood control», и закрыл надолго: бот перестал отвечать участникам во ВК,
 * а в админке появилось «проверьте токен сообщества» — хотя токен был цел.
 * Задание, которое чинило админку, сломало живое общение с людьми.
 *
 * Теперь так: users.get принимает до тысячи идентификаторов за раз, и мы
 * спрашиваем всю пачку ОДНИМ запросом. Раз в час, сотня имён за заход — этого
 * с запасом хватает: новые диалоги появляются десятками в день, а не тысячами.
 * Ответил отказом по темпу — молча уходим до следующего часа.
 *
 * Расписание: 23 * * * * (раз в час).
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

/* ЖИВОЕ ОБЩЕНИЕ ВАЖНЕЕ ПОДПИСЕЙ В СПИСКЕ.
 * Если ВК сейчас в отказе по темпу, к нему не идём вовсе: имя подождёт, а
 * лишний запрос отодвинет момент, когда бот снова сможет отвечать людям. */
if ((int) setting('vk_flood_until', '0') > time()) {
    echo "ВК держит паузу по темпу — имена подождут\n";
    cron_unlock('vk_names_fill');
    exit(0);
}

$limit = 100;
$rows = all("SELECT DISTINCT m.session_key
               FROM chat_messages m
          LEFT JOIN chat_dialogs d ON d.session_key = m.session_key
              WHERE m.session_key LIKE 'vk\\_%' ESCAPE '\\'
                AND COALESCE(d.title,'') = ''
           ORDER BY m.id DESC
              LIMIT ?", [$limit]);

$peers = [];
foreach ($rows as $r) {
    $sk = (string) $r['session_key'];
    $peer = (int) substr($sk, 3);
    // Групповые чаты (peer >= 2e9) именами не подписываются — там нет одного человека.
    if ($peer > 0 && $peer < 2000000000) $peers[$peer] = $sk;
}
if (!$peers) { echo "новых имён нет\n"; cron_unlock('vk_names_fill'); exit(0); }

$r = vk_api('users.get', ['user_ids' => implode(',', array_keys($peers)), 'fields' => 'first_name,last_name']);
if (isset($r['error'])) {
    $msg = (string) ($r['error']['error_msg'] ?? '?');
    cron_log('vk_names_fill', 'ВК не отдал имена: ' . $msg);
    echo "ВК не отдал имена: $msg\n";
    cron_unlock('vk_names_fill');
    exit(0);
}

$ok = 0;
foreach ((array) ($r['response'] ?? []) as $u) {
    $peer = (int) ($u['id'] ?? 0);
    if ($peer <= 0 || !isset($peers[$peer])) continue;
    $name = trim(((string) ($u['first_name'] ?? '')) . ' ' . ((string) ($u['last_name'] ?? '')));
    if ($name === '') continue;
    $sk = $peers[$peer];
    try {
        if (function_exists('chat_dialog_set')) chat_dialog_set($sk, ['title' => $name]);
        else {
            $has = one("SELECT session_key FROM chat_dialogs WHERE session_key=?", [$sk]);
            if ($has) update('chat_dialogs', ['title' => $name], 'session_key=:s', ['s' => $sk]);
            else      insert('chat_dialogs', ['session_key' => $sk, 'title' => $name]);
        }
        $ok++;
    } catch (\Throwable $e) { /* имя не критично */ }
}

if ($ok > 0) cron_log('vk_names_fill', "имена ВК: сохранено $ok за один запрос");
cron_unlock('vk_names_fill');
echo "сохранено $ok из " . count($peers) . " (один запрос к ВК)\n";
