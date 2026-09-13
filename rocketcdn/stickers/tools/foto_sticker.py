# -*- coding: utf-8 -*-
"""Фотостикер: снимок на чёрном -> прозрачный видеостикер Telegram.

Вектор рисует ровно, но руки, стекло и металл вектором выходят кривыми -
владелец забраковал их именно за это. Фотореалистичный кадр из ChatGPT
снимает вопрос качества, но в .tgs картинку не положить вовсе. Телеграм
для этого держит второй формат: WEBM VP9 с альфой, те же 512x512.

Путь единицы:

  1. кадр приходит на ЧИСТО ЧЁРНОМ - это не фон, это готовая маска;
  2. маска снимается без нейросети: где светится, там предмет;
  3. предмет вписывается в ту же сетку, что и векторный пак, - иначе в
     одном ряду половина стикеров окажется крупнее другой;
  4. движение задаётся преобразованием, а не рисованием: подъём,
     наклон и блик по глянцу. Кривым такое выйти не может.

    python3 foto_sticker.py <кадр.png> <ключ> [движение]
"""

import os
import subprocess
import sys

import numpy as np
from PIL import Image
from scipy import ndimage

SIZE = 512          # сторона стикера, требование Telegram
FPS = 30
SECONDS = 3.0
FRAMES = int(FPS * SECONDS)
TARGET = 0.82       # доля кадра под предмет: та же, что у векторного пака
LIMIT = 256 * 1024      # потолок веса видеостикера
# У кастом-эмодзи потолок свой и втрое жёстче, а сторона меньше. Один файл
# на оба набора Telegram не берёт: 512x512 на 225 кб он отбивает ответом
# «file is too big». Поэтому эмодзи собирается из ТЕХ ЖЕ кадров, тем же
# кадрированием и тем же движением, только мельче и плотнее - выглядит
# один в один, потому что это буквально та же анимация.
LIMIT_EMO = 64 * 1024
SIDE_EMO = 100


def уже_с_альфой(path):
    """Готовый PNG с прозрачностью пропускаем мимо ключа.

    Фирменный знак берётся настоящим файлом, а не пересобирается заново:
    правило владельца - лого только 1:1. Гонять его через ключ по
    чёрному незачем и вредно, ключ съел бы тёмную обводку.
    """
    im = Image.open(path).convert("RGBA")
    if np.asarray(im)[..., 3].min() == 255:
        return None
    return np.asarray(im)


def снять_с_чёрного(path, порог=9, мягко=42):
    """Кадр на чёрном -> RGBA.

    Наивный ключ по яркости съел бы тёмные части самого предмета:
    иллюминатор почти чёрный, и от него осталась бы дырка. Поэтому
    силуэт считается отдельно - смыкание, крупный кусок, заливка
    внутренностей, - и внутри силуэта альфа всегда полная. Мягкая альфа
    остаётся только СНАРУЖИ, там где свечение сходит на нет.
    """
    rgb = np.asarray(Image.open(path).convert("RGB"), dtype=np.float32)
    m = rgb.max(2)

    твёрдо = m > порог
    твёрдо = ndimage.binary_closing(твёрдо, np.ones((9, 9)))
    метки, n = ndimage.label(твёрдо)
    if n > 1:
        размеры = ndimage.sum(твёрдо, метки, range(1, n + 1))
        твёрдо = метки == (int(np.argmax(размеры)) + 1)
    твёрдо = ndimage.binary_fill_holes(твёрдо)
    твёрдо = ndimage.binary_erosion(твёрдо, np.ones((3, 3)))

    мягкая = np.clip(m / float(мягко), 0, 1)
    alpha = np.where(твёрдо, 1.0, мягкая * 0.85)

    # снаружи цвет лежит домноженным на альфу: вернуть его, иначе край
    # предмета уйдёт в черноту и получится грязная обводка
    k = np.where(alpha > 0.02, alpha, 1.0)[..., None]
    цвет = np.where(твёрдо[..., None], rgb, np.clip(rgb / k, 0, 255))

    out = np.zeros(rgb.shape[:2] + (4,), dtype=np.uint8)
    out[..., :3] = цвет.astype(np.uint8)
    out[..., 3] = (alpha * 255).astype(np.uint8)
    return out


def вписать(rgba, доля=TARGET, поле=SIZE, запас=1.0):
    """Предмет в центр общей сетки.

    Ровность пака держится здесь: у каждого стикера предмет занимает одну
    и ту же долю кадра и стоит ровно в центре. Запас оставляется под
    движение, чтобы подъём и наклон не вынесли предмет за край.
    """
    im = Image.fromarray(rgba, "RGBA")
    bb = im.split()[3].getbbox()
    if bb:
        im = im.crop(bb)
    w, h = im.size
    k = (поле * доля * запас) / float(max(w, h))
    im = im.resize((max(1, int(round(w * k))), max(1, int(round(h * k)))),
                   Image.LANCZOS)
    лист = Image.new("RGBA", (поле, поле), (0, 0, 0, 0))
    лист.paste(im, ((поле - im.size[0]) // 2, (поле - im.size[1]) // 2))
    return лист


def блик(im, фаза, сила=0.30, ширина=0.30):
    """Бегущий блик по глянцу.

    Даёт ощущение объёма надёжнее любого подрагивания: свет идёт по
    поверхности, а не предмет дёргается. Бьёт только по светлым местам -
    на матовом металле блика не бывает.
    """
    a = np.asarray(im, dtype=np.float32)
    h, w = a.shape[:2]
    y, x = np.mgrid[0:h, 0:w]
    d = (x / float(w) + y / float(h)) / 2.0
    центр = -0.35 + 1.7 * фаза
    полоса = np.exp(-((d - центр) ** 2) / (2 * (ширина / 3.0) ** 2))
    яркость = a[..., :3].max(2) / 255.0
    добавка = (полоса * яркость ** 2 * сила * 255.0)[..., None]
    a[..., :3] = np.clip(a[..., :3] + добавка, 0, 255)
    return Image.fromarray(a.astype(np.uint8), "RGBA")


ДВИЖЕНИЯ = {
    # (подъём в пикселях, наклон в градусах, масштаб +-, блик)
    "полёт":  dict(dy=14, rot=3.0, sc=0.02, sweep=True),
    "парит":  dict(dy=10, rot=1.6, sc=0.015, sweep=True),
    "пульс":  dict(dy=4, rot=0.0, sc=0.045, sweep=True),
    "покой":  dict(dy=5, rot=1.0, sc=0.01, sweep=True),
}


def кадры_перехода(а, б, держать=0.30):
    """Два состояния в одном стикере: было -> стало -> обратно.

    Замок владелец просил одним стикером: закрыт, ключ вставили,
    открылся. Одним снимком такого не снять, поэтому снимаем два и
    растворяем между ними. Первое состояние держится дольше второго:
    зритель должен успеть понять, ЧТО изменилось, а не увидеть мельканье.
    """
    держ = int(FRAMES * держать)
    ход = int(FRAMES * 0.13)
    out = []
    for i in range(FRAMES):
        t = i / float(FRAMES)
        if i < держ:
            k = 0.0
        elif i < держ + ход:
            k = (i - держ) / float(ход)
        elif i < FRAMES - ход:
            k = 1.0
        else:
            k = 1.0 - (i - (FRAMES - ход)) / float(ход)
        k = k * k * (3 - 2 * k)          # мягкий вход и выход
        f = Image.blend(а, б, k) if k > 0 else а
        out.append(блик(f, t))
    return out


def кадры(лист, движение="парит"):
    п = ДВИЖЕНИЯ.get(движение, ДВИЖЕНИЯ["парит"])
    out = []
    for i in range(FRAMES):
        t = i / float(FRAMES)
        s = np.sin(2 * np.pi * t)
        c = np.sin(2 * np.pi * t + np.pi / 3)
        k = 1.0 + п["sc"] * s
        f = лист
        if п["rot"]:
            f = f.rotate(п["rot"] * c, Image.BICUBIC, expand=False)
        if abs(k - 1.0) > 1e-3:
            n = int(round(SIZE * k))
            f = f.resize((n, n), Image.LANCZOS)
            лист2 = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
            лист2.paste(f, ((SIZE - n) // 2, (SIZE - n) // 2))
            f = лист2
        if п["dy"]:
            сдвиг = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
            сдвиг.paste(f, (0, int(round(-п["dy"] * s))))
            f = сдвиг
        if п["sweep"]:
            f = блик(f, t)
        out.append(f)
    return out


def собрать(кадры_, dest, предел=LIMIT, сторона=None):
    """Кадры -> WEBM VP9 с альфой, весом под потолок Telegram.

    Битрейт подбирается перебором: угадать его нельзя, у гладкого
    предмета и у сложного он отличается втрое, а пережать «с запасом»
    значит отдать мыло там, где места хватало.
    """
    tmp = dest + ".frames"
    os.makedirs(tmp, exist_ok=True)
    for i, f in enumerate(кадры_):
        f.save(os.path.join(tmp, "%03d.png" % i))
    лучший = None
    ставки = (("620k", "460k", "340k", "250k", "180k", "130k") if сторона is None
              else ("150k", "110k", "85k", "64k", "48k", "34k"))
    for br in ставки:
        cmd = ["ffmpeg", "-y", "-loglevel", "error", "-framerate", str(FPS),
               "-i", os.path.join(tmp, "%03d.png")]
        if сторона:
            cmd += ["-vf", "scale=%d:%d:flags=lanczos" % (сторона, сторона)]
        cmd += ["-c:v", "libvpx-vp9", "-pix_fmt", "yuva420p",
                "-b:v", br, "-maxrate", br, "-bufsize", "1M",
                "-auto-alt-ref", "0", "-deadline", "good", "-cpu-used", "1",
                "-an", dest]
        subprocess.run(cmd, check=True)
        n = os.path.getsize(dest)
        if n <= предел:
            лучший = (br, n)
            break
    for f in os.listdir(tmp):
        os.remove(os.path.join(tmp, f))
    os.rmdir(tmp)
    if not лучший:
        raise SystemExit("не влезло в %d байт даже на %s" % (предел, ставки[-1]))
    return лучший


def собрать_ключ(src, key, движение, dest_dir, второй=None, эмодзи=None):
    """Один стикер: кадр (или пара кадров) -> готовый .webm.

    Если задана папка под эмодзи, из ТЕХ ЖЕ кадров собирается второй файл
    мельче и плотнее. Пересчитывать кадры заново нельзя: пара наборов
    обязана совпадать не «похоже», а движение в движение.
    """
    rgba = уже_с_альфой(src)
    if rgba is None:
        rgba = снять_с_чёрного(src)
    лист = вписать(rgba, запас=0.94)
    if движение == "переход" and второй:
        r2 = уже_с_альфой(второй)
        if r2 is None:
            r2 = снять_с_чёрного(второй)
        ks = кадры_перехода(лист, вписать(r2, запас=0.94))
    else:
        ks = кадры(лист, движение)
    dest = os.path.join(dest_dir, key + ".webm")
    br, n = собрать(ks, dest)
    мал = None
    if эмодзи:
        e = os.path.join(эмодзи, key + ".webm")
        мал = собрать(ks, e, LIMIT_EMO, SIDE_EMO)[1]
    return dest, n, br, мал


def main():
    if len(sys.argv) < 3:
        print(__doc__)
        return 1
    src, key = sys.argv[1], sys.argv[2]
    движение = sys.argv[3] if len(sys.argv) > 3 else "парит"
    out = os.path.join(os.path.dirname(os.path.abspath(src)), key + ".webm")
    rgba = уже_с_альфой(src)
    if rgba is None:
        rgba = снять_с_чёрного(src)
    лист = вписать(rgba, запас=0.94)
    br, n = собрать(кадры(лист, движение), out)
    print("%-12s %s  %d кб  битрейт %s" % (key, out, n // 1024, br))
    return 0


if __name__ == "__main__":
    sys.exit(main())
