<?php
/**
 * VK API — авто-постинг, работа со стеной, рассылки и т.п. от лица пользователя (Председатель Оргкомитета)
 * или сообщества Культурного центра «Музыкальный Мир» (vk.com/music_world.online, id 211325055, is_admin=1, admin_level=3).
 *
 * Токен лежит в config.local.php (MUZMIR_VK_TOKEN), доступен через cfgv('vk_token').
 * Для постинга от имени сообщества передаётся owner_id = -group_id и from_group=1.
 */
declare(strict_types=1);

/** Базовый вызов метода VK API. */
function vk_api(string $method, array $params = []): array {
    $token = (string) cfgv('vk_token');
    if ($token === '') return ['error' => ['error_msg' => 'VK token not configured']];
    $params['access_token'] = $token;
    $params['v'] = cfgv('vk_api_version', '5.199');
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
    if ($res === false) return ['error' => ['error_msg' => 'cURL: ' . $err]];
    $d = json_decode((string) $res, true);
    return is_array($d) ? $d : ['error' => ['error_msg' => 'Bad JSON response']];
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

/** Загрузить изображение и получить attachments-строку для wall.post. Возвращает "photo{owner_id}_{id}" или ''. */
function vk_upload_wall_photo(string $filePath): string {
    if (!is_file($filePath)) return '';
    $gid = (int) cfgv('vk_group_id', 211325055);
    // 1) получить upload url
    $s = vk_api('photos.getWallUploadServer', ['group_id' => $gid]);
    $url = $s['response']['upload_url'] ?? '';
    if ($url === '') return '';
    // 2) загрузить файл
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_POSTFIELDS => ['photo' => new CURLFile($filePath)],
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 60,
    ]);
    $up = json_decode((string) curl_exec($ch), true);
    curl_close($ch);
    if (!$up || empty($up['photo'])) return '';
    // 3) сохранить фото
    $save = vk_api('photos.saveWallPhoto', [
        'group_id' => $gid,
        'photo'    => $up['photo'],
        'server'   => $up['server'] ?? '',
        'hash'     => $up['hash'] ?? '',
    ]);
    $ph = ($save['response'][0] ?? []);
    if (!$ph) return '';
    return 'photo' . $ph['owner_id'] . '_' . $ph['id'];
}

/** Пост на стену с одним изображением. */
function vk_wall_post_with_photo(string $message, string $photoPath, array $extra = []): array {
    $att = vk_upload_wall_photo($photoPath);
    if ($att === '') return vk_wall_post($message, $extra);
    $extra['attachments'] = $att;
    return vk_wall_post($message, $extra);
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
