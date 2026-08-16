<?php
/**
 * ЖИВАЯ ПРОБА ОБРАЩЕНИЯ: ОТПРАВИТЬ САМИМ СЕБЕ.
 *
 * Отправляет партнёрское обращение с бланком в собственное сообщество центра и
 * тут же читает диалог: дошёл ли текст, прикрепился ли документ, как выглядит
 * имя файла. Ни одно чужое учреждение при этом не трогается, в журнал обращений
 * проба не попадает и исходящий номер из реестра убирается.
 *
 *   php scripts/vk_outreach_test.php
 */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { fwrite(STDERR, "CLI only\n"); exit(1); }

define('BASE_PATH', dirname(__DIR__));
$GLOBALS['CFG'] = require BASE_PATH . '/config.php';
require_once BASE_PATH . '/core/db.php';
require_once BASE_PATH . '/core/helpers.php';
require_once BASE_PATH . '/core/mailer.php';
require_once BASE_PATH . '/core/vk_outreach.php';

$line  = str_repeat('=', 78);
$gid   = (int) cfgv('vk_group_id', 211325055);
$peer  = -$gid;
$comps = vko_comps();

echo "ЖИВАЯ ПРОБА ОБРАЩЕНИЯ\n$line\n";

// Учреждение берём настоящее из очереди — чтобы текст и бланк были как в бою,
// но отправляем в своё сообщество.
$row = vko_queue(1)[0] ?? null;
if (!$row) { echo "очередь пуста\n"; exit(0); }
printf("  образец по учреждению: %s\n", (string) $row['name']);

$L = vko_letter($row, $comps);
printf("  исходящий №%s, бланк %s\n", $L['number'],
    $L['pdf'] !== '' && is_file($L['pdf']) ? round(filesize($L['pdf']) / 1024) . ' КБ' : 'НЕ СОБРАЛСЯ');

$doc = $L['pdf'] !== '' ? vko_upload_doc($peer, $L['pdf'], 'Обращение № ' . $L['number'] . '.pdf') : '';
printf("  документ загружен: %s\n", $doc !== '' ? $doc : 'НЕТ');

$msg = vko_message($row, $L['number'], $comps, partner_join_url((int) $row['id']));
$params = ['peer_id' => $peer, 'message' => $msg, 'random_id' => random_int(1, PHP_INT_MAX)];
if ($doc !== '') $params['attachment'] = $doc;
$r = vk_api('messages.send', $params);

if (isset($r['error'])) {
    echo '  ОТПРАВКА НЕ УДАЛАСЬ: ' . (string) ($r['error']['error_msg'] ?? '?') . "\n";
} else {
    printf("  отправлено, id сообщения %d\n", (int) ($r['response'] ?? 0));
    sleep(2);
    $h = vk_api('messages.getHistory', ['peer_id' => $peer, 'count' => 1]);
    $it = ($h['response']['items'] ?? [])[0] ?? [];
    printf("\nЧТО ВИДНО В ДИАЛОГЕ\n%s\n", $line);
    printf("  символов текста: %d\n", mb_strlen((string) ($it['text'] ?? '')));
    foreach (($it['attachments'] ?? []) as $a) {
        $t = (string) ($a['type'] ?? '');
        if ($t === 'doc') {
            printf("  вложение: документ «%s», %d КБ, %s\n",
                (string) ($a['doc']['title'] ?? '?'),
                (int) round(((int) ($a['doc']['size'] ?? 0)) / 1024),
                (string) ($a['doc']['ext'] ?? ''));
        } else {
            printf("  вложение: %s\n", $t);
        }
    }
}

/* Уборка: проба не должна оставлять следов. */
if ($L['pdf'] !== '' && is_file($L['pdf'])) @unlink($L['pdf']);
if ($L['number'] !== '') q("DELETE FROM official_letters WHERE number=?", [$L['number']]);
echo "\n  проба убрана: номер снят с учёта, бланк удалён\n";
