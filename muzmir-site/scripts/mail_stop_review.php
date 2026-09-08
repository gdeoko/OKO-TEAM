<?php
/**
 * ПЕРЕСМОТР СТОП-ЛИСТА: КОГО ОТРЕЗАЛИ ЗРЯ.
 *
 *   php scripts/mail_stop_review.php                       — разбор, ничего не меняя
 *   php scripts/mail_stop_review.php --from=2026-08-17 --to=2026-08-21
 *   php scripts/mail_stop_review.php --apply                — вернуть живых
 *
 * Зачем. Адрес попадает в стоп-лист по отказу почтовой службы. Но отказ бывает
 * не адресу, а НАМ: 17 августа Яндекс закрыл наружу ящики центра, и три дня
 * подряд письма отбивались независимо от того, кому они шли. Двадцатого числа
 * гигиена базы честно записала эти отказы на счёт получателей — 405 адресов
 * разом перестали получать запуски конкурсов и приглашения. Люди при этом
 * живы, заходят в кабинет и подают заявки; они просто перестали о нас слышать.
 *
 * Что считаем признаком жизни ПОСЛЕ попадания в стоп-лист:
 *   • письмо центра ушло на этот адрес без ошибки (журнал личных писем);
 *   • почтовая служба подтвердила доставку, открытие или переход по ссылке;
 *   • человек заходил в кабинет, подавал заявку или оплачивал.
 * Признак смерти — новый жёсткий отказ после этой даты; такой адрес остаётся.
 *
 * Ничего не рассылает и никого не добавляет. Возврат обратим: снятая запись
 * пишется в data/mail_stop_returned_<дата>.json.
 */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { fwrite(STDERR, "CLI only\n"); exit(1); }

define('BASE_PATH', dirname(__DIR__));
$GLOBALS['CFG'] = require BASE_PATH . '/config.php';
require_once BASE_PATH . '/core/db.php';
require_once BASE_PATH . '/core/helpers.php';

$opt = [];
foreach (array_slice($argv, 1) as $a)
    if (preg_match('~^--([a-z-]+)(?:=(.*))?$~', $a, $m)) $opt[$m[1]] = $m[2] ?? '1';
$apply  = isset($opt['apply']);
$from   = (string) ($opt['from'] ?? '2026-08-17');
$to     = (string) ($opt['to']   ?? '2026-08-21');
$reason = (string) ($opt['reason'] ?? 'почтовик отказал дважды');
/* Дни, когда почтовая служба закрыла ящики центра: отказы этих дней — наши, а
 * не адресатов. Список задаётся явно, чтобы правило не расползлось на обычные
 * дни: --crash=2026-08-17,2026-08-18,2026-08-19,2026-08-20 (пусто — не применять). */
$crashDays = array_values(array_filter(array_map('trim',
    explode(',', (string) ($opt['crash'] ?? '')))));

$rows = all("SELECT * FROM mail_stop
              WHERE reason = ? AND added_at >= ? AND added_at < ?
              ORDER BY added_at, email", [$reason, $from, $to]);
printf("Записей стоп-листа за %s … %s с пометкой «%s»: %d%s\n\n",
       $from, $to, $reason, count($rows), $apply ? '' : ' (только показ)');
if (!$rows) exit(0);

$live = []; $dead = []; $quiet = [];
foreach ($rows as $r) {
    $em   = (string) $r['email'];
    $since = (string) $r['added_at'];

    // Жёсткий отказ уже ПОСЛЕ попадания в список — адрес действительно нерабочий.
    $bounced = (int) (scalar("SELECT COUNT(*) FROM mail_events
                               WHERE email = ? AND event_time > ?
                                 AND status IN ('hard_bounced','spam','complaint')", [$em, $since]) ?? 0);
    if ($bounced > 0) { $dead[] = [$em, 'снова отказ после ' . substr($since, 0, 10)]; continue; }

    $why = '';
    $okMail = (int) (scalar("SELECT COUNT(*) FROM mail_sent
                              WHERE to_email = ? AND created_at > ? AND COALESCE(ok,0) = 1", [$em, $since]) ?? 0);
    if ($okMail > 0) $why = 'письма центра уходят без ошибок (' . $okMail . ')';

    if ($why === '') {
        $good = (int) (scalar("SELECT COUNT(*) FROM mail_events
                                WHERE email = ? AND event_time > ?
                                  AND status IN ('delivered','opened','clicked')", [$em, $since]) ?? 0);
        if ($good > 0) $why = 'почта подтвердила доставку или открытие (' . $good . ')';
    }

    if ($why === '') {
        $u = one("SELECT id, last_login FROM users WHERE email = ?", [$em]);
        if ($u && trim((string) $u['last_login']) !== '' && $u['last_login'] > $since) {
            $why = 'заходил в кабинет ' . substr((string) $u['last_login'], 0, 10);
        } elseif ($u) {
            $app = one("SELECT number, created_at FROM applications
                         WHERE user_id = ? AND created_at > ? ORDER BY id DESC LIMIT 1", [(int) $u['id'], $since]);
            if ($app) $why = 'подал заявку ' . (string) $app['number'];
        }
    }
    if ($why === '') {
        $app = one("SELECT number, created_at FROM applications
                     WHERE email = ? AND created_at > ? ORDER BY id DESC LIMIT 1", [$em, $since]);
        if ($app) $why = 'подал заявку ' . (string) $app['number'];
    }

    /* ТИШИНА ПОСЛЕ ОТКАЗА — НЕ ДОКАЗАТЕЛЬСТВО СМЕРТИ.
     *
     * Адрес в стоп-листе писем не получает, поэтому новых событий у него взяться
     * неоткуда: молчание здесь означает ровно то, что мы сами и устроили. Это
     * тот же замкнутый круг, что и с нормой домена (правило про пробную норму):
     * «мало данных — стоим на месте» держит адрес отрезанным навсегда.
     *
     * Поэтому смотрим на историю отказов. Если ВСЕ жёсткие отказы адреса
     * пришлись на дни аварии — до неё он не отбивался ни разу, — значит
     * отказали не ему, а нам, и он заслуживает второй попытки. Ошибёмся —
     * гигиена базы снова его отсеет после первого же честного отказа; цена
     * ошибки ровно одно письмо. */
    if ($why === '' && $crashDays) {
        $days = [];
        foreach (all("SELECT DISTINCT substr(event_time,1,10) d FROM mail_events
                       WHERE email = ? AND status IN ('hard_bounced','spam','complaint')", [$em]) as $x)
            $days[] = (string) $x['d'];
        if ($days && !array_diff($days, $crashDays))
            $why = 'все отказы пришлись на дни аварии (' . implode(', ', $days) . ')';
    }

    if ($why !== '') $live[] = [$em, $why]; else $quiet[] = [$em, 'после отказа тишина'];
}

printf("Живые (возвращаем):   %d\n", count($live));
printf("Нерабочие (остаются): %d\n", count($dead));
printf("Без признаков жизни:  %d — остаются в списке, тревожить их нечем\n\n", count($quiet));

foreach (array_slice($live, 0, 15) as $x) printf("  + %-38s %s\n", $x[0], $x[1]);
if (count($live) > 15) printf("  … и ещё %d\n", count($live) - 15);

if (!$apply) { echo "\n(ничего не изменено — нужен ключ --apply)\n"; exit(0); }

$file = BASE_PATH . '/data/mail_stop_returned_' . date('Ymd_His') . '.json';
@file_put_contents($file, json_encode(['at' => date('c'), 'from' => $from, 'to' => $to,
    'returned' => $live], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));

$n = 0;
foreach ($live as $x) { q("DELETE FROM mail_stop WHERE email = ?", [$x[0]]); $n++; }
if (function_exists('audit')) audit('mail_stop_review', 'mail_stop', 0,
    ['returned' => $n, 'from' => $from, 'to' => $to]);
printf("\nВозвращено в базу рассылок: %d\nСлепок для отката: %s\n", $n, basename($file));
