<?php
/**
 * core/regulation_pdf.php — PDF положения конкурса 1:1 с эталоном DOCX.
 *
 * Раньше PDF рисовался вручную (core/pdf_regulation.php) и выходил «кривым»
 * (наложения текста/логотипов, рамки). Теперь берём УТВЕРЖДЁННЫЙ эталон .docx
 * (первая страница с шапкой, печатью, подписью, гербами), подставляем в него
 * только дату/сроки/название конкурса (regulation_generate) и конвертируем в PDF
 * через LibreOffice headless — получается 1:1 как в Word.
 *
 * regulation_pdf(array $c): string — путь к готовому PDF (кэшируется рядом с docx).
 */
declare(strict_types=1);

require_once __DIR__ . '/regulation_gen.php';

/** Ключ кэша: PDF пересобирается только при изменении значимых полей конкурса. */
function regulation_pdf_cache_key(array $c): string {
    // Дата запуска входит в ключ: дата утверждения в шапке — 01 число месяца запуска,
    // при переносе запуска положение обязано пересобраться (иначе останется старая шапка).
    $approve = trim((string) ($c['launched_at'] ?? '')) !== '' ? (string) $c['launched_at']
             : (string) ($c['start_date'] ?? '');
    /* ПРАВКА ЭТАЛОНА ОБЯЗАНА ДОЕХАТЬ ДО УЖЕ ОТКРЫТЫХ КОНКУРСОВ.
     *
     * Ключ считался только по полям конкурса, а текст положения живёт в эталоне.
     * Допишешь новый пункт правил — у открытых конкурсов поля не изменились, ключ
     * прежний, и участник продолжает скачивать вчерашнее положение без этого
     * пункта. Берём время последней правки эталонов: изменился текст — PDF
     * пересобирается сам, без ручной чистки кэша. */
    $etalonTs = 0;
    foreach (glob(BASE_PATH . '/docs/polozheniya/etalon_*.docx') ?: [] as $e) {
        $etalonTs = max($etalonTs, (int) @filemtime($e));
    }
    /* ЦЕНА ТОЖЕ В КЛЮЧЕ.
     *
     * Её здесь не было, и оргвзнос в PDF застревал намертво. Владелец поднял
     * «Мировые Таланты» с 500 до 1000 ₽, DOCX пересобрался с новой суммой — а PDF
     * остался прежним, потому что ключ считался без цены. Участник скачивал со
     * страницы конкурса именно PDF и читал там старые 500 ₽: на сайте одна сумма,
     * в документе, по которому он платит, другая. */
    return md5(implode('|', [
        (string) ($c['name'] ?? ''), (string) ($c['end_date'] ?? ''),
        (string) ($c['results_date'] ?? ''), (string) ($c['type'] ?? ''),
        (string) ($c['is_paid'] ?? ''), (string) ($c['price'] ?? ''),
        // Признак конкурса Клуба меняет сам эталон (etalon_5), а значит и весь
        // текст положения — без него PDF застрял бы на прежнем документе.
        (string) ($c['club_only'] ?? ''),
        date('01.m.Y', strtotime($approve) ?: time()),
        'etalon:' . $etalonTs,
        'soffice-v3-price',
    ]));
}

/**
 * Путь к PDF положения (генерирует при необходимости). Бросает исключение при сбое —
 * вызывающий код (public/index.php) сам решает про фолбэк.
 */
function regulation_pdf(array $c): string {
    $compId = (int) ($c['id'] ?? 0);
    $slug   = trim((string) ($c['slug'] ?? '')) ?: ('competition-' . $compId);
    $dir    = BASE_PATH . '/public/uploads/regulations';
    if (!is_dir($dir)) @mkdir($dir, 0775, true);
    $pdf    = $dir . '/' . $slug . '.pdf';
    $keyF   = $pdf . '.key';
    $key    = regulation_pdf_cache_key($c);

    // Кэш-попадание: PDF есть, непустой и ключ совпадает.
    if (is_file($pdf) && filesize($pdf) > 1000 && is_file($keyF) && trim((string) @file_get_contents($keyF)) === $key) {
        return $pdf;
    }

    // 1) Свежий DOCX 1:1 по эталону (подставлены дата/сроки/название).
    $docx = regulation_generate($compId);
    if (!is_file($docx)) throw new \RuntimeException('DOCX положения не создан.');

    // 2) Конвертация в PDF через LibreOffice headless.
    $soffice = trim((string) (@shell_exec('command -v soffice 2>/dev/null')));
    if ($soffice === '' && is_file('/usr/bin/soffice')) $soffice = '/usr/bin/soffice';
    if ($soffice === '') throw new \RuntimeException('LibreOffice (soffice) не установлен.');

    // Отдельный профиль (www-data), иначе soffice может падать без $HOME.
    $profile = sys_get_temp_dir() . '/lo_muzmir_profile';
    if (!is_dir($profile)) @mkdir($profile, 0777, true);

    $expected = preg_replace('~\.docx$~i', '.pdf', $docx);   // soffice кладёт {basename}.pdf в outdir
    @unlink($expected);

    // Важно: soffice в конце делает `cd "$(pwd)"` — если рабочий каталог процесса
    // недоступен www-data (напр. /root), падает «can't cd». Поэтому СНАЧАЛА cd в
    // записываемый каталог. env задаёт HOME (иначе soffice падает без $HOME); НЕ писать
    // «timeout HOME=... soffice» — timeout попытается выполнить «HOME=...» как команду.
    $cmd = 'cd ' . escapeshellarg($profile) . ' && timeout 100 env HOME=' . escapeshellarg($profile) . ' ' . escapeshellarg($soffice)
        . ' --headless --nologo --nolockcheck --nodefault --norestore'
        . ' ' . escapeshellarg('-env:UserInstallation=file://' . $profile)
        . ' --convert-to pdf:writer_pdf_Export --outdir ' . escapeshellarg($dir)
        . ' ' . escapeshellarg($docx) . ' 2>&1';
    $out = (string) @shell_exec($cmd);

    if (!is_file($expected) || filesize($expected) < 1000) {
        throw new \RuntimeException('Конвертация DOCX→PDF не удалась: ' . mb_substr(trim($out), 0, 300));
    }
    if ($expected !== $pdf) { @rename($expected, $pdf); }
    @chmod($pdf, 0664);

    // Проверка сигнатуры PDF.
    $fh = @fopen($pdf, 'rb'); $sig = $fh ? (string) fread($fh, 4) : ''; if ($fh) fclose($fh);
    if (strncmp($sig, '%PDF', 4) !== 0) throw new \RuntimeException('Готовый файл не является PDF.');

    @file_put_contents($keyF, $key);
    return $pdf;
}
