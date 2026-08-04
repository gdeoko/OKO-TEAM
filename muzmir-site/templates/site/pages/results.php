<?php
/**
 * Публичная страница результатов конкурса (живёт годами - не удаляется после завершения).
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
        <?php $rd = trim((string)($c['results_date'] ?? '')); ?>
        <?php if ($rd !== ''): ?>
          <p style="color:var(--muted);margin-top:14px">Результаты конкурса будут опубликованы <b><?= h(ru_date($rd)) ?></b>.
             Список победителей появится на этой странице в день публикации.</p>
        <?php else: ?>
          <p style="color:var(--muted);margin-top:14px">Результаты этого конкурса ещё не опубликованы: приём заявок или оценка жюри продолжается.
             Итоги появятся на этой странице сразу после завершения конкурса.</p>
        <?php endif; ?>
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
/* Конфиденциальность: пользователи с privacy.name_public='initials' (настройка кабинета,
   users.privacy JSON) показываются в публичных результатах как «Фамилия И. О.». */
$privInitials = [];
try {
    foreach (all("SELECT id, privacy FROM users WHERE privacy LIKE '%initials%'") as $pu) {
        $pj = json_decode((string) ($pu['privacy'] ?? ''), true);
        if (is_array($pj) && ($pj['name_public'] ?? '') === 'initials') $privInitials[(int) $pu['id']] = true;
    }
} catch (\Throwable $e) { /* колонки privacy может ещё не быть — тогда скрывать некого */ }
if ($privInitials) {
    $mmInitials = function (string $name): string {
        $parts = array_values(array_filter(preg_split('~\s+~u', trim($name)) ?: [], fn($w) => $w !== ''));
        if (count($parts) < 2) return $name;
        $out = (string) $parts[0];
        for ($i = 1, $n = count($parts); $i < $n; $i++) $out .= ' ' . mb_strtoupper(mb_substr($parts[$i], 0, 1)) . '.';
        return $out;
    };
    foreach ($results as &$rr) if (!empty($rr['user_id']) && isset($privInitials[(int) $rr['user_id']])) $rr['full_name'] = $mmInitials((string) $rr['full_name']);
    unset($rr);
    foreach ($allDiplomaRows as &$rr) if (!empty($rr['user_id']) && isset($privInitials[(int) $rr['user_id']])) $rr['full_name'] = $mmInitials((string) $rr['full_name']);
    unset($rr);
}

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

$vkUrl = cfgv('org_vk');

/* Класс звания для цветовой маркировки карточки. */
$titleTone = function (string $res): string {
    $r = mb_strtoupper($res);
    if (mb_strpos($r, 'ГРАН') !== false)   return 'gp';
    if (mb_strpos($r, 'ЛАУРЕАТ') !== false) return 'lau';
    if (mb_strpos($r, 'ДИПЛОМАНТ') !== false) return 'dip';
    return 'part';
};

ob_start(); ?>
<style>
.res-wrap{max-width:1080px;margin:0 auto;position:relative}
.res-hero{text-align:center;max-width:720px;margin:0 auto 30px;position:relative}
.res-hero::before{content:"";position:absolute;left:50%;top:-60px;width:min(680px,100%);height:360px;transform:translateX(-50%);
  background:radial-gradient(closest-side,var(--gold-soft),transparent 72%);pointer-events:none;z-index:-1}

.res-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-bottom:34px}
.res-stats .stat{position:relative;overflow:hidden}
.res-stats .stat::after{content:"";position:absolute;left:0;right:0;bottom:0;height:2px;background:var(--grad-gold);opacity:.5}

.res-search{position:sticky;top:74px;z-index:5;margin:0 auto 34px;max-width:560px}
.res-search .field--float{margin:0}
.res-search .rs-ic{position:absolute;right:16px;top:50%;transform:translateY(-50%);color:var(--gold-deep);pointer-events:none}
[data-theme="dark"] .res-search .rs-ic{color:var(--gold)}
.res-count{text-align:center;color:var(--muted);font-size:.86rem;margin:-20px 0 30px}

.res-search .field--float>input{box-shadow:var(--shadow-card)}
.res-nom{margin-bottom:40px}
.res-nom > h3{display:flex;align-items:center;gap:12px;border-bottom:1px solid var(--line);
  padding-bottom:12px;margin:0 0 20px;color:var(--text);position:relative}
.res-nom > h3::after{content:"";position:absolute;left:0;bottom:-1px;width:64px;height:2px;background:var(--grad-gold);border-radius:2px}
.res-nom > h3 .n-count{font-family:var(--ff-body);font-size:.8rem;font-weight:700;color:var(--gold-ink);
  background:var(--gold-soft);border:1px solid var(--glass-brd);border-radius:999px;padding:3px 11px}
[data-theme="dark"] .res-nom > h3 .n-count{color:var(--gold)}

.pcard{display:flex;flex-direction:column;gap:14px;padding:22px;position:relative;overflow:hidden}
.pcard-corner{position:absolute;top:12px;right:12px;width:16px;height:16px;pointer-events:none;
  border-top:1.5px solid var(--gold-2);border-right:1.5px solid var(--gold-2);border-top-right-radius:5px;opacity:.4;transition:opacity .3s}
@media(hover:hover){.pcard:hover .pcard-corner{opacity:1}}
/* Гран-при - выделенная карточка */
.pcard--gp{background:radial-gradient(150% 100% at 100% 0,var(--gold-soft),transparent 55%),var(--panel)}
.pcard--gp::before{content:"";position:absolute;left:0;top:0;bottom:0;width:4px;background:var(--grad-gold);opacity:.9}
.pcard--gp .pcard-corner{opacity:.85;border-color:var(--gold)}
.pcard--lau::before{content:"";position:absolute;left:0;top:0;bottom:0;width:3px;background:var(--gold-2);opacity:.5}
.pcard-top{display:flex;gap:16px;align-items:center}
.pring{flex:none;width:88px;height:88px}
.pring .ring-num{font-size:1.5rem}
.pring .ring-num small{font-size:.62rem}
.pcard-id{flex:none;width:88px;height:88px;border-radius:16px;display:grid;place-items:center;
  background:var(--gold-soft);border:1px solid var(--glass-brd);color:var(--gold-deep)}
[data-theme="dark"] .pcard-id{color:var(--gold)}
.pcard-id svg{width:34px;height:34px}
.pcard-name{min-width:0}
.pcard-name b{font-family:var(--ff-display);letter-spacing:.01em;color:var(--text);font-size:1.12rem;
  line-height:1.15;display:block;overflow-wrap:anywhere}
.pcard-name b a{color:inherit}
.pcard-name .pcard-work{color:var(--muted);font-size:.9rem;margin:4px 0 0;overflow-wrap:anywhere}
.pcard-meta{display:flex;flex-wrap:wrap;gap:7px 14px;color:var(--text-dim);font-size:.86rem;
  border-top:1px solid var(--line);padding-top:12px}
.pcard-meta span{display:inline-flex;align-items:center;gap:6px}
.pcard-meta svg{width:14px;height:14px;color:var(--gold-deep);flex:none}
[data-theme="dark"] .pcard-meta svg{color:var(--gold)}
.pcard-foot{display:flex;flex-wrap:wrap;gap:10px;align-items:center;justify-content:space-between;margin-top:auto}
.res-title{display:inline-flex;align-items:center;gap:7px;font-family:var(--ff-display);font-weight:700;
  letter-spacing:.02em;font-size:.98rem;padding:6px 14px;border-radius:999px;white-space:nowrap}
.res-title svg{width:16px;height:16px;flex:none}
.res-title.gp{color:#fff;background:var(--grad-gold);box-shadow:var(--shadow-glow)}
.res-title.lau{color:var(--gold-ink);background:var(--gold-soft);border:1px solid var(--glass-brd)}
[data-theme="dark"] .res-title.lau{color:var(--gold)}
.res-title.dip{color:var(--text-dim);background:var(--panel);border:1px solid var(--glass-brd)}
.res-title.part{color:var(--muted);background:var(--panel);border:1px solid var(--line)}
.pcard .btn{padding:9px 16px;font-size:.86rem}
.vk-link{display:inline-flex;align-items:center;gap:7px;font-size:.84rem;font-weight:700;color:var(--info);
  padding:9px 15px;border-radius:999px;background:color-mix(in srgb,var(--info) 12%,transparent);
  border:1px solid color-mix(in srgb,var(--info) 30%,transparent)}
.vk-link svg{width:16px;height:16px}
.vk-link:hover{color:var(--info);border-color:var(--info)}

.res-empty{grid-column:1/-1;text-align:center;color:var(--muted);padding:40px 20px;display:none}

.res-media{display:flex;flex-wrap:wrap;gap:12px}
.res-poster{width:150px;border:1px solid var(--glass-brd);border-radius:var(--radius-sm);overflow:hidden;box-shadow:var(--shadow-card)}
.res-poster img{width:100%;display:block}
.res-video-chip{display:inline-flex;align-items:center;gap:8px;padding:9px 16px;border-radius:999px;background:var(--panel);
  border:1px solid var(--glass-brd);color:var(--text);font-size:.86rem;font-weight:600;box-shadow:var(--shadow-card);backdrop-filter:blur(10px)}
.res-video-chip svg{color:var(--gold-deep)}
[data-theme="dark"] .res-video-chip svg{color:var(--gold)}
.res-video-chip:hover{border-color:var(--gold);color:var(--gold-2)}

@media(max-width:860px){.res-stats{grid-template-columns:repeat(2,1fr)}}
@media(max-width:560px){
  .res-search{top:66px}
  .pcard-top{gap:13px}
  .pring,.pcard-id{width:74px;height:74px}
  .pring .ring-num{font-size:1.25rem}
}
/* Узкие экраны 360/390: без горизонтального оверфлоу, звание переносится по словам */
@media(max-width:400px){
  .pcard{padding:18px}
  .res-title{white-space:normal;font-size:.92rem;overflow-wrap:anywhere}
  .pcard-foot{gap:9px}
  .pcard .btn,.vk-link{width:100%;justify-content:center}
}
@media(prefers-reduced-motion:reduce){
  .pcard-corner,.res-video-chip,.vk-link{transition:none}
}
</style>

<section class="section">
  <div class="container res-wrap">
    <a class="aw-back" href="<?= url('/menu') ?>"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M11 6l-6 6 6 6"/></svg>Назад</a>
    <div class="res-hero reveal">
      <p class="eyebrow"><?= h($typeLabel) ?> · Итоги</p>
      <h1><?= h($c['name']) ?></h1>
      <p style="color:var(--muted);margin-top:10px">
        Официальные результаты конкурса Культурного центра «Музыкальный Мир».
        <?php if (!empty($c['results_date'])): ?>Подведены <?= h(ru_date($c['results_date'])) ?>.<?php endif; ?>
        Каждый диплом можно проверить в <a href="<?= url('/verify') ?>">реестре подлинности</a>.
      </p>
    </div>

    <?php if (!$results): ?>
      <div class="reveal" style="text-align:center;background:var(--panel);backdrop-filter:blur(12px);border:1px solid var(--glass-brd);border-radius:var(--radius);padding:52px 28px;box-shadow:var(--shadow-card)">
        <svg viewBox="0 0 24 24" width="52" height="52" fill="none" stroke="var(--gold)" stroke-width="1.4" style="margin:0 auto 14px"><circle cx="12" cy="8" r="6"/><path d="M8.2 13.9 7 22l5-3 5 3-1.2-8.1"/></svg>
        <h2>Результаты готовятся к публикации</h2>
        <p style="color:var(--muted);max-width:460px;margin:0 auto 22px">Конкурс завершён, наградные документы формируются. Итоги появятся на этой странице в ближайшее время.</p>
        <a class="btn btn--primary" href="<?= url('/competition/' . $c['slug']) ?>">О конкурсе</a>
      </div>
    <?php else: ?>

      <div class="res-stats reveal">
        <div class="stat"><b data-count="<?= count($results) ?>">0</b><span>Победителей и лауреатов</span></div>
        <div class="stat"><b data-count="<?= $grandPrix ?>">0</b><span>Гран-при</span></div>
        <div class="stat"><b data-count="<?= $laureates ?>">0</b><span>Лауреатов</span></div>
        <div class="stat"><b data-count="<?= count($cities) ?>">0</b><span>Городов и регионов</span></div>
      </div>

      <div class="res-search reveal">
        <div class="field--float">
          <input type="search" id="resSearch" placeholder=" " autocomplete="off" aria-label="Поиск по имени или номеру диплома">
          <label for="resSearch">Поиск по фамилии, имени или номеру диплома</label>
          <svg class="rs-ic" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>
        </div>
      </div>
      <p class="res-count" id="resCount" aria-live="polite"></p>

      <div id="resList">
      <?php foreach ($byNomination as $nom => $rows): ?>
        <div class="res-nom reveal" data-nom>
          <h3>
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="var(--gold)" stroke-width="1.6" stroke-linecap="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
            <span><?= h($nom) ?></span>
          </h3>
          <div class="grid grid-2">
          <?php foreach ($rows as $i => $r):
            $displayName = $r['is_group'] && $r['group_name'] ? $r['group_name'] : $r['full_name'];
            $aslug = $artistSlugMap[mb_strtolower(trim($r['full_name']))] ?? null;
            $tone = $titleTone((string) $r['result']);
            $score = is_numeric($r['score']) ? (float) $r['score'] : null;
            $ringPct = $score !== null ? max(0, min(100, $score * 10)) : 0;
            $needle = mb_strtolower(trim($displayName . ' ' . $r['full_name'] . ' ' . $r['diploma_number'] . ' ' . $r['work_title'] . ' ' . $r['city']));
          ?>
            <div class="card pcard pcard--<?= $tone ?> reveal" style="--i:<?= $i ?>" data-item data-search="<?= h($needle) ?>">
              <span class="pcard-corner" aria-hidden="true"></span>
              <div class="pcard-top">
                <?php if ($score !== null): ?>
                  <div class="stat-ring pring" data-value="<?= $ringPct ?>">
                    <svg viewBox="0 0 120 120"><circle class="ring-track" cx="60" cy="60" r="52"></circle><circle class="ring-val ring-fill" cx="60" cy="60" r="52"></circle></svg>
                    <div class="ring-num"><?= h(rtrim(rtrim(number_format($score, 1, '.', ''), '0'), '.')) ?><small>/10</small></div>
                  </div>
                <?php else: ?>
                  <div class="pcard-id">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l2.6 5.5 6 .8-4.4 4.2 1.1 6-5.3-2.9L6.4 19.5l1.1-6L3.1 9.3l6-.8z"/></svg>
                  </div>
                <?php endif; ?>
                <div class="pcard-name">
                  <b><?php if ($aslug): ?><a href="<?= url('/artist/' . $aslug) ?>"><?= h($displayName) ?></a><?php else: ?><?= h($displayName) ?><?php endif; ?></b>
                  <?php if ($r['work_title']): ?><p class="pcard-work">«<?= h($r['work_title']) ?>»</p><?php endif; ?>
                </div>
              </div>

              <?php if ($r['age_category'] || $r['city'] || $r['institution']): ?>
                <div class="pcard-meta">
                  <?php if ($r['age_category']): ?>
                    <span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg><?= h($r['age_category']) ?></span>
                  <?php endif; ?>
                  <?php if ($r['city']): ?>
                    <span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 21s-7-6-7-11a7 7 0 0 1 14 0c0 5-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/></svg><?= h($r['city']) ?></span>
                  <?php endif; ?>
                  <?php if ($r['institution']): ?>
                    <span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 21h18M5 21V8l7-4 7 4v13M9 21v-5h6v5"/></svg><?= h($r['institution']) ?></span>
                  <?php endif; ?>
                </div>
              <?php endif; ?>

              <div class="pcard-foot">
                <span class="res-title <?= $tone ?>">
                  <?php if ($tone === 'gp'): ?><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M8 21h8M12 17v4M5 4h14v3a7 7 0 0 1-14 0zM5 4H3v2a3 3 0 0 0 3 3M19 4h2v2a3 3 0 0 1-3 3"/></svg><?php endif; ?>
                  <?= h($r['result']) ?>
                </span>
                <?php if (!empty($r['diploma_number'])): ?>
                  <a class="btn btn--ghost" href="<?= url('/verify/' . $r['diploma_number']) ?>">Проверить диплом</a>
                <?php elseif ($vkUrl): ?>
                  <a class="vk-link" href="<?= h($vkUrl) ?>" target="_blank" rel="noopener" title="Публикация результатов ВКонтакте">
                    <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12.9 16.5c-5.4 0-8.9-3.8-9-9.9h2.8c.1 4.5 2.1 6.4 3.6 6.8V6.6h2.6v3.9c1.5-.2 3-1.8 3.6-3.9h2.6c-.4 2.6-2 4.2-3.1 4.8 1.1.5 2.9 1.9 3.6 4.6h-2.9c-.5-1.8-1.9-3.2-3.7-3.4v3.4z"/></svg>
                    Смотреть в VK
                  </a>
                <?php endif; ?>
              </div>
            </div>
          <?php endforeach; ?>
          </div>
        </div>
      <?php endforeach; ?>
      <div class="res-empty" id="resEmpty">По вашему запросу ничего не найдено. Уточните фамилию или номер диплома.</div>
      </div>

      <?php if ($posters): ?>
        <div class="section-head reveal" style="margin:8px 0 16px"><p class="eyebrow">Материалы</p><h2>Афиши конкурса</h2></div>
        <div class="res-media reveal" style="margin-bottom:36px">
          <?php foreach ($posters as $p): ?>
            <a class="res-poster" href="<?= h($p['image_path']) ?>" target="_blank" rel="noopener"><img src="<?= h($p['image_path']) ?>" alt="Афиша конкурса «<?= h($c['name']) ?>» - Культурного центра «Музыкальный Мир»" loading="lazy"></a>
          <?php endforeach; ?>
        </div>
      <?php endif; ?>

      <?php if ($videos): ?>
        <div class="section-head reveal" style="margin:8px 0 16px"><p class="eyebrow">Смотрите</p><h2>Видео-номера победителей</h2></div>
        <div class="res-media reveal">
          <?php foreach ($videos as $vurl => $v): ?>
            <a class="res-video-chip" href="<?= h($vurl) ?>" target="_blank" rel="noopener">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>
              <?= h($v['name']) ?> · <?= h($v['platform']) ?>
            </a>
          <?php endforeach; ?>
        </div>
      <?php endif; ?>

      <script>
      (function () {
        var inp = document.getElementById('resSearch');
        if (!inp) return;
        var items = [].slice.call(document.querySelectorAll('[data-item]'));
        var noms  = [].slice.call(document.querySelectorAll('[data-nom]'));
        var empty = document.getElementById('resEmpty');
        var count = document.getElementById('resCount');
        var total = items.length;
        function apply() {
          var q = inp.value.trim().toLowerCase();
          var shown = 0;
          items.forEach(function (el) {
            var ok = !q || (el.getAttribute('data-search') || '').indexOf(q) !== -1;
            el.style.display = ok ? '' : 'none';
            if (ok) shown++;
          });
          noms.forEach(function (n) {
            var any = n.querySelector('[data-item]:not([style*="display: none"])');
            n.style.display = any ? '' : 'none';
          });
          empty.style.display = shown ? 'none' : 'block';
          count.textContent = q ? ('Найдено: ' + shown + ' из ' + total) : '';
        }
        inp.addEventListener('input', apply);
      })();
      </script>

    <?php endif; ?>
  </div>
</section>
<?php
$content = ob_get_clean();
$metaDesc = $results
    ? 'Результаты конкурса «' . $c['name'] . '»: ' . count($results) . ' победителей и лауреатов, ' . count($byNomination) . ' номинаций. Культурного центра «Музыкальный Мир».'
    : 'Результаты конкурса «' . $c['name'] . '» - Культурного центра «Музыкальный Мир».';
render_page('Результаты - ' . $c['name'], $content, [
    'active'   => '/competitions',
    'meta'     => $metaDesc,
    'og_image' => !empty($c['cover']) ? $c['cover'] : asset('img/logo_muzmir_main.png'),
]);
