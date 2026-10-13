<?php
/**
 * V.LIONOFF · вебхук Телеграма. Разбор живёт в core/bot_handler.php,
 * здесь только проверка секрета.
 */
declare(strict_types=1);

require_once __DIR__ . '/../../core/bot_handler.php';

$cfg = vc_cfg();
header('Content-Type: application/json; charset=utf-8');

$given = $_SERVER['HTTP_X_TELEGRAM_BOT_API_SECRET_TOKEN'] ?? '';
if ($cfg['bot_secret'] !== '' && !hash_equals($cfg['bot_secret'], $given)) {
  http_response_code(403);
  echo json_encode(['ok' => false]);
  exit;
}

$update = json_decode(file_get_contents('php://input'), true) ?: [];
try {
  vc_bot_update($update);
} catch (Throwable $e) {
  error_log('[vlionoff bot] ' . $e->getMessage());
}
echo json_encode(['ok' => true]);
