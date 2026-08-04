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

$reply  = null;
// Gemini (бесплатные ключи) — первый приоритет; при ошибке тихо падаем ниже.
$geminiKey = (string) (cfgv('gemini_api_key') ?: '');
if ($geminiKey !== '') {
    $reply = chat_gemini_reply($geminiKey, $sessionKey, $text);
}
$apiKey = (string) (cfgv('claude_api_key') ?: '');
if (($reply === null || $reply === '') && $apiKey !== '') {
    $reply = chat_claude_reply($apiKey, $sessionKey, $text);
}
// Совместимость: внешний мозг-агент, если настроен и Claude не ответил.
if (($reply === null || $reply === '') && ($agentUrl = cfgv('agent_url'))) {
    $reply = agent_chat_proxy((string) $agentUrl, (string) cfgv('agent_token'), $text, $sessionKey, $uid);
}
if ($reply === null || $reply === '') {
    $reply = chat_rule_reply($text);
}

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

/** Краткая база знаний сайта для системного промпта помощника. */
function chat_system_prompt(): string {
    $L   = [];
    $L[] = 'Ты - помощник поддержки сайта Культурного центра «Музыкальный Мир»: международные и всероссийские онлайн-конкурсы и фестивали культуры и искусства (' . cfgv('org_reg') . ').';
    $L[] = 'Правила: отвечай кратко (2-5 предложений), дружелюбно, только по-русски, обращение на «Вы», без выдумок. Если ответа нет в базе знаний - вежливо направь в Оргкомитет: почта ' . cfgv('org_email') . ', телефон ' . cfgv('org_phone') . ', режим работы: ' . cfgv('org_hours') . '.';

    $comps = '';
    try {
        foreach (all("SELECT name, is_paid, price FROM competitions ORDER BY sort") as $c) {
            $comps .= '«' . $c['name'] . '» - ' . ((int) $c['is_paid'] ? ('оргвзнос ' . (int) $c['price'] . ' руб за заявку') : 'участие бесплатное') . '; ';
        }
    } catch (\Throwable $e) {}
    $L[] = $comps !== ''
        ? 'Конкурсы: ' . trim($comps)
        : 'Конкурсы: «Слава России» - бесплатный; «Эврика» и «Симфония Звёзд» - оргвзнос 500 руб за одну заявку.';

    $L[] = 'Как подать заявку: страница /apply - выбрать конкурс, заполнить форму, прикрепить ссылку на конкурсное видео. Принимаются площадки: RuTube, ВК Видео, Яндекс Диск, Google Диск, ОК Видео, Дзен Видео. Instagram, Facebook, TikTok, YouTube не принимаются.';
    $L[] = 'Результаты: «Эврика» - каждому участнику на электронную почту из заявки в течение 5 рабочих дней после аттестации. Электронные дипломы отправляются на почту, указанную в заявке. Проверка подлинности диплома - страница /verify по номеру диплома.';

    $aw = '';
    try {
        foreach (all("SELECT item, kind, price FROM awards_prices WHERE competition_id IS NULL ORDER BY id") as $p) {
            $aw .= $p['item'] . ' (' . (($p['kind'] ?? '') === 'digital' ? 'электронный' : 'оригинал') . ') - ' . (int) $p['price'] . ' руб; ';
        }
    } catch (\Throwable $e) {}
    if ($aw !== '') {
        $L[] = 'Наградной материал (заказ добровольный, после оглашения результатов, страница /awards; доставка оригиналов - наложенным платежом): ' . trim($aw);
    } else {
        $L[] = 'Наградной материал заказывается добровольно после оглашения результатов на странице /awards; доставка оригиналов - наложенным платежом.';
    }

    $L[] = 'Оценка - 10-балльная шкала: 9-10 Гран-при, 8-9 Лауреат I степени, 7-8 Лауреат II, 6-7 Лауреат III, ниже - Дипломант I-III. Оргвзнос за уже аттестованный номер не возвращается; при отклонении заявки из-за нарушения правил - возвращается полностью.';
    return implode("\n", $L);
}

/**
 * Вызов Gemini API (generativelanguage.googleapis.com generateContent).
 * Та же база знаний (chat_system_prompt) через systemInstruction.
 * Тихий фолбэк на null при любой ошибке — дальше Claude/агент/rule-based.
 */
function chat_gemini_reply(string $apiKey, string $sessionKey, string $text): ?string {
    // История сессии -> contents (роли user/model, первым обязан идти user).
    $contents = [];
    try {
        $rows = all(
            "SELECT role, text FROM chat_messages WHERE session_key=? AND text<>'' ORDER BY id DESC LIMIT 12",
            [$sessionKey]
        );
        foreach (array_reverse($rows) as $r) {
            $role = ($r['role'] ?? '') === 'assistant' ? 'model' : 'user';
            if (!$contents && $role === 'model') continue;
            $contents[] = ['role' => $role, 'parts' => [['text' => (string) $r['text']]]];
        }
    } catch (\Throwable $e) { $contents = []; }
    if (!$contents || end($contents)['role'] !== 'user') {
        $contents[] = ['role' => 'user', 'parts' => [['text' => $text]]];
    }

    $model = (string) (cfgv('gemini_model') ?: 'gemini-2.5-flash');
    $payload = json_encode([
        'systemInstruction' => ['parts' => [['text' => chat_system_prompt()]]],
        'contents'          => $contents,
        'generationConfig'  => ['maxOutputTokens' => 1000, 'temperature' => 0.4],
    ], JSON_UNESCAPED_UNICODE);

    $base = rtrim((string) (cfgv('gemini_base_url') ?: 'https://generativelanguage.googleapis.com'), '/');
    $ch = curl_init($base . '/v1beta/models/'
        . rawurlencode($model) . ':generateContent?key=' . rawurlencode($apiKey));
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => $payload,
        CURLOPT_HTTPHEADER     => ['Content-Type: application/json'],
        CURLOPT_TIMEOUT        => 12,
        CURLOPT_CONNECTTIMEOUT => 5,
    ]);
    $resp = curl_exec($ch);
    $err  = curl_errno($ch);
    $code = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    curl_close($ch);
    if ($err || !$resp || $code >= 400) return null;

    $d = json_decode((string) $resp, true);
    if (!is_array($d) || empty($d['candidates'][0]['content']['parts'])) return null;
    $out = '';
    foreach ($d['candidates'][0]['content']['parts'] as $p) {
        if (isset($p['text'])) $out .= (string) $p['text'];
    }
    $out = trim($out);
    return $out !== '' ? $out : null;
}

/** Вызов Claude API (api.anthropic.com /v1/messages). Тихий фолбэк на null при любой ошибке. */
function chat_claude_reply(string $apiKey, string $sessionKey, string $text): ?string {
    // Последние сообщения сессии -> messages для API (первым обязан идти user).
    $messages = [];
    try {
        $rows = all(
            "SELECT role, text FROM chat_messages WHERE session_key=? AND text<>'' ORDER BY id DESC LIMIT 12",
            [$sessionKey]
        );
        foreach (array_reverse($rows) as $r) {
            $role = ($r['role'] ?? '') === 'assistant' ? 'assistant' : 'user';
            if (!$messages && $role === 'assistant') continue;
            $messages[] = ['role' => $role, 'content' => (string) $r['text']];
        }
    } catch (\Throwable $e) { $messages = []; }
    if (!$messages || end($messages)['role'] !== 'user') {
        $messages[] = ['role' => 'user', 'content' => $text];
    }

    $payload = json_encode([
        'model'      => 'claude-haiku-4-5-20251001',
        'max_tokens' => 500,
        'system'     => chat_system_prompt(),
        'messages'   => $messages,
    ], JSON_UNESCAPED_UNICODE);

    $ch = curl_init('https://api.anthropic.com/v1/messages');
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => $payload,
        CURLOPT_HTTPHEADER     => [
            'Content-Type: application/json',
            'x-api-key: ' . $apiKey,
            'anthropic-version: 2023-06-01',
        ],
        CURLOPT_TIMEOUT        => 12,
        CURLOPT_CONNECTTIMEOUT => 5,
    ]);
    $resp = curl_exec($ch);
    $err  = curl_errno($ch);
    $code = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    curl_close($ch);
    if ($err || !$resp || $code >= 400) return null;

    $d = json_decode((string) $resp, true);
    if (!is_array($d) || ($d['type'] ?? '') === 'error') return null;
    if (($d['stop_reason'] ?? '') === 'refusal') return null;
    $out = '';
    foreach (($d['content'] ?? []) as $b) {
        if (($b['type'] ?? '') === 'text') $out .= (string) ($b['text'] ?? '');
    }
    $out = trim($out);
    return $out !== '' ? $out : null;
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

/** Rule-based ответы по ключевым словам (фолбэк без ключа Claude / при ошибке API). */
function chat_rule_reply(string $text): string {
    $t        = mb_strtolower($text);
    $orgEmail = cfgv('org_email');
    $has = static function (array $words) use ($t): bool {
        foreach ($words as $w) if (mb_strpos($t, $w) !== false) return true;
        return false;
    };
    $tail = "\n\nЕсли нужна помощь человека - Оргкомитет ответит на почту {$orgEmail}.";

    if ($has(['заявк', 'подать', 'участвова', 'регистрац', 'записат'])) {
        return 'Подать заявку просто: откройте страницу «Заявка» (' . url('/apply') . '), выберите конкурс, заполните форму и прикрепите ссылку на конкурсное видео (RuTube, ВК Видео, Яндекс или Google Диск, ОК Видео, Дзен). После отправки Вы получите номер заявки.' . $tail;
    }
    if ($has(['цена', 'стоим', 'сколько', 'оргвзнос', 'оплат', 'взнос', 'бесплат'])) {
        return 'Стоимость зависит от конкурса: есть бесплатные и с организационным взносом за заявку. Актуальные суммы указаны на карточке каждого конкурса в разделе «Афиша» (' . url('/competitions') . '). В оргвзнос входит приём и регистрация, аттестация номера компетентным жюри и электронный диплом на почту.' . $tail;
    }
    if ($has(['результат', 'итог', 'балл', 'оцен', 'когда придут'])) {
        return 'Результаты направляются каждому участнику на электронную почту из заявки, а также публикуются в разделе «Результаты» (' . url('/results') . '). Сроки указаны в положении конкретного конкурса.' . $tail;
    }
    if ($has(['наград', 'кубок', 'медал', 'статуэт', 'заказ'])) {
        return 'Наградной материал (кубки, статуэтки, медали, оригиналы дипломов) заказывается после оглашения результатов - добровольно, на странице «Награды» (' . url('/awards') . '). Например: кубок Гран-при - 1500 ₽, статуэтка лауреата - 1000 ₽, медаль дипломанта - 500 ₽. Доставка оригиналов - наложенным платежом.' . $tail;
    }
    if ($has(['диплом', 'провер', 'подлинност', 'сертификат'])) {
        return 'Электронные дипломы приходят на почту, указанную в заявке. Проверить подлинность диплома можно по его номеру на странице ' . url('/verify') . '.' . $tail;
    }
    if ($has(['контакт', 'телефон', 'почт', 'адрес', 'связат', 'режим', 'работает'])) {
        return 'Контакты Оргкомитета: почта ' . $orgEmail . ', телефон ' . cfgv('org_phone') . '. Режим работы: ' . cfgv('org_hours') . '. Адрес: ' . cfgv('org_address') . '.';
    }
    if ($has(['привет', 'здравств', 'добрый ден', 'добрый веч', 'доброе утр'])) {
        return 'Здравствуйте! Я помощник Культурного центра «Музыкальный Мир». Подскажу, как подать заявку, сколько стоит участие, где посмотреть результаты и как заказать награды. Спрашивайте!';
    }
    return 'Спасибо за обращение! Я передал Ваш вопрос специалистам - Оргкомитет ответит на почту ' . $orgEmail . ' в рабочее время (' . cfgv('org_hours') . '). А пока могу подсказать про заявки, стоимость участия, результаты и награды.';
}
