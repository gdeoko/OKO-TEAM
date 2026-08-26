<?php
/**
 * КОГДА РАБОТА СНЯТА И КОГДА ЗАГРУЖЕНА.
 *
 * Положение (п. 8.11) не принимает материал старше года С МОМЕНТА ИСПОЛНЕНИЯ, и
 * владелец отклоняет именно по дате съёмки: в причине у него так и написано —
 * «Конкурсный материал старше 1 года с момента исполнения. Дата съёмки 24 марта».
 * Пятнадцать отказов из ста шестнадцати — ровно по этому основанию, и каждый раз
 * дату приходилось смотреть руками.
 *
 * ДВЕ РАЗНЫЕ ДАТЫ, И ПУТАТЬ ИХ НЕЛЬЗЯ.
 *   съёмка   — когда номер исполнен. Живёт внутри файла: EXIF у фотографии,
 *              creation_time в контейнере у видео. Это то, что судит положение.
 *   загрузка — когда файл положили в облако. Отдаёт облако по ссылке. Съёмка
 *              никогда не позже загрузки, поэтому старая загрузка — сама по себе
 *              доказательство: снято не позже неё.
 *
 * Отсюда правило: есть съёмка — судим по ней. Съёмки нет (метаданные вычищены
 * при перекодировании, а это обычное дело) — судим по загрузке, но только чтобы
 * ОТКЛОНИТЬ заведомо старое; молодая загрузка ничего не доказывает, работа могла
 * быть снята три года назад и залита вчера.
 */
declare(strict_types=1);

/** Сколько лет живёт конкурсный материал по положению. */
const MEDIA_MAX_AGE_YEARS = 1;

/**
 * Дата съёмки и дата загрузки по ссылке и (если уже скачан) по самому файлу.
 *
 * @param  string $url   ссылка участника
 * @param  string $file  локальный путь к скачанному файлу ('' — только облако)
 * @return array{shot:?int, uploaded:?int, source:string, why:string}
 *         shot/uploaded — метки времени или null, source — откуда взяли съёмку.
 */
function media_dates(string $url, string $file = ''): array {
    $out = ['shot' => null, 'uploaded' => null, 'source' => '', 'why' => ''];

    // 1. Облако: дата загрузки, иногда и съёмка (Яндекс отдаёт exif, если он цел).
    $cloud = media_cloud_dates($url);
    $out['uploaded'] = $cloud['uploaded'];
    if ($cloud['shot'] !== null) { $out['shot'] = $cloud['shot']; $out['source'] = $cloud['source']; }

    // 2. Файл: самый надёжный источник съёмки — метаданные внутри работы.
    if ($file !== '' && is_file($file)) {
        $local = media_file_shot_date($file);
        if ($local['ts'] !== null) { $out['shot'] = $local['ts']; $out['source'] = $local['source']; }
    }
    if ($out['shot'] === null && $out['uploaded'] === null) {
        $out['why'] = 'дата не определяется: площадка её не отдаёт, в файле метаданных нет';
    }
    return $out;
}

/**
 * Даты из облака по публичной ссылке.
 * Яндекс.Диск и Облако Mail.ru отдают их открытым API, без ключей.
 */
function media_cloud_dates(string $url): array {
    $out = ['shot' => null, 'uploaded' => null, 'source' => ''];
    $url = trim($url);
    if ($url === '') return $out;
    $host = mb_strtolower((string) (parse_url($url, PHP_URL_HOST) ?: ''));

    /* ---- Яндекс.Диск ---- */
    if (str_contains($host, 'disk.yandex') || str_contains($host, 'yadi.sk')) {
        $j = media_http_json('https://cloud-api.yandex.net/v1/disk/public/resources?public_key='
                             . rawurlencode($url));
        if (is_array($j)) {
            $up = strtotime((string) ($j['created'] ?? $j['modified'] ?? ''));
            if ($up) $out['uploaded'] = $up;
            /* EXIF у Яндекса чаще пуст: телефоны и монтажки метаданные вычищают.
               Когда он всё же есть — это дата съёмки, и она главнее загрузки. */
            $ex = $j['exif'] ?? [];
            $dt = is_array($ex) ? (string) ($ex['date_time'] ?? '') : '';
            if ($dt !== '' && ($ts = strtotime($dt))) {
                $out['shot'] = $ts;
                $out['source'] = 'EXIF на Яндекс.Диске';
            }
        }
        return $out;
    }

    /* ---- Облако Mail.ru ---- */
    if (str_contains($host, 'cloud.mail.ru')) {
        if (preg_match('~cloud\.mail\.ru/public/([^/?#]+/[^/?#]+)~i', $url, $m)) {
            $j = media_http_json('https://cloud.mail.ru/api/v2/folder?weblink='
                                 . rawurlencode($m[1]) . '&api=2');
            $body = is_array($j) ? ($j['body'] ?? []) : [];
            $mtime = (int) ($body['mtime'] ?? 0);
            if (!$mtime && !empty($body['list'][0]['mtime'])) $mtime = (int) $body['list'][0]['mtime'];
            if ($mtime > 0) $out['uploaded'] = $mtime;
        }
        return $out;
    }

    return $out;   // остальные площадки дат не отдают — судим по файлу
}

/**
 * Дата съёмки из самого файла: EXIF у изображения, creation_time у видео.
 *
 * ffprobe пишет creation_time камеры, но монтажные программы иногда ставят туда
 * дату экспорта. Это всё равно верхняя граница: позже съёмки экспорт быть может,
 * раньше — нет, поэтому для «старше года» показание годное.
 */
function media_file_shot_date(string $file): array {
    $out = ['ts' => null, 'source' => ''];
    if (!is_file($file)) return $out;
    $ext = mb_strtolower((string) pathinfo($file, PATHINFO_EXTENSION));

    if (in_array($ext, ['jpg', 'jpeg', 'tif', 'tiff'], true) && function_exists('exif_read_data')) {
        $ex = @exif_read_data($file);
        foreach (['DateTimeOriginal', 'DateTimeDigitized', 'DateTime'] as $k) {
            $v = is_array($ex) ? (string) ($ex[$k] ?? '') : '';
            if ($v === '') continue;
            // EXIF пишет «2025:03:24 18:40:11» — двоеточия в дате strtotime не понимает.
            $v = preg_replace('~^(\d{4}):(\d{2}):(\d{2})~', '$1-$2-$3', $v);
            $ts = strtotime($v);
            if ($ts) { $out['ts'] = $ts; $out['source'] = 'EXIF снимка (' . $k . ')'; return $out; }
        }
        return $out;
    }

    // Видео и звук: спрашиваем контейнер.
    $cmd = 'ffprobe -v quiet -print_format json -show_format -show_streams '
         . escapeshellarg($file) . ' 2>/dev/null';
    $j = json_decode((string) @shell_exec($cmd), true);
    if (!is_array($j)) return $out;
    $cands = [];
    $ct = (string) ($j['format']['tags']['creation_time'] ?? '');
    if ($ct !== '') $cands[] = ['creation_time контейнера', $ct];
    foreach ((array) ($j['streams'] ?? []) as $st) {
        $sct = (string) ($st['tags']['creation_time'] ?? '');
        if ($sct !== '') $cands[] = ['creation_time дорожки', $sct];
    }
    foreach ($cands as [$src, $v]) {
        $ts = strtotime($v);
        /* Ноль и 1904 год — заглушки контейнера, а не съёмка: QuickTime считает
           время от 1904-го, и пустое поле превращается именно в него. */
        if ($ts && $ts > strtotime('2000-01-01')) { $out['ts'] = $ts; $out['source'] = $src; return $out; }
    }
    return $out;
}

/**
 * Старше ли материал допустимого возраста. Возвращает готовое решение и причину
 * теми же словами, какими владелец пишет отказ.
 *
 * @return array{old:bool, ts:?int, source:string, reason:string, note:string}
 */
function media_too_old(string $url, string $file = '', ?string $deadline = null): array {
    $d = media_dates($url, $file);
    $limit = strtotime('-' . MEDIA_MAX_AGE_YEARS . ' year', $deadline ? (int) strtotime($deadline) : time());

    /* Дату в отказе пишем цифрами и с новой строки — ровно так, как её пишет
       владелец: «Конкурсный материал старше 1 года с момента исполнения
       (п. 8.11 положения).\nДата съёмки:24.09.2024». Участник сверяет её со своим
       файлом, и словесная запись («двадцать четвёртого сентября») здесь только
       мешает: в свойствах файла у него стоит то же самое цифрами. */
    $ru = static fn(int $ts): string => date('d.m.Y', $ts);

    if ($d['shot'] !== null) {
        $old = $d['shot'] < $limit;
        return ['old' => $old, 'ts' => $d['shot'], 'source' => $d['source'],
            'reason' => $old
                ? 'Конкурсный материал старше 1 года с момента исполнения (п. 8.11 положения).' . "\n"
                  . 'Дата съёмки: ' . $ru($d['shot'])
                : '',
            'note' => 'дата съёмки ' . $ru($d['shot']) . ' (' . $d['source'] . ')'];
    }

    /* Съёмки нет — судим по загрузке, и только в одну сторону. Старая загрузка
       доказывает, что снято не позже неё; свежая не доказывает ничего. */
    if ($d['uploaded'] !== null && $d['uploaded'] < $limit) {
        return ['old' => true, 'ts' => $d['uploaded'], 'source' => 'дата загрузки в облако',
            'reason' => 'Конкурсный материал старше 1 года с момента исполнения (п. 8.11 положения).' . "\n"
                      . 'Файл загружен ' . $ru($d['uploaded']) . ', то есть снят не позже этой даты.',
            'note' => 'загружен ' . $ru($d['uploaded']) . ', даты съёмки в файле нет'];
    }

    return ['old' => false, 'ts' => $d['uploaded'], 'source' => $d['source'],
        'reason' => '',
        'note' => $d['uploaded'] !== null
            ? 'загружен ' . $ru($d['uploaded']) . ', даты съёмки в файле нет'
            : ($d['why'] !== '' ? $d['why'] : 'дата не определилась')];
}

/** HTTP GET с разбором JSON. Молчит при любой ошибке: даты — не повод падать. */
function media_http_json(string $url, int $timeout = 15): ?array {
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => 1, CURLOPT_TIMEOUT => $timeout,
        CURLOPT_FOLLOWLOCATION => 1, CURLOPT_MAXREDIRS => 3,
        CURLOPT_USERAGENT => 'MuzmirGrader/1.0',
    ]);
    $b = curl_exec($ch);
    $c = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    if ($c !== 200 || !is_string($b)) return null;
    $j = json_decode($b, true);
    return is_array($j) ? $j : null;
}
