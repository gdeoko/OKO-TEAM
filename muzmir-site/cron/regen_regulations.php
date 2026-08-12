<?php
/**
 * Перегенерация положений-DOCX конкурсов из эталонов (core/regulation_gen.php).
 *
 * Запуск: php cron/regen_regulations.php all       — все конкурсы
 *         php cron/regen_regulations.php <id>      — один конкурс
 */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { fwrite(STDERR, "CLI only\n"); exit(1); }

define('BASE_PATH', dirname(__DIR__));
$GLOBALS['CFG'] = require BASE_PATH . '/config.php';
require_once BASE_PATH . '/core/db.php';
require_once BASE_PATH . '/core/helpers.php';
require_once BASE_PATH . '/core/regulation_gen.php';

$arg = strtolower(trim((string) ($argv[1] ?? '')));
if ($arg === '' || ($arg !== 'all' && !ctype_digit($arg))) {
    fwrite(STDERR, "Usage: php cron/regen_regulations.php all|<competition_id>\n");
    exit(1);
}

$rows = $arg === 'all'
    ? all("SELECT id, slug, name, is_paid FROM competitions ORDER BY id")
    : all("SELECT id, slug, name, is_paid FROM competitions WHERE id=?", [(int) $arg]);

if (!$rows) { fwrite(STDERR, "Нет конкурсов по условию '$arg'\n"); exit(1); }

$ok = 0; $fail = 0;
foreach ($rows as $c) {
    $id = (int) $c['id'];
    try {
        $path = regulation_generate($id);
        $sz = is_file($path) ? filesize($path) : 0;
        echo "OK  #$id {$c['slug']} (" . ((int)$c['is_paid'] ? 'платный' : 'бесплатный') . ") -> "
            . basename($path) . " [$sz bytes]\n";
        $ok++;
    } catch (\Throwable $e) {
        echo "FAIL #$id {$c['slug']}: " . $e->getMessage() . "\n";
        $fail++;
    }
}
echo "Итого: OK=$ok FAIL=$fail\n";
exit($fail > 0 ? 2 : 0);
