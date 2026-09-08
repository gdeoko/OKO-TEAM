<?php
/**
 * /api/v1/admin/* — панель Екатерины.
 *
 * Все ручки требуют роли superadmin. Ни одна цифра здесь не выдумана:
 * если в базе пусто, ответ так и говорит, а панель пишет «пока никого».
 * Это не украшение отчёта, а рабочий инструмент: по нему школа решает,
 * кому написать и кого разблокировать.
 */

declare(strict_types=1);

function handle(array $segments, string $method): never
{
    $action = $segments[1] ?? '';
    $in = Response::input();
    Auth::requireSuperadmin();

    switch ("$method $action") {

        // ── GET /admin/svodka — числа для первого экрана ──────
        case 'GET svodka':
            $одно = static fn(string $sql, array $p = []): int
                => (int) (DB::query($sql, $p)->fetchColumn() ?: 0);

            $семей = $одно('SELECT COUNT(*) FROM users WHERE role IN ("parent","student12")');
            $детей = $одно('SELECT COUNT(*) FROM children');
            Response::ok([
                'семей' => $семей,
                'детей' => $детей,
                'семейЗаНеделю' => $одно(
                    'SELECT COUNT(*) FROM users WHERE role IN ("parent","student12")
                       AND created_at > DATE_SUB(NOW(), INTERVAL 7 DAY)'),
                'заходилиЗаНеделю' => $одно(
                    'SELECT COUNT(*) FROM users WHERE role IN ("parent","student12")
                       AND last_seen_at > DATE_SUB(NOW(), INTERVAL 7 DAY)'),
                'уроковПройдено' => $одно(
                    'SELECT COUNT(*) FROM lesson_progress WHERE completed_at IS NOT NULL'),
                'почтаНеПодтверждена' => $одно(
                    'SELECT COUNT(*) FROM users WHERE email_verified_at IS NULL
                      AND role IN ("parent","student12")'),
                'заблокированы' => $одно('SELECT COUNT(*) FROM users WHERE is_blocked = 1'),
                'записейМодерации' => $одно('SELECT COUNT(*) FROM moderation_log'),
            ]);

        // ── GET /admin/semi — список семей ────────────────────
        case 'GET semi':
            $поиск = trim((string) ($_GET['q'] ?? ''));
            $предел = max(1, min(200, (int) ($_GET['limit'] ?? 50)));
            $где = 'WHERE u.role IN ("parent","student12")';
            $параметры = [];
            if ($поиск !== '') {
                $где .= ' AND (u.name LIKE ? OR u.email LIKE ?)';
                $параметры[] = '%' . $поиск . '%';
                $параметры[] = '%' . $поиск . '%';
            }
            $строки = DB::query(
                "SELECT u.id, u.name, u.email, u.city, u.is_blocked, u.created_at,
                        u.last_seen_at, u.email_verified_at,
                        (SELECT COUNT(*) FROM children c WHERE c.parent_id = u.id) AS detey
                   FROM users u $где
                  ORDER BY u.created_at DESC
                  LIMIT $предел", $параметры)->fetchAll();
            Response::ok(['семьи' => $строки]);

        // ── GET /admin/semya?id=N — одна семья с детьми ───────
        case 'GET semya':
            $id = (int) ($_GET['id'] ?? 0);
            $семья = DB::query(
                'SELECT id, name, email, city, country, confession, is_blocked,
                        created_at, last_seen_at, email_verified_at
                   FROM users WHERE id = ?', [$id])->fetch();
            if (!$семья) Response::error('Такой семьи нет', 404);
            $дети = DB::query(
                'SELECT c.id, c.name, c.age, c.xp, c.rank_level,
                        COALESCE(s.current_days, 0) AS streak,
                        (SELECT COUNT(*) FROM lesson_progress lp
                          WHERE lp.child_id = c.id AND lp.completed_at IS NOT NULL) AS urokov
                   FROM children c
                   LEFT JOIN streaks s ON s.child_id = c.id
                  WHERE c.parent_id = ?
                  ORDER BY c.id', [$id])->fetchAll();
            Response::ok(['семья' => $семья, 'дети' => $дети]);

        // ── GET /admin/deti — кто как учится ──────────────────
        case 'GET deti':
            $предел = max(1, min(200, (int) ($_GET['limit'] ?? 20)));
            $строки = DB::query(
                "SELECT c.id, c.name, c.age, c.xp, u.name AS semya, u.email,
                        COALESCE(s.current_days, 0) AS streak,
                        (SELECT COUNT(*) FROM lesson_progress lp
                          WHERE lp.child_id = c.id AND lp.completed_at IS NOT NULL) AS urokov
                   FROM children c
                   JOIN users u ON u.id = c.parent_id
                   LEFT JOIN streaks s ON s.child_id = c.id
                  ORDER BY urokov DESC, c.xp DESC
                  LIMIT $предел")->fetchAll();
            Response::ok(['дети' => $строки]);

        // ── GET /admin/uroki — какие уроки проходят ───────────
        case 'GET uroki':
            $строки = DB::query(
                'SELECT lesson_id, COUNT(*) AS proshli
                   FROM lesson_progress
                  WHERE completed_at IS NOT NULL
                  GROUP BY lesson_id
                  ORDER BY proshli DESC, lesson_id
                  LIMIT 20')->fetchAll();
            Response::ok(['уроки' => $строки]);

        // ── GET /admin/moderaciya — что делали модераторы ─────
        case 'GET moderaciya':
            $строки = DB::query(
                'SELECT m.id, m.action, m.reason, m.created_at,
                        mo.name AS moderator, t.name AS komu
                   FROM moderation_log m
                   LEFT JOIN users mo ON mo.id = m.moderator_id
                   LEFT JOIN users t ON t.id = m.target_user_id
                  ORDER BY m.id DESC
                  LIMIT 50')->fetchAll();
            Response::ok(['записи' => $строки]);

        // ── POST /admin/blokirovka — закрыть или вернуть доступ ─
        case 'POST blokirovka':
            $я = Auth::requireSuperadmin();
            $id = (int) ($in['id'] ?? 0);
            $закрыть = !empty($in['blocked']);
            if ($id === (int) $я['id']) {
                Response::error('Себя блокировать нельзя', 422);
            }
            $кто = DB::query('SELECT id, name, role FROM users WHERE id = ?', [$id])->fetch();
            if (!$кто) Response::error('Такой семьи нет', 404);
            if ($кто['role'] === 'superadmin') {
                Response::error('Педагога школы блокировать нельзя', 422);
            }
            DB::query('UPDATE users SET is_blocked = ? WHERE id = ?', [$закрыть ? 1 : 0, $id]);
            // Закрыли доступ — гасим и открытые входы, иначе человек
            // продолжит пользоваться школой со старого телефона.
            if ($закрыть) DB::query('DELETE FROM sessions WHERE user_id = ?', [$id]);
            DB::query(
                'INSERT INTO moderation_log (moderator_id, action, target_user_id, reason)
                 VALUES (?, ?, ?, ?)',
                [(int) $я['id'], $закрыть ? 'ban' : 'unban', $id,
                 mb_substr(trim((string) ($in['reason'] ?? '')), 0, 255) ?: null]
            );
            Response::ok(['id' => $id, 'blocked' => $закрыть]);

        default:
            Response::error('Не найдено', 404);
    }
}
