<?php
/* ============================================================
   PandaGo - Cron
   Запускается каждые 15 минут.
   Задачи:
     · Дожим 1ч по новым заявкам (напоминание админам)
     · Дожим 24ч по не закрытым заявкам
     · Дайджест 09:00 МСК - сводка за прошлые сутки
   ============================================================ */

declare(strict_types=1);
require_once __DIR__.'/config.php';
require_once __DIR__.'/lib.php';

$now = time();
$d   = data_read();
$leads = &$d['leads'];

/* ─── Дожимы 1ч ─── */
foreach ($leads as $i => $l) {
    if (!empty($l['nudge1h'])) continue;
    if (($l['status'] ?? 'new') !== 'new') continue;
    if ($now - $l['ts'] < NUDGE_1H_SEC) continue;

    $text = "Напоминание · заявка {$l['id']} без обработки уже 1 час\n\n".
            format_lead_notification($l);
    tg_broadcast_admins($text, tg_inline_lead_actions($l['id']));
    $leads[$i]['nudge1h'] = 1;
}

/* ─── Дожимы 24ч ─── */
foreach ($leads as $i => $l) {
    if (!empty($l['nudge24h'])) continue;
    if (in_array(($l['status'] ?? 'new'), ['done','trash'], true)) continue;
    if ($now - $l['ts'] < NUDGE_24H_SEC) continue;

    $text = "Заявка {$l['id']} не закрыта уже 24 часа\n\n".
            format_lead_notification($l);
    tg_broadcast_admins($text, tg_inline_lead_actions($l['id']));
    $leads[$i]['nudge24h'] = 1;
}

/* ─── Дайджест в 09:00 МСК ─── */
$curHour = (int)date('G', $now);
$today9  = strtotime(date('Y-m-d 09:00:00', $now));
$sentToday = ($d['digest_last'] ?? 0) >= $today9;

if ($curHour >= DIGEST_HOUR && !$sentToday) {
    $from = strtotime('-1 day', $today9);
    $to   = $today9;
    $day = ['total'=>0,'new'=>0,'in_progress'=>0,'done'=>0,'trash'=>0];
    foreach ($leads as $l) {
        if ($l['ts'] < $from || $l['ts'] >= $to) continue;
        $day['total']++;
        $st = $l['status'] ?? 'new';
        if (isset($day[$st])) $day[$st]++;
    }
    $openTotal = 0; $inProgress = 0;
    foreach ($leads as $l) {
        $st = $l['status'] ?? 'new';
        if ($st === 'new') $openTotal++;
        if ($st === 'in_progress') $inProgress++;
    }

    $t = "Дайджест PandaGo · ".date('d.m.Y', $from)."\n\n".
         "За сутки:\n".
         "  всего заявок: {$day['total']}\n".
         "  новых:        {$day['new']}\n".
         "  в работе:     {$day['in_progress']}\n".
         "  закрытых:     {$day['done']}\n".
         "  в корзине:    {$day['trash']}\n\n".
         "Сейчас открытых:\n".
         "  новых:    {$openTotal}\n".
         "  в работе: {$inProgress}\n\n".
         "Курс USD/RUB: ".($d['settings']['rate'] ?? DEFAULT_RATE)." руб\n".
         "Панель: ".SITE_URL."admin.html";
    tg_broadcast_admins($t);
    $d['digest_last'] = $now;
}

data_write($d);
echo "ok\n";
