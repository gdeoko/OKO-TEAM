"""Миниатюры тем для профиля (ассеты/темы/*.webp, 330x440).

Кадр 3:4 вырезается из постера клипа вокруг якоря: предмет сцены, который
в приложении стоит за линзой, стоит и в центре миниатюры. У «Полёта» ракеты
в клипе нет (она летает кодом), поэтому на миниатюру она кладётся снимком:
иначе тема на плитке выглядела бы просто планетой, как «Космос».

    python3 миниатюры.py
"""
import json, re
from pathlib import Path
from PIL import Image, ImageFilter

КОРЕНЬ = Path(__file__).parent / "планета"
ФОН, ТЕМЫ = КОРЕНЬ / "ассеты/фон", КОРЕНЬ / "ассеты/темы"

# якоря берутся из фон.js, чтобы не разойтись с приложением
текст = (КОРЕНЬ / "фон.js").read_text(encoding="utf-8")
ЯКОРЯ = {м[0]: (float(м[1]), float(м[2]))
         for м in re.findall(r'"([а-яё]+-[а-яё]+)":\s*\{ якорь: \[([.\d]+), ([.\d]+)\]', текст)}

for клип, (ах, ау) in sorted(ЯКОРЯ.items()):
    кадр = Image.open(ФОН / (клип + ".webp")).convert("RGBA")
    Ш, В = кадр.size
    ш = Ш; в = round(ш * 4 / 3)
    # предмет сцены на 42% высоты миниатюры: над ним небо, под ним подпись
    верх = max(0, min(В - в, round(ау * В - в * .42)))
    лево = max(0, min(Ш - ш, round(ах * Ш - ш / 2)))
    мини = кадр.crop((лево, верх, лево + ш, верх + в))
    if клип.startswith("полёт"):
        р = Image.open(ФОН / "ракета.webp").convert("RGBA")
        h = round(в * .46); р = р.resize((round(р.width * h / р.height), h), Image.LANCZOS).rotate(-18, expand=True, resample=Image.BICUBIC)
        # мягкое свечение факела под соплами
        свет = Image.new("RGBA", мини.size, (0, 0, 0, 0))
        цвет = (255, 190, 110, 150) if клип.endswith("утро") else (255, 120, 50, 170)
        x, y = round(ш * .56), round(в * .05)
        пятно = Image.new("RGBA", (round(р.width * 1.1), round(р.height * .5)), цвет)
        маска = Image.new("L", пятно.size, 0)
        from PIL import ImageDraw
        ImageDraw.Draw(маска).ellipse((0, 0) + пятно.size, fill=255)
        пятно.putalpha(маска.filter(ImageFilter.GaussianBlur(пятно.width / 5)))
        свет.alpha_composite(пятно, (x - round(р.width * .25), y + round(р.height * .72)))
        мини = Image.alpha_composite(мини, свет)
        мини.alpha_composite(р, (x, y))
    мини.convert("RGB").resize((330, 440), Image.LANCZOS).save(ТЕМЫ / (клип + ".webp"), quality=88, method=6)
    print("миниатюра", клип, "якорь", ах, ау)
