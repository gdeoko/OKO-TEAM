<?php
/** /api/v1/users/* — профиль родителя и профили детей. */

declare(strict_types=1);

/** Ребёнок этого родителя или ошибка. */
function users_child(array $user, string $raw): array
{
    $id = (int) $raw;
    if ($id <= 0) Response::error('Не указан профиль ребёнка', 422);
    $child = DB::query('SELECT * FROM children WHERE id = ?', [$id])->fetch();
    if (!$child) Response::error('Профиль ребёнка не найден', 404);
    if ((int) $child['parent_id'] !== (int) $user['id']) {
        Response::error('Это чужой профиль', 403);
    }
    return $child;
}

/** Имя, возраст, пол и аватар из тела запроса. */
function users_child_fields(array $in, array $base = []): array
{
    $name = trim((string) ($in['name'] ?? $base['name'] ?? ''));
    if (mb_strlen($name) < 2) Response::error('Введите имя ребёнка', 422);
    if (mb_strlen($name) > 120) $name = mb_substr($name, 0, 120);

    $age = (int) ($in['age'] ?? $base['age'] ?? 7);
    $gender = $in['gender'] ?? $base['gender'] ?? null;
    $avatar = (string) ($in['avatar_key'] ?? $base['avatar_key'] ?? 'angel');

    return [
        $name,
        max(5, min(14, $age)),
        in_array($gender, ['m', 'f'], true) ? $gender : null,
        preg_replace('/[^a-z0-9-]/', '', $avatar) ?: 'angel',
    ];
}

function handle(array $segments, string $method): never
{
    $action = $segments[1] ?? '';
    $in = Response::input();
    $user = Auth::requireUser();

    switch ("$method $action") {

        // ── GET /users/me — родитель и его дети ───────────
        case 'GET me':
            $children = DB::query(
                'SELECT c.id, c.name, c.age, c.gender, c.avatar_key, c.xp, c.rank_level,
                        s.current_days, s.best_days, s.last_active_date,
                        st.rev AS state_rev, st.updated_at AS state_updated_at
                   FROM children c
              LEFT JOIN streaks s ON s.child_id = c.id
              LEFT JOIN child_state st ON st.child_id = c.id
                  WHERE c.parent_id = ?
               ORDER BY c.id',
                [(int) $user['id']]
            )->fetchAll();

            Response::ok([
                'user' => [
                    'id'    => (int) $user['id'],
                    'name'  => $user['name'] ?? '',
                    'email' => $user['email'] ?? '',
                    'role'  => $user['role'] ?? 'parent',
                ],
                'children' => $children,
            ]);

        // ── GET /users/children — список детей ────────────
        case 'GET children':
            Response::ok(DB::query(
                'SELECT id, name, age, gender, avatar_key, xp, rank_level
                   FROM children WHERE parent_id = ? ORDER BY id',
                [(int) $user['id']]
            )->fetchAll());

        // ── POST /users/children — добавить ребёнка ───────
        case 'POST children':
            $limit = 5; // подписку из договора убрали, лимит один для всех
            $count = (int) DB::query('SELECT COUNT(*) c FROM children WHERE parent_id = ?',
                [(int) $user['id']])->fetch()['c'];
            if ($count >= $limit) {
                Response::error("Достигнут лимит профилей детей ($limit)", 403);
            }
            [$name, $age, $gender, $avatar] = users_child_fields($in);

            DB::query(
                'INSERT INTO children (parent_id, name, age, gender, avatar_key) VALUES (?, ?, ?, ?, ?)',
                [(int) $user['id'], $name, $age, $gender, $avatar]
            );
            $id = (int) DB::pdo()->lastInsertId();
            DB::query('INSERT INTO streaks (child_id) VALUES (?)', [$id]);
            Response::ok(['id' => $id], 201);

        // ── PATCH /users/children/{id} — правка профиля ───
        case 'PATCH children':
            $child = users_child($user, $segments[2] ?? '');
            [$name, $age, $gender, $avatar] = users_child_fields($in, $child);
            DB::query(
                'UPDATE children SET name = ?, age = ?, gender = ?, avatar_key = ? WHERE id = ?',
                [$name, $age, $gender, $avatar, (int) $child['id']]
            );
            Response::ok(['id' => (int) $child['id']]);

        // ── DELETE /users/children/{id} — удалить профиль ─
        case 'DELETE children':
            $child = users_child($user, $segments[2] ?? '');
            DB::query('DELETE FROM children WHERE id = ?', [(int) $child['id']]);
            Response::ok(['id' => (int) $child['id']]);

        default:
            Response::error('Не найдено', 404);
    }
}
