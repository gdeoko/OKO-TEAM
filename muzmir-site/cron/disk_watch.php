<?php
/**
 * СТОРОЖ МЕСТА НА ДИСКЕ И УБОРКА ЗА ПИСЬМАМИ.
 *
 * 14.08.2026 диск сервера кончился полностью: 38 ГБ из 38 ГБ. SQLite в такой
 * момент не может писать — заявки с сайта не сохраняются, письма не встают в
 * очередь, и снаружи это выглядит как «сайт открывается, но ничего не
 * работает». Причина оказалась простой: каждое обращение сохраняет PDF на
 * 700 КБ, рассылка по учреждениям делает тысячи писем в день, а функция
 * уборки lm_cleanup() хоть и была написана, не вызывалась ниоткуда.
 *
 * Этот сторож закрывает обе дыры: каждый день убирает отправленные документы и
 * предупреждает владельца, пока место ещё есть, а не когда оно кончилось.
 *
 * Крон (ежедневно в 04:30 МСК):
 *   30 4 * * * php /var/www/muzmir/cron/disk_watch.php
 *
 * Вручную:
 *   php cron/disk_watch.php        — убрать и показать состояние
 *   php cron/disk_watch.php dry    — только показать, ничего не удаляя
 */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { fwrite(STDERR, "CLI only\n"); exit(1); }

define('BASE_PATH', dirname(__DIR__));
$GLOBALS['CFG'] = require BASE_PATH . '/config.php';
require_once BASE_PATH . '/core/db.php';
require_once BASE_PATH . '/core/helpers.php';
require_once BASE_PATH . '/core/letter_mail.php';
require_once __DIR__ . '/_lib.php';

$dry = (($argv[1] ?? '') === 'dry');

$human = static function (float $b): string {
    foreach (['Б', 'КБ', 'МБ', 'ГБ'] as $u) {
        if ($b < 1024) return round($b, 1) . ' ' . $u;
        $b /= 1024;
    }
    return round($b, 1) . ' ТБ';
};

$total = (float) @disk_total_space(BASE_PATH);
$free  = (float) @disk_free_space(BASE_PATH);
$pct   = $total > 0 ? round($free / $total * 100) : 0;

echo 'диск: свободно ' . $human($free) . ' из ' . $human($total) . " ($pct%)\n";

/* ── Уборка ──────────────────────────────────────────────────────────────── */

if (!$dry) {
    // Когда места совсем мало, держать даже недельные PDF незачем: документ у
    // адресата, а без свободного диска не работает вообще ничего.
    $tight = $pct < 10;
    $r = lm_cleanup($tight ? 14 : 30, $tight ? 2 : 7);
    if ($r['files'] > 0) {
        $msg = 'убрано документов отправленных обращений: ' . $r['files'] . ' на ' . $human((float) $r['bytes']);
        echo $msg . "\n";
        cron_log('disk_watch', $msg);
    }
    clearstatcache();
    $free = (float) @disk_free_space(BASE_PATH);
    $pct  = $total > 0 ? round($free / $total * 100) : 0;
}

/* ── Предупреждение ──────────────────────────────────────────────────────── */

// Порог в 15% выбран не наугад: суточная порция писем по учреждениям съедает
// около двух гигабайт, и на 38-гигабайтном диске это меньше трёх дней запаса.
// Предупредить надо, пока есть время разобраться, а не в день остановки.
$warn = $pct < 15;
echo 'после уборки свободно ' . $human($free) . " ($pct%)" . ($warn ? ' — МАЛО' : '') . "\n";
cron_log('disk_watch', 'свободно ' . $human($free) . " ($pct%)");

if ($warn && !$dry) {
    $mark = 'disk_warn_' . date('Y-m-d');
    if ((string) setting($mark, '') === '') {
        set_setting($mark, '1');
        $text = "На сервере заканчивается место: свободно " . $human($free) . " ($pct%).\n\n"
              . "Когда диск кончится, сайт перестанет принимать заявки и ставить письма в "
              . "очередь, хотя страницы будут открываться как обычно.\n\n"
              . "Самое тяжёлое — документы отправленных писем: data/letters и "
              . "public/uploads/letters.";
        if (is_file(BASE_PATH . '/core/notify_owner.php')) {
            require_once BASE_PATH . '/core/notify_owner.php';
            if (function_exists('owner_tg_send')) {
                try { owner_tg_send('analytics', '<b>Мало места на диске</b>' . "\n" . h($text)); } catch (\Throwable $e) {}
            }
        }
        echo "владельцу отправлено предупреждение\n";
    }
}
