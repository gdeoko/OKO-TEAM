<?php
/**
 * core/review_reply.php — авто-ответ Оргкомитета на отзыв участника.
 *
 * Ответ НЕ шаблонный: генерируется по смыслу конкретного отзыва (Gemini → Claude),
 * каждый раз разный, тёплый и по существу — благодарим за оценку, отмечаем то, о чём
 * написал участник, желаем успехов. Подпись всегда: «С уважением, Оргкомитет
 * Культурного центра «Музыкальный Мир»». Если ИИ недоступен — аккуратный
 * рандомизированный фолбэк (тоже разный, с учётом оценки/тональности).
 *
 * Файл только определяет функции; ничего не выполняет при require.
 */
declare(strict_types=1);

/** Подпись Оргкомитета под ответом на отзыв. */
function review_signoff(): string {
    return 'С уважением, Оргкомитет Культурного центра «Музыкальный Мир».';
}

/** Системная инструкция для генерации ответа на отзыв. */
function review_prompt(int $rating): string {
    $L = [];
    $L[] = 'Ты — представитель Оргкомитета Культурного центра «Музыкальный Мир» (международные и всероссийские онлайн-конкурсы культуры и искусства). Твоя задача — написать короткий тёплый ответ ОТ ОРГКОМИТЕТА на отзыв участника.';
    $L[] = 'ГЛАВНОЕ: ответ должен быть осмысленным и опираться на СОДЕРЖАНИЕ отзыва — если человек похвалил жюри, поблагодари за оценку работы жюри; если написал про дипломы/награды — отметь это; если про организацию — про организацию. Каждый ответ уникален, без шаблонных штампов, живой человеческий язык.';
    $L[] = 'Тон: искренняя благодарность, уважение, тепло. На «Вы». 2–4 коротких предложения. Обязательно поблагодари за участие в конкурсах центра и за оценку работы центра, пожелай творческих успехов и новых побед. Уместны 1–2 аккуратных эмодзи (🙏 🌟 🎶 🏆 🌍) — не больше.';
    if ($rating <= 3) {
        $L[] = 'Отзыв сдержанный или с замечанием — будь особенно тактична: поблагодари за обратную связь, вырази готовность стать лучше, без оправданий и без спора.';
    }
    $L[] = 'НЕ повторяй дословно текст отзыва. НЕ представляйся по имени. НЕ добавляй подпись/«С уважением» в конце — подпись добавит система сама. Верни ТОЛЬКО текст ответа, без кавычек и пояснений.';
    return implode("\n", $L);
}

/** Одноразовый вызов Gemini для ответа на отзыв. null при любой ошибке. */
function review_gemini(string $apiKey, string $sys, string $userMsg): ?string {
    $model = (string) (cfgv('gemini_model') ?: 'gemini-2.5-flash');
    $payload = json_encode([
        'systemInstruction' => ['parts' => [['text' => $sys]]],
        'contents'          => [['role' => 'user', 'parts' => [['text' => $userMsg]]]],
        // Больше бюджета + отключаем «размышления» 2.5-flash (иначе ответ обрезается).
        'generationConfig'  => ['maxOutputTokens' => 900, 'temperature' => 0.85, 'thinkingConfig' => ['thinkingBudget' => 0]],
    ], JSON_UNESCAPED_UNICODE);
    $base = rtrim((string) (cfgv('gemini_base_url') ?: 'https://generativelanguage.googleapis.com'), '/');
    $ch = curl_init($base . '/v1beta/models/' . rawurlencode($model) . ':generateContent?key=' . rawurlencode($apiKey));
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true, CURLOPT_POST => true, CURLOPT_POSTFIELDS => $payload,
        CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
        CURLOPT_TIMEOUT => 12, CURLOPT_CONNECTTIMEOUT => 5,
    ]);
    $resp = curl_exec($ch); $err = curl_errno($ch); $code = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    curl_close($ch);
    if ($err || !$resp || $code >= 400) return null;
    $d = json_decode((string) $resp, true);
    if (!is_array($d) || empty($d['candidates'][0]['content']['parts'])) return null;
    $out = '';
    foreach ($d['candidates'][0]['content']['parts'] as $p) if (isset($p['text'])) $out .= (string) $p['text'];
    $out = trim($out);
    return $out !== '' ? $out : null;
}

/** Одноразовый вызов Claude для ответа на отзыв. null при любой ошибке. */
function review_claude(string $apiKey, string $sys, string $userMsg): ?string {
    $payload = json_encode([
        'model'      => 'claude-haiku-4-5-20251001',
        'max_tokens' => 400,
        'system'     => $sys,
        'messages'   => [['role' => 'user', 'content' => $userMsg]],
    ], JSON_UNESCAPED_UNICODE);
    $ch = curl_init('https://api.anthropic.com/v1/messages');
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true, CURLOPT_POST => true, CURLOPT_POSTFIELDS => $payload,
        CURLOPT_HTTPHEADER => ['Content-Type: application/json', 'x-api-key: ' . $apiKey, 'anthropic-version: 2023-06-01'],
        CURLOPT_TIMEOUT => 12, CURLOPT_CONNECTTIMEOUT => 5,
    ]);
    $resp = curl_exec($ch); $err = curl_errno($ch); $code = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    curl_close($ch);
    if ($err || !$resp || $code >= 400) return null;
    $d = json_decode((string) $resp, true);
    if (!is_array($d) || ($d['type'] ?? '') === 'error') return null;
    $out = '';
    foreach (($d['content'] ?? []) as $b) if (($b['type'] ?? '') === 'text') $out .= (string) ($b['text'] ?? '');
    $out = trim($out);
    return $out !== '' ? $out : null;
}

/**
 * Разнообразный фолбэк-ответ (без ИИ). Подбирает вступление по смыслу отзыва
 * (жюри/дипломы/организация/сроки) и варьирует формулировки — не один шаблон на всех.
 */
function review_fallback(string $text, string $author, int $rating): string {
    $t = mb_strtolower($text);
    $name = trim($author);
    $hi = $name !== '' ? ($name . ', благодарим Вас') : 'Благодарим Вас';
    $has = static function (array $w) use ($t): bool { foreach ($w as $x) if (mb_strpos($t, $x) !== false) return true; return false; };

    // Тематическое ядро — под содержание отзыва.
    if ($has(['жюри', 'оцен', 'балл', 'судь', 'компетент'])) {
        $core = 'за высокую оценку работы нашего жюри и центра. Нам очень важно, что профессионализм и объективность аттестации находят отклик у участников.';
    } elseif ($has(['диплом', 'наград', 'кубок', 'медал', 'грамот', 'благодарн'])) {
        $core = 'за тёплые слова о наградных материалах. Мы стараемся, чтобы каждый диплом достойно отмечал труд и талант участника.';
    } elseif ($has(['организ', 'быстр', 'удобн', 'сайт', 'поддержк', 'вежлив', 'оператор'])) {
        $core = 'за добрые слова об организации конкурсов. Мы делаем всё, чтобы участие было комфортным и понятным на каждом этапе.';
    } elseif ($has(['ребен', 'ребён', 'дет', 'ученик', 'воспитанник', 'педагог', 'преподав'])) {
        $core = 'за доверие и участие Ваших воспитанников. Для нас честь быть причастными к их творческому росту и достижениям.';
    } else {
        $core = 'за Ваш отзыв и участие в конкурсах Культурного центра «Музыкальный Мир». Нам искренне приятно быть полезными в Вашем творческом пути.';
    }

    $wishes = [
        'Желаем Вам вдохновения, новых ярких выступлений и заслуженных побед! 🌟',
        'От всей души желаем творческих успехов, процветания и новых побед! 🎶',
        'Пусть впереди Вас ждут только новые вершины и яркие победы! 🏆',
        'Желаем Вам крепкого вдохновения и больших творческих достижений! 🌍',
    ];
    // Детерминированно-разный выбор пожелания (по хэшу текста) — без Date/rand.
    $wi = (crc32($text) % count($wishes) + count($wishes)) % count($wishes);

    $lead = $rating <= 3
        ? ($hi . ' за честный отзыв и обратную связь ')
        : ($hi . ' ');
    if ($rating <= 3) {
        $core = 'о работе центра. Мы обязательно учтём Ваши замечания — нам важно становиться лучше для каждого участника.';
    }
    return trim($lead . $core) . ' ' . $wishes[$wi];
}

/**
 * Сформировать осмысленный ответ Оргкомитета на отзыв. Всегда с подписью.
 * @return string готовый текст ответа (с подписью на новой строке)
 */
function review_org_reply(string $text, string $author = '', int $rating = 5): string {
    $text   = trim($text);
    $rating = max(1, min(5, $rating));
    $sys    = review_prompt($rating);
    $userMsg = 'Отзыв участника' . ($author !== '' ? ' (' . $author . ')' : '')
             . ', оценка ' . $rating . '/5:' . "\n«" . $text . '»' . "\n\nНапиши ответ Оргкомитета по смыслу этого отзыва.";

    $body = null;
    $gKey = (string) (cfgv('gemini_api_key') ?: '');
    if ($gKey !== '') $body = review_gemini($gKey, $sys, $userMsg);
    if ($body === null || $body === '') {
        $cKey = (string) (cfgv('claude_api_key') ?: '');
        if ($cKey !== '') $body = review_claude($cKey, $sys, $userMsg);
    }
    if ($body === null || $body === '') $body = review_fallback($text, $author, $rating);

    // Чистим случайную подпись/кавычки от модели, добавляем свою.
    $body = trim($body);
    $body = preg_replace('~\s*(С уважением[^\n]*|Оргкомитет[^\n]*)$~u', '', $body) ?: $body;
    $body = trim(trim($body), "«»\"' \n\r\t");
    return $body . "\n\n" . review_signoff();
}
