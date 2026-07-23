<?php
/** Партнёрская программа для блогеров: описание, % с оплат, форма заявки на промокод. */

// Опциональные сервисы (почта/Telegram) — страница подключается напрямую (не через api/_boot.php).
foreach (['mailer', 'telegram'] as $svc) {
    $f = BASE_PATH . '/core/' . $svc . '.php';
    if (is_file($f)) require_once $f;
}

// Своя таблица — создаётся идемпотентно, миграции ядра не трогаем.
db()->exec("CREATE TABLE IF NOT EXISTS partner_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    full_name TEXT NOT NULL,
    network TEXT DEFAULT '',
    reach TEXT DEFAULT '',
    contact TEXT DEFAULT '',
    comment TEXT DEFAULT '',
    status TEXT DEFAULT 'new',
    created_at TEXT DEFAULT (datetime('now'))
)");

$percent = (int) setting('partner_percent', '15');

$networks = ['Instagram', 'VK', 'Telegram', 'YouTube', 'RuTube', 'Дзен', 'Другое'];

$fields = ['full_name' => '', 'network' => '', 'reach' => '', 'contact' => '', 'comment' => ''];
$errors = [];

if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'POST') {
    foreach ($fields as $k => $v) $fields[$k] = input($k);

    if (!csrf_check()) {
        flash('Сессия устарела. Обновите страницу и попробуйте снова.', 'error');
    } elseif (!rate_ok('partner:' . client_ip(), 10, 3600)) {
        flash('Слишком много заявок с Вашего адреса. Попробуйте позже.', 'error');
    } else {
        if (mb_strlen($fields['full_name']) < 3) $errors['full_name'] = true;
        if ($fields['network'] === '') $errors['network'] = true;
        if (mb_strlen($fields['reach']) < 1) $errors['reach'] = true;
        if (mb_strlen($fields['contact']) < 5) $errors['contact'] = true;

        if (!$errors) {
            insert('partner_requests', [
                'full_name' => $fields['full_name'],
                'network'   => $fields['network'],
                'reach'     => $fields['reach'],
                'contact'   => $fields['contact'],
                'comment'   => normalize_text($fields['comment']),
            ]);
            $subject = 'Заявка в партнёрскую программу - ' . $fields['full_name'];
            $body = '<p><b>Имя:</b> ' . h($fields['full_name']) . '</p>'
                  . '<p><b>Соцсеть:</b> ' . h($fields['network']) . '</p>'
                  . '<p><b>Охват:</b> ' . h($fields['reach']) . '</p>'
                  . '<p><b>Контакты:</b> ' . h($fields['contact']) . '</p>'
                  . '<p><b>Комментарий:</b><br>' . nl2br(h($fields['comment'])) . '</p>';
            $admin = cfgv('org_email');
            if (function_exists('mail_queue')) {
                mail_queue($admin, 'Оргкомитет', $subject, $body);
            } else {
                insert('mail_queue', ['to_email' => $admin, 'to_name' => 'Оргкомитет', 'subject' => $subject, 'body' => $body]);
            }
            if (function_exists('tg_notify_admin')) {
                tg_notify_admin("Заявка в партнёрскую программу\n{$fields['full_name']} - {$fields['network']}, охват {$fields['reach']}\nКонтакты: {$fields['contact']}");
            }
            audit('partner_request', 'partner_requests', null, ['network' => $fields['network']]);
            flash('Заявка принята. Оргкомитет свяжется с Вами и пришлёт персональный промокод.', 'success');
            redirect('/partner');
        }
    }
}

$icoStep1 = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M4 4h16v16H4z"/><path d="m4 6 8 6 8-6"/></svg>';
$icoStep2 = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>';
$icoStep3 = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 10.6 6.8-4.2M8.6 13.4l6.8 4.2"/></svg>';
$icoStep4 = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 2v20M17 5.5c0-1.9-2.2-3.5-5-3.5S7 3.6 7 5.5 9.2 9 12 9s5 1.6 5 3.5-2.2 3.5-5 3.5-5-1.6-5-3.5"/></svg>';

ob_start(); ?>
<style>
.pn-hero{position:relative;overflow:hidden}
/* мягкое золотое сияние за интро */
.pn-hero::before{content:"";position:absolute;left:50%;top:-90px;width:min(640px,120%);height:420px;
  transform:translateX(-50%);z-index:0;pointer-events:none;
  background:radial-gradient(55% 55% at 50% 40%,var(--gold-soft),transparent 70%)}
.pn-hero .container{position:relative;z-index:1}
.pn-hero .ribbon{display:inline-flex;align-items:center;gap:8px;padding:8px 16px;border-radius:999px;
  background:var(--gold-soft);border:1px solid var(--glass-brd);color:var(--gold-ink);font-weight:700;
  font-size:.86rem;letter-spacing:.02em;margin-bottom:16px;box-shadow:var(--shadow-card)}
.pn-hero .ribbon svg{width:15px;height:15px;stroke:var(--gold-2)}
[data-theme="dark"] .pn-hero .ribbon{color:var(--gold)}

.pn-reward{position:relative;display:flex;align-items:center;gap:34px;flex-wrap:wrap;justify-content:center;text-align:left}
/* ореол за кольцом-процентом */
.pn-reward .stat-ring{position:relative}
.pn-reward .stat-ring::before{content:"";position:absolute;inset:-10px;border-radius:50%;z-index:-1;
  background:radial-gradient(circle,var(--gold-soft),transparent 68%)}
.pn-reward .ring-num b{font-family:var(--ff-display);font-weight:800;font-size:2rem;color:var(--gold-2)}
.pn-reward .txt{flex:1 1 320px;min-width:280px}
.pn-reward .txt h2{margin-top:0}
@media(max-width:640px){.pn-reward{flex-direction:column;text-align:center;gap:22px}}

.pn-perks{margin-top:22px}
.pn-perks .perk{display:flex;gap:14px;align-items:flex-start;margin-bottom:14px}
.pn-perks .perk .perk-ic{flex:0 0 auto;width:38px;height:38px;border-radius:11px;display:grid;place-items:center;
  background:linear-gradient(150deg,var(--gold-soft),transparent);border:1px solid var(--glass-brd);
  box-shadow:inset 0 1px 0 rgba(255,255,255,.25)}
.pn-perks .perk .perk-ic svg{width:20px;height:20px;stroke:var(--gold-2)}
.pn-perks .perk b{color:var(--text)}
.pn-perks .perk p{color:var(--muted);margin:2px 0 0;font-size:.92rem}
</style>

<section class="section section--parchment pn-hero">
  <div class="container" style="max-width:780px;text-align:center">
    <div class="reveal">
      <span class="ribbon"><svg viewBox="0 0 24 24" fill="none" stroke-width="1.7"><path d="m12 2 2.9 6.3 6.9.6-5.2 4.5 1.6 6.7L12 17l-6.2 3.6 1.6-6.7L2.2 8.9l6.9-.6L12 2Z"/></svg>Для блогеров и авторов</span>
      <h1 style="font-family:var(--ff-display);font-size:clamp(1.9rem,4vw,2.7rem);margin-bottom:.3em">Партнёрская программа</h1>
      <p style="max-width:620px;margin:0 auto">Рассказывайте своей аудитории о конкурсах Культурного центра «Музыкальный Мир»
        и получайте <b style="color:var(--gold-2)"><?= (int) $percent ?>%</b> с каждой оплаты по Вашему персональному промокоду.</p>
      <div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap;margin-top:22px">
        <a class="btn btn--primary btn--lg" href="#partnerForm">Оставить заявку</a>
        <a class="btn btn--ghost btn--lg" href="#howto">Как это работает</a>
      </div>
    </div>
  </div>
</section>

<section class="section" id="howto">
  <div class="container">
    <div class="section-head reveal"><p class="eyebrow">Как это работает</p><h2>Четыре простых шага</h2><div class="gold-rule"></div></div>
    <div class="steps">
      <?php foreach ([
          [$icoStep1, 'Заявка', 'Заполните форму ниже: имя, соцсеть, охват аудитории и контакты'],
          [$icoStep2, 'Промокод', 'Оргкомитет выдаст персональный промокод и ссылку для Вашей аудитории'],
          [$icoStep3, 'Публикация', 'Делитесь промокодом в постах, сторис и роликах о конкурсах'],
          [$icoStep4, 'Вознаграждение', 'Получайте процент с каждой оплаты организационного взноса по Вашему коду'],
      ] as [$ic, $t, $d]): ?>
        <div class="step reveal"><div class="ic"><?= $ic ?></div><h3><?= h($t) ?></h3><p style="color:var(--muted)"><?= h($d) ?></p></div>
      <?php endforeach; ?>
    </div>
  </div>
</section>

<section class="section section--tint">
  <div class="container" style="max-width:860px">
    <div class="card reveal" style="padding:34px">
      <div class="pn-reward">
        <div class="stat-ring" data-value="<?= (int) $percent ?>" aria-hidden="true">
          <svg viewBox="0 0 120 120">
            <circle class="ring-track" cx="60" cy="60" r="52"></circle>
            <circle class="ring-val" cx="60" cy="60" r="52"></circle>
          </svg>
          <div class="ring-num"><b><?= (int) $percent ?>%</b></div>
        </div>
        <div class="txt">
          <p class="eyebrow">Вознаграждение</p>
          <h2>Как начисляется процент</h2>
          <p style="color:var(--muted)">
            Партнёр получает <b style="color:var(--gold-2)"><?= (int) $percent ?>%</b> от суммы каждого оплаченного
            организационного взноса участников, которые указали Ваш промокод при подаче заявки.
          </p>
          <div class="pn-perks">
            <div class="perk"><span class="perk-ic"><svg viewBox="0 0 24 24" fill="none" stroke-width="1.8"><path d="M4 12l5 5L20 6"/></svg></span><div><b>Ежемесячный отчёт</b><p>Начисления отражаются в отчёте, который Оргкомитет присылает партнёру каждый месяц.</p></div></div>
            <div class="perk"><span class="perk-ic"><svg viewBox="0 0 24 24" fill="none" stroke-width="1.8"><path d="M4 12l5 5L20 6"/></svg></span><div><b>Без минимальной суммы</b><p>Минимального порога для выплаты нет - Вы получаете вознаграждение с первой же оплаты.</p></div></div>
            <div class="perk"><span class="perk-ic"><svg viewBox="0 0 24 24" fill="none" stroke-width="1.8"><path d="M4 12l5 5L20 6"/></svg></span><div><b>Персональный промокод</b><p>Отдельный код и ссылка закрепляются за Вами - все оплаты по ним учитываются автоматически.</p></div></div>
          </div>
        </div>
      </div>
    </div>
  </div>
</section>

<section class="section" id="partnerForm">
  <div class="container" style="max-width:560px">
    <div class="section-head reveal"><p class="eyebrow">Заявка</p><h2>Получить промокод</h2>
      <p>Расскажите о себе - мы свяжемся с Вами и вышлем условия сотрудничества.</p></div>

    <form class="card reveal" method="post" action="<?= url('/partner') ?>" style="padding:28px" novalidate>
      <?= csrf_field() ?>
      <div class="field<?= isset($errors['full_name']) ? ' error' : '' ?>">
        <label for="p_full_name">Имя и фамилия</label>
        <input type="text" id="p_full_name" name="full_name" value="<?= h($fields['full_name']) ?>" placeholder="Анна Соколова" required>
        <div class="err-msg">Укажите имя и фамилию.</div>
      </div>
      <div class="field<?= isset($errors['network']) ? ' error' : '' ?>">
        <label for="p_network">Основная соцсеть</label>
        <select id="p_network" name="network" required>
          <option value="">Выберите площадку</option>
          <?php foreach ($networks as $n): ?>
            <option value="<?= h($n) ?>" <?= $fields['network'] === $n ? 'selected' : '' ?>><?= h($n) ?></option>
          <?php endforeach; ?>
        </select>
        <div class="err-msg">Выберите соцсеть.</div>
      </div>
      <div class="field<?= isset($errors['reach']) ? ' error' : '' ?>">
        <label for="p_reach">Охват аудитории</label>
        <input type="text" id="p_reach" name="reach" value="<?= h($fields['reach']) ?>" placeholder="Например, 24 000 подписчиков" required>
        <div class="hint">Подписчики, средние просмотры или охват сторис - как удобнее.</div>
        <div class="err-msg">Укажите охват аудитории.</div>
      </div>
      <div class="field<?= isset($errors['contact']) ? ' error' : '' ?>">
        <label for="p_contact">Контакты для связи</label>
        <input type="text" id="p_contact" name="contact" value="<?= h($fields['contact']) ?>" placeholder="Почта, телефон или Telegram" required>
        <div class="err-msg">Укажите способ связи с Вами.</div>
      </div>
      <div class="field">
        <label for="p_comment">Комментарий</label>
        <textarea id="p_comment" name="comment" rows="3" placeholder="Ссылка на профиль, тематика контента"><?= h($fields['comment']) ?></textarea>
      </div>
      <button class="btn btn--primary btn--block" type="submit">Отправить заявку</button>
    </form>
  </div>
</section>
<?php
$content = ob_get_clean();
render_page('Партнёрская программа', $content, [
    'active' => '/partner',
    'meta'   => 'Партнёрская программа КЦ «Музыкальный Мир» для блогеров: персональный промокод и ' . (int) $percent . '% с оплат участников.',
]);
