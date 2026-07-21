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
                mail_queue($email, $name, 'Восстановление пароля - КЦ «Музыкальный Мир»', reset_email_html($name, $link));
            }
        }
        // Нейтральный ответ вне зависимости от наличия адреса в базе.
        $sent = true;
    }
}

/** Брендированное HTML-письмо со ссылкой восстановления (self-contained). */
function reset_email_html(string $name, string $link): string {
    $logo  = h(logo_data_uri());
    $org   = h((string) cfgv('org_full', 'Культурный центр «Музыкальный Мир»'));
    $greet = $name !== '' ? ', ' . h($name) : '';
    $l     = h($link);
    return <<<HTML
<!DOCTYPE html><html lang="ru"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#f0e6d6;font-family:'Segoe UI',Arial,sans-serif;color:#3a2e22;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f0e6d6;padding:28px 12px;"><tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:100%;background:#fbf6ef;border-radius:18px;overflow:hidden;box-shadow:0 12px 40px rgba(90,50,20,.14);">
  <tr><td style="background:linear-gradient(135deg,#7a2e1e 0%,#a0522d 55%,#b8860b 100%);padding:34px 40px;text-align:center;">
    <img src="{$logo}" alt="{$org}" width="88" height="88" style="display:inline-block;width:88px;height:88px;border-radius:14px;background:#fff;padding:6px;">
    <div style="margin-top:12px;color:#fff;font-size:14px;letter-spacing:.14em;text-transform:uppercase;font-weight:600;">Культурный центр «Музыкальный Мир»</div>
  </td></tr>
  <tr><td style="padding:38px 44px 30px;font-size:16px;line-height:1.7;color:#3a2e22;">
    <h1 style="margin:0 0 18px;font-size:23px;color:#7a2e1e;font-weight:700;">Восстановление пароля</h1>
    <p style="margin:0 0 14px;">Здравствуйте{$greet}. Мы получили запрос на смену пароля для Вашего аккаунта.</p>
    <p style="margin:0 0 8px;">Нажмите на кнопку ниже, чтобы задать новый пароль. Ссылка действует один час.</p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:26px 0;"><tr>
      <td style="border-radius:10px;background:linear-gradient(135deg,#a0522d,#b8860b);">
        <a href="{$l}" style="display:inline-block;padding:14px 34px;color:#fff;text-decoration:none;font-weight:600;font-size:15px;border-radius:10px;">Задать новый пароль</a>
      </td></tr></table>
    <p style="margin:0 0 6px;font-size:13px;color:#8a7658;">Если Вы не запрашивали смену пароля, просто проигнорируйте это письмо - пароль останется прежним.</p>
    <p style="margin:14px 0 0;font-size:13px;color:#8a7658;">Если кнопка не открывается, скопируйте ссылку в браузер:<br><span style="color:#a0522d;word-break:break-all;">{$l}</span></p>
  </td></tr>
</table></td></tr></table></body></html>
HTML;
}

$done_icon = '<svg viewBox="0 0 24 24" width="46" height="46" fill="none" stroke="var(--gold-2)" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 4h16v16H4z" opacity="0"/><path d="M22 6l-10 7L2 6"/><rect x="2" y="4" width="20" height="16" rx="2"/></svg>';

ob_start(); ?>
<section class="section">
  <div class="container" style="max-width:460px">
    <div class="section-head reveal" style="margin-bottom:28px">
      <p class="eyebrow">Личный кабинет</p>
      <h2>Восстановление пароля</h2>
      <div class="gold-rule"></div>
      <?php if (!$sent): ?><p>Укажите почту, привязанную к аккаунту - мы вышлем ссылку для смены пароля.</p><?php endif; ?>
    </div>

    <div class="card reveal" style="padding:28px">
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
            <input type="email" id="email" name="email" value="<?= h($email) ?>" placeholder="you@example.ru" autocomplete="email" required>
          </div>
          <button class="btn btn--primary btn--block btn--lg" type="submit">Отправить ссылку</button>
        </form>
        <p style="text-align:center;margin:20px 0 0;color:var(--muted)">
          Вспомнили пароль? <a href="<?= url('/login') ?>">Войдите</a>
        </p>
      <?php endif; ?>
    </div>
  </div>
</section>
<?php
$content = ob_get_clean();
render_page('Восстановление пароля', $content, ['active' => '/login', 'meta' => 'Восстановление пароля от личного кабинета КЦ «Музыкальный Мир».']);
