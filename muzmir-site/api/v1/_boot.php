<?php
/**
 * Бутстрап REST API v1 сайта Культурного центра «Музыкальный Мир».
 * Подключается первой строкой каждого эндпоинта api/v1/*.php.
 * Готовит фундамент так же, как public/index.php, плюс JSON-заголовки, CORS,
 * приём JSON-тела и общие помощники для эндпоинтов.
 */
declare(strict_types=1);

if (!defined('BASE_PATH')) define('BASE_PATH', dirname(__DIR__, 2));

$CFG = $GLOBALS['CFG'] ?? require BASE_PATH . '/config.php';
$GLOBALS['CFG'] = $CFG;

require_once BASE_PATH . '/core/db.php';
require_once BASE_PATH . '/core/data.php';
require_once BASE_PATH . '/core/helpers.php';
require_once BASE_PATH . '/core/auth.php';

// Опциональные сервисы фундамента — подключаем, если файлы уже собраны.
foreach (['mailer', 'validator', 'telegram', 'payments'] as $svc) {
    $f = BASE_PATH . '/core/' . $svc . '.php';
    if (is_file($f)) require_once $f;
}

if (session_status() !== PHP_SESSION_ACTIVE) session_start();
db(); // инициализация/миграции

/* ---------- CORS: только свои домены ---------- */
$__allowed = [];
if ($bu = cfgv('base_url')) $__allowed[] = rtrim($bu, '/');
foreach (['domain', 'domain_puny'] as $k) {
    if ($d = cfgv($k)) { $__allowed[] = 'https://' . $d; $__allowed[] = 'http://' . $d; }
}
$__origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if ($__origin && in_array(rtrim($__origin, '/'), $__allowed, true)) {
    header('Access-Control-Allow-Origin: ' . $__origin);
    header('Vary: Origin');
    header('Access-Control-Allow-Credentials: true');
}
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');
header('Content-Type: application/json; charset=utf-8');

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'OPTIONS') {
    http_response_code(204);
    exit;
}

/* ---------- Приём JSON-тела в $_POST (для input()/current_user API) ---------- */
if (empty($_POST) && str_contains($_SERVER['CONTENT_TYPE'] ?? '', 'application/json')) {
    $__raw = file_get_contents('php://input');
    if ($__raw) {
        $__j = json_decode($__raw, true);
        if (is_array($__j)) $_POST = array_merge($_POST, $__j);
    }
}

/* ---------- Общие помощники эндпоинтов ---------- */

/** Требовать метод POST, иначе 405. */
function require_post(): void {
    if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
        json_out(['ok' => false, 'error' => 'Метод не поддерживается'], 405);
    }
}

/** Существует ли таблица в SQLite. Каноническое определение — в core/db.php
 *  (доступно и кронам, и вебу). Здесь — страховка на случай изменения порядка подключений. */
if (!function_exists('tbl_exists')) {
    function tbl_exists(string $t): bool {
        return (bool) one("SELECT name FROM sqlite_master WHERE type='table' AND name=?", [$t]);
    }
}

/** Номер заявки формата CODE-ГГГГ-NNNNN (код конкурса + год + порядковый по конкурсу). */
function gen_application_number(array $comp): string {
    $code = ($comp['code'] ?? '') !== '' ? $comp['code'] : 'MM';
    $year = date('Y');
    for ($attempt = 0; $attempt < 6; $attempt++) {
        $cnt = (int) scalar("SELECT COUNT(*) FROM applications WHERE competition_id=?", [(int)$comp['id']]);
        $number = sprintf('%s-%s-%05d', $code, $year, $cnt + 1 + $attempt);
        if (!one("SELECT id FROM applications WHERE number=?", [$number])) return $number;
    }
    return sprintf('%s-%s-%05d', $code, $year, time() % 100000);
}

/**
 * Создание платежа ЮKassa (заглушка, пока магазин не верифицирован).
 * Если ключи не заданы — возвращает stub. Все ошибки cURL — тихий фолбэк на null.
 */
function yukassa_create_payment(int $amount, string $description, array $meta = []): ?array {
    $shop = cfgv('yukassa_shop');
    $secret = cfgv('yukassa_secret');
    if (!$shop || !$secret || $amount <= 0) {
        return ['id' => 'stub-' . bin2hex(random_bytes(6)), 'status' => 'pending', 'stub' => true, 'confirmation_url' => null];
    }
    $body = [
        'amount'       => ['value' => number_format($amount, 2, '.', ''), 'currency' => 'RUB'],
        'capture'      => true,
        'confirmation' => ['type' => 'redirect', 'return_url' => rtrim(cfgv('base_url'), '/') . '/cabinet'],
        'description'  => mb_substr($description, 0, 128),
        'metadata'     => $meta,
    ];
    // Чек 54-ФЗ (для самозанятого/НПД ЮKassa регистрирует чек). Добавляем, если есть email.
    $email = $meta['email'] ?? '';
    if ($email !== '' && filter_var($email, FILTER_VALIDATE_EMAIL)) {
        $body['receipt'] = [
            'customer' => ['email' => $email],
            'items'    => [[
                'description'     => mb_substr($description, 0, 128),
                'quantity'        => '1.00',
                'amount'          => ['value' => number_format($amount, 2, '.', ''), 'currency' => 'RUB'],
                'vat_code'        => 1,              // без НДС (самозанятый/НПД)
                'payment_mode'    => 'full_payment',
                'payment_subject' => 'service',
            ]],
        ];
    }
    $payload = json_encode($body, JSON_UNESCAPED_UNICODE);
    $ch = curl_init('https://api.yookassa.ru/v3/payments');
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => $payload,
        CURLOPT_USERPWD        => $shop . ':' . $secret,
        CURLOPT_HTTPHEADER     => ['Content-Type: application/json', 'Idempotence-Key: ' . bin2hex(random_bytes(16))],
        CURLOPT_TIMEOUT        => 10,
    ]);
    $resp = curl_exec($ch);
    $err = curl_errno($ch);
    curl_close($ch);
    if ($err || !$resp) return null;
    $data = json_decode($resp, true);
    if (!is_array($data) || empty($data['id'])) return null;
    return [
        'id'               => $data['id'],
        'status'           => $data['status'] ?? 'pending',
        'confirmation_url' => $data['confirmation']['confirmation_url'] ?? null,
    ];
}

/** Прокси-запрос в мозг-агент. Тихий фолбэк на null при недоступности. */
function agent_chat_proxy(string $url, string $token, string $text, string $session, ?int $uid): ?string {
    $ch = curl_init(rtrim($url, '/'));
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => json_encode(['text' => $text, 'session' => $session, 'user_id' => $uid], JSON_UNESCAPED_UNICODE),
        CURLOPT_HTTPHEADER     => array_values(array_filter([
            'Content-Type: application/json',
            $token ? 'Authorization: Bearer ' . $token : null,
        ])),
        CURLOPT_TIMEOUT        => 15,
    ]);
    $resp = curl_exec($ch);
    $err = curl_errno($ch);
    curl_close($ch);
    if ($err || !$resp) return null;
    $d = json_decode($resp, true);
    if (is_array($d)) return $d['reply'] ?? $d['text'] ?? $d['message'] ?? null;
    return null;
}

/** Отправка сообщения в Telegram напрямую (фолбэк, если core/telegram.php ещё нет). */
function tg_send_raw(string $chatId, string $text): void {
    $tok = cfgv('tg_bot_token');
    if (!$tok || !$chatId) return;
    $ch = curl_init("https://api.telegram.org/bot{$tok}/sendMessage");
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => http_build_query(['chat_id' => $chatId, 'text' => $text, 'disable_web_page_preview' => 1]),
        CURLOPT_TIMEOUT        => 8,
    ]);
    curl_exec($ch);
    curl_close($ch);
}
