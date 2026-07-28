<?php
/** Политика конфиденциальности (slug privacy). */
$page = one("SELECT * FROM pages WHERE slug=?", ['privacy']);

$defaultBody = '<p>Настоящая Политика конфиденциальности (далее - Политика) определяет порядок обработки и защиты персональных данных Пользователей сайта Культурного центра «Музыкальный Мир» (далее - Центр) в соответствии с Федеральным законом от 27.07.2006 №152-ФЗ «О персональных данных».</p>'

  . '<h3>1. Общие положения</h3>'
  . '<p>Используя сайт и заполняя формы регистрации, заявки или обратной связи, Пользователь даёт согласие на обработку своих персональных данных на условиях, изложенных в настоящей Политике.</p>'

  . '<h3>2. Состав персональных данных</h3>'
  . '<p>Центр обрабатывает фамилию, имя, отчество, дату рождения, адрес электронной почты, номер телефона, почтовый адрес, наименование учреждения и иные сведения, которые Пользователь указывает при регистрации, подаче заявки или оформлении заказа наградных материалов.</p>'

  . '<h3>3. Цели обработки</h3>'
  . '<p>Персональные данные обрабатываются для регистрации Пользователя, приёма и оценки конкурсных заявок, оформления и отправки наградных документов, информирования о результатах конкурса, а также для связи с Пользователем по вопросам, связанным с использованием сайта.</p>'

  . '<h3>4. Правовые основания обработки</h3>'
  . '<p>Обработка персональных данных осуществляется на основании согласия Пользователя и в соответствии с Федеральным законом №152-ФЗ «О персональных данных», а также иными нормативными правовыми актами Российской Федерации.</p>'

  . '<h3>5. Порядок обработки и хранения</h3>'
  . '<p>Персональные данные хранятся и обрабатываются на серверах, расположенных на территории Российской Федерации, доступ к которым ограничен. Центр применяет организационные и технические меры для защиты данных от неправомерного доступа, изменения, раскрытия или уничтожения. Данные хранятся в течение срока, необходимого для достижения целей обработки, если иное не установлено законом.</p>'

  . '<h3>6. Права субъекта персональных данных</h3>'
  . '<p>Пользователь вправе получить сведения об обработке своих персональных данных, потребовать их уточнения, блокирования или удаления в случае, если данные являются неполными, устаревшими или недостоверными, а также отозвать согласие на обработку, направив обращение по адресу электронной почты, указанному в разделе «Контакты».</p>'

  . '<h3>7. Меры защиты</h3>'
  . '<p>Центр применяет правовые, организационные и технические меры защиты персональных данных, включая ограничение доступа к данным, использование защищённых каналов передачи данных и регулярную проверку систем хранения информации.</p>'

  . '<h3>8. Контакты по вопросам обработки данных</h3>'
  . '<p>По вопросам обработки персональных данных обращайтесь по адресу электронной почты <a href="mailto:' . cfgv('org_email') . '">' . cfgv('org_email') . '</a> или по телефону <a href="tel:' . cfgv('org_phone_raw') . '">' . cfgv('org_phone') . '</a>.</p>';

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
      <h2>Политика конфиденциальности</h2>
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
render_page('Политика конфиденциальности', $content, ['active' => '/privacy', 'meta' => 'Политика конфиденциальности Культурного центра «Музыкальный Мир»: обработка и защита персональных данных пользователей.']);
