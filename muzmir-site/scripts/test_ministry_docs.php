<?php
/**
 * ПРОГОН РАЗБОРА НА НАСТОЯЩИХ ДОКУМЕНТАХ.
 *
 * Ведомство отвечает документом на бланке — PDF или DOCX, приложенным к письму,
 * а в теле стоит сопроводительная строка или автоответчик. Проверяем именно этот
 * случай: собираем документы, прикладываем их к письмам с разным телом и
 * смотрим, что разбор скажет.
 *
 * Отдельно проверяем главное правило: без документа решения нет, что бы ни было
 * написано в письме.
 *
 *   php scripts/test_ministry_docs.php
 */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { fwrite(STDERR, "CLI only\n"); exit(1); }

define('BASE_PATH', dirname(__DIR__));
$GLOBALS['CFG'] = require BASE_PATH . '/config.php';
require_once BASE_PATH . '/core/db.php';
require_once BASE_PATH . '/core/data.php';
require_once BASE_PATH . '/core/helpers.php';
require_once BASE_PATH . '/core/ministries.php';
require_once BASE_PATH . '/core/letter_texts.php';
require_once BASE_PATH . '/core/ministry_reply.php';

$tmp = '/tmp/mrep_docs';
@mkdir($tmp, 0775, true);

/** Собрать документ ведомства: HTML → PDF или DOCX через LibreOffice. */
function make_doc(string $dir, string $name, string $bodyHtml, string $to): string {
    $html = '<html><head><meta charset="utf-8"><style>'
          . 'body{font-family:"Liberation Serif",serif;font-size:13pt;line-height:1.5;margin:2cm}'
          . '.hdr{text-align:center;font-weight:bold} .req{margin:1cm 0 0}</style></head><body>'
          . '<div class="hdr">МИНИСТЕРСТВО КУЛЬТУРЫ<br>ТЮМЕНСКОЙ ОБЛАСТИ</div>'
          . '<div class="req">625004, г. Тюмень, ул. Республики, д. 24<br>'
          . 'тел. (3452) 46-60-14 · mincult@72to.ru</div>'
          . '<p>№ 01-16/3345 от 15.08.2026 &nbsp;&nbsp; На № 14082026/0007 от 14.08.2026</p>'
          . '<p style="text-align:right;white-space:pre-line">' . $to . '</p>'
          . $bodyHtml
          . '<p style="margin-top:1.5cm">Заместитель министра культуры<br>Тюменской области'
          . '&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; П. С. Ковалёв</p></body></html>';

    $src = $dir . '/src_' . $name . '.html';
    file_put_contents($src, $html);
    $ext = str_ends_with($name, '_docx') ? 'docx' : 'pdf';
    @exec('cd ' . escapeshellarg($dir) . ' && libreoffice --headless --convert-to ' . $ext
        . ' ' . escapeshellarg($src) . ' >/dev/null 2>&1');
    $out = $dir . '/src_' . $name . '.' . $ext;
    return is_file($out) ? $out : '';
}

$to = "Генеральному директору\nКультурного центра «Музыкальный Мир»\nА. И. Ильясову";

$docs = [
    'support' => ['Одобрение на бланке PDF',
        '<p>Уважаемый Альберт Ильясович!</p><p>Министерство культуры Тюменской области рассмотрело '
        . 'Ваше обращение об информационной поддержке всероссийских творческих конкурсов. Информация '
        . 'о конкурсах размещена на официальном сайте министерства и направлена в подведомственные '
        . 'учреждения культуры и дополнительного образования детей.</p>'],
    'refusal' => ['Отказ на бланке PDF',
        '<p>Уважаемый Альберт Ильясович!</p><p>Ваше обращение рассмотрено. Сообщаем, что размещение '
        . 'информации о мероприятиях сторонних организаций, участие в которых предполагает внесение '
        . 'организационного взноса, не относится к компетенции министерства. Оснований для оказания '
        . 'информационной поддержки не усматривается.</p>'],
    'fix_docx' => ['Просьба переоформить, DOCX',
        '<p>Ваше обращение направлено на имя Майер Елена Валерьевна, которая не замещает должность '
        . 'руководителя с февраля 2025 года. Для рассмотрения по существу просим переоформить '
        . 'обращение на действующего руководителя: Сидоров Александр Анатольевич.</p>'],
];

echo "СБОРКА ДОКУМЕНТОВ\n";
$files = [];
foreach ($docs as $key => [$title, $body]) {
    $p = make_doc($tmp, $key, $body, $to);
    printf("  %-26s %s\n", $title, $p !== '' ? basename($p) . ' (' . round(filesize($p) / 1024) . ' КБ)' : 'НЕ СОБРАЛСЯ');
    if ($p !== '') $files[$key] = $p;
}

$att = static fn(string $p): array => [['name' => basename($p), 'data' => (string) file_get_contents($p)]];

echo "\nРАЗБОР\n" . str_repeat('=', 78) . "\n";

$cases = [
    ['Одобрение документом, в теле сопроводиловка',
     'О рассмотрении обращения', 'Уважаемые коллеги! Направляем ответ на Ваше обращение. Приложение: на 1 л.',
     $files['support'] ?? '', 'support'],

    ['Одобрение документом, в теле АВТООТВЕТЧИК',
     'Automatic reply: Обращение', 'Здравствуйте! Ваше письмо получено. Я нахожусь в отпуске до 28 августа.',
     $files['support'] ?? '', 'support'],

    ['Отказ документом',
     'О рассмотрении обращения', 'Направляем ответ на Ваше обращение.',
     $files['refusal'] ?? '', 'refusal'],

    ['Просьба переоформить, документ DOCX',
     'О некорректном адресате', 'Во вложении.',
     $files['fix_docx'] ?? '', 'fix'],

    ['АВТООТВЕТЧИК без документа — решением НЕ является',
     'Automatic reply: Обращение', 'Ваше письмо получено, благодарим за обращение. Отвечу после отпуска.',
     '', 'receipt'],

    ['Обещание в теле без документа — решением НЕ является',
     'Ответ', 'Здравствуйте! Конечно, поддержим и разместим анонс у себя на сайте. С уважением, пресс-служба.',
     '', 'receipt'],
];

$ok = 0;
foreach ($cases as [$name, $subj, $body, $file, $want]) {
    $a = $file !== '' ? $att($file) : [];
    $c = mrep_classify($subj, $body, $a);
    $good = $c['verdict'] === $want;
    $ok += $good ? 1 : 0;
    printf("%s %s\n   ожидали %-8s получили %-8s (%s)\n   %s\n",
        $good ? '[ok]' : '[!!]', $name, $want, $c['verdict'], $c['by'], $c['reason'] ?: '—');
    if (($c['fio'] ?? '') !== '') echo "   верный адресат: " . $c['fio'] . "\n";
    echo "\n";
}
printf("%s\nИТОГ: %d из %d\n", str_repeat('=', 78), $ok, count($cases));
