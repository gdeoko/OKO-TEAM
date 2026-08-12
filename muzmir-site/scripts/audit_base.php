<?php
/**
 * АУДИТ ПОДПИСНОЙ БАЗЫ — только чтение, ничего не меняет.
 *
 * Задача: понять, какая часть базы реально доставляема, а какая жжёт квоту и
 * репутацию отправителя. Перед запуском это важнее всего: почтовые провайдеры
 * (Gmail, Mail.ru, Яндекс) смотрят на долю отказов. Если в рассылке >2-3%
 * несуществующих адресов — домен отправителя улетает в спам целиком, вместе
 * с живой частью базы.
 *
 * ЧЕМ ПРОВЕРЯЕМ (и чем осознанно НЕ проверяем):
 *   1. Синтаксис (RFC) — мгновенно, бесплатно, без ложных срабатываний.
 *   2. MX-запись домена — есть ли у домена почтовый сервер вообще. Проверяем
 *      УНИКАЛЬНЫЕ домены (их ~сотни на 9 тысяч адресов), а не каждый адрес.
 *      Нет MX и нет A — почта на домен физически недоставляема.
 *   3. Домены-опечатки (gmail.ru, mai.ru, yndex.ru…) — их владельцы обычно
 *      несуществующие, при этом такие адреса дают гарантированный отказ.
 *   4. Ролевые адреса (info@, admin@, noreply@) — читаются редко, жалобы чаще.
 *   5. Одноразовая почта (10minutemail и подобные) — мертва по определению.
 *   6. Дубли: точные невозможны (email UNIQUE), но ловим регистр и
 *      gmail-алиасы (точки в локальной части и +тег — это один ящик).
 *   7. Своя история отказов — тег 'bounced' от cron/process_bounces.php.
 *
 * ЧЕГО НЕ ДЕЛАЕМ НАМЕРЕННО: SMTP-проба каждого ящика (RCPT TO). Крупные
 * провайдеры на неё либо всегда отвечают «ок» (catch-all), либо считают
 * перебором адресов и штрафуют IP отправителя. Перед запуском это ровно тот
 * риск, ради снижения которого базу и чистят.
 *
 * Запуск: php scripts/audit_base.php [--json=/путь/файл.json]
 */
declare(strict_types=1);

define('BASE_PATH', dirname(__DIR__));
$GLOBALS['CFG'] = require BASE_PATH . '/config.php';
foreach (['db', 'helpers'] as $m) require_once BASE_PATH . '/core/' . $m . '.php';

$jsonOut = '';
foreach ($argv as $a) if (str_starts_with($a, '--json=')) $jsonOut = substr($a, 7);

/* ──────────────── Справочники ──────────────── */

// Домены-опечатки → что человек имел в виду. Почта на них не доставляется.
const TYPO_DOMAINS = [
    'gmail.ru' => 'gmail.com', 'gmai.com' => 'gmail.com', 'gmial.com' => 'gmail.com',
    'gmsil.com' => 'gmail.com', 'qmail.com' => 'gmail.com', 'gmail.con' => 'gmail.com',
    'gmail.co' => 'gmail.com', 'gmaill.com' => 'gmail.com', 'gmail.cim' => 'gmail.com',
    'mai.ru' => 'mail.ru', 'maul.ru' => 'mail.ru', 'mail.ri' => 'mail.ru',
    'mali.ru' => 'mail.ru', 'nail.ru' => 'mail.ru', 'mail.ru.ru' => 'mail.ru',
    'mail.rru' => 'mail.ru', 'meil.ru' => 'mail.ru', 'mail.tu' => 'mail.ru',
    'yndex.ru' => 'yandex.ru', 'yandex.ry' => 'yandex.ru', 'yanex.ru' => 'yandex.ru',
    'yandeks.ru' => 'yandex.ru', 'yandex.tu' => 'yandex.ru', 'yamdex.ru' => 'yandex.ru',
    'rambler.ry' => 'rambler.ru', 'bk.ry' => 'bk.ru', 'inbox.ry' => 'inbox.ru',
    'icloud.ru' => 'icloud.com', 'iclod.com' => 'icloud.com',
];

// Домены одноразовой почты — живут минуты.
const DISPOSABLE = [
    'mailinator.com', '10minutemail.com', 'guerrillamail.com', 'tempmail.com',
    'temp-mail.org', 'throwaway.email', 'yopmail.com', 'trashmail.com',
    'fakeinbox.com', 'sharklasers.com', 'getnada.com', 'maildrop.cc',
    'dropmail.me', 'tempmail.ru', 'temp-mail.ru', 'mailforspam.com',
];

// Ролевые локальные части: пишут на них редко, отписываются и жалуются — часто.
const ROLE_LOCALS = [
    'info', 'admin', 'administrator', 'support', 'noreply', 'no-reply', 'donotreply',
    'postmaster', 'webmaster', 'abuse', 'sales', 'office', 'mail', 'test', 'root',
    'contact', 'help', 'service', 'director', 'buh', 'secretary', 'reception',
];

// Домены, у которых нет пользовательской почты (соцсети/сайты).
const NOT_MAIL_DOMAINS = ['vk.com', 'ok.ru', 'vk.ru', 'instagram.com', 'facebook.com', 't.me', 'telegram.org'];

/* ──────────────── Утилиты ──────────────── */

/** Нормализация для поиска дублей-алиасов (gmail: точки и +тег — один ящик). */
function norm_email(string $e): string {
    $e = mb_strtolower(trim($e));
    $at = strrpos($e, '@');
    if ($at === false) return $e;
    $loc = substr($e, 0, $at);
    $dom = substr($e, $at + 1);
    // +тег отбрасывают все крупные провайдеры
    if (($p = strpos($loc, '+')) !== false) $loc = substr($loc, 0, $p);
    // точки в локальной части игнорирует Gmail (и только он)
    if (in_array($dom, ['gmail.com', 'googlemail.com'], true)) $loc = str_replace('.', '', $loc);
    // яндексовые домены — синонимы одного ящика
    if (in_array($dom, ['ya.ru', 'yandex.by', 'yandex.kz', 'yandex.com', 'yandex.ua'], true)) $dom = 'yandex.ru';
    return $loc . '@' . $dom;
}

/** Есть ли у домена почтовый сервер: MX, при отсутствии — A (RFC-фолбэк). */
function domain_deliverable(string $dom): array {
    if (function_exists('checkdnsrr')) {
        if (@checkdnsrr($dom, 'MX')) return ['ok' => true, 'via' => 'MX'];
        if (@checkdnsrr($dom, 'A'))  return ['ok' => true, 'via' => 'A'];
        return ['ok' => false, 'via' => 'нет MX и нет A'];
    }
    return ['ok' => true, 'via' => 'DNS недоступен — считаем живым'];
}

/* ──────────────── Загрузка ──────────────── */

$rows = all("SELECT id, email, name, source, tags, active, created_at FROM subscribers ORDER BY id");
$total = count($rows);
echo "БАЗА: $total подписчиков\n";
echo str_repeat('=', 74) . "\n\n";

/* ──────────────── Проход 1: разбор адресов ──────────────── */

$byDomain = [];
$byNorm   = [];
$flags    = [];   // id → список причин

foreach ($rows as $r) {
    $id    = (int) $r['id'];
    $email = trim((string) $r['email']);
    $low   = mb_strtolower($email);
    $tags  = (string) ($r['tags'] ?? '');
    $why   = [];

    $at  = strrpos($low, '@');
    $dom = $at !== false ? substr($low, $at + 1) : '';
    $loc = $at !== false ? substr($low, 0, $at)  : $low;

    if (!filter_var($email, FILTER_VALIDATE_EMAIL))       $why[] = 'синтаксис';
    if ($dom === '' || !str_contains($dom, '.'))          $why[] = 'нет домена';
    if (isset(TYPO_DOMAINS[$dom]))                        $why[] = 'опечатка домена → ' . TYPO_DOMAINS[$dom];
    if (in_array($dom, DISPOSABLE, true))                 $why[] = 'одноразовая почта';
    if (in_array($dom, NOT_MAIL_DOMAINS, true))           $why[] = 'домен без почты';
    if (in_array($loc, ROLE_LOCALS, true))                $why[] = 'ролевой адрес';
    if (str_contains($tags, 'bounced'))                   $why[] = 'история отказов';
    if ($email !== $low)                                  $why[] = 'верхний регистр';

    if ($dom !== '') $byDomain[$dom][] = $id;
    $byNorm[norm_email($low)][] = ['id' => $id, 'email' => $email, 'active' => (int) $r['active'], 'created' => (string) $r['created_at']];
    if ($why) $flags[$id] = ['email' => $email, 'why' => $why, 'active' => (int) $r['active']];
}

/* ──────────────── Проход 2: MX по уникальным доменам ──────────────── */

$domains = array_keys($byDomain);
sort($domains);
echo "Уникальных доменов: " . count($domains) . " — проверяю MX...\n";

$deadDomains = [];
$t0 = microtime(true);
foreach ($domains as $i => $d) {
    $res = domain_deliverable($d);
    if (!$res['ok']) $deadDomains[$d] = count($byDomain[$d]);
    if (($i + 1) % 50 === 0) echo "  ...проверено " . ($i + 1) . "/" . count($domains) . "\n";
}
printf("MX-проверка заняла %.1f с. Мёртвых доменов: %d\n\n", microtime(true) - $t0, count($deadDomains));

foreach ($deadDomains as $d => $n) {
    foreach ($byDomain[$d] as $id) {
        $flags[$id]['email'] = $flags[$id]['email'] ?? '';
        $flags[$id]['why'][] = 'домен без MX';
    }
}
// добираем email/active для тех, кто попал сюда впервые
foreach ($rows as $r) {
    $id = (int) $r['id'];
    if (isset($flags[$id]) && ($flags[$id]['email'] ?? '') === '') {
        $flags[$id]['email']  = (string) $r['email'];
        $flags[$id]['active'] = (int) $r['active'];
    }
}

/* ──────────────── Отчёт ──────────────── */

echo "=== МЁРТВЫЕ ДОМЕНЫ (нет MX и нет A) ===\n";
if (!$deadDomains) echo "  нет\n";
arsort($deadDomains);
foreach ($deadDomains as $d => $n) printf("  %-34s %5d адресов\n", $d, $n);

echo "\n=== ДУБЛИ-АЛИАСЫ (один реальный ящик, несколько записей) ===\n";
$dupGroups = array_filter($byNorm, fn($g) => count($g) > 1);
if (!$dupGroups) echo "  нет\n";
$dupExtra = 0;
foreach ($dupGroups as $norm => $g) {
    $dupExtra += count($g) - 1;
    echo "  $norm:\n";
    foreach ($g as $x) printf("     #%-7d %-46s active=%d  %s\n", $x['id'], $x['email'], $x['active'], $x['created']);
}
echo "  Лишних записей из-за алиасов: $dupExtra\n";

echo "\n=== СВОДКА ПО ПРИЧИНАМ ===\n";
$byReason = [];
foreach ($flags as $id => $f) foreach (array_unique($f['why']) as $w) {
    $key = preg_replace('~ → .*$~u', '', $w);
    $byReason[$key][] = $id;
}
arsort($byReason);
uasort($byReason, fn($a, $b) => count($b) <=> count($a));
foreach ($byReason as $w => $ids) printf("  %-28s %5d\n", $w, count($ids));

$flaggedActive = array_filter($flags, fn($f) => (int) $f['active'] === 1);
echo "\nВсего проблемных записей: " . count($flags) . " (из них активных: " . count($flaggedActive) . ")\n";
echo "Останется активных после чистки: " . (
    (int) scalar("SELECT COUNT(*) FROM subscribers WHERE active=1") - count($flaggedActive)
) . "\n";

/* ──────────────── Пересечение с users ──────────────── */

echo "\n=== ПЕРЕСЕЧЕНИЕ subscribers ↔ users ===\n";
$inBoth = (int) scalar("SELECT COUNT(*) FROM subscribers s JOIN users u ON lower(u.email)=lower(s.email)");
$onlySub = (int) scalar("SELECT COUNT(*) FROM subscribers s LEFT JOIN users u ON lower(u.email)=lower(s.email) WHERE u.id IS NULL");
$onlyUsr = (int) scalar("SELECT COUNT(*) FROM users u LEFT JOIN subscribers s ON lower(s.email)=lower(u.email) WHERE s.id IS NULL AND COALESCE(u.email,'')<>''");
echo "  и там и там: $inBoth\n  только в subscribers: $onlySub\n  только в users: $onlyUsr\n";

/* ──────────────── Выгрузка для чистки ──────────────── */

if ($jsonOut !== '') {
    $payload = [
        'generated_at'  => date('c'),
        'total'         => $total,
        'dead_domains'  => $deadDomains,
        'dup_groups'    => array_map(fn($g) => array_column($g, 'id'), $dupGroups),
        'flagged'       => $flags,
    ];
    file_put_contents($jsonOut, json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
    echo "\nДетальная выгрузка: $jsonOut\n";
}
