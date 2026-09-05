<?php
/**
 * ПРИМЕНИТЬ ГОТОВЫЕ РАЗБОРЫ — ТЕМ ЖЕ ПУТЁМ, КАКИМ ЭТО ДЕЛАЕТ ЖЮРИ РУКАМИ.
 *
 * Разборы лежат в grading_runs как подсказки: звание, балл, комментарий,
 * дополнительный диплом. Здесь они переносятся в заявки через ту же функцию,
 * что вызывает карточка жюри (grade_apply_result), — значит срабатывает всё
 * остальное: срок отправки результата по правилу центра, наградные документы,
 * статус в кабинете, запись в журнал.
 *
 * ЧТО НЕ ПРИМЕНЯЕТСЯ:
 *   • «ТРЕБУЕТ ПРОВЕРКИ» — это не звание, а сработавшее основание положения.
 *     Отклонение необратимо и стоит денег, поэтому решает человек;
 *   • заявки, которых человек уже касался (есть звание или отметка о судействе).
 *
 * ПИСЬМА СЕЙЧАС НЕ УХОДЯТ. Срок отправки считается от даты подачи: пять рабочих
 * дней, участникам клуба три. Скрипт проверяет каждую дату и, если она вдруг
 * оказалась в прошлом (заявка подана давно, а разбор задержался), отодвигает
 * отправку на ближайшее рабочее утро — иначе письмо ушло бы в ту же минуту.
 * У длинного конкурса (results_mode='list') письма нет вовсе: итоги
 * публикуются списком.
 *
 *   php scripts/apply_all.php --dry     — показать, ничего не меняя
 *   php scripts/apply_all.php
 */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { fwrite(STDERR, "CLI only\n"); exit(1); }

define('BASE_PATH', dirname(__DIR__));
$GLOBALS['CFG'] = require BASE_PATH . '/config.php';
require_once BASE_PATH . '/core/db.php';
require_once BASE_PATH . '/core/data.php';
require_once BASE_PATH . '/core/helpers.php';
require_once BASE_PATH . '/core/grade_apply.php';

$dry = in_array('--dry', $argv, true);

/* ПЕРЕКЛЮЧАТЕЛЬ РЕЖИМА СИЛЬНЕЕ ЭТОГО СКРИПТА.
 *
 * Скрипт переносит машинные разборы в заявки. Раньше он не смотрел на режим
 * аттестации вовсе: 27.08 при выключенном автомате (режим «подсказка») одним
 * запуском в заявки легло 205 машинных оценок. Владелец судил руками, а решение
 * за него уже приняла машина — и понять это по карточке было нельзя.
 *
 * Теперь: в режиме «подсказка» и «выключено» скрипт не применяет ничего.
 * Осознанный разовый прогон — ключом --force, и он пишется в журнал. */
require_once BASE_PATH . '/core/ai_grader.php';
$force = in_array('--force', $argv, true);
$mode  = function_exists('ag_mode') ? ag_mode() : 'off';
if ($mode !== 'auto' && !$force && !$dry) {
    fwrite(STDERR, "Режим аттестации сейчас «{$mode}» — машинные оценки не применяются.\n"
                 . "Включите «полный автомат» в админке или запустите с ключом --force,\n"
                 . "если решили применить разборы разово и осознанно.\n");
    exit(2);
}

/* ЗАЩИТЫ АВТОМАТА ДЕЙСТВУЮТ И ЗДЕСЬ.
 *
 * Гран-при, работа без звания, балл у самой границы звания, тревожные признаки,
 * низкая уверенность — всё это по правилу центра решает человек. Скрипт эти
 * проверки обходил, и работы, которые автомат сам бы не тронул, применялись
 * пачкой. Теперь через ag_can_apply() проходят обе дороги. */

$rows = all("SELECT a.id, a.number, a.full_name, a.group_name, a.created_at,
                    c.name AS comp, c.results_mode,
                    r.id AS run_id, r.title, r.total, r.jury_comment, r.extra_award
               FROM applications a
               JOIN competitions c ON c.id = a.competition_id
               JOIN grading_runs r ON r.id = (SELECT MAX(r2.id) FROM grading_runs r2
                                               WHERE r2.application_id = a.id AND r2.status = 'ok')
              WHERE COALESCE(a.result,'') = ''
                AND COALESCE(a.graded_at,'') = ''
                AND a.status NOT IN ('rejected','draft')
                AND r.title <> 'ТРЕБУЕТ ПРОВЕРКИ'
           ORDER BY a.id");

$say = static function (string $s): void {
    fwrite(STDOUT, $s . "\n");
    @file_put_contents(BASE_PATH . '/data/logs/apply_all.log',
        date('Y-m-d H:i:s') . ' ' . $s . "\n", FILE_APPEND);
};
$say('к применению: ' . count($rows) . ($dry ? ' (сухой прогон)' : ''));
if (!$rows) exit(0);

$ok = 0; $skip = 0; $sentNow = 0;
foreach ($rows as $r) {
    $id  = (int) $r['id'];
    $who = trim((string) ($r['full_name'] ?: $r['group_name']));
    if ($dry) {
        $say(sprintf('  #%d %s | %s | %s', $id, (string) $r['number'], (string) $r['title'], (string) $r['comp']));
        continue;
    }
    if (!$force && function_exists('ag_can_apply')) {
        $run = one("SELECT * FROM grading_runs WHERE id=?", [(int) $r['run_id']]);
        if ($run) {
            [$can, $why] = ag_can_apply((array) $run);
            if (!$can) { $skip++; $say(sprintf('  #%d %s — оставлено человеку: %s', $id, $who, $why)); continue; }
        }
    }
    try {
        $res = grade_apply_result($id, (string) $r['title'], [
            'extra_diploma' => (string) ($r['extra_award'] ?? ''),
            'jury_comment'  => (string) ($r['jury_comment'] ?? ''),
            'send_mode'     => 'auto',
            'source'        => 'ai',
            'run_id'        => (int) $r['run_id'],
        ]);
    } catch (\Throwable $e) {
        $skip++; $say(sprintf('  #%d %s — СБОЙ: %s', $id, $who, $e->getMessage()));
        continue;
    }
    if (empty($res['ok'])) { $skip++; $say(sprintf('  #%d %s — не применено: %s', $id, $who, (string) $res['msg'])); continue; }

    q("UPDATE grading_runs SET applied=1, applied_at=? WHERE id=?", [date('Y-m-d H:i:s'), (int) $r['run_id']]);
    $ok++;
    if (!empty($res['sent'])) $sentNow++;

    /* СРОК В ПРОШЛОМ — ПИСЬМО УШЛО БЫ НЕМЕДЛЕННО.
     *
     * Такое бывает у заявки, поданной давно: пять рабочих дней от подачи уже
     * истекли, и «отправить по сроку» означает «отправить сейчас». Владелец
     * просил, чтобы сегодня результаты не уходили никому, поэтому отодвигаем на
     * ближайшее рабочее утро (та же мерка, что у отказов, — ga_next_worktime). */
    $sendAt = (string) ($res['send_at'] ?? '');
    if ($sendAt !== '' && strtotime($sendAt) <= time()) {
        $next = ga_next_worktime();
        if ($next === '') $next = date('Y-m-d H:i:s', strtotime('tomorrow 10:00'));
        q("UPDATE applications SET result_send_at=? WHERE id=?", [$next, $id]);
        $sendAt = $next . ' (отодвинуто)';
    }
    $say(sprintf('  #%d %s | %s | отправка: %s', $id, mb_substr($who, 0, 34),
        (string) $r['title'], $sendAt !== '' ? $sendAt : 'списком, письма нет'));
}
$say(sprintf('готово: применено %d, пропущено %d, ушло писем немедленно: %d', $ok, $skip, $sentNow));
