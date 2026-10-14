<?php
/**
 * V.LIONOFF · быстрая проверка живого приложения.
 *
 *   php tools/smoke.php                       # проверить локальный dev-сервер
 *   php tools/smoke.php https://okoteam.top/vlionoff/
 *
 * Проверяет то, что ломается чаще всего: отвечает ли API, есть ли курсы и
 * уроки, открывается ли бесплатный урок, считается ли тест, живы ли картинки.
 */
declare(strict_types=1);

$база = rtrim($argv[1] ?? 'http://127.0.0.1:8099/', '/') . '/';
$api = $база . 'api/index.php?r=';
$ок = 0; $нет = 0;

function дай(string $url, array $тело = null, string $токен = '') {
  $ctx = ['http' => ['timeout' => 25, 'ignore_errors' => true,
                     'header' => "Content-Type: application/json\r\n"
                               . ($токен ? "Authorization: Bearer $токен\r\n" : '')]];
  if ($тело !== null) {
    $ctx['http']['method'] = 'POST';
    $ctx['http']['content'] = json_encode($тело, JSON_UNESCAPED_UNICODE);
  }
  $сырое = @file_get_contents($url, false, stream_context_create($ctx));
  return $сырое === false ? null : json_decode($сырое, true);
}

function проверка(string $что, $условие, string $подробно = ''): void {
  global $ок, $нет;
  if ($условие) { $ок++; printf("  ок   %s%s\n", $что, $подробно ? " ($подробно)" : ''); }
  else { $нет++; printf("  НЕТ  %s%s\n", $что, $подробно ? " ($подробно)" : ''); }
}

echo "проверка: $база\n";

$home = дай($api . 'home');
проверка('главная отвечает', $home && !empty($home['ok']));
проверка('курсы заведены', $home && count($home['courses'] ?? []) >= 2,
         $home ? count($home['courses'] ?? []) . ' шт' : '');
проверка('уроки загружены', ($home['stats']['lessons'] ?? 0) >= 20,
         ($home['stats']['lessons'] ?? 0) . ' шт');

$курс = дай($api . 'course&slug=creator');
проверка('курс «Контент-креатор» открывается', $курс && !empty($курс['ok']));
проверка('блоки на месте', count($курс['blocks'] ?? []) === 5,
         count($курс['blocks'] ?? []) . ' блоков');
$свободные = 0;
foreach (($курс['blocks'] ?? []) as $b) {
  foreach ($b['lessons'] as $l) { if (!empty($l['free'])) { $свободные++; } }
}
проверка('есть бесплатные уроки', $свободные >= 4, $свободные . ' шт');
проверка('обложки блоков заданы',
  count(array_filter($курс['blocks'] ?? [], fn($b) => !empty($b['cover']))) === 5);

$первый = $курс['blocks'][0]['lessons'][0]['id'] ?? 0;
$урок = дай($api . 'lesson&id=' . $первый);
проверка('бесплатный урок открывается без входа', $урок && empty($урок['locked']));
проверка('в уроке есть слайды', count($урок['lesson']['slides'] ?? []) >= 4,
         count($урок['lesson']['slides'] ?? []) . ' слайдов');
проверка('в уроке есть тест', count($урок['lesson']['quiz'] ?? []) >= 4,
         count($урок['lesson']['quiz'] ?? []) . ' вопросов');
проверка('конспект не пустой', mb_strlen($урок['lesson']['notes'] ?? '') > 200);

// Платный урок закрыт для гостя.
$платный = 0;
foreach (($курс['blocks'][2]['lessons'] ?? []) as $l) { if (empty($l['free'])) { $платный = $l['id']; break; } }
$закрытый = $платный ? дай($api . 'lesson&id=' . $платный) : null;
проверка('платный урок закрыт для гостя', $закрытый && !empty($закрытый['locked']));

// Картинки.
foreach (['assets/img/logo.png', 'assets/img/course-creator.jpg',
          'assets/img/block-b1.jpg', 'assets/app.css', 'assets/app.js'] as $файл) {
  $h = @get_headers($база . $файл);
  проверка('файл ' . $файл, $h && strpos($h[0], '200') !== false);
}

// Админка закрыта без пароля.
$админ = дай($api . 'admin/stats');
проверка('админка закрыта без пароля', $админ && empty($админ['ok']));

printf("\nитого: %d ок, %d не прошло\n", $ок, $нет);
exit($нет === 0 ? 0 : 1);
