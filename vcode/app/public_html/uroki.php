<?php
/**
 * V.LIONOFF · витрина роликов уроков «на утверждение».
 *
 * Открывается по ссылке, без входа: Владимир смотрит всё подряд и говорит,
 * что переснять. Та же страница годится и как внутренняя витрина курса.
 */
require_once __DIR__ . '/../core/db.php';

$курсы = vc_all("SELECT * FROM courses WHERE status!='draft' ORDER BY sort, id");
$всего = 0; $сроликом = 0;
$данные = [];
foreach ($курсы as $c) {
  $блоки = [];
  foreach (vc_all('SELECT * FROM blocks WHERE course_id=? ORDER BY sort, id', [$c['id']]) as $b) {
    $уроки = vc_all("SELECT id, slug, title, summary, minutes, video, audio, free
                     FROM lessons WHERE block_id=? AND status='published' ORDER BY sort, id",
                    [$b['id']]);
    foreach ($уроки as $u) { $всего++; if ($u['video']) { $сроликом++; } }
    $блоки[] = ['блок' => $b, 'уроки' => $уроки];
  }
  $данные[] = ['курс' => $c, 'блоки' => $блоки];
}
$е = fn($s) => htmlspecialchars((string)$s, ENT_QUOTES, 'UTF-8');
?><!doctype html>
<html lang="ru" data-vc-theme="dark">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>V.LIONOFF · ролики уроков</title>
<meta name="robots" content="noindex, nofollow">
<link href="https://fonts.googleapis.com/css2?family=Unbounded:wght@600;700;800&family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
<link rel="stylesheet" href="assets/app.css?v=2">
<style>
  .wrap { max-width: 1180px; margin: 0 auto; padding: 22px 16px 80px; }
  .top { display: flex; align-items: center; gap: 12px; margin-bottom: 8px; }
  .top img { width: 40px; height: 40px; }
  .top h1 { font-size: 24px; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 16px; }
  .vid { border: 1px solid var(--line); border-radius: 18px; overflow: hidden;
         background: var(--surface); }
  .vid video { width: 100%; display: block; background: #000; aspect-ratio: 9/16; }
  .vid .body { padding: 12px 14px 14px; }
  .vid h3 { font-size: 15px; margin-bottom: 6px; font-family: Inter, sans-serif; font-weight: 650; }
  .nope { display: grid; place-items: center; aspect-ratio: 9/16; color: var(--muted);
          background: var(--surface-2); font-size: 13px; text-align: center; padding: 20px; }
  .sum { display: flex; gap: 10px; flex-wrap: wrap; margin: 14px 0 26px; }
</style>
</head>
<body>
<div class="wrap">
  <div class="top">
    <img src="assets/img/logo.png" alt="">
    <h1>Ролики уроков</h1>
  </div>
  <p class="muted">Каждый ролик, это один урок академии: голос автора, кадры в фирменном
    стиле, субтитры. Смотрите подряд и говорите, что переснять.</p>
  <div class="sum">
    <span class="pill accent"><?= $сроликом ?> из <?= $всего ?> уроков с роликом</span>
    <span class="pill"><?= date('d.m.Y') ?></span>
    <a class="pill" href="./">Приложение</a>
  </div>

  <?php foreach ($данные as $к): ?>
    <h2 style="font-size:19px;margin:26px 0 6px"><?= $е($к['курс']['title']) ?></h2>
    <p class="muted small" style="margin:0 0 14px"><?= $е($к['курс']['subtitle']) ?></p>
    <?php foreach ($к['блоки'] as $б): ?>
      <h3 style="font-size:15px;margin:18px 0 10px;color:var(--muted)">
        <?= $е($б['блок']['title']) ?></h3>
      <div class="grid">
        <?php foreach ($б['уроки'] as $u): ?>
          <div class="vid">
            <?php if ($u['video']): ?>
              <video controls preload="none" src="<?= $е($u['video']) ?>"
                     poster="assets/img/course-creator.jpg"></video>
            <?php else: ?>
              <div class="nope">ролик собирается</div>
            <?php endif; ?>
            <div class="body">
              <h3><?= $е($u['title']) ?></h3>
              <div class="small muted"><?= $е($u['summary']) ?></div>
              <div class="row" style="gap:6px;margin-top:10px;flex-wrap:wrap">
                <span class="pill"><?= (int)$u['minutes'] ?> мин</span>
                <?php if ($u['audio']): ?><span class="pill">озвучка</span><?php endif; ?>
                <?php if ($u['free']): ?><span class="pill ok">бесплатный</span><?php endif; ?>
                <a class="pill accent" href="./#lesson/<?= (int)$u['id'] ?>">урок</a>
              </div>
            </div>
          </div>
        <?php endforeach; ?>
      </div>
    <?php endforeach; ?>
  <?php endforeach; ?>

  <p class="small muted center" style="margin-top:40px">
    V.LIONOFF · ролики собраны конвейером: сценарий из урока, голос автора,
    кадры APIMODELS, субтитры по словам.</p>
</div>
</body>
</html>
