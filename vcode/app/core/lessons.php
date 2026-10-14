<?php
/**
 * V.LIONOFF · уроки: одна логика на приложение и на бота.
 *
 * Пока обучение жило только в приложении, проверка теста и начисление опыта
 * лежали прямо в API. Бот должен считать ровно так же, иначе у человека будет
 * два разных прогресса, поэтому счёт переехал сюда и зовётся с обеих сторон.
 */
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/auth.php';

function vc_json($v, $default = []) {
  if (is_array($v)) { return $v; }
  $d = json_decode((string)$v, true);
  return is_array($d) ? $d : $default;
}

function vc_levels(int $xp): array {
  $steps = [0, 100, 250, 500, 900, 1500, 2300, 3400, 5000, 7200, 10000];
  $lvl = 1;
  foreach ($steps as $i => $need) { if ($xp >= $need) { $lvl = $i + 1; } }
  $next = $steps[min($lvl, count($steps) - 1)] ?? end($steps);
  $prev = $steps[$lvl - 1] ?? 0;
  $names = ['Новичок','Старт','Съёмщик','Монтажёр','Автор','Креатор','Продюсер',
            'Мастер','Эксперт','Наставник','Легенда'];
  return ['level' => $lvl, 'name' => $names[$lvl - 1] ?? 'Легенда',
          'xp' => $xp, 'from' => $prev, 'to' => max($next, $prev + 1)];
}

/** Зачесть день в серию и выдать опыт. */
function vc_streak_touch(array $u, int $xp = 0): array {
  $today = date('Y-m-d');
  $streak = (int)$u['streak'];
  if ($u['streak_day'] !== $today) {
    $streak = ($u['streak_day'] === date('Y-m-d', strtotime('-1 day'))) ? $streak + 1 : 1;
  }
  $newXp = (int)$u['xp'] + $xp;
  $lvl = vc_levels($newXp);
  vc_update('users', ['streak' => $streak, 'streak_day' => $today, 'xp' => $newXp,
                      'level' => $lvl['level']], 'id=?', [$u['id']]);
  return ['streak' => $streak, 'xp' => $newXp, 'level' => $lvl];
}

/** Урок целиком вместе с курсом и правом доступа. */
function vc_lesson_full(int $id, ?array $user): ?array {
  $l = vc_one("SELECT * FROM lessons WHERE id=? AND status='published'", [$id]);
  if (!$l) { return null; }
  $c = vc_one('SELECT * FROM courses WHERE id=?', [$l['course_id']]);
  $b = vc_one('SELECT * FROM blocks WHERE id=?', [$l['block_id']]);
  return ['lesson' => $l, 'course' => $c, 'block' => $b,
          'open' => vc_has_access($user, $c, $l)];
}

/** Отметить, что урок открыт. */
function vc_lesson_opened(array $u, array $l): void {
  vc_q('INSERT INTO progress(user_id,lesson_id,course_id,state) VALUES(?,?,?,?)
        ON CONFLICT(user_id,lesson_id) DO UPDATE SET updated_at=datetime("now")',
       [$u['id'], $l['id'], $l['course_id'], 'opened']);
}

/**
 * Проверить тест и записать результат. Возвращает то же самое и приложению,
 * и боту: процент, прошёл ли, подробности, опыт, серию, сертификат.
 */
function vc_quiz_apply(array $u, array $l, array $answers): array {
  $quiz = vc_json($l['quiz']);
  $right = 0; $detail = [];
  foreach ($quiz as $i => $q) {
    $ok = isset($answers[$i]) && (int)$answers[$i] === (int)$q['answer'];
    if ($ok) { $right++; }
    $detail[] = ['right' => (int)$q['answer'], 'ok' => $ok, 'why' => $q['why'] ?? ''];
  }
  $score = $quiz ? (int) round($right * 100 / count($quiz)) : 100;
  $passed = $score >= 70;
  $prev = vc_one('SELECT * FROM progress WHERE user_id=? AND lesson_id=?', [$u['id'], $l['id']]);
  $wasDone = $prev && $prev['state'] === 'done';
  vc_q('INSERT INTO progress(user_id,lesson_id,course_id,state,score,attempts) VALUES(?,?,?,?,?,1)
        ON CONFLICT(user_id,lesson_id) DO UPDATE SET
          state=CASE WHEN ? THEN "done" ELSE progress.state END,
          score=MAX(progress.score, ?), attempts=progress.attempts+1,
          updated_at=datetime("now")',
       [$u['id'], $l['id'], $l['course_id'], $passed ? 'done' : 'opened', $score,
        $passed ? 1 : 0, $score]);
  $gain = ($passed && !$wasDone) ? (int)$l['xp'] : 0;
  $streak = vc_streak_touch($u, $gain);
  vc_event((int)$u['id'], 'quiz', ['lesson' => (int)$l['id'], 'score' => $score]);

  $cert = null;
  $c = vc_one('SELECT * FROM courses WHERE id=?', [$l['course_id']]);
  $total = (int) vc_val("SELECT COUNT(*) FROM lessons WHERE course_id=? AND status='published'",
                        [$l['course_id']]);
  $done = (int) vc_val("SELECT COUNT(*) FROM progress WHERE user_id=? AND course_id=? AND state='done'",
                       [$u['id'], $l['course_id']]);
  if ($total > 0 && $done >= $total && (int)$c['cert'] === 1) {
    $have = vc_one('SELECT * FROM certificates WHERE user_id=? AND course_id=?',
                   [$u['id'], $l['course_id']]);
    if (!$have) {
      $number = 'VL-' . date('Y') . '-' . str_pad((string)$u['id'], 4, '0', STR_PAD_LEFT)
                . '-' . str_pad((string)$l['course_id'], 2, '0', STR_PAD_LEFT);
      vc_insert('certificates', ['user_id' => $u['id'], 'course_id' => $l['course_id'],
                                 'number' => $number]);
      $have = vc_one('SELECT * FROM certificates WHERE user_id=? AND course_id=?',
                     [$u['id'], $l['course_id']]);
      require_once __DIR__ . '/telegram.php';
      vc_tg_notify_admins('Сертификат выдан: ' . trim($u['first_name'] . ' ' . $u['last_name'])
                          . ', ' . $c['title']);
    }
    $cert = $have;
  }
  return ['score' => $score, 'passed' => $passed, 'detail' => $detail,
          'xp_gain' => $gain, 'streak' => $streak['streak'], 'xp' => $streak['xp'],
          'level' => $streak['level'], 'certificate' => $cert,
          'course_done' => $total > 0 && $done >= $total];
}

/** Короткое состояние диалога бота: на каком слайде человек, что ответил. */
function vc_bot_state(int $tgId, string $key, $value = null) {
  $имя = 'bot:' . $tgId . ':' . $key;
  if ($value === null) { return vc_json(vc_setting($имя, ''), []); }
  vc_setting_set($имя, json_encode($value, JSON_UNESCAPED_UNICODE));
  return $value;
}
