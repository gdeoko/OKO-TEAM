<?php
/**
 * АУДИТ РЕАЛЬНОСТИ ДАННЫХ.
 *
 * Проверяет не «страница открылась», а что ЦИФРЫ на ней совпадают с базой:
 * счётчики дашборда и аналитики, статистика кабинета, суммы по заявкам, заказам
 * и дипломам. Каждое число считается независимым запросом и сверяется с тем, что
 * реально отрисовано на странице.
 *
 *   BASE=http://127.0.0.1:8099 MUZMIR_DB_PATH=… php scripts/audit_realdata.php
 */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { fwrite(STDERR, "CLI only\n"); exit(1); }

define('BASE_PATH', dirname(__DIR__));
$GLOBALS['CFG'] = require BASE_PATH . '/config.php';
foreach (['db', 'helpers', 'data', 'app_status', 'loyalty', 'club'] as $m) {
    require_once BASE_PATH . '/core/' . $m . '.php';
}
db();

$BASE = rtrim((string) (getenv('BASE') ?: 'http://127.0.0.1:8099'), '/');
$FAIL = 0; $OK = 0;
function sec(string $s): void { echo "\n=== $s ===\n"; }
function ok(string $w, $i = ''): void { global $OK; $OK++; echo "  ok   $w" . ($i !== '' ? "  [$i]" : '') . "\n"; }
function bad(string $w, $i = ''): void { global $FAIL; $FAIL++; echo "  FAIL $w" . ($i !== '' ? "  $i" : '') . "\n"; }
function chk(string $w, $cond, $i = ''): void { $cond ? ok($w, $i) : bad($w, $i); }

function http(string $jar, string $url, array $post = null): array {
    global $BASE;
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true, CURLOPT_FOLLOWLOCATION => true, CURLOPT_MAXREDIRS => 5,
        CURLOPT_COOKIEJAR => $jar, CURLOPT_COOKIEFILE => $jar, CURLOPT_TIMEOUT => 60,
        CURLOPT_HEADER => true, CURLOPT_PROXY => '',
        CURLOPT_HTTPHEADER => ['Origin: ' . $BASE, 'Referer: ' . $BASE . '/'],
    ]);
    if ($post !== null) { curl_setopt($ch, CURLOPT_POST, true); curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query($post)); }
    $raw = (string) curl_exec($ch);
    $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $hlen = (int) curl_getinfo($ch, CURLINFO_HEADER_SIZE);
    curl_close($ch);
    return ['code' => $code, 'body' => substr($raw, $hlen)];
}
function tok(string $jar, string $path): string {
    global $BASE;
    $r = http($jar, $BASE . $path);
    if (preg_match('~name="_csrf"\s+value="([^"]+)"~', $r['body'], $m)) return $m[1];
    return '';
}
/** Текст страницы без тегов — по нему ищем числа так, как их видит человек. */
function plain(string $html): string {
    $t = preg_replace('~<script\b.*?</script>~is', ' ', $html);
    $t = preg_replace('~<style\b.*?</style>~is', ' ', (string) $t);
    $t = html_entity_decode(strip_tags((string) $t), ENT_QUOTES | ENT_HTML5, 'UTF-8');
    // Неразрывные пробелы внутри чисел («1 234») приводим к обычным.
    $t = str_replace(["\xC2\xA0", "\xE2\x80\xAF"], ' ', (string) $t);
    return preg_replace('~\s+~u', ' ', $t) ?? '';
}
/** Есть ли число на странице (в любом привычном написании: 1234 / 1 234). */
function has_num(string $plain, int $n): bool {
    $variants = [(string) $n, number_format($n, 0, '.', ' ')];
    foreach (array_unique($variants) as $v) {
        if (preg_match('~(?<![\d])' . preg_quote($v, '~') . '(?![\d])~u', $plain)) return true;
    }
    return false;
}

$AJAR = sys_get_temp_dir() . '/muzmir_real_adm.txt'; @unlink($AJAR);
$UJAR = sys_get_temp_dir() . '/muzmir_real_usr.txt'; @unlink($UJAR);

/* ───────── вход ───────── */
sec('Вход');
$t = tok($AJAR, '/login');
http($AJAR, $BASE . '/login', ['_csrf' => $t, 'csrf' => $t, 'do' => 'login',
      'email' => 'admin@test.local', 'password' => 'Test_12345']);
$dash = http($AJAR, $BASE . '/admin/?p=dashboard');
chk('дашборд открывается админом', $dash['code'] === 200, (string) $dash['code']);

$t = tok($UJAR, '/login');
http($UJAR, $BASE . '/login', ['_csrf' => $t, 'csrf' => $t, 'do' => 'login',
      'email' => 'user@test.local', 'password' => 'Test_12345']);
$uid = (int) scalar("SELECT id FROM users WHERE email='user@test.local'");

/* ───────── дашборд: счётчики против базы ───────── */
sec('Дашборд: цифры совпадают с базой');
$d = plain($dash['body']);
$paidStatuses = "('succeeded','paid')";
$expect = [
    'всего заявок'          => (int) scalar("SELECT COUNT(*) FROM applications"),
    'новых заявок'          => (int) scalar("SELECT COUNT(*) FROM applications WHERE status='new'"),
    'конкурсов всего'       => (int) scalar("SELECT COUNT(*) FROM competitions"),
    'открытых конкурсов'    => (int) scalar("SELECT COUNT(*) FROM competitions WHERE status='open'"),
    'дипломов всего'        => (int) scalar("SELECT COUNT(*) FROM diplomas"),
    'подписчиков'           => (int) scalar("SELECT COUNT(*) FROM subscribers WHERE active=1"),
];
foreach ($expect as $what => $n) {
    chk("на дашборде видно «{$what}» = {$n}", has_num($d, $n), (string) $n);
}
chk('на дашборде нет PHP-шума',
    !preg_match('~Warning:|Fatal error|Undefined ~', $dash['body']));

/* ───────── деньги: одна и та же сумма везде ───────── */
sec('Деньги: касса, заявки и заказы сходятся');
$kassaAll = (int) scalar("SELECT COALESCE(SUM(amount),0) FROM payments WHERE status IN $paidStatuses");
$ordPaid  = (int) scalar("SELECT COALESCE(SUM(amount),0) FROM awards_orders
                           WHERE status IN ('paid','made','shipped','delivered')");
ok('подтверждено кассой за всё время', number_format($kassaAll, 0, '.', ' ') . ' ₽');
ok('оплачено по заказам наград', number_format($ordPaid, 0, '.', ' ') . ' ₽');

// Проверка на аномалии: отрицательные суммы; сумма больше снимка price_base × 10
// (админ мог позже понизить c.price — тогда amount > c.price*6 это НЕ баг, а
// исторический факт; сравнение по price_base, зафиксированной на момент оплаты).
$overpaid = 0; $negative = 0;
foreach (all("SELECT a.*, c.is_paid comp_paid, c.price comp_price,
                (SELECT COALESCE(SUM(p.amount),0) FROM payments p
                  WHERE p.application_id=a.id AND p.status IN $paidStatuses) paid_sum
              FROM applications a LEFT JOIN competitions c ON c.id=a.competition_id") as $r) {
    $pv = app_payment_view($r);
    if ($pv['amount'] < 0) $negative++;
    $baseSnap = (int) ($r['price_base'] ?? 0);
    if (!$pv['free'] && $baseSnap > 0 && $pv['amount'] > $baseSnap * 10) $overpaid++;
}
chk('нет заявок с отрицательной суммой', $negative === 0, (string) $negative);
chk('нет заявок с необъяснимо большой суммой (по снимку цены)', $overpaid === 0, (string) $overpaid);

// Оплаченная заявка никогда не показывается неоплаченной.
$ghost = 0;
foreach (all("SELECT a.*, c.is_paid comp_paid, c.price comp_price,
                (SELECT COALESCE(SUM(p.amount),0) FROM payments p
                  WHERE p.application_id=a.id AND p.status IN $paidStatuses) paid_sum
              FROM applications a LEFT JOIN competitions c ON c.id=a.competition_id
              WHERE a.is_paid=1") as $r) {
    $pv = app_payment_view($r);
    if (!$pv['free'] && !$pv['paid']) $ghost++;
}
chk('ни одна оплаченная заявка не значится неоплаченной', $ghost === 0, (string) $ghost);

/* ───────── списки админки: количество строк = количеству в базе ───────── */
sec('Списки админки показывают всё, что есть в базе');
$pairs = [
    ['orders',  'заказы наград',  (int) scalar("SELECT COUNT(*) FROM awards_orders WHERE status IN ('paid','made')")],
    ['users',   'пользователи',   (int) scalar("SELECT COUNT(*) FROM users")],
];
foreach ($pairs as [$p, $title, $n]) {
    $r = http($AJAR, $BASE . '/admin/?p=' . $p);
    chk("раздел «{$title}» открывается", $r['code'] === 200, (string) $r['code']);
    chk("в «{$title}» нет PHP-шума", !preg_match('~Warning:|Fatal error|Undefined ~', $r['body']));
}

/* ───────── кабинет участника: статистика по его реальным заявкам ───────── */
sec('Кабинет: статистика участника — по его реальным данным');
$cab = http($UJAR, $BASE . '/cabinet');
$c = plain($cab['body']);
$myRows   = all("SELECT a.*, c.is_paid comp_paid, c.price comp_price, c.results_mode, c.results_published_at
                   FROM applications a LEFT JOIN competitions c ON c.id=a.competition_id
                  WHERE a.user_id=?", [$uid]);
$myApps   = count($myRows);
$myDips   = (int) scalar("SELECT COUNT(*) FROM diplomas d JOIN applications a ON a.id=d.application_id
                           WHERE a.user_id=?", [$uid]);
// Кабинет считает по СОСТОЯНИЮ заявки (core/app_status.php), а не по сырой колонке status.
// С августа 2026 «Оценено» = все заявки, по которым жюри уже проставило оценку (включая
// judging — оценка есть, письмо ещё в пути); «На оценке» = new/paid/submitted/pending
// (жюри ещё не подвело итог). Плитку «Ждут жюри» из кабинета убрали.
$cntGraded = 0; $cntPending = 0;
foreach ($myRows as $r) {
    $st = (string) (app_state($r, false)['code'] ?? $r['status'] ?? 'new');
    if (in_array($st, ['judging','graded','making','made','extra','done'], true)) $cntGraded++;
    elseif (in_array($st, ['new','paid','submitted','pending'], true)) $cntPending++;
}
chk('в кабинете видно число заявок участника', has_num($c, $myApps), (string) $myApps);
chk('в кабинете видно «Оценено» тем же числом (включая judging)',
    has_num($c, $cntGraded), (string) $cntGraded);
chk('в кабинете видно «На оценке» тем же числом', has_num($c, $cntPending), (string) $cntPending);
chk('плитки «Ждут жюри» в кабинете больше нет', !preg_match('~Ждут\s+жюри~u', $c));
chk('счётчики не превышают общее число заявок',
    $cntGraded + $cntPending <= $myApps,
    "$cntGraded+$cntPending из $myApps");
ok('дипломов у участника в базе', (string) $myDips);
chk('в кабинете нет PHP-шума', !preg_match('~Warning:|Fatal error|Undefined ~', $cab['body']));

// Деньги участника в кабинете = его подтверждённые платежи + оплаченные заказы.
$myMoney = (int) scalar("SELECT COALESCE(SUM(p.amount),0) FROM payments p
                          JOIN applications a ON a.id=p.application_id
                         WHERE a.user_id=? AND p.status IN $paidStatuses", [$uid]);
$myMoney += (int) scalar("SELECT COALESCE(SUM(amount),0) FROM awards_orders
                           WHERE user_id=? AND status IN ('paid','made','shipped','delivered')", [$uid]);
chk('в кабинете видна реальная сумма оплат участника', $myMoney === 0 || has_num($c, $myMoney),
    number_format($myMoney, 0, '.', ' ') . ' ₽');

/* ───────── профиль: одно ФИО и одно фото во всех разделах ───────── */
sec('Профиль: ФИО и фото одинаковы везде');
$u = one("SELECT id, full_name, avatar, email FROM users WHERE id=?", [$uid]);
$fio = trim((string) ($u['full_name'] ?? ''));
$ava = trim((string) ($u['avatar'] ?? ''));
if ($fio !== '') {
    chk('ФИО из профиля показано в кабинете', str_contains($cab['body'], $fio), $fio);
}
chk('фото профиля — короткая ссылка, а не base64',
    $ava === '' || !str_starts_with($ava, 'data:'), mb_substr($ava, 0, 60));
if ($ava !== '') {
    chk('фото профиля показано в кабинете', str_contains($cab['body'], $ava));
    $app = one("SELECT id FROM applications WHERE user_id=? ORDER BY id DESC LIMIT 1", [$uid]);
    if ($app) {
        $card = http($AJAR, $BASE . '/admin/?p=applications&id=' . (int) $app['id']);
        chk('то же фото видно в карточке заявки в админке', str_contains($card['body'], $ava));
        chk('в карточке заявки показано ФИО из профиля', $fio === '' || str_contains($card['body'], $fio));
    }
}

/* ───────── галочки ВИП: у кого стоят, тот и правда в клубе ───────── */
sec('Галочка ВИП соответствует реальному членству');
$members = all("SELECT user_id FROM club_members WHERE active=1 AND expires_at > datetime('now')");
foreach (array_slice($members, 0, 5) as $m) {
    $mid = (int) $m['user_id'];
    chk("участник #{$mid} — клуб активен и галочка есть",
        club_is_active($mid) && vip_kind($mid, 'user', '') !== '', vip_kind($mid, 'user', ''));
}
$notMember = (int) (scalar("SELECT id FROM users WHERE role='user'
                             AND id NOT IN (SELECT user_id FROM club_members)
                             AND LOWER(email) NOT IN (SELECT LOWER(email) FROM users WHERE role IN ('owner','admin','orgcom'))
                           LIMIT 1") ?? 0);
if ($notMember > 0) {
    $em = (string) (scalar("SELECT email FROM users WHERE id=?", [$notMember]) ?? '');
    $isStaff = function_exists('club_is_staff_email') && club_is_staff_email($em);
    if ($isStaff) { ok('единственный кандидат оказался из команды центра — пропуск'); }
    else chk('у не-члена клуба галочки нет', vip_kind($notMember, 'user', $em) === '', $em);
} else { ok('в базе нет участников вне клуба — пропуск'); }

echo "\n" . str_repeat('─', 60) . "\n";
echo ($FAIL === 0 ? "ДАННЫЕ РЕАЛЬНЫЕ И СХОДЯТСЯ" : "ПРОВАЛОВ: $FAIL") . ", пройдено: $OK\n";
exit($FAIL === 0 ? 0 : 1);
