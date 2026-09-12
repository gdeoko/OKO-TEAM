"""Нарезка сгенерированных снимков в текстуры рамки пульта.

Правило: полосу рамки нельзя натянуть картинкой целиком - у полосы
пропорция 15:1, у снимка 3:2, и всё содержимое сплющится. Поэтому
режем узкие полосы, близкие по пропорции к тому, что реально видно
на экране, а крупные узлы (люки, решётки, экраны) уходят отдельными
наклейками на свою геометрию.
"""
from PIL import Image
import os

SRC = 'frame'
OUT = '/home/user/OKO-TEAM/rocketcdn/assets/gen/panel'
os.makedirs(OUT, exist_ok=True)

def crop(name, box, size, dst, flip=False):
    im = Image.open(os.path.join(SRC, name)).convert('RGB').crop(box)
    if flip: im = im.transpose(Image.FLIP_LEFT_RIGHT)
    im = im.resize(size, Image.LANCZOS)
    im.save(os.path.join(OUT, dst), 'WEBP', quality=92, method=5)
    print(dst, im.size, os.path.getsize(os.path.join(OUT, dst)))
    return im

# 1. Верхняя балка: плита с люками и янтарный световод под ней.
crop('frame-top-v1.png', (70, 255, 1470, 700), (1024, 326), 'fr-top.webp')

# 2. Боковая стойка: световая трубка, врезанный экран, три тумблера.
crop('frame-side-v3.png', (335, 15, 855, 1390), (256, 677), 'fr-side.webp')

# 3. Нижняя палуба: машинная плита с винтами, телеметрия, решётка.
crop('keys-row-v3.png', (60, 640, 1480, 1010), (1024, 267), 'fr-deck.webp')

# 4. Обойма клавиш: рамка гнезда без самих клавиш - берём кусок
#    бортика слева от первой клавиши и тянем как трим.
crop('keys-row-v3.png', (60, 240, 1470, 660), (1024, 305), 'fr-bezel.webp')

# 5. Лица семи клавиш в один атлас.
im = Image.open(os.path.join(SRC, 'keys-row-v3.png')).convert('RGB')
CELL = 160
atlas = Image.new('RGB', (CELL*7, CELL), (8, 10, 13))
cx0, pitch = 189, 195.3
for i in range(7):
    cx = int(round(cx0 + pitch*i))
    face = im.crop((cx-80, 350, cx+80, 510)).resize((CELL, CELL), Image.LANCZOS)
    atlas.paste(face, (i*CELL, 0))
atlas.save(os.path.join(OUT, 'fr-keys.webp'), 'WEBP', quality=94, method=5)
print('fr-keys.webp', atlas.size, os.path.getsize(os.path.join(OUT, 'fr-keys.webp')))

# 6. Угловая косынка.
crop('frame-corner-v3.png', (40, 40, 1100, 1100), (512, 512), 'fr-corner.webp')
