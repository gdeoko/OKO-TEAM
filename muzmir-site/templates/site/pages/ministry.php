<?php
/** Поддержка министерства: галерея сканов из ministry_letters, фильтр по региону, lightbox. */
$letters = all("SELECT * FROM ministry_letters ORDER BY sort, id");
$regions = [];
foreach ($letters as $l) {
    if ($l['region'] !== '' && !in_array($l['region'], $regions, true)) $regions[] = $l['region'];
}
sort($regions, SORT_STRING | SORT_FLAG_CASE);

function ml_img_url(string $path): string {
    if ($path === '') return asset('img/logo_muzmir_main.webp');
    return str_starts_with($path, 'http') ? $path : url(ltrim($path, '/'));
}

ob_start(); ?>
<style>
.mg-filters{display:flex;gap:10px;flex-wrap:wrap;justify-content:center;margin-bottom:32px}
.mg-filter{padding:9px 18px;font-size:.9rem}
.mg-filter.active{background:var(--grad-gold);color:#fff;border-color:transparent}
.mg-item{padding:0;overflow:hidden;cursor:pointer}
.mg-item img{aspect-ratio:3/4;object-fit:cover;width:100%}
.mg-item .mg-cap{padding:14px 16px}
.mg-item .mg-cap b{display:block;font-size:.92rem}
.mg-item .mg-cap span{font-size:.82rem;color:var(--muted)}
.mg-lightbox{display:none;position:fixed;inset:0;background:rgba(27,35,64,.92);z-index:80;
  align-items:center;justify-content:center;padding:32px}
.mg-lightbox img{max-width:min(880px,92vw);max-height:88vh;border-radius:12px;box-shadow:0 20px 60px rgba(0,0,0,.4)}
.mg-close{position:absolute;top:22px;right:26px;width:44px;height:44px;border-radius:50%;
  background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.3);color:#fff;cursor:pointer;
  display:flex;align-items:center;justify-content:center}
.mg-close svg{width:20px;height:20px}
</style>

<section class="section">
  <div class="container">
    <div class="section-head reveal">
      <p class="eyebrow">Информационная поддержка</p>
      <h2>Поддержка министерства</h2>
      <div class="gold-rule"></div>
      <p>Министерства культуры и образования субъектов Российской Федерации оказывают Культурному центру «Музыкальный Мир» информационную поддержку. Ниже собраны официальные письма и благодарности по регионам.</p>
    </div>

    <?php if (!$letters): ?>
      <div class="card reveal" style="max-width:640px;margin:0 auto;text-align:center">
        <p style="color:var(--ink);margin:0">Скан-копии писем и благодарностей от министерств культуры и образования регионов готовятся к публикации. Раздел будет дополнен по мере поступления документов.</p>
      </div>
    <?php else: ?>
      <?php if ($regions): ?>
        <div class="mg-filters reveal">
          <button class="btn btn--ghost mg-filter active" data-region="all" type="button">Все регионы</button>
          <?php foreach ($regions as $r): ?>
            <button class="btn btn--ghost mg-filter" data-region="<?= h($r) ?>" type="button"><?= h($r) ?></button>
          <?php endforeach; ?>
        </div>
      <?php endif; ?>

      <div class="grid grid-4 mg-gallery">
        <?php foreach ($letters as $l): ?>
          <div class="card reveal mg-item" data-region="<?= h($l['region']) ?>"
               onclick="mgOpen('<?= h(ml_img_url($l['image_path'])) ?>','<?= h($l['title'] ?: $l['region']) ?>')">
            <img src="<?= h(ml_img_url($l['image_path'])) ?>" alt="<?= h($l['title'] ?: 'Письмо о поддержке, ' . $l['region']) ?>" loading="lazy">
            <div class="mg-cap">
              <b><?= h($l['title'] ?: 'Письмо о поддержке') ?></b>
              <?php if ($l['region']): ?><span><?= h($l['region']) ?></span><?php endif; ?>
            </div>
          </div>
        <?php endforeach; ?>
      </div>
    <?php endif; ?>
  </div>
</section>

<div class="mg-lightbox" id="mgLightbox">
  <button class="mg-close" id="mgClose" type="button" aria-label="Закрыть">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
  </button>
  <img id="mgLightboxImg" src="" alt="">
</div>

<script>
(function () {
  var chips = document.querySelectorAll('.mg-filter');
  var items = document.querySelectorAll('.mg-item');
  chips.forEach(function (c) {
    c.addEventListener('click', function () {
      chips.forEach(function (x) { x.classList.remove('active'); });
      c.classList.add('active');
      var r = c.getAttribute('data-region');
      items.forEach(function (it) {
        it.style.display = (r === 'all' || it.getAttribute('data-region') === r) ? '' : 'none';
      });
    });
  });

  var lb = document.getElementById('mgLightbox');
  var lbImg = document.getElementById('mgLightboxImg');
  var closeBtn = document.getElementById('mgClose');

  window.mgOpen = function (src, title) {
    if (!lb || !lbImg) return;
    lbImg.src = src;
    lbImg.alt = title || '';
    lb.style.display = 'flex';
  };
  function closeLb() { if (lb) lb.style.display = 'none'; }
  if (closeBtn) closeBtn.addEventListener('click', closeLb);
  if (lb) lb.addEventListener('click', function (e) { if (e.target === lb) closeLb(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeLb(); });
})();
</script>
<?php
$content = ob_get_clean();
render_page('Поддержка министерства', $content, ['active' => '/ministry-support', 'meta' => 'Официальные письма и благодарности министерств культуры и образования регионов России в поддержку Культурного центра «Музыкальный Мир».']);
