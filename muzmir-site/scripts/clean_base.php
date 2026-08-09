<?php
/**
 * ЧИСТКА ПОДПИСНОЙ БАЗЫ. По умолчанию — сухой прогон (ничего не меняет).
 * Реальная чистка: php scripts/clean_base.php --apply
 *
 * ПОЧЕМУ НЕ ПРОСТО «DELETE FROM subscribers»
 * Получатели рассылки берутся UNION'ом двух таблиц (core/newsletter.php,
 * nl_resolve_recipients): активные subscribers ПЛЮС users с notify_email=1.
 * 9140 из 9175 адресов есть в обеих. Если удалить строку из subscribers, ветка
 * users подставит тот же адрес заново, а nl_ensure_subscriber() создаст для него
 * СВЕЖУЮ строку с active=1 — то есть удаление воскресит мёртвый адрес.
 * Поэтому «убрать из базы» здесь означает: подавить в обеих таблицах.
 *
 * ЧТО ДЕЛАЕМ
 *   1. Недоставляемые (домен без MX, домен-опечатка, домен без почты, одноразовые,
 *      битый синтаксис):
 *         subscribers.active = 0, в tags добавляем 'invalid'  — это список подавления,
 *                                  он же не даёт адресу вернуться при повторном импорте;
 *         users.notify_email = 0                              — закрываем вторую ветку.
 *      Аккаунт пользователя НЕ трогаем: у него могут быть заявки, дипломы и оплаты.
 *   2. Дубли-алиасы (ya.ru/yandex.com/yandex.by и gmail с точками — это один ящик):
 *      оставляем канонический адрес, алиасы гасим так же (active=0 + тег 'alias').
 *   3. Ролевые (info@, admin@): active=0 + тег 'role'. Они доставляемы, но читают их
 *      редко, а жалуются с них чаще — на старте это лишний риск.
 *   4. Отказников (тег 'bounced', уже active=0) НЕ УДАЛЯЕМ: это рабочий список
 *      подавления. Удалив их, мы разрешим повторный импорт тех же мёртвых адресов.
 *
 * Всё удаляемое выгружается в JSON, чтобы решение можно было отменить.
 */
declare(strict_types=1);

define('BASE_PATH', dirname(__DIR__));
$GLOBALS['CFG'] = require BASE_PATH . '/config.php';
foreach (['db', 'helpers'] as $m) require_once BASE_PATH . '/core/' . $m . '.php';

$APPLY = in_array('--apply', $argv, true);
$AUDIT = '/tmp/base_audit.json';
foreach ($argv as $a) if (str_starts_with($a, '--audit=')) $AUDIT = substr($a, 8);

if (!is_file($AUDIT)) {
    fwrite(STDERR, "Нет файла аудита $AUDIT — сначала: php scripts/audit_base.php --json=$AUDIT\n");
    exit(1);
}
$audit = json_decode((string) file_get_contents($AUDIT), true);
if (!is_array($audit)) { fwrite(STDERR, "Файл аудита повреждён\n"); exit(1); }

echo $APPLY ? "РЕЖИМ: РЕАЛЬНАЯ ЧИСТКА\n\n" : "РЕЖИМ: сухой прогон (--apply чтобы применить)\n\n";

/* ─── 1. Недоставляемые ─── */
// Причины, означающие «письмо физически не дойдёт».
$HARD = ['домен без MX', 'опечатка домена', 'домен без почты', 'одноразовая почта', 'синтаксис', 'нет домена'];

$hardIds = []; $roleIds = [];
foreach (($audit['flagged'] ?? []) as $id => $f) {
    $why = array_map(fn($w) => preg_replace('~ → .*$~u', '', $w), (array) ($f['why'] ?? []));
    if (array_intersect($why, $HARD))          $hardIds[(int) $id] = (string) $f['email'];
    elseif (in_array('ролевой адрес', $why))   $roleIds[(int) $id] = (string) $f['email'];
}

/* ─── 2. Дубли-алиасы: оставить канонический ─── */
$aliasIds = [];
foreach (($audit['dup_groups'] ?? []) as $norm => $ids) {
    $ids = array_map('intval', (array) $ids);
    if (count($ids) < 2) continue;
    // Канонический = тот, чей адрес точно совпал с нормализованным (обычно @yandex.ru
    // против @ya.ru), иначе — самый ранний по id.
    $keep = null;
    foreach ($ids as $i) {
        $e = mb_strtolower((string) (one("SELECT email FROM subscribers WHERE id=?", [$i])['email'] ?? ''));
        if ($e === $norm) { $keep = $i; break; }
    }
    if ($keep === null) { sort($ids); $keep = $ids[0]; }
    foreach ($ids as $i) if ($i !== $keep) {
        $e = (string) (one("SELECT email FROM subscribers WHERE id=?", [$i])['email'] ?? '');
        if ($e !== '') $aliasIds[$i] = $e;
    }
}

// Пересечения: жёсткая причина важнее алиаса.
foreach (array_keys($hardIds) as $i) { unset($aliasIds[$i], $roleIds[$i]); }

printf("Недоставляемые:      %4d\n", count($hardIds));
printf("Дубли-алиасы:        %4d\n", count($aliasIds));
printf("Ролевые:             %4d\n", count($roleIds));
$totalTouch = count($hardIds) + count($aliasIds) + count($roleIds);
printf("ИТОГО к подавлению:  %4d\n\n", $totalTouch);

$activeBefore = (int) scalar("SELECT COUNT(*) FROM subscribers WHERE active=1");
echo "Активных подписчиков сейчас: $activeBefore\n";

/* ─── Применение ─── */
$plan = [
    ['ids' => $hardIds,  'tag' => 'invalid', 'label' => 'недоставляемые'],
    ['ids' => $aliasIds, 'tag' => 'alias',   'label' => 'дубли-алиасы'],
    ['ids' => $roleIds,  'tag' => 'role',    'label' => 'ролевые'],
];

$removed = [];
$usersMuted = 0;

if ($APPLY) {
    $pdo = db();
    $pdo->beginTransaction();
    try {
        foreach ($plan as $p) {
            foreach ($p['ids'] as $id => $email) {
                $row = one("SELECT id, email, tags, active FROM subscribers WHERE id=?", [(int) $id]);
                if (!$row) continue;
                $tags = trim((string) $row['tags']);
                if (!str_contains($tags, $p['tag'])) $tags = $tags === '' ? $p['tag'] : ($tags . ',' . $p['tag']);
                update('subscribers', ['active' => 0, 'tags' => $tags], 'id=:id', ['id' => (int) $id]);

                // Вторая ветка UNION: гасим уведомления у аккаунта с тем же адресом.
                $u = one("SELECT id, notify_email FROM users WHERE lower(email)=lower(?)", [$email]);
                if ($u && (int) ($u['notify_email'] ?? 1) === 1) {
                    update('users', ['notify_email' => 0], 'id=:id', ['id' => (int) $u['id']]);
                    $usersMuted++;
                }
                $removed[] = ['id' => (int) $id, 'email' => $email, 'reason' => $p['tag'], 'had_user' => (bool) $u];
            }
        }
        $pdo->commit();
    } catch (\Throwable $e) {
        $pdo->rollBack();
        fwrite(STDERR, "ОТКАТ: " . $e->getMessage() . "\n");
        exit(1);
    }

    $dump = '/var/www/muzmir/data/logs/base_cleanup_' . date('Ymd-His') . '.json';
    @file_put_contents($dump, json_encode([
        'at' => date('c'), 'removed' => $removed, 'users_muted' => $usersMuted,
    ], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
    echo "\nПодавлено записей: " . count($removed) . "\n";
    echo "Аккаунтов с выключенными уведомлениями: $usersMuted\n";
    echo "Выгрузка для отката: $dump\n";
    if (function_exists('audit')) audit('base_cleanup', 'subscribers', 0, ['count' => count($removed), 'users_muted' => $usersMuted]);
} else {
    echo "\nПримеры того, что будет подавлено:\n";
    foreach ($plan as $p) {
        $sample = array_slice($p['ids'], 0, 5, true);
        foreach ($sample as $id => $email) printf("  [%-8s] #%-7d %s\n", $p['tag'], $id, $email);
        if (count($p['ids']) > 5) printf("  [%-8s] … ещё %d\n", $p['tag'], count($p['ids']) - 5);
    }
}

$activeAfter = (int) scalar("SELECT COUNT(*) FROM subscribers WHERE active=1");
echo "\nАктивных подписчиков " . ($APPLY ? "стало" : "станет") . ": "
   . ($APPLY ? $activeAfter : ($activeBefore - $totalTouch)) . "\n";

/* ─── Итоговая реальная аудитория рассылки ─── */
$reach = (int) scalar(
    "SELECT COUNT(*) FROM (
        SELECT lower(s.email) e FROM subscribers s WHERE s.active=1
        UNION
        SELECT lower(u.email) e FROM users u
         WHERE COALESCE(u.email,'')<>'' AND COALESCE(u.blocked,0)=0 AND COALESCE(u.notify_email,1)=1
           AND COALESCE(u.role,'user') NOT IN ('owner','admin','orgcom'))"
);
echo "Аудитория ВИП-волны (UNION, как в коде): $reach\n";
