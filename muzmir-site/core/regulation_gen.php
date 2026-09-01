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
 * Сумма прописью в родительном падеже — «одна тысяча рублей», «пятьсот рублей».
 *
 * В положении сумма стоит и цифрой, и прописью в скобках: «1000 ₽ (одна тысяча
 * рублей)». Прописью пишется потому, что так принято в документе, по которому
 * участник платит, — цифру можно прочитать неверно, слово нельзя.
 *
 * Оргвзносы у центра круглые (500, 1000, 1500), поэтому обрабатываем сотни и
 * тысячи; на нестандартной сумме честно возвращаем пустую строку, и тогда
 * прописи в скобках просто не будет — лучше без неё, чем с неверной.
 */
function reg_rub_words(int $n): string {
    if ($n <= 0 || $n >= 1000000) return '';
    $hundreds = ['', 'сто', 'двести', 'триста', 'четыреста', 'пятьсот',
                 'шестьсот', 'семьсот', 'восемьсот', 'девятьсот'];
    $tens     = ['', 'десять', 'двадцать', 'тридцать', 'сорок', 'пятьдесят',
                 'шестьдесят', 'семьдесят', 'восемьдесят', 'девяносто'];
    $ones     = ['', 'один', 'два', 'три', 'четыре', 'пять', 'шесть', 'семь', 'восемь', 'девять'];
    $onesF    = ['', 'одна', 'две', 'три', 'четыре', 'пять', 'шесть', 'семь', 'восемь', 'девять'];
    $teens    = ['десять', 'одиннадцать', 'двенадцать', 'тринадцать', 'четырнадцать',
                 'пятнадцать', 'шестнадцать', 'семнадцать', 'восемнадцать', 'девятнадцать'];

    $trio = static function (int $v, bool $female) use ($hundreds, $tens, $ones, $onesF, $teens): string {
        $out = [];
        $h = intdiv($v, 100); $r = $v % 100;
        if ($h) $out[] = $hundreds[$h];
        if ($r >= 10 && $r <= 19) { $out[] = $teens[$r - 10]; }
        else {
            $t = intdiv($r, 10); $o = $r % 10;
            if ($t) $out[] = $tens[$t];
            if ($o) $out[] = $female ? $onesF[$o] : $ones[$o];
        }
        return implode(' ', array_filter($out));
    };

    $th = intdiv($n, 1000); $rest = $n % 1000;
    $parts = [];
    if ($th) {
        $t100 = $th % 100; $t10 = $th % 10;
        $word = ($t100 >= 11 && $t100 <= 14) ? 'тысяч'
              : ($t10 === 1 ? 'тысяча' : ($t10 >= 2 && $t10 <= 4 ? 'тысячи' : 'тысяч'));
        $parts[] = trim($trio($th, true) . ' ' . $word);
    }
    if ($rest) $parts[] = $trio($rest, false);

    $r100 = $n % 100; $r10 = $n % 10;
    $rub = ($r100 >= 11 && $r100 <= 14) ? 'рублей'
         : ($r10 === 1 ? 'рубль' : ($r10 >= 2 && $r10 <= 4 ? 'рубля' : 'рублей'));
    return trim(implode(' ', $parts) . ' ' . $rub);
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
    /* КОНКУРС КЛУБА ИДЁТ ПО СВОЕМУ ЭТАЛОНУ.
     *
     * Он бесплатный, но не для всех: участвовать могут только участники Клуба,
     * и у серии есть годовой призовой фонд, которого нет ни в одном другом
     * конкурсе. Бесплатный эталон этого не говорит, а дописывать условия
     * вручную каждый месяц — верный способ однажды забыть. Эталон собирается
     * скриптом scripts/build_etalon_club.php из бесплатного. */
    $clubOnly = (int) ($c['club_only'] ?? 0) === 1;
    $file = $clubOnly ? 'etalon_5.docx' : ($isPaid ? 'etalon_2.docx' : 'etalon_4.docx');
    $etalon = BASE_PATH . '/docs/polozheniya/' . $file;
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

    // ДАТА УТВЕРЖДЕНИЯ в шапке («УТВЕРЖДАЮ … Ильясов А.И. <дата> год»).
    // Правило владельца: всегда ПЕРВОЕ число месяца, в котором конкурс запущен.
    // Раньше сюда попадала дата прямо из эталона (11.05.2026) — она и была «неверной
    // датой в шапке» на всех положениях.
    $approveBase = trim((string) ($c['launched_at'] ?? '')) !== '' ? (string) $c['launched_at']
                 : (trim((string) ($c['start_date'] ?? '')) !== '' ? (string) $c['start_date'] : 'now');
    $approveTs   = strtotime($approveBase) ?: time();
    $approveDate = date('01.m.Y', $approveTs);          // всегда 01 число месяца запуска

    /* ССЫЛКА НА ОБРАЗЦЫ И ЗАКАЗ — СРАЗУ НА СВОЙ КОНКУРС.
       В эталоне стоит общий адрес витрины наград; участник попадал на список
       конкурсов и искал свой. Подставляем прямую страницу конкурса. */
    $awardsUrl = 'https://музыкальный-мир.рф/awards?comp=' . $competitionId;
    $xml = str_replace('https://музыкальный-мир.рф/awards', $awardsUrl, $xml);

    $nameHits = 0; $dateHits = 0; $misc = 0;
    if ($isPaid) {
        // etalon_2 «ЭВРИКА»: тематика уже «СВОБОДНАЯ», в титуле «Международный».
        $xml = reg_run_replace_exact($xml, 'ЭВРИКА', $nameUp, $nameHits);
        if ($isNational) $xml = reg_run_replace_exact($xml, 'Международный ', 'Всероссийский ', $misc);
        if ($endDate !== '') $xml = reg_para_text_replace($xml, 'Приём заявок', '25.06.2026', $endDate, $dateHits);

        // ОРГВЗНОС — ИЗ БАЗЫ, А НЕ ИЗ ЭТАЛОНА.
        //
        // В эталоне сумма зашита как «500 ₽ (пятьсот рублей)» и раньше не менялась.
        // Владелец поднял цену «Мировых Талантов» до 1000 ₽ в админке — и получилось,
        // что на сайте одна цена, а в положении, которое участник скачивает и по
        // которому платит, другая. Для конкурса это расхождение в документе, на
        // который он же и ссылается.
        //
        // Сумма встречается дважды: в шапке титульного листа («Орг. взнос — 500 ₽»)
        // и в разделе о стоимости («в данном конкурсе: 500₽»). Пишется и цифрой, и
        // прописью, с пробелом перед ₽ и без — заменяем все написания.
        $price = (int) ($c['price'] ?? 0);
        if ($price > 0 && $price !== 500) {
            // Разряды разделяем ПРОБЕЛОМ — «1 000 ₽», как принято в русских
            // документах. Точка в этой роли читается как десятичная: «1.000» можно
            // понять и как одну целую, а сумма в положении спорной быть не должна.
            // Пропись в скобках снимает любые сомнения окончательно.
            $num   = number_format($price, 0, ',', ' ');
            $words = reg_rub_words($price);
            $priceHits = 0;
            foreach (['500 ₽ (пятьсот рублей)', '500₽ (пятьсот рублей)'] as $old) {
                $sep = mb_strpos($old, '₽') === 3 ? '' : ' ';
                $new = $num . $sep . '₽ (' . $words . ')';
                $xml = reg_para_text_replace($xml, '500', $old, $new, $priceHits);
            }
            $misc += $priceHits;
        }
    } else {
        // etalon_4 «СЛАВА РОССИИ»: в титуле «Всероссийский», тематика патриотическая.
        $xml = reg_run_replace_exact($xml, 'СЛАВА РОССИИ', $nameUp, $nameHits);
        if (!$isNational) $xml = reg_run_replace_exact($xml, 'Всероссийский ', 'Международный ', $misc);
        if ($endDate !== '') $xml = reg_para_text_replace($xml, 'Приём заявок', '07.06.2026', $endDate, $dateHits);
        if ($resDate !== '') $xml = reg_para_text_replace($xml, 'зультаты', '10.06.2026', $resDate, $dateHits);
        $xml = reg_run_replace_exact($xml, 'ПАТРИОТИЧЕСКАЯ (В СООТВЕТСТВИИ С НАЗВАНИЕМ КОНКУРСА)', 'СВОБОДНАЯ', $misc);
    }

    // Дата утверждения в шапке — во всех эталонах строка «11.05.2026». В DOCX она
    // склеена с соседним текстом («11.05.2026 год») и разбита по ранам, поэтому
    // точное сравнение рана не срабатывает — заменяем на уровне абзаца.
    $approveHits = 0;
    $xml = reg_para_text_replace($xml, '11.05.2026', '11.05.2026', $approveDate, $approveHits);

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
