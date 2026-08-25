<?php
/**
 * core/afisha_render.php — готовая картинка афиши из HTML-эталона.
 *
 * На этом VPS нет Chromium, поэтому снимок делает бастион oko-poster — тем же
 * путём, которым уже печатаются дипломы (core/diploma_render.php):
 *   1) сайт отдаёт приватную страницу /afisha-render/{id}?key=…
 *   2) бастион открывает её headless-браузером, снимает JPEG и кладёт обратно
 *      по scp в public/uploads/comp/{id}/
 *
 * ПОЧЕМУ АФИША СОБИРАЕТСЯ, А НЕ ГЕНЕРИРУЕТСЯ ЦЕЛИКОМ. Нейросеть отлично рисует
 * фон и никуда не годится в тексте: строка про регистрацию Роскомнадзора выходит
 * набором похожих букв, а гербы министерств — выдуманными золотыми кругляшами.
 * Афишу с такими гербами нельзя отправить ни в школу, ни в отдел культуры.
 * Поэтому нейросети достаётся фон, а всё, что должно быть точным, кладётся
 * поверх слоем (core/afisha_html.php).
 *
 * afisha_render(array $c, array $opt): ?string — путь к готовому файлу или null.
 */
declare(strict_types=1);

require_once __DIR__ . '/afisha_html.php';

/**
 * Снимает афишу и кладёт в public/uploads/comp/{id}/afisha.jpg.
 *
 * @param array $opt bg — фон (public-relative), out — имя файла (по умолчанию afisha.jpg)
 * @return string|null public-relative путь готового файла
 */
function afisha_render(array $c, array $opt = []): ?string {
    $poster = rtrim((string) cfgv('poster_url'), '/');
    $token  = (string) cfgv('poster_token');
    $sshPas = (string) cfgv('vps_ssh_pass');
    $cid    = (int) ($c['id'] ?? 0);
    if ($poster === '' || $token === '' || $sshPas === '' || $cid <= 0) {
        error_log('afisha_render: нет доступов к бастиону или конкурс не задан');
        return null;
    }

    if (!function_exists('diploma_render_key')) require_once BASE_PATH . '/core/diploma_render.php';

    $bg  = trim((string) ($opt['bg'] ?? ''));
    $url = rtrim((string) cfgv('base_url'), '/') . '/afisha-render/' . $cid
         . '?key=' . diploma_render_key()
         . ($bg !== '' ? '&bg=' . rawurlencode($bg) : '');

    $file   = trim((string) ($opt['out'] ?? 'afisha.jpg'));
    if (!preg_match('~^[a-z0-9_.-]+\.jpg$~i', $file)) $file = 'afisha.jpg';
    $dirRel = 'uploads/comp/' . $cid;
    $dirAbs = BASE_PATH . '/public/' . $dirRel;
    if (!is_dir($dirAbs)) @mkdir($dirAbs, 0775, true);

    $out = $dirAbs . '/' . $file;
    /* Пишем рядом и подменяем только после проверки. Прежняя афиша уже стоит на
     * карточке конкурса и уехала в письма: если бастион не ответит, потерять её
     * ради пустого файла — худшее из возможного. */
    $stage = $out . '.new.jpg';
    @unlink($stage);

    $tmp = '/tmp/afisha_' . $cid . '_' . substr(bin2hex(random_bytes(4)), 0, 8) . '.jpg';
    $cmd = 'cd /opt/oko-poster && NODE_PATH=/opt/oko-poster/node_modules node render_afisha.js '
         . escapeshellarg($url) . ' ' . escapeshellarg($tmp) . ' ' . AFISHA_W . ' ' . AFISHA_H
         . ' && export SSHPASS=' . escapeshellarg($sshPas)
         . '; sshpass -e scp -o StrictHostKeyChecking=no ' . escapeshellarg($tmp)
         . ' root@176.124.200.169:' . escapeshellarg($stage)
         . ' && rm -f ' . escapeshellarg($tmp) . ' && echo AFISHA_OK';

    $ch = curl_init($poster);
    curl_setopt_array($ch, [
        CURLOPT_POST           => true,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 150,
        CURLOPT_HTTPHEADER     => ['Authorization: Bearer ' . $token, 'Content-Type: application/json'],
        CURLOPT_POSTFIELDS     => json_encode(['cmd' => $cmd], JSON_UNESCAPED_SLASHES),
    ]);
    $resp = curl_exec($ch);
    curl_close($ch);

    if (!is_string($resp) || !str_contains($resp, 'AFISHA_OK')) {
        error_log('afisha_render(' . $cid . '): бастион не снял афишу: ' . substr((string) $resp, 0, 300));
        @unlink($stage);
        return null;
    }
    clearstatcache(true, $stage);
    // Пустой или обрезанный снимок бывает, когда страница не успела дорисоваться.
    if (!is_file($stage) || filesize($stage) < 20000) {
        error_log('afisha_render(' . $cid . '): снимок пустой или слишком мал');
        @unlink($stage);
        return null;
    }
    if (!@rename($stage, $out)) { @unlink($stage); return null; }
    @chmod($out, 0664);
    clearstatcache(true, $out);

    return $dirRel . '/' . $file;
}
