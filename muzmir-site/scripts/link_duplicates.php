<?php
/**
 * ЗАЯВКИ С ОДНОЙ И ТОЙ ЖЕ ССЫЛКОЙ.
 *
 * Правило «одна ссылка — одна заявка в конкурсе» теперь проверяется при подаче,
 * но в базе уже лежит то, что успело пройти: школа искусств подала 37 заявок на
 * разных детей, а ссылка во всех одна — общая папка облака со всеми рисунками.
 * Оценить такое нельзя: по ссылке открывается список файлов, и какая работа чья,
 * непонятно.
 *
 * Скрипт показывает такие группы и готовит причину отклонения словами положения.
 * Сам ничего не отклоняет: за отклонением идёт возврат оргвзноса и письмо
 * участнику, и решение об этом принимает человек. С ключом --mark причина
 * записывается в разбор — тогда в очереди аттестации у этих заявок сразу видно
 * «Отклонить» и за что, а отклонить их можно обычной кнопкой.
 *
 *   php scripts/link_duplicates.php          — показать группы
 *   php scripts/link_duplicates.php --mark   — проставить причину в подсказку
 */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { fwrite(STDERR, "CLI only\n"); exit(1); }

define('BASE_PATH', dirname(__DIR__));
$GLOBALS['CFG'] = require BASE_PATH . '/config.php';
require_once BASE_PATH . '/core/db.php';
require_once BASE_PATH . '/core/helpers.php';
require_once BASE_PATH . '/core/link_unique.php';

$mark = in_array('--mark', $argv, true);
$line = str_repeat('=', 78);
echo "ЗАЯВКИ С ОДИНАКОВЫМИ ССЫЛКАМИ\n$line\n";

$rows = all("SELECT a.id, a.number, a.competition_id, a.email, a.full_name, a.group_name,
                    a.work_title, a.video_url, a.status, c.name comp
               FROM applications a
               LEFT JOIN competitions c ON c.id = a.competition_id
              WHERE COALESCE(a.video_url,'') <> '' AND a.status NOT IN ('rejected','draft')
           ORDER BY a.id");

$groups = [];
foreach ($rows as $r) {
    $key = (int) $r['competition_id'] . '|' . lu_norm((string) $r['video_url']);
    $groups[$key][] = $r;
}
$dups = array_values(array_filter($groups, static fn(array $g): bool => count($g) > 1));
usort($dups, static fn(array $a, array $b): int => count($b) <=> count($a));

printf("  групп с повторяющейся ссылкой: %d\n\n", count($dups));

$marked = 0;
foreach ($dups as $g) {
    $first = $g[0];
    printf("  %d заявок · конкурс «%s»\n    %s\n", count($g), mb_substr((string) $first['comp'], 0, 30),
           mb_substr((string) $first['video_url'], 0, 70));
    $mails = array_values(array_unique(array_map(static fn(array $r): string => mb_strtolower((string) $r['email']), $g)));
    printf("    почты: %s\n", implode(', ', array_map(static fn(string $m): string => mb_substr($m, 0, 28), array_slice($mails, 0, 3)))
           . (count($mails) > 3 ? ' и ещё ' . (count($mails) - 3) : ''));

    $fold = lu_is_folder((string) $first['video_url']);
    $why = $fold['folder']
        ? (string) $fold['why'] . ' Одна заявка — один конкурсный материал (п. 8.1 положения): нужна ссылка на саму работу участника.'
        : 'Одна и та же ссылка подана в этом конкурсе несколько раз. Одна заявка — один конкурсный материал '
          . '(п. 8.1 положения): для каждой работы нужна отдельная ссылка.';
    printf("    причина: %s\n", mb_substr($why, 0, 110));

    /* Первую заявку группы не трогаем: одна из них законна, и решать, какая
       именно, должен человек — он видит названия работ и переписку. */
    foreach (array_slice($g, 1) as $r) {
        printf("      #%-5d %-16s %-24s %s\n", (int) $r['id'], (string) $r['number'],
               mb_substr(trim((string) ($r['group_name'] ?: $r['full_name'])), 0, 24),
               mb_substr((string) $r['work_title'], 0, 26));
        if (!$mark) continue;
        try {
            $run = one("SELECT id FROM grading_runs WHERE application_id=? ORDER BY id DESC LIMIT 1", [(int) $r['id']]);
            if ($run) {
                update('grading_runs', ['reject_hint' => mb_substr($why, 0, 900)], 'id=:id', ['id' => (int) $run['id']]);
            } else {
                insert('grading_runs', ['application_id' => (int) $r['id'], 'status' => 'failed',
                                        'error' => mb_substr($why, 0, 500), 'reject_hint' => mb_substr($why, 0, 900)]);
            }
            $marked++;
        } catch (\Throwable $e) { /* подсказка не важнее заявки */ }
    }
    echo "\n";
}

echo "$line\n";
printf("  заявок помечено причиной: %d\n", $marked);
echo $mark
    ? "  причины проставлены — они видны в очереди аттестации и в карточке заявки\n"
    : "  это предпросмотр: php scripts/link_duplicates.php --mark\n";
