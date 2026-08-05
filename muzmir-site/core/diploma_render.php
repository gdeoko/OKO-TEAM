<?php
/**
 * core/diploma_render.php — боевой PDF диплома из HTML-шаблона (core/diploma_html.php).
 *
 * На VPS нет Chromium, поэтому печатает бастион oko-poster (Playwright):
 *   1) сайт отдаёт приватную страницу /diploma-render/{application_id}?key=...
 *      (ключ — settings.diploma_render_key, создаётся при первом обращении);
 *   2) бастион открывает её headless-Chromium'ом, печатает в PDF (A4, фон включён)
 *      и кладёт файл обратно на VPS по scp;
 *   3) diploma_pdf_html() возвращает локальный путь к готовому PDF или null —
 *      тогда вызывающий код падает на старый GD-генератор pdf_diploma().
 *
 * Требует в config.local.php: MUZMIR_POSTER_URL, MUZMIR_POSTER_TOKEN,
 * MUZMIR_VPS_SSH_PASS (пароль этого же VPS — для scp с бастиона обратно).
 */
declare(strict_types=1);

/** Ключ доступа к приватному роуту рендера (генерируется один раз). */
function diploma_render_key(): string {
    $k = (string) setting('diploma_render_key', '');
    if ($k === '') {
        $k = bin2hex(random_bytes(24));
        set_setting('diploma_render_key', $k);
    }
    return $k;
}

/**
 * Рендерит боевой PDF по HTML-шаблону. $opt: thanks => благодарность.
 * Возвращает абсолютный путь к PDF в public/diplomas/ или null при неудаче.
 */
function diploma_pdf_html(array $app, array $opt = []): ?string {
    $poster = rtrim((string) cfgv('poster_url'), '/');
    $token  = (string) cfgv('poster_token');
    $sshPas = (string) cfgv('vps_ssh_pass');
    $appId  = (int) ($app['id'] ?? 0);
    if ($poster === '' || $token === '' || $sshPas === '' || $appId <= 0) return null;

    $type = !empty($opt['thanks']) ? 'thanks' : (!empty($opt['extra']) ? 'extra' : 'main');
    $url  = rtrim((string) cfgv('base_url'), '/') . '/diploma-render/' . $appId
          . '?key=' . diploma_render_key() . ($type !== 'main' ? '&type=' . $type : '');

    $num  = (string) ($app['number'] ?? ('APP' . $appId));
    $slug = trim(strtolower((string) preg_replace('/[^a-z0-9]+/i', '-', $num . '-' . $type)), '-');
    $outDir = BASE_PATH . '/public/diplomas/';
    if (!is_dir($outDir)) @mkdir($outDir, 0775, true);
    $out = $outDir . 'diploma_' . $slug . '.pdf';
    @unlink($out);

    $tmp = '/tmp/dip_' . $appId . '_' . substr(bin2hex(random_bytes(4)), 0, 8) . '.pdf';
    $cmd = 'cd /opt/oko-poster && NODE_PATH=/opt/oko-poster/node_modules node render_diploma.js '
         . escapeshellarg($url) . ' ' . escapeshellarg($tmp)
         . ' && export SSHPASS=' . escapeshellarg($sshPas)
         . '; sshpass -e scp -o StrictHostKeyChecking=no ' . escapeshellarg($tmp)
         . ' root@176.124.200.169:' . escapeshellarg($out)
         . ' && rm -f ' . escapeshellarg($tmp) . ' && echo RENDER_OK';

    $ch = curl_init($poster);
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 120,
        CURLOPT_HTTPHEADER => ['Authorization: Bearer ' . $token, 'Content-Type: application/json'],
        CURLOPT_POSTFIELDS => json_encode(['cmd' => $cmd], JSON_UNESCAPED_SLASHES),
    ]);
    $resp = curl_exec($ch);
    curl_close($ch);
    if (!is_string($resp) || !str_contains($resp, 'RENDER_OK')) {
        error_log('diploma_pdf_html(' . $appId . '): bastion render failed: ' . substr((string)$resp, 0, 300));
        return null;
    }
    clearstatcache(true, $out);
    return (is_file($out) && filesize($out) > 20000) ? $out : null;
}
