<?php
/**
 * АУДИТ СТРАНЫ И ГОРОДА.
 *
 * Проверяет разбор на всех случаях, которые ломались вживую: страна перед
 * городом и после него, зарубежье за пределами СНГ, регион вместо города,
 * двойная приставка, страна, приписанная формой поверх введённой человеком.
 * Плюс сверяет, что в базе не осталось записей, где страна очевидно не та.
 *
 *   php scripts/audit_city_country.php
 */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { fwrite(STDERR, "CLI only\n"); exit(1); }

define('BASE_PATH', dirname(__DIR__));
$GLOBALS['CFG'] = require BASE_PATH . '/config.php';
require_once BASE_PATH . '/core/db.php';
require_once BASE_PATH . '/core/helpers.php';
require_once BASE_PATH . '/core/text_format.php';

$line = str_repeat('=', 78);
$ok = $bad = 0;
$check = function (string $in, string $want) use (&$ok, &$bad): void {
    $got = city_normalize($in);
    if ($got === $want) { $ok++; printf("  [ок]   %-32s → %s\n", $in, $got); }
    else { $bad++; printf("  [СБОЙ] %-32s → %s (ждали: %s)\n", $in, $got !== '' ? $got : '(пусто)', $want); }
};

echo "РАЗБОР СТРАНЫ И ГОРОДА\n$line\n";

/* Россия и ближнее зарубежье */
$check('Москва',                    'Россия, г. Москва');
$check('г. Тверь',                  'Россия, г. Тверь');
$check('Минск',                     'Республика Беларусь, г. Минск');
$check('Беларусь Гомель',           'Республика Беларусь, г. Гомель');
$check('Гомель, Беларусь',          'Республика Беларусь, г. Гомель');
$check('Казахстан, Алматы',         'Республика Казахстан, г. Алматы');

/* Дальнее зарубежье: из-за него и был весь сыр-бор */
$check('Дубай',                     'Объединённые Арабские Эмираты, г. Дубай');
$check('ОАЭ, Дубай',                'Объединённые Арабские Эмираты, г. Дубай');
$check('Дубай ОАЭ',                 'Объединённые Арабские Эмираты, г. Дубай');
$check('США, Нью-Йорк',             'Соединённые Штаты Америки, г. Нью-Йорк');
$check('Кипр, Лимассол',            'Республика Кипр, г. Лимассол');
$check('Германия Берлин',           'Федеративная Республика Германия, г. Берлин');

/* Мусор, который копился в базе */
$check('Россия, г. Беларусь Гомель', 'Республика Беларусь, г. Гомель');
$check('Россия, г. Дубай',           'Объединённые Арабские Эмираты, г. Дубай');
$check('Россия, г. Р.п. Нахабино',   'Россия, пгт Нахабино');
$check('Россия, г. Краснодарский Край', 'Россия, Краснодарский Край');

/* Повторный прогон ничего не меняет */
echo "\nПОВТОРНЫЙ РАЗБОР НЕ ПОРТИТ РЕЗУЛЬТАТ\n$line\n";
foreach (['Россия, г. Москва', 'Республика Беларусь, г. Минск',
          'Объединённые Арабские Эмираты, г. Дубай', 'Россия, пгт Нахабино'] as $v) {
    $again = city_normalize($v);
    if ($again === $v) { $ok++; printf("  [ок]   %s\n", $v); }
    else { $bad++; printf("  [СБОЙ] %s → %s\n", $v, $again); }
}

/* Показ без выдумок */
echo "\nПОКАЗ БЕЗ ВЫДУМОК\n$line\n";
$d1 = city_display('', '—');
if ($d1 === '—') { $ok++; echo "  [ок]   пустой город не превращается в страну\n"; }
else { $bad++; echo "  [СБОЙ] пустой город даёт «$d1»\n"; }

/* Что осталось в базе */
echo "\nЧТО В БАЗЕ\n$line\n";
$badRows = all("SELECT city, COUNT(*) c FROM applications
                 WHERE city LIKE 'Россия, %Беларус%' OR city LIKE 'Россия, %Дубай%'
                    OR city LIKE '%г. Р.п.%' OR city LIKE 'Россия, г. %край%'
                 GROUP BY 1");
if (!$badRows) { $ok++; echo "  [ок]   заявок с неверной страной не осталось\n"; }
else {
    $bad++;
    foreach ($badRows as $r) printf("  [СБОЙ] %s — %d шт.\n", (string) $r['city'], (int) $r['c']);
}

foreach (all("SELECT DISTINCT substr(city, 1, instr(city || ',', ',') - 1) AS country, COUNT(*) c
                FROM applications WHERE TRIM(COALESCE(city,'')) <> ''
               GROUP BY 1 ORDER BY c DESC") as $r) {
    printf("  страна в заявках: %-42s %d\n", (string) $r['country'], (int) $r['c']);
}

echo "\n$line\nПРОЙДЕНО: $ok · СБОЕВ: $bad\n";
exit($bad > 0 ? 1 : 0);
