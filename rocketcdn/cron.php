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

/* ── Заявка ждёт ответа ─────────────────────────────────────
   Заявка приходит и лежит. Владелец может её проглядеть в потоке
   сообщений, поэтому раз в час смотрим, не забыли ли кого. */
$remindAfter = (int)rc_cfg('lead_remind_hours', 3) * 3600;
if ($remindAfter > 0 && $hour >= 9 && $hour <= 21) {
    $store = rc_json_read(RC_LEADS, []);
    $stale = [];
    foreach ((array)($store['items'] ?? []) as $l) {
        if (($l['status'] ?? 'new') !== 'new') continue;
        /* ts лежит строкой вида 2026-08-12 11:30:00 */
        $ts = strtotime((string)($l['ts'] ?? ''));
        if (!$ts || time() - $ts < $remindAfter) continue;
        if (in_array($l['id'] ?? '', (array)($state['reminded'] ?? []), true)) continue;
        $stale[] = $l;
    }
    if ($stale) {
        $txt = "<b>Заявки без ответа</b>\n\n";
        foreach (array_slice($stale, 0, 8) as $l) {
            $h = max(1, (int)round((time() - strtotime((string)$l['ts'])) / 3600));
            $txt .= '· ' . htmlspecialchars((string)($l['name'] ?? '-')) . ' · ' .
                    htmlspecialchars((string)($l['contact'] ?? '-')) . ' · ждёт ' . $h . " ч\n";
        }
        if (count($stale) > 8) $txt .= 'и ещё ' . (count($stale) - 8) . "\n";
        $txt .= "\nОткрыть: " . rc_cfg('site_url') . '/admin.html';
        rc_notify($txt, null, 'tg_topic_form');

        $done = (array)($state['reminded'] ?? []);
        foreach ($stale as $l) $done[] = $l['id'] ?? '';
        $state['reminded'] = array_slice(array_values(array_unique($done)), -200);
        rc_json_write($flagFile, $state);
    }
}

/* ── Здоровье площадки ──────────────────────────────────────
   Раз в сутки смотрим на то, что тихо ломается и о чём узнают
   последними: место на диске, срок сертификата, право на запись. */
if (($state['health'] ?? '') !== $today && ($force || $hour === 10)) {
    $bad = [];

    $free = @disk_free_space(RC_DATA);
    $all  = @disk_total_space(RC_DATA);
    if ($free && $all && $free / $all < 0.12) {
        $bad[] = 'на диске осталось ' . round($free / 1073741824, 1) . ' ГБ из ' . round($all / 1073741824) . ' ГБ';
    }

    if (!is_writable(RC_DATA)) $bad[] = 'папка с заявками закрыта на запись, форма не сохранит ничего';

    /* Срок сертификата пишет корневой скрипт в cert.json */
    $cert = rc_json_read(RC_DATA . '/cert.json', []);
    if (!empty($cert['until'])) {
        $days = (int)floor(((int)$cert['until'] - time()) / 86400);
        if ($days <= 14) $bad[] = 'сертификат кончается через ' . $days . ' дн.';
    }

    $log = is_file(RC_LOG) ? (string)@file_get_contents(RC_LOG) : '';
    $tgErr = substr_count($log, 'TG ');
    if ($tgErr > 20) $bad[] = 'в журнале ' . $tgErr . ' сбоев связи с Телеграмом';

    if ($bad) {
        rc_notify("<b>Площадка просит внимания</b>\n\n· " . implode("\n· ", $bad), null, 'tg_topic_error');
    }
    $state['health'] = $today;
    rc_json_write($flagFile, $state);
}

/* ── Резервная копия заявок ─────────────────────────────────
   Заявки живут в файлах, и это единственная незаменимая вещь на
   площадке. Держим четырнадцать суточных копий рядом, но вне
   корня сайта. */
if (($state['backup'] ?? '') !== $today) {
    $dir = RC_DATA . '/backup';
    if (!is_dir($dir)) @mkdir($dir, 0775, true);
    $snap = [
        'date'   => $today,
        'leads'  => rc_json_read(RC_LEADS, []),
        'binds'  => rc_json_read(RC_DATA . '/bindings.json', []),
        'content'=> rc_json_read(RC_CONTENT, []),
    ];
    @file_put_contents($dir . '/' . $today . '.json',
        json_encode($snap, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT), LOCK_EX);
    foreach (glob($dir . '/*.json') as $f) {
        if (strtotime(basename($f, '.json')) < strtotime('-14 day')) @unlink($f);
    }
    $state['backup'] = $today;
    rc_json_write($flagFile, $state);
}

/* ── Уборка раз в сутки ─────────────────────────────────── */
if (($state['clean'] ?? '') !== $today) {
    /* Статистика старше 180 дней не нужна. Подпапки площадок метём
       наравне с корнем: иначе VPN и игра копили бы файлы вечно, а
       заметили бы это через год по размеру диска. */
    foreach (array_merge(glob(RC_STATS . '/*.json'), glob(RC_STATS . '/*/*.json')) as $f) {
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
