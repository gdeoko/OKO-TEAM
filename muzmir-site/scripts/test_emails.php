<?php
/** Рендер всех шаблонов писем в HTML-файлы для визуальной проверки (Playwright). */
declare(strict_types=1);
define('BASE_PATH', dirname(__DIR__));
$GLOBALS['CFG'] = require BASE_PATH . '/config.php';
require_once BASE_PATH . '/core/db.php';
require_once BASE_PATH . '/core/helpers.php';
require_once BASE_PATH . '/core/mailer.php';

$outDir = $argv[1] ?? sys_get_temp_dir() . '/muzmir_emails';
if (!is_dir($outDir)) mkdir($outDir, 0775, true);

$cases = [
    'application_confirm' => [
        'name' => 'Анастасия', 'competition' => 'Симфония Звёзд', 'number' => 'SZ-2026-004242',
        'nomination' => 'Вокальное искусство — Эстрадный вокал', 'work_title' => 'Осенний вальс',
        'cabinet_url' => 'https://xn----7sbugdeiegh1b0a9hen.xn--p1ai/cabinet',
        'preheader' => 'Ваша заявка на конкурс «Симфония Звёзд» принята',
    ],
    'diploma' => [
        'name' => 'Анастасия', 'competition' => 'Симфония Звёзд', 'result' => 'ЛАУРЕАТ 1 степени',
        'diploma_number' => 'SZ-2026-004242', 'diploma_url' => 'https://xn----7sbugdeiegh1b0a9hen.xn--p1ai/verify/SZ-2026-004242',
        'preheader' => 'Ваш диплом лауреата готов и приложен к письму',
    ],
    'new_competition' => [
        'name' => 'Анастасия', 'competition' => 'Зимняя феерия',
        'description' => 'Приглашаем вокалистов, хореографов и художников к участию в новом всероссийском онлайн-конкурсе культуры и искусства.',
        'start_date' => '1 декабря 2026', 'end_date' => '20 января 2027',
        'competition_url' => 'https://xn----7sbugdeiegh1b0a9hen.xn--p1ai/competitions/zimnyaya-feeriya',
        'preheader' => 'Открыт приём заявок на новый конкурс',
    ],
    'payment_success' => [
        'name' => 'Анастасия', 'competition' => 'Симфония Звёзд', 'number' => 'SZ-2026-004242',
        'amount' => '900 ₽', 'cabinet_url' => 'https://xn----7sbugdeiegh1b0a9hen.xn--p1ai/cabinet',
        'preheader' => 'Оплата участия подтверждена',
    ],
    'registration' => [
        'name' => 'Анастасия',
        'verify_url' => 'https://xn----7sbugdeiegh1b0a9hen.xn--p1ai/verify-email/abc123token',
        'preheader' => 'Подтвердите адрес почты',
    ],
    'reminder_award' => [
        'name' => 'Анастасия', 'competition' => 'Симфония Звёзд', 'result' => 'ЛАУРЕАТ 1 степени',
        'order_url' => 'https://xn----7sbugdeiegh1b0a9hen.xn--p1ai/awards/order',
        'preheader' => 'Оформите памятную награду',
    ],
    'reminder_deadline' => [
        'name' => 'Анастасия', 'competition' => 'Симфония Звёзд', 'end_date' => '20 января 2027',
        'apply_url' => 'https://xn----7sbugdeiegh1b0a9hen.xn--p1ai/competitions/simfoniya-zvyozd',
        'preheader' => 'Приём заявок скоро закроется',
    ],
    'results' => [
        'name' => 'Анастасия', 'competition' => 'Симфония Звёзд', 'result' => 'ЛАУРЕАТ 1 степени', 'score' => '8,4',
        'results_url' => 'https://xn----7sbugdeiegh1b0a9hen.xn--p1ai/competitions/simfoniya-zvyozd/results',
        'preheader' => 'Результаты конкурса объявлены',
    ],
];

foreach ($cases as $name => $vars) {
    $vars['unsubscribe_url'] = 'https://xn----7sbugdeiegh1b0a9hen.xn--p1ai/unsubscribe?t=demo';
    $html = mail_template($name, $vars);
    $path = $outDir . '/' . $name . '.html';
    file_put_contents($path, $html);
    printf("[OK] %-22s -> %s (%.1f КБ)\n", $name, $path, strlen($html) / 1024);
}
