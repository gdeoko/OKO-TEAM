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

/* ── 4б. Платежи, оставленные проверками ──────────────────────────────────── */
//
// Проверка оплаты «проводила» деньги способом 'test' и открывала платёжные
// страницы, а каждое открытие создаёт счёт в кассе. На отладочной базе это следы
// в песочнице, на боевой — заявка живого участника, помеченная оплаченной на
// 500 ₽, которых он не платил, и висящие счета к удалённым заказам.
// Что считаем следом проверки:
//   • способ 'test' — так «оплачивает» только проверка;
//   • счёт к заказу, которого больше нет (заказ создан и удалён проверкой);
//   • отменённый счёт к заявке, у которой ЕСТЬ более ранний счёт: каждое открытие
//     платёжной страницы гасит предыдущий счёт и заводит новый, и проверка,
//     открывавшая страницу подряд, наплодила их поверх настоящего.
$fakePays = all("SELECT id, application_id, order_id, amount, status, method, created_at
                   FROM payments p
                  WHERE method='test'
                     OR (order_id IS NOT NULL AND order_id NOT IN (SELECT id FROM awards_orders))
                     OR (application_id IS NOT NULL AND status='canceled'
                         AND EXISTS (SELECT 1 FROM payments p2
                                      WHERE p2.application_id = p.application_id
                                        AND p2.id < p.id AND p2.status='canceled'))
                  ORDER BY id");
echo "\nПЛАТЕЖИ ОТ ПРОВЕРОК\n$line\n";
foreach ($fakePays as $p) printf("  #%-4s заявка=%-5s заказ=%-5s %s ₽ %-10s %s %s\n",
    $p['id'], (string) ($p['application_id'] ?? '-'), (string) ($p['order_id'] ?? '-'),
    (string) $p['amount'], (string) $p['status'], (string) $p['method'], (string) $p['created_at']);
echo '  всего: ' . count($fakePays) . "\n";

// Заявки, которые такой платёж пометил оплаченными, возвращаем в неоплаченные:
// человек денег не вносил, ему по-прежнему положено напоминание об оплате.
$paidByFake = all("SELECT DISTINCT a.id, a.number, a.email FROM applications a
                     JOIN payments p ON p.application_id = a.id
                    WHERE p.method='test' AND COALESCE(a.is_paid,0)=1");
echo "\nЗАЯВКИ, ПОМЕЧЕННЫЕ ОПЛАЧЕННЫМИ БЕЗ ОПЛАТЫ\n$line\n";
foreach ($paidByFake as $a) printf("  #%-5s %-16s %s\n", $a['id'], (string) $a['number'], (string) $a['email']);
echo '  всего: ' . count($paidByFake) . "\n";

if ($apply) {
    foreach ($paidByFake as $a) {
        q("UPDATE applications SET is_paid=0, payment_id=0, amount_paid=0, price_base=0,
                  discount_pct=0, discount_info='' WHERE id=?", [(int) $a['id']]);
        if (function_exists('app_status_sync')) app_status_sync((int) $a['id']);
    }
    if ($paidByFake) $did[] = 'возвращено в неоплаченные заявок: ' . count($paidByFake);
    foreach ($fakePays as $p) q("DELETE FROM payments WHERE id=?", [(int) $p['id']]);
    if ($fakePays) $did[] = 'удалено платежей проверок: ' . count($fakePays);
}

/* ── 4б. Счета к заказам, которых больше нет ──────────────────────────────── */
// Проверка заказа наград заводит и заказ, и счёт к нему. Заказ потом удаляется по
// номеру заявки, а счёт привязан к заказу, а не к заявке, и оставался висеть.
// В отчётах он выглядит как деньги, за которыми ничего не стоит.
$orphanPays = all("SELECT id, order_id, amount, status FROM payments
                    WHERE COALESCE(order_id,0) > 0
                      AND order_id NOT IN (SELECT id FROM awards_orders)");
if ($orphanPays) {
    echo "\nСЧЕТА К НЕСУЩЕСТВУЮЩИМ ЗАКАЗАМ: " . count($orphanPays) . "\n";
    foreach ($orphanPays as $p) {
        printf("  счёт #%d к заказу #%d, %d ₽, %s\n",
            (int) $p['id'], (int) $p['order_id'], (int) $p['amount'], (string) $p['status']);
    }
    if ($apply) {
        foreach ($orphanPays as $p) q("DELETE FROM payments WHERE id=?", [(int) $p['id']]);
        $did[] = 'удалено счетов к несуществующим заказам: ' . count($orphanPays);
    }
}

/* ── 4в. Уведомления от проверочных писем ─────────────────────────────────── */
// Каждое проверочное письмо дублируется уведомлением в кабинет, и эти
// уведомления оставались висеть у владельцев центра колокольчиком месяцами:
// «[ТЕСТ] Сертификат партнёра», «Проверка ящика рассылки». Письма давно убраны,
// а следы в кабинете — нет.
$junkNotif = all("SELECT id, user_id, title FROM notifications
                   WHERE title LIKE '[ТЕСТ%' OR title LIKE '%[ТЕСТ]%'
                      OR title LIKE 'Проверка ящика%' OR title LIKE 'Проверка нового пароля%'
                      OR title LIKE 'Проверка наградного ящика%' OR title LIKE 'Проверка второго ящика%'
                      OR title LIKE 'Проверка официального ящика%'");
if ($junkNotif) {
    echo "\nУВЕДОМЛЕНИЯ ОТ ПРОВЕРОЧНЫХ ПИСЕМ: " . count($junkNotif) . "\n";
    foreach (array_slice($junkNotif, 0, 5) as $n) {
        printf("  участник #%d: %s\n", (int) $n['user_id'], mb_substr((string) $n['title'], 0, 60));
    }
    if (count($junkNotif) > 5) echo "  ...\n";
    if ($apply) {
        foreach ($junkNotif as $n) q("DELETE FROM notifications WHERE id=?", [(int) $n['id']]);
        $did[] = 'убрано уведомлений от проверок: ' . count($junkNotif);
    }
}

/* ── 5. Письма проверок ───────────────────────────────────────────────────── */
// Наружу они не уходили (адреса зоны .test не маршрутизируются), но в отчётах по
// рассылке мешают: их видно в «отправлено» и они сбивают счёт.
// Ищем и по имени получателя, и по телу: письма выдуманным участникам остаются
// в списке отправок и в рассылках даже после удаления самих заявок.
//
// ПРИЗНАК ПРОВЕРКИ — ТОЛЬКО ВЫДУМАННЫЙ, НИКОГДА БОЕВОЙ.
// В списке стояло `subject LIKE '%VR-2026-00107%'` — номер настоящей заявки
// живого человека (Юрченко Диана, «Величие России»). Чистка вырезала из очереди
// оба её письма — и «заявка принята», и «устраните причину», — и по базе выходило,
// что участница не получила ничего. Заявки проверок нумеруются AUDIT-<год>-…,
// по ним и ищем.
$letterWhere = "LOWER(to_email) LIKE '%@example.test'
                 OR LOWER(to_email) LIKE 'magic-audit-%'
                 OR subject LIKE '%AUDIT-20%'
                 OR to_name IN ('Смирнова Ольга Ивановна','Кузнецов Пётр Алексеевич','Волков Илья Романович','Проверка Участник')
                 OR body LIKE '%Смирнова Ольга Ивановна%'
                 OR body LIKE '%Кузнецов Пётр Алексеевич%'
                 OR body LIKE '%Волков Илья Романович%'
                 OR body LIKE '%Петрова Анна Сергеевна%'";
$letters = (int) (scalar("SELECT COUNT(*) FROM mail_queue WHERE $letterWhere") ?? 0);
echo "\nПИСЬМА ПРОВЕРОК\n$line\n  всего: $letters\n";
if ($apply && $letters) {
    q("DELETE FROM mail_queue WHERE $letterWhere");
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
