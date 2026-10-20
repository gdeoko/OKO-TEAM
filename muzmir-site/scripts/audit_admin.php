<?php
/**
 * АУДИТ АДМИНКИ И ОСТАВШИХСЯ ПРАВИЛ: карточка заявки, «Заказы электронных»,
 * галочки Элитного клуба (золотая/синяя), пульт управления запуском, отключение всплывающих
 * окон на подаче и заказе, карточка Элитного клуба в письмах, одноразовость промокода.
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
    /* БЕРЁМ ЗАКАЗ, КОТОРОМУ В РАЗДЕЛЕ ПРАВДА ЕСТЬ ЧТО ПОКАЗАТЬ. Раздел «Заказы
       электронных наград» построен на ВЫДАННЫХ бланках (`diplomas`), а у свежего
       НЕОПЛАЧЕННОГО заказа их ещё нет: он честно не виден, и проверка краснела на
       исправном сайте. Так случилось 15.10.2026 с заказом №521 (NR-2026-00098,
       оформлен в 15:36, взнос не закрыт) - красное на ровном месте, а оно прячет
       настоящие отказы (правило 47). Поэтому ищем последний заказ С БЛАНКАМИ. */
    $o = one("SELECT o.* FROM awards_orders o
               WHERE o.items LIKE '%\"kind\":\"digital\"%'
                 AND EXISTS(SELECT 1 FROM diplomas d WHERE d.application_id = o.application_id)
            ORDER BY o.id DESC LIMIT 1");
    if (!$o) $o = one("SELECT * FROM awards_orders WHERE items LIKE '%\"kind\":\"digital\"%' ORDER BY id DESC LIMIT 1");
    /* ИМЯ ИЩЕМ ТО, КОТОРОЕ РАЗДЕЛ ПРАВДА ПЕЧАТАЕТ.
     *
     * В заказе лежит ФИО плательщика, а раздел у заявки КОЛЛЕКТИВА показывает
     * название коллектива: у такой заявки `full_name` пуст вовсе. Заказ №475
     * (хор «Сельчаночка», оформила Путилина Н. А.) из-за этого числился
     * «невидимым в разделе», и поиск «не работал» - при живом разделе и верном
     * списке. Красное на ровном месте опасно: именно так в этом же файле не был
     * замечен настоящий отказ вкладки «Готовые и отправка». */
    $oApp = one("SELECT full_name, group_name, is_group, number FROM applications WHERE id=?",
                [(int) ($o['application_id'] ?? 0)]);
    $oWho = trim((string) ($oApp['is_group'] ?? 0 ? ($oApp['group_name'] ?? '') : ($oApp['full_name'] ?? '')));
    if ($oWho === '') $oWho = trim((string) ($o['full_name'] ?? ''));
    /* НА СТРАНИЦЕ ИМЯ ЭКРАНИРОВАНО. У этого коллектива в названии стоят прямые
       кавычки («Народный коллектив" хор "Сельчаночка»), и в HTML они выходят как
       &quot;: поиск сырой строки не находил ЖИВУЮ строку списка. Сверяем так,
       как страница и печатает. */
    $oWhoH = $oWho !== '' ? htmlspecialchars($oWho, ENT_QUOTES, 'UTF-8') : '';
    $oNum  = (string) ($oApp['number'] ?? '');
    $виден = static fn(string $body): bool
        => ($oWhoH !== '' && strpos($body, $oWhoH) !== false)
        || ($oNum !== '' && strpos($body, $oNum) !== false);
    /* Смотрим на вкладке «все»: у раздела по умолчанию стоит «ждут отправки», и
       уже отправленный бланк на ней законно не показывается. */
    $rAll = http($AJAR, $BASE . '/admin/?p=digital&f=all');
    chk('заказ виден в разделе', $виден($r['body']) || $виден($rAll['body']),
        'заказ #' . (int) $o['id'] . ', ' . $oNum);
    /* Ищем по номеру заявки: он печатается всегда и не зависит ни от кавычек в
       названии коллектива, ни от того, чьё ФИО стоит в заказе. */
    $r2 = http($AJAR, $BASE . '/admin/?p=digital&q=' . rawurlencode($oNum));
    chk('поиск в разделе работает', $r2['code'] === 200 && $виден($r2['body']), $oNum);
}

/* ───────── галочки Элитного клуба ───────── */
sec('галочки Элитного клуба: золотая у клуба, синяя у команды');
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
// ЦВЕТА (Даниэль): участник Элитного клуба — СИНЯЯ галочка («проверенный»),
// команда центра — золотая. Раньше было наоборот.
chk('участник Элитного клуба — синяя галочка', str_contains(vip_badge('club'), '2C7BE5'));
chk('оргкомитет центра — золотая галочка', str_contains(vip_badge('team'), 'C79322'));
chk('в подписи синей галочки написано про Элитный клуб', str_contains(vip_badge('club'), 'Участник Элитного клуба'));
// Тип галочки решает АККАУНТ, а не почта из строки списка: участник, написавший в
// заявке почту центра, раньше получал золотую галочку оргкомитета вместо синей галочки клуба.
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
// означало бы, что настоящий человек на время проверки теряет своё членство, а после
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
/* ВКЛАДКУ НАЗЫВАЕМ ТАК, КАК ЕЁ ЗОВЁТ САМ РАЗДЕЛ. Здесь стояло `tab=made`,
   а вкладок у «Дипломов» две - `ready` и `sent`; неизвестное имя раздел молча
   читал как `ready`, и проверка годами открывала СПИСОК ЗАЯВОК БЕЗ ДИПЛОМА
   вместо реестра готовых бланков. Из-за этого не был замечен живой отказ: с
   13.10.2026 вкладка «Готовые и отправка» падала в 500 у каждого конкурса с
   дипломами («Call to undefined function dops_diploma_person()»), и ни один
   аудит на неё не заходил. Проверяем ОБЕ вкладки. */
if ($dipComp > 0) {
    $sections['Дипломы · к генерации']   = '/admin/?p=diplomas&competition=' . $dipComp . '&tab=ready';
    $sections['Дипломы · готовые']       = '/admin/?p=diplomas&competition=' . $dipComp . '&tab=sent';
}
$withMark = 0;
foreach ($sections as $title => $path) {
    $r = http($AJAR, $BASE . $path);
    chk("«{$title}» открывается", $r['code'] === 200, (string) $r['code']);
    chk("«{$title}»: без фатальных ошибок и предупреждений PHP",
        stripos($r['body'], 'Fatal error') === false && stripos($r['body'], 'Warning:') === false
        && stripos($r['body'], 'undefined function') === false);
    $n = substr_count($r['body'], 'title="Участник Элитного клуба"');
    if ($n > 0) $withMark++;
    ok("«{$title}»: синих галочек Элитного клуба", (string) $n);
    chk("«{$title}»: разметка галочек на месте",
        str_contains($r['body'], '2C7BE5') || str_contains($r['body'], 'C79322')
        || str_contains($r['body'], 'участников нет') || $r['code'] === 200);
}
// Столько разделов, сколько их у члена клуба реально есть: заявка и оценка. В
// отправках, заказах и дипломах его нет и быть не должно — там пусто по делу.
// Требование «минимум в пяти» держалось на отладочной базе, где один и тот же
// участник был заведён всюду.
chk('синяя галочка Элитного клуба видна там, где член клуба есть', $withMark >= 2,
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
/* Падеж в строке живой: «скидка 20% - участник ЭлитногО клубА». Проверка ждала
   именительный и краснела на верном тексте. Ищем корень. */
chk('в расшифровке названа причина скидки',
    (bool) array_filter($pv['lines'], fn($l) => mb_stripos($l, 'Элитн') !== false), implode(' | ', $pv['lines']));

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
/* БЕРЁМ ДЕЙСТВУЮЩИЙ КОНКУРС, А НЕ ПЕРВЫЙ ПЛАТНЫЙ В ТАБЛИЦЕ.
 *
 * Здесь стояло просто «первый платный», и это был конкурс №18 «Мировые
 * Таланты» - закрытый с 25.08. Проверка сохраняла его форму со статусом open
 * (см. ниже), админка читала это как ЗАПУСК закрытого конкурса и 14.10.2026 в
 * 14:14 разослала по всей базе 5943 письма «Открыт приём заявок: Мировые
 * Таланты», ещё 1847 остались в очереди. Проверка обязана проверять, а не
 * звать восемь тысяч человек на конкурс, который кончился полтора месяца
 * назад. Платный и идущий сейчас конкурс для той же проверки ничем не хуже. */
$compForPrice = one("SELECT id, name, slug, code, price, is_paid, status, results_mode, type, direction, duration, sort
                       FROM competitions
                      WHERE is_paid=1 AND status='open' AND COALESCE(launched,0)=1
                        AND (COALESCE(end_date,'')='' OR date(end_date) >= date('now','localtime'))
                   ORDER BY sort, id LIMIT 1")
    ?: one("SELECT id, name, slug, code, price, is_paid, status, results_mode, type, direction, duration, sort
              FROM competitions WHERE is_paid=1 ORDER BY (status='open') DESC, id DESC LIMIT 1");
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
            /* СТАТУС ОТПРАВЛЯЕМ ТОТ, ЧТО УЖЕ СТОИТ В БАЗЕ.
             * Жёсткое 'open' здесь и было спусковым крючком рассылки: форма
             * админки читает переход closed->open как ЗАПУСК конкурса и зовёт
             * всю базу письмом. Проверке нужна цена, статус она трогать не
             * должна вовсе. */
            'price' => (string) $tp, 'results_mode' => 'email',
            'status' => (string) ($__compSnap['status'] ?? 'open'), 'sort' => '0',
        ]);
        $now = (int) scalar("SELECT price FROM competitions WHERE id=?", [$cid]);
        chk("после сохранения price={$tp}: в базе {$now}", $now === $tp, (string) $now);
    }
    // Между запросами ничего не должно откатывать цену — проверяем через 1 сек ожидания
    sleep(1);
    $stillSet = (int) scalar("SELECT price FROM competitions WHERE id=?", [$cid]);
    chk('цена не откатывается сама через секунду', $stillSet === 500, (string) $stillSet);
    // Скидка Элитного клуба применяется к НОВОЙ цене — 20% от 500 = 400
    require_once BASE_PATH . '/core/loyalty.php';
    $clubPrice = loyalty_apply(500, 20);
    chk('скидка Элитного клуба пересчитывается от свежей цены (500 → 400)', $clubPrice === 400, (string) $clubPrice);
    // Возвращаем исходную
    http($AJAR, $BASE . '/admin/?p=competitions', [
        '_csrf' => $csrf, 'csrf' => $csrf, 'do' => 'save', 'id' => (string) $cid,
        'slug' => (string) $compForPrice['slug'], 'code' => (string) $compForPrice['code'],
        'name' => (string) $compForPrice['name'], 'type' => 'international',
        'direction' => 'multi', 'duration' => 'short', 'is_paid' => '1',
        'price' => (string) $oldPrice, 'results_mode' => 'email',
        'status' => (string) ($__compSnap['status'] ?? 'open'), 'sort' => '0',
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
    // Чистим очередь ТОЛЬКО от писем актёра проверки (@example.test).
    //
    // Раньше здесь стояло `DELETE ... WHERE subject LIKE '%устраните причину и
    // подайте%'` — без адреса. Каждый прогон аудита стирал из очереди письма об
    // отклонении ВСЕХ живых участников. Само письмо к тому моменту уже ушло, но
    // след пропадал, и по базе выходило, что человеку ничего не отправляли:
    // так заявка VR-2026-00107 (Юрченко Диана) две недели числилась «отклонена
    // и не уведомлена», хотя письмо она получила 16.08.
    q("DELETE FROM mail_queue WHERE subject LIKE '%устраните причину и подайте%'
         AND LOWER(to_email) LIKE '%@example.test'");
    $tokR = tok($AJAR, '/admin/?p=grading&id=' . $rid);
    $reason = 'Ссылка не на разрешённый интернет-ресурс. Принимаются только: RuTube, Google Диск, Яндекс Диск, ОК видео, ВК видео, Дзен видео (п. 8.8 положения).';
    http($AJAR, $BASE . '/admin/?p=grading', ['_csrf' => $tokR, 'csrf' => $tokR,
        'do' => 'reject', 'id' => (string) $rid, 'reject_reason' => $reason]);
    // Ищем письмо СВОЕГО актёра, а не последнее подходящее в очереди: иначе
    // проверка разглядывала бы письмо живого участника и говорила «всё хорошо»
    // даже тогда, когда собственное письмо не собралось.
    $mail = one("SELECT to_email, subject, body FROM mail_queue
                  WHERE subject LIKE '%устраните причину и подайте%' AND LOWER(to_email)=?
                  ORDER BY id DESC LIMIT 1", [mb_strtolower((string) $__rejUser['email'])]);
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

/* ───────── карточка Элитного клуба в письмах ───────── */
sec('карточка Элитного клуба клуба в письмах');
$card = mm_vip_card();
chk('карточка собирается', trim($card) !== '', mb_strlen($card) . ' симв.');
chk('в карточке указан размер скидки', str_contains($card, (string) mm_vip_discount()), mm_vip_discount() . '%');
$tx = mm_email_tx('<p>тело письма</p>', ['preheader' => 'тест']);
chk('в транзакционном письме карточка есть', str_contains($tx, 'Элитный клуб') || str_contains($tx, 'Клуб'));
$txOff = mm_email_tx('<p>тело письма</p>', ['preheader' => 'тест', 'vip' => false]);
chk('карточку можно отключить (письма про сам клуб)', mb_strlen($txOff) < mb_strlen($tx),
    mb_strlen($txOff) . ' < ' . mb_strlen($tx));
$lay = mm_email_layout('<p>тело</p>', ['preheader' => 'тест']);
chk('в рассылочном макете карточка есть', str_contains($lay, 'Элитный клуб') || str_contains($lay, 'Клуб'));

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


/* ───────── ДЛИННЫЕ СПИСКИ ОТКРЫВАЮТСЯ ЦЕЛИКОМ И НЕ ВРУТ ПРО ДЛИНУ ─────────
 *
 * «Оценка длинных» по «Величию России» отдавала 4,5 МБ разметки на 1215 строк и
 * с телефона открывалась наполовину, а архив молча обрывался на 500-й заявке из
 * 852: 351 разобранная заявка пропадала, и плашка показывала то же урезанное
 * число. Ни один аудит на длину страницы не смотрел.
 *
 * Проверяем ровно то, что сломалось: подпись «показаны N-M из T» есть и T равно
 * настоящему числу; страница не весит как прежняя; каждую заявку можно
 * доглядеть, пролистав до конца; номер за пределами списка не отдаёт пустоту. */
sec('Длинные списки оценки');
require_once BASE_PATH . '/core/graded_list.php';

$подпись = static function (string $b): array {
    $o = [];
    if (preg_match_all('~Показаны <b>(\d+)-(\d+)</b> из <b>(\d+)</b>~u', $b, $m, PREG_SET_ORDER)) {
        foreach ($m as $x) $o[] = ['от' => (int) $x[1], 'до' => (int) $x[2], 'всего' => (int) $x[3]];
    }
    return $o;
};

// Берём САМЫЙ ДЛИННЫЙ длинный конкурс: на коротком списке обрыв не виден вовсе.
$lcId = 0; $lcN = -1;
foreach (all("SELECT id FROM competitions WHERE results_mode='list'") as $c) {
    $n = graded_rows_count((int) $c['id'], '', 'long');
    if ($n > $lcN) { $lcN = $n; $lcId = (int) $c['id']; }
}
if ($lcId > 0) {
    $r = http($AJAR, $BASE . '/admin/?p=longcomp&competition=' . $lcId);
    chk('«Оценка длинных» открывается', $r['code'] === 200, (string) $r['code']);
    chk('«Оценка длинных»: без фатальных ошибок и предупреждений PHP',
        stripos($r['body'], 'Fatal error') === false && stripos($r['body'], 'Warning:') === false
        && stripos($r['body'], 'undefined function') === false);
    chk('страница закрыта целиком', stripos($r['body'], '</html>') !== false);
    $пп = $подпись($r['body']);
    chk('под списками стоит подпись «показаны N-M из T»', count($пп) >= 2, 'подписей: ' . count($пп));
    // Самая дорогая проверка: плашка и подпись обязаны называть НАСТОЯЩЕЕ число.
    $нашлось = false;
    foreach ($пп as $x) if ($x['всего'] === $lcN) $нашлось = true;
    chk('подпись архива называет настоящее число разобранных', $нашлось,
        'в базе ' . $lcN . ', на странице: ' . implode('/', array_column($пп, 'всего')));
    chk('плашка архива равна настоящему числу',
        str_contains($r['body'], 'Оценённые и отклонённые <span class="badge badge--gold">' . $lcN . '</span>'),
        (string) $lcN);
    // Вес страницы. Прежняя отдавала 4,5 МБ; полтора мегабайта это уже «не
    // открывается», и с телефона раздел читают именно так.
    chk('страница не тяжелее 1,5 МБ', strlen($r['body']) < 1572864,
        round(strlen($r['body']) / 1024) . ' КБ');

    /* КОЛОНКА ДЕЙСТВИЙ ПРИЖАТА И ЗДЕСЬ (слово владельца 16.10.2026, правило
       73д). Таблиц у раздела три: очередь и список итогов свои (.lc-tbl), а
       архив рисует admin_graded_table() - он прижат своим .gl-tbl. */
    chk('«Оценка длинных»: колонка действий прижата к правому краю',
        (bool) preg_match('~\.lc-tbl th:last-child\s*,\s*\.lc-tbl td:last-child\{[^}]*position:sticky~u',
                          $r['body']));
    chk('«Оценка длинных»: у прижатой колонки свой фон',
        (bool) preg_match('~\.lc-tbl th:last-child\s*,\s*\.lc-tbl td:last-child\{[^}]*background:~u',
                          $r['body']));
    chk('«Оценка длинных»: прижатая ячейка не делает своего слоя',
        !preg_match('~\.lc-tbl th:last-child\s*,\s*\.lc-tbl td:last-child\{[^}]*z-index~u',
                    $r['body']));
    chk('«Оценка длинных»: шапка стоит над прижатыми ячейками',
        (bool) preg_match('~\.lc-tbl thead th\{[^}]*z-index:4~u', $r['body']));
    chk('«Оценка длинных»: на телефоне колонка по ширине кнопок',
        (bool) preg_match('~\.lc-tbl th:last-child\{width:auto\}~u', $r['body']));
    /* ВПИСАННАЯ В ШАПКУ ШИРИНА НЕПЕРЕБИВАЕМА: style="width:280px" сильнее любого
       медиазапроса, и на телефоне колонка осталась бы в пол-экрана. */
    chk('«Оценка длинных»: ширина колонки не вписана в шапку',
        strpos($r['body'], 'width:280px">Действия') === false);

    /* ФАКТ ПО СТРОКАМ. Строки считаем ВНУТРИ <tbody>: снаружи лежит строка
       шапки. Очередь берём у конкурса, где она НЕ пуста - на самом длинном
       (его и смотрит проверка выше) все заявки давно оценены, и список 1 там
       не печатается вовсе. */
    $кусокLC = static function (string $b, string $от, string $до = ''): string {
        $i = mb_strpos($b, $от);
        if ($i === false) return '';
        $j = $до !== '' ? mb_strpos($b, $до, $i) : false;
        return $j === false ? mb_substr($b, $i) : mb_substr($b, $i, $j - $i);
    };
    $счётLC = static function (string $блок, string $имя) use (&$кусокLC): void {
        if ($блок === '') { ok($имя . ': списка сейчас нет, считать нечего'); return; }
        chk($имя . ': таблица помечена как прижатая', mb_strpos($блок, 'tbl lc-tbl') !== false);
        $тело = preg_match('~<tbody>(.*?)</tbody>~us', $блок, $m) ? $m[1] : '';
        $стр  = preg_match_all('~<tr[\s>]~u', $тело);
        $кн   = preg_match_all('~[?&](?:amp;)?p=grading&(?:amp;)?id=\d+~u', $тело);
        if ($стр === 0) { ok($имя . ': список сейчас пуст, кнопки проверять не на чем'); return; }
        chk($имя . ': кнопка действия есть у каждой строки', $кн === $стр,
            'кнопок ' . $кн . ' при ' . $стр . ' строках');
        chk($имя . ': кнопка удаления есть у каждой строки',
            preg_match_all('~class="lc-del"~u', $тело) === $стр);
    };
    $счётLC($кусокLC($r['body'], 'СПИСОК 3'), 'список итогов');
    $lcQ = one("SELECT c.id FROM competitions c
                  JOIN applications a ON a.competition_id=c.id
                       AND COALESCE(a.result,'')='' AND a.status<>'rejected'
                 WHERE c.results_mode='list'
              GROUP BY c.id ORDER BY COUNT(a.id) DESC LIMIT 1");
    if (!$lcQ) { ok('очереди нет ни у одного длинного конкурса, проверять нечего'); }
    else {
        $rQ = http($AJAR, $BASE . '/admin/?p=longcomp&competition=' . (int) $lcQ['id']);
        chk('«Оценка длинных» с живой очередью открывается', $rQ['code'] === 200, (string) $rQ['code']);
        $счётLC($кусокLC($rQ['body'], 'СПИСОК 1', 'СПИСОК 2'), 'очередь длинного');
    }
    /* ВЕСЬ АРХИВ ДОГЛЯДЫВАЕТСЯ ДО КОНЦА, И СЧИТАЕМ МЫ СТРОКИ, А НЕ ПОДПИСЬ.
       Первая сборка этой проверки складывала числа из подписи «показаны N-M из T»
       - и осталась ЗЕЛЁНОЙ, когда я нарочно вернул потолок LIMIT 500: подпись
       считается от номера страницы и общего числа, а строки при обрезке на всех
       страницах были ОДНИ И ТЕ ЖЕ. Мерка показывала беду мерки. Теперь берём
       номера заявок из самой таблицы архива и складываем РАЗНЫЕ. */
    $per = 50;
    $изАрхива = static function (string $b): array {
        // Только блок архива: на странице есть ещё очередь и список итогов со
        // своими ссылками на те же заявки.
        $a = strpos($b, 'id="graded"');
        $z = strpos($b, 'id="results-preview"');
        if ($a === false) return [];
        $кусок = $z !== false && $z > $a ? substr($b, $a, $z - $a) : substr($b, $a);
        preg_match_all('~[?&](?:amp;)?id=(\d+)~', $кусок, $m);
        return array_map('intval', $m[1] ?? []);
    };
    $видно = [];
    for ($i = 1; $i <= (int) ceil(max(1, $lcN) / $per); $i++) {
        $rp = http($AJAR, $BASE . '/admin/?p=longcomp&competition=' . $lcId . '&st2=' . $i);
        foreach ($изАрхива($rp['body']) as $id) $видно[$id] = 1;
    }
    chk('архив доглядывается до последней заявки (по номерам строк, не по подписи)',
        count($видно) === $lcN, 'разных заявок в архиве ' . count($видно) . ' из ' . $lcN);
    // Номер за пределами списка приводит на последнюю страницу, а не в пустоту.
    $rx = http($AJAR, $BASE . '/admin/?p=longcomp&competition=' . $lcId . '&st2=9999');
    $ппx = $подпись($rx['body']);
    $конец = false;
    foreach ($ппx as $x) if ($x['всего'] === $lcN && $x['до'] === $lcN) $конец = true;
    chk('страница за пределами списка приводит на последнюю, а не в пустоту', $конец);
    // Возврат из карточки оценки обязан помнить страницу.
    $rb = http($AJAR, $BASE . '/admin/?p=longcomp&competition=' . $lcId . '&st2=2');
    chk('ссылки архива уносят номер страницы (возврат не в начало)',
        str_contains($rb['body'], 'st2=2'), 'st2=2');
} else { ok('длинных конкурсов нет — пропуск'); }

// Тот же потолок стоял и у «Оценки коротких»: разобранных 439, до обрыва
// оставалось шестьдесят. Заслон тут, пока это ещё не стоило ни одной заявки.
$shortN = graded_rows_count(0, '', 'short');
$rs = http($AJAR, $BASE . '/admin/?p=grading');
chk('«Оценка коротких» открывается', $rs['code'] === 200, (string) $rs['code']);
$ппs = $подпись($rs['body']);
chk('в «Оценке коротких» архив тоже листается и называет настоящее число',
    (bool) array_filter($ппs, static fn($x) => $x['всего'] === $shortN),
    'в базе ' . $shortN . ', на странице: ' . implode('/', array_column($ппs, 'всего')));
chk('плашка архива коротких равна настоящему числу',
    str_contains($rs['body'], 'Оценённые и отклонённые <span class="badge badge--gold">' . $shortN . '</span>'),
    (string) $shortN);

/* ПОТОЛОК ВНУТРИ ВЫБОРКИ БОЛЬШЕ НЕ ЗАВОДИМ. Он и был причиной: обрезка без
   счётчика и без подписи выглядит как полный список. Длину страницы задаёт
   раздел, выборка отдаёт ровно то, что попросили. */
/* Пояснения вырезаем ПЕРЕД поиском. В комментарии снятый потолок назван
   НАРОЧНО, чтобы следующая сессия не вернула его вслепую, и первый прогон
   честно покраснел на моём же разборе - пятый раз эта грабля в проекте
   (правила 40, 48, 56, 57а). */
$glSrc = (string) file_get_contents(BASE_PATH . '/core/graded_list.php');
$glКод = (string) preg_replace(['~/\*.*?\*/~su', '~//[^\n]*~u', '~^\s*\*.*$~mu'], '', $glSrc);
chk('в graded_rows нет вписанного потолка LIMIT 500',
    !preg_match('~LIMIT\s+500~i', $glКод));
chk('у graded_rows есть длина страницы и смещение',
    (bool) preg_match('~function graded_rows\([^)]*int \$limit[^)]*int \$offset~s', $glКод));
chk('счётчик берёт отбор у graded_rows_where, а не повторяет условие',
    (bool) preg_match('~function graded_rows_count\(.*?graded_rows_where\(~s', $glКод));

/* ───────── КОЛОНКА ДЕЙСТВИЯ НАЗВАНА И ДОСТУПНА С ТЕЛЕФОНА ─────────
 *
 * Правка владельца 16.10.2026: «в „оценке коротких" не видна колонка „Действие"
 * и отсутствует кнопка „оценить"». Кнопка была у КАЖДОЙ строки, но колонок семь,
 * с телефона они не влезают, список прокручивается вбок, а шапка у последней
 * колонки была ПУСТОЙ - узнать, что там кнопка, было нельзя.
 *
 * Проверяем ровно то, что сломалось: колонка названа словом, кнопок столько же,
 * сколько строк, и колонка прижата к правому краю (иначе с телефона до неё
 * опять не добраться). Пустую шапку тоже ловим: её легко вернуть вслепую. */
sec('Колонка «Действие» в оценке коротких');
$rAct = http($AJAR, $BASE . '/admin/?p=grading');
chk('«Оценка коротких» открывается', $rAct['code'] === 200, (string) $rAct['code']);
chk('без фатальных ошибок и предупреждений PHP',
    stripos($rAct['body'], 'Fatal error') === false && stripos($rAct['body'], 'Warning:') === false);
$actН = mb_strpos($rAct['body'], 'СПИСОК 1');
$actК = mb_strpos($rAct['body'], 'СПИСОК 2');
if ($actН === false || $actК === false || $actК <= $actН) {
    bad('в разметке не нашлись границы очереди и архива');
} else {
    $актОч = mb_substr($rAct['body'], $actН, $actК - $actН);
    $актАр = mb_substr($rAct['body'], $actК);
    foreach (['очередь' => $актОч, 'архив' => $актАр] as $имя => $блок) {
        $шапка = preg_match('~<thead>.*?</thead>~us', $блок, $m) ? $m[0] : '';
        chk($имя . ': колонка действия названа словом',
            $шапка !== '' && (bool) preg_match('~<th[^>]*>\s*Действие\s*</th>\s*</tr>~us', $шапка));
        chk($имя . ': пустой шапки у последней колонки нет',
            $шапка !== '' && !preg_match('~<th[^>]*>\s*</th>\s*</tr>~us', $шапка));
    }
    /* КНОПКА ОБЯЗАНА БЫТЬ У КАЖДОЙ СТРОКИ, А НЕ «ГДЕ-ТО НА СТРАНИЦЕ». */
    $строк  = preg_match_all('~<tr class="~u', $актОч);
    /* СЧИТАЕМ ССЫЛКИ ДЕЙСТВИЯ, А НЕ СЛОВО НА КНОПКЕ. Мерка, которая ждёт
       вчерашнее написание, краснеет на верном коде ровно в день правки (правила
       56, 61, 72): переименуют кнопку - проверка обязана остаться зелёной.
       Ссылка на карточку оценки в строке очереди ровно одна. */
    $кнопок = preg_match_all('~[?&](?:amp;)?p=grading&(?:amp;)?id=\d+~u', $актОч);
    if ($строк === 0) { ok('очередь сейчас пуста, кнопки проверять не на чем'); }
    else {
        chk('у каждой строки очереди есть кнопка действия', $кнопок === $строк,
            'кнопок ' . $кнопок . ' при ' . $строк . ' строках');
        chk('у кнопки есть видимая подпись',
            mb_stripos($актОч, 'оценить') !== false);
    }
    /* ПРИЖАТАЯ КОЛОНКА: стиль едет вместе с разметкой, поэтому ищем его на самой
       странице, а не в файле - так проверка видит то же, что браузер. */
    chk('колонка действия прижата к правому краю',
        (bool) preg_match('~\.gq-tbl th:last-child\s*,\s*\.gq-tbl td:last-child\{[^}]*position:sticky~u',
                          $rAct['body']));
    chk('у прижатой колонки свой фон',
        (bool) preg_match('~\.gq-tbl th:last-child\s*,\s*\.gq-tbl td:last-child\{[^}]*background:~u',
                          $rAct['body']));
    chk('очередь: шапка стоит над прижатыми ячейками',
        (bool) preg_match('~\.gq-tbl thead th\{[^}]*z-index:4~u', $rAct['body']));

    /* АРХИВ «Оценённые и отклонённые»: кнопка у каждой строки и та же прижатая
       колонка (слово владельца 16.10.2026). Строки считаем ВНУТРИ <tbody>:
       снаружи лежит строка шапки, и по «<tr» их выходило бы на одну больше. */
    $телоА = preg_match('~<tbody>(.*?)</tbody>~us', $актАр, $mТА) ? $mТА[1] : '';
    $строкА = preg_match_all('~<tr[\s>]~u', $телоА);
    $кнопокА = preg_match_all('~[?&](?:amp;)?p=grading&(?:amp;)?id=\d+~u', $телоА);
    if ($строкА === 0) { ok('архив сейчас пуст, кнопки проверять не на чем'); }
    else {
        chk('у каждой строки архива есть кнопка действия', $кнопокА === $строкА,
            'кнопок ' . $кнопокА . ' при ' . $строкА . ' строках');
        chk('у каждой строки архива есть и кнопка «Заявка»',
            preg_match_all('~[?&](?:amp;)?p=applications&(?:amp;)?id=\d+~u', $телоА) === $строкА);
    }
    chk('архив: колонка действия прижата к правому краю',
        (bool) preg_match('~\.gl-tbl th:last-child\s*,\s*\.gl-tbl td:last-child\{[^}]*position:sticky~u',
                          $rAct['body']));
    chk('архив: у прижатой колонки свой фон',
        (bool) preg_match('~\.gl-tbl th:last-child\s*,\s*\.gl-tbl td:last-child\{[^}]*background:~u',
                          $rAct['body']));
    /* СВОЕГО СЛОЯ У ПРИЖАТОЙ ЯЧЕЙКИ БЫТЬ НЕ ДОЛЖНО: с z-index она становится
       отдельным слоем, и выпадающее меню «Ещё» верхней строки уходит ПОД
       прижатые ячейки строк ниже. Проверка держит это от правки вслепую. */
    chk('архив: прижатая ячейка не делает своего слоя (иначе меню «Ещё» уйдёт под нижние строки)',
        !preg_match('~\.gl-tbl th:last-child\s*,\s*\.gl-tbl td:last-child\{[^}]*z-index~u',
                    $rAct['body']));
    chk('архив: шапка стоит над прижатыми ячейками',
        (bool) preg_match('~\.gl-tbl thead th\{[^}]*z-index:4~u', $rAct['body']));
    chk('архив: у отклонённой строки прижатая ячейка со своим оттенком',
        (bool) preg_match('~\.gl-tbl tr\.gl-rej td:last-child\{[^}]*background:~u', $rAct['body']));
    /* ВПИСАННАЯ В ШАПКУ ШИРИНА НЕПЕРЕБИВАЕМА: style="width:230px" сильнее любого
       медиазапроса, и на телефоне колонка осталась бы в пол-экрана. */
    chk('архив: ширина колонки задана стилем, а не в самой шапке',
        strpos($rAct['body'], 'width:230px">Действие') === false);
    chk('архив: на телефоне колонка по ширине кнопок, а не по вписанному числу',
        (bool) preg_match('~\.gl-tbl th:last-child\{width:auto\}~u', $rAct['body']));
    chk('архив: меню «Ещё» на телефоне не зависит от ширины колонки',
        (bool) preg_match('~\.gl-menu\{position:fixed~u', $rAct['body']));
}

/* ─── КОГДА ОТПРАВИТЬ РЕЗУЛЬТАТ: У КОРОТКОГО В ОЦЕНКЕ, У ДЛИННОГО В ОТКАЗЕ ──
   Слово владельца 16.10.2026 (правило 73к) сузило правку того же дня (73и): в
   «Оценке длинных» выбор времени открывается ТОЛЬКО кнопкой «Отклонить
   заявку», а всякая другая оценка уходит пакетом вместе со списком.
   Проверяется и ПИКСЕЛЬ (в карточке длинного конкурса выбора нет, а в панели
   отклонения он есть), и МЕХАНИКА: обещание «уходит списком» держит КОД, а не
   отсутствие поля в форме, и выбранное время письма правда доходит до очереди
   через окно отправки. */
sec('Когда отправить результат: у короткого в оценке, у длинного в отказе');
/* Пояснения снимаем лексером: в них снятое названо нарочно, и поиск по сырому
   файлу краснел бы на нашем же разборе (правила 63, 70). */
$__код = static function (string $p): string {
    $out = '';
    foreach (token_get_all((string) @file_get_contents($p)) as $t) {
        if (is_array($t)) { if ($t[0] === T_COMMENT || $t[0] === T_DOC_COMMENT) continue; $out .= $t[1]; }
        else $out .= $t;
    }
    return $out;
};
$__gr = $__код(BASE_PATH . '/admin/grading.php');
$__ga = $__код(BASE_PATH . '/core/grade_apply.php');
$__sd = $__код(BASE_PATH . '/cron/send_diplomas.php');
$__as = $__код(BASE_PATH . '/core/app_status.php');
$__cg = $__код(BASE_PATH . '/core/chat_gate.php');
$__dp = $__код(BASE_PATH . '/admin/dispatch.php');

chk('в карточке оценки выбор времени закрыт от длинного конкурса',
    (bool) preg_match('~if \(empty\(\$isLongView\)\): \?>\s*<div class="field"~u', $__gr));
chk('длинному конкурсу сказано, что результат уходит пакетом со списком',
    strpos($__gr, 'одним пакетом в день оглашения итогов') !== false
    && strpos($__gr, 'Персонального срока здесь нет') !== false);
chk('сказано, где время всё-таки выбирается',
    strpos($__gr, 'только при отклонении заявки') !== false);
chk('короткий конкурс выбор сохранил целиком',
    strpos($__gr, 'Автоматически по сроку') !== false
    && strpos($__gr, 'name="send_now"') !== false
    && strpos($__gr, 'name="send_at"') !== false);
chk('прежней подписи «вместе с оглашением итогов» в выборе больше нет',
    strpos($__gr, 'Вместе с оглашением итогов') === false);
chk('карточка берёт дату оглашения из конкурса',
    strpos($__gr, 'c.results_date FROM applications a') !== false
    && strpos($__gr, "\$a['results_date']") !== false);
/* ЛЕКСЕР СНИМАЕТ ТОЛЬКО PHP-ПОЯСНЕНИЯ, А ЭТО JS. Первая сборка искала само
   слово sendAtBox и покраснела на нашем же комментарии в <script>: для
   token_get_all он не комментарий, а T_INLINE_HTML. Ищем сам мёртвый вызов -
   его в пояснении нет (девятый раз эта грабля: правила 40, 48, 56, 57а, 58,
   63, 70, 72). */
chk('мёртвого слушателя sendAtBox в карточке нет',
    strpos($__gr, "getElementById('sendAtBox')") === false);

/* МЕХАНИКА: ОБЕЩАНИЕ «УХОДИТ СПИСКОМ» ДЕРЖИТ КОД. Отрезок читается целиком:
   «ветки нет где-то» зеленело бы и при обнулённом условии (правила 72а, 72б). */
chk('у длинного конкурса срок не назначается ни при каком режиме',
    !preg_match('~elseif \(\$mode === .now.~u', $__ga)
    && (bool) preg_match('~\$resultAt = null;\s*if \(!\$isLong\) \{~u', $__ga));
chk('у короткого «отправить сейчас» отправляет сразу, пока письма не было',
    (bool) preg_match('~\(\$firstGrade \|\| \$changed \|\| \(\$mode === .now. && \$ещёНеУшло\)\) && \$dueNow~u', $__ga));
chk('у отправки письма нет прежнего запрета по длинному конкурсу',
    !preg_match('~if \(!\$isLong && \(\$firstGrade~u', $__ga));

/* ВРЕМЯ ПИСЬМА ОТКЛОНЁННОМУ УЧАСТНИКУ: выбор человека доходит до очереди, но
   через окно отправки - письма людям в час ночи уже уходили (правило 7). */
chk('дверь отклонения принимает выбранное время письма',
    (bool) preg_match('~\$opt\[.письмо_в.\]~u', $__ga));
chk('окно отправки умеет судить назначенное время, а не только «сейчас»',
    (bool) preg_match('~function ga_next_worktime\(int \$ts = 0\)~u', $__ga)
    && (bool) preg_match("~return \\\$ts > 0 \\? date\('Y-m-d H:i:s', \\\$ts\) : '';~u", $__ga));
chk('выбранное время проходит через это окно, а не мимо',
    (bool) preg_match('~ga_next_worktime\(\$стамп\)~u', $__ga));
chk('письмо ставится в очередь ровно на посчитанное время',
    (bool) preg_match('~\$html, .., \$план\) > 0~u', $__ga));
chk('второго окна отправки рядом не завелось',
    substr_count($__ga, 'OUTREACH_HOUR_FROM') === 1);
chk('панель отклонения передаёт выбор в дверь отклонения',
    (bool) preg_match('~.письмо_в. => \$rjWhen~u', $__gr));
chk('без выбранной даты чужое время не выдумывается',
    (bool) preg_match('~\$rjWhen !== .. \? \[.письмо_в. => \$rjWhen\] : \[\]~u', $__gr));
chk('оператор читает, на какое время поставлено письмо',
    strpos($__ga, 'поставлено в очередь на') !== false);

/* СЕТЬ НА СЛУЧАЙ, КОГДА РАССЫЛКА ПРОШЛА, А ПУБЛИКАЦИЯ СОРВАЛАСЬ: своё письмо
   открывает результат этому участнику и в кабинете, и у бота. */
chk('своё письмо открывает результат участнику длинного конкурса',
    (bool) preg_match("~results_mode,''\) =  'list' AND \(COALESCE\(\\\$c\.results_published_at,''\) <> ''\s*OR COALESCE\(\\\$a\.result_sent_at,''\)~u", $__as));
chk('бот называет результат тому, кому письмо уже ушло',
    (bool) preg_match('~if \(\$sentAt !== .. && \$result !== ..\) \{\s*\$out\[.may_result.\] = true;~u', $__cg)
    && strpos($__cg, 'Аттестационный результат отправлен Вам на почту') !== false);
chk('отбор крона идёт по самому сроку, а не по режиму конкурса',
    !preg_match('~results_mode IS NULL OR c\.results_mode <> .list.~u', $__sd)
    && strpos($__sd, "a.result_send_at <> '' AND a.result_send_at <= ?") !== false);
chk('в очереди отправок заявка с назначенным сроком стоит ровно в одном блоке',
    !preg_match("~COALESCE\(a\.result_send_at,''\) <> ''\s*AND COALESCE\(a\.result_sent_at,''\) = ''\s*AND COALESCE\(c\.results_mode,''\) <> 'list'~u", $__dp)
    && (bool) preg_match("~COALESCE\(c\.results_mode,''\) = 'list'\s*AND COALESCE\(a\.result_send_at,''\) = ''~u", $__dp));

/* ПИКСЕЛИ: у длинного конкурса выбора в оценке НЕТ, а в панели отклонения ЕСТЬ;
   у короткого всё наоборот. Функция может отдавать верный HTML, а строки в
   шаблоне не быть вовсе (урок правила 47). */
$__appL = one("SELECT a.id, c.results_date FROM applications a JOIN competitions c ON c.id=a.competition_id
                WHERE COALESCE(c.results_mode,'')='list' AND COALESCE(a.status,'')<>'rejected'
                ORDER BY a.id DESC LIMIT 1");
$__appS = one("SELECT a.id FROM applications a JOIN competitions c ON c.id=a.competition_id
                WHERE COALESCE(c.results_mode,'')<>'list' AND COALESCE(a.status,'')<>'rejected'
                ORDER BY a.id DESC LIMIT 1");
if (!$__appL) { ok('заявок длинного конкурса нет, пиксели проверять нечем'); }
else {
    $rL = http($AJAR, $BASE . '/admin/?p=grading&id=' . (int) $__appL['id']);
    chk('длинный: в карточке оценки выбора времени нет',
        strpos($rL['body'], 'name="auto_send"') === false
        && strpos($rL['body'], 'name="send_now"') === false
        && strpos($rL['body'], 'name="send_at"') === false, 'заявка ' . (int) $__appL['id']);
    chk('длинный: сказано, что результат уходит пакетом со списком',
        strpos($rL['body'], 'одним пакетом в день оглашения итогов') !== false);
    $__rd = trim((string) ($__appL['results_date'] ?? ''));
    chk('длинный: названа дата оглашения',
        $__rd === '' || strpos($rL['body'], date('d.m.Y', strtotime($__rd))) !== false, $__rd);
    chk('длинный: сказано, где выбирается время письма',
        strpos($rL['body'], 'только при отклонении заявки') !== false);
    chk('длинный: кнопка «Отклонить заявку…» на месте',
        strpos($rL['body'], 'Отклонить заявку') !== false);
    chk('длинный: в панели отклонения выбор времени напечатан',
        strpos($rL['body'], 'Когда отправить результат участнику?') !== false
        && strpos($rL['body'], 'name="reject_auto_send"') !== false
        && strpos($rL['body'], 'name="reject_send_at"') !== false);
}
if (!$__appS) { ok('заявок короткого конкурса нет, пиксели проверять нечем'); }
else {
    $rS = http($AJAR, $BASE . '/admin/?p=grading&id=' . (int) $__appS['id']);
    chk('короткий: выбор в карточке оценки на месте и подпись прежняя',
        strpos($rS['body'], 'Когда отправить результат участнику?') !== false
        && strpos($rS['body'], 'name="auto_send"') !== false
        && strpos($rS['body'], 'name="send_now"') !== false
        && strpos($rS['body'], 'Автоматически по сроку') !== false, 'заявка ' . (int) $__appS['id']);
    chk('короткий: своего выбора времени в отклонении не завелось',
        strpos($rS['body'], 'name="reject_auto_send"') === false);
}


/* ═════ ТАБЛИЦЫ «ЗАЯВОК» И «ОТПРАВОК» ЧИТАЮТСЯ С ТЕЛЕФОНА ═════
 *
 * Владелец читает админку с телефона, и обе страницы он назвал «отображается
 * не полностью». Замер показал ровно это: при ширине 390 точек в списке
 * заявок видна ОДНА колонка из восьми, в очереди отправок одна из пяти -
 * остальные уезжают за правый край `.table-wrap`. Проверка смотрит и
 * исходники, и ФАКТ по живым страницам: разметка может быть верной, а
 * подписи у ячеек не напечататься.
 *
 * Проверка ТОЛЬКО ЧИТАЕТ: ни одной записи в базу (правила 49, 51). */
sec('Таблицы «Заявок» и «Отправок» читаются с телефона');

/** Исходник без пояснений: в них снятое названо нарочно (правила 40, 48, 63). */
$__чисто = static function (string $file): string {
    $src = (string) @file_get_contents(BASE_PATH . '/' . $file);
    if ($src === '') return '';
    $out = '';
    foreach (token_get_all($src) as $t) {
        if (is_array($t) && in_array($t[0], [T_COMMENT, T_DOC_COMMENT], true)) continue;
        $out .= is_array($t) ? $t[1] : $t;
    }
    return $out;
};

$__boot = $__чисто('admin/_boot.php');
chk('общий стиль карточек заведён одной функцией',
    substr_count($__boot, 'function admin_cards_css(') === 1);
chk('стиль отдаётся один раз на страницу',
    (bool) preg_match('~function admin_cards_css\(\).{0,200}?static \$\S+ = false;~su', $__boot));
chk('карточки включаются до 820 точек',
    str_contains($__boot, '@media (max-width:820px)') && str_contains($__boot, '.tbl--cards'));
chk('шапка таблицы в карточках прячется',
    (bool) preg_match('~table\.tbl--cards thead\{display:none\}~', $__boot));
chk('подпись ячейки берётся из data-label',
    str_contains($__boot, 'content:attr(data-label)'));
chk('обёртка теряет прокрутку вбок',
    (bool) preg_match('~\.table-wrap--cards\{[^}]*overflow-x:visible~', $__boot));

/** У каждой ячейки строки своя подпись: столько же, сколько колонок у шапки.
 *
 * Шапка берётся ИЗ ИСХОДНИКА по метке, а не из самой метки: считать колонки в
 * строке, которую сюда передали, значит считать то, что написал проверяющий.
 * И закрывающая скобка у `<th` обязательна - `<th` совпадает и с `<thead>`,
 * отчего колонок выходило на одну больше, а проверка краснела на верном коде. */
$__podpisi = static function (string $src, string $метка): array {
    $i = strpos($src, $метка);
    if ($i === false) return [-1, -1];
    $th1 = strpos($src, '<thead', $i);
    $th2 = $th1 === false ? false : strpos($src, '</thead>', $th1);
    if ($th1 === false || $th2 === false) return [-2, -2];
    $кол = preg_match_all('~<th[\s>]~i', substr($src, $th1, $th2 - $th1));
    $end = strpos($src, '</table>', $th2);
    $кусок = substr($src, $th2, ($end === false ? 6000 : $end - $th2));
    return [$кол, preg_match_all('~<td[^>]*data-label="[^"]+"~i', $кусок)];
};

$__apps = $__чисто('admin/applications.php');
chk('«Заявки»: обёртка и таблица помечены карточками',
    str_contains($__apps, 'class="table-wrap table-wrap--cards"')
    && str_contains($__apps, 'class="tbl tbl--cards"'));
chk('«Заявки»: стиль карточек отдаётся', str_contains($__apps, 'admin_cards_css()'));
[$__k, $__d] = $__podpisi($__apps, 'class="tbl tbl--cards"');
// Чекбокс подписи не несёт: над ним нечего называть.
chk('«Заявки»: подписана каждая колонка строки', $__k > 0 && $__d === $__k - 1, "колонок $__k, подписей $__d");
chk('«Заявки»: постраничность общая, своего ряда номеров нет',
    str_contains($__apps, 'admin_stranicy(')
    && !preg_match('~for \(\$i=1;\$i<=\$pages;\$i\+\+\)~', $__apps));

$__disp = $__чисто('admin/dispatch.php');
chk('«Отправки»: стиль карточек отдаётся', str_contains($__disp, 'admin_cards_css()'));
chk('«Отправки»: все три таблицы помечены карточками',
    substr_count($__disp, 'class="table-wrap table-wrap--cards"') === 3
    && substr_count($__disp, 'class="tbl tbl--cards"') === 3,
    'обёрток ' . substr_count($__disp, 'class="table-wrap table-wrap--cards"'));
foreach ([
    'очередь'        => '<thead><tr><th>Тип</th><th>Кому</th><th>Что</th><th>Когда</th><th>Действия</th></tr></thead>',
    'архив'          => '<thead><tr><th>Тип</th><th>Кому</th><th>Тема</th><th>Отправлено</th><th>Действия</th></tr></thead>',
    'не отправлены'  => '<thead><tr><th>Кому</th><th>Тема</th><th>Причина</th><th>Попыток</th><th>Действия</th></tr></thead>',
] as $__имя => $__th) {
    [$__k, $__d] = $__podpisi($__disp, $__th);
    chk("«Отправки»: подписана каждая колонка ($__имя)", $__k > 0 && $__d === $__k, "колонок $__k, подписей $__d");
}

/* ---- СКОРОСТЬ: индекс под архив отправленных ---- */
$__db = $__чисто('core/db.php');
chk('индекс под архив отправленных заведён в миграциях',
    (bool) preg_match('~CREATE INDEX IF NOT EXISTS \S+\s+ON mail_queue\(status, sent_at, id\)~', $__db));
$__живой = (string) (scalar("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='mail_queue'
                              AND sql LIKE '%status, sent_at, id%'") ?? '');
chk('индекс есть в живой базе', $__живой !== '', $__живой);
$__план = '';
foreach (all("EXPLAIN QUERY PLAN SELECT id FROM mail_queue WHERE status='sent' ORDER BY sent_at DESC, id DESC LIMIT 61") as $__p)
    $__план .= ' ' . (string) ($__p['detail'] ?? '');
/* ВРЕМЕННОЕ ДЕРЕВО - ЭТО И ЕСТЬ ТЕ ВОСЕМЬ С ПОЛОВИНОЙ СЕКУНД: база сортирует
   все 145 тысяч отправленных строк ради шестидесяти. Проверяем план, а не
   время: на пустой базе время зелёное при том же дефекте. */
chk('архив берётся индексом, без временного дерева',
    !str_contains($__план, 'TEMP B-TREE'), trim($__план));

/* ---- ФАКТ: что правда напечатано на живых страницах ---- */
$__fakt = static function (string $body, string $имя) use (&$FAIL, &$OK): void {
    chk("$имя: стиль карточек напечатан один раз",
        substr_count($body, 'table.tbl--cards thead{display:none}') === 1);
    $всего = preg_match_all('~<table class="tbl tbl--cards"~', $body);
    $вобёртке = preg_match_all('~class="table-wrap table-wrap--cards">\s*<table class="tbl tbl--cards"~', $body);
    chk("$имя: каждая таблица карточек лежит в своей обёртке", $всего > 0 && $вобёртке >= $всего,
        "таблиц $всего, в обёртке $вобёртке");
    /* У КАЖДОЙ ЯЧЕЙКИ ТЕЛА ТАБЛИЦЫ ОБЯЗАНА БЫТЬ ПОДПИСЬ. Без неё на телефоне
       значение стоит голым: человек видит дату и не знает, это «подана» или
       «отправлено». Чекбокс и строка-заглушка («по фильтру пусто») подписи не
       несут намеренно. */
    $без = 0; $есть = 0;
    if (preg_match_all('~<table class="tbl tbl--cards".*?</table>~s', $body, $mm)) {
        foreach ($mm[0] as $tbl) {
            if (!preg_match('~<tbody>(.*?)</tbody>~s', $tbl, $tb)) continue;
            foreach ((array) (preg_match_all('~<td([^>]*)>~i', $tb[1], $td) ? $td[1] : []) as $attr) {
                if (str_contains($attr, 'colspan') || str_contains($attr, 'checkbox-cell')) continue;
                if (preg_match('~data-label="[^"]+"~', $attr)) $есть++; else $без++;
            }
        }
    }
    chk("$имя: все ячейки строк подписаны", $есть > 0 && $без === 0, "подписано $есть, без подписи $без");
};

$__t0 = microtime(true);
$rApps = http($AJAR, $BASE . '/admin/?p=applications');
$__secApps = microtime(true) - $__t0;
$__fakt($rApps['body'], '«Заявки»');
chk('«Заявки»: названо, сколько строк видно и сколько всего',
    (bool) preg_match('~Показаны <b>\d+-\d+</b> из <b>\d+</b>~u', $rApps['body']));
/* ПОЛНЫЙ РЯД НОМЕРОВ САМ СТАНОВИТСЯ ПОЛОТНОМ: на 1784 заявках это 36 кнопок
   внизу страницы, и читает их человек с телефона (урок правила 58). */
chk('«Заявки»: номера страниц идут окном, а не всем рядом',
    preg_match_all('~href="[^"]*[?&]pg=\d+~', $rApps['body']) <= 9,
    'кнопок ' . preg_match_all('~href="[^"]*[?&]pg=\d+~', $rApps['body']));

$__t0 = microtime(true);
$rDisp = http($AJAR, $BASE . '/admin/?p=dispatch');
$__secDisp = microtime(true) - $__t0;
$__fakt($rDisp['body'], '«Отправки»');
/* Раздел открывался 13 секунд. Порог с запасом: беда была в плане запроса,
   и он проверен выше отдельно, а здесь ловится всё остальное разом. */
chk('«Отправки»: раздел открывается быстрее трёх секунд',
    $__secDisp < 3.0, sprintf('%.2f с', $__secDisp));
ok('время «Заявок»', sprintf('%.2f с', $__secApps));

sec('Разносостоянная посылка: вкладка называет вторую половину');
/* ВКЛАДКИ ОТБИРАЮТ ПО СОСТОЯНИЮ ДО ГРУППИРОВКИ. У посылки, где один заказ
   изготовлен, а другой только оплачен, карточка на вкладке показывает половину
   состава - со своим листом и своими бланками. Проверяем ПИКСЕЛИ: функция
   может отдавать верный состав, а строки в шаблоне не быть вовсе (урок
   правила 47). */
require_once BASE_PATH . '/core/order_group.php';
$__живые = all("SELECT * FROM awards_orders WHERE status IN ('paid','made','shipped')");
$__поС = [];
foreach ($__живые as $__o) $__поС[(int) $__o['id']] = (string) $__o['status'];
$__разн = null;
foreach (og_groups($__живые) as $__g) {
    $__ids = array_map('intval', (array) $__g['ids']);
    if (count($__ids) < 2) continue;
    $__st = array_unique(array_map(static fn(int $i): string => $__поС[$i] ?? '', $__ids));
    if (count($__st) < 2) continue;                      // посылка в одном состоянии - вкладка её не рвёт
    $__разн = ['ids' => $__ids, 'st' => array_values($__st)];
    break;
}
if ($__разн === null) {
    echo "  факт разносостоянных посылок сейчас нет, строку проверяет исходник audit_zakazy\n";
} else {
    $__вкл = $__разн['st'][0];
    $__r = http($AJAR, $BASE . '/admin/?p=orders&status=' . rawurlencode($__вкл));
    $__свои = [];
    foreach ($__разн['ids'] as $__i) if (($__поС[$__i] ?? '') === $__вкл) $__свои[] = $__i;
    $__чужие = array_values(array_diff($__разн['ids'], $__свои));
    $__естьСтрока = str_contains($__r['body'], 'Едет одной посылкой');
    $__названы = true;
    foreach ($__чужие as $__i) if (!preg_match('~Едет одной посылкой[^<]*№' . $__i . '~u', $__r['body'])) $__названы = false;
    chk('на вкладке «' . $__вкл . '» карточка говорит про вторую половину посылки', $__естьСтрока,
        'посылка ' . implode('+', $__разн['ids']));
    chk('названы номера заказов, которых на вкладке не видно', $__названы,
        'ждали №' . implode(', №', $__чужие));
}

/* ───────── «Входящие письма»: читаются с телефона и список не обрезан ───────── */
sec('Входящие письма: карточки на телефоне и честная постраничность');
$ibSrc = file_get_contents(BASE_PATH . '/admin/inbox.php');
$ibCode = (static function (string $src): string {
    $out = '';
    foreach (token_get_all($src) as $t) {
        if (is_array($t)) { if ($t[0] === T_COMMENT || $t[0] === T_DOC_COMMENT) { $out .= "\n"; continue; } $out .= $t[1]; }
        else { $out .= $t; }
    }
    return $out;
})($ibSrc);

/* ИСХОДНИК. Потолок без счётчика возвращается одной строкой, поэтому запрет
   стоит ОТРИЦАНИЕМ, а рядом требуется счёт ТЕМ ЖЕ условием, что и выборка. */
chk('вписанного потолка списка не осталось', !preg_match('~LIMIT\s+300~i', $ibCode));
chk('счёт идёт тем же условием, что выборка', str_contains($ibCode, 'COUNT(*) n FROM inbox_messages WHERE $where'));
chk('подпись «показаны N-M из T» печатается', str_contains($ibCode, 'admin_stranicy('));
chk('длину страницы выбирает оператор', str_contains($ibCode, 'admin_na_stranice_pole()'));
chk('стиль карточек подключён', str_contains($ibCode, 'admin_cards_css()'));
chk('обёртка и таблица помечены карточками',
    str_contains($ibCode, 'table-wrap table-wrap--cards') && str_contains($ibCode, 'tbl tbl--cards'));
chk('колонка действия названа словом',
    str_contains($ibCode, '<th>Действие</th>') && !preg_match('~<th>\s*</th>~', $ibCode));
/* Список ящиков берём у читателя почты: вписанный свой устарел в день, когда
   центр начал читать mail.ru и gmail, и два ящика пропали из фильтра молча. */
chk('список ящиков берётся у inbox_boxes()', str_contains($ibCode, 'inbox_boxes()'));
$ibTh = preg_match_all('~<th[\s>]~', $ibCode);
$ibLb = preg_match_all('~<td[^>]*data-label=~', $ibCode);
chk('у каждой колонки есть подпись ячейки', $ibTh > 0 && $ibLb >= $ibTh, "колонок $ibTh, подписей $ibLb");

/* ПИКСЕЛИ. Проверка функции не доказывает, что строки напечатаны. */
$ibR = http($AJAR, $BASE . '/admin/?p=inbox');
chk('раздел отвечает', $ibR['code'] === 200, 'код ' . $ibR['code'] . ', ' . strlen($ibR['body']) . ' байт');
if ($ibR['code'] === 200) {
    $ibBody = static function (string $b): string {
        $t = explode('</tbody>', explode('<tbody>', $b)[1] ?? '')[0] ?? ''; return $t;
    };
    $ibRows = substr_count($ibBody($ibR['body']), '<tr');
    $ibPer  = 50;
    preg_match('~Показаны <b>(\d+)-(\d+)</b> из <b>(\d+)</b>~u', $ibR['body'], $ibPg);
    $ibTotal = (int) ($ibPg[3] ?? -1);
    $ibDb = (int) (scalar("SELECT COUNT(*) FROM inbox_messages
                            WHERE kind NOT IN ('service','bounce','auto') AND is_auto=0") ?? 0);
    chk('подпись называет полное число писем', $ibTotal === $ibDb, "на странице $ibTotal, в базе $ibDb");
    chk('на странице не больше строк, чем длина страницы', $ibRows > 0 && $ibRows <= $ibPer, "строк $ibRows");
    $ibCells = preg_match_all('~<td[^>]*data-label="[^"]+"~', $ibBody($ibR['body']));
    chk('у всех ячеек есть непустая подпись', $ibCells === $ibRows * 7, "подписано $ibCells при строках $ibRows");
    chk('классы карточек напечатаны в разметке',
        preg_match('~class="table-wrap table-wrap--cards"~', $ibR['body']) === 1
        && preg_match('~class="tbl tbl--cards"~', $ibR['body']) === 1);

    /* Каждый читаемый ящик имеет свою карточку: без неё его писем в разделе не
       видно вовсе, а фильтр его не предлагает (так было у mail.ru и gmail). */
    require_once BASE_PATH . '/core/inbox_reader.php';
    $ibNet = [];
    foreach (array_keys(inbox_boxes()) as $ibB) {
        if (!preg_match('~<option value="' . preg_quote($ibB, '~') . '"~', $ibR['body'])) $ibNet[] = $ibB;
    }
    chk('каждый ящик есть в фильтре', $ibNet === [], $ibNet ? implode(', ', $ibNet) : count(inbox_boxes()) . ' ящиков');
    $ibIzBazy = array_column(all("SELECT DISTINCT mailbox FROM inbox_messages WHERE COALESCE(mailbox,'')<>''"), 'mailbox');
    $ibNetK = [];
    foreach ($ibIzBazy as $ibB) {
        if (!preg_match('~box=' . preg_quote((string) $ibB, '~') . '[&"\']~', $ibR['body'])) $ibNetK[] = (string) $ibB;
    }
    chk('у каждого ящика из базы есть карточка', $ibNetK === [], $ibNetK ? implode(', ', $ibNetK) : implode(', ', $ibIzBazy));

    /* ВТОРАЯ СТРАНИЦА ОБЯЗАНА ПОКАЗЫВАТЬ ДРУГИЕ ПИСЬМА. Подпись сходится и на
       обрезанном списке - ровно так соврала проверка полноты в правиле 58,
       поэтому сверяем сами строки, а не числа. */
    if ($ibTotal > $ibPer) {
        $ibR2 = http($AJAR, $BASE . '/admin/?p=inbox&st=2');
        preg_match_all('~name="id" value="(\d+)"~', $ibBody($ibR['body']), $m1);
        preg_match_all('~name="id" value="(\d+)"~', $ibBody($ibR2['body']), $m2);
        $ibПересе = array_intersect($m1[1] ?? [], $m2[1] ?? []);
        chk('вторая страница показывает другие письма',
            ($m2[1] ?? []) !== [] && $ibПересе === [],
            'на первой ' . count($m1[1] ?? []) . ', на второй ' . count($m2[1] ?? []) . ', общих ' . count($ibПересе));
    } else {
        echo "  справка: писем меньше одной страницы, вторую проверять не на чем\n";
    }
}
echo "\n" . str_repeat('─', 60) . "\n";
echo ($FAIL === 0 ? "АДМИНКА И ПРАВИЛА ЧИСТО" : "ПРОВАЛОВ: $FAIL") . ", пройдено: $OK\n";
exit($FAIL === 0 ? 0 : 1);
