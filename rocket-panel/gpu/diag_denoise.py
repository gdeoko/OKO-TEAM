#!/usr/bin/env python3
"""Ищем, почему референс не меняется. Меряем отличие от исходника численно."""
import json,time,uuid,urllib.request,os
from PIL import Image
import numpy as np
API="http://127.0.0.1:8188"
# Корень установки — переменной, а не текстом: на Hyperstack это
# /home/ubuntu, на поде Vast /root (см. ДОМ в panel.py).
ДОМ=os.environ.get("ROCKET_HOME","/home/ubuntu")
OUT=os.path.join(ДОМ,"ComfyUI/output"); IN=os.path.join(ДОМ,"ComfyUI/input")
REF="up_c829b971_ref.png"

def post(g):
    r=urllib.request.urlopen(urllib.request.Request(API+"/prompt",
      data=json.dumps({"prompt":g,"client_id":uuid.uuid4().hex}).encode(),
      headers={"Content-Type":"application/json"}),timeout=60)
    return json.load(r)["prompt_id"]

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
            return None, str(st.get("messages",[])[-2:])[:200]
        time.sleep(2)
    return None,"таймаут"

def graph(sched, denoise, steps=26, cfg=4.0, seed=777, sampler="euler"):
    return {
     "1":{"class_type":"UnetLoaderGGUF","inputs":{"unet_name":"Chroma1-HD-Q8_0.gguf"}},
     "2":{"class_type":"CLIPLoader","inputs":{"clip_name":"t5xxl_fp8_e4m3fn_scaled.safetensors","type":"chroma"}},
     "3":{"class_type":"VAELoader","inputs":{"vae_name":"ae.safetensors"}},
     "4":{"class_type":"CLIPTextEncode","inputs":{"clip":["2",0],
          "text":"a woman standing on a beach at sunset, wearing a red dress, full body, arms raised"}},
     "5":{"class_type":"CLIPTextEncode","inputs":{"clip":["2",0],"text":"low quality, blurry"}},
     "10":{"class_type":"LoadImage","inputs":{"image":REF,"upload":"image"}},
     "11":{"class_type":"ImageScale","inputs":{"image":["10",0],"width":1024,"height":1024,
           "upscale_method":"lanczos","crop":"center"}},
     "12":{"class_type":"VAEEncode","inputs":{"pixels":["11",0],"vae":["3",0]}},
     "7":{"class_type":"KSampler","inputs":{"model":["1",0],"positive":["4",0],"negative":["5",0],
          "latent_image":["12",0],"seed":seed,"steps":steps,"cfg":cfg,
          "sampler_name":sampler,"scheduler":sched,"denoise":denoise}},
     "8":{"class_type":"VAEDecode","inputs":{"samples":["7",0],"vae":["3",0]}},
     "9":{"class_type":"SaveImage","inputs":{"images":["8",0],"filename_prefix":f"diag_{sched}_{denoise}"}},
    }

ref=np.asarray(Image.open(os.path.join(IN,REF)).convert("RGB").resize((256,256))).astype(float)
def diff(fn):
    a=np.asarray(Image.open(os.path.join(OUT,fn)).convert("RGB").resize((256,256))).astype(float)
    return round(float(np.abs(a-ref).mean()),1)

print("Отличие от исходника: 0 = копия, больше 40 = совсем другая картинка")
print(f"{'расписание':<14}{'denoise':>8}{'отличие':>10}{'сек':>7}")
print("-"*41)
for sched in ["beta","normal","simple","karras","sgm_uniform"]:
    for dn in [0.75]:
        fn,extra=wait(post(graph(sched,dn)))
        print(f"{sched:<14}{dn:>8}{(diff(fn) if fn else '—'):>10}{extra if fn else str(extra)[:30]:>7}")
print()
print("теперь лучшее расписание на разной силе:")
for dn in [0.5,0.65,0.85,1.0]:
    fn,extra=wait(post(graph("normal",dn)))
    print(f"{'normal':<14}{dn:>8}{(diff(fn) if fn else '—'):>10}{extra if fn else '':>7}")
print("ДИАГНОСТИКА-ФИНИШ")
