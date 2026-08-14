<?php
/**
 * ДАТЫ ПИСЕМ ПОДДЕРЖКИ — ЧИТАЕМ С САМИХ СКАНОВ.
 *
 * В галерее «Поддержка» 120 писем, и у всех колонка letter_date пустая: их
 * загружали руками, датой никто не занимался. Страница честно пробует
 * сортировать по дате, не находит ни одной и раскладывает письма как попало —
 * по порядку загрузки. Со стороны это выглядит случайной кучей, хотя письма
 * приходили годами и порядок у них есть.
 *
 * Даты берём оттуда же, где они и стоят: с исходящего штампа письма («от
 * 12.03.2026 № 01-05/123»). Скан отправляется в Gemini Vision, ответом
 * забирается одна строка с датой. Ничего не выдумываем: если даты на бланке нет
 * или разобрать не удалось, поле остаётся пустым, и письмо просто встаёт в конец.
 *
 * Работает частями и продолжает с того места, где остановился: обрабатываются
 * только письма без даты. Платные ключи не трогаются — при исчерпании
 * бесплатной квоты скрипт останавливается и говорит об этом.
 *
 *   php scripts/date_ministry_letters.php            — проставить недостающие
 *   php scripts/date_ministry_letters.php dry        — только показать, что прочитается
 *   php scripts/date_ministry_letters.php limit 20   — обработать не больше 20 писем
 *   php scripts/date_ministry_letters.php nogem      — только свой OCR, без обращений к Gemini
 */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { fwrite(STDERR, "CLI only\n"); exit(1); }

define('BASE_PATH', dirname(__DIR__));
$GLOBALS['CFG'] = require BASE_PATH . '/config.php';
require_once BASE_PATH . '/core/db.php';
require_once BASE_PATH . '/core/helpers.php';
require_once BASE_PATH . '/core/chat_brain.php';      // ключи Gemini и учёт квоты
require_once BASE_PATH . '/core/ministry_reply.php';  // mrep_image_text / mrep_pdf_text

$dry   = in_array('dry', $argv, true);
$limit = 0;
foreach ($argv as $i => $a) if ($a === 'limit') $limit = (int) ($argv[$i + 1] ?? 0);

/**
 * Дата с бланка письма.
 *
 * Спрашиваем ровно одну вещь и просим ответить одной строкой: длинный пересказ
 * здесь только мешает, а модель охотно добавляет «на скане видно, что…».
 * Интересует ДАТА ИСХОДЯЩЕГО письма — та, что стоит рядом с номером в шапке,
 * а не дата входящего штампа получателя и не дата в тексте.
 */
function ml_date_from_scan(string $bytes, string $mime): string {
    if (!function_exists('chat_gemini_keys')) return '';
    $model = (string) (cfgv('gemini_model') ?: 'gemini-flash-latest');
    $base  = rtrim((string) (cfgv('gemini_base_url') ?: 'https://generativelanguage.googleapis.com'), '/');
    $payload = json_encode([
        'contents' => [['role' => 'user', 'parts' => [
            ['text' => 'Это скан официального письма российского органа власти на фирменном бланке. '
                     . 'Найди ДАТУ ИСХОДЯЩЕГО письма — она стоит в шапке рядом с исходящим номером '
                     . '(«от 12.03.2026 № 01-05/123», «12 марта 2026 г.», «12.03.2026»). '
                     . 'Не бери дату входящего штампа получателя, дату в подписи и даты внутри текста, '
                     . 'если рядом с ними нет исходящего номера. '
                     . 'Ответь РОВНО одной строкой в формате ГГГГ-ММ-ДД и ничем больше. '
                     . 'Если года на письме нет или дату разобрать нельзя — ответь одним словом: нет.'],
            ['inline_data' => ['mime_type' => $mime, 'data' => base64_encode($bytes)]],
        ]]],
        // ЗАПАС ПО ТОКЕНАМ И ВЫКЛЮЧЕННОЕ «РАЗМЫШЛЕНИЕ».
        // Сначала здесь стояло 40 токенов: ответ-то в десять символов. Но модели
        // 2.5 тратят бюджет ещё и на внутренние рассуждения, и он кончался ДО
        // первой буквы ответа — на все письма возвращалась пустота, будто даты
        // на бланках нет вовсе. Рассуждение выключаем, запас оставляем.
        'generationConfig' => ['maxOutputTokens' => 300, 'temperature' => 0,
                               'thinkingConfig' => ['thinkingBudget' => 0]],
    ], JSON_UNESCAPED_UNICODE);

    foreach (chat_gemini_keys() as $key) {
        if (chat_gemini_is_exhausted($key)) continue;
        // 503 «высокий спрос» прилетает у Gemini пачками и проходит за секунды.
        // Без повтора такое письмо навсегда осталось бы без даты по причине,
        // которая нас вообще не касается.
        $resp = false; $code = 0;
        for ($try = 1; $try <= 3; $try++) {
            $ch = curl_init($base . '/v1beta/models/' . rawurlencode($model) . ':generateContent?key=' . rawurlencode($key));
            curl_setopt_array($ch, [
                CURLOPT_RETURNTRANSFER => true, CURLOPT_POST => true, CURLOPT_POSTFIELDS => $payload,
                CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
                CURLOPT_TIMEOUT => 90, CURLOPT_CONNECTTIMEOUT => 8,
            ]);
            $resp = curl_exec($ch);
            $code = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
            curl_close($ch);
            if ($code !== 503 && $code !== 500) break;
            sleep(3 * $try);
        }
        if ($code === 429) { chat_gemini_mark_exhausted($key); continue; }
        // Молчаливый пропуск ошибки прячет причину: скан 4 МБ, неверная модель и
        // выключенный ключ выглядят одинаково — «дату не разобрал». Показываем код.
        if (!is_string($resp) || $code >= 400) {
            fwrite(STDERR, '        Gemini ответил ' . $code . ': '
                . mb_substr(preg_replace('~\s+~', ' ', (string) $resp) ?? '', 0, 160) . "\n");
            continue;
        }
        $d = json_decode($resp, true);
        $t = '';
        foreach ($d['candidates'][0]['content']['parts'] ?? [] as $p) $t .= (string) ($p['text'] ?? '');
        return trim($t);
    }
    return '__NOKEY__';   // все ключи выбраны — это не «нет даты», а «спросить не у кого»
}

/**
 * ТЕКСТ СКАНА СВОИМИ СИЛАМИ — tesseract с русским словарём.
 *
 * Сначала письма читались только через Gemini Vision, и это оказалось дорогой в
 * три часа: прокси отвечал по полторы минуты на скан, отдавал 503 пачками, и за
 * пять минут разобралось три письма из ста двадцати. Между тем это чистые
 * машинописные бланки — их прекрасно берёт обычный OCR прямо на сервере:
 * бесплатно, без сети и примерно секунда на письмо. Gemini остаётся запасным
 * вариантом для тех сканов, где дату не нашли.
 */
function ml_ocr_text(string $abs): string {
    $texts = [];
    // РЕЖИМЫ РАЗБОРА СТРАНИЦЫ. Шапка бланка стоит колонкой слева, рядом с гербом
    // и адресатом справа — один режим её нередко склеивает или роняет. Пробуем
    // несколько: «один блок», «одна колонка», «разреженный текст», авто.
    foreach ([6, 4, 11, 3] as $psm) {
        $out = [];
        @exec('tesseract ' . escapeshellarg($abs) . ' stdout -l rus --psm ' . $psm . ' 2>/dev/null', $out);
        $t = implode("\n", $out);
        if (trim($t) !== '') $texts[] = $t;
    }
    return implode("\n", $texts);
}

/**
 * ВЕРХНЯЯ ТРЕТЬ СКАНА, УВЕЛИЧЕННАЯ ВДВОЕ.
 *
 * Исходящий штамп набран мелким шрифтом, и на скане 150 dpi распознаётся плохо:
 * из ста двадцати писем свой OCR брал меньше половины. Если вырезать шапку и
 * увеличить её, тот же tesseract читает её уверенно. Возвращает путь к
 * временному файлу ('' — если GD не смог).
 */
function ml_crop_header(string $abs): string {
    if (!function_exists('imagecreatefromjpeg')) return '';
    $ext = strtolower(pathinfo($abs, PATHINFO_EXTENSION));
    $img = $ext === 'png' ? @imagecreatefrompng($abs) : @imagecreatefromjpeg($abs);
    if (!$img) return '';
    $w = imagesx($img); $h = imagesy($img);
    $ch = (int) round($h * 0.42);
    $dst = @imagecreatetruecolor($w * 2, $ch * 2);
    if (!$dst) { imagedestroy($img); return ''; }
    imagecopyresampled($dst, $img, 0, 0, 0, 0, $w * 2, $ch * 2, $w, $ch);
    $tmp = tempnam(sys_get_temp_dir(), 'mlhead') . '.png';
    $ok = @imagepng($dst, $tmp);
    imagedestroy($img); imagedestroy($dst);
    return $ok ? $tmp : '';
}

/**
 * ДАТА ИСХОДЯЩЕГО ИЗ РАСПОЗНАННОГО ТЕКСТА.
 *
 * Берём только то, что стоит в шапке ПОСЛЕ слова «от» — так на бланке и пишут:
 * «№ 10/11-24 от 11.01.2024». Правило узкое намеренно, и вот почему.
 *
 * Свободный поиск «любой даты в письме» ошибался дважды подряд на первых же
 * сканах. В калужском письме он принял за дату сам исходящий номер: «10/11-24»
 * читается как 10.11.24, и письмо от 11 января уехало бы в ноябрь. В
 * архангельском — второй лист без шапки, где единственная дата это ссылка на
 * постановление правительства «от 15 января 2019 г. № 5-пп»: письмо 2024 года
 * встало бы в самый низ галереи пятилетней давностью.
 *
 * Поэтому: нашли дату после «от» в первых строках — берём. Не нашли — честно
 * возвращаем пустоту и отдаём скан Gemini, а не подставляем первое похожее число.
 */
function ml_date_from_text(string $text): string {
    if (trim($text) === '') return '';
    $months = ['январ' => 1, 'феврал' => 2, 'март' => 3, 'апрел' => 4, 'мая' => 5,
               'июн' => 6, 'июл' => 7, 'август' => 8, 'сентябр' => 9, 'октябр' => 10,
               'ноябр' => 11, 'декабр' => 12];

    /** Первая дата в куске текста. Слэш как разделитель НЕ принимаем: это номер. */
    $pick = static function (string $s) use ($months): string {
        if (preg_match('~(?<![\d/\-])(\d{1,2})[.\-](\d{1,2})[.\-](\d{2,4})(?![\d/\-])~u', $s, $m)) {
            $y = (int) $m[3]; if ($y < 100) $y += 2000;
            $iso = sprintf('%04d-%02d-%02d', $y, (int) $m[2], (int) $m[1]);
            if ((int) $m[2] >= 1 && (int) $m[2] <= 12 && (int) $m[1] >= 1 && (int) $m[1] <= 31
                && ml_date_sane($iso) !== '') return $iso;
        }
        if (preg_match('~\b(\d{1,2})\s+([А-Яа-яё]{3,10})\s+(\d{4})~u', $s, $m)) {
            $w = mb_strtolower($m[2]);
            foreach ($months as $stem => $num) {
                if (mb_strpos($w, $stem) !== 0) continue;
                $iso = sprintf('%04d-%02d-%02d', (int) $m[3], $num, (int) $m[1]);
                return ml_date_sane($iso);
            }
        }
        return '';
    };

    $lines = preg_split('~\R~u', $text) ?: [];
    foreach (array_slice($lines, 0, 20) as $ln) {
        // «На № ... от ...» — это ссылка на НАШЕ письмо, дата там чужая.
        if (preg_match('~^\s*на\s*№~ui', $ln)) continue;
        // Ссылка на нормативный акт: «постановлением ... от 15 января 2019 г. № 5-пп».
        if (preg_match('~постановлен|приказ|распоряжен|закон|указ~ui', $ln)) continue;
        if (!preg_match('~(^|[^\p{L}])от[^\p{L}]~ui', $ln)) continue;
        // Всё, что после последнего «от» в строке.
        $tail = (string) preg_replace('~^.*(^|[^\p{L}])от[^\p{L}]~ui', '', $ln);
        // НОМЕР ПОСЛЕ ДАТЫ — ЭТО НЕ НАШЕ ПИСЬМО.
        // На бланке исходящий номер стоит ПЕРЕД датой: «№ 10/11-24 от 11.01.2024».
        // Конструкция «от 15 января 2019 г. № 5-пп» — ссылка на постановление
        // внутри текста; ровно на ней письмо 2024 года получило дату 2019-го и
        // уехало бы в самый низ галереи.
        if (preg_match('~№\s*\d+[\-/]?[А-Яа-яA-Za-z]~u', $tail)) continue;
        $iso  = $pick($tail);
        if ($iso !== '') return $iso;
    }

    // КЛАССИЧЕСКАЯ ШАПКА: «18.01.2024 № МК-0130-06-12» — дата слева, номер справа,
    // слова «от» между ними нет вовсе. Так свёрстано большинство бланков, и
    // правило «только после от» их все пропускало: сорок писем из семидесяти
    // пяти ушли бы в Gemini впустую.
    foreach (array_slice($lines, 0, 20) as $ln) {
        if (preg_match('~^\s*на\s*№~ui', $ln)) continue;
        if (preg_match('~постановлен|приказ|распоряжен|закон|указ~ui', $ln)) continue;
        // Номер акта («№ 5-пп») — не наш исходящий, такую строку пропускаем.
        if (preg_match('~№\s*\d+[\-/]?[А-Яа-яA-Za-z]~u', $ln)) continue;
        if (!preg_match('~(\d{1,2}[.\-]\d{1,2}[.\-]\d{2,4}|\d{1,2}\s+[А-Яа-яё]{3,10}\s+\d{4})\s*(г\.?)?\s*№~u', $ln, $m)) continue;
        $iso = $pick($m[1]);
        if ($iso !== '') return $iso;
    }

    // Дата может стоять отдельной короткой строкой под номером — без слова «от».
    foreach (array_slice($lines, 0, 12) as $ln) {
        $t = trim($ln);
        if ($t === '' || mb_strlen($t) > 24) continue;
        if (preg_match('~№~u', $t)) continue;
        $iso = $pick($t);
        if ($iso !== '') return $iso;
    }
    return '';
}

/** Проверка правдоподобия: письмо не могло быть написано до центра и после сегодня. */
function ml_date_sane(string $iso): string {
    if (!preg_match('~^(\d{4})-(\d{2})-(\d{2})$~', trim($iso), $m)) return '';
    $y = (int) $m[1];
    if ($y < 2015 || $y > (int) date('Y')) return '';
    $ts = strtotime($iso);
    if (!$ts || $ts > time() + 86400) return '';
    return date('Y-m-d', $ts);
}

$rows = all("SELECT id, region, title, image_path, file_path FROM ministry_letters
              WHERE COALESCE(letter_date,'')='' ORDER BY id");
if ($limit > 0) $rows = array_slice($rows, 0, $limit);

echo 'ПИСЬМА БЕЗ ДАТЫ: ' . count($rows) . ($dry ? '  (пробный прогон, ничего не пишем)' : '') . "\n"
   . str_repeat('=', 78) . "\n";

$ok = $fail = 0;
// Запасной путь (Gemini) можно выключить руками: «nogem». Полезно, когда важно
// быстро разобрать всё, что берёт свой OCR, и не ждать по две минуты на скан.
$noGemini = in_array('nogem', $argv, true);
$needGemini = 0;     // сколько писем ждут его на следующий день
foreach ($rows as $i => $r) {
    $rel = trim((string) ($r['image_path'] ?: $r['file_path']));
    $abs = BASE_PATH . '/public' . $rel;
    $name = mb_substr((string) ($r['region'] ?: $r['title']), 0, 34);

    if ($rel === '' || !is_file($abs)) {
        printf("  %3d/%d  %-34s файла нет: %s\n", $i + 1, count($rows), $name, $rel);
        $fail++;
        continue;
    }

    $ext = strtolower(pathinfo($abs, PATHINFO_EXTENSION));

    // 1) Свой OCR: бесплатно и быстро, берёт почти все машинописные бланки.
    $how = 'OCR';
    $raw = ml_date_from_text($ext === 'pdf' && function_exists('mrep_pdf_text')
        ? mrep_pdf_text((string) file_get_contents($abs))
        : ml_ocr_text($abs));

    // 1б) Не вышло — читаем увеличенную шапку: мелкий штамп на скане 150 dpi
    //     распознаётся вдвое хуже, чем он же, вырезанный и увеличенный.
    if ($raw === '' && $ext !== 'pdf') {
        $crop = ml_crop_header($abs);
        if ($crop !== '') {
            $raw = ml_date_from_text(ml_ocr_text($crop));
            if ($raw !== '') $how = 'OCR шапки';
            @unlink($crop);
        }
    }

    // 2) Не нашли — спрашиваем Gemini Vision (рукописные шапки, кривые сканы).
    if ($raw === '' && !$noGemini) {
        $how  = 'Gemini';
        $mime = $ext === 'png' ? 'image/png' : ($ext === 'pdf' ? 'application/pdf' : 'image/jpeg');
        $raw  = ml_date_from_scan((string) file_get_contents($abs), $mime);
    }

    // КВОТА КОНЧИЛАСЬ — РАБОТУ НЕ БРОСАЕМ.
    // Раньше здесь стоял break, и первое же письмо, ушедшее в Gemini, обрывало
    // весь прогон: сто девятнадцать сканов, которые прекрасно читает свой OCR,
    // так и оставались без дат из-за чужой квоты. Теперь запасной путь просто
    // выключается, а остальные письма разбираются как обычно.
    if ($raw === '__NOKEY__') {
        $noGemini = true;
        $needGemini++;
        printf("  %3d/%d  %-34s отложено: Gemini недоступен\n", $i + 1, count($rows), $name);
        continue;
    }
    if ($raw === '' && $noGemini) {
        $needGemini++;
        printf("  %3d/%d  %-34s отложено: нужен Gemini\n", $i + 1, count($rows), $name);
        continue;
    }

    $iso = ml_date_sane($raw);
    if ($iso === '') {
        printf("  %3d/%d  %-34s дату не разобрал (ответ: %s)\n", $i + 1, count($rows), $name,
            mb_substr(str_replace("\n", ' ', $raw), 0, 24) ?: 'пусто');
        $fail++;
    } else {
        printf("  %3d/%d  %-34s %s  (%s)\n", $i + 1, count($rows), $name, date('d.m.Y', strtotime($iso)), $how);
        if (!$dry) {
            try { update('ministry_letters', ['letter_date' => $iso], 'id=:id', ['id' => (int) $r['id']]); }
            catch (\Throwable $e) { echo '        не сохранилось: ' . $e->getMessage() . "\n"; }
        }
        $ok++;
    }
    // Пауза нужна только если ходили в сеть: свой OCR лимитов не имеет.
    if ($how === 'Gemini') usleep(1200000);
}

echo str_repeat('=', 78) . "\n";
echo "дат проставлено: $ok, не разобрано: $fail\n";
if ($needGemini > 0) {
    echo "ждут Gemini (свой OCR даты не нашёл, квота исчерпана): $needGemini — "
       . "запустите скрипт позже, он продолжит с этого места\n";
}
$left = (int) (scalar("SELECT COUNT(*) FROM ministry_letters WHERE COALESCE(letter_date,'')=''") ?? 0);
echo "осталось без даты в базе: $left\n";
