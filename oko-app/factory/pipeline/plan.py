import os,json,subprocess,re
W=os.path.dirname(os.path.abspath(__file__)); VO=W+"/vo"
import json as _j; SEG=_j.load(open(W+"/vo/script_src.json"))
ORDER=["s1","s2","s3","s4","s5","s6"]
def dur(f): return float(subprocess.run(["ffprobe","-v","error","-show_entries","format=duration","-of","csv=p=0",f],capture_output=True,text=True).stdout.strip() or 0)
def att(s):
    h=int(s//3600); m=int(s%3600//60); sec=s%60; return f"{h}:{m:02d}:{sec:05.2f}"
COVER=1.0; GAP=0.12  # small breath between segments
durs={s:dur(f"{VO}/{s}.mp3") for s in ORDER}
# segment start times (with small gaps)
seg_start={}; t=COVER
for s in ORDER:
    seg_start[s]=round(t,3); t+=durs[s]+GAP
content_end=round(t-GAP,3)
# per-clip schedule: 2 clips per segment split by duration
CLIPS={"s1":["b01","b02"],"s2":["b04","b03"],"s3":["b08","b09"],"s4":["b05","b07"],"s5":["b06","b10"],"s6":["b11","b12"]}
schedule=[]  # (clip, start, dur)
schedule.append(("COVER",0.0,COVER))
for s in ORDER:
    st=seg_start[s]; d=durs[s]+GAP; cs=CLIPS[s]
    half=d/len(cs)
    for i,c in enumerate(cs):
        cd = half if i<len(cs)-1 else d-half*(len(cs)-1)
        schedule.append((c,round(st+half*i,3),round(cd,3)))
END=content_end
json.dump({"cover":COVER,"content_end":content_end,"seg_start":seg_start,"segdurs":durs,"schedule":schedule},
          open(f"{W}/timing.json","w"),ensure_ascii=False,indent=0)
# ---- karaoke subs ----
AMBER="&H2059EA&"; WHITE="&HFFFFFF&"   # ASS is BGR: EA5920 -> 2059EA
words=[]
for s in ORDER:
    st=seg_start[s]; d=durs[s]; ws=re.sub(r"[,.]"," ",SEG[s]).split()
    weights=[len(x)+1 for x in ws]; tot=sum(weights); ct=st
    for w,wt in zip(ws,weights):
        wd=d*wt/tot; words.append({"w":w,"start":round(ct,3),"end":round(ct+wd,3),"seg":s}); ct+=wd
json.dump({"words":words,"total":round(content_end+2.4,3),"seg_start":seg_start},open(f"{W}/words.json","w"),ensure_ascii=False)
head=f"""[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
WrapStyle: 2
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Kar,soyuz,66,{WHITE},{WHITE},&H0A0A0A&,&H99000000&,1,0,0,0,100,100,1,0,1,6,4,2,110,110,256,204
"""
# group into lines (<=2 words / <=15 chars) so nothing overflows the safe margins
lines=[]; cur=[]
for wd in words:
    cur.append(wd); cl=" ".join(x["w"] for x in cur)
    if len(cur)>=2 or len(cl)>=15: lines.append(cur); cur=[]
if cur: lines.append(cur)
ev=[]
for ln in lines:
    lend=ln[-1]["end"]
    for i,wd in enumerate(ln):
        ss=wd["start"]; se=ln[i+1]["start"] if i+1<len(ln) else lend
        parts=[]
        for j,w2 in enumerate(ln):
            if j==i: parts.append("{\\c"+AMBER+"\\fscx109\\fscy109}"+w2["w"]+"{\\c"+WHITE+"\\fscx100\\fscy100}")
            else: parts.append(w2["w"])
        ev.append(f"Dialogue: 0,{att(ss)},{att(se)},Kar,,0,0,0,,{{\\fad(60,0)}}"+" ".join(parts))
open(f"{W}/subs.ass","w").write(head+"\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n"+"\n".join(ev)+"\n")
print("content_end",content_end,"| seg_start",seg_start,"| words",len(words),"lines",len(lines))
