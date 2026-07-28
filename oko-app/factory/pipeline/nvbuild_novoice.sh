#!/bin/bash
# NO-VOICE reel builder (Библия §6). Full from-scratch. Usage: nvbuild.sh <WORKDIR> <SPEC.json>
ROOT=/home/user/OKO-TEAM/oko-app/factory
TPL=/tmp/claude-0/-home-user-OKO-TEAM/f1a565bc-8f30-56e2-87d2-1ade6002be0e/scratchpad/reel45
W="$1"; SPEC="$2"
export FACTORY_ROOT=$ROOT FACTORY_FONTS=$ROOT/fonts FACTORY_LOGO=$ROOT/logo_hd.png
export NODE_PATH=/opt/node22/lib/node_modules REEL_W=$W
set +e; source <(base64 -d /home/user/OKO-TEAM/secrets.env.b64) 2>/dev/null; set -e

rm -rf "$W"; mkdir -p "$W"/{vo,foot,ig/html,segs,cover_cand,fr_titles}
# current pipeline (has COVER=0.05, iconrow fix); no-voice compose (titles-only) from template
cp $ROOT/pipeline/plan.py $ROOT/pipeline/assemble.py $ROOT/pipeline/audio.py \
   $ROOT/pipeline/build_titles.py $ROOT/pipeline/pick_music.py $ROOT/pipeline/capture.js \
   $ROOT/pipeline/ru_stress_dict.py "$W"/
cp $ROOT/pipeline/compose_novoice.py "$W"/compose.py   # titles-only compose (repo, durable)
cp -r $ROOT/pipeline/html/* "$W"/ig/html/ 2>/dev/null || true
cp -r $ROOT/pipeline/sfx "$W"/sfx 2>/dev/null || true
cp $ROOT/pipeline/endcard.mp4 "$W"/endcard.mp4

# ---- content from spec ----
python3 - "$SPEC" "$W" <<'PY'
import json,sys,subprocess,os
spec=json.load(open(sys.argv[1])); W=sys.argv[2]
beats=spec["beats"]  # list of 6: {vo, title:[l1,l2], y}
src={f"s{i+1}":b["vo"] for i,b in enumerate(beats)}
json.dump(src,open(W+"/script_src.json","w"),ensure_ascii=False,indent=1)
json.dump(src,open(W+"/vo/script_src.json","w"),ensure_ascii=False,indent=1)
# silent VO: duration tuned so kinetic title is readable
for i,b in enumerate(beats):
    ch=len(b["vo"]); dur=round(min(4.9,max(3.0,1.2+0.085*ch)),3)
    subprocess.run(["ffmpeg","-y","-f","lavfi","-i","anullsrc=r=44100:cl=mono",
                    "-t",f"{dur}","-q:a","9","-c:a","libmp3lame",f"{W}/vo/s{i+1}.mp3"],
                   capture_output=True)
print("silent VO ok")
PY

# ---- footage: fetch 12 vertical clips from Pexels by meaning (dedup within reel; curl=proxy-aware) ----
python3 - "$SPEC" "$W" <<'PY'
import json,sys,os,subprocess,urllib.parse
spec=json.load(open(sys.argv[1])); W=sys.argv[2]
KEY=os.environ["PEXELS_API_KEY"]; terms=spec["footage"]
def search(q,page):
    u="https://api.pexels.com/videos/search?"+urllib.parse.urlencode(
        {"query":q,"orientation":"portrait","size":"medium","per_page":15,"page":page})
    r=subprocess.run(["curl","-s","--max-time","30","-H",f"Authorization: {KEY}",u],
                     capture_output=True,text=True)
    try: return json.loads(r.stdout).get("videos",[])
    except Exception: return []
def dl(url,dst):
    subprocess.run(["curl","-s","--max-time","120","-o",dst,url],check=False)
    return os.path.exists(dst) and os.path.getsize(dst)>50000
used=set()
for i,q in enumerate(terms):
    tag=f"b{i+1:02d}"; got=None
    for page in (1,2,3,4):
        for v in search(q,page):
            if v["id"] in used: continue
            files=[f for f in v["video_files"] if f.get("height") and f.get("width")]
            vert=[f for f in files if f["height"]>=f["width"] and f["height"]>=960]
            pool=vert or [f for f in files if f["height"]>=960] or files
            if not pool: continue
            f=sorted(pool,key=lambda x:abs(x["height"]-1920))[0]
            if dl(f["link"],f"{W}/foot/{tag}.mp4"): used.add(v["id"]); got=v["id"]; break
        if got: break
    if not got: print("MISS",tag,q); continue
    if i==6:
        os.system(f"ffmpeg -y -loglevel error -i {W}/foot/b07.mp4 -vf 'scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920' -frames:v 1 {W}/cover_cand/b07.jpg")
    print(tag,"ok",got,q)
json.dump({f"b{i+1:02d}":q for i,q in enumerate(terms)},open(W+"/foot_ids.json","w"),ensure_ascii=False)
PY

python3 "$W/plan.py" | tail -1

# ---- kinetic TITLES from spec, timed to fresh timing.json ----
python3 - "$SPEC" "$W" <<'PY'
import json,sys,re
spec=json.load(open(sys.argv[1])); W=sys.argv[2]
T=json.load(open(W+"/timing.json")); ss=T["seg_start"]; sd=T["segdurs"]
beats=spec["beats"]; out=[]
order=["s1","s2","s3","s4","s5","s6"]
for i,b in enumerate(beats):
    s=order[i]; start=round(ss[s]+0.15,2); end=round(ss[s]+sd[s]+0.10,2)
    out.append({"lines":[x.upper() for x in b["title"]],"accent":b.get("accent",1),
                "start":start,"end":end,"y":b.get("y",760)})
# rewrite TITLES=[...] block in build_titles.py
p=W+"/build_titles.py"; txt=open(p).read()
new="TITLES=[\n"+"".join(" "+json.dumps(o,ensure_ascii=False)+",\n" for o in out)+"]"
txt=re.sub(r"TITLES=\[.*?\n\]", new, txt, count=1, flags=re.S)
open(p,"w").write(txt)
print("titles",len(out),"first",out[0]["start"],"last",out[-1]["end"])
PY
python3 "$W/build_titles.py" >/dev/null 2>&1 || python3 "$W/build_titles.py"

# ---- cover (env-driven title) ----
python3 - "$SPEC" "$W" <<'PY'
import os,json,sys
spec=json.load(open(sys.argv[1])); W=sys.argv[2]; c=spec["cover"]
from PIL import Image, ImageDraw, ImageFont, ImageEnhance
D=os.environ["FACTORY_ROOT"]; F=os.environ["FACTORY_FONTS"]
AMBER=(234,89,32); AMBER2=(255,138,72); WHITE=(246,244,241); INK=(12,10,8)
m9=lambda s: ImageFont.truetype(F+"/montserrat-v31-cyrillic_latin-900.ttf",s)
m7=lambda s: ImageFont.truetype(F+"/montserrat-v31-cyrillic_latin-700.ttf",s)
man=lambda s: ImageFont.truetype(F+"/manrope-v20-cyrillic_latin-800.ttf",s)
bg=Image.open(W+"/cover_cand/b07.jpg").convert("RGB").resize((1080,1920),Image.LANCZOS)
bg=ImageEnhance.Contrast(bg).enhance(1.12); bg=ImageEnhance.Color(bg).enhance(1.15)
scrim=Image.new("L",(1080,1920),0); sd=ImageDraw.Draw(scrim)
for y in range(1920):
    a=0
    if y>700: a=int(min(238,(y-700)/(1920-700)*255))
    if y<360: a=max(a,int((360-y)/360*130))
    sd.line([(0,y),(1080,y)],fill=a)
bg=Image.composite(Image.new("RGB",(1080,1920),(6,6,9)),bg,scrim)
d=ImageDraw.Draw(bg)
logo=Image.open(os.environ["FACTORY_LOGO"]).convert("RGBA").resize((120,120),Image.LANCZOS)
bg.paste(logo,(70,80),logo)
d.text((205,96),"DIESEL",font=m9(58),fill=WHITE); d.text((205,158),"CARGO",font=m7(38),fill=AMBER2)
def fit(txt,fn,sz,maxw):
    s=sz
    while s>10 and d.textlength(txt,font=fn(s))>maxw: s-=2
    return fn(s)
MAXW=940
d.text((72,1090),c["eyebrow"],font=man(30),fill=AMBER2)
l1,l2=c["l1"],c["l2"]
d.text((68,1150),l1,font=fit(l1,m9,132,MAXW),fill=WHITE)
d.text((68,1290),l2,font=fit(l2,m9,132,MAXW),fill=AMBER2)
d.rounded_rectangle([74,1452,470,1468],8,fill=AMBER)
label=c["pill"]; pf=m7(44); pw=d.textlength(label,font=pf)+96
d.rounded_rectangle([72,1600,72+pw,1712],32,fill=AMBER); d.text((120,1632),label,font=pf,fill=INK)
d.text((72,1782),c["sub"],font=man(33),fill=WHITE)
d.text((72,1858),"dieselcompany.pro",font=m7(34),fill=(210,205,200))
bg.save(W+"/cover.jpg",quality=93); print("cover ok",os.path.getsize(W+"/cover.jpg")//1024,"KB")
PY

# ---- meta.json ----
python3 -c "import json,sys;s=json.load(open(sys.argv[1]));json.dump(s['meta'],open(sys.argv[2]+'/meta.json','w'),ensure_ascii=False,indent=1)" "$SPEC" "$W"

# ---- assemble base ----
python3 "$W/assemble.py" | tail -2

# ---- capture kinetic titles -> titles.mov ----
N=$(python3 -c "import json;print(int(json.load(open('$W/words.json'))['total']*30))")
node "$W/capture.js" "$W/ig/html/titles.html" "$N" "$W/fr_titles" 2>&1 | tail -1
ffmpeg -y -loglevel error -framerate 30 -start_number 0 -i "$W/fr_titles/f%03d.png" -c:v qtrle -pix_fmt argb "$W/ig/titles.mov"
rm -rf "$W/fr_titles"

# ---- audio (music only) ----
export MUSIC_TRACK=$(python3 -c "import json;print(json.load(open('$SPEC'))['music'])")
export MUSIC_SEED=$(python3 -c "import json;print(json.load(open('$SPEC')).get('seed',300))")
python3 "$W/audio.py" | tail -2

# ---- compose (titles-only) ----
python3 "$W/compose.py" | tail -2
echo "NVBUILD_DONE $W"

# PRUNE heavy intermediates (foot/segs/base/vfull/frames) — keep reel.mp4+cover.jpg+meta.json
rm -rf "$W/foot" "$W/segs" "$W/fr_titles" "$W/base.mp4" "$W/vfull.mp4" "$W/cover_cand" "$W/ig/titles.mov" 2>/dev/null
echo "PRUNED $W (kept reel.mp4/cover.jpg/meta.json)"
