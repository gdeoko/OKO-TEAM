<?php
/**
 * ГИГИЕНА БАЗЫ РАССЫЛКИ.
 *
 * Почтовые службы судят отправителя не по содержанию письма, а по тому, куда он
 * пишет. Письмо на несуществующий домен или в давно закрытый ящик — прямой сигнал
 * «шлёт по купленному списку», и дальше режется уже всё подряд: Mail.ru Group
 * отбивает у нас от 56 до 90 процентов писем как спам, хотя подпись, SPF и DMARC
 * проходят проверку.
 *
 * Скрипт убирает из рассылки то, что заведомо не дойдёт:
 *   • адреса на доменах, которых не существует (нет ни MX, ни A);
 *   • адреса, которым почтовик уже отказывал не меньше двух раз;
 *   • синтаксически битые адреса, попавшие при сборе со страниц учреждений.
 *
 * Учреждение при этом остаётся в базе: закрывается только рассылка (status), а
 * карточка, партнёрский номер и история никуда не деваются.
 *
 *   php scripts/mail_base_hygiene.php           — показать, что нашлось
 *   php scripts/mail_base_hygiene.php --apply   — применить
 */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { fwrite(STDERR, "CLI only\n"); exit(1); }

define('BASE_PATH', dirname(__DIR__));
$GLOBALS['CFG'] = require BASE_PATH . '/config.php';
require_once BASE_PATH . '/core/db.php';
require_once BASE_PATH . '/core/helpers.php';

$apply = in_array('--apply', $argv, true);
$line  = str_repeat('=', 76);
echo "ГИГИЕНА БАЗЫ РАССЫЛКИ\n$line\n";

/* ── 1. Домены, которых нет ──────────────────────────────────────────────── */
$doms = all("SELECT LOWER(SUBSTR(email, INSTR(email,'@')+1)) d, COUNT(*) c
               FROM institutions
              WHERE COALESCE(email,'')<>'' AND INSTR(email,'@')>0
                AND status NOT IN ('bounced','unsubscribed','banned')
           GROUP BY d ORDER BY c DESC");
printf("  доменов к проверке: %d\n", count($doms));

$dead = [];
$t0 = microtime(true);
foreach ($doms as $r) {
    $d = trim((string) $r['d']);
    // Домен без точки или с пробелом — мусор со страницы, а не адрес.
    if ($d === '' || !str_contains($d, '.') || preg_match('~[^a-z0-9.\-]~', $d)) { $dead[$d] = (int) $r['c']; continue; }
    if (checkdnsrr($d, 'MX') || checkdnsrr($d, 'A')) continue;
    $dead[$d] = (int) $r['c'];
}
printf("  проверено за %.0f с, мёртвых доменов: %d (адресов: %d)\n",
       microtime(true) - $t0, count($dead), array_sum($dead));
$shown = 0;
foreach ($dead as $d => $c) { if ($shown++ >= 15) break; printf("      %-34s %d\n", $d, $c); }

/* ── 2. Адреса с повторными отказами ─────────────────────────────────────── */
$rep = all("SELECT LOWER(email) e, COUNT(*) c FROM mail_events
             WHERE status='hard_bounced' GROUP BY e HAVING c >= 2");
printf("\n  адресов с двумя и более отказами: %d\n", count($rep));

/* ── 3. Битые адреса ─────────────────────────────────────────────────────── */
$bad = all("SELECT id, email FROM institutions
             WHERE COALESCE(email,'')<>'' AND status NOT IN ('bounced','unsubscribed','banned')");
$broken = [];
foreach ($bad as $r) {
    $e = trim((string) $r['email']);
    if (!filter_var($e, FILTER_VALIDATE_EMAIL)) $broken[] = [(int) $r['id'], $e];
}
printf("  адресов с неверным написанием: %d\n", count($broken));
foreach (array_slice($broken, 0, 8) as [$id, $e]) printf("      #%-7d %s\n", $id, mb_substr($e, 0, 50));

/* ── 4. Применение ───────────────────────────────────────────────────────── */
$offInst = 0; $offQueue = 0; $stopped = 0;
if ($apply) {
    // Мёртвые домены.
    foreach (array_keys($dead) as $d) {
        if ($d === '') continue;
        q("UPDATE institutions SET status='bounced', note=COALESCE(note,'') || ' [домена не существует]',
                 updated_at=datetime('now','localtime')
            WHERE status NOT IN ('bounced','unsubscribed','banned') AND LOWER(email) LIKE ?", ['%@' . $d]);
        $offInst += db()->query("SELECT changes()")->fetchColumn();
        q("UPDATE mail_queue SET status='cancelled', error='домена получателя не существует'
            WHERE status='queued' AND LOWER(to_email) LIKE ?", ['%@' . $d]);
        $offQueue += db()->query("SELECT changes()")->fetchColumn();
    }
    /* Повторные отказы: в стоп-лист, вон из очереди И вон из рассылки учреждений.
     *
     * ПОСЛЕДНЕЕ — НЕ ЛИШНЕЕ. Раньше адрес попадал в стоп-лист, его письма из
     * очереди убирались, а само учреждение оставалось активным. Через пятнадцать
     * минут cron/queue_institutions.php ставил ему письмо заново, отправка
     * упиралась в стоп-лист и возвращала «ящика не существует» — и так по кругу.
     * 24 августа таких пропусков набралось тридцать один подряд, защита от порчи
     * базы приняла их за сломанный канал и опустила стоп-кран на ВСЕ массовые:
     * рассылка встала в 09:34 с 24 588 письмами в очереди на весь день. */
    foreach ($rep as $r) {
        $e = (string) $r['e'];
        try { q("INSERT OR IGNORE INTO mail_stop (email, reason, source) VALUES (?,?,?)",
                [$e, 'почтовик отказал дважды', 'гигиена базы']); $stopped++; } catch (\Throwable $x) {}
        q("UPDATE mail_queue SET status='cancelled', error='повторный отказ почтовика'
            WHERE status='queued' AND LOWER(to_email)=?", [$e]);
        $offQueue += db()->query("SELECT changes()")->fetchColumn();
        q("UPDATE institutions SET status='bounced', note=COALESCE(note,'') || ' [почтовик отказал дважды]',
                 updated_at=datetime('now','localtime')
            WHERE status NOT IN ('bounced','unsubscribed','banned') AND LOWER(email)=?", [$e]);
        $offInst += db()->query("SELECT changes()")->fetchColumn();
    }
    // Битые адреса.
    foreach ($broken as [$id, $e]) {
        q("UPDATE institutions SET status='bounced', note=COALESCE(note,'') || ' [адрес записан с ошибкой]',
                 updated_at=datetime('now','localtime') WHERE id=?", [$id]);
        $offInst++;
        q("UPDATE mail_queue SET status='cancelled', error='адрес записан с ошибкой'
            WHERE status='queued' AND LOWER(to_email)=?", [mb_strtolower($e)]);
        $offQueue += db()->query("SELECT changes()")->fetchColumn();
    }
}

echo "\n$line\n";
if ($apply) {
    printf("  учреждений снято с рассылки: %d\n", $offInst);
    printf("  писем снято из очереди:      %d\n", $offQueue);
    printf("  адресов в стоп-лист:         %d\n", $stopped);
    printf("\n  осталось в очереди: %d\n", (int) scalar("SELECT COUNT(*) FROM mail_queue WHERE status='queued'"));
} else {
    echo "  это предпросмотр: php scripts/mail_base_hygiene.php --apply\n";
}
