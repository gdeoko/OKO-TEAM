# -*- coding: utf-8 -*-
"""Генерация визуала недели 1 через кабинет ChatGPT.

Каждый кадр в своём чате-проекте: подряд в одном чате модель отдаёт повтор
предыдущей картинки, это уже проверено на прошлых сериях.
"""
import os, subprocess, sys, time
sys.path.insert(0, "/opt/oko-poster/perepiska")
from promty_nedeli import ПРОМПТЫ

# Недели 2-4 лежат в своём файле, склеиваем в один каталог.
try:
    from promty_mesyaca import ПРОМПТЫ as ЕЩЁ
    ПРОМПТЫ = dict(ПРОМПТЫ, **ЕЩЁ)
except ModuleNotFoundError:
    pass

РЕФЫ = "/opt/oko-poster/klaster_ref_small"
КУДА = "/opt/oko-poster/klaster_nedelya1"
os.makedirs(КУДА, exist_ok=True)

# Чат проекта переиспользуется, и драйвер может забрать из него прошлую
# картинку. Поэтому у каждого прогона своя метка: чат заводится чистым.
ВЕРСИЯ = os.getenv("ВЕРСИЯ", "v1")
имена = sys.argv[1:] or list(ПРОМПТЫ)
для_отчёта = []
for имя in имена:
    п = ПРОМПТЫ[имя]
    файл = f"{КУДА}/{имя}.png"
    if os.path.exists(файл) and os.path.getsize(файл) > 300000:
        print(f"{имя}: уже есть, пропускаю", flush=True)
        continue
    образцы = ",".join(f"{РЕФЫ}/{о}.jpg" for о in п["образцы"]
                       if os.path.exists(f"{РЕФЫ}/{о}.jpg"))
    # Формат драйвер просит у ChatGPT отдельной строкой, текстом промпта его
    # не задать: слайды карусели идут вертикалью 4:5, посты горизонтом 16:9.
    размер = "4:5" if имя.startswith("K-") else "16:9"
    среда = dict(os.environ, CDP="http://127.0.0.1:9334", ЖДАТЬ="900",
                 ССЫЛКИ=образцы, РАЗМЕР=размер,
                 PROJECT=f"oko-klaster-{имя}-{ВЕРСИЯ}",
                 ПРОЕКТ=f"oko-klaster-{имя}-{ВЕРСИЯ}")
    т = time.time()
    r = subprocess.run(["node", "/opt/oko-poster/chatgpt_web.mjs", п["текст"], файл],
                       capture_output=True, text=True, timeout=1500, env=среда,
                       cwd="/opt/oko-poster")
    open(f"/tmp/gen_{имя}.log", "w").write((r.stdout or "") + (r.stderr or ""))
    есть = os.path.exists(файл)
    print(f"{имя}: {'готово' if есть else 'НЕ ВЫШЛО'} "
          f"{os.path.getsize(файл)//1024 if есть else 0} кб за {round(time.time()-т)} с",
          flush=True)
    для_отчёта.append((имя, есть))
готовых = sum(1 for _, е in для_отчёта if е)
print(f"ИТОГО кадров готово: {готовых} из {len(для_отчёта)}", flush=True)
