<?php
/** Пользовательское соглашение (slug agreement). */
$page = one("SELECT * FROM pages WHERE slug=?", ['agreement']);

$defaultBody = '<p>Настоящее Пользовательское соглашение (далее - Соглашение) определяет условия использования сайта Культурного центра «Музыкальный Мир» (далее - Центр) и порядок взаимодействия Центра с посетителями сайта и участниками конкурсов (далее - Пользователь).</p>'

  . '<h3>1. Общие положения</h3>'
  . '<p>Используя сайт, Пользователь подтверждает, что ознакомился с условиями Соглашения и принимает их в полном объёме. Если Пользователь не согласен с условиями, использование сайта следует прекратить.</p>'

  . '<h3>2. Термины и определения</h3>'
  . '<p>«Сайт» - интернет-ресурс Культурного центра «Музыкальный Мир». «Пользователь» - лицо, получившее доступ к сайту. «Заявка» - форма, заполняемая Пользователем для участия в конкурсе. «Личный кабинет» - раздел сайта, доступный после регистрации.</p>'

  . '<h3>3. Предмет соглашения</h3>'
  . '<p>Центр предоставляет Пользователю возможность знакомиться с информацией о конкурсах и фестивалях, подавать заявки на участие, оплачивать наградные материалы и оставлять отзывы. Услуги оказываются в соответствии с положениями конкурсов, размещёнными на сайте, и главой 57 Гражданского кодекса Российской Федерации.</p>'

  . '<h3>4. Права и обязанности сторон</h3>'
  . '<p>Пользователь обязуется указывать достоверные данные при подаче заявки и регистрации, самостоятельно нести ответственность за содержание переданных конкурсных материалов и соблюдать авторские права третьих лиц.</p>'
  . '<p>Центр обязуется организовать оценку конкурсных работ жюри, направить результаты и наградные документы в срок, указанный в положении конкурса, и обеспечить сохранность переданных Пользователем данных.</p>'

  . '<h3>5. Персональные данные</h3>'
  . '<p>Обработка персональных данных Пользователя осуществляется в соответствии с Политикой конфиденциальности, размещённой на странице «<a href="' . url('/privacy') . '">Политика конфиденциальности</a>».</p>'

  . '<h3>6. Ответственность</h3>'
  . '<p>Центр не несёт ответственности за временную недоступность сайта по техническим причинам, а также за содержание материалов, направленных Пользователем в составе конкурсной заявки. Пользователь несёт ответственность за подлинность предоставленных сведений.</p>'

  . '<h3>7. Порядок разрешения споров</h3>'
  . '<p>Все споры и разногласия по Соглашению разрешаются путём переговоров. При невозможности урегулирования спор передаётся на рассмотрение суда по месту нахождения Центра в порядке, установленном законодательством Российской Федерации.</p>'

  . '<h3>8. Заключительные положения</h3>'
  . '<p>Центр вправе вносить изменения в Соглашение в одностороннем порядке. Актуальная редакция всегда размещена на данной странице. Продолжение использования сайта после внесения изменений означает согласие Пользователя с новой редакцией.</p>'
  . '<p>По вопросам, связанным с Соглашением, обращайтесь по адресу электронной почты <a href="mailto:' . cfgv('org_email') . '">' . cfgv('org_email') . '</a>.</p>';

// Тело статьи: из БД, если задано, иначе - редакция по умолчанию.
$body = (string) ($page['body'] ?? $defaultBody);

// Оглавление и якоря: проставляем id на разделы <h3> и собираем список ссылок.
$toc = '';
$secN = 0;
$body = preg_replace_callback('/<h3(\s[^>]*)?>(.*?)<\/h3>/is', function ($m) use (&$toc, &$secN) {
    $secN++;
    $id = 'razdel-' . $secN;
    $title = trim(strip_tags($m[2]));
    $toc .= '<li><a href="#' . $id . '">' . $title . '</a></li>';
    return '<h3 id="' . $id . '"' . ($m[1] ?? '') . '>' . $m[2] . '</h3>';
}, $body);

// Реквизиты организации (реальные - из конфигурации, с безопасными значениями по умолчанию).
$reqOrg    = h((string) cfgv('org_full', 'Культурный центр «Музыкальный Мир»'));
$reqReg    = h((string) cfgv('org_reg', 'Роскомнадзор №094084 от 24.06.2025'));
$reqAddr   = h((string) cfgv('org_address', '109240, г. Москва, ул. Солянка, д.14, стр.7'));
$reqPhone  = h((string) cfgv('org_phone', '8 (950) 945-99-00'));
$reqPhoneR = h((string) cfgv('org_phone_raw', '+79509459900'));
$reqEmail  = h((string) cfgv('org_email', 'kulturniy.centr.mir@mail.ru'));
$reqDir    = 'Оргкомитет Культурного центра';

ob_start(); ?>
<style>
.legal{max-width:70ch;margin-inline:auto}
.legal-article{font-family:var(--ff-body);color:var(--text-dim);line-height:1.78;font-size:1.02rem}
.legal-article p{margin:0 0 1.15em}
.legal-article h3{font-family:var(--ff-serif);color:var(--text);font-weight:700;
  margin:2em 0 .55em;font-size:1.26rem;line-height:1.2;scroll-margin-top:96px}
.legal-article a{color:var(--gold-ink);text-decoration:underline;text-underline-offset:2px;overflow-wrap:anywhere}
[data-theme="dark"] .legal-article a{color:var(--gold)}
.legal-article p:first-of-type::first-letter{font-family:var(--ff-serif);font-size:3.4em;line-height:.78;
  float:left;padding:.04em .12em 0 0;color:var(--gold-2);font-weight:700}
.legal-toc{margin:0 auto 30px;padding:18px 22px;border:1px solid var(--glass-brd);border-radius:16px;
  background:var(--glass, rgba(255,255,255,.5))}
.legal-toc__t{font-family:var(--ff-serif);font-weight:700;color:var(--text);margin:0 0 10px;font-size:1.02rem}
.legal-toc ol{margin:0;padding-left:1.3em;color:var(--muted)}
.legal-toc li{margin:.34em 0}
.legal-toc a{color:var(--gold-ink);text-decoration:none;overflow-wrap:anywhere}
.legal-toc a:hover{text-decoration:underline}
[data-theme="dark"] .legal-toc a{color:var(--gold)}
.legal-reqs{margin:34px auto 0;padding:22px 24px;border:1px solid var(--glass-brd);border-radius:16px;
  background:var(--glass, rgba(255,255,255,.5))}
.legal-reqs__t{font-family:var(--ff-serif);font-weight:700;color:var(--text);margin:0 0 12px;font-size:1.05rem}
.legal-reqs dl{margin:0;display:grid;grid-template-columns:auto 1fr;gap:8px 16px;font-size:.95rem}
.legal-reqs dt{color:var(--muted);white-space:nowrap}
.legal-reqs dd{margin:0;color:var(--text-dim);overflow-wrap:anywhere}
.legal-reqs a{color:var(--gold-ink);text-decoration:none;overflow-wrap:anywhere}
[data-theme="dark"] .legal-reqs a{color:var(--gold)}
@media (max-width:560px){
  .legal-reqs dl{grid-template-columns:1fr;gap:2px 0}
  .legal-reqs dt{margin-top:10px}
  .legal-reqs dt:first-child{margin-top:0}
}
</style>

<section class="section">
  <div class="container" style="max-width:860px">
    <div class="section-head reveal">
      <p class="eyebrow">Правовая информация</p>
      <h2>Пользовательское соглашение</h2>
      <div class="gold-rule"></div>
    </div>

    <div class="legal">
      <?php if ($toc !== ''): ?>
        <nav class="legal-toc reveal" aria-label="Содержание">
          <p class="legal-toc__t">Содержание</p>
          <ol><?= $toc ?></ol>
        </nav>
      <?php endif; ?>

      <article class="legal-article reveal"><?= $body ?></article>

      <aside class="legal-reqs reveal" aria-label="Реквизиты организации">
        <p class="legal-reqs__t">Реквизиты</p>
        <dl>
          <dt>Организация</dt><dd><?= $reqOrg ?></dd>
          <dt>Регистрация</dt><dd><?= $reqReg ?></dd>
          <dt>Руководство</dt><dd><?= $reqDir ?></dd>
          <dt>Адрес</dt><dd><?= $reqAddr ?></dd>
          <dt>Телефон</dt><dd><a href="tel:<?= $reqPhoneR ?>"><?= $reqPhone ?></a></dd>
          <dt>Электронная почта</dt><dd><a href="mailto:<?= $reqEmail ?>"><?= $reqEmail ?></a></dd>
        </dl>
      </aside>
    </div>
  </div>
</section>
<?php
$content = ob_get_clean();
render_page('Пользовательское соглашение', $content, ['active' => '/agreement', 'meta' => 'Пользовательское соглашение Культурного центра «Музыкальный Мир»: условия использования сайта и участия в конкурсах.']);
