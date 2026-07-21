<?php
/** Видеогалерея онлайн-концертов. */
$concerts = all("SELECT * FROM concerts ORDER BY sort DESC, date DESC");
$categories = [];
foreach ($concerts as $c) { if ($c['category'] !== '') $categories[$c['category']] = true; }
$categories = array_keys($categories);

$icoPlay = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="12" r="10"/><path d="M10 8l6 4-6 4z" fill="currentColor" stroke="none"/></svg>';
$icoSoon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>';

ob_start(); ?>
<section class="section section--parchment">
  <div class="container">
    <div class="section-head reveal">
      <p class="eyebrow">Смотрите</p>
      <h2>Онлайн-концерты</h2>
      <p>Записи концертных программ и творческих вечеров КЦ «Музыкальный Мир».</p>
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
        <div class="card concert-card reveal" data-cat="<?= h($c['category']) ?>" style="padding:0;overflow:hidden">
          <div class="concert-embed">
            <?php if ($c['embed_url']): ?>
              <iframe src="<?= h($c['embed_url']) ?>" loading="lazy" allow="autoplay; encrypted-media" allowfullscreen title="<?= h($c['title']) ?>"></iframe>
            <?php else: ?>
              <div class="concert-embed-stub"><span style="width:40px;height:40px"><?= $icoPlay ?></span></div>
            <?php endif; ?>
          </div>
          <div style="padding:20px">
            <?php if ($c['category']): ?><span class="badge badge--intl"><?= h($c['category']) ?></span><?php endif; ?>
            <h3 style="margin-top:10px"><?= h($c['title']) ?></h3>
            <?php if ($c['date']): ?><p style="color:var(--muted);margin:0"><?= h(ru_date($c['date'])) ?></p><?php endif; ?>
          </div>
        </div>
      <?php endforeach; ?>
    </div>
  </div>
</section>
<script>
(function () {
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
})();
</script>
<style>
.concert-embed{position:relative;width:100%;aspect-ratio:16/9;background:#0e0c10}
.concert-embed iframe{position:absolute;inset:0;width:100%;height:100%;border:0}
.concert-embed-stub{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:rgba(255,255,255,.5)}
</style>
<?php else: ?>
<section class="section">
  <div class="container" style="text-align:center;max-width:520px">
    <div class="reveal">
      <div style="width:74px;height:74px;margin:0 auto 20px;border-radius:50%;background:var(--gold-soft);color:var(--gold);border:1px solid var(--glass-brd);
                  display:flex;align-items:center;justify-content:center"><span style="width:34px;height:34px"><?= $icoSoon ?></span></div>
      <h2>Скоро</h2>
      <p style="color:var(--muted)">Видеозаписи концертных программ появятся здесь в ближайшее время.</p>
      <a class="btn btn--ghost" href="<?= url('/') ?>">На главную</a>
    </div>
  </div>
</section>
<?php endif; ?>
<?php
$content = ob_get_clean();
render_page('Онлайн-концерты', $content, ['active' => '/concerts', 'meta' => 'Видеозаписи онлайн-концертов КЦ «Музыкальный Мир»: творческие вечера и концертные программы.']);
