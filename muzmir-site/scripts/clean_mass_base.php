<?php
/**
 * ЧИСТКА БАЗЫ МАССОВЫХ РАССЫЛОК.
 *
 * Правило владельца (19.08.2026): в массовой рассылке не должно остаться никого,
 * кому письмо всё равно не дойдёт или кто его не ждёт:
 *   • нет адреса вовсе;
 *   • адрес синтаксически негодный;
 *   • почтовик прямым текстом сказал, что ящика нет;
 *   • человек отписался, пожаловался на спам или письменно попросил не писать.
 *
 * При этом ЧЕЛОВЕК ОСТАЁТСЯ В СИСТЕМЕ. Уведомления сайта, результаты конкурсов,
 * наградные материалы и напоминания об оплате уходят по-прежнему: их отсекать
 * нельзя, участник за них заплатил. Здесь закрывается только рассылка.
 *
 *   php scripts/clean_mass_base.php            — показать, что будет вычищено
 *   php scripts/clean_mass_base.php --apply    — вычистить
 */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { fwrite(STDERR, "CLI only\n"); exit(1); }

define('BASE_PATH', dirname(__DIR__));
$GLOBALS['CFG'] = require BASE_PATH . '/config.php';
require_once BASE_PATH . '/core/db.php';
require_once BASE_PATH . '/core/helpers.php';
require_once BASE_PATH . '/core/mailer.php';
require_once BASE_PATH . '/core/mail_reputation.php';

$apply = in_array('--apply', $argv, true);
$line  = str_repeat('=', 78);
$n     = static fn($x): string => number_format((int) $x, 0, '.', ' ');

echo "ЧИСТКА БАЗЫ МАССОВЫХ РАССЫЛОК\n$line\n";

/* ── 1. Кого закрываем ── */
$stop = [];      // адрес => причина

// 1.1 Доказанные отказы почтовика.
foreach (all("SELECT DISTINCT LOWER(email) e, COALESCE(comment,'') c FROM mail_events
               WHERE status = 'hard_bounced'") as $r) {
    if (mrep_bounce_is_proof((string) $r['c'])) $stop[(string) $r['e']] = 'ящика не существует';
}
// 1.2 Жалобы и отписки, о которых сообщил сервис рассылок.
foreach (all("SELECT DISTINCT LOWER(email) e, status FROM mail_events
               WHERE status IN ('spam','unsubscribed')") as $r) {
    $stop[(string) $r['e']] = (string) $r['status'] === 'spam' ? 'пожаловался на спам' : 'отписался';
}
// 1.3 Отказы, снятые нами по письмам людей (уже в стоп-листе).
foreach (all("SELECT email, reason FROM mail_stop") as $r) {
    $stop[mb_strtolower((string) $r['email'])] = (string) $r['reason'];
}

printf("  адресов к закрытию: %s\n", $n(count($stop)));

/* ── 2. Учреждения ── */
$instNoMail = (int) scalar("SELECT COUNT(*) FROM institutions
                             WHERE TRIM(COALESCE(email,'')) = '' AND status <> 'excluded'");
$instBad    = 0;
foreach (all("SELECT id, email FROM institutions WHERE TRIM(COALESCE(email,'')) <> ''
               AND status NOT IN ('excluded','bounced','unsubscribed','banned')") as $r) {
    $e = mb_strtolower(trim((string) $r['email']));
    if (!filter_var($e, FILTER_VALIDATE_EMAIL)) { $instBad++; continue; }
    if (isset($stop[$e])) $instBad++;
}
printf("  учреждений без адреса: %s, с закрытым адресом: %s\n", $n($instNoMail), $n($instBad));

/* ── 3. Своя база ── */
$subBad = 0;
foreach (all("SELECT id, email FROM subscribers WHERE active = 1") as $r) {
    $e = mb_strtolower(trim((string) $r['email']));
    if ($e === '' || !filter_var($e, FILTER_VALIDATE_EMAIL) || isset($stop[$e])) $subBad++;
}
printf("  подписчиков к отключению: %s\n\n", $n($subBad));

if (!$apply) {
    echo "  сухой прогон: ничего не изменено (запустить с --apply)\n";
} else {
    // Стоп-лист пополняем всем, что нашли: одна точка правды для всех рассылок.
    $added = 0;
    foreach ($stop as $e => $why) {
        if ($e === '') continue;
        q("INSERT OR IGNORE INTO mail_stop (email, reason, source) VALUES (?,?,?)",
          [$e, $why, 'чистка базы']);
        $added += (int) db()->query("SELECT changes()")->fetchColumn();
    }
    printf("  добавлено в стоп-лист: %s\n", $n($added));

    // Учреждения без адреса — из рассылки вон: письму некуда идти.
    q("UPDATE institutions SET status='excluded', note=TRIM(COALESCE(note,'') || ' нет адреса'),
             updated_at=datetime('now','localtime')
        WHERE TRIM(COALESCE(email,'')) = '' AND status <> 'excluded'");
    printf("  учреждений без адреса закрыто: %s\n", $n(db()->query("SELECT changes()")->fetchColumn()));

    // Учреждения с закрытым или негодным адресом.
    $closed = 0;
    foreach (array_chunk(array_keys($stop), 400) as $chunk) {
        $in = implode(',', array_fill(0, count($chunk), '?'));
        q("UPDATE institutions SET status='bounced', updated_at=datetime('now','localtime')
            WHERE LOWER(email) IN ($in) AND status NOT IN ('excluded','bounced','unsubscribed','banned')", $chunk);
        $closed += (int) db()->query("SELECT changes()")->fetchColumn();
    }
    printf("  учреждений с закрытым адресом: %s\n", $n($closed));

    // Подписчики: снимаем с рассылки, запись оставляем — по ней уходят личные письма.
    $off = 0;
    foreach (array_chunk(array_keys($stop), 400) as $chunk) {
        $in = implode(',', array_fill(0, count($chunk), '?'));
        q("UPDATE subscribers SET active=0 WHERE active=1 AND LOWER(email) IN ($in)", $chunk);
        $off += (int) db()->query("SELECT changes()")->fetchColumn();
    }
    printf("  подписчиков снято с рассылки: %s\n", $n($off));

    // Очередь: массовые письма закрытым адресам гасим сразу.
    q("UPDATE mail_queue SET status='cancelled', error='адрес закрыт для рассылок'
        WHERE status='queued' AND COALESCE(priority,0) > 0
          AND LOWER(to_email) IN (SELECT email FROM mail_stop)");
    printf("  снято писем из очереди: %s\n", $n(db()->query("SELECT changes()")->fetchColumn()));
}

/* ── 4. Сколько осталось ── */
echo "\nСКОЛЬКО БАЗЫ ОСТАЛОСЬ\n$line\n";
$subAll  = (int) scalar("SELECT COUNT(*) FROM subscribers WHERE active=1");
$instAll = (int) scalar("SELECT COUNT(*) FROM institutions
                          WHERE status NOT IN ('excluded','bounced','unsubscribed','banned')
                            AND TRIM(COALESCE(email,'')) <> ''");
$both    = (int) scalar("SELECT COUNT(*) FROM subscribers s
                          JOIN institutions i ON LOWER(i.email) = LOWER(s.email)
                         WHERE s.active = 1
                           AND i.status NOT IN ('excluded','bounced','unsubscribed','banned')");
printf("  своя база (подписчики):      %s\n", $n($subAll));
printf("  учреждения (партнёрка):      %s\n", $n($instAll));
printf("  адрес есть и там, и там:     %s\n", $n($both));
printf("  всего уникальных адресов:    %s\n", $n($subAll + $instAll - $both));
