<?php
/**
 * CLI-импорт старой базы почт (2021-2026) в subscribers.
 * Читает data/import/ВСЕ_ПОЧТЫ.txt и data/import/2_ПОЧТЫ.txt, нормализует
 * (trim, lowercase, валидация email), дедуп внутри входа и против уже имеющихся
 * подписчиков, генерит unsub_token, source='import_2021_2026'.
 * Идемпотентно: повторный запуск не создаёт дублей.
 *
 * Запуск: php scripts/import_subscribers.php
 */
declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    fwrite(STDERR, "Только из CLI.\n");
    exit(1);
}

define('BASE_PATH', dirname(__DIR__));
$CFG = require BASE_PATH . '/config.php';
$GLOBALS['CFG'] = $CFG;
require_once BASE_PATH . '/core/db.php';
require_once BASE_PATH . '/core/helpers.php';

db(); // миграции

$files = [
    BASE_PATH . '/data/import/ВСЕ_ПОЧТЫ.txt',
    BASE_PATH . '/data/import/2_ПОЧТЫ.txt',
];

/** Извлекает и нормализует email из строки файла. */
function imp_email(string $line): string {
    // Убираем BOM, CR, кавычки и пробелы по краям.
    $line = str_replace(["\xEF\xBB\xBF", "\r", "\n"], '', $line);
    $line = trim($line, " \t\"'<>,;");
    if ($line === '') return '';
    // Если в строке несколько слов — берём первое похожее на email.
    if (preg_match('/[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}/', $line, $m)) {
        $line = $m[0];
    }
    return mb_strtolower(trim($line));
}

$read      = 0;   // прочитано непустых строк
$valid     = 0;   // валидных email (до дедупа)
$dupInput  = 0;   // дубли внутри входных файлов
$dupExist  = 0;   // уже есть в базе
$inserted  = 0;   // вставлено новых
$missing   = [];

// Уже имеющиеся адреса — для дедупа против базы.
$existing = [];
foreach (all("SELECT email FROM subscribers") as $r) {
    $existing[mb_strtolower((string) $r['email'])] = true;
}

$seen = []; // адреса, встреченные в этом прогоне

$pdo = db();
$pdo->beginTransaction();
try {
    foreach ($files as $file) {
        if (!is_file($file)) { $missing[] = $file; continue; }
        $fh = fopen($file, 'r');
        if (!$fh) { $missing[] = $file; continue; }
        while (($line = fgets($fh)) !== false) {
            if (trim($line) === '') continue;
            $read++;
            $email = imp_email($line);
            if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) continue;
            $valid++;

            if (isset($seen[$email])) { $dupInput++; continue; }
            $seen[$email] = true;

            if (isset($existing[$email])) { $dupExist++; continue; }

            insert('subscribers', [
                'email'       => $email,
                'name'        => '',
                'source'      => 'import_2021_2026',
                'unsub_token' => bin2hex(random_bytes(16)),
                'active'      => 1,
            ]);
            $existing[$email] = true;
            $inserted++;
        }
        fclose($fh);
    }
    $pdo->commit();
} catch (\Throwable $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    fwrite(STDERR, 'Ошибка импорта: ' . $e->getMessage() . "\n");
    exit(1);
}

$invalid   = $read - $valid;
$dupTotal  = $dupInput + $dupExist;
$totalSubs = (int) scalar("SELECT COUNT(*) FROM subscribers");

echo "== Импорт базы подписчиков (source=import_2021_2026) ==\n";
foreach ($missing as $m) echo "  ! файл не найден: $m\n";
echo "Прочитано строк   : $read\n";
echo "Валидных email    : $valid  (невалидных: $invalid)\n";
echo "Дублей            : $dupTotal  (внутри файлов: $dupInput, уже в базе: $dupExist)\n";
echo "Вставлено новых   : $inserted\n";
echo "Всего в subscribers: $totalSubs\n";
