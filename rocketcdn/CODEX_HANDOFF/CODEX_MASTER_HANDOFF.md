# Rocket CDN — полный master-handoff для Codex

Версия: **2026-08-22 / PR #7 / P6L**  
Назначение: передать новой сессии Codex весь восстановленный контекст, фактический код, визуальные референсы, статус, доступы без значений секретов и конкретный путь до launch.

---

## 1. Итог в одном абзаце

Rocket CDN уже является большим рабочим продуктом: маркетинговый сайт, RU/EN, живой глобус, формы, собственная аналитика, админка, Telegram-бот, мини-приложение, RocketVPN/реферальная механика и длинный WebGL-фильм, который переходит в космическую игру и физическую кабину. Последние коммиты P6G–P6L объединили полёт, люк и кабину в один 3D-мир, добавили физический шлюз, аппаратный WebGL-пульт, объёмную галактику, астероиды, кинематографическую инерцию камеры и процедурные материалы Солнечной системы. Это реализовано в коде и опубликовано на live, но не имеет доказанной финальной приёмки `100/100`: PR всё ещё draft, CI/ревью отсутствуют, а несколько старых документов противоречат последним требованиям владельца. Следующая работа — не расширять проект, а закрыть конкретные визуальные, инфраструктурные и data/access gates.

---

## 2. Точная область проекта

Входит:

- домен `rocketcdn.ru` и `www.rocketcdn.ru`;
- ссылка/интеграция с `lk.rocketcdn.ru`;
- главный сайт `rocketcdn/index.html`;
- космический фильм по скроллу;
- бесшовный переход из сайта внутрь ракеты;
- кабина, физический пульт, космическая навигация и игра;
- Солнце, восемь планет, Луна, Млечный Путь, галактики, звёздные системы, астероиды и миссии;
- desktop/tablet/mobile layouts и LOD;
- no-WebGL/reduced-motion fallback, но только как аварийный режим;
- generated media, текстуры, видео, музыка и визуальные референсы;
- формы, API, JSON-данные, собственная аналитика;
- `admin.html`, `app.html`, Telegram-бот и cron;
- RocketVPN-переключатель и реферальный розыгрыш;
- nginx/PHP-FPM/Let's Encrypt/cron/deploy/rollback.

Не входит:

- корневой DUCK'S GAME SPACE;
- приложение OKO и контент-заводы;
- «Музыкальный мир»;
- любые другие папки и клиенты общего монорепозитория;
- перенос корневого vault/интеграций/секретов в пакет Rocket CDN.

---

## 3. Неподвижные требования владельца из чата

### 3.1 Единый 3D-мир

1. 3D и полёт нельзя отключать как способ «починить» производительность.
2. Сайт, игра, космос, кабина и контент должны жить в одном согласованном motion-мире.
3. Нельзя сгенерировать красивые фотографии и наклеить их поверх WebGL/страницы.
4. Изображения разрешено использовать как референсы, карты материалов, постеры или аварийный fallback; основная сцена должна оставаться пространственной и интерактивной.
5. Камера, ракета, объекты, DOM-приборы и контент должны ощущаться снятыми в одной физической сцене.
6. Каждый объект, который в реальности должен двигаться, получает обоснованную анимацию; движение связано с камерой/скроллом/действием, а не является случайной декорацией.

### 3.2 Непрерывность ракеты и кабины

1. Во всём проекте используется одна и та же ракета/геометрическая идентичность.
2. Ракета в полёте, ракета при посадке, внешний люк, тамбур и внутренняя кабина не должны выглядеть разными моделями.
3. Вход внутрь и выход обратно бесшовны; разрешена физическая окклюзия геометрией шлюза, но не скрытая видеосклейка с заметной подменой.
4. Reverse scroll должен корректно возвращать пользователя из кабины наружу без зависшего слоя, второго кокпита или чёрного кадра.
5. Физическая панель — часть кабины, а не картинка во весь экран. На телефоне панель/контролы не должны отнимать основной вид из окна; ранее было зафиксировано ограничение визуальной высоты панели около `10vh` для компактного режима.

### 3.3 Качество и референс

- Цель — кинематографическая реалистичная sci-fi сцена уровня фильма/AAA-игры, логика визуального языка в духе Mass Effect.
- Референс означает качество материалов, масштаба, света, камеры, HUD и драматургии; нельзя копировать чужие логотипы, персонажей, модели, музыку или интерфейс 1:1.
- Не должно быть лагов, обрезаний, скачков масштаба, внезапных слоёв поверх окна, наложения текста на критическую геометрию и плоских фонов, выдаваемых за 3D.
- Последний явный acceptance-лист из чата: одна геометрия ракеты; плавный вход/выход; чистый WebGL-космос; физическая панель как часть кабины; отсутствие наложений и лагов.
- После негативного фидбэка было решено прекратить добавление новых функций и исправлять только подтверждённые расхождения по этому acceptance-листу.

### 3.4 Генерационный конвейер

Для нового визуального шага:

1. Подготовить детальный prompt на английском не короче 2000 символов.
2. Описать сцену, неизменяемую геометрию, материалы, следы эксплуатации, масштаб, свет, камеру/объектив, движение, физику, цветовую палитру, mobile crop и negative constraints.
3. Получить 3–4 согласованных референса одной сцены/объекта, а не четыре случайные картинки.
4. Зафиксировать continuity anchors: форма окна, раскладка пульта, геометрия люка, положение кресла, материал корпуса, цвет/толщина подсветки.
5. Только после согласованной статики переходить к Runway Gen-4.5; Minimax допускается как запасной видеодвижок.
6. GPT Image 2 high/4K используется для фотореалистичных референсов и производственных карт, не как runtime-подмена 3D.
7. ElevenLabs используется для озвучки/событийных звуков после утверждения звукового сценария; текущая реализация частично использует Web Audio и отдельную музыкальную тему.
8. Каждый шаг сравнивается A/B с предыдущим live, а не оценивается в вакууме.
9. Не продолжать следующий дорогой шаг, если текущий не прошёл аудит.

### 3.5 Десять уровней аудита

Каждая значимая версия должна получить отдельный результат по десяти уровням:

1. Визуальная точность и премиальность.
2. Функциональность всех контролов/форм/ссылок.
3. Геометрическая ровность, сетка, отступы, отсутствие клиппинга.
4. Адаптация по viewport и orientation.
5. Техника: FPS, память, WebGL contexts, загрузка, отсутствие ошибок.
6. Анимации: тайминг, интерполяция, reverse scroll, idle.
7. Инфографика и читаемость данных.
8. Motion: камера, масса, ускорение, причинность движения.
9. Единство 3D-мира: свет, материалы, масштаб, окклюзия, контакт с DOM.
10. Сценарий/логика/физика/наложения/ощущение цельности.

`100/100` — не эмоциональная формулировка, а факт прохождения всех gate с доказательствами.

---

## 4. Источник правды и состояние GitHub

| Поле | Значение на момент среза |
|---|---|
| Репозиторий | `gdeoko/OKO-TEAM` |
| Visibility | public |
| PR | `#7` — Rocket CDN: сайт, админка, Telegram-бот и мини-приложение |
| PR state | open |
| Draft | да |
| Mergeable | да |
| Base | `claude/adoring-tesla-fFKEd` |
| Head | `claude/rocket-cdn-website-admin-x5482k` |
| Head SHA | `a450e335432e58ca7d3037eaafd516d6a4547da9` |
| Updated | `2026-08-22T16:56:53Z` |
| Commits | 184 |
| Changed files | 133 |
| Additions/deletions | 50 462 / 0 |
| GitHub reviews | нет |
| Review threads | нет |
| PR comments | нет |
| Workflow runs на head | нет |
| Combined status checks | нет |

Последний commit менял cache marker `rc-gl.js` в `index.html`; функциональное изменение непосредственно перед ним — процедурные физические материалы тел Солнечной системы.

### Live parity

22.08.2026 были получены следующие факты:

- `https://rocketcdn.ru/` → HTTP 200, nginx 1.24 Ubuntu;
- `https://www.rocketcdn.ru/` → HTTP 200;
- `https://lk.rocketcdn.ru/` → HTTP 200;
- live `index.html` имел размер 88 045 байт;
- его SHA-256 полностью совпал с `rocketcdn/index.html` из head: `d0e012908ff81a55a0ccd9017f0a9ccf2e7a6fa4606ff1d634905d5e3a493880`.

Это подтверждает выкладку HTML head, но не доказывает, что каждый asset на live совпадает с веткой. Перед релизом нужен полный deployment manifest.

---

## 5. Что уже реализовано

### 5.1 Основной сайт

- RU/EN, тёмная/светлая тема.
- Фирменная палитра: `#091320`, `#42B2DC`, `#E2E8F0`, акцент `#8A59F6`, градиент `#42B2DC → #0A5897`.
- Локальный Golos Text.
- 218 точек присутствия, реальные координаты, фильтры регионов и поиск города.
- Три собственных ЦОД: Москва, Алматы, Прага.
- Семь продуктовых направлений, шесть преимуществ, сценарии, надёжность, FAQ, подключение.
- Schema.org, Open Graph, sitemap, robots, manifest.
- Локальные ассеты без обычной зависимости страницы от внешних CDN.
- Privacy и offer страницы.

### 5.2 Аналитика и заявки

- Собственный PHP API без отдельной БД.
- Посещения, уникальные, CTA clicks, глубина, устройства, ОС, referrers, поиски городов, JS errors.
- Lead и callback flows, honeypot, валидация контакта, rate limiting/trusted proxy model.
- JSON-хранилище со строго выделенной writable data directory.
- Статусы заявок, удаление, CSV export.
- Редактирование текстов/JSON-контента через admin.

### 5.3 Админка, бот, cron

- `admin.html`: пароль, графики, заявки, узлы, тексты, self-test.
- `@rocket_cdn_bot`: guest/admin меню, уведомления, аналитика, заявки, health, content editing, undo.
- `/bindchat`, `/bindtopic`, `/report`, `/stats`, `/leads`, `/health`, `/texts`, contest commands.
- Telegram mini app `app.html`.
- SMTP Gmail templates владельцу и клиенту.
- Ежедневный отчёт, reminders по старым заявкам, health checks, 14 JSON backups.
- Telegram IPv4 fallback/pinned address/DoH resolver/proxy option.
- RocketVPN projector и referral contest с повторной проверкой подписки.

### 5.4 Космический фильм и игра

Фактически присутствуют:

- процедурная ракета и управление полётом;
- полёт по сайту и переход из финала в игру;
- единый WebGL слой/координация сцен;
- физический проём, шлюз, тамбур и кабина;
- физический WebGL-пульт с прозрачными DOM-контролами;
- Солнечная система: Солнце, 8 планет, Луна;
- процедурные материалы планет, day/night/cloud/moon карты;
- Млечный Путь, звёздные поля, 3D galactic volume, filaments;
- астероидное поле;
- HUD, тяга, навигация, остановка, справка, scanner/journal;
- выбор тел/систем, задания и прогресс;
- отображение Земли через окно кабины;
- full flight, reverse scroll и mobile HUD fixes;
- fallback paths при невозможности поднять WebGL;
- звуковой слой Web Audio и отдельная музыкальная тема.

### 5.5 Последняя цепочка этапов

| Этап | Коммиты/смысл | Статус |
|---|---|---|
| Unified world checkpoint | `75ba99e`, `3b1cea9`, `dd8466f`, `cd7b47e`, `ade0911` — объединение hatch/cabin/flight в одном мире | реализовано в head; нужна финальная визуальная приёмка |
| Reverse scroll | `2cac6ba`, `3e6aadc`, `1b4a0f8` | реализовано; проверить многократный forward/back на mobile |
| P6G | active 3D galaxy only on mobile + cache propagation | реализовано; измерить память/FPS |
| P6H | cinematic physical airlock + worn gunmetal cabin | реализовано; сверить с референсами и непрерывностью ракеты |
| P6I | console as WebGL hardware, physical response, transparent DOM controls | реализовано; проверить hit areas/focus/viewport |
| P6J | world-space galactic volume + physical asteroid field | реализовано; проверить глубину, масштаб и performance |
| P6K | replace flat nebulae with 3D filaments + camera mass | реализовано; проверить motion sickness и camera continuity |
| P6L | procedural physical materials for Solar System bodies | последний head; full-device acceptance отсутствует |

Слова «реализовано» здесь означают наличие кода/коммита, а не пользовательское утверждение `100/100`.

---

## 6. Карта ключевых файлов

### Документы и страницы

| Файл | Назначение |
|---|---|
| `rocketcdn/index.html` | главная, фильм, формы и подключение модулей |
| `rocketcdn/app.html` | Telegram mini app |
| `rocketcdn/admin.html` | аналитика/заявки/контент/self-test |
| `rocketcdn/privacy.html` | политика |
| `rocketcdn/offer.html` | оферта |
| `rocketcdn/splash.html` | ранние loader concepts |
| `rocketcdn/splash-lk.html` | loader variants для личного кабинета |
| `rocketcdn/README.md` | обзор функциональности |
| `rocketcdn/DEPLOY.md` | текущий deployment manual, частично устарел |
| `rocketcdn/docs/SCENARIO.md` | большой режиссёрский сценарий и budgets |

### PHP/backend

| Файл | Назначение |
|---|---|
| `config.php` | конфигурация, JSON helpers, Telegram/SMTP/self-test |
| `api.php` | track, lead, callback, content, admin API |
| `bot.php` | Telegram polling, menus, notifications, contest |
| `cron.php` | отчёт, cleanup, reminder, health, backup |
| `lib_report.php` | построение отчётов |
| `bump.php` | вспомогательное обновление/marker |

### Core/site UI

- `rc-app.js`, `rc-i18n.js`, `rc-geo.js`, `rc-globe.js`, `rc-globe3d.js`.
- `rc.css`, `rc-adapt.css`, `rc-compact.css`, `rc-reduced.css`, `rc-fonts.css`, `rc-var.js`.

### 3D/film/game

- Scene/runtime: `rc-gl.js`, `rc-scene.js`, `rc-world.js`, `rc-space.js`, `rc-depth.js`.
- Flight/ship: `rc-flight.js`, `rc-flight.css`, `rc-rocket.js`, `rc-interior.js`, `rc-cabin.js`.
- Hatch/cockpit: `rc-airlock.js/css`, `rc-gate.js/css`, `rc-cockpit.js/css`, `rc-console.js/css`.
- Physical integrations: `rc-hooks.js`, `rc-motion.js`, `rc-scroll.js`, `rc-rail.js/css`, `rc-landing.css`.
- Space content: `rc-planets.js`, `rc-rack.js/css`, `rc-holo.js/css`, `rc-viz.js`.
- Fallback/media: `rc-fallback.js`, `rc-vidbg.js`, `rc-sound.js`, `rc-music.js`.
- Product layer: `rc-vpn.js/css`.

### Generated/runtime assets

- `assets/gen/` — cockpit plates/posters, flight clips, console clips, space clips, data-center renders, OG.
- `assets/storyboard/` — 8 fallback frames.
- `assets/space/` — Earth day/night, clouds, Moon maps.
- `assets/audio/` — 72-second theme in M4A/WebM.
- `assets/vendor/three.min.js` — локальная Three.js build.

---

## 7. Что проверено при сборке этого handoff

Подтверждено новым read-only аудитом:

- точный Git head и PR metadata;
- все 131 файла в `rocketcdn/` получены из head;
- общий размер `rocketcdn/` около 18 MiB;
- собственные JS-файлы проходят `node --check`;
- все 13 аудио/видеофайлов распознаются `ffprobe`;
- live HTML главной полностью совпадает с head;
- `config.local.php`, `data/`, `*.log` исключены `rocketcdn/.gitignore`;
- `config.local.php` и `rocketcdn/data` не отслеживаются Git;
- scan Rocket CDN subtree не нашёл типичных private-key/GitHub/OpenAI/AWS/Google/Telegram token patterns;
- PR mergeable и без review conversations.

Не было возможности заново выполнить в этом окружении:

- `php -l` — PHP CLI отсутствовал;
- реальную SMTP/Telegram/selftest проверку — значения секретов не переносились;
- browser QA в Chromium — браузерный runtime в локальном контейнере отсутствовал;
- CI — workflow на head отсутствует;
- реальный SSH/VPS filesystem audit — SSH credential намеренно не импортировался;
- платные Runway/GPT Image/ElevenLabs генерации.

Старый PR body сообщает, что ранее `php -l`, API flows и Chromium 1440×900/390×844 проходили, но после десятков последующих P6-коммитов это считается историческим доказательством, а не финальным gate.

---

## 8. Generated media и референсы

### 8.1 Репозиторные видео/аудио

| Asset | Длительность | Роль |
|---|---:|---|
| `theme.m4a` / `theme.webm` | ~72 s | музыкальная тема |
| `cockpit-flight-mobile-v2.*` | ~10.04 s | mobile cinematic/fallback |
| `cockpit-flight-wide-v2.*` | ~10.04 s | wide cinematic/fallback |
| `console-640.*` | ~6.13 s | small console video |
| `console-960.mp4` | ~6.13 s | large console video |
| `space-earth.*` | ~8.11 s | Earth space background/fallback |
| `space-nebula.*` | ~8.11 s | nebula background/fallback |

### 8.2 Репозиторные generated stills

- Cockpit: `cockpit-wide`, `cockpit-wide-v2`, `cockpit-tall`, `cockpit-tall-v2`.
- Posters: wide/mobile v2.
- Console: `console.webp`.
- Data centers: Moscow, Almaty, Prague.
- OG 1200×630 JPG/WebP.
- 8 storyboard frames 1344×768.
- Earth/Moon texture maps up to 4096×2048.

### 8.3 Library reference pack

В ZIP дополнительно включены девять исходных generated reference images:

- инженерная панель кокпита;
- макросъёмка панели Rocket CDN;
- кокпит с Землёй и голограммами;
- панорамный кокпит ракеты;
- панорамный космический кокпит;
- подход к открытому люку;
- портретный кокпит с Землёй и Млечным Путём;
- финальный подход к креслу;
- шаг в звёздную кабину.

Также включены пятнадцать сегодняшних мобильных screenshots текущего UI/game path.

### 8.4 Что неизвестно

В Git отсутствует полный asset registry с полями generator/model/prompt/seed/date/license/source master. Поэтому нельзя утверждать, какие именно repo assets были созданы GPT Image 2, Runway, другим генератором или вручную. До новых генераций создать `ASSET_REGISTRY.md` и для каждого нового файла записывать provenance без credential values.

---

## 9. Разрывы между текущим кодом и последним ТЗ

| Разрыв | Фактическое состояние | Что должно быть сделано |
|---|---|---|
| Полная приёмка P6L | код/live есть, CI и доказательства по всем viewport отсутствуют | снять baseline и пройти 5+ viewport, forward/reverse, slow device |
| «3D нельзя отключать» vs fallback docs | старый `SCENARIO.md` выключает 3D при reduced motion/weak device | оставить сюжет/пространственную композицию через LOD; статичный fallback только при реальном no-WebGL/JS-off |
| Images/video vs single world | generated cockpit/video assets используются в fallback/plates | проверить, что в основном режиме они не выглядят плоской наклейкой и геометрия совпадает с WebGL |
| ElevenLabs | явной интеграции/provenance нет | утвердить sound cue sheet и voice text, сгенерировать/лицензировать только необходимые cues |
| Audio contradiction | старый сценарий говорит «ноль файлов», repo содержит theme files | выбрать и документировать hybrid: Web Audio events + licensed/generated theme/voice |
| Runway/GPT pipeline | assets есть, production registry/prompt set отсутствует | добавить prompts, 3–4 continuity refs, export settings, registry |
| DEPLOY DNS notes | docs говорят, что www/lk не готовы; 22.08 оба отвечали 200 | владелец подтверждает правильные target/services; обновить docs |
| PHP socket | таблица server говорит PHP 8.3, nginx example содержит 8.2 | проверить live socket и исправить example на фактический |
| Data path | production table `/var/www/rocketcdn-data`, часть команд использует `rocketcdn/data` | подтвердить `data_dir`, ownership, backups; унифицировать docs |
| Secret container | public repo tracks root `secrets.env.b64` | rotation/revocation + удалить из active tree/history process; не использовать в Rocket package |
| Tests | head без workflow | добавить CI или формальный manual release report |
| Legal/contest | privacy/offer есть, contest собирает Telegram data | владелец/юрист подтверждает текст, срок, призы и обработку данных |

---

## 10. Производственный workflow AI-ассетов

### 10.1 Общие правила

- Вход: конкретный visual defect/shot, а не «сделай красивее».
- Сначала continuity sheet и prompt; затем 3–4 refs; затем motion/audio.
- Каждый output получает уникальный ID, version, source model, prompt file, aspect, duration, status.
- Source master хранится отдельно от web export; в repo попадает оптимизированный web asset и registry.
- Никакой секрет не записывается в prompt/metadata.
- Платный запуск — только после разрешения владельца на серию.

### 10.2 GPT Image 2 high/4K

Использовать для:

- material/light references;
- orthographic/angle continuity sheets одной и той же кабины/люка/пульта;
- texture/reference passes;
- posters/storyboard/OG;
- точного определения wear, roughness, edge highlights, emissive strips.

Не использовать как единственную плоскость, закрывающую WebGL-космос в основном режиме.

Минимальный deliverable одного concept step:

- prompt `.md` ≥2000 English chars;
- 3–4 согласованных 4K images;
- continuity notes;
- A/B contact sheet;
- решение: accept/reject/revise.

### 10.3 Runway Gen-4.5 / Minimax

Использовать после утверждения refs для:

- согласованного пролёта камеры;
- cockpit/airlock transition reference;
- fallback cinematic clips, если WebGL отсутствует;
- motion study для переноса в WebGL.

Motion clip не должен скрывать несоответствие основной 3D-геометрии. Для каждого wide/mobile клипа зафиксировать:

- input refs;
- exact prompt;
- start/end frame;
- camera path;
- duration/FPS/aspect;
- export master;
- MP4/WebM web transcodes;
- poster;
- license/account provenance.

### 10.4 ElevenLabs

Требуемый безопасный процесс:

1. Утвердить voice/SFX cue sheet по сценам.
2. Определить, нужна ли речь; сейчас финальный voiceover text не найден.
3. Через уже авторизованную browser session выбрать разрешённый voice/SFX model.
4. Не клонировать голос третьего лица без его явного разрешения.
5. Сохранить WAV master, затем web export M4A/WebM/OGG по support matrix.
6. Записать модель, дату, лицензию и prompt в registry.
7. Нормализовать громкость, поставить limiter и проверить на телефоне/наушниках.
8. Учитывать browser autoplay: звук стартует только после user gesture; фильм остаётся полноценным без звука.

### 10.5 Asset registry schema

Для новых файлов использовать таблицу:

| ID | Web path | Type | Source service/model | Prompt file | Refs | Aspect/duration | License | Integrated as | Status |
|---|---|---|---|---|---|---|---|---|---|

Статусы: `reference`, `approved-source`, `web-export`, `integrated`, `rejected`, `superseded`.

---

## 11. Роли агентов и границы

### Lead/orchestrator

- держит frozen requirements и launch board;
- назначает одного writer на файл;
- запрещает scope creep;
- принимает evidence, а не обещания;
- собирает финальный release report.

### 3D/WebGL agent

- одна ракета/кабина/люк;
- камера, materials, lights, occlusion;
- LOD, context budget, memory/FPS;
- forward/reverse path;
- физическая связь DOM с WebGL.

### Visual asset agent

- prompts ≥2000 chars;
- GPT Image 2 refs;
- Runway/Minimax motion references;
- contact sheets и asset registry;
- не редактирует runtime без согласования 3D agent.

### Sound agent

- cue sheet, ElevenLabs/Web Audio;
- loudness, autoplay, mobile;
- provenance/license;
- mute/reduced motion behavior.

### Product/backend agent

- forms/API/admin/bot/cron;
- data consistency, rate limits, backups;
- contest flow;
- не трогает визуальную сцену.

### QA/release agent

- scripted matrix;
- screenshots/video/FPS/error logs;
- live/hash parity;
- nginx/PHP/cert/cron/rollback;
- final go/no-go.

---

## 12. Приоритетный backlog

### P0 — до любого launch/ready-for-review

1. Заменить все credential values, которые могли присутствовать в публичном `secrets.env.b64` или его истории.
2. Проверить GitHub write access, VPS SSH/sudo access, DNS ownership и browser sessions сервисов.
3. Подтвердить live `config.local.php` только по наличию ключей и self-test, не выводя значения.
4. Подтвердить реальный `data_dir`, ownership, backup/restore.
5. Исправить расхождения PHP socket/DNS/data paths в `DEPLOY.md`.
6. Выполнить full asset manifest comparison live vs head.
7. Провести browser QA последнего P6L; зафиксировать все failures.

### P1 — визуальный acceptance

1. Одна геометрия ракеты и бесшовный forward/reverse airlock.
2. Проверка physical console на каждом viewport; окно остаётся главным кадром.
3. Чистый 3D space: no flat nebula overlay, no double scene, correct depth.
4. Проверка P6L planet materials: физичность, scale, light response, no painted spheres.
5. Camera mass: cinematic, но не укачивает и не запаздывает за scroll.
6. DOM/WebGL collision: ни один важный текст/CTA не перекрыт.
7. Mobile LOD сохраняет мир, не превращая основной путь в slideshow.

### P2 — functional/reliability

1. PHP lint и API test suite на PHP 8.3.
2. Admin login/selftest, leads/status/export/content.
3. Telegram bot, chat bindings, report, contest with two test users.
4. Gmail delivery owner/client.
5. Cron report/reminder/backup/health.
6. Accessibility: keyboard, labels, focus, no-JS form.
7. SEO/schema sync с динамическими FAQ.

### P3 — release polish

1. Final GPT/Runway assets only for confirmed gaps.
2. ElevenLabs cue set/voice if approved.
3. Asset registry/provenance/licenses.
4. Performance budgets and compression.
5. CI/release report.
6. PR body rewritten to current P6L reality; reviewers assigned; draft снят только после gate.

---

## 13. Definition of Done

Проект готов к запуску/ready-for-review, когда одновременно выполнено всё:

- все P0 закрыты;
- нет действующих credential values в Git/ZIP/PR/logs;
- PR head = проверенный deployment commit;
- live assets соответствуют manifest;
- 5 обязательных viewport прошли полный forward и reverse path;
- на реальных mobile нет чёрных кадров, второго cockpit, обрезанной панели или потерянных taps;
- одна ракета/люк/кабина визуально непрерывны;
- 3D/flight сохраняются через LOD, аварийный fallback работает отдельно;
- все CTA/forms/API/admin/bot/mail/cron проходят;
- privacy/offer/contest подтверждены;
- sound не autoplay до gesture, mute работает, loudness принята;
- никаких console errors/unhandled promises;
- FPS/memory/context budgets записаны;
- A/B и 10-level audit приложены;
- rollback проверен;
- PR больше не draft, имеет reviewer и зелёные checks.

---

## 14. Следующее конкретное действие новой сессии

Не генерировать новые изображения сразу.

1. Подключить GitHub и получить свежий head.
2. Подключить/проверить VPS read-only и сравнить весь live manifest.
3. Запустить сайт локально/на staging с настоящим браузером.
4. Снять один полный desktop и один mobile video forward+reverse.
5. Сверить с contact sheets и frozen acceptance-list.
6. Составить короткий список только воспроизводимых defects.
7. Исправлять defect №1 до доказанного pass; затем следующий.

Это соответствует последнему указанию владельца: прекратить расширение и довести конкретные проблемы до конца.

