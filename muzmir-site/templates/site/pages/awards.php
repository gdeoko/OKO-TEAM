<?php
/** Образцы наград — витрина по конкурсам. */
$comps = all("SELECT * FROM competitions WHERE status != 'draft' ORDER BY sort");

$icoAward = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 2l3 7h7l-5.5 4 2 7L12 16l-6.5 4 2-7L2 9h7z"/></svg>';
$icoArrow = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';

ob_start(); ?>
<section class="section section--parchment">
  <div class="container">
    <div class="section-head reveal">
      <p class="eyebrow">Награды</p>
      <h2>Образцы наград</h2>
      <p>Каждый участник получает наградной материал в электронном виде. По желанию можно заказать оригинал -
         кубок, статуэтку, медаль или диплом на плотной бумаге с печатью. Выберите конкурс, чтобы увидеть образцы
         и прайс наградного материала.</p>
    </div>
  </div>
</section>

<section class="section">
  <div class="container">
    <?php if ($comps): ?>
    <div class="grid grid-3">
      <?php foreach ($comps as $c): ?>
        <div class="card comp-card reveal">
          <div class="cc-cover"><?= h($c['name']) ?></div>
          <div class="cc-body">
            <span class="badge badge--<?= $c['status']==='open' ? 'open' : 'closed' ?>"><?= $c['status']==='open' ? 'Приём открыт' : ($c['status']==='judging' ? 'Идёт оценка' : 'Завершён') ?></span>
            <span class="badge badge--intl"><?= $c['type']==='international' ? 'Международный' : 'Всероссийский' ?></span>
            <h3 style="margin-top:12px;display:flex;align-items:center;gap:10px">
              <span style="width:26px;height:26px;color:var(--gold-dark);flex:none"><?= $icoAward ?></span>
              <?= h($c['name']) ?>
            </h3>
            <p style="color:var(--muted)">Образцы наградного материала и прайс на оригиналы дипломов, кубков и медалей.</p>
            <a class="btn btn--ghost btn--block" href="<?= url('/awards/'.$c['slug']) ?>">
              Ознакомиться <span style="width:18px;height:18px"><?= $icoArrow ?></span>
            </a>
          </div>
        </div>
      <?php endforeach; ?>
    </div>
    <?php else: ?>
      <p style="text-align:center;color:var(--muted)">Конкурсы пока не добавлены.</p>
    <?php endif; ?>
  </div>
</section>
<?php
$content = ob_get_clean();
render_page('Образцы наград', $content, ['active' => '/awards', 'meta' => 'Образцы наградного материала КЦ «Музыкальный Мир»: дипломы, кубки, медали, статуэтки лауреатов по каждому конкурсу.']);
