<?php
/* Delivery intent lives in the same atomic record as the lead. A worker may
 * retry an uncertain provider response; this is at-least-once delivery. */
function rc_delivery_jobs(array $lead): array {
    $channels = ['telegram', 'mail_team'];
    if (filter_var($lead['contact'] ?? '', FILTER_VALIDATE_EMAIL)) $channels[] = 'mail_client';
    if (($lead['kind'] ?? '') === 'support') $channels = ['telegram'];
    $jobs = [];
    foreach ($channels as $channel) $jobs[$channel] = ['status' => 'pending', 'attempts' => 0, 'next' => time()];
    return $jobs;
}
function rc_delivery_send(array $lead, string $channel): bool {
    $site = rc_sites()[$lead['site'] ?? 'cdn'] ?? 'Rocket';
    $title = (($lead['kind'] ?? '') === 'support' ? 'Обращение в поддержку' : 'Новая заявка') . ' · ' . $site;
    $name = $lead['name'] ?? ''; $contact = $lead['contact'] ?? '';
    $rows = ['Имя' => $name, 'Контакт' => $contact, 'Компания' => $lead['company'] ?? '',
        'Направление' => $lead['topic'] ?? '', 'Задача' => $lead['task'] ?? '', 'Страница' => $lead['page'] ?? ''];
    if ($channel === 'telegram') {
        $text = '<b>' . htmlspecialchars($title) . '</b>';
        foreach ($rows as $key => $value) if ($value !== '') $text .= "\n" . $key . ': ' . htmlspecialchars($value);
        $text .= "\nID: " . htmlspecialchars($lead['id']);
        return rc_notify($text, ['inline_keyboard' => [[
            ['text' => 'В работе', 'callback_data' => 'lead_work_' . $lead['id']],
            ['text' => 'Закрыть', 'callback_data' => 'lead_done_' . $lead['id']]
        ]]], 'tg_topic_form');
    }
    if ($channel === 'mail_team') return rc_mail(rc_cfg('mail_to'), $title . ': ' . $name, rc_mail_tpl($title, $rows));
    if ($channel === 'mail_client' && filter_var($contact, FILTER_VALIDATE_EMAIL)) {
        $en = ($lead['lang'] ?? '') === 'en';
        $heading = $en ? 'Request received' : 'Заявка принята';
        return rc_mail($contact, $heading . ' · ' . $site, rc_mail_tpl($heading,
            ['ID' => $lead['id'], 'Имя' => $name],
            $en ? 'We received your request and will reply shortly.' : 'Мы получили ваше обращение и скоро ответим.'));
    }
    return false;
}
function rc_delivery_run(int $limit = 8, ?callable $sender = null): array {
    $lock = @fopen(RC_DATA . '/delivery-worker.lock', 'c');
    if (!$lock || !flock($lock, LOCK_EX | LOCK_NB)) { if ($lock) fclose($lock); return ['busy' => true]; }
    $result = ['sent' => 0, 'failed' => 0];
    $started = microtime(true);
    try {
        for ($i = 0; $i < $limit && microtime(true) - $started < 45; $i++) {
            $claim = null; $now = time(); $token = bin2hex(random_bytes(12));
            $ok = rc_json_update(RC_LEADS, function ($data) use (&$claim, $now, $token) {
                foreach ($data['items'] ?? [] as $index => $lead) {
                    foreach ($lead['delivery'] ?? [] as $channel => $job) {
                        $status = $job['status'] ?? '';
                        $due = $status === 'pending' && ($job['next'] ?? 0) <= $now;
                        $expired = $status === 'sending' && ($job['lease'] ?? 0) < $now;
                        if (!$due && !$expired) continue;
                        $job['status'] = 'sending'; $job['lease'] = $now + 600; $job['claim'] = $token;
                        $job['attempts'] = ($job['attempts'] ?? 0) + 1;
                        $data['items'][$index]['delivery'][$channel] = $job;
                        $claim = [$lead, $channel];
                        return $data;
                    }
                }
                return $data;
            });
            if ($ok === false) throw new RuntimeException('delivery_claim_storage');
            if (!$claim) break;
            try { $sent = (bool)($sender ? $sender($claim[0], $claim[1]) : rc_delivery_send($claim[0], $claim[1])); }
            catch (Throwable $e) { $sent = false; }
            $ok = rc_json_update(RC_LEADS, function ($data) use ($claim, $token, $sent) {
                foreach ($data['items'] ?? [] as $index => $lead) {
                    if (($lead['id'] ?? '') !== $claim[0]['id']) continue;
                    $job = $lead['delivery'][$claim[1]] ?? [];
                    if (($job['claim'] ?? '') !== $token) continue;
                    $job['status'] = $sent ? 'sent' : (($job['attempts'] ?? 0) >= 8 ? 'failed' : 'pending');
                    $job['next'] = time() + min(3600, 30 * (2 ** min(7, $job['attempts'])));
                    $job['updated'] = time();
                    $job['error'] = $sent ? '' : 'provider_failed';
                    unset($job['claim'], $job['lease']);
                    $data['items'][$index]['delivery'][$claim[1]] = $job;
                    break;
                }
                return $data;
            });
            if ($ok === false) throw new RuntimeException('delivery_result_storage');
            $result[$sent ? 'sent' : 'failed']++;
        }
        rc_json_write(RC_DATA . '/delivery-health.json', ['at' => time(), 'result' => $result]);
    } finally { flock($lock, LOCK_UN); fclose($lock); }
    return $result;
}
