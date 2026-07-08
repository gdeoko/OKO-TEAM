<?php
// ╔══════════════════════════════════════════════╗
// ║  OKO TEAM — Telegram Bot (polling)           ║
// ║  okoteam.top/polling.php                     ║
// ║  Cron: */1 * * * * php /path/polling.php     ║
// ╚══════════════════════════════════════════════╝

// 6 итераций = ~10 сек задержка максимум
for ($__loop = 0; $__loop < 6; $__loop++) {
    if ($__loop > 0) sleep(10);

// ── КОНФИГ ──────────────────────────────────────
define('BOT_TOKEN', '8681257013:AAGL56AFYPVddqrqY9DOcgK6wJoJjS_BxXw');
define('BOT_API',   'https://api.telegram.org/bot' . BOT_TOKEN . '/');
define('DANIEL',    1966985736);
define('SITE_URL',  'https://okoteam.top');
define('DATA_FILE', __DIR__ . '/data.json');
define('PARTIALS_DIR', __DIR__ . '/partials/');
define('CHANNEL_ID', '@gdeoko');
define('ADMIN_KEY', '2002');

$PRODUCTS = [
    'sistema' => ['name' => 'СИСТЕМА OKO',             'emoji' => '[СИСТЕМА]'],
    'zavod'   => ['name' => 'Контент-завод',            'emoji' => '[ЗАВОД]'],
    'consult' => ['name' => 'Консультация',              'emoji' => '[КОНСУЛЬТ]'],
    'web'     => ['name' => 'Сайты / Боты / Приложения','emoji' => '[WEB]'],
    'voronka' => ['name' => 'Воронка + Нейробот',       'emoji' => '[ВОРОНКА]'],
    'club'    => ['name' => 'OKO CLUB',                 'emoji' => '[CLUB]'],
];

// ── HELPERS ─────────────────────────────────────
function tg($method, $params = []) {
    $ch = curl_init(BOT_API . $method);
    curl_setopt_array($ch, [
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => json_encode($params),
        CURLOPT_HTTPHEADER     => ['Content-Type: application/json'],
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 10,
    ]);
    $r = curl_exec($ch);
    curl_close($ch);
    return json_decode($r, true);
}

function sendMsg($chat_id, $text, $inline = [], $reply = false) {
    $p = [
        'chat_id'                  => $chat_id,
        'text'                     => $text,
        'parse_mode'               => 'HTML',
        'disable_web_page_preview' => true,
    ];
    if ($inline) {
        $p['reply_markup'] = ['inline_keyboard' => $inline];
    } elseif ($reply || $chat_id == DANIEL) {
        $p['reply_markup'] = mainMenu();
    }
    return tg('sendMessage', $p);
}

function editMsg($chat_id, $msg_id, $text, $inline = []) {
    $p = ['chat_id' => $chat_id, 'message_id' => $msg_id, 'text' => $text, 'parse_mode' => 'HTML', 'disable_web_page_preview' => true];
    if ($inline) $p['reply_markup'] = ['inline_keyboard' => $inline];
    tg('editMessageText', $p);
}

function btn($text, $url = null, $cb = null) {
    if ($url) return ['text' => $text, 'url' => $url];
    return ['text' => $text, 'callback_data' => $cb ?: 'noop'];
}

function mainMenu() {
    return [
        'keyboard' => [
            [['text' => 'Лиды'], ['text' => 'Оплаты']],
            [['text' => 'Продукты'], ['text' => 'Дожимы']],
            [['text' => 'Рассылка'], ['text' => 'Команды']],
        ],
        'resize_keyboard' => true,
        'persistent'      => true,
    ];
}

function loadData() {
    if (!file_exists(DATA_FILE)) return ['leads' => [], 'payments' => [], 'subscribers' => [], 'settings' => []];
    return json_decode(file_get_contents(DATA_FILE), true) ?: ['leads' => [], 'payments' => [], 'subscribers' => [], 'settings' => []];
}

function saveData($d) {
    file_put_contents(DATA_FILE, json_encode($d, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
}

function formatTime($ts) {
    if (!$ts) return '';
    $diff = time() - $ts;
    if ($diff < 3600) return round($diff/60) . ' мин назад';
    if ($diff < 86400) return round($diff/3600) . ' ч назад';
    return date('d.m H:i', $ts);
}

function getStateFile() { return __DIR__ . '/bot_state.json'; }
function loadState() {
    $f = getStateFile();
    return file_exists($f) ? (json_decode(file_get_contents($f), true) ?: []) : [];
}
function saveState($s) {
    file_put_contents(getStateFile(), json_encode($s, JSON_UNESCAPED_UNICODE));
}
function setState($key, $val) {
    $s = loadState(); $s[$key] = $val; saveState($s);
}
function getState($key) {
    $s = loadState(); return $s[$key] ?? null;
}
function clearState($key) {
    $s = loadState(); unset($s[$key]); saveState($s);
}

// ── POLLING ──────────────────────────────────────
$offset_file = __DIR__ . '/polling_offset.txt';
$offset = file_exists($offset_file) ? (int)file_get_contents($offset_file) : 0;

$result = tg('getUpdates', [
    'offset'          => $offset,
    'limit'           => 100,
    'timeout'         => 0,
    'allowed_updates' => ['message', 'callback_query', 'channel_post'],
]);

if (empty($result['ok']) || empty($result['result'])) continue;

foreach ($result['result'] as $update) {
    file_put_contents($offset_file, $update['update_id'] + 1);

    $msg      = $update['message']        ?? null;
    $callback = $update['callback_query'] ?? null;
    $ch_post  = $update['channel_post']   ?? null;

    // ── НОВЫЙ ПОСТ В КАНАЛЕ @gdeoko ──
    if ($ch_post) {
        $txt  = $ch_post['text'] ?? ($ch_post['caption'] ?? '');
        $date = date('d.m H:i', $ch_post['date'] ?? time());
        $preview = mb_substr($txt, 0, 80) . (mb_strlen($txt) > 80 ? '...' : '');
        sendMsg(DANIEL,
            "Новый пост в канале\n\n" .
            ($preview ? "\"$preview\"\n\n" : '') .
            "Дата: $date",
            [[btn('Открыть канал', 'https://t.me/gdeoko')]]
        );
        continue;
    }

    // ── CALLBACK КНОПКИ ──
    if ($callback) {
        $chat_id = $callback['message']['chat']['id'];
        $msg_id  = $callback['message']['message_id'];
        $data    = $callback['data'];
        tg('answerCallbackQuery', ['callback_query_id' => $callback['id']]);

        if ($chat_id != DANIEL) continue;

        // Подтвердить оплату вручную
        if (strpos($data, 'confirm_pay_') === 0) {
            $email = substr($data, 12);
            $db    = loadData();
            $name  = 'Клиент'; $found = false;
            foreach ($db['subscribers'] as &$s) {
                if ($s['email'] === $email) {
                    $s['paid'] = true;
                    $s['paid_ts'] = date('Y-m-d H:i:s');
                    $name = $s['name'] ?? 'Клиент';
                    $found = true; break;
                }
            }
            if ($found) {
                saveData($db);
                // Удаляем из дожимов
                $lf = PARTIALS_DIR . md5($email . 'sistema') . '.json';
                if (file_exists($lf)) unlink($lf);
                editMsg($chat_id, $msg_id,
                    "Оплата подтверждена\n\n$name · $email\n\nПисьмо клиенту отправлено.",
                    [[btn('Вызвать API confirm', SITE_URL . '/api.php?action=manualConfirm&email=' . urlencode($email) . '&key=' . ADMIN_KEY)]]
                );
                // Реальное подтверждение через API
                @file_get_contents(SITE_URL . '/api.php?action=manualConfirm&email=' . urlencode($email) . '&key=' . ADMIN_KEY);
            } else {
                editMsg($chat_id, $msg_id, "Email не найден: $email");
            }
            continue;
        }

        // Удалить лид
        if (strpos($data, 'del_lead_') === 0) {
            $email = substr($data, 9);
            $db = loadData();
            $db['subscribers'] = array_values(array_filter($db['subscribers'], fn($s) => $s['email'] !== $email));
            saveData($db);
            $lf = PARTIALS_DIR . md5($email . 'sistema') . '.json';
            if (file_exists($lf)) unlink($lf);
            editMsg($chat_id, $msg_id, "Лид удален: $email");
            continue;
        }

        // Снять с дожима
        if (strpos($data, 'stop_drip_') === 0) {
            $email = substr($data, 10);
            foreach (['sistema','zavod','consult','web','voronka'] as $prod) {
                $lf = PARTIALS_DIR . md5($email . $prod) . '.json';
                if (file_exists($lf)) unlink($lf);
            }
            editMsg($chat_id, $msg_id, "Дожимы остановлены для: $email");
            continue;
        }

        // Подтвердить оплату через callback из уведомления
        if (strpos($data, 'paid_') === 0) {
            $email = substr($data, 5);
            @file_get_contents(SITE_URL . '/api.php?action=manualConfirm&email=' . urlencode($email) . '&key=' . ADMIN_KEY);
            editMsg($chat_id, $msg_id, "Оплата подтверждена. Письмо отправлено клиенту.");
            continue;
        }

        // Статистика по продукту
        if (strpos($data, 'prod_stat_') === 0) {
            $prod = substr($data, 10);
            $db   = loadData();
            global $PRODUCTS;
            $pname = $PRODUCTS[$prod]['name'] ?? $prod;
            $leads = array_filter($db['subscribers'], fn($s) => in_array($prod, $s['products'] ?? []));
            $paid  = array_filter($leads, fn($s) => !empty($s['paid']));
            $lines = "$pname\n\n";
            $lines .= "Лидов: " . count($leads) . "\n";
            $lines .= "Оплатили: " . count($paid) . "\n";
            $lines .= "Конверсия: " . (count($leads) ? round(count($paid)/count($leads)*100) : 0) . "%\n\n";
            $recent = array_slice(array_reverse(array_values($leads)), 0, 5);
            foreach ($recent as $s) {
                $status = !empty($s['paid']) ? 'оплатил' : 'не оплатил';
                $lines .= "- {$s['name']} · $status\n";
            }
            editMsg($chat_id, $msg_id, $lines, [[btn('Назад', null, 'menu_products')]]);
            continue;
        }

        // Выбор сегмента рассылки
        if (strpos($data, 'nl_seg_') === 0) {
            $seg = substr($data, 7);
            setState('nl_segment_' . DANIEL, $seg);
            $labels = ['all' => 'все', 'paid' => 'оплатившие', 'unpaid' => 'не оплатившие'];
            editMsg($chat_id, $msg_id,
                "Сегмент: " . ($labels[$seg] ?? $seg) . "\n\nНапишите тему письма:",
                []
            );
            setState('awaiting_' . DANIEL, 'nl_subject');
            continue;
        }

        // Меню продуктов (назад)
        if ($data === 'menu_products') {
            $db = loadData();
            global $PRODUCTS;
            $btns = [];
            foreach ($PRODUCTS as $key => $p) {
                $leads = count(array_filter($db['subscribers'], fn($s) => in_array($key, $s['products'] ?? [])));
                $paid  = count(array_filter($db['subscribers'], fn($s) => in_array($key, $s['products'] ?? []) && !empty($s['paid'])));
                $btns[] = [btn("{$p['name']} · лидов: $leads / оплат: $paid", null, 'prod_stat_' . $key)];
            }
            editMsg($chat_id, $msg_id, "Продукты — статистика:", $btns);
            continue;
        }

        continue;
    }

    if (!$msg) continue;

    $chat_id = $msg['chat']['id'];
    $text    = trim($msg['text'] ?? '');
    $from    = $msg['from'];

    // Только Даниэль управляет ботом
    if ($chat_id != DANIEL) {
        sendMsg($chat_id, "Это служебный бот OKO TEAM.", [], true);
        continue;
    }

    // ── ОБРАБОТКА СОСТОЯНИЙ (мультишаговые диалоги) ──
    $awaiting = getState('awaiting_' . DANIEL);

    // Поиск клиента
    if ($awaiting === 'search') {
        clearState('awaiting_' . DANIEL);
        $q   = mb_strtolower($text);
        $db  = loadData();
        $found = array_filter($db['subscribers'], function($s) use ($q) {
            return strpos(mb_strtolower($s['email'] ?? ''), $q) !== false ||
                   strpos(mb_strtolower($s['name']  ?? ''), $q) !== false ||
                   strpos(mb_strtolower($s['tg']    ?? ''), $q) !== false ||
                   strpos(mb_strtolower($s['phone'] ?? ''), $q) !== false;
        });
        if (!$found) {
            sendMsg($chat_id, "Не найдено по запросу: $text");
            continue;
        }
        foreach (array_slice(array_values($found), 0, 3) as $s) {
            $prods   = implode(', ', $s['products'] ?? []);
            $status  = !empty($s['paid']) ? 'ОПЛАТИЛ' : 'не оплатил';
            $tariff  = $s['tariff'] ? ' · ' . $s['tariff'] : '';
            $tg_link = $s['tg'] ? "\nTelegram: @{$s['tg']}" : '';
            $line    = "<b>{$s['name']}</b>\n" .
                       "Email: {$s['email']}\n" .
                       "Телефон: " . ($s['phone'] ?? '—') .
                       $tg_link . "\n" .
                       "Продукт: $prods$tariff\n" .
                       "Статус: $status\n" .
                       "Дата: " . ($s['ts'] ?? '—');
            $btns = [
                [btn('Написать', 'https://t.me/' . ($s['tg'] ?? '')), btn('Подтвердить оплату', null, 'confirm_pay_' . $s['email'])],
                [btn('Снять с дожима', null, 'stop_drip_' . $s['email']), btn('Удалить', null, 'del_lead_' . $s['email'])],
            ];
            if (!$s['tg']) $btns[0][0] = btn('Email: ' . $s['email'], 'mailto:' . $s['email']);
            sendMsg($chat_id, $line, $btns);
        }
        continue;
    }

    // Ручное подтверждение оплаты
    if ($awaiting === 'manual_confirm') {
        clearState('awaiting_' . DANIEL);
        $email = trim($text);
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            sendMsg($chat_id, "Некорректный email. Попробуйте снова.");
            continue;
        }
        $db   = loadData();
        $name = 'Клиент'; $found = false;
        foreach ($db['subscribers'] as $s) {
            if ($s['email'] === $email) { $name = $s['name'] ?? 'Клиент'; $found = true; break; }
        }
        if (!$found) {
            sendMsg($chat_id, "Email не найден: $email\n\nПодтвердить всё равно?",
                [[btn('Да, подтвердить', null, 'paid_' . $email), btn('Отмена', null, 'noop')]]
            );
        } else {
            @file_get_contents(SITE_URL . '/api.php?action=manualConfirm&email=' . urlencode($email) . '&key=' . ADMIN_KEY);
            sendMsg($chat_id, "Оплата подтверждена\n\n$name · $email\n\nПисьмо отправлено клиенту.");
        }
        continue;
    }

    // Рассылка — тема
    if ($awaiting === 'nl_subject') {
        setState('nl_subject_' . DANIEL, $text);
        setState('awaiting_' . DANIEL, 'nl_content');
        sendMsg($chat_id, "Тема: <b>$text</b>\n\nТеперь напишите текст письма:\n(используйте {{name}} для персонализации)");
        continue;
    }

    // Рассылка — текст
    if ($awaiting === 'nl_content') {
        $subject = getState('nl_subject_' . DANIEL);
        $segment = getState('nl_segment_' . DANIEL) ?? 'all';
        clearState('awaiting_' . DANIEL);
        clearState('nl_subject_' . DANIEL);
        clearState('nl_segment_' . DANIEL);

        sendMsg($chat_id, "Запускаю рассылку...\n\nТема: $subject\nСегмент: $segment");

        $ch = curl_init(SITE_URL . '/api.php?action=sendNewsletter');
        curl_setopt_array($ch, [
            CURLOPT_POST           => true,
            CURLOPT_POSTFIELDS     => json_encode(['key' => ADMIN_KEY, 'subject' => $subject, 'content' => $text, 'segment' => $segment]),
            CURLOPT_HTTPHEADER     => ['Content-Type: application/json'],
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT        => 30,
        ]);
        $res = json_decode(curl_exec($ch), true);
        curl_close($ch);

        $sent   = $res['sent']   ?? 0;
        $failed = $res['failed'] ?? 0;
        sendMsg($chat_id, "Рассылка завершена\n\nОтправлено: $sent\nОшибок: $failed");
        continue;
    }

    // Пост в канал
    if ($awaiting === 'channel_post') {
        clearState('awaiting_' . DANIEL);
        $r = tg('sendMessage', [
            'chat_id'    => CHANNEL_ID,
            'text'       => $text,
            'parse_mode' => 'HTML',
        ]);
        if (!empty($r['ok'])) {
            sendMsg($chat_id, "Пост опубликован в @gdeoko");
        } else {
            sendMsg($chat_id, "Ошибка публикации: " . ($r['description'] ?? 'неизвестно'));
        }
        continue;
    }

    // Заметка к клиенту
    if (strpos($awaiting ?? '', 'note_') === 0) {
        $email = substr($awaiting, 5);
        clearState('awaiting_' . DANIEL);
        $db = loadData();
        foreach ($db['subscribers'] as &$s) {
            if ($s['email'] === $email) {
                $s['note'] = $text;
                $s['note_ts'] = date('Y-m-d H:i:s');
                break;
            }
        }
        saveData($db);
        sendMsg($chat_id, "Заметка сохранена для $email:\n\"$text\"");
        continue;
    }

    // ── ОСНОВНЫЕ КОМАНДЫ ──

    if ($text === '/start' || $text === '/menu') {
        tg('sendMessage', [
            'chat_id'      => $chat_id,
            'text'         => "OKO TEAM\n\nДобро пожаловать, Даниэль!\n\nВыберите раздел:",
            'parse_mode'   => 'HTML',
            'reply_markup' => mainMenu(),
        ]);
        continue;
    }

    // ── ЛИДЫ ──
    if ($text === 'Лиды') {
        $db   = loadData();
        $subs = array_reverse($db['subscribers']);
        $total  = count($db['subscribers']);
        $paid   = count(array_filter($db['subscribers'], fn($s) => !empty($s['paid'])));
        $unpaid = $total - $paid;
        $today  = 0;
        foreach ($db['subscribers'] as $s) {
            if (!empty($s['ts']) && date('Y-m-d', strtotime($s['ts'])) === date('Y-m-d')) $today++;
        }
        $lines = "Лиды\n\n";
        $lines .= "Всего: $total · Оплатили: $paid · Не оплатили: $unpaid · Сегодня: $today\n\n";
        $lines .= "Последние:\n";
        foreach (array_slice($subs, 0, 8) as $s) {
            $status = !empty($s['paid']) ? 'оплатил' : 'ожидает';
            $prods  = implode('/', $s['products'] ?? []);
            $time   = !empty($s['ts']) ? ' · ' . date('d.m H:i', strtotime($s['ts'])) : '';
            $lines .= "- {$s['name']} · $prods · $status$time\n";
        }
        sendMsg($chat_id, $lines, [
            [btn('Найти клиента', null, 'noop')],
        ]);
        setState('awaiting_' . DANIEL, 'search');
        sendMsg($chat_id, "Введите имя, email, телефон или @username для поиска:");
        continue;
    }

    // ── ОПЛАТЫ ──
    if ($text === 'Оплаты') {
        $db       = loadData();
        $payments = array_reverse($db['payments'] ?? []);
        $total    = count($payments);
        $today    = 0; $week = 0;
        foreach ($payments as $p) {
            $ts = strtotime($p['ts'] ?? '');
            if ($ts && date('Y-m-d', $ts) === date('Y-m-d')) $today++;
            if ($ts && (time() - $ts) < 604800) $week++;
        }
        $lines = "Оплаты\n\n";
        $lines .= "Всего: $total · Сегодня: $today · За неделю: $week\n\n";
        $lines .= "Последние:\n";
        foreach (array_slice($payments, 0, 8) as $p) {
            global $PRODUCTS;
            $pname  = $PRODUCTS[$p['product'] ?? '']['name'] ?? ($p['product'] ?? '—');
            $amount = !empty($p['amount']) ? ' · ' . $p['amount'] : '';
            $date   = !empty($p['ts']) ? ' · ' . date('d.m H:i', strtotime($p['ts'])) : '';
            $manual = !empty($p['manual']) ? ' (ручн.)' : '';
            $lines .= "- {$p['name']} · $pname$amount$date$manual\n";
        }
        sendMsg($chat_id, $lines, [
            [btn('Подтвердить вручную', null, 'noop')],
        ]);
        setState('awaiting_' . DANIEL, 'manual_confirm');
        sendMsg($chat_id, "Введите email клиента для ручного подтверждения:");
        continue;
    }

    // ── ПРОДУКТЫ ──
    if ($text === 'Продукты') {
        $db   = loadData();
        global $PRODUCTS;
        $btns = [];
        foreach ($PRODUCTS as $key => $p) {
            $leads = count(array_filter($db['subscribers'], fn($s) => in_array($key, $s['products'] ?? [])));
            $paid  = count(array_filter($db['subscribers'], fn($s) => in_array($key, $s['products'] ?? []) && !empty($s['paid'])));
            $btns[] = [btn("{$p['name']} · {$leads} лидов / {$paid} оплат", null, 'prod_stat_' . $key)];
        }
        sendMsg($chat_id, "Продукты — нажмите для статистики:", $btns);
        continue;
    }

    // ── ДОЖИМЫ ──
    if ($text === 'Дожимы') {
        if (!is_dir(PARTIALS_DIR)) {
            sendMsg($chat_id, "Нет активных дожимов.");
            continue;
        }
        $files  = glob(PARTIALS_DIR . '*.json') ?: [];
        $active = [];
        foreach ($files as $f) {
            $p = json_decode(file_get_contents($f), true);
            if ($p && !empty($p['email'])) $active[] = $p;
        }
        if (!$active) {
            sendMsg($chat_id, "Нет активных дожимов.");
            continue;
        }
        $lines = "Дожимы: " . count($active) . " активных\n\n";
        foreach (array_slice($active, 0, 8) as $p) {
            $elapsed = time() - ($p['ts'] ?? 0);
            $d1 = !empty($p['drip1']) ? 'отпр.' : ($elapsed >= 3600 ? 'скоро' : 'через ' . max(0, round((3600 - $elapsed)/60)) . ' мин');
            $d2 = !empty($p['drip2']) ? 'отпр.' : '—';
            $lines .= "- {$p['name']} · {$p['product']} · дожим1: $d1 · дожим2: $d2\n";
        }
        $btns = [];
        foreach (array_slice($active, 0, 3) as $p) {
            $btns[] = [
                btn('Снять: ' . $p['name'], null, 'stop_drip_' . $p['email']),
            ];
        }
        $btns[] = [btn('Снять все', null, 'noop')];
        sendMsg($chat_id, $lines, $btns);
        continue;
    }

    // ── РАССЫЛКА ──
    if ($text === 'Рассылка') {
        $db    = loadData();
        $total = count($db['subscribers']);
        $paid  = count(array_filter($db['subscribers'], fn($s) => !empty($s['paid'])));
        sendMsg($chat_id,
            "Рассылка\n\nПодписчиков: $total · Оплатили: $paid · Не оплатили: " . ($total - $paid) . "\n\nВыберите сегмент:",
            [
                [btn('Всем (' . $total . ')', null, 'nl_seg_all'), btn('Оплатившим (' . $paid . ')', null, 'nl_seg_paid')],
                [btn('Не оплатившим (' . ($total - $paid) . ')', null, 'nl_seg_unpaid')],
            ]
        );
        continue;
    }

    // ── КОМАНДЫ ──
    if ($text === 'Команды') {
        $db = loadData();
        sendMsg($chat_id,
            "Команды OKO TEAM:",
            [
                [btn('Статистика сайта', null, 'cmd_stats')],
                [btn('Подтвердить оплату', null, 'cmd_confirm'), btn('Найти клиента', null, 'cmd_search')],
                [btn('Очистить дожимы', null, 'cmd_clear_drips')],
                [btn('Пост в @gdeoko', null, 'cmd_channel_post')],
                [btn('Шаблоны', null, 'cmd_templates')],
            ]
        );
        continue;
    }

    // Обработка inline из "Команды"
    // Эти приходят как callback — обрабатываются выше в callback блоке
    // Но на случай если текст /stats и пр.:
    if ($text === '/stats') {
        $r = @file_get_contents(SITE_URL . '/api.php?action=getStats&key=' . ADMIN_KEY);
        $d = $r ? json_decode($r, true) : null;
        if ($d && $d['ok']) {
            $lines = "Статистика\n\n";
            $lines .= "Подписчиков: {$d['total_subs']}\n";
            $lines .= "Оплатили: {$d['paid']}\n";
            $lines .= "Не оплатили: {$d['unpaid']}\n";
            $lines .= "Оплат всего: {$d['payments']}\n\n";
            $lines .= "По продуктам:\n";
            foreach ($d['by_product'] as $p => $cnt) {
                global $PRODUCTS;
                $pname = $PRODUCTS[$p]['name'] ?? $p;
                $lines .= "- $pname: $cnt\n";
            }
            sendMsg($chat_id, $lines);
        } else {
            sendMsg($chat_id, "Ошибка получения статистики.");
        }
        continue;
    }

    // По умолчанию
    sendMsg($chat_id, "Используйте кнопки меню.\n/menu — показать меню");

} // end foreach updates

} // end poll loop
