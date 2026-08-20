<?php
/**
 * ПОРЯДОК В РЕЕСТРЕ ПИСЕМ ПОДДЕРЖКИ.
 *
 * Письма ведомств копились три месяца: часть заводилась руками, часть
 * автоматически из почты, и у каждой партии свои привычки. Отсюда три беды,
 * которые видно только на живом сайте:
 *
 *   1. Путь к скану записан без ведущего слэша (uploads/... вместо /uploads/...).
 *      Такой адрес браузер считает относительным и ищет файл рядом со страницей —
 *      на странице ведомств скан просто не открывается.
 *   2. Файл лежит вне веб-корня. Его не отдаёт даже правильный адрес: сервер
 *      публикует только public/, а файл сохранён рядом.
 *   3. Поле сортировки разошлось с датами писем. На сайте порядок считается по
 *      дате, в админке по этому полю — и два списка выглядят по-разному.
 *
 * Скрипт это выправляет: чинит пути, переносит потерянные файлы в веб-корень и
 * заново раскладывает сортировку по датам, свежие сверху. Письма без даты
 * остаются в конце — им дату надо проставить руками, скрипт её не выдумывает.
 *
 *   php scripts/ministry_letters_fix.php          — показать, что не так
 *   php scripts/ministry_letters_fix.php --apply  — починить
 */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { fwrite(STDERR, "CLI only\n"); exit(1); }

define('BASE_PATH', dirname(__DIR__));
$GLOBALS['CFG'] = require BASE_PATH . '/config.php';
require_once BASE_PATH . '/core/db.php';
require_once BASE_PATH . '/core/helpers.php';

$apply = in_array('--apply', $argv, true);
$web   = BASE_PATH . '/public';
$line  = str_repeat('=', 78);

echo "РЕЕСТР ПИСЕМ ПОДДЕРЖКИ\n$line\n";

$rows = all("SELECT id, region, title, image_path, file_path, doc_path, letter_date, sort FROM ministry_letters ORDER BY id");
printf("  писем в реестре: %d\n\n", count($rows));

/* ── 1. Пути к сканам ────────────────────────────────────────────────────── */
$fixPath = 0; $moved = 0; $lost = [];
foreach ($rows as $r) {
    $img = trim((string) ($r['image_path'] ?? ''));
    if ($img === '') continue;
    $norm = '/' . ltrim($img, '/');                 // ведущий слэш обязателен

    if (is_file($web . $norm)) {
        if ($norm !== $img) {
            printf("  путь поправлен: #%-4d %s → %s\n", (int) $r['id'], $img, $norm);
            if ($apply) update('ministry_letters', ['image_path' => $norm], 'id=:id', ['id' => (int) $r['id']]);
            $fixPath++;
        }
        continue;
    }

    // Файла нет в веб-корне — ищем его рядом: частая история, когда скан
    // сохранили в uploads/ вместо public/uploads/.
    $outside = BASE_PATH . '/' . ltrim($img, '/');
    if (is_file($outside)) {
        $dstDir = $web . '/uploads/ministry';
        if (!is_dir($dstDir)) @mkdir($dstDir, 0775, true);
        $dst = $dstDir . '/' . basename($outside);
        printf("  файл вне веб-корня: #%-4d %s\n", (int) $r['id'], $img);
        if ($apply && @copy($outside, $dst)) {
            @chmod($dst, 0644);
            update('ministry_letters', ['image_path' => '/uploads/ministry/' . basename($dst)], 'id=:id', ['id' => (int) $r['id']]);
            // Рядом с картинкой обычно лежит и сам PDF письма.
            $pdf = preg_replace('~\.jpe?g$~i', '.pdf', $outside);
            if (is_file($pdf) && @copy($pdf, $dstDir . '/' . basename($pdf))) {
                @chmod($dstDir . '/' . basename($pdf), 0644);
                update('ministry_letters', ['file_path' => 'uploads/ministry/' . basename($pdf)], 'id=:id', ['id' => (int) $r['id']]);
            }
        }
        $moved++;
        continue;
    }
    $lost[] = [(int) $r['id'], (string) $r['region'], $img];
}
if ($lost) {
    echo "\n  СКАН НЕ НАЙДЕН НИГДЕ (нужно приложить заново):\n";
    foreach ($lost as [$id, $reg, $p]) printf("    #%-4d %-34s %s\n", $id, mb_substr($reg, 0, 34), $p);
}

/* ── 2. Даты ─────────────────────────────────────────────────────────────── */
$noDate = array_values(array_filter($rows, static fn(array $r): bool => trim((string) ($r['letter_date'] ?? '')) === ''));
if ($noDate) {
    echo "\n  БЕЗ ДАТЫ ПИСЬМА (уходят в конец списка, дату проставить в админке):\n";
    foreach ($noDate as $r) printf("    #%-4d %s\n", (int) $r['id'], mb_substr((string) $r['region'], 0, 44));
}

/* ── 3. Сортировка ───────────────────────────────────────────────────────────
 * Раскладываем поле sort строго по датам: 1 у самого свежего письма. Тогда оба
 * списка — на сайте и в админке — идут одинаково, независимо от того, по какому
 * ключу они сортируются.
 */
$ordered = all("SELECT id FROM ministry_letters
                 ORDER BY (letter_date IS NULL OR letter_date='') ASC,
                          letter_date DESC, id DESC");
$pos = 0; $reord = 0;
foreach ($ordered as $o) {
    $pos++;
    $cur = null;
    foreach ($rows as $r) if ((int) $r['id'] === (int) $o['id']) { $cur = (int) $r['sort']; break; }
    if ($cur === $pos) continue;
    if ($apply) update('ministry_letters', ['sort' => $pos], 'id=:id', ['id' => (int) $o['id']]);
    $reord++;
}

echo "\n$line\n";
printf("  путей поправлено:     %d\n", $fixPath);
printf("  файлов перенесено:    %d\n", $moved);
printf("  сканов не найдено:    %d\n", count($lost));
printf("  писем без даты:       %d\n", count($noDate));
printf("  порядок пересчитан у: %d писем\n", $reord);
echo $apply ? "\n  изменения применены\n" : "\n  это предпросмотр: чтобы починить — php scripts/ministry_letters_fix.php --apply\n";
