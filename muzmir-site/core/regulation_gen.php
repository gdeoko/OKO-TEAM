<?php
/**
 * core/regulation_gen.php — автогенерация ПОЛОЖЕНИЯ конкурса (DOCX) из эталонов.
 *
 * regulation_generate(int $competitionId): string — путь к готовому .docx
 *
 * Эталоны (docs/polozheniya/, утверждены владельцем):
 *   - платный конкурс   -> etalon_2.docx («ЭВРИКА», оргвзнос 500 ₽, тематика СВОБОДНАЯ)
 *   - бесплатный конкурс -> etalon_4.docx («СЛАВА РОССИИ», участие бесплатное)
 *
 * Правило владельца: документ 1:1 копия эталона, меняются ТОЛЬКО:
 *   - название конкурса (титульная строка, ВЕРХНИМ регистром как в эталоне);
 *   - слово «Международный/Всероссийский» в титуле — по типу конкурса;
 *   - дата окончания приёма заявок (end_date, формат ДД.ММ.ГГГГ как в эталоне);
 *   - дата публикации результатов (results_date, только в бесплатном эталоне);
 *   - тематика -> «СВОБОДНАЯ» (в платном эталоне уже такая).
 * Шапка, реквизиты, весь остальной текст НЕ трогаются.
 *
 * Техника: даты в эталоне разорваны на несколько <w:r>-ранов (rsid-правки Word),
 * поэтому замена дат идёт на уровне абзаца: склеиваем текст всех <w:t> абзаца,
 * заменяем подстроку и записываем результат в первый <w:t> (форматирование ранов
 * в этих абзацах одинаковое — титульный лист). Название/тематика лежат целиком
 * в одном <w:t> — заменяются точным совпадением содержимого рана.
 * Всё XML-экранируется, теги не задеваются.
 */
declare(strict_types=1);

/** XML-экранирование текста для вставки внутрь <w:t>. */
function reg_xml_esc(string $s): string {
    return htmlspecialchars($s, ENT_XML1 | ENT_COMPAT, 'UTF-8');
}

/** Декодирование сущностей из содержимого <w:t>. */
function reg_xml_decode(string $s): string {
    return html_entity_decode($s, ENT_QUOTES | ENT_XML1, 'UTF-8');
}

/**
 * Замена по точному совпадению содержимого одного <w:t>...</w:t>.
 * Безопасно: меняется только текст внутри существующего тега.
 */
function reg_run_replace_exact(string $xml, string $search, string $replace, int &$hits): string {
    return (string) preg_replace_callback('~<w:t[^>]*>([^<]*)</w:t>~su',
        function (array $m) use ($search, $replace, &$hits): string {
            if (reg_xml_decode($m[1]) !== $search) return $m[0];
            $hits++;
            return '<w:t xml:space="preserve">' . reg_xml_esc($replace) . '</w:t>';
        }, $xml);
}

/**
 * Замена подстроки в тексте абзаца (склейка всех <w:t> абзаца).
 * Применяется только к абзацам, содержащим $needle (якорь) и $search.
 * Новый текст пишется в первый <w:t>, остальные <w:t> абзаца очищаются
 * (используется для строк титульного листа с однородным форматированием).
 */
function reg_para_text_replace(string $xml, string $needle, string $search, string $replace, int &$hits): string {
    return (string) preg_replace_callback('~<w:p\b[^>]*>.*?</w:p>~su',
        function (array $m) use ($needle, $search, $replace, &$hits): string {
            $p = $m[0];
            if (!preg_match_all('~<w:t[^>]*>([^<]*)</w:t>~su', $p, $tm)) return $p;
            $joined = reg_xml_decode(implode('', $tm[1]));
            if (mb_strpos($joined, $needle) === false || mb_strpos($joined, $search) === false) return $p;
            $new = str_replace($search, $replace, $joined);
            $hits++;
            $first = true;
            return (string) preg_replace_callback('~<w:t[^>]*>[^<]*</w:t>~su',
                function () use (&$first, $new): string {
                    if ($first) {
                        $first = false;
                        return '<w:t xml:space="preserve">' . reg_xml_esc($new) . '</w:t>';
                    }
                    return '<w:t xml:space="preserve"></w:t>';
                }, $p);
        }, $xml);
}

/**
 * Генерация положения-DOCX для конкурса по эталону.
 * Сохраняет в public/uploads/regulations/{slug}.docx, пишет путь
 * в competitions.regulation_pdf и возвращает абсолютный путь к файлу.
 */
function regulation_generate(int $competitionId): string {
    $c = one("SELECT * FROM competitions WHERE id=?", [$competitionId]);
    if (!$c) throw new \RuntimeException('Конкурс #' . $competitionId . ' не найден');

    $isPaid = (int) ($c['is_paid'] ?? 0) === 1;
    $etalon = BASE_PATH . '/docs/polozheniya/' . ($isPaid ? 'etalon_2.docx' : 'etalon_4.docx');
    if (!is_file($etalon)) throw new \RuntimeException('Эталон положения не найден: ' . basename($etalon));
    // Частая причина сбоя copy(): эталон залит с правами 600 (root-only) и недоступен
    // php-fpm (www-data) для чтения. Пробуем самолечение, иначе — понятная ошибка про ИСТОЧНИК.
    if (!is_readable($etalon)) {
        @chmod($etalon, 0644);
        clearstatcache(true, $etalon);
        if (!is_readable($etalon)) {
            throw new \RuntimeException('Эталон недоступен для чтения: ' . basename($etalon)
                . ' — выставьте права 644 (chmod 644 docs/polozheniya/*.docx)');
        }
    }

    $slug = trim((string) ($c['slug'] ?? ''));
    if ($slug === '') $slug = 'competition-' . $competitionId;

    $dir = BASE_PATH . '/public/uploads/regulations';
    if (!is_dir($dir) && !@mkdir($dir, 0775, true) && !is_dir($dir)) {
        throw new \RuntimeException('Не удалось создать каталог ' . $dir);
    }
    $dest = $dir . '/' . $slug . '.docx';
    if (!@copy($etalon, $dest)) throw new \RuntimeException('Не удалось скопировать эталон в ' . $dest);
    @chmod($dest, 0664);

    $zip = new \ZipArchive();
    if ($zip->open($dest) !== true) throw new \RuntimeException('Не удалось открыть DOCX: ' . $dest);
    $xml = $zip->getFromName('word/document.xml');
    if ($xml === false || $xml === '') { $zip->close(); throw new \RuntimeException('В DOCX нет word/document.xml'); }

    $fmt = static function (?string $d): string {
        $d = trim((string) $d);
        if ($d === '') return '';
        $ts = strtotime($d);
        return $ts ? date('d.m.Y', $ts) : '';
    };
    $nameUp  = mb_strtoupper(trim((string) ($c['name'] ?? '')));
    $endDate = $fmt($c['end_date'] ?? null);
    $resDate = $fmt(($c['results_date'] ?? null) ?: ($c['end_date'] ?? null));
    $isNational = (($c['type'] ?? 'international') === 'national');

    $nameHits = 0; $dateHits = 0; $misc = 0;
    if ($isPaid) {
        // etalon_2 «ЭВРИКА»: тематика уже «СВОБОДНАЯ», в титуле «Международный».
        $xml = reg_run_replace_exact($xml, 'ЭВРИКА', $nameUp, $nameHits);
        if ($isNational) $xml = reg_run_replace_exact($xml, 'Международный ', 'Всероссийский ', $misc);
        if ($endDate !== '') $xml = reg_para_text_replace($xml, 'Приём заявок', '25.06.2026', $endDate, $dateHits);
    } else {
        // etalon_4 «СЛАВА РОССИИ»: в титуле «Всероссийский», тематика патриотическая.
        $xml = reg_run_replace_exact($xml, 'СЛАВА РОССИИ', $nameUp, $nameHits);
        if (!$isNational) $xml = reg_run_replace_exact($xml, 'Всероссийский ', 'Международный ', $misc);
        if ($endDate !== '') $xml = reg_para_text_replace($xml, 'Приём заявок', '07.06.2026', $endDate, $dateHits);
        if ($resDate !== '') $xml = reg_para_text_replace($xml, 'зультаты', '10.06.2026', $resDate, $dateHits);
        $xml = reg_run_replace_exact($xml, 'ПАТРИОТИЧЕСКАЯ (В СООТВЕТСТВИИ С НАЗВАНИЕМ КОНКУРСА)', 'СВОБОДНАЯ', $misc);
    }

    if ($nameUp !== '' && $nameHits === 0) {
        $zip->close(); @unlink($dest);
        throw new \RuntimeException('Название конкурса из эталона не найдено (эталон изменился?)');
    }

    if (!$zip->addFromString('word/document.xml', $xml)) {
        $zip->close();
        throw new \RuntimeException('Не удалось записать word/document.xml');
    }
    $zip->close();

    update('competitions', ['regulation_pdf' => $dest], 'id=:wid', ['wid' => $competitionId]);
    return $dest;
}
