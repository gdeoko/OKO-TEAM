<?php
/**
 * scripts/audit_smm.php — ЛЕНТА ЦЕНТРА: ЧТО СОБРАНО, ТО И ВЫЙДЕТ.
 *
 * Заведён в ночь на 15.10.2026, когда афиша Лермонтова (212 лет, повод раз в
 * год) не собралась ни за один заход, и причин оказалось ТРИ, ни одна из
 * которых не кричала:
 *   1. мозг отвечал ВЕРНО, но завёрнутым: `{"input":{...}}`. Имени «input» не
 *      было в списке обёрток, и заслон писал в журнал «мозг молчит»;
 *   2. сторож факта судил поздравление критериями научного редактора и
 *      забраковал его, САМ ЖЕ написав в причине «корректно, выдумки нет»;
 *   3. имя файла картинки строилось по СЛОТУ, а слот переносится: сборка афиши
 *      затёрла картинку другого поста, и оба остались `ready` с картинкой.
 * Плюс в готовом тексте стояло английское «but» посреди русской фразы.
 *
 * ПРОВЕРКА ТОЛЬКО ЧИТАЕТ и мозг не трогает: ни одного платного вызова. Аудит,
 * который пишет, сам становится действием (правила 49 и 51), а тратящий норму
 * мозга аудит оставляет ленту без постов (правило 44).
 *
 * Запуск: php scripts/audit_smm.php
 */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { fwrite(STDERR, "CLI only\n"); exit(1); }
define('BASE_PATH', dirname(__DIR__));
$GLOBALS['CFG'] = require BASE_PATH . '/config.php';
require_once BASE_PATH . '/core/db.php';
require_once BASE_PATH . '/core/helpers.php';
require_once BASE_PATH . '/core/smm.php';
require_once BASE_PATH . '/core/smm_make.php';

$OK = 0; $FAIL = 0;
function sec(string $s): void { echo "\n=== $s ===\n"; }
function ok(string $w, string $i = ''): void { global $OK; $OK++; echo "  ok   $w" . ($i !== '' ? "  [$i]" : '') . "\n"; }
function bad(string $w, string $i = ''): void { global $FAIL; $FAIL++; echo "  FAIL $w" . ($i !== '' ? "  $i" : '') . "\n"; }
function chk(string $w, bool $c, string $i = ''): void { $c ? ok($w, $i) : bad($w, $i); }

sec('Обёртка вокруг ответа мозга разворачивается');
/* Имя обёртки не угадывается, а перечислено: посредник превращает требование
   «только JSON» в вызов инструмента, и аргументы лежат под input/arguments. */
chk('обёртка {"input":{...}} разворачивается',
    smm_json_unwrap(['input' => ['новый_стиль' => '15 октября']]) === ['новый_стиль' => '15 октября'],
    'без этого верный ответ читается как «мозг молчит» - так чуть не потеряли афишу Лермонтова');
chk('обёртка {"value":"{...}"} строкой разворачивается',
    smm_json_unwrap(['value' => '{"scene":"зал"}']) === ['scene' => 'зал']);
chk('обёртка {"arguments":{...}} разворачивается',
    smm_json_unwrap(['arguments' => ['дата' => '4 ноября']]) === ['дата' => '4 ноября']);
/* И НЕ РАЗВОРАЧИВАЕМ ЖИВОЙ ОТВЕТ: у праздника он сам из одного ключа. */
chk('одиночный ключ ответа НЕ разворачивается',
    smm_json_unwrap(['дата' => '15 октября']) === ['дата' => '15 октября'],
    'список имён обязан быть закрытым, иначе ответ праздника развернётся в мусор');
chk('пустой ответ не ломает мерку', smm_json_unwrap([]) === []);

sec('Латиница в русском тексте поста');
$тело = "Сегодня мы вспоминаем поэта: он прожил недолгую, but яркую жизнь. "
      . str_repeat('Текст для набора длины поста центра. ', 40);
$е = smm_validate($тело, smm_compose($тело), 'афиша');
chk('английское слово в теле ловится',
    (bool) preg_grep('~латиница~u', $е), implode(' | ', $е));
$тело2 = "Поэт XIX века и его наследие. " . str_repeat('Текст для набора длины поста центра. ', 40);
$е2 = smm_validate($тело2, smm_compose($тело2), 'афиша');
chk('римские цифры (XIX) не считаются латиницей',
    !preg_grep('~латиница~u', $е2), implode(' | ', $е2));

sec('Сторож факта: у афиши критерии биографические');
$ист = (string) @file_get_contents(BASE_PATH . '/core/smm_make.php');
$истКод = (string) preg_replace(['~/\*.*?\*/~su', '~//[^\n]*~u'], '', $ист);
chk('афиша судится как история, а не как исследование',
    substr_count($истКод, "\$вид === 'история' || \$вид === 'афиша'") >= 2,
    'нужно в ДВУХ ветках: и проверка факта, и починка факта');
chk('модели сказано не ставить doubt на подтверждённом',
    mb_strpos($ист, 'это НЕ повод для') !== false,
    'она писала «корректно, выдумки нет» и всё равно браковала');

sec('Имя файла картинки - по номеру поста, а не по слоту');
chk('мерка smm_image_path() есть', function_exists('smm_image_path'));
if (function_exists('smm_image_path')) {
    chk('имя содержит номер поста', mb_strpos(smm_image_path(777), 'post_777') !== false, smm_image_path(777));
}
foreach (['cron/smm_prepare.php', 'cron/smm_keyart_refresh.php', 'cron/smm_image_retry.php'] as $f) {
    $s = (string) preg_replace(['~/\*.*?\*/~su', '~//[^\n]*~u'], '', (string) @file_get_contents(BASE_PATH . '/' . $f));
    chk(basename($f) . ' зовёт smm_image_path', mb_strpos($s, 'smm_image_path(') !== false);
    chk(basename($f) . ' не строит имя по слоту',
        !preg_match("~data/smm/'\s*\.\s*\\\$(date|p\['slot_date'\])~u", $s),
        'слот переносится, и такое имя затирает картинку чужого поста');
}

sec('ФАКТ по очереди: ни один файл не делят два поста');
$по = [];
foreach (all("SELECT id, slot_date, slot_hour, status, image_path FROM smm_posts
               WHERE COALESCE(image_path,'') <> ''") as $r)
    $по[(string) $r['image_path']][] = '#' . (int) $r['id'] . ' (' . $r['slot_date'] . ' ' . $r['slot_hour'] . 'ч)';
$столк = [];
foreach ($по as $f => $l) if (count($l) > 1) $столк[] = basename((string) $f) . ': ' . implode(' + ', $l);
chk('столкновений файлов нет', $столк === [], implode('; ', $столк));
$нет = [];
foreach (all("SELECT id, image_path FROM smm_posts WHERE status='ready' AND COALESCE(image_path,'') <> ''") as $r)
    if (!is_file((string) $r['image_path'])) $нет[] = '#' . (int) $r['id'];
chk('у готовых постов файл картинки на диске', $нет === [], implode(', ', $нет));

sec('Повод сегодня и завтра: собран ли');
$дни = [date('Y-m-d'), date('Y-m-d', strtotime('+1 day'))];
foreach ($дни as $д) {
    $повод = smm_kal_повод($д);
    if (!$повод) { ok("на {$д} повода нет - афиша не нужна"); continue; }
    $имя = (string) ($повод['имя'] ?? '');
    $пост = one("SELECT id,status,COALESCE(keyart,'') ka,COALESCE(image_path,'') img
                   FROM smm_posts WHERE slot_date=? AND kind='афиша'", [$д]);
    if (!$пост) {
        /* Для СЕГОДНЯШНЕГО повода это провал: день не перенесёшь. Завтрашний
           ещё соберётся - подготовка открывает дни с поводом на неделю вперёд. */
        $д === date('Y-m-d')
            ? bad("афиша на {$д} («{$имя}») НЕ собрана", 'повод уйдёт на год')
            : ok("афиша на {$д} («{$имя}») пока не собрана - успеет");
        continue;
    }
    /* ВЫШЕДШАЯ АФИША ЭТО УСПЕХ, А НЕ ПРОВАЛ. Проверка писалась ночью, когда
       повод ещё ждал слота, и требовала ровно `ready`: в 10:00 афиша ушла в
       ленту, стала `published` - и аудит покраснел на удачно сделанной работе.
       Красное на ровном месте прячет настоящие отказы (правило 47). */
    $сост = (string) $пост['status'];
    chk("афиша на {$д} («{$имя}») готова или вышла",
        in_array($сост, ['ready', 'published'], true), $сост);
    chk("у афиши на {$д} есть кадр", trim((string) $пост['ka']) !== '');
    chk("у афиши на {$д} есть картинка",
        trim((string) $пост['img']) !== '' && is_file((string) $пост['img']));
    /* Память сверки даты: она бессрочная, и по ней видно, чем кончилась проверка. */
    $к = smm_kal_ключ_сверки($повод);
    $п = (string) setting($к, '');
    chk("дата повода на {$д} сверена", $п !== '' && mb_strpos($п, '"ок":true') !== false,
        $п === '' ? 'в памяти пусто - сверка ещё не проходила' : $п);
}

sec('Кадр с настоящим человеком: лицо не вырезается, поздравление не про гибель');

/* ОБА ЗАСЛОНА КУПЛЕНЫ ЖИВЫМИ КАДРАМИ В НОЧЬ НА 15.10.2026, и оба видно только
   глазами: пост при этом лежит `ready` с нулём ошибок. */
chk('список монтажей, запрещённых при портрете, есть',
    defined('SMM_KA_MONTAGES_NO_FACE') && SMM_KA_MONTAGES_NO_FACE !== [],
    defined('SMM_KA_MONTAGES_NO_FACE') ? implode(', ', SMM_KA_MONTAGES_NO_FACE) : '');
chk('«сквозной-силуэт» в нём',
    defined('SMM_KA_MONTAGES_NO_FACE') && in_array('сквозной-силуэт', SMM_KA_MONTAGES_NO_FACE, true),
    'эта ось дословно просит вырезать героя - афиша Лермонтова вышла с фигурой БЕЗ ЛИЦА');
$ка = (string) @file_get_contents(BASE_PATH . '/core/smm_keyart.php');
chk('память слота не возвращает запрещённый монтаж',
    mb_strpos($ка, 'SMM_KA_MONTAGES_NO_FACE, true))') !== false,
    'тройка идемпотентна по слоту, и без проверки пересборка вернула бы ту же безликую фигуру');
$мк = (string) @file_get_contents(BASE_PATH . '/core/smm_make.php');
/* Смотрим ОКНО после вызова, а не «до первой скобки»: у второго аргумента
   свои скобки (`trim((string) $персона) !== ''`), и шаблон `[^)]*` обрывался на
   них - проверка краснела на верном коде. Форму кода спрашиваем у кода. */
$позТройки = mb_strpos($мк, 'smm_ka_triple(');
chk('портрет передаётся в выбор осей',
    $позТройки !== false && mb_strpos(mb_substr($мк, $позТройки, 220), 'персона') !== false);
chk('у афиши в задании сцены стоит запрет на оружие и траур',
    mb_strpos($мк, 'BIRTHDAY GREETING') !== false && mb_strpos($мк, 'duelling case') !== false,
    'на поздравлении к 212-летию мозг положил на стол дуэльный пистолет');

/* ФАКТ по собранным кадрам: нет ли в сохранённом промпте афиши примет гибели. */
$оруж = [];
foreach (all("SELECT id, image_prompt FROM smm_posts
               WHERE kind='афиша' AND COALESCE(image_prompt,'') <> ''") as $r) {
    $t = mb_strtolower((string) $r['image_prompt']);
    foreach (['pistol', 'duel', 'grave', 'funeral', 'mourning', 'coffin'] as $w) {
        /* «no weapon, duel, …» это НАШ запрет, а не примета в сцене: он стоит
           после слова NEVER, и считать его находкой значит краснеть на себе
           (правила 40, 48). Смотрим только то, что до блока запретов. */
        $часть = mb_substr($t, 0, (int) (mb_strpos($t, 'never') ?: mb_strlen($t)));
        if (mb_strpos($часть, $w) !== false) { $оруж[] = '#' . (int) $r['id'] . ': ' . $w; break; }
    }
}
chk('в сценах афиш нет оружия и примет гибели', $оруж === [], implode(', ', $оруж));

sec('Кадр современный, яркий и жизнерадостный (слово владельца 15.10.2026)');

/* ПРАВКА ВЛАДЕЛЬЦА 15.10.2026: «фотографии и плакаты выглядят старомодно,
   блекло, тускло и скучно… должны быть современными, яркими и жизнерадостными,
   в современном модном стиле и соответствовать той информации, которая
   публикуется в посте».
   Причины тусклости были НАЗВАНЫ В САМОМ ПРОМПТЕ, а не угаданы, поэтому и
   проверяются по промпту. Пояснения из исходников снимаются лексером: в них
   снятые слова названы НАРОЧНО, чтобы следующая сессия не вернула их вслепую, и
   поиск по сырому файлу краснел бы на нашем же разборе (правила 40, 48, 63). */
$живой = static function (string $путь): string {
    $s = (string) @file_get_contents(BASE_PATH . '/' . $путь);
    $о = '';
    foreach (token_get_all($s) as $t) {
        if (is_array($t) && in_array($t[0], [T_COMMENT, T_DOC_COMMENT], true)) continue;
        $о .= is_array($t) ? $t[1] : $t;
    }
    return $о;
};
$каЖ = $живой('core/smm_keyart.php');
$мкЖ = $живой('core/smm_make.php');

chk('зерно плёнки снято', mb_stripos($каЖ, 'fine grain') === false,
    '«fine grain» это плёночная примета, и она делала кадр старомодным');
chk('отделка названа современной',
    mb_stripos(SMM_KA_FINISH, 'contemporary') !== false && mb_stripos(SMM_KA_FINISH, 'no film grain') !== false);
chk('цвет требует яркости', mb_stripos(SMM_KA_COLOUR_RULE, 'bright') !== false
    && mb_stripos(SMM_KA_COLOUR_RULE, 'saturated') !== false);
chk('цвет запрещает выцветшее и серое', mb_stripos(SMM_KA_COLOUR_RULE, 'faded') !== false
    && mb_stripos(SMM_KA_COLOUR_RULE, 'washed out') !== false,
    'ровно это владелец назвал «блекло и тускло»');
chk('запреты на тонировку остались', mb_stripos(SMM_KA_COLOUR_RULE, 'teal-and-orange') !== false
    && mb_stripos(SMM_KA_COLOUR_RULE, 'sepia') !== false,
    'слово 13.10 про «цветные и естественные» не отменено, а уточнено');
chk('герой одет современно и живой', mb_stripos(SMM_KA_HERO, 'modern clothes') !== false
    && mb_stripos(SMM_KA_HERO, 'smiles') !== false);

/* Тусклые ключи сняты, и их имена не должны вернуться из памяти слота. */
chk('тусклых цветовых ключей в наборе нет',
    !array_key_exists('пасмурный-ровный', SMM_KA_COLOUR) && !array_key_exists('вечерний-дом-тёплый', SMM_KA_COLOUR),
    'первый дословно просил «colours calm, shadows pale», второй - полумрак');
chk('ключей цвета по-прежнему восемь', count(SMM_KA_COLOUR) === 8, (string) count(SMM_KA_COLOUR));
chk('память слота не возвращает снятую ось',
    mb_strpos($каЖ, "array_key_exists((string) (\$прежнее['цвет'] ?? ''), SMM_KA_COLOUR)") !== false,
    'на снятое имя сборка отбивает кадр целиком: пост остался бы без плаката');

/* Задание сцены: про тему поста, в современном светлом месте, жизнерадостно. */
chk('сцена обязана быть про тему поста', mb_stripos($мкЖ, 'ABOUT THE TOPIC') !== false,
    'слово владельца: «чтобы они соответствовали той информации, которая публикуется в посте»');
chk('место современное и светлое', mb_stripos($мкЖ, 'modern Russian setting') !== false
    && mb_stripos($мкЖ, 'well kept') !== false);
chk('старомодных мест в задании не осталось',
    mb_stripos($мкЖ, 'an old music school hall') === false && mb_stripos($мкЖ, 'village club') === false,
    'именно сюда задание звало модель, и оттуда шла «старомодность»');
chk('обшарпанное и устаревшее запрещено словами', mb_stripos($мкЖ, 'shabby, dusty or dated') !== false);
chk('настроение названо, а не оставлено на вкус модели',
    mb_stripos($мкЖ, 'cheerful') !== false && mb_stripos($мкЖ, 'contemporary 2020s') !== false);

/* ЗАЧИН БЕЗ ПРОДОЛЖЕНИЯ. Обрубок целым оборотом: длина в коридоре, точка на
   месте, а модель всё равно просят выдумать окончание. Проверка даром. */
$осиП = ['монтаж' => array_key_first(SMM_KA_MONTAGES), 'типографика' => array_key_first(SMM_KA_TYPO), 'цвет' => array_key_first(SMM_KA_COLOUR), 'приём' => array_key_first(SMM_KA_PRIEM)];
$осн = 'Inside a sunlit freshly renovated rehearsal hall with tall windows and light wood floors, a warm-smiling ensemble of three women and two men aged about sixty to seventy, grey-haired and dressed in bright modern knitwear, gathers closely around a laptop standing on a tripod next to a small acoustic panel while a young sound engineer carefully adjusts a studio microphone, and the musicians lean in together, eyes lit with excitement, just before the very first chord is played.';
$rЗ = smm_ka_prompt($осн . ' Around this central moment, a girl marks the beat on a bright polished floor while a smiling teacher laughs at the playback on a tablet and open sheet music lies in the sun.',
    'adults 55-75', $осиП, 'совет', 'ЗАГОЛОВОК', 'подзаголовок');
preg_match('~THE MONTAGE\. (.*?) Built this way~us', (string) ($rЗ['промпт'] ?? ''), $mЗ);
$сцЗ = trim($mЗ[1] ?? '');
chk('зачин без продолжения снимается', $сцЗ !== '' && !preg_match('~\bAround this central moment\.?$~ui', $сцЗ),
    'живой кадр #21 15.10.2026 кончался словами «Around this central moment.»');
chk('после снятия зачина точка одна', $сцЗ !== '' && !str_ends_with($сцЗ, '..'), mb_substr($сцЗ, -40));

/* Законченный оборот с предлогом не теряем: цена ошибки в эту сторону - пять слов. */
$rП = smm_ka_prompt(str_repeat('A bright hall with big windows, a teacher claps the beat, students laugh and lean in together. ', 4)
    . 'In the corner a cellist tunes his strings quietly.', 'adults', $осиП, 'совет', 'A', 'b');
preg_match('~THE MONTAGE\. (.*?) Built this way~us', (string) ($rП['промпт'] ?? ''), $mП);
chk('законченный оборот с предлогом не срезан', mb_strpos(trim($mП[1] ?? ''), 'cellist tunes') !== false);

/* СВОД ПО ВСЕМ СОЧЕТАНИЯМ: коридор - число владельца, его не поднимают, а
   обрезка не имеет права съесть сцену, ради которой кадр и собирается. */
$сц330 = mb_substr(str_repeat('A sunlit rehearsal studio with big windows: a teenage violinist mid-phrase, her teacher clapping the beat, sheet music fluttering off the stand. ', 3), 0, 330);
$хвост330 = mb_substr(rtrim(trim((string) preg_replace('~\s+~u', ' ', $сц330)), ' .'), -30);
$вне = 0; $обрез = 0; $нет = 0; $макс = 0; $всего = 0;
foreach (array_keys(SMM_KA_MONTAGES) as $м3) foreach (array_keys(SMM_KA_TYPO) as $т3) foreach (array_keys(SMM_KA_COLOUR) as $ц3) foreach (array_keys(SMM_KA_PRIEM) as $п3) {
    $r3 = smm_ka_prompt($сц330, 'adults 26-45', ['монтаж' => $м3, 'типографика' => $т3, 'цвет' => $ц3, 'приём' => $п3], 'совет', 'ЗАГОЛОВОК ПОСТА', 'подзаголовок строкой');
    $всего++;
    if (empty($r3['ок'])) { $нет++; continue; }
    $L3 = mb_strlen((string) $r3['промпт']);
    if ($L3 > $макс) $макс = $L3;
    if ($L3 < SMM_KA_MIN || $L3 > SMM_KA_MAX) $вне++;
    if (mb_strpos((string) $r3['промпт'], $хвост330) === false) $обрез++;
}
chk('все сочетания собираются', $нет === 0, "не собралось $нет из $всего");
chk('все сочетания в коридоре', $вне === 0, "вне коридора $вне, самый длинный $макс при потолке " . SMM_KA_MAX);
chk('сцена не урезана ни разу при 330 знаках', $обрез === 0, "урезано $обрез");

/* ───────── ФУТЕР УХОДИТ СЕГОДНЯШНИЙ, А НЕ ВЧЕРАШНИЙ ─────────
 *
 * `text_full` собирается в подготовке и лежит в очереди до трёх дней, а решения
 * владельца приходят каждую неделю. 15.10.2026 афиша Лермонтова ушла в 10:00 со
 * СТАРОЙ субботой: график сменили утром, в настройках и во всех живых выходах он
 * стал новым, а в тексте поста футер был впаян накануне. Та же грабля, что со
 * слотами ротации ВК (правило 50): запись живёт дольше решения. */
sec('Ось приёма съёмки: кадры не однотипные (слово владельца 15.10.2026)');

/* «Фото не получались однотипными… пускай используются современные технологии
   создания естественного фото, при необходимости даже 3d эффекты… современные
   молодёжные фоны». Три прежние оси не говорили, ЧЕМ И КАК снято: объектив,
   точка съёмки и приём были общими у всех 1152 сочетаний. */
chk('ось приёма съёмки заведена', defined('SMM_KA_PRIEM') && count(SMM_KA_PRIEM) >= 8,
    defined('SMM_KA_PRIEM') ? (string) count(SMM_KA_PRIEM) . ' приёмов' : 'нет');
chk('среди приёмов есть трёхмерные',
    defined('SMM_KA_PRIEM') && count(array_filter(SMM_KA_PRIEM, static fn($v) => mb_stripos($v, '3D') !== false)) >= 2,
    'владелец просил «при необходимости даже 3d эффекты»');
chk('сочетаний стало больше тысячи с лишним',
    count(SMM_KA_MONTAGES) * count(SMM_KA_TYPO) * count(SMM_KA_COLOUR) * count(SMM_KA_PRIEM) >= 10000,
    (string) (count(SMM_KA_MONTAGES) * count(SMM_KA_TYPO) * count(SMM_KA_COLOUR) * count(SMM_KA_PRIEM)));
chk('свод считает приёмы', mb_strpos(smm_ka_svod(), 'приёмов съёмки') !== false);
chk('приём доходит до промпта',
    mb_strpos((string) ($rП['промпт'] ?? ''), 'Shot like this:') !== false);
chk('память слота требует приём',
    mb_strpos($каЖ, "array_key_exists((string) (\$прежнее['приём'] ?? ''), SMM_KA_PRIEM)") !== false,
    'ось заведена позже остальных: без этой строки прежние слоты вечно отдавали бы тройку без приёма');
chk('неполные оси отбиваются',
    empty(smm_ka_prompt('a bright scene with people', 'adults', ['монтаж' => array_key_first(SMM_KA_MONTAGES), 'типографика' => array_key_first(SMM_KA_TYPO), 'цвет' => array_key_first(SMM_KA_COLOUR)], 'совет', 'A', 'b')['ок']));

/* ТЕМНОТА БЫЛА НАПИСАНА В САМИХ ОСЯХ, и это замерено по тексту: «круг-в-центре»
   просил «darker and softer», «лента-подвала» - «over the darkest part». */
$темно = [];
foreach (['монтаж' => SMM_KA_MONTAGES, 'типографика' => SMM_KA_TYPO, 'цвет' => SMM_KA_COLOUR, 'приём' => SMM_KA_PRIEM] as $ось => $набор) {
    foreach ($набор as $k => $v) {
        /* «nothing sinking to black» это НАШ запрет, а не просьба (правила 40, 48). */
        if (preg_match('~(?<!never )(?<!no )(?<!nothing sinking to )\b(darker|darkest|dimmer|gloomy|murky)\b~ui', $v)) $темно[] = $ось . '/' . $k;
    }
}
chk('ни одна ось не просит затемнения', $темно === [], implode(', ', $темно));

sec('Темы разнообразны: совет и история через один, у истории три сюжета');

/* Правка владельца 15.10.2026: «не только советы… но и интересные реальные не
   выдуманные истории из жизни выдающихся деятелей культуры и искусства.
   Интересные и удивительные истории из мира музыкального современного и
   прошлого времени». До неё на 28 постов приходилось 18 советов и 7 историй, и
   история была ТОЛЬКО про человека. */
chk('подвиды истории заведены', defined('SMM_SYUZHETY') && count(SMM_SYUZHETY) >= 3,
    defined('SMM_SYUZHETY') ? implode(', ', array_keys(SMM_SYUZHETY)) : 'нет');
chk('среди сюжетов есть и прошлое, и сегодняшний день',
    defined('SMM_SYUZHETY') && array_key_exists('мир-музыки-прошлое', SMM_SYUZHETY)
        && array_key_exists('мир-музыки-сегодня', SMM_SYUZHETY));
chk('сюжет доходит до задания темы и до текста',
    in_array('сюжет', array_map(static fn($p) => $p->getName(), (new ReflectionFunction('smm_make_topic'))->getParameters()), true)
    && in_array('сюжет', array_map(static fn($p) => $p->getName(), (new ReflectionFunction('smm_make_body'))->getParameters()), true));

$смж = $живой('core/smm_make.php');
chk('текст сюжета лежит в одном месте', mb_strpos($смж, 'SMM_SYUZHETY[$сюжет]') !== false
    && mb_strpos($смж, 'СЛУЧАЙ из жизни выдающегося деятеля') === false,
    'вторая копия обещания расходится молча (правила 33, 35, 45, 47, 56а, 64)');
chk('в задании текста истории нет жёсткого «о деятеле культуры»',
    mb_strpos($смж, 'ПОСТ-ИСТОРИЯ О ДЕЯТЕЛЕ КУЛЬТУРЫ') === false,
    'история бывает и про премьеру, инструмент или зал - человека там нет вовсе');
chk('сторож факта истории спрашивает не только про человека',
    mb_strpos($смж, 'коллективы, залы') !== false);
/* СУДИМ ПРАВИЛО, А НЕ ИМЯ ПЕРЕМЕННОЙ.
   Здесь стояло `mb_strpos(..., "$предыдущий !== 'история'")`, и 16.10.2026 оно
   покраснело на ВЕРНОМ коде: правило 70в вынесло счёт вида в
   `smm_vid_po_slotu()`, и переменная там зовётся `$пред`. Мерка, которая ждёт
   вчерашнее написание, ломается ровно в день правки (правила 56, 61). Берём
   исходник САМОЙ функции по отражению и смотрим, что правило в ней живо: есть
   сравнение с «историей» и отбор предыдущего поста по слоту. */
$__видИст = (function (): string {
    try {
        $r = new ReflectionFunction('smm_vid_po_slotu');
        $ls = file((string) $r->getFileName()) ?: [];
        return implode('', array_slice($ls, $r->getStartLine() - 1,
                                       $r->getEndLine() - $r->getStartLine() + 1));
    } catch (\Throwable $e) { return ''; }
})();
/* УТРО - ИСТОРИЯ ИЛИ ЗНАМЕНАТЕЛЬНАЯ ДАТА, ВЕЧЕР - СОВЕТ. Правка владельца
   19.10.2026 отменила прежнее чередование «история, если ею не был предыдущий
   пост»: слот решает сам. Судим ПОВЕДЕНИЕМ на будущей дате - вызовы читают. */
$__дБуд = date('Y-m-d', strtotime('+40 days'));
$__утро = smm_vid_po_slotu($__дБуд, SMM_SLOT_MORNING);
$__веч  = smm_vid_po_slotu($__дБуд, SMM_SLOT_EVENING);
chk('утренний слот отдан истории', ($__утро['вид'] ?? '') === 'история',
    json_encode($__утро, JSON_UNESCAPED_UNICODE));
chk('у утренней истории есть сюжет', array_key_exists($__утро['подвид'] ?? '', SMM_SYUZHETY));
chk('вечерний слот отдан совету', ($__веч['вид'] ?? '') === 'совет',
    json_encode($__веч, JSON_UNESCAPED_UNICODE));
chk('вечер даёт историю, когда утро забрала афиша',
    mb_strpos($__видИст, "=== 'афиша'") !== false
    && mb_strpos($__видИст, 'SMM_SLOT_MORNING') !== false,
    'иначе в день с поводом лента не расскажет ни одной истории');
/* ДАТА ПОВОДА ИЩЕТСЯ ПО КАЛЕНДАРЮ, а не вписана: вписанная устареет молча
   (правила 56, 61). Календарь читается из файла, мозг не трогается. */
$__повД = '';
for ($__i = 1; $__i <= 370 && $__повД === ''; $__i++) {
    $__dd = date('Y-m-d', strtotime('+' . $__i . ' days'));
    if (smm_kal_повод($__dd)) $__повД = $__dd;
}
/* СПРАШИВАЕМ ПРО ДЕНЬ ВЫХОДА, А НЕ ПРО ДЕНЬ ПОВОДА, и это не придирка: с
   19.10.2026 повод, попавший на нерабочий день, выходит утром ДО себя, и у
   самого дня повода слота нет вовсе. Проверка, спрашивавшая про день повода,
   покраснела на верном коде в первый же раз - ближайшим поводом оказалось
   100-летие Вишневской 25.10.2026, воскресенье. Мерка, которая ждёт вчерашнее
   поведение, ломается ровно в день правки (правила 56, 61, 72). */
$__повВых = $__повД !== '' ? (string) (smm_slot_povoda($__повД)['date'] ?? '') : '';
if ($__повД === '' || $__повВых === '') {
    ok('дня с поводом в ближайший год нет', 'проверка афиши пропущена');
} else {
    chk('афиша стоит в утреннем слоте дня выхода',
        (smm_pick_kind($__повВых, SMM_SLOT_MORNING)['вид'] ?? '') === 'афиша',
        'повод ' . $__повД . ', выход ' . $__повВых);
    chk('вечером афиши не бывает',
        (smm_pick_kind($__повВых, SMM_SLOT_EVENING)['вид'] ?? '') !== 'афиша',
        $__повВых . ': до правки 19.10 вечер тоже брал афишу, и день целиком говорил о поводе');
}
chk('вид считает один источник',
    mb_strpos($живой('core/smm.php'), 'return smm_vid_po_slotu($slotDate, $slotHour)') !== false,
    'копия правила разошлась бы молча (правило 70в)');

/* ФАКТ: у истории выбирается подвид, у совета - нет. Обе ветки только читают. */
$квИ = smm_pick_kind(date('Y-m-d', strtotime('+30 days')), 10);
chk('у истории есть подвид, у совета его нет',
    ($квИ['вид'] ?? '') !== 'история' || array_key_exists($квИ['подвид'] ?? '', SMM_SYUZHETY),
    json_encode($квИ, JSON_UNESCAPED_UNICODE));

sec('Темы разнообразны: оси направления и стороны совета');
/* ОДНООБРАЗИЕ ТЕМ БЫЛО ЗАМЕРЕНО, А НЕ УГАДАНО (правка владельца 19.10.2026):
   из 25 постов ленты 20 были советами, и почти все про видеозапись, звук и
   восприятие жюри. Антиповтор по корням такого не ловит - слова разные, смысл
   один, - поэтому разнообразие держит ОСЬ, как у кадра (правило 70а). */
chk('оси заведены и закрыты',
    defined('SMM_NAPRAVLENIYA') && count(SMM_NAPRAVLENIYA) === 8
    && defined('SMM_SOVET_STORONY') && count(SMM_SOVET_STORONY) >= 10);
chk('в базе есть колонки под оси',
    (bool) array_intersect(['napravlenie', 'storona'],
        array_column(all('PRAGMA table_info(smm_posts)'), 'name')) );
chk('оси доходят до задания темы',
    (static function (): bool {
        $п = array_map(static fn($p) => $p->getName(),
                       (new ReflectionFunction('smm_make_topic'))->getParameters());
        return in_array('напр', $п, true) && in_array('сторона', $п, true);
    })());
$__подг = $живой('cron/smm_prepare.php');
$__пере = $живой('cron/smm_perepisat.php');
chk('подготовка выбирает оси и пишет их в строку',
    mb_strpos($__подг, "smm_pick_os('napravlenie'") !== false
    && mb_strpos($__подг, "smm_pick_os('storona'") !== false
    && mb_strpos($__подг, "'napravlenie' => ") !== false);
chk('переписывание выбирает оси и пишет их в строку',
    mb_strpos($__пере, "smm_pick_os('napravlenie'") !== false
    && mb_strpos($__пере, "'napravlenie'  => ") !== false);
chk('переписывание исключает себя из памяти оси',
    mb_strpos($__пере, 'SMM_NAPRAVLENIYA, $date, $hour, $id') !== false,
    'иначе пост видит свою же ось соседом и не меняется никогда');
/* ОТРИЦАНИЕМ: после отмены афиши вид обязан считаться тем же источником, а не
   строкой «совет» - с 19.10 утро принадлежит истории. */
chk('после отмены афиши вид считает тот же источник',
    mb_strpos($__подг, "\$вид = 'совет';") === false
    && mb_strpos($__подг, 'smm_vid_po_slotu($date, $hour)') !== false);
chk('история без имени и без года не берётся',
    mb_strpos($живой('core/smm_make.php'), 'история без имени и без года') !== false,
    'пост #63 лежал в очереди как история, а в нём ни имени, ни года, ни события');
/* ФАКТ: ось не повторяет последние заходы. Колонка пуста - печатаем справкой:
   красное на ровном месте прячет настоящие отказы (правила 47, 62). */
$__былиОсь = array_column(all("SELECT napravlenie FROM smm_posts
                                WHERE COALESCE(napravlenie,'') <> ''
                                ORDER BY slot_date DESC, slot_hour DESC LIMIT 4"), 'napravlenie');
if (!$__былиОсь) {
    ok('ось у постов очереди ещё не заполнена', 'ротация проверится на живой очереди');
} else {
    $__новая = smm_pick_os('napravlenie', SMM_NAPRAVLENIYA, $__дБуд, SMM_SLOT_MORNING);
    chk('ось не повторяет последние четыре', !in_array($__новая, $__былиОсь, true),
        $__новая . ' при памяти: ' . implode(', ', $__былиОсь));
}

sec('Футер поста собирается в момент отправки');
chk('помощник свежего футера есть', function_exists('smm_footer_svezhiy'));

$безКом = static function (string $ф): string {
    return (string) preg_replace(['~/\*.*?\*/~su', '~//[^\n]*~u', '~^\s*\*.*$~mu'], '',
                                 (string) @file_get_contents(BASE_PATH . '/' . $ф));
};
chk('отправка зовёт свежий футер', str_contains($безКом('core/smm_make.php'), 'smm_footer_svezhiy('),
    'core/smm_make.php');

/* Тело поста при подмене не трогается: иначе «починка» графика переписала бы
   текст, который владелец мог править руками в админке. */
$обр = one("SELECT id, text_full FROM smm_posts WHERE COALESCE(text_full,'') <> '' ORDER BY id DESC LIMIT 1");
if ($обр) {
    $было  = (string) $обр['text_full'];
    $стало = smm_footer_svezhiy($было);
    $тб = mb_substr($было,  0, (int) mb_strpos($было,  "\u{2501}"));
    $тс = mb_substr($стало, 0, (int) mb_strpos($стало, "\u{2501}"));
    chk('тело поста при подмене футера не меняется', trim($тб) === trim($тс), '#' . (int) $обр['id']);
    chk('текст без разделителя остаётся как есть', smm_footer_svezhiy('без черты') === 'без черты');
}

/* ФАКТ: то, что УЙДЁТ из очереди, равно сегодняшним настройкам. */
$часы = trim((string) cfgv('org_hours', ''));
$тел  = trim((string) cfgv('org_phone', ''));
$плохо = [];
foreach (all("SELECT id, text_full FROM smm_posts WHERE status IN ('draft','ready')
                AND COALESCE(text_full,'') <> ''") as $r) {
    $уйдёт = smm_footer_svezhiy((string) $r['text_full']);
    $ч = rtrim((string) preg_replace('~\s*\(МСК\)\s*$~u', '', $часы), '. ');
    if ($ч !== '' && !str_contains($уйдёт, $ч)) $плохо[] = '#' . (int) $r['id'] . ': график';
    if ($тел !== '' && !str_contains($уйдёт, $тел)) $плохо[] = '#' . (int) $r['id'] . ': телефон';
}
chk('у всех постов очереди уйдут сегодняшние график и телефон', $плохо === [],
    implode('; ', array_slice($плохо, 0, 6)));

sec('Жёсткая цензура кадра: одетые люди и ничего запрещённого');
/* Слово владельца 19.10.2026 после кадра, вышедшего в ленту 19.10 в 10:00: там
   семилетняя девочка стояла БОСИКОМ на деревянной сцене. Сам кадр судит только
   глаз (правило 57а), но СЦЕНУ судит мерка: запрещённое слово видно в ней до
   всякой траты. */
chk('блок приличия заведён', defined('SMM_KA_PRILICHIE') && SMM_KA_PRILICHIE !== '');
$__пр = defined('SMM_KA_PRILICHIE') ? mb_strtolower(SMM_KA_PRILICHIE) : '';
$__нет = [];
foreach (['shoes on', 'bare feet', 'underwear', 'swimwear', 'nudity', 'alcohol', 'tobacco',
          'drugs', 'weapon', 'gambling'] as $с) {
    if (mb_strpos($__пр, $с) === false) $__нет[] = $с;
}
chk('в блоке приличия названо всё запрещённое', $__нет === [], implode(', ', $__нет));

/* ПОВЕДЕНИЕ заслона, а не наличие слова в файле. */
$__a = smm_ka_prilichie('A seven-year-old girl in a red dress stands barefoot on a worn wooden stage.');
chk('слово-определение снимается, предложение остаётся целым',
    !empty($__a['ок']) && mb_stripos((string) $__a['сцена'], 'barefoot') === false
    && str_contains((string) $__a['сцена'], 'stands on a worn wooden stage'), (string) $__a['сцена']);
$__b = smm_ka_prilichie('A teenager in a swimsuit by the pool sings into a microphone.');
chk('оборот про одежду отклоняется целиком', empty($__b['ок']) && ($__b['слово'] ?? '') === 'swimsuit');
$__c = smm_ka_prilichie('An old man with a glass of wine beside the piano.');
chk('запрещённый к показу предмет отклоняется', empty($__c['ок']), (string) ($__c['слово'] ?? 'ПРОШЛО'));
/* «bare stage» и «bare walls» это театральные слова: шаблон по одному «bare»
   краснел бы на пустой сцене без декораций. */
$__d = smm_ka_prilichie('A bare stage with no scenery, a violin resting on a chair.');
chk('театральная «bare stage» не задета', !empty($__d['ок']), (string) $__d['сцена']);

/* ЗАСЛОН СТОИТ В САМОЙ СБОРКЕ, А НЕ РЯДОМ С НЕЙ. */
$__оси = smm_ka_triple('проверка цензуры', false);
$__p1 = smm_ka_prompt('A girl in a swimsuit on a stage', 'children aged about 7 to 12', $__оси,
    'МУЗЫКАЛЬНЫЙ МИР', 'ЗАГОЛОВОК', 'Подзаголовок', '');
chk('кадр с непроходимой сценой не собирается', empty($__p1['ок']), (string) ($__p1['почему'] ?? ''));
$__p2 = smm_ka_prompt('Children sing in a bright modern studio with coloured acoustic panels',
    'children aged about 7 to 12', $__оси, 'МУЗЫКАЛЬНЫЙ МИР', 'ЗАГОЛОВОК', 'Подзаголовок', '');
chk('обычная сцена собирается и несёт блок приличия',
    !empty($__p2['ок']) && str_contains((string) $__p2['промпт'], SMM_KA_PRILICHIE));

/* БЛОК ПРИЛИЧИЯ ЖЕРТВОЙ НЕ БЫВАЕТ НИ ПРИ КАКОЙ ДЛИНЕ. Свод даром: ни одной
   генерации, промпт строится в памяти. */
$__сцена = trim(mb_substr(str_repeat('Aa ', 200), 0, 330));
$__без = 0; $__за = 0; $__n = 0;
foreach ([['children aged about 7 to 12', ''], ['', 'Михаил Лермонтов']] as $__пара) {
    foreach (array_keys(SMM_KA_MONTAGES) as $м)
     foreach (array_keys(SMM_KA_TYPO) as $т)
      foreach (array_keys(SMM_KA_COLOUR) as $ц)
       foreach (array_keys(SMM_KA_PRIEM) as $п) {
         $r = smm_ka_prompt($__сцена, $__пара[0], ['монтаж' => $м, 'типографика' => $т, 'цвет' => $ц, 'приём' => $п],
             'МУЗЫКАЛЬНЫЙ МИР', 'ЗАГОЛОВОК ИЗ ДВУХ СЛОВ', 'Подзаголовок обычной длины', $__пара[1]);
         if (empty($r['ок'])) continue;
         $__n++;
         if (!str_contains((string) $r['промпт'], SMM_KA_PRILICHIE)) $__без++;
         if (mb_strlen((string) $r['промпт']) > SMM_KA_MAX) $__за++;
       }
}
chk('блок приличия есть у КАЖДОГО сочетания', $__без === 0, "без блока $__без из $__n");
chk('коридор промпта соблюдён', $__за === 0, "вне коридора $__за из $__n");

/* ЗАПРЕТ НАЗВАН САМОМУ МОЗГУ: сцену пишет он, и не названный запрет он нарушает
   честно - 16.10 он сам написал «stands barefoot on a worn wooden stage». */
$__ист = (string) file_get_contents(BASE_PATH . '/core/smm_make.php');
chk('в задании сцены мозгу сказано про одежду и обувь', str_contains($__ист, 'WEARS SHOES'));
chk('в задании сцены мозгу названо законодательство', str_contains($__ист, 'may not be published in Russia'));

/* ФАКТ ПО ОЧЕРЕДИ. Судим СЦЕНУ, а не весь промпт: наш же блок приличия называет
   и «bare feet», и «alcohol», и поиск по всему тексту краснел бы на собственном
   запрете - тринадцатый раз эта грабля (правила 40, 48, 56, 57а, 70). */
$__сцену = static function (string $промпт): string {
    return preg_match('~THE MONTAGE\. (.*?)\. Built this way:~su', $промпт, $m) ? mb_strtolower($m[1]) : '';
};
$__слова = array_merge(SMM_KA_SNYAT, SMM_KA_OTKAZ);
$__плохо = []; $__история = [];
foreach (all("SELECT id, status, image_prompt FROM smm_posts WHERE COALESCE(image_prompt,'') <> ''") as $r) {
    $s = $__сцену((string) $r['image_prompt']);
    if ($s === '') continue;
    foreach ($__слова as $с) {
        if (preg_match('~\b' . preg_quote($с, '~') . '~u', $s)) {
            $где = in_array((string) $r['status'], ['draft', 'ready'], true) ? '__плохо' : '__история';
            ${$где}[] = '#' . (int) $r['id'] . ': ' . $с;
            break;
        }
    }
}
chk('у постов очереди в сценах нет запрещённого', $__плохо === [], implode('; ', $__плохо));
/* Опубликованное это история, её кодом не отменить (черта правила 55). */
ok('опубликованных кадров с запрещённым в сцене', $__история === [] ? 'нет' : implode('; ', $__история));
/* ЖЁСТКАЯ ЦЕНЗУРА ТЕКСТА, а не только кадра. */
chk('список запрещённых слов заведён',
    defined('SMM_ZAPRET_SLOVA') && in_array('наркот', SMM_ZAPRET_SLOVA, true));
$__плохой = smm_validate(str_repeat('Слово ', 300) . ' порнография', 'РЕСУРСЫ И КОНТАКТЫ ' . cfgv('org_phone', ''));
chk('валидатор ловит запрещённое слово',
    (bool) array_filter($__плохой, static fn($e) => str_contains((string) $e, 'запрещённое к публикации')));
$__добрый = smm_validate(str_repeat('Слово ', 300), 'РЕСУРСЫ И КОНТАКТЫ ' . cfgv('org_phone', ''));
chk('обычный текст заслон не трогает',
    !array_filter($__добрый, static fn($e) => str_contains((string) $e, 'запрещённое к публикации')));
/* АЛКОГОЛЬ И ТАБАК ВЫКЛЮЧЕНЫ И В ТЕКСТАХ (слово владельца 19.10.2026). Списков
   три, потому что русское слово ловится по-разному, и проверяется ПОВЕДЕНИЕ, а
   не наличие строки в файле: «водк» сидит в «сводке», «пьян» в «фортепьяно». */
chk('корни алкоголя и табака в списках',
    defined('SMM_ZAPRET_NACHALO') && defined('SMM_ZAPRET_TOCHNO') && defined('SMM_ZAPRET_SOCHET')
    && in_array('алкогол', SMM_ZAPRET_SLOVA, true) && in_array('сигар', SMM_ZAPRET_SLOVA, true)
    && in_array('водк', SMM_ZAPRET_NACHALO, true) && in_array('вино', SMM_ZAPRET_TOCHNO, true)
    && in_array('пиво', SMM_ZAPRET_TOCHNO, true) && in_array('бокал вина', SMM_ZAPRET_SOCHET, true));
chk('исключения названы нарочно',
    defined('SMM_ZAPRET_ISKL') && in_array('пьянящ', SMM_ZAPRET_ISKL, true)
    && in_array('табакерк', SMM_ZAPRET_ISKL, true));
$__ловушки = ['Это не его вина, а беда зала', 'Он виноват в срыве номера', 'Виновник овации',
              'Виноград на столе', 'Сводка итогов конкурса', 'Старое фортепьяно в зале',
              'Пьянящий успех после премьеры', 'Музыкальная табакерка Лядова',
              'Курс обучения вокалу', 'Винил и старые пластинки', 'Винтаж в оформлении сцены',
              'Вина оркестра тут нет', 'Прикурить было нечем'];
$__лишнее = [];
foreach ($__ловушки as $__ф) {
    $__н = smm_zapret_v_tekste($__ф);
    if ($__н !== '') $__лишнее[] = $__ф . ' <- ' . $__н;
}
chk('ловушки языка заслон не трогает', $__лишнее === [], implode('; ', $__лишнее));
$__ложь = ['Бокал вина на столе', 'Он выпил вино', 'Рюмка водки', 'Пиво и чипсы',
           'Запах табака в зале', 'Курение за кулисами', 'Сигарета в руке',
           'Шампанское после премьеры', 'Пьяный зритель', 'Виски со льдом', 'Кальян в кафе',
           'Вейп у подростка', 'Пивная кружка'];
$__пропуск = [];
foreach ($__ложь as $__ф) if (smm_zapret_v_tekste($__ф) === '') $__пропуск[] = $__ф;
chk('алкоголь и табак в тексте ловятся', $__пропуск === [], implode('; ', $__пропуск));
/* Заслон обязан стоять в САМОМ валидаторе, одним помощником и без второй копии
   условия. ТЕЛО ФУНКЦИИ БЕРЁТСЯ ОТРАЖЕНИЕМ, а не поиском по файлу: перебор
   списка законно стоит внутри самого помощника, и запрет по всему файлу
   покраснел бы на нашем же коде (правила 40, 48, 63, 72а, 73л). */
$__тело = static function (string $имя): string {
    if (!function_exists($имя)) return '';
    $r = new ReflectionFunction($имя);
    $f = (array) @file((string) $r->getFileName());
    return implode('', array_slice($f, (int) $r->getStartLine() - 1,
                                   (int) $r->getEndLine() - (int) $r->getStartLine() + 1));
};
$__валТ = $__тело('smm_validate');
chk('валидатор зовёт один помощник и своей копии не держит',
    str_contains($__валТ, 'smm_zapret_v_tekste($body')
    && !preg_match('~foreach\s*\(\s*SMM_ZAPRET~u', $__валТ));
$__пив = smm_validate(str_repeat('Слово ', 300) . ' бокал вина на столе',
                      'РЕСУРСЫ И КОНТАКТЫ ' . cfgv('org_phone', ''));
chk('валидатор ловит «бокал вина»',
    (bool) array_filter($__пив, static fn($e) => str_contains((string) $e, 'запрещённое к публикации')));
$__вина = smm_validate(str_repeat('Слово ', 300) . ' это не его вина, а беда зала',
                       'РЕСУРСЫ И КОНТАКТЫ ' . cfgv('org_phone', ''));
chk('валидатор не трогает «не его вина»',
    !array_filter($__вина, static fn($e) => str_contains((string) $e, 'запрещённое к публикации')));
/* ФАКТ по корпусу: двусмысленных слов в списке нет, живые тексты проходят. */
/* СНЯТОЕ АУДИТОМ ИЛИ ЧЕЛОВЕКОМ НЕ СУДИМ: такой пост в ленту не идёт вовсе
   (правило 43), и красное на нём прячет настоящие отказы (правила 47, 62). */
$__тек = []; $__снятые = [];
foreach (all("SELECT id, status, body, COALESCE(error,'') err FROM smm_posts
               WHERE status IN ('draft','ready') AND COALESCE(body,'') <> ''") as $r) {
    $з = smm_zapret_v_tekste((string) $r['body']);
    if ($з === '') continue;
    $куда = ((string) $r['err'] !== '') ? '__снятые' : '__тек';
    ${$куда}[] = '#' . (int) $r['id'] . ': ' . $з;
}
chk('в текстах живой очереди запрещённого нет', $__тек === [], implode('; ', $__тек));
ok('снятые черновики с запрещённым словом', $__снятые === [] ? 'нет' : implode('; ', $__снятые));
sec('Суббота без вечернего поста, а повод не ждёт (слово владельца 19.10.2026)');
/* ДВЕ ВЕЩИ ОДНОГО ЗАМЕСА. Суббота рабочая, но укороченная (10:00-16:00),
   поэтому вечернего поста в ней нет. А повод, попавший на нерабочий день,
   поздравить позже нельзя - он выходит утром ДО себя, и в тексте стоят обе
   даты. Проверка ТОЛЬКО ЧИТАЕТ: ни одного вызова мозга и ни одной записи. */
$__тело = static function (string $имя): string {
    if (!function_exists($имя)) return '';
    $f = new ReflectionFunction($имя);
    $стр = file($f->getFileName());
    return implode('', array_slice($стр, $f->getStartLine() - 1, $f->getEndLine() - $f->getStartLine() + 1));
};
/* Пояснения снимаем лексером: в них снятое и запрещённое названо НАРОЧНО, и
   поиск по сырому тексту краснел бы на нашем же разборе (правила 40, 48, 63). */
$__чист = static function (string $код): string {
    $out = '';
    foreach (token_get_all('<?php ' . $код) as $t) {
        if (is_array($t)) { if ($t[0] === T_COMMENT || $t[0] === T_DOC_COMMENT) continue; $out .= $t[1]; }
        else $out .= $t;
    }
    return $out;
};
/* Даты СЧИТАЕМ от сегодняшнего дня, а не вписываем: вписанная дата устареет
   молча, и проверка станет зелёной ни о чём (правила 56, 61). */
$__дата = static function (int $нужныйДень): string {
    for ($i = 0; $i < 14; $i++) {
        $d = date('Y-m-d', strtotime("+{$i} day"));
        if ((int) date('w', strtotime($d)) === $нужныйДень) return $d;
    }
    return '';
};
$__вс    = $__дата(0);
$__сб    = $__дата(6);
$__будни = (static function (): string {
    for ($i = 0; $i < 14; $i++) {
        $d = date('Y-m-d', strtotime("+{$i} day"));
        $w = (int) date('w', strtotime($d));
        if ($w >= 1 && $w <= 5) return $d;
    }
    return '';
})();

chk('воскресное утро не публикуется',  !smm_slot_rabochiy($__вс, SMM_SLOT_MORNING), $__вс);
chk('воскресный вечер не публикуется', !smm_slot_rabochiy($__вс, SMM_SLOT_EVENING), $__вс);
chk('субботнее утро публикуется',       smm_slot_rabochiy($__сб, SMM_SLOT_MORNING), $__сб);
chk('субботнего вечера в 17:00 НЕТ',   !smm_slot_rabochiy($__сб, SMM_SLOT_EVENING), $__сб . ' 17:00');
chk('будний вечер публикуется',         smm_slot_rabochiy($__будни, SMM_SLOT_EVENING), $__будни);

/* Повод в свой день никуда не едет. */
$__св = smm_slot_povoda($__будни);
chk('повод в рабочее утро выходит в свой день',
    is_array($__св) && (string) $__св['date'] === $__будни && (int) $__св['сдвиг'] === 0,
    json_encode($__св, 320));

/* ПОВОД НА НЕРАБОЧИЙ ДЕНЬ ищем в самом календаре. Нет такого в году - четыре
   проверки ниже проверять нечего, и они честно печатаются справкой: зелёное на
   пустом месте хуже отсутствующей проверки (правило 71). */
/* ДЕНЬ ПОВОДА ИЩЕМ НЕЗАВИСИМО ОТ ПЕРЕНОСА, и это главное в этом куске.
   Сперва отбор стоял так: «найди повод на нерабочий день, у которого ЕСТЬ день
   выхода». Подложил порчу (перенос не отступает назад) - и аудит стал
   ЗЕЛЁНЫМ на 137 проверках: все четыре проверки ушли в справку «проверять
   нечего», а повод тихо потерялся. Проверка, которая молча не ловит, хуже
   отсутствующей (правило 71). Поэтому день повода отбирается по календарю, а
   неумение перенести его - это провал, а не пустое место. */
$__повНераб = ''; $__повВыход = '';
for ($i = 1; $i <= 400; $i++) {
    $d = date('Y-m-d', strtotime("+{$i} day"));
    if (!smm_kal_повод($d)) continue;
    if (smm_slot_rabochiy($d, SMM_SLOT_MORNING)) continue;
    $__повНераб = $d;
    $сл = smm_slot_povoda($d);
    $__повВыход = $сл ? (string) $сл['date'] : '';
    break;
}
if ($__повНераб !== '' && $__повВыход === '') {
    bad('повод на нерабочий день: выход раньше повода',
        $__повНераб . ': переносить некуда — афиша не выйдет вовсе, повод уйдёт на год');
    bad('день выхода находит свой повод',            'дня выхода нет');
    bad('сам нерабочий день повода слота не держит',  'дня выхода нет');
    bad('вид поста в день выхода - афиша',            'дня выхода нет');
} elseif ($__повНераб === '') {
    ok('повод на нерабочий день: выход раньше повода', 'в календаре на год такого повода нет');
    ok('день выхода находит свой повод',               'проверять нечего');
    ok('сам нерабочий день повода слота не держит',    'проверять нечего');
    ok('вид поста в день выхода - афиша',              'проверять нечего');
} else {
    $__слП = smm_slot_povoda($__повНераб);
    chk('повод на нерабочий день: выход раньше повода',
        $__повВыход < $__повНераб && (int) $__слП['hour'] === SMM_SLOT_MORNING
        && smm_slot_rabochiy($__повВыход, SMM_SLOT_MORNING),
        'повод ' . $__повНераб . ' → выход ' . $__повВыход);
    $__пс = smm_povod_slota($__повВыход);
    chk('день выхода находит свой повод',
        $__пс !== [] && (string) ($__пс['дата_повода'] ?? '') === $__повНераб
        && (string) ($__пс['выход'] ?? '') === $__повВыход,
        (string) ($__пс['имя'] ?? '-'));
    chk('сам нерабочий день повода слота не держит', smm_povod_slota($__повНераб) === [], $__повНераб);
    chk('вид поста в день выхода - афиша',
        (string) (smm_pick_kind($__повВыход, SMM_SLOT_MORNING)['вид'] ?? '') === 'афиша', $__повВыход);
}

/* НОТА О СДВИГЕ. Без неё афиша, уходящая накануне, написала бы «сегодня» про
   чужой день - и центр поздравил бы с датой, которая ещё не пришла. */
$__нотаСдв = smm_afisha_sdvig_note(['имя' => 'Х', 'дата_повода' => '2026-10-25', 'выход' => '2026-10-24']);
chk('нота сдвига называет обе даты и запрещает «сегодня»',
    mb_strpos($__нотаСдв, '25 октября') !== false && mb_strpos($__нотаСдв, '24 октября') !== false
    && mb_strpos($__нотаСдв, 'НЕ пиши «сегодня»') !== false,
    mb_substr($__нотаСдв, 0, 60));
chk('у повода в свой день ноты нет',
    smm_afisha_sdvig_note(['дата_повода' => '2026-10-24', 'выход' => '2026-10-24']) === '');
chk('без сдвига задание говорит «Сегодня»',
    mb_strpos(smm_afisha_kogda(['дата_повода' => '2026-10-24', 'выход' => '2026-10-24'], 'кто-то'), 'Сегодня ') === 0);

/* ИСХОДНИК: один источник и его вызовы. Проверка стоит отрицанием там, где
   строку легко вернуть одной правкой. */
chk('один источник рабочего слота заведён', function_exists('smm_slot_rabochiy'));
chk('открытие слотов зовёт один источник',
    mb_strpos($__чист($__тело('smm_pending_slots')), 'smm_slot_rabochiy(') !== false);
chk('публикация зовёт один источник',
    mb_strpos($__чист($__тело('smm_due_post')), 'smm_slot_rabochiy(') !== false);
chk('поиск свободного слота зовёт один источник',
    mb_strpos($__чист($__тело('smm_свободный_слот')), 'smm_slot_rabochiy(') !== false);
chk('освобождение слота считает день ВЫХОДА, а не повода',
    mb_strpos($__чист($__тело('smm_osvobodit_pod_povod')), 'smm_slot_povoda(') !== false);
$__пк = $__чист($__тело('smm_pick_kind'));
chk('вид поста берёт повод у слота, а не у календаря напрямую',
    mb_strpos($__пк, 'smm_povod_slota(') !== false && mb_strpos($__пк, 'smm_kal_повод(') === false);
$__зтопик = $__чист($__тело('smm_make_topic'));
chk('задание афиши зовёт смену дат и вписанного «Сегодня» не осталось',
    mb_strpos($__зтопик, 'smm_afisha_kogda(') !== false
    && mb_strpos($__зтопик, '"Сегодня " . $кто') === false);
chk('задание текста афиши несёт ноту сдвига',
    mb_strpos($__чист($__тело('smm_make_body')), 'smm_afisha_sdvig_note(') !== false);

/* ФАКТ: что правда открыто и что правда лежит в базе. */
$__плохие = [];
foreach (smm_pending_slots() as $__s) {
    if (!smm_slot_rabochiy((string) $__s['date'], (int) $__s['hour'])) {
        $__плохие[] = $__s['date'] . ' ' . $__s['hour'] . ':00';
    }
}
chk('ни один открытый слот не попадает на нерабочее время', $__плохие === [], implode('; ', $__плохие));

$__сбВечер = []; $__сбПрошлые = [];
foreach (all("SELECT id, slot_date, slot_hour, status FROM smm_posts
               WHERE slot_hour >= ? AND status <> 'published'", [SMM_SLOT_EVENING]) as $__r) {
    if ((int) date('w', strtotime((string) $__r['slot_date'])) !== 6) continue;
    $куда = ((string) $__r['slot_date'] >= date('Y-m-d')) ? '__сбВечер' : '__сбПрошлые';
    ${$куда}[] = '#' . (int) $__r['id'] . ' ' . $__r['slot_date'];
}
chk('впереди нет непубликованных постов на субботний вечер', $__сбВечер === [], implode('; ', $__сбВечер));
/* ПРОШЛЫЙ СУББОТНИЙ СЛОТ - НЕ ПОТЕРЯННЫЙ ПОСТ. Отбор публикации смотрит
   ТЕКУЩИЙ час, а не дату слота записи: такой пост уйдёт в будний вечер, когда
   дойдёт его очередь. Поэтому справка, а не провал. */
ok('посты с прошлым субботним слотом (уйдут в будний вечер)',
   $__сбПрошлые === [] ? 'нет' : implode('; ', $__сбПрошлые));

/* БЛИЖАЙШИЙ ПОВОД: место под него обязано быть либо занято афишей, либо
   открыто. Иначе афиша не встанет вовсе, и повод уйдёт на год. */
$__бпВыход = ''; $__бпПовод = '';
for ($i = 1; $i <= 7; $i++) {
    $d = date('Y-m-d', strtotime("+{$i} day"));
    if (!smm_kal_повод($d)) continue;
    $__бпПовод = $d;
    $сл = smm_slot_povoda($d);
    $__бпВыход = $сл ? (string) $сл['date'] : '';
    break;
}
if ($__бпПовод !== '' && $__бпВыход === '') {
    ok('ближайший повод на неделю вперёд', $__бпПовод . ' → выходить НЕКУДА');
    bad('место под ближайший повод', $__бпПовод . ': дня выхода нет, афиша не встанет');
} elseif ($__бпПовод === '') {
    ok('ближайший повод на неделю вперёд', 'нет');
    ok('место под ближайший повод', 'проверять нечего');
} else {
    ok('ближайший повод на неделю вперёд', $__бпПовод . ' → выход ' . $__бпВыход);
    $__естьАф = (string) (scalar("SELECT kind FROM smm_posts WHERE slot_date = ? AND slot_hour = ?",
                                 [$__бпВыход, SMM_SLOT_MORNING]) ?? '');
    $__открыт = false;
    foreach (smm_pending_slots() as $__s) {
        if ((string) $__s['date'] === $__бпВыход && (int) $__s['hour'] === SMM_SLOT_MORNING) $__открыт = true;
    }
    chk('место под ближайший повод занято афишей или открыто',
        $__естьАф === 'афиша' || $__открыт,
        'в слоте: ' . ($__естьАф !== '' ? $__естьАф : 'пусто') . ', открыт: ' . ($__открыт ? 'да' : 'нет'));
}

sec('Норма мозга и трата (для глаз, не провал)');
ok('норма мозга за сутки', (string) setting('smm_brain_day', '(нет)'));
ok('предел запасного мозга', (string) setting('smm_brain_fallback_limit', '60'));
ok('трата за сутки, $', (string) smm_spent_today());

echo "\n================ ИТОГ ================\n";
echo "ok: $OK, FAIL: $FAIL\n";
if ($FAIL === 0) echo "Лента собрана, повод на месте, картинки у каждого свои.\n";
exit($FAIL === 0 ? 0 : 1);
