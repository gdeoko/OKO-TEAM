# Rocket CDN · развёртывание на сервере

Что здесь лежит и как это поднять на боевом домене `rocketcdn.ru`.
Стек намеренно простой: статика плюс PHP, никакой базы данных.
Хватает любого хостинга с PHP 7.4 и выше.

---

## 1. Состав папки

| Файл | Что делает |
|---|---|
| `index.html` | Главная страница сайта |
| `app.html` | Мини-приложение для Телеграма |
| `admin.html` | Панель управления: аналитика, заявки, тексты |
| `privacy.html`, `offer.html` | Политика конфиденциальности и оферта |
| `api.php` | Приём заявок, сбор аналитики, выдача данных админке |
| `bot.php` | Телеграм-бот `@rocket_cdn_bot`, меню и уведомления |
| `cron.php` | Ежедневный отчёт в 9:00 и уборка старых данных |
| `lib_report.php` | Сборка текстов отчётов |
| `config.php` | Общий конфиг, читает секреты из `config.local.php` |
| `assets/` | Стили, скрипты, глобус, шрифт, логотипы, иконки |
| `data/` | Создаётся сама: заявки, статистика, состояние бота |

Шрифт Golos Text лежит локально в `assets/fonts`. Google Fonts из России
ходит нестабильно, поэтому внешних запросов у сайта нет вообще.

---

## 2. Заливка на сервер

```bash
# на сервере
mkdir -p /var/www/rocketcdn
# с локальной машины
rsync -av --delete ./rocketcdn/ root@СЕРВЕР:/var/www/rocketcdn/
```

Права: PHP должен уметь писать в `data`.

```bash
cd /var/www/rocketcdn
mkdir -p data/stats
chown -R www-data:www-data data
chmod -R 775 data
```

---

## 3. Секреты: файл `config.local.php`

В git его нет и быть не должно. Создайте руками рядом с `config.php`:

```php
<?php
return [
    'admin_key' => 'ПРИДУМАЙТЕ_ДЛИННЫЙ_ПАРОЛЬ',   // вход в admin.html
    'site_url'  => 'https://rocketcdn.ru',
    'lk_url'    => 'https://lk.rocketcdn.ru',

    // Почта: ящик Gmail и пароль приложения на 16 знаков
    'mail_user' => 'ваш-ящик@gmail.com',
    'mail_pass' => 'xxxx xxxx xxxx xxxx',
    'mail_name' => 'Rocket CDN',
    'mail_to'   => 'куда-присылать-заявки@gmail.com',

    // Токен бота @rocket_cdn_bot от @BotFather
    'tg_token'  => 'ТОКЕН_БОТА',

    // Кому доступна админская часть бота
    'tg_admins' => [1966985736, 6547482131, 581327337],
];
```

```bash
chmod 640 config.local.php
chown root:www-data config.local.php
```

Пароль приложения Google берётся так: аккаунт Google → включить двухэтапную
аутентификацию → «Пароли приложений» → создать → скопировать 16 знаков.
Обычный пароль от почты не подойдёт.

---

## 4. Веб-сервер

### Apache
`.htaccess` уже лежит в папке, нужен включённый `AllowOverride All`.

### Nginx + PHP-FPM

```nginx
server {
    listen 443 ssl http2;
    server_name rocketcdn.ru www.rocketcdn.ru;
    root /var/www/rocketcdn;
    index index.html;

    ssl_certificate     /etc/letsencrypt/live/rocketcdn.ru/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/rocketcdn.ru/privkey.pem;

    add_header X-Content-Type-Options nosniff;
    add_header X-Frame-Options SAMEORIGIN;
    add_header Referrer-Policy strict-origin-when-cross-origin;

    # служебное наружу не отдаём
    location ^~ /data/                       { deny all; }
    location ~ ^/(config|config\.local|lib_report|cron|bot)\.php$ { deny all; }

    location ~ \.php$ {
        include fastcgi_params;
        fastcgi_pass unix:/run/php/php8.2-fpm.sock;
        fastcgi_param SCRIPT_FILENAME $document_root$fastcgi_script_name;
    }

    location ~* \.(woff2|png|jpg|svg|webp)$ { expires 30d; access_log off; }
    location ~* \.(css|js)$                 { expires 7d; }

    gzip on;
    gzip_types text/css application/javascript application/json image/svg+xml;
}

server {
    listen 80;
    server_name rocketcdn.ru www.rocketcdn.ru;
    return 301 https://$host$request_uri;
}
```

Сертификат: `certbot --nginx -d rocketcdn.ru -d www.rocketcdn.ru`.

---

## 5. Расписание

```bash
crontab -e
```

```cron
# бот: проверяет сообщения раз в минуту, внутри крутится шесть циклов по 9 секунд
* * * * * /usr/bin/php /var/www/rocketcdn/bot.php >/dev/null 2>&1

# отчёты и уборка: сам решает, когда пора
0 * * * * /usr/bin/php /var/www/rocketcdn/cron.php >/dev/null 2>&1
```

Проверить отчёт вручную, не дожидаясь утра:

```bash
php /var/www/rocketcdn/cron.php --now
```

---

## 6. Бот и общий чат

1. Токен `@rocket_cdn_bot` положить в `config.local.php`.
2. Написать боту `/start` в личку - появится нижнее меню.
3. Добавить бота в общий чат и дать ему право писать.
4. В нужной теме чата написать `/bindchat` - туда пойдут заявки.
5. Разложить остальное по темам:
   - в теме ошибок: `/bindtopic errors`
   - в теме аналитики: `/bindtopic stats`
   - в теме форм: `/bindtopic forms`

Привязка пишется в `data/bindings.json`, конфиг руками править не нужно.
Пока чат не привязан, все уведомления идут администраторам в личку.

Мини-приложение: в `@BotFather` → бот → *Bot Settings* → *Menu Button* →
*Configure menu button* → ссылка `https://rocketcdn.ru/app.html`, название
«Rocket CDN». Кнопка в нижнем меню бота работает и без этой настройки.

---

## 7. Проверка после запуска

Откройте `https://rocketcdn.ru/admin.html`, войдите паролем, вкладка
«Состояние» → кнопка «Отправить тестовое письмо и сообщение».
Должны загореться четыре зелёные точки и прийти письмо с сообщением в Телеграм.

Дальше:

- отправьте заявку с сайта, проверьте, что она видна во вкладке «Заявки»;
- нажмите «Регистрация» и убедитесь, что счётчик кликов вырос;
- в боте наберите `/stats`.

---

## 8. Как менять содержимое

- **Тексты заголовков и показателей** - админка, вкладка «Тексты сайта».
  Сохраняется в `data/content.json`, сайт подхватывает сразу.
- **Продукты, преимущества, сценарии, вопросы** - там же, блоком JSON.
- **Точки присутствия** - файл `assets/rc-geo.js`, строка вида
  `["Город", широта, долгота, регион, флаги]`.
  Регион: `0` Россия и СНГ, `1` Азия и Восток, `2` Европа,
  `3` Северная Америка, `4` Южная Америка.
  Флаги складываются: `1` облако, `2` защита, `4` скоро. Ноль означает обычный узел.
- **Ссылка кнопки регистрации** - `lk_url` в `config.local.php` и адрес
  `https://lk.rocketcdn.ru` в `index.html`.

---

## 9. Резервная копия

Всё живое лежит в одной папке:

```bash
tar czf rocketcdn-data-$(date +%F).tar.gz -C /var/www/rocketcdn data config.local.php
```

Статистика старше 180 дней удаляется сама, заявки хранятся до ручного удаления.
