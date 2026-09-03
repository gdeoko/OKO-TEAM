<?php
/**
 * partner_renumber.php — разовая починка номеров партнёрства.
 *
 * ЗАЧЕМ. partner_next_no() считал длину префикса «ИП-2026-» функцией strlen
 * (10 байт), а SQLite SUBSTR режет по символам (8). Срез уходил на два знака
 * вправо: из «ИП-2026-00001» получалось «001», максимум упирался в 999, и
 * следующий номер навсегда застревал на ИП-2026-01000. Один и тот же номер
 * получили 38 942 учреждения, включая всех действующих партнёров. Хуже того,
 * бланк сертификата кэшировался по номеру — шестнадцать партнёров получили
 * PDF с чужим (тестовым) наименованием.
 *
 * ЧТО ДЕЛАЕТ. Выдаёт каждому учреждению с непустым partner_no свой номер:
 * сперва действующие партнёры — по дате согласия, потом подготовленные
 * аккаунты — по id. Номера идут подряд с ИП-<год>-00001. Год берётся из
 * существующего номера, чтобы не переносить учреждение в чужой год.
 *
 * БЕЗОПАСНОСТЬ. Номер нигде не рассылался: в приглашении учреждению его нет,
 * он виден только на странице согласия, в кабинете партнёра и на сертификате.
 * Сертификаты партнёров пересобираются отдельно (partner_certs_reissue.php).
 *
 * Запуск: php scripts/partner_renumber.php --dry   (посмотреть)
 *         php scripts/partner_renumber.php --apply (записать)
 */
declare(strict_types=1);
define('BASE_PATH', '/var/www/muzmir');
$GLOBALS['CFG'] = require BASE_PATH . '/config.php';
require_once BASE_PATH . '/core/db.php';
require_once BASE_PATH . '/core/data.php';
require_once BASE_PATH . '/core/helpers.php';
require_once BASE_PATH . '/core/partner.php';

$apply = in_array('--apply', $argv, true);
if (!$apply && !in_array('--dry', $argv, true)) {
    fwrite(STDERR, "укажи --dry или --apply\n");
    exit(2);
}

$rows = q("SELECT id, name, partner_no, partner_status, partner_accepted_at
             FROM institutions
            WHERE COALESCE(partner_no,'') <> ''
            ORDER BY CASE WHEN partner_status='accepted' THEN 0 ELSE 1 END,
                     COALESCE(partner_accepted_at,'9999'), id")->fetchAll(PDO::FETCH_ASSOC);

echo "записей с номером: " . count($rows) . "\n";

/* Счётчик на каждый год отдельный: год берём из старого номера («ИП-2026-…»). */
$seq = [];
$plan = [];
foreach ($rows as $r) {
    $old  = (string) $r['partner_no'];
    $year = preg_match('~^ИП-(\d{4})-~u', $old, $m) ? $m[1] : date('Y');
    $seq[$year] = ($seq[$year] ?? 0) + 1;
    $new = sprintf('ИП-%s-%05d', $year, $seq[$year]);
    if ($new !== $old) $plan[] = [(int) $r['id'], $old, $new, (string) $r['partner_status'], (string) $r['name']];
}

echo "к перенумерации: " . count($plan) . "\n";
echo "--- первые 20 ---\n";
foreach (array_slice($plan, 0, 20) as $p) {
    printf("  %6d  %-14s -> %-14s  %-10s %s\n", $p[0], $p[1], $p[2], $p[3], mb_substr($p[4], 0, 44));
}

if (!$apply) { echo "\nсухой прогон, ничего не записано\n"; exit(0); }

$db = db();
$db->beginTransaction();
try {
    $st = $db->prepare("UPDATE institutions SET partner_no=? WHERE id=?");
    foreach ($plan as $p) $st->execute([$p[2], $p[0]]);

    /* Реестр документов ведётся по номеру: у принятых партнёров перевешиваем
       запись на новый номер, иначе проверка подлинности ничего не найдёт. */
    $docs = $db->prepare("UPDATE partner_docs SET number=? WHERE institution_id=? AND kind='cert'");
    foreach ($plan as $p) if ($p[3] === 'accepted') $docs->execute([$p[2], $p[0]]);

    $db->commit();
} catch (\Throwable $e) {
    $db->rollBack();
    fwrite(STDERR, "ОШИБКА: " . $e->getMessage() . "\n");
    exit(1);
}

echo "\nготово. разных номеров теперь: "
   . scalar("SELECT COUNT(DISTINCT partner_no) FROM institutions WHERE COALESCE(partner_no,'')<>''")
   . " из " . scalar("SELECT COUNT(*) FROM institutions WHERE COALESCE(partner_no,'')<>''") . "\n";
