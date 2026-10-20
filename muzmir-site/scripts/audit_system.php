<?php
/**
 * ОБЩИЙ АУДИТ СИСТЕМЫ: ГДЕ ЧТО-ТО ПОШЛО НЕ ТАК.
 *
 * audit_awards.php смотрит заказы наград. Этот — всё остальное: заявки, оценку,
 * выдачу документов, почту, кроны и деньги участников. Проверки написаны по
 * разобранным поломкам, а не по общим соображениям: каждая ловит то, что уже
 * случалось или может случиться завтра по той же причине.
 *
 * Только чтение. Запуск: php scripts/audit_system.php
 */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { fwrite(STDERR, "CLI only\n"); exit(1); }

define('BASE_PATH', dirname(__DIR__));
$GLOBALS['CFG'] = require BASE_PATH . '/config.php';
require_once BASE_PATH . '/core/db.php';
require_once BASE_PATH . '/core/helpers.php';

$line = str_repeat('=', 78);
$problems = 0;
$say  = static function (string $t): void { echo $t . "\n"; };
$head = static function (string $t) use ($line, $say): void { $say("\n$line\n$t\n$line"); };
$n    = static fn(string $s, array $a = []) => (int) scalar($s, $a);

/* ─────────────────────────────────────────────────────────────────────────── */
$head('1. ОЦЕНЕНО, НО ДОКУМЕНТОВ НЕТ (платный конкурс: они входят в участие)');
$bad = 0;
foreach (all("SELECT a.number, a.email, a.result, c.name cname
                FROM applications a JOIN competitions c ON c.id=a.competition_id
               WHERE a.status <> 'rejected' AND COALESCE(a.result,'') <> ''
                 AND c.is_paid = 1 AND a.is_paid = 1
                 AND NOT EXISTS (SELECT 1 FROM diplomas d WHERE d.application_id=a.id AND d.type='main')
               LIMIT 20") as $r) {
    $bad++; $problems++;
    printf("  %-16s %-28s %-22s %s\n", (string) $r['number'], mb_substr((string) $r['email'], 0, 28),
        (string) $r['result'], mb_substr((string) $r['cname'], 0, 18));
}
if (!$bad) $say('  чисто: у всех оплаченных заявок платных конкурсов есть основной диплом');

/* ─────────────────────────────────────────────────────────────────────────── */
$head('2. ДОКУМЕНТ ЕСТЬ, А ОТПРАВЛЯТЬ ЕГО НЕКОГДА (нет срока и не отправлен)');
$bad = $n("SELECT COUNT(*) FROM diplomas WHERE COALESCE(sent_at,'')='' AND COALESCE(scheduled_at,'')=''");
if ($bad > 0) {
    $problems++;
    printf("  документов без срока отправки: %d\n", $bad);
    foreach (all("SELECT d.number, a.email FROM diplomas d JOIN applications a ON a.id=d.application_id
                   WHERE COALESCE(d.sent_at,'')='' AND COALESCE(d.scheduled_at,'')='' LIMIT 10") as $r)
        printf("      %-22s %s\n", (string) $r['number'], mb_substr((string) $r['email'], 0, 30));
} else $say('  чисто: у каждого неотправленного документа есть срок');

/* ─────────────────────────────────────────────────────────────────────────── */
$head('3. ПИСЬМА, КОТОРЫЕ НЕ УШЛИ');
$err = $n("SELECT COUNT(*) FROM mail_queue WHERE status='error'");
$stuck = $n("SELECT COUNT(*) FROM mail_queue WHERE status='queued'
              AND datetime(created_at) < datetime('now','localtime','-1 day')");
printf("  с ошибкой: %d | висят в очереди больше суток: %d\n", $err, $stuck);
if ($err + $stuck > 0) {
    $problems++;
    foreach (all("SELECT substr(subject,1,44) s, status, COUNT(*) c, MAX(error) e FROM mail_queue
                   WHERE status='error' OR (status='queued' AND datetime(created_at) < datetime('now','localtime','-1 day'))
                   GROUP BY s, status ORDER BY c DESC LIMIT 8") as $r)
        printf("      %-9s %4d  %-44s %s\n", (string) $r['status'], (int) $r['c'], (string) $r['s'],
            mb_substr((string) ($r['e'] ?? ''), 0, 40));
} else $say('  чисто: непрошедших писем нет');

/* ─────────────────────────────────────────────────────────────────────────── */
$head('4. ПИСЬМА ТЕМ, КТО ОТПИСАЛСЯ ИЛИ В СТОП-ЛИСТЕ');
$bad = 0;
try {
    $bad = $n("SELECT COUNT(*) FROM mail_queue q
                WHERE q.status='queued'
                  AND EXISTS (SELECT 1 FROM mail_stop s WHERE mb_lower(s.email)=mb_lower(q.to_email))");
} catch (\Throwable $e) { $bad = 0; }
if ($bad > 0) { $problems++; printf("  в очереди писем на адреса из стоп-листа: %d\n", $bad); }
else $say('  чисто: в очереди нет писем на закрытые адреса');

/* ─────────────────────────────────────────────────────────────────────────── */
$head('5. КРОНЫ: КТО МОЛЧИТ ДОЛЬШЕ ПОЛОЖЕННОГО');
$expect = [   // задание => сколько часов допустимо молчать
    'process_newsletter_queue' => 2,
    'send_diplomas'            => 30,   // шлёт по срокам, волнами: сутки тишины — норма
    'reconcile_payments'       => 2,
    'ai_grade'                 => 12,
    'inbox_actions'            => 12,
];
$bad = 0;
/* Журнал заданий — файл data/logs/cron.log (cron_log() пишет строкой), таблицы
 * для него в проекте нет. Читаем хвост файла: последняя отметка каждого задания. */
$logFile = BASE_PATH . '/data/logs/cron.log';
$lastSeen = [];
if (is_file($logFile)) {
    $fh = @fopen($logFile, 'rb');
    if ($fh) {
        // Хвоста в мегабайт хватает на несколько суток работы.
        $size = filesize($logFile) ?: 0;
        if ($size > 1048576) fseek($fh, -1048576, SEEK_END);
        while (($ln = fgets($fh)) !== false) {
            if (!preg_match('~^\[([\d\-: ]+)\]\s+\[([a-z0-9_]+)\]~i', $ln, $m)) continue;
            $ts = strtotime($m[1]);
            if (!$ts) continue;
            $j = $m[2];
            if (!isset($lastSeen[$j]) || $ts > $lastSeen[$j]) $lastSeen[$j] = $ts;
        }
        fclose($fh);
    }
}
/* Не всякое задание пишет в общий журнал: send_diplomas отчитывается в свой лог
 * (/var/log/muzmir_send_diplomas.log) и в базу — по нему судим о работе иначе,
 * по факту последней отправки. Иначе аудит поднимает ложную тревогу о задании,
 * которое как раз работает. */
$lastSent = strtotime((string) scalar("SELECT MAX(sent_at) FROM diplomas WHERE COALESCE(sent_at,'')<>''"));
if ($lastSent) $lastSeen['send_diplomas'] = max($lastSeen['send_diplomas'] ?? 0, $lastSent);

foreach ($expect as $job => $hours) {
    if (!isset($lastSeen[$job])) { $bad++; $problems++; printf("  %-26s в журнале нет ни одной отметки\n", $job); continue; }
    $ago = (time() - $lastSeen[$job]) / 3600;
    if ($ago > $hours) { $bad++; $problems++; printf("  %-26s молчит %.1f ч (норма %d ч)\n", $job, $ago, $hours); }
}
if (!$bad) $say('  чисто: все ключевые задания отчитывались вовремя');

/* ─────────────────────────────────────────────────────────────────────────── */
$head('6. ДЕНЬГИ УЧАСТНИКА: ОПЛАЧЕНО, НО ЗАЯВКА НЕ ОТМЕЧЕНА');
/* СУДИМ ПО КАССЕ, А НЕ ПО `amount_paid`. В этом поле лежит сумма ПОПЫТКИ, и она
   остаётся там после отмены и после возврата: по нему пять заявок годами читались
   как «деньги внесены, отметки нет», хотя три возвращены пачкой 31.08.2026, а две
   это отменённые попытки того же дня. Красное на ровном месте прячет настоящие
   отказы (правило 47), а деньги участника как раз та строка, которую нельзя
   приучаться пролистывать. Беда это УДАЧНЫЙ и НЕ возвращённый платёж при
   незакрытом взносе - остальное печатается справкой. */
$bad = 0; $попыток = 0;
foreach (all("SELECT a.number, a.email, a.amount_paid, a.is_paid, a.status, c.name cname, c.price,
                     (SELECT COUNT(*) FROM payments p WHERE p.application_id = a.id
                        AND p.status = 'succeeded' AND COALESCE(p.refunds,'') IN ('','[]')) успешных
                FROM applications a JOIN competitions c ON c.id=a.competition_id
               WHERE c.is_paid=1 AND COALESCE(a.amount_paid,0) > 0 AND COALESCE(a.is_paid,0) = 0
               LIMIT 30") as $r) {
    if ((int) $r['успешных'] > 0) {
        $bad++; $problems++;
        printf("  %-16s %-28s в кассе %s ₽ принято, заявка числится неоплаченной\n",
            (string) $r['number'], mb_substr((string) $r['email'], 0, 28), (string) $r['amount_paid']);
    } else {
        $попыток++;
    }
}
if (!$bad) $say('  чисто: принятых кассой денег без отметки в заявке нет');
if ($попыток) $say('  справка: заявок с суммой попытки без удачного платежа (отменён или возвращён) — ' . $попыток);

/* ─────────────────────────────────────────────────────────────────────────── */
$head('7. ОДНА ССЫЛКА В ОДНОМ КОНКУРСЕ У РАЗНЫХ ЗАЯВОК (п. 8.1)');
$bad = 0;
foreach (all("SELECT competition_id, video_url, COUNT(*) c, GROUP_CONCAT(number) nums
                FROM applications
               WHERE COALESCE(video_url,'') <> '' AND status NOT IN ('rejected','draft')
            GROUP BY competition_id, video_url HAVING c > 1 ORDER BY c DESC LIMIT 12") as $r) {
    $bad++; $problems++;
    printf("  конкурс %-3s: %d заявок с одной ссылкой — %s\n", (string) $r['competition_id'],
        (int) $r['c'], mb_substr((string) $r['nums'], 0, 56));
}
if (!$bad) $say('  чисто: повторов ссылок внутри конкурса нет');

/* ─────────────────────────────────────────────────────────────────────────── */
$head('8. ДУБЛИ В ДАННЫХ БЛАНКА');
$bad = 0;
require_once BASE_PATH . '/core/text_format.php';
foreach (all("SELECT number, institution, city, teacher, full_name, group_name FROM applications
               WHERE COALESCE(institution,'')<>'' AND COALESCE(city,'')<>''") as $r) {
    $clean = institution_clean_city((string) $r['institution'], (string) $r['city']);
    if ($clean !== (string) $r['institution']) continue;    // это правило уже разберёт
    // Город остался внутри названия и не режется (кавычки/прилагательное) — не ошибка,
    // но педагог, совпавший с участником, — ошибка ввода.
    $t = mb_strtolower(trim((string) $r['teacher']));
    $f = mb_strtolower(trim((string) ($r['full_name'] ?: $r['group_name'])));
    /* Взрослый солист сам себе педагог — это не ошибка, а обычное дело: он подаёт
     * заявку за себя. На бланк такая строка больше не попадает (diploma_html.php
     * пропускает педагога, совпавшего с награждаемым), поэтому здесь просто
     * справка, а не проблема — иначе аудит будет вечно красным на ровном месте. */
    if ($t !== '' && $t === $f) $bad++;
}
if ($bad) printf("  справка: заявок, где участник сам себе педагог — %d. На бланке строка «Педагог»\n"
               . "  у них не печатается, дубля имени нет.\n", $bad);
else $say('  чисто: педагог и участник не путаются местами');

/* ─────────────────────────────────────────────────────────────────────────── */
$head('9. УЧЁТНЫЕ ЗАПИСИ: ОДИН ЧЕЛОВЕК — НЕСКОЛЬКО КАБИНЕТОВ');
$bad = 0;
foreach (all("SELECT mb_lower(email) e, COUNT(*) c FROM users
               WHERE COALESCE(email,'') <> '' GROUP BY e HAVING c > 1 LIMIT 10") as $r) {
    $bad++; $problems++;
    printf("  %-34s кабинетов: %d\n", (string) $r['e'], (int) $r['c']);
}
if (!$bad) $say('  чисто: на один адрес один кабинет');

/* ─────────────────────────────────────────────────────────────────────────── */
$head('10. КОНКУРСЫ: СРОКИ И РЕЖИМЫ');
$bad = 0;
foreach (all("SELECT id, name, status, end_date, results_date, results_mode, results_published_at
                FROM competitions ORDER BY id DESC LIMIT 12") as $c) {
    $why = [];
    if (trim((string) $c['end_date']) === '') $why[] = 'нет даты закрытия приёма';
    if ((string) $c['status'] === 'open' && trim((string) $c['end_date']) !== ''
        && strtotime((string) $c['end_date']) < time()) $why[] = 'приём открыт, а дата прошла';
    if ((string) $c['results_mode'] === 'list' && (string) $c['status'] === 'closed'
        && trim((string) $c['results_published_at']) === ''
        && trim((string) $c['results_date']) !== '' && strtotime((string) $c['results_date']) < time())
        $why[] = 'день итогов прошёл, а публикации нет';
    if (!$why) continue;
    $bad++; $problems++;
    printf("  #%-3d %-24s %s\n", (int) $c['id'], mb_substr((string) $c['name'], 0, 24), implode('; ', $why));
}
if (!$bad) $say('  чисто: сроки конкурсов согласованы');

$say("\n$line");
/* ─────────────────────────────────────────────────────────────────────────── */
$head('14. ВЫЗОВЫ update() С ПОЗИЦИОННОЙ ПОДСТАНОВКОЙ (меняют НОЛЬ строк молча)');
$плохо = 0;
$свой  = realpath(__FILE__);
foreach (['core', 'cron', 'admin', 'api', 'scripts', 'templates', 'public'] as $dir) {
    $путь = BASE_PATH . '/' . $dir;
    if (!is_dir($путь)) continue;
    $это = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($путь, FilesystemIterator::SKIP_DOTS));
    foreach ($это as $f) {
        if (!$f->isFile() || strtolower($f->getExtension()) !== 'php') continue;
        if (realpath($f->getPathname()) === $свой) continue;   // в разборе ниже сам шаблон написан кодом
        $src = (string) @file_get_contents($f->getPathname());
        if (strpos($src, "update(") === false) continue;
        /* Пояснения снимаем лексером, а не регуляркой: в админке «/*» живёт и в
           строках, и в CSS, и вырезка «от звёздочки до звёздочки» съедает живой
           код (правило 63). */
        $чисто = '';
        foreach (token_get_all($src) as $t) {
            if (is_array($t) && in_array($t[0], [T_COMMENT, T_DOC_COMMENT], true)) continue;
            $чисто .= is_array($t) ? $t[1] : $t;
        }
        $поз = 0;
        while (($поз = strpos($чисто, 'update(', $поз)) !== false) {
            $до = $поз > 0 ? $чисто[$поз - 1] : ' ';
            if (preg_match('~[A-Za-z0-9_$>]~', $до)) { $поз += 7; continue; }  // _update(, ->update(
            /* Условие это ТРЕТИЙ аргумент, а во втором лежит массив со своими
               запятыми и скобками - поэтому идём по скобкам, а не шаблоном. */
            $i = $поз + 7; $гл = 1; $арг = ''; $части = [];
            $len = strlen($чисто);
            while ($i < $len && $гл > 0) {
                $c = $чисто[$i];
                if ($c === '(' || $c === '[') $гл++;
                elseif ($c === ')' || $c === ']') { $гл--; if ($гл === 0) break; }
                elseif ($c === "'" || $c === '"') {        // строку перескакиваем целиком
                    $кав = $c; $арг .= $c; $i++;
                    while ($i < $len) {
                        if ($чисто[$i] === '\\') { $арг .= substr($чисто, $i, 2); $i += 2; continue; }
                        $арг .= $чисто[$i];
                        if ($чисто[$i] === $кав) break;
                        $i++;
                    }
                    $i++; continue;
                }
                if ($c === ',' && $гл === 1) { $части[] = $арг; $арг = ''; $i++; continue; }
                $арг .= $c; $i++;
            }
            $части[] = $арг;
            $усл = isset($части[2]) ? trim($части[2]) : '';
            if ($усл !== '' && strpos($усл, '?') !== false) {
                $стр = substr_count(substr($чисто, 0, $поз), "\n") + 1;
                $say('  ОШИБКА ' . $dir . '/' . $f->getFilename() . ' (около строки ' . $стр
                     . '): условие ' . trim($усл) . ' - поменяет ноль строк молча');
                $плохо++;
            }
            $поз += 7;
        }
    }
}
if ($плохо === 0) {
    $say('  ok: все вызовы update() идут именованными подстановками');
} else {
    $problems += $плохо;
}
/* И сам помощник обязан падать, а не молчать. */
try {
    update('settings', ['value' => 'x'], 'key=?', ['нет-такого-ключа']);
    $say('  ОШИБКА: update() принял «?» в условии - заслон в core/db.php снят');
    $problems++;
} catch (\Throwable $e) {
    $say('  ok: update() отказывается работать с «?» в условии');
}

/* ─────────────────────────────────────────────────────────────────────────── */
$head('15. БЛАНК БЕЗ ЗАЯВКИ: КАРТОЧКА ПОДЛИННОСТИ ОБЯЗАНА ОСТАТЬСЯ ПОЛНОЙ');
require_once BASE_PATH . '/core/app_status.php';
$сироты = all("SELECT d.id, d.number, COALESCE(d.snapshot,'') snap, COALESCE(d.sent_at,'') sent
                 FROM diplomas d
                WHERE COALESCE(d.application_id,0) > 0
                  AND NOT EXISTS(SELECT 1 FROM applications a WHERE a.id = d.application_id)
             ORDER BY d.id");
$безСнимка = 0;
foreach ($сироты as $d) {
    $имя = (string) (diploma_snapshot_read(['snapshot' => $d['snap']])['full_name'] ?? '');
    if (trim((string) $d['snap']) === '') {
        $say('  ОШИБКА ' . $d['number'] . ': заявки нет и снимка нет - страница подлинности'
             . ' ответит «подлинный» с пустой карточкой');
        $безСнимка++;
    } else {
        $say('  ok   ' . $d['number'] . ': заявки нет, но снимок на месте (' . ($имя !== '' ? $имя : 'без имени') . ')');
    }
}
if (!$сироты) $say('  чисто: дипломов без заявки нет');
$problems += $безСнимка;

/* Дверь удаления одна, и мимо неё не удаляют. Скрипты-инструменты и проверки в
   обход ходить могут - они не живой путь человека. */
$мимо = 0;
foreach (['core', 'cron', 'admin', 'api', 'templates', 'public'] as $dir) {
    $путь = BASE_PATH . '/' . $dir;
    if (!is_dir($путь)) continue;
    $это = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($путь, FilesystemIterator::SKIP_DOTS));
    foreach ($это as $f) {
        if (!$f->isFile() || strtolower($f->getExtension()) !== 'php') continue;
        $src = (string) @file_get_contents($f->getPathname());
        if (stripos($src, 'DELETE FROM applications') === false) continue;
        $чисто = '';
        foreach (token_get_all($src) as $t) {
            if (is_array($t) && in_array($t[0], [T_COMMENT, T_DOC_COMMENT], true)) continue;
            $чисто .= is_array($t) ? $t[1] : $t;
        }
        if (stripos($чисто, 'DELETE FROM applications') === false) continue;
        // Сама дверь удаляет по праву - она и есть то место.
        if (strpos($чисто, 'function app_delete(') !== false) continue;
        $say('  ОШИБКА ' . $dir . '/' . $f->getFilename() . ': удаляет заявку мимо двери app_delete()');
        $мимо++;
    }
}
if ($мимо === 0) $say('  ok   все живые места удаляют заявку через app_delete()');
$problems += $мимо;

$двер = (string) @file_get_contents(BASE_PATH . '/core/app_status.php');
if (strpos($двер, 'diploma_snapshot_save($id)') === false) {
    $say('  ОШИБКА: дверь удаления больше не снимает снимок - карточки опустеют молча');
    $problems++;
} else {
    $say('  ok   дверь снимает снимок ДО удаления');
}
$бланк = (string) @file_get_contents(BASE_PATH . '/public/index.php');
$скольк = substr_count($бланк, 'diploma_app_from_snapshot(');
if ($скольк < 2) {
    $say('  ОШИБКА: маршруты бланка (просмотр и файл) не собирают заявку из снимка - лист выйдет пустым');
    $problems++;
} else {
    $say('  ok   оба маршрута бланка собирают заявку из снимка');
}
$вер = (string) @file_get_contents(BASE_PATH . '/api/v1/verify.php');
if (strpos($вер, 'diploma_snapshot_read') === false) {
    $say('  ОШИБКА: проверка подлинности не читает снимок');
    $problems++;
} else {
    $say('  ok   проверка подлинности читает снимок');
}
/* Заказы без заявки оставлены историей - слово владельца 15.10.2026. Это
   справка, а не провал: деньги по ним закрыты, и строка нужна как память. */
$зак = all("SELECT o.id, o.full_name, COALESCE(o.status,'') st FROM awards_orders o
             WHERE COALESCE(o.application_id,0) > 0
               AND NOT EXISTS(SELECT 1 FROM applications a WHERE a.id = o.application_id) ORDER BY o.id");
foreach ($зак as $o) {
    $say('  справка: заказ №' . $o['id'] . ' (' . $o['full_name'] . ', ' . $o['st']
         . ') без заявки - оставлен историей по слову владельца 15.10.2026');
}

printf("ИТОГ: проблем найдено — %d\n", $problems);
$say($line);
