#!/usr/bin/env python3
# Рамп-квота роликов/день + дневное состояние. Управляет, сколько роликов собрать сегодня.
# Рамп: 17-21 июля = 3/день; далее +1 каждые 2 дня, потолок 15 -> ~500 к 31 августа.
# Использование:
#   python3 quota.py check   -> печатает СКОЛЬКО ЕЩЁ надо собрать сегодня (0 = хватит)
#   python3 quota.py inc      -> +1 к сегодняшнему счётчику
#   python3 quota.py status   -> квота/сделано/осталось
import json, sys, os, math, time
from datetime import date, datetime
STATE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "daily_state.json")
START = date(2026, 7, 17)
# Окно постинга (UTC): 04:00–23:00 UTC = 07:00–02:00 МСК (широкое, чтобы уместить ролики с паузой ≥1.5ч).
WSTART_H, WEND_H = 4, 23
MIN_GAP_S = 5400   # ЖЁСТКИЙ минимум между роликами — 1.5 часа

def due_by_now():
    """Сколько роликов ДОЛЖНО быть готово к текущему моменту (равномерно по окну дня)."""
    q = quota_for(date.today())
    now = datetime.utcnow(); h = now.hour + now.minute/60.0
    if h <= WSTART_H: return 0
    if h >= WEND_H: return q
    return min(q, math.ceil(q * (h - WSTART_H) / (WEND_H - WSTART_H)))

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
        s["count"] = s.get("count", 0) + 1
        s["last_ts"] = time.time()          # метка времени сборки — для минимального промежутка 1.5ч
        json.dump(s, open(STATE, "w"))
        print(s["count"])
    elif cmd == "check":
        print(max(0, q - s.get("count", 0)))
    elif cmd == "slot":
        # можно ли собрать ПРЯМО СЕЙЧАС: есть остаток + подошёл слот по дню + прошло ≥1.5ч с прошлой сборки
        remaining = q - s.get("count", 0)
        gap_ok = (time.time() - s.get("last_ts", 0)) >= MIN_GAP_S
        paced = s.get("count", 0) < due_by_now()
        print(1 if (remaining > 0 and gap_ok and paced) else 0)
    elif cmd == "gap":
        left = max(0, MIN_GAP_S - (time.time() - s.get("last_ts", 0)))
        print(int(left))
    else:
        gapmin = max(0, MIN_GAP_S - (time.time() - s.get("last_ts", 0)))/60
        print(f"date={s['date']} quota={q} done={s.get('count',0)} remaining={max(0,q-s.get('count',0))} due_by_now={due_by_now()} до_след_слота={gapmin:.0f}мин")

main()
