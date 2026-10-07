# -*- coding: utf-8 -*-
"""Демо-копия сайта на okoteam.top/klaster/ ссылалась на /assets/... от корня,
то есть на корень okoteam.top. Префиксуем пути самой копии, боевой сайт не трогаем."""
import io, os, re

КОРЕНЬ = '/var/www/okoteam/klaster'
ПРЕФИКС = '/klaster'
РАСШИРЕНИЯ = ('.html', '.css', '.js', '.json', '.webmanifest', '.xml')

# что переписываем: абсолютный путь от корня -> тот же путь внутри копии
ЦЕЛИ = ['/assets/', '/policy/', '/vyezdy/', '/broker-tur/', '/analiz/', '/brand/',
        '/404.html', '/robots.txt', '/sitemap.xml', '/site.webmanifest', '/api/']

правок = 0
файлов = 0
for корень, папки, файлы in os.walk(КОРЕНЬ):
    if '/2026-09-06' in корень:          # дневная страница уже с полными адресами
        continue
    for имя in файлы:
        if not имя.endswith(РАСШИРЕНИЯ) or '.before_restore' in имя or '.bak' in имя:
            continue
        путь = os.path.join(корень, имя)
        try:
            s = io.open(путь, encoding='utf-8').read()
        except (UnicodeDecodeError, OSError):
            continue
        было = s
        for ц in ЦЕЛИ:
            for кавычка in ('"', "'", '(', ' '):
                s = s.replace(кавычка + ц, кавычка + ПРЕФИКС + ц)
            s = s.replace('url(' + ц, 'url(' + ПРЕФИКС + ц)
        # уже префиксованное не удваиваем
        s = s.replace(ПРЕФИКС + ПРЕФИКС, ПРЕФИКС)
        # ссылка «на главную» внутри копии
        s = re.sub(r'href="/"', 'href="%s/"' % ПРЕФИКС, s)
        s = re.sub(r'href="/#', 'href="%s/#' % ПРЕФИКС, s)
        if s != было:
            io.open(путь, 'w', encoding='utf-8').write(s)
            правок += s.count(ПРЕФИКС + '/assets/')
            файлов += 1
print(u'файлов переписано: %d, ссылок на ассеты внутри: %d' % (файлов, правок))
