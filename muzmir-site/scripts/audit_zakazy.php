<?php
/**
 * АУДИТ ЗАКАЗОВ НА ИЗГОТОВЛЕНИЕ НАГРАД — электронных и оригиналов.
 *
 * Заводится 18.10.2026 по слову владельца: «сделай полный аудит по заявкам на
 * изготовление наград электронных и оригиналов, проверь все ли регистрируются
 * и отображаются правильно, у всех ли проведена оплата и нет ли затруднений и
 * отказов». Своего аудита у заказов не было вовсе.
 *
 * ОН ТОЛЬКО ЧИТАЕТ, и это условие, а не стиль: здесь живут деньги участников.
 * Ни одного вызова кассы (создание платежа это действие, оно оставляет в
 * ЮKassa висящий платёж), ни одной записи в базу (правила 49, 51).
 *
 *   php scripts/audit_zakazy.php
 */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { fwrite(STDERR, "CLI only\n"); exit(1); }

define('BASE_PATH', dirname(__DIR__));
$GLOBALS['CFG'] = require BASE_PATH . '/config.php';
/* `payments` в списке обязателен: тело создания платежа читается отражением,
   а без подключения функции её нет вовсе - и четыре проверки ушли бы в
   пустоту (урок правила 71: молчащая проверка хуже отсутствующей). */
foreach (['db','helpers','data','app_status','send_timing','loyalty','club','orders',
          'payments','prioritet','club_free','order_group','award_offer'] as $m) {
    $f = BASE_PATH . '/core/' . $m . '.php';
    if (is_file($f)) require_once $f;
}
db();

$FAIL = 0; $OK = 0;
function sec(string $s): void { echo "\n=== $s ===\n"; }
function ok(string $w, $i = ''): void { global $OK; $OK++; echo "  ok   $w" . ($i !== '' ? "  [$i]" : '') . "\n"; }
function bad(string $w, $i = ''): void { global $FAIL; $FAIL++; echo "  FAIL $w" . ($i !== '' ? "  $i" : '') . "\n"; }
function chk(string $w, $cond, $i = ''): void { $cond ? ok($w, $i) : bad($w, $i); }
function spr(string $w): void { echo "  факт $w\n"; }

/**
 * Тело функции по ИМЕНИ, через отражение.
 *
 * Искать вызов поиском по файлу нельзя: `yk_otkaz_rekurrenta()` стоит в файле и
 * как ОПРЕДЕЛЕНИЕ, и как вызов, и первый же strpos приводит к определению -
 * проверка краснела на верном коде (та же грабля, что в правилах 72а, 73л).
 */
function ztelo(string $fn): string {
    if (!function_exists($fn)) return '';
    try { $r = new ReflectionFunction($fn); } catch (\Throwable $e) { return ''; }
    $файл = (string) $r->getFileName(); if (!is_file($файл)) return '';
    $строки = file($файл);
    return implode('', array_slice($строки, $r->getStartLine() - 1, $r->getEndLine() - $r->getStartLine() + 1));
}

/** Исходник без пояснений: в них снятое названо нарочно (правила 40, 48, 63). */
function zsrc(string $file): string {
    $src = (string) @file_get_contents(BASE_PATH . '/' . $file);
    if ($src === '') return '';
    $out = '';
    foreach (token_get_all($src) as $t) {
        if (is_array($t) && in_array($t[0], [T_COMMENT, T_DOC_COMMENT], true)) continue;
        $out .= is_array($t) ? $t[1] : $t;
    }
    return $out;
}

/* ═════════ 1. КАССА: ОТКАЗ ПО РЕКУРРЕНТУ НЕ ОСТАВЛЯЕТ БЕЗ ОПЛАТЫ ═════════
 *
 * Подписка Клуба просит кассу сохранить способ оплаты, а магазин центра этого
 * не умеет: 403 «This store can't make recurring payments». Прежде на этом всё
 * и кончалось - ни строки в payments, ни ссылки на оплату. Замерено 18.10.2026:
 * шесть отказов, и два заказа того же дня остались без единого платежа. */
sec('Отказ кассы по рекурренту: оплата всё равно проходит');
$pay = zsrc('core/payments.php');
chk('отправка запроса вынесена одним помощником', str_contains($pay, 'function yk_send_payment('));
/* Создание платежа обязано ходить ТОЛЬКО через помощника: свой curl внутри
   означал бы вторую копию разговора с кассой, и повтор без рекуррента пошёл бы
   другим путём. У `yukassa_charge_saved` свой вызов законно - это ДРУГАЯ дверь
   (автосписание по сохранённому способу), и её мы не трогаем. */
$тСоздание = ztelo('yukassa_create_payment');
chk('создание платежа своего curl не держит',
    $тСоздание !== '' && !str_contains($тСоздание, 'curl_init'));
chk('оба захода идут одним помощником',
    substr_count($тСоздание, 'yk_send_payment(') === 2,
    'вызовов ' . substr_count($тСоздание, 'yk_send_payment('));
chk('у самого помощника вызов кассы один',
    substr_count(ztelo('yk_send_payment'), 'curl_init(') === 1);
chk('причина отказа доступна вызывающему', str_contains($pay, "GLOBALS['YK_LAST_ERROR']"));
chk('при удаче причина сбрасывается', (bool) preg_match("~\\\$GLOBALS\['YK_LAST_ERROR'\]\s*=\s*null~", $pay));
chk('отказ узнаётся по слову recurring',
    str_contains($pay, 'function yk_otkaz_rekurrenta(') && str_contains($pay, "'recurring'"));
/* Повтор обязан стоять ПОД условием отказа и снимать рекуррент: «где-то есть
   строка про повтор» осталось бы зелёным при обнулённом условии (урок 72а). */
/* Повтор судим ПО ТЕЛУ создания платежа, а не по файлу: условие должно стоять
   прямо перед ним, иначе обнулённое условие осталось бы зелёным (урок 72а). */
$поз = strpos($тСоздание, "!empty(\$body['save_payment_method']) && yk_otkaz_rekurrenta()");
$хвост = $поз === false ? '' : substr($тСоздание, $поз, 240);
chk('повтор идёт под условием отказа и снимает рекуррент',
    $хвост !== '' && str_contains($хвост, "\$body['save_payment_method'] = false;")
      && str_contains($хвост, 'yk_send_payment('),
    $поз === false ? 'условия повтора нет' : mb_substr(preg_replace('~\s+~u',' ',$хвост), 0, 90));
chk('владельцу говорится один раз в сутки',
    str_contains($pay, 'function yk_skazat_pro_rekurrent(') && str_contains($pay, "date('Y-m-d')"));
chk('страница Клуба по-прежнему просит сохранить способ оплаты',
    str_contains(zsrc('api/v1/order.php'), "'save_payment_method' => \$isClubOrder"));

/* ═════════ 2. ДВЕРЬ ЗАКАЗА: АДРЕС ═════════ */
sec('Дверь заказа: канонический адрес');
$ord = zsrc('api/v1/order.php');
$iDecl = strpos($ord, "\$addrCanon  = '';");
$iIf    = strpos($ord, 'if ($hasOriginal) {');
$iUse   = strpos($ord, "\$addrCanon !== '' ? \$addrCanon : input('address')");
chk('$addrCanon объявляется ДО ветки оригиналов',
    $iDecl !== false && $iIf !== false && $iDecl < $iIf, "объявление $iDecl, ветка $iIf");
chk('и объявлена раньше, чем читается', $iDecl !== false && $iUse !== false && $iDecl < $iUse);

/* ═════════ 3. РАЗДЕЛ ОРИГИНАЛОВ: ПОТОЛОК НАЗВАН ═════════ */
sec('Раздел «Заказы оригиналов»: список не урезается молча');
$adm = zsrc('admin/orders.php');
chk('потолок назван числом', str_contains($adm, 'const ORD_LIMIT'));
chk('голого LIMIT 300 не осталось', !str_contains($adm, 'LIMIT 300'));
chk('счётчик считает ТЕМ ЖЕ условием',
    (bool) preg_match('~COUNT\(\*\) FROM awards_orders WHERE \$where", \$params~', $adm));
chk('обрыв называется словами', str_contains($adm, 'Показаны первые'));

/* ═════════ 4. ФАКТ ПО БАЗЕ ═════════ */
sec('ФАКТ: оплата по каждому заказу');
$orders = all("SELECT * FROM awards_orders ORDER BY id");
spr('заказов всего: ' . count($orders));
$безДенег = []; $вернули = [];
foreach ($orders as $o) {
    if (in_array((string) $o['status'], ['new','canceled'], true)) continue;
    if ((int) $o['amount'] <= 0) continue;
    $p = all("SELECT status FROM payments WHERE order_id=?", [(int) $o['id']]);
    $усп = array_filter($p, fn($x) => in_array((string) $x['status'], ['succeeded','paid'], true));
    if ($усп) continue;
    $возвр = array_filter($p, fn($x) => (string) $x['status'] === 'refunded');
    if ($возвр) { $вернули[] = (int) $o['id']; continue; }
    $безДенег[] = (int) $o['id'];
}
chk('у каждого живого заказа есть удачный платёж', $безДенег === [],
    'без денег: ' . implode(', ', array_map(fn($i) => '#' . $i, $безДенег)));
/* Возвращённые деньги при выданном документе - это история, а не беда кода:
   31.08.2026 возвраты прошли без спроса (правило 8а), документы уже у людей. */
if ($вернули) spr('деньги возвращены, документ выдан (история 31.08): ' . implode(', ', array_map(fn($i) => '#' . $i, $вернули)));

$ничьи = all("SELECT p.id, p.order_id, p.amount FROM payments p
               WHERE p.status IN ('succeeded','paid') AND COALESCE(p.order_id,0)>0
                 AND NOT EXISTS (SELECT 1 FROM awards_orders o WHERE o.id=p.order_id)");
chk('удачных платежей на несуществующий заказ нет', $ничьи === [],
    implode(', ', array_map(fn($r) => 'платёж ' . $r['id'] . ' на ' . $r['amount'] . ' руб', $ничьи)));

$расх = [];
foreach ($orders as $o) {
    if (in_array((string) $o['status'], ['new','canceled'], true)) continue;
    $p = one("SELECT amount FROM payments WHERE order_id=? AND status IN ('succeeded','paid') ORDER BY id DESC LIMIT 1", [(int) $o['id']]);
    if ($p && (int) $p['amount'] !== (int) $o['amount']) $расх[] = '#' . $o['id'];
}
chk('сумма заказа равна сумме в кассе', $расх === [], implode(', ', $расх));

sec('ФАКТ: регистрация и видимость');
$безВида = []; $безБланков = []; $неОтправлены = [];
foreach ($orders as $o) {
    $d = json_decode((string) $o['items'], true);
    if (!is_array($d) || !$d) { $безВида[] = '#' . $o['id'] . ' (позиции не читаются)'; continue; }
    foreach ($d as $it) {
        if (!is_array($it) || trim((string) ($it['kind'] ?? '')) === '') { $безВида[] = '#' . $o['id']; break; }
    }
    $aid = (int) ($o['application_id'] ?? 0);
    $эл = array_filter($d, fn($i) => is_array($i) && (string) ($i['kind'] ?? 'digital') !== 'original' && (string) ($i['kind'] ?? '') !== 'club');
    if ($эл && $aid > 0 && in_array((string) $o['status'], ['paid','made','shipped','delivered'], true)) {
        $n = (int) scalar("SELECT COUNT(*) FROM diplomas WHERE application_id=? AND COALESCE(kind,'digital')<>'original'", [$aid]);
        if ($n === 0) $безБланков[] = '#' . $o['id'];
        if ((string) $o['status'] === 'delivered') {
            $нет = (int) scalar("SELECT COUNT(*) FROM diplomas WHERE application_id=? AND COALESCE(kind,'digital')<>'original' AND COALESCE(sent_at,'')=''", [$aid]);
            if ($нет > 0) $неОтправлены[] = '#' . $o['id'];
        }
    }
}
/* Вид позиции решает, в каком разделе заказ виден: оригиналы и электронные
   отбираются ПО ПОЗИЦИЯМ, а не по виду заказа, поэтому смешанный виден в обоих.
   Позиция без вида не попала бы ни в один раздел - заказ стал бы невидимым. */
chk('у каждой позиции есть вид, невидимых заказов нет', $безВида === [], implode(', ', array_slice($безВида, 0, 8)));
chk('у оплаченного заказа с электронными позициями есть бланки', $безБланков === [], implode(', ', $безБланков));
chk('у доставленного электронного письмо правда ушло', $неОтправлены === [], implode(', ', $неОтправлены));

$сироты = [];
foreach ($orders as $o) {
    if ((string) ($o['kind'] ?? '') === 'club') continue;
    $aid = (int) ($o['application_id'] ?? 0);
    if ($aid <= 0 || !one("SELECT id FROM applications WHERE id=?", [$aid])) $сироты[] = '#' . $o['id'];
}
/* Заказы-сироты оставлены историей словом владельца 15.10.2026 (правило 67):
   заявку удалили руками, снимок лежит в самом дипломе. Это справка, не провал. */
spr('заказов без заявки (история, слово владельца 15.10): ' . (implode(', ', $сироты) ?: 'нет'));

sec('ФАКТ: цена и заслоны');
$ценаПлохо = []; $пров = 0;
foreach ($orders as $o) {
    if ((string) $o['status'] === 'canceled' || (string) ($o['kind'] ?? '') === 'club') continue;
    $d = json_decode((string) $o['items'], true); if (!is_array($d) || !$d) continue;
    $cid = (int) (scalar("SELECT competition_id FROM applications WHERE id=?", [(int) $o['application_id']]) ?? 0);
    if ($cid <= 0 || !function_exists('ao_price')) continue;
    $s = 0; $знаем = true;
    foreach ($d as $it) {
        if (!is_array($it)) { $знаем = false; break; }
        $p = (int) ao_price($cid, (string) ($it['item'] ?? ''), (string) ($it['kind'] ?? 'digital'));
        if ($p <= 0) { $знаем = false; break; }
        $s += $p * max(1, (int) ($it['qty'] ?? 1));
    }
    if (!$знаем) continue;
    $пров++;
    $полн = (int) ($o['amount_full'] ?: $o['amount']);
    if ($s !== $полн) $ценаПлохо[] = '#' . $o['id'] . " (прайс $s, в заказе $полн)";
}
chk('цена позиций равна прайсу', $ценаПлохо === [], implode(', ', array_slice($ценаПлохо, 0, 8)));
spr('заказов с проверяемой ценой: ' . $пров);

$дополн = [];
if (function_exists('award_base_required')) {
    foreach ($orders as $o) {
        if ((string) $o['status'] === 'canceled' || (string) ($o['kind'] ?? '') === 'club') continue;
        $d = json_decode((string) $o['items'], true); if (!is_array($d)) continue;
        $aid = (int) $o['application_id'];
        $платный = (int) (scalar("SELECT c.is_paid FROM applications a LEFT JOIN competitions c ON c.id=a.competition_id WHERE a.id=?", [$aid]) ?? 0);
        $r = award_base_required($d, $aid, (bool) $платный);
        if (!empty($r['need'])) $дополн[] = '#' . $o['id'] . ' (' . $r['blocked'] . ')';
    }
}
chk('дополнительных без основного нет (правило 45)', $дополн === [], implode(', ', $дополн));

sec('ФАКТ: клубные подписки');
$клубБеда = [];
foreach (all("SELECT id,status,user_id,email FROM awards_orders WHERE COALESCE(kind,'')='club' ORDER BY id") as $r) {
    $uid = (int) ($r['user_id'] ?? 0);
    if ($uid <= 0 && trim((string) $r['email']) !== '') {
        $u = one("SELECT id FROM users WHERE LOWER(email)=LOWER(?)", [(string) $r['email']]);
        $uid = (int) ($u['id'] ?? 0);
    }
    /* Оплаченная подписка обязана дать членство. У заказа без пользователя его
       ищут по почте в самой двери оплаты; не нашёлся - деньги взяты, а клуба
       нет, и это надо увидеть ДО оплаты. */
    if ($uid <= 0) { $клубБеда[] = '#' . $r['id'] . ' некому выдать членство (' . $r['email'] . ')'; continue; }
    if ((string) $r['status'] === 'paid' && function_exists('club_members_row')) { /* ниже */ }
}
chk('у каждого клубного заказа есть кому выдать членство', $клубБеда === [], implode('; ', $клубБеда));
foreach (all("SELECT o.id, o.user_id FROM awards_orders o WHERE COALESCE(o.kind,'')='club' AND o.status='paid'") as $r) {
    $m = one("SELECT active, expires_at FROM club_members WHERE user_id=?", [(int) $r['user_id']]);
    if (!$m) { bad('по оплаченной подписке #' . $r['id'] . ' членство не выдано вовсе'); continue; }
    $жив = (int) ($m['active'] ?? 0) === 1;
    ok('подписка #' . $r['id'] . ' дала членство', $жив ? 'действует до ' . substr((string) $m['expires_at'], 0, 10)
        : 'истекло ' . substr((string) $m['expires_at'], 0, 10) . ', это норма для месячной');
}
/* Автопродление: сохранённого способа оплаты нет ни у кого, потому что касса
   рекуррент не разрешает. Это справка владельцу, а не провал кода. */
$сПМ = (int) scalar("SELECT COUNT(*) FROM club_members WHERE COALESCE(payment_method_id,'')<>''");
spr('участников с сохранённым способом оплаты (автопродление): ' . $сПМ
    . ' - пока ЮKassa не включит рекуррент, следующий период списать нечем');

sec('Объединённая посылка: одна заявка, один адрес, ничего не уехало');
chk('помощник союза посылок заведён', function_exists('og_sliy_po_zayavke'));
$гр_src = zsrc('core/order_group.php');
chk('og_groups зовёт союз', str_contains(ztelo('og_groups'), 'og_sliy_po_zayavke('));
$союз = ztelo('og_sliy_po_zayavke');
chk('союз требует ОБЩУЮ ЗАЯВКУ', str_contains($союз, 'array_intersect_key'),
    'одного адреса мало: у заявки 2411 два именных диплома разным детям и два разных адреса');
chk('союз требует ОДИН АДРЕС', str_contains($союз, 'og_addr_same('),
    'одной заявки мало: награду заказывают и домой, и в школу - это две посылки');
chk('союз не трогает уехавшее', str_contains($союз, "'shipped'") && str_contains($союз, "'delivered'"),
    'отправленную посылку не догнать, окно в пять дней написано именно под это');
chk('og_parcel_ids отбирает и по заявке', str_contains(ztelo('og_parcel_ids'), 'application_id = ?'),
    'иначе сосед по посылке с другой почтой просто не загрузится');

$страница = zsrc('admin/orders.php');
chk('карточка называет заказ посылки, которого нет на этой вкладке',
    str_contains($страница, 'Едет одной посылкой'),
    'вкладки отбирают по состоянию ДО группировки: половину коробки легко напечатать');
chk('полный состав посылок считается одним запросом на страницу',
    str_contains($страница, '$полныеПосылки') && !str_contains($страница, 'og_parcel_ids($oid)'),
    'вызов на каждую карточку дал бы до трёхсот запросов (правило 75)');

sec('Письмо об отправке - каждому, кто платил за посылку');
$дверь = ztelo('order_mark_shipped_parcel');
chk('адресаты собираются по всем заказам посылки', str_contains($дверь, 'foreach ($orders as $o)') && str_contains($дверь, 'mb_strtolower($e)'));
chk('письмо уходит циклом по адресатам', (bool) preg_match('~foreach\s*\(\$adresa\s+as\s+\$e\)~u', $дверь));
chk('одиночной отправки на первый адрес не осталось', !str_contains($дверь, 'mail_send($email,'),
    'иначе второй плательщик про отправку не узнает вовсе');
chk('in-app уведомление каждому владельцу заказа', (bool) preg_match('~foreach\s*\(array_keys\(\$uids\)~u', $дверь));
chk('о несобранном бланке говорится владельцу', str_contains(ztelo('order_generate_clean_pdfs'), 'owner_notify('),
    'журнал и аудит шесть дней молчали в пустоту');

sec('ФАКТ: посылки по живой базе');
$живые = all("SELECT * FROM awards_orders WHERE status IN ('paid','made','shipped')");
$гр    = og_groups($живые);
$карта = [];
foreach ($гр as $k => $g) foreach ((array) $g['ids'] as $i) $карта[(int) $i] = (string) $k;
$норм = static function (array $o): string {
    $n = trim((string) ($o['addr_key'] ?? ''));
    return $n !== '' ? $n : og_norm_address((string) ($o['address'] ?? ''));
};
$уехал = static fn(array $o): bool => in_array((string) ($o['status'] ?? ''), ['shipped', 'delivered'], true);
$разъехались = [];
foreach ($живые as $a) {
    foreach ($живые as $b) {
        if ((int) $a['id'] >= (int) $b['id']) continue;
        if (!og_needs_address($a) || !og_needs_address($b)) continue;
        if ($уехал($a) || $уехал($b)) continue;
        $app = (int) ($a['application_id'] ?? 0);
        if ($app <= 0 || $app !== (int) ($b['application_id'] ?? 0)) continue;
        $na = $норм($a); $nb = $норм($b);
        if ($na === '' || $nb === '' || !og_addr_same($na, $nb)) continue;
        if (($карта[(int) $a['id']] ?? 'нет') !== ($карта[(int) $b['id']] ?? 'нету')) {
            $разъехались[] = '#' . $a['id'] . ' и #' . $b['id'] . ' (заявка ' . $app . ')';
        }
    }
}
chk('заказы одной заявки на один адрес лежат в ОДНОЙ посылке', !$разъехались,
    $разъехались ? implode('; ', $разъехались) : 'проверено по всем живым заказам');

$чужой = [];
foreach ($гр as $k => $g) {
    $ids = array_map('intval', (array) $g['ids']);
    if (count($ids) < 2) continue;
    $адр = [];
    foreach ((array) $g['orders'] as $o) $адр[] = $норм($o);
    for ($i = 1, $n = count($адр); $i < $n; $i++) {
        if (!og_addr_same($адр[0], $адр[$i])) { $чужой[] = implode('+', $ids); break; }
    }
}
chk('в одной посылке нет двух разных адресов', !$чужой, $чужой ? implode('; ', $чужой) : 'проверено');

foreach ($гр as $g) {
    $ids = array_map('intval', (array) $g['ids']);
    if (count($ids) < 2) continue;
    $почты = [];
    foreach ((array) $g['orders'] as $o) { $e = trim((string) ($o['email'] ?? '')); if ($e !== '') $почты[mb_strtolower($e)] = $e; }
    spr('посылка ' . implode('+', $ids) . ': ' . $g['amount'] . ' руб, писем при отправке ' . count($почты)
        . ' (' . implode(', ', $почты) . ')');
}

sec('ФАКТ: у каждого живого заказа с бумажной позицией есть бланк на печать');
/* Этот заслон и поймал бы беду 12-18.10: на бастионе снесли браузер Playwright,
   рендер молча возвращал пустоту, и ни один чистый бланк не собирался. Проверка
   ТОЛЬКО ЧИТАЕТ: order_clean_pdfs без второго аргумента ничего не рендерит и
   ничего не пишет. */
/* СЧИТАЕМ ТОЛЬКО ТО, ЧТО ПРАВДА ПЕЧАТАЮТ.
 *
 * Первая сборка брала ЛЮБУЮ бумажную позицию и покраснела на тридцати живых
 * заказах - все они электронные. Это беда мерки: электронный документ уходит
 * человеку письмом из реестра (diplomas.pdf_path), и чистый бланк ему нужен
 * только как удобство в админке, по требованию. Красное на ровном месте
 * прячет настоящие отказы (правила 47, 62), а выдачу электронных держат свои
 * проверки выше. Здесь - ровно оригиналы: их кладут в коробку, и без листа
 * производство стоит. */
$безБланка = [];
foreach (all("SELECT * FROM awards_orders WHERE status IN ('paid','made')") as $o) {
    if (!order_has_originals($o)) continue;
    $app = (int) ($o['application_id'] ?? 0);
    $зв  = $app > 0 ? one("SELECT extra_diploma FROM applications WHERE id=?", [$app]) : null;
    $ждём = 0;
    foreach (order_items_parse($o) as $p) {
        if ((string) ($p['dtype'] ?? '') === '') continue;                     // трофей, печатать нечего
        if ((string) ($p['kind'] ?? 'original') !== 'original') continue;      // электронный лист не печатают
        // Дополнительный без присуждённой номинации бланка не получает намеренно.
        if ($p['dtype'] === 'extra' && trim((string) ($зв['extra_diploma'] ?? '')) === '') continue;
        $ждём++;
    }
    if ($ждём <= 0) continue;
    $есть = 0;
    foreach (order_clean_pdfs($o) as $c) if ((string) ($c['kind'] ?? 'original') === 'original') $есть++;
    if ($есть <= 0) $безБланка[] = '#' . $o['id'] . ' (' . $o['status'] . ')';
}
chk('бланк собран у всех, кому он положен', !$безБланка,
    $безБланка ? 'без листа на печать: ' . implode(', ', $безБланка) . ' - смотреть рендер на бастионе'
               : 'проверено по живым заказам');

sec('ФАКТ: что ждёт человека, а не кода');
foreach (all("SELECT id,kind,hold_reason FROM awards_orders WHERE COALESCE(hold_reason,'')<>''") as $r)
    spr('придержан #' . $r['id'] . ': ' . $r['hold_reason']);
foreach (all("SELECT id,kind,shipped_at,tracking FROM awards_orders WHERE status='shipped' ORDER BY id") as $r) {
    $дн = (int) floor((time() - (strtotime((string) $r['shipped_at']) ?: time())) / 86400);
    if ($дн > 20) spr('посылка #' . $r['id'] . ' отправлена ' . $дн . ' дней назад и не отмечена доставленной (трек ' . $r['tracking'] . ')');
}
$неопл = (int) scalar("SELECT COUNT(*) FROM awards_orders WHERE status='new'");
spr('неоплаченных заказов сейчас: ' . $неопл);

echo "\n" . str_repeat('─', 62) . "\n";
echo ($FAIL === 0 ? 'ЗАКАЗЫ ЧИСТО' : "ПРОВАЛОВ: $FAIL") . ", пройдено: $OK\n";
exit($FAIL === 0 ? 0 : 1);
