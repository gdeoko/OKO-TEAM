import json
WD="/tmp/claude-0/-home-user-OKO-TEAM/f6f2aa4f-e22a-54d1-83e7-29eece9e291a/scratchpad/reel02"
OFF=0.6  # композит задерживает VO на 0.6с
words=json.load(open(f"{WD}/work/words.json"))
# чистим пунктуацию для показа, но сохраняем тайминг
import re
for w in words: w["t"]=re.sub(r"[«».,!?—-]","",w["w"]).strip()
words=[w for w in words if w["t"]]
def cc(x):
    h=int(x//3600); m=int((x%3600)//60); s=x%60
    return f"{h}:{m:02d}:{s:05.2f}"
hdr="""[Script Info]
ScriptType: v4.00+
PlayResX: 1080
PlayResY: 1920
WrapStyle: 2
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: K,Soyuz Grotesk,86,&H0074A5D4,&H00FAF8F8,&H00000000,&HB0000000,-1,0,0,0,100,100,1,0,1,0,3,2,80,80,600,1
"""
# Outline=0 (без обводки), Shadow=3 РЕЗКАЯ полупрозрачная тень (без \blur) — читаемо и чётко
ev="[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n"
# группируем по 2 слова, не заводим на аутро (final >= 31.3)
i=0
while i<len(words):
    pair=words[i:i+2]
    st=pair[0]["a"]+OFF; en=pair[-1]["b"]+OFF
    if st<2.4: i+=2; continue
    if st>=31.3: break
    if en-st<0.18: en=st+0.35
    parts=[]
    for w in pair:
        k=max(6,round((w["b"]-w["a"])*100))
        parts.append(f"{{\\kf{k}}}{w['t'].upper()}")
    ev+=f"Dialogue: 0,{cc(st)},{cc(en)},K,,0,0,0,,{{\\fad(90,90)}}{' '.join(parts)}\n"
    i+=2
open(f"{WD}/work/subs3.ass","w").write(hdr+ev)
print("subs3.ass:", ev.count("Dialogue"), "реплик (синхрон по whisper, резкие)")
