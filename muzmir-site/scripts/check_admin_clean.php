<?php
/**
 * НЕТ ЛИ В АДМИНКЕ СЛЕДОВ ПРОВЕРОК.
 *
 * Владелец смотрит на списки заявок, оценки, отправки, заказы и дипломы. Если
 * там мелькает выдуманное ФИО, служебный номер или оплата, которой не было,
 * доверять цифрам нельзя. Скрипт заходит в панель временным администратором,
 * открывает каждый раздел и ищет в них известные проверочные следы, а заодно
 * сверяет деньги: в списке платежей не должно быть способа «test» и счетов к
 * несуществующим заказам.
 *
 *   php scripts/check_admin_clean.php
 */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { fwrite(STDERR, "CLI only\n"); exit(1); }

define('BASE_PATH', dirname(__DIR__));
$GLOBALS['CFG'] = require BASE_PATH . '/config.php';
require_once BASE_PATH . '/core/db.php';
require_once BASE_PATH . '/core/helpers.php';
require_once BASE_PATH . '/scripts/_audit_actors.php';

const ADM_HOST = 'xn----7sbugdeiegh1b0a9hen.xn--p1ai';
$jar  = tempnam(sys_get_temp_dir(), 'admchk');
$line = str_repeat('=', 78);
$fail = 0;

function web(string $path, array $post = null, string $jar = ''): array {
    $ch = curl_init('https://' . ADM_HOST . $path);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true, CURLOPT_SSL_VERIFYPEER => false, CURLOPT_SSL_VERIFYHOST => 0,
        CURLOPT_RESOLVE => [ADM_HOST . ':443:127.0.0.1'], CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_COOKIEJAR => $jar, CURLOPT_COOKIEFILE => $jar, CURLOPT_TIMEOUT => 40, CURLOPT_PROXY => '',
    ]);
    if ($post !== null) { curl_setopt($ch, CURLOPT_POST, true); curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query($post)); }
    $b = (string) curl_exec($ch);
    $c = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    curl_close($ch);
    return ['code' => $c, 'body' => $b];
}

$chk = static function (string $what, bool $ok, string $info = '') use (&$fail): void {
    if (!$ok) $fail++;
    printf("  %s %-52s %s\n", $ok ? '✓' : '✗', mb_substr($what, 0, 52), $info);
};

/* ── Вход временным администратором ───────────────────────────────────────── */
echo "СЛЕДЫ ПРОВЕРОК В АДМИНКЕ\n$line\n";
$adm = audit_actor('admin');
$r = web('/admin/', null, $jar);
preg_match('~name="_csrf" value="([^"]+)"~', $r['body'], $m);
$r = web('/admin/', ['_csrf' => $m[1] ?? '', 'do' => 'login',
                     'email' => $adm['email'], 'password' => $adm['password']], $jar);
$in = mb_strpos($r['body'], 'p=logout') !== false;
$chk('вход в панель', $in);
if (!$in) { @unlink($jar); echo "\nбез входа проверить нечего\n"; exit(1); }

/* ── Разделы: ищем проверочные следы ──────────────────────────────────────── */
// Слова, которых в боевой панели быть не должно ни при каких обстоятельствах.
// «Проверка Админ» и адрес на example.test принадлежат учётной записи, под которой
// работает сам этот скрипт: её имя стоит в шапке панели и в списке пользователей.
// Искать её же и падать на ней — значит проверять собственную тень, поэтому она
// исключена, а её отсутствие после прогона гарантирует уборка actors.
$marks = ['Смирнова Ольга Ивановна', 'Кузнецов Пётр Алексеевич', 'Волков Илья Романович',
          'Пупков', 'Пупок', 'Проверка Участник', 'Тест Правка',
          'AUDIT-2026', 'TEST-2026', 'AUD5', 'Петрова Анна Сергеевна', 'Проверкин'];
$sections = [
    'Панель'            => '/admin/?p=dashboard',
    'Заявки'            => '/admin/?p=applications&show_unpaid=1',
    'Оценка коротких'   => '/admin/?p=grading',
    'Оценка длинных'    => '/admin/?p=longcomp',
    'Отправки'          => '/admin/?p=dispatch',
    'Заказы наград'     => '/admin/?p=orders',
    'Электронные заказы'=> '/admin/?p=digital&f=all',
    'Дипломы'           => '/admin/?p=diplomas',
    'Пользователи'      => '/admin/?p=users',
    'Учреждения'        => '/admin/?p=institutions',
    'Рассылки'          => '/admin/?p=newsletter',
    'Входящие письма'   => '/admin/?p=inbox',
];
foreach ($sections as $title => $path) {
    $r = web($path, null, $jar);
    $chk('«' . $title . '» открывается', $r['code'] === 200, (string) $r['code']);
    if ($r['code'] !== 200) continue;
    $hits = [];
    foreach ($marks as $w) if (mb_strpos($r['body'], $w) !== false) $hits[] = $w;
    $chk('«' . $title . '»: следов проверок нет', !$hits, $hits ? implode(', ', $hits) : '');
    $chk('«' . $title . '»: нет PHP-ошибок',
        !preg_match('~Warning:|Fatal error|Undefined ~', $r['body']));
}

/* ── Деньги: в базе не должно быть выдуманных платежей ────────────────────── */
echo "\nДЕНЬГИ\n$line\n";
$chk('нет платежей способом «test»',
    (int) (scalar("SELECT COUNT(*) FROM payments WHERE method='test'") ?? 0) === 0);
$chk('нет счетов к несуществующим заказам',
    (int) (scalar("SELECT COUNT(*) FROM payments WHERE order_id IS NOT NULL
                    AND order_id NOT IN (SELECT id FROM awards_orders)") ?? 0) === 0);
// Оплата может быть подтверждена вручную или одним счётом на пакет заявок, поэтому
// требуем не «свой успешный платёж», а наличие СЛЕДА платежа: ссылки payment_id.
// Заявка с деньгами и без всякой ссылки — вот это выдумка.
$chk('нет заявок с оплатой без следа платежа',
    (int) (scalar("SELECT COUNT(*) FROM applications a WHERE COALESCE(a.is_paid,0)=1
                    AND COALESCE(a.amount_paid,0) > 0
                    AND COALESCE(a.payment_id,0) = 0") ?? 0) === 0);
$chk('нет заявок с выдуманным промокодом',
    (int) (scalar("SELECT COUNT(*) FROM applications WHERE discount_info LIKE '%AUD5%'") ?? 0) === 0);
$chk('нет дипломов без заявки',
    (int) (scalar("SELECT COUNT(*) FROM diplomas d LEFT JOIN applications a ON a.id=d.application_id
                    WHERE a.id IS NULL") ?? 0) === 0);
// Кроме той, под которой работает сам скрипт: она удалится при выходе.
$chk('нет посторонних учётных записей на example.test',
    (int) (scalar("SELECT COUNT(*) FROM users WHERE email LIKE '%@example.test' AND id <> ?",
                  [(int) $adm['id']]) ?? 0) === 0);
$chk('нет проверочного членства в клубе',
    (int) (scalar("SELECT COUNT(*) FROM club_members WHERE source LIKE 'audit%'") ?? 0) === 0);

@unlink($jar);
echo "\n$line\n";
echo $fail === 0 ? "Админка чистая, следов проверок нет.\n" : "НАЙДЕНО СЛЕДОВ: $fail\n";
exit($fail === 0 ? 0 : 1);
