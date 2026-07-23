<?php
/**
 * Блог / Новости (slug blog). Премиум-лента статей и новостей центра.
 * Рубрики - из контент-плана. Статьи тянутся из таблицы pages (slug blog-, news-, post-);
 * если статей нет - достойная заглушка «скоро» + живая лента из существующих таблиц
 * (открытые конкурсы и онлайн-концерты). Новых таблиц не создаётся.
 */

/* ===================================================================
 * Режим одной статьи: /blog/{slug} - $slug задан роутером.
 * Отдельного шаблона нет по замыслу: рендерим тут же из таблицы pages.
 * =================================================================== */
$slug = trim((string) ($slug ?? ''));
if ($slug !== '') {
    $post = null;
    try { $post = one("SELECT * FROM pages WHERE slug=?", [$slug]); } catch (\Throwable $e) { $post = null; }
    $isBlogSlug = $post && preg_match('/^(blog|news|post|article)-/', (string) $post['slug']);
    if (!$post || !$isBlogSlug) {
        http_response_code(404);
        ob_start(); ?>
        <section class="section">
          <div class="container" style="text-align:center;max-width:600px">
            <p class="eyebrow">Ошибка 404</p>
            <h1>Статья не найдена</h1>
            <p style="color:var(--muted)">Возможно, ссылка устарела. Откройте <a href="<?= url('/blog') ?>">все статьи и новости</a>.</p>
            <div style="margin-top:24px"><a class="btn btn--primary" href="<?= url('/blog') ?>">В блог</a></div>
          </div>
        </section>
        <?php
        $content = ob_get_clean();
        render_page('Статья не найдена', $content, ['active' => '/blog', 'meta' => 'Статья не найдена.']);
        return;
    }
    $rubric = '';
    if (!empty($post['meta_description']) && preg_match('/Рубрика:\s*([^.\n]+)/u', $post['meta_description'], $mm)) {
        $rubric = trim($mm[1]);
    }
    ob_start(); ?>
    <section class="section">
      <div class="container" style="max-width:760px">
        <div class="reveal" style="margin-bottom:22px">
          <a class="post-more" href="<?= url('/blog') ?>" style="display:inline-flex;align-items:center;gap:6px;color:var(--gold-2);font-weight:700">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" style="width:16px;height:16px;transform:rotate(180deg)"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
            Все статьи
          </a>
        </div>
        <?php if ($rubric !== ''): ?><span class="badge badge--intl reveal"><?= h($rubric) ?></span><?php endif; ?>
        <h1 class="reveal" style="font-family:var(--ff-display);margin:12px 0 6px;color:var(--text);overflow-wrap:anywhere"><?= h($post['title']) ?></h1>
        <p class="reveal" style="color:var(--muted);font-size:.88rem;margin:0 0 8px">Обновлено <?= h(ru_date($post['updated_at'])) ?></p>
        <div class="gold-rule reveal" style="margin-left:0"></div>
        <div class="article-body reveal" style="color:var(--text-dim);font-size:1.06rem;line-height:1.7;overflow-wrap:anywhere">
          <?= $post['body'] ?>
        </div>
        <div class="reveal" style="margin-top:32px;display:flex;gap:12px;flex-wrap:wrap">
          <a class="btn btn--primary" href="<?= url('/competitions') ?>">К конкурсам</a>
          <a class="btn btn--ghost" href="<?= url('/blog') ?>">Ещё статьи</a>
        </div>
      </div>
    </section>
    <?php
    $content = ob_get_clean();
    render_page($post['title'] . ' - Блог', $content, [
        'active' => '/blog',
        'meta' => $post['meta_description'] ?: 'Статья блога Культурного центра «Музыкальный Мир».',
    ]);
    return;
}

/* --- Статьи блога из таблицы pages (мягко). --- */
$posts = [];
try {
    $posts = all(
        "SELECT slug, title, body, meta_description, updated_at
           FROM pages
          WHERE slug LIKE 'blog-%' OR slug LIKE 'news-%' OR slug LIKE 'post-%' OR slug LIKE 'article-%'
       ORDER BY updated_at DESC
          LIMIT 24"
    );
} catch (\Throwable $e) { $posts = []; }

/* --- Живая лента: открытые конкурсы (анонсы) и последние концерты (видео). --- */
$openComps = [];
try {
    $openComps = all("SELECT slug, name, type, end_date FROM competitions WHERE status='open' ORDER BY end_date ASC LIMIT 3");
} catch (\Throwable $e) { $openComps = []; }
$recentConcerts = [];
try {
    $recentConcerts = all("SELECT title, category, date FROM concerts ORDER BY sort DESC, date DESC LIMIT 3");
} catch (\Throwable $e) { $recentConcerts = []; }
$hasFeed = $openComps || $recentConcerts;

/* Краткий анонс из тела статьи. */
$excerpt = static function (?string $body, int $limit = 150): string {
    $t = trim(preg_replace('/\s+/u', ' ', strip_tags((string) $body)));
    if (mb_strlen($t, 'UTF-8') <= $limit) return $t;
    return rtrim(mb_substr($t, 0, $limit, 'UTF-8'), " ,.;:-") . '...';
};

/* Человекочитаемое имя рубрики по slug-хвосту (если задан в meta_description как «Рубрика: X»). */
$rubricOf = static function (array $p): string {
    if (!empty($p['meta_description']) && preg_match('/Рубрика:\s*([^.\n]+)/u', $p['meta_description'], $m)) {
        return trim($m[1]);
    }
    return 'Статья';
};

/* --- Рубрики контент-плана (витрина разделов блога). --- */
$rubrics = [
    ['note',   'История инструментов и жанров', 'Фортепиано, гитара, вокал, народная музыка, оркестр и опера - откуда они пришли и почему звучат именно так.'],
    ['compass','Гид по конкурсам', 'Как выбрать номинацию, подать заявку пошагово, записать видео и что оценивает жюри - от Гран-при до благодарности.'],
    ['mask',   'Номинации', 'Вокал, хореография, изобразительное и декоративно-прикладное искусство, театр, художественное слово, коллективные жанры.'],
    ['heart',  'Мотивация и психология', 'Страх сцены, роль педагога, поддержка родителей и то, как творчество развивает ребёнка.'],
    ['shield', 'Доверие и статус центра', 'Пять лет работы, 95 конкурсов, компетентное жюри, поддержка министерств культуры и международная география.'],
    ['star',   'Ценность диплома', 'Портфолио и поступление, Аллея Славы - имя навсегда, закрытый клуб и абонемент участника.'],
    ['crown',  'Композиторы и наследие', 'Бах, Гайдн, Рахманинов, Чайковский, Вагнер и Брамс - к памятным датам культурного календаря.'],
    ['flag',   'Патриотика', 'День Победы, «Россия - Родина Моя», песни Победы и бессмертный полк в искусстве.'],
    ['calendar','Итоги и анонсы', 'Итоги месяца и сезона, анонсы будущих конкурсов и гала-концерт лауреатов.'],
];

/* --- SVG-иконки (без эмодзи). --- */
$svg = [
    'note'    => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l10-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="16" cy="16" r="3"/></svg>',
    'compass' => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/></svg>',
    'mask'    => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16v7a8 8 0 0 1-16 0z"/><path d="M8.5 10h.01M15.5 10h.01M9 15c1.5 1.3 4.5 1.3 6 0"/></svg>',
    'heart'   => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20s-7-4.5-9.5-9C1 8 2.5 4.5 6 4.5c2 0 3.2 1.2 4 2.3.8-1.1 2-2.3 4-2.3 3.5 0 5 3.5 3.5 6.5C19 15.5 12 20 12 20z"/></svg>',
    'shield'  => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l8 3v6c0 5-3.5 8.5-8 11-4.5-2.5-8-6-8-11V5z"/><path d="M9 12l2 2 4-4"/></svg>',
    'star'    => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l3 7h7l-5.5 4 2 7L12 16l-6.5 4 2-7L2 9h7z"/></svg>',
    'crown'   => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7l4 4 5-6 5 6 4-4-1.5 12h-15z"/><path d="M4.5 20h15"/></svg>',
    'flag'    => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 21V4M4 4h13l-2 4 2 4H4"/></svg>',
    'calendar'=> '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="17" rx="2"/><path d="M3 9h18M8 2v4M16 2v4"/></svg>',
    'play'    => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><path d="M8 6.5v11l9-5.5z" fill="currentColor" stroke="none"/></svg>',
    'bell'    => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.7 21a2 2 0 0 1-3.4 0"/></svg>',
    'soon'    => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>',
    'arrow'   => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
];

ob_start(); ?>
<style>
/* ── Блог / Новости (scoped) ── */
.blog-intro{position:relative;z-index:0}
.blog-intro::before{content:"";position:absolute;left:50%;top:-30px;width:min(560px,110%);height:280px;
  transform:translateX(-50%);z-index:0;pointer-events:none;
  background:radial-gradient(60% 60% at 50% 30%,var(--gold-soft),transparent 70%)}
.blog-intro>*{position:relative;z-index:1}
.blog-lead{max-width:680px;margin:0 auto;text-align:center;color:var(--text-dim)}

/* Рубрики */
.rub-card{position:relative;display:flex;flex-direction:column;gap:12px;overflow:hidden}
.rub-card::after{content:"";position:absolute;left:0;top:0;width:100%;height:3px;
  background:linear-gradient(90deg,var(--gold),transparent);opacity:0;transition:opacity .3s}
@media(hover:hover){.rub-card:hover::after{opacity:.8}}
.rub-idx{position:absolute;top:14px;right:16px;font-family:var(--ff-display);font-weight:800;font-size:1.4rem;
  line-height:1;color:transparent;background:var(--grad-gold-text);-webkit-background-clip:text;background-clip:text;opacity:.24}
.rub-ic{width:54px;height:54px;flex:none;border-radius:16px;display:flex;align-items:center;justify-content:center;
  background:linear-gradient(150deg,var(--gold-soft),transparent);border:1px solid var(--glass-brd);color:var(--gold);
  box-shadow:inset 0 1px 0 rgba(255,255,255,.25);transition:transform .3s,box-shadow .3s}
.rub-ic svg{width:26px;height:26px}
@media(hover:hover){.rub-card:hover .rub-ic{transform:scale(1.08);box-shadow:var(--shadow-glow)}}
.rub-card h3{margin:0;color:var(--text);font-size:1.1rem;padding-right:28px}
.rub-card p{margin:0;color:var(--text-dim);font-size:.94rem}

/* Карточка статьи */
.post-card{position:relative;display:flex;flex-direction:column;gap:12px;overflow:hidden}
.post-card::before{content:"";position:absolute;top:0;left:-60%;width:45%;height:100%;z-index:2;pointer-events:none;
  background:linear-gradient(100deg,transparent,color-mix(in srgb,var(--gold) 18%,transparent),transparent);
  transform:skewX(-18deg);transition:left .7s ease}
@media(hover:hover){.post-card:hover::before{left:130%}}
.post-card h3{margin:6px 0 0;color:var(--text);overflow-wrap:anywhere}
.post-card p{margin:0;color:var(--text-dim);font-size:.95rem;overflow-wrap:anywhere}
.post-meta{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:auto;padding-top:12px;
  border-top:1px solid var(--line)}
.post-date{display:inline-flex;align-items:center;gap:6px;color:var(--muted);font-size:.84rem}
.post-date svg{width:14px;height:14px;color:var(--gold-2);flex:none}
.post-more{display:inline-flex;align-items:center;gap:6px;color:var(--gold-2);font-weight:700;font-size:.9rem}
.post-more svg{width:16px;height:16px;transition:transform .25s}
@media(hover:hover){.post-card:hover .post-more svg,.feed-card:hover .post-more svg{transform:translateX(4px)}}

/* Живая лента */
.feed-card{position:relative;display:flex;gap:14px;align-items:flex-start;overflow:hidden}
.feed-card::after{content:"";position:absolute;left:0;top:0;bottom:0;width:3px;
  background:linear-gradient(180deg,var(--gold),transparent);opacity:.7}
.feed-ic{width:48px;height:48px;flex:none;border-radius:14px;display:flex;align-items:center;justify-content:center;
  background:linear-gradient(150deg,var(--gold-soft),transparent);border:1px solid var(--glass-brd);color:var(--gold);
  box-shadow:inset 0 1px 0 rgba(255,255,255,.25)}
.feed-ic svg{width:22px;height:22px}
.feed-card h3{margin:0 0 4px;color:var(--text);font-size:1.02rem;overflow-wrap:anywhere}
.feed-card p{margin:0;color:var(--muted);font-size:.86rem}
.feed-card .badge{margin-top:8px}

/* Заглушка «скоро» */
.blog-soon{position:relative;width:80px;height:80px;margin:0 auto 20px;border-radius:50%;display:flex;align-items:center;justify-content:center;
  background:radial-gradient(circle at 50% 38%,var(--gold-soft),transparent 72%),var(--panel);
  border:1px solid var(--glass-brd);color:var(--gold-ink);box-shadow:var(--shadow-glow)}
[data-theme="dark"] .blog-soon{color:var(--gold)}
.blog-soon::before{content:"";position:absolute;inset:-6px;border-radius:50%;
  border:1px solid color-mix(in srgb,var(--gold) 40%,transparent);animation:blogPulse 3s ease-out infinite}
@keyframes blogPulse{0%{transform:scale(.85);opacity:.7}70%,100%{transform:scale(1.32);opacity:0}}
.blog-soon svg{width:36px;height:36px}

/* Подписка */
.blog-sub{position:relative;text-align:center;max-width:640px;margin:0 auto;padding:38px 30px;
  border:1.5px solid var(--gold);border-radius:var(--radius);background:var(--panel);
  box-shadow:var(--shadow-3d),var(--shadow-glow);backdrop-filter:blur(14px);overflow:hidden}
.blog-sub::before{content:"";position:absolute;inset:8px;border:1px dashed color-mix(in srgb,var(--gold) 34%,transparent);
  border-radius:13px;pointer-events:none}
.blog-sub::after{content:"";position:absolute;left:50%;top:-30%;width:70%;height:80%;transform:translateX(-50%);
  background:radial-gradient(50% 60% at 50% 40%,var(--gold-soft),transparent 70%);pointer-events:none}
.blog-sub h2,.blog-sub p{position:relative}
.blog-sub .btn{margin:6px}
@media(prefers-reduced-motion:reduce){.blog-soon::before{animation:none;display:none}}
@media(max-width:560px){.blog-sub{padding:32px 20px}}
</style>

<!-- Интро -->
<section class="section">
  <div class="container blog-intro">
    <div class="section-head reveal">
      <p class="eyebrow">Блог и новости</p>
      <h2>Живём искусством вместе</h2>
      <div class="gold-rule"></div>
    </div>
    <p class="blog-lead reveal">Статьи, гиды по конкурсам, истории участников, композиторы и памятные даты, новости и анонсы Культурного центра «Музыкальный Мир» - для участников, педагогов и родителей.</p>
  </div>
</section>

<?php if ($posts): ?>
<!-- Лента статей -->
<section class="section section--tint">
  <div class="container">
    <div class="section-head reveal">
      <p class="eyebrow">Свежее</p>
      <h2>Статьи и новости</h2>
      <div class="gold-rule"></div>
    </div>
    <div class="grid grid-3">
      <?php foreach ($posts as $i => $p): ?>
        <article class="card post-card reveal" style="--i:<?= (int) $i ?>">
          <span class="badge badge--intl" style="align-self:flex-start"><?= h($rubricOf($p)) ?></span>
          <h3><?= h($p['title'] ?: 'Без названия') ?></h3>
          <p><?= h($excerpt($p['body'])) ?></p>
          <div class="post-meta">
            <span class="post-date"><?= $svg['calendar'] ?><?= h(ru_date($p['updated_at'])) ?></span>
            <a class="post-more" href="<?= url('/blog/' . rawurlencode($p['slug'])) ?>">Читать <?= $svg['arrow'] ?></a>
          </div>
        </article>
      <?php endforeach; ?>
    </div>
  </div>
</section>
<?php else: ?>
<!-- Заглушка: статьи готовятся -->
<section class="section section--tint">
  <div class="container" style="text-align:center;max-width:600px">
    <div class="reveal">
      <div class="blog-soon"><?= $svg['soon'] ?></div>
      <h2>Скоро здесь появятся статьи</h2>
      <p style="color:var(--text-dim)">Мы готовим блог центра: гиды по конкурсам, истории лауреатов, разборы номинаций и рассказы о композиторах. А пока - следите за новостями во «ВКонтакте» и в Telegram-канале.</p>
      <div style="margin-top:8px">
        <a class="btn btn--primary" href="<?= h(cfgv('org_vk')) ?>" target="_blank" rel="noopener">Сообщество «ВКонтакте»</a>
        <a class="btn btn--ghost" href="<?= h(cfgv('org_tg_channel')) ?>" target="_blank" rel="noopener">Telegram-канал</a>
      </div>
    </div>
  </div>
</section>
<?php endif; ?>

<!-- Рубрики блога -->
<section class="section">
  <div class="container">
    <div class="section-head reveal">
      <p class="eyebrow">О чём пишем</p>
      <h2>Рубрики блога</h2>
      <div class="gold-rule"></div>
      <p>Девять направлений - от истории инструментов до патриотики и итогов сезона.</p>
    </div>
    <div class="grid grid-3">
      <?php foreach ($rubrics as $i => [$ic, $title, $descr]): ?>
        <div class="card rub-card reveal" style="--i:<?= (int) $i ?>">
          <span class="rub-idx" aria-hidden="true"><?= sprintf('%02d', $i + 1) ?></span>
          <div class="rub-ic"><?= $svg[$ic] ?></div>
          <h3><?= h($title) ?></h3>
          <p><?= h($descr) ?></p>
        </div>
      <?php endforeach; ?>
    </div>
  </div>
</section>

<?php if ($hasFeed): ?>
<!-- Живая лента: анонсы и видео из базы -->
<section class="section section--parchment">
  <div class="container">
    <div class="section-head reveal">
      <p class="eyebrow">Прямо сейчас</p>
      <h2>Из жизни центра</h2>
      <div class="gold-rule"></div>
    </div>
    <div class="grid grid-3">
      <?php foreach ($openComps as $c): ?>
        <a class="card feed-card reveal" href="<?= url('/competition/' . h($c['slug'])) ?>">
          <div class="feed-ic"><?= $svg['bell'] ?></div>
          <div>
            <h3><?= h($c['name']) ?></h3>
            <p><?= h($c['type'] === 'international' ? 'Международный конкурс' : 'Всероссийский конкурс') ?><?php if (!empty($c['end_date'])): ?> - приём до <?= h(ru_date($c['end_date'])) ?><?php endif; ?></p>
            <span class="badge badge--open">Приём открыт</span>
          </div>
        </a>
      <?php endforeach; ?>
      <?php foreach ($recentConcerts as $c): ?>
        <a class="card feed-card reveal" href="<?= url('/concerts') ?>">
          <div class="feed-ic"><?= $svg['play'] ?></div>
          <div>
            <h3><?= h($c['title']) ?></h3>
            <p><?php if (!empty($c['category'])): ?><?= h($c['category']) ?><?php if (!empty($c['date'])): ?> - <?php endif; ?><?php endif; ?><?php if (!empty($c['date'])): ?><?= h(ru_date($c['date'])) ?><?php endif; ?></p>
            <span class="badge badge--intl">Онлайн-концерт</span>
          </div>
        </a>
      <?php endforeach; ?>
    </div>
  </div>
</section>
<?php endif; ?>

<!-- Подписка -->
<section class="section section--tint">
  <div class="container">
    <div class="blog-sub reveal">
      <h2>Не пропустите новое</h2>
      <p style="color:var(--text-dim);margin:14px auto 22px">Анонсы конкурсов, результаты и новые статьи - в наших официальных каналах. Подпишитесь, чтобы быть в курсе.</p>
      <a class="btn btn--primary btn--lg" href="<?= h(cfgv('org_vk')) ?>" target="_blank" rel="noopener">«ВКонтакте»</a>
      <a class="btn btn--ghost btn--lg" href="<?= h(cfgv('org_tg_channel')) ?>" target="_blank" rel="noopener">Telegram-канал</a>
    </div>
  </div>
</section>
<?php
$content = ob_get_clean();
render_page('Блог и новости', $content, [
    'active' => '/blog',
    'meta' => 'Блог и новости Культурного центра «Музыкальный Мир»: статьи, гиды по конкурсам, истории лауреатов, композиторы и памятные даты, анонсы и итоги конкурсов.',
]);
