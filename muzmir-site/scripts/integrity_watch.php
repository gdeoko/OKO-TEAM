<?php
/**
 * СТОРОЖ ФАЙЛОВ САЙТА: ЧТО ИЗМЕНИЛОСЬ НА СЕРВЕРЕ МИМО РЕПОЗИТОРИЯ.
 *
 * Зачем. 20 октября сверка показала, что сайт и репозиторий разошлись на 112
 * файлов, а ещё 50 жили только на сервере: месяц работы правился прямо на
 * проде и в git не попадал. Это не ошибка чья-то — так просто удобнее в
 * спешке. Но пока расхождение копится молча, у центра нет ни истории правок,
 * ни возможности откатиться, а следующий деплой затирает чужую работу
 * (за один день 20 октября это чуть не случилось трижды).
 *
 * Как устроено. Рядом с сайтом лежит снимок контрольных сумм — слепок того
 * состояния, которое считается выложенным и сохранённым в репозитории. Раз в
 * сутки сторож пересчитывает суммы и сравнивает со слепком. Всё, что
 * изменилось, добавилось или пропало, уходит владельцу в Telegram.
 *
 * ПОЧЕМУ НЕ СВЕРЯЕМСЯ С GITHUB НАПРЯМУЮ. Для этого на боевом сервере пришлось
 * бы держать токен доступа к приватному репозиторию — лишний ключ на машине,
 * где лежат персональные данные участников. Слепок решает ту же задачу и
 * ничего наружу не открывает.
 *
 * Команды:
 *   php scripts/integrity_watch.php            проверить и уведомить (крон)
 *   php scripts/integrity_watch.php --dry      показать расхождения, не слать
 *   php scripts/integrity_watch.php --accept   принять текущее состояние за эталон
 *
 * --accept выполняется ПОСЛЕ того, как изменения перенесены в репозиторий:
 * этим мы говорим сторожу «теперь так и должно быть».
 */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { fwrite(STDERR, "CLI only\n"); exit(1); }

define('BASE_PATH', dirname(__DIR__));
$GLOBALS['CFG'] = require BASE_PATH . '/config.php';
require_once BASE_PATH . '/core/db.php';
require_once BASE_PATH . '/core/helpers.php';

$dry    = in_array('--dry', $argv, true);
$accept = in_array('--accept', $argv, true);

const IW_DIR  = BASE_PATH . '/data/integrity';
const IW_FILE = IW_DIR . '/manifest.txt';
const IW_LAST = IW_DIR . '/last_report.txt';

/* ЧТО СЧИТАЕМ СВОИМ КОДОМ.
 *
 * Только то, что лежит в репозитории: код, шаблоны, стили. Данные, загрузки
 * участников, резервные копии, журналы и временные файлы меняются каждую
 * минуту по делу — сторож, который кричит на них, через день перестаёт
 * читаться. Ключи (config.local.php) в репозитории не хранятся и здесь тоже
 * не проверяются: иначе смена пароля выглядела бы как подмена файла. */
function iw_scan(): array {
    $out = [];
    $skipDirs = ['/data/', '/public/uploads/', '/vendor/', '/node_modules/', '/.git/', '/tmp/'];
    // .txt здесь не мелочь: в scripts/crontab.txt лежит эталон расписания,
    // по которому крон восстанавливают после переустановки сервера.
    $exts = ['php' => 1, 'js' => 1, 'css' => 1, 'json' => 1, 'md' => 1, 'sql' => 1, 'txt' => 1];
    $it = new RecursiveIteratorIterator(
        new RecursiveDirectoryIterator(BASE_PATH, FilesystemIterator::SKIP_DOTS),
        RecursiveIteratorIterator::SELF_FIRST
    );
    foreach ($it as $f) {
        if (!$f->isFile()) continue;
        $path = (string) $f->getPathname();
        $rel  = ltrim(str_replace(BASE_PATH, '', $path), '/');
        $test = '/' . $rel;
        foreach ($skipDirs as $d) if (str_starts_with($test, $d)) continue 2;
        $base = basename($rel);
        if ($base === 'config.local.php') continue;
        if (str_contains($base, '.bak')) continue;
        if (str_ends_with($base, '~')) continue;
        $ext = strtolower((string) pathinfo($rel, PATHINFO_EXTENSION));
        if (!isset($exts[$ext])) continue;
        $md5 = @md5_file($path);
        if ($md5 !== false) $out[$rel] = $md5;
    }
    ksort($out);
    return $out;
}

function iw_load(): array {
    if (!is_file(IW_FILE)) return [];
    $out = [];
    foreach (file(IW_FILE, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) ?: [] as $line) {
        [$h, $f] = array_pad(explode('  ', $line, 2), 2, '');
        if ($f !== '') $out[trim($f)] = trim($h);
    }
    return $out;
}

function iw_save(array $map): void {
    if (!is_dir(IW_DIR)) @mkdir(IW_DIR, 0775, true);
    $lines = [];
    foreach ($map as $f => $h) $lines[] = $h . '  ' . $f;
    @file_put_contents(IW_FILE, implode("\n", $lines) . "\n");
}

$now  = iw_scan();
$base = iw_load();

if (!$base) {
    iw_save($now);
    echo "Эталон создан: " . count($now) . " файлов. Дальше сторож сравнивает с ним.\n";
    exit(0);
}

if ($accept) {
    iw_save($now);
    @unlink(IW_LAST);
    echo "Эталон обновлён: " . count($now) . " файлов.\n";
    exit(0);
}

$changed = [];
foreach ($now as $f => $h) {
    if (!isset($base[$f]))      { $changed[] = ['новый', $f]; continue; }
    if ($base[$f] !== $h)       { $changed[] = ['изменён', $f]; }
}
foreach ($base as $f => $h) if (!isset($now[$f])) $changed[] = ['удалён', $f];

if (!$changed) {
    @unlink(IW_LAST);
    echo "Сайт совпадает с эталоном: " . count($now) . " файлов.\n";
    exit(0);
}

usort($changed, static fn(array $a, array $b): int => [$a[0], $a[1]] <=> [$b[0], $b[1]]);

$lines = [];
foreach ($changed as [$kind, $f]) {
    $when = '';
    $full = BASE_PATH . '/' . $f;
    if (is_file($full)) { $t = @filemtime($full); if ($t) $when = ' (' . date('d.m H:i', $t) . ')'; }
    $lines[] = $kind . ': ' . $f . $when;
}
$report = implode("\n", $lines);

echo "Расхождений с эталоном: " . count($changed) . "\n" . $report . "\n";
if ($dry) exit(0);

/* ОДНО И ТО ЖЕ РАСХОЖДЕНИЕ НЕ ПОВТОРЯЕМ КАЖДЫЙ ДЕНЬ.
 *
 * Пока правки не перенесены в репозиторий, список остаётся прежним, и
 * ежедневное одинаковое сообщение быстро станет шумом, который перестают
 * открывать. Шлём, когда список изменился — то есть появилось что-то новое. */
$fingerprint = md5($report);
$prev = is_file(IW_LAST) ? trim((string) @file_get_contents(IW_LAST)) : '';
if ($prev === $fingerprint) {
    echo "Список тот же, что вчера, — не повторяю уведомление.\n";
    exit(0);
}

if (!function_exists('owner_notify') && is_file(BASE_PATH . '/core/notify_owner.php')) {
    require_once BASE_PATH . '/core/notify_owner.php';
}
if (function_exists('owner_notify')) {
    $short = count($changed) > 25
        ? implode("\n", array_slice($lines, 0, 25)) . "\n… и ещё " . (count($changed) - 25)
        : $report;
    owner_notify('АНАЛИТИКА', 'Сайт и репозиторий разошлись',
        "На сервере изменились файлы, которых нет в таком виде в репозитории:\n\n" . $short
        . "\n\nЕсли правки нужные — перенесите их в репозиторий и выполните:\n"
        . "php scripts/integrity_watch.php --accept",
        [
            'Файлов' => (string) count($changed),
            'Сервер' => (string) (function_exists('cfgv') ? (cfgv('domain') ?: 'muzmir') : 'muzmir'),
            '_event' => 'integrity_drift',
        ]);
    echo "Уведомление отправлено владельцу.\n";
} else {
    echo "owner_notify недоступен — уведомление не отправлено.\n";
}
@file_put_contents(IW_LAST, $fingerprint);
