<?php
/**
 * Публичное портфолио участника («страница-визитка»).
 * Переменная $slug задана роутером, формат: транслитерация ФИО + "-" + id (например ivanov-ivan-347).
 * Публикуются только участники, получившие хотя бы один диплом.
 */
$slug = trim((string) ($slug ?? ''));

/** Транслитерация в латиницу для slug (буквы/цифры/дефис, как того требует роутер). */
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

/** Все дипломы с данными заявки, конкурса и педагога (только реальные достижения — публичный реестр). */
$rows = all(
    "SELECT a.id AS app_id, a.user_id, a.full_name, a.city, a.institution, a.teacher,
            a.nomination, a.work_title, a.formation, a.age_category, a.video_url, a.video_platform,
            d.number, d.result AS d_result, a.result AS a_result, d.created_at AS d_created,
            c.name AS comp_name, c.slug AS comp_slug, c.type AS comp_type
     FROM diplomas d
     JOIN applications a ON a.id = d.application_id
     LEFT JOIN competitions c ON c.id = a.competition_id
     WHERE a.full_name <> ''
     ORDER BY d.created_at DESC, d.id DESC"
);

/** Группируем по человеку (нормализованное ФИО), присваиваем стабильный id — user_id, иначе минимальный id заявки. */
$groups = [];
foreach ($rows as $r) {
    $key = mb_strtolower(trim($r['full_name']));
    if ($key === '') continue;
    if (!isset($groups[$key])) $groups[$key] = ['name' => $r['full_name'], 'rows' => [], 'uid' => null, 'minApp' => PHP_INT_MAX];
    $groups[$key]['rows'][] = $r;
    if (!empty($r['user_id'])) $groups[$key]['uid'] = (int) $r['user_id'];
    $groups[$key]['minApp'] = min($groups[$key]['minApp'], (int) $r['app_id']);
}

/** Тот же принцип для «канонического» id педагога — по всему публичному реестру дипломов. */
$teacherCanonicalId = function (string $teacher) use ($rows): int {
    $tkey = mb_strtolower(trim($teacher));
    $min = PHP_INT_MAX;
    foreach ($rows as $r) {
        if (mb_strtolower(trim((string) $r['teacher'])) === $tkey) $min = min($min, (int) $r['app_id']);
    }
    return $min === PHP_INT_MAX ? 0 : $min;
};

$artist = null; $items = [];
foreach ($groups as $g) {
    $cid = $g['uid'] ?: $g['minApp'];
    $gslug = $slugify($g['name']) . '-' . $cid;
    if ($gslug === $slug) {
        $artist = ['name' => $g['name'], 'slug' => $gslug];
        $items = $g['rows'];
        break;
    }
}

/** Сводные данные найденного участника. */
$competitions = []; $teachers = []; $videos = []; $grandPrixCount = 0;
$wins = ['Гран-при' => 0, 'Лауреат' => 0, 'Дипломант' => 0, 'Участник' => 0];
$hasIntl = false; $awardsList = [];
if ($artist) {
    $artist['city'] = $items[0]['city'] ?? '';
    $artist['institution'] = $items[0]['institution'] ?? '';
    foreach ($items as $it) {
        if (!empty($it['comp_slug']) && !isset($competitions[$it['comp_slug']])) {
            $competitions[$it['comp_slug']] = ['name' => $it['comp_name'], 'slug' => $it['comp_slug'], 'type' => $it['comp_type']];
        }
        if (mb_stripos((string) $it['comp_type'], 'международ') !== false) $hasIntl = true;
        $tname = trim((string) $it['teacher']);
        if ($tname !== '' && !isset($teachers[$tname])) {
            $teachers[$tname] = $slugify($tname) . '-' . $teacherCanonicalId($tname);
        }
        if (!empty($it['video_url']) && !isset($videos[$it['video_url']])) {
            $videos[$it['video_url']] = $it['video_platform'] ?: 'Видео';
        }
        $res = (string) ($it['d_result'] ?: $it['a_result']);
        if ($res !== '') $awardsList[$res] = true;
        if (mb_stripos($res, 'ГРАН-ПРИ') !== false)      { $grandPrixCount++; $wins['Гран-при']++; }
        elseif (mb_stripos($res, 'ЛАУРЕАТ') !== false)    { $wins['Лауреат']++; }
        elseif (mb_stripos($res, 'ДИПЛОМАНТ') !== false)  { $wins['Дипломант']++; }
        else                                               { $wins['Участник']++; }
    }
}
$total = max(1, count($items));
$laureateTotal = $wins['Гран-при'] + $wins['Лауреат'];

ob_start(); ?>
<style>
.pro{max-width:1000px;margin:0 auto}

/* Шапка профиля */
.pro-head{position:relative;overflow:hidden;display:flex;gap:28px;align-items:center;
  background:var(--panel);border:1px solid var(--glass-brd);border-radius:var(--radius);
  padding:32px 34px;box-shadow:var(--shadow-card);backdrop-filter:blur(14px)}
.pro-head::before{content:"";position:absolute;inset:0;pointer-events:none;
  background:radial-gradient(130% 150% at 8% -20%,var(--gold-soft),transparent 55%)}
.pro-ava{position:relative;flex:0 0 auto;width:118px;height:118px;border-radius:50%;
  background:var(--grad-gold);color:var(--gold-fg);display:flex;align-items:center;justify-content:center;
  font-family:var(--ff-display);font-weight:800;letter-spacing:.02em;font-size:2.8rem;box-shadow:var(--shadow-btn)}
.pro-ava::after{content:"";position:absolute;inset:-6px;border-radius:50%;border:1px dashed color-mix(in srgb,var(--gold) 42%,transparent)}
/* вращающийся золотой ореол-медальон */
.pro-ava::before{content:"";position:absolute;inset:-13px;border-radius:50%;z-index:-1;
  background:conic-gradient(from 0deg,var(--gold),transparent 25%,var(--gold) 50%,transparent 75%,var(--gold));
  opacity:.32;animation:proRing 16s linear infinite}
@keyframes proRing{to{transform:rotate(360deg)}}
.pro-id{position:relative;min-width:0}
.pro-id .eyebrow{margin-bottom:2px}
.pro-id h1{margin:.06em 0;font-size:clamp(1.55rem,4.4vw,2.5rem);line-height:1.06;overflow-wrap:anywhere}
.pro-loc{display:flex;flex-wrap:wrap;align-items:center;gap:6px 14px;color:var(--muted);font-size:.95rem;margin-top:4px}
.pro-loc svg{width:15px;height:15px;stroke:var(--gold-2);vertical-align:-2px;margin-right:4px}
.pro-badges{display:flex;flex-wrap:wrap;gap:8px;margin-top:14px}
.pro-actions{display:flex;flex-wrap:wrap;gap:10px;margin-top:16px}
.pro-actions .btn{transition:transform .2s ease,border-color .2s ease,color .2s ease}
@media(hover:hover){.pro-actions .btn:hover{transform:translateY(-2px)}}
@media(max-width:640px){
  .pro-head{flex-direction:column;text-align:center;padding:28px 20px}
  .pro-loc,.pro-badges,.pro-actions{justify-content:center}
}

/* Инфографика достижений */
.pro-stats{margin-top:26px}
.pro-stats .stat b{cursor:default}
.medal-panel{margin-top:14px}
.medal-panel .bar-fill{display:block;height:100%;width:100%;transform-origin:left center;
  background:var(--grad-gold);box-shadow:0 0 12px rgba(201,168,76,.4);border-radius:inherit;
  transition:transform 1.1s cubic-bezier(.2,.8,.2,1)}
.medal-panel .bar-lbl b{color:var(--gold-2);font-family:var(--ff-display);letter-spacing:.02em}

/* Сота достижений */
.honeycomb{display:flex;flex-wrap:wrap;justify-content:center;margin:0 auto 8px;max-width:920px}
.hex{width:206px;margin:10px 8px 38px;position:relative}
.hex:nth-child(even){margin-top:46px}
.hex-inner{position:relative;clip-path:polygon(25% 3%,75% 3%,100% 50%,75% 97%,25% 97%,0% 50%);
  background:linear-gradient(160deg,var(--panel-solid),var(--gold-soft));border:1px solid var(--glass-brd);
  padding:34px 22px;aspect-ratio:.92;display:flex;flex-direction:column;justify-content:center;gap:6px;
  text-align:center;box-shadow:var(--shadow-card);transition:transform .25s,box-shadow .25s;color:inherit;overflow:hidden}
/* верхний блик внутри соты */
.hex-inner::before{content:"";position:absolute;left:50%;top:-30%;width:80%;height:60%;transform:translateX(-50%);
  background:radial-gradient(50% 60% at 50% 50%,color-mix(in srgb,var(--gold) 20%,transparent),transparent 70%);pointer-events:none}
@media(hover:hover){.hex-inner:hover{transform:scale(1.06);box-shadow:var(--shadow-glow);border-color:var(--gold)}}
.hex-star{width:22px;height:22px;margin:0 auto;color:var(--gold);opacity:.85}
.hex-star svg{width:100%;height:100%}
.hex-result{font-family:var(--ff-display);letter-spacing:.02em;color:var(--gold-2);font-size:1.05rem;line-height:1.15}
.hex-comp{font-size:.82rem;color:var(--text);font-weight:600;overflow-wrap:anywhere}
.hex-date{font-size:.74rem;color:var(--muted)}
@media (max-width:720px){
  .honeycomb{flex-direction:column;align-items:center}
  .hex{width:100%;max-width:340px;margin:8px 0}
  .hex:nth-child(even){margin-top:8px}
  .hex-inner{clip-path:none;border-radius:var(--radius);aspect-ratio:auto;padding:20px 22px}
}

/* Хронология дипломов */
.dip-item{display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap;align-items:flex-start}
.dip-item h4{font-family:var(--ff-display);letter-spacing:.02em;font-size:1.14rem;color:var(--gold-2);margin:0}
.dip-item .actions{display:flex;gap:10px;flex-wrap:wrap}

.art-chips{display:flex;flex-wrap:wrap;gap:9px;margin-top:6px}
.art-chip{display:inline-flex;align-items:center;gap:6px;padding:9px 16px;border-radius:999px;background:var(--panel);
  border:1px solid var(--glass-brd);color:var(--text);font-size:.88rem;font-weight:600;box-shadow:var(--shadow-card);
  backdrop-filter:blur(10px);transition:border-color .2s,color .2s,transform .2s}
@media(hover:hover){.art-chip:hover{border-color:var(--gold);color:var(--gold-2);transform:translateY(-2px)}}
@media(prefers-reduced-motion:reduce){.pro-ava::before{animation:none}}
</style>

<section class="section">
  <div class="container pro">
    <?php if ($artist): ?>
      <!-- Шапка профиля -->
      <div class="pro-head reveal">
        <div class="pro-ava" aria-hidden="true"><?= h(mb_strtoupper(mb_substr($artist['name'], 0, 1))) ?></div>
        <div class="pro-id">
          <p class="eyebrow">Портфолио участника</p>
          <h1><?= h($artist['name']) ?></h1>
          <?php if ($artist['city'] || $artist['institution']): ?>
            <p class="pro-loc">
              <?php if ($artist['city']): ?>
                <span><svg viewBox="0 0 24 24" fill="none" stroke-width="1.6"><path d="M12 21s7-6.3 7-11a7 7 0 1 0-14 0c0 4.7 7 11 7 11Z"/><circle cx="12" cy="10" r="2.5"/></svg><?= h($artist['city']) ?></span>
              <?php endif; ?>
              <?php if ($artist['institution']): ?>
                <span><svg viewBox="0 0 24 24" fill="none" stroke-width="1.6"><path d="M3 21h18M5 21V10l7-5 7 5v11M9 21v-6h6v6"/></svg><?= h($artist['institution']) ?></span>
              <?php endif; ?>
            </p>
          <?php endif; ?>
          <div class="pro-badges">
            <?php if ($grandPrixCount > 0): ?><span class="badge badge--judging">Обладатель Гран-при</span><?php endif; ?>
            <?php if ($hasIntl): ?><span class="badge badge--intl">Международный уровень</span><?php endif; ?>
            <span class="badge badge--open">В реестре наград</span>
          </div>
          <?php $shareUrl = rtrim(cfgv('base_url'), '/') . '/artist/' . $artist['slug']; ?>
          <div class="pro-actions">
            <button class="btn btn--ghost" type="button" data-share
                    data-share-title="<?= h($artist['name']) ?> - КЦ Музыкальный Мир"
                    data-share-url="<?= h($shareUrl) ?>">Поделиться</button>
          </div>
        </div>
      </div>

      <!-- Быстрые показатели -->
      <div class="grid grid-4 pro-stats reveal">
        <div class="stat"><b data-count="<?= count($items) ?>">0</b><span>Наградных документов</span></div>
        <div class="stat"><b data-count="<?= $laureateTotal ?>">0</b><span>Лауреатских званий</span></div>
        <div class="stat"><b data-count="<?= $grandPrixCount ?>">0</b><span>Гран-при</span></div>
        <div class="stat"><b data-count="<?= count($competitions) ?>">0</b><span>Конкурсов</span></div>
      </div>

      <!-- Достижения инфографикой -->
      <div class="section-head reveal" style="margin-bottom:14px;margin-top:44px"><p class="eyebrow">Структура наград</p><h2>Достижения</h2><div class="gold-rule"></div></div>
      <div class="card reveal medal-panel">
        <?php foreach ($wins as $label => $cnt): if ($cnt === 0) continue; $pct = round($cnt / $total * 100); ?>
          <div class="bar-row">
            <div class="bar-lbl"><span><?= h($label) ?></span><b><?= (int) $cnt ?></b></div>
            <div class="bar" data-value="<?= $pct ?>"><i class="bar-fill"></i></div>
          </div>
        <?php endforeach; ?>
      </div>

      <!-- Сота наград -->
      <div class="section-head reveal" style="margin-bottom:12px;margin-top:44px"><p class="eyebrow">Награды и результаты</p><h2>Стена достижений</h2><div class="gold-rule"></div></div>
      <div class="honeycomb reveal">
        <?php foreach ($items as $it): ?>
          <div class="hex">
            <a class="hex-inner" href="<?= url('/verify/' . $it['number']) ?>">
              <span class="hex-star" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l3 7h7l-5.5 4 2 7L12 16l-6.5 4 2-7L2 9h7z"/></svg></span>
              <span class="hex-result"><?= h($it['d_result'] ?: $it['a_result'] ?: 'Диплом') ?></span>
              <span class="hex-comp"><?= h($it['comp_name'] ?: 'Конкурс') ?></span>
              <span class="hex-date"><?= h(ru_date(substr((string) $it['d_created'], 0, 10))) ?></span>
            </a>
          </div>
        <?php endforeach; ?>
      </div>

      <!-- Подробная хронология -->
      <div class="section-head reveal" style="margin-bottom:24px;margin-top:44px"><p class="eyebrow">Подробно</p><h2>Дипломы и результаты</h2><div class="gold-rule"></div></div>
      <div class="timeline reveal">
        <?php foreach ($items as $it): ?>
          <div class="timeline-item">
            <div class="tl-date"><?= h(ru_date(substr((string) $it['d_created'], 0, 10))) ?></div>
            <div class="dip-item">
              <div>
                <h4><?= h($it['d_result'] ?: $it['a_result'] ?: 'Диплом') ?></h4>
                <p style="color:var(--text-dim);margin:6px 0 0;font-size:.94rem">
                  <?= h($it['comp_name'] ?: 'Конкурс') ?>
                  <?php if ($it['nomination']): ?> - <?= h($it['nomination']) ?><?php endif; ?>
                  <?php if ($it['formation']): ?> - <?= h($it['formation']) ?><?php endif; ?>
                  <?php if ($it['work_title']): ?> - «<?= h($it['work_title']) ?>»<?php endif; ?>
                </p>
                <?php if ($it['teacher']): ?>
                  <p style="color:var(--muted);margin:3px 0 0;font-size:.86rem">Педагог - <?= h($it['teacher']) ?></p>
                <?php endif; ?>
              </div>
              <div class="actions">
                <?php if (!empty($it['video_url'])): ?>
                  <a class="btn btn--ghost" href="<?= h($it['video_url']) ?>" target="_blank" rel="noopener"><?= h($it['video_platform'] ?: 'Видео') ?></a>
                <?php endif; ?>
                <a class="btn btn--ghost" href="<?= url('/verify/' . $it['number']) ?>">Проверить</a>
              </div>
            </div>
          </div>
        <?php endforeach; ?>
      </div>

      <?php if ($competitions): ?>
        <div class="section-head reveal" style="margin-bottom:14px;margin-top:44px"><p class="eyebrow">География побед</p><h2>Конкурсы</h2></div>
        <div class="art-chips reveal">
          <?php foreach ($competitions as $c): ?>
            <a class="art-chip" href="<?= url('/competition/' . $c['slug']) ?>"><?= h($c['name']) ?></a>
          <?php endforeach; ?>
        </div>
      <?php endif; ?>

      <?php if ($teachers): ?>
        <div class="section-head reveal" style="margin-bottom:14px;margin-top:32px"><p class="eyebrow">Наставники</p><h2>Педагоги</h2></div>
        <div class="art-chips reveal">
          <?php foreach ($teachers as $tname => $tslug): ?>
            <a class="art-chip" href="<?= url('/pedagog/' . $tslug) ?>"><?= h($tname) ?></a>
          <?php endforeach; ?>
        </div>
      <?php endif; ?>

    <?php else:
      http_response_code(404); ?>
      <div class="reveal" style="text-align:center;background:var(--panel);backdrop-filter:blur(12px);border:1px solid var(--glass-brd);border-radius:var(--radius);padding:52px 28px;box-shadow:var(--shadow-card)">
        <svg aria-hidden="true" viewBox="0 0 24 24" width="52" height="52" fill="none" stroke="var(--gold)" stroke-width="1.4" style="margin:0 auto 14px"><circle cx="12" cy="8" r="4"/><path d="M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1"/></svg>
        <h1 style="font-size:clamp(1.6rem,4vw,2.4rem)">Портфолио пока не опубликовано</h1>
        <p style="color:var(--muted);max-width:460px;margin:0 auto 22px">Публичная страница участника появляется, когда его работы получают оценку жюри и наградные документы. Проверьте ссылку или посмотрите действующие конкурсы.</p>
        <a class="btn btn--primary" href="<?= url('/competitions') ?>">Действующие конкурсы</a>
      </div>
    <?php endif; ?>
  </div>
</section>
<?php
$content = ob_get_clean();
$ttl = $artist ? $artist['name'] : 'Портфолио участника';
$metaDesc = $artist
    ? 'Портфолио участника ' . $artist['name'] . ': ' . count($items) . ' наградных документов, ' . count($competitions) . ' конкурсов КЦ «Музыкальный Мир». Проверка подлинности дипломов онлайн.'
    : 'Портфолио участника конкурсов КЦ «Музыкальный Мир».';

// JSON-LD Person — для индексации персональной страницы участника.
$opts = ['active' => '', 'meta' => $metaDesc];
if ($artist) {
    $personLd = [
        '@context' => 'https://schema.org',
        '@type'    => 'Person',
        'name'     => $artist['name'],
        'url'      => rtrim(cfgv('base_url'), '/') . '/artist/' . $artist['slug'],
    ];
    if ($artist['city'])        $personLd['homeLocation'] = ['@type' => 'Place', 'name' => $artist['city']];
    if ($artist['institution']) $personLd['affiliation']  = ['@type' => 'Organization', 'name' => $artist['institution']];
    if ($awardsList)            $personLd['award']        = array_values(array_keys($awardsList));
    $opts['jsonld'] = $personLd;
}
render_page($ttl, $content, $opts);
