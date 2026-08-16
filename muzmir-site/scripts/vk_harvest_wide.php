<?php
/**
 * ШИРОКИЙ СБОР СООБЩЕСТВ: СКОЛЬКО ИХ ВООБЩЕ ЕСТЬ ПО НАШЕЙ ТЕМЕ.
 *
 * Первый сбор шёл полусотней общих запросов и нашёл 2 396 сообществ. Это не
 * потолок, а предел одного запроса: поиск ВКонтакте отдаёт около сотни лучших
 * совпадений и на этом останавливается, сколько ни листай. Значит, чтобы
 * увидеть страну целиком, спрашивать надо не «дом культуры», а «дом культуры
 * Псковская область» — и так по каждому региону.
 *
 * Здесь темы умножаются на регионы: три десятка тем на восемь десятков
 * регионов дают тысячи разных запросов, и каждый приносит свою сотню. Это
 * единственный честный способ оценить объём: не «сколько мы нашли», а
 * «сколько там есть».
 *
 * Наружу не пишет ничего, только читает поиск. Повторный запуск дубли не
 * плодит: сообщество узнаётся по id.
 *
 *   php scripts/vk_harvest_wide.php            — полный проход
 *   php scripts/vk_harvest_wide.php 5          — первые пять регионов, для пробы
 */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { fwrite(STDERR, "CLI only\n"); exit(1); }

define('BASE_PATH', dirname(__DIR__));
$GLOBALS['CFG'] = require BASE_PATH . '/config.php';
require_once BASE_PATH . '/core/db.php';
require_once BASE_PATH . '/core/helpers.php';
require_once BASE_PATH . '/core/vk.php';
require_once BASE_PATH . '/core/vk_promo.php';

$limitReg = (int) ($argv[1] ?? 0);
$line = str_repeat('=', 78);

/** Темы: кто приводит детей на конкурс и кому нужны наши дипломы. */
const WIDE_TOPICS = [
    'школа искусств', 'музыкальная школа', 'художественная школа', 'дом культуры',
    'центр детского творчества', 'дом детского творчества', 'дворец культуры',
    'детский сад', 'педагоги', 'учителя', 'учитель музыки', 'преподаватели',
    'хореография дети', 'вокал дети', 'хор', 'ансамбль танца', 'изостудия',
    'театральная студия', 'конкурсы для детей', 'детское творчество',
    'работники культуры', 'методисты', 'родители школьников', 'многодетные семьи',
    'дополнительное образование', 'аттестация педагогов', 'управление культуры',
    'отдел образования', 'библиотека', 'краеведческий музей',
];

/** Регионы: поиск отдаёт свою сотню на каждый, поэтому страна берётся по частям. */
const WIDE_REGIONS = [
    'Москва', 'Санкт-Петербург', 'Московская область', 'Ленинградская область',
    'Адыгея', 'Алтай', 'Башкортостан', 'Бурятия', 'Дагестан', 'Ингушетия',
    'Кабардино-Балкария', 'Калмыкия', 'Карачаево-Черкесия', 'Карелия', 'Коми',
    'Крым', 'Марий Эл', 'Мордовия', 'Якутия', 'Северная Осетия', 'Татарстан',
    'Тыва', 'Удмуртия', 'Хакасия', 'Чечня', 'Чувашия',
    'Алтайский край', 'Забайкальский край', 'Камчатский край', 'Краснодарский край',
    'Красноярский край', 'Пермский край', 'Приморский край', 'Ставропольский край',
    'Хабаровский край', 'Амурская область', 'Архангельская область', 'Астраханская область',
    'Белгородская область', 'Брянская область', 'Владимирская область', 'Волгоградская область',
    'Вологодская область', 'Воронежская область', 'Ивановская область', 'Иркутская область',
    'Калининградская область', 'Калужская область', 'Кемеровская область', 'Кировская область',
    'Костромская область', 'Курганская область', 'Курская область', 'Липецкая область',
    'Магаданская область', 'Мурманская область', 'Нижегородская область', 'Новгородская область',
    'Новосибирская область', 'Омская область', 'Оренбургская область', 'Орловская область',
    'Пензенская область', 'Псковская область', 'Ростовская область', 'Рязанская область',
    'Самарская область', 'Саратовская область', 'Сахалинская область', 'Свердловская область',
    'Смоленская область', 'Тамбовская область', 'Тверская область', 'Томская область',
    'Тульская область', 'Тюменская область', 'Ульяновская область', 'Челябинская область',
    'Ярославская область', 'Севастополь', 'Ханты-Мансийский', 'Ямало-Ненецкий', 'Чукотка',
];

vkc_wide_migrate();

/** Хранилище то же, что у первого сбора: vk_communities. */
function vkc_wide_migrate(): void {
    db()->exec("CREATE TABLE IF NOT EXISTS vk_communities (
        id INTEGER PRIMARY KEY, name TEXT DEFAULT '', screen_name TEXT DEFAULT '',
        members INTEGER DEFAULT 0, wall INTEGER DEFAULT 0, is_closed INTEGER DEFAULT 0,
        city TEXT DEFAULT '', activity TEXT DEFAULT '', description TEXT DEFAULT '',
        found_by TEXT DEFAULT '', status TEXT DEFAULT 'new', posted_at TEXT DEFAULT '',
        note TEXT DEFAULT '', created_at TEXT DEFAULT (datetime('now','localtime')))");
    foreach (["ALTER TABLE vk_communities ADD COLUMN score INTEGER DEFAULT 0",
              "ALTER TABLE vk_communities ADD COLUMN can_suggest INTEGER DEFAULT 0",
              "ALTER TABLE vk_communities ADD COLUMN region TEXT DEFAULT ''"] as $sql) {
        try { db()->exec($sql); } catch (\Throwable $e) {}
    }
}

$regions = $limitReg > 0 ? array_slice(WIDE_REGIONS, 0, $limitReg) : WIDE_REGIONS;
$queries = count($regions) * count(WIDE_TOPICS);

printf("ШИРОКИЙ СБОР\n%s\n  тем %d × регионов %d = %d запросов, примерно %d минут\n\n",
    $line, count(WIDE_TOPICS), count($regions), $queries, (int) ceil($queries * 0.42 / 60));

$before = (int) (scalar("SELECT COUNT(*) FROM vk_communities") ?? 0);
$seen = [];      // id => [запрос, регион]
$done = 0;

foreach ($regions as $reg) {
    $newHere = 0;
    foreach (WIDE_TOPICS as $topic) {
        $done++;
        $r = vk_api('groups.search', ['q' => $topic . ' ' . $reg, 'count' => 100, 'sort' => 0]);
        usleep(360000);
        if (isset($r['error'])) continue;
        foreach (($r['response']['items'] ?? []) as $g) {
            $id = (int) ($g['id'] ?? 0);
            if ($id <= 0 || isset($seen[$id])) continue;
            $seen[$id] = [$topic, $reg];
            $newHere++;
        }
    }
    printf("  %-28s найдено новых %4d   (запросов %d из %d)\n", $reg, $newHere, $done, $queries);
}

printf("\n  всего разных сообществ в выдаче: %d\n", count($seen));

/* ── Подробности пачками: у поиска нет ни размера, ни стены ── */
echo "\nУТОЧНЯЕМ ПОДРОБНОСТИ\n$line\n";
$saved = $skipped = 0;
$ins = db()->prepare("INSERT INTO vk_communities
    (id,name,screen_name,members,wall,can_suggest,is_closed,city,activity,description,found_by,region)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
    ON CONFLICT(id) DO UPDATE SET
      name=excluded.name, members=excluded.members, wall=excluded.wall,
      can_suggest=excluded.can_suggest, city=excluded.city,
      activity=excluded.activity, description=excluded.description");

foreach (array_chunk(array_keys($seen), 350) as $chunk) {
    $r = vk_api('groups.getById', [
        'group_ids' => implode(',', $chunk),
        'fields'    => 'members_count,description,city,activity,wall,can_post,can_suggest',
    ]);
    usleep(360000);
    if (isset($r['error'])) continue;
    foreach (($r['response']['groups'] ?? $r['response'] ?? []) as $g) {
        $id = (int) ($g['id'] ?? 0);
        if ($id <= 0) continue;
        $members = (int) ($g['members_count'] ?? 0);
        $closed  = (int) ($g['is_closed'] ?? 0);
        if ($members < 300 || $closed !== 0) { $skipped++; continue; }
        [$topic, $reg] = $seen[$id] ?? ['', ''];
        try {
            $ins->execute([
                $id, mb_substr((string) ($g['name'] ?? ''), 0, 200), (string) ($g['screen_name'] ?? ''),
                $members, (int) ($g['wall'] ?? 0), (int) ($g['can_suggest'] ?? 0), $closed,
                (string) ($g['city']['title'] ?? ''), mb_substr((string) ($g['activity'] ?? ''), 0, 120),
                mb_substr((string) ($g['description'] ?? ''), 0, 600), $topic, $reg,
            ]);
            $saved++;
        } catch (\Throwable $e) {}
    }
}
printf("  сохранено: %d, отсеяно мелких и закрытых: %d\n", $saved, $skipped);

/* ── Что получилось ── */
$after = (int) (scalar("SELECT COUNT(*) FROM vk_communities") ?? 0);
$sum   = (int) (scalar("SELECT COALESCE(SUM(members),0) FROM vk_communities") ?? 0);
$open  = (int) (scalar("SELECT COUNT(*) FROM vk_communities WHERE wall=1") ?? 0);
$sugg  = (int) (scalar("SELECT COUNT(*) FROM vk_communities WHERE wall<>1 AND can_suggest=1") ?? 0);

echo "\nИТОГ\n$line\n";
printf("  было %d, стало %d (+%d)\n", $before, $after, $after - $before);
printf("  суммарная аудитория: %s человек\n", number_format($sum, 0, '.', ' '));
printf("  открытых стен: %d, предложек: %d\n", $open, $sugg);
echo "  дальше: php scripts/vk_rank_communities.php — отобрать профильные\n";
