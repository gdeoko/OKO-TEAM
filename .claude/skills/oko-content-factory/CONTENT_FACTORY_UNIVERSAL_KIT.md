# КОНТЕНТ-ЗАВОД — УНИВЕРСАЛЬНЫЙ КИТ v1.0
# Полная документация для запуска автоматизированного производства видео-контента на любом проекте

---

## ОГЛАВЛЕНИЕ

0. [Быстрый старт](#0-быстрый-старт)
1. [Философия и жёсткие законы](#1-философия-и-жёсткие-законы)
2. [Архитектура пайплайна](#2-архитектура-пайплайна)
3. [Окружение и зависимости](#3-окружение-и-зависимости)
4. [Секреты и API-ключи (переменные)](#4-секреты-и-api-ключи)
5. [MCP-коннекторы (50+)](#5-mcp-коннекторы)
6. [Скиллы (45+)](#6-скиллы)
7. [Озвучка (edge-tts, все языки мира)](#7-озвучка)
8. [Футаж и стоковое видео](#8-футаж-и-стоковое-видео)
9. [Генерация изображений](#9-генерация-изображений)
10. [3D, WebGL, Spine, Lottie, Rive](#10-3d-webgl-spine-lottie-rive)
11. [Монтаж FFmpeg — полные рецепты](#11-монтаж-ffmpeg)
12. [Оверлеи и анимации (anim.js, 34+ компонента)](#12-оверлеи-и-анимации)
13. [Маски и формы вставок (15+ форм)](#13-маски-и-формы-вставок)
14. [Лейауты размещения (6 схем)](#14-лейауты-размещения)
15. [Переходы (xfade 24+ типа, gl-transitions 125)](#15-переходы)
16. [Субтитры (караоке ASS)](#16-субтитры)
17. [Музыка и звуковые эффекты](#17-музыка-и-звуковые-эффекты)
18. [Анализ конкурентов (recon)](#18-анализ-конкурентов)
19. [Humanizer и полировка сценария](#19-humanizer-и-полировка)
20. [Система разнообразия (3 закона + матрица)](#20-система-разнообразия)
21. [Квота и пейсинг](#21-квота-и-пейсинг)
22. [Публикация (3 соцсети + расширение)](#22-публикация)
23. [Аналитика и отчёты](#23-аналитика-и-отчёты)
24. [QC — контроль качества](#24-qc-контроль-качества)
25. [Remotion Framework](#25-remotion-framework)
26. [Motion UI (React/Next.js)](#26-motion-ui)
27. [Web-эффекты арсенал](#27-web-эффекты-арсенал)
28. [Cron и автопилот](#28-cron-и-автопилот)
29. [Telegram-бот уведомления](#29-telegram-бот)
30. [VPS браузер-агент](#30-vps-браузер-агент)
31. [Хостинг и деплой](#31-хостинг-и-деплой)
32. [Онбординг нового клиента](#32-онбординг-нового-клиента)
33. [Чеклист Definition of Done](#33-чеклист-definition-of-done)
34. [Известные ограничения и обходы](#34-известные-ограничения)
35. [Полный файловый стандарт](#35-файловый-стандарт)

---

## 0. БЫСТРЫЙ СТАРТ

```
# 1. Создать ветку проекта
git checkout -b <project>.app

# 2. Структура каталогов
mkdir -p factory/{work,scripts/queue,aud_sfx,assets/{fonts,shapes,covers}}
mkdir -p factory/analysis

# 3. Настроить brand_profile.json (см. §32)

# 4. Запустить среду
bash factory/setup_env.sh

# 5. Первый ролик вручную
python3 factory/gen_scripts.py topup 3
bash factory/auto_run.sh <id> "<caption>" "<yt_title>"

# 6. Автопилот (cron trigger каждый час)
# Настроить через Claude Code Remote create_trigger
```

---

## 1. ФИЛОСОФИЯ И ЖЁСТКИЕ ЗАКОНЫ

### Закон #0 — Честность
Бот НИКОГДА не врёт о результатах. Не выдаёт шаблон за реальный ролик. Не отчитывается
об успехе, если была ошибка. Каждый отчёт — проверяемый факт.

### 10 жёстких законов производства

| # | Закон | Описание |
|---|-------|----------|
| 1 | Уникальность | Каждый ролик — уникальная комбинация футажа, озвучки, оверлеев |
| 2 | Ноль повторов | gen_ledger.json + publisher guard + generator fresh IDs = тройная защита от дублей |
| 3 | Ноль статики | Каждый кадр содержит движение: видео, анимация, переход |
| 4 | Каденция 3 сек | Новый визуальный элемент каждые ≤3 секунды |
| 5 | Лицо не закрывать | Оверлеи НЕ перекрывают лица в кадре |
| 6 | Контраст = затемнение видео | Не карточки поверх, а dimming видео + текст |
| 7 | Микс форматов | Чередовать маски, лейауты, типы оверлеев |
| 8 | Аудио-синхрон | Оверлеи привязаны к таймингам озвучки (WordBoundary) |
| 9 | Бренд-консистентность | Шрифты, цвета, водяной знак — из brand_profile |
| 10 | Проверка перед публикацией | ffprobe валидация + визуальный QC перед отправкой |

### 5 этапов производства

```
1. АНАЛИЗ КОНКУРЕНТОВ → recon.py/recon_deep.py
2. СЦЕНАРИЙ → gen_scripts.py + script_polish.py (humanizer + хук + виральность)
3. СБОРКА → voice → footage → overlays → build (ffmpeg) → subtitles → audit
4. ПУБЛИКАЦИЯ → TikTok + YouTube Shorts + Instagram Reels
5. ОТЧЁТ → аналитика + Telegram-бот + daily_state.json
```

---

## 2. АРХИТЕКТУРА ПАЙПЛАЙНА

### Поток данных

```
brand_profile.json
       │
       ▼
  ┌──────────┐     ┌───────────┐     ┌──────────┐
  │ recon.py  │────▶│gen_scripts│────▶│ polish   │
  │(конкуренты)│    │  .py      │     │(humanizer│
  └──────────┘     └───────────┘     │ +хук)    │
                                      └────┬─────┘
                                           │
                   scripts/<id>.json       │
                          │◀───────────────┘
                          ▼
              ┌─────────────────────┐
              │     auto_run.sh     │
              │  ┌───────────────┐  │
              │  │ 1. edge-tts   │  │  → voice.mp3 + word timings
              │  │ 2. fetch_clip │  │  → stock 4K clips (Pexels/Pixabay)
              │  │ 3. render_ov  │  │  → overlay webm (alpha channel)
              │  │ 4. make_reel  │  │  → ffmpeg concat + xfade + overlays
              │  │ 5. gen_subs   │  │  → ASS karaoke subtitles
              │  │ 6. add_music  │  │  → background music + ducking
              │  │ 7. qc.py      │  │  → quality check
              │  └───────────────┘  │
              │         │           │
              │         ▼           │
              │   work/<id>.mp4     │
              └─────────┬───────────┘
                        │
              ┌─────────▼───────────┐
              │     publish.sh      │
              │  TikTok (Hooppy)    │
              │  YouTube (Data API) │
              │  Instagram (VPS)    │
              └─────────────────────┘
```

### Модель сценария (scripts/<id>.json)

```json
{
  "id": "gspy_fitness_001",
  "app": "spy",
  "lang": "ru",
  "voice": "ru-RU-DmitryNeural",
  "yt_title": "Шпионские фитнес-гаджеты 🕵️ #shorts",
  "caption": "Топ фитнес-приложения которые следят за тобой",
  "cta": {"text": "Скачай приложение", "url": "https://..."},
  "hook": "Твой фитнес-браслет знает о тебе БОЛЬШЕ, чем ты думаешь",
  "virality_score": 8.2,
  "beats": [
    {
      "text": "Твой фитнес-браслет знает о тебе больше чем ты думаешь",
      "visual": "gym tech closeup",
      "overlay": "kicker",
      "overlay_data": {"label": "ФАКТ", "text": "97% данных продаётся"},
      "insert": "hexagon",
      "duration_hint": 4
    },
    {
      "text": "Каждый шаг каждый удар сердца — всё записывается",
      "visual": "running smartwatch",
      "overlay": "stat_count",
      "overlay_data": {"value": "10 000", "label": "шагов/день"},
      "duration_hint": 3
    }
  ],
  "music_mood": "tense electronic",
  "sfx_map": {"0": "impact", "1": "data"}
}
```

### SHOT-LIST формат (альтернативный)

```json
{
  "shots": [
    {"text": "...", "query": "search query for stock", "mask": "hexagon", "ov": "stat_count", "ov_data": {...}},
    {"text": "...", "query": "...", "mask": "circle", "ov": "kicker", "ov_data": {...}}
  ]
}
```

---

## 3. ОКРУЖЕНИЕ И ЗАВИСИМОСТИ

### setup_env.sh — холодный старт

```bash
#!/usr/bin/env bash
set -uo pipefail
cd "$(dirname "$0")" || exit 1
ok=1

# 1) секреты из base64-файла
if [ -f ../../secrets.env.b64 ]; then
  source <(base64 -d ../../secrets.env.b64) 2>/dev/null && echo "secrets READY"
else
  echo "secrets MISSING"; ok=0
fi

# 2) CA-сертификат для HTTPS через прокси (если Claude Code Remote)
CA=/root/.ccr/ca-bundle.crt
if [ -f "$CA" ]; then
  CB="$(python3 -m certifi 2>/dev/null)"
  if [ -n "$CB" ] && ! grep -q "$(head -c 60 "$CA" | tail -c 40)" "$CB" 2>/dev/null; then
    cat "$CA" >> "$CB" 2>/dev/null
  fi
  echo "ca READY"
fi

# 3) Python-зависимости
need_pip=""
python3 -c "import edge_tts" 2>/dev/null || need_pip="$need_pip edge-tts"
python3 -c "import PIL" 2>/dev/null || need_pip="$need_pip pillow"
python3 -c "import playwright" 2>/dev/null || need_pip="$need_pip playwright"
python3 -c "import yt_dlp" 2>/dev/null || need_pip="$need_pip yt-dlp"
python3 -c "import gradio_client" 2>/dev/null || need_pip="$need_pip gradio_client"
if [ -n "$need_pip" ]; then
  timeout 360 pip3 install -q --break-system-packages $need_pip 2>&1 | tail -1
fi
python3 -c "import edge_tts,PIL,playwright,yt_dlp" 2>/dev/null && echo "pydeps READY" || { echo "pydeps NOT-READY"; ok=0; }

# 4) ffmpeg
command -v ffmpeg >/dev/null 2>&1 && echo "ffmpeg READY" || { echo "ffmpeg MISSING"; ok=0; }

# 5) Chromium (предустановлен; НЕ качать через playwright install)
CHROME="$(ls /opt/pw-browsers/chromium-*/chrome-linux/chrome 2>/dev/null | head -1)"
[ -n "$CHROME" ] && echo "chromium READY $CHROME" || { echo "chromium MISSING"; ok=0; }

# 6) ассеты (шрифты, формы, sfx)
[ -d assets/fonts ] && echo "fonts READY" || echo "fonts MISSING"
[ -d assets/shapes ] && echo "shapes READY" || echo "shapes MISSING"
[ -f aud_sfx/_pool.json ] && echo "sfx READY" || echo "sfx MISSING"

echo "ENV $([ $ok -eq 1 ] && echo READY || echo NOT-READY)"
[ $ok -eq 1 ]
```

### Системные зависимости

| Компонент | Установка | Назначение |
|-----------|-----------|------------|
| Python 3.10+ | системный | скрипты пайплайна |
| ffmpeg 6+ | `apt install ffmpeg` | сборка видео, аудио, субтитры |
| Chromium | предустановлен в /opt/pw-browsers/ | рендер оверлеев (headless) |
| Node.js 20+ | системный | Remotion, anim.js |
| edge-tts | `pip install edge-tts` | озвучка (бесплатно, все языки) |
| Pillow | `pip install pillow` | обработка изображений |
| playwright | `pip install playwright` | автоматизация браузера |
| yt-dlp | `pip install yt-dlp` | скачивание видео |
| gradio_client | `pip install gradio_client` | генерация через HF Spaces |
| patchright | на VPS | стелс-браузер для Instagram |

### Переменные окружения (системные)

```
HTTPS_PROXY       — прокси для исходящих HTTPS (Claude Code Remote)
CURL_CA_BUNDLE    — путь к CA-bundle (/root/.ccr/ca-bundle.crt)
PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers
PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
```

---

## 4. СЕКРЕТЫ И API-КЛЮЧИ

**ВАЖНО: значения ключей НИКОГДА не вписывать в код, коммиты, артефакты, браузер.
Хранятся в `secrets.env.b64` (base64), автозагружаются хуком.**

### Таблица переменных

| Переменная | Сервис | Для чего |
|------------|--------|----------|
| `HF_TOKEN` | Hugging Face | API доступ к моделям/spaces |
| `PEXELS_API_KEY` | Pexels | 4K стоковое видео (бесплатно) |
| `PIXABAY_API_KEY` | Pixabay | 4K стоковое видео (бесплатно) |
| `FAL_KEY` | Fal.ai | AI генерация изображений/видео |
| `SKETCHFAB_API_TOKEN` | Sketchfab | 3D модели |
| `FREESOUND_CLIENT_ID` | Freesound | звуковые эффекты |
| `FREESOUND_API_KEY` | Freesound | звуковые эффекты |
| `TWENTY_FIRST_API_KEY` | 21st.dev | UI компоненты |
| `CLOUDFLARE_API_TOKEN` | Cloudflare | CDN/DNS |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare | CDN/DNS |
| `GEMINI_API_KEY` | Google Gemini | генерация текста/изображений |
| `GEMINI_API_KEY_2` | Google Gemini | запасной ключ |
| `GEMINI_API_KEY_3` | Google Gemini | запасной ключ |
| `ANTHROPIC_API_KEY` | Claude API | AI текст |
| `SUPABASE_PAT` | Supabase | база данных (Management API) |
| `TELEGRAM_BOT_TOKEN` | Telegram | уведомления бота |
| `S3_ACCESS_KEY` | S3 (twcstorage) | хранилище медиа |
| `S3_SECRET_KEY` | S3 (twcstorage) | хранилище медиа |
| `HOOPPY_API_TOKEN` | Hooppy | публикация TikTok |
| `OKO_VPS_CTRL_URL` | VPS агент | управление браузер-агентом |
| `OKO_VPS_CTRL_TOKEN` | VPS агент | аутентификация VPS |

### S3 хранилище

```
Endpoint: https://s3.twcstorage.ru
Бакеты:
  - <project>-media   — постоянное хранение (видео, обложки)
  - <project>-tmp     — временные файлы (lifecycle 24ч)
```

### Hooppy API (TikTok публикация)

```
Base URL: https://api.hooppy.com
Авторизация: Bearer $HOOPPY_API_TOKEN
Эндпоинты:
  POST /tiktok/post          — создать пост
  GET  /tiktok/post/{id}     — статус поста
  POST /tiktok/connect       — подключить аккаунт

# Для каждого клиента создаётся page_id в Hooppy:
HOOPPY_PAGE_ID_<CLIENT>=<number>
```

### YouTube Data API v3

```
# Загрузка Shorts через OAuth
# Токены хранятся в yt_tokens_<client>.json
# Refresh через google API, access_token обновляется автоматически

YOUTUBE_CHANNEL_ID_<CLIENT>=UC...
```

### Загрузка секретов

```bash
# Автоматически (хук SessionStart):
source <(base64 -d secrets.env.b64)

# Ручная загрузка:
source <(base64 -d ../../secrets.env.b64) 2>/dev/null

# Добавление нового ключа (append-only, несколько чатов параллельно):
echo 'export NEW_KEY="value"' | base64 >> secrets.env.b64
```

---

## 5. MCP-КОННЕКТОРЫ

### Основные (подключены)

| # | Коннектор | Назначение в контент-заводе |
|---|-----------|---------------------------|
| 1 | **Higgsfield** | AI генерация видео/изображений/3D, Nano Banana Pro обложки, virality predictor, хостинг сайтов |
| 2 | **Hugging Face** | FLUX генерация, Spaces (градиенты), модели |
| 3 | **GitHub** | PR, issues, code search, CI/CD |
| 4 | **Gmail** | email уведомления, рассылки |
| 5 | **Figma** | дизайн UI, прототипы, экспорт ассетов |
| 6 | **Canva** | шаблоны дизайна, social media graphics |
| 7 | **Adobe** | Photoshop API, Express, PDF |
| 8 | **Magic Patterns** | UI компоненты, дизайн-системы |
| 9 | **Zapier** | 9000+ интеграций, автоматизации |
| 10 | **Zoom** | записи встреч, транскрипты |
| 11 | **Claude Code Remote** | send_later, triggers, sessions |
| 12 | **Descript** | редактирование видео/аудио по тексту |

### Дополнительные MCP-серверы

| Коннектор | Инструменты |
|-----------|-------------|
| **Brandfetch** | brand_search, get_brand, build_logo_urls, get_asset_base64 |
| **Shutterstock** | search (стоковые фото/видео) |
| **MIND** | 3D генерация, текстуры, анимации |

### Higgsfield — ключевые инструменты

```
generate_image       — AI генерация изображений
generate_video       — AI генерация видео
generate_3d          — изображение → 3D GLB mesh
generate_audio       — AI генерация аудио
upscale_image        — апскейл до 2K/4K
upscale_video        — апскейл видео
remove_background    — удаление фона
reframe              — смена aspect ratio
virality_predictor   — предсказание виральности
deploy_website       — деплой сайта
explainer_video      — объяснительное видео
dubbing              — дубляж
voice_change         — смена голоса
motion_control       — puppeteer/motion transfer
create_voice         — создание голоса
shorts_studio_*      — студия shorts
```

### Zapier — 9000+ приложений

```
# Поиск действий:
discover_zapier_actions({ app: "название_приложения" })

# Включение действия:
enable_zapier_action({ selected_api: "...", action: "..." })

# Выполнение:
execute_zapier_write_action({ tool_name: "...", params: {...} })
execute_zapier_read_action({ tool_name: "...", params: {...} })

# Популярные интеграции для контент-завода:
- Slack → уведомления команде
- Google Sheets → отчёты в таблицу
- Airtable → база контента
- Notion → документация
- Trello → задачи
- Mailchimp → рассылки
- Buffer/Hootsuite → планирование постов
- Google Analytics → трафик
```

### Claude Code Remote — расписание и триггеры

```python
# Создание cron-триггера (каждый час 06-20 UTC):
create_trigger(
    name="<project>-autopilot",
    prompt="bash factory/cron_once.sh",
    cron_expression="0 6-20 * * *"  # UTC
)

# Одноразовый триггер:
send_later(message="...", delay_minutes=90)

# Подписка на PR:
subscribe_pr_activity(owner="...", repo="...", pullNumber=123)
```

---

## 6. СКИЛЛЫ (45+)

### Производственные скиллы

| Скилл | Файл | Назначение |
|-------|------|------------|
| `/oko-magic` | .claude/skills/oko-magic/SKILL.md | Главный продакшн: генерация, 3D, деплой |
| `/oko-content-factory` | .claude/skills/oko-content-factory/SKILL.md | Полный пайплайн контент-завода |
| `/social-autopilot` | .claude/skills/social-autopilot/ | Оркестратор соцсетей |
| `/remotion-video` | .claude/skills/remotion-video/SKILL.md | Remotion framework для видео |
| `/gemini-media` | .claude/skills/gemini-media/SKILL.md | Генерация через Gemini |
| `/web-fx` | .claude/skills/web-fx/SKILL.md | Веб-эффекты арсенал |
| `/motion-ui` | .claude/skills/motion-ui/SKILL.md | Motion System v4.2 |

### Справочные документы

| Документ | Путь | Содержание |
|----------|------|------------|
| PRODUCTION_BIBLE | social-autopilot/PRODUCTION_BIBLE.md | 10 законов, 5 этапов, diversity matrix |
| MOTION_ARSENAL | oko-content-factory/reference/MOTION_ARSENAL.md | Все формы, лейауты, компоненты, звук |
| IMPLEMENTATION | oko-content-factory/reference/IMPLEMENTATION.md | Runbook, рецепты публикации |

---

## 7. ОЗВУЧКА (EDGE-TTS)

### Библиотека — БЕСПЛАТНО, все языки мира

edge-tts использует Microsoft Azure Neural TTS. Бесплатно, без ключей, без лимитов.
Поддерживает WordBoundary — точные тайминги каждого слова для синхронизации оверлеев.

### Рецепт генерации

```python
import edge_tts, asyncio, json

async def generate_voice(text, voice, output_mp3, output_json):
    comm = edge_tts.Communicate(text, voice, rate="+0%", pitch="+0Hz")
    words = []
    with open(output_mp3, "wb") as f:
        async for chunk in comm.stream():
            if chunk["type"] == "audio":
                f.write(chunk["data"])
            elif chunk["type"] == "WordBoundary":
                words.append({
                    "word": chunk["text"],
                    "start": chunk["offset"] / 1e7,
                    "end": (chunk["offset"] + chunk["duration"]) / 1e7
                })
    with open(output_json, "w") as f:
        json.dump(words, f)

asyncio.run(generate_voice(
    "Текст для озвучки",
    "ru-RU-DmitryNeural",
    "voice.mp3",
    "words.json"
))
```

### Bash-рецепт (из SKILL.md)

```bash
python3 -c "
import edge_tts, asyncio, json
async def go():
    c = edge_tts.Communicate('''$TEXT''', '$VOICE', rate='$RATE')
    subs = []
    with open('work/${ID}_voice.mp3','wb') as f:
        async for ch in c.stream():
            if ch['type']=='audio': f.write(ch['data'])
            elif ch['type']=='WordBoundary':
                subs.append({'w':ch['text'],'s':ch['offset']/1e7,'e':(ch['offset']+ch['duration'])/1e7})
    json.dump(subs, open('work/${ID}_words.json','w'))
asyncio.run(go())
"
```

### Лучшие голоса по языкам

| Язык | Мужской | Женский | Код |
|------|---------|---------|-----|
| **Русский** | ru-RU-DmitryNeural | ru-RU-SvetlanaNeural | ru-RU |
| **Английский (US)** | en-US-GuyNeural | en-US-JennyNeural | en-US |
| **Английский (UK)** | en-GB-RyanNeural | en-GB-SoniaNeural | en-GB |
| **Французский** | fr-FR-HenriNeural | fr-FR-DeniseNeural | fr-FR |
| **Немецкий** | de-DE-ConradNeural | de-DE-KatjaNeural | de-DE |
| **Испанский** | es-ES-AlvaroNeural | es-ES-ElviraNeural | es-ES |
| **Итальянский** | it-IT-DiegoNeural | it-IT-ElsaNeural | it-IT |
| **Португальский (BR)** | pt-BR-AntonioNeural | pt-BR-FranciscaNeural | pt-BR |
| **Китайский** | zh-CN-YunxiNeural | zh-CN-XiaoxiaoNeural | zh-CN |
| **Японский** | ja-JP-KeitaNeural | ja-JP-NanamiNeural | ja-JP |
| **Корейский** | ko-KR-InJoonNeural | ko-KR-SunHiNeural | ko-KR |
| **Арабский** | ar-SA-HamedNeural | ar-SA-ZariyahNeural | ar-SA |
| **Хинди** | hi-IN-MadhurNeural | hi-IN-SwaraNeural | hi-IN |
| **Турецкий** | tr-TR-AhmetNeural | tr-TR-EmelNeural | tr-TR |
| **Украинский** | uk-UA-OstapNeural | uk-UA-PolinaNeural | uk-UA |
| **Польский** | pl-PL-MarekNeural | pl-PL-ZofiaNeural | pl-PL |
| **Нидерландский** | nl-NL-MaartenNeural | nl-NL-ColetteNeural | nl-NL |
| **Шведский** | sv-SE-MattiasNeural | sv-SE-SofieNeural | sv-SE |
| **Чешский** | cs-CZ-AntoninNeural | cs-CZ-VlastaNeural | cs-CZ |
| **Румынский** | ro-RO-EmilNeural | ro-RO-AlinaNeural | ro-RO |
| **Греческий** | el-GR-NestorasNeural | el-GR-AthinaNeural | el-GR |
| **Тайский** | th-TH-NiwatNeural | th-TH-PremwadeeNeural | th-TH |
| **Вьетнамский** | vi-VN-NamMinhNeural | vi-VN-HoaiMyNeural | vi-VN |
| **Индонезийский** | id-ID-ArdiNeural | id-ID-GadisNeural | id-ID |
| **Малайский** | ms-MY-OsmanNeural | ms-MY-YasminNeural | ms-MY |
| **Филиппинский** | fil-PH-AngeloNeural | fil-PH-BlessicaNeural | fil-PH |
| **Иврит** | he-IL-AvriNeural | he-IL-HilaNeural | he-IL |
| **Финский** | fi-FI-HarriNeural | fi-FI-NooraNeural | fi-FI |
| **Датский** | da-DK-JeppeNeural | da-DK-ChristelNeural | da-DK |
| **Норвежский** | nb-NO-FinnNeural | nb-NO-PernilleNeural | nb-NO |
| **Болгарский** | bg-BG-BorislavNeural | bg-BG-KalinaNeural | bg-BG |
| **Хорватский** | hr-HR-SreckoNeural | hr-HR-GabrijelaNeural | hr-HR |
| **Словацкий** | sk-SK-LukasNeural | sk-SK-ViktoriaNeural | sk-SK |
| **Латышский** | lv-LV-NilsNeural | lv-LV-EveritaNeural | lv-LV |
| **Литовский** | lt-LT-LeonasNeural | lt-LT-OnaNeural | lt-LT |
| **Эстонский** | et-EE-KertNeural | et-EE-AnuNeural | et-EE |
| **Фарси** | fa-IR-FaridNeural | fa-IR-DilaraNeural | fa-IR |
| **Урду** | ur-PK-AsadNeural | ur-PK-UzmaNeural | ur-PK |
| **Бенгальский** | bn-IN-BashkarNeural | bn-IN-TanishaaNeural | bn-IN |
| **Тамильский** | ta-IN-ValluvarNeural | ta-IN-PallaviNeural | ta-IN |
| **Маратхи** | mr-IN-ManoharNeural | mr-IN-AarohiNeural | mr-IN |
| **Каннада** | kn-IN-GaganNeural | kn-IN-SapnaNeural | kn-IN |
| **Суахили** | sw-KE-RafikiNeural | sw-KE-ZuriNeural | sw-KE |
| **Африкаанс** | af-ZA-WillemNeural | af-ZA-AdriNeural | af-ZA |
| **Каталанский** | ca-ES-EnricNeural | ca-ES-JoanaNeural | ca-ES |
| **Валлийский** | cy-GB-AledNeural | cy-GB-NiaNeural | cy-GB |
| **Ирландский** | ga-IE-ColmNeural | ga-IE-OrlaNeural | ga-IE |

### Полный список голосов

```bash
# Получить полный список доступных голосов:
python3 -c "import edge_tts; import asyncio; voices=asyncio.run(edge_tts.list_voices()); [print(v['ShortName'], v['Locale'], v['Gender']) for v in voices]"
```

### Параметры скорости и тона

```
rate: "-20%" до "+50%"    # скорость речи
pitch: "-10Hz" до "+10Hz" # высота тона
volume: "-20%" до "+20%"  # громкость
```

### Альтернативная озвучка — MiniMax TTS (платная, высшее качество)

```bash
curl -s "https://api.minimax.chat/v1/t2a_v2" \
  -H "Authorization: Bearer $MINIMAX_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"model":"speech-02-hd","text":"...","voice_setting":{"voice_id":"Wise_Woman"}}' \
  | jq -r '.data.audio' | base64 -d > voice.mp3
```

---

## 8. ФУТАЖ И СТОКОВОЕ ВИДЕО

### Pexels (бесплатно, 4K)

```bash
# Поиск видео
curl -s "https://api.pexels.com/videos/search?query=fitness+gym&per_page=5&size=large" \
  -H "Authorization: $PEXELS_API_KEY" | jq '.videos[].video_files[] | select(.quality=="hd")'

# Python рецепт
import requests
r = requests.get("https://api.pexels.com/videos/search",
    params={"query": "fitness gym", "per_page": 5, "orientation": "portrait", "size": "large"},
    headers={"Authorization": PEXELS_API_KEY})
for v in r.json()["videos"]:
    hd = [f for f in v["video_files"] if f["quality"] == "hd" and f["width"] >= 1080]
    if hd:
        url = hd[0]["link"]
        # скачать: requests.get(url).content
```

### Pixabay (бесплатно, 4K)

```bash
curl -s "https://pixabay.com/api/videos/?key=$PIXABAY_API_KEY&q=fitness+gym&per_page=5" \
  | jq '.hits[].videos.large'

# Python
r = requests.get("https://pixabay.com/api/videos/",
    params={"key": PIXABAY_API_KEY, "q": "fitness gym", "per_page": 5})
for v in r.json()["hits"]:
    url = v["videos"]["large"]["url"]
```

### Правила использования футажа

1. **USED_FOOTAGE реестр** — каждый использованный клип записывается в `used_footage.json`
2. **Никогда не повторять** — перед использованием проверить реестр
3. **Минимум 3 уникальных клипа** на один ролик
4. **Каденция 3 секунды** — смена визуала каждые ≤3 сек
5. **Portrait ориентация** (1080×1920) для Shorts/Reels/TikTok
6. **HD качество минимум** — не ниже 720p, идеально 1080p+
7. **Разнообразие запросов** — не искать одно и то же слово

---

## 9. ГЕНЕРАЦИЯ ИЗОБРАЖЕНИЙ

### Pollinations / FLUX (бесплатно, без ключа — ОСНОВНОЙ ПУТЬ)

```bash
# Генерация изображения — просто GET-запрос!
curl -o cover.jpg "https://image.pollinations.ai/prompt/$(python3 -c 'import urllib.parse;print(urllib.parse.quote("futuristic spy gadget, dark neon, cinematic, 4k"))')?width=1080&height=1920&nologo=true&model=flux"

# Python
import urllib.parse, requests
prompt = "futuristic spy gadget, dark neon, cinematic"
url = f"https://image.pollinations.ai/prompt/{urllib.parse.quote(prompt)}?width=1080&height=1920&nologo=true&model=flux"
img = requests.get(url).content
open("cover.jpg", "wb").write(img)
```

### Gemini (3 ключа, ротация)

```bash
# gen-image-free.sh — бесплатный путь через Pollinations (ПРЕДПОЧТИТЕЛЬНЫЙ)
# gen-image.sh — через Gemini (нужен биллинг)
# gen-text.sh — текст через Gemini (бесплатно)

# Прямой вызов Gemini для текста:
curl -s "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=$GEMINI_API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{"contents":[{"parts":[{"text":"Напиши сценарий..."}]}]}'
```

### Nano Banana Pro / Higgsfield Ultra (AI обложки)

```python
from gradio_client import Client
client = Client("Heartworm/Nano-Banana-Pro")
result = client.predict(
    prompt="spy gadget dark neon cinematic cover",
    negative_prompt="text watermark",
    width=1080, height=1920,
    guidance_scale=7.0,
    num_inference_steps=30,
    seed=-1,
    api_name="/generate"
)
# result → путь к сгенерированному файлу
```

### FLUX через HuggingFace Spaces

```python
from gradio_client import Client
client = Client("black-forest-labs/FLUX.1-schnell")
result = client.predict(
    prompt="...",
    seed=0,
    randomize_seed=True,
    width=1024,
    height=1024,
    num_inference_steps=4,
    api_name="/infer"
)
```

### Fal.ai

```bash
curl -X POST "https://fal.run/fal-ai/flux/schnell" \
  -H "Authorization: Key $FAL_KEY" \
  -H "Content-Type: application/json" \
  -d '{"prompt":"...","image_size":"portrait_16_9","num_inference_steps":4}'
```

### 2.5D Parallax (Depth-Anything ONNX)

```
# Генерация depth map из статичного изображения
# → пространственный parallax эффект при движении камеры
# Модель: Depth-Anything (ONNX runtime)
# Результат: видео с иллюзией 3D из 2D фото
```

---

## 10. 3D, WebGL, Spine, Lottie, Rive

### Three.js r160 ESM (рендер 3D GLB)

```javascript
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, 1080/1920, 0.1, 100);

// HDR окружение
const pmrem = new THREE.PMREMGenerator(renderer);
const envMap = pmrem.fromScene(new THREE.RoomEnvironment()).texture;
scene.environment = envMap;

// Загрузка модели
const loader = new GLTFLoader();
loader.load('model.glb', (gltf) => {
    scene.add(gltf.scene);
    // Анимация вращения
    function animate() {
        gltf.scene.rotation.y += 0.01;
        renderer.render(scene, camera);
        requestAnimationFrame(animate);
    }
    animate();
});
```

### Рендер 3D в видео (swiftshader)

```bash
# Headless рендер через swiftshader (программный OpenGL)
export LIBGL_ALWAYS_SOFTWARE=1

# Запуск Chromium с WebGL:
chromium --headless --no-sandbox --use-gl=swiftshader \
  --window-size=1080,1920 --screenshot=frame.png "file://scene.html"

# Покадровый рендер → ffmpeg:
for i in $(seq 0 149); do
    node render_frame.js $i > frame_$i.png
done
ffmpeg -framerate 30 -i frame_%d.png -c:v libx264 -pix_fmt yuv420p 3d_clip.mp4
```

### Бесплатные 3D источники

| Источник | URL | Форматы |
|----------|-----|---------|
| poly.pizza | https://poly.pizza | GLB, GLTF |
| Poly Haven | https://polyhaven.com | HDRi, текстуры, модели |
| Kenney | https://kenney.nl | game assets |
| Quaternius | https://quaternius.com | low-poly модели |
| Ready Player Me | https://readyplayer.me | аватары |
| OpenStreetMap | https://www.openstreetmap.org | 3D здания |
| Sketchfab | https://sketchfab.com | 3D модели (API: $SKETCHFAB_API_TOKEN) |

### Sketchfab API

```bash
# Поиск моделей
curl -s "https://api.sketchfab.com/v3/search?type=models&q=spy+gadget&downloadable=true" \
  -H "Authorization: Token $SKETCHFAB_API_TOKEN"

# Скачивание
curl -s "https://api.sketchfab.com/v3/models/{uid}/download" \
  -H "Authorization: Token $SKETCHFAB_API_TOKEN"
```

### Lottie анимации

```html
<!-- Встраивание Lottie -->
<script src="https://cdnjs.cloudflare.com/ajax/libs/lottie-web/5.12.2/lottie.min.js"></script>
<div id="lottie"></div>
<script>
lottie.loadAnimation({
    container: document.getElementById('lottie'),
    renderer: 'svg',
    loop: true,
    autoplay: true,
    path: 'animation.json'   // из lottiefiles.com
});
</script>
```

```
Источники Lottie:
- https://lottiefiles.com (огромная библиотека бесплатных анимаций)
- https://lordicon.com (animated icons)
- https://useanimations.com (micro-animations)
```

### Spine анимации

```
Spine — 2D skeletal animation (платная лицензия)
Runtime: spine-player.js
Форматы: .json (skeleton) + .atlas + .png (texture)
Применение: персонажи, маскоты, анимированные UI элементы
```

### Rive анимации

```javascript
// Rive — интерактивные анимации (бесплатный runtime)
// Файл: vendor/rive.min.js
import { Rive } from '@rive-app/canvas';

const rive = new Rive({
    src: 'animation.riv',
    canvas: document.getElementById('canvas'),
    autoplay: true,
    stateMachines: 'State Machine 1',
    onLoad: () => {
        rive.resizeDrawingSurfaceToCanvas();
    }
});
```

### WebGL шейдеры

```javascript
// React Bits — готовые WebGL эффекты
// Three.js ShaderMaterial для кастомных эффектов

const material = new THREE.ShaderMaterial({
    uniforms: {
        time: { value: 0 },
        resolution: { value: new THREE.Vector2(1080, 1920) }
    },
    vertexShader: `...`,
    fragmentShader: `
        uniform float time;
        void main() {
            vec2 uv = gl_FragCoord.xy / resolution;
            gl_FragColor = vec4(uv, sin(time) * 0.5 + 0.5, 1.0);
        }
    `
});
```

### gl-transitions (125 переходов между кадрами)

```
Библиотека: https://gl-transitions.com
125 GPU-ускоренных переходов
Интеграция через ffmpeg-gl-transition или Remotion
Примеры: crosswarp, directionalwarp, windowslice, doorway, morph, burn
```

---

## 11. МОНТАЖ FFmpeg — ПОЛНЫЕ РЕЦЕПТЫ

### 3-стадийная сборка (v4)

```bash
# === СТАДИЯ 1: Сегменты с масками ===

# Простой сегмент (fullscreen)
ffmpeg -i clip.mp4 -t 3 -vf "scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1" \
  -c:v libx264 -preset fast -crf 23 seg_01.mp4

# Сегмент с маской hexagon
ffmpeg -i clip.mp4 -i mask_hexagon.png -t 3 \
  -filter_complex "[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920[v];
    [1:v]scale=1080:1920[m];
    [v][m]alphamerge[masked];
    color=black:1080x1920:d=3[bg];
    [bg][masked]overlay=0:0[out]" \
  -map "[out]" -c:v libx264 seg_02.mp4

# Сегмент с вставкой (insert) — circle mask + layout center
ffmpeg -i clip.mp4 -t 3 \
  -filter_complex "[0:v]scale=600:600:force_original_aspect_ratio=increase,crop=600:600[clip];
    [clip]geq=lum='if(gt(sqrt((X-300)^2+(Y-300)^2),300),0,lum(X,Y))':
    cb='if(gt(sqrt((X-300)^2+(Y-300)^2),300),128,cb(X,Y))':
    cr='if(gt(sqrt((X-300)^2+(Y-300)^2),300),128,cr(X,Y))'[masked];
    color=black:1080x1920:d=3[bg];
    [bg][masked]overlay=(1080-600)/2:(1920-600)/2[out]" \
  -map "[out]" -c:v libx264 seg_03.mp4

# === СТАДИЯ 2: Concat с xfade ===

# Файл concat.txt:
# file 'seg_01.mp4'
# file 'seg_02.mp4'
# file 'seg_03.mp4'

# Простой concat (без переходов):
ffmpeg -f concat -safe 0 -i concat.txt -c:v libx264 -c:a aac merged.mp4

# С xfade переходами:
ffmpeg -i seg_01.mp4 -i seg_02.mp4 -i seg_03.mp4 \
  -filter_complex "
    [0:v][1:v]xfade=transition=slideleft:duration=0.5:offset=2.5[v01];
    [v01][2:v]xfade=transition=fadeblack:duration=0.5:offset=5.0[vout]" \
  -map "[vout]" -c:v libx264 merged.mp4

# === СТАДИЯ 3: Оверлеи + аудио + субтитры ===

# Наложение alpha webm оверлея:
# КРИТИЧНО: -c:v libvpx-vp9 ПЕРЕД -i при чтении alpha webm!
ffmpeg -i merged.mp4 -c:v libvpx-vp9 -i overlay.webm \
  -filter_complex "[1:v]colorchannelmixer=aa=0.9[ov];[0:v][ov]overlay=0:0:shortest=1[out]" \
  -map "[out]" -map 0:a? -c:v libx264 with_overlay.mp4

# Добавление озвучки:
ffmpeg -i with_overlay.mp4 -i voice.mp3 \
  -filter_complex "[0:a][1:a]amix=inputs=2:duration=first[aout]" \
  -map 0:v -map "[aout]" -c:v copy -c:a aac with_voice.mp4

# Добавление субтитров:
ffmpeg -i with_voice.mp4 -vf "ass=subtitles.ass" -c:v libx264 -c:a copy final.mp4
```

### Музыка с ducking (sidechain compress)

```bash
# Автоматический ducking — голос приглушает музыку
ffmpeg -i voice.mp3 -i music.mp3 \
  -filter_complex "
    [1:a]volume=0.15[music];
    [0:a][music]sidechaincompress=threshold=0.06:ratio=6:attack=10:release=200[ducked];
    [0:a][ducked]amix=inputs=2:duration=first:dropout_transition=2[aout]" \
  -map "[aout]" -c:a aac mixed_audio.m4a
```

### Затемнение видео (dimming вместо карточек)

```bash
# Полупрозрачное затемнение для контраста текста
ffmpeg -i clip.mp4 -vf "colorbalance=bs=0.1,eq=brightness=-0.15:contrast=1.1" darkened.mp4

# Виньетка:
ffmpeg -i clip.mp4 -vf "vignette=PI/4" vignetted.mp4
```

### WebM Alpha рендер (оверлеи с прозрачностью)

```bash
# 1. Рендер HTML → скриншоты (Playwright)
node -e "
const {chromium} = require('playwright');
(async()=>{
  const b = await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
  const p = await b.newPage(); await p.setViewportSize({width:1080,height:1920});
  await p.goto('file://overlay.html');
  for(let i=0;i<90;i++){
    await p.evaluate(f=>window.setFrame(f), i);
    await p.screenshot({path:'frames/f_'+String(i).padStart(4,'0')+'.png',omitBackground:true});
  }
  await b.close();
})()
"

# 2. Скриншоты → WebM с alpha каналом
ffmpeg -framerate 30 -i frames/f_%04d.png \
  -c:v libvpx-vp9 -pix_fmt yuva420p -b:v 2M \
  -auto-alt-ref 0 overlay.webm

# КРИТИЧНО при чтении: -c:v libvpx-vp9 ПЕРЕД -i
ffmpeg -i base.mp4 -c:v libvpx-vp9 -i overlay.webm \
  -filter_complex "[0:v][1:v]overlay=0:0:shortest=1" \
  -c:v libx264 result.mp4
```

### Валидация результата

```bash
# Проверка длительности и разрешения:
ffprobe -v quiet -print_format json -show_format -show_streams final.mp4 | \
  jq '{duration: .format.duration, width: .streams[0].width, height: .streams[0].height,
       codec: .streams[0].codec_name, has_audio: (.streams | map(select(.codec_type=="audio")) | length > 0)}'

# Ожидаемый результат для Shorts:
# width: 1080, height: 1920, duration: 30-59 sec, has_audio: true
```

---

## 12. ОВЕРЛЕИ И АНИМАЦИИ (anim.js)

### Движок anim.js — 34+ компонента

Каждый компонент рендерится как HTML → Playwright screenshots → WebM alpha → overlay на видео.

### Полный список компонентов

| # | Компонент | Описание | SFX |
|---|-----------|----------|-----|
| 1 | `stat` | Числовая статистика с анимацией | pop |
| 2 | `stat_count` | Счётчик с анимацией чисел | pop |
| 3 | `gauge` | Полукруговой индикатор | sweep |
| 4 | `donut` | Круговая диаграмма | sweep |
| 5 | `ring` | Кольцевая анимация | sweep |
| 6 | `linechart` | Линейный график | riser |
| 7 | `bars` | Столбчатая диаграмма | data |
| 8 | `map_routes` | Карта с маршрутами | — |
| 9 | `arrows` | Анимированные стрелки | — |
| 10 | `flowtree` | Дерево/блок-схема | — |
| 11 | `timeline` | Хронология/таймлайн | — |
| 12 | `compare` | Сравнение A vs B | — |
| 13 | `glassticker` | Стеклянный стикер | — |
| 14 | `glassquote` | Цитата в стекле | — |
| 15 | `kinetic` | Кинетическая типографика | impact |
| 16 | `title` | Заголовок с анимацией | — |
| 17 | `name` | Имя/подпись | — |
| 18 | `device` | Мокап устройства | — |
| 19 | `pill` | Пилюля/тег | — |
| 20 | `list_check` | Чеклист с галочками | tick |
| 21 | `list_num` | Нумерованный список | tick |
| 22 | `list_bullet` | Маркированный список | tick |
| 23 | `subscribe` | CTA подписка | — |
| 24 | `cta_title` | CTA заголовок | — |
| 25 | `photo3d` | 3D параллакс фото | — |
| 26 | `hex` | Гексагональная сетка | — |
| 27 | `split` | Разделённый экран | — |
| 28 | `card` | Карточка с информацией | — |
| 29 | `billboard` | Билборд | — |
| 30 | `kicker` | Кикер (плашка с текстом) | tick |
| 31 | `lowerthird` | Нижняя третья часть экрана | swish |
| 32 | `callout` | Выноска с указателем | ding |
| 33 | `ticker` | Бегущая строка | — |
| 34 | `chips` | Набор тегов/чипов | tick |

### Типы оверлеев в render_ov3.py

| Тип | Данные | Визуал |
|-----|--------|--------|
| `kicker` | `{label, text}` | Плашка с заголовком и текстом |
| `stat_count` | `{value, label}` | Анимированный счётчик |
| `bars` | `{items: [{label, value}]}` | Горизонтальные бары |
| `ring` | `{percent, label}` | Кольцевой прогресс |
| `chips` | `{items: ["tag1", "tag2"]}` | Набор тегов |
| `lowerthird` | `{name, title}` | Плашка внизу |
| `kinetic` | `{text}` | Кинетический текст |
| `callout` | `{text, direction}` | Выноска |
| `ticker` | `{items: ["text1", ...]}` | Бегущая строка |
| `linechart` | `{points: [1,2,3], label}` | Линейный график |
| `donut` | `{segments: [{label,value}]}` | Круговая диаграмма |
| `gauge` | `{value, max, label}` | Индикатор |

### Правила использования оверлеев

1. **Не более 2 оверлеев одновременно** на экране
2. **Привязка к WordBoundary** — появление синхронно с озвучкой
3. **USED_ANIM реестр** — не повторять одинаковые типы подряд
4. **Цвета из brand_profile** — accent color, text color
5. **Шрифты из brand_profile** — heading font, body font

---

## 13. МАСКИ И ФОРМЫ ВСТАВОК (15+ форм)

### Полный список масок

| # | Форма | Описание | Применение |
|---|-------|----------|------------|
| 1 | `circle` | Круг | Портрет, аватар |
| 2 | `oval` | Овал | Портрет вытянутый |
| 3 | `hexagon` | Шестиугольник | Tech/sci-fi стиль |
| 4 | `pentagon` | Пятиугольник | Военный/security |
| 5 | `diamond` | Ромб | Luxury/premium |
| 6 | `roundsquare` | Скруглённый квадрат | App icon стиль |
| 7 | `rrect` | Скруглённый прямоугольник | Карточка |
| 8 | `arch` | Арка | Архитектурный |
| 9 | `tilt` | Наклонённый | Динамический |
| 10 | `tv` | ТВ-экран | Ретро/медиа |
| 11 | `parallelogram` | Параллелограмм | Спортивный |
| 12 | `strip` | Полоса | Лента/баннер |
| 13 | `band` | Лента широкая | Панорама |
| 14 | `phone` | Форма телефона | Мобильный контент |
| 15 | `smallcircle` | Малый круг | Миниатюра |

### FFmpeg compositing рецепт

```bash
# Геометрическая маска через geq:
# Круг (center=W/2,H/2, radius=R):
geq=lum='if(gt(sqrt((X-CX)^2+(Y-CY)^2),R),0,lum(X,Y))':cb=...:cr=...

# SVG маска → PNG → alphamerge:
ffmpeg -i clip.mp4 -i mask.png -filter_complex "[0:v][1:v]alphamerge" masked.mp4

# Анимированная маска (zoom/rotate):
ffmpeg -i clip.mp4 -i mask.png -filter_complex "
  [1:v]scale=w=iw*(1+0.1*t/3):h=ih*(1+0.1*t/3),crop=iw:ih[m];
  [0:v][m]alphamerge" animated_mask.mp4
```

---

## 14. ЛЕЙАУТЫ РАЗМЕЩЕНИЯ (6 СХЕМ)

| # | Layout | Описание | FFmpeg filter |
|---|--------|----------|---------------|
| 1 | `fs` (fullscreen) | Полноэкранный | `scale=1080:1920,crop=1080:1920` |
| 2 | `center` | По центру с отступами | `scale=600:-1,overlay=(W-w)/2:(H-h)/2` |
| 3 | `bottom` | Внизу экрана | `scale=1080:-1,overlay=0:H-h-100` |
| 4 | `left` | Слева, вертикальный | `scale=540:-1,overlay=0:(H-h)/2` |
| 5 | `right` | Справа, вертикальный | `scale=540:-1,overlay=540:(H-h)/2` |
| 6 | `split` | Два видео, верх+низ | `[v1]scale=1080:960[a];[v2]scale=1080:960[b];[a][b]vstack` |

### Lowbar

```bash
# Нижняя полоса с текстом/CTA:
ffmpeg -i main.mp4 -vf "drawbox=y=ih-200:w=iw:h=200:color=black@0.7:t=fill,
  drawtext=text='Скачай приложение':fontfile=fonts/Montserrat-Bold.ttf:
  fontsize=36:fontcolor=white:x=(w-tw)/2:y=h-120" with_lowbar.mp4
```

---

## 15. ПЕРЕХОДЫ

### xfade (24+ типа, встроенные в FFmpeg)

```
fade, fadeblack, fadewhite, fadegrays,
wipeleft, wiperight, wipeup, wipedown,
slideleft, slideright, slideup, slidedown,
smoothleft, smoothright, smoothup, smoothdown,
circlecrop, circleclose, circleopen,
vertopen, vertclose, horzopen, horzclose,
dissolve, pixelize, diagtl, diagtr, diagbl, diagbr,
hlslice, hrslice, vuslice, vdslice,
radial, zoomin, squeezev, squeezeh
```

```bash
# Применение xfade:
ffmpeg -i seg1.mp4 -i seg2.mp4 \
  -filter_complex "[0:v][1:v]xfade=transition=slideleft:duration=0.5:offset=2.5" \
  -c:v libx264 output.mp4

# Цепочка xfade для 4 сегментов:
ffmpeg -i s1.mp4 -i s2.mp4 -i s3.mp4 -i s4.mp4 \
  -filter_complex "
    [0:v][1:v]xfade=transition=fadeblack:duration=0.4:offset=2.6[v01];
    [v01][2:v]xfade=transition=slideleft:duration=0.4:offset=5.2[v02];
    [v02][3:v]xfade=transition=circleopen:duration=0.4:offset=7.8[vout]" \
  -map "[vout]" merged.mp4
```

### gl-transitions (125 GPU-переходов)

```
Библиотека: https://gl-transitions.com/gallery
Интеграция: ffmpeg-gl-transition (custom build) или Remotion
Примеры переходов:
  crosswarp, directionalwarp, windowslice, doorway, morph,
  burn, cube, wind, dreamy, flyeye, kaleidoscope, pinwheel,
  polarfunction, randomsquares, ripple, swirl, undulatingburn,
  waterdrop, angular, butterflywave, colorphase, coordfromIn,
  crosshatch, displacement, doomscreen, gridflip, inverted_page_curl,
  mosaic, perlin, polkadots_curtain, rotate_scale_fade, squareswire,
  stereoviewer, swap, windowblinds
```

---

## 16. СУБТИТРЫ (КАРАОКЕ ASS)

### Генерация ASS из WordBoundary

```python
import json

def generate_ass(words_json, output_ass, font="Montserrat", fontsize=42,
                 primary_color="&H00FFFFFF", highlight_color="&H0000FF9A",
                 outline_color="&H00000000", bold=1):
    words = json.load(open(words_json))

    header = f"""[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
WrapStyle: 0

[V4+ Styles]
Format: Name,Fontname,Fontsize,PrimaryColour,SecondaryColour,OutlineColour,BackColour,Bold,Italic,Underline,StrikeOut,ScaleX,ScaleY,Spacing,Angle,BorderStyle,Outline,Shadow,Alignment,MarginL,MarginR,MarginV,Encoding
Style: Default,{font},{fontsize},{primary_color},{highlight_color},{outline_color},&H80000000,{bold},0,0,0,100,100,0,0,1,3,0,2,40,40,120,1

[Events]
Format: Layer,Start,End,Style,Name,MarginL,MarginR,MarginV,Effect,Text
"""

    def ts(seconds):
        h = int(seconds // 3600)
        m = int((seconds % 3600) // 60)
        s = seconds % 60
        return f"{h}:{m:02d}:{s:05.2f}"

    events = []
    # Группировка слов по 3-5 для караоке-строк
    group_size = 4
    for i in range(0, len(words), group_size):
        group = words[i:i+group_size]
        start = group[0]["s"]
        end = group[-1]["e"] + 0.3

        kara_parts = []
        for w in group:
            dur_cs = int((w["e"] - w["s"]) * 100)
            kara_parts.append(f"{{\\kf{dur_cs}}}{w['w']}")

        text = " ".join(kara_parts) if not kara_parts else "".join(
            f"{{\\kf{int((w['e']-w['s'])*100)}}}{w['w']} " for w in group
        ).strip()

        events.append(f"Dialogue: 0,{ts(start)},{ts(end)},Default,,0,0,0,,{text}")

    with open(output_ass, "w") as f:
        f.write(header + "\n".join(events))

generate_ass("work/id_words.json", "work/id_subs.ass",
             font="Bebas Neue", fontsize=48,
             primary_color="&H00FFFFFF",
             highlight_color="&H0000FF9A")  # лайм подсветка
```

### Наложение субтитров

```bash
ffmpeg -i video.mp4 -vf "ass=subtitles.ass" -c:v libx264 -c:a copy subtitled.mp4
```

### Стили субтитров

```
# Минимальный (белый + обводка):
PrimaryColour=&H00FFFFFF, OutlineColour=&H00000000, Outline=3

# Бренд (лайм подсветка):
PrimaryColour=&H00FFFFFF, SecondaryColour=&H0000FF9A, OutlineColour=&H00000000

# Неон:
PrimaryColour=&H0000FFFF, OutlineColour=&H00FF00FF, Outline=2, Shadow=3

# Положение: Alignment=2 (низ-центр), MarginV=120 (отступ от низа)
# Шрифт: из brand_profile (Bebas Neue, Montserrat, и т.д.)
```

---

## 17. МУЗЫКА И ЗВУКОВЫЕ ЭФФЕКТЫ

### Источники музыки

#### Jamendo API (бесплатно, коммерческое использование)

```bash
# client_id: 2c9a11b9 (публичный)
curl -s "https://api.jamendo.com/v3.0/tracks/?client_id=2c9a11b9&format=json&limit=5&fuzzytags=electronic+dark&include=musicinfo&audioformat=mp31" \
  | jq '.results[] | {name, artist_name, audio, duration}'
```

#### Freesound API (SFX + ambient)

```bash
# Поиск звуков:
curl -s "https://freesound.org/apiv2/search/text/?query=impact+cinematic&filter=duration:[0.5 TO 3]&fields=id,name,previews" \
  -H "Authorization: Token $FREESOUND_API_KEY"

# Скачивание:
curl -s "https://freesound.org/apiv2/sounds/{id}/download/" \
  -H "Authorization: Token $FREESOUND_API_KEY" -o sfx.wav
```

### Пул звуковых эффектов (9 категорий × 3 варианта = 27)

| Категория | Файлы | Применение |
|-----------|-------|------------|
| `impact` | impact_01-03.wav | Удар, появление кинетического текста |
| `whoosh` | whoosh_01-03.wav | Пролёт, быстрое движение |
| `ding` | ding_01-03.wav | Уведомление, callout |
| `pop` | pop_01-03.wav | Появление stat_count, числа |
| `sweep` | sweep_01-03.wav | Плавное появление ring/gauge/donut |
| `data` | data_01-03.wav | Бары, графики |
| `riser` | riser_01-03.wav | Нарастание, linechart |
| `tick` | tick_01-03.wav | Чеклист, chips, kicker |
| `swish` | swish_01-03.wav | Lowerthird, быстрое появление |

### SFX → компонент маппинг

```json
{
  "stat_count": "pop",
  "ring": "sweep",
  "gauge": "sweep",
  "donut": "sweep",
  "bars": "data",
  "kinetic": "impact",
  "callout": "ding",
  "lowerthird": "swish",
  "linechart": "riser",
  "chips": "tick",
  "kicker": "tick",
  "list_check": "tick",
  "list_num": "tick"
}
```

### Музыка по секциям + Ducking

```bash
# Структура аудио:
# 1. Голос (voice.mp3) — основной трек
# 2. Музыка (music.mp3) — фоновая, volume=0.15
# 3. SFX (sfx_*.wav) — точечные эффекты

# Микширование с ducking:
ffmpeg -i voice.mp3 -i music.mp3 \
  -filter_complex "
    [1:a]volume=0.15[music];
    [0:a][music]sidechaincompress=threshold=0.06:ratio=6:attack=10:release=200[ducked];
    [0:a][ducked]amix=inputs=2:duration=first:dropout_transition=2[aout]" \
  -map "[aout]" mixed.m4a

# Добавление SFX в нужные моменты:
ffmpeg -i mixed.m4a -i sfx_pop.wav \
  -filter_complex "[1:a]adelay=3500|3500,volume=0.6[sfx];[0:a][sfx]amix=inputs=2:duration=first[out]" \
  -map "[out]" with_sfx.m4a
```

---

## 18. АНАЛИЗ КОНКУРЕНТОВ (RECON)

### recon.py — быстрый анализ

```bash
# Анализ конкурентов перед каждым роликом:
python3 recon.py <app> brief <script_id>

# Что делает:
# 1. Ищет 5-10 роликов конкурентов с 1M+ просмотров
# 2. Анализирует: хуки, длительность, форматы, CTA
# 3. Создаёт файл analysis/<app>_brief_<id>.json
# 4. Результат используется для усиления хука в script_polish.py
```

### recon_deep.py — глубокий анализ

```bash
# Глубокий анализ с storyboard sprites + авто-субтитры:
python3 recon_deep.py <app> <channel_url>

# Что делает:
# 1. Скачивает ролики через yt-dlp
# 2. Извлекает покадровые спрайты (storyboard)
# 3. Извлекает субтитры/транскрипт
# 4. Анализирует визуальные паттерны
# 5. Определяет формулы вирусных роликов
```

### Методология анализа

```
1. ПОИСК КОНКУРЕНТОВ:
   - YouTube Shorts: поиск по нише + фильтр views > 1M
   - TikTok: trending в нише
   - Instagram Reels: explore feed

2. ПАРАМЕТРЫ АНАЛИЗА:
   - Длительность (оптимально 30-59 сек для Shorts)
   - Хук (первые 1-3 секунды)
   - Структура (hook → value → CTA)
   - Визуальный стиль (маски, оверлеи, переходы)
   - Аудио (голос, музыка, SFX)
   - Engagement rate (views/subs, likes/views)

3. РЕЗУЛЬТАТ:
   - Топ-3 формата для воспроизведения
   - Формулы хуков
   - Оптимальные длительности
   - Визуальные паттерны
```

---

## 19. HUMANIZER И ПОЛИРОВКА

### script_polish.py

```bash
# Полировка сценария перед сборкой:
python3 script_polish.py scripts/<id>.json

# Три этапа:
# 1. HUMANIZER — делает текст живым, убирает шаблонность
#    - Замена канцеляризмов на разговорный стиль
#    - Добавление эмоциональных маркеров
#    - Проверка на "AI-звучание"
#
# 2. УСИЛЕНИЕ ХУКА — по данным конкурентов (recon)
#    - Интрига/шок/вопрос в первые 2 секунды
#    - Обещание ценности
#    - Pattern interrupt
#
# 3. ОЦЕНКА ВИРАЛЬНОСТИ (virality_score 1-10)
#    - Shareability
#    - Emotional trigger
#    - Curiosity gap
#    - Controversy (без токсичности)
#    - Save-worthiness
```

### Шаблоны хуков (проверенные формулы)

```
ШОКОВЫЙ:    "Ты даже не представляешь, что [X] делает с [Y]"
ВОПРОС:     "Почему [X] никогда не расскажет тебе о [Y]?"
ЦИФРА:      "[97%] людей не знают, что [X]"
ПРИКАЗ:      "Остановись. Не листай дальше."
СРАВНЕНИЕ:   "[X] стоит $1000. А этот способ — бесплатный"
ФОРМУЛА:     "Секрет [успеха/провала] — всего [1/3/5] вещей"
HISTORY:     "В [году] [человек] сделал то, что изменило всё"
PROVOC:      "[Popular belief] — это ложь. Вот почему."
```

### Правила сценария

```
1. Хук: 1-3 сек, максимально цепляющий
2. Основная часть: 20-45 сек, ценность/история/факты
3. CTA: 3-5 сек, призыв к действию
4. Общая длительность: 30-59 сек (идеально 35-45)
5. Темп речи: 2.5-3.5 слова/сек
6. Визуальная смена: каждые 2-3 сек
7. Минимум 1 инфографический элемент на ролик
8. Финальный кадр: CTA + лого/название
```

---

## 20. СИСТЕМА РАЗНООБРАЗИЯ

### 3 закона разнообразия

```
ЗАКОН 1: УНИКАЛЬНЫЕ КЛИПЫ
  - Каждый ролик использует уникальный набор футажа
  - USED_FOOTAGE реестр (used_footage.json) отслеживает все использованные клипы
  - Повторное использование = ошибка сборки

ЗАКОН 2: КАДЕНЦИЯ 3 СЕКУНДЫ
  - Новый визуальный элемент каждые ≤3 секунды
  - Элемент = смена клипа / появление оверлея / переход / маска

ЗАКОН 3: ПАМЯТЬ ПРЕДОТВРАЩАЕТ ПОВТОРЫ
  - gen_ledger.json — каждый сгенерированный ID уникален
  - Publisher guard — проверка перед публикацией
  - Generator fresh IDs — ID содержит timestamp + random
```

### Матрица разнообразия (ноль повторов через 500 роликов)

```
ИЗМЕРЕНИЯ РАЗНООБРАЗИЯ:
1. Тема/ниша         — ротация spy → brain → tape (или кастомные приложения)
2. Тип оверлея       — stat → bars → ring → kinetic → ... (не повторять подряд)
3. Форма маски        — hexagon → circle → diamond → ... (не повторять подряд)
4. Лейаут            — fs → center → split → ... (чередовать)
5. Тип перехода      — xfade type (24+ вариантов)
6. Голос             — мужской/женский, разные голоса (ротация)
7. Музыка/настроение — dark → upbeat → chill → tense (ротация)
8. Хук-формула       — шок → вопрос → цифра → приказ (ротация)
9. Цветовая палитра  — в рамках бренда, но с вариациями
10. Длительность     — 30-59 сек (вариация)
```

### Anti-dupe тройная защита

```
1. gen_ledger.json      — реестр ВСЕХ сгенерированных сценариев
   → Генератор НИКОГДА не создаёт ID, который уже есть

2. posted_reels.json    — реестр ВСЕХ опубликованных роликов
   → Паблишер НИКОГДА не публикует уже опубликованный ID

3. Чистка очереди       — перед каждым тиком:
   → Если ID из очереди уже в posted_reels → удалить из очереди
```

---

## 21. КВОТА И ПЕЙСИНГ

### Рамп-система

```python
# Конфигурация (адаптировать под проект):
START = date(YYYY, M, D)           # дата старта
RAMP_DAYS = 5                      # дней на разогрев
RAMP_QUOTA = 3                     # роликов/день в разогреве
BASE_QUOTA = 5                     # базовая квота после разогрева
GROWTH_EVERY = 2                   # +1 каждые N дней
MAX_QUOTA = 15                     # потолок роликов/день
WSTART_H, WEND_H = 4, 23          # окно постинга (UTC)
MIN_GAP_S = 5400                   # минимум 1.5 часа между роликами

def quota_for(d):
    n = (d - START).days
    if n < 0: return 0
    if n < RAMP_DAYS: return RAMP_QUOTA
    return min(MAX_QUOTA, max(BASE_QUOTA, BASE_QUOTA + (n - RAMP_DAYS) // GROWTH_EVERY))
```

### Пейсинг (равномерное распределение)

```python
def due_by_now():
    """Сколько роликов должно быть готово к текущему моменту."""
    q = quota_for(date.today())
    now = datetime.utcnow()
    h = now.hour + now.minute / 60.0
    if h <= WSTART_H: return 0
    if h >= WEND_H: return q
    return min(q, math.ceil(q * (h - WSTART_H) / (WEND_H - WSTART_H)))

def can_build_now():
    """Можно ли собрать ролик прямо сейчас."""
    s = today_state()
    q = quota_for(date.today())
    remaining = q - s.get("count", 0)
    gap_ok = (time.time() - s.get("last_ts", 0)) >= MIN_GAP_S
    paced = s.get("count", 0) < due_by_now()
    return remaining > 0 and gap_ok and paced
```

### Адаптивный cap (perf_flag.json)

```json
// analysis/perf_flag.json — если аналитика фиксирует просадку просмотров:
{
    "cap": 5,                    // временно снизить квоту до 5
    "until": "2026-08-10",       // до какой даты
    "reason": "views_drop_30pct" // причина
}
```

### daily_state.json

```json
{
    "date": "2026-08-05",
    "count": 7,
    "last_ts": 1722859200.0
}
```

---

## 22. ПУБЛИКАЦИЯ

### TikTok через Hooppy API

```bash
# Загрузка видео:
VIDEO_URL=$(upload_to_s3 work/${ID}.mp4)  # или другое CDN

curl -X POST "https://api.hooppy.com/tiktok/post" \
  -H "Authorization: Bearer $HOOPPY_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "page_id": "'$HOOPPY_PAGE_ID'",
    "video_url": "'$VIDEO_URL'",
    "caption": "'"$CAPTION"'",
    "privacy": "public"
  }'

# Проверка статуса:
curl -s "https://api.hooppy.com/tiktok/post/$POST_ID" \
  -H "Authorization: Bearer $HOOPPY_API_TOKEN"
```

### YouTube Shorts через Data API v3

```bash
# Загрузка Shorts (resumable upload):
# 1. Инициализация:
curl -X POST "https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status" \
  -H "Authorization: Bearer $YT_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "snippet": {
      "title": "'"$YT_TITLE"'",
      "description": "'"$CAPTION"' #shorts",
      "categoryId": "22",
      "tags": ["shorts"]
    },
    "status": {
      "privacyStatus": "public",
      "selfDeclaredMadeForKids": false
    }
  }' -D - 2>/dev/null | grep -i location

# 2. Upload:
curl -X PUT "$UPLOAD_URL" \
  -H "Content-Type: video/mp4" \
  --data-binary @work/${ID}.mp4

# Refresh token:
curl -X POST "https://oauth2.googleapis.com/token" \
  -d "client_id=$YT_CLIENT_ID&client_secret=$YT_CLIENT_SECRET&refresh_token=$YT_REFRESH_TOKEN&grant_type=refresh_token"
```

### Instagram Reels через VPS браузер-агент

```bash
# VPS агент: стелс-браузер (patchright — форк Playwright с антидетект)
# Хост: okoagents.okoteam.top (или $OKO_VPS_CTRL_URL)
# Аутентификация: Bearer $OKO_VPS_CTRL_TOKEN

# 1. Отправить видео на VPS:
# git-raw: через Git LFS или S3 signed URL

# 2. Запустить публикацию:
curl -X POST "$OKO_VPS_CTRL_URL/ig/post" \
  -H "Authorization: Bearer $OKO_VPS_CTRL_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "account": "'"$IG_ACCOUNT"'",
    "video_url": "'"$VIDEO_URL"'",
    "caption": "'"$CAPTION"'",
    "type": "reel"
  }'

# IG самоконтроль:
# ig_list.mjs — читает ленту, проверяет дубли
# ig_delete.mjs — удаляет дефектные/дублированные посты
```

### Расписание публикации (send_later)

```python
# Claude Code Remote — отложенная публикация:
send_later(
    message="bash factory/publish.sh <id> tiktok",
    delay_minutes=90  # через 1.5 часа
)

# Или абсолютное время:
send_later(
    message="bash factory/publish.sh <id> youtube",
    at="2026-08-05T14:00:00Z"
)
```

### Реестр публикаций (posted_reels.json)

```json
{
    "gspy_fitness_001": {
        "ts": 1722859200,
        "yt_id": "dQw4w9WgXcQ",
        "tt_id": "7234567890",
        "ig_code": "CxYz123",
        "caption": "...",
        "duration": 42
    }
}
```

---

## 23. АНАЛИТИКА И ОТЧЁТЫ

### Ежедневный сбор (10:00 МСК = 07:00 UTC)

```python
# Источники данных:
# - YouTube: Data API v3 (views, likes, comments, watch_time)
# - TikTok: Hooppy API (views, likes, shares, comments)
# - Instagram: VPS агент (views, likes, comments, saves)

# Формат записи:
# analysis/daily_<date>.json
{
    "date": "2026-08-05",
    "reels": {
        "gspy_fitness_001": {
            "yt": {"views": 12500, "likes": 890, "comments": 45},
            "tt": {"views": 45000, "likes": 3200, "shares": 120},
            "ig": {"views": 8900, "likes": 670, "saves": 89}
        }
    },
    "totals": {
        "total_views": 66400,
        "total_reels": 45,
        "avg_views": 1475
    }
}
```

### Формула хита

```python
# Хит = ролик с 3× и более от среднего просмотров
def is_hit(reel_views, avg_views):
    return reel_views >= avg_views * 3

# При обнаружении хита:
# 1. Анализировать формулу хука, визуальный стиль, тему
# 2. Создать 3 вариации на эту тему (amplification)
# 3. Уведомить в Telegram
```

### Отчёт в Telegram

```python
import requests

def send_report(bot_token, chat_id, text):
    requests.post(
        f"https://api.telegram.org/bot{bot_token}/sendMessage",
        json={"chat_id": chat_id, "text": text, "parse_mode": "Markdown"}
    )

# Формат отчёта:
report = f"""📊 *Дневной отчёт {date}*

Собрано: {done}/{quota} роликов
Опубликовано: TT={tt_count} YT={yt_count} IG={ig_count}

🏆 Топ-3 ролика:
1. {top1_id}: {top1_views} просмотров
2. {top2_id}: {top2_views} просмотров
3. {top3_id}: {top3_views} просмотров

Средний: {avg_views} просмотров
Хитов: {hits_count}

Очередь: {queue_count} сценариев
"""
```

---

## 24. QC — КОНТРОЛЬ КАЧЕСТВА

### qc.py — автоматическая проверка перед публикацией

```python
import subprocess, json, sys

def qc_check(video_path):
    errors = []

    # 1. FFprobe валидация
    probe = json.loads(subprocess.check_output([
        "ffprobe", "-v", "quiet", "-print_format", "json",
        "-show_format", "-show_streams", video_path
    ]))

    # Видео-стрим
    vs = [s for s in probe["streams"] if s["codec_type"] == "video"]
    if not vs:
        errors.append("NO_VIDEO_STREAM")
        return errors

    v = vs[0]
    w, h = int(v["width"]), int(v["height"])
    dur = float(probe["format"]["duration"])

    # 2. Разрешение
    if w != 1080 or h != 1920:
        errors.append(f"WRONG_RESOLUTION: {w}x{h} (need 1080x1920)")

    # 3. Длительность (30-59 сек для Shorts)
    if dur < 10:
        errors.append(f"TOO_SHORT: {dur:.1f}s")
    if dur > 60:
        errors.append(f"TOO_LONG: {dur:.1f}s (max 60s for Shorts)")

    # 4. Аудио
    audio = [s for s in probe["streams"] if s["codec_type"] == "audio"]
    if not audio:
        errors.append("NO_AUDIO")

    # 5. Размер файла (макс 256MB для TikTok)
    size_mb = int(probe["format"]["size"]) / (1024*1024)
    if size_mb > 256:
        errors.append(f"FILE_TOO_LARGE: {size_mb:.0f}MB (max 256MB)")

    # 6. Кодек
    if v.get("codec_name") not in ("h264", "hevc"):
        errors.append(f"WRONG_CODEC: {v.get('codec_name')} (need h264)")

    # 7. FPS
    fps = eval(v.get("r_frame_rate", "30/1"))
    if fps < 24 or fps > 60:
        errors.append(f"WRONG_FPS: {fps}")

    return errors

# Использование:
errors = qc_check("work/final.mp4")
if errors:
    print("QC FAILED:", errors)
    sys.exit(1)
print("QC PASSED")
```

### Чеклист QC (12 пунктов)

```
□ Разрешение 1080×1920 (portrait)
□ Длительность 30-59 секунд
□ Есть аудио-стрим (голос)
□ Кодек h264/hevc
□ FPS 24-60
□ Размер < 256 MB
□ Субтитры наложены и читаемы
□ Оверлеи не перекрывают лица
□ Первые 3 секунды — хук (не пустой экран)
□ Последние 5 секунд — CTA
□ Нет чёрных кадров > 0.5 сек
□ Аудио не клипится (peak < -1dB)
```

### health.sh — периодическая проверка здоровья

```bash
# Запускается раз в час через cron_once.sh:
# Проверяет:
# 1. Доступность API (Pexels, Pixabay, Hooppy, YouTube)
# 2. Свободное место на диске
# 3. Валидность токенов
# 4. Очередь сценариев (не пустая)
# 5. Консистентность реестров
```

---

## 25. REMOTION FRAMEWORK

### Основы

```javascript
// Composition — контейнер видео
import { Composition } from 'remotion';

export const RemotionRoot = () => (
    <Composition
        id="MyVideo"
        component={MyComponent}
        durationInFrames={900}  // 30 сек при 30fps
        fps={30}
        width={1080}
        height={1920}
    />
);

// useCurrentFrame + interpolate
import { useCurrentFrame, interpolate, spring } from 'remotion';

const MyComponent = () => {
    const frame = useCurrentFrame();
    const opacity = interpolate(frame, [0, 30], [0, 1]);
    const scale = spring({ frame, fps: 30, config: { damping: 200 } });

    return (
        <div style={{ opacity, transform: `scale(${scale})` }}>
            Hello World
        </div>
    );
};

// Sequence — временная шкала
import { Sequence } from 'remotion';

const Video = () => (
    <>
        <Sequence from={0} durationInFrames={90}>
            <Intro />
        </Sequence>
        <Sequence from={90} durationInFrames={150}>
            <MainContent />
        </Sequence>
        <Sequence from={240} durationInFrames={60}>
            <Outro />
        </Sequence>
    </>
);
```

### Audio-driven видео

```javascript
// audioConfig.ts — конфигурация сцен по таймингам озвучки
export const audioConfig = {
    scenes: [
        {
            id: "intro",
            startTime: 0,
            endTime: 3.5,
            text: "Hook text here",
            visual: "kinetic_text"
        },
        {
            id: "main_1",
            startTime: 3.5,
            endTime: 8.2,
            text: "Main content",
            visual: "stock_footage",
            overlay: "stat_count"
        }
    ]
};
```

### 3D видео с @remotion/three

```javascript
import { ThreeCanvas } from '@remotion/three';
import { useCurrentFrame } from 'remotion';

const My3DScene = () => {
    const frame = useCurrentFrame();
    return (
        <ThreeCanvas>
            <ambientLight intensity={0.5} />
            <mesh rotation={[0, frame * 0.02, 0]}>
                <boxGeometry args={[1, 1, 1]} />
                <meshStandardMaterial color="lime" />
            </mesh>
        </ThreeCanvas>
    );
};
```

### Облачный рендер (Claude Code Remote)

```bash
# Рендер через chromium_headless_shell:
npx remotion render MyVideo output.mp4 \
  --gl=swangle \
  --browser-executable=/opt/pw-browsers/chromium-*/chrome-linux/chrome \
  --concurrency=2

# Ключевые флаги:
# --gl=swangle          — программный OpenGL (без GPU)
# --browser-executable  — путь к предустановленному Chromium
# --concurrency=2       — параллельные кадры (по CPU)
# --no-sandbox          — для root в контейнере
```

### Process Animation (обучающие ролики)

```javascript
// Паттерны анимации процессов:

// 1. StepByStep — пошаговое появление
const StepByStep = ({ steps }) => {
    const frame = useCurrentFrame();
    return steps.map((step, i) => {
        const appear = spring({ frame: frame - i * 30, fps: 30 });
        return <Step key={i} opacity={appear} {...step} />;
    });
};

// 2. ValueFlyIn — числа влетают
// 3. CompareHighlight — сравнение с подсветкой
// 4. SlidingWindow — скользящее окно
```

---

## 26. MOTION UI (React/Next.js)

### Motion System v4.2

```javascript
// motionTokens — единая система тайминга
export const motionTokens = {
    duration: {
        fast: 0.15,      // микро-взаимодействия
        normal: 0.3,     // стандартные переходы
        slow: 0.5,       // крупные элементы
        page: 0.8        // переходы страниц
    },
    easing: {
        smooth: [0.4, 0, 0.2, 1],    // Material Design standard
        sharp: [0.4, 0, 0.6, 1],     // резкий, для мелких
        bounce: [0.68, -0.55, 0.265, 1.55]  // пружинный
    },
    distance: {
        sm: 8,    // мелкие сдвиги
        md: 16,   // стандартные
        lg: 32    // крупные
    }
};
```

### Правила производительности

```
БЕЗОПАСНО (GPU-ускорено):
  transform: translate, scale, rotate
  opacity

ИЗБЕГАТЬ (вызывает reflow):
  width, height, margin, padding, top, left
  border-width, font-size

АДАПТАЦИЯ:
  useReducedMotion() → отключить анимации для a11y
  matchMedia('(prefers-reduced-motion: reduce)')
```

### Паттерны

```javascript
// whileHover, whileTap
<motion.button
    whileHover={{ scale: 1.05 }}
    whileTap={{ scale: 0.95 }}
    transition={{ duration: motionTokens.duration.fast }}
/>

// whileInView (появление при скролле)
<motion.div
    initial={{ opacity: 0, y: 20 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true, margin: "-100px" }}
/>

// useScroll (параллакс)
const { scrollYProgress } = useScroll();
const y = useTransform(scrollYProgress, [0, 1], [0, -200]);

// AnimatePresence (маунт/анмаунт)
<AnimatePresence mode="wait">
    {isVisible && (
        <motion.div
            key="modal"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
        />
    )}
</AnimatePresence>

// Layout animation
<motion.div layout layoutId="shared-element" />

// Stagger children
const container = {
    animate: { transition: { staggerChildren: 0.05 } }
};
const item = {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 }
};
```

### GSAP + ScrollTrigger + Lenis

```javascript
// GSAP (бесплатно с 2024):
gsap.to(".element", {
    x: 100,
    duration: 1,
    scrollTrigger: {
        trigger: ".element",
        start: "top center",
        end: "bottom center",
        scrub: true
    }
});

// Lenis (smooth scroll):
const lenis = new Lenis({ lerp: 0.1 });
function raf(time) { lenis.raf(time); requestAnimationFrame(raf); }
requestAnimationFrame(raf);
```

---

## 27. WEB-ЭФФЕКТЫ АРСЕНАЛ

### 3D / WebGL

| Библиотека | Назначение | Бесплатно |
|------------|------------|-----------|
| Three.js | 3D сцены, модели, шейдеры | ✅ |
| @react-three/fiber | React обёртка Three.js | ✅ |
| @react-three/drei | хелперы (OrbitControls, Text, etc) | ✅ |
| Vanta.js | готовые 3D фоны (birds, fog, waves) | ✅ |
| Spline | визуальный 3D редактор | ✅ (free tier) |

### Анимации

| Библиотека | Назначение | Бесплатно |
|------------|------------|-----------|
| GSAP + ScrollTrigger | scroll-анимации | ✅ (с 2024) |
| Lenis | smooth scroll | ✅ |
| Anime.js | лёгкие анимации | ✅ |
| Motion (Framer Motion) | React анимации | ✅ |
| Lottie | JSON-анимации | ✅ |
| tsParticles | частицы | ✅ |
| Rive | интерактивные анимации | ✅ (runtime) |

### UI блоки

| Библиотека | Назначение |
|------------|------------|
| shadcn/ui | headless компоненты |
| Magic UI | анимированные компоненты |
| Aceternity UI | 3D/WebGL эффекты |
| uiverse.io | CSS-only элементы |
| reactbits.dev | React эффекты |
| 21st.dev | premium компоненты ($TWENTY_FIRST_API_KEY) |

### Генерация / Медиа

| Инструмент | Назначение |
|------------|------------|
| Pollinations/FLUX | бесплатная генерация изображений |
| Gemini | текст + изображения (3 ключа) |
| Fal.ai | AI генерация (видео, изображения) |
| gradio_client | HF Spaces (Nano Banana Pro, FLUX, wan-2-2) |

### Конвертация / Оптимизация

```bash
# Изображения → WebP:
sharp-cli input.png -o output.webp --quality 80

# GIF → MP4:
ffmpeg -i anim.gif -movflags +faststart -pix_fmt yuv420p -vf "scale=trunc(iw/2)*2:trunc(ih/2)*2" output.mp4

# SVG оптимизация:
svgo input.svg -o output.svg

# Squoosh (CLI):
squoosh-cli --webp '{"quality":75}' input.png
```

---

## 28. CRON И АВТОПИЛОТ

### cron_once.sh — один тик автопилота

```bash
#!/usr/bin/env bash
# Детерминированно, без LLM. Триггер-сессия просто вызывает этот скрипт.
set -o pipefail
cd "$(dirname "$0")"; FACT="$(pwd)"; REPO="$(cd ../.. && pwd)"
source <(base64 -d "$REPO/secrets.env.b64") 2>/dev/null || true
export CURL_CA=/root/.ccr/ca-bundle.crt

# Свежий код (git pull)
cd "$REPO" && git pull -q origin <branch> 2>/dev/null; cd "$FACT"

# Среда
bash setup_env.sh > work/_setup.log 2>&1
grep -q "ENV READY" work/_setup.log || { echo "ENV_NOT_READY"; exit 1; }

# Здоровье (раз в час)
HMARK="work/.health_$(date -u +%Y%m%d%H)"
[ ! -f "$HMARK" ] && { bash health.sh > work/_health.log 2>&1; touch "$HMARK"; }

# Квота + пейсинг
REMAIN=$(python3 quota.py check 2>/dev/null || echo 0)
[ "${REMAIN:-0}" -le 0 ] && { echo "QUOTA_DONE"; exit 0; }
SLOT=$(python3 quota.py slot 2>/dev/null || echo 0)
[ "${SLOT:-0}" -le 0 ] && { echo "PACED_WAIT"; exit 0; }

# Чистка очереди от опубликованного
python3 -c "
import json,os,glob
posted = json.load(open('posted_reels.json')) if os.path.exists('posted_reels.json') else {}
pub = set(k for k,e in posted.items() if e.get('yt_id') or e.get('tt_id') or e.get('ig_code'))
for f in glob.glob('scripts/queue/*.json'):
    if os.path.basename(f)[:-5] in pub: os.remove(f)
" 2>/dev/null

# Автодозаливка очереди (>=12 свежих сценариев)
python3 gen_scripts.py topup 12 >/dev/null 2>&1

# Следующий сценарий (ротация приложений)
NEXT=$(python3 pick_next.py)
[ -z "$NEXT" ] && { echo "QUEUE_EMPTY"; exit 0; }
ID=$(basename "$NEXT" .json)

# Анализ конкурентов
timeout 200 python3 recon.py "$APP" brief "$ID" 2>&1 | tail -1

# Полировка (humanizer + хук + виральность)
python3 script_polish.py "scripts/$ID.json" 2>&1 | tail -1

# Сборка + публикация
OUT=$(bash auto_run.sh "$ID" "$CAPTION" "$YT_TITLE" 2>&1 | tail -3)
if echo "$OUT" | grep -q "AUTO_DONE"; then
    python3 quota.py inc
    git rm -q "$NEXT"; git add -A
    git commit -q -m "autopilot: $ID"
    git push -q origin <branch>
    echo "BUILT $ID"
else
    echo "FAILED $ID"
    exit 2
fi
```

### Настройка триггера (Claude Code Remote)

```python
# Ежечасный тик 06:00-20:00 UTC (09:00-23:00 МСК):
create_trigger(
    name="<project>-autopilot",
    prompt="cd <project>-app/factory && bash cron_once.sh",
    cron_expression="0 6-20 * * *"
)

# Ежедневная аналитика 07:00 UTC (10:00 МСК):
create_trigger(
    name="<project>-analytics",
    prompt="cd <project>-app/factory && python3 analytics.py daily",
    cron_expression="0 7 * * *"
)
```

### Ротация приложений/тем

```python
# Для проекта с несколькими приложениями/темами:
# spy → brain → tape (или кастомные)
# Ротация через .last_app файл

order = ["theme_a", "theme_b", "theme_c"]
last = open(".last_app").read().strip() if os.path.exists(".last_app") else ""
start = (order.index(last) + 1) % len(order) if last in order else 0
# Выбрать следующую тему в ротации
```

---

## 29. TELEGRAM-БОТ

### Уведомления

```python
import requests

BOT_TOKEN = os.environ["TELEGRAM_BOT_TOKEN"]
CHAT_ID = "<owner_chat_id>"  # ID чата владельца

def notify(text, parse_mode="Markdown"):
    requests.post(
        f"https://api.telegram.org/bot{BOT_TOKEN}/sendMessage",
        json={"chat_id": CHAT_ID, "text": text, "parse_mode": parse_mode}
    )

# Типы уведомлений:
notify("✅ Собран и опубликован: gspy_001 (TT+YT+IG)")
notify("🏆 ХИТ! gspy_001 набрал 500K просмотров за 24ч")
notify("⚠️ Ошибка сборки: gspy_002 (ffmpeg timeout)")
notify("📊 Дневной отчёт: 7/8 роликов, avg 12K views")
```

### Отправка файлов

```python
def send_video(video_path, caption=""):
    with open(video_path, "rb") as f:
        requests.post(
            f"https://api.telegram.org/bot{BOT_TOKEN}/sendVideo",
            data={"chat_id": CHAT_ID, "caption": caption},
            files={"video": f}
        )

def send_photo(photo_path, caption=""):
    with open(photo_path, "rb") as f:
        requests.post(
            f"https://api.telegram.org/bot{BOT_TOKEN}/sendPhoto",
            data={"chat_id": CHAT_ID, "caption": caption},
            files={"photo": f}
        )
```

---

## 30. VPS БРАУЗЕР-АГЕНТ

### Конфигурация

```
Хост: okoagents.okoteam.top (или $OKO_VPS_CTRL_URL)
Аутентификация: Bearer $OKO_VPS_CTRL_TOKEN
Браузер: patchright (форк Playwright с антидетект)
```

### Возможности

```
1. Instagram публикация (Reels, Stories, Posts)
   - Стелс-вход через saved session
   - Обход rate limits
   - Автоматические retry

2. Скрапинг конкурентов
   - Сбор данных с публичных профилей
   - Скриншоты

3. Мониторинг
   - ig_list.mjs — чтение ленты
   - ig_delete.mjs — удаление дефектных постов
```

### API вызовы

```bash
# Статус агента:
curl -s "$OKO_VPS_CTRL_URL/status" -H "Authorization: Bearer $OKO_VPS_CTRL_TOKEN"

# Публикация в IG:
curl -X POST "$OKO_VPS_CTRL_URL/ig/post" \
  -H "Authorization: Bearer $OKO_VPS_CTRL_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"account": "...", "video_url": "...", "caption": "...", "type": "reel"}'

# Чтение ленты:
curl -s "$OKO_VPS_CTRL_URL/ig/feed?account=..." \
  -H "Authorization: Bearer $OKO_VPS_CTRL_TOKEN"
```

---

## 31. ХОСТИНГ И ДЕПЛОЙ

### Higgsfield Websites

```python
# Создание сайта:
create_website(name="my-project", domain="...")

# Деплой:
# 1. website_repo_access → клонировать репо
# 2. Скопировать файлы в app/src/
# 3. git commit + push
# 4. deploy_website(env="production")

# Статус:
website_status(website_id="...")
```

### Cloudflare (CDN/DNS)

```bash
# DNS запись:
curl -X POST "https://api.cloudflare.com/client/v4/zones/$ZONE_ID/dns_records" \
  -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"type":"CNAME","name":"sub","content":"target.example.com","proxied":true}'
```

---

## 32. ОНБОРДИНГ НОВОГО КЛИЕНТА

### brand_profile.json — шаблон

```json
{
    "client_name": "Название проекта",
    "apps": ["app1", "app2", "app3"],
    "brand": {
        "primary_color": "#000000",
        "accent_color": "#9AFF00",
        "heading_font": "Bebas Neue",
        "body_font": "Montserrat",
        "logo_path": "assets/logo.png",
        "watermark_path": "assets/watermark.png"
    },
    "socials": {
        "tiktok": {
            "handle": "@project",
            "hooppy_page_id": null
        },
        "youtube": {
            "channel_id": "UC...",
            "channel_name": "Project"
        },
        "instagram": {
            "handle": "project",
            "login_email": ""
        }
    },
    "content": {
        "languages": ["ru", "en"],
        "default_voice_m": "ru-RU-DmitryNeural",
        "default_voice_f": "ru-RU-SvetlanaNeural",
        "tone": "confident, energetic",
        "target_audience": "18-35, tech-savvy",
        "forbidden_topics": [],
        "cta_default": "Скачай приложение"
    },
    "quota": {
        "start_date": "2026-08-05",
        "ramp_days": 5,
        "ramp_quota": 3,
        "base_quota": 5,
        "max_quota": 15,
        "growth_every_days": 2
    },
    "competitors": [
        "https://youtube.com/@competitor1",
        "https://tiktok.com/@competitor2"
    ]
}
```

### Шаги онбординга

```
1. Заполнить brand_profile.json
2. Создать ветку: git checkout -b <project>.app
3. Создать структуру каталогов (mkdir -p factory/...)
4. Загрузить шрифты в assets/fonts/
5. Загрузить логотип и водяной знак
6. Настроить Hooppy page_id (для TikTok)
7. Настроить YouTube OAuth tokens
8. Настроить IG аккаунт на VPS
9. Добавить ключи в secrets.env.b64
10. Запустить setup_env.sh
11. Создать первый сценарий вручную
12. Протестировать полный цикл (сборка → публикация)
13. Настроить cron trigger
14. Настроить Telegram уведомления
```

---

## 33. ЧЕКЛИСТ DEFINITION OF DONE

### Для каждого ролика

```
□ 1.  Сценарий прошёл humanizer + оценку виральности ≥ 7
□ 2.  Хук ≤ 3 сек, цепляющий (не generic)
□ 3.  Озвучка чистая, без артефактов
□ 4.  Футаж HD+, portrait 1080×1920
□ 5.  Оверлеи синхронизированы с озвучкой
□ 6.  Субтитры ASS наложены, читаемы
□ 7.  Музыка с ducking, не заглушает голос
□ 8.  SFX расставлены по типам оверлеев
□ 9.  ffprobe: 1080×1920, 30-59 сек, h264, аудио есть
□ 10. Нет дублей (проверка gen_ledger + posted_reels)
□ 11. Опубликовано на 3 платформы (TT + YT + IG)
□ 12. Записано в posted_reels.json + quota inc
```

---

## 34. ИЗВЕСТНЫЕ ОГРАНИЧЕНИЯ

### Технические лимиты

```
1. edge-tts: иногда обрывает на длинных текстах (>500 слов)
   → Решение: разбивать на сегменты по 200 слов

2. ffmpeg xfade: не работает с разной длительностью потоков
   → Решение: нормализовать длительность сегментов

3. Pexels/Pixabay: rate limit ~200 запросов/час
   → Решение: кэширование, ротация ключей

4. WebM alpha: -c:v libvpx-vp9 ОБЯЗАТЕЛЬНО ПЕРЕД -i
   → Критическая ошибка, если забыть

5. Chromium headless: нужен --no-sandbox для root
   → Флаг добавляется автоматически

6. YouTube Shorts: макс 60 сек, 9:16 aspect ratio
   → Валидация в qc.py

7. TikTok: макс 10 мин, рекомендуется 15-60 сек
   → Оптимально 30-45 сек

8. Instagram Reels: макс 90 сек
   → Оптимально 30-60 сек

9. Hooppy API: иногда 429 (rate limit)
   → retry_thumbs.py для самозаживления

10. Claude Code Remote: timeout контейнера ~60 мин без активности
    → Cron trigger поддерживает сессию живой
```

### Обходы

```
- ZIP/tar блокируется в некоторых средах → использовать SendUserFile
- Прямой PostgreSQL (5432) закрыт → Supabase Management API
- Node fetch через прокси не ходит → использовать curl
- Lottie CDN может быть заблокирован → inline JSON
- Генерация Gemini-изображений требует биллинг → Pollinations/FLUX (бесплатно)
```

---

## 35. ПОЛНЫЙ ФАЙЛОВЫЙ СТАНДАРТ

### Структура проекта

```
<project>-app/
├── factory/
│   ├── setup_env.sh              # холодный старт среды
│   ├── cron_once.sh              # один тик автопилота
│   ├── auto_run.sh               # сборка + публикация одного ролика
│   ├── quota.py                  # квота и пейсинг
│   ├── gen_scripts.py            # генерация сценариев
│   ├── script_polish.py          # humanizer + хук + виральность
│   ├── recon.py                  # анализ конкурентов (быстрый)
│   ├── recon_deep.py             # анализ конкурентов (глубокий)
│   ├── qc.py                     # контроль качества
│   ├── health.sh                 # проверка здоровья
│   ├── make_reel4.sh             # FFmpeg сборка видео v4
│   ├── render_ov3.py             # рендер оверлеев
│   ├── gen_subs.py               # генерация ASS субтитров
│   ├── fetch_clip.py             # загрузка стокового видео
│   ├── retry_thumbs.py           # добор обложек YouTube (429 recovery)
│   ├── analytics.py              # сбор аналитики
│   ├── publish.sh                # публикация на платформы
│   ├── anim.js                   # движок оверлеев (34+ компонента)
│   ├── brand_profile.json        # бренд-профиль клиента
│   ├── daily_state.json          # дневное состояние (автоген)
│   ├── gen_ledger.json           # реестр сгенерированных ID
│   ├── posted_reels.json         # реестр опубликованных роликов
│   ├── used_footage.json         # реестр использованного футажа
│   ├── .last_app                 # последнее приложение (ротация)
│   │
│   ├── scripts/
│   │   ├── queue/                # очередь сценариев (*.json)
│   │   └── *.json                # активные сценарии
│   │
│   ├── work/                     # рабочая директория (автоген)
│   │   ├── <id>_voice.mp3        # озвучка
│   │   ├── <id>_words.json       # тайминги слов
│   │   ├── <id>_subs.ass         # субтитры
│   │   ├── <id>_ov.webm          # оверлей (alpha)
│   │   ├── <id>.mp4              # финальное видео
│   │   └── _setup.log            # лог среды
│   │
│   ├── assets/
│   │   ├── fonts/                # шрифты бренда
│   │   ├── shapes/               # маски (SVG/PNG)
│   │   ├── covers/               # обложки
│   │   └── logo.png              # логотип
│   │
│   ├── aud_sfx/
│   │   ├── _pool.json            # пул SFX
│   │   ├── impact_01.wav         # звуковые эффекты
│   │   └── ...
│   │
│   └── analysis/
│       ├── daily_*.json          # дневная аналитика
│       ├── perf_flag.json        # флаг просадки
│       └── *_brief_*.json        # анализ конкурентов
│
├── docs/
│   └── CONTENT_FACTORY_KIT.md    # этот документ
│
└── secrets.env.b64               # ключи (base64, НЕ в git!)
```

---

## ПРИЛОЖЕНИЕ A: ПОЛНЫЙ СПИСОК EDGE-TTS ГОЛОСОВ

```bash
# Получить актуальный полный список:
python3 -c "
import edge_tts, asyncio
async def main():
    voices = await edge_tts.list_voices()
    for v in sorted(voices, key=lambda x: x['Locale']):
        print(f\"{v['ShortName']:40s} {v['Locale']:10s} {v['Gender']}\")
asyncio.run(main())
"
# Результат: 400+ голосов на 75+ языках
```

## ПРИЛОЖЕНИЕ B: FFMPEG ФИЛЬТРЫ — ШПАРГАЛКА

```bash
# Масштабирование (portrait):
scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920

# Затемнение:
eq=brightness=-0.15:contrast=1.1

# Виньетка:
vignette=PI/4

# Blur:
boxblur=10:10

# Цветокоррекция:
colorbalance=rs=0.1:gs=-0.1:bs=0.2

# Скорость (замедление/ускорение):
setpts=0.5*PTS    # 2x ускорение
setpts=2.0*PTS    # 2x замедление

# Зеркало:
hflip

# Текст:
drawtext=text='Hello':fontfile=font.ttf:fontsize=48:fontcolor=white:x=(w-tw)/2:y=(h-th)/2

# Водяной знак:
overlay=W-w-20:H-h-20

# Fade in/out:
fade=t=in:st=0:d=0.5,fade=t=out:st=29:d=0.5

# Loop:
-stream_loop -1

# Обрезка аудио:
-af "afade=t=in:d=0.5,afade=t=out:st=28:d=2"

# Нормализация громкости:
-af loudnorm=I=-16:TP=-1.5:LRA=11
```

## ПРИЛОЖЕНИЕ C: ФОРМАТ ВЫВОДА АВТОПИЛОТА

```
# Успешный тик:
[health] ALL_OK
[thumbs] 2/5 recovered
BUILT gspy_fitness_023 | остаток очереди: 8 | квота: date=2026-08-05 quota=12 done=7 remaining=5

# Квота исчерпана:
QUOTA_DONE (date=2026-08-05 quota=12 done=12 remaining=0)

# Ожидание слота:
PACED_WAIT — не время слота (date=2026-08-05 quota=12 done=5 remaining=7 due_by_now=5)

# Пустая очередь:
QUEUE_EMPTY — генератор не дал сценариев

# Ошибка сборки:
FAILED gspy_fitness_024 (см. work/gspy_fitness_024_auto.log)

# Среда не готова:
ENV_NOT_READY
```

---

**Версия документа:** 1.0
**Дата создания:** 2026-08-05
**Автор:** Контент-завод OKO
**Лицензия:** Внутренний документ, не для публичного распространения

---

*Этот документ содержит ВСЕ правила, инструкции, рецепты, API, библиотеки и конфигурации
для запуска автоматизированного контент-завода на ЛЮБОМ проекте. Адаптировать через
brand_profile.json и переменные окружения.*


---

## ⚠️ ГЛАВНЫЙ ЗАКОН ЗАВОДА
Обязательный порядок на каждый ролик + жёсткий запрет повторов внутри проекта —
`FACTORY_PROTOCOL.md` (в этой же папке скилла). Читать первым при триггере «контент-завод».
