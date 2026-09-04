<?php
/**
 * ПЕРЕРИСОВКА УЖЕ ВЫДАННЫХ НАГРАДНЫХ МАТЕРИАЛОВ ПОД ВЫВЕРЕННЫЙ БЛАНК.
 *
 *   php scripts/diploma_refresh_all.php [--dry] [--limit=N] [--type=main,extra,named,thanks]
 *                                       [--comp=18,21] [--clean] [--from=ID]
 *
 * Зачем. Бланк выверен: просветы между разделами выровнены, длинные строки не
 * режутся краем, текст благодарности не лезет на подписи. Но у участников на
 * руках и в кабинете лежат ФАЙЛЫ, нарисованные старой вёрсткой. Здесь они
 * перерисовываются тем же боевым движком, что и новые.
 *
 * ЧЕГО СКРИПТ НЕ ДЕЛАЕТ — И ЭТО ГЛАВНОЕ:
 *   • не трогает sent_at, queue_id, send_tries и scheduled_at;
 *   • не ставит письма в очередь и никому ничего не отправляет;
 *   • не меняет номера дипломов (они напечатаны в реестре и в QR);
 *   • не создаёт и не удаляет строки в diplomas.
 * Меняется только сам PDF-файл и, если имя изменилось, поле pdf_path.
 *
 * Так сделано намеренно: dsync_rebuild() при переделке СБРАСЫВАЕТ sent_at и
 * ставит диплом на повторную отправку. Для массового обновления вёрстки это
 * означало бы полторы сотни писем участникам ни за что.
 */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { fwrite(STDERR, "CLI only\n"); exit(1); }

define('BASE_PATH', dirname(__DIR__));
$GLOBALS['CFG'] = require BASE_PATH . '/config.php';
require_once BASE_PATH . '/core/db.php';
require_once BASE_PATH . '/core/helpers.php';
require_once BASE_PATH . '/core/diploma_html.php';
require_once BASE_PATH . '/core/diploma_render.php';
if (is_file(BASE_PATH . '/core/mentors.php')) require_once BASE_PATH . '/core/mentors.php';

/** Разбор ключей вида --key=value. */
$opt = [];
foreach (array_slice($argv, 1) as $arg) {
    if (preg_match('~^--([a-z]+)(?:=(.*))?$~', $arg, $m)) $opt[$m[1]] = $m[2] ?? '1';
}
$dry     = isset($opt['dry']);
$limit   = (int) ($opt['limit'] ?? 0);
$fromId  = (int) ($opt['from'] ?? 0);
$types   = array_filter(array_map('trim', explode(',', (string) ($opt['type'] ?? ''))));
$comps   = array_filter(array_map('intval', explode(',', (string) ($opt['comp'] ?? ''))));
$doClean = isset($opt['clean']);

/**
 * Номер педагога в списке заявки: бланк благодарности обязан совпасть с реестром.
 * Функция живёт в cron/send_diplomas.php, но тянуть весь крон сюда нельзя.
 */
if (!function_exists('diploma_person_index')) {
    function diploma_person_index(string $rawTeachers, string $person): int {
        $person = mb_strtolower(trim($person));
        if ($person === '') return 0;
        $list = [];
        if (function_exists('mentors_parse') && str_contains($rawTeachers, ':')) {
            foreach (mentors_parse($rawTeachers) as $m) $list[] = trim((string) $m['fio']);
        }
        if (!$list) {
            [, $joined] = _dh_teachers($rawTeachers);
            $list = array_values(array_filter(array_map('trim', explode(',', $joined))));
        }
        foreach ($list as $i => $f) {
            if (mb_strtolower($f) === $person || str_contains($person, mb_strtolower($f))) return $i + 1;
        }
        return 0;
    }
}

$where = ["1=1"];
$args  = [];
if ($types)  { $where[] = 'd.type IN (' . implode(',', array_fill(0, count($types), '?')) . ')'; $args = array_merge($args, $types); }
if ($comps)  { $where[] = 'a.competition_id IN (' . implode(',', array_fill(0, count($comps), '?')) . ')'; $args = array_merge($args, $comps); }
if ($fromId) { $where[] = 'd.id >= ?'; $args[] = $fromId; }

$rows = all("SELECT d.*, a.competition_id, a.number app_number
             FROM diplomas d JOIN applications a ON a.id = d.application_id
             WHERE " . implode(' AND ', $where) . "
             ORDER BY d.id" . ($limit > 0 ? " LIMIT " . $limit : ""), $args);

printf("Наградных материалов к перерисовке: %d%s\n", count($rows), $dry ? ' (сухой прогон)' : '');

$ok = $fail = $same = 0;
$t0 = microtime(true);
foreach ($rows as $i => $d) {
    $a = one("SELECT * FROM applications WHERE id=?", [(int) $d['application_id']]);
    if (!$a) { $fail++; continue; }

    $type = (string) ($d['type'] ?? 'main');
    $who  = trim((string) ($d['result'] ?? ''));
    $o = ['extra' => $type === 'extra', 'thanks' => $type === 'thanks', 'named' => $type === 'named'];
    // Номер бланка обязан совпасть с реестром, иначе QR ведёт в «не найдено».
    $a['diploma_number'] = (string) ($d['number'] ?? '');
    if (($type === 'named' || $type === 'thanks') && $who !== '') {
        $o['person'] = $who;
        if ($type === 'thanks') $o['person_idx'] = diploma_person_index((string) ($a['teacher'] ?? ''), $who);
    }

    $old = (string) ($d['pdf_path'] ?? '');
    if ($dry) {
        printf("  [%d/%d] №%s %-6s конкурс %-3s — %s\n", $i + 1, count($rows), (string) $d['number'],
               $type, (string) $d['competition_id'], $old !== '' ? basename($old) : 'файла нет');
        continue;
    }

    $new = null;
    try { $new = diploma_pdf_html((array) $a, $o); } catch (\Throwable $e) { $new = null; }
    if (!$new) {
        $fail++;
        printf("  [%d/%d] №%s %-6s — НЕ СОБРАЛСЯ\n", $i + 1, count($rows), (string) $d['number'], $type);
        continue;
    }
    // Путь в базе хранится веб-адресом (/diplomas/...), а рендер отдаёт файл на диске.
    $web = '/diplomas/' . basename((string) $new);
    if ($web !== $old) {
        update('diplomas', ['pdf_path' => $web], 'id=:id', ['id' => (int) $d['id']]);
        $ok++;
    } else { $same++; $ok++; }

    if (($i + 1) % 10 === 0) {
        $el = microtime(true) - $t0;
        printf("  … %d из %d, %.0f c, осталось примерно %.0f мин\n",
               $i + 1, count($rows), $el, ($el / ($i + 1)) * (count($rows) - $i - 1) / 60);
    }
}
printf("Перерисовано: %d (из них имя файла не менялось: %d), не собралось: %d, за %.0f мин\n",
       $ok, $same, $fail, (microtime(true) - $t0) / 60);

/* КАРТИНКИ-ПРЕДПРОСМОТРЫ ЛЕЖАТ КЭШЕМ И САМИ НЕ ОБНОВЛЯЮТСЯ.
 * В кабинете и в письме показывается не сам PDF, а его первая страница
 * картинкой (preview_<номер>-1.png). Рисуется она один раз: «файла нет —
 * рисуем». После перерисовки бланка картинка осталась бы старой, и человек
 * видел бы прежнюю кривую вёрстку, хотя в PDF уже всё выправлено. Сносим —
 * они соберутся заново при первом показе. */
if (!$dry) {
    $n = 0;
    foreach (glob(BASE_PATH . '/public/diplomas/preview_*.png') ?: [] as $f) { @unlink($f); $n++; }
    printf("Старых картинок-предпросмотров убрано: %d (соберутся заново при показе)\n", $n);
}

/* ЧИСТЫЕ БЛАНКИ ДЛЯ ПРОИЗВОДСТВА.
 * По ним печатают оригиналы: подписи и печать ставятся живьём, поэтому бланк
 * собирается отдельно (clean=1) и лежит вне веб-корня. Их вёрстка та же и
 * обновляться должна вместе с остальными. */
if ($doClean) {
    $dir = BASE_PATH . '/data/clean_blanks';
    $files = glob($dir . '/*.pdf') ?: [];
    printf("\nЧистых бланков на диске: %d\n", count($files));
    $seen = [];
    $cok = $cfail = 0;
    $t1 = microtime(true);
    foreach ($rows as $i => $d) {
        $a = one("SELECT * FROM applications WHERE id=?", [(int) $d['application_id']]);
        if (!$a) continue;
        $type = (string) ($d['type'] ?? 'main');
        $who  = trim((string) ($d['result'] ?? ''));
        $o = ['clean' => true, 'extra' => $type === 'extra', 'thanks' => $type === 'thanks', 'named' => $type === 'named'];
        $a['diploma_number'] = (string) ($d['number'] ?? '');
        if (($type === 'named' || $type === 'thanks') && $who !== '') {
            $o['person'] = $who;
            if ($type === 'thanks') $o['person_idx'] = diploma_person_index((string) ($a['teacher'] ?? ''), $who);
        }
        // Перерисовываем только те бланки, которые уже существуют: остальные
        // соберутся сами в час производства, лишние файлы плодить незачем.
        $probe = $dir . '/diploma_' . strtolower((string) preg_replace('/[^a-z0-9]+/i', '-',
                 (string) $d['number'] . '-' . $type)) . '-clean.pdf';
        $exists = false;
        foreach ($files as $f) {
            if (str_contains(basename($f), strtolower((string) preg_replace('/[^a-z0-9]+/i', '-', (string) $d['number'])))) { $exists = true; break; }
        }
        if (!$exists) continue;
        if ($dry) { printf("  чистый бланк №%s %s\n", (string) $d['number'], $type); continue; }
        try { $p = diploma_pdf_html((array) $a, $o); } catch (\Throwable $e) { $p = null; }
        if ($p) $cok++; else { $cfail++; printf("  чистый бланк №%s — НЕ СОБРАЛСЯ\n", (string) $d['number']); }
    }
    printf("Чистых бланков перерисовано: %d, не собралось: %d, за %.0f мин\n", $cok, $cfail, (microtime(true) - $t1) / 60);
}
