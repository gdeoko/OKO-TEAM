<?php
/**
 * ПРАВКА ЭТАЛОНОВ ПОЛОЖЕНИЯ.
 *
 * Положение каждого конкурса — копия эталона из docs/polozheniya/ с подставленными
 * названием и датами. Значит новый пункт правил дописывается ОДИН раз в эталон, а
 * не руками в четыре открытых конкурса: иначе половина положений останется старой,
 * и участник, прочитавший вчерашний файл, будет прав, а мы нет.
 *
 * Скрипт вносит пункты идемпотентно: если такой текст в документе уже есть, файл не
 * трогается. Абзац создаётся клоном соседнего — так он наследует шрифт, кегль и
 * отступы эталона, а не выпадает из вёрстки чужим стилем.
 *
 *   php scripts/regulation_patch.php           — показать, что будет сделано
 *   php scripts/regulation_patch.php --apply   — внести правки
 *   php scripts/regulation_patch.php --apply --live  — ещё и пересобрать положения
 *                                                      открытых конкурсов
 */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { fwrite(STDERR, "CLI only\n"); exit(1); }

define('BASE_PATH', dirname(__DIR__));
$GLOBALS['CFG'] = require BASE_PATH . '/config.php';
require_once BASE_PATH . '/core/db.php';
require_once BASE_PATH . '/core/helpers.php';

$apply = in_array('--apply', $argv, true);
$live  = in_array('--live',  $argv, true);

/* ── ЧТО ДОБАВЛЯЕМ ───────────────────────────────────────────────────────────
 * Тексты правил владельца — дословно. Меняются только здесь, чтобы формулировка
 * во всех четырёх эталонах была одна и та же до буквы.
 */
const P_VIDEO = 'В конкурсном номере чётко должны быть видны: руки, ноги и лицо исполнителя (в соответствии с номинацией).';
const P_MONEY = 'Подача заявки на изготовление наградного материала (согласно аттестационному результату), осуществляется по вашему личному решению и на добровольной основе!';

/** Текст абзаца DOCX без разметки. */
function rp_text(string $xml): string {
    $t = '';
    if (preg_match_all('~<w:t[^>]*>(.*?)</w:t>~su', $xml, $m)) $t = implode('', $m[1]);
    return trim(html_entity_decode(strip_tags($t), ENT_QUOTES | ENT_XML1, 'UTF-8'));
}

/**
 * Клон абзаца с новым текстом.
 *
 * Берём донора целиком, оставляем его свойства (<w:pPr>) и оформление первого
 * рана (<w:rPr>), а всё содержимое заменяем одной строкой. Так новый пункт
 * выглядит как соседние: тот же шрифт, кегль, интервалы и отступ списка.
 */
function rp_clone(string $donor, string $text): string {
    $pPr = '';
    if (preg_match('~<w:pPr>.*?</w:pPr>~su', $donor, $m)) $pPr = $m[0];
    $rPr = '';
    if (preg_match('~<w:r[ >].*?(<w:rPr>.*?</w:rPr>)~su', $donor, $m)) $rPr = $m[1];
    $esc = htmlspecialchars($text, ENT_XML1 | ENT_QUOTES, 'UTF-8');
    return '<w:p>' . $pPr . '<w:r>' . $rPr . '<w:t xml:space="preserve">' . $esc . '</w:t></w:r></w:p>';
}

/**
 * Внести оба пункта в один DOCX.
 * @return array{changed:bool,notes:array<int,string>}
 */
function rp_patch_docx(string $file, bool $apply): array {
    $notes = [];
    $zip = new ZipArchive();
    if ($zip->open($file) !== true) return ['changed' => false, 'notes' => ['не открылся']];
    $xml = (string) $zip->getFromName('word/document.xml');
    $zip->close();
    if ($xml === '') return ['changed' => false, 'notes' => ['пустой document.xml']];

    $orig = $xml;
    // Абзацы разбираем по позициям, чтобы вставлять точно между ними.
    preg_match_all('~<w:p(?:\s[^>]*)?>.*?</w:p>~su', $xml, $mm, PREG_OFFSET_CAPTURE);
    $paras = $mm[0] ?? [];
    if (!$paras) return ['changed' => false, 'notes' => ['абзацы не найдены']];

    $ins = [];   // позиция в исходном XML => что вставить

    /* 1. ТРЕБОВАНИЯ К КОНКУРСНОМУ МАТЕРИАЛУ — новым пунктом в конце раздела.
     *    Ищем последний пункт «8.N», чтобы номер продолжал нумерацию, а пункт
     *    встал в свой раздел, а не после номинаций. */
    $lastIdx = -1; $lastNum = 0;
    foreach ($paras as $i => [$p, $off]) {
        $t = rp_text($p);
        if (preg_match('~^8\.(\d+)\.?\s~u', $t, $m) || preg_match('~^8\.(\d+)\.?$~u', $t, $m)) {
            $lastIdx = $i; $lastNum = max($lastNum, (int) $m[1]);
        }
    }
    if (mb_strpos($xml, 'руки, ноги и лицо') !== false) {
        $notes[] = 'пункт про руки/ноги/лицо уже есть';
    } elseif ($lastIdx < 0) {
        $notes[] = 'ВНИМАНИЕ: раздел 8 не найден — пункт не добавлен';
    } else {
        [$p, $off] = $paras[$lastIdx];
        $num = '8.' . ($lastNum + 1) . '. ';
        $ins[$off + strlen($p)][] = rp_clone($p, $num . P_VIDEO);
        $notes[] = 'раздел 8: добавлен пункт ' . rtrim($num);
    }

    /* 2. ФИНАНСОВЫЕ УСЛОВИЯ — сразу под заголовком раздела.
     *
     * Проверяем именно начало фразы, а не слова «на добровольной основе»: они
     * встречаются и в согласии участника («решение принимаете самостоятельно и
     * на добровольной основе»), из-за чего проверка считала пункт уже внесённым
     * и молча пропускала эталон. */
    if (mb_strpos($xml, 'Подача заявки на изготовление наградного материала') !== false) {
        $notes[] = 'пункт про добровольность уже есть';
    } else {
        $hIdx = -1;
        foreach ($paras as $i => [$p, $off]) {
            if (mb_stripos(rp_text($p), 'ФИНАНСОВЫЕ УСЛОВИЯ') !== false) { $hIdx = $i; break; }
        }
        if ($hIdx < 0) {
            $notes[] = 'ВНИМАНИЕ: заголовок «ФИНАНСОВЫЕ УСЛОВИЯ» не найден — пункт не добавлен';
        } else {
            // Донор стиля — следующий непустой абзац (обычный текст раздела), а не
            // сам заголовок: иначе фраза напечаталась бы заголовочным кеглем.
            $donor = $paras[$hIdx][0];
            for ($j = $hIdx + 1; $j < count($paras); $j++) {
                if (rp_text($paras[$j][0]) !== '') { $donor = $paras[$j][0]; break; }
            }
            [$hp, $hoff] = $paras[$hIdx];
            $ins[$hoff + strlen($hp)][] = rp_clone($donor, P_MONEY);
            $notes[] = 'финансовые условия: добавлен абзац о добровольности';
        }
    }

    if (!$ins) return ['changed' => false, 'notes' => $notes];
    if (!$apply) return ['changed' => true, 'notes' => $notes];

    // Вставки применяем с конца, чтобы не сбить смещения предыдущих.
    krsort($ins);
    foreach ($ins as $pos => $chunks) {
        $xml = substr($xml, 0, $pos) . implode('', $chunks) . substr($xml, $pos);
    }
    if ($xml === $orig) return ['changed' => false, 'notes' => $notes];

    // Пишем через копию: если запись сорвётся, эталон останется целым.
    $tmp = $file . '.new';
    if (!@copy($file, $tmp)) return ['changed' => false, 'notes' => array_merge($notes, ['копия не создалась'])];
    $z2 = new ZipArchive();
    if ($z2->open($tmp) !== true) { @unlink($tmp); return ['changed' => false, 'notes' => array_merge($notes, ['копия не открылась'])]; }
    $z2->deleteName('word/document.xml');
    $z2->addFromString('word/document.xml', $xml);
    $z2->close();
    // Проверяем, что документ читается и текст на месте.
    $z3 = new ZipArchive();
    $ok = $z3->open($tmp) === true && mb_strpos((string) $z3->getFromName('word/document.xml'), 'руки, ноги и лицо') !== false;
    if ($z3->filename ?? false) $z3->close();
    if (!$ok) { @unlink($tmp); return ['changed' => false, 'notes' => array_merge($notes, ['проверка не прошла, файл не заменён'])]; }
    @copy($file, $file . '.bak');
    @rename($tmp, $file);
    @chmod($file, 0644);
    return ['changed' => true, 'notes' => $notes];
}

$line = str_repeat('=', 74);
echo "ПРАВКА ПОЛОЖЕНИЙ\n$line\n";

/* ── 1. Эталоны ──────────────────────────────────────────────────────────── */
$etalons = glob(BASE_PATH . '/docs/polozheniya/etalon_*.docx') ?: [];
foreach ($etalons as $f) {
    $r = rp_patch_docx($f, $apply);
    printf("  %-16s %s\n", basename($f), $r['changed'] ? 'ПРАВЛЕН' : 'без изменений');
    foreach ($r['notes'] as $n) printf("      %s\n", $n);
}

/* ── 2. Положения открытых конкурсов ─────────────────────────────────────── */
if ($live) {
    echo "\n  Пересборка положений открытых конкурсов:\n";
    require_once BASE_PATH . '/core/regulation_gen.php';
    require_once BASE_PATH . '/core/regulation_pdf.php';
    foreach (all("SELECT * FROM competitions WHERE status='open' ORDER BY id") as $c) {
        try {
            $docx = regulation_generate((int) $c['id']);
            // Ключ кэша PDF учитывает время правки эталона, поэтому старый PDF
            // тут же признаётся устаревшим и собирается заново.
            $c2 = one("SELECT * FROM competitions WHERE id=?", [(int) $c['id']]);
            $pdf = regulation_pdf((array) $c2);
            printf("    #%-3d %-26s docx %s, pdf %s\n", (int) $c['id'], mb_substr((string) $c['name'], 0, 26),
                   is_file($docx) ? 'ок' : 'СБОЙ', is_file($pdf) && filesize($pdf) > 1000 ? 'ок' : 'СБОЙ');
        } catch (\Throwable $e) {
            printf("    #%-3d %-26s ОШИБКА: %s\n", (int) $c['id'], mb_substr((string) $c['name'], 0, 26), $e->getMessage());
        }
    }
}

echo "\n$line\n";
echo $apply ? "  правки применены\n" : "  это предпросмотр: php scripts/regulation_patch.php --apply --live\n";
