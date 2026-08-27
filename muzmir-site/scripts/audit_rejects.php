<?php
/**
 * ПЕРЕПРОВЕРКА ВСЕХ ОСНОВАНИЙ ДЛЯ ОТКАЗА — ПЕРЕД ТЕМ, КАК ИХ ПРИМЕНЯТЬ.
 *
 * Отказ снимает человека с конкурса, и ошибка здесь дороже любой другой. Все
 * подсказки об отказе проверяются заново и по первоисточнику: дата съёмки
 * спрашивается у площадки прямо сейчас, ссылка открывается прямо сейчас. Если
 * основание не подтверждается, это видно в отчёте.
 *
 * Проверяется каждая заявка, у которой разбор дал «ТРЕБУЕТ ПРОВЕРКИ».
 */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { fwrite(STDERR, "CLI only\n"); exit(1); }

define('BASE_PATH', dirname(__DIR__));
$GLOBALS['CFG'] = require BASE_PATH . '/config.php';
require_once BASE_PATH . '/core/db.php';
require_once BASE_PATH . '/core/data.php';
require_once BASE_PATH . '/core/helpers.php';
require_once BASE_PATH . '/core/media_date.php';
require_once BASE_PATH . '/core/link_check.php';
require_once BASE_PATH . '/core/folder_pick.php';

$rows = all("SELECT a.*, c.end_date AS comp_end, c.name AS comp,
                    r.reject_hint, r.internal_note, r.id AS run_id
               FROM applications a
               JOIN competitions c ON c.id = a.competition_id
               JOIN grading_runs r ON r.id = (SELECT MAX(r2.id) FROM grading_runs r2
                                               WHERE r2.application_id = a.id AND r2.status='ok')
              WHERE COALESCE(a.result,'') = '' AND a.status NOT IN ('rejected','draft')
                AND r.title = 'ТРЕБУЕТ ПРОВЕРКИ'
           ORDER BY a.id");

echo 'оснований к проверке: ' . count($rows) . "\n\n";
$ok = 0; $doubt = 0;

foreach ($rows as $a) {
    $id  = (int) $a['id'];
    $who = mb_substr(trim((string) ($a['full_name'] ?: $a['group_name'])), 0, 30);
    $hint = str_replace("\n", ' ', (string) $a['reject_hint']);
    $url  = (string) $a['video_url'];

    // Ссылка — открывается ли прямо сейчас.
    $v = video_verify($url, (string) $a['nomination']);
    $живая = !empty($v['ok']);

    // Дата — спрашиваем площадку заново.
    $d = media_dates($url);
    $t = media_too_old($url, '', (string) $a['comp_end']);
    $limit = date('d.m.Y', (int) strtotime('-1 year', (int) strtotime((string) $a['comp_end'])));

    $вывод = '';
    if (str_contains($hint, 'старше 1 года')) {
        if ($t['old']) {
            $вывод = 'ПОДТВЕРЖДЕНО: ' . (string) $t['note'] . '; допустимо не раньше ' . $limit;
            $ok++;
        } else {
            /* ОБЛАКО — НЕ ЕДИНСТВЕННЫЙ ИСТОЧНИК.
             *
             * Основание могло быть поставлено по метке внутри самой записи
             * (creation_time контейнера, EXIF снимка), а её видно только в
             * скачанном файле. Проверка по одному облаку тогда говорит «не
             * подтвердилось» там, где дата на самом деле есть. Раз речь об
             * отказе — скачиваем и смотрим первоисточник. */
            require_once BASE_PATH . '/core/video_fetch.php';
            $dl = vf_download($url, $id);
            $изФайла = null;
            if (!empty($dl['ok'])) {
                $f = media_file_shot_date((string) $dl['path']);
                $изФайла = $f['ts'];
                $t2 = media_too_old($url, (string) $dl['path'], (string) $a['comp_end']);
                vf_cleanup((string) $dl['path']);
                if ($t2['old']) {
                    $вывод = 'ПОДТВЕРЖДЕНО по файлу: ' . (string) $t2['note'] . '; допустимо не раньше ' . $limit;
                    $ok++;
                } else {
                    $вывод = '!!! НЕ ПОДТВЕРДИЛОСЬ: ' . ((string) $t2['note'] !== '' ? (string) $t2['note'] : 'даты нет ни в облаке, ни в файле');
                    $doubt++;
                }
            } else {
                $вывод = '!!! НЕ ПРОВЕРИТЬ: запись не скачалась (' . mb_substr((string) $dl['why'], 0, 60) . ')';
                $doubt++;
            }
        }
    } elseif (str_contains($hint, 'недействительна') || str_contains($hint, 'Отказа нет')) {
        $вывод = $живая ? '!!! ССЫЛКА ОТКРЫВАЕТСЯ: ' . (string) ($v['reason'] ?? '')
                        : 'ПОДТВЕРЖДЕНО: ' . (string) ($v['reason'] ?? 'не открывается');
        $живая ? $doubt++ : $ok++;
    } else {
        $вывод = 'проверить глазами: ' . mb_substr($hint, 0, 70);
        $doubt++;
    }

    printf("#%d %s | %s\n   основание: %s\n   проверка:  %s\n",
        $id, (string) $a['number'], $who, mb_substr($hint, 0, 78), $вывод);
}
echo "\nподтвердилось: $ok, требует внимания: $doubt\n";
