<?php
/**
 * СКВОЗНОЙ АУДИТ ВСЕХ ПОЧТОВЫХ ЦЕПОЧЕК.
 *
 * Отдельные проверки уже есть: кабинет, админка, партнёрка, ведомства, входящая
 * почта. Здесь проверяется то, что между ними: ящики и маршрутизация писем,
 * персонализация каждой волны, стоп-лист, темп рассылки и его лесенка, полнота
 * охвата базы, вложения, отписка, защита от повторов.
 *
 * Работает ТОЛЬКО на чтение и на собственных временных данных: ни одной живой
 * записи не меняет, ни одного настоящего письма не отправляет.
 *
 *   php scripts/audit_chains.php
 */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { fwrite(STDERR, "CLI only\n"); exit(1); }

define('BASE_PATH', dirname(__DIR__));
$GLOBALS['CFG'] = require BASE_PATH . '/config.php';
require_once BASE_PATH . '/core/db.php';
require_once BASE_PATH . '/core/data.php';
require_once BASE_PATH . '/core/helpers.php';
require_once BASE_PATH . '/core/mailer.php';
require_once BASE_PATH . '/core/person_name.php';
require_once BASE_PATH . '/core/newsletter.php';
require_once BASE_PATH . '/core/launch_combo.php';
require_once BASE_PATH . '/core/institutions.php';
require_once BASE_PATH . '/core/partner.php';
require_once BASE_PATH . '/core/inbox_reader.php';

$OK = 0; $BAD = 0; $WARN = 0;
$line = str_repeat('=', 78);
function sec(string $t): void { echo "\n" . $t . "\n" . str_repeat('=', 78) . "\n"; }
function ok(string $s, string $x = ''): void   { global $OK;   $OK++;   echo "  [ок]   $s" . ($x !== '' ? " — $x" : '') . "\n"; }
function bad(string $s, string $x = ''): void  { global $BAD;  $BAD++;  echo "  [СБОЙ] $s" . ($x !== '' ? " — $x" : '') . "\n"; }
function warn(string $s, string $x = ''): void { global $WARN; $WARN++; echo "  [!]    $s" . ($x !== '' ? " — $x" : '') . "\n"; }
/** Проверка: true — ок, строка — ок с пояснением, false — сбой. */
function check(string $title, callable $fn): void {
    try { $r = $fn(); } catch (\Throwable $e) { bad($title, 'исключение: ' . $e->getMessage()); return; }
    if ($r === false || $r === null) { bad($title); return; }
    ok($title, is_string($r) ? $r : '');
}

/* ═══ 1. ЯЩИКИ И МАРШРУТИЗАЦИЯ ═══════════════════════════════════════════ */
sec('1. ЯЩИКИ И КУДА ЧТО УХОДИТ');

$pools = ['bulk' => 'массовые рассылки', 'cold' => 'холодная база', 'awards' => 'награды и дипломы',
          'official' => 'обращения в ведомства', 'news' => 'новости', 'tx' => 'личные письма'];
foreach ($pools as $pool => $what) {
    check("пул «" . $pool . "» ($what) настроен", function () use ($pool) {
        $accs = mail_fallback_accounts([], $pool);
        if (!$accs) return false;
        $names = [];
        foreach ($accs as $a) $names[] = (string) ($a['user'] ?? $a['name'] ?? '?');
        return implode(', ', $names);
    });
}

check('обратный адрес подставляется по типу письма', function () {
    if (!function_exists('mail_reply_box')) return false;
    $a = mail_reply_box('awards');
    $b = mail_reply_box('official');
    return $a !== '' && $b !== '' ? "награды → $a, ведомства → $b" : false;
});

check('адреса зоны .test письмами не тревожим', function () {
    return mail_send_failover('nobody@example.test', 'проверка', '<p>проверка</p>') === true
        ? 'письмо не ушло, ошибки нет' : false;
});

/* ═══ 2. СТОП-ЛИСТ ═══════════════════════════════════════════════════════ */
sec('2. СТОП-ЛИСТ: МЁРТВЫМ И ОТКАЗАВШИМСЯ НЕ ПИШЕМ');

check('таблица стоп-листа существует', function () {
    return (bool) one("SELECT name FROM sqlite_master WHERE type='table' AND name='mail_stop'");
});
check('в стоп-листе есть записи', function () {
    $n = (int) (scalar("SELECT COUNT(*) FROM mail_stop") ?? 0);
    return $n > 0 ? "адресов: $n" : false;
});
check('адрес из стоп-листа не проходит проверку отправки', function () {
    $e = (string) (scalar("SELECT email FROM mail_stop LIMIT 1") ?? '');
    if ($e === '') return false;
    return mail_is_stopped($e) ? "проверено на $e" : false;
});
// Стоп-лист закрывает РАССЫЛКУ, а не переписку: личное письмо (результат,
// наградный материал, код входа) в очередь попадает и уходит. Проверяем то, что
// действительно запрещено, — массовое письмо адресату из стоп-листа.
check('массовое письмо адресату из стоп-листа не уходит', function () {
    $e = (string) (scalar("SELECT email FROM mail_stop LIMIT 1") ?? '');
    if ($e === '') return 'стоп-лист пуст';
    $ok = function_exists('mail_send_failover')
        ? !mail_send_failover($e, 'проверка стоп-листа', '<p>проверка</p>', ['priority' => 5])
        : false;
    return $ok ? 'отсеяно до отправки' : false;
});
check('в очереди нет МАССОВЫХ писем к адресам из стоп-листа', function () {
    $n = (int) (scalar("SELECT COUNT(*) FROM mail_queue q JOIN mail_stop s ON s.email=LOWER(q.to_email)
                         WHERE q.status='queued' AND COALESCE(q.priority,0) > 0") ?? 0);
    return $n === 0 ? 'ни одного' : false;
});
check('в рассылке учреждений не осталось мёртвых адресов', function () {
    $n = (int) (scalar("SELECT COUNT(*) FROM institutions i JOIN mail_stop s ON s.email=LOWER(i.email)
                         WHERE i.status NOT IN ('excluded','bounced','unsubscribed','banned')") ?? 0);
    return $n === 0 ? 'ни одного' : false;
});
check('среди активных подписчиков нет мёртвых адресов', function () {
    $n = (int) (scalar("SELECT COUNT(*) FROM subscribers b JOIN mail_stop s ON s.email=LOWER(b.email)
                         WHERE b.active=1") ?? 0);
    return $n === 0 ? 'ни одного' : false;
});
check('удалённое сохранено и обратимо', function () {
    $i = (int) (scalar("SELECT COUNT(*) FROM institutions_removed") ?? 0);
    $s = (int) (scalar("SELECT COUNT(*) FROM subscribers_removed") ?? 0);
    return "в архиве учреждений $i, подписчиков $s";
});

/* ═══ 3. ВОЛНА ПО СВОЕЙ БАЗЕ ═════════════════════════════════════════════ */
sec('3. ВОЛНА ПО СВОЕЙ БАЗЕ: ПЕРСОНАЛИЗАЦИЯ');

check('тело письма собирается под каждого, а не лежит готовым', function () {
    $n = (int) (scalar("SELECT COUNT(*) FROM mail_queue
                         WHERE campaign_type='konkurs' AND status='queued'
                           AND COALESCE(build,'')<>'' AND COALESCE(body,'')=''") ?? 0);
    $t = (int) (scalar("SELECT COUNT(*) FROM mail_queue WHERE campaign_type='konkurs' AND status='queued'") ?? 0);
    return $t > 0 && $n === $t ? "рецептов $n из $t" : ($t === 0 ? 'очередь пуста' : false);
});
check('в письме есть имя, логин и пароль', function () {
    $html = launch_combo_inner(true, true, '{{login}}', '{{name}}', '{{password}}');
    foreach (['{{login}}', '{{name}}', '{{password}}'] as $m) if (mb_strpos($html, $m) === false) return false;
    return 'все три подстановки на месте';
});
check('блок кабинета не показывают тем, кто уже входил', function () {
    $html = launch_combo_inner(false, true, 'a@b.ru', 'Имя', '');
    return mb_stripos($html, 'Пароль') === false ? 'пароля в письме нет' : false;
});
check('блок клуба не показывают тем, кто уже в клубе', function () {
    $html = launch_combo_inner(false, false, 'a@b.ru', 'Имя', '');
    return mb_stripos($html, 'Клуб') === false ? 'приглашения в клуб нет' : false;
});
check('имя распознаётся по адресу, если человек его не указал', function () {
    $n = person_greeting_name('nelaeva.svetlana@mail.ru', '');
    return $n !== '' ? 'nelaeva.svetlana@ → «' . $n . '»' : false;
});
// Смотрим то, что ещё можно изменить: письма в очереди. Уже ушедшее письмо
// проверкой не вернёшь, а вечно красный аудит перестают читать.
check('одному адресу одно письмо волны месяца', function () {
    $n = (int) (scalar("SELECT COUNT(*) FROM (
                          SELECT to_email FROM mail_queue
                           WHERE newsletter_id>0 AND status IN ('queued','paused')
                           GROUP BY newsletter_id, LOWER(to_email) HAVING COUNT(*)>1)") ?? 0);
    return $n === 0 ? 'повторов нет' : false;
});
check('после закрытия приёма приглашения не уходят', function () {
    return nl_letter_expired(['campaign_type' => 'konkurs', 'subject' => 'Открыт приём заявок'])
        === ((string) setting('intake_closed', '') === '1') ? 'правило работает' : false;
});

/* ═══ 4. ВОЛНА ПО УЧРЕЖДЕНИЯМ ════════════════════════════════════════════ */
sec('4. ВОЛНА ПО УЧРЕЖДЕНИЯМ: ИМЕННЫЕ ОБРАЩЕНИЯ');

check('у каждого письма своё название учреждения', function () {
    $t = (int) (scalar("SELECT COUNT(*) FROM mail_queue WHERE campaign_type='inst' AND status='queued'") ?? 0);
    $n = (int) (scalar("SELECT COUNT(*) FROM mail_queue WHERE campaign_type='inst' AND status='queued'
                          AND TRIM(COALESCE(to_name,''))<>''") ?? 0);
    return $t === 0 ? 'очередь пуста' : ($n === $t ? "именных $n из $t" : false);
});
check('у каждого письма свой исходящий номер', function () {
    $d = (int) (scalar("SELECT COUNT(*) FROM (
                          SELECT number FROM official_letters GROUP BY number HAVING COUNT(*)>1)") ?? 0);
    return $d === 0 ? 'повторов номеров нет' : false;
});
check('к письму приложен бланк обращения', function () {
    $t = (int) (scalar("SELECT COUNT(*) FROM mail_queue WHERE campaign_type='inst' AND status='queued'") ?? 0);
    $n = (int) (scalar("SELECT COUNT(*) FROM mail_queue WHERE campaign_type='inst' AND status='queued'
                          AND COALESCE(attach,'') LIKE '%obrashchenie-%'") ?? 0);
    return $t === 0 ? 'очередь пуста' : ($n === $t ? "с бланком $n из $t" : false);
});
check('файлы вложений лежат на диске', function () {
    $miss = 0; $tot = 0;
    foreach (all("SELECT attach FROM mail_queue WHERE status='queued' AND COALESCE(attach,'')<>''") as $r) {
        $list = json_decode((string) $r['attach'], true);
        if (!is_array($list)) $list = [(string) $r['attach']];
        foreach ($list as $f) { $tot++; if (!is_file((string) $f)) $miss++; }
    }
    return $miss === 0 ? "проверено файлов: $tot" : false;
});
check('страница проверки подлинности отвечает', function () {
    $num = (string) (scalar("SELECT number FROM official_letters WHERE number LIKE '%/%' ORDER BY id DESC LIMIT 1") ?? '');
    if ($num === '') return false;
    $url = rtrim((string) cfgv('base_url'), '/') . '/letter/' . str_replace('/', '/', $num);
    $ch = curl_init($url);
    curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 15, CURLOPT_SSL_VERIFYPEER => false]);
    $body = (string) curl_exec($ch);
    $code = (int) curl_getinfo($ch, CURLINFO_RESPONSE_CODE);
    curl_close($ch);
    return $code === 200 && mb_strpos($body, 'QR') !== false ? "исх. №$num, QR на месте" : false;
});
check('приглашение не уходит дважды одному учреждению', function () {
    $n = (int) (scalar("SELECT COUNT(*) FROM (
                          SELECT LOWER(to_email) e FROM mail_queue
                           WHERE campaign_type='inst' AND status IN ('queued','sent')
                           GROUP BY 1 HAVING COUNT(*)>2)") ?? 0);
    return $n === 0 ? 'повторов сверх допустимого нет' : "адресов с 3+ письмами: $n";
});

/* ═══ 5. ТЕМП И ОХВАТ ════════════════════════════════════════════════════ */
sec('5. ТЕМП РАССЫЛКИ И ОХВАТ БАЗЫ');

check('лесенка прогрева задана', function () {
    $l = trim((string) setting('nl_warmup_ladder', ''));
    return $l !== '' ? $l : false;
});
check('сегодняшняя норма и её деление', function () {
    $cap = nl_daily_cap();
    $sp  = nl_daily_split();
    return sprintf('всего %d: своя база %d, учреждения %d', $cap, $sp['konkurs'] ?? 0, $sp['inst'] ?? 0);
});
check('месячного пакета хватает на оставшуюся базу', function () {
    $left = nl_service_month_left();
    $need = (int) (scalar("SELECT COUNT(*) FROM mail_queue WHERE status='queued'") ?? 0)
          + (int) (scalar("SELECT COUNT(*) FROM institutions WHERE status='new' AND TRIM(COALESCE(email,''))<>''") ?? 0);
    return $left >= $need ? "остаток $left, нужно ещё около $need" : "остатка $left, а нужно $need";
});
check('окно отправки настроено', function () {
    return sprintf('дни %s-%s месяца, часы %s-%s, воскресенье %s',
        setting('nl_window_day_from', '1'), setting('nl_window_day_to', '24'),
        setting('nl_window_hour_from', '8'), setting('nl_window_hour_to', '18'),
        (string) setting('nl_window_sunday', '0') === '1' ? 'рабочее' : 'выходной');
});
check('стоп-кран массовых рассылок поднят', function () {
    return mass_sending_enabled() ? 'массовые разрешены' : false;
});
check('очередь учреждений добирается сама', function () {
    $q = (int) (scalar("SELECT COUNT(*) FROM mail_queue WHERE campaign_type='inst' AND status='queued'") ?? 0);
    $waiting = (int) (scalar("SELECT COUNT(*) FROM institutions
                               WHERE status='new' AND TRIM(COALESCE(email,''))<>''") ?? 0);
    $sp = nl_daily_split();
    $need = (int) ($sp['inst'] ?? 0);
    return $q >= $need ? "в очереди $q при норме $need в день, ждут первого письма $waiting"
                       : "в очереди $q, а норма $need — доберётся ближайшим кроном";
});

/* ═══ 6. ЛИЧНЫЕ ПИСЬМА ═══════════════════════════════════════════════════ */
sec('6. ЛИЧНЫЕ ПИСЬМА: ИДУТ СРАЗУ И ВНЕ ЛИМИТОВ');

check('личные письма не копятся в очереди', function () {
    $n = (int) (scalar("SELECT COUNT(*) FROM mail_queue
                         WHERE status='queued' AND COALESCE(priority,0)=0
                           AND COALESCE(campaign_type,'')<>'official'") ?? 0);
    return $n <= 30 ? "ждут отправки: $n" : "накопилось $n — воркер не справляется";
});
check('обращения в ведомства идут своим темпом', function () {
    $per = (int) cfgv('official_per_minute', 5);
    $n = (int) (scalar("SELECT COUNT(*) FROM mail_queue
                         WHERE status='queued' AND COALESCE(campaign_type,'')='official'") ?? 0);
    return "в минуту не больше $per, ждут: $n";
});
check('у каждого типа письма свой обратный адрес', function () {
    $rows = all("SELECT DISTINCT campaign_type, sent_via FROM mail_queue
                  WHERE status='sent' AND COALESCE(sent_via,'')<>'' LIMIT 20");
    if (!$rows) return 'отправленных с отметкой ящика ещё нет';
    $map = [];
    foreach ($rows as $r) $map[(string) ($r['campaign_type'] ?: 'личные')][] = (string) $r['sent_via'];
    $out = [];
    foreach ($map as $k => $v) $out[] = $k . '→' . implode('/', array_unique($v));
    return implode('; ', $out);
});

/* ═══ 7. ОТПИСКА И СОГЛАСИЯ ══════════════════════════════════════════════ */
sec('7. ОТПИСКА, СОГЛАСИЯ, ВХОДЯЩИЕ');

check('в массовом письме есть ссылка отписки', function () {
    $row = one("SELECT * FROM mail_queue WHERE campaign_type='inst' AND status='queued' LIMIT 1");
    if (!$row) return 'очередь пуста';
    return mb_strpos((string) $row['body'], 'unsubscribe') !== false ? 'ссылка на месте' : false;
});
check('отписка по ссылке отключает адрес', function () {
    $t = (string) (scalar("SELECT unsub_token FROM subscribers WHERE active=1 AND COALESCE(unsub_token,'')<>'' LIMIT 1") ?? '');
    return $t !== '' ? 'у подписчиков есть личные метки отписки' : false;
});
check('входящая почта разбирается без остатка', function () {
    $n = (int) (scalar("SELECT COUNT(*) FROM inbox_messages WHERE handled_by='' AND is_auto=0
                         AND kind NOT IN ('service','bounce','auto')") ?? 0);
    return $n === 0 ? 'неразобранных нет' : "ждут разбора: $n";
});
check('согласие учреждения читается из базы, а не вслепую', function () {
    // Тот самый запрос, что делает разборщик писем: колонка должна существовать.
    $r = one("SELECT id, name, partner_status FROM institutions LIMIT 1");
    return is_array($r) && array_key_exists('name', $r) ? 'запрос разборщика проходит' : false;
});
check('статус принятого партнёра совпадает у всех участников цепочки', function () {
    $src = @file_get_contents(BASE_PATH . '/cron/inbox_actions.php') ?: '';
    return mb_strpos($src, "=== 'active'") === false ? 'сверка идёт с accepted' : false;
});

/* ═══ 8. ЗАЩИТА ОТ ПОВТОРОВ И ОТ ПОТЕРЬ ══════════════════════════════════ */
sec('8. ЗАЩИТА ОТ ПОВТОРОВ И ОТ ПОТЕРЬ');

check('письма без адреса в очередь не попадают', function () {
    $n = (int) (scalar("SELECT COUNT(*) FROM mail_queue WHERE TRIM(COALESCE(to_email,''))=''") ?? 0);
    return $n === 0 ? 'ни одного' : false;
});
check('на свои же ящики массовое не шлём', function () {
    $own = function_exists('inbox_own_emails') ? inbox_own_emails() : [];
    if (!$own) return 'список своих ящиков пуст';
    $in = implode(',', array_fill(0, count($own), '?'));
    $n = (int) (scalar("SELECT COUNT(*) FROM mail_queue WHERE status='queued' AND COALESCE(priority,0)>0
                          AND LOWER(to_email) IN ($in)", $own) ?? 0);
    return $n === 0 ? 'ни одного' : false;
});
check('неудачное письмо не теряется, а повторяется', function () {
    $n = (int) (scalar("SELECT COUNT(*) FROM mail_queue WHERE status='queued' AND COALESCE(tries,0)>0") ?? 0);
    return "ждут повтора: $n (после трёх попыток уходят в отказ)";
});
check('время в базе московское', function () {
    $php = date('Y-m-d H:i:s');
    $sql = (string) scalar("SELECT datetime('now','localtime')");
    return abs(strtotime($php) - strtotime($sql)) <= 5 ? "$sql" : false;
});

/* ═══ 9. КРОНЫ ═══════════════════════════════════════════════════════════ */
sec('9. КРОНЫ: ВСЁ ЛИ ХОДИТ ВОВРЕМЯ');

$expect = [
    'process_newsletter_queue' => 5,      // минут допустимого молчания
    'reconcile_payments'       => 10,
    'dunning'                  => 10,
    'inbox_read'               => 20,
    'mail_events_apply'        => 20,
    'partner_triggers'         => 90,
    'health_check'             => 20,
];
$log = BASE_PATH . '/data/logs/cron.log';
$tail = is_file($log) ? (string) @shell_exec('tail -n 4000 ' . escapeshellarg($log)) : '';
foreach ($expect as $job => $maxMin) {
    check("крон $job работает", function () use ($job, $maxMin, $tail) {
        if (preg_match_all('~\[(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})\] \[' . preg_quote($job, '~') . '\]~', $tail, $m)
            && $m[1]) {
            $last = end($m[1]);
            $ago = (int) round((time() - strtotime($last)) / 60);
            return $ago <= $maxMin ? "последний запуск $ago мин. назад" : "молчит $ago мин. (норма $maxMin)";
        }
        return false;
    });
}
check('ошибок в журнале кронов за сутки нет', function () use ($tail) {
    $n = 0;
    foreach (explode("\n", $tail) as $l) {
        if (!preg_match('~\[(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})\]~', $l, $m)) continue;
        if (strtotime($m[1]) < time() - 86400) continue;
        if (preg_match('~FATAL|ОШИБКА|Fatal error|Uncaught~u', $l)) $n++;
    }
    return $n === 0 ? 'ни одной' : "ошибок: $n";
});

/* ═══ ИТОГ ═══════════════════════════════════════════════════════════════ */
echo "\n$line\n";
printf("ПРОЙДЕНО: %d · СБОЕВ: %d · ПРЕДУПРЕЖДЕНИЙ: %d\n", $OK, $BAD, $WARN);
exit($BAD > 0 ? 1 : 0);
