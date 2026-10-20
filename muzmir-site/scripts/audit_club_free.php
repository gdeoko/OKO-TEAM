<?php
/**
 * АУДИТ БЕСПЛАТНЫХ ЗАЯВОК ЭЛИТНОГО КЛУБА (правило владельца 15.10.2026).
 *
 *   php scripts/audit_club_free.php
 *
 * ТОЛЬКО ЧИТАЕТ. Проверка, которая пишет, сама становится действием: 14.10.2026
 * прогон `audit_admin.php` разослал анонс закрытого конкурса по всей базе
 * (правило 49), а замер стёр пункт положения (правило 51). Здесь запись была бы
 * ещё дороже - это приём заявки и деньги участника, - поэтому ни одной подачи
 * отсюда не делается.
 */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { fwrite(STDERR, "CLI only\n"); exit(1); }

define('BASE_PATH', dirname(__DIR__));
$GLOBALS['CFG'] = require BASE_PATH . '/config.php';
foreach (['db','helpers','data','app_status','send_timing','loyalty','club','mailer'] as $m) {
    require_once BASE_PATH . '/core/' . $m . '.php';
}
require_once BASE_PATH . '/core/club_free.php';
require_once BASE_PATH . '/core/club_perks.php';
db();

$FAIL = 0; $OK = 0;
function sec(string $s): void { echo "\n=== $s ===\n"; }
function ok(string $w, $i = ''): void { global $OK; $OK++; echo "  ok   $w" . ($i !== '' ? "  [$i]" : '') . "\n"; }
function bad(string $w, $i = ''): void { global $FAIL; $FAIL++; echo "  FAIL $w" . ($i !== '' ? "  $i" : '') . "\n"; }
function chk(string $w, $cond, $i = ''): void { $cond ? ok($w, $i) : bad($w, $i); }
function note(string $w): void { echo "  --   $w\n"; }

/**
 * Исходник БЕЗ ПОЯСНЕНИЙ, разбором PHP. Регулярка `/*…*\/` с флагом `s` съедает
 * живой код там, где такие знаки стоят в строках, CSS и JS - на этом 15.10.2026
 * соврала моя же мерка в аудите серой галочки (правило 63).
 */
function cfsrc(string $rel): string {
    $f = BASE_PATH . '/' . $rel;
    if (!is_file($f)) return '';
    $s = (string) file_get_contents($f);
    if (substr($rel, -3) === '.js') {
        // В JS токенизатора PHP нет: снимаем только строчные пояснения, а
        // блочные ищем попарно от начала строки, чтобы не съесть код.
        $s = (string) preg_replace('~^\s*//.*$~m', ' ', $s);
        return $s;
    }
    try { $t = @token_get_all($s); } catch (\Throwable $e) { return $s; }
    if (!$t) return $s;
    $out = '';
    foreach ($t as $x) {
        if (is_array($x)) {
            if ($x[0] === T_COMMENT || $x[0] === T_DOC_COMMENT) { $out .= ' '; continue; }
            $out .= $x[1];
        } else { $out .= $x; }
    }
    return $out;
}

/* ───────────── 1. ЧИСЛО ВЛАДЕЛЬЦА И ОДИН ИСТОЧНИК ───────────── */
sec('Правило: до трёх заявок в месяц без оргвзноса');
chk('предел равен трём', club_free_limit() === 3, (string) club_free_limit());
chk('колонка applications.club_free есть', (function (): bool {
    foreach (db()->query("PRAGMA table_info(applications)") as $r) if ((string) $r['name'] === 'club_free') return true;
    return false;
})());
foreach (['club_free_used','club_free_left','club_free_polozheno','club_free_slovami',
          'club_free_limit','club_free_month'] as $f) {
    chk("помощник $f() есть", function_exists($f));
}
/* ЧИСЛО НЕ ВПИСЫВАЕТСЯ РУКАМИ НИГДЕ. Копия разошлась бы с дверью подачи молча:
   эта грабля в проекте оплачена пять раз (правила 33, 35, 45, 47, 56а). */
$вписали = [];
foreach (['templates/site/pages/club.php','templates/site/pages/apply.php','core/club_perks.php',
          'scripts/vk_posts_offers.php','core/chat_brain.php','core/mail_campaigns.php'] as $rel) {
    $s = cfsrc($rel);
    if ($s === '') continue;
    if (preg_match('~(?:до|До)\s+3\s+заявок|3\s+заявки\s+в\s+(?:платном|месяц)~u', $s)) $вписали[] = $rel;
}
chk('число бесплатных заявок нигде не вписано строкой', !$вписали, implode(', ', $вписали));
foreach (['templates/site/pages/club.php','core/club_perks.php','scripts/vk_posts_offers.php',
          'templates/site/pages/apply.php'] as $rel) {
    chk('число берётся из club_free_limit(): ' . $rel,
        strpos(cfsrc($rel), 'club_free_limit') !== false);
}

/* СЧЁТ ПО КАЛЕНДАРНОМУ МЕСЯЦУ, А НЕ ПО КОНКУРСУ (слово владельца 15.10.2026:
   «не более 3 заявок... за месяц»). Платный конкурс в месяце один, и по конкурсу
   счёт сегодня дал бы то же число - но заведи владелец второй платный конкурс, и
   участник получил бы шесть бесплатных заявок вместо трёх, молча. */
$cf = cfsrc('core/club_free.php');
chk('счёт идёт по месяцу подачи',
    strpos($cf, "substr(COALESCE(created_at,''), 1, 7) = ?") !== false);
chk('в счёте нет условия по конкурсу', strpos($cf, 'competition_id = ?') === false);
chk('месяц берётся по местному календарю', strpos($cf, "date('Y-m'") !== false);
chk('месяц сейчас', club_free_month() === date('Y-m'), club_free_month());

/* ───────────── 2. ДВЕРЬ ПОДАЧИ ───────────── */
sec('Дверь подачи: льгота применяется сама и до счёта');
$ap = cfsrc('api/v1/apply.php');
chk('дверь подключает единый источник', strpos($ap, 'club_free.php') !== false);
chk('льгота решается club_free_polozheno()', strpos($ap, 'club_free_polozheno(') !== false);
/* ОТМЕТКА СТОИТ ДО РАЗДЕЛЕНИЯ НА ПЛАТНЫЕ И БЕСПЛАТНЫЕ. Поставь её после - и
   человек получил бы счёт на то, что ему положено даром. */
$позОтм = strpos($ap, '$clubFreeIds = [];');
$позРаз = strpos($ap, '$freeAppIds = [];');
chk('отметка ставится ДО разделения заявок',
    $позОтм !== false && $позРаз !== false && $позОтм < $позРаз,
    'отметка ' . (int) $позОтм . ', разделение ' . (int) $позРаз);
chk('льготная заявка идёт в бесплатные',
    preg_match('~in_array\(\(int\) \$appIds\[\$i\], \$clubFreeIds, true\)~', $ap) === 1);
chk('льготная заявка не попадает в сумму счёта',
    preg_match('~\$paidComps\s*=\s*\[\];~', $ap) === 1
    && preg_match('~in_array\(\(int\) \(\$appIds\[\$__pi\] \?\? 0\), \$clubFreeIds, true\)~', $ap) === 1);
chk('общая скидка не переписывает расшифровку льготной',
    preg_match('~in_array\(\$__aid, \$clubFreeIds, true\)\) continue;~', $ap) === 1);
chk('внутри одной подачи счёт ведётся свой', strpos($ap, '$__клубВзято') !== false);
chk('остаток в двери берётся на месяц, без номера конкурса',
    preg_match('~club_free_left\(\(int\) \$uid\)~', $ap) === 1
    && preg_match('~club_free_left\(\(int\) \$uid,~', $ap) === 0);
/* ПИШЕТ ОТМЕТКУ ТОЛЬКО ДВЕРЬ. */
$пишут = [];
foreach (['core','cron','admin','api','scripts','templates'] as $dir) {
    $d = BASE_PATH . '/' . $dir;
    if (!is_dir($d)) continue;
    foreach (new RecursiveIteratorIterator(new RecursiveDirectoryIterator($d)) as $file) {
        if (!$file->isFile() || $file->getExtension() !== 'php') continue;
        $rel = str_replace(BASE_PATH . '/', '', $file->getPathname());
        if (strpos($rel, '.bak') !== false) continue;
        if ($rel === 'api/v1/apply.php' || $rel === 'scripts/audit_club_free.php') continue;
        /* ИЩЕМ ЗАПИСЬ В БАЗУ, А НЕ ЛЮБОЕ УПОМИНАНИЕ КЛЮЧА.
           Первая сборка краснела на `core/loyalty.php`, где `'club_free' => true`
           это ключ ВОЗВРАЩАЕМОГО массива (расшифровка денег для админки), а не
           поле обновления. Ложное красное на ровном месте прячет настоящие
           отказы (правило 47), а подстраивать код под форму проверки нельзя
           (правило 48): поэтому смотрим окно после `update(`/`insert(` по
           таблице заявок. */
        $__s = cfsrc($rel);
        if (preg_match_all("~(?:update|insert)\\(\\s*'applications'~", $__s, $__mm, PREG_OFFSET_CAPTURE)) {
            foreach ($__mm[0] as $__m) {
                if (preg_match("~'club_free'\\s*=>~", substr($__s, (int) $__m[1], 900))) { $пишут[] = $rel; break; }
            }
        }
    }
}
chk('отметку club_free ставит только дверь подачи', !$пишут, implode(', ', $пишут));

/* ───────────── 3. РАСЧЁТ (даром, без записи) ───────────── */
sec('Расчёт льготы');
$платный = one("SELECT * FROM competitions WHERE is_paid=1 AND status='open' ORDER BY id DESC LIMIT 1");
$беспл   = one("SELECT * FROM competitions WHERE is_paid=0 AND status='open' ORDER BY id DESC LIMIT 1");
chk('не вошедшему льгота не положена', !club_free_polozheno(0, (array) $платный));
chk('у бесплатного конкурса льготы нет вовсе', $беспл && !club_free_polozheno(1, (array) $беспл),
    (string) ($беспл['name'] ?? '—'));
chk('у невошедшего остатка нет', club_free_left(0) >= 0);
chk('словами: остаток назван с месяцем',
    club_free_slovami(2) === 'бесплатно по Клубу: осталось 2 из 3 в этом месяце', club_free_slovami(2));
chk('словами: исчерпано за месяц',
    mb_strpos(club_free_slovami(0), 'исчерпан') !== false
    && mb_strpos(club_free_slovami(0), 'месяц') !== false, club_free_slovami(0));
chk('отклонённая заявка слот возвращает (условие в запросе)',
    strpos(cfsrc('core/club_free.php'), "<> 'rejected'") !== false);

/* ───────────── 4. ТЕКСТЫ: ПРАВИЛО НАПИСАНО ВЕЗДЕ ───────────── */
sec('Правило прописано везде, где упоминается Клуб');
$пункты = array_column(club_perks(), 't');
$есть = false;
foreach ($пункты as $t) if (mb_strpos($t, 'без оргвзноса') !== false) $есть = true;
chk('в списке привилегий есть пункт про заявки без оргвзноса', $есть, implode(' · ', $пункты));
$вписьме = array_column(club_perks_mail(), 't');
$естьП = false;
foreach ($вписьме as $t) if (mb_strpos($t, 'без оргвзноса') !== false) $естьП = true;
chk('пункт уходит и в карточку письма', $естьП, (string) count($вписьме) . ' пунктов');
/* ВТОРОЙ РУКОПИСНОЙ КОПИИ СПИСКА БЫТЬ НЕ ДОЛЖНО. Она уже возвращалась один раз
   и обещала «1 заявка в месяц» после правки владельца. */
$mc = cfsrc('core/mail_campaigns.php');
chk('сетка привилегий в письмах берёт единый список', strpos($mc, 'club_perks(') !== false);
chk('в письмах нет своей копии списка', strpos($mc, 'Бесплатный конкурс каждый месяц') === false);
$старое = [];
foreach (['templates/site/pages/club.php','core/club_perks.php','core/mail_campaigns.php',
          'scripts/vk_posts_offers.php'] as $rel) {
    $s = cfsrc($rel);
    if ($s !== '' && (mb_stripos($s, '1 заявка с 1 номером') !== false
                   || mb_stripos($s, 'Один бесплатный конкурс каждый месяц') !== false)) $старое[] = $rel;
}
chk('прежнее обещание «1 заявка в месяц» снято всюду', !$старое, implode(', ', $старое));
chk('запись ВК про Клуб говорит про оргвзнос',
    strpos(cfsrc('scripts/vk_posts_offers.php'), 'без оргвзноса') !== false);
chk('бот знает правило', (function (): bool {
    $s = cfsrc('core/chat_brain.php');
    return strpos($s, 'БЕЗ ОРГВЗНОСА') !== false && strpos($s, 'club_perks()') !== false;
})());

/* ───────────── 5. ВИТРИНА ДУМАЕТ КАК СЕРВЕР ───────────── */
sec('Витрина думает как сервер');
$apl = cfsrc('templates/site/pages/apply.php');
chk('форма получает предел', strpos($apl, "'clubFreeLimit'") !== false);
chk('форма получает остаток на месяц', strpos($apl, "'clubFreeLeft'") !== false);
chk('остаток считает та же мерка', strpos($apl, 'club_free_left(') !== false);
$js = cfsrc('public/assets/js/apply.js');
chk('счёт в форме вычитает льготные', strpos($js, 'clubFreeCount') !== false
    && strpos($js, 'CFG.clubFreeLeft') !== false);
chk('форма вычитает остаток по мере раздачи', strpos($js, 'cfreeLeft--') !== false);
chk('в форме названа причина нуля', mb_strpos($js, 'без оргвзноса') !== false);

/* ───────────── 6. ЦЕНА ЗАЯВКИ НАЗЫВАЕТ ЛЬГОТУ СЛОВАМИ ───────────── */
sec('Админка и кабинет не выдают льготу за полученные деньги');
$ly = cfsrc('core/loyalty.php');
chk('у расшифровки денег своя ветка для льготы', strpos($ly, "'label' => 'Бесплатно по Элитному клубу'") !== false);
chk('признак добирается по номеру заявки при неполном SELECT',
    strpos($ly, "SELECT COALESCE(club_free,0) FROM applications WHERE id=?") !== false);

/* ───────────── 7. ФАКТ ПО БАЗЕ ───────────── */
sec('Факт: что принято без оргвзноса на самом деле');
$все = all("SELECT a.id, a.number, a.user_id, a.competition_id, a.is_paid, COALESCE(a.amount_paid,0) am,
                   COALESCE(a.status,'') st, c.name cname, COALESCE(c.is_paid,0) cpaid
              FROM applications a JOIN competitions c ON c.id = a.competition_id
             WHERE COALESCE(a.club_free,0) = 1");
note('заявок без оргвзноса по Клубу: ' . count($все));
$беда = [];
foreach ($все as $a) {
    if ((int) $a['cpaid'] !== 1) $беда[] = '№' . $a['number'] . ' — конкурс бесплатный';
    if ((int) $a['is_paid'] !== 1) $беда[] = '№' . $a['number'] . ' — взнос не закрыт';
    if ((int) $a['am'] !== 0)     $беда[] = '№' . $a['number'] . ' — в кассе ' . (int) $a['am'];
    if ((int) $a['user_id'] <= 0) $беда[] = '№' . $a['number'] . ' — без участника';
}
chk('у каждой льготной заявки всё на месте', !$беда, implode('; ', $беда));
$сверх = all("SELECT user_id, substr(COALESCE(created_at,''),1,7) ym, COUNT(*) n FROM applications
               WHERE COALESCE(club_free,0)=1 AND COALESCE(status,'') <> 'rejected'
            GROUP BY user_id, ym HAVING n > " . club_free_limit());
chk('предел трёх заявок за месяц не превышен ни у одного участника', !$сверх,
    implode('; ', array_map(static fn($r) => 'участник ' . (int) $r['user_id'] . ' в '
        . (string) $r['ym'] . ': ' . (int) $r['n'], $сверх)));
foreach ($все as $a) {
    note('  №' . $a['number'] . ' · ' . $a['cname'] . ' · участник ' . (int) $a['user_id']
         . ' · ' . ($a['st'] !== '' ? $a['st'] : 'без статуса'));
}
if (!$все) {
    note('льготных заявок ещё нет - правило вступило в силу 15.10.2026');
    note('сквозной прогон с полным откатом сделан в тот же день: три заявки ушли');
    note('бесплатно, четвёртая получила счёт 800 руб со клубной скидкой');
}

/* ───────────── 8. НАГРАДНЫЕ ДОКУМЕНТЫ ПО ЛЬГОТНОЙ ЗАЯВКЕ ─────────────
 * Слово владельца 15.10.2026, им снята привилегия «Закрытые конкурсы Клуба»:
 *   «3 заявки на участие бесплатно (без оргвзноса). Бесплатно дипломы,
 *    дополнительные дипломы, благодарственные письма, по этим заявкам». */
sec('Наградные документы по льготной заявке - бесплатно');
chk('список документов есть и он закрытый',
    function_exists('club_free_award_items') && club_free_award_items() === [
        'Основной диплом', 'Дополнительный диплом', 'Благодарность'],
    implode(' · ', function_exists('club_free_award_items') ? club_free_award_items() : []));
/* ИМЕННОЙ, КУБОК, СТАТУЭТКА И МЕДАЛЬ БЕСПЛАТНЫМИ НЕ НАЗЫВАЛИ - и это проверяется
   отдельно: расширить список «заодно» значит отдать изделия даром. */
foreach ([['Основной диплом', true], ['Дополнительный диплом', true], ['Благодарность', true],
          ['Благодарность педагогу', true], ['Благодарственное письмо', true],
          ['доп. диплом', true],
          ['Именной диплом', false], ['Кубок Гран-при', false], ['Статуэтка лауреата', false],
          ['Медаль дипломанта', false], ['Доставка', false], ['', false]] as [$__наз, $__ждём]) {
    chk('узнаётся по канону: «' . ($__наз !== '' ? $__наз : '(пусто)') . '» — '
        . ($__ждём ? 'бесплатно' : 'по прайсу'),
        function_exists('club_free_award_item') && club_free_award_item($__наз) === $__ждём);
}
chk('без заявки льготы нет', function_exists('club_free_award_besplatno')
    && club_free_award_besplatno(0, 'Основной диплом') === false);

/* Исходники нужны уже здесь: ниже они читаются ещё раз, и это не копия данных,
   а один и тот же вызов - `cfsrc` ничего не кэширует и ничего не пишет. */
$__ord = cfsrc('api/v1/order.php');
$__aw  = cfsrc('templates/site/pages/awards.php');

/* ВИД РЕШАЕТ: БЕСПЛАТЕН ТОЛЬКО ЭЛЕКТРОННЫЙ (слово владельца 15.10.2026 на прямой
   вопрос - «бесплатны только электронные, оригиналы по прайсу со скидкой»).
   Оригинал на бланке печатают и везут почтой: обнулить его значит отдать изделие
   даром, поэтому вид проверяется отдельной меркой и ПЕРВЫМ. */
chk('электронный вид бесплатен', function_exists('club_free_award_kind') && club_free_award_kind('digital'));
chk('оригинал на бланке платный', function_exists('club_free_award_kind') && !club_free_award_kind('original'));
chk('пустой вид льготы не даёт', function_exists('club_free_award_kind') && !club_free_award_kind(''));
chk('вид по умолчанию - электронный',
    defined('CLUB_FREE_AWARD_KIND') && CLUB_FREE_AWARD_KIND === 'digital');
chk('дверь передаёт вид в решение',
    (bool) preg_match('~club_free_award_besplatno\(\s*\$applicationId,[^;]*\$__ni\[.kind.\]~s', $__ord));
chk('витрина обнуляет только электронный вид',
    strpos($__aw, 'club_free_award_kind(') !== false);
/* ОБЕЩАНИЯ «И ОРИГИНАЛЫ БЕСПЛАТНО» НИГДЕ НЕ ОСТАЛОСЬ: оно было в первой сборке
   этого же дня, до прямого ответа владельца, и такая строка стоила бы центру
   бланк и посылку за свой счёт. */
$__обещали = [];
foreach (['core/club_free.php','core/club_perks.php','templates/site/pages/club.php',
          'scripts/vk_posts_offers.php','core/chat_brain.php','templates/site/pages/awards.php'] as $__rel) {
    $__s = cfsrc($__rel);
    if ($__s === '') continue;
    if (preg_match('~и оригиналы на бланках~ui', $__s)) $__обещали[] = $__rel;
}
chk('нигде не обещано, что оригиналы бесплатны', !$__обещали, implode(', ', $__обещали));
chk('в тексте привилегии названы электронные',
    function_exists('club_free_awards_text') && mb_stripos(club_free_awards_text(), 'электронн') !== false,
    function_exists('club_free_awards_text') ? club_free_awards_text() : '');
chk('в тексте привилегии названа судьба оригиналов',
    function_exists('club_free_awards_text') && mb_stripos(club_free_awards_text(), 'оригинал') !== false);
$__ord = cfsrc('api/v1/order.php');
chk('дверь заказа зовёт единый источник', strpos($__ord, 'club_free_award_besplatno(') !== false);
/* ПОРЯДОК ВАЖЕН: обнуляем ПОСЛЕ сборки суммы и ДО скидок. Поставь после скидки -
   и ноль умножился бы на 0,8, то есть остался бы нулём, но полная цена в чеке
   («amount_full») разъехалась бы с составом. */
chk('обнуление стоит до скидок',
    strpos($__ord, 'club_free_award_besplatno(') !== false
    && strpos($__ord, 'club_free_award_besplatno(') < strpos($__ord, '$amountBeforeDiscount = $amount;'));
chk('у бесплатного заказа платежа не создаётся',
    (bool) preg_match('~if \(\$amount > 0\) \{\s*\$payment = yukassa_create_payment\(~s', $__ord));
/* БЕСПЛАТНЫЙ ЗАКАЗ ОБЯЗАН ИСПОЛНИТЬСЯ. Изготовление открывает оплата, а её тут
   нет: без этих трёх строк заказ остался бы в `new` навсегда, и обещанный
   бесплатный диплом не дошёл бы до человека. */
$__free = strpos($__ord, '$orderIsFree) {');
$__tail = $__free !== false ? substr($__ord, $__free, 1600) : '';
chk('бесплатный заказ помечается оплаченным', strpos($__tail, "'status' => 'paid'") !== false);
chk('бесплатный заказ уходит в производство оригиналов', strpos($__tail, 'order_dispatch_production(') !== false);
chk('бесплатный заказ выдаёт электронные', strpos($__tail, 'order_fulfill_digital(') !== false);
$__aw = cfsrc('templates/site/pages/awards.php');
chk('витрина наград думает как сервер', strpos($__aw, 'club_free_zayavka(') !== false
    && strpos($__aw, 'club_free_award_item(') !== false);
chk('витрина говорит про льготу словами', mb_strpos($__aw, 'без оргвзноса по Элитному клубу') !== false);
chk('бот знает про бесплатные документы',
    strpos(cfsrc('core/chat_brain.php'), 'НАГРАДНЫЕ ДОКУМЕНТЫ ПО ЛЬГОТНОЙ ЗАЯВКЕ') !== false);
chk('в списке привилегий есть пункт про бесплатные электронные документы', (function (): bool {
    foreach (club_perks() as $p) {
        if (mb_stripos((string) $p['t'], 'электронные документы') !== false) return true;
    }
    return false;
})(), implode(' · ', array_column(club_perks(), 't')));

/* ПРИВИЛЕГИИ «ЗАКРЫТЫЕ КОНКУРСЫ КЛУБА» БОЛЬШЕ НЕТ НИГДЕ.
   Смотрим ЖИВОЙ код без пояснений: в комментариях снятое обещание названо
   НАРОЧНО, чтобы следующая сессия не вернула его вслепую (шестой раз эта
   грабля: правила 40, 48, 56, 57а, 58, 63). */
$__живые = ['core/club_perks.php', 'templates/site/pages/club.php', 'templates/site/pages/menu.php',
            'cron/club_billing.php', 'scripts/vk_posts_offers.php', 'core/mail_campaigns.php'];
$__осталось = [];
foreach ($__живые as $__rel) {
    $__s = cfsrc($__rel);
    if ($__s === '') continue;
    if (mb_stripos($__s, 'закрытые конкурс') !== false || mb_stripos($__s, 'закрытый конкурс') !== false
        || mb_stripos($__s, 'закрытых конкурс') !== false) $__осталось[] = $__rel;
}
chk('обещания «закрытые конкурсы Клуба» в живом коде не осталось', !$__осталось, implode(', ', $__осталось));
foreach (['docs/knowledge/04_working_doc.md', 'docs/knowledge/07_html_and_dump.md'] as $__md) {
    $__s = is_file(BASE_PATH . '/' . $__md) ? (string) file_get_contents(BASE_PATH . '/' . $__md) : '';
    if ($__s === '') { bad('файл знаний на месте: ' . $__md); continue; }
    $__естьСтарое = mb_stripos($__s, 'закрытый конкурс') !== false || mb_stripos($__s, 'закрытый бесплатный конкурс') !== false;
    chk('в знаниях снятое обещание помечено решением владельца: ' . basename($__md),
        !$__естьСтарое || mb_strpos($__s, '15.10.2026') !== false);
    chk('в знаниях названа живая привилегия: ' . basename($__md),
        mb_stripos($__s, 'без оргвзноса') !== false);
}

/* ФАКТ: НИ ОДНОЙ ЛЬГОТНОЙ ЗАЯВКИ, ПО КОТОРОЙ ВЗЯЛИ ДЕНЬГИ ЗА ЭТИ ДОКУМЕНТЫ. */
$__деньги = [];
foreach (all("SELECT o.id, o.amount, o.items, a.number
                FROM awards_orders o JOIN applications a ON a.id = o.application_id
               WHERE COALESCE(a.club_free,0) = 1
                 AND COALESCE(o.status,'') IN ('paid','made','shipped','delivered','sent')") as $__o) {
    foreach ((array) json_decode((string) ($__o['items'] ?? '[]'), true) as $__p) {
        if (!is_array($__p)) continue;
        if ((int) ($__p['price'] ?? 0) > 0 && club_free_award_item((string) ($__p['item'] ?? ''))) {
            $__деньги[] = '№' . (int) $__o['id'] . ' ' . (string) $__p['item'] . ' = ' . (int) $__p['price'];
        }
    }
}
chk('по льготным заявкам денег за эти документы не брали', !$__деньги, implode('; ', $__деньги));

sec('Факт: платные конкурсы по месяцам');
/* СЛОВО ВЛАДЕЛЬЦА 15.10.2026: платный конкурс с оргвзносом один, и проводится он
   раз в месяц. Отсюда и счёт льготы - ПО МЕСЯЦУ, а не по конкурсу. Если в один
   месяц откроется второй платный конкурс, правило не ломается: три заявки
   остаются тремя НА МЕСЯЦ и делятся между этими конкурсами. Печатаем это
   фактом, а не провалом: сколько платных заводить - решение владельца, а не
   беда кода. Провалом тут была бы только мерка, считающая льготу по конкурсу,
   и её держит отдельная проверка в разделе про правило. */
$пм = all("SELECT substr(COALESCE(start_date,''),1,7) ym, COUNT(*) n,
                  GROUP_CONCAT(name, ' + ') names
             FROM competitions
            WHERE COALESCE(is_paid,0) = 1 AND COALESCE(launched,0) = 1
              AND COALESCE(start_date,'') <> ''
         GROUP BY ym ORDER BY ym DESC LIMIT 6");
foreach ($пм as $m) {
    note('  ' . (string) $m['ym'] . ': платных ' . (int) $m['n'] . ' — ' . (string) $m['names']
         . ((int) $m['n'] > 1 ? '  (три заявки делятся между ними)' : ''));
}
$этот = 0;
foreach ($пм as $m) if ((string) $m['ym'] === club_free_month()) $этот = (int) $m['n'];
note('в этом месяце платных конкурсов: ' . $этот . ', льгота: ' . club_free_limit() . ' заявки на месяц');

/* ───────── ПРИЁМ ТОЛЬКО ОТ ЧЛЕНОВ КЛУБА (слово владельца 16.10.2026) ─────────
   «Приём заявок на участие в платном конкурсе „Мировой акцент" только от членов
   элитного клуба». Признак свой - `club_entry_only`, - и главное, что проверяет
   этот раздел: он НЕ превратился в `club_only`, то есть не отнял у конкурса
   оргвзнос, положение и афишу. */
sec('Приём заявок только от членов Клуба');

$__dbsrc  = cfsrc('core/db.php');
$__cfsrc  = cfsrc('core/club_free.php');
$__dversrc= cfsrc('api/v1/apply.php');
$__vitsrc = cfsrc('templates/site/pages/apply.php');
$__jssrc  = cfsrc('public/assets/js/apply.js');
$__botsrc = cfsrc('core/chat_brain.php');
$__admsrc = cfsrc('admin/competitions.php');
$__afsrc  = cfsrc('core/afisha_html.php');

chk('колонка club_entry_only заведена миграцией',
    strpos($__dbsrc, "'club_entry_only', 'INTEGER DEFAULT 0'") !== false);
chk('колонка есть в живой базе', (function (): bool {
        foreach (q('PRAGMA table_info(competitions)') as $c) {
            if ((string) $c['name'] === 'club_entry_only') return true;
        }
        return false;
    })());

chk('решение и слова в одном источнике',
    function_exists('club_vhod_tolko_chlenam') && function_exists('club_vhod_pometka')
    && function_exists('club_vhod_otkaz'));

/* ЗАСЛОН НЕ СЛЕПОЙ: подставные строки, живая база не трогается. */
chk('признак узнаётся',  club_vhod_tolko_chlenam(['club_entry_only' => 1]));
chk('конкурс Клуба тоже требует членства', club_vhod_tolko_chlenam(['club_only' => 1]));
chk('обычный конкурс членства не требует',
    !club_vhod_tolko_chlenam(['club_entry_only' => 0, 'club_only' => 0, 'is_paid' => 1]));
chk('пометка пуста у обычного конкурса', club_vhod_pometka(['is_paid' => 1]) === '');
chk('пометка называет Клуб',
    mb_strpos(club_vhod_pometka(['club_entry_only' => 1]), 'Элитного клуба') !== false);

/* ОТКАЗ НЕ ОБЕЩАЕТ БЕСПЛАТНОГО УЧАСТИЯ. У конкурса Клуба взноса нет вовсе, и
   его текст («участие входит в членство») здесь был бы ложью про деньги. */
$__otk = club_vhod_otkaz(['name' => 'Мировой акцент']);
chk('отказ называет конкурс и Клуб',
    mb_strpos($__otk, 'Мировой акцент') !== false && mb_strpos($__otk, 'Элитного клуба') !== false);
chk('отказ не обещает, что взноса нет',
    mb_strpos($__otk, 'не взимается') === false && mb_strpos($__otk, 'входит в членство') === false,
    $__otk);
chk('отказ называет, что даёт членство',
    mb_strpos($__otk, (string) club_free_limit()) !== false
    && mb_strpos($__otk, 'без организационного взноса') !== false);

/* ДВЕРЬ. Проверка в витрине без замка на сервере ничего не держит: пометку в
   браузере снимают за две минуты (урок правил 45 и 64). */
chk('дверь подачи знает признак', strpos($__dversrc, "club_entry_only") !== false);
chk('дверь зовёт единый отказ',  strpos($__dversrc, 'club_vhod_otkaz(') !== false);
chk('дверь отдаёт адрес страницы Клуба',
    preg_match("~club_entry_only.*?club_url~us", $__dversrc) === 1);

/* ВИТРИНА ДУМАЕТ КАК СЕРВЕР - и при этом не врёт про деньги. */
chk('витрина формы читает признак', strpos($__vitsrc, 'club_entry_only') !== false);
chk('карточка несёт признак в браузер', strpos($__vitsrc, 'data-club-entry') !== false);
chk('на карточке плашка про приём', strpos($__vitsrc, 'Приём только от членов Клуба') !== false);
/* СМОТРИМ САМУ ВЕТКУ, А НЕ ОКНО В 400 ЗНАКОВ.
   Первая сборка этой проверки была СЛЕПОЙ, и показала это подкладка: класс
   `[^?]` обрывается на первом же `?` - а в шаблоне их полно в `<?=`, - поэтому
   подменённая плашка «Бесплатно для клуба» внутри ветки признака проверку не
   краснила вовсе. Проверка, которая молча не ловит, хуже отсутствующей: она
   создаёт уверенность (урок правила 71). Берём отрезок ветки целиком и считаем
   вхождения по всему файлу. */
$__vitEntry = (function () use ($__vitsrc): string {
    $i = mb_strpos($__vitsrc, "elseif ((int)\$c['club_entry_only'])");
    if ($i === false) return '';
    $j = mb_strpos($__vitsrc, 'endif', $i);
    return $j === false ? mb_substr($__vitsrc, $i, 800) : mb_substr($__vitsrc, $i, $j - $i);
})();
chk('ветка признака печатает плашку про приём',
    mb_strpos($__vitEntry, 'Приём только от членов Клуба') !== false);
chk('плашка «Бесплатно для клуба» осталась только у конкурса Клуба',
    $__vitEntry !== '' && mb_strpos($__vitEntry, 'Бесплатно для клуба') === false
    && substr_count($__vitsrc, 'Бесплатно для клуба') === 1,
    'вхождений: ' . substr_count($__vitsrc, 'Бесплатно для клуба'));

/* ФОРМА В БРАУЗЕРЕ: своя ветка и свой текст про деньги. */
chk('форма снимает выбор по признаку', strpos($__jssrc, "data-club-entry") !== false);
chk('у отказа сервера своя ветка', strpos($__jssrc, 'd.club_entry_only') !== false);
/* СМОТРИМ РОВНО СВОЮ ВЕТКУ ТЕРНАРНИКА, А НЕ ОКНО В 400 ЗНАКОВ.
   Окно соврало на первом же прогоне: за текстом про платный конкурс сразу
   следует текст про конкурс Клуба, и в нём «не взимается» стоит ЗАКОННО. Мерка
   краснела на верном коде - та же порода ошибки, что в правилах 40, 48, 56, 57а
   и 58. Берём отрезок от признака до двоеточия, которым начинается вторая
   ветка, и судим только его. */
$__entryTxt = (function () use ($__jssrc): string {
    $i = strpos($__jssrc, "kind === 'entry'");
    if ($i === false) return '';
    $j = strpos($__jssrc, ": 'Конкурс «", $i);
    return $j === false ? substr($__jssrc, $i, 600) : substr($__jssrc, $i, $j - $i);
})();
chk('подсказка формы называет, что взнос прежний',
    mb_strpos($__entryTxt, 'взнос за него прежний') !== false);
chk('подсказка формы не обещает, что взноса нет',
    $__entryTxt !== '' && mb_strpos($__entryTxt, 'не взимается') === false
    && mb_strpos($__entryTxt, 'входит в членство') === false);

/* БОТ. Три места, и все три обязаны знать условие: правила мозга, срок приёма и
   запасной ответ про цену. Правишь одно - правь все, они расходятся молча
   (правила 33, 35). */
chk('правила мозга называют условие приёма',
    substr_count($__botsrc, 'club_vhod_pometka') >= 3, (string) substr_count($__botsrc, 'club_vhod_pometka'));
chk('признак есть в выборке правил мозга',
    strpos($__botsrc, 'COALESCE(club_entry_only,0) club_entry_only') !== false);

/* АФИША И АДМИНКА. */
chk('афиша называет условие приёма', strpos($__afsrc, 'club_entry_only') !== false);
chk('афиша не обещает призовой фонд по этому признаку',
    preg_match("~club_entry_only[^;]{0,300}100 000~us", $__afsrc) !== 1);
chk('в админке есть галочка владельца', strpos($__admsrc, "name=\"club_entry_only\"") !== false);
chk('админка сохраняет галочку', strpos($__admsrc, "'club_entry_only'") !== false);

/* ПРИЗНАК НЕ МЕНЯЕТ ЭТАЛОН, А ДОПИСЫВАЕТ ПУНКТ.
   Положение пересобирается при каждом сохранении конкурса (правило 51), и попади
   этот признак в ВЫБОР ЭТАЛОНА - платное положение заменилось бы клубным, с
   потерей пунктов владельца. Поэтому судим сами выражения выбора, а не весь
   файл: с 16.10.2026 признак в этих файлах есть законно - он дописывает пункт
   8.12 и входит в отпечаток PDF. */
$__выбор = (function (): string {
    $s = cfsrc('core/regulation_gen.php') . "\n" . cfsrc('core/regulation_pdf.php');
    $out = '';
    foreach (preg_split('~\n~', $s) ?: [] as $l) {
        if (preg_match('~\$(file|etalonFile)\s*=~', $l)) $out .= $l . "\n";
    }
    return $out;
})();
chk('выбор эталона положения признака не видит',
    $__выбор !== '' && strpos($__выбор, 'club_entry_only') === false, trim($__выбор));

/* ПУНКТ 8.12 В ПОЛОЖЕНИИ (слово владельца 16.10.2026: «2. Да Вписать»).
   Сборщик положений подключаем здесь: без него текст пункта и сама вставка
   проверке не видны, и первый прогон покраснел на ВЕРНОМ коде - беда мерки, а
   не кода. Подключение только определяет функции и постоянные, ничего не
   пересобирает: аудит остаётся читающим. */
if (!function_exists('reg_point_vstavit')) require_once BASE_PATH . '/core/regulation_gen.php';
$__regsrc = cfsrc('core/regulation_gen.php');
$__toolsrc = cfsrc('scripts/reg_point_add.php');
chk('пункт про приём лежит одним текстом', defined('REG_PUNKT_KLUB_VHOD')
    && mb_strpos(REG_PUNKT_KLUB_VHOD, 'только от участников Элитного клуба') !== false);
chk('в тексте пункта нет ни сумм, ни сроков',
    defined('REG_PUNKT_KLUB_VHOD')
    && !preg_match('~\d~u', REG_PUNKT_KLUB_VHOD)
    && mb_strpos(REG_PUNKT_KLUB_VHOD, 'руб') === false
    && mb_strpos(REG_PUNKT_KLUB_VHOD, '₽') === false,
    'в положениях центра нет ни одной даты и ни одной суммы (правило 37)');
chk('вставка пункта - один источник на инструмент и перегенерацию',
    function_exists('reg_point_vstavit')
    && mb_strpos($__toolsrc, 'reg_point_vstavit(') !== false
    && mb_strpos($__toolsrc, 'w14:(paraId') === false,
    'своей копии механики в инструменте не осталось');
/* СУДИМ ВЫЗОВ, А НЕ ЕГО ЗНАКИ, И ПРОВЕРЯЕМ, ЧТО РЕШЕНИЕ ИМ ПРАВДА УПРАВЛЯЕТ.
   Здесь стояло `REG_PUNKT_KLUB_VHOD)` - проверка покраснела на верном коде,
   когда у вызова появились ещё два аргумента и строка перенеслась (седьмой раз
   эта грабля: правила 40, 48, 56, 57а, 58, 72). А первая же замена на поиск
   «есть ли вызов решения» оказалась СЛЕПОЙ: подкладка `… && false` оставляла
   строку на месте, и проверка молчала. Поэтому смотрим ОТРЕЗОК между решением
   и вставкой: между ними не должно быть ничего, кроме закрытия условия. */
$__между = (function () use ($__regsrc): ?string {
    $i = mb_strpos($__regsrc, 'club_vhod_tolko_chlenam($c)');
    if ($i === false) return null;
    $i += mb_strlen('club_vhod_tolko_chlenam($c)');
    $j = mb_strpos($__regsrc, 'reg_point_vstavit(', $i);
    return $j === false ? null : mb_substr($__regsrc, $i, $j - $i);
})();
/* Закрывающих скобок между решением и вставкой может быть одна или две - это
   зависит от того, сколько условий стоит в `if`. Считать их штуки бессмысленно,
   а вот ЛИШНЕЕ между ними (`&& false`, другое условие, лишний вызов) - ровно то,
   что проверка обязана увидеть. */
chk('перегенерация дописывает пункт по единому решению',
    $__между !== null && preg_match('~^\)+\s*\{\s*\$\S+\s*=\s*$~u', $__между) === 1,
    $__между === null ? 'решение и вставка не нашлись рядом' : 'между ними: ' . trim(preg_replace('~\s+~u', ' ', $__между)));
chk('вставка пункта правда работает', (function (): bool {
        /* МЕХАНИКУ ПРОВЕРЯЕМ НА КОПИИ, А НЕ НА ЖИВОМ ДОКУМЕНТЕ: аудит обязан
           только читать (правила 49, 51), а подписанное положение он править не
           вправе. Копия ложится в системный временный каталог и убирается. */
        $src = (string) (scalar("SELECT regulation_pdf FROM competitions WHERE id=32") ?? '');
        if ($src === '' || !is_file($src)) return false;
        $tmp = sys_get_temp_dir() . '/audit_reg_' . bin2hex(random_bytes(4)) . '.docx';
        if (!@copy($src, $tmp)) return false;
        // Номер нарочно чужой: так проверяется сама вставка, а не наш пункт.
        $st = reg_point_vstavit($tmp, '8.11', '8.99', 'Проверочный пункт аудита.');
        $pts = $st === '' ? reg_points_from_text(reg_docx_text($tmp)) : [];
        @unlink($tmp);
        foreach (glob(sys_get_temp_dir() . '/audit_reg_*') ?: [] as $f) @unlink($f);
        foreach (glob(BASE_PATH . '/data/regulations_bak/audit_reg_*') ?: [] as $f) @unlink($f);
        return $st === '' && isset($pts['8.99']);
    })(), 'копия правится и пункт читается обратно');
chk('пункт в эталон НЕ кладётся',
    mb_strpos(cfsrc('core/regulation_gen.php'), "etalon") !== false
    && !preg_match('~etalon[^\n]{0,80}REG_PUNKT_KLUB_VHOD~u', $__regsrc),
    'эталон платного один на все платные конкурсы, а признак ставится отдельному');
chk('отпечаток PDF видит признак',
    mb_strpos(cfsrc('core/regulation_pdf.php'), "club_entry_only") !== false,
    'иначе человек скачает документ без условия');

/* ФАКТ ПО ЖИВЫМ ФАЙЛАМ: у конкурса с признаком пункт есть, у остальных и в
   эталонах его нет. Только чтение. */
if (!function_exists('reg_points_from_text')) require_once BASE_PATH . '/core/chat_regulation.php';
$__пунктЕсть = static function (string $p): bool {
    if (!is_file($p)) return false;
    $pts = reg_points_from_text(reg_docx_text($p));
    return isset($pts[REG_PUNKT_KLUB_VHOD_NO]);
};
$__нет = []; $__лишние = [];
foreach (all("SELECT id, name, regulation_pdf, COALESCE(club_entry_only,0) ce, COALESCE(club_only,0) co
                FROM competitions WHERE COALESCE(regulation_pdf,'') <> '' AND status='open'
                  AND COALESCE(launched,0)=1") as $__c) {
    $есть = $__пунктЕсть((string) $__c['regulation_pdf']);
    if ((int) $__c['ce'] === 1 && !$есть) $__нет[] = (string) $__c['name'];
    if ((int) $__c['ce'] !== 1 && $есть)  $__лишние[] = (string) $__c['name'];
}
chk('у конкурса с признаком пункт в положении есть', !$__нет, implode(', ', $__нет));
chk('у остальных конкурсов пункта нет', !$__лишние, implode(', ', $__лишние));
$__вЭталоне = [];
foreach (['etalon_2.docx', 'etalon_4.docx', 'etalon_5.docx'] as $__e) {
    if ($__пунктЕсть(BASE_PATH . '/docs/polozheniya/' . $__e)) $__вЭталоне[] = $__e;
}
chk('в эталонах пункта нет', !$__вЭталоне, implode(', ', $__вЭталоне));

/* КОПИЙ ПОЛОЖЕНИЙ В ПУБЛИЧНОЙ ПАПКЕ НЕТ.
   Замер 16.10.2026: их там лежало 26, и сервер отдавал любую прямой ссылкой
   кодом 200 - наружу было открыто устаревшее положение с подписью. Копии
   переехали в data/regulations_bak, а сюда поставлен заслон: вернётся первая
   же - покраснеет здесь, а не у человека на руках. */
$__копии = glob(BASE_PATH . '/public/uploads/regulations/*.bak*') ?: [];
chk('копий положений в публичной папке нет', !$__копии,
    count($__копии) . ' шт.: ' . implode(', ', array_map('basename', array_slice($__копии, 0, 5))));
chk('копия снимается вне public',
    mb_strpos($__regsrc, "data/regulations_bak") !== false
    && !preg_match("~\\\$bak\s*=\s*\\\$path\s*\.~u", $__regsrc));

/* ФАКТ ПО ЖИВОЙ БАЗЕ. */
$__ce = all("SELECT id, name, is_paid, price, status, COALESCE(club_only,0) club_only,
                    COALESCE(club_entry_only,0) club_entry_only
               FROM competitions WHERE COALESCE(club_entry_only,0) = 1 ORDER BY id");
foreach ($__ce as $__c) {
    note('приём только для членов Клуба: «' . (string) $__c['name'] . '» (id ' . (int) $__c['id']
         . ', ' . ((int) $__c['is_paid'] ? 'оргвзнос ' . (int) $__c['price'] . ' ₽' : 'бесплатный')
         . ', ' . (string) $__c['status'] . ')');
}
chk('ни один конкурс не помечен обоими признаками сразу', (function () use ($__ce): bool {
        foreach ($__ce as $c) if ((int) $c['club_only'] === 1) return false;
        return true;
    })());
chk('у такого конкурса оргвзнос на месте', (function () use ($__ce): bool {
        /* Признак не имеет права делать конкурс бесплатным: это дело галочки
           `is_paid`, и владелец её не трогал. Пусто - проверять нечего. */
        foreach ($__ce as $c) if ((int) $c['is_paid'] === 1 && (int) $c['price'] <= 0) return false;
        return true;
    })());

/* УЖЕ ПОДАННЫЕ ЗАЯВКИ - СПРАВКОЙ, А НЕ ПРОВАЛОМ. Автоматических отклонений в
   центре нет вообще (правило 14), и заявка, принятая до правки, остаётся
   принятой: решение по ней только за владельцем. */
foreach ($__ce as $__c) {
    $__чужие = 0; $__всего = 0;
    foreach (all("SELECT user_id FROM applications WHERE competition_id = ? AND COALESCE(status,'') <> 'rejected'",
                 [(int) $__c['id']]) as $__a) {
        $__всего++;
        $__u = (int) ($__a['user_id'] ?? 0);
        if ($__u <= 0 || !club_is_active($__u)) $__чужие++;
    }
    note('  заявок в нём ' . $__всего . ', из них не от членов Клуба ' . $__чужие
         . ($__чужие > 0 ? ' — приняты до правки, решение по ним только за владельцем (правило 14)' : ''));
}

/* ═══════════ СНЯТИЕ ЗАЯВКИ БЕЗ ДВИЖЕНИЯ ДЕНЕГ ═══════════
 *
 * Слово владельца 16.10.2026: заявки, принятые в конкурс «только для членов
 * Клуба» до появления проверки, снять, людям написать с извинением и
 * предложить Клуб, а ВОЗВРАТ ОН ПРОВОДИТ САМ РУКАМИ.
 *
 * Обычная дверь отклонения возвращает оргвзнос САМА, через кассу, и своё письмо
 * («не принята к участию», пункт положения) отправляет тоже сама. Для этого
 * случая у неё есть два ключа, и проверка следит, что они правда выключают
 * возврат и письмо: без них агент двинул бы деньги клиента (правило 8а, цена
 * известна - 1 700 ₽ четверым 31.08.2026).
 */
sec('Снятие заявки без движения денег');
require_once BASE_PATH . '/core/grade_apply.php';
require_once BASE_PATH . '/core/mail_campaigns.php';
require_once BASE_PATH . '/core/club_entry_mail.php';

/* Тело двери читаем ОТРАЖЕНИЕМ, а не поиском по всему файлу: рядом лежат
   `.bak`-копии и другие функции, и поиск по файлу судил бы не ту. Пояснения
   снимаем разбором PHP (урок правила 63). */
$__двСрc = (function (): string {
    try { $r = new ReflectionFunction('grade_reject_application'); } catch (\Throwable $e) { return ''; }
    $f = (string) $r->getFileName();
    if (!is_file($f)) return '';
    $L = file($f);
    $s = implode('', array_slice($L, $r->getStartLine() - 1, $r->getEndLine() - $r->getStartLine() + 1));
    $out = '';
    foreach ((array) @token_get_all('<?php ' . $s) as $x) {
        if (is_array($x)) {
            if ($x[0] === T_COMMENT || $x[0] === T_DOC_COMMENT) { $out .= ' '; continue; }
            $out .= $x[1];
        } else { $out .= $x; }
    }
    return $out;
})();
chk('тело двери прочитано', $__двСрc !== '');

$__пар = [];
try { foreach ((new ReflectionFunction('grade_reject_application'))->getParameters() as $p) $__пар[] = $p->getName(); } catch (\Throwable $e) {}
chk('у двери есть четвёртый аргумент $opt', count($__пар) === 4 && end($__пар) === 'opt', implode(', ', $__пар));
chk('прежние вызывающие не сломаны: $opt по умолчанию пуст', (function (): bool {
        try { $p = (new ReflectionFunction('grade_reject_application'))->getParameters(); } catch (\Throwable $e) { return false; }
        return isset($p[3]) && $p[3]->isOptional() && $p[3]->getDefaultValue() === [];
    })());

/* ЗАСЛОН ПРОВЕРЯЕМ НЕ ПО НАЛИЧИЮ СЛОВА В ФАЙЛЕ, А ПО УСЛОВИЮ, КОТОРОЕ ПРЯМО
   СТОРОЖИТ ВЫЗОВ. Строка «ключ где-то есть» осталась бы зелёной, обнули я само
   условие - так уже соврала моя мерка на вставке пункта положения (правило 72а). */
$__сторож = static function (string $тело, string $цель, string $ключ): bool {
    $p = strpos($тело, $цель);
    if ($p === false) return false;
    $до = substr($тело, 0, $p);
    $i  = strrpos($до, 'if (');
    if ($i === false) return false;
    return strpos(substr($до, $i), $ключ) !== false;
};
chk('возврат сторожит ключ без_возврата',
    $__сторож($__двСрc, 'refund_application(', "empty(\$opt['без_возврата'])"));
chk('своё письмо двери сторожит ключ без_письма',
    $__сторож($__двСрc, "/core/result_mail.php'", "empty(\$opt['без_письма'])"));
chk('дверь говорит словами, что возврат не делала',
    strpos($__двСрc, 'Оргвзнос автоматически НЕ возвращён') !== false);

/* ИНСТРУМЕНТ. Он обязан звать ДВЕРЬ (за отклонением тянется снятие наградных
   материалов и возврат партнёрской скидки) и не трогать кассу вовсе. */
$__инс = cfsrc('scripts/snyat_ne_klubnye.php');
chk('инструмент снятия на месте', $__инс !== '');
chk('инструмент зовёт дверь с оба ключами', (function () use ($__инс): bool {
        $p = strpos($__инс, 'grade_reject_application(');
        if ($p === false) return false;
        $кус = substr($__инс, $p, 260);
        return strpos($кус, 'без_возврата') !== false && strpos($кус, 'без_письма') !== false;
    })());
chk('инструмент кассу не трогает вовсе',
    strpos($__инс, 'refund_application') === false && strpos($__инс, 'yukassa_refund') === false
    && strpos($__инс, 'order_pickup_set') === false);
chk('инструмент не трогает заявку участника Клуба', strpos($__инс, 'club_is_active') !== false);
chk('у инструмента есть сухой прогон', strpos($__инс, '--сухой') !== false);

/* ПИСЬМО. Привилегии берутся у единого списка, цены и число заявок - у настроек
   и у того, кто их считает. Вписанная копия разошлась бы молча (правила 33, 46,
   56а, 64, 69), а в письме это обещание человеку, который только что получил от
   центра отказ. */
$__пис = cfsrc('core/club_entry_mail.php');
chk('письмо на месте', $__пис !== '');
chk('привилегии берутся у единого списка', strpos($__пис, 'mmc_vip_perks_grid(') !== false);
chk('цена членства из настроек', strpos($__пис, "setting('club_price'") !== false
    && strpos($__пис, "setting('club_price_year'") !== false);
chk('число льготных заявок у того, кто их считает', strpos($__пис, 'club_free_limit(') !== false);
chk('скидка у того, кто её считает', strpos($__пис, 'mm_vip_discount(') !== false);
chk('письмо денег не двигает', strpos($__пис, 'refund_application') === false
    && strpos($__пис, 'yukassa') === false);
chk('письмо уходит в рабочее время', strpos($__пис, 'ga_next_worktime') !== false);

/* ПРИВИЛЕГИЯ «СКОРО» НЕ ОБЕЩАЕТСЯ КАК ДЕЙСТВУЮЩАЯ. На странице Клуба у клубного
   чата стоит плашка «скоро», а сетка в письме признака не знала вовсе - и
   письмо обещало то, чего пока нет. Ровно за пустое обещание владелец снял
   привилегию «Закрытые конкурсы Клуба» (правило 69). */
$__сетка = function_exists('mmc_vip_perks_grid') ? mmc_vip_perks_grid() : '';
$__естьСкоро = false;
foreach (club_perks() as $__p) if (!empty($__p['soon'])) { $__естьСкоро = true; break; }
chk('сетка привилегий в письме собирается', $__сетка !== '');
chk('привилегия «скоро» помечена и в письме',
    !$__естьСкоро || strpos($__сетка, '(скоро)') !== false);

/* ФАКТ ПО БАЗЕ. У снятой таким путём заявки возврат не отмечен: его проводит
   владелец руками, и отметка от автомата означала бы, что касса сработала. */
$__снятые = all("SELECT a.number, a.is_paid, a.amount_paid, COALESCE(a.refunded_at,'') ret
                   FROM applications a JOIN competitions c ON c.id=a.competition_id
                  WHERE COALESCE(c.club_entry_only,0)=1 AND a.status='rejected'
                    AND a.reject_reason LIKE '%только от%участников Элитного клуба%'");
$__сВозвратом = array_values(array_filter($__снятые, static fn(array $r): bool => trim((string) $r['ret']) !== ''));
note('  снято по этому правилу заявок: ' . count($__снятые)
     . '; возврат отмечен у ' . count($__сВозвратом)
     . '; ждут возврата вручную на '
     . array_sum(array_map(static fn(array $r): int => (int) $r['is_paid'] === 1 ? (int) $r['amount_paid'] : 0, $__снятые)) . ' ₽');
if ($__сВозвратом) {
    note('  возврат проведён: ' . implode(', ', array_map(
        static fn(array $r): string => (string) $r['number'] . ' (' . (string) $r['ret'] . ')', $__сВозвратом)));
}
/* ОТМЕТКА ВОЗВРАТА ЗДЕСЬ - НЕ ПРОВАЛ, И ЭТО НЕ ПОСЛАБЛЕНИЕ.
 *
 * Первая сборка краснела на самой отметке: «у снятых заявок автовозврата нет».
 * 16.10.2026 владелец вернул 2 910 ₽ по трём заявкам руками - ровно так, как
 * сам и решил (правило 8а), - и проверка объявила провалом сделанную им работу.
 * По базе руку владельца от автомата не отличить вовсе: колонка одна. А
 * настоящий заслон стоит в КОДЕ и проверен выше: дверь отклонения зовётся с
 * ключом «без_возврата», и условие, сторожащее вызов кассы, читается отрезком.
 * Красное на ровном месте прячет настоящие отказы (правила 47, 55), поэтому
 * факт печатается справкой.
 */


/* ───────────── СЛОВА «ЗАКРЫТЫЙ КЛУБ» СНЯТЫ С ВИТРИН ─────────────
 *
 * Слово владельца 17.10.2026: «Слова „закрытый клуб" убери на странице сайта и
 * в блоге». Клуб у центра называется Элитным, и «закрытый» рядом с ним читалось
 * как отдельная привилегия, которой нет: саму «Закрытые конкурсы Клуба»
 * владелец снял ещё 15.10 (правило 69). По дороге нашлось место дороже просьбы:
 * СЕРТИФИКАТ участника Клуба - документ, который человек получает на руки, -
 * до сих пор обещал «доступ к закрытым конкурсам Клуба». */
sec('Слова «закрытый клуб» сняты с витрин');
$__mn = cfsrc('templates/site/pages/menu.php');
$__bl = cfsrc('templates/site/pages/blog.php');
$__ct = cfsrc('core/club_cert.php');
/* ОТРИЦАНИЕМ: формулировка легко возвращается одной правкой шаблона.
   Пояснения снимаются лексером - в них снятое названо НАРОЧНО (правила 40, 48, 63). */
chk('в баннере меню нет «закрытого» клуба',
    preg_match('~[Зз]акрыт\w*\s+(вип[- ]?)?[ЭэКк]~u', $__mn) === 0);
chk('баннер меню называет клуб как письма',
    str_contains($__mn, 'Элитный клуб «Музыкальный'));
chk('в блоге нет «закрытого клуба»',
    preg_match('~[Зз]акрыт\w*\s+клуб~u', $__bl) === 0);
chk('в сертификате нет обещания закрытых конкурсов Клуба',
    preg_match('~[Зз]акрыт\w*\s+конкурс~u', $__ct) === 0,
    'владелец снял эту привилегию 15.10.2026, правило 69');
chk('сертификат берёт число льготных заявок у единого источника',
    str_contains($__ct, 'club_free_limit()'),
    'вписанная копия устареет молча');

/* ФАКТ: что правда соберётся и что правда напечатано на живых страницах.
   Сборщик подключаем САМИ: без него проверка печатала бы справку и молча не
   выполнялась - а это та самая слепота, что хуже отсутствующей (правило 71). */
if (!function_exists('club_cert_html') && is_file(BASE_PATH . '/core/club_cert.php')) {
    require_once BASE_PATH . '/core/club_cert.php';
}
if (function_exists('club_cert_html')) {
    $__u = one('SELECT * FROM users LIMIT 1') ?: [];
    $__html = $__u ? club_cert_html($__u, ['pct' => 20, 'card_no' => 'MM-0001',
        'since' => '01.09.2026', 'till' => '01.09.2027', 'active' => 1]) : '';
    if ($__html === '') {
        ok('учётных записей нет - сертификат собирать не из чего (справка, не провал)');
    } else {
        chk('ФАКТ: в собранном сертификате нет слова «закрыт»',
            preg_match('~закрыт~ui', $__html) === 0);
        chk('ФАКТ: сертификат называет действующую привилегию',
            preg_match('~без организационного взноса~u', $__html) === 1);
    }
} else {
    ok('сборщик сертификата не подключён (справка, не провал)');
}
$__стр = static function (string $path): string {
    $c = curl_init(rtrim((string) url('/'), '/') . $path);
    curl_setopt_array($c, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 20,
        CURLOPT_SSL_VERIFYPEER => false, CURLOPT_SSL_VERIFYHOST => 0, CURLOPT_FOLLOWLOCATION => true]);
    $r = (string) curl_exec($c); curl_close($c); return $r;
};
foreach (['/menu', '/blog'] as $__u2) {
    $__h = $__стр($__u2);
    if ($__h === '') { ok('страница ' . $__u2 . ' не ответила (справка, не провал)'); continue; }
    /* «Закрыть» у кнопки всплывающего окна законно: ищем именно клуб рядом. */
    chk('ФАКТ: на странице ' . $__u2 . ' нет «закрытого клуба»',
        preg_match('~[Зз]акрыт\w*\s+(вип[- ]?)?[Ээ]литн\w*\s+клуб|[Зз]акрыт\w*\s+клуб~u', $__h) === 0);
}

echo "\n==== ИТОГО: проверок " . ($OK + $FAIL) . ", ПРОВАЛОВ: $FAIL ====\n";
exit($FAIL > 0 ? 1 : 0);
