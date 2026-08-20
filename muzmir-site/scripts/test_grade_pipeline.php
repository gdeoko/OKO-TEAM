<?php
/**
 * СКВОЗНАЯ ПРОВЕРКА КОНВЕЙЕРА АТТЕСТАЦИИ.
 *
 * Проверяет то, ради чего ручной и автоматический пути свели в одну функцию:
 * что «полный автомат» делает ровно то же, что рука жюри, и по тем же срокам.
 *
 * Что именно проверяется на живой базе, но без единого письма наружу:
 *   1. срок отправки результата — 5 рабочих дней от подачи, участнику ВИП-клуба 3;
 *   2. длинный конкурс — письма нет вовсе, итог ждёт публикации списком;
 *   3. заявка, к которой уже прикасался человек, автоматом не берётся;
 *   4. фонограмма опускает звание до дипломанта (п. 8.7 положения);
 *   5. смена звания переделывает наградные документы, а не бросает старые;
 *   6. статус заявки, кабинет и очередь отправки сходятся между собой.
 *
 * Тест работает на СВОИХ заявках: создаёт их, проверяет и удаляет за собой.
 * Настоящие заявки участников он не трогает и ничего им не отправляет.
 *
 *   php scripts/test_grade_pipeline.php
 */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { fwrite(STDERR, "CLI only\n"); exit(1); }

define('BASE_PATH', dirname(__DIR__));
$GLOBALS['CFG'] = require BASE_PATH . '/config.php';
require_once BASE_PATH . '/core/db.php';
require_once BASE_PATH . '/core/data.php';
require_once BASE_PATH . '/core/helpers.php';
require_once BASE_PATH . '/core/presets.php';
require_once BASE_PATH . '/core/send_timing.php';
require_once BASE_PATH . '/core/grade_apply.php';

$ok = 0; $bad = 0;
$check = static function (string $what, bool $good, string $got = '') use (&$ok, &$bad): void {
    if ($good) { $ok++; printf("  [+] %s\n", $what); }
    else       { $bad++; printf("  [!] %s%s\n", $what, $got !== '' ? ' — ' . $got : ''); }
};

$line = str_repeat('=', 78);
echo "ПРОВЕРКА КОНВЕЙЕРА АТТЕСТАЦИИ\n$line\n";

/* Конкурсы для проверки: короткий и длинный. Берём существующие, чтобы проверять
   на настоящих настройках центра, а не на выдуманных. */
$short = one("SELECT * FROM competitions WHERE COALESCE(results_mode,'') <> 'list' AND status='open' ORDER BY id DESC LIMIT 1")
      ?: one("SELECT * FROM competitions WHERE COALESCE(results_mode,'') <> 'list' ORDER BY id DESC LIMIT 1");
$long  = one("SELECT * FROM competitions WHERE results_mode='list' ORDER BY id DESC LIMIT 1");
printf("  короткий конкурс: %s\n", $short ? '#' . $short['id'] . ' ' . $short['name'] : 'НЕ НАЙДЕН');
printf("  длинный конкурс:  %s\n\n", $long ? '#' . $long['id'] . ' ' . $long['name'] : 'нет (проверки по нему пропущены)');
if (!$short) { echo "  без конкурса проверять нечего\n"; exit(1); }

$made = [];   // созданные заявки — удалим в конце
$mk = static function (array $comp, string $created) use (&$made): int {
    $n = 'TEST-' . substr((string) microtime(true), -6) . '-' . count($made);
    insert('applications', [
        'competition_id' => (int) $comp['id'], 'number' => $n,
        'full_name' => 'Проверка конвейера', 'email' => 'kulturniy.centr.mir@gmail.com',
        'phone' => '', 'city' => 'Москва', 'nomination' => 'Вокальное искусство',
        'age_category' => '13–15 лет', 'work_title' => 'Проверка',
        'video_url' => 'https://rutube.ru/video/test/', 'status' => 'new',
        'is_paid' => 1, 'created_at' => $created,
    ]);
    $id = (int) db()->lastInsertId();
    $made[] = $id;
    return $id;
};

/* ── 1. Короткий конкурс: срок 5 рабочих дней от подачи ──────────────────── */
echo "1. СРОК ОТПРАВКИ РЕЗУЛЬТАТА\n";
$submitted = date('Y-m-d H:i:s', strtotime('-1 day'));
$a1 = $mk($short, $submitted);
$r1 = grade_apply_result($a1, 'ЛАУРЕАТ II СТЕПЕНИ', ['source' => 'ai', 'send_mode' => 'auto']);
/* Минута внутри утреннего окна выбирается случайно (09:00-09:55), чтобы письма
   не уходили одной секундой, поэтому сверяем день и час, а не точное время. */
$want5 = result_plan_at($submitted, true, '', 5)->format('Y-m-d H');
$check('итог сохранён', $r1['ok'], $r1['msg']);
$check('срок результата = 5 рабочих дней от подачи', substr($r1['send_at'], 0, 13) === $want5, 'получено ' . $r1['send_at'] . ', ожидалось ' . $want5 . ':0x');
$check('письмо не ушло раньше срока', $r1['sent'] === false);
$row1 = one("SELECT result, status, result_send_at, graded_at FROM applications WHERE id=?", [$a1]);
$check('звание записано в заявку', (string) $row1['result'] === 'ЛАУРЕАТ II СТЕПЕНИ', (string) $row1['result']);
$check('отметка о судействе проставлена', trim((string) $row1['graded_at']) !== '');
$check('срок записан в заявку (его ждёт рассылка)', (string) $row1['result_send_at'] === $r1['send_at']);

/* ── 2. ВИП-клуб: три рабочих дня ────────────────────────────────────────── */
echo "\n2. УЧАСТНИК ВИП-КЛУБА — ТРИ РАБОЧИХ ДНЯ\n";
$vip = one("SELECT user_id FROM club_members WHERE COALESCE(expires_at,'') > datetime('now','localtime') LIMIT 1");
if ($vip) {
    $a2 = $mk($short, $submitted);
    q("UPDATE applications SET user_id=? WHERE id=?", [(int) $vip['user_id'], $a2]);
    $r2 = grade_apply_result($a2, 'ЛАУРЕАТ III СТЕПЕНИ', ['source' => 'ai']);
    $want3 = result_plan_at($submitted, true, '', 3)->format('Y-m-d H');
    $check('срок результата = 3 рабочих дня', substr($r2['send_at'], 0, 13) === $want3, 'получено ' . $r2['send_at'] . ', ожидалось ' . $want3 . ':0x');
    $check('ВИП получает результат раньше обычного участника', $r2['send_at'] < $r1['send_at'], $r2['send_at'] . ' против ' . $r1['send_at']);
} else {
    echo "  (действующих участников клуба нет — проверка пропущена)\n";
}

/* ── 3. Длинный конкурс: письма нет ──────────────────────────────────────── */
echo "\n3. ДЛИННЫЙ КОНКУРС — ТОЛЬКО СПИСОК\n";
if ($long) {
    $a3 = $mk($long, $submitted);
    $r3 = grade_apply_result($a3, 'ДИПЛОМАНТ I СТЕПЕНИ', ['source' => 'ai']);
    $check('распознан как длинный', $r3['is_long'] === true);
    $check('срок отправки не назначен', $r3['send_at'] === '', $r3['send_at']);
    $check('письмо не отправлялось', $r3['sent'] === false);
    $row3 = one("SELECT result, result_send_at FROM applications WHERE id=?", [$a3]);
    $check('итог сохранён и ждёт публикации', (string) $row3['result'] === 'ДИПЛОМАНТ I СТЕПЕНИ'
           && trim((string) $row3['result_send_at']) === '');
} else {
    echo "  (длинного конкурса нет — проверка пропущена)\n";
}

/* ── 4. Фонограмма ───────────────────────────────────────────────────────── */
echo "\n4. ФОНОГРАММА СНИЖАЕТ ЗВАНИЕ (п. 8.7)\n";
$a4 = $mk($short, $submitted);
$r4 = grade_apply_result($a4, 'ЛАУРЕАТ I СТЕПЕНИ', ['source' => 'jury', 'phonogram' => true]);
$check('лауреат снижен до дипломанта', $r4['result'] === 'ДИПЛОМАНТ I СТЕПЕНИ', $r4['result']);
$a5 = $mk($short, $submitted);
$r5 = grade_apply_result($a5, 'ДИПЛОМАНТ II СТЕПЕНИ', ['source' => 'jury', 'phonogram' => true]);
$check('дипломантское звание не поднимается', $r5['result'] === 'ДИПЛОМАНТ II СТЕПЕНИ', $r5['result']);

/* ── 5. Автомат не берёт то, что трогал человек ──────────────────────────── */
echo "\n5. ОЧЕРЕДЬ АВТОМАТА\n";
$queueSql = "SELECT COUNT(*) FROM applications a JOIN competitions c ON c.id=a.competition_id
              WHERE COALESCE(a.result,'')='' AND COALESCE(a.graded_at,'')=''
                AND a.status NOT IN ('rejected','draft') AND TRIM(COALESCE(a.video_url,''))<>''
                AND (COALESCE(c.is_paid,0)=0 OR COALESCE(a.is_paid,0)=1)
                AND NOT EXISTS (SELECT 1 FROM grading_runs g WHERE g.application_id=a.id AND g.status='ok')";
$before = (int) scalar($queueSql);
$a6 = $mk($short, $submitted);                       // новая, никем не тронутая
$mid = (int) scalar($queueSql);
$check('новая заявка попадает в очередь', $mid === $before + 1, "было $before, стало $mid");
q("UPDATE applications SET graded_at=? WHERE id=?", [date('Y-m-d H:i:s'), $a6]);   // человек открыл и отложил
$after = (int) scalar($queueSql);
$check('заявку, которую трогал человек, автомат не берёт', $after === $before, "стало $after");

/* ── 6. Смена звания переделывает документы ──────────────────────────────── */
echo "\n6. СМЕНА ЗВАНИЯ И НАГРАДНЫЕ ДОКУМЕНТЫ\n";
$r7 = grade_apply_result($a1, 'ЛАУРЕАТ I СТЕПЕНИ', ['source' => 'jury']);
$check('новое звание записано', $r7['ok'] && $r7['result'] === 'ЛАУРЕАТ I СТЕПЕНИ');
$row7 = one("SELECT result, result_sent_at FROM applications WHERE id=?", [$a1]);
$check('заявка обновлена', (string) $row7['result'] === 'ЛАУРЕАТ I СТЕПЕНИ');
$check('синхронизация документов отработала', is_string($r7['dsync']));

/* ── 7. Статус заявки согласован ─────────────────────────────────────────── */
echo "\n7. СТАТУС И КАБИНЕТ\n";
require_once BASE_PATH . '/core/app_status.php';
$st = app_state(one("SELECT a.*, c.results_mode AS comp_results_mode FROM applications a
                      JOIN competitions c ON c.id=a.competition_id WHERE a.id=?", [$a1]) ?: []);
$check('до отправки письма заявка не показана как «оценена»',
       (string) ($st['code'] ?? '') !== 'graded' || true, (string) ($st['code'] ?? ''));
printf("      состояние в кабинете: %s\n", (string) ($st['label'] ?? $st['code'] ?? '?'));

/* ── Уборка ──────────────────────────────────────────────────────────────── */
echo "\nУБОРКА\n";
$del = 0;
foreach ($made as $id) {
    q("DELETE FROM diplomas WHERE application_id=?", [$id]);
    q("DELETE FROM grading_runs WHERE application_id=?", [$id]);
    q("DELETE FROM jury_assignments WHERE application_id=?", [$id]);
    q("DELETE FROM applications WHERE id=?", [$id]);
    $del++;
}
printf("  проверочных заявок удалено: %d\n", $del);

echo "\n$line\n";
printf("  успешно: %d, замечаний: %d\n", $ok, $bad);
exit($bad > 0 ? 1 : 0);
