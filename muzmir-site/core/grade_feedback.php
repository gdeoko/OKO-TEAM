<?php
/**
 * ОБУЧЕНИЕ НА ПРАВКАХ ЖЮРИ.
 *
 * Подсказка предлагает звание, человек ставит своё. Пока эти два решения нигде
 * не сравнивались, машина повторяла одну и ту же ошибку сколько угодно раз: она
 * не знала, что по вокалу центр систематически ставит на ступень ниже, а по
 * изобразительному — наоборот.
 *
 * Здесь каждое расхождение записывается, и из накопленных расхождений считается
 * поправка: на сколько ступеней жюри обычно строже или мягче машины. Поправка
 * применяется к следующим оценкам, а последние правки уходят в промпт примерами
 * — чтобы модель видела не только сдвиг, но и его причину.
 *
 * ЧТО ТУТ НАМЕРЕННО СДЕЛАНО ОСТОРОЖНО:
 *   • поправка включается только на статистике (по номинации от 5 правок, общая
 *     от 15): одна правка — это мнение об одной работе, а не правило;
 *   • берётся МЕДИАНА, а не среднее: один спорный случай не должен утащить
 *     оценку всем остальным;
 *   • сдвиг ограничен двумя ступенями — дальше это уже не калибровка, а замена
 *     решения машины решением задним числом;
 *   • совпадения тоже записываются: без них статистика показывала бы только
 *     ошибки и поправка росла бы бесконечно.
 */
declare(strict_types=1);

/** Лестница званий: 0 — высшее. */
function gfb_levels(): array {
    return ['ГРАН-ПРИ', 'ЛАУРЕАТ I СТЕПЕНИ', 'ЛАУРЕАТ II СТЕПЕНИ', 'ЛАУРЕАТ III СТЕПЕНИ',
            'ДИПЛОМАНТ I СТЕПЕНИ', 'ДИПЛОМАНТ II СТЕПЕНИ', 'ДИПЛОМАНТ III СТЕПЕНИ', 'УЧАСТНИК КОНКУРСА'];
}

function gfb_migrate(): void {
    static $done = false;
    if ($done) return;
    $done = true;
    try {
        db()->exec("CREATE TABLE IF NOT EXISTS grade_feedback (
            id             INTEGER PRIMARY KEY AUTOINCREMENT,
            application_id INTEGER NOT NULL,
            run_id         INTEGER DEFAULT 0,
            nomination     TEXT DEFAULT '',
            ai_title       TEXT DEFAULT '',
            ai_total       REAL DEFAULT 0,
            human_title    TEXT DEFAULT '',
            steps          INTEGER DEFAULT 0,   -- >0: жюри строже машины
            created_at     TEXT DEFAULT (datetime('now','localtime')))");
        db()->exec("CREATE INDEX IF NOT EXISTS idx_gfb_nom ON grade_feedback(nomination)");
        db()->exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_gfb_app ON grade_feedback(application_id)");
    } catch (\Throwable $e) { /* таблица уже есть */ }
    // Разбор расхождения: чему научились на конкретной работе.
    foreach ([['lesson', "TEXT DEFAULT ''"], ['lesson_at', "TEXT DEFAULT ''"]] as [$col, $type]) {
        try { db()->exec("ALTER TABLE grade_feedback ADD COLUMN $col $type"); }
        catch (\Throwable $e) { /* колонка уже есть */ }
    }
}

/**
 * ПЕРЕСМОТР ЗАПИСИ ПОСЛЕ ПРАВКИ ЖЮРИ.
 *
 * Совпало — учиться нечему: машина и человек увидели одно и то же. А вот когда
 * звания разошлись, статистики мало: «ставь на ступень ниже» не объясняет, ЧТО
 * именно было переоценено, и в следующей работе ошибка повторится в другом месте.
 *
 * Поэтому при расхождении запись пересматривается заново — с уже известным
 * решением жюри как эталоном. Модель смотрит тот же номер и отвечает на один
 * вопрос: что она упустила или чему придала лишний вес. Ответ сохраняется как
 * урок и дальше идёт в задание при оценке работ той же номинации.
 *
 * Разбор долгий (минуты), поэтому вызывается фоном: сохранение итога в админке
 * его не ждёт.
 */
function gfb_learn(int $appId): array {
    gfb_migrate();
    $fb = one("SELECT * FROM grade_feedback WHERE application_id=?", [$appId]);
    if (!$fb) return ['ok' => false, 'why' => 'правка не найдена'];
    if ((int) $fb['steps'] === 0) return ['ok' => false, 'why' => 'решения совпали, разбирать нечего'];
    if (trim((string) ($fb['lesson'] ?? '')) !== '') return ['ok' => true, 'why' => 'урок уже разобран'];

    require_once BASE_PATH . '/core/ai_grader.php';
    ag_migrate();
    $app = one("SELECT a.*, c.name AS comp_name FROM applications a
                 LEFT JOIN competitions c ON c.id=a.competition_id WHERE a.id=?", [$appId]);
    if (!$app) return ['ok' => false, 'why' => 'заявка не найдена'];
    $url = trim((string) ($app['video_url'] ?? ''));
    if ($url === '') return ['ok' => false, 'why' => 'нет ссылки на работу'];
    $keys = ag_keys();
    if (!$keys) return ['ok' => false, 'why' => 'не настроен доступ к модели'];

    $dl = vf_download($url, $appId);
    if (!$dl['ok']) return ['ok' => false, 'why' => 'запись не получена: ' . $dl['why']];
    $media = ag_prepare_media($dl['path']);
    if (!$media['ok']) { vf_cleanup($dl['path']); return ['ok' => false, 'why' => $media['why']]; }

    $run = one("SELECT * FROM grading_runs WHERE id=?", [(int) $fb['run_id']]);
    $harder = (int) $fb['steps'] > 0;   // жюри поставило ниже

    $ask = "Ты аттестуешь конкурсные работы для этого центра.\n\n"
         . "По этой работе твоя оценка и решение жюри РАЗОШЛИСЬ.\n"
         . "  Номинация: " . (string) ($app['nomination'] ?? '') . "\n"
         . "  Ты предложила: " . (string) $fb['ai_title'] . " (" . number_format((float) $fb['ai_total'], 1, '.', '') . " балла)\n"
         . "  Жюри поставило: " . (string) $fb['human_title'] . " — то есть " . ($harder ? 'СТРОЖЕ' : 'МЯГЧЕ') . " твоей оценки.\n"
         . (trim((string) ($run['internal_note'] ?? '')) !== ''
              ? "  Твоё прежнее обоснование: " . mb_substr((string) $run['internal_note'], 0, 900) . "\n" : '')
         . "\nПосмотри запись заново, зная решение жюри. Ответь ТОЛЬКО JSON:\n"
         . "{\n"
         . '  "missed": "что конкретно в этой работе ты ' . ($harder ? 'переоценила' : 'недооценила') . '" (1-2 предложения, по существу: техника, интонация, ритм, ансамбль, артистизм, соответствие номинации),' . "\n"
         . '  "rule": "правило на будущее для номинации ' . (string) ($app['nomination'] ?? '') . '" (одно предложение, проверяемое, без общих слов вроде «быть внимательнее»),' . "\n"
         . '  "agree": true или false — согласна ли ты с решением жюри после пересмотра' . "\n"
         . "}\n"
         . "Не оправдывайся и не пересказывай номер. Нужен разбор собственной ошибки.";

    $raw = ''; $code = 0;
    foreach ($keys as $key) {
        $parts = [];
        foreach ([[$media['video'], 'video/mp4'], [$media['audio'], 'audio/mpeg']] as [$f, $mime]) {
            if ($f === '' || !is_file($f)) continue;
            $up = ag_upload($f, $mime, $key);
            if ($up['ok']) $parts[] = ['file_data' => ['mime_type' => $mime, 'file_uri' => $up['uri']]];
        }
        if (!$parts) continue;
        $parts[] = ['text' => $ask];
        $body = ['contents' => [['role' => 'user', 'parts' => $parts]],
                 'generationConfig' => ['temperature' => 0.2, 'maxOutputTokens' => 900,
                                        'responseMimeType' => 'application/json']];
        $ch = curl_init(ag_base() . '/v1beta/models/' . rawurlencode(ag_model()) . ':generateContent?key=' . rawurlencode($key));
        curl_setopt_array($ch, [
            CURLOPT_POST => 1, CURLOPT_RETURNTRANSFER => 1, CURLOPT_TIMEOUT => 600,
            CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
            CURLOPT_POSTFIELDS => json_encode($body, JSON_UNESCAPED_UNICODE),
        ]);
        $raw  = (string) curl_exec($ch);
        $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        if ($code === 200) break;
    }
    vf_cleanup($dl['path']);
    foreach ([$media['video'], $media['audio']] as $f) if ($f !== '' && is_file($f)) @unlink($f);
    if ($code !== 200) return ['ok' => false, 'why' => 'модель не ответила (код ' . $code . ')'];

    $j = json_decode($raw, true);
    $txt = (string) ($j['candidates'][0]['content']['parts'][0]['text'] ?? '');
    $out = json_decode(trim(preg_replace('~^```(?:json)?|```$~m', '', $txt)), true);
    if (!is_array($out)) return ['ok' => false, 'why' => 'ответ модели не разобран'];

    $lesson = trim((string) ($out['missed'] ?? ''));
    $rule   = trim((string) ($out['rule'] ?? ''));
    $full   = trim($lesson . ($rule !== '' ? ' Правило: ' . $rule : ''));
    if ($full === '') return ['ok' => false, 'why' => 'разбор пустой'];

    q("UPDATE grade_feedback SET lesson=?, lesson_at=? WHERE application_id=?",
      [mb_substr($full, 0, 700), date('Y-m-d H:i:s'), $appId]);
    return ['ok' => true, 'why' => $full];
}

/** Запустить пересмотр в фоне: админка не должна ждать разбор записи. */
function gfb_learn_async(int $appId): void {
    if ($appId <= 0) return;
    $cmd = 'setsid nohup php ' . escapeshellarg(BASE_PATH . '/cron/grade_learn.php')
         . ' --app=' . (int) $appId
         . ' >> ' . escapeshellarg(BASE_PATH . '/data/logs/cron.log') . ' 2>&1 & disown';
    @exec($cmd);
}

/**
 * Записать решение жюри рядом с предложением машины.
 *
 * Вызывается при каждом сохранении итога человеком. Если разбора не было, писать
 * нечего: сравнивать не с чем.
 */
function gfb_record(int $appId, string $humanTitle, string $nomination = ''): void {
    if ($appId <= 0 || trim($humanTitle) === '') return;
    gfb_migrate();
    try {
        $run = one("SELECT id, title, total FROM grading_runs
                     WHERE application_id=? AND status='ok' ORDER BY id DESC LIMIT 1", [$appId]);
        if (!$run) return;
        $levels = gfb_levels();
        $ai = array_search((string) $run['title'], $levels, true);
        $hu = array_search($humanTitle, $levels, true);
        if ($ai === false || $hu === false) return;

        if ($nomination === '') {
            $nomination = (string) (scalar("SELECT nomination FROM applications WHERE id=?", [$appId]) ?? '');
        }
        // Одна запись на заявку: правку могут сохранять несколько раз подряд, и
        // каждое сохранение засчиталось бы как отдельное наблюдение.
        q("DELETE FROM grade_feedback WHERE application_id=?", [$appId]);
        insert('grade_feedback', [
            'application_id' => $appId,
            'run_id'      => (int) $run['id'],
            'nomination'  => trim($nomination),
            'ai_title'    => (string) $run['title'],
            'ai_total'    => (float) $run['total'],
            'human_title' => $humanTitle,
            'steps'       => $hu - $ai,          // + жюри строже, − мягче
        ]);
    } catch (\Throwable $e) { /* обучение не важнее сохранения итога */ }
}

/**
 * Поправка по накопленным правкам.
 *
 * @return array{steps:int,n:int,scope:string} steps — на сколько ступеней сдвинуть
 *         предложение машины (положительное значение = понизить звание).
 */
function gfb_bias(string $nomination = ''): array {
    static $cache = [];
    $key = mb_strtolower(trim($nomination));
    if (isset($cache[$key])) return $cache[$key];
    gfb_migrate();

    $median = static function (array $v): float {
        if (!$v) return 0.0;
        sort($v);
        $n = count($v);
        return $n % 2 ? (float) $v[intdiv($n, 2)] : ((float) $v[$n / 2 - 1] + (float) $v[$n / 2]) / 2;
    };
    $take = static function (string $sql, array $args): array {
        try { return array_map(static fn($r) => (int) $r['steps'], all($sql, $args)); }
        catch (\Throwable $e) { return []; }
    };

    // Свежие правки весомее давних: берём последние две сотни наблюдений.
    $res = ['steps' => 0, 'n' => 0, 'scope' => 'нет данных'];
    if ($key !== '') {
        // SQLite lower() кириллицу не трогает, поэтому сравнение по номинации
        // не срабатывало никогда: «Вокальное искусство» не равно «вокальное
        // искусство». В проекте для этого зарегистрирована mb_lower.
        $own = $take("SELECT steps FROM grade_feedback WHERE mb_lower(COALESCE(nomination,''))=?
                       ORDER BY id DESC LIMIT 200", [$key]);
        if (count($own) >= 5) {
            $res = ['steps' => (int) round($median($own)), 'n' => count($own), 'scope' => 'по номинации'];
            return $cache[$key] = gfb_clamp($res);
        }
    }
    $all = $take("SELECT steps FROM grade_feedback ORDER BY id DESC LIMIT 200", []);
    if (count($all) >= 15) {
        $res = ['steps' => (int) round($median($all)), 'n' => count($all), 'scope' => 'по всем номинациям'];
    }
    return $cache[$key] = gfb_clamp($res);
}

/** Сдвиг больше двух ступеней — это уже не калибровка. */
function gfb_clamp(array $b): array {
    $b['steps'] = max(-2, min(2, (int) $b['steps']));
    return $b;
}

/** Сдвинуть звание на N ступеней вниз (N>0) или вверх (N<0). */
function gfb_shift_title(string $title, int $steps): string {
    if ($steps === 0) return $title;
    $levels = gfb_levels();
    $i = array_search($title, $levels, true);
    if ($i === false) return $title;
    return $levels[max(0, min(count($levels) - 1, $i + $steps))];
}

/**
 * Последние правки словами — для промпта.
 *
 * Модель видит не только «понизь на ступень», но и что именно центр считает
 * переоценённым: это влияет на разбор, а не только на итоговую цифру.
 */
function gfb_prompt_hint(string $nomination = ''): string {
    gfb_migrate();
    $bias = gfb_bias($nomination);
    if ($bias['n'] < 5) return '';

    $rows = [];
    try {
        $rows = $nomination !== ''
            ? all("SELECT ai_title, human_title FROM grade_feedback
                    WHERE mb_lower(COALESCE(nomination,''))=? AND steps <> 0 ORDER BY id DESC LIMIT 6",
                  [mb_strtolower(trim($nomination))])
            : all("SELECT ai_title, human_title FROM grade_feedback
                    WHERE steps <> 0 ORDER BY id DESC LIMIT 6", []);
    } catch (\Throwable $e) { $rows = []; }

    $dir = $bias['steps'] > 0 ? 'СТРОЖЕ' : ($bias['steps'] < 0 ? 'МЯГЧЕ' : 'так же');
    $out = "\n\nКАК СУДИТ ЖЮРИ ЭТОГО ЦЕНТРА (по " . (int) $bias['n'] . " решениям, " . $bias['scope'] . ").\n"
         . "Жюри в среднем " . $dir . " автоматической оценки"
         . ($bias['steps'] !== 0 ? ' примерно на ' . abs($bias['steps']) . ' ступень звания' : '') . ".";
    if ($rows) {
        $out .= "\nПоследние расхождения (предложено → поставлено жюри):";
        foreach ($rows as $r) $out .= "\n  • " . (string) $r['ai_title'] . ' → ' . (string) $r['human_title'];
    }

    /* РАЗБОРЫ СОБСТВЕННЫХ ОШИБОК.
     *
     * Сдвиг в ступенях говорит «куда», а уроки — «почему»: их модель написала
     * сама, пересмотрев запись уже с известным решением жюри. Это и отличает
     * обучение от простой калибровки: в следующей работе она проверит ровно то,
     * что упустила в прошлой. */
    $lessons = [];
    try {
        $lessons = $nomination !== ''
            ? all("SELECT lesson FROM grade_feedback WHERE mb_lower(COALESCE(nomination,''))=? AND COALESCE(lesson,'')<>''
                    ORDER BY id DESC LIMIT 5", [mb_strtolower(trim($nomination))])
            : all("SELECT lesson FROM grade_feedback WHERE COALESCE(lesson,'')<>''
                    ORDER BY id DESC LIMIT 5", []);
    } catch (\Throwable $e) { $lessons = []; }
    if ($lessons) {
        $out .= "\n\nРАЗБОР ТВОИХ ПРЕЖНИХ ОШИБОК НА ЭТИХ РАБОТАХ (ты написала их сама, пересмотрев записи):";
        foreach ($lessons as $l) $out .= "\n  • " . trim((string) $l['lesson']);
        $out .= "\nПроверь в этой работе то же самое, прежде чем назначать звание.";
    }

    $out .= "\nУчитывай это при выборе звания: ориентир — решения этого жюри, а не средняя практика.";
    return $out;
}

/** Сводка для админки. */
function gfb_stats(): array {
    gfb_migrate();
    try {
        $n     = (int) (scalar("SELECT COUNT(*) FROM grade_feedback") ?? 0);
        $same  = (int) (scalar("SELECT COUNT(*) FROM grade_feedback WHERE steps=0") ?? 0);
        $up    = (int) (scalar("SELECT COUNT(*) FROM grade_feedback WHERE steps<0") ?? 0);
        $down  = (int) (scalar("SELECT COUNT(*) FROM grade_feedback WHERE steps>0") ?? 0);
    } catch (\Throwable $e) { return ['n' => 0, 'same' => 0, 'up' => 0, 'down' => 0, 'bias' => gfb_bias()]; }
    return ['n' => $n, 'same' => $same, 'up' => $up, 'down' => $down, 'bias' => gfb_bias()];
}
