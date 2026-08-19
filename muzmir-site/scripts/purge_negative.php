<?php
/**
 * ЧИСТКА БАЗЫ ОТ ВСЕГО, ЧТО НИКОГДА НЕ ДОЙДЁТ.
 *
 * Правило владельца: в базе остаются только те, кому письмо ДОШЛО. Молчание не
 * повод выбрасывать человека — он остаётся и получает следующие волны. А вот
 * несуществующий ящик, отказ и жалоба на спам — повод: такие адреса уходят
 * навсегда, вместе с ними уходят и их письма из очереди.
 *
 * ОТКУДА БЕРЁМ НЕГАТИВ (пять независимых источников, чтобы ничего не пропустить):
 *   1. стоп-лист сервиса рассылок  — он знает про отказы больше нас;
 *   2. события доставки            — жёсткий отказ, спам, отписка;
 *   3. наша очередь                — письма, отбитые с постоянной причиной;
 *   4. статусы в базе учреждений   — bounced / invalid / unsubscribed;
 *   5. метки подписчиков           — bounced / invalid / alias / role.
 * Плюс учреждения, у которых почты нет вовсе: писать некуда.
 *
 * ЧТО НЕ ТРОГАЕМ:
 *   • временную недоступность (ящик переполнен, сервер лежал) — через день дойдёт;
 *   • исключённых вручную (структуры при Президенте, общие адреса) — это наше
 *     решение, а не отказ адресата, и терять эти записи нельзя;
 *   • всех, кому доставлено и кто просто не ответил.
 *
 * НИЧЕГО НЕ ПРОПАДАЕТ БЕССЛЕДНО. Удалённые строки целиком складываются в
 * архивные таблицы (institutions_removed, subscribers_removed), а адреса — в
 * стоп-лист mail_stop, чтобы новая выгрузка не вернула их обратно.
 *
 *   php scripts/purge_negative.php           — показать, что будет вычищено
 *   php scripts/purge_negative.php --apply   — вычистить
 */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { fwrite(STDERR, "CLI only\n"); exit(1); }

define('BASE_PATH', dirname(__DIR__));
$GLOBALS['CFG'] = require BASE_PATH . '/config.php';
require_once BASE_PATH . '/core/db.php';
require_once BASE_PATH . '/core/helpers.php';

$apply = in_array('--apply', $argv, true);
$line  = str_repeat('=', 78);

/* ── Стоп-лист и архивы ───────────────────────────────────────────────────── */
db()->exec("CREATE TABLE IF NOT EXISTS mail_stop (
    email TEXT PRIMARY KEY,
    reason TEXT NOT NULL DEFAULT '',
    source TEXT NOT NULL DEFAULT '',
    added_at TEXT DEFAULT (datetime('now','localtime')))");

// Свои ящики в стоп-лист не попадают ни при каких метках: старая пометка «отказ»,
// оставшаяся от давней проверки, однажды уже отрезала центр от его же почты.
$ownBox = [];
if (is_file(BASE_PATH . '/core/inbox_reader.php')) require_once BASE_PATH . '/core/inbox_reader.php';
if (is_file(BASE_PATH . '/core/mailer.php'))       require_once BASE_PATH . '/core/mailer.php';
foreach (array_merge(function_exists('inbox_own_emails') ? inbox_own_emails() : [],
                     [(string) cfgv('org_email', '')]) as $o) {
    $o = mb_strtolower(trim((string) $o));
    if ($o === '') continue;
    $ownBox[$o] = true;
    if (function_exists('mail_addr_ascii')) $ownBox[mb_strtolower(mail_addr_ascii($o))] = true;
}

/** Адрес → причина. Первая причина побеждает: источники идут от самого надёжного. */
$stop = [];
$add = static function (string $email, string $reason, string $src) use (&$stop, $ownBox): void {
    $e = mb_strtolower(trim($email));
    if ($e === '' || !filter_var($e, FILTER_VALIDATE_EMAIL)) return;
    if (isset($ownBox[$e])) return;
    if (!isset($stop[$e])) $stop[$e] = ['reason' => $reason, 'source' => $src];
};

echo "СБОР НЕГАТИВА\n$line\n";

/* 1. Стоп-лист сервиса рассылок. */
$key  = trim((string) cfgv('unisender_api_key', ''));
$base = rtrim((string) cfgv('unisender_api_url', 'https://go2.unisender.ru/ru/transactional/api/v1'), '/') . '/';
$fromService = 0;
if ($key !== '') {
    $cursor = ''; $pages = 0;
    do {
        $p = ['limit' => 100] + ($cursor !== '' ? ['cursor' => $cursor] : []);
        $ch = curl_init($base . 'suppression/list.json');
        curl_setopt_array($ch, [
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => json_encode(['api_key' => $key] + $p, JSON_UNESCAPED_UNICODE),
            CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
            CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 30,
        ]);
        $raw = (string) curl_exec($ch); curl_close($ch);
        $d = json_decode($raw, true);
        if (!is_array($d)) break;
        $rows = $d['suppressions'] ?? [];
        foreach ($rows as $s) {
            $cause = (string) ($s['cause'] ?? '');
            // Временную недоступность пропускаем: адрес живой.
            if ($cause === 'temporary_unavailable') continue;
            $ru = ['permanent_unavailable' => 'ящика не существует', 'blocked' => 'адрес заблокирован',
                   'unsubscribed' => 'отписался', 'complained' => 'пожаловался на спам',
                   'spam_complaint' => 'пожаловался на спам'][$cause] ?? $cause;
            $add((string) ($s['email'] ?? ''), $ru, 'сервис рассылок');
            $fromService++;
        }
        $cursor = (string) ($d['cursor'] ?? '');
        $pages++;
    } while ($cursor !== '' && $pages < 300 && $rows);
}
printf("  стоп-лист сервиса рассылок:      %6d\n", $fromService);

/* 2. События доставки. */
$n = 0;
try {
    // ЖЁСТКИЙ ОТКАЗ САМ ПО СЕБЕ НЕ ДОКАЗЫВАЕТ, ЧТО ЯЩИКА НЕТ.
    //
    // Из 3 954 отказов в журнале почтовик прямым текстом назвал адрес мёртвым
    // только в 174 случаях; остальные — «спам», «политика», молчаливое «550».
    // Прежнее правило удалило бы три с половиной тысячи живых подписчиков за один
    // прогон, ровно так, как это уже случилось 10 августа. Вычёркиваем только по
    // доказательству, всё остальное оставляем в базе.
    if (!function_exists('mrep_bounce_is_proof') && is_file(BASE_PATH . '/core/mail_reputation.php')) {
        require_once BASE_PATH . '/core/mail_reputation.php';
    }
    $skipped = 0;
    foreach (all("SELECT DISTINCT email, status, COALESCE(comment,'') c FROM mail_events
                   WHERE status IN ('hard_bounced','spam','unsubscribed')") as $r) {
        if ((string) $r['status'] === 'hard_bounced'
            && function_exists('mrep_bounce_is_proof')
            && !mrep_bounce_is_proof((string) $r['c'])) { $skipped++; continue; }
        $add((string) $r['email'], ['hard_bounced' => 'ящика не существует', 'spam' => 'пожаловался на спам',
              'unsubscribed' => 'отписался'][(string) $r['status']] ?? 'отказ', 'события доставки');
        $n++;
    }
    if ($skipped > 0) printf("  отказов без доказательства (адрес оставлен): %6d\n", $skipped);
} catch (\Throwable $e) {}
printf("  события доставки:                %6d\n", $n);

/* 3. Наша очередь: письма, отбитые с постоянной причиной. */
$n = 0;
try {
    foreach (all("SELECT DISTINCT to_email, error FROM mail_queue WHERE status='failed'") as $r) {
        $err = mb_strtolower((string) $r['error']);
        $hard = mb_strpos($err, 'permanent_unavailable') !== false
             || mb_strpos($err, 'no valid recipients') !== false
             || mb_strpos($err, 'ящика не существует') !== false
             || mb_strpos($err, 'адрес подавлен') !== false
             || mb_strpos($err, 'user unknown') !== false
             || mb_strpos($err, 'mailbox unavailable') !== false;
        if (!$hard) continue;
        $add((string) $r['to_email'], 'ящика не существует', 'наша очередь');
        $n++;
    }
} catch (\Throwable $e) {}
printf("  отбитые письма из очереди:       %6d\n", $n);

/* 4. Статусы учреждений. */
$n = 0;
foreach (all("SELECT email, status FROM institutions
               WHERE status IN ('bounced','invalid','unsubscribed') AND TRIM(COALESCE(email,''))<>''") as $r) {
    $add((string) $r['email'], ['bounced' => 'ящика не существует', 'invalid' => 'адрес некорректен',
          'unsubscribed' => 'отказался от рассылки'][(string) $r['status']] ?? 'отказ', 'база учреждений');
    $n++;
}
printf("  статусы учреждений:              %6d\n", $n);

/* 5. Метки подписчиков. */
$n = 0;
foreach (all("SELECT email, tags FROM subscribers WHERE COALESCE(tags,'')<>''") as $r) {
    $t = mb_strtolower((string) $r['tags']);
    $why = '';
    if (mb_strpos($t, 'bounced') !== false) $why = 'ящика не существует';
    elseif (mb_strpos($t, 'invalid') !== false) $why = 'адрес некорректен';
    elseif (mb_strpos($t, 'alias') !== false) $why = 'адрес-псевдоним';
    elseif (mb_strpos($t, 'role') !== false) $why = 'служебный адрес';
    if ($why === '') continue;
    $add((string) $r['email'], $why, 'метки подписчиков');
    $n++;
}
printf("  метки подписчиков:               %6d\n", $n);

/* 6. Письменные отказы учреждений (разобранная почта). */
$n = 0;
try {
    foreach (all("SELECT DISTINCT from_email FROM inbox_messages WHERE kind='partner_decline'") as $r) {
        $add((string) $r['from_email'], 'отказ письмом', 'входящая почта');
        $n++;
    }
} catch (\Throwable $e) {}
printf("  письменные отказы:               %6d\n", $n);

echo "\nИТОГО РАЗНЫХ АДРЕСОВ В СТОП-ЛИСТЕ: " . count($stop) . "\n";
$byReason = [];
foreach ($stop as $s) $byReason[$s['reason']] = ($byReason[$s['reason']] ?? 0) + 1;
arsort($byReason);
foreach ($byReason as $r => $c) printf("  %-28s %6d\n", $r, $c);

/* ── Кого это заденет ─────────────────────────────────────────────────────── */
echo "\nЧТО БУДЕТ УДАЛЕНО\n$line\n";
$emails = array_keys($stop);
$chunks = array_chunk($emails, 400);

$countIn = static function (string $sql, array $chunks): int {
    $n = 0;
    foreach ($chunks as $ch) {
        $in = implode(',', array_fill(0, count($ch), '?'));
        try { $n += (int) (scalar(str_replace('{IN}', $in, $sql), $ch) ?? 0); } catch (\Throwable $e) {}
    }
    return $n;
};

$instByStop = $countIn("SELECT COUNT(*) FROM institutions WHERE LOWER(email) IN ({IN}) AND status<>'excluded'", $chunks);
$subsByStop = $countIn("SELECT COUNT(*) FROM subscribers  WHERE LOWER(email) IN ({IN})", $chunks);
$queueStop  = $countIn("SELECT COUNT(*) FROM mail_queue   WHERE status='queued' AND LOWER(to_email) IN ({IN})", $chunks);
$instNoMail = (int) (scalar("SELECT COUNT(*) FROM institutions WHERE TRIM(COALESCE(email,''))='' AND status<>'excluded'") ?? 0);

// Учётные записи с мёртвым адресом делятся надвое, и обходиться с ними надо
// по-разному. Пустая запись, заведённая волной рассылки, — тот же мусор, что и
// мёртвый подписчик. А вот запись человека, у которого есть заявка, удалять
// нельзя ни при каких условиях: за ней стоят оплата, оценка жюри и диплом.
// Такому только выключаем почтовые уведомления, чтобы не бить в мёртвый ящик.
$usersIdle = $countIn("SELECT COUNT(*) FROM users u WHERE LOWER(u.email) IN ({IN})
                        AND NOT EXISTS (SELECT 1 FROM applications a WHERE a.user_id=u.id)
                        AND COALESCE(u.role,'user') NOT IN ('owner','admin','orgcom','moderator','jury','designer')", $chunks);
$usersKeep = $countIn("SELECT COUNT(*) FROM users u WHERE LOWER(u.email) IN ({IN})
                        AND EXISTS (SELECT 1 FROM applications a WHERE a.user_id=u.id)", $chunks);

printf("  учреждений с мёртвым адресом:    %6d\n", $instByStop);
printf("  учреждений вообще без почты:     %6d\n", $instNoMail);
printf("  подписчиков с мёртвым адресом:   %6d\n", $subsByStop);
printf("  пустых учётных записей:          %6d\n", $usersIdle);
printf("  писем к ним снимем с очереди:    %6d\n", $queueStop);
printf("  участников с заявками:           %6d  (запись сохраняем, только глушим рассылку)\n", $usersKeep);

echo "\nЧТО ОСТАЁТСЯ\n$line\n";
printf("  учреждений в работе:             %6d\n",
    (int) (scalar("SELECT COUNT(*) FROM institutions WHERE TRIM(COALESCE(email,''))<>''") ?? 0) - $instByStop);
printf("  активных подписчиков:            %6d\n",
    (int) (scalar("SELECT COUNT(*) FROM subscribers WHERE active=1") ?? 0) - $subsByStop);

if (!$apply) { echo "\nничего не меняли — запустите с --apply\n"; exit(0); }

/* ── Чистка ───────────────────────────────────────────────────────────────── */
echo "\nЧИСТИМ\n$line\n";

// Архивы — полные копии удаляемых строк, чтобы решение было обратимым.
db()->exec("CREATE TABLE IF NOT EXISTS institutions_removed AS SELECT * FROM institutions WHERE 0");
db()->exec("CREATE TABLE IF NOT EXISTS subscribers_removed  AS SELECT * FROM subscribers  WHERE 0");
db()->exec("CREATE TABLE IF NOT EXISTS users_removed        AS SELECT * FROM users        WHERE 0");

$ins = db()->prepare("INSERT OR REPLACE INTO mail_stop (email, reason, source) VALUES (?,?,?)");
db()->beginTransaction();
try {
    foreach ($stop as $e => $s) $ins->execute([$e, $s['reason'], $s['source']]);

    $chg = static fn(): int => (int) db()->query("SELECT changes()")->fetchColumn();
    $done = ['учреждения' => 0, 'подписчики' => 0, 'пустые записи' => 0,
             'заглушены' => 0, 'очередь' => 0, 'без почты' => 0];

    foreach ($chunks as $ch) {
        $in = implode(',', array_fill(0, count($ch), '?'));

        // Пустые учётные записи — вместе с их подписками и уведомлениями.
        q("INSERT INTO users_removed SELECT * FROM users u WHERE LOWER(u.email) IN ($in)
             AND NOT EXISTS (SELECT 1 FROM applications a WHERE a.user_id=u.id)
             AND COALESCE(u.role,'user') NOT IN ('owner','admin','orgcom','moderator','jury','designer')", $ch);
        q("DELETE FROM notifications WHERE user_id IN (SELECT id FROM users_removed)");
        q("DELETE FROM users WHERE id IN (SELECT id FROM users_removed)");
        $done['пустые записи'] += $chg();

        // Участник с заявкой остаётся, но письма ему больше не шлём.
        q("UPDATE users SET notify_email=0 WHERE LOWER(email) IN ($in) AND COALESCE(notify_email,1)=1", $ch);
        $done['заглушены'] += $chg();
        q("INSERT INTO institutions_removed SELECT * FROM institutions
            WHERE LOWER(email) IN ($in) AND status<>'excluded'", $ch);
        q("DELETE FROM institutions WHERE LOWER(email) IN ($in) AND status<>'excluded'", $ch);
        $done['учреждения'] += $chg();

        q("INSERT INTO subscribers_removed SELECT * FROM subscribers WHERE LOWER(email) IN ($in)", $ch);
        q("DELETE FROM subscribers WHERE LOWER(email) IN ($in)", $ch);
        $done['подписчики'] += $chg();

        q("UPDATE mail_queue SET status='cancelled', error='адрес вычищен: мёртвый или отказавшийся'
            WHERE status='queued' AND LOWER(to_email) IN ($in)", $ch);
        $done['очередь'] += $chg();
    }

    // Учреждения без почты: писать некуда, в рассылочной базе им не место.
    q("INSERT INTO institutions_removed SELECT * FROM institutions
        WHERE TRIM(COALESCE(email,''))='' AND status<>'excluded'");
    q("DELETE FROM institutions WHERE TRIM(COALESCE(email,''))='' AND status<>'excluded'");
    $done['без почты'] = $chg();

    db()->commit();
    foreach ($done as $k => $v) printf("  %-14s удалено/снято: %d\n", $k, $v);
} catch (\Throwable $e) {
    db()->rollBack();
    echo "  ОТКАТ: " . $e->getMessage() . "\n";
    exit(1);
}

printf("\nв стоп-листе адресов: %d\n", (int) db()->query("SELECT COUNT(*) FROM mail_stop")->fetchColumn());
echo "архивы удалённых: institutions_removed, subscribers_removed — вернуть можно в любой момент\n";
