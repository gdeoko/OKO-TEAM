<?php
/** О нас (slug about): история с 2020, инфографика, таймлайн, руководство (ФИО), жюри, партнёры. */
require_once BASE_PATH . '/templates/site/partials/heatmap.php';
$page = one("SELECT * FROM pages WHERE slug=?", ['about']);

$defaultBody = '<p>Культурный центр «Музыкальный Мир» - российская организация в сфере культуры и искусства. Мы проводим международные и всероссийские онлайн-конкурсы, фестивали и концерты, объединяя талантливых людей со всей России и зарубежья через доступное дистанционное участие.</p>'
    . '<p>С 2020 года центр вырос из локальных творческих конкурсов в постоянно действующую площадку для вокалистов, музыкантов, хореографов, артистов театра, чтецов и мастеров изобразительного искусства. Оценку ведёт компетентное жюри, а результаты приходят Вам на почту в течение пяти рабочих дней.</p>';

/* ── Данные страницы ── */
$timeline = [
    ['2020', 'Основание центра', 'Культурный центр «Музыкальный Мир» создан по инициативе заслуженных артистов России, заслуженных деятелей культуры и лауреатов международных конкурсов.'],
    ['2022', 'Первые онлайн-конкурсы', 'Запуск дистанционного формата и сообщества «ВКонтакте». За год - сотни публикаций и первый миллион просмотров творческих работ участников.'],
    ['2023', 'Расширение линейки', 'Рост числа конкурсов и фестивалей, системная работа с педагогами и школами искусств, информационная поддержка министерств культуры и образования субъектов РФ.'],
    ['2024', 'Бесплатное участие и гала-концерты', 'Всероссийские конкурсы с бесплатным участием, отчётные онлайн гала-концерты обладателей Гран-при, освещение на портале «Про.Культура.РФ».'],
    ['2025', 'Официальная регистрация', 'Регистрация в Роскомнадзоре - свидетельство №094084 от 24.06.2025. Рекордный годовой охват аудитории, широкая федеральная и международная география.'],
    ['2026', 'Масштаб сегодня', 'Свыше 1300 проведённых конкурсов и мероприятий, более 600 000 участников из 85 регионов России и 15+ стран мира.'],
];

/* Реальные показатели центра (фиксированные значения). */
$stats = [
    ['5', '', 'лет работы'],
    ['1300', '+', 'проведённых конкурсов'],
    ['603000', '', 'участников'],
    ['15', '', 'стран мира'],
];

/* Топ-направления по базе заявок (доля, %). */
$nominations = [
    ['Вокальное искусство', 39],
    ['Инструментальное исполнительство', 16],
    ['Хореография', 8],
    ['Художественное слово', 5],
    ['Театральное искусство', 3],
    ['Изобразительное искусство', 2],
];

$leaders = [
    [
        'Галиулин Данил Дамирович',
        'Председатель Оргкомитета',
        ['Деятель культуры', 'Лауреат международных конкурсов и фестивалей', 'Утверждает положения конкурсов и итоговые решения', 'Представляет центр во взаимодействии с партнёрами'],
    ],
    [
        'Оргкомитет центра',
        'Руководство и организация конкурсов',
        ['Основан в 2020 году', 'Заслуженные артисты и деятели культуры России', 'Лауреаты международных конкурсов и фестивалей', 'Компетентные педагоги с профильным образованием'],
    ],
];

$achievements = [
    ['Выступления в Кремле', 'Победители конкурсов центра выходили на сцену Государственного Кремлёвского дворца.'],
    ['Поездки в «Артек»', 'Талантливые участники получали путёвки в Международный детский центр «Артек».'],
    ['Международная география', 'Лауреаты из Беларуси, Армении, Казахстана, Китая, Египта и Италии - искусство без границ.'],
    ['Благотворительность', 'Благотворительные концерты и поддержка участников совместно с фондом «ОБЕРЕГ», победители из разных регионов страны.'],
];

$juryCriteria = [
    'Педагогический стаж члена жюри - не менее 10 лет',
    'Первая или высшая квалификационная категория по профилю конкурса',
    'Для международного статуса - эксперты из не менее чем 3-4 стран',
    'Отсутствие конфликта интересов: член жюри не оценивает своих учеников',
];

$partners = [
    ['Министерства культуры и образования субъектов РФ', 'Информационная поддержка международных и всероссийских конкурсов и фестивалей.'],
    ['Портал «Про.Культура.РФ»', 'Национальная государственная информационная система - публикация анонсов и освещение мероприятий.'],
    ['Министерство просвещения', 'Поддержка проектов, направленных на творческое развитие детей и работу с педагогами школ искусств.'],
    ['Союз композиторов РФ', 'Профессиональное сообщество композиторов - экспертная и творческая поддержка музыкальных номинаций.'],
    ['Роскомнадзор', 'Регуляторный партнёр. Деятельность центра зарегистрирована - свидетельство №094084 от 24.06.2025.'],
    ['Национальный фонд «ОБЕРЕГ»', 'Совместные благотворительные концерты и поддержка участников специальной военной операции.'],
    ['Студия «ZAMIS»', 'Студия звуко- и видеозаписи - медиапроизводство конкурсных и концертных материалов.'],
    ['Арт-студия «Mr.Archer»', 'Дизайнерская студия - визуальный контент, оформление дипломов и наградных материалов.'],
];

/* ── SVG-иконки (без эмодзи) ── */
$svg = [
    'star'  => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l3 7h7l-5.5 4 2 7L12 16l-6.5 4 2-7L2 9h7z"/></svg>',
    'crown' => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7l4 4 5-6 5 6 4-4-1.5 12h-15z"/><path d="M4.5 20h15"/></svg>',
    'shield'=> '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l8 3v6c0 5-3.5 8.5-8 11-4.5-2.5-8-6-8-11V5z"/><path d="M9 12l2 2 4-4"/></svg>',
    'gavel' => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 4l6 6-3 3-6-6z"/><path d="M11 7L4 14l3 3 7-7"/><path d="M3 21h9"/></svg>',
    'doc'   => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M9 13h6M9 17h4"/></svg>',
    'pin'   => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s7-6.5 7-11a7 7 0 1 0-14 0c0 4.5 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/></svg>',
    'clock' => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
    'globe' => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.7 2.5 15.3 0 18M12 3c-2.5 2.7-2.5 15.3 0 18"/></svg>',
    'heart' => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20s-7-4.5-9.5-9C1 8 2.5 4.5 6 4.5c2 0 3.2 1.2 4 2.3.8-1.1 2-2.3 4-2.3 3.5 0 5 3.5 3.5 6.5C19 15.5 12 20 12 20z"/></svg>',
    'check' => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6L9 17l-5-5"/></svg>',
    'mic'   => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="2" width="6" height="12" rx="3"/><path d="M5 10a7 7 0 0 0 14 0M12 17v4M8 21h8"/></svg>',
    'note'  => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>',
    'dance' => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="4" r="2"/><path d="M12 6.5V12M12 12l-3.5 8M12 12l3.5 8M6.5 8.5L12 10l5.5-2"/></svg>',
    'quote' => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10 11H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v6c0 2.2-1.2 3.6-3 4"/><path d="M20 11h-4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v6c0 2.2-1.2 3.6-3 4"/></svg>',
    'mask'  => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 5c2.7-1.2 5.3-1.8 8-1.8S17.3 3.8 20 5v6a8 8 0 0 1-16 0z"/><path d="M8.5 9.5h.01M15.5 9.5h.01"/><path d="M9 13.5a4 3 0 0 0 6 0"/></svg>',
    'palette' => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3a9 9 0 1 0 0 18h1.5a2.5 2.5 0 0 0 0-5H12a2 2 0 0 1 0-4h6a3 3 0 0 0 3-3c0-3.6-4-6-9-6z"/><path d="M7.5 10.5h.01M11.5 7h.01M16.5 10.5h.01"/></svg>',
    'arrow' => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M7 17L17 7M9 7h8v8"/></svg>',
    'tie'   => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="6.5" r="3.5"/><path d="M4.5 21c.6-4.2 3.6-7 7.5-7s6.9 2.8 7.5 7"/><path d="M12 14l-1.5 2.5L12 21l1.5-4.5z"/></svg>',
];
$achIcons = ['crown', 'star', 'globe', 'heart'];
?>
<?php ob_start(); ?>
<style>
/* ── «О нас» - инфографика и таймлайн (scoped, темонезависимо через переменные) ── */
.article-cap p:first-of-type::first-letter{
  font-family:var(--ff-serif);font-size:3.4em;line-height:.78;float:left;
  padding:.04em .12em 0 0;color:var(--gold-2);font-weight:700;
}
.about-lead{font-size:1.12rem;color:var(--text-dim)}
.about-lead p{margin-bottom:1.05em}

/* Ценности / мини-карточки */
.value-list{list-style:none;padding:0;margin:0;display:grid;gap:12px}
.value-list li{display:flex;gap:12px;align-items:flex-start;color:var(--text-dim)}
.value-list li svg{width:20px;height:20px;color:var(--gold);flex:none;margin-top:3px}

/* Таймлайн */
.timeline{position:relative;max-width:820px;margin:0 auto;padding-left:6px}
.timeline::before{content:"";position:absolute;left:14px;top:8px;bottom:8px;width:2px;
  background:linear-gradient(180deg,transparent,var(--gold),var(--gold-deep),transparent)}
.tl-item{position:relative;padding:0 0 30px 52px}
.tl-item:last-child{padding-bottom:0}
.tl-item::before{content:"";position:absolute;left:7px;top:4px;width:16px;height:16px;border-radius:50%;
  background:var(--grad-gold);box-shadow:0 0 0 4px var(--gold-soft),0 0 14px rgba(232,194,90,.5)}
.tl-year{font-family:var(--ff-display);font-size:1.9rem;line-height:1;letter-spacing:.02em;
  background:var(--grad-gold);-webkit-background-clip:text;background-clip:text;color:transparent}
.tl-item h3{margin:6px 0 6px;color:var(--text)}
.tl-item p{margin:0;color:var(--text-dim);font-size:.98rem}

/* «Что выбирают участники» - компактные стеклянные мини-карточки */
.pick-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:14px;max-width:860px;margin:0 auto}
.pick-card{display:flex;gap:14px;align-items:center;padding:15px 18px;border-radius:16px;
  background:var(--glass-card);backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px);
  border:1px solid var(--glass-brd2);transition:transform .25s cubic-bezier(.2,.8,.2,1),border-color .25s;
  word-break:normal;hyphens:none}
.pick-ic{width:44px;height:44px;flex:none;border-radius:13px;display:flex;align-items:center;justify-content:center;
  background:var(--gold-soft);border:1px solid var(--glass-brd);color:var(--gold);
  transition:transform .25s cubic-bezier(.2,.8,.2,1)}
.pick-ic svg{width:22px;height:22px}
.pick-body{flex:1;min-width:0;display:grid;gap:7px}
.pick-top{display:flex;justify-content:space-between;align-items:baseline;gap:10px;color:var(--text)}
.pick-top span{font-weight:600;font-size:.92rem;line-height:1.25}
.pick-top b{font-family:var(--ff-display);font-size:1.2rem;line-height:1;flex:none;white-space:nowrap;
  background:var(--grad-gold);-webkit-background-clip:text;background-clip:text;color:transparent}
.pick-track{height:6px;border-radius:999px;background:var(--glass-brd);overflow:hidden}
.pick-fill{display:block;height:100%;border-radius:999px;background:var(--grad-gold);
  transform-origin:left center;animation:pickGrow 1.1s cubic-bezier(.2,.8,.2,1) .25s both}
@keyframes pickGrow{from{transform:scaleX(0)}to{transform:scaleX(1)}}
@media (hover:hover){
  .pick-card:hover{transform:translateY(-3px);border-color:var(--gold)}
  .pick-card:hover .pick-ic{transform:scale(1.08)}
}
@media (max-width:640px){.pick-grid{grid-template-columns:1fr}}

/* KPI-достижения */
.kpi{display:flex;gap:16px;align-items:flex-start}
.kpi .kpi-ic{width:52px;height:52px;flex:none;border-radius:16px;display:flex;align-items:center;justify-content:center;
  background:var(--gold-soft);border:1px solid var(--glass-brd);color:var(--gold)}
.kpi .kpi-ic svg{width:26px;height:26px}
.kpi h3{margin:2px 0 6px;color:var(--text)}
.kpi p{margin:0;color:var(--text-dim);font-size:.95rem}

/* Руководство */
.leader-card{display:flex;flex-direction:column;gap:14px}
.leader-head{display:flex;gap:14px;align-items:center}
.leader-ava{width:56px;height:56px;flex:none;border-radius:50%;display:flex;align-items:center;justify-content:center;
  background:var(--grad-gold);color:var(--gold-fg);box-shadow:var(--shadow-btn)}
.leader-ava svg{width:28px;height:28px}
.leader-name{font-family:var(--ff-serif);font-weight:700;font-size:1.28rem;color:var(--text);line-height:1.15}
.leader-role{color:var(--gold);font-weight:700;font-size:.86rem;letter-spacing:.02em}
.leader-card ul{list-style:none;padding:0;margin:0;display:grid;gap:9px}
.leader-card ul li{display:flex;gap:10px;align-items:flex-start;color:var(--text-dim);font-size:.95rem}
.leader-card ul li svg{width:18px;height:18px;color:var(--gold);flex:none;margin-top:3px}

/* Генеральный директор - витринная стеклянная карточка */
.ceo-card{display:flex;gap:20px;align-items:center;max-width:640px;margin:0 auto 26px;padding:24px 26px;
  border-radius:20px;background:var(--glass-card);backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px);
  border:1px solid var(--glass-brd2);position:relative;overflow:hidden;
  transition:transform .25s cubic-bezier(.2,.8,.2,1),border-color .25s;word-break:normal;hyphens:none}
.ceo-card::before{content:"";position:absolute;left:0;top:0;bottom:0;width:4px;background:var(--grad-gold)}
.ceo-ava{width:72px;height:72px;flex:none;border-radius:50%;display:flex;align-items:center;justify-content:center;
  background:var(--grad-gold);color:var(--gold-fg);box-shadow:var(--shadow-btn)}
.ceo-ava svg{width:36px;height:36px}
.ceo-name{font-family:var(--ff-serif);font-weight:700;font-size:1.45rem;line-height:1.15;color:var(--text)}
.ceo-role{margin-top:4px;font-weight:800;font-size:.85rem;letter-spacing:.06em;text-transform:uppercase;
  background:var(--grad-gold);-webkit-background-clip:text;background-clip:text;color:transparent;display:inline-block}
.ceo-sub{margin-top:6px;color:var(--muted);font-size:.92rem;line-height:1.4}
@media (hover:hover){.ceo-card:hover{transform:translateY(-3px);border-color:var(--gold)}}
@media (max-width:560px){
  .ceo-card{flex-direction:column;text-align:center;gap:14px;padding:22px 18px}
  .ceo-card::before{left:0;right:0;top:0;bottom:auto;width:auto;height:4px}
}

/* Реквизиты - строки */
.req-row{display:flex;gap:14px;align-items:flex-start;padding:14px 0;border-bottom:1px solid var(--line)}
.req-row:last-child{border-bottom:0}
.req-row .req-ic{width:40px;height:40px;flex:none;border-radius:12px;display:flex;align-items:center;justify-content:center;
  background:var(--gold-soft);border:1px solid var(--glass-brd);color:var(--gold)}
.req-row .req-ic svg{width:20px;height:20px}
.req-row .req-k{color:var(--muted);font-size:.78rem;letter-spacing:.04em;text-transform:uppercase;margin-bottom:2px}
.req-row .req-v{color:var(--text);font-weight:600}
.req-row .req-v a{font-weight:600}

.note-legal{color:var(--muted);font-size:.88rem;margin-top:20px;line-height:1.55}

@media (max-width:560px){
  .tl-item{padding-left:46px}
  .tl-year{font-size:1.6rem}
}

/* Моушен-микровзаимодействия (только transform/opacity) */
@media (hover:hover){
  .tl-item{transition:transform .25s cubic-bezier(.2,.8,.2,1)}
  .tl-item:hover{transform:translateX(5px)}
  .req-row{transition:transform .2s ease}
  .req-row:hover{transform:translateX(4px)}
}
@media (prefers-reduced-motion:reduce){
  .tl-item,.req-row,.pick-fill,.pick-card,.pick-ic{transition:none}
  .pick-fill{animation:none;transform:scaleX(1)}
  .tl-item:hover,.req-row:hover,.pick-card:hover{transform:none}
}
</style>

<!-- Sticky-подменю быстрых переходов (без переработки секций) -->
<nav class="about-nav" aria-label="Навигация «О нас»">
  <div class="container about-nav-inner">
    <a href="#intro">О центре</a>
    <a href="#history">История</a>
    <a href="#numbers">Цифры</a>
    <a href="#ach">Достижения</a>
    <a href="#leaders">Руководство</a>
    <a href="#partners">Поддержка</a>
    <a href="#pubs">СМИ</a>
    <a href="#req">Реквизиты</a>
  </div>
</nav>
<style>
.about-nav{position:sticky;top:64px;z-index:20;background:color-mix(in srgb,var(--bg) 88%,transparent);backdrop-filter:blur(14px);border-bottom:1px solid var(--line)}
.about-nav-inner{display:flex;gap:6px;overflow-x:auto;scrollbar-width:none;padding:10px 0}
.about-nav-inner::-webkit-scrollbar{display:none}
.about-nav a{flex:0 0 auto;padding:8px 14px;border-radius:999px;font-weight:700;font-size:.86rem;color:var(--text-dim);text-decoration:none;
  border:1px solid transparent;transition:all .22s cubic-bezier(.2,.8,.2,1);white-space:nowrap;scroll-snap-align:start}
.about-nav a:hover,.about-nav a.on{color:var(--gold-ink);background:var(--gold-soft);border-color:var(--gold)}
[data-theme="dark"] .about-nav a:hover,[data-theme="dark"] .about-nav a.on{color:var(--gold);background:rgba(232,194,90,.10)}
@media(max-width:900px){.about-nav{top:56px}}
</style>
<script>
// подсветка активного пункта при скролле + плавная прокрутка
(function(){var links=document.querySelectorAll('.about-nav a');
  function upd(){var y=window.scrollY+140;var cur=null;links.forEach(function(a){var id=a.getAttribute('href').slice(1);var s=document.getElementById(id);if(s&&s.offsetTop<=y)cur=a;});
    links.forEach(function(a){a.classList.toggle('on',a===cur);});}
  window.addEventListener('scroll',upd,{passive:true}); upd();
  links.forEach(function(a){a.addEventListener('click',function(e){var id=this.getAttribute('href').slice(1);var s=document.getElementById(id);if(s){e.preventDefault();window.scrollTo({top:s.offsetTop-90,behavior:'smooth'});}});});
})();
</script>

<!-- Интро: история + миссия -->
<section class="section" id="intro">
  <div class="container">
    <a class="aw-back" href="<?= url('/menu') ?>"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M11 6l-6 6 6 6"/></svg>Назад</a>
    <div class="grid grid-2" style="align-items:start;gap:40px">
      <div class="reveal">
        <p class="eyebrow">Культурный центр</p>
        <h2 style="background:var(--grad-gold);-webkit-background-clip:text;background-clip:text;color:transparent;display:inline-block">О нас</h2>
        <div class="gold-rule" style="margin-left:0"></div>
        <div class="article-cap about-lead">
          <?= $page['body'] ?? $defaultBody ?>
        </div>
      </div>
      <div class="card reveal">
        <p class="eyebrow" style="margin-bottom:8px">Наша миссия</p>
        <h3>Открывать таланты и хранить культуру</h3>
        <p style="color:var(--text-dim)">Выявление и поддержка талантливой молодёжи, популяризация искусства, открытие новых имён и сохранение традиций многонациональной культуры народов мира.</p>
        <ul class="value-list" style="margin-top:6px">
          <?php foreach ([
              'Бесплатное участие - без ограничений по возрасту и числу номинаций',
              'Честная оценка компетентного жюри и быстрые результаты',
              'Дистанционный формат - участие из любого региона и страны',
              'Официально-патриотическая направленность и господдержка',
          ] as $v): ?>
            <li><?= $svg['check'] ?><span><?= h($v) ?></span></li>
          <?php endforeach; ?>
        </ul>
      </div>
    </div>
  </div>
</section>

<!-- Таймлайн истории -->
<section class="section section--tint" id="history">
  <div class="container">
    <div class="section-head reveal">
      <p class="eyebrow">Путь центра</p>
      <h2>История с 2020 года</h2>
      <div class="gold-rule"></div>
      <p>От локальных творческих конкурсов - к постоянно действующей всероссийской и международной площадке.</p>
    </div>
    <div class="timeline">
      <?php foreach ($timeline as [$year, $title, $descr]): ?>
        <div class="tl-item reveal">
          <div class="tl-year"><?= h($year) ?></div>
          <h3><?= h($title) ?></h3>
          <p><?= h($descr) ?></p>
        </div>
      <?php endforeach; ?>
    </div>
  </div>
</section>

<!-- Статистика -->
<section class="section" id="numbers">
  <div class="container">
    <div class="section-head reveal">
      <p class="eyebrow">Цифры</p>
      <h2>Центр в цифрах</h2>
      <div class="gold-rule"></div>
      <p>Итоги многолетней работы центра: конкурсы, участники и география.</p>
    </div>
    <div class="stats reveal" style="margin-bottom:44px;justify-content:center;text-align:center">
      <?php foreach ($stats as [$val, $suf, $label]):
        // Статичное форматированное значение (гарантированно видно даже без анимации);
        // data-count оставляем как усиление (счётчик анимирует к тому же числу).
        $shown = number_format((int) $val, 0, '', ' ') . $suf; ?>
        <div class="stat"><b data-count="<?= h($val) ?>" data-suffix="<?= h($suf) ?>"><?= h($shown) ?></b><span><?= h($label) ?></span></div>
      <?php endforeach; ?>
    </div>
    <div class="reveal" style="margin-top:22px">
      <h3 style="text-align:center;margin-bottom:6px">География участников - 85 регионов России</h3>
      <p style="color:var(--text-dim);text-align:center;max-width:640px;margin:0 auto 22px">Участники из всех федеральных округов - от Калининграда до Дальнего Востока, а также из стран СНГ и дальнего зарубежья.</p>
      <?= render_regions_heatmap() ?>
    </div>
  </div>
</section>

<!-- Достижения участников -->
<section class="section section--parchment" id="ach">
  <div class="container">
    <div class="section-head reveal">
      <p class="eyebrow">Признание</p>
      <h2>Достижения участников</h2>
      <div class="gold-rule"></div>
    </div>
    <div class="grid grid-2">
      <?php foreach ($achievements as $i => [$title, $descr]): ?>
        <div class="card kpi reveal">
          <div class="kpi-ic"><?= $svg[$achIcons[$i] ?? 'star'] ?></div>
          <div>
            <h3><?= h($title) ?></h3>
            <p><?= h($descr) ?></p>
          </div>
        </div>
      <?php endforeach; ?>
    </div>
  </div>
</section>

<!-- Руководство -->
<section class="section" id="leaders">
  <div class="container">
    <div class="section-head reveal">
      <p class="eyebrow">Управление</p>
      <h2>Руководство</h2>
      <div class="gold-rule"></div>
      <p>Работу центра организует Оргкомитет: формирует положения конкурсов, утверждает состав жюри и следит за соблюдением правил на каждом этапе.</p>
    </div>

    <!-- Генеральный директор -->
    <div class="ceo-card reveal">
      <div class="ceo-ava"><?= $svg['tie'] ?></div>
      <div class="ceo-info">
        <div class="ceo-name">Ильясов Альберт Ильясович</div>
        <div class="ceo-role">Генеральный директор</div>
        <div class="ceo-sub">Основатель Культурного центра «Музыкальный Мир»</div>
      </div>
    </div>

    <div class="grid grid-2">
      <?php foreach ($leaders as $li => [$name, $role, $regalia]): ?>
        <div class="card leader-card reveal">
          <div class="leader-head">
            <div class="leader-ava"><?= $svg[$li === 0 ? 'star' : 'crown'] ?></div>
            <div>
              <div class="leader-name"><?= h($name) ?></div>
              <div class="leader-role"><?= h($role) ?></div>
            </div>
          </div>
          <ul>
            <?php foreach ($regalia as $r): ?>
              <li><?= $svg['check'] ?><span><?= h($r) ?></span></li>
            <?php endforeach; ?>
          </ul>
        </div>
      <?php endforeach; ?>
    </div>
  </div>
</section>

<!-- Жюри -->
<section class="section section--tint">
  <div class="container">
    <div class="section-head reveal">
      <p class="eyebrow">Оценка работ</p>
      <h2>Компетентное жюри</h2>
      <div class="gold-rule"></div>
    </div>
    <div class="grid grid-2" style="align-items:start">
      <div class="card reveal">
        <div class="leader-head" style="margin-bottom:14px">
          <div class="leader-ava"><?= $svg['gavel'] ?></div>
          <div><div class="leader-name" style="font-size:1.2rem">Состав жюри</div></div>
        </div>
        <p style="color:var(--text-dim);margin-bottom:0">Работы оценивают педагоги, деятели культуры и искусства с профильным образованием. Председатель жюри - народный или заслуженный артист, видный деятель искусств, профессор ведущего профильного вуза. По каждому направлению - вокал, хореография, инструментальное исполнительство, театр, художественное слово, изобразительное искусство - работают профильные эксперты. Члены жюри формируют результаты независимо друг от друга.</p>
      </div>
      <div class="card reveal">
        <div class="leader-head" style="margin-bottom:14px">
          <div class="leader-ava"><?= $svg['shield'] ?></div>
          <div><div class="leader-name" style="font-size:1.2rem">Критерии отбора</div></div>
        </div>
        <ul class="value-list">
          <?php foreach ($juryCriteria as $c): ?>
            <li><?= $svg['check'] ?><span style="color:var(--text-dim)"><?= h($c) ?></span></li>
          <?php endforeach; ?>
        </ul>
      </div>
    </div>
    <p class="note-legal reveal">В целях безопасности членов жюри их персональные данные не публикуются, не выдаются на руки и не передаются третьим лицам (Федеральный закон №152-ФЗ). Протоколы и аттестационные выписки жюри также не публикуются и не выдаются на руки (Федеральный закон №149-ФЗ).</p>
  </div>
</section>

<!-- Партнёры -->
<section class="section" id="partners">
  <div class="container">
    <div class="section-head reveal">
      <p class="eyebrow">Кто с нами</p>
      <h2>Поддержка и партнёры</h2>
      <div class="gold-rule"></div>
      <p>Конкурсы и фестивали центра проходят при информационной поддержке министерств культуры и образования субъектов РФ, портала «Про.Культура.РФ», Союза композиторов РФ и Министерства просвещения.</p>
    </div>
    <div class="grid grid-3">
      <?php foreach ($partners as [$name, $descr]): ?>
        <div class="card reveal">
          <h3><?= h($name) ?></h3>
          <p style="color:var(--text-dim);margin:0"><?= h($descr) ?></p>
        </div>
      <?php endforeach; ?>
    </div>
  </div>
</section>

<!-- Публикации о нас в СМИ -->
<?php
try { $pubs = all("SELECT * FROM publications ORDER BY sort,id"); } catch (\Throwable $e) { $pubs = []; }
if ($pubs):
$byHost = [];
foreach ($pubs as $p) { $byHost[$p['host']][] = $p; }
$hostsTotal = count($byHost);
?>
<section class="section" id="pubs">
  <div class="container">
    <div class="section-head reveal">
      <p class="eyebrow">Публикации о нас</p>
      <h2>Нас цитируют в СМИ</h2>
      <div class="gold-rule"></div>
      <p><?= count($pubs) ?> публикаций на <?= $hostsTotal ?> официальных источниках: Министерства культуры и образования регионов РФ, Дома культуры, детские школы искусств, порталы новостей.</p>
    </div>
    <div class="pub-rows reveal">
      <?php foreach (array_slice($pubs, 0, 12) as $p): ?>
        <a class="pub-row" href="<?= h($p['url']) ?>" target="_blank" rel="noopener nofollow">
          <span class="pub-ic"><?= $svg['globe'] ?></span>
          <span class="pub-txt">
            <span class="pub-src"><?= h($p['source']) ?></span>
            <span class="pub-host"><?= h($p['host']) ?></span>
          </span>
          <span class="pub-arrow"><?= $svg['arrow'] ?></span>
        </a>
      <?php endforeach; ?>
    </div>
    <?php if (count($pubs) > 12): ?>
      <details class="pubs-more reveal">
        <summary>Показать все <?= count($pubs) ?> публикаций</summary>
        <div class="pub-rows" style="margin-top:22px">
          <?php foreach (array_slice($pubs, 12) as $p): ?>
            <a class="pub-row" href="<?= h($p['url']) ?>" target="_blank" rel="noopener nofollow">
              <span class="pub-ic"><?= $svg['globe'] ?></span>
              <span class="pub-txt">
                <span class="pub-src"><?= h($p['source']) ?></span>
                <span class="pub-host"><?= h($p['host']) ?></span>
              </span>
              <span class="pub-arrow"><?= $svg['arrow'] ?></span>
            </a>
          <?php endforeach; ?>
        </div>
      </details>
    <?php endif; ?>
  </div>
</section>
<style>
/* Публикации в СМИ - единые стеклянные строки-карточки */
.pub-rows{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:12px}
.pub-row{display:flex;align-items:center;gap:14px;padding:13px 16px;text-decoration:none;border-radius:16px;
  background:var(--glass-card);backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px);
  border:1px solid var(--glass-brd2);color:var(--text);overflow:hidden;
  transition:transform .22s cubic-bezier(.2,.8,.2,1),border-color .22s;word-break:normal;hyphens:none}
.pub-ic{width:40px;height:40px;flex:none;border-radius:12px;display:flex;align-items:center;justify-content:center;
  background:var(--gold-soft);border:1px solid var(--glass-brd);color:var(--gold)}
.pub-ic svg{width:20px;height:20px}
.pub-txt{flex:1;min-width:0;display:grid;gap:2px}
.pub-src{font-family:var(--ff-serif);font-weight:700;font-size:.98rem;line-height:1.2;color:var(--text);
  overflow:hidden;text-overflow:ellipsis;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}
.pub-host{font-size:.78rem;color:var(--gold-ink);letter-spacing:.02em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
[data-theme="dark"] .pub-host{color:var(--gold)}
.pub-arrow{flex:none;width:22px;height:22px;color:var(--gold);opacity:.75;
  transition:transform .22s cubic-bezier(.2,.8,.2,1),opacity .22s}
.pub-arrow svg{width:100%;height:100%}
@media(hover:hover){
  .pub-row:hover{transform:translateY(-3px);border-color:var(--gold)}
  .pub-row:hover .pub-arrow{transform:translate(2px,-2px);opacity:1}
}
.pubs-more{margin-top:22px;text-align:center}
.pubs-more summary{display:inline-block;cursor:pointer;padding:10px 22px;border:1px solid var(--gold);border-radius:999px;
  background:var(--glass-card);backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px);
  color:var(--gold-ink);font-weight:700;list-style:none;transition:transform .2s ease}
[data-theme="dark"] .pubs-more summary{color:var(--gold)}
.pubs-more summary::-webkit-details-marker{display:none}
.pubs-more[open] summary{opacity:.85}
@media(hover:hover){.pubs-more summary:hover{transform:translateY(-2px)}}
.pubs-more .pub-rows{text-align:left}
@media (prefers-reduced-motion:reduce){
  .pub-row,.pub-arrow,.pubs-more summary{transition:none}
  .pub-row:hover{transform:none}
}
</style>
<?php endif; ?>

<!-- Реквизиты -->
<section class="section section--parchment" id="req">
  <div class="container">
    <div class="section-head reveal">
      <p class="eyebrow">Организация</p>
      <h2>Реквизиты и контакты</h2>
      <div class="gold-rule"></div>
    </div>
    <div class="grid grid-2" style="align-items:start">
      <div class="card reveal">
        <div class="req-row">
          <div class="req-ic"><?= $svg['doc'] ?></div>
          <div>
            <div class="req-k">Наименование</div>
            <div class="req-v">Культурный центр «Музыкальный Мир»</div>
          </div>
        </div>
        <div class="req-row">
          <div class="req-ic"><?= $svg['star'] ?></div>
          <div>
            <div class="req-k">Руководство</div>
            <div class="req-v">Оргкомитет Культурного центра</div>
          </div>
        </div>
        <div class="req-row">
          <div class="req-ic"><?= $svg['shield'] ?></div>
          <div>
            <div class="req-k">Регистрация</div>
            <div class="req-v">Роскомнадзор, свидетельство №094084 от 24.06.2025</div>
          </div>
        </div>
        <div class="req-row">
          <div class="req-ic"><?= $svg['pin'] ?></div>
          <div>
            <div class="req-k">Юридический адрес</div>
            <div class="req-v"><?= h(cfgv('org_address')) ?></div>
          </div>
        </div>
      </div>
      <div class="card reveal">
        <div class="req-row">
          <div class="req-ic"><?= $svg['clock'] ?></div>
          <div>
            <div class="req-k">Режим работы</div>
            <div class="req-v"><?= h(cfgv('org_hours')) ?></div>
          </div>
        </div>
        <div class="req-row">
          <div class="req-ic"><?= $svg['pin'] ?></div>
          <div>
            <div class="req-k">Телефон</div>
            <div class="req-v"><a href="tel:<?= h(cfgv('org_phone_raw')) ?>"><?= h(cfgv('org_phone')) ?></a></div>
          </div>
        </div>
        <div class="req-row">
          <div class="req-ic"><?= $svg['doc'] ?></div>
          <div>
            <div class="req-k">Электронная почта</div>
            <div class="req-v"><a href="mailto:<?= h(cfgv('org_email')) ?>"><?= h(cfgv('org_email')) ?></a></div>
          </div>
        </div>
      </div>
    </div>
  </div>
</section>
<?php
$content = ob_get_clean();
render_page('О нас', $content, ['active' => '/about', 'meta' => 'О Культурном центре «Музыкальный Мир»: история с 2020 года, миссия, статистика, Оргкомитет и компетентное жюри, партнёры и реквизиты.']);
