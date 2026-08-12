<?php
/**
 * Уведомления владельцу о ключевых событиях сайта — в 3 канала сразу:
 *   1) почта kulturniy.centr.mir@gmail.com (компактное фирменное письмо, mail_queue);
 *   2) Telegram: супергруппа-форум владельца, каждая тема — своя ветка
 *      (message_thread_id); ветки создаются один раз через createForumTopic
 *      и кэшируются в таблице tg_topics (создаётся мягко);
 *   3) VK: сообщение в чат сообщества (peer_id ищется через messages.getConversations
 *      и кэшируется в settings.owner_vk_peer).
 *
 * Плюс серверная аналитика: site_event() пишет строку в site_events (мягко),
 * а owner_notify() автоматически фиксирует событие там же.
 *
 * Контракт: owner_notify(string $topic, string $title, string $text, array $data=[]).
 * $topic — одна из тем owner_topics(). $data — пары «Подпись => значение» для
 * письма/сообщения; служебные ключи с подчёркиванием (_event, _path, _meta)
 * в текст не попадают и управляют записью в site_events.
 *
 * ВСЕ ошибки каналов — тихие: ни одна не роняет основной поток (заявку/оплату).
 */
declare(strict_types=1);

/** Почта владельца для событийных писем. */
const OWNER_NOTIFY_EMAIL = 'kulturniy.centr.mir@gmail.com';

/** Форум-супергруппа владельца (РАБОЧИЙ ЧАТ, бот — админ). Фолбэк, если конфиг пуст. */
const OWNER_TG_FALLBACK_CHAT = '-1002647253085';

/** Темы форума (ветки) и тип события для site_events. */
function owner_topics(): array {
    return [
        'ЗАЯВКИ'         => 'application',
        'ОПЛАТЫ'         => 'payment',
        'ЗАКАЗЫ НАГРАД'  => 'order',
        'ВИП-КЛУБ'       => 'club',
        'ПОДПИСЧИКИ'     => 'subscribe',
        'ЧАТ-БОТ'        => 'chat',
        'РЕГИСТРАЦИИ'    => 'register',
        'ДОЖИМЫ'         => 'followup',
        'АНАЛИТИКА'      => 'analytics',
    ];
}

/* ═══════════════════════ Полные данные события для письма центру ═══════════════════════ */

/**
 * Полный набор полей заявки для письма/уведомления владельцу + кнопка «Оценить»
 * (дип-линк в нужный раздел админки: короткие → grading, длинные → longcomp).
 * Пустые поля отбрасываются. $extra объединяется поверх (служебные _event/_meta/_path,
 * а также Сумма/Платёж по ситуации).
 */
function owner_app_data(int $appId, array $extra = []): array {
    $a = one("SELECT * FROM applications WHERE id=?", [$appId]);
    if (!$a) return $extra;
    $c = one("SELECT * FROM competitions WHERE id=?", [(int) $a['competition_id']]) ?: [];
    $isLong = ((string) ($c['results_mode'] ?? '')) === 'list';
    $isGroup = (int) ($a['is_group'] ?? 0) === 1 || trim((string) ($a['group_name'] ?? '')) !== '';
    $who = $isGroup ? (trim((string) $a['group_name']) ?: trim((string) $a['full_name'])) : trim((string) $a['full_name']);
    $adminBase = rtrim((string) cfgv('base_url'), '/') . '/admin/?p=' . ($isLong ? 'longcomp' : 'grading') . '&id=' . $appId;

    $nomination = trim(((string) ($a['nomination'] ?? '')) . ' · ' . ((string) ($a['subgroup'] ?? '')), " ·");
    $video = trim((string) ($a['video_url'] ?? ''));
    $status = (string) ($a['status'] ?? '');
    $statusRu = ['new' => 'Новая', 'paid' => 'Оплачена', 'graded' => 'Оценена', 'rejected' => 'Отклонена'][$status] ?? $status;

    $fields = [
        'Номер'                => (string) $a['number'],
        'Конкурс'              => (string) ($c['name'] ?? ''),
        'Тип конкурса'         => $isLong ? 'Длинный (список)' : 'Короткий (5 раб. дней)',
        ($isGroup ? 'Коллектив' : 'Участник') => $who,
        'ФИО (для диплома)'    => (string) $a['full_name'],
        'Формат'               => (string) ($a['formation'] ?? ''),
        'Возрастная категория' => (string) ($a['age_category'] ?? ''),
        'Номинация'            => $nomination,
        'Конкурсный номер'     => (string) ($a['work_title'] ?? ''),
        'Педагог'              => (string) ($a['teacher'] ?? ''),
        'Учреждение'           => (string) ($a['institution'] ?? ''),
        'Город'                => (string) ($a['city'] ?? ''),
        'Email'                => (string) ($a['email'] ?? ''),
        'Телефон'              => (string) ($a['phone'] ?? ''),
        'Конкурсный материал'  => $video !== '' ? ($video . (($a['video_platform'] ?? '') !== '' ? '  (' . $a['video_platform'] . ')' : '')) : '',
        'Статус'               => $statusRu,
    ];
    // Убираем пустые.
    $fields = array_filter($fields, static fn($v) => trim((string) $v) !== '');

    $actions = [
        ['Оценить заявку', $adminBase],
    ];
    // $extra может добавить поля (Сумма/Платёж) и служебные ключи; свои _actions не трогаем.
    $data = $fields;
    foreach ($extra as $k => $v) $data[$k] = $v;
    if (!isset($data['_actions'])) $data['_actions'] = $actions;
    return $data;
}

/* ═══════════════════════ Аналитика: site_events ═══════════════════════ */

/** Мягкое создание таблицы событий сайта. */
function site_events_ensure(): void {
    static $done = false;
    if ($done) return;
    $done = true;
    try {
        q("CREATE TABLE IF NOT EXISTS site_events (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            ts TEXT DEFAULT (datetime('now')),
            type TEXT NOT NULL,
            path TEXT DEFAULT '',
            user_id INTEGER,
            session TEXT DEFAULT '',
            meta TEXT DEFAULT ''
        )");
        q("CREATE INDEX IF NOT EXISTS idx_sev_ts ON site_events(ts)");
        q("CREATE INDEX IF NOT EXISTS idx_sev_type ON site_events(type)");
    } catch (\Throwable $e) { /* тихо */ }
}

/**
 * Запись события аналитики. Без ПД: meta — только короткие технические поля.
 * Никогда не бросает.
 */
function site_event(string $type, string $path = '', array $meta = [], ?int $userId = null, string $session = ''): void {
    try {
        site_events_ensure();
        $type = mb_substr(preg_replace('/[^a-z0-9_\-]/i', '', $type) ?? '', 0, 32);
        if ($type === '') return;
        if ($userId === null && function_exists('current_user')) {
            $userId = (int) (current_user()['id'] ?? 0) ?: null;
        }
        if ($session === '' && session_status() === PHP_SESSION_ACTIVE) {
            $session = substr(session_id(), 0, 16);
        }
        insert('site_events', [
            'type'    => $type,
            'path'    => mb_substr($path, 0, 200),
            'user_id' => $userId,
            'session' => mb_substr($session, 0, 32),
            'meta'    => $meta ? json_encode($meta, JSON_UNESCAPED_UNICODE) : '',
        ]);
    } catch (\Throwable $e) { /* тихо */ }
}

/* ═══════════════════════ Telegram: форум-ветки ═══════════════════════ */

/** chat_id супергруппы владельца. */
function owner_tg_chat(): string {
    $c = trim((string) cfgv('tg_owner_chat', ''));
    if ($c === '') $c = trim((string) cfgv('tg_orders_chat', ''));
    // Нужен числовой id форума; @username наградного канала не подходит.
    if ($c === '' || $c[0] === '@') $c = OWNER_TG_FALLBACK_CHAT;
    return $c;
}

/** Мягкое создание таблицы кэша веток форума. */
function owner_tg_topics_ensure(): void {
    static $done = false;
    if ($done) return;
    $done = true;
    try {
        q("CREATE TABLE IF NOT EXISTS tg_topics (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            chat_id TEXT NOT NULL,
            topic TEXT NOT NULL,
            thread_id INTEGER,
            created_at TEXT DEFAULT (datetime('now')),
            UNIQUE(chat_id, topic)
        )");
    } catch (\Throwable $e) { /* тихо */ }
}

/**
 * thread_id ветки форума для темы: из кэша tg_topics, иначе createForumTopic.
 * null — ветку получить не удалось (шлём в общий чат без thread).
 */
function owner_tg_thread(string $topic, bool $recreate = false): ?int {
    try {
        owner_tg_topics_ensure();
        $chat = owner_tg_chat();
        if (!$recreate) {
            $row = one("SELECT thread_id FROM tg_topics WHERE chat_id=? AND topic=?", [$chat, $topic]);
            if ($row && (int) $row['thread_id'] > 0) return (int) $row['thread_id'];
        }
        if (!function_exists('tg_api')) return null;
        $res = tg_api('createForumTopic', ['chat_id' => $chat, 'name' => $topic]);
        $tid = (int) ($res['result']['message_thread_id'] ?? 0);
        if (!($res['ok'] ?? false) || $tid <= 0) return null;
        q("INSERT INTO tg_topics(chat_id, topic, thread_id) VALUES(?,?,?)
           ON CONFLICT(chat_id, topic) DO UPDATE SET thread_id=excluded.thread_id", [$chat, $topic, $tid]);
        return $tid;
    } catch (\Throwable $e) {
        return null;
    }
}

/** Отправка HTML-сообщения в нужную ветку форума владельца. Тихо. */
function owner_tg_send(string $topic, string $html): void {
    if (!function_exists('tg_api')) return;
    $chat = owner_tg_chat();
    $params = [
        'chat_id'              => $chat,
        'text'                 => $html,
        'parse_mode'           => 'HTML',
        'link_preview_options' => ['is_disabled' => true],
    ];
    $tid = owner_tg_thread($topic);
    if ($tid !== null) $params['message_thread_id'] = $tid;
    $res = tg_api('sendMessage', $params);
    if (($res['ok'] ?? false)) return;

    $desc = (string) ($res['description'] ?? '');
    // Ветка удалена/закрыта — пересоздаём один раз и повторяем.
    if ($tid !== null && stripos($desc, 'thread not found') !== false) {
        $tid2 = owner_tg_thread($topic, true);
        if ($tid2 !== null) {
            $params['message_thread_id'] = $tid2;
            $res = tg_api('sendMessage', $params);
            if (($res['ok'] ?? false)) return;
        }
    }
    // Последний фолбэк — без ветки, с префиксом темы.
    unset($params['message_thread_id']);
    $params['text'] = '#' . str_replace([' ', '-'], '_', $topic) . "\n" . $html;
    tg_api('sendMessage', $params);
}

/* ═══════════════════════ VK: чат сообщества ═══════════════════════ */

/**
 * peer_id чата сообщества для событий владельца.
 * Ищем через messages.getConversations (токен группы cfgv('vk_token')) первый
 * peer типа chat (peer_id > 2e9) и кэшируем в settings.owner_vk_peer.
 *
 * TODO(vk): чат по инвайту https://vk.me/join/Y4sbWBH7DzKTIMA4LgULGSLHq_DOnMs3mpY=
 * групповым токеном по ссылке не резолвится (messages.joinChatByInviteLink —
 * только пользовательский токен). Если сообщество ещё не добавлено в этот чат
 * или чат не виден в getConversations — канал ВК помечается недоступным
 * (owner_vk_peer='none') и тихо пропускается. Чтобы включить: добавить
 * сообщество в чат, затем очистить настройку:
 *   DELETE FROM settings WHERE key='owner_vk_peer';
 */
function owner_vk_peer(): int {
    try {
        $cached = setting('owner_vk_peer', null);
        if ($cached !== null && $cached !== '') {
            return $cached === 'none' ? 0 : (int) $cached;
        }
        if ((string) cfgv('vk_token') === '') return 0;
        if (!function_exists('vk_api')) {
            if (!is_file(BASE_PATH . '/core/vk.php')) return 0;
            require_once BASE_PATH . '/core/vk.php';
        }
        $r = vk_api('messages.getConversations', [
            'count'    => 50,
            'group_id' => (int) cfgv('vk_group_id', 211325055),
        ]);
        $peer = 0;
        foreach (($r['response']['items'] ?? []) as $it) {
            $p = $it['conversation']['peer'] ?? [];
            if (($p['type'] ?? '') === 'chat' && (int) ($p['id'] ?? 0) > 2000000000) {
                $peer = (int) $p['id'];
                break;
            }
        }
        set_setting('owner_vk_peer', $peer > 0 ? (string) $peer : 'none');
        return $peer;
    } catch (\Throwable $e) {
        return 0;
    }
}

/** Отправка события в чат сообщества ВК. Тихо. */
function owner_vk_send(string $text): void {
    try {
        $peer = owner_vk_peer();
        if ($peer <= 0) return; // чат недоступен — задокументировано в owner_vk_peer()
        if (!function_exists('vk_api')) return;
        vk_api('messages.send', [
            'peer_id'   => $peer,
            'random_id' => random_int(1, PHP_INT_MAX),
            'message'   => mb_substr($text, 0, 4000),
        ]);
    } catch (\Throwable $e) { /* тихо */ }
}

/* ═══════════════════════ Главная точка входа ═══════════════════════ */

/**
 * Уведомление владельца о событии: почта + Telegram-ветка + чат ВК + site_events.
 * Ошибки каналов тихие — основной поток (заявка/оплата/регистрация) не страдает.
 *
 * @param string $topic Тема из owner_topics(): ЗАЯВКИ | ОПЛАТЫ | ЗАКАЗЫ НАГРАД |
 *                      ВИП-КЛУБ | ПОДПИСЧИКИ | ЧАТ-БОТ | РЕГИСТРАЦИИ | ДОЖИМЫ | АНАЛИТИКА
 * @param string $title Короткий заголовок события
 * @param string $text  Основной текст (обычный текст, без HTML)
 * @param array  $data  Пары «Подпись => значение» (выводятся списком) +
 *                      служебные ключи: _event (тип для site_events),
 *                      _path (страница), _meta (массив меты для site_events).
 */
function owner_notify(string $topic, string $title, string $text, array $data = []): void {
    $topics = owner_topics();
    if (!isset($topics[$topic])) $topic = 'АНАЛИТИКА';

    // Служебные ключи не показываем в сообщениях.
    $eventType = (string) ($data['_event'] ?? $topics[$topic]);
    $eventPath = (string) ($data['_path'] ?? '');
    $eventMeta = is_array($data['_meta'] ?? null) ? $data['_meta'] : [];
    // Кнопки-действия для письма (пары [подпись, url]); в TG/ВК добавим текстом.
    $actions = [];
    foreach ((is_array($data['_actions'] ?? null) ? $data['_actions'] : []) as $act) {
        if (is_array($act) && isset($act[0], $act[1]) && trim((string) $act[1]) !== '') {
            $actions[] = [(string) $act[0], (string) $act[1]];
        }
    }
    $fields = [];
    foreach ($data as $k => $v) {
        if (is_string($k) && $k !== '' && $k[0] === '_') continue;
        if (is_array($v) || is_object($v)) $v = json_encode($v, JSON_UNESCAPED_UNICODE);
        $v = trim((string) $v);
        if ($v !== '') $fields[(string) $k] = mb_substr($v, 0, 300);
    }

    /* 1. Серверная аналитика */
    try {
        if (!$eventMeta) {
            $eventMeta = ['title' => mb_substr($title, 0, 120)];
        }
        site_event($eventType, $eventPath, $eventMeta);
    } catch (\Throwable $e) { /* тихо */ }

    /* 2. Почта владельцу (компактное фирменное письмо, через очередь) */
    try {
        if (function_exists('mail_queue')) {
            $html = function_exists('mail_template')
                ? mail_template('owner_event', [
                    'topic' => $topic, 'title' => $title, 'text' => $text,
                    'fields' => $fields, 'actions' => $actions, 'preheader' => $title,
                    'unsubscribe_url' => rtrim((string) cfgv('base_url'), '/') . '/admin/',
                  ])
                : '<p><b>' . h($topic . ' — ' . $title) . '</b></p><p>' . nl2br(h($text)) . '</p>';
            mail_queue(OWNER_NOTIFY_EMAIL, 'Оргкомитет', '[' . $topic . '] ' . $title, $html);
        }
    } catch (\Throwable $e) { /* тихо */ }

    /* 3. Telegram: ветка форума */
    try {
        $tg = '<b>' . h($title) . '</b>';
        if (trim($text) !== '') $tg .= "\n" . h($text);
        foreach ($fields as $k => $v) $tg .= "\n" . h($k) . ': ' . h($v);
        foreach ($actions as $act) $tg .= "\n<a href=\"" . h($act[1]) . '">' . h($act[0]) . '</a>';
        owner_tg_send($topic, mb_substr($tg, 0, 4000));
    } catch (\Throwable $e) { /* тихо */ }

    /* 4. VK: чат сообщества */
    try {
        $vk = '[' . $topic . '] ' . $title;
        if (trim($text) !== '') $vk .= "\n" . $text;
        foreach ($fields as $k => $v) $vk .= "\n" . $k . ': ' . $v;
        foreach ($actions as $act) $vk .= "\n" . $act[0] . ': ' . $act[1];
        owner_vk_send($vk);
    } catch (\Throwable $e) { /* тихо */ }
}
