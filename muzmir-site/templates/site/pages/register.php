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
                    ? mail_template('verify_email', ['name' => $name, 'link' => $link])
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

      <p style="text-align:center;margin:20px 0 0;color:var(--muted)">
        Уже зарегистрированы? <a href="<?= url('/login') ?>">Войдите</a>
      </p>
    </div>
  </div>
</section>
<?php
$content = ob_get_clean();
render_page('Регистрация', $content, ['active' => '/register', 'meta' => 'Регистрация участника КЦ «Музыкальный Мир».']);
