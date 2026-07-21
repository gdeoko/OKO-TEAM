<?php
/**
 * Голосование зрителей гала-концерта за «Приз зрительских симпатий».
 * GET  — текущие счётчики (для live-обновления на странице).
 * POST — приём голоса: nominee_key (обязателен), gala_id (по умолчанию 'main').
 * Антидубль: один голос на сессию (жёсткое ограничение уникальным индексом)
 * и дополнительно один голос на IP (проверка перед записью).
 */
declare(strict_types=1);
require __DIR__ . '/_boot.php';

// Своя таблица — создаётся идемпотентно, миграции ядра не трогаем.
db()->exec("CREATE TABLE IF NOT EXISTS gala_votes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    gala_id TEXT NOT NULL DEFAULT 'main',
    nominee_key TEXT NOT NULL,
    session_key TEXT NOT NULL DEFAULT '',
    ip TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now'))
)");
db()->exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_gala_votes_session ON gala_votes(gala_id, session_key)");
db()->exec("CREATE INDEX IF NOT EXISTS idx_gala_votes_nominee ON gala_votes(gala_id, nominee_key)");

/** Текущие счётчики голосов по номерам гала. */
function gala_vote_counts(string $galaId, array $keys): array {
    $counts = array_fill_keys($keys, 0);
    $rows = all("SELECT nominee_key, COUNT(*) c FROM gala_votes WHERE gala_id=? GROUP BY nominee_key", [$galaId]);
    foreach ($rows as $r) {
        if (array_key_exists($r['nominee_key'], $counts)) $counts[$r['nominee_key']] = (int) $r['c'];
    }
    return $counts;
}

if (!function_exists('gala_nominees_list')) {
    /**
     * Номера гала-концерта, участвующие в голосовании (совпадает со списком в gala.php).
     * Список настраивается через settings('gala_nominees') — JSON-массив
     * [{"key":"n1","name":"...","note":"..."}]. Без настройки — демонстрационный список.
     */
    function gala_nominees_list(): array {
        $raw = setting('gala_nominees', '');
        if ($raw !== '') {
            $decoded = json_decode($raw, true);
            if (is_array($decoded) && $decoded) return $decoded;
        }
        return [
            ['key' => 'n1', 'name' => 'Мария Иванова',                 'note' => 'Эстрадный вокал - «Вечерний свет»'],
            ['key' => 'n2', 'name' => 'Ансамбль «Радуга»',              'note' => 'Народный танец - «Хоровод»'],
            ['key' => 'n3', 'name' => 'Алексей Смирнов',                'note' => 'Фортепиано - «Осенний вальс»'],
            ['key' => 'n4', 'name' => 'Театральная студия «Маска»',     'note' => 'Музыкальный театр - «Сказка о потерянном времени»'],
            ['key' => 'n5', 'name' => 'Дарья Кузнецова',                'note' => 'Художественное слово - «Родина»'],
            ['key' => 'n6', 'name' => 'Дуэт «Гармония»',                'note' => 'Академический вокал - «Баркарола»'],
        ];
    }
}

$galaId = preg_replace('/[^a-z0-9_\-]/i', '', input('gala_id', 'main')) ?: 'main';
$keys = array_column(gala_nominees_list(), 'key');

$sessionKey = session_id() ?: '';
$ip = client_ip();
$already = one(
    "SELECT nominee_key FROM gala_votes WHERE gala_id=? AND (session_key=? OR (ip<>'' AND ip=?)) LIMIT 1",
    [$galaId, $sessionKey, $ip]
);

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'POST') {
    if (!rate_ok('gala_vote:' . $ip, 20, 3600)) {
        json_out(['ok' => false, 'error' => 'Слишком много запросов, попробуйте позже'], 429);
    }

    if ($already) {
        $counts = gala_vote_counts($galaId, $keys);
        json_out([
            'ok' => false, 'error' => 'Вы уже голосовали в этом гала-концерте',
            'voted' => $already['nominee_key'], 'counts' => $counts, 'total' => array_sum($counts),
        ]);
    }

    $nomineeKey = input('nominee_key');
    if ($nomineeKey === '' || !in_array($nomineeKey, $keys, true)) {
        json_out(['ok' => false, 'error' => 'Выберите номер из списка участников'], 422);
    }

    try {
        insert('gala_votes', [
            'gala_id' => $galaId, 'nominee_key' => $nomineeKey,
            'session_key' => $sessionKey, 'ip' => $ip,
        ]);
        audit('gala_vote', 'gala_votes', null, ['gala_id' => $galaId, 'nominee_key' => $nomineeKey]);
    } catch (\Throwable $e) {
        // Уникальный индекс поймал повторный голос той же сессии при гонке запросов — не ошибка.
    }

    $counts = gala_vote_counts($galaId, $keys);
    json_out(['ok' => true, 'voted' => $nomineeKey, 'counts' => $counts, 'total' => array_sum($counts)]);
}

// GET — просто отдаём текущие счётчики для live-обновления.
$counts = gala_vote_counts($galaId, $keys);
json_out(['ok' => true, 'voted' => $already['nominee_key'] ?? null, 'counts' => $counts, 'total' => array_sum($counts)]);
