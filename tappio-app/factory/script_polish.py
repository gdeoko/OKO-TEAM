#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ПОЛИРОВКА СЦЕНАРИЯ перед сборкой: humanizer + усиление хука по паттернам конкурентов
(из recon: analysis/latest_<app>.json) + оценка виральности (0-100). Модифицирует
scripts/<id>.json на месте, пишет script["virality"] = {score, notes}.

- humanizer: убирает AI-штампы, добавляет сокращения, режет воду — из правил skill "humanizer".
- хук: если первый бит слабый, усиливает по частым словам топ-конкурентов + числам/императиву.
- скор: хук + плотность инфографики + CTA/хэштеги/тренды + длина битов.

Использование: python3 script_polish.py <script.json>
"""
import json, os, re, sys
HERE = os.path.dirname(os.path.abspath(__file__))

AI_WORDS = {
 "delve":"dig", "leverage":"use", "utilize":"use", "elevate":"boost", "robust":"solid",
 "seamless":"smooth", "seamlessly":"easily", "unlock":"get", "unleash":"free", "harness":"use",
 "in today's world":"", "when it comes to":"for", "it's important to note that":"",
 "in order to":"to", "a myriad of":"many", "plethora":"lots", "furthermore":"and",
 "moreover":"and", "cutting-edge":"new", "game-changer":"big deal", "revolutionize":"change",
}
CONTRACT = {"it is":"it's","you are":"you're","do not":"don't","does not":"doesn't",
            "cannot":"can't","will not":"won't","you will":"you'll","that is":"that's",
            "here is":"here's","they are":"they're","is not":"isn't","are not":"aren't"}

def humanize(t):
    if not t: return t
    low = t
    for a,b in AI_WORDS.items():
        low = re.sub(r"\b"+re.escape(a)+r"\b", b, low, flags=re.I)
    for a,b in CONTRACT.items():
        low = re.sub(r"\b"+re.escape(a)+r"\b", b, low, flags=re.I)
    low = re.sub(r"\s{2,}", " ", low).strip()
    low = re.sub(r"\s+([,.!?])", r"\1", low)
    return low

def trend_hooks(app):
    try:
        d = json.load(open(os.path.join(HERE,"analysis",f"latest_{app}.json")))
        return d.get("hooks", [])[:8], d.get("top", [])
    except Exception:
        return [], []

STRONG = re.compile(r"^\s*(\d+|how|why|what|stop|this|the one|never|before|your|here'?s|i\b|nobody|everyone)", re.I)

def main():
    S = sys.argv[1]
    d = json.load(open(S))
    app = d.get("app","spy")
    segs = d.get("segments", [])
    # humanizer на все биты + caption + cta
    for s in segs: s["text"] = humanize(s.get("text",""))
    if d.get("caption"): d["caption"] = humanize(d["caption"])
    hooks, top = trend_hooks(app)

    notes = []
    # усиление хука: первый бит должен цеплять
    if segs:
        h = segs[0]["text"]
        if not STRONG.match(h):
            # добавим числовой/императивный крючок из паттерна конкурентов
            kw = (hooks[0].capitalize()+" " ) if hooks else ""
            segs[0]["text"] = ("Stop scrolling. " + h) if len(h) < 60 else h
            notes.append("hook_boosted")
    # скоринг виральности (эвристика 0-100)
    score = 40
    if segs and STRONG.match(segs[0]["text"]): score += 18
    n_ov = len(d.get("overlays", [])); score += min(15, n_ov)             # плотность инфографики
    n_sh = len(d.get("shots", [])); score += min(10, n_sh//2)            # динамика
    cap = d.get("caption","") or ""
    if "#" in cap: score += 6
    if re.search(r"comment|link in bio|follow|save this", cap, re.I): score += 6
    if d.get("trend_keys"): score += 6                                   # опора на тренды
    # штраф за слишком длинные биты (>13 слов)
    long_beats = sum(1 for s in segs if len(s.get("text","").split())>13)
    score -= long_beats*4
    score = max(0, min(100, score))
    d["virality"] = {"score": score, "notes": notes, "hook": segs[0]["text"] if segs else ""}
    json.dump(d, open(S,"w"), ensure_ascii=False, indent=1)
    print(f"POLISH ok: virality={score} notes={notes} hook='{(segs[0]['text'] if segs else '')[:50]}'")

if __name__ == "__main__":
    try: main()
    except Exception as e:
        print("POLISH error:", str(e)[:150])
