<?php
/**
 * ДОБРАТЬ ТЕКСТ ИЗ УЖЕ СОХРАНЁННЫХ ВЛОЖЕНИЙ.
 *
 * Файлы писем лежат на диске с первого дня, а колонка attach_text появилась
 * позже — и заполнялась только у новых писем. Из-за этого ответы Мордовии и
 * Калининграда, где весь смысл в PDF на бланке, а тело письма пустое, лежали в
 * разборе как «непонятно» и ждали человека, хотя оба — согласие.
 *
 * Здесь текст вынимается из уже лежащих на диске PDF и вписывается в письмо.
 * Ничего не пересылается и не перечитывается по IMAP: работаем с тем, что есть.
 *
 *   php scripts/fill_attach_text.php --dry
 *   php scripts/fill_attach_text.php
 */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { fwrite(STDERR, "CLI only\n"); exit(1); }

define('BASE_PATH', dirname(__DIR__));
$GLOBALS['CFG'] = require BASE_PATH . '/config.php';
require_once BASE_PATH . '/core/db.php';
require_once BASE_PATH . '/core/helpers.php';
require_once BASE_PATH . '/core/inbox_reader.php';

$dry  = in_array('--dry', $argv, true);
$line = str_repeat('=', 78);

echo "ТЕКСТ ИЗ ВЛОЖЕНИЙ\n$line\n";

$rows = all("SELECT id, attachments FROM inbox_messages
              WHERE COALESCE(attach_text,'') = ''
                AND COALESCE(attachments,'') LIKE '%\"file\"%'
              ORDER BY id DESC LIMIT 500");
printf("  писем с вложениями без текста: %d\n\n", count($rows));

$done = $empty = 0;
foreach ($rows as $r) {
    $text = '';
    foreach (json_decode((string) $r['attachments'], true) ?: [] as $a) {
        $rel = (string) ($a['file'] ?? '');
        if ($rel === '' || !preg_match('~\.pdf$~i', $rel)) continue;
        $abs = BASE_PATH . '/' . $rel;
        if (!is_file($abs)) continue;
        $text .= "\n" . inbox_pdf_text($abs);
    }
    $text = trim($text);
    if ($text === '') { $empty++; continue; }        // скан без текстового слоя — читает человек
    printf("  #%-5d %d символов: %s\n", (int) $r['id'], mb_strlen($text),
        mb_substr(preg_replace('~\s+~u', ' ', $text), 0, 70));
    if (!$dry) q("UPDATE inbox_messages SET attach_text=? WHERE id=?", [$text, (int) $r['id']]);
    $done++;
}

printf("\n$line\n  добрано: %d, без текстового слоя: %d\n", $done, $empty);
if ($dry) echo "  сухой прогон: ничего не изменено\n";
