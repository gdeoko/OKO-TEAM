#!/usr/bin/env python3
"""
OKO · Привести сгенерированную картинку к ТОЧНОМУ цвету бренда + сжать под мобилу.

Зачем. Нейросети не держат точный HEX: просишь лайм #9AFF00 - получаешь
изумрудный. Поэтому от генерации берём свет, объём и композицию, а цвет
задаём сами: считаем яркость каждого пикселя и красим её в бренд-градиент
(чёрный → лайм → почти белый в самом пекле свечения). Картинка становится
ровно брендовой, свечение и отражения остаются живыми.

Заодно решаем вес: приложение и так тяжёлое, поэтому 1024px PNG на ~900 КБ
ужимаем до нужного размера в WebP - обычно 20-60 КБ.

Использование:
  python3 brandify.py --in raw.png --out ../prototype/media/img/empty-chats.webp \\
      --size 480 [--accent 9AFF00] [--quality 82] [--boost 1.06]
"""
import argparse
import os

from PIL import Image, ImageFilter


def hex_rgb(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def brandify(src, dst, accent="9AFF00", size=480, quality=82, boost=1.06, alpha=True, hi=(235, 255, 200)):
    im = Image.open(src).convert("RGB")

    # 1. Яркость. Веса взяты «на глаз человека»: зелёный воспринимается ярче,
    #    поэтому неоновая трубка получает высокий L и попадёт в светлую часть
    #    градиента - свечение сохранится.
    lum = im.convert("L")
    if boost and boost != 1.0:
        lum = lum.point(lambda v: min(255, int(v * boost)))

    ar, ag, ab = hex_rgb(accent)

    # 2. Палитра из 256 ступеней: чёрный → бренд-лайм → почти белый.
    #    Тёмное остаётся чёрным (фон не сереет), середина - чистый лайм,
    #    самый яркий сердечник трубки уходит в белёсый, как настоящий неон.
    lut_r, lut_g, lut_b = [], [], []
    for v in range(256):
        t = v / 255.0
        if t <= 0.72:
            k = t / 0.72
            r, g, b = ar * k, ag * k, ab * k
        else:
            k = (t - 0.72) / 0.28
            r = ar + (hi[0] - ar) * k
            g = ag + (hi[1] - ag) * k
            b = ab + (hi[2] - ab) * k
        lut_r.append(int(max(0, min(255, r))))
        lut_g.append(int(max(0, min(255, g))))
        lut_b.append(int(max(0, min(255, b))))

    out = Image.merge("RGB", (lum.point(lut_r), lum.point(lut_g), lum.point(lut_b)))

    # 2b. Прозрачность вместо чёрного фона. У приложения ДВЕ темы: картинка с
    #     запечённым чёрным фоном в светлой теме выглядит чёрным квадратом.
    #     Поэтому яркость становится альфа-каналом - светится только само
    #     свечение, фон исчезает, и картинка ложится на любой фон.
    if alpha:
        a = lum.point(lambda v: 0 if v < 8 else min(255, int((v / 255.0) ** 0.85 * 255)))
        out = out.convert("RGBA")
        out.putalpha(a)

    # 3. Размер под мобилу (2x от места показа хватает с запасом).
    if size:
        w, h = out.size
        if w >= h:
            nw, nh = size, max(1, round(h * size / w))
        else:
            nh, nw = size, max(1, round(w * size / h))
        out = out.resize((nw, nh), Image.LANCZOS)
        out = out.filter(ImageFilter.UnsharpMask(radius=1.2, percent=55, threshold=3))

    os.makedirs(os.path.dirname(os.path.abspath(dst)), exist_ok=True)
    out.save(dst, "WEBP", quality=quality, method=6)
    return dst


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--in", dest="src", required=True)
    ap.add_argument("--out", dest="dst", required=True)
    ap.add_argument("--accent", default="9AFF00")
    ap.add_argument("--size", type=int, default=480)
    ap.add_argument("--quality", type=int, default=82)
    ap.add_argument("--boost", type=float, default=1.06)
    ap.add_argument("--opaque", action="store_true", help="оставить чёрный фон (без альфы)")
    a = ap.parse_args()
    p = brandify(a.src, a.dst, a.accent, a.size, a.quality, a.boost, alpha=not a.opaque)
    print(f"{p}  {os.path.getsize(p) // 1024} КБ")
