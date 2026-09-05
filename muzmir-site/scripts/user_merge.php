<?php
/**
 * СЛИЯНИЕ ДВУХ АККАУНТОВ ОДНОГО ЧЕЛОВЕКА.
 *
 *   php scripts/user_merge.php --from=9615 --to=3662 [--dry]
 *
 * Зачем. Человек заходит то по почте, то через ВК — и получает два разных
 * кабинета. Заявки расходятся: в одном кабинете видна первая, в другом вторая,
 * достижения и уровень считаются по половине истории, а письма уходят на тот
 * адрес, который оказался в заявке. Именно так вышло у Кобелевой: заявка
 * MT-2026-00019 осталась в почтовом кабинете, MT-2026-00020 — во вкашном.
 *
 * Что делает: переносит всё, что привязано к user_id, из «донора» в «основной»,
 * добирает в основной недостающие сведения (имя, аватар, привязку ВК, телефон),
 * а донора закрывает — с отметкой, в кого он слит.
 *
 * Чего НЕ делает: не трогает заявки, оплаты, дипломы и заказы по сути —
 * меняется только владелец записи. Ничего не удаляется: донор остаётся в базе
 * закрытым, чтобы слияние можно было разобрать.
 */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { fwrite(STDERR, "CLI only\n"); exit(1); }

define('BASE_PATH', dirname(__DIR__));
$GLOBALS['CFG'] = require BASE_PATH . '/config.php';
require_once BASE_PATH . '/core/db.php';
require_once BASE_PATH . '/core/helpers.php';

$opt = [];
foreach (array_slice($argv, 1) as $arg)
    if (preg_match('~^--([a-z-]+)(?:=(.*))?$~', $arg, $m)) $opt[$m[1]] = $m[2] ?? '1';

$from = (int) ($opt['from'] ?? 0);
$to   = (int) ($opt['to'] ?? 0);
$dry  = isset($opt['dry']);
if ($from <= 0 || $to <= 0 || $from === $to) {
    fwrite(STDERR, "Укажите --from=<донор> --to=<основной>\n"); exit(1);
}
$uFrom = one("SELECT * FROM users WHERE id=?", [$from]);
$uTo   = one("SELECT * FROM users WHERE id=?", [$to]);
if (!$uFrom || !$uTo) { fwrite(STDERR, "Аккаунт не найден\n"); exit(1); }

printf("Донор:    #%d %s %s\n", $from, (string) ($uFrom['full_name'] ?? '—'), (string) ($uFrom['email'] ?? ''));
printf("Основной: #%d %s %s\n\n", $to, (string) ($uTo['full_name'] ?? '—'), (string) ($uTo['email'] ?? ''));

/* Слепок до слияния — чтобы было чем разобрать, если что-то пойдёт не так. */
if (!$dry) {
    $dump = ['at' => date('c'), 'from' => $uFrom, 'to' => $uTo, 'moved' => []];
}

/* Все таблицы с колонкой user_id: перебираем схему, а не список руками —
 * иначе новая таблица однажды тихо останется с прежним владельцем. */
$moved = 0;
foreach (all("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'") as $t) {
    $tn = (string) $t['name'];
    if ($tn === 'users') continue;
    $hasUser = false;
    foreach (all("PRAGMA table_info($tn)") as $c) if ($c['name'] === 'user_id') { $hasUser = true; break; }
    if (!$hasUser) continue;
    $n = (int) scalar("SELECT COUNT(*) FROM $tn WHERE user_id=?", [$from]);
    if ($n === 0) continue;
    printf("  %-22s переносится записей: %d\n", $tn, $n);
    if (!$dry) {
        if (isset($dump)) $dump['moved'][$tn] = all("SELECT * FROM $tn WHERE user_id=?", [$from]);
        q("UPDATE $tn SET user_id=? WHERE user_id=?", [$to, $from]);
    }
    $moved += $n;
}
printf("\nВсего записей к переносу: %d\n", $moved);

/* Недостающее в основном добираем из донора: имя, аватар, привязка ВК,
 * телефон. Заполненное в основном НЕ перетираем — там подтверждённая почта. */
$fill = [];
foreach (['full_name', 'avatar', 'vk_id', 'phone', 'telegram_id', 'city'] as $k) {
    if (!array_key_exists($k, $uTo)) continue;
    $cur = trim((string) ($uTo[$k] ?? ''));
    $don = trim((string) ($uFrom[$k] ?? ''));
    if ($cur === '' && $don !== '') $fill[$k] = $don;
}
if ($fill) {
    echo "Добирается в основной: " . implode(', ', array_keys($fill)) . "\n";
    if (!$dry) update('users', $fill, 'id=:id', ['id' => $to]);
}

/* Донор закрывается. Привязку ВК с него снимаем: она уехала в основной, а
 * оставленная здесь снова разведёт входы по двум кабинетам. */
if (!$dry) {
    $close = ['blocked' => 1];
    if (array_key_exists('vk_id', $uFrom))      $close['vk_id'] = null;
    if (array_key_exists('telegram_id', $uFrom)) $close['telegram_id'] = null;
    if (array_key_exists('full_name', $uFrom))
        $close['full_name'] = trim('Слит в #' . $to . ' ' . (string) ($uFrom['full_name'] ?? ''));
    update('users', $close, 'id=:id', ['id' => $from]);

    $file = BASE_PATH . '/data/user_merge_' . $from . '_to_' . $to . '_' . date('Ymd_His') . '.json';
    @file_put_contents($file, json_encode($dump, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
    echo "Слепок до слияния: " . basename($file) . "\n";
    if (function_exists('audit')) audit('user_merge', 'user', $to, ['from' => $from, 'moved' => $moved]);
    echo "Готово: аккаунт #$from закрыт, всё переведено на #$to.\n";
} else {
    echo "(сухой прогон — ничего не изменено)\n";
}
