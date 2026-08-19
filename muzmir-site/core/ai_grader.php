<?php
/**
 * АВТОМАТИЧЕСКАЯ АТТЕСТАЦИЯ КОНКУРСНОЙ РАБОТЫ.
 *
 * Что здесь происходит по шагам: берём заявку, достаём по ссылке запись,
 * готовим её для модели, показываем модели рубрику своей номинации и просим
 * разобрать работу так, как это делает член жюри, а не зритель. Итоговый балл
 * считаем сами по весам, звание выводим по шкале, а комментарий сохраняем
 * отдельно от оценки.
 *
 * ПОЧЕМУ БАЛЛ СЧИТАЕМ САМИ. Модель хорошо описывает, что слышит и видит, но
 * складывать взвешенные оценки ей нельзя: она округляет в удобную сторону и
 * подгоняет сумму под звание, которое ей «кажется правильным». Поэтому от неё
 * требуется только оценка по каждому критерию с обоснованием, а арифметика,
 * веса и граница звания остаются на нашей стороне и всегда воспроизводимы.
 *
 * ПОЧЕМУ ДВА ФАЙЛА, А НЕ ОДИН. Для вокала и инструмента решает звук, для
 * хореографии и театра — картинка. Видео сжимаем сильно (оценке не нужен
 * телевизионный битрейт), а звук отправляем отдельной дорожкой в приличном
 * качестве: иначе интонация и тембр превращаются в кашу, и любая оценка по ним
 * будет выдумкой.
 *
 * ЧЕГО ЗДЕСЬ НЕТ. Здесь нет решения «выдать звание». Функция только считает и
 * записывает результат в grading_runs; применит его или нет, решает
 * cron/ai_grade.php по режиму, который выбран в админке.
 */
declare(strict_types=1);

require_once BASE_PATH . '/core/grading_rubrics.php';
require_once BASE_PATH . '/core/grading_knowledge.php';
require_once BASE_PATH . '/core/grading_anchors.php';
require_once BASE_PATH . '/core/video_fetch.php';

/** Таблицы оценки заводятся лениво, как всё остальное в проекте. */
function ag_migrate(): void {
    static $done = false;
    if ($done) return;
    $done = true;
    try {
        db()->exec("CREATE TABLE IF NOT EXISTS grading_runs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            application_id INTEGER NOT NULL,
            model TEXT DEFAULT '',
            status TEXT DEFAULT 'new',        -- new|ok|failed|skipped
            formal TEXT DEFAULT '',           -- JSON формальных проверок
            scores TEXT DEFAULT '',           -- JSON баллов по критериям
            total REAL DEFAULT 0,
            title TEXT DEFAULT '',            -- звание по шкале
            jury_comment TEXT DEFAULT '',     -- для участника
            internal_note TEXT DEFAULT '',    -- для оргкомитета
            confidence REAL DEFAULT 0,
            red_flags TEXT DEFAULT '',
            level_guess TEXT DEFAULT '',      -- звание прямым выбором модели, до перевода балла
            applied INTEGER DEFAULT 0,        -- решение перенесено в заявку
            applied_at TEXT DEFAULT '',
            error TEXT DEFAULT '',
            seconds REAL DEFAULT 0,
            created_at TEXT DEFAULT (datetime('now','localtime')))");
        // Поле появилось после первых сверок: на уже созданной таблице его надо добавить.
        try { db()->exec("ALTER TABLE grading_runs ADD COLUMN level_guess TEXT DEFAULT ''"); } catch (\Throwable $e) {}
        db()->exec("CREATE INDEX IF NOT EXISTS idx_gr_app ON grading_runs(application_id)");
        db()->exec("CREATE INDEX IF NOT EXISTS idx_gr_status ON grading_runs(status)");
        db()->exec("CREATE TABLE IF NOT EXISTS grading_rubrics (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nomination TEXT NOT NULL,
            subgroup TEXT DEFAULT '',
            payload TEXT NOT NULL,
            updated_at TEXT DEFAULT (datetime('now','localtime')))");
        db()->exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_grub ON grading_rubrics(nomination, subgroup)");
    } catch (\Throwable $e) {}
}

/** Режим работы: off — выключено, assist — подсказка жюри, auto — решает само. */
function ag_mode(): string {
    $m = (string) (function_exists('setting') ? setting('auto_grading_mode', 'off') : 'off');
    return in_array($m, ['off', 'assist', 'auto'], true) ? $m : 'off';
}

/** Модель для оценки. Меняется настройкой без правки кода. */
function ag_model(): string {
    return trim((string) (function_exists('setting') ? setting('grade_model', 'gemini-3.1-pro-preview') : 'gemini-3.1-pro-preview'));
}

/** Базовый адрес API: у центра он идёт через свой прокси. */
function ag_base(): string {
    return rtrim((string) (cfgv('gemini_base_url') ?: 'https://generativelanguage.googleapis.com'), '/');
}

/** Ключи Gemini — те же, что у чата. */
function ag_keys(): array {
    if (!function_exists('chat_gemini_keys') && is_file(BASE_PATH . '/core/chat_brain.php')) {
        require_once BASE_PATH . '/core/chat_brain.php';
    }
    return function_exists('chat_gemini_keys') ? chat_gemini_keys() : array_filter([trim((string) cfgv('gemini_api_key', ''))]);
}

/**
 * ПОДГОТОВКА ЗАПИСИ ДЛЯ МОДЕЛИ.
 *
 * Видео ужимаем до 480p и 12 кадров в секунду: для оценки чистоты линий,
 * синхронности и мимики этого достаточно, а объём падает в десятки раз. Звук
 * вынимаем отдельно и не жалеем на него битрейт — по нему оценивается всё, что
 * касается интонации, тембра и дикции.
 *
 * @return array{ok:bool, video:string, audio:string, seconds:int, why:string}
 */
function ag_prepare_media(string $path): array {
    $bad = static fn(string $w): array => ['ok' => false, 'video' => '', 'audio' => '', 'seconds' => 0, 'why' => $w];
    if (!is_file($path)) return $bad('файл записи не найден');

    $maxSec = max(60, (int) (function_exists('setting') ? setting('grade_video_max_sec', '900') : 900));
    $dur    = vf_duration($path);
    $stem   = preg_replace('~\.[a-z0-9]+$~i', '', $path);
    $video  = $stem . '_s.mp4';
    $audio  = $stem . '_a.mp3';

    // -an у видео: звук в этом файле не нужен, он поедет отдельной дорожкой.
    $cmdV = 'ffmpeg -y -loglevel error -i ' . escapeshellarg($path)
          . ' -t ' . $maxSec . ' -vf "scale=-2:480,fps=12" -c:v libx264 -preset veryfast -crf 30 -an '
          . escapeshellarg($video) . ' 2>&1';
    @exec($cmdV, $o1, $rc1);

    $cmdA = 'ffmpeg -y -loglevel error -i ' . escapeshellarg($path)
          . ' -t ' . $maxSec . ' -vn -ac 1 -ar 32000 -b:a 96k ' . escapeshellarg($audio) . ' 2>&1';
    @exec($cmdA, $o2, $rc2);

    $okV = $rc1 === 0 && is_file($video) && filesize($video) > 50000;
    $okA = $rc2 === 0 && is_file($audio) && filesize($audio) > 20000;
    if (!$okV && !$okA) return $bad('запись не читается: ' . mb_substr(implode(' ', array_slice($o1 ?: $o2 ?: [], 0, 2)), 0, 200));

    return ['ok' => true, 'video' => $okV ? $video : '', 'audio' => $okA ? $audio : '',
            'seconds' => $dur, 'why' => ''];
}

/**
 * Загрузка файла в Gemini File API (простой протокол: один запрос со стартом,
 * второй с телом). Возвращает file_uri, который подставляется в запрос оценки.
 */
function ag_upload(string $file, string $mime, string $key): array {
    if (!is_file($file)) return ['ok' => false, 'uri' => '', 'why' => 'нет файла'];
    $size = (int) filesize($file);
    $base = ag_base();

    $ch = curl_init($base . '/upload/v1beta/files?key=' . rawurlencode($key));
    curl_setopt_array($ch, [
        CURLOPT_POST => 1, CURLOPT_RETURNTRANSFER => 1, CURLOPT_TIMEOUT => 60,
        CURLOPT_HEADER => 1,
        CURLOPT_HTTPHEADER => [
            'X-Goog-Upload-Protocol: resumable',
            'X-Goog-Upload-Command: start',
            'X-Goog-Upload-Header-Content-Length: ' . $size,
            'X-Goog-Upload-Header-Content-Type: ' . $mime,
            'Content-Type: application/json',
        ],
        CURLOPT_POSTFIELDS => json_encode(['file' => ['display_name' => basename($file)]]),
    ]);
    $resp = (string) curl_exec($ch);
    curl_close($ch);
    if (!preg_match('~x-goog-upload-url:\s*(\S+)~i', $resp, $m)) {
        return ['ok' => false, 'uri' => '', 'why' => 'сервис не принял начало загрузки'];
    }
    $up = trim($m[1]);

    $fh = fopen($file, 'rb');
    $ch = curl_init($up);
    curl_setopt_array($ch, [
        CURLOPT_CUSTOMREQUEST => 'POST',
        CURLOPT_RETURNTRANSFER => 1,
        CURLOPT_TIMEOUT => 900,
        CURLOPT_UPLOAD => 1,
        CURLOPT_INFILE => $fh,
        CURLOPT_INFILESIZE => $size,
        CURLOPT_HTTPHEADER => [
            'X-Goog-Upload-Offset: 0',
            'X-Goog-Upload-Command: upload, finalize',
            'Content-Type: ' . $mime,
        ],
    ]);
    $body = (string) curl_exec($ch);
    $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    if (is_resource($fh)) fclose($fh);

    $j = json_decode($body, true);
    $uri = (string) ($j['file']['uri'] ?? '');
    if ($code >= 400 || $uri === '') {
        return ['ok' => false, 'uri' => '', 'why' => 'загрузка не удалась (код ' . $code . ')'];
    }

    // Файл становится доступен не мгновенно: ждём состояния ACTIVE, иначе
    // запрос оценки вернёт «файл ещё обрабатывается» и попытка пропадёт зря.
    $name = (string) ($j['file']['name'] ?? '');
    for ($i = 0; $i < 30; $i++) {
        $st = json_decode((string) file_get_contents(ag_base() . '/v1beta/' . $name . '?key=' . rawurlencode($key)), true);
        $state = (string) ($st['state'] ?? '');
        if ($state === 'ACTIVE') break;
        if ($state === 'FAILED') return ['ok' => false, 'uri' => '', 'why' => 'сервис не смог обработать запись'];
        sleep(2);
    }
    return ['ok' => true, 'uri' => $uri, 'why' => ''];
}

/** Промпт аттестации: роль, рубрика, требования к ответу. */
function ag_prompt(array $app, array $rubric): string {
    $L = [];
    $L[] = 'Ты член жюри всероссийского конкурса исполнительских искусств: педагог высшей категории с консерваторским образованием и многолетним опытом работы в жюри.';
    $L[] = 'Тебе прислали конкурсную запись. Разбери её так, как разбирают на профессиональном прослушивании: сначала факты (что слышно и видно), потом оценка, и только потом слова для участника.';
    $L[] = '';
    $L[] = 'ЗАЯВКА';
    $L[] = '  номинация: ' . (string) ($app['nomination'] ?? '');
    $L[] = '  направление: ' . (string) ($app['subgroup'] ?? 'не указано');
    $L[] = '  возрастная категория: ' . (string) ($app['age_category'] ?? 'не указана');
    $L[] = '  состав: ' . (string) ($app['formation'] ?? 'не указан');
    $L[] = '  конкурсная работа: ' . (string) ($app['work_title'] ?? 'без названия');
    $L[] = '  участник: ' . (string) ($app['is_group'] ? ($app['group_name'] ?? '') : ($app['full_name'] ?? ''));
    $L[] = '';
    $L[] = 'СНАЧАЛА ФОРМАЛЬНАЯ ПРОВЕРКА. По каждому пункту ответь true или false и объясни, если false:';
    foreach (gr_formal_checks() as $k => $text) $L[] = '  ' . $k . ': ' . $text;
    $L[] = '';
    $L[] = 'ЗАТЕМ ОЦЕНКА ПО КРИТЕРИЯМ. Каждому критерию поставь балл от 0 до 100 и напиши обоснование из ДВУХ-ТРЁХ конкретных наблюдений с привязкой ко времени записи (например «0:42 срыв дыхания в конце фразы»). Без привязки к конкретным местам оценка не принимается.';
    foreach ((array) ($rubric['criteria'] ?? []) as $key => $c) {
        $L[] = '';
        $L[] = '  [' . $key . '] ' . $c['title'] . ' (вес ' . $c['weight'] . ')';
        $L[] = '    на что смотреть: ' . $c['look'];
        foreach ((array) ($c['levels'] ?? []) as $lvl => $desc) $L[] = '    ' . $lvl . ': ' . $desc;
    }
    if (!empty($rubric['sub_note'])) {
        $L[] = '';
        $L[] = 'ОСОБЕННОСТЬ НАПРАВЛЕНИЯ: ' . (string) $rubric['sub_note'];
    }
    // ПАСПОРТ НАПРАВЛЕНИЯ. Рубрика говорит, за что ставить балл, а паспорт — что
    // в этом направлении считается хорошо и что плохо. Без него академический и
    // народный вокал разбираются одинаково, хотя правильный звук у них разный.
    if (function_exists('gk_direction_prompt')) {
        $gk = gk_direction_prompt((string) ($app['subgroup'] ?? ''));
        if ($gk !== '') { $L[] = ''; $L[] = $gk; }
    }
    $L[] = '';
    $L[] = 'ЧТО ЗНАЧАТ БАЛЛЫ (это главное, читай внимательно)';
    $L[] = '  95-100 — уровень победителя международного конкурса: профессиональная свобода, безупречная техника, самостоятельная художественная трактовка. В обычном потоке таких работ единицы на сотню.';
    $L[] = '  90-94  — очень сильная работа: техника надёжна, замысел ясен, недочёты единичны и не мешают.';
    $L[] = '  85-89  — сильная работа с заметными недочётами: есть техническая или интонационная нестабильность, но целое убедительно.';
    $L[] = '  80-84  — крепкая работа: основа освоена, но недочёты видны на протяжении номера.';
    $L[] = '  75-79  — добротная учебная работа: программа исполнена, свободы и художественного решения не хватает.';
    $L[] = '  70-74  — работа с системными недочётами: техника не позволяет полностью справиться с задачей.';
    $L[] = '  65-69  — начальный уровень: заметные ошибки в основах.';
    $L[] = '  ниже 65 — задача исполнителю не по силам либо работа не готова к показу.';
    $L[] = '';
    // ПЛАНКА КОНКУРСА. Книжные критерии одинаковы везде, а строгость состава
    // своя: пока модель её не видит, она разбирает работу верно, а звание
    // выдаёт по своему представлению о среднем конкурсе.
    if (function_exists('ga_block')) {
        $ga = ga_block($app);
        if ($ga !== '') { $L[] = ''; $L[] = $ga; $L[] = ''; }
    }
    $L[] = 'ОРИЕНТИР ПОТОКА. Большинство работ детских школ искусств и любительских коллективов попадает в диапазон 70-85. Диапазон 90 и выше означает, что работу можно показать на профессиональном прослушивании без скидок на возраст и любительский статус. Если рука тянется поставить всем 88-93, значит оценка потеряла смысл: перечитай, какие именно недочёты ты сама назвала в обосновании, и поставь балл, соответствующий им.';
    $L[] = 'ПРОВЕРЬ СЕБЯ. Каждый названный тобой недочёт обязан отражаться в балле. Если в обосновании написано «теряется фиксация», «интонация плывёт», «рассинхроны», а балл выше 88, ты противоречишь сама себе.';
    $L[] = '';
    $L[] = 'КАК ОЦЕНИВАТЬ ЧЕСТНО';
    $L[] = '  • Оценивай относительно возрастной категории: от ребёнка не требуют зрелости, но и завышать за возраст нельзя.';
    $L[] = '  • Качество съёмки и звука записи само по себе не оценивается. Оценивается исполнение. Но если запись мешает услышать интонацию или увидеть технику, скажи об этом прямо и снизь уверенность, а не выдумывай оценку.';
    $L[] = '  • Не завышай из вежливости и не занижай из строгости. Балл 100 означает уровень победителя международного конкурса, 60 означает начальный уровень с системными ошибками.';
    $L[] = '  • Артистизм и костюм не могут перевесить технику: у них меньший вес именно поэтому.';
    $L[] = '  • Если чего-то не слышно или не видно, так и напиши, а балл поставь по тому, что доступно.';
    $L[] = '';
    $L[] = 'КОММЕНТАРИЙ ДЛЯ УЧАСТНИКА (поле jury_comment)';
    $L[] = '  От лица коллегии жюри, на «Вы», по-русски, 700-1200 знаков. Структура: что получилось хорошо (конкретно), над чем работать (конкретно, с называнием приёма или упражнения), общее пожелание.';
    $L[] = '  Пиши как профессор, разбирающий работу ученика: доброжелательно, но по существу, без общих слов вроде «молодцы» и «так держать». Не называй баллы и звание, не упоминай, что оценка автоматическая.';
    $L[] = '';
    $L[] = 'ОТВЕТ строго в JSON без markdown и пояснений:';
    $L[] = '{"formal":{"playable":true,"one_piece":true,"participant":true,"nomination":true,"formation":true,"integrity":true,"no_overdub":true,"duration":true,"issues":["..."]},';
    $L[] = ' "criteria":{"КЛЮЧ":{"score":0,"note":"..."}},';
    $L[] = ' "level":"звание одной строкой","jury_comment":"...","internal_note":"для оргкомитета: сомнения, спорные места, что проверить человеку",';
    $L[] = ' "confidence":0.0,"red_flags":["..."]}';
    $L[] = 'level — звание, которое ты присудила бы этой работе, ровно одной строкой из списка: ГРАН-ПРИ, ЛАУРЕАТ I СТЕПЕНИ, ЛАУРЕАТ II СТЕПЕНИ, ЛАУРЕАТ III СТЕПЕНИ, ДИПЛОМАНТ I СТЕПЕНИ, ДИПЛОМАНТ II СТЕПЕНИ, ДИПЛОМАНТ III СТЕПЕНИ, УЧАСТНИК КОНКУРСА. Выбирай его не по сумме баллов, а сравнением с эталонами и с обычным уровнем потока: балл и звание считаются отдельно и потом сверяются между собой.';
    $L[] = 'confidence — насколько ты уверена в оценке от 0 до 1: 0.9 и выше только когда запись хорошо слышна и видна и случай однозначный.';
    $L[] = 'red_flags — то, из-за чего работу обязан посмотреть человек: подозрение на фонограмму вместо живого исполнения, чужое исполнение, монтаж, несоответствие номинации, неприемлемое содержание.';
    return implode("\n", $L);
}

/** Разбор ответа модели: JSON бывает завёрнут в markdown-ограду. */
function ag_parse_json(string $raw): ?array {
    $t = trim($raw);
    if ($t === '') return null;
    if (preg_match('~```(?:json)?\s*(.+?)\s*```~s', $t, $m)) $t = $m[1];
    $j = json_decode($t, true);
    if (is_array($j)) return $j;
    // Иногда модель добавляет текст до или после: берём самый внешний объект.
    $a = mb_strpos($t, '{');
    $b = mb_strrpos($t, '}');
    if ($a !== false && $b !== false && $b > $a) {
        $j = json_decode(mb_substr($t, $a, $b - $a + 1), true);
        if (is_array($j)) return $j;
    }
    return null;
}

/**
 * ОЦЕНИТЬ ОДНУ ЗАЯВКУ.
 *
 * @return array{ok:bool, run_id:int, total:float, title:string, why:string}
 */
function ag_grade_application(int $appId, array $opt = []): array {
    ag_migrate();
    $t0  = microtime(true);
    $bad = static function (string $why, int $runId = 0) use ($appId): array {
        try {
            if ($runId > 0) q("UPDATE grading_runs SET status='failed', error=? WHERE id=?", [mb_substr($why, 0, 500), $runId]);
            else insert('grading_runs', ['application_id' => $appId, 'status' => 'failed', 'error' => mb_substr($why, 0, 500)]);
        } catch (\Throwable $e) {}
        return ['ok' => false, 'run_id' => $runId, 'total' => 0.0, 'title' => '', 'why' => $why];
    };

    $app = one("SELECT a.*, c.name AS comp_name, c.is_paid AS comp_paid
                  FROM applications a LEFT JOIN competitions c ON c.id = a.competition_id
                 WHERE a.id = ?", [$appId]);
    if (!$app) return $bad('заявка не найдена');

    $url = trim((string) ($app['video_url'] ?? ''));
    if ($url === '') return $bad('в заявке нет ссылки на конкурсную работу');

    $keys = ag_keys();
    if (!$keys) return $bad('не настроен доступ к модели оценки');

    $runId = (int) insert('grading_runs', ['application_id' => $appId, 'model' => ag_model(), 'status' => 'new']);

    // 1. Достаём запись.
    $dl = vf_download($url, $appId);
    if (!$dl['ok']) return $bad('запись не получена: ' . $dl['why'], $runId);

    // 2. Готовим дорожки.
    $media = ag_prepare_media($dl['path']);
    if (!$media['ok']) { vf_cleanup($dl['path']); return $bad($media['why'], $runId); }

    // 3. Загружаем в сервис.
    //
    // ФАЙЛ ПРИНАДЛЕЖИТ ТОМУ КЛЮЧУ, КОТОРЫМ ЗАГРУЖЕН. Это и есть причина, по
    // которой нельзя загрузить один раз, а запросы слать любым ключом: чужой
    // ключ на тот же файл отвечает «нет доступа». Поэтому загрузка вынесена в
    // функцию и повторяется, когда мы переходим к следующему ключу.
    $uploadAll = static function (string $key) use ($media): array {
        $parts = [];
        foreach ([[$media['video'], 'video/mp4'], [$media['audio'], 'audio/mpeg']] as [$f, $mime]) {
            if ($f === '' || !is_file($f)) continue;
            $up = ag_upload($f, $mime, $key);
            if (!$up['ok']) continue;
            $parts[] = ['file_data' => ['mime_type' => $mime, 'file_uri' => $up['uri']]];
        }
        return $parts;
    };
    $uploaded = array_values(array_filter([$media['video'], $media['audio']], 'is_file'));

    // 4. Спрашиваем.
    $rubric = gr_rubric_for((string) ($app['nomination'] ?? ''), (string) ($app['subgroup'] ?? ''));
    $prompt = ag_prompt($app, $rubric);
    $mkBody = static function (array $parts) use ($prompt): array {
        $parts[] = ['text' => $prompt];
        return [
            'contents' => [['role' => 'user', 'parts' => $parts]],
            'generationConfig' => [
                'temperature'      => 0.25,      // оценка должна быть воспроизводимой
                'maxOutputTokens'  => 4096,
                'responseMimeType' => 'application/json',
            ],
        ];
    };
    // ОДНОЙ ПОПЫТКИ МАЛО.
    //
    // Сервис отвечает 429 при исчерпанной квоте ключа и 503 при всплеске спроса,
    // причём и то и другое проходит само. Заявка при этом не должна теряться:
    // перебираем ключи, потом запасные модели, с паузой между попытками. Модели
    // идут по убыванию качества, чтобы в обычной ситуации работала лучшая.
    $models = array_values(array_unique(array_filter([
        ag_model(),
        ...preg_split('~[\s,]+~', (string) (function_exists('setting')
            ? setting('grade_model_fallback', 'gemini-3.5-flash gemini-3.1-flash-lite gemini-3-flash-preview')
            : '')) ?: [],
    ])));
    $raw = ''; $code = 0; $usedModel = ''; $gotFiles = false;
    foreach ($keys as $k2) {
        $parts = $uploadAll($k2);
        if (!$parts) continue;
        $gotFiles = true;
        $body = $mkBody($parts);
        foreach ($models as $mi => $mdl) {
            $ch = curl_init(ag_base() . '/v1beta/models/' . rawurlencode($mdl) . ':generateContent?key=' . rawurlencode($k2));
            curl_setopt_array($ch, [
                CURLOPT_POST => 1, CURLOPT_RETURNTRANSFER => 1, CURLOPT_TIMEOUT => 900,
                CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
                CURLOPT_POSTFIELDS => json_encode($body, JSON_UNESCAPED_UNICODE),
            ]);
            $raw  = (string) curl_exec($ch);
            $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
            curl_close($ch);
            if ($code === 200) { $usedModel = $mdl; break 2; }
            // 429 и 503 проходят сами, остальные коды пробовать повторно незачем.
            if (!in_array($code, [429, 500, 502, 503, 504], true)) break 2;
            sleep(min(20, 3 + $mi * 4));
        }
    }
    if (!$gotFiles) {
        vf_cleanup($dl['path']);
        foreach ($uploaded as $f) @unlink($f);
        return $bad('запись не удалось передать на аттестацию', $runId);
    }
    if ($usedModel !== '' && $usedModel !== ag_model()) {
        try { q("UPDATE grading_runs SET model=? WHERE id=?", [$usedModel, $runId]); } catch (\Throwable $e) {}
    }

    // Временные файлы больше не нужны: запись принадлежит участнику.
    vf_cleanup($dl['path']);
    foreach ($uploaded as $f) @unlink($f);

    if ($code >= 400) {
        $j = json_decode($raw, true);
        return $bad('сервис оценки ответил ошибкой ' . $code . ': ' . mb_substr((string) ($j['error']['message'] ?? ''), 0, 200), $runId);
    }
    $j    = json_decode($raw, true);
    $text = (string) ($j['candidates'][0]['content']['parts'][0]['text'] ?? '');
    $out  = ag_parse_json($text);
    if (!$out || empty($out['criteria'])) return $bad('ответ модели не разобран', $runId);

    // 5. Считаем сами: веса и границы званий — наша сторона, не модели.
    $total = 0.0; $wsum = 0; $scores = [];
    foreach ((array) ($rubric['criteria'] ?? []) as $key2 => $c) {
        $s = (float) ($out['criteria'][$key2]['score'] ?? -1);
        if ($s < 0) continue;
        $s = max(0.0, min(100.0, $s));
        $w = (int) $c['weight'];
        $total += $s * $w;
        $wsum  += $w;
        $scores[$key2] = ['title' => $c['title'], 'weight' => $w, 'score' => $s,
                          'note' => mb_substr((string) ($out['criteria'][$key2]['note'] ?? ''), 0, 900)];
    }
    if ($wsum === 0) return $bad('модель не поставила ни одной оценки', $runId);
    $total = $total / $wsum;

    // ПОПРАВКА ШКАЛЫ ПО СВЕРКЕ С ЖЮРИ.
    //
    // Машина может систематически строжить или мягчить относительно того, как
    // оценивает жюри именно этого центра. Это не ошибка критериев, а разница
    // калибровки, и правится она одним числом: scripts/ai_grade_calibrate.php
    // считает средний сдвиг по уже оценённым работам и записывает поправку.
    // Ноль означает «сверка показала совпадение, поправка не нужна».
    $gain  = (float) (function_exists('setting') ? setting('grade_scale_gain', '1') : 1);
    $shift = (float) (function_exists('setting') ? setting('grade_scale_shift', '0') : 0);
    // Своя поправка номинации сильнее общей: сверка показала, что в разных
    // номинациях машина ошибается в разные стороны, и одно число на всех
    // исправляет одну ценой другой.
    $nomFixAll = json_decode((string) (function_exists('setting') ? setting('grade_scale_by_nomination', '') : ''), true);
    $nomKey = trim((string) ($app['nomination'] ?? ''));
    if (is_array($nomFixAll) && $nomKey !== '' && isset($nomFixAll[$nomKey]['gain'])) {
        $gain  = (float) $nomFixAll[$nomKey]['gain'];
        $shift = (float) $nomFixAll[$nomKey]['shift'];
    }
    if ($gain > 0 && ($gain !== 1.0 || $shift !== 0.0)) $total = $gain * $total + $shift;
    $total = round(max(0.0, min(100.0, $total)), 1);

    // Формальное нарушение снимает вопрос о звании: это отказ, а не оценка.
    $formal = (array) ($out['formal'] ?? []);
    $formalFail = [];
    foreach (gr_formal_checks() as $k => $_) {
        if (array_key_exists($k, $formal) && $formal[$k] === false) $formalFail[] = $k;
    }
    // ЗВАНИЕ ПО ПОРОГАМ СВЕРКИ, ЕСЛИ ОНИ ЗАДАНЫ.
    //
    // Пороги считает scripts/ai_grade_calibrate.php: он раздаёт звания в тех же
    // долях, в каких их даёт жюри центра, а порядок работ остаётся тем, который
    // выстроила машина по критериям. Пока сверки не было, работает общая шкала.
    $titleByScore = static function (float $sc): string {
        $mode = (string) (function_exists('setting') ? setting('grade_scale_mode', 'linear') : 'linear');
        if ($mode === 'quantile') {
            $th = json_decode((string) setting('grade_score_thresholds', ''), true);
            if (is_array($th) && $th) {
                foreach (['ГРАН-ПРИ', 'ЛАУРЕАТ I СТЕПЕНИ', 'ЛАУРЕАТ II СТЕПЕНИ', 'ЛАУРЕАТ III СТЕПЕНИ',
                          'ДИПЛОМАНТ I СТЕПЕНИ', 'ДИПЛОМАНТ II СТЕПЕНИ', 'ДИПЛОМАНТ III СТЕПЕНИ',
                          'УЧАСТНИК КОНКУРСА'] as $t) {
                    if (isset($th[$t]) && $sc >= (float) $th[$t]) return $t;
                }
                return 'УЧАСТНИК КОНКУРСА';
            }
        }
        return gr_title_by_score($sc);
    };
    // ЗВАНИЕ ПРЯМЫМ ВЫБОРОМ.
    //
    // По баллам машина различает работы плохо: почти всё ложится в 76-80, и
    // черта между званиями проходит по разнице в полбалла, которая ничего не
    // значит. Отдельным вопросом «какое звание ты присудила бы» она отвечает
    // увереннее, потому что сравнивает работу с эталонами целиком, а не через
    // сумму весов. Балл остаётся: он объясняет решение и держит порядок работ.
    $lvlRaw   = mb_strtoupper(trim((string) ($out['level'] ?? '')));
    $levels   = ['ГРАН-ПРИ', 'ЛАУРЕАТ I СТЕПЕНИ', 'ЛАУРЕАТ II СТЕПЕНИ', 'ЛАУРЕАТ III СТЕПЕНИ',
                 'ДИПЛОМАНТ I СТЕПЕНИ', 'ДИПЛОМАНТ II СТЕПЕНИ', 'ДИПЛОМАНТ III СТЕПЕНИ', 'УЧАСТНИК КОНКУРСА'];
    $levelPick = in_array($lvlRaw, $levels, true) ? $lvlRaw : '';
    $byScore   = $titleByScore($total);
    // Способ выбора звания задаётся настройкой, потому что решает его не спор о
    // подходе, а сверка с жюри: что показало лучшее совпадение, то и стоит.
    $src = (string) (function_exists('setting') ? setting('grade_title_source', 'score') : 'score');
    $title = $byScore;
    if ($levelPick !== '') {
        if ($src === 'level') {
            $title = $levelPick;
        } elseif ($src === 'mix') {
            // Середина между двумя решениями, при расхождении в пользу строгого:
            // завышенное звание дороже заниженного, его придётся отзывать.
            $ri = array_flip($levels);                 // 0 — высшее
            $m  = (int) ceil((($ri[$byScore] ?? 4) + $ri[$levelPick]) / 2);
            $title = $levels[max(0, min(count($levels) - 1, $m))];
        }
    }
    if ($formalFail) $title = 'ТРЕБУЕТ ПРОВЕРКИ';

    $upd = [
        'status'        => 'ok',
        'formal'        => json_encode($formal, JSON_UNESCAPED_UNICODE),
        'scores'        => json_encode($scores, JSON_UNESCAPED_UNICODE),
        'total'         => $total,
        'title'         => $title,
        'level_guess'   => $levelPick,
        'jury_comment'  => mb_substr(trim((string) ($out['jury_comment'] ?? '')), 0, 4000),
        'internal_note' => mb_substr(trim((string) ($out['internal_note'] ?? '')), 0, 2000),
        'confidence'    => max(0.0, min(1.0, (float) ($out['confidence'] ?? 0))),
        'red_flags'     => json_encode(array_values((array) ($out['red_flags'] ?? [])), JSON_UNESCAPED_UNICODE),
        'seconds'       => round(microtime(true) - $t0, 1),
    ];
    try { update('grading_runs', $upd, 'id=:id', ['id' => $runId]); } catch (\Throwable $e) {}

    return ['ok' => true, 'run_id' => $runId, 'total' => $total, 'title' => $title, 'why' => ''];
}

/**
 * МОЖНО ЛИ ПРИМЕНИТЬ ОЦЕНКУ БЕЗ ЧЕЛОВЕКА.
 *
 * Даже в полностью автоматическом режиме есть случаи, где решение обязан
 * принять человек: формальное нарушение (это отказ и возврат взноса), низкая
 * уверенность модели, тревожные признаки и края шкалы. Гран-при и отказ имеют
 * последствия за пределами одной заявки, и ошибка здесь стоит дороже, чем
 * задержка на день.
 */
function ag_can_apply(array $run): array {
    $minConf = (float) (function_exists('setting') ? setting('grade_min_confidence', '0.75') : 0.75);
    $flags   = (array) json_decode((string) ($run['red_flags'] ?? '[]'), true);
    $formal  = (array) json_decode((string) ($run['formal'] ?? '[]'), true);
    $title   = (string) ($run['title'] ?? '');

    foreach (gr_formal_checks() as $k => $_) {
        if (array_key_exists($k, $formal) && $formal[$k] === false) {
            return [false, 'формальное несоответствие положению (' . $k . ') — решает человек'];
        }
    }
    if ($flags)                                   return [false, 'есть тревожные признаки: ' . mb_substr(implode('; ', $flags), 0, 200)];
    if ((float) ($run['confidence'] ?? 0) < $minConf) return [false, 'низкая уверенность оценки'];
    if ($title === 'ГРАН-ПРИ')                    return [false, 'Гран-при подтверждает человек'];
    if ($title === 'УЧАСТНИК КОНКУРСА')           return [false, 'работа без звания — решает человек'];
    if ($title === 'ТРЕБУЕТ ПРОВЕРКИ')            return [false, 'работа отмечена для проверки'];
    return [true, ''];
}
