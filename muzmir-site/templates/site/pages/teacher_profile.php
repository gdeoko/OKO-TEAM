<?php
/**
 * Публичный профиль педагога («индексация по именам» — SEO).
 * Переменная $slug задана роутером, формат: транслитерация имени педагога + "-" + id (например ivanova-svetlana-12).
 * Педагог — свободное текстовое поле в заявках (applications.teacher), отдельной таблицы нет,
 * поэтому профиль строится из публичного реестра дипломов его учеников.
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

/** Тот же реестр «дипломы + заявки», что и на странице участника — только учеников с наградами. */
$rows = all(
    "SELECT a.id AS app_id, a.user_id, a.full_name, a.city, a.institution, a.teacher,
            a.nomination, a.work_title, a.formation,
            d.number, d.result AS d_result, a.result AS a_result, d.created_at AS d_created,
            c.name AS comp_name, c.slug AS comp_slug, c.type AS comp_type
     FROM diplomas d
     JOIN applications a ON a.id = d.application_id
     LEFT JOIN competitions c ON c.id = a.competition_id
     WHERE a.teacher <> ''
     ORDER BY d.created_at DESC, d.id DESC"
);

/** Группируем по педагогу (нормализованное имя), id — минимальный id заявки со ссылкой на этого педагога. */
$groups = [];
foreach ($rows as $r) {
    $key = mb_strtolower(trim($r['teacher']));
    if ($key === '') continue;
    if (!isset($groups[$key])) $groups[$key] = ['name' => trim($r['teacher']), 'rows' => [], 'minApp' => PHP_INT_MAX];
    $groups[$key]['rows'][] = $r;
    $groups[$key]['minApp'] = min($groups[$key]['minApp'], (int) $r['app_id']);
}

$teacher = null; $items = [];
foreach ($groups as $g) {
    $gslug = $slugify($g['name']) . '-' . $g['minApp'];
    if ($gslug === $slug) {
        $teacher = ['name' => $g['name'], 'slug' => $gslug];
        $items = $g['rows'];
        break;
    }
}

/** Транслитерация ФИО ученика для ссылки на его портфолио (тот же принцип, что и в artist.php). */
$artistSlugFor = function (string $fullName) use ($rows, $slugify): string {
    $allRows = all(
        "SELECT a.id AS app_id, a.user_id, a.full_name
         FROM diplomas d JOIN applications a ON a.id = d.application_id
         WHERE a.full_name <> ''"
    );
    $key = mb_strtolower(trim($fullName));
    $uid = null; $minApp = PHP_INT_MAX;
    foreach ($allRows as $r) {
        if (mb_strtolower(trim($r['full_name'])) !== $key) continue;
        if (!empty($r['user_id'])) $uid = (int) $r['user_id'];
        $minApp = min($minApp, (int) $r['app_id']);
    }
    $cid = $uid ?: ($minApp === PHP_INT_MAX ? 0 : $minApp);
    return $slugify($fullName) . '-' . $cid;
};

/** Сводка: ученики, победы, конкурсы, отзывы (по совпадению user_id ученика с автором отзыва). */
$students = []; $competitions = []; $wins = ['Гран-при' => 0, 'Лауреат' => 0, 'Дипломант' => 0, 'Иное' => 0];
$studentUserIds = []; $hasIntl = false; $reviews = [];
if ($teacher) {
    foreach ($items as $it) {
        $sKey = mb_strtolower(trim($it['full_name']));
        if (!isset($students[$sKey])) {
            $students[$sKey] = ['name' => $it['full_name'], 'city' => $it['city'], 'count' => 0];
        }
        $students[$sKey]['count']++;
        if (!empty($it['user_id'])) $studentUserIds[(int) $it['user_id']] = true;

        if (!empty($it['comp_slug']) && !isset($competitions[$it['comp_slug']])) {
            $competitions[$it['comp_slug']] = ['name' => $it['comp_name'], 'slug' => $it['comp_slug']];
        }
        if (mb_stripos((string) $it['comp_type'], 'международ') !== false) $hasIntl = true;

        $res = (string) ($it['d_result'] ?: $it['a_result']);
        if (mb_stripos($res, 'ГРАН-ПРИ') !== false) $wins['Гран-при']++;
        elseif (mb_stripos($res, 'ЛАУРЕАТ') !== false) $wins['Лауреат']++;
        elseif (mb_stripos($res, 'ДИПЛОМАНТ') !== false) $wins['Дипломант']++;
        else $wins['Иное']++;
    }

    if ($studentUserIds) {
        $ids = array_keys($studentUserIds);
        $ph = implode(',', array_fill(0, count($ids), '?'));
        $reviews = all("SELECT * FROM reviews WHERE status='published' AND user_id IN ($ph) ORDER BY created_at DESC", $ids);
    }
}
$total = max(1, count($items));
$laureateTotal = $wins['Гран-при'] + $wins['Лауреат'];

ob_start(); ?>
<style>
.tp{max-width:1000px;margin:0 auto}

/* Шапка профиля */
.tp-head{position:relative;overflow:hidden;display:flex;gap:28px;align-items:center;
  background:var(--panel);border:1px solid var(--glass-brd);border-radius:var(--radius);
  padding:32px 34px;box-shadow:var(--shadow-card);backdrop-filter:blur(14px)}
.tp-head::before{content:"";position:absolute;inset:0;pointer-events:none;
  background:radial-gradient(130% 150% at 8% -20%,var(--gold-soft),transparent 55%)}
.tp-ava{position:relative;flex:0 0 auto;width:118px;height:118px;border-radius:50%;
  background:var(--grad-gold);color:var(--gold-fg);display:flex;align-items:center;justify-content:center;
  font-family:var(--ff-display);font-weight:800;letter-spacing:.02em;font-size:2.8rem;box-shadow:var(--shadow-btn)}
.tp-ava::after{content:"";position:absolute;inset:-6px;border-radius:50%;border:1px dashed color-mix(in srgb,var(--gold) 42%,transparent)}
.tp-ava::before{content:"";position:absolute;inset:-13px;border-radius:50%;z-index:-1;
  background:conic-gradient(from 0deg,var(--gold),transparent 25%,var(--gold) 50%,transparent 75%,var(--gold));
  opacity:.32;animation:tpRing 16s linear infinite}
@keyframes tpRing{to{transform:rotate(360deg)}}
.tp-id{position:relative;min-width:0}
.tp-id .eyebrow{margin-bottom:2px}
.tp-id h1{margin:.06em 0;font-size:clamp(1.55rem,4.4vw,2.5rem);line-height:1.06;overflow-wrap:anywhere}
.tp-id p.role{color:var(--muted);font-size:.95rem;margin:4px 0 0}
.tp-badges{display:flex;flex-wrap:wrap;gap:8px;margin-top:14px}
.tp-actions{display:flex;flex-wrap:wrap;gap:10px;margin-top:16px}
.tp-actions .btn{transition:transform .2s ease,border-color .2s ease,color .2s ease}
@media(hover:hover){.tp-actions .btn:hover{transform:translateY(-2px)}}
@media(max-width:640px){.tp-head{flex-direction:column;text-align:center;padding:28px 20px}.tp-badges,.tp-actions{justify-content:center}}

/* Инфографика */
.tp-stats{margin-top:26px}
.medal-panel{margin-top:14px}
.medal-panel .bar-fill{display:block;height:100%;width:100%;transform-origin:left center;
  background:var(--grad-gold);box-shadow:0 0 12px rgba(201,168,76,.4);border-radius:inherit;
  transition:transform 1.1s cubic-bezier(.2,.8,.2,1)}
.medal-panel .bar-lbl b{color:var(--gold-2);font-family:var(--ff-display);letter-spacing:.02em}

/* Ученики */
.tp-student{position:relative;display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap;align-items:center;
  background:var(--panel);border:1px solid var(--glass-brd);border-radius:var(--radius);padding:16px 20px 16px 24px;
  box-shadow:var(--shadow-card);backdrop-filter:blur(12px);margin-bottom:12px;transition:transform .2s,box-shadow .2s;overflow:hidden}
.tp-student::before{content:"";position:absolute;left:0;top:0;bottom:0;width:4px;
  background:linear-gradient(180deg,var(--gold),transparent);opacity:.75}
@media(hover:hover){.tp-student:hover{transform:translateY(-2px);box-shadow:var(--shadow-glow);border-color:var(--gold-2)}}
.tp-student b{font-family:var(--ff-display);letter-spacing:.02em;color:var(--text);font-size:1.04rem}
.tp-student .who{display:flex;align-items:center;gap:14px;min-width:0}
.tp-student .mono{flex:0 0 auto;width:46px;height:46px;border-radius:50%;background:var(--gold-soft);
  border:1px solid var(--glass-brd);display:flex;align-items:center;justify-content:center;
  font-family:var(--ff-display);font-weight:800;color:var(--gold-2);font-size:1.15rem}
.tp-student .side{display:flex;align-items:center;gap:12px;flex-wrap:wrap;justify-content:flex-end}

.tp-chips{display:flex;flex-wrap:wrap;gap:9px;margin-top:6px}
.tp-chip{display:inline-flex;align-items:center;gap:6px;padding:9px 16px;border-radius:999px;background:var(--panel);
  border:1px solid var(--glass-brd);color:var(--text);font-size:.88rem;font-weight:600;box-shadow:var(--shadow-card);
  backdrop-filter:blur(10px);transition:border-color .2s,color .2s,transform .2s}
@media(hover:hover){.tp-chip:hover{border-color:var(--gold);color:var(--gold-2);transform:translateY(-2px)}}

.tp-rv{position:relative;background:var(--panel);border:1px solid var(--glass-brd);border-radius:var(--radius);padding:22px 24px 22px;
  box-shadow:var(--shadow-card);backdrop-filter:blur(12px);margin-bottom:14px;overflow:hidden}
.tp-rv::before{content:"\201C";position:absolute;top:-6px;right:16px;font-family:var(--ff-display);
  font-size:5rem;line-height:1;color:var(--gold);opacity:.14;pointer-events:none}
.tp-rv .stars{color:var(--gold);letter-spacing:2px}
@media(prefers-reduced-motion:reduce){.tp-ava::before{animation:none}}
</style>

<section class="section">
  <div class="container tp">
    <?php if ($teacher): ?>
      <!-- Шапка профиля -->
      <div class="tp-head reveal">
        <div class="tp-ava" aria-hidden="true"><?= h(mb_strtoupper(mb_substr($teacher['name'], 0, 1))) ?></div>
        <div class="tp-id">
          <p class="eyebrow">Профиль педагога</p>
          <h1><?= h($teacher['name']) ?></h1>
          <p class="role">Наставник участников конкурсов Культурного центра «Музыкальный Мир»</p>
          <div class="tp-badges">
            <?php if ($wins['Гран-при'] > 0): ?><span class="badge badge--judging">Подготовил обладателей Гран-при</span><?php endif; ?>
            <?php if ($hasIntl): ?><span class="badge badge--intl">Международный уровень</span><?php endif; ?>
            <span class="badge badge--open">Действующий наставник</span>
          </div>
          <?php $shareUrl = rtrim(cfgv('base_url'), '/') . '/pedagog/' . $teacher['slug']; ?>
          <div class="tp-actions">
            <button class="btn btn--ghost" type="button" data-share
                    data-share-title="<?= h($teacher['name']) ?> - Культурный центр «Музыкальный Мир»"
                    data-share-url="<?= h($shareUrl) ?>">Поделиться</button>
          </div>
        </div>
      </div>

      <!-- Быстрые показатели -->
      <div class="grid grid-4 tp-stats reveal">
        <div class="stat"><b data-count="<?= count($students) ?>">0</b><span>Учеников</span></div>
        <div class="stat"><b data-count="<?= count($items) ?>">0</b><span>Наградных документов</span></div>
        <div class="stat"><b data-count="<?= $laureateTotal ?>">0</b><span>Лауреатских званий</span></div>
        <div class="stat"><b data-count="<?= count($competitions) ?>">0</b><span>Конкурсов</span></div>
      </div>

      <!-- Достижения инфографикой -->
      <div class="section-head reveal" style="margin-bottom:14px;margin-top:44px"><p class="eyebrow">Результаты учеников</p><h2>Структура наград</h2><div class="gold-rule"></div></div>
      <div class="card reveal medal-panel">
        <?php foreach ($wins as $label => $cnt): if ($cnt === 0) continue; $pct = round($cnt / $total * 100); ?>
          <div class="bar-row">
            <div class="bar-lbl"><span><?= h($label) ?></span><b><?= (int) $cnt ?></b></div>
            <div class="bar" data-value="<?= $pct ?>"><i class="bar-fill"></i></div>
          </div>
        <?php endforeach; ?>
      </div>

      <!-- Ученики -->
      <div class="section-head reveal" style="margin-bottom:18px;margin-top:44px"><p class="eyebrow">Достижения</p><h2>Ученики и победы</h2><div class="gold-rule"></div></div>
      <?php foreach ($students as $s): $asl = $artistSlugFor($s['name']); ?>
        <div class="tp-student reveal">
          <div class="who">
            <div class="mono" aria-hidden="true"><?= h(mb_strtoupper(mb_substr($s['name'], 0, 1))) ?></div>
            <div>
              <b><?= h($s['name']) ?></b>
              <p style="color:var(--muted);margin:3px 0 0;font-size:.9rem"><?= h($s['city'] ?: '') ?></p>
            </div>
          </div>
          <div class="side">
            <span class="badge badge--open"><?= (int) $s['count'] ?> <?= $s['count'] == 1 ? 'диплом' : 'диплома(-ов)' ?></span>
            <a class="btn btn--ghost" href="<?= url('/artist/' . $asl) ?>">Портфолио ученика</a>
          </div>
        </div>
      <?php endforeach; ?>

      <?php if ($competitions): ?>
        <div class="section-head reveal" style="margin-bottom:14px;margin-top:44px"><p class="eyebrow">География</p><h2>Конкурсы</h2></div>
        <div class="tp-chips reveal">
          <?php foreach ($competitions as $c): ?>
            <a class="tp-chip" href="<?= url('/competition/' . $c['slug']) ?>"><?= h($c['name']) ?></a>
          <?php endforeach; ?>
        </div>
      <?php endif; ?>

      <?php if ($reviews): ?>
        <div class="section-head reveal" style="margin-bottom:18px;margin-top:44px"><p class="eyebrow">Отклики</p><h2>Отзывы об учениках</h2><div class="gold-rule"></div></div>
        <?php foreach ($reviews as $r): ?>
          <div class="tp-rv reveal">
            <div class="stars"><?= str_repeat('&#9733;', max(1, min(5, (int) $r['rating']))) ?><?= str_repeat('&#9734;', 5 - max(1, min(5, (int) $r['rating']))) ?></div>
            <p style="font-family:var(--ff-serif);font-weight:700;color:var(--text);font-size:1.05rem;margin-top:8px">«<?= h($r['text']) ?>»</p>
            <p style="color:var(--gold-2);font-weight:700;margin:0"><?= h($r['author'] ?: 'Участник конкурса') ?></p>
          </div>
        <?php endforeach; ?>
      <?php endif; ?>

    <?php else:
      http_response_code(404); ?>
      <div class="reveal" style="text-align:center;background:var(--panel);backdrop-filter:blur(12px);border:1px solid var(--glass-brd);border-radius:var(--radius);padding:52px 28px;box-shadow:var(--shadow-card)">
        <svg aria-hidden="true" viewBox="0 0 24 24" width="52" height="52" fill="none" stroke="var(--gold)" stroke-width="1.4" style="margin:0 auto 14px"><circle cx="9" cy="8" r="4"/><path d="M2 21v-1a6 6 0 0 1 6-6h2M16 11l2 2 4-4"/></svg>
        <h1 style="font-size:clamp(1.6rem,4vw,2.4rem)">Профиль пока не опубликован</h1>
        <p style="color:var(--muted);max-width:460px;margin:0 auto 22px">Публичный профиль педагога появляется, когда его ученики получают наградные документы по итогам конкурсов. Проверьте ссылку или посмотрите действующие конкурсы.</p>
        <a class="btn btn--primary" href="<?= url('/competitions') ?>">Действующие конкурсы</a>
      </div>
    <?php endif; ?>
  </div>
</section>
<?php
$content = ob_get_clean();
$ttl = $teacher ? $teacher['name'] : 'Профиль педагога';
$metaDesc = $teacher
    ? 'Педагог ' . $teacher['name'] . ': ' . count($students) . ' учеников, ' . count($items) . ' наградных документов на конкурсах Культурного центра «Музыкальный Мир».'
    : 'Публичный профиль педагога - участника конкурсов Культурного центра «Музыкальный Мир».';

// JSON-LD Person — персональная страница педагога для поисковой выдачи.
$opts = ['active' => '', 'meta' => $metaDesc];
if ($teacher) {
    $personLd = [
        '@context' => 'https://schema.org',
        '@type'    => 'Person',
        'name'     => $teacher['name'],
        'jobTitle' => 'Педагог',
        'url'      => rtrim(cfgv('base_url'), '/') . '/pedagog/' . $teacher['slug'],
        'worksFor' => ['@type' => 'Organization', 'name' => cfgv('org_name')],
        'knowsAbout' => 'Музыкальное образование, подготовка к конкурсам и фестивалям',
    ];
    $opts['jsonld'] = $personLd;
}
render_page($ttl, $content, $opts);
