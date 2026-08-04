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
<h1 style="margin:0 0 18px;font-family:Georgia,'Times New Roman',serif;font-size:25px;color:#17307A;font-weight:700;line-height:1.25;">Спасибо за регистрацию!</h1>
<p style="margin:0 0 14px;"><?= $hello ?></p>
<p style="margin:0 0 16px;">Мы рады, что Вы присоединились к культурному центру «Музыкальный Мир». Ваш аккаунт создан, и теперь Вы в кругу наших участников.</p>
<p style="margin:0 0 20px;">Следите за конкурсами - мы будем сообщать Вам об открытии приёма заявок, новых номинациях и результатах. Впереди много музыки и ярких творческих событий.</p>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 22px;background:#F4F6FC;border:1px solid #DCE3F3;border-radius:14px;">
  <tr><td style="padding:20px 24px;font-size:14px;line-height:1.9;color:#33406B;">
    <div style="font-weight:600;color:#17307A;margin-bottom:8px;">Что Вас ждёт</div>
    <div><span style="color:#C79322;">•</span> Участие в вокальных, инструментальных и творческих конкурсах</div>
    <div><span style="color:#C79322;">•</span> Дипломы и благодарности за Ваши выступления</div>
    <div><span style="color:#C79322;">•</span> Новости и анонсы прямо на Вашу почту</div>
  </td></tr>
</table>

<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 8px;">
  <tr><td style="border-radius:12px;background:#C79322;background:linear-gradient(135deg,#C79322,#E3B94F);">
    <a href="<?= h($cta) ?>" style="display:inline-block;padding:14px 34px;color:#17307A;text-decoration:none;font-weight:700;font-size:15px;border-radius:12px;">Смотреть конкурсы</a>
  </td></tr>
</table>

<p style="margin:18px 0 0;font-size:13px;color:#6B7699;">Если Вы не регистрировались на нашем сайте, просто оставьте это письмо без внимания.</p>
