<?php
/**
 * ОТБОР СООБЩЕСТВ: КОМУ НАШ КОНКУРС ВООБЩЕ ИНТЕРЕСЕН.
 *
 * Поиск ВКонтакте отвечает широко: по запросу «конкурсы для детей» он приносит и
 * методическое объединение педагогов, и телеканал, и сеть магазинов. Постить во
 * второе и третье бессмысленно, а выглядит как спам, и именно за это сообщества
 * получают жалобы.
 *
 * Здесь каждому найденному сообществу считается пригодность: по названию, роду
 * деятельности и описанию. Плюсы даются за то, что говорит о нашей аудитории
 * (педагоги, школа искусств, дом культуры, детское творчество, конкурсы,
 * аттестация), минусы — за явно чужое (магазины, телеканалы, спорт, юмор,
 * знакомства, барахолки). Считается и размер: сообщество на сто тысяч человек,
 * где о конкурсах вспоминают раз в год, полезнее маленького, но профильного
 * далеко не всегда.
 *
 * Ничего не публикует. Только раскладывает список по полкам.
 *
 *   php scripts/vk_rank_communities.php           — пересчитать и показать
 *   php scripts/vk_rank_communities.php --csv     — выгрузить пригодные строками
 */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { fwrite(STDERR, "CLI only\n"); exit(1); }

define('BASE_PATH', dirname(__DIR__));
$GLOBALS['CFG'] = require BASE_PATH . '/config.php';
require_once BASE_PATH . '/core/db.php';
require_once BASE_PATH . '/core/helpers.php';

$csv  = in_array('--csv', $argv, true);
$line = str_repeat('=', 78);

try { db()->exec("ALTER TABLE vk_communities ADD COLUMN score INTEGER DEFAULT 0"); } catch (\Throwable $e) {}
try { db()->exec("ALTER TABLE vk_communities ADD COLUMN why TEXT DEFAULT ''"); } catch (\Throwable $e) {}

/** За что прибавляем. Вес тем выше, чем ближе к нашему участнику. */
const PLUS = [
    // прямое попадание: те, кто приводит детей на конкурс
    'школа искусств' => 10, 'дши' => 10, 'дмш' => 10, 'музыкальная школа' => 10,
    'дом культуры' => 9, 'дк ' => 6, 'сдк' => 7, 'кдц' => 7, 'клуб' => 2,
    'дворец культуры' => 9, 'центр творчества' => 9, 'дом творчества' => 9,
    'дополнительного образования' => 9, 'доп образования' => 8,
    'педагог' => 8, 'преподавател' => 8, 'учител' => 6, 'методист' => 8,
    'хореограф' => 8, 'вокал' => 7, 'хормейстер' => 8, 'концертмейстер' => 8,
    'работник культуры' => 9, 'культуры и искусства' => 7,
    // то, ради чего идут на конкурс
    'конкурс' => 7, 'фестивал' => 6, 'олимпиад' => 4, 'аттестац' => 9,
    'портфолио' => 8, 'повышение квалификации' => 6, 'диплом' => 5,
    // творчество детей
    'детское творчество' => 8, 'юны' => 4, 'дарован' => 6, 'талант' => 5,
    'хореографи' => 6, 'изостуди' => 7, 'декоративно' => 6, 'прикладн' => 5,
    'театральн' => 5, 'художественн' => 4, 'творческ' => 4,
    'ансамбл' => 5, 'хор ' => 4, 'оркестр' => 5,
    // родители
    'родител' => 4, 'мамы' => 2, 'развитие детей' => 3,
];

/** За что вычитаем: сообщество явно не про нас. */
const MINUS = [
    'магазин' => 12, 'скидк' => 10, 'распродаж' => 12, 'барахолк' => 14, 'куплю' => 12,
    'телеканал' => 14, 'сериал' => 14, 'кино' => 8, 'музыка слушать' => 8,
    'спорт' => 10, 'футбол' => 14, 'хоккей' => 14, 'ufc' => 14, 'бокс' => 12,
    'знакомств' => 14, 'юмор' => 12, 'приколы' => 14, 'мем' => 12,
    '新闻' => 10, '新' => 8, 'казино' => 14, 'ставки' => 14, 'крипт' => 14,
    'работа вахт' => 12, 'вакансии' => 6, 'недвижимост' => 12, 'авто' => 10,
    'подслушано' => 8, 'новости города' => 6, 'типичный' => 6,
    'красот' => 8, 'маникюр' => 12, 'фитнес' => 10, 'похуд' => 12,
    'банк' => 10, 'кредит' => 14, 'займ' => 14,
];

$rows = all("SELECT id, name, activity, description, members, wall FROM vk_communities");
echo "ОТБОР СООБЩЕСТВ\n$line\n  всего в списке: " . count($rows) . "\n";

$upd = db()->prepare("UPDATE vk_communities SET score=?, why=? WHERE id=?");
$stat = ['годные' => 0, 'сомнительные' => 0, 'мимо' => 0];
foreach ($rows as $r) {
    $hay = ' ' . mb_strtolower((string) $r['name'] . ' ' . (string) $r['activity'] . ' '
         . mb_substr((string) $r['description'], 0, 400)) . ' ';
    $score = 0; $why = [];
    foreach (PLUS as $w => $v)  if (mb_strpos($hay, $w) !== false) { $score += $v; $why[] = '+' . $w; }
    foreach (MINUS as $w => $v) if (mb_strpos($hay, $w) !== false) { $score -= $v; $why[] = '-' . $w; }
    // Размер добавляет немного и только тем, кто уже прошёл по смыслу: иначе
    // миллионник про сериалы обгонит профильное объединение педагогов.
    if ($score > 0) {
        $m = (int) $r['members'];
        $score += $m >= 100000 ? 6 : ($m >= 20000 ? 4 : ($m >= 5000 ? 2 : 0));
    }
    $upd->execute([$score, mb_substr(implode(' ', array_slice($why, 0, 8)), 0, 200), (int) $r['id']]);
    if ($score >= 12)      $stat['годные']++;
    elseif ($score >= 5)   $stat['сомнительные']++;
    else                   $stat['мимо']++;
}
foreach ($stat as $k => $v) printf("  %-14s %d\n", $k, $v);

/* ── Что с этим делать ────────────────────────────────────────────────────── */
$fit    = (int) (scalar("SELECT COUNT(*) FROM vk_communities WHERE score>=12") ?? 0);
$fitOpen= (int) (scalar("SELECT COUNT(*) FROM vk_communities WHERE score>=12 AND wall=1") ?? 0);
$reach  = (int) (scalar("SELECT COALESCE(SUM(members),0) FROM vk_communities WHERE score>=12 AND wall=1") ?? 0);
$reachAll=(int) (scalar("SELECT COALESCE(SUM(members),0) FROM vk_communities WHERE score>=12") ?? 0);

echo "\nПРИГОДНЫЕ СООБЩЕСТВА\n$line\n";
printf("  по смыслу подходят: %d, суммарная аудитория %s\n", $fit, number_format($reachAll, 0, '.', ' '));
printf("  из них со свободной стеной: %d, аудитория %s\n", $fitOpen, number_format($reach, 0, '.', ' '));
printf("  остальным нужно писать администратору: %d\n", $fit - $fitOpen);

echo "\nСВОБОДНАЯ СТЕНА, ПОСТИТЬ МОЖНО САМИМ\n$line\n";
$i = 0;
foreach (all("SELECT name, screen_name, members, city, score FROM vk_communities
              WHERE score>=12 AND wall=1 ORDER BY score DESC, members DESC LIMIT 60") as $r) {
    printf("  %3d  %8s  %-42s vk.com/%s\n", (int) $r['score'],
        number_format((int) $r['members'], 0, '.', ' '),
        mb_substr((string) $r['name'], 0, 42), (string) $r['screen_name']);
    $i++;
}
if ($i === 0) echo "  ни одного: у всех подходящих стена закрыта, идём через админов\n";

echo "\nПОДХОДЯТ, НО ЧЕРЕЗ АДМИНИСТРАТОРА\n$line\n";
foreach (all("SELECT name, screen_name, members, score FROM vk_communities
              WHERE score>=12 AND wall<>1 ORDER BY members DESC LIMIT 40") as $r) {
    printf("  %3d  %8s  %-42s vk.com/%s\n", (int) $r['score'],
        number_format((int) $r['members'], 0, '.', ' '),
        mb_substr((string) $r['name'], 0, 42), (string) $r['screen_name']);
}

if ($csv) {
    echo "\nВЫГРУЗКА (ссылка;название;людей;стена;пригодность)\n$line\n";
    foreach (all("SELECT name, screen_name, members, wall, score FROM vk_communities
                  WHERE score>=12 ORDER BY score DESC, members DESC") as $r) {
        printf("https://vk.com/%s;%s;%d;%s;%d\n", (string) $r['screen_name'],
            str_replace(';', ',', (string) $r['name']), (int) $r['members'],
            (int) $r['wall'] === 1 ? 'открыта' : 'закрыта', (int) $r['score']);
    }
}
