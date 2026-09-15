#!/usr/bin/env python3
"""
Очистка приборной полки кадра рубки под свои кнопки и экраны.

Заказчик сформулировал задачу точно: «удалить все кнопки и экраны,
пустыми сделать, а потом поверх наложить ровно кнопки функциональные
и в экраны видео». Так и делаем. Пока на полке нарисованы чужие
клавиши, любая своя ложится поверх них наклейкой - как ни ровняй.

Убираем всё яркое и цветное в полосе под окном и оставляем чистый
тёмный металл с той же светотенью, что была. Способ простой и
надёжный: маска ярких пятен растёт на пару пикселей, а под ней
подставляется сильно размытая версия того же кадра - у металла нет
рисунка, только градиент, и подмены не видно.

  python3 tools/cabclean.py вход.webp выход.webp
"""
import sys

import numpy as np
from PIL import Image, ImageFilter


def clean(src, dst):
    im = Image.open(src).convert("RGBA")
    w, h = im.size
    a = np.asarray(im).astype(np.float32)
    alpha = a[:, :, 3]
    rgb = a[:, :, :3]

    # Полоса полки: всё, что ниже нижней кромки ОКНА.
    #
    # Окно ищем заливкой от центра, а не по всем прозрачным точкам:
    # у кадра прозрачны ещё и углы за габаритом рубки, они доходят до
    # самого низа, и полка тогда получалась в один ряд пикселей.
    from collections import deque
    tr = alpha < 128
    seen = np.zeros_like(tr)
    if tr[h // 2, w // 2]:
        q = deque([(h // 2, w // 2)])
        seen[h // 2, w // 2] = True
        while q:
            y, x = q.popleft()
            for ny, nx in ((y - 1, x), (y + 1, x), (y, x - 1), (y, x + 1)):
                if 0 <= ny < h and 0 <= nx < w and tr[ny, nx] and not seen[ny, nx]:
                    seen[ny, nx] = True
                    q.append((ny, nx))
    ys, xs = np.nonzero(seen)
    win_b = ys.max() / h if len(ys) else 0.75
    band = np.zeros((h, w), dtype=bool)
    band[int(win_b * h):, :] = True

    lum = 0.2126 * rgb[:, :, 0] + 0.7152 * rgb[:, :, 1] + 0.0722 * rgb[:, :, 2]
    mx = rgb.max(axis=2)
    mn = rgb.min(axis=2)
    sat = (mx - mn) / np.maximum(1.0, mx)
    # Кнопки и экраны отличаются от металла двумя вещами: они светлее
    # окружения и цветные. Металл же тёмный и почти серый.
    hot = band & ((lum > 46) | (sat > 0.28))

    m = Image.fromarray((hot * 255).astype(np.uint8), "L")
    m = m.filter(ImageFilter.MaxFilter(9)).filter(ImageFilter.GaussianBlur(3.5))
    k = (np.asarray(m).astype(np.float32) / 255.0)[:, :, None]

    # Подложка: тот же кадр, размытый настолько, что от приборов
    # остаётся только общий тон полки.
    base = Image.fromarray(rgb.astype(np.uint8), "RGB").filter(ImageFilter.GaussianBlur(26))
    b = np.asarray(base).astype(np.float32) * 0.82

    out = rgb * (1 - k) + b * k
    res = Image.fromarray(out.astype(np.uint8), "RGB")
    res.putalpha(Image.fromarray(alpha.astype(np.uint8), "L"))
    res.save(dst, quality=95, method=6)
    print("очищено", dst, res.size, "пятен", int(hot.sum()), "из", int(band.sum()))


if __name__ == "__main__":
    clean(sys.argv[1], sys.argv[2])
