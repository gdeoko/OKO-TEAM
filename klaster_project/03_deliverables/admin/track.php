<?php
declare(strict_types=1);

/* Приёмник событий трекера. Каждое событие ложится отдельной строкой JSON
   в суточный файл /var/www/klaster-data/events/ГГГГ-ММ-ДД.jsonl (вне веб-корня).
   Отвечает 204 без тела в любом исходе, чтобы не подсказывать ботам, что прошло.
   Персональных данных не храним: IP только в виде хеша с солью. */

const KATALOG_DANNYH  = '/var/www/klaster-data';
const KATALOG_SOBYTIY = KATALOG_DANNYH . '/events';
const KATALOG_CHASTOT = KATALOG_DANNYH . '/rate';
const FAYL_SOLI       = KATALOG_DANNYH . '/track_salt.txt';
const POYAS           = 'Europe/Moscow';

const MAKS_TELO      = 65536;  // 64 КБ на запрос
const MAKS_SOBYTIY   = 40;     // событий в одной пачке
const LIMIT_ZAPROSOV = 60;     // запросов с одного IP в минуту
const LIMIT_SOBYTIY  = 400;    // событий с одного IP в минуту

// Белый список: что не перечислено, на диск не попадает.
const TIPY = ['view', 'scroll', 'click', 'form_start', 'form_submit', 'time', 'exit'];
const CELI = ['phone', 'lead', 'presentation', 'shuttle', 'selector', 'whatsapp', 'telegram', 'mail', 'other'];
const ZONY = ['shapka', 'telo', 'podval', 'podbor'];
const USTROYSTVA = ['desktop', 'tablet', 'mobile'];

function otvet(): never
{
    // 204 без тела. Ничего не сообщаем о результате разбора.
    http_response_code(204);
    header_remove('Content-Type');
    exit;
}

function obrezat(mixed $z, int $dlina): string
{
    if (!is_scalar($z)) return '';
    $s = (string)$z;
    $s = str_replace(["\r", "\n", "\t", "\0"], ' ', $s);
    $s = trim(preg_replace('/\s+/u', ' ', $s) ?? '');
    return mb_substr($s, 0, $dlina, 'UTF-8');
}

function sol(): string
{
    // Соль рождается один раз и лежит рядом с данными, правами 0600.
    if (is_readable(FAYL_SOLI)) {
        $s = trim((string)@file_get_contents(FAYL_SOLI));
        if ($s !== '') return $s;
    }
    if (!is_dir(KATALOG_DANNYH)) @mkdir(KATALOG_DANNYH, 0750, true);
    $s = bin2hex(random_bytes(32));
    @file_put_contents(FAYL_SOLI, $s, LOCK_EX);
    @chmod(FAYL_SOLI, 0600);
    return $s;
}

function ip_klienta(): string
{
    // Заголовкам верим только потому, что перед PHP стоит наш nginx и он их выставляет.
    foreach (['HTTP_CF_CONNECTING_IP', 'HTTP_X_REAL_IP', 'HTTP_X_FORWARDED_FOR'] as $k) {
        if (empty($_SERVER[$k])) continue;
        $chast = trim(explode(',', (string)$_SERVER[$k])[0]);
        if (filter_var($chast, FILTER_VALIDATE_IP)) return $chast;
    }
    return (string)($_SERVER['REMOTE_ADDR'] ?? '0.0.0.0');
}

function strana(): string
{
    foreach (['HTTP_CF_IPCOUNTRY', 'HTTP_X_COUNTRY_CODE', 'GEOIP_COUNTRY_CODE'] as $k) {
        $v = strtoupper(trim((string)($_SERVER[$k] ?? '')));
        if (preg_match('/^[A-Z]{2}$/', $v) && $v !== 'XX') return $v;
    }
    return '';                                   // геобазы нет, честно пусто
}

function pohozh_na_bota(string $ua): bool
{
    if ($ua === '') return true;
    return (bool)preg_match(
        '~bot|crawl|spider|slurp|headless|phantom|curl|wget|python-requests|monitor|preview|lighthouse|pingdom~i',
        $ua
    );
}

function chastota_ok(string $hash, int $sobytiy): bool
{
    // Простой счётчик по минутам на файл. Не смогли посчитать - пропускаем, посетитель не виноват.
    if (!is_dir(KATALOG_CHASTOT)) @mkdir(KATALOG_CHASTOT, 0750, true);
    $fayl = KATALOG_CHASTOT . '/' . substr($hash, 0, 16) . '.txt';
    $minuta = intdiv(time(), 60);
    $f = @fopen($fayl, 'c+');
    if ($f === false) return true;

    $ok = true;
    if (flock($f, LOCK_EX)) {
        $ch = array_map('intval', preg_split('/\s+/', trim((string)stream_get_contents($f))) ?: []);
        if (($ch[0] ?? 0) !== $minuta) $ch = [$minuta, 0, 0];
        $ch[1] = ($ch[1] ?? 0) + 1;
        $ch[2] = ($ch[2] ?? 0) + $sobytiy;
        $ok = $ch[1] <= LIMIT_ZAPROSOV && $ch[2] <= LIMIT_SOBYTIY;
        ftruncate($f, 0);
        rewind($f);
        fwrite($f, $ch[0] . ' ' . $ch[1] . ' ' . $ch[2]);
        fflush($f);
        flock($f, LOCK_UN);
    }
    fclose($f);

    // Раз в сотню запросов подметаем старые счётчики.
    if (random_int(1, 100) === 1) {
        foreach ((glob(KATALOG_CHASTOT . '/*.txt') ?: []) as $staryy) {
            if (@filemtime($staryy) < time() - 3600) @unlink($staryy);
        }
    }
    return $ok;
}

// -------------------- разбор запроса --------------------

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') otvet();

$telo = (string)file_get_contents('php://input', false, null, 0, MAKS_TELO + 1);
if ($telo === '' || strlen($telo) > MAKS_TELO) otvet();

try {
    $pachka = json_decode($telo, true, 8, JSON_THROW_ON_ERROR);
} catch (JsonException) {
    otvet();
}
if (!is_array($pachka) || !is_array($pachka['b'] ?? null)) otvet();

$syrye = array_slice($pachka['b'], 0, MAKS_SOBYTIY);
if ($syrye === []) otvet();

$ua = obrezat($_SERVER['HTTP_USER_AGENT'] ?? '', 200);
$iph = substr(hash_hmac('sha256', ip_klienta(), sol()), 0, 16);
if (!chastota_ok($iph, count($syrye))) otvet();

$bot = pohozh_na_bota($ua) ? 1 : 0;
$cc = strana();
$seychas = new DateTimeImmutable('now', new DateTimeZone(POYAS));

$stroki = [];
foreach ($syrye as $s) {
    if (!is_array($s)) continue;

    $tip = obrezat($s['t'] ?? '', 20);
    if (!in_array($tip, TIPY, true)) continue;

    $sid = preg_replace('/[^a-z0-9]/', '', strtolower(obrezat($s['sid'] ?? '', 32))) ?? '';
    $vid = preg_replace('/[^a-z0-9]/', '', strtolower(obrezat($s['vid'] ?? '', 32))) ?? '';
    if ($sid === '' || $vid === '') continue;

    $utm = [];
    if (is_array($s['utm'] ?? null)) {
        foreach (['source', 'medium', 'campaign', 'content', 'term', 'klik'] as $p) {
            $v = obrezat($s['utm'][$p] ?? '', 100);
            if ($v !== '') $utm[$p] = $v;
        }
    }

    $dev = obrezat($s['dev'] ?? '', 12);
    if (!in_array($dev, USTROYSTVA, true)) $dev = 'desktop';

    $sob = [
        't'   => $tip,
        'srv' => $seychas->format(DateTimeInterface::ATOM),   // время сервера, ему и верим
        'ts'  => $seychas->getTimestamp(),
        'd'   => $seychas->format('Y-m-d'),
        'sid' => $sid,
        'vid' => $vid,
        'nw'  => (int)(bool)($s['nw'] ?? 0),
        'u'   => obrezat($s['u'] ?? '/', 400),
        'ttl' => obrezat($s['ttl'] ?? '', 160),
        'ref' => obrezat($s['ref'] ?? '', 400),
        'utm' => $utm,
        'scr' => preg_match('/^\d{1,5}x\d{1,5}$/', (string)($s['scr'] ?? '')) ? (string)$s['scr'] : '',
        'dev' => $dev,
        'lang' => obrezat($s['lang'] ?? '', 12),
        'dur' => max(0, min(86400, (int)($s['dur'] ?? 0))),
        'sd'  => max(0, min(100, (int)($s['sd'] ?? 0))),
        'cc'  => $cc,
        'iph' => $iph,
        'bot' => $bot,
    ];

    if ($tip === 'click' || $tip === 'form_start' || $tip === 'form_submit') {
        $el = obrezat($s['el'] ?? '', 40);
        if ($tip === 'click' && !in_array($el, CELI, true)) $el = 'other';
        $sob['el'] = $el !== '' ? $el : 'other';
        $zn = obrezat($s['zona'] ?? '', 12);
        $sob['zona'] = in_array($zn, ZONY, true) ? $zn : 'telo';
        $txt = obrezat($s['txt'] ?? '', 60);
        if ($txt !== '') $sob['txt'] = $txt;
    }

    $stroka = json_encode($sob, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if ($stroka !== false) $stroki[] = $stroka;
}

if ($stroki !== []) {
    if (!is_dir(KATALOG_SOBYTIY)) @mkdir(KATALOG_SOBYTIY, 0750, true);
    $fayl = KATALOG_SOBYTIY . '/' . $seychas->format('Y-m-d') . '.jsonl';
    @file_put_contents($fayl, implode("\n", $stroki) . "\n", FILE_APPEND | LOCK_EX);
}

otvet();
