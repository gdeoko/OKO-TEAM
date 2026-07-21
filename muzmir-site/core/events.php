<?php
/**
 * События сайта -> мозг-агент КЦ «Музыкальный Мир».
 *
 * emit_event($type, $data) шлёт POST на cfgv('agent_url').'/event' с
 * заголовком Authorization: Bearer cfgv('agent_token') и пишет строку в
 * таблицу events_log (создаётся идемпотентно). Если agent_url не задан -
 * тихий фолбэк: событие всё равно фиксируется в журнале со статусом skipped,
 * ничего не падает.
 *
 * Поддерживаемые типы:
 *   competition_open     - приём заявок конкурса открыт;
 *   competition_closed   - приём заявок конкурса завершён;
 *   results_published    - опубликованы результаты конкурса;
 *   new_application      - подана новая заявка;
 *   payment_success      - успешная оплата.
 *
 * $data - произвольный массив полезной нагрузки. Для конкурсных событий
 * рекомендуется ключ 'competition' с полями name/type/end_date/url/days_left,
 * которые агент использует для сборки поста-афиши (agent/content.py).
 */
declare(strict_types=1);

/** Список поддерживаемых типов событий. */
function event_types(): array {
    return [
        'competition_open',
        'competition_closed',
        'results_published',
        'new_application',
        'payment_success',
    ];
}

/** Идемпотентно создаёт журнал событий. */
function events_log_ensure(): void {
    static $done = false;
    if ($done) return;
    q("CREATE TABLE IF NOT EXISTS events_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL,
        payload TEXT DEFAULT '',
        status TEXT DEFAULT 'pending',     -- pending|sent|skipped|error
        http_code INTEGER DEFAULT 0,
        response TEXT DEFAULT '',
        created_at TEXT DEFAULT (datetime('now'))
    )");
    q("CREATE INDEX IF NOT EXISTS idx_events_type ON events_log(type)");
    $done = true;
}

/**
 * Отправляет событие сайта агенту и фиксирует его в журнале.
 * Никогда не бросает исключений - при любой ошибке тихий фолбэк.
 */
function emit_event(string $type, array $data): void {
    try {
        events_log_ensure();
        $payload = array_merge(['type' => $type], $data);
        $payloadJson = json_encode($payload, JSON_UNESCAPED_UNICODE);

        $logId = insert('events_log', [
            'type'    => $type,
            'payload' => $payloadJson,
            'status'  => 'pending',
        ]);

        $url = (string) cfgv('agent_url');
        if ($url === '') {
            update('events_log',
                ['status' => 'skipped', 'response' => 'agent_url не задан'],
                'id=:id', ['id' => $logId]);
            return;
        }

        $endpoint = rtrim($url, '/') . '/event';
        $token = (string) cfgv('agent_token');

        $ch = curl_init($endpoint);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_POST           => true,
            CURLOPT_POSTFIELDS     => $payloadJson,
            CURLOPT_HTTPHEADER     => array_values(array_filter([
                'Content-Type: application/json',
                $token ? 'Authorization: Bearer ' . $token : null,
            ])),
            CURLOPT_TIMEOUT        => 12,
            CURLOPT_CONNECTTIMEOUT => 6,
        ]);
        $resp = curl_exec($ch);
        $errno = curl_errno($ch);
        $code = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
        curl_close($ch);

        if ($errno || $resp === false) {
            update('events_log',
                ['status' => 'error', 'http_code' => $code,
                 'response' => 'curl: ' . $errno],
                'id=:id', ['id' => $logId]);
            return;
        }

        $status = ($code >= 200 && $code < 300) ? 'sent' : 'error';
        update('events_log',
            ['status' => $status, 'http_code' => $code,
             'response' => mb_substr((string) $resp, 0, 1000)],
            'id=:id', ['id' => $logId]);
    } catch (Throwable $e) {
        // Тихий фолбэк: событие сайта не должно ломать основной сценарий.
        if (function_exists('error_log')) {
            error_log('emit_event(' . $type . ') failed: ' . $e->getMessage());
        }
    }
}
