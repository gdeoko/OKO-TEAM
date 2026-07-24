# AUTOBUILD — полный цикл авто-сборки ролика DIESEL (с нуля, БЕЗ повторов)

Выполняет свежая автосессия по расписанию. Цель: собрать ОДИН новый ролик/пост
и положить в очередь VPS. Публикует VPS-крон (10/15/20 МСК). Вручную НЕ публиковать.

Ключи в env (SessionStart-хук из secrets.env): `$OKO_VPS_CTRL_URL`, `$YT_REFRESH_TOKEN`,
`$PEXELS_API_KEY`, `$PIXABAY_API_KEY`, `$GEMINI_API_KEY`, `$HF_TOKEN` и др.

## КЛИЕНТ И КОНТЕНТ-МИКС (ВАЖНО)
DIESEL CARGO — импорт из Китая, dieselcompany.pro, бренд чёрный+амбер #EA5920.
**КОНТЕНТ-МИКС (правка 21.07): СНЕГОХОДЫ НЕ ДЕЛАЕМ вообще.** Порядок частоты:
1. ОСНОВА — **КВАДРО (квадроциклы/ATV) и МОТО (мотоциклы)** (большинство роликов).
2. **ГИДРО (гидроциклы/джетски)** — ИЗРЕДКА.
3. **Спецтехника** (экскаваторы/погрузчики) — РЕЖЕ ВСЕГО (1 из ~8–10).
Снегоходы/скутеры-если-не-просили — исключить. Ротация тем внутри квадро/мото.
Формат: в основном Reels, но ИНОГДА — карусель (подборка/сравнение) или Stories. Чередовать.

## ЗАКОН РАЗНООБРАЗИЯ (ЖЁСТКО — визуальный язык наложений НЕ должен повторяться)
Претензия Даниэля (повторная): у роликов был ОДИН визуальный язык наложений (стеклянные амбер-плашки,
кольцо-%, галочки, маршрут-точка) — менялся только текст. Это брак. Меняется ВИЗУАЛ, не только слова.

Движок моушен-графики `pipeline/build_accents.py` теперь содержит БОЛЬШУЮ библиотеку механик с РАЗНЫМ
видом и РАЗНЫМИ зонами экрана. Типы: `bigstat`(полноэкранное число), `speedo`(спидометр со стрелкой),
`odometer`(счётчик-одометр), `lowerthird`(нижняя плашка), `vs`(сплит-сравнение), `linechart`(линейный график),
`iconrow`(спец-плитки), `sidebars`(столбчатый чарт), `donut`(сегментное кольцо), плюс классика
`ring/ticks/chips/bar/route/stamp/badge`. Каждый ролик:
- Выбирай механику ПО СМЫСЛУ данных: скорость→speedo, цена/цифра→odometer/bigstat, сравнение→vs,
  рост/динамика→linechart, набор характеристик→iconrow/sidebars, логистика→route, гарантия→donut/stamp.
- Бери 8–12 РАЗНЫХ механик, НЕ повторяя набор из прошлых 3–4 роликов (реестр в `USED.md`). Микшируй ЗОНЫ
  (полный экран / центр / низ-плашка / график внизу / верх), а не всё в верхней плашке.
- ОБЯЗАТЕЛЬНО задай per-reel стиль: `export OVL_STYLE=<0..4>` (0 стекло-тёплый, 1 сплошной-дарк, 2 контур-амбер,
  3 градиент-амбер, 4 фрост-белый) — РАЗНЫЙ у соседних роликов. Без OVL_STYLE берётся хэш сценария (тоже варьирует).
- Где по смыслу нужна картинка/иконка/моушен-элемент — добавляй (SVG/emoji-free иконки, простые GIF/Lottie),
  больше динамики и наложений. Инфографика — НАРИСОВАННАЯ КОДОМ под конкретную цифру/метафору.
- НОВЫЕ кадры (дедуп по `USED.md`), новый грейд, новая музыка/SFX, новая обложка-раскладка, новые переходы.
  Неизменны только бренд-константы: лого, амбер #EA5920, шрифты, голос Dmitry, эндкард.
- Красный флаг = «тот же набор плашек, поменян текст». Так НЕЛЬЗЯ — меняй САМИ механики и их вид.

## ЭТАП 0 — Активность + анализ конкурентов (перед сборкой)
1. Органика (без фанатизма, лимиты от бана): зайти в IG (браузер-агент на VPS, профиль diesel_cargo),
   поиск по нише/бренду (мото/квадро/гидро из Китая), подписаться на 2–3 аккаунта, лайк+коммент 3–5 конкурентам.
2. Анализ конкурентов: найти ~10 конкурентов в нише, отобрать РОЛИКИ ОТ 1 МЛН просмотров. По 5–10 таким:
   скачать → расшифровка (faster-whisper/Gemini) → раскадровка → разбор ХУКА, структуры, воронки, описания,
   лайков/комментов/репостов/подписок. Понять, ЧТО зашло у трендовых роликов.
3. Сценарий — С НУЛЯ на основе анализа (хук как у виральных, но свой оффер), прогнать логику через маркетинг-
   и медийность-скиллы (`marketing-psychology`, `hook-generator`, `oko-magic`/`reels-machine`). Адаптировать
   тренд под бренд DIESEL. Формальное «вы», без выдуманных цен, CTA «напишите город и задачу в комментариях».

## ЭТАП 1 — Рабочая копия пайплайна
```
ROOT=/home/user/OKO-TEAM/oko-app/factory
export FACTORY_ROOT=$ROOT FACTORY_FONTS=$ROOT/fonts FACTORY_LOGO=$ROOT/logo_hd.png
W=$SCRATCH/reel_$(date +%s); mkdir -p $W/{vo,foot,ig/html,segs,cover_cand}; export REEL_W=$W
cp $ROOT/pipeline/*.py $ROOT/pipeline/capture.js $W/; cp -r $ROOT/pipeline/html/* $W/ig/html/
cp -r $ROOT/pipeline/sfx $W/sfx; cp $ROOT/pipeline/endcard.mp4 $W/endcard.mp4
```
Пайплайн-скрипты — ОСНОВА, но под закон разнообразия ты ДОПОЛНЯЕШЬ/переписываешь механики оверлеев
(build_accents/новые code-инфографики) под конкретный ролик, а не просто меняешь данные.

## ЭТАП 2 — Сборка
- Озвучка **edge-tts ru-RU-DmitryNeural (нейросеть Azure, студийная, бесплатно/безлимит, без ключа — бренд-голос по ТЗ)**: `python3 pipeline/tts_edge.py $W/vo`. **Темп 1.5х по умолчанию** (`EDGE_TEMPO`, Даниэль 23.07). **Ударения на КАЖДОЕ слово** (RUAccent turbo3.1, различает омографы: за́мок/замо́к, сто́ят/стоя́т) — Azure чтит знак; доменный override — ru_stress_dict.py. STT-проверка слов: VOICE_VERIFY=1. Работает и локально (через прокси), и на VPS. Пер-сегментно → `$W/vo/s1..sN.mp3` под караоке. Нет призвуков/шума/глюков. Резерв (офлайн): Piper Ruslan `VOICE_PIPER=ruslan python3 pipeline/tts_piper.py $W/vo ruslan` или Silero `pipeline/tts_silero.py`.
- `python3 $W/plan.py` (timing/subs/words).
- 10–14 УНИКАЛЬНЫХ вертикальных клипов под сценарий (мото/квадро/гидро — Pexels/Pixabay/Shutterstock;
  для гидро: jet ski, для квадро: atv/quad bike, для мото: motorcycle ride). Проверить соответствие озвучке.
- НОВЫЕ code-оверлеи под тему (спидометр для мото, трек-волна для гидро, и т.д.), титры, обложка (make_cover).
- Собрать: `assemble.py` + overlays (capture.js→qtrle .mov, N=words.total*30) + `audio.py` (музыка+fade+duck+SFX) → `compose.py`.
- QC-сетка 12 кадров: 9:16, обложка ровная, субтитры 2 слова без обводки, инфографика в каждом кадре и НЕ как в прошлых, лицо не перекрыто, эндкард ровный.

## ЭТАП 3 — Описание (по ТЗ)
`meta.json {title, yt_desc, caption}`: и yt_desc, и caption = краткое содержание + польза + воронка
(«напишите город и задачу в комментариях») + **15–30 ключевых фраз для поиска ВНИЗУ без хештегов** + dieselcompany.pro.

## ЭТАП 4 — В очередь VPS (крон опубликует сам)
```
python3 - <<'PY'
import os,base64,glob,subprocess,requests,hashlib
URL=os.environ['OKO_VPS_CTRL_URL'];TOK=os.environ['OKO_VPS_CTRL_TOKEN'];W=os.environ['REEL_W']
H={"Authorization":f"Bearer {TOK}","Content-Type":"application/json"}
r=requests.post(URL+"/exec",headers=H,json={"cmd":"ls /opt/oko-poster/queue 2>/dev/null;echo ---;ls /opt/oko-poster/published 2>/dev/null"},timeout=30)
used=set(x for x in r.json()['stdout'].split() if x.isdigit())
nn=next(f"{i:03d}" for i in range(1,999) if f"{i:03d}" not in used)
requests.post(URL+"/exec",headers=H,json={"cmd":f"rm -rf /opt/oko-poster/queue/{nn}&&mkdir -p /opt/oko-poster/queue/{nn}/parts"},timeout=30)
subprocess.run(["split","-b","1500000","-d","-a","3",W+"/reel.mp4",W+"/part_"])
for f in sorted(glob.glob(W+"/part_*")):
  requests.post(URL+"/deploy",headers=H,json={"path":f"queue/{nn}/parts/"+os.path.basename(f),"content_b64":base64.b64encode(open(f,'rb').read()).decode()},timeout=120)
requests.post(URL+"/deploy",headers=H,json={"path":f"queue/{nn}/meta.json","content_b64":base64.b64encode(open(W+"/meta.json",'rb').read()).decode()},timeout=30)
# ОБЯЗАТЕЛЬНО: обложка в очередь (станет превью на YT/IG)
requests.post(URL+"/deploy",headers=H,json={"path":f"queue/{nn}/cover.jpg","content_b64":base64.b64encode(open(W+"/cover.jpg",'rb').read()).decode()},timeout=60)
loc=hashlib.md5(open(W+"/reel.mp4",'rb').read()).hexdigest()
rr=requests.post(URL+"/exec",headers=H,json={"cmd":f"cd /opt/oko-poster/queue/{nn}&&cat parts/part_*>reel.mp4&&rm -rf parts&&md5sum reel.mp4"},timeout=60)
print("QUEUED",nn,"MATCH",loc in rr.json()['stdout'])
PY
```
Дописать тему + id кадров + использованные механики оверлеев в `USED.md`, запушить в ветку `claude/new-session-xxozd5`.

## ПЛАН МАСШТАБА (не забывать)
Старт 3 ролика/день ПЕРВЫЕ 5 ДНЕЙ, затем равномерно наращивать до **15/день**, чтобы к концу августа
суммарно вышло **500 роликов**. Цель: 20k подписчиков, 100M просмотров. Ежедневно — органика (Этап 0).
Публикация разнесена по времени (10/15/20 МСК +) для анти-бана. Наращивание количества — через добавление
слотов cron постинга и слотов авто-сборки (контролируемо, не спам).

## ОТЛАДКА
Постер `publish_next.py` (retry-safe, IG не блокирует очередь после 3 попыток). Логи:
`/opt/oko-poster/logs/factory.log`, `logs/cron.log`.

## ОБЛОЖКА (правило Даниэля 24.07 — навсегда)
Обложка НЕ 2-сек интро в ролике. `plan.py COVER=0.05` = 1 кадр в начале. Обложка живёт как **превью-миниатюра**, которую постер цепляет ПРИ ПУБЛИКАЦИИ: YT `yt_upload.py`→`thumbnails/set` из cover.jpg (нужен верифиц. канал, иначе fallback), IG `IG_COVER=cover.jpg`. 1-й кадр видео = обложка (fallback-превью). Ролик стартует ХУКОМ сразу, без статичной заставки. cover.jpg ОБЯЗАТЕЛЬНО в очередь.
