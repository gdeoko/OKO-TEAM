<?php
/**
 * ПЕРЕСМОТР ВСЕЙ ОЧЕРЕДИ ПО ОБНОВЛЁННЫМ ПРАВИЛАМ.
 *
 * Разборы, лежащие в очереди, сделаны прежним заданием: в нём не было ни раздела
 * 8 положения целиком, ни проверки возраста материала, ни требования видеть руки,
 * ноги и лицо исполнителя, ни разбора собственных ошибок на правках жюри. Из-за
 * этого работа с записью двухлетней давности получала звание, а работа, снятая
 * со спины, оценивалась как обычная.
 *
 * Здесь очередь пересматривается заново — с нуля, включая те заявки, у которых
 * разбор уже есть. Прежний разбор не удаляется: он остаётся в grading_runs, и
 * при желании видно, что изменилось.
 *
 * ЧЕГО ТУТ НАМЕРЕННО НЕ ПРОИСХОДИТ:
 *   • оценённые работы не трогаются. Звание присвоено, диплом отправлен, и
 *     пересматривать его задним числом нельзя — даже если ссылка с тех пор
 *     перестала открываться (таких сейчас восемнадцать);
 *   • ничего не применяется автоматически. Скрипт только готовит разбор; итог
 *     ставит человек в админке или задание cron/ai_grade.php в режиме auto;
 *   • отклонённые заявки не пересматриваются: решение принято человеком.
 *
 * ТЕМП. Разбор идёт через браузер агента на мосту, а он один: замок внутри
 * ag_ask_bridge выстраивает очередь сам. Поэтому скрипт работает последовательно
 * и не боится, что рядом идёт обучение на расхождениях.
 *
 *   php scripts/regrade_all.php               — вся очередь
 *   php scripts/regrade_all.php --limit=20
 *   php scripts/regrade_all.php --comp=7      — только этот конкурс
 *   php scripts/regrade_all.php --only-new    — пропустить те, у кого разбор уже есть
 *   php scripts/regrade_all.php --dry         — показать список и выйти
 */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { fwrite(STDERR, "CLI only\n"); exit(1); }

define('BASE_PATH', dirname(__DIR__));
$GLOBALS['CFG'] = require BASE_PATH . '/config.php';
require_once BASE_PATH . '/core/db.php';
require_once BASE_PATH . '/core/data.php';
require_once BASE_PATH . '/core/helpers.php';
require_once BASE_PATH . '/core/ai_grader.php';

$limit = 0; $comp = 0; $dry = in_array('--dry', $argv, true);
$onlyNew = in_array('--only-new', $argv, true);
foreach ($argv as $a) {
    if (preg_match('~^--limit=(\d+)$~', $a, $m)) $limit = (int) $m[1];
    if (preg_match('~^--comp=(\d+)$~', $a, $m))  $comp  = (int) $m[1];
}

ag_migrate();

$where = "COALESCE(a.result,'') = '' AND a.status NOT IN ('rejected','draft')";
$args  = [];
if ($comp > 0) { $where .= ' AND a.competition_id = ?'; $args[] = $comp; }
if ($onlyNew) {
    $where .= " AND NOT EXISTS (SELECT 1 FROM grading_runs r WHERE r.application_id = a.id AND r.status='ok')";
}
/* УСТАРЕВШИЙ РАЗБОР — ТОЖЕ ПРОБЕЛ.
 *
 * Разбор, сделанный прежним заданием, выглядит в отчётах как готовый, а на
 * деле в нём нет ни уроков, разобранных на правках жюри, ни проверок раздела 8
 * (видны ли руки, ноги и лицо, статична ли камера, слышен ли звук). Тридцать
 * шесть работ так и остались с оценкой по старым правилам, пока остальные
 * двести шли по новым. Признак свежести — наличие ключа visible в формальной
 * проверке: он появился вместе с новым заданием. */
if (in_array('--stale', $argv, true)) {
    $where .= " AND EXISTS (SELECT 1 FROM grading_runs r WHERE r.application_id = a.id AND r.status='ok')"
            . " AND NOT EXISTS (SELECT 1 FROM grading_runs r2 WHERE r2.application_id = a.id"
            . "   AND r2.status='ok' AND r2.formal LIKE '%visible%' AND r2.created_at >= '2026-08-27 04:00')";
}
$rows = all("SELECT a.id, a.nomination, a.full_name, a.group_name, c.name AS comp
               FROM applications a LEFT JOIN competitions c ON c.id = a.competition_id
              WHERE $where ORDER BY a.id" . ($limit > 0 ? ' LIMIT ' . $limit : ''), $args);

$total = count($rows);
$say = static function (string $s): void {
    fwrite(STDOUT, date('H:i:s') . ' ' . $s . "\n");
    @file_put_contents(BASE_PATH . '/data/logs/regrade.log',
        date('Y-m-d H:i:s') . ' ' . $s . "\n", FILE_APPEND);
};
$say("к пересмотру: $total заявок" . ($dry ? ' (сухой прогон)' : ''));
if ($dry || !$total) exit(0);

$ok = 0; $rej = 0; $bad = 0;
foreach ($rows as $i => $r) {
    $id = (int) $r['id'];
    $who = trim((string) ($r['full_name'] ?: $r['group_name']));
    try {
        $res = ag_grade_application($id);
    } catch (\Throwable $e) {
        $bad++; $say(sprintf('[%d/%d] #%d %s — сбой: %s', $i + 1, $total, $id, $who, $e->getMessage()));
        continue;
    }
    if (empty($res['ok'])) {
        $bad++;
        $say(sprintf('[%d/%d] #%d %s — не разобрано: %s', $i + 1, $total, $id, $who, (string) $res['why']));
        continue;
    }
    // «ТРЕБУЕТ ПРОВЕРКИ» — это сработавшее основание положения, а не оценка.
    if ((string) $res['title'] === 'ТРЕБУЕТ ПРОВЕРКИ') {
        $rej++;
        $say(sprintf('[%d/%d] #%d %s — ОСНОВАНИЕ: %s', $i + 1, $total, $id, $who,
            str_replace("\n", ' ', mb_substr((string) $res['why'], 0, 140))));
        continue;
    }
    $ok++;
    $say(sprintf('[%d/%d] #%d %s — %s (%.1f)', $i + 1, $total, $id, $who,
        (string) $res['title'], (float) $res['total']));
}
$say("готово: разобрано $ok, с основанием для отказа $rej, не удалось $bad");
exit(0);
