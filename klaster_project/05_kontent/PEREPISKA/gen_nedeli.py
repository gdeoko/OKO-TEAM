# -*- coding: utf-8 -*-
"""Генерация визуала недели 1 через кабинет ChatGPT.

Каждый кадр в своём чате-проекте: подряд в одном чате модель отдаёт повтор
предыдущей картинки, это уже проверено на прошлых сериях.
"""
import os, subprocess, sys, time
sys.path.insert(0, "/opt/oko-poster/perepiska")
from promty_nedeli import ПРОМПТЫ

# Недели 2-4 лежат в своём файле, склеиваем в один каталог.
for модуль in ("promty_mesyaca", "promty_storis"):
    try:
        ПРОМПТЫ = dict(ПРОМПТЫ, **__import__(модуль).ПРОМПТЫ)
    except ModuleNotFoundError:
        continue

# Кабинет отдаёт свои пиксели: 941 на 1672 для вертикали, 1122 на 1402 для
# 4:5. Пропорция верная, а ширины не хватает: площадки и приёмка ждут от 1080,
# статьи от 1200. Поэтому готовый кадр приводим к каноническому размеру
# формата. Содержимое не трогаем, ничего не дорисовываем и не обрезаем.
КАНОН = {"9:16": (1080, 1920), "4:5": (1200, 1500), "16:9": (1920, 1080),
         "1:1": (1200, 1200)}


def довести(файл, размер):
    try:
        from PIL import Image
    except ImportError:
        return
    нужно = КАНОН.get(размер)
    if not нужно or not os.path.exists(файл):
        return
    им = Image.open(файл)
    if им.size == нужно:
        return
    им.convert("RGB").resize(нужно, Image.LANCZOS).save(файл)

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
    # Слайды каруселей и кадры для лент Инстаграма и ВК идут вертикалью 4:5:
    # горизонталь в ленте съедает половину экрана. Телеграм принимает 16:9.
    ЛЕНТА = {"P-02-cena-scet", "P-06-ota", "P-10-obed", "P-202-lift",
             "P-205-ventilyaciya", "P-209-roboty",
             "P-302-dvor", "P-304-zolferayn", "P-308-otrasl", "P-310-subbota",
             "P-402-pervyy-otvet", "P-403-vysota", "P-406-volfsburg",
             "P-01-krt-karta-b"}
    if имя.startswith("S-"):
        размер = "9:16"          # сторис всегда вертикаль на весь экран
    elif имя.startswith("K-") or имя in ЛЕНТА:
        размер = "4:5"
    else:
        размер = "16:9"
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
    if есть:
        довести(файл, размер)
    print(f"{имя}: {'готово' if есть else 'НЕ ВЫШЛО'} "
          f"{os.path.getsize(файл)//1024 if есть else 0} кб за {round(time.time()-т)} с",
          flush=True)
    для_отчёта.append((имя, есть))
готовых = sum(1 for _, е in для_отчёта if е)
print(f"ИТОГО кадров готово: {готовых} из {len(для_отчёта)}", flush=True)
