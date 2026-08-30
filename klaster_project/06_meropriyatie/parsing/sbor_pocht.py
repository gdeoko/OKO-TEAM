# -*- coding: utf-8 -*-
"""Сбор почт с сайтов агентств.

На карте почта указана редко, а на сайте она есть почти всегда: на главной,
в контактах или в подвале. Ходим по списку сайтов, снимаем главную и типовые
страницы контактов, достаём почты, телефоны и ники в мессенджерах.

Чужие ящики вроде example@, noreply@, почты хостингов и систем аналитики
отбрасываем сразу, иначе база засоряется мусором и рассылка бьёт мимо.

    python3 sbor_pocht.py вход.json выход.json [сколько_потоков]
"""
import concurrent.futures as futures
import json, re, subprocess, sys, time

СТРАНИЦЫ = ["", "/contacts", "/contacts/", "/kontakty", "/kontakty/", "/about",
            "/about/", "/o-kompanii", "/contact", "/kontakti"]
ПОЧТА = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}")
ТЕЛЕФОН = re.compile(r"(?:\+7|8)[\s\-(]*\d{3}[\s\-)]*\d{3}[\s\-]*\d{2}[\s\-]*\d{2}")

МУСОР = ("example.", "@sentry", "@wixpress", "@2x", "@3x", "noreply", "no-reply",
         "@domain", "@mail.ru.", "@yourdomain", "@site", "@email", "@test",
         ".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".css", ".js",
         "@sentry.io", "@googlemail", "u0040")


def годная(п):
    п = п.lower().strip(".,;:")
    if any(м in п for м in МУСОР):
        return ""
    if len(п) > 64 or п.count("@") != 1:
        return ""
    хвост = п.rsplit(".", 1)[-1]
    if len(хвост) < 2 or len(хвост) > 8 or not хвост.isalpha():
        return ""
    return п


def взять(адрес, ждать=15):
    r = subprocess.run(["curl", "-sL", "--max-time", str(ждать), "--compressed",
                        "-A", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                              "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36",
                        адрес], capture_output=True, text=True, errors="ignore")
    return r.stdout or ""


def сайт_целиком(сайт):
    сайт = сайт.strip()
    if not сайт:
        return {}
    if not сайт.startswith("http"):
        сайт = "https://" + сайт
    корень = сайт.rstrip("/")
    почты, телефоны = set(), set()
    for хвост in СТРАНИЦЫ:
        текст = взять(корень + хвост)
        if not текст:
            continue
        for п in ПОЧТА.findall(текст):
            г = годная(п)
            if г:
                почты.add(г)
        for т in ТЕЛЕФОН.findall(текст):
            телефоны.add(re.sub(r"\D", "", т))
        if почты and хвост:
            break
    return {"почты": sorted(почты)[:5], "телефоны": sorted(телефоны)[:3]}


def обойти(записи, потоков=12):
    готово = []
    с_сайтом = [з for з in записи if з.get("сайт")]
    print(f"сайтов к обходу: {len(с_сайтом)}", flush=True)
    начало = time.time()
    with futures.ThreadPoolExecutor(max_workers=потоков) as пул:
        задачи = {пул.submit(сайт_целиком, з["сайт"]): з for з in с_сайтом}
        for н, задача in enumerate(futures.as_completed(задачи), 1):
            з = задачи[задача]
            try:
                итог = задача.result()
            except Exception:
                итог = {}
            з = dict(з)
            з["почты"] = итог.get("почты", [])
            з["телефоны_сайта"] = итог.get("телефоны", [])
            готово.append(з)
            if н % 25 == 0:
                нашли = sum(1 for г in готово if г["почты"])
                print(f"обошли {н}/{len(с_сайтом)}, с почтой {нашли}, "
                      f"{round(time.time() - начало)} с", flush=True)
    return готово


if __name__ == "__main__":
    вход = sys.argv[1] if len(sys.argv) > 1 else "/opt/oko-poster/lead_osm.json"
    выход = sys.argv[2] if len(sys.argv) > 2 else "/opt/oko-poster/lead_pochty.json"
    потоков = int(sys.argv[3]) if len(sys.argv) > 3 else 12
    д = json.load(open(вход, encoding="utf-8"))
    записи = д["записи"] if isinstance(д, dict) else д
    готово = обойти(записи, потоков)
    все_почты = sorted({п for г in готово for п in г["почты"]})
    json.dump({"организаций": len(готово), "почт": len(все_почты),
               "записи": готово, "почты": все_почты},
              open(выход, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
    print(f"ИТОГО: организаций {len(готово)}, уникальных почт {len(все_почты)}")
