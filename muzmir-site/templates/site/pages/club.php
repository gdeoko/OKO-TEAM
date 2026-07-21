<?php
/** Клуб постоянных участников: платная годовая подписка с привилегиями. */

$price = (int) setting('club_price', '500');
$u = current_user();

$benefits = [
    ['ic' => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M20 12V8a2 2 0 0 0-2-2h-4l-2-2H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h4"/><path d="M14 14l6 6M20 14l-6 6"/></svg>',
      't' => 'Скидка 20%', 'd' => 'На организационный взнос во всех платных конкурсах Культурного центра'],
    ['ic' => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M13 2 3 14h8l-1 8 10-12h-8z"/></svg>',
      't' => 'Приоритетная модерация', 'd' => 'Заявки участников Клуба проверяются вне общей очереди'],
    ['ic' => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M21 11.5a8.38 8.38 0 0 1-8.5 8.5 8.5 8.5 0 0 1-3.8-.9L3 21l1.9-5.7A8.5 8.5 0 1 1 21 11.5z"/></svg>',
      't' => 'Закрытый чат', 'd' => 'Доступ к сообществу постоянных участников и педагогов в Telegram'],
    ['ic' => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 2l3 7h7l-5.5 4 2 7L12 16l-6.5 4 2-7L2 9h7z"/></svg>',
      't' => 'Встречи с жюри', 'd' => 'Онлайн-встречи с членами жюри: разбор номеров и ответы на вопросы'],
];

ob_start(); ?>
<style>
.club-price-card{max-width:420px;margin:0 auto;text-align:center;padding:36px 30px}
.club-price{font-family:var(--ff-display);letter-spacing:.02em;font-size:2.8rem;color:var(--gold-2);margin:6px 0}
.club-price span{font-size:1.1rem;color:var(--muted);font-family:var(--ff-body)}
.club-form .field{text-align:left}
.club-note{font-size:.82rem;color:var(--muted);margin-top:14px}
</style>

<section class="section section--parchment">
  <div class="container" style="max-width:760px;text-align:center">
    <div class="reveal">
      <p class="eyebrow">Для постоянных участников</p>
      <h1 style="font-family:var(--ff-display);font-size:clamp(1.9rem,4vw,2.6rem);margin-bottom:.3em">Клуб постоянных участников</h1>
      <p>Годовая подписка для тех, кто регулярно подаёт заявки на конкурсы Культурного центра «Музыкальный Мир»:
        скидки, приоритет и закрытое сообщество.</p>
    </div>
  </div>
</section>

<section class="section">
  <div class="container">
    <div class="section-head reveal"><p class="eyebrow">Преимущества</p><h2>Что даёт членство в Клубе</h2></div>
    <div class="grid grid-4">
      <?php foreach ($benefits as $b): ?>
        <div class="card reveal" style="text-align:center;padding:26px 20px">
          <div class="step ic" style="width:64px;height:64px;margin:0 auto 14px;border-radius:50%;background:var(--gold-soft);
            display:flex;align-items:center;justify-content:center;color:var(--gold)"><span style="width:30px;height:30px"><?= $b['ic'] ?></span></div>
          <h3><?= h($b['t']) ?></h3>
          <p style="color:var(--muted);font-size:.92rem"><?= h($b['d']) ?></p>
        </div>
      <?php endforeach; ?>
    </div>
  </div>
</section>

<section class="section section--tint">
  <div class="container">
    <div class="section-head reveal"><p class="eyebrow">Стоимость</p><h2>Одна подписка на год</h2></div>
    <div class="card reveal club-price-card">
      <p style="color:var(--muted)">Членство в Клубе</p>
      <div class="club-price"><?= h(money($price)) ?><span> / год</span></div>
      <p style="color:var(--muted);font-size:.92rem">Продление - раз в 12 месяцев. Отменить можно в любое время в личном кабинете.</p>

      <form class="club-form" id="clubJoinForm" style="margin-top:22px;text-align:left">
        <div class="field">
          <label for="cj_name">Имя и фамилия</label>
          <input type="text" id="cj_name" name="full_name" value="<?= h($u['full_name'] ?? '') ?>" placeholder="Иванова Мария Петровна" required>
        </div>
        <div class="field">
          <label for="cj_email">Электронная почта</label>
          <input type="email" id="cj_email" name="email" value="<?= h($u['email'] ?? '') ?>" placeholder="you@example.ru" required>
        </div>
        <div class="field">
          <label for="cj_phone">Телефон</label>
          <input type="tel" id="cj_phone" name="phone" value="<?= h($u['phone'] ?? '') ?>" placeholder="+7 (___) ___-__-__">
        </div>
        <button class="btn btn--primary btn--block" type="submit" id="cjSubmit">Вступить и оплатить</button>
        <p class="club-note" id="cjMsg"></p>
      </form>
    </div>
  </div>
</section>
<script>
(function () {
  var form = document.getElementById('clubJoinForm');
  var btn = document.getElementById('cjSubmit');
  var msg = document.getElementById('cjMsg');
  var price = <?= (int) $price ?>;
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var name = form.full_name.value.trim();
    var email = form.email.value.trim();
    if (name.length < 3) { msg.textContent = 'Укажите имя и фамилию.'; return; }
    if (!/^\S+@\S+\.\S+$/.test(email)) { msg.textContent = 'Проверьте электронную почту.'; return; }
    btn.disabled = true; msg.textContent = 'Оформляем...';
    var body = new URLSearchParams();
    body.set('full_name', name);
    body.set('email', email);
    body.set('phone', form.phone.value.trim());
    body.set('competition', 'Клуб постоянных участников');
    body.set('amount', String(price));
    body.set('items', JSON.stringify([{ name: 'Клуб постоянных участников - годовая подписка', price: price }]));
    fetch(<?= json_encode(url('/api/v1/order'), JSON_UNESCAPED_SLASHES) ?>, { method: 'POST', body: body })
      .then(function (r) { return r.json(); })
      .then(function (d) {
        btn.disabled = false;
        if (!d.ok) { msg.textContent = d.error || 'Не удалось оформить заявку.'; return; }
        if (d.payment && d.payment.confirmation_url) {
          window.location.href = d.payment.confirmation_url;
          return;
        }
        msg.textContent = 'Заявка на вступление принята (№' + d.order_id + '). Счёт на оплату придёт на Вашу почту.';
        form.reset();
      })
      .catch(function () { btn.disabled = false; msg.textContent = 'Не удалось оформить заявку, проверьте соединение.'; });
  });
})();
</script>
<?php
$content = ob_get_clean();
render_page('Клуб постоянных участников', $content, [
    'active' => '/club',
    'meta'   => 'Клуб постоянных участников КЦ «Музыкальный Мир»: скидка 20%, приоритетная модерация, закрытый чат и встречи с жюри.',
]);
