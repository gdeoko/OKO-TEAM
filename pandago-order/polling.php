<?php
/* ============================================================
   PandaGo - Telegram Bot Polling
   Запускается через cron каждую минуту либо long polling.
   Меню бота - 10 разделов, доступ только 4 админам.
   ============================================================ */

declare(strict_types=1);
ini_set('memory_limit', '128M');
set_time_limit(50);

require_once __DIR__.'/config.php';
require_once __DIR__.'/lib.php';

$UPDATE_STATE = __DIR__.'/logs/tg-offset.txt';

/* ─── Меню (10 разделов) ─── */
function bot_main_menu(): array {
    return [
        'keyboard' => [
            [['text'=>'Заявки: новые'],  ['text'=>'Заявки: в работе']],
            [['text'=>'Заявки: закрытые'],['text'=>'Поиск заявки']],
            [['text'=>'Сводка сегодня'], ['text'=>'Сводка неделя']],
            [['text'=>'Курс USD'],       ['text'=>'Промокоды']],
            [['text'=>'Рассылка'],       ['text'=>'Помощь']],
        ],
        'resize_keyboard' => true,
        'persistent'      => true,
    ];
}

/* ─── Основной цикл ─── */
$offset = 0;
if (file_exists($UPDATE_STATE)) {
    $offset = (int)file_get_contents($UPDATE_STATE);
}

/* getUpdates с long-poll таймаутом 25с */
$r = tg_api('getUpdates', [
    'offset'  => $offset,
    'timeout' => 25,
    'allowed_updates' => json_encode(['message','callback_query']),
]);

if (empty($r['ok']) || empty($r['result'])) exit;

foreach ($r['result'] as $u) {
    $offset = max($offset, (int)$u['update_id'] + 1);
    try {
        handle_update($u);
    } catch (Throwable $e) {
        error_log('[polling] '.$e->getMessage());
    }
}
file_put_contents($UPDATE_STATE, (string)$offset);

/* ─── Обработчик апдейта ─── */
function handle_update(array $u): void {
    if (isset($u['callback_query'])) {
        handle_callback($u['callback_query']);
        return;
    }
    if (isset($u['message'])) {
        handle_message($u['message']);
    }
}

function handle_message(array $m): void {
    $chatId = (int)$m['chat']['id'];
    $from   = (int)($m['from']['id'] ?? 0);
    $text   = trim((string)($m['text'] ?? ''));
    if (!$text) return;

    /* Публика: /start сохраняем chat_id для рассылок */
    if (!is_admin_id($from)) {
        handle_public_message($chatId, $from, $m['from'] ?? [], $text);
        return;
    }

    /* Админы: командное меню */
    handle_admin_message($chatId, $text);
}

function handle_public_message(int $chatId, int $userId, array $from, string $text): void {
    $d = data_read();
    $uname = '@'.($from['username'] ?? '');
    /* обновим chat_id в лидах с этим TG, чтобы рассылка работала */
    if (!empty($from['username'])) {
        foreach ($d['leads'] as $i => $l) {
            if (ltrim($l['tg'] ?? '','@') === $from['username']) {
                $d['leads'][$i]['tg_chat_id'] = $chatId;
            }
        }
        data_write($d);
    }

    if (in_array($text, ['/start','старт','привет','здравствуйте'])) {
        tg_send($chatId,
            "Здравствуйте. Это PandaGo Cargo.\n".
            "Мы доставляем технику из Китая под ключ.\n\n".
            "Наш публичный канал: t.me/".PUBLIC_TG_USERNAME."\n".
            "Каталог: ".CATALOG_URL."\n".
            "Оставить заявку: ".SITE_URL
        );
        return;
    }

    /* по умолчанию - переадресация на менеджера */
    tg_send($chatId,
        "Напишите менеджеру: t.me/".PUBLIC_TG_USERNAME."\n".
        "Или оставьте заявку на сайте: ".SITE_URL
    );
}

function handle_admin_message(int $chatId, string $text): void {
    /* /start и главное меню */
    if (in_array($text, ['/start','старт','/menu','меню'])) {
        tg_send($chatId,
            "Панель управления PandaGo.\nВыберите раздел ниже.",
            bot_main_menu()
        );
        return;
    }

    switch ($text) {
        case 'Заявки: новые':      admin_show_leads($chatId, 'new'); break;
        case 'Заявки: в работе':   admin_show_leads($chatId, 'in_progress'); break;
        case 'Заявки: закрытые':   admin_show_leads($chatId, 'done'); break;
        case 'Поиск заявки':
            tg_send($chatId, "Отправьте ID заявки (например, L260701-abc123) или часть имени/телефона.");
            break;
        case 'Сводка сегодня':     admin_show_summary($chatId, 'today'); break;
        case 'Сводка неделя':      admin_show_summary($chatId, 'week');  break;
        case 'Курс USD':           admin_show_rate($chatId); break;
        case 'Промокоды':          admin_show_promos($chatId); break;
        case 'Рассылка':
            tg_send($chatId,
                "Рассылка недоступна из бота. Используйте админ-панель:\n".SITE_URL."admin.html"
            );
            break;
        case 'Помощь':
            tg_send($chatId,
                "Разделы бота:\n".
                "· Заявки: новые, в работе, закрытые. Показывает последние 10\n".
                "· Поиск заявки по ID, имени или телефону\n".
                "· Сводка сегодня и неделя, краткая аналитика\n".
                "· Курс USD, просмотр и обновление\n".
                "· Промокоды, активные\n".
                "· Рассылка, через админ-панель\n\n".
                "Команды под заявкой (inline-кнопки):\n".
                "· Взял в работу · Закрыл · В корзину · Заметка"
            );
            break;
        default:
            /* поиск заявки по свободному тексту */
            if (preg_match('/^L\d{6}-[a-f0-9]{6}$/', $text)) {
                admin_show_lead($chatId, $text);
            } elseif (str_starts_with($text, '/курс ') || preg_match('/^курс\s+(\d+(?:\.\d+)?)$/iu', $text, $mm)) {
                $rate = (float)($mm[1] ?? substr($text, 6));
                admin_update_rate($chatId, $rate);
            } else {
                admin_search_leads($chatId, $text);
            }
    }
}

function handle_callback(array $c): void {
    $from = (int)$c['from']['id'];
    if (!is_admin_id($from)) {
        tg_answer_callback($c['id'], 'Нет доступа');
        return;
    }
    $data   = (string)($c['data'] ?? '');
    $chatId = (int)$c['message']['chat']['id'];
    $parts  = explode(':', $data, 3);

    if ($parts[0] === 'lead' && count($parts) === 3) {
        [, $action, $leadId] = $parts;
        $d = data_read();
        $idx = -1;
        foreach ($d['leads'] as $i => $l) if ($l['id'] === $leadId) { $idx = $i; break; }
        if ($idx === -1) { tg_answer_callback($c['id'], 'Не найдено'); return; }

        if (in_array($action, ['in_progress','done','trash'], true)) {
            $d['leads'][$idx]['status']   = $action;
            $d['leads'][$idx]['assignee'] = (string)$from;
            data_write($d);
            $labels = ['in_progress'=>'В работе','done'=>'Закрыто','trash'=>'В корзине'];
            tg_answer_callback($c['id'], $labels[$action] ?? 'OK');
            tg_send($chatId, "Заявка {$leadId}: ".($labels[$action] ?? $action));
        } elseif ($action === 'note') {
            tg_answer_callback($c['id'], 'Отправьте заметку сообщением');
            tg_send($chatId, "Отправьте заметку к {$leadId} следующим сообщением, начиная с: заметка {$leadId} ...");
        }
    }
}

/* ─── Хелперы админ-действий ─── */
function admin_show_leads(int $chatId, string $status): void {
    $d = data_read();
    $items = array_values(array_filter($d['leads'], fn($l) => ($l['status'] ?? 'new') === $status));
    $items = array_slice($items, 0, 10);
    if (!$items) { tg_send($chatId, "Нет заявок в этом статусе."); return; }
    $t = "Статус: {$status} (".count($items).")\n\n";
    foreach ($items as $l) {
        $t .= "· {$l['id']} · ".date('d.m H:i', $l['ts'])."\n";
        $t .= "  {$l['name']} · ".($l['phone'] ?: $l['tg'] ?: $l['email'])."\n";
        $t .= "  {$l['service']}\n\n";
    }
    tg_send($chatId, $t);
}

function admin_show_summary(int $chatId, string $range): void {
    $d = data_read();
    $from = $range === 'today' ? strtotime('today') : strtotime('-7 days');
    $c = ['total'=>0,'new'=>0,'in_progress'=>0,'done'=>0,'trash'=>0];
    foreach ($d['leads'] as $l) {
        if ($l['ts'] < $from) continue;
        $c['total']++;
        $st = $l['status'] ?? 'new';
        if (isset($c[$st])) $c[$st]++;
    }
    $label = $range === 'today' ? 'Сегодня' : 'Неделя';
    tg_send($chatId,
        "{$label}\n\n".
        "Всего: {$c['total']}\n".
        "Новые: {$c['new']}\n".
        "В работе: {$c['in_progress']}\n".
        "Закрытые: {$c['done']}\n".
        "Корзина: {$c['trash']}"
    );
}

function admin_show_rate(int $chatId): void {
    $d = data_read();
    $r = $d['settings']['rate'] ?? DEFAULT_RATE;
    $u = $d['settings']['rateUpdate'] ?? 0;
    tg_send($chatId,
        "Курс USD/RUB: {$r} руб\n".
        "Обновлён: ".($u ? date('d.m.Y H:i', $u) : 'никогда')."\n\n".
        "Изменить: отправьте \"курс 96\" (без кавычек)."
    );
}

function admin_update_rate(int $chatId, float $rate): void {
    if ($rate < 30 || $rate > 500) {
        tg_send($chatId, "Курс вне разумного диапазона (30 или 500).");
        return;
    }
    $d = data_read();
    $d['settings']['rate']       = $rate;
    $d['settings']['rateUpdate'] = time();
    data_write($d);
    tg_send($chatId, "Курс обновлён: {$rate} руб/USD");
}

function admin_show_promos(int $chatId): void {
    $d = data_read();
    $p = $d['promos'] ?? [];
    if (!$p) { tg_send($chatId, "Промокодов нет. Добавьте в админ-панели."); return; }
    $t = "Активные промокоды:\n\n";
    foreach ($p as $x) {
        $t .= "{$x['code']} · ".($x['discount'] ?? 0)."%\n";
        if (!empty($x['expires'])) $t .= "  до ".date('d.m.Y', $x['expires'])."\n";
        $t .= "  использован ".($x['uses'] ?? 0)." раз\n\n";
    }
    tg_send($chatId, $t);
}

function admin_show_lead(int $chatId, string $id): void {
    $d = data_read();
    foreach ($d['leads'] as $l) {
        if ($l['id'] === $id) {
            tg_send($chatId, format_lead_notification($l), tg_inline_lead_actions($id));
            return;
        }
    }
    tg_send($chatId, "Заявка {$id} не найдена.");
}

function admin_search_leads(int $chatId, string $q): void {
    $q = mb_strtolower($q);
    $d = data_read();
    $found = [];
    foreach ($d['leads'] as $l) {
        $hay = mb_strtolower($l['name'].' '.$l['phone'].' '.$l['tg'].' '.$l['email'].' '.$l['id']);
        if (mb_strpos($hay, $q) !== false) { $found[] = $l; if (count($found) >= 5) break; }
    }
    if (!$found) { tg_send($chatId, "Ничего не найдено."); return; }
    foreach ($found as $l) {
        tg_send($chatId, format_lead_notification($l), tg_inline_lead_actions($l['id']));
    }
}
