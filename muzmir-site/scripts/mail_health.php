<?php
/**
 * ЗДОРОВЬЕ ДОСТАВКИ ПО КАЖДОЙ ПОЧТОВОЙ СЛУЖБЕ.
 *
 * Это наш собственный постмастер. Внешний сервис статистики (postmaster.mail.ru
 * и подобные) показывает ровно те же величины, что сервис рассылок и так шлёт
 * нам событиями: доставлено, отбито, пожаловались, отписались, открыли. Ради
 * второго источника тех же цифр заводить учётку и подтверждать домен смысла нет.
 *
 * Единственное, чего события не показывают напрямую, — попало письмо во
 * «Входящие» или в «Спам». Но это видно по доле открытий: если у yandex.ru
 * открывает каждый десятый, а у mail.ru при той же рассылке никто, письма лежат
 * в спаме. Поэтому доля открытий здесь считается ПО КАЖДОЙ СЛУЖБЕ ОТДЕЛЬНО и
 * сравнивается между ними — именно её и надо смотреть каждый день.
 *
 *   php scripts/mail_health.php            — за сегодня
 *   php scripts/mail_health.php --days=3   — за трое суток
 */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { fwrite(STDERR, "CLI only\n"); exit(1); }

define('BASE_PATH', dirname(__DIR__));
$GLOBALS['CFG'] = require BASE_PATH . '/config.php';
require_once BASE_PATH . '/core/db.php';
require_once BASE_PATH . '/core/helpers.php';
require_once BASE_PATH . '/core/mail_reputation.php';
require_once BASE_PATH . '/core/mail_domain_policy.php';

$days = 0;
foreach ($argv as $a) if (preg_match('~^--days=(\d+)$~', $a, $m)) $days = (int) $m[1];
$since = $days > 0 ? "datetime('now','localtime','-$days days')" : "date('now','localtime')";
$line  = str_repeat('=', 78);

printf("ДОСТАВКА ПО ПОЧТОВЫМ СЛУЖБАМ%s\n%s\n", $days > 0 ? " ЗА $days сут." : ' ЗА СЕГОДНЯ', $line);

$rows = all("SELECT LOWER(SUBSTR(email, INSTR(email,'@') + 1)) d, status, COUNT(DISTINCT email) c
               FROM mail_events
              WHERE created_at >= $since AND INSTR(email,'@') > 0
              GROUP BY 1, 2");

$agg = [];
foreach ($rows as $r) {
    $d = (string) $r['d'];
    if (!isset($agg[$d])) $agg[$d] = ['delivered' => 0, 'hard_bounced' => 0, 'spam' => 0,
                                      'unsubscribed' => 0, 'opened' => 0, 'clicked' => 0];
    $s = (string) $r['status'];
    if (isset($agg[$d][$s])) $agg[$d][$s] += (int) $r['c'];
}
uasort($agg, static fn($a, $b) => ($b['delivered'] + $b['hard_bounced']) <=> ($a['delivered'] + $a['hard_bounced']));

printf("  %-22s %7s %7s %6s %6s %7s %6s %7s\n",
    'служба', 'дошло', 'отбито', 'отказ', 'жалоб', 'открыл', 'клик', 'норма');
$totD = $totB = $totO = 0;
$shown = 0;
foreach ($agg as $d => $s) {
    $att = $s['delivered'] + $s['hard_bounced'];
    if ($att < 5) continue;
    $bPct = $att > 0 ? round($s['hard_bounced'] * 100 / $att) : 0;
    $oPct = $s['delivered'] > 0 ? round($s['opened'] * 100 / $s['delivered']) : 0;
    $cap  = mrep_domain_day_cap($d);
    printf("  %-22s %7s %7s %5d%% %6d %6d%% %6d %7s\n", mb_substr($d, 0, 22),
        number_format($s['delivered'], 0, '.', ' '),
        number_format($s['hard_bounced'], 0, '.', ' '),
        $bPct, $s['spam'], $oPct, $s['clicked'],
        $cap === PHP_INT_MAX ? '—' : number_format($cap, 0, '.', ' '));
    $totD += $s['delivered']; $totB += $s['hard_bounced']; $totO += $s['opened'];
    if (++$shown >= 18) break;
}

$att = $totD + $totB;
printf("\n  ИТОГО: дошло %s, отбито %s (%d%%), открыли %s (%d%% от дошедших)\n",
    number_format($totD, 0, '.', ' '), number_format($totB, 0, '.', ' '),
    $att > 0 ? round($totB * 100 / $att) : 0,
    number_format($totO, 0, '.', ' '), $totD > 0 ? round($totO * 100 / $totD) : 0);

/* Где письма лежат: сравниваем открытия служб между собой. */
echo "\nПОПАДАЮТ ЛИ ПИСЬМА ВО «ВХОДЯЩИЕ»\n$line\n";
$best = 0;
foreach ($agg as $s) {
    if ($s['delivered'] < 100) continue;
    $best = max($best, $s['opened'] * 100 / $s['delivered']);
}
if ($best <= 0) {
    echo "  данных пока мало: нужно хотя бы сто доставленных писем в одну службу\n";
} else {
    foreach ($agg as $d => $s) {
        if ($s['delivered'] < 100) continue;
        $o = $s['opened'] * 100 / $s['delivered'];
        $rel = $best > 0 ? $o / $best : 1;
        $verdict = $rel >= 0.6 ? 'во «Входящие»'
                 : ($rel >= 0.3 ? 'похоже, часть в спам' : 'скорее всего в спам');
        printf("  %-22s открытий %2d%%  — %s\n", mb_substr($d, 0, 22), (int) round($o), $verdict);
    }
    echo "\n  Сравнение относительное: лучшая служба принята за образец. Если у одной\n"
       . "  службы открытий втрое меньше, чем у соседней при том же письме, дело не в\n"
       . "  людях, а в том, куда почта это письмо кладёт.\n";
}

/* Что сейчас закрыто. */
echo "\nКОМУ СЕЙЧАС НЕ ПИШЕМ\n$line\n";
$p = mrep_paused_note();
echo '  пауза на час: ' . ($p !== '' ? $p : 'никого') . "\n";
$off = mdp_official_domains();
echo '  только с почты центра: ' . ($off ? implode(', ', array_keys($off)) : 'никого') . "\n";
foreach (mrep_managed_domains() as $d) {
    $left = mrep_domain_quota_left($d);
    if ($left === 0) echo "  норма на сегодня выбрана: $d\n";
}
