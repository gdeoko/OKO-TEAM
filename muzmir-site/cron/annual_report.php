<?php
/**
 * Годовой отчёт КЦ «Музыкальный Мир» (PDF). Запуск: раз в год, 5 января.
 *
 * Определяет отчётный год (в январе — прошедший год, иначе — текущий), вызывает
 * annual_report($year) (генератор сам верстает и сохраняет PDF в public/ и
 * возвращает абсолютный путь), после чего:
 *   - кладёт письмо владельцу на cfgv('org_email') в mail_queue С ВЛОЖЕНИЕМ-PDF
 *     (5-й аргумент mail_queue — путь к файлу, реальную отправку делает воркер);
 *   - шлёт tg_notify_admin() с фактом готовности и ссылкой на PDF.
 *
 * Идемпотентно: маркер settings.annual_report_last = "<год>@<Y-m-d>". Повторный
 * запуск за тот же год в тот же день ничего не делает (не генерит PDF дважды).
 *
 * Крон-строка: 0 6 5 1 *  (5 января в 06:00).
 * Запуск вручную: php cron/annual_report.php [год]
 */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { fwrite(STDERR, "CLI only\n"); exit(1); }

define('BASE_PATH', dirname(__DIR__));
$GLOBALS['CFG'] = require BASE_PATH . '/config.php';
require_once BASE_PATH . '/core/db.php';
require_once BASE_PATH . '/core/data.php';
require_once BASE_PATH . '/core/helpers.php';
require_once BASE_PATH . '/core/mailer.php';
require_once BASE_PATH . '/core/telegram.php';
require_once BASE_PATH . '/core/report_annual.php';
require_once __DIR__ . '/_lib.php';

const JOB = 'annual_report';

try {
    if (!function_exists('scalar') || !function_exists('annual_report')) {
        cron_log(JOB, 'БД или генератор недоступны - выход');
        exit(0);
    }

    db(); // инициализация/миграции, как в public/index.php и test_report.php

    // Отчётный год: в январе формируем за прошедший год, иначе — за текущий.
    $year = ((int) date('n')) === 1 ? ((int) date('Y') - 1) : (int) date('Y');
    // Разрешаем явно указать год первым аргументом (для ручного перезапуска).
    if (isset($argv[1]) && ctype_digit((string) $argv[1])) $year = (int) $argv[1];

    // Идемпотентность: не генерим дважды за один год в один и тот же день.
    $marker = $year . '@' . date('Y-m-d');
    $already = function_exists('setting') ? (string) setting('annual_report_last', '') : '';
    if ($already === $marker) {
        cron_log(JOB, "отчёт за $year уже формировался сегодня ($marker), выход");
        exit(0);
    }

    // Генерация PDF (функция сама сохраняет файл в public/ и возвращает путь).
    $pdf = annual_report($year);
    if ($pdf === '' || !is_file($pdf)) {
        cron_log(JOB, "ОШИБКА: annual_report($year) не вернул готовый PDF");
        if (function_exists('tg_notify_admin')) {
            tg_notify_admin("Годовой отчёт за $year: ошибка формирования PDF. Проверьте data/logs и права на public/.");
        }
        exit(0);
    }
    $sizeKb = round(filesize($pdf) / 1024, 1);

    // Публичная ссылка на PDF (файл лежит в public/, доступен из корня сайта).
    $base = rtrim((string) cfgv('base_url', ''), '/');
    $url  = $base !== '' ? $base . '/' . basename($pdf) : basename($pdf);

    $subject = 'Годовой отчёт за ' . $year . ' год';
    $summary = "Годовой отчёт КЦ «Музыкальный Мир» за $year год сформирован.\n\n"
        . "Файл: " . basename($pdf) . " ($sizeKb КБ)\n"
        . "Ссылка: $url\n\n"
        . "PDF приложен к письму, отправленному на " . (string) cfgv('org_email', '(email не задан)') . ".";

    // Telegram: факт готовности + ссылка.
    if (function_exists('tg_notify_admin')) {
        tg_notify_admin($summary);
    }

    // Письмо владельцу с вложением-PDF (через очередь; воркер прикрепит файл).
    $orgEmail = (string) cfgv('org_email', '');
    if ($orgEmail !== '' && function_exists('mail_queue')) {
        $body = "Годовой отчёт о деятельности Культурного центра «Музыкальный Мир» за $year год "
            . "сформирован автоматически и приложен к настоящему письму в формате PDF.\n\n"
            . "Также отчёт доступен по ссылке: $url";
        $html = function_exists('mail_template') ? mail_template('annual_report', [
            'message'   => $body,
            'preheader' => 'Годовой отчёт за ' . $year . ' год',
        ]) : nl2br(h($body));
        // 5-й аргумент — путь к файлу вложения (см. core/mailer.php: mail_queue → mail_build_mime).
        mail_queue($orgEmail, (string) cfgv('org_name', ''), $subject, $html, $pdf);
    } else {
        cron_log(JOB, 'org_email не задан — письмо не поставлено в очередь');
    }

    // Фиксируем маркер идемпотентности только после успешной генерации.
    if (function_exists('set_setting')) set_setting('annual_report_last', $marker);
    cron_log(JOB, "отчёт за $year сформирован: $pdf ($sizeKb КБ), письмо на " . ($orgEmail ?: '—'));
} catch (\Throwable $e) {
    cron_log(JOB, 'ОШИБКА: ' . $e->getMessage());
}
