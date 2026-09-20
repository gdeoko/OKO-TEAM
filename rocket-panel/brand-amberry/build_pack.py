"""Бренд-пак AMBERRY: логотип во всех форматах и размерах.

Запуск:  python build_pack.py        (нужен playwright с chromium и Pillow)
Собирает папку pack/ по той же схеме, что у бренд-пака OKO.

Что откуда берётся
------------------
Мастер-файлы amberry-mark.svg и amberry-icon.svg строит build_vector.py
из эталона. Здесь они только пересобираются в цветовые варианты: из них
вынимаются два контура — тёмная подложка и розовый рисунок — и
складываются заново с нужной заливкой.

Почему одноцветные варианты БЕЗ подложки
----------------------------------------
В цветном знаке подложка держит промежутки между костянками тёмными на
любом фоне. В одноцветном (белый, чёрный, графит) её быть не должно:
одним цветом промежутки можно показать только дыркой. Белый знак кладут
на тёмное, чёрный на светлое — дырка там и работает. Положишь подложку —
получишь тёмное пятно поперёк белого логотипа.
"""

import asyncio
import os
import re

from PIL import Image

ЗДЕСЬ = os.path.dirname(os.path.abspath(__file__))
ПАК = os.path.join(ЗДЕСЬ, "pack")

НЕОН = "#FF0A8C"
ТЬМА = "#150309"
ГРАФИТ = "#2A2630"

# цвет → (заливка рисунка, заливка подложки или None)
ЦВЕТА = {
    "neon": (НЕОН, ТЬМА),
    "white": ("#FFFFFF", None),
    "black": ("#000000", None),
    "mono-graphite": (ГРАФИТ, None),
}

РАЗМЕРЫ = (32, 48, 64, 128, 256, 512, 1024, 2048)
РАЗМЕРЫ_НА_ФОНЕ = (512, 1024, 2048)
ФОНЫ = {"on-black": "#000000", "on-white": "#FFFFFF"}
ICO_РАЗМЕРЫ = [(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]

ЗНАКИ = {"mark": "amberry-mark.svg", "icon": "amberry-icon.svg"}


def разобрать(путь):
    """Вынуть из мастер-SVG размеры и два слоя: подложку и рисунок."""
    т = open(путь).read()
    vb = re.search(r'viewBox="0 0 (\d+) (\d+)"', т)
    ш, в = int(vb.group(1)), int(vb.group(2))
    слои = re.findall(r'<g transform="([^"]+)">\s*<path fill="([^"]+)"'
                      r'\s*fill-rule="([^"]+)"\s*d="([^"]+)"/></g>', т)
    if len(слои) != 2:
        raise SystemExit(f"{путь}: ожидались два слоя, найдено {len(слои)}")
    подложка, рисунок = слои          # порядок в мастере: подложка, рисунок
    return ш, в, подложка, рисунок


def собрать_svg(ш, в, подложка, рисунок, цвет_рис, цвет_под):
    куски = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {ш} {в}"'
             f' width="{ш}" height="{в}">', "  <title>AMBERRY</title>"]
    if цвет_под:
        tr, _, пр, d = подложка
        куски.append(f'  <g transform="{tr}">'
                     f'<path fill="{цвет_под}" fill-rule="{пр}" d="{d}"/></g>')
    tr, _, пр, d = рисунок
    куски.append(f'  <g transform="{tr}">'
                 f'<path fill="{цвет_рис}" fill-rule="{пр}" d="{d}"/></g>')
    куски.append("</svg>")
    return "\n".join(куски) + "\n"


async def отрисовать(svg_тексты):
    """Все растры и PDF одним запуском браузера."""
    from playwright.async_api import async_playwright

    png = os.path.join(ПАК, "logo", "png")
    pdf = os.path.join(ПАК, "logo", "pdf")
    сделано = 0

    async with async_playwright() as p:
        br = await p.chromium.launch()

        async def кадр(svg, ш, в, файл, фон=None):
            nonlocal сделано
            стр = await br.new_page(viewport={"width": ш, "height": в})
            тело = f"background:{фон}" if фон else "background:transparent"
            await стр.set_content(
                f'<style>html,body{{margin:0;{тело}}}'
                f'svg{{width:{ш}px;height:{в}px;display:block}}</style>{svg}')
            await стр.wait_for_timeout(60)
            await стр.screenshot(path=файл, omit_background=(фон is None))
            await стр.close()
            сделано += 1

        for (знак, цвет), (svg, ш0, в0) in svg_тексты.items():
            for px in РАЗМЕРЫ:
                в = round(px * в0 / ш0)
                await кадр(svg, px, в,
                           f"{png}/amberry-{знак}-{цвет}-{px}.png")
            # вектор в PDF: Chromium сохраняет SVG кривыми, не картинкой
            стр = await br.new_page()
            await стр.set_content(
                f'<style>html,body{{margin:0}}'
                f'svg{{width:100%;display:block}}</style>{svg}')
            await стр.pdf(path=f"{pdf}/amberry-{знак}-{цвет}.pdf",
                          width=f"{ш0 / 96:.4f}in", height=f"{в0 / 96:.4f}in",
                          print_background=True, margin={"top": "0", "bottom": "0",
                                                         "left": "0", "right": "0"})
            await стр.close()
            сделано += 1

        # на фоне: неоновый знак, под который фон и рассчитан
        for знак in ЗНАКИ:
            svg, ш0, в0 = svg_тексты[(знак, "neon")]
            for имя, цвет in ФОНЫ.items():
                for px in РАЗМЕРЫ_НА_ФОНЕ:
                    в = round(px * в0 / ш0)
                    await кадр(svg, px, в,
                               f"{png}/amberry-{знак}-{имя}-{px}.png", фон=цвет)
                стр = await br.new_page()
                await стр.set_content(
                    f'<style>html,body{{margin:0;background:{цвет}}}'
                    f'svg{{width:100%;display:block}}</style>{svg}')
                await стр.pdf(path=f"{pdf}/amberry-{знак}-{имя}.pdf",
                              width=f"{ш0 / 96:.4f}in", height=f"{в0 / 96:.4f}in",
                              print_background=True,
                              margin={"top": "0", "bottom": "0",
                                      "left": "0", "right": "0"})
                await стр.close()
                сделано += 1

        await br.close()
    return сделано


def сделать_ico():
    """Фавикон строится из ИКОНКИ, не из знака с надписью: во вкладке
    браузера слово схлопывается в полоску."""
    ico = os.path.join(ПАК, "logo", "ico")
    png = os.path.join(ПАК, "logo", "png")
    сделано = []
    for цвет in ("neon", "white", "black", "mono-graphite"):
        и = Image.open(f"{png}/amberry-icon-{цвет}-256.png").convert("RGBA")
        путь = f"{ico}/amberry-icon-{цвет}.ico"
        и.save(путь, sizes=ICO_РАЗМЕРЫ)
        сделано.append(путь)
    Image.open(f"{png}/amberry-icon-neon-256.png").convert("RGBA").save(
        f"{ico}/favicon.ico", sizes=ICO_РАЗМЕРЫ)
    сделано.append(f"{ico}/favicon.ico")
    return сделано


def main():
    for под in ("logo/svg", "logo/png", "logo/pdf", "logo/ico"):
        os.makedirs(os.path.join(ПАК, под), exist_ok=True)

    svg_тексты = {}
    for знак, файл in ЗНАКИ.items():
        ш, в, подложка, рисунок = разобрать(os.path.join(ЗДЕСЬ, файл))
        for цвет, (ц_рис, ц_под) in ЦВЕТА.items():
            s = собрать_svg(ш, в, подложка, рисунок, ц_рис, ц_под)
            open(os.path.join(ПАК, "logo", "svg",
                              f"amberry-{знак}-{цвет}.svg"), "w").write(s)
            svg_тексты[(знак, цвет)] = (s, ш, в)
    print(f"SVG: {len(svg_тексты)} вариантов")

    растров = asyncio.run(отрисовать(svg_тексты))
    print(f"PNG и PDF: {растров} файлов")
    print(f"ICO: {len(сделать_ico())} файлов")

    всего = sum(len(fs) for _, _, fs in os.walk(ПАК))
    print(f"итого в pack/: {всего} файлов")


if __name__ == "__main__":
    main()
