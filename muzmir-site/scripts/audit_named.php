<?php
/**
 * ПРОВЕРКА ИМЕННЫХ НАГРАДНЫХ ДИПЛОМОВ.
 *
 * Именной диплом это один ребёнок из коллектива: на бланке его фамилия, рядом
 * название коллектива и звание всего коллектива. Ломается он тихо - бланк
 * собирается и уходит, а не тот он или нет, видно только человеку, который его
 * получил. Поэтому проверка живёт отдельной командой и смотрит на факты:
 *
 *   1. именной у солиста (у него диплом и так именной) - такого быть не должно;
 *   2. в реестре вместо имени стоит звание - старая беда: проверка повтора
 *      сверяет пару «тип + result», и девять именных ансамбля схлопывались
 *      в один, а восемь пропадали вместе с деньгами;
 *   3. в ФИО название коллектива или несколько человек (`named_fio_problem`);
 *   4. оплаченных именных в заказе больше, чем заведено дипломов;
 *   5. именной без бланка.
 *
 *   php scripts/audit_named.php          показать всё
 *   php scripts/audit_named.php --беды   только беды
 */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { fwrite(STDERR, "CLI only\n"); exit(1); }

define('BASE_PATH', dirname(__DIR__));
$GLOBALS['CFG'] = require BASE_PATH . '/config.php';
require_once BASE_PATH . '/core/db.php';
require_once BASE_PATH . '/core/helpers.php';
require_once BASE_PATH . '/core/orders.php';

$толькоБеды = in_array('--беды', $argv, true);
$звания = ['ЛАУРЕАТ', 'ДИПЛОМАНТ', 'ГРАН-ПРИ', 'УЧАСТНИК', 'ПОБЕДИТЕЛЬ'];

$всего = 0; $беды = [];

foreach (all("SELECT d.*, a.number anum, a.is_group, a.group_name, a.result ares
                FROM diplomas d JOIN applications a ON a.id=d.application_id
               WHERE d.type='named' ORDER BY d.id") as $d) {
    $всего++;
    $имя = trim((string) $d['result']);
    $свои = [];
    if ((int) $d['is_group'] !== 1) {
        $свои[] = 'именной у солиста: у него диплом и так именной';
    }
    foreach ($звания as $з) {
        if (mb_stripos($имя, $з) !== false) { $свои[] = 'в реестре звание вместо имени'; break; }
    }
    $п = named_fio_problem($имя, ['group_name' => (string) $d['group_name']]);
    if ($п !== '') $свои[] = $п;
    if (trim((string) ($d['pdf_path'] ?? '')) === '') $свои[] = 'бланк не собран';
    if ($свои) {
        $беды[] = ['диплом' => (string) $d['number'], 'заявка' => (string) $d['anum'],
                   'кому' => $имя, 'ушёл' => trim((string) ($d['sent_at'] ?? '')) !== '',
                   'что' => $свои];
    }
}

// Оплачено больше, чем выдано.
foreach (all("SELECT o.id, o.items, o.status, a.id aid, a.number anum
                FROM awards_orders o JOIN applications a ON a.id=o.application_id
               WHERE o.items LIKE '%менной%'
                 AND o.status IN ('paid','made','shipped','delivered') ORDER BY o.id") as $o) {
    $надо = 0;
    foreach ((array) (json_decode((string) $o['items'], true) ?: []) as $it) {
        if (is_array($it) && mb_stripos((string) ($it['item'] ?? ''), 'именн') !== false) $надо++;
    }
    $есть = (int) scalar("SELECT COUNT(*) FROM diplomas WHERE application_id=? AND type='named'", [(int) $o['aid']]);
    if ($надо > $есть) {
        $беды[] = ['диплом' => 'заказ №' . $o['id'], 'заявка' => (string) $o['anum'],
                   'кому' => '', 'ушёл' => false,
                   'что' => [sprintf('оплачено именных %d, заведено %d', $надо, $есть)]];
    }
}

printf("именных дипломов в базе: %d, с бедами: %d\n", $всего, count($беды));
foreach ($беды as $б) {
    printf("\n%s  (заявка %s)%s\n", $б['диплом'], $б['заявка'], $б['ушёл'] ? '  УЖЕ ОТПРАВЛЕН' : '');
    if ($б['кому'] !== '') printf("   кому: %s\n", $б['кому']);
    foreach ($б['что'] as $х) printf("   - %s\n", $х);
}
if (!$беды) echo "\nвсё чисто\n";
exit($беды ? 1 : 0);
