<?php
/* ============================================================
   DUCK'S — фоновый воркер. Шлёт авто-цепочку из очереди drips:
     +15м приглашение, +15м магнит1, +1ч магнит2, +6ч магнит3, +24ч магнит4.
   Запуск по cron РАЗ В МИНУТУ — внутри цикл 6×sleep(10) ≈ каждые 10 сек:
     * * * * * php /home/USER/public_html/cron.php >/dev/null 2>&1
   Защита от параллельного запуска — lock-файл.
   ============================================================ */
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/mailer.php';
require_once __DIR__ . '/templates.php';

@ignore_user_abort(true);
@set_time_limit(70);

if (!is_dir(__DIR__ . '/data')) @mkdir(__DIR__ . '/data', 0775, true);
$lock = fopen(__DIR__ . '/data/cron.lock', 'c');
if (!$lock || !flock($lock, LOCK_EX | LOCK_NB)) exit;  // уже работает

function tick() {
  $pdo = db(); $now = time();
  // выбираем созревшие задачи
  $st = $pdo->prepare("SELECT d.*, s.name, s.email FROM drips d
                       JOIN subscribers s ON s.id = d.subscriber_id
                       WHERE d.sent=0 AND d.send_at<=? ORDER BY d.send_at ASC LIMIT 30");
  $st->execute([$now]);
  foreach ($st->fetchAll() as $d) {
    $email = $d['email']; $name = $d['name']; $kind = $d['kind']; $ok = false;
    if (!$email) { $pdo->prepare("UPDATE drips SET sent=1 WHERE id=?")->execute([$d['id']]); continue; }
    if ($kind === 'invite') {
      $ok = @sendEmail($email, "Твоё приглашение в DUCK'S", inviteEmail($name));
      if ($ok) $pdo->prepare("UPDATE subscribers SET invited=1, status='invited', updated=? WHERE id=?")
                   ->execute([time(), $d['subscriber_id']]);
    } elseif (strpos($kind, 'magnet') === 0) {
      $m = magnets()[$kind] ?? null;
      $subj = $m ? $m['title'] . ' — DUCK\'S' : 'Материал от DUCK\'S';
      $ok = @sendEmail($email, $subj, magnetEmail($name, $kind));
    } else { $ok = true; }
    if ($ok) $pdo->prepare("UPDATE drips SET sent=1 WHERE id=?")->execute([$d['id']]);
  }

  // подстраховка: досыл welcome, если sync-отправка не прошла
  $st = $pdo->prepare("SELECT * FROM subscribers WHERE welcomed=0 AND is_form=1 LIMIT 20");
  $st->execute();
  foreach ($st->fetchAll() as $s) {
    @sendEmail($s['email'], 'Заявка принята — DUCK\'S GAME SPACE', welcomeEmail($s['name']));
    $pdo->prepare("UPDATE subscribers SET welcomed=1, updated=? WHERE id=?")->execute([time(), $s['id']]);
  }
}

// 6 проходов по 10 сек ≈ покрываем всю минуту до следующего запуска cron
for ($i = 0; $i < 6; $i++) {
  try { tick(); } catch (Exception $e) { @error_log('DUCKS cron: ' . $e->getMessage()); }
  if ($i < 5) sleep(10);
}

flock($lock, LOCK_UN); fclose($lock);
