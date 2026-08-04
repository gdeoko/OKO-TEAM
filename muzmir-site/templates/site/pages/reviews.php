<?php
/** Отзывы: форма «Оставить отзыв» сверху + вертикальная лента опубликованных отзывов
 *  с ответами Оргкомитета (последние 5 + «Показать ещё», сортировка). */
$total = (int) scalar("SELECT COUNT(*) FROM reviews WHERE status='published'");
$reviews = all("SELECT * FROM reviews WHERE status='published' ORDER BY created_at DESC");

$u = current_user();

$avgRating = $total ? round((float) scalar("SELECT AVG(rating) FROM reviews WHERE status='published'"), 1) : 0.0;

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

$plural = static function (int $n): string {
    if ($n % 10 === 1 && $n % 100 !== 11) return 'отзыв';
    if ($n % 10 >= 2 && $n % 10 <= 4 && ($n % 100 < 10 || $n % 100 >= 20)) return 'отзыва';
    return 'отзывов';
};

ob_start(); ?>
<style>
.rv-stars{display:inline-flex;gap:2px;line-height:0}
.rv-star{width:20px;height:20px;fill:var(--glass-brd)}
.rv-star.is-on{fill:var(--gold);filter:drop-shadow(0 1px 3px rgba(199,147,34,.35))}
/* Компактная шапка раздела */
.rv-head-bar{display:flex;align-items:baseline;justify-content:space-between;gap:12px 18px;flex-wrap:wrap;margin-bottom:18px}
.rv-head-bar h2{margin:0;font-family:var(--ff-display);word-break:normal;hyphens:none}
.rv-head-sub{color:var(--muted);font-size:.9rem;display:inline-flex;align-items:center;gap:8px}
.rv-head-sub .rv-stars{transform:translateY(2px)}
.rv-head-sub .rv-star{width:14px;height:14px}
/* --- Форма «Оставить отзыв» (сверху, компактная, стеклянная) --- */
.rv-form-card{max-width:640px;margin:0 auto 34px;padding:24px 26px;border-radius:18px;
  background:var(--glass-card);backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px);
  border:1px solid color-mix(in srgb,var(--gold) 34%,transparent);
  box-shadow:0 10px 30px rgba(199,147,34,.08)}
.rv-form-card h3{display:flex;align-items:center;gap:10px;margin:0 0 14px;word-break:normal;hyphens:none}
.rv-form-card h3 svg{width:20px;height:20px;flex:none;color:var(--gold);fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
.rv-form-card .field{margin-bottom:14px}
.rv-form-card .hint{font-size:.8rem}
.rv-login{display:flex;align-items:center;gap:12px;flex-wrap:wrap}
.rv-login p{margin:0;color:var(--muted);flex:1 1 220px}
@media(max-width:560px){.rv-form-card{padding:18px 16px}}
/* Каскад-звёзды в форме отзыва */
.rv-rate{display:inline-flex;gap:6px;margin-bottom:6px}
.rv-rate button{background:none;border:0;padding:2px;cursor:pointer;line-height:0}
.rv-rate svg{width:32px;height:32px;fill:var(--glass-brd);transition:fill .12s,transform .12s}
.rv-rate button:hover svg{transform:scale(1.12)}
.rv-rate button:active svg{transform:scale(.9)}
.rv-rate.on-1 button:nth-child(-n+1) svg,
.rv-rate.on-2 button:nth-child(-n+2) svg,
.rv-rate.on-3 button:nth-child(-n+3) svg,
.rv-rate.on-4 button:nth-child(-n+4) svg,
.rv-rate.on-5 button:nth-child(-n+5) svg{fill:var(--gold);filter:drop-shadow(0 1px 4px rgba(199,147,34,.4))}
/* Панель сортировки */
.rv-toolbar{display:flex;align-items:center;justify-content:flex-end;gap:8px;margin-bottom:20px;max-width:760px;margin-left:auto;margin-right:auto}
.rv-toolbar label{font-size:.85rem;color:var(--muted)}
.rv-toolbar select{margin:0;padding:9px 34px 9px 14px;min-height:40px;font-size:.9rem;width:auto;border-radius:12px;
  background:var(--glass-card);backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px);
  border:1px solid var(--glass-brd2);color:var(--text)}
/* Вертикальный список */
.rv-list{display:flex;flex-direction:column;gap:20px;max-width:760px;margin:0 auto}
.rv-card{display:flex;flex-direction:column;position:relative;overflow:hidden;
  background:var(--glass-card);backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px);
  border:1px solid color-mix(in srgb,var(--gold) 30%,transparent);border-radius:18px;padding:22px 24px;
  word-break:normal;hyphens:none;
  transition:transform .25s ease,box-shadow .25s ease,border-color .25s ease}
.rv-card:hover{transform:translateY(-3px);border-color:color-mix(in srgb,var(--gold) 60%,transparent);
  box-shadow:0 12px 30px rgba(199,147,34,.13)}
.rv-card::before{content:"";position:absolute;inset:0 0 auto 0;height:2px;
  background:linear-gradient(90deg,transparent,var(--gold),transparent);opacity:.55;pointer-events:none}
.rv-card::after{content:"\201C";position:absolute;top:-18px;right:14px;font-family:var(--ff-display);font-size:6rem;line-height:1;color:var(--gold);opacity:.10;pointer-events:none}
.rv-card.rv-hidden{display:none}
.rv-card.rv-in{animation:rvIn .45s cubic-bezier(.2,.8,.2,1)}
@keyframes rvIn{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
@media(prefers-reduced-motion:reduce){
  .rv-card.rv-in{animation:none}
  .rv-card,.rv-rate svg{transition:none}
}
.rv-top{display:flex;align-items:center;gap:12px;position:relative;z-index:1}
.rv-avatar{flex:none;width:48px;height:48px;border-radius:50%;display:flex;align-items:center;justify-content:center;
  font-family:var(--ff-display);font-weight:800;font-size:1.05rem;color:#fff;background:var(--grad-gold);
  box-shadow:0 4px 12px rgba(199,147,34,.3);border:2px solid color-mix(in srgb,var(--gold) 55%,transparent)}
.rv-namewrap{min-width:0}
.rv-author{color:var(--royal);font-weight:700;margin:0;overflow-wrap:anywhere}
[data-theme="dark"] .rv-author{color:var(--gold)}
.rv-date{display:inline-flex;align-items:center;gap:5px;color:var(--muted);font-size:.82rem;margin:3px 0 0}
.rv-date svg{width:13px;height:13px;flex:none;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round;opacity:.8}
.rv-top .rv-stars{margin-left:auto;flex:none}
.rv-text{font-family:var(--ff-body);font-size:1.02rem;line-height:1.6;margin:14px 0 0;color:var(--text);overflow-wrap:anywhere;word-break:normal;hyphens:none;position:relative;z-index:1}
.rv-reply{margin-top:14px;padding:14px 16px;background:color-mix(in srgb,var(--gold) 8%,transparent);border:1px solid var(--glass-brd2);border-left:3px solid var(--gold);border-radius:12px;position:relative;z-index:1}
.rv-reply b{display:flex;align-items:center;gap:7px;margin-bottom:5px;font-size:.85rem;color:var(--royal)}
[data-theme="dark"] .rv-reply b{color:var(--gold)}
.rv-reply b svg{width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:2;flex:none}
.rv-reply p{margin:0;color:var(--muted);line-height:1.55;font-size:.94rem;overflow-wrap:anywhere;word-break:normal;hyphens:none}
/* Кнопка «Показать ещё» */
.rv-more-wrap{display:flex;justify-content:center;margin:26px auto 0;max-width:760px}
.rv-more{display:inline-flex;align-items:center;gap:9px;padding:12px 26px;min-height:46px;border-radius:999px;cursor:pointer;
  background:var(--glass-card);backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px);
  border:1px solid var(--glass-brd2);color:var(--text);font-weight:700;font-size:.95rem;font-family:var(--ff-body);
  transition:transform .18s,border-color .18s,color .18s}
.rv-more svg{width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:2.2;stroke-linecap:round;stroke-linejoin:round;transition:transform .18s}
.rv-more:hover{border-color:var(--gold);color:var(--royal)}
[data-theme="dark"] .rv-more:hover{color:var(--gold)}
.rv-more:hover svg{transform:translateY(2px)}
.rv-more:active{transform:scale(.97)}
.rv-more.rv-done{display:none}
@media(max-width:560px){
  .rv-toolbar{justify-content:flex-start}
  .rv-card{padding:18px 16px}
}
</style>

<section class="section">
  <div class="container">
    <a class="aw-back" href="<?= url('/menu') ?>"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M11 6l-6 6 6 6"/></svg>Назад</a>

    <div class="rv-head-bar reveal">
      <h2>Отзывы участников</h2>
      <?php if ($total): ?>
        <span class="rv-head-sub"><?= $starRow((int) round($avgRating)) ?><?= h(number_format($avgRating, 1, ',', ' ')) ?> из 5 &middot; <?= (int) $total ?> <?= $plural($total) ?></span>
      <?php endif; ?>
    </div>

    <div class="rv-form-card reveal">
      <h3><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>Оставить отзыв</h3>
      <?php if (!$u): ?>
        <div class="rv-login">
          <p>Чтобы оставить отзыв, войдите в личный кабинет.</p>
          <a class="btn btn--primary" href="<?= url('/login?next=' . urlencode('/reviews')) ?>">Войти</a>
          <a class="btn btn--ghost" href="<?= url('/register') ?>">Регистрация</a>
        </div>
      <?php else: ?>
        <form method="post" action="<?= url('/api/v1/review') ?>" id="rvForm">
          <?= csrf_field() ?>
          <div class="field">
            <label for="rv_author">Ваше имя</label>
            <input type="text" id="rv_author" name="author" value="<?= h($u['full_name'] ?? '') ?>" placeholder="Иванова Мария Петровна" required>
          </div>
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
            <textarea id="rv_text" name="text" rows="4" required placeholder="Поделитесь впечатлениями об участии в конкурсе"></textarea>
            <p class="hint">Отзыв публикуется после проверки Оргкомитетом.</p>
          </div>
          <button class="btn btn--primary btn--block" type="submit" id="rvSubmit">Отправить отзыв</button>
          <p class="hint" id="rvMsg" style="margin-top:10px"></p>
        </form>
      <?php endif; ?>
    </div>

    <?php if (!$reviews): ?>
      <div class="card reveal" style="max-width:640px;margin:0 auto 40px;text-align:center">
        <p style="color:var(--muted);margin:0">Отзывы участников пока готовятся к публикации. Будьте первым, кто поделится впечатлениями.</p>
      </div>
    <?php else: ?>
      <div class="rv-toolbar reveal">
        <label for="rvSort">Сортировка</label>
        <select id="rvSort" aria-label="Сортировка отзывов">
          <option value="new">Сначала новые</option>
          <option value="old">Сначала старые</option>
        </select>
      </div>

      <div class="rv-list" id="rvList" aria-label="Лента отзывов">
        <?php foreach ($reviews as $i => $r):
            $rating = max(1, min(5, (int) $r['rating']));
            $ts = strtotime($r['created_at'] ?: 'now');
            $rvName = $r['author'] ?: 'Участник конкурса'; ?>
          <article class="rv-card<?= $i >= 5 ? ' rv-hidden' : ' reveal' ?>" data-ts="<?= (int) $ts ?>"<?= $i < 5 ? ' style="--i:' . (int) $i . '"' : '' ?>>
            <div class="rv-top">
              <span class="rv-avatar" role="img" aria-label="Аватар: <?= h($rvName) ?>"><?= h($initialsOf($rvName)) ?></span>
              <div class="rv-namewrap">
                <p class="rv-author"><?= h($rvName) ?></p>
                <p class="rv-date"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M8 3v4M16 3v4M3 10h18"/></svg><?= h(ru_date($r['created_at'])) ?></p>
              </div>
              <?= $starRow($rating) ?>
            </div>
            <p class="rv-text">«<?= h($r['text']) ?>»</p>
            <?php if (!empty($r['admin_reply'])): ?>
              <div class="rv-reply">
                <b><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>Ответ Оргкомитета</b>
                <p><?= h($r['admin_reply']) ?></p>
              </div>
            <?php endif; ?>
          </article>
        <?php endforeach; ?>
      </div>

      <?php if (count($reviews) > 5): ?>
        <div class="rv-more-wrap">
          <button type="button" class="rv-more" id="rvMore">
            Показать ещё
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M6 13l6 6 6-6"/></svg>
          </button>
        </div>
      <?php endif; ?>
    <?php endif; ?>
  </div>
</section>

<script>
(function () {
  var list = document.getElementById('rvList');
  if (list) {
    var cards = Array.prototype.slice.call(list.querySelectorAll('.rv-card'));
    var moreBtn = document.getElementById('rvMore');
    var sortSel = document.getElementById('rvSort');
    var PAGE = 5;
    var shown = Math.min(PAGE, cards.length);

    var render = function (animateFrom) {
      var mode = sortSel ? sortSel.value : 'new';
      var ordered = cards.slice().sort(function (a, b) {
        var d = (+a.getAttribute('data-ts')) - (+b.getAttribute('data-ts'));
        return mode === 'old' ? d : -d;
      });
      ordered.forEach(function (c, i) {
        list.appendChild(c);
        var vis = i < shown;
        c.classList.toggle('rv-hidden', !vis);
        c.classList.toggle('rv-in', vis && typeof animateFrom === 'number' && i >= animateFrom);
      });
      if (moreBtn) moreBtn.classList.toggle('rv-done', shown >= cards.length);
    };

    if (moreBtn) {
      moreBtn.addEventListener('click', function () {
        var from = shown;
        shown = Math.min(shown + PAGE, cards.length);
        render(from);
      });
    }
    if (sortSel) {
      sortSel.addEventListener('change', function () {
        shown = Math.min(PAGE, cards.length);
        render();
        list.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }
  }

  /* Звёздный ввод в форме */
  var rate = document.getElementById('rvRate');
  var rateSel = document.getElementById('rv_rating');
  if (rate && rateSel) {
    var btns = Array.prototype.slice.call(rate.querySelectorAll('button'));
    var setVal = function (v) {
      rate.className = 'rv-rate on-' + v;
      rateSel.value = String(v);
      btns.forEach(function (b) { b.setAttribute('aria-checked', +b.getAttribute('data-val') === v ? 'true' : 'false'); });
    };
    btns.forEach(function (b) {
      b.addEventListener('click', function () { setVal(+b.getAttribute('data-val')); });
      b.addEventListener('mouseenter', function () { rate.className = 'rv-rate on-' + b.getAttribute('data-val'); });
    });
    rate.addEventListener('mouseleave', function () { setVal(+rateSel.value); });
  }

  /* Отправка формы без перезагрузки страницы (фолбэк - обычный POST). */
  var form = document.getElementById('rvForm');
  if (form && window.fetch && window.FormData) {
    var sbtn = document.getElementById('rvSubmit');
    var msg = document.getElementById('rvMsg');
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (sbtn) sbtn.disabled = true;
      if (msg) msg.textContent = 'Отправляем...';
      fetch(form.action, { method: 'POST', body: new FormData(form), credentials: 'same-origin' })
        .then(function (r) { return r.json(); })
        .then(function (d) {
          if (sbtn) sbtn.disabled = false;
          if (!d.ok) { if (msg) msg.textContent = d.error || 'Не удалось отправить отзыв.'; return; }
          if (msg) msg.textContent = 'Спасибо! Отзыв отправлен на проверку Оргкомитету.';
          var ta = document.getElementById('rv_text');
          if (ta) ta.value = '';
          if (typeof window.toast === 'function') window.toast('Спасибо! Отзыв отправлен на проверку Оргкомитету.', 'success');
        })
        .catch(function () {
          if (sbtn) sbtn.disabled = false;
          if (msg) msg.textContent = 'Не удалось отправить отзыв, проверьте соединение.';
        });
    });
  } else if (form) {
    form.addEventListener('submit', function () {
      if (typeof window.toast === 'function') window.toast('Спасибо! Отзыв отправлен на проверку Оргкомитету.', 'success');
    });
  }
})();
</script>
<?php
$content = ob_get_clean();
render_page('Отзывы', $content, ['active' => '/reviews', 'meta' => 'Отзывы участников конкурсов Культурного центра «Музыкальный Мир» и ответы Оргкомитета.']);
