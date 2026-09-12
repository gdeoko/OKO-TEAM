# V.CODE — ПОЛНЫЙ КОНВЕЙЕР 5 СТАДИЙ (на КАЖДЫЙ ролик, всегда с нуля, без шаблонов)

Правило: перед каждым роликом — заново. Всё разнообразное, ничего не повторяется ни внутри
ролика, ни между роликами (реестры USED_*). Цель — миллион просмотров.

Ключи: `set -a && . ~/.oko/secrets.env && set +a`
(TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID, HF_TOKEN, PEXELS_API_KEY, KAGGLE_API_TOKEN…).

## СТАДИЯ 1 — АНАЛИЗ КОНКУРЕНТОВ  (`pipeline/research/`)
```
python3 pipeline/research/discover.py "ниша" --queries "q1|q2|q3" --n 5 --min-views 1000000 --outdir /tmp/r
```
- Находит ролики 1М+ (YouTube), **всегда разные** — дедуп `research/USED_COMPETITORS.md`.
- Метрики (просмотры/лайки/комменты/подписчики), транскрипт (субтитры),
  **раскадровка через storyboard-спрайты sb0 — без cookies и без скачивания видео** (обход 403).
- Claude читает `storyboard.jpg` + транскрипт → разбор хука/сценария/воронки/описания/продукта.
- Документ: `python3 pipeline/research/report.py research.json analysis.json out.html --pdf out.pdf`
  → `python3 pipeline/research/send_to_bot.py doc out.pdf "Аналитика"` — красиво в бота.
- Instagram — по мере доступности (cookies/скрапер); сейчас YouTube.
- (Активность лайки/подписки — по решению Даниэля НЕ делаем, вместо соцсетей постим в бота.)

## СТАДИЯ 2 — СЦЕНАРИЙ  (`pipeline/scenario/`)
Claude пишет `scenario.json` по анализу (связка с брендом). Гейт:
```
python3 pipeline/scenario/scenario_check.py scenario.json      # pass≥70, иначе правит
```
Проверяет: хук (триггер/длина), структуру, **Humanizer (анти-ИИ)**, виральность, дедуп
(`USED_SCENARIOS.md`). Пропорция 50% виральные / 30% полезные / 20% продающие.

## СТАДИЯ 3 — СБОРКА  (reels-machine: `SKILL.md` + `pipeline/motion/`, `build_reel.py`)
- Стоки 4К меняются 3–5с, 10–14 УНИКАЛЬНЫХ клипов (Pexels/Pixabay), мимо `USED_FOOTAGE`.
- Наложения/инфографика/3D/переходы каждые 3–5с — НОВЫЕ, мимо `USED_ANIM` (Три закона).
- Обложка: Higgsfield `nano_banana_pro` (9:16), фолбэк — сток+текст.
- Озвучка: `python3 pipeline/voice_omnivoice/vcode_voice.py "текст sN" vo/sN.mp3 --json vo/sN.json`
  (голос Владимира OmniVoice, 1.8×, авто-обрезка призвука, тайминги слов для караоке). Проверить паузы/ударения.

## СТАДИЯ 4 — QA + ПУБЛИКАЦИЯ В БОТА  (`pipeline/publish/`)
```
python3 pipeline/publish/qa_check.py reel.mp4 --cover cover.jpg --clips 12 --overlays 9 --score-scenario 88
python3 pipeline/publish/publish_bot.py reel.mp4 --cover cover.jpg --report report.json
```
QA: вертикаль 1080×1920, аудио, длит 12–60с, динамика кадров/наложений, оценка «залёта».
Публикация: ролик + обложка + отчёт-карточка (сценарий/QA/оценки) → @vcodemedia_bot.
Запись в реестры USED_*; commit+push V.Code.

## СТАДИЯ 5 — ОТЧЁТ 10:00 МСК  (`pipeline/daily_report.py`, рутина 0 7 * * * UTC)
```
python3 pipeline/daily_report.py "ниша"
```
Свежий разбор конкурентов дня → документ → бот. Рутина запускает полный цикл каждое утро.

---
### Статус реализации (честно)
- ✅ Стадии 1, 2, 4, 5 — код готов и проверен (research→бот, гейты, публикация, рутина 10:00).
- 🔨 Стадия 3 — движки сборки в reels-machine есть; выполняется скиллом при сборке.
- 🔑 Полная покадровая раскадровка YouTube-видео (не спрайты) и Instagram-источник — по cookies.
- Higgsfield-обложка в утренней рутине — только если у сессии есть коннектор; иначе фолбэк.
