<?php
/** Общие помощники: экранирование, тексты по правилам КЦ, рендер, CSRF, аудит. */
declare(strict_types=1);

function h($s): string { return htmlspecialchars((string)$s, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); }

/**
 * Единая строка информационной поддержки — правило Даниэля от 03.09.2026.
 * Одна формулировка везде: сайт, диплом, афиша, письма, ВК. Менять только здесь.
 * $cap — с прописной «При» (по умолчанию) или строчной «при» для середины фразы.
 */
function mm_support_text(bool $cap = true): string {
    return ($cap ? 'При' : 'при')
        . ' информационной поддержке министерства культуры и образования субъектов Российской'
        . ' Федерации, правительства - департамента культуры города Москвы, государственного'
        . ' портала «Pro Культура», Росмолодёжи, Союза композиторов и Союза театральных деятелей РФ';
}

/**
 * Значение настройки: сначала окружение (config.php), потом таблица настроек.
 *
 * Раздел «Настройки» в админке сохранял значения в таблицу settings, а весь код
 * читал их через cfgv(), которая смотрела ТОЛЬКО в config.php. Из двадцати полей
 * реально работали два: остальные восемнадцать — телефон оргкомитета, почта, ключи
 * кассы, токен ВК, реквизиты SMTP — сохранялись, показывались как сохранённые и не
 * влияли ни на что. Владелец менял телефон в админке и не понимал, почему на сайте
 * остаётся старый.
 *
 * Приоритет остаётся за окружением: боевые ключи задаются переменными окружения и
 * из админки их не перебить. Таблица — фолбэк для того, что в окружении не задано.
 */
function cfgv(string $key, $default = null) {
    static $c = null, $s = null;
    if ($c === null) $c = $GLOBALS['CFG'] ?? require BASE_PATH . '/config.php';

    $v = $c[$key] ?? null;
    if ($v !== null && $v !== '') return $v;

    // Таблицу читаем один раз за запрос: cfgv() зовётся сотни раз на страницу.
    // Пока core/db.php не подключён, $s остаётся null и попытка повторится позже —
    // иначе первый же ранний вызов (url() из шапки) навсегда закрыл бы фолбэк.
    if ($s === null && function_exists('db')) {
        try {
            $tmp = [];
            foreach (db()->query("SELECT key, value FROM settings") as $r) {
                $tmp[(string) $r['key']] = (string) $r['value'];
            }
            $s = $tmp;
        } catch (\Throwable $e) { $s = []; }   // таблицы нет — больше не пробуем
    }
    if (is_array($s) && isset($s[$key]) && $s[$key] !== '') return $s[$key];

    return $v ?? $default;
}

/**
 * Ссылка, годная для человеческих глаз: домен из punycode обратно в кириллицу.
 *
 * Наш адрес технически записан как xn----7sbugdeiegh1b0a9hen.xn--p1ai. В коде это
 * правильно, а в письме, бланке или записи ВКонтакте такая ссылка выглядит как
 * подделка, и до сути читатель уже не доходит.
 */
function link_human(string $url): string {
    return preg_replace_callback('~//(xn--[^/]+)~', static function (array $m): string {
        $h = function_exists('idn_to_utf8') ? idn_to_utf8($m[1], 0, INTL_IDNA_VARIANT_UTS46) : false;
        return '//' . ($h !== false && $h !== '' ? $h : $m[1]);
    }, $url) ?? $url;
}

function url(string $path = ''): string {
    return rtrim(cfgv('base_url'), '/') . '/' . ltrim($path, '/');
}
function asset(string $path): string {
    $rel = ltrim($path, '/');
    // Cache-busting: только для CSS/JS/webmanifest — добавляем ?v=<mtime> чтобы обход nginx max-age=30d.
    $qmark = strpos($rel, '?');
    $clean = $qmark === false ? $rel : substr($rel, 0, $qmark);
    if (preg_match('~\.(css|js|webmanifest)$~i', $clean)) {
        $abs = defined('BASE_PATH') ? BASE_PATH . '/public/assets/' . $clean : '';
        if ($abs !== '' && is_file($abs)) {
            $rel .= ($qmark === false ? '?' : '&') . 'v=' . filemtime($abs);
        }
    }
    return url('assets/' . $rel);
}

/** Правила текстов КЦ: короткие тире, «ёлочки», без AI-лексики, «Вы». */
function normalize_text(string $t): string {
    $t = str_replace(['—', '–'], '-', $t);                 // em/en dash -> hyphen
    $t = preg_replace('/[ ]{2,}/u', ' ', $t);
    $t = preg_replace('/!{2,}/', '!', $t);
    $t = preg_replace('/\?{2,}/', '?', $t);
    // прямые кавычки "..." -> «...»
    $t = preg_replace('/"([^"]*)"/u', '«$1»', $t);
    return trim($t);
}

/** Рендер публичной страницы в общий лейаут. */
function render_page(string $title, string $content, array $opts = []): void {
    $meta_description = $opts['meta'] ?? 'Международные и всероссийские онлайн-конкурсы и фестивали культуры и искусства. Культурного центра «Музыкальный Мир».';
    $og_image = $opts['og_image'] ?? asset('img/og_muzmir.png');
    $active = $opts['active'] ?? '';
    $wide = $opts['wide'] ?? false;
    // Per-page JSON-LD: массив (schema.org объект) или массив таких массивов, либо готовая строка.
    $jsonld = $opts['jsonld'] ?? null;
    require BASE_PATH . '/templates/site/layout.php';
}

/**
 * Секрет приложения для подписи токенов. Лежит рядом с базой (каталог /data вне
 * web-root), в git не попадает, создаётся сам при первом обращении.
 */
function app_secret(): string {
    static $s = null;
    if ($s !== null) return $s;
    $f = BASE_PATH . '/data/app_secret.key';
    $s = is_file($f) ? trim((string) @file_get_contents($f)) : '';
    if ($s === '') {
        $s = bin2hex(random_bytes(32));
        @mkdir(dirname($f), 0775, true);
        @file_put_contents($f, $s);
        @chmod($f, 0600);
    }
    return $s;
}

const CSRF_COOKIE = 'muzmir_csrf';

/**
 * ТОКЕН ФОРМЫ НЕ ДОЛЖЕН ПРОТУХАТЬ РАНЬШЕ ВХОДА.
 *
 * Раньше токен жил в PHP-сессии: cookie входа — 30 дней, а сессия на сервере
 * умирает через 24 минуты (session.gc_maxlifetime=1440). Человек открывал
 * кабинет, заполнял «Изменить заявку», отвлекался (или телефон усыплял вкладку),
 * жал «Сохранить» — сессия уже другая, токен не сходился, и правка молча не
 * сохранялась. Ровно тот баг, о котором сообщил владелец.
 *
 * Теперь токен считается от долгоживущих cookie: у вошедшего — от его 30-дневной
 * cookie входа, у гостя — от собственной 30-дневной cookie. Угадать его чужой
 * сайт не может (значений cookie он не видит), а протухнуть раньше самого входа
 * токен больше не способен.
 */
function csrf_boot(): void {
    if (!empty($_COOKIE[CSRF_COOKIE]) || headers_sent()) return;
    $t = bin2hex(random_bytes(16));
    $_COOKIE[CSRF_COOKIE] = $t;
    setcookie(CSRF_COOKIE, $t, [
        'expires' => time() + 60 * 60 * 24 * 30, 'path' => '/',
        'httponly' => true, 'samesite' => 'Lax',
        'secure' => (($_SERVER['HTTPS'] ?? '') === 'on'),
    ]);
}

function csrf_token(): string {
    $auth = (string) ($_COOKIE['muzmir_sess'] ?? '');
    if ($auth !== '') return hash_hmac('sha256', 'csrf|user|' . $auth, app_secret());
    $c = (string) ($_COOKIE[CSRF_COOKIE] ?? '');
    if ($c !== '') return hash_hmac('sha256', 'csrf|guest|' . $c, app_secret());
    if (empty($_SESSION['csrf'])) $_SESSION['csrf'] = bin2hex(random_bytes(16));
    return (string) $_SESSION['csrf'];
}
function csrf_field(): string { return '<input type="hidden" name="_csrf" value="' . h(csrf_token()) . '">'; }

/**
 * Проверка CSRF-токена. Принимаем любой из действующих токенов этого браузера:
 * от cookie входа, от гостевой cookie и (для страниц, открытых до обновления)
 * старый сессионный. Пустой токен не принимается никогда — fail-open здесь был
 * дырой: достаточно было прислать `_csrf=` пустым.
 */
function csrf_check(): bool {
    $got = $_POST['_csrf'] ?? ($_POST['csrf'] ?? '');
    if (!is_string($got) || $got === '') return false;
    $ok = [];
    $auth = (string) ($_COOKIE['muzmir_sess'] ?? '');
    if ($auth !== '') $ok[] = hash_hmac('sha256', 'csrf|user|' . $auth, app_secret());
    $c = (string) ($_COOKIE[CSRF_COOKIE] ?? '');
    if ($c !== '') $ok[] = hash_hmac('sha256', 'csrf|guest|' . $c, app_secret());
    $sess = (string) ($_SESSION['csrf'] ?? '');
    if ($sess !== '') $ok[] = $sess;
    foreach ($ok as $t) if (hash_equals($t, $got)) return true;
    return false;
}

/**
 * Название конкурсного номера для показа — ровно в ОДНОЙ паре «ёлочек».
 *
 * В базе название уже хранится в кавычках (quote_title при подаче и при правке),
 * а шаблоны добавляли свои — участник видел ««Жаворонок»» и в кабинете, и в
 * списках, и на сертификате, и решал, что правка «не сохранилась».
 */
function wt_show(string $s): string {
    $s = trim($s);
    if ($s === '') return '';
    if (preg_match('~^[«"“](.*)[»"”]$~us', $s, $m)) return '«' . trim($m[1]) . '»';
    return '«' . $s . '»';
}

/** Flash-сообщения. */
function flash(string $msg, string $type = 'info'): void { $_SESSION['flash'][] = [$type, $msg]; }
function flashes(): array { $f = $_SESSION['flash'] ?? []; unset($_SESSION['flash']); return $f; }

function redirect(string $path): void {
    header('Location: ' . (str_starts_with($path, 'http') ? $path : url($path)));
    exit;
}
function json_out($data, int $code = 200): void {
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}
/**
 * Значение из запроса, всегда строкой.
 *
 * $default ПРИВОДИТСЯ К СТРОКЕ. Функция объявлена возвращать string, а вызывают её
 * и с числовым запасным значением — input('comp', 0). Пока параметр в запросе есть,
 * всё работает; как только его нет, возвращался int, и PHP валил страницу целиком:
 * «input(): Return value must be of type string, int returned». Именно так 12.08.2026
 * слегла страница подачи заявки — открытая без ?competition= в адресе.
 */
function input(string $key, $default = ''): string {
    if (isset($_POST[$key])) return trim((string) $_POST[$key]);
    if (isset($_GET[$key]))  return trim((string) $_GET[$key]);
    return is_scalar($default) ? (string) $default : '';
}

/**
 * Rate-limit по ключу со СКОЛЬЗЯЩИМ окном (без всплеска 2× на стыке фиксированных окон).
 * Хиты пишутся в посекундные бакеты (window_start = unix-время), лимит считается как
 * сумма за последние $window секунд. Сигнатура сохранена.
 */
function rate_ok(string $key, int $limit, int $window = 3600): bool {
    $now = time();
    q("INSERT INTO rate_limit(k,window_start,hits) VALUES(?,?,1)
       ON CONFLICT(k,window_start) DO UPDATE SET hits = hits + 1", [$key, $now]);
    $hits = (int) scalar(
        "SELECT COALESCE(SUM(hits),0) FROM rate_limit WHERE k=? AND window_start > ?",
        [$key, $now - $window]
    );
    // Опортунистическая уборка устаревших бакетов (без крона).
    if (mt_rand(1, 50) === 1) q("DELETE FROM rate_limit WHERE window_start < ?", [$now - $window]);
    return $hits <= $limit;
}

/**
 * АДРЕС ПОСЕТИТЕЛЯ — ТОЛЬКО ИЗ ДОВЕРЕННОГО ИСТОЧНИКА.
 *
 * Раньше функция безоговорочно верила заголовкам CF-Connecting-IP и X-Forwarded-For,
 * хотя перед PHP никакого доверенного прокси нет — nginx отдаёт запрос напрямую.
 * Заголовок ставит кто угодно, а на этой функции держатся ВСЕ ограничения частоты:
 * подбор пароля к кабинету и к админке становился безлимитным — достаточно менять
 * X-Forwarded-For на каждой попытке. По той же причине в журнале аудита оказывались
 * выдуманные адреса.
 *
 * Теперь берём REMOTE_ADDR, а заголовки читаем, только если сам REMOTE_ADDR входит
 * в список доверенных прокси (cfgv('trusted_proxies') — строка адресов через запятую,
 * пусто = не доверяем никому).
 */
function client_ip(): string {
    $remote = (string) ($_SERVER['REMOTE_ADDR'] ?? '');

    $trustedRaw = (string) (function_exists('cfgv') ? (cfgv('trusted_proxies', '') ?? '') : '');
    $trusted = array_values(array_filter(array_map('trim', preg_split('~[,\s]+~', $trustedRaw) ?: [])));
    if ($remote === '' || !$trusted || !in_array($remote, $trusted, true)) {
        return $remote;
    }

    // Запрос действительно пришёл от нашего прокси — можно верить его заголовкам.
    $cf = trim((string) ($_SERVER['HTTP_CF_CONNECTING_IP'] ?? ''));
    if ($cf !== '' && filter_var($cf, FILTER_VALIDATE_IP)) return $cf;

    $xff = (string) ($_SERVER['HTTP_X_FORWARDED_FOR'] ?? '');
    if ($xff !== '') {
        // Первый адрес в цепочке — исходный клиент.
        $first = trim((string) (explode(',', $xff)[0] ?? ''));
        if ($first !== '' && filter_var($first, FILTER_VALIDATE_IP)) return $first;
    }
    return $remote;
}

function audit(string $action, string $entity = '', ?int $entity_id = null, array $meta = []): void {
    insert('audit_log', [
        // В CLI-кронах (реконсилер платежей) core/auth.php не подключён — current_user() может отсутствовать.
        'user_id' => (function_exists('current_user') ? (current_user()['id'] ?? null) : null),
        'action' => $action, 'entity' => $entity, 'entity_id' => $entity_id,
        'meta' => json_encode($meta, JSON_UNESCAPED_UNICODE), 'ip' => client_ip(),
    ]);
}

function money(int $rub): string { return number_format($rub, 0, ',', ' ') . ' ₽'; }

function ru_date(?string $d): string {
    if (!$d) return '';
    $months = [1=>'января',2=>'февраля',3=>'марта',4=>'апреля',5=>'мая',6=>'июня',
               7=>'июля',8=>'августа',9=>'сентября',10=>'октября',11=>'ноября',12=>'декабря'];
    $ts = strtotime($d);
    return (int)date('j', $ts) . ' ' . $months[(int)date('n', $ts)] . ' ' . date('Y', $ts);
}

/**
 * Дата со временем по-русски: «15 августа 2026, 20:40».
 *
 * Всё время в базе московское, поэтому здесь ничего не пересчитывается — только
 * оформляется. Если во входной строке одна дата без часов, время не дописываем:
 * выдумывать полночь там, где её не было, хуже, чем показать одну дату.
 */
function ru_datetime(?string $d): string {
    $s = trim((string) $d);
    if ($s === '') return '';
    $ts = strtotime($s);
    if (!$ts) return '';
    $date = ru_date(substr($s, 0, 10));
    return preg_match('~\d{2}:\d{2}~', $s) ? $date . ', ' . date('H:i', $ts) : $date;
}

/** Относительное время: «5 минут назад», «вчера», «3 дня назад», иначе дата. */
function ru_relative_time(?string $d): string {
    if (!$d) return '';
    $ts = strtotime($d); if (!$ts) return '';
    $diff = time() - $ts;
    if ($diff < 60)      return 'только что';
    if ($diff < 3600)    { $n = (int)($diff / 60);   $forms = ['минуту','минуты','минут'];  return $n . ' ' . _ru_plural($n, $forms) . ' назад'; }
    if ($diff < 86400)   { $n = (int)($diff / 3600); $forms = ['час','часа','часов'];       return $n . ' ' . _ru_plural($n, $forms) . ' назад'; }
    if ($diff < 172800)  return 'вчера в ' . date('H:i', $ts);
    if ($diff < 604800)  { $n = (int)($diff / 86400); $forms = ['день','дня','дней'];       return $n . ' ' . _ru_plural($n, $forms) . ' назад'; }
    return ru_date($d);
}
function _ru_plural(int $n, array $f): string {
    $n = abs($n) % 100; $n1 = $n % 10;
    if ($n > 10 && $n < 20) return $f[2];
    if ($n1 > 1 && $n1 < 5) return $f[1];
    if ($n1 == 1) return $f[0];
    return $f[2];
}

/**
 * Человекочитаемое название заказа наградной продукции из JSON-поля items.
 * Формат в БД: [{"item":"...","kind":"original|electronic|club","price":N}, ...].
 * Старые заказы (обычный текст) возвращаются как есть.
 */
function order_items_label(?string $json): string {
    $s = trim((string) $json);
    if ($s === '') return 'Наградная продукция';
    if ($s[0] !== '[' && $s[0] !== '{') return $s; // старый формат — просто текст
    $data = json_decode($s, true);
    if (!is_array($data)) return $s;
    if (isset($data['item'])) $data = [$data]; // одиночный объект
    $kindMap = ['original' => 'оригинал, почтой', 'electronic' => 'электронный',
                'digital' => 'электронный', 'club' => ''];
    $parts = [];
    foreach ($data as $it) {
        if (!is_array($it)) continue;
        $name = trim((string) ($it['item'] ?? ''));
        if ($name === '') continue;
        $kl = $kindMap[(string) ($it['kind'] ?? '')] ?? '';
        $qty = (int) ($it['qty'] ?? 0);
        $parts[] = $name . ($kl !== '' ? ' (' . $kl . ')' : '') . ($qty > 1 ? ' ×' . $qty : '');
    }
    return $parts ? implode(', ', $parts) : 'Наградная продукция';
}

/** Логотип как base64 data-URI (для писем, дипломов, PDF). */
function logo_data_uri(): string {
    static $u = null;
    if ($u === null) {
        $f = BASE_PATH . '/public/assets/img/logo_muzmir_b64.txt';
        $u = is_file($f) ? trim(file_get_contents($f)) : asset('img/logo_muzmir_main.png');
    }
    return $u;
}
