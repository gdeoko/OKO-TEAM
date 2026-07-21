#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
QC-ГЕЙТ перед публикацией: проверяет собранный ролик на красоту/динамику/разнообразие
и оценивает потенциал «залёта». Печатает одну строку: QC <PASS|WEAK> score=<0-100> ...
- длина 20-45с; кадров >=10; наложений >=6; virality-скор из script_polish;
- дедуп: наложения не повторяют набор прошлого ролика того же app (по ov_fp в gen_state).
Не роняет прогон (auto_run сам решает); даёт число для отчёта в бота.

Использование: python3 qc.py <id>
"""
import json, os, subprocess, sys
HERE = os.path.dirname(os.path.abspath(__file__))

def dur(mp4):
    try:
        return float(subprocess.run(["ffprobe","-v","error","-show_entries","format=duration",
                "-of","csv=p=0",mp4], capture_output=True, text=True, timeout=30).stdout.strip())
    except Exception: return 0.0

def main():
    ID = sys.argv[1]
    mp4 = os.path.join(HERE,"output",f"{ID}.mp4")
    S = os.path.join(HERE,"scripts",f"{ID}.json")
    if not os.path.exists(mp4) or not os.path.exists(S):
        print("QC WEAK score=0 (нет файла)"); return
    d = json.load(open(S))
    D = dur(mp4)
    nsh = len(d.get("shots",[])); nov = len(d.get("overlays",[]))
    vir = d.get("virality",{}).get("score", 50)
    types = sorted(o.get("type") for o in d.get("overlays",[]))
    reasons = []
    score = int(vir)
    if 20 <= D <= 45: score += 8
    else: reasons.append(f"len={D:.0f}s")
    if nsh >= 10: score += 6
    else: reasons.append(f"shots={nsh}")
    if nov >= 6: score += 6
    else: reasons.append(f"overlays={nov}")
    if len(set(types)) >= 5: score += 6
    else: reasons.append("overlay-variety")
    # дедуп набора наложений vs прошлые (ov_fp в gen_state)
    try:
        gs = json.load(open(os.path.join(HERE,"gen_state.json")))
        fp = "|".join(types); app = d.get("app","")
        prev = gs.get("ov_fp",{}).get(app,[])
        if fp in prev[:-1]: reasons.append("overlay-set-repeat")
        else: score += 4
    except Exception: pass
    score = max(0, min(100, score))
    verdict = "PASS" if (20 <= D <= 47 and nsh >= 10 and nov >= 6 and score >= 55) else "WEAK"
    print(f"QC {verdict} score={score} len={D:.0f}s shots={nsh} ovl={nov} types={len(set(types))} {' '.join(reasons)}")

if __name__ == "__main__":
    try: main()
    except Exception as e:
        print("QC WEAK score=0 error:", str(e)[:120])
