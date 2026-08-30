<?php
/**
 * core/diploma_render.php — боевой PDF диплома из HTML-шаблона (core/diploma_html.php).
 *
 * На VPS нет Chromium, поэтому печатает бастион oko-poster (Playwright):
 *   1) сайт отдаёт приватную страницу /diploma-render/{application_id}?key=...
 *      (ключ — settings.diploma_render_key, создаётся при первом обращении);
 *   2) бастион открывает её headless-Chromium'ом, печатает в PDF (A4, фон включён)
 *      и кладёт файл обратно на VPS по scp;
 *   3) diploma_pdf_html() возвращает локальный путь к готовому PDF или null —
 *      тогда вызывающий код падает на старый GD-генератор pdf_diploma().
 *
 * Требует в config.local.php: MUZMIR_POSTER_URL, MUZMIR_POSTER_TOKEN,
 * MUZMIR_VPS_SSH_PASS (пароль этого же VPS — для scp с бастиона обратно).
 */
declare(strict_types=1);

/** Ключ доступа к приватному роуту рендера (генерируется один раз). */
function diploma_render_key(): string {
    $k = (string) setting('diploma_render_key', '');
    if ($k === '') {
        $k = bin2hex(random_bytes(24));
        set_setting('diploma_render_key', $k);
    }
    return $k;
}

/**
 * Рендерит боевой PDF по HTML-шаблону. $opt: thanks => благодарность.
 * Возвращает абсолютный путь к PDF в public/diplomas/ или null при неудаче.
 */
function diploma_pdf_html(array $app, array $opt = []): ?string {
    $poster = rtrim((string) cfgv('poster_url'), '/');
    $token  = (string) cfgv('poster_token');
    $sshPas = (string) cfgv('vps_ssh_pass');
    $appId  = (int) ($app['id'] ?? 0);
    if ($poster === '' || $token === '' || $sshPas === '' || $appId <= 0) return null;

    $type  = !empty($opt['thanks']) ? 'thanks' : (!empty($opt['extra']) ? 'extra' : (!empty($opt['named']) ? 'named' : 'main'));
    $clean = !empty($opt['clean']);
    // Благодарность выписывается на КОНКРЕТНОЕ ФИО (одна благодарность = один педагог).
    $person = trim((string) ($opt['person'] ?? ''));
    $pidx   = (int) ($opt['person_idx'] ?? 0);
    $url  = rtrim((string) cfgv('base_url'), '/') . '/diploma-render/' . $appId
          . '?key=' . diploma_render_key()
          . ($type !== 'main' ? '&type=' . $type : '')
          // ФИО и порядковый номер получателя передаём ВМЕСТЕ. ФИО решает, чьё имя
          // напечатать, номер — какой номер поставить на бланк. Раньше при заданном
          // ФИО номер не передавался вовсе, и печать считала его сама: если человека
          // не оказывалось в списке педагогов заявки (заказ на второго руководителя,
          // ФИО с другой раскладкой), бланк получал номер первой благодарности, а в
          // реестре он уже был занят.
          . ($person !== '' ? '&person=' . rawurlencode($person) : '')
          . ($pidx > 0 ? '&pidx=' . $pidx : '')
          . ($clean ? '&clean=1' : '');

    // Имя файла строим от КАНОНИЧЕСКОГО номера диплома, а не от номера заявки:
    // у одной заявки бывает основной, именной, благодарность и несколько спец-наград,
    // и все они писались бы в один и тот же файл, затирая друг друга.
    $num  = (string) ($app['diploma_number'] ?? $app['number'] ?? ('APP' . $appId));
    // В имени файла учитываем получателя: у двух педагогов — две разные благодарности.
    $tag  = $person !== '' ? substr(md5($person), 0, 6) : ($pidx > 0 ? 'p' . $pidx : '');
    $slug = trim(strtolower((string) preg_replace('/[^a-z0-9]+/i', '-',
                 $num . '-' . $type . ($tag !== '' ? '-' . $tag : '') . ($clean ? '-clean' : ''))), '-');
    // ЧИСТЫЙ БЛАНК — НЕ ПУБЛИЧНЫЙ ФАЙЛ.
    //
    // Раньше он писался туда же, куда и готовый диплом: в public/diplomas/. Имя
    // строится от номера диплома, который участник знает наизусть — он есть в
    // письме и в кабинете. Значит, подставив к своему номеру «-clean», человек
    // скачивал бланк БЕЗ ПОДПИСИ И ПЕЧАТИ и мог напечатать его сам, минуя заказ
    // оригинала. Ровно этого владелец и не хотел: заказавший оригинал получает
    // документ почтой, а в кабинете видит только изготовление, отправку и трек.
    //
    // Бланки уезжают в закрытый каталог вне веб-корня. Их открывает админка через
    // свой маршрут с проверкой входа (см. order_clean_url в core/orders.php).
    $outDir = $clean ? BASE_PATH . '/data/clean_blanks/' : BASE_PATH . '/public/diplomas/';
    if (!is_dir($outDir)) @mkdir($outDir, 0775, true);
    $out = $outDir . 'diploma_' . $slug . '.pdf';
    // ГОТОВЫЙ ДИПЛОМ НЕ СНОСИМ ДО УСПЕХА.
    // Здесь стоял @unlink($out) перед рендером: если бастион не отвечал, участник
    // оставался вообще без файла — письмо уходило с пустым вложением, а в кабинете
    // ломалась ссылка. Пишем рядом и подменяем оригинал только после проверки.
    $stage = $outDir . 'diploma_' . $slug . '.new.pdf';
    @unlink($stage);

    $tmp = '/tmp/dip_' . $appId . '_' . substr(bin2hex(random_bytes(4)), 0, 8) . '.pdf';
    /* БРАУЗЕР ЛЕЖИТ РЯДОМ С АГЕНТОМ, А НЕ В ДОМАШНЕМ КАТАЛОГЕ.
     *
     * Playwright без подсказки ищет браузеры в ~/.cache/ms-playwright. Пока они
     * там были, рендер работал; при чистке диска на бастионе каталог снесли — и
     * бланки перестали собираться ВСЕ разом, молча: генерация возвращала null,
     * позиция просто исчезала из списка на печать. Так у заказа №67 из трёх
     * позиций на скачивание осталась одна благодарность.
     *
     * Указываем путь явно: браузеры живут в /opt/oko-poster/pw-browsers (там же,
     * куда смотрят cfg/rb.env и rbd.env остальных заданий агента). */
    $cmd = 'cd /opt/oko-poster && PLAYWRIGHT_BROWSERS_PATH=/opt/oko-poster/pw-browsers '
         . 'NODE_PATH=/opt/oko-poster/node_modules node render_diploma.js '
         . escapeshellarg($url) . ' ' . escapeshellarg($tmp)
         . ' && export SSHPASS=' . escapeshellarg($sshPas)
         . '; sshpass -e scp -o StrictHostKeyChecking=no ' . escapeshellarg($tmp)
         . ' root@176.124.200.169:' . escapeshellarg($stage)
         . ' && rm -f ' . escapeshellarg($tmp) . ' && echo RENDER_OK';

    $ch = curl_init($poster);
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 120,
        CURLOPT_HTTPHEADER => ['Authorization: Bearer ' . $token, 'Content-Type: application/json'],
        CURLOPT_POSTFIELDS => json_encode(['cmd' => $cmd], JSON_UNESCAPED_SLASHES),
    ]);
    $resp = curl_exec($ch);
    curl_close($ch);
    if (!is_string($resp) || !str_contains($resp, 'RENDER_OK')) {
        error_log('diploma_pdf_html(' . $appId . '): bastion render failed: ' . substr((string)$resp, 0, 300));
        @unlink($stage);
        // Прежний файл цел — им и продолжаем пользоваться, если он был.
        clearstatcache(true, $out);
        return (is_file($out) && filesize($out) > 20000) ? $out : null;
    }
    clearstatcache(true, $stage);
    if (!is_file($stage) || filesize($stage) <= 20000) {
        @unlink($stage);
        clearstatcache(true, $out);
        return (is_file($out) && filesize($out) > 20000) ? $out : null;
    }
    // Рендер удался — только теперь заменяем боевой файл.
    if (!@rename($stage, $out)) { @unlink($stage); return null; }
    clearstatcache(true, $out);

    // Сжатие PDF (Ghostscript): фон-фото даунсемплится до 150dpi, ТЕКСТ и QR остаются
    // векторными/резкими. Тяжёлый диплом ~4МБ → ~0.8-1.2МБ, чтобы 3 файла (осн+доп+
    // благодарность) проходили одним письмом без спам-режекта Яндекса по размеру.
    diploma_compress_pdf($out);
    clearstatcache(true, $out);
    return $out;
}

/** Сжимает PDF на месте через Ghostscript (/ebook ~150dpi). Тихо пропускает, если gs нет. */
function diploma_compress_pdf(string $path): void {
    if (!is_file($path)) return;
    $gs = trim((string) @shell_exec('command -v gs 2>/dev/null'));
    if ($gs === '') return;
    $before = (int) filesize($path);
    $tmp = $path . '.gs.pdf';
    $cmd = escapeshellarg($gs) . ' -sDEVICE=pdfwrite -dCompatibilityLevel=1.5 -dPDFSETTINGS=/ebook'
         . ' -dDownsampleColorImages=true -dColorImageResolution=150'
         . ' -dNOPAUSE -dQUIET -dBATCH -sOutputFile=' . escapeshellarg($tmp) . ' ' . escapeshellarg($path) . ' 2>/dev/null';
    @shell_exec($cmd);
    clearstatcache(true, $tmp);
    // Заменяем только если сжатие удалось и файл заметно меньше и не битый.
    if (is_file($tmp) && filesize($tmp) > 20000 && filesize($tmp) < $before) {
        @rename($tmp, $path);
    } else {
        @unlink($tmp);
    }
}
