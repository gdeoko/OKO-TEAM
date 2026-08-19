<?php
/**
 * ВЫГРУЗКА ПЕРЕПИСКИ СООБЩЕСТВА ВКОНТАКТЕ.
 *
 * Пять лет колл-центр отвечал участникам руками, и в этих диалогах лежит то,
 * чего нет ни в одном положении: как именно центр разговаривает с людьми. Какими
 * словами объясняют отказ, как просят уточнить конкурс, чем заканчивают разговор.
 * Бот, обученный на выдуманных примерах, звучит правильно, но чужим голосом.
 *
 * Здесь переписка выгружается целиком: каждый диалог, каждое сообщение, с
 * пометкой, кто писал — участник или центр. Дальше scripts/vk_style_learn.php
 * разбирает её и собирает из неё живые образцы ответов.
 *
 * Наружу ничего не уходит: только чтение messages.getConversations и
 * messages.getHistory. Токен сообщества с правом messages обязателен.
 *
 *   php scripts/vk_dialogs_export.php              — выгрузить всё (по умолчанию 600 диалогов)
 *   php scripts/vk_dialogs_export.php --limit=200  — ограничить число диалогов
 *   php scripts/vk_dialogs_export.php --out=/tmp/dlg.json
 */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { fwrite(STDERR, "CLI only\n"); exit(1); }

define('BASE_PATH', dirname(__DIR__));
$GLOBALS['CFG'] = require BASE_PATH . '/config.php';
require_once BASE_PATH . '/core/db.php';
require_once BASE_PATH . '/core/helpers.php';

$limit = 600;
$out   = BASE_PATH . '/data/vk_dialogs.json';
foreach ($argv as $a) {
    if (preg_match('~^--limit=(\d+)$~', $a, $m)) $limit = max(1, (int) $m[1]);
    if (preg_match('~^--out=(.+)$~', $a, $m))    $out   = $m[1];
}

$token = trim((string) cfgv('vk_token', ''));
$group = (int) cfgv('vk_group_id', 0);
if ($token === '' || $group <= 0) { fwrite(STDERR, "нет токена сообщества или vk_group_id\n"); exit(1); }

/** Вызов VK API. Пятая версия, свои ошибки не глотаем: без них выгрузка молча пуста. */
function vkx(string $method, array $params, string $token): array {
    $params['access_token'] = $token;
    $params['v'] = '5.199';
    $ch = curl_init('https://api.vk.com/method/' . $method);
    curl_setopt_array($ch, [
        CURLOPT_POST => 1, CURLOPT_RETURNTRANSFER => 1, CURLOPT_TIMEOUT => 40,
        CURLOPT_POSTFIELDS => http_build_query($params),
    ]);
    $raw = curl_exec($ch);
    curl_close($ch);
    $d = json_decode((string) $raw, true);
    if (!is_array($d)) return ['error' => ['error_msg' => 'нечитаемый ответ: ' . substr((string) $raw, 0, 200)]];
    return $d;
}

$line = str_repeat('=', 78);
echo "ПЕРЕПИСКА СООБЩЕСТВА ВКОНТАКТЕ\n$line\n";

/* ── 1. Список диалогов ── */
$peers = [];
for ($offset = 0; $offset < $limit; $offset += 200) {
    $r = vkx('messages.getConversations', ['count' => min(200, $limit - $offset), 'offset' => $offset,
                                           'group_id' => $group, 'extended' => 0], $token);
    if (isset($r['error'])) { fwrite(STDERR, 'ВК: ' . ($r['error']['error_msg'] ?? '?') . "\n"); break; }
    $items = $r['response']['items'] ?? [];
    if (!$items) break;
    foreach ($items as $it) {
        $p = (int) ($it['conversation']['peer']['id'] ?? 0);
        if ($p > 0) $peers[] = $p;
    }
    // Пауза между вызовами: у сообществ лимит три запроса в секунду.
    usleep(400000);
    if (count($items) < 200) break;
}
printf("  диалогов найдено: %d\n", count($peers));
if (!$peers) { echo "  выгружать нечего\n"; exit(0); }

/* ── 2. История каждого ── */
$dialogs = [];
$msgTotal = 0;
foreach ($peers as $i => $peer) {
    $msgs = [];
    for ($offset = 0; $offset < 200; $offset += 200) {
        $h = vkx('messages.getHistory', ['peer_id' => $peer, 'count' => 200, 'offset' => $offset,
                                         'group_id' => $group, 'rev' => 0], $token);
        if (isset($h['error'])) break;
        foreach ($h['response']['items'] ?? [] as $m) {
            $txt = trim((string) ($m['text'] ?? ''));
            if ($txt === '') continue;
            $msgs[] = [
                // Сообщение от сообщества: отрицательный from_id или флаг out.
                'who'  => ((int) ($m['from_id'] ?? 0) < 0 || (int) ($m['out'] ?? 0) === 1) ? 'центр' : 'участник',
                'date' => date('Y-m-d H:i:s', (int) ($m['date'] ?? 0)),
                'text' => $txt,
            ];
        }
        if (count($h['response']['items'] ?? []) < 200) break;
    }
    if ($msgs) {
        usort($msgs, static fn($a, $b) => strcmp((string) $a['date'], (string) $b['date']));
        $dialogs[] = ['peer' => $peer, 'messages' => $msgs];
        $msgTotal += count($msgs);
    }
    if (($i + 1) % 25 === 0) printf("  прочитано диалогов: %d, сообщений: %d\n", $i + 1, $msgTotal);
    usleep(400000);
}

@file_put_contents($out, json_encode($dialogs, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
printf("\n$line\n  диалогов: %d, сообщений: %d\n  сохранено: %s\n",
    count($dialogs), $msgTotal, $out);
