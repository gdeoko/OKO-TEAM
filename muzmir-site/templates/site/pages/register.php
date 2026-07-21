<?php
/** Регистрация: email + пароль + ФИО. POST обрабатывается здесь. */

if (current_user()) redirect('/cabinet');

$email = ''; $name = '';
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $name = input('full_name');
    $email = input('email');
    $password = (string)($_POST['password'] ?? '');
    $consent = !empty($_POST['consent']);

    if (!csrf_check()) {
        flash('Сессия устарела. Обновите страницу и попробуйте снова.', 'error');
    } elseif (!rate_ok('register:' . client_ip(), 10, 3600)) {
        flash('Слишком много попыток регистрации. Попробуйте позже.', 'error');
    } elseif (mb_strlen($name) < 3) {
        flash('Укажите Ваше имя и фамилию.', 'error');
    } elseif (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        flash('Проверьте адрес электронной почты.', 'error');
    } elseif (mb_strlen($password) < 6) {
        flash('Пароль должен быть не короче 6 символов.', 'error');
    } elseif (!$consent) {
        flash('Отметьте согласие на обработку персональных данных.', 'error');
    } else {
        // Автокоррекция ФИО, если доступен валидатор.
        if (function_exists('v_fio')) $name = v_fio($name);
        $res = register_user($email, $password, $name);
        if (!$res['ok']) {
            flash($res['error'] ?? 'Не удалось создать аккаунт.', 'error');
        } else {
            $uid = (int)$res['id'];
            // Письмо подтверждения - в очередь, если механизм подключён.
            if (function_exists('mail_queue')) {
                $link = url('/verify-email?token=' . urlencode((string)($res['verify_token'] ?? '')));
                $html = function_exists('mail_template')
                    ? mail_template('registration', ['name' => $name, 'verify_url' => $link])
                    : '<p>Здравствуйте, ' . h($name) . '.</p><p>Подтвердите электронную почту по ссылке: <a href="' . h($link) . '">' . h($link) . '</a></p>';
                mail_queue($email, $name, 'Подтверждение регистрации - КЦ «Музыкальный Мир»', $html);
            }
            login_user($uid);
            audit('register', 'user', $uid);
            flash('Аккаунт создан. Добро пожаловать в личный кабинет.', 'success');
            redirect('/cabinet');
        }
    }
}

$gicon = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="#4285F4" d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.4a5.5 5.5 0 0 1-2.4 3.6v3h3.9c2.3-2.1 3.6-5.2 3.6-8.8z"/><path fill="#34A853" d="M12 24c3.2 0 6-1.1 8-3l-3.9-3a7.2 7.2 0 0 1-10.7-3.8H1.4v3.1A12 12 0 0 0 12 24z"/><path fill="#FBBC05" d="M5.4 14.2a7.1 7.1 0 0 1 0-4.5V6.6H1.4a12 12 0 0 0 0 10.8z"/><path fill="#EA4335" d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4A12 12 0 0 0 1.4 6.6l4 3.1A7.2 7.2 0 0 1 12 4.8z"/></svg>';
$ticon = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="m22 3-9.5 9.5M22 3l-6.5 18-3.5-8-8-3.5L22 3z"/></svg>';
$vkicon = '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="#0077FF" d="M13 18.5c-6.3 0-10-4.3-10.1-11.5h3.2c.1 5.3 2.5 7.6 4.3 8.1V7h3v4.6c1.8-.2 3.7-2.3 4.4-4.6h3c-.5 2.8-2.5 4.9-4 5.8 1.5.7 3.8 2.6 4.7 5.7h-3.3c-.7-2.2-2.4-3.9-4.8-4.2v4.2H13z"/></svg>';
$oauth = [
    'google' => cfgv('google_client_id') && cfgv('google_client_secret'),
    'vk'     => cfgv('vk_client_id') && cfgv('vk_client_secret'),
    'tg'     => (bool) (cfgv('tg_bot_token') && cfgv('tg_bot_user')),
];
$tg_user = (string) cfgv('tg_bot_user');
$tg_auth_url = url('/api/v1/tg_login');

ob_start(); ?>
<section class="section">
  <div class="container" style="max-width:460px">
    <div class="section-head reveal" style="margin-bottom:28px">
      <p class="eyebrow">Личный кабинет</p>
      <h2>Регистрация</h2>
      <div class="gold-rule"></div>
      <p>Создайте аккаунт, чтобы подавать заявки и получать наградные документы онлайн.</p>
    </div>

    <div class="card reveal" style="padding:28px">
      <form method="post" action="<?= url('/register') ?>" novalidate>
        <?= csrf_field() ?>
        <div class="field">
          <label for="full_name">Фамилия и имя</label>
          <input type="text" id="full_name" name="full_name" value="<?= h($name) ?>" placeholder="Иванова Мария" autocomplete="name" required>
        </div>
        <div class="field">
          <label for="email">Электронная почта</label>
          <input type="email" id="email" name="email" value="<?= h($email) ?>" placeholder="you@example.ru" autocomplete="email" required>
        </div>
        <div class="field">
          <label for="password">Пароль</label>
          <input type="password" id="password" name="password" placeholder="Не короче 6 символов" autocomplete="new-password" minlength="6" required>
        </div>
        <div class="field" style="display:flex;gap:10px;align-items:flex-start">
          <input type="checkbox" id="consent" name="consent" value="1" style="width:auto;margin-top:4px" required>
          <label for="consent" style="font-weight:400;font-size:.9rem;margin:0">
            Я даю согласие на обработку персональных данных и принимаю
            <a href="<?= url('/privacy') ?>">Политику конфиденциальности</a> и
            <a href="<?= url('/agreement') ?>">Пользовательское соглашение</a>.
          </label>
        </div>
        <button class="btn btn--primary btn--block btn--lg" type="submit">Создать аккаунт</button>
      </form>

      <div style="display:flex;align-items:center;gap:12px;margin:22px 0;color:var(--muted);font-size:.85rem">
        <span style="flex:1;height:1px;background:var(--line)"></span>или<span style="flex:1;height:1px;background:var(--line)"></span>
      </div>

      <div style="display:grid;gap:12px">
        <?php if ($oauth['google']): ?>
          <a class="btn btn--ghost btn--block" href="<?= url('/api/v1/oauth_google') ?>"><?= $gicon ?> Продолжить с Google</a>
        <?php else: ?>
          <button type="button" class="btn btn--ghost btn--block" disabled style="opacity:.55;cursor:not-allowed"><?= $gicon ?> Продолжить с Google</button>
        <?php endif; ?>

        <?php if ($oauth['vk']): ?>
          <a class="btn btn--ghost btn--block" href="<?= url('/api/v1/oauth_vk') ?>"><?= $vkicon ?> Продолжить с VK</a>
        <?php else: ?>
          <button type="button" class="btn btn--ghost btn--block" disabled style="opacity:.55;cursor:not-allowed"><?= $vkicon ?> Продолжить с VK</button>
        <?php endif; ?>

        <?php if ($oauth['tg']): ?>
          <script async src="https://telegram.org/js/telegram-widget.js?22"
                  data-telegram-login="<?= h($tg_user) ?>" data-size="large" data-radius="10"
                  data-userpic="false" data-auth-url="<?= h($tg_auth_url) ?>" data-request-access="write"></script>
        <?php else: ?>
          <button type="button" class="btn btn--ghost btn--block" disabled style="opacity:.55;cursor:not-allowed"><?= $ticon ?> Продолжить с Telegram</button>
        <?php endif; ?>
      </div>

      <p style="text-align:center;margin:20px 0 0;color:var(--muted)">
        Уже зарегистрированы? <a href="<?= url('/login') ?>">Войдите</a>
      </p>
    </div>
  </div>
</section>
<?php
$content = ob_get_clean();
render_page('Регистрация', $content, ['active' => '/register', 'meta' => 'Регистрация участника КЦ «Музыкальный Мир».']);
