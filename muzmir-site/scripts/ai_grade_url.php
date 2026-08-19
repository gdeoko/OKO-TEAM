<?php
/**
 * ОЦЕНИТЬ ЗАПИСЬ ПО ССЫЛКЕ, БЕЗ ЗАЯВКИ.
 *
 * Нужно для проверки: владелец присылает ссылку, эта же ссылка уходит живому
 * члену жюри, и два разбора сравниваются. Заявку для такой проверки заводить
 * нельзя (она попадёт в конкурс и в статистику), поэтому здесь создаётся
 * временная запись, а после оценки удаляется.
 *
 * Номинацию и направление указывает человек: по одной записи их не угадать
 * (сольный номер под фонограмму может быть и эстрадным вокалом, и музыкальным
 * театром), а неверная рубрика даст неверную оценку.
 *
 *   php scripts/ai_grade_url.php --url=ССЫЛКА --nom="Вокальное искусство" \
 *       --sub="Эстрадный вокал" --age="11-12 лет" --form="Соло" --work="Название"
 */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { fwrite(STDERR, "CLI only\n"); exit(1); }

define('BASE_PATH', dirname(__DIR__));
$GLOBALS['CFG'] = require BASE_PATH . '/config.php';
require_once BASE_PATH . '/core/db.php';
require_once BASE_PATH . '/core/helpers.php';
require_once BASE_PATH . '/core/data.php';
require_once BASE_PATH . '/core/ai_grader.php';

$opt = ['url' => '', 'nom' => '', 'sub' => '', 'age' => 'Смешанная', 'form' => 'Соло',
        'work' => 'Конкурсная работа', 'who' => 'Проверка оценки'];
foreach ($argv as $a) {
    if (preg_match('~^--([a-z]+)=(.*)$~s', $a, $m) && array_key_exists($m[1], $opt)) $opt[$m[1]] = $m[2];
}
$line = str_repeat('=', 78);

if ($opt['url'] === '' || $opt['nom'] === '') {
    fwrite(STDERR, "нужны --url и --nom (номинация)\n\nноминации и направления:\n");
    foreach (NOMINATIONS() as $nom => $subs) {
        fwrite(STDERR, '  ' . $nom . ($subs ? ': ' . implode(', ', $subs) : '') . "\n");
    }
    exit(1);
}

ag_migrate();

// Временная заявка. Номер с меткой, чтобы её нельзя было спутать с настоящей.
$num = 'ПРОВЕРКА-' . date('md-His');
$appId = (int) insert('applications', [
    'number'         => $num,
    'competition_id' => (int) (scalar("SELECT id FROM competitions ORDER BY id DESC LIMIT 1") ?? 0),
    'user_id'        => 0,
    'full_name'      => $opt['who'],
    'work_title'     => $opt['work'],
    'nomination'     => $opt['nom'],
    'subgroup'       => $opt['sub'],
    'age_category'   => $opt['age'],
    'formation'      => $opt['form'],
    'video_url'      => $opt['url'],
    'status'         => 'draft',        // черновик: в конкурс и отчёты не попадает
    'email'          => '',
]);

echo "ПРОВЕРОЧНАЯ ОЦЕНКА\n$line\n";
printf("  номинация: %s%s\n  возраст: %s, состав: %s\n  ссылка: %s\n\n",
    $opt['nom'], $opt['sub'] !== '' ? ' / ' . $opt['sub'] : '', $opt['age'], $opt['form'], $opt['url']);

$t0  = microtime(true);
$res = ag_grade_application($appId);

if (!$res['ok']) {
    printf("  НЕ ОЦЕНЕНО: %s\n", $res['why']);
    q("DELETE FROM applications WHERE id=?", [$appId]);
    exit(1);
}

$run = one("SELECT * FROM grading_runs WHERE id=?", [(int) $res['run_id']]);
printf("  ИТОГ: %.1f балла → %s   (модель %s, %.0f с)\n\n",
    (float) $run['total'], (string) $run['title'], (string) $run['model'], microtime(true) - $t0);

echo "  ПО КРИТЕРИЯМ\n$line\n";
foreach ((array) json_decode((string) $run['scores'], true) as $c) {
    printf("  %-34s %5.1f  (вес %2d)\n      %s\n\n", mb_substr((string) $c['title'], 0, 34),
        (float) $c['score'], (int) $c['weight'], wordwrap((string) $c['note'], 92, "\n      ", false));
}

$formal = (array) json_decode((string) $run['formal'], true);
$bad = [];
foreach (gr_formal_checks() as $k => $text) if (array_key_exists($k, $formal) && $formal[$k] === false) $bad[] = $text;
if ($bad) echo "  НЕ СООТВЕТСТВУЕТ ПОЛОЖЕНИЮ: " . implode(' ', $bad) . "\n\n";

$extra = trim((string) ($run['extra_award'] ?? ''));
if ($extra !== '') {
    printf("  ДОПОЛНИТЕЛЬНЫЙ ДИПЛОМ: %s\n      %s\n\n", $extra,
        wordwrap((string) ($run['extra_award_why'] ?? ''), 92, "\n      ", false));
} else {
    echo "  дополнительный диплом не предлагается\n\n";
}

$flags = (array) json_decode((string) $run['red_flags'], true);
if ($flags) echo "  ТРЕБУЕТ ВНИМАНИЯ: " . implode('; ', array_map('strval', $flags)) . "\n\n";

printf("  уверенность: %.2f\n\n", (float) $run['confidence']);
echo "  КОММЕНТАРИЙ ЖЮРИ\n$line\n" . wordwrap((string) $run['jury_comment'], 92, "\n  ", false) . "\n\n";
if (trim((string) $run['internal_note']) !== '') {
    echo "  ДЛЯ ОРГКОМИТЕТА: " . wordwrap((string) $run['internal_note'], 92, "\n  ", false) . "\n\n";
}

// Временную заявку убираем, разбор оставляем: по нему потом сверяются с жюри.
q("DELETE FROM applications WHERE id=?", [$appId]);
echo "  (проверочная заявка удалена, разбор №" . (int) $run['id'] . " сохранён)\n";
