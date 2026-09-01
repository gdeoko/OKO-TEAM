<?php
/**
 * СРОКИ ИЗГОТОВЛЕНИЯ НАГРАДНОГО МАТЕРИАЛА — ВО ВСЕ ЭТАЛОНЫ ПОЛОЖЕНИЙ.
 *
 * Решение владельца: сроки должны стоять в положении каждого конкурса, а не
 * только в письмах и в разделе «Вопросы и ответы». Человек читает положение
 * перед подачей заявки и должен там же видеть, когда придёт результат и когда
 * будет изготовлена награда - иначе спор о сроках возникает уже после оплаты.
 *
 * Эталоны правятся один раз, и дальше сроки сами попадают в каждое новое
 * положение: core/regulation_gen.php копирует эталон и меняет в нём только
 * название и даты.
 *
 * Скрипт идемпотентен: если блок уже вставлен, эталон не трогается.
 *
 * Запуск:  php scripts/etalon_add_terms.php [--force]
 * Правит:  docs/polozheniya/etalon_2.docx (платный), etalon_4.docx (бесплатный)
 */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { fwrite(STDERR, "CLI only\n"); exit(1); }

define('BASE_PATH', dirname(__DIR__));

/** Текст блока. Формулировки владельца, дословно по смыслу. */
/* Решение владельца: первая строка про «изготовление в течение 5 рабочих дней с
 * момента подачи заявки» убрана - она повторяла следующую и путала: срок один и
 * тот же, а выглядело как два разных этапа. */
const TERMS = [
    'СРОКИ ИЗГОТОВЛЕНИЯ И НАПРАВЛЕНИЯ НАГРАДНОГО МАТЕРИАЛА',
    'Наградной материал согласно аттестационному результату направляется на электронную почту, указанную в заявке, в течение 5 (пяти) рабочих дней.',
    'Оригиналы наградного материала изготавливаются в течение 7 (семи) рабочих дней и направляются Почтой России; срок доставки составляет до 14 (четырнадцати) рабочих дней в зависимости от удалённости адреса доставки.',
];

$force = in_array('--force', $argv, true);
$files = [
    BASE_PATH . '/docs/polozheniya/etalon_2.docx',   // платный
    BASE_PATH . '/docs/polozheniya/etalon_4.docx',   // бесплатный
];

/** Видимый текст абзаца. */
$plain = static function (string $p): string {
    $t = strip_tags(preg_replace('~<w:tab/>~', ' ', $p));
    return trim(html_entity_decode($t, ENT_QUOTES, 'UTF-8'));
};

/** Индекс первого абзаца, подходящего под образец. */
$find = static function (array $paras, string $re, callable $plain, int $from = 0): int {
    foreach ($paras as $i => $p) {
        if ($i < $from) continue;
        if (preg_match($re, $plain($p))) return $i;
    }
    return -1;
};

/**
 * Новый абзац по образцу донора: оформление донора, текст наш.
 * Донор должен быть однорунным по видимому тексту, поэтому все прогоны кроме
 * первого гасим, а в первый кладём нужный текст.
 */
$make = static function (string $donor, string $text): string {
    $first = true;
    return preg_replace_callback('~<w:t(\s[^>]*)?>.*?</w:t>~su', function () use (&$first, $text): string {
        if ($first) {
            $first = false;
            return '<w:t xml:space="preserve">' . htmlspecialchars($text, ENT_XML1 | ENT_QUOTES, 'UTF-8') . '</w:t>';
        }
        return '<w:t xml:space="preserve"></w:t>';
    }, $donor);
};

$fail = 0;
foreach ($files as $path) {
    $label = basename($path);
    if (!is_file($path)) { echo "$label: файла нет — пропуск\n"; continue; }

    $zip = new ZipArchive();
    if ($zip->open($path) !== true) { echo "$label: не открывается\n"; $fail++; continue; }
    $xml = (string) $zip->getFromName('word/document.xml');
    if ($xml === '') { $zip->close(); echo "$label: нет document.xml\n"; $fail++; continue; }

    // Уже вставляли — второй раз не нужно.
    $visible = html_entity_decode(strip_tags($xml), ENT_QUOTES, 'UTF-8');
    if (!$force && mb_strpos($visible, mb_substr(TERMS[1], 0, 45)) !== false) {
        $zip->close(); echo "$label: сроки уже есть — пропуск\n"; continue;
    }

    /* СНАЧАЛА ВЫЧИЩАЕМ ПРЕЖНИЙ БЛОК.
     *
     * При повторном запуске с --force блок вставлялся ещё раз, и в эталоне
     * оказывалось два раздела сроков подряд, причём один со старой, отменённой
     * формулировкой. Поэтому перед вставкой удаляем все абзацы, которые узнаются
     * как строки блока - и нынешние, и прежние. */
    preg_match_all('~<w:p\b.*?</w:p>~su', $xml, $m0);
    $known = array_merge(TERMS, [
        'Изготовление наградного материала в соответствии с аттестационным результатом осуществляется в течение 5 (пяти) рабочих дней с момента подачи заявки на изготовление.',
    ]);
    foreach ($m0[0] as $pp) {
        $txt = $plain($pp);
        if ($txt === '') continue;
        foreach ($known as $line) {
            if ($txt === $line || mb_strpos($txt, mb_substr($line, 0, 45)) === 0) {
                $xml = str_replace($pp, '', $xml);
                break;
            }
        }
    }

    preg_match_all('~<w:p\b.*?</w:p>~su', $xml, $m);
    $paras = $m[0];

    /* Блок ставим в раздел о наградах: там он читается по месту. Если такого
     * раздела в эталоне нет, встаём после финансовых условий - это последний
     * раздел, который человек читает перед подачей. */
    $anchor = $find($paras, '~НАГРАЖДЕНИ|НАГРАДН~u', $plain);
    if ($anchor < 0) $anchor = $find($paras, '~^ФИНАНСОВЫЕ УСЛОВИЯ~u', $plain);
    if ($anchor < 0) { $zip->close(); echo "$label: не найдено место для вставки\n"; $fail++; continue; }

    /* Донором берём ОБЫЧНЫЙ абзац этого раздела, а не заголовок: заголовок
     * набран прописными и по центру, наш текст должен выглядеть как текст. */
    $donor = $paras[$anchor];
    for ($i = $anchor + 1; $i < count($paras); $i++) {
        $t = $plain($paras[$i]);
        if ($t !== '' && mb_strlen($t) > 40 && $t !== mb_strtoupper($t, 'UTF-8')) { $donor = $paras[$i]; break; }
    }

    $block = '';
    foreach (TERMS as $line) $block .= $make($donor, $line);
    $xml = str_replace($paras[$anchor], $paras[$anchor] . $block, $xml);

    $zip->addFromString('word/document.xml', $xml);
    $zip->close();

    // Проверяем, что строки действительно попали в документ.
    $chk = new ZipArchive();
    if ($chk->open($path) !== true) { echo "$label: после правки не открывается\n"; $fail++; continue; }
    $out = html_entity_decode(strip_tags((string) $chk->getFromName('word/document.xml')), ENT_QUOTES, 'UTF-8');
    $chk->close();
    $miss = 0;
    foreach (TERMS as $line) {
        if (mb_strpos($out, mb_substr($line, 0, 40)) === false) $miss++;
    }
    echo $miss === 0
        ? "$label: сроки добавлены (абзацев " . count(TERMS) . ")\n"
        : "$label: ПРОПУЩЕНО строк $miss\n";
    if ($miss) $fail++;
}
exit($fail === 0 ? 0 : 1);
