<?php
/** Смена пароля по ссылке: GET token → форма; POST → проверка токена/срока, обновление пароля, вход. */

if (current_user()) redirect('/cabinet');

/** Находит пользователя по действующему (не просроченному) токену. */
function reset_lookup(string $token): ?array {
    if ($token === '') return null;
    return one("SELECT * FROM users
                WHERE reset_token=? AND reset_token<>''
                  AND reset_expires IS NOT NULL AND reset_expires<>''
                  AND reset_expires > datetime('now')", [$token]);
}

$token = input('token');

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $token    = (string)($_POST['token'] ?? '');
    $password = (string)($_POST['password'] ?? '');
    $confirm  = (string)($_POST['password2'] ?? '');
    $u = reset_lookup($token);

    if (!csrf_check()) {
        flash('Сессия устарела. Обновите страницу и попробуйте снова.', 'error');
    } elseif (!$u) {
        flash('Ссылка устарела или недействительна. Запросите новую.', 'error');
        redirect('/forgot');
    } elseif (mb_strlen($password) < 6) {
        flash('Пароль должен быть не короче 6 символов.', 'error');
    } elseif ($password !== $confirm) {
        flash('Пароли не совпадают. Повторите ввод.', 'error');
    } else {
        update('users', [
            'password_hash' => password_hash($password, PASSWORD_DEFAULT),
            'reset_token'   => '',
            'reset_expires' => '',
            'email_verified'=> 1,
        ], 'id=:id', ['id' => (int)$u['id']]);
        audit('password_reset', 'user', (int)$u['id']);
        login_user((int)$u['id']);
        flash('Пароль обновлён. Вы вошли в личный кабинет.', 'success');
        redirect('/cabinet');
    }
}

$valid = reset_lookup($token) !== null;

ob_start(); ?>
<section class="section auth-page">
  <div class="container" style="max-width:440px">
    <div class="card reveal auth-shell" style="padding:34px 26px 30px">
      <div class="auth-head" style="text-align:center;margin-bottom:22px">
        <img src="<?= asset('img/logo_muzmir_256.png') ?>" alt="КЦ «Музыкальный Мир»" width="64" height="64"
             style="width:64px;height:64px;border-radius:50%;border:1px solid var(--glass-brd);margin:0 auto 12px;display:block">
        <p class="eyebrow" style="margin-bottom:2px">Личный кабинет</p>
        <h1 style="font-size:1.7rem;margin:0 0 6px">Новый пароль</h1>
        <?php if ($valid): ?><p style="color:var(--muted);font-size:.9rem;margin:0">Придумайте новый пароль для входа в кабинет.</p><?php endif; ?>
      </div>

      <?php if (!$valid): ?>
        <p style="margin:0 0 8px;text-align:center">Ссылка для смены пароля устарела или недействительна.</p>
        <p style="margin:0 0 22px;color:var(--muted);text-align:center">Запросите новую - она придёт на Вашу почту.</p>
        <a class="btn btn--primary btn--block" href="<?= url('/forgot') ?>">Запросить ссылку</a>
      <?php else: ?>
        <form method="post" action="<?= url('/reset-password') ?>" novalidate>
          <?= csrf_field() ?>
          <input type="hidden" name="token" value="<?= h($token) ?>">
          <div class="field">
            <label for="password">Новый пароль</label>
            <input type="password" id="password" name="password" placeholder="Не короче 6 символов" autocomplete="new-password" minlength="6" required>
          </div>
          <div class="field">
            <label for="password2">Повторите пароль</label>
            <input type="password" id="password2" name="password2" placeholder="Ещё раз" autocomplete="new-password" minlength="6" required>
          </div>
          <button class="btn btn--primary btn--block btn--lg" type="submit">Сохранить пароль</button>
        </form>
      <?php endif; ?>
    </div>
  </div>
</section>
<?php
$content = ob_get_clean();
render_page('Новый пароль', $content, ['active' => '/login', 'meta' => 'Смена пароля от личного кабинета КЦ «Музыкальный Мир».']);
