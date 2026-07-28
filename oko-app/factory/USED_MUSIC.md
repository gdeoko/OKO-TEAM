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
- #27 fs_viral_560759 (energetic/driving, seed 696) — уник, дедуп used_music.json.
- #28 fs_viral_666720 (energetic/driving, seed 458) — уник, дедуп used_music.json.
- #29 fs_viral_676998 (energetic/driving, seed 812) — уник, дедуп used_music.json (14/22 использовано).

## 28.07 (~04:20 UTC) — ПОПОЛНЕНИЕ ПУЛА (fix исчерпания виральной музыки)
Прошлый проход отметил: уник виральных треков почти кончились (2/10 роликов повторили бэд).
Долил 4 свежих CC0-трека с Freesound (фильтр license:"Creative Commons 0", HQ-preview mp3, дедуп по id):
fs_viral_563543 (50.8с), fs_viral_620918 (96.0с), fs_viral_790949 (60.1с), fs_viral_858710 (172.6с) — все energetic/driving/hype, зарегистрированы в manifest.json.
Виральный пул: 23 трека, 17 уник неиспользованных. Исчерпание снято.
Грабли Freesound API: токен через ЗАГОЛОВОК `Authorization: Token <KEY>` (query-param ?token= тоже, но нестабилен); фильтр CC0 работает `filter=license:"Creative Commons 0"` через --data-urlencode; НО узкие SFX-запросы («driving instrumental») дают 0 под CC0 — брать музыкальные термины («electronic music», «hip hop beat», «action cinematic»). useful/sales добить следующим проходом (таймаут прервал).

## 28.07 (~05:25 UTC) — добил useful/sales пул (+5 CC0)
useful: fs_useful_713517(60с), fs_useful_423665(160с), fs_useful_683821(121с). sales (был пуст!): fs_sales_506495(78с), fs_sales_579829(35с). Зарегистрированы в manifest. Теперь все 3 бакета укомплектованы: viral 23 / useful 12 / sales 2. Sales добить ещё (пул мал), но бакет ожил.
