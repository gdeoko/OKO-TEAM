<?php
/**
 * Запрос комментария и рекомендации жюри — ТОЛЬКО для участников ВИП-клуба,
 * по СВОЕЙ ОЦЕНЁННОЙ заявке. Запрос уходит владельцу (раздел ВИП-клуба: email+TG+VK)
 * и фиксируется в jury_comment_requests (для изготовления комментария/рекомендации).
 */
declare(strict_types=1);
require __DIR__ . '/_boot.php';
require_post();

if (!request_same_origin_jr() || !csrf_check()) {
    json_out(['ok' => false, 'error' => 'Недопустимый источник запроса'], 403);
}
$u = current_user();
if (!$u) json_out(['ok' => false, 'error' => 'Требуется вход в кабинет'], 401);
$uid = (int) $u['id'];

// Только член клуба.
if (!function_exists('club_is_active') && is_file(BASE_PATH . '/core/club.php')) require_once BASE_PATH . '/core/club.php';
if (!function_exists('club_is_active') || !club_is_active($uid)) {
    json_out(['ok' => false, 'error' => 'Комментарий и рекомендация жюри доступны только участникам ВИП-клуба.'], 403);
}

$appId = (int) input('application_id');
$a = one("SELECT a.*, c.name comp_name FROM applications a LEFT JOIN competitions c ON c.id=a.competition_id
          WHERE a.id=? AND a.user_id=?", [$appId, $uid]);
if (!$a) json_out(['ok' => false, 'error' => 'Заявка не найдена'], 404);
if (trim((string) ($a['result'] ?? '')) === '') {
    json_out(['ok' => false, 'error' => 'Комментарий жюри можно запросить только по оценённой заявке.'], 409);
}

// Таблица запросов (мягкое создание).
try {
    q("CREATE TABLE IF NOT EXISTS jury_comment_requests (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        application_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        status TEXT DEFAULT 'new',
        created_at TEXT DEFAULT (datetime('now')),
        UNIQUE(application_id)
    )");
} catch (\Throwable $e) {}

$exists = one("SELECT id FROM jury_comment_requests WHERE application_id=?", [$appId]);
if ($exists) json_out(['ok' => true, 'already' => true, 'message' => 'Запрос уже отправлен — комментарий и рекомендация готовятся.']);

try { insert('jury_comment_requests', ['application_id' => $appId, 'user_id' => $uid, 'status' => 'new']); } catch (\Throwable $e) {}
audit('jury_comment_request', 'application', $appId, ['user' => $uid]);

// Уведомление владельца в раздел ВИП-клуба (email + Telegram + VK).
if (is_file(BASE_PATH . '/core/notify_owner.php')) {
    require_once BASE_PATH . '/core/notify_owner.php';
    if (function_exists('owner_notify')) {
        $adminUrl = rtrim((string) cfgv('base_url'), '/') . '/admin/?p=grading&id=' . $appId;
        owner_notify('ВИП-КЛУБ', 'Запрос комментария и рекомендации жюри', 'Участник ВИП-клуба запросил комментарий и рекомендацию жюри по оценённой заявке — изготовить и отправить.', [
            'Заявка'   => (string) $a['number'],
            'Конкурс'  => (string) ($a['comp_name'] ?? ''),
            'Участник' => (string) $a['full_name'],
            'Email'    => (string) $a['email'],
            'Результат'=> (string) $a['result'],
            '_event'   => 'club',
            '_actions' => [['Открыть заявку', $adminUrl]],
        ]);
    }
}

// In-app подтверждение участнику.
if (is_file(BASE_PATH . '/core/notifications.php')) {
    require_once BASE_PATH . '/core/notifications.php';
    if (function_exists('notify_user')) {
        notify_user($uid, 'Запрос отправлен', 'Комментарий и рекомендация жюри готовятся и придут на Вашу почту.', '/cabinet#apps', 'star');
    }
}

json_out(['ok' => true, 'message' => 'Запрос отправлен. Комментарий и рекомендация жюри будут изготовлены и отправлены.']);

/** Проверка Origin/Referer своего домена. */
function request_same_origin_jr(): bool {
    $hosts = [];
    if ($bu = cfgv('base_url')) { $h = parse_url((string) $bu, PHP_URL_HOST); if ($h) $hosts[] = strtolower($h); }
    foreach (['domain', 'domain_puny'] as $k) { if ($d = cfgv($k)) $hosts[] = strtolower((string) $d); }
    $hosts = array_values(array_unique(array_filter($hosts)));
    if (!$hosts) return true;
    $src = $_SERVER['HTTP_ORIGIN'] ?? ($_SERVER['HTTP_REFERER'] ?? '');
    if ($src === '') return false;
    $srcHost = strtolower((string) parse_url($src, PHP_URL_HOST));
    return $srcHost !== '' && in_array($srcHost, $hosts, true);
}
