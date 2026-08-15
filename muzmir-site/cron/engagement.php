<?php
/**
 * Вовлекающие IN-APP уведомления (НЕ email — не массовая рассылка).
 * Показываются участнику в приложении (колокольчик + тост сверху как от чата),
 * только тем, кто реально пользуется приложением (есть сессия за последнее время).
 *
 *   1) «Начал — не закончил»: зарегистрировался >2 дней назад, но НИ ОДНОЙ заявки →
 *      один мягкий нудж «подайте заявку» (однократно, icon='nudge').
 *   2) «Иногда напоминания/реклама»: активному участнику — не чаще раза в 7 дней —
 *      уведомление о ближайшем открытом конкурсе (icon='promo'), с ограничением на проход.
 *
 * Запуск: php cron/engagement.php   (crontab: 0 12 * * *)
 */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { fwrite(STDERR, "CLI only\n"); exit(1); }

define('BASE_PATH', dirname(__DIR__));
$GLOBALS['CFG'] = require BASE_PATH . '/config.php';
require_once BASE_PATH . '/core/db.php';
require_once BASE_PATH . '/core/helpers.php';
if (is_file(BASE_PATH . '/core/notifications.php')) require_once BASE_PATH . '/core/notifications.php';
require_once __DIR__ . '/_lib.php';

const JOB = 'engagement';

// СТОП-КРАН: пока массовые коммуникации выключены в пульте запуска, ничего
// массового наружу не уходит (см. core/newsletter.php::mass_sending_enabled).
if (is_file(BASE_PATH . '/core/newsletter.php')) require_once BASE_PATH . '/core/newsletter.php';
if (function_exists('mass_sending_enabled') && !mass_sending_enabled()) {
    cron_log(JOB, 'массовые коммуникации выключены стоп-краном — выход');
    exit(0);
}

if (!cron_lock(JOB, 600)) { exit(0); }
if (!function_exists('notify_user') || !function_exists('tbl_exists') || !tbl_exists('notifications')) {
    cron_log(JOB, 'notifications недоступны — выход'); cron_unlock(JOB); exit(0);
}

$PROMO_CAP = 300; // не больше N промо-уведомлений за проход

try {
    /* 1) Нудж «подайте заявку» — активные пользователи без заявок. */
    $nudged = 0;
    $rows = all(
        "SELECT DISTINCT u.id, u.full_name
           FROM users u
           JOIN sessions s ON s.user_id = u.id
          WHERE u.created_at <= datetime('now','localtime','-2 days')
            AND s.created_at >= datetime('now','localtime','-30 days')
            AND NOT EXISTS (SELECT 1 FROM applications a WHERE a.user_id = u.id)
            AND NOT EXISTS (SELECT 1 FROM notifications n WHERE n.user_id = u.id AND n.icon='nudge')
          LIMIT 300"
    );
    foreach ($rows as $u) {
        notify_user((int) $u['id'], 'Участвуйте в конкурсе',
            'Вы ещё не подали ни одной заявки. Выберите конкурс и подайте заявку — это займёт пару минут.',
            '/calendar', 'nudge');
        $nudged++;
    }

    /* 2) Промо о ближайшем открытом конкурсе — активным, не чаще раза в 7 дней. */
    $promoed = 0;
    $comp = one("SELECT name, slug FROM competitions WHERE status='open' ORDER BY (end_date IS NULL), end_date ASC LIMIT 1");
    if ($comp) {
        $rows = all(
            "SELECT DISTINCT u.id
               FROM users u
               JOIN sessions s ON s.user_id = u.id
              WHERE s.created_at >= datetime('now','localtime','-14 days')
                AND NOT EXISTS (SELECT 1 FROM notifications n WHERE n.user_id = u.id AND n.icon='promo'
                                AND n.created_at >= datetime('now','localtime','-7 days'))
              LIMIT " . (int) $PROMO_CAP
        );
        foreach ($rows as $u) {
            notify_user((int) $u['id'], 'Открыт приём заявок',
                'Идёт конкурс «' . (string) $comp['name'] . '». Успейте подать заявку — жюри, дипломы и награды.',
                '/competition/' . (string) $comp['slug'], 'promo');
            $promoed++;
        }
    }

    /* 3) Ротация «сообщений от чат-бота»: помощь, подписка ВК/МАКС, ВИП-клуб.
          Каждому активному пользователю — не чаще одного типа раз в 30 дней,
          и не больше одного нового типа за проход (чтобы не спамить). */
    $TIPS = [
        'tip_help' => ['Мы на связи — помогу с заявкой',
            'Есть вопрос по конкурсу, оплате или диплому? Напишите в чат — подскажу по шагам.',
            '/contacts', 'tip_help'],
        'tip_vk'   => ['Подпишитесь на нас ВКонтакте',
            'Новости конкурсов, результаты и розыгрыши — в нашей группе ВКонтакте.',
            (string) cfgv('org_vk', 'https://vk.com/music_world.online'), 'tip_vk'],
        'tip_max'  => ['Мы теперь и в МАКС',
            'Подпишитесь на канал в МАКС — уведомления о новых конкурсах и дедлайнах.',
            (string) cfgv('org_max', ''), 'tip_max'],
        'tip_vip'  => ['ВИП-клуб «Музыкальный Мир»',
            'Скидки на конкурсы, приоритетная проверка и комментарии жюри. Загляните в клуб.',
            '/club', 'tip_vip'],
    ];
    $tipped = 0; $TIP_CAP = 400;
    // Активные пользователи (была сессия за 21 день), которым сегодня не слали нудж/промо выше.
    $activeUsers = all(
        "SELECT DISTINCT u.id FROM users u JOIN sessions s ON s.user_id=u.id
          WHERE s.created_at >= datetime('now','localtime','-21 days') LIMIT " . (int)$TIP_CAP);
    foreach ($activeUsers as $u) {
        $uid = (int) $u['id'];
        foreach ($TIPS as [$title, $body, $url, $ic]) {
            // Уже получал этот тип за последние 30 дней? — пропускаем.
            $has = (int) scalar(
                "SELECT COUNT(*) FROM notifications WHERE user_id=? AND icon=? AND created_at >= datetime('now','localtime','-30 days')",
                [$uid, $ic]);
            if ($has) continue;
            notify_user($uid, $title, $body, $url, $ic);
            $tipped++;
            break; // один тип за проход на пользователя
        }
    }

    cron_log(JOB, "нудж:$nudged промо:$promoed советы:$tipped");
} catch (\Throwable $e) {
    cron_log(JOB, 'ОШИБКА: ' . $e->getMessage());
} finally {
    cron_unlock(JOB);
}
