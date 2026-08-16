<?php
/**
 * СБОР СООБЩЕСТВ ВКОНТАКТЕ, ГДЕ МОЖНО РАССКАЗАТЬ О КОНКУРСАХ.
 *
 * Постить в чужие сообщества вслепую бессмысленно и вредно: в половине из них
 * стена закрыта, в другой половине сидят не те люди, а за пачку одинаковых
 * сообщений сообщество улетает в бан. Поэтому сначала список, и список честный:
 * по каждому сообществу видно, сколько там людей, открыта ли стена для чужих
 * записей и о чём оно вообще.
 *
 * Как работает. По набору поисковых запросов обходится поиск ВКонтакте, найденные
 * сообщества добираются пакетом (у поиска нет ни числа участников, ни состояния
 * стены), отсеиваются закрытые и мелкие, и всё складывается в таблицу
 * vk_communities. Повторный запуск не плодит дубли: сообщество узнаётся по id.
 *
 * СТЕНА. Значение wall у ВКонтакте: 0 выключена, 1 открытая (писать могут все),
 * 2 ограниченная (пишут только администраторы), 3 закрытая. Нам интересна
 * единица: только туда можно положить анонс своими руками. Остальные попадают в
 * список тоже, но помечаются: в них дорога через личное сообщение админу.
 *
 *   php scripts/vk_harvest_communities.php            — собрать и показать
 *   php scripts/vk_harvest_communities.php --report   — только показать собранное
 */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { fwrite(STDERR, "CLI only\n"); exit(1); }

define('BASE_PATH', dirname(__DIR__));
$GLOBALS['CFG'] = require BASE_PATH . '/config.php';
require_once BASE_PATH . '/core/db.php';
require_once BASE_PATH . '/core/helpers.php';
require_once BASE_PATH . '/core/vk.php';

$reportOnly = in_array('--report', $argv, true);
$line = str_repeat('=', 78);

/** Хранилище найденного. Создаётся лениво. */
function vkc_migrate(): void {
    db()->exec("CREATE TABLE IF NOT EXISTS vk_communities (
        id INTEGER PRIMARY KEY,
        name TEXT DEFAULT '',
        screen_name TEXT DEFAULT '',
        members INTEGER DEFAULT 0,
        wall INTEGER DEFAULT 0,
        is_closed INTEGER DEFAULT 0,
        city TEXT DEFAULT '',
        activity TEXT DEFAULT '',
        description TEXT DEFAULT '',
        found_by TEXT DEFAULT '',
        status TEXT DEFAULT 'new',
        posted_at TEXT DEFAULT '',
        note TEXT DEFAULT '',
        created_at TEXT DEFAULT (datetime('now','localtime')))");
    db()->exec("CREATE INDEX IF NOT EXISTS idx_vkc_members ON vk_communities(members)");
    db()->exec("CREATE INDEX IF NOT EXISTS idx_vkc_wall ON vk_communities(wall)");
}
vkc_migrate();

/**
 * ЗАПРОСЫ ПОИСКА.
 *
 * Собраны по трём кругам людей, которые приводят детей на конкурс:
 * педагоги дополнительного образования, руководители учреждений культуры и
 * родители. Плюс отдельно те, кто ищет конкурсы ради аттестации и портфолио.
 */
const VKC_QUERIES = [
    // педагоги и методисты
    'педагоги дополнительного образования', 'преподаватели ДШИ', 'детская школа искусств',
    'детская музыкальная школа', 'методисты культуры', 'работники культуры',
    'преподаватель вокала', 'преподаватель хореографии', 'учитель музыки',
    'учитель ИЗО', 'педагог хореограф', 'концертмейстер', 'хормейстер',
    'руководитель творческого коллектива', 'дом культуры', 'центр детского творчества',
    'дворец культуры', 'сельский дом культуры', 'клубное формирование',
    'школа искусств педагоги', 'методическое объединение культура',
    // конкурсы и фестивали
    'конкурсы для детей', 'детские конкурсы и фестивали', 'творческие конкурсы',
    'дистанционные конкурсы', 'онлайн конкурсы для детей', 'международные конкурсы творчества',
    'всероссийские конкурсы', 'конкурсы для педагогов', 'фестивали детского творчества',
    'конкурсы вокал', 'конкурсы хореография', 'конкурсы рисунок дети',
    'конкурс чтецов', 'театральные конкурсы дети', 'конкурсы декоративно прикладное',
    'олимпиады и конкурсы', 'афиша детских конкурсов',
    // аттестация и портфолио
    'аттестация педагогов', 'портфолио педагога', 'дипломы для аттестации',
    'повышение квалификации педагогов культуры',
    // родители и дети
    'родители юных талантов', 'мама творческого ребёнка', 'детское творчество',
    'таланты России дети', 'юные дарования',
];

if (!$reportOnly) {
    echo "СБОР СООБЩЕСТВ ВКОНТАКТЕ\n$line\n";
    $seen = [];      // id => по какому запросу нашли
    $q = 0;
    foreach (VKC_QUERIES as $query) {
        $q++;
        $r = vk_api('groups.search', ['q' => $query, 'count' => 100, 'sort' => 0]);
        if (isset($r['error'])) {
            printf("  %-46s ОШИБКА: %s\n", mb_substr($query, 0, 46),
                (string) ($r['error']['error_msg'] ?? '?'));
            usleep(400000);
            continue;
        }
        $items = $r['response']['items'] ?? [];
        $new = 0;
        foreach ($items as $g) {
            $id = (int) ($g['id'] ?? 0);
            if ($id <= 0 || isset($seen[$id])) continue;
            $seen[$id] = $query;
            $new++;
        }
        printf("  %-46s найдено %3d, новых %3d\n", mb_substr($query, 0, 46), count($items), $new);
        // ВКонтакте считает частоту обращений: три запроса в секунду с токена.
        usleep(400000);
    }
    echo "\n  всего разных сообществ: " . count($seen) . "\n";

    /* Добираем подробности пакетами: у поиска нет ни числа участников, ни стены. */
    echo "\nУТОЧНЯЕМ ПОДРОБНОСТИ\n$line\n";
    $ids = array_keys($seen);
    $saved = 0; $skipped = 0;
    foreach (array_chunk($ids, 400) as $chunk) {
        $r = vk_api('groups.getById', [
            'group_ids' => implode(',', $chunk),
            'fields'    => 'members_count,description,city,activity,wall,can_post',
        ]);
        $groups = $r['response']['groups'] ?? $r['response'] ?? [];
        if (isset($r['error'])) { echo '  ошибка пакета: ' . (string) ($r['error']['error_msg'] ?? '?') . "\n"; usleep(400000); continue; }
        foreach ($groups as $g) {
            $id = (int) ($g['id'] ?? 0);
            if ($id <= 0) continue;
            $members = (int) ($g['members_count'] ?? 0);
            $closed  = (int) ($g['is_closed'] ?? 0);
            // Мелочь и закрытые не нужны: в первое некому читать, во второе не попасть.
            if ($members < 500 || $closed !== 0) { $skipped++; continue; }
            $row = [
                'id'          => $id,
                'name'        => mb_substr((string) ($g['name'] ?? ''), 0, 200),
                'screen_name' => (string) ($g['screen_name'] ?? ''),
                'members'     => $members,
                'wall'        => (int) ($g['wall'] ?? 0),
                'is_closed'   => $closed,
                'city'        => (string) ($g['city']['title'] ?? ''),
                'activity'    => mb_substr((string) ($g['activity'] ?? ''), 0, 120),
                'description' => mb_substr((string) ($g['description'] ?? ''), 0, 600),
                'found_by'    => (string) ($seen[$id] ?? ''),
            ];
            try {
                q("INSERT INTO vk_communities (id,name,screen_name,members,wall,is_closed,city,activity,description,found_by)
                   VALUES (:id,:name,:screen_name,:members,:wall,:is_closed,:city,:activity,:description,:found_by)
                   ON CONFLICT(id) DO UPDATE SET
                     name=excluded.name, members=excluded.members, wall=excluded.wall,
                     city=excluded.city, activity=excluded.activity, description=excluded.description", $row);
                $saved++;
            } catch (\Throwable $e) {}
        }
        usleep(400000);
    }
    printf("  сохранено: %d, отсеяно мелких и закрытых: %d\n", $saved, $skipped);
}

/* ── Отчёт ────────────────────────────────────────────────────────────────── */
echo "\nЧТО СОБРАНО\n$line\n";
$tot = (int) (scalar("SELECT COUNT(*) FROM vk_communities") ?? 0);
$open = (int) (scalar("SELECT COUNT(*) FROM vk_communities WHERE wall=1") ?? 0);
$sumOpen = (int) (scalar("SELECT COALESCE(SUM(members),0) FROM vk_communities WHERE wall=1") ?? 0);
$sumAll = (int) (scalar("SELECT COALESCE(SUM(members),0) FROM vk_communities") ?? 0);
printf("  сообществ всего: %d, суммарная аудитория %s\n", $tot, number_format($sumAll, 0, '.', ' '));
printf("  со ОТКРЫТОЙ стеной (можно постить самим): %d, аудитория %s\n",
    $open, number_format($sumOpen, 0, '.', ' '));
printf("  с ограниченной стеной (только через админа): %d\n",
    (int) (scalar("SELECT COUNT(*) FROM vk_communities WHERE wall<>1") ?? 0));

echo "\nОТКРЫТАЯ СТЕНА, ПЕРВЫЕ 40 ПО РАЗМЕРУ\n$line\n";
foreach (all("SELECT name, screen_name, members, city, found_by FROM vk_communities
              WHERE wall=1 ORDER BY members DESC LIMIT 40") as $r) {
    printf("  %8s  %-44s vk.com/%s\n", number_format((int) $r['members'], 0, '.', ' '),
        mb_substr((string) $r['name'], 0, 44), (string) $r['screen_name']);
}

echo "\nСАМЫЕ КРУПНЫЕ БЕЗ ОТКРЫТОЙ СТЕНЫ (писать админу)\n$line\n";
foreach (all("SELECT name, screen_name, members FROM vk_communities
              WHERE wall<>1 ORDER BY members DESC LIMIT 15") as $r) {
    printf("  %8s  %-44s vk.com/%s\n", number_format((int) $r['members'], 0, '.', ' '),
        mb_substr((string) $r['name'], 0, 44), (string) $r['screen_name']);
}
