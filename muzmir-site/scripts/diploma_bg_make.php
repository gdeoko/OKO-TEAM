<?php
/**
 * ФОН ДИПЛОМА A4 В СТИЛЕ АФИШИ КОНКУРСА.
 *
 *   php scripts/diploma_bg_make.php <id конкурса> [--dry]
 *
 * Афиша и диплом одного конкурса должны выглядеть роднёй: человек видит афишу в
 * письме, подаёт заявку и через неделю получает диплом — если это два разных
 * мира по цвету и духу, диплом читается как чужой бланк. Поэтому фон диплома
 * берёт ту же тему оформления и ту же сцену, что и афиша (core/afisha_prompt.php),
 * только в вертикальном A4 и БЕЗ ЕДИНОЙ БУКВЫ.
 *
 * Текста здесь не просим намеренно, в отличие от афиши: на дипломе всё пишет
 * движок бланка (core/diploma_html.php) — имя участника, звание, номер, подписи
 * и печать. Любая буква, нарисованная нейросетью, окажется под настоящим
 * текстом и превратит документ в мусор.
 *
 * Главное требование к такому фону — ПУСТАЯ СЕРЕДИНА. Диплом печатает поверх
 * длинные строки с фамилиями, и если в центре листа окажется золотой вензель
 * или яркий блик, читать станет нечего.
 */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { fwrite(STDERR, "CLI only\n"); exit(1); }

define('BASE_PATH', dirname(__DIR__));
$GLOBALS['CFG'] = require BASE_PATH . '/config.php';
require_once BASE_PATH . '/core/db.php';
require_once BASE_PATH . '/core/helpers.php';
require_once BASE_PATH . '/core/afisha_prompt.php';

$cid = (int) ($argv[1] ?? 0);
$dry = in_array('--dry', $argv, true);
if ($cid <= 0) { fwrite(STDERR, "Укажите id конкурса\n"); exit(1); }

$c = one("SELECT * FROM competitions WHERE id=?", [$cid]);
if (!$c) { fwrite(STDERR, "Конкурс #$cid не найден\n"); exit(1); }

$t     = afisha_theme_for($c);
$scene = afisha_scene_for((string) ($c['name'] ?? ''));
$pal   = afisha_palette_for($t);

$prompt = <<<PROMPT
Create a vertical A4 BACKGROUND PLATE for an official award diploma, portrait orientation, aspect ratio exactly 1:1.414 (210 by 297 millimetres), resolution as high as possible.

THIS IS A BACKGROUND ONLY. Absolutely NO text, NO letters, NO numbers, NO words, NO logos, NO emblems, NO coats of arms, NO seals, NO stamps, NO signatures, NO watermarks, NO frames containing writing. Every character of the diploma will be printed over this plate later, and any letter drawn here would end up underneath real text and ruin the document.

SUBJECT AND MOOD. The diploma belongs to the competition «{$c['name']}». Echo its visual world quietly, as a distant backdrop: {$scene}. Everything must be restrained and secondary — this is the paper the award is printed on, not an illustration competing with it. Solemn, prestigious, ceremonial.

CRITICAL EMPTY CENTRE. The central area of the sheet — from 12 to 88 percent of the width and from 18 to 82 percent of the height — must be almost EMPTY: a smooth, evenly lit field with only the faintest texture. No objects, no figures, no ornaments, no bright highlights, no strong colour shifts anywhere in this zone. Long lines of names and titles will be printed across it and must stay perfectly readable. Keep contrast in this central zone LOW and the tone EVEN.

WHERE THE DECORATION LIVES. All ornament belongs to the margins: a decorative border running around the sheet inset about 4 percent from the edges, richer ornamental corners, and a soft decorative accent along the top edge and the bottom edge only. The decoration should fade gently toward the centre rather than stopping abruptly.

MATERIALS AND TEXTURE. Fine art paper with a subtle natural grain. Ornament in polished gold with a soft satin sheen and gentle patina in the recesses, never mirror-bright. If a deeper field is used, it must read as smooth velvet or evenly toned card stock, not as a photograph.

LIGHT. Soft, wide, diffuse illumination from above, even across the whole sheet, with only a gentle darkening in the extreme outer 5 percent. No spotlights, no lens flares, no light shafts crossing the centre, no strong vignette.

LENS AND GEOMETRY. Straight-on flat view, as if scanning a printed sheet. Perfectly symmetrical left to right. No perspective, no tilt, no depth-of-field blur, no drop shadows implying a floating object.

COLOUR PALETTE, exact values: {$pal[0]}; {$pal[1]}; {$pal[2]}. Keep the whole plate within this family. The central field must stay light enough for dark text or dark enough for light text, but uniformly so — no gradients that flip from light to dark across the middle of the sheet.

QUALITY. 8K, ultra sharp ornamental detail at the margins, perfectly clean and even centre, no banding in gradients, no noise, no compression artefacts, commercial print quality, flawless symmetry.

REMEMBER: not a single letter, digit, emblem or seal anywhere on the plate, and the centre stays calm and empty.
PROMPT;

echo "Конкурс: {$c['name']}\n";
echo "Тема: {$t['name']}, промпт ", mb_strlen($prompt), " знаков\n";
if ($dry) { echo "\n----- ПРОМПТ -----\n$prompt\n"; exit(0); }

$poster = rtrim((string) cfgv('poster_url'), '/');
$token  = (string) cfgv('poster_token');
$sshPas = (string) cfgv('vps_ssh_pass');
if ($poster === '' || $token === '' || $sshPas === '') {
    fwrite(STDERR, "Нет доступов к бастиону\n"); exit(1);
}

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
    return is_array($d) && array_key_exists('stdout', $d) ? trim((string) $d['stdout']) : $r;
};

$dirRel = 'uploads/comp/' . $cid;
$dirAbs = BASE_PATH . '/public/' . $dirRel;
if (!is_dir($dirAbs)) @mkdir($dirAbs, 0775, true);

$tag = 'dipbg_' . $cid . '_' . substr(bin2hex(random_bytes(3)), 0, 6);
$remote = '/opt/oko-poster/' . $tag . '.png';
$local  = $dirAbs . '/diploma_bg_new.png';

echo "Отправляю промпт…\n";
$bastion('cat > /opt/oko-poster/' . $tag . '.txt <<\'PROMPT_EOF\'' . "\n" . $prompt . "\nPROMPT_EOF\necho ok", 60);
echo "Генерирую фон A4…\n";
$bastion('cd /opt/oko-poster && nohup node gpt_image.mjs ' . $tag . '.txt ' . $remote
       . ' 420 > /tmp/' . $tag . '.log 2>&1 & echo started', 60);

$ready = false;
for ($i = 0; $i < 45; $i++) {
    sleep(10);
    $sz = (int) trim($bastion('stat -c%s ' . escapeshellarg($remote) . ' 2>/dev/null || echo 0', 30));
    if ($sz > 100000) { $ready = true; echo "  готово: ", (int) round($sz / 1024), " КБ\n"; break; }
    if ($i % 6 === 5) echo "  жду… ", ($i + 1) * 10, " с\n";
}
if (!$ready) {
    echo "Не дождался. Лог:\n", $bastion('tail -6 /tmp/' . $tag . '.log', 30), "\n";
    exit(1);
}

echo "Забираю на сайт…\n";
$scp = $bastion('export SSHPASS=' . escapeshellarg($sshPas)
    . '; sshpass -e scp -o StrictHostKeyChecking=no ' . escapeshellarg($remote)
    . ' root@176.124.200.169:' . escapeshellarg($local) . ' && echo COPY_OK', 120);
clearstatcache(true, $local);
if (!str_contains($scp, 'COPY_OK') || !is_file($local)) {
    fwrite(STDERR, "Не удалось забрать фон\n"); exit(1);
}

/* Приводим к размеру листа и в JPEG: диплом печатается в PDF, а PNG на два с
 * половиной мегабайта раздувает каждый бланк и замедляет печать. */
$outRel = $dirRel . '/diploma_bg.jpg';
$outAbs = BASE_PATH . '/public/' . $outRel;
$info = @getimagesize($local);
if ($info && function_exists('imagecreatetruecolor')) {
    $im = @imagecreatefrompng($local);
    if ($im) {
        $W = 1240; $H = 1754;                       // A4 при 150 dpi — хватает под печать
        $sw = imagesx($im); $sh = imagesy($im);
        $out = imagecreatetruecolor($W, $H);
        $k = max($W / $sw, $H / $sh);
        $nw = (int) round($sw * $k); $nh = (int) round($sh * $k);
        imagecopyresampled($out, $im, (int) round(($W - $nw) / 2), (int) round(($H - $nh) / 2),
                           0, 0, $nw, $nh, $sw, $sh);
        imagejpeg($out, $outAbs, 90);
        imagedestroy($im); imagedestroy($out);
        @chmod($outAbs, 0664);
        @unlink($local);
    }
}
clearstatcache(true, $outAbs);
if (!is_file($outAbs)) { fwrite(STDERR, "Фон не сохранился\n"); exit(1); }

q("UPDATE competitions SET diploma_bg=? WHERE id=?", [$outRel, $cid]);
echo "Фон диплома в карточке конкурса: $outRel (", (int) round(filesize($outAbs) / 1024), " КБ)\n";

$bastion('rm -f ' . escapeshellarg($remote) . ' /opt/oko-poster/' . $tag . '.txt', 30);
echo "Готово.\n";
