<?php
/** Онлайн-гала-концерты: премиум-видеогалерея (RuTube), фильтры по категориям, привязка к PRO.Культура.РФ. */
$concerts = all("SELECT * FROM concerts ORDER BY sort DESC, date DESC");
$categories = [];
foreach ($concerts as $c) { if ($c['category'] !== '') $categories[$c['category']] = true; }
$categories = array_keys($categories);

$icoPlay = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"><path d="M8 6.5v11l9-5.5z" fill="currentColor" stroke="none"/></svg>';
$icoSoon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>';
$icoInfo = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 11v5"/><path d="M12 8h.01"/></svg>';

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
      <button type="button" class="btn btn--primary concert-filter" data-cat="">Все</button>
      <?php foreach ($categories as $cat): ?>
        <button type="button" class="btn btn--ghost concert-filter" data-cat="<?= h($cat) ?>"><?= h($cat) ?></button>
      <?php endforeach; ?>
    </div>
    <?php endif; ?>

    <div class="grid grid-3" id="concertGrid">
      <?php foreach ($concerts as $c): ?>
        <div class="card concert-card reveal" data-cat="<?= h($c['category']) ?>">
          <div class="concert-embed">
            <?php if ($c['embed_url']): ?>
              <button type="button" class="concert-facade" data-embed="<?= h($c['embed_url']) ?>"
                      aria-label="Смотреть: <?= h($c['title']) ?>"
                      <?php if ($c['cover']): ?>style="background-image:url('<?= h($c['cover']) ?>')"<?php endif; ?>>
                <span class="play"><span><?= $icoPlay ?></span></span>
              </button>
            <?php else: ?>
              <div class="concert-embed-stub"><span style="width:40px;height:40px"><?= $icoPlay ?></span></div>
            <?php endif; ?>
          </div>
          <div class="concert-body">
            <?php if ($c['category']): ?><span class="badge badge--intl"><?= h($c['category']) ?></span><?php endif; ?>
            <h3><?= h($c['title']) ?></h3>
            <?php if ($c['date']): ?><p style="color:var(--muted);margin:6px 0 0"><?= h(ru_date($c['date'])) ?></p><?php endif; ?>
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
      var glue = url.indexOf('?') === -1 ? '?' : '&';
      var ifr = document.createElement('iframe');
      ifr.src = url + glue + 'autoplay=1';
      ifr.loading = 'lazy';
      ifr.setAttribute('allow', 'autoplay; encrypted-media; fullscreen; picture-in-picture');
      ifr.setAttribute('allowfullscreen', '');
      ifr.title = fac.getAttribute('aria-label') || '';
      fac.parentNode.replaceChild(ifr, fac);
    });
  });
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
