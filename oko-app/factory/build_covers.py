# -*- coding: utf-8 -*-
# 5 обложек DIESEL (9:16) через chatgpt_web.mjs, проект=diesel. Лого-марка первым рефом + кадр-объект.
# Каждая под формат своего ролика, хук вшит русским в кавычках. Промпт >=2000 знаков.
import os, subprocess, json, time
OUT="/opt/oko-poster/cfg/diesel_out/covers"; os.makedirs(OUT, exist_ok=True)
MARK="/opt/oko-poster/cfg/diesel_mark.png"; COV="/opt/oko-poster/cfg/diesel_cov"
DRIVER="/opt/oko-poster/chatgpt_web.mjs"

STYLE=("Premium vertical 9:16 thumbnail cover for a China-to-Russia powersports import brand, photoreal cinematic advertising quality, "
"designed to be the very FIRST frame of a short vertical video and to stop the scroll in under one second. BRAND SYSTEM, keep it exact: "
"deep near-black background #0E0E0E, exactly one signal amber accent #EA5920 (a thin bar, a small tab, rim light), pure white #FFFFFF for the "
"main headline, bold condensed industrial sans-serif, tight leading, strong type hierarchy. A small clean white minimalist WINGED emblem sits "
"in the TOP-RIGHT corner as a discreet logo, echo the attached brand mark, simple and small. Never print real brand names, model numbers, spec "
"figures, flags or invented logos on any vehicle or object, keep surfaces clean and unbranded so no false claim is made. Render the given Russian "
"text EXACTLY, correct Cyrillic, no gibberish, no random latin letters, no misspelling, no watermark, no emoji, no black text-outline. ")
TECH=("TECHNICAL DIRECTION: shoot like a high-end automotive campaign. LIGHT: warm directional golden-hour key from one side, long controlled "
"cinematic shadows, gentle haze and fine dust, deep rich blacks, a soft amber #EA5920 rim light on the top edges of the hero. LENS: full-frame "
"35mm, shallow depth of field with creamy bokeh, slightly low hero angle so the machine feels powerful and expensive. MATERIALS: believable "
"weathered steel, brushed aluminium, matte composite panels, rubber tires with real tread, honest reflections. LAYOUT: the headline sits in a "
"clean dark area with clear margin, perfectly legible on a small phone screen, an amber accent bar under it, a small amber corner tab. Ultra-detailed, "
"high dynamic range, sharp 4k commercial finish, photoreal, no illustration, no 3d-render look, no stocky clipart, no cluttered composition. ")

COVERS=[
 ("R1","emotion",
  "SCENE: emotional day-of-delivery moment, a big premium four-seat utility side-by-side UTV being rolled down a truck ramp into a home yard at "
  "sunrise, a man's silhouette reaching toward it, dust glowing in the backlight, a feeling of long-awaited ownership. Hero machine lower-right, "
  "clean dark sky negative space in the TOP for the headline.",
  "TEXT: large white headline top «35 ДНЕЙ ЖДАЛ»; amber #EA5920 line under it «ВОТ ОНО»; small amber corner tab «под ключ»."),
 ("R2","news",
  "SCENE: breaking-news energy, a modern container terminal at golden hour with a gantry crane and a stack of shipping containers, one clean container "
  "lowered over the apron, a subtle red-and-amber news-alert bar feel. Composition busy but the LEFT side kept as dark negative space for the headline.",
  "TEXT: bold white headline left «0 ДОПЛАТ НА ТАМОЖНЕ»; amber #EA5920 sub «разбираю почему»; small amber corner tab «факт»."),
 ("R3","useful",
  "SCENE: calm useful-instruction mood, a clean desk with a neat folder of documents, a tablet showing a checklist, a premium UTV softly out of focus "
  "on a stand behind, warm even light, organized and trustworthy. TOP third kept as clean dark space for the headline.",
  "TEXT: white headline «ДОКУМЕНТЫ?»; amber #EA5920 line «ПОКАЖУ ПО ШАГАМ»; small amber corner tab «инструкция»."),
 ("R4","case",
  "SCENE: case-breakdown drama, one hero premium quad ATV standing three-quarter on a dark studio-like apron with a single dramatic amber rim light, "
  "the machine is the star, moody and expensive. LEFT-TOP kept as clean near-black space for a very large number headline.",
  "TEXT: huge white number headline «11 310 $»; amber #EA5920 line under «под ключ. за что?»; small amber corner tab «разбор»."),
 ("R5","offer",
  "SCENE: confident offer mood, a clean lineup of several serious premium off-road machines in a dark showroom under warm light, a big quad, a "
  "side-by-side UTV and a snowmobile, expensive and solid, unbranded. Center-bottom kept as a clean dark panel for the call headline.",
  "TEXT: white headline «НАЗОВИ ГОРОД»; amber #EA5920 line «ПОСЧИТАЕМ ПОД КЛЮЧ»; small amber corner tab «оффер»."),
]

manifest=[]
for name,fmt,scene,text in COVERS:
    prompt=STYLE+TECH+"\n\n"+scene+"\n\n"+text
    dst=f"{OUT}/{name}_cover.jpg"
    if os.path.exists(dst): os.remove(dst)
    obj=f"{COV}/{name}_obj.jpg"
    ssylki=MARK+((","+obj) if os.path.exists(obj) else "")
    env=dict(os.environ, CDP="http://127.0.0.1:9222", РАЗМЕР="9:16", ЖДАТЬ="600",
             ПРОЕКТ="diesel", ССЫЛКИ=ssylki)
    t0=time.time()
    try:
        r=subprocess.run(["node",DRIVER,prompt,dst],capture_output=True,text=True,timeout=720,env=env)
        ok=os.path.exists(dst) and os.path.getsize(dst)>20000
        manifest.append({"name":name,"fmt":fmt,"ok":ok,"len":len(prompt),
                         "size":os.path.getsize(dst) if ok else 0,"sec":round(time.time()-t0),
                         "err":("" if ok else (r.stderr or r.stdout or "")[-200:])})
    except Exception as e:
        manifest.append({"name":name,"ok":False,"err":repr(e)[-200:]})
    json.dump(manifest,open(f"{OUT}/manifest.json","w"),ensure_ascii=False,indent=1)
print("COVERS DONE")
