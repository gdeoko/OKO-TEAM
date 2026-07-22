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

ob_start(); ?>
<section class="section section--parchment">
  <div class="container">
    <div class="section-head reveal">
      <p class="eyebrow">Награды</p>
      <h2>Наградная линейка</h2>
      <div class="gold-rule"></div>
      <p>Каждый участник получает наградной материал в электронном виде. По желанию можно заказать оригинал -
         кубок, статуэтку, медаль или диплом на плотной бумаге. Оригинал диплома выпускается с голографическим и
         цифровым логотипами центра - как гарантия подлинности.</p>
    </div>
  </div>
</section>

<section class="section">
  <div class="container">
    <?php if ($cards): ?>
    <div class="grid grid-3">
      <?php foreach ($cards as $i => $card): ?>
        <div class="card card--3d reveal" style="--i:<?= $i ?>;display:flex;flex-direction:column">
          <div style="display:flex;align-items:center;gap:14px;margin-bottom:14px">
            <span style="width:56px;height:56px;flex:none;border-radius:50%;background:var(--gold-soft);color:var(--gold-2);
                         border:1px solid var(--glass-brd);display:flex;align-items:center;justify-content:center">
              <span style="width:28px;height:28px"><?= $icons[$card['icon']] ?? $icons['diploma'] ?></span>
            </span>
            <?php if (!empty($card['tag'])): ?>
              <span class="badge badge--intl"><?= h($card['tag']) ?></span>
            <?php endif; ?>
          </div>
          <h3 style="margin:0 0 8px"><?= h($card['item']) ?></h3>
          <?php if (!empty($card['desc'])): ?>
            <p style="color:var(--text-dim);margin:0 0 16px;flex:1"><?= h($card['desc']) ?></p>
          <?php endif; ?>
          <ul style="list-style:none;padding:0;margin:0 0 14px">
            <?php foreach ($card['kinds'] as $kind => $price): ?>
              <li style="display:flex;justify-content:space-between;gap:12px;padding:9px 0;border-bottom:1px solid var(--line)">
                <span style="color:var(--muted)"><?= h($kindLabel[$kind] ?? $kind) ?></span>
                <b style="color:var(--gold-2);white-space:nowrap"><?= $price > 0 ? h(money($price)) : 'Бесплатно' ?></b>
              </li>
            <?php endforeach; ?>
          </ul>
          <?php if (!empty($card['holo']) && isset($card['kinds']['original'])): ?>
            <p style="display:flex;align-items:center;gap:8px;color:var(--muted);font-size:.82rem;margin:0 0 16px">
              <span style="width:16px;height:16px;flex:none;color:var(--gold-2)"><?= $icons['holo'] ?></span>
              Оригинал - с голографическим и цифровым логотипами
            </p>
          <?php endif; ?>
          <a class="btn btn--primary btn--block" style="margin-top:auto" href="<?= url('/order-awards') ?>">Заказать</a>
        </div>
      <?php endforeach; ?>
    </div>
    <?php else: ?>
      <p style="text-align:center;color:var(--muted)">Прайс наградной линейки пока не заполнен. Обратитесь в Оргкомитет по контактам.</p>
    <?php endif; ?>
  </div>
</section>

<?php if ($comps): ?>
<section class="section section--parchment">
  <div class="container">
    <div class="section-head reveal">
      <p class="eyebrow">Образцы</p>
      <h2>Образцы наград по конкурсам</h2>
      <p>Выберите конкурс, чтобы увидеть образцы наградного материала и прайс с учётом его условий.</p>
    </div>
    <div class="grid grid-3">
      <?php foreach ($comps as $i => $c): ?>
        <div class="card comp-card reveal" style="--i:<?= $i ?>">
          <div class="cc-cover"><?= h($c['name']) ?></div>
          <div class="cc-body">
            <span class="badge badge--<?= $c['status']==='open' ? 'open' : ($c['status']==='judging' ? 'judging' : 'closed') ?>"><?= $c['status']==='open' ? 'Приём открыт' : ($c['status']==='judging' ? 'Идёт оценка' : 'Завершён') ?></span>
            <span class="badge badge--intl"><?= $c['type']==='international' ? 'Международный' : 'Всероссийский' ?></span>
            <h3 style="margin-top:12px"><?= h($c['name']) ?></h3>
            <p style="color:var(--muted)">Образцы наградного материала и прайс на оригиналы дипломов, кубков и медалей.</p>
            <a class="btn btn--ghost btn--block" href="<?= url('/awards/'.$c['slug']) ?>">
              Ознакомиться <span style="width:18px;height:18px"><?= $icons['arrow'] ?></span>
            </a>
          </div>
        </div>
      <?php endforeach; ?>
    </div>
  </div>
</section>
<?php endif; ?>

<section class="section">
  <div class="container">
    <div class="grid grid-3">
      <div class="card reveal" style="--i:0">
        <h3 style="margin-top:0">Денежные премии</h3>
        <p style="color:var(--text-dim);margin:0">Денежные премии распределяются среди обладателей звания «Гран-при», набравших максимальное количество баллов, - по решению Оргкомитета конкурса.</p>
      </div>
      <div class="card reveal" style="--i:1">
        <h3 style="margin-top:0">Доставка</h3>
        <p style="color:var(--text-dim);margin:0">Оригиналы наградного материала отправляются почтой. Стоимость доставки оплачивается отдельно заказчиком при получении - наложенным платежом.</p>
      </div>
      <div class="card reveal" style="--i:2">
        <h3 style="margin-top:0">Возврат посылки</h3>
        <p style="color:var(--text-dim);margin:0">При возврате посылки с наградным материалом по вине заказчика организационный взнос возврату не подлежит, а повторная отправка производится полностью за счёт заказчика.</p>
      </div>
    </div>
    <div style="text-align:center;margin-top:40px">
      <a class="btn btn--primary btn--lg" href="<?= url('/order-awards') ?>">Заказать наградной материал</a>
    </div>
  </div>
</section>
<?php
$content = ob_get_clean();
render_page('Наградная линейка', $content, ['active' => '/awards', 'meta' => 'Наградная линейка КЦ «Музыкальный Мир»: кубок Гран-при, статуэтка лауреата, медаль дипломанта, дипломы и благодарность педагогу - образцы и цены.']);
