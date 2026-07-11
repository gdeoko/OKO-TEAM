# PandaGo Cargo — кино-страница (/cine/)

Scroll-scrub кинопролёт: фон = единый фильм V1..V5, скролл двигает image-sequence
(canvas), блоки вылетают синхронно с движением камеры.

## Деплой
Статика: репо Higgsfield `forest-beach-360` (website_id 96269fa0-7465-4a92-89d5-bdc51f4cec87),
путь `app/public/cine/`. Живая ссылка: https://forest-beach-360.higgsfield.app/cine/

## Ассеты (не в git — тяжёлые)
- Клипы (Minimax Hailuo, variant minimax, 1080, 6s, FLF на реальных фото), job-id:
  V1 склад→порт   be1e155b-ef36-4cf8-b8fa-9d957306f9ed
  V2 порт→трасса  f0b485c7-9bc2-49f3-9fbb-35a833f6b00c
  V3 трасса→перевал 5ac68106-ff2d-4853-8a8c-cb32926c5dcf
  V4 перевал→Москва 68973a07-9ae5-40af-b8ae-850082102404
  V5 Москва→выгрузка 26b07f2f-482a-40fa-a3c0-fb7683b7938d
  (скачать: mcp Higgsfield job_display → results.rawUrl)

## Пересборка scrub-кадров
ffmpeg concat V1..V5 -> FILM_master.mp4, затем:
  ffmpeg -i FILM_master.mp4 -vf "select='not(mod(n,2))',scale=1152:648:flags=lanczos" \
    -vsync 0 -c:v libwebp -quality 60 assets/frames/f_%04d.webp   (355 кадров)

## TODO
Реальные цены/каталог, бэкенд формы (Supabase + Telegram), панда-маскот,
2 WebGL-портала на стыках, перенос на главную (если Даниэль одобрит).

## v0.3 — 4K AI-апскейл (детализация «как в игре»)
Клипы прогнаны через ByteDance video upscale в 4K (3840x2160), preset aigc.
Цена: ~0.47 кр/клип (6с), весь фильм ~2.3 кр. Апскейл job-id:
  V1 995de74e-752e-4803-8f34-00a376a78668
  V2 a2311da1-ca27-40b2-98a6-6142f015c52c
  V3 3abb1e19-6ba6-4980-8c03-b7a2eb652c7d
  V4 78108b4d-af2a-406b-aba6-bb9e10415e19
  V5 f372b71f-9b71-49dd-962c-e6e8ca2c0127
Наборы кадров из FILM_master_4k.mp8:
  land 1600x900 q84 (каждый 2-й, 355), port центр-кроп 1215x2160 из 4K -> 1080x1920 q80 (каждый 3-й, 237)
Сайт выбирает набор по ориентации (portrait -> port). Вес: land 27MB, port 13MB.

## Разлёт квадрика + 3D техника (для секции video->3D)
- Разлёт квадрика (FLF-петля, start=end=hero_atv_studio media 76981f68), minimax:
  видео job 5a7ae291-d582-4b1d-824d-02fef08e287e -> 4K апскейл 75e61fff-2c15-45a6-8bbf-b6f15ef54a14
  (EXPLODE_1080.mp4 / EXPLODE_4K.mp4 3866x2160). Последний кадр = студийное фото
  квадрика -> бесшовный переход в интерактивный 3D.
- 3D мото: multi_image_to_3d job db5fb876-ca0d-47ab-99c1-544109a31f68 -> 3d/moto.glb (1.5MB)
- 3D гидроцикл: multi_image_to_3d job 9469f593-1d73-43d8-94ba-2c9870b72fa2 -> 3d/jetski.glb (1.2MB)
  (оба без текстуры, под бренд-материал dark+cyan в three.js; рендер-превью через quadview/render.html)
- Квадрик 3D (ранее): 3d/quad_grizzly.glb (21MB).
- Секция задумана: разлёт-видео -> 3D (квадрик центр, мото слева, гидро справа), вращение мышью/тачем.
  ЖДЁТ ОДОБРЕНИЯ Даниэля перед вставкой в сайт.

## Отложено (по слову Даниэля «потом»)
Ещё поднять качество/убрать лёгкое мыло, снизить вес и стартовый лаг прогрузки,
сделать более ровные/красивые появления блоков (текст/карточки/эффекты) по скроллу.

## v1.0 — полный сайт DIESEL CARGO (ребрендинг с PandaGo) на КОРНЕ
Живая ссылка: https://forest-beach-360.higgsfield.app (корень, ассеты в app/public/dc/).
Старый прототип сохранён в app/public/legacy-prototype.html.
Сценарий: 4K scroll-фильм (Гуанчжоу→Москва, блоки hero/шаги/статы/каталог) →
финальная сцена → разлёт квадрика (video vp9+h264) → бесшовно интерактивный 3D
(десктоп ряд из 3, моб одна модель + табы) → калькулятор (aurora WebGL) →
сравнение с дилером → гарантии (панель-маршрут SVG + Lottie-пульс, панду убрали) →
отзывы (marquee) → форма заявки → футер.
Техно: three.js GLB (quad/moto/jetski лёгкие), WebGL aurora-шейдер (React-Bits-дух),
Lottie (lottie-web + pulse.json), VP9/webm+h264, image-sequence scrub, reveal-on-scroll.
Правки: дубль id "stage" (фильм vs 3D) → 3D переименован в showstage; секции
непрозрачные + body.film-done прячет фикс.фильм/оверлеи/хребет; ассеты dc/ (не конфликт
со старым assets/). copy-check чист, QA десктоп+моб пройден.

## v1.1 — доработка красоты/эффектов (фидбек Даниэля)
- 3D: MeshStandardMaterial тёмно-синий металлик + envMapIntensity + onBeforeCompile
  fresnel-emissive cyan-rim (свечение по краям) с hover-усилением (raycast); свет-подиум
  (radialTex additive), контактные тени, линия-горизонт убрана; камера портрета pz5.3.
- Карточки/заголовки: стекло + градиентная рамка (mask-composite) + спотлайт ::after
  (--mx/--my по pointermove) + шиммер (background sheen); скрим за текстом глав фильма.
- Видео: портрет пересобран каждый 5-й кадр (142 шт, q84) = 8.7MB (было 13MB); scrub-lerp 0.09->0.16.
- Мобилка: подписи 3D flex-fit, карточки не режутся. scroll-снап к секциям (JS smooth).
- Бренд DIESEL CARGO. Живо на КОРНЕ forest-beach-360.higgsfield.app (v1.1).
