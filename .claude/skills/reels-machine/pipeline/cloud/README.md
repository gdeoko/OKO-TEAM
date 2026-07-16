# cloud/ — облачный монтаж (Shotstack + Creatomate)

Обёртки для облачного рендера роликов из reels-machine. Оба движка проверены боем —
отдают валидный MP4 1080×1920.

## Ключи (secrets.env, автозагрузка SessionStart-хуком)
| Переменная | Что |
|---|---|
| `SHOTSTACK_SANDBOX_KEY` | Shotstack sandbox — бесплатно, вотермарк на видео |
| `SHOTSTACK_PROD_KEY` | Shotstack prod — платно, без вотермарка |
| `CREATOMATE_API_KEY` | Creatomate серверный ключ (Bearer). В браузер НЕ отдавать |
| `CREATOMATE_PUBLIC_TOKEN` | Creatomate public-токен — только клиентский preview-плеер |

Вручную поднять ключи: `source <(base64 -d secrets.env.b64)`

## Правило окружения
Сеть **только через curl** — requests/urllib ходят мимо прокси и виснут. Обёртки
уже используют curl-subprocess, ничего доп. настраивать не надо.

## shotstack.py
- `render(edit, env="sandbox"|"prod", out_path=None)` — отправить edit-JSON, дождаться,
  вернуть URL (или скачать в out_path). Принимает полный edit или голый timeline.
- `ingest(url, env)` — залить внешний ассет в CDN Shotstack, вернуть готовый source-URL.
- `build_vertical(shots, subs, music_url, bg)` — собрать вертикальный timeline 1080×1920
  из списка шотов + караоке-титров + музыки. Мост от формата reels-machine.
- Смоук: `python3 shotstack.py` (нужен source ключей) → `shotstack_smoke.mp4`.

## creatomate.py
- `render(template_id=, modifications=, | source=, out_path=)` — один рендер по шаблону
  или по inline-сцене.
- `batch(template_id, mods_list, out_dir)` — пачка по одному шаблону («ролики по данным»).
- Free-tier рендерит медленно (2–3 мин/клип), таймаут обёрток 600с.
- Смоук: `python3 creatomate.py` (тратит ~1 кредит) → `creatomate_smoke.mp4`.

## Когда какой путь
- **build_reel.py (локальный ffmpeg)** — флагман контент-завода: полный контроль,
  альфа-оверлеи, gl-переходы, 3D, караоке по слову. Дефолт.
- **Shotstack** — быстрый чистый программный монтаж по таймлайну без ручного ffmpeg.
- **Creatomate** — серийные ролики по шаблону из данных.
