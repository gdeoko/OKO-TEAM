<?php
/** О нас (slug about): история КЦ, партнёры, Оргкомитет (без ФИО). */
$page = one("SELECT * FROM pages WHERE slug=?", ['about']);

$defaultBody = '<p>Культурный центр «Музыкальный Мир» - российская организация в сфере культуры и искусства. Мы организуем международные и всероссийские онлайн-конкурсы и фестивали, работаем с участниками из разных регионов России и зарубежных стран.</p>'
    . '<p>История центра начинается с проведения локальных творческих конкурсов, которые постепенно выросли в постоянно действующую площадку для музыкантов, вокалистов, хореографов, артистов театра и мастеров декоративно-прикладного искусства. За годы работы конкурсная программа расширилась, а география участников охватила десятки регионов и стран.</p>';

$partners = [
    ['ZAMIS', 'Студия звуко- и видеозаписи. Обеспечивает техническое качество конкурсных материалов и трансляций.'],
    ['Mr.Archer', 'Дизайнерская арт-студия. Отвечает за оформление наградных документов, афиш и фирменного стиля конкурсов.'],
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
  <div class="container">
    <div class="section-head reveal">
      <p class="eyebrow">Вместе с нами</p>
      <h2>Партнёры</h2>
      <div class="gold-rule"></div>
    </div>
    <div class="grid grid-2">
      <?php foreach ($partners as [$name, $descr]): ?>
        <div class="card reveal">
          <h3>«<?= h($name) ?>»</h3>
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
<?php
$content = ob_get_clean();
render_page('О нас', $content, ['active' => '/about', 'meta' => 'О Культурном центре «Музыкальный Мир»: история, партнёры «ZAMIS» и «Mr.Archer», работа Оргкомитета и жюри.']);
