<?php
/* Rocket CDN · сборка сводок по статистике.
   Используется расписанием (cron.php) и ботом. */

if (!defined('RC_ROOT')) require __DIR__ . '/config.php';

/* Свод за отрезок: $back — сколько дней назад начинать, $len — длина в днях.
   rc_stats_range(1, 1) это вчера, rc_stats_range(0, 7) это последняя неделя. */
function rc_stats_range($back = 1, $len = 1, $site = 'cdn') {
    $r = ['views' => 0, 'uniq' => 0, 'leads' => 0, 'callbacks' => 0, 'register' => 0,
          'connect' => 0, 'errors' => 0, 'refs' => [], 'devices' => [], 'nodes' => [],
          'searches' => [], 'scroll' => [], 'акты' => [], 'days' => []];
    for ($i = 0; $i < $len; $i++) {
        $day = date('Y-m-d', strtotime('-' . ($back + $i) . ' day'));
        $d = rc_json_read(stat_file($day, $site), []);
        $ev = $d['events'] ?? [];
        $row = [
            'day'       => $day,
            'views'     => (int)($d['views'] ?? 0),
            'uniq'      => count($d['uniq'] ?? []),
            'leads'     => (int)($d['leads'] ?? 0),
            'callbacks' => (int)($d['callbacks'] ?? 0),
            'register'  => (int)($ev['register'] ?? 0),
        ];
        $r['days'][] = $row;
        $r['views'] += $row['views'];
        $r['uniq'] += $row['uniq'];
        $r['leads'] += $row['leads'];
        $r['callbacks'] += $row['callbacks'];
        $r['register'] += $row['register'];
        $r['connect'] += (int)($ev['connect'] ?? 0);
        $r['errors'] += array_sum($d['errors'] ?? []);
        foreach (['refs', 'devices', 'nodes', 'searches', 'scroll', 'акты'] as $k) {
            foreach (($d[$k] ?? []) as $kk => $vv) $r[$k][$kk] = ($r[$k][$kk] ?? 0) + $vv;
        }
    }
    $r['days'] = array_reverse($r['days']);
    $r['conv'] = $r['uniq'] ? round(($r['leads'] + $r['callbacks']) / $r['uniq'] * 100, 1) : 0;
    $r['ctr']  = $r['uniq'] ? round($r['register'] / $r['uniq'] * 100, 1) : 0;
    arsort($r['refs']); arsort($r['nodes']); arsort($r['searches']);
    return $r;
}

/* Стрелка сравнения с предыдущим отрезком */
function rc_delta($now, $was) {
    if ($was == 0) return $now > 0 ? ' (+' . $now . ')' : '';
    $p = round(($now - $was) / $was * 100);
    if ($p == 0) return ' (без изменений)';
    return ' (' . ($p > 0 ? '+' : '') . $p . '%)';
}

/* ── У КАЖДОЙ ПЛОЩАДКИ СВОЙ ОТЧЁТ, А НЕ ХВОСТ В ЧУЖОМ ─────────
   Отчёт собирался только по CDN, а VPN и игра шли тремя строчками в
   его конце под заголовком «Остальные площадки». Владелец: «по VPN
   сделать всё так же, но в другие ветки».

   Поэтому сборка стала разбором ОДНОЙ названной площадки, а рассылку
   по веткам делает расписание: сколько площадок, столько сообщений, у
   каждого свой заголовок и своя ветка. Хвоста больше нет вовсе. */
function rc_report_daily($сайт = 'cdn') {
    $имяС = rc_sites()[$сайт] ?? $сайт;
    $y = rc_stats_range(1, 1, $сайт);
    $p = rc_stats_range(2, 1, $сайт);
    $date = date('d.m.Y', strtotime('-1 day'));

    $s = "<b>Аналитика · {$имяС} за {$date}</b>\n\n"
       . "Просмотры: <b>{$y['views']}</b>" . rc_delta($y['views'], $p['views']) . "\n"
       . "Уникальные: <b>{$y['uniq']}</b>" . rc_delta($y['uniq'], $p['uniq']) . "\n"
       . "Клики «Регистрация»: <b>{$y['register']}</b>" . rc_delta($y['register'], $p['register']) . "\n"
       . "Переходы к подключению: <b>{$y['connect']}</b>\n"
       . "Заявки: <b>{$y['leads']}</b>, звонки: <b>{$y['callbacks']}</b>\n"
       . "Конверсия в заявку: <b>{$y['conv']}%</b>\n"
       . "Доля кликнувших регистрацию: <b>{$y['ctr']}%</b>\n";

    if ($y['errors']) $s .= "\nОшибок на фронте: <b>{$y['errors']}</b>\n";

    if ($y['refs']) {
        $s .= "\n<b>Откуда приходили</b>\n";
        $i = 0;
        foreach ($y['refs'] as $k => $v) { $s .= "· " . htmlspecialchars($k) . ": {$v}\n"; if (++$i >= 5) break; }
    }
    if ($y['devices']) {
        $s .= "\n<b>Устройства</b>\n";
        foreach ($y['devices'] as $k => $v) $s .= "· {$k}: {$v}\n";
    }
    if (!empty($y['scroll']['75'])) {
        $s .= "\nДочитали до 75% страницы: <b>{$y['scroll']['75']}</b>\n";
    }
    if ($y['nodes']) {
        $s .= "\n<b>Искали города</b>\n";
        $i = 0;
        foreach ($y['nodes'] as $k => $v) { $s .= "· " . htmlspecialchars($k) . ": {$v}\n"; if (++$i >= 5) break; }
    }
    /* Акты фильма считает только VPN: по ним видно, на каком месте
       человек уходит, и это там главный вопрос. У CDN такого поля нет
       вовсе, поэтому раздел появляется сам по данным. */
    if (!empty($y['акты'])) {
        $s .= "\n<b>Докуда доходили по фильму</b>\n";
        $i = 0;
        foreach ($y['акты'] as $k => $v) { $s .= "· " . htmlspecialchars($k) . ": {$v}\n"; if (++$i >= 8) break; }
    }
    if (!$y['views']) $s .= "\nЗа сутки посещений не было.";
    return $s;
}

/* ── КОМУ СЕГОДНЯ ЕСТЬ ЧТО СКАЗАТЬ ───────────────────────────
   Площадка без единого посещения за сутки отчёта не получает: строка
   «ноль, ноль, ноль» каждый день приучает не читать отчёт вовсе. У
   CDN отчёт идёт всегда - это основной сайт, и его молчание само по
   себе новость.

   Игра отдельного отчёта не получает: у неё нет ни своих суток, ни
   своей ветки, она часть пути по сайту VPN. */
function rc_report_sites($back = 1, $len = 1) {
    $из = [];
    foreach (rc_sites() as $к => $имя) {
        if ($к === 'game') continue;
        if ($к === 'cdn') { $из[] = $к; continue; }
        $r = rc_stats_range($back, $len, $к);
        if ($r['views'] || $r['leads'] || $r['callbacks']) $из[] = $к;
    }
    return $из;
}

function rc_report_period($len = 7, $title = 'Итоги периода', $сайт = 'cdn') {
    $имяС = rc_sites()[$сайт] ?? $сайт;
    $now = rc_stats_range(1, $len, $сайт);
    $was = rc_stats_range(1 + $len, $len, $сайт);
    $s = "<b>{$title} · {$имяС}</b>\n\n"
       . "Просмотры: <b>{$now['views']}</b>" . rc_delta($now['views'], $was['views']) . "\n"
       . "Уникальные: <b>{$now['uniq']}</b>" . rc_delta($now['uniq'], $was['uniq']) . "\n"
       . "Клики «Регистрация»: <b>{$now['register']}</b>" . rc_delta($now['register'], $was['register']) . "\n"
       . "Заявки: <b>" . ($now['leads'] + $now['callbacks']) . "</b>"
       . rc_delta($now['leads'] + $now['callbacks'], $was['leads'] + $was['callbacks']) . "\n"
       . "Конверсия: <b>{$now['conv']}%</b>\n";

    $s .= "\n<b>По дням</b>\n<code>";
    foreach ($now['days'] as $r) {
        $s .= str_pad(date('d.m', strtotime($r['day'])), 7)
            . str_pad((string)$r['uniq'], 6)
            . str_pad((string)$r['register'], 5)
            . ($r['leads'] + $r['callbacks']) . "\n";
    }
    $s .= "</code><i>дата · уники · клики · заявки</i>";
    return $s;
}
