# Контракты общих функций (чтобы агенты собирали согласованно)

## core/mailer.php
- mail_send(string $to, string $subject, string $html, array $opt=[]): bool  — cURL SMTP на Gmail (cfgv smtp_host/port/user/pass), from=cfgv('mail_from_name'), reply-to=cfgv('mail_reply_to'), опц. $opt['attach']=путь.
- mail_queue(string $to, string $name, string $subject, string $html, string $attach=''): int — кладёт в таблицу mail_queue.
- mail_template(string $name, array $vars): string — рендер templates/emails/$name.php (в скоупе $vars), оборачивает в базовый премиум HTML-лейаут письма с логотипом logo_data_uri().

## core/validator.php
- v_email(string $e): array — ['ok'=>bool,'reason'=>string]; regex + проверка MX (checkdnsrr) + отсев одноразовых (mailinator и т.п.).
- v_phone(string $p): array — ['ok'=>bool,'formatted'=>'+7 (___) ___-__-__'].
- v_video(string $url): array — ['ok'=>bool,'platform'=>string,'reason'=>string]; разрешены ALLOWED_PLATFORMS(), запрещены BLOCKED_PLATFORMS().
- v_fio(string $s): string — автокоррекция регистра, кириллица+дефис, «Первая Заглавная».
- v_spell(string $t): string — Яндекс.Спеллер (https://speller.yandex.net) через cURL, тихий фолбэк на исходный текст.

## core/qr.php
- qr_svg(string $data): string — SVG QR-кода (чистый PHP, без внешних сервисов).

## core/telegram.php
- tg_send(string $chatId, string $text, array $opt=[]): array — sendMessage через cfgv('tg_bot_token').
- tg_notify_admin(string $text): void — шлёт в cfgv('tg_admin_chat').

## core/pdf_*.php
- pdf_regulation(array $competition): string — путь к PDF положения (7 полей → 13 разделов, лого+печать+подписи).
- pdf_diploma(array $application, string $type='main'): string — путь к PDF диплома (ФИО, результат, номинация, дата, номер, QR→/verify, печать, подпись).

Все внешние вызовы — через cURL с CURLOPT_TIMEOUT и тихими фолбэками (сайт не должен падать, если сервис недоступен).
