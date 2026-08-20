<?php
/**
 * ОДИНАКОВЫЕ ТРЕБОВАНИЯ К МАТЕРИАЛУ ВО ВСЕХ КОНКУРСАХ.
 *
 * Раздел 8 «Требования к конкурсному материалу» в платном и бесплатном эталонах
 * рос по отдельности, и пункты разъехались: съёмка в одном 8.2, в другом идёт
 * абзацем без номера; монтаж 8.5 против 8.3; пункта про фонограмму в бесплатном
 * не было вовсе. Из-за этого один и тот же отказ («видео с монтажом») ссылался у
 * разных конкурсов на разные пункты, а участник, читавший положение бесплатного
 * конкурса, не знал про снижение оценки за фонограмму.
 *
 * Скрипт делает раздел 8 бесплатного эталона точной копией платного. Своим
 * остаётся только пункт 8.0 «Тематика конкурса»: у бесплатного она
 * патриотическая, у платного свободная, и это разные конкурсы, а не расхождение.
 *
 * Абзацы переносятся целиком, вместе с оформлением, поэтому вёрстка раздела
 * остаётся такой же, как в утверждённом платном положении.
 *
 *   php scripts/regulation_unify8.php          — показать, что получится
 *   php scripts/regulation_unify8.php --apply  — применить
 */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { fwrite(STDERR, "CLI only\n"); exit(1); }

define('BASE_PATH', dirname(__DIR__));
$GLOBALS['CFG'] = require BASE_PATH . '/config.php';
require_once BASE_PATH . '/core/db.php';
require_once BASE_PATH . '/core/helpers.php';

$apply = in_array('--apply', $argv, true);

/** Текст абзаца без разметки. */
function ru8_text(string $xml): string {
    $t = '';
    if (preg_match_all('~<w:t[^>]*>(.*?)</w:t>~su', $xml, $m)) $t = implode('', $m[1]);
    return trim(html_entity_decode(strip_tags($t), ENT_QUOTES | ENT_XML1, 'UTF-8'));
}

/** Абзацы документа с их позициями. */
function ru8_paras(string $xml): array {
    preg_match_all('~<w:p(?:\s[^>]*)?>.*?</w:p>~su', $xml, $m, PREG_OFFSET_CAPTURE);
    return $m[0] ?? [];
}

/**
 * Границы раздела 8: от заголовка «Пункт №8» до заголовка следующего пункта.
 * @return array{0:int,1:int,2:array} индексы первого и последнего абзаца раздела и сами абзацы
 */
function ru8_section(array $paras): array {
    $from = -1; $to = -1;
    foreach ($paras as $i => [$p, $off]) {
        $t = ru8_text($p);
        if ($from < 0 && preg_match('~^Пункт\s*№\s*8\b~u', $t)) { $from = $i; continue; }
        if ($from >= 0 && preg_match('~^Пункт\s*№\s*9\b~u', $t)) { $to = $i - 1; break; }
    }
    return [$from, $to];
}

$paidF = BASE_PATH . '/docs/polozheniya/etalon_2.docx';   // образец: платный конкурс
$freeF = BASE_PATH . '/docs/polozheniya/etalon_4.docx';   // приводим к нему бесплатный

$line = str_repeat('=', 78);
echo "ЕДИНЫЙ РАЗДЕЛ 8\n$line\n";

$zp = new ZipArchive();
if ($zp->open($paidF) !== true) { echo "  не открылся образец\n"; exit(1); }
$paidXml = (string) $zp->getFromName('word/document.xml');
$zp->close();

$zf = new ZipArchive();
if ($zf->open($freeF) !== true) { echo "  не открылся бесплатный эталон\n"; exit(1); }
$freeXml = (string) $zf->getFromName('word/document.xml');
$zf->close();

$pp = ru8_paras($paidXml);
$fp = ru8_paras($freeXml);
[$pFrom, $pTo] = ru8_section($pp);
[$fFrom, $fTo] = ru8_section($fp);
if ($pFrom < 0 || $pTo < 0 || $fFrom < 0 || $fTo < 0) { echo "  раздел 8 не найден\n"; exit(1); }

printf("  платный эталон:   абзацы %d..%d (%d)\n", $pFrom, $pTo, $pTo - $pFrom + 1);
printf("  бесплатный:       абзацы %d..%d (%d)\n\n", $fFrom, $fTo, $fTo - $fFrom + 1);

/* Собираем новый раздел: заголовок и своя тематика — из бесплатного, всё
   остальное — из платного. */
$newParas = [];
$newParas[] = $fp[$fFrom][0];                                   // «Пункт №8. ТРЕБОВАНИЯ...»
foreach (range($fFrom + 1, $fTo) as $i) {                       // своя строка «8.0. Тематика...»
    if (preg_match('~^8\.0\.~u', ru8_text($fp[$i][0]))) { $newParas[] = $fp[$i][0]; break; }
}
foreach (range($pFrom + 1, $pTo) as $i) {                       // пункты платного, кроме его тематики
    if (preg_match('~^8\.0\.~u', ru8_text($pp[$i][0]))) continue;
    $newParas[] = $pp[$i][0];
}

echo "  РАЗДЕЛ 8 ПОСЛЕ ПРАВКИ (бесплатный конкурс):\n";
foreach ($newParas as $p) {
    $t = ru8_text($p);
    if ($t !== '') printf("    %s\n", mb_substr($t, 0, 96));
}

if (!$apply) { echo "\n$line\n  это предпросмотр: php scripts/regulation_unify8.php --apply\n"; exit(0); }

// Заменяем диапазон абзацев в исходном XML.
$start = $fp[$fFrom][1];
$end   = $fp[$fTo][1] + strlen($fp[$fTo][0]);
$out   = substr($freeXml, 0, $start) . implode('', $newParas) . substr($freeXml, $end);

$tmp = $freeF . '.new';
if (!@copy($freeF, $tmp)) { echo "  копия не создалась\n"; exit(1); }
$z2 = new ZipArchive();
if ($z2->open($tmp) !== true) { @unlink($tmp); echo "  копия не открылась\n"; exit(1); }
$z2->deleteName('word/document.xml');
$z2->addFromString('word/document.xml', $out);
$z2->close();

// Проверяем, что документ читается и оба ключевых пункта на месте.
$z3 = new ZipArchive();
$ok = $z3->open($tmp) === true;
if ($ok) {
    $chk = (string) $z3->getFromName('word/document.xml');
    $z3->close();
    $ok = mb_strpos($chk, 'руки, ноги и лицо') !== false
       && mb_strpos($chk, 'использование фонограммы') !== false
       && mb_strpos($chk, 'ПАТРИОТИЧЕСКАЯ') !== false;
}
if (!$ok) { @unlink($tmp); echo "\n  проверка не прошла — файл не заменён\n"; exit(1); }

@rename($tmp, $freeF);
@chmod($freeF, 0644);
echo "\n$line\n  раздел 8 бесплатного эталона приведён к платному\n";
