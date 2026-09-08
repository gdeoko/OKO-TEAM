<?php
/**
 * vk_dialogs_export.php — выгрузка переписки сообщества ВК для обучения бота.
 *
 * ЗАЧЕМ. Ассистент учится на том, что видит перед ответом: на эталонах стиля и
 * на уроках-исправлениях (core/chat_learn.php). До сих пор материал брался
 * только из chat_messages, а туда попадают лишь диалоги, которые вёл сам бот, —
 * девять штук с 10 августа. Основная переписка центра лежит в сообществе
 * ВКонтакте: пять тысяч диалогов, и отвечает в них владелец руками. Именно этот
 * голос и нужно перенести в бота.
 *
 * ЧТО ДЕЛАЕТ. Проходит диалоги от свежих к старым, забирает историю каждого и
 * складывает в JSONL: одна строка — один диалог со списком реплик. Останавливается,
 * когда диалоги становятся старше заданного срока (список отсортирован по дате
 * последнего сообщения). Ничего не отправляет и ничего не меняет — только читает.
 *
 * Запуск: php scripts/vk_dialogs_export.php --days=40 --out=data/vk_dialogs.jsonl
 */
declare(strict_types=1);
define('BASE_PATH', '/var/www/muzmir');
$GLOBALS['CFG'] = require BASE_PATH . '/config.php';
require_once BASE_PATH . '/core/db.php';
require_once BASE_PATH . '/core/data.php';
require_once BASE_PATH . '/core/helpers.php';

$days = 40;
$out  = BASE_PATH . '/data/vk_dialogs.jsonl';
foreach ($argv as $a) {
    if (preg_match('~^--days=(\d+)$~', $a, $m)) $days = max(1, (int) $m[1]);
    if (preg_match('~^--out=(.+)$~', $a, $m))   $out  = $m[1][0] === '/' ? $m[1] : BASE_PATH . '/' . $m[1];
}

$token = (string) cfgv('vk_token', '');
$group = (int) cfgv('vk_group_id', 0);
if ($token === '' || $group === 0) { fwrite(STDERR, "нет vk_token или vk_group_id\n"); exit(1); }

/** Вызов VK API с мягкой обработкой лимита частоты. */
function vkq(string $method, array $params, string $token): array {
    $params['access_token'] = $token;
    $params['v'] = '5.199';
    for ($try = 0; $try < 5; $try++) {
        $ch = curl_init('https://api.vk.com/method/' . $method);
        curl_setopt_array($ch, [CURLOPT_POST => true, CURLOPT_POSTFIELDS => http_build_query($params),
                                CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 45]);
        $raw = curl_exec($ch);
        curl_close($ch);
        $d = json_decode((string) $raw, true);
        if (!is_array($d)) { usleep(400000); continue; }
        /* ЖДАТЬ НАДО НЕ ТОЛЬКО ШЕСТЁРКУ.
         *
         * Повтор стоял только на ошибке 6 («слишком много запросов в секунду»).
         * Но ВКонтакте отвечает и девяткой — «Flood control»: это тот же отказ
         * по темпу, только с более долгим остыванием. Её никто не ловил, и
         * выгрузка обрывалась на первом же запросе с сообщением «ошибка списка:
         * Flood control» — проверено 8 сентября, две попытки подряд.
         *
         * Шестёрке хватает доли секунды, девятке — секунд; поэтому пауза растёт
         * с каждой попыткой, а не остаётся постоянной. */
        $code = isset($d['error']) ? (int) $d['error']['error_code'] : 0;
        if ($code === 6 || $code === 9) {
            sleep($code === 9 ? min(30, 3 << $try) : 1);
            continue;
        }
        return $d;
    }
    return ['error' => ['error_msg' => 'нет ответа после пяти попыток']];
}

$since = time() - $days * 86400;

/* ПИШЕМ ВО ВРЕМЕННЫЙ ФАЙЛ, А НЕ ПОВЕРХ ГОТОВОЙ ВЫГРУЗКИ.
 *
 * Здесь стояло fopen($out,'w') сразу: файл обнулялся ДО первого запроса. Если
 * ВКонтакте отвечал «Flood control» — а он отвечает, когда рядом работает
 * заполнение имён, — выгрузка обрывалась на нулевом диалоге, и вместо прошлой,
 * полной, на диске оставался пустой файл. Обучение после такого запуска училось
 * на пустоте. Теперь прежняя выгрузка заменяется только удачной новой. */
$tmp = $out . '.part';
$fh = fopen($tmp, 'w');
if (!$fh) { fwrite(STDERR, "не открывается $tmp\n"); exit(1); }

$offset = 0; $dialogs = 0; $msgs = 0; $stop = false;
$names = [];

while (!$stop) {
    $r = vkq('messages.getConversations',
             ['count' => 200, 'offset' => $offset, 'group_id' => $group, 'extended' => 1], $token);
    if (isset($r['error'])) { fwrite(STDERR, 'ошибка списка: ' . $r['error']['error_msg'] . "\n"); break; }
    $items = $r['response']['items'] ?? [];
    if (!$items) break;

    foreach (($r['response']['profiles'] ?? []) as $p) {
        $names[(int) $p['id']] = trim(($p['first_name'] ?? '') . ' ' . ($p['last_name'] ?? ''));
    }

    foreach ($items as $it) {
        $peer = (int) ($it['conversation']['peer']['id'] ?? 0);
        $last = (int) ($it['last_message']['date'] ?? 0);
        if ($peer === 0) continue;
        if ($last < $since) { $stop = true; break; }   // дальше только старее

        $h = vkq('messages.getHistory',
                 ['peer_id' => $peer, 'count' => 200, 'group_id' => $group, 'rev' => 0], $token);
        if (isset($h['error'])) { fwrite(STDERR, "  peer $peer: " . $h['error']['error_msg'] . "\n"); continue; }

        $turns = [];
        foreach (array_reverse($h['response']['items'] ?? []) as $m) {
            $txt = trim((string) ($m['text'] ?? ''));
            if ($txt === '') continue;
            // out=1 — писало сообщество. admin_author_id стоит, когда за сообщество
            // писал человек из админов; без него это ответ бота через API.
            $turns[] = [
                'who'   => ((int) ($m['out'] ?? 0) === 1)
                            ? (!empty($m['admin_author_id']) ? 'owner' : 'bot')
                            : 'user',
                'admin' => (int) ($m['admin_author_id'] ?? 0),
                'date'  => date('Y-m-d H:i:s', (int) $m['date']),
                'text'  => $txt,
            ];
            $msgs++;
        }
        if (!$turns) continue;

        fwrite($fh, json_encode([
            'peer'  => $peer,
            'name'  => $names[$peer] ?? '',
            'last'  => date('Y-m-d H:i:s', $last),
            'turns' => $turns,
        ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . "\n");
        $dialogs++;
        if ($dialogs % 50 === 0) { echo "  диалогов $dialogs, реплик $msgs\n"; flush(); }
        usleep(220000);                                 // 3 запроса в секунду — предел сообщества
    }
    if ($stop) break;
    $offset += 200;
    if ($offset > 6000) break;                          // страховка от бесконечного круга
}

fclose($fh);
if ($dialogs > 0) {
    rename($tmp, $out);
    echo "готово: диалогов $dialogs, реплик $msgs → $out\n";
} else {
    @unlink($tmp);
    $had = is_file($out) ? ' Прежняя выгрузка сохранена.' : '';
    fwrite(STDERR, "ВКонтакте не отдал ни одного диалога — выгрузка не заменена.$had\n");
    exit(2);
}
