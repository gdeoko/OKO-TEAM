<?php
/**
 * chat_lessons_from_cancelled.php — уроки из ответов, которые владелец СНЯЛ.
 *
 * ЗАЧЕМ. Когда владелец видит, что бот собрался ответить не то, он перехватывает
 * диалог: ответ бота снимается (role='bot_cancelled', core/chat_ops.php), и
 * человек пишет своё. Это самый ценный материал для обучения — готовая пара
 * «так бот хотел ответить» и «так надо», причём на один и тот же вопрос. До сих
 * пор она пропадала: снятая строка просто лежала в истории, а chat_lessons
 * заполнялся только при правке текста в админке.
 *
 * ЧТО ДЕЛАЕТ. Для каждой снятой реплики ищет вопрос участника перед ней и
 * ближайший ответ человека после неё, и записывает урок. Повторно один и тот же
 * случай не заводит.
 *
 * Запуск: php scripts/chat_lessons_from_cancelled.php --dry
 *         php scripts/chat_lessons_from_cancelled.php --apply [--days=40]
 */
declare(strict_types=1);
define('BASE_PATH', '/var/www/muzmir');
$GLOBALS['CFG'] = require BASE_PATH . '/config.php';
require_once BASE_PATH . '/core/db.php';
require_once BASE_PATH . '/core/data.php';
require_once BASE_PATH . '/core/helpers.php';
require_once BASE_PATH . '/core/chat_learn.php';

$apply = in_array('--apply', $argv, true);
$days  = 40;
foreach ($argv as $a) if (preg_match('~^--days=(\d+)$~', $a, $m)) $days = max(1, (int) $m[1]);
if (!$apply && !in_array('--dry', $argv, true)) { fwrite(STDERR, "укажи --dry или --apply\n"); exit(2); }

chat_learn_migrate();

$rows = all("SELECT id, session_key, text, created_at FROM chat_messages
              WHERE role='bot_cancelled' AND LENGTH(text) > 40
                AND created_at >= datetime('now','localtime', ?)
           ORDER BY id", ['-' . $days . ' days']);
echo "снятых ответов бота за $days дн.: " . count($rows) . "\n\n";

$made = 0; $skip = 0; $sameGood = [];
foreach ($rows as $r) {
    $id  = (int) $r['id'];
    $ses = (string) $r['session_key'];
    $bad = trim((string) $r['text']);

    $q = trim((string) (scalar(
        "SELECT text FROM chat_messages
          WHERE session_key=? AND role='user' AND id < ? AND TRIM(text) <> ''
       ORDER BY id DESC LIMIT 1", [$ses, $id]) ?: ''));

    // Ответ человека, пришедший ВЗАМЕН снятого: ближайший операторский после него.
    $good = trim((string) (scalar(
        "SELECT text FROM chat_messages
          WHERE session_key=? AND id > ? AND by_operator=1 AND role='assistant'
            AND LENGTH(text) > 30
       ORDER BY id ASC LIMIT 1", [$ses, $id]) ?: ''));

    if ($q === '' || $good === '') { $skip++; continue; }
    // Если человек написал то же самое — учиться нечему, ответ сняли по другой причине.
    if (mb_substr(mb_strtolower($bad), 0, 60) === mb_substr(mb_strtolower($good), 0, 60)) { $skip++; continue; }

    $dup = (int) (scalar("SELECT COUNT(*) FROM chat_lessons WHERE question=? AND good=?", [$q, $good]) ?? 0);
    if ($dup > 0) { $skip++; continue; }

    /* ОДИН ПРАВИЛЬНЫЙ ОТВЕТ — НЕ БОЛЬШЕ ДВУХ УРОКОВ.
     * Владелец перехватывает диалог подряд: участник переспрашивает, и один и тот
     * же канон уходит пять раз. Пять одинаковых уроков вытеснят из подсказки все
     * остальные — модель увидит только их и станет отвечать этим текстом на что
     * угодно. Два примера показывают правило, пять его ломают. */
    $key = mb_substr(mb_strtolower(preg_replace('~\s+~u', ' ', $good) ?? ''), 0, 80);
    $sameGood[$key] = ($sameGood[$key] ?? 0) + 1;
    if ($sameGood[$key] > 2) { $skip++; continue; }

    printf("— %s [%s]\n  В: %s\n  бот (снято): %s\n  владелец: %s\n\n",
        (string) $r['created_at'], $ses,
        mb_substr(preg_replace('~\s+~u', ' ', $q) ?? '', 0, 110),
        mb_substr(preg_replace('~\s+~u', ' ', $bad) ?? '', 0, 150),
        mb_substr(preg_replace('~\s+~u', ' ', $good) ?? '', 0, 200));

    if ($apply) {
        try {
            q("INSERT INTO chat_lessons (question, bad, good, session_key, created_at)
               VALUES (?,?,?,?, datetime('now','localtime'))", [$q, $bad, $good, $ses]);
            $made++;
        } catch (\Throwable $e) { echo "  не записался: " . $e->getMessage() . "\n"; }
    } else {
        $made++;
    }
}

echo ($apply ? "записано уроков: $made" : "будет записано уроков: $made") . ", пропущено: $skip\n";
if ($apply) echo "всего в chat_lessons: " . scalar("SELECT COUNT(*) FROM chat_lessons") . "\n";
