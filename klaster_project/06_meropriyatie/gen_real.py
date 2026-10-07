# -*- coding: utf-8 -*-
"""Генерация визуала по референсам клиента через кабинет ChatGPT.

Каждый кадр идёт в своём чате-проекте: подряд в одном чате модель отдаёт
повтор предыдущей картинки, это уже проверено на прошлой серии.
"""
import os, subprocess, sys, time
sys.path.insert(0, "/opt/oko-poster")
from promty_real import ПРОМПТЫ

РЕФЫ = "/opt/oko-poster/klaster_ref_small"
КУДА = "/opt/oko-poster/klaster_gen_real"
os.makedirs(КУДА, exist_ok=True)

имена = sys.argv[1:] or list(ПРОМПТЫ)
for имя in имена:
    п = ПРОМПТЫ[имя]
    файл = f"{КУДА}/{имя}.png"
    if os.path.exists(файл) and os.path.getsize(файл) > 300000:
        print(f"{имя}: уже есть, пропускаю", flush=True)
        continue
    образцы = ",".join(f"{РЕФЫ}/{о}.jpg" for о in п["образцы"]
                       if os.path.exists(f"{РЕФЫ}/{о}.jpg"))
    print(f"{имя}: промпт {len(п['текст'])} знаков, образцов "
          f"{len(образцы.split(',')) if образцы else 0}", flush=True)
    среда = dict(os.environ, CDP="http://127.0.0.1:9334", ЖДАТЬ="900",
                 ССЫЛКИ=образцы,
                 PROJECT=f"oko-klaster-{имя}-v3", ПРОЕКТ=f"oko-klaster-{имя}-v3")
    т = time.time()
    r = subprocess.run(["node", "/opt/oko-poster/chatgpt_web.mjs", п["текст"], файл],
                       capture_output=True, text=True, timeout=1500, env=среда,
                       cwd="/opt/oko-poster")
    open(f"/tmp/gen_{имя}.log", "w").write((r.stdout or "") + (r.stderr or ""))
    есть = os.path.exists(файл)
    print(f"{имя}: {'готово' if есть else 'НЕ ВЫШЛО'} "
          f"{os.path.getsize(файл)//1024 if есть else 0} кб за {round(time.time()-т)} с",
          flush=True)
    if not есть:
        print(((r.stdout or "") + (r.stderr or ""))[-200:], flush=True)
