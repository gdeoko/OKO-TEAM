<?php
/**
 * СНЯТЬ У UNISENDER ПОМЕТКУ «АДРЕС ВРЕМЕННО НЕДОСТУПЕН».
 *
 *   php scripts/uni_unsuppress.php                     — показать, что снял бы
 *   php scripts/uni_unsuppress.php --apply             — снять
 *   php scripts/uni_unsuppress.php --apply --limit=500
 *   php scripts/uni_unsuppress.php --email=адрес --apply
 *
 * Сервис рассылок ведёт собственный список недоступных адресов. Каждый отказ
 * Mail.ru клал туда очередной адрес участника, и теперь Unisender отклоняет
 * письмо САМ, ещё до попытки отправки: ответ «No valid recipients»,
 * failed_emails → temporary_unavailable. Проверено 8 сентября на собственном
 * ящике центра: пока пометка стояла, письмо не уходило вовсе; после снятия
 * ушло и легло в очередь сервиса.
 *
 * Из этого следует важное: когда Mail.ru снимет ограничение с домена, очередь
 * САМА не поедет. Дверь будет открыта, а сервис продолжит отказывать по своей
 * старой памяти. Пометки надо снять — и снимать их приходится по одному адресу
 * за вызов, поэтому здесь пачка с паузой, а не один запрос.
 *
 * Берём адреса не из воздуха, а из очереди: только те, кому мы и правда должны
 * письмо (status='queued'). Чужие и мёртвые адреса не трогаем — пометка на них
 * стоит по делу.
 *
 * Пометки вида «отписался» и «жалоба на спам» НЕ снимаем никогда: это решение
 * человека, а не сбой почтовой службы.
 */
declare(strict_types=1);
if (PHP_SAPI !== 'cli') { fwrite(STDERR, "CLI only\n"); exit(1); }

define('BASE_PATH', dirname(__DIR__));
$GLOBALS['CFG'] = require BASE_PATH . '/config.php';
require_once BASE_PATH . '/core/db.php';
require_once BASE_PATH . '/core/helpers.php';
require_once BASE_PATH . '/core/mailer.php';

$opt = [];
foreach (array_slice($argv, 1) as $a)
    if (preg_match('~^--([a-z-]+)(?:=(.*))?$~u', $a, $m)) $opt[$m[1]] = $m[2] ?? '1';
$apply = isset($opt['apply']);
$limit = max(1, (int) ($opt['limit'] ?? 300));
$type  = trim((string) ($opt['type'] ?? 'konkurs'));
$only  = mb_strtolower(trim((string) ($opt['email'] ?? '')));

$key = trim((string) cfgv('unisender_api_key', ''));
if ($key === '') { fwrite(STDERR, "нет ключа Unisender\n"); exit(1); }
$base = rtrim((string) cfgv('unisender_api_url', 'https://go2.unisender.ru/ru/transactional/api/v1'), '/');

/** Один запрос к сервису. Возвращает разобранный ответ либо null. */
function uu_call(string $url, array $payload): ?array {
    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => json_encode($payload, JSON_UNESCAPED_UNICODE),
        CURLOPT_HTTPHEADER     => ['Content-Type: application/json'],
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 30,
        CURLOPT_CONNECTTIMEOUT => 15,
    ]);
    $raw = curl_exec($ch);
    curl_close($ch);
    $d = json_decode((string) $raw, true);
    return is_array($d) ? $d : null;
}

/* Список адресов. Либо один названный, либо очередь по типу кампании. */
if ($only !== '') {
    $emails = [$only];
} else {
    $rows = all("SELECT DISTINCT lower(to_email) e FROM mail_queue
                  WHERE status='queued' AND campaign_type=?
                    AND (lower(to_email) LIKE '%@mail.ru' OR lower(to_email) LIKE '%@bk.ru'
                      OR lower(to_email) LIKE '%@inbox.ru' OR lower(to_email) LIKE '%@list.ru'
                      OR lower(to_email) LIKE '%@internet.ru')
                  ORDER BY e LIMIT ?", [$type, $limit]);
    $emails = array_map(fn($r) => (string) $r['e'], $rows);
}

printf("адресов к разбору: %d%s\n", count($emails), $apply ? '' : '  (сухой прогон)');

/* Причины, которые ставит сама почтовая служба из-за нашей репутации, — снимаем.
 * Решения человека — не трогаем. */
$fixable = ['temporary_unavailable', 'permanent_unavailable', 'temporary_failed'];
$human   = ['unsubscribed', 'complained', 'blocked_by_user', 'manual'];

$freed = 0; $kept = 0; $clean = 0; $err = 0;
foreach ($emails as $em) {
    $got = uu_call($base . '/suppression/get.json', ['api_key' => $key, 'email' => $em]);
    $list = (array) ($got['suppressions'] ?? []);
    if (!$list) { $clean++; continue; }

    $causes = array_map(fn($s) => (string) ($s['cause'] ?? ''), $list);
    if (array_intersect($causes, $human)) {
        $kept++;
        printf("  оставлено  %-38s %s\n", $em, implode(',', $causes));
        continue;
    }
    if (!array_intersect($causes, $fixable)) {
        $kept++;
        printf("  неизвестно %-38s %s\n", $em, implode(',', $causes));
        continue;
    }
    if (!$apply) { $freed++; printf("  снял бы    %-38s %s\n", $em, implode(',', $causes)); continue; }

    $res = uu_call($base . '/suppression/delete.json', ['api_key' => $key, 'email' => $em]);
    if ($res && (string) ($res['status'] ?? '') === 'success') $freed++;
    else { $err++; printf("  ОШИБКА     %-38s %s\n", $em, mb_substr(json_encode($res, JSON_UNESCAPED_UNICODE), 0, 90)); }

    // Сервис считает запросы; спешить некуда — очередь всё равно уходит темпом
    // рассылки, а не темпом снятия пометок.
    usleep(120000);
}

printf("\nснято: %d, оставлено по решению человека: %d, без пометок: %d, ошибок: %d\n",
       $freed, $kept, $clean, $err);
if (!$apply) echo "это был сухой прогон — повторить с --apply\n";
