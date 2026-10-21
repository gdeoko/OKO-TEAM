<?php
/**
 * СУТОЧНАЯ СВЕРКА ПОДПИСКИ НА СООБЩЕСТВО ВКОНТАКТЕ.
 *
 * Бонус подписчика (2% на электронные наградные документы) обязан быть
 * честным в обе стороны: подписался — получил, отписался — потерял. Признак
 * хранится в users.vk_sub, и этот файл приводит его в соответствие с тем, что
 * на самом деле отвечает ВКонтакте.
 *
 * Идём ОДНИМ запросом на каждые 500 человек (groups.isMember принимает список)
 * и ключом СООБЩЕСТВА — личная страница владельца для этого не нужна и трогать
 * её незачем (правило 24 в памяти проекта). При отказе по темпу пачка
 * пропускается молча: признак остаётся прежним, завтра сверим снова.
 *
 * Запуск: php cron/vk_subs_sync.php [--dry]
 */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { fwrite(STDERR, "CLI only\n"); exit(1); }

define('BASE_PATH', dirname(__DIR__));
$GLOBALS['CFG'] = require BASE_PATH . '/config.php';
require_once BASE_PATH . '/cron/_lib.php';
require_once BASE_PATH . '/core/db.php';
require_once BASE_PATH . '/core/helpers.php';
require_once BASE_PATH . '/core/vk.php';
require_once BASE_PATH . '/core/vk_subscriber.php';

if (!cron_lock('vk_subs_sync', 900)) exit(0);

$dry = in_array('--dry', $argv ?? [], true);

if (vk_sub_group_id() === '') {
    echo "сообщество не задано (vk_group_id) — сверять нечего\n";
    exit(0);
}

if ($dry) {
    $n = (int) scalar("SELECT COUNT(*) FROM users WHERE COALESCE(vk_id,'')<>''");
    echo "сухой прогон: привязан ВКонтакте у $n человек, запросов к ВК потребуется " . (int) ceil($n / 500) . "\n";
    exit(0);
}

$r = vk_sub_sync();
printf("сверено: %d, подписаны: %d, изменилось: %d, запросов к ВК: %d\n",
       $r['всего'], $r['подписаны'], $r['изменилось'], $r['запросов']);

/* Заметная перемена — в журнал: так видно, если сообщество вдруг «потеряло»
   всех разом (например, сменился ключ или id). */
if ($r['изменилось'] > 0 && function_exists('audit')) {
    audit('vk_subs_sync', 'users', null, $r);
}
