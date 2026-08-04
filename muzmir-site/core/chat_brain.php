<?php
/**
 * Общий «мозг» чат-помощника Культурного центра «Музыкальный Мир».
 * Единый источник ответов для: веб-чата сайта (api/v1/chat.php) и
 * авто-ответов в сообщениях сообщества ВКонтакте (api/v1/webhook_vk.php).
 *
 * Пайплайн ответа (chat_brain_reply): Gemini (бесплатные ключи) → Claude API →
 * внешний мозг-агент (agent_url, если задан) → rule-based фолбэк. История берётся
 * из таблицы chat_messages по session_key, поэтому и веб-диалоги, и диалоги ВК
 * (session_key = "vk_<peer_id>") хранятся единообразно и видны в админке.
 */
declare(strict_types=1);

/** Единая база знаний ассистента (systemInstruction / system). */
function chat_system_prompt(): string {
    $L   = [];
    $L[] = 'Ты - официальный оператор колл-центра Культурного центра «Музыкальный Мир»: международные и всероссийские онлайн-конкурсы и фестивали культуры и искусства (' . cfgv('org_reg') . ').';
    $L[] = 'Стиль — официально-деловой, тёплый, вежливый, обращение только на «Вы», по-русски, без выдумок. Аккуратно используй эмодзи в духе центра: ✅ 📫 ⏳ 🕑 🙏 🏆 🌍. Отвечай по сути (обычно 3-7 строк).';
    $L[] = 'НЕ здоровайся и НЕ подписывайся в каждом сообщении: приветствие («Здравствуйте, Имя») и подпись оргкомитета добавляет система сама по правилам диалога (приветствие — один раз в начале, подпись — только при завершении). Дай ТОЛЬКО суть ответа, без «Здравствуйте» и без «С уважением».';
    $L[] = 'Если вопрос про сроки, режим работы, доставку или контакты — добавляй блок: график работы ' . cfgv('org_hours') . '; сообщество ВКонтакте ' . cfgv('org_vk') . '; колл-центр ' . cfgv('org_phone') . ' (скрытые номера блокируются системой безопасности); почта ' . cfgv('org_email') . '.';
    // Формат ссылок зависит от канала: сайт — кнопками (без URL в тексте), ВК — прямыми ссылками.
    if (($GLOBALS['chat_channel'] ?? 'vk') === 'web') {
        $L[] = 'ВАЖНО: НЕ вставляй в текст ответа полные URL-адреса. Упоминай разделы словами (например «на странице «Заявка»», «в разделе «Награды»»). Кликабельные кнопки со ссылками система добавит автоматически под ответом.';
    } else {
        $L[] = 'Ссылки давай прямыми и красивыми, вида https://' . cfgv('domain', 'музыкальный-мир.рф') . '/apply — во ВКонтакте они кликабельны. Не используй punycode и не сокращай ссылки.';
    }

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
    $L[] = chat_official_kb();
    return implode("\n", $L);
}

/**
 * База официальных шаблонов колл-центра (стиль и типовые сценарии) со ссылками
 * на новый сайт. Не выдаёт их дословно, но следует форме и ссылкам.
 */
function chat_official_kb(): string {
    $site = 'https://' . cfgv('domain', 'музыкальный-мир.рф'); // красивый кириллический домен (кликабелен в ВК)
    $vk   = (string) cfgv('org_vk');
    $tel  = (string) cfgv('org_phone');
    $mail = (string) cfgv('org_email');
    $hrs  = (string) cfgv('org_hours');
    $K = [];
    $K[] = 'ОФИЦИАЛЬНЫЕ ССЫЛКИ (используй только их):';
    $K[] = '• Подать заявку на конкурс: ' . $site . '/apply';
    $K[] = '• Все конкурсы (афиша): ' . $site . '/competitions';
    $K[] = '• Положения конкурсов: ' . $site . '/competitions';
    $K[] = '• Заказать наградной материал (кубки, медали, оригиналы дипломов): ' . $site . '/awards';
    $K[] = '• Сроки и способы доставки наградного материала, справка: ' . $site . '/faq';
    $K[] = '• Проверка подлинности диплома по номеру: ' . $site . '/verify';
    $K[] = '• Оставить отзыв: ' . $site . '/reviews';
    $K[] = '• Результаты конкурсов: ' . $site . '/results';
    $K[] = '• Отслеживание посылки Почты России: https://www.pochta.ru/tracking';
    $K[] = '';
    $K[] = 'ТИПОВЫЕ СЦЕНАРИИ (следуй форме, ссылки только новые):';
    $K[] = '1) Заявка на участие принята: «✅ Ваша заявка на участие зарегистрирована и находится в обработке. 📫 Далее она будет направлена на аттестацию компетентного жюри (при соблюдении правил, указанных в положении конкурса). Сроки и порядок публикации результатов — в положении: ' . $site . '/competitions. ⏳ Ожидайте, пожалуйста. 🙏 Благодарим Вас за участие.»';
    $K[] = '2) Заказ наградного материала: «📫 Оформить заявку на изготовление наградного материала (согласно аттестационному результату) можно на сайте: ' . $site . '/awards. Сроки и способы доставки, а также справочная информация: ' . $site . '/faq. Доставка оригиналов — Почтой России, наложенным платежом.»';
    $K[] = '3) Заказ наград принят: «✅ Ваша заявка на изготовление наградного материала зарегистрирована и находится в обработке. 📫 Далее будет передана на изготовление. Сроки и способы доставки: ' . $site . '/faq. ⏳ Ожидайте, пожалуйста.»';
    $K[] = '4) Нужны данные: «Уточните, пожалуйста: название конкурса, ФИО конкурсанта, название конкурсного материала.»';
    $K[] = '5) Обращение в обработке: «Ваше обращение зарегистрировано и находится в обработке. Ответ будет дан в рамках данной переписки в ближайшее время. ⏳ Ожидайте, пожалуйста.»';
    $K[] = '6) Благодарность и отзыв: «🙏 Благодарим Вас за участие. Желаем творческих успехов, процветания и новых побед. Будем признательны за отзыв о работе центра: ' . $site . '/reviews.»';
    $K[] = '7) Диплом/награда готовы: «✮ Наградной материал (согласно аттестационному результату) готов. 🙏 Благодарим Вас за участие. Будем признательны за отзыв: ' . $site . '/reviews.»';
    $K[] = '8) Посылка отправлена: «✈️ Наградной материал отправлен службой «Почта России». 🏷 Трек-номер: <номер>. 📌 Отслеживание: https://www.pochta.ru/tracking. 💸 Оплата доставки — наложенным платежом при получении. Просим своевременно получить посылку.»';
    $K[] = '';
    $K[] = 'КОНТАКТЫ для подписи-блока: сообщество ВКонтакте ' . $vk . '; колл-центр ' . $tel . ' (скрытые номера блокируются системой безопасности); почта ' . $mail . '; график работы ' . $hrs . '.';
    $K[] = 'Никогда не давай ссылки на старый сайт вида /page/1465834, /oplata-sayt, /voprosi, /konkursi, /comment, /documents, /instrukciya — только новые ссылки выше.';
    return implode("\n", $K);
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

/** Rule-based ответы по ключевым словам (фолбэк без ключа Claude / при ошибке API). */
function chat_rule_reply(string $text): string {
    $t        = mb_strtolower($text);
    $orgEmail = cfgv('org_email');
    $has = static function (array $words) use ($t): bool {
        foreach ($words as $w) if (mb_strpos($t, $w) !== false) return true;
        return false;
    };
    $tail = "\n\nЕсли нужна помощь человека — Оргкомитет ответит на почту {$orgEmail}.";

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

/**
 * Единый оркестратор ответа: Gemini → Claude → внешний агент → rule-based.
 * @param string   $text       текст входящего сообщения
 * @param string   $sessionKey ключ диалога (веб-сессия или "vk_<peer_id>")
 * @param int|null $uid        id пользователя сайта, если известен
 */
function chat_brain_reply(string $text, string $sessionKey, ?int $uid = null, string $channel = 'vk'): string {
    $GLOBALS['chat_channel'] = $channel; // 'web' = ссылки кнопками, 'vk' = прямыми ссылками
    $reply = null;

    $geminiKey = (string) (cfgv('gemini_api_key') ?: '');
    if ($geminiKey !== '') {
        $reply = chat_gemini_reply($geminiKey, $sessionKey, $text);
    }
    $apiKey = (string) (cfgv('claude_api_key') ?: '');
    if (($reply === null || $reply === '') && $apiKey !== '') {
        $reply = chat_claude_reply($apiKey, $sessionKey, $text);
    }
    // Внешний мозг-агент, если настроен и выше никто не ответил.
    if (($reply === null || $reply === '') && function_exists('agent_chat_proxy') && ($agentUrl = cfgv('agent_url'))) {
        $reply = agent_chat_proxy((string) $agentUrl, (string) cfgv('agent_token'), $text, $sessionKey, $uid);
    }
    if ($reply === null || $reply === '') {
        $reply = chat_rule_reply($text);
    }
    return trim($reply);
}

/* ==================== Правила диалога: приветствие и подпись ==================== */

/** Подпись оргкомитета (ставится только при завершении диалога). */
function chat_signoff(): string {
    return '🌍 С уважением, оргкомитет культуры и искусства Культурного центра «Музыкальный Мир» 🌍';
}

/** Строка приветствия. С именем, если известно: «Здравствуйте, Имя.». */
function chat_greet_line(string $name = ''): string {
    $name = trim($name);
    return $name !== '' ? 'Здравствуйте, ' . $name . '.' : 'Здравствуйте!';
}

/**
 * Нужно ли здороваться в этом сообщении. Здороваемся один раз в начале диалога
 * и снова после перерыва 24 часа или после завершения предыдущего диалога.
 * Считаем: есть ли наш ответ в этой сессии за последние 24 часа и после
 * последнего маркера завершения диалога. Нет — значит это начало нового диалога.
 */
function chat_should_greet(string $sessionKey): bool {
    try {
        $lastEndId = (int) (scalar("SELECT MAX(id) FROM chat_messages WHERE session_key=? AND role='dialog_end'", [$sessionKey]) ?: 0);
        $recent = (int) scalar(
            "SELECT COUNT(*) FROM chat_messages WHERE session_key=? AND role IN ('assistant','assistant_followup') AND id>? AND created_at > datetime('now','-1 day')",
            [$sessionKey, $lastEndId]
        );
        return $recent === 0;
    } catch (\Throwable $e) {
        return true;
    }
}

/** Пользователь завершает диалог: «спасибо», «пока», «всё понятно» и т.п. */
function chat_is_closing(string $text): bool {
    $t = ' ' . mb_strtolower(trim($text)) . ' ';
    foreach (['спасибо', 'спс', 'благодар', ' пока ', 'до свидан', 'всего доброго', 'хорошего дня',
              'всё понятно', 'все понятно', 'всё ясно', 'все ясно', 'вопросов нет', 'больше вопросов',
              'помогли', 'разобрал'] as $w) {
        if (mb_strpos($t, $w) !== false) return true;
    }
    return false;
}

/**
 * Финальное сообщение при завершении диалога: «Благодарим за обращение…» + подпись.
 * Ссылки в тексте прямые (для ВК); на сайте chat_web_format превратит их в кнопки.
 */
function chat_closing_message(string $name = ''): string {
    $vk  = (string) cfgv('org_vk');
    $tel = (string) cfgv('org_phone');
    $hrs = (string) cfgv('org_hours');
    $L = [];
    $L[] = '🙏 Благодарим Вас за обращение. Рады были Вам помочь.';
    $L[] = 'В случае возникновения дополнительных вопросов Вы можете обратиться в чат нашего официального сообщества ВКонтакте ' . $vk . ' или по телефону колл-центра ' . $tel . ' (скрытые номера блокируются системой безопасности).';
    $L[] = '🕑 График работы: ' . $hrs . '.';
    $L[] = '';
    $L[] = chat_signoff();
    return implode("\n", $L);
}

/** Пометить диалог завершённым (следующее сообщение начнёт новый диалог с приветствием). */
function chat_mark_dialog_end(string $sessionKey): void {
    try {
        insert('chat_messages', ['user_id' => null, 'session_key' => $sessionKey, 'role' => 'dialog_end', 'text' => '', 'file' => '']);
    } catch (\Throwable $e) {}
}

/**
 * Собрать финальный ответ по правилам диалога: приветствие в начале, суть,
 * подпись — только при завершении. $core — суть ответа от «мозга».
 */
function chat_wrap_reply(string $sessionKey, string $core, string $name, bool $greet, bool $closing): string {
    $parts = [];
    if ($greet)   $parts[] = chat_greet_line($name);
    if ($core !== '') $parts[] = trim($core);
    if ($closing) $parts[] = "\n" . chat_signoff();
    return trim(implode("\n\n", $parts));
}

/**
 * Форматирование ответа для ВЕБ-ЧАТА сайта: голые ссылки из текста превращаются
 * в красивые кнопки (same-origin, открываются в приложении), а из текста ссылки
 * убираются. В ВК это НЕ применяется — там ссылки остаются прямыми и кликабельными.
 * @return array{text:string,actions:array}
 */
function chat_web_format(string $reply, array $actions): array {
    $labels = [
        '/apply'        => 'Подать заявку',
        '/competitions' => 'Конкурсы и положения',
        '/documents'    => 'Положения конкурсов',
        '/awards'       => 'Заказать награды',
        '/faq'          => 'Справка и сроки',
        '/verify'       => 'Проверить диплом',
        '/reviews'      => 'Оставить отзыв',
        '/results'      => 'Результаты конкурсов',
        '/club'         => 'Клуб участников',
        '/contacts'     => 'Контакты',
    ];
    // Уже занятые пути (чтобы не плодить дубликаты кнопок).
    $seen = [];
    foreach ($actions as $a) {
        if (!empty($a['url'])) { $p = rtrim((string) parse_url($a['url'], PHP_URL_PATH), '/'); if ($p !== '') $seen[$p] = 1; }
    }
    if (preg_match_all('~https?://[^\s<>"\')]+~u', $reply, $mm)) {
        foreach (array_unique($mm[0]) as $u) {
            $u   = rtrim($u, ".,;:!?)]»”\"'");   // отрезаем хвостовую пунктуацию предложения
            $host = (string) parse_url($u, PHP_URL_HOST);
            $path = rtrim((string) parse_url($u, PHP_URL_PATH), '/');
            $isLocal = $host !== '' && (mb_stripos($host, 'музыкальный-мир') !== false || stripos($host, 'xn--') !== false);
            if ($isLocal) {
                if ($path === '' || isset($seen[$path])) continue;
                $actions[] = ['type' => 'link', 'label' => $labels[$path] ?? 'Открыть раздел', 'url' => url($path)];
                $seen[$path] = 1;
            } else {
                $actions[] = ['type' => 'link', 'label' => (stripos($u, 'pochta') !== false ? 'Отследить посылку' : 'Открыть ссылку'), 'url' => $u];
            }
        }
    }
    // Убираем ссылки и «мусорные» вводные из текста.
    $t = preg_replace('~https?://[^\s<>"\')]+~u', '', $reply);
    $t = preg_replace('~(?:,?\s*)?(?:по\s+)?(?:данной\s+|этой\s+|следующей\s+)?ссылке\s*[:：]?~ui', '', (string) $t);
    $t = preg_replace('~\(\s*\)~u', '', (string) $t);            // пустые скобки от «(ссылка)»
    $t = preg_replace('~[«"“]\s*[»"”]~u', '', (string) $t);      // пустые кавычки
    $t = preg_replace('~[ \t]*[:：]\s*(?=[.\n)]|$)~u', '', (string) $t); // висячее двоеточие
    $t = preg_replace('~[ \t]{2,}~u', ' ', (string) $t);
    $t = preg_replace('~[ \t]+\n~u', "\n", (string) $t);
    $t = preg_replace('~\n{3,}~u', "\n\n", (string) $t);
    return ['text' => trim((string) $t), 'actions' => $actions];
}

