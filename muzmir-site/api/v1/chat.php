<?php
/**
 * Чат поддержки с ИИ-помощником.
 * POST action=send {message}  - сохранить вопрос, ответить (Claude API -> мозг-агент -> rule-based фолбэк).
 * POST action=upload (multipart, file) - вложение фото/видео до 15 МБ -> public/uploads/chat/.
 * POST action=history - история текущей сессии чата.
 * История хранится в таблице chat_messages (создаётся/дополняется мягко) + в localStorage на клиенте.
 */
declare(strict_types=1);
require __DIR__ . '/_boot.php';
require_once BASE_PATH . '/core/chat_brain.php';   // общий «мозг» (общий с ботом ВК)
require_post();

$action     = input('action', 'send');
$uid        = current_user()['id'] ?? null;
$sessionKey = $_SESSION['chat_key'] ?? ($_SESSION['chat_key'] = bin2hex(random_bytes(8)));

chat_ensure_schema();

/* ---------- История сессии ---------- */
if ($action === 'history') {
    $rows = [];
    try {
        $rows = all(
            "SELECT role, text, file, created_at FROM chat_messages WHERE session_key=? ORDER BY id ASC LIMIT 100",
            [$sessionKey]
        );
    } catch (\Throwable $e) { $rows = []; }
    json_out(['ok' => true, 'session' => $sessionKey, 'messages' => $rows]);
}

/* ---------- Загрузка вложения (фото/видео) ---------- */
if ($action === 'upload') {
    if (!csrf_check()) json_out(['ok' => false, 'error' => 'Сессия устарела. Обновите страницу и попробуйте снова'], 419);
    if (!rate_ok('chat_up:' . client_ip(), 20, 3600)) {
        json_out(['ok' => false, 'error' => 'Слишком много загрузок, попробуйте позже'], 429);
    }
    if (empty($_FILES['file']) || ($_FILES['file']['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
        json_out(['ok' => false, 'error' => 'Файл не загружен или повреждён'], 422);
    }
    $f = $_FILES['file'];
    if (!is_uploaded_file($f['tmp_name'])) json_out(['ok' => false, 'error' => 'Ошибка загрузки файла'], 422);
    if ((int) $f['size'] > 15 * 1024 * 1024) json_out(['ok' => false, 'error' => 'Файл слишком большой (максимум 15 МБ)'], 413);

    $ext    = strtolower(pathinfo((string) $f['name'], PATHINFO_EXTENSION));
    $imgExt = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'heif'];
    $vidExt = ['mp4', 'mov', 'webm', 'm4v', '3gp'];
    $kind   = in_array($ext, $imgExt, true) ? 'image' : (in_array($ext, $vidExt, true) ? 'video' : '');
    if ($kind === '') json_out(['ok' => false, 'error' => 'Можно прикрепить только фото или видео'], 422);
    $mime = function_exists('mime_content_type') ? (string) @mime_content_type($f['tmp_name']) : '';
    if ($mime !== '' && !preg_match('~^(image|video)/~', $mime)) {
        json_out(['ok' => false, 'error' => 'Файл не похож на фото или видео'], 422);
    }

    $dir = BASE_PATH . '/public/uploads/chat/';
    if (!is_dir($dir)) @mkdir($dir, 0775, true);
    $name = 'chat_' . date('Ymd') . '_' . bin2hex(random_bytes(6)) . '.' . $ext;
    if (!@move_uploaded_file($f['tmp_name'], $dir . $name)) {
        json_out(['ok' => false, 'error' => 'Не удалось сохранить файл'], 500);
    }
    $rel = 'uploads/chat/' . $name;
    try {
        insert('chat_messages', ['user_id' => $uid, 'session_key' => $sessionKey, 'role' => 'user', 'text' => '', 'file' => $rel]);
    } catch (\Throwable $e) {}
    json_out(['ok' => true, 'url' => url($rel), 'file' => $rel, 'kind' => $kind, 'session' => $sessionKey]);
}

/* ---------- Отправка сообщения ---------- */
if (!csrf_check()) json_out(['ok' => false, 'error' => 'Сессия устарела. Обновите страницу и попробуйте снова'], 419);
if (!rate_ok('chat:' . client_ip(), 40, 3600)) {
    json_out(['ok' => false, 'error' => 'Слишком много сообщений, попробуйте позже'], 429);
}

$text = trim(input('message'));
if ($text === '') $text = trim(input('text')); // совместимость со старым форматом {text}
if ($text === '') json_out(['ok' => false, 'error' => 'Пустое сообщение'], 422);
if (mb_strlen($text) > 2000) $text = mb_substr($text, 0, 2000);

// Первое ли это сообщение сессии (для уведомления владельцу о новом диалоге).
$isFirstMessage = false;
try {
    $isFirstMessage = (int) scalar(
        "SELECT COUNT(*) FROM chat_messages WHERE session_key=? AND role='user'", [$sessionKey]
    ) === 0;
} catch (\Throwable $e) {}

try {
    insert('chat_messages', ['user_id' => $uid, 'session_key' => $sessionKey, 'role' => 'user', 'text' => $text, 'file' => '']);
} catch (\Throwable $e) {}

// --- уведомление владельца о новом диалоге чат-бота + серверная аналитика ---
if ($isFirstMessage && is_file(BASE_PATH . '/core/notify_owner.php')) {
    require_once BASE_PATH . '/core/notify_owner.php';
    try {
        owner_notify('ЧАТ-БОТ', 'Новый диалог в чате сайта', mb_substr($text, 0, 500), [
            'Сессия'       => $sessionKey,
            'Пользователь' => $uid ? ('id ' . $uid) : 'гость',
            '_event'       => 'chat_start',
            '_meta'        => ['session' => $sessionKey],
        ]);
    } catch (\Throwable $e) { /* тихо */ }
}

// Ответ помощника: Gemini → Claude → внешний агент → rule-based (общий «мозг»).
$reply = chat_brain_reply($text, $sessionKey, $uid);

try {
    insert('chat_messages', ['user_id' => $uid, 'session_key' => $sessionKey, 'role' => 'assistant', 'text' => $reply, 'file' => '']);
} catch (\Throwable $e) {}

// Контекстные кнопки-действия под ответом (ссылки на разделы, диплом файлом, отзыв в конце).
$actions = chat_actions($text, $uid, $sessionKey);

json_out(['ok' => true, 'reply' => $reply, 'actions' => $actions, 'session' => $sessionKey]);

/* ==================== Помощники ==================== */

/** Мягкое создание таблицы chat_messages + колонки file (не ломая существующую схему). */
function chat_ensure_schema(): void {
    try {
        q("CREATE TABLE IF NOT EXISTS chat_messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER, session_key TEXT, role TEXT, text TEXT,
            file TEXT DEFAULT '',
            created_at TEXT DEFAULT (datetime('now'))
        )");
        $cols = array_map(static fn($c) => $c['name'] ?? '', all("PRAGMA table_info(chat_messages)"));
        if (!in_array('file', $cols, true)) {
            q("ALTER TABLE chat_messages ADD COLUMN file TEXT DEFAULT ''");
        }
    } catch (\Throwable $e) {}
}

/**
 * Контекстные кнопки-действия под ответом помощника: ссылки на разделы,
 * положение, образцы наград, диплом файлом (для авторизованных), запрос отзыва.
 * @return array<int,array{type:string,label:string,url?:string}>
 */
function chat_actions(string $text, ?int $uid, string $sessionKey): array {
    $t = mb_strtolower($text);
    $has = static function (array $w) use ($t): bool {
        foreach ($w as $x) if (mb_strpos($t, $x) !== false) return true;
        return false;
    };
    $acts = [];
    $seen = [];
    $add = function (string $label, string $url) use (&$acts, &$seen): void {
        if (isset($seen[$url])) return; $seen[$url] = 1;
        $acts[] = ['type' => 'link', 'label' => $label, 'url' => $url];
    };

    if ($has(['заявк', 'подать', 'участвова', 'регистрац', 'записат', 'подобра', 'какой конкурс', 'выбрать конкурс'])) {
        $add('Подать заявку', url('/apply'));
        $add('Все конкурсы', url('/competitions'));
    }
    if ($has(['положen', 'положен', 'правил', 'регламент', 'условия'])) {
        $add('Положения конкурсов', url('/competitions'));
        $add('Документы', url('/documents'));
    }
    if ($has(['наград', 'кубок', 'медал', 'статуэт', 'заказ', 'образц', 'оплат', 'цена', 'стоим'])) {
        $add('Образцы наград и цены', url('/awards'));
    }
    if ($has(['результат', 'итог', 'балл', 'оцен', 'победител', 'лауреат'])) {
        $add('Результаты конкурсов', url('/results'));
    }
    // Диплом файлом — для авторизованных с готовыми дипломами; иначе проверка по номеру.
    if ($has(['диплом', 'сертификат', 'скачать', 'провер', 'подлинн'])) {
        $got = false;
        if ($uid) {
            try {
                $ds = all("SELECT d.number, d.result FROM diplomas d JOIN applications a ON a.id=d.application_id
                           WHERE a.user_id=? ORDER BY d.created_at DESC LIMIT 4", [$uid]);
                foreach ($ds as $d) {
                    $add('Диплом ' . ($d['result'] ?: '№ ' . $d['number']) . ' (PDF)', url('/diploma/' . $d['number'] . '.pdf'));
                    $got = true;
                }
            } catch (\Throwable $e) {}
            if ($got) $add('Все мои дипломы', url('/cabinet') . '#diplomas');
        }
        if (!$got) $add('Проверить диплом по номеру', url('/verify'));
    }
    if ($has(['контакт', 'телефон', 'связат', 'вконтакте', 'вк ', 'сообществ'])) {
        $add('Написать в сообществе ВК', (string) cfgv('org_vk'));
        $add('Контакты', url('/contacts'));
    }
    if ($has(['клуб', 'подписк', 'скидк', 'постоянн'])) {
        $add('Клуб постоянных участников', url('/club'));
    }

    // Запрос отзыва в конце диалога: после 3+ ответов помощника и на «спасибо/пока»,
    // один раз за сессию (флаг в БД как системное сообщение role='review_asked').
    try {
        $agentCnt = (int) scalar("SELECT COUNT(*) FROM chat_messages WHERE session_key=? AND role='assistant'", [$sessionKey]);
        $asked    = (int) scalar("SELECT COUNT(*) FROM chat_messages WHERE session_key=? AND role='review_asked'", [$sessionKey]);
        $bye      = $has(['спасибо', 'благодар', 'пока', 'до свидан', 'всё понятно', 'все понятно', 'ясно, спасибо']);
        if ($asked === 0 && ($agentCnt >= 3 || $bye)) {
            $acts[] = ['type' => 'review', 'label' => 'Оценить работу центра'];
            try { insert('chat_messages', ['user_id' => $uid, 'session_key' => $sessionKey, 'role' => 'review_asked', 'text' => '', 'file' => '']); } catch (\Throwable $e) {}
        }
    } catch (\Throwable $e) {}

    return $acts;
}

