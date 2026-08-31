<?php
/**
 * ОБРАЗЦЫ ДИПЛОМОВ ДЛЯ ВИТРИНЫ «ОБРАЗЦЫ НАГРАД».
 *   php scripts/diploma_samples_make.php <id конкурса>
 *
 * Зачем. В разделе наград у кубка, статуэтки и медали есть фотографии, а у
 * дипломов до сих пор подставлялся голый фон без единой строки. Участник не
 * видел, что именно он получит: как выглядит звание, где стоит номер, что
 * написано в благодарности. Здесь каждый вид документа рисуется БОЕВЫМ движком
 * бланка - тем же, что печатает настоящие дипломы, - с образцовыми данными.
 *
 * Данные намеренно выдуманные и подписаны как образец: настоящее ФИО участника
 * на витрине показывать нельзя.
 *
 * Результат: public/assets/img/awards/<id>/{diploma,diploma2,diploma-name,thanks}.jpg
 */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { fwrite(STDERR, "CLI only\n"); exit(1); }

define('BASE_PATH', dirname(__DIR__));
$GLOBALS['CFG'] = require BASE_PATH . '/config.php';
require_once BASE_PATH . '/core/db.php';
require_once BASE_PATH . '/core/helpers.php';
require_once BASE_PATH . '/core/diploma_html.php';

$cid = (int) ($argv[1] ?? 0);
if ($cid <= 0) { fwrite(STDERR, "Укажите id конкурса\n"); exit(1); }
$c = one("SELECT * FROM competitions WHERE id=?", [$cid]);
if (!$c) { fwrite(STDERR, "Конкурс не найден\n"); exit(1); }

/* Образцовая заявка. Коллектив взят намеренно: на именном дипломе должно быть
 * видно и ФИО участника, и название коллектива - ради этого его и заказывают. */
$app = [
    'id'            => 0,
    'number'        => (string) $c['code'] . '-2026-00001',
    'competition_id'=> $cid,
    'full_name'     => 'Иванова Мария Сергеевна',
    'is_group'      => 1,
    'group_name'    => 'Образцовый ансамбль «Родник»',
    'age_category'  => '11-13 лет',
    'nomination'    => 'Вокальное искусство',
    'work_title'    => '«Гляжу в озёра синие»',
    'teacher'       => 'Петрова Анна Владимировна',
    'institution'   => 'Детская школа искусств №1',
    'city'          => 'Россия, город Москва',
    'result'        => 'ЛАУРЕАТ I СТЕПЕНИ',
    'extra_diploma' => 'ЗА ВЕРНОСТЬ ТРАДИЦИЯМ',
    'email'         => 'sample@example.org',
];

/** Что рисуем: тип документа → имя файла образца на витрине. */
$KINDS = [
    'main'   => ['file' => 'diploma.jpg',      'ru' => 'основной диплом'],
    'extra'  => ['file' => 'diploma2.jpg',     'ru' => 'дополнительный диплом'],
    'named'  => ['file' => 'diploma-name.jpg', 'ru' => 'именной диплом'],
    'thanks' => ['file' => 'thanks.jpg',       'ru' => 'благодарность'],
];

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

/** Забрать файл с бастиона целиком: мост режет длинный ответ (см. award_shot_make). */
$fetch = static function (string $remote, int $step = 60000) use ($bastion): string {
    $total = (int) trim($bastion('stat -c%s ' . escapeshellarg($remote) . ' 2>/dev/null || echo 0', 30));
    if ($total <= 0) return '';
    $out = '';
    for ($n = 0, $parts = (int) ceil($total / $step); $n < $parts; $n++) {
        $need = min($step, $total - $n * $step);
        $bin = '';
        for ($try = 0; $try < 3; $try++) {
            $part = $bastion('dd if=' . escapeshellarg($remote) . ' bs=' . $step . ' skip=' . $n
                           . ' count=1 2>/dev/null | base64 -w0', 120);
            $bin = base64_decode(preg_replace('~\s+~', '', $part) ?: '', true);
            if ($bin !== false && strlen($bin) >= $need) break;
            $bin = '';
        }
        if ($bin === '') return '';
        $out .= $bin;
    }
    return strlen($out) === $total ? $out : '';
};

$outDir = BASE_PATH . '/public/assets/img/awards/' . $cid;
if (!is_dir($outDir)) @mkdir($outDir, 0775, true);

echo "Конкурс: {$c['name']} (#{$cid})\n";

foreach ($KINDS as $type => $k) {
    echo "  {$k['ru']}…\n";

    /* Бланк собираем тем же движком, что и настоящий документ: если образец
     * нарисовать отдельной вёрсткой, витрина начнёт врать. Печать и подпись на
     * образце не ставим - это витрина, а не выданный документ. */
    /* sample=false намеренно: с этим флагом движок рисует плейсхолдеры и косые
     * надписи «ОБРАЗЕЦ» через весь лист - по такой картинке не понять, как
     * выглядит настоящий документ. Витрине нужен заполненный вид, поэтому
     * данные подставляем выдуманные, а слово «образец» стоит в подписи карточки
     * на самой странице наград. */
    /* Движок различает виды документов ОТДЕЛЬНЫМИ флагами, а не строкой типа:
     * с ключом 'type' он рисовал один и тот же основной диплом четыре раза. */
    $opt = [];
    if ($type === 'extra')  $opt['extra']  = true;
    if ($type === 'named')  { $opt['named'] = true;  $opt['person'] = (string) $app['full_name']; }
    if ($type === 'thanks') { $opt['thanks'] = true; $opt['person'] = (string) $app['teacher']; }
    $html = diploma_html($c, $app, $opt);

    $tag  = 'sample_' . $cid . '_' . $type . '_' . substr(bin2hex(random_bytes(3)), 0, 6);
    $htmlRem = '/opt/oko-poster/' . $tag . '.html';
    $pngRem  = '/opt/oko-poster/' . $tag . '.png';

    // Разметку кладём файлом: она длинная и в командную строку не влезает.
    $b64 = base64_encode($html);
    $bastion('rm -f ' . $htmlRem . '.b64', 30);
    for ($i = 0; $i < strlen($b64); $i += 60000) {
        $bastion('printf %s ' . escapeshellarg(substr($b64, $i, 60000)) . ' >> ' . $htmlRem . '.b64', 60);
    }
    $sz = (int) trim($bastion('base64 -d ' . $htmlRem . '.b64 > ' . $htmlRem . ' && rm -f ' . $htmlRem . '.b64 && stat -c%s ' . $htmlRem, 60));
    if ($sz < 1000) { echo "    разметка не долетела ({$sz} байт)\n"; continue; }

    /* Снимок страницы делает тот же Chromium, что печатает боевые бланки.
     * Ширина A4 при 150 точках на дюйм - витрине этого достаточно, а вес
     * остаётся разумным. */
    $shot = 'PLAYWRIGHT_BROWSERS_PATH=/opt/oko-poster/pw-browsers node -e '
          . escapeshellarg(
              'const {chromium}=require("playwright");(async()=>{'
            . 'const b=await chromium.launch();const p=await b.newPage({viewport:{width:1400,height:2000},'
            . 'deviceScaleFactor:2});'
            . 'await p.goto("file://' . $htmlRem . '",{waitUntil:"networkidle"});'
            . 'await p.waitForTimeout(1500);'
            /* Снимаем сам лист, а не страницу целиком: вокруг бланка остаётся
               серое поле подложки, и в карточке образца документ выглядел бы
               маленьким прямоугольником в пустоте. */
            . 'const el=await p.$(".diploma");'
            . 'if(el){await el.screenshot({path:"' . $pngRem . '"});}'
            . 'else{await p.screenshot({path:"' . $pngRem . '",fullPage:true});}'
            . 'await b.close();})().catch(e=>{console.error(e.message);process.exit(1)});'
          );
    $bastion('cd /opt/oko-poster && ' . $shot . ' 2>&1 | tail -3', 180);

    $jpgRem = $pngRem . '.jpg';
    $bastion('convert ' . escapeshellarg($pngRem) . ' -resize 1000x -quality 88 ' . escapeshellarg($jpgRem), 120);

    $raw = $fetch($jpgRem);
    if ($raw === '' || @imagecreatefromstring($raw) === false) {
        echo "    снимок не получился\n";
        $bastion('rm -f ' . $htmlRem . ' ' . $pngRem . ' ' . $jpgRem, 30);
        continue;
    }
    file_put_contents($outDir . '/' . $k['file'], $raw);
    @chmod($outDir . '/' . $k['file'], 0664);
    echo "    образец: assets/img/awards/{$cid}/{$k['file']} (", (int) round(strlen($raw) / 1024), " КБ)\n";
    $bastion('rm -f ' . $htmlRem . ' ' . $pngRem . ' ' . $jpgRem, 30);
}
echo "Готово.\n";
