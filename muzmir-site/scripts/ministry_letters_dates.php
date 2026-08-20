<?php
/**
 * ДАТЫ ПИСЕМ ПОДДЕРЖКИ — ПО САМОМУ ПИСЬМУ.
 *
 * В реестре десять писем без даты. Порядок на сайте считается по дате, поэтому
 * они висят в конце, хотя часть из них свежее большинства списка. Дата в письме
 * есть всегда: она стоит в шапке рядом с исходящим номером.
 *
 * Скрипт распознаёт скан (tesseract, русский язык) и ищет дату там, где она
 * бывает: «№ 01-15/1234 от 12.08.2026», «от 12 августа 2026 г.». Чужие даты из
 * текста (ссылки на постановления прошлых лет) отсекаются годом: письма
 * поддержки собраны в этом сезоне, всё, что старше прошлого года, — не дата
 * письма, а цитата.
 *
 * Ненадёжные случаи скрипт не выдумывает: он их показывает, а дату ставит
 * человек в админке.
 *
 *   php scripts/ministry_letters_dates.php          — распознать и показать
 *   php scripts/ministry_letters_dates.php --apply  — проставить найденные даты
 */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { fwrite(STDERR, "CLI only\n"); exit(1); }

define('BASE_PATH', dirname(__DIR__));
$GLOBALS['CFG'] = require BASE_PATH . '/config.php';
require_once BASE_PATH . '/core/db.php';
require_once BASE_PATH . '/core/helpers.php';

$apply = in_array('--apply', $argv, true);

const MONTHS = ['января' => 1, 'февраля' => 2, 'марта' => 3, 'апреля' => 4, 'мая' => 5, 'июня' => 6,
                'июля' => 7, 'августа' => 8, 'сентября' => 9, 'октября' => 10, 'ноября' => 11, 'декабря' => 12];

/** Текст скана. Пустая строка, если распознать не удалось. */
function mld_ocr(string $abs): string {
    if (!is_file($abs)) return '';
    $out = (string) @shell_exec('tesseract ' . escapeshellarg($abs) . ' - -l rus 2>/dev/null');
    return trim($out);
}

/**
 * Дата письма из распознанного текста.
 *
 * Возвращает [дата Y-m-d, как нашли] или ['','']. Сначала ищем дату рядом с
 * исходящим номером — это и есть дата письма. Потом просто первую дату нужного
 * года: в шапке она стоит раньше любых ссылок на документы.
 */
function mld_find_date(string $text, int $minYear): array {
    $t = preg_replace('~\s+~u', ' ', $text) ?? $text;

    $toDate = static function (string $d, string $m, string $y): string {
        $mm = ctype_digit($m) ? (int) $m : (MONTHS[mb_strtolower($m)] ?? 0);
        $yy = (int) $y; $dd = (int) $d;
        if ($mm < 1 || $mm > 12 || $dd < 1 || $dd > 31 || $yy < 2000) return '';
        return sprintf('%04d-%02d-%02d', $yy, $mm, $dd);
    };

    // 1. «№ 1234 от 12.08.2026» или «№ 1234 от 12 августа 2026»
    if (preg_match('~№\s*[^\s]{1,24}\s*от\s*(\d{1,2})[.\s]+([а-яё]+|\d{1,2})[.\s]+(\d{4})~ui', $t, $m)) {
        $d = $toDate($m[1], $m[2], $m[3]);
        if ($d !== '' && (int) substr($d, 0, 4) >= $minYear) return [$d, 'рядом с исходящим номером'];
    }
    // 2. Любая дата нужного года, первая по тексту.
    if (preg_match_all('~(\d{1,2})[.\s]+([а-яё]{3,10}|\d{1,2})[.\s]+(\d{4})~ui', $t, $mm2, PREG_SET_ORDER)) {
        foreach ($mm2 as $m) {
            $d = $toDate($m[1], $m[2], $m[3]);
            if ($d !== '' && (int) substr($d, 0, 4) >= $minYear && $d <= date('Y-m-d')) {
                return [$d, 'первая дата этого сезона в тексте'];
            }
        }
    }
    return ['', ''];
}

$line = str_repeat('=', 78);
echo "ДАТЫ ПИСЕМ ПОДДЕРЖКИ\n$line\n";

$minYear = (int) date('Y') - 1;
$rows = all("SELECT id, region, image_path FROM ministry_letters WHERE COALESCE(letter_date,'')='' ORDER BY id");
printf("  писем без даты: %d\n\n", count($rows));

$found = 0; $miss = [];
foreach ($rows as $r) {
    $abs = BASE_PATH . '/public/' . ltrim((string) $r['image_path'], '/');
    $txt = mld_ocr($abs);
    if ($txt === '') { $miss[] = [(int) $r['id'], (string) $r['region'], 'скан не распознался']; continue; }
    [$date, $how] = mld_find_date($txt, $minYear);
    if ($date === '') { $miss[] = [(int) $r['id'], (string) $r['region'], 'даты в тексте нет']; continue; }
    printf("  #%-4d %-32s → %s  (%s)\n", (int) $r['id'], mb_substr((string) $r['region'], 0, 32),
           date('d.m.Y', strtotime($date)), $how);
    $found++;
    if ($apply) update('ministry_letters', ['letter_date' => $date], 'id=:id', ['id' => (int) $r['id']]);
}

if ($miss) {
    echo "\n  ДАТУ НАДО ПОСТАВИТЬ РУКАМИ (в админке, раздел «Письма поддержки»):\n";
    foreach ($miss as [$id, $reg, $why]) printf("    #%-4d %-34s %s\n", $id, mb_substr($reg, 0, 34), $why);
}

/* Порядок в списке считается по дате — после простановки пересчитываем его,
   иначе сайт и админка снова разойдутся. */
if ($apply && $found > 0) {
    $ordered = all("SELECT id FROM ministry_letters
                     ORDER BY (letter_date IS NULL OR letter_date='') ASC, letter_date DESC, id DESC");
    $pos = 0;
    foreach ($ordered as $o) { $pos++; update('ministry_letters', ['sort' => $pos], 'id=:id', ['id' => (int) $o['id']]); }
    printf("\n  порядок пересчитан: %d писем\n", count($ordered));
}

echo "\n$line\n";
printf("  дат найдено: %d, осталось без даты: %d\n", $found, count($miss));
echo $apply ? "  применено\n" : "  это предпросмотр: php scripts/ministry_letters_dates.php --apply\n";
