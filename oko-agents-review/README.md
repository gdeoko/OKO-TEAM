# oko-agents-review

Разбор материалов OKO (сессия «feedback / что дальше», 09.07.2026) и первые
рабочие артефакты. Начни с **REVIEW.md**.

```
REVIEW.md                     — аудит: статус, риски, что дальше (читать первым)
CONSOLIDATION.md              — свести 3 трека (сайт / агенты / приложение) в одну БД
security-patch/SECURITY_FIX.md— 🔴 точечные правки безопасности okoteam.top (сегодня)
wave1/filter_prefilter.py     — рабочий пред-фильтр вакансий (Волна 1)
wave1/test_filter_prefilter.py— 8 тестов, все зелёные
```

Проверить фильтр:
```bash
python oko-agents-review/wave1/filter_prefilter.py          # демо
python -m pytest oko-agents-review/wave1/ -q                # тесты (8 passed)
```

Это разбор и заготовки, а не деплой. Правки сайта требуют доступа к хостингу
okoteam.top; прогон агентов — Pyrogram-сессий и ключей в env.
