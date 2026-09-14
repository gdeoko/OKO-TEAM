<?php
/**
 * ЧТО НА САМОМ ДЕЛЕ НАПИСАНО В ПИСЬМАХ ГАЛЕРЕИ ПОДДЕРЖКИ.
 *
 * Галерея /ministry-support показывает письма ведомств как подтверждение
 * информационной поддержки. Наполняется она автоматически: cron/ministry_replies.php
 * публикует ответ, если тот не распознан как ОТКАЗ. Этого мало. «Обращения,
 * поступившие на электронную почту, не рассматриваются» — не отказ по формальным
 * признакам, но и не поддержка; квитанция о регистрации — тоже. Такие письма
 * оказывались в витрине наравне с настоящими.
 *
 * Здесь каждое письмо читается ПО ДОКУМЕНТУ, а не по статусу в базе:
 *   • есть исходный PDF — pdftotext (в бланках ведомств текстовый слой почти всегда);
 *   • только картинка — tesseract -l rus;
 *   • ничего нет — документа нет вовсе, показывать нечего.
 *
 * Дальше текст проверяется на язык поддержки («поддерживаем», «окажем
 * информационную поддержку», «разместим информацию», «не возражаем») и на язык
 * отказа/пустого ответа («не рассматриваются», «через интернет-приёмную»,
 * «не имеем возможности», «направляем разъяснения»).
 *
 *   php scripts/ministry_letters_audit.php            — отчёт, ничего не меняет
 *   php scripts/ministry_letters_audit.php --json=ФАЙЛ — ещё и выгрузка разбора
 *
 * Скрипт НИЧЕГО НЕ УДАЛЯЕТ. Удаление — отдельным решением владельца.
 */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { fwrite(STDERR, "CLI only\n"); exit(1); }

define('BASE_PATH', dirname(__DIR__));
$GLOBALS['CFG'] = require BASE_PATH . '/config.php';
require_once BASE_PATH . '/core/db.php';
require_once BASE_PATH . '/core/helpers.php';

$jsonOut = '';
foreach (array_slice($argv, 1) as $a) if (preg_match('~^--json=(.+)$~', $a, $m)) $jsonOut = $m[1];

/** Слова настоящей поддержки. Достаточно одного совпадения. */
const YES = [
    'информационн\w* поддержк',
    'окаж\w+ (?:вам )?(?:информационн\w+ )?поддержк',
    'поддерж\w+ (?:проведени|конкурс|фестивал)',
    'не возража\w+',
    'размест\w+ (?:информаци|анонс)',
    'довед\w+ (?:информаци|до сведени)',
    'направл\w+ (?:информаци\w+ )?(?:в|для) (?:подведомственн|образовательн|учрежден)',
    'рекоменд\w+ (?:к участию|принять участие|учреждени)',
    'проинформир\w+',
    'согласн\w+ оказать',
];

/** Слова, которые прямо означают «поддержки нет». */
const NO = [
    'не рассматрива\w+',
    'интернет-приёмн|интернет-приемн',
    '547-ФЗ|59-ФЗ',
    'не имеет возможност|не имеем возможност',
    'не относится к (?:компетенц|полномоч)',
    'отказ\w+ в (?:поддержк|рассмотрен)',
    'оставлено без рассмотрени',
    'перенаправлен\w+ по принадлежност',
];

/** Текст документа. Возвращает [текст, чем прочитали]. */
function mla_text(array $r): array {
    $file = trim((string) ($r['file_path'] ?? ''));
    $img  = trim((string) ($r['image_path'] ?? ''));

    if ($file !== '') {
        $abs = BASE_PATH . '/public/' . ltrim($file, '/');
        if (is_file($abs) && strtolower((string) pathinfo($abs, PATHINFO_EXTENSION)) === 'pdf') {
            $out = [];
            @exec('pdftotext -layout ' . escapeshellarg($abs) . ' - 2>/dev/null', $out);
            $t = trim(implode("\n", $out));
            // Скан без текстового слоя отдаёт пустоту — тогда распознаём картинку.
            if (mb_strlen($t) >= 120) return [$t, 'pdftotext'];
        }
    }

    if ($img !== '') {
        $abs = BASE_PATH . '/public/' . ltrim($img, '/');
        if (is_file($abs)) {
            $tmp = sys_get_temp_dir() . '/mla_' . getmypid();
            @exec('tesseract ' . escapeshellarg($abs) . ' ' . escapeshellarg($tmp)
                  . ' -l rus --psm 6 2>/dev/null');
            $t = is_file($tmp . '.txt') ? (string) file_get_contents($tmp . '.txt') : '';
            @unlink($tmp . '.txt');
            $t = trim($t);
            if ($t !== '') return [$t, 'tesseract'];
        }
    }

    return ['', 'нет документа'];
}

/** Ищем образцы в тексте, возвращаем найденные. */
function mla_hits(string $text, array $patterns): array {
    $low = mb_strtolower($text);
    $out = [];
    foreach ($patterns as $p) if (preg_match('~' . $p . '~ui', $low, $m)) $out[] = $m[0];
    return $out;
}

$rows = all("SELECT id, region, title, letter_date, source_email, image_path, file_path
               FROM ministry_letters ORDER BY id");

$report = [];
$n = ['поддержка' => 0, 'отказ' => 0, 'неясно' => 0, 'нет документа' => 0];

foreach ($rows as $r) {
    [$text, $how] = mla_text($r);
    $yes = mla_hits($text, YES);
    $no  = mla_hits($text, NO);

    if ($text === '')                 $verdict = 'нет документа';
    elseif ($no && !$yes)             $verdict = 'отказ';
    elseif ($yes)                     $verdict = 'поддержка';
    else                              $verdict = 'неясно';
    $n[$verdict]++;

    $report[] = [
        'id' => (int) $r['id'], 'region' => (string) $r['region'], 'title' => (string) $r['title'],
        'date' => (string) $r['letter_date'], 'email' => (string) $r['source_email'],
        'how' => $how, 'verdict' => $verdict,
        'yes' => $yes, 'no' => $no,
        'len' => mb_strlen($text),
        'text' => mb_substr(preg_replace('~\s+~u', ' ', $text) ?? '', 0, 600),
    ];

    printf("#%-4d %-11s %-7s %-30s %s\n", $r['id'], $verdict, $how,
           mb_substr((string) $r['region'], 0, 30),
           $yes ? ('нашлось: ' . implode(', ', array_slice($yes, 0, 2)))
                : ($no ? ('против: ' . implode(', ', array_slice($no, 0, 2))) : ''));
}

echo "\nИТОГО: ";
foreach ($n as $k => $v) echo "$k $v; ";
echo "\n";

if ($jsonOut !== '') {
    file_put_contents($jsonOut, json_encode($report, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
    echo "разбор выгружен: $jsonOut\n";
}
