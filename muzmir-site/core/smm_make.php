<?php
/**
 * core/smm_make.php — производство поста: тема, текст, картинка, публикация.
 *
 * Разделение с core/smm.php простое: там правила и состояние (что считается
 * повтором, когда можно публиковать, сколько разрешено потратить), здесь —
 * разговор с внешними службами (Gemini, apimodels, Hooppy). Так правила центра
 * читаются отдельно от того, у какой службы сегодня какой адрес.
 */
declare(strict_types=1);

require_once __DIR__ . '/smm.php';
if (is_file(__DIR__ . '/chat_brain.php')) require_once __DIR__ . '/chat_brain.php';

/* ------------------------------------------------------------------ *
 *  Gemini: один короткий вызов, без истории
 * ------------------------------------------------------------------ */

/**
 * Спросить модель и получить JSON. Ключи и очередь моделей берём те же, что у
 * чат-бота: у пары ключей «Музыкального Мира» своя квота, и смешивать её с парой
 * ОКО нельзя — квота одного проекта не должна съедать другой.
 */
function smm_ask_json(string $prompt, int $timeout = 90): ?array {
    $keys = function_exists('chat_gemini_keys') ? chat_gemini_keys() : [];
    if (!$keys) {
        $raw = trim((string) (cfgv('gemini_api_keys') ?: cfgv('gemini_api_key') ?: ''));
        $keys = $raw !== '' ? preg_split('~[,\s]+~', $raw) ?: [] : [];
    }
    if (!$keys) return null;

    $models = array_values(array_filter(array_map('trim',
        preg_split('~[,\s]+~', (string) (cfgv('gemini_models') ?: '')) ?: [])));
    if (!$models) $models = ['gemini-2.5-flash', 'gemini-3-flash-preview', 'gemini-flash-lite-latest'];

    $base = rtrim((string) (cfgv('gemini_base_url') ?: 'https://generativelanguage.googleapis.com'), '/');

    foreach ($keys as $key) {
        foreach ($models as $model) {
            $url = "{$base}/v1beta/models/{$model}:generateContent?key=" . urlencode($key);
            $body = json_encode([
                'contents' => [['role' => 'user', 'parts' => [['text' => $prompt]]]],
                'generationConfig' => [
                    'temperature'      => 1.0,   // темы обязаны быть разными — низкая температура даёт одно и то же
                    'maxOutputTokens'  => 4096,
                    'responseMimeType' => 'application/json',
                ],
            ], JSON_UNESCAPED_UNICODE);

            $ch = curl_init($url);
            curl_setopt_array($ch, [
                CURLOPT_POST => true,
                CURLOPT_POSTFIELDS => $body,
                CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_TIMEOUT => $timeout,
            ]);
            $res  = curl_exec($ch);
            $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
            curl_close($ch);

            if ($code === 429 || $code === 503) continue;          // квота или перегрузка — следующая модель
            if ($code !== 200 || !is_string($res)) continue;

            $j = json_decode($res, true);
            $txt = $j['candidates'][0]['content']['parts'][0]['text'] ?? '';
            if (!is_string($txt) || $txt === '') continue;

            $out = json_decode($txt, true);
            if (is_array($out)) return $out;
        }
    }
    return null;
}

/* ------------------------------------------------------------------ *
 *  Тема
 * ------------------------------------------------------------------ */

/**
 * Придумать тему, которой ещё не было. Модель получает живой срез центра и полный
 * список уже вышедших тем как прямой запрет, а дальше её предложение всё равно
 * проверяется нашим антиповтором: модель охотно выдаёт перефразировку вчерашнего,
 * если список длинный, и верить ей на слово нельзя.
 *
 * Попыток несколько: отказ по повтору — обычный ход событий, а не сбой.
 */
function smm_make_topic(string $layer, int $stage, int $tries = 6): ?array {
    $ctx  = smm_context();
    $used = smm_used_topics();

    $comps = [];
    foreach ($ctx['competitions'] as $c) {
        $comps[] = sprintf(
            '%s (%s, %s, приём до %s%s)',
            $c['name'],
            $c['type'] === 'international' ? 'международный' : 'всероссийский',
            (int) $c['is_paid'] ? ('оргвзнос ' . (int) $c['price'] . ' ₽') : 'бесплатный',
            (string) $c['end_date'],
            trim((string) ($c['results_date'] ?? '')) !== '' ? (', итоги ' . $c['results_date']) : ''
        );
    }

    $stageNames = [
        1 => 'первое знакомство с центром',
        2 => 'доверие и экспертность',
        3 => 'польза без продажи',
        4 => 'снятие возражений и страхов',
        5 => 'разбор того, как всё устроено',
        6 => 'выгода для педагога или учреждения',
        7 => 'прямое приглашение подать заявку',
    ];

    for ($i = 0; $i < $tries; $i++) {
        $prompt = "Ты редактор соцсетей Культурного центра «Музыкальный Мир» — онлайн-конкурсы "
            . "для детей и взрослых по восьми направлениям: вокал, хореография, инструментальное "
            . "исполнительство, художественное слово, театр, изобразительное искусство, "
            . "декоративно-прикладное творчество, цирковое искусство.\n\n"
            . "Придумай ОДНУ тему поста.\n\n"
            . "Адресат: " . $layer . ".\n"
            . "Задача поста: " . ($stageNames[$stage] ?? 'польза') . ".\n\n"
            . "Сейчас открыт приём:\n- " . implode("\n- ", $comps ?: ['конкурсы месяца']) . "\n\n"
            . ($ctx['nominations'] ? "Чаще всего заявляют номинации: " . implode(', ', array_slice($ctx['nominations'], 0, 10)) . ".\n\n" : '')
            . ($ctx['questions'] ? "О чём недавно спрашивали участники:\n- " . implode("\n- ", array_slice($ctx['questions'], 0, 15)) . "\n\n" : '')
            . "ЗАПРЕЩЕНО повторять эти темы, они уже выходили:\n- " . implode("\n- ", $used) . "\n\n"
            . "Требования к теме:\n"
            . "1. Тема узкая и конкретная, не «о пользе музыки», а один ясный сюжет.\n"
            . "2. В основе — проверяемый факт одного из трёх видов: широко известное "
            . "исследование, которое ты точно знаешь; исторический случай с именем и годом; "
            . "или устройство профессии, жанра, инструмента.\n"
            . "ВЫДУМЫВАТЬ ИССЛЕДОВАНИЯ, ФАМИЛИИ, УНИВЕРСИТЕТЫ, ГОДЫ И ПРОЦЕНТЫ ЗАПРЕЩЕНО. "
            . "Не приписывай настоящего учёного чужому университету и не дорисовывай цифру, "
            . "которой не знаешь наверняка. Если точного процента нет — обходись без него: "
            . "честное «заметно точнее» лучше выдуманных «на 30 %». Сомневаешься в "
            . "исследовании — бери устройство профессии, там вымысел невозможен.\n"
            . "3. Источник не должен повторять уже использованные.\n"
            . "4. Тема полезна адресату сама по себе, даже если он никогда не подаст заявку.\n\n"
            . "Верни строго JSON: {\"topic\":\"тема одной строкой\",\"fact\":\"факт в одном "
            . "предложении\",\"source\":\"источник факта: университет, учёный, год\","
            . "\"angle\":\"под каким углом подаём\",\"title\":\"ЗАГОЛОВОК НА КАРТИНКУ ЗАГЛАВНЫМИ, "
            . "2-4 слова\",\"subtitle\":\"подзаголовок на картинку, до 60 знаков\"}";

        $r = smm_ask_json($prompt);
        if (!$r || empty($r['topic'])) continue;

        [$fresh, $why] = smm_topic_is_fresh(
            (string) $r['topic'], (string) ($r['fact'] ?? ''), (string) ($r['source'] ?? '')
        );
        if (!$fresh) { $r['_rejected'] = $why; continue; }

        [$factOk, $factWhy] = smm_fact_check((string) ($r['fact'] ?? ''), (string) ($r['source'] ?? ''));

        /* СОМНИТЕЛЬНЫЙ ФАКТ ЧИНИМ, А НЕ ВЫБРАСЫВАЕМ ВМЕСТЕ С ТЕМОЙ.
         *
         * Модель тянется к цифре: «по данным арт-платформ, награды повышают
         * доверие на 40 %». Тема при этом бывает хорошая, негодна только
         * приписка. Выбрасывать всё целиком — значит часами не находить ни одной
         * темы и оставить ленту пустой, чего и просили не допустить. Поэтому
         * факт переписывается без недостоверной части и проверяется заново;
         * если после чистки от него ничего не остаётся — вот тогда тема уходит. */
        if (!$factOk) {
            $fixed = smm_fact_repair((string) ($r['fact'] ?? ''), (string) ($r['source'] ?? ''), $factWhy);
            if ($fixed === null) { $r['_rejected'] = 'факт не подтверждён: ' . $factWhy; continue; }

            [$factOk, $factWhy] = smm_fact_check($fixed['fact'], $fixed['source']);
            if (!$factOk) { $r['_rejected'] = 'факт не чинится: ' . $factWhy; continue; }

            $r['fact']   = $fixed['fact'];
            $r['source'] = $fixed['source'];

            /* Починенный факт — другой факт. Сверяем заново: вдруг после чистки
               он совпал с тем, что уже выходило. */
            [$fresh2, $why2] = smm_topic_is_fresh((string) $r['topic'], $r['fact'], $r['source']);
            if (!$fresh2) { $r['_rejected'] = $why2; continue; }
        }

        return $r;
    }
    return null;
}

/**
 * Проверка факта отдельным вопросом — обязательная ступень, а не перестраховка.
 *
 * Первый же прогон конвейера выдал «исследование Университета Макгилла под
 * руководством доктора Патриции Култ, 2021, ускорение обработки фонетики на 30 %».
 * Патриция Кул действительно изучает восприятие речи, но работает в Вашингтонском
 * университете, а процент выдуман целиком. Такой пост центр не переживёт: любой
 * педагог проверит ссылку за минуту и перестанет верить всему остальному.
 *
 * Модель, которую спрашивают «придумай тему», склонна склеивать настоящую фамилию
 * с чужим университетом и дорисовывать убедительную цифру. Та же модель, которую
 * спрашивают «это правда?» отдельным вопросом, без обязанности что-то сочинить,
 * такие склейки замечает. Поэтому вопрос задаётся заново и сомнение трактуется
 * против факта: не подтвердилось — тема выбрасывается, тем всё равно бесконечно.
 */
function smm_fact_check(string $fact, string $source): array {
    $fact = trim($fact);
    if ($fact === '') return [false, 'факт пустой'];

    $prompt = "Проверь утверждение на достоверность. Отвечай строго и придирчиво, "
        . "как научный редактор, который обязан поймать ошибку до публикации.\n\n"
        . "Утверждение: " . $fact . "\n"
        . "Указанный источник: " . $source . "\n\n"
        . "Проверь по пунктам:\n"
        . "1. Существует ли такое исследование или факт на самом деле.\n"
        . "2. Тот ли это учёный и правда ли он работает в названном университете. "
        . "Частая ошибка — настоящая фамилия приписана чужому учреждению.\n"
        . "3. Не выдуманы ли числа и проценты. Если точной цифры в источнике нет — это ложь.\n"
        . "4. Соответствует ли год действительности.\n\n"
        . "Если хоть один пункт вызывает сомнение — вердикт «doubt». "
        . "«ok» ставится только когда ты уверен во всех четырёх.\n\n"
        . "Верни строго JSON: {\"verdict\":\"ok|doubt\",\"why\":\"коротко, что не так\"}";

    $r = smm_ask_json($prompt, 60);
    if (!is_array($r)) return [false, 'проверка не ответила'];

    $v = mb_strtolower(trim((string) ($r['verdict'] ?? '')), 'UTF-8');
    return $v === 'ok' ? [true, ''] : [false, (string) ($r['why'] ?? 'сомнение без пояснения')];
}

/**
 * Переписать факт честно. Возвращает null, если спасать нечего: бывает, что
 * утверждение целиком держалось на выдуманном исследовании, и после вычёркивания
 * вымысла остаётся пустота — такую тему и правда надо отпустить.
 */
function smm_fact_repair(string $fact, string $source, string $why): ?array {
    $prompt = "Факт для поста не прошёл проверку достоверности.\n\n"
        . "Факт: " . $fact . "\n"
        . "Источник: " . $source . "\n"
        . "Что не так: " . $why . "\n\n"
        . "Перепиши факт так, чтобы он стал полностью достоверным:\n"
        . "- убери проценты и числа, которых нет в настоящих источниках;\n"
        . "- убери или исправь неверную привязку учёного к учреждению и неверный год;\n"
        . "- если исследование выдумано — замени утверждение на то, что проверяемо: "
        . "устройство профессии, жанра или инструмента, общеизвестный исторический "
        . "случай. Там вымысел невозможен.\n"
        . "Качественное утверждение без цифры («заметно точнее», «быстрее обычного») "
        . "лучше точной выдумки.\n\n"
        . "Если после удаления всего недостоверного от факта ничего не остаётся, "
        . "верни пустую строку в поле fact.\n\n"
        . "Верни строго JSON: {\"fact\":\"честный факт\",\"source\":\"честный источник\"}";

    $r = smm_ask_json($prompt, 60);
    if (!is_array($r)) return null;

    $fact2 = trim((string) ($r['fact'] ?? ''));
    if ($fact2 === '' || mb_strlen($fact2, 'UTF-8') < 25) return null;

    return ['fact' => $fact2, 'source' => trim((string) ($r['source'] ?? ''))];
}

/* ------------------------------------------------------------------ *
 *  Текст
 * ------------------------------------------------------------------ */

/**
 * Написать тело поста. Футер не просим у модели — он постоянный и приклеивается
 * нами: модель, которой доверили футер, каждый раз «улучшает» телефон и адреса.
 */
function smm_make_body(array $topic, string $layer, int $stage, string $hint = ''): ?string {
    $prompt = "Напиши текст поста для сообщества Культурного центра «Музыкальный Мир».\n\n"
        . ($hint !== '' ? ("ПРЕДЫДУЩАЯ ПОПЫТКА НЕ ПОДОШЛА: " . $hint . "\nИсправь именно это.\n\n") : '')
        . "Тема: " . $topic['topic'] . "\n"
        . "Факт в основе: " . ($topic['fact'] ?? '') . "\n"
        . "Источник: " . ($topic['source'] ?? '') . "\n"
        . "Угол подачи: " . ($topic['angle'] ?? '') . "\n"
        . "Адресат: " . $layer . "\n\n"
        /* КАК УСТРОЕН ЦЕНТР — иначе модель договаривает за него.
         *
         * Первый готовый текст звал «выступить на профессиональной площадке перед
         * экспертами» и «подготовить документы для прохождения отбора». Ни того,
         * ни другого у центра нет: конкурсы онлайн, по видеозаписи, отбора нет
         * вовсе. Читатель пришёл бы за одним, а нашёл другое. */
        . "КАК УСТРОЕН ЦЕНТР — не противоречь этому:\n"
        . "- конкурсы проходят ОНЛАЙН, по видеозаписи. Участник записывает номер дома, "
        . "с любого дубля, и загружает файл. Никто никуда не едет, живой сцены нет;\n"
        . "- отборочного тура нет: принимается каждая заявка;\n"
        . "- жюри выставляет аттестационную оценку по критериям, и участник получает "
        . "РЕЗУЛЬТАТ — звание лауреата или дипломанта;\n"
        /* ДИПЛОМ В БЕСПЛАТНОМ КОНКУРСЕ НЕ ПРИХОДИТ САМ.
           Модель уверенно дописывала «диплом придёт на указанную почту» — и это
           неправда: автовыдача включена только у платных конкурсов
           (cron/send_diplomas.php, c.is_paid=1), а в бесплатных сам документ
           заказывается отдельно. Пост с таким обещанием приводит человека за
           документом, которого он не получит. */
        . "- САМ ДОКУМЕНТ (диплом, благодарность) в бесплатных конкурсах НЕ приходит "
        . "на почту автоматически: его оформляют отдельно в личном кабинете. Нельзя "
        . "обещать, что диплом придёт сам, бесплатно или вместе с результатом;\n"
        . "- направлений восемь: вокал, хореография, инструментальное исполнительство, "
        . "художественное слово, театр, изобразительное искусство, декоративно-прикладное "
        . "творчество, цирковое искусство;\n"
        . "- участвуют и дети, и взрослые, и педагоги с коллективами;\n"
        . "- в коротких конкурсах результат приходит за 5 рабочих дней, в длинных "
        . "объявляется в названную дату во ВКонтакте и на сайте центра.\n\n"
        . "ПРАВИЛА ТЕКСТА:\n"
        /* Длину приходится объяснять через абзацы и пересчёт: на «1500–2400 знаков»
           модель устойчиво отдаёт 1100–1300 и считает задачу выполненной. */
        . "1. ОБЪЁМ: строго " . SMM_BODY_MIN . "–" . SMM_BODY_MAX . " знаков, цель — ровно около 2000. "
        . "Это 6–7 абзацев примерно по 300 знаков каждый. Перед ответом пересчитай знаки: "
        . "и слишком короткий, и слишком длинный текст будет отклонён и переписан заново. "
        . "Не добавляй абзацев сверх семи ради объёма.\n"
        . "2. Первая строка — заголовок заглавными буквами с одним эмодзи в начале.\n"
        . "3. Ровно 6 или 7 абзацев, между ними пустая строка. Один пост — одна мысль, "
        . "но раскрытая подробно: каждый абзац — законченная мысль в 3–5 предложений, "
        . "а не одна строка.\n"
        . "4. Первый абзац — 2–3 строки, сразу о деле, без разгона и без вопросов читателю.\n"
        . "5. Факт подаётся с названием университета и фамилией учёного.\n"
        . "6. Затем объясняется механизм: почему это работает именно так.\n"
        . "7. Предпоследний абзац — поворот на центр, без давления.\n"
        . "8. Последний абзац — спокойное действие: что сделать читателю.\n\n"
        . "ЗАПРЕЩЕНО:\n"
        . "- обращение на «ты»; «Вы» и «Вас» пишутся с большой буквы;\n"
        . "- восклицательные знаки в середине текста, канцелярит, слова «уникальный», "
        . "«не упустите», «спешите»;\n"
        . "- обещать бесплатные благодарственные письма или дипломы куратора;\n"
        . "- называть цену Элитного клуба;\n"
        . "- упоминать Telegram;\n"
        . "- выдумывать цифры центра: число участников, писем, заявок;\n"
        . "- списки со звёздочками и решётками, markdown-разметка;\n"
        . "- блок контактов и ссылки в конце — его добавят автоматически.\n\n"
        . "Верни строго JSON: {\"body\":\"текст поста\"}";

    $r = smm_ask_json($prompt, 120);
    $body = is_array($r) ? trim((string) ($r['body'] ?? '')) : '';
    return $body !== '' ? $body : null;
}

/**
 * Сократить готовый текст до нормы.
 *
 * Переписывание заново длину не чинит: на повторную просьбу модель сочиняет
 * новый текст и снова выходит за предел — три захода подряд дали 3334, 3060 и
 * 2903 знака, и ни один слот не заполнился. Сокращение — другая задача: текст
 * уже есть, его надо ужать, и с ней модель справляется с первого раза.
 *
 * Отрезать хвост программно нельзя: в последнем абзаце стоит призыв к действию,
 * ради которого пост и написан.
 */
function smm_shrink(string $body, int $max): ?string {
    $len = mb_strlen($body, 'UTF-8');
    if ($len <= $max) return $body;

    $prompt = "Сократи текст поста до " . ($max - 200) . "–" . ($max - 50) . " знаков. "
        . "Сейчас в нём " . $len . " знаков, убрать нужно примерно " . ($len - $max + 150) . ".\n\n"
        . "Как сокращать:\n"
        . "- убери повторы и общие рассуждения, оставь факты и конкретику;\n"
        . "- внутри абзацев режь предложения, а не выбрасывай абзацы целиком;\n"
        . "- ОБЯЗАТЕЛЬНО сохрани первую строку-заголовок и последний абзац с "
        . "призывом к действию — ради него пост и написан;\n"
        . "- сохрани факт с его источником;\n"
        . "- не добавляй ничего нового.\n\n"
        . "ТЕКСТ:\n" . $body . "\n\n"
        . "Верни строго JSON: {\"body\":\"сокращённый текст\"}";

    $r = smm_ask_json($prompt, 120);
    $out = is_array($r) ? trim((string) ($r['body'] ?? '')) : '';
    if ($out === '') return null;

    /* Модель иногда «сокращает» в ноль или почти не трогает — проверяем результат. */
    $n = mb_strlen($out, 'UTF-8');
    return ($n >= SMM_BODY_MIN && $n <= $max) ? $out : null;
}

/**
 * Проверка готового текста на дописанные факты.
 *
 * Проверять один факт темы оказалось мало. Тема «тейпирование стоп у танцовщиков»
 * прошла проверку с честной формулировкой без имён, а в тексте модель от себя
 * добавила «исследование Университета Кэйо под руководством профессора Кензо
 * Касэ»: создатель метода настоящий, но привязка к университету взялась из
 * воздуха. Модель дописывает убедительные подробности на этапе письма, и этот
 * этап тоже надо проверять — иначе выдумка проезжает мимо первой проверки.
 *
 * Возвращает список претензий. Пустой список — текст чист.
 */
function smm_text_fact_check(string $body): array {
    $prompt = "Ниже текст поста для соцсетей культурного центра. Найди в нём ВЫДУМКИ.\n\n"
        . "Браковать нужно ТОЛЬКО это:\n"
        . "- несуществующие исследования, книги, труды;\n"
        . "- выдуманные люди, или настоящий человек, приписанный чужому учреждению, "
        . "чужой должности, чужой работе;\n"
        . "- выдуманные числа, проценты, даты, годы;\n"
        . "- события, которых не было.\n\n"
        . "НЕ БРАКОВАТЬ: научно-популярные упрощения, общие формулировки без цифр, "
        . "современные пересказы классических идей своими словами, оценочные суждения, "
        . "метафоры, спорные, но распространённые трактовки. Это текст для соцсетей, "
        . "а не научная статья: упрощение — норма, выдумка — нет.\n\n"
        . "ТЕКСТ:\n" . $body . "\n\n"
        . "Нашёл выдумку — внеси в список. Не нашёл — верни пустой список.\n\n"
        . "Верни строго JSON: {\"problems\":[\"что именно выдумано\"]}";

    $r = smm_ask_json($prompt, 90);
    if (!is_array($r)) return [];                       // проверка не ответила — не выдумываем претензий
    $out = [];
    foreach ((array) ($r['problems'] ?? []) as $p) {
        $p = trim((string) $p);
        if ($p !== '') $out[] = $p;
    }
    return $out;
}

/* ------------------------------------------------------------------ *
 *  Картинка
 * ------------------------------------------------------------------ */

/**
 * Промпт картинки — ОДНА ГЕНЕРАЦИЯ НА ВСЁ.
 *
 * Требование владельца: кадр, заголовок и логотип рождаются вместе, в одном
 * вызове. Ничего не доклеивается после.
 *
 * Почему именно так, а не наложением. Наложенный поверх логотип и подписанный
 * сверху заголовок всегда читаются как наклейка на фотографии: у них свой свет,
 * своя резкость, своя геометрия, и кадр распадается на картинку и стикер.
 * Когда же надпись и эмблема описаны внутри сцены — краска на бетонной стене
 * коридора, латунная табличка у двери репетиционной, буквы на белёной стене
 * студии, — на них ложится тот же свет, та же пыль и та же перспектива, и кадр
 * остаётся единым. Образцы владельца сделаны именно так.
 *
 * Логотип при этом идёт в генерацию референсом (image_urls) и описывается как
 * предмет, который в сцене уже существует: его не перерисовывают заново, его
 * вешают на стену.
 */
function smm_make_image_prompt(array $topic, string $ratio, string $title = '', string $subtitle = ''): ?string {
    $title    = trim($title);
    $subtitle = trim($subtitle);

    $prompt = "Write a highly detailed image generation prompt in ENGLISH for a KEY VISUAL "
        . "of a Russian cultural centre that runs online arts competitions.\n\n"
        . "Post topic: " . $topic['topic'] . "\n"
        . "Angle: " . ($topic['angle'] ?? '') . "\n"
        . "Aspect ratio: " . $ratio . "\n\n"
        /* Планка задаётся жанром, а не прилагательными: «красиво и профессионально»
           модель понимает как ровный сток, а «кадр киноплаката» — как свет, слои и
           драматургию. Владелец просит именно второе. */
        . "TREAT THIS AS A CINEMATIC MOVIE POSTER KEY ART, not a stock photo. The frame "
        . "must look like a still from a feature film: dramatic, layered, alive, with a "
        . "story happening in it. Mediocre, flat, evenly-lit stock imagery is a failure.\n\n"
        . "The prompt MUST be at least 2500 characters and MUST describe:\n"
        . "- A SPECIFIC DRAMATIC MOMENT, not a pose: the instant before the bow touches "
        . "the string, the breath taken before the first note, hands frozen above the keys, "
        . "a child looking up at a teacher. Something is HAPPENING and about to change.\n"
        . "- DEPTH IN LAYERS: a distinct foreground element close to the lens and slightly "
        . "out of focus (sheet music, a hand, the edge of an instrument, a curtain), a sharp "
        . "mid-ground with the subject, and a deep background that recedes into shadow or "
        . "glow. The eye must travel through the frame.\n"
        . "- DRAMATIC CINEMATIC LIGHTING: a strong motivated key light (stage light, a "
        . "window shaft, a desk lamp) carving the subject out of darkness, visible rim or "
        . "hair light separating them from the background, deep rich shadows that are not "
        . "muddy, light falling off across the room. Never flat, never evenly lit.\n"
        . "- ATMOSPHERE made visible: dust motes drifting through the light beam, haze in "
        . "the air, breath in cold air, warm bokeh highlights, soft lens bloom, subtle "
        . "anamorphic flare. The air itself must be photographed.\n"
        . "- RICH TACTILE TEXTURE in close detail: lacquer scratched on an old piano lid, "
        . "rosin dust, worn parquet, chipped plaster, heavy velvet, knitted wool, aged brass, "
        . "fingerprints on polished wood.\n"
        . "- AUTHENTIC RUSSIAN SETTING, lived-in and specific: an old music school hall with "
        . "tall windows, a backstage corridor, a rehearsal room at dusk, a home with winter "
        . "light. Real places with history, never a glossy white studio.\n"
        . "- CAMERA CRAFT: focal length and aperture, a deliberate angle (low hero angle, "
        . "over-the-shoulder, wide establishing shot), shallow depth of field, where focus "
        . "falls and where it melts away.\n"
        . "- A STRONG CINEMATIC COLOUR GRADE: a deliberate palette with warm key against "
        . "cool shadow, teal-and-amber or candlelight-against-blue-dusk, deep blacks, "
        . "controlled highlights, film-like contrast curve.\n"
        . "- COMPOSITION WORTHY OF A POSTER: leading lines, strong diagonals, a clear focal "
        . "point, generous clean area where the headline will live, and the subject placed "
        . "so the whole thing is balanced as one designed image.\n"
        . "- EMOTION on the faces, readable at a glance: concentration, tenderness, nerve, "
        . "pride. Real Russian people, natural skin, real ages, no models posing.\n"
        . "- QUALITY: 8K, ultra sharp, photorealistic, shot on 35mm cinema glass, "
        . "award-winning editorial photography, colour-graded like a film still.\n\n";

    if ($title !== '') {
        /* Текст передаётся дословно и в кавычках: пересказанный своими словами,
           он возвращается с выдуманной орфографией и лишними буквами. */
        $prompt .= "THE HEADLINE IS PART OF THE CINEMATOGRAPHY, NOT A CAPTION. The prompt "
            . "MUST place this exact Russian text as a real physical element inside the "
            . "frame, lit by the same light as everything else:\n"
            . "Headline, exactly these characters: \"" . $title . "\"\n"
            . ($subtitle !== '' ? ("Subtitle, exactly these characters: \"" . $subtitle . "\"\n") : '')
            . "Choose ONE way it physically exists and describe it richly: bold clean "
            . "sans-serif letters painted straight onto the plaster or concrete wall; "
            . "large letters mounted in relief on the wall casting their own soft shadows; "
            . "lettering printed on a poster pinned to the wall of the hall. It must sit on "
            . "that surface in correct perspective, take the wall's texture, catch the same "
            . "key light, and cast or receive the same shadows as the room. The headline is "
            . "large, confident and dominant like film-poster typography; the subtitle sits "
            . "beneath it, much smaller, in two short lines. Keep that area of the wall clean "
            . "and unobstructed so the words read instantly, and keep people and objects "
            . "clear of the lettering. Russian spelling must be exact.\n\n";
    }

    $prompt .= "THE LOGO IS A PROP IN THE ROOM. A reference image of the centre's real round "
        . "golden emblem is supplied. The prompt MUST ask to place THAT EXACT emblem, "
        . "reproduced faithfully with its own artwork and its own circular lettering "
        . "untouched, as a physical object belonging to the scene: a heavy brass medallion "
        . "or a round bronze plaque mounted on the wall, catching a warm specular glint from "
        . "the key light, with its own soft shadow, in correct perspective, perfectly "
        . "circular, never stretched, never redrawn, never re-lettered, never invented anew. "
        . "Place it in a calm, uncluttered corner of the frame where nothing overlaps it.\n\n"
        . "FORBIDDEN: any other text, captions, signage, posters with other words, "
        . "watermarks, other logos or emblems beyond the two elements above; flat even "
        . "lighting; stock-photo blandness; collage; surreal distortion; extra fingers; "
        . "plastic skin; cluttered backgrounds that fight the headline.\n\n"
        . "Return strictly JSON: {\"prompt\":\"...\"}";

    $r = smm_ask_json($prompt, 120);
    $p = is_array($r) ? trim((string) ($r['prompt'] ?? '')) : '';
    return $p !== '' ? $p : null;
}

/** Размер холста под формат. */
function smm_ratio_size(string $ratio): array {
    return match ($ratio) {
        '1:1' => [2048, 2048],
        '4:3' => [2304, 1728],
        default => [2560, 1440],
    };
}

/**
 * Сгенерировать картинку. Платно, поэтому расход сначала спрашивается у бюджета.
 * Логотип центра передаётся референсом: правило владельца — логотип только
 * настоящий, нарисованных подобий быть не должно.
 */
function smm_make_image(string $prompt, string $ratio, string $saveTo): array {
    $key = trim((string) (cfgv('apimodels_key') ?: ''));
    if ($key === '') return [false, 'нет ключа apimodels', 0.0];

    $cost = (float) setting('smm_image_cost', '0.04');
    if (!smm_budget_ok($cost)) return [false, 'дневной предел расхода на картинки исчерпан', 0.0];

    /* Логотип идёт референсом в ту же генерацию: кадр, надпись и эмблема
       рождаются вместе и живут в одном свете. Ничего не доклеивается после. */
    $logo = (string) (cfgv('smm_logo_url')
        ?: 'https://xn----7sbugdeiegh1b0a9hen.xn--p1ai/assets/img/logo_muzmir_main.png');

    $body = json_encode([
        'model'        => (string) (cfgv('apimodels_model') ?: 'gemini-3-pro-image'),
        'prompt'       => $prompt,
        'aspect_ratio' => $ratio,
        'resolution'   => '2k',
        'quality'      => 'high',
        'image_urls'   => [$logo],
    ], JSON_UNESCAPED_UNICODE);

    $base = rtrim((string) (cfgv('apimodels_base') ?: 'https://api.apimodels.app/v1'), '/');
    $ch = curl_init($base . '/images/generations');
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => $body,
        CURLOPT_HTTPHEADER => ['Content-Type: application/json', 'Authorization: Bearer ' . $key],
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 120,
    ]);
    $res  = curl_exec($ch);
    $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    if ($code !== 200 || !is_string($res)) return [false, "apimodels ответил {$code}", 0.0];

    $j = json_decode($res, true);
    /* ГРАБЛИ: идентификатор задачи лежит в data.taskId, а результат — в
       data.resultUrls, не в data.output.image_urls, как подсказывает здравый смысл. */
    $taskId = (string) ($j['data']['taskId'] ?? $j['taskId'] ?? '');
    if ($taskId === '') return [false, 'apimodels не вернул taskId', 0.0];

    /* ГРАБЛИ: готовность спрашивается НЕ путём /images/generations/<id> (на него
       приходит 404 с нотацией про base_url, сбивающей с толку), а тем же путём с
       параметром ?task_id=. Именно task_id со знаком подчёркивания: taskId,
       которым API сам назвал поле в ответе, здесь даёт «task_id is required». */
    $url = '';
    for ($i = 0; $i < 60; $i++) {
        sleep(5);
        $ch = curl_init($base . '/images/generations?task_id=' . rawurlencode($taskId));
        curl_setopt_array($ch, [
            CURLOPT_HTTPHEADER => ['Authorization: Bearer ' . $key],
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 30,
        ]);
        $r2 = curl_exec($ch);
        curl_close($ch);
        if (!is_string($r2)) continue;
        $d = json_decode($r2, true);
        $state = (string) ($d['data']['state'] ?? $d['data']['status'] ?? '');
        if ($state === 'completed' || $state === 'success') {
            $url = (string) ($d['data']['resultUrls'][0] ?? '');
            break;
        }
        if ($state === 'failed' || $state === 'error') return [false, 'генерация не удалась', 0.0];
    }
    if ($url === '') return [false, 'картинка не дождалась готовности', 0.0];

    /* ГРАБЛИ: хранилище r2.apimodels.app отдаёт 403 на запрос без обычных
       браузерных заголовков — скачиваем curl'ом с User-Agent. */
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 120,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_USERAGENT => 'Mozilla/5.0',
    ]);
    $img  = curl_exec($ch);
    $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    if ($code !== 200 || !is_string($img) || strlen($img) < 10000) return [false, 'картинка не скачалась', 0.0];

    @mkdir(dirname($saveTo), 0775, true);
    if (file_put_contents($saveTo, $img) === false) return [false, 'картинка не сохранилась', 0.0];

    return [true, '', $cost];
}

/* ------------------------------------------------------------------ *
 *  Hooppy: публикация
 * ------------------------------------------------------------------ */

function smm_hooppy_call(string $path, string $method = 'GET', ?array $payload = null, ?string $filePath = null): ?array {
    $token = trim((string) (cfgv('hooppy_token') ?: ''));
    if ($token === '') return null;
    $base = rtrim((string) (cfgv('hooppy_base') ?: 'https://api.hooppy.ru/api'), '/');

    $ch = curl_init($base . '/' . ltrim($path, '/'));
    $headers = ['Accept: application/json', 'Authorization: Bearer ' . $token];
    $opts = [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 180];

    if ($filePath !== null) {
        $opts[CURLOPT_POST] = true;
        $opts[CURLOPT_POSTFIELDS] = [
            'file'    => new CURLFile($filePath, mime_content_type($filePath) ?: 'image/jpeg', basename($filePath)),
            'file_id' => $payload['file_id'] ?? bin2hex(random_bytes(16)),
        ];
    } elseif ($method === 'POST') {
        $opts[CURLOPT_POST] = true;
        $opts[CURLOPT_POSTFIELDS] = json_encode($payload ?: [], JSON_UNESCAPED_UNICODE);
        $headers[] = 'Content-Type: application/json';
    }
    $opts[CURLOPT_HTTPHEADER] = $headers;
    curl_setopt_array($ch, $opts);

    $res  = curl_exec($ch);
    $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    if ($code !== 200 || !is_string($res)) return null;
    $j = json_decode($res, true);
    return is_array($j) ? $j : null;
}

/** Куда публикуем. Страницы задаёт владелец настройкой, по умолчанию — ВК и МАКС. */
function smm_target_pages(): array {
    $raw = trim((string) setting('smm_pages', '2543792,2561963'));
    return array_values(array_filter(array_map('intval', preg_split('~[,\s]+~', $raw) ?: [])));
}

/**
 * Опубликовать пост. Перед отправкой ещё раз проверяется окно: между подготовкой
 * и публикацией проходят часы, и крон может запуститься руками в воскресенье.
 */
function smm_publish(array $post, bool $force = false): array {
    if (!$force && function_exists('outreach_window_ok') && !outreach_window_ok()) {
        return [false, 'вне окна публикаций: ' . (function_exists('outreach_window_reason') ? outreach_window_reason() : '')];
    }

    $pages = smm_target_pages();
    if (!$pages) return [false, 'не заданы страницы публикации'];

    $text = (string) $post['text_full'];
    if (trim($text) === '') return [false, 'пустой текст'];

    $attachments = [];
    $img = (string) ($post['image_path'] ?? '');
    if ($img !== '' && is_file($img)) {
        $up = smm_hooppy_call('files/media/upload', 'POST', ['file_id' => bin2hex(random_bytes(16))], $img);
        $photo = $up['photo'] ?? null;
        if (!is_array($photo)) return [false, 'картинка не загрузилась в Hooppy'];
        $attachments[] = ['type' => 'photos', 'data' => [$photo]];
    }

    $res = smm_hooppy_call('posts', 'POST', [
        'publication_when_type' => 1,            // публиковать сейчас
        'publication_how_type'  => 1,            // соцсети указаны вручную
        'selected_pages_ids'    => $pages,
        'texts'                 => [['text' => $text, 'source_id' => 0]],
        'attachments'           => $attachments,
    ]);

    $id = (int) ($res['id'] ?? 0);
    if ($id <= 0) return [false, 'Hooppy не принял пост'];

    return [true, (string) $id];
}

/**
 * Найти ссылку на опубликованную запись ВКонтакте. Hooppy ссылку не отдаёт, а
 * владельцу в отчёте нужна именно она. Стена читается ключом сообщества и только
 * с боевого сервера — правило о российском адресе без прокси.
 */
function smm_vk_last_link(): string {
    /* ЧИТАЕТ СТЕНУ ЛИЧНЫЙ КЛЮЧ, А НЕ КЛЮЧ СООБЩЕСТВА.
     *
     * Ключу сообщества wall.get недоступен вовсе: ВК отвечает «error 27, method
     * is unavailable with group auth». Функция молча возвращала пустоту, и у
     * трёх опубликованных постов ссылки в базе не оказалось. Чтение чужой и
     * своей стены — ровно тот случай, для которого личный ключ и оставлен
     * запасным (правило о ключах от 11.09.2026); писать в сообщество
     * по-прежнему обязан ключ сообщества. */
    $token = trim((string) (cfgv('vk_token') ?: cfgv('MUZMIR_VK_TOKEN') ?: ''));
    if ($token === '') $token = trim((string) (cfgv('vk_group_token') ?: ''));
    $owner = (int) (cfgv('vk_group_id') ?: 211325055);
    if ($token === '' || $owner === 0) return '';

    $url = 'https://api.vk.ru/method/wall.get?owner_id=-' . $owner . '&count=1&v=5.199&access_token=' . urlencode($token);
    $ch = curl_init($url);
    curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 30]);
    $res = curl_exec($ch);
    curl_close($ch);
    if (!is_string($res)) return '';
    $j = json_decode($res, true);
    $id = (int) ($j['response']['items'][0]['id'] ?? 0);
    return $id > 0 ? ('https://vk.com/wall-' . $owner . '_' . $id) : '';
}
