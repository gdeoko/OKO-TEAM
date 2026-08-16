<?php
/**
 * НАЙТИ СООБЩЕСТВА УЧРЕЖДЕНИЙ, КОТОРЫХ У НАС ЕЩЁ НЕТ.
 *
 * В базе 40 742 учреждения, но ссылка на сообщество ВКонтакте есть только у
 * 16 463. Остальные существуют во ВКонтакте почти все — просто при сборе их
 * страницы не попались. Пока ссылки нет, второго канала до учреждения нет тоже:
 * ни обращения в сообщения, ни анонса на стене.
 *
 * ПОЧЕМУ В ДВА ШАГА. Поиск ВКонтакте отдаёт только имя и идентификатор: ни
 * города, ни описания. По одному имени сопоставлять нельзя — «Детская школа
 * искусств» в стране их тысячи, и первая попавшаяся окажется чужой, а мы
 * напишем чужому учреждению именное обращение с его названием. Поэтому сначала
 * собираем кандидатов поиском, потом одним запросом добираем по ним город и
 * описание и только тогда решаем.
 *
 * КАК РЕШАЕМ. Совпадение считается по значимым словам названия (служебное вроде
 * МБУДО, «муниципальное», «имени» отбрасывается) и обязательно подтверждается
 * городом или регионом. Ниже порога — не берём: пустая карточка лучше, чем
 * обращение не тому адресату.
 *
 * Наружу ничего не пишет: только проставляет vk_id в карточке учреждения.
 * Дальше сообщество подхватывает перепись площадок (vk_scan_targets).
 *
 *   php scripts/vk_find_institutions.php            — порция 300
 *   php scripts/vk_find_institutions.php 3000       — порция побольше
 *   php scripts/vk_find_institutions.php 30 --show  — показать, что нашлось и с какой уверенностью
 *   php scripts/vk_find_institutions.php 30 --dry   — ничего не сохранять
 */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { fwrite(STDERR, "CLI only\n"); exit(1); }

define('BASE_PATH', dirname(__DIR__));
$GLOBALS['CFG'] = require BASE_PATH . '/config.php';
require_once BASE_PATH . '/core/db.php';
require_once BASE_PATH . '/core/helpers.php';
require_once BASE_PATH . '/core/vk.php';

$limit = max(1, (int) ($argv[1] ?? 300));
$show  = in_array('--show', $argv, true);
$dry   = in_array('--dry', $argv, true);
$line  = str_repeat('=', 78);

/** Служебное в названиях: формы собственности и сокращения ведомств. */
const VKF_NOISE = ['мбудо','мбдоу','мбоу','мбук','мкук','мку','мау','маудо','мадоу','моу','гбоу','гбудо',
                   'гаудо','гбук','гау','мбу','фгбоу','ано','ноу','мкоу','мудо','мауд','гбо',
                   'имени','им','муниципальное','бюджетное','казённое','казенное','автономное','государственное',
                   'учреждение','учреждения','образовательное','образования','дополнительного','филиал'];

/** Значимые слова: то, чем одно учреждение отличается от другого. */
function vkf_tokens(string $s): array {
    $s = mb_strtolower($s);
    $s = str_replace(['«','»','"',"'",'(',')',',','.','№','-','–','—','/','\\'], ' ', $s);
    $out = [];
    foreach (preg_split('~\s+~u', $s) ?: [] as $w) {
        $w = trim($w);
        if (mb_strlen($w) < 3) continue;
        if (in_array($w, VKF_NOISE, true)) continue;
        $out[] = $w;
    }
    return array_values(array_unique($out));
}

/** Расшифровка привычных сокращений: в базе ДШИ, в сообществе «школа искусств». */
function vkf_expand(string $s): string {
    $map = [
        'дши' => 'детская школа искусств', 'дмш' => 'детская музыкальная школа',
        'дхш' => 'детская художественная школа', 'дхорш' => 'детская хоровая школа',
        'сдк' => 'сельский дом культуры', 'кдц' => 'культурно досуговый центр',
        'скц' => 'социально культурный центр', 'цдт' => 'центр детского творчества',
        'ддт' => 'дом детского творчества', 'цвр' => 'центр внешкольной работы',
        'дк'  => 'дом культуры', 'дши№' => 'детская школа искусств',
    ];
    $low = mb_strtolower($s);
    foreach ($map as $abbr => $full) {
        if (preg_match('~(^|[^а-яё])' . $abbr . '([^а-яё]|$)~u', $low)) $low .= ' ' . $full;
    }
    return $low;
}

/**
 * РОДОВЫЕ СЛОВА: они есть у половины учреждений страны.
 *
 * «Детская музыкальная школа» совпадает у школы в Уфе и школы в Сибае целиком,
 * и по такому совпадению одно сообщество получают три разных учреждения. Значит,
 * родовая часть названия ничего не доказывает: доказывает только отличительная —
 * топоним, фамилия в названии, номер.
 */
const VKF_GENERIC = ['детская','детский','детское','музыкальная','музыкальная','художественная','хоровая',
                     'школа','школы','искусств','искусство','дом','дома','культуры','сельский','районный',
                     'центр','центра','творчества','досуговый','культурно','социально','клуб','дворец',
                     'библиотека','сад','гимназия','лицей','колледж','училище','техникум','студия','ансамбль'];

/** Отличительные слова названия: то, чем это учреждение не похоже на соседнее. */
function vkf_distinct(array $tokens): array {
    return array_values(array_filter($tokens, static fn(string $w): bool => !in_array($w, VKF_GENERIC, true)));
}

/** Номера в названии: «ДМШ № 4» и «ДМШ № 7» — разные школы. */
function vkf_numbers(string $s): array {
    preg_match_all('~№\s*(\d{1,3})|\b(\d{1,3})\s*(?=[»"]?\s*$)~u', $s, $m);
    $out = array_filter(array_merge($m[1] ?? [], $m[2] ?? []), static fn($x) => $x !== '');
    return array_values(array_unique($out));
}

/**
 * Населённый пункт прямо из названия учреждения.
 *
 * «МБУ ДО ДМШ № 4 ГО г. Уфа РБ» → «уфа», «ГБО ДО РА «ДШИ с. Натырбово»» →
 * «натырбово», «МАУ ДО ДШИ МР Бижбулякский район» → «бижбулякский». Поле «город»
 * в базе почти всегда пустое, а вот в названии место есть почти всегда.
 */
function vkf_place(string $name): string {
    $low = mb_strtolower($name);
    if (preg_match('~\b(?:г|гор|с|село|п|пос|пгт|рп|ст|станица|д|деревня|аул|а)\.?\s*([а-яё\-]{4,})~u', $low, $m)) {
        return $m[1];
    }
    if (preg_match('~\b([а-яё\-]{5,})\s+район~u', $low, $m)) return $m[1];
    return '';
}

/**
 * Похоже ли сообщество на это учреждение: 0..100.
 *
 * Правила строгие намеренно. Именное обращение, ушедшее чужой школе, стоит
 * дороже, чем пустая карточка: адресат видит в тексте не своё название и
 * закрывает диалог, а мы теряем и его, и того, кому письмо предназначалось.
 *
 *   1. Совпасть должно отличительное слово, а не только родовое.
 *   2. Город обязателен. Регион не подтверждает ничего: в области сотня ДШИ.
 *   3. Номера, если они есть у обоих, обязаны совпасть.
 */
function vkf_match(array $inst, array $group): int {
    $instName = (string) ($inst['name'] ?? '');
    $grpName  = (string) ($group['name'] ?? '');

    $nameT = vkf_tokens(vkf_expand($instName));
    $hayS  = vkf_expand($grpName . ' ' . (string) ($group['description'] ?? '')
           . ' ' . (string) ($group['activity'] ?? ''));
    $grpT  = vkf_tokens($hayS);
    if (!$nameT || !$grpT) return 0;

    $matched = [];
    foreach ($nameT as $w) {
        $stem = mb_substr($w, 0, max(4, (int) floor(mb_strlen($w) * 0.7)));
        foreach ($grpT as $g) {
            if (mb_strpos($g, $stem) === 0) { $matched[] = $w; break; }
        }
    }
    if (!$matched) return 0;

    // 1. Без отличительного совпадения решать не на чем.
    $distinctAll = vkf_distinct($nameT);
    $distinctHit = vkf_distinct($matched);
    if ($distinctAll && !$distinctHit) return 0;

    // 3. Номера: «ДМШ №4» и «ДМШ №7» — не одно и то же.
    $nA = vkf_numbers($instName);
    $nB = vkf_numbers($grpName);
    if ($nA && $nB && !array_intersect($nA, $nB)) return 0;

    $score = (int) round(count($matched) / count($nameT) * 100);

    /* 2. Место.
     *
     * Поле «город» в карточке почти всегда пустое: из 24 279 учреждений без
     * ссылки оно заполнено у 134. Зато место почти всегда стоит в самом
     * названии: «ДШИ с. Натырбово», «ДМШ ГО г. Уфа», «Шовгеновская ДШИ».
     * Оттуда его и берём, а если места нет и там, опорой служит отличительное
     * слово названия: оно почти всегда и есть топоним или фамилия.
     */
    $hay   = $hayS . ' ' . mb_strtolower((string) ($group['city']['title'] ?? ''));
    $place = mb_strtolower(trim((string) ($inst['city'] ?? '')));
    $place = trim(preg_replace('~^(г|с|п|пос|ст|д|аул|а|рп|пгт)\.?\s*~u', '', $place) ?? $place);
    if ($place === '' || mb_strlen($place) < 4) $place = vkf_place($instName);

    if ($place !== '') {
        // Место известно — оно обязано подтвердиться, иначе это другая школа
        // с тем же названием в другом районе.
        $stem = mb_substr($place, 0, max(4, mb_strlen($place) - 1));
        if (mb_strpos($hay, $stem) === false) return 0;
    } elseif (count($distinctHit) < 1) {
        return 0;
    }

    return min(100, $score);
}

echo "ПОИСК СООБЩЕСТВ УЧРЕЖДЕНИЙ\n$line\n";

$rows = all("SELECT id, name, city, region FROM institutions
              WHERE vk_id = 0 AND COALESCE(name,'') <> ''
                AND COALESCE(note,'') NOT LIKE '%vk-нет%'
              ORDER BY id LIMIT :l", ['l' => $limit]);
printf("  в работе: %d учреждений (всего без ссылки %d)\n\n",
    count($rows), (int) (scalar("SELECT COUNT(*) FROM institutions WHERE vk_id=0") ?? 0));

/* ── Шаг 1: кандидаты поиском ───────────────────────────────────────────── */
$cand = [];      // institution_id => [group_id, ...]
$ids  = [];      // все group_id к добору
foreach ($rows as $inst) {
    $city = trim((string) $inst['city']);
    $q = trim(mb_substr((string) $inst['name'], 0, 60) . ($city !== '' ? ' ' . $city : ''));
    $r = vk_api('groups.search', ['q' => $q, 'count' => 8, 'sort' => 0]);
    usleep(360000);
    if (isset($r['error'])) continue;
    foreach (($r['response']['items'] ?? []) as $g) {
        $gid = (int) ($g['id'] ?? 0);
        if ($gid <= 0 || (int) ($g['is_closed'] ?? 0) !== 0) continue;
        $cand[(int) $inst['id']][] = $gid;
        $ids[$gid] = true;
    }
}
printf("  кандидатов собрано: %d у %d учреждений\n", count($ids), count($cand));

/* ── Шаг 2: подробности пачками ─────────────────────────────────────────── */
$info = [];
foreach (array_chunk(array_keys($ids), 350) as $chunk) {
    $r = vk_api('groups.getById', [
        'group_ids' => implode(',', $chunk),
        'fields'    => 'members_count,description,city,activity,wall,can_post,can_suggest',
    ]);
    usleep(360000);
    if (isset($r['error'])) continue;
    foreach (($r['response']['groups'] ?? $r['response'] ?? []) as $g) {
        $info[(int) ($g['id'] ?? 0)] = $g;
    }
}
printf("  подробности получены: %d\n\n", count($info));

/* ── Шаг 3: решение ─────────────────────────────────────────────────────── */
/*
 * Сначала выбираем лучшее сообщество для каждого учреждения, и только потом
 * раздаём. Иначе на одно сообщество претендуют несколько однотипных школ
 * («ДШИ» и «ДХШ №1» одного города), и забирает его не самая похожая, а та,
 * что раньше стоит в списке.
 */
$pick = [];   // institution_id => ['gid'=>, 'group'=>, 'score'=>]
foreach ($rows as $inst) {
    $best = null; $bestScore = 0;
    foreach ($cand[(int) $inst['id']] ?? [] as $gid) {
        $g = $info[$gid] ?? null;
        if (!$g) continue;
        $s = vkf_match($inst, $g);
        if ($s > $bestScore) { $bestScore = $s; $best = $g; }
    }
    if ($best && $bestScore >= 70) {
        $pick[(int) $inst['id']] = ['gid' => (int) $best['id'], 'group' => $best, 'score' => $bestScore];
    }
}

// Одно сообщество — одному учреждению: побеждает наибольшее сходство.
$byGroup = [];
foreach ($pick as $instId => $p) {
    $gid = $p['gid'];
    if (!isset($byGroup[$gid]) || $p['score'] > $byGroup[$gid]['score']) {
        $byGroup[$gid] = ['inst' => $instId, 'score' => $p['score']];
    }
}
$conflicts = 0;
foreach ($pick as $instId => $p) {
    if (($byGroup[$p['gid']]['inst'] ?? 0) !== $instId) { unset($pick[$instId]); $conflicts++; }
}

$found = $weak = $none = 0;
foreach ($rows as $inst) {
    $instId = (int) $inst['id'];
    $p = $pick[$instId] ?? null;

    if ($p) {
        $gid   = $p['gid'];
        $taken = (int) (scalar("SELECT COUNT(*) FROM institutions WHERE vk_id=?", [$gid]) ?? 0);
        if ($taken === 0) {
            if (!$dry) {
                q("UPDATE institutions SET vk_id=:g, vk=:v WHERE id=:i",
                  ['g' => $gid, 'v' => (string) ($p['group']['screen_name'] ?? ('club' . $gid)), 'i' => $instId]);
            }
            $found++;
            if ($show) printf("  %3d%%  %-42s → vk.com/%-24s %s чел.\n", $p['score'],
                mb_substr((string) $inst['name'], 0, 42), (string) ($p['group']['screen_name'] ?? ''),
                number_format((int) ($p['group']['members_count'] ?? 0), 0, '.', ' '));
            continue;
        }
    }

    // Не нашли уверенно — метка, чтобы следующий прогон не тратил на это запрос.
    if (!$dry) q("UPDATE institutions SET note = TRIM(COALESCE(note,'') || ' vk-нет') WHERE id=:i",
                 ['i' => $instId]);
    if (($cand[$instId] ?? []) !== []) $weak++; else $none++;
}

if ($conflicts > 0) printf("  снято из-за спора за одно сообщество: %d\n", $conflicts);

printf("\n  нашли уверенно: %d\n  слабые совпадения (пропущены): %d\n  ничего не найдено: %d\n",
    $found, $weak, $none);
printf("\n  сообществ у учреждений теперь: %d\n", (int) (scalar("SELECT COUNT(*) FROM institutions WHERE vk_id<>0") ?? 0));
echo "  дальше: php scripts/vk_scan_targets.php — разложить новые по дверям\n";
