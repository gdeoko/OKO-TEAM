<?php
/** Контакты: премиум-блок (карточки), телефоны, почта, адрес, режим работы, соцсети, карта, форма обратной связи. */

/* Телефоны берём из конфигурации. Второй номер показывается только если он задан в cfgv - без хардкода. */
$phone1     = (string) cfgv('org_phone', '');
$phone1Raw  = (string) cfgv('org_phone_raw', '');
$phone2     = (string) cfgv('org_phone2', '');
$phone2Raw  = (string) cfgv('org_phone2_raw', '');
$hasTwo     = $phone2 !== '';

$ico = [
  'phone' => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8.1 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.8 2.2z"/></svg>',
  'mail'  => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg>',
  'pin'   => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="3"/></svg>',
  'clock' => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
  'vk'    => '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12.9 16.7c-5 0-8.2-3.5-8.3-9.2h2.6c.1 4.2 2 6 3.5 6.4V7.5h2.4v3.7c1.5-.2 3-1.8 3.6-3.7h2.4c-.4 2.3-2 3.9-3.1 4.6 1.1.6 2.9 2 3.6 4.6h-2.6c-.6-1.8-2-3.2-3.9-3.5v3.5h-.2z"/></svg>',
  'tg'    => '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M21.9 4.3 18.7 19c-.2 1-.9 1.3-1.7.8l-4.7-3.5-2.3 2.2c-.3.3-.5.5-1 .5l.4-4.9L18 5.6c.4-.3-.1-.5-.6-.2L6.9 12l-4.6-1.4c-1-.3-1-1 .2-1.5L20.7 2.9c.8-.3 1.5.2 1.2 1.4z"/></svg>',
  'shield'=> '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2 4 5v6c0 5 3.4 8.5 8 11 4.6-2.5 8-6 8-11V5l-8-3z"/><path d="m9 12 2 2 4-4"/></svg>',
];

ob_start(); ?>
<style>
.contact-info,.contact-form{position:relative;overflow:hidden}
.contact-info::after{content:"";position:absolute;right:-50px;bottom:-50px;width:180px;height:180px;border-radius:50%;
  background:radial-gradient(circle,var(--gold-soft),transparent 70%);pointer-events:none;z-index:0}
.contact-info>*,.contact-form>*{position:relative;z-index:1}
.contact-list{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:2px}
.contact-row{display:flex;gap:16px;align-items:flex-start;padding:15px 10px 15px 8px;border-bottom:1px solid var(--line);border-radius:12px;transition:background .25s}
.contact-row:last-child{border-bottom:0}
@media(hover:hover){.contact-row:hover{background:var(--gold-soft)}.contact-row:hover .ic{background:var(--grad-gold);color:var(--gold-fg);transform:translateY(-2px)}}
.contact-row .ic{flex:0 0 46px;width:46px;height:46px;border-radius:14px;display:flex;align-items:center;justify-content:center;
  background:var(--gold-soft);border:1px solid var(--glass-brd);color:var(--gold-ink);box-shadow:inset 0 0 18px rgba(201,168,76,.08);
  transition:background .25s,color .25s,transform .25s}
[data-theme="dark"] .contact-row .ic{color:var(--gold)}
.contact-row .ic svg{width:22px;height:22px}
.contact-actions{display:flex;flex-wrap:wrap;gap:10px;margin-top:20px}
.contact-actions .btn{flex:1 1 auto;min-width:160px;text-align:center;justify-content:center}
.contact-row .cr-body{min-width:0;flex:1}
.contact-row .cr-label{display:block;font-size:.78rem;letter-spacing:.06em;text-transform:uppercase;color:var(--muted);margin-bottom:3px}
.contact-row .cr-value{font-family:var(--ff-serif);font-weight:700;font-size:1.08rem;color:var(--text);line-height:1.25;overflow-wrap:anywhere}
.contact-row .cr-value a{color:inherit;text-decoration:none;transition:color .2s}
.contact-row .cr-value a:hover{color:var(--gold-2)}
.contact-row .cr-sub{display:block;font-size:.86rem;color:var(--muted);margin-top:3px}
.contact-social{display:flex;gap:12px;flex-wrap:wrap;margin-top:2px}
.contact-social a{display:inline-flex;align-items:center;gap:8px;padding:9px 15px;border-radius:999px;
  background:var(--panel);border:1px solid var(--glass-brd);color:var(--text);text-decoration:none;font-weight:600;font-size:.92rem;
  min-height:44px;transition:transform .2s,border-color .2s,box-shadow .2s}
.contact-social a:hover{transform:translateY(-2px);border-color:var(--gold);box-shadow:var(--shadow-card)}
.contact-social a svg{width:20px;height:20px;color:var(--gold-ink)}
[data-theme="dark"] .contact-social a svg{color:var(--gold)}
.contact-note{display:flex;gap:10px;align-items:flex-start;margin:18px 0 0;padding:12px 14px;border-radius:var(--radius-sm);
  background:var(--gold-soft);border:1px solid var(--glass-brd)}
.contact-note svg{width:18px;height:18px;flex:0 0 18px;margin-top:1px;color:var(--gold-ink)}
[data-theme="dark"] .contact-note svg{color:var(--gold)}
.contact-note span{font-size:.86rem;color:var(--text-dim);line-height:1.4}
.map-frame{border-radius:var(--radius);overflow:hidden;box-shadow:var(--shadow-card);border:1px solid var(--glass-brd)}
.map-head{display:flex;align-items:center;gap:12px;padding:14px 18px;background:var(--panel);border-bottom:1px solid var(--glass-brd);backdrop-filter:blur(10px)}
.map-head .ic{flex:none;width:38px;height:38px;border-radius:12px;display:flex;align-items:center;justify-content:center;
  background:var(--gold-soft);border:1px solid var(--glass-brd);color:var(--gold-ink)}
[data-theme="dark"] .map-head .ic{color:var(--gold)}
.map-head .ic svg{width:20px;height:20px}
.map-head .m-body{min-width:0;flex:1}
.map-head .m-label{display:block;font-size:.74rem;letter-spacing:.06em;text-transform:uppercase;color:var(--muted)}
.map-head .m-addr{font-family:var(--ff-serif);font-weight:700;color:var(--text);line-height:1.25;overflow-wrap:anywhere}
.map-head .m-open{flex:none;display:inline-flex;align-items:center;gap:7px;padding:9px 15px;min-height:42px;border-radius:999px;
  border:1.5px solid var(--gold);color:var(--gold-ink);font-weight:700;font-size:.88rem;text-decoration:none;white-space:nowrap;transition:background .2s,color .2s}
[data-theme="dark"] .map-head .m-open{color:var(--gold)}
.map-head .m-open:hover{background:var(--grad-gold);color:var(--gold-fg);border-color:transparent}
.map-head .m-open svg{width:16px;height:16px}
.map-frame iframe{display:block;width:100%;height:clamp(300px,52vw,460px);border:0}
@media(max-width:560px){.map-head{flex-wrap:wrap}.map-head .m-open{width:100%;justify-content:center}}
</style>

<section class="section">
  <div class="container">
    <div class="section-head reveal">
      <p class="eyebrow">Свяжитесь с нами</p>
      <h2>Контакты</h2>
      <div class="gold-rule"></div>
    </div>

    <div class="grid grid-2">
      <div class="card contact-info reveal">
        <h3 style="margin-top:0">Как с нами связаться</h3>
        <ul class="contact-list">
          <li class="contact-row">
            <span class="ic"><?= $ico['phone'] ?></span>
            <div class="cr-body">
              <span class="cr-label"><?= $hasTwo ? 'Колл-центр' : 'Телефон' ?></span>
              <div class="cr-value"><a href="tel:<?= h($phone1Raw) ?>"><?= h($phone1) ?></a></div>
              <?php if ($hasTwo): ?>
                <span class="cr-label" style="margin-top:12px">Основной</span>
                <div class="cr-value"><a href="tel:<?= h($phone2Raw) ?>"><?= h($phone2) ?></a></div>
              <?php endif; ?>
            </div>
          </li>
          <li class="contact-row">
            <span class="ic"><?= $ico['mail'] ?></span>
            <div class="cr-body">
              <span class="cr-label">Электронная почта</span>
              <div class="cr-value"><a href="mailto:<?= h(cfgv('org_email')) ?>"><?= h(cfgv('org_email')) ?></a></div>
            </div>
          </li>
          <li class="contact-row">
            <span class="ic"><?= $ico['pin'] ?></span>
            <div class="cr-body">
              <span class="cr-label">Адрес</span>
              <div class="cr-value"><?= h(cfgv('org_address')) ?></div>
            </div>
          </li>
          <li class="contact-row">
            <span class="ic"><?= $ico['clock'] ?></span>
            <div class="cr-body">
              <span class="cr-label">Режим работы</span>
              <div class="cr-value" style="font-size:1rem;font-weight:600"><?= h(cfgv('org_hours')) ?></div>
            </div>
          </li>
          <li class="contact-row">
            <span class="ic"><?= $ico['vk'] ?></span>
            <div class="cr-body">
              <span class="cr-label">Мы в социальных сетях</span>
              <div class="contact-social">
                <a href="<?= h(cfgv('org_vk')) ?>" target="_blank" rel="noopener"><?= $ico['vk'] ?><span>ВКонтакте</span></a>
                <a href="<?= h(cfgv('org_tg_channel')) ?>" target="_blank" rel="noopener"><?= $ico['tg'] ?><span>Telegram</span></a>
              </div>
            </div>
          </li>
        </ul>

        <div class="contact-actions">
          <a class="btn btn--primary" href="tel:<?= h($hasTwo ? $phone2Raw : $phone1Raw) ?>"><?= $ico['phone'] ?><span>Позвонить</span></a>
          <a class="btn btn--ghost" href="https://yandex.ru/maps/?text=<?= urlencode(cfgv('org_address')) ?>&z=16" target="_blank" rel="noopener"><?= $ico['pin'] ?><span>Проложить маршрут</span></a>
        </div>

        <div class="contact-note">
          <?= $ico['shield'] ?>
          <span>Звоните с открытого номера - скрытые номера блокируются системой безопасности колл-центра. Результаты конкурсов публикуются только во «ВКонтакте».</span>
        </div>
        <p style="opacity:.7;font-size:.85rem;margin:16px 0 0"><?= h(cfgv('org_reg')) ?></p>
      </div>

      <div class="card contact-form reveal">
        <h3 style="margin-top:0">Написать нам</h3>
        <p style="color:var(--muted);margin-top:0;font-size:.94rem">Оставьте сообщение - Оргкомитет ответит Вам в рабочее время.</p>
        <form method="post" action="<?= url('/api/v1/feedback') ?>" onsubmit="return muzmirFeedback(event)" novalidate>
          <?= csrf_field() ?>
          <div class="field">
            <label for="fb_name">Имя</label>
            <input type="text" id="fb_name" name="name" autocomplete="name" required>
          </div>
          <div class="field">
            <label for="fb_contact">Электронная почта или телефон</label>
            <input type="text" id="fb_contact" name="contact" autocomplete="email" required>
          </div>
          <div class="field">
            <label for="fb_message">Сообщение</label>
            <textarea id="fb_message" name="message" rows="5" required></textarea>
          </div>
          <button class="btn btn--primary btn--block" type="submit">Отправить сообщение</button>
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
    <div class="map-frame reveal">
      <div class="map-head">
        <span class="ic"><?= $ico['pin'] ?></span>
        <div class="m-body">
          <span class="m-label">Адрес</span>
          <div class="m-addr"><?= h(cfgv('org_address')) ?></div>
        </div>
        <a class="m-open" href="https://yandex.ru/maps/?text=<?= urlencode(cfgv('org_address')) ?>&z=16" target="_blank" rel="noopener">
          <?= $ico['pin'] ?><span>Открыть в Картах</span>
        </a>
      </div>
      <iframe src="https://yandex.ru/map-widget/v1/?text=<?= urlencode(cfgv('org_address')) ?>&z=16"
              loading="lazy" title="Культурный центр «Музыкальный Мир» на карте, <?= h(cfgv('org_address')) ?>"></iframe>
    </div>
  </div>
</section>

<script>
function muzmirFeedback(e) {
  e.preventDefault();
  var f = e.target;
  var btn = f.querySelector('button[type="submit"]');
  function notify(msg, type) {
    if (typeof window.toast === 'function') window.toast(msg, type || 'success');
    else alert(msg);
  }
  if (btn) { btn.classList.add('is-loading'); btn.disabled = true; }
  fetch(f.action, { method: 'POST', body: new FormData(f) })
    .then(function (r) { return r.json().catch(function () { return {}; }); })
    .then(function (d) {
      notify((d && d.message) || 'Спасибо! Ваше сообщение отправлено.', 'success');
      f.reset();
    })
    .catch(function () { notify('Спасибо! Мы свяжемся с Вами.', 'success'); })
    .then(function () { if (btn) { btn.classList.remove('is-loading'); btn.disabled = false; } });
  return false;
}
</script>
<?php
$content = ob_get_clean();
render_page('Контакты', $content, ['active' => '/contacts', 'meta' => 'Контакты Культурного центра «Музыкальный Мир»: телефоны, электронная почта, адрес на улице Солянка, режим работы и форма обратной связи.']);
