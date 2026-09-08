<?php
/* Rocket CDN · сборка сводок по статистике.
   Используется расписанием (cron.php) и ботом. */

if (!defined('RC_ROOT')) require __DIR__ . '/config.php';

/* Свод за отрезок: $back — сколько дней назад начинать, $len — длина в днях.
   rc_stats_range(1, 1) это вчера, rc_stats_range(0, 7) это последняя неделя. */
function rc_stats_range($back = 1, $len = 1, $site = 'cdn') {
    $r = ['views' => 0, 'uniq' => 0, 'leads' => 0, 'callbacks' => 0, 'register' => 0,
          'connect' => 0, 'errors' => 0, 'refs' => [], 'devices' => [], 'nodes' => [],
          'searches' => [], 'scroll' => [], 'days' => []];
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
        foreach (['refs', 'devices', 'nodes', 'searches', 'scroll'] as $k) {
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

function rc_report_daily() {
    $y = rc_stats_range(1, 1);
    $p = rc_stats_range(2, 1);
    $date = date('d.m.Y', strtotime('-1 day'));

    $s = "<b>Аналитика · Rocket CDN за {$date}</b>\n\n"
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
    if (!$y['views']) $s .= "\nЗа сутки посещений не было.";

    $s .= rc_report_sites_tail(1, 1);
    return $s;
}

/* Хвост отчёта по остальным площадкам.

   Подробный разбор оставляем за Rocket CDN: там воронка, города и
   регистрации. По VPN и игре в чат идёт короткая строка - просмотры,
   люди, заявки. Полный разбор на три сайта не читается с телефона, а
   отчёт читают именно с телефона.

   Площадка без единого посещения за сутки в отчёт не попадает: строка
   «ноль, ноль, ноль» каждый день приучает не читать отчёт вовсе. */
function rc_report_sites_tail($back = 1, $len = 1) {
    $s = '';
    foreach (rc_sites() as $к => $имя) {
        if ($к === 'cdn') continue;
        $r = rc_stats_range($back, $len, $к);
        if (!$r['views'] && !$r['leads'] && !$r['callbacks']) continue;
        $s .= "\n<b>" . htmlspecialchars($имя) . "</b>\n"
            . "Просмотры: <b>{$r['views']}</b>, люди: <b>{$r['uniq']}</b>";
        $з = $r['leads'] + $r['callbacks'];
        if ($з) $s .= ", заявки: <b>{$з}</b>";
        $s .= "\n";
    }
    if ($s !== '') $s = "\n<b>Остальные площадки</b>\n" . $s;
    return $s;
}

function rc_report_period($len = 7, $title = 'Итоги периода') {
    $now = rc_stats_range(1, $len);
    $was = rc_stats_range(1 + $len, $len);
    $s = "<b>{$title}</b>\n\n"
       . "Просмотры: <b>{$now['views']}</b>" . rc_delta($now['views'], $was['views']) . "\n"
       . "Уникальные: <b>{$now['uniq']}</b>" . rc_delta($now['uniq'], $was['uniq']) . "\n"
       . "Клики «Регистрация»: <b>{$now['register']}</b>" . rc_delta($now['register'], $was['register']) . "\n"
       . "Заявки: <b>" . ($now['leads'] + $now['callbacks']) . "</b>"
       . rc_delta($now['leads'] + $now['callbacks'], $was['leads'] + $was['callbacks']) . "\n"
       . "Конверсия: <b>{$now['conv']}%</b>\n";

    $s .= rc_report_sites_tail(1, $len);

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
