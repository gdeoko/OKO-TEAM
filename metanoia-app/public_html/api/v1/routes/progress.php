<?php
/**
 * /api/v1/progress/* — прогресс ребёнка между устройствами.
 *
 * Приложение хранит состояние у себя (уроки, зёрна, друг, настройки),
 * сюда кладётся весь снимок целиком плюс номер ревизии. Кто новее по
 * ревизии, тот и прав: телефон и планшет одного ребёнка сходятся без
 * ручного разбора конфликтов.
 *
 *   GET  /progress/{child_id}   → {rev, state, updated_at}
 *   PUT  /progress/{child_id}   ← {rev, state}
 */

declare(strict_types=1);

/** Ребёнок принадлежит этому родителю, иначе 403/404. */
function progress_child(array $user, string $raw): array
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

/** Числа из снимка в таблицы: родительская зона читает их напрямую. */
function progress_derive(int $childId, array $state): void
{
    $xp    = max(0, min(1000000, (int) ($state['xp'] ?? 0)));
    $level = max(1, min(8, (int) ($state['level'] ?? 1)));
    DB::query('UPDATE children SET xp = ?, rank_level = ? WHERE id = ?', [$xp, $level, $childId]);

    $s = is_array($state['streak'] ?? null) ? $state['streak'] : [];
    $cur  = max(0, min(65535, (int) ($s['current'] ?? 0)));
    $best = max($cur, min(65535, (int) ($s['best'] ?? 0)));
    $last = preg_match('/^\d{4}-\d{2}-\d{2}$/', (string) ($s['last'] ?? '')) ? $s['last'] : null;
    DB::query(
        'INSERT INTO streaks (child_id, current_days, best_days, last_active_date)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE current_days = VALUES(current_days),
                                 best_days = GREATEST(best_days, VALUES(best_days)),
                                 last_active_date = VALUES(last_active_date)',
        [$childId, $cur, $best, $last]
    );
}

function handle(array $segments, string $method): never
{
    $user  = Auth::requireUser();
    $child = progress_child($user, $segments[1] ?? '');
    $cid   = (int) $child['id'];

    switch ($method) {

        // ── Забрать снимок ───────────────────────────────
        case 'GET':
            $row = DB::query('SELECT rev, state, updated_at FROM child_state WHERE child_id = ?',
                [$cid])->fetch();
            Response::ok([
                'rev'        => $row ? (int) $row['rev'] : 0,
                'state'      => $row ? json_decode($row['state'], true) : new stdClass(),
                'updated_at' => $row['updated_at'] ?? null,
            ]);

        // ── Положить снимок ──────────────────────────────
        case 'PUT':
            $in    = Response::input();
            $state = $in['state'] ?? null;
            if (!is_array($state)) Response::error('Нет данных прогресса', 422);

            $json = json_encode($state, JSON_UNESCAPED_UNICODE);
            if ($json === false || strlen($json) > 512000) {
                Response::error('Снимок прогресса слишком большой', 413);
            }
            $rev = max(1, (int) ($in['rev'] ?? 1));

            // Чужая ревизия старше нашей — не затираем более свежие данные.
            $cur = DB::query('SELECT rev FROM child_state WHERE child_id = ?', [$cid])->fetch();
            if ($cur && (int) $cur['rev'] > $rev) {
                Response::error('На сервере более свежий прогресс', 409);
            }

            DB::query(
                'INSERT INTO child_state (child_id, rev, state) VALUES (?, ?, ?)
                 ON DUPLICATE KEY UPDATE rev = VALUES(rev), state = VALUES(state)',
                [$cid, $rev, $json]
            );
            progress_derive($cid, $state);
            Response::ok(['rev' => $rev]);

        default:
            Response::error('Не найдено', 404);
    }
}
