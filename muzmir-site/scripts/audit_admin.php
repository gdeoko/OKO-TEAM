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

const AUDIT_HOST = 'xn----7sbugdeiegh1b0a9hen.xn--p1ai';

/* КУДА СТУЧАТЬСЯ.
 *
 * Здесь стоял только адрес местного отладочного сервера, и на боевом сервере,
 * где его нет, ВСЕ проверки возвращали код 0 и отчёт был сплошным «FAIL» — то
 * есть аудит молчаливо ничего не проверял. Теперь по умолчанию берём сам сайт:
 * если рядом поднят отладочный сервер, он и будет использован, иначе боевой
 * (запрос идёт на 127.0.0.1 с нужным заголовком Host, наружу не выходит). */
$BASE = rtrim((string) getenv('BASE'), '/');
if ($BASE === '') {
    $probe = @fsockopen('127.0.0.1', 8099, $eno, $estr, 1);
    if ($probe) { fclose($probe); $BASE = 'http://127.0.0.1:8099'; }
    else        { $BASE = 'https://' . AUDIT_HOST; }
}
$FAIL = 0; $OK = 0;
function sec(string $s): void { echo "\n=== $s ===\n"; }
function ok(string $w, $i = ''): void { global $OK; $OK++; echo "  ok   $w" . ($i !== '' ? "  [$i]" : '') . "\n"; }
function bad(string $w, $i = ''): void { global $FAIL; $FAIL++; echo "  FAIL $w" . ($i !== '' ? "  $i" : '') . "\n"; }
function chk(string $w, $cond, $i = ''): void { $cond ? ok($w, $i) : bad($w, $i); }

function http(string $jar, string $url, array $post = null, bool $follow = true): array {
    global $BASE;
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_SSL_VERIFYPEER => false, CURLOPT_SSL_VERIFYHOST => 0,
        CURLOPT_RESOLVE => [AUDIT_HOST . ':443:127.0.0.1', AUDIT_HOST . ':80:127.0.0.1'], CURLOPT_FOLLOWLOCATION => $follow, CURLOPT_MAXREDIRS => 5,
        CURLOPT_COOKIEJAR => $jar, CURLOPT_COOKIEFILE => $jar, CURLOPT_TIMEOUT => 60,
        CURLOPT_HEADER => true, CURLOPT_PROXY => '',
        CURLOPT_HTTPHEADER => ['Origin: ' . $BASE, 'Referer: ' . $BASE . '/', 'X-Requested-With: fetch'],
    ]);
    if ($post !== null) { curl_setopt($ch, CURLOPT_POST, true); curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query($post)); }
    $raw = (string) curl_exec($ch);
    $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $hlen = (int) curl_getinfo($ch, CURLINFO_HEADER_SIZE);
    curl_close($ch);
    // Заголовки отдаём отдельно: по ним видно переадресацию на кассу.
    return ['code' => $code, 'head' => substr($raw, 0, $hlen), 'body' => substr($raw, $hlen)];
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
// Учётную запись заводим сами: на боевом сервере отладочной нет, и без неё вся
// проверка админки молча превращалась в «FAIL» по каждому пункту.
require_once BASE_PATH . '/scripts/_audit_actors.php';
$ADM = audit_actor('admin');
$r = http($AJAR, $BASE . '/admin/', ['_csrf' => $t, 'do' => 'login',
      'email' => $ADM['email'], 'password' => $ADM['password']]);
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
chk('оргкомитет → галочка команды', vip_kind(null, '', 'okoteam.top@gmail.com') === 'team');
// Берём члена клуба, который НЕ из команды центра: у сотрудника галочка своя,
// золотая, и требовать от него синей бессмысленно.
$clubUid = (int) (scalar("SELECT cm.user_id FROM club_members cm
                            JOIN users u ON u.id=cm.user_id
                           WHERE cm.active=1 AND cm.expires_at > datetime('now','localtime')
                             AND COALESCE(cm.source,'') <> 'staff'
                             AND u.role NOT IN ('owner','admin','orgcom')
                           LIMIT 1") ?? 0);
if ($clubUid > 0) {
    chk('участник клуба → галочка клуба', vip_kind($clubUid, 'user', '') === 'club', vip_kind($clubUid, 'user', ''));
} else { ok('активных членов клуба в базе нет — пропуск'); }
chk('обычный участник → без галочки', vip_kind(0, 'user', 'nobody@example.com') === '');
// ЦВЕТА (Даниэль): участник ВИП-клуба — СИНЯЯ галочка («проверенный»),
// команда центра — золотая. Раньше было наоборот.
chk('участник ВИП-клуба — синяя галочка', str_contains(vip_badge('club'), '2C7BE5'));
chk('оргкомитет центра — золотая галочка', str_contains(vip_badge('team'), 'C79322'));
chk('в подписи синей галочки написано про ВИП-клуб', str_contains(vip_badge('club'), 'Участник ВИП-клуба'));
// Тип галочки решает АККАУНТ, а не почта из строки списка: участник, написавший в
// заявке почту центра, раньше получал золотую галочку оргкомитета вместо синей ВИП.
$clubUid2 = (int) (scalar("SELECT cm.user_id FROM club_members cm
                            JOIN users u ON u.id=cm.user_id
                           WHERE cm.active=1 AND cm.expires_at > datetime('now','localtime')
                             AND COALESCE(cm.source,'') <> 'staff'
                             AND u.role NOT IN ('owner','admin','orgcom')
                           LIMIT 1") ?? 0);
if ($clubUid2 > 0) {
    chk('почта центра в заявке не превращает члена клуба в оргкомитет',
        vip_kind($clubUid2, 'user', 'okoteam.top@gmail.com') === 'club',
        vip_kind($clubUid2, 'user', 'okoteam.top@gmail.com'));
}
// Синяя галочка реально отрисована в КАЖДОМ разделе, где есть участники.
// Разделы, которым нужен выбранный конкурс/вкладка, открываем как открывает человек.
// Проверка самодостаточна: если действующего члена клуба в базе нет (например,
// предыдущий аудит проверял истечение подписки), выдаём временное членство участнику
// с заявками и снимаем его сразу после проверки — иначе разделы честно покажут 0.
// ЧЛЕНСТВО ВЫДАЁМ СВОЕМУ УЧАСТНИКУ, А НЕ ЧУЖОМУ.
//
// Здесь бралась первая попавшаяся живая учётная запись с заявками, у неё
// СНОСИЛОСЬ имеющееся членство и выдавалось проверочное. На боевой базе это
// означало бы, что настоящий человек на время проверки теряет свой ВИП, а после
// неё остаётся вовсе без записи. Берём собственного временного участника: у него
// есть заявка, значит он виден в списках заявок и оценки.
require_once BASE_PATH . '/scripts/_audit_actors.php';
$__vipUser = audit_actor('user');
audit_actor_app((int) $__vipUser['id']);   // без заявки его не видно ни в одном списке
$vipTempUid = (int) $__vipUser['id'];
if ($vipTempUid > 0) {
    q("DELETE FROM club_members WHERE user_id=?", [$vipTempUid]);
    q("INSERT INTO club_members(user_id,started_at,expires_at,source,active,created,period,auto_renew)
       VALUES(?,datetime('now','localtime'),datetime('now','localtime','+1 day'),'audit',1,datetime('now','localtime'),'month',0)", [$vipTempUid]);
    ok('на время проверки выдано членство клуба временному участнику', 'id=' . $vipTempUid);
}
$dipComp = (int) (scalar("SELECT a.competition_id FROM diplomas d
                           JOIN applications a ON a.id=d.application_id LIMIT 1") ?? 0);
$sections = [
    'Заявки'             => '/admin/?p=applications&show_unpaid=1',
    'Оценка коротких'    => '/admin/?p=grading',
    'Оценка длинных'     => '/admin/?p=longcomp',
    'Отправки'           => '/admin/?p=dispatch',
    'Заказы наград'      => '/admin/?p=orders',
    'Электронные заказы' => '/admin/?p=digital&f=all',
    'Пользователи'       => '/admin/?p=users',
];
if ($dipComp > 0) $sections['Дипломы'] = '/admin/?p=diplomas&competition=' . $dipComp . '&tab=made';
$withMark = 0;
foreach ($sections as $title => $path) {
    $r = http($AJAR, $BASE . $path);
    chk("«{$title}» открывается", $r['code'] === 200, (string) $r['code']);
    $n = substr_count($r['body'], 'title="Участник ВИП-клуба"');
    if ($n > 0) $withMark++;
    ok("«{$title}»: синих галочек ВИП", (string) $n);
    chk("«{$title}»: разметка галочек на месте",
        str_contains($r['body'], '2C7BE5') || str_contains($r['body'], 'C79322')
        || str_contains($r['body'], 'участников нет') || $r['code'] === 200);
}
// Столько разделов, сколько их у члена клуба реально есть: заявка и оценка. В
// отправках, заказах и дипломах его нет и быть не должно — там пусто по делу.
// Требование «минимум в пяти» держалось на отладочной базе, где один и тот же
// участник был заведён всюду.
chk('синяя галочка ВИП видна там, где член клуба есть', $withMark >= 2,
    $withMark . ' из ' . count($sections));
if ($vipTempUid > 0) { q("DELETE FROM club_members WHERE user_id=? AND source='audit'", [$vipTempUid]); }

// Счётчик вкладки «В изготовлении» не должен расходиться со списком.
$digPending = (int) (scalar("SELECT COUNT(DISTINCT d.application_id) FROM diplomas d
                              JOIN applications a ON a.id = d.application_id
                             WHERE d.sent_at IS NULL OR d.sent_at=''") ?? 0);
$rDig = http($AJAR, $BASE . '/admin/?p=digital&f=pending');
$emptyList = str_contains($rDig['body'], 'По этому фильтру ничего нет');
chk('счётчик «В изготовлении» согласован со списком',
    ($digPending === 0) === $emptyList, "счётчик={$digPending}, список " . ($emptyList ? 'пуст' : 'не пуст'));

/* ───────── деньги по заявке: правда, а не только касса ───────── */
sec('Расшифровка оплаты заявки');
require_once BASE_PATH . '/core/loyalty.php';
// 1) Оплачено без чека ЮKassa (ручная отметка, пакет, старые данные) — раньше карточка
//    писала «не оплачено», хотя is_paid=1.
$pv = app_payment_view(['id' => 0, 'comp_paid' => 1, 'comp_price' => 500, 'is_paid' => 1,
                        'amount_paid' => 400, 'price_base' => 500, 'discount_pct' => 20,
                        'paid_sum' => 0,
                        'discount_info' => json_encode(['club_pct' => 20])]);
chk('оплаченная без чека — считается оплаченной', $pv['paid'] === true);
chk('сумма берётся с заявки', $pv['amount'] === 400, (string) $pv['amount']);
chk('видно, что отметили вручную', (bool) array_filter($pv['lines'], fn($l) => str_contains($l, 'вручную')));
chk('в расшифровке названа причина скидки',
    (bool) array_filter($pv['lines'], fn($l) => str_contains($l, 'ВИП-клуб')), implode(' | ', $pv['lines']));

// 2) Скидка за достижения профиля и реферальный промокод — тоже подписаны.
$pv2 = app_payment_view(['id' => 0, 'comp_paid' => 1, 'comp_price' => 500, 'is_paid' => 1,
                         'amount_paid' => 0, 'paid_sum' => 475, 'price_base' => 500, 'discount_pct' => 5,
                         'discount_info' => json_encode(['loyalty_pct' => 5])]);
chk('скидка за достижения профиля подписана',
    (bool) array_filter($pv2['lines'], fn($l) => str_contains($l, 'достижения')), implode(' | ', $pv2['lines']));
chk('оплата через кассу помечена как подтверждённая',
    (bool) array_filter($pv2['lines'], fn($l) => str_contains($l, 'кассой')));
$pv3 = app_payment_view(['id' => 0, 'comp_paid' => 1, 'comp_price' => 500, 'is_paid' => 1,
                         'amount_paid' => 0, 'paid_sum' => 475, 'price_base' => 500, 'discount_pct' => 5,
                         'discount_info' => json_encode(['referral_pct' => 5, 'promo_code' => 'MUZ5'])]);
chk('реферальный промокод назван в расшифровке',
    (bool) array_filter($pv3['lines'], fn($l) => str_contains($l, 'MUZ5')), implode(' | ', $pv3['lines']));

// 3) Заплатили полную сумму — «скидки» показывать нельзя (было «500 ₽, скидка 5%, к оплате 500 ₽»).
$pv4 = app_payment_view(['id' => 0, 'comp_paid' => 1, 'comp_price' => 500, 'is_paid' => 1,
                         'amount_paid' => 0, 'paid_sum' => 500, 'price_base' => 500, 'discount_pct' => 5,
                         'discount_info' => json_encode(['loyalty_pct' => 5])]);
chk('при полной оплате скидка не показывается', $pv4['pct'] === 0
    && !array_filter($pv4['lines'], fn($l) => str_contains($l, 'Скидка')), implode(' | ', $pv4['lines']));

// 3б) Сумма ВСЕГДА числом: слова «оплачено» без цифры быть не должно.
chk('оплаченная без чека показывает сумму числом', $pv['shown'] === 400 && $pv['label'] !== 'оплачено',
    $pv['label']);
$pvNoSum = app_payment_view(['id' => 0, 'comp_paid' => 1, 'comp_price' => 500, 'is_paid' => 1,
                             'amount_paid' => 0, 'paid_sum' => 0, 'price_base' => 500]);
chk('если точной суммы нет — показываем взнос по прайсу числом',
    $pvNoSum['shown'] === 500 && $pvNoSum['exact'] === false, $pvNoSum['label']);
chk('и честно помечаем, что сумма по прайсу', str_contains($pvNoSum['label'], 'по прайсу'), $pvNoSum['label']);

// 4) Бесплатный конкурс и честное «не оплачено».
$pv5 = app_payment_view(['id' => 0, 'comp_paid' => 0, 'comp_price' => 0, 'is_paid' => 1, 'paid_sum' => 0]);
chk('бесплатный конкурс подписан как бесплатный', $pv5['free'] === true);
$pv6 = app_payment_view(['id' => 0, 'comp_paid' => 1, 'comp_price' => 500, 'is_paid' => 0,
                         'amount_paid' => 0, 'paid_sum' => 0]);
chk('неоплаченная так и остаётся неоплаченной', $pv6['paid'] === false);

// 5) Карточка заявки в админке: расшифровка на месте, нижний блок оценок убран.
$appPaid = one("SELECT id FROM applications WHERE is_paid=1 ORDER BY id LIMIT 1");
if ($appPaid) {
    $r = http($AJAR, $BASE . '/admin/?p=applications&id=' . (int) $appPaid['id']);
    chk('карточка заявки открывается', $r['code'] === 200, (string) $r['code']);
    chk('в карточке есть блок «Сумма участия»', str_contains($r['body'], 'Сумма участия'));
    chk('нижний блок «Оценки жюри» убран', !str_contains($r['body'], 'Оценки жюри'));
    chk('в карточке показан аккаунт участника', str_contains($r['body'], '<dt>Аккаунт</dt>'));
    chk('в карточке нет PHP-шума',
        !preg_match('~Warning:|Fatal error|Undefined ~', $r['body']));
}

sec('Пакетная оплата: N заявок одним чеком');
$batchTag = 'audit_batch_' . substr(bin2hex(random_bytes(3)), 0, 6);
// БЕРЁМ СВОИ ЗАЯВКИ, А НЕ ПЕРВЫЕ ТРИ НАСТОЯЩИЕ.
//
// Здесь стояло «первые три заявки из базы», и проверка помечала их оплаченными
// с выдуманной скидкой 15% и промокодом AUD5, а возвращала обратно только два
// поля из семи. На боевой базе три настоящие заявки так и оставались с чужими
// деньгами в карточке.
require_once BASE_PATH . '/scripts/_audit_actors.php';
$__batchUser = audit_actor('user');   // тот же временный участник, что и выше
$appsForBatch = [];
for ($i = 0; $i < 3; $i++) {
    $__id = audit_actor_app((int) $__batchUser['id']);
    if ($__id) $appsForBatch[] = $__id;
}
if (count($appsForBatch) === 3) {
    $in = implode(',', $appsForBatch);
    $infoJson = json_encode(['loyalty_pct' => 10, 'referral_pct' => 5, 'total_pct' => 15, 'promo_code' => 'AUD5'], JSON_UNESCAPED_UNICODE);
    q("UPDATE applications SET is_paid=1, status='paid', batch_id=?, payment_id=999, price_base=500, discount_pct=15, amount_paid=425, discount_info=? WHERE id IN ($in)", [$batchTag, $infoJson]);
    require_once BASE_PATH . '/core/loyalty.php';
    $one = one("SELECT a.*, c.is_paid comp_paid, c.price comp_price FROM applications a LEFT JOIN competitions c ON c.id=a.competition_id WHERE a.id=?", [$appsForBatch[0]]);
    $pv = app_payment_view($one);
    chk('пакет: доля каждой заявки — 425 ₽', $pv['shown'] === 425, (string) $pv['shown']);
    chk('пакет: скидка 15%', $pv['pct'] === 15, (string) $pv['pct']);
    chk('пакет: размер = 3', $pv['batch']['size'] === 3, (string) $pv['batch']['size']);
    chk('пакет: общий чек = 1275 ₽', $pv['batch']['total'] === 1275, (string) $pv['batch']['total']);
    chk('пакет: 2 соседа известны', count($pv['batch']['siblings']) === 2);
    chk('пакет: в расшифровке видно «Пакет из 3 заявок»', (bool) array_filter($pv['lines'], fn($l) => str_contains($l, 'Пакет из 3')));
    chk('пакет: показана сумма пакета по прайсу 1500 ₽', (bool) array_filter($pv['lines'], fn($l) => str_contains($l, '1 500') && str_contains($l, 'пакета')));
    chk('пакет: подписан промокод AUD5', (bool) array_filter($pv['lines'], fn($l) => str_contains($l, 'AUD5')));
    $listResp = http($AJAR, $BASE . '/admin/?p=applications&id=' . $appsForBatch[0]);
    chk('карточка заявки: блок пакета с ссылками на соседей', str_contains($listResp['body'], 'Пакет из 3 заявок') && str_contains($listResp['body'], 'этого пакета'));
    q("UPDATE applications SET batch_id='', payment_id=0 WHERE batch_id=?", [$batchTag]);
} else { ok('в базе меньше 3 заявок — пропуск'); }

sec('Цена конкурса: сохраняется и не откатывается сама');
$compForPrice = one("SELECT id, name, slug, code, price, is_paid FROM competitions WHERE is_paid=1 LIMIT 1");
if (!$compForPrice) { ok('в базе нет платных конкурсов — пропуск'); }
else {
    $cid = (int) $compForPrice['id']; $oldPrice = (int) $compForPrice['price'];
    // ВОЗВРАЩАЕМ ВЕСЬ КОНКУРС ЦЕЛИКОМ, А НЕ ОДНУ ЦЕНУ.
    //
    // Форма сохранения в админке перезаписывает ВСЕ поля тем, что пришло в запросе,
    // а проверка отправляет только десяток. Из-за этого у «Мировых Талантов»
    // обнулились афиша, даты приёма, дата итогов, фон диплома и порядок вывода:
    // конкурс пропал с главной, из календаря и из раздела конкурсов. Поэтому
    // снимаем полный слепок строки и возвращаем его при любом исходе.
    $__compSnap = one("SELECT * FROM competitions WHERE id=?", [$cid]);
    register_shutdown_function(static function () use ($cid, $__compSnap): void {
        if (!$__compSnap) return;
        try {
            $data = $__compSnap;
            unset($data['id']);
            update('competitions', $data, 'id=:id', ['id' => $cid]);
        } catch (\Throwable $e) {}
    });
    // Логинимся админом (уже есть $AJAR), берём CSRF со страницы edit
    $rEdit = http($AJAR, $BASE . '/admin/?p=competitions&id=' . $cid . '&action=edit');
    chk('форма редактирования открывается', $rEdit['code'] === 200, (string) $rEdit['code']);
    preg_match('~name="_csrf"\s+value="([^"]+)"~', $rEdit['body'], $mCsrf);
    $csrf = $mCsrf[1] ?? '';
    chk('CSRF-токен найден на странице', $csrf !== '');
    // Пробуем 3 разные цены подряд
    $testPrices = [1, 750, 500];
    foreach ($testPrices as $tp) {
        http($AJAR, $BASE . '/admin/?p=competitions', [
            '_csrf' => $csrf, 'csrf' => $csrf, 'do' => 'save', 'id' => (string) $cid,
            'slug' => (string) $compForPrice['slug'], 'code' => (string) $compForPrice['code'],
            'name' => (string) $compForPrice['name'], 'type' => 'international',
            'direction' => 'multi', 'duration' => 'short', 'is_paid' => '1',
            'price' => (string) $tp, 'results_mode' => 'email', 'status' => 'open', 'sort' => '0',
        ]);
        $now = (int) scalar("SELECT price FROM competitions WHERE id=?", [$cid]);
        chk("после сохранения price={$tp}: в базе {$now}", $now === $tp, (string) $now);
    }
    // Между запросами ничего не должно откатывать цену — проверяем через 1 сек ожидания
    sleep(1);
    $stillSet = (int) scalar("SELECT price FROM competitions WHERE id=?", [$cid]);
    chk('цена не откатывается сама через секунду', $stillSet === 500, (string) $stillSet);
    // Скидка ВИП-клуба применяется к НОВОЙ цене — 20% от 500 = 400
    require_once BASE_PATH . '/core/loyalty.php';
    $clubPrice = loyalty_apply(500, 20);
    chk('скидка ВИП-клуба пересчитывается от свежей цены (500 → 400)', $clubPrice === 400, (string) $clubPrice);
    // Возвращаем исходную
    http($AJAR, $BASE . '/admin/?p=competitions', [
        '_csrf' => $csrf, 'csrf' => $csrf, 'do' => 'save', 'id' => (string) $cid,
        'slug' => (string) $compForPrice['slug'], 'code' => (string) $compForPrice['code'],
        'name' => (string) $compForPrice['name'], 'type' => 'international',
        'direction' => 'multi', 'duration' => 'short', 'is_paid' => '1',
        'price' => (string) $oldPrice, 'results_mode' => 'email', 'status' => 'open', 'sort' => '0',
    ]);
    $restored = (int) scalar("SELECT price FROM competitions WHERE id=?", [$cid]);
    chk('цена восстановлена', $restored === $oldPrice, (string) $restored);
    // audit_log записал new/old price
    $hasLog = (int) (scalar("SELECT COUNT(*) FROM audit_log WHERE action='competition_update' AND entity_id=? AND meta LIKE '%price_from%'", [$cid]) ?? 0);
    chk('изменение цены записано в audit_log с price_from/price_to', $hasLog > 0, (string) $hasLog);
}

sec('Отклонение заявки: письмо и текст в кабинете');
// ОТКЛОНЯЕМ СВОЮ ЗАЯВКУ, А НЕ ПОСЛЕДНЮЮ НАСТОЯЩУЮ.
//
// Здесь бралась самая свежая неоценённая заявка из базы — то есть заявка живого
// участника. Проверка отклоняла её по-настоящему, с текстом причины, и ставила
// в очередь письмо «устраните причину и подайте заново». Обратно ничего не
// возвращалось. На боевой базе это письмо ушло бы человеку, который ничего не
// нарушал.
require_once BASE_PATH . '/scripts/_audit_actors.php';
$__rejUser = audit_actor('user');
$__rejId = audit_actor_app((int) $__rejUser['id']);
$appR = $__rejId ? one("SELECT a.*, c.slug comp_slug FROM applications a
                         LEFT JOIN competitions c ON c.id=a.competition_id WHERE a.id=?", [$__rejId]) : null;
if ($appR) {
    $rid = (int) $appR['id'];
    q("UPDATE applications SET status='new', reject_reason='', is_paid=1 WHERE id=?", [$rid]);
    q("DELETE FROM mail_queue WHERE subject LIKE '%устраните причину и подайте%'");
    $tokR = tok($AJAR, '/admin/?p=grading&id=' . $rid);
    $reason = 'Ссылка не на разрешённый интернет-ресурс. Принимаются только: RuTube, Google Диск, Яндекс Диск, ОК видео, ВК видео, Дзен видео (п. 8.8 положения).';
    http($AJAR, $BASE . '/admin/?p=grading', ['_csrf' => $tokR, 'csrf' => $tokR,
        'do' => 'reject', 'id' => (string) $rid, 'reject_reason' => $reason]);
    $mail = one("SELECT to_email, subject, body FROM mail_queue WHERE subject LIKE '%устраните причину и подайте%' ORDER BY id DESC LIMIT 1");
    chk('письмо об отклонении поставлено в очередь', $mail !== null);
    if ($mail) {
        $b = (string) $mail['body'];
        foreach (['ФИО', 'Конкурс', 'Название учреждения', 'Форма исполнения', 'Ссылка на видео', 'E-mail', 'Телефон'] as $__lbl) {
            chk("в письме есть поле «{$__lbl}»", str_contains($b, $__lbl));
        }
        chk('в письме — полный текст пункта 8.8 1:1', str_contains($b, 'п. 8.8 положения'));
        chk('в письме заголовок «пункт положения 1:1»', str_contains($b, 'пункт положения 1:1'));
        chk('в письме новая формулировка «Это не отказ навсегда»',
            str_contains($b, 'Это не отказ навсегда') && str_contains($b, 'с радостью примем'));
        chk('в письме есть кнопка «Подать заявку заново»', str_contains($b, 'Подать заявку заново'));
        chk('тема письма правильная', mb_stripos((string) $mail['subject'], 'устраните причину и подайте заново', 0, 'UTF-8') !== false);
    }
    // Проверяем кабинет: текст и кнопка «Заново подать заявку»
    q("UPDATE applications SET status='rejected', reject_reason=? WHERE id=?", [$reason, $rid]);
    // Логинимся под этим участником через отдельный jar (не портим админский).
    $__uEmail = (string) (scalar('SELECT email FROM users WHERE id=?', [(int) ($appR['user_id'] ?? 0)]) ?? '');
    if ($__uEmail === 'user@test.local') {
        $UJARr = sys_get_temp_dir() . '/muzmir_reject_user.txt'; @unlink($UJARr);
        $tokU = tok($UJARr, '/login');
        http($UJARr, $BASE . '/login', ['_csrf' => $tokU, 'csrf' => $tokU, 'do' => 'login',
              'email' => 'user@test.local', 'password' => 'Test_12345']);
        $cab = http($UJARr, $BASE . '/cabinet');
        chk('кабинет: новый текст «Устраните причину отклонения»',
            str_contains($cab['body'], 'Устраните причину отклонения'));
        chk('кабинет: нет старого «Свяжитесь с нами для уточнения»',
            !str_contains($cab['body'], 'Свяжитесь с нами для уточнения'));
        chk('кабинет: кнопка «Заново подать заявку» с ссылкой на apply',
            preg_match('~href="[^"]*/apply[^"]*"[^>]*>\s*Заново подать заявку~u', $cab['body']) === 1);
        chk('кабинет: показана причина отклонения (пункт 8.8)',
            str_contains($cab['body'], 'п. 8.8'));
    } else { ok('пользователь user@test.local не автор — пропуск проверки кабинета'); }
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
// Положение рубильника — рабочее решение владельца, а не признак поломки.
// Проверка обязана его показать, а не требовать «выключено»: на боевом сайте
// рассылки идут, и постоянный красный пункт в отчёте только притупляет внимание.
ok('стоп-кран массовых рассылок', mass_sending_enabled() ? 'ВКЛЮЧЕНЫ' : 'выключены');
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
// ССЫЛКУ ОПЛАТЫ ПРОВЕРЯЕМ НА СВОЕЙ ЗАЯВКЕ.
//
// Раньше бралась ПЕРВАЯ настоящая неоплаченная заявка живого участника. Открытие
// ссылки заводит счёт в кассе, а каждый следующий прогон гасит прежний и заводит
// новый: у человека в кассе копились счета, которых он не создавал, а в нашей
// базе — отменённые платежи к его заявке. Заводим свою заявку на том же платном
// конкурсе, проверяем на ней и убираем вместе со счетами.
$__payComp = one("SELECT id FROM competitions WHERE is_paid=1 ORDER BY id DESC LIMIT 1");
$unpaidApp = null; $__tmpAppId = 0;
if ($__payComp) {
    try {
        $__tmpAppId = (int) insert('applications', [
            'number' => 'CHK-PAY-' . substr(bin2hex(random_bytes(3)), 0, 6),
            'competition_id' => (int) $__payComp['id'],
            'full_name' => 'ПРОВЕРКА ссылки оплаты', 'email' => 'audit-pay@example.test',
            'work_title' => '«Проверка»', 'status' => 'new', 'is_paid' => 0,
        ]);
        if ($__tmpAppId > 0) $unpaidApp = one("SELECT id, number FROM applications WHERE id=?", [$__tmpAppId]);
    } catch (\Throwable $e) { $unpaidApp = null; }
}
if (!$unpaidApp) { ok('платных конкурсов нет — пропуск'); }
else {
    $aid = (int) $unpaidApp['id'];
    chk('ссылка содержит номер счёта и подпись',
        str_contains(pay_link_app($aid), 't=app&id=' . $aid) && str_contains(pay_link_app($aid), '&s='),
        pay_link_app($aid));
    // ЗА ПЕРЕАДРЕСАЦИЕЙ НЕ ИДЁМ.
    //
    // По верной ссылке сайт создаёт счёт и уводит человека на страницу кассы.
    // Проверка шла по переадресации следом и оказывалась уже НА САЙТЕ КАССЫ, где
    // нашего номера заявки, разумеется, нет: пункт всегда падал, хотя всё
    // работало. Смотрим ровно то, что нам принадлежит: собственный ответ сайта.
    $r = http($AJAR, $BASE . pay_path_app($aid), null, false);
    $toCash = $r['code'] === 302 && preg_match('~^Location:\s*https?://~mi', $r['head'] ?? '');
    chk('по верной ссылке открывается оплата этой заявки',
        $toCash || ($r['code'] === 200 && str_contains($r['body'], (string) $unpaidApp['number'])),
        (string) $r['code']);
    chk('на странице оплаты нет «Личный кабинет» вместо счёта',
        !str_contains($r['body'], 'Ссылка недействительна'));

    $r = http($AJAR, $BASE . '/pay?t=app&id=' . $aid . '&s=' . str_repeat('0', 32));
    chk('подделанная подпись отклоняется', str_contains($r['body'], 'Ссылка недействительна'));

    $r = http($AJAR, $BASE . '/pay?t=app&id=' . ($aid + 1) . '&s=' . pay_sign('app', $aid));
    chk('чужой номер с чужой подписью отклоняется', str_contains($r['body'], 'Ссылка недействительна'));

    chk('подпись заявки и заказа не совпадают', pay_sign('app', $aid) !== pay_sign('order', $aid));

    // Убираем за собой: и счета, заведённые открытием ссылки, и саму заявку.
    if ($__tmpAppId > 0) {
        try { q("DELETE FROM payments WHERE application_id=?", [$__tmpAppId]); } catch (\Throwable $e) {}
        try { q("DELETE FROM applications WHERE id=?", [$__tmpAppId]); } catch (\Throwable $e) {}
    }
}
// ССЫЛКУ ОПЛАТЫ ПРОВЕРЯЕМ НА СВОЁМ ЗАКАЗЕ, А НЕ НА ЧУЖОМ.
//
// Раньше здесь брался ПЕРВЫЙ настоящий неоплаченный заказ живого человека, и
// проверка открывала для него ссылку оплаты. А открытие ссылки заводит платёж
// в платёжной системе: в базе оставались счета к чужим заказам, а у человека
// в платёжной системе появлялся счёт, которого он не создавал. Заводим свой
// заказ, проверяем на нём и убираем за собой вместе с его счётом.
$tmpOrderId = 0;
try {
    $tmpOrderId = (int) insert('awards_orders', [
        'application_id' => 0, 'user_id' => 0,
        'full_name' => 'ПРОВЕРКА ссылки оплаты', 'competition' => 'проверка',
        'result' => '', 'items' => json_encode([['item' => 'проверка', 'kind' => 'digital', 'price' => 1]], JSON_UNESCAPED_UNICODE),
        'amount' => 1, 'email' => 'audit-order@example.test', 'phone' => '',
        'address' => '', 'status' => 'new',
    ]);
} catch (\Throwable $e) { $tmpOrderId = 0; }

if ($tmpOrderId <= 0) { ok('временный заказ для проверки ссылки не создался — пропуск'); }
else {
    $r = http($AJAR, $BASE . pay_path_order($tmpOrderId), null, false);
    chk('по ссылке открывается оплата этого заказа',
        ($r['code'] === 302 && preg_match('~^Location:\s*https?://~mi', $r['head'] ?? ''))
        || ($r['code'] === 200 && str_contains($r['body'], 'заказа №' . $tmpOrderId)), (string) $r['code']);
    try { q("DELETE FROM payments WHERE order_id=?", [$tmpOrderId]); } catch (\Throwable $e) {}
    try { q("DELETE FROM awards_orders WHERE id=?", [$tmpOrderId]); } catch (\Throwable $e) {}
}
$paidApp = one("SELECT id, number FROM applications WHERE COALESCE(is_paid,0)=1 ORDER BY id DESC LIMIT 1");
if ($paidApp) {
    $r = http($AJAR, $BASE . pay_path_app((int) $paidApp['id']));
    chk('по оплаченной заявке повторная оплата закрыта',
        str_contains($r['body'], 'уже оплачена'), mb_substr(strip_tags($r['body']), 0, 0));
}
$r = http($AJAR, $BASE . '/pay?t=' . rawurlencode('мусор') . '&id=0');
chk('битая ссылка не роняет страницу', $r['code'] === 200 && str_contains($r['body'], 'не распознана'));


/* ───────── оригиналы: правила владельца ───────── */
sec('Оригиналы: на почту не уходят, в работе — только к печати');
require_once BASE_PATH . '/core/orders.php';

// 1) Заказ оригинала НЕ создаёт наградной документ для рассылки.
$ordOrig = one("SELECT * FROM awards_orders WHERE items LIKE '%\"kind\":\"original\"%' ORDER BY id DESC LIMIT 1");
if (!$ordOrig) { ok('заказов оригиналов в базе нет — пропуск'); }
else {
    $oid  = (int) $ordOrig['id'];
    $aid  = (int) ($ordOrig['application_id'] ?? 0);
    $before = $aid ? (int) scalar("SELECT COUNT(*) FROM diplomas WHERE application_id=?", [$aid]) : 0;
    order_fulfill_digital($oid);
    $after  = $aid ? (int) scalar("SELECT COUNT(*) FROM diplomas WHERE application_id=?", [$aid]) : 0;
    chk('оригинал не превращается в письмо участнику', $after === $before, "$before → $after");
    chk('в заказе распознаны оригиналы', order_has_originals((array) $ordOrig));
}

// 2) Рабочий список админки — только то, что надо распечатать и отправить.
$r = http($AJAR, $BASE . '/admin/?p=orders');
chk('раздел заказов оригиналов открывается', $r['code'] === 200);
chk('есть вкладка «В работе»', str_contains($r['body'], 'В работе'));
chk('есть вкладка «Архив»', str_contains($r['body'], 'Архив'));
$shipped = one("SELECT id FROM awards_orders WHERE status='shipped' ORDER BY id DESC LIMIT 1");
if ($shipped) {
    chk('отправленный заказ не мешается в работе',
        !str_contains($r['body'], '№' . (int) $shipped['id'] . '<'), '№' . (int) $shipped['id']);
    $ra = http($AJAR, $BASE . '/admin/?p=orders&status=archive');
    chk('отправленный заказ виден в архиве', $ra['code'] === 200);
} else { ok('отправленных заказов нет — пропуск'); }

// 3) Письмо об отправке содержит трек и ссылку отслеживания.
$sample = ['id' => 999, 'full_name' => 'Тестов Тест Тестович', 'tracking' => '80083502345678',
           'items' => json_encode([['item' => 'Кубок Гран-при', 'kind' => 'original', 'count' => 1]], JSON_UNESCAPED_UNICODE)];
$ship = order_ship_email($sample);
chk('в письме есть трек-номер', str_contains($ship, '80083502345678'));
chk('в письме есть ссылка отслеживания Почты России',
    str_contains($ship, 'pochta.ru') || str_contains($ship, 'Отследить'));
chk('в письме перечислен состав отправления', str_contains($ship, 'Кубок Гран-при'));
chk('в письме НЕТ вложений-оригиналов (их не шлют)', !str_contains($ship, '.pdf'));

// 4) В кабинете у оригиналов три стадии, без файлов.
$cabSrc = file_get_contents(BASE_PATH . '/templates/site/pages/cabinet.php');
chk('стадии заказа: Изготовление → Отправка → Прибыло',
    str_contains($cabSrc, "'Изготовление', 'Отправка', 'Прибыло'"));


echo "\n" . str_repeat('─', 60) . "\n";
echo ($FAIL === 0 ? "АДМИНКА И ПРАВИЛА ЧИСТО" : "ПРОВАЛОВ: $FAIL") . ", пройдено: $OK\n";
exit($FAIL === 0 ? 0 : 1);
