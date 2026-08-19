<?php
/**
 * РАЗВЕСТИ ДВА СПИСКА: УЧАСТНИКИ И УЧРЕЖДЕНИЯ.
 *
 * Правило владельца: участник — это человек, который сам оставил адрес центру;
 * учреждение — организация, которой мы пишем по официальному адресу о
 * партнёрстве. Это разные списки, и смешивать их нельзя.
 *
 * Что случилось. Ради ссылки «Отписаться» каждое приглашённое учреждение
 * заводилось в таблицу подписчиков (source='institution'). За четыре дня туда
 * попало 20 129 школ и отделов культуры, и «своя база» из 8 130 живых адресов
 * превратилась в 28 тысяч. Дальше по ней считались нормы, отчёты и волны.
 *
 * Здесь такие записи убираются из базы участников. Учреждение при этом не
 * теряется: оно остаётся в institutions со своим статусом, своим токеном
 * отписки (inst_unsub_token) и своей волной. Удаление обратимо — строки
 * складываются в subscribers_removed.
 *
 * Не трогаем тех, кто хоть раз подавал заявку: такой адрес принадлежит и
 * человеку тоже.
 *
 *   php scripts/split_bases.php            — посчитать
 *   php scripts/split_bases.php --apply    — развести
 */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { fwrite(STDERR, "CLI only\n"); exit(1); }

define('BASE_PATH', dirname(__DIR__));
$GLOBALS['CFG'] = require BASE_PATH . '/config.php';
require_once BASE_PATH . '/core/db.php';
require_once BASE_PATH . '/core/helpers.php';

$apply = in_array('--apply', $argv, true);
$line  = str_repeat('=', 78);
$n     = static fn($x): string => number_format((int) $x, 0, '.', ' ');

echo "УЧАСТНИКИ И УЧРЕЖДЕНИЯ — РАЗНЫЕ СПИСКИ\n$line\n";

try {
    db()->exec("CREATE TABLE IF NOT EXISTS subscribers_removed (
        id INTEGER, email TEXT, name TEXT, source TEXT, unsub_token TEXT,
        active INTEGER, created_at TEXT, removed_at TEXT DEFAULT (datetime('now','localtime')))");
    // Таблица архива могла быть создана раньше и без этой колонки.
    db()->exec("ALTER TABLE subscribers_removed ADD COLUMN reason TEXT DEFAULT ''");
} catch (\Throwable $e) {}

/* Кандидаты: заведены как учреждение, есть в справочнике учреждений и никогда
   не подавали заявку. */
$where = "s.source = 'institution'
          AND EXISTS (SELECT 1 FROM institutions i WHERE LOWER(i.email) = LOWER(s.email))
          AND NOT EXISTS (SELECT 1 FROM applications a WHERE LOWER(a.email) = LOWER(s.email))";

$cnt = (int) (scalar("SELECT COUNT(*) FROM subscribers s WHERE $where") ?? 0);
printf("  всего подписчиков:                %s\n", $n(scalar("SELECT COUNT(*) FROM subscribers")));
printf("  из них заведены как учреждение:   %s\n", $n(scalar("SELECT COUNT(*) FROM subscribers WHERE source='institution'")));
printf("  к выносу из базы участников:      %s\n", $n($cnt));
printf("  оставим (подавали заявку):        %s\n\n",
    $n(scalar("SELECT COUNT(*) FROM subscribers s WHERE s.source='institution'
                AND EXISTS (SELECT 1 FROM applications a WHERE LOWER(a.email)=LOWER(s.email))")));

if (!$apply) {
    echo "  сухой прогон: ничего не изменено (запустить с --apply)\n";
} else {
    q("INSERT INTO subscribers_removed (id, email, name, source, unsub_token, active, created_at, reason)
       SELECT s.id, s.email, s.name, s.source, s.unsub_token, s.active, s.created_at,
              'учреждение: перенесено в свой список'
         FROM subscribers s WHERE $where");
    printf("  сохранено в архив: %s\n", $n(db()->query("SELECT changes()")->fetchColumn()));

    q("DELETE FROM subscribers WHERE id IN (SELECT id FROM subscribers s WHERE $where)");
    printf("  убрано из базы участников: %s\n", $n(db()->query("SELECT changes()")->fetchColumn()));
}

echo "\nЧТО ПОЛУЧИЛОСЬ\n$line\n";
$sub  = (int) scalar("SELECT COUNT(*) FROM subscribers WHERE active=1");
$inst = (int) scalar("SELECT COUNT(*) FROM institutions
                       WHERE status NOT IN ('excluded','bounced','unsubscribed','banned')
                         AND TRIM(COALESCE(email,'')) <> ''");
$both = (int) scalar("SELECT COUNT(*) FROM subscribers s
                       JOIN institutions i ON LOWER(i.email) = LOWER(s.email)
                      WHERE s.active = 1
                        AND i.status NOT IN ('excluded','bounced','unsubscribed','banned')");
printf("  участники (своя база):   %s\n", $n($sub));
printf("  учреждения (партнёрка):  %s\n", $n($inst));
printf("  адрес в обоих списках:   %s\n", $n($both));
printf("  всего уникальных:        %s\n", $n($sub + $inst - $both));
echo "\n  источники своей базы:\n";
foreach (all("SELECT COALESCE(source,'(нет)') s, COUNT(*) c FROM subscribers
              GROUP BY 1 ORDER BY 2 DESC LIMIT 8") as $r) {
    printf("    %-22s %s\n", mb_substr((string) $r['s'], 0, 22), $n($r['c']));
}
