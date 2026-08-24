"""Проверка страницы пакета контента на семи ширинах."""
from playwright.sync_api import sync_playwright

URL = "file:///tmp/claude-0/-home-user-OKO-TEAM/aabccee1-6871-549d-b7a8-30daf94f16b4/scratchpad/paket.html"
ШИРИНЫ = [(1920, 1080, "desktop-1920"), (1440, 900, "desktop-1440"),
          (1180, 820, "tablet-1180"), (834, 1112, "tablet-834"),
          (430, 932, "iphone-430"), (390, 844, "iphone-390"), (360, 800, "android-360")]

with sync_playwright() as p:
    b = p.chromium.launch(headless=True, executable_path="/opt/pw-browsers/chromium-1194/chrome-linux/chrome", args=["--no-sandbox"])
    ошибки = []
    for w, h, имя in ШИРИНЫ:
        pg = b.new_page(viewport={"width": w, "height": h})
        логи = []
        pg.on("console", lambda m: логи.append(m.type) if m.type == "error" else None)
        pg.goto(URL)
        pg.wait_for_load_state("networkidle")

        вылет = pg.evaluate(
            "document.documentElement.scrollWidth - document.documentElement.clientWidth")
        # элементы, вылезающие за правый край
        торчат = pg.evaluate("""() => {
            const w = document.documentElement.clientWidth;
            return [...document.querySelectorAll('*')]
              .filter(e => e.getBoundingClientRect().right > w + 1)
              .slice(0, 5)
              .map(e => e.tagName + '.' + (e.className || '').toString().slice(0, 24));
        }""")
        # мелкие цели нажатия
        мелкие = pg.evaluate("""() => [...document.querySelectorAll('a,button')]
            .filter(e => { const r = e.getBoundingClientRect();
                           return r.width > 0 && (r.height < 44 || r.width < 44); }).length""")
        картинок = pg.evaluate(
            "document.querySelectorAll('img').length")
        битых = pg.evaluate(
            "[...document.querySelectorAll('img')].filter(i=>!i.complete||i.naturalWidth===0).length")

        pg.screenshot(path=f"/tmp/claude-0/-home-user-OKO-TEAM/aabccee1-6871-549d-b7a8-30daf94f16b4/scratchpad/pk_{имя}.png")
        строка = (f"{имя:16} вылет={вылет:>3}px  торчит={len(торчат)}  "
                  f"мелких целей={мелкие}  картинок={картинок} битых={битых} "
                  f"ошибок консоли={len(логи)}")
        print(строка)
        if торчат:
            print("        ", торчат)
        if вылет > 0 or битых or логи:
            ошибки.append(имя)
        pg.close()

    # полная страница на десктопе и мобиле
    for w, h, имя in [(1440, 900, "full-desktop"), (390, 844, "full-mobile")]:
        pg = b.new_page(viewport={"width": w, "height": h})
        pg.goto(URL); pg.wait_for_load_state("networkidle")
        pg.screenshot(path=f"/tmp/claude-0/-home-user-OKO-TEAM/aabccee1-6871-549d-b7a8-30daf94f16b4/scratchpad/pk_{имя}.png",
                      full_page=True)
        pg.close()

    b.close()
    print("\nИТОГ:", "чисто" if not ошибки else f"проблемы на {ошибки}")
