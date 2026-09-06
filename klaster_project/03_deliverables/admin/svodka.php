<?php
declare(strict_types=1);

/* Суточная свёртка для панели. Читает jsonl за период и отдаёт готовый JSON.
   Ничего не досочиняет: где нуль, там нуль, и рядом подпись, откуда возьмутся данные.
   Вызов: /svodka.php?ot=2026-08-01&do=2026-08-14   Результат кэшируется на минуту. */

const KATALOG_DANNYH  = '/var/www/klaster-data';
const KATALOG_SOBYTIY = KATALOG_DANNYH . '/events';
const KATALOG_KESHA   = KATALOG_DANNYH . '/cache';
const FAYL_TOKENA     = KATALOG_DANNYH . '/svodka_token.txt';
const POYAS           = 'Europe/Moscow';
const KESH_SEKUND     = 60;
const MAKS_DNEY       = 366;
const MAKS_SESSIY     = 300000;   // предохранитель по памяти

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');
header('X-Content-Type-Options: nosniff');

// Токен спрашиваем, только если файл с ним заведён. Так ручку можно закрыть без правки кода.
if (is_readable(FAYL_TOKENA)) {
    $nuzhen = trim((string)file_get_contents(FAYL_TOKENA));
    $dan = (string)($_GET['t'] ?? $_SERVER['HTTP_X_SVODKA_TOKEN'] ?? '');
    if ($nuzhen !== '' && !hash_equals($nuzhen, $dan)) {
        http_response_code(403);
        echo json_encode(['ok' => false, 'oshibka' => 'нужен токен'], JSON_UNESCAPED_UNICODE);
        exit;
    }
}

$poyas = new DateTimeZone(POYAS);
$segodnya = new DateTimeImmutable('today', $poyas);

function data_ili(mixed $s, string $zapas, DateTimeZone $poyas): string
{
    $s = is_string($s) ? trim($s) : '';
    $d = DateTimeImmutable::createFromFormat('!Y-m-d', $s, $poyas);
    return ($d instanceof DateTimeImmutable && $d->format('Y-m-d') === $s) ? $s : $zapas;
}

$do = data_ili($_GET['do'] ?? null, $segodnya->format('Y-m-d'), $poyas);
$ot = data_ili($_GET['ot'] ?? null, $segodnya->modify('-29 days')->format('Y-m-d'), $poyas);
if ($ot > $do) [$ot, $do] = [$do, $ot];

$dOt = new DateTimeImmutable($ot, $poyas);
$dDo = new DateTimeImmutable($do, $poyas);
$dney = (int)$dOt->diff($dDo)->days + 1;
if ($dney > MAKS_DNEY) { $dOt = $dDo->modify('-' . (MAKS_DNEY - 1) . ' days'); $ot = $dOt->format('Y-m-d'); $dney = MAKS_DNEY; }

// -------------------- кэш на минуту --------------------

$klyuch = md5($ot . '|' . $do);
$faylKesha = KATALOG_KESHA . '/svodka-' . $klyuch . '.json';
if (is_readable($faylKesha) && (time() - (int)@filemtime($faylKesha)) < KESH_SEKUND) {
    $gotovo = (string)@file_get_contents($faylKesha);
    if ($gotovo !== '') { header('X-Kesh: hit'); echo $gotovo; exit; }
}

// -------------------- разбор источника перехода --------------------

function istochnik(array $s): string
{
    $utm = is_array($s['utm'] ?? null) ? $s['utm'] : [];
    $src = trim((string)($utm['source'] ?? ''));
    if ($src !== '') {
        $med = trim((string)($utm['medium'] ?? ''));
        return 'Реклама: ' . $src . ($med !== '' ? ' / ' . $med : '');
    }

    $ref = trim((string)($s['ref'] ?? ''));
    if ($ref === '') return 'Прямые заходы';

    $host = strtolower((string)parse_url($ref, PHP_URL_HOST));
    if ($host === '') return 'Прямые заходы';
    $host = preg_replace('/^www\./', '', $host) ?? $host;

    $gruppy = [
        'Поиск'         => ['yandex.ru', 'ya.ru', 'google.com', 'google.ru', 'bing.com', 'duckduckgo.com', 'rambler.ru', 'mail.ru', 'go.mail.ru'],
        'Соцсети'       => ['vk.com', 't.me', 'telegram.org', 'instagram.com', 'dzen.ru', 'zen.yandex.ru', 'youtube.com', 'ok.ru', 'wa.me', 'vc.ru'],
        'Справочники'   => ['2gis.ru', 'maps.yandex.ru', 'yandex.ru/maps', 'avito.ru', 'cian.ru', 'domclick.ru', 'zoon.ru', 'yell.ru'],
    ];
    foreach ($gruppy as $imya => $hosty) {
        foreach ($hosty as $h) if ($host === $h || str_ends_with($host, '.' . $h)) return $imya . ': ' . $host;
    }
    return 'Ссылки: ' . $host;
}

// -------------------- чтение и свёртка --------------------

$dni = [];                       // дата => счётчики
$sessii = [];                    // sid => карточка сессии
$vseVid = [];                    // уникальные посетители за период
$stranicy = [];                  // путь => просмотры и сессии
$kliki = [];                     // цель => сколько раз нажали
$sobytiyVsego = 0;
$obrezano = false;

for ($i = 0; $i < $dney; $i++) {
    $d = $dOt->modify('+' . $i . ' days')->format('Y-m-d');
    $dni[$d] = ['data' => $d, 'prosmotry' => 0, 'sessii' => [], 'uniki' => [], 'zayavki' => 0];

    $fayl = KATALOG_SOBYTIY . '/' . $d . '.jsonl';
    if (!is_readable($fayl)) continue;
    $f = @fopen($fayl, 'r');
    if ($f === false) continue;

    while (($stroka = fgets($f)) !== false) {
        $stroka = trim($stroka);
        if ($stroka === '') continue;
        $s = json_decode($stroka, true);
        if (!is_array($s)) continue;
        if ((int)($s['bot'] ?? 0) === 1) continue;          // ботов в отчёт руководству не пускаем

        $sobytiyVsego++;
        $sid = (string)($s['sid'] ?? '');
        $vid = (string)($s['vid'] ?? '');
        $tip = (string)($s['t'] ?? '');
        if ($sid === '' || $vid === '') continue;

        if (!isset($sessii[$sid])) {
            if (count($sessii) >= MAKS_SESSIY) { $obrezano = true; continue; }
            $sessii[$sid] = [
                'd' => $d, 'vid' => $vid, 'ist' => istochnik($s),
                'dev' => (string)($s['dev'] ?? 'desktop'),
                'sd' => 0, 'dur' => 0, 'cel' => 0, 'fs' => 0, 'fsub' => 0, 'nw' => (int)($s['nw'] ?? 0),
            ];
        }
        $ss = &$sessii[$sid];
        $ss['sd'] = max($ss['sd'], (int)($s['sd'] ?? 0));
        $ss['dur'] = max($ss['dur'], (int)($s['dur'] ?? 0));

        $vseVid[$vid] = 1;
        $dni[$d]['sessii'][$sid] = 1;
        $dni[$d]['uniki'][$vid] = 1;

        if ($tip === 'view') {
            $dni[$d]['prosmotry']++;
            $u = (string)($s['u'] ?? '/');
            if (!isset($stranicy[$u])) $stranicy[$u] = ['u' => $u, 'ttl' => (string)($s['ttl'] ?? ''), 'prosmotry' => 0, 'ss' => []];
            $stranicy[$u]['prosmotry']++;
            $stranicy[$u]['ss'][$sid] = 1;
        } elseif ($tip === 'click') {
            $el = (string)($s['el'] ?? 'other');
            $kliki[$el] = ($kliki[$el] ?? 0) + 1;
            $ss['cel'] = 1;
        } elseif ($tip === 'form_start') {
            $ss['fs'] = 1;
        } elseif ($tip === 'form_submit') {
            $ss['fsub'] = 1;
            $dni[$d]['zayavki']++;
        }
        unset($ss);
    }
    fclose($f);
}

// -------------------- сборка ответа --------------------

$istochniki = [];
$ustroystva = ['desktop' => 0, 'tablet' => 0, 'mobile' => 0];
$shag2 = $shag3 = $shag4 = $shag5 = 0;
$summaVremeni = $summaGlubiny = 0;
$novyh = 0;

foreach ($sessii as $ss) {
    $istochniki[$ss['ist']] = ($istochniki[$ss['ist']] ?? 0) + 1;
    if (isset($ustroystva[$ss['dev']])) $ustroystva[$ss['dev']]++;
    $summaVremeni += $ss['dur'];
    $summaGlubiny += $ss['sd'];
    if ($ss['nw'] === 1) $novyh++;
    if ($ss['sd'] >= 50) $shag2++;
    if ($ss['cel'] === 1) $shag3++;
    if ($ss['fs'] === 1) $shag4++;
    if ($ss['fsub'] === 1) $shag5++;
}

$vsegoSessiy = count($sessii);
arsort($istochniki);
$spisokIstochnikov = [];
foreach ($istochniki as $imya => $kol) $spisokIstochnikov[] = ['imya' => $imya, 'sessii' => $kol];

uasort($stranicy, static fn(array $a, array $b): int => $b['prosmotry'] <=> $a['prosmotry']);
$spisokStranic = [];
foreach (array_slice($stranicy, 0, 40) as $p) {
    $spisokStranic[] = ['u' => $p['u'], 'ttl' => $p['ttl'], 'prosmotry' => $p['prosmotry'], 'sessii' => count($p['ss'])];
}

$spisokDney = [];
$prosmotryVsego = $zayavkiVsego = 0;
foreach ($dni as $d) {
    $prosmotryVsego += $d['prosmotry'];
    $zayavkiVsego += $d['zayavki'];
    $spisokDney[] = [
        'data' => $d['data'],
        'prosmotry' => $d['prosmotry'],
        'sessii' => count($d['sessii']),
        'uniki' => count($d['uniki']),
        'zayavki' => $d['zayavki'],
    ];
}

$dolya = static fn(int $ch, int $vsego): float => $vsego > 0 ? round($ch * 100 / $vsego, 1) : 0.0;

$voronka = [
    ['shag' => 'Зашли на сайт',          'znachenie' => $vsegoSessiy, 'dolya' => $vsegoSessiy > 0 ? 100.0 : 0.0],
    ['shag' => 'Досмотрели до половины', 'znachenie' => $shag2, 'dolya' => $dolya($shag2, $vsegoSessiy)],
    ['shag' => 'Нажали на цель',         'znachenie' => $shag3, 'dolya' => $dolya($shag3, $vsegoSessiy)],
    ['shag' => 'Начали заполнять форму', 'znachenie' => $shag4, 'dolya' => $dolya($shag4, $vsegoSessiy)],
    ['shag' => 'Отправили заявку',       'znachenie' => $shag5, 'dolya' => $dolya($shag5, $vsegoSessiy)],
];

$dannyeEst = $sobytiyVsego > 0;

$otvet = [
    'ok' => true,
    'period' => ['ot' => $ot, 'do' => $do, 'dney' => $dney],
    'sobrano' => (new DateTimeImmutable('now', $poyas))->format('Y-m-d H:i:s'),
    'dannye_est' => $dannyeEst,
    'kommentariy' => $dannyeEst
        ? 'Счёт ведёт наш трекер на сайте, сторонних счётчиков нет.'
        : 'Событий за период нет. Цифры пойдут сразу после подключения track.js на боевой сайт, задним числом данных не будет.',
    'itogo' => [
        'prosmotry'  => $prosmotryVsego,
        'sessii'     => $vsegoSessiy,
        'uniki'      => count($vseVid),
        'novye'      => $novyh,
        'zayavki'    => $zayavkiVsego,
        'konversiya' => $dolya($shag5, $vsegoSessiy),
        'sr_vremya'  => $vsegoSessiy > 0 ? (int)round($summaVremeni / $vsegoSessiy) : 0,
        'sr_glubina' => $vsegoSessiy > 0 ? (int)round($summaGlubiny / $vsegoSessiy) : 0,
    ],
    'dni' => $spisokDney,
    'istochniki' => $spisokIstochnikov,
    'stranicy' => $spisokStranic,
    'ustroystva' => $ustroystva,
    'kliki' => $kliki,
    'voronka' => $voronka,
];
if ($obrezano) $otvet['preduprezhdenie'] = 'Сессий за период больше предела разбора, часть не учтена. Сузьте период.';

$gotovo = json_encode($otvet, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
if ($gotovo === false) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'oshibka' => 'не собрался json'], JSON_UNESCAPED_UNICODE);
    exit;
}

if (!is_dir(KATALOG_KESHA)) @mkdir(KATALOG_KESHA, 0750, true);
@file_put_contents($faylKesha, $gotovo, LOCK_EX);
header('X-Kesh: miss');
echo $gotovo;
