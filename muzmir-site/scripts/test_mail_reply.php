<?php
/**
 * КУДА ПРИДЁТ ОТВЕТ НА НАШЕ ПИСЬМО — ПРОВЕРКА ПО-НАСТОЯЩЕМУ.
 *
 * Владелец задал правило: партнёрка отвечает на novosti@, своя база на news@,
 * ведомства на kc@, награды на nagradi@. Проверять это по коду мало: массовые
 * письма уходят не по SMTP, а через HTTP API сервиса рассылок, и заголовок
 * обратного адреса там задаётся отдельным полем. Поэтому здесь письмо реально
 * отправляется на НАШ ЖЕ ящик и потом вычитывается по IMAP — смотрим, что стоит
 * в Reply-To у доставленного письма.
 *
 * Отправляем только на собственные ящики центра, посторонним ничего не уходит.
 *
 *   php scripts/test_mail_reply.php            — только правила, без отправки
 *   php scripts/test_mail_reply.php --send     — с реальной отправкой и чтением
 */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { fwrite(STDERR, "CLI only\n"); exit(1); }

define('BASE_PATH', dirname(__DIR__));
$GLOBALS['CFG'] = require BASE_PATH . '/config.php';
require_once BASE_PATH . '/core/db.php';
require_once BASE_PATH . '/core/helpers.php';
require_once BASE_PATH . '/core/mailer.php';
require_once BASE_PATH . '/core/letter_texts.php';
require_once BASE_PATH . '/core/imap_read.php';

$line = str_repeat('=', 78);
$fail = 0;
$send = in_array('--send', $argv, true);

/* ── 1. Правило «какой ящик кому» ─────────────────────────────────────────── */
echo "ЯЩИК ДЛЯ ОТВЕТА ПО ТИПУ ПИСЬМА\n$line\n";
// В заголовке письма домен обязан быть латиницей (punycode) — кириллица там
// превращается в мусор, и ответить на письмо невозможно.
$rules = [
    'cold'     => ['партнёрка и учреждения',  'novosti@музыкальный-мир.рф'],
    'bulk'     => ['своя база участников',    'news@музыкальный-мир.рф'],
    'official' => ['ведомства и министерства','kc@музыкальный-мир.рф'],
    'awards'   => ['награды и заказы',        'nagradi.on@музыкальный-мир.рф'],
];
foreach ($rules as $pool => [$what, $wantRu]) {
    $want = mail_addr_ascii($wantRu);
    $got = mail_reply_box($pool);
    $good = $got === $want;
    if (!$good) $fail++;
    printf("  %s %-26s %s\n", $good ? '✓' : '✗', $what, $good ? $got : "$got вместо $want");
}

/* ── 2. Текст письма называет тот же адрес, что и заголовок ───────────────── */
echo "\nАДРЕС В ТЕКСТЕ ПИСЬМА СОВПАДАЕТ С ЗАГОЛОВКОМ\n$line\n";
$pairs = ['partner' => 'cold', 'institution' => 'cold', 'base' => 'bulk',
          'ministry' => 'official', 'awards' => 'awards'];
foreach ($pairs as $kind => $pool) {
    $inText = ol_box_email($kind);                 // в тексте письма — по-русски
    $inHead = mail_reply_box($pool);               // в заголовке — punycode
    $good = mail_addr_ascii($inText) === $inHead;
    if (!$good) $fail++;
    printf("  %s %-14s текст: %-30s заголовок: %s\n", $good ? '✓' : '✗', $kind, $inText, $inHead);
}

/* ── 3. Живая отправка и чтение доставленного письма ──────────────────────── */
if (!$send) {
    echo "\n(живая отправка не запускалась — добавьте --send)\n";
} else {
    echo "\nЖИВАЯ ПРОВЕРКА: ОТПРАВЛЯЕМ СЕБЕ И ЧИТАЕМ ЗАГОЛОВОК\n$line\n";
    // Пишем на собственный ящик центра — наружу не уходит ничего.
    $to  = 'kc@' . 'xn----7sbugdeiegh1b0a9hen.xn--p1ai';
    $tag = 'reply-check-' . bin2hex(random_bytes(4));
    foreach (['cold', 'bulk'] as $pool) {
        $subj = 'Проверка обратного адреса [' . $pool . '] ' . $tag;
        $ok = mail_send_failover($to, $subj,
            '<p>Служебное письмо проверки. Отвечать не нужно.</p>', ['pool' => $pool]);
        printf("  %s отправлено письмо пула «%s» %s\n", $ok ? '✓' : '✗', $pool,
            $ok ? '' : ('— ' . mail_last_error()));
        if (!$ok) $fail++;
    }

    echo "  ждём доставку";
    // Смотрим и «Спам»: свои же массовые письма Яндекс кладёт туда регулярно.
    $acc = mail_account_by_name('kc');
    $acc['host'] = 'imap.yandex.ru'; $acc['port'] = 993;
    $found = [];
    for ($i = 0; $i < 18 && count($found) < 2; $i++) {
        sleep(10); echo '.';
        foreach (['INBOX', 'Spam'] as $folder) {
            foreach (im_search($acc, 'SUBJECT "' . $tag . '"', $folder) as $id) {
                $raw = im_fetch($acc, (int) $id, $folder);
                if (trim($raw) === '') continue;
                $head = explode("\r\n\r\n", $raw, 2)[0];
                $subj = preg_match('~^Subject:\s*(.+)$~mi', $head, $m) ? im_decode_header(trim($m[1])) : '';
                $pool = preg_match('~\[(cold|bulk)\]~u', $subj, $m2) ? $m2[1] : '?';
                $rt   = preg_match('~^Reply-To:\s*(.+)$~mi', $head, $m3) ? trim($m3[1]) : '';
                if ($pool !== '?') $found[$pool] = ['reply' => $rt, 'where' => $folder];
            }
        }
    }
    echo "\n";
    foreach (['cold' => 'novosti', 'bulk' => 'news'] as $pool => $box) {
        $rt = $found[$pool]['reply'] ?? '';
        $good = $rt !== '' && mb_stripos($rt, $box . '@') !== false
                && mb_stripos($rt, 'xn--') !== false;   // домен обязан быть в punycode
        if (!$good) $fail++;
        printf("  %s письмо пула «%s»: обратный адрес %s%s\n", $good ? '✓' : '✗', $pool,
            $rt !== '' ? $rt : 'письмо не найдено в ящике',
            isset($found[$pool]) && $found[$pool]['where'] === 'Spam' ? '  [письмо попало в спам]' : '');
    }
}

echo "\n$line\n" . ($fail === 0 ? "Обратный адрес расставлен по правилу владельца.\n" : "ПРОБЛЕМ: $fail\n");
exit($fail === 0 ? 0 : 1);
