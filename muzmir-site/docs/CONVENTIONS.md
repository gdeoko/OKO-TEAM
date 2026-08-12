# Конвенции сборки — сайт КЦ «Музыкальный Мир»

Архитектура: PHP 8.2+, SQLite (PDO), ванильный фронт. Точка входа — `public/index.php`.
Страницы публичного сайта лежат в `templates/site/pages/<name>.php` и вызывают `render_page()`.

## Как устроена страница
Каждый файл страницы:
1. Готовит данные (через хелперы БД).
2. Собирает HTML в буфер `ob_start(); ... $content = ob_get_clean();`.
3. Вызывает `render_page($title, $content, $opts)`.

Шаблон:
```php
<?php
$items = all("SELECT * FROM competitions WHERE status='open' ORDER BY sort");
ob_start(); ?>
<section class="section"><div class="container">
  <div class="section-head reveal"><p class="eyebrow">Надзаголовок</p><h2>Заголовок</h2></div>
  ...
</div></section>
<?php
$content = ob_get_clean();
render_page('Заголовок вкладки', $content, ['active' => '/route', 'meta' => 'SEO-описание']);
```

## Доступные хелперы (уже подключены в index.php)
- Экранирование: `h($s)`
- БД: `db()`, `q($sql,$args)`, `one($sql,$args)`, `all($sql,$args)`, `scalar(...)`, `insert($table,$data)`, `update($table,$data,$where,$wargs)`
- Настройки: `setting($key,$default)`, `set_setting($key,$val)`
- URL/ассеты: `url('/path')`, `asset('css/..')`
- Конфиг: `cfgv('org_name')` и т.д. (см. config.php)
- Тексты: `normalize_text($t)` (короткие тире, «ёлочки»), `money($rub)`, `ru_date($d)`
- CSRF: `csrf_field()`, `csrf_check()`
- Flash: `flash($msg,$type)`; redirect: `redirect('/path')`; JSON: `json_out($data,$code)`
- Ввод: `input('field','default')`
- Rate-limit: `rate_ok($key,$limit,$window)`; аудит: `audit($action,$entity,$id,$meta)`
- Юзер: `current_user()`, `user_can('admin')`, `require_login()`, `require_role('moderator')`
- Справочники (core/data.php): `NOMINATIONS()`, `FORMATIONS()`, `AGE_CATEGORIES()`, `GRADE_SCALE()`, `score_to_result($s)`, `ALLOWED_PLATFORMS()`, `BLOCKED_PLATFORMS()`
- Лого base64: `logo_data_uri()`

## Дизайн (классы из assets/css/style.css)
- Секции: `.section`, `.section--tint`, `.section--parchment`; контейнер `.container`
- Заголовок секции: `.section-head` + `.eyebrow` + `<h2>` (+ `.gold-rule`)
- Кнопки: `.btn .btn--primary` / `.btn--ghost` / `.btn--lg` / `.btn--block`
- Карточки: `.card`; сетки `.grid .grid-2/.grid-3/.grid-4`
- Формы: `.field`>`label`+`input`+`.hint`+`.err-msg`; ошибка — класс `.error` на `.field`
- Бейджи: `.badge .badge--open/.badge--closed/.badge--intl`
- Анимация появления: класс `reveal` на блоке (JS сам добавит `.in`)
- Иконки — только inline SVG (stroke, feather-стиль). Эмодзи запрещены.

## Абсолютные правила текстов (НЕ нарушать)
1. Не упоминать ФИО гендиректора и «Генеральный директор» — только «Оргкомитет».
2. Без эмодзи в текстах. Только SVG-иконки.
3. Без Telegram-ссылок в текстах, кроме раздела «Контакты».
4. Короткие тире «-», никаких «—».
5. Без AI-лексики: «уникальный», «реализовать», «ключевой», «контекст», «синергия».
6. Без оппозиций «не только», «не просто», «это не».
7. Обращение — «Вы» с заглавной.
8. Без цен в промо-текстах (цены — только на страницах конкурсов/наград/положениях).
9. Кавычки — «ёлочки», вложенные „лапки".

## Проверка
После каждого файла: `php -l <file>`. Локальный сервер:
`MUZMIR_BASE_URL=http://127.0.0.1:8080 php -S 127.0.0.1:8080 -t public scripts/dev_router.php`
