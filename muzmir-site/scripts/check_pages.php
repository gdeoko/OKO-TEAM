<?php
/**
 * ЦЕЛОСТНОСТЬ ПУБЛИЧНЫХ СТРАНИЦ: НИЧЕГО ЛИ НЕ ПРОПАЛО.
 *
 * После того как неполный запрос обнулил поля конкурса и афиша исчезла с трёх
 * страниц сразу, мало проверять коды ответа. Здесь смотрим на СОДЕРЖИМОЕ: у
 * каждого конкурса из базы должны быть афиша, описание, сроки приёма и положение,
 * и всё это должно реально попадать на главную, в календарь, в раздел конкурсов и
 * на собственную страницу конкурса.
 *
 *   php scripts/check_pages.php
 */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { fwrite(STDERR, "CLI only\n"); exit(1); }

define('BASE_PATH', dirname(__DIR__));
$GLOBALS['CFG'] = require BASE_PATH . '/config.php';
require_once BASE_PATH . '/core/db.php';
require_once BASE_PATH . '/core/helpers.php';

const PAGE_HOST = 'xn----7sbugdeiegh1b0a9hen.xn--p1ai';
$line = str_repeat('=', 78);
$fail = 0;

function page(string $path): array {
    $ch = curl_init('https://' . PAGE_HOST . $path);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true, CURLOPT_SSL_VERIFYPEER => false, CURLOPT_SSL_VERIFYHOST => 0,
        CURLOPT_RESOLVE => [PAGE_HOST . ':443:127.0.0.1'], CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_TIMEOUT => 30, CURLOPT_PROXY => '',
    ]);
    $b = (string) curl_exec($ch);
    $c = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    curl_close($ch);
    return ['code' => $c, 'body' => $b];
}

$chk = static function (string $what, bool $ok, string $info = '') use (&$fail): void {
    if (!$ok) $fail++;
    printf("  %s %-56s %s\n", $ok ? '✓' : '✗', mb_substr($what, 0, 56), $info);
};

/* ── 1. В базе у каждого конкурса заполнено то, без чего он не показывается ── */
echo "ПОЛЯ КОНКУРСОВ В БАЗЕ\n$line\n";
$comps = all("SELECT * FROM competitions ORDER BY sort, id");
foreach ($comps as $c) {
    $name = (string) $c['name'];
    foreach (['cover' => 'афиша', 'description' => 'описание', 'start_date' => 'начало приёма',
              'end_date' => 'конец приёма', 'slug' => 'адрес страницы',
              'regulation_pdf' => 'положение'] as $col => $ru) {
        $chk($name . ': ' . $ru, trim((string) ($c[$col] ?? '')) !== '',
            trim((string) ($c[$col] ?? '')) === '' ? 'ПУСТО' : '');
    }
    // Афиша должна не только числиться в базе, но и лежать на диске.
    $cover = trim((string) $c['cover']);
    if ($cover !== '') {
        $path = BASE_PATH . '/public/' . ltrim($cover, '/');
        $chk($name . ': файл афиши на диске', is_file($path), is_file($path) ? '' : $path);
    }
    // Дата итогов нужна длинному конкурсу: по ней открывается раздел результатов.
    if ((string) $c['results_mode'] === 'list') {
        $chk($name . ': дата итогов', trim((string) $c['results_date']) !== '');
    }
}

/* ── 2. Конкурс виден на всех страницах, где должен ───────────────────────── */
echo "\nКОНКУРСЫ НА СТРАНИЦАХ САЙТА\n$line\n";
$pages = ['/' => 'главная', '/competitions' => 'конкурсы', '/calendar' => 'календарь'];
$bodies = [];
foreach ($pages as $p => $ru) {
    $r = page($p);
    $bodies[$p] = $r['body'];
    $chk('страница «' . $ru . '» открывается', $r['code'] === 200, (string) $r['code']);
    $chk('страница «' . $ru . '» без PHP-ошибок',
        !preg_match('~Warning:|Fatal error|Undefined ~', $r['body']));
}
foreach ($comps as $c) {
    if ((string) $c['status'] !== 'open') continue;
    $cover = trim((string) $c['cover']);
    foreach ($pages as $p => $ru) {
        $chk((string) $c['name'] . ' есть на странице «' . $ru . '»',
            mb_strpos($bodies[$p], (string) $c['name']) !== false);
        if ($cover !== '') {
            $chk((string) $c['name'] . ': афиша на странице «' . $ru . '»',
                mb_strpos($bodies[$p], $cover) !== false);
        }
    }
}

/* ── 3. Собственная страница конкурса ─────────────────────────────────────── */
echo "\nСТРАНИЦЫ ОТДЕЛЬНЫХ КОНКУРСОВ\n$line\n";
foreach ($comps as $c) {
    $slug = trim((string) $c['slug']);
    if ($slug === '') continue;
    $r = page('/competition/' . $slug);
    $chk('/competition/' . $slug, $r['code'] === 200, (string) $r['code']);
    if ($r['code'] !== 200) continue;
    $chk($slug . ': название на странице', mb_strpos($r['body'], (string) $c['name']) !== false);
    $chk($slug . ': ссылка на положение',
        mb_strpos($r['body'], 'regulation') !== false || mb_strpos($r['body'], 'оложени') !== false);
    $chk($slug . ': нет PHP-ошибок', !preg_match('~Warning:|Fatal error|Undefined ~', $r['body']));
}

/* ── 4. Остальные публичные страницы ──────────────────────────────────────── */
echo "\nОСТАЛЬНЫЕ СТРАНИЦЫ\n$line\n";
$more = ['/apply' => 'подача заявки', '/results' => 'результаты', '/awards' => 'награды',
         '/order-awards' => 'заказ наград', '/contacts' => 'контакты', '/about' => 'о центре',
         '/documents' => 'документы', '/ministry-support' => 'письма поддержки', '/blog' => 'блог',
         '/login' => 'вход', '/register' => 'регистрация', '/verify' => 'проверка диплома'];
foreach ($more as $p => $ru) {
    $r = page($p);
    $chk('«' . $ru . '» (' . $p . ')', $r['code'] === 200 && mb_strlen($r['body']) > 2000,
        $r['code'] . ', ' . round(mb_strlen($r['body']) / 1024) . ' КБ');
    if ($r['code'] === 200) {
        $chk('«' . $ru . '» без PHP-ошибок',
            !preg_match('~Warning:|Fatal error|Undefined ~', $r['body']));
    }
}

echo "\n$line\n";
echo $fail === 0 ? "Все страницы на месте, ничего не пропало.\n" : "ПРОБЛЕМ: $fail\n";
exit($fail === 0 ? 0 : 1);
