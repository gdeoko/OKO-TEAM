<?php
/**
 * Общие мелкие помощники для cron-заданий КЦ «Музыкальный Мир».
 * НЕ относится к core/ (это не публичный контракт фундамента сайта) — просто общая
 * утильная библиотека, которую подключают файлы из cron/. Все функции мягкие:
 * никогда не бросают исключений наружу, при сбое возвращают false/пишут в лог.
 *
 * Подключать ПОСЛЕ core/db.php + core/helpers.php (использует cfgv/db/one/scalar).
 *
 * Соглашение по времени: created_at и другие *_at-колонки со значением по умолчанию
 * в схеме (core/db.php) пишутся SQL-дефолтом datetime('now') - это UTC, т.к. SQLite
 * сам по себе не переводит время в локальную зону. А вот значения, которые пишет
 * руками сам код проекта (sent_at, last_login, expires_at и т.п. - см. core/auth.php,
 * core/newsletter.php), готовятся через PHP date() по локальной зоне сайта
 * (Europe/Moscow, см. config.php). Поэтому в cron-скриптах: сравнения с
 * SQL-дефолтными колонками - через SQL-функции date()/datetime() с модификаторами
 * (та же UTC-шкала, что и сама колонка), а значения, которые cron пишет сам
 * (sent_at, published_at и т.д.) - через date(), как и остальной код проекта.
 * Исключение - s3_put_file(): подпись AWS SigV4 сама по протоколу требует
 * gmdate()/UTC, это не связано с общим соглашением проекта.
 */
declare(strict_types=1);

/** Строка в data/logs/cron.log. */
function cron_log(string $job, string $msg): void {
    $line = '[' . date('Y-m-d H:i:s') . "] [$job] $msg\n";
    @file_put_contents(BASE_PATH . '/data/logs/cron.log', $line, FILE_APPEND | LOCK_EX);
}

/**
 * Простая файловая блокировка на время выполнения задания: не даёт двум запускам
 * одного cron-скрипта пересечься (актуально для process_newsletter_queue раз в минуту).
 * $ttl — через сколько секунд «зависший» лок считается протухшим и снимается сам.
 */
function cron_lock(string $job, int $ttl = 3600): bool {
    $dir = BASE_PATH . '/data/logs';
    if (!is_dir($dir)) @mkdir($dir, 0775, true);
    $file = $dir . '/.lock_' . preg_replace('/[^a-z0-9_]/i', '', $job);
    if (is_file($file) && (time() - (int) @filemtime($file)) < $ttl) return false;
    @file_put_contents($file, (string) time());
    return true;
}
function cron_unlock(string $job): void {
    $file = BASE_PATH . '/data/logs/.lock_' . preg_replace('/[^a-z0-9_]/i', '', $job);
    @unlink($file);
}

/**
 * Идемпотентность разовых уведомлений/действий: проверяет, не зафиксировано ли уже
 * событие $action по сущности $entity/$entityId в audit_log (его пишет audit()).
 */
function already_notified(string $action, string $entity, int $entityId): bool {
    if (!function_exists('one')) return false;
    try {
        return (bool) one(
            "SELECT id FROM audit_log WHERE action=? AND entity=? AND entity_id=? LIMIT 1",
            [$action, $entity, $entityId]
        );
    } catch (\Throwable $e) {
        return false;
    }
}

/**
 * Уведомление внешнего мозг-агента КЦ (cfgv('agent_url')) о событии сайта.
 * Тихий фолбэк: если agent_url не задан или сервис недоступен — просто false,
 * ничего не роняет. Заголовок Authorization — Bearer cfgv('agent_token').
 */
function agent_notify(string $event, array $payload = []): bool {
    $url = trim((string) (function_exists('cfgv') ? cfgv('agent_url', '') : ''));
    if ($url === '') return false;
    $token = (string) cfgv('agent_token', '');

    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => json_encode([
            'event'   => $event,
            'payload' => $payload,
            'source'  => 'muzmir-cron',
            'ts'      => gmdate('c'),
        ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
        CURLOPT_HTTPHEADER     => array_values(array_filter([
            'Content-Type: application/json',
            $token !== '' ? 'Authorization: Bearer ' . $token : null,
        ])),
        CURLOPT_TIMEOUT        => 15,
        CURLOPT_CONNECTTIMEOUT => 8,
    ]);
    $resp = curl_exec($ch);
    $err  = curl_errno($ch);
    $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($err || $resp === false || $code >= 400) {
        cron_log('agent_notify', "FAIL event=$event curl#$err http=$code");
        return false;
    }
    return true;
}

/**
 * Значение ключа S3 (доступы/бакет/эндпоинт): сначала env S3_<NAME>, затем
 * env OKO_S3_<NAME>, затем cfg('MUZMIR_S3_<NAME>') (config.local.php), иначе $default.
 */
function s3_cfg(string $name, string $default = ''): string {
    foreach (["S3_$name", "OKO_S3_$name"] as $env) {
        $v = getenv($env);
        if ($v !== false && $v !== '') return $v;
    }
    $v = function_exists('cfg') ? (string) cfg("MUZMIR_S3_$name", '') : '';
    return $v !== '' ? $v : $default;
}

/** Есть ли вообще ключи для S3 (без них — сразу локальный фолбэк, без попытки сети). */
function s3_ready(): bool {
    return s3_cfg('ACCESS_KEY') !== '' && s3_cfg('SECRET_KEY') !== '';
}

/**
 * Загрузка одного файла в S3-совместимое хранилище (Timeweb Cloud, s3.twcstorage.ru)
 * через подпись запроса AWS SigV4 (PUT, без внешних SDK — чистый curl+hash_hmac).
 * Возвращает true при HTTP 2xx, иначе false (тихий лог в data/logs/cron.log).
 */
function s3_put_file(string $localPath, string $objectKey): bool {
    if (!is_file($localPath)) return false;
    if (!s3_ready()) return false;

    $access = s3_cfg('ACCESS_KEY');
    $secret = s3_cfg('SECRET_KEY');
    $bucket = s3_cfg('BUCKET', 'muzmir-backups');
    $host   = s3_cfg('ENDPOINT', 's3.twcstorage.ru');
    $region = s3_cfg('REGION', 'ru-1');

    $body = @file_get_contents($localPath);
    if ($body === false) return false;

    $amzDate   = gmdate('Ymd\THis\Z');
    $dateStamp = gmdate('Ymd');
    $payloadHash = hash('sha256', $body);
    $canonicalUri = '/' . rawurlencode($bucket) . '/'
        . implode('/', array_map('rawurlencode', explode('/', ltrim($objectKey, '/'))));

    $canonicalHeaders = "host:$host\nx-amz-content-sha256:$payloadHash\nx-amz-date:$amzDate\n";
    $signedHeaders = 'host;x-amz-content-sha256;x-amz-date';
    $canonicalRequest = "PUT\n$canonicalUri\n\n$canonicalHeaders\n$signedHeaders\n$payloadHash";

    $credentialScope = "$dateStamp/$region/s3/aws4_request";
    $stringToSign = "AWS4-HMAC-SHA256\n$amzDate\n$credentialScope\n" . hash('sha256', $canonicalRequest);

    $kDate    = hash_hmac('sha256', $dateStamp, 'AWS4' . $secret, true);
    $kRegion  = hash_hmac('sha256', $region, $kDate, true);
    $kService = hash_hmac('sha256', 's3', $kRegion, true);
    $kSigning = hash_hmac('sha256', 'aws4_request', $kService, true);
    $signature = hash_hmac('sha256', $stringToSign, $kSigning);

    $authHeader = "AWS4-HMAC-SHA256 Credential=$access/$credentialScope, SignedHeaders=$signedHeaders, Signature=$signature";

    $ch = curl_init("https://$host$canonicalUri");
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CUSTOMREQUEST  => 'PUT',
        CURLOPT_POSTFIELDS     => $body,
        CURLOPT_HTTPHEADER     => [
            'Host: ' . $host,
            'x-amz-content-sha256: ' . $payloadHash,
            'x-amz-date: ' . $amzDate,
            'Authorization: ' . $authHeader,
            'Content-Length: ' . strlen($body),
        ],
        CURLOPT_TIMEOUT        => 180,
        CURLOPT_CONNECTTIMEOUT => 15,
    ]);
    $resp = curl_exec($ch);
    $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $err  = curl_errno($ch);
    curl_close($ch);

    if ($err || $code < 200 || $code >= 300) {
        cron_log('s3_put_file', "FAIL $objectKey http=$code curl#$err resp=" . substr((string) $resp, 0, 300));
        return false;
    }
    cron_log('s3_put_file', "OK $bucket/$objectKey ($code)");
    return true;
}

/** Удаляет файлы в $dir старше $days дней, подходящие под маску $pattern (glob). */
function cron_rotate_dir(string $dir, string $pattern, int $days): int {
    if (!is_dir($dir)) return 0;
    $removed = 0;
    $cutoff = time() - $days * 86400;
    foreach (glob(rtrim($dir, '/') . '/' . $pattern) ?: [] as $f) {
        if (is_file($f) && (int) @filemtime($f) < $cutoff) {
            if (@unlink($f)) $removed++;
        }
    }
    return $removed;
}
