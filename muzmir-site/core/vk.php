<?php
/**
 * VK API — авто-постинг, работа со стеной, рассылки и т.п. от лица пользователя (Председатель Оргкомитета)
 * или сообщества КЦ «Музыкальный Мир» (vk.com/music_world.online, id 211325055, is_admin=1, admin_level=3).
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
