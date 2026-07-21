<?php
/** Вопросы и ответы: аккордеон из таблицы faq. */
$faqs = all("SELECT * FROM faq WHERE active=1 ORDER BY sort, id");

ob_start(); ?>
<section class="section">
  <div class="container" style="max-width:780px">
    <div class="section-head reveal">
      <p class="eyebrow">Обратная связь</p>
      <h2>Вопросы и ответы</h2>
      <div class="gold-rule"></div>
    </div>

    <?php if (!$faqs): ?>
      <div class="card reveal" style="text-align:center">
        <p style="color:var(--ink);margin:0">Раздел с вопросами пока наполняется. Если у Вас есть вопрос, напишите на <a href="mailto:<?= h(cfgv('org_email')) ?>"><?= h(cfgv('org_email')) ?></a> или воспользуйтесь формой обратной связи на странице «<a href="<?= url('/contacts') ?>">Контакты</a>».</p>
      </div>
    <?php else: ?>
      <div class="reveal">
        <?php foreach ($faqs as $f): ?>
          <div class="acc-item">
            <div class="acc-q">
              <span><?= h($f['question']) ?></span>
              <span class="chev"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg></span>
            </div>
            <div class="acc-a"><p><?= h($f['answer']) ?></p></div>
          </div>
        <?php endforeach; ?>
      </div>
    <?php endif; ?>
  </div>
</section>
<?php
$content = ob_get_clean();
render_page('Вопросы и ответы', $content, ['active' => '/faq', 'meta' => 'Ответы на частые вопросы об участии в конкурсах Культурного центра «Музыкальный Мир»: заявки, оплата, результаты, дипломы.']);
