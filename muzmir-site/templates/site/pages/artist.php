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
if ($artist) {
    $artist['city'] = $items[0]['city'] ?? '';
    $artist['institution'] = $items[0]['institution'] ?? '';
    foreach ($items as $it) {
        if (!empty($it['comp_slug']) && !isset($competitions[$it['comp_slug']])) {
            $competitions[$it['comp_slug']] = ['name' => $it['comp_name'], 'slug' => $it['comp_slug'], 'type' => $it['comp_type']];
        }
        $tname = trim((string) $it['teacher']);
        if ($tname !== '' && !isset($teachers[$tname])) {
            $teachers[$tname] = $slugify($tname) . '-' . $teacherCanonicalId($tname);
        }
        if (!empty($it['video_url']) && !isset($videos[$it['video_url']])) {
            $videos[$it['video_url']] = $it['video_platform'] ?: 'Видео';
        }
        $res = (string) ($it['d_result'] ?: $it['a_result']);
        if (mb_stripos($res, 'ГРАН-ПРИ') !== false) $grandPrixCount++;
    }
}

ob_start(); ?>
<style>
.art-card{max-width:960px;margin:0 auto}
.art-hero{text-align:center;max-width:640px;margin:0 auto 40px}
.art-ava{width:104px;height:104px;border-radius:50%;background:var(--grad-gold);color:#1a1206;
  display:flex;align-items:center;justify-content:center;font-family:var(--ff-display);letter-spacing:.02em;font-size:2.4rem;margin:0 auto 16px;box-shadow:var(--shadow-glow)}
.art-quickstats{display:flex;justify-content:center;gap:28px;flex-wrap:wrap;margin-top:18px}
.art-quickstats div{text-align:center}
.art-quickstats b{display:block;font-family:var(--ff-display);letter-spacing:.02em;font-size:1.7rem;color:var(--gold-2)}
.art-quickstats span{color:var(--muted);font-size:.84rem}

.honeycomb{display:flex;flex-wrap:wrap;justify-content:center;margin:0 auto 8px;max-width:900px}
.hex{width:206px;margin:10px 8px 38px;position:relative}
.hex:nth-child(even){margin-top:46px}
.hex-inner{clip-path:polygon(25% 3%,75% 3%,100% 50%,75% 97%,25% 97%,0% 50%);
  background:linear-gradient(160deg,var(--panel-solid),var(--gold-soft));border:1px solid var(--glass-brd);
  padding:34px 22px;aspect-ratio:.92;display:flex;flex-direction:column;justify-content:center;gap:6px;
  text-align:center;box-shadow:var(--shadow-card);transition:transform .25s,box-shadow .25s;color:inherit}
.hex-inner:hover{transform:scale(1.06);box-shadow:var(--shadow-glow)}
.hex-result{font-family:var(--ff-display);letter-spacing:.02em;color:var(--gold-2);font-size:1.05rem;line-height:1.15}
.hex-comp{font-size:.82rem;color:var(--text);font-weight:600}
.hex-date{font-size:.74rem;color:var(--muted)}
@media (max-width:720px){
  .honeycomb{flex-direction:column;align-items:center}
  .hex{width:100%;max-width:320px;margin:8px 0}
  .hex:nth-child(even){margin-top:8px}
  .hex-inner{clip-path:none;border-radius:var(--radius);aspect-ratio:auto;padding:20px 22px}
}

.dip-item{display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap;align-items:flex-start;
  background:var(--panel);border:1px solid var(--glass-brd);border-radius:var(--radius);padding:18px 22px;box-shadow:var(--shadow-card);backdrop-filter:blur(12px);margin-bottom:14px}
.dip-item .actions{display:flex;gap:10px;flex-wrap:wrap}
.art-chips{display:flex;flex-wrap:wrap;gap:9px;margin-top:6px}
.art-chip{display:inline-flex;align-items:center;gap:6px;padding:9px 16px;border-radius:999px;background:var(--panel);
  border:1px solid var(--glass-brd);color:var(--text);font-size:.88rem;font-weight:600;box-shadow:var(--shadow-card);backdrop-filter:blur(10px)}
.art-chip:hover{border-color:var(--gold);color:var(--gold-2)}
</style>

<section class="section">
  <div class="container art-card">
    <?php if ($artist): ?>
      <div class="art-hero reveal">
        <div class="art-ava"><?= h(mb_strtoupper(mb_substr($artist['name'], 0, 1))) ?></div>
        <p class="eyebrow">Портфолио участника</p>
        <h1 style="margin:.1em 0"><?= h($artist['name']) ?></h1>
        <p style="color:var(--muted)">
          <?= h($artist['city'] ?: '') ?><?php if ($artist['city'] && $artist['institution']): ?> · <?php endif; ?><?= h($artist['institution'] ?: '') ?>
        </p>
        <div class="art-quickstats">
          <div><b><?= count($items) ?></b><span>Дипломов</span></div>
          <div><b><?= $grandPrixCount ?></b><span>Гран-при</span></div>
          <div><b><?= count($competitions) ?></b><span>Конкурсов</span></div>
        </div>
      </div>

      <div class="section-head reveal" style="margin-bottom:12px"><p class="eyebrow">Сота достижений</p><h2>Награды и результаты</h2><div class="gold-rule"></div></div>
      <div class="honeycomb reveal">
        <?php foreach ($items as $it): ?>
          <div class="hex">
            <a class="hex-inner" href="<?= url('/verify/' . $it['number']) ?>">
              <span class="hex-result"><?= h($it['d_result'] ?: $it['a_result'] ?: 'Диплом') ?></span>
              <span class="hex-comp"><?= h($it['comp_name'] ?: 'Конкурс') ?></span>
              <span class="hex-date"><?= h(ru_date(substr((string) $it['d_created'], 0, 10))) ?></span>
            </a>
          </div>
        <?php endforeach; ?>
      </div>

      <div class="section-head reveal" style="margin-bottom:24px;margin-top:36px"><p class="eyebrow">Подробно</p><h2>Дипломы и результаты</h2><div class="gold-rule"></div></div>
      <?php foreach ($items as $it): ?>
        <div class="dip-item reveal">
          <div>
            <strong style="font-family:var(--ff-display);letter-spacing:.02em;font-size:1.15rem;color:var(--gold-2)"><?= h($it['d_result'] ?: $it['a_result'] ?: 'Диплом') ?></strong>
            <p style="color:var(--muted);margin:4px 0 0;font-size:.92rem">
              <?= h($it['comp_name'] ?: 'Конкурс') ?>
              <?php if ($it['nomination']): ?> · <?= h($it['nomination']) ?><?php endif; ?>
              <?php if ($it['formation']): ?> · <?= h($it['formation']) ?><?php endif; ?>
              <?php if ($it['work_title']): ?> · «<?= h($it['work_title']) ?>»<?php endif; ?>
            </p>
            <p style="color:var(--muted);margin:2px 0 0;font-size:.85rem">
              <?= h(ru_date(substr((string) $it['d_created'], 0, 10))) ?>
              <?php if ($it['teacher']): ?> · педагог <?= h($it['teacher']) ?><?php endif; ?>
            </p>
          </div>
          <div class="actions">
            <?php if (!empty($it['video_url'])): ?>
              <a class="btn btn--ghost" href="<?= h($it['video_url']) ?>" target="_blank" rel="noopener"><?= h($it['video_platform'] ?: 'Видео') ?></a>
            <?php endif; ?>
            <a class="btn btn--ghost" href="<?= url('/verify/' . $it['number']) ?>">Проверить</a>
          </div>
        </div>
      <?php endforeach; ?>

      <?php if ($competitions): ?>
        <div class="section-head reveal" style="margin-bottom:14px;margin-top:36px"><p class="eyebrow">География побед</p><h2>Конкурсы</h2></div>
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
        <svg viewBox="0 0 24 24" width="52" height="52" fill="none" stroke="var(--gold)" stroke-width="1.4" style="margin:0 auto 14px"><circle cx="12" cy="8" r="4"/><path d="M4 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1"/></svg>
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
render_page($ttl, $content, ['active' => '', 'meta' => $metaDesc]);
