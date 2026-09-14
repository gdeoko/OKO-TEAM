"""Снимаем по каждому найденному каналу: подписчиков и топ роликов с просмотрами."""
import json, sys, time
from concurrent.futures import ThreadPoolExecutor, as_completed
sys.path.insert(0, "/home/user/oko-agents")
from core import competitor_research as cr

БАЗА = "/tmp/claude-0/-home-user-oko-agents/33fe8496-acfc-5a27-9b2b-b2000b0ee729/scratchpad"
хендлы = json.load(open(f"{БАЗА}/handles.json"))
ключи = list(хендлы)
print("каналов к съёму:", len(ключи), flush=True)

итог = {}


def снять(h):
    try:
        d = cr.channel(h, limit=12)
        d["queries"] = хендлы[h]
        return h, d
    except Exception as e:
        return h, {"handle": h, "ok": False, "subs": 0, "videos": [], "err": str(e)}


with ThreadPoolExecutor(max_workers=8) as ex:
    futs = [ex.submit(снять, h) for h in ключи]
    for i, f in enumerate(as_completed(futs), 1):
        h, d = f.result()
        итог[h] = d
        if i % 50 == 0:
            print(f"{i}/{len(ключи)}", flush=True)
            json.dump(итог, open(f"{БАЗА}/scan.json", "w"), ensure_ascii=False)

json.dump(итог, open(f"{БАЗА}/scan.json", "w"), ensure_ascii=False)
годные = [d for d in итог.values()
          if d.get("subs", 0) >= 100_000
          and len([v for v in d.get("videos", []) if v["views"] >= 1_000_000]) >= 2]
print("прошли фильтр 100k+ и 2 ролика от 1 млн:", len(годные), flush=True)
print("из них от 1 млн подписчиков:", len([d for d in годные if d["subs"] >= 1_000_000]), flush=True)
