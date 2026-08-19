<?php
/**
 * ПРИВЕСТИ В ПОРЯДОК ГАЛЕРЕЮ ПИСЕМ ПОДДЕРЖКИ.
 *
 * Страница /ministry-support это витрина: её показывают ведомствам, партнёрам и
 * участникам как доказательство, что центр работает с государственными
 * учреждениями. Выглядеть она должна как реестр, а не как папка со сканами.
 *
 * Два изъяна, из-за которых письма шли вразброс.
 *
 * ПЕРВЫЙ. У двадцати восьми писем пустое поле региона: карточка выходила
 * безымянной, в инфографику по округам не попадала и в поиске по региону не
 * находилась. При этом сам регион всё это время лежал в имени файла скана —
 * «amurskaya-oblast-page0001.jpg», «permskiy-kray-page0001.jpg». Здесь он оттуда
 * и достаётся: имя файла разбирается по словарю транслита субъектов РФ.
 *
 * ВТОРОЙ. Порядок задавался тремя ключами сразу — дата письма, колонка sort и
 * номер записи. Колонка sort заполнялась когда-то вручную и давно разъехалась с
 * датами, поэтому письмо за январь могло оказаться между августовскими. Порядок
 * должен быть один и понятный: новые сверху, внутри одной даты — по алфавиту
 * субъекта. Здесь sort переписывается ровно в этом порядке, и страница получает
 * его же вторым ключом — вручную больше ничего двигать не нужно.
 *
 *   php scripts/fix_ministry_letters.php --dry
 *   php scripts/fix_ministry_letters.php
 */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { fwrite(STDERR, "CLI only\n"); exit(1); }

define('BASE_PATH', dirname(__DIR__));
$GLOBALS['CFG'] = require BASE_PATH . '/config.php';
require_once BASE_PATH . '/core/db.php';
require_once BASE_PATH . '/core/helpers.php';

$dry  = in_array('--dry', $argv, true);
$line = str_repeat('=', 78);

/**
 * Транслит субъекта → как он называется у нас в реестре.
 *
 * Ключ ищется вхождением в имени файла, поэтому достаточно корня: «tverskoy»
 * поймает и «ministerstvo-kultury-tverskoy-oblasti-2025».
 */
const ML_REGIONS = [
    'amurskaya'        => 'Амурская область',
    'arhangel'         => 'Архангельская область',
    'astrahan'         => 'Астраханская область',
    'belgorod'         => 'Белгородская область',
    'bryansk'          => 'Брянская область',
    'vladimir'         => 'Владимирская область',
    'volgograd'        => 'Волгоградская область',
    'vologod'          => 'Вологодская область',
    'voronezh'         => 'Воронежская область',
    'ivanov'           => 'Ивановская область',
    'irkut'            => 'Иркутская область',
    'kaliningrad'      => 'Калининградская область',
    'kaluzh'           => 'Калужская область',
    'kamchat'          => 'Камчатский край',
    'kemerov'          => 'Кемеровская область',
    'kirov'            => 'Кировская область',
    'kostrom'          => 'Костромская область',
    'krasnodar'        => 'Краснодарский край',
    'krasnoyar'        => 'Красноярский край',
    'kurgan'           => 'Курганская область',
    'kursk'            => 'Курская область',
    'leningrad'        => 'Ленинградская область',
    'lipeck'           => 'Липецкая область',
    'magadan'          => 'Магаданская область',
    'moskovsk'         => 'Московская область',
    'murman'           => 'Мурманская область',
    'neneckiy'         => 'Ненецкий автономный округ',
    'nizhegorod'       => 'Нижегородская область',
    'novgorod'         => 'Новгородская область',
    'novosibir'        => 'Новосибирская область',
    'omskaya'          => 'Омская область',
    'orenburg'         => 'Оренбургская область',
    'orlovsk'          => 'Орловская область',
    'penzen'           => 'Пензенская область',
    'permskiy'         => 'Пермский край',
    'primorskiy'       => 'Приморский край',
    'pskov'            => 'Псковская область',
    'rostov'           => 'Ростовская область',
    'ryazan'           => 'Рязанская область',
    'samar'            => 'Самарская область',
    'saratov'          => 'Саратовская область',
    'sahalin'          => 'Сахалинская область',
    'sverdlov'         => 'Свердловская область',
    'smolen'           => 'Смоленская область',
    'stavropol'        => 'Ставропольский край',
    'tambov'           => 'Тамбовская область',
    'tverskoy'         => 'Тверская область',
    'tomsk'            => 'Томская область',
    'tulsk'            => 'Тульская область',
    'tul'              => 'Тульская область',
    'tyumen'           => 'Тюменская область',
    'ulyanov'          => 'Ульяновская область',
    'chelyabin'        => 'Челябинская область',
    'zabaykal'         => 'Забайкальский край',
    'yaroslav'         => 'Ярославская область',
    'bashkortostan'    => 'Республика Башкортостан',
    'buryat'           => 'Республика Бурятия',
    'dagestan'         => 'Республика Дагестан',
    'ingush'           => 'Республика Ингушетия',
    'kabardino'        => 'Кабардино-Балкарская Республика',
    'kalmyk'           => 'Республика Калмыкия',
    'karachaevo'       => 'Карачаево-Черкесская Республика',
    'karel'            => 'Республика Карелия',
    'komi'             => 'Республика Коми',
    'krym'             => 'Республика Крым',
    'mariy'            => 'Республика Марий Эл',
    'mordovi'          => 'Республика Мордовия',
    'saha'             => 'Республика Саха (Якутия)',
    'osetiya'          => 'Республика Северная Осетия — Алания',
    'tatarstan'        => 'Республика Татарстан',
    'tyva'             => 'Республика Тыва',
    'udmurt'           => 'Удмуртская Республика',
    'hakasi'           => 'Республика Хакасия',
    'chechen'          => 'Чеченская Республика',
    'chuvash'          => 'Чувашская Республика',
    'altayskiy'        => 'Алтайский край',
    'habarov'          => 'Хабаровский край',
    'hanty'            => 'Ханты-Мансийский автономный округ — Югра',
    'yamalo'           => 'Ямало-Ненецкий автономный округ',
    'evreysk'          => 'Еврейская автономная область',
    'chukot'           => 'Чукотский автономный округ',
    'sevastopol'       => 'Севастополь',
    'moskva'           => 'Москва',
    'peterburg'        => 'Санкт-Петербург',
];

/** Регион по имени файла скана ('' если не опознали). */
function ml_region_from_path(string $path): string {
    $p = mb_strtolower(basename($path));
    foreach (ML_REGIONS as $key => $name) {
        if (str_contains($p, $key)) return $name;
    }
    return '';
}

/**
 * ОДИН СУБЪЕКТ — ОДНО НАПИСАНИЕ.
 *
 * Половина записей заведена руками, половина приезжает разбором писем, и они
 * называют один и тот же субъект по-разному: «Респ. Крым» и «Республика Коми»,
 * «Калининградская обл.» и «Владимирская область». Для страницы это разные
 * регионы: в списке они стоят порознь, в счётчике субъектов задваиваются, поиск
 * по «республика» половину не находит. Приводим к полному, как в реестре.
 */
function ml_region_canon(string $r): string {
    $r = trim(preg_replace('~\s+~u', ' ', $r) ?? '');
    if ($r === '') return '';
    $r = preg_replace('~^Респ\.?\s+~ui', 'Республика ', $r) ?? $r;
    $r = preg_replace('~\bобл\.~ui', 'область', $r) ?? $r;
    $r = preg_replace('~\bкр\.~ui', 'край', $r) ?? $r;
    $r = preg_replace('~\bа\.?о\.~ui', 'автономный округ', $r) ?? $r;
    $r = preg_replace('~\bг\.\s*~ui', '', $r) ?? $r;
    return mb_substr(trim($r), 0, 120);
}

/**
 * ПОХОЖЕ ЛИ ЭТО НА СУБЪЕКТ РОССИЙСКОЙ ФЕДЕРАЦИИ.
 *
 * В поле региона иногда оказывается фамилия исполнителя из подписи письма
 * («Ильина Галина Юрьевна») или служебная пометка «федеральный». На карточке это
 * выглядит так, будто нас поддержала гражданка Ильина. Всё, что не похоже на
 * субъект, заменяем названием ведомства из заголовка письма.
 */
function ml_looks_like_region(string $r): bool {
    $r = mb_strtolower(trim($r));
    if ($r === '' || $r === 'федеральный') return false;
    foreach (['област', 'край', 'республик', 'округ', 'москв', 'петербург', 'севастопол'] as $w) {
        if (mb_strpos($r, $w) !== false) return true;
    }
    return in_array($r, array_map('mb_strtolower', ML_REGIONS), true);
}

echo "ГАЛЕРЕЯ ПИСЕМ ПОДДЕРЖКИ\n$line\n";

$rows = all("SELECT id, region, image_path, letter_date FROM ministry_letters");
printf("  писем всего: %d\n", count($rows));

/* ── 1. Регион из имени файла там, где поле пустое ── */
$filled = $unknown = 0;
foreach ($rows as $r) {
    if (trim((string) $r['region']) !== '') continue;
    $reg = ml_region_from_path((string) $r['image_path']);
    if ($reg === '') { $unknown++; continue; }
    printf("  #%-4d %-46s → %s\n", (int) $r['id'], basename((string) $r['image_path']), $reg);
    if (!$dry) q("UPDATE ministry_letters SET region=? WHERE id=?", [$reg, (int) $r['id']]);
    $filled++;
}
printf("\n  регион восстановлен: %d, не опознано: %d\n", $filled, $unknown);

/* ── 1б. В поле региона не должно быть фамилий и служебных пометок ── */
$named = 0;
foreach (all("SELECT id, region, title FROM ministry_letters") as $r) {
    $reg = trim((string) $r['region']);
    if ($reg === '' || ml_looks_like_region($reg)) continue;
    $title = trim((string) $r['title']);
    $new   = $title !== '' && $title !== $reg ? $title : $reg;
    if ($new === $reg) continue;
    printf("  #%-4d %-28s → %s\n", (int) $r['id'], mb_substr($reg, 0, 28), mb_substr($new, 0, 44));
    if (!$dry) q("UPDATE ministry_letters SET region = ? WHERE id = ?", [$new, (int) $r['id']]);
    $named++;
}
printf("  подписей выправлено: %d\n\n", $named);

/* ── 2. Одно написание субъекта на всю галерею ── */
$canon = 0;
foreach (all("SELECT id, region FROM ministry_letters WHERE TRIM(COALESCE(region,'')) <> ''") as $r) {
    $c = ml_region_canon((string) $r['region']);
    if ($c === '' || $c === (string) $r['region']) continue;
    printf("  #%-4d %-28s → %s\n", (int) $r['id'], (string) $r['region'], $c);
    if (!$dry) q("UPDATE ministry_letters SET region=? WHERE id=?", [$c, (int) $r['id']]);
    $canon++;
}
printf("  написание выправлено: %d\n\n", $canon);

/* ── 3. Одно письмо — одна карточка ──
 *
 * Один и тот же ответ ведомства приезжает дважды: разбор читает ящик kc@ сам, а
 * общий разбор входящих видит копию в другом ящике центра. У Минобразования
 * Ставропольского края так получилось пять карточек подряд. Оставляем ту, где
 * есть скан, остальные убираем.
 */
$dupes = all("SELECT source_email, letter_date, COUNT(*) c FROM ministry_letters
               WHERE TRIM(COALESCE(source_email,'')) <> ''
               GROUP BY 1, 2 HAVING c > 1");
$killed = 0;
foreach ($dupes as $d) {
    $same = all("SELECT id, image_path FROM ministry_letters
                  WHERE source_email = ? AND COALESCE(letter_date,'') = COALESCE(?,'')
                  ORDER BY (COALESCE(image_path,'') = '') ASC, id ASC",
                [(string) $d['source_email'], (string) $d['letter_date']]);
    foreach (array_slice($same, 1) as $x) {
        if (!$dry) q("DELETE FROM ministry_letters WHERE id = ?", [(int) $x['id']]);
        $killed++;
    }
}
printf("  дублей убрано: %d\n", $killed);

/* ── 4. Единый порядок: новые сверху, внутри даты по алфавиту субъекта ── */
$all = all("SELECT id, region, letter_date FROM ministry_letters");
usort($all, static function (array $a, array $b): int {
    $da = trim((string) $a['letter_date']);
    $db = trim((string) $b['letter_date']);
    if (($da === '') !== ($db === '')) return $da === '' ? 1 : -1;   // без даты — в конец
    if ($da !== $db) return strcmp($db, $da);                        // новые выше
    $ra = trim((string) $a['region']);
    $rb = trim((string) $b['region']);
    if (($ra === '') !== ($rb === '')) return $ra === '' ? 1 : -1;   // безымянные ниже
    $c = strcoll($ra, $rb);
    return $c !== 0 ? $c : ((int) $b['id'] <=> (int) $a['id']);
});
if (!$dry) {
    $i = 0;
    foreach ($all as $r) q("UPDATE ministry_letters SET sort=? WHERE id=?", [++$i, (int) $r['id']]);
}
printf("  порядок пересчитан: %d записей\n", count($all));

if ($dry) { echo "\n  сухой прогон: ничего не изменено\n"; exit(0); }

echo "\nПЕРВЫЕ ДЕСЯТЬ ПОСЛЕ ПЕРЕСЧЁТА\n$line\n";
foreach (all("SELECT sort, substr(letter_date,1,10) d, region FROM ministry_letters ORDER BY sort LIMIT 10") as $r) {
    printf("  %3d  %-10s  %s\n", (int) $r['sort'], (string) $r['d'], (string) $r['region'] ?: '(без региона)');
}
