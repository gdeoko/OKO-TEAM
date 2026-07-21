#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
СТАДИЯ 4 (часть A) — QA-ГЕЙТ ГОТОВОГО РОЛИКА перед публикацией.
Проверяет: вертикаль 1080x1920, длительность 12-60с, есть аудиодорожка, обложка,
достаточно уникальных кадров и наложений (динамика/разнообразие), оценка «залёта».

  python qa_check.py reel.mp4 --cover cover.jpg --clips 12 --overlays 9 --score-scenario 88
Код 0 = pass, 1 = fail. Печатает JSON-отчёт (идёт в бота вместе с роликом).
"""
import sys, json, subprocess, os, argparse

def _probe(path):
    r=subprocess.run(["ffprobe","-v","error","-print_format","json","-show_format","-show_streams",path],
        capture_output=True,text=True,timeout=60)
    return json.loads(r.stdout or "{}")

def qa(path, cover, clips, overlays, scen_score):
    issues=[]; score=50
    d=_probe(path)
    vs=[s for s in d.get("streams",[]) if s.get("codec_type")=="video"]
    au=[s for s in d.get("streams",[]) if s.get("codec_type")=="audio"]
    dur=float(d.get("format",{}).get("duration") or 0)
    w=vs[0].get("width") if vs else 0; h=vs[0].get("height") if vs else 0

    if not vs: issues.append("нет видеодорожки"); score-=40
    else:
        if (w,h)!=(1080,1920): issues.append(f"не 1080x1920 ({w}x{h})"); score-=15
        else: score+=10
    if not au: issues.append("НЕТ аудио (озвучка/музыка) — брак"); score-=30
    else: score+=8
    if dur<12: issues.append(f"коротко ({dur:.0f}с) — минимум 12с"); score-=15
    elif dur>60: issues.append(f"длинно ({dur:.0f}с) — до 60с"); score-=8
    else: score+=8
    # динамика: кадр каждые ~3с
    if dur and clips:
        per=dur/clips
        if per>5: issues.append(f"кадры редко (1 за {per:.1f}с) — надо 3-5с, больше уникальных клипов"); score-=10
        elif per<=4: score+=10
    if clips<8: issues.append(f"мало уникальных клипов ({clips}) — надо 10-14"); score-=10
    if overlays< max(3,int(dur/5)): issues.append(f"мало наложений ({overlays}) — по одному каждые 3-5с"); score-=8
    else: score+=8
    if not (cover and os.path.exists(cover)): issues.append("нет обложки cover.jpg"); score-=10
    else: score+=6
    # учёт качества сценария
    if scen_score: score = int(0.6*score + 0.4*scen_score)

    score=max(0,min(100,score))
    verdict = ("🔥 высокий шанс залёта" if score>=80 else
               "✅ норм, можно" if score>=68 else "⚠️ доработать перед публикацией")
    passed = score>=68 and not any(("НЕТ аудио" in i or "нет видеодорожки" in i) for i in issues)
    return {"pass":passed,"score":score,"verdict":verdict,"duration":round(dur,1),
            "res":f"{w}x{h}","clips":clips,"overlays":overlays,"issues":issues}

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("reel"); ap.add_argument("--cover",default=None)
    ap.add_argument("--clips",type=int,default=0); ap.add_argument("--overlays",type=int,default=0)
    ap.add_argument("--score-scenario",type=int,default=0)
    a=ap.parse_args()
    r=qa(a.reel,a.cover,a.clips,a.overlays,a.score_scenario)
    print(json.dumps(r,ensure_ascii=False,indent=2))
    sys.exit(0 if r["pass"] else 1)

if __name__=="__main__": main()
