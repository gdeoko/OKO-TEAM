<?php
/** Контакты: адрес, телефон, email, часы, соцсети, карта, форма обратной связи. */
ob_start(); ?>
<section class="section">
  <div class="container">
    <div class="section-head reveal">
      <p class="eyebrow">Свяжитесь с нами</p>
      <h2>Контакты</h2>
      <div class="gold-rule"></div>
    </div>

    <div class="grid grid-2">
      <div class="card reveal">
        <h3>Реквизиты и контакты</h3>
        <p style="color:var(--text-dim)"><strong>Адрес:</strong> <?= h(cfgv('org_address')) ?></p>
        <p style="color:var(--text-dim);margin-bottom:4px"><strong>Телефон:</strong> <a href="tel:<?= h(cfgv('org_phone_raw')) ?>"><?= h(cfgv('org_phone')) ?></a></p>
        <p style="color:var(--muted);font-size:.85rem">Скрытые номера блокируются системой безопасности колл-центра.</p>
        <p style="color:var(--text-dim)"><strong>Электронная почта:</strong> <a href="mailto:<?= h(cfgv('org_email')) ?>"><?= h(cfgv('org_email')) ?></a></p>
        <p style="color:var(--text-dim)"><strong>Часы работы:</strong> <?= h(cfgv('org_hours')) ?></p>
        <p style="color:var(--text-dim)"><strong>Мы в социальных сетях:</strong>
          <a href="<?= h(cfgv('org_vk')) ?>" target="_blank" rel="noopener">ВКонтакте</a> ·
          <a href="<?= h(cfgv('org_tg_channel')) ?>" target="_blank" rel="noopener">Telegram</a>
        </p>
        <p style="opacity:.7;font-size:.85rem;margin-bottom:0"><?= h(cfgv('org_reg')) ?></p>
      </div>

      <div class="card reveal">
        <h3>Написать нам</h3>
        <form method="post" action="<?= url('/api/v1/feedback') ?>" onsubmit="return muzmirFeedback(event)">
          <?= csrf_field() ?>
          <div class="field">
            <label for="fb_name">Имя</label>
            <input type="text" id="fb_name" name="name" required>
          </div>
          <div class="field">
            <label for="fb_contact">Электронная почта или телефон</label>
            <input type="text" id="fb_contact" name="contact" required>
          </div>
          <div class="field">
            <label for="fb_message">Сообщение</label>
            <textarea id="fb_message" name="message" rows="5" required></textarea>
          </div>
          <button class="btn btn--primary btn--block" type="submit">Отправить</button>
        </form>
      </div>
    </div>
  </div>
</section>

<section class="section section--tint">
  <div class="container">
    <div class="section-head reveal">
      <p class="eyebrow">Как нас найти</p>
      <h2>Мы на карте</h2>
      <div class="gold-rule"></div>
    </div>
    <div class="reveal" style="border-radius:var(--radius);overflow:hidden;box-shadow:var(--shadow-card)">
      <iframe src="https://yandex.ru/map-widget/v1/?text=<?= urlencode(cfgv('org_address')) ?>&z=16"
              width="100%" height="420" frameborder="0" loading="lazy"
              title="Культурный центр «Музыкальный Мир» на карте, <?= h(cfgv('org_address')) ?>"></iframe>
    </div>
  </div>
</section>

<script>
function muzmirFeedback(e) {
  e.preventDefault();
  var f = e.target;
  fetch(f.action, { method: 'POST', body: new FormData(f) })
    .then(function (r) { return r.json(); })
    .then(function (d) { alert(d.message || 'Спасибо! Ваше сообщение отправлено.'); f.reset(); })
    .catch(function () { alert('Спасибо! Мы свяжемся с Вами.'); });
  return false;
}
</script>
<?php
$content = ob_get_clean();
render_page('Контакты', $content, ['active' => '/contacts', 'meta' => 'Контакты Культурного центра «Музыкальный Мир»: адрес, телефон, электронная почта, часы работы, форма обратной связи.']);
