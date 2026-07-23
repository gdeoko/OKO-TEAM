<?php
/** Онлайн-гала-концерты: премиум-видеогалерея (RuTube), фильтры по категориям, привязка к PRO.Культура.РФ. */
$concerts = all("SELECT * FROM concerts ORDER BY sort DESC, date DESC");
$categories = [];
$catCounts = [];
foreach ($concerts as $c) {
    if ($c['category'] !== '') {
        $categories[$c['category']] = true;
        $catCounts[$c['category']] = ($catCounts[$c['category']] ?? 0) + 1;
    }
}
$categories = array_keys($categories);

$icoCal = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4.5" width="18" height="16" rx="2.5"/><path d="M3 9h18M8 2.5v4M16 2.5v4"/></svg>';

$icoPlay = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><path d="M8 6.5v11l9-5.5z" fill="currentColor" stroke="none"/></svg>';
$icoSoon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>';
$icoInfo = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 11v5"/><path d="M12 8h.01"/></svg>';
$icoShare = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/></svg>';

/* Нормализация ссылки в embed-URL плеера: RuTube и VK Video (vk.com/video_ext.php, vkvideo.ru). */
$embedUrlOf = static function (string $raw): string {
    $raw = trim($raw);
    if ($raw === '') return '';
    // Уже готовый VK embed.
    if (stripos($raw, 'video_ext.php') !== false) return $raw;
    // VK Video: vk.com/video-123_456, vkvideo.ru/video-123_456, ?z=video-123_456 (+ необяз. hash после id).
    if (preg_match('~(?:vk\.com|vkvideo\.ru)~i', $raw) && preg_match('~video(-?\d+)_(\d+)(?:_([0-9a-f]+))?~i', $raw, $m)) {
        $u = 'https://vk.com/video_ext.php?oid=' . $m[1] . '&id=' . $m[2] . '&hd=2';
        if (!empty($m[3])) $u .= '&hash=' . $m[3];
        return $u;
    }
    // RuTube: уже embed.
    if (stripos($raw, 'rutube.ru/play/embed/') !== false) return $raw;
    // RuTube: страница видео rutube.ru/video/HASH/ или /shorts/HASH/.
    if (preg_match('~rutube\.ru/(?:video(?:/private)?|shorts)/([0-9a-f]{32})~i', $raw, $m)) {
        return 'https://rutube.ru/play/embed/' . $m[1];
    }
    return $raw;
};

ob_start(); ?>
<style>
.concert-lead{max-width:720px;margin:0 auto;text-align:center}
.concert-support{display:inline-flex;gap:10px;align-items:center;margin-top:18px;padding:10px 18px;border-radius:999px;
  background:var(--gold-soft);border:1px solid var(--glass-brd);color:var(--text-dim);font-size:.9rem;line-height:1.35}
.concert-support svg{width:18px;height:18px;flex:0 0 18px;color:var(--gold-ink)}
[data-theme="dark"] .concert-support svg{color:var(--gold)}
.concert-card{padding:0;overflow:hidden}
.concert-embed{position:relative;width:100%;aspect-ratio:16/9;background:#0e0c10}
.concert-embed iframe{position:absolute;inset:0;width:100%;height:100%;border:0}
.concert-facade{position:absolute;inset:0;border:0;padding:0;cursor:pointer;display:block;background-size:cover;background-position:center;
  background-color:#0e0c10}
.concert-facade::after{content:"";position:absolute;inset:0;background:linear-gradient(180deg,rgba(11,10,13,.05),rgba(11,10,13,.55))}
.concert-facade .play{position:absolute;inset:0;z-index:1;display:flex;align-items:center;justify-content:center}
.concert-facade .play span{width:64px;height:64px;border-radius:50%;display:flex;align-items:center;justify-content:center;
  background:rgba(0,0,0,.42);border:1.5px solid rgba(255,255,255,.7);color:#fff;backdrop-filter:blur(4px);transition:transform .25s,background .25s}
.concert-facade .play svg{width:30px;height:30px}
.concert-facade:hover .play span{transform:scale(1.08);background:var(--gold);color:#1b1608;border-color:var(--gold)}
.concert-embed-stub{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:rgba(255,255,255,.45)}
.concert-body{padding:20px}
.concert-body h3{margin:10px 0 0}
.concert-empty{width:74px;height:74px;margin:0 auto 20px;border-radius:50%;background:var(--gold-soft);color:var(--gold-ink);
  border:1px solid var(--glass-brd);display:flex;align-items:center;justify-content:center}
[data-theme="dark"] .concert-empty{color:var(--gold)}
/* Слой обложки с мягким зумом при наведении */
.concert-cover{position:absolute;inset:0;background-size:cover;background-position:center;transition:transform .6s cubic-bezier(.2,.8,.2,1);z-index:0}
/* Брендовый фасад для записей без постера (вместо пустого тёмного бокса). */
.concert-cover--brand{background:
  radial-gradient(130% 95% at 50% -12%,rgba(201,168,76,.26),transparent 60%),
  linear-gradient(160deg,#251d0d 0%,#14110b 55%,#0e0c10 100%);
  background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120' viewBox='0 0 120 120'%3E%3Cg fill='none' stroke='%23c9a84c' stroke-width='1.4' opacity='0.16'%3E%3Cpath d='M28 78V40l20-4v34'/%3E%3Ccircle cx='24' cy='80' r='5'/%3E%3Ccircle cx='44' cy='74' r='5'/%3E%3Cpath d='M84 92V52l14-3v34'/%3E%3Ccircle cx='80' cy='94' r='4'/%3E%3Ccircle cx='94' cy='86' r='4'/%3E%3C/g%3E%3C/svg%3E"),
  radial-gradient(130% 95% at 50% -12%,rgba(201,168,76,.26),transparent 60%),
  linear-gradient(160deg,#251d0d 0%,#14110b 55%,#0e0c10 100%);
  background-size:120px 120px,cover,cover;background-repeat:repeat,no-repeat,no-repeat}
@media(hover:hover){.concert-card:hover .concert-cover{transform:scale(1.07)}}
.concert-facade .play{z-index:2}
.concert-facade .play span{position:relative}
.concert-facade .play span::before{content:"";position:absolute;inset:-7px;border-radius:50%;border:1.5px solid rgba(255,255,255,.5);animation:concert-pulse 2.6s ease-out infinite}
@keyframes concert-pulse{0%{transform:scale(1);opacity:.7}100%{transform:scale(1.55);opacity:0}}
@media(prefers-reduced-motion:reduce){.concert-facade .play span::before{animation:none}}
/* Категория поверх обложки */
.concert-tag{position:absolute;top:12px;left:12px;z-index:3;display:inline-flex;align-items:center;padding:6px 12px;border-radius:999px;
  font-size:.74rem;font-weight:800;letter-spacing:.05em;text-transform:uppercase;color:#fff;
  background:rgba(11,10,13,.5);border:1px solid rgba(255,255,255,.28);backdrop-filter:blur(6px)}
.concert-body h3{overflow-wrap:anywhere}
.concert-date{display:flex;align-items:center;gap:7px;color:var(--muted);margin:10px 0 0;font-size:.9rem}
.concert-date svg{width:15px;height:15px;flex:none;color:var(--gold-ink)}
[data-theme="dark"] .concert-date svg{color:var(--gold)}
/* Счётчик в фильтрах */
.concert-filter .fc{margin-left:8px;font-size:.72rem;font-weight:800;padding:1px 7px;border-radius:999px;
  background:var(--gold-soft);color:var(--gold-ink)}
[data-theme="dark"] .concert-filter .fc{color:var(--gold)}
.concert-filter.btn--primary .fc{background:rgba(26,18,6,.18);color:var(--gold-fg)}
/* Действия под концертом */
.concert-actions{margin-top:16px}
.concert-actions .btn{width:100%;justify-content:center;gap:8px}
.concert-actions .btn svg{width:16px;height:16px;flex:none}
.concert-card{scroll-margin-top:90px}
</style>

<section class="section section--parchment">
  <div class="container">
    <div class="section-head reveal">
      <p class="eyebrow">Смотрите</p>
      <h2>Онлайн-гала-концерты</h2>
    </div>
    <div class="concert-lead reveal">
      <p style="color:var(--text-dim);margin:0">Записи гала-концертов, творческих вечеров и концертных программ Культурного центра «Музыкальный Мир» - лауреаты и дипломанты наших конкурсов на одной сцене.</p>
      <div class="concert-support"><?= $icoInfo ?><span>Мероприятия проходят при информационной поддержке государственного портала «PRO.Культура.РФ».</span></div>
    </div>
  </div>
</section>

<?php if ($concerts): ?>
<section class="section">
  <div class="container">
    <?php if ($categories): ?>
    <div class="reveal" id="concertFilters" style="display:flex;gap:10px;flex-wrap:wrap;justify-content:center;margin-bottom:32px">
      <button type="button" class="btn btn--primary concert-filter" data-cat="">Все<span class="fc"><?= count($concerts) ?></span></button>
      <?php foreach ($categories as $cat): ?>
        <button type="button" class="btn btn--ghost concert-filter" data-cat="<?= h($cat) ?>"><?= h($cat) ?><span class="fc"><?= (int) $catCounts[$cat] ?></span></button>
      <?php endforeach; ?>
    </div>
    <?php endif; ?>

    <div class="grid grid-3" id="concertGrid">
      <?php foreach ($concerts as $c):
          $embed = $embedUrlOf((string) ($c['embed_url'] ?? ''));
          $anchor = 'concert-' . (int) ($c['id'] ?? 0);
          $shareUrl = url('/concerts') . '#' . $anchor; ?>
        <div class="card concert-card reveal" id="<?= h($anchor) ?>" data-cat="<?= h($c['category']) ?>">
          <div class="concert-embed">
            <?php if ($c['category']): ?><span class="concert-tag"><?= h($c['category']) ?></span><?php endif; ?>
            <?php if ($embed !== ''): ?>
              <button type="button" class="concert-facade" data-embed="<?= h($embed) ?>"
                      aria-label="Смотреть: <?= h($c['title']) ?>">
                <?php if ($c['cover']): ?>
                  <span class="concert-cover" style="background-image:url('<?= h($c['cover']) ?>')"></span>
                <?php else: ?>
                  <span class="concert-cover concert-cover--brand" aria-hidden="true"></span>
                <?php endif; ?>
                <span class="play"><span><?= $icoPlay ?></span></span>
              </button>
            <?php else: ?>
              <div class="concert-embed-stub"><span style="width:40px;height:40px"><?= $icoPlay ?></span></div>
            <?php endif; ?>
          </div>
          <div class="concert-body">
            <h3><?= h($c['title']) ?></h3>
            <?php if ($c['date']): ?><p class="concert-date"><?= $icoCal ?><span><?= h(ru_date($c['date'])) ?></span></p><?php endif; ?>
            <div class="concert-actions">
              <button class="btn btn--ghost" type="button" data-share data-share-title="<?= h($c['title']) ?>" data-share-url="<?= h($shareUrl) ?>"><?= $icoShare ?>Поделиться</button>
            </div>
          </div>
        </div>
      <?php endforeach; ?>
    </div>
  </div>
</section>
<script>
(function () {
  // Фильтры по категориям.
  var btns = Array.prototype.slice.call(document.querySelectorAll('.concert-filter'));
  var cards = Array.prototype.slice.call(document.querySelectorAll('.concert-card'));
  btns.forEach(function (b) {
    b.addEventListener('click', function () {
      btns.forEach(function (x) { x.classList.remove('btn--primary'); x.classList.add('btn--ghost'); });
      b.classList.remove('btn--ghost'); b.classList.add('btn--primary');
      var cat = b.getAttribute('data-cat');
      cards.forEach(function (c) {
        c.style.display = (!cat || c.getAttribute('data-cat') === cat) ? '' : 'none';
      });
    });
  });
  // Ленивая подгрузка плеера по клику (мобильная производительность - не грузим N iframe сразу).
  document.querySelectorAll('.concert-facade').forEach(function (fac) {
    fac.addEventListener('click', function () {
      var url = fac.getAttribute('data-embed');
      if (!url) return;
      // Параметр автозапуска зависит от хоста: RuTube - autoStart=true, VK Video - autoplay=1.
      var ap = /rutube\.ru/i.test(url) ? 'autoStart=true' : 'autoplay=1';
      var glue = url.indexOf('?') === -1 ? '?' : '&';
      var ifr = document.createElement('iframe');
      ifr.src = url + glue + ap;
      ifr.loading = 'lazy';
      ifr.setAttribute('allow', 'autoplay; encrypted-media; fullscreen; picture-in-picture');
      ifr.setAttribute('allowfullscreen', '');
      ifr.title = fac.getAttribute('aria-label') || '';
      fac.parentNode.replaceChild(ifr, fac);
    });
  });

  // Кнопки «Поделиться» ([data-share]) обрабатываются глобально в partials/popups.php.
})();
</script>
<?php else: ?>
<section class="section">
  <div class="container" style="text-align:center;max-width:520px">
    <div class="reveal">
      <div class="concert-empty"><span style="width:34px;height:34px"><?= $icoSoon ?></span></div>
      <h2>Скоро</h2>
      <p style="color:var(--muted)">Видеозаписи гала-концертов и творческих вечеров появятся здесь в ближайшее время. Анонсы публикуются во «ВКонтакте» и на портале «PRO.Культура.РФ».</p>
      <div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap;margin-top:6px">
        <a class="btn btn--primary" href="<?= h(cfgv('org_vk')) ?>" target="_blank" rel="noopener">Сообщество во «ВКонтакте»</a>
        <a class="btn btn--ghost" href="<?= url('/') ?>">На главную</a>
      </div>
    </div>
  </div>
</section>
<?php endif; ?>
<?php
$content = ob_get_clean();
render_page('Онлайн-концерты', $content, ['active' => '/concerts', 'meta' => 'Онлайн-гала-концерты КЦ «Музыкальный Мир»: видеозаписи творческих вечеров и концертных программ лауреатов конкурсов.']);
