<?php
/**
 * ПРОВЕРКА ССЫЛОК — В ПИСЬМАХ, УВЕДОМЛЕНИЯХ И НА САЙТЕ.
 *
 * Битую ссылку в письме замечает получатель, а не мы: человек жмёт «подписаться»
 * и попадает на «страница не существует». Так и вышло с сообществом ВКонтакте —
 * в подсказках стоял адрес vk.com/muzmir_kc, которого нет, — и с МАКС, где код
 * приглашения потерялся и остался голый max.ru/join.
 *
 * Скрипт собирает внешние ссылки из кода и из настроек, ходит по каждой и
 * показывает, что она отдаёт. Ничего не меняет.
 *
 *   php scripts/audit_links.php
 */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { fwrite(STDERR, "CLI only\n"); exit(1); }

define('BASE_PATH', dirname(__DIR__));
$GLOBALS['CFG'] = require BASE_PATH . '/config.php';
require_once BASE_PATH . '/core/db.php';
require_once BASE_PATH . '/core/helpers.php';

/* ── Откуда берём ссылки ─────────────────────────────────────────────────── */

$links = [];   // url => [откуда, ...]

// 1. Настройки: то, что подставляется в письма и в подвал сайта.
foreach (['org_vk', 'org_max', 'org_tg_channel', 'vk_group_url', 'base_url'] as $k) {
    $v = trim((string) cfgv($k, ''));
    if ($v !== '' && preg_match('~^https?://~', $v)) $links[$v][] = 'config: ' . $k;
}

// 2. Код: шаблоны писем, уведомления, страницы сайта.
$dirs = ['core', 'cron', 'templates', 'public', 'admin', 'api'];
$rx = '~https?://(?:vk\.com|vk\.me|max\.ru|t\.me|telegram\.me|ok\.ru|rutube\.ru|youtube\.com|dzen\.ru)/[A-Za-z0-9_.@%/=+-]+~';
foreach ($dirs as $d) {
    $it = new RecursiveIteratorIterator(new RecursiveDirectoryIterator(BASE_PATH . '/' . $d));
    foreach ($it as $f) {
        if (!$f->isFile() || !preg_match('~\.(php|html|js)$~', $f->getFilename())) continue;
        $src = (string) file_get_contents($f->getPathname());
        if (!preg_match_all($rx, $src, $mm)) continue;
        foreach (array_unique($mm[0]) as $u) {
            $u = rtrim($u, '.,)"\'');
            // Примеры из комментариев и заглушки проверять незачем.
            if (preg_match('~/(xxx|example|wall-12345_678)~', $u)) continue;
            // Заготовка, а не ссылка: код приклеивает к ней номер видео
            // («https://rutube.ru/video/» . $id). Сама по себе она и должна
            // отдавать 404 — тревожиться тут не о чем.
            if (str_ends_with($u, '/') || preg_match('~/(embed|videoembed|video_ext\.php|share\.php|share/url|api/video)/?$~', $u)) continue;
            $links[$u][] = str_replace(BASE_PATH . '/', '', $f->getPathname());
        }
    }
}

if (!$links) { echo "ссылок не найдено\n"; exit(0); }

/* ── Ходим по ним ────────────────────────────────────────────────────────── */

echo "ПРОВЕРКА ССЫЛОК · " . count($links) . " шт.\n" . str_repeat('=', 78) . "\n\n";

$bad = 0;
$lastHost = '';
foreach ($links as $url => $where) {
    // ПАУЗА МЕЖДУ ЗАПРОСАМИ К ОДНОМУ САЙТУ. ВКонтакте рубит соединение, если
    // постучаться к нему десять раз подряд, и проверка сама себе устраивала
    // «ошибку связи»: девять живых ссылок на видео были объявлены битыми.
    // Тревога, поднятая собственной торопливостью, хуже отсутствия проверки.
    $host = (string) parse_url($url, PHP_URL_HOST);
    if ($host !== '' && $host === $lastHost) sleep(3);
    $lastHost = $host;

    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true, CURLOPT_NOBODY => false,
        // ПО РЕДИРЕКТАМ НЕ ХОДИМ. ВКонтакте отвечает на ссылку видео кодом 302 и
        // уводит на страницу входа; если пойти следом, он рвёт соединение на
        // втором-третьем запросе подряд, и живые ссылки объявляются битыми.
        // Нам довольно ответа самого сервера: 302 значит, что адрес существует.
        CURLOPT_FOLLOWLOCATION => false,
        CURLOPT_TIMEOUT => 20, CURLOPT_CONNECTTIMEOUT => 8, CURLOPT_SSL_VERIFYPEER => false,
        CURLOPT_USERAGENT => 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
        CURLOPT_HTTPHEADER => ['Accept-Language: ru-RU,ru;q=0.9', 'Accept: text/html,*/*;q=0.8'],
    ]);
    $body = (string) curl_exec($ch);
    $code = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    $err  = curl_error($ch);
    curl_close($ch);

    // ВКонтакте на несуществующее сообщество отвечает 200 и страницей с текстом
    // об ошибке — по коду ответа такую ссылку не поймать.
    $soft = $code === 200 && preg_match('~страница не найдена|страница удалена|page not found|такой страницы не~ui', $body);
    // Обрыв связи — тоже беда: значит по ссылке не пройти. Молча считать её
    // рабочей нельзя.
    $ok = $err === '' && $code >= 200 && $code < 400 && !$soft;
    if (!$ok) $bad++;

    printf("%s %-64s %s\n", $ok ? '[ok]' : '[!!]', mb_substr($url, 0, 62),
        $err !== '' ? 'ошибка связи' : ($soft ? '200, но страница не существует' : (string) $code));
    if (!$ok) foreach (array_unique($where) as $w) echo "       ← $w\n";
}

echo "\n" . str_repeat('=', 78) . "\n";
echo $bad === 0 ? "Все ссылки рабочие.\n" : "БИТЫХ ССЫЛОК: $bad — их видят получатели писем.\n";
