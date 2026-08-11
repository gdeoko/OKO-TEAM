<?php
/* ══════════════════════════════════════════════════════════
   Rocket CDN · ежедневный отчёт и уборка

   Ставится раз в час, сам решает, когда пора отчитываться:
     0 * * * * /usr/bin/php /var/www/rocketcdn/cron.php >/dev/null 2>&1

   В 9:00 по Москве отправляет сводку за вчера в тему «Аналитика»,
   по понедельникам добавляет итог недели, раз в сутки чистит
   старую статистику и логи.
   ══════════════════════════════════════════════════════════ */

require __DIR__ . '/config.php';
require __DIR__ . '/lib_report.php';

$force = (php_sapi_name() === 'cli' && in_array('--now', $argv ?? [], true))
      || (isset($_GET['force']) && ($_GET['key'] ?? '') === rc_cfg('admin_key'));

if (php_sapi_name() !== 'cli' && ($_GET['key'] ?? '') !== rc_cfg('admin_key')) {
    http_response_code(403); exit('forbidden');
}

$flagFile = RC_DATA . '/cron_state.json';
$state = rc_json_read($flagFile, []);
$today = date('Y-m-d');
$hour  = (int)date('G');

/* ── Ежедневный отчёт ───────────────────────────────────── */
if ($force || ($hour >= (int)rc_cfg('report_hour', 9) && ($state['daily'] ?? '') !== $today)) {
    rc_notify(rc_report_daily(), null, 'tg_topic_stat');

    /* По понедельникам добавляем недельный срез */
    if (date('N') === '1' || $force) {
        rc_notify(rc_report_period(7, 'Итоги недели'), null, 'tg_topic_stat');
    }

    /* Письмо владельцу, если почта настроена */
    if (rc_cfg('mail_to')) {
        $d = rc_stats_range(1, 1);
        rc_mail(rc_cfg('mail_to'), 'Аналитика сайта за ' . date('d.m.Y', strtotime('-1 day')) . ' · Rocket CDN',
            rc_mail_tpl('Аналитика за ' . date('d.m.Y', strtotime('-1 day')), [
                'Просмотры'            => (string)$d['views'],
                'Уникальные'           => (string)$d['uniq'],
                'Клики «Регистрация»'  => (string)$d['register'],
                'Заявки'               => (string)$d['leads'],
                'Заявки на звонок'     => (string)$d['callbacks'],
                'Конверсия'            => $d['conv'] . '%',
            ], 'Подробности в админке сайта.', ['text' => 'Открыть админку', 'url' => rc_cfg('site_url') . '/admin.html']));
    }

    $state['daily'] = $today;
    rc_json_write($flagFile, $state);
}

/* ── Уборка раз в сутки ─────────────────────────────────── */
if (($state['clean'] ?? '') !== $today) {
    /* Статистика старше 180 дней не нужна */
    foreach (glob(RC_STATS . '/*.json') as $f) {
        $day = basename($f, '.json');
        if (preg_match('~^\d{4}-\d{2}-\d{2}$~', $day) && strtotime($day) < strtotime('-180 day')) @unlink($f);
    }
    /* Лог ошибок держим в пределах двух тысяч строк */
    if (is_file(RC_LOG) && filesize(RC_LOG) > 400000) {
        $lines = array_slice(file(RC_LOG), -2000);
        @file_put_contents(RC_LOG, implode('', $lines), LOCK_EX);
    }
    foreach (glob(RC_DATA . '/rate_*.json') as $f) {
        if (filemtime($f) < time() - 86400) @unlink($f);
    }
    $state['clean'] = $today;
    rc_json_write($flagFile, $state);
}

if (php_sapi_name() !== 'cli') {
    header('Content-Type: application/json; charset=UTF-8');
    echo json_encode(['ok' => true, 'state' => $state], JSON_UNESCAPED_UNICODE);
}
