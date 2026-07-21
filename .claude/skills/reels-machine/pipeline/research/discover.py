#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
СТАДИЯ 1 (часть A) — поиск конкурентов/роликов в нише + метрики + скачивание + раскадровка.
Без платных ключей: yt-dlp (поиск/метрики/скачивание YouTube), ffmpeg (кадры), whisper (текст).
Дедуп по реестру, чтобы КАЖДЫЙ раз были РАЗНЫЕ.

  python discover.py "ниша ключевые слова" --n 5 --min-views 1000000 --outdir /tmp/research
Выдаёт: research.json (кандидаты с метриками + пути к кадрам/транскриптам) для анализа.
"""
import os, sys, json, subprocess, argparse, glob, re

REG = os.path.join(os.path.dirname(__file__), "USED_COMPETITORS.md")

def _used_ids():
    if not os.path.exists(REG): return set()
    return set(re.findall(r"\b([A-Za-z0-9_-]{11})\b", open(REG).read()))

def _mark_used(ids):
    with open(REG, "a") as f:
        for i in ids: f.write(f"- {i}\n")

SP_SHORT = "EgIYAQ%253D%253D"  # YouTube-фильтр "< 4 минут" — surface коротких роликов

def search(queries, n, min_views, exclude):
    """Поиск Shorts/reels: YouTube URL с фильтром <4мин + match-filter duration<=180,
    вывод через --print (надёжно). Отбор 1М+, дедуп, сортировка по просмотрам."""
    import urllib.parse
    seen=set(exclude); cand=[]
    for q in queries:
        url=f"https://www.youtube.com/results?search_query={urllib.parse.quote_plus(q)}&sp={SP_SHORT}"
        try:
            r=subprocess.run(["yt-dlp","--no-warnings","--match-filter","duration<=180",
                "--playlist-items","1-40","--print","%(duration)s|%(view_count)s|%(id)s|%(channel)s|%(title)s",url],
                capture_output=True,text=True,timeout=240)
        except Exception as e:
            sys.stderr.write(f"[search fail {q}: {e}]\n"); continue
        for line in (r.stdout or "").splitlines():
            parts=line.split("|",4)
            if len(parts)<5: continue
            du,vc,vid,ch,title=parts
            try: du=int(float(du)); vc=int(float(vc))
            except: continue
            if not vid or vid in seen or vc<min_views or du>180: continue
            seen.add(vid); cand.append({"id":vid,"title":title,"views":vc,"duration":du,
                "channel":ch,"url":f"https://youtube.com/watch?v={vid}"})
    cand.sort(key=lambda x:x["views"], reverse=True)
    sys.stderr.write(f"[Shorts-кандидатов ≥{min_views}: {len(cand)}]\n")
    return cand[:n]

def enrich(item, outdir):
    """Полные метрики + скачивание + раскадровка + транскрипт."""
    vid=item["id"]; base=os.path.join(outdir,vid); os.makedirs(base,exist_ok=True)
    # метрики
    try:
        r=subprocess.run(["yt-dlp","--no-warnings","-J",item["url"]],capture_output=True,text=True,timeout=120)
        m=json.loads(r.stdout or "{}")
        item.update(views=m.get("view_count",item["views"]), likes=m.get("like_count"),
            comments=m.get("comment_count"), duration=m.get("duration"),
            channel=m.get("channel"), followers=m.get("channel_follower_count"),
            description=(m.get("description") or "")[:1200], upload=m.get("upload_date"),
            tags=(m.get("tags") or [])[:15])
    except Exception as e: sys.stderr.write(f"[meta {vid}: {e}]\n")
    # скачать (<=1080, коротко)
    mp4=os.path.join(base,"v.mp4")
    try:
        subprocess.run(["yt-dlp","--no-warnings","-f","mp4[height<=1080]/best[height<=1080]/best",
            "-o",mp4,item["url"]],capture_output=True,text=True,timeout=240)
    except Exception as e: sys.stderr.write(f"[dl {vid}: {e}]\n")
    real=glob.glob(os.path.join(base,"v.*"))
    src=real[0] if real else None
    if src and os.path.exists(src):
        # раскадровка: сетка кадров каждые ~1.5с
        grid=os.path.join(base,"storyboard.jpg")
        du=item.get("duration") or 30
        cols=5; rows=max(2,min(8,int((du/2.0)//cols)+1)); step=max(0.8, du/(cols*rows))
        subprocess.run(["ffmpeg","-y","-v","error","-i",src,"-vf",
            f"fps=1/{step:.2f},scale=240:-1,tile={cols}x{rows}","-frames:v","1",grid],capture_output=True,timeout=120)
        item["storyboard"]=grid if os.path.exists(grid) else None
        # аудио→транскрипт
        wav=os.path.join(base,"a.wav")
        subprocess.run(["ffmpeg","-y","-v","error","-i",src,"-ac","1","-ar","16000",wav],capture_output=True,timeout=120)
        try:
            from faster_whisper import WhisperModel
            wm=WhisperModel("small",device="cpu",compute_type="int8")
            segs,_=wm.transcribe(wav,vad_filter=True)
            item["transcript"]=" ".join(s.text.strip() for s in segs)[:2500]
        except Exception as e: item["transcript"]=f"[whisper fail: {e}]"
    return item

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("niche"); ap.add_argument("--n",type=int,default=5)
    ap.add_argument("--min-views",type=int,default=1000000)
    ap.add_argument("--outdir",default="/tmp/research")
    ap.add_argument("--queries",default=None,help="через | несколько запросов")
    a=ap.parse_args()
    os.makedirs(a.outdir,exist_ok=True)
    queries=a.queries.split("|") if a.queries else [a.niche, a.niche+" shorts", a.niche+" reels"]
    exclude=_used_ids()
    cands=search(queries, a.n, a.min_views, exclude)
    sys.stderr.write(f"[найдено {len(cands)} кандидатов ≥{a.min_views} просмотров, исключено {len(exclude)} прошлых]\n")
    enriched=[enrich(c,a.outdir) for c in cands]
    _mark_used([c["id"] for c in enriched])
    json.dump(enriched, open(os.path.join(a.outdir,"research.json"),"w"), ensure_ascii=False, indent=2)
    print(os.path.join(a.outdir,"research.json"))

if __name__=="__main__": main()
