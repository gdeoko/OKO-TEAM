"""Ужатие картинок для витрины одним файлом.

Читает список путей (по одному в строке) на входе, кладёт ужатые копии в
папку-кэш и печатает «исходный путь<TAB>путь к копии». Если копия уже есть и
свежее исходника, второй раз не жмём.

Витрина вшивает картинки прямо в HTML в base64, поэтому каждый лишний
килобайт вырастает на треть и достаётся телефону клиента целиком.
"""
import os
import sys

from PIL import Image

БОК = int(os.environ.get('SHOWCASE_PX', '760'))
КАЧЕСТВО = int(os.environ.get('SHOWCASE_Q', '68'))


def ужать(исходник, кэш):
    имя = исходник.replace('/', '_').replace('\\', '_')
    копия = os.path.join(кэш, '%d_%d_%s' % (БОК, КАЧЕСТВО, имя))
    if os.path.exists(копия) and os.path.getmtime(копия) >= os.path.getmtime(исходник):
        return копия
    им = Image.open(исходник)
    if им.mode in ('RGBA', 'LA', 'P'):
        фон = Image.new('RGB', им.size, (255, 255, 255))
        им = им.convert('RGBA')
        фон.paste(им, mask=им.split()[-1])
        им = фон
    else:
        им = им.convert('RGB')
    if max(им.size) > БОК:
        им.thumbnail((БОК, БОК), Image.LANCZOS)
    им.save(копия, 'JPEG', quality=КАЧЕСТВО, optimize=True, progressive=True)
    # Если ужатая копия не легче исходника, она не нужна.
    if os.path.getsize(копия) >= os.path.getsize(исходник):
        os.remove(копия)
        return исходник
    return копия


def главное():
    кэш = sys.argv[1]
    os.makedirs(кэш, exist_ok=True)
    for строка in sys.stdin:
        путь = строка.strip()
        if not путь or not os.path.exists(путь):
            continue
        try:
            print('%s\t%s' % (путь, ужать(путь, кэш)))
        except Exception as e:
            print('%s\t%s' % (путь, путь))
            sys.stderr.write('не ужалось %s: %s\n' % (путь, str(e)[:80]))


главное()
