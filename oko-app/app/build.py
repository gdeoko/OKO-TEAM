#!/usr/bin/env python3
"""Сборка OKO APP: base.html + модули -> prototype/index.html (единый файл).

Модуль = папка app/modules/<name>/ с файлами (все необязательные):
  style.css    -> вставляется в @MODULES:CSS
  screen.html  -> вставляется перед </main> (полноэкранные <section class="screen">)
  overlay.html -> вставляется перед supabase-скриптом (sheets, fullscreen-вьюхи)
  script.js    -> вставляется перед закрывающим </script> (после ядра, self-init)

Порядок модулей задаёт ORDER (core-ext всегда первый).
"""
import os, sys, re

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', 'prototype', 'index.html')

ORDER = [
    'core-ext',        # кошелёк-ядро, i18n-ядро, попапы, печать, verified, admin-auth
    'registration',    # полная регистрация + попапы онбординга
    'wallet',          # экран кошелька / лицевой счёт
    'games',           # игры: рулетка + дорога
    'academy',         # академия: уроки, тесты, сертификаты
    'ads',             # рекламный кабинет
    'legal',           # юр-документы RU/EN
    'verify-stickers', # верификация + стикеры/TON-эмодзи
    'i18n-settings',   # язык в настройках + переводы хрома
    'admin-hq',        # HQ-окно и расширение админки
    'market-pro',      # биржа: кабинет продавца + пакеты услуг OKO
    'feed-algo',       # алгоритмы рекомендаций ленты по интересам
    'demo-content',    # живое наполнение: чаты, каналы, сторис
    'navstack',        # единый стек навигации: назад везде (TG BackButton + history)
    'tg-webapp',       # интеграция Telegram Mini App (@okoappbot)
    'pwa',             # установка на главный экран + service worker
]

def read(p):
    with open(p, encoding='utf-8') as f:
        return f.read()

def collect(kind):
    parts = []
    for name in ORDER:
        p = os.path.join(HERE, 'modules', name, kind)
        if os.path.exists(p):
            parts.append(f'\n/* ===== module: {name} ===== */\n' if kind.endswith(('.css', '.js'))
                         else f'\n<!-- ===== module: {name} ===== -->\n')
            parts.append(read(p))
    return ''.join(parts)

def main():
    base = read(os.path.join(HERE, 'base.html'))
    css = collect('style.css')
    screens = collect('screen.html')
    overlays = collect('overlay.html')
    js = collect('script.js')

    out = base.replace('/* @MODULES:CSS */', css + '\n')
    out = out.replace('<!-- @MODULES:SCREENS -->', screens + '\n')
    out = out.replace('<!-- @MODULES:OVERLAYS -->', overlays + '\n')
    out = out.replace('/* @MODULES:JS */', js + '\n')

    # версия сборки: единая точка — app/VERSION
    ver = read(os.path.join(HERE, 'VERSION')).strip()
    out = re.sub(r'сборка v[0-9.]+', f'сборка v{ver}', out)

    with open(OUT, 'w', encoding='utf-8') as f:
        f.write(out)
    print(f'OK -> {os.path.relpath(OUT, HERE)}  v{ver}  ({len(out)//1024} KB)')

if __name__ == '__main__':
    main()
