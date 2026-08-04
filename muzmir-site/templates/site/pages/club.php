<?php
/** Клуб постоянных участников: платная ежемесячная подписка с привилегиями.
 *  Для активного члена Клуба показываем статус и выгоды, форму оплаты скрываем. */

// Модуль членства подключаем лениво (глобально он не автозагружается).
$__clubCore = (defined('BASE_PATH') ? BASE_PATH : dirname(__DIR__, 3)) . '/core/club.php';
if (!function_exists('club_is_active') && is_file($__clubCore)) require_once $__clubCore;

$price = (int) setting('club_price', '1000');
$u = current_user();
$uid = (int) ($u['id'] ?? 0);

$isMember = $uid > 0 && function_exists('club_is_active') && club_is_active($uid);
$status   = ($uid > 0 && function_exists('club_status')) ? club_status($uid)
                                                          : ['active' => false, 'expires_at' => null, 'started_at' => null, 'discount' => 0];
$discount = (int) ($status['discount'] ?? 0);
if ($discount <= 0) $discount = (int) setting('club_discount', '25');
if ($discount <= 0) $discount = 25;

/* Полный список привилегий Клуба (10). Иконки — только SVG stroke=currentColor. */
$benefits = [
    ['ic' => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="7.5" cy="7.5" r="2.2"/><circle cx="16.5" cy="16.5" r="2.2"/><path d="M19 5 5 19"/></svg>',
      't' => 'Скидка ' . $discount . '% на всё платное',
      'd' => 'Дипломы, кубки, статуэтки, медали — оригиналы и электронные версии. Применяется автоматически'],
    ['ic' => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/></svg>',
      't' => 'Результаты за 3 рабочих дня',
      'd' => 'Вместо 5. Воскресенье — нерабочий день, отсчёт со следующего дня после подачи заявки'],
    ['ic' => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="8" width="18" height="4" rx="1"/><path d="M5 12v8a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-8M12 8v13"/><path d="M12 8s-1.5-4.5-4.5-4.5A2.25 2.25 0 0 0 7.5 8M12 8s1.5-4.5 4.5-4.5A2.25 2.25 0 0 1 16.5 8"/></svg>',
      't' => 'Бесплатный конкурс каждый месяц',
      'd' => '1 заявка с 1 номером в месяц — бесплатно, плюс бесплатный электронный диплом'],
    ['ic' => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 2l3 7h7l-5.5 4 2 7L12 16l-6.5 4 2-7L2 9h7z"/></svg>',
      't' => 'Закрытые конкурсы Клуба',
      'd' => 'Отдельные конкурсы только для членов Клуба: меньше участников, особое внимание жюри'],
    ['ic' => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6z"/><circle cx="12" cy="12" r="2.6"/></svg>',
      't' => 'Ранний доступ к результатам',
      'd' => 'Заявки членов Клуба проверяются вне общей очереди — итоги Вы узнаёте раньше остальных'],
    ['ic' => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M3 12a9 9 0 0 1 18 0v5a2 2 0 0 1-2 2h-2v-6h4M3 12v5a2 2 0 0 0 2 2h2v-6H3"/><path d="M17 19a2 2 0 0 1-2 2h-3"/></svg>',
      't' => 'Приоритетная поддержка',
      'd' => 'Ответ в течение 24 часов: помощь с заявками, документами и наградами — в первую очередь'],
    ['ic' => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="12" cy="8" r="6"/><path d="M8.2 13.9 7 22l5-3 5 3-1.2-8.1"/></svg>',
      't' => 'Спецпредложения на награды',
      'd' => 'Особые условия на медали, кубки и наградную атрибутику — только для членов Клуба'],
    ['ic' => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M22 10 12 5 2 10l10 5 10-5z"/><path d="M6 12v5c0 1.5 2.7 3 6 3s6-1.5 6-3v-5M22 10v6"/></svg>',
      't' => 'Мастер-классы и разборы',
      'd' => 'Закрытые мастер-классы и разбор конкурсных номеров от экспертов — для роста Ваших учеников'],
    ['ic' => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="2" y="5" width="20" height="14" rx="2"/><circle cx="8" cy="11" r="2"/><path d="M5 16c.6-1.6 1.7-2.4 3-2.4s2.4.8 3 2.4M15 9h4M15 13h4"/></svg>',
      't' => 'Именная карта участника',
      'd' => 'Электронная карта члена Клуба — подтверждает статус и привилегии постоянного участника'],
    ['ic' => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M21 11.5a8.38 8.38 0 0 1-8.5 8.5 8.5 8.5 0 0 1-3.8-.9L3 21l1.9-5.7A8.5 8.5 0 1 1 21 11.5z"/></svg>',
      't' => 'Клубный чат участников',
      'd' => 'Закрытое сообщество участников и педагогов: встречи с жюри, обмен опытом', 'soon' => true],
];

$expiresRu = !empty($status['expires_at']) ? ru_date(substr((string) $status['expires_at'], 0, 10)) : '';
$startedRu = !empty($status['started_at']) ? ru_date(substr((string) $status['started_at'], 0, 10)) : '';

ob_start(); ?>
<style>
/* Скоуп-фикс: в общем style.css и .eyebrow, и .section-head h2 заданы display:inline-block,
   поэтому при коротком заголовке эйброу и h2 встают в одну строку. Возвращаем эйброу
   на отдельную строку над заголовком. */
.section-head .eyebrow{display:block}
html{scroll-behavior:smooth}
#club-benefits,#club-join,#club-pay{scroll-margin-top:86px}

/* --- Герой: компактно, CTA + якорные чипы + инфографика --- */
.club-hero-cta{display:flex;align-items:center;justify-content:center;gap:14px;flex-wrap:wrap;margin-top:18px}
.club-hero-cta .btn svg{width:17px;height:17px;fill:none;stroke:currentColor;stroke-width:2.2;stroke-linecap:round;stroke-linejoin:round}
.club-hero-price{font-family:var(--ff-display);font-size:1.15rem;color:var(--gold-2);letter-spacing:.02em;white-space:nowrap}
.club-hero-price span{font-size:.8rem;color:var(--muted);font-family:var(--ff-body)}
.club-chipnav{display:flex;gap:10px;flex-wrap:nowrap;overflow-x:auto;padding:4px 2px 10px;margin:16px 0 0;
  -webkit-overflow-scrolling:touch;scrollbar-width:none;justify-content:center}
.club-chipnav::-webkit-scrollbar{display:none}
.club-chip{flex:none;display:inline-flex;align-items:center;gap:8px;padding:9px 16px;border-radius:999px;
  background:var(--glass-card);backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px);
  border:1px solid var(--glass-brd2);color:var(--text);text-decoration:none;font-size:.85rem;font-weight:700;
  white-space:nowrap;word-break:normal;hyphens:none;transition:transform .2s ease,border-color .2s ease,color .2s ease}
.club-chip svg{width:15px;height:15px;color:var(--gold);fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
.club-chip:hover{transform:translateY(-2px);border-color:var(--gold);color:var(--gold-2,var(--gold))}

/* Инфографика: три ключевые цифры */
.club-stats{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;max-width:640px;margin:22px auto 0}
.club-stat{padding:16px 10px 14px;border-radius:16px;text-align:center;
  background:var(--glass-card);backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px);
  border:1px solid var(--glass-brd2);transition:transform .25s ease,border-color .25s ease}
.club-stat:hover{transform:translateY(-3px);border-color:var(--gold)}
.club-stat b{display:block;font-family:var(--ff-display);font-weight:400;font-size:clamp(1.4rem,4vw,1.9rem);
  letter-spacing:.02em;color:var(--gold-2);line-height:1.1}
.club-stat span{display:block;margin-top:4px;color:var(--muted);font-size:.74rem;line-height:1.35;word-break:normal;hyphens:none}
[data-theme="dark"] .club-stat b{color:var(--gold)}

/* --- Привилегии: компактные карточки, 2 колонки на мобиле --- */
.club-ben-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(215px,1fr));gap:14px}
.club-ben{position:relative;padding:20px 14px 16px;text-align:center;border-radius:18px;
  background:var(--glass-card);backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px);
  border:1px solid var(--glass-brd2);
  transition:transform .28s ease,box-shadow .28s ease,border-color .28s ease}
.club-ben:hover{transform:translateY(-5px);border-color:var(--gold);box-shadow:0 14px 34px rgba(199,147,34,.16)}
.club-ben-num{position:absolute;top:10px;left:12px;font-family:var(--ff-display);font-size:.95rem;
  color:var(--gold);opacity:.55;letter-spacing:.04em}
.club-medal{position:relative;width:58px;height:58px;margin:0 auto 12px;border-radius:50%;
  display:flex;align-items:center;justify-content:center;color:var(--gold);
  background:radial-gradient(circle at 32% 28%,rgba(233,197,103,.42),rgba(199,147,34,.10) 72%);
  border:1px solid color-mix(in srgb,var(--gold) 45%,transparent);
  box-shadow:0 6px 18px rgba(199,147,34,.18)}
.club-medal::after{content:"";position:absolute;inset:-5px;border-radius:50%;
  border:1px solid color-mix(in srgb,var(--gold) 30%,transparent);opacity:0;transition:opacity .25s ease}
.club-ben:hover .club-medal::after{opacity:1;animation:clubRing 1.6s ease-out infinite}
@keyframes clubRing{0%{transform:scale(.9);opacity:.7}100%{transform:scale(1.25);opacity:0}}
.club-medal span{width:27px;height:27px;display:block}
.club-medal svg{width:100%;height:100%}
.club-ben h3{margin:0 0 5px;font-size:.98rem;line-height:1.3;word-break:normal;hyphens:none}
.club-ben p{margin:0;color:var(--muted);font-size:.8rem;line-height:1.45;word-break:normal;hyphens:none}
.club-soon{position:absolute;top:10px;right:10px;padding:3px 9px;border-radius:999px;font-size:.62rem;
  font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:var(--gold-fg,#fff);background:var(--grad-gold)}
@media (max-width:760px){
  .club-ben-grid{grid-template-columns:repeat(2,1fr);gap:10px}
  .club-ben{padding:16px 10px 13px}
  .club-medal{width:48px;height:48px;margin-bottom:10px}
  .club-medal span{width:22px;height:22px}
  .club-ben h3{font-size:.86rem}
  .club-ben p{font-size:.73rem}
}

/* --- Шаги вступления --- */
.club-steps{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}
.club-step-card{position:relative;padding:26px 20px 22px;border-radius:18px;
  background:var(--glass-card);backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px);
  border:1px solid var(--glass-brd2);transition:transform .28s ease,border-color .28s ease}
.club-step-card:hover{transform:translateY(-4px);border-color:var(--gold)}
.club-step-num{width:44px;height:44px;border-radius:50%;display:flex;align-items:center;justify-content:center;
  margin-bottom:14px;background:var(--grad-gold);color:var(--gold-fg,#fff);
  font-family:var(--ff-display);font-size:1.25rem;box-shadow:0 6px 16px rgba(199,147,34,.3)}
.club-step-card h3{margin:0 0 6px;word-break:normal;hyphens:none}
.club-step-card p{margin:0;color:var(--muted);font-size:.9rem;line-height:1.5}
@media (max-width:760px){.club-steps{grid-template-columns:1fr}}

/* --- Оплата --- */
.club-price-card{max-width:420px;margin:0 auto;text-align:center;padding:36px 30px}
.club-price{font-family:var(--ff-display);letter-spacing:.02em;font-size:2.8rem;color:var(--gold-2);margin:6px 0}
.club-price span{font-size:1.1rem;color:var(--muted);font-family:var(--ff-body)}
.club-form .field{text-align:left}
.club-note{font-size:.82rem;color:var(--muted);margin-top:14px}

/* --- Карточка активного члена Клуба --- */
.club-member-card{max-width:560px;margin:0 auto;text-align:center;padding:38px 30px}
.club-crest{width:96px;height:96px;margin:0 auto 8px;display:block;object-fit:contain}
.club-badge{display:inline-flex;align-items:center;gap:8px;padding:7px 16px;border-radius:999px;
  background:var(--grad-gold);color:var(--gold-fg);font-family:var(--ff-body);font-weight:800;
  font-size:.82rem;letter-spacing:.04em;text-transform:uppercase;box-shadow:var(--shadow-btn)}
.club-badge .dot{width:9px;height:9px;border-radius:50%;background:var(--gold-fg);position:relative}
.club-badge .dot::after{content:"";position:absolute;inset:-5px;border-radius:50%;
  border:1.5px solid var(--gold-fg);opacity:.5;animation:clubPulse 2.2s ease-out infinite}
@keyframes clubPulse{0%{transform:scale(.6);opacity:.6}100%{transform:scale(1.4);opacity:0}}
.club-until{font-family:var(--ff-display);font-size:clamp(1.5rem,3.4vw,2.1rem);letter-spacing:.01em;
  color:var(--gold-2);margin:16px 0 4px}
.club-member-meta{color:var(--muted);font-size:.9rem;margin:0}
.club-benefits-list{list-style:none;margin:26px 0 0;padding:0;display:grid;gap:12px;text-align:left}
.club-benefits-list li{display:flex;gap:14px;align-items:flex-start;padding:14px 16px;border-radius:14px;
  background:var(--gold-soft);border:1px solid var(--line)}
.club-benefits-list .cb-ic{flex:none;width:38px;height:38px;border-radius:50%;background:var(--grad-gold);
  color:var(--gold-fg);display:flex;align-items:center;justify-content:center}
.club-benefits-list .cb-ic span{width:20px;height:20px;display:block}
.club-benefits-list .cb-ic svg{width:100%;height:100%}
.club-benefits-list b{font-family:var(--ff-body);font-weight:800;display:block;margin-bottom:2px}
.club-benefits-list p{margin:0;color:var(--muted);font-size:.88rem;line-height:1.45}
.club-benefits-list .club-soon-inline{display:inline-block;margin-left:8px;padding:2px 9px;border-radius:999px;
  font-size:.64rem;font-weight:800;letter-spacing:.06em;text-transform:uppercase;vertical-align:2px;
  color:var(--gold-fg,#fff);background:var(--grad-gold)}
.club-actions{margin-top:26px;display:flex;gap:12px;justify-content:center;flex-wrap:wrap}

[data-theme="dark"] .club-until{color:var(--gold)}
[data-theme="dark"] .club-benefits-list li{background:rgba(255,255,255,.03)}
@media (max-width:520px){.club-benefits-list li{padding:12px 13px}}
@media (prefers-reduced-motion:reduce){
  html{scroll-behavior:auto}
  .club-badge .dot::after{animation:none}
  .club-ben:hover .club-medal::after{animation:none;opacity:0}
  .club-chip,.club-ben,.club-stat,.club-step-card{transition:none}
}
</style>

<?php if ($isMember): ?>
<section class="section section--parchment">
  <div class="container" style="max-width:760px">
    <a class="aw-back" href="<?= url('/menu') ?>"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M11 6l-6 6 6 6"/></svg>Назад</a>
    <div class="reveal" style="text-align:center">
      <p class="eyebrow">Ваше членство</p>
      <h1 style="font-family:var(--ff-display);font-size:clamp(1.9rem,4vw,2.6rem);margin-bottom:.3em">Клуб постоянных участников</h1>
      <p>Спасибо, что вы с нами. Ваши привилегии активны и применяются автоматически при подаче заявок
        на платные конкурсы Культурного центра «Музыкальный Мир».</p>
    </div>
  </div>
</section>

<section class="section">
  <div class="container">
    <div class="card reveal club-member-card">
      <img class="club-crest" src="<?= h(asset('img/pechat_kc_muzmir.png')) ?>"
           alt="Печать Культурного центра «Музыкальный Мир»" width="96" height="96" loading="lazy">
      <div><span class="club-badge"><span class="dot"></span>Участник Клуба</span></div>
      <?php if ($expiresRu !== ''): ?>
        <p class="club-until">Вы участник Клуба до <?= h($expiresRu) ?></p>
      <?php else: ?>
        <p class="club-until">Вы участник Клуба</p>
      <?php endif; ?>
      <?php if ($startedRu !== ''): ?>
        <p class="club-member-meta">В Клубе с <?= h($startedRu) ?></p>
      <?php endif; ?>

      <ul class="club-benefits-list">
        <?php foreach ($benefits as $b): ?>
          <li>
            <span class="cb-ic"><span><?= $b['ic'] ?></span></span>
            <div><b><?= h($b['t']) ?><?php if (!empty($b['soon'])): ?><span class="club-soon-inline">Скоро</span><?php endif; ?></b><p><?= h($b['d']) ?></p></div>
          </li>
        <?php endforeach; ?>
      </ul>

      <div class="club-actions">
        <a class="btn btn--primary" href="<?= h(url('/cabinet')) ?>">Личный кабинет</a>
        <a class="btn btn--ghost" href="<?= h(url('/competitions')) ?>">Выбрать конкурс</a>
      </div>
      <p class="club-note">Членство продлевается ежемесячно. Скидка <?= (int) $discount ?>%
        применяется ко всем платежам автоматически.</p>
    </div>
  </div>
</section>

<?php else: ?>
<section class="section section--parchment">
  <div class="container" style="max-width:820px">
    <a class="aw-back" href="<?= url('/menu') ?>"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M11 6l-6 6 6 6"/></svg>Назад</a>
    <div class="reveal" style="text-align:center">
      <p class="eyebrow">Для постоянных участников</p>
      <h1 style="font-family:var(--ff-display);font-size:clamp(1.9rem,4vw,2.6rem);margin-bottom:.3em">Клуб постоянных участников</h1>
      <p style="margin-bottom:0">Ежемесячная подписка для тех, кто регулярно участвует в конкурсах Культурного центра
        «Музыкальный Мир»: скидка <?= (int) $discount ?>% на всё, быстрые результаты и закрытые конкурсы.</p>

      <div class="club-hero-cta">
        <a class="btn btn--primary" href="#club-pay">К оплате
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M6 13l6 6 6-6"/></svg></a>
        <span class="club-hero-price"><?= h(money($price)) ?> <span>/ месяц</span></span>
      </div>

      <nav class="club-chipnav" aria-label="Разделы страницы">
        <a class="club-chip" href="#club-benefits">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2l3 7h7l-5.5 4 2 7L12 16l-6.5 4 2-7L2 9h7z"/></svg>
          Привилегии</a>
        <a class="club-chip" href="#club-join">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
          Как вступить</a>
        <a class="club-chip" href="#club-pay">
          <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></svg>
          Оплата</a>
      </nav>

      <div class="club-stats reveal">
        <div class="club-stat"><b>−<?= (int) $discount ?>%</b><span>на всё платное: дипломы, кубки, медали</span></div>
        <div class="club-stat"><b>3 дня</b><span>результаты и дипломы вместо 5 рабочих дней</span></div>
        <div class="club-stat"><b>1 / мес</b><span>бесплатный конкурс + электронный диплом</span></div>
      </div>
    </div>
  </div>
</section>

<section class="section" id="club-benefits">
  <div class="container">
    <div class="section-head reveal"><p class="eyebrow">Привилегии</p><h2>Что даёт членство в Клубе</h2></div>
    <div class="club-ben-grid">
      <?php foreach ($benefits as $i => $b): ?>
        <div class="club-ben reveal" style="--i:<?= (int) ($i % 4) ?>">
          <span class="club-ben-num"><?= str_pad((string) ($i + 1), 2, '0', STR_PAD_LEFT) ?></span>
          <?php if (!empty($b['soon'])): ?><span class="club-soon">Скоро</span><?php endif; ?>
          <div class="club-medal"><span><?= $b['ic'] ?></span></div>
          <h3><?= h($b['t']) ?></h3>
          <p><?= h($b['d']) ?></p>
        </div>
      <?php endforeach; ?>
    </div>
  </div>
</section>

<section class="section" id="club-join">
  <div class="container">
    <div class="section-head reveal"><p class="eyebrow">Путь в Клуб</p><h2>Как вступить</h2></div>
    <div class="club-steps">
      <div class="club-step-card reveal" style="--i:0">
        <div class="club-step-num">1</div>
        <h3>Заполните форму</h3>
        <p>Укажите имя, электронную почту и телефон в форме ниже. Если Вы уже зарегистрированы на сайте - данные подставятся автоматически.</p>
      </div>
      <div class="club-step-card reveal" style="--i:1">
        <div class="club-step-num">2</div>
        <h3>Оплатите подписку</h3>
        <p>После отправки формы Вы перейдёте к оплате, либо счёт придёт на Вашу электронную почту. Оплата - раз в месяц.</p>
      </div>
      <div class="club-step-card reveal" style="--i:2">
        <div class="club-step-num">3</div>
        <h3>Пользуйтесь привилегиями</h3>
        <p>Скидка <?= (int) $discount ?>% и приоритетная проверка заявок включаются сразу после оплаты и применяются автоматически.</p>
      </div>
    </div>
  </div>
</section>

<section class="section section--tint" id="club-pay">
  <div class="container">
    <div class="section-head reveal"><p class="eyebrow">Оплата</p><h2>Одна подписка на месяц</h2></div>
    <div class="card reveal club-price-card">
      <p style="color:var(--muted)">Членство в Клубе</p>
      <div class="club-price"><?= h(money($price)) ?><span> / месяц</span></div>
      <p style="color:var(--muted);font-size:.92rem">Продление - ежемесячно. Отменить можно в любое время в личном кабинете.</p>

      <form class="club-form" id="clubJoinForm" style="margin-top:22px;text-align:left">
        <div class="field">
          <label for="cj_name">Имя и фамилия</label>
          <input type="text" id="cj_name" name="full_name" value="<?= h($u['full_name'] ?? '') ?>" placeholder="Иванова Мария Петровна" required>
        </div>
        <div class="field">
          <label for="cj_email">Электронная почта</label>
          <input type="email" id="cj_email" name="email" value="<?= h($u['email'] ?? '') ?>" placeholder="ваша@почта.рф" required>
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
    body.set('_csrf', <?= json_encode(csrf_token(), JSON_UNESCAPED_SLASHES) ?>);
    body.set('items', JSON.stringify([{ item: 'Клуб постоянных участников - месячная подписка', kind: 'club' }]));
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
<?php endif; ?>
<?php
$content = ob_get_clean();
render_page('Клуб постоянных участников', $content, [
    'active' => '/club',
    'meta'   => 'Клуб постоянных участников КЦ «Музыкальный Мир»: скидка ' . $discount . '% на всё, результаты за 3 дня, бесплатный конкурс каждый месяц и закрытые конкурсы.',
]);
