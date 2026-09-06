# -*- coding: utf-8 -*-
# Без-карты генерации ChatGPT для 5 роликов: ключевые кадры H3 (i2v) + исходники вырезок/3D.
# Каждый — в СВОЁМ чате (уникальный слаг), чтобы не хватать чужой кадр. Проект diesel, лого-марка реф.
import os, subprocess, json, time
OUT="/opt/oko-poster/cfg/diesel_out/gen"; os.makedirs(OUT, exist_ok=True)
MARK="/opt/oko-poster/cfg/diesel_mark.png"; DRIVER="/opt/oko-poster/chatgpt_web.mjs"; CDP="http://127.0.0.1:9334"

STYLE=("Photoreal cinematic still for a premium China-to-Russia powersports import brand, ultra-detailed 4k commercial quality. "
"BRAND: deep near-black tones with exactly one signal amber accent #EA5920 as rim light, no text anywhere in the image, no logos or "
"badges or model names or spec numbers on any vehicle or object, clean unbranded surfaces so no false claim is made. "
"LIGHT: warm directional golden-hour key from one side, long controlled cinematic shadows, gentle atmospheric haze, deep rich blacks, "
"soft amber rim light on top edges. LENS: full-frame 35mm, shallow depth of field with creamy bokeh, slightly low hero angle so the "
"machine feels powerful and premium. MATERIALS: believable weathered steel, brushed aluminium, matte composite panels, rubber tires "
"with real tread, faint road dust, honest reflections. Photoreal, high dynamic range, sharp, no illustration, no cartoon, no neon, "
"no rainbow, no watermark, no text, no gibberish, no duplicated wheels, no distorted geometry, no fake license plates. "
"COLOR AND MOOD: keep the palette disciplined, deep near-black #0E0E0E base with one warm amber #EA5920 accent only, desaturated neutral "
"steel-blue midtones, pure clean highlights, cinematic film contrast, subtle grain, premium and trustworthy, expensive automotive-campaign "
"feeling, never cheap, never stocky, never clipart. CAMERA CRAFT: motivated composition with clear focal hierarchy, strong leading lines, "
"believable perspective, natural lens distortion kept minimal, crisp micro-contrast on the hero, creamy falloff into the background, honest "
"contact shadows grounding every object so nothing floats. FINISH: ultra-detailed physically-based materials, accurate reflections and "
"roughness, realistic dust and wear where it belongs, broadcast-clean render, high dynamic range, razor-sharp where it matters and soft "
"where it should be, a frame that would pass as a real photograph shot for a high-end brand campaign, not an AI image and not an illustration. ")
# H3 keyframe = motion-friendly scene start frame (9:16). cutout/3d source = single object, 3/4, whole, PLAIN solid studio background.
KEY_TECH=("This is the START FRAME of a short motion clip, composed for smooth camera or subject movement: clear foreground subject, "
"depth in the background, room for the camera to push in or the subject to move. 9:16 vertical, cinematic, dynamic energy. ")
OBJ_TECH=("Product shot for cutout and 3D: ONE single object only, three-quarter view, the WHOLE object fully in frame with margin, "
"centered, lit evenly with soft studio light plus an amber rim, standing on a PLAIN SEAMLESS SOLID studio background (dark grey seamless), "
"clean edges so the background can be removed, no other objects, no props, no scene, no shadow clutter. Square-ish framing. ")

REELS={
 "R1":{"keys":[
    "SCENE: a premium four-seat utility side-by-side UTV rolling down a truck ramp into a yard at sunrise, dust glowing in backlight, hero low angle",
    "SCENE: close hands gripping the UTV steering wheel, morning light, shallow focus, anticipation",
    "SCENE: the UTV parked in a home yard at dawn, a person silhouette approaching, warm haze"],
   "obj":[
    "OBJECT: a set of vehicle keys with a small blank tag hanging, metallic",
    "OBJECT: a premium quad ATV, clean unbranded, three-quarter view"]},
 "R2":{"keys":[
    "SCENE: a modern container terminal at golden hour, gantry crane lowering one shipping container, aerial-ish hero",
    "SCENE: a customs office desk, a hand pressing an official rubber stamp onto a document, close macro",
    "SCENE: a border checkpoint gate at dusk, a truck passing, atmospheric"],
   "obj":[
    "OBJECT: a single weathered steel shipping container, three-quarter view, unbranded",
    "OBJECT: a rubber date-stamp tool standing upright, office object"]},
 "R3":{"keys":[
    "SCENE: a clean desk with an open folder of documents and a tablet showing a checklist, warm even light",
    "SCENE: a hand signing a document with a pen, close macro, shallow focus",
    "SCENE: a premium UTV on a clean showroom stand softly out of focus behind documents"],
   "obj":[
    "OBJECT: a neat folder of documents standing, office object",
    "OBJECT: a clipboard with a checklist and a pen, three-quarter view"]},
 "R4":{"keys":[
    "SCENE: a hero premium quad ATV on a dark studio apron with a single dramatic amber rim light, moody",
    "SCENE: a factory assembly line with a powersports vehicle frame, industrial, sparks softly",
    "SCENE: a convoy of freight trucks on a highway through open steppe at golden hour, aerial"],
   "obj":[
    "OBJECT: a premium quad ATV, clean unbranded, three-quarter hero view",
    "OBJECT: a stylized 3D-friendly odometer/speedometer gauge cluster, single instrument"]},
 "R5":{"keys":[
    "SCENE: a clean lineup of several premium off-road machines in a dark showroom under warm light, wide",
    "SCENE: a business handshake in a showroom, close, warm light, trust",
    "SCENE: a snowmobile riding across bright snow, dynamic, spray"],
   "obj":[
    "OBJECT: a side-by-side UTV buggy, clean unbranded, three-quarter view",
    "OBJECT: a snowmobile, clean unbranded, three-quarter view"]},
}

manifest=[]
def gen(slug, prompt, dst, size):
    if os.path.exists(dst): os.remove(dst)
    env=dict(os.environ, CDP=CDP, РАЗМЕР=size, ЖДАТЬ="600", ПРОЕКТ=slug, ССЫЛКИ=MARK)
    t0=time.time()
    try:
        r=subprocess.run(["node",DRIVER,prompt,dst],capture_output=True,text=True,timeout=720,env=env)
        ok=os.path.exists(dst) and os.path.getsize(dst)>20000
        return {"ok":ok,"size":os.path.getsize(dst) if ok else 0,"sec":round(time.time()-t0),"err":("" if ok else (r.stderr or r.stdout or "")[-160:])}
    except Exception as e:
        return {"ok":False,"err":repr(e)[-160:]}

for reel,items in REELS.items():
    for i,scene in enumerate(items["keys"]):
        slug=f"diesel-key-{reel.lower()}-{i+1}"
        dst=f"{OUT}/{reel}_key{i+1}.jpg"
        res=gen(slug, STYLE+KEY_TECH+"\n\n"+scene, dst, "9:16")
        manifest.append({"reel":reel,"kind":"key","n":i+1,**res}); json.dump(manifest,open(f"{OUT}/manifest.json","w"),ensure_ascii=False,indent=1)
        print(reel,"key",i+1,res["ok"],flush=True)
    for i,obj in enumerate(items["obj"]):
        slug=f"diesel-obj-{reel.lower()}-{i+1}"
        dst=f"{OUT}/{reel}_obj{i+1}.jpg"
        res=gen(slug, STYLE+OBJ_TECH+"\n\n"+obj, dst, "1:1")
        manifest.append({"reel":reel,"kind":"obj","n":i+1,**res}); json.dump(manifest,open(f"{OUT}/manifest.json","w"),ensure_ascii=False,indent=1)
        print(reel,"obj",i+1,res["ok"],flush=True)
print("GEN_DONE")
