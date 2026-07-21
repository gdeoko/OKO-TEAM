#!/usr/bin/env python3
# Рамп-квота роликов/день + дневное состояние. Управляет, сколько роликов собрать сегодня.
# Рамп: 17-21 июля = 3/день; далее +1 каждые 2 дня, потолок 15 -> ~500 к 31 августа.
# Использование:
#   python3 quota.py check   -> печатает СКОЛЬКО ЕЩЁ надо собрать сегодня (0 = хватит)
#   python3 quota.py inc      -> +1 к сегодняшнему счётчику
#   python3 quota.py status   -> квота/сделано/осталось
import json, sys, os
from datetime import date
STATE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "daily_state.json")
START = date(2026, 7, 17)

def _perf_cap():
    """Адаптив: если аналитика зафиксировала просадку (perf_flag.json cap) — режем до неё."""
    try:
        p = os.path.join(os.path.dirname(os.path.abspath(__file__)), "analysis", "perf_flag.json")
        f = json.load(open(p))
        if f.get("cap") and str(f.get("until","")) >= date.today().isoformat():
            return int(f["cap"])
    except Exception:
        pass
    return None

def quota_for(d):
    n = (d - START).days
    if n < 0: return 0
    if n < 5: return 3               # 17-21 июля: 3/день (пройдено)
    # с 22 июля: базово 5/день, +1 каждые 2 дня, постепенно до 15
    q = min(15, max(5, 5 + (n - 5) // 2))
    cap = _perf_cap()                # просадка просмотров → откат к 5 (потом снова вверх)
    if cap is not None:
        q = min(q, cap)
    return q

def load():
    try: return json.load(open(STATE))
    except Exception: return {}

def today_state():
    t = date.today().isoformat()
    s = load()
    if s.get("date") != t:
        s = {"date": t, "count": 0}
        json.dump(s, open(STATE, "w"))
    return s

def main():
    cmd = sys.argv[1] if len(sys.argv) > 1 else "status"
    s = today_state(); q = quota_for(date.today())
    if cmd == "inc":
        s["count"] = s.get("count", 0) + 1; json.dump(s, open(STATE, "w"))
        print(s["count"])
    elif cmd == "check":
        print(max(0, q - s.get("count", 0)))
    else:
        print(f"date={s['date']} quota={q} done={s.get('count',0)} remaining={max(0,q-s.get('count',0))}")

main()
