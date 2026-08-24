#!/usr/bin/env python3
"""
Приёмка чистой плиты рубки: вырезать окно в прозрачность.

Плиту рисует кабинет ChatGPT по нашему кадру: та же рубка, тот же
свет, но пульт пустой - только чистый металл и пустые ниши под
приборы. Кнопки и экраны потом кладёт код светом поверх металла, и
поэтому они выходят частью панели, а не наклейкой.

Здесь из плиты делается то, что нужно слою: окно становится дырой в
прозрачность, чтобы сквозь него был виден космос.

Окно ищем заливкой чёрного от центра кадра: брать «всё тёмное»
нельзя, тёмного в рубке много. Край режем по яркости с мягким
переходом в один шаг, иначе на кромке видна лесенка.

  python3 tools/cabplate.py вход.png выход.webp
"""
import sys
from collections import deque

import numpy as np
from PIL import Image

ЧЁРНОЕ = 20        # ярче этого уже не космос, а металл
МЯГКО = 34         # до этой яркости альфа растёт от нуля до единицы


def вырезать(src, dst):
    im = Image.open(src).convert("RGB")
    w, h = im.size
    a = np.asarray(im).astype(np.float32)
    lum = 0.2126 * a[:, :, 0] + 0.7152 * a[:, :, 1] + 0.0722 * a[:, :, 2]

    тьма = lum <= ЧЁРНОЕ
    if not тьма[h // 2, w // 2]:
        raise SystemExit("центр кадра не чёрный: окна нет")

    окно = np.zeros_like(тьма)
    q = deque([(h // 2, w // 2)])
    окно[h // 2, w // 2] = True
    while q:
        y, x = q.popleft()
        for ny, nx in ((y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1)):
            if 0 <= ny < h and 0 <= nx < w and тьма[ny, nx] and not окно[ny, nx]:
                окно[ny, nx] = True
                q.append((ny, nx))

    # Кромка: прозрачность спадает не ступенькой, а по яркости в узкой
    # полосе вокруг найденной области. Полосу берём разрастанием окна
    # на пару точек - там, где металл только начинает светлеть.
    from PIL import ImageFilter
    м = Image.fromarray((окно * 255).astype(np.uint8), "L")
    шире = np.asarray(м.filter(ImageFilter.MaxFilter(5))) > 127
    край = шире & ~окно

    alpha = np.where(окно, 0.0, 255.0)
    доля = np.clip((lum - ЧЁРНОЕ) / max(1.0, МЯГКО - ЧЁРНОЕ), 0.0, 1.0)
    alpha[край] = (доля * 255.0)[край]

    out = np.dstack([a, alpha]).astype(np.uint8)
    Image.fromarray(out, "RGBA").save(dst, quality=95, method=6)
    ys, xs = np.nonzero(окно)
    print("%s %dx%d окно %.1f%% кадра, поля Л%.1f П%.1f В%.1f Н%.1f" % (
        dst, w, h, 100.0 * окно.sum() / (w * h),
        100.0 * xs.min() / w, 100.0 * (w - xs.max()) / w,
        100.0 * ys.min() / h, 100.0 * (h - ys.max()) / h))


if __name__ == "__main__":
    if len(sys.argv) < 3:
        raise SystemExit(__doc__)
    вырезать(sys.argv[1], sys.argv[2])
