<?php
/**
 * scripts/audit_spravochniki.php — СПРАВОЧНИКИ ЗАЯВКИ: НОМИНАЦИИ, ПОДРАЗДЕЛЫ, ФОРМЫ.
 *
 * Заведён 18.10.2026 вместе с подразделом «Смешанные (оркестр)» (слово владельца):
 * аудита у справочников не было вовсе, а читают их семь поверхностей разом — форма
 * подачи, её клиентская логика, дверь `api/v1/apply.php`, чистка полей, кабинет,
 * админка и положение в PDF. Источник истины ОДИН, `NOMINATIONS()` в core/data.php.
 *
 * ГЛАВНОЕ, ЧТО ОН СТОРОЖИТ, — ТИХУЮ ДЫРУ. Новый подраздел попадает в форму сразу,
 * а паспорт направления (`gk_direction_prompt`) и уточнение рубрики
 * (`gr_rubric_for()['sub_note']`) отдают ПУСТУЮ строку при незнакомом ключе: заявка
 * принимается, а эксперт судит состав общими словами, и ни одна строка об этом не
 * кричит. Паспорт поэтому обязателен, уточнение печатается справкой (его нет у
 * десяти подразделов ещё до правки, и красное на ровном месте прячет настоящие
 * отказы — правила 47, 62).
 *
 * ОН ТОЛЬКО ЧИТАЕТ. Проверка, которая пишет, сама становится действием: ровно так
 * прогон `audit_admin.php` разослал анонс закрытого конкурса (правило 49). Здесь
 * запись означала бы живую заявку участника.
 *
 * Запуск:  php scripts/audit_spravochniki.php  [--без-страниц]
 */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { fwrite(STDERR, "CLI only\n"); exit(1); }

define('BASE_PATH', dirname(__DIR__));
$GLOBALS['CFG'] = require BASE_PATH . '/config.php';
foreach (['db', 'helpers', 'data', 'app_fields'] as $m) {
    require_once BASE_PATH . '/core/' . $m . '.php';
}
require_once BASE_PATH . '/core/grading_rubrics.php';
require_once BASE_PATH . '/core/grading_knowledge.php';
db();

const SPR_HOST = 'музыкальный-мир.рф';
const SPR_NOM_INSTR = 'Инструментальное исполнительство';
const SPR_SUB_NEW   = 'Смешанные (оркестр)';

$БЕЗ_СТРАНИЦ = in_array('--без-страниц', $argv, true);
$FAIL = 0; $OK = 0;
function sec(string $s): void { echo "\n=== $s ===\n"; }
function ok(string $w, string $i = ''): void { global $OK; $OK++; echo "  ok   $w" . ($i !== '' ? "  [$i]" : '') . "\n"; }
function bad(string $w, string $i = ''): void { global $FAIL; $FAIL++; echo "  FAIL $w" . ($i !== '' ? "  $i" : '') . "\n"; }
function chk(string $w, bool $c, string $i = ''): void { $c ? ok($w, $i) : bad($w, $i); }
function spravka(string $w): void { echo "  справка: $w\n"; }

/** Исходник без PHP-пояснений: в них снятое и запрещённое названо нарочно, и поиск
 *  по сырому файлу краснел бы на нашем же разборе (правила 40, 48, 63). */
function spr_bez_poyasneniy(string $path): string {
    $out = '';
    foreach (token_get_all((string) file_get_contents($path)) as $t) {
        if (is_array($t)) {
            if ($t[0] === T_COMMENT || $t[0] === T_DOC_COMMENT) { $out .= "\n"; continue; }
            $out .= $t[1];
        } else { $out .= $t; }
    }
    return $out;
}

/** Живая страница сайта: запрос идёт на 127.0.0.1 с нужным Host, наружу не выходит. */
function spr_stranica(string $path): array {
    $ascii = idn_to_ascii(SPR_HOST, IDNA_DEFAULT, INTL_IDNA_VARIANT_UTS46);
    $ch = curl_init('https://' . SPR_HOST . $path);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_RESOLVE        => [$ascii . ':443:127.0.0.1'],
        CURLOPT_SSL_VERIFYPEER => false,
        CURLOPT_SSL_VERIFYHOST => false,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_TIMEOUT        => 30,
    ]);
    $body = (string) curl_exec($ch);
    $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    return [$code, $body];
}

$noms = NOMINATIONS();

/* ───────── 1. Источник истины ───────── */
sec('Справочник один, и подраздел владельца в нём есть');
chk('номинации заведены', count($noms) >= 9, count($noms) . ' групп');
$instr = (array) ($noms[SPR_NOM_INSTR] ?? []);
chk('инструментальное исполнительство со своими подразделами', count($instr) >= 6, count($instr) . ' шт.');
chk('«' . SPR_SUB_NEW . '» в справочнике', in_array(SPR_SUB_NEW, $instr, true));
chk('у смешанного состава есть куда заявиться формой',
    in_array('Оркестр', FORMATIONS_FOR(SPR_NOM_INSTR), true),
    implode(', ', FORMATIONS_FOR(SPR_NOM_INSTR)));

/* ───────── 2. Тихая дыра: паспорт направления ───────── */
sec('У каждого подраздела есть паспорт направления');
$безПаспорта = [];
$безУточнения = [];
$всего = 0;
foreach ($noms as $nom => $subs) {
    foreach ($subs as $s) {
        $всего++;
        if (gk_direction_prompt($s) === '') $безПаспорта[] = $nom . ' / ' . $s;
        $r = gr_rubric_for($nom, $s);
        if ((string) ($r['sub_note'] ?? '') === '') $безУточнения[] = $nom . ' / ' . $s;
    }
}
chk('паспорт есть у всех подразделов', $безПаспорта === [],
    $безПаспорта ? implode('; ', $безПаспорта) : $всего . ' шт.');
chk('паспорт нового подраздела собран', gk_direction_prompt(SPR_SUB_NEW) !== '',
    mb_strlen(gk_direction_prompt(SPR_SUB_NEW)) . ' знаков');
chk('уточнение рубрики у нового подраздела есть',
    (string) (gr_rubric_for(SPR_NOM_INSTR, SPR_SUB_NEW)['sub_note'] ?? '') !== '');
if ($безУточнения) {
    spravka('подразделов без уточнения рубрики: ' . count($безУточнения) . ' (общая рубрика номинации работает) — ' . implode('; ', $безУточнения));
}
$мёртвые = [];
foreach (gr_rubrics() as $nom => $r) {
    foreach (array_keys((array) ($r['sub'] ?? [])) as $k) {
        if (!in_array($k, (array) ($noms[$nom] ?? []), true)) $мёртвые[] = $nom . ' / ' . $k;
    }
}
if ($мёртвые) spravka('уточнений рубрики без своего подраздела: ' . implode('; ', $мёртвые));

/* ───────── 3. Двери судят по единому источнику ───────── */
sec('Дверь подачи и чистка полей берут справочник, а не свою копию');
$dver = spr_bez_poyasneniy(BASE_PATH . '/api/v1/apply.php');
chk('дверь подачи сверяет подраздел со справочником',
    strpos($dver, 'NOMINATIONS()[$nomination]') !== false);
$fields = spr_bez_poyasneniy(BASE_PATH . '/core/app_fields.php');
chk('чистка полей берёт подразделы из справочника',
    preg_match('~\$noms\[\$nom\]~', $fields) === 1);
/* ОТРИЦАНИЕМ: вписанная копия списка инструментов возвращается одной правкой
   шаблона, и тогда форма покажет одно, а сервер примет другое (урок правила 45). */
$копия = [];
foreach ([
    'templates/site/pages/apply.php', 'public/assets/js/apply.js',
    'templates/site/pages/cabinet.php', 'admin/applications.php', 'admin/grading.php',
] as $f) {
    $p = BASE_PATH . '/' . $f;
    if (!is_file($p)) continue;
    $src = preg_match('~\.php$~', $f) ? spr_bez_poyasneniy($p) : (string) file_get_contents($p);
    if (preg_match('~Фортепиано~u', $src) && preg_match('~Народные инструменты~u', $src)) $копия[] = $f;
}
chk('вписанной копии списка инструментов в поверхностях нет', $копия === [],
    $копия ? implode(', ', $копия) : 'проверено 5 файлов');

/* дверь правда пропускает новое значение и правда отбивает чужое */
foreach ([SPR_SUB_NEW => true, 'Смешанный оркестр' => false] as $v => $ждём) {
    $пустит = in_array((string) $v, $instr, true);
    chk('дверь ' . ($ждём ? 'пропускает' : 'отбивает') . ' «' . $v . '»', $пустит === $ждём);
}

/* ───────── 3б. Формы исполнения сужены подразделом ───────── */
sec('Формы исполнения: набор подраздела сильнее набора номинации');
$узкий = FORMATIONS_SUB_MAP()[SPR_NOM_INSTR][SPR_SUB_NEW] ?? [];
chk('карта форм по подразделу заведена', function_exists('FORMATIONS_SUB_MAP') && $узкий !== []);
chk('у «' . SPR_SUB_NEW . '» ровно ансамбль и оркестр',
    FORMATIONS_FOR(SPR_NOM_INSTR, SPR_SUB_NEW) === ['Ансамбль', 'Оркестр'],
    implode(', ', FORMATIONS_FOR(SPR_NOM_INSTR, SPR_SUB_NEW)));
/* ОТРИЦАНИЕМ: соло и дуэт возвращаются одной строкой, а смешанный состав
   не бывает ни тем, ни другим — ради этого правка и делалась. */
$лишние = array_intersect(['Соло', 'Дуэт'], FORMATIONS_FOR(SPR_NOM_INSTR, SPR_SUB_NEW));
chk('соло и дуэта у смешанного состава нет', $лишние === [], implode(', ', $лишние));
$общий = FORMATIONS_FOR(SPR_NOM_INSTR);
$сузились = [];
foreach ((array) ($noms[SPR_NOM_INSTR] ?? []) as $s2) {
    if ($s2 === SPR_SUB_NEW) continue;
    if (FORMATIONS_FOR(SPR_NOM_INSTR, (string) $s2) !== $общий) $сузились[] = (string) $s2;
}
chk('остальные подразделы инструменталки с общим набором', $сузились === [],
    $сузились ? implode(', ', $сузились) : implode(', ', $общий));
chk('чужая номинация не задета',
    FORMATIONS_FOR('Хореография', 'Народный танец') === FORMATIONS_FOR('Хореография'),
    implode(', ', FORMATIONS_FOR('Хореография', 'Народный танец')));
$плоский = FORMATIONS();
$потеряны = [];
foreach (FORMATIONS_SUB_MAP() as $subs) foreach ($subs as $list) foreach ($list as $ff) {
    if (!in_array($ff, $плоский, true)) $потеряны[] = (string) $ff;
}
chk('плоский список знает формы подразделов', $потеряны === [], implode(', ', $потеряны));

sec('Подраздел доходит до каждой двери и каждой формы правки');
$пары = [
    'api/v1/apply.php'                  => '~FORMATIONS_FOR\(\$nomination,\s*\$subgroup\)~',
    'core/app_fields.php'               => '~FORMATIONS_FOR\(\$nom,\s*\$subNow\)~',
    'admin/applications.php'            => '~FORMATIONS_FOR\(\$nomNow,[^;]*subgroup~',
    'templates/site/pages/cabinet.php'  => '~FORMATIONS_FOR\(\$eNom,\s*\$eSub\)~',
];
foreach ($пары as $файл => $шаблон) {
    chk('подраздел передан: ' . $файл, preg_match($шаблон, spr_bez_poyasneniy(BASE_PATH . '/' . $файл)) === 1);
}
/* Сужение набора молча стирает форму прежней заявки при правке, поэтому обе
   формы правки обязаны показать её отдельной строкой (как делает админка). */
foreach (['admin/applications.php', 'templates/site/pages/cabinet.php'] as $файл) {
    chk('прежняя форма не теряется при правке: ' . $файл,
        preg_match('~in_array\(\$[a-zA-Z]*[Cc]urF, \$[a-zA-Z]*[Ff]orms[Oo]?k?, true\)~u',
            spr_bez_poyasneniy(BASE_PATH . '/' . $файл)) === 1);
}

sec('ПОВЕДЕНИЕ: чистка полей судит форму по подразделу');
$проба = static function (string $sub, string $form): bool {
    $r = app_fields_normalize([
        'nomination' => SPR_NOM_INSTR, 'subgroup' => $sub, 'formation' => $form,
    ], []);
    return !isset($r['errors']['formation']);
};
chk('«Соло» при смешанном оркестре отбито', !$проба(SPR_SUB_NEW, 'Соло'));
chk('«Оркестр» при смешанном оркестре принято', $проба(SPR_SUB_NEW, 'Оркестр'));
chk('«Ансамбль» при смешанном оркестре принято', $проба(SPR_SUB_NEW, 'Ансамбль'));
chk('«Соло» при фортепиано по-прежнему принято', $проба('Фортепиано', 'Соло'));
chk('«Соло» без подраздела по-прежнему принято', $проба('', 'Соло'));
/* ───────── 4. ФАКТ: живая форма подачи ───────── */
if ($БЕЗ_СТРАНИЦ) {
    sec('ФАКТ по живой форме подачи');
    spravka('пропущено ключом --без-страниц');
} else {
    sec('ФАКТ: все подразделы напечатаны в живой форме подачи');
    [$code, $html] = spr_stranica('/apply');
    chk('страница /apply отвечает', $code === 200, 'код ' . $code . ', ' . strlen($html) . ' байт');
    if ($code === 200) {
        /* Конфиг формы уезжает в JSON, а там кириллица экранирована: ищем оба вида. */
        $есть = static function (string $s) use ($html): bool {
            if (mb_strpos($html, $s) !== false) return true;
            $esc = trim(json_encode($s, JSON_UNESCAPED_SLASHES), '"');
            return strpos($html, $esc) !== false;
        };
        $нет = [];
        foreach ($noms as $nom => $subs) {
            if (!$есть((string) $nom)) $нет[] = 'номинация ' . $nom;
            foreach ($subs as $s) if (!$есть((string) $s)) $нет[] = $nom . ' / ' . $s;
        }
        chk('все номинации и подразделы есть в форме', $нет === [],
            $нет ? implode('; ', $нет) : count($noms) . ' номинаций, ' . $всего . ' подразделов');
        chk('«' . SPR_SUB_NEW . '» напечатан в форме', $есть(SPR_SUB_NEW));
        foreach (FORMATIONS_FOR(SPR_NOM_INSTR) as $f) {
            if (!$есть((string) $f)) { bad('форма исполнения «' . $f . '» не напечатана'); continue; }
        }
        ok('формы исполнения инструменталки напечатаны', implode(', ', FORMATIONS_FOR(SPR_NOM_INSTR)));
        /* Набор подраздела живёт в конфиге формы и в её скрипте: без любого из
           двух браузер покажет «Соло» там, где сервер его отобьёт. */
        chk('набор подраздела доехал в конфиг формы', strpos($html, 'formationsSub') !== false);
        [$jc, $js] = spr_stranica('/assets/js/apply.js');
        chk('скрипт формы отвечает', $jc === 200, 'код ' . $jc . ', ' . strlen($js) . ' байт');
        chk('скрипт читает набор подраздела', strpos($js, 'CFG.formationsSub') !== false);
        chk('скрипт пересобирает формы при смене подраздела',
            preg_match('~#subgroup\'\)[\s\S]{0,200}?addEventListener\(\'change\'[\s\S]{0,160}?fillFormations~', $js) === 1);
    }
}

/* ───────── 5. ФАКТ по базе ───────── */
sec('ФАКТ: в живых заявках нет подразделов вне справочника');
$чужие = [];
foreach (all("SELECT id, nomination, COALESCE(subgroup,'') s FROM applications WHERE COALESCE(subgroup,'') <> ''") as $a) {
    $ok = (array) ($noms[(string) $a['nomination']] ?? []);
    if ($ok && !in_array((string) $a['s'], $ok, true)) $чужие[] = '#' . $a['id'] . ' ' . $a['s'];
}
chk('подразделов вне справочника в заявках нет', $чужие === [],
    $чужие ? implode(', ', array_slice($чужие, 0, 10)) : 'проверены все заявки с подразделом');
$поСоставу = all("SELECT COALESCE(subgroup,'') s, COUNT(*) n FROM applications WHERE nomination = ? GROUP BY s ORDER BY n DESC", [SPR_NOM_INSTR]);
$строки = [];
foreach ($поСоставу as $r) $строки[] = ($r['s'] === '' ? '(пусто)' : $r['s']) . ': ' . $r['n'];
spravka('заявки инструменталки по подразделам — ' . implode(', ', $строки));

echo "\n" . str_repeat('─', 60) . "\n";
echo ($FAIL === 0 ? 'СПРАВОЧНИКИ ЧИСТО' : "ПРОВАЛОВ: $FAIL") . ", пройдено: $OK\n";
exit($FAIL === 0 ? 0 : 1);
