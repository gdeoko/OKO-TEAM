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
  ['/order-awards',    'Заказ наград',         '<rect x="3" y="8" width="18" height="12" rx="2"/><path d="M3 12h18M8 8V6a4 4 0 0 1 8 0v2"/>'],
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
  ['/club',            'ВИП-клуб',             '<path d="M12 2l2.4 7.4H22l-6 4.5 2.3 7.1L12 16.7 5.7 21l2.3-7.1-6-4.5h7.6z"/>'],
  ['/verify',          'Проверка диплома',     '<path d="M12 2 4 5v6c0 5 3.4 8.5 8 11 4.6-2.5 8-6 8-11V5z"/><path d="m9 12 2 2 4-4"/>'],
  ['/agreement',       'Соглашение',           '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/>'],
  ['/privacy',         'Конфиденциальность',   '<rect x="3" y="11" width="18" height="10" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>'],
];
$SECTIONS[] = $u
  ? ['/cabinet', 'Личный кабинет', '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>']
  : ['/login',   'Вход и регистрация', '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>'];
if ($u) { $SECTIONS[] = ['/logout', 'Выйти', '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>']; }

ob_start(); ?>
<section class="section menu-page">
  <div class="container">
    <div class="menu-head">
      <p class="eyebrow eyebrow--script">Навигация</p>
      <h1>Меню</h1>
      <p class="menu-sub">Все разделы КЦ «Музыкальный Мир»</p>
    </div>

    <div class="menu-grid">
      <?php foreach ($SECTIONS as $i => [$href, $label, $path]): ?>
        <a class="menu-tile" href="<?= url($href) ?>" style="--i:<?= $i ?>">
          <span class="menu-tile-ic">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><?= $path ?></svg>
          </span>
          <span class="menu-tile-lbl"><?= h($label) ?></span>
          <svg class="menu-tile-arr" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>
        </a>
      <?php endforeach; ?>
    </div>
  </div>
</section>
<?php
$content = ob_get_clean();
render_page('Меню', $content, ['active' => '/menu', 'meta' => 'Меню сайта КЦ «Музыкальный Мир»: все разделы, конкурсы, награды, концерты, личный кабинет.']);
