<?php
/**
 * Проверка конкурсной видео-ссылки при ПОДАЧЕ заявки и при оценке жюри.
 * По каждой разрешённой платформе (RuTube, VK, Яндекс.Диск, Google Диск, ОК, Дзен):
 *   1) ссылка ведёт на конкретное видео/файл (а не на канал/папку/левую страницу);
 *   2) ресурс существует и открыт (не удалён, не приватный, доступ по ссылке);
 *   3) это видео/медиа, а не произвольный документ;
 *   4) материал не старше 1 года (п. 8.11 положения).
 * Главная функция — video_verify(): ['ok','reason','platform','ts','stale','state'].
 * Философия: блокируем только при УВЕРЕННОМ нарушении; если из-за сети дату/доступ
 * определить нельзя — не блокируем по этому пункту (сеть может врать), но существование
 * проверяем всегда где возможно.
 */
declare(strict_types=1);

if (!function_exists('_lc_ua')) {
    function _lc_ua(): string { return 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'; }
}

if (!function_exists('_lc_http_json')) {
    /** GET JSON с коротким таймаутом; null при любой ошибке. */
    function _lc_http_json(string $url): ?array {
        [$code, $body] = _lc_http_get($url, 8);
        if ($code === 0 || $body === '') return null;
        $j = json_decode($body, true);
        return is_array($j) ? $j : null;
    }
}

if (!function_exists('_lc_http_get')) {
    /** GET страницы/ресурса. Возвращает [http_code, body]. body ограничен ~400 КБ. */
    function _lc_http_get(string $url, int $timeout = 8, bool $headOnly = false): array {
        if (!function_exists('curl_init')) return [0, ''];
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true, CURLOPT_FOLLOWLOCATION => true, CURLOPT_MAXREDIRS => 6,
            CURLOPT_CONNECTTIMEOUT => 4, CURLOPT_TIMEOUT => $timeout,
            CURLOPT_USERAGENT => _lc_ua(), CURLOPT_NOBODY => $headOnly,
            CURLOPT_SSL_VERIFYPEER => true, CURLOPT_SSL_VERIFYHOST => 2,
            CURLOPT_ENCODING => '', CURLOPT_BUFFERSIZE => 65536,
            CURLOPT_HTTPHEADER => ['Accept-Language: ru,en;q=0.8'],
        ]);
        // Ограничиваем объём тела, чтобы не тянуть тяжёлые страницы целиком.
        $buf = '';
        if (!$headOnly) {
            curl_setopt($ch, CURLOPT_WRITEFUNCTION, function ($ch, $chunk) use (&$buf) {
                $buf .= $chunk;
                return (strlen($buf) > 400000) ? 0 : strlen($chunk); // >400КБ — обрываем
            });
        }
        $ok = curl_exec($ch);
        $code = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
        $errno = curl_errno($ch);
        curl_close($ch);
        if ($errno && $errno !== CURLE_WRITE_ERROR) return [0, ''];   // сеть недоступна
        return [$code, $headOnly ? '' : $buf];
    }
}

if (!function_exists('_lc_html_date')) {
    /** Достаёт дату публикации из HTML (JSON-LD/meta) → unix, либо null. */
    function _lc_html_date(string $html): ?int {
        if ($html === '') return null;
        $pats = [
            '~"(?:uploadDate|datePublished|publication_ts|publicationDate|dateCreated)"\s*:\s*"([^"]{6,40})"~i',
            '~itemprop="(?:uploadDate|datePublished)"[^>]*content="([^"]{6,40})"~i',
            '~property="(?:video:release_date|og:video:release_date)"[^>]*content="([^"]{6,40})"~i',
            '~"published"\s*:\s*"([0-9]{4}-[0-9]{2}-[0-9]{2}[^"]*)"~i',
        ];
        foreach ($pats as $p) {
            if (preg_match($p, $html, $m)) {
                $t = strtotime(trim($m[1]));
                if ($t && $t > 946684800 && $t <= time() + 86400) return $t; // после 2000 г. и не из будущего
            }
        }
        return null;
    }
}

if (!function_exists('_lc_result')) {
    /** Формирует итог с учётом даты: старше года → блок. */
    function _lc_result(string $platform, ?int $ts, string $okReason = 'Ссылка принята'): array {
        $stale = ($ts !== null) ? ($ts < strtotime('-1 year')) : null;
        if ($stale === true) {
            return ['ok' => false, 'state' => 'bad', 'platform' => $platform, 'ts' => $ts, 'stale' => true,
                'reason' => 'Материал старше 1 года — по положению (п. 8.11) к участию не принимается. Загрузите запись не старше года.'];
        }
        return ['ok' => true, 'state' => 'ok', 'platform' => $platform, 'ts' => $ts, 'stale' => $stale, 'reason' => $okReason];
    }
    function _lc_bad(string $platform, string $reason): array {
        return ['ok' => false, 'state' => 'bad', 'platform' => $platform, 'ts' => null, 'stale' => null, 'reason' => $reason];
    }
}

if (!function_exists('video_verify')) {
    /**
     * Полная проверка конкурсной ссылки. Возвращает:
     *   ['ok'=>bool, 'state'=>'ok'|'bad', 'platform'=>string, 'ts'=>?int, 'stale'=>?bool, 'reason'=>string]
     */
    function video_verify(string $url): array {
        $url = trim($url);
        if ($url === '' || !filter_var($url, FILTER_VALIDATE_URL) || !preg_match('~^https?://~i', $url)) {
            return _lc_bad('', 'Введите полную ссылку, начиная с https://');
        }
        $host = mb_strtolower((string)(parse_url($url, PHP_URL_HOST) ?: ''));
        $host = preg_replace('~^www\.~', '', $host);

        // Явно запрещённые площадки.
        foreach (['youtube.com','youtu.be','instagram.com','facebook.com','fb.watch','tiktok.com'] as $b) {
            if (str_contains($host, $b)) return _lc_bad('', 'Эта платформа не принимается. Разрешены: RuTube, VK, Яндекс.Диск, Google Диск, ОК, Дзен.');
        }

        /* ---- RuTube ---- */
        if (str_contains($host, 'rutube.ru')) {
            if (!preg_match('#rutube\.ru/(?:video|shorts|play/embed)/([a-z0-9]+)#i', $url, $m)) {
                return _lc_bad('RuTube', 'Дайте ссылку на конкретное видео RuTube (rutube.ru/video/…), а не на канал.');
            }
            $j = _lc_http_json('https://rutube.ru/api/video/' . $m[1] . '/');
            // 404 отдаёт {"detail":"Страница не найдена"} — тоже «не найдено».
            if ($j === null || isset($j['detail']) || empty($j['id'])) {
                return _lc_bad('RuTube', 'Видео RuTube не найдено или закрыто. Проверьте, что ссылка открывается и доступна всем.');
            }
            if (!empty($j['is_deleted']) || !empty($j['is_hidden'])) return _lc_bad('RuTube', 'Это видео RuTube удалено или скрыто.');
            $ts = !empty($j['created_ts']) ? (strtotime((string)$j['created_ts']) ?: null) : null;
            return _lc_result('RuTube', $ts);
        }

        /* ---- VK Видео ---- */
        if (str_contains($host, 'vk.com') || str_contains($host, 'vkvideo.ru')) {
            if (!preg_match('#video(-?\d+_\d+)#', $url, $m)) {
                return _lc_bad('VK Видео', 'Дайте ссылку на видео VK вида …/video-123_456.');
            }
            $tok = function_exists('cfgv') ? (string) cfgv('vk_token', '') : '';
            if ($tok !== '') {
                $j = _lc_http_json('https://api.vk.com/method/video.get?videos=' . $m[1]
                    . '&access_token=' . rawurlencode($tok) . '&v=5.199');
                // Ответ есть, но item нет → приватное/удалённое/несуществующее.
                if (is_array($j) && isset($j['response'])) {
                    $item = $j['response']['items'][0] ?? null;
                    if (!$item) return _lc_bad('VK Видео', 'Видео VK не найдено или закрыто (приватный доступ). Откройте доступ по ссылке.');
                    $ts = !empty($item['date']) ? (int) $item['date'] : null;
                    return _lc_result('VK Видео', $ts);
                }
            }
            // Токена нет / API не ответил — проверим хотя бы доступность страницы.
            [$code] = _lc_http_get($url, 7, true);
            if ($code === 404) return _lc_bad('VK Видео', 'Видео VK не найдено (404).');
            return _lc_result('VK Видео', null);
        }

        /* ---- Яндекс.Диск ---- */
        if (str_contains($host, 'disk.yandex') || $host === 'yadi.sk') {
            $api = 'https://cloud-api.yandex.net/v1/disk/public/resources?public_key='
                 . rawurlencode($url) . '&fields=name,created,modified,type,media_type';
            $j = _lc_http_json($api);
            if ($j === null || isset($j['error'])) {
                return _lc_bad('Яндекс.Диск', 'Файл на Яндекс.Диске недоступен (нет доступа, приватный или удалён). Откройте доступ «по ссылке».');
            }
            if (($j['type'] ?? '') === 'dir') {
                return _lc_bad('Яндекс.Диск', 'Ссылка ведёт на папку, а не на конкурсное видео. Дайте ссылку на сам видеофайл.');
            }
            $mt = (string)($j['media_type'] ?? '');
            if ($mt !== '' && $mt !== 'video') {
                return _lc_bad('Яндекс.Диск', 'Этот файл на Яндекс.Диске не является видео (' . $mt . '). Приложите конкурсное видео.');
            }
            $ts = null;
            foreach (['created','modified'] as $k) { if (!empty($j[$k])) { $ts = strtotime((string)$j[$k]) ?: $ts; if ($ts) break; } }
            return _lc_result('Яндекс.Диск', $ts);
        }

        /* ---- Google Диск ---- */
        if (str_contains($host, 'drive.google.com') || str_contains($host, 'docs.google.com')) {
            if (!preg_match('#/d/([a-zA-Z0-9_-]{10,})#', $url, $m) && !preg_match('#[?&]id=([a-zA-Z0-9_-]{10,})#', $url, $m)) {
                return _lc_bad('Google Диск', 'Дайте прямую ссылку на файл Google Диска (…/file/d/…/view).');
            }
            [$code, $body] = _lc_http_get('https://drive.google.com/file/d/' . $m[1] . '/view', 8);
            if ($code === 404 || $code === 410) return _lc_bad('Google Диск', 'Файл Google Диска не найден или удалён.');
            if ($code === 0) return _lc_result('Google Диск', null); // сеть — не блокируем
            $needAccess = (stripos($body, 'ServiceLogin') !== false || stripos($body, 'accounts.google.com/AccountChooser') !== false
                || stripos($body, 'Запросить доступ') !== false || stripos($body, 'Request access') !== false
                || stripos($body, 'Нужен доступ') !== false || stripos($body, 'You need access') !== false);
            if ($needAccess) return _lc_bad('Google Диск', 'Файл Google Диска закрыт. Откройте доступ «Всем, у кого есть ссылка».');
            return _lc_result('Google Диск', _lc_html_date($body)); // дату Drive обычно не отдаёт
        }

        /* ---- ОК Видео ---- */
        if (str_contains($host, 'ok.ru')) {
            if (!preg_match('#ok\.ru/(?:video|videoembed|live)/(\d+)#i', $url, $m)) {
                return _lc_bad('ОК Видео', 'Дайте ссылку на конкретное видео ОК (ok.ru/video/…).');
            }
            [$code, $body] = _lc_http_get('https://ok.ru/video/' . $m[1], 9);
            if ($code === 404) return _lc_bad('ОК Видео', 'Видео в ОК не найдено (404).');
            if ($code === 0) return _lc_result('ОК Видео', null);
            if (stripos($body, 'видео удалено') !== false || stripos($body, 'видео недоступно') !== false
                || stripos($body, 'больше не доступно') !== false) {
                return _lc_bad('ОК Видео', 'Видео в ОК удалено или недоступно. Проверьте открытый доступ.');
            }
            return _lc_result('ОК Видео', _lc_html_date($body));
        }

        /* ---- Дзен Видео ---- */
        if (str_contains($host, 'dzen.ru') || str_contains($host, 'zen.yandex')) {
            [$code, $body] = _lc_http_get($url, 9);
            if ($code === 404) return _lc_bad('Дзен Видео', 'Видео в Дзене не найдено (404).');
            if ($code === 0) return _lc_result('Дзен Видео', null);
            if (stripos($body, 'публикация удалена') !== false || stripos($body, 'страница не найдена') !== false) {
                return _lc_bad('Дзен Видео', 'Публикация в Дзене удалена или недоступна.');
            }
            return _lc_result('Дзен Видео', _lc_html_date($body));
        }

        // Неизвестная площадка.
        return _lc_bad('', 'Эта платформа не принимается. Разрешены: RuTube, VK, Яндекс.Диск, Google Диск, ОК, Дзен.');
    }
}

/* ---- Обратная совместимость (использует старый apply/jury-код) ---- */
if (!function_exists('video_publish_ts')) {
    function video_publish_ts(string $url): ?int { $r = video_verify($url); return $r['ts'] ?? null; }
}
if (!function_exists('video_is_stale')) {
    function video_is_stale(string $url): ?bool { $r = video_verify($url); return $r['stale'] ?? null; }
}
