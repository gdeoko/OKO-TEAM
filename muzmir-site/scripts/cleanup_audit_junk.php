<?php
/**
 * УБОРКА СЛЕДОВ ПРОВЕРОК В БОЕВОЙ БАЗЕ.
 *
 * Сквозные проверки писались под отладочную базу и вели себя соответственно:
 * подавали заявки от имени центра, помечали первые три настоящие заявки
 * оплаченными с выдуманной скидкой и промокодом, выдавали временным участникам
 * членство в клубе. На отладочной базе это безобидно, на боевой — мусор в
 * списках и чужая галочка у несуществующего участника.
 *
 * Скрипт убирает ровно эти следы и возвращает тронутые заявки в исходный вид.
 * Ничего, кроме заведомо проверочных записей, не трогает.
 *
 *   php scripts/cleanup_audit_junk.php           — показать, что будет сделано
 *   php scripts/cleanup_audit_junk.php --apply   — сделать
 */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { fwrite(STDERR, "CLI only\n"); exit(1); }

define('BASE_PATH', dirname(__DIR__));
$GLOBALS['CFG'] = require BASE_PATH . '/config.php';
require_once BASE_PATH . '/core/db.php';
require_once BASE_PATH . '/core/helpers.php';
require_once BASE_PATH . '/core/app_status.php';

$apply = in_array('--apply', $argv, true);
$line  = str_repeat('=', 78);
$did   = [];

/* ── 1. Заявки, поданные самой проверкой ──────────────────────────────────── */
// Опознаём по связке ФИО+педагог из проверки и по служебным номерам. Настоящий
// участник с такими данными не появится: педагог и произведение выдуманы вместе.
// Все трое подаются сквозной проверкой с одним и тем же выдуманным педагогом.
$junk = all("SELECT id, number, full_name, created_at FROM applications
              WHERE (teacher='Петрова Анна Сергеевна'
                     AND full_name IN ('Смирнова Ольга Ивановна','Кузнецов Пётр Алексеевич','Волков Илья Романович'))
                 OR full_name IN ('Проверка Участник','Тест Правка')
                 OR number LIKE 'AUDIT-%' OR number LIKE 'TEST-%'
              ORDER BY id");
echo "ЗАЯВКИ, СОЗДАННЫЕ ПРОВЕРКАМИ\n$line\n";
foreach ($junk as $j) printf("  #%-5s %-16s %s  %s\n", $j['id'], (string) $j['number'],
    mb_substr((string) $j['full_name'], 0, 26), (string) $j['created_at']);
echo '  всего: ' . count($junk) . "\n";
if ($apply) {
    foreach ($junk as $j) {
        $id = (int) $j['id'];
        q("DELETE FROM diplomas WHERE application_id=?", [$id]);
        q("DELETE FROM awards_orders WHERE application_id=?", [$id]);
        q("DELETE FROM payments WHERE application_id=?", [$id]);
        try { q("DELETE FROM mail_queue WHERE subject LIKE '%' || (SELECT number FROM applications WHERE id=?) || '%'", [$id]); } catch (\Throwable $e) {}
        q("DELETE FROM applications WHERE id=?", [$id]);
    }
    $did[] = 'удалено заявок: ' . count($junk);
}

/* ── 2. Настоящие заявки, которые проверка пометила оплаченными ───────────── */
// Признак подделки — промокод AUD5: он существует только внутри проверки.
$faked = all("SELECT id, number, competition_id FROM applications WHERE discount_info LIKE '%AUD5%'");
echo "\nНАСТОЯЩИЕ ЗАЯВКИ С ВЫДУМАННОЙ ОПЛАТОЙ\n$line\n";
foreach ($faked as $f) printf("  #%-5s %s\n", $f['id'], (string) $f['number']);
echo '  всего: ' . count($faked) . "\n";
if ($apply) {
    foreach ($faked as $f) {
        $id = (int) $f['id'];
        // Бесплатный конкурс — денег по заявке нет вовсе; платный — счёт заново
        // выставит касса, выдуманные цифры хранить нельзя ни в каком виде.
        $free = (int) (scalar("SELECT COALESCE(is_paid,0) FROM competitions WHERE id=?",
                              [(int) $f['competition_id']]) ?? 0) === 0;
        q("UPDATE applications SET price_base=0, discount_pct=0, amount_paid=0,
                  discount_info='', batch_id='', payment_id=0, is_paid=?
            WHERE id=?", [$free ? 1 : 0, $id]);
        // Статус пересчитываем по фактам, а не гадаем.
        if (function_exists('app_status_sync')) app_status_sync($id);
    }
    $did[] = 'восстановлено заявок: ' . count($faked);
}

/* ── 3. Членство в клубе, выданное проверкой ──────────────────────────────── */
$club = all("SELECT id, user_id, source FROM club_members WHERE source LIKE 'audit%'");
echo "\nЧЛЕНСТВО В КЛУБЕ, ВЫДАННОЕ ПРОВЕРКОЙ\n$line\n";
foreach ($club as $c) printf("  запись #%-4s участник #%-6s (%s)\n", $c['id'], $c['user_id'], (string) $c['source']);
echo '  всего: ' . count($club) . "\n";
if ($apply && $club) {
    q("DELETE FROM club_members WHERE source LIKE 'audit%'");
    $did[] = 'снято членств в клубе: ' . count($club);
}

/* ── 4. Учётные записи-пустышки ───────────────────────────────────────────── */
$users = all("SELECT id, email FROM users WHERE email LIKE '%@example.test'");
echo "\nУЧЁТНЫЕ ЗАПИСИ-ПУСТЫШКИ\n$line\n";
foreach ($users as $u) printf("  #%-6s %s\n", $u['id'], (string) $u['email']);
echo '  всего: ' . count($users) . "\n";
if ($apply) {
    foreach ($users as $u) {
        $id = (int) $u['id'];
        q("DELETE FROM diplomas WHERE application_id IN (SELECT id FROM applications WHERE user_id=?)", [$id]);
        q("DELETE FROM applications WHERE user_id=?", [$id]);
        q("DELETE FROM club_members WHERE user_id=?", [$id]);
        q("DELETE FROM sessions WHERE user_id=?", [$id]);
        q("DELETE FROM users WHERE id=?", [$id]);
    }
    $did[] = 'удалено учётных записей: ' . count($users);
}

/* ── 5. Письма проверок ───────────────────────────────────────────────────── */
// Наружу они не уходили (адреса зоны .test не маршрутизируются), но в отчётах по
// рассылке мешают: их видно в «отправлено» и они сбивают счёт.
$letters = (int) (scalar("SELECT COUNT(*) FROM mail_queue
                           WHERE LOWER(to_email) LIKE '%@example.test'
                              OR subject LIKE '%VR-2026-00107%'") ?? 0);
echo "\nПИСЬМА ПРОВЕРОК\n$line\n  всего: $letters\n";
if ($apply && $letters) {
    q("DELETE FROM mail_queue WHERE LOWER(to_email) LIKE '%@example.test' OR subject LIKE '%VR-2026-00107%'");
    $did[] = 'удалено писем проверок: ' . $letters;
}

/* ── 6. Осиротевшие наградные документы ───────────────────────────────────── */
// Диплом, чья заявка удалена, не нужен никому и портит счётчики в админке.
$orphans = (int) (scalar("SELECT COUNT(*) FROM diplomas d
                           LEFT JOIN applications a ON a.id=d.application_id
                          WHERE a.id IS NULL") ?? 0);
echo "\nДИПЛОМЫ БЕЗ ЗАЯВКИ\n$line\n  всего: $orphans\n";
if ($apply && $orphans) {
    q("DELETE FROM diplomas WHERE application_id NOT IN (SELECT id FROM applications)");
    $did[] = 'удалено дипломов без заявки: ' . $orphans;
}

/* ── 7. Учётные записи для проб ───────────────────────────────────────────── */
// Только поимённо. Никаких «удалить всех, у кого нет заявок»: так под нож попал бы
// человек, который зарегистрировался и ещё не успел подать работу.
$testMails = ['albertilasov1676@gmail.com'];   // рабочий адрес владельца для проб
$probes = [];
foreach ($testMails as $m) {
    $u = one("SELECT id, email, (SELECT COUNT(*) FROM applications a WHERE a.user_id=users.id) n
                FROM users WHERE LOWER(email)=?", [mb_strtolower($m)]);
    if ($u) $probes[] = $u;
}
echo "\nУЧЁТНЫЕ ЗАПИСИ ДЛЯ ПРОБ\n$line\n";
foreach ($probes as $u) printf("  #%-6s %-34s заявок: %s\n", $u['id'], (string) $u['email'], $u['n']);
echo '  всего: ' . count($probes) . "\n";
if ($apply) {
    foreach ($probes as $u) {
        // Если на записи ещё висят заявки — не трогаем: значит это уже не проба.
        if ((int) $u['n'] > 0) { echo '  пропуск #' . $u['id'] . ": на записи есть заявки\n"; continue; }
        q("DELETE FROM mail_queue WHERE LOWER(to_email)=?", [mb_strtolower((string) $u['email'])]);
        q("DELETE FROM sessions WHERE user_id=?", [(int) $u['id']]);
        q("DELETE FROM club_members WHERE user_id=?", [(int) $u['id']]);
        q("DELETE FROM users WHERE id=?", [(int) $u['id']]);
        $did[] = 'удалена проба ' . (string) $u['email'];
    }
}

echo "\n$line\n";
if (!$apply) { echo "ничего не меняли — запустите с --apply\n"; exit(0); }
foreach ($did as $d) echo "  $d\n";
echo "готово\n";
