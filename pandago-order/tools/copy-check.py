# PandaGo · Проверка правил текста перед каждым коммитом
# Запуск из каталога сайта:  python3 tools/copy-check.py
# Правила: без длинных и средних тире, без "не X, а Y", без дефиса-связки
# "слово - слово", без эмодзи, без обращения на "ты" в HTML-контенте.

import re
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EXTS = ('.html', '.js', '.css', '.php', '.txt', '.json')
SKIP_DIRS = {'logs', 'tools', '.git', 'node_modules'}

issues = 0
for root, dirs, files in os.walk(ROOT):
    dirs[:] = [d for d in dirs if d not in SKIP_DIRS]
    for f in files:
        if not f.endswith(EXTS):
            continue
        p = os.path.join(root, f)
        rel = os.path.relpath(p, ROOT)
        s = open(p, encoding='utf-8', errors='ignore').read()

        for ch, name in [('—', 'em-dash'), ('–', 'en-dash')]:
            if ch in s:
                print(f'  {rel}: {name} x {s.count(ch)}')
                issues += s.count(ch)

        m = re.findall(r'\bне\s+[^.<>\n]{2,60}?,\s*а\s+', s, re.I)
        if m:
            print(f'  {rel}: "не X, а Y" x {len(m)}: {m[:2]}')
            issues += len(m)

        text = re.sub(r'<script.*?</script>|<style.*?</style>', '', s, flags=re.S)
        text = re.sub(r'<[^>]+>', ' ', text)
        m = re.findall(r'[а-яёА-ЯЁ]+\s-\s[а-яёА-ЯЁ]+', text)
        if m:
            print(f'  {rel}: word-hyphen-word x {len(m)}: {m[:3]}')
            issues += len(m)

        em = re.findall(
            r'[\U0001F300-\U0001F9FF\U0001FA00-\U0001FAFF☀-➿]', s)
        if em:
            print(f'  {rel}: emoji x {len(em)}: {em[:5]}')
            issues += len(em)

        if p.endswith('.html'):
            t = re.sub(r'<script.*?</script>|<style.*?</style>', '', s, flags=re.S)
            t = re.sub(r'<[^>]+>', ' ', t)
            m = re.findall(
                r'\bты\b|\bтебе\b|\bтебя\b|\bтвой\b|\bтвоя\b|\bтвоё\b|\bтвои\b',
                t, re.I)
            if m:
                print(f'  {rel}: informal "ty" x {len(m)}')
                issues += len(m)

if issues == 0:
    print('OK: 0 rule violations')
    sys.exit(0)
print(f'FAIL: {issues} violations, fix before commit')
sys.exit(1)
