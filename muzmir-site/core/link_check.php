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
        // state = 'unknown' означает «площадка нам не ответила»: ссылку мы
        // пропускаем (сеть врёт чаще, чем участники), но заявка помечается, и
        // человек проверяет её глазами — таких единицы, а не весь поток.
        $state = ($ts === null && $okReason === 'Ссылка принята, доступ проверить не удалось') ? 'unknown' : 'ok';
        return ['ok' => true, 'state' => $state, 'platform' => $platform, 'ts' => $ts, 'stale' => $stale, 'reason' => $okReason];
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
    /**
     * @param string $nomination номинация заявки: по изобразительному искусству,
     *        прикладному творчеству и фотографии работа присылается изображением,
     *        а не видеозаписью, и требовать от неё ссылку на видео нельзя.
     */
    function video_verify(string $url, string $nomination = ''): array {
        $url = trim($url);
        if ($url === '' || !filter_var($url, FILTER_VALIDATE_URL) || !preg_match('~^https?://~i', $url)) {
            return _lc_bad('', 'Введите полную ссылку, начиная с https://');
        }
        $host = mb_strtolower((string)(parse_url($url, PHP_URL_HOST) ?: ''));
        $host = preg_replace('~^www\.~', '', $host);

        // Явно запрещённые площадки.
        // Хост сверяем ЦЕЛИКОМ, а не подстрокой: str_contains пропускал адреса
        // вида rutube.ru.attacker.net и 127.0.0.1/?x=vk.com — то есть наш сервер
        // шёл curl'ом куда укажут, включая внутреннюю сеть.
        $hostIs = function (string $dom) use ($host): bool {
            return $host === $dom || str_ends_with($host, '.' . $dom);
        };
        foreach (['youtube.com','youtu.be','instagram.com','facebook.com','fb.watch','tiktok.com'] as $b) {
            if ($hostIs($b)) return _lc_bad('', 'Эта платформа не принимается. Разрешены: RuTube, VK, Яндекс.Диск, Google Диск, ОК, Дзен.');
        }
        // Ни одна известная площадка не совпала — дальше не идём и НИКУДА не ходим.
        // vk.ru — второй домен ВКонтакте: соцсеть сама отдаёт его в «Поделиться»,
        // и участник приносит ссылку именно оттуда. В списке его не было, и форма
        // отвечала «эта платформа не принимается» на обычную ссылку ВК Видео.
        $known = ['rutube.ru','vk.com','vk.ru','vkvideo.ru','disk.yandex.ru','disk.yandex.com','yadi.sk',
                  'drive.google.com','docs.google.com','cloud.mail.ru','ok.ru','dzen.ru','zen.yandex.ru'];
        $okHost = false;
        foreach ($known as $k) { if ($hostIs($k)) { $okHost = true; break; } }
        if (!$okHost) {
            return _lc_bad('', 'Эта платформа не принимается. Разрешены: RuTube, VK, Яндекс.Диск, Google Диск, Облако Mail.ru, ОК, Дзен.');
        }

        /* ---- RuTube ---- */
        if ($hostIs('rutube.ru')) {
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
        if ($hostIs('vk.com') || $hostIs('vk.ru') || $hostIs('vkvideo.ru')) {
            /* РАБОТА ХУДОЖНИКА — ЭТО ФОТОГРАФИЯ, А НЕ ВИДЕО.
             *
             * Здесь стояло жёсткое требование ссылки вида …/video-123_456, и по
             * изобразительному искусству, прикладному творчеству и фотографии
             * заявку подать было нельзя вовсе: участник даёт ссылку на снимок
             * работы или на альбом с ней, а форма отвечала «дайте ссылку на
             * видео». Именно об это и споткнулась участница 21 августа: «ни одна
             * ссылка на альбом не отправляется, Яндекс.Диск и ВК».
             *
             * Для этих номинаций ссылка на фотографию или альбом ВКонтакте —
             * нормальная форма подачи. Для остальных требование прежнее: там
             * работа именно записывается. */
            // Фотография и альбом ВКонтакте принимаются в любой номинации: это
            // такая же конкурсная работа, как видеозапись. Ограничивать форму
            // работы — дело положения и жюри, а не проверки ссылки.
            if (preg_match('#/(photo-?\d+_\d+|album-?\d+_\d+)#i', $url)) {
                return _lc_result('ВКонтакте', null);
            }
            /* ВК РАЗДАЁТ ССЫЛКУ НА ВИДЕО В ЧЕТЫРЁХ РАЗНЫХ ВИДАХ.
             *
             * Шаблон принимал только старый: …/video-123_456. Всё остальное, что
             * соцсеть кладёт человеку в буфер по кнопке «Поделиться», форма
             * отбивала как «дайте ссылку на саму работу»:
             *   • vkvideo.ru/video/-123_456  — новый домен ВК Видео, со слэшем;
             *   • vk.com/clip-123_456        — клип (а работы часто снимают клипом);
             *   • vk.com/video_ext.php?oid=-123&id=456 — код встраивания плеера;
             *   • vk.ru/video-123_456        — второй домен соцсети.
             * Участник видит рабочую ссылку и отказ формы — и уходит. */
            if (preg_match('#(?:video|clip)/?(-?\d+_\d+(?:_[a-z0-9]+)?)#i', $url, $m)) {
                $vid = $m[1];
            } elseif (preg_match('#video_ext\.php#i', $url)
                   && preg_match('#[?&]oid=(-?\d+)#i', $url, $mo)
                   && preg_match('#[?&]id=(\d+)#i', $url, $mi)) {
                $vid = $mo[1] . '_' . $mi[1];
            } else {
                return _lc_bad('VK Видео',
                    'Дайте ссылку на саму работу: видео ВКонтакте (…/video-123_456), клип (…/clip-123_456), '
                    . 'фотографию (…/photo123_456) или файл на Яндекс.Диске, Google Диске, в Облаке Mail.ru.');
            }
            // Ключ доступа может стоять и параметром list= — тогда он в адресе отдельно.
            if (!str_contains(substr($vid, 4), '_') && preg_match('#[?&]list=([a-z0-9]+)#i', $url, $lm)) {
                $vid .= '_' . $lm[1];
            }
            $tok = function_exists('cfgv') ? (string) cfgv('vk_token', '') : '';
            if ($tok !== '') {
                $j = _lc_http_json('https://api.vk.com/method/video.get?videos=' . $vid
                    . '&access_token=' . rawurlencode($tok) . '&v=5.199');
                if (is_array($j) && isset($j['response'])) {
                    $item = $j['response']['items'][0] ?? null;
                    if (!$item) return _lc_bad('VK Видео', 'Видео VK не найдено или закрыто (приватный доступ). Откройте доступ по ссылке.');

                    // ВК ОТВЕЧАЕТ КАРТОЧКОЙ ДАЖЕ НА ЗАКРЫТОЕ ВИДЕО.
                    //
                    // На удалённую или недоступную запись приходит не пустой
                    // список, а карточка с пометкой content_restricted и
                    // объяснением внутри. Проверка смотрела только на наличие
                    // карточки — и пропускала заявки со ссылками, которые жюри
                    // потом не могло открыть. Проверяем именно возможность
                    // воспроизведения.
                    if (!empty($item['content_restricted'])) {
                        $why = trim((string) ($item['content_restricted_message'] ?? ''));
                        return _lc_bad('VK Видео', 'Это видео ВКонтакте недоступно'
                            . ($why !== '' ? ' (' . $why . ')' : '')
                            . '. Загрузите запись заново и откройте доступ всем по ссылке.');
                    }
                    if (isset($item['restriction']) && empty($item['restriction']['can_play'])) {
                        return _lc_bad('VK Видео', 'Видео ВКонтакте закрыто ограничением и не воспроизводится. '
                            . 'Проверьте настройки приватности: доступ должен быть открыт всем.');
                    }
                    // Ни длительности, ни даты — записи по этой ссылке фактически нет.
                    if ((int) ($item['duration'] ?? 0) === 0 && (int) ($item['date'] ?? 0) === 0) {
                        return _lc_bad('VK Видео', 'По этой ссылке видео ВКонтакте не открывается. '
                            . 'Проверьте адрес и настройки доступа.');
                    }
                    // Нет ни плеера, ни файлов — значит смотреть нечего.
                    if (empty($item['player']) && empty($item['files'])) {
                        return _lc_bad('VK Видео', 'Видео ВКонтакте не отдаёт запись для просмотра. '
                            . 'Скорее всего доступ ограничен настройками приватности.');
                    }
                    $ts = !empty($item['date']) ? (int) $item['date'] : null;
                    return _lc_result('VK Видео', $ts);
                }
                // API ответил ошибкой: чаще всего это «доступ запрещён» по
                // приватной записи. Так и говорим, а не пропускаем молча.
                if (is_array($j) && isset($j['error'])) {
                    $code = (int) ($j['error']['error_code'] ?? 0);
                    if (in_array($code, [15, 200, 201, 204], true)) {
                        return _lc_bad('VK Видео', 'Доступ к видео ВКонтакте закрыт настройками приватности. '
                            . 'Откройте доступ всем по ссылке и пришлите её заново.');
                    }
                }
            }
            // Токена нет / API не ответил — проверим хотя бы доступность страницы.
            [$code] = _lc_http_get($url, 7, true);
            if ($code === 404) return _lc_bad('VK Видео', 'Видео VK не найдено (404).');
            return _lc_result('VK Видео', null, 'Ссылка принята, доступ проверить не удалось');
        }

        /* ---- Яндекс.Диск ---- */
        if ($hostIs('disk.yandex.ru') || $hostIs('disk.yandex.com') || $hostIs('yadi.sk')) {
            $api = 'https://cloud-api.yandex.net/v1/disk/public/resources?public_key='
                 . rawurlencode($url) . '&fields=name,created,modified,type,media_type';
            $j = _lc_http_json($api);
            if ($j === null || isset($j['error'])) {
                return _lc_bad('Яндекс.Диск', 'Файл на Яндекс.Диске недоступен (нет доступа, приватный или удалён). Откройте доступ «по ссылке».');
            }
            /* КОНКУРСНАЯ РАБОТА — ВИДЕО, ФОТО ИЛИ ЗАПИСЬ ЗВУКА.
             *
             * Раньше видео требовалось от всех, кроме номинаций, опознанных как
             * «художественные» по названию. Правило било мимо: в справочнике нет
             * декоративно-прикладного творчества, и мастер по керамике выбирал
             * «Иные номинации» — а значит снова упирался в «этот файл не является
             * видео». Художница так и не смогла подать заявку.
             *
             * Форма работы — дело участника и жюри, а не проверки ссылки. Её дело
             * другое: убедиться, что по ссылке лежит НАСТОЯЩИЙ КОНКУРСНЫЙ МАТЕРИАЛ,
             * а не архив, не документ и не случайный файл. Поэтому принимаем видео,
             * изображение и звук в любой номинации, а остальное отклоняем. */
            if (($j['type'] ?? '') === 'dir') {
                // Папку пропускаем: там лежат снимки одной работы с разных сторон
                // или части выступления. Что папка не общая на весь класс, следит
                // отдельное правило — lu_* в core/link_unique.php.
            }
            $mt = (string) ($j['media_type'] ?? '');
            if ($mt !== '' && !in_array($mt, ['video', 'image', 'audio'], true)) {
                return _lc_bad('Яндекс.Диск',
                    'По ссылке лежит файл типа «' . $mt . '» — это не конкурсная работа. '
                    . 'Приложите видеозапись, фотографию работы или аудиозапись.');
            }
            $ts = null;
            foreach (['created','modified'] as $k) { if (!empty($j[$k])) { $ts = strtotime((string)$j[$k]) ?: $ts; if ($ts) break; } }
            return _lc_result('Яндекс.Диск', $ts);
        }

        /* ---- Google Диск ---- */
        if ($hostIs('drive.google.com') || $hostIs('docs.google.com')) {
            // Папка Google Диска разрешена: там лежат снимки одной работы с разных
            // сторон или части выступления. Что папка не общая на весь класс,
            // следит отдельное правило в core/link_unique.php.
            if (preg_match('#drive\.google\.com/drive/(u/\d+/)?folders/#i', $url)) {
                return _lc_result('Google Диск', null);
            }
            if (!preg_match('#/d/([a-zA-Z0-9_-]{10,})#', $url, $m) && !preg_match('#[?&]id=([a-zA-Z0-9_-]{10,})#', $url, $m)) {
                return _lc_bad('Google Диск',
                    'Дайте ссылку на файл или папку Google Диска с конкурсной работой (…/file/d/…/view).');
            }
            [$code, $body] = _lc_http_get('https://drive.google.com/file/d/' . $m[1] . '/view', 8);
            if ($code === 404 || $code === 410) return _lc_bad('Google Диск', 'Файл Google Диска не найден или удалён.');
            if ($code === 0) return _lc_result('Google Диск', null, 'Ссылка принята, доступ проверить не удалось'); // сеть — не блокируем
            $needAccess = (stripos($body, 'ServiceLogin') !== false || stripos($body, 'accounts.google.com/AccountChooser') !== false
                || stripos($body, 'Запросить доступ') !== false || stripos($body, 'Request access') !== false
                || stripos($body, 'Нужен доступ') !== false || stripos($body, 'You need access') !== false);
            if ($needAccess) return _lc_bad('Google Диск', 'Файл Google Диска закрыт. Откройте доступ «Всем, у кого есть ссылка».');
            return _lc_result('Google Диск', _lc_html_date($body)); // дату Drive обычно не отдаёт
        }

        /* ---- Облако Mail.ru ---- */
        // Публичного API у облака нет, поэтому проверяем то, что можно: страница
        // открывается и это не папка. Ссылка на папку — самая частая ошибка: человек
        // делится всей папкой с работами, а жюри нужен конкретный файл.
        if ($hostIs('cloud.mail.ru')) {
            if (!preg_match('#cloud\.mail\.ru/public/#i', $url)) {
                return _lc_bad('Облако Mail.ru', 'Дайте публичную ссылку из Облака Mail.ru (cloud.mail.ru/public/…), '
                    . 'полученную кнопкой «Поделиться».');
            }
            [$code, $body] = _lc_http_get($url, 9);
            if ($code === 404 || $code === 410) return _lc_bad('Облако Mail.ru', 'Файл в Облаке Mail.ru не найден или удалён.');
            if ($code === 0) return _lc_result('Облако Mail.ru', null, 'Ссылка принята, доступ проверить не удалось');   // сеть — не караем
            if (stripos($body, 'Файл не найден') !== false || stripos($body, 'ссылка недействительна') !== false) {
                return _lc_bad('Облако Mail.ru', 'Ссылка на Облако Mail.ru недействительна. Создайте публичную ссылку заново.');
            }
            if (preg_match('#"type"\s*:\s*"folder"#i', $body) || stripos($body, 'Общая папка') !== false) {
                return _lc_bad('Облако Mail.ru', 'Ссылка ведёт на папку, а не на конкурсное видео. Дайте ссылку на сам видеофайл.');
            }
            return _lc_result('Облако Mail.ru', _lc_html_date($body));
        }

        /* ---- ОК Видео ---- */
        if ($hostIs('ok.ru')) {
            if (!preg_match('#ok\.ru/(?:video|videoembed|live)/(\d+)#i', $url, $m)) {
                return _lc_bad('ОК Видео', 'Дайте ссылку на конкретное видео ОК (ok.ru/video/…).');
            }
            [$code, $body] = _lc_http_get('https://ok.ru/video/' . $m[1], 9);
            if ($code === 404) return _lc_bad('ОК Видео', 'Видео в ОК не найдено (404).');
            if ($code === 0) return _lc_result('ОК Видео', null, 'Ссылка принята, доступ проверить не удалось');
            if (stripos($body, 'видео удалено') !== false || stripos($body, 'видео недоступно') !== false
                || stripos($body, 'больше не доступно') !== false) {
                return _lc_bad('ОК Видео', 'Видео в ОК удалено или недоступно. Проверьте открытый доступ.');
            }
            return _lc_result('ОК Видео', _lc_html_date($body));
        }

        /* ---- Дзен Видео ---- */
        if ($hostIs('dzen.ru') || $hostIs('zen.yandex.ru')) {
            [$code, $body] = _lc_http_get($url, 9);
            if ($code === 404) return _lc_bad('Дзен Видео', 'Видео в Дзене не найдено (404).');
            if ($code === 0) return _lc_result('Дзен Видео', null, 'Ссылка принята, доступ проверить не удалось');
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
