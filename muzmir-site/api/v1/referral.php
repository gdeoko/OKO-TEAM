<?php
/**
 * Реферальные промокоды педагогов.
 *   POST  - создать свой промокод (роль teacher и выше).
 *   GET   - статистика применений и начислений по своим кодам.
 */
declare(strict_types=1);
require __DIR__ . '/_boot.php';
require_once BASE_PATH . '/core/loyalty.php';

$user = current_user();
if (!$user) json_out(['ok' => false, 'error' => 'Требуется вход в аккаунт'], 401);
if (!user_can('teacher')) json_out(['ok' => false, 'error' => 'Раздел доступен только педагогам'], 403);

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

/* ---------- GET: статистика ---------- */
if ($method === 'GET') {
    $codes = referral_stats((int) $user['id']);
    $rewardTotal = 0;
    $usesTotal = 0;
    foreach ($codes as $c) { $rewardTotal += $c['reward_total']; $usesTotal += $c['uses']; }
    json_out([
        'ok'           => true,
        'codes'        => $codes,
        'uses_total'   => $usesTotal,
        'reward_total' => $rewardTotal,
    ]);
}

/* ---------- POST: создать код ---------- */
require_post();
if (!csrf_check()) json_out(['ok' => false, 'error' => 'Сессия устарела. Обновите страницу и попробуйте снова'], 419);
if (!rate_ok('referral:' . $user['id'], 20, 3600)) {
    json_out(['ok' => false, 'error' => 'Слишком много запросов, попробуйте позже'], 429);
}

$wantCode = input('code');
$percent  = (int) input('percent', '5');
$reward   = (int) input('reward_percent', '10');
$note     = input('note');

$ref = referral_create((int) $user['id'], $wantCode, $percent, $reward, $note);
audit('referral_create', 'referrals', (int) ($ref['id'] ?? 0), ['code' => $ref['code'] ?? '']);

json_out([
    'ok'             => true,
    'code'           => $ref['code'] ?? '',
    'percent'        => (int) ($ref['percent'] ?? $percent),
    'reward_percent' => (int) ($ref['reward_percent'] ?? $reward),
]);
