<?php
/**
 * VK API — авто-постинг, работа со стеной, рассылки и т.п. от лица пользователя (Председатель Оргкомитета)
 * или сообщества Культурного центра «Музыкальный Мир» (vk.com/music_world.online, id 211325055, is_admin=1, admin_level=3).
 *
 * Токен лежит в config.local.php (MUZMIR_VK_TOKEN), доступен через cfgv('vk_token').
 * Для постинга от имени сообщества передаётся owner_id = -group_id и from_group=1.
 */
declare(strict_types=1);

/** Базовый вызов метода VK API. $tokenOverride — использовать иной токен (напр. токен сообщества). */
function vk_api(string $method, array $params = [], string $tokenOverride = ''): array {
    $token = $tokenOverride !== '' ? $tokenOverride : (string) cfgv('vk_token');
    if ($token === '') return ['error' => ['error_msg' => 'VK token not configured']];
    $params['access_token'] = $token;
    $params['v'] = cfgv('vk_api_version', '5.199');

    // ВК ограничивает частоту (3 запроса в секунду) и иногда отдаёт временные сбои.
    // Раньше один такой отказ означал пост БЕЗ афиши: загрузка молча возвращала пусто.
    // Теперь временные ошибки повторяем с нарастающей паузой.
    $tempCodes = [1, 6, 9, 10, 29];   // неизвестная, слишком часто, флуд, внутренняя, лимит
    $last = ['error' => ['error_msg' => 'нет ответа']];
    for ($try = 1; $try <= 4; $try++) {
        $ch = curl_init('https://api.vk.com/method/' . $method);
        curl_setopt_array($ch, [
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => http_build_query($params),
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 25,
            CURLOPT_CONNECTTIMEOUT => 10,
        ]);
        $res = curl_exec($ch);
        $err = curl_error($ch);
        curl_close($ch);

        if ($res === false) {
            $last = ['error' => ['error_msg' => 'cURL: ' . $err]];
        } else {
            $d = json_decode((string) $res, true);
            if (!is_array($d)) {
                $last = ['error' => ['error_msg' => 'Bad JSON response']];
            } else {
                $code = (int) ($d['error']['error_code'] ?? 0);
                if (!isset($d['error']) || !in_array($code, $tempCodes, true)) return $d;   // успех или окончательный отказ
                $last = $d;
            }
        }
        if ($try < 4) {
            _vk_log(sprintf('%s: временный сбой (%s), попытка %d из 4',
                            $method, (string) ($last['error']['error_msg'] ?? '?'), $try));
            usleep(400000 * $try);                  // 0.4с, 0.8с, 1.2с
        }
    }
    return $last;
}

/** Пост на стену сообщества КЦ (от лица сообщества, from_group=1). */
function vk_wall_post(string $message, array $extra = []): array {
    $gid = (int) cfgv('vk_group_id', 211325055);
    if ($gid <= 0) return ['error' => ['error_msg' => 'VK group_id not configured']];
    $params = array_merge([
        'owner_id'   => -$gid,
        'from_group' => 1,
        'message'    => $message,
    ], $extra);
    $r = vk_api('wall.post', $params);
    if (isset($r['error'])) {
        _vk_log('wall.post ERR: ' . ($r['error']['error_msg'] ?? '?'));
    } else {
        _vk_log('wall.post OK post_id=' . ($r['response']['post_id'] ?? '?'));
    }
    return $r;
}

/**
 * Загрузить изображение и получить attachments-строку для wall.post.
 * Возвращает "photo{owner_id}_{id}" или '' — причина последней неудачи доступна
 * через vk_upload_last_error(). Вся загрузка (три шага ВК) повторяется до трёх раз:
 * на живом тесте половина афиш терялась из-за частотного лимита ВК, и пост уходил
 * без афиши — а афиша здесь обязательна.
 */
function vk_upload_wall_photo(string $filePath): string {
    if (!is_file($filePath)) { vk_upload_last_error('файла нет: ' . $filePath); return ''; }
    $gid = (int) cfgv('vk_group_id', 211325055);

    for ($try = 1; $try <= 3; $try++) {
        // 1) получить upload url
        $s = vk_api('photos.getWallUploadServer', ['group_id' => $gid]);
        $url = (string) ($s['response']['upload_url'] ?? '');
        if ($url === '') {
            vk_upload_last_error('getWallUploadServer: ' . (string) ($s['error']['error_msg'] ?? 'пусто'));
        } else {
            // 2) загрузить файл
            $ch = curl_init($url);
            curl_setopt_array($ch, [
                CURLOPT_POST => true,
                CURLOPT_POSTFIELDS => ['photo' => new CURLFile($filePath)],
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_TIMEOUT => 60,
            ]);
            $raw = (string) curl_exec($ch);
            $cerr = curl_error($ch);
            curl_close($ch);
            $up = json_decode($raw, true);
            if (!is_array($up) || empty($up['photo'])) {
                vk_upload_last_error('загрузка файла: ' . ($cerr !== '' ? $cerr : substr($raw, 0, 120)));
            } else {
                // 3) сохранить фото
                $save = vk_api('photos.saveWallPhoto', [
                    'group_id' => $gid,
                    'photo'    => (string) $up['photo'],
                    'server'   => (string) ($up['server'] ?? ''),
                    'hash'     => (string) ($up['hash'] ?? ''),
                ]);
                $ph = $save['response'][0] ?? [];
                if ($ph) {
                    if ($try > 1) _vk_log('афиша загрузилась со ' . $try . '-й попытки: ' . basename($filePath));
                    return 'photo' . (int) $ph['owner_id'] . '_' . (int) $ph['id'];
                }
                vk_upload_last_error('saveWallPhoto: ' . (string) ($save['error']['error_msg'] ?? 'пусто'));
            }
        }
        if ($try < 3) usleep(700000 * $try);        // 0.7с, 1.4с — переждать частотный лимит
    }
    _vk_log('АФИША НЕ ЗАГРУЗИЛАСЬ (' . basename($filePath) . '): ' . vk_upload_last_error());
    return '';
}

/** Причина последней неудачной загрузки афиши (для админки и логов). */
function vk_upload_last_error(?string $set = null): string {
    static $e = '';
    if ($set !== null) $e = $set;
    return $e;
}

/**
 * Пост на стену с одним изображением.
 * Если афишу приложить не удалось — пост всё равно уходит (текст важнее молчания),
 * но факт помечается в ответе (photo_missing) и в логе, чтобы это было видно,
 * а не выяснялось потом по пустому посту.
 */
function vk_wall_post_with_photo(string $message, string $photoPath, array $extra = []): array {
    $att = $photoPath !== '' ? vk_upload_wall_photo($photoPath) : '';
    if ($att === '') {
        $r = vk_wall_post($message, $extra);
        if ($photoPath !== '') {
            $r['photo_missing'] = true;
            $r['photo_error']   = vk_upload_last_error();
            _vk_log('пост опубликован БЕЗ афиши: ' . vk_upload_last_error());
        }
        return $r;
    }
    $extra['attachments'] = $att;
    return vk_wall_post($message, $extra);
}

/**
 * Опубликовать историю (сторис) сообщества из изображения (лучше 1080×1920, 9:16).
 * Кликабельная ссылка ($link) добавляется, только если у сообщества есть право
 * на ссылки в историях; иначе публикуем сторис без ссылки.
 * @return array VK-ответ stories.save (response.items[0].story при успехе).
 */
function vk_story_photo(string $filePath, string $link = ''): array {
    if (!is_file($filePath)) return ['error' => ['error_msg' => 'story file not found: ' . $filePath]];
    $gid = (int) cfgv('vk_group_id', 211325055);
    $params = ['group_id' => $gid, 'add_to_news' => 1];
    if ($link !== '') { $params['link_url'] = $link; $params['link_text'] = 'open'; }
    $s = vk_api('stories.getPhotoUploadServer', $params);
    $url = (string) ($s['response']['upload_url'] ?? '');
    if ($url === '') {
        // Ссылка не разрешена — пробуем без неё.
        if ($link !== '') return vk_story_photo($filePath, '');
        _vk_log('story upload_url ERR: ' . json_encode($s['error'] ?? $s, JSON_UNESCAPED_UNICODE));
        return $s;
    }
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => ['file' => new CURLFile($filePath)],
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 60,
    ]);
    $up = json_decode((string) curl_exec($ch), true);
    curl_close($ch);
    $ur = $up['response']['upload_result'] ?? ($up['response'] ?? '');
    if (!$ur) { _vk_log('story upload failed'); return ['error' => ['error_msg' => 'story upload failed']]; }
    $save = vk_api('stories.save', ['upload_results' => is_array($ur) ? json_encode($ur) : (string) $ur]);
    if (isset($save['error'])) _vk_log('stories.save ERR: ' . ($save['error']['error_msg'] ?? '?'));
    else _vk_log('stories.save OK');
    return $save;
}

/**
 * Единая публикация анонса: пост на стену сообщества (+ фото) и, при наличии
 * картинки, дубль в историю (сторис). Возвращает результаты обеих операций.
 * @return array{wall:array,story:?array}
 */
function vk_publish_post(string $message, string $photoPath = '', bool $alsoStory = true, string $link = ''): array {
    $wall  = $photoPath !== '' ? vk_wall_post_with_photo($message, $photoPath) : vk_wall_post($message);
    $story = ($alsoStory && $photoPath !== '') ? vk_story_photo($photoPath, $link) : null;
    return ['wall' => $wall, 'story' => $story];
}

/* ============ Рассылка подписчикам через сервис «Рассылки» (vkforms) ============ */

/**
 * Отправка рассылки подписчикам сообщества через сервис «Рассылки»
 * (broadcast.vkforms.ru, приложение в меню сообщества). Легально: аудитория —
 * те, кто сам подписался на рассылку. Лимит сервиса — 200 рассылок/сутки.
 *
 * Ключи в config.local.php:
 *   vk_broadcast_token — ключ доступа (Управление сервисом → Настройки → Создать ключ)
 *   vk_broadcast_lists — id списков рассылки через запятую (необязательно; если
 *                        пусто — рассылка по всем спискам сервиса не делается,
 *                        нужен хотя бы один list_id).
 *
 * @param string $message   текст поста
 * @param string $attachment attachment-строка VK (например 'wall-GID_POSTID' или 'photoOWNER_ID')
 * @return array{ok:bool,error?:string,id?:int}
 */
function vk_broadcast(string $message, string $attachment = ''): array {
    $token = trim((string) cfgv('vk_broadcast_token', ''));
    if ($token === '') return ['ok' => false, 'error' => 'vk_broadcast_token не настроен'];
    $lists = array_values(array_filter(array_map('trim', explode(',', (string) cfgv('vk_broadcast_lists', '')))));
    // Если id списка не задан — подбираем автоматически по имени базы («…вещает»).
    if (!$lists) {
        $id = vk_broadcast_resolve_list($token, (string) cfgv('vk_broadcast_list_name', 'вещает'));
        if ($id > 0) $lists = [(string) $id];
    }
    if (!$lists) return ['ok' => false, 'error' => 'не найден список рассылки (проверьте ключ или задайте vk_broadcast_lists)'];

    $body = [
        'message'  => $message,
        'list_ids' => array_map('intval', $lists),
        'run_now'  => 1,
    ];
    if ($attachment !== '') $body['attachment'] = $attachment;

    $ch = curl_init('https://broadcast.vkforms.ru/api/v2/broadcast?token=' . rawurlencode($token));
    curl_setopt_array($ch, [
        CURLOPT_POST           => true,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 25,
        CURLOPT_HTTPHEADER     => ['Content-Type: application/json'],
        CURLOPT_POSTFIELDS     => json_encode($body, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
    ]);
    $resp = curl_exec($ch);
    $err  = curl_error($ch);
    curl_close($ch);
    if ($resp === false) { _vk_log('broadcast cURL ERR: ' . $err); return ['ok' => false, 'error' => 'cURL: ' . $err]; }
    $d = json_decode((string) $resp, true);
    if (isset($d['error'])) {
        _vk_log('broadcast API ERR: ' . json_encode($d['error'], JSON_UNESCAPED_UNICODE));
        return ['ok' => false, 'error' => (string) ($d['error']['description'] ?? $d['error']['message'] ?? 'unknown')];
    }
    $id = (int) ($d['response']['id'] ?? 0);
    _vk_log('broadcast OK id=' . $id);
    return ['ok' => true, 'id' => $id];
}

/** Найти id списка рассылки сервиса «Рассылки» по части имени (например «вещает»). */
function vk_broadcast_resolve_list(string $token, string $needle): int {
    static $cache = [];
    if (isset($cache[$needle])) return $cache[$needle];
    $ch = curl_init('https://broadcast.vkforms.ru/api/v2/list/?token=' . rawurlencode($token));
    curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 15]);
    $resp = curl_exec($ch);
    curl_close($ch);
    $d = json_decode((string) $resp, true);
    $lists = $d['response']['lists'] ?? [];
    $found = 0; $needleLc = mb_strtolower(trim($needle));
    foreach ($lists as $l) {
        if ($needleLc === '' || mb_stripos((string) ($l['name'] ?? ''), $needleLc) !== false) {
            $found = (int) ($l['id'] ?? 0);
            if ($found > 0) break;
        }
    }
    // Фолбэк — первый список, если по имени не нашли
    if ($found === 0 && !empty($lists[0]['id'])) $found = (int) $lists[0]['id'];
    return $cache[$needle] = $found;
}

/* ==================== Рассылка в личку от имени сообщества ==================== */

/**
 * Очередь личных сообщений от сообщества (аудитория — открытые диалоги
 * сообщества: только те, кто сам писал/разрешил сообщения; ~5 тыс. диалогов).
 * Антидубль: UNIQUE(peer_id, kind, ref). Отправку делает cron/vk_dm_worker.php.
 */
function vk_dm_ensure_table(): void {
    db()->exec("CREATE TABLE IF NOT EXISTS vk_dm_queue (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        peer_id INTEGER NOT NULL,
        message TEXT NOT NULL,
        attachment TEXT NOT NULL DEFAULT '',
        kind TEXT NOT NULL,
        ref TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'queued',
        error TEXT,
        created_at TEXT NOT NULL DEFAULT (datetime('now')),
        sent_at TEXT,
        UNIQUE(peer_id, kind, ref)
    )");
    db()->exec("CREATE INDEX IF NOT EXISTS idx_vk_dm_status ON vk_dm_queue(status, id)");
}

/**
 * Поставить рассылку в личку всем открытым диалогам сообщества.
 * Получатели: messages.getConversations (только люди, кому можно писать).
 * Возвращает число добавленных в очередь.
 */
function vk_dm_enqueue_dialogs(string $message, string $attachment, string $kind, string $ref): int {
    if (trim((string) cfgv('vk_token', '')) === '') return 0;
    vk_dm_ensure_table();
    $gid = (int) cfgv('vk_group_id', 211325055);
    $ins = db()->prepare("INSERT OR IGNORE INTO vk_dm_queue (peer_id, message, attachment, kind, ref) VALUES (?,?,?,?,?)");
    $added = 0;
    $offset = 0;
    do {
        $r = vk_api('messages.getConversations', ['group_id' => $gid, 'count' => 200, 'offset' => $offset]);
        if (isset($r['error'])) {
            _vk_log('dm_enqueue getConversations ERR: ' . ($r['error']['error_msg'] ?? '?'));
            break;
        }
        $items = $r['response']['items'] ?? [];
        $total = (int) ($r['response']['count'] ?? 0);
        foreach ($items as $it) {
            $conv = $it['conversation'] ?? [];
            $peer = (int) ($conv['peer']['id'] ?? 0);
            if (($conv['peer']['type'] ?? '') !== 'user' || $peer <= 0) continue;
            if (isset($conv['can_write']['allowed']) && !$conv['can_write']['allowed']) continue;
            $ins->execute([$peer, $message, $attachment, $kind, $ref]);
            if ($ins->rowCount() > 0) $added++;
        }
        $offset += 200;
        usleep(350000); // мягкий rate-limit к VK API
    } while ($offset < $total && count($items) > 0);
    _vk_log("dm_enqueue kind=$kind ref=$ref added=$added");
    return $added;
}

/** Отправить одно личное сообщение от имени сообщества. */
/** Показать статус «печатает…» в диалоге ВК (держится ~10 сек, нужно повторять). */
function vk_typing(int $peer): void {
    if ($peer <= 0) return;
    vk_api('messages.setActivity', [
        'group_id' => (int) cfgv('vk_group_id', 211325055),
        'peer_id'  => $peer,
        'type'     => 'typing',
    ]);
}

/** Имя пользователя ВК по peer_id (для персонального приветствия). Кэш на запрос. */
function vk_user_name(int $peer): string {
    static $cache = [];
    if ($peer <= 0 || $peer >= 2000000000) return ''; // не личка/групповой чат
    if (isset($cache[$peer])) return $cache[$peer];
    $r = vk_api('users.get', ['user_ids' => $peer, 'fields' => 'first_name']);
    $name = trim((string) ($r['response'][0]['first_name'] ?? ''));
    return $cache[$peer] = $name;
}

function vk_dm_send(int $peer, string $message, string $attachment = '', int $randomId = 0): array {
    $params = [
        'group_id'  => (int) cfgv('vk_group_id', 211325055),
        'peer_id'   => $peer,
        'random_id' => $randomId ?: $peer,
        'message'   => $message,
    ];
    if ($attachment !== '') $params['attachment'] = $attachment;
    return vk_api('messages.send', $params);
}

/** attachment-строка «этот пост со стены» для личных сообщений. */
function vk_dm_wall_attachment(array $wallPostResult): string {
    $postId = (int) ($wallPostResult['response']['post_id'] ?? 0);
    if ($postId <= 0) return '';
    return 'wall-' . (int) cfgv('vk_group_id', 211325055) . '_' . $postId;
}

/** Проверить рабочий ли токен + права. */
function vk_health(): array {
    $u = vk_api('users.get', []);
    $g = vk_api('groups.getById', ['group_id' => (string) cfgv('vk_group_id', '211325055'), 'fields' => 'members_count,is_admin,admin_level']);
    return [
        'user_ok'   => isset($u['response'][0]['id']),
        'user'      => $u['response'][0] ?? null,
        'group_ok'  => isset($g['response'][0]) || isset($g['response']['groups'][0]),
        'group'     => $g['response'][0] ?? ($g['response']['groups'][0] ?? null),
        'error'     => $u['error'] ?? ($g['error'] ?? null),
    ];
}

function _vk_log(string $line): void {
    $dir = BASE_PATH . '/data/logs';
    if (!is_dir($dir)) @mkdir($dir, 0775, true);
    @file_put_contents($dir . '/vk.log', date('Y-m-d H:i:s') . ' ' . $line . "\n", FILE_APPEND);
}

/* =====================================================================
 *  РАСПРОСТРАНЕНИЕ ЗА ПРЕДЕЛЫ СОБСТВЕННОГО СООБЩЕСТВА
 *
 *  Своих подписчиков центр уже собрал, и их число само по себе не растёт.
 *  Новые участники приходят оттуда, где сидят педагоги: из сообществ школ
 *  искусств, домов культуры, методических объединений. Написать им сообщением
 *  ВКонтакте нельзя — сообщество не может первым postучаться в другое
 *  сообщество, а человеку пишет только если он сам начал диалог. Остаются два
 *  честных пути: репост (когда о нас упомянули или мы договорились о взаимном
 *  размещении) и поиск подходящих сообществ, чтобы было с кем договариваться.
 * ===================================================================== */

/**
 * Репост записи на стену нашего сообщества.
 *
 * $postUrl — ссылка вида https://vk.com/wall-12345_678 или готовый object
 * «wall-12345_678». Возвращает ['ok'=>bool, ...].
 */
function vk_repost(string $postUrl, string $comment = ''): array {
    $obj = trim($postUrl);
    if (preg_match('~wall(-?\d+_\d+)~', $obj, $m)) $obj = 'wall' . $m[1];
    if (!preg_match('~^wall-?\d+_\d+$~', $obj)) {
        return ['ok' => false, 'error' => 'не разобрал ссылку на запись: ' . $postUrl];
    }
    $gid = (int) cfgv('vk_group_id', 211325055);
    $p = ['object' => $obj, 'group_id' => $gid];
    if ($comment !== '') $p['message'] = $comment;

    $r = vk_api('wall.repost', $p);
    if (isset($r['error'])) {
        _vk_log('repost ERR: ' . json_encode($r['error'], JSON_UNESCAPED_UNICODE));
        return ['ok' => false, 'error' => (string) ($r['error']['error_msg'] ?? 'unknown')];
    }
    _vk_log('repost OK ' . $obj);
    return ['ok' => true, 'post_id' => (int) ($r['response']['post_id'] ?? 0)];
}

/**
 * Поиск профильных сообществ — кандидатов на взаимное размещение.
 *
 * Отдаёт только то, с чем есть смысл работать: открытые сообщества с живой
 * аудиторией. Совсем мелкие отсеиваются — размещение у них не окупает переписки;
 * совсем крупные обычно продают рекламу и на взаимность не идут, но их оставляем:
 * решать человеку.
 *
 * @return array список ['id','name','members','link'], отсортированный по размеру
 */
function vk_find_communities(string $query, int $limit = 40, int $minMembers = 300): array {
    // fields обязателен: без него ВК не отдаёт members_count, и любой отбор по
    // размеру аудитории молча выбрасывает вообще всё.
    // type не указываем намеренно: ВКонтакте принимает там ровно одно значение, а
    // на «group,page» отвечает пустым списком без всякой ошибки — ищем по всем видам.
    $r = vk_api('groups.search', [
        'q'      => $query,
        'count'  => max(1, min(100, $limit)),
        'sort'   => 0,
        'fields' => 'members_count,city,description',
    ]);
    if (isset($r['error'])) {
        _vk_log('groups.search ERR: ' . json_encode($r['error'], JSON_UNESCAPED_UNICODE));
        return [];
    }
    $out = [];
    foreach (($r['response']['items'] ?? []) as $g) {
        $members = (int) ($g['members_count'] ?? 0);
        if ($members < $minMembers) continue;
        if ((int) ($g['is_closed'] ?? 0) !== 0) continue;   // в закрытое не постучаться
        $out[] = [
            'id'      => (int) ($g['id'] ?? 0),
            'name'    => (string) ($g['name'] ?? ''),
            'members' => $members,
            'link'    => 'https://vk.com/' . (string) ($g['screen_name'] ?? ('club' . (int) ($g['id'] ?? 0))),
        ];
    }
    usort($out, fn($a, $b) => $b['members'] <=> $a['members']);
    return $out;
}
