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
/* Дневной отчёт собирается тем же кодом, что и в cron.php:
   команда /report обязана давать ровно то же, что приходит в 9:00 */
require __DIR__ . '/lib_report.php';

/* Пароль сверяем hash_equals: обычное сравнение выходит на первом
   несовпавшем знаке, и время ответа подсказывает подбирающему, сколько
   знаков он уже угадал. */
if (php_sapi_name() !== 'cli' && !hash_equals((string)rc_cfg('admin_key'), (string)($_GET['key'] ?? ''))) {
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
        [['text' => 'Состояние'], ['text' => 'Тексты сайта']],
        [['text' => 'Сеть'], ['text' => 'Мини-приложение', 'web_app' => ['url' => $GLOBALS['APP_URL']]]],
        [['text' => '🚀 Розыгрыш'], ['text' => 'Топ рефералов']],
        [['text' => 'Настройки'], ['text' => 'Помощь']],
    ], 'resize_keyboard' => true, 'is_persistent' => true];
}
function menu_user() {
    return ['keyboard' => [
        [['text' => 'О сервисе'], ['text' => 'Продукты']],
        [['text' => 'Инфраструктура'], ['text' => 'Мини-приложение', 'web_app' => ['url' => $GLOBALS['APP_URL']]]],
        [['text' => 'Подключение'], ['text' => 'Поддержка']],
        [['text' => '🚀 Розыгрыш']],
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

/* ── Реферальный розыгрыш RocketVPN ───────────────────────
   Участник засчитывается только после проверки подписки через
   getChatMember. Персональная ссылка ведёт в этого же бота; балл
   начисляется пригласившему один раз, когда новый человек впервые
   подтверждает участие. Самореферал и повторное нажатие ничего не
   добавляют. Хранилище JSON подходит текущей архитектуре проекта и
   обновляется под той же файловой блокировкой, что заявки. */
function contest_enabled() {
    return (bool)rc_cfg('contest_active') && (string)rc_cfg('contest_channel') !== '';
}

function contest_code($uid) {
    $secret = (string)rc_cfg('admin_key', 'rocketcdn');
    return strtoupper(substr(hash_hmac('sha256', 'contest:' . (string)$uid, $secret), 0, 10));
}

function contest_bot_link($code = '') {
    $bot = preg_replace('~[^a-z0-9_]~i', '', (string)rc_cfg('tg_username', 'rocket_cdn_bot'));
    return 'https://t.me/' . $bot . ($code !== '' ? '?start=ref_' . rawurlencode($code) : '?start=contest');
}

function contest_name($from) {
    $name = trim((string)($from['first_name'] ?? '') . ' ' . (string)($from['last_name'] ?? ''));
    if ($name === '' && !empty($from['username'])) $name = '@' . $from['username'];
    if ($name === '') $name = 'участник';
    return mb_substr($name, 0, 80);
}

function contest_remember_ref($uid, $code) {
    $code = strtoupper(preg_replace('~[^A-F0-9]~', '', (string)$code));
    if ($code === '') return;
    rc_json_update(RC_CONTEST, function ($d) use ($uid, $code) {
        $d['users'] = $d['users'] ?? [];
        $d['pending'] = $d['pending'] ?? [];
        if (!isset($d['users'][(string)$uid])) $d['pending'][(string)$uid] = $code;
        return $d;
    });
}

function contest_member($uid) {
    $channel = (string)rc_cfg('contest_channel');
    if ($channel === '') return [false, 'channel'];
    $r = rc_tg('getChatMember', ['chat_id' => $channel, 'user_id' => (int)$uid]);
    if (empty($r['ok']) || empty($r['result'])) return [false, 'check'];
    $m = $r['result'];
    $status = (string)($m['status'] ?? '');
    $ok = in_array($status, ['creator', 'administrator', 'member'], true)
       || ($status === 'restricted' && !empty($m['is_member']));
    return [$ok, $ok ? 'ok' : 'subscribe'];
}

function contest_join($uid, $from) {
    $created = false; $credited = false; $reason = '';
    $result = rc_json_update(RC_CONTEST, function ($d) use ($uid, $from, &$created, &$credited, &$reason) {
        $d['users'] = $d['users'] ?? [];
        $d['pending'] = $d['pending'] ?? [];
        $key = (string)$uid;
        if (isset($d['users'][$key])) {
            $reason = 'exists';
            return $d;
        }

        $code = contest_code($uid);
        $refCode = strtoupper((string)($d['pending'][$key] ?? ''));
        $inviter = null;
        if ($refCode !== '' && $refCode !== $code) {
            foreach ($d['users'] as $rid => $row) {
                if (strtoupper((string)($row['code'] ?? '')) === $refCode && (string)$rid !== $key) {
                    $inviter = (string)$rid;
                    break;
                }
            }
        }

        $d['users'][$key] = [
            'code'       => $code,
            'name'       => contest_name($from),
            'username'   => mb_substr((string)($from['username'] ?? ''), 0, 64),
            'joined_at'  => date('Y-m-d H:i:s'),
            'invited_by' => $inviter,
        ];
        unset($d['pending'][$key]);
        $created = true;
        $credited = $inviter !== null;
        $reason = 'joined';
        return $d;
    });
    return ['ok' => is_array($result), 'created' => $created, 'credited' => $credited, 'reason' => $reason];
}

function contest_points($data, $uid) {
    $n = 0;
    foreach ((array)($data['users'] ?? []) as $row) {
        if ((string)($row['invited_by'] ?? '') === (string)$uid) $n++;
    }
    return $n;
}

function contest_ranked($data) {
    $rows = [];
    foreach ((array)($data['users'] ?? []) as $uid => $row) {
        $row['uid'] = (string)$uid;
        $row['points'] = contest_points($data, $uid);
        $rows[] = $row;
    }
    usort($rows, function ($a, $b) {
        $ap = (int)($a['points'] ?? 0); $bp = (int)($b['points'] ?? 0);
        if ($ap !== $bp) return $bp <=> $ap;
        return strcmp((string)($a['joined_at'] ?? ''), (string)($b['joined_at'] ?? ''));
    });
    return $rows;
}

function contest_top_text($limit = 10, $admin = false) {
    $d = rc_json_read(RC_CONTEST, []);
    $rows = contest_ranked($d);
    $s = "<b>Топ приглашений · RocketVPN</b>\n\n";
    if (!$rows) return $s . "Участников пока нет.";
    $i = 0;
    foreach ($rows as $row) {
        if ($i >= $limit) break;
        $medal = $i === 0 ? '🥇' : ($i === 1 ? '🥈' : ($i === 2 ? '🥉' : '·'));
        $name = htmlspecialchars((string)($row['name'] ?? 'участник'));
        $s .= $medal . ' ' . $name . ' — <b>' . (int)$row['points'] . "</b>";
        if ($admin) $s .= ' <code>' . htmlspecialchars((string)$row['uid']) . '</code>';
        $s .= "\n";
        $i++;
    }
    $s .= "\nПервые " . max(1, (int)rc_cfg('contest_top_prizes', 3)) . " участника получают гарантированные призы.";
    return $s;
}

/* Перед фиксацией призов подписка проверяется повторно. Человек,
   который вошёл, набрал баллы и вышел из канала, не занимает место
   у тех, кто выполнил условие до конца. */
function contest_winners_text($limit) {
    $rows = contest_ranked(rc_json_read(RC_CONTEST, []));
    $limit = max(1, (int)$limit);
    $out = "<b>Гарантированные победители</b>\n\n";
    $won = 0; $skipped = 0;
    foreach ($rows as $row) {
        list($ok, $why) = contest_member((int)$row['uid']);
        /* Не фиксируем ошибочный рейтинг при недоступном Telegram API
           или неверно заданном канале. Это безопаснее, чем молча
           принять техническую ошибку за отписку участника. */
        if (!$ok && ($why === 'check' || $why === 'channel')) {
            return $out
                 . "Проверка подписок сейчас недоступна. Победители не зафиксированы; "
                 . "проверьте канал и права бота, затем повторите команду.";
        }
        if (!$ok) { $skipped++; continue; }
        $won++;
        $out .= ($won === 1 ? '🥇' : ($won === 2 ? '🥈' : '🥉'))
              . ' ' . htmlspecialchars((string)($row['name'] ?? 'участник'))
              . ' — <b>' . (int)$row['points'] . '</b> '
              . '<code>' . htmlspecialchars((string)$row['uid']) . "</code>\n";
        if ($won >= $limit) break;
    }
    if (!$won) $out .= "Пока нет участников с подтверждённой подпиской.\n";
    if ($skipped) $out .= "\nНе прошли повторную проверку подписки: {$skipped}.";
    return $out;
}

function contest_card($uid) {
    $title = htmlspecialchars((string)rc_cfg('contest_title', 'Розыгрыш RocketVPN'));
    if (!contest_enabled()) {
        $text = "<b>{$title}</b>\n\nРозыгрыш готов к запуску, но канал подписки ещё не включён.";
        if (is_admin($uid)) {
            $text .= "\n\nВ <code>config.local.php</code> задайте "
                  . "<code>contest_active</code>, <code>contest_channel</code> и <code>contest_channel_url</code>.";
        }
        return [$text, []];
    }

    $d = rc_json_read(RC_CONTEST, []);
    $row = $d['users'][(string)$uid] ?? null;
    $channelUrl = (string)rc_cfg('contest_channel_url');
    $topN = max(1, (int)rc_cfg('contest_top_prizes', 3));
    $kb = [];
    if ($row) {
        $points = contest_points($d, $uid);
        $rank = 0; $ranked = contest_ranked($d);
        foreach ($ranked as $i => $one) if ((string)$one['uid'] === (string)$uid) { $rank = $i + 1; break; }
        $link = contest_bot_link((string)$row['code']);
        $text = "<b>{$title}</b>\n\n✅ Вы участвуете.\n"
              . "Приглашено подтверждённых участников: <b>{$points}</b>\n"
              . ($rank ? "Место сейчас: <b>{$rank}</b>\n" : '')
              . "\nВаша персональная ссылка:\n<code>" . htmlspecialchars($link) . "</code>\n\n"
              . "Баллы начисляются только после того, как приглашённый подпишется на канал и нажмёт «Участвую». "
              . "Топ-{$topN} получает гарантированные призы.";
        $kb[] = [['text' => 'Обновить статус', 'callback_data' => 'contest_status'],
                  ['text' => 'Топ участников', 'callback_data' => 'contest_top']];
    } else {
        $text = "<b>{$title}</b>\n\n"
              . "1. Подпишитесь на канал.\n"
              . "2. Нажмите «Участвую» — бот проверит подписку.\n"
              . "3. Получите персональную ссылку и приглашайте друзей.\n\n"
              . "Каждый подтверждённый участник по вашей ссылке даёт <b>+1</b>. "
              . "Топ-{$topN} получает гарантированные призы.";
        if ($channelUrl !== '') $kb[] = [['text' => 'Подписаться на канал', 'url' => $channelUrl]];
        $kb[] = [['text' => '🚀 Участвую', 'callback_data' => 'contest_join']];
    }
    return [$text, $kb];
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
            . "/site - ссылки на сайт и админку\n"
            . "/health - состояние площадки\n"
            . "/texts - правка текстов сайта прямо здесь\n"
            . "/report - собрать дневной отчёт сейчас\n"
            . "/contest - состояние реферального розыгрыша\n"
            . "/contest_top - таблица приглашений\n"
            . "/contest_winners - гарантированный топ победителей\n"
            . "/undo - отменить последнюю правку текста\n\n"
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
    /* Закрывающую скобку сразу после пятого поля больше не требуем.
       У записи узла шесть полей: английское имя стоит последним,
       ["Москва",55.75,37.62,0,3,"Moscow"]. Со старым выражением
       совпадений было НОЛЬ на все 218 узлов, и бот рапортовал «всего
       точек присутствия: 0» рядом с собственным текстом про 218. */
    if (preg_match_all('~\["([^"]+)",\s*(-?[\d.]+),\s*(-?[\d.]+),\s*(\d),\s*(\d)\s*[,\]]~u', $src, $m, PREG_SET_ORDER)) {
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
/* ── Состояние площадки одним сообщением ─────────────────────
   Те же цифры, что во вкладке «Состояние» админки: считает общая
   функция rc_selftest() из config.php. */
function health_text() {
    $r = rc_selftest();
    $yn = function ($v) { return $v ? 'да' : 'НЕТ'; };
    $t = "<b>Состояние площадки</b>\n\n"
       . "Почта настроена: " . $yn($r['mail_configured']) . "\n"
       . "Бот настроен: " . $yn($r['tg_configured']) . "\n"
       . "Чат уведомлений привязан: " . $yn($r['chat_bound']) . "\n"
       . "Папка данных пишется: " . $yn($r['data_writable']) . "\n\n"
       . "Заявок без ответа: <b>" . (int)$r['leads_new'] . "</b>";
    if (!empty($r['leads_wait_hours'])) $t .= " (самая старая ждёт " . (int)$r['leads_wait_hours'] . " ч)";
    $t .= "\nПоследний отчёт: " . ($r['cron_last'] ?: 'ещё не было')
       . "\nКопий заявок: " . (int)$r['backup_count'] . ", последняя " . ($r['backup_last'] ?: '-');
    if ($r['cert_days'] !== null) $t .= "\nСертификат: " . (int)$r['cert_days'] . " дн. до конца";
    if ($r['disk_free_gb'] !== null) $t .= "\nСвободно на диске: " . $r['disk_free_gb'] . " ГБ";
    if (!empty($r['tg_ip'])) $t .= "\nАдрес телеграма: <code>" . $r['tg_ip'] . "</code>";

    /* То, что тревожит, повторяем отдельной строкой: в длинном
       сообщении важное иначе теряется */
    $warn = [];
    if ($r['cert_days'] !== null && $r['cert_days'] <= 14) $warn[] = 'сертификат кончается';
    if ($r['disk_free_gb'] !== null && $r['disk_free_gb'] < 3) $warn[] = 'мало места на диске';
    if (!empty($r['leads_wait_hours']) && $r['leads_wait_hours'] >= 4) $warn[] = 'заявка ждёт ответа';
    if (!$r['data_writable']) $warn[] = 'папка данных не пишется';
    if ($warn) $t .= "\n\n<b>Требует внимания:</b> " . implode(', ', $warn) . '.';
    return $t;
}

/* ── Правка текстов сайта из переписки ───────────────────────
   Ключи словаря сгруппированы по первому слову: hero, cta, kpi и
   так далее. Сначала выбираем группу, потом ключ, потом присылаем
   новое значение сообщением. Перед заменой всегда показываем
   старое: правка вслепую на боевом сайте недопустима. */
function texts_state_file() { return RC_DATA . '/bot_state.json'; }

function texts_state_set($uid, $val) {
    rc_json_update(texts_state_file(), function ($d) use ($uid, $val) {
        if (!is_array($d)) $d = [];
        if ($val === null) unset($d[(string)$uid]); else $d[(string)$uid] = $val;
        return $d;
    });
}
function texts_state_get($uid) {
    $d = rc_json_read(texts_state_file(), []);
    return $d[(string)$uid] ?? null;
}

function texts_groups() {
    $all = rc_i18n_ru();
    $g = [];
    foreach ($all as $k => $v) {
        $part = explode('.', $k);
        $grp = count($part) > 1 ? $part[0] : 'прочее';
        $g[$grp] = ($g[$grp] ?? 0) + 1;
    }
    ksort($g);
    return $g;
}

function texts_groups_kb() {
    $rows = []; $line = [];
    foreach (texts_groups() as $grp => $n) {
        $line[] = ['text' => $grp . ' (' . $n . ')', 'callback_data' => 'tg_' . $grp];
        if (count($line) === 3) { $rows[] = $line; $line = []; }
    }
    if ($line) $rows[] = $line;
    return $rows;
}

function texts_keys_kb($grp, $page = 0) {
    $all = rc_i18n_ru();
    $keys = [];
    foreach ($all as $k => $v) {
        $part = explode('.', $k);
        $g = count($part) > 1 ? $part[0] : 'прочее';
        if ($g === $grp) $keys[] = $k;
    }
    sort($keys);
    $per = 12;
    $slice = array_slice($keys, $page * $per, $per);
    $rows = [];
    foreach ($slice as $k) {
        $val = mb_substr((string)($all[$k] ?? ''), 0, 34);
        $rows[] = [['text' => $k . ' · ' . $val, 'callback_data' => 'tk_' . $k]];
    }
    $nav = [];
    if ($page > 0) $nav[] = ['text' => 'назад', 'callback_data' => 'tp_' . $grp . '_' . ($page - 1)];
    if (count($keys) > ($page + 1) * $per) $nav[] = ['text' => 'дальше', 'callback_data' => 'tp_' . $grp . '_' . ($page + 1)];
    $nav[] = ['text' => 'к разделам', 'callback_data' => 'tg_root'];
    $rows[] = $nav;
    return $rows;
}

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

            /* Розыгрыш доступен гостям, поэтому обрабатывается до
               административного фильтра остальных callback-кнопок. */
            if (strpos($data, 'contest_') === 0) {
                if ($data === 'contest_join') {
                    if (!contest_enabled()) {
                        list($tx, $kb) = contest_card($uid);
                        say($chat, $tx, null, $kb);
                        continue;
                    }
                    list($member, $why) = contest_member($uid);
                    if (!$member) {
                        $tx = $why === 'subscribe'
                            ? "Подписка пока не найдена. Подпишитесь на канал и нажмите «Участвую» ещё раз."
                            : "Не удалось проверить подписку. Убедитесь, что бот добавлен администратором канала, и повторите.";
                        $kb = [];
                        $url = (string)rc_cfg('contest_channel_url');
                        if ($url !== '') $kb[] = [['text' => 'Подписаться на канал', 'url' => $url]];
                        $kb[] = [['text' => 'Проверить ещё раз', 'callback_data' => 'contest_join']];
                        say($chat, $tx, null, $kb);
                        continue;
                    }
                    $joined = contest_join($uid, $cq['from'] ?? []);
                    list($tx, $kb) = contest_card($uid);
                    if (!empty($joined['created'])) {
                        $tx = "✅ Подписка подтверждена. Участие активировано.\n\n" . $tx;
                    }
                    say($chat, $tx, null, $kb);
                    continue;
                }
                if ($data === 'contest_status') {
                    list($tx, $kb) = contest_card($uid);
                    say($chat, $tx, null, $kb);
                    continue;
                }
                if ($data === 'contest_top') {
                    say($chat, contest_top_text(10, false), null,
                        [[['text' => 'Моя ссылка', 'callback_data' => 'contest_status']]]);
                    continue;
                }
            }
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

            /* ── Тексты сайта ── */
            if ($data === 'tg_root') {
                say($chat, "<b>Тексты сайта</b>\n\nВыберите раздел.", null, texts_groups_kb());
            } elseif (preg_match('~^tg_(.+)$~', $data, $m)) {
                say($chat, "Раздел <b>" . htmlspecialchars($m[1]) . "</b>. Выберите строку.", null, texts_keys_kb($m[1], 0));
            } elseif (preg_match('~^tp_(.+)_(\d+)$~', $data, $m)) {
                say($chat, "Раздел <b>" . htmlspecialchars($m[1]) . "</b>.", null, texts_keys_kb($m[1], (int)$m[2]));
            } elseif (preg_match('~^tk_(.+)$~', $data, $m)) {
                $all = rc_i18n_ru();
                $key = $m[1];
                if (!isset($all[$key])) { say($chat, 'Такой строки больше нет.', $uid); continue; }
                texts_state_set($uid, ['key' => $key, 'old' => $all[$key]]);
                say($chat, "<b>" . htmlspecialchars($key) . "</b>\n\nСейчас на сайте:\n<code>"
                    . htmlspecialchars($all[$key]) . "</code>\n\nПришлите новый текст одним сообщением."
                    . "\nЧтобы передумать - /cancel.", $uid);
            } elseif ($data === 'txt_save') {
                $stt = texts_state_get($uid);
                if (!empty($stt['key']) && isset($stt['new'])) {
                    rc_i18n_set($stt['key'], $stt['new']);
                    rc_admin_log($uid, 'правка текста ' . $stt['key'], $stt['old'] . ' -> ' . $stt['new']);
                    texts_state_set($uid, ['undo' => ['key' => $stt['key'], 'old' => $stt['old']]]);
                    say($chat, "Сохранено. Сайт уже отдаёт новый текст.\nОтменить - /undo", $uid);
                } else say($chat, 'Нечего сохранять.', $uid);
            } elseif ($data === 'txt_cancel') {
                texts_state_set($uid, null);
                say($chat, 'Правка отменена, на сайте всё по-старому.', $uid);
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
            if (preg_match('~^ref_([A-F0-9]{6,16})$~i', $arg, $rm)) {
                contest_remember_ref($uid, $rm[1]);
            }
            $hi = is_admin($uid)
                ? "<b>Rocket CDN</b>\nПанель управления сайтом.\n\nНижнее меню открывает аналитику, заявки и данные сети. Мини-приложение показывает сайт прямо в Телеграме."
                : "<b>Rocket CDN</b>\n<i>Fast. Reliable. Global.</i>\n\nГлобальная сеть доставки контента. Выберите раздел в меню внизу или откройте мини-приложение.";
            $inline = [[['text' => 'Открыть мини-приложение', 'web_app' => ['url' => $APP_URL]]],
                       [['text' => 'Личный кабинет', 'url' => rc_cfg('lk_url')]]];
            rc_tg('sendMessage', ['chat_id' => $chat, 'text' => $hi, 'parse_mode' => 'HTML',
                                  'reply_markup' => menu_for($uid)]);
            say($chat, 'Быстрый доступ:', null, $inline);
            if ($arg === 'contest' || preg_match('~^ref_[A-F0-9]{6,16}$~i', $arg)) {
                list($ctx, $ckb) = contest_card($uid);
                say($chat, $ctx, null, $ckb);
            }
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
        if ($text === '🚀 Розыгрыш' || $text === 'Розыгрыш') {
            list($ctx, $ckb) = contest_card($uid);
            say($chat, $ctx, null, $ckb);
            continue;
        }
        if ($text === 'Топ рефералов') { say($chat, contest_top_text(10, is_admin($uid)), $uid); continue; }
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

        if ($cmd === '/health' || $text === 'Состояние') { say($chat, health_text(), $uid); continue; }

        if ($cmd === '/contest') {
            list($ctx, $ckb) = contest_card($uid);
            $d = rc_json_read(RC_CONTEST, []);
            $ctx .= "\n\nУчастников: <b>" . count((array)($d['users'] ?? [])) . "</b>"
                  . "\nКанал: <code>" . htmlspecialchars((string)rc_cfg('contest_channel', 'не задан')) . "</code>"
                  . "\nАктивен: <b>" . (contest_enabled() ? 'да' : 'нет') . "</b>";
            say($chat, $ctx, null, $ckb);
            continue;
        }
        if ($cmd === '/contest_top') {
            say($chat, contest_top_text(20, true), $uid);
            continue;
        }
        if ($cmd === '/contest_winners') {
            $n = max(1, (int)rc_cfg('contest_top_prizes', 3));
            say($chat, contest_winners_text($n), $uid);
            continue;
        }

        if ($cmd === '/report') {
            /* Принудительный отчёт: расписание в 9:00 это не сдвигает,
               cron.php сам держит отметку дня в cron_state.json */
            say($chat, rc_report_daily(), $uid);
            rc_admin_log($uid, 'отчёт по требованию');
            continue;
        }

        if ($cmd === '/texts' || $text === 'Тексты сайта') {
            say($chat, "<b>Тексты сайта</b>\n\nПравим прямо здесь: раздел, строка, новый текст."
                . "\nСтарое значение показывается перед заменой, последнюю правку можно отменить командой /undo.",
                null, texts_groups_kb());
            continue;
        }

        if ($cmd === '/cancel') { texts_state_set($uid, null); say($chat, 'Отменено.', $uid); continue; }

        if ($cmd === '/undo') {
            $stt = texts_state_get($uid);
            if (!empty($stt['undo']['key'])) {
                rc_i18n_set($stt['undo']['key'], $stt['undo']['old']);
                rc_admin_log($uid, 'откат текста ' . $stt['undo']['key'], $stt['undo']['old']);
                texts_state_set($uid, null);
                say($chat, 'Вернул прежний текст.', $uid);
            } else say($chat, 'Отменять нечего: последней правки нет.', $uid);
            continue;
        }

        /* Ждём новый текст для выбранной строки */
        $stt = texts_state_get($uid);
        if (!empty($stt['key']) && $cmd !== '' && $cmd[0] !== '/' && !$isGroup) {
            $stt['new'] = $text;
            texts_state_set($uid, $stt);
            say($chat, "<b>" . htmlspecialchars($stt['key']) . "</b>\n\nБыло:\n<code>"
                . htmlspecialchars($stt['old']) . "</code>\n\nСтанет:\n<code>"
                . htmlspecialchars($text) . "</code>", null,
                [[['text' => 'Сохранить', 'callback_data' => 'txt_save'],
                  ['text' => 'Отмена', 'callback_data' => 'txt_cancel']]]);
            continue;
        }
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
