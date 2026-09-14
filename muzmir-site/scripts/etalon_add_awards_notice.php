<?php
/**
 * ПРЕДУПРЕЖДЕНИЕ О ДОБРОВОЛЬНОСТИ ЗАКАЗА — ВО ВСЕ ЭТАЛОНЫ ПОЛОЖЕНИЙ.
 *
 * Решение владельца от 14.09.2026: в разделе «ОФОРМЛЕНИЕ ЗАЯВКИ НА ИЗГОТОВЛЕНИЕ
 * НАГРАДНОГО МАТЕРИАЛА» первыми строками должны стоять три условия — заказ
 * добровольный, подача заявки означает ознакомление с образцами, полученный
 * наградной материал возврату не подлежит. Жирным красным: человек читает
 * положение до оплаты, и эти три строки он обязан увидеть, а не найти.
 *
 * Эталоны правятся один раз, и дальше блок сам попадает в каждое новое
 * положение: core/regulation_gen.php копирует эталон и меняет в нём только
 * название и даты. Уже выпущенные положения перевыпускаются отдельно —
 * scripts/regulations_rebuild.php.
 *
 * Скрипт идемпотентен: блок уже стоит — эталон не трогается. С --force блок
 * сначала вычищается, потом ставится заново.
 *
 * Запуск:  php scripts/etalon_add_awards_notice.php [--force]
 * Правит:  docs/polozheniya/etalon_*.docx
 */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { fwrite(STDERR, "CLI only\n"); exit(1); }

define('BASE_PATH', dirname(__DIR__));

/** Текст блока — дословно, как продиктовал владелец. */
const NOTICE = [
    'Оформление (подача) заявки на изготовление наградного материала (согласно аттестационному результату) осуществляется по Вашему личному желанию и на добровольной основе.',
    'Оформление (подача) заявки на изготовление наградного материала (согласно аттестационному результату) напрямую означает то, что Вы ознакомлены с образцами наградного материала.',
    'После получения заказчиком готового наградного материала (согласно аттестационному результату) денежные средства за полученные наградные материалы возврату не подлежат.',
];

/** Заголовок раздела, после которого встаёт блок. */
const ANCHOR_RE = '~ОФОРМЛЕНИЕ\s+ЗАЯВКИ\s+НА\s+ИЗГОТОВЛЕНИЕ\s+НАГРАДНОГО~u';

$force = in_array('--force', $argv, true);
$files = glob(BASE_PATH . '/docs/polozheniya/etalon_*.docx') ?: [];
if (!$files) { fwrite(STDERR, "эталонов не найдено\n"); exit(1); }

/** Видимый текст абзаца. */
$plain = static function (string $p): string {
    $t = strip_tags(preg_replace('~<w:tab/>~', ' ', $p));
    return trim(html_entity_decode($t, ENT_QUOTES, 'UTF-8'));
};

/**
 * Абзац жирным красным по образцу донора.
 *
 * От донора берём только оформление АБЗАЦА (<w:pPr>: отступы, выключка) и
 * свойства его первого прогона (<w:rPr>: гарнитура, кегль) — иначе новый текст
 * встанет другим шрифтом, чем соседний. К свойствам прогона добавляем жирность
 * и красный цвет, а прежние <w:b>/<w:color> убираем, чтобы не спорили с нашими.
 */
$makeRedBold = static function (string $donor, string $text): string {
    $pPr = '';
    if (preg_match('~<w:pPr\b.*?</w:pPr>~su', $donor, $m)) $pPr = $m[0];

    $rPr = '';
    if (preg_match('~<w:rPr\b.*?</w:rPr>~su', $donor, $m)) {
        $rPr = $m[0];
        $rPr = preg_replace('~<w:b\b[^>]*/>|<w:b\b.*?</w:b>~su', '', $rPr) ?? $rPr;
        $rPr = preg_replace('~<w:bCs\b[^>]*/>~su', '', $rPr) ?? $rPr;
        $rPr = preg_replace('~<w:color\b[^>]*/>~su', '', $rPr) ?? $rPr;
        // Порядок в <w:rPr> для Word важен: b/bCs идут до color, оба — после rFonts.
        $rPr = preg_replace('~^<w:rPr(\s[^>]*)?>~u', '$0<w:b/><w:bCs/><w:color w:val="FF0000"/>', $rPr, 1) ?? $rPr;
    }
    if ($rPr === '') $rPr = '<w:rPr><w:b/><w:bCs/><w:color w:val="FF0000"/></w:rPr>';

    return '<w:p>' . $pPr . '<w:r>' . $rPr
         . '<w:t xml:space="preserve">' . htmlspecialchars($text, ENT_XML1 | ENT_QUOTES, 'UTF-8') . '</w:t>'
         . '</w:r></w:p>';
};

$fail = 0; $done = 0;
foreach ($files as $path) {
    $label = basename($path);

    $zip = new ZipArchive();
    if ($zip->open($path) !== true) { echo "$label: не открывается\n"; $fail++; continue; }
    $xml = (string) $zip->getFromName('word/document.xml');
    if ($xml === '') { $zip->close(); echo "$label: нет document.xml\n"; $fail++; continue; }

    $visible = html_entity_decode(strip_tags($xml), ENT_QUOTES, 'UTF-8');
    $already = mb_strpos($visible, mb_substr(NOTICE[0], 0, 60)) !== false;
    if ($already && !$force) { $zip->close(); echo "$label: блок уже есть — пропуск\n"; continue; }

    // Повторный запуск не должен плодить копии блока: сначала выносим прежний.
    if ($already) {
        preg_match_all('~<w:p\b.*?</w:p>~su', $xml, $m0);
        foreach ($m0[0] as $pp) {
            $txt = $plain($pp);
            if ($txt === '') continue;
            foreach (NOTICE as $line) {
                if ($txt === $line || mb_strpos($txt, mb_substr($line, 0, 60)) === 0) {
                    $xml = str_replace($pp, '', $xml);
                    break;
                }
            }
        }
    }

    preg_match_all('~<w:p\b.*?</w:p>~su', $xml, $m);
    $paras = $m[0];

    $anchor = -1;
    foreach ($paras as $i => $p) {
        if (preg_match(ANCHOR_RE, $plain($p))) { $anchor = $i; break; }
    }
    if ($anchor < 0) { $zip->close(); echo "$label: раздела «Оформление заявки» нет — пропуск\n"; continue; }

    /* Донор оформления — ближайший НИЖЕ обычный абзац раздела, а не заголовок:
     * заголовок набран прописными и по центру, наш текст должен идти как текст. */
    $donor = $paras[$anchor];
    for ($i = $anchor + 1; $i < count($paras); $i++) {
        $t = $plain($paras[$i]);
        if ($t !== '' && mb_strlen($t) > 40 && $t !== mb_strtoupper($t, 'UTF-8')) { $donor = $paras[$i]; break; }
    }

    $block = '';
    foreach (NOTICE as $line) $block .= $makeRedBold($donor, $line);
    $xml = str_replace($paras[$anchor], $paras[$anchor] . $block, $xml);

    $zip->addFromString('word/document.xml', $xml);
    $zip->close();

    // Сверяем результат: строки на месте и красные.
    $chk = new ZipArchive();
    if ($chk->open($path) !== true) { echo "$label: после правки не открывается\n"; $fail++; continue; }
    $out = (string) $chk->getFromName('word/document.xml');
    $chk->close();
    $vis  = html_entity_decode(strip_tags($out), ENT_QUOTES, 'UTF-8');
    $miss = 0;
    foreach (NOTICE as $line) if (mb_strpos($vis, mb_substr($line, 0, 50)) === false) $miss++;
    $red = substr_count($out, 'w:val="FF0000"');

    if ($miss === 0 && $red >= count(NOTICE)) { echo "$label: блок добавлен (3 абзаца, красных прогонов $red)\n"; $done++; }
    else { echo "$label: ПРОПУЩЕНО строк $miss, красных прогонов $red\n"; $fail++; }
}

echo "\nэталонов правлено: $done, ошибок: $fail\n";
exit($fail === 0 ? 0 : 1);
