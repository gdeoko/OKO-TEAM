#!/usr/bin/env python3
"""
Карта глубины кадра кабины и карта нормалей из неё.

Ради этого шага всё и затевалось. Пока рама это картинка, она остаётся
плоской при любом качестве снимка: свет мира по ней не идёт, силуэта у
неё нет, при движении корабля она не живёт. Карта глубины поднимает
вершины сетки к пилоту, и рама становится настоящей геометрией -
пульт выступает, ниши проваливаются, кромка окна режет свет.

Считает Depth-Anything V2 small локально, без ключей и квот.

  DEPTH_MODEL=~/models/depth_v2_small.onnx \
  python3 tools/cabdepth.py снимок.png assets/gen/cab/wide

Кладёт рядом <имя>-depth.png (одна восьмибитная карта) и
<имя>-normal.webp (нормали в касательном пространстве).
"""
import os
import sys

import numpy as np
import onnxruntime as ort
from PIL import Image, ImageFilter

MODEL = os.environ.get("DEPTH_MODEL", os.path.expanduser("~/models/depth_v2_small.onnx"))
SIZE = 518


def depth_map(path):
    im = Image.open(path).convert("RGB")
    w, h = im.size
    x = np.asarray(im.resize((SIZE, SIZE), Image.BICUBIC)).astype(np.float32) / 255.0
    mean = np.array([0.485, 0.456, 0.406], dtype=np.float32)
    std = np.array([0.229, 0.224, 0.225], dtype=np.float32)
    x = ((x - mean) / std).transpose(2, 0, 1)[None]
    sess = ort.InferenceSession(MODEL, providers=["CPUExecutionProvider"])
    d = sess.run(None, {sess.get_inputs()[0].name: x})[0]
    d = np.squeeze(d)
    d = (d - d.min()) / (d.max() - d.min() + 1e-6)
    big = Image.fromarray((d * 255).astype(np.uint8)).resize((w, h), Image.BICUBIC)
    return big


def fix_window(dep, meta_json):
    """Правка глубины по контуру окна.

    Сеть считает глубину всего кадра, а нам нужна глубина одной рамы,
    и три вещи она делает не так.

    Первое: дыра окна занимает половину кадра, и вся шкала уходит на
    неё. Раму сеть укладывает в узкую полоску серого, объём пропадает.
    Поэтому шкалу пересчитываем только по раме, дыру не считаем вовсе.

    Второе: у самой кромки выреза сеть тянет глубину назад, к дыре, и
    кромка заваливается внутрь. На деле кромка окна это самое близкое к
    пилоту место рамы. Полосу в три процента вокруг выреза
    приподнимаем.

    Третье: внутри дыры глубина не нужна никакая, там вершин не будет.
    Ставим ноль, чтобы размытие из дыры не портило кромку.
    """
    import json
    from PIL import ImageDraw
    if not os.path.exists(meta_json):
        return dep
    with open(meta_json, encoding="utf-8") as f:
        meta = json.load(f)
    w, h = dep.size
    poly = [(p[0] * w, p[1] * h) for p in meta["окно"]["контур"]]
    m = Image.new("L", (w, h), 0)
    ImageDraw.Draw(m).polygon(poly, fill=255)
    win = np.asarray(m) > 127

    a = np.asarray(dep).astype(np.float32)
    frame = a[~win]
    lo, hi = float(np.percentile(frame, 2)), float(np.percentile(frame, 98))
    if hi - lo < 1e-3:
        hi = lo + 1.0
    a = np.clip((a - lo) / (hi - lo), 0.0, 1.0) * 255.0
    a[win] = 0.0

    # Кромка: полоса вокруг выреза, ближе всего к пилоту.
    grow = m.filter(ImageFilter.MaxFilter(3))
    for _ in range(max(1, int(min(w, h) * 0.03) // 2)):
        grow = grow.filter(ImageFilter.MaxFilter(3))
    lip = (np.asarray(grow) > 127) & (~win)
    a[lip] = np.maximum(a[lip], 236.0)
    return Image.fromarray(a.astype(np.uint8), "L")


def normals(dep, strength=2.6):
    a = np.asarray(dep.filter(ImageFilter.GaussianBlur(1.1))).astype(np.float32) / 255.0
    gy, gx = np.gradient(a)
    nx = -gx * strength * a.shape[1] / 512.0
    ny = gy * strength * a.shape[0] / 512.0
    nz = np.ones_like(a)
    ln = np.sqrt(nx * nx + ny * ny + nz * nz)
    out = np.stack([nx / ln, ny / ln, nz / ln], axis=-1) * 0.5 + 0.5
    return Image.fromarray((out * 255).astype(np.uint8), "RGB")


def main():
    if len(sys.argv) < 3:
        raise SystemExit(__doc__)
    src, base = sys.argv[1], sys.argv[2]
    if not os.path.exists(MODEL):
        raise SystemExit("нет модели глубины: " + MODEL)
    dep = depth_map(src)
    dep = fix_window(dep, base + ".json")
    dep = dep.filter(ImageFilter.GaussianBlur(0.8))
    dep.save(base + "-depth.png")
    normals(dep).save(base + "-normal.webp", quality=92, method=6)
    a = np.asarray(dep)
    print("глубина", dep.size, "мин", int(a.min()), "макс", int(a.max()),
          "средняя %.2f" % (a.mean() / 255.0))


if __name__ == "__main__":
    main()
