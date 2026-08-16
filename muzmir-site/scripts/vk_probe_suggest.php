<?php
/**
 * РАЗВЕДКА: КУДА ВООБЩЕ МОЖНО ПОЛОЖИТЬ АНОНС.
 *
 * У сообщества ВКонтакте есть три двери. Открытая стена — пишем сами, публикация
 * появляется сразу. Предложенные новости — кладём запись в очередь, администратор
 * нажимает «опубликовать». Закрытая стена — только личное сообщение админу.
 *
 * Раньше мы смотрели только на первую дверь и получили 18 площадок на две с
 * половиной тысячи сообществ. Здесь проверяется вторая: у скольких сообществ
 * учреждений из нашей базы включены предложенные новости. Если их тысячи, канал
 * «предложка» больше всех остальных вместе взятых.
 *
 * Ничего не публикует и ничего не меняет: только считает.
 *
 *   php scripts/vk_probe_suggest.php            — проба на 400 сообществах учреждений
 *   php scripts/vk_probe_suggest.php 2000       — проба на другом объёме
 */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { fwrite(STDERR, "CLI only\n"); exit(1); }

define('BASE_PATH', dirname(__DIR__));
$GLOBALS['CFG'] = require BASE_PATH . '/config.php';
require_once BASE_PATH . '/core/db.php';
require_once BASE_PATH . '/core/helpers.php';
require_once BASE_PATH . '/core/vk.php';

$limit = (int) ($argv[1] ?? 400);
$line  = str_repeat('=', 78);

echo "РАЗВЕДКА ДВЕРЕЙ ВКОНТАКТЕ\n$line\n";

$ids = array_map('intval', array_column(
    all("SELECT vk_id FROM institutions WHERE vk_id<>0 ORDER BY RANDOM() LIMIT :l", ['l' => $limit]), 'vk_id'));
echo '  выборка сообществ учреждений: ' . count($ids) . "\n\n";

$stat = ['всего' => 0, 'открытая стена' => 0, 'предложка' => 0, 'закрыто' => 0, 'мертво' => 0];
$examples = [];
$members = ['открытая стена' => 0, 'предложка' => 0];

foreach (array_chunk($ids, 300) as $chunk) {
    $r = vk_api('groups.getById', [
        'group_ids' => implode(',', $chunk),
        'fields'    => 'members_count,wall,can_post,can_suggest,activity,is_closed',
    ]);
    if (isset($r['error'])) {
        echo '  ошибка пакета: ' . (string) ($r['error']['error_msg'] ?? '?') . "\n";
        usleep(400000);
        continue;
    }
    $groups = $r['response']['groups'] ?? $r['response'] ?? [];
    foreach ($groups as $g) {
        $stat['всего']++;
        $m       = (int) ($g['members_count'] ?? 0);
        $canPost = (int) ($g['can_post'] ?? 0);
        $canSugg = (int) ($g['can_suggest'] ?? 0);
        $wall    = (int) ($g['wall'] ?? 0);
        if ($canPost === 1)      { $stat['открытая стена']++; $members['открытая стена'] += $m; }
        elseif ($canSugg === 1)  { $stat['предложка']++;      $members['предложка'] += $m;
                                   if (count($examples) < 10) $examples[] = $g; }
        elseif ($wall === 0)     { $stat['мертво']++; }
        else                     { $stat['закрыто']++; }
    }
    usleep(400000);
}

foreach ($stat as $k => $v) {
    printf("  %-16s %5d  %5.1f%%\n", $k, $v, $stat['всего'] ? $v * 100 / $stat['всего'] : 0);
}
echo "\n  аудитория сообществ с открытой стеной: " . number_format($members['открытая стена'], 0, '.', ' ') . "\n";
echo "  аудитория сообществ с предложкой:      " . number_format($members['предложка'], 0, '.', ' ') . "\n";

if ($examples) {
    echo "\nПРИМЕРЫ С ПРЕДЛОЖКОЙ\n$line\n";
    foreach ($examples as $g) {
        printf("  %7s  %-46s vk.com/%s\n", number_format((int) ($g['members_count'] ?? 0), 0, '.', ' '),
            mb_substr((string) ($g['name'] ?? ''), 0, 46), (string) ($g['screen_name'] ?? ''));
    }
}

/* Пересчёт на всю базу — прикидка, а не обещание. */
$total = (int) (scalar("SELECT COUNT(*) FROM institutions WHERE vk_id<>0") ?? 0);
if ($stat['всего'] > 0) {
    echo "\nЧТО ЭТО ЗНАЧИТ НА ВСЕЙ БАЗЕ ($total сообществ учреждений)\n$line\n";
    printf("  открытых стен ожидается:  ~%d\n", (int) round($total * $stat['открытая стена'] / $stat['всего']));
    printf("  предложек ожидается:      ~%d\n", (int) round($total * $stat['предложка'] / $stat['всего']));
}
