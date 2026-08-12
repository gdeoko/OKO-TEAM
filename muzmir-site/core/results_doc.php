<?php
/**
 * Список результатов длинного конкурса в DOCX.
 * Первая страница — эталон-шапка владельца (docs/results_etalon.docx): реквизиты,
 * лого, печать, подпись, «РЕЗУЛЬТАТЫ», название конкурса, правовые основания.
 * Автоматически меняются ТОЛЬКО название конкурса и дата; затем со второй страницы
 * дописывается таблица результатов (ФИО | Коллектив | Название номера | Страна/Город | Результат).
 * Название номера в таблице — только «Название» (work_title_for_list).
 */
declare(strict_types=1);

require_once __DIR__ . '/text_format.php';

/** XML-экранирование для <w:t>. */
function rd_esc(string $s): string { return htmlspecialchars($s, ENT_XML1 | ENT_COMPAT, 'UTF-8'); }

/** Ячейка таблицы Word. */
function rd_cell(string $text, int $w, bool $bold = false, bool $shade = false, bool $center = false): string {
    $rpr = '<w:rPr>' . ($bold ? '<w:b/>' : '') . '<w:sz w:val="20"/><w:szCs w:val="20"/>'
         . '<w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/></w:rPr>';
    $shd = $shade ? '<w:shd w:val="clear" w:color="auto" w:fill="EDEDED"/>' : '';
    $jc  = $center ? '<w:jc w:val="center"/>' : '';
    return '<w:tc><w:tcPr><w:tcW w:w="' . $w . '" w:type="dxa"/><w:vAlign w:val="center"/>' . $shd . '</w:tcPr>'
        . '<w:p><w:pPr><w:spacing w:before="20" w:after="20" w:line="240" w:lineRule="auto"/>' . $jc . '</w:pPr>'
        . '<w:r>' . $rpr . '<w:t xml:space="preserve">' . rd_esc($text) . '</w:t></w:r></w:p></w:tc>';
}

/**
 * Собирает DOCX результатов. Возвращает абсолютный путь к готовому файлу (во временной папке).
 * @throws \RuntimeException
 */
function results_docx(int $compId): string {
    $c = one("SELECT * FROM competitions WHERE id=?", [$compId]);
    if (!$c) throw new \RuntimeException('Конкурс не найден');

    $etalon = BASE_PATH . '/docs/results_etalon.docx';
    if (!is_file($etalon)) throw new \RuntimeException('Эталон шапки результатов не найден (docs/results_etalon.docx)');

    // Длинные конкурсы часто бесплатные — фильтр по оплате НЕ применяем: берём все
    // оценённые (есть звание) и не отклонённые заявки этого конкурса.
    $rows = all("SELECT * FROM applications
                  WHERE competition_id=? AND status<>'rejected'
                    AND result IS NOT NULL AND result<>''
                  ORDER BY full_name COLLATE NOCASE, group_name COLLATE NOCASE", [$compId]);

    // Копия эталона во временный файл.
    $tmpDir = sys_get_temp_dir();
    $out = $tmpDir . '/results_' . $compId . '_' . substr(bin2hex(random_bytes(4)), 0, 8) . '.docx';
    if (!@copy($etalon, $out)) throw new \RuntimeException('Не удалось скопировать эталон');

    $zip = new \ZipArchive();
    if ($zip->open($out) !== true) throw new \RuntimeException('Не удалось открыть DOCX');
    $xml = $zip->getFromName('word/document.xml');
    if ($xml === false || $xml === '') { $zip->close(); @unlink($out); throw new \RuntimeException('Нет word/document.xml'); }

    // 1) Подмена названия конкурса и даты (как в эталоне «Величие России» / «28.08. 2026 год»).
    $nameUp = mb_strtoupper(trim((string) $c['name']), 'UTF-8');
    $xml = str_replace('ВЕЛИЧИЕ РОССИИ', rd_esc($nameUp), $xml);
    $rd = ($c['results_date'] ?? '') ?: ($c['end_date'] ?? '');
    $ts = $rd ? strtotime((string) $rd) : time();
    if (!$ts) $ts = time();
    $xml = str_replace('28.08.', date('d.m.', $ts) , $xml);
    $xml = str_replace('2026 год', date('Y', $ts) . ' год', $xml);

    // 2) Таблица результатов (перед финальным <w:sectPr>): 4 колонки.
    // ФИО и коллектив — в ОДНОЙ графе (пишется что-то одно, без пустого столбца).
    $wc = [2900, 2300, 1700, 2700]; // ФИО/Коллектив | Номер | Страна/Город | Результат
    $grid = '<w:tblGrid>' . implode('', array_map(fn($w) => '<w:gridCol w:w="' . $w . '"/>', $wc)) . '</w:tblGrid>';
    $borders = '<w:tblBorders>'
        . '<w:top w:val="single" w:sz="4" w:space="0" w:color="000000"/>'
        . '<w:left w:val="single" w:sz="4" w:space="0" w:color="000000"/>'
        . '<w:bottom w:val="single" w:sz="4" w:space="0" w:color="000000"/>'
        . '<w:right w:val="single" w:sz="4" w:space="0" w:color="000000"/>'
        . '<w:insideH w:val="single" w:sz="4" w:space="0" w:color="000000"/>'
        . '<w:insideV w:val="single" w:sz="4" w:space="0" w:color="000000"/></w:tblBorders>';
    $tblPr = '<w:tblPr><w:tblW w:w="9600" w:type="dxa"/><w:jc w:val="center"/>' . $borders
           . '<w:tblLook w:val="04A0" w:firstRow="1" w:lastRow="0" w:firstColumn="1" w:lastColumn="0" w:noHBand="0" w:noVBand="1"/></w:tblPr>';

    $head = '<w:tr><w:trPr><w:tblHeader/></w:trPr>'
        . rd_cell('Ф.И.О. участника / название коллектива', $wc[0], true, true, true)
        . rd_cell('Название конкурсного номера', $wc[1], true, true, true)
        . rd_cell('Страна / Город', $wc[2], true, true, true)
        . rd_cell('Аттестационный результат', $wc[3], true, true, true)
        . '</w:tr>';

    $body = '';
    foreach ($rows as $a) {
        // Одна графа: коллектив (если есть) ИЛИ ФИО участника.
        $grp  = trim((string) $a['group_name']);
        $who  = $grp !== '' ? $grp : trim((string) $a['full_name']);
        $work = work_title_for_list((string) $a['work_title']);
        $city = trim((string) ($a['city'] ?? ''));
        if ($city === '') $place = 'Россия';
        elseif (function_exists('city_normalize') && ($cn = city_normalize($city)) !== '') $place = $cn;
        else $place = mb_strpos($city, ',') !== false ? $city : ('Россия, ' . $city);
        $res  = (string) $a['result']
              . (trim((string) ($a['extra_diploma'] ?? '')) !== '' ? '. Дополнительный диплом: ' . (string) $a['extra_diploma'] . '.' : '');
        $body .= '<w:tr>'
            . rd_cell($who, $wc[0])
            . rd_cell($work, $wc[1])
            . rd_cell($place, $wc[2])
            . rd_cell($res, $wc[3])
            . '</w:tr>';
    }
    if ($body === '') {
        $body = '<w:tr>' . rd_cell('Оценённых заявок пока нет.', array_sum($wc), false, false, true) . '</w:tr>';
    }

    $table = '<w:p><w:r><w:br w:type="page"/></w:r></w:p>'
           . '<w:tbl>' . $tblPr . $grid . $head . $body . '</w:tbl>'
           . '<w:p><w:pPr><w:spacing w:after="0"/></w:pPr></w:p>';

    // Вставляем перед последним <w:sectPr> (он на уровне body).
    $pos = strrpos($xml, '<w:sectPr');
    if ($pos === false) { $xml = str_replace('</w:body>', $table . '</w:body>', $xml); }
    else { $xml = substr($xml, 0, $pos) . $table . substr($xml, $pos); }

    if (!$zip->addFromString('word/document.xml', $xml)) { $zip->close(); @unlink($out); throw new \RuntimeException('Не удалось записать document.xml'); }
    $zip->close();
    return $out;
}
