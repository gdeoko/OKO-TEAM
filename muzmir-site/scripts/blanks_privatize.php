<?php
/**
 * ЧИСТЫЕ БЛАНКИ — ИЗ ВЕБ-КОРНЯ В ЗАКРЫТЫЙ КАТАЛОГ.
 *
 * Бланк без подписи и печати печатается для типографии: по нему изготавливают
 * оригинал, который человек заказал и оплатил. Лежал он в public/diplomas/ —
 * там же, где готовые дипломы, и имя складывалось из номера диплома плюс
 * «-clean». Номер участник знает: он в письме и в кабинете. Значит, чтобы
 * скачать пустой бланк и напечатать его самому, достаточно было дописать одно
 * слово к своей же ссылке.
 *
 * Скрипт переносит такие файлы в data/clean_blanks/ (наружу не отдаётся) и
 * переписывает адреса в кэше заказов на закрытый маршрут админки.
 *
 *   php scripts/blanks_privatize.php          — показать, что найдено
 *   php scripts/blanks_privatize.php --apply  — перенести
 */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { fwrite(STDERR, "CLI only\n"); exit(1); }

define('BASE_PATH', dirname(__DIR__));
$GLOBALS['CFG'] = require BASE_PATH . '/config.php';
require_once BASE_PATH . '/core/db.php';
require_once BASE_PATH . '/core/helpers.php';
require_once BASE_PATH . '/core/orders.php';

$apply = in_array('--apply', $argv, true);
$pub   = BASE_PATH . '/public/diplomas/';
$priv  = order_clean_dir();
$line  = str_repeat('=', 74);

echo "ЧИСТЫЕ БЛАНКИ\n$line\n";
if ($apply && !is_dir($priv)) @mkdir($priv, 0770, true);

/* ── 1. Файлы ────────────────────────────────────────────────────────────── */
$files = glob($pub . '*-clean.pdf') ?: [];
printf("  бланков в веб-корне: %d\n", count($files));
$moved = 0;
foreach ($files as $f) {
    $name = basename($f);
    printf("    %s\n", $name);
    if (!$apply) continue;
    if (@rename($f, $priv . $name)) { @chmod($priv . $name, 0640); $moved++; }
    else printf("      НЕ ПЕРЕНЕСЁН (проверить права)\n");
}

/* ── 2. Адреса в заказах ─────────────────────────────────────────────────── */
$rows = all("SELECT id, clean_pdfs FROM awards_orders WHERE COALESCE(clean_pdfs,'') <> ''");
$fixed = 0;
foreach ($rows as $r) {
    $list = json_decode((string) $r['clean_pdfs'], true);
    if (!is_array($list) || !$list) continue;
    $out = []; $touched = false;
    foreach ($list as $c) {
        if (!is_array($c)) continue;
        $url  = (string) ($c['url'] ?? '');
        $name = basename(parse_url($url, PHP_URL_PATH) ?: $url);
        if (preg_match('~^[A-Za-z0-9._-]+\.pdf$~', $name)) {
            $new = order_clean_url($name);
            if ($new !== $url) { $c['url'] = $new; $touched = true; }
        }
        $out[] = $c;
    }
    if (!$touched) continue;
    printf("  заказ №%-5d адресов поправлено: %d\n", (int) $r['id'], count($out));
    if ($apply) update('awards_orders', ['clean_pdfs' => json_encode($out, JSON_UNESCAPED_UNICODE)], 'id=:id', ['id' => (int) $r['id']]);
    $fixed++;
}

echo "\n$line\n";
printf("  файлов перенесено: %d\n", $moved);
printf("  заказов поправлено: %d\n", $fixed);
echo $apply ? "\n  применено\n" : "\n  это предпросмотр: php scripts/blanks_privatize.php --apply\n";
