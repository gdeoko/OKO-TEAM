<?php
/**
 * КАК ДОСТАТЬ КОНКУРСНУЮ ЗАПИСЬ.
 *
 * Участники присылают ссылку, а не файл, и площадки у всех разные: Яндекс.Диск,
 * Облако Mail.ru, ВК Видео, RuTube, ОК. Ссылка ведёт на страницу с плеером, а
 * оценивать нужно саму запись, поэтому здесь она превращается в файл на диске.
 *
 * Разбор по площадкам, а не универсальным качальщиком:
 *   • Яндекс.Диск — открытый API публичных ссылок отдаёт прямую ссылку на файл;
 *   • Облако Mail.ru — та же идея, но через weblink-ручку;
 *   • ВК Видео, RuTube, ОК — страницы с плеером, прямого файла нет, поэтому
 *     берём то, что доступно официально: плейлист или mp4 из данных страницы.
 *
 * Почему не «скачать всё подряд»: центр обрабатывает сотни заявок, и качать по
 * гигабайту с каждой площадки нельзя ни по диску, ни по времени. Файл ограничен
 * настройкой (по умолчанию 300 МБ), лишнее не тянем, а после оценки запись
 * удаляется: она принадлежит участнику, и держать её у себя незачем.
 *
 * Наружу отсюда уходят только запросы на чтение к самим площадкам.
 */
declare(strict_types=1);

/** Куда складываем скачанное на время оценки. */
function vf_dir(): string {
    $d = BASE_PATH . '/data/video_tmp';
    if (!is_dir($d)) @mkdir($d, 0775, true);
    return $d;
}

/** Площадка по ссылке — то же название, что участник видит в форме заявки. */
function vf_platform(string $url): string {
    $u = mb_strtolower(trim($url));
    if ($u === '') return '';
    if (str_contains($u, 'disk.yandex') || str_contains($u, 'yadi.sk'))   return 'yandex_disk';
    if (str_contains($u, 'cloud.mail.ru'))                                return 'mailru_cloud';
    if (str_contains($u, 'vk.com/video') || str_contains($u, 'vkvideo.') || str_contains($u, 'vk.ru/video')) return 'vk';
    if (str_contains($u, 'rutube.ru'))                                    return 'rutube';
    if (str_contains($u, 'ok.ru'))                                        return 'ok';
    if (str_contains($u, 'dzen.ru') || str_contains($u, 'zen.yandex'))    return 'dzen';
    if (str_contains($u, 'drive.google'))                                 return 'google_drive';
    if (preg_match('~\.(mp4|mov|m4v|webm|mkv|avi)(\?|$)~i', $u))          return 'direct';
    return 'unknown';
}

/** HTTP-запрос с общими правилами: без редиректов вслепую, с таймаутом и лимитом. */
function vf_http(string $url, array $opt = []): array {
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => 1,
        CURLOPT_FOLLOWLOCATION => $opt['follow'] ?? true,
        CURLOPT_MAXREDIRS      => 5,
        CURLOPT_TIMEOUT        => $opt['timeout'] ?? 40,
        CURLOPT_CONNECTTIMEOUT => 15,
        CURLOPT_USERAGENT      => 'Mozilla/5.0 (compatible; MuzmirGrader/1.0)',
        CURLOPT_HTTPHEADER     => $opt['headers'] ?? ['Accept-Language: ru,en;q=0.8'],
    ]);
    $body = curl_exec($ch);
    $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $err  = curl_error($ch);
    curl_close($ch);
    return ['code' => $code, 'body' => (string) $body, 'error' => $err];
}

/**
 * ПРЯМАЯ ССЫЛКА НА ФАЙЛ.
 *
 * @return array{ok:bool, url:string, name:string, size:int, why:string}
 */
function vf_direct_link(string $url): array {
    $fail = static fn(string $why): array => ['ok' => false, 'url' => '', 'name' => '', 'size' => 0, 'why' => $why];
    $url  = trim($url);
    if ($url === '') return $fail('ссылка пустая');

    switch (vf_platform($url)) {
        case 'direct':
            return ['ok' => true, 'url' => $url, 'name' => basename(parse_url($url, PHP_URL_PATH) ?: 'video.mp4'), 'size' => 0, 'why' => ''];

        case 'yandex_disk':
            // Открытый API публичных ресурсов: отдаёт href на файл и его размер.
            $api = 'https://cloud-api.yandex.net/v1/disk/public/resources/download?public_key=' . rawurlencode($url);
            $r = vf_http($api);
            $j = json_decode($r['body'], true);
            if (($r['code'] === 200) && !empty($j['href'])) {
                // Имя и размер берём отдельным запросом: они нужны, чтобы не тянуть гигабайты.
                $meta = json_decode(vf_http('https://cloud-api.yandex.net/v1/disk/public/resources?public_key='
                        . rawurlencode($url))['body'], true);
                return ['ok' => true, 'url' => (string) $j['href'],
                        'name' => (string) ($meta['name'] ?? 'video.mp4'),
                        'size' => (int) ($meta['size'] ?? 0), 'why' => ''];
            }
            // Папка вместо файла: берём первый видеофайл внутри.
            $meta = json_decode(vf_http('https://cloud-api.yandex.net/v1/disk/public/resources?public_key='
                    . rawurlencode($url) . '&limit=50')['body'], true);
            foreach ((array) ($meta['_embedded']['items'] ?? []) as $it) {
                if (($it['type'] ?? '') === 'file' && preg_match('~^video/~i', (string) ($it['mime_type'] ?? ''))) {
                    $d = json_decode(vf_http('https://cloud-api.yandex.net/v1/disk/public/resources/download?public_key='
                         . rawurlencode($url) . '&path=' . rawurlencode((string) $it['path']))['body'], true);
                    if (!empty($d['href'])) {
                        return ['ok' => true, 'url' => (string) $d['href'], 'name' => (string) ($it['name'] ?? 'video.mp4'),
                                'size' => (int) ($it['size'] ?? 0), 'why' => ''];
                    }
                }
            }
            return $fail('Яндекс.Диск: файл по ссылке не отдаётся (ссылка закрыта или удалена)');

        case 'mailru_cloud':
            // ХОСТ СКАЧИВАНИЯ У ОБЛАКА ПЛАВАЮЩИЙ.
            //
            // Постоянного адреса файла нет: облако раздаёт его с одного из
            // серверов clocloNN, и какой именно сегодня рабочий, сообщает
            // отдельная ручка dispatcher. Зашитый хост живёт неделю, потом
            // перестаёт отвечать, поэтому спрашиваем адрес каждый раз.
            /* СПРАШИВАЕМ ОБЛАКО О ФАЙЛЕ, А НЕ КАЧАЕМ ЕГО НА ПРОБУ.
             *
             * Прежний порядок был такой: взять адрес у dispatcher и скачать по
             * нему первые байты, чтобы убедиться, что это файл. На деле выходило
             * иначе. Первым в списке шёл weblink_view — а он отвечает 403
             * Forbidden, и проверка проваливалась. Второй адрес, weblink_get,
             * файл отдаёт, но проверка требовала скачать больше ста килобайт за
             * 25 секунд, а конкурсные записи весят по гигабайту: соединение не
             * успевало, и рабочая ссылка тоже считалась мёртвой.
             *
             * Из-за этого 43 заявки — почти все работы, залитые в Облако, — не
             * оценивались вовсе: «ссылка закрыта или файл не отдаётся» при живой
             * и открытой ссылке.
             *
             * У облака есть ручка, которая по публичной ссылке отдаёт имя, размер
             * и признак «файл существует» одним небольшим JSON. Её и спрашиваем:
             * это быстро, честно отличает закрытую ссылку от рабочей и заодно даёт
             * размер — а значит слишком тяжёлую запись мы отсеем до скачивания, а
             * не после получаса ожидания. */
            if (preg_match('~cloud\.mail\.ru/public/([^/?#]+)/([^?#]+)~i', $url, $m)) {
                $weblink = $m[1] . '/' . ltrim($m[2], '/');

                $info = json_decode(vf_http(
                    'https://cloud.mail.ru/api/v2/file?weblink=' . rawurlencode($weblink) . '&api=2',
                    ['timeout' => 20])['body'], true);
                $body = is_array($info) ? ($info['body'] ?? []) : [];
                $status = (int) ($info['status'] ?? 0);

                // Публичная ссылка может вести на папку с одним файлом внутри —
                // участники так тоже делают. Тогда берём из неё первый видеофайл.
                if ($status !== 200 || ($body['kind'] ?? '') !== 'file') {
                    $fold = json_decode(vf_http(
                        'https://cloud.mail.ru/api/v2/folder?weblink=' . rawurlencode($weblink) . '&api=2',
                        ['timeout' => 20])['body'], true);
                    /* В папке ищем сначала запись, потом изображение: по
                       изобразительному искусству и фотографии участник кладёт
                       туда снимок работы, и раньше такая ссылка считалась
                       пустой — «нет видео» означало «нечего оценивать». */
                    foreach (['~\.(mp4|mov|m4v|webm|mkv|avi)$~i', '~\.(jpe?g|png|webp|heic|heif|bmp|tiff?)$~i'] as $mask) {
                        foreach ((array) ($fold['body']['list'] ?? []) as $it) {
                            if (($it['kind'] ?? '') !== 'file') continue;
                            if (!preg_match($mask, (string) ($it['name'] ?? ''))) continue;
                            $body = $it;
                            $weblink .= '/' . ltrim((string) ($it['name'] ?? ''), '/');
                            $status = 200;
                            break 2;
                        }
                    }
                }
                if ($status !== 200 || !$body) {
                    return $fail('Облако Mail.ru: ссылка закрыта или файл удалён');
                }

                $disp = json_decode(vf_http('https://cloud.mail.ru/api/v2/dispatcher?api=2', ['timeout' => 20])['body'], true);
                // weblink_get — единственный адрес, который реально отдаёт файл по
                // публичной ссылке; weblink_view отвечает 403.
                $host = (string) ($disp['body']['weblink_get'][0]['url'] ?? '');
                if ($host === '') return $fail('Облако Mail.ru: сервер раздачи не отвечает');

                /* ИМЯ ФАЙЛА В АДРЕСЕ НАДО КОДИРОВАТЬ.
                   Работы называют по-человечески: «Ансимова Дарья 14 Натюрморт.jpg».
                   Кириллица и пробелы в адресе — это не адрес: curl отвечает
                   «Malformed input to a URL function» и не качает ничего. Кодируем
                   каждый кусок пути отдельно, чтобы косые черты остались целыми. */
                $encoded = implode('/', array_map('rawurlencode', explode('/', $weblink)));
                return ['ok' => true, 'url' => rtrim($host, '/') . '/' . $encoded,
                        'name' => (string) ($body['name'] ?? 'video.mp4'),
                        'size' => (int) ($body['size'] ?? 0), 'why' => ''];
            }
            return $fail('Облако Mail.ru: ссылка закрыта или файл не отдаётся');

        case 'vk':
            // СНАЧАЛА API СООБЩЕСТВА, ПОТОМ СТРАНИЦА.
            //
            // Страница плеера отдаёт ссылки на mp4 только гостю, которому видео
            // видно; у большинства конкурсных записей доступ «по ссылке», и гость
            // получает пустую страницу. Токен сообщества центра такие записи
            // видит, поэтому сперва спрашиваем video.get по идентификатору из
            // ссылки, а разбор страницы оставляем запасным путём.
            if (preg_match('~video(-?\d+)_(\d+)(?:[?&_]+([A-Za-z0-9]+))?~', $url, $m)) {
                $vid   = $m[1] . '_' . $m[2] . (isset($m[3]) && $m[3] !== '' ? '_' . $m[3] : '');
                $token = function_exists('cfgv') ? trim((string) cfgv('vk_token', '')) : '';
                if ($token !== '') {
                    $api = 'https://api.vk.com/method/video.get?videos=' . rawurlencode($vid)
                         . '&access_token=' . rawurlencode($token) . '&v=5.199';
                    $j = json_decode(vf_http($api)['body'], true);
                    $item = $j['response']['items'][0] ?? null;
                    if ($item) {
                        $files = (array) ($item['files'] ?? []);
                        $best  = ['h' => 0, 'u' => ''];
                        foreach ($files as $k => $u) {
                            if (!preg_match('~^mp4_(\d{3,4})$~', (string) $k, $mm)) continue;
                            $h = (int) $mm[1];
                            if ($h <= 720 && $h > $best['h']) $best = ['h' => $h, 'u' => (string) $u];
                        }
                        if ($best['u'] !== '') {
                            return ['ok' => true, 'url' => $best['u'], 'name' => 'vk_' . $best['h'] . '.mp4',
                                    'size' => 0, 'why' => ''];
                        }
                    }
                }
            }
            $r = vf_http($url);
            if (preg_match_all('~"url(\d{3,4})":"(https:[^"]+?)"~', $r['body'], $m, PREG_SET_ORDER)) {
                $best = ['h' => 0, 'u' => ''];
                foreach ($m as $one) {
                    $h = (int) $one[1];
                    $u = str_replace('\\/', '/', $one[2]);
                    if ($h <= 720 && $h > $best['h']) $best = ['h' => $h, 'u' => $u];
                }
                if ($best['u'] !== '') return ['ok' => true, 'url' => $best['u'], 'name' => 'vk_' . $best['h'] . '.mp4', 'size' => 0, 'why' => ''];
            }
            return $fail('ВК Видео: запись закрыта настройками приватности или удалена');

        case 'rutube':
            // Официальный API отдаёт манифест; из него берём mp4, если он есть.
            if (preg_match('~rutube\.ru/(?:video|play/embed)/([0-9a-f]{32})~i', $url, $m)) {
                $api = 'https://rutube.ru/api/play/options/' . $m[1] . '/?no_404=true&referer=' . rawurlencode('https://rutube.ru');
                $j = json_decode(vf_http($api)['body'], true);
                $mp4 = $j['video_balancer']['mp4'] ?? '';
                if (is_string($mp4) && $mp4 !== '') return ['ok' => true, 'url' => $mp4, 'name' => 'rutube.mp4', 'size' => 0, 'why' => ''];
                $m3u = $j['video_balancer']['m3u8'] ?? '';
                if (is_string($m3u) && $m3u !== '') return ['ok' => true, 'url' => $m3u, 'name' => 'rutube.m3u8', 'size' => 0, 'why' => ''];
            }
            return $fail('RuTube: запись не отдаётся по ссылке');

        case 'ok':
            $r = vf_http($url);
            if (preg_match('~"videoName".*?"url":"(https:[^"]+?)"~s', $r['body'], $m)) {
                return ['ok' => true, 'url' => str_replace('\\/', '/', $m[1]), 'name' => 'ok.mp4', 'size' => 0, 'why' => ''];
            }
            return $fail('ОК Видео: прямая ссылка не получена');

        case 'google_drive':
            if (preg_match('~/d/([A-Za-z0-9_\-]{10,})~', $url, $m)) {
                return ['ok' => true, 'url' => 'https://drive.google.com/uc?export=download&id=' . $m[1],
                        'name' => 'gdrive.mp4', 'size' => 0, 'why' => ''];
            }
            return $fail('Google Диск: не удалось разобрать ссылку');
    }

    return $fail('площадка не поддерживается: ' . $url);
}

/**
 * СКАЧАТЬ ЗАПИСЬ НА ДИСК.
 *
 * @return array{ok:bool, path:string, size:int, why:string}
 */
function vf_download(string $url, int $appId = 0): array {
    $maxMb = max(20, (int) (function_exists('setting') ? setting('grade_video_max_mb', '300') : 300));
    $link  = vf_direct_link($url);
    if (!$link['ok']) return ['ok' => false, 'path' => '', 'size' => 0, 'why' => $link['why']];

    /* Расширение берём по имени файла: раньше всё, что не видео, называлось
       mp4, и снимок рисунка уезжал в ffmpeg как «битая запись». */
    $ext = 'mp4';
    if (preg_match('~\.(mp4|mov|m4v|webm|mkv|m3u8|jpe?g|png|webp|heic|heif|bmp|tiff?)~i', $link['name'], $m)) {
        $ext = mb_strtolower($m[1]);
    }
    $path = vf_dir() . '/app' . ($appId > 0 ? $appId : 0) . '_' . substr(md5($url), 0, 8) . '.' . $ext;
    if (is_file($path) && filesize($path) > 100000) {
        return ['ok' => true, 'path' => $path, 'size' => (int) filesize($path), 'why' => ''];
    }

    /* ТЯЖЁЛАЯ ЗАПИСЬ — НЕ ПОВОД ОТКАЗАТЬ УЧАСТНИКУ.
     *
     * Здесь стоял отказ: файл больше лимита — заявка не оценивается. А снимают
     * теперь телефоном в высоком разрешении, и четырёхминутный номер весит
     * гигабайт: по одному только Облаку Mail.ru таких работ четверть. Жюри такую
     * запись смотрит спокойно — значит и мы обязаны.
     *
     * Берём из потока первые N минут (grade_video_max_sec) прямо на лету:
     * ffmpeg читает файл по сети и пишет ровно тот кусок, который всё равно
     * уходит на аттестацию. Гигабайт на диск не ложится, а номер сохраняется
     * целиком — конкурсные выступления короче этого предела. */
    $tooBig = $link['size'] > 0 && $link['size'] > $maxMb * 1024 * 1024;
    if ($tooBig && $ext !== 'm3u8') {
        $secs = (int) (function_exists('setting') ? setting('grade_video_max_sec', '900') : 900);
        $out  = preg_replace('~\.[a-z0-9]+$~i', '', $path) . '_cut.mp4';
        if (is_file($out) && filesize($out) > 100000) {
            return ['ok' => true, 'path' => $out, 'size' => (int) filesize($out), 'why' => ''];
        }
        $cmd = 'ffmpeg -y -loglevel error -user_agent ' . escapeshellarg('Mozilla/5.0 (compatible; MuzmirGrader/1.0)')
             . ' -i ' . escapeshellarg($link['url'])
             . ' -t ' . max(60, $secs)
             . ' -c copy -movflags +faststart ' . escapeshellarg($out) . ' 2>&1';
        @exec($cmd, $o1, $rc1);
        // Не всякий контейнер режется копированием потока — тогда пережимаем.
        if (($rc1 !== 0 || !is_file($out) || filesize($out) < 100000)) {
            @unlink($out);
            $cmd2 = 'ffmpeg -y -loglevel error -user_agent ' . escapeshellarg('Mozilla/5.0 (compatible; MuzmirGrader/1.0)')
                  . ' -i ' . escapeshellarg($link['url'])
                  . ' -t ' . max(60, $secs)
                  . ' -vf scale=-2:720 -c:v libx264 -preset veryfast -crf 26 -c:a aac -b:a 128k '
                  . escapeshellarg($out) . ' 2>&1';
            @exec($cmd2, $o2, $rc2);
        }
        if (is_file($out) && filesize($out) > 100000) {
            return ['ok' => true, 'path' => $out, 'size' => (int) filesize($out), 'why' => ''];
        }
        @unlink($out);
        return ['ok' => false, 'path' => '', 'size' => $link['size'],
                'why' => 'запись больше ' . $maxMb . ' МБ (' . round($link['size'] / 1048576) . ' МБ) и не режется потоком'];
    }

    // Плейлист качаем не курлом, а ffmpeg: иначе на диск ляжет текстовый файл.
    if ($ext === 'm3u8') {
        $out = preg_replace('~\.m3u8$~', '.mp4', $path);
        $cmd = 'ffmpeg -y -loglevel error -i ' . escapeshellarg($link['url'])
             . ' -t ' . (int) (function_exists('setting') ? setting('grade_video_max_sec', '600') : 600)
             . ' -c copy ' . escapeshellarg($out) . ' 2>&1';
        @exec($cmd, $o, $rc);
        if ($rc === 0 && is_file($out) && filesize($out) > 100000) {
            return ['ok' => true, 'path' => $out, 'size' => (int) filesize($out), 'why' => ''];
        }
        return ['ok' => false, 'path' => '', 'size' => 0, 'why' => 'поток не скачался (ffmpeg)'];
    }

    $fp = @fopen($path, 'wb');
    if (!$fp) return ['ok' => false, 'path' => '', 'size' => 0, 'why' => 'не удалось открыть файл для записи'];
    $limit = $maxMb * 1024 * 1024;
    $got   = 0;
    $ch = curl_init($link['url']);
    curl_setopt_array($ch, [
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_MAXREDIRS      => 5,
        CURLOPT_TIMEOUT        => 600,
        CURLOPT_CONNECTTIMEOUT => 20,
        CURLOPT_USERAGENT      => 'Mozilla/5.0 (compatible; MuzmirGrader/1.0)',
        // Пишем поток кусками и сами останавливаемся на лимите: заранее размер
        // известен не у всех площадок, а диск сервера общий с сайтом и почтой.
        CURLOPT_WRITEFUNCTION  => function ($c, $chunk) use ($fp, &$got, $limit) {
            $got += strlen($chunk);
            if ($got > $limit) return 0;
            return fwrite($fp, $chunk);
        },
    ]);
    curl_exec($ch);
    $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    fclose($fp);

    if ($got > $limit) { @unlink($path); return ['ok' => false, 'path' => '', 'size' => $got, 'why' => 'запись больше ' . $maxMb . ' МБ']; }
    if ($code >= 400 || $got < 100000) {
        @unlink($path);
        return ['ok' => false, 'path' => '', 'size' => $got, 'why' => 'площадка не отдала файл (код ' . $code . ')'];
    }
    // ОБОРВАННАЯ ЗАКАЧКА ВЫГЛЯДИТ КАК ЦЕЛЫЙ ФАЙЛ.
    //
    // Если площадка закрыла соединение на середине, на диске остаётся mp4 без
    // завершающего блока: размер приличный, а ffmpeg на нём падает с «moov atom
    // not found», и работа считается непригодной, хотя дело в закачке. Когда
    // размер известен заранее, сверяем его: недокачанное лучше выбросить сразу
    // и попробовать ещё раз, чем объявить участнику, что его запись не читается.
    if ($link['size'] > 0 && $got < $link['size'] * 0.98) {
        @unlink($path);
        return ['ok' => false, 'path' => '', 'size' => $got,
                'why' => 'запись скачалась не полностью (' . round($got / 1048576) . ' из '
                       . round($link['size'] / 1048576) . ' МБ)'];
    }
    return ['ok' => true, 'path' => $path, 'size' => $got, 'why' => ''];
}

/**
 * Длительность записи в секундах (ffprobe). Нужна для формальной проверки
 * регламента: положение ограничивает хронометраж, и это надо знать до оценки.
 */
function vf_duration(string $path): int {
    if (!is_file($path)) return 0;
    $cmd = 'ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 '
         . escapeshellarg($path) . ' 2>/dev/null';
    $out = @shell_exec($cmd);
    return (int) round((float) trim((string) $out));
}

/** Убрать временную запись: она принадлежит участнику, хранить её незачем. */
function vf_cleanup(string $path): void {
    if ($path !== '' && is_file($path) && str_starts_with($path, vf_dir())) @unlink($path);
}
