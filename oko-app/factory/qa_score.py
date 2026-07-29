#!/usr/bin/env python3
# qa_score.py <WORKDIR> <SPEC.json>  — 15-точечная проверка виральности по 100-балльной шкале.
# Оценивает СОБРАННЫЙ ролик (reel.mp4 + meta.json) против спеки и реестров «ноль повторов».
# Публикуем только при total >= GATE (85). Печатает JSON-отчёт и код возврата 0/1.
import json,os,sys,re,subprocess,hashlib
ROOT="/home/user/OKO-TEAM/oko-app/factory"
GATE=85
EMOJI=re.compile("["
  "\U0001F300-\U0001FAFF\U00002600-\U000027BF\U0001F000-\U0001F0FF"
  "\U00002190-\U000021FF\U00002B00-\U00002BFF️‍]",flags=re.UNICODE)

def dur(path):
    try:
        o=subprocess.run(["ffprobe","-v","error","-show_entries","format=duration","-of","csv=p=0",path],
                         capture_output=True,text=True).stdout.strip()
        return float(o)
    except Exception: return 0.0

def load(p,default=None):
    try: return json.load(open(p))
    except Exception: return default

def read(p):
    try: return open(p,encoding="utf-8").read()
    except Exception: return ""

def score(W,SPEC):
    spec=load(SPEC,{}) or {}
    meta=load(os.path.join(W,"meta.json"),{}) or {}
    beats=spec.get("beats",[])
    accents=spec.get("accents",[])
    rp=os.path.join(W,"reel.mp4")
    D=dur(rp)
    desc=(meta.get("yt_desc") or meta.get("caption") or meta.get("description") or meta.get("desc") or "")
    title=(meta.get("title") or "")
    music=spec.get("music","")
    theme=(spec.get("theme") or spec.get("hook") or (beats[0]["title"][0] if beats else "")).strip()
    # ledgers
    used_music=read(os.path.join(ROOT,"USED_MUSIC.md")).lower()
    used_themes=read(os.path.join(ROOT,"USED.md")).lower()
    used_mech=read(os.path.join(ROOT,"USED_MECHANICS.md")).lower()
    R=[]  # (name, got, max, note)
    # 1 hook first beat, punchy (<=7 words in title line)
    hook=beats[0]["title"] if beats else []
    hw=sum(len(l.split()) for l in hook)
    R.append(("1.hook_first",8 if beats and hw<=7 and hook else (4 if beats else 0),8,f"{hw}w"))
    # 2 cover embedded (builder puts cover frame at COVER=0.05 start) + cover.jpg exists
    cov=os.path.exists(os.path.join(W,"cover.jpg"))
    R.append(("2.cover_thumb",6 if cov else 0,6,"cover.jpg" if cov else "no cover"))
    # 3 duration viral range 18-40s
    R.append(("3.duration",7 if 18<=D<=40 else (4 if 14<=D<=48 else 0),7,f"{D:.1f}s"))
    # 4 >=6 distinct coded mechanics
    types=[a.get("type") for a in accents]
    uniq=len(set(types))
    R.append(("4.mechanics_rich",10 if uniq>=6 else round(10*uniq/6),10,f"{uniq} uniq of {len(types)}"))
    # 5 cadence: max gap between overlay events (accents+beats) <=5s
    ev=sorted([a.get("t",0) for a in accents]+[0.0])
    maxgap=0
    if D>0:
        seq=sorted(set([round(x,2) for x in ev]+[D]))
        maxgap=max((seq[i+1]-seq[i]) for i in range(len(seq)-1)) if len(seq)>1 else D
    R.append(("5.cadence",8 if maxgap<=5 else (5 if maxgap<=7 else 2),8,f"maxgap {maxgap:.1f}s"))
    # 6 footage: 12 terms, none MISS (foot_ids.json count vs foot/*.mp4)
    foot=spec.get("footage",[])
    nfoot=len([f for f in os.listdir(os.path.join(W,"foot")) if f.endswith(".mp4")]) if os.path.isdir(os.path.join(W,"foot")) else 0
    R.append(("6.footage",6 if nfoot>=10 else round(6*nfoot/10),6,f"{nfoot} clips"))
    # 7 music zero-repeat
    mk=os.path.basename(str(music)).lower()
    R.append(("7.music_fresh",7 if mk and mk not in used_music else 0,7,mk or "none"))
    # 8 mechanic-combo zero-repeat (sorted type set signature)
    sig=",".join(sorted(set(types)))
    sighash=hashlib.md5(sig.encode()).hexdigest()[:10]
    R.append(("8.combo_fresh",7 if sig and sighash not in used_mech else 0,7,sighash))
    # 9 theme/hook zero-repeat
    th=theme.lower()[:40]
    R.append(("9.theme_fresh",6 if th and th not in used_themes else 0,6,th[:24]))
    # 10 description 15-30 search phrases (comma/newline separated tail)
    phrases=[p for p in re.split(r"[,\n;]", desc) if 2<=len(p.strip().split())<=8]
    R.append(("10.search_phrases",7 if 15<=len(phrases)<=40 else round(7*min(len(phrases),15)/15),7,f"{len(phrases)} phr"))
    # 11 site + city CTA
    site="dieselcompany.pro" in desc.lower()
    cta=bool(re.search(r"город|напиш|в личк|whatsapp|телеграм|пишите",desc.lower()))
    R.append(("11.funnel",5 if site and cta else (3 if site else 0),5,("site+cta" if site and cta else ("site" if site else "no"))))
    # 12 no emoji in meta (brand rule)
    em=bool(EMOJI.search(title+" "+desc))
    R.append(("12.no_emoji",5 if not em else 0,5,"clean" if not em else "EMOJI!"))
    # 13 brand palette (accents built => amber overlays present)
    acc_mov=os.path.exists(os.path.join(W,"ig","accents.mov"))
    R.append(("13.brand_overlays",4 if acc_mov else 0,4,"accents.mov" if acc_mov else "none"))
    # 14 format bucket assigned
    bucket=(spec.get("bucket") or "").lower()
    R.append(("14.bucket",5 if bucket in("viral","useful","sales") else 0,5,bucket or "unset"))
    # 15 title clean cyrillic <=100 chars, no escape gibberish
    ok_title=bool(title) and len(title)<=100 and "\\u" not in title and not re.search(r"[Ð-ÿ]{3,}",title)
    R.append(("15.title_clean",5 if ok_title else 0,5,f"{len(title)}c"))
    total=sum(g for _,g,_,_ in R)
    return total,R,{"dur":D,"music":mk,"combo":sighash,"theme":th,"uniq_mech":uniq}

if __name__=="__main__":
    W,SPEC=sys.argv[1],sys.argv[2]
    total,R,info=score(W,SPEC)
    print(f"QA SCORE: {total}/100   GATE {GATE}   {'PASS ✔' if total>=GATE else 'FAIL �’'}")
    for name,g,m,note in R:
        bar="●"*g+"·"*(m-g)
        print(f"  {name:<20} {g:>2}/{m:<2} {bar:<12} {note}")
    print("INFO",json.dumps(info,ensure_ascii=False))
    out={"total":total,"gate":GATE,"pass":total>=GATE,"points":{n:{"got":g,"max":m,"note":x} for n,g,m,x in R},"info":info}
    json.dump(out,open(os.path.join(W,"qa_report.json"),"w"),ensure_ascii=False,indent=1)
    sys.exit(0 if total>=GATE else 1)
