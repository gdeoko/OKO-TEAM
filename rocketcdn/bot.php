<?php
/* ══════════════════════════════════════════════════════════
   Rocket CDN · телеграм-бот @rocket_cdn_bot

   Запуск по расписанию раз в минуту:
     * * * * * /usr/bin/php /var/www/rocketcdn/bot.php >/dev/null 2>&1
   Внутри крутится шесть циклов по десять секунд, поэтому
   реакция на сообщения почти мгновенная.

   Меню нижнее (reply keyboard), отдельное для админов и для гостей.
   Мини-приложение открывается кнопкой web_app.
   ══════════════════════════════════════════════════════════ */

require __DIR__ . '/config.php';

if (php_sapi_name() !== 'cli' && ($_GET['key'] ?? '') !== rc_cfg('admin_key')) {
    http_response_code(403); exit('forbidden');
}
@set_time_limit(120);
ignore_user_abort(true);

define('OFFSET_FILE', RC_DATA . '/tg_offset.txt');
define('LOCK_FILE',   RC_DATA . '/bot.lock');

/* Один экземпляр за раз */
$lock = fopen(LOCK_FILE, 'c');
if (!$lock || !flock($lock, LOCK_EX | LOCK_NB)) exit;

$APP_URL = rtrim(rc_cfg('site_url'), '/') . '/app.html';

function is_admin($uid) { return in_array((int)$uid, array_map('intval', (array)rc_cfg('tg_admins', [])), true); }

function menu_admin() {
    return ['keyboard' => [
        [['text' => 'Аналитика'], ['text' => 'Заявки']],
        [['text' => 'Сеть'], ['text' => 'Мини-приложение', 'web_app' => ['url' => $GLOBALS['APP_URL']]]],
        [['text' => 'Настройки'], ['text' => 'Помощь']],
    ], 'resize_keyboard' => true, 'is_persistent' => true];
}
function menu_user() {
    return ['keyboard' => [
        [['text' => 'О сервисе'], ['text' => 'Продукты']],
        [['text' => 'Инфраструктура'], ['text' => 'Мини-приложение', 'web_app' => ['url' => $GLOBALS['APP_URL']]]],
        [['text' => 'Подключение'], ['text' => 'Поддержка']],
    ], 'resize_keyboard' => true, 'is_persistent' => true];
}
function menu_for($uid) { return is_admin($uid) ? menu_admin() : menu_user(); }

function say($chat, $text, $uid = null, $inline = null, $topic = null) {
    $p = ['chat_id' => $chat, 'text' => $text, 'parse_mode' => 'HTML', 'disable_web_page_preview' => true];
    if ($topic) $p['message_thread_id'] = (int)$topic;
    if ($inline) $p['reply_markup'] = ['inline_keyboard' => $inline];
    elseif ($uid !== null) $p['reply_markup'] = menu_for($uid);
    return rc_tg('sendMessage', $p);
}

function save_binding($k, $v) {
    $f = RC_DATA . '/bindings.json';
    $d = rc_json_read($f, []);
    $d[$k] = $v;
    rc_json_write($f, $d);
}

/* ── Тексты ──────────────────────────────────────────────── */
function txt_about() {
    return "<b>Rocket CDN</b>\n<i>Fast. Reliable. Global.</i>\n\n"
        . "Сеть доставки контента и медиа-инфраструктура для бизнеса.\n\n"
        . "· 218 точек присутствия на пяти континентах\n"
        . "· Три собственных дата-центра: Москва, Казахстан, Прага\n"
        . "· Доступность по SLA 99,9%\n"
        . "· Пропускная способность в России более 3 Тбит/с\n"
        . "· Более 1 500 000 зрителей одновременно\n"
        . "· Поддержка круглосуточно\n\n"
        . rc_cfg('site_url');
}
function txt_products() {
    return "<b>Продукты Rocket CDN</b>\n\n"
        . "<b>CDN</b> - кэширование и раздача статики, видео и больших файлов.\n"
        . "<b>Стриминг</b> - живые трансляции и видео по запросу на любую аудиторию.\n"
        . "<b>Медиа-хранилище</b> - объектное хранилище с прямой отдачей в сеть.\n"
        . "<b>Плеер</b> - адаптивное качество, ваш бренд, аналитика просмотров.\n"
        . "<b>Облако</b> - виртуальные машины на AMD и Intel, ARM и GPU под Big Data и AI.\n"
        . "<b>Безопасность</b> - фильтрация атак L3-L7 и защита origin.\n"
        . "<b>Виртуальный диктор</b> - синтез речи для озвучки роликов.";
}
function txt_infra() {
    $geo = rc_nodes_summary();
    $s = "<b>Инфраструктура</b>\n\nВсего точек присутствия: <b>{$geo['total']}</b>\n";
    foreach ($geo['regions'] as $name => $n) $s .= "· {$name}: {$n}\n";
    $s .= "\nСобственные ЦОД: Москва, Алматы, Прага.\n";
    $s .= "Облачные площадки: {$geo['cloud']}, узлы с защитой: {$geo['shield']}, готовятся: {$geo['soon']}.";
    return $s;
}
function txt_connect() {
    return "<b>Подключение</b>\n\n"
        . "Технически ресурс создаётся за несколько минут, боевой трафик обычно переключаем за один рабочий день.\n\n"
        . "Стоимость считается по фактически отданному трафику. Чем больше объём, тем ниже цена за единицу.\n\n"
        . "Оставьте заявку на сайте или напишите сюда, что нужно раздавать и какой ожидаете объём.";
}
function txt_support() {
    return "<b>Поддержка</b>\n\n"
        . "Инженеры на связи круглосуточно.\n\n"
        . "Личный кабинет: " . rc_cfg('lk_url') . "\n"
        . "Сайт: " . rc_cfg('site_url') . "\n"
        . "Почта: " . (rc_cfg('mail_to') ?: 'info@rocketcdn.ru') . "\n\n"
        . "Опишите вопрос сообщением, мы передадим его дежурному инженеру.";
}
function txt_help($uid) {
    if (is_admin($uid)) {
        return "<b>Команды администратора</b>\n\n"
            . "/stats - сводка за неделю\n"
            . "/stats 30 - сводка за 30 дней\n"
            . "/leads - последние заявки\n"
            . "/bindchat - привязать текущий чат и тему для уведомлений\n"
            . "/unbind - отвязать чат\n"
            . "/id - показать id чата и темы\n"
            . "/site - ссылки на сайт и админку\n\n"
            . "Нижнее меню открывает те же разделы кнопками.";
    }
    return "Напишите вопрос сообщением, мы ответим. Нижнее меню открывает разделы о сервисе.";
}

/* ── Данные сети из rc-geo.js ────────────────────────────── */
function rc_nodes_summary() {
    static $cache = null;
    if ($cache !== null) return $cache;
    $file = RC_ROOT . '/assets/rc-geo.js';
    $src  = is_file($file) ? file_get_contents($file) : '';
    $regionNames = ['Россия и СНГ', 'Азия и Восток', 'Европа', 'Северная Америка', 'Южная Америка'];
    $regions = array_fill_keys($regionNames, 0);
    $total = $cloud = $shield = $soon = 0;
    if (preg_match_all('~\["([^"]+)",\s*(-?[\d.]+),\s*(-?[\d.]+),\s*(\d),\s*(\d)\]~u', $src, $m, PREG_SET_ORDER)) {
        foreach ($m as $x) {
            $total++;
            $r = (int)$x[4]; $f = (int)$x[5];
            if (isset($regionNames[$r])) $regions[$regionNames[$r]]++;
            if ($f & 1) $cloud++;
            if ($f & 2) $shield++;
            if ($f & 4) $soon++;
        }
    }
    return $cache = compact('total', 'regions', 'cloud', 'shield', 'soon');
}

/* ── Сводка аналитики ────────────────────────────────────── */
function stats_text($days = 7) {
    $days = max(1, min(90, (int)$days));
    $tot = ['views' => 0, 'uniq' => 0, 'leads' => 0, 'callbacks' => 0, 'register' => 0, 'connect' => 0];
    $refs = []; $dev = []; $err = 0;
    $rows = [];
    for ($i = $days - 1; $i >= 0; $i--) {
        $day = date('Y-m-d', strtotime("-{$i} day"));
        $d = rc_json_read(RC_STATS . '/' . $day . '.json', []);
        $ev = $d['events'] ?? [];
        $row = [
            'day'   => $day,
            'views' => (int)($d['views'] ?? 0),
            'uniq'  => count($d['uniq'] ?? []),
            'leads' => (int)($d['leads'] ?? 0) ,
            'cb'    => (int)($d['callbacks'] ?? 0),
            'reg'   => (int)($ev['register'] ?? 0),
        ];
        $rows[] = $row;
        $tot['views'] += $row['views']; $tot['uniq'] += $row['uniq'];
        $tot['leads'] += $row['leads']; $tot['callbacks'] += $row['cb'];
        $tot['register'] += $row['reg']; $tot['connect'] += (int)($ev['connect'] ?? 0);
        foreach (($d['refs'] ?? []) as $k => $v)    $refs[$k] = ($refs[$k] ?? 0) + $v;
        foreach (($d['devices'] ?? []) as $k => $v) $dev[$k] = ($dev[$k] ?? 0) + $v;
        $err += array_sum($d['errors'] ?? []);
    }
    arsort($refs);
    $conv = $tot['uniq'] ? round(($tot['leads'] + $tot['callbacks']) / $tot['uniq'] * 100, 1) : 0;

    $s = "<b>Аналитика сайта за " . $days . " дн.</b>\n\n"
       . "Просмотры: <b>{$tot['views']}</b>\n"
       . "Уникальные: <b>{$tot['uniq']}</b>\n"
       . "Клики «Регистрация»: <b>{$tot['register']}</b>\n"
       . "Заявки: <b>{$tot['leads']}</b>, звонки: <b>{$tot['callbacks']}</b>\n"
       . "Конверсия в заявку: <b>{$conv}%</b>\n";
    if ($err) $s .= "Ошибок на фронте: <b>{$err}</b>\n";

    $last = array_slice($rows, -7);
    $s .= "\n<b>По дням</b>\n<code>";
    foreach ($last as $r) {
        $s .= str_pad(date('d.m', strtotime($r['day'])), 6)
            . str_pad((string)$r['uniq'], 6)
            . str_pad((string)$r['reg'], 5)
            . ($r['leads'] + $r['cb']) . "\n";
    }
    $s .= "</code><i>дата · уники · клики · заявки</i>\n";

    if ($refs) {
        $s .= "\n<b>Источники</b>\n";
        $i = 0;
        foreach ($refs as $k => $v) { $s .= "· " . htmlspecialchars($k) . ": {$v}\n"; if (++$i >= 5) break; }
    }
    if ($dev) {
        $s .= "\n<b>Устройства</b>\n";
        foreach ($dev as $k => $v) $s .= "· {$k}: {$v}\n";
    }
    return $s;
}

function leads_text($limit = 8) {
    $d = rc_json_read(RC_LEADS, []);
    $items = array_reverse($d['items'] ?? []);
    if (!$items) return "Заявок пока нет.";
    $s = "<b>Последние заявки</b>\n";
    foreach (array_slice($items, 0, $limit) as $x) {
        $mark = ['new' => 'новая', 'work' => 'в работе', 'done' => 'закрыта', 'spam' => 'спам'][$x['status'] ?? 'new'] ?? 'новая';
        $s .= "\n<b>" . htmlspecialchars($x['name'] ?? '') . "</b> · " . ($x['kind'] === 'callback' ? 'звонок' : 'заявка') . " · {$mark}\n"
            . "<code>" . htmlspecialchars($x['contact'] ?? '') . "</code>\n"
            . (!empty($x['company']) ? htmlspecialchars($x['company']) . "\n" : '')
            . (!empty($x['topic']) ? 'Направление: ' . htmlspecialchars($x['topic']) . "\n" : '')
            . (!empty($x['task']) ? mb_substr(htmlspecialchars($x['task']), 0, 160) . "\n" : '')
            . "<i>" . ($x['ts'] ?? '') . "</i>\n";
    }
    return $s;
}

/* ── Снимаем вебхук один раз, иначе getUpdates не работает ── */
$flag = RC_DATA . '/.webhook_off';
if (rc_cfg('tg_token') && !is_file($flag)) {
    rc_tg('deleteWebhook', ['drop_pending_updates' => false]);
    @file_put_contents($flag, '1');
}
if (!rc_cfg('tg_token')) { rc_log('BOT: не задан tg_token'); exit; }

/* ── Основной цикл ───────────────────────────────────────── */
for ($loop = 0; $loop < 6; $loop++) {
    if ($loop > 0) sleep(9);

    $offset = is_file(OFFSET_FILE) ? (int)file_get_contents(OFFSET_FILE) : 0;
    $res = rc_tg('getUpdates', ['offset' => $offset, 'limit' => 50, 'timeout' => 0,
                                'allowed_updates' => ['message', 'callback_query', 'my_chat_member']]);
    if (empty($res['ok']) || empty($res['result'])) continue;

    foreach ($res['result'] as $u) {
        @file_put_contents(OFFSET_FILE, $u['update_id'] + 1);

        /* ── Нажатия на inline-кнопки ── */
        if (!empty($u['callback_query'])) {
            $cq   = $u['callback_query'];
            $uid  = $cq['from']['id'] ?? 0;
            $chat = $cq['message']['chat']['id'] ?? 0;
            $mid  = $cq['message']['message_id'] ?? 0;
            $data = $cq['data'] ?? '';
            rc_tg('answerCallbackQuery', ['callback_query_id' => $cq['id']]);
            if (!is_admin($uid)) continue;

            if (preg_match('~^lead_(work|done)_(\w+)$~', $data, $m)) {
                $st = $m[1] === 'work' ? 'work' : 'done';
                rc_json_update(RC_LEADS, function ($d) use ($m, $st) {
                    foreach (($d['items'] ?? []) as $i => $it) {
                        if (($it['id'] ?? '') === $m[2]) $d['items'][$i]['status'] = $st;
                    }
                    return $d;
                });
                $label = $st === 'work' ? 'взята в работу' : 'закрыта';
                rc_tg('editMessageReplyMarkup', ['chat_id' => $chat, 'message_id' => $mid,
                    'reply_markup' => ['inline_keyboard' => [[['text' => 'Заявка ' . $label, 'callback_data' => 'noop']]]]]);
            }
            if (preg_match('~^stats_(\d+)$~', $data, $m)) {
                say($chat, stats_text((int)$m[1]), $uid);
            }
            continue;
        }

        if (empty($u['message'])) continue;
        $msg  = $u['message'];
        $chat = $msg['chat']['id'];
        $uid  = $msg['from']['id'] ?? 0;
        $text = trim($msg['text'] ?? '');
        $topic = $msg['message_thread_id'] ?? null;
        $isGroup = in_array($msg['chat']['type'] ?? '', ['group', 'supergroup'], true);
        if ($text === '') continue;

        $cmd = strtolower(preg_replace('~@\w+$~', '', explode(' ', $text)[0]));
        $arg = trim(mb_substr($text, mb_strlen(explode(' ', $text)[0])));

        /* Команды, доступные в группе */
        if ($cmd === '/bindchat') {
            if (!is_admin($uid)) { say($chat, 'Команда только для администраторов.', $uid, null, $topic); continue; }
            save_binding('tg_chat', (string)$chat);
            if ($topic) save_binding('tg_topic_form', (string)$topic);
            say($chat, "Чат привязан.\nid чата: <code>{$chat}</code>"
                . ($topic ? "\nтема для заявок: <code>{$topic}</code>" : '')
                . "\n\nЧтобы задать темы для ошибок и аналитики, напишите в нужной теме /bindtopic errors или /bindtopic stats.",
                $uid, null, $topic);
            continue;
        }
        if ($cmd === '/bindtopic') {
            if (!is_admin($uid)) continue;
            $map = ['errors' => 'tg_topic_error', 'stats' => 'tg_topic_stat', 'forms' => 'tg_topic_form'];
            $k = $map[strtolower($arg)] ?? null;
            if (!$k) { say($chat, 'Укажите: /bindtopic forms, /bindtopic errors или /bindtopic stats', $uid, null, $topic); continue; }
            save_binding('tg_chat', (string)$chat);
            save_binding($k, (string)($topic ?: ''));
            say($chat, 'Тема закреплена за разделом «' . htmlspecialchars($arg) . '».', $uid, null, $topic);
            continue;
        }
        if ($cmd === '/unbind') {
            if (!is_admin($uid)) continue;
            foreach (['tg_chat', 'tg_topic_form', 'tg_topic_error', 'tg_topic_stat'] as $k) save_binding($k, '');
            say($chat, 'Привязка чата снята. Уведомления снова уходят администраторам в личку.', $uid, null, $topic);
            continue;
        }
        if ($cmd === '/id') {
            say($chat, "id чата: <code>{$chat}</code>\nid темы: <code>" . ($topic ?: 'нет') . "</code>\nваш id: <code>{$uid}</code>", $uid, null, $topic);
            continue;
        }

        /* В группе на остальное не отвечаем, чтобы не шуметь */
        if ($isGroup) continue;

        if ($cmd === '/start') {
            $hi = is_admin($uid)
                ? "<b>Rocket CDN</b>\nПанель управления сайтом.\n\nНижнее меню открывает аналитику, заявки и данные сети. Мини-приложение показывает сайт прямо в Телеграме."
                : "<b>Rocket CDN</b>\n<i>Fast. Reliable. Global.</i>\n\nГлобальная сеть доставки контента. Выберите раздел в меню внизу или откройте мини-приложение.";
            $inline = [[['text' => 'Открыть мини-приложение', 'web_app' => ['url' => $APP_URL]]],
                       [['text' => 'Личный кабинет', 'url' => rc_cfg('lk_url')]]];
            rc_tg('sendMessage', ['chat_id' => $chat, 'text' => $hi, 'parse_mode' => 'HTML',
                                  'reply_markup' => menu_for($uid)]);
            say($chat, 'Быстрый доступ:', null, $inline);
            continue;
        }

        if ($cmd === '/help' || $text === 'Помощь')      { say($chat, txt_help($uid), $uid); continue; }
        if ($text === 'О сервисе')                        { say($chat, txt_about(), $uid); continue; }
        if ($text === 'Продукты')                         { say($chat, txt_products(), $uid); continue; }
        if ($text === 'Инфраструктура' || $text === 'Сеть') { say($chat, txt_infra(), $uid); continue; }
        if ($text === 'Подключение') {
            say($chat, txt_connect(), null, [[['text' => 'Оставить заявку', 'url' => rc_cfg('site_url') . '#contact']],
                                             [['text' => 'Зарегистрироваться', 'url' => rc_cfg('lk_url')]]]);
            continue;
        }
        if ($text === 'Поддержка')                        { say($chat, txt_support(), $uid); continue; }
        if ($text === 'Мини-приложение') {
            say($chat, 'Мини-приложение открывается кнопкой в меню внизу.', null,
                [[['text' => 'Открыть', 'web_app' => ['url' => $APP_URL]]]]);
            continue;
        }

        /* Дальше только администраторы */
        if (!is_admin($uid)) {
            /* Обычное сообщение от гостя пересылаем команде */
            $from = trim(($msg['from']['first_name'] ?? '') . ' ' . ($msg['from']['last_name'] ?? ''));
            $un = !empty($msg['from']['username']) ? '@' . $msg['from']['username'] : ('id ' . $uid);
            rc_notify("<b>Сообщение боту</b>\n\nОт: " . htmlspecialchars($from) . " ({$un})\n\n" . htmlspecialchars($text), null, 'tg_topic_form');
            say($chat, 'Принято. Инженер ответит в ближайшее время.', $uid);
            continue;
        }

        if ($cmd === '/stats' || $text === 'Аналитика') {
            $days = (int)$arg ?: 7;
            say($chat, stats_text($days), null, [[
                ['text' => 'Сегодня', 'callback_data' => 'stats_1'],
                ['text' => '7 дней',  'callback_data' => 'stats_7'],
                ['text' => '30 дней', 'callback_data' => 'stats_30'],
            ]]);
            continue;
        }
        if ($cmd === '/leads' || $text === 'Заявки') { say($chat, leads_text(8), $uid); continue; }
        if ($text === 'Настройки' || $cmd === '/site') {
            $bound = rc_cfg('tg_chat') ? 'да' : 'нет';
            $mail  = rc_cfg('mail_user') ? 'настроена' : 'не настроена';
            say($chat, "<b>Настройки</b>\n\nСайт: " . rc_cfg('site_url')
                . "\nАдминка: " . rc_cfg('site_url') . "/admin.html"
                . "\nЛичный кабинет: " . rc_cfg('lk_url')
                . "\n\nЧат для уведомлений привязан: <b>{$bound}</b>\nПочта: <b>{$mail}</b>"
                . "\n\nЧтобы уведомления шли в общий чат, добавьте бота туда и напишите там /bindchat.",
                null, [[['text' => 'Открыть админку', 'url' => rc_cfg('site_url') . '/admin.html']]]);
            continue;
        }

        say($chat, 'Не понял команду. ' . txt_help($uid), $uid);
    }
}

flock($lock, LOCK_UN);
fclose($lock);
