<?php
/**
 * Мультимодальное понимание вложений чат-бота (сайт + ВК) через Gemini.
 *
 *   • голосовое/аудио  → дословная расшифровка речи (текст вопроса участника);
 *   • видео            → расшифровка речи + краткое описание;
 *   • фото/скрин       → распознавание типа (диплом / скрин оплаты / заявка / документ)
 *                        и извлечение читаемого текста (ФИО, город, номер заявки/диплома, конкурс, сумма).
 *
 * Возвращает строку-«понимание» ('' при недоступности) — её вызывающий код подаёт в
 * chat_brain_reply как контекст/вопрос участника. Всё бесплатно (Gemini Flash), без трат кредитов.
 * Тихий фолбэк на '' при любой ошибке — бот тогда просто подтверждает получение вложения.
 */
declare(strict_types=1);

/** MIME по расширению для inline_data Gemini. */
function chat_media_mime(string $ext): string {
    $ext = strtolower(ltrim($ext, '.'));
    return [
        'jpg' => 'image/jpeg', 'jpeg' => 'image/jpeg', 'png' => 'image/png', 'gif' => 'image/gif',
        'webp' => 'image/webp', 'heic' => 'image/heic', 'heif' => 'image/heif',
        'mp4' => 'video/mp4', 'mov' => 'video/quicktime', 'webm' => 'video/webm', 'm4v' => 'video/mp4', '3gp' => 'video/3gpp',
        'ogg' => 'audio/ogg', 'oga' => 'audio/ogg', 'opus' => 'audio/ogg', 'mp3' => 'audio/mpeg',
        'm4a' => 'audio/mp4', 'aac' => 'audio/aac', 'wav' => 'audio/wav', 'amr' => 'audio/amr', 'weba' => 'audio/webm',
    ][$ext] ?? '';
}

/** Классификация вложения по расширению/типу: 'image' | 'audio' | 'video' | ''. */
function chat_media_kind(string $ext): string {
    $ext = strtolower(ltrim($ext, '.'));
    if (in_array($ext, ['jpg', 'jpeg', 'png', 'gif', 'webp', 'heic', 'heif'], true)) return 'image';
    if (in_array($ext, ['ogg', 'oga', 'opus', 'mp3', 'm4a', 'aac', 'wav', 'amr', 'weba'], true)) return 'audio';
    if (in_array($ext, ['mp4', 'mov', 'webm', 'm4v', '3gp'], true)) return 'video';
    return '';
}

/** Задача для Gemini по типу вложения. */
function chat_media_prompt(string $kind): string {
    switch ($kind) {
        case 'audio':
            return 'Это голосовое сообщение участника конкурса культуры и искусства Культурного центра '
                . '«Музыкальный Мир». Расшифруй речь ДОСЛОВНО на русском языке. Верни ТОЛЬКО текст сказанного, '
                . 'без пояснений и кавычек. Если речи нет — верни пустую строку.';
        case 'video':
            return 'Это видео от участника конкурса культуры и искусства. 1) Расшифруй речь дословно (если есть). '
                . '2) Кратко (1–2 предложения) опиши, что на видео. Ответь на русском в формате: '
                . 'Речь: <текст или «нет»>. Описание: <кратко>.';
        case 'image':
        default:
            return 'Это изображение, присланное участником конкурса культуры и искусства в чат поддержки. '
                . 'Определи, что это: диплом, скриншот оплаты, скриншот/данные заявки, документ, фото выступления или иное. '
                . 'Извлеки ВЕСЬ читаемый текст: ФИО участника, город, номер заявки или диплома, название конкурса, сумму оплаты, дату. '
                . 'Ответь кратко на русском в формате: Тип: <что это>. Данные: <извлечённые ключевые поля через запятую>. '
                . 'Если текста нет — опиши изображение одним предложением.';
    }
}

/**
 * Понимание локального файла-вложения.
 * @param string $absPath абсолютный путь к файлу
 * @param string $kind    'image'|'audio'|'video' (если '' — определим по расширению)
 */
function chat_media_understand(string $absPath, string $kind = '', string $mime = ''): string {
    if (!is_file($absPath)) return '';
    $key = (string) (function_exists('cfgv') ? (cfgv('gemini_api_key') ?: '') : '');
    if ($key === '') return '';

    $ext  = strtolower(pathinfo($absPath, PATHINFO_EXTENSION));
    if ($kind === '') $kind = chat_media_kind($ext);
    if ($kind === '') return '';
    if ($mime === '') $mime = chat_media_mime($ext);
    if ($mime === '' && function_exists('mime_content_type')) $mime = (string) @mime_content_type($absPath);
    if ($mime === '') return '';

    // Лимит inline-запроса Gemini ~20 МБ вместе с base64. Держим сырьё до 7 МБ (×1.33 ≈ 9.3 МБ).
    $size = (int) @filesize($absPath);
    if ($size <= 0 || $size > 7 * 1024 * 1024) return '';

    $raw = @file_get_contents($absPath);
    if ($raw === false || $raw === '') return '';

    return chat_media_gemini_inline($key, $mime, base64_encode($raw), chat_media_prompt($kind));
}

/**
 * Понимание удалённого вложения по URL (ВК: фото/аудио/видео на серверах ВК).
 * Скачиваем во временный файл (с лимитом), затем chat_media_understand().
 */
function chat_media_understand_url(string $url, string $kind): string {
    $url = trim($url);
    if ($url === '' || !preg_match('~^https?://~i', $url)) return '';
    $key = (string) (function_exists('cfgv') ? (cfgv('gemini_api_key') ?: '') : '');
    if ($key === '') return '';

    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_TIMEOUT        => 15,
        CURLOPT_CONNECTTIMEOUT => 6,
        CURLOPT_MAXREDIRS      => 4,
        CURLOPT_BUFFERSIZE     => 65536,
        // Жёсткий предел скачивания ~7 МБ.
        CURLOPT_NOPROGRESS     => false,
        CURLOPT_PROGRESSFUNCTION => function ($ch, $dltotal, $dlnow) { return ($dlnow > 7 * 1024 * 1024) ? 1 : 0; },
    ]);
    $data = curl_exec($ch);
    $ct   = (string) curl_getinfo($ch, CURLINFO_CONTENT_TYPE);
    $code = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    curl_close($ch);
    if (!$data || $code >= 400 || strlen($data) > 7 * 1024 * 1024) return '';

    $mime = trim(explode(';', $ct)[0]);
    if ($mime === '' || !preg_match('~^(image|audio|video)/~', $mime)) {
        // Подберём MIME по типу вложения ВК.
        $mime = $kind === 'audio' ? 'audio/ogg' : ($kind === 'video' ? 'video/mp4' : 'image/jpeg');
    }
    return chat_media_gemini_inline($key, $mime, base64_encode($data), chat_media_prompt($kind));
}

/**
 * Низкоуровневый вызов Gemini generateContent с inline_data (base64) + текстовой задачей.
 * thinkingBudget=0 — чтобы «мышление» не съело бюджет ответа (иначе расшифровка обрезается).
 */
function chat_media_gemini_inline(string $apiKey, string $mime, string $b64, string $prompt): string {
    $model = (string) (function_exists('cfgv') ? (cfgv('gemini_vision_model') ?: cfgv('gemini_model') ?: 'gemini-2.5-flash') : 'gemini-2.5-flash');
    $base  = rtrim((string) (function_exists('cfgv') ? (cfgv('gemini_base_url') ?: 'https://generativelanguage.googleapis.com') : 'https://generativelanguage.googleapis.com'), '/');
    $payload = json_encode([
        'contents' => [[
            'role'  => 'user',
            'parts' => [
                ['inline_data' => ['mime_type' => $mime, 'data' => $b64]],
                ['text' => $prompt],
            ],
        ]],
        'generationConfig' => [
            'maxOutputTokens' => 1200,
            'temperature'     => 0.2,
            'thinkingConfig'  => ['thinkingBudget' => 0],
        ],
    ], JSON_UNESCAPED_UNICODE);

    $ch = curl_init($base . '/v1beta/models/' . rawurlencode($model) . ':generateContent?key=' . rawurlencode($apiKey));
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => $payload,
        CURLOPT_HTTPHEADER     => ['Content-Type: application/json'],
        CURLOPT_TIMEOUT        => 30,
        CURLOPT_CONNECTTIMEOUT => 6,
    ]);
    $resp = curl_exec($ch);
    $err  = curl_errno($ch);
    $code = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    curl_close($ch);
    if ($err || !$resp || $code >= 400) return '';

    $d = json_decode((string) $resp, true);
    if (!is_array($d) || empty($d['candidates'][0]['content']['parts'])) return '';
    $out = '';
    foreach ($d['candidates'][0]['content']['parts'] as $p) {
        if (isset($p['text'])) $out .= (string) $p['text'];
    }
    $out = trim($out);
    if ($out === '') return '';
    if (mb_strlen($out) > 1500) $out = mb_substr($out, 0, 1500);
    return $out;
}

/**
 * Готовит «синтетический» вопрос участника из понимания вложения — чтобы подать его в chat_brain_reply.
 * Для голоса — это дословный вопрос; для фото/видео — префикс с распознанными данными.
 */
function chat_media_as_user_text(string $kind, string $understanding): string {
    $understanding = trim($understanding);
    if ($understanding === '') return '';
    if ($kind === 'audio') return $understanding;                       // расшифровка = вопрос
    if ($kind === 'video') return '[Видео от участника] ' . $understanding;
    return '[Фото/скриншот от участника] ' . $understanding;            // распознанные данные как контекст
}
