<?php
/**
 * АУДИТ НАГРАДНОГО БЛАНКА: один ли он везде.
 *
 *   php scripts/audit_diploma_blanks.php
 *
 * Проверяет, что диплом во ВСЕХ местах собирается одним и тем же выверенным
 * движком, а не разными: витрина наград, кабинет участника, админка, письма,
 * производство оригиналов, автоматика на будущее.
 *
 * Поводом стала история, когда образцы на витрине обновлялись, а PDF на
 * скачивание оставался кривым: файлы лежат кэшем и сами не пересобираются.
 */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { fwrite(STDERR, "CLI only\n"); exit(1); }

define('BASE_PATH', dirname(__DIR__));
$GLOBALS['CFG'] = require BASE_PATH . '/config.php';
require_once BASE_PATH . '/core/db.php';
require_once BASE_PATH . '/core/helpers.php';
require_once BASE_PATH . '/core/diploma_html.php';

$bad = 0; $warn = 0;
$ok   = static function (string $s): void { echo "  [норма]  $s\n"; };
$err  = static function (string $s) use (&$bad): void { echo "  [ОШИБКА] $s\n"; $bad++; };
$note = static function (string $s) use (&$warn): void { echo "  [внимание] $s\n"; $warn++; };

echo "1. НАСТРОЙКИ КОНКУРСОВ\n";
$comps = all("SELECT id, code, name, diploma_template FROM competitions WHERE id IN (18,19,20,21,28,29,30,31) ORDER BY id");
foreach ($comps as $c) {
    $t = json_decode((string) $c['diploma_template'], true) ?: [];
    $eng = diploma_engine_ver((array) $c);
    $miss = [];
    foreach (['ink_cal', 'ink_cal_extra', 'ink_cal_named', 'ink_cal_thanks'] as $k) {
        if (empty($t[$k])) $miss[] = $k;
    }
    $line = sprintf('%-3d %-4s %-24s движок %s', $c['id'], (string) $c['code'], mb_substr((string) $c['name'], 0, 24), $eng);
    if ($miss) $err($line . ' — нет поправки: ' . implode(', ', $miss));
    else       $ok($line . ' — поправка снята по всем четырём видам');
}

echo "\n2. ВСЕ ЛИ МЕСТА БЕРУТ БЛАНК ИЗ ОДНОГО ДВИЖКА\n";
/* Ищем прямые вызовы старого GD-генератора там, где документ уходит человеку.
 * Он рисует другой бланк, и один такой вызов сводит на нет всю выверку. */
$watch = [
    'cron/send_diplomas.php'      => 'рассылка дипломов',
    'core/diploma_sync.php'       => 'пересборка при правке заявки',
    'core/orders.php'             => 'заказы наград',
    'core/curator_awards.php'     => 'благодарности кураторам',
    'public/index.php'            => 'скачивание из кабинета',
    'templates/site/pages/cabinet.php' => 'кабинет участника',
];
foreach ($watch as $f => $ru) {
    $src = @file_get_contents(BASE_PATH . '/' . $f);
    if ($src === false) { $note("$f — файла нет"); continue; }
    $hasHtml = str_contains($src, 'diploma_pdf_html');
    // Комментарии не считаем: там объяснено, почему подмены больше нет.
    $noComments = preg_replace('~/\*.*?\*/|//[^\n]*~s', '', $src) ?: $src;
    $hasGd = (bool) preg_match('~\bpdf_diploma\s*\(~', $noComments);
    if ($hasGd) $err("$f ($ru) — остался вызов старого генератора pdf_diploma()");
    elseif ($hasHtml) $ok("$f ($ru) — только выверенный движок");
    else $note("$f ($ru) — бланк здесь не собирается");
}

echo "\n3. ФАЙЛЫ УЧАСТНИКОВ: свежесть\n";
$cut = strtotime('2026-09-04 17:00');   // время выверки бланка
$rows = all("SELECT d.id, d.number, d.type, d.pdf_path, a.competition_id
             FROM diplomas d JOIN applications a ON a.id=d.application_id ORDER BY d.id");
$old = $miss = $fresh = 0; $oldList = [];
foreach ($rows as $d) {
    /* Путь хранится то веб-адресом («/diplomas/x.pdf»), то абсолютным
     * («/var/www/…»). Понимаем оба, иначе аудит объявляет пропажей то, что
     * лежит на месте. */
    $p = trim((string) $d['pdf_path']);
    $abs = $p === '' ? '' : (str_starts_with($p, '/var') ? $p : BASE_PATH . '/public/' . ltrim($p, '/'));
    if ($abs === '' || !is_file($abs)) { $miss++; continue; }
    if (filemtime($abs) < $cut) { $old++; if (count($oldList) < 10) $oldList[] = (string) $d['number']; }
    else $fresh++;
}
printf("  всего наградных материалов: %d\n", count($rows));
if ($fresh) $ok("перерисовано под выверенный бланк: $fresh");
if ($old)   $err("осталось со старой вёрсткой: $old (например: " . implode(', ', $oldList) . ")");
if ($miss)  $note("файла на диске нет: $miss — соберутся при первом обращении");
$absCnt = 0;
foreach ($rows as $d) if (str_starts_with(trim((string) $d['pdf_path']), '/var')) $absCnt++;
if ($absCnt) $err("путь к файлу хранится абсолютным у $absCnt дипломов — ссылка «файл» в админке по ним не открывается");
else $ok('путь к файлу везде веб-адресом — ссылки в админке рабочие');

echo "\n4. КАРТИНКИ-ПРЕДПРОСМОТРЫ\n";
$prev = glob(BASE_PATH . '/public/diplomas/preview_*.png') ?: [];
$prevOld = 0;
foreach ($prev as $f) if (filemtime($f) < $cut) $prevOld++;
if ($prevOld) $err("старых картинок предпросмотра: $prevOld из " . count($prev) . " — покажут прежнюю вёрстку");
else $ok('старых картинок предпросмотра нет (' . count($prev) . ' шт., все свежие или собраны заново)');

echo "\n5. ВИТРИНА НАГРАД\n";
foreach ($comps as $c) {
    $dir = BASE_PATH . '/public/assets/img/awards/' . (int) $c['id'];
    $need = ['diploma.jpg', 'diploma2.jpg', 'diploma-name.jpg', 'thanks.jpg'];
    $bad2 = [];
    foreach ($need as $f) {
        $p = $dir . '/' . $f;
        if (!is_file($p)) $bad2[] = $f . ' — нет';
        elseif (filemtime($p) < $cut) $bad2[] = $f . ' — старый';
    }
    if ($bad2) $err(sprintf('конкурс %-3d — %s', $c['id'], implode('; ', $bad2)));
    else $ok(sprintf('конкурс %-3d — все четыре образца свежие', $c['id']));
}

echo "\n6. АВТОМАТИКА НА БУДУЩЕЕ\n";
/* Новые дипломы рисуются тем же diploma_pdf_html(), значит выверенный бланк
 * применится сам. Проверяем, что путь жив и что запас прочности на месте. */
$src = (string) @file_get_contents(BASE_PATH . '/core/diploma_render.php');
if (preg_match('~for \(\$try = 1; \$try <= 3~', $src)) $ok('рендер бланка делает три попытки при сбое моста');
else $err('рендер бланка делает одну попытку — при заминке моста бланк не соберётся');
$src2 = (string) @file_get_contents(BASE_PATH . '/core/diploma_html_v2.php');
if (str_contains($src2, 'shrinkLast')) $ok('текст благодарности сам ужимается, если упирается в подписи');
else $err('нет защиты от наезда текста на подписи');
if (str_contains($src2, "data-title-fit")) $ok('снимок ждёт готовности вёрстки (метка data-title-fit)');
else $err('метки готовности вёрстки нет — снимок может поймать неподогнанный лист');

printf("\nИТОГ: ошибок %d, замечаний %d\n", $bad, $warn);
exit($bad > 0 ? 1 : 0);
