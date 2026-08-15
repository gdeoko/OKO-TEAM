<?php
/**
 * Жюри: умное автораспределение заявок, баланс нагрузки, видеорецензии.
 * Таблицы создаются идемпотентно при первом вызове jury_ensure_schema().
 */
declare(strict_types=1);

/** Создаёт свои таблицы/колонки/триггеры, если их ещё нет. Безопасно вызывать многократно. */
function jury_ensure_schema(): void {
    static $done = false;
    if ($done) return;
    $pdo = db();

    $pdo->exec("
    CREATE TABLE IF NOT EXISTS jury_assignments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        application_id INTEGER NOT NULL,
        jury_id INTEGER NOT NULL,
        done INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now','localtime')),
        UNIQUE(application_id, jury_id)
    );
    CREATE INDEX IF NOT EXISTS idx_jury_assign_app ON jury_assignments(application_id);
    CREATE INDEX IF NOT EXISTS idx_jury_assign_jury ON jury_assignments(jury_id);

    CREATE TABLE IF NOT EXISTS jury_video (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        application_id INTEGER NOT NULL,
        jury_id INTEGER NOT NULL,
        path TEXT NOT NULL,
        created_at TEXT DEFAULT (datetime('now','localtime')),
        UNIQUE(application_id, jury_id)
    );
    CREATE INDEX IF NOT EXISTS idx_jury_video_app ON jury_video(application_id);
    ");

    // Идемпотентный ALTER: колонка diplomas.video_review_path (SQLite не умеет ADD COLUMN IF NOT EXISTS).
    $cols = $pdo->query("PRAGMA table_info(diplomas)")->fetchAll(PDO::FETCH_ASSOC);
    $has = false;
    foreach ($cols as $c) { if (($c['name'] ?? '') === 'video_review_path') { $has = true; break; } }
    if (!$has) $pdo->exec("ALTER TABLE diplomas ADD COLUMN video_review_path TEXT DEFAULT ''");

    // Триггер: если диплом создаётся после того, как видеорецензия уже загружена — подхватываем путь автоматически.
    $pdo->exec("
    CREATE TRIGGER IF NOT EXISTS trg_jury_video_diploma
    AFTER INSERT ON diplomas
    FOR EACH ROW
    BEGIN
        UPDATE diplomas SET video_review_path = COALESCE(
            (SELECT path FROM jury_video WHERE application_id = NEW.application_id ORDER BY created_at DESC, id DESC LIMIT 1),
            video_review_path
        ) WHERE id = NEW.id;
    END;
    ");

    $done = true;
}

/** Нормализация ФИО для сравнения (педагог vs жюри) — без учёта регистра и лишних пробелов. */
function jury_normalize_name(string $s): string {
    $s = trim(preg_replace('/\s+/u', ' ', $s) ?? $s);
    return mb_strtolower($s, 'UTF-8');
}

/**
 * Текущая нагрузка каждого члена жюри (роль jury) — количество назначенных заявок по всем конкурсам.
 * Используется для равномерного распределения при автораспределении.
 */
function jury_balance(): array {
    jury_ensure_schema();
    $bal = [];
    foreach (all("SELECT id FROM users WHERE role='jury'") as $j) $bal[(int)$j['id']] = 0;
    foreach (all("SELECT jury_id, COUNT(*) c FROM jury_assignments GROUP BY jury_id") as $r) {
        $bal[(int)$r['jury_id']] = (int)$r['c'];
    }
    return $bal;
}

/**
 * Автораспределение жюри по конкурсу: каждой заявке — 3 случайных члена жюри,
 * с исключением конфликта интересов (педагог заявки = ФИО жюри) и равномерной нагрузкой.
 * Идемпотентно: уже назначенные пары (заявка, жюри) не дублируются, довносятся недостающие.
 */
function jury_autoassign(int $competitionId): array {
    jury_ensure_schema();

    $result = [
        'ok'                  => true,
        'competition_id'      => $competitionId,
        'applications_total'  => 0,
        'fully_assigned'      => 0,
        'assignments_created' => 0,
        'insufficient'        => [],
    ];

    $jurors = all("SELECT id, full_name FROM users WHERE role='jury'");
    if (!$jurors) {
        $result['ok'] = false;
        $result['error'] = 'В системе нет пользователей с ролью «Жюри» — сначала назначьте роль в разделе «Пользователи».';
        return $result;
    }

    $apps = all("SELECT id, teacher FROM applications WHERE competition_id=?", [$competitionId]);
    $result['applications_total'] = count($apps);
    if (!$apps) return $result;

    $balance = jury_balance();

    foreach ($apps as $app) {
        $appId = (int) $app['id'];
        $teacher = jury_normalize_name((string) ($app['teacher'] ?? ''));

        $existingIds = array_map(
            fn($r) => (int) $r['jury_id'],
            all("SELECT jury_id FROM jury_assignments WHERE application_id=?", [$appId])
        );
        $need = 3 - count($existingIds);
        if ($need <= 0) { $result['fully_assigned']++; continue; }

        // Пул кандидатов: ещё не назначены, нет конфликта интересов (педагог заявки = жюри).
        $pool = [];
        foreach ($jurors as $j) {
            $jid = (int) $j['id'];
            if (in_array($jid, $existingIds, true)) continue;
            $jname = jury_normalize_name((string) ($j['full_name'] ?? ''));
            if ($teacher !== '' && $jname !== '' && $jname === $teacher) continue; // конфликт интересов
            $pool[] = $jid;
        }

        if (!$pool) {
            $result['insufficient'][] = ['application_id' => $appId, 'assigned' => count($existingIds), 'needed' => $need];
            continue;
        }

        // Случайный порядок среди равных по нагрузке + сортировка по наименьшей нагрузке (равномерное распределение).
        shuffle($pool);
        usort($pool, fn($a, $b) => ($balance[$a] ?? 0) <=> ($balance[$b] ?? 0));

        $chosen = array_slice($pool, 0, $need);
        foreach ($chosen as $jid) {
            q("INSERT OR IGNORE INTO jury_assignments(application_id, jury_id, done) VALUES(?,?,0)", [$appId, $jid]);
            $balance[$jid] = ($balance[$jid] ?? 0) + 1;
            $result['assignments_created']++;
        }

        if (count($chosen) < $need) {
            $result['insufficient'][] = [
                'application_id' => $appId,
                'assigned'       => count($existingIds) + count($chosen),
                'needed'         => $need - count($chosen),
            ];
        } else {
            $result['fully_assigned']++;
        }
    }

    audit('jury_autoassign', 'competition', $competitionId, [
        'created' => $result['assignments_created'],
        'total_apps' => $result['applications_total'],
        'insufficient' => count($result['insufficient']),
    ]);

    return $result;
}

/** Очередь заявок, назначенных конкретному жюри (для режима «мои назначенные»). */
function jury_assigned_queue(int $juryId, int $comp = 0): array {
    jury_ensure_schema();
    $w = "ja.jury_id=?"; $args = [$juryId];
    if ($comp) { $w .= " AND a.competition_id=?"; $args[] = $comp; }
    return all("SELECT a.id FROM jury_assignments ja JOIN applications a ON a.id=ja.application_id
                WHERE $w ORDER BY a.id", $args);
}

/** Нагрузка жюри по конкретному конкурсу (для отображения в админке). */
function jury_competition_stats(int $competitionId): array {
    jury_ensure_schema();
    return all("SELECT u.id, u.full_name,
                       COUNT(ja.id) assigned,
                       SUM(CASE WHEN ja.done=1 THEN 1 ELSE 0 END) done
                FROM users u
                JOIN jury_assignments ja ON ja.jury_id = u.id
                JOIN applications a ON a.id = ja.application_id AND a.competition_id = ?
                WHERE u.role='jury'
                GROUP BY u.id
                ORDER BY u.full_name", [$competitionId]);
}

/** Путь к самой свежей видеорецензии по заявке (или пустая строка). */
function jury_video_latest_path(int $applicationId): string {
    jury_ensure_schema();
    $p = scalar("SELECT path FROM jury_video WHERE application_id=? ORDER BY created_at DESC, id DESC LIMIT 1", [$applicationId]);
    return (string) ($p ?? '');
}

/** Привязывает самую свежую видеорецензию заявки к уже существующим дипломам (если они есть). */
function jury_video_attach_to_diploma(int $applicationId): void {
    jury_ensure_schema();
    $path = jury_video_latest_path($applicationId);
    if ($path === '') return;
    q("UPDATE diplomas SET video_review_path=? WHERE application_id=?", [$path, $applicationId]);
}

/**
 * Сохраняет видеорецензию жюри к заявке (одна рецензия на пару жюри+заявка — повторная загрузка заменяет файл)
 * и сразу привязывает её к диплому, если он уже создан.
 */
function jury_video_save(int $applicationId, int $juryId, string $relPath): void {
    jury_ensure_schema();
    $ex = one("SELECT id, path FROM jury_video WHERE application_id=? AND jury_id=?", [$applicationId, $juryId]);
    if ($ex) {
        $old = BASE_PATH . '/public/' . ltrim((string) $ex['path'], '/');
        if ($ex['path'] && is_file($old)) @unlink($old);
        update('jury_video', ['path' => $relPath, 'created_at' => date('Y-m-d H:i:s')], 'id=:wid', ['wid' => $ex['id']]);
    } else {
        insert('jury_video', ['application_id' => $applicationId, 'jury_id' => $juryId, 'path' => $relPath]);
    }
    jury_video_attach_to_diploma($applicationId);
}
