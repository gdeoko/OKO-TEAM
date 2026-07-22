<?php
/**
 * Аллея Славы (slug hall-of-fame). Премиум-витрина лауреатов и достижений центра.
 * Данные лауреатов тянутся из diplomas/applications, если они есть; иначе -
 * достойная витрина концепции (Кремль, «Артек», международная география, звания).
 * Концепт «Звезда навсегда» - имя лауреата остаётся на Аллее Славы навсегда.
 */

/* --- Реальные лауреаты из базы (мягко, без падения на пустой/иной схеме) --- */
$laureates = [];
try {
    $laureates = all(
        "SELECT a.full_name, a.group_name, a.is_group, a.work_title, a.nomination, a.city,
                COALESCE(NULLIF(d.result,''), a.result) AS res,
                c.name AS comp_name, c.type AS comp_type, c.slug AS comp_slug
           FROM diplomas d
           JOIN applications a ON a.id = d.application_id
      LEFT JOIN competitions c ON c.id = a.competition_id
          WHERE COALESCE(NULLIF(d.result,''), a.result) <> ''
       ORDER BY d.created_at DESC
          LIMIT 24"
    );
} catch (\Throwable $e) { $laureates = []; }
if (!$laureates) {
    try {
        $laureates = all(
            "SELECT a.full_name, a.group_name, a.is_group, a.work_title, a.nomination, a.city,
                    a.result AS res, c.name AS comp_name, c.type AS comp_type, c.slug AS comp_slug
               FROM applications a
          LEFT JOIN competitions c ON c.id = a.competition_id
              WHERE COALESCE(a.result,'') <> ''
           ORDER BY a.created_at DESC
              LIMIT 24"
        );
    } catch (\Throwable $e) { $laureates = []; }
}

$lauTotal = 0;
try { $lauTotal = (int) scalar("SELECT COUNT(*) FROM diplomas"); } catch (\Throwable $e) {}
if (!$lauTotal) { try { $lauTotal = (int) scalar("SELECT COUNT(*) FROM applications WHERE COALESCE(result,'')<>''"); } catch (\Throwable $e) {} }

/* Класс значка по степени награды. */
$badgeOf = static function (string $res): string {
    $r = mb_strtolower($res, 'UTF-8');
    if (mb_strpos($r, 'гран', 0, 'UTF-8') !== false) return 'badge--intl';
    if (mb_strpos($r, 'лауреат', 0, 'UTF-8') !== false) return 'badge--open';
    if (mb_strpos($r, 'диплом', 0, 'UTF-8') !== false) return 'badge--judging';
    return 'badge--intl';
};

/* --- Статистика центра (инфографика). --- */
$stats = [
    ['30621', '+', 'заявок на участие'],
    ['95', '+', 'конкурсов и мероприятий'],
    ['5', '', 'лет открываем таланты'],
    ['10', '', 'стран - лауреаты по миру'],
];

/* --- Достижения-витрина (KPI). --- */
$achievements = [
    ['crown', 'Сцена Кремля', 'Победители конкурсов центра выходили на сцену Государственного Кремлёвского дворца - высшая точка признания для юного артиста.'],
    ['star', 'Путёвки в «Артек»', 'Талантливые участники получали путёвки в Международный детский центр «Артек» - награду, которую нельзя купить.'],
    ['globe', 'Международная география', 'Лауреаты из Беларуси, Армении, Казахстана, Китая, Египта и Италии - искусство центра звучит без границ.'],
    ['heart', 'Признание в военное время', 'Победители из ДНР и ЛНР, благотворительные концерты в поддержку участников СВО совместно с фондом «ОБЕРЕГ».'],
];

/* --- Степени наград (звания). --- */
$tiers = [
    ['Гран-при', 'Высшая награда конкурса - кубок и диплом обладателя Гран-при. Одна вершина на весь конкурс.'],
    ['Лауреат I, II, III степени', 'Статуэтка лауреата и диплом - признание мастерства исполнения на уровне лучших.'],
    ['Дипломант', 'Диплом за яркое выступление и высокий творческий уровень конкурсной работы.'],
    ['Благодарность', 'Благодарность педагогу и участнику - за вклад, старание и любовь к искусству.'],
];

/* --- Самые массовые конкурсы (по базе заявок, реальные цифры). --- */
$topComp = [
    ['День Победы', 1470],
    ['Звёзды Великой Страны', 1076],
    ['Сила России', 1019],
    ['Талант года', 702],
    ['Дар искусства', 653],
    ['Овация', 616],
];
$topMax = 1470;

/* --- Международная география лауреатов. --- */
$geo = ['Россия - 85 регионов', 'Беларусь', 'Украина (ДНР/ЛНР)', 'Армения', 'Казахстан',
        'Узбекистан', 'Азербайджан', 'Китай', 'Египет', 'Италия'];

/* --- Как попасть на Аллею Славы («Звезда навсегда»). --- */
$steps = [
    ['Подайте заявку', 'Запишите видео номера и подайте бесплатную заявку на любой из конкурсов центра - без ограничений по возрасту и числу номинаций.'],
    ['Победите', 'Компетентное жюри оценит работу и присвоит звание - от Дипломанта до обладателя Гран-при. Результат придёт Вам на почту.'],
    ['Останьтесь в истории', 'Имя лауреата навсегда остаётся на Аллее Славы центра - Ваша звезда, которую увидят участники, педагоги и родители по всей стране.'],
];

/* --- SVG-иконки (без эмодзи). --- */
$svg = [
    'star'  => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l3 7h7l-5.5 4 2 7L12 16l-6.5 4 2-7L2 9h7z"/></svg>',
    'crown' => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7l4 4 5-6 5 6 4-4-1.5 12h-15z"/><path d="M4.5 20h15"/></svg>',
    'globe' => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.7 2.5 15.3 0 18M12 3c-2.5 2.7-2.5 15.3 0 18"/></svg>',
    'heart' => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20s-7-4.5-9.5-9C1 8 2.5 4.5 6 4.5c2 0 3.2 1.2 4 2.3.8-1.1 2-2.3 4-2.3 3.5 0 5 3.5 3.5 6.5C19 15.5 12 20 12 20z"/></svg>',
    'trophy'=> '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M7 4h10v4a5 5 0 0 1-10 0z"/><path d="M7 6H4v1a3 3 0 0 0 3 3M17 6h3v1a3 3 0 0 1-3 3"/><path d="M12 13v4M9 21h6M10 17h4"/></svg>',
    'pin'   => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s7-6.5 7-11a7 7 0 1 0-14 0c0 4.5 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/></svg>',
    'check' => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>',
    'music' => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l10-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="16" cy="16" r="3"/></svg>',
];

ob_start(); ?>
<style>
/* ── Аллея Славы (scoped) ── */
.hof-hero{position:relative;text-align:center;max-width:760px;margin:0 auto}
.hof-hero .eyebrow{justify-content:center}
.hof-hero h1{font-family:var(--ff-display);font-size:clamp(2.1rem,7vw,3.4rem);line-height:1.05;margin:6px 0 0;
  background:var(--grad-gold);-webkit-background-clip:text;background-clip:text;color:transparent}
.hof-hero p{color:var(--text-dim);font-size:1.08rem;margin:18px auto 0;max-width:600px}
.hof-star{width:76px;height:76px;margin:0 auto 4px;border-radius:50%;display:flex;align-items:center;justify-content:center;
  background:var(--gold-soft);border:1px solid var(--glass-brd);color:var(--gold-ink)}
[data-theme="dark"] .hof-star{color:var(--gold)}
.hof-star svg{width:38px;height:38px}

/* Карточка лауреата */
.lau-card{display:flex;flex-direction:column;gap:12px;overflow:hidden}
.lau-top{display:flex;align-items:center;gap:12px}
.lau-ava{width:48px;height:48px;flex:none;border-radius:50%;display:flex;align-items:center;justify-content:center;
  background:var(--grad-gold);color:#1a1206;box-shadow:var(--shadow-btn)}
.lau-ava svg{width:24px;height:24px}
.lau-name{font-family:var(--ff-serif);font-weight:700;font-size:1.14rem;color:var(--text);line-height:1.2;overflow-wrap:anywhere}
.lau-city{color:var(--muted);font-size:.82rem;margin-top:2px}
.lau-work{color:var(--text-dim);font-size:.95rem;margin:0;overflow-wrap:anywhere}
.lau-work b{color:var(--gold-2);font-weight:700}
.lau-comp{margin-top:auto;color:var(--muted);font-size:.85rem;overflow-wrap:anywhere}

/* KPI-достижения */
.kpi{display:flex;gap:16px;align-items:flex-start}
.kpi .kpi-ic{width:52px;height:52px;flex:none;border-radius:16px;display:flex;align-items:center;justify-content:center;
  background:var(--gold-soft);border:1px solid var(--glass-brd);color:var(--gold)}
.kpi .kpi-ic svg{width:26px;height:26px}
.kpi h3{margin:2px 0 6px;color:var(--text)}
.kpi p{margin:0;color:var(--text-dim);font-size:.95rem}

/* Степени наград */
.tier-row{display:flex;gap:14px;align-items:flex-start;padding:16px 0;border-bottom:1px solid var(--line)}
.tier-row:last-child{border-bottom:0}
.tier-ic{width:44px;height:44px;flex:none;border-radius:12px;display:flex;align-items:center;justify-content:center;
  background:var(--gold-soft);border:1px solid var(--glass-brd);color:var(--gold)}
.tier-ic svg{width:22px;height:22px}
.tier-row h3{margin:0 0 4px;color:var(--text);font-size:1.05rem}
.tier-row p{margin:0;color:var(--text-dim);font-size:.94rem}

/* Лидерборд конкурсов */
.bars{display:grid;gap:16px}
.bar-row{display:grid;gap:7px}
.bar-top{display:flex;justify-content:space-between;align-items:baseline;gap:10px;color:var(--text)}
.bar-top span{font-weight:600;font-size:.95rem;overflow-wrap:anywhere}
.bar-top b{font-family:var(--ff-display);font-size:1.15rem;color:var(--gold)}
.bar{position:relative;height:10px;border-radius:999px;background:var(--glass-brd);overflow:hidden}
.bar-fill{display:block;height:100%;width:100%;border-radius:999px;background:var(--grad-gold);
  transform:scaleX(0);transform-origin:left center;transition:transform 1.2s cubic-bezier(.2,.8,.2,1)}

/* География - чипы */
.geo-chips{display:flex;flex-wrap:wrap;gap:10px}
.geo-chip{display:inline-flex;align-items:center;gap:8px;padding:9px 16px;min-height:40px;border-radius:999px;
  background:var(--panel);border:1.5px solid var(--glass-brd);color:var(--text-dim);font-weight:600;font-size:.9rem}
.geo-chip svg{width:16px;height:16px;color:var(--gold);flex:none}

/* Звезда навсегда - шаги */
.star-steps{display:grid;gap:18px}
.star-step{display:flex;gap:16px;align-items:flex-start}
.star-num{width:46px;height:46px;flex:none;border-radius:14px;display:flex;align-items:center;justify-content:center;
  font-family:var(--ff-display);font-size:1.35rem;background:var(--grad-gold);color:#1a1206;box-shadow:var(--shadow-btn)}
.star-step h3{margin:4px 0 6px;color:var(--text)}
.star-step p{margin:0;color:var(--text-dim);font-size:.96rem}

.hof-cta{text-align:center;max-width:620px;margin:0 auto}
.hof-cta .btn{margin:6px}

@media (max-width:560px){
  .hof-hero p{font-size:1rem}
}
</style>

<!-- Интро: «Звезда навсегда» -->
<section class="section">
  <div class="container">
    <div class="hof-hero reveal">
      <div class="hof-star"><?= $svg['star'] ?></div>
      <p class="eyebrow">Звезда навсегда</p>
      <h1>Аллея Славы</h1>
      <p>Здесь остаются имена тех, кто поднялся на вершину. Каждый лауреат конкурсов Культурного центра «Музыкальный Мир» - это звезда, которая светит и после того, как отзвучал последний аккорд. Ваше имя на Аллее Славы - навсегда.</p>
    </div>
  </div>
</section>

<!-- Статистика центра -->
<section class="section section--tint">
  <div class="container">
    <div class="section-head reveal">
      <p class="eyebrow">Масштаб признания</p>
      <h2>Пять лет ярких имён</h2>
      <div class="gold-rule"></div>
    </div>
    <div class="stats reveal">
      <?php foreach ($stats as [$val, $suf, $label]): ?>
        <div class="stat"><b data-count="<?= h($val) ?>" data-suffix="<?= h($suf) ?>">0</b><span><?= h($label) ?></span></div>
      <?php endforeach; ?>
    </div>
  </div>
</section>

<?php if ($laureates): ?>
<!-- Реальные лауреаты (каскад) -->
<section class="section">
  <div class="container">
    <div class="section-head reveal">
      <p class="eyebrow">Наши лауреаты</p>
      <h2>Имена на Аллее Славы</h2>
      <div class="gold-rule"></div>
      <?php if ($lauTotal > count($laureates)): ?>
        <p>Показаны последние лауреаты. Всего в летописи центра - более <?= h(number_format($lauTotal, 0, ',', ' ')) ?> награждённых работ.</p>
      <?php endif; ?>
    </div>
    <div class="grid grid-3">
      <?php foreach ($laureates as $i => $l):
          $name = $l['is_group'] && !empty($l['group_name']) ? $l['group_name'] : $l['full_name'];
          $res = (string) ($l['res'] ?? ''); ?>
        <div class="card card--3d lau-card reveal" style="--i:<?= (int) $i ?>">
          <div class="lau-top">
            <div class="lau-ava"><?= $svg[$l['is_group'] ? 'music' : 'star'] ?></div>
            <div>
              <div class="lau-name"><?= h($name ?: 'Участник конкурса') ?></div>
              <?php if (!empty($l['city'])): ?><div class="lau-city"><?= h($l['city']) ?></div><?php endif; ?>
            </div>
          </div>
          <?php if ($res !== ''): ?><span class="badge <?= $badgeOf($res) ?>"><?= h($res) ?></span><?php endif; ?>
          <?php if (!empty($l['work_title']) || !empty($l['nomination'])): ?>
            <p class="lau-work">
              <?php if (!empty($l['nomination'])): ?><b><?= h($l['nomination']) ?></b><?php endif; ?>
              <?php if (!empty($l['work_title'])): ?><?= !empty($l['nomination']) ? ' - ' : '' ?>«<?= h($l['work_title']) ?>»<?php endif; ?>
            </p>
          <?php endif; ?>
          <?php if (!empty($l['comp_name'])): ?>
            <div class="lau-comp"><?= h($l['comp_type'] === 'international' ? 'Международный конкурс' : 'Всероссийский конкурс') ?> «<?= h($l['comp_name']) ?>»</div>
          <?php endif; ?>
        </div>
      <?php endforeach; ?>
    </div>
  </div>
</section>
<?php endif; ?>

<!-- Достижения-витрина -->
<section class="section<?= $laureates ? ' section--tint' : '' ?>">
  <div class="container">
    <div class="section-head reveal">
      <p class="eyebrow">Высшее признание</p>
      <h2>Куда приводят победы</h2>
      <div class="gold-rule"></div>
      <p>За наградами наших лауреатов - реальные события и большие сцены.</p>
    </div>
    <div class="grid grid-2">
      <?php foreach ($achievements as [$ic, $title, $descr]): ?>
        <div class="card kpi reveal">
          <div class="kpi-ic"><?= $svg[$ic] ?></div>
          <div>
            <h3><?= h($title) ?></h3>
            <p><?= h($descr) ?></p>
          </div>
        </div>
      <?php endforeach; ?>
    </div>
  </div>
</section>

<!-- Степени наград + лидерборд -->
<section class="section<?= $laureates ? '' : ' section--tint' ?>">
  <div class="container">
    <div class="grid grid-2" style="align-items:start;gap:40px">
      <div class="card reveal">
        <p class="eyebrow" style="margin-bottom:8px">Звания</p>
        <h3 style="margin-bottom:6px">Степени наград центра</h3>
        <div>
          <?php foreach ($tiers as $ti => [$name, $descr]): ?>
            <div class="tier-row">
              <div class="tier-ic"><?= $svg[$ti === 0 ? 'trophy' : 'star'] ?></div>
              <div>
                <h3><?= h($name) ?></h3>
                <p><?= h($descr) ?></p>
              </div>
            </div>
          <?php endforeach; ?>
        </div>
      </div>
      <div class="card reveal">
        <p class="eyebrow" style="margin-bottom:8px">Самые массовые</p>
        <h3 style="margin-bottom:20px">Конкурсы-рекордсмены</h3>
        <div class="bars">
          <?php foreach ($topComp as [$name, $cnt]):
              $pct = (int) round($cnt / $topMax * 100); ?>
            <div class="bar-row">
              <div class="bar-top"><span><?= h($name) ?></span><b><?= h(number_format($cnt, 0, ',', ' ')) ?></b></div>
              <div class="bar" data-value="<?= $pct ?>"><span class="bar-fill"></span></div>
            </div>
          <?php endforeach; ?>
        </div>
        <p style="color:var(--muted);font-size:.85rem;margin:18px 0 0">Число заявок участников. Каждая заявка - чья-то мечта выйти на сцену.</p>
      </div>
    </div>
  </div>
</section>

<!-- Международная география -->
<section class="section section--parchment">
  <div class="container">
    <div class="section-head reveal">
      <p class="eyebrow">Искусство без границ</p>
      <h2>География лауреатов</h2>
      <div class="gold-rule"></div>
      <p>Звёзды Аллеи Славы зажигаются не только в России - лауреаты представляют десять стран мира.</p>
    </div>
    <div class="geo-chips reveal">
      <?php foreach ($geo as $g): ?>
        <span class="geo-chip"><?= $svg['pin'] ?><?= h($g) ?></span>
      <?php endforeach; ?>
    </div>
  </div>
</section>

<!-- Как попасть: «Звезда навсегда» -->
<section class="section">
  <div class="container">
    <div class="section-head reveal">
      <p class="eyebrow">Ваш путь</p>
      <h2>Как зажечь свою звезду</h2>
      <div class="gold-rule"></div>
      <p>Три шага - и Ваше имя навсегда остаётся на Аллее Славы центра.</p>
    </div>
    <div class="star-steps reveal" style="max-width:760px;margin:0 auto">
      <?php foreach ($steps as $si => [$title, $descr]): ?>
        <div class="star-step card">
          <div class="star-num"><?= $si + 1 ?></div>
          <div>
            <h3><?= h($title) ?></h3>
            <p><?= h($descr) ?></p>
          </div>
        </div>
      <?php endforeach; ?>
    </div>
  </div>
</section>

<!-- CTA -->
<section class="section section--tint">
  <div class="container">
    <div class="hof-cta reveal">
      <h2>Ваше имя может стать следующим</h2>
      <p style="color:var(--text-dim);margin:14px auto 22px">Участие в конкурсах центра бесплатное, без ограничений по возрасту и числу номинаций. Подайте заявку - и начните путь на Аллею Славы.</p>
      <a class="btn btn--primary btn--lg" href="<?= url('/apply') ?>">Подать заявку</a>
      <a class="btn btn--ghost btn--lg" href="<?= url('/competitions') ?>">Все конкурсы</a>
    </div>
  </div>
</section>
<?php
$content = ob_get_clean();
render_page('Аллея Славы', $content, [
    'active' => '/hall-of-fame',
    'meta' => 'Аллея Славы Культурного центра «Музыкальный Мир»: лауреаты и достижения участников - сцена Кремля, путёвки в «Артек», международная география, степени наград. Ваше имя - навсегда.',
]);
