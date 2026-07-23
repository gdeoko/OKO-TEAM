# РЕЕСТР МУЗЫКИ — на КАЖДЫЙ ролик СВОЙ трек, без повторов (закон Даниэля 22.07)

Правило: музыка НЕ повторяется между роликами. Трек выбирается `pipeline/pick_music.py <bucket> <theme>`
под настроение бакета (viral/useful/sales) из пула `music/`, дедуп по `music/used_music.json`.
Плюс пер-ролик обработка в `audio.py` (сдвиг секции + темп + EQ по MUSIC_SEED) — даже соседние треки звучат иначе.
Каждый ролик пишем сюда: № — файл — бакет — почему подходит теме/сценарию.

## СТАТУС ПУЛА (решено автономно 22.07)
- Источник: **Freesound API, фильтр `license:"Creative Commons 0"`** (CC0 — коммерческое использование
  без атрибуции, безопасно для монетизируемых TikTok/YouTube/IG). Проверенный метод среды (reels-machine).
- Пул качается в `music/fs_<bucket>_<id>.mp3`, теги настроения в `manifest.json`, дедуп `used_music.json`.
- Бакеты→настроение: viral→energetic/driving/hype/bold · useful→confident/clean/focused/steady ·
  sales→uplifting/warm/hopeful/confident. Расширять пул новыми запросами Freesound по мере роста завода.
- Пополнение: `fs_pool.json` (кандидаты) + скрипт скачивания; можно доливать треки в любой момент.
- ⚠️ Если понадобится премиум-качество под «миллионы» — подключить библиотеку по подписке
  (Epidemic/Artlist/Uppbeat) поверх этой же схемы pick_music (Даниэль даёт логин).

## ЖУРНАЛ
- #16 (batch A) — использован СТАРЫЙ фикс-бэд (до реформы музыки). С #17 — только уникальные из пула.
- #17 fs_useful_117358 · #18 (интерим) · #19 fs_useful_117358? (см. USED) · #20 fs_viral_416171 · #21 fs_viral_456121 · #22 fs_useful_117782 · #23 fs_viral_51239 (energetic/driving, seed 785) — все уникальные, дедуп used_music.json (7/22 использовано).
- #24 fs_viral_51278 (energetic/driving, seed 817) — уник, дедуп used_music.json (8/22).
- #25 fs_useful_140481 (confident/clean/steady, seed 280) — уник, дедуп used_music.json (9/22).
- #26 fs_viral_524240 (energetic/driving, seed трактовки 429) — уник, дедуп used_music.json.
