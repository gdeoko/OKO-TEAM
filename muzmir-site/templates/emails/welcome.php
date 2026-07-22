<?php
/**
 * Письмо: приветствие после регистрации.
 * Отправляется всем новым пользователям (соц-вход / почта / телефон) — каждый
 * попадает в базу рассылок и получает это письмо.
 * Обёртку (логотип, шапку, подвал, отписку) добавит mail_template().
 *
 * $vars: name (имя пользователя), cta_url (ссылка на конкурсы/кабинет).
 */
$name  = trim((string) ($vars['name'] ?? ($vars['full_name'] ?? '')));
$cta   = (string) ($vars['cta_url'] ?? (function_exists('url') ? url('/#competitions') : '#'));
$hello = $name !== '' ? 'Здравствуйте, ' . h($name) . '!' : 'Здравствуйте!';
?>
<h1 style="margin:0 0 18px;font-size:24px;color:#7a2e1e;font-weight:700;line-height:1.25;">Спасибо за регистрацию!</h1>
<p style="margin:0 0 14px;"><?= $hello ?></p>
<p style="margin:0 0 16px;">Мы рады, что Вы присоединились к культурному центру «Музыкальный Мир». Ваш аккаунт создан, и теперь Вы в кругу наших участников.</p>
<p style="margin:0 0 20px;">Следите за конкурсами - мы будем сообщать Вам об открытии приёма заявок, новых номинациях и результатах. Впереди много музыки и ярких творческих событий.</p>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 22px;background:#f6ecdb;border-radius:14px;">
  <tr><td style="padding:20px 24px;font-size:14px;line-height:1.9;color:#5a4632;">
    <div style="font-weight:600;color:#7a2e1e;margin-bottom:8px;">Что Вас ждёт</div>
    <div><span style="color:#a0522d;">•</span> Участие в вокальных, инструментальных и творческих конкурсах</div>
    <div><span style="color:#a0522d;">•</span> Дипломы и благодарности за Ваши выступления</div>
    <div><span style="color:#a0522d;">•</span> Новости и анонсы прямо на Вашу почту</div>
  </td></tr>
</table>

<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 8px;">
  <tr><td style="border-radius:10px;background:linear-gradient(135deg,#a0522d,#b8860b);">
    <a href="<?= h($cta) ?>" style="display:inline-block;padding:14px 34px;color:#ffffff;text-decoration:none;font-weight:600;font-size:15px;border-radius:10px;">Смотреть конкурсы</a>
  </td></tr>
</table>

<p style="margin:18px 0 0;font-size:13px;color:#8a7658;">Если Вы не регистрировались на нашем сайте, просто оставьте это письмо без внимания.</p>
