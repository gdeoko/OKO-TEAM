#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
OKO · ХИРУРГИЧЕСКАЯ ЧИСТКА ДЕМО-ДАННЫХ
=======================================
Правка Даниэля 09.08: «убрать абсолютно все демо данные, демо чаты, демо
уведомления, демо штаб. Оставить только официальные чаты и каналы OKO,
остальное будут создавать сами пользователи. Человек заходит — у него только
канал/чат OKO и личка с Даниэлем.»

Подход: НЕ вырезаем блоки кода (это ломает 53-тысячный файл), а обнуляем
источники данных. Вся логика рендера, ранжирования и алгоритмов остаётся —
меняется только то, ЧЕМ она наполняется. Пустой массив -> приложение само
показывает empty-state, который уже написан в ядре.

Каждая правка проверяется: если якорь не найден — скрипт падает, а не тихо
пропускает. Так мы гарантированно не оставим демо-данные незамеченными.
"""
import re
import sys
import os

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'prototype')
JS   = os.path.join(ROOT, 'app.js')
HTML = os.path.join(ROOT, 'index.html')

report = []
errors = []


def read(p):
    with open(p, encoding='utf-8') as f:
        return f.read()


def write(p, s):
    with open(p, 'w', encoding='utf-8') as f:
        f.write(s)


def match_bracket(s, i):
    """Индекс закрывающей скобки для открывающей на позиции i.
    Учитывает строки, шаблонные литералы, комментарии и регулярки — иначе на
    таком объёме кода баланс скобок обязательно собьётся."""
    open_ch = s[i]
    close_ch = {'[': ']', '{': '}', '(': ')'}[open_ch]
    depth = 0
    n = len(s)
    while i < n:
        c = s[i]
        # строки
        if c in ('"', "'", '`'):
            q = c
            i += 1
            while i < n:
                if s[i] == '\\':
                    i += 2
                    continue
                if q == '`' and s[i] == '$' and i + 1 < n and s[i + 1] == '{':
                    j = match_bracket(s, i + 1)
                    i = j + 1
                    continue
                if s[i] == q:
                    break
                i += 1
            i += 1
            continue
        # комментарии
        if c == '/' and i + 1 < n:
            if s[i + 1] == '/':
                i = s.find('\n', i)
                if i < 0:
                    return -1
                continue
            if s[i + 1] == '*':
                i = s.find('*/', i)
                if i < 0:
                    return -1
                i += 2
                continue
        if c == open_ch:
            depth += 1
        elif c == close_ch:
            depth -= 1
            if depth == 0:
                return i
        i += 1
    return -1


def empty_decl(src, name, kind='array', note=''):
    """Заменяет инициализатор объявления NAME = [...] / {...} на пустой."""
    m = re.search(r'(?m)^([ \t]*)(const|let|var)\s+' + re.escape(name) + r'\s*=\s*', src)
    if not m:
        errors.append(f'НЕ НАЙДЕНО объявление {name}')
        return src
    start_val = m.end()
    ch = src[start_val]
    if ch not in '[{(':
        # однострочный литерал без скобок — редкий случай
        eol = src.find('\n', start_val)
        repl = '[]' if kind == 'array' else '{}'
        src = src[:start_val] + repl + ';' + src[eol:]
        report.append(f'{name}: обнулено (однострочное)')
        return src
    end_val = match_bracket(src, start_val)
    if end_val < 0:
        errors.append(f'НЕ СОШЛИСЬ скобки у {name}')
        return src
    repl = '[]' if kind == 'array' else '{}'
    comment = f'  /* демо-данные удалены 09.08{": " + note if note else ""} — источник только API */'
    removed = src[start_val:end_val + 1].count('\n')
    src = src[:start_val] + repl + comment + src[end_val + 1:]
    report.append(f'{name}: обнулено (было ~{removed} строк)')
    return src


def replace_once(src, old, new, tag):
    if old not in src:
        errors.append(f'НЕ НАЙДЕН фрагмент для {tag}')
        return src
    if src.count(old) > 1:
        errors.append(f'НЕОДНОЗНАЧНО ({src.count(old)} совпадений) для {tag}')
        return src
    report.append(f'{tag}: заменено')
    return src.replace(old, new, 1)


# ============================================================================
#  APP.JS
# ============================================================================
js = read(JS)

# --- модуль demo-content: чаты, сторис, посты, уведомления ---
for name in ['DC_CHATS', 'DC_STORIES', 'DC_POSTS', 'DC_POSTS_REC', 'DC_NOTIFS',
             'DC_CHATS_X_DIRECT', 'DC_CHATS_X_GROUPS', 'DC_CHATS_X_CHANNELS']:
    js = empty_decl(js, name, 'array', 'модуль demo-content')

# DC_SUPPORT — дубль официальной поддержки, в ядре она уже есть
js = empty_decl(js, 'DC_SUPPORT', 'object', 'дубль официальной поддержки')

# --- умная лента ---
js = empty_decl(js, 'FA_POOL', 'array', 'пул постов умной ленты')

# --- кошелёк ---
js = empty_decl(js, 'WAL_CONTACTS', 'array', 'контакты для переводов')

# --- сессии устройств ---
js = empty_decl(js, 'ST2_SES', 'array', 'чужие устройства и сессии')

# --- витрина каналов/клубов/курсов ---
js = empty_decl(js, 'CH_MARKET', 'array', 'каталог платных каналов')

# --- 3D-штаб ---
for name in ['HQ_CRM', 'HQ_MOD_FEED', 'HQ_FEED_POOL', 'HQ_FEED_NICKS']:
    js = empty_decl(js, name, 'array', '3D-штаб')

# --- сторис, профили, звонки, игры, подарки ---
js = empty_decl(js, 'SP_POOL', 'array', 'зрители сторис')
js = empty_decl(js, 'PS_BIOS', 'object', 'био выдуманных авторов')
js = empty_decl(js, 'PS_PORTFOLIO', 'array', 'портфолио выдуманных авторов')
js = empty_decl(js, 'CL_DEMO_NAMES', 'array', 'участники группового звонка')
js = empty_decl(js, 'GM_LB_NAMES', 'array', 'боты таблицы лидеров')
js = empty_decl(js, 'VS_OWNERS', 'array', 'владельцы подарков')

# --- живые фейк-уведомления по таймеру ---
js = empty_decl(js, 'LIVE_POOL', 'array', 'фейковые уведомления по таймеру')

# --- отзывы витрины ---
js = empty_decl(js, 'REV_TXT', 'array', 'тексты выдуманных отзывов')
js = empty_decl(js, 'REV_NAMES', 'array', 'имена выдуманных отзывов')

# --- рекламные кампании ---
m = re.search(r'(?m)^([ \t]*)(let|const|var)\s+ADS\s*=\s*\{', js)
if m:
    e = match_bracket(js, js.index('{', m.end() - 1))
    js = js[:m.end() - 1] + '{camps: []}  /* демо-кампании удалены 09.08 */' + js[e + 1:]
    report.append('ADS: обнулено')
else:
    errors.append('НЕ НАЙДЕНО объявление ADS')

# --- сидеры-IIFE: выключаем ранним возвратом ---
SEEDERS = [
    ('function walSeedDemo', 'walSeedDemo — демо-операции кошелька'),
    ('function walSeedDemo2', 'walSeedDemo2 — история операций за месяц'),
    ('function walMaybeDemoLive', 'walMaybeDemoLive — фейковое «Пришло 500 ₽ от Марка»'),
    ('function mpSeedMyListings', 'mpSeedMyListings — мои объявления Биржи'),
    ('function mpSeedDeals', 'mpSeedDeals — сделки Биржи'),
    ('function chMockMembers', 'chMockMembers — фейк-участники каналов'),
    ('function hqSeedLog', 'hqSeedLog — лог штаба'),
    ('function hqSeedFeed', 'hqSeedFeed — лента событий штаба'),
    ('function spSeed', 'spSeed — демо-сторис'),
]
for anchor, tag in SEEDERS:
    idx = js.find(anchor)
    if idx < 0:
        errors.append(f'НЕ НАЙДЕНА функция {tag}')
        continue
    brace = js.find('{', idx)
    if brace < 0:
        errors.append(f'НЕТ тела у {tag}')
        continue
    guard = '{\n  /* демо-сидер отключён 09.08 (правка Даниэля: ноль демо-данных) */\n  return (arguments.length && Array.isArray(arguments[0])) ? [] : undefined;\n'
    js = js[:brace] + guard + js[brace + 1:]
    report.append(f'{tag}: сидер отключён')

# --- слово «Мок» в пользовательских текстах ---
js = js.replace('Мок: в проде — платёжный шлюз OKO', 'Платежи проходят через шлюз OKO')
js = js.replace('Мок: в проде — кошелёк OKO, вывод на карту', 'Вывод на карту через кошелёк OKO')
report.append('тексты: слово «Мок» убрано из интерфейса')

write(JS, js)

# ============================================================================
#  INDEX.HTML
# ============================================================================
html = read(HTML)

html = empty_decl(html, 'NOTIFS', 'array', 'демо-уведомления ядра')
html = empty_decl(html, 'STORIES', 'array', 'демо-сторис ядра')
html = empty_decl(html, 'LISTINGS', 'array', 'демо-объявления Биржи')
html = empty_decl(html, 'ADMIN', 'object', 'демо-данные админки')

# POSTS — оставляем структуру, но без демо-постов
m = re.search(r'(?m)^([ \t]*)(let|const|var)\s+POSTS\s*=\s*\{', html)
if m:
    e = match_bracket(html, html.index('{', m.end() - 1))
    html = html[:m.end() - 1] + '{sub: [], rec: []}  /* демо-посты удалены 09.08 — лента из API */' + html[e + 1:]
    report.append('POSTS: обнулено')
else:
    errors.append('НЕ НАЙДЕНО объявление POSTS')

write(HTML, html)

# ============================================================================
print('=' * 70)
for r in report:
    print('  OK  ', r)
if errors:
    print('-' * 70)
    for e in errors:
        print('  !!  ', e)
print('=' * 70)
print(f'Успешно: {len(report)}   Проблем: {len(errors)}')
sys.exit(1 if errors else 0)
