<?php
/**
 * Награды — 2 уровня:
 *   1) без ?comp — витрина: заголовок «Образцы наград» + ВЫБОР КОНКУРСА (широкие карточки).
 *   2) ?comp=<id> — сетка образцов 1:1 (фото/медальон) с количеством и корзиной → ЮKassa.
 * Заказ привязывается к конкурсу и заявке на участие.
 */
$u = current_user();

// Открытые конкурсы для выбора.
$comps = all("SELECT id, slug, name, type, direction, cover, diploma_bg, end_date, nominations, is_paid
              FROM competitions WHERE status='open' ORDER BY sort, id");

// Выбранный конкурс (уровень 2).
$compId = isset($_GET['comp']) ? (int) $_GET['comp'] : 0;
$selComp = null;
foreach ($comps as $c) { if ((int)$c['id'] === $compId) { $selComp = $c; break; } }

// Прайс: индивидуальный для конкурса, иначе общий шаблон.
$catalog = [];
if ($selComp) {
    $prices = all("SELECT item, kind, price FROM awards_prices WHERE competition_id=? ORDER BY price DESC", [$compId]);
    if (!$prices) $prices = all("SELECT item, kind, price FROM awards_prices WHERE competition_id IS NULL ORDER BY price DESC");
    foreach ($prices as $p) { $catalog[$p['item']][$p['kind']] = (int)$p['price']; }
}

$meta = [
  // Кубок/статуэтка/медаль — при увеличении показываем ТОЛЬКО подпись (без описания).
  'Кубок Гран-при'        => ['ic'=>'cup',    'slug'=>'cup',      'tag'=>'Высшая награда', 'desc'=>''],
  'Статуэтка лауреата'    => ['ic'=>'trophy', 'slug'=>'statuette', 'tag'=>'', 'desc'=>''],
  'Медаль дипломанта'     => ['ic'=>'medal',  'slug'=>'medal',    'tag'=>'', 'desc'=>''],
  'Основной диплом'       => ['ic'=>'diploma','slug'=>'diploma',  'tag'=>'', 'desc'=>'Официальный диплом с итогом выступления. Присуждается по результату: ГРАН-ПРИ · ЛАУРЕАТ I, II, III степени · ДИПЛОМАНТ I, II, III степени · УЧАСТНИК. Электронный — бесплатно, оригинал — на плотной дизайнерской бумаге с печатями и подписями.'],
  'Дополнительный диплом' => ['ic'=>'diploma','slug'=>'diploma2', 'tag'=>'', 'desc'=>'Диплом за специальную номинацию: ЗА АРТИСТИЗМ · ЗА ПАТРИОТИЗМ · ЗА ОРИГИНАЛЬНОЕ ИСПОЛНЕНИЕ · ЗА ВЕРНОСТЬ ТРАДИЦИЯМ и другие. Дополняет основной диплом.'],
  'Именной диплом'        => ['ic'=>'diploma','slug'=>'diploma-name','tag'=>'Для одного из участников коллектива', 'desc'=>'Для одного из участников коллектива: то же звание, что у коллектива (ГРАН-ПРИ · ЛАУРЕАТ · ДИПЛОМАНТ · УЧАСТНИК), но с ФИО конкретного участника и названием коллектива в дипломе.'],
  'Благодарность'         => ['ic'=>'thanks', 'slug'=>'thanks',   'tag'=>'', 'desc'=>'Именная благодарность педагогу, концертмейстеру или руководителю коллектива за подготовку участников.'],
];
$icons = [
  'cup'     => '<path d="M8 21h8M12 17v4M6 4h12v5a6 6 0 0 1-12 0V4z"/><path d="M6 6H3a3 3 0 0 0 3 5M18 6h3a3 3 0 0 1-3 5"/>',
  'trophy'  => '<path d="M8 21h8M12 17v4M7 4h10v4a5 5 0 0 1-10 0V4z"/><path d="M7 5H4a3 3 0 0 0 3 5M17 5h3a3 3 0 0 1-3 5"/>',
  'medal'   => '<circle cx="12" cy="15" r="6"/><path d="M9 3h6l-2 6h-2z"/><path d="M12 12v6"/>',
  'diploma' => '<path d="M6 2h9l3 3v17H6z"/><path d="M15 2v3h3M9 12h6M9 16h4"/>',
  'thanks'  => '<path d="M20.8 4.6c-1.7-1.7-4.4-1.7-6 0L12 7.4 9.2 4.6c-1.7-1.7-4.4-1.7-6 0-1.7 1.7-1.7 4.4 0 6L12 19l8.8-8.4c1.7-1.6 1.7-4.3 0-6z"/>',
];
$kindLabel = ['original' => 'Оригинал (почтой)', 'digital' => 'Электронный', 'club' => 'Клуб'];
$order = ['Кубок Гран-при','Статуэтка лауреата','Медаль дипломанта','Основной диплом','Дополнительный диплом','Именной диплом','Благодарность'];

// Заявки пользователя (для оформления).
$myApps = [];
if ($u) {
    $myApps = all("SELECT a.id, a.number, a.competition_id, a.full_name, a.result, c.name AS comp_name
                   FROM applications a LEFT JOIN competitions c ON c.id=a.competition_id
                   WHERE a.user_id=? ORDER BY a.created_at DESC", [(int)$u['id']]);
}

/** Фото образца: сначала под конкретный конкурс (img/awards/<compId>/<slug>.jpg),
 *  затем общий (img/awards/<slug>.jpg), иначе null (фолбэк на медальон). */
function award_photo(string $slug, int $compId = 0): ?string {
    $cands = [];
    if ($compId) $cands[] = "img/awards/$compId/$slug.jpg";
    $cands[] = "img/awards/$slug.jpg";
    foreach ($cands as $rel) {
        if (is_file(BASE_PATH . '/public/assets/' . $rel)) return asset($rel);
    }
    return null;
}

ob_start(); ?>

<?php if (!$selComp): /* ═══════════ УРОВЕНЬ 1 — выбор конкурса ═══════════ */ ?>
<section class="section aw-page" style="padding-top:12px">
  <div class="container" style="max-width:840px">
    <div class="section-head reveal" style="text-align:left;margin-bottom:12px">
      <p class="eyebrow eyebrow--script" style="margin:0">Наградная продукция</p>
      <h1 class="aw-title">Образцы наград</h1>
      <p style="color:var(--muted);margin:0;font-size:.92rem">Выберите конкурс — покажем образцы дипломов, кубков, медалей и статуэток с ценами. Заказ оформляется по вашей заявке на участие.</p>
    </div>

    <div class="aw-comp-list">
      <?php foreach ($comps as $i => $c):
        // Фон карточки награды — ПУСТОЙ ШАБЛОН ДИПЛОМА (diploma_bg), а не афиша конкурса.
        $tpl = trim((string)($c['diploma_bg'] ?? ''));
        if ($tpl === '') $tpl = trim((string)($c['cover'] ?? '')); // фолбэк, если шаблон не задан
        $coverUrl = $tpl !== '' ? (preg_match('~^https?://~', $tpl) ? $tpl : url('/' . ltrim($tpl, '/'))) : '';
        $scope = ($c['type'] === 'international') ? 'Международный' : 'Всероссийский';
      ?>
      <?php $dirMap=['multi'=>'Многожанровый','patriotic'=>'Патриотический','vocal'=>'Вокал','instrumental'=>'Инструментальный','dance'=>'Хореография','art'=>'ИЗО и ДПИ'];
            $dir = $dirMap[(string)$c['direction']] ?? ($c['direction'] ?: 'Многожанровый');
            $awStyle = "--i:$i" . ($coverUrl ? ";background-image:linear-gradient(180deg,rgba(8,16,42,.30) 0%,rgba(8,16,42,.55) 55%,rgba(8,16,42,.86) 100%),url('".h($coverUrl)."')" : ''); ?>
      <a class="aw-comp<?= $coverUrl ? ' has-cover' : '' ?> reveal" style="<?= $awStyle ?>" href="<?= url('/awards') ?>?comp=<?= (int)$c['id'] ?>">
        <span class="aw-comp-scope"><?= h($scope) ?></span>
        <span class="aw-comp-emb" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M8 21h8M12 17v4M6 4h12v5a6 6 0 0 1-12 0V4z"/><path d="M6 6H3a3 3 0 0 0 3 5M18 6h3a3 3 0 0 1-3 5"/></svg>
        </span>
        <div class="aw-comp-body">
          <h3 class="aw-comp-name"><?= h($c['name']) ?></h3>
          <p class="aw-comp-sub"><?= h(mb_strimwidth((string)$dir,0,40,'…')) ?></p>
          <span class="aw-comp-go">Выбрать награды
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
          </span>
        </div>
      </a>
      <?php endforeach; ?>
      <?php if (!$comps): ?><p style="color:var(--muted);text-align:center">Открытых конкурсов пока нет.</p><?php endif; ?>
    </div>
  </div>
</section>

<?php else: /* ═══════════ УРОВЕНЬ 2 — сетка образцов 1:1 ═══════════ */
  $scope = ($selComp['type'] === 'international') ? 'Международный' : 'Всероссийский';
?>
<section class="section shop-page aw-page" style="padding-top:12px">
  <div class="container" style="max-width:840px">
    <a class="aw-back" href="<?= url('/awards') ?>">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M11 6l-6 6 6 6"/></svg>
      Все конкурсы
    </a>
    <div class="section-head reveal" style="text-align:left;margin:6px 0 12px">
      <p class="eyebrow eyebrow--script" style="margin:0"><?= h($scope) ?> конкурс</p>
      <h1 class="aw-title" style="font-size:clamp(1.4rem,5vw,1.95rem)">Награды «<?= h($selComp['name']) ?>»</h1>
      <p style="color:var(--muted);margin:0;font-size:.9rem">Электронный основной диплом — бесплатно всем участникам. Ниже — образцы и цены оригиналов с доставкой.</p>
    </div>

    <?php /* Верхний блок с отдельным образцом убран по просьбе — оставлены только
             карточки наград с ценами; крупный просмотр открывается по клику на карточку. */ ?>

    <div class="aw-grid">
      <?php
      // На ПЛАТНЫХ конкурсах основной и дополнительный диплом входят в стоимость участия —
      // из образцов и заказа их убираем (заказывать отдельно нельзя).
      $paidComp = (int)($selComp['is_paid'] ?? 0) === 1;
      foreach ($order as $item):
        if ($paidComp && in_array($item, ['Основной диплом','Дополнительный диплом'], true)) continue;
        if (empty($catalog[$item])) continue;
        $m = $meta[$item] ?? ['ic'=>'diploma','slug'=>'diploma','tag'=>'','desc'=>''];
        $kinds = $catalog[$item];
        $ic = $icons[$m['ic']] ?? $icons['diploma'];
        $photo = award_photo($m['slug'], (int)$selComp['id']);
        $minPrice = min($kinds);
        // Крупное превью для модалки: фото награды; для дипломов — общий шаблон
        // диплома конкурса (award_photo('diploma') или diploma_bg).
        $preview = $photo;
        if (!$preview && in_array($m['slug'], ['diploma','diploma2','diploma-name'], true)) {
          $preview = award_photo('diploma', (int)$selComp['id']);
          if (!$preview) {
            $sBg = trim((string)($selComp['diploma_bg'] ?? ''));
            $preview = $sBg !== '' ? (preg_match('~^https?://~', $sBg) ? $sBg : url('/' . ltrim($sBg, '/'))) : '';
          }
        }
      ?>
      <article class="shop-card aw-card reveal" data-item="<?= h($item) ?>">
        <button type="button" class="aw-media<?= $photo ? ' has-photo' : '' ?>" data-aw-open
                data-title="<?= h($item) ?>" data-desc="<?= h($m['desc']) ?>" data-preview="<?= h($preview) ?>"
                aria-label="Посмотреть крупно: <?= h($item) ?>">
          <?php if ($m['tag']): ?><span class="aw-badge"><?= h($m['tag']) ?></span><?php endif; ?>
          <?php if ($photo): ?>
            <img src="<?= h($photo) ?>" alt="<?= h($item) ?>" loading="lazy">
          <?php else: ?>
            <span class="aw-medallion"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><?= $ic ?></svg></span>
          <?php endif; ?>
          <span class="aw-zoom" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3M11 8v6M8 11h6"/></svg></span>
        </button>
        <div class="aw-info">
          <h3 class="aw-name"><?= h($item) ?></h3>
          <div class="aw-kinds">
            <?php $first=true; foreach ($kinds as $kind => $price): ?>
              <label class="aw-kind">
                <input type="radio" name="kind_<?= md5($item) ?>" value="<?= h($kind) ?>" data-price="<?= (int)$price ?>" <?= $first?'checked':'' ?>>
                <span><?= h($kindLabel[$kind] ?? $kind) ?></span>
                <b><?= $price>0 ? number_format((int)$price,0,'.',' ').' ₽' : 'Беспл.' ?></b>
              </label>
            <?php $first=false; endforeach; ?>
          </div>
          <div class="aw-buy">
            <div class="qty" data-qty>
              <button type="button" class="qty-btn" data-dec aria-label="Меньше">−</button>
              <span class="qty-val" data-val>1</span>
              <button type="button" class="qty-btn" data-inc aria-label="Больше">+</button>
            </div>
            <button type="button" class="btn btn--primary aw-add" data-add aria-label="В корзину">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>
              <span>В корзину</span>
            </button>
          </div>
        </div>
      </article>
      <?php endforeach; ?>
    </div>
    <?php if (!$catalog): ?><p style="color:var(--muted);text-align:center;margin-top:20px">Прайс наград пока не заполнен.</p><?php endif; ?>
  </div>
</section>

<?php /* DaData автоподсказка адреса (бесплатно до 10000/день). Токен — публичный ключ suggestions. */ ?>
<style>
.dd-suggest{position:absolute;left:0;right:0;top:100%;z-index:50;background:var(--card,#fff);border:1px solid var(--glass-brd,rgba(0,0,0,.12));border-radius:12px;box-shadow:0 12px 34px rgba(0,0,0,.18);margin-top:4px;max-height:280px;overflow:auto}
.dd-suggest[hidden]{display:none}
.dd-item{padding:10px 14px;cursor:pointer;font-size:.92rem;border-bottom:1px solid var(--glass-brd,rgba(0,0,0,.06))}
.dd-item:last-child{border-bottom:0}
.dd-item:hover,.dd-item.active{background:rgba(154,255,0,.12)}
.dd-item small{display:block;color:var(--muted);font-size:.78rem;margin-top:2px}
</style>
<script>
(function(){
  var TOKEN = <?= json_encode((string) cfgv('dadata_token', '')) ?>;
  var input = document.getElementById('ord_addr');
  var box = document.getElementById('ddSuggest');
  var postal = document.getElementById('ord_postal');
  if (!input || !box || !TOKEN) return; // без токена — обычное поле
  var timer = null, items = [], active = -1;
  function hide(){ box.hidden = true; box.innerHTML=''; items=[]; active=-1; }
  function render(sugs){
    items = sugs || [];
    if (!items.length){ hide(); return; }
    box.innerHTML = items.map(function(s,i){
      var pc = (s.data && s.data.postal_code) ? s.data.postal_code + ', ' : '';
      return '<div class="dd-item" data-i="'+i+'">'+ s.value.replace(/</g,'&lt;') +
             (pc ? '<small>Индекс: '+pc.replace(/, $/,'')+'</small>':'') + '</div>';
    }).join('');
    box.hidden = false; active = -1;
  }
  function choose(i){
    var s = items[i]; if (!s) return;
    input.value = s.value;
    if (postal && s.data && s.data.postal_code) postal.value = s.data.postal_code;
    hide();
  }
  function query(q){
    fetch('https://suggestions.dadata.ru/suggestions/api/4_1/rs/suggest/address', {
      method:'POST',
      headers:{'Content-Type':'application/json','Accept':'application/json','Authorization':'Token '+TOKEN},
      body: JSON.stringify({ query:q, count:7 })
    }).then(function(r){ return r.json(); })
      .then(function(d){ render(d.suggestions||[]); })
      .catch(function(){ hide(); });
  }
  input.addEventListener('input', function(){
    var q = input.value.trim();
    if (postal) postal.value='';
    if (q.length < 3){ hide(); return; }
    clearTimeout(timer); timer = setTimeout(function(){ query(q); }, 220);
  });
  box.addEventListener('mousedown', function(e){
    var it = e.target.closest('.dd-item'); if (!it) return;
    e.preventDefault(); choose(parseInt(it.getAttribute('data-i'),10));
  });
  input.addEventListener('keydown', function(e){
    if (box.hidden) return;
    if (e.key==='ArrowDown'){ e.preventDefault(); active=Math.min(active+1,items.length-1); }
    else if (e.key==='ArrowUp'){ e.preventDefault(); active=Math.max(active-1,0); }
    else if (e.key==='Enter' && active>=0){ e.preventDefault(); choose(active); return; }
    else if (e.key==='Escape'){ hide(); return; } else return;
    Array.prototype.forEach.call(box.children,function(c,i){ c.classList.toggle('active',i===active); });
  });
  document.addEventListener('click', function(e){ if (!e.target.closest('#addrField')) hide(); });
})();
</script>

<?php /* Модалка крупного просмотра образца награды (диплом/кубок/статуэтка/медаль) */ ?>
<div class="aw-modal" id="awModal" hidden aria-modal="true" role="dialog">
  <div class="aw-modal-backdrop" data-aw-close></div>
  <div class="aw-modal-panel">
    <button type="button" class="aw-modal-x" data-aw-close aria-label="Закрыть">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>
    </button>
    <div class="aw-modal-media" id="awModalMedia"></div>
    <div class="aw-modal-body">
      <h3 class="aw-modal-title" id="awModalTitle"></h3>
      <p class="aw-modal-desc" id="awModalDesc"></p>
    </div>
  </div>
</div>
<style>
.aw-media{position:relative;border:0;width:100%;padding:0;cursor:zoom-in;background:transparent;display:block}
.aw-zoom{position:absolute;right:8px;bottom:8px;width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:rgba(10,20,50,.55);color:#fff;backdrop-filter:blur(4px);opacity:.9;transition:.2s}
.aw-media:hover .aw-zoom{opacity:1;transform:scale(1.06)}
.aw-zoom svg{width:16px;height:16px}
.aw-modal{position:fixed;inset:0;z-index:2000;display:flex;align-items:center;justify-content:center;padding:20px}
.aw-modal[hidden]{display:none}
.aw-modal-backdrop{position:absolute;inset:0;background:rgba(6,12,32,.82);backdrop-filter:blur(6px)}
.aw-modal-panel{position:relative;z-index:1;max-width:520px;width:100%;max-height:92vh;overflow:auto;background:var(--card,#fff);border-radius:20px;box-shadow:0 24px 70px rgba(0,0,0,.5);animation:awPop .28s cubic-bezier(.2,.9,.3,1.2)}
@keyframes awPop{from{opacity:0;transform:translateY(16px) scale(.96)}to{opacity:1;transform:none}}
.aw-modal-x{position:absolute;top:12px;right:12px;z-index:2;width:40px;height:40px;border-radius:50%;border:0;background:rgba(10,20,50,.6);color:#fff;display:flex;align-items:center;justify-content:center;cursor:pointer}
.aw-modal-x svg{width:20px;height:20px}
.aw-modal-media{width:100%;background:#0b1430;display:flex;align-items:center;justify-content:center;border-radius:20px 20px 0 0;min-height:200px}
.aw-modal-media img{max-width:100%;max-height:70vh;display:block;object-fit:contain}
.aw-modal-media .aw-medallion{width:120px;height:120px;color:var(--gold-2,#d4a24a)}
.aw-modal-media .aw-medallion svg{width:100%;height:100%}
.aw-modal-body{padding:18px 22px 24px}
.aw-modal-title{margin:0 0 8px;font-size:1.25rem}
.aw-modal-desc{margin:0;color:var(--muted);font-size:.95rem;line-height:1.6}
</style>
<script>
(function(){
  var modal=document.getElementById('awModal');
  if(!modal)return;
  var media=document.getElementById('awModalMedia'),
      title=document.getElementById('awModalTitle'),
      desc=document.getElementById('awModalDesc');
  function open(btn){
    var t=btn.getAttribute('data-title')||'',d=btn.getAttribute('data-desc')||'',p=btn.getAttribute('data-preview')||'';
    title.textContent=t;
    // Пустое описание (кубок/статуэтка/медаль) — показываем только подпись.
    desc.textContent=d; desc.style.display=d?'':'none';
    if(p){media.innerHTML='<img src="'+p.replace(/"/g,'&quot;')+'" alt="'+t.replace(/"/g,'&quot;')+'">';}
    else{var med=btn.querySelector('.aw-medallion');media.innerHTML=med?med.outerHTML:'';}
    modal.hidden=false;document.body.style.overflow='hidden';
  }
  function close(){modal.hidden=true;document.body.style.overflow='';media.innerHTML='';}
  document.addEventListener('click',function(e){
    var op=e.target.closest('[data-aw-open]'); if(op){e.preventDefault();open(op);return;}
    if(e.target.closest('[data-aw-close]'))close();
  });
  document.addEventListener('keydown',function(e){if(e.key==='Escape'&&!modal.hidden)close();});
})();
</script>

<button type="button" class="shop-cart-fab" id="cartFab" hidden aria-label="Корзина">
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1.6"/><circle cx="18" cy="21" r="1.6"/><path d="M2 3h3l2.4 12.4a2 2 0 0 0 2 1.6h8.5a2 2 0 0 0 2-1.6L23 7H6"/></svg>
  <span class="shop-cart-count" id="cartCount">0</span>
</button>

<div class="shop-cart" id="cartSheet" hidden>
  <div class="shop-cart-backdrop" data-cart-close></div>
  <div class="shop-cart-panel">
    <div class="shop-cart-grab"></div>
    <div class="shop-cart-head">
      <h3>Корзина</h3>
      <button type="button" class="shop-cart-x" data-cart-close aria-label="Закрыть"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
    </div>
    <div class="shop-cart-items" id="cartItems"></div>
    <div class="shop-cart-empty" id="cartEmpty">Корзина пуста</div>

    <form id="orderForm" class="shop-checkout" hidden>
      <?= csrf_field() ?>
      <input type="hidden" name="competition_id" value="<?= (int)$selComp['id'] ?>">
      <div class="shop-total"><span>Итого</span><b id="cartTotal">0 ₽</b></div>

      <?php if ($u): ?>
        <?php // Заказ наград — только по заявкам с выставленным результатом (оценённым).
              $gradedApps = array_values(array_filter($myApps, fn($a) => trim((string)($a['result'] ?? '')) !== ''));
              $compApps = array_values(array_filter($gradedApps, fn($a) => (int)$a['competition_id'] === (int)$selComp['id']));
              $listApps = $compApps ?: $gradedApps; ?>
        <?php if ($listApps): ?>
        <div class="field">
          <label for="ord_app">По какой заявке (только оценённые)</label>
          <select id="ord_app" name="application_id" required>
            <option value="">Выберите заявку…</option>
            <?php foreach ($listApps as $a): ?>
              <option value="<?= (int)$a['id'] ?>"><?= h($a['number']) ?> — <?= h(mb_strimwidth((string)$a['comp_name'],0,24,'…')) ?><?= $a['result']?' ('.h($a['result']).')':'' ?></option>
            <?php endforeach; ?>
          </select>
          <?php if (!$compApps): ?><div class="hint">Нет оценённой заявки на этот конкурс — доступны другие ваши оценённые заявки.</div><?php endif; ?>
        </div>
        <?php else: ?>
          <p class="shop-hint">Заказать наградную продукцию можно после подведения итогов. Как только жюри выставит результат по вашей заявке — здесь появится выбор. <a href="<?= url('/apply') ?>?comp=<?= (int)$selComp['id'] ?>">Подать заявку</a></p>
        <?php endif; ?>
      <?php else: ?>
        <div class="field">
          <label for="ord_number">Номер заявки (необязательно)</label>
          <input type="text" id="ord_number" name="application_number" placeholder="MM-2026-00001">
          <div class="hint">Или <a href="<?= url('/login') ?>">войдите</a>, чтобы выбрать заявку из списка.</div>
        </div>
      <?php endif; ?>

      <div class="field">
        <label for="ord_name">ФИО получателя</label>
        <input type="text" id="ord_name" name="full_name" value="<?= h($u['full_name'] ?? '') ?>" required>
      </div>
      <div class="grid-2c">
        <div class="field">
          <label for="ord_email">Почта</label>
          <input type="email" id="ord_email" name="email" value="<?= h($u['email'] ?? '') ?>" required>
        </div>
        <div class="field">
          <label for="ord_phone">Телефон</label>
          <input type="tel" id="ord_phone" name="phone" value="<?= h($u['phone'] ?? '') ?>" data-phone required>
        </div>
      </div>
      <div class="field" id="addrField" style="position:relative">
        <label for="ord_addr">Адрес доставки (для оригиналов)</label>
        <input type="text" id="ord_addr" name="address" placeholder="Начните вводить: город, улица, дом…" autocomplete="off">
        <input type="hidden" id="ord_postal" name="postal_index" value="">
        <div id="ddSuggest" class="dd-suggest" hidden></div>
        <div class="hint">Начните вводить адрес — подскажем и подставим индекс. Доставка Почтой России.</div>
      </div>
      <button type="submit" class="btn btn--primary btn--block btn--lg" id="orderSubmit">Оплатить</button>
      <p id="orderErr" class="shop-err" hidden></p>
    </form>
  </div>
</div>

<script>
(function(){
  var KIND_LABEL = {"original":"Оригинал","digital":"Электронный","club":"Клуб"};
  var cart = [];
  var $ = function(s,r){return (r||document).querySelector(s);};
  var fab=$('#cartFab'), sheet=$('#cartSheet'), itemsBox=$('#cartItems'), emptyBox=$('#cartEmpty'),
      form=$('#orderForm'), totalEl=$('#cartTotal'), countEl=$('#cartCount');
  if(!fab) return;

  document.querySelectorAll('[data-qty]').forEach(function(q){
    var v=q.querySelector('[data-val]');
    q.querySelector('[data-dec]').addEventListener('click',function(){v.textContent=Math.max(1,parseInt(v.textContent)-1);});
    q.querySelector('[data-inc]').addEventListener('click',function(){v.textContent=Math.min(20,parseInt(v.textContent)+1);});
  });
  // Лимиты количества: основной/дополнительный диплом — максимум 1 (второй не имеет смысла);
  // именные и благодарности — до 20 (на каждый экземпляр вводится ФИО).
  function maxQty(item){ return /Основной диплом|Дополнительный диплом/.test(item) ? 1 : 20; }
  function needsFio(item){ return /Именной диплом/.test(item) ? 'ФИО участника коллектива'
                              : /Благодарность/.test(item) ? 'ФИО педагога / руководителя' : null; }
  document.querySelectorAll('.shop-card').forEach(function(card){
    card.querySelector('[data-add]').addEventListener('click',function(){
      var item=card.getAttribute('data-item');
      var kindInp=card.querySelector('input[type=radio]:checked');
      var kind=kindInp.value, price=parseInt(kindInp.getAttribute('data-price'));
      var qty=parseInt(card.querySelector('[data-val]').textContent)||1;
      var cap=maxQty(item);
      var ex=cart.find(function(c){return c.item===item&&c.kind===kind;});
      var cur=ex?ex.qty:0;
      if(cur+qty>cap){
        if(window.toast)window.toast(cap===1?'Этот диплом можно заказать только в одном экземпляре':'Максимум '+cap+' шт.','error');
        qty=Math.max(0,cap-cur); if(!qty)return;
      }
      if(ex){ex.qty+=qty;}else{cart.push({item:item,kind:kind,price:price,qty:qty,fios:[]});}
      render();
      // Корзину НЕ открываем автоматически — только пульс кнопки и подсказка.
      fab.classList.remove('pulse'); void fab.offsetWidth; fab.classList.add('pulse');
      if(window.toast)window.toast('Добавлено. Корзина — внизу справа','success');
    });
  });
  function render(){
    var total=0,count=0; itemsBox.innerHTML='';
    cart.forEach(function(c,i){
      total+=c.price*c.qty; count+=c.qty;
      var row=document.createElement('div');row.className='shop-cart-row';
      var cap=maxQty(c.item);
      row.innerHTML='<div class="scr-info"><b>'+c.item+'</b><span>'+(KIND_LABEL[c.kind]||c.kind)+' · '+c.price+' ₽</span></div>'+
        '<div class="scr-qty"><button type="button" data-m>−</button><span>'+c.qty+'</span><button type="button" data-p'+(c.qty>=cap?' disabled':'')+'>+</button></div>'+
        '<div class="scr-sum">'+(c.price*c.qty)+' ₽</div>'+
        '<button type="button" class="scr-del" data-del aria-label="Удалить">✕</button>';
      row.querySelector('[data-m]').onclick=function(){c.qty=Math.max(1,c.qty-1);render();};
      row.querySelector('[data-p]').onclick=function(){c.qty=Math.min(cap,c.qty+1);render();};
      row.querySelector('[data-del]').onclick=function(){cart.splice(i,1);render();};
      itemsBox.appendChild(row);
      // Поля ФИО: по одному на каждый экземпляр именного диплома / благодарности.
      var lbl=needsFio(c.item);
      if(lbl){
        c.fios=c.fios||[];
        for(var k=0;k<c.qty;k++){
          var w=document.createElement('div'); w.className='scr-fio';
          var inp=document.createElement('input');
          inp.type='text'; inp.placeholder=lbl+(c.qty>1?' — экз. '+(k+1):'');
          inp.value=c.fios[k]||'';
          (function(cc,kk){ inp.addEventListener('input',function(){ cc.fios[kk]=this.value; }); })(c,k);
          w.appendChild(inp); itemsBox.appendChild(w);
        }
      }
    });
    totalEl.textContent=total.toLocaleString('ru-RU')+' ₽';
    countEl.textContent=count; fab.hidden=count===0; emptyBox.hidden=count>0; form.hidden=count===0;
    // Адрес доставки нужен ТОЛЬКО если в корзине есть оригинал (кубок/статуэтка/медаль/оригинал диплома).
    var needAddr=cart.some(function(c){return c.kind==='original';});
    var af=document.getElementById('addrField'), ai=document.getElementById('ord_addr');
    if(af){af.style.display=needAddr?'':'none';}
    if(ai){ai.required=!!needAddr;}
  }
  function openCart(){sheet.hidden=false;document.body.classList.add('mz-cart-open');requestAnimationFrame(function(){sheet.classList.add('on');});}
  function closeCart(){sheet.classList.remove('on');document.body.classList.remove('mz-cart-open');setTimeout(function(){sheet.hidden=true;},300);}
  fab.addEventListener('click',openCart);
  document.querySelectorAll('[data-cart-close]').forEach(function(b){b.addEventListener('click',closeCart);});

  form.addEventListener('submit',function(e){
    e.preventDefault();
    if(!cart.length)return;
    var err=$('#orderErr'); err.hidden=true;
    var btn=$('#orderSubmit'); btn.disabled=true; btn.textContent='Создаём заказ…';
    // ФИО обязательны для каждого экземпляра именного диплома и благодарности.
    for(var ci=0;ci<cart.length;ci++){
      var lbl=needsFio(cart[ci].item);
      if(lbl){
        for(var qi=0;qi<cart[ci].qty;qi++){
          if(!((cart[ci].fios||[])[qi]||'').trim()){
            err.textContent='Заполните «'+lbl+'» для каждой позиции «'+cart[ci].item+'» в корзине.';
            err.hidden=false; var b0=$('#orderSubmit'); b0.disabled=false; b0.textContent='Оплатить'; return;
          }
        }
      }
    }
    // Для оригиналов адрес доставки обязателен.
    if(cart.some(function(c){return c.kind==='original';})){
      var addrV=(document.getElementById('ord_addr')||{}).value||'';
      if(!addrV.trim()){ err.textContent='Укажите адрес доставки — в заказе есть оригинал (отправка Почтой России).'; err.hidden=false; var b1=$('#orderSubmit'); b1.disabled=false; b1.textContent='Оплатить'; return; }
    }
    var items=[]; cart.forEach(function(c){for(var i=0;i<c.qty;i++){var it={item:c.item,kind:c.kind};var f=(c.fios||[])[i];if(f&&f.trim())it.fio=f.trim();items.push(it);}});
    var fd=new FormData(form); fd.set('items',JSON.stringify(items));
    fetch('<?= url('/api/v1/order') ?>',{method:'POST',credentials:'same-origin',body:fd})
      .then(function(r){return r.json();})
      .then(function(d){
        btn.disabled=false; btn.textContent='Оплатить';
        if(!d.ok){err.textContent=d.error||'Не удалось оформить заказ';err.hidden=false;return;}
        if(d.confirmation_url){location.href=d.confirmation_url;return;}
        location.href='<?= url('/cabinet') ?>#awards';
      }).catch(function(){btn.disabled=false;btn.textContent='Оплатить';err.textContent='Ошибка сети, попробуйте ещё раз';err.hidden=false;});
  });
})();
</script>
<?php endif; ?>
<?php
$content = ob_get_clean();
$ttl = $selComp ? ('Награды «'.$selComp['name'].'»') : 'Образцы наград';
render_page($ttl, $content, ['active' => '/awards', 'meta' => 'Наградная продукция Культурного центра «Музыкальный Мир»: дипломы, медали, статуэтки, кубки. Заказ по заявке на участие, оплата онлайн.']);
