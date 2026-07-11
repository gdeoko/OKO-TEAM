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
