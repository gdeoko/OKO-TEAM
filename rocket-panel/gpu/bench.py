#!/usr/bin/env python3
"""Замеры генерации: Chroma (фото) и Wan 2.2 (видео). Через API ComfyUI."""
import json, time, urllib.request, subprocess, sys, os, uuid

API="http://127.0.0.1:8188"
def post(p):
    r=urllib.request.urlopen(urllib.request.Request(API+"/prompt",
        data=json.dumps({"prompt":p,"client_id":str(uuid.uuid4())}).encode(),
        headers={"Content-Type":"application/json"}), timeout=60)
    return json.load(r)["prompt_id"]

def vram_mb():
    try:
        o=subprocess.check_output(["nvidia-smi","--query-gpu=memory.used","--format=csv,noheader,nounits"],timeout=10)
        return int(o.decode().strip().split("\n")[0])
    except Exception: return -1

def wait(pid, label, limit=1800):
    t0=time.time(); peak=0
    while time.time()-t0 < limit:
        peak=max(peak, vram_mb())
        try:
            h=json.load(urllib.request.urlopen(f"{API}/history/{pid}", timeout=30))
        except Exception:
            time.sleep(2); continue
        if pid in h:
            st=h[pid].get("status",{})
            ok=st.get("status_str")=="success"
            dt=time.time()-t0
            outs=h[pid].get("outputs",{})
            files=[]
            for n,v in outs.items():
                for k in ("images","gifs","videos"):
                    for f in v.get(k,[]) or []:
                        files.append(f.get("filename"))
            print(f"  {label}: {'ГОТОВО' if ok else 'ОШИБКА'} за {round(dt,1)} с | пик памяти {round(peak/1024,1)} ГБ | файлы: {files}", flush=True)
            if not ok:
                msgs=st.get("messages",[])
                for m in msgs[-4:]: print("     ", str(m)[:220], flush=True)
            return ok, dt, peak
        time.sleep(2)
    print(f"  {label}: НЕ ДОЖДАЛАСЬ за {limit} с", flush=True)
    return False,limit,peak

POS="photorealistic portrait of a young woman sitting in a sunlit cafe, natural skin texture, detailed eyes, soft window light, 85mm lens, shallow depth of field"
NEG="low quality, blurry, deformed, extra limbs, watermark, text"

def chroma(w=1024,h=1024,steps=26):
    return {
     "1":{"class_type":"UnetLoaderGGUF","inputs":{"unet_name":"Chroma1-HD-Q8_0.gguf"}},
     "2":{"class_type":"CLIPLoader","inputs":{"clip_name":"t5xxl_fp8_e4m3fn_scaled.safetensors","type":"chroma"}},
     "3":{"class_type":"VAELoader","inputs":{"vae_name":"ae.safetensors"}},
     "4":{"class_type":"CLIPTextEncode","inputs":{"clip":["2",0],"text":POS}},
     "5":{"class_type":"CLIPTextEncode","inputs":{"clip":["2",0],"text":NEG}},
     "6":{"class_type":"EmptySD3LatentImage","inputs":{"width":w,"height":h,"batch_size":1}},
     "7":{"class_type":"KSampler","inputs":{"model":["1",0],"positive":["4",0],"negative":["5",0],
          "latent_image":["6",0],"seed":42,"steps":steps,"cfg":4.0,
          "sampler_name":"euler","scheduler":"beta","denoise":1.0}},
     "8":{"class_type":"VAEDecode","inputs":{"samples":["7",0],"vae":["3",0]}},
     "9":{"class_type":"SaveImage","inputs":{"images":["8",0],"filename_prefix":f"chroma_{w}x{h}"}},
    }

def wan_t2v(w=1280,h=704,frames=121,steps=20):
    return {
     "1":{"class_type":"UNETLoader","inputs":{"unet_name":"wan2.2_ti2v_5B_fp16.safetensors","weight_dtype":"default"}},
     "2":{"class_type":"CLIPLoader","inputs":{"clip_name":"umt5_xxl_fp8_e4m3fn_scaled.safetensors","type":"wan"}},
     "3":{"class_type":"VAELoader","inputs":{"vae_name":"wan2.2_vae.safetensors"}},
     "4":{"class_type":"CLIPTextEncode","inputs":{"clip":["2",0],"text":"a young woman smiling and turning her head slowly toward the camera, sitting in a cafe, natural light, cinematic"}},
     "5":{"class_type":"CLIPTextEncode","inputs":{"clip":["2",0],"text":NEG}},
     "6":{"class_type":"Wan22ImageToVideoLatent","inputs":{"vae":["3",0],"width":w,"height":h,"length":frames,"batch_size":1}},
     "7":{"class_type":"KSampler","inputs":{"model":["1",0],"positive":["4",0],"negative":["5",0],
          "latent_image":["6",0],"seed":42,"steps":steps,"cfg":5.0,
          "sampler_name":"uni_pc","scheduler":"simple","denoise":1.0}},
     "8":{"class_type":"VAEDecode","inputs":{"samples":["7",0],"vae":["3",0]}},
     "9":{"class_type":"SaveAnimatedWEBP","inputs":{"images":["8",0],"filename_prefix":f"wan_{w}x{h}_{frames}f",
          "fps":24.0,"lossless":False,"quality":85,"method":"default"}},
    }

print("="*64); print("ТЕСТ 1 — ФОТО (Chroma Q8)"); print("="*64, flush=True)
res={}
for w,h,label in [(1024,1024,"1024x1024"),(768,1344,"768x1344 вертикаль")]:
    try:
        pid=post(chroma(w,h))
        ok,dt,pk=wait(pid,f"фото {label}")
        res[f"chroma_{label}"]={"ok":ok,"сек":round(dt,1),"память_ГБ":round(pk/1024,1)}
    except Exception as e:
        print(f"  фото {label}: СБОЙ {str(e)[:200]}", flush=True)

print(""); print("="*64); print("ТЕСТ 2 — ВИДЕО (Wan 2.2 TI2V-5B)"); print("="*64, flush=True)
for w,h,fr,label in [(704,480,49,"704x480, 49 кадров ~2с"),(1280,704,121,"1280x704, 121 кадр ~5с")]:
    try:
        pid=post(wan_t2v(w,h,fr))
        ok,dt,pk=wait(pid,f"видео {label}", limit=2400)
        res[f"wan_{label}"]={"ok":ok,"сек":round(dt,1),"память_ГБ":round(pk/1024,1)}
    except Exception as e:
        print(f"  видео {label}: СБОЙ {str(e)[:200]}", flush=True)

print(""); print("="*64); print("СВОДКА"); print("="*64)
print(json.dumps(res, ensure_ascii=False, indent=2))
print("ТЕСТЫ-ФИНИШ")
