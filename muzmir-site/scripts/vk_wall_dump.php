<?php
/**
 * ЧТО У НАС САМИХ ВИСИТ НА СТЕНЕ.
 *
 * Показывает записи сообщества центра: текст целиком, вложения, дату, охват.
 * Нужен, чтобы брать наши же посты запуска и разносить их по чужим площадкам
 * один в один, а не пересказывать своими словами.
 *
 *   php scripts/vk_wall_dump.php            — последние 20 записей
 *   php scripts/vk_wall_dump.php 40         — сколько нужно
 *   php scripts/vk_wall_dump.php 40 --full  — с полным текстом каждой
 */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { fwrite(STDERR, "CLI only\n"); exit(1); }

define('BASE_PATH', dirname(__DIR__));
$GLOBALS['CFG'] = require BASE_PATH . '/config.php';
require_once BASE_PATH . '/core/db.php';
require_once BASE_PATH . '/core/helpers.php';
require_once BASE_PATH . '/core/vk.php';

$n    = max(1, (int) ($argv[1] ?? 20));
$full = in_array('--full', $argv, true);
$gid  = (int) cfgv('vk_group_id', 211325055);
$line = str_repeat('=', 78);

$r = vk_api('wall.get', ['owner_id' => -$gid, 'count' => $n, 'extended' => 0]);
if (isset($r['error'])) { echo 'ошибка: ' . (string) ($r['error']['error_msg'] ?? '?') . "\n"; exit(1); }

$items = $r['response']['items'] ?? [];
printf("СТЕНА СООБЩЕСТВА (всего записей %d, показываю %d)\n%s\n",
    (int) ($r['response']['count'] ?? 0), count($items), $line);

foreach ($items as $p) {
    $id   = (int) ($p['id'] ?? 0);
    $date = date('d.m.Y H:i', (int) ($p['date'] ?? 0));
    $txt  = (string) ($p['text'] ?? '');
    $atts = [];
    foreach (($p['attachments'] ?? []) as $a) {
        $t = (string) ($a['type'] ?? '');
        if ($t === 'photo') {
            $ph = $a['photo'] ?? [];
            $atts[] = 'photo' . (int) ($ph['owner_id'] ?? 0) . '_' . (int) ($ph['id'] ?? 0);
        } else {
            $atts[] = $t;
        }
    }
    printf("\n#%d  %s  просмотров %d  лайков %d  репостов %d%s\n",
        $id, $date, (int) ($p['views']['count'] ?? 0), (int) ($p['likes']['count'] ?? 0),
        (int) ($p['reposts']['count'] ?? 0), ($p['is_pinned'] ?? 0) ? '  ЗАКРЕП' : '');
    if ($atts) echo '  вложения: ' . implode(' ', $atts) . "\n";
    echo '  ' . str_replace("\n", "\n  ", $full ? $txt : mb_substr($txt, 0, 260)) . "\n";
}
