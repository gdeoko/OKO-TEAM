<?php
/** Сидинг 4 конкурсов на 1 августа 2026: 1 международный платный + 2 всерос платных + 1 всерос бесплатный.
 *  Идемпотентно (INSERT OR REPLACE по slug). Удаляет старые слаги evrika/simfoniya-zvezd/slava-rossii. */
declare(strict_types=1);
$db = (getenv('MUZMIR_DB_PATH') ?: __DIR__ . '/../data/muzmir.sqlite');
$d = new PDO('sqlite:' . $db);
$d->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
$d->exec('BEGIN');
$d->exec("DELETE FROM competitions WHERE slug IN ('slava-rossii','evrika','simfoniya-zvezd')");
$now = date('Y-m-d H:i:s');
$rows = [
 ['mirovye-talanty','MT','Мировые Таланты','international','multi',1,500,
  'Международный многожанровый онлайн-конкурс культуры и искусства «Мировые Таланты» при информационной поддержке Министерства культуры и образования субъектов Российской Федерации и государственного портала «Pro Культура». Организационный взнос 500 ₽ включает электронный основной диплом и дополнительный (при аттестационном результате).',
  '2026-08-01','2026-08-25','2026-08-30','email',1],
 ['v-zenite-slavy','VZS','В зените славы','national','multi',1,500,
  'Всероссийский многожанровый онлайн-конкурс культуры и искусства «В зените славы». Организационный взнос 500 ₽. Результаты индивидуально на почту в течение 5 рабочих дней.',
  '2026-08-01','2026-08-25','2026-08-30','email',2],
 ['iskusstvo-vo-blago','IVB','Искусство во благо','national','multi',1,500,
  'Всероссийский многожанровый онлайн-конкурс культуры и искусства «Искусство во благо». Организационный взнос 500 ₽. Результаты индивидуально на почту в течение 5 рабочих дней.',
  '2026-08-01','2026-08-25','2026-08-30','email',3],
 ['velichie-rossii','VR','Величие России','national','patriotic',0,0,
  'Всероссийский многожанровый онлайн-конкурс культуры и искусства «Величие России». Участие бесплатное. Список победителей публикуется 28 числа месяца на сайте, в ВК-сообществе и рассылкой всем участникам.',
  '2026-08-01','2026-08-25','2026-08-28','list',4],
];
$s = $d->prepare("INSERT OR REPLACE INTO competitions
 (slug,code,name,type,direction,is_paid,price,description,start_date,end_date,results_date,results_mode,sort,status,created_at)
 VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,'open',?)");
foreach ($rows as $r) { $r[] = $now; $s->execute($r); }
$d->exec('COMMIT');
$n = $d->query("SELECT COUNT(*) FROM competitions WHERE status='open'")->fetchColumn();
echo "seeded_august_2026 open_now=$n\n";
