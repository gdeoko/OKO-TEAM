<?php
/* ============================================================
   DUCK'S — фоновый воркер. Шлёт отложенные авто-приглашения (через 15 мин),
   досылает welcome/лид-магнит если не ушли синхронно.
   Запуск по cron РАЗ В МИНУТУ — внутри цикл 6×sleep(10) ≈ каждые 10 сек:
     * * * * * php /home/USER/public_html/cron.php >/dev/null 2>&1
   Защита от параллельного запуска — lock-файл.
   ============================================================ */
require_once __DIR__ . '/db.php';
require_once __DIR__ . '/mailer.php';
require_once __DIR__ . '/templates.php';

@ignore_user_abort(true);
@set_time_limit(70);

$lock = fopen(__DIR__ . '/data/cron.lock', 'c');
if (!$lock || !flock($lock, LOCK_EX | LOCK_NB)) exit;  // уже работает

function tick() {
  $pdo = db(); $now = time();

  // 1) Авто-приглашения, которым пришло время
  $st = $pdo->prepare("SELECT * FROM subscribers WHERE invited=0 AND invite_at>0 AND invite_at<=? LIMIT 20");
  $st->execute([$now]);
  foreach ($st->fetchAll() as $s) {
    if (@sendEmail($s['email'], "Твоё приглашение в DUCK'S 🦆", inviteEmail($s['name']))) {
      $pdo->prepare("UPDATE subscribers SET invited=1, status='invited', invite_at=0, updated=? WHERE id=?")
          ->execute([time(), $s['id']]);
    }
  }

  // 2) Досыл welcome (если sync-отправка не сработала)
  $st = $pdo->prepare("SELECT * FROM subscribers WHERE welcomed=0 AND source='form' LIMIT 20");
  $st->execute();
  foreach ($st->fetchAll() as $s) {
    @sendEmail($s['email'], 'Заявка принята — DUCK\'S GAME SPACE 🦆', welcomeEmail($s['name']));
    $pdo->prepare("UPDATE subscribers SET welcomed=1, updated=? WHERE id=?")->execute([time(), $s['id']]);
  }

  // 3) Досыл лид-магнита
  $st = $pdo->prepare("SELECT * FROM subscribers WHERE magnet_sent=0 AND source='form' LIMIT 20");
  $st->execute();
  foreach ($st->fetchAll() as $s) {
    @sendEmail($s['email'], setting('magnet_title') . ' — подарок DUCK\'S 🎁', magnetEmail($s['name']));
    $pdo->prepare("UPDATE subscribers SET magnet_sent=1, updated=? WHERE id=?")->execute([time(), $s['id']]);
  }
}

// 6 проходов по 10 сек ≈ покрываем всю минуту до следующего запуска cron
for ($i = 0; $i < 6; $i++) {
  try { tick(); } catch (Exception $e) { @error_log('DUCKS cron: ' . $e->getMessage()); }
  if ($i < 5) sleep(10);
}

flock($lock, LOCK_UN); fclose($lock);
