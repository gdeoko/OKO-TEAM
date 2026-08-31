<?php
/**
 * СТУДИЙНЫЙ СНИМОК НАГРАДЫ В СТИЛЕ КОНКУРСА.
 *   php scripts/award_shot_make.php <id конкурса> [cup|statuette|medal|all] [--dry]
 *
 * Зачем. В разделе «Образцы наград» участник видит, что именно он закажет.
 * Фотографии с телефона на скатерти этого не показывают: изделие теряется, свет
 * случайный, фон чужой. Здесь та же награда снимается «как для витрины» - на
 * фоне в стиле афиши и диплома своего конкурса, с постановочным светом.
 *
 * Как. Нейросети отдаётся ФОТО РЕАЛЬНОЙ НАГРАДЫ как образец формы и рельефа, а
 * в промпте описывается сцена того же мира, что у афиши (core/afisha_prompt.php
 * знает его по названию конкурса). Форму изделия менять запрещено: участник
 * получит именно то, что видел.
 *
 * Медаль всегда идёт с лентой-триколором - решение владельца, одинаково для
 * всех конкурсов.
 *
 * Референсы лежат в docs/award_refs/<slug конкурса>/{kubok,statuetka,medal}.jpg
 * Результат: public/assets/img/awards/<id>/{cup,statuette,medal}.jpg (1:1).
 */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { fwrite(STDERR, "CLI only\n"); exit(1); }

define('BASE_PATH', dirname(__DIR__));
$GLOBALS['CFG'] = require BASE_PATH . '/config.php';
require_once BASE_PATH . '/core/db.php';
require_once BASE_PATH . '/core/helpers.php';
require_once BASE_PATH . '/core/afisha_prompt.php';

$cid  = (int) ($argv[1] ?? 0);
$only = (string) ($argv[2] ?? 'all');
$dry  = in_array('--dry', $argv, true);
if ($cid <= 0) { fwrite(STDERR, "Укажите id конкурса\n"); exit(1); }

$c = one("SELECT * FROM competitions WHERE id=?", [$cid]);
if (!$c) { fwrite(STDERR, "Конкурс не найден\n"); exit(1); }

/** Что снимаем: файл референса → имя образца на сайте → описание изделия. */
$KINDS = [
    'cup' => [
        'ref'  => 'kubok.jpg',
        'ru'   => 'кубок',
        'what' => 'an ornate golden trophy cup with sculpted handles on a dark plinth',
    ],
    'statuette' => [
        'ref'  => 'statuetka.jpg',
        'ru'   => 'статуэтка',
        'what' => 'a golden figurine award on a dark plinth',
    ],
    'medal' => [
        'ref'  => 'medal.jpg',
        'ru'   => 'медаль',
        'what' => 'a round golden medal with relief ornament',
    ],
];
if ($only !== 'all' && !isset($KINDS[$only])) { fwrite(STDERR, "Вид: cup|statuette|medal|all\n"); exit(1); }
$todo = $only === 'all' ? array_keys($KINDS) : [$only];

$scene = afisha_scene_for((string) $c['name']);
$pal   = afisha_palette_for(afisha_theme_for($c));

/** Промпт съёмки одной награды. Сцена берётся у афиши — семья должна быть видна. */
$promptFor = static function (string $kind) use ($KINDS, $c, $scene, $pal): string {
    $k = $KINDS[$kind];
    $ribbon = $kind === 'medal'
        ? "RIBBON — MANDATORY. The medal hangs on a wide moire ribbon in the colours of the Russian national "
          . "flag: three equal horizontal stripes, white on top, blue in the middle, red at the bottom, with a "
          . "soft satin sheen and natural folds. The ribbon enters the frame from the top, passes through the "
          . "medal's suspension ring and drapes naturally. Colours exactly: white #FFFFFF, blue #0039A6, "
          . "red #D52B1E. The ribbon must look like real woven fabric, not painted plastic.\n\n"
        : '';

    return <<<PROMPT
Create a single square 1:1 product photograph of an award for a Russian cultural competition. The attached image is the REAL award — reproduce its shape, proportions, ornament and relief EXACTLY as shown, down to the pattern on the surface. Do not redesign it, do not add or remove decorative elements, do not change the number of handles, do not alter the base. The only things you change are the background, the lighting and the photographic quality.

THE OBJECT: {$k['what']}, rendered in warm polished gold with a satin sheen, gentle patina in the recesses and crisp highlights on the edges. The metal must read as real cast metal, not plastic — visible micro-texture, soft reflections, no flat colour fills.

{$ribbon}THE SCENE. The award stands in the visual world of the competition «{$c['name']}»: {$scene}. Keep the scene BEHIND the award, softly out of focus, as a rich atmospheric backdrop — it must support the object, never compete with it. The award is the sole hero of the frame, centred, occupying roughly 70 percent of the image height, complete and never cropped.

SURFACE AND SPACE. The award rests on a polished dark surface with a soft reflection beneath it, or on deep velvet with visible pile. Behind it the scene falls away into rich shadow with a gentle warm glow, giving depth. Floating golden dust particles catch the light. No table edges, no household objects, no fabric with flower prints, no domestic interior of any kind.

LIGHT. Studio product lighting: a large soft key light from the upper front left, a cooler rim light from the back right separating the object from the background, and a subtle fill from below to open the shadows. Highlights must follow the real geometry of the object — long soft speculars along the curves, small bright accents on the raised ornament. No harsh flash, no blown-out hotspots, no double shadows.

LENS AND RENDERING. As if photographed with a 100mm macro lens at f/8 on a full-frame camera: the award is razor-sharp from front to back, the background gently blurred. Straight-on eye-level view, perfectly upright, no tilt, no wide-angle distortion, no motion blur.

COLOUR PALETTE: {$pal[0]}; {$pal[1]}; {$pal[2]}; {$pal[3]}. Warm gold for the object, deep rich tones for the background. No green cast, no magenta, no neon, no modern flat gradients.

QUALITY. 8K, ultra sharp, commercial product photography, catalogue quality, flawless. No text of any kind, no letters, no numerals, no logos, no watermarks, no signatures, no captions, no frames, no borders, no collage, no second copy of the object, no hands, no people.
PROMPT;
};

if ($dry) {
    foreach ($todo as $k) {
        echo "\n===== ", mb_strtoupper($KINDS[$k]['ru']), " =====\n", $promptFor($k), "\n";
    }
    exit(0);
}

$poster = rtrim((string) cfgv('poster_url'), '/');
$token  = (string) cfgv('poster_token');
if ($poster === '' || $token === '') { fwrite(STDERR, "Нет доступов к бастиону\n"); exit(1); }

/** Команда на бастионе; ответ приходит конвертом {"stdout":…}. */
$bastion = static function (string $cmd, int $timeout = 150) use ($poster, $token): string {
    $ch = curl_init($poster);
    curl_setopt_array($ch, [
        CURLOPT_POST => true, CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => $timeout,
        CURLOPT_HTTPHEADER => ['Authorization: Bearer ' . $token, 'Content-Type: application/json'],
        CURLOPT_POSTFIELDS => json_encode(['cmd' => $cmd], JSON_UNESCAPED_SLASHES),
    ]);
    $r = curl_exec($ch);
    curl_close($ch);
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

$slug   = (string) $c['slug'];
$refDir = BASE_PATH . '/docs/award_refs/' . $slug;
$outDir = BASE_PATH . '/public/assets/img/awards/' . $cid;
if (!is_dir($outDir)) @mkdir($outDir, 0775, true);

echo "Конкурс: {$c['name']} (#{$cid})\n";

foreach ($todo as $kind) {
    $k   = $KINDS[$kind];
    $ref = $refDir . '/' . $k['ref'];
    if (!is_file($ref)) { echo "  {$k['ru']}: нет референса {$ref} — пропуск\n"; continue; }

    $tag    = 'award_' . $cid . '_' . $kind . '_' . substr(bin2hex(random_bytes(3)), 0, 6);
    $refRem = '/opt/oko-poster/' . $tag . '.jpg';
    $outRem = '/opt/oko-poster/' . $tag . '.png';

    echo "  {$k['ru']}: отправляю образец…\n";
    // Файл кладём на бастион по частям: длинная строка в командную строку не влезает.
    $b64   = base64_encode((string) file_get_contents($ref));
    $chunk = 60000;
    $bastion('rm -f ' . $refRem . '.b64', 30);
    for ($i = 0; $i < strlen($b64); $i += $chunk) {
        $bastion('printf %s ' . escapeshellarg(substr($b64, $i, $chunk)) . ' >> ' . $refRem . '.b64', 60);
    }
    $sz = (int) trim($bastion('base64 -d ' . $refRem . '.b64 > ' . $refRem . ' && rm -f ' . $refRem . '.b64 && stat -c%s ' . $refRem, 60));
    if ($sz < 5000) { echo "    образец не долетел ({$sz} байт) — пропуск\n"; continue; }
    echo "    образец на месте: ", (int) round($sz / 1024), " КБ\n";

    $prompt = $promptFor($kind);
    $bastion('cat > /opt/oko-poster/' . $tag . '.txt <<\'PROMPT_EOF\'' . "\n" . $prompt . "\nPROMPT_EOF", 60);

    echo "    генерирую…\n";
    $bastion('cd /opt/oko-poster && CDP_URL=http://127.0.0.1:9222 nohup node gpt_image2.mjs '
           . $tag . '.txt ' . $outRem . ' 600 ' . $refRem
           . ' > /tmp/' . $tag . '.log 2>&1 & echo started', 60);

    $ready = false;
    for ($i = 0; $i < 60; $i++) {
        sleep(10);
        $s = (int) trim($bastion('stat -c%s ' . escapeshellarg($outRem) . ' 2>/dev/null || echo 0', 30));
        if ($s > 100000) { $ready = true; echo "    готово: ", (int) round($s / 1024), " КБ\n"; break; }
        if ($i % 6 === 5) echo "    жду… ", ($i + 1) * 10, " с\n";
    }
    if (!$ready) {
        echo "    не дождался. Лог бастиона:\n";
        echo "    ", str_replace("\n", "\n    ", $bastion('tail -6 /tmp/' . $tag . '.log 2>/dev/null', 30)), "\n";
        continue;
    }

    /* УЖИМАЕМ НА БАСТИОНЕ, ПОТОМ ЗАБИРАЕМ.
     *
     * Сырая картинка весит два-три мегабайта, в base64 вчетверо больше, и мост
     * такой ответ обрывает: приходило восемьсот килобайт из двух с половиной
     * мегабайт. На бастионе есть ImageMagick — там же приводим снимок к
     * квадрату 1400×1400 и качеству 90: для карточки образца этого с запасом,
     * а файл становится в разы легче и доезжает целиком. */
    $jpgRem = $outRem . '.sq.jpg';
    $bastion('convert ' . escapeshellarg($outRem)
           . ' -gravity center -crop 1:1 +repage -resize 1100x1100 -quality 88 '
           . escapeshellarg($jpgRem), 120);
    $sqSize = (int) trim($bastion('stat -c%s ' . escapeshellarg($jpgRem) . ' 2>/dev/null || echo 0', 30));
    if ($sqSize > 20000) { $outRem = $jpgRem; echo "    ужато до ", (int) round($sqSize / 1024), " КБ\n"; }

    $raw = bastion_fetch($bastion, $outRem);
    if ($raw === '') { echo "    забрать не удалось — картинка осталась на бастионе\n"; continue; }

    $tmp = $outDir . '/' . $kind . '_raw.png';
    file_put_contents($tmp, $raw);

    $img = @imagecreatefromstring($raw);
    if ($img) {
        $w = imagesx($img); $h = imagesy($img);
        $side = min($w, $h);
        $sq = imagecreatetruecolor($side, $side);
        imagecopyresampled($sq, $img, 0, 0, (int) (($w - $side) / 2), (int) (($h - $side) / 2), $side, $side, $side, $side);
        imagejpeg($sq, $outDir . '/' . $kind . '.jpg', 92);
        imagedestroy($sq); imagedestroy($img);
        @unlink($tmp);
        echo "    образец: assets/img/awards/{$cid}/{$kind}.jpg\n";
    } else {
        @rename($tmp, $outDir . '/' . $kind . '.jpg');
        echo "    образец сохранён без обрезки\n";
    }
    $bastion('rm -f ' . $refRem . ' ' . $outRem . ' ' . $outRem . '.sq.jpg /opt/oko-poster/' . $tag . '.txt', 30);
}
echo "Готово.\n";
