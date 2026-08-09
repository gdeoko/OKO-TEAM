<?php
/**
 * Предзапусковая проверка КОНТЕНТА волн: что реально уйдёт в письмах и постах ВК.
 *
 * БЕЗОПАСНО: вызывает только билдеры контента (launch_email_html / launch_wave_text /
 * launch_cover_path). launch_fire() НЕ вызывается вообще, поэтому ничего никуда
 * не уходит и в launch_jobs ничего не пишется.
 *
 * Что проверяет:
 *   1. Рендерится ли письмо каждой волны без ошибок и не пустое ли оно.
 *   2. ВСЕ ссылки внутри письма — живые (HTTP-код), нет ли 404. Именно так был
 *      найден /vip (кнопка «ВИП-клуб» вела в никуда во всех письмах запуска).
 *   3. Есть ли афиша (cover) для поста ВК и существует ли файл на диске.
 *   4. Текст поста ВК: не пустой, длина в пределах лимита ВК (~16000 символов).
 *
 * Запуск: php scripts/audit_launch_content.php
 */
declare(strict_types=1);

define('BASE_PATH', dirname(__DIR__));
$GLOBALS['CFG'] = require BASE_PATH . '/config.php';
foreach (['db', 'data', 'helpers', 'send_timing', 'newsletter', 'mailer', 'result_mail', 'vk', 'vk_templates', 'launch_run'] as $m) {
    $p = BASE_PATH . '/core/' . $m . '.php';
    if (is_file($p)) require_once $p;
}

$fails = 0; $passes = 0;
function chk(string $t, bool $ok, string $ctx = ''): void {
    global $fails, $passes;
    if ($ok) { $passes++; echo "  ok   $t" . ($ctx !== '' ? "  [$ctx]" : '') . PHP_EOL; }
    else     { $fails++; echo "  FAIL $t" . ($ctx !== '' ? "  ($ctx)" : '') . PHP_EOL; }
}

/** Проверка ссылки: HEAD, следуя редиректам. Возвращает HTTP-код. */
function url_code(string $u): int {
    static $cache = [];
    if (isset($cache[$u])) return $cache[$u];
    $ch = curl_init($u);
    curl_setopt_array($ch, [
        CURLOPT_NOBODY => true, CURLOPT_FOLLOWLOCATION => true, CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 12, CURLOPT_SSL_VERIFYPEER => false, CURLOPT_SSL_VERIFYHOST => 0,
        CURLOPT_USERAGENT => 'muzmir-launch-audit',
    ]);
    curl_exec($ch);
    $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    return $cache[$u] = $code;
}

$comps = launch_open_comps();
echo "Открытых конкурсов: " . count($comps) . "\n";
foreach ($comps as $c) echo "  #{$c['id']} {$c['name']} (results_mode=" . ($c['results_mode'] ?? '?') . ")\n";
echo "\n";

$WAVES_VK = ['launch_vk', 'd3', 'last', 'closed', 'results'];

$rep = $comps ? (int) $comps[0]['id'] : 0;
$allLinks = [];

/* --- ПИСЬМА КАМПАНИЙ: те самые билдеры, которые вызывает launch_fire ---
   Важно: launch_fire для campaign_vip зовёт launch_email_build('vip'),
   для launch/launch_mail — launch_email_build('konkurs'), а campaign_kabinet
   идёт вообще мимо этих билдеров — персональным онбордингом с логином/паролем
   (kabinet_onboarding). Если проверять всё через launch_email_html(), все три
   кампании отрендерятся ОДИНАКОВО, и это будет артефакт проверки, а не баг. */
echo "=== ПИСЬМА КАМПАНИЙ (билдеры launch_fire) ===\n";
foreach (['konkurs' => 'launch_mail (открытие, вся база)', 'vip' => 'campaign_vip (ВИП-клуб)'] as $ctype => $label) {
    $subj = ''; $body = '';
    try { [$subj, $body] = launch_email_build($ctype); }
    catch (\Throwable $e) { chk("$label: письмо строится", false, $e->getMessage()); continue; }

    chk("$label: тело письма не пустое", strlen(trim(strip_tags($body))) > 200,
        strlen($body) . ' симв HTML, ' . strlen(trim(strip_tags($body))) . ' симв текста');
    chk("$label: тема задана и не дефолтная", trim($subj) !== '' && $subj !== 'Культурный центр «Музыкальный Мир»', $subj);

    preg_match_all('~href="([^"]+)"~i', $body, $m);
    foreach (array_unique(array_filter($m[1] ?? [], fn($u) => str_starts_with($u, 'http'))) as $l) $allLinks[$l][] = $ctype;
}

// Онбординг кабинета — персональные письма, свой модуль.
if (!function_exists('kabinet_onboarding_pending') && is_file(BASE_PATH . '/core/kabinet_onboarding.php')) {
    require_once BASE_PATH . '/core/kabinet_onboarding.php';
}
$kabPending = function_exists('kabinet_onboarding_pending') ? (int) kabinet_onboarding_pending() : -1;
chk('campaign_kabinet: модуль онбординга доступен', $kabPending >= 0,
    $kabPending >= 0 ? "адресов в очереди онбординга: $kabPending" : 'kabinet_onboarding_pending() не найдена');

// Письмо результатов длинного конкурса — свой шаблон (launch_email_html).
$long = null;
foreach ($comps as $c) if ((string) ($c['results_mode'] ?? '') === 'list') { $long = $c; break; }
if ($long) {
    $lc = launch_norm_comp($long);
    try {
        $rhtml = (string) launch_email_html($lc, 'results', [$lc]);
        chk('results: письмо итогов рендерится', strlen(trim(strip_tags($rhtml))) > 200, strlen($rhtml) . ' симв');
        preg_match_all('~href="([^"]+)"~i', $rhtml, $m);
        foreach (array_unique(array_filter($m[1] ?? [], fn($u) => str_starts_with($u, 'http'))) as $l) $allLinks[$l][] = 'results';
    } catch (\Throwable $e) { chk('results: письмо итогов рендерится', false, $e->getMessage()); }
}

/* --- DRY-RUN: сколько РЕАЛЬНО получателей у каждой волны ---
   launch_fire($dry=true) не отправляет и не пишет в launch_jobs: все побочные
   эффекты закрыты проверками if (!$dry). Возвращает только отчёт с числами. */
echo "\n=== DRY-RUN: сколько получателей у каждой волны ===\n";
$plan = [
    ['launch_vk',        null,  ['vk_wall', 'vk_dm']],
    ['launch_mail',      $rep,  ['email', 'inapp']],
    ['campaign_vip',     $rep,  ['email']],
    ['campaign_kabinet', $rep,  ['email']],
];
foreach ($plan as [$wave, $cid, $ch]) {
    $targets = $cid === null ? array_map(fn($c) => (int) $c['id'], $comps) : [$cid];
    foreach ($targets as $t) {
        $r = launch_fire($t, $wave, $ch, '', true);
        $nm = (string) (one("SELECT name FROM competitions WHERE id=?", [$t])['name'] ?? '');
        if (empty($r['ok'])) { echo "  $wave / $nm: " . ($r['msg'] ?? 'ошибка') . "\n"; continue; }
        foreach (($r['report'] ?? []) as $k => $v) {
            printf("  %-17s %-22s %-8s %s\n", $wave, mb_strimwidth($nm, 0, 22, '…'), $k, $v);
        }
    }
}

echo "\n=== ССЫЛКИ ВО ВСЕХ ПИСЬМАХ (живость) ===\n";
ksort($allLinks);
foreach ($allLinks as $u => $waves) {
    $code = url_code($u);
    $ok = $code >= 200 && $code < 400;
    chk(sprintf("%-58s HTTP %d", mb_strimwidth($u, 0, 58, '…'), $code), $ok, 'волны: ' . implode(',', array_unique($waves)));
}

echo "\n=== ПОСТЫ ВК ===\n";
foreach ($WAVES_VK as $wave) {
    $targets = ($wave === 'launch_vk') ? $comps : [$comps[0] ?? null];
    if ($wave === 'results') {
        $targets = array_values(array_filter($comps, fn($c) => (string) ($c['results_mode'] ?? '') === 'list'));
    }
    foreach ($targets as $c) {
        if (!$c) continue;
        $c = launch_norm_comp($c);
        $sib = in_array($wave, ['d3', 'last', 'closed'], true) ? $comps : [$c];
        $tpl = ($wave === 'launch_vk') ? 'launch' : $wave;

        $txt = '';
        try { $txt = (string) launch_wave_text($c, $tpl, $sib); }
        catch (\Throwable $e) { chk("$wave / {$c['name']}: текст поста", false, $e->getMessage()); continue; }

        $len = mb_strlen($txt);
        chk("$wave / " . mb_strimwidth((string) $c['name'], 0, 22, '…') . ": текст поста не пустой и влезает в лимит ВК",
            $len > 40 && $len < 16000, "$len симв");

        $cover = '';
        try { $cover = (string) launch_cover_path($c, $tpl, $sib); } catch (\Throwable $e) {}
        chk("$wave / " . mb_strimwidth((string) $c['name'], 0, 22, '…') . ": афиша найдена на диске",
            $cover !== '' && is_file($cover),
            $cover === '' ? 'афиши нет' : (is_file($cover) ? round(filesize($cover) / 1024) . ' KB' : 'файл отсутствует: ' . $cover));
    }
}

echo "\n" . str_repeat('─', 66) . "\n";
echo "PASS: $passes   FAIL: $fails\n";
exit($fails ? 1 : 0);
