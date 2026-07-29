<?php
/** Общие помощники: экранирование, тексты по правилам КЦ, рендер, CSRF, аудит. */
declare(strict_types=1);

function h($s): string { return htmlspecialchars((string)$s, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); }

function cfgv(string $key, $default = null) {
    static $c = null;
    if ($c === null) $c = $GLOBALS['CFG'] ?? require BASE_PATH . '/config.php';
    return $c[$key] ?? $default;
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
    $meta_description = $opts['meta'] ?? 'Международные и всероссийские онлайн-конкурсы и фестивали культуры и искусства. КЦ «Музыкальный Мир».';
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
function csrf_check(): bool {
    return isset($_POST['_csrf']) && hash_equals($_SESSION['csrf'] ?? '', $_POST['_csrf']);
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

function client_ip(): string {
    return $_SERVER['HTTP_CF_CONNECTING_IP'] ?? $_SERVER['HTTP_X_FORWARDED_FOR'] ?? $_SERVER['REMOTE_ADDR'] ?? '';
}

function audit(string $action, string $entity = '', ?int $entity_id = null, array $meta = []): void {
    insert('audit_log', [
        'user_id' => current_user()['id'] ?? null,
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

/** Логотип как base64 data-URI (для писем, дипломов, PDF). */
function logo_data_uri(): string {
    static $u = null;
    if ($u === null) {
        $f = BASE_PATH . '/public/assets/img/logo_muzmir_b64.txt';
        $u = is_file($f) ? trim(file_get_contents($f)) : asset('img/logo_muzmir_main.png');
    }
    return $u;
}
