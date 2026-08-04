<?php
/** Восстановление пароля: форма email → reset_token + reset_expires(1ч) → письмо со ссылкой. */

if (current_user()) redirect('/cabinet');

$email = '';
$sent = false;
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $email = mb_strtolower(input('email'));
    if (!csrf_check()) {
        flash('Сессия устарела. Обновите страницу и попробуйте снова.', 'error');
    } elseif (!rate_ok('forgot:' . client_ip(), 10, 3600)) {
        flash('Слишком много запросов. Попробуйте позже.', 'error');
    } elseif (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        flash('Проверьте адрес электронной почты.', 'error');
    } else {
        // Только пользователи с паролем (у входа через соцсети пароля нет).
        $u = one("SELECT * FROM users WHERE email=? AND password_hash IS NOT NULL AND password_hash<>''", [$email]);
        if ($u) {
            $token = bin2hex(random_bytes(24));
            update('users', [
                'reset_token'   => $token,
                'reset_expires' => date('Y-m-d H:i:s', time() + 3600),
            ], 'id=:id', ['id' => (int)$u['id']]);
            audit('password_reset_request', 'user', (int)$u['id']);

            $link = url('/reset-password?token=' . urlencode($token));
            $name = trim((string)($u['full_name'] ?? ''));
            if (function_exists('mail_queue')) {
                mail_queue($email, $name, 'Восстановление пароля - Культурного центра «Музыкальный Мир»', reset_email_html($name, $link));
            }
        }
        // Нейтральный ответ вне зависимости от наличия адреса в базе.
        $sent = true;
    }
}

/** Брендированное HTML-письмо со ссылкой восстановления (единый лейаут mm_email_layout). */
function reset_email_html(string $name, string $link): string {
    $greet = $name !== '' ? ', ' . h($name) : '';
    $inner = '<h1 style="margin:0 0 18px;font-family:Georgia,\'Times New Roman\',serif;font-size:25px;color:#17307A;font-weight:700;line-height:1.25;">Восстановление пароля</h1>'
        . '<p style="margin:0 0 14px;">Здравствуйте' . $greet . '! Мы получили запрос на смену пароля для Вашего аккаунта.</p>'
        . '<p style="margin:0 0 8px;">Нажмите на кнопку ниже, чтобы задать новый пароль. Ссылка действует один час.</p>'
        . mm_email_btn($link, 'Задать новый пароль')
        . '<p style="margin:14px 0 0;font-size:13px;color:#6B7699;">Если Вы не запрашивали смену пароля, просто оставьте это письмо без внимания — пароль останется прежним.</p>';
    return mm_email_layout($inner, [
        'preheader'     => 'Ссылка для смены пароля. Действует один час.',
        'audience_note' => 'Служебное письмо для восстановления доступа к личному кабинету.',
    ]);
}

$done_icon = '<svg viewBox="0 0 24 24" width="46" height="46" fill="none" stroke="var(--gold-2)" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 4h16v16H4z" opacity="0"/><path d="M22 6l-10 7L2 6"/><rect x="2" y="4" width="20" height="16" rx="2"/></svg>';

ob_start(); ?>
<section class="section auth-page">
  <div class="container" style="max-width:440px">
    <div class="card reveal auth-shell" style="padding:34px 26px 30px">
      <div class="auth-head" style="text-align:center;margin-bottom:22px">
        <img src="<?= asset('img/logo_muzmir_256.png') ?>" alt="Культурного центра «Музыкальный Мир»" width="64" height="64"
             style="width:64px;height:64px;border-radius:50%;border:1px solid var(--glass-brd);margin:0 auto 12px;display:block">
        <p class="eyebrow" style="margin-bottom:2px">Личный кабинет</p>
        <h1 style="font-size:1.7rem;margin:0 0 6px">Восстановление пароля</h1>
        <?php if (!$sent): ?><p style="color:var(--muted);font-size:.9rem;margin:0">Укажите почту, привязанную к аккаунту - мы вышлем ссылку для смены пароля.</p><?php endif; ?>
      </div>

      <?php if ($sent): ?>
        <div style="text-align:center">
          <div style="margin-bottom:14px"><?= $done_icon ?></div>
          <p style="margin:0 0 8px">Если этот адрес есть в базе, письмо со ссылкой уже отправлено.</p>
          <p style="margin:0 0 22px;color:var(--muted)">Проверьте входящие и папку «Спам». Ссылка действует один час.</p>
          <a class="btn btn--ghost btn--block" href="<?= url('/login') ?>">Вернуться ко входу</a>
        </div>
      <?php else: ?>
        <form method="post" action="<?= url('/forgot') ?>" novalidate>
          <?= csrf_field() ?>
          <div class="field">
            <label for="email">Электронная почта</label>
            <input type="email" id="email" name="email" value="<?= h($email) ?>" placeholder="ваша@почта.рф" autocomplete="email" inputmode="email" required>
          </div>
          <button class="btn btn--primary btn--block btn--lg" type="submit">Отправить ссылку</button>
        </form>
        <p style="text-align:center;margin:20px 0 0;color:var(--muted);font-size:.9rem">
          Вспомнили пароль? <a href="<?= url('/login') ?>">Войдите</a>
        </p>
      <?php endif; ?>
    </div>
  </div>
</section>
<?php
$content = ob_get_clean();
render_page('Восстановление пароля', $content, ['active' => '/login', 'meta' => 'Восстановление пароля от личного кабинета Культурного центра «Музыкальный Мир».']);
