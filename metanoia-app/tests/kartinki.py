# Проверка картинок уроков: сколько их, все ли на месте, нет ли повторов.
import hashlib
import os
import struct
import sys

import os.path
# Папка с картинками относительно этого файла: тесты лежат в metanoia-app/tests.
ПАПКА = os.path.normpath(os.path.join(
    os.path.dirname(os.path.abspath(__file__)), '..', 'public_html', 'assets', 'img', 'lessons'))


def размер(путь):
    """Ширина и высота JPEG без сторонних библиотек."""
    with open(путь, 'rb') as ф:
        данные = ф.read()
    i = 2
    while i < len(данные) - 9:
        if данные[i] != 0xFF:
            i += 1
            continue
        маркер = данные[i + 1]
        if маркер in (0xC0, 0xC1, 0xC2, 0xC3, 0xC5, 0xC6, 0xC7,
                      0xC9, 0xCA, 0xCB, 0xCD, 0xCE, 0xCF):
            высота, ширина = struct.unpack('>HH', данные[i + 5:i + 9])
            return ширина, высота
        if маркер in (0xD8, 0xD9) or 0xD0 <= маркер <= 0xD7:
            i += 2
            continue
        длина = struct.unpack('>H', данные[i + 2:i + 4])[0]
        i += 2 + длина
    return 0, 0


def главное():
    файлы = sorted(os.listdir(ПАПКА))
    обложки = {}
    внутри = {}
    for имя in файлы:
        if not имя.endswith('.jpg'):
            continue
        путь = os.path.join(ПАПКА, имя)
        номер = имя[1:-4]
        (внутри if номер.endswith('-a') else обложки)[номер.replace('-a', '')] = путь

    print('обложек: %d, картинок в тексте: %d' % (len(обложки), len(внутри)))

    нет_обложки = [n for n in range(1, 106) if str(n) not in обложки]
    нет_картинки = [n for n in range(1, 106) if str(n) not in внутри]
    print('уроков без обложки: %s' % (нет_обложки if нет_обложки else 'нет'))
    print('уроков без картинки в тексте: %s' % (
        ('%d штук, первые: %s' % (len(нет_картинки), нет_картинки[:8]))
        if нет_картинки else 'нет'))

    хеши = {}
    мелкие = []
    for имя, путь in list(обложки.items()) + list(внутри.items()):
        ш, в = размер(путь)
        if ш < 700:
            мелкие.append('%s (%dx%d)' % (имя, ш, в))
        х = hashlib.md5(open(путь, 'rb').read()).hexdigest()
        хеши.setdefault(х, []).append(имя)

    повторы = [гр for гр in хеши.values() if len(гр) > 1]
    print('повторов: %s' % (повторы[:5] if повторы else 'нет'))
    print('мелких: %s' % (мелкие[:6] if мелкие else 'нет'))
    вес = sum(os.path.getsize(p) for p in list(обложки.values()) + list(внутри.values()))
    print('вес всех картинок уроков: %.1f МБ' % (вес / 1048576))
    return 1 if (нет_обложки or повторы or мелкие) else 0


sys.exit(главное())
