#!/usr/bin/env python3
"""Проверка перерисовки по маске на Chroma."""
import json,time,uuid,urllib.request,os
from PIL import Image, ImageDraw
import numpy as np
API="http://127.0.0.1:8188"
# Корень установки — переменной, а не текстом: на Hyperstack это
# /home/ubuntu, на поде Vast /root (см. ДОМ в panel.py).
ДОМ=os.environ.get("ROCKET_HOME","/home/ubuntu")
OUT=os.path.join(ДОМ,"ComfyUI/output"); IN=os.path.join(ДОМ,"ComfyUI/input")
REF="up_c829b971_ref.png"; MASK="testmask.png"

# маска: белое = перерисовать. Берём нижнюю часть (одежда/тело), лицо не трогаем
im=Image.open(os.path.join(IN,REF)); W,H=im.size
m=Image.new("RGB",(W,H),(0,0,0)); d=ImageDraw.Draw(m)
d.rectangle([0,int(H*0.62),W,H],fill=(255,255,255))
m.save(os.path.join(IN,MASK))
print(f"маска {W}x{H}, перерисовываем низ от {int(H*0.62)}px")

def post(g):
    r=urllib.request.urlopen(urllib.request.Request(API+"/prompt",
      data=json.dumps({"prompt":g,"client_id":uuid.uuid4().hex}).encode(),
      headers={"Content-Type":"application/json"}),timeout=60)
    b=json.load(r)
    if "error" in b: raise RuntimeError(json.dumps(b["error"],ensure_ascii=False)[:400])
    return b["prompt_id"]

def wait(pid,lim=900):
    t0=time.time()
    while time.time()-t0<lim:
        try: h=json.load(urllib.request.urlopen(f"{API}/history/{pid}",timeout=30))
        except Exception: time.sleep(2); continue
        if pid in h:
            st=h[pid].get("status",{}); fs=[]
            for _,v in h[pid].get("outputs",{}).items():
                for f in (v.get("images") or []):
                    if f.get("type")=="output": fs.append(f["filename"])
            if st.get("status_str")=="success" and fs: return fs[0], round(time.time()-t0,1)
            return None, str(st.get("messages",[])[-2:])[:300]
        time.sleep(2)
    return None,"таймаут"

def graph(prompt, feather=24, denoise=1.0, steps=26):
    return {
     "1":{"class_type":"UnetLoaderGGUF","inputs":{"unet_name":"Chroma1-HD-Q8_0.gguf"}},
     "13":{"class_type":"ModelSamplingAuraFlow","inputs":{"model":["1",0],"shift":1.0}},
     "2":{"class_type":"CLIPLoader","inputs":{"clip_name":"t5xxl_fp8_e4m3fn_scaled.safetensors","type":"chroma"}},
     "3":{"class_type":"VAELoader","inputs":{"vae_name":"ae.safetensors"}},
     "4":{"class_type":"CLIPTextEncode","inputs":{"clip":["2",0],"text":prompt}},
     "5":{"class_type":"CLIPTextEncode","inputs":{"clip":["2",0],"text":"low quality, blurry, deformed"}},
     "10":{"class_type":"LoadImage","inputs":{"image":REF,"upload":"image"}},
     "20":{"class_type":"LoadImage","inputs":{"image":MASK,"upload":"image"}},
     "21":{"class_type":"ImageToMask","inputs":{"image":["20",0],"channel":"red"}},
     "22":{"class_type":"GrowMask","inputs":{"mask":["21",0],"expand":8,"tapered_corners":True}},
     "23":{"class_type":"FeatherMask","inputs":{"mask":["22",0],"left":feather,"top":feather,
           "right":feather,"bottom":feather}},
     "12":{"class_type":"VAEEncode","inputs":{"pixels":["10",0],"vae":["3",0]}},
     "24":{"class_type":"SetLatentNoiseMask","inputs":{"samples":["12",0],"mask":["23",0]}},
     "7":{"class_type":"KSampler","inputs":{"model":["13",0],"positive":["4",0],"negative":["5",0],
          "latent_image":["24",0],"seed":555,"steps":steps,"cfg":4.0,
          "sampler_name":"euler","scheduler":"beta","denoise":denoise}},
     "8":{"class_type":"VAEDecode","inputs":{"samples":["7",0],"vae":["3",0]}},
     # вклеиваем обратно, чтобы вне маски пиксели остались ровно исходные
     "25":{"class_type":"ImageCompositeMasked","inputs":{"destination":["10",0],"source":["8",0],
           "mask":["23",0],"x":0,"y":0,"resize_source":False}},
     "9":{"class_type":"SaveImage","inputs":{"images":["25",0],"filename_prefix":"inp"}},
    }

ref=np.asarray(Image.open(os.path.join(IN,REF)).convert("RGB")).astype(float)
h_cut=int(H*0.62)
print()
print("Проверяем: низ меняется, верх (лицо) НЕ меняется")
print(f"{'что':<34}{'низ':>8}{'верх':>8}{'сек':>7}")
print("-"*57)
for prompt,nm in [("a woman wearing a bright red leather jacket, studio portrait","красная куртка"),
                  ("a woman wearing a white knitted sweater","белый свитер")]:
    try:
        fn,extra=wait(post(graph(prompt)))
        if not fn: print(f"{nm:<34}{'ОШИБКА':>8} {extra}"); continue
        a=np.asarray(Image.open(os.path.join(OUT,fn)).convert("RGB")).astype(float)
        low =float(np.abs(a[h_cut:]-ref[h_cut:]).mean())
        high=float(np.abs(a[:h_cut]-ref[:h_cut]).mean())
        print(f"{nm:<34}{low:>8.1f}{high:>8.1f}{extra:>7}")
    except Exception as e:
        print(f"{nm:<34} СБОЙ: {str(e)[:200]}")
print("МАСКА-ФИНИШ")
