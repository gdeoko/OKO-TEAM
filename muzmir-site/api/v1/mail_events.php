<?php
/**
 * СОБЫТИЯ ДОСТАВКИ ОТ СЕРВИСА РАССЫЛОК.
 *
 * До этого мы вообще не знали судьбу отправленного письма: очередь говорила
 * «отправлено», и на этом всё. Дошло ли оно, открыли ли, ушло ли в спам, пожаловался
 * ли человек — не видел никто. Отсюда и ощущение, что на тысячи писем нет ответа:
 * мерить было нечем.
 *
 * Сервис умеет присылать события сам. Здесь они принимаются, проверяются по
 * подписи и складываются в mail_events. Отвечать нужно быстро и всегда 200:
 * на ошибку сервис уводит подписку в отключённые и перестаёт слать вовсе.
 */
declare(strict_types=1);

require_once __DIR__ . '/_boot.php';

$raw = (string) file_get_contents('php://input');
if ($raw === '') { http_response_code(200); echo 'ok'; exit; }

$data = json_decode($raw, true);
if (!is_array($data)) { mev_log('не разобрали тело запроса: ' . mb_substr($raw, 0, 200)); http_response_code(200); echo 'ok'; exit; }

/** Короткий журнал приёма — чтобы видеть, что подписка жива и что приходит. */
function mev_log(string $msg): void {
    $dir = BASE_PATH . '/data/logs';
    if (!is_dir($dir)) @mkdir($dir, 0775, true);
    @file_put_contents($dir . '/mail_events.log', date('Y-m-d H:i:s') . ' ' . $msg . "\n", FILE_APPEND);
}

/**
 * ПОДПИСЬ ЗАПРОСА.
 *
 * Сервис кладёт в тело поле auth — это md5 от всего тела, в котором значение
 * самого auth заменено на наш ключ API. Значит, чтобы проверить, надо проделать
 * ту же замену над сырым телом.
 */
function mev_auth_ok(string $raw, array $data): bool {
    $got = (string) ($data['auth'] ?? '');
    $key = trim((string) cfgv('unisender_api_key', ''));
    if ($got === '' || $key === '') return false;
    return hash_equals(md5(str_replace($got, $key, $raw)), $got);
}

/** Таблица событий. Создаётся лениво, повторный вызов безопасен. */
function mev_migrate(): void {
    db()->exec("CREATE TABLE IF NOT EXISTS mail_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT '',
        event_time TEXT DEFAULT '',
        job_id TEXT DEFAULT '',
        comment TEXT DEFAULT '',
        created_at TEXT DEFAULT (datetime('now','localtime'))
    )");
    db()->exec("CREATE INDEX IF NOT EXISTS idx_mev_email ON mail_events(email)");
    db()->exec("CREATE INDEX IF NOT EXISTS idx_mev_status ON mail_events(status)");
    db()->exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_mev_uniq ON mail_events(email, status, event_time, job_id)");
}

/**
 * Вытаскиваем события из любой вложенности.
 *
 * Формат тела у сервиса менялся и может поменяться снова, а нам нужны всего три
 * величины. Поэтому не разбираем структуру по именам уровней, а обходим её всю и
 * берём каждый объект, где есть адрес и состояние.
 */
function mev_collect($node, array &$out): void {
    if (!is_array($node)) return;
    if (isset($node['email'], $node['status']) && is_string($node['email']) && is_string($node['status'])) {
        $out[] = [
            'email'      => mb_strtolower(trim($node['email'])),
            'status'     => trim((string) $node['status']),
            'event_time' => trim((string) ($node['event_time'] ?? '')),
            'job_id'     => trim((string) ($node['job_id'] ?? '')),
            'comment'    => mb_substr(trim((string) ($node['comment'] ?? ($node['delivery_info']['destination_response'] ?? ''))), 0, 300),
        ];
    }
    foreach ($node as $v) if (is_array($v)) mev_collect($v, $out);
}

if (!mev_auth_ok($raw, $data)) {
    // Не сохраняем чужое, но и не молчим: если подпись вдруг перестанет сходиться,
    // это будет видно в журнале сразу, а не через неделю пустых отчётов.
    mev_log('подпись не сошлась, событие отброшено: ' . mb_substr($raw, 0, 200));
    http_response_code(200); echo 'ok'; exit;
}

$events = [];
mev_collect($data, $events);
if (!$events) { mev_log('событий в теле нет'); http_response_code(200); echo 'ok'; exit; }

mev_migrate();
$saved = 0;
foreach ($events as $e) {
    if ($e['email'] === '' || $e['status'] === '') continue;
    try {
        q("INSERT OR IGNORE INTO mail_events (email, status, event_time, job_id, comment)
           VALUES (?,?,?,?,?)", [$e['email'], $e['status'], $e['event_time'], $e['job_id'], $e['comment']]);
        $saved++;
    } catch (\Throwable $ex) { mev_log('не записали событие: ' . $ex->getMessage()); }
}
mev_log('принято событий: ' . count($events) . ', записано: ' . $saved);

http_response_code(200);
echo 'ok';
