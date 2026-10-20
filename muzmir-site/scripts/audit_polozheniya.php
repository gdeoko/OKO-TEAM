<?php
/**
 * ПОЛОЖЕНИЯ: ПУНКТЫ ВЛАДЕЛЬЦА НА МЕСТЕ, И ПЕРЕГЕНЕРАЦИЯ ИХ НЕ СОТРЁТ.
 *
 * Разбор 14.10.2026. Положение конкурса собирается заново ИЗ ЭТАЛОНА при каждом
 * сохранении конкурса в админке (regulation_generate), а пункты, продиктованные
 * владельцем, дописывались только в живые файлы. Пункт 7.10 про возврат взноса
 * (слово владельца 13.10) первое же сохранение «Мирового акцента» стёрло
 * начисто. Полтора месяца это не выстреливало лишь потому, что copy() падал на
 * правах файла: положения правились из консоли под root, а пересобирает их
 * веб-сервер под www-data. То есть пункт держала СЛУЧАЙНОСТЬ, и она же прятала
 * отказ в журнале nginx.
 *
 * Эта проверка ТОЛЬКО ЧИТАЕТ. Проверка, которая сохраняет форму, сама становится
 * действием: ровно так 14.10.2026 прогон audit_admin.php разослал по всей базе
 * анонс закрытого конкурса (правило 49).
 *
 *   php scripts/audit_polozheniya.php
 */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { fwrite(STDERR, "CLI only\n"); exit(1); }

define('BASE_PATH', dirname(__DIR__));
$GLOBALS['CFG'] = require BASE_PATH . '/config.php';
require_once BASE_PATH . '/core/db.php';
require_once BASE_PATH . '/core/helpers.php';
require_once BASE_PATH . '/core/chat_regulation.php';

$OK = 0; $FAIL = 0;
function sec(string $t): void { echo "\n=== $t ===\n"; }
function ok(string $t, string $v = ''): void { global $OK; $OK++; echo "  ok   $t" . ($v !== '' ? "  [$v]" : '') . "\n"; }
function bad(string $t, string $v = ''): void { global $FAIL; $FAIL++; echo "  FAIL $t" . ($v !== '' ? "  [$v]" : '') . "\n"; }
function chk(string $t, bool $good, string $v = ''): void { $good ? ok($t, $v) : bad($t, $v); }

/* ПУНКТЫ, ДОПИСАННЫЕ ПОВЕРХ ЭТАЛОНА ПО СЛОВУ ВЛАДЕЛЬЦА.
   Каждый обязан быть и в живых положениях, и в эталонах: иначе он уходит при
   первой перегенерации, а конкурсы следующего месяца (их заводят заново,
   правило 11) родятся без него. */
const PUNKTY_VLADELCA = [
    '7.10' => 'возврат оргвзноса при отклонённой заявке (слово владельца 13.10.2026)',
];

/* Эталоны, по которым правда собираются положения: платный, бесплатный, клубный
   (см. regulation_generate). Остальные файлы в docs/polozheniya не в работе. */
const ETALONY_V_RABOTE = ['etalon_2.docx', 'etalon_4.docx', 'etalon_5.docx'];

sec('Эталоны держат пункты владельца');
foreach (ETALONY_V_RABOTE as $f) {
    $path = BASE_PATH . '/docs/polozheniya/' . $f;
    if (!is_file($path)) { bad("$f — файла нет"); continue; }
    $txt = reg_docx_text($path);
    if ($txt === '') { bad("$f — текст не читается"); continue; }
    foreach (PUNKTY_VLADELCA as $no => $про) {
        chk("$f: п. $no ($про)", str_contains($txt, $no . '.'));
    }
    chk("$f: пункты разбираются", count(reg_points_from_text($txt)) >= 30,
        (string) count(reg_points_from_text($txt)));
}

sec('Живые положения открытых конкурсов');
$откр = all("SELECT id, name, slug, status, regulation_pdf FROM competitions
              WHERE status = 'open' AND COALESCE(regulation_pdf,'') <> '' ORDER BY id");
chk('у каждого открытого конкурса есть файл положения',
    count($откр) === (int) (scalar("SELECT COUNT(*) FROM competitions WHERE status='open'") ?? 0),
    count($откр) . ' из ' . (int) (scalar("SELECT COUNT(*) FROM competitions WHERE status='open'") ?? 0));
foreach ($откр as $c) {
    $path = (string) $c['regulation_pdf'];
    if (!is_file($path)) { bad("«{$c['name']}»: файла нет", $path); continue; }
    $txt = reg_docx_text($path);
    foreach (PUNKTY_VLADELCA as $no => $про) {
        chk("«{$c['name']}»: п. $no на месте", str_contains($txt, $no . '.'));
    }
}

sec('Перегенерация из админки не упадёт на правах');
/* Положения правятся из консоли под root, а пересобирает их www-data. Файл,
   оставшийся root:root, перезаписать нельзя, и в журнале nginx копится
   «Не удалось скопировать эталон» — ошибка, которую никто не ищет. */
$чужие = [];
foreach (glob(BASE_PATH . '/public/uploads/regulations/*.docx') ?: [] as $f) {
    if (str_contains($f, '.bak-')) continue;
    $вл = function_exists('posix_getpwuid') ? (posix_getpwuid((int) fileowner($f))['name'] ?? '?') : (string) fileowner($f);
    if ($вл !== 'www-data') $чужие[] = basename($f) . " ($вл)";
}
chk('файлы положений принадлежат веб-серверу', $чужие === [], implode(', ', $чужие));
foreach (['scripts/reg_point_add.php', 'scripts/reg_text_replace.php'] as $инстр) {
    chk("$инстр возвращает владельца после правки",
        str_contains((string) @file_get_contents(BASE_PATH . '/' . $инстр), 'reg_file_vladelec'));
}
chk('у инструмента правки есть ключ --file для эталона',
    str_contains((string) @file_get_contents(BASE_PATH . '/scripts/reg_point_add.php'), "'file::'"));

sec('Бот видит положение целиком');
$prompt = chat_regulation_prompt();
chk('блок правил собран', mb_strlen($prompt) > 5000, mb_strlen($prompt) . ' знаков');
foreach (PUNKTY_VLADELCA as $no => $про) {
    chk("в правилах бота есть п. $no", str_contains($prompt, $no));
}

echo "\n================ ИТОГ ================\n";
echo "ok: $OK, FAIL: $FAIL\n";
if ($FAIL === 0) echo "Пункты владельца на месте, и перегенерация их не сотрёт.\n";
exit($FAIL === 0 ? 0 : 1);
