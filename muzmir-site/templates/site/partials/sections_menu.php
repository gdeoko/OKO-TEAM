<?php
/**
 * «Разделы» — нижнее меню-сетка всех разделов сайта (в стиле мини-приложений ОКО).
 * Открывается кнопкой «Разделы» в нижней навигации (appnav). Заменяет бургер на мобиле.
 * Self-contained: своя разметка + scoped-стили + scoped-скрипт.
 */
$SECTIONS = [
  ['/', 'Главная', '<path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/>'],
  ['/competitions', 'Конкурсы', '<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3"/>'],
  ['/apply', 'Подать заявку', '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M9 15l2 2 4-4"/>'],
  ['/awards', 'Награды', '<circle cx="12" cy="8" r="6"/><path d="M8.2 13.9 7 22l5-3 5 3-1.2-8.1"/>'],
  ['/order-awards', 'Заказ наград', '<rect x="3" y="8" width="18" height="12" rx="2"/><path d="M3 12h18M8 8V6a4 4 0 0 1 8 0v2"/>'],
  ['/concerts', 'Концерты', '<path d="M9 18V5l10-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="16" cy="16" r="3"/>'],
  ['/gala', 'Гала-концерт', '<path d="M4 4h16v12H4z"/><path d="M8 20h8M12 16v4"/><path d="m10 8 4 2-4 2z"/>'],
  ['/calendar', 'Календарь', '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>'],
  ['/reviews', 'Отзывы', '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>'],
  ['/ministry-support', 'Поддержка', '<path d="M3 21h18M5 21V10l7-5 7 5v11M9 21v-6h6v6"/>'],
  ['/blog', 'Блог', '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>'],
  ['/about', 'О центре', '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>'],
  ['/goals', 'Цели и задачи', '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="0.6" fill="currentColor"/>'],
  ['/faq', 'Вопросы', '<circle cx="12" cy="12" r="10"/><path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 2.5-3 4M12 17h.01"/>'],
  ['/contacts', 'Контакты', '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8.1 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.5c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.8 2.2z"/>'],
  ['/club', 'Клуб', '<path d="M12 2l2.4 7.4H22l-6 4.5 2.3 7.1L12 16.7 5.7 21l2.3-7.1-6-4.5h7.6z"/>'],
  ['/verify', 'Проверка диплома', '<path d="M12 2 4 5v6c0 5 3.4 8.5 8 11 4.6-2.5 8-6 8-11V5z"/><path d="m9 12 2 2 4-4"/>'],
];
$menuUser = current_user();
$SECTIONS[] = $menuUser
  ? ['/cabinet', 'Личный кабинет', '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>']
  : ['/login', 'Вход и регистрация', '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>'];
?>
<style>
.sm-sheet{position:fixed;inset:0;z-index:70;display:none}
.sm-sheet.on{display:block}
.sm-backdrop{position:absolute;inset:0;background:rgba(20,16,6,.5);backdrop-filter:blur(4px);opacity:0;transition:opacity .28s}
.sm-sheet.on .sm-backdrop{opacity:1}
.sm-panel{position:absolute;left:0;right:0;bottom:0;background:var(--bg,#fffcf5);border-top-left-radius:22px;border-top-right-radius:22px;
  box-shadow:0 -18px 50px rgba(20,16,6,.28);padding:10px 16px calc(16px + env(safe-area-inset-bottom));max-height:82vh;overflow:auto;
  transform:translateY(100%);transition:transform .34s cubic-bezier(.2,.85,.25,1)}
.sm-sheet.on .sm-panel{transform:translateY(0)}
.sm-grab{width:44px;height:5px;border-radius:999px;background:var(--line,#e7ddc7);margin:4px auto 12px}
.sm-head{display:flex;align-items:center;justify-content:space-between;margin:0 4px 12px}
.sm-head h3{font-family:var(--ff-display,serif);font-size:1.25rem;margin:0;
  background:var(--grad-gold-text,linear-gradient(135deg,#b8923a,#8a6d1f));-webkit-background-clip:text;background-clip:text;color:transparent}
.sm-close{width:36px;height:36px;border-radius:50%;border:none;background:var(--gold-soft,#f4ecd6);color:var(--gold-ink,#8a6d1f);cursor:pointer;display:flex;align-items:center;justify-content:center}
.sm-close svg{width:18px;height:18px}
.sm-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:11px}
@media(max-width:360px){.sm-grid{grid-template-columns:repeat(2,1fr)}}
@media(min-width:720px){.sm-grid{grid-template-columns:repeat(4,1fr)}}
.sm-tile{position:relative;display:flex;flex-direction:column;align-items:flex-start;gap:11px;text-decoration:none;overflow:hidden;
  padding:15px 13px;border-radius:18px;background:var(--panel,#fff);border:1px solid var(--line,#eee6d2);
  color:var(--text,#1b2340);font-size:.82rem;font-weight:700;line-height:1.18;box-shadow:var(--shadow-soft,0 4px 16px rgba(139,111,31,.08));
  transition:transform .2s cubic-bezier(.2,.8,.2,1),box-shadow .22s,border-color .22s;
  opacity:0;transform:translateY(14px);animation:smIn .42s cubic-bezier(.2,.85,.25,1) forwards;animation-delay:calc(var(--i,0)*26ms)}
.sm-tile::after{content:"";position:absolute;right:12px;bottom:12px;width:16px;height:16px;opacity:.35;
  background:no-repeat center/contain url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23c9a84c' stroke-width='2.4' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M9 6l6 6-6 6'/%3E%3C/svg%3E")}
@keyframes smIn{to{opacity:1;transform:none}}
.sm-tile .sm-ic{width:46px;height:46px;border-radius:14px;display:flex;align-items:center;justify-content:center;
  background:var(--grad-gold,linear-gradient(135deg,#e6c766,#c9a84c 45%,#8b6f1f));color:var(--gold-fg,#1a1206);flex:none;
  box-shadow:0 6px 16px rgba(201,168,76,.32)}
.sm-tile .sm-ic svg{width:24px;height:24px}
[data-theme="dark"] .sm-tile{background:rgba(255,255,255,.045);border-color:rgba(232,194,90,.18)}
@media(hover:hover){.sm-tile:active,.sm-tile:hover{transform:translateY(-4px);border-color:var(--gold,#c9a84c);box-shadow:0 14px 30px rgba(201,168,76,.24)}}
@media(prefers-reduced-motion:reduce){.sm-backdrop,.sm-panel,.sm-tile{transition:none;animation:none;opacity:1;transform:none}}
</style>

<div class="sm-sheet" id="sectionsSheet" role="dialog" aria-modal="true" aria-label="Все разделы сайта">
  <div class="sm-backdrop" data-sm-close></div>
  <div class="sm-panel">
    <div class="sm-grab" aria-hidden="true"></div>
    <div class="sm-head">
      <h3>Разделы</h3>
      <button class="sm-close" type="button" data-sm-close aria-label="Закрыть">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>
      </button>
    </div>
    <div class="sm-grid">
      <?php foreach ($SECTIONS as $i => [$href, $label, $path]): ?>
        <a class="sm-tile" href="<?= url($href) ?>" style="--i:<?= $i ?>">
          <span class="sm-ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><?= $path ?></svg></span>
          <span><?= h($label) ?></span>
        </a>
      <?php endforeach; ?>
    </div>
  </div>
</div>
<script>
(function(){
  var sheet=document.getElementById('sectionsSheet'); if(!sheet)return;
  function open(){ sheet.classList.add('on'); document.body.style.overflow='hidden'; }
  function close(){ sheet.classList.remove('on'); document.body.style.overflow=''; }
  document.addEventListener('click', function(e){
    if(e.target.closest('[data-sections-open]')){ e.preventDefault(); open(); return; }
    if(e.target.closest('[data-sm-close]')){ close(); }
  });
  document.addEventListener('keydown', function(e){ if(e.key==='Escape'&&sheet.classList.contains('on')) close(); });
})();
</script>
