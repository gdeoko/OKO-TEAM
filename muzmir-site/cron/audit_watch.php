<?php
/**
 * ЕЖЕДНЕВНЫЙ САМОКОНТРОЛЬ: АУДИТЫ ГОНЯЮТСЯ САМИ И ЗОВУТ ВЛАДЕЛЬЦА.
 *
 * Проверки в scripts/audit_awards.php и scripts/audit_system.php написаны по
 * живым поломкам августа 2026 — но запускались руками, то есть ровно тогда,
 * когда владелец уже заметил неладное и спросил. Все находки этой недели
 * (лишние бланки у медалей, потерянная оплата, возвраты кассы, заказы без
 * индекса, именной диплом у солиста) существовали днями, потому что спросить
 * систему было некому.
 *
 * Здесь они гоняются сами раз в сутки. Молчание — норма: сообщение уходит
 * ТОЛЬКО когда есть находки, иначе владелец перестанет читать отчёты через
 * неделю. В сообщении — сами строки находок, а не «обнаружено 7 проблем»:
 * по строке видно, надо ли бросать дела.
 *
 * Строка расписания (CRON_TZ=Europe/Moscow):
 *   35 9 * * * php /var/www/muzmir/cron/audit_watch.php >> data/logs/cron.log 2>&1
 */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { fwrite(STDERR, "CLI only\n"); exit(1); }

define('BASE_PATH', dirname(__DIR__));
$GLOBALS['CFG'] = require BASE_PATH . '/config.php';
require_once BASE_PATH . '/core/db.php';
require_once BASE_PATH . '/core/helpers.php';
foreach (['mailer', 'telegram'] as $svc) {
    $f = BASE_PATH . '/core/' . $svc . '.php';
    if (is_file($f)) require_once $f;
}
require_once __DIR__ . '/_lib.php';

const JOB = 'audit_watch';

if (!cron_lock(JOB, 3600)) { cron_log(JOB, 'предыдущий заход ещё идёт'); exit(0); }

/**
 * Запустить один аудит и разобрать его вывод.
 *
 * Аудиты печатают отчёт человеку: заголовки разделов, строки находок и «чисто»
 * там, где всё в порядке. Нам нужны только находки, поэтому берём строки
 * последнего заголовка, под которым что-то нашлось.
 *
 * @return array{count:int, lines:string[]}
 */
$run = static function (string $script): array {
    $php = (defined('PHP_BINARY') && PHP_BINARY !== '') ? PHP_BINARY : 'php';
    $cmd = escapeshellcmd($php) . ' ' . escapeshellarg(BASE_PATH . '/scripts/' . $script) . ' 2>&1';
    $out = (string) shell_exec($cmd);
    $count = 0;
    if (preg_match('~ИТОГ: проблем найдено — (\d+)~u', $out, $m)) $count = (int) $m[1];

    $lines = [];
    $section = '';
    $pending = '';
    foreach (preg_split('~\R~u', $out) ?: [] as $ln) {
        if (preg_match('~^\d+\.\s+\S~u', $ln)) { $pending = trim($ln); continue; }
        if (trim($ln) === '' || str_starts_with($ln, '=')) continue;
        // Строка находки — с отступом и без слова «чисто».
        if (!str_starts_with($ln, '  ')) continue;
        $t = trim($ln);
        if ($t === '' || str_starts_with($t, 'чисто') || str_starts_with($t, 'пропущено')
            || str_starts_with($t, 'ключи ')) continue;
        if ($pending !== '' && $pending !== $section) { $section = $pending; $lines[] = '• ' . $section; }
        $lines[] = '   ' . $t;
    }
    return ['count' => $count, 'lines' => $lines];
};

try {
    $awards = $run('audit_awards.php');
    $system = $run('audit_system.php');
    $total  = $awards['count'] + $system['count'];

    cron_log(JOB, sprintf('заказы: %d, система: %d', $awards['count'], $system['count']));

    if ($total === 0) {
        cron_log(JOB, 'чисто — владельцу не пишем');
        cron_unlock(JOB);
        exit(0);
    }

    /* Пишем не каждый день об одном и том же. Пока набор находок не изменился,
     * повторное сообщение — шум: владелец уже знает и, возможно, решает вопрос.
     * Изменился состав — сообщаем снова. */
    $lines = array_merge(
        $awards['lines'] ? array_merge(['ЗАКАЗЫ НАГРАД:'], $awards['lines']) : [],
        $system['lines'] ? array_merge(['СИСТЕМА:'], $system['lines']) : []
    );
    $body = implode("\n", $lines);
    $sig  = md5($body);
    if ((string) setting('audit_watch_sig', '') === $sig
        && (string) setting('audit_watch_date', '') === date('Y-m-d', strtotime('-1 day'))) {
        // Тот же набор, что и вчера — молчим, но отметку двигаем.
        set_setting('audit_watch_date', date('Y-m-d'));
        cron_log(JOB, 'находки те же, что вчера — повтор не отправляем');
        cron_unlock(JOB);
        exit(0);
    }
    set_setting('audit_watch_sig', $sig);
    set_setting('audit_watch_date', date('Y-m-d'));

    // Телеграм режет длинные сообщения — отправляем первые находки, остальное в логе.
    $short = mb_substr($body, 0, 3200);
    if (mb_strlen($body) > 3200) $short .= "\n… далее в журнале: data/logs/cron.log";

    $tail = ($total % 10 === 1 && $total % 100 !== 11) ? 'проблему'
          : ((in_array($total % 10, [2, 3, 4], true) && !in_array($total % 100, [12, 13, 14], true)) ? 'проблемы' : 'проблем');
    $msg = 'Самопроверка нашла ' . $total . ' ' . $tail . ":\n\n" . $short;
    if (function_exists('tg_notify_admin')) {
        try { tg_notify_admin($msg); } catch (\Throwable $e) { cron_log(JOB, 'телеграм: ' . $e->getMessage()); }
    }
    cron_log(JOB, "найдено $total — владельцу отправлено");
} catch (\Throwable $e) {
    cron_log(JOB, 'ОШИБКА: ' . $e->getMessage());
} finally {
    cron_unlock(JOB);
}
