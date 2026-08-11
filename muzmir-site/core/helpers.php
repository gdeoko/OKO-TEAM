<?php
/** Общие помощники: экранирование, тексты по правилам КЦ, рендер, CSRF, аудит. */
declare(strict_types=1);

function h($s): string { return htmlspecialchars((string)$s, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); }

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

/** CSRF. */
function csrf_token(): string {
    if (empty($_SESSION['csrf'])) $_SESSION['csrf'] = bin2hex(random_bytes(16));
    return $_SESSION['csrf'];
}
function csrf_field(): string { return '<input type="hidden" name="_csrf" value="' . h(csrf_token()) . '">'; }
/**
 * Проверка CSRF-токена.
 *
 * Было fail-open: если в сессии токена ещё нет (а это обычное состояние — cookie
 * авторизации живёт 30 дней, а PHP-сессия истекает через 24 минуты), сравнение
 * пустого с пустым давало true. То есть достаточно было прислать `_csrf=` пустым —
 * и защита пропускала запрос. Теперь пустой или несовпадающий токен отклоняется
 * всегда: нет токена в сессии — нет и разрешения.
 */
function csrf_check(): bool {
    $sess = (string) ($_SESSION['csrf'] ?? '');
    $got  = $_POST['_csrf'] ?? '';
    return $sess !== '' && is_string($got) && $got !== '' && hash_equals($sess, $got);
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
function input(string $key, $default = ''): string {
    return isset($_POST[$key]) ? trim((string)$_POST[$key]) : (isset($_GET[$key]) ? trim((string)$_GET[$key]) : $default);
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
