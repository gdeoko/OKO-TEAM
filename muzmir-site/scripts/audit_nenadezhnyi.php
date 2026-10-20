<?php
/**
 * АУДИТ СЕРОЙ ГАЛОЧКИ «НЕ ЗАБРАЛ ПОСЫЛКУ» (правка владельца 15.10.2026).
 *
 *   php scripts/audit_nenadezhnyi.php
 *
 * ЭТА ПРОВЕРКА ТОЛЬКО ЧИТАЕТ, И ЭТО УСЛОВИЕ, А НЕ СТИЛЬ. Проверка, которая
 * пишет, сама становится действием: 14.10.2026 прогон `audit_admin.php`
 * разослал по всей базе анонс закрытого конкурса (правило 49), а замер стёр
 * пункт положения (правило 51). Здесь это особенно важно: запись `pickup`
 * вешает на живого человека ярлык «ненадёжный» во всех разделах админки.
 * Поэтому `order_pickup_set()` отсюда НЕ зовётся ни с каким аргументом.
 */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { fwrite(STDERR, "CLI only\n"); exit(1); }

define('BASE_PATH', dirname(__DIR__));
$GLOBALS['CFG'] = require BASE_PATH . '/config.php';
foreach (['db','helpers','data','app_status','send_timing','loyalty','club','mailer','paylink'] as $m) {
    require_once BASE_PATH . '/core/' . $m . '.php';
}
require_once BASE_PATH . '/core/nenadezhnyi.php';
db();

const NAUDIT_HOST = 'xn----7sbugdeiegh1b0a9hen.xn--p1ai';

$FAIL = 0; $OK = 0;
function sec(string $s): void { echo "\n=== $s ===\n"; }
function ok(string $w, $i = ''): void { global $OK; $OK++; echo "  ok   $w" . ($i !== '' ? "  [$i]" : '') . "\n"; }
function bad(string $w, $i = ''): void { global $FAIL; $FAIL++; echo "  FAIL $w" . ($i !== '' ? "  $i" : '') . "\n"; }
function chk(string $w, $cond, $i = ''): void { $cond ? ok($w, $i) : bad($w, $i); }
function note(string $w): void { echo "  --   $w\n"; }

/**
 * Исходник БЕЗ ПОЯСНЕНИЙ. Иначе проверка краснеет на нашем же разборе: эта
 * грабля в проекте оплачена шесть раз (правила 40, 48, 56, 57а, 58).
 *
 * ПОЯСНЕНИЯ ВЫРЕЗАЕТ РАЗБОРЩИК PHP, А НЕ РЕГУЛЯРКА, И ЭТО КУПЛЕНО ЗАМЕРОМ.
 * Первая сборка снимала комментарии шаблоном `/*…*\/` с флагом `s`. В файле
 * админки такие знаки стоят и внутри строк, и в CSS, и в JS, поэтому вырезка
 * шла от чужого `/*` до следующего `*\/` и съедала ЖИВОЙ КОД: в
 * `admin/diplomas.php` из двух галочек проверка видела одну, счёт «серых
 * столько же, сколько синих» сходился на половине файла, а подложенная порча
 * второй половины не краснела вовсе. Мерка показывала беду мерки.
 * `token_get_all()` знает, где комментарий, а где строка и разметка.
 */
function nsrc(string $rel): string {
    $f = BASE_PATH . '/' . $rel;
    if (!is_file($f)) return '';
    $s = (string) file_get_contents($f);
    try { $токены = @token_get_all($s); } catch (\Throwable $e) { return $s; }
    if (!$токены) return $s;
    $out = '';
    foreach ($токены as $t) {
        if (is_array($t)) {
            if ($t[0] === T_COMMENT || $t[0] === T_DOC_COMMENT) { $out .= ' '; continue; }
            $out .= $t[1];
        } else { $out .= $t; }
    }
    return $out;
}

/* ЗАПРОС К ЖИВОЙ СТРАНИЦЕ И ВХОД — ОДИН НА ВЕСЬ АУДИТ.
 * Помощник жил внутри блока пикселей, и второй проверке страниц пришлось бы
 * заводить свою копию: копии расходятся молча (правила 33, 35, 45, 47, 56а).
 * Запрос идёт на 127.0.0.1 с нужным заголовком Host — наружу не выходит. */
function nbase(): string { return 'https://' . NAUDIT_HOST; }
function nhttp(string $path, array $post = null): array {
    static $jar = null;
    if ($jar === null) { $jar = sys_get_temp_dir() . '/muzmir_nen_audit.txt'; @unlink($jar); }
    $ch = curl_init(nbase() . $path);
    curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER=>true, CURLOPT_SSL_VERIFYPEER=>false, CURLOPT_SSL_VERIFYHOST=>0,
        CURLOPT_RESOLVE=>[NAUDIT_HOST.':443:127.0.0.1', NAUDIT_HOST.':80:127.0.0.1'],
        CURLOPT_FOLLOWLOCATION=>true, CURLOPT_MAXREDIRS=>5, CURLOPT_COOKIEJAR=>$jar,
        CURLOPT_COOKIEFILE=>$jar, CURLOPT_TIMEOUT=>60, CURLOPT_PROXY=>'',
        CURLOPT_HTTPHEADER=>['Origin: '.nbase(), 'Referer: '.nbase().'/']]);
    if ($post !== null) { curl_setopt($ch, CURLOPT_POST, true); curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query($post)); }
    $b = (string) curl_exec($ch); $c = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE); curl_close($ch);
    return ['code'=>$c, 'body'=>$b];
}
function nvhod(): bool {
    static $есть = null;
    if ($есть !== null) return $есть;
    $r = nhttp('/admin/');
    preg_match('~name="_csrf"\s+value="([^"]+)"~', $r['body'], $m);
    require_once BASE_PATH . '/scripts/_audit_actors.php';
    $ADM = audit_actor('admin');
    $r = nhttp('/admin/', ['_csrf' => $m[1] ?? '', 'do' => 'login',
          'email' => $ADM['email'], 'password' => $ADM['password']]);
    return $есть = stripos($r['body'], 'p=logout') !== false;
}
/** Номера заказов, ПРАВДА напечатанные на странице: их несёт поле отправки отметки. */
function nids_na_stranice(string $body): array {
    preg_match_all('~name="orders" value="([0-9,]+)"~', $body, $mm);
    $ids = [];
    foreach ($mm[1] as $стр) foreach (explode(',', $стр) as $i) if ((int) $i) $ids[(int) $i] = 1;
    ksort($ids);
    return array_keys($ids);
}

/* ───────────── 1. ОДИН ИСТОЧНИК ───────────── */
sec('Факт живёт в одном месте');
chk('файл core/nenadezhnyi.php на месте', is_file(BASE_PATH . '/core/nenadezhnyi.php'));
foreach (['nenadezhnye','nenadezhnyi_sluchai','nenadezhnyi_est','nenadezhnyi_metka',
          'nenadezhnyi_slovami','nenadezhnyi_sostoyanie_posylki','nenadezhnyi_kogda_posylki'] as $f) {
    chk("помощник $f() есть", function_exists($f));
}
$cols = [];
foreach (db()->query("PRAGMA table_info(awards_orders)") as $r) $cols[] = (string) $r['name'];
chk('колонка awards_orders.pickup есть', in_array('pickup', $cols, true));
chk('колонка awards_orders.pickup_at есть', in_array('pickup_at', $cols, true));

/* ВТОРОЙ ЗАПИСИ ФАКТА БЫТЬ НЕ ДОЛЖНО. Признак «ненадёжный» в `users` был бы
   копией отметки на заказе, а копии расходятся молча (правила 33, 35, 45, 47):
   оператор нажал «ЗАБРАЛ», отметка снялась, а ярлык на человеке остался. */
$ucols = [];
foreach (db()->query("PRAGMA table_info(users)") as $r) $ucols[] = (string) $r['name'];
$двойники = array_values(array_filter($ucols, static fn($c) =>
    preg_match('~nenadezh|unreliab|neblagon|pickup~i', $c) === 1));
chk('в users второго признака «ненадёжный» нет', !$двойники, implode(',', $двойники));

/* ЗАПИСЬ ТОЛЬКО ЧЕРЕЗ ДВЕРЬ `order_pickup_set()`. Пультов отправки два
   (admin/orders.php и admin/dispatch.php), и проверка в одном оставила бы
   второй открытым — грабля правил 45 и 54. */
$пишут = [];
foreach (['core','cron','admin','api','scripts','templates'] as $dir) {
    $d = BASE_PATH . '/' . $dir;
    if (!is_dir($d)) continue;
    $it = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($d));
    foreach ($it as $file) {
        if (!$file->isFile() || $file->getExtension() !== 'php') continue;
        $rel = str_replace(BASE_PATH . '/', '', $file->getPathname());
        if (strpos($rel, '.bak') !== false) continue;
        if ($rel === 'core/orders.php') continue;                 // сама дверь
        if ($rel === 'scripts/audit_nenadezhnyi.php') continue;   // и не читаем себя
        $s = nsrc($rel);
        if ($s === '') continue;
        if (preg_match("~'pickup'\\s*=>~", $s)) $пишут[] = $rel;
    }
}
chk('никто не пишет pickup мимо двери order_pickup_set()', !$пишут, implode(', ', $пишут));
$door = nsrc('core/orders.php');
chk('дверь order_pickup_set() есть', strpos($door, 'function order_pickup_set') !== false);
chk('дверь не пускает неотправленную посылку',
    strpos($door, "'shipped', 'delivered'") !== false && strpos($door, 'ORDER_PICKUP_ERROR') !== false);
chk('дверь не пускает электронные и членство в клубе',
    preg_match("~\\['digital', 'club'\\]~", $door) === 1);
chk('дверь перечитывает память галочек после записи',
    strpos($door, 'nenadezhnye(true)') !== false);

/* УСЛОВИЕ «НЕ ЗАБРАЛ» В ЗАПРОСАХ — ТОЖЕ В ОДНОМ МЕСТЕ. */
$считают = [];
foreach (['admin/orders.php','admin/dispatch.php','admin/applications.php','admin/digital.php',
          'admin/diplomas.php','admin/grading.php','admin/longcomp.php','admin/users.php',
          'admin/_boot.php','core/orders.php'] as $rel) {
    $s = nsrc($rel);
    if ($s !== '' && preg_match("~pickup\\s*=\\s*'missed'|pickup='missed'~", $s)) $считают[] = $rel;
}
chk('условие «не забрал» в запросах только в core/nenadezhnyi.php', !$считают, implode(', ', $считают));

/* ───────────── 2. ГАЛОЧКА СТОИТ РЯДОМ С ИМЕНЕМ ВЕЗДЕ ───────────── */
sec('Галочка рядом с именем во всех разделах админки');
$места = [
    'admin/applications.php' => 'заявки на участие: список и карточка',
    'admin/grading.php'      => 'оценка коротких конкурсов: очередь и карточка',
    'admin/longcomp.php'     => 'оценка длинных конкурсов',
    'admin/_boot.php'        => 'таблица «Оценённые»',
    'admin/diplomas.php'     => 'дипломы: к выдаче и реестр',
    'admin/digital.php'      => 'заказы электронных наград',
    'admin/orders.php'       => 'заказы оригиналов',
    'admin/dispatch.php'     => 'очередь отправок и архив',
    'admin/users.php'        => 'пользователи: список и профиль',
];
foreach ($места as $rel => $что) {
    $s = nsrc($rel);
    $вип = preg_match_all('~vip_mark\(|vip_badge\(~', $s);
    $сер = preg_match_all('~nenadezhnyi_metka\(~', $s);
    chk("$что — галочка есть", $сер > 0, "серых $сер, синих $вип");
    /* СКОЛЬКО СИНИХ ГАЛОЧЕК, СТОЛЬКО И СЕРЫХ. Синяя галочка клуба стоит ровно
       там, где печатается имя участника, поэтому это и есть список мест, где
       владелец ждёт серую. Пропусти одно - и в одном разделе из девяти человек
       выглядел бы надёжным. */
    if ($вип > 0) chk("$что — ни одно имя не пропущено", $сер >= $вип, "серых $сер при $вип синих");
}
chk('в _boot.php стоит заглушка на случай отсутствия файла',
    strpos(nsrc('admin/_boot.php'), "if (!function_exists('nenadezhnyi_metka'))") !== false);
chk('_boot.php подключает единый источник',
    strpos(nsrc('admin/_boot.php'), "core/nenadezhnyi.php") !== false);

/* ───────────── 3. КНОПКИ РУЧНОГО УПРАВЛЕНИЯ ───────────── */
sec('Кнопки «ЗАБРАЛ» и «НЕ ЗАБРАЛ» в заказах оригиналов');
$ord = nsrc('admin/orders.php');
chk('кнопка «ЗАБРАЛ» в шаблоне', strpos($ord, '>ЗАБРАЛ<') !== false);
chk('кнопка «НЕ ЗАБРАЛ» в шаблоне', strpos($ord, '>НЕ ЗАБРАЛ<') !== false);
chk('обработчик pickup_taken', strpos($ord, "'pickup_taken'") !== false);
chk('обработчик pickup_missed', strpos($ord, "'pickup_missed'") !== false);
chk('оба обработчика зовут дверь', strpos($ord, 'order_pickup_set(') !== false);
/* КНОПКИ ВИДНЫ И НА «ДОСТАВЛЕНО». «Доставлено» значит «дошло до отделения», а
   забрал человек посылку или нет, выясняется уже после этой отметки. */
chk('кнопки стоят и на «Отправлено», и на «Доставлено»',
    preg_match("~in_array\\(\\\$st, \\['shipped','delivered'\\], true\\)[^;]*nenadezhnyi_sostoyanie_posylki~s", $ord) === 1);
chk('отметка ставится на всю посылку сразу', strpos($ord, 'name="orders" value="<?= h($idsS) ?>"') !== false);
chk('в сообщении оператору сказано про галочку',
    strpos($ord, 'серая галочка') !== false || strpos($ord, '«ненадёжный»') !== false);

/* ───────────── 4. РАСЧЁТ (без записи и без базы) ───────────── */
sec('Расчёт галочки');
chk('почта сверяется в нижнем регистре',
    nenadezhnyi_pochta('  AN.Bo4@Yandex.RU ') === 'an.bo4@yandex.ru', nenadezhnyi_pochta(' A@B.RU '));
chk('пустые ключи никого не метят', nenadezhnyi_est(0, '', 0) === false);
chk('пустая почта с пробелами никого не метит', nenadezhnyi_est(0, '   ', 0) === false);
chk('у забранной посылки состояние «забрал»',
    nenadezhnyi_sostoyanie_posylki([['pickup' => PICKUP_ZABRAL], ['pickup' => PICKUP_ZABRAL]]) === PICKUP_ZABRAL);
chk('хоть один «не забрал» — вся посылка не забрана',
    nenadezhnyi_sostoyanie_posylki([['pickup' => PICKUP_ZABRAL], ['pickup' => PICKUP_NE_ZABRAL]]) === PICKUP_NE_ZABRAL);
chk('неотмеченная посылка состояния не имеет',
    nenadezhnyi_sostoyanie_posylki([['pickup' => PICKUP_ZABRAL], ['pickup' => '']]) === '');
chk('пустая посылка состояния не имеет', nenadezhnyi_sostoyanie_posylki([]) === '');
chk('дата в подсказке по-человечески', nenadezhnyi_data('2026-10-15 11:20:00') === '15.10.2026',
    nenadezhnyi_data('2026-10-15 11:20:00'));

/* ───────────── 5. ФАКТ ПО ЖИВОЙ БАЗЕ ───────────── */
sec('Факт: что отмечено в базе на самом деле');
$мимо = all("SELECT id, status, COALESCE(kind,'') kind FROM awards_orders
              WHERE COALESCE(pickup,'') <> ''
                AND (status NOT IN ('shipped','delivered') OR COALESCE(kind,'') IN ('digital','club'))");
chk('отметок получения на неотправленном и на электронном нет', !$мимо,
    implode(', ', array_map(static fn($o) => '№' . $o['id'] . ' ' . $o['status'] . '/' . $o['kind'], $мимо)));
$нз = all("SELECT id, COALESCE(user_id,0) uid, COALESCE(email,'') em, COALESCE(application_id,0) app,
                  COALESCE(full_name,'') fio, COALESCE(pickup_at,'') kogda
             FROM awards_orders WHERE pickup = ?", [PICKUP_NE_ZABRAL]);
$безключа = array_values(array_filter($нз, static fn($o) =>
    (int) $o['uid'] <= 0 && trim((string) $o['em']) === '' && (int) $o['app'] <= 0));
chk('у каждой незабранной посылки есть, по чему узнать человека', !$безключа,
    implode(', ', array_map(static fn($o) => '№' . $o['id'], $безключа)));
note('незабранных посылок в базе: ' . count($нз));
foreach ($нз as $o) {
    note('  №' . $o['id'] . ' · ' . ($o['fio'] ?: $o['em']) . ' · заявка ' . (int) $o['app']
         . ' · отмечено ' . ($o['kogda'] !== '' ? nenadezhnyi_data((string) $o['kogda']) : 'без даты'));
}

/* ПИКСЕЛИ: ГАЛОЧКА ПРАВДА НАПЕЧАТАНА НА ЖИВОЙ СТРАНИЦЕ.
   Функция может отдавать верный HTML, а строки в шаблоне не быть вовсе
   (урок правила 47). Проверяем только по тем, кто УЖЕ отмечен: ставить
   отметку ради проверки нельзя - это ярлык на живом человеке. */
if (!$нз) {
    note('ненадёжных нет — пиксели проверять не на ком; шаблоны проверены выше по исходникам');
    note('разовый прогон с отметкой и откатом сделан 15.10.2026: галочка появилась');
    note('в карточке заявки, списке заявок, длинном конкурсе, реестре дипломов,');
    note('отправленных дипломах, пользователях, карточке оценки и карточке заказа');
} else {
    $o = $нз[0];
    if (!nvhod()) { bad('вход администратором для проверки пикселей'); }
    else {
        ok('вход администратором');
        $app = (int) $o['app'];
        $стр = ['карточка заказа' => '/admin/?p=orders&status=' . (string) (scalar(
                    "SELECT status FROM awards_orders WHERE id=?", [(int) $o['id']]) ?? 'shipped')];
        if ($app > 0) {
            $стр['карточка заявки'] = '/admin/?p=applications&id=' . $app;
            $ном = (string) (scalar("SELECT COALESCE(number,'') FROM applications WHERE id=?", [$app]) ?? '');
            if ($ном !== '') $стр['список заявок'] = '/admin/?p=applications&q=' . rawurlencode($ном);
        }
        if (trim((string) $o['em']) !== '') $стр['пользователи'] = '/admin/?p=users&q=' . rawurlencode((string) $o['em']);
        foreach ($стр as $имя => $u) {
            $x = nhttp($u);
            $есть = substr_count($x['body'], NENADEZHNYI_CVET) > 0;
            chk("серая галочка напечатана: $имя", $x['code'] === 200 && $есть,
                'код ' . $x['code'] . ', галочек ' . substr_count($x['body'], NENADEZHNYI_CVET));
            chk("нет PHP-шума: $имя", stripos($x['body'], 'Fatal error') === false
                && stripos($x['body'], 'undefined function') === false);
        }
    }
}

/* ───────────── 6. ПАПКА «ЗАБРАЛИ» (правка владельца 15.10.2026) ─────────────
 * Слово владельца: «вместо папки „ожидает оплаты" создай подраздел „забрали" и
 * перенеси с папки „доставлено" все заявки которые я отметил как „забрал"».
 * Проверяем и исходник, и ФАКТ по живым страницам: число на вкладке обязано
 * равняться тому, что в ней правда напечатано, иначе «Доставлено · 51» обещает
 * список, в котором 25 строк отобраны в другую папку. */
sec('Папка «Забрали» в заказах оригиналов');
chk('вкладка «Забрали» есть', strpos($ord, "=> 'Забрали'") !== false);
chk('подпись «Ожидает оплаты» осталась у состояния на карточке',
    strpos($ord, "'new'=>'Ожидает оплаты'") !== false);
chk('список вкладок собран отдельно от $STAT',
    preg_match("~\\\$TABS\s*=\s*\['' => 'В работе'~u", $ord) === 1);
chk('вкладки «Ожидает оплаты» среди вкладок нет',
    !preg_match("~\\\$TABS\s*=\s*\[[^;]*Ожидает оплаты~su", $ord));
/* АДРЕС ОТСЛЕЖИВАНИЯ СОБИРАЕТ ОДНА МЕРКА, А НЕ ВПИСАН СТРОКОЙ. Вторая копия
   адреса разошлась бы молча (правила 33, 35, 45, 47, 56а, 64): поменяется
   форма ссылки у Почты - править пришлось бы в двух местах, а узнали бы мы об
   этом от оператора. */
$__ордЖ = nsrc('admin/orders.php');
chk('«Отследить» стоит и на «Доставлено»',
    preg_match('~\$st === .delivered.*?>Отследить<~us', $__ордЖ) === 1,
    'раньше трек пропадал с карточки ровно тогда, когда он нужнее всего');
chk('адрес отслеживания берётся у order_pochta_url',
    mb_strpos($__ордЖ, 'order_pochta_url') !== false
    && mb_strpos($__ордЖ, 'pochta.ru/tracking') === false);

chk('ссылка ?status=new оставлена живой',
    preg_match("~in_array\(\\\$filter, \['new','paid','made','canceled'\], true\)~", $ord) === 1);
chk('забранные отобраны из «Отправлено» и «Доставлено»',
    preg_match("~in_array\(\\\$filter, \['shipped','delivered'\], true\)[^;]*NOT \(\\\$ZABRALI\)~s", $ord) === 1);
chk('у папки «Забрали» свой отбор',
    strpos($ord, "status IN ('shipped','delivered') AND \$ZABRALI") !== false);
chk('значение отметки берётся из единственного источника, а не вписано строкой',
    strpos($ord, '. PICKUP_ZABRAL .') !== false && !preg_match("~pickup,''\)\s*=\s*'taken'~", $ord));
chk('счётчик вкладки знает про отметку',
    strpos($ord, 'GROUP BY status, pk') !== false && strpos($ord, '$zabPo') !== false);
chk('неоплаченные названы строкой под вкладками', strpos($ord, 'Неоплаченных заказов') !== false);

if (!nvhod()) { bad('вход администратором для проверки папок'); }
else {
    $ОРИГ = "items NOT LIKE '%\"kind\":\"club\"%' AND items LIKE '%\"kind\":\"original\"%'";
    $вБазе = static function (string $усл) use ($ОРИГ): array {
        $o = [];
        foreach (all("SELECT id FROM awards_orders WHERE $ОРИГ AND $усл ORDER BY id") as $r) $o[] = (int) $r['id'];
        return $o;
    };
    $папки = [
        'taken'     => ['Забрали',    "status IN ('shipped','delivered') AND COALESCE(pickup,'') = '" . PICKUP_ZABRAL . "'"],
        'delivered' => ['Доставлено', "status = 'delivered' AND COALESCE(pickup,'') <> '" . PICKUP_ZABRAL . "'"],
        'shipped'   => ['Отправлено', "status = 'shipped'   AND COALESCE(pickup,'') <> '" . PICKUP_ZABRAL . "'"],
        'archive'   => ['Архив',      "status IN ('shipped','delivered')"],
    ];
    foreach ($папки as $вкладка => [$имя, $усл]) {
        $x = nhttp('/admin/?p=orders&status=' . $вкладка);
        $напечатано = nids_na_stranice($x['body']);
        $надо = $вБазе($усл);
        $лишние = array_values(array_diff($напечатано, $надо));
        $нет    = array_values(array_diff($надо, $напечатано));
        chk("папка «{$имя}» печатает ровно свои заказы", $x['code'] === 200 && !$лишние && !$нет,
            'код ' . $x['code'] . ', напечатано ' . count($напечатано) . ' из ' . count($надо)
            . ($лишние ? ', лишние: ' . implode(',', array_slice($лишние, 0, 8)) : '')
            . ($нет ? ', недостаёт: ' . implode(',', array_slice($нет, 0, 8)) : ''));
        chk("нет PHP-шума: папка «{$имя}»", stripos($x['body'], 'Fatal error') === false
            && stripos($x['body'], 'undefined function') === false);

    /* КНОПКА «ОТСЛЕДИТЬ» ЖИВЁТ И ПОСЛЕ «ДОСТАВЛЕНО» (правка владельца
           15.10.2026). «Доставлено» значит «дошла до отделения», и трек нужен
           ровно здесь: по нему оператор и смотрит, забрал человек посылку или она
           поехала обратно. Считаем ПО ФАКТУ на живой странице: кнопок столько же,
           сколько карточек с трек-номером. Карточка это группа (объединённая
           посылка - одна карточка на несколько заказов), поэтому карточки считаем
           по РАЗНЫМ значениям поля отправки, а не по числу заказов. */
        if (in_array($вкладка, ['shipped', 'delivered', 'taken'], true)) {
            $кнопок   = preg_match_all('~>Отследить<~u', $x['body']);
            $карточек = 0;
            if (preg_match_all('~name="orders" value="([0-9,]+)"~', $x['body'], $gg)) {
                $карточек = count(array_unique($gg[1]));
            }
            $сТреком = 0;
            foreach (array_unique($gg[1] ?? []) as $груп) {
                $пер = array_map('intval', explode(',', $груп));
                $in  = implode(',', $пер);
                $сТреком += ((int) scalar("SELECT COUNT(*) FROM awards_orders
                    WHERE id IN ($in) AND COALESCE(tracking,'') <> ''") > 0) ? 1 : 0;
            }
            chk("папка «{$имя}»: «Отследить» у каждой карточки с треком",
                $кнопок === $сТреком,
                "кнопок {$кнопок}, карточек с треком {$сТреком} из {$карточек}");
        }
    }
    /* ЧИСЛО НА ВКЛАДКЕ РАВНО ТОМУ, ЧТО В НЕЙ ЛЕЖИТ. Иначе папка обещает список,
       которого в ней нет, и оператор перестаёт верить пульту. */
    $b = nhttp('/admin/?p=orders')['body'];
    foreach (['Забрали' => 'taken', 'Доставлено' => 'delivered', 'Отправлено' => 'shipped'] as $имя => $вкладка) {
        $надо = count($вБазе($папки[$вкладка][1]));
        chk("число на вкладке «{$имя}» равно настоящему",
            (bool) preg_match('~' . preg_quote($имя, '~') . '\s*·\s*' . $надо . '~u', $b), 'в базе ' . $надо);
    }
    /* НЕОПЛАЧЕННЫЕ НЕ ПОТЕРЯНЫ ВМЕСТЕ СО СВОЕЙ ВКЛАДКОЙ: пока они есть, под
       вкладками стоит строка со ссылкой; когда их нет, строки быть и не должно. */
    $неопл = count($вБазе("status = 'new'"));
    chk('строка про неоплаченные стоит по факту',
        (strpos($b, 'Неоплаченных заказов') !== false) === ($неопл > 0), 'неоплаченных ' . $неопл);
    if ($неопл > 0) {
        $x = nhttp('/admin/?p=orders&status=new');
        chk('ссылка ?status=new открывает неоплаченные',
            $x['code'] === 200 && count(nids_na_stranice($x['body'])) === $неопл);
    } else {
        note('неоплаченных заказов оригиналов нет — терять нечего');
    }
    /* ЗАБРАННЫЙ ЗАКАЗ НАХОДИТСЯ ПОИСКОМ: поиск идёт по всему разделу, а не по
       открытой вкладке, и папка «Забрали» этого не меняет. */
    $зб = $вБазе("COALESCE(pickup,'') = '" . PICKUP_ZABRAL . "'");
    if ($зб) {
        $x = nhttp('/admin/?p=orders&q=' . rawurlencode('№' . $зб[0]));
        chk('забранный заказ находится поиском', in_array($зб[0], nids_na_stranice($x['body']), true), '№' . $зб[0]);
    } else { note('забранных посылок в базе нет — папка «Забрали» пуста по факту'); }
}

echo "\n==== ИТОГО: проверок " . ($OK + $FAIL) . ", ПРОВАЛОВ: $FAIL ====\n";
exit($FAIL > 0 ? 1 : 0);
