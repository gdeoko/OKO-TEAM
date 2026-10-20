<?php
/**
 * scripts/audit_prioritet.php — ВИДЕН ЛИ ОПЕРАТОРУ ПРИОРИТЕТ ЗАЯВКИ.
 *
 * Правка владельца 14.10.2026: в заявках на участие и в заявках на изготовление
 * наградного материала должно быть видно, что они пришли от учреждения-партнёра
 * или от участника Элитного клуба, потому что у них другие сроки.
 *
 * Аудит проверяет ДВЕ разные вещи, и обе нужны:
 *   1. ЧИСЛО. Срок, который показывает плашка, равен сроку, который ставит код
 *      (`_plan_send_at` для результата, `order_issue_diplomas` для изготовления).
 *      Считается он теперь в одном месте, но проверка остаётся: именно расхождение
 *      копий стоило правок в правилах 33, 35 и 45.
 *   2. ПИКСЕЛИ. Плашка правда печатается на живых страницах админки. Проверка
 *      функции этого не доказывает: `prioritet_plashka()` может отдавать верный
 *      HTML, а в шаблоне строки не быть вовсе.
 *
 * Запуск:  php scripts/audit_prioritet.php  [--без-страниц]
 *   --без-страниц — только расчёт, без входа в админку и запросов к сайту.
 */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { fwrite(STDERR, "CLI only\n"); exit(1); }

define('BASE_PATH', dirname(__DIR__));
$GLOBALS['CFG'] = require BASE_PATH . '/config.php';
foreach (['db', 'helpers', 'data', 'send_timing', 'club', 'prioritet'] as $m) {
    require_once BASE_PATH . '/core/' . $m . '.php';
}
db();

const PR_HOST = 'xn----7sbugdeiegh1b0a9hen.xn--p1ai';
$БЕЗ_СТРАНИЦ = in_array('--без-страниц', $argv, true);

$FAIL = 0; $OK = 0;
function sec(string $s): void { echo "\n=== $s ===\n"; }
function ok(string $w, string $i = ''): void { global $OK; $OK++; echo "  ok   $w" . ($i !== '' ? "  [$i]" : '') . "\n"; }
function bad(string $w, string $i = ''): void { global $FAIL; $FAIL++; echo "  FAIL $w" . ($i !== '' ? "  $i" : '') . "\n"; }
function chk(string $w, bool $c, string $i = ''): void { $c ? ok($w, $i) : bad($w, $i); }

/* ─────────────── 1. ЧИСЛО: плашка и код говорят одно ─────────────── */

sec('Лестница сроков: 5 обычный, 4 партнёр, 3 клуб');
chk('общий срок 5', PRIORITET_SROK_OBSHIY === 5, (string) PRIORITET_SROK_OBSHIY);
chk('клубный срок 3', PRIORITET_SROK_KLUBA === 3, (string) PRIORITET_SROK_KLUBA);
$pdRange = one("SELECT MIN(partner_priority_days) mn, MAX(partner_priority_days) mx, COUNT(*) n
                  FROM institutions WHERE partner_status='accepted'");
chk('у принятых партнёров срок стоит и он короче общего',
    (int) ($pdRange['n'] ?? 0) > 0 && (int) ($pdRange['mn'] ?? 0) > 0
      && (int) ($pdRange['mx'] ?? 9) < PRIORITET_SROK_OBSHIY,
    'партнёров ' . (int) ($pdRange['n'] ?? 0) . ', дней ' . (int) ($pdRange['mn'] ?? 0) . '..' . (int) ($pdRange['mx'] ?? 0));

sec('Срок результата: плашка против условий кода');
$расх = 0; $всего = 0; $клубных = 0; $партнёрских = 0; $длинных = 0;
foreach (all("SELECT * FROM applications ORDER BY id DESC") as $a) {
    $всего++;
    $p = prioritet_zayavki($a);
    if (!empty($p['клуб']))    $клубных++;
    if (!empty($p['партнёр'])) $партнёрских++;

    /* Условия повторены здесь ДОСЛОВНО и нарочно: аудит обязан быть независимым
       свидетелем. Если однажды кто-то упростит prioritet.php, эта проверка
       покраснеет, а не промолчит.
       ДЛИННЫЙ КОНКУРС — отдельный случай (слово владельца 14.10.2026): итоги
       оглашаются списком в объявленную дату, рабочих дней там не считает никто,
       и признак этого — ноль. */
    $w = PRIORITET_SROK_OBSHIY;
    if (!empty($a['user_id']) && club_is_active((int) $a['user_id'])) $w = PRIORITET_SROK_KLUBA;
    $inst = (int) ($a['institution_id'] ?? 0);
    if ($inst > 0 && $w > PRIORITET_SROK_KLUBA) {
        $pd = (int) (scalar("SELECT COALESCE(partner_priority_days,0) FROM institutions
                              WHERE id=? AND partner_status='accepted'", [$inst]) ?? 0);
        if ($pd > 0 && $pd < $w) $w = $pd;
    }
    $длин = (string) (scalar("SELECT results_mode FROM competitions WHERE id=?",
                             [(int) ($a['competition_id'] ?? 0)]) ?? '') === 'list';
    if ($длин) { $w = 0; $длинных++; }
    if ($w !== (int) $p['дней_результат']) {
        $расх++;
        if ($расх <= 5) bad('заявка #' . (int) $a['id'] . ': код ' . $w . ', плашка ' . (int) $p['дней_результат']);
    }
}
chk('совпало по всем заявкам', $расх === 0,
    'проверено ' . $всего . ', клубных ' . $клубных . ', партнёрских ' . $партнёрских
    . ', на длинных конкурсах ' . $длинных . ', расхождений ' . $расх);

sec('Срок изготовления: у клуба 3, у всех остальных 5');
$расх2 = 0; $зклуб = 0; $зпартнёр = 0; $звсего = 0;
foreach (all("SELECT * FROM awards_orders") as $o) {
    $звсего++;
    $p = prioritet_zakaza($o);
    if (!empty($p['клуб']))    $зклуб++;
    if (!empty($p['партнёр'])) $зпартнёр++;
    $ждём = !empty($p['клуб']) ? PRIORITET_SROK_KLUBA : PRIORITET_SROK_OBSHIY;
    if ($ждём !== (int) $p['дней_изготовление']) {
        $расх2++;
        if ($расх2 <= 5) bad('заказ №' . (int) $o['id'] . ': ждём ' . $ждём . ', плашка ' . (int) $p['дней_изготовление']);
    }
}
chk('совпало по всем заказам', $расх2 === 0,
    'проверено ' . $звсего . ', клубных ' . $зклуб . ', по заявкам партнёров ' . $зпартнёр);

sec('Партнёру короткий срок изготовления НЕ обещан');
$пз = one("SELECT o.* FROM awards_orders o
             JOIN applications a ON a.id=o.application_id
             JOIN institutions i ON i.id=a.institution_id
            WHERE i.partner_status='accepted'
              AND NOT EXISTS (SELECT 1 FROM club_members c
                               WHERE c.user_id=COALESCE(o.user_id,a.user_id) AND c.active=1
                                 AND c.expires_at>datetime('now','localtime'))
            LIMIT 1");
if (!$пз) { ok('заказов от партнёров без клуба сейчас нет, проверять нечего'); }
else {
    $p = prioritet_zakaza($пз);
    chk('партнёр опознан', !empty($p['партнёр']), (string) $p['учреждение']);
    chk('срок изготовления общий', (int) $p['дней_изготовление'] === PRIORITET_SROK_OBSHIY,
        (string) $p['дней_изготовление']);
    $пл = prioritet_plashka($p, 'изготовление');
    chk('плашка прямо говорит про общий срок', mb_stripos($пл, 'общий срок') !== false,
        mb_substr(strip_tags($пл), 0, 80));
}

sec('ДЛИННЫЙ КОНКУРС: срок аттестации задаёт дата оглашения, а не счёт дней');
$дл = all("SELECT a.*, c.name cname, c.results_date FROM applications a
             JOIN competitions c ON c.id=a.competition_id
            WHERE c.results_mode='list'
              AND (COALESCE(a.institution_id,0)>0
                   OR EXISTS (SELECT 1 FROM club_members m WHERE m.user_id=a.user_id AND m.active=1
                               AND m.expires_at>datetime('now','localtime')))
         ORDER BY a.id DESC LIMIT 5");
if (!$дл) { bad('на длинных конкурсах нет ни заявки партнёра, ни заявки клуба — проверить нечего'); }
foreach ($дл as $a) {
    $p  = prioritet_zayavki($a);
    /* СМОТРИМ ВИДИМЫЙ ТЕКСТ, А НЕ HTML. В подсказке при наведении слова
       «4 рабочих дня здесь НЕ действует» стоят законно и нужны оператору, но в
       сыром HTML они живут в атрибуте title — и проверка «на плашке нет рабочих
       дней» краснела на верной плашке. */
    $пл = strip_tags(prioritet_plashka($p, 'заявка'));
    $ном = '#' . (int) $a['id'] . ' «' . mb_substr((string) $a['cname'], 0, 22) . '»';
    chk($ном . ': длинный опознан', !empty($p['длинный']));
    chk($ном . ': счёта дней нет (ноль)', (int) $p['дней_результат'] === 0, (string) $p['дней_результат']);
    chk($ном . ': на плашке нет «рабочих дней»', mb_stripos($пл, 'рабоч') === false, $пл);
    chk($ном . ': названы итоги списком', mb_stripos($пл, 'итоги списком') !== false);
    if (trim((string) $a['results_date']) !== '') {
        chk($ном . ': названа дата оглашения',
            strpos($пл, date('d.m.Y', (int) strtotime((string) $a['results_date']))) !== false,
            (string) $a['results_date']);
    }
    /* Срок ИЗГОТОВЛЕНИЯ оглашение не трогает: он считается от оплаты заказа и у
       длинного конкурса такой же, как у короткого. */
    chk($ном . ': срок изготовления не тронут',
        (int) $p['дней_изготовление'] === (!empty($p['клуб']) ? PRIORITET_SROK_KLUBA : PRIORITET_SROK_OBSHIY),
        (string) $p['дней_изготовление']);
}

sec('Партнёрская четвёрка на длинном конкурсе НЕ обещана');
$дп = one("SELECT a.* FROM applications a
             JOIN institutions i ON i.id=a.institution_id
             JOIN competitions c ON c.id=a.competition_id
            WHERE i.partner_status='accepted' AND c.results_mode='list' ORDER BY a.id DESC LIMIT 1");
if (!$дп) { ok('заявок партнёров в длинных конкурсах сейчас нет'); }
else {
    $пл = strip_tags(prioritet_plashka(prioritet_zayavki($дп), 'заявка'));
    chk('партнёр назван', mb_stripos($пл, 'Партнёр:') !== false);
    chk('четвёрки в видимом тексте нет', mb_stripos($пл, '4 рабоч') === false, $пл);
}

sec('Срок результата берётся из ОДНОГО источника, копий лестницы нет');
/* Сверять число с самим собой бессмысленно: оба конца взялись бы из prioritet.
   Проверяем то, что правда может сломаться, — ПОЯВЛЕНИЕ ВТОРОЙ КОПИИ УСЛОВИЙ.
   Именно копия и была бедой: `grade_apply` считал «клуб 3, иначе 5» сам и про
   партнёрскую четвёрку не знал вовсе, из-за чего обещание 41 учреждению не
   исполнялось ни разу. */
foreach ([
    'core/grade_apply.php'    => 'срок результата при оценке',
    'cron/send_diplomas.php'  => 'срок наградных дипломов',
    'core/orders.php'         => 'срок изготовления по заказу',
] as $файл => $что) {
    $src = (string) @file_get_contents(BASE_PATH . '/' . $файл);
    chk("$что ($файл) зовёт prioritet", strpos($src, 'prioritet_za') !== false);
    chk("$что ($файл) не держит своей копии «3 : 5»",
        !preg_match('~club_is_active\([^)]*\)\s*\)?\s*\?\s*3\s*:\s*5~u', $src));
}
$кор = one("SELECT a.* FROM applications a JOIN competitions c ON c.id=a.competition_id
             WHERE c.results_mode<>'list' ORDER BY a.id DESC LIMIT 1");
chk('у короткого конкурса срок всегда положительный',
    $кор && (int) prioritet_zayavki($кор)['дней_результат'] > 0);

sec('Клубная подписка: изготавливать нечего');
$подп = one("SELECT * FROM awards_orders WHERE kind='club' ORDER BY id DESC LIMIT 1");
if (!$подп) { ok('покупок членства в заказах сейчас нет'); }
else {
    $p = prioritet_zakaza($подп);
    chk('подписка опознана', !empty($p['подписка']));
    $пл = prioritet_plashka($p, 'изготовление');
    chk('срок изготовления на ней не обещан',
        $пл === '' || (mb_stripos($пл, 'рабочих') === false && mb_stripos($пл, 'рабочий') === false),
        strip_tags($пл));
}

sec('Неполный SELECT не прячет партнёра');
$пa = one("SELECT a.id FROM applications a JOIN institutions i ON i.id=a.institution_id
            WHERE i.partner_status='accepted' ORDER BY a.id DESC LIMIT 1");
if (!$пa) { bad('нет ни одной заявки от партнёра — проверить нечего'); }
else {
    $p = prioritet_zayavki(['id' => (int) $пa['id'], 'user_id' => 0]);   // без institution_id
    chk('учреждение найдено по номеру заявки', !empty($p['партнёр']), (string) $p['учреждение']);
}

sec('Падежи в сроке');
foreach ([1 => '1 рабочий день', 2 => '2 рабочих дня', 3 => '3 рабочих дня',
          4 => '4 рабочих дня', 5 => '5 рабочих дней', 11 => '11 рабочих дней',
          21 => '21 рабочий день'] as $n => $ждём) {
    chk('' . $n, prioritet_dney($n) === $ждём, prioritet_dney($n));
}

sec('Обычный участник плашки не получает');
$об = one("SELECT a.* FROM applications a
            WHERE COALESCE(a.institution_id,0)=0
              AND NOT EXISTS (SELECT 1 FROM club_members c WHERE c.user_id=a.user_id AND c.active=1
                               AND c.expires_at>datetime('now','localtime'))
            ORDER BY a.id DESC LIMIT 1");
if (!$об) { bad('нет обычной заявки для проверки'); }
else {
    $p = prioritet_zayavki($об);
    chk('плашки нет', prioritet_plashka($p) === '' && prioritet_plashka($p, 'изготовление') === '');
    chk('словами — обычный участник', mb_stripos(prioritet_slovami($p), 'обычный участник') !== false,
        prioritet_slovami($p));
}

/* ─────────────── 2. ПИКСЕЛИ: плашка есть на живых страницах ─────────────── */

if ($БЕЗ_СТРАНИЦ) {
    echo "\nСтраницы админки не проверялись (--без-страниц).\n";
} else {
    $BASE = rtrim((string) getenv('BASE'), '/');
    if ($BASE === '') {
        $probe = @fsockopen('127.0.0.1', 8099, $eno, $estr, 1);
        if ($probe) { fclose($probe); $BASE = 'http://127.0.0.1:8099'; }
        else        { $BASE = 'https://' . PR_HOST; }
    }

    $jar = sys_get_temp_dir() . '/muzmir_prioritet.txt';
    @unlink($jar);
    $http = static function (string $url, ?array $post = null) use ($jar, $BASE): array {
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_SSL_VERIFYPEER => false, CURLOPT_SSL_VERIFYHOST => 0,
            CURLOPT_RESOLVE => [PR_HOST . ':443:127.0.0.1', PR_HOST . ':80:127.0.0.1'],
            CURLOPT_FOLLOWLOCATION => true, CURLOPT_MAXREDIRS => 5,
            CURLOPT_COOKIEJAR => $jar, CURLOPT_COOKIEFILE => $jar,
            CURLOPT_TIMEOUT => 90, CURLOPT_PROXY => '',
            CURLOPT_HTTPHEADER => ['Origin: ' . $BASE, 'Referer: ' . $BASE . '/'],
        ]);
        if ($post !== null) {
            curl_setopt($ch, CURLOPT_POST, true);
            curl_setopt($ch, CURLOPT_POSTFIELDS, http_build_query($post));
        }
        $body = (string) curl_exec($ch);
        $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
        curl_close($ch);
        return ['code' => $code, 'body' => $body];
    };

    sec('Вход администратором');
    $r = $http($BASE . '/admin/');
    $csrf = preg_match('~name="_csrf"\s+value="([^"]+)"~', $r['body'], $m) ? $m[1] : '';
    require_once BASE_PATH . '/scripts/_audit_actors.php';
    $ADM = audit_actor('admin');
    $r = $http($BASE . '/admin/', ['_csrf' => $csrf, 'do' => 'login',
                                   'email' => $ADM['email'], 'password' => $ADM['password']]);
    $вошли = stripos($r['body'], 'p=logout') !== false;
    chk('вход выполнен', $вошли);

    if (!$вошли) { bad('без входа страницы проверить нельзя'); }
    else {
        /* Берём ЖИВЫЕ заявки: партнёрскую и клубную. Если какой-то сейчас нет —
           честно говорим, а не показываем зелёное на пустом месте. */
        /* БЕРЁМ КОРОТКИЙ КОНКУРС НАРОЧНО. Здесь проверяется, что на плашке
           названы «4 рабочих дня», а они бывают только у короткого: у длинного
           срок задаёт дата оглашения. Пока отбор шёл просто по свежести, в
           проверку попала заявка длинного конкурса, и «4 рабочих дня» нашлись
           в ПОДСКАЗКЕ при наведении («четвёрка здесь НЕ действует») - зелёное
           на ровном месте, то есть проверка перестала проверять. Длинный
           конкурс разбирает своя секция ниже. */
        /* ПАРТНЁРСКАЯ ЗАЯВКА БЕРЁТСЯ БЕЗ КЛУБА, И ЭТО НЕ ПРИДИРКА.
           Здесь проверяется, что на плашке названы «4 рабочих дня», а у
           участника с клубом их не будет никогда: клубный срок короче, и плашка
           честно говорит «срок по клубу, он короче» (правило 37). 16.10.2026
           самой свежей партнёрской заявкой стала MA-2026-00005 от оргкомитета
           центра, и проверка покраснела на ВЕРНОМ коде - мерка ждала вчерашнего
           расклада. Поэтому кандидат выбирается не по свежести, а по весу: вес 1
           это ровно «партнёр без клуба», и считает его тот же единый источник,
           что и срок. Своей копии условий здесь быть не должно. */
        $партApp = null;
        foreach (all("SELECT a.*, i.name inst FROM applications a
                        JOIN institutions i ON i.id=a.institution_id
                        JOIN competitions c ON c.id=a.competition_id
                       WHERE i.partner_status='accepted' AND c.results_mode<>'list'
                    ORDER BY a.id DESC LIMIT 60") as $__к) {
            if (prioritet_ves(prioritet_zayavki($__к)) === 1) { $партApp = $__к; break; }
        }
        $клубApp = one("SELECT a.* FROM applications a
                          JOIN club_members m ON m.user_id=a.user_id
                          JOIN competitions c ON c.id=a.competition_id
                         WHERE m.active=1 AND m.expires_at>datetime('now','localtime')
                           AND c.results_mode<>'list'
                      ORDER BY a.id DESC LIMIT 1");

        $страница = static function (string $p) use ($http, $BASE): string {
            $r = $http($BASE . '/admin/?' . $p);
            if ($r['code'] !== 200) { bad('страница ?' . $p . ' отдала ' . $r['code']); return ''; }
            if (stripos($r['body'], 'Fatal error') !== false || stripos($r['body'], 'Warning:') !== false) {
                bad('на странице ?' . $p . ' шум PHP');
            }
            return $r['body'];
        };

        sec('Карточка заявки партнёра');
        if (!$партApp) { bad('заявок от партнёров сейчас нет'); }
        else {
            $b = $страница('p=applications&id=' . (int) $партApp['id']);
            chk('есть слово «Приоритет»', mb_stripos($b, 'Приоритет') !== false);
            chk('назван партнёр', mb_stripos($b, 'Партнёр:') !== false);
            chk('назван срок 4 рабочих дня', mb_stripos($b, '4 рабочих дня') !== false);
            chk('названо само учреждение', mb_stripos($b, (string) $партApp['inst']) !== false,
                (string) $партApp['inst']);

            sec('Карточка оценки заявки партнёра');
            $b = $страница('p=grading&id=' . (int) $партApp['id']);
            chk('плашка партнёра на карточке оценки', mb_stripos($b, 'Партнёр:') !== false);
            chk('срок назван', mb_stripos($b, '4 рабочих дня') !== false);

            sec('Список заявок');
            $b = $страница('p=applications&q=' . rawurlencode((string) $партApp['number']));
            chk('в списке у строки есть плашка партнёра', mb_stripos($b, 'Партнёр:') !== false);
        }

        sec('Клубная заявка');
        if (!$клубApp) { bad('заявок от участников клуба сейчас нет'); }
        else {
            $b = $страница('p=applications&id=' . (int) $клубApp['id']);
            chk('назван Элитный клуб', mb_stripos($b, 'Элитный клуб') !== false);
            chk('назван срок 3 рабочих дня', mb_stripos($b, '3 рабочих дня') !== false);
        }

        sec('Заказы электронных наград');
        /* РАЗДЕЛЫ ЗАКАЗОВ СМОТРЯТ НА РАЗНЫЕ ЗАКАЗЫ, И ПРОВЕРКА ОБЯЗАНА ЭТО ЗНАТЬ.
           «Заказы электронных наград» (p=digital) идут от реестра дипломов, а
           «Оригиналы» (p=orders) показывают ТОЛЬКО заказы с печатной позицией и
           намеренно не показывают клубную подписку. Первый заход этой проверки
           спрашивал оба раздела одним адресом ?p=orders&id=N - такого фильтра в
           разделе нет вовсе, страница отдавала рабочий список без нужного заказа,
           и три проверки краснели на верном коде. */
        $партЦифра = one("SELECT o.*, a.number app_number, i.name inst FROM awards_orders o
                            JOIN applications a ON a.id=o.application_id
                            JOIN institutions i ON i.id=a.institution_id
                           WHERE i.partner_status='accepted'
                             AND EXISTS (SELECT 1 FROM diplomas d WHERE d.application_id=a.id
                                          AND COALESCE(d.kind,'digital')<>'original')
                        ORDER BY o.id DESC LIMIT 1");
        if (!$партЦифра) { ok('электронных наград по заявкам партнёров сейчас нет'); }
        else {
            $b = $страница('p=digital&q=' . rawurlencode((string) $партЦифра['app_number']));
            chk('плашка партнёра есть', mb_stripos($b, 'Партнёр:') !== false, (string) $партЦифра['app_number']);
            chk('сказано, что изготовление в общий срок', mb_stripos($b, 'общий срок') !== false);
        }

        sec('Оригиналы почтой');
        $партБумага = one("SELECT o.*, i.name inst FROM awards_orders o
                             JOIN applications a ON a.id=o.application_id
                             JOIN institutions i ON i.id=a.institution_id
                            WHERE i.partner_status='accepted'
                              AND o.items LIKE '%\"kind\":\"original\"%'
                         ORDER BY o.id DESC LIMIT 1");
        if (!$партБумага) { ok('печатных заказов по заявкам партнёров сейчас нет'); }
        else {
            $b = $страница('p=orders&q=' . (int) $партБумага['id']);
            chk('в карточке заказа назван партнёр', mb_stripos($b, 'Партнёр:') !== false,
                '№' . (int) $партБумага['id']);
            chk('сказано, что изготовление в общий срок', mb_stripos($b, 'общий срок') !== false);
        }

        sec('Карточка заявки длинного конкурса: дата вместо дней');
        $длApp = one("SELECT a.*, c.results_date FROM applications a
                        JOIN competitions c ON c.id=a.competition_id
                        JOIN institutions i ON i.id=a.institution_id
                       WHERE c.results_mode='list' AND i.partner_status='accepted'
                    ORDER BY a.id DESC LIMIT 1");
        if (!$длApp) { ok('заявок партнёров в длинных конкурсах сейчас нет'); }
        else {
            $b = $страница('p=applications&id=' . (int) $длApp['id']);
            chk('назван партнёр', mb_stripos($b, 'Партнёр:') !== false);
            chk('названы итоги списком', mb_stripos($b, 'итоги списком') !== false);
            if (trim((string) $длApp['results_date']) !== '') {
                chk('названа дата оглашения',
                    strpos($b, date('d.m.Y', (int) strtotime((string) $длApp['results_date']))) !== false,
                    (string) $длApp['results_date']);
            }
        }

        sec('Реестр дипломов и оценка длинных конкурсов');
        $пд = one("SELECT d.id, a.competition_id, i.name inst FROM diplomas d
                     JOIN applications a ON a.id=d.application_id
                     JOIN institutions i ON i.id=a.institution_id
                    WHERE i.partner_status='accepted' ORDER BY d.id DESC LIMIT 1");
        if (!$пд) { ok('дипломов по заявкам партнёров сейчас нет'); }
        else {
            /* Вкладка «Готовые и отправка»: выданные бланки живут на ней, а
               вкладка по умолчанию («К генерации») показывает только заявки БЕЗ
               диплома - у закрытого конкурса она пуста, и проверка краснела на
               верном коде. */
            $b = $страница('p=diplomas&tab=sent&competition=' . (int) $пд['competition_id']);
            chk('в реестре дипломов плашка партнёра есть', mb_stripos($b, 'Партнёр:') !== false,
                'конкурс ' . (int) $пд['competition_id']);
        }
        $дл = one("SELECT a.competition_id FROM applications a
                     JOIN competitions c ON c.id=a.competition_id
                     JOIN institutions i ON i.id=a.institution_id
                    WHERE i.partner_status='accepted' AND c.results_mode='list'
                 ORDER BY a.id DESC LIMIT 1");
        if (!$дл) { ok('заявок от партнёров в длинных конкурсах сейчас нет'); }
        else {
            $b = $страница('p=longcomp&competition=' . (int) $дл['competition_id']);
            chk('в оценке длинного конкурса плашка партнёра есть', mb_stripos($b, 'Партнёр:') !== false,
                'конкурс ' . (int) $дл['competition_id']);
        }

        sec('Очередь на оценку и очередь отправок открываются с плашками');
        $b = $страница('p=grading');
        chk('очередь на оценку открылась', $b !== '');
        if ($партApp && (string) $партApp['status'] === 'new') {
            chk('свежая заявка партнёра помечена в очереди', mb_stripos($b, 'Партнёр:') !== false);
        }

        /* ФАКТ: ПОРЯДОК СТРОК В ЖИВОЙ ОЧЕРЕДИ, А НЕ ВЫЗОВ СОРТИРОВКИ В КОДЕ.
           Функция может отдавать верный порядок, а шаблон печатать строки своим
           запросом (урок правила 47). Поэтому берём номера заявок ровно в том
           виде, в каком они напечатаны, и сверяем их вес с базой. */
        sec('ФАКТ: в начале очереди клуб, за ним партнёры');
        $блок = $b;
        $н = mb_strpos($блок, 'СПИСОК 1');
        $к = mb_strpos($блок, 'СПИСОК 2');
        if ($н === false || $к === false || $к <= $н) {
            bad('в разметке не нашлись границы списка очереди');
        } else {
            $блок = mb_substr($блок, $н, $к - $н);
            chk('пояснение про срочные напечатано',
                mb_stripos($блок . $b, 'В начале очереди всегда стоят заявки участников Элитного клуба') !== false);
            /* СЧЁТЧИК СРОЧНЫХ ПРОВЕРЯЕТСЯ НИЖЕ, КОГДА ИЗВЕСТНО, ЕСТЬ ЛИ ОНИ.
               Шапка печатает его только при живых срочных строках
               (`if ($qКлуб || $qПарт)` в admin/grading.php), а заявки клуба и
               партнёров со временем оцениваются и из очереди уходят. Требовать
               счётчик всегда значит красить зелёную работу: 18.10.2026 так и
               вышло - срочных в очереди не осталось, и проверка покраснела на
               верном коде. Красное на ровном месте прячет настоящие отказы
               (правила 47, 62). */

            $ids = [];
            foreach (preg_split('~<tr[\s>]~', $блок) as $стр) {
                if (preg_match('~p=grading&(?:amp;)?id=(\d+)~', $стр, $m)) $ids[] = (int) $m[1];
            }
            if (!$ids) { ok('очередь сейчас пуста, порядок проверять не на чем'); }
            else {
                $вес = []; $кто = []; $имена = [];
                foreach ($ids as $id) {
                    $a = one("SELECT * FROM applications WHERE id=?", [$id]);
                    if (!$a) { bad('напечатана заявка #' . $id . ', которой нет в базе'); continue; }
                    $вес[$id]  = prioritet_ves(prioritet_zayavki($a));
                    $e = mb_strtolower(trim((string) ($a['email'] ?? '')));
                    $кто[$id]  = $e !== '' ? $e : ('id:' . $id);
                    $имена[$id] = (string) ($a['number'] ?? ('#' . $id));
                }
                $срочных = 0;
                foreach ($вес as $v) if ($v < 2) $срочных++;
                if ($срочных === 0) {
                    ok('в очереди сейчас нет заявок клуба и партнёров', 'строк ' . count($ids));
                    // И счётчика быть не должно: обещать срочные, которых нет, нельзя.
                    chk('счётчика срочных нет, и срочных строк тоже нет',
                        mb_stripos($блок, 'сперва срочные') === false);
                } else {
                    chk('счётчик срочных напечатан', mb_stripos($блок, 'сперва срочные') !== false,
                        'срочных ' . $срочных);
                    /* Вес обязан только расти: сперва нули (клуб), потом единицы
                       (партнёр), потом всё остальное. Обратный шаг это строка,
                       которая стоит позже, чем ей положено по сроку. */
                    /* СУДИМ ГРУППАМИ, А НЕ СТРОКАМИ, и это не послабление.
                       Очередь сортирует ГРУППЫ заявок одного участника, а вес
                       группы это МИНИМУМ по её строкам (`grading.php`, правило 73):
                       заявки одного человека обязаны идти подряд. Внутри группы
                       веса бывают разные, и построчная сверка краснела на верном
                       коде: 19.10.2026 один участник подал три заявки до привязки
                       к учреждению (вес 2) и три после (вес 1), они законно стоят
                       вперемешку внутри своей поднятой группы. */
                    $весГруппы = [];
                    $порядок   = [];
                    foreach ($ids as $id) {
                        if (!isset($вес[$id])) continue;
                        $g = $кто[$id];
                        if (!isset($весГруппы[$g])) { $весГруппы[$g] = $вес[$id]; $порядок[] = $g; }
                        else { $весГруппы[$g] = min($весГруппы[$g], $вес[$id]); }
                    }
                    $сбой = '';
                    $пред = -1; $предГ = '';
                    foreach ($порядок as $g) {
                        if ($весГруппы[$g] < $пред) {
                            $сбой = 'группа ' . $g . ' (вес ' . $весГруппы[$g] . ') стоит после группы '
                                   . $предГ . ' (вес ' . $пред . ')';
                            break;
                        }
                        $пред = $весГруппы[$g]; $предГ = $g;
                    }
                    chk('порядок очереди: клуб, партнёры, остальные', $сбой === '',
                        $сбой !== '' ? $сбой : ('срочных ' . $срочных . ' из ' . count($ids)));
                }
                /* Заявки одного участника обязаны идти подряд и после подъёма:
                   на этом стоит переход «следующая заявка» после оценки. */
                $виден = []; $разрыв = '';
                $пк = '';
                foreach ($ids as $id) {
                    if (!isset($кто[$id])) continue;
                    $k = $кто[$id];
                    if ($k !== $пк) {
                        if (isset($виден[$k])) { $разрыв = $имена[$id] . ' (' . $k . ')'; break; }
                        $виден[$k] = true; $пк = $k;
                    }
                }
                chk('заявки одного участника идут подряд', $разрыв === '', $разрыв);
            }
        }
        $b = $страница('p=dispatch');
        chk('очередь отправок открылась', $b !== '');

        /* ФАКТ: ПОРЯДОК ОЧЕРЕДИ ОТПРАВОК НЕ СЛОМАН ТАЙ-БРЕЙКОМ.
           Плановое время главнее веса: строка, которой пора уходить, обязана
           стоять выше клубной, у которой запас ещё есть. Сверяем напечатанные
           метки времени: датированные обязаны только расти. */
        sec('ФАКТ: очередь отправок идёт по плановому времени');
        $н = mb_strpos($b, 'ЕДИНАЯ ОЧЕРЕДЬ');
        $к = $н !== false ? mb_strpos($b, 'Архив отправленных', $н) : false;
        if ($н === false) { bad('в разметке не нашлась очередь отправок'); }
        else {
            $бл = mb_substr($b, $н, ($к !== false ? $к : mb_strlen($b)) - $н);
            chk('число строк с коротким сроком напечатано или их нет',
                mb_strpos($бл, 'с коротким сроком') !== false
                    || mb_strpos($бл, 'в очереди пусто') !== false
                    || !preg_match('~Элитный клуб · \d|Партнёр: [^·]+· \d~u', $бл));
            preg_match_all('~<span class="disp-when" style="background:[^"]*">([^<]*)</span>~u', $бл, $м);
            $пред = 0; $сбой = '';
            foreach (($м[1] ?? []) as $метка) {
                if (!preg_match('~^(\d{2})\.(\d{2})\.(\d{4}) (\d{2}):(\d{2})$~', trim($метка), $д)) continue;
                $t = mktime((int) $д[4], (int) $д[5], 0, (int) $д[2], (int) $д[1], (int) $д[3]);
                if ($пред && $t < $пред) { $сбой = trim($метка) . ' стоит после ' . date('d.m.Y H:i', $пред); break; }
                $пред = $t;
            }
            chk('датированные строки идут по возрастанию срока', $сбой === '', $сбой);
        }

        /* ФАКТ: СРОЧНЫЕ БЛАНКИ В НАЧАЛЕ «ДИПЛОМОВ К ГЕНЕРАЦИИ». Берём конкурс, у
           которого срочных больше всего: на конкурсе без них проверка зеленела бы
           на пустом месте. */
        sec('ФАКТ: срочные бланки в начале списка к генерации');
        $__лучший = 0; $__скольк = 0;
        foreach (all("SELECT id FROM competitions ORDER BY id") as $__c) {
            $__n = 0;
            foreach (all("SELECT a.* FROM applications a
                           WHERE a.competition_id=? AND a.result<>''
                             AND a.id NOT IN (SELECT application_id FROM diplomas WHERE type='main')",
                         [(int) $__c['id']]) as $__a) {
                if (prioritet_ves(prioritet_zayavki($__a), 'изготовление') < 2) $__n++;
            }
            if ($__n > $__скольк) { $__скольк = $__n; $__лучший = (int) $__c['id']; }
        }
        if (!$__лучший) { ok('срочных бланков к генерации сейчас нет'); }
        else {
            $b = $страница('p=diplomas&competition=' . $__лучший . '&tab=ready');
            /* Имя проверки своё: у очереди оценки есть свой счётчик с похожей
               подписью, и два одинаковых имени в отчёте не прочитать. */
            chk('счётчик срочных бланков напечатан', mb_stripos($b, 'сперва срочные') !== false);
            $tb = mb_substr($b, (int) mb_strpos($b, '<tbody>'));
            $ids = [];
            foreach (preg_split('~<tr>~u', $tb) as $стр) {
                if (preg_match('~class="rowchk" name="ids\[\]" value="(\d+)"~', $стр, $m2)) $ids[] = (int) $m2[1];
            }
            $сбой2 = ''; $пред2 = -1;
            foreach ($ids as $id) {
                $a = one("SELECT * FROM applications WHERE id=?", [$id]);
                if (!$a) continue;
                $v = prioritet_ves(prioritet_zayavki($a), 'изготовление');
                if ($v < $пред2) { $сбой2 = '#' . $id . ' (вес ' . $v . ') стоит после веса ' . $пред2; break; }
                $пред2 = $v;
            }
            chk('порядок: срочные бланки первыми', $сбой2 === '',
                $сбой2 !== '' ? $сбой2 : ('срочных ' . $__скольк . ' из ' . count($ids)));
        }
        $b = $страница('p=digital');
        chk('«Заказы электронных наград» открылись', $b !== '');
    }
}

/* ─────────── 4. СРОК НА ВИТРИНЕ И В АФИШЕ РАВЕН СРОКУ В КОДЕ ───────────
 *
 * Карточка конкурса и афиша живут месяцами, а срок аттестации меняется словом
 * владельца: 16.10.2026 у «Мирового акцента» он стал 3 рабочих дня, потому что
 * заявки принимаются только от членов Клуба. Страница пересчиталась сразу, а в
 * НАПЕЧАТАННОЙ афише осталась пятёрка - промпт афиши писал её своей копией.
 * Проверка даром: промпт строится без единой генерации.
 */
sec('Срок на витрине конкурса и в афише равен сроку в коде');
if (!function_exists('comp_terms')) require_once BASE_PATH . '/core/countdown.php';
require_once BASE_PATH . '/core/afisha_prompt.php';

$__откр = all("SELECT * FROM competitions WHERE status='open' ORDER BY id");
foreach ($__откр as $__c) {
    $__дн  = prioritet_dnei_konkursa($__c);
    $__имя = (string) ($__c['name'] ?? ('#' . (int) $__c['id']));
    $__t   = comp_terms($__c);
    $__str = (string) ($__t['results'] ?? '');
    /* У конкурса с объявленной датой оглашения витрина называет ДАТУ, а не число
       дней (правило 47): требовать там число значит ждать от кода обратного
       тому, что решил владелец. */
    if (trim((string) ($__c['results_date'] ?? '')) !== '') {
        chk('«' . $__имя . '»: витрина называет дату оглашения, а не счёт дней',
            $__str !== '' && !preg_match('~\\d+ рабочих~u', $__str), $__str);
    } else {
        chk('«' . $__имя . '»: срок на витрине назван числом ' . $__дн,
            $__str !== '' && mb_strpos($__str, (string) $__дн) !== false, $__str);
    }
    /* У конкурса с объявленной датой оглашения срок задаёт ДАТА, а не счёт дней
       (правило 47): числа дней в строке нет вовсе, и требовать его нельзя. */
    if (trim((string) ($__c['results_date'] ?? '')) === '') {
        $__p = afisha_prompt($__c);
        chk('«' . $__имя . '»: афиша просит напечатать тот же срок',
            mb_strpos($__p, $__str) !== false,
            mb_substr((string) strstr($__p, 'Line 7'), 0, 110));
        chk('«' . $__имя . '»: в афише нет чужого числа дней',
            !preg_match('~в течение (?!' . $__дн . ' )\d+ рабочих~u', $__p));
    }
}

/* Заслон у источника: вписанный срок разрешён ТОЛЬКО запасным значением рядом с
 * вызовом comp_terms(). Пояснения снимаем лексером - в них снятая пятёрка
 * названа нарочно, и поиск по сырому файлу краснел бы на нашем же разборе
 * (правила 40, 48, 63). */
$__кодбез = static function (string $rel): string {
    $src = (string) @file_get_contents(BASE_PATH . '/' . $rel);
    $out = '';
    foreach (token_get_all($src) as $t) {
        if (is_array($t) && in_array($t[0], [T_COMMENT, T_DOC_COMMENT], true)) continue;
        $out .= is_array($t) ? $t[1] : $t;
    }
    return $out;
};
foreach (['core/afisha_prompt.php', 'core/afisha_html.php'] as $__f) {
    $__k = $__кодбез($__f);
    $__плохо = [];
    foreach (['в течение 5 рабочих', 'за 5 рабочих'] as $__обр) {
        $__от = 0;
        while (($__i = mb_strpos($__k, $__обр, $__от)) !== false) {
            $__до = mb_substr($__k, max(0, $__i - 400), min($__i, 400));
            if (mb_strpos($__до, 'comp_terms(') === false) $__плохо[] = $__обр;
            $__от = $__i + 1;
        }
    }
    chk($__f . ': срок не вписан мимо comp_terms()', $__плохо === [], implode(', ', $__плохо));
}

/* ─────────── АФИША НЕ ОБЕЩАЕТ ДЕНЕГ, А УСЛОВИЕ НА НЕЙ НАЗВАНО ───────────
 *
 * Слово владельца 16.10.2026: «Убери в этих афишах информацию о том что есть
 * денежная премия», афиши трёх конкурсов пересобрать «с условиями». Строка
 * достоинств была вписана дважды - своей копией в HTML-эталоне и своей в
 * промпте, - и обещала премии на КАЖДОЙ афише центра, без суммы и условия.
 * Проверка даром: промпт строится без единой генерации.
 */
sec('На афише нет денежных премий, а условие приёма названо');

chk('строка достоинств собирается одним помощником', function_exists('afisha_plus'));
$__плюс = function_exists('afisha_plus') ? afisha_plus([]) : '';
chk('в строке достоинств денег нет', $__плюс !== '' && !preg_match('~денеж|преми~ui', $__плюс), $__плюс);

foreach ($__откр as $__c) {
    $__имя = (string) ($__c['name'] ?? ('#' . (int) $__c['id']));
    $__p   = afisha_prompt($__c);
    chk('«' . $__имя . '»: в промпте афиши нет обещания денег',
        !preg_match('~денеж|денежн|преми~ui', $__p),
        mb_substr((string) strstr($__p, 'Line 8'), 0, 120));
    chk('«' . $__имя . '»: афиша печатает строку достоинств от помощника',
        $__плюс !== '' && mb_strpos($__p, '«' . afisha_plus($__c) . '»') !== false);
    /* УСЛОВИЕ ОБЯЗАНО СТОЯТЬ НА АФИШЕ У КАЖДОГО КОНКУРСА. Лента говорит только
       про деньги за участие, а человек идёт на афишу за всем: у бесплатного
       конкурса наградные материалы заказываются отдельно (правила 27, 45), у
       платного дипломы входят в взнос (правило 37), у «Мирового акцента»
       заявки принимаются только от членов Клуба (правило 72). */
    $__nt = afisha_note($__c);
    chk('«' . $__имя . '»: условие названо припиской под лентой', trim($__nt) !== '', $__nt);
    chk('«' . $__имя . '»: приписка стоит в промпте',
        $__nt !== '' && mb_strpos($__p, 'Line 6a') !== false
            && mb_strpos($__p, '«' . $__nt . '»') !== false);
}

/* Вторых копий в живом коде быть не должно: пояснения снимаем лексером, в них
 * снятая строка названа нарочно (правила 40, 48, 63). */
foreach (['core/afisha_prompt.php' => 0, 'core/afisha_html.php' => 1] as $__f => $__скок) {
    $__k = $__кодбез($__f);
    chk($__f . ': «Компетентное жюри» вписано ' . $__скок . ' раз',
        mb_substr_count($__k, 'Компетентное жюри') === $__скок,
        (string) mb_substr_count($__k, 'Компетентное жюри'));
    chk($__f . ': в живом коде нет обещания денег',
        !preg_match('~[Дд]енежн~u', $__k));
}
$__kh = $__кодбез('core/afisha_html.php');
chk('core/afisha_html.php: эталон печатает afisha_plus()',
    mb_strpos($__kh, 'afisha_plus($c)') !== false);

/* ─────────── ПЛАТНАЯ ДОРОГА АФИШИ ИДЁТ ОДНОЙ ДВЕРЬЮ ───────────
 *
 * Слово владельца 16.10.2026: три афиши собрать платным путём (правило 72ж).
 * Второй разговор с apimodels в проекте завёлся бы на один вечер и разошёлся бы
 * с дверью ленты молча (правила 33, 35, 45, 47, 56а, 64), а трата без своего
 * счётчика не видна нигде. Проверка только читает и ничего не генерирует.
 */
sec('Платная сборка афиши: одна дверь и свой кошелёк');

$__afm = $__кодбез('scripts/afisha_make.php');
chk('у афиши есть платный ключ --api', mb_strpos($__afm, "'--api'") !== false);
chk('платная дорога зовёт дверь ленты smm_make_image()',
    mb_strpos($__afm, 'smm_make_image(') !== false);
/* СУДИМ ПО РАЗГОВОРУ, А НЕ ПО СЛОВУ. Первая редакция искала слово «apimodels»
   и покраснела на верном коде: оно законно стоит в строке, которую скрипт
   печатает человеку («Рисую через apimodels»). Своя дорога узнаётся по адресу
   службы и по ключу - их у афиши быть не должно (правила 40, 48, 56, 72). */
chk('своего разговора со службой у афиши нет',
    !preg_match('~images/generations|apimodels_key|apimodels_base~ui', $__afm));
chk('у афиши свой суточный предел и свой счётчик',
    mb_strpos($__afm, 'afisha_budget_day') !== false
        && mb_strpos($__afm, 'afisha_rashod_') !== false);
/* РЕФЕРЕНСОВ У АФИШИ НЕТ: знака центра в её промпте не просят, и лишняя
   картинка просится моделью в кадр наклейкой. */
chk('афиша просит генерацию без референсов',
    (bool) preg_match('~smm_make_image\([^;]*,\s*\[\]\s*\)~u', $__afm));

/* ЛЕНТА УСЛОВИЙ БЕЗ СВОИХ КАВЫЧЕК: в промпте строка и так обрамляется
   ёлочками-разделителями, и вторая пара печатается на листе. */
foreach ($__откр as $__c) {
    $__t = afisha_terms($__c);
    chk('«' . (string) ($__c['name'] ?? '') . '»: лента условий без своих кавычек',
        mb_strpos($__t, '«') === false && mb_strpos($__t, '»') === false, $__t);
}

$__smm = $__кодбез('core/smm_make.php');
chk('у двери ленты референсы стали параметром',
    (bool) preg_match('~function smm_make_image\([^{]*\$ссылки~u', $__smm));
chk('пустой список референсов доходит до запроса',
    mb_strpos($__smm, 'array_values($ссылки)') !== false);
/* Поведение поста не изменилось: при null в кадр по-прежнему идёт знак центра. */
chk('у поста знак центра остался первым референсом',
    mb_strpos($__smm, '$портрет !== \'\' ? [$logo, $портрет] : [$logo]') !== false);

/* ─────────── 5. ОЧЕРЕДЬ ОЦЕНКИ КОРОТКИХ: КЛУБ ПЕРВЫМ, ЗА НИМ ПАРТНЁРЫ ───────────
 *
 * Слово владельца 16.10.2026: в «Оценке коротких» заявки Элитного клуба стоят в
 * самом начале, за ними партнёрские, чтобы не пропустить их короткий срок
 * аттестации (3 и 4 рабочих дня против общих 5). Здесь проверяется, что порядок
 * считает ЕДИНЫЙ источник, а не своя копия условий в шаблоне очереди: копия
 * разошлась бы молча, и строка стояла бы первой с плашкой обычного участника
 * (грабля правил 33, 35, 45, 47).
 */
sec('Вес очереди: один источник на срок и на порядок');
chk('клуб это ноль', prioritet_ves(['клуб' => true, 'партнёр' => false]) === 0);
chk('партнёр это единица', prioritet_ves(['клуб' => false, 'партнёр' => true]) === 1);
chk('обычный участник последний', prioritet_ves(['клуб' => false, 'партнёр' => false]) === 2);
/* У человека с обоими признаками срок клубный, он короче (правило 37), значит и
   вес клубный: иначе плашка обещала бы три дня, а очередь ставила его четвёртым. */
chk('клуб и партнёр вместе идут по клубу', prioritet_ves(['клуб' => true, 'партнёр' => true]) === 0);

$__гр = $__кодбез('admin/grading.php');
chk('очередь зовёт единый источник веса',
    (bool) preg_match('~prioritet_ves\(\s*prioritet_zayavki\(~u', $__гр));
/* СВОЕЙ КОПИИ УСЛОВИЙ В ОЧЕРЕДИ БЫТЬ НЕ ДОЛЖНО: ни членства, ни партнёрства
   напрямую. Пояснения сняты лексером, поэтому разбор выше проверку не красит. */
chk('своей копии «кто клуб, кто партнёр» в очереди нет',
    !preg_match('~club_is_active\(|partner_status~u', $__гр));
/* СОРТИРУЮТСЯ ГРУППЫ, А НЕ СТРОКИ: заявки одного участника обязаны идти подряд. */
chk('сортируются группы участников', mb_strpos($__гр, 'usort($orderKeys') !== false);
/* Второй ключ держит прежний порядок внутри одного веса: без него строки одного
   веса перемешивались бы, и «старые → новые» внутри группы ничего не значило. */
chk('внутри одного веса порядок сохраняется', mb_strpos($__гр, '$вес[$k] = [$v, $i]') !== false);
/* ПОДЪЁМ СТОИТ ПОСЛЕ РАЗВОРОТА «НОВЫЕ → СТАРЫЕ», ИНАЧЕ РАЗВОРОТ ОТМЕНЯЕТ ЕГО
   ЦЕЛИКОМ и клуб уезжает в самый хвост. */
$__рев = mb_strpos($__гр, 'array_reverse($orderKeys)');
$__сорт = mb_strpos($__гр, 'usort($orderKeys');
chk('подъём срочных идёт после разворота очереди',
    $__рев !== false && $__сорт !== false && $__сорт > $__рев);
/* ПОДКЛЮЧЕНИЕ НЕ МОЛЧИТ: без него `function_exists` отдал бы ложь, сортировка
   тихо не выполнилась бы, и очередь шла бы по дате без единой красной строки.
   Проверка, которая молча не ловит, хуже отсутствующей (правило 71). */
chk('источник подключается сам, если его ещё нет',
    (bool) preg_match("~require_once BASE_PATH \. '/core/prioritet\.php'~u", $__гр));
/* Оператор обязан видеть, ПОЧЕМУ порядок такой, и сколько срочных ждёт сейчас. */
chk('порядок объяснён словами на странице',
    mb_strpos($__гр, 'В начале очереди всегда стоят заявки участников Элитного клуба') !== false);
chk('число срочных считается тем же весом',
    (bool) preg_match('~\$qКлуб|\$qПарт~u', $__гр)
        && (bool) preg_match('~prioritet_ves\(prioritet_zayavki\(\$__r\)\)~u', $__гр));

/* ─────────── 6. СРОЧНЫЕ ПЕРВЫМИ: БЛАНКИ К ГЕНЕРАЦИИ И ОЧЕРЕДЬ ОТПРАВОК ───────────
 *
 * Слово владельца 16.10.2026 к правилу 73: поднять срочных и в этих двух
 * местах. Вес здесь спрашивается ПО ВИДУ СРОКА: у наградного материала срок
 * изготовления, и у партнёра он общий (правило 47) - значит поднимать партнёра
 * там нельзя, иначе плашка на той же строке скажет обратное.
 */
sec('Вес по виду срока: изготовление и длинный конкурс');
chk('изготовление: клуб срочный', prioritet_ves(['клуб' => true], 'изготовление') === 0);
chk('изготовление: у партнёра срок общий', prioritet_ves(['партнёр' => true], 'изготовление') === 2);
chk('изготовление: клубная подписка это не награда',
    prioritet_ves(['клуб' => true, 'подписка' => true], 'изготовление') === 2);
/* У ДЛИННОГО КОНКУРСА ИТОГИ ОГЛАШАЮТСЯ СПИСКОМ В ОДНУ ДАТУ НА ВСЕХ, короткого
   срока нет ни у клуба, ни у партнёра - поднимать их там некуда. */
chk('аттестация длинного конкурса никого не поднимает',
    prioritet_ves(['клуб' => true, 'длинный' => true]) === 2
        && prioritet_ves(['партнёр' => true, 'длинный' => true]) === 2);
/* Короткий конкурс не задет: лестница та же, что в правиле 73. */
chk('на коротком конкурсе лестница прежняя',
    prioritet_ves(['клуб' => true]) === 0 && prioritet_ves(['партнёр' => true]) === 1
        && prioritet_ves([]) === 2);

$__dip = $__кодбез('admin/diplomas.php');
chk('дипломы к генерации зовут единый источник веса',
    (bool) preg_match("~prioritet_ves\\(prioritet_zayavki\\(\\\$a\\),\\s*'изготовление'\\)~u", $__dip));
/* Второй ключ сортировки держит прежний порядок внутри одного веса: без него
   номера заявок перемешались бы без всякой пользы. */
chk('внутри одного веса порядок бланков сохраняется',
    mb_strpos($__dip, 'usort($пары') !== false
        && mb_strpos($__dip, '[$x[0], $x[1]] <=> [$y[0], $y[1]]') !== false);
chk('число срочных бланков печатается', mb_strpos($__dip, 'сперва срочные') !== false);

$__disp = $__кодбез('admin/dispatch.php');
chk('вид строки очереди считает один помощник',
    mb_strpos($__disp, 'function disp_prioritet(') !== false
        && mb_strpos($__disp, 'function disp_ves(') !== false);
/* ВТОРОЙ КОПИИ РАЗБОРА ВИДА СТРОКИ БЫТЬ НЕ ДОЛЖНО: плашка и порядок обязаны
   думать одинаково, а копии расходятся молча (правила 33, 35, 45, 47). */
chk('второй копии разбора вида строки нет',
    preg_match_all('~prioritet_zakaza\\(~u', $__disp) === 1);
chk('плашка строки берёт тот же помощник',
    mb_strpos($__disp, '[$__пр, $__что] = disp_prioritet($it)') !== false);
/* СРОК ГЛАВНЕЕ ВЕСА, И ПОРЯДОК СРАВНЕНИЙ ЭТО ДЕРЖИТ. Поднять клубную строку над
   письмом, которое просрочено или уходит сегодня, значит задержать то, что
   обязано уйти первым: вес включается ТОЛЬКО при равном сроке. */
$__поз_срок = mb_strpos($__disp, 'if ($ta !== $tb) return $ta <=> $tb;');
$__поз_вес  = mb_strpos($__disp, 'disp_ves($a) <=> disp_ves($b)');
chk('сравнение срока стоит раньше тай-брейка по весу',
    $__поз_срок !== false && $__поз_вес !== false && $__поз_срок < $__поз_вес);
chk('число строк с коротким сроком печатается',
    mb_strpos($__disp, 'с коротким сроком') !== false);

/* ─────────── 7. ЧЕТВЁРКА ПАРТНЁРА - ТОЛЬКО НА АТТЕСТАЦИЮ ───────────
 *
 * Слово владельца 16.10.2026: «Срок 4 дня для партнёров касается только сроков
 * аттестационных результатов, изготовление электронного наградного материала
 * остаётся прежним 5 дней». До этого `_plan_send_at()` считал наградные дипломы
 * по `дней_результат`, то есть давал партнёру четвёртый рабочий день, а плашка в
 * админке на той же заявке говорила «изготовление в общий срок». Расходились
 * молча, и ловить это надо у источника.
 */
sec('Четвёрка партнёра: только аттестация, не изготовление');
$__sd = $__кодбез('cron/send_diplomas.php');
chk('наградные дипломы считаются по сроку изготовления',
    mb_strpos($__sd, "prioritet_zayavki(\$a)['дней_изготовление']") !== false);
/* Срок результата в расчёте ДИПЛОМОВ не должен остаться даже запасным путём:
   именно он и давал партнёру чужую четвёрку. */
chk('срока результата в расчёте дипломов больше нет',
    mb_strpos($__sd, 'дней_результат') === false);
/* ЛЕСТНИЦА АТТЕСТАЦИИ НЕ ТРОНУТА, И ЭТО ПРОВЕРЯЕТСЯ ОТДЕЛЬНО: четвёрка партнёра
   живёт там, и «выровнять» её под изготовление нельзя. */
$__ga = $__кодбез('core/grade_apply.php');
chk('аттестация по-прежнему берёт срок результата',
    mb_strpos($__ga, "['дней_результат']") !== false);
$__df = $__кодбез('scripts/diploma_sched_fix.php');
chk('у починщика сроков своей лестницы нет',
    !preg_match('~partner_priority_days~u', $__df) && !preg_match('~\?\s*3\s*:\s*5~u', $__df));
chk('починщик сроков зовёт единый источник',
    mb_strpos($__df, "['дней_изготовление']") !== false);

/* ОБЕЩАНИЕ РАВНО ТОМУ, ЧТО ИСПОЛНЯЕТ КОД. Судим ПО ПРЕДЛОЖЕНИЮ со словами «4
   рабочих»: клубная строка «Результаты и дипломы за 3 дня» законна и живёт в том
   же файле, поэтому поиск по всему тексту покраснел бы на верной фразе. */
$__нельзя = static function (string $txt): array {
    $о = [];
    foreach (preg_split('~[\n.;]~u', $txt) as $__s) {
        if (mb_stripos($__s, '4 рабочих') === false) continue;
        if (mb_stripos($__s, 'диплом') !== false) $о[] = trim(mb_substr(trim($__s), 0, 70));
    }
    return $о;
};
foreach (['core/letter_texts.php', 'core/vk_outreach.php', 'scripts/vk_posts_offers.php'] as $__f) {
    $__плохо = $__нельзя($__кодбез($__f));
    chk($__f . ': четвёрка не обещает дипломы', $__плохо === [], implode(' | ', $__плохо));
}
/* ФАКТ по живой ротации: по чужим сообществам каждый день уходит именно эта
   запись, и в ней обещание тоже обязано быть верным. */
$__s5 = (string) (scalar("SELECT text FROM vk_posts WHERE slot=5") ?? '');
if ($__s5 === '') { bad('слот 5 ротации пуст'); }
else {
    $__плохо5 = $__нельзя($__s5);
    chk('запись ротации про партнёрство не обещает дипломы за 4 дня',
        $__плохо5 === [], implode(' | ', $__плохо5));
}
/* СПРАВКА, А НЕ ЗЕЛЁНОЕ НА ПУСТОМ МЕСТЕ: сколько незакрытых дипломов сейчас
   стоит за партнёрскими заявками. Ноль значит, что прежняя четвёрка не успела
   уйти ни к одному человеку. */
$__партД = 0;
foreach (all("SELECT a.id, a.user_id, a.institution_id, a.competition_id
                FROM diplomas d JOIN applications a ON a.id=d.application_id
               WHERE COALESCE(d.sent_at,'')='' AND COALESCE(d.scheduled_at,'')<>''") as $__a) {
    $__p = prioritet_zayavki($__a);
    if (!empty($__p['партнёр']) && empty($__p['клуб'])) $__партД++;
}
echo '  --   незакрытых дипломов по партнёрским заявкам: ' . $__партД
     . ($__партД === 0 ? ' (прежняя четвёрка никому не ушла)' : ' - сроки пересчитает ночной прогон') . "\n";

/* ─────────── СРОК АТТЕСТАЦИИ В ПОЛОЖЕНИИ РАВЕН СРОКУ В КОДЕ ───────────
   Правка владельца 16.10.2026: «В положении конкурса Мировой акцент срок
   аттестации написан 5 дней вместо 3». Эталон платного конкурса один на все
   платные конкурсы, а срок у них разный, поэтому число подставляет сама
   перегенерация (правило 72а про пункт 8.12 - та же механика). */
sec('Срок аттестации: положение, шаблоны ВК и ключ PDF');
require_once BASE_PATH . '/core/chat_regulation.php';   // reg_docx_text
require_once BASE_PATH . '/core/club_free.php';

/* ПОЯСНЕНИЯ СНИМАЕМ ЛЕКСЕРОМ, А НЕ РЕГУЛЯРКОЙ: в них снятое названо нарочно,
   и поиск по сырому файлу краснел бы на нашем же разборе (правила 63, 70). */
$__бкод = static function (string $path): string {
    $src = (string) @file_get_contents($path);
    $out = '';
    foreach (token_get_all($src) as $t) {
        if (is_array($t)) { if ($t[0] === T_COMMENT || $t[0] === T_DOC_COMMENT) continue; $out .= $t[1]; }
        else $out .= $t;
    }
    return $out;
};
/* ТЕЛО ОДНОЙ ФУНКЦИИ. Поиск по всему файлу судил бы соседей: рядом лежат
   предложения с теми же словами, и «числа не вписаны» сходилось бы вслепую. */
$__тело = static function (string $src, string $fn): string {
    $p = strpos($src, 'function ' . $fn . '(');
    if ($p === false) return '';
    $q = strpos($src, "\n}", $p);
    return $q === false ? substr($src, $p) : substr($src, $p, $q - $p);
};
$__ген = $__бкод(BASE_PATH . '/core/regulation_gen.php');
$__вк  = $__бкод(BASE_PATH . '/core/vk_templates.php');
$__пдф = $__бкод(BASE_PATH . '/core/regulation_pdf.php');

chk('перегенерация положения берёт срок у единого источника',
    strpos($__ген, 'prioritet_dnei_konkursa($c)') !== false);
/* ПРЕДЛОЖЕНИЕ О РЕЗУЛЬТАТАХ СОБИРАЕТСЯ В ОДНОМ МЕСТЕ. Вторая сборка той же фразы
   разошлась бы молча - этим куплены правила 33, 35, 45, 47, 73в. */
chk('способ и срок рассылки собирает один помощник',
    strpos($__ген, 'function reg_fraza_rezultatov') !== false
    && substr_count($__ген, 'отправляется каждому участнику в течение') === 1);
chk('перегенерация зовёт помощника, а не пишет фразу своей строкой',
    strpos($__ген, 'reg_fraza_rezultatov($c,') !== false
    && strpos($__ген, 'reg_para_set_text($xml, $__игла') !== false);
/* ПОДСТАНОВКА ОБЯЗАНА СТОЯТЬ ДО ЗАПИСИ ФАЙЛА: после addFromString правка уже
   никуда не попадёт, а проверка «вызов где-то есть» этого не ловит. */
$__поз1 = strpos($__ген, 'reg_fraza_rezultatov($c,');
$__поз2 = strpos($__ген, "addFromString('word/document.xml', \$xml)");
$__поз3 = strpos($__ген, 'REG_SROK_NEEDLE;');
chk('подстановка способа и срока стоит до записи документа',
    $__поз1 !== false && $__поз2 !== false && $__поз1 < $__поз2);
chk('игла берётся по документу, а не перебором',
    $__поз3 !== false && $__поз3 < $__поз2);
/* У ПИСЬМА АБЗАЦ ПРО СТРАНИЦУ СООБЩЕСТВА СНИМАЕТСЯ: обещать оба способа сразу
   документ не вправе (правка владельца 16.10.2026). */
chk('у письма абзац про страницу сообщества снимается',
    preg_match('~if\s*\(!\$списком\s*&&\s*\$естьВК\)\s*\$xml\s*=\s*reg_para_set_text\(\$xml,\s*REG_REZ_NEEDLE_VK,\s*\'\'~u', $__ген) === 1);
/* ДАТА ОГЛАШЕНИЯ - ТОЛЬКО СВОЯ. Откат на `end_date` назначал оглашение на
   последний день приёма: так «25.10.2026» попало в два положения. */
chk('дата оглашения не откатывается на дату приёма',
    preg_match('~\$resDate\s*=\s*\$fmt\(\$c\[.results_date.\]\s*\?\?\s*null\);~u', $__ген) === 1);
chk('у конкурса с оглашением списком число днями не подставляется',
    strpos($__ген, 'в дату оглашения итогов') !== false);
/* ЭТАЛОНЫ РУКАМИ НЕ ПРАВИМ: каждый один на все свои конкурсы (урок правила 72а). */
$__эт2 = reg_docx_text(BASE_PATH . '/docs/polozheniya/etalon_2.docx');
chk('в эталоне платного конкурса срок остался общим',
    mb_strpos($__эт2, 'Аттестационный результат отправляется') !== false
    && preg_match('~Аттестационный результат отправляется[^.]*в течение 5 рабочих дней~u', $__эт2) === 1);
foreach (['etalon_4', 'etalon_5'] as $__им) {
    $__эт = reg_docx_text(BASE_PATH . '/docs/polozheniya/' . $__им . '.docx');
    chk('в эталоне ' . $__им . ' преамбула осталась про публикацию списком',
        mb_strpos($__эт, 'результаты будут опубликованы') !== false
        && mb_strpos($__эт, 'на официальной странице сообщества ВКонтакте') !== false);
}

/* ФАКТ ПО ЖИВЫМ ПОЛОЖЕНИЯМ: способ рассылки обязан совпасть с `results_mode`, а
   число рабочих дней - со счётом кода. Одного исходника мало: подстановка может
   не найти абзаца и промолчать (правило 71). */
foreach (all("SELECT * FROM competitions WHERE launched=1 AND status='open' ORDER BY id") as $__c) {
    $__путь = (string) ($__c['regulation_pdf'] ?? '');
    $__имя  = '#' . (int) $__c['id'] . ' ' . mb_substr((string) $__c['name'], 0, 24);
    if ($__путь === '' || !is_file($__путь)) { ok($__имя . ': файла положения нет, проверять нечего'); continue; }
    $__т     = reg_docx_text($__путь);
    $__спис  = (string) ($__c['results_mode'] ?? '') === 'list';
    $__датаР = trim((string) ($__c['results_date'] ?? '')) !== ''
        ? date('d.m.Y', strtotime((string) $__c['results_date'])) : '';
    $__естьПуб = preg_match('~результаты будут опубликованы[^\n]*~u', $__т, $__мп) === 1 ? $__мп[0] : '';
    $__естьПис = preg_match('~Аттестационный результат отправляется[^.]*\.~u', $__т, $__мм) === 1 ? $__мм[0] : '';
    $__естьВК  = mb_strpos($__т, 'на официальной странице сообщества ВКонтакте') !== false;
    if ($__спис) {
        chk($__имя . ': положение обещает публикацию списком', $__естьПуб !== '' && $__естьПис === '',
            mb_substr($__естьПуб . $__естьПис, 0, 120));
        chk($__имя . ': названа страница сообщества', $__естьВК);
        chk($__имя . ': в дате оглашения стоит дата конкурса, а не день приёма',
            $__датаР === '' ? mb_strpos($__естьПуб, 'в дату оглашения итогов') !== false
                            : mb_strpos($__естьПуб, $__датаР) !== false,
            'в документе «' . mb_substr($__естьПуб, 0, 90) . '», у конкурса ' . ($__датаР ?: 'даты нет'));
        chk($__имя . ': у длинного конкурса в положении нет счёта рабочих дней',
            preg_match('~\d+\s*рабочих дн~u', $__естьПуб) === 0);
    } else {
        chk($__имя . ': положение обещает письмо на почту из заявки',
            $__естьПис !== '' && $__естьПуб === '' && !$__естьВК,
            'письмо ' . ($__естьПис !== '' ? 'есть' : 'НЕТ') . ', публикация '
            . ($__естьПуб !== '' ? 'ОСТАЛАСЬ: ' . mb_substr($__естьПуб, 0, 80) : 'нет')
            . ', страница сообщества ' . ($__естьВК ? 'ОСТАЛАСЬ' : 'нет'));
        $__надо = (int) prioritet_dnei_konkursa($__c);
        $__было = preg_match('~в течение (\d+) рабочих дн~u', $__естьПис, $__ч) ? (int) $__ч[1] : 0;
        chk($__имя . ': в положении напечатан срок из кода', $__было === $__надо,
            'в документе ' . $__было . ', по коду ' . $__надо);
        chk($__имя . ': у срока названо начало счёта',
            mb_strpos($__естьПис, 'с даты подачи заявки') !== false, mb_substr($__естьПис, 0, 120));
    }
}

/* ВИТРИНА ДУМАЕТ КАК ДОКУМЕНТ. Способ оглашения на страницах центра собирает
   `comp_terms()`, и судить он обязан по тому же `results_mode`: поставь владелец
   дату оглашения конкурсу с рассылкой письмами, и положение обещало бы письмо,
   а страница публикацию - молча (правило 73ж). */
$__кд = $__бкод(BASE_PATH . '/core/countdown.php');
chk('comp_terms судит способ по results_mode',
    preg_match('~\$__режим\s*=\s*\(string\)\s*\(\$c\[.results_mode.\]~u', $__кд) === 1
    && strpos($__кд, "\$__режим === 'list'") !== false);
chk('у оглашения списком без даты витрина не обещает письмо',
    strpos($__кд, 'в дату оглашения итогов, объявленную оргкомитетом,') !== false);
$__плохоСп = [];
foreach (all("SELECT * FROM competitions WHERE launched=1 AND status='open' ORDER BY id") as $__c) {
    $__т2 = comp_terms($__c);
    $__сп = (string) ($__c['results_mode'] ?? '') === 'list';
    if (!empty($__т2['is_long']) !== $__сп) {
        $__плохоСп[] = '#' . (int) $__c['id'] . ': режим ' . (string) ($__c['results_mode'] ?? '')
                     . ', витрина говорит «' . mb_substr((string) $__т2['results'], 0, 60) . '»';
    }
}
chk('на витрине способ оглашения равен режиму конкурса', $__плохоСп === [], implode(' | ', $__плохоСп));
/* ОБЕЩАНИЕ ПУБЛИКАЦИИ НЕ ВПИСАНО СТРОКОЙ НИ В ОДИН ШАБЛОН: у бесплатного участия
   так обещали публикацию ВСЕМ, включая конкурсы с рассылкой письмами. */
$__плохоШ = [];
foreach (glob(BASE_PATH . '/templates/site/pages/*.php') as $__ф) {
    if (preg_match('~результаты публикуются на официальной странице~u', $__бкод($__ф))) {
        $__плохоШ[] = basename($__ф);
    }
}
chk('в шаблонах сайта публикация не обещана строкой', $__плохоШ === [], implode(', ', $__плохоШ));

/* ─── СРОК ИЗГОТОВЛЕНИЯ: КЛУБУ 3, ОСТАЛЬНЫМ 5, ОРИГИНАЛЫ ВСЕМ ОДИНАКОВО ───
   Слово владельца 16.10.2026 (правило 73з). Числа живут в одном месте, фразы
   собираются из них, и ни одна поверхность не вписывает их копией: такая копия
   ломается ровно в день правки (правила 56, 61), а разошедшееся обещание
   человек читает как обман центра (правила 33, 35, 45, 46). */
sec('Срок изготовления наград: клуб 3, остальные 5, оригиналы всем одинаково');
chk('срок оригиналов задан константой и равен 7',
    defined('PRIORITET_SROK_ORIGINALA') && PRIORITET_SROK_ORIGINALA === 7,
    (string) (defined('PRIORITET_SROK_ORIGINALA') ? PRIORITET_SROK_ORIGINALA : 0));
chk('фразы изготовления собирает единый источник',
    function_exists('prioritet_fraza_elektronnyh') && function_exists('prioritet_fraza_originalov')
    && function_exists('prioritet_fraza_izgotovleniya'));
$__фэ = function_exists('prioritet_fraza_elektronnyh') ? prioritet_fraza_elektronnyh() : '';
$__фо = function_exists('prioritet_fraza_originalov') ? prioritet_fraza_originalov() : '';
chk('фраза об электронных называет оба срока',
    mb_strpos($__фэ, (string) PRIORITET_SROK_OBSHIY) !== false
    && mb_strpos($__фэ, (string) PRIORITET_SROK_KLUBA) !== false
    && mb_strpos($__фэ, 'Элитного клуба') !== false, $__фэ);
/* У ОРИГИНАЛОВ КЛУБНОГО СРОКА НЕТ, И ЭТО ПРОВЕРЯЕТСЯ ОТРИЦАНИЕМ: его легко
   «дописать заодно» следующей правкой, а это обещание, которого центр не давал. */
chk('фраза об оригиналах не обещает клубу короткий срок',
    mb_strpos($__фо, 'одинаковый для всех') !== false && mb_strpos($__фо, 'Элитного клуба') === false, $__фо);
chk('автомат выдачи по заказу считает срок изготовления единым источником',
    strpos($__бкод(BASE_PATH . '/core/orders.php'), "\$пр['дней_изготовление']") !== false);
/* ПОЛОЖЕНИЕ. Абзац собирается кодом, абзац про ОРИГИНАЛЫ не трогается вовсе. */
chk('перегенерация собирает срок изготовления помощником',
    strpos($__ген, 'function reg_fraza_izgotovleniya') !== false
    && strpos($__ген, 'reg_fraza_izgotovleniya($c)') !== false);
$__позИ = strpos($__ген, 'reg_fraza_izgotovleniya($c)');
chk('подстановка срока изготовления стоит до записи документа',
    $__позИ !== false && $__поз2 !== false && $__позИ < $__поз2);
chk('абзац про оригиналы перегенерация не трогает',
    strpos($__ген, 'Оригиналы наградного материала') === false);
/* ПОВЕРХНОСТИ: витрина наград, страница Клуба, список привилегий, кабинет. */
$__сог = $__бкод(BASE_PATH . '/templates/site/pages/awards.php');
chk('согласие на витрине берёт сроки у единого источника',
    strpos($__сог, 'prioritet_fraza_izgotovleniya()') !== false);
$__клб = $__бкод(BASE_PATH . '/templates/site/pages/club.php');
chk('страница Клуба называет вид наград и срок оригиналов',
    strpos($__клб, 'электронные награды') !== false
    && strpos($__клб, 'Изготовление электронных наград') !== false
    && strpos($__клб, 'Оригиналы на бланках и изделия') !== false);
chk('страница Клуба не вписывает числа сроков',
    preg_match('~\x27(3 дня|5 рабочих дней|3 рабочих дня)\x27~u', $__клб) === 0);
$__пер = $__бкод(BASE_PATH . '/core/club_perks.php');
chk('привилегия Клуба обещает и изготовление электронных наград',
    mb_strpos($__пер, 'электронные наградные материалы') !== false
    && mb_strpos($__пер, 'оригиналы на бланках') !== false);
$__каб = $__бкод(BASE_PATH . '/templates/site/pages/cabinet.php');
chk('в кабинете нет снятого обещания про бесплатный конкурс каждый месяц',
    mb_strpos($__каб, 'бесплатный конкурс каждый месяц') === false);
/* ФАКТ ПО ЖИВЫМ ПОЛОЖЕНИЯМ. */
foreach (all("SELECT * FROM competitions WHERE launched=1 AND status='open' ORDER BY id") as $__c) {
    $__путь = (string) ($__c['regulation_pdf'] ?? '');
    $__имя  = '#' . (int) $__c['id'] . ' ' . mb_substr((string) $__c['name'], 0, 24);
    if ($__путь === '' || !is_file($__путь)) { ok($__имя . ': файла положения нет, проверять нечего'); continue; }
    $__т = reg_docx_text($__путь);
    /* ИГЛА ИДЁТ ЗА ФОРМУЛИРОВКОЙ, А НЕ ЗА ПАМЯТЬЮ О НЕЙ. Слово владельца
       16.10.2026 назвало в абзаце электронный вид прямо, и абзац больше не
       начинается словами «Наградной материал согласно»: мерка, которая ждёт
       вчерашнее написание, краснеет ровно в день правки (правила 56, 61, 72). */
    $__эл = preg_match('~Электронные дипломы и другой наградной материал[^.]*\.~u', $__т, $__м1) === 1 ? $__м1[0] : '';
    $__ор = preg_match('~Оригиналы наградного материала[^.]*\.~u', $__т, $__м2) === 1 ? $__м2[0] : '';
    $__баз = (int) prioritet_dnei_konkursa($__c);
    chk($__имя . ': в положении срок изготовления электронных равен сроку конкурса',
        $__эл !== '' && preg_match('~в течение ' . $__баз . ' ~u', $__эл) === 1, mb_substr($__эл, 0, 150));
    if ($__баз === PRIORITET_SROK_KLUBA) {
        /* ПУСТАЯ СТРОКА НЕ ДОКАЗЫВАЕТ ОТСУТСТВИЕ ОГОВОРКИ: без первого условия
           проверка зеленела бы на НЕНАЙДЕННОМ абзаце (урок правила 71). */
        chk($__имя . ': у конкурса только для Клуба оговорка не нужна',
            $__эл !== '' && mb_strpos($__эл, 'Элитного клуба') === false, mb_substr($__эл, 0, 150));
    } else {
        chk($__имя . ': в положении назван клубный срок изготовления',
            mb_strpos($__эл, 'Элитного клуба') !== false
            && preg_match('~Элитного клуба в течение ' . PRIORITET_SROK_KLUBA . ' ~u', $__эл) === 1,
            mb_substr($__эл, 0, 170));
    }
    chk($__имя . ': срок оригиналов общий и без клубной оговорки',
        $__ор !== '' && preg_match('~в течение ' . PRIORITET_SROK_ORIGINALA . ' ~u', $__ор) === 1
        && mb_strpos($__ор, 'Элитного клуба') === false, mb_substr($__ор, 0, 120));
    chk($__имя . ': в положении адрес обращений центра, а не почта на mail.ru',
        mb_strpos($__т, 'mail.ru') === false && mb_stripos($__т, 'kc@') !== false);
}
/* ЭТАЛОНЫ: адрес заменён во всех трёх, иначе первая же перегенерация вернёт
   прежний и молча (урок правила 51). */
foreach (['etalon_2', 'etalon_4', 'etalon_5'] as $__им) {
    $__эт = reg_docx_text(BASE_PATH . '/docs/polozheniya/' . $__им . '.docx');
    chk('в эталоне ' . $__им . ' стоит адрес обращений центра',
        mb_strpos($__эт, 'mail.ru') === false && mb_stripos($__эт, 'kc@') !== false);
}

/* ШАБЛОНЫ ВК. Вписанное число устаревает молча: пост о конкурсе уходит по чужим
   сообществам каждый день (правила 50, 72г). */
chk('шаблоны ВК берут срок у единого источника',
    strpos($__вк, 'prioritet_dnei_konkursa') !== false
    && strpos($__вк, 'function vkt_srok_korotkih') !== false);
chk('в шаблонах ВК нет вписанного числом срока аттестации',
    preg_match('~(приходят|результаты)[^;]{0,120}в течение 5 рабочих дн~u', $__вк) === 0);
require_once BASE_PATH . '/core/vk_templates.php';
$__плохоВК = [];
foreach (all("SELECT * FROM competitions WHERE launched=1 AND status='open'") as $__c) {
    if (vkt_is_long($__c)) continue;
    $__надо = (int) prioritet_dnei_konkursa($__c);
    $__пост = vkt_launch($__c);
    if (!preg_match('~Результаты конкурса приходят[^.]*\.~u', $__пост, $__м)) { $__плохоВК[] = '#' . $__c['id'] . ' строки нет'; continue; }
    if (!preg_match('~в течение (\d+) рабочих дн~u', $__м[0], $__ч) || (int) $__ч[1] !== $__надо) {
        $__плохоВК[] = '#' . $__c['id'] . ': ' . mb_substr($__м[0], 0, 90) . ' (по коду ' . $__надо . ')';
    }
}
chk('пост о конкурсе называет его собственный срок', $__плохоВК === [], implode(' | ', $__плохоВК));
/* СВОДНЫЙ ПОСТ: одно число можно назвать, только когда оно у всех коротких одно. */
$__разные = all("SELECT * FROM competitions WHERE launched=1 AND status='open'");
$__своды = vkt_srok_korotkih($__разные);
chk('в сводном посте при разных сроках числа нет',
    mb_strpos($__своды, 'на странице каждого конкурса') !== false
    || count(array_unique(array_map(static fn($x) => (int) prioritet_dnei_konkursa($x),
            array_filter($__разные, static fn($x) => !vkt_is_long($x))))) === 1,
    $__своды);

chk('ключ PDF видит срок и режим оглашения',
    strpos($__пдф, "'srok:'") !== false && strpos($__пдф, "'rezhim:'") !== false);
/* ПРАВКА КОДА МЕНЯЕТ ТЕКСТ ДОКУМЕНТА, НЕ ТРОГАЯ НИ ОДНОГО ПОЛЯ КОНКУРСА - без
   отпечатка самого DOCX человек скачивал бы PDF с прежней формулировкой. */
chk('ключ PDF видит сам документ', strpos($__пдф, "'docx:'") !== false);

sec('Срок изготовления электронных дипломов назван в положении ДВУМЯ абзацами');
/* Слово владельца 16.10.2026: «Пропиши в нужном месте во всех положениях что:
   Изготовление электронных дипломов 5 рабочих дней. Для членов элитного клуба -
   3 рабочих дня.» Мест в положении ДВА: абзац раздела «СРОКИ ИЗГОТОВЛЕНИЯ И
   НАПРАВЛЕНИЯ НАГРАДНОГО МАТЕРИАЛА» и строка перечня «что входит в оргвзнос»
   (она есть только в платном эталоне). Второй был вписан числом, клубного срока
   не знал вовсе и у «Мирового акцента» спорил с первым: 5 против 3 в ОДНОМ
   документе. Теперь оба собирает код и одни числа. */
/* Константы и помощники спрашиваем У КОДА, а не по исходнику: `defined()` и
   `function_exists()` отвечают по факту, а строка в файле бывает и в пояснении. */
require_once BASE_PATH . '/core/regulation_gen.php';
chk('у абзаца перечня своя игла', defined('REG_RASS_NEEDLE')
    && REG_RASS_NEEDLE === 'Рассылка наградного материала осуществляется');
chk('числа и слова срока считает ОДИН помощник',
    function_exists('reg_sroki_izgotovleniya')
    && strpos($__ген, 'function reg_sroki_izgotovleniya') !== false);
/* Оба предложения обязаны звать помощника, а не считать числа заново: своя
   копия разошлась бы молча (правила 33, 35, 45, 47, 56а, 64, 73). */
$__тИзг  = $__тело($__ген, 'reg_fraza_izgotovleniya');
$__тРасс = $__тело($__ген, 'reg_fraza_rassylki');
chk('предложение о сроках зовёт помощника, а своих чисел не считает',
    strpos($__тИзг, 'reg_sroki_izgotovleniya($c)') !== false
    && strpos($__тИзг, 'PRIORITET_SROK') === false
    && strpos($__тИзг, 'prioritet_dnei_konkursa') === false,
    (string) preg_replace('~\s+~u', ' ', mb_substr($__тИзг, 0, 90)));
chk('строка перечня зовёт того же помощника и своих чисел не считает',
    strpos($__тРасс, 'reg_sroki_izgotovleniya($c)') !== false
    && strpos($__тРасс, 'PRIORITET_SROK') === false
    && strpos($__тРасс, 'prioritet_dnei_konkursa') === false,
    (string) preg_replace('~\s+~u', ' ', mb_substr($__тРасс, 0, 90)));
chk('ни в одном предложении срок не вписан числом',
    preg_match('~в течение 5 рабочих дн~u', $__тИзг . $__тРасс) === 0);
/* НАЧАЛО СЧЁТА У ПЕРЕЧНЯ ДРУГОЕ, И ПОДМЕНЯТЬ ЕГО НЕЛЬЗЯ: электронные дипломы,
   входящие в оргвзнос, считаются от получения аттестационного результата, а не
   от оплаты заказа (правило 37). */
chk('у строки перечня сохранено своё начало счёта',
    mb_strpos($__тРасс, 'с момента получения аттестационного') !== false);
chk('перегенерация спрашивает про абзац перечня У ДОКУМЕНТА',
    strpos($__ген, 'reg_para_naidi($xml, REG_RASS_NEEDLE)') !== false
    && strpos($__ген, 'reg_para_set_text($xml, REG_RASS_NEEDLE, reg_fraza_rassylki($c)') !== false);
$__позР = strpos($__ген, 'reg_fraza_rassylki($c)');
chk('подстановка перечня стоит до записи документа',
    $__позР !== false && $__поз2 !== false && $__позР < $__поз2);
/* ЭТАЛОН РУКАМИ НЕ ПРАВЛЕН: он один на все свои конкурсы, а срок у них разный
   (урок правил 51 и 72а). В платном эталоне обе строки обязаны остаться
   общими, иначе правка живёт в документе, а не в перегенерации. */
$__эт2 = reg_docx_text(BASE_PATH . '/docs/polozheniya/etalon_2.docx');
chk('в эталоне платного конкурса строка перечня осталась общей',
    preg_match('~Рассылка наградного материала осуществляется[^.]*\.~u', $__эт2, $__мэ) === 1
    && mb_strpos($__мэ[0], 'Элитного клуба') === false, mb_substr($__мэ[0] ?? '', 0, 140));

/* ФАКТ ПО ЖИВЫМ ПОЛОЖЕНИЯМ. */
foreach (all("SELECT * FROM competitions WHERE launched=1 AND status='open' ORDER BY id") as $__c) {
    $__путь = (string) ($__c['regulation_pdf'] ?? '');
    $__имя  = '#' . (int) $__c['id'] . ' ' . mb_substr((string) $__c['name'], 0, 24);
    if ($__путь === '' || !is_file($__путь)) { ok($__имя . ': файла положения нет, проверять нечего'); continue; }
    $__т  = reg_docx_text($__путь);
    $__баз = (int) prioritet_dnei_konkursa($__c);
    /* Первый абзац обязан называть электронный вид ПРЯМО: прежняя формулировка
       говорила «Наградной материал», и срок читался как общий на всё, включая
       оригиналы на бланках. */
    chk($__имя . ': срок назван именно для электронных дипломов',
        preg_match('~Электронные дипломы и другой наградной материал в электронном виде~u', $__т) === 1);
    if (preg_match('~Рассылка наградного материала осуществляется[^.]*\.~u', $__т, $__мр) !== 1) {
        ok($__имя . ': перечня оргвзноса в положении нет, проверять нечего');
        continue;
    }
    chk($__имя . ': в перечне оргвзноса срок равен сроку конкурса',
        preg_match('~в течение ' . $__баз . ' ~u', $__мр[0]) === 1
        && preg_match('~в течение (?!' . $__баз . ' )\d+ рабочих дней с момента~u', $__мр[0]) === 0,
        mb_substr($__мр[0], 0, 180) . ' (по коду ' . $__баз . ')');
    if ($__баз === PRIORITET_SROK_KLUBA) {
        chk($__имя . ': в перечне у конкурса только для Клуба оговорка не нужна',
            mb_strpos($__мр[0], 'Элитного клуба') === false, mb_substr($__мр[0], 0, 180));
    } else {
        chk($__имя . ': в перечне назван клубный срок',
            preg_match('~Элитного клуба в течение ' . PRIORITET_SROK_KLUBA . ' ~u', $__мр[0]) === 1,
            mb_substr($__мр[0], 0, 180));
    }
}

/* ЧЕТВЁРКА ПАРТНЁРА К ИЗГОТОВЛЕНИЮ НЕ ОТНОСИТСЯ - слово владельца 16.10.2026.
   Проверяется счётом по ЖИВЫМ партнёрским заявкам, а не по исходнику: именно
   здесь обещание и расходилось бы с плашкой. */
$__плохоП = [];
foreach (all("SELECT a.id, a.user_id, a.institution_id, a.competition_id
                FROM applications a WHERE a.institution_id > 0 ORDER BY a.id DESC LIMIT 40") as $__a) {
    $__п = prioritet_zayavki($__a);
    if (empty($__п['партнёр']) || !empty($__п['клуб'])) continue;
    if ((int) $__п['дней_изготовление'] !== PRIORITET_SROK_OBSHIY) {
        $__плохоП[] = '#' . $__a['id'] . ' изготовление ' . $__п['дней_изготовление'];
    }
    if (prioritet_ves($__п, 'изготовление') !== 2) {
        $__плохоП[] = '#' . $__a['id'] . ' вес ' . prioritet_ves($__п, 'изготовление');
    }
}
chk('у партнёрских заявок срок изготовления общий, и в очередь наград они не поднимаются',
    $__плохоП === [], implode(' | ', $__плохоП));

/* ═════ ПЛАШКА ПЕРЕНОСИТСЯ ПО СЛОВАМ ═════
 *
 * Слово владельца 18.10.2026. `white-space:nowrap` держал плашку одной
 * строкой, и самая длинная («Партнёр: … · срок по клубу, он короче», 81 знак)
 * растягивала колонку «От кого» до 604 точек: таблица заявок выходила на 1474
 * точки в обёртке 1037, и три колонки справа приходилось доставать прокруткой
 * вбок (правило 75). После снятия - 1044 и 175.
 *
 * Запрет стоит ОТРИЦАНИЕМ: одна строка возвращается следующей правкой вслепую,
 * а ширину таблицы ни одна мерка на сервере не видит - её видно только глазом
 * в браузере, поэтому держит это место именно проверка исходника. */
sec('Плашка приоритета переносится по словам');
$__прСрц = '';
foreach (token_get_all((string) @file_get_contents(BASE_PATH . '/core/prioritet.php')) as $__t) {
    if (is_array($__t) && in_array($__t[0], [T_COMMENT, T_DOC_COMMENT], true)) continue;
    $__прСрц .= is_array($__t) ? $__t[1] : $__t;
}
/* Пояснения снимаются лексером: в них снятое названо нарочно, и поиск по сырому
   файлу краснел бы на нашем же разборе (правила 40, 48, 63). */
chk('в prioritet_chip() переноса не запрещают',
    $__прСрц !== '' && !str_contains($__прСрц, 'white-space:nowrap'));
$__чип = prioritet_chip('Партнёр: Центр развития молодежи «ART.Платформа» · срок по клубу, он короче', '#1E7A46');
chk('ФАКТ: собранная плашка не несёт запрета переноса',
    $__чип !== '' && !str_contains($__чип, 'white-space'), mb_substr(strip_tags($__чип), 0, 40) . '…');

/* ---------------------------------------------------------------------------
 * СРОК НА ВИТРИНЕ: НЕПОЛНЫЙ SELECT НЕ ИМЕЕТ ПРАВА ПРЯТАТЬ ПРИЗНАК КЛУБА.
 *
 * Страница «Положения конкурсов» брала конкурс перечнем колонок без
 * `club_entry_only`, и `comp_terms()` обещала по «Мировому акценту» 5 рабочих
 * дней вместо 3 (слово владельца 18.10.2026). Беда не страницы, а ответа
 * вслепую: таких перечней в проекте много (урок правил 47, 72в).
 * ------------------------------------------------------------------------- */
sec('Срок на витрине: неполная строка конкурса не прячет признак Клуба');

$__идущие = all("SELECT * FROM competitions
                  WHERE COALESCE(launched,0)=1 AND status='open'
                    AND date('now','localtime') BETWEEN date(start_date) AND date(end_date)
               ORDER BY id");
$__расх = [];
foreach ($__идущие as $__c) {
    $__куц = one("SELECT id, slug, name, type, is_paid, price, status, start_date,
                         end_date, results_date, results_mode, duration
                    FROM competitions WHERE id = ?", [(int) $__c['id']]);
    $__a = (string) (comp_terms($__c)['results'] ?? '');
    $__b = (string) (comp_terms((array) $__куц)['results'] ?? '');
    if ($__a !== $__b) $__расх[] = $__c['name'] . ': «' . $__b . '» вместо «' . $__a . '»';
}
chk('неполная строка даёт тот же срок, что полная', $__расх === [], implode('; ', $__расх));

/* Колонка в строке ЕСТЬ - значит это ответ, и второго запроса быть не должно:
   иначе признак, снятый владельцем, возвращался бы из базы задним числом. */
chk('колонка со значением перебивает базу',
    function_exists('club_vhod_tolko_chlenam')
    && !club_vhod_tolko_chlenam(['id' => 32, 'club_entry_only' => 0, 'club_only' => 0])
    && club_vhod_tolko_chlenam(['id' => 0, 'club_entry_only' => 1]));

$__рег = (string) @file_get_contents(BASE_PATH . '/templates/site/pages/regulations.php');
chk('запрос страницы положений берёт признак сам',
    mb_strpos($__рег, 'club_entry_only') !== false && mb_strpos($__рег, 'club_only') !== false);

/* ФАКТ ПО ЖИВЫМ СТРАНИЦАМ: рядом с названием конкурса стоит ЕГО срок.
   Страницы публичные, вход не нужен - счётчик попыток админки не тратится. */
$__тянуть = static function (string $путь): string {
    $ch = curl_init('https://' . PR_HOST . $путь);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true, CURLOPT_SSL_VERIFYPEER => false,
        CURLOPT_SSL_VERIFYHOST => 0, CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_RESOLVE => [PR_HOST . ':443:127.0.0.1'], CURLOPT_TIMEOUT => 60,
        CURLOPT_PROXY => '',
    ]);
    $b = (string) curl_exec($ch);
    $c = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    return $c === 200 ? $b : '';
};
foreach (['/', '/regulations', '/competitions', '/apply', '/calendar'] as $__путь) {
    $__html = $__тянуть($__путь);
    if ($__html === '') { bad('страница ' . $__путь . ' не открылась'); continue; }
    $__гол = preg_replace('~<[^>]+>~u', "\x01", $__html);
    /* Берём отрезок ОТ названия конкурса ДО следующего названия: искать «срок
       рядом» окном в N знаков значит ловить чужой конкурс (урок правила 72). */
    $__точки = [];
    foreach ($__идущие as $__c) {
        foreach (['/' . preg_quote((string) $__c['name'], '/') . '/u'] as $__re) {
            if (preg_match_all($__re, (string) $__гол, $__m, PREG_OFFSET_CAPTURE)) {
                foreach ($__m[0] as $__hit) $__точки[] = [(int) $__hit[1], $__c];
            }
        }
    }
    usort($__точки, static fn($x, $y) => $x[0] <=> $y[0]);
    $__беды = [];
    foreach ($__точки as $__i => [$__поз, $__c]) {
        $__кон  = $__точки[$__i + 1][0] ?? mb_strlen((string) $__гол, '8bit');
        $__фраг = substr((string) $__гол, $__поз, $__кон - $__поз);
        $__надо = prioritet_dnei_konkursa($__c);
        if (preg_match_all('~(\d+)\s+рабочих\s+дн~u', $__фраг, $__mm)) {
            foreach ($__mm[1] as $__было) {
                if ((int) $__было !== $__надо) {
                    $__беды[] = $__c['name'] . ': ' . $__было . ' вместо ' . $__надо;
                }
            }
        }
    }
    chk('ФАКТ ' . $__путь . ': у каждого конкурса назван его срок', $__беды === [],
        implode('; ', array_unique($__беды)));
}

/* БОТ НАЗЫВАЕТ СРОК ТОГО КОНКУРСА, ПРО КОТОРЫЙ СПРАШИВАЮТ.
   Общая лестница верна, но первое число в ней пятёрка, и человек уходил ждать
   пять дней там, где центр обещает три. Мозг и запасной ответ зовут один и тот
   же `prioritet_dnei_konkursa()` - вписанной копии числа тут нет. */
if (!function_exists('chat_srok_konkursa') && is_file(BASE_PATH . '/core/chat_brain.php')) {
    require_once BASE_PATH . '/core/chat_brain.php';
}
if (!function_exists('chat_srok_konkursa')) {
    bad('у бота нет помощника срока конкурса (chat_srok_konkursa)');
} else {
    $__кл = one("SELECT * FROM competitions WHERE COALESCE(club_entry_only,0)=1 AND status='open' LIMIT 1");
    $__об = one("SELECT * FROM competitions WHERE COALESCE(club_entry_only,0)=0 AND COALESCE(club_only,0)=0
                   AND status='open' AND results_mode <> 'list' LIMIT 1");
    $__спис = one("SELECT * FROM competitions WHERE results_mode='list' AND status='open' LIMIT 1");
    $__ок = true; $__чем = [];
    foreach ([[$__кл, 'клубный'], [$__об, 'общий']] as [$__c, $__имя]) {
        if (!$__c) continue;
        $__ждём = prioritet_dnei_konkursa($__c);
        $__дал  = chat_srok_konkursa($__c);
        if (mb_strpos($__дал, (string) $__ждём) === false) { $__ок = false; $__чем[] = $__имя . ': «' . $__дал . '» при ' . $__ждём; }
    }
    if ($__спис && chat_srok_konkursa($__спис) !== '') { $__ок = false; $__чем[] = 'у списочного срок назван числом'; }
    chk('помощник бота называет срок КОНКУРСА, а не общий', $__ок, implode('; ', $__чем));

    $__пром = function_exists('chat_system_prompt') ? chat_system_prompt() : '';
    $__бедыП = [];
    foreach ($__идущие as $__c) {
        if ((string) ($__c['results_mode'] ?? '') === 'list') continue;
        $__нуж = 'результат за ' . prioritet_dney(prioritet_dnei_konkursa($__c));
        if (mb_strpos($__пром, $__нуж) === false) $__бедыП[] = $__c['name'] . ' (нет «' . $__нуж . '»)';
    }
    chk('в правилах мозга у каждого идущего конкурса назван его срок', $__бедыП === [], implode('; ', $__бедыП));

    $__зап = function_exists('chat_rule_reply') ? chat_rule_reply('когда придут результаты') : '';
    $__своиЕсть = false;
    foreach ($__идущие as $__c) {
        if ((string) ($__c['results_mode'] ?? '') === 'list') continue;
        if (prioritet_dnei_konkursa($__c) === PRIORITET_SROK_OBSHIY) continue;
        $__своиЕсть = true;
        if (mb_strpos($__зап, (string) $__c['name']) === false) $__бедыП[] = 'запасной ответ молчит про ' . $__c['name'];
    }
    chk($__своиЕсть ? 'запасной ответ о сроках называет конкурс со своим сроком'
                    : 'своего срока сейчас нет ни у одного конкурса - приписки и не должно быть',
        $__своиЕсть ? $__бедыП === [] : mb_strpos($__зап, 'Сейчас свой срок') === false,
        implode('; ', $__бедыП));
}

echo "\n================ ИТОГ ================\n";
echo "ok: $OK, FAIL: $FAIL\n";
if ($FAIL === 0) echo "Приоритет виден оператору, и срок на плашке равен сроку в коде.\n";
exit($FAIL === 0 ? 0 : 1);
