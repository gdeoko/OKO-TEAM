<?php
/**
 * ПРАВКА ГОТОВОЙ КАРТИНКИ: ОСТАВИТЬ ВСЁ, ИЗМЕНИТЬ ОДНО.
 *   php scripts/image_edit.php <путь от public/> "<что изменить по-русски>" [--en "<то же по-английски>"]
 *
 * Пример:
 *   php scripts/image_edit.php uploads/comp/28/afisha.jpg "убрать свечи"
 *
 * Зачем. Афиша и фон диплома рождаются целиком одной генерацией, и переделывать
 * их с нуля из-за одной детали - значит потерять удачную композицию: заново
 * выйдет другой кадр, другой свет, другие пропорции. Здесь готовая картинка
 * отдаётся нейросети как есть, с просьбой изменить ровно одно и не трогать
 * остальное, включая весь русский текст.
 *
 * Результат кладётся на место исходника, прежний файл сохраняется рядом с
 * пометкой .before-<время>, чтобы можно было вернуться.
 */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { fwrite(STDERR, "CLI only\n"); exit(1); }

define('BASE_PATH', dirname(__DIR__));
$GLOBALS['CFG'] = require BASE_PATH . '/config.php';
require_once BASE_PATH . '/core/db.php';
require_once BASE_PATH . '/core/helpers.php';

$rel = trim((string) ($argv[1] ?? ''));
$what = trim((string) ($argv[2] ?? ''));
$en = '';
foreach ($argv as $i => $a) if ($a === '--en') $en = trim((string) ($argv[$i + 1] ?? ''));
if ($rel === '' || $what === '') {
    fwrite(STDERR, "Использование: php scripts/image_edit.php <путь от public/> \"<что изменить>\" [--en \"<по-английски>\"]\n");
    exit(1);
}
$src = BASE_PATH . '/public/' . ltrim($rel, '/');
if (!is_file($src)) { fwrite(STDERR, "Файла нет: $src\n"); exit(1); }

$poster = rtrim((string) cfgv('poster_url'), '/');
$token  = (string) cfgv('poster_token');
if ($poster === '' || $token === '') { fwrite(STDERR, "Нет доступов к бастиону\n"); exit(1); }

$bastion = static function (string $cmd, int $timeout = 150) use ($poster, $token): string {
    $ch = curl_init($poster);
    curl_setopt_array($ch, [
        CURLOPT_POST => true, CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => $timeout,
        CURLOPT_HTTPHEADER => ['Authorization: Bearer ' . $token, 'Content-Type: application/json'],
        CURLOPT_POSTFIELDS => json_encode(['cmd' => $cmd], JSON_UNESCAPED_SLASHES),
    ]);
    $r = curl_exec($ch); curl_close($ch);
    if (!is_string($r) || $r === '') return '';
    $d = json_decode($r, true);
    if (is_array($d) && array_key_exists('stdout', $d)) {
        return trim((string) $d['stdout']) . (trim((string) ($d['stderr'] ?? '')) !== ''
             ? "\n" . trim((string) $d['stderr']) : '');
    }
    return $r;
};

/**
 * ЗАБРАТЬ ФАЙЛ С БАСТИОНА ЦЕЛИКОМ.
 *
 * Мост отдаёт около ста восьмидесяти килобайт за ответ и молча обрезает
 * остальное: картинка приходила короче исходника и открывалась как «данные»,
 * а не как JPEG. Поэтому читаем небольшими блоками и КАЖДЫЙ проверяем по
 * длине - недобравший блок перезапрашиваем. Пустой результат означает, что
 * файл забрать не удалось; вызывающий код обязан это проверить.
 */
function bastion_fetch(callable $bastion, string $remote, int $step = 60000): string {
    $total = (int) trim($bastion('stat -c%s ' . escapeshellarg($remote) . ' 2>/dev/null || echo 0', 30));
    if ($total <= 0) return '';
    $out = '';
    $parts = (int) ceil($total / $step);
    for ($n = 0; $n < $parts; $n++) {
        $need = min($step, $total - $n * $step);
        $bin  = '';
        for ($try = 0; $try < 3; $try++) {
            $part = $bastion('dd if=' . escapeshellarg($remote) . ' bs=' . $step . ' skip=' . $n
                           . ' count=1 2>/dev/null | base64 -w0', 120);
            $bin = base64_decode(preg_replace('~\s+~', '', $part) ?: '', true);
            if ($bin !== false && strlen($bin) >= $need) break;
            $bin = '';
        }
        if ($bin === '') return '';          // блок так и не дошёл целиком
        $out .= $bin;
    }
    return strlen($out) === $total ? $out : '';
}

$tag    = 'edit_' . substr(bin2hex(random_bytes(4)), 0, 8);
$inRem  = '/opt/oko-poster/' . $tag . '.jpg';
$outRem = '/opt/oko-poster/' . $tag . '_out.png';

echo "Правлю: $rel\nЗадача: $what\n";

/* Отправляем исходник на бастион кусками: длинная строка в командную строку не влезает. */
$b64 = base64_encode((string) file_get_contents($src));
$bastion('rm -f ' . $inRem . '.b64', 30);
for ($i = 0; $i < strlen($b64); $i += 60000) {
    $bastion('printf %s ' . escapeshellarg(substr($b64, $i, 60000)) . ' >> ' . $inRem . '.b64', 60);
}
$sz = (int) trim($bastion('base64 -d ' . $inRem . '.b64 > ' . $inRem . ' && rm -f ' . $inRem . '.b64 && stat -c%s ' . $inRem, 60));
if ($sz < 10000) { fwrite(STDERR, "Картинка не долетела ($sz байт)\n"); exit(1); }
echo "Исходник на бастионе: ", (int) round($sz / 1024), " КБ\n";

$task = $en !== '' ? $en : $what;
$prompt = <<<PROMPT
The attached image is a FINISHED design. Edit it and return the SAME image with exactly one change: {$task}.

CRITICAL — KEEP EVERYTHING ELSE IDENTICAL. Do not redraw the image, do not reinterpret it, do not change the composition, the camera angle, the proportions, the colour palette, the lighting, the ornamental frame, the corner ornaments or any decorative element. Every object that is not part of the requested change must stay exactly where it is, at exactly the same size, in exactly the same style.

ALL TEXT MUST SURVIVE UNCHANGED. Every Russian (Cyrillic) line in the image must remain in place, with the same wording, the same spelling, the same font, the same size, the same weight, the same colour and the same position. Do not re-typeset the text, do not translate it, do not correct it, do not move it. If the image contains round emblem discs, keep them exactly as they are.

WHERE THE REMOVED PART WAS, fill the space naturally with the surrounding background — the same texture, the same ornament logic, the same light falloff — so that nothing looks cut out, patched or blurred. The result must look as if the removed element was never there.

Return one image, same aspect ratio, same resolution or higher, 8K quality, ultra sharp, no watermarks, no captions, no extra text of any kind.
PROMPT;

$bastion('cat > /opt/oko-poster/' . $tag . '.txt <<\'PROMPT_EOF\'' . "\n" . $prompt . "\nPROMPT_EOF", 60);

echo "Генерирую…\n";
$bastion('cd /opt/oko-poster && CDP_URL=http://127.0.0.1:9222 nohup node gpt_image2.mjs '
       . $tag . '.txt ' . $outRem . ' 600 ' . $inRem . ' > /tmp/' . $tag . '.log 2>&1 & echo started', 60);

$ready = false;
for ($i = 0; $i < 60; $i++) {
    sleep(10);
    $s = (int) trim($bastion('stat -c%s ' . escapeshellarg($outRem) . ' 2>/dev/null || echo 0', 30));
    if ($s > 100000) { $ready = true; echo "  готово: ", (int) round($s / 1024), " КБ\n"; break; }
    if ($i % 6 === 5) echo "  жду… ", ($i + 1) * 10, " с\n";
}
if (!$ready) {
    echo "Не дождался. Лог бастиона:\n", $bastion('tail -6 /tmp/' . $tag . '.log 2>/dev/null', 30), "\n";
    exit(1);
}

/* Ужимаем на бастионе и забираем блоками по сто килобайт: мост отдаёт около
 * ста восьмидесяти килобайт за ответ, целиком многомегабайтный файл не проходит. */
$jpgRem = $outRem . '.jpg';
$bastion('convert ' . escapeshellarg($outRem) . ' -quality 92 ' . escapeshellarg($jpgRem), 120);
$raw = bastion_fetch($bastion, $jpgRem);
if ($raw === '') { fwrite(STDERR, "Забрать не удалось — файл на месте не тронут\n"); exit(1); }
if (@imagecreatefromstring($raw) === false) {
    fwrite(STDERR, "Пришло не изображение — файл на месте не тронут\n");
    exit(1);
}

$backup = $src . '.before-' . date('Ymd-His');
@copy($src, $backup);
file_put_contents($src, $raw);
@chmod($src, 0664);
echo "Готово: $rel обновлён (прежний — ", basename($backup), ")\n";
$bastion('rm -f ' . $inRem . ' ' . $outRem . ' ' . $jpgRem . ' /opt/oko-poster/' . $tag . '.txt', 30);
