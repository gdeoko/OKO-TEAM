<?php
/**
 * СПИСОК ПОДАВЛЕНИЯ НА СТОРОНЕ СЕРВИСА РАССЫЛОК.
 *
 * У сервиса есть собственный чёрный список адресов. Попав в него, адрес больше
 * не получает наших писем ВООБЩЕ: сервис не пытается доставить, а возвращает
 * событие skip_dup_unreachable. Наша очередь при этом считает письмо
 * отправленным и идёт дальше — человек не получает ничего, а мы об этом даже
 * не знаем.
 *
 * Список пополняется автоматически по отказам. 17 августа mail.ru три часа
 * отбивал письма пачкой (зажим незнакомого отправителя, а не мёртвые адреса), и
 * все эти адреса сервис записал себе как «навсегда недоступные». То есть одна
 * утренняя заминка почтовика закрыла нам дорогу к полутора тысячам живых людей.
 *
 * Здесь список виден и чистится. Удаляем ТОЛЬКО те записи, которые сервис
 * поставил сам (source=system) и только за указанный день — вручную внесённые
 * отписки и жалобы не трогаем никогда.
 *
 *   php scripts/unisender_suppression.php                   — что в списке
 *   php scripts/unisender_suppression.php --clear=2026-08-17 --dry
 *   php scripts/unisender_suppression.php --clear=2026-08-17   — эта дата И ПОЗЖЕ
 *   php scripts/unisender_suppression.php --clear-days=10      — последние 10 дней
 *
 * В кроне дату не зашивают: --clear=2026-08-14 через месяц означает «снимать всё
 * за месяц», а через год скрипт будет каждый день перебирать годовой список ради
 * полусотни снятий. Скользящее окно --clear-days держит внимание на свежих
 * записях, где ложных подавлений больше всего.
 *
 * У сервиса свой предел: около полусотни снятий в сутки, дальше он отвечает
 * «Exceeded the daily email reset limit». Поэтому скрипт стоит в кроне и
 * доделывает остаток на следующий день, а не пытается пробить лимит.
 */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { fwrite(STDERR, "CLI only\n"); exit(1); }

define('BASE_PATH', dirname(__DIR__));
$GLOBALS['CFG'] = require BASE_PATH . '/config.php';
require_once BASE_PATH . '/core/db.php';
require_once BASE_PATH . '/core/helpers.php';
require_once BASE_PATH . '/core/mail_reputation.php';

$dry   = in_array('--dry', $argv, true);
$clear = '';
foreach ($argv as $a) {
    if (preg_match('~^--clear=(\d{4}-\d{2}-\d{2})$~', $a, $m))  $clear = $m[1];
    if (preg_match('~^--clear-days=(\d{1,3})$~', $a, $m))       $clear = date('Y-m-d', strtotime('-' . max(1, (int) $m[1]) . ' days'));
}
$line = str_repeat('=', 78);

$key = trim((string) cfgv('unisender_api_key', ''));
if ($key === '') { fwrite(STDERR, "нет ключа сервиса рассылок\n"); exit(1); }

function us_call(string $method, array $params): array {
    $ch = curl_init('https://go2.unisender.ru/ru/transactional/api/v1/' . $method);
    curl_setopt_array($ch, [
        CURLOPT_POST => 1, CURLOPT_RETURNTRANSFER => 1, CURLOPT_TIMEOUT => 30,
        CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
        CURLOPT_POSTFIELDS => json_encode(array_merge(['api_key' => trim((string) cfgv('unisender_api_key', ''))], $params)),
    ]);
    $r = curl_exec($ch);
    curl_close($ch);
    $d = json_decode((string) $r, true);
    return is_array($d) ? $d : ['status' => 'error', 'message' => substr((string) $r, 0, 200)];
}

echo "СПИСОК ПОДАВЛЕНИЯ СЕРВИСА РАССЫЛОК\n$line\n";

$cursor = '';
$byCause = $byDate = [];
$victims = [];
$total = 0;
for ($page = 0; $page < 400; $page++) {
    $p = ['limit' => 500];
    if ($cursor !== '') $p['cursor'] = $cursor;
    $r = us_call('suppression/list.json', $p);
    if (($r['status'] ?? '') !== 'success') { echo "  сервис ответил: " . json_encode($r, 320) . "\n"; break; }
    $rows = $r['suppressions'] ?? [];
    if (!$rows) break;
    foreach ($rows as $s) {
        $total++;
        $cause = (string) ($s['cause'] ?? '');
        $date  = substr((string) ($s['created'] ?? ''), 0, 10);
        $byCause[$cause] = ($byCause[$cause] ?? 0) + 1;
        $byDate[$date]   = ($byDate[$date] ?? 0) + 1;
        if ($clear !== '' && $date >= $clear
            && (string) ($s['source'] ?? '') === 'system'
            && !empty($s['is_deletable'])
            // Жалобу на спам и отписку человек сделал сам — их не снимаем.
            && !in_array($cause, ['complained', 'unsubscribed'], true)) {
            $victims[] = (string) $s['email'];
        }
    }
    $cursor = (string) ($r['cursor'] ?? '');
    if ($cursor === '') break;
}

printf("  записей всего: %s\n\n  по причине:\n", number_format($total, 0, '.', ' '));
arsort($byCause);
foreach ($byCause as $c => $n) printf("    %-28s %s\n", $c !== '' ? $c : '(без причины)', number_format($n, 0, '.', ' '));
echo "\n  по дате (последние):\n";
krsort($byDate);
$i = 0;
foreach ($byDate as $d => $n) { printf("    %-12s %s\n", $d, number_format($n, 0, '.', ' ')); if (++$i >= 8) break; }

if ($clear === '') exit(0);

printf("\nК СНЯТИЮ ЗА %s: %s\n$line\n", $clear, number_format(count($victims), 0, '.', ' '));
if (!$victims) exit(0);
if ($dry) {
    foreach (array_slice($victims, 0, 10) as $v) echo "  $v\n";
    echo "\n  сухой прогон: ничего не изменено\n";
    exit(0);
}

/* СНАЧАЛА ТЕ, КТО ТОЧНО ЖИВ.
 *
 * Снятий в сутки около полусотни, а в списке за тысячу — значит очередь снятия
 * важнее самого снятия. Первыми идут адреса, которым мы когда-то уже доставили
 * письмо или которые его открывали: у такого адреса подавление заведомо ложное,
 * его поставила утренняя заминка почтовика. Остальные ждут своей очереди. */
$alive = [];
foreach (array_chunk($victims, 400) as $chunk) {
    $in = implode(',', array_fill(0, count($chunk), '?'));
    foreach (all("SELECT DISTINCT LOWER(email) e FROM mail_events
                   WHERE status IN ('delivered','opened','clicked') AND LOWER(email) IN ($in)",
                 array_map('mb_strtolower', $chunk)) as $r) {
        $alive[(string) $r['e']] = true;
    }
}
usort($victims, static fn($a, $b) =>
    (int) isset($alive[mb_strtolower($b)]) <=> (int) isset($alive[mb_strtolower($a)]));
printf("  из них с подтверждённой доставкой в прошлом: %s\n",
    number_format(count($alive), 0, '.', ' '));

$done = $fail = $back = 0;
$streak = 0;                      // подряд идущие отказы = упёрлись в суточный предел
foreach ($victims as $v) {
    $r = us_call('suppression/delete.json', ['email' => $v]);
    if (($r['status'] ?? '') === 'success') {
        $done++; $streak = 0;
        // Письмо, которое сервис отбросил, до человека не дошло: ставим заново.
        // Раньше это делал общий повтор ложных отказов, но он бил в закрытую
        // дверь — адрес всё ещё лежал в подавлении. Теперь повтор идёт ровно в
        // тот момент, когда дверь открылась.
        if (mrep_requeue_last($v, 'сервис рассылок держал адрес в списке подавления')) $back++;
        continue;
    }
    $fail++;
    if ((int) ($r['code'] ?? 0) === 906 && ++$streak >= 3) {
        echo "  суточный предел снятий у сервиса исчерпан, остальное — завтра\n";
        break;
    }
    usleep(150000);
}
printf("\nСДЕЛАНО\n$line\n  снято: %s, не удалось: %s, писем возвращено в очередь: %s\n",
    number_format($done, 0, '.', ' '), number_format($fail, 0, '.', ' '),
    number_format($back, 0, '.', ' '));
