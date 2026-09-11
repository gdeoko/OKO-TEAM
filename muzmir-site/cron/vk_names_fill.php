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
 * Теперь так: спрашиваем всю пачку ОДНИМ запросом, раз в час, сотня имён за
 * заход — этого с запасом хватает: новые диалоги появляются десятками в день,
 * а не тысячами. Ответил отказом по темпу — молча уходим до следующего часа.
 *
 * ИМЕНА БЕРЁМ ИЗ ПЕРЕПИСКИ, А НЕ ИЗ ПРОФИЛЕЙ.
 *
 * Ключ сообщества на `users.get` отвечает пустым списком — без ошибки, просто
 * ничем: читать чужие профили сообществу не положено. Зато
 * `messages.getConversations` с extended=1 отдаёт вместе с диалогами и
 * `profiles` — имена ровно тех людей, которые нам написали. Это и правильнее по
 * смыслу: центр знает по имени собеседника, а не произвольного пользователя ВК.
 *
 * Кого перепиской не покрыли (старые диалоги за пределами выдачи) — дозапросим
 * личным ключом владельца, если он сейчас отвечает. Не отвечает — подписи
 * подождут, на работу бота это не влияет.
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

/* Шаг первый: имена из переписки сообщества. Три страницы по двести диалогов —
 * это шестьсот последних собеседников, свежие диалоги покрываются целиком. */
$found = [];                       // peer => «Имя Фамилия»
$gid   = (int) cfgv('vk_group_id', 211325055);
for ($page = 0; $page < 3; $page++) {
    $c = vk_api('messages.getConversations', [
        'group_id' => $gid, 'count' => 200, 'offset' => $page * 200,
        'extended' => 1, 'fields' => 'first_name,last_name',
    ]);
    if (isset($c['error'])) {
        $msg = (string) ($c['error']['error_msg'] ?? '?');
        cron_log('vk_names_fill', 'ВК не отдал переписку: ' . $msg);
        break;
    }
    foreach ((array) ($c['response']['profiles'] ?? []) as $u) {
        $id = (int) ($u['id'] ?? 0);
        if ($id > 0) $found[$id] = trim(((string) ($u['first_name'] ?? '')) . ' ' . ((string) ($u['last_name'] ?? '')));
    }
    if (count((array) ($c['response']['items'] ?? [])) < 200) break;
    usleep(350000);
}

/* Шаг второй: кого перепиской не нашли — личным ключом владельца, одним
 * запросом. У него свой предохранитель: закрыт — просто пропускаем. */
$left = array_diff_key($peers, $found);
$userTok = trim((string) cfgv('vk_token', ''));
if ($left && $userTok !== '' && vk_user_key_usable($userTok)
    && (int) setting('vk_flood_until_user', '0') <= time()) {
    $r = vk_api_with('users.get',
                     ['user_ids' => implode(',', array_keys($left)), 'fields' => 'first_name,last_name'],
                     $userTok, 'vk_flood_until_user');
    foreach ((array) ($r['response'] ?? []) as $u) {
        $id = (int) ($u['id'] ?? 0);
        if ($id > 0) $found[$id] = trim(((string) ($u['first_name'] ?? '')) . ' ' . ((string) ($u['last_name'] ?? '')));
    }
}

$ok = 0;
foreach ($found as $peer => $name) {
    if (!isset($peers[$peer]) || trim($name) === '') continue;
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

if ($ok > 0) cron_log("vk_names_fill", "имена ВК: сохранено $ok");
cron_unlock('vk_names_fill');
echo "сохранено $ok из " . count($peers) . "\n";
