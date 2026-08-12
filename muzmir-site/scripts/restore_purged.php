<?php
/**
 * ВОЗВРАТ ЛЮДЕЙ, ОШИБОЧНО ВЫЧИЩЕННЫХ ИЗ БАЗЫ.
 *
 * 10 августа 2026 автоочистка приняла ответ почтового сервера «554» за отказ
 * получателя и удалила 2695 человек. На деле 554 отдавал НАШ отправляющий сервер
 * (Яндекс), упершись в суточный лимит домена: тем же кодом отвечали и на заведомо
 * живые адреса, включая ящик владельца. Виноваты были не адреса, а темп отправки.
 *
 * Скрипт берёт вчерашнюю резервную копию и возвращает оттуда всех, кого сегодня
 * удалили: подписку, учётную запись с кабинетом и снятые письма очереди.
 * Данные, появившиеся сегодня (новые заявки, регистрации), не трогаются —
 * из копии берутся ТОЛЬКО отсутствующие сейчас записи.
 *
 * Запуск:
 *   php scripts/restore_purged.php <файл-копии> [--dry]
 */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { fwrite(STDERR, "только из командной строки\n"); exit(1); }

define('BASE_PATH', dirname(__DIR__));
$GLOBALS['CFG'] = require BASE_PATH . '/config.php';
require_once BASE_PATH . '/core/db.php';
require_once BASE_PATH . '/core/helpers.php';

$backup = '';
$dry = in_array('--dry', $argv, true);
foreach (array_slice($argv, 1) as $a) if ($a !== '--dry') $backup = $a;
if ($backup === '' || !is_file($backup)) { fwrite(STDERR, "не найден файл копии: $backup\n"); exit(1); }

echo "Возврат вычищенных — " . date('d.m.Y H:i:s') . ($dry ? "  (проба, ничего не меняем)" : "") . "\n";
echo "копия: $backup\n" . str_repeat('=', 70) . "\n";

$pdo = db();
$pdo->exec("ATTACH DATABASE '" . str_replace("'", "''", $backup) . "' AS bak");

// Кого не хватает сейчас по сравнению с копией.
$lostSubs = (int) $pdo->query(
    "SELECT COUNT(*) FROM bak.subscribers b
      WHERE NOT EXISTS (SELECT 1 FROM main.subscribers s WHERE LOWER(s.email)=LOWER(b.email))")->fetchColumn();
$lostUsers = (int) $pdo->query(
    "SELECT COUNT(*) FROM bak.users b
      WHERE NOT EXISTS (SELECT 1 FROM main.users u WHERE LOWER(u.email)=LOWER(b.email))")->fetchColumn();
echo "потеряно подписчиков: $lostSubs\n";
echo "потеряно учётных записей: $lostUsers\n";

if ($dry) { echo "\nпроба — изменений не вносим\n"; exit(0); }

// Колонки берём общие для копии и текущей схемы.
$cols = function (string $t) use ($pdo): array {
    $a = []; $b = [];
    foreach ($pdo->query("PRAGMA main.table_info($t)") as $r) $a[] = (string) $r['name'];
    foreach ($pdo->query("PRAGMA bak.table_info($t)")  as $r) $b[] = (string) $r['name'];
    return array_values(array_intersect($a, $b));
};

$pdo->beginTransaction();
try {
    // 1. Подписчики. id не переносим — пусть выдастся новый, связей по нему нет.
    $sc = array_values(array_diff($cols('subscribers'), ['id']));
    $list = implode(',', $sc);
    $n1 = $pdo->exec(
        "INSERT INTO main.subscribers ($list)
         SELECT $list FROM bak.subscribers b
          WHERE NOT EXISTS (SELECT 1 FROM main.subscribers s WHERE LOWER(s.email)=LOWER(b.email))");

    // 2. Учётные записи — С ТЕМ ЖЕ id: на него ссылаются заявки, заказы и дипломы.
    $uc = $cols('users');
    $ulist = implode(',', $uc);
    $n2 = $pdo->exec(
        "INSERT INTO main.users ($ulist)
         SELECT $ulist FROM bak.users b
          WHERE NOT EXISTS (SELECT 1 FROM main.users u WHERE u.id=b.id OR LOWER(u.email)=LOWER(b.email))");

    // 3. Письма, снятые автоочисткой, возвращаем в очередь.
    $n3 = $pdo->exec(
        "UPDATE main.mail_queue SET status='queued', error='', tries=0
          WHERE status='cancelled' AND COALESCE(priority,0)>0
            AND error LIKE '%отказ адресата%'");

    $pdo->commit();
    echo "\nвозвращено подписчиков: $n1\n";
    echo "возвращено учётных записей: $n2\n";
    echo "писем возвращено в очередь: $n3\n";
} catch (\Throwable $e) {
    $pdo->rollBack();
    fwrite(STDERR, "ОШИБКА, изменения отменены: " . $e->getMessage() . "\n");
    exit(1);
}

$pdo->exec("DETACH DATABASE bak");

echo "\nитого сейчас: подписчиков "
   . (int) scalar("SELECT COUNT(*) FROM subscribers")
   . ", учётных записей " . (int) scalar("SELECT COUNT(*) FROM users") . "\n";
