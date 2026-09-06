# -*- coding: utf-8 -*-
# ChatGPT-генерации без-карты: объект-исходники R2-R5 (для вырезок) + пост-визуал + 7 слайдов карусели.
# Каждая единица: лого-марка первым рефом, промпт >=2000, свой слаг-чат, размер по формату. Skip-existing.
import os, subprocess, json, time
OUT="/opt/oko-poster/cfg/diesel_out"; os.makedirs(OUT+"/gen",exist_ok=True); os.makedirs(OUT+"/post",exist_ok=True); os.makedirs(OUT+"/carousel",exist_ok=True)
MARK="/opt/oko-poster/cfg/diesel_mark.png"; DRIVER="/opt/oko-poster/chatgpt_web.mjs"; CDP="http://127.0.0.1:9334"

STYLE=("Photoreal cinematic commercial imagery for a premium China-to-Russia powersports import brand, ultra-detailed 4k advertising quality. "
"BRAND SYSTEM kept exact: deep near-black base #0E0E0E, exactly one warm signal amber accent #EA5920 used sparingly as a rim light, a thin bar or a small tab, "
"pure white #FFFFFF for headline text, bold condensed industrial sans-serif with tight leading and a clear type hierarchy. A small clean white minimalist WINGED emblem "
"may sit discreetly in a corner echoing the attached brand mark, small and simple. Never print real brand names, model numbers, spec figures, flags or invented logos on any "
"vehicle or object, keep surfaces clean and unbranded so no false claim is made. Render any given Russian text EXACTLY as provided, correct Cyrillic, no gibberish, no random "
"latin letters, no misspelling, no watermark, no emoji, no black text-outline. LIGHT: warm directional golden-hour key from one side, long controlled cinematic shadows, gentle "
"haze and fine dust, deep rich blacks, a soft amber #EA5920 rim light on top edges. LENS: full-frame 35mm, shallow depth of field with creamy bokeh, slightly low hero angle so "
"the machine feels powerful and expensive. MATERIALS: believable weathered steel, brushed aluminium, matte composite panels, rubber tires with real tread, honest reflections. "
"COLOR AND MOOD: disciplined palette, deep near-black with one warm amber accent only, desaturated neutral steel-blue midtones, clean highlights, cinematic film contrast, subtle "
"grain, premium and trustworthy, expensive automotive-campaign feeling, never cheap, never stocky, never clipart. FINISH: physically based materials, accurate reflections and "
"roughness, realistic dust and wear where it belongs, broadcast-clean, high dynamic range, razor-sharp where it matters and soft where it should be, a frame that would pass as a "
"real photograph shot for a high-end brand campaign, not an AI image and not an illustration, no cluttered composition, no cartoon, no neon, no rainbow. ")

OBJ_TECH=("Product shot for cutout: ONE single object only, three-quarter view, the WHOLE object fully in frame with generous margin, centered, lit evenly with soft studio light plus "
"an amber rim, standing on a PLAIN SEAMLESS SOLID dark-grey studio background, clean crisp edges so the background can be removed cleanly, no other objects, no props, no scene, no "
"shadow clutter, square-ish framing, no text anywhere. ")

# --- объект-исходники R2-R5 (2 на ролик) ---
OBJS={
 "R2":["OBJECT: a single weathered steel shipping container, three-quarter view, unbranded, clean",
       "OBJECT: a rubber date-stamp office tool standing upright, metal and wood, single object"],
 "R3":["OBJECT: a neat closed folder of documents standing upright, office object, clean",
       "OBJECT: a clipboard holding a checklist sheet with a pen, three-quarter view"],
 "R4":["OBJECT: a premium quad ATV, clean unbranded, three-quarter hero view, muscular stance",
       "OBJECT: a single automotive instrument gauge cluster (speedometer dial), isolated device"],
 "R5":["OBJECT: a side-by-side UTV buggy, clean unbranded, three-quarter view, premium",
       "OBJECT: a snowmobile, clean unbranded, three-quarter view, premium"],
}
# --- пост: одиночный storytelling-визуал «три страха» (9:16) ---
POST=("SCENE: a calm honest storytelling hero image for a social feed post titled about three fears of ordering powersports from China. "
"A premium four-seat side-by-side UTV stands three-quarter in a clean near-black studio space with a single warm amber rim light, confident and trustworthy, "
"lots of clean dark negative space in the upper area for a headline. Mood: honest conversation, reassurance, premium. "
"TEXT: white headline top «ТРИ СТРАХА»; amber #EA5920 line under «и что на самом деле»; small amber corner tab «честно».")
# --- карусель: 7 слайдов (4:5), путь Китай->Монголия->Москва ---
CAR=[
 ("s1","SCENE: teach-carousel COVER slide, a stylized clean map feel with a bright start dot and an arrow pointing right across deep near-black space, a premium UTV silhouette lower area, warm amber accent line. Clean dark space top for headline.",
      "TEXT: white headline «ТВОЯ ТЕХНИКА ЕДЕТ 30–35 ДНЕЙ»; amber #EA5920 subline «показываю весь путь»; tiny amber tab «свайпай»."),
 ("s2","SCENE: a modern factory floor in China at golden hour, a fresh premium quad ATV on a clean assembly stand, sparks softly bokeh in the deep background, direct-from-factory feeling, clean unbranded machine, dark negative space top.",
      "TEXT: white headline «СТАРТ — ЗАВОД В КИТАЕ»; amber line «напрямую с завода, не перекуп»; small amber step tab «1»."),
 ("s3","SCENE: a clean logistics packing scene, a crate and a shipping container being measured, a calm honest costing mood, deep near-black space top for headline, warm amber accent.",
      "TEXT: white headline «УПАКОВКА И ЦЕНА»; amber line «3,5 $ за килограмм, фикс»; small amber step tab «2»."),
 ("s4","SCENE: a border transit scene at dusk, an open steppe road toward Mongolia, a freight truck passing a checkpoint gate, atmospheric haze, deep dark space top for headline, amber accent.",
      "TEXT: white headline «ГРАНИЦА — МОНГОЛИЯ»; amber line «таможня уже в цене, доплат сверху нет»; small amber step tab «3»."),
 ("s5","SCENE: a clean desk with a neat folder of documents and a checklist tablet, a premium UTV softly out of focus behind on a stand, warm even light, organized and trustworthy, dark space top.",
      "TEXT: white headline «ДОКУМЕНТЫ В ДОРОГЕ»; amber line «спортинвентарь или ЭПСМ и ЭПТС»; small amber step tab «4»."),
 ("s6","SCENE: a delivery-day arrival at a Moscow yard at sunrise, a premium UTV rolled down a ramp, warm amber rim light, a feeling of finish and ownership, deep dark space top for headline.",
      "TEXT: white headline «ФИНИШ — МОСКВА»; amber line «под ключ, гарантия год»; small amber step tab «5»."),
 ("s7","SCENE: a confident offer closing slide, a clean lineup of premium off-road machines in a dark showroom under warm light, expensive and solid, unbranded, a clean dark panel center-bottom for the call.",
      "TEXT: white headline «НАЗОВИ ГОРОД»; amber line «соберём цену под ключ до тебя»; small amber tab «dieselcompany.pro»."),
]

manifest=[]
def gen(slug, prompt, dst, size, refs=MARK):
    if os.path.exists(dst) and os.path.getsize(dst)>20000:
        return {"ok":True,"skip":True,"size":os.path.getsize(dst)}
    if os.path.exists(dst): os.remove(dst)
    env=dict(os.environ, CDP=CDP, РАЗМЕР=size, ЖДАТЬ="600", ПРОЕКТ=slug, ССЫЛКИ=refs)
    t0=time.time()
    try:
        r=subprocess.run(["node",DRIVER,prompt,dst],capture_output=True,text=True,timeout=760,env=env)
        ok=os.path.exists(dst) and os.path.getsize(dst)>20000
        return {"ok":ok,"size":os.path.getsize(dst) if ok else 0,"sec":round(time.time()-t0),"err":("" if ok else (r.stderr or r.stdout or "")[-160:])}
    except Exception as e:
        return {"ok":False,"err":repr(e)[-160:]}

# objs
for reel,objs in OBJS.items():
    for i,o in enumerate(objs):
        dst=f"{OUT}/gen/{reel}_obj{i+1}.jpg"
        res=gen(f"diesel-obj-{reel.lower()}-{i+1}", STYLE+OBJ_TECH+"\n\n"+o, dst, "1:1")
        manifest.append({"kind":"obj","reel":reel,"n":i+1,**res}); json.dump(manifest,open(f"{OUT}/extras_manifest.json","w"),ensure_ascii=False,indent=1)
        print(reel,"obj",i+1,res.get("ok"),res.get("skip",False),flush=True)
# post
res=gen("diesel-post", STYLE+"\n\n"+POST, f"{OUT}/post/post.jpg", "9:16")
manifest.append({"kind":"post",**res}); json.dump(manifest,open(f"{OUT}/extras_manifest.json","w"),ensure_ascii=False,indent=1)
print("post",res.get("ok"),flush=True)
# carousel
for sid,scene,text in CAR:
    dst=f"{OUT}/carousel/{sid}.jpg"
    res=gen(f"diesel-car-{sid}", STYLE+"\n\n"+scene+"\n\n"+text, dst, "4:5")
    manifest.append({"kind":"carousel","slide":sid,**res}); json.dump(manifest,open(f"{OUT}/extras_manifest.json","w"),ensure_ascii=False,indent=1)
    print("car",sid,res.get("ok"),flush=True)
print("EXTRAS_DONE")
