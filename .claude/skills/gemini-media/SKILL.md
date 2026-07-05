---
name: gemini-media
description: Генерация картинок (nano banana / gemini-2.5-flash-image) и текста через Gemini API для сборок приложений и сайтов OKO TEAM. Используй, когда нужны обложки уроков, иллюстрации, баннеры, ассеты интерфейса или быстрый текст от Gemini. Ключ берётся из переменной окружения GEMINI_API_KEY (настроена в cloud environment, в git не хранится).
---

# Gemini Media — картинки и текст для сборок OKO TEAM

## Ключ

Ключ лежит в переменной окружения `GEMINI_API_KEY` (задаётся в настройках
cloud environment «OKO TEAM», НЕ в репозитории). Если переменная пуста —
попроси Даниэля добавить строку `GEMINI_API_KEY=AQ....` в Environment
variables окружения и перезапустить сессию.

Проверка: `test -n "$GEMINI_API_KEY" && echo OK`

## Генерация картинки

```bash
.claude/skills/gemini-media/scripts/gen-image.sh "промпт" выход.png
```

- Модель: `gemini-2.5-flash-image`. ТРЕБУЕТ включённого биллинга в
  Google AI Studio (на free tier лимит картинок = 0, вернётся 429).
- Промпт пиши подробно: сюжет, стиль, палитру (для Метанойи:
  navy #1A3A52, terracotta #C97064, gold #D4A574, cream #FAF8F5),
  соотношение сторон, «без текста» если текст не нужен.
- При 429 «limit: 0» — биллинг не включён; сообщи об этом и предложи
  альтернативу (Higgsfield generate_image, если подключён).

## Генерация текста

```bash
.claude/skills/gemini-media/scripts/gen-text.sh "вопрос"
```

Модель `gemini-flash-latest`, работает на бесплатном тарифе.

## Правила

- НИКОГДА не коммить ключ и не выводи его в логи/чаты целиком.
- Сгенерированные ассеты клади в проект (например,
  metanoia-app/public_html/assets/img/) и оптимизируй размер.
- Видео (Veo) через этот же API платное; для видео сначала предложи
  Higgsfield.
