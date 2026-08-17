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
require_once BASE_PATH . '/core/chat_priority.php'; // очередь: Клубу моментально, остальным в срок
require_once BASE_PATH . '/core/chat_ops.php';     // состояние диалога: бот/оператор/график
require_post();

$action     = input('action', 'send');
$uid        = current_user()['id'] ?? null;
$sessionKey = $_SESSION['chat_key'] ?? ($_SESSION['chat_key'] = bin2hex(random_bytes(8)));

chat_ensure_schema();

/* ---------- История сессии ---------- */
if ($action === 'history') {
    // since — id последнего сообщения, которое уже показано в окне чата. Так вкладка
    // добирает только новое и может опрашивать часто, не перекачивая переписку целиком.
    // Именно этим ответ оператора из админки доходит до человека: он лежит в той же
    // истории, и вкладка подхватывает его следующим же опросом.
    $since = (int) input('since', 0);
    $rows = [];
    try {
        $rows = $since > 0
            ? all("SELECT id, role, text, file, created_at FROM chat_messages
                    WHERE session_key=? AND id>?
                      AND (COALESCE(visible_at,'') = '' OR visible_at <= datetime('now','localtime'))
                    ORDER BY id ASC LIMIT 100", [$sessionKey, $since])
            : all("SELECT id, role, text, file, created_at FROM chat_messages
                    WHERE session_key=?
                      AND (COALESCE(visible_at,'') = '' OR visible_at <= datetime('now','localtime'))
                    ORDER BY id DESC LIMIT 100", [$sessionKey]);
        if ($since <= 0) $rows = array_reverse($rows);   // последние 100, в прямом порядке
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

    require_once BASE_PATH . '/core/chat_media.php';   // мультимодал: голос/видео/фото → текст
    $ext    = strtolower(pathinfo((string) $f['name'], PATHINFO_EXTENSION));
    $kind   = chat_media_kind($ext);                   // image | audio | video | ''
    if ($kind === '') json_out(['ok' => false, 'error' => 'Можно прикрепить фото, голосовое или видео'], 422);
    $mime = function_exists('mime_content_type') ? (string) @mime_content_type($f['tmp_name']) : '';
    if ($mime !== '' && !preg_match('~^(image|audio|video)/~', $mime)) {
        json_out(['ok' => false, 'error' => 'Файл не похож на фото, голосовое или видео'], 422);
    }

    $dir = BASE_PATH . '/public/uploads/chat/';
    if (!is_dir($dir)) @mkdir($dir, 0775, true);
    $name = 'chat_' . date('Ymd') . '_' . bin2hex(random_bytes(6)) . '.' . $ext;
    if (!@move_uploaded_file($f['tmp_name'], $dir . $name)) {
        json_out(['ok' => false, 'error' => 'Не удалось сохранить файл'], 500);
    }
    $rel = 'uploads/chat/' . $name;

    // Мультимодальное понимание: голос → расшифровка, фото/видео → распознавание (Gemini, бесплатно).
    $understanding = '';
    try { $understanding = chat_media_understand($dir . $name, $kind, $mime); } catch (\Throwable $e) {}
    $derived = chat_media_as_user_text($kind, $understanding);

    // Сохраняем сообщение-вложение; для голосового текст = расшифровка (попадёт в историю/контекст).
    try {
        insert('chat_messages', ['user_id' => $uid, 'session_key' => $sessionKey, 'role' => 'user',
            'text' => ($kind === 'audio' ? $understanding : ''), 'file' => $rel]);
    } catch (\Throwable $e) {}

    // Реестр диалога + владельцу о новом диалоге (если это первое сообщение).
    $greetName = '';
    if ($uid && ($cu = current_user())) {
        $nick = trim((string) ($cu['nickname'] ?? '')); $full = trim((string) ($cu['full_name'] ?? ''));
        if ($nick !== '') $greetName = $nick;
        elseif ($full !== '') { $parts = preg_split('~\s+~u', $full); $greetName = (count($parts) >= 3) ? $parts[1] : $parts[0]; }
    }
    try { chat_dialog_set($sessionKey, ['channel' => 'web', 'title' => $greetName]); } catch (\Throwable $e) {}

    // Ничего не распознали (или нет ключа Gemini) — просто подтверждаем получение вложения.
    if ($derived === '') {
        $ack = 'Спасибо, вложение получила. Подскажите, пожалуйста, по какому вопросу — заявка, оплата, результаты или наградные материалы, — и я помогу.';
        json_out(['ok' => true, 'url' => url($rel), 'file' => $rel, 'kind' => $kind, 'session' => $sessionKey,
                  'understood' => false, 'reply' => $ack]);
    }

    // Оператор ведёт диалог вручную / бот выключен — авто-ответ не даём.
    if (($muted = chat_bot_muted($sessionKey)) !== '') {
        json_out(['ok' => true, 'url' => url($rel), 'file' => $rel, 'kind' => $kind, 'session' => $sessionKey,
                  'understood' => true, 'reply' => '', 'muted' => $muted]);
    }
    // Вне рабочего времени — шаблон, вопрос сохранён (ответим утром).
    if (!chat_is_working_hours()) {
        $tpl = chat_offhours_template($greetName);
        if ((int) (chat_dialog_get($sessionKey)['pending_offhours'] ?? 0) !== 1) {
            chat_dialog_set($sessionKey, ['pending_offhours' => 1, 'offhours_at' => date('Y-m-d H:i:s')]);
        }
        try { insert('chat_messages', ['user_id' => $uid, 'session_key' => $sessionKey, 'role' => 'assistant', 'text' => $tpl, 'file' => '']); } catch (\Throwable $e) {}
        json_out(['ok' => true, 'url' => url($rel), 'file' => $rel, 'kind' => $kind, 'session' => $sessionKey,
                  'understood' => true, 'reply' => $tpl, 'offhours' => true]);
    }

    // Отвечаем «мозгом» по распознанному содержимому вложения.
    $ctx  = chat_user_context($uid);
    $hint = chat_context_from_dialogue($sessionKey, $derived);
    $GLOBALS['chat_user_ctx'] = $hint !== '' ? trim($ctx . "\n" . $hint) : $ctx;
    $greet = chat_should_greet($sessionKey);
    $core  = chat_brain_reply($derived, $sessionKey, $uid, 'web');
    if (!empty($GLOBALS['chat_fell_back'])) {
        $tail = chat_escalate_no_answer($uid, $sessionKey, $greetName, $derived, 'web');
        if ($tail !== '') $core = trim($core . "\n\n" . $tail);
    }
    $reply = chat_wrap_reply($sessionKey, $core, $greetName, $greet, false);
    try { insert('chat_messages', ['user_id' => $uid, 'session_key' => $sessionKey, 'role' => 'assistant', 'text' => $reply, 'file' => '']); } catch (\Throwable $e) {}
    chat_maybe_escalate($derived, $uid, $sessionKey, $greetName);

    $actions = chat_actions($derived, $uid, $sessionKey);
    $fmt     = chat_web_format($reply, $actions);
    json_out(['ok' => true, 'url' => url($rel), 'file' => $rel, 'kind' => $kind, 'session' => $sessionKey,
              'understood' => true, 'reply' => $fmt['text'], 'actions' => $fmt['actions'], 'image' => chat_sample_image($derived)]);
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

// Имя для персонального приветствия (у авторизованных) — именно ИМЯ, а не фамилия.
$greetName = '';
if ($uid && ($cu = current_user())) {
    $nick = trim((string) ($cu['nickname'] ?? ''));
    $full = trim((string) ($cu['full_name'] ?? ''));
    if ($nick !== '') {
        $greetName = $nick;
    } elseif ($full !== '') {
        $parts = preg_split('~\s+~u', $full);
        // ФИО из 3 слов = «Фамилия Имя Отчество» → имя это 2-е слово.
        // Из 2 слов чаще вводят «Имя Фамилия» → берём 1-е (иначе здоровались фамилией).
        // Одно слово — его же.
        $greetName = (count($parts) >= 3) ? $parts[1] : $parts[0];
    }
}

// Регистрируем/обновляем диалог в реестре (для админ-раздела «Чат-бот»).
chat_dialog_set($sessionKey, ['channel' => 'web', 'title' => $greetName]);

// --- Ручной перехват / блокировка / выключенный бот: авто-ответ НЕ даём ---
// Оператор ведёт диалог из админки; клиент подхватит его сообщения опросом истории.
if (($muted = chat_bot_muted($sessionKey)) !== '') {
    json_out(['ok' => true, 'reply' => '', 'actions' => [], 'image' => null,
              'session' => $sessionKey, 'muted' => $muted]);
}

// --- Вне рабочего времени (9:00–18:00 МСК, кроме вс): шаблон, вопрос сохранён ---
if (!chat_is_working_hours()) {
    $d = chat_dialog_get($sessionKey);
    $tpl = chat_offhours_template($greetName);
    if ((int) ($d['pending_offhours'] ?? 0) !== 1) {
        chat_dialog_set($sessionKey, ['pending_offhours' => 1, 'offhours_at' => date('Y-m-d H:i:s')]);
    }
    try {
        insert('chat_messages', ['user_id' => $uid, 'session_key' => $sessionKey, 'role' => 'assistant', 'text' => $tpl, 'file' => '']);
    } catch (\Throwable $e) {}
    json_out(['ok' => true, 'reply' => $tpl, 'actions' => [], 'image' => null, 'session' => $sessionKey, 'offhours' => true]);
}
// Рабочее время: снимаем «нерабочий» флаг, если он оставался.
if ((int) (chat_dialog_get($sessionKey)['pending_offhours'] ?? 0) === 1) {
    chat_dialog_set($sessionKey, ['pending_offhours' => 0]);
}

// Персональный контекст участника (его заявки/статусы) — чтобы бот отвечал по делу.
// + «обучение на диалоге»: если участник назвал ФИО/номер заявки — подтягиваем его данные.
$ctx  = chat_user_context($uid);
$hint = chat_context_from_dialogue($sessionKey, $text);
$GLOBALS['chat_user_ctx'] = $hint !== '' ? trim($ctx . "\n" . $hint) : $ctx;

// Ответ по правилам диалога: приветствие раз в начале, подпись — только при завершении.
$closing = false;
if (chat_is_closing($text)) {
    $reply   = chat_closing_message($greetName);
    $closing = true;
} else {
    $greet = chat_should_greet($sessionKey);
    $core  = chat_brain_reply($text, $sessionKey, $uid, 'web');
    // Эскалация «нет ответа»: мозг ушёл в rule-фолбэк — просим позвонить + уведомляем владельца.
    if (!empty($GLOBALS['chat_fell_back'])) {
        $tail = chat_escalate_no_answer($uid, $sessionKey, $greetName, $text, 'web');
        if ($tail !== '') $core = trim($core . "\n\n" . $tail);
    }
    $reply = chat_wrap_reply($sessionKey, $core, $greetName, $greet, false);
}

/* ОЧЕРЕДЬ: КЛУБУ МОМЕНТАЛЬНО, ОСТАЛЬНЫМ В ОБЕЩАННЫЙ СРОК.
 *
 * Ответ уже готов, задерживается только его показ: участник Клуба видит его
 * сразу, обычный — через chat_delay_regular_sec. Пока ответ ждёт своего часа,
 * человеку сразу приходит подтверждение, что вопрос принят и когда будет ответ:
 * молчание в чате читается как поломка, а не как очередь. */
$delay = chat_reply_delay_sec($uid);
$visibleAt = $delay > 0 ? date('Y-m-d H:i:s', time() + $delay) : '';

try {
    insert('chat_messages', ['user_id' => $uid, 'session_key' => $sessionKey, 'role' => 'assistant',
                             'text' => $reply, 'file' => '', 'visible_at' => $visibleAt]);
} catch (\Throwable $e) {}
if ($closing) chat_mark_dialog_end($sessionKey); // маркер — ПОСЛЕ ответа

// --- Эскалация оператору в Телеграм (тихо для пользователя) ---
// Если участник просит живого человека, недоволен или упоминает возврат/жалобу —
// один раз за сессию отправляем владельцу диалог + имя + телефон + заявки, чтобы
// живой оператор мог подключиться. Пользователю НЕ пишем «передал специалистам».
chat_maybe_escalate($text, $uid, $sessionKey, $greetName);

// Контекстные кнопки-действия под ответом (ссылки на разделы, диплом файлом, отзыв в конце).
$actions = chat_actions($text, $uid, $sessionKey);

// Веб-формат: голые ссылки из текста -> красивые кнопки (в приложении), текст чистый.
$fmt     = chat_web_format($reply, $actions);
$actions = $fmt['actions'];
$image   = chat_sample_image($text);   // картинка-образец «по необходимости»

if ($delay > 0) {
    // Ответ придёт следующим опросом истории, когда настанет его время.
    $notice = chat_wait_notice($delay, $greetName);
    try {
        insert('chat_messages', ['user_id' => $uid, 'session_key' => $sessionKey, 'role' => 'assistant',
                                 'text' => $notice, 'file' => '']);
    } catch (\Throwable $e) {}
    json_out([
        'ok'      => true,
        'reply'   => $notice,
        'actions' => [],
        'image'   => null,
        'session' => $sessionKey,
        'queued'  => true,
        'eta_sec' => $delay,
    ]);
}

json_out([
    'ok'      => true,
    'reply'   => $fmt['text'],
    'actions' => $actions,
    'image'   => $image,
    'session' => $sessionKey,
]);

/**
 * Тихая эскалация оператору в Телеграм. Триггеры: просьба о живом человеке,
 * недовольство, возврат/жалоба. Один раз за сессию (маркер role='escalated').
 * Отправляет владельцу транскрипт + имя + телефон + заявки участника.
 */
function chat_maybe_escalate(string $text, ?int $uid, string $sessionKey, string $greetName): void {
    $t = mb_strtolower($text);
    $triggers = ['оператор', 'живой человек', 'с человеком', 'менеджер', 'жалоб', 'недоволен',
                 'недовольна', 'верните деньги', 'возврат', 'не помог', 'позовите', 'соедините',
                 'администратор', 'сотрудник', 'отвратительн', 'безобразие', 'обман'];
    $hit = false;
    foreach ($triggers as $w) if (mb_strpos($t, $w) !== false) { $hit = true; break; }
    if (!$hit) return;
    try {
        $already = (int) scalar("SELECT COUNT(*) FROM chat_messages WHERE session_key=? AND role='escalated'", [$sessionKey]);
        if ($already > 0) return;
    } catch (\Throwable $e) { return; }

    // Транскрипт последних сообщений.
    $lines = [];
    try {
        $rows = all("SELECT role, text FROM chat_messages WHERE session_key=? AND role IN ('user','assistant') ORDER BY id DESC LIMIT 12", [$sessionKey]);
        foreach (array_reverse($rows) as $r) {
            $who = $r['role'] === 'user' ? '👤' : '🤖';
            $tx = trim((string) $r['text']);
            if ($tx !== '') $lines[] = $who . ' ' . mb_substr($tx, 0, 240);
        }
    } catch (\Throwable $e) {}

    $name = $greetName; $phone = ''; $email = '';
    if ($uid && ($cu = current_user())) {
        $name = trim((string) ($cu['full_name'] ?? '')) ?: $greetName;
        $phone = trim((string) ($cu['phone'] ?? ''));
        $email = trim((string) ($cu['email'] ?? ''));
    }
    $apps = trim((string) ($GLOBALS['chat_user_ctx'] ?? ''));

    if (is_file(BASE_PATH . '/core/notify_owner.php')) {
        require_once BASE_PATH . '/core/notify_owner.php';
        try {
            owner_notify('ЧАТ-БОТ', '🔔 Нужен оператор — участник просит живого человека',
                implode("\n", $lines), [
                    'Участник' => $name ?: 'гость',
                    'Телефон'  => $phone,
                    'Почта'    => $email,
                    'Заявки'   => mb_substr($apps, 0, 280),
                    'Сессия'   => $sessionKey,
                    '_event'   => 'chat_escalation',
                    '_meta'    => ['session' => $sessionKey, 'uid' => (int) ($uid ?? 0)],
                ]);
        } catch (\Throwable $e) { /* тихо */ }
    }
    try { insert('chat_messages', ['user_id' => $uid, 'session_key' => $sessionKey, 'role' => 'escalated', 'text' => '', 'file' => '']); } catch (\Throwable $e) {}
}

/** Картинка-образец для чата: показываем реальный образец диплома/награды по запросу. */
function chat_sample_image(string $text): ?string {
    $t = mb_strtolower($text);
    $wants = false;
    foreach (['образц', 'пример', 'как выглядит', 'покажи', 'фото'] as $w) if (mb_strpos($t, $w) !== false) $wants = true;
    $topic = false;
    foreach (['диплом', 'наград', 'кубок', 'медал', 'грамот', 'благодар'] as $w) if (mb_strpos($t, $w) !== false) $topic = true;
    if (!($wants && $topic)) return null;
    foreach ((glob(BASE_PATH . '/public/assets/img/awards/*/diploma.jpg') ?: []) as $f) {
        return url(str_replace(BASE_PATH . '/public', '', $f));
    }
    return null;
}

/* ==================== Помощники ==================== */

/** Мягкое создание таблицы chat_messages + колонки file (не ломая существующую схему). */
function chat_ensure_schema(): void {
    try {
        q("CREATE TABLE IF NOT EXISTS chat_messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER, session_key TEXT, role TEXT, text TEXT,
            file TEXT DEFAULT '',
            created_at TEXT DEFAULT (datetime('now','localtime'))
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
    // Персональные заявки участника — прямая кнопка в кабинет к его заявкам.
    if ($uid && $has(['моя заявк', 'мои заявк', 'мою заявк', 'статус', 'что с заявк', 'где заявк', 'приняли', 'оплатил', 'моя работа', 'мои работы'])) {
        $add('Мои заявки', url('/cabinet') . '#apps');
    }

    // Вопрос про результат/диплом. Если у участника несколько действующих заявок и он
    // ещё не назвал конкретную — предлагаем выпадающий список (клиент рисует <select>).
    // Если заявка одна — списка нет, бот отвечает сразу по ней. Заодно, когда заявка
    // определена и аттестована, а диплом готов — добавляем кнопку скачивания (задача 2).
    $askResultDiploma = $has(['результат', 'итог', 'балл', 'оцен', 'диплом', 'сертификат', 'аттест', 'провер', 'готов ли', 'где мой', 'когда']);
    if ($uid && $askResultDiploma) {
        if (!function_exists('chat_gate_app')) require_once BASE_PATH . '/core/chat_gate.php';

        $acted = [];
        try {
            // Поля конкурса обязательны: без них не отличить длинный конкурс от
            // короткого, а подпись к заявке в выпадающем списке («аттестована,
            // результат готов») сама по себе выдавала итог до срока.
            $acted = all("SELECT a.*, c.name AS comp_name,
                                 c.results_mode AS comp_results_mode, c.results_date AS comp_results_date,
                                 c.results_published_at AS comp_results_pub
                            FROM applications a JOIN competitions c ON c.id = a.competition_id
                           WHERE a.user_id = ? AND a.status NOT IN ('rejected')
                        ORDER BY a.id DESC LIMIT 15", [$uid]);
        } catch (\Throwable $e) { $acted = []; }

        // Назвал ли участник конкретную заявку? Ищем номер заявки как подстроку сообщения
        // (номера вида «VR-2026-00006», регистр не важен) — иначе список для выбора.
        $target = null;
        foreach ($acted as $a) {
            $num = trim((string) ($a['number'] ?? ''));
            if ($num !== '' && mb_stripos($text, $num) !== false) { $target = $a; break; }
        }

        if ($target === null && count($acted) > 1) {
            // Несколько действующих заявок и номер не назван — выпадающий список.
            $options = [];
            foreach ($acted as $a) {
                $num = (string) ($a['number'] ?? $a['id'] ?? '');
                $g   = chat_gate_app((array) $a);
                $options[] = ['label' => '№' . $num . ' «' . (string) ($a['comp_name'] ?? '') . '» — ' . $g['status'],
                              'value' => (int) $a['id'], 'number' => $num];
            }
            $acts[] = ['type' => 'select', 'label' => 'Выберите заявку', 'options' => $options];
        } else {
            // Одна заявка ИЛИ участник назвал конкретную.
            //
            // КНОПКА СКАЧИВАНИЯ ДИПЛОМА — ТОЛЬКО ПО ОТПРАВЛЕННОМУ ДИПЛОМУ.
            // Здесь стояло условие «есть оценка → отдаём файл»: диплом уходил в чат
            // прямо из очереди на отправку, до письма участнику, а по длинному
            // конкурсу — до публикации итогов. Кнопка с дипломом сообщает звание
            // вернее любой фразы, поэтому решает не факт оценки, а факт отправки
            // (diplomas.sent_at) — ровно как в личном кабинете.
            if ($target === null && count($acted) === 1) $target = $acted[0];
            if ($target) {
                $g = chat_gate_app((array) $target);
                if ($g['may_result'] && $g['may_diploma']) {
                    try {
                        $dip = one("SELECT number FROM diplomas
                                     WHERE application_id=? AND COALESCE(sent_at,'')<>''
                                  ORDER BY id DESC LIMIT 1", [(int) $target['id']]);
                    } catch (\Throwable $e) { $dip = null; }
                    if ($dip && !empty($dip['number'])) {
                        $add('Скачать диплом (PDF)', url('/diploma/' . $dip['number'] . '.pdf'));
                    }
                }
            }
        }
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

