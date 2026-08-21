<?php
/**
 * ПРИЧИНЫ ОТКЛОНЕНИЯ ДЛЯ УЖЕ РАЗОБРАННЫХ РАБОТ.
 *
 * Разбор научился называть пункт положения, по которому работу нельзя допустить,
 * но у сотен работ, разобранных раньше, этой подсказки нет: в списке у них стоит
 * «ТРЕБУЕТ ПРОВЕРКИ», и жюри разбирается заново — что именно не так и по какому
 * пункту.
 *
 * Скрипт проходит по готовым разборам с формальным нарушением и дописывает
 * причину словами положения. Заявки не трогает и ничего не отклоняет: это
 * подсказка, решение остаётся за человеком.
 *
 *   php scripts/grade_reject_hints.php          — показать, что нашлось
 *   php scripts/grade_reject_hints.php --apply  — дописать подсказки
 */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { fwrite(STDERR, "CLI only\n"); exit(1); }

define('BASE_PATH', dirname(__DIR__));
$GLOBALS['CFG'] = require BASE_PATH . '/config.php';
require_once BASE_PATH . '/core/db.php';
require_once BASE_PATH . '/core/data.php';
require_once BASE_PATH . '/core/helpers.php';
require_once BASE_PATH . '/core/ai_grader.php';

$apply = in_array('--apply', $argv, true);
ag_migrate();

$line = str_repeat('=', 78);
echo "ПРИЧИНЫ ОТКЛОНЕНИЯ ПО РАЗОБРАННЫМ РАБОТАМ\n$line\n";

$rows = all("SELECT g.*, a.number, a.nomination, a.competition_id
               FROM grading_runs g
               JOIN applications a ON a.id = g.application_id
              WHERE g.status='ok' AND COALESCE(g.reject_hint,'')=''
                AND COALESCE(a.result,'')='' AND a.status NOT IN ('rejected','draft')
           ORDER BY g.id DESC LIMIT 500");

$done = 0; $skip = 0;
foreach ($rows as $r) {
    $formal = (array) json_decode((string) ($r['formal'] ?? '[]'), true);
    $fail = [];
    foreach (gr_formal_checks() as $k => $text) {
        if (array_key_exists($k, $formal) && $formal[$k] === false) $fail[$k] = $text;
    }
    if (!$fail) { $skip++; continue; }

    $comp = one("SELECT * FROM competitions WHERE id=?", [(int) $r['competition_id']]);
    [$auto, $reason] = ag_auto_reject((array) $r, (array) $comp);
    if ($reason === '') {
        // Нарушение из спорных (состав, продолжительность): формулируем словами
        // самой проверки, чтобы человек хотя бы знал, куда смотреть.
        $reason = 'Нарушение требований к конкурсному материалу: ' . implode(' ', $fail);
        $issues = (array) ($formal['issues'] ?? []);
        if ($issues) $reason .= "\n\nЧто именно: " . mb_substr(implode('; ', array_map('strval', $issues)), 0, 400);
    }
    printf("  %-16s %-22s → %s%s\n", (string) $r['number'], mb_substr((string) $r['nomination'], 0, 22),
           $auto ? '[автоотказ] ' : '', mb_substr(strtok($reason, "\n"), 0, 60));
    if ($apply) {
        update('grading_runs', ['reject_hint' => mb_substr($reason, 0, 900)], 'id=:id', ['id' => (int) $r['id']]);
    }
    $done++;
}

echo "\n$line\n";
printf("  подсказок дописано: %d, разборов без нарушений: %d\n", $done, $skip);
echo $apply ? "  применено\n" : "  это предпросмотр: php scripts/grade_reject_hints.php --apply\n";
