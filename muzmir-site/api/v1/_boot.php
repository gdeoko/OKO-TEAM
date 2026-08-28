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
// ПОЧТОВЫЙ СЛОЙ ПОДКЛЮЧАЕМ ВСЕГДА.
//
// Половина кода спрашивает function_exists('mail_queue') и молча пропускает
// отправку, если ответ «нет». Ни один из трёх входов в приложение почту не
// подключал, и каждая такая ветка была миной: кнопка «Подтвердить почту» в
// кабинете именно так и не работала — редирект без письма и без ошибки.
// Файл только объявляет функции и цвета, ничего не выполняет, поэтому платить
// за него можно везде.
require_once BASE_PATH . '/core/mailer.php';

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

/* yukassa_create_payment переехала в core/payments.php — ею пользуются
   и API, и страница оплаты /pay (ссылки «Оплатить» из писем). */



/** Прокси-запрос в мозг-агент. Тихий фолбэк на null при недоступности. */
function agent_chat_proxy(string $url, string $token, string $text, string $session, ?int $uid): ?string {
    $ch = curl_init(rtrim($url, '/'));
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST           => true,
        /* Внешнему мозгу нужны те же правила, по которым отвечает свой:
         * иначе он ответит «как ассистент», без знаний центра и его манеры. */
        CURLOPT_POSTFIELDS     => json_encode([
            'text'    => $text,
            'session' => $session,
            'user_id' => $uid,
            'system'  => function_exists('chat_system_prompt') ? chat_system_prompt() : '',
        ], JSON_UNESCAPED_UNICODE),
        CURLOPT_HTTPHEADER     => array_values(array_filter([
            'Content-Type: application/json',
            $token ? 'Authorization: Bearer ' . $token : null,
        ])),
        /* Запасной мозг — это живой кабинет ChatGPT в браузере агента, и ответ
         * оттуда идёт около полуминуты. Пятнадцати секунд не хватало никогда:
         * запрос обрывался, и участник получал заготовку. Ответ в чате всё
         * равно показывается с задержкой, так что подождать можно. */
        CURLOPT_TIMEOUT        => 60,
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
