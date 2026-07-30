<?php
/**
 * Меню — отдельная страница со всеми разделами (не всплывающий шитх).
 * Единый анимационный фон, компактная сетка карточек с градиентной иконкой.
 */
$u = current_user();
$SECTIONS = [
  ['/',                'Главная',              '<path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/>'],
  ['/competitions',    'Афиша конкурсов',      '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M3 10h18M8 2v4M16 2v4"/><circle cx="12" cy="15" r="2.4"/>'],
  ['/apply',           'Подать заявку',        '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M9 15l2 2 4-4"/>'],
  ['/awards',          'Награды',              '<circle cx="12" cy="8" r="6"/><path d="M8.2 13.9 7 22l5-3 5 3-1.2-8.1"/>'],
  ['/concerts',        'Онлайн-концерты',      '<path d="M9 18V5l10-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="16" cy="16" r="3"/>'],
  ['/gala',            'Гала-концерт',         '<path d="M4 4h16v12H4z"/><path d="M8 20h8M12 16v4"/><path d="m10 8 4 2-4 2z"/>'],
  ['/calendar',        'Календарь',            '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>'],
  ['/reviews',         'Отзывы',               '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>'],
  ['/ministry-support','Поддержка министерств','<path d="M3 21h18M5 21V10l7-5 7 5v11M9 21v-6h6v6"/>'],
  ['/blog',            'Блог',                 '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>'],
  ['/about',           'О центре',             '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>'],
  ['/goals',           'Цели и задачи',        '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="0.6" fill="currentColor"/>'],
  ['/faq',             'Вопросы',              '<circle cx="12" cy="12" r="10"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 2.5-3 4M12 17h.01"/>'],
  ['/contacts',        'Контакты',             '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8.1 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.8 2.2z"/>'],
  ['/verify',          'Проверка диплома',     '<path d="M12 2 4 5v6c0 5 3.4 8.5 8 11 4.6-2.5 8-6 8-11V5z"/><path d="m9 12 2 2 4-4"/>'],
  ['/agreement',       'Соглашение',           '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/>'],
  ['/privacy',         'Конфиденциальность',   '<rect x="3" y="11" width="18" height="10" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>'],
];
$SECTIONS[] = $u
  ? ['/cabinet', 'Личный кабинет', '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>']
  : ['/login',   'Вход и регистрация', '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>'];
if ($u) { $SECTIONS[] = ['/logout', 'Выйти', '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>']; }

ob_start(); ?>
<style>
/* --- ВИП-плашка над сеткой разделов --- */
.vip-banner{position:relative;overflow:hidden;display:flex;align-items:center;gap:16px;
  width:100%;margin:0 0 18px;padding:18px 20px;border-radius:20px;text-decoration:none;color:var(--text);
  background:var(--glass-card);backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px);
  border:1px solid var(--gold);
  box-shadow:0 10px 30px rgba(199,147,34,.16),inset 0 0 0 1px rgba(199,147,34,.22);
  transition:transform .25s ease,box-shadow .25s ease}
.vip-banner:hover{transform:translateY(-3px);box-shadow:0 16px 38px rgba(199,147,34,.26),inset 0 0 0 1px rgba(199,147,34,.32)}
.vip-banner::before{content:"";position:absolute;inset:0;border-radius:inherit;pointer-events:none;
  background:radial-gradient(120% 160% at 0% 0%,rgba(199,147,34,.14),transparent 55%)}
.vip-shine{position:absolute;top:-20%;bottom:-20%;left:-90px;width:70px;pointer-events:none;
  background:linear-gradient(105deg,transparent,rgba(233,197,103,.38),transparent);
  transform:skewX(-20deg);animation:vipShine 3.4s ease-in-out infinite}
@keyframes vipShine{0%{left:-90px}55%{left:115%}100%{left:115%}}
.vip-banner-ic{flex:none;width:52px;height:52px;border-radius:50%;display:flex;align-items:center;justify-content:center;
  background:var(--grad-gold);color:var(--gold-fg,#fff);box-shadow:0 6px 18px rgba(199,147,34,.35)}
.vip-banner-ic svg{width:28px;height:28px}
.vip-banner-txt{flex:1;min-width:0;display:flex;flex-direction:column;gap:3px;word-break:normal;hyphens:none}
.vip-banner-title{font-family:var(--ff-display);font-size:clamp(1.15rem,3.4vw,1.45rem);letter-spacing:.02em;line-height:1.15;
  background:var(--grad-gold-text,var(--grad-gold));-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;color:var(--gold)}
.vip-banner-sub{font-size:.85rem;color:var(--muted);line-height:1.4}
.vip-banner-arr{flex:none;width:22px;height:22px;color:var(--gold);transition:transform .25s ease}
.vip-banner:hover .vip-banner-arr{transform:translateX(4px)}
[data-theme="dark"] .vip-banner{border-color:var(--gold);
  box-shadow:0 10px 30px rgba(0,0,0,.35),inset 0 0 0 1px rgba(233,197,103,.22)}
@media (max-width:480px){.vip-banner{padding:15px 16px;gap:12px}.vip-banner-ic{width:44px;height:44px}.vip-banner-ic svg{width:24px;height:24px}}
@media (prefers-reduced-motion:reduce){.vip-shine{animation:none;display:none}.vip-banner,.vip-banner-arr{transition:none}}
</style>
<section class="section menu-page">
  <div class="container">
    <div class="menu-head">
      <p class="eyebrow eyebrow--script">Навигация</p>
      <h1>Меню</h1>
      <p class="menu-sub">Все разделы КЦ «Музыкальный Мир»</p>
    </div>

    <div class="menu-search" id="menuSearch">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>
      <input type="search" id="menuSearchInput" placeholder="Поиск раздела…" autocomplete="off" aria-label="Поиск раздела">
    </div>

    <a class="vip-banner reveal" href="<?= url('/club') ?>" aria-label="Закрытый ВИП-клуб — привилегии, скидки и закрытые конкурсы">
      <span class="vip-shine" aria-hidden="true"></span>
      <span class="vip-banner-ic" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
          <path d="M3 8.5 7.5 12 12 5.5 16.5 12 21 8.5 19.2 18H4.8z"/><path d="M6 21h12"/>
        </svg>
      </span>
      <span class="vip-banner-txt">
        <span class="vip-banner-title">Закрытый ВИП-клуб</span>
        <span class="vip-banner-sub">Привилегии, скидки и закрытые конкурсы для участников клуба</span>
      </span>
      <svg class="vip-banner-arr" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg>
    </a>

    <div class="menu-grid" id="menuGrid">
      <?php foreach ($SECTIONS as $i => [$href, $label, $path]): ?>
        <a class="menu-tile" href="<?= url($href) ?>" style="--i:<?= $i ?>" data-label="<?= h(mb_strtolower($label)) ?>">
          <span class="menu-tile-ic">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><?= $path ?></svg>
          </span>
          <span class="menu-tile-lbl"><?= h($label) ?></span>
          <svg class="menu-tile-arr" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>
        </a>
      <?php endforeach; ?>
      <p class="menu-empty" id="menuEmpty" hidden>Ничего не найдено</p>
    </div>
    <script>
    (function(){
      var inp=document.getElementById('menuSearchInput'); if(!inp)return;
      var grid=document.getElementById('menuGrid'), empty=document.getElementById('menuEmpty');
      inp.addEventListener('input',function(){
        var q=inp.value.trim().toLowerCase(); var vis=0;
        grid.querySelectorAll('.menu-tile').forEach(function(t){
          var ok=!q||(t.getAttribute('data-label')||'').indexOf(q)>-1;
          t.style.display=ok?'':'none'; if(ok)vis++;
        });
        if(empty)empty.hidden=vis>0;
      });
      if(location.hash==='#menuSearch')setTimeout(function(){inp.focus();},300);
    })();
    </script>

    <div class="menu-actions">
      <button type="button" class="btn btn--primary btn--block btn--lg" data-share data-share-title="КЦ «Музыкальный Мир» — конкурсы культуры и искусства" data-share-url="<?= h(url('/')) ?>">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.7" style="margin-right:8px"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/></svg>
        Поделиться приложением
      </button>
      <a class="btn btn--ghost btn--block" href="<?= h(cfgv('org_vk')) ?>" target="_blank" rel="noopener" style="margin-top:10px">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" style="margin-right:8px"><path d="M13.2 17.4c-5.5 0-8.9-3.8-9-10.1h2.8c.1 4.6 2.2 6.6 3.8 7V7.3h2.6v4c1.6-.2 3.3-2 3.9-4h2.6c-.5 2.5-2.2 4.3-3.4 5 1.2.6 3.2 2.2 3.9 5.1h-2.9c-.6-1.9-2.1-3.4-4.1-3.6v3.6h-.2z"/></svg>
        Написать нам во ВКонтакте
      </a>
    </div>
  </div>
</section>
<?php
$content = ob_get_clean();
render_page('Меню', $content, ['active' => '/menu', 'meta' => 'Меню сайта КЦ «Музыкальный Мир»: все разделы, конкурсы, награды, концерты, личный кабинет.']);
