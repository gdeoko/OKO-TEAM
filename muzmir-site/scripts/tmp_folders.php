<?php
declare(strict_types=1);
define('BASE_PATH','/var/www/muzmir');
$GLOBALS['CFG']=require BASE_PATH.'/config.php';
require_once BASE_PATH.'/core/db.php'; require_once BASE_PATH.'/core/data.php';
require_once BASE_PATH.'/core/helpers.php';
require_once BASE_PATH.'/core/folder_pick.php'; require_once BASE_PATH.'/core/media_date.php';

$ids = [];
foreach (file(BASE_PATH.'/data/logs/regrade.log') ?: [] as $line) {
    if (str_contains($line, 'папк') && preg_match('~#(\d+)~', $line, $m)) $ids[(int)$m[1]] = 1;
}
$ids = array_keys($ids);
echo "папок в логе: ".count($ids)."\n\n";
foreach ($ids as $id) {
    $a = one("SELECT a.*, c.end_date ce FROM applications a LEFT JOIN competitions c ON c.id=a.competition_id WHERE a.id=?", [$id]);
    if (!$a) continue;
    $p = fp_pick((string)$a['video_url'], $a);
    $who = trim((string)($a['full_name'] ?: $a['group_name']));
    printf("#%d %s | «%s»\n", $id, mb_substr($who,0,32), mb_substr((string)$a['work_title'],0,26));
    printf("   файлов: %d | %s\n", (int)$p['files'], $p['ok'] ? 'ВЫБРАН: '.(string)$p['file']['name'] : 'ОТКАЗ: '.str_replace("\n",' ',mb_substr((string)$p['why'],0,110)));
    if ($p['ok']) {
        $d = media_dates((string)$a['video_url']);
        printf("   съёмка %s | загружен %s | %s\n",
            $d['shot']?date('d.m.Y',$d['shot']):'—', $d['uploaded']?date('d.m.Y',$d['uploaded']):'—', (string)$d['source']);
    }
}
