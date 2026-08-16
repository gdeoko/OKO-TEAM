<?php
/**
 * СНЯТЬ АФИШИ ПРЕДЛОЖЕНИЙ В PNG 1920×1080.
 *
 * Страница /tests/offer-poster.php рисует афишу партнёрства или клуба в стиле
 * нашего сертификата. Здесь её снимает браузер на бастионе и кладёт готовый
 * PNG на сервер сайта — тем же путём, которым печатаются дипломы и сертификаты.
 *
 * Формат всегда 16:9: и лента ВКонтакте, и предложка, и письма показывают
 * широкую картинку целиком, а квадрат обрезают.
 *
 *   php scripts/make_offer_posters.php            — обе афиши
 *   php scripts/make_offer_posters.php partner    — только партнёрство
 */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { fwrite(STDERR, "CLI only\n"); exit(1); }

define('BASE_PATH', dirname(__DIR__));
$GLOBALS['CFG'] = require BASE_PATH . '/config.php';
require_once BASE_PATH . '/core/db.php';
require_once BASE_PATH . '/core/helpers.php';
require_once BASE_PATH . '/core/diploma_render.php';

$only = (string) ($argv[1] ?? '');
$line = str_repeat('=', 78);

$poster = rtrim((string) cfgv('poster_url'), '/');
$token  = (string) cfgv('poster_token');
$sshPas = (string) cfgv('vps_ssh_pass');
if ($poster === '' || $token === '' || $sshPas === '') { echo "нет доступа к бастиону\n"; exit(1); }

$base = rtrim((string) cfgv('base_url'), '/');
$key  = diploma_render_key();
$dir  = BASE_PATH . '/public/posters';
if (!is_dir($dir)) @mkdir($dir, 0775, true);

echo "АФИШИ ПРЕДЛОЖЕНИЙ\n$line\n";

foreach (['partner', 'club'] as $kind) {
    if ($only !== '' && $only !== $kind) continue;

    $url = $base . '/tests/offer-poster.php?kind=' . $kind . '&key=' . rawurlencode($key);
    $out = $dir . '/offer_' . $kind . '_16x9.png';
    $tmp = '/tmp/offer_' . $kind . '_' . substr(bin2hex(random_bytes(3)), 0, 6) . '.png';

    // Снимок ровно 1920×1080: страница свёрстана под этот размер, поэтому ни
    // прокрутки, ни полей быть не должно.
    $js = 'const {chromium}=require("playwright");(async()=>{'
        . 'const b=await chromium.launch();'
        . 'const p=await (await b.newContext({viewport:{width:1920,height:1080},deviceScaleFactor:1})).newPage();'
        . 'await p.goto(process.argv[2],{waitUntil:"networkidle",timeout:60000});'
        . 'await p.waitForTimeout(2500);'
        . 'await p.screenshot({path:process.argv[3]});'
        . 'await b.close();console.log("SHOT-OK",require("fs").statSync(process.argv[3]).size);})();';

    $cmd = 'cd /opt/oko-poster && cat > /tmp/offer_shot.cjs <<\'EOFJS\'' . "\n" . $js . "\n" . 'EOFJS' . "\n"
         . 'NODE_PATH=/opt/oko-poster/node_modules node /tmp/offer_shot.cjs ' . escapeshellarg($url) . ' ' . escapeshellarg($tmp)
         . ' && export SSHPASS=' . escapeshellarg($sshPas)
         . '; sshpass -e scp -o StrictHostKeyChecking=no ' . escapeshellarg($tmp)
         . ' root@176.124.200.169:' . escapeshellarg($out)
         . ' && rm -f ' . escapeshellarg($tmp) . ' && echo COPY_OK';

    $ch = curl_init($poster);
    curl_setopt_array($ch, [
        CURLOPT_POST => true, CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 180,
        CURLOPT_HTTPHEADER => ['Authorization: Bearer ' . $token, 'Content-Type: application/json'],
        CURLOPT_POSTFIELDS => json_encode(['cmd' => $cmd], JSON_UNESCAPED_SLASHES),
    ]);
    $res = (string) curl_exec($ch);
    curl_close($ch);

    $ok = str_contains($res, 'COPY_OK') && is_file($out);
    printf("  %-8s %s\n", $kind, $ok
        ? 'готово: ' . basename($out) . ', ' . round(filesize($out) / 1024) . ' КБ'
        : 'НЕ СНЯЛОСЬ: ' . mb_substr(trim(preg_replace('~\s+~', ' ', $res) ?? ''), 0, 300));
    if ($ok) @chmod($out, 0664);
}
