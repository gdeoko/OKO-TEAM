<?php
/**
 * cron/smm_keyart_refresh.php — ДОВОДЧИК КАДРОВ ПОД КЛЮЧ-АРТ.
 *
 * Правка владельца 13.10.2026 («все картинки по структуре ключ-арт завода»)
 * пришла, когда очередь уже была забита готовыми постами: их кадры собраны
 * прежним путём и уйдут в ленту раньше новых. Переснять их разом нельзя - мозг
 * упирается в дневной предел, - поэтому доводчик берёт по одному посту за заход
 * и останавливается сам, когда непеределанных не осталось.
 *
 * ТРАТА ОГРАНИЧЕНА САМА СОБОЙ: он работает только по постам, которые уже стоят
 * в очереди и у которых в `keyart` пусто. Новые посты приходят из конвейера уже
 * с плакатом, и доводчику работы не остаётся.
 *
 * Возраст берётся у самого поста: у кого он уже проставлен - его, иначе по
 * адресату («родитель» это кадр с ребёнком, «педагог» - с подростком, у
 * остальных взрослая половина). Кадр обязан отвечать теме, а не моде.
 *
 *   php cron/smm_keyart_refresh.php [--сколько=1] [--сухой]
 */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { fwrite(STDERR, "CLI only\n"); exit(1); }

define('BASE_PATH', dirname(__DIR__));
$GLOBALS['CFG'] = require BASE_PATH . '/config.php';
require_once BASE_PATH . '/core/db.php';
require_once BASE_PATH . '/core/helpers.php';
require_once BASE_PATH . '/core/smm_make.php';
require_once __DIR__ . '/_lib.php';

const JOB = 'smm_keyart';

$сколько = 1;
$сухой   = false;
foreach ($argv as $a) {
    if (preg_match('~^--сколько=(\d+)$~u', $a, $m)) $сколько = max(1, (int) $m[1]);
    if ($a === '--сухой') $сухой = true;
}

if ((int) setting('smm_enabled', '0') !== 1) exit(0);   // один выключатель на весь конвейер

smm_migrate();

$ряд = all(
    /* СНЯТЫЙ БРАК ДОВОДЧИК НЕ БЕРЁТ, И ЭТО НЕ МЕЛОЧЬ.
       Черновик, у которого заполнен `error`, снят человеком или аудитом и в
       ленту не выйдет НИКОГДА: так пост #13 стоит с 06.10 с пометкой «обещал,
       что диплом придёт на почту». Отбор шёл по дате слота, то есть брак сидел
       первым в очереди вечно и каждый час съедал попытку доводчика, а при живом
       мозге съел бы и $0.04 на кадр для поста, которого никто не увидит. */
    /* ПОСТ, ЖДУЩИЙ ПЕРЕПИСЫВАНИЯ, КАДРА НЕ ПОЛУЧАЕТ. Новый текст придёт со
       своим кадром (`cron/smm_perepisat.php`), и собрать кадр сейчас значит
       заплатить $0.04 дважды за один и тот же пост. */
    "SELECT * FROM smm_posts
      WHERE status IN ('draft','ready') AND COALESCE(keyart,'') = ''
        AND COALESCE(error,'') = ''
        AND id NOT IN (" . (implode(',', array_map('intval',
              (array) (json_decode((string) setting('smm_perepisat_ochered', '[]'), true) ?: [0]))) ?: '0') . ")
      ORDER BY slot_date ASC, slot_hour ASC
      LIMIT " . (int) $сколько
);
if (!$ряд) { exit(0); }   // молчим: переделывать нечего

foreach ($ряд as $p) {
    $id  = (int) $p['id'];
    $age = (string) ($p['age_group'] ?? '');
    if ($age === '' || !isset(SMM_AGES[$age])) {
        $layer = (string) $p['layer'];
        if ($layer === 'родитель')      $age = 'дети';
        elseif ($layer === 'педагог')   $age = 'подростки';
        else                            $age = smm_pick_age((string) $p['slot_date'], (int) $p['slot_hour']);
    }

    // Факт и герой поста — в задание сцены: кадр обязан показывать то, о чём текст.
    $topic = ['topic' => (string) $p['topic'], 'angle' => (string) $p['subtitle'],
              'fact' => (string) ($p['fact'] ?? ''), 'person' => (string) ($p['person'] ?? '')];
    /* Пост о человеке - кадр собирается от портрета, а не от возрастной группы. */
    $персона = trim((string) ($p['person'] ?? ''));
    $портрет = trim((string) ($p['portret'] ?? ''));
    if ($персона !== '' && $портрет === '') {
        $пп = smm_portret($персона);
        $портрет = (string) ($пп['url'] ?? '');
    }
    $prompt = smm_make_image_prompt(
        $topic,
        (string) $p['ratio'],
        (string) $p['title'],
        (string) $p['subtitle'],
        $age,
        (string) $p['slot_date'] . '_' . (int) $p['slot_hour'],
        $портрет !== '' ? $персона : '',
        (string) ($p['kind'] ?? 'совет'),
        '',
        $персона
    );
    if (!$prompt) {
        cron_log(JOB, "#{$id}: плакат не собрался — "
            . ((string) ($GLOBALS['SMM_KA_ALARM'] ?? 'мозг молчит (квота)')) . ', вернусь позже');
        break;   // мозг не отвечает — следующий пост тем более не выйдет
    }
    $ka = (array) ($GLOBALS['SMM_KA_LAST'] ?? []);
    $оси = trim(($ka['монтаж'] ?? '') . ' / ' . ($ka['типографика'] ?? '') . ' / ' . ($ka['цвет'] ?? '')
        . ' / ' . ($ka['приём'] ?? ''));

    if ($сухой) {
        cron_log(JOB, "#{$id} [сухой] возраст {$age}, плакат {$оси}, промпт "
            . (int) ($ka['знаков'] ?? 0) . ' знаков');
        continue;
    }

    // Своя картинка поста: переписываем ЕГО файл, а не файл соседа по слоту.
    $path = trim((string) ($p['image_path'] ?? '')) !== ''
        ? (string) $p['image_path'] : smm_image_path($id);
    [$ok, $err, $cost] = smm_make_image($prompt, (string) $p['ratio'], $path, $портрет);
    if (!$ok) { cron_log(JOB, "#{$id}: картинка не вышла — {$err}"); break; }

    update('smm_posts', [
        'image_prompt' => $prompt,
        'image_path'   => $path,
        'image_cost'   => $cost,
        'age_group'    => $age,
        'portret'      => $портрет,
        'keyart'       => $оси,
        'error'        => '',
        'status'       => 'ready',
    ], 'id=:id', ['id' => $id]);
    cron_log(JOB, "#{$id} {$p['slot_date']} {$p['slot_hour']}:00 — пересобран по ключ-арту: "
        . "возраст {$age}, плакат {$оси}");
}
