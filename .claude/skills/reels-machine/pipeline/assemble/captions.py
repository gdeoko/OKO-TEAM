#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Субтитры-караоке V.CODE по СТАНДАРТУ (build_video.py/n15): Союз Гротекс, БЕЗ обводки,
фиксированная позиция, ПО 2 СЛОВА, \\k по словам — активное/спетое слово оранж #EA5920, остальные белые.
Текст берётся из СЦЕНАРИЯ (не ASR), тайминги — из words.json (список [{w,t,d}] на финальном 1.8x аудио).

  build_ass(segments_words, out_ass)  segments_words = [[{w,t,d},...], ...] по сегментам, t абсолютное
  или CLI: python captions.py words.json out.ass
"""
import sys, json
FONT="Soyuz Grotesk"; SIZE=94; ACTIVE="&H002059EA&"; REST="&H00FFFFFF"; POSY=1560  # фикс низ

HEAD=f"""[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
WrapStyle: 2

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Sub,{FONT},{SIZE},{ACTIVE},{REST},&H00000000,&H00000000,-1,0,0,0,100,100,1,0,1,0,0,4,5,60,60,0,204

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""

def fmt(t):
    h=int(t//3600); m=int((t%3600)//60); s=t%60; return f"{h}:{m:02d}:{s:05.2f}"

def build_ass(words, out_ass):
    """words = плоский список [{w,t,d}] (t абсолютное). Группируем по 2 слова, фикс \\pos(540,POSY)."""
    ev=[]; groups=[]; i=0
    while i<len(words):
        groups.append(words[i:i+2]); i+=2
    for gi,grp in enumerate(groups):
        st=grp[0]["t"]
        nat=grp[-1]["t"]+grp[-1]["d"]+0.10
        nxt_start=groups[gi+1][0]["t"] if gi+1<len(groups) else nat
        en=min(nat, nxt_start-0.02)                      # НЕ накладывать на следующую пару
        if en<=st: en=st+0.25
        parts=[]
        for j,w in enumerate(grp):
            nw=grp[j+1]["t"] if j+1<len(grp) else min(en, w["t"]+w["d"])
            k=max(6,int(round((nw-w["t"])*100)))
            parts.append(r"{\k"+str(k)+"}"+w["w"].upper().strip(".,!?»«"))
        ev.append(f"Dialogue: 0,{fmt(st)},{fmt(en)},Sub,,0,0,0,,{{\\an5\\pos(540,{POSY})\\fad(50,40)}}{' '.join(parts)}")
    open(out_ass,"w",encoding="utf-8").write(HEAD+"\n".join(ev)+"\n")
    return out_ass

if __name__=="__main__":
    w=json.load(open(sys.argv[1])); build_ass(w, sys.argv[2]); print("ASS:",sys.argv[2])
