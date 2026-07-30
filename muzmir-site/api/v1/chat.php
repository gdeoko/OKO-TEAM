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

try {
    insert('chat_messages', ['user_id' => $uid, 'session_key' => $sessionKey, 'role' => 'user', 'text' => $text, 'file' => '']);
} catch (\Throwable $e) {}

$reply  = null;
$apiKey = (string) (cfgv('claude_api_key') ?: '');
if ($apiKey !== '') {
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

json_out(['ok' => true, 'reply' => $reply, 'session' => $sessionKey]);

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
        return 'Конкурс «Слава России» - бесплатный. Конкурсы «Эврика» и «Симфония Звёзд» - оргвзнос 500 ₽ за одну заявку: приём и регистрация, аттестация номера компетентным жюри и электронный диплом на почту.' . $tail;
    }
    if ($has(['результат', 'итог', 'балл', 'оцен', 'когда придут'])) {
        return 'Результаты «Эврики» направляются каждому участнику на электронную почту из заявки в течение 5 рабочих дней после аттестации. Итоги конкурсов также публикуются в разделе «Результаты» (' . url('/results') . ').' . $tail;
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
        return 'Здравствуйте! Я помощник КЦ «Музыкальный Мир». Подскажу, как подать заявку, сколько стоит участие, где посмотреть результаты и как заказать награды. Спрашивайте!';
    }
    return 'Спасибо за обращение! Я передал Ваш вопрос специалистам - Оргкомитет ответит на почту ' . $orgEmail . ' в рабочее время (' . cfgv('org_hours') . '). А пока могу подсказать про заявки, стоимость участия, результаты и награды.';
}
