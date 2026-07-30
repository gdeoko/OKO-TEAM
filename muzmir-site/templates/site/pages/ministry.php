<?php
/**
 * Поддержка министерства (/ministry-support).
 *
 * Премиум-галерея писем информационной поддержки министерств культуры и
 * образования субъектов РФ по регионам, с фильтром и модалкой/лайтбоксом.
 * Инфографика охвата (субъекты РФ, федеральные округа, страны). Если у письма
 * ещё нет скан-копии (image_path пуст) — карточка показывается как достойная
 * «документ готовится к публикации», а не битая картинка. Идеальная мобилка.
 */

$letters = all("SELECT * FROM ministry_letters ORDER BY sort, id");

/* --- Справочник федеральных округов (короткое имя, полное имя) --- */
$DISTRICTS = [
    'cfo'  => ['ЦФО',  'Центральный федеральный округ'],
    'szfo' => ['СЗФО', 'Северо-Западный федеральный округ'],
    'yufo' => ['ЮФО',  'Южный федеральный округ'],
    'skfo' => ['СКФО', 'Северо-Кавказский федеральный округ'],
    'pfo'  => ['ПФО',  'Приволжский федеральный округ'],
    'ufo'  => ['УФО',  'Уральский федеральный округ'],
    'sfo'  => ['СФО',  'Сибирский федеральный округ'],
    'dfo'  => ['ДФО',  'Дальневосточный федеральный округ'],
];

/**
 * Сопоставление субъекта РФ с федеральным округом по вхождению ключевого слова.
 * Покрывает субъекты сидера ministry_letters и типичные регионы участников.
 */
function ml_district(string $region): ?string {
    static $map = [
        'cfo'  => ['москв', 'белгород', 'воронеж', 'рязан', 'тульск', 'тула', 'владимир', 'брянск',
                   'калуж', 'курск', 'липец', 'тамбов', 'твер', 'ярослав', 'смолен', 'иванов',
                   'костром', 'орлов', 'орёл', 'орел'],
        'szfo' => ['петербург', 'ленинград', 'калининград', 'коми', 'архангель', 'вологод', 'мурман',
                   'новгород', 'псков', 'карел', 'ненецк'],
        'yufo' => ['краснодар', 'ростов', 'астрахан', 'волгоград', 'крым', 'севастопол', 'адыге',
                   'калмык'],
        'skfo' => ['ставропол', 'дагестан', 'чечен', 'ингуш', 'осети', 'кабардино', 'карачаево'],
        'pfo'  => ['татарстан', 'башкортостан', 'нижегород', 'самар', 'саратов', 'пензен', 'ульянов',
                   'оренбург', 'пермск', 'киров', 'удмурт', 'чуваш', 'марий', 'мордови'],
        'ufo'  => ['свердлов', 'челябин', 'тюмен', 'курган', 'ханты', 'ямало', 'югра'],
        'sfo'  => ['краснояр', 'кемеров', 'хакаси', 'новосибир', 'омск', 'томск', 'алтай', 'иркут',
                   'тыва', 'тува'],
        'dfo'  => ['амурск', 'приморск', 'хабаров', 'саха', 'якути', 'сахалин', 'камчат', 'магадан',
                   'забайкал', 'бурят', 'еврейск', 'чукот'],
    ];
    $r = mb_strtolower($region, 'UTF-8');
    foreach ($map as $key => $words) {
        foreach ($words as $w) {
            if (mb_strpos($r, $w) !== false) return $key;
        }
    }
    return null;
}

/* --- Разметка каждого письма федеральным округом + агрегаты для инфографики --- */
$byDistrict = [];               // key округа => число субъектов
$seenRegions = [];              // уникальные субъекты
foreach ($letters as &$l) {
    $l['_district'] = $l['region'] !== '' ? ml_district((string)$l['region']) : null;
    if ($l['region'] !== '' && !isset($seenRegions[$l['region']])) {
        $seenRegions[$l['region']] = true;
        if ($l['_district']) $byDistrict[$l['_district']] = ($byDistrict[$l['_district']] ?? 0) + 1;
    }
}
unset($l);

$regions = array_keys($seenRegions);
sort($regions, SORT_STRING | SORT_FLAG_CASE);

$subjectsCount  = count($regions);
$districtsCount = count($byDistrict);
$countries      = (int) setting('stat_countries', '9');
$letterCount    = count($letters);

/* Порядок округов для полос — по убыванию числа субъектов. */
arsort($byDistrict);
$maxDistrict = $byDistrict ? max($byDistrict) : 1;

$hasScan = static fn(array $l): bool => isset($l['image_path']) && (string)$l['image_path'] !== '';
$scanUrl = static function (string $path): string {
    return str_starts_with($path, 'http') ? $path : url(ltrim($path, '/'));
};

ob_start(); ?>
<style>
/* ---- Поддержка министерства ---- */
.ms-lead{max-width:760px;margin:0 auto;color:var(--text-dim)}
.ms-lead strong{color:var(--gold-deep);font-weight:700}
.ms-stats-glow{position:relative;overflow:hidden}
.ms-stats-glow::before{content:"";position:absolute;left:50%;top:-70px;width:min(700px,100%);height:340px;transform:translateX(-50%);
  background:radial-gradient(closest-side,var(--gold-soft),transparent 72%);pointer-events:none;z-index:0}
.ms-stats-glow>*{position:relative;z-index:1}
.stats .stat{position:relative;overflow:hidden}
/* Блок «Охват по стране»: 4 колонки на десктопе, 2 на мобиле (без сжатия подписей) */
.ms-stat4{grid-template-columns:repeat(4,1fr)}
@media(max-width:640px){.ms-stat4{grid-template-columns:repeat(2,1fr)}}
.stats .stat::after{content:"";position:absolute;left:0;right:0;bottom:0;height:2px;background:var(--grad-gold);opacity:.5}
.partners img{filter:grayscale(.2)}
@media(hover:hover){
  .partners img{transition:transform .28s cubic-bezier(.2,.8,.2,1),filter .28s ease}
  .partners img:hover{filter:none;transform:translateY(-4px)}
}
@media(prefers-reduced-motion:reduce){
  .ms-item,.ms-zoom,.partners img{transition:none}
  .ms-item:hover{transform:none}
  .ms-item:hover .ms-zoom{transform:none}
  .reveal.in .ms-dtrack i{transition:none}
}

/* Инфографика охвата */
.ms-cover{display:grid;grid-template-columns:1.1fr 1fr;gap:28px;align-items:stretch}
.ms-dwrap{background:var(--panel);border:1px solid var(--glass-brd);border-radius:var(--radius);
  padding:24px 26px;backdrop-filter:blur(10px);box-shadow:var(--shadow-card);position:relative;overflow:hidden}
.ms-dwrap::before{content:"";position:absolute;right:-30px;top:-30px;width:140px;height:140px;pointer-events:none;
  background:radial-gradient(closest-side,var(--gold-soft),transparent 70%);opacity:.7}
.ms-dwrap::after{content:"";position:absolute;bottom:14px;right:14px;width:18px;height:18px;pointer-events:none;
  border-bottom:1.5px solid var(--gold-2);border-right:1.5px solid var(--gold-2);border-bottom-right-radius:5px;opacity:.45}
.ms-dwrap>*{position:relative;z-index:1}
.ms-dtrack i{box-shadow:0 0 8px rgba(201,168,76,.4)}
.ms-dwrap h3{margin:0 0 4px;font-family:var(--ff-serif);font-size:1.12rem;color:var(--gold-2)}
.ms-dwrap .ms-dsub{margin:0 0 18px;font-size:.84rem;color:var(--muted)}
.ms-dbar{display:grid;gap:6px;margin-bottom:14px}
.ms-dbar:last-child{margin-bottom:0}
.ms-dbar .ms-dlbl{display:flex;justify-content:space-between;gap:10px;font-size:.86rem;
  color:var(--text-dim);font-weight:600}
.ms-dbar .ms-dlbl b{color:var(--gold-2);font-variant-numeric:tabular-nums}
.ms-dtrack{height:11px;background:var(--gold-soft);border:1px solid var(--glass-brd);
  border-radius:999px;overflow:hidden}
.ms-dtrack i{display:block;height:100%;width:0;background:var(--grad-gold);border-radius:inherit;
  transform-origin:left center;transition:width 1.1s cubic-bezier(.16,1,.3,1)}
.reveal.in .ms-dtrack i{width:var(--w,0%)}

/* Фильтр по региону */
.ms-filters{display:flex;gap:10px;flex-wrap:wrap;justify-content:center;margin:36px 0 28px}
.ms-filter{padding:9px 17px;font-size:.85rem;white-space:nowrap}
.ms-filter.active{background:var(--grad-gold);color:var(--gold-fg);border-color:transparent;box-shadow:var(--shadow-3d)}
@media(max-width:640px){
  .ms-filters{flex-wrap:nowrap;overflow-x:auto;justify-content:flex-start;
    scroll-snap-type:x proximity;-webkit-overflow-scrolling:touch;
    margin-inline:-16px;padding-inline:16px;padding-bottom:6px}
  .ms-filters::-webkit-scrollbar{display:none}
  .ms-filter{flex:0 0 auto;scroll-snap-align:start}
}
/* Совпадение с паддингом .container на самых узких экранах — без горизонтального скролла */
@media(max-width:360px){
  .ms-filters{margin-inline:-14px;padding-inline:14px}
}

/* Карточка письма */
.ms-item{display:flex;flex-direction:column;padding:0;overflow:hidden;cursor:pointer;text-align:left;
  transition:transform .25s,box-shadow .25s,border-color .25s}
@media(hover:hover){.ms-item:hover{transform:translateY(-5px);box-shadow:var(--shadow-3d);border-color:var(--gold-2)}
  .ms-item:hover .ms-zoom{transform:scale(1.08)}}
.ms-zoom{transition:transform .25s}
.ms-thumb{position:relative;aspect-ratio:4/3;background:
  radial-gradient(120% 90% at 50% 0,color-mix(in srgb,var(--gold) 16%,transparent),transparent 62%),
  var(--parchment);display:grid;place-items:center;overflow:hidden;border-bottom:1px solid var(--line)}
.ms-thumb img{width:100%;height:100%;object-fit:cover;display:block}
.ms-doc{width:58%;max-width:150px}
.ms-doc svg{width:100%;height:auto;display:block;filter:drop-shadow(0 10px 22px rgba(139,111,31,.28))}
.ms-tag{position:absolute;top:12px;left:12px;font-size:.66rem;font-weight:800;letter-spacing:.05em;
  padding:4px 9px;border-radius:999px;background:color-mix(in srgb,var(--info) 16%,var(--panel-solid));
  color:var(--info);border:1px solid color-mix(in srgb,var(--info) 30%,transparent)}
.ms-zoom{position:absolute;bottom:12px;right:12px;width:34px;height:34px;border-radius:50%;
  display:grid;place-items:center;background:var(--grad-gold);color:var(--gold-fg);
  box-shadow:0 6px 16px rgba(139,111,31,.4)}
.ms-zoom svg{width:16px;height:16px}
.ms-body{padding:16px 18px 18px;display:flex;flex-direction:column;gap:6px;flex:1}
.ms-region{font-family:var(--ff-serif);font-weight:700;font-size:1.04rem;line-height:1.2;color:var(--text)}
.ms-title{font-size:.86rem;color:var(--muted);line-height:1.4;
  display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.ms-meta{margin-top:auto;padding-top:10px;display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.ms-status{display:inline-flex;align-items:center;gap:6px;font-size:.72rem;font-weight:700}
.ms-status svg{width:13px;height:13px}
.ms-status--ready{color:var(--gold-2)}
.ms-status--soon{color:var(--muted)}
.ms-status--soon .ms-dot{width:7px;height:7px;border-radius:50%;background:var(--warning);
  box-shadow:0 0 0 4px color-mix(in srgb,var(--warning) 22%,transparent)}

/* Заглушка/модалка */
.ms-empty{max-width:640px;margin:0 auto;text-align:center}
.ms-empty svg{width:52px;height:52px;color:var(--gold-2);margin-bottom:14px}
.ms-note{max-width:760px;margin:34px auto 0;text-align:center;font-size:.86rem;color:var(--muted)}

.ms-lb{display:none;position:fixed;inset:0;z-index:120;padding:24px;
  background:color-mix(in srgb,var(--text) 82%,transparent);
  align-items:center;justify-content:center;backdrop-filter:blur(6px)}
.ms-lb.open{display:flex}
.ms-lb-img{max-width:min(880px,94vw);max-height:88vh;border-radius:14px;
  box-shadow:0 30px 80px rgba(0,0,0,.45);display:none}
.ms-lb-card{max-width:min(520px,94vw);background:var(--panel-solid);border:1px solid var(--glass-brd);
  border-radius:var(--radius);padding:32px 30px;text-align:center;display:none}
.ms-lb-card svg.ms-seal{width:54px;height:54px;color:var(--gold-2);margin-bottom:8px}
.ms-lb-card h3{margin:6px 0 2px;font-family:var(--ff-serif);font-size:1.3rem;color:var(--text)}
.ms-lb-card .ms-lb-min{color:var(--gold-deep);font-weight:600;font-size:.92rem;margin:0 0 14px}
.ms-lb-card p{color:var(--text-dim);font-size:.9rem;line-height:1.55;margin:0}
.ms-lb-card .ms-lb-badge{display:inline-flex;align-items:center;gap:7px;margin-top:18px;
  font-size:.74rem;font-weight:800;letter-spacing:.05em;padding:7px 14px;border-radius:999px;
  color:var(--gold-ink);background:var(--gold-soft);border:1px solid var(--glass-brd)}
.ms-lb-close{position:absolute;top:20px;right:22px;width:46px;height:46px;border-radius:50%;
  background:color-mix(in srgb,var(--panel-solid) 30%,transparent);
  border:1px solid rgba(255,255,255,.28);color:#fff;cursor:pointer;display:grid;place-items:center}
.ms-lb-close svg{width:20px;height:20px}

@media(max-width:860px){.ms-cover{grid-template-columns:1fr}}
</style>

<section class="section">
  <div class="container">
    <div class="section-head reveal">
      <p class="eyebrow">Информационная поддержка</p>
      <h2>Поддержка министерства культуры и образования</h2>
      <div class="gold-rule"></div>
      <p class="ms-lead"><strong>При информационной поддержке Министерств культуры и образования субъектов РФ и портала «PRO.Культура.РФ».</strong> Ниже — официальные письма региональных ведомств.</p>
    </div>

    <div class="partners reveal" style="margin-top:30px">
      <?php foreach ([
          ['emblem_minkultury_rf', 'Министерства культуры субъектов РФ'],
          ['emblem_minobrazovaniya', 'Министерства образования субъектов РФ'],
          ['prokultura_full_horizontal', 'PRO.Культура.РФ'],
          ['emblem_roskomnadzor', 'Роскомнадзор'],
      ] as [$img, $alt]): ?>
        <img src="<?= asset('img/' . $img . '.webp') ?>" alt="<?= h($alt) ?>" title="<?= h($alt) ?>" loading="lazy">
      <?php endforeach; ?>
    </div>
  </div>
</section>

<?php if ($subjectsCount > 0): ?>
<section class="section section--tint">
  <div class="container ms-stats-glow">
    <div class="section-head reveal">
      <p class="eyebrow">География поддержки</p>
      <h2>Охват по стране</h2>
      <div class="gold-rule"></div>
    </div>

    <div class="stats reveal ms-stat4" style="max-width:820px;margin:0 auto 40px">
      <div class="stat"><b data-count="<?= $subjectsCount ?>">0</b><span>субъектов РФ</span></div>
      <div class="stat"><b data-count="<?= $districtsCount ?>">0</b><span>федеральных округов</span></div>
      <div class="stat"><b data-count="<?= $countries ?>" data-suffix="+">0</b><span>стран-участниц</span></div>
      <div class="stat"><b data-count="4">0</b><span>института господдержки</span></div>
    </div>

    <?php if ($byDistrict): ?>
      <div class="ms-cover">
        <div class="ms-dwrap reveal">
          <h3>Субъекты по федеральным округам</h3>
          <p class="ms-dsub">Распределение регионов, оказывающих информационную поддержку Центру.</p>
          <?php foreach ($byDistrict as $key => $cnt):
              [$short, $full] = $DISTRICTS[$key];
              $w = (int) round($cnt / $maxDistrict * 100); ?>
            <div class="ms-dbar">
              <div class="ms-dlbl"><span><?= h($full) ?></span><b><?= $cnt ?></b></div>
              <div class="ms-dtrack"><i style="--w:<?= max(8, $w) ?>%"></i></div>
            </div>
          <?php endforeach; ?>
        </div>
        <div class="ms-dwrap reveal" style="display:flex;flex-direction:column;justify-content:center">
          <h3>Что означает поддержка</h3>
          <p class="ms-dsub" style="margin-bottom:16px">Информационная поддержка регионального ведомства
            подтверждает, что конкурс отвечает целям государственной культурной политики.</p>
          <ul style="list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:14px">
            <?php foreach ([
                'Официальное признание значимости конкурсов и фестивалей Центра',
                'Распространение информации о приёме заявок среди учреждений культуры и образования региона',
                'Соответствие Указу Президента РФ № 808 и главе 57 ГК РФ («публичный конкурс»)',
            ] as $point): ?>
              <li style="display:flex;gap:11px;align-items:flex-start">
                <svg viewBox="0 0 24 24" fill="none" stroke="var(--gold-2)" stroke-width="1.8"
                     style="width:20px;height:20px;flex:0 0 auto;margin-top:1px">
                  <circle cx="12" cy="12" r="10"/><path d="m8 12 2.5 2.5L16 9"/></svg>
                <span style="font-size:.9rem;color:var(--text-dim);line-height:1.45"><?= h($point) ?></span>
              </li>
            <?php endforeach; ?>
          </ul>
        </div>
      </div>
    <?php endif; ?>
  </div>
</section>
<?php endif; ?>

<section class="section">
  <div class="container">
    <div class="section-head reveal">
      <p class="eyebrow">Официальные документы</p>
      <h2>Письма и благодарности</h2>
      <div class="gold-rule"></div>
    </div>

    <?php if (!$letters): ?>
      <div class="card ms-empty reveal">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M4 4h16v16H4z"/><path d="M4 8h16M8 12h8M8 16h5"/></svg>
        <h3 style="font-family:var(--ff-serif);margin:0 0 10px">Документы готовятся к публикации</h3>
        <p style="color:var(--text-dim);margin:0">Скан-копии писем и благодарностей от министерств культуры
          и образования субъектов Российской Федерации будут опубликованы в этом разделе. Информационная
          поддержка государственных ведомств сопровождает конкурсы и фестивали Центра на постоянной основе.</p>
      </div>
    <?php else: ?>
      <div class="ms-filters reveal">
        <button class="btn btn--ghost ms-filter active" data-region="all" type="button">Все регионы</button>
        <?php foreach ($regions as $r): ?>
          <button class="btn btn--ghost ms-filter" data-region="<?= h($r) ?>" type="button"><?= h($r) ?></button>
        <?php endforeach; ?>
      </div>

      <div class="grid grid-4">
        <?php foreach ($letters as $l):
            $ready = $hasScan($l);
            $dKey  = $l['_district'];
            $dShort = $dKey ? $DISTRICTS[$dKey][0] : '';
            $region = (string) $l['region'];
            $title  = (string) ($l['title'] ?: 'Информационная поддержка конкурсов и фестивалей');
            $img    = $ready ? $scanUrl((string)$l['image_path']) : '';
        ?>
          <article class="card reveal ms-item" data-region="<?= h($region) ?>"
                   data-ready="<?= $ready ? '1' : '0' ?>"
                   data-img="<?= h($img) ?>"
                   data-titledoc="<?= h($title) ?>"
                   tabindex="0" role="button"
                   aria-label="<?= h($region . ($ready ? ', открыть скан письма' : ', документ готовится к публикации')) ?>">
            <div class="ms-thumb">
              <?php if ($dShort): ?><span class="ms-tag"><?= h($dShort) ?></span><?php endif; ?>
              <?php if ($ready): ?>
                <img src="<?= h($img) ?>" alt="<?= h('Письмо поддержки, ' . $region) ?>" loading="lazy">
                <span class="ms-zoom" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3M11 8v6M8 11h6"/></svg>
                </span>
              <?php else: ?>
                <div class="ms-doc" aria-hidden="true">
                  <svg viewBox="0 0 120 150" fill="none">
                    <rect x="10" y="8" width="100" height="134" rx="8" fill="var(--panel-solid)"
                          stroke="var(--gold-2)" stroke-width="2"/>
                    <path d="M26 34h68M26 46h68M26 58h50" stroke="var(--line)" stroke-width="3" stroke-linecap="round"/>
                    <path d="M26 78h68M26 90h68M26 102h44" stroke="var(--line)" stroke-width="3" stroke-linecap="round"/>
                    <circle cx="46" cy="124" r="13" fill="none" stroke="var(--gold)" stroke-width="2"/>
                    <path d="M46 116v16M38 124h16" stroke="var(--gold)" stroke-width="1.6"/>
                    <path d="M74 118l30 0M74 126l22 0" stroke="var(--gold-deep)" stroke-width="2" stroke-linecap="round"/>
                  </svg>
                </div>
              <?php endif; ?>
            </div>
            <div class="ms-body">
              <div class="ms-region"><?= h($region ?: 'Субъект РФ') ?></div>
              <div class="ms-title"><?= h($title) ?></div>
              <div class="ms-meta">
                <?php if ($ready): ?>
                  <span class="ms-status ms-status--ready">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                      <circle cx="12" cy="12" r="9"/><path d="m8 12 2.5 2.5L16 9"/></svg>
                    Скан доступен</span>
                <?php else: ?>
                  <span class="ms-status ms-status--soon"><span class="ms-dot"></span>Скан готовится</span>
                <?php endif; ?>
              </div>
            </div>
          </article>
        <?php endforeach; ?>
      </div>

      <p class="ms-note reveal">Скан-копии официальных писем публикуются по мере поступления заверенных
        документов из региональных ведомств. Информационная поддержка оказывается на постоянной основе.</p>
    <?php endif; ?>
  </div>
</section>

<div class="ms-lb" id="msLb" aria-hidden="true">
  <button class="ms-lb-close" id="msLbClose" type="button" aria-label="Закрыть">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 6 6 18M6 6l12 12"/></svg>
  </button>
  <img class="ms-lb-img" id="msLbImg" src="" alt="">
  <div class="ms-lb-card" id="msLbCard">
    <svg class="ms-seal" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
      <circle cx="12" cy="9" r="6"/><path d="M12 5v8M8 9h8"/><path d="M9 14.5 7.5 22 12 19.5 16.5 22 15 14.5"/></svg>
    <h3 id="msLbRegion"></h3>
    <p class="ms-lb-min" id="msLbTitle"></p>
    <p>Официальная скан-копия письма готовится к публикации. Информационная поддержка министерств культуры
      и образования субъектов Российской Федерации сопровождает конкурсы и фестивали Центра на постоянной основе.</p>
    <span class="ms-lb-badge">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:14px;height:14px">
        <circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>
      Готовится к публикации</span>
  </div>
</div>

<script>
(function () {
  var items = Array.prototype.slice.call(document.querySelectorAll('.ms-item'));
  var chips = Array.prototype.slice.call(document.querySelectorAll('.ms-filter'));

  chips.forEach(function (c) {
    c.addEventListener('click', function () {
      chips.forEach(function (x) { x.classList.remove('active'); });
      c.classList.add('active');
      var r = c.getAttribute('data-region');
      items.forEach(function (it) {
        it.style.display = (r === 'all' || it.getAttribute('data-region') === r) ? '' : 'none';
      });
    });
  });

  var lb     = document.getElementById('msLb');
  var lbImg  = document.getElementById('msLbImg');
  var lbCard = document.getElementById('msLbCard');
  var lbReg  = document.getElementById('msLbRegion');
  var lbTit  = document.getElementById('msLbTitle');
  var closeBtn = document.getElementById('msLbClose');

  function open(it) {
    var ready = it.getAttribute('data-ready') === '1';
    var img   = it.getAttribute('data-img');
    if (ready && img) {
      lbImg.src = img;
      lbImg.alt = it.getAttribute('aria-label') || '';
      lbImg.style.display = 'block';
      lbCard.style.display = 'none';
    } else {
      lbReg.textContent = it.querySelector('.ms-region') ? it.querySelector('.ms-region').textContent : '';
      lbTit.textContent = it.getAttribute('data-titledoc') || '';
      lbImg.style.display = 'none';
      lbCard.style.display = 'block';
    }
    lb.classList.add('open');
    lb.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
  }
  function close() {
    lb.classList.remove('open');
    lb.setAttribute('aria-hidden', 'true');
    lbImg.src = '';
    document.body.style.overflow = '';
  }

  items.forEach(function (it) {
    it.addEventListener('click', function () { open(it); });
    it.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(it); }
    });
  });
  if (closeBtn) closeBtn.addEventListener('click', close);
  if (lb) lb.addEventListener('click', function (e) { if (e.target === lb) close(); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && lb.classList.contains('open')) close(); });
})();
</script>
<?php
$content = ob_get_clean();
render_page('Поддержка министерства', $content, [
    'active' => '/ministry-support',
    'meta'   => 'Письма и благодарности министерств культуры и образования субъектов Российской Федерации в поддержку конкурсов и фестивалей Культурного центра «Музыкальный Мир». Охват по регионам и федеральным округам.',
]);
