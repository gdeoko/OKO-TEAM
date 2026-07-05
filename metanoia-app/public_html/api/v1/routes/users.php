<?php
/** /api/v1/users/* — профиль и дети. Этап 1: минимум; растёт на этапе 2. */

declare(strict_types=1);

function handle(array $segments, string $method): never
{
    $action = $segments[1] ?? '';
    $in = Response::input();
    $user = Auth::requireUser();

    switch ("$method $action") {

        // ── POST /users/children — добавить ребёнка ───────
        case 'POST children':
            $limit = 3; // без подписки; с Метанойя+ = 5 (проверка на этапе 6)
            $count = (int) DB::query('SELECT COUNT(*) c FROM children WHERE parent_id = ?',
                [(int) $user['id']])->fetch()['c'];
            if ($count >= $limit) {
                Response::error("Достигнут лимит профилей детей ($limit)", 403);
            }
            $name = trim($in['name'] ?? '');
            if (mb_strlen($name) < 2) Response::error('Введите имя ребёнка', 422);

            DB::query(
                'INSERT INTO children (parent_id, name, age, gender, avatar_key) VALUES (?, ?, ?, ?, ?)',
                [
                    (int) $user['id'], $name,
                    max(5, min(14, (int) ($in['age'] ?? 7))),
                    in_array($in['gender'] ?? '', ['m', 'f'], true) ? $in['gender'] : null,
                    preg_replace('/[^a-z0-9-]/', '', $in['avatar_key'] ?? 'angel') ?: 'angel',
                ]
            );
            $id = (int) DB::pdo()->lastInsertId();
            DB::query('INSERT INTO streaks (child_id) VALUES (?)', [$id]);
            Response::ok(['id' => $id], 201);

        default:
            Response::error('Не найдено', 404);
    }
}
