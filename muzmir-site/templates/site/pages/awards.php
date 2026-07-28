<?php
/** Награды - премиум-витрина наградной линейки КЦ «Музыкальный Мир». */
$comps = all("SELECT * FROM competitions WHERE status != 'draft' ORDER BY sort");

// Прайс наградной линейки - общий шаблон (competition_id IS NULL) из awards_prices.
$prices = all("SELECT * FROM awards_prices WHERE competition_id IS NULL ORDER BY item, kind");
$byItem = [];
foreach ($prices as $p) { $byItem[$p['item']][$p['kind']] = (int)$p['price']; }

$kindLabel = ['original' => 'Оригинал (почтой)', 'digital' => 'Электронная версия'];

$icons = [
  'gran'    => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M8 21h8M12 17v4M6 4h12v5a6 6 0 0 1-12 0V4z"/><path d="M6 6H3a3 3 0 0 0 3 5M18 6h3a3 3 0 0 1-3 5"/><path d="M12 8l.9 1.8 2 .3-1.45 1.4.34 1.98L12 12.6l-1.8.9.35-1.98L9.1 10.1l2-.3z" fill="currentColor" stroke="none"/></svg>',
  'cup'     => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M8 21h8M12 17v4M7 4h10v4a5 5 0 0 1-10 0V4z"/><path d="M7 5H4a3 3 0 0 0 3 5M17 5h3a3 3 0 0 1-3 5"/></svg>',
  'medal'   => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="15" r="6"/><path d="M9 3h6l-2 6h-2z"/><path d="M12 12v6"/></svg>',
  'diploma' => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M6 2h9l3 3v17H6z"/><path d="M15 2v3h3M9 12h6M9 16h4"/><circle cx="9" cy="9" r="1.4"/></svg>',
  'thanks'  => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M20.8 4.6c-1.7-1.7-4.4-1.7-6 0L12 7.4 9.2 4.6c-1.7-1.7-4.4-1.7-6 0-1.7 1.7-1.7 4.4 0 6L12 19l8.8-8.4c1.7-1.6 1.7-4.3 0-6z"/></svg>',
  'holo'    => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 2l2.4 4.9 5.4.8-3.9 3.8.9 5.4L12 14.9 7.2 17l.9-5.4L4.2 7.7l5.4-.8z"/></svg>',
  'arrow'   => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
];

// Наградная линейка: порядок, иконка, описание, отметки. Прайс тянется из awards_prices по названию.
$lineup = [
  ['match' => 'кубок',        'icon' => 'gran',    'tag' => 'Высшая награда',
   'desc'  => 'Эксклюзивный объёмный кубок для обладателя звания «Гран-при». Денежные премии Гран-при распределяются по решению Оргкомитета конкурса.'],
  ['match' => 'статуэтк',     'icon' => 'cup',     'tag' => '',
   'desc'  => 'Наградная статуэтка лауреата I-III степени. Премиальное исполнение, подарочная упаковка.'],
  ['match' => 'медал',        'icon' => 'medal',   'tag' => '',
   'desc'  => 'Наградная медаль дипломанта конкурса с символикой центра. Металлический чекан на ленте.'],
  ['match' => 'основной',     'icon' => 'diploma', 'tag' => '', 'holo' => true,
   'desc'  => 'Официальный диплом с аттестационным результатом. Электронная версия выдаётся всем участникам бесплатно; оригинал печатается на плотной бумаге.'],
  ['match' => 'дополнительн', 'icon' => 'diploma', 'tag' => '', 'holo' => true,
   'desc'  => 'Дополнительный экземпляр диплома - для второго педагога, концертмейстера или архива коллектива.'],
  ['match' => 'именной',      'icon' => 'diploma', 'tag' => '', 'holo' => true,
   'desc'  => 'Индивидуальный диплом для одного из участников коллектива - с сохранённым званием и названием коллектива.'],
  ['match' => 'благодар',     'icon' => 'thanks',  'tag' => '',
   'desc'  => 'Именная благодарность педагогу или руководителю за подготовку участника к конкурсу.'],
];

// Сопоставляем позиции прайса с описаниями линейки (по подстроке названия).
$cards = [];
$usedItems = [];
foreach ($lineup as $m) {
    foreach ($byItem as $item => $kinds) {
        if (in_array($item, $usedItems, true)) continue;
        if (mb_stripos($item, $m['match']) !== false) {
            $cards[] = ['item' => $item, 'kinds' => $kinds] + $m;
            $usedItems[] = $item;
            break;
        }
    }
}
// Любые оставшиеся позиции прайса - в конец, чтобы витрина не теряла данные из БД.
foreach ($byItem as $item => $kinds) {
    if (!in_array($item, $usedItems, true)) {
        $cards[] = ['item' => $item, 'kinds' => $kinds, 'icon' => 'diploma', 'tag' => '', 'desc' => ''];
    }
}

$noteIcons = [
  'money'   => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="3"/><path d="M6 12h.01M18 12h.01"/></svg>',
  'truck'   => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M1 3h15v13H1zM16 8h4l3 3v5h-7"/><circle cx="5.5" cy="18.5" r="2.5"/><circle cx="18.5" cy="18.5" r="2.5"/></svg>',
  'return'  => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M3 7v6h6"/><path d="M3.5 13a9 9 0 1 0 2.6-6.4L3 9"/></svg>',
];

ob_start(); ?>
<section class="section aw-intro">
  <div class="container">
    <div class="section-head reveal">
      <p class="eyebrow">Награды</p>
      <h2>Образцы наград</h2>
      <div class="gold-rule"></div>
      <p>Каждый участник получает наградной материал в электронном виде. По желанию можно заказать оригинал -
         кубок, статуэтку, медаль или диплом на плотной бумаге. Оригинал диплома выпускается с голографическим и
         цифровым логотипами центра - как гарантия подлинности.</p>
    </div>
  </div>
</section>

<section class="section aw-lineup-sec">
  <div class="container">
    <?php if ($cards): ?>
    <div class="grid grid-3 aw-lineup">
      <?php foreach ($cards as $i => $card):
        $isTop = !empty($card['tag']);
        $isHolo = !empty($card['holo']) && isset($card['kinds']['original']);
      ?>
        <article class="card card--3d reveal aw-card<?= $isTop ? ' aw-card--top' : '' ?><?= $isHolo ? ' aw-card--holo' : '' ?>" style="--i:<?= $i % 3 ?>">
          <span class="aw-corner aw-corner--tl" aria-hidden="true"></span>
          <span class="aw-corner aw-corner--br" aria-hidden="true"></span>
          <div class="aw-card__head">
            <span class="aw-medallion">
              <span class="aw-medallion__ring" aria-hidden="true"></span>
              <span class="aw-medallion__ic"><?= $icons[$card['icon']] ?? $icons['diploma'] ?></span>
            </span>
            <?php if ($isTop): ?>
              <span class="aw-ribbon"><?= h($card['tag']) ?></span>
            <?php endif; ?>
          </div>
          <h3 class="aw-card__title"><?= h($card['item']) ?></h3>
          <?php if (!empty($card['desc'])): ?>
            <p class="aw-card__desc"><?= h($card['desc']) ?></p>
          <?php endif; ?>
          <ul class="aw-price">
            <?php foreach ($card['kinds'] as $kind => $price): ?>
              <li class="aw-price__row">
                <span class="aw-price__kind"><?= h($kindLabel[$kind] ?? $kind) ?></span>
                <b class="aw-price__val<?= $price > 0 ? '' : ' aw-price__val--free' ?>"><?= $price > 0 ? h(money($price)) : 'Бесплатно' ?></b>
              </li>
            <?php endforeach; ?>
          </ul>
          <?php if ($isHolo): ?>
            <p class="aw-holo-note">
              <span class="aw-holo-note__ic"><?= $icons['holo'] ?></span>
              Оригинал - с голографическим и цифровым логотипами
            </p>
          <?php endif; ?>
          <a class="btn btn--primary btn--block aw-card__cta" href="<?= url('/order-awards') ?>">Заказать</a>
        </article>
      <?php endforeach; ?>
    </div>
    <?php else: ?>
      <p class="aw-hollow">Прайс наградной линейки пока не заполнен. Обратитесь в Оргкомитет по контактам.</p>
    <?php endif; ?>
  </div>
</section>

<?php if ($comps): ?>
<section class="section section--parchment aw-samples-sec">
  <div class="container">
    <div class="section-head reveal">
      <p class="eyebrow">Образцы</p>
      <h2>Образцы наград по конкурсам</h2>
      <div class="gold-rule"></div>
      <p>Выберите конкурс, чтобы увидеть образцы наградного материала и прайс с учётом его условий.</p>
    </div>
    <div class="grid grid-3">
      <?php foreach ($comps as $i => $c): ?>
        <div class="card comp-card reveal aw-sample" style="--i:<?= $i % 3 ?>">
          <div class="cc-cover"><span class="aw-sample__cover-txt"><?= h($c['name']) ?></span></div>
          <div class="cc-body">
            <div class="aw-sample__badges">
              <span class="badge badge--<?= $c['status']==='open' ? 'open' : ($c['status']==='judging' ? 'judging' : 'closed') ?>"><?= $c['status']==='open' ? 'Приём открыт' : ($c['status']==='judging' ? 'Идёт оценка' : 'Завершён') ?></span>
              <span class="badge badge--intl"><?= $c['type']==='international' ? 'Международный' : 'Всероссийский' ?></span>
            </div>
            <h3 class="aw-sample__title"><?= h($c['name']) ?></h3>
            <p class="aw-sample__desc">Образцы наградного материала и прайс на оригиналы дипломов, кубков и медалей.</p>
            <a class="btn btn--ghost btn--block aw-sample__cta" href="<?= url('/awards/'.$c['slug']) ?>">
              Ознакомиться <span class="aw-arrow"><?= $icons['arrow'] ?></span>
            </a>
          </div>
        </div>
      <?php endforeach; ?>
    </div>
  </div>
</section>
<?php endif; ?>

<section class="section aw-terms-sec">
  <div class="container">
    <div class="section-head reveal">
      <p class="eyebrow">Условия</p>
      <h2>Премии и доставка</h2>
      <div class="gold-rule"></div>
    </div>
    <div class="grid grid-3">
      <?php foreach ([
        ['money',  'Денежные премии', 'Денежные премии распределяются среди обладателей звания «Гран-при», набравших максимальное количество баллов, - по решению Оргкомитета конкурса.'],
        ['truck',  'Доставка',        'Оригиналы наградного материала отправляются почтой. Стоимость доставки оплачивается отдельно заказчиком при получении - наложенным платежом.'],
        ['return', 'Возврат посылки', 'При возврате посылки с наградным материалом по вине заказчика организационный взнос возврату не подлежит, а повторная отправка производится полностью за счёт заказчика.'],
      ] as $i => [$ic, $tt, $tx]): ?>
        <div class="card reveal aw-term" style="--i:<?= $i ?>">
          <span class="aw-term__ic"><?= $noteIcons[$ic] ?></span>
          <h3 class="aw-term__title"><?= h($tt) ?></h3>
          <p class="aw-term__text"><?= h($tx) ?></p>
        </div>
      <?php endforeach; ?>
    </div>
    <div class="aw-final reveal">
      <a class="btn btn--primary btn--lg" href="<?= url('/order-awards') ?>">Заказать наградной материал</a>
    </div>
  </div>
</section>

<style>
/* ═══ НАГРАДЫ - премиум-витрина ═══ */
.aw-intro{position:relative;overflow:hidden}
.aw-intro::before{content:"";position:absolute;left:50%;top:-40%;width:min(760px,120%);height:520px;transform:translateX(-50%);
  background:radial-gradient(closest-side,var(--gold-soft),transparent 72%);pointer-events:none;z-index:0}
.aw-intro .section-head{position:relative;z-index:1;margin-bottom:0}

.aw-lineup-sec{padding-top:38px}
.aw-lineup{align-items:stretch}
.aw-card{display:flex;flex-direction:column;padding:28px 26px;position:relative;overflow:hidden}
.aw-card__head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:18px;min-height:56px}
.aw-medallion{position:relative;width:60px;height:60px;flex:none;display:grid;place-items:center}
.aw-medallion__ring{position:absolute;inset:0;border-radius:50%;
  background:conic-gradient(from 210deg,var(--gold),var(--gold-deep),var(--gold-2),var(--gold));
  padding:1.5px;-webkit-mask:radial-gradient(farthest-side,transparent calc(100% - 2px),#000 calc(100% - 2px));
  mask:radial-gradient(farthest-side,transparent calc(100% - 2px),#000 calc(100% - 2px));opacity:.9}
.aw-medallion__ic{width:44px;height:44px;border-radius:50%;background:var(--gold-soft);color:var(--gold-2);
  display:grid;place-items:center;box-shadow:inset 0 1px 8px rgba(201,168,76,.22)}
.aw-medallion__ic svg{width:26px;height:26px}
[data-theme="dark"] .aw-medallion__ic{color:var(--gold)}
.aw-ribbon{font-family:var(--ff-body);font-size:.66rem;font-weight:800;letter-spacing:.07em;text-transform:uppercase;
  color:var(--gold-fg);background:var(--grad-gold);padding:6px 13px;border-radius:999px;box-shadow:var(--shadow-btn);white-space:nowrap}
.aw-card__title{font-family:var(--ff-display);font-size:1.24rem;line-height:1.2;margin:0 0 10px;color:var(--text)}
.aw-card__desc{color:var(--text-dim);margin:0 0 18px;flex:1;font-size:.93rem;line-height:1.55}
.aw-price{list-style:none;padding:0;margin:0 0 16px}
.aw-price__row{display:flex;justify-content:space-between;gap:12px;padding:11px 0;border-bottom:1px solid var(--line);align-items:baseline}
.aw-price__row:last-child{border-bottom:0}
.aw-price__kind{color:var(--muted);font-size:.9rem}
.aw-price__val{color:var(--gold-2);white-space:nowrap;font-family:var(--ff-display);font-weight:800;font-size:1.06rem}
[data-theme="dark"] .aw-price__val{color:var(--gold)}
.aw-price__val--free{color:var(--mint);font-size:.95rem}
.aw-holo-note{display:flex;align-items:center;gap:9px;color:var(--muted);font-size:.8rem;margin:0 0 18px;line-height:1.4}
.aw-holo-note__ic{width:18px;height:18px;flex:none;color:var(--gold-2)}
.aw-card__cta{margin-top:auto}

/* Угловые золотые засечки-орнамент */
.aw-corner{position:absolute;width:22px;height:22px;pointer-events:none;opacity:.55;transition:opacity .3s}
.aw-corner--tl{top:12px;left:12px;border-top:1.5px solid var(--gold-2);border-left:1.5px solid var(--gold-2);border-top-left-radius:6px}
.aw-corner--br{bottom:12px;right:12px;border-bottom:1.5px solid var(--gold-2);border-right:1.5px solid var(--gold-2);border-bottom-right-radius:6px}
@media(hover:hover){.aw-card:hover .aw-corner{opacity:1}}

/* Высшая награда - выделенная карточка */
.aw-card--top{background:
  radial-gradient(140% 90% at 50% -10%,var(--gold-soft),transparent 60%),var(--panel)}
.aw-card--top::before{content:"";position:absolute;inset:0;border-radius:inherit;padding:1.5px;
  background:linear-gradient(150deg,var(--gold),transparent 30%,transparent 70%,var(--gold-deep));
  -webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);
  -webkit-mask-composite:xor;mask-composite:exclude;pointer-events:none}

/* Голографический отлив на диплом-карточках */
.aw-card--holo .aw-medallion__ic{background:
  linear-gradient(120deg,rgba(159,122,234,.14),rgba(90,122,158,.12),var(--gold-soft))}

.aw-hollow{text-align:center;color:var(--muted);padding:40px 0}

/* Образцы по конкурсам */
.aw-samples-sec .comp-card{overflow:hidden}
.aw-sample__cover-txt{position:relative;z-index:1;text-shadow:0 2px 12px rgba(27,35,64,.22)}
.comp-card.aw-sample .cc-cover::after{content:"";position:absolute;inset:0;
  background:repeating-linear-gradient(135deg,rgba(255,255,255,.10) 0,rgba(255,255,255,.10) 2px,transparent 2px,transparent 9px);
  mix-blend-mode:overlay;pointer-events:none}
.aw-sample__badges{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px}
.aw-sample__title{margin:0 0 8px}
.aw-sample__desc{color:var(--muted);margin:0 0 16px}
.aw-sample__cta{margin-top:auto}
.aw-arrow{display:inline-flex;width:18px;height:18px}
.aw-sample{display:flex;flex-direction:column}
.aw-sample .cc-body{display:flex;flex-direction:column;flex:1}

/* Условия */
.aw-term{position:relative;padding-top:28px}
.aw-term__ic{display:inline-flex;width:50px;height:50px;border-radius:14px;background:var(--gold-soft);
  border:1px solid var(--glass-brd);color:var(--gold-2);align-items:center;justify-content:center;margin-bottom:16px;
  box-shadow:inset 0 0 18px rgba(201,168,76,.10)}
.aw-term__ic svg{width:26px;height:26px}
[data-theme="dark"] .aw-term__ic{color:var(--gold)}
.aw-term__title{margin:0 0 10px}
.aw-term__text{color:var(--text-dim);margin:0;line-height:1.55}
.aw-final{text-align:center;margin-top:44px;position:relative}
.aw-final::before{content:"";position:absolute;left:50%;top:-24px;transform:translateX(-50%);width:160px;height:1px;
  background:linear-gradient(90deg,transparent,var(--gold),transparent)}

@media(max-width:640px){
  .aw-card{padding:24px 22px}
  .aw-ribbon{font-size:.62rem;padding:5px 11px}
}
</style>
<?php
$content = ob_get_clean();
render_page('Наградная линейка', $content, ['active' => '/awards', 'meta' => 'Наградная линейка КЦ «Музыкальный Мир»: кубок Гран-при, статуэтка лауреата, медаль дипломанта, дипломы и благодарность педагогу - образцы и цены.']);
