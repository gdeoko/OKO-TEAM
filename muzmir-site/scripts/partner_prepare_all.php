<?php
/**
 * ЗАВЕСТИ ПАРТНЁРСКИЙ АККАУНТ КАЖДОМУ УЧРЕЖДЕНИЮ.
 *
 * Правило владельца (19.08.2026): учреждение существует в партнёрской программе
 * ещё до того, как ему уходит первое письмо. К моменту отправки у него уже есть
 * постоянная ссылка вида /p/<слug>, номер, промокод и доступ в кабинет — письмо
 * зовёт не «оставьте заявку», а «ваш кабинет готов».
 *
 * Статус партнёра при этом не выставляется: аккаунт заведён, согласия ещё нет.
 * Согласие ставит partner_accept по нажатию кнопки в письме.
 *
 * Пропускаются те, кому мы больше не пишем: исключённые, отписавшиеся,
 * заблокированные и учреждения без адреса.
 *
 *   php scripts/partner_prepare_all.php            — посчитать
 *   php scripts/partner_prepare_all.php --apply    — завести
 *   php scripts/partner_prepare_all.php --apply --limit=5000
 */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { fwrite(STDERR, "CLI only\n"); exit(1); }

define('BASE_PATH', dirname(__DIR__));
$GLOBALS['CFG'] = require BASE_PATH . '/config.php';
require_once BASE_PATH . '/core/db.php';
require_once BASE_PATH . '/core/helpers.php';
require_once BASE_PATH . '/core/partner.php';

$apply = in_array('--apply', $argv, true);
$limit = 0;
foreach ($argv as $a) if (preg_match('~^--limit=(\d+)$~', $a, $m)) $limit = (int) $m[1];
$line = str_repeat('=', 78);
$n    = static fn($x): string => number_format((int) $x, 0, '.', ' ');

echo "ПАРТНЁРСКИЕ АККАУНТЫ УЧРЕЖДЕНИЙ\n$line\n";

$where = "status NOT IN ('excluded','bounced','unsubscribed','banned')
          AND TRIM(COALESCE(email,'')) <> ''
          AND (TRIM(COALESCE(partner_slug,'')) = '' OR COALESCE(partner_no,'') = '')";

printf("  учреждений в работе:      %s\n", $n(scalar("SELECT COUNT(*) FROM institutions
    WHERE status NOT IN ('excluded','bounced','unsubscribed','banned') AND TRIM(COALESCE(email,'')) <> ''")));
printf("  уже с аккаунтом:          %s\n", $n(scalar("SELECT COUNT(*) FROM institutions
    WHERE TRIM(COALESCE(partner_slug,'')) <> '' AND COALESCE(partner_no,'') <> ''")));
$todo = (int) scalar("SELECT COUNT(*) FROM institutions WHERE $where");
printf("  завести аккаунт:          %s\n\n", $n($todo));

if (!$apply) { echo "  сухой прогон: ничего не изменено (запустить с --apply)\n"; exit(0); }

$sql  = "SELECT id FROM institutions WHERE $where ORDER BY id" . ($limit > 0 ? " LIMIT $limit" : '');
$done = $fail = 0;
$t0   = microtime(true);
foreach (all($sql) as $r) {
    try { partner_prepare((int) $r['id']); $done++; }
    catch (\Throwable $e) { $fail++; }
    if ($done % 2000 === 0) {
        printf("  заведено %s из %s (%.0f с)\n", $n($done), $n($todo), microtime(true) - $t0);
    }
}
printf("\n$line\n  заведено аккаунтов: %s, не удалось: %s, за %.0f с\n", $n($done), $n($fail), microtime(true) - $t0);
printf("  всего с аккаунтом теперь: %s\n", $n(scalar("SELECT COUNT(*) FROM institutions
    WHERE TRIM(COALESCE(partner_slug,'')) <> '' AND COALESCE(partner_no,'') <> ''")));
