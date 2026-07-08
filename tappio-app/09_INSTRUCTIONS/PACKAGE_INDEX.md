# PACKAGE INDEX — Содержимое всех архивов

## Как использовать

1. Скачай все ZIP-архивы (`tappio_package_part_01.zip`, `tappio_package_part_02.zip`, и т. д.)
2. Распакуй все в **одну общую папку** — они дополняют друг друга
3. Начни с `09_INSTRUCTIONS/README_START_HERE.md`

## Содержимое папок

### 01_SITE/ — Готовый сайт tappio.pro
- `index.html` — главная страница (neural bg, Three.js hero, App tiles)
- `sistema.html` — раздел «Система Роста» (превью на сайте)
- `sistema-anketa.html` — форма анкеты клиента
- `web.html` — B2B страница «для агентств»
- `zavod.html` — B2B страница «для приложений»
- `thanks.html` — страница благодарности после лида
- `.htaccess` — конфигурация Apache
- `index-light.html` — упрощённая версия сайта

### 02_LOGO_ICONS/ — Все логотипы
- `icon_spy_camera_finder_1024.png` — иконка Spy (cyan)
- `icon_brainova_1024.png` — иконка Brainova (purple)
- `icon_3d_tape_measure_1024.png` — иконка Tape (gold)
- `tappio_logo_avatar.png` — Tappio umbrella avatar (Instagram)
- `tappio_logo_avatar_512.png` — 512×512
- `tappio_logo_avatar_256.png` — 256×256
- `app_icon_original_1/2/3.png` — оригинальные иконки от клиента

### 03_SISTEMA/ — Система Роста (главный продукт)
- `sistema_rosta_FINAL.html` — 764 KB, 7965 строк, 216 страниц, все 7 разделов
- `sistema_original_from_client_site.html` — версия для сайта

### 04_CONTEXT/ — Контекст проекта
- `TAPPIO_SISTEMA_CONTEXT_v3.6_FINAL.txt` — полная история проекта (78 KB)
- `OKO_PROJECT_CONTEXT.txt` — контекст OKO TEAM (92 KB)
- `ducks_context_project_history.txt` — история переписки с клиентом (107 KB)
- `ETAP1_COMPETITORS_51_analyzed.txt` — анализ 51 конкурента с URL'ами

### 05_ANKETA/
- `anketa.html` — заполненная анкета клиента (интерактивная)
- `anketa_short.txt` — краткая версия
- `anketa_full_text.txt` — полный текст ответов клиента

### 06_APP_SCREENSHOTS/ — Все визуальные материалы приложений
**Сгенерированные mockup'ы (для контента):**
- `spy_camera_finder_screen_01-04.png` — 4 mockup'а Spy
- `brainova_screen_01-03.png` — 3 mockup'а Brain
- `tape_measure_screen_01-03.jpg` — 3 mockup'а Tape

**Оригинальные mockup'ы от клиента:**
- `client_mockup_01-09.png` — 9 mockup'ов от Александра

**Прочие фото/скриншоты:**
- `1000079*.jpg` — рабочие фото от клиента

### 07_REFERENCE_PANDAGO/ — ЭТАЛОН для контент-плана
- `panda_content_plan_EXAMPLE.html` — готовый контент-план другого проекта (Cargo из Китая)
- `PANDAGO_RULES_AND_CONTEXT_full.txt` — эталонные правила текстов (217 KB)
- `pandago_rules_original.txt` — оригинал правил
- `pandago_system.txt` — оригинал системы

⚠️ PandaGo — карго из Китая, зелёный бренд. **Изучи как эталон структуры**, не копируй в лоб. У Tappio своя ниша (iOS-утилиты) и своя цветовая схема (cyan/purple/gold).

### 08_BACKEND/ — PHP-бекенд tappio.pro
- `api.php` — основной API (form storage, Telegram bot)
- `cron.php` — плановые задачи
- `polling.php` — Telegram long-polling
- `generate_pdfs.py` — генератор лид-магнитов
- `lead-magnets/` — 4 готовых PDF:
  - `spy-airbnb-hidden-cameras.pdf`
  - `brain-7day-starter-plan.pdf`
  - `tape-furniture-checklist.pdf`
  - `tappio-starter-bundle.pdf`
- `.htaccess`
- `README.md` — деплой-инструкция

### 09_INSTRUCTIONS/ — Твои инструкции (все на русском)
- `README_START_HERE.md` — **начни отсюда**
- `PROJECT_OVERVIEW.md` — про клиента и проект
- `CONTENT_RULES.md` — правила написания роликов (адаптация PandaGo под Tappio)
- `OKO_MOTION_SKILL.md` — как ты собираешь ролики сам
- `CONTENT_PLAN_BLUEPRINT.md` — как построить HTML контент-план
- `WORKFLOW.md` — пошаговый рабочий процесс
- `EXAMPLES_10_SCRIPTS.md` — 10 готовых сценариев как эталоны
- `API_KEYS_SETUP.md` — какие ключи нужны и где брать
- `PACKAGE_INDEX.md` — этот файл

---

## Быстрая карта: где искать что

| Хочу узнать | Где смотреть |
|-------------|--------------|
| Кто клиент, что за продукт | `09_INSTRUCTIONS/PROJECT_OVERVIEW.md` |
| Что уже сделано в проекте | `04_CONTEXT/TAPPIO_SISTEMA_CONTEXT_v3.6_FINAL.txt` |
| Дизайн-система (цвета, шрифты) | `03_SISTEMA/sistema_rosta_FINAL.html` раздел 05 |
| Готовые шаблоны текстов | `03_SISTEMA/sistema_rosta_FINAL.html` раздел 04 |
| Аналитика и метрики | `03_SISTEMA/sistema_rosta_FINAL.html` раздел 06 |
| Стратегия 24 мес | `03_SISTEMA/sistema_rosta_FINAL.html` раздел 07 |
| Как писать хуки | `09_INSTRUCTIONS/CONTENT_RULES.md` секция 4 |
| Как собирать ролики | `09_INSTRUCTIONS/OKO_MOTION_SKILL.md` |
| Как делать контент-план | `09_INSTRUCTIONS/CONTENT_PLAN_BLUEPRINT.md` |
| Эталон правил | `07_REFERENCE_PANDAGO/PANDAGO_RULES_AND_CONTEXT_full.txt` |
| Эталон вёрстки плана | `07_REFERENCE_PANDAGO/panda_content_plan_EXAMPLE.html` |
| Иконки приложений | `02_LOGO_ICONS/` |
| Mockup'ы для B-roll | `06_APP_SCREENSHOTS/` |
| Сайт клиента | `01_SITE/` |
| Бекенд для форм | `08_BACKEND/` |
