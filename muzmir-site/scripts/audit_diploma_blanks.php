<?php
/**
 * АУДИТ НАГРАДНОГО БЛАНКА: один ли он везде.
 *
 *   php scripts/audit_diploma_blanks.php
 *
 * Проверяет, что диплом во ВСЕХ местах собирается одним и тем же выверенным
 * движком, а не разными: витрина наград, кабинет участника, админка, письма,
 * производство оригиналов, автоматика на будущее.
 *
 * Поводом стала история, когда образцы на витрине обновлялись, а PDF на
 * скачивание оставался кривым: файлы лежат кэшем и сами не пересобираются.
 */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { fwrite(STDERR, "CLI only\n"); exit(1); }

define('BASE_PATH', dirname(__DIR__));
$GLOBALS['CFG'] = require BASE_PATH . '/config.php';
require_once BASE_PATH . '/core/db.php';
require_once BASE_PATH . '/core/helpers.php';
require_once BASE_PATH . '/core/diploma_html.php';

$bad = 0; $warn = 0;
$ok   = static function (string $s): void { echo "  [норма]  $s\n"; };
$err  = static function (string $s) use (&$bad): void { echo "  [ОШИБКА] $s\n"; $bad++; };
$note = static function (string $s) use (&$warn): void { echo "  [внимание] $s\n"; $warn++; };

echo "1. НАСТРОЙКИ КОНКУРСОВ\n";
$comps = all("SELECT id, code, name, diploma_template FROM competitions WHERE id IN (18,19,20,21,28,29,30,31) ORDER BY id");
foreach ($comps as $c) {
    $t = json_decode((string) $c['diploma_template'], true) ?: [];
    $eng = diploma_engine_ver((array) $c);
    $miss = [];
    foreach (['ink_cal', 'ink_cal_extra', 'ink_cal_named', 'ink_cal_thanks'] as $k) {
        if (empty($t[$k])) $miss[] = $k;
    }
    $line = sprintf('%-3d %-4s %-24s движок %s', $c['id'], (string) $c['code'], mb_substr((string) $c['name'], 0, 24), $eng);
    if ($miss) $err($line . ' — нет поправки: ' . implode(', ', $miss));
    else       $ok($line . ' — поправка снята по всем четырём видам');
}

echo "\n2. ВСЕ ЛИ МЕСТА БЕРУТ БЛАНК ИЗ ОДНОГО ДВИЖКА\n";
/* Ищем прямые вызовы старого GD-генератора там, где документ уходит человеку.
 * Он рисует другой бланк, и один такой вызов сводит на нет всю выверку. */
$watch = [
    'cron/send_diplomas.php'      => 'рассылка дипломов',
    'core/diploma_sync.php'       => 'пересборка при правке заявки',
    'core/orders.php'             => 'заказы наград',
    'core/curator_awards.php'     => 'благодарности кураторам',
    'public/index.php'            => 'скачивание из кабинета',
    'templates/site/pages/cabinet.php' => 'кабинет участника',
];
foreach ($watch as $f => $ru) {
    $src = @file_get_contents(BASE_PATH . '/' . $f);
    if ($src === false) { $note("$f — файла нет"); continue; }
    $hasHtml = str_contains($src, 'diploma_pdf_html');
    // Комментарии не считаем: там объяснено, почему подмены больше нет.
    $noComments = preg_replace('~/\*.*?\*/|//[^\n]*~s', '', $src) ?: $src;
    $hasGd = (bool) preg_match('~\bpdf_diploma\s*\(~', $noComments);
    if ($hasGd) $err("$f ($ru) — остался вызов старого генератора pdf_diploma()");
    elseif ($hasHtml) $ok("$f ($ru) — только выверенный движок");
    else $note("$f ($ru) — бланк здесь не собирается");
}

echo "\n3. ФАЙЛЫ УЧАСТНИКОВ: свежесть\n";
$cut = strtotime('2026-09-04 17:00');   // время выверки бланка
$rows = all("SELECT d.id, d.number, d.type, d.pdf_path, a.competition_id
             FROM diplomas d JOIN applications a ON a.id=d.application_id ORDER BY d.id");
$old = $miss = $fresh = 0; $oldList = [];
foreach ($rows as $d) {
    /* Путь хранится то веб-адресом («/diplomas/x.pdf»), то абсолютным
     * («/var/www/…»). Понимаем оба, иначе аудит объявляет пропажей то, что
     * лежит на месте. */
    $p = trim((string) $d['pdf_path']);
    $abs = $p === '' ? '' : (str_starts_with($p, '/var') ? $p : BASE_PATH . '/public/' . ltrim($p, '/'));
    if ($abs === '' || !is_file($abs)) { $miss++; continue; }
    if (filemtime($abs) < $cut) { $old++; if (count($oldList) < 10) $oldList[] = (string) $d['number']; }
    else $fresh++;
}
printf("  всего наградных материалов: %d\n", count($rows));
if ($fresh) $ok("перерисовано под выверенный бланк: $fresh");
if ($old)   $err("осталось со старой вёрсткой: $old (например: " . implode(', ', $oldList) . ")");
if ($miss)  $note("файла на диске нет: $miss — соберутся при первом обращении");
$absCnt = 0;
foreach ($rows as $d) if (str_starts_with(trim((string) $d['pdf_path']), '/var')) $absCnt++;
if ($absCnt) $err("путь к файлу хранится абсолютным у $absCnt дипломов — ссылка «файл» в админке по ним не открывается");
else $ok('путь к файлу везде веб-адресом — ссылки в админке рабочие');

/* ЗАСЛОН НА ИСТОЧНИК, А НЕ ТОЛЬКО НА СЛЕДСТВИЕ.
 *
 * 13.10.2026 абсолютные пути выправили у 59 дипломов разовым скриптом, а
 * источник не нашли - и 08.10 беда вернулась четырьмя новыми записями
 * (NVI-2026-00088 и MZ-2026-00095): их переписала пересборка бланков
 * `core/diploma_sync.php`, которая кладёт сырой ответ рендера. Чистить
 * следствие раз в месяц бессмысленно, поэтому аудит смотрит САМИ ТОЧКИ ЗАПИСИ:
 * значение `pdf_path` для реестра дипломов обязано пройти через
 * `diploma_store_path()` либо быть веб-адресом (`/diplomas/...`). Появится
 * девятая точка с сырым путём - покраснеет здесь, а не у человека в админке. */
echo "\n3а. ТОЧКИ ЗАПИСИ ПУТИ: мерка одна на всех\n";
$письцы = [];
foreach (['core', 'cron', 'admin', 'scripts', 'api', 'public', 'templates'] as $dir) {
    $base = BASE_PATH . '/' . $dir;
    if (!is_dir($base)) continue;
    $it = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($base, FilesystemIterator::SKIP_DOTS));
    foreach ($it as $file) {
        $путь = (string) $file;
        if (!str_ends_with($путь, '.php')) continue;          // .bak сюда не попадает
        $src = (string) @file_get_contents($путь);
        /* КОММЕНТАРИИ НЕ СЧИТАЕМ. Первый прогон этого заслона покраснел на
         * САМОМ СЕБЕ: в объяснении выше написано `['pdf_path' => $web]` как
         * пример, и поиск принял разбор за код. Та же грабля, что у заслона
         * «простое запрещено» (правило 40), где мера краснела на нашем же блоке
         * запретов, и что в разделе 2 этого файла уже учтено. */
        $src = preg_replace('~/\*.*?\*/|//[^\n]*~s', '', $src) ?: $src;
        if (!preg_match_all("~'pdf_path'\s*=>\s*([^,\n]+)~u", $src, $m)) continue;
        foreach ($m[1] as $знач) $письцы[] = [str_replace(BASE_PATH . '/', '', $путь), trim($знач)];
    }
}
/* Намеренные исключения, и причина у каждого своя:
   - curator_awards пишет в ДРУГУЮ таблицу (`curator_thanks`), и путь там
     абсолютный нарочно: файл не превращается в ссылку, его прикладывают к
     письму педагогу с диска, веб-адрес сломал бы вложение;
   - diploma_paths_fix сам и есть нормализатор, он пишет уже выправленное
     значение;
   - send_award_samples не пишет в базу вовсе, у него это ключ массива для
     сборки образца. */
$исключения = ['core/curator_awards.php', 'scripts/diploma_paths_fix.php', 'scripts/send_award_samples.php'];
$плохо = 0; $хорошо = 0;
/* ЗНАЧЕНИЕ ЧАСТО ЛЕЖИТ В ПЕРЕМЕННОЙ, И ЭТО НЕ НАРУШЕНИЕ.
 * Первая сборка заслона требовала вызов ПРЯМО в строке записи и краснела на
 * `['pdf_path' => $web]`, хотя строкой выше стоит `$web = diploma_store_path(...)`.
 * Заставлять код подстраиваться под форму проверки неправильно: проверка должна
 * ПРОСЛЕДИТЬ мерку, а не требовать её на одной строке. Поэтому у переменной
 * смотрим её присваивание в том же файле. */
$мерка = static fn(string $t): bool
    => str_contains($t, 'diploma_store_path(') || str_contains($t, "'/diplomas/");
foreach ($письцы as [$файл, $знач]) {
    if (in_array($файл, $исключения, true)) { $note("$файл — исключение по делу, не проверяем"); continue; }
    $знач = rtrim($знач, " \t)]");
    if ($мерка($знач)) { $хорошо++; continue; }
    if (preg_match('~^\$(\w+)$~', $знач, $mv)) {
        $src = (string) @file_get_contents(BASE_PATH . '/' . $файл);
        if (preg_match('~\$' . preg_quote($mv[1], '~') . '\s*=\s*([^;]+);~u', $src, $ma) && $мерка($ma[1])) {
            $хорошо++; continue;
        }
    }
    $плохо++;
    $err("$файл пишет pdf_path сырым: $знач — нужен diploma_store_path()");
}
if (!$плохо) $ok("все точки записи ($хорошо) идут через одну мерку");

echo "\n4. КАРТИНКИ-ПРЕДПРОСМОТРЫ\n";
$prev = glob(BASE_PATH . '/public/diplomas/preview_*.png') ?: [];
$prevOld = 0;
foreach ($prev as $f) if (filemtime($f) < $cut) $prevOld++;
if ($prevOld) $err("старых картинок предпросмотра: $prevOld из " . count($prev) . " — покажут прежнюю вёрстку");
else $ok('старых картинок предпросмотра нет (' . count($prev) . ' шт., все свежие или собраны заново)');

echo "\n5. ВИТРИНА НАГРАД\n";
foreach ($comps as $c) {
    $dir = BASE_PATH . '/public/assets/img/awards/' . (int) $c['id'];
    $need = ['diploma.jpg', 'diploma2.jpg', 'diploma-name.jpg', 'thanks.jpg'];
    $bad2 = [];
    foreach ($need as $f) {
        $p = $dir . '/' . $f;
        if (!is_file($p)) $bad2[] = $f . ' — нет';
        elseif (filemtime($p) < $cut) $bad2[] = $f . ' — старый';
    }
    if ($bad2) $err(sprintf('конкурс %-3d — %s', $c['id'], implode('; ', $bad2)));
    else $ok(sprintf('конкурс %-3d — все четыре образца свежие', $c['id']));
}

echo "\n6. АВТОМАТИКА НА БУДУЩЕЕ\n";
/* Новые дипломы рисуются тем же diploma_pdf_html(), значит выверенный бланк
 * применится сам. Проверяем, что путь жив и что запас прочности на месте. */
$src = (string) @file_get_contents(BASE_PATH . '/core/diploma_render.php');
if (preg_match('~for \(\$try = 1; \$try <= 3~', $src)) $ok('рендер бланка делает три попытки при сбое моста');
else $err('рендер бланка делает одну попытку — при заминке моста бланк не соберётся');
$src2 = (string) @file_get_contents(BASE_PATH . '/core/diploma_html_v2.php');
if (str_contains($src2, 'shrinkLast')) $ok('текст благодарности сам ужимается, если упирается в подписи');
else $err('нет защиты от наезда текста на подписи');
if (str_contains($src2, "data-title-fit")) $ok('снимок ждёт готовности вёрстки (метка data-title-fit)');
else $err('метки готовности вёрстки нет — снимок может поймать неподогнанный лист');

echo "\n7. ФИО НАГРАЖДАЕМОГО ПОДГОНЯЕТСЯ ПОСТРОЧНО\n";
/* 18.10.2026: у дуэта (TT-2026-00043) второй строке не хватило восьми точек, и
 * «Владимировна» уехала третьей строкой, разорвав фамилию с отчеством. Оценка
 * ширины в PHP считает 0.56em при поле 180 мм, а на листе поле 157 мм и шрифт
 * Exo 2 весом 900 шире. Чинит это подгонка в браузере, и у блока имени её не
 * было вовсе. Проверка стоит ОТРИЦАНИЕМ: движок пересобирают, и строку легко
 * потерять. */
if (str_contains($src2, 'function fitLines(')) $ok('подгонка ФИО по строкам заведена (fitLines)');
else $err('fitLines пропала — длинное ФИО снова разорвёт перенос');
if (preg_match("~fitLines\('\.awarded-name'~", $src2)) $ok('подгонка зовётся для имени награждаемого');
else $err("fitLines не зовётся для .awarded-name — имя подгоняться не будет");
/* fitOne здесь не годится: он меряет весь textContent одной строкой и склеил бы
   двух человек в одно слово. Ловим подмену. */
if (!preg_match("~fitOne\('\.awarded-name'~", $src2)) $ok('имя не подгоняется однострочной fitOne');
else $err('у .awarded-name стоит fitOne — она склеит двух человек в одну строку');

/* Справка числом: сколько выданных бланков опирается на эту подгонку. Ширину
   считаем по калибровке браузером (0.595em, поле 150 мм) — она и показала беду. */
require_once BASE_PATH . '/core/diploma_html_v2.php';
$опирается = ['отправлен' => 0, 'не отправлен' => 0];
$староеСборки = ['отправлен' => 0, 'не отправлен' => 0];
/* Файл, собранный ДО правки, несёт прежний разрыв строки. Это и есть число
   документов, которые стоит перерисовать.
   ВРЕМЯ БЕРЁМ НАЗВАННОЙ ДАТОЙ, А НЕ ВРЕМЕНЕМ ФАЙЛА ДВИЖКА: любая правка движка
   (и даже подкладка в этом же аудите) сдвигает его mtime, и справка начинает
   врать - так она и соврала при первой сборке, назвав перерисованные бланки
   старыми. Меняешь раскладку имени - двигай и эту дату. */
$движок = strtotime('2026-10-18 19:45:00');
foreach (all("SELECT d.sent_at, d.type, d.pdf_path, a.full_name, a.group_name, a.is_group
                FROM diplomas d JOIN applications a ON a.id = d.application_id
               WHERE COALESCE(d.pdf_path,'') <> '' AND a.competition_id >= 28") as $d) {
    if ((string) $d['type'] === 'thanks') continue;            // у благодарности своя подгонка
    $имя = trim((string) ((int) $d['is_group'] ? ($d['group_name'] ?: $d['full_name']) : $d['full_name']));
    if ($имя === '') continue;
    $b  = \Dip\V2\_dh_fit_block($имя, 29.0, 14.0, 0.56, 180.0, 0.0, 2, 4);
    $pt = (float) (preg_match('~font-size:([\d.]+)pt~', $b['css'], $x) ? $x[1] : 29);
    foreach (explode('<br>', $b['html']) as $строка) {
        $t = html_entity_decode(strip_tags($строка));
        if (mb_strlen($t) * 0.595 * $pt * 0.3528 > 150.0) {
            $к = $d['sent_at'] ? 'отправлен' : 'не отправлен';
            $опирается[$к]++;
            $f = BASE_PATH . '/public/' . ltrim((string) $d['pdf_path'], '/');
            if (is_file($f) && $движок > 0 && filemtime($f) < $движок) $староеСборки[$к]++;
            break;
        }
    }
}
printf("   факт  бланков, которым подгонка нужна: %d ещё не отправлены, %d уже у людей\n",
       $опирается['не отправлен'], $опирается['отправлен']);
printf("   факт  из них собраны ДО правки движка: %d не отправленных, %d у людей%s\n",
       $староеСборки['не отправлен'], $староеСборки['отправлен'],
       $староеСборки['не отправлен'] > 0 ? ' - перерисовать scripts/diploma_refresh_all.php --app=<id>' : '');

/* ---------------------------------------------------------------------------
 * 8. ФИО НЕСКОЛЬКИХ ЧЕЛОВЕК В ОДНОМ ПОЛЕ: ПЕРЕНОС ПАДАЕТ МЕЖДУ ЛЮДЬМИ.
 *
 * Слово владельца 18.10.2026. Балансировка по словам резала человека пополам -
 * на MZ-2026-00087 вышло «Криволапов Максим / Вячеславович». Разбор общий на
 * все движки (они в разных пространствах имён), копия разошлась бы молча.
 * ------------------------------------------------------------------------- */
echo "\n8. ФИО нескольких человек: перенос между людьми\n";

require_once BASE_PATH . '/core/diploma_html.php';
if (function_exists('diploma_fio_lyudi')) $ok('разбор ФИО на людей заведён (core/diploma_fio.php)');
else $err('нет diploma_fio_lyudi - перенос снова режет человека пополам');

/* Пояснения снимаем лексером, а не шаблоном: в них снятое названо НАРОЧНО, и
   поиск по сырому файлу краснел бы на нашем же разборе (правила 40, 48, 63). */
$dbsrc = static function (string $rel): string {
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
};
foreach (['v1', 'v2'] as $v) {
    $src = $dbsrc('core/diploma_html_' . $v . '.php');
    if (strpos($src, '\\diploma_fio_lyudi(') !== false) $ok("движок $v зовёт общий разбор");
    else $err("движок $v не зовёт diploma_fio_lyudi - своя копия условия или нет разбора вовсе");
    /* Готовые строки обязаны ДОХОДИТЬ до вёрстки девятым доводом. Без этого
       разбор посчитался бы и был выброшен, а аудит по одному вызову зеленел. */
    if (preg_match('~_dh_fit_block\(\$name,[^;]*?,\s*\$лица\)~us', $src)) $ok("движок $v отдаёт готовые строки в вёрстку");
    else $err("движок $v не передаёт разобранные ФИО в _dh_fit_block");
    if (preg_match('~\?array \$gotovye = null\): array~u', $src)) $ok("движок $v: вёрстка принимает готовые строки");
    else $err("движок $v: у _dh_fit_block нет готовых строк");
}

/* Разбор судится таблицей случаев, а не на глаз. Делить то, что делить нельзя,
   дороже, чем не поделить: бланк уйдёт человеку с чужой границей строки. */
$делится = [
    'Ишмуков Вячеслав Михайлович Криволапов Максим Вячеславович Заверяева Дарья Вадимовна' => 3,
    'Соколова Ульяна Ильинична Мариева Арина Владимировна' => 2,
    'Голубец Ксения Юрьевна, Голубец Екатерина Юрьевна'    => 2,
    'Камышева Дарья Александровна И Дикальчук Анастасия Александровна' => 2,
    'Фёдорова Светлана И Туктакеева Лира' => 2,
];
$цело = [
    'Мельникова Анастасия Вадимовна',
    'Народный вокальный ансамбль «Эхо Красного камня»',
    'Богданова Валерия Озерная Мария Гандрабура Мария',
    'Федотова Варвара - Солистка Образцового Самодеятельного Коллектива Хореографического Ансамбля Радуга',
    'Мытко Ульяна Ильинична Народный Вокальный Ансамбль Поющие Сердца',
];
$бед = 0;
foreach ($делится as $строка => $сколько) {
    $л = function_exists('diploma_fio_lyudi') ? diploma_fio_lyudi($строка) : [];
    if (count($л) !== $сколько) { $бед++; $err("разбор не поделил «" . mb_substr($строка, 0, 40) . "…»: людей " . count($л) . " вместо $сколько"); }
}
if (!$бед) $ok('разбор делит все пять известных полей с несколькими людьми');
$бед = 0;
foreach ($цело as $строка) {
    $л = function_exists('diploma_fio_lyudi') ? diploma_fio_lyudi($строка) : [];
    if (count($л) > 1) { $бед++; $err("разбор поделил неделимое «" . mb_substr($строка, 0, 40) . "…» на " . count($л)); }
}
if (!$бед) $ok('разбор не трогает коллектив, звание и имена без отчеств');

/* ФАКТ по живым бланкам: в собранном HTML строки обязаны совпасть с людьми. */
$проверено = 0; $плохо = [];
foreach (all("SELECT d.number, d.type, a.id AS aid, a.full_name, a.competition_id
                FROM diplomas d JOIN applications a ON a.id = d.application_id
               WHERE COALESCE(a.full_name,'') <> '' AND d.type IN ('main','extra')") as $d) {
    $люди = function_exists('diploma_fio_lyudi') ? diploma_fio_lyudi((string) $d['full_name']) : [];
    if (count($люди) < 2) continue;
    $c = one("SELECT * FROM competitions WHERE id = ?", [$d['competition_id']]);
    $a = one("SELECT * FROM applications WHERE id = ?", [$d['aid']]);
    if (!$c || !$a) continue;
    $html = diploma_html($c, $a, ['number' => $d['number']]);
    if (!preg_match('~<div class="awarded-name"[^>]*>(.*?)</div>~us', $html, $m)) continue;
    $строки = array_map(static fn($x) => trim(html_entity_decode(strip_tags($x))), explode('<br>', $m[1]));
    $проверено++;
    if ($строки !== $люди) $плохо[] = $d['number'] . ': ' . implode(' / ', $строки);
}
if ($проверено === 0) echo "   факт  бланков с несколькими людьми в ФИО нет\n";
elseif (!$плохо)      $ok("на всех $проверено бланках с несколькими людьми строка на человека");
else foreach ($плохо as $x) $err("перенос режет человека - $x");

printf("\nИТОГ: ошибок %d, замечаний %d\n", $bad, $warn);
exit($bad > 0 ? 1 : 0);
