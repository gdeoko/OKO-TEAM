"""Проверка страниц пакетов на семи ширинах."""
from playwright.sync_api import sync_playwright
import glob, os

ШИРИНЫ = [(1920,1080),(1440,900),(1180,820),(834,1112),(430,932),(390,844),(360,800)]
файлы = sorted(glob.glob(os.environ.get("ПАКЕТЫ", "/home/user/OKO-TEAM/pakety/*.html")))

with sync_playwright() as p:
    b = p.chromium.launch(headless=True,
        executable_path="/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args=["--no-sandbox"])
    итог = []
    for ф in файлы:
        имя = os.path.basename(ф)[:-5]
        беды = []
        for w, h in ШИРИНЫ:
            pg = b.new_page(viewport={"width": w, "height": h})
            логи = []
            pg.on("console", lambda m: логи.append(m.type) if m.type == "error" else None)
            pg.goto("file://" + ф)
            pg.wait_for_load_state("networkidle")
            вылет = pg.evaluate("document.documentElement.scrollWidth - document.documentElement.clientWidth")
            битых = pg.evaluate("[...document.querySelectorAll('img')].filter(i=>!i.complete||i.naturalWidth===0).length")
            if вылет > 0 or битых or логи:
                беды.append(f"{w}px: вылет {вылет}, битых {битых}, ошибок {len(логи)}")
            pg.close()
        итог.append((имя, беды))
        print(f"{имя:12} {'чисто' if not беды else беды}")
    b.close()
    print("\nИТОГ:", "все страницы чисты" if all(not б for _, б in итог) else "есть замечания")
