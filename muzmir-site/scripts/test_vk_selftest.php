<?php
/**
 * ТЕСТ ВК-ПУБЛИКАЦИЙ «САМОМУ СЕБЕ». Собирает РЕАЛЬНЫЕ тексты и афиши всех волн
 * запуска (открытие, 3 дня, последний день, приём закрыт, результаты) и отправляет
 * их в «Избранное» ВК — сообщение самому себе. Реальное сообщество НЕ трогается,
 * подписчики ничего не видят, стена не публикуется.
 *
 *   php scripts/test_vk_selftest.php            — все волны
 *   php scripts/test_vk_selftest.php launch,d3  — только выбранные
 */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { fwrite(STDERR, "CLI only\n"); exit(1); }

define('BASE_PATH', dirname(__DIR__));
$GLOBALS['CFG'] = require BASE_PATH . '/config.php';
require_once BASE_PATH . '/core/db.php';
require_once BASE_PATH . '/core/helpers.php';
require_once BASE_PATH . '/core/launch_run.php';
require_once BASE_PATH . '/core/launch_poster.php';
db();

$TOKEN = (string) cfgv('vk_token', '');
$V     = (string) cfgv('vk_api_version', '5.199');
if ($TOKEN === '') { fwrite(STDERR, "нет vk_token\n"); exit(1); }

/** Вызов VK API. */
function vk(string $method, array $params, string $token, string $v): array {
    $params['access_token'] = $token;
    $params['v'] = $v;
    $ctx = stream_context_create(['http' => [
        'method' => 'POST', 'timeout' => 40,
        'header' => "Content-Type: application/x-www-form-urlencoded\r\n",
        'content' => http_build_query($params),
    ]]);
    $raw = @file_get_contents('https://api.vk.com/method/' . $method, false, $ctx);
    $j = json_decode((string) $raw, true);
    return is_array($j) ? $j : ['error' => ['error_msg' => 'нет ответа: ' . substr((string) $raw, 0, 200)]];
}

// Кому шлём: самому себе (владелец токена) — это и есть «Избранное».
$me = vk('users.get', [], $TOKEN, $V);
$peer = (int) ($me['response'][0]['id'] ?? 0);
if ($peer <= 0) { fwrite(STDERR, "не удалось определить себя: " . json_encode($me, 256) . "\n"); exit(1); }
printf("Отправляю в Избранное ВК: %s %s (id=%d)\n\n",
       (string) ($me['response'][0]['first_name'] ?? ''), (string) ($me['response'][0]['last_name'] ?? ''), $peer);

/**
 * Загрузка картинки как вложения В СООБЩЕНИЕ (не на стену сообщества).
 * Повторяем до трёх раз, как и боевой core/vk.php: ВК ограничивает частоту
 * запросов, и без повторов часть афиш терялась.
 */
function vk_upload_photo_for_message(string $path, int $peer, string $token, string $v): string {
    if ($path === '' || !is_file($path)) return '';
    for ($try = 1; $try <= 3; $try++) {
        $srv = vk('photos.getMessagesUploadServer', ['peer_id' => $peer], $token, $v);
        $url = (string) ($srv['response']['upload_url'] ?? '');
        if ($url !== '') {
            $cf = curl_init($url);
            curl_setopt_array($cf, [
                CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 90, CURLOPT_POST => true,
                CURLOPT_POSTFIELDS => ['photo' => new CURLFile($path)],
            ]);
            $up = json_decode((string) curl_exec($cf), true);
            curl_close($cf);
            if (is_array($up) && !empty($up['photo'])) {
                $save = vk('photos.saveMessagesPhoto', [
                    'photo' => (string) $up['photo'], 'server' => (string) ($up['server'] ?? ''),
                    'hash' => (string) ($up['hash'] ?? ''),
                ], $token, $v);
                $ph = $save['response'][0] ?? null;
                if ($ph) return 'photo' . (int) $ph['owner_id'] . '_' . (int) $ph['id'];
            }
        }
        if ($try < 3) usleep(700000 * $try);
    }
    return '';
}

$want = array_values(array_filter(array_map('trim', explode(',', (string) ($argv[1] ?? '')))));
$waves = launch_waves();
if ($want) $waves = array_intersect_key($waves, array_flip($want));

$comps = launch_open_comps();
if (!$comps) { fwrite(STDERR, "нет открытых конкурсов\n"); exit(1); }
printf("Конкурсов в работе: %d — %s\n\n", count($comps),
       implode(', ', array_map(fn($c) => (string) $c['name'], $comps)));

$sent = 0; $fail = 0;
foreach ($waves as $wave => $title) {
    // Сводные волны (3 дня / последний день / закрыт) — один пост на все конкурсы.
    $targets = in_array($wave, ['d3', 'last', 'closed'], true) ? [$comps[0]] : $comps;
    foreach ($targets as $c) {
        $text  = launch_wave_text($c, $wave, $comps);
        $cover = launch_cover_path($c, $wave, $comps);
        $label = '[ТЕСТ · ' . $title . ($targets === $comps ? ' · ' . (string) $c['name'] : '') . "]\n\n";

        $att = $cover !== '' ? vk_upload_photo_for_message($cover, $peer, $TOKEN, $V) : '';
        $res = vk('messages.send', array_filter([
            'peer_id'  => $peer,
            'random_id' => random_int(1, PHP_INT_MAX),
            'message'  => mb_substr($label . $text, 0, 4000),
            'attachment' => $att,
        ]), $TOKEN, $V);

        $okSend = isset($res['response']);
        $okSend ? $sent++ : $fail++;
        printf("%-9s %-22s текст %4d симв.  афиша %-28s %s\n",
            $wave,
            mb_substr((string) $c['name'], 0, 22),
            mb_strlen($text),
            $cover !== '' ? basename($cover) . ($att !== '' ? ' ✓' : ' (не загрузилась)') : 'нет',
            $okSend ? 'отправлено' : ('ОШИБКА: ' . (string) ($res['error']['error_msg'] ?? '?'))
        );
        if ($cover !== '') {
            $sz = @getimagesize($cover);
            if ($sz) printf("          афиша %dx%d, %s\n", $sz[0], $sz[1],
                            $sz[0] >= $sz[1] ? 'горизонтальная — верно' : 'ВЕРТИКАЛЬНАЯ — проверить!');
        }
        sleep(1);
    }
}

printf("\nИтого: отправлено %d, ошибок %d. Всё ушло в Избранное — сообщество не затронуто.\n", $sent, $fail);
exit($fail === 0 ? 0 : 1);
