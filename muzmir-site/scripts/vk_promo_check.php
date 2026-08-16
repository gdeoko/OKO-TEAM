<?php
/**
 * ЧТО ИМЕННО УВИДЕЛИ В СООБЩЕСТВАХ.
 *
 * Берёт последние выпущенные записи и показывает их состояние глазами ВКонтакте:
 * тип (обычная запись или предложенная), есть ли афиша, ссылка на запись. Нужно,
 * чтобы не гадать, дошёл ли анонс и как он выглядит.
 *
 *   php scripts/vk_promo_check.php        — последние 10
 *   php scripts/vk_promo_check.php 30     — сколько нужно
 */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { fwrite(STDERR, "CLI only\n"); exit(1); }

define('BASE_PATH', dirname(__DIR__));
$GLOBALS['CFG'] = require BASE_PATH . '/config.php';
require_once BASE_PATH . '/core/db.php';
require_once BASE_PATH . '/core/helpers.php';
require_once BASE_PATH . '/core/vk_promo.php';

$n    = max(1, (int) ($argv[1] ?? 10));
$line = str_repeat('=', 78);
vkp_ensure();

$rows = all("SELECT l.*, t.name, t.screen_name, t.members FROM vk_promo_log l
             LEFT JOIN vk_targets t ON t.group_id = l.group_id
             WHERE l.outcome<>'error' AND l.post_id<>0
             ORDER BY l.id DESC LIMIT :l", ['l' => $n]);

echo "ПОСЛЕДНИЕ ВЫПУЩЕННЫЕ ЗАПИСИ\n$line\n";
foreach ($rows as $r) {
    $gid = (int) $r['group_id'];
    $pid = (int) $r['post_id'];
    $res = vk_api('wall.getById', ['posts' => (-$gid) . '_' . $pid, 'extended' => 0]);
    $it  = ($res['response']['items'] ?? $res['response'] ?? [])[0] ?? null;

    if (!$it) {
        printf("  снято или недоступно   vk.com/wall-%d_%d  %s\n", $gid, $pid, (string) $r['name']);
    } else {
        $type  = (string) ($it['post_type'] ?? '?');
        $att   = count($it['attachments'] ?? []);
        $views = (int) ($it['views']['count'] ?? 0);
        printf("  %-10s афиш:%d  просмотров:%-5d vk.com/wall-%d_%d  %s (%s чел.)\n",
            $type === 'suggest' ? 'предложка' : 'на стене', $att, $views, $gid, $pid,
            mb_substr((string) $r['name'], 0, 38), number_format((int) $r['members'], 0, '.', ' '));
    }
    usleep(350000);
}
