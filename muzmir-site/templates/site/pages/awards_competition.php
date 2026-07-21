<?php
/** Образцы наград и прайс конкретного конкурса. Переменная $slug задана роутером. */
$c = one("SELECT * FROM competitions WHERE slug=?", [$slug]);
if (!$c) {
    http_response_code(404);
    ob_start(); ?>
<section class="section"><div class="container" style="text-align:center">
  <h1>Конкурс не найден</h1>
  <p>Проверьте адрес страницы или посмотрите <a href="<?= url('/awards') ?>">все конкурсы</a>.</p>
</div></section>
<?php
    $content = ob_get_clean();
    render_page('Страница не найдена', $content, ['active' => '/awards']);
    return;
}

// Индивидуальный прайс конкурса, при отсутствии - общий шаблон (competition_id IS NULL).
$prices = all("SELECT * FROM awards_prices WHERE competition_id=? ORDER BY item, kind", [$c['id']]);
if (!$prices) {
    $prices = all("SELECT * FROM awards_prices WHERE competition_id IS NULL ORDER BY item, kind");
}
$byItem = [];
foreach ($prices as $p) { $byItem[$p['item']][$p['kind']] = (int)$p['price']; }

$icons = [
  'cup'   => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M8 21h8M12 17v4M7 4h10v4a5 5 0 0 1-10 0V4z"/><path d="M7 5H4a3 3 0 0 0 3 5M17 5h3a3 3 0 0 1-3 5"/></svg>',
  'medal' => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="15" r="6"/><path d="M9 3h6l-2 6h-2z"/><path d="M12 12v6"/></svg>',
  'diploma' => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M6 2h9l3 3v17H6z"/><path d="M15 2v3h3M9 12h6M9 16h4"/><circle cx="9" cy="9" r="1.4"/></svg>',
  'thanks' => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M20.8 4.6c-1.7-1.7-4.4-1.7-6 0L12 7.4 9.2 4.6c-1.7-1.7-4.4-1.7-6 0-1.7 1.7-1.7 4.4 0 6L12 19l8.8-8.4c1.7-1.6 1.7-4.3 0-6z"/></svg>',
];
function awards_page_icon_key(string $item): string {
    $l = mb_strtolower($item);
    if (str_contains($l, 'кубок') || str_contains($l, 'статуэтк')) return 'cup';
    if (str_contains($l, 'медал')) return 'medal';
    if (str_contains($l, 'благодар')) return 'thanks';
    return 'diploma';
}
$kindLabel = ['original' => 'Оригинал (почтой)', 'digital' => 'Электронная версия'];

ob_start(); ?>
<section class="section section--parchment">
  <div class="container">
    <div class="section-head reveal">
      <p class="eyebrow"><?= $c['type']==='international' ? 'Международный конкурс' : 'Всероссийский конкурс' ?></p>
      <h2>Награды конкурса «<?= h($c['name']) ?>»</h2>
      <p>Основной наградной материал в электронном виде выдаётся всем участникам бесплатно. Ниже - образцы
         и стоимость оригиналов, которые можно заказать с доставкой по почте.</p>
    </div>
  </div>
</section>

<section class="section">
  <div class="container">
    <?php if ($byItem): ?>
    <div class="grid grid-3">
      <?php foreach ($byItem as $item => $kinds): $ic = awards_page_icon_key($item); ?>
        <div class="card reveal">
          <div style="width:56px;height:56px;border-radius:50%;background:var(--gold-soft);color:var(--gold);border:1px solid var(--glass-brd);
                      display:flex;align-items:center;justify-content:center;margin-bottom:16px">
            <span style="width:28px;height:28px"><?= $icons[$ic] ?></span>
          </div>
          <h3><?= h($item) ?></h3>
          <ul style="list-style:none;padding:0;margin:0 0 18px">
            <?php foreach ($kinds as $kind => $price): ?>
              <li style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--line)">
                <span style="color:var(--muted)"><?= h($kindLabel[$kind] ?? $kind) ?></span>
                <b style="color:var(--gold-2)"><?= $price > 0 ? h(money($price)) : 'Бесплатно' ?></b>
              </li>
            <?php endforeach; ?>
          </ul>
          <a class="btn btn--primary btn--block" href="<?= url('/order-awards') ?>?competition=<?= urlencode($c['slug']) ?>">Заказать</a>
        </div>
      <?php endforeach; ?>
    </div>
    <?php else: ?>
      <p style="text-align:center;color:var(--muted)">Прайс наградного материала пока не заполнен. Обратитесь в Оргкомитет по контактам.</p>
    <?php endif; ?>
    <div style="text-align:center;margin-top:36px"><a class="btn btn--ghost" href="<?= url('/awards') ?>">Ко всем конкурсам</a></div>
  </div>
</section>
<?php
$content = ob_get_clean();
render_page('Награды «'.$c['name'].'»', $content, [
    'active' => '/awards',
    'meta' => 'Образцы наградного материала и прайс конкурса «'.$c['name'].'»: дипломы, кубки, медали. КЦ «Музыкальный Мир».',
]);
