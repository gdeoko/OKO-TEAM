<?php
/**
 * ПРОВЕРКА ЗАПРЕТА НА ДОСРОЧНОЕ РАЗГЛАШЕНИЕ РЕЗУЛЬТАТОВ В ЧАТЕ.
 *
 * Берёт РЕАЛЬНЫЕ заявки из базы и показывает, что чат-бот увидит и что скажет:
 * попадает ли оценка в подсказку модели, что стоит в строке «ЧТО ОТВЕЧАТЬ»,
 * и сработает ли сторож, если модель всё-таки назовёт звание.
 *
 *   php scripts/test_chat_gate.php
 */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { fwrite(STDERR, "CLI only\n"); exit(1); }

define('BASE_PATH', dirname(__DIR__));
$GLOBALS['CFG'] = require BASE_PATH . '/config.php';
require_once BASE_PATH . '/core/db.php';
require_once BASE_PATH . '/core/helpers.php';
require_once BASE_PATH . '/core/chat_gate.php';
require_once BASE_PATH . '/core/chat_brain.php';

$fail = 0;
$line = str_repeat('=', 78);

/* ── 1. По одной заявке каждого вида ───────────────────────────────────────── */
echo "ЧТО БОТ СКАЖЕТ ПО РЕАЛЬНЫМ ЗАЯВКАМ\n$line\n";

$cases = [
    'длинный конкурс, оценка есть, итоги НЕ опубликованы' =>
        "SELECT a.*, c.name comp_name, c.is_paid comp_paid, c.results_mode comp_results_mode,
                c.results_date comp_results_date, c.results_published_at comp_results_pub
           FROM applications a JOIN competitions c ON c.id=a.competition_id
          WHERE COALESCE(c.results_mode,'')='list' AND COALESCE(c.results_published_at,'')=''
            AND COALESCE(a.result,'')<>'' LIMIT 1",
    'длинный конкурс, оценки ещё нет' =>
        "SELECT a.*, c.name comp_name, c.is_paid comp_paid, c.results_mode comp_results_mode,
                c.results_date comp_results_date, c.results_published_at comp_results_pub
           FROM applications a JOIN competitions c ON c.id=a.competition_id
          WHERE COALESCE(c.results_mode,'')='list' AND COALESCE(a.result,'')=''
            AND COALESCE(a.status,'')<>'rejected' LIMIT 1",
    'короткий конкурс, результат УЖЕ отправлен' =>
        "SELECT a.*, c.name comp_name, c.is_paid comp_paid, c.results_mode comp_results_mode,
                c.results_date comp_results_date, c.results_published_at comp_results_pub
           FROM applications a JOIN competitions c ON c.id=a.competition_id
          WHERE COALESCE(c.results_mode,'email')<>'list' AND COALESCE(a.result_sent_at,'')<>'' LIMIT 1",
    'короткий конкурс, оценка есть, письмо ещё НЕ ушло' =>
        "SELECT a.*, c.name comp_name, c.is_paid comp_paid, c.results_mode comp_results_mode,
                c.results_date comp_results_date, c.results_published_at comp_results_pub
           FROM applications a JOIN competitions c ON c.id=a.competition_id
          WHERE COALESCE(c.results_mode,'email')<>'list' AND COALESCE(a.result,'')<>''
            AND COALESCE(a.result_sent_at,'')='' LIMIT 1",
    'короткий конкурс, на аттестации (очередь)' =>
        "SELECT a.*, c.name comp_name, c.is_paid comp_paid, c.results_mode comp_results_mode,
                c.results_date comp_results_date, c.results_published_at comp_results_pub
           FROM applications a JOIN competitions c ON c.id=a.competition_id
          WHERE COALESCE(c.results_mode,'email')<>'list' AND COALESCE(a.result,'')=''
            AND COALESCE(a.status,'')<>'rejected' LIMIT 1",
];

foreach ($cases as $title => $sql) {
    $a = one($sql);
    echo "\n· $title\n";
    if (!$a) { echo "  (таких заявок в базе нет)\n"; continue; }
    $g = chat_gate_app($a);
    echo "  заявка №" . $a['number'] . ' «' . $a['comp_name'] . "»\n";
    echo "  в базе стоит: " . (trim((string) $a['result']) !== '' ? $a['result'] : '— оценки нет —') . "\n";
    echo "  можно назвать результат: " . ($g['may_result'] ? 'ДА' : 'НЕТ') . "\n";
    echo "  можно дать диплом:       " . ($g['may_diploma'] ? 'ДА' : 'НЕТ') . "\n";
    echo "  ЧТО ОТВЕЧАТЬ: " . $g['say'] . "\n";

    // Оценка не должна попасть в подсказку модели, если раскрывать её нельзя.
    $ctx = _chat_apps_lines([$a]);
    $res = trim((string) $a['result']);
    if (!$g['may_result'] && $res !== '' && mb_stripos($ctx, $res) !== false) {
        echo "  ✗ ПРОВАЛ: оценка попала в подсказку модели\n"; $fail++;
    } elseif ($res !== '' || $g['may_result']) {
        echo "  ✓ подсказка модели чистая\n";
    }
}

/* ── 2. Сторож: модель всё-таки назвала звание ─────────────────────────────── */
echo "\n$line\nСТОРОЖ ОТВЕТА (модель нарушила запрет)\n$line\n";

$a = one("SELECT a.*, c.name comp_name, c.is_paid comp_paid, c.results_mode comp_results_mode,
                 c.results_date comp_results_date, c.results_published_at comp_results_pub
            FROM applications a JOIN competitions c ON c.id=a.competition_id
           WHERE COALESCE(c.results_mode,'')='list' AND COALESCE(c.results_published_at,'')=''
             AND COALESCE(a.result,'')<>'' LIMIT 1");

if (!$a) {
    echo "(нет скрытых оценок — проверять нечего)\n";
} else {
    $g = chat_gate_app($a);
    $probes = [
        'дословная оценка'        => 'Поздравляю! Ваш аттестационный результат — ' . $a['result'] . '. Диплом придёт на почту.',
        'звание другими словами'  => 'Вы получили Лауреата первой степени, поздравляем!',
        'ссылка на диплом'        => 'Ваш диплом уже готов: https://музыкальный-мир.рф/diploma/VR-2026-00001.pdf',
        'честный ответ (не трогать)' => 'Оглашение аттестационных результатов состоится 28 августа 2026 года на официальной странице сообщества ВКонтакте и на сайте в разделе «Результаты».',
        'общий рассказ о шкале (не трогать)' => 'Шкала десятибалльная: 9-10 Гран-при, 8-9 Лауреат I степени и так далее. Это общие правила аттестации.',
    ];
    foreach ($probes as $name => $text) {
        $out = chat_gate_guard($text, [$g]);
        $blocked = $out !== $text;
        $mustBlock = !str_contains($name, 'не трогать');
        $ok = $blocked === $mustBlock;
        if (!$ok) $fail++;
        echo "\n· $name — " . ($ok ? '✓' : '✗ ПРОВАЛ') . ' (' . ($blocked ? 'подменено' : 'пропущено') . ")\n";
        echo "  было:  " . mb_substr($text, 0, 110) . "\n";
        if ($blocked) echo "  стало: " . mb_substr($out, 0, 220) . "\n";
    }
}

/* ── 3. Терминология: «победители» из ответов должны уйти ──────────────────── */
echo "\n$line\nТЕРМИНОЛОГИЯ\n$line\n";
$prompt = function_exists('chat_gate_rules') ? chat_gate_rules() : '';
foreach (['аттестационные результаты', 'списки победителей'] as $w) {
    $has = mb_stripos($prompt, $w) !== false;
    echo ($has ? '✓' : '✗') . ' в правилах упомянуто «' . $w . "»\n";
    if (!$has) $fail++;
}

echo "\n$line\n" . ($fail === 0 ? "ВСЁ СОШЛОСЬ.\n" : "ПРОВАЛОВ: $fail\n");
exit($fail === 0 ? 0 : 1);
