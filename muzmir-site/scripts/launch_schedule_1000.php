<?php
/**
 * Планирование запуска кампании на 10 августа 2026, 10:00 МСК (приказ владельца).
 *
 * Что делает:
 *   1. Сохраняет в settings дату/время/каналы плана (их показывает пульт запуска).
 *   2. Вызывает launch_schedule_all() — она отменяет прежний план и создаёт волны:
 *        10.08 10:00  launch_vk        — по посту ВК на каждый из 4 конкурсов (стена+сторис+личка)
 *        10.08 10:00  launch_mail      — общее письмо со всеми афишами по базе + in-app
 *        10.08 10:15  campaign_vip     — приглашение в ВИП-клуб (email)
 *        10.08 10:30  campaign_kabinet — письмо про личный кабинет (email)
 *        22.08 09:00  d3               — «осталось 3 дня» (ВК + in-app)
 *        25.08 09:00  last             — «последний день» (ВК + in-app)
 *        25.08 18:00  closed           — приём закрыт (ВК + in-app)
 *        28.08 09:00  results          — итоги длинного конкурса «Величие России»
 *   3. Печатает получившийся план для проверки.
 *
 * ВАЖНО: задания НЕ выстрелят, пока settings.mass_sending = '0' (стоп-кран).
 * cron/launch_scheduler.php раз в минуту видит стоп-кран и выходит, задания ждут.
 * Включение массовых — отдельным шагом (scripts/launch_go.php) ровно в 10:00.
 *
 * Запуск: php scripts/launch_schedule_1000.php
 */
declare(strict_types=1);

define('BASE_PATH', dirname(__DIR__));
$GLOBALS['CFG'] = require BASE_PATH . '/config.php';
foreach (['db', 'data', 'helpers', 'send_timing', 'newsletter', 'launch_run'] as $m) {
    require_once BASE_PATH . '/core/' . $m . '.php';
}

const LAUNCH_DATE = '2026-08-10';
const LAUNCH_TIME = '10:00';
const CHANNELS    = ['vk_wall', 'vk_dm', 'email', 'inapp'];

echo "=== ПЛАНИРОВАНИЕ ЗАПУСКА " . LAUNCH_DATE . ' ' . LAUNCH_TIME . " МСК ===\n\n";
echo "Сейчас: " . date('Y-m-d H:i:s D T') . "\n";
echo "Стоп-кран mass_sending: " . (setting('mass_sending', '0') === '1' ? 'ВЫКЛЮЧЕН (массовое пойдёт!)' : 'ВКЛЮЧЁН (массовое стоит)') . "\n\n";

$res = launch_schedule_all(LAUNCH_DATE, LAUNCH_TIME, CHANNELS);
if (empty($res['ok'])) {
    fwrite(STDERR, "ОШИБКА: " . ($res['msg'] ?? 'не удалось запланировать') . "\n");
    exit(1);
}

set_setting('launch_plan_date', LAUNCH_DATE);
set_setting('launch_plan_time', LAUNCH_TIME);
set_setting('launch_plan_channels', implode(',', CHANNELS));

echo "Запланировано волн: " . count($res['scheduled']) . " (конкурсов: " . $res['comps'] . ")\n\n";
echo "=== ИТОГОВЫЙ ПЛАН (launch_jobs) ===\n";
$rows = all("SELECT j.id, j.wave, j.channels, j.run_at, j.status, c.name AS comp
               FROM launch_jobs j LEFT JOIN competitions c ON c.id = j.competition_id
              WHERE j.status = 'scheduled'
              ORDER BY j.run_at ASC, j.id ASC");
foreach ($rows as $r) {
    printf("  %-19s  %-17s  %-24s  %s\n",
        $r['run_at'], $r['wave'], $r['channels'], (string) ($r['comp'] ?? ''));
}
echo "\nВсего заданий в плане: " . count($rows) . "\n";

// Контроль: ничего не должно быть запланировано в прошлое.
$past = 0;
foreach ($rows as $r) if ((string) $r['run_at'] < date('Y-m-d H:i:s')) $past++;
echo $past > 0
    ? "ВНИМАНИЕ: заданий в прошлом — $past (выстрелят сразу при включении стоп-крана)\n"
    : "Проверка: заданий в прошлом нет.\n";
