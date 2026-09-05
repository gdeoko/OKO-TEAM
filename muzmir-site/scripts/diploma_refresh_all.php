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
    if (preg_match('~^--([a-z-]+)(?:=(.*))?$~', $arg, $m)) $opt[$m[1]] = $m[2] ?? '1';
}
$dry     = isset($opt['dry']);
$limit   = (int) ($opt['limit'] ?? 0);
$fromId  = (int) ($opt['from'] ?? 0);
$types   = array_filter(array_map('trim', explode(',', (string) ($opt['type'] ?? ''))));
$comps   = array_filter(array_map('intval', explode(',', (string) ($opt['comp'] ?? ''))));
$doClean = isset($opt['clean']);
/* --only-clean: пропустить дипломы участников и заняться только чистыми
 * бланками. Нужно, когда дипломы уже перерисованы: без этого скрипт гонит
 * все 252 бланка по второму разу и тратит час впустую. */
$onlyClean = isset($opt['only-clean']);
if ($onlyClean) $doClean = true;

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

printf("Наградных материалов к перерисовке: %d%s\n", $onlyClean ? 0 : count($rows), $dry ? ' (сухой прогон)' : '');

$ok = $fail = $same = 0;
$t0 = microtime(true);
foreach ($onlyClean ? [] : $rows as $i => $d) {
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
if (!$dry && !$onlyClean) {
    $n = 0;
    foreach (glob(BASE_PATH . '/public/diplomas/preview_*.png') ?: [] as $f) { @unlink($f); $n++; }
    printf("Старых картинок-предпросмотров убрано: %d (соберутся заново при показе)\n", $n);
}

/* ЧИСТЫЕ БЛАНКИ ДЛЯ ПРОИЗВОДСТВА.
 * По ним печатают оригиналы: подписи и печать ставятся живьём, поэтому бланк
 * собирается отдельно (clean=1) и лежит вне веб-корня.
 *
 * ИДЁМ ОТ ФАЙЛОВ, А НЕ ОТ РЕЕСТРА. Имя файла складывается из номера ЗАЯВКИ
 * (VR-2026-00031), а в реестре у дополнительного и именного номер свой
 * (VR-2026-00031-E1). Заказ рисует бланк, не подставляя реестровый номер, —
 * значит и мы не должны: иначе выйдет файл с другим именем, а админка
 * продолжит показывать прежний, нетронутый. Ссылки на бланки закэшированы в
 * awards_orders.clean_pdfs по имени файла, и менять его нельзя.
 * На самом бланке номер печатается верный: его считает маршрут печати
 * (diploma_make_number), а не имя файла. */
if ($doClean) {
    $dir = BASE_PATH . '/data/clean_blanks';
    $files = glob($dir . '/*.pdf') ?: [];
    printf("\nЧистых бланков на диске: %d\n", count($files));
    $cok = $cfail = $cskip = 0;
    $t1 = microtime(true);
    foreach ($files as $n => $f) {
        $base = basename($f, '.pdf');                       // diploma_vr-2026-00031-extra-clean
        if (!preg_match('~^diploma_(.+?)-(main|extra|named|thanks)(?:-([0-9a-f]{6}))?-clean$~', $base, $m)) {
            $cskip++; continue;
        }
        [, $slugNum, $type, $tag] = $m + [3 => ''];
        /* В ИМЕНИ ФАЙЛА — НОМЕР ДОКУМЕНТА, А НЕ НОМЕР ЗАЯВКИ.
         *
         * Бланк называется по номеру из реестра (diploma_make_number): у
         * основного он совпадает с номером заявки, а у благодарности и
         * именного к нему дописан хвост — «VR-2026-00064-T», «-N2». Скрипт
         * искал заявку по всей строке, такой заявки нет — и 22 бланка молча
         * оставались старыми: у одного участника благодарность собрана по
         * новому ритму, а именной по прежнему.
         *
         * Ищем по реестру наградных документов. Заодно оттуда берётся и ФИО
         * получателя (у благодарности и именного оно лежит в result), так что
         * подбирать его перебором и отпечатком больше не нужно. */
        $docNum = mb_strtoupper($slugNum);
        $doc = one("SELECT * FROM diplomas WHERE UPPER(number)=?", [$docNum]);
        $a = $doc ? one("SELECT * FROM applications WHERE id=?", [(int) $doc['application_id']]) : null;
        if (!$a) $a = one("SELECT * FROM applications WHERE UPPER(number)=?", [$docNum]);
        if (!$a) {
            printf("  %s — ни документа, ни заявки с номером %s (осиротевший бланк)\n", basename($f), $docNum);
            $cskip++; continue;
        }

        $o = ['clean' => true, 'extra' => $type === 'extra',
              'thanks' => $type === 'thanks', 'named' => $type === 'named'];
        /* У благодарности и именного в имени файла зашиты первые шесть знаков
         * md5 от ФИО. Перебираем кандидатов заявки и берём того, чей отпечаток
         * совпал: только так бланк перерисуется в ТОТ ЖЕ файл. */
        if ($tag !== '' && ($type === 'thanks' || $type === 'named')) {
            $cands = [];
            // Имя получателя из самой строки реестра — самый точный источник.
            if ($doc && trim((string) $doc['result']) !== '') $cands[] = trim((string) $doc['result']);
            foreach (all("SELECT result FROM diplomas WHERE application_id=? AND type=?",
                         [(int) $a['id'], $type]) as $d) {
                $r = trim((string) $d['result']);
                if ($r !== '') $cands[] = $r;
            }
            foreach ([$a['full_name'] ?? '', $a['teacher'] ?? ''] as $extra) {
                foreach (preg_split('~\s*,\s*~u', (string) $extra) ?: [] as $x) {
                    $x = trim($x); if ($x !== '') $cands[] = $x;
                }
            }
            $found = '';
            foreach (array_unique($cands) as $c) {
                if (substr(md5($c), 0, 6) === $tag) { $found = $c; break; }
            }
            if ($found === '') { $cskip++; continue; }       // чужое имя не подставляем
            $o['person'] = $found;
            if ($type === 'thanks') $o['person_idx'] = diploma_person_index((string) ($a['teacher'] ?? ''), $found);
        }

        if ($dry) { printf("  %s → %s %s\n", basename($f), $type, $o['person'] ?? ''); continue; }
        try { $p = diploma_pdf_html((array) $a, $o); } catch (\Throwable $e) { $p = null; }
        if ($p && basename((string) $p) === basename($f)) $cok++;
        elseif ($p) { $cok++; printf("  %s — собрался под именем %s\n", basename($f), basename((string) $p)); }
        else { $cfail++; printf("  %s — НЕ СОБРАЛСЯ\n", basename($f)); }

        if (($n + 1) % 20 === 0) printf("  … %d из %d, %.0f c\n", $n + 1, count($files), microtime(true) - $t1);
    }
    printf("Чистых бланков перерисовано: %d, не собралось: %d, пропущено (не опознан): %d, за %.0f мин\n",
           $cok, $cfail, $cskip, (microtime(true) - $t1) / 60);
}
