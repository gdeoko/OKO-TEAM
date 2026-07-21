<?php
/**
 * Публичная страница результатов конкурса (живёт годами — не удаляется после завершения).
 * Переменная $slug задана роутером и равна slug конкурса (competitions.slug).
 * Публикуется только для завершённых конкурсов (status = closed|finished).
 */
$slug = trim((string) ($slug ?? ''));

$slugify = function (string $s): string {
    $s = mb_strtolower(trim($s));
    $map = ['а'=>'a','б'=>'b','в'=>'v','г'=>'g','д'=>'d','е'=>'e','ё'=>'e','ж'=>'zh','з'=>'z','и'=>'i',
            'й'=>'y','к'=>'k','л'=>'l','м'=>'m','н'=>'n','о'=>'o','п'=>'p','р'=>'r','с'=>'s','т'=>'t',
            'у'=>'u','ф'=>'f','х'=>'h','ц'=>'ts','ч'=>'ch','ш'=>'sh','щ'=>'sch','ъ'=>'','ы'=>'y','ь'=>'',
            'э'=>'e','ю'=>'yu','я'=>'ya',' '=>'-'];
    $s = strtr($s, $map);
    $s = preg_replace('/[^a-z0-9\-]/', '', $s);
    $s = preg_replace('/-{2,}/', '-', $s);
    return trim($s, '-');
};

$c = one("SELECT * FROM competitions WHERE slug = ?", [$slug]);

if (!$c) {
    http_response_code(404);
    ob_start(); ?>
    <section class="section">
      <div class="container" style="text-align:center;max-width:640px">
        <p class="eyebrow">Ошибка 404</p>
        <h1>Конкурс не найден</h1>
        <p style="color:var(--muted)">Проверьте ссылку или посмотрите <a href="<?= url('/competitions') ?>">все конкурсы</a>.</p>
        <div style="margin-top:24px"><a class="btn btn--primary" href="<?= url('/competitions') ?>">К каталогу конкурсов</a></div>
      </div>
    </section>
    <?php
    $content = ob_get_clean();
    render_page('Конкурс не найден', $content, ['active' => '/competitions', 'meta' => 'Конкурс не найден.']);
    return;
}

$typeLabel = $c['type'] === 'international' ? 'Международный конкурс' : 'Всероссийский конкурс';
$isFinished = in_array($c['status'], ['closed', 'finished'], true);

/* --- Конкурс ещё не завершён: результатов пока нет, но страница уже доступна и не 404. --- */
if (!$isFinished) {
    ob_start(); ?>
    <section class="section">
      <div class="container" style="text-align:center;max-width:640px">
        <p class="eyebrow"><?= h($typeLabel) ?></p>
        <h1><?= h($c['name']) ?></h1>
        <p style="color:var(--muted);margin-top:14px">Результаты этого конкурса ещё не опубликованы: приём заявок или оценка жюри продолжается.
           Итоги появятся на этой странице сразу после завершения конкурса.</p>
        <div style="margin-top:26px;display:flex;gap:12px;justify-content:center;flex-wrap:wrap">
          <a class="btn btn--primary" href="<?= url('/competition/' . $c['slug']) ?>">О конкурсе</a>
          <a class="btn btn--ghost" href="<?= url('/competitions') ?>">Все конкурсы</a>
        </div>
      </div>
    </section>
    <?php
    $content = ob_get_clean();
    render_page('Результаты - ' . $c['name'], $content, [
        'active' => '/competitions',
        'meta'   => 'Результаты конкурса «' . $c['name'] . '» будут опубликованы после его завершения.',
    ]);
    return;
}

/* --- Победители: заявки с выставленным результатом. --- */
$results = all(
    "SELECT a.id AS app_id, a.user_id, a.full_name, a.group_name, a.is_group, a.city, a.institution, a.teacher,
            a.nomination, a.age_category, a.work_title, a.result, a.score, a.video_url, a.video_platform,
            d.number AS diploma_number
     FROM applications a
     LEFT JOIN diplomas d ON d.application_id = a.id
     WHERE a.competition_id = ? AND a.status IN ('graded','sent') AND a.result <> ''
     ORDER BY a.nomination ASC, a.score DESC, a.full_name ASC",
    [(int) $c['id']]
);

/* Карта «ФИО -> slug портфолио» строится один раз по всему публичному реестру дипломов (без N+1 запросов). */
$allDiplomaRows = all(
    "SELECT a.id AS app_id, a.user_id, a.full_name
     FROM diplomas d JOIN applications a ON a.id = d.application_id
     WHERE a.full_name <> ''"
);
$artistSlugMap = [];
$artistGroups = [];
foreach ($allDiplomaRows as $r) {
    $key = mb_strtolower(trim($r['full_name']));
    if ($key === '') continue;
    if (!isset($artistGroups[$key])) $artistGroups[$key] = ['name' => $r['full_name'], 'uid' => null, 'minApp' => PHP_INT_MAX];
    if (!empty($r['user_id'])) $artistGroups[$key]['uid'] = (int) $r['user_id'];
    $artistGroups[$key]['minApp'] = min($artistGroups[$key]['minApp'], (int) $r['app_id']);
}
foreach ($artistGroups as $key => $g) {
    $cid = $g['uid'] ?: ($g['minApp'] === PHP_INT_MAX ? 0 : $g['minApp']);
    $artistSlugMap[$key] = $slugify($g['name']) . '-' . $cid;
}

/* Группировка по номинациям + статистика. */
$byNomination = [];
$cities = []; $grandPrix = 0; $laureates = 0;
foreach ($results as $r) {
    $nom = $r['nomination'] ?: 'Без номинации';
    $byNomination[$nom][] = $r;
    if (!empty($r['city'])) $cities[trim($r['city'])] = true;
    if (mb_stripos((string) $r['result'], 'ГРАН-ПРИ') !== false) $grandPrix++;
    elseif (mb_stripos((string) $r['result'], 'ЛАУРЕАТ') !== false) $laureates++;
}
ksort($byNomination, SORT_NATURAL | SORT_FLAG_CASE);

/* Медиа: афиши/материалы конкурса (если загружены) и уникальные видео-ссылки победителей. */
$posters = all("SELECT * FROM posters WHERE competition_id = ? ORDER BY id", [(int) $c['id']]);
$videos = [];
foreach ($results as $r) {
    if (!empty($r['video_url']) && !isset($videos[$r['video_url']])) {
        $videos[$r['video_url']] = ['name' => $r['is_group'] && $r['group_name'] ? $r['group_name'] : $r['full_name'], 'platform' => $r['video_platform'] ?: 'Видео'];
    }
}

ob_start(); ?>
<style>
.res-card{max-width:1020px;margin:0 auto}
.res-hero{text-align:center;max-width:720px;margin:0 auto 32px}
.res-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:18px;margin-bottom:44px}
.res-stat{background:#fff;border:1px solid var(--line);border-radius:var(--radius);padding:22px;text-align:center;box-shadow:var(--shadow-card)}
.res-stat b{display:block;font-family:var(--ff-head);font-size:2rem;color:var(--gold-dark)}
.res-stat span{color:var(--muted);font-size:.88rem}
.res-nom{margin-bottom:36px}
.res-nom h3{border-bottom:1px solid var(--line);padding-bottom:12px;margin-bottom:16px}
.res-row{display:flex;justify-content:space-between;gap:14px;flex-wrap:wrap;align-items:center;
  background:#fff;border:1px solid var(--line);border-radius:var(--radius-sm);padding:14px 18px;box-shadow:var(--shadow-card);margin-bottom:10px}
.res-row b{font-family:var(--ff-head);color:var(--navy)}
.res-row .res-result{font-weight:700;color:var(--gold-dark);white-space:nowrap}
.res-media{display:flex;flex-wrap:wrap;gap:12px}
.res-poster{width:150px;border:1px solid var(--line);border-radius:var(--radius-sm);overflow:hidden;box-shadow:var(--shadow-card)}
.res-poster img{width:100%;display:block}
.res-video-chip{display:inline-flex;align-items:center;gap:8px;padding:9px 16px;border-radius:999px;background:#fff;
  border:1px solid var(--line);color:var(--navy);font-size:.86rem;font-weight:600;box-shadow:var(--shadow-card)}
.res-video-chip:hover{border-color:var(--gold);color:var(--gold-dark)}
@media(max-width:860px){.res-stats{grid-template-columns:repeat(2,1fr)}}
</style>

<section class="section">
  <div class="container res-card">
    <div class="res-hero reveal">
      <p class="eyebrow"><?= h($typeLabel) ?> · Итоги</p>
      <h1><?= h($c['name']) ?></h1>
      <p style="color:var(--muted);margin-top:10px">
        Официальные результаты конкурса КЦ «Музыкальный Мир».
        <?php if (!empty($c['results_date'])): ?>Подведены <?= h(ru_date($c['results_date'])) ?>.<?php endif; ?>
        Каждый диплом можно проверить в <a href="<?= url('/verify') ?>">реестре подлинности</a>.
      </p>
    </div>

    <?php if (!$results): ?>
      <div class="reveal" style="text-align:center;background:#fff;border:1px solid var(--line);border-radius:var(--radius);padding:52px 28px;box-shadow:var(--shadow-card)">
        <svg viewBox="0 0 24 24" width="52" height="52" fill="none" stroke="var(--gold)" stroke-width="1.4" style="margin:0 auto 14px"><circle cx="12" cy="8" r="6"/><path d="M8.2 13.9 7 22l5-3 5 3-1.2-8.1"/></svg>
        <h2>Результаты готовятся к публикации</h2>
        <p style="color:var(--muted);max-width:460px;margin:0 auto 22px">Конкурс завершён, наградные документы формируются. Итоги появятся на этой странице в ближайшее время.</p>
        <a class="btn btn--primary" href="<?= url('/competition/' . $c['slug']) ?>">О конкурсе</a>
      </div>
    <?php else: ?>

      <div class="res-stats reveal">
        <div class="res-stat"><b><?= count($results) ?></b><span>Победителей и лауреатов</span></div>
        <div class="res-stat"><b><?= $grandPrix ?></b><span>Гран-при</span></div>
        <div class="res-stat"><b><?= $laureates ?></b><span>Лауреатов</span></div>
        <div class="res-stat"><b><?= count($cities) ?></b><span>Городов и регионов</span></div>
      </div>

      <?php foreach ($byNomination as $nom => $rows): ?>
        <div class="res-nom reveal">
          <h3><?= h($nom) ?></h3>
          <?php foreach ($rows as $r):
            $displayName = $r['is_group'] && $r['group_name'] ? $r['group_name'] : $r['full_name'];
            $aslug = $artistSlugMap[mb_strtolower(trim($r['full_name']))] ?? null;
          ?>
            <div class="res-row">
              <div>
                <b><?php if ($aslug): ?><a href="<?= url('/artist/' . $aslug) ?>"><?= h($displayName) ?></a><?php else: ?><?= h($displayName) ?><?php endif; ?></b>
                <p style="color:var(--muted);margin:3px 0 0;font-size:.88rem">
                  <?= h($r['age_category'] ?: '') ?><?php if ($r['age_category'] && $r['work_title']): ?> · <?php endif; ?><?php if ($r['work_title']): ?>«<?= h($r['work_title']) ?>»<?php endif; ?>
                  <?php if ($r['city']): ?><br><?= h($r['city']) ?><?php if ($r['institution']): ?> · <?= h($r['institution']) ?><?php endif; ?><?php endif; ?>
                </p>
              </div>
              <div style="text-align:right">
                <span class="res-result"><?= h($r['result']) ?></span>
                <?php if (!empty($r['diploma_number'])): ?>
                  <p style="margin:6px 0 0"><a class="btn btn--ghost" href="<?= url('/verify/' . $r['diploma_number']) ?>">Проверить диплом</a></p>
                <?php endif; ?>
              </div>
            </div>
          <?php endforeach; ?>
        </div>
      <?php endforeach; ?>

      <?php if ($posters): ?>
        <div class="section-head reveal" style="margin-bottom:16px"><p class="eyebrow">Материалы</p><h2>Афиши конкурса</h2></div>
        <div class="res-media reveal" style="margin-bottom:36px">
          <?php foreach ($posters as $p): ?>
            <a class="res-poster" href="<?= h($p['image_path']) ?>" target="_blank" rel="noopener"><img src="<?= h($p['image_path']) ?>" alt="<?= h($c['name']) ?>" loading="lazy"></a>
          <?php endforeach; ?>
        </div>
      <?php endif; ?>

      <?php if ($videos): ?>
        <div class="section-head reveal" style="margin-bottom:16px"><p class="eyebrow">Смотрите</p><h2>Видео-номера победителей</h2></div>
        <div class="res-media reveal">
          <?php foreach ($videos as $url => $v): ?>
            <a class="res-video-chip" href="<?= h($url) ?>" target="_blank" rel="noopener">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
              <?= h($v['name']) ?> · <?= h($v['platform']) ?>
            </a>
          <?php endforeach; ?>
        </div>
      <?php endif; ?>

    <?php endif; ?>
  </div>
</section>
<?php
$content = ob_get_clean();
$metaDesc = $results
    ? 'Результаты конкурса «' . $c['name'] . '»: ' . count($results) . ' победителей и лауреатов, ' . count($byNomination) . ' номинаций. КЦ «Музыкальный Мир».'
    : 'Результаты конкурса «' . $c['name'] . '» - КЦ «Музыкальный Мир».';
render_page('Результаты - ' . $c['name'], $content, [
    'active'   => '/competitions',
    'meta'     => $metaDesc,
    'og_image' => !empty($c['cover']) ? $c['cover'] : asset('img/logo_muzmir_main.png'),
]);
