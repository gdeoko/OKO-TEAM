# Скиллы Claude Code проекта OKO TEAM

Установлены из топовых open-source библиотек (лицензии Apache-2.0 / MIT — файлы
лицензий лежат в папках скиллов). Работают автоматически в любом чате
Claude Code, открытом на ветке, где есть эта папка — после мерджа в main
подхватываются во всех новых ветках и сессиях.

## Источники (топ по звёздам GitHub, июль 2026)

| # | Источник | ⭐ | Что взяли | Зачем |
|---|---|---|---|---|
| 1 | [anthropics/skills](https://github.com/anthropics/skills) — официальные скиллы Anthropic | ~149k | `frontend-design`, `web-artifacts-builder`, `webapp-testing`, `skill-creator` | Крутые сайты клиентам без «ИИ-шаблонности»; проверка вёрстки в headless-браузере; создание собственных скиллов OKO |
| 2 | [multica-ai/andrej-karpathy-skills](https://github.com/multica-ai/andrej-karpathy-skills) | ~144k | `karpathy-guidelines` | Поведенческие правила против типовых ошибок LLM: не выдумывать, не раздувать код, не трогать чужое |
| 3 | [obra/superpowers](https://github.com/obra/superpowers) (Jesse Vincent) | ~94k | `brainstorming`, `writing-plans`, `executing-plans`, `test-driven-development`, `systematic-debugging`, `verification-before-completion` | Дисциплина масштабных сборок: идея → спека → план → TDD → проверка перед сдачей |
| 4 | [expo/skills](https://github.com/expo/skills) — официальные скиллы Expo | оф. Expo | `expo-ui`, `native-data-fetching`, `expo-deployment`, `upgrading-expo` | Ядро приложения OKO — React Native + Expo: UI, данные, деплой в сторы, апгрейды SDK |
| 5 | [VoltAgent/awesome-agent-skills](https://github.com/VoltAgent/awesome-agent-skills) | ~20k | каталог-справочник (1000+ скиллов) | Не ставится — используем как поисковик, когда нужен скилл под новую задачу |

## Как пользоваться

Ничего вызывать не нужно — Claude сам подключает скилл, когда задача подходит
под его описание. Принудительно: «используй скилл frontend-design» в сообщении.

## Обновление

Скиллы завендорены (скопированы) намеренно: версия зафиксирована, ничего не
тянется из сети при старте. Обновить = склонировать репо-источник и
перекопировать папку скилла.
