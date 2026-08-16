# Каталог эталонов — где что лежит

Опровержение фразы «эталонов нет в репозитории». Всё есть — но не всегда как `docx` в `docs/`. Ниже точные ссылки.

---

## ЭТАЛОНЫ HTML (шаблоны PDF-документов)

Рендерятся через bastion Playwright в PDF.

### Сертификат партнёра «Информационный партнёр»

**Файл на проде**: `/var/www/muzmir/public/tests/partner-cert.php`
**Копия в архиве**: `03_prod_files/templates/partner-cert.php` (12.3 КБ)

**URL рендера**: `https://муз-мир.рф/tests/partner-cert.php?key=<render_key>&org=<name>&reg=<region>&no=<ИП-2026-XXXXX>&since=<дата>&till=<дата>`

**Формат PDF**: A4 landscape (297×210 мм)

**Что содержит визуально**:
- Бренд-плашка Музмира (бежевая, с рамкой)
- Логотип + «Культурный центр «Музыкальный Мир»»
- **Заголовок**: «Сертификат информационного партнёра»
- Название учреждения (крупно, из БД, `$_GET['org']`)
- Регион (`$_GET['reg']`)
- Номер `ИП-2026-XXXXX` (`$_GET['no']`)
- Даты «Действителен с — по»
- Блок подписи-печати:
  - Синяя SVG-подпись директора
  - Синяя PNG-печать
- QR-код (справа внизу) — ведёт на `/verify-doc.php?n=<no>&s=<hmac>`

**Функция для генерации**: `partner_cert_pdf($instId, bool $regen = false)` в `03_prod_files/core/partner_docs.php`.

**Хранится**: `/var/www/muzmir/public/diplomas/partner_cert_ИП-2026-XXXXX.pdf` (кэш 30 дней).

---

### Благодарственное письмо партнёру (партнёрская программа)

**Файл на проде**: `/var/www/muzmir/public/tests/partner-thanks.php`
**Копия в архиве**: `03_prod_files/templates/partner-thanks.php` (12.5 КБ)

**URL рендера**: `/tests/partner-thanks.php?key=<render_key>&role=manager|teacher&fio=<ФИО>&org=<name>&no=<БЛГ-ИП-2026-XXXXX-РX>`

**Два варианта** (различаются текстом благодарности):

1. **Директору (`role=manager`)**:
   > «Директору [название учреждения], [ФИО]. Оргкомитет благодарит за развитие партнёрских отношений и активное содействие в проведении конкурсов...»
   Номер: `БЛГ-ИП-2026-XXXXX-Р1`.

2. **Педагогу (`role=teacher`)**:
   > «Педагогу [название учреждения], [ФИО]. Оргкомитет благодарит за подготовку [N] обучающихся к участию в конкурсах...»
   Номер: `БЛГ-ИП-2026-XXXXX-П1`, `-П2`, `-П3`.

**Особенности**:
- Шрифт для ФИО — **Marck Script** (курсив, чтобы визуально отличалось от печатного текста, как рукописная подпись)
- Золотая рамка вокруг листа
- Подпись + печать директора Музмира (те же файлы что на сертификате)
- QR-код проверки в правом нижнем углу

**Функция**: `partner_thanks_pdf($thanksId)` в `partner_docs.php`.

**Хранится**: `/var/www/muzmir/public/diplomas/partner_thanks_БЛГ-ИП-2026-XXXXX-РX.pdf`.

---

### Обращение к учреждению (PDF)

**Программная генерация** (без HTML-шаблона, полностью в PHP):
- Файл: `03_prod_files/core/pdf_letter.php`
- Функция: `pdf_letter_generate($number, $addresseeName, $body, $signBlock)` использует TCPDF или похожую библиотеку

**Что содержит**:
- Бланк с логотипом Музмира (шапка)
- Реквизиты центра (адрес, ОГРН, ИНН)
- Номер `DDMMYYYY/NNN` (например `15082026/1000`)
- Дата
- Адресат: «Руководителю [название учреждения]» (без ФИО после нашего фикса)
- Основной текст обращения (см. `08_walkthrough/ALL_EMAIL_TEMPLATES.md` раздел 2.1)
- Подпись + печать (SVG/PNG)
- QR-код проверки → `/letter/DDMMYYYY/NNN`

**Хранится**: `/var/www/muzmir/data/letters/obrashchenie-DDMMYYYY-NNN.pdf`.

**Живой пример реального PDF** есть на проде: `data/letters/obrashchenie-15082026-1000.pdf` (377 КБ). Не влезает в архив, но можно скачать с прода — тут работает готовый механизм.

---

### Обращение к министерству культуры (PDF)

Тот же генератор `pdf_letter.php`, другой `kind='ministry'`:
- Более формальный текст (см. `ALL_EMAIL_TEMPLATES.md` раздел 5.1)
- Адресат: «Министру культуры [регион], [ФИО]» (тут ФИО из реестра Минкультуры, не устарел)
- Приложения указаны в теле (без физического приклеивания)

**Хранится**: тот же `/var/www/muzmir/data/letters/obrashchenie-DDMMYYYY-NNN.pdf` (различаются по `official_letters.kind`).

---

### Диплом участника

**Файлы шаблона** (программная сборка, HTML→PDF):
- `03_prod_files/core/diploma_html.php` (48 КБ) — HTML-сборка
- `03_prod_files/core/diploma_render.php` (7.7 КБ) — вызов bastion

**Формат**: A4 landscape, дизайн зависит от `competitions.diploma_bg` (фон загружается в админке).

**Что содержит**:
- Фон конкурса (`public/uploads/comp/<id>/diploma_bg.jpg`)
- Название конкурса
- ФИО участника (крупно)
- Педагог, учреждение, город
- Номинация, работа
- Звание («Гран-при», «Лауреат 1 степени» и т.д.)
- Дата
- Номер `MM-2026-XXXXX` (или другой формат по конкурсу)
- Подпись + печать
- QR → `/verify/<номер>`

**Хранится**: `/var/www/muzmir/public/uploads/diplomas/<comp_slug>/<number>.pdf`.

---

### VIP-сертификат клуба (образец для партнёрского)

**Файл**: `03_prod_files/core/club_cert.php` (13.5 КБ) — программная сборка.

Партнёрский сертификат делался по образцу VIP-сертификата (та же геометрия, тот же bastion, похожая структура). Читать при разборе кода партнёрского.

---

## ЭТАЛОНЫ ВЛОЖЕНИЙ (афиши и положения)

Прикладываются к каждому письму учреждению. Общий сезонный кэш.

### Афиши конкурсов

**Оригиналы**: `/var/www/muzmir/public/uploads/comp/<id>/afisha.jpg`

Для 4 текущих открытых конкурсов:
- id=18: `public/uploads/comp/18/afisha.jpg` — Мировые Таланты (303 KB)
- id=19: `public/uploads/comp/19/afisha.jpg` — В зените славы (217 KB)
- id=20: `public/uploads/comp/20/afisha.jpg` — Искусство во благо (296 KB)
- id=21: `public/uploads/comp/21/afisha.jpg` — Величие России (340 KB)

**Кэш для рассылки** (переименованные для человеческого вида): `/var/www/muzmir/data/attach_cache/season-YYYY-MM/`:
- `Афиша_Мировые_Таланты.jpg`
- `Афиша_В_зените_славы.jpg`
- `Афиша_Искусство_во_благо.jpg`
- `Афиша_Величие_России.jpg`

---

### Положения конкурсов

**Оригиналы**: `/var/www/muzmir/public/uploads/regulations/<slug>.pdf`

Для 4 текущих:
- `mirovye-talanty.pdf` (449 KB)
- `v-zenite-slavy.pdf` (449 KB)
- `iskusstvo-vo-blago.pdf` (449 KB)
- `velichie-rossii.pdf` (438 KB)

Плюс DOCX-исходники (для правок): `<slug>.docx` (621 KB).

**Кэш для рассылки**: `/var/www/muzmir/data/attach_cache/season-YYYY-MM/`:
- `Положение_Мировые_Таланты.pdf`
- `Положение_В_зените_славы.pdf`
- `Положение_Искусство_во_благо.pdf`
- `Положение_Величие_России.pdf`

---

## ЭТАЛОНЫ БРЕНДА

### Логотип

`/var/www/muzmir/public/assets/img/logo_muzmir_256.png` (для писем)
`/var/www/muzmir/public/assets/img/logo_muzmir.png` (полный)

Используется:
- Хедер каждого письма (`mm_email_layout`)
- Хедер PDF-шаблонов (partner-cert, partner-thanks, diploma)

### Подпись директора

Синяя SVG (для PDF): `/var/www/muzmir/etalons/brand/signature.svg` (или похожий путь)
Используется в partner-cert.php, partner-thanks.php, pdf_letter.php.

### Печать

Синяя PNG: `/var/www/muzmir/etalons/brand/stamp.png`
Используется там же.

---

## HTML-ЭТАЛОНЫ ВЁРСТКИ ПИСЕМ

### `mm_email_layout()` в `core/mailer.php`
Общая обёртка каждого письма:
- Хедер: лого + название центра
- Основной контент (что передали)
- Футер: контакты + отписка

CSS полностью инлайновый (для совместимости с почтовыми клиентами).

### `mmc_competition_card($comp)` в `core/mail_campaigns.php`
Карточка одного конкурса (используется в волнах запуска):
```
[Логотип конкурса]
Всероссийский | Международный
Название конкурса
Приём заявок до 25.08.2026
[Подать заявку]  [Положение]
```

### `mmc_vip_perks_grid()` в `core/mail_campaigns.php`
Таблица привилегий VIP-клуба (используется если юзер не член клуба).

### `mmc_kabinet_block()` в `core/mail_campaigns.php`
Блок «Ваш личный кабинет» с логином+паролем (для новых юзеров).

---

## ЖИВЫЕ ПРИМЕРЫ (в архиве)

- **HTML тело письма учреждению**: `07_live_etalons/letter_bodies/live_institution_body.html` (11.8 КБ) — реальный HTML который сейчас улетает с novosti@ в 40к учреждений
- **HTML тело письма konkurs**: `07_live_etalons/letter_bodies/live_konkurs_body.html` (30.6 КБ) — реальный HTML одной волны запуска

Их можно открыть в браузере чтобы увидеть точно как выглядит письмо в почтовом клиенте.

---

## ИТОГО: где искать что

| Что нужно | Файл в архиве |
|---|---|
| HTML сертификата партнёра | `03_prod_files/templates/partner-cert.php` |
| HTML благодарности партнёра | `03_prod_files/templates/partner-thanks.php` |
| Сборка PDF обращения | `03_prod_files/core/pdf_letter.php` |
| Сборка HTML диплома | `03_prod_files/core/diploma_html.php` |
| Функция рендера через bastion | `03_prod_files/core/partner_docs.php::partner_render_pdf()` + `core/diploma_render.php` |
| Тексты писем (все) | `08_walkthrough/ALL_EMAIL_TEMPLATES.md` |
| Живой HTML письма | `07_live_etalons/letter_bodies/` |
| Партнёрка построчно | `08_walkthrough/PARTNER_CODE_WALKTHROUGH.md` |
| Схема БД партнёров | `04_schema/tables.sql` (таблицы `partner_docs`, `partner_events`, `partner_thanks`) |
| Автотесты 72 шт | `03_prod_files/scripts/audit_partner*.php` |
| Все цепочки автоматизации | `08_walkthrough/AUTOMATION_CHAINS.md` |

**Ничего не пропало.** Всё есть или в архиве или на проде по указанным путям.
