<?php
/**
 * ЧИТАЕМ ПИСЬМА ГАЛЕРЕИ ГЛАЗАМИ, А НЕ ПО СТАТУСУ В БАЗЕ.
 *
 * Галерея /ministry-support показывает ответы ведомств как подтверждение
 * информационной поддержки, а наполняется она автоматически: всё, что не
 * распознано как отказ, попадает в витрину. Этого мало. «Обращения по
 * электронной почте не рассматриваются», квитанция о регистрации, разъяснение
 * о порядке взаимодействия — не отказ по формальным признакам, но и не
 * поддержка. Такие письма стояли в витрине наравне с настоящими.
 *
 * Обычное распознавание (tesseract) здесь не помогает: на сканах ведомственных
 * бланков оно уверенно читает шапку с реквизитами и рассыпается на теле письма —
 * ровно там, где написано, поддержали нас или нет. Поэтому документ смотрит
 * модель: ей видно и бланк, и текст, и подпись.
 *
 * Скрипт НИЧЕГО НЕ УДАЛЯЕТ и ничего не меняет в базе. Он только читает и
 * складывает разбор в JSON — решение по каждому письму принимает владелец.
 *
 *   php scripts/ministry_letters_read.php [--only=1,2,3] [--out=data/ml_read.json]
 */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { fwrite(STDERR, "CLI only\n"); exit(1); }

define('BASE_PATH', dirname(__DIR__));
$GLOBALS['CFG'] = require BASE_PATH . '/config.php';
require_once BASE_PATH . '/core/db.php';
require_once BASE_PATH . '/core/helpers.php';
require_once BASE_PATH . '/core/chat_media.php';
require_once BASE_PATH . '/core/chat_brain.php';

$out  = BASE_PATH . '/data/ml_read.json';
$only = [];
foreach (array_slice($argv, 1) as $a) {
    if (preg_match('~^--out=(.+)$~', $a, $m))  $out  = $m[1][0] === '/' ? $m[1] : BASE_PATH . '/' . $m[1];
    if (preg_match('~^--only=(.+)$~', $a, $m)) $only = array_map('intval', explode(',', $m[1]));
}

/* Ключей у сайта пара (MUZMIR_GEMINI_KEYS: бесплатный и платный) — берём их тем
 * же порядком, что и «мозг» чата, а не одиночный gemini_api_key: он на проде
 * пуст, и скрипт с ним просто не запускался бы. */
$keys = function_exists('chat_gemini_keys') ? chat_gemini_keys() : [];
$keys = array_values(array_filter(array_map('trim', $keys)));
if (!$keys) { fwrite(STDERR, "нет ключей Gemini\n"); exit(1); }
$key = $keys[0];

/* Вопрос модели прямой, ответ — строгий JSON. Нас интересует ровно одно: есть
 * ли в письме согласие поддержать, и если нет — что там вместо этого. */
const PROMPT = <<<'TXT'
Перед тобой скан официального письма российского ведомства в адрес Культурного
центра «Музыкальный Мир». Прочитай письмо целиком: бланк, тело, подпись.

Ответь СТРОГО одним JSON-объектом, без пояснений и без markdown:
{
  "org": "название организации-отправителя как в бланке",
  "support": "yes" | "no" | "unclear",
  "what": "одно предложение: что именно ведомство сообщает",
  "quote": "дословная цитата из письма, на которой основан вывод (до 200 знаков)"
}

"yes" ставь, только если ведомство СОГЛАСИЛОСЬ: обещает информационную
поддержку, разместит анонс, доведёт информацию до подведомственных учреждений,
рекомендует к участию, не возражает против проведения.
"no" — если поддержки нет: обращения по почте не рассматриваются, нужна
интернет-приёмная, вопрос не в компетенции, перенаправлено по принадлежности,
прислано разъяснение о порядке обращения, отказ.
"unclear" — если это квитанция о регистрации, текст не читается или смысл
непонятен.
TXT;

$where = $only ? ('WHERE id IN (' . implode(',', $only) . ')') : '';
$rows  = all("SELECT id, region, title, letter_date, source_email, image_path, file_path
                FROM ministry_letters $where ORDER BY id");

/* ПРОДОЛЖАЕМ С МЕСТА ОСТАНОВКИ.
 * Разбор идёт долго и может прерваться (квота, перезапуск). Уже прочитанные
 * письма второй раз не спрашиваем: это и время, и лишний расход квоты. */
$report = [];
$done   = [];
if (is_file($out)) {
    foreach ((array) json_decode((string) file_get_contents($out), true) as $old) {
        if (!is_array($old) || !isset($old['id'])) continue;
        if (in_array((string) ($old['support'] ?? ''), ['не прочитано', ''], true)) continue;
        $done[(int) $old['id']] = $old;
    }
    if ($done) echo 'уже разобрано ранее: ' . count($done) . "\n";
}
$n = ['yes' => 0, 'no' => 0, 'unclear' => 0, 'нет документа' => 0, 'не прочитано' => 0];

foreach ($rows as $r) {
    if (isset($done[(int) $r['id']])) { $report[] = $done[(int) $r['id']]; $n[(string) $done[(int) $r['id']]['support']] = ($n[(string) $done[(int) $r['id']]['support']] ?? 0) + 1; continue; }
    $img = trim((string) $r['image_path']);
    $abs = $img !== '' ? BASE_PATH . '/public/' . ltrim($img, '/') : '';
    if ($abs === '' || !is_file($abs)) {
        $n['нет документа']++;
        $report[] = ['id' => (int) $r['id'], 'region' => (string) $r['region'],
                     'title' => (string) $r['title'], 'support' => 'нет документа'];
        printf("#%-4d %-14s %s\n", $r['id'], 'нет документа', mb_substr((string) $r['region'], 0, 34));
        continue;
    }

    $mime = chat_media_mime(strtolower((string) pathinfo($abs, PATHINFO_EXTENSION))) ?: 'image/jpeg';
    $raw  = (string) @file_get_contents($abs);
    $b64 = $raw === '' ? '' : base64_encode($raw);

    /* БЕСПЛАТНАЯ КВОТА СЧИТАЕТ ЗАПРОСЫ В МИНУТУ, А НЕ В СУТКИ.
     *
     * Первый прогон прочитал восемь писем и дальше выдал сплошное «не
     * прочитано»: полтора десятка запросов в минуту служба уже не принимает, а
     * пустой ответ выглядел как нечитаемый скан. Второй ключ не спасал — он
     * упирался в тот же потолок секундой позже. Поэтому пауза между письмами
     * заметная, а на отказ — отдых и повтор: полтораста писем всё равно
     * разбираются за четверть часа, и лучше медленно, чем впустую. */
    $ans = '';
    for ($try = 1; $try <= 3 && $b64 !== '' && $ans === ''; $try++) {
        foreach ($keys as $k) {
            $ans = chat_media_gemini_inline($k, $mime, $b64, PROMPT);
            if ($ans !== '') break;
            sleep(2);
        }
        if ($ans === '' && $try < 3) sleep(20);
    }

    $j = null;
    if ($ans !== '' && preg_match('~\{.*\}~su', $ans, $mm)) $j = json_decode($mm[0], true);

    if (!is_array($j)) {
        $n['не прочитано']++;
        $report[] = ['id' => (int) $r['id'], 'region' => (string) $r['region'],
                     'title' => (string) $r['title'], 'support' => 'не прочитано', 'raw' => mb_substr($ans, 0, 200)];
        printf("#%-4d %-14s %s\n", $r['id'], 'не прочитано', mb_substr((string) $r['region'], 0, 34));
        usleep(400000);
        continue;
    }

    $sup = (string) ($j['support'] ?? 'unclear');
    if (!isset($n[$sup])) $sup = 'unclear';
    $n[$sup]++;

    $report[] = [
        'id' => (int) $r['id'], 'region' => (string) $r['region'], 'title' => (string) $r['title'],
        'date' => (string) $r['letter_date'], 'email' => (string) $r['source_email'],
        'support' => $sup, 'org' => (string) ($j['org'] ?? ''),
        'what' => (string) ($j['what'] ?? ''), 'quote' => (string) ($j['quote'] ?? ''),
    ];
    printf("#%-4d %-14s %-34s %s\n", $r['id'], $sup, mb_substr((string) $r['region'], 0, 34),
           mb_substr((string) ($j['what'] ?? ''), 0, 90));

    sleep(5);                       // ~12 запросов в минуту — в пределах бесплатной квоты
}

file_put_contents($out, json_encode($report, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
echo "\nИТОГО: ";
foreach ($n as $k => $v) echo "$k $v; ";
echo "\nразбор: $out\n";
