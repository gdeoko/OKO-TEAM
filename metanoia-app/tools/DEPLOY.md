# МЕТАНОЙА — build & deploy runbook (для автономных сессий OKO TEAM)

ПРАВИЛО 7: ни в одном выпускаемом артефакте (HTML/JS/CSS/комментарии/презентация)
НЕ должно быть упоминаний ИИ/нейросети/Claude/GPT/сгенерировано/движков озвучки и т.п.
Всё — работа «OKO TEAM». Перед деплоем: grep по этим словам должен быть пустым.

## Ветка
Разработка: `claude/metanoya-github-setup-15oovz` (app-репозиторий, git http header token в окружении CCR).

## Собрать standalone
    node metanoia-app/tools/build-standalone.cjs /tmp/build.html
Проверить: "leftover 0". Открыть в Playwright (chromium /opt/pw-browsers/chromium, playwright-core),
прогнать по экранам, убедиться "ERRORS: NONE".

## Задеплоить на живой линк (Higgsfield)
website_id: 0ce3bb7a-55e3-425c-ac28-8d5e5514903d ; live: https://nimble-bean-709.higgsfield.app
1. website_repo_access(website_id) → получить repo_url + свежий token + branch main.
2. Свежий клон в /tmp: git clone (с http.extraHeader "Authorization: token <token>").
   git config user.email/name. Скопировать собранный HTML → app/src/progress-page.html.
   git add + commit + push origin main (одним чистым коммитом; при обрыве — reset origin к рабочему коммиту и повторить).
3. Проверить архив: curl .../api/v1/repos/.../archive/<sha>.tar.gz → должен быть 200 (если 500 — хост чинит архивацию, подождать/повторить).
4. deploy_website(website_id). Проверить website_status → "deployed". Проверить живой линк curl'ом.
ВАЖНО: держать progress-page.html < ~3.6MB (иначе git-хост роняет архив). Аудио 24-32k mono, картинки q7/≤560px.

## Что улучшать (приоритеты автономной шлифовки)
Визуал/адаптив (320-430px + тёмная тема), функционал (каждая кнопка/игра/форма),
логика/навигация (стрелки «назад»), контент (стихи/уроки/книга), доступность,
маркетинг (лендинг-экран, онбординг, шеринг), производительность. Без бэкенда:
звонки/запись/транскрибация/платежи/аккаунты/админка — только демо-заглушки (не выдавать за реальные).
