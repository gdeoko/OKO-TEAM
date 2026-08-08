<?php
/**
 * АУДИТ АДМИНКИ И ОСТАВШИХСЯ ПРАВИЛ: карточка заявки, «Заказы электронных»,
 * ВИП-галочки (золотая/синяя), пульт управления запуском, отключение всплывающих
 * окон на подаче и заказе, ВИП-карточка в письмах, одноразовость промокода.
 *
 *   BASE=http://127.0.0.1:8099 MUZMIR_DB_PATH=… php scripts/audit_admin.php
 */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { fwrite(STDERR, "CLI only\n"); exit(1); }

define('BASE_PATH', dirname(__DIR__));
$GLOBALS['CFG'] = require BASE_PATH . '/config.php';
foreach (['db','helpers','data','app_status','send_timing','loyalty','club','mailer','launch_control','paylink'] as $m) {
    require_once BASE_PATH . '/core/' . $m . '.php';
}
db();

$BASE = rtrim((string) (getenv('BASE') ?: 'http://127.0.0.1:8099'), '/');
$FAIL = 0; $OK = 0;
function sec(string $s): void { echo "\n=== $s ===\n"; }
function ok(string $w, $i = ''): void { global $OK; $OK++; echo "  ok   $w" . ($i !== '' ? "  [$i]" : '') . "\n"; }
function bad(string $w, $i = ''): void { global $FAIL; $FAIL++; echo "  FAIL $w" . ($i !== '' ? "  $i" : '') . "\n"; }
function chk(string $w, $cond, $i = ''): void { $cond ? ok($w, $i) : bad($w, $i); }

function http(string $jar, string $url, array $post = null, bool $follow = true): array {
    global $BASE;
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true, CURLOPT_FOLLOWLOCATION => $follow, CURLOPT_MAXREDIRS => 5,
        CURLOPT_COOKIEJAR => $jar, CURLOPT_COOKIEFILE => $jar, CURLOPT_TIMEOUT => 60,
        CURLOPT_HEADER => true, CURLOPT_PROXY => '',
        CURLOPT_HTTPHEADER => ['Origin: ' . $BASE, 'Referer: ' . $BASE . '/', 'X-Requested-With: fetch'],
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
    foreach (['~name="_csrf"\s+value="([^"]+)"~', '~var CSRF = "([^"]+)"~'] as $re) {
        if (preg_match($re, $r['body'], $m)) return $m[1];
    }
    return '';
}
$AJAR = sys_get_temp_dir() . '/muzmir_adm.txt';
@unlink($AJAR);

sec('Вход администратором');
$t = tok($AJAR, '/admin/');
$r = http($AJAR, $BASE . '/admin/', ['_csrf' => $t, 'do' => 'login',
      'email' => 'admin@test.local', 'password' => 'Test_12345']);
chk('вход выполнен', stripos($r['body'], 'p=logout') !== false);

/* ───────── карточка заявки ───────── */
sec('Карточка заявки: видно всё и есть кнопки управления');
$app = one("SELECT a.*, c.name comp_name FROM applications a LEFT JOIN competitions c ON c.id=a.competition_id
             WHERE COALESCE(a.result,'')<>''
               AND EXISTS (SELECT 1 FROM diplomas d WHERE d.application_id=a.id AND COALESCE(d.sent_at,'')<>'')
             ORDER BY a.id DESC LIMIT 1")
     ?: one("SELECT a.*, c.name comp_name FROM applications a LEFT JOIN competitions c ON c.id=a.competition_id
             WHERE COALESCE(a.result,'')<>'' ORDER BY a.id DESC LIMIT 1");
if (!$app) { bad('нет оценённой заявки для проверки карточки'); }
else {
    $aid = (int) $app['id'];
    $r = http($AJAR, $BASE . '/admin/?p=applications&id=' . $aid);
    chk('карточка открывается', $r['code'] === 200, (string) $r['code']);
    $b = $r['body'];
    foreach ([
        'номер заявки'            => (string) $app['number'],
        'ФИО/коллектив'           => (string) ($app['is_group'] ? $app['group_name'] : $app['full_name']),
        'конкурс'                 => (string) $app['comp_name'],
        'конкурсный номер'        => (string) $app['work_title'],
        'номинация'               => (string) $app['nomination'],
        'возрастная категория'    => (string) $app['age_category'],
        'аттестационный результат'=> (string) $app['result'],
        'почта участника'         => (string) $app['email'],
    ] as $what => $needle) {
        if (trim($needle) === '') { ok("$what — пусто в заявке, пропуск"); continue; }
        chk("в карточке есть $what", strpos($b, $needle) !== false, mb_substr($needle, 0, 40));
    }
    chk('кнопка «Продублировать результат»', stripos($b, 'Продублировать результат') !== false);
    // Дубль наград появляется только когда есть ЧТО дублировать — отправленные документы.
    $dipSent = (int) scalar("SELECT COUNT(*) FROM diplomas WHERE application_id=? AND COALESCE(sent_at,'')<>''", [$aid]);
    if ($dipSent > 0) {
        chk('кнопка «Продублировать награды»', stripos($b, 'Продублировать наград') !== false);
    } else {
        chk('наград ещё не отправляли — вместо дубля показаны кнопки отправки',
            stripos($b, 'Отправить сейчас') !== false);
    }
    chk('в карточке есть блок исполнения (даты отправок)',
        stripos($b, 'отправлен') !== false || stripos($b, 'Исполнение') !== false);
    chk('в карточке нет PHP-шума', stripos($b, 'Warning:') === false && stripos($b, 'Undefined ') === false);
}

/* ───────── заказы электронных ───────── */
sec('Раздел «Заказы электронных»');
$r = http($AJAR, $BASE . '/admin/?p=digital');
chk('раздел открывается', $r['code'] === 200);
chk('есть поиск', stripos($r['body'], 'name="q"') !== false);
chk('есть вкладки состояния', stripos($r['body'], 'f=') !== false);
$dig = (int) scalar("SELECT COUNT(*) FROM awards_orders WHERE items LIKE '%\"kind\":\"digital\"%'");
ok('электронных заказов в базе', (string) $dig);
if ($dig > 0) {
    $o = one("SELECT * FROM awards_orders WHERE items LIKE '%\"kind\":\"digital\"%' ORDER BY id DESC LIMIT 1");
    chk('заказ виден в разделе', strpos($r['body'], (string) ($o['full_name'] ?? '')) !== false
        || strpos($r['body'], '№' . (int) $o['id']) !== false, 'заказ #' . (int) $o['id']);
    $r2 = http($AJAR, $BASE . '/admin/?p=digital&q=' . rawurlencode(mb_substr((string) $o['full_name'], 0, 8)));
    chk('поиск в разделе работает', $r2['code'] === 200
        && strpos($r2['body'], (string) $o['full_name']) !== false);
}

/* ───────── ВИП-галочки ───────── */
sec('ВИП-галочки: золотая у клуба, синяя у команды');
require_once BASE_PATH . '/admin/_boot.php';
chk('владелец → синяя (команда)', vip_kind(null, 'owner', 'zamis76@mail.ru') === 'team');
chk('оргкомитет → синяя (команда)', vip_kind(null, '', 'okoteam.top@gmail.com') === 'team');
$clubUid = (int) (scalar("SELECT user_id FROM club_members WHERE active=1 AND expires_at > datetime('now') LIMIT 1") ?? 0);
if ($clubUid > 0) {
    chk('участник клуба → золотая', vip_kind($clubUid, 'user', '') === 'club', vip_kind($clubUid, 'user', ''));
} else { ok('активных членов клуба в базе нет — пропуск'); }
chk('обычный участник → без галочки', vip_kind(0, 'user', 'nobody@example.com') === '');
chk('синяя галочка синего цвета', str_contains(vip_badge('team'), '2C7BE5'));
chk('золотая галочка золотого цвета', str_contains(vip_badge('club'), 'C79322'));
foreach (['applications' => 'Заявки', 'grading' => 'Оценка коротких', 'longcomp' => 'Оценка длинных',
          'dispatch' => 'Отправки', 'users' => 'Пользователи'] as $p => $title) {
    $r = http($AJAR, $BASE . '/admin/?p=' . $p);
    chk("«{$title}»: разметка галочек присутствует",
        stripos($r['body'], 'C79322') !== false || stripos($r['body'], '2C7BE5') !== false
        || stripos($r['body'], 'vip') !== false);
}

/* ───────── пульт управления запуском ───────── */
sec('Пульт запуска и стоп-кран');
$r = http($AJAR, $BASE . '/admin/?p=launch');
chk('пульт открывается', $r['code'] === 200);
$b = $r['body'];
chk('виден рубильник массовых рассылок',
    stripos($b, 'массов') !== false && (stripos($b, 'ctl_mass') !== false || stripos($b, 'Включить') !== false));
chk('видны волны запуска', stripos($b, 'Осталось 3 дня') !== false || stripos($b, 'Последний день') !== false);
chk('видно состояние почтовых ящиков', stripos($b, 'ящик') !== false || stripos($b, 'почт') !== false);
chk('стоп-кран сейчас в положении «выключено»', !mass_sending_enabled(),
    mass_sending_enabled() ? 'ВКЛЮЧЕНЫ' : 'выключены');
$jobs = (int) scalar("SELECT COUNT(*) FROM launch_jobs WHERE COALESCE(status,'')='scheduled'");
ok('задач запуска запланировано', (string) $jobs);

/* ───────── всплывающие окна ───────── */
sec('Всплывающие окна отключены на подаче и заказе');
$comp = one("SELECT slug FROM competitions WHERE status='open' LIMIT 1");
foreach (['/apply', '/order-awards', '/awards', '/club'] as $p) {
    $r = http($AJAR, $BASE . $p . ($p === '/apply' && $comp ? '?competition=' . $comp['slug'] : ''));
    chk("$p помечен как страница без попапов", stripos($r['body'], 'data-nopopup="1"') !== false);
}
// /login и /register вошедшего уводят в кабинет — смотрим их гостем, отдельной банкой.
$GJAR = sys_get_temp_dir() . '/muzmir_guest.txt'; @unlink($GJAR);
foreach (['/register', '/login'] as $p) {
    $r = http($GJAR, $BASE . $p);
    chk("$p помечен как страница без попапов (гостем)", stripos($r['body'], 'data-nopopup="1"') !== false);
}
$r = http($AJAR, $BASE . '/');
chk('на главной попапы не отключены (там они уместны)',
    stripos($r['body'], 'data-nopopup="1"') === false);

/* ───────── ВИП-карточка в письмах ───────── */
sec('ВИП-карточка клуба в письмах');
$card = mm_vip_card();
chk('карточка собирается', trim($card) !== '', mb_strlen($card) . ' симв.');
chk('в карточке указан размер скидки', str_contains($card, (string) mm_vip_discount()), mm_vip_discount() . '%');
$tx = mm_email_tx('<p>тело письма</p>', ['preheader' => 'тест']);
chk('в транзакционном письме карточка есть', str_contains($tx, 'ВИП') || str_contains($tx, 'Клуб'));
$txOff = mm_email_tx('<p>тело письма</p>', ['preheader' => 'тест', 'vip' => false]);
chk('карточку можно отключить (письма про сам клуб)', mb_strlen($txOff) < mb_strlen($tx),
    mb_strlen($txOff) . ' < ' . mb_strlen($tx));
$lay = mm_email_layout('<p>тело</p>', ['preheader' => 'тест']);
chk('в рассылочном макете карточка есть', str_contains($lay, 'ВИП') || str_contains($lay, 'Клуб'));

/* ───────── промокод: один раз ───────── */
sec('Промокод срабатывает один раз');
chk('потолок промокода 5%', REFERRAL_MAX_PCT === 5, (string) REFERRAL_MAX_PCT);
chk('вознаграждение владельцу 5%', REFERRAL_REWARD_MAX_PCT === 5, (string) REFERRAL_REWARD_MAX_PCT);
$uidAny = (int) (scalar("SELECT id FROM users WHERE email='user@test.local'") ?? 0);
if ($uidAny > 0) {
    $used = referral_already_used($uidAny, 'user@test.local');
    ok('промокод уже использован этим участником', $used ? 'да' : 'нет');
    // Повторное применение тем же участником должно быть закрыто, если уже использовал.
    $ref = one("SELECT * FROM referrals LIMIT 1");
    if ($ref) {
        $d = referral_discount_for((array) $ref, $uidAny, 'user@test.local');
        $pct = (int) ($d['pct'] ?? $d[0] ?? 0);
        chk('повторное применение не даёт больше 5%', $pct <= REFERRAL_MAX_PCT, $pct . '%');
        if ($used) chk('после использования промокод больше не даёт скидку', $pct === 0, $pct . '%');
    } else { ok('промокодов в базе нет — пропуск'); }
}
$b = discount_breakdown(LOYALTY_MAX_PCT, REFERRAL_MAX_PCT, 0);
chk('достижения + промокод без клуба = ровно 10%', (int) $b['total'] === 10, (string) $b['total']);

/* ───────── прямые ссылки на оплату ───────── */
sec('Кнопка «Оплатить» ведёт на оплату КОНКРЕТНОГО счёта');
$unpaidApp = one("SELECT a.id, a.number FROM applications a JOIN competitions c ON c.id=a.competition_id
                   WHERE c.is_paid=1 AND COALESCE(a.is_paid,0)=0 ORDER BY a.id DESC LIMIT 1");
if (!$unpaidApp) { ok('неоплаченных платных заявок нет — пропуск'); }
else {
    $aid = (int) $unpaidApp['id'];
    chk('ссылка содержит номер счёта и подпись',
        str_contains(pay_link_app($aid), 't=app&id=' . $aid) && str_contains(pay_link_app($aid), '&s='),
        pay_link_app($aid));
    $r = http($AJAR, $BASE . pay_path_app($aid));
    chk('по верной ссылке открывается оплата этой заявки',
        $r['code'] === 200 && str_contains($r['body'], (string) $unpaidApp['number']), (string) $r['code']);
    chk('на странице оплаты нет «Личный кабинет» вместо счёта',
        !str_contains($r['body'], 'Ссылка недействительна'));

    $r = http($AJAR, $BASE . '/pay?t=app&id=' . $aid . '&s=' . str_repeat('0', 32));
    chk('подделанная подпись отклоняется', str_contains($r['body'], 'Ссылка недействительна'));

    $r = http($AJAR, $BASE . '/pay?t=app&id=' . ($aid + 1) . '&s=' . pay_sign('app', $aid));
    chk('чужой номер с чужой подписью отклоняется', str_contains($r['body'], 'Ссылка недействительна'));

    chk('подпись заявки и заказа не совпадают', pay_sign('app', $aid) !== pay_sign('order', $aid));
}
$unpaidOrd = one("SELECT id FROM awards_orders WHERE status='new' ORDER BY id DESC LIMIT 1");
if (!$unpaidOrd) { ok('неоплаченных заказов нет — пропуск'); }
else {
    $oid = (int) $unpaidOrd['id'];
    $r = http($AJAR, $BASE . pay_path_order($oid));
    chk('по ссылке открывается оплата этого заказа',
        $r['code'] === 200 && str_contains($r['body'], 'заказа №' . $oid), (string) $r['code']);
}
$paidApp = one("SELECT id, number FROM applications WHERE COALESCE(is_paid,0)=1 ORDER BY id DESC LIMIT 1");
if ($paidApp) {
    $r = http($AJAR, $BASE . pay_path_app((int) $paidApp['id']));
    chk('по оплаченной заявке повторная оплата закрыта',
        str_contains($r['body'], 'уже оплачена'), mb_substr(strip_tags($r['body']), 0, 0));
}
$r = http($AJAR, $BASE . '/pay?t=' . rawurlencode('мусор') . '&id=0');
chk('битая ссылка не роняет страницу', $r['code'] === 200 && str_contains($r['body'], 'не распознана'));


echo "\n" . str_repeat('─', 60) . "\n";
echo ($FAIL === 0 ? "АДМИНКА И ПРАВИЛА ЧИСТО" : "ПРОВАЛОВ: $FAIL") . ", пройдено: $OK\n";
exit($FAIL === 0 ? 0 : 1);
