# ROCKET CDN — COMPLETE CODEX HANDOFF

This is the single-file operational handoff embedded directly in PR #7 branch `claude/rocket-cdn-website-admin-x5482k`.

Authoritative project directory: `rocketcdn/`.

Binary package parts: `rocketcdn/CODEX_HANDOFF/package-parts/`.

---


---

<!-- BEGIN ROCKETCDN_CODEX_START_HERE.md -->

# Rocket CDN — START HERE FOR CODEX

Весь контекст уже находится внутри этой рабочей ветки. Не скачивай sandbox-файл и не клонируй отдельную handoff-ветку.

Начни отсюда:

```text
rocketcdn/CODEX_HANDOFF/CURRENT_STATE_OVERRIDE.md
rocketcdn/CODEX_HANDOFF/README.md
rocketcdn/CODEX_HANDOFF/CODEX_MASTER_HANDOFF.md
rocketcdn/CODEX_HANDOFF/ACCESS_RUNBOOK.md
rocketcdn/CODEX_HANDOFF/LAUNCH_CHECKLIST.md
rocketcdn/CODEX_HANDOFF/AGENTS.md
rocketcdn/CODEX_HANDOFF/PROMPT_FOR_CODEX.txt
```

Проект:

```text
rocketcdn/
```

Полный ZIP также находится в Git как 57 частей:

```text
rocketcdn/CODEX_HANDOFF/package-parts/
```

Инструкция сборки:

```text
rocketcdn/CODEX_HANDOFF/PACKAGE_FROM_GITHUB.md
```

Текущий PR остаётся draft. Сначала прочитай полный handoff, проверь текущий head и составь отчёт «готово / можно закрыть / реальные launch-blockers». Не выполняй deploy и не запускай платные AI-генерации без отдельной команды владельца.

<!-- END ROCKETCDN_CODEX_START_HERE.md -->


---

<!-- BEGIN rocketcdn/CODEX_HANDOFF/CURRENT_STATE_OVERRIDE.md -->

# CURRENT STATE OVERRIDE — Rocket CDN

Дата фиксации: 2026-08-22.

Этот файл находится непосредственно в рабочей ветке PR #7. Сетевой доступ, sandbox-файл и отдельное клонирование для чтения handoff не нужны.

## Авторитетные ссылки

- Repository: `gdeoko/OKO-TEAM`
- PR: `#7`
- Working branch: `claude/rocket-cdn-website-admin-x5482k`
- Branch head перед добавлением handoff: `a2475e967d54e564f5ca63f9bee3e192419cdae1`
- PR state: open, draft, mergeable
- Project root: `rocketcdn/`
- Handoff root: `rocketcdn/CODEX_HANDOFF/`

Код в текущей ветке новее исходного среза `a450e335432e58ca7d3037eaafd516d6a4547da9`, указанного внутри master-handoff. Поэтому текущие файлы `rocketcdn/` являются источником правды для реализации, а документы handoff — источником требований, истории, доступов, инвентаря и launch-gates.

## Обязательный порядок для Codex

1. Не выполнять `git clone` и не пытаться открыть старый `sandbox:` URL.
2. Перейти в корень уже открытого repository.
3. Прочитать `ROCKETCDN_CODEX_START_HERE.md`.
4. Прочитать весь `rocketcdn/CODEX_HANDOFF/README.md`.
5. Прочитать `CODEX_MASTER_HANDOFF.md`, `ACCESS_RUNBOOK.md`, `LAUNCH_CHECKLIST.md` и `AGENTS.md`.
6. Проверить целостность package-parts по `package-parts/PACKAGE_PARTS.sha256`.
7. Сопоставить handoff с текущим `git log` и текущими файлами `rocketcdn/`.
8. До отдельной команды владельца не выполнять deploy, платные генерации, ротацию credential или внешние изменения.

## Локальная проверка

```bash
cd "$(git rev-parse --show-toplevel)"
test -d rocketcdn
test -f ROCKETCDN_CODEX_START_HERE.md
test -f rocketcdn/CODEX_HANDOFF/README.md
test -f rocketcdn/CODEX_HANDOFF/CODEX_MASTER_HANDOFF.md
test -f rocketcdn/CODEX_HANDOFF/ACCESS_RUNBOOK.md
test -f rocketcdn/CODEX_HANDOFF/LAUNCH_CHECKLIST.md
git status --short --branch
```

Actual credential values intentionally are not stored in Git. All known usernames, hostnames, paths, configuration key names and safe connection procedures are in `ACCESS_RUNBOOK.md`.

<!-- END rocketcdn/CODEX_HANDOFF/CURRENT_STATE_OVERRIDE.md -->


---

<!-- BEGIN rocketcdn/CODEX_HANDOFF/README.md -->

# Rocket CDN — пакет передачи работы Codex

> **Полный ZIP в этой ветке:** откройте [PACKAGE_FROM_GITHUB.md](PACKAGE_FROM_GITHUB.md). Архив хранится 57 частями, собирается одной командой и проверяется по SHA-256.

Дата среза: **22 августа 2026 года**.

Этот ZIP предназначен для новой сессии Codex, которая должна продолжить и завершить только проект **Rocket CDN**: маркетинговый сайт, единый космический 3D-мир, кабину, полёт/игру, административную часть, Telegram-бота, медиаресурсы и запуск.

## С чего начать

1. Прочитать `AGENTS.md`.
2. Полностью прочитать `CODEX_MASTER_HANDOFF.md`.
3. Для подключения и выкладки использовать `ACCESS_RUNBOOK.md`.
4. Перед переводом PR из draft пройти `LAUNCH_CHECKLIST.md`.
5. Для продолжения в новой сессии можно вставить `PROMPT_FOR_CODEX.txt`.

## Что внутри

- `rocketcdn/` — полный рабочий каталог из ветки PR #7, включая сайт, PHP, игру, WebGL-код, изображения, видео, музыку и storyboard.
- `references/generated-library/` — сгенерированные исходные референсы кабины, шлюза и физического пульта.
- `references/screenshots/` — сегодняшние мобильные скриншоты текущего визуального состояния.
- `reports/generated-reference-contact-sheet.jpg` — контактный лист сгенерированных референсов.
- `reports/live-screenshot-contact-sheet.jpg` — контактный лист мобильных скриншотов.
- `reports/MEDIA_INVENTORY.md` — перечень медиаресурсов и их назначение.
- `reports/MEDIA_MANIFEST.sha256` — контрольные суммы файлов пакета.
- `reports/SOURCE_PROVENANCE.md` — точный источник snapshot и проведённые проверки.

## Источник кода

- Репозиторий: `gdeoko/OKO-TEAM`
- PR: `#7`
- PR URL: `https://github.com/gdeoko/OKO-TEAM/pull/7`
- Рабочая ветка: `claude/rocket-cdn-website-admin-x5482k`
- Base: `claude/adoring-tesla-fFKEd`
- Зафиксированный head: `a450e335432e58ca7d3037eaafd516d6a4547da9`
- Последний commit среза: `Rocket CDN: publish P6L planetary material marker`

Извлечённая папка не содержит `.git`. Для правок Codex должен подключиться к GitHub и получить свежую ветку; snapshot в ZIP служит полным контекстом и аварийной копией, а не заменой истории Git.

## Критические правила

- Не работать над DUCK'S GAME SPACE, OKO app, «Музыкальным миром» или другими проектами репозитория.
- Не подменять единый 3D-мир набором статичных изображений поверх страницы.
- Не выключать полёт и 3D как обычный способ оптимизации. Использовать LOD и поэтапную деградацию качества; статичный fallback допустим только при реальном отсутствии WebGL/JavaScript.
- Ракета, люк, тамбур, кабина и пульт должны восприниматься одной физической конструкцией без смены геометрии и стиля.
- Не добавлять новые функции поверх неисправленных acceptance-проблем.
- Не расходовать платные генерации без явного разрешения владельца на конкретную серию.
- Не копировать в ZIP, Git, PR, issue, чат, логи или prompt действующие пароли, токены, API-ключи и приватные SSH-ключи.

## Важный security blocker

Публичный репозиторий отслеживает корневой файл `secrets.env.b64`. Он намеренно **не включён** в этот пакет и не читался при сборке. Base64 не является шифрованием; все действующие учётные данные, которые когда-либо находились в этом файле или его истории, перед launch необходимо считать потенциально раскрытыми, отозвать/заменить и заново выдать рабочему окружению вне репозитория.

## Быстрый статус

- PR открыт, остаётся draft и GitHub считает его mergeable.
- В PR: 184 коммита, 133 изменённых файла, 50 462 добавления, 0 удалений.
- На head отсутствуют CI/status checks, reviews и review threads.
- Локальная синтаксическая проверка всех собственных JS-файлов пройдена.
- Заголовки всех MP4/WebM/M4A читаются `ffprobe` без ошибок.
- Публичный `https://rocketcdn.ru/` на момент среза возвращал HTML, полностью совпадающий по SHA-256 с `rocketcdn/index.html` из head.
- `https://www.rocketcdn.ru/` и `https://lk.rocketcdn.ru/` отвечали HTTP 200; старые заметки в `DEPLOY.md` об их неготовности требуют актуализации после проверки владельца.
- Полная визуальная приёмка последнего P6L на реальных desktop/mobile устройствах не доказана автоматическими проверками и остаётся обязательным launch-gate.

<!-- END rocketcdn/CODEX_HANDOFF/README.md -->


---

<!-- BEGIN rocketcdn/CODEX_HANDOFF/PROMPT_FOR_CODEX.txt -->

Открой ZIP RocketCDN_Codex_Package_2026-08-22 и продолжи работу только над Rocket CDN.

Сначала полностью прочитай README_START_HERE.md, AGENTS.md, CODEX_MASTER_HANDOFF.md, ACCESS_RUNBOOK.md и LAUNCH_CHECKLIST.md. Затем подключись к GitHub, открой gdeoko/OKO-TEAM PR #7 и получи свежий head ветки claude/rocket-cdn-website-admin-x5482k. Не считай snapshot в ZIP более свежим, чем remote.

Не работай над другими проектами репозитория. Не читай и не используй secrets.env.b64. Не проси и не выводи значения паролей, токенов, API-ключей или private SSH keys; используй подключённые connector/browser/SSH-agent sessions и проверяй только факт доступа.

Главные требования: сайт, полёт, игра, ракета, люк и кабина — один реалистичный интерактивный 3D motion-мир; никакого вклеивания картинок поверх 3D; одна геометрия ракеты; бесшовный forward/reverse вход; физический WebGL-пульт; чистый космос; адаптивный LOD без отключения 3D на обычном mobile; никаких наложений, лагов и обрезаний.

Не начинай с новых генераций. Сначала сравни fresh head с live, собери полный asset manifest, подключись к VPS read-only, пройди desktop/mobile forward+reverse и составь список только воспроизводимых defects. Исправляй по одному defect до доказанного pass с A/B и десятиуровневым аудитом. Новые GPT Image 2/Runway/ElevenLabs генерации запускай только для подтверждённого gap и после явного разрешения владельца на платный batch.

PR остаётся draft, пока не закрыт весь LAUNCH_CHECKLIST.md.

<!-- END rocketcdn/CODEX_HANDOFF/PROMPT_FOR_CODEX.txt -->


---

<!-- BEGIN rocketcdn/CODEX_HANDOFF/AGENTS.md -->

# Инструкции агентам Codex — Rocket CDN

## Область работы

Работать только с `gdeoko/OKO-TEAM`, PR #7, веткой `claude/rocket-cdn-website-admin-x5482k` и каталогом `rocketcdn/`.

Любые корневые проекты репозитория вне `rocketcdn/` не входят в задачу. Не переносить их настройки, секреты или бизнес-логику в Rocket CDN.

## Обязательное чтение

Перед первой правкой полностью прочитать:

1. `CODEX_MASTER_HANDOFF.md`
2. `ACCESS_RUNBOOK.md`
3. `LAUNCH_CHECKLIST.md`
4. `rocketcdn/README.md`
5. `rocketcdn/DEPLOY.md`
6. `rocketcdn/docs/SCENARIO.md`

При расхождении документов приоритет следующий:

1. Явные ограничения владельца, зафиксированные в `CODEX_MASTER_HANDOFF.md`.
2. Фактический head PR и текущий live-результат.
3. `LAUNCH_CHECKLIST.md` и критерии приёмки.
4. Старые описания в `SCENARIO.md` и `DEPLOY.md`.

## Жёсткие визуальные ограничения

- Сайт, полёт и игра — один непрерывный реалистичный 3D motion-мир.
- Нельзя просто приклеивать изображения/видеофоны поверх сцены и называть это 3D.
- Сгенерированные изображения — референсы материалов, света, геометрии и камеры; финальные объекты должны быть встроены в WebGL-мир либо использоваться как честный fallback.
- Одна и та же ракета должна продолжаться снаружи, в люке, тамбуре и кабине. Никакой заметной подмены внешнего вида.
- Вход и выход из ракеты бесшовные; reverse scroll должен быть столь же корректным.
- DOM-контент, приборы и формы должны быть привязаны к физической сцене, не перекрывать окно и не проваливаться сквозь геометрию.
- Визуальная планка — реалистичная кинематографическая sci-fi логика в духе Mass Effect, без копирования чужих защищённых ассетов и интерфейсов 1:1.
- На mobile сохраняется та же композиция и сюжет с адаптивным LOD, без обрезаний, наложений и чёрных кадров.

## Порядок работы

1. Получить свежий head ветки и сравнить с commit из snapshot.
2. Воспроизвести конкретный acceptance-разрыв на целевом viewport.
3. Исправлять один подтверждённый разрыв за раз, не расширяя функциональность.
4. До правки сохранить baseline screenshot/video и метрики.
5. После правки провести A/B-сравнение и десятиуровневый аудит из handoff.
6. Не заявлять `100/100`, пока не сохранены доказательства на всех обязательных viewport.
7. Коммитить атомарно с описанием проблемы, решения и проверки.
8. Не переводить PR из draft до полного launch-gate.

## Работа несколькими агентами

Допускается параллельная работа только по независимым задачам:

- Lead/orchestrator — держит критерии и единственный merge-план.
- 3D/WebGL — геометрия, камера, материалы, LOD, производительность.
- Visual/asset director — GPT Image 2/Runway/референсы и asset registry.
- Sound — ElevenLabs/Web Audio, лицензии, громкость, mobile autoplay.
- QA/release — viewports, функционал, PHP/API, nginx, deploy/rollback.

Одновременно один файл редактирует только один агент. Остальные делают read-only аудит или работают в отдельных ветках. Секретные значения агентам в prompt не передаются; доступ даётся только через уже авторизованную сессию/окружение с минимально необходимыми правами.

## Секреты

- Не читать и не использовать корневой `secrets.env.b64`.
- Не декодировать base64-контейнеры с учётными данными.
- Не просить владельца вставлять секрет в чат или файл handoff.
- Проверять только наличие доступа: авторизован ли connector/browser, доступен ли SSH agent, возвращает ли сервис harmless read-only ответ.
- Если доступа нет, остановить конкретный внешний шаг и перечислить ровно какой доступ должен быть подключён.

## Платные действия

Перед платной генерацией Runway, GPT Image 2 через тарифицируемый канал, ElevenLabs, Minimax или иной платной системой получить явное разрешение на объём/варианты. Исследование, аудит, локальная обработка и подготовка prompt разрешения не требуют.

<!-- END rocketcdn/CODEX_HANDOFF/AGENTS.md -->


---

<!-- BEGIN rocketcdn/CODEX_HANDOFF/CODEX_MASTER_HANDOFF.md -->

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

<!-- END rocketcdn/CODEX_HANDOFF/CODEX_MASTER_HANDOFF.md -->


---

<!-- BEGIN rocketcdn/CODEX_HANDOFF/ACCESS_RUNBOOK.md -->

# Rocket CDN — безопасный runbook доступов и запуска

Документ перечисляет все необходимые классы доступа, известные публичные endpoints, имена конфигурационных ключей и процедуры проверки. Значения секретов в нём отсутствуют.

## 1. Правило доступа

Codex никогда не просит вставить пароль, токен, API-key или private SSH key в чат, prompt, Markdown, ZIP или Git.

Допустимы:

- уже подключённый GitHub connector;
- уже авторизованная browser session;
- SSH agent/credential, заранее подключённый к runtime;
- runtime/environment secret, значение которого команда не печатает;
- ручной login пользователем в браузере, после которого Codex продолжает в той же сессии.

Проверяется факт доступа, а не значение credential.

---

## 2. GitHub

### Известно

- Repo: `gdeoko/OKO-TEAM`
- PR: `https://github.com/gdeoko/OKO-TEAM/pull/7`
- Branch: `claude/rocket-cdn-website-admin-x5482k`
- Expected snapshot SHA: `a450e335432e58ca7d3037eaafd516d6a4547da9`
- Repo публичный; read возможен без секрета, write требует авторизованного владельцем доступа.

### Как получить доступ

Предпочтительно подключить GitHub app/connector в рабочей среде Codex. Если connector отсутствует, пользователь авторизует его через интерфейс; PAT в чат не передаётся.

### Harmless verification

```bash
git ls-remote https://github.com/gdeoko/OKO-TEAM.git \
  refs/heads/claude/rocket-cdn-website-admin-x5482k
```

Для рабочего clone:

```bash
git clone --single-branch \
  --branch claude/rocket-cdn-website-admin-x5482k \
  https://github.com/gdeoko/OKO-TEAM.git
cd OKO-TEAM
git rev-parse HEAD
git status --short --branch
```

Если head отличается от snapshot, считать свежий remote head источником правды и сначала изучить новые commits.

### Write check

Проверять permission через connector/API, не делать тестовый мусорный commit. Перед push убедиться, что branch именно PR head и изменения только в `rocketcdn/`.

---

## 3. VPS Rocket CDN

### Известная публичная конфигурация

| Поле | Значение |
|---|---|
| Host | `217.19.122.132` |
| SSH user | `ubuntu` |
| OS | Ubuntu 24.04 |
| CPU/RAM | 4 cores / 4 GiB |
| Site root | `/var/www/rocketcdn` |
| External data | `/var/www/rocketcdn-data` |
| Nginx config | `/etc/nginx/sites-available/rocketcdn` |
| PHP | 8.3-FPM |
| PHP socket expected | `/run/php/php8.3-fpm.sock` |
| Cron | `/etc/cron.d/rocketcdn` |
| TLS | Let's Encrypt / certbot |
| Site | `https://rocketcdn.ru` |

### Credential required

- private SSH credential, доступный как SSH agent/managed session;
- право пользователя `ubuntu` выполнять необходимые `sudo` команды;
- если прямой порт 22 недоступен из среды, уже авторизованный bastion/VPS bridge.

Не использовать `sshpass`, пароль в command line, base64 transfer секрета или приватный ключ внутри ZIP.

### Read-only access test

```bash
ssh -o BatchMode=yes -o ConnectTimeout=10 ubuntu@217.19.122.132 \
  'hostname; id; uname -a; test -d /var/www/rocketcdn && echo SITE_DIR_OK'
```

Не запускать `env`, `printenv`, `cat config.local.php` или команды, выводящие секреты.

### Read-only production inventory

```bash
ssh ubuntu@217.19.122.132 '
  sudo -n nginx -t &&
  systemctl is-active nginx php8.3-fpm &&
  stat -c "%U:%G %a %n" /var/www/rocketcdn /var/www/rocketcdn-data &&
  find /var/www/rocketcdn -type f -printf "%P\n" | sort
'
```

Для конфигурации проверять только наличие требуемых keys отдельным server-side script, возвращающим `present/missing`, но не values.

### Backup перед deploy

Код и живые данные резервируются отдельно. Не складывать `config.local.php` в передаваемый archive.

Минимальная схема:

1. snapshot текущего `/var/www/rocketcdn` на сервере;
2. snapshot `/var/www/rocketcdn-data`;
3. записать timestamp и deployed commit SHA;
4. проверить, что backup читается;
5. только затем распаковывать новую версию.

### Deploy

Передавать только `rocketcdn/` без `data/`, `config.local.php`, log и локальных временных файлов.

Безопасный шаблон:

```bash
rsync -az --delete \
  --exclude data/ \
  --exclude config.local.php \
  --exclude '*.log' \
  ./rocketcdn/ ubuntu@217.19.122.132:/tmp/rocketcdn-release/
```

Дальше на VPS:

1. сравнить release manifest;
2. сделать backup;
3. перенести code tree атомарно или через проверенную release directory;
4. сохранить внешний data dir и local config;
5. `nginx -t`;
6. reload, не blind restart;
7. smoke tests;
8. записать deployed SHA.

Не применять `rsync --delete` напрямую к `/var/www/rocketcdn`, пока не доказано, что живые данные и local config действительно находятся вне этой папки.

### Rollback

Rollback target должен быть выбран до deploy. Возврат включает code snapshot, но не откатывает новые заявки целиком. Данные объединяются/сохраняются отдельно.

---

## 4. Runtime configuration keys

### Обязательные секретные значения

| Key | Назначение | Кто выдаёт/где подключается | Проверка без вывода значения |
|---|---|---|---|
| `admin_key` | admin.html/admin API | владелец создаёт новый уникальный secret | login succeeds; default/empty rejected |
| `mail_pass` | Gmail app password | Google account owner после 2FA | test email succeeds |
| `tg_token` | Telegram bot token | `@BotFather` в авторизованной Telegram session | `getMe`/bot self-test succeeds |
| SSH credential | VPS login | server owner/SSH agent | BatchMode SSH succeeds |
| GitHub write auth | push/PR updates | GitHub app/connector owner | repo permission says push |

### Идентификаторы и настройки

| Key | Текущее/ожидаемое назначение |
|---|---|
| `site_url` | `https://rocketcdn.ru` |
| `lk_url` | `https://lk.rocketcdn.ru` |
| `mail_user` | Gmail sender account; production docs называют `forwardrocketcdn@gmail.com` |
| `mail_to` | inbox для заявок; подтвердить владельцем |
| `mail_name` | Rocket CDN |
| `tg_username` | `rocket_cdn_bot` |
| `tg_admins` | verified Telegram user IDs администраторов; значения не копировать из старого шаблона без проверки |
| `tg_chat` | записывается через `/bindchat` |
| `tg_ips` | optional Telegram IPv4 overrides |
| `tg_proxy` | optional curl proxy; может быть секретным URL, не выводить |
| `contest_active` | enable/disable contest |
| `contest_title` | display title |
| `contest_channel` | обязательный channel handle/id |
| `contest_channel_url` | public/private join URL |
| `contest_top_prizes` | count of winners |
| `lead_remind_hours` | reminder threshold |
| `report_hour` | daily report hour |
| `trusted_proxies` | exact proxy IP allowlist |
| `data_dir` | production должен указывать на подтверждённый external data path |

### Local config

Проект ожидает `rocketcdn/config.local.php`, исключённый Git. В production он создаётся только на сервере с правами `640` и владельцем/группой, позволяющими PHP читать, но не отдавать его веб-сервером.

Codex не должен копировать production config в локальную рабочую папку. Для тестов создаётся отдельный test config с фиктивными значениями и отключённой внешней отправкой.

---

## 5. Google/Gmail

Нужно:

- авторизованный владелец аккаунта;
- включённая 2FA;
- отдельный Gmail app password для SMTP;
- подтверждённые sender и recipient.

Доступ получается через ручную авторизацию владельца. Пароль приложения не передаётся Codex текстом; он подключается к production runtime. Обычный пароль Google не используется.

Smoke test: одно тестовое письмо на подтверждённый адрес через admin self-test; затем lead email владельцу и optional confirmation клиенту.

---

## 6. Telegram / BotFather

Нужно:

- авторизованная Telegram session владельца;
- бот `@rocket_cdn_bot`;
- новый/действующий bot token, подключённый production runtime;
- verified admin user IDs;
- права бота в общем чате и contest channel;
- menu button → `https://rocketcdn.ru/app.html`;
- `/bindchat` и `/bindtopic` mappings.

Нельзя выводить token или `bindings.json`. Проверка — `getMe`, `/start`, admin commands, test lead, mini app, two-account contest flow.

---

## 7. DNS и TLS

Нужна авторизованная session регистратора/DNS provider, если потребуется менять записи.

Проверить:

- apex и `www` ведут на правильный production origin;
- `lk` остаётся на владельце личного кабинета;
- HTTP→HTTPS;
- сертификат содержит apex и www;
- certbot renewal timer active;
- certificate private key никогда не копируется из `/etc/letsencrypt`.

22.08.2026 все три HTTPS host отвечали 200, что противоречит ранним notes в `DEPLOY.md`; сначала подтвердить правильность содержимого, затем обновить документацию.

---

## 8. GPT Image 2

### Получение доступа

Предпочтительный путь — уже авторизованная ChatGPT Work/ChatGPT browser session пользователя и встроенная image generation capability. API key в пакет не нужен.

Если сессия не авторизована, пользователь выполняет login вручную. Codex не принимает пароль/2FA code в чат.

### Harmless check

Проверить наличие image generation UI/model selection и доступность требуемого качества без запуска платной серии. Перед фактическими генерациями получить разрешение на количество вариантов.

### Производственный режим

- high/4K;
- detailed English prompt ≥2000 chars;
- 3–4 continuity refs;
- сохранить исходники в reference folder;
- runtime integration только после A/B approval.

---

## 9. Runway / Runvay

### Получение доступа

Использовать авторизованную browser session Runway. Если login wall — пользователь входит вручную; credentials/2FA не принимаются в чат.

Если сервис/план не даёт Gen-4.5, зафиксировать blocker и предложить Minimax как заранее разрешённый fallback, но не переключаться молча.

### Проверка

- account session active;
- доступна требуемая модель;
- видна quota/credit state;
- разрешены image references и нужный export;
- платная генерация не стартует без согласованного batch.

### Production output

Сохранять source download, MP4/WebM web transcodes, poster и prompt/provenance. Не использовать экранную запись UI как master.

---

## 10. ElevenLabs

### Получение доступа

Использовать уже авторизованную browser session ElevenLabs; при login wall пользователь входит вручную. API key в ZIP/Git не нужен.

### Проверка

- account/plan active;
- доступны нужные voice/SFX models;
- license допускает коммерческий сайт;
- quota понятна до запуска batch.

### Требуемые входные данные

- утверждённый voiceover text, если речь вообще нужна;
- voice owner/permission;
- scene-by-scene cue sheet;
- язык/тембр/скорость/эмоция;
- loudness target.

Без этих данных не генерировать случайную озвучку.

---

## 11. Агентные сессии

Codex может разделять работу, но доступы остаются capability-scoped:

- read-only auditor не получает production write;
- asset agent работает через browser session, не видит VPS config;
- deploy agent не получает AI account credential;
- единственный lead объединяет изменения.

Передать агенту можно alias переменной или факт `connected`, но не её значение.

---

## 12. Launch smoke sequence

После deploy:

1. `GET /`, `/app.html`, `/privacy.html`, `/offer.html`, `/admin.html`.
2. Desktop/mobile full visual path.
3. JS console/network/WebGL context.
4. RU/EN, dark/light.
5. Lead and callback.
6. Admin login/stats/leads/content/export/selftest.
7. Telegram `/start`, `/health`, `/stats`, lead notification.
8. Gmail owner/client messages.
9. Cron `--now` в controlled mode, report/backup.
10. DNS/TLS/cert days.
11. Live manifest vs release.
12. Rollback command готов, но не выполняется без необходимости.

<!-- END rocketcdn/CODEX_HANDOFF/ACCESS_RUNBOOK.md -->


---

<!-- BEGIN rocketcdn/CODEX_HANDOFF/LAUNCH_CHECKLIST.md -->

# Rocket CDN — безопасный launch-checklist

Статусы: `[x]` подтверждено этим аудитом; `[~]` было проверено раньше или реализовано, но требует повторной проверки; `[ ]` необходимо до launch.

## A. Уже готово/подтверждено

- [x] PR #7 открыт и mergeable.
- [x] Head snapshot зафиксирован: `a450e335432e58ca7d3037eaafd516d6a4547da9`.
- [x] Полный `rocketcdn/` включён в пакет.
- [x] Generated repo media, Library references и screenshots включены.
- [x] Live main HTML совпадает с head по SHA-256.
- [x] `rocketcdn/config.local.php` не отслеживается Git.
- [x] `rocketcdn/data/` не отслеживается Git.
- [x] `rocketcdn/.gitignore` исключает local config/data/log.
- [x] Собственные JS-файлы синтаксически корректны.
- [x] MP4/WebM/M4A читаются `ffprobe`.
- [x] P6G–P6L присутствуют в code/commit history.
- [x] `rocketcdn.ru`, `www.rocketcdn.ru`, `lk.rocketcdn.ru` отвечали HTTPS 200 на момент среза.
- [~] Исторический PR body сообщает об успешных PHP/API/Chromium тестах до последних P6-итераций.

## B. Можно закрыть прямо сейчас как документальную работу

- [x] Зафиксировать единый scope: только Rocket CDN.
- [x] Зафиксировать frozen visual requirements.
- [x] Зафиксировать один source branch/PR/head.
- [x] Отделить «код реализован» от «визуально принят».
- [x] Создать media inventory и reference contact sheets.
- [x] Создать access matrix без credential values.
- [x] Указать exact server paths, config key names и safe verification.
- [x] Зафиксировать, что Runway/GPT Image 2/ElevenLabs — offline production tools, а не runtime secrets сайта.
- [x] Запретить дальнейший scope creep до closure acceptance defects.

## C. P0 blockers — launch запрещён

- [ ] Отозвать/заменить все действующие credentials, которые могли находиться в публичном `secrets.env.b64` или Git history.
- [ ] Удалить active secret container из публичного branch process и закрыть повторное попадание secret-like files.
- [ ] Подтвердить GitHub write access для PR head.
- [ ] Подтвердить VPS SSH agent и `sudo` без вывода ключа/пароля.
- [ ] Подтвердить DNS ownership/session.
- [ ] Проверить production config наличием keys `present/missing`, не печатать values.
- [ ] Проверить, что `admin_key` не пустой и не repository default.
- [ ] Проверить Gmail app password и test delivery.
- [ ] Проверить bot token/admin IDs/chat bindings.
- [ ] Подтвердить `data_dir=/var/www/rocketcdn-data` либо фактический путь.
- [ ] Проверить production backup и restore sample.
- [ ] Сверить полный live asset manifest с head.
- [ ] Исправить PHP 8.2/8.3 discrepancy в nginx example.
- [ ] Обновить устаревшие DNS/lk notes в `DEPLOY.md` после подтверждения владельца.

## D. Visual launch-gate

Обязательные viewport минимум:

- [ ] 1920×1080 desktop Chrome.
- [ ] 1440×900 desktop Chrome/Safari equivalent.
- [ ] 1024×1366 tablet portrait.
- [ ] 390×844 mobile portrait.
- [ ] 360×800 low-width mobile.
- [ ] mobile landscape spot check.

На каждом:

- [ ] Загрузка без flash/black screen.
- [ ] Ракета видна и не подменяется другой моделью.
- [ ] Full forward scroll от первого экрана до игры.
- [ ] Full reverse scroll обратно до начала.
- [ ] Люк/тамбур/cabin transition физически непрерывен.
- [ ] Нет второго cockpit/duplicate layers.
- [ ] Window mask — граница HUD/контролов.
- [ ] Физический console занимает допустимую зону и не закрывает космос.
- [ ] HUD taps/clicks работают; background holograms не крадут events.
- [ ] Солнце, 8 планет и Луна имеют физические материалы, не выглядят окрашенными шарами.
- [ ] Млечный Путь/galactic filaments имеют реальную глубину.
- [ ] Asteroids не пересекают cockpit/planets неверно.
- [ ] Camera mass не создаёт рывков/укачивания.
- [ ] DOM/content не налезает на критическую геометрию.
- [ ] RU/EN не ломают композицию.
- [ ] Dark/light не делают cockpit/controls нечитаемыми.
- [ ] LOD сохраняет сюжет; 3D не исчезает на обычном mobile.
- [ ] True no-WebGL fallback остаётся функциональным.
- [ ] Нет console errors, WebGL loss и unhandled promises.

## E. Functional launch-gate

- [ ] Все PHP-файлы проходят `php -l` на PHP 8.3.
- [ ] API `track`, `lead`, `callback`.
- [ ] Invalid contact rejected.
- [ ] Honeypot rejected.
- [ ] Rate limiting/trusted proxy behavior.
- [ ] Admin default/empty password rejected.
- [ ] Admin login with runtime credential.
- [ ] Stats/leads/status/delete/export/content save/reset/errors/selftest.
- [ ] Lead visible in admin.
- [ ] Owner email arrives.
- [ ] Client confirmation arrives when email provided.
- [ ] Bot `/start`, `/help`, `/health`, `/stats`, `/leads`, `/report`.
- [ ] `/bindchat`, topics, fallback to admin DMs.
- [ ] Mini app menu button.
- [ ] Contest two-account referral test.
- [ ] Self-referral/duplicate rejected.
- [ ] Winner subscription recheck.
- [ ] Cron report/reminder/health/backup.
- [ ] Restore one backup in isolated test directory.

## F. AI/media launch-gate

- [ ] Создать asset registry для новых и критичных existing assets.
- [ ] Указать provenance/license для music/theme.
- [ ] Решить contradiction «zero audio files» vs current theme files.
- [ ] Утвердить, нужна ли ElevenLabs voiceover.
- [ ] Если нужна речь — получить финальный текст и permission на voice.
- [ ] Утвердить sound cue sheet.
- [ ] Проверить autoplay after gesture, mute, suspend on hidden.
- [ ] Проверить громкость на телефоне и в наушниках.
- [ ] Для новых GPT Image refs сохранить prompt ≥2000 chars и 3–4 continuity images.
- [ ] Для новых Runway clips сохранить input refs/prompt/master/transcodes/poster.
- [ ] Не использовать generated still как плоский основной 3D-мир.

## G. Performance/accessibility/SEO

- [ ] Record FPS/frame-time on all required devices.
- [ ] Record peak memory and WebGL context count.
- [ ] Simulate context loss and recovery/fallback.
- [ ] Slow 3G transition 70→80% no black frame.
- [ ] Fast scroll/end-to-start no unfinished state.
- [ ] `visibilitychange` pauses audio/render as designed.
- [ ] Keyboard path reaches native form without entering 3D controls.
- [ ] Visible focus, labels, autocomplete/inputmode.
- [ ] JavaScript disabled: all content visible and form usable.
- [ ] `prefers-reduced-motion`: accessible and coherent without removing essential story.
- [ ] Schema/FAQ matches visible current content.
- [ ] Sitemap/robots/OG/manifest correct on apex/www.

## H. Release/rollback

- [ ] Final commit SHA recorded.
- [ ] Code backup created/readable.
- [ ] Data backup created/readable.
- [ ] Release archive/manifest generated.
- [ ] Deploy excludes config/data/log.
- [ ] `nginx -t` passes.
- [ ] PHP-FPM/nginx/cron active.
- [ ] TLS certificate includes apex/www and renew timer active.
- [ ] Smoke sequence complete.
- [ ] Live manifest equals release.
- [ ] Rollback target and command recorded.
- [ ] PR body updated to current state.
- [ ] CI/status checks green or signed manual release report attached.
- [ ] Reviewer assigned.
- [ ] Только после этого снять draft.

## Go/No-Go

`GO` допустим только при нуле незакрытых P0, полном visual+functional gate и готовом rollback. Наличие красивого live-кадра само по себе не является launch approval.

<!-- END rocketcdn/CODEX_HANDOFF/LAUNCH_CHECKLIST.md -->


---

<!-- BEGIN rocketcdn/CODEX_HANDOFF/reports/MEDIA_INVENTORY.md -->

# Rocket CDN — media inventory

Контрольные суммы всех файлов находятся в `MEDIA_MANIFEST.sha256`.

## 1. Audio/video в репозитории

| Path | Bytes | Duration | Назначение/заметка |
|---|---:|---:|---|
| `rocketcdn/assets/audio/theme.m4a` | 593 334 | 72.000 s | музыкальная тема, AAC/M4A |
| `rocketcdn/assets/audio/theme.webm` | 525 529 | 72.008 s | музыкальная тема, WebM |
| `rocketcdn/assets/gen/cockpit-flight-mobile-v2.mp4` | 721 582 | 10.042 s | mobile cockpit flight |
| `rocketcdn/assets/gen/cockpit-flight-mobile-v2.webm` | 405 447 | 10.042 s | mobile cockpit flight |
| `rocketcdn/assets/gen/cockpit-flight-wide-v2.mp4` | 707 805 | 10.042 s | wide cockpit flight |
| `rocketcdn/assets/gen/cockpit-flight-wide-v2.webm` | 456 078 | 10.042 s | wide cockpit flight |
| `rocketcdn/assets/gen/console-640.mp4` | 373 176 | 6.133 s | compact console clip |
| `rocketcdn/assets/gen/console-640.webm` | 384 669 | 6.134 s | compact console clip |
| `rocketcdn/assets/gen/console-960.mp4` | 522 147 | 6.133 s | large console clip |
| `rocketcdn/assets/gen/space-earth.mp4` | 449 160 | 8.111 s | Earth background/fallback |
| `rocketcdn/assets/gen/space-earth.webm` | 379 321 | 8.112 s | Earth background/fallback |
| `rocketcdn/assets/gen/space-nebula.mp4` | 1 132 342 | 8.111 s | nebula background/fallback |
| `rocketcdn/assets/gen/space-nebula.webm` | 1 147 982 | 8.112 s | nebula background/fallback |

Все container headers прочитаны `ffprobe` без ошибки. Декодирование каждого полного кадра и browser playback всё равно входят в release QA.

## 2. Generated/runtime stills в репозитории

| Path | Dimensions | Bytes |
|---|---:|---:|
| `assets/gen/cockpit-flight-mobile-v2-poster.webp` | 720×1280 | 96 690 |
| `assets/gen/cockpit-flight-wide-v2-poster.webp` | 1280×720 | 107 828 |
| `assets/gen/cockpit-tall-v2.webp` | 941×1672 | 237 916 |
| `assets/gen/cockpit-tall.webp` | 768×1344 | 46 262 |
| `assets/gen/cockpit-wide-v2.webp` | 1672×941 | 263 988 |
| `assets/gen/cockpit-wide.webp` | 1344×768 | 155 292 |
| `assets/gen/console.webp` | 1344×768 | 32 246 |
| `assets/gen/dc-almaty.webp` | 1600×900 | 64 290 |
| `assets/gen/dc-moscow.webp` | 1600×900 | 59 078 |
| `assets/gen/dc-prague.webp` | 1600×900 | 83 434 |
| `assets/gen/og.jpg` | 1200×630 | 89 315 |
| `assets/gen/og.webp` | 1200×630 | 52 498 |

## 3. Space texture maps

| Path | Dimensions | Bytes |
|---|---:|---:|
| `assets/space/earth-day.jpg` | 4096×2048 | 1 461 877 |
| `assets/space/earth-day.webp` | 4096×2048 | 663 160 |
| `assets/space/earth-night.jpg` | 4096×2048 | 715 000 |
| `assets/space/earth-night.webp` | 4096×2048 | 270 284 |
| `assets/space/clouds.png` | 1024×512 | 260 222 |
| `assets/space/clouds.webp` | 1024×512 | 215 356 |
| `assets/space/moon.jpg` | 1024×512 | 238 093 |
| `assets/space/moon.webp` | 1024×512 | 227 430 |

## 4. Storyboard fallback

В `rocketcdn/assets/storyboard/` лежат `01.webp`–`08.webp`, каждый 1344×768. Суммарно они представляют восемь актов fallback: площадка, разгон, облака, орбита, продукты/спутники, вход в атмосферу, посадка, рубка.

## 5. Model-generated Library references

Folder: `references/generated-library/`.

- `Инженерная панель космического кокпита.png`
- `Кабина Rocket CDN: макросъёмка панели.png`
- `Кокпит звездолёта с Землёй и голограммами.png`
- `Панорамный кокпит ракеты над Землёй.png`
- `Панорамный космический кокпит над Землёй.png`
- `Подход к открытому люку космолёта.png`
- `Портретный кокпит с Землёй и Млечным Путём.png`
- `Финальный подход к креслу пилота.png`
- `Шаг в звёздную кабину.png`

Это production references. Они фиксируют physical gunmetal cabin, Earth/Milky Way view, аппаратные кнопки, recessed panels, люк/коридор и continuity камеры. Они не должны просто накладываться поверх основного 3D мира.

Contact sheet: `reports/generated-reference-contact-sheet.jpg`.

## 6. Mobile screenshots

Folder: `references/screenshots/`.

Включены пятнадцать снимков `Screenshot_20260822_14*.jpg`, показывающих:

- star systems/navigation menus;
- cockpit HUD и Earth/Milky Way target;
- mission/progress views;
- planet/map views;
- physical cabin transitions;
- landing/site CTA path;
- Rocket CDN main hero.

Contact sheet: `reports/live-screenshot-contact-sheet.jpg`.

## 7. Provenance gaps

Текущий repo не содержит надёжного production registry, который связывает каждый asset с prompt/model/seed/account/license. До новой генерации создать `ASSET_REGISTRY_TEMPLATE.md` → рабочий `ASSET_REGISTRY.md` и заполнять его при каждом accepted output.

<!-- END rocketcdn/CODEX_HANDOFF/reports/MEDIA_INVENTORY.md -->


---

<!-- BEGIN rocketcdn/CODEX_HANDOFF/reports/SOURCE_PROVENANCE.md -->

# Source provenance и результаты аудита

## Git source

- Repository: `gdeoko/OKO-TEAM`
- PR: `#7`
- Head branch: `claude/rocket-cdn-website-admin-x5482k`
- Base branch: `claude/adoring-tesla-fFKEd`
- Snapshot commit: `a450e335432e58ca7d3037eaafd516d6a4547da9`
- Commit title: `Rocket CDN: publish P6L planetary material marker`
- Snapshot time: 22.08.2026.
- Checkout method: public Git clone с partial/sparse checkout каталога `rocketcdn/`.
- `.git` directory не включён в пакет.

## PR metadata

- State: open.
- Draft: true.
- Mergeable: true.
- Commits: 184.
- Changed files: 133.
- Additions: 50 462.
- Deletions: 0.
- PR comments: none.
- Reviews: none.
- Review threads: none.
- Workflow runs for head: none.
- Combined status checks: none.

## Local snapshot checks

- `rocketcdn/`: 131 files, около 18 MiB.
- Все собственные JavaScript files проверены `node --check`: pass.
- Все MP4/WebM/M4A files проверены `ffprobe`: container headers pass.
- Типовые patterns private keys/GitHub/OpenAI/AWS/Google/Telegram tokens в `rocketcdn/` не найдены.
- `rocketcdn/config.local.php`: не tracked.
- `rocketcdn/data/`: не tracked.
- `.gitignore`: `config.local.php`, `data/`, `*.log`.

PHP CLI и Chromium в сборочном container отсутствовали, поэтому historical PHP/browser statements из PR не были повторно подтверждены после P6L.

## Live check

На момент проверки:

- `https://rocketcdn.ru/` → HTTP 200.
- `https://www.rocketcdn.ru/` → HTTP 200.
- `https://lk.rocketcdn.ru/` → HTTP 200.
- Live main HTML size: 88 045 bytes.
- Live main HTML SHA-256: `d0e012908ff81a55a0ccd9017f0a9ccf2e7a6fa4606ff1d634905d5e3a493880`.
- Head `rocketcdn/index.html` SHA-256: тот же.

Эта проверка подтверждает parity главного HTML, но не всех assets/runtime data.

## Library reference source

В `references/generated-library/` включены model-generated images, найденные среди файлов пользователя по Rocket CDN. В `references/screenshots/` включены мобильные screenshots от 22.08.2026, относящиеся к текущему состоянию интерфейса.

В пакет не включены:

- credentials;
- Library IDs и transfer metadata;
- временные download files;
- unrelated generated art;
- root `secrets.env.b64`;
- другие проекты монорепозитория.

## Security note

Репозиторий public и отслеживает корневой `secrets.env.b64`. Его содержимое не читалось и не копировалось. Base64 не является шифрованием; rotation/revocation связанных credentials указан как P0.

<!-- END rocketcdn/CODEX_HANDOFF/reports/SOURCE_PROVENANCE.md -->


---

<!-- BEGIN rocketcdn/CODEX_HANDOFF/reports/ASSET_REGISTRY_TEMPLATE.md -->

# Rocket CDN — asset registry template

Создать копию этого файла как `ASSET_REGISTRY.md` и вести только для Rocket CDN. Secret/account credential values сюда не записывать.

| ID | Web/source path | Type | Service/model | Created | Prompt file | Input refs | Seed/job ID (non-secret) | Aspect/resolution/duration | License/rights | Integration mode | Status | Replaced by | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| RC-EXAMPLE-001 | — | image/video/audio/texture | — | YYYY-MM-DD | prompts/...md | RC-REF-... | — | — | — | WebGL material / fallback / poster / SFX | reference | — | — |

## Status vocabulary

- `reference` — только визуальный/звуковой ориентир.
- `approved-source` — выбранный production master.
- `web-export` — оптимизированный runtime file.
- `integrated` — подключён в code и прошёл QA.
- `rejected` — не использовать.
- `superseded` — заменён новым ID.

## Integration modes

- `geometry-reference`
- `material-reference`
- `texture-map`
- `WebGL-video-texture`
- `fallback-video`
- `fallback-still`
- `poster`
- `OpenGraph`
- `music`
- `SFX`
- `voiceover`

## Required acceptance fields

Для `integrated` в Notes указать:

- A/B evidence path;
- viewport/device list;
- performance result;
- continuity result;
- license confirmation;
- reviewer/date.

<!-- END rocketcdn/CODEX_HANDOFF/reports/ASSET_REGISTRY_TEMPLATE.md -->


---

<!-- BEGIN rocketcdn/CODEX_HANDOFF/PACKAGE_FROM_GITHUB.md -->

# Full Rocket CDN package stored in this branch

The complete handoff ZIP is stored as numbered binary parts in:

`rocketcdn/CODEX_HANDOFF/package-parts/`

Expected archive:

- name: `RocketCDN_Codex_Package_2026-08-22.zip`
- SHA-256: `b19fcced34d9ff42c86fa318698b87a0cea69394e162b69d38f75a67e266f680`
- size: `39,731,625` bytes

## Linux / macOS

```bash
git clone --branch codex/rocketcdn-handoff-20260822 --single-branch https://github.com/gdeoko/OKO-TEAM.git
cd OKO-TEAM/rocketcdn/CODEX_HANDOFF/package-parts
cat RocketCDN_Codex_Package_2026-08-22.zip.part-* > ../RocketCDN_Codex_Package_2026-08-22.zip
cd ..
printf '%s  %s\n' 'b19fcced34d9ff42c86fa318698b87a0cea69394e162b69d38f75a67e266f680' 'RocketCDN_Codex_Package_2026-08-22.zip' | sha256sum -c -
unzip -q RocketCDN_Codex_Package_2026-08-22.zip
```

On macOS, if `sha256sum` is unavailable:

```bash
test "$(shasum -a 256 RocketCDN_Codex_Package_2026-08-22.zip | awk '{print $1}')" = 'b19fcced34d9ff42c86fa318698b87a0cea69394e162b69d38f75a67e266f680'
```

## Windows PowerShell

```powershell
git clone --branch codex/rocketcdn-handoff-20260822 --single-branch https://github.com/gdeoko/OKO-TEAM.git
Set-Location OKO-TEAM\rocketcdn\CODEX_HANDOFF\package-parts
$output = [System.IO.File]::Create((Join-Path (Split-Path (Get-Location) -Parent) 'RocketCDN_Codex_Package_2026-08-22.zip'))
try {
  Get-ChildItem 'RocketCDN_Codex_Package_2026-08-22.zip.part-*' |
    Sort-Object Name |
    ForEach-Object {
      $input = [System.IO.File]::OpenRead($_.FullName)
      try { $input.CopyTo($output) } finally { $input.Dispose() }
    }
} finally { $output.Dispose() }
Set-Location ..
$hash = (Get-FileHash .\RocketCDN_Codex_Package_2026-08-22.zip -Algorithm SHA256).Hash.ToLower()
if ($hash -ne 'b19fcced34d9ff42c86fa318698b87a0cea69394e162b69d38f75a67e266f680') { throw "SHA-256 mismatch: $hash" }
Expand-Archive .\RocketCDN_Codex_Package_2026-08-22.zip -DestinationPath .
```

## Important

The package intentionally contains no secret values, private keys, passwords, session cookies, or live tokens. It contains the exact variable names, public endpoints, account identifiers, paths, validation commands, and procedures needed to obtain or inject secrets through the authorized service account or secret store.

<!-- END rocketcdn/CODEX_HANDOFF/PACKAGE_FROM_GITHUB.md -->
