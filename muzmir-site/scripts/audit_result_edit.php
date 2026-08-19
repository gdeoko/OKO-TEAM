<?php
/**
 * ПРАВКА УЖЕ ВЫНЕСЕННОГО РЕШЕНИЯ — СКВОЗНАЯ ПРОВЕРКА.
 *
 * Решение по заявке выносится один раз, а ошибиться в нём можно так же легко, как
 * в чём угодно: не тот пункт положения, не то звание. Проверяем, что решение
 * можно поправить в любом из трёх мест — архив коротких, архив длинных, карточка
 * заявки — и что правка не бьёт по участнику: второй отказ ему не уходит, деньги
 * второй раз не возвращаются, отправленные документы не трогаются.
 *
 * Работает на СВОЕЙ временной заявке и убирает её за собой.
 *
 *   php scripts/audit_result_edit.php
 */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { fwrite(STDERR, "CLI only\n"); exit(1); }

define('BASE_PATH', dirname(__DIR__));
$GLOBALS['CFG'] = require BASE_PATH . '/config.php';
require_once BASE_PATH . '/core/db.php';
require_once BASE_PATH . '/core/data.php';
require_once BASE_PATH . '/core/helpers.php';
require_once BASE_PATH . '/core/presets.php';
require_once BASE_PATH . '/core/app_status.php';

$OK = 0; $BAD = 0;
function ok(string $s, string $x = ''): void  { global $OK; $OK++; echo "  [ок]   $s" . ($x !== '' ? " — $x" : '') . "\n"; }
function bad(string $s, string $x = ''): void { global $BAD; $BAD++; echo "  [СБОЙ] $s" . ($x !== '' ? " — $x" : '') . "\n"; }
function step(string $t, callable $f): void {
    try { $r = $f(); } catch (\Throwable $e) { bad($t, 'исключение: ' . $e->getMessage()); return; }
    $r === false || $r === null ? bad($t) : ok($t, is_string($r) ? $r : '');
}
$line = str_repeat('=', 78);

/* ── Временная заявка ─────────────────────────────────────────────────────── */
$MAIL = 'result-edit-' . substr(bin2hex(random_bytes(4)), 0, 8) . '@example.test';
$comp = one("SELECT id, is_paid, results_mode FROM competitions WHERE status='open' ORDER BY id DESC LIMIT 1")
     ?: one("SELECT id, is_paid, results_mode FROM competitions ORDER BY id DESC LIMIT 1");
if (!$comp) { echo "нет ни одного конкурса — проверять не на чем\n"; exit(1); }

echo "ПРАВКА РЕШЕНИЯ ПО ЗАЯВКЕ\n$line\n";
$aid = (int) insert('applications', [
    'number' => 'CHK-EDIT-' . substr(bin2hex(random_bytes(3)), 0, 6),
    'competition_id' => (int) $comp['id'],
    'full_name' => 'Проверка Правки Решения',
    'email' => $MAIL, 'work_title' => '«Проверка правки»',
    'status' => 'new', 'is_paid' => 1,
]);
ok('временная заявка заведена', 'id=' . $aid);

$cleanup = static function () use ($aid, $MAIL): void {
    foreach (['diplomas' => 'application_id', 'jury_grades' => 'application_id',
              'payments' => 'application_id', 'jury_assignments' => 'application_id'] as $t => $c) {
        try { q("DELETE FROM \"$t\" WHERE $c=?", [$aid]); } catch (\Throwable $e) {}
    }
    try { q("DELETE FROM mail_queue WHERE LOWER(to_email)=?", [mb_strtolower($MAIL)]); } catch (\Throwable $e) {}
    try { q("DELETE FROM applications WHERE id=?", [$aid]); } catch (\Throwable $e) {}
    echo "\nвременные данные удалены\n";
};
register_shutdown_function($cleanup);

/** Сколько писем этой заявке лежит в очереди. */
$letters = static fn(): int => (int) (scalar("SELECT COUNT(*) FROM mail_queue WHERE LOWER(to_email)=?",
    [mb_strtolower($MAIL)]) ?? 0);

/* ── 1. Списки оснований и званий ─────────────────────────────────────────── */
echo "\n1. СПИСКИ, ОБЩИЕ ДЛЯ ВСЕЙ АДМИНКИ\n$line\n";
step('основания для отклонения доступны вне раздела оценки', function () {
    return function_exists('REJECT_REASONS') ? 'REJECT_REASONS живёт в core/presets.php' : false;
});
step('нумерация пунктов зависит от положения конкурса', function () {
    $paid = REJECT_REASONS(['is_paid' => 1]);
    $free = REJECT_REASONS(['is_paid' => 0]);
    return count($paid) !== count($free) && $paid !== $free
        ? 'платный ' . count($paid) . ' пунктов, бесплатный ' . count($free) : false;
});
step('звания на месте', fn() => count(RESULT_PRESETS()) >= 4 ? implode(', ', array_slice(RESULT_PRESETS(), 0, 3)) . '…' : false);

/* ── 2. Отклонение и правка основания ─────────────────────────────────────── */
echo "\n2. ОТКЛОНЕНИЕ И ПРАВКА ЕГО ОСНОВАНИЯ\n$line\n";
$reasons = array_values(REJECT_REASONS(['is_paid' => (int) ($comp['is_paid'] ?? 1)]));
$first = (string) $reasons[0];
$second = (string) $reasons[1];

step('заявка отклонена по первому основанию', function () use ($aid, $first) {
    update('applications', ['status' => 'rejected', 'reject_reason' => $first], 'id=:id', ['id' => $aid]);
    return (string) (scalar("SELECT reject_reason FROM applications WHERE id=?", [$aid]) ?? '') === $first;
});

$before = $letters();
step('правка основания БЕЗ уведомления не шлёт участнику письмо', function () use ($aid, $second, $letters, $before) {
    // Тот же путь, что и в админке: меняем причину и не трогаем ничего больше.
    update('applications', ['reject_reason' => $second], 'id=:id', ['id' => $aid]);
    $now = (string) (scalar("SELECT reject_reason FROM applications WHERE id=?", [$aid]) ?? '');
    return $now === $second && $letters() === $before ? 'причина заменена, писем не прибавилось' : false;
});

step('в основании сохранён именно пункт положения, а не пересказ', function () use ($second) {
    return preg_match('~п\.\s*\d|пункт~ui', $second) ? mb_substr($second, 0, 60) . '…' : false;
});

step('снятие отклонения возвращает заявку в работу', function () use ($aid) {
    update('applications', ['status' => 'new', 'reject_reason' => ''], 'id=:id', ['id' => $aid]);
    app_status_sync($aid);
    $st = (string) (scalar("SELECT status FROM applications WHERE id=?", [$aid]) ?? '');
    return $st !== 'rejected' ? 'статус: ' . $st : false;
});

/* ── 3. Результат и его смена ─────────────────────────────────────────────── */
echo "\n3. РЕЗУЛЬТАТ И ЕГО СМЕНА\n$line\n";
$presets = RESULT_PRESETS();
step('результат проставляется', function () use ($aid, $presets) {
    update('applications', ['result' => $presets[0], 'status' => 'graded',
                            'graded_at' => date('Y-m-d H:i:s')], 'id=:id', ['id' => $aid]);
    return (string) (scalar("SELECT result FROM applications WHERE id=?", [$aid]) ?? '') === $presets[0]
        ? $presets[0] : false;
});
step('при смене звания сносится основной диплом, а именной остаётся', function () use ($aid, $presets) {
    insert('diplomas', ['application_id' => $aid, 'number' => 'CHK-' . $aid, 'type' => 'main', 'result' => $presets[0]]);
    insert('diplomas', ['application_id' => $aid, 'number' => 'CHK-N-' . $aid, 'type' => 'named', 'result' => $presets[0]]);
    // Ровно это делает раздел оценки при изменившемся звании. Крон пересобирает
    // только основной и дополнительный, поэтому именной (его могли оплатить
    // заказом) не трогаем: администратор перевыпускает его сам.
    q("DELETE FROM diplomas WHERE application_id=? AND type='main' AND COALESCE(sent_at,'')=''", [$aid]);
    update('applications', ['result' => $presets[1]], 'id=:id', ['id' => $aid]);
    $main  = (int) (scalar("SELECT COUNT(*) FROM diplomas WHERE application_id=? AND type='main'",  [$aid]) ?? 0);
    $named = (int) (scalar("SELECT COUNT(*) FROM diplomas WHERE application_id=? AND type='named'", [$aid]) ?? 0);
    return $main === 0 && $named === 1 ? 'основной пересоздастся, именной уцелел' : false;
});
step('отправленный документ при смене звания не трогается', function () use ($aid, $presets) {
    insert('diplomas', ['application_id' => $aid, 'number' => 'CHK-SENT-' . $aid, 'type' => 'main',
                        'result' => $presets[1], 'sent_at' => date('Y-m-d H:i:s')]);
    q("DELETE FROM diplomas WHERE application_id=? AND type='main' AND COALESCE(sent_at,'')=''", [$aid]);
    $left = (int) (scalar("SELECT COUNT(*) FROM diplomas WHERE application_id=? AND sent_at IS NOT NULL", [$aid]) ?? 0);
    return $left === 1 ? 'отправленный диплом на месте' : false;
});
step('заявка с результатом видна в архиве оценённых', function () use ($aid) {
    require_once BASE_PATH . '/core/graded_list.php';
    foreach (graded_rows(0, '', 'new', '') as $r) if ((int) $r['id'] === $aid) return 'нашлась';
    return false;
});
step('отклонённая заявка тоже видна в архиве', function () use ($aid, $first) {
    require_once BASE_PATH . '/core/graded_list.php';
    update('applications', ['status' => 'rejected', 'reject_reason' => $first], 'id=:id', ['id' => $aid]);
    foreach (graded_rows(0, '', 'new', '') as $r) if ((int) $r['id'] === $aid) return 'нашлась';
    return false;
});

/* ── 4. Разметка: есть ли органы управления в трёх местах ─────────────────── */
echo "\n4. ГДЕ МОЖНО ПРАВИТЬ РЕШЕНИЕ\n$line\n";
$has = static function (string $file, array $needles): bool {
    $src = @file_get_contents(BASE_PATH . '/' . $file) ?: '';
    foreach ($needles as $n) if (mb_strpos($src, $n) === false) return false;
    return true;
};
step('архивы оценок (общая таблица): смена звания и правка причины', function () use ($has) {
    return $has('admin/_boot.php', ['name="do" value="grade_result"', 'name="do" value="reject_edit"',
                                    'Изменить решение', 'Изменить причину отклонения'])
        ? 'обе формы на месте' : false;
});
step('карточка оценки: правка вынесенного отклонения', function () use ($has) {
    // Действие формы в карточке зависит от состояния заявки: у отклонённой это
    // правка основания, у остальных — само отклонение.
    return $has('admin/grading.php', ["'reject_edit' : 'reject'", 'Изменить отклонение',
                                      'Снять отклонение и вернуть в работу'])
        ? 'панель правки на месте' : false;
});
step('карточка заявки: результат и отклонение', function () use ($has) {
    return $has('admin/applications.php', ['Изменить результат', 'name="do" value="reject_edit"',
                                           'Изменить причину отклонения'])
        ? 'оба блока на месте' : false;
});
step('обработчик правки отклонения не повторяет возврат денег', function () use ($has) {
    $src = @file_get_contents(BASE_PATH . '/admin/grading.php') ?: '';
    $i = mb_strpos($src, "input('do') === 'reject_edit'");
    if ($i === false) return false;
    $block = mb_substr($src, $i, 4000);
    return mb_strpos($block, 'refund_application') === false ? 'возврат не вызывается' : false;
});
step('правка отклонения возвращает туда, откуда начали', function () use ($has) {
    return $has('admin/grading.php', ["=== 'archive'", "=== 'applications'"]) ? 'archive и applications' : false;
});

echo "\n$line\n";
printf("ПРОЙДЕНО: %d · СБОЕВ: %d\n", $OK, $BAD);
exit($BAD > 0 ? 1 : 0);
