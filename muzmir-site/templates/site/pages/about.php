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
    ['2024', 'Бесплатное участие и гала-концерты', 'Всероссийские конкурсы с бесплатным участием, отчётные онлайн гала-концерты обладателей Гран-при, освещение на портале «PRO.Культура.РФ».'],
    ['2025', 'Официальная регистрация', 'Регистрация в Роскомнадзоре - свидетельство №094084 от 24.06.2025. Рекордный годовой охват аудитории, широкая федеральная и международная география.'],
    ['2026', 'Пять лет работы', 'Свыше 95 конкурсов и мероприятий, более 30 621 заявки, участники из 85 регионов России и 10 стран мира.'],
];

$stats = [
    ['5', '', 'лет работы'],
    ['95', '+', 'конкурсов и мероприятий'],
    ['30621', '+', 'заявок на участие'],
    ['85', '', 'регионов России'],
    ['10', '', 'стран мира'],
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
    ['Признание в военное время', 'Победители из ДНР и ЛНР, благотворительные концерты в поддержку участников СВО совместно с фондом «ОБЕРЕГ».'],
];

$juryCriteria = [
    'Педагогический стаж члена жюри - не менее 10 лет',
    'Первая или высшая квалификационная категория по профилю конкурса',
    'Для международного статуса - эксперты из не менее чем 3-4 стран',
    'Отсутствие конфликта интересов: член жюри не оценивает своих учеников',
];

$partners = [
    ['Министерства культуры и образования субъектов РФ', 'Информационная поддержка международных и всероссийских конкурсов и фестивалей.'],
    ['Портал «PRO.Культура.РФ»', 'Национальная государственная информационная система - публикация анонсов и освещение мероприятий.'],
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

/* Пончик (доля вокала) */
.donut-wrap{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;text-align:center}
.donut{position:relative;width:min(220px,60vw);aspect-ratio:1}
.donut svg{width:100%;height:100%;transform:rotate(-90deg)}
.donut-track{fill:none;stroke:var(--glass-brd);stroke-width:12}
.donut-fill{fill:none;stroke:var(--gold);stroke-width:12;stroke-linecap:round;
  filter:drop-shadow(0 0 6px rgba(232,194,90,.4))}
.donut-center{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center}
.donut-center b{font-family:var(--ff-display);font-size:2.6rem;line-height:1;
  background:var(--grad-gold);-webkit-background-clip:text;background-clip:text;color:transparent}
.donut-center span{color:var(--muted);font-size:.82rem;letter-spacing:.04em;text-transform:uppercase}

/* Полосы направлений */
.bars{display:grid;gap:16px}
.bar-row{display:grid;gap:7px}
.bar-top{display:flex;justify-content:space-between;align-items:baseline;gap:10px;color:var(--text)}
.bar-top span{font-weight:600;font-size:.95rem}
.bar-top b{font-family:var(--ff-display);font-size:1.15rem;color:var(--gold);white-space:nowrap;flex:none}
.bar{position:relative;height:10px;border-radius:999px;background:var(--glass-brd);overflow:hidden}
.bar-fill{display:block;height:100%;width:100%;border-radius:999px;background:var(--grad-gold);
  transform:scaleX(0);transform-origin:left center;transition:transform 1.2s cubic-bezier(.2,.8,.2,1)}

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
  .donut-center b{font-size:2.1rem}
}

/* Моушен-микровзаимодействия (только transform/opacity) */
@media (hover:hover){
  .tl-item{transition:transform .25s cubic-bezier(.2,.8,.2,1)}
  .tl-item:hover{transform:translateX(5px)}
  .req-row{transition:transform .2s ease}
  .req-row:hover{transform:translateX(4px)}
}
@media (prefers-reduced-motion:reduce){
  .tl-item,.req-row,.bar-fill{transition:none}
  .tl-item:hover,.req-row:hover{transform:none}
}
</style>

<!-- Интро: история + миссия -->
<section class="section">
  <div class="container">
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
<section class="section section--tint">
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
<section class="section">
  <div class="container">
    <div class="section-head reveal">
      <p class="eyebrow">Цифры</p>
      <h2>Центр в цифрах</h2>
      <div class="gold-rule"></div>
      <p>Итоги пяти лет работы по базе конкурсов и заявок на участие.</p>
    </div>
    <div class="stats reveal" style="margin-bottom:44px">
      <?php foreach ($stats as [$val, $suf, $label]): ?>
        <div class="stat"><b data-count="<?= h($val) ?>" data-suffix="<?= h($suf) ?>">0</b><span><?= h($label) ?></span></div>
      <?php endforeach; ?>
    </div>
    <div class="grid grid-2" style="align-items:center;gap:40px">
      <div class="card reveal">
        <p class="eyebrow" style="margin-bottom:8px">Топ-направления</p>
        <h3 style="margin-bottom:20px">Что выбирают участники</h3>
        <div class="bars">
          <?php foreach ($nominations as [$name, $pct]): ?>
            <div class="bar-row">
              <div class="bar-top"><span><?= h($name) ?></span><b><?= (int)$pct ?>%</b></div>
              <div class="bar" data-value="<?= (int)$pct ?>"><span class="bar-fill"></span></div>
            </div>
          <?php endforeach; ?>
        </div>
      </div>
      <div class="card reveal donut-wrap">
        <div class="donut" data-value="39">
          <svg viewBox="0 0 120 120" aria-hidden="true">
            <circle class="donut-track" cx="60" cy="60" r="52"/>
            <circle class="donut-fill" cx="60" cy="60" r="52"/>
          </svg>
          <div class="donut-center"><b>39%</b><span>Вокал</span></div>
        </div>
        <p style="color:var(--text-dim);margin:0">Вокальное искусство - самая массовая номинация конкурсов центра.</p>
      </div>
    </div>

    <div class="reveal" style="margin-top:44px">
      <h3 style="text-align:center;margin-bottom:6px">География участников - 85 регионов России</h3>
      <p style="color:var(--text-dim);text-align:center;max-width:640px;margin:0 auto 22px">Участники из всех федеральных округов - от Калининграда до Дальнего Востока, а также из стран СНГ и дальнего зарубежья.</p>
      <?= render_regions_heatmap() ?>
    </div>
  </div>
</section>

<!-- Достижения участников -->
<section class="section section--parchment">
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
<section class="section">
  <div class="container">
    <div class="section-head reveal">
      <p class="eyebrow">Управление</p>
      <h2>Руководство</h2>
      <div class="gold-rule"></div>
      <p>Работу центра организует Оргкомитет: формирует положения конкурсов, утверждает состав жюри и следит за соблюдением правил на каждом этапе.</p>
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
<section class="section">
  <div class="container">
    <div class="section-head reveal">
      <p class="eyebrow">Кто с нами</p>
      <h2>Партнёры и инфоподдержка</h2>
      <div class="gold-rule"></div>
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

<!-- Реквизиты -->
<section class="section section--parchment">
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
