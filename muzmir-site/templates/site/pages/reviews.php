<?php
/** Отзывы: премиум-лента опубликованных отзывов с ответами Оргкомитета + форма (для авторизованных). */
$perPage = 6;
$pageNo = max(1, (int) input('page', '1'));
$total = (int) scalar("SELECT COUNT(*) FROM reviews WHERE status='published'");
$pagesTotal = max(1, (int) ceil($total / $perPage));
$pageNo = min($pageNo, $pagesTotal);
$reviews = all("SELECT * FROM reviews WHERE status='published' ORDER BY created_at DESC LIMIT ? OFFSET ?",
    [$perPage, ($pageNo - 1) * $perPage]);

$u = current_user();

/* Сводная инфографика по всем опубликованным отзывам (только чтение, выборки страницы не меняем). */
$avgRating = $total ? round((float) scalar("SELECT AVG(rating) FROM reviews WHERE status='published'"), 1) : 0.0;
$dist = [5 => 0, 4 => 0, 3 => 0, 2 => 0, 1 => 0];
if ($total) {
    foreach (all("SELECT rating, COUNT(*) AS c FROM reviews WHERE status='published' GROUP BY rating") as $dr) {
        $rt = max(1, min(5, (int) $dr['rating']));
        $dist[$rt] = (int) $dr['c'];
    }
}

/* Инициалы автора для аватара-медальона. */
$initialsOf = static function (string $name): string {
    $name = trim($name);
    if ($name === '') return 'У';
    $parts = preg_split('/\s+/u', $name) ?: [];
    $s = mb_substr($parts[0] ?? '', 0, 1, 'UTF-8');
    if (count($parts) > 1) $s .= mb_substr($parts[count($parts) - 1], 0, 1, 'UTF-8');
    return mb_strtoupper($s, 'UTF-8');
};

/* SVG-рейтинг: 5 звёзд, заполнено по оценке (без эмодзи, только вектор). */
$starRow = static function (int $rating): string {
    $rating = max(1, min(5, $rating));
    $out = '<span class="rv-stars" role="img" aria-label="Оценка ' . $rating . ' из 5">';
    for ($i = 1; $i <= 5; $i++) {
        $on = $i <= $rating ? ' is-on' : '';
        $out .= '<svg class="rv-star' . $on . '" viewBox="0 0 24 24" aria-hidden="true">'
              . '<path d="M12 2.5l2.9 6.05 6.6.86-4.85 4.55 1.24 6.54L12 17.9l-5.89 3.1 1.24-6.54L2.5 9.41l6.6-.86z"/></svg>';
    }
    return $out . '</span>';
};

/* Определяем международную географию по тексту отзыва (в таблице нет колонки страны). */
$geoMap = [
    'серб' => 'Сербия', 'serbia' => 'Сербия', 'белград' => 'Сербия',
    'казахстан' => 'Казахстан', 'алматы' => 'Казахстан', 'астан' => 'Казахстан',
    'беларус' => 'Беларусь', 'минск' => 'Беларусь',
    'узбекистан' => 'Узбекистан', 'ташкент' => 'Узбекистан',
    'киргиз' => 'Киргизия', 'кыргыз' => 'Киргизия',
    'армени' => 'Армения', 'ереван' => 'Армения',
    'молдов' => 'Молдова', 'украин' => 'Украина',
];
$geoOf = static function (array $r) use ($geoMap): string {
    $s = mb_strtolower(($r['author'] ?? '') . ' ' . ($r['text'] ?? ''), 'UTF-8');
    foreach ($geoMap as $key => $label) {
        if (mb_strpos($s, $key, 0, 'UTF-8') !== false) return $label;
    }
    return '';
};
$hasIntl = false;
foreach ($reviews as $r) {
    if ($geoOf($r) !== '') { $hasIntl = true; break; }
}

ob_start(); ?>
<style>
.rv-stars{display:inline-flex;gap:2px;line-height:0}
.rv-star{width:18px;height:18px;fill:var(--glass-brd)}
.rv-star.is-on{fill:var(--gold)}
/* Сводная инфографика */
.rv-summary{display:grid;grid-template-columns:auto 1fr;gap:28px;align-items:center;margin-bottom:26px;position:relative;overflow:hidden}
.rv-summary::after{content:"";position:absolute;right:-40px;top:-40px;width:180px;height:180px;border-radius:50%;background:radial-gradient(circle,var(--gold-soft),transparent 70%);pointer-events:none}
.rv-sum-score{text-align:center;padding-right:28px;border-right:1px solid var(--line);position:relative;z-index:1}
.rv-sum-num{font-family:var(--ff-display);font-size:3.4rem;line-height:1;font-weight:800;background:var(--grad-gold-text);-webkit-background-clip:text;background-clip:text;color:transparent}
.rv-sum-score .rv-stars{margin:8px 0 6px}
.rv-sum-total{font-size:.82rem;color:var(--muted)}
.rv-sum-bars{display:flex;flex-direction:column;gap:7px;position:relative;z-index:1}
.rv-bar-row{display:flex;align-items:center;gap:10px;font-size:.82rem}
.rv-bar-row .lbl{display:inline-flex;align-items:center;gap:3px;color:var(--muted);min-width:38px;font-weight:700}
.rv-bar-row .lbl svg{width:12px;height:12px;fill:var(--gold)}
.rv-bar-track{flex:1;height:9px;border-radius:999px;background:var(--gold-soft);overflow:hidden;border:1px solid var(--glass-brd)}
.rv-bar-fill{height:100%;border-radius:999px;background:var(--grad-gold);width:0;transition:width 1s cubic-bezier(.2,.8,.2,1)}
.rv-bar-row .val{min-width:26px;text-align:right;color:var(--text-dim);font-weight:700;font-variant-numeric:tabular-nums}
@media(max-width:520px){
  .rv-summary{grid-template-columns:1fr;gap:18px;text-align:center}
  .rv-sum-score{padding-right:0;border-right:0;border-bottom:1px solid var(--line);padding-bottom:18px}
}
.rv-card{display:flex;flex-direction:column;position:relative;overflow:hidden;background:linear-gradient(180deg,var(--panel),color-mix(in srgb,var(--panel-solid) 30%,transparent))}
.rv-card::after{content:"\201C";position:absolute;top:-18px;right:14px;font-family:var(--ff-display);font-size:6rem;line-height:1;color:var(--gold);opacity:.10;pointer-events:none}
.rv-head{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;position:relative;z-index:1}
.rv-text{font-family:var(--ff-serif);font-size:1.06rem;line-height:1.6;margin:14px 0 16px;color:var(--text);overflow-wrap:anywhere;position:relative;z-index:1}
.rv-meta{margin-top:auto;display:flex;align-items:center;gap:12px;padding-top:14px;border-top:1px solid var(--line)}
.rv-avatar{flex:none;width:44px;height:44px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-family:var(--ff-serif);font-weight:800;font-size:1rem;color:var(--gold-fg);background:var(--grad-gold);box-shadow:var(--shadow-soft)}
.rv-namewrap{min-width:0}
.rv-author{color:var(--gold-2);font-weight:700;margin:0;overflow-wrap:anywhere}
[data-theme="dark"] .rv-author{color:var(--gold)}
.rv-date{color:var(--muted);font-size:.85rem;margin:2px 0 0}
.rv-reply{margin-top:14px;padding:14px 16px;background:var(--gold-soft);border:1px solid var(--glass-brd);border-left:3px solid var(--gold);border-radius:var(--radius-sm);position:relative;z-index:1}
.rv-reply b{display:flex;align-items:center;gap:7px;margin-bottom:5px;font-size:.85rem;color:var(--gold-2)}
[data-theme="dark"] .rv-reply b{color:var(--gold)}
.rv-reply b svg{width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:2;flex:none}
.rv-reply p{margin:0;color:var(--text-dim);line-height:1.55;font-size:.94rem;overflow-wrap:anywhere}
.rv-geo{font-size:.78rem;padding:4px 10px}
.rv-toolbar{display:flex;flex-wrap:wrap;align-items:center;gap:10px;margin-bottom:24px}
.rv-toolbar .rv-chips{display:flex;flex-wrap:wrap;gap:8px}
.rv-chip{padding:8px 14px;min-height:40px;border-radius:999px;border:1.5px solid var(--glass-brd);background:var(--panel);color:var(--text-dim);font-weight:700;font-size:.88rem;cursor:pointer;display:inline-flex;align-items:center;transition:transform .18s,border-color .18s,color .18s}
.rv-chip:active{transform:scale(.96)}
.rv-chip.is-active{background:var(--grad-gold);color:#1a1206;border-color:transparent}
.rv-sort{margin-left:auto;display:flex;align-items:center;gap:8px}
.rv-sort label{font-size:.85rem;color:var(--muted)}
.rv-sort select{margin:0;padding:9px 34px 9px 14px;min-height:40px;font-size:.9rem;width:auto}
.rv-none{display:none;text-align:center;color:var(--muted);padding:26px 10px;grid-column:1/-1}
#rvGrid.rv-empty .rv-none{display:block}
/* Каскад-звёзды в форме отзыва */
.rv-rate{display:inline-flex;gap:6px;margin-bottom:8px}
.rv-rate button{background:none;border:0;padding:2px;cursor:pointer;line-height:0}
.rv-rate svg{width:30px;height:30px;fill:var(--glass-brd);transition:fill .12s,transform .12s}
.rv-rate button:active svg{transform:scale(.9)}
.rv-rate.on-0 button:nth-child(-n+0) svg,
.rv-rate.on-1 button:nth-child(-n+1) svg,
.rv-rate.on-2 button:nth-child(-n+2) svg,
.rv-rate.on-3 button:nth-child(-n+3) svg,
.rv-rate.on-4 button:nth-child(-n+4) svg,
.rv-rate.on-5 button:nth-child(-n+5) svg{fill:var(--gold)}
@media (max-width:560px){
  .rv-sort{margin-left:0;width:100%}
  .rv-sort select{flex:1}
}
.rv-pager{display:flex;justify-content:center;gap:8px;margin-top:36px;flex-wrap:wrap}
.rv-pager a{padding:9px 16px;min-height:40px;display:inline-flex;align-items:center;border-radius:999px;border:1.5px solid var(--gold);font-weight:700;font-size:.92rem;color:var(--text)}
.rv-pager a.active{background:var(--grad-gold);color:#1a1206;border-color:transparent}
</style>

<section class="section">
  <div class="container">
    <div class="section-head reveal">
      <p class="eyebrow">Отзывы</p>
      <h2>Отзывы участников</h2>
      <div class="gold-rule"></div>
    </div>

    <?php if (!$reviews): ?>
      <div class="card reveal" style="max-width:640px;margin:0 auto 40px;text-align:center">
        <p style="color:var(--text-dim);margin:0">Отзывы участников пока готовятся к публикации. Будьте первым, кто поделится впечатлениями.</p>
      </div>
    <?php else: ?>
      <div class="card rv-summary reveal">
        <div class="rv-sum-score">
          <div class="rv-sum-num"><?= h(number_format($avgRating, 1, ',', ' ')) ?></div>
          <?= $starRow((int) round($avgRating)) ?>
          <div class="rv-sum-total"><?= (int) $total ?> <?= (($total % 10 === 1 && $total % 100 !== 11) ? 'отзыв' : (($total % 10 >= 2 && $total % 10 <= 4 && ($total % 100 < 10 || $total % 100 >= 20)) ? 'отзыва' : 'отзывов')) ?></div>
        </div>
        <div class="rv-sum-bars">
          <?php for ($s = 5; $s >= 1; $s--): $pct = $total ? round($dist[$s] / $total * 100) : 0; ?>
            <div class="rv-bar-row">
              <span class="lbl"><?= $s ?><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5l2.9 6.05 6.6.86-4.85 4.55 1.24 6.54L12 17.9l-5.89 3.1 1.24-6.54L2.5 9.41l6.6-.86z"/></svg></span>
              <span class="rv-bar-track"><span class="rv-bar-fill" style="width:<?= (int) $pct ?>%"></span></span>
              <span class="val"><?= (int) $dist[$s] ?></span>
            </div>
          <?php endfor; ?>
        </div>
      </div>
      <div class="rv-toolbar reveal">
        <div class="rv-chips" role="group" aria-label="Фильтр отзывов">
          <button type="button" class="rv-chip is-active" data-filter="all">Все</button>
          <button type="button" class="rv-chip" data-filter="5">5 звёзд</button>
          <button type="button" class="rv-chip" data-filter="4">4 и выше</button>
          <?php if ($hasIntl): ?><button type="button" class="rv-chip" data-filter="intl">Международные</button><?php endif; ?>
        </div>
        <div class="rv-sort">
          <label for="rvSort">Сортировка</label>
          <select id="rvSort" aria-label="Сортировка отзывов">
            <option value="new">Сначала новые</option>
            <option value="old">Сначала старые</option>
            <option value="rating">По оценке</option>
          </select>
        </div>
      </div>

      <div class="grid grid-3" id="rvGrid">
        <?php foreach ($reviews as $i => $r):
            $rating = max(1, min(5, (int) $r['rating']));
            $geo = $geoOf($r);
            $ts = strtotime($r['created_at'] ?: 'now'); ?>
          <div class="card rv-card reveal" style="--i:<?= (int) $i ?>"
               data-rating="<?= $rating ?>" data-ts="<?= (int) $ts ?>" data-geo="<?= $geo !== '' ? 'intl' : '' ?>">
            <div class="rv-head">
              <?= $starRow($rating) ?>
              <?php if ($geo !== ''): ?><span class="badge badge--intl rv-geo"><?= h($geo) ?></span><?php endif; ?>
            </div>
            <p class="rv-text">«<?= h($r['text']) ?>»</p>
            <?php $rvName = $r['author'] ?: 'Участник конкурса'; ?>
            <div class="rv-meta">
              <span class="rv-avatar" aria-hidden="true"><?= h($initialsOf($rvName)) ?></span>
              <div class="rv-namewrap">
                <p class="rv-author"><?= h($rvName) ?></p>
                <p class="rv-date"><?= h(ru_date($r['created_at'])) ?></p>
              </div>
            </div>
            <?php if (!empty($r['admin_reply'])): ?>
              <div class="rv-reply">
                <b><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>Ответ Оргкомитета</b>
                <p><?= h($r['admin_reply']) ?></p>
              </div>
            <?php endif; ?>
          </div>
        <?php endforeach; ?>
        <p class="rv-none">Среди отзывов на этой странице нет подходящих под фильтр. Сбросьте фильтр или откройте другие страницы.</p>
      </div>

      <?php if ($pagesTotal > 1): ?>
        <div class="rv-pager reveal">
          <?php for ($p = 1; $p <= $pagesTotal; $p++): ?>
            <a href="<?= url('/reviews?page=' . $p) ?>" class="<?= $p === $pageNo ? 'active' : '' ?>"><?= $p ?></a>
          <?php endfor; ?>
        </div>
      <?php endif; ?>
    <?php endif; ?>
  </div>
</section>

<section class="section section--parchment">
  <div class="container" style="max-width:640px">
    <div class="card reveal">
      <h3>Оставить отзыв</h3>
      <?php if (!$u): ?>
        <p style="color:var(--text-dim)">Чтобы оставить отзыв, войдите в личный кабинет.</p>
        <a class="btn btn--primary" href="<?= url('/login?next=' . urlencode('/reviews')) ?>">Войти</a>
        <a class="btn btn--ghost" href="<?= url('/register') ?>">Регистрация</a>
      <?php else: ?>
        <form method="post" action="<?= url('/api/v1/review') ?>" id="rvForm">
          <?= csrf_field() ?>
          <div class="field">
            <label for="rv_rating">Оценка</label>
            <div class="rv-rate on-5" id="rvRate" role="radiogroup" aria-label="Оценка от 1 до 5">
              <?php for ($s = 1; $s <= 5; $s++): ?>
                <button type="button" data-val="<?= $s ?>" role="radio" aria-label="<?= $s ?> из 5" aria-checked="<?= $s === 5 ? 'true' : 'false' ?>">
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.5l2.9 6.05 6.6.86-4.85 4.55 1.24 6.54L12 17.9l-5.89 3.1 1.24-6.54L2.5 9.41l6.6-.86z"/></svg>
                </button>
              <?php endfor; ?>
            </div>
            <select id="rv_rating" name="rating" required style="position:absolute;width:1px;height:1px;opacity:0;pointer-events:none" tabindex="-1" aria-hidden="true">
              <option value="5" selected>5</option><option value="4">4</option><option value="3">3</option><option value="2">2</option><option value="1">1</option>
            </select>
          </div>
          <div class="field">
            <label for="rv_text">Ваш отзыв</label>
            <textarea id="rv_text" name="text" rows="5" required></textarea>
            <p class="hint">Отзыв публикуется после проверки Оргкомитетом.</p>
          </div>
          <button class="btn btn--primary btn--block" type="submit">Отправить отзыв</button>
        </form>
      <?php endif; ?>
    </div>
  </div>
</section>

<?php if ($reviews): ?>
<script>
(function () {
  var grid = document.getElementById('rvGrid');
  if (!grid) return;
  var cards = Array.prototype.slice.call(grid.querySelectorAll('.rv-card'));
  var chips = Array.prototype.slice.call(document.querySelectorAll('.rv-chip'));
  var sortSel = document.getElementById('rvSort');
  var none = grid.querySelector('.rv-none');
  var filter = 'all';

  function passes(c) {
    var r = +c.getAttribute('data-rating');
    if (filter === 'intl') return c.getAttribute('data-geo') === 'intl';
    if (filter === '5') return r === 5;
    if (filter === '4') return r >= 4;
    return true;
  }

  function apply() {
    var mode = sortSel ? sortSel.value : 'new';
    var ordered = cards.slice().sort(function (a, b) {
      if (mode === 'rating') return (+b.getAttribute('data-rating')) - (+a.getAttribute('data-rating')) || (+b.getAttribute('data-ts')) - (+a.getAttribute('data-ts'));
      if (mode === 'old') return (+a.getAttribute('data-ts')) - (+b.getAttribute('data-ts'));
      return (+b.getAttribute('data-ts')) - (+a.getAttribute('data-ts'));
    });
    var shown = 0;
    ordered.forEach(function (c) {
      var vis = passes(c);
      c.style.display = vis ? '' : 'none';
      if (vis) grid.insertBefore(c, none);
      if (vis) shown++;
    });
    grid.classList.toggle('rv-empty', shown === 0);
  }

  chips.forEach(function (c) {
    c.addEventListener('click', function () {
      chips.forEach(function (x) { x.classList.remove('is-active'); });
      c.classList.add('is-active');
      filter = c.getAttribute('data-filter');
      apply();
    });
  });
  if (sortSel) sortSel.addEventListener('change', apply);

  /* Звёздный ввод в форме */
  var rate = document.getElementById('rvRate');
  var rateSel = document.getElementById('rv_rating');
  if (rate && rateSel) {
    var btns = Array.prototype.slice.call(rate.querySelectorAll('button'));
    function setVal(v) {
      rate.className = 'rv-rate on-' + v;
      rateSel.value = String(v);
      btns.forEach(function (b) { b.setAttribute('aria-checked', +b.getAttribute('data-val') === v ? 'true' : 'false'); });
    }
    btns.forEach(function (b) {
      b.addEventListener('click', function () { setVal(+b.getAttribute('data-val')); });
      b.addEventListener('mouseenter', function () { rate.className = 'rv-rate on-' + b.getAttribute('data-val'); });
    });
    rate.addEventListener('mouseleave', function () { setVal(+rateSel.value); });
  }

  /* Тост-подтверждение отправки формы */
  var form = document.getElementById('rvForm');
  if (form) {
    form.addEventListener('submit', function () {
      if (typeof window.toast === 'function') window.toast('Спасибо! Отзыв отправлен на проверку Оргкомитету.', 'success');
    });
  }
})();
</script>
<?php endif; ?>
<?php
$content = ob_get_clean();
render_page('Отзывы', $content, ['active' => '/reviews', 'meta' => 'Отзывы участников конкурсов Культурного центра «Музыкальный Мир» и ответы Оргкомитета.']);
