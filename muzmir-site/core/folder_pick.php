<?php
/**
 * КАКАЯ ИЗ РАБОТ В ПАПКЕ — ЭТА.
 *
 * Участники присылают ссылку на папку облака чаще, чем на файл: так проще
 * поделиться, и в телефоне кнопка «поделиться» отдаёт именно папку. До сих пор
 * это означало отказ по п. 8.1 («одна заявка — один конкурсный материал»), и
 * пятнадцать работ пересмотра остались без оценки — при том что внутри у
 * большинства лежит ровно один номер, а у остальных нужный файл подписан
 * фамилией участника или названием работы.
 *
 * Отказ здесь уместен только в одном случае: когда по папке действительно
 * нельзя понять, какая работа чья, — школа выложила три десятка рисунков разом.
 * Всё остальное надо разбирать, а не отбрасывать.
 *
 * ПОРЯДОК РАЗБОРА:
 *   1. Один медиафайл в папке — он и есть работа, вопросов нет.
 *   2. Несколько — сверяем имена файлов с заявкой: фамилия и имя участника,
 *      название коллектива, название конкурсной работы. Совпал ровно один —
 *      берём его.
 *   3. Совпало несколько или ни одного — отказ, и в причине перечислено, что
 *      лежит в папке: участнику видно, почему по такой ссылке работу не найти.
 *
 * ЧЕГО ТУТ НАМЕРЕННО НЕТ. Выбора «первого попавшегося файла»: именно так
 * тридцать шесть участников могли получить звание за чужую работу — папка была
 * одна на весь класс, а разбор брал из неё верхний рисунок.
 */
declare(strict_types=1);

/** Расширения, которые вообще могут быть конкурсной работой. */
function fp_media_ext(): array {
    return ['mp4', 'mov', 'm4v', 'webm', 'mkv', 'avi', 'mpg', 'mpeg', '3gp',
            'jpg', 'jpeg', 'png', 'webp', 'heic', 'heif', 'bmp', 'tif', 'tiff'];
}

/**
 * Список файлов публичной папки облака.
 *
 * @return array<int, array{name:string, path:string, size:int, mime:string, shot:?int, uploaded:?int, url:string}>
 */
function fp_list(string $url): array {
    $out = [];
    $u = mb_strtolower(trim($url));
    if ($u === '') return $out;

    try {
        /* ---- Яндекс.Диск ---- */
        if (str_contains($u, 'disk.yandex') || str_contains($u, 'yadi.sk')) {
            $meta = fp_json('https://cloud-api.yandex.net/v1/disk/public/resources?public_key='
                          . rawurlencode($url) . '&limit=200');
            if (!is_array($meta)) return $out;
            if ((string) ($meta['type'] ?? '') === 'file') {
                return [fp_row_yandex($meta, $url)];
            }
            foreach ((array) ($meta['_embedded']['items'] ?? []) as $it) {
                if ((string) ($it['type'] ?? '') !== 'file') continue;
                $out[] = fp_row_yandex((array) $it, $url);
            }
            return $out;
        }

        /* ---- Облако Mail.ru ---- */
        if (str_contains($u, 'cloud.mail.ru')) {
            if (!preg_match('~cloud\.mail\.ru/public/([^/?#]+)/([^?#]+)~i', $url, $m)) return $out;
            $weblink = $m[1] . '/' . ltrim($m[2], '/');
            $info = fp_json('https://cloud.mail.ru/api/v2/file?weblink=' . rawurlencode($weblink) . '&api=2');
            $body = is_array($info) ? (array) ($info['body'] ?? []) : [];
            if ((string) ($body['kind'] ?? '') === 'file') {
                return [fp_row_mail($body, $weblink)];
            }
            /* СПИСОК ПАПКИ ОТДАЁТ ДРУГАЯ РУЧКА.
             *
             * api/v2/file про папку отвечает «kind: folder», но список внутри
             * оставляет пустым — тринадцать заявок по изобразительному искусству
             * выглядели как «в папке нет ни одного файла с работой», хотя рисунки
             * там лежали. Содержимое отдаёт api/v2/folder. */
            if (!$body || !($body['list'] ?? [])) {
                $f = fp_json('https://cloud.mail.ru/api/v2/folder?weblink=' . rawurlencode($weblink) . '&api=2');
                $body = is_array($f) ? (array) ($f['body'] ?? []) : $body;
            }
            foreach ((array) ($body['list'] ?? []) as $it) {
                if ((string) ($it['kind'] ?? '') !== 'file') continue;
                $out[] = fp_row_mail((array) $it, $weblink);
            }
            return $out;
        }
    } catch (\Throwable $e) { return []; }

    return $out;
}

/** Строка файла Яндекс.Диска в общем виде. */
function fp_row_yandex(array $it, string $publicKey): array {
    $ex = (array) ($it['exif'] ?? []);
    $shot = '';
    foreach (['date_time'] as $k) { if (!empty($ex[$k])) { $shot = (string) $ex[$k]; break; } }
    if ($shot === '' && !empty($it['photoslice_time'])) $shot = (string) $it['photoslice_time'];
    return [
        'name'     => (string) ($it['name'] ?? ''),
        'path'     => (string) ($it['path'] ?? ''),
        'size'     => (int) ($it['size'] ?? 0),
        'mime'     => (string) ($it['mime_type'] ?? ''),
        'shot'     => $shot !== '' ? (strtotime($shot) ?: null) : null,
        'uploaded' => strtotime((string) ($it['created'] ?? $it['modified'] ?? '')) ?: null,
        'url'      => (string) ($it['file'] ?? ''),   // прямая ссылка, если отдана
        'key'      => $publicKey,
    ];
}

/** Строка файла Облака Mail.ru в общем виде. */
function fp_row_mail(array $it, string $weblink): array {
    $mtime = (int) ($it['mtime'] ?? 0);
    $name  = (string) ($it['name'] ?? '');
    return [
        'name'     => $name,
        'path'     => (string) ($it['home'] ?? $it['weblink'] ?? $name),
        'size'     => (int) ($it['size'] ?? 0),
        'mime'     => (string) ($it['type'] ?? ''),
        /* Облако не отдаёт EXIF по публичной ссылке: у него в ответе только
           mtime — время файла в хранилище. Это дата загрузки, и выдавать её за
           дату съёмки нельзя (см. core/media_date.php). */
        'shot'     => null,
        'uploaded' => $mtime > 0 ? $mtime : null,
        'url'      => '',
        'key'      => $weblink,
    ];
}

/** Только то, что может быть конкурсной работой. */
function fp_only_media(array $files): array {
    $ext = fp_media_ext();
    return array_values(array_filter($files, static function (array $f) use ($ext): bool {
        $e = mb_strtolower((string) pathinfo((string) $f['name'], PATHINFO_EXTENSION));
        if (in_array($e, $ext, true)) return true;
        return (bool) preg_match('~^(video|image)/~i', (string) $f['mime']);
    }));
}

/**
 * Имя файла к сравнимому виду: без расширения, без знаков, «ё» как «е».
 * Участники подписывают файлы как придётся — «Иванова_Маша (1).mp4»,
 * «ИВАНОВА МАРИЯ - Осень.MOV», — и без приведения совпадений не найти.
 */
function fp_norm(string $s): string {
    $s = mb_strtolower(trim($s));
    $s = preg_replace('~\.[a-z0-9]{2,5}$~u', '', $s) ?? $s;      // расширение
    $s = str_replace(['ё', 'й'], ['е', 'и'], $s);
    $s = preg_replace('~[^a-zа-я0-9]+~u', ' ', $s) ?? $s;
    return trim(preg_replace('~\s+~u', ' ', $s) ?? $s);
}

/**
 * ВЫБРАТЬ ФАЙЛ ПАПКИ, ОТНОСЯЩИЙСЯ К ЭТОЙ ЗАЯВКЕ.
 *
 * @param  array $app строка applications (нужны full_name, group_name, work_title)
 * @return array{ok:bool, file:array|null, why:string, files:int, listing:string}
 */
function fp_pick(string $url, array $app): array {
    $files = fp_only_media(fp_list($url));

    /* У ХУДОЖНИКОВ ПАПКА — ЭТО ОДНА РАБОТА С РАЗНЫХ СТОРОН.
     *
     * Решение владельца: «если фотоискусство, художник, изобразительное,
     * декоративно-прикладное — там может быть папка с фото работ с разных
     * ракурсов, это нормально, не отклоняем». Так и было с валенками «Русский
     * стиль» (#1841): десять снимков одной пары — общий вид, голенище, подошва,
     * деталь росписи, работа на модели. Прежнее правило увидело «десять работ с
     * похожими названиями» и сняло заявку.
     *
     * Поэтому у изобразительных номинаций папка отказом не бывает: берём лучший
     * снимок — самый крупный файл, он же обычно самый подробный. */
    $nom = mb_strtolower((string) ($app['nomination'] ?? ''));
    $isArt = str_contains($nom, 'зобраз') || str_contains($nom, 'прикладн')
          || str_contains($nom, 'фото')   || str_contains($nom, 'художеств') && str_contains($nom, 'творчеств');
    if ($isArt && count($files) > 1) {
        usort($files, static fn(array $a, array $b): int => (int) $b['size'] <=> (int) $a['size']);
        return ['ok' => true, 'file' => $files[0], 'files' => count($files),
                'listing' => implode(', ', array_map(static fn(array $f): string => (string) $f['name'],
                                                     array_slice($files, 0, 8))),
                'why' => ''];
    }

    $n = count($files);
    $listing = implode(', ', array_map(static fn(array $f): string => (string) $f['name'],
                                       array_slice($files, 0, 8)));
    if ($n > 8) $listing .= ' и ещё ' . ($n - 8);

    if ($n === 0) {
        return ['ok' => false, 'file' => null, 'files' => 0, 'listing' => '',
                'why' => 'В папке по ссылке нет ни одного файла с работой.'];
    }
    // Один файл — вопросов нет: ссылка просто другого вида.
    if ($n === 1) {
        return ['ok' => true, 'file' => $files[0], 'files' => 1, 'listing' => $listing, 'why' => ''];
    }

    /* НЕСКОЛЬКО ФАЙЛОВ — ИЩЕМ СВОЙ ПО ПОДПИСИ.
     *
     * Сопоставляем не строку целиком, а слова: фамилия участника, имя, название
     * коллектива, слова из названия работы. Фамилия весит больше названия —
     * однофамильцы в одной папке встречаются реже, чем два «Осенних вальса». */
    $fio   = fp_norm((string) ($app['full_name'] ?? ''));
    $group = fp_norm((string) ($app['group_name'] ?? ''));
    $work  = fp_norm((string) ($app['work_title'] ?? ''));

    $words = static function (string $s): array {
        return array_values(array_filter(explode(' ', $s),
            static fn(string $w): bool => mb_strlen($w) >= 4));   // «дуэт», «ах», «на» ничего не различают
    };
    $fioW   = $words($fio);
    $groupW = $words($group);
    $workW  = $words($work);

    $best = ['score' => 0, 'i' => -1, 'tie' => false];
    foreach ($files as $i => $f) {
        $name = fp_norm((string) $f['name']);
        if ($name === '') continue;
        $score = 0;
        foreach ($fioW as $w)   if (str_contains($name, $w)) $score += 3;
        foreach ($groupW as $w) if (str_contains($name, $w)) $score += 3;
        foreach ($workW as $w)  if (str_contains($name, $w)) $score += 2;
        if ($score > $best['score']) { $best = ['score' => $score, 'i' => $i, 'tie' => false]; }
        elseif ($score === $best['score'] && $score > 0) { $best['tie'] = true; }
    }

    if ($best['score'] > 0 && !$best['tie']) {
        return ['ok' => true, 'file' => $files[$best['i']], 'files' => $n, 'listing' => $listing,
                'others' => fp_others($files, $best['i']), 'why' => ''];
    }

    /* ПОДПИСЕЙ НЕТ — СУДИМ ПО ВРЕМЕНИ.
     *
     * Телефон называет файлы сам: «VID_20260603_163420.mp4». Подписи в таких
     * именах нет вовсе, но есть время, и оно говорит достаточно — участник
     * снимает номер и подаёт заявку следом. Берём файл, ближайший по времени к
     * подаче, и только когда файлов немного: в папке на десяток работ такое
     * рассуждение уже ничего не доказывает, там нужен отказ.
     */
    $when = strtotime((string) ($app['created_at'] ?? '')) ?: 0;
    if ($when > 0 && $n <= 4) {
        $near = ['d' => PHP_INT_MAX, 'i' => -1, 'tie' => false];
        foreach ($files as $i => $f) {
            $ts = (int) ($f['shot'] ?? 0) ?: (int) ($f['uploaded'] ?? 0);
            if ($ts <= 0) continue;
            $d = abs($when - $ts);
            if ($d < $near['d']) { $near = ['d' => $d, 'i' => $i, 'tie' => false]; }
            elseif ($d === $near['d']) { $near['tie'] = true; }
        }
        /* Сутки разницы между кандидатами — уже осмысленный разрыв: файл,
           снятый в день подачи, и файл трёхмесячной давности перепутать трудно.
           Если оба рядом, выбор был бы гаданием. */
        if ($near['i'] >= 0 && !$near['tie']) {
            $second = PHP_INT_MAX;
            foreach ($files as $i => $f) {
                if ($i === $near['i']) continue;
                $ts = (int) ($f['shot'] ?? 0) ?: (int) ($f['uploaded'] ?? 0);
                if ($ts <= 0) continue;
                $second = min($second, abs($when - $ts));
            }
            if ($second === PHP_INT_MAX || $second - $near['d'] >= 86400) {
                /* Выбор по времени — догадка, пусть и обоснованная: в папке #1632
                   лежат две безымянные съёмки, и «У лукоморья» оказалось в той,
                   что подана не последней. Поэтому рядом кладём остальные файлы:
                   если разбор скажет «читают не то произведение», конвейер
                   попробует следующий, а не снимет заявку. */
                return ['ok' => true, 'file' => $files[$near['i']], 'files' => $n,
                        'listing' => $listing, 'others' => fp_others($files, $near['i']), 'why' => ''];
            }
        }
    }

    $why = $best['tie']
        ? 'В папке несколько работ с похожими названиями, и какая из них Ваша — определить нельзя.'
        : 'В папке ' . $n . ' работ, и ни одна не подписана Вашими данными.';
    return ['ok' => false, 'file' => null, 'files' => $n, 'listing' => $listing,
            'why' => $why . ' Одна заявка — один конкурсный материал (п. 8.1 положения): '
                   . 'нужна ссылка на саму работу, а не на общую папку.'
                   . ($listing !== '' ? "\nВ папке: " . $listing . '.' : '')];
}

/** HTTP GET с разбором JSON; молчит при любой ошибке. */
function fp_json(string $url, int $timeout = 20): ?array {
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

/**
 * Прямая ссылка на выбранный файл папки.
 *
 * У обоих облаков она временная и выдаётся отдельным запросом: постоянного
 * адреса у файла внутри публичной папки нет.
 */
function fp_direct_url(string $folderUrl, array $file): string {
    $u = mb_strtolower(trim($folderUrl));

    if (str_contains($u, 'disk.yandex') || str_contains($u, 'yadi.sk')) {
        $j = fp_json('https://cloud-api.yandex.net/v1/disk/public/resources/download?public_key='
                   . rawurlencode($folderUrl)
                   . ((string) $file['path'] !== '' ? '&path=' . rawurlencode((string) $file['path']) : ''));
        return is_array($j) ? (string) ($j['href'] ?? '') : '';
    }

    /* ОБЛАКО MAIL.RU СЮДА НЕ ПОПАДАЕТ НАМЕРЕННО.
     *
     * Адрес файла там выдаёт dispatcher, и собранный вручную хост живёт
     * ненадёжно: у заявки #1828 (рисунок на 62 КБ) такая ссылка не отвечала
     * вовсе — «код 0», — тогда как штатный путь загрузчика ту же работу берёт
     * без запинки. Пустая строка означает «строить адрес не берусь»: вызывающий
     * код пойдёт обычной дорогой (core/video_fetch.php), где вся эта механика
     * уже отлажена. */
    return '';
}

/** Остальные файлы папки — запасные кандидаты, в исходном порядке. */
function fp_others(array $files, int $chosen): array {
    $out = [];
    foreach ($files as $i => $f) if ($i !== $chosen) $out[] = $f;
    return $out;
}
