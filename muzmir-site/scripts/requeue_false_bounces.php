<?php
/**
 * ПОВТОРИТЬ ПИСЬМО ТЕМ, КОГО ОТБИЛ ПОЧТОВИК БЕЗ ОБЪЯСНЕНИЯ.
 *
 * Возврат адреса в базу (restore_false_bounces.php) чинит только половину беды:
 * человек снова числится живым, но письмо-то до него не дошло, а в очереди его
 * строка стоит «отправлено». В волне запуска это значит, что приглашение на
 * конкурсы августа он не получит вовсе.
 *
 * Здесь для таких адресов создаётся новая строка очереди — копия прежней, с тем
 * же рецептом сборки (build), той же рассылкой и тем же типом кампании. Тело
 * собирается в момент отправки, поэтому человек получит актуальный текст и
 * свежий временный пароль.
 *
 * Повторяем ОДИН раз: если письмо отобьётся снова, второй заход не делаем — это
 * уже похоже на настоящий мёртвый адрес.
 *
 *   php scripts/requeue_false_bounces.php --dry
 *   php scripts/requeue_false_bounces.php
 */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { fwrite(STDERR, "CLI only\n"); exit(1); }

define('BASE_PATH', dirname(__DIR__));
$GLOBALS['CFG'] = require BASE_PATH . '/config.php';
require_once BASE_PATH . '/core/db.php';
require_once BASE_PATH . '/core/helpers.php';
require_once BASE_PATH . '/core/mail_reputation.php';

$dry  = in_array('--dry', $argv, true);
$line = str_repeat('=', 78);
$days = 3;
foreach ($argv as $a) if (preg_match('~^--days=(\d+)$~', $a, $m)) $days = (int) $m[1];

echo "ПОВТОР ПИСЬМА ПОСЛЕ ЛОЖНОГО ОТКАЗА\n$line\n";

/* Адреса с недоказанным отказом за период.
 *
 * Отдельно откладываем тех, кого отбил не почтовик, а сам сервис рассылок: они
 * лежат в его списке подавления, и повтор для них — это круг на месте. Их
 * письмо вернётся в очередь после снятия подавления. */
$false = $held = [];
foreach (all("SELECT DISTINCT LOWER(email) e, COALESCE(comment,'') c FROM mail_events
               WHERE status='hard_bounced' AND created_at >= datetime('now','localtime', ?)",
             ['-' . $days . ' days']) as $r) {
    $e = (string) $r['e'];
    if ($e === '') continue;
    if (mrep_service_skipped((string) $r['c'])) { $held[$e] = true; unset($false[$e]); continue; }
    if (isset($held[$e])) continue;
    if (mrep_bounce_is_proof((string) $r['c'])) unset($false[$e]);
    elseif (!array_key_exists($e, $false))      $false[$e] = true;
}
printf("  адресов с недоказанным отказом: %s\n", number_format(count($false), 0, '.', ' '));
printf("  ждут снятия подавления у сервиса: %s\n", number_format(count($held), 0, '.', ' '));
if (!$false) exit(0);

$made = $skip = 0;
foreach (array_keys($false) as $e) {
    if ($dry) {
        $row = one("SELECT id, error FROM mail_queue WHERE LOWER(to_email)=? AND COALESCE(priority,0)>0
                     AND status='sent' ORDER BY id DESC LIMIT 1", [$e]);
        if ($row && !str_starts_with((string) $row['error'], 'повтор')) $made++; else $skip++;
        continue;
    }
    if (mrep_requeue_last($e, 'первый заход отбит почтовиком без объяснения')) $made++;
    else $skip++;
}

printf("\n%s\n  %s писем: %s, пропущено: %s\n", $line,
    $dry ? 'поставили бы' : 'поставлено в очередь',
    number_format($made, 0, '.', ' '), number_format($skip, 0, '.', ' '));
if ($dry) echo "  сухой прогон: ничего не изменено\n";
