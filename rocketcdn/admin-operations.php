<?php
/* Included by api.php; every operation below requires its existing admin auth. */
if ($action === 'operations') {
    need_key();
    $data = rc_json_read(RC_LEADS, []); $jobs = []; $support = [];
    foreach ($data['items'] ?? [] as $lead) {
        if (($lead['kind'] ?? '') === 'support') $support[] = $lead;
        foreach ($lead['delivery'] ?? [] as $channel => $job) {
            $jobs[] = ['id' => $lead['id'], 'site' => $lead['site'] ?? 'cdn', 'channel' => $channel,
                'status' => $job['status'] ?? 'pending', 'attempts' => $job['attempts'] ?? 0,
                'next' => $job['next'] ?? 0, 'updated' => $job['updated'] ?? null];
        }
    }
    $health = rc_json_read(RC_DATA . '/delivery-health.json', []);
    out(['ok' => true, 'support' => array_slice(array_reverse($support), 0, 200),
        'jobs' => array_slice(array_reverse($jobs), 0, 300),
        'settings' => ['brand' => rc_cfg('brand'), 'lk_url' => rc_cfg('lk_url'), 'report_hour' => rc_cfg('report_hour')],
        'release' => ['version' => '2026.09.08-r2', 'storage' => is_writable(RC_DATA),
            'queue_worker_at' => $health['at'] ?? null, 'php' => PHP_MAJOR_VERSION . '.' . PHP_MINOR_VERSION,
            'products' => ['cdn', 'vpn', 'game']]]);
}
if ($action === 'delivery_retry') {
    need_key(); $id = (string)inp('id'); $channel = (string)inp('channel'); $found = false;
    rc_api_update(RC_LEADS, function ($data) use ($id, $channel, &$found) {
        foreach ($data['items'] ?? [] as $i => $lead) {
            if (($lead['id'] ?? '') !== $id || ($lead['delivery'][$channel]['status'] ?? '') !== 'failed') continue;
            $data['items'][$i]['delivery'][$channel] = ['status' => 'pending', 'attempts' => 0, 'next' => time()];
            $found = true; break;
        }
        return $data;
    });
    out(['ok' => $found, 'error' => $found ? null : 'not_failed']);
}
if ($action === 'settings_save') {
    need_key(); $brand = inp('brand'); $url = inp('lk_url'); $hour = filter_var(inp('report_hour'), FILTER_VALIDATE_INT);
    if (!is_string($brand) || $brand === '' || mb_strlen($brand) > 80 || !is_string($url) ||
        !filter_var($url, FILTER_VALIDATE_URL) || parse_url($url, PHP_URL_SCHEME) !== 'https' ||
        parse_url($url, PHP_URL_USER) !== null || $hour === false || $hour < 0 || $hour > 23) {
        http_response_code(422); out(['ok' => false, 'error' => 'settings']);
    }
    rc_api_write(RC_DATA . '/public-settings.json', ['brand' => $brand, 'lk_url' => $url, 'report_hour' => $hour]);
    out(['ok' => true]);
}
