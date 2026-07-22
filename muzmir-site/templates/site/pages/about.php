<?php
/** О нас (slug about): история КЦ, партнёры, Оргкомитет (без ФИО). */
$page = one("SELECT * FROM pages WHERE slug=?", ['about']);

$defaultBody = '<p>Культурный центр «Музыкальный Мир» - российская организация в сфере культуры и искусства. Мы организуем международные и всероссийские онлайн-конкурсы и фестивали, работаем с участниками из разных регионов России и зарубежных стран.</p>'
    . '<p>История центра начинается с проведения локальных творческих конкурсов, которые постепенно выросли в постоянно действующую площадку для музыкантов, вокалистов, хореографов, артистов театра и мастеров декоративно-прикладного искусства. За годы работы конкурсная программа расширилась, а география участников охватила десятки регионов и стран.</p>';

/* Информационная поддержка — согласно официальным положениям конкурсов. */
$partners = [
    ['Министерства культуры и образования субъектов Российской Федерации', 'Конкурсы Культурного центра «Музыкальный Мир» проводятся при информационной поддержке региональных министерств культуры и образования.'],
    ['Государственный портал «PRO.Культура.РФ»', 'Национальная информационная система в сфере культуры — публикация анонсов и освещение культурных мероприятий центра.'],
];
?>
<?php ob_start(); ?>
<style>
.article-cap p:first-of-type::first-letter{
  font-family:var(--ff-serif);font-size:3.4em;line-height:.78;float:left;
  padding:.04em .1em 0 0;color:var(--gold-2);font-weight:700;
}
</style>

<section class="section">
  <div class="container" style="max-width:820px">
    <div class="section-head reveal">
      <p class="eyebrow">Культурный центр</p>
      <h2>О нас</h2>
      <div class="gold-rule"></div>
    </div>
    <div class="article-cap reveal">
      <?= $page['body'] ?? $defaultBody ?>
    </div>
  </div>
</section>

<section class="section section--tint">
  <div class="container" style="max-width:900px">
    <div class="section-head reveal">
      <p class="eyebrow">Организация</p>
      <h2>Реквизиты</h2>
      <div class="gold-rule"></div>
    </div>
    <div class="grid grid-2">
      <div class="card reveal">
        <h3>Сведения об организации</h3>
        <p style="color:var(--text-dim);margin-bottom:8px"><strong>Полное наименование:</strong> Культурный центр «Музыкальный Мир».</p>
        <p style="color:var(--text-dim);margin-bottom:8px"><strong>Генеральный директор:</strong> Ильясов Альберт Ильясович.</p>
        <p style="color:var(--text-dim);margin-bottom:8px"><strong>Регистрация:</strong> Роскомнадзор от 24.06.2025 №094084.</p>
        <p style="color:var(--text-dim);margin-bottom:0"><strong>Юридический адрес:</strong> <?= h(cfgv('org_address')) ?>.</p>
      </div>
      <div class="card reveal">
        <h3>Контакты и режим работы</h3>
        <p style="color:var(--text-dim);margin-bottom:8px"><strong>Телефон:</strong> <a href="tel:<?= h(cfgv('org_phone_raw')) ?>"><?= h(cfgv('org_phone')) ?></a></p>
        <p style="color:var(--text-dim);margin-bottom:8px"><strong>Электронная почта:</strong> <a href="mailto:<?= h(cfgv('org_email')) ?>"><?= h(cfgv('org_email')) ?></a></p>
        <p style="color:var(--text-dim);margin-bottom:0"><strong>Режим работы:</strong> <?= h(cfgv('org_hours')) ?></p>
      </div>
    </div>
  </div>
</section>

<section class="section">
  <div class="container">
    <div class="section-head reveal">
      <p class="eyebrow">Информационная поддержка</p>
      <h2>Инфопартнёры</h2>
      <div class="gold-rule"></div>
    </div>
    <div class="grid grid-2">
      <?php foreach ($partners as [$name, $descr]): ?>
        <div class="card reveal">
          <h3><?= h($name) ?></h3>
          <p style="color:var(--text-dim)"><?= h($descr) ?></p>
        </div>
      <?php endforeach; ?>
    </div>
  </div>
</section>

<section class="section">
  <div class="container" style="max-width:820px">
    <div class="section-head reveal">
      <p class="eyebrow">Управление</p>
      <h2>Оргкомитет</h2>
      <div class="gold-rule"></div>
    </div>
    <div class="reveal" style="color:var(--text-dim)">
      <p>Работу Культурного центра «Музыкальный Мир» организует Оргкомитет. Он формирует положения конкурсов, утверждает состав жюри и следит за соблюдением правил на каждом этапе - от приёма заявок до выдачи наградных документов.</p>
      <p>Оргкомитет возглавляет Председатель Оргкомитета, который утверждает итоговые решения и представляет центр во взаимодействии с партнёрами и учреждениями культуры.</p>
      <p>В состав жюри входят педагоги, деятели культуры и искусства с профильным образованием и опытом работы. Члены жюри оценивают конкурсные работы по утверждённым критериям и формируют результаты независимо друг от друга.</p>
    </div>
  </div>
</section>

<section class="section section--tint">
  <div class="container" style="max-width:900px">
    <div class="section-head reveal">
      <p class="eyebrow">Оценка работ</p>
      <h2>Компетентное жюри</h2>
      <div class="gold-rule"></div>
    </div>
    <div class="grid grid-2">
      <div class="card reveal">
        <h3>Состав жюри</h3>
        <p style="color:var(--text-dim)">Председатель жюри — народный или заслуженный артист, видный деятель искусств, ректор или профессор ведущего профильного вуза. В число почётных членов входят представители министерств и ведомств культуры, директора международных фестивалей, арт-менеджеры и продюсеры. Работы по каждому направлению — вокал, хореография, инструментальное исполнительство, театр, художественное слово, ИЗО, фото- и видеоискусство, цирковое искусство — оценивают профильные эксперты.</p>
      </div>
      <div class="card reveal">
        <h3>Критерии отбора жюри</h3>
        <p style="color:var(--text-dim)">Для высокого, в том числе международного статуса конкурса Оргкомитет учитывает: присутствие экспертов из разных стран (не менее 3–4 стран); педагогический стаж членов жюри не менее 10 лет и первую или высшую квалификационную категорию по профилю конкурса; отсутствие конфликта интересов — как правило, член жюри не оценивает собственных учеников и коллективы.</p>
      </div>
    </div>
    <p class="reveal" style="color:var(--muted);font-size:.9rem;margin-top:18px">В целях безопасности членов жюри их персональные данные не публикуются, не выдаются на руки и не передаются третьим лицам (Федеральный закон №152-ФЗ). Протоколы и аттестационные выписки жюри также не публикуются и не выдаются на руки (Федеральный закон №149-ФЗ).</p>
  </div>
</section>
<?php
$content = ob_get_clean();
render_page('О нас', $content, ['active' => '/about', 'meta' => 'О Культурном центре «Музыкальный Мир»: реквизиты, генеральный директор Ильясов А.И., информационная поддержка, работа Оргкомитета и компетентного жюри.']);
