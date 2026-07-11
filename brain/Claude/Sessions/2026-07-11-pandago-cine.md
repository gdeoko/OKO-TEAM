# 2026-07-11 · PandaGo кино-страница (scroll-scrub пролёт)

## Сделано
- Собран единый кинопролёт из 5 клипов (Minimax Hailuo, FLF на реальных фото
  Даниэля): V1 склад→порт, V2 порт→трасса, V3 трасса→перевал, V4 перевал→Москва,
  V5 Москва→выгрузка. Каждый клип = реальное движение камеры A→B, конец клипа =
  точное фото след. сцены → шов встык (ffmpeg concat, без crossfade).
- Переделки по фидбеку Даниэля: V1 (камера сквозь стену → теперь сквозь проём
  ворот), V2 (ускорение/уехавший кейс → спокойная камера), V5 (слайд → реальный
  3D-облёт, потом ещё раз на плавность), V4 (тёмная середина → свечение города).
  V3 оставлен. Все одобрены.
- Кино-страница /cine/: canvas image-sequence (355 webp, каждый 2-й кадр, 1152x648),
  scroll двигает кадры + lerp-сглаживание = плавно без обрывков. Блоки (hero/шаги/
  статистика-счётчики/каталог/форма) вылетают синхронно с движением камеры.
  Грейд+виньетка+зерно, маршрут-хребет справа, прогресс-бар. Бренд navy/electric/
  cyan, Unbounded/Golos/JetBrains Mono, copy-check чистый. Mobile 2×2.
- Задеплоено: https://forest-beach-360.higgsfield.app/cine/ (app/public/cine/).
  Прототип на главной не тронут.

## Грабли среды
- generate_video: medias кладутся ВНУТРЬ params; model=minimax_hailuo + variant=minimax
  (variant minimax-2.3 не поддерживает end_image). Флап MCP на тяжёлом вызове —
  джоб не создаётся, повторять. Preset-нотис "IN THE DARK" → declined_preset_id.
- Scrub: НЕ video.currentTime (рвёт, особенно iOS). image-sequence на canvas + lerp.
- ffmpeg статик /usr/local/bin (pw-ffmpeg без h264). Playwright через прокси на
  внешний URL не ходит (ERR_CONNECTION_RESET) — QA на localhost, live через curl.

## Дальше
Реальные цены/каталог, бэкенд формы (Supabase+Telegram), панда-маскот,
2 WebGL-портала на стыках, перенос на главную по отмашке Даниэля.
