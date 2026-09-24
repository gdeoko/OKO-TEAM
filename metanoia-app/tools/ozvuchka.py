"""Озвучка уроков её голосом.

Берёт чистый текст из content/reading-glava1/narration/lNN.txt, режет по
абзацам на куски (у службы есть предел на запрос), озвучивает голосом
«Екатерина Метанойя» и склеивает в один mp3 рядом с остальными уроками.

    python ozvuchka.py 1          один урок
    python ozvuchka.py 1 2 3      несколько
    python ozvuchka.py --все      все четырнадцать

Готовый файл кладётся в public_html/assets/audio/lessons/lNN.mp3.
Уже озвученный урок пропускается, если не сказано --заново.
"""

import os
import subprocess
import sys
import time
import urllib.error
import urllib.request

КОРЕНЬ = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ТЕКСТЫ = os.path.join(КОРЕНЬ, 'content', 'reading-glava1', 'narration')
ЗВУК = os.path.join(КОРЕНЬ, 'public_html', 'assets', 'audio', 'lessons')
ВРЕМЯНКА = '/tmp/mt_ozvuchka'

ГОЛОС = 'C3PRv47CWjDEkHCKLZxx'          # «Екатерина Метанойя», её клон
МОДЕЛЬ = 'eleven_flash_v2_5'
ПРЕДЕЛ = 3500                            # знаков на один запрос
КЛЮЧ = os.environ.get('ELEVEN_KEY', '')


def куски(текст, предел=ПРЕДЕЛ):
    """Режем по абзацам, не разрывая предложения."""
    вышло, текущий = [], ''
    for абзац in [а.strip() for а in текст.split('\n') if а.strip()]:
        if len(текущий) + len(абзац) + 2 <= предел:
            текущий = (текущий + '\n\n' + абзац).strip()
            continue
        if текущий:
            вышло.append(текущий)
        while len(абзац) > предел:
            край = абзац.rfind('. ', 0, предел)
            край = край + 1 if край > предел // 2 else предел
            вышло.append(абзац[:край].strip())
            абзац = абзац[край:].strip()
        текущий = абзац
    if текущий:
        вышло.append(текущий)
    return вышло


def озвучить(текст, куда, попыток=4):
    тело = ('{"text": %s, "model_id": "%s", "voice_settings":'
            ' {"stability": 0.45, "similarity_boost": 0.8, "style": 0.15}}'
            % (__import__('json').dumps(текст, ensure_ascii=False), МОДЕЛЬ)).encode()
    адрес = ('https://api.elevenlabs.io/v1/text-to-speech/%s?output_format=mp3_44100_64'
             % ГОЛОС)
    for попытка in range(попыток):
        запрос = urllib.request.Request(адрес, data=тело, headers={
            'xi-api-key': КЛЮЧ, 'Content-Type': 'application/json'})
        try:
            with urllib.request.urlopen(запрос, timeout=300) as ответ:
                data = ответ.read()
            if len(data) < 2000:
                raise RuntimeError('пустой ответ, %d байт' % len(data))
            open(куда, 'wb').write(data)
            return True
        except Exception as e:
            подробно = ''
            if isinstance(e, urllib.error.HTTPError):
                подробно = e.read()[:200].decode('utf-8', 'replace')
            print('    попытка %d не вышла: %s %s' % (попытка + 1, e, подробно))
            time.sleep(4 * (попытка + 1))
    return False


def длительность(файл):
    из = subprocess.run(['ffprobe', '-v', 'error', '-show_entries', 'format=duration',
                         '-of', 'default=nw=1:nk=1', файл], capture_output=True, text=True)
    try:
        return float(из.stdout.strip())
    except ValueError:
        return 0.0


def урок(n, заново=False):
    исходник = os.path.join(ТЕКСТЫ, 'l%02d.txt' % n)
    готовый = os.path.join(ЗВУК, 'l%d.mp3' % n)
    if not os.path.exists(исходник):
        print('урок %d: текста нет' % n)
        return False
    if os.path.exists(готовый) and not заново and длительность(готовый) > 180:
        print('урок %d: уже озвучен (%.0f с)' % (n, длительность(готовый)))
        return True

    текст = open(исходник, encoding='utf-8').read().strip()
    части = куски(текст)
    print('урок %d: %d знаков, %d кусков' % (n, len(текст), len(части)))

    папка = os.path.join(ВРЕМЯНКА, 'l%02d' % n)
    os.makedirs(папка, exist_ok=True)
    файлы = []
    for i, часть in enumerate(части):
        кусок = os.path.join(папка, '%02d.mp3' % i)
        if not (os.path.exists(кусок) and os.path.getsize(кусок) > 2000):
            if not озвучить(часть, кусок):
                print('урок %d: кусок %d не озвучился, урок пропускаем' % (n, i))
                return False
            time.sleep(0.5)
        файлы.append(кусок)
        print('    кусок %d/%d готов (%d знаков)' % (i + 1, len(части), len(часть)))

    список = os.path.join(папка, 'sklejka.txt')
    with open(список, 'w', encoding='utf-8') as ф:
        for пф in файлы:
            ф.write("file '%s'\n" % пф)
    из = subprocess.run(['ffmpeg', '-y', '-f', 'concat', '-safe', '0', '-i', список,
                         '-c:a', 'libmp3lame', '-b:a', '64k', '-ar', '44100', '-ac', '1',
                         готовый], capture_output=True, text=True)
    if из.returncode != 0 or not os.path.exists(готовый):
        print('урок %d: склейка не вышла: %s' % (n, из.stderr[-200:]))
        return False
    print('урок %d: готово, %.0f с, %.1f МБ'
          % (n, длительность(готовый), os.path.getsize(готовый) / 1048576))
    return True


def главное():
    if not КЛЮЧ:
        print('нет ключа ELEVEN_KEY в окружении')
        return 1
    заново = '--заново' in sys.argv
    номера = [int(x) for x in sys.argv[1:] if x.isdigit()]
    if '--все' in sys.argv:
        номера = list(range(1, 15))
    if not номера:
        print(__doc__)
        return 1
    os.makedirs(ВРЕМЯНКА, exist_ok=True)
    плохо = 0
    for n in номера:
        if not урок(n, заново):
            плохо += 1
    print('не озвучено уроков: %d' % плохо)
    return 1 if плохо else 0


sys.exit(главное())
