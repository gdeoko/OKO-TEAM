<?php
/**
 * Гала-концерт лауреатов «Музыкальный Мир» - торжественное подведение итогов сезона.
 *
 * Страница адаптивна к настройкам (таблица settings):
 *  - gala_nominees   - JSON-массив реальных номинантов [{"key","name","note"}]; без него имена не выдумываются;
 *  - gala_voting     - '1' включает «Приз зрительских симпатий» (только при заданных номинантах);
 *  - gala_program    - JSON-массив пунктов программы [{"time","title","note"}]; без него - базовая программа без имён;
 *  - gala_stream_embed_url - ссылка на трансляцию (показывается плеер при статусе «эфир»);
 *  - gala_status scheduled|live|finished, gala_date, gala_place, gala_title, gala_subtitle, gala_lead.
 * Голоса храним в собственной таблице gala_votes (идемпотентно, миграции ядра не трогаем).
 */

if (!function_exists('gala_json_setting')) {
    function gala_json_setting(string $key): array {
        $raw = trim((string) setting($key, ''));
        if ($raw === '') return [];
        $decoded = json_decode($raw, true);
        return (is_array($decoded) && $decoded) ? $decoded : [];
    }
}

$galaId   = 'main';
$title    = setting('gala_title', 'Гала-концерт лауреатов «Музыкальный Мир»');
$subtitle = setting('gala_subtitle', 'Торжественное подведение итогов конкурсного сезона: лучшие номера лауреатов, награждение обладателей Гран-при и большой праздник творчества.');
$lead     = trim((string) setting('gala_lead', ''));
$status   = setting('gala_status', 'scheduled'); // scheduled | live | finished
$date     = trim((string) setting('gala_date', ''));
$place    = trim((string) setting('gala_place', 'Москва'));
$embedUrl = trim((string) setting('gala_stream_embed_url', ''));

/* --- Номинанты и голосование: только из настроек, без выдуманных ФИО. --- */
$nominees = gala_json_setting('gala_nominees');
// Оставляем только корректные записи с ключом и именем.
$nominees = array_values(array_filter($nominees, static fn($n) => is_array($n) && !empty($n['key']) && !empty($n['name'])));
$votingOn = in_array((string) setting('gala_voting', ''), ['1', 'on', 'true', 'yes'], true) && $nominees;

/* --- Программа вечера: из настроек либо базовая (без имён участников). --- */
$program = gala_json_setting('gala_program');
if (!$program) {
    $program = [
        ['title' => 'Торжественное открытие',        'note' => 'Приветствие Оргкомитета и почётных гостей'],
        ['title' => 'Выступления лауреатов',          'note' => 'Лучшие конкурсные номера сезона на сцене'],
        ['title' => 'Награждение обладателей Гран-при','note' => 'Вручение высших наград конкурсов и фестивалей'],
        ['title' => 'Приз зрительских симпатий',      'note' => 'Объявление победителя зрительского голосования'],
        ['title' => 'Финал и общее фото',             'note' => 'Заключительный номер и памятная фотография'],
    ];
}

$statusMap = [
    'live'      => ['Прямой эфир идёт', 'badge--open'],
    'scheduled' => ['Готовится к проведению', 'badge--intl'],
    'finished'  => ['Событие завершено', 'badge--closed'],
];
[$statusLabel, $statusBadge] = $statusMap[$status] ?? $statusMap['scheduled'];
$showStream = $status === 'live' && $embedUrl !== '';

/* --- Голоса (таблица создаётся идемпотентно) --- */
$counts = []; $total = 0; $votedKey = null;
if ($nominees) {
    db()->exec("CREATE TABLE IF NOT EXISTS gala_votes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        gala_id TEXT NOT NULL DEFAULT 'main',
        nominee_key TEXT NOT NULL,
        session_key TEXT NOT NULL DEFAULT '',
        ip TEXT DEFAULT '',
        created_at TEXT DEFAULT (datetime('now'))
    )");
    db()->exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_gala_votes_session ON gala_votes(gala_id, session_key)");
    db()->exec("CREATE INDEX IF NOT EXISTS idx_gala_votes_nominee ON gala_votes(gala_id, nominee_key)");

    $keys   = array_column($nominees, 'key');
    $counts = array_fill_keys($keys, 0);
    foreach (all("SELECT nominee_key, COUNT(*) c FROM gala_votes WHERE gala_id=? GROUP BY nominee_key", [$galaId]) as $r) {
        if (array_key_exists($r['nominee_key'], $counts)) $counts[$r['nominee_key']] = (int) $r['c'];
    }
    $total = array_sum($counts);

    $sessionKey = session_id() ?: '';
    $already = one(
        "SELECT nominee_key FROM gala_votes WHERE gala_id=? AND (session_key=? OR (ip<>'' AND ip=?)) LIMIT 1",
        [$galaId, $sessionKey, client_ip()]
    );
    $votedKey = $already['nominee_key'] ?? null;
}

/* --- Иконки (feather-стиль) --- */
$ic = [
  'play'  => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="12" r="10"/><path d="M10 8l6 4-6 4z" fill="currentColor" stroke="none"/></svg>',
  'star'  => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 2l3 7h7l-5.5 4 2 7L12 16l-6.5 4 2-7L2 9h7z"/></svg>',
  'done'  => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="12" r="9"/><path d="m8 12 3 3 5-6"/></svg>',
  'cal'   => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>',
  'pin'   => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M21 10c0 7-9 12-9 12s-9-5-9-12a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>',
  'award' => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="8" r="6"/><path d="M8.2 13.9 7 22l5-3 5 3-1.2-8.1"/></svg>',
  'users' => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
  'arrow' => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
  'note'  => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>',
];

ob_start(); ?>
<section class="section galx-hero">
  <div class="container">
    <a class="aw-back" href="<?= url('/menu') ?>"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M11 6l-6 6 6 6"/></svg>Назад</a>
    <div class="galx-hero__inner reveal">
      <p class="eyebrow"><?= $ic['note'] ?> Итоги сезона</p>
      <h1 class="galx-hero__title"><?= h($title) ?></h1>
      <p class="galx-hero__sub"><?= h($subtitle) ?></p>
      <div class="galx-hero__meta">
        <span class="badge <?= h($statusBadge) ?>"><?php if ($status === 'live'): ?><span class="galx-live-dot"></span><?php endif; ?><?= h($statusLabel) ?></span>
        <?php if ($date !== ''): ?><span class="galx-fact"><?= $ic['cal'] ?><?= h(ru_date($date)) ?></span><?php endif; ?>
        <?php if ($place !== ''): ?><span class="galx-fact"><?= $ic['pin'] ?><?= h($place) ?></span><?php endif; ?>
      </div>
      <div class="galx-hero__cta">
        <a class="btn btn--primary btn--lg" href="<?= url('/competitions') ?>">Участвовать в конкурсах</a>
        <?php if ($votingOn): ?>
          <a class="btn btn--ghost btn--lg" href="#gala-vote">Голосование зрителей <?= $ic['arrow'] ?></a>
        <?php else: ?>
          <a class="btn btn--ghost btn--lg" href="<?= url('/concerts') ?>">Онлайн-концерты <?= $ic['arrow'] ?></a>
        <?php endif; ?>
      </div>
    </div>

    <?php if ($showStream): ?>
      <div class="galx-embed reveal">
        <iframe src="<?= h($embedUrl) ?>" loading="lazy" allow="autoplay; encrypted-media" allowfullscreen title="<?= h($title) ?>"></iframe>
      </div>
    <?php endif; ?>
  </div>
</section>

<section class="section section--parchment">
  <div class="container">
    <div class="grid grid-2 galx-about">
      <div class="reveal">
        <div class="section-head" style="text-align:left">
          <p class="eyebrow"><?= $ic['star'] ?> О событии</p>
          <h2>Праздник лучших</h2>
          <div class="gold-rule" style="margin-left:0"></div>
        </div>
        <?php if ($lead !== ''): ?>
          <p><?= nl2br(h($lead)) ?></p>
        <?php else: ?>
          <p>Гала-концерт «Музыкальный Мир» - главное событие сезона, на котором мы чествуем лауреатов
             международных и всероссийских конкурсов Культурного центра. На одной сцене встречаются лучшие
             вокалисты, музыканты, танцоры и чтецы - те, чьи работы получили высшие оценки жюри.</p>
          <p>Здесь вручают Гран-при, объявляют победителя зрительского голосования и вписывают новые имена
             в Аллею Славы. Это вечер, ради которого проходит весь конкурсный путь - от первой заявки до
             выхода на большую сцену.</p>
        <?php endif; ?>
        <p style="margin-top:18px">
          <a class="btn btn--ghost" href="<?= url('/competitions') ?>"><?= $ic['award'] ?> Как стать лауреатом</a>
        </p>
      </div>

      <div class="card galx-program reveal">
        <h3 class="galx-program__title"><?= $ic['note'] ?>Программа вечера</h3>
        <div class="timeline">
          <?php foreach ($program as $i => $p): if (empty($p['title'])) continue; ?>
            <div class="timeline-item">
              <?php if (!empty($p['time'])): ?><span class="tl-date"><?= h($p['time']) ?></span><?php else: ?><span class="tl-date">Часть <?= $i + 1 ?></span><?php endif; ?>
              <h4><?= h($p['title']) ?></h4>
              <?php if (!empty($p['note'])): ?><p><?= h($p['note']) ?></p><?php endif; ?>
            </div>
          <?php endforeach; ?>
        </div>
      </div>
    </div>
  </div>
</section>

<?php if ($votingOn): ?>
<section class="section" id="gala-vote">
  <div class="container" style="max-width:860px">
    <div class="section-head reveal">
      <p class="eyebrow"><?= $ic['star'] ?> Голосование зрителей</p>
      <h2>Приз зрительских симпатий</h2>
      <div class="gold-rule"></div>
      <p>Выберите номер, который понравился Вам больше всего. Один голос от одного зрителя.</p>
    </div>

    <div class="vote-grid reveal" id="voteGrid">
      <?php foreach ($nominees as $n): $cnt = $counts[$n['key']] ?? 0; $pct = $total > 0 ? round($cnt / $total * 100) : 0; ?>
        <div class="vote-card<?= $votedKey === $n['key'] ? ' voted' : '' ?>" data-nominee="<?= h($n['key']) ?>">
          <div class="vote-head">
            <div>
              <b><?= h($n['name']) ?></b>
              <?php if (!empty($n['note'])): ?><p><?= h($n['note']) ?></p><?php endif; ?>
            </div>
          </div>
          <div class="vote-bar-wrap"><div class="vote-bar" data-bar style="width:<?= $pct ?>%"></div></div>
          <div class="vote-meta"><span data-count><?= $cnt ?></span><span data-pct><?= $pct ?>%</span></div>
          <button type="button" class="btn btn--ghost vote-btn" data-vote-btn<?= $votedKey ? ' disabled' : '' ?>><?= $ic['star'] ?>Голосовать</button>
          <span class="vote-mark"><?= $ic['done'] ?>Ваш голос учтён</span>
        </div>
      <?php endforeach; ?>
    </div>

    <p class="vote-total">Всего голосов: <b data-vote-total><?= $total ?></b></p>
    <p class="vote-note" id="voteError"></p>
  </div>
</section>
<?php elseif ($nominees): ?>
<section class="section">
  <div class="container" style="max-width:960px">
    <div class="section-head reveal">
      <p class="eyebrow"><?= $ic['award'] ?> На сцене</p>
      <h2>Номинанты гала-концерта</h2>
      <div class="gold-rule"></div>
      <p>Лауреаты, чьи номера прозвучат на торжественном вечере.</p>
    </div>
    <div class="grid grid-2 galx-nominees">
      <?php foreach ($nominees as $i => $n): ?>
        <div class="card galx-nominee reveal" style="--i:<?= $i % 2 ?>">
          <span class="galx-nominee__ic"><?= $ic['star'] ?></span>
          <div>
            <b><?= h($n['name']) ?></b>
            <?php if (!empty($n['note'])): ?><p><?= h($n['note']) ?></p><?php endif; ?>
          </div>
        </div>
      <?php endforeach; ?>
    </div>
  </div>
</section>
<?php else: ?>
<section class="section">
  <div class="container">
    <div class="card galx-cta reveal">
      <span class="galx-cta__ic"><?= $ic['award'] ?></span>
      <h2>Имена лауреатов - впереди</h2>
      <p>Участники гала-концерта определяются по итогам конкурсного сезона. Обладатели Гран-при и лучшие
         номера будут объявлены после подведения итогов - имена появятся здесь и в Аллее Славы.</p>
      <div class="galx-cta__btns">
        <a class="btn btn--primary btn--lg" href="<?= url('/competitions') ?>">Выбрать конкурс</a>
        <a class="btn btn--ghost btn--lg" href="<?= url('/calendar') ?>">Календарь сезона <?= $ic['arrow'] ?></a>
      </div>
    </div>
  </div>
</section>
<?php endif; ?>

<section class="section section--parchment">
  <div class="container">
    <div class="card galx-join reveal">
      <div class="galx-join__text">
        <p class="eyebrow"><?= $ic['users'] ?> Путь на сцену</p>
        <h2>Как попасть на гала-концерт</h2>
        <p>Дорога проста: подайте заявку на конкурс, пройдите оценку жюри и получите звание лауреата.
           Лучшие номера сезона Оргкомитет приглашает на гала-концерт. Следите за статусом в личном
           кабинете и в календаре конкурсов.</p>
      </div>
      <div class="galx-join__steps">
        <div class="galx-step"><span>1</span><p>Подать заявку на конкурс</p></div>
        <div class="galx-step"><span>2</span><p>Получить звание лауреата</p></div>
        <div class="galx-step"><span>3</span><p>Выступить на гала-концерте</p></div>
      </div>
      <div class="galx-join__btns">
        <a class="btn btn--primary" href="<?= url('/competitions') ?>">К конкурсам</a>
        <a class="btn btn--ghost" href="<?= url('/cabinet') ?>">Личный кабинет <?= $ic['arrow'] ?></a>
      </div>
    </div>
  </div>
</section>

<style>
.galx-hero{position:relative;overflow:hidden;padding-top:64px}
.galx-hero::before{content:"";position:absolute;inset:0;z-index:-1;
  background:radial-gradient(760px 420px at 50% -8%,var(--gold-soft),transparent 60%)}
.galx-hero::after{content:"";position:absolute;left:50%;top:-120px;width:520px;height:520px;transform:translateX(-50%);z-index:-1;
  border-radius:50%;border:1px dashed var(--glass-brd);opacity:.4;pointer-events:none}
.galx-hero__inner{max-width:760px;margin:0 auto;text-align:center;position:relative}
.galx-hero__inner::before{content:"";display:block;width:60px;height:60px;margin:0 auto 6px;
  background:radial-gradient(closest-side,var(--gold-soft),transparent 70%)}
.galx-hero__title{font-family:var(--ff-display);font-size:clamp(2rem,5.4vw,3.2rem);line-height:1.08;margin:.1em 0 .35em;
  background:var(--grad-gold-text);-webkit-background-clip:text;background-clip:text;color:transparent}
.galx-hero__sub{color:var(--text-dim);font-size:1.08rem;max-width:620px;margin:0 auto}
.galx-hero__meta{display:flex;flex-wrap:wrap;gap:12px;justify-content:center;margin:22px 0 26px}
.galx-fact{display:inline-flex;align-items:center;gap:7px;font-weight:700;font-size:.9rem;color:var(--text-dim);
  background:var(--panel);border:1px solid var(--glass-brd);border-radius:999px;padding:8px 16px;backdrop-filter:blur(10px)}
.galx-fact svg{width:16px;height:16px;color:var(--gold-2)}
.galx-hero__cta{display:flex;flex-wrap:wrap;gap:14px;justify-content:center}
.galx-hero__cta svg{width:17px;height:17px}
.galx-live-dot{display:inline-block;width:9px;height:9px;border-radius:50%;background:#e05353;margin-right:7px;
  vertical-align:middle;animation:galaPulse 1.6s infinite}
@keyframes galaPulse{0%,100%{opacity:1}50%{opacity:.35}}

.galx-embed{position:relative;width:100%;max-width:960px;margin:40px auto 0;aspect-ratio:16/9;background:var(--bg-2);
  border:1px solid var(--glass-brd);border-radius:var(--radius);overflow:hidden;box-shadow:var(--shadow-3d),var(--shadow-glow)}
.galx-embed iframe{position:absolute;inset:0;width:100%;height:100%;border:0}

.galx-about{align-items:start}
.galx-about p{color:var(--text-dim)}
.galx-program{padding:28px;position:relative;overflow:hidden}
.galx-program::before{content:"";position:absolute;right:-26px;top:-26px;width:130px;height:130px;pointer-events:none;
  background:radial-gradient(closest-side,var(--gold-soft),transparent 70%);opacity:.7}
.galx-program::after{content:"";position:absolute;bottom:14px;right:14px;width:18px;height:18px;pointer-events:none;
  border-bottom:1.5px solid var(--gold-2);border-right:1.5px solid var(--gold-2);border-bottom-right-radius:5px;opacity:.5}
.galx-program__title{display:flex;align-items:center;gap:10px;font-size:1.16rem;margin:0 0 20px;position:relative;z-index:1}
.galx-program__title svg{width:22px;height:22px;color:var(--gold-2);flex:none}
.galx-program .timeline{position:relative;z-index:1}

.galx-nominees{align-items:stretch}
.galx-nominee{display:flex;align-items:flex-start;gap:16px;padding:22px;position:relative;overflow:hidden}
.galx-nominee::after{content:"";position:absolute;top:11px;right:11px;width:15px;height:15px;pointer-events:none;
  border-top:1.5px solid var(--gold-2);border-right:1.5px solid var(--gold-2);border-top-right-radius:5px;opacity:.4;transition:opacity .3s}
@media(hover:hover){.galx-nominee:hover::after{opacity:1}}
.galx-nominee__ic{flex:none;width:44px;height:44px;border-radius:12px;background:var(--gold-soft);
  display:flex;align-items:center;justify-content:center;color:var(--gold)}
.galx-nominee__ic svg{width:22px;height:22px}
.galx-nominee b{font-family:var(--ff-display);font-size:1.12rem;color:var(--text);display:block}
.galx-nominee p{color:var(--text-dim);font-size:.92rem;margin:5px 0 0}

.galx-cta{text-align:center;max-width:680px;margin:0 auto;padding:44px 28px}
.galx-cta__ic{display:inline-flex;width:60px;height:60px;border-radius:16px;background:var(--gold-soft);
  align-items:center;justify-content:center;color:var(--gold);margin-bottom:8px}
.galx-cta__ic svg{width:30px;height:30px}
.galx-cta h2{background:var(--grad-gold-text);-webkit-background-clip:text;background-clip:text;color:transparent;display:inline-block}
.galx-cta p{color:var(--text-dim);max-width:520px;margin:12px auto 24px}
.galx-cta__btns{display:flex;flex-wrap:wrap;gap:14px;justify-content:center}
.galx-cta__btns svg{width:17px;height:17px}

.galx-join{padding:36px 30px;position:relative;overflow:hidden}
.galx-join::before{content:"";position:absolute;left:-40px;bottom:-40px;width:200px;height:200px;pointer-events:none;
  background:radial-gradient(closest-side,var(--gold-soft),transparent 70%);opacity:.6}
.galx-join__text{max-width:640px;position:relative;z-index:1}
.galx-join__text p{color:var(--text-dim)}
.galx-join__steps{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin:26px 0;position:relative;z-index:1}
.galx-step{display:flex;align-items:center;gap:14px;background:var(--panel);border:1px solid var(--glass-brd);
  border-radius:var(--radius-sm);padding:16px 18px;backdrop-filter:blur(10px);position:relative;transition:transform .25s,border-color .25s}
@media(hover:hover){.galx-step:hover{transform:translateY(-3px);border-color:var(--gold-2)}}
.galx-step span{flex:none;width:38px;height:38px;border-radius:50%;background:var(--grad-gold);color:var(--gold-fg);
  font-family:var(--ff-display);font-weight:800;font-size:1.2rem;display:flex;align-items:center;justify-content:center;
  box-shadow:0 0 0 4px var(--gold-soft),var(--shadow-btn)}
.galx-step p{margin:0;font-weight:700;color:var(--text);font-size:.94rem}
.galx-join__btns{display:flex;flex-wrap:wrap;gap:14px}
.galx-join__btns svg{width:17px;height:17px}

<?php if ($votingOn): ?>
.vote-grid{display:grid;gap:16px}
.vote-card{background:var(--panel);border:1.5px solid var(--glass-brd);border-radius:var(--radius-sm);padding:18px 20px 20px 23px;
  backdrop-filter:blur(12px);box-shadow:var(--shadow-card);transition:border .2s,box-shadow .2s,transform .2s;position:relative;overflow:hidden}
.vote-card::before{content:"";position:absolute;left:0;top:0;bottom:0;width:4px;background:var(--grad-gold);opacity:.5;transition:opacity .2s}
@media(hover:hover){.vote-card:hover{transform:translateY(-3px);box-shadow:var(--shadow-3d)}.vote-card:hover::before{opacity:1}}
.vote-card.voted{border-color:var(--gold);box-shadow:0 0 0 3px var(--gold-soft),var(--shadow-card)}
.vote-card.voted::before{opacity:1}
.vote-bar{box-shadow:0 0 8px rgba(201,168,76,.45)}
.vote-head{display:flex;justify-content:space-between;gap:14px;align-items:flex-start;flex-wrap:wrap}
.vote-head b{font-family:var(--ff-display);letter-spacing:.02em;font-size:1.1rem;color:var(--text)}
.vote-head p{margin:4px 0 0;color:var(--text-dim);font-size:.92rem}
.vote-bar-wrap{margin-top:12px;height:8px;border-radius:6px;background:var(--gold-soft);overflow:hidden}
.vote-bar{height:100%;background:var(--grad-gold);border-radius:6px;width:0;transition:width .5s ease}
.vote-meta{display:flex;justify-content:space-between;margin-top:8px;font-size:.82rem;color:var(--muted)}
.vote-btn{margin-top:14px;min-width:150px;justify-content:center}
.vote-btn svg{width:17px;height:17px}
.vote-mark{display:none;align-items:center;gap:6px;color:var(--gold-2);font-weight:700;font-size:.9rem;margin-top:14px}
.vote-mark svg{width:18px;height:18px}
.vote-card.voted .vote-mark{display:inline-flex}
.vote-card.voted .vote-btn{display:none}
.vote-total{text-align:center;color:var(--muted);margin-top:20px;font-size:.94rem}
.vote-total b{color:var(--gold-2)}
.vote-note{font-size:.84rem;color:var(--error);text-align:center;margin-top:6px}
<?php endif; ?>

/* --- Моушен-микро (только transform/opacity; глушится глобальным prefers-reduced-motion) --- */
.galx-program .timeline-item{transition:transform .25s ease}
.galx-program .timeline-item::before{transition:transform .25s ease,box-shadow .25s ease}
.galx-nominee__ic{transition:transform .3s ease}
.galx-cta__ic svg{transition:transform .3s ease}
@media(hover:hover){
  .galx-program .timeline-item:hover{transform:translateX(4px)}
  .galx-program .timeline-item:hover::before{transform:scale(1.18);box-shadow:0 0 0 4px var(--gold-soft),0 0 12px rgba(201,168,76,.7)}
  .galx-nominee:hover .galx-nominee__ic{transform:scale(1.08) rotate(-4deg)}
  .galx-cta:hover .galx-cta__ic svg{transform:scale(1.1) rotate(6deg)}
}

@media (max-width:640px){
  .galx-join__steps{grid-template-columns:1fr}
  .galx-hero__cta .btn,.galx-cta__btns .btn{flex:1 1 100%}
}
@media (max-width:400px){
  .vote-btn{min-width:0;width:100%}
  .galx-nominee{padding:20px}
}
</style>

<?php if ($votingOn): ?>
<script>
(function () {
  var apiUrl = <?= json_encode(url('/api/v1/vote'), JSON_UNESCAPED_SLASHES) ?>;
  var grid = document.getElementById('voteGrid');
  if (!grid) return;
  var errBox = document.getElementById('voteError');
  var totalBox = document.querySelector('[data-vote-total]');
  var voted = <?= json_encode($votedKey) ?>;

  function render(counts, total) {
    grid.querySelectorAll('.vote-card').forEach(function (card) {
      var key = card.getAttribute('data-nominee');
      var c = counts[key] || 0;
      var pct = total > 0 ? Math.round(c / total * 100) : 0;
      card.querySelector('[data-count]').textContent = c;
      card.querySelector('[data-pct]').textContent = pct + '%';
      card.querySelector('[data-bar]').style.width = pct + '%';
    });
    if (totalBox) totalBox.textContent = total;
  }

  function markVoted(key) {
    voted = key;
    grid.querySelectorAll('.vote-card').forEach(function (card) {
      card.classList.toggle('voted', card.getAttribute('data-nominee') === key);
      var btn = card.querySelector('[data-vote-btn]');
      if (btn) btn.disabled = true;
    });
  }

  grid.addEventListener('click', function (e) {
    var btn = e.target.closest('[data-vote-btn]');
    if (!btn || btn.disabled || voted) return;
    var card = btn.closest('.vote-card');
    var key = card.getAttribute('data-nominee');
    btn.disabled = true;
    errBox.textContent = '';
    fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'nominee_key=' + encodeURIComponent(key) + '&gala_id=main&_csrf=' + encodeURIComponent(<?= json_encode(csrf_token()) ?>)
    }).then(function (r) { return r.json(); }).then(function (d) {
      if (d.counts) render(d.counts, d.total);
      if (d.ok) { markVoted(d.voted); }
      else if (d.voted) { markVoted(d.voted); errBox.textContent = d.error || 'Вы уже голосовали'; }
      else { btn.disabled = false; errBox.textContent = d.error || 'Не удалось учесть голос, попробуйте ещё раз'; }
    }).catch(function () {
      btn.disabled = false;
      errBox.textContent = 'Не удалось учесть голос, проверьте соединение';
    });
  });

  // Live-обновление счётчиков без перезагрузки.
  setInterval(function () {
    fetch(apiUrl + '?gala_id=main').then(function (r) { return r.json(); }).then(function (d) {
      if (d.counts) render(d.counts, d.total);
      if (d.voted && !voted) markVoted(d.voted);
    }).catch(function () {});
  }, 8000);
})();
</script>
<?php endif; ?>
<?php
$content = ob_get_clean();
render_page($title, $content, [
    'active' => '/gala',
    'meta'   => 'Гала-концерт лауреатов КЦ «Музыкальный Мир»: торжественное подведение итогов сезона, программа вечера, '
        . ($votingOn ? 'голосование зрителей за приз зрительских симпатий' : 'номинанты и путь на большую сцену') . '.',
]);
