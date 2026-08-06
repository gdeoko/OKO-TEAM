<?php
/**
 * Живая проверка конкурсной видео-ссылки на шаге подачи заявки.
 * Форма зовёт этот эндпоинт при переходе с шага «Номер», чтобы НЕ пропустить
 * дальше заведомо неверную ссылку: несуществующую, закрытую, не видео или
 * старше 1 года. Ответ: { ok, state, platform, stale, reason }.
 */
declare(strict_types=1);
require __DIR__ . '/_boot.php';
require_once BASE_PATH . '/core/link_check.php';

$url = trim((string) input('url'));
if ($url === '') json_out(['ok' => false, 'state' => 'bad', 'reason' => 'Пустая ссылка']);
if (mb_strlen($url) > 500) json_out(['ok' => false, 'state' => 'bad', 'reason' => 'Слишком длинная ссылка']);

$r = video_verify($url);
json_out([
    'ok'       => (bool)($r['ok'] ?? false),
    'state'    => (string)($r['state'] ?? 'bad'),
    'platform' => (string)($r['platform'] ?? ''),
    'stale'    => $r['stale'] ?? null,
    'reason'   => (string)($r['reason'] ?? ''),
]);
