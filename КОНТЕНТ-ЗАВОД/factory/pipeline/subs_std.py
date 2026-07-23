import json,re
import sys
WD=sys.argv[1] if len(sys.argv)>1 else "."
OFF=0.4
words=json.load(open(f"{WD}/work/words.json"))
for w in words: w["t"]=re.sub(r"[«».,!?—-]","",w["w"]).strip()
words=[w for w in words if w["t"]]
def cc(x):
    h=int(x//3600);m=int((x%3600)//60);s=x%60;return f"{h}:{m:02d}:{s:05.2f}"
# ЕДИНЫЙ ФИРМЕННЫЙ СТИЛЬ (не менять!): 2 слова, НИЗ-центр, тёплое золото-караоке, чёткая обводка, без box
# Primary(залитое)=золото E8C882 -> &H0082C8E8 ; Secondary(до)=тусклое золото ; Outline тёмный, шир.3
hdr="""[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
WrapStyle: 2
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: K,Soyuz Grotesk,82,&H0082C8E8,&H007098B8,&H0010100A,&H90000000,-1,0,0,0,100,100,1,0,1,3,1,2,80,80,430,1
"""
ev="[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n"
i=0
while i<len(words):
    grp=words[i:i+2]; st=grp[0]["a"]+OFF; en=grp[-1]["b"]+OFF
    i+=2
    if st<2.2: continue
    if st>=31.0: break
    if en-st<0.2: en=st+0.4
    parts=[f"{{\\kf{max(8,round((w['b']-w['a'])*100))}}}{w['t'].upper()}" for w in grp]
    ev+=f"Dialogue: 0,{cc(st)},{cc(en)},K,,0,0,0,,{{\\fad(70,70)}}{' '.join(parts)}\n"
open(f"{WD}/work/subs_std.ass","w").write(hdr+ev)
print("reel12 subs_std:",ev.count("Dialogue"),"реплик")
