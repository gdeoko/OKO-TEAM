# IMPLEMENTATION — рабочий боевой движок (v4), проверено на Tappio

Этот файл — мост между абстрактным SKILL.md и РЕАЛЬНЫМ кодом, который уже собирает
эталонные ролики. Код живёт в репозитории OKO-TEAM: `tappio-app/factory/`. Копии ключевых
скриптов — в `pipeline/` этого скилла. Ниже — что работает, как запускать, и проверенные
боем рецепты (2026-07-16).

## Быстрый запуск одного ролика (v4)
```bash
cd tappio-app/factory
bash make_reel4.sh <script_id>       # scripts/<script_id>.json -> output/<script_id>.mp4
```
Конвейер: `gen_vo → fetch_stock3 → fetch_music → make_shapes → render_ov3 → build4`.

## Файлы движка (в tappio-app/factory/, копии в pipeline/)
| Файл | Роль |
|---|---|
| `gen_vo.py` | edge-tts озвучка + тайминги слов (SentenceBoundary → распределение по словам) |
| `fetch_stock3.py` | Pexels: МНОГО уникальных вертикальных клипов, дедуп по video_id, кэш |
| `fetch_music.py` | уникальная музыка на ролик: Jamendo (полные треки) → Freesound (беды), выбор по mood+seed |
| `make_shapes.py` | генератор 8 форм-масок (feather ЧБ) + акцентных колец (свечение) под цвет бренда |
| `render_ov3.py` | АНИМИРОВАННЫЕ наложения-инфографика → прозрачный ProRes4444 mov (альфа) |
| `build4.py` | сборка: shots+xfade, формы-вставки, ИИ-обложка, инфографики, SFX-по-смыслу, караоке |
| `make_reel4.sh` | оркестратор одного ролика |

## Модель сценария (scripts/<id>.json) — SHOT-LIST
```jsonc
{
  "id":"spy_v4", "app":"spy",
  "voice":"en-US-AndrewNeural", "rate":"+6%", "grade":"teal_orange",
  "brand":{"accent":"#00D9FF","accent2":"#7CFCFF","code":"PRIVACY","logo":"spy.png","name":"SPY CAMERA FINDER"},
  "music":{"queries":["dark tension cinematic","suspense pulse electronic"]},   // mood → уникальный трек
  "cover":{"ai":"assets/ai_covers/spy_cover_1080.png","kicker":"...","top":"...","big":"IS WATCHING\nYOU"},
  "segments":[ {"id":"b1","text":"..."}, ... ],          // 5-7 битов озвучки → голос + караоке
  "shots":[                                              // 12-18 визуальных кадров (~2с каждый)
    {"q":["hidden spy camera macro lens"],"motion":"zin"},        // фулл-скрин с движением
    {"q":["smoke alarm ceiling white"],"insert":"hexagon","pos":"center"},  // форма-вставка
    {"visual":"DEMO:spy_scan"}                                    // app-демо
  ],
  "overlays":[                                           // 12-24 наложения, at=доля 0..1 контента
    {"at":0.09,"dur":1.7,"type":"stat_count","to":12,"prefix":"$","label":"COST","pos":"center"},
    {"at":0.23,"dur":2.0,"type":"bars","title":"WHERE THEY HIDE","items":[["Smoke detector",41],...]},
    {"at":0.40,"dur":1.7,"type":"ring","pct":83,"label":"RENTALS NEVER SCANNED"}
  ],
  "cta":{"text":"...","code":"PRIVACY"}
}
```

### Типы наложений (render_ov3.py, все анимированы)
`kicker` (чип), `stat_count` (счётчик count-up), `bars` (растущий бар-чарт со значениями),
`ring` (кольцо прогресса + %), `chips` (стаггер-появление пилюль), `lowerthird` (титр с wipe),
`kinetic` (крупная типографика scale-pop, авто-подбор кегля), `callout` (аннотация-кольцо),
`ticker` (метрика со стрелкой). Каждое — своя анимация под цифру/смысл (Закон 1).

### Формы-вставки (build4.render_insert + make_shapes)
`insert`: `circle, hexagon, phone, tv, tilt, diamond, rrect, arch`. Клип кладётся в форму
(alphamerge с feather-маской) + акцентное кольцо со свечением ПОВЕРХ затемнённого+размытого
фона (контраст затемнением, НЕ плашкой — Закон MOTION ARSENAL). Лёгкий дрейф `sin(t)`.
МИКС обязателен: часть кадров фулл-скрин с пан/зумом, часть — в формах. Не всё в формах.

## Проверенные боем рецепты (2026-07-16)

### ИИ-обложка — Nano Banana Pro (Higgsfield Ultra)
```
mcp__Higgsfield__balance                       # проверить subscription=ultra
mcp__Higgsfield__generate_image(model="nano_banana_pro",
  params={model:"nano_banana_pro", aspect_ratio:"9:16", count:1, prompt:"<богатый промпт,
    бренд-цвета, крупный АНГЛ/РУС заголовок в кавычках, NEGATIVE: watermark, gibberish>"})
# ВАЖНО: model дублировать И в params (иначе validation error). Модель отдаётся как nano_banana_2 — это ок.
mcp__Higgsfield__job_display(id)               # забрать rawUrl (cloudfront), curl --cacert /root/.ccr/ca-bundle.crt
ffmpeg scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920  # нормализовать
```
Прописать путь в `cover.ai`. Обложка идёт кадром 0 (thumbnail) + плавно уходит в бед.
HTML-обложка (render_ov3 cover_ov.png) — только аварийный фолбэк.

### Анимированные наложения → webm/mov с альфой
Playwright покадрово: `page.set_content` → `add_script_tag` (JS в IIFE, иначе `const` в глобале
конфликтует между наложениями) → цикл кадров `window.frame(p)` p:0..1 → screenshot
`omit_background=True` → `ffmpeg prores_ks -profile 4444 -pix_fmt yuva444p10le` (надёжная альфа;
vp9 `yuva420p` в этой сборке терял альфу → чёрный прямоугольник). Композит: overlay читает
альфу mov напрямую, сдвиг во времени `setpts=PTS+at/TB` + `enable='between(t,a,b)'`.

### Уникальная музыка на ролик
Jamendo API (публичный client_id-фолбэк `2c9a11b9`, свой в env лучше) `fuzzytags=<mood>` +
`audiodownload`. Freesound (`FREESOUND_API_KEY`) как беды. Выбор трека = `seed(id) % len`,
чтобы между роликами не повторялось. Проверено: Jamendo даёт полные royalty-free треки.

### Переходы
`xfade` 24 типа, ротация по seed: `offset_k = k*(D-XD)`, где D=длина кадра, XD=0.45.
Итоговая длина беда = `N*D-(N-1)*XD` = длине контента. (gl-transitions 125 — апгрейд на будущее.)

### Осмысленные SFX (build4)
`whoosh` на каждом переходе (`k*(D-XD)`), `impact` на КАЖДОЙ цифровой инфографике
(stat_count/ring/bars/ticker), `ding` на CTA. Музыка даккается под голос
`sidechaincompress`, мастер `loudnorm I=-14:TP=-1.5`.

### Длина и темп
20-45с (проверено: spy 39с, brain 43с, tape 45с). Кадр ~2.3с. Наложение почти непрерывно.
Если ролик >45с — подрезать текст `segments`.

## Что ещё НЕ внедрено (backlog апгрейдов из MOTION_ARSENAL)
- 3D-GLB фигуры (three.js локально, крутятся всю сцену) — движок не написан.
- gl-transitions (125) вместо 24 xfade.
- Lottie / WebGL-шейдеры / Spine-Rive как источники наложений.
- 2.5D-параллакс (Depth-Anything).
- Реестры USED_FOOTAGE/USED_ANIM автозапись (сейчас дедуп только внутри ролика).
- Разные состояния app-демо в одном ролике (сейчас два одинаковых DEMO).
- Gemini-аудит готового ролика (gemwatch) + virality_predictor.

## Ключи (из OKO_MASTER_VAULT / secrets.env)
PEXELS_API_KEY, FREESOUND_API_KEY, JAMENDO_CLIENT_ID(опц.), HF_TOKEN, Higgsfield (MCP Ultra),
Hooppy (постинг TikTok, page_id по клиенту), YT refresh-токены по клиенту. Пароли — только в
VAULT, не в код.
