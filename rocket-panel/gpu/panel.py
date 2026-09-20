#!/usr/bin/env python3
"""Панель генерации ROCKET. Chroma (фото) + Wan 2.2 (видео) через ComfyUI."""
import json, time, uuid, os, threading, urllib.request
from flask import Flask, request, jsonify, send_file, Response

COMFY="http://127.0.0.1:8188"
OUT="/home/ubuntu/ComfyUI/output"; IN="/home/ubuntu/ComfyUI/input"
app=Flask(__name__); app.config["MAX_CONTENT_LENGTH"]=48*1024*1024
JOBS={}

# Wan обучен на китайском негативе — он работает лучше английского
WAN_NEG=("色调艳丽，过曝，静态，细节模糊不清，字幕，风格，作品，画作，画面，静止，整体发灰，"
         "最差质量，低质量，JPEG压缩残留，丑陋的，残缺的，多余的手指，画得不好的手部，"
         "画得不好的脸部，畸形的，毁容的，形态畸形的肢体，手指融合，静止不动的画面，"
         "杂乱的背景，三条腿，背景人很多，倒着走")
PHOTO_NEG=("low quality, worst quality, blurry, out of focus, jpeg artifacts, deformed, "
           "disfigured, bad anatomy, mutated hands, fused fingers, extra fingers, extra limbs, "
           "malformed limbs, asymmetric eyes, watermark, signature, text")

def _chroma_base(p, neg, steps, cfg, seed, sched="beta"):
    return {
     "1":{"class_type":"UnetLoaderGGUF","inputs":{"unet_name":"Chroma1-HD-Q8_0.gguf"}},
     "13":{"class_type":"ModelSamplingAuraFlow","inputs":{"model":["1",0],"shift":1.0}},
     "2":{"class_type":"CLIPLoader","inputs":{"clip_name":"t5xxl_fp8_e4m3fn_scaled.safetensors","type":"chroma"}},
     "3":{"class_type":"VAELoader","inputs":{"vae_name":"ae.safetensors"}},
     "4":{"class_type":"CLIPTextEncode","inputs":{"clip":["2",0],"text":p}},
     "5":{"class_type":"CLIPTextEncode","inputs":{"clip":["2",0],"text":neg or PHOTO_NEG}},
     "7":{"class_type":"KSampler","inputs":{"model":["13",0],"positive":["4",0],"negative":["5",0],
          "seed":seed,"steps":steps,"cfg":cfg,"sampler_name":"euler","scheduler":sched,"denoise":1.0}},
     "8":{"class_type":"VAEDecode","inputs":{"samples":["7",0],"vae":["3",0]}},
    }

def wf_photo(p,w,h,steps,cfg,seed,image=None,denoise=0.75,neg=None):
    g=_chroma_base(p,neg,steps,cfg,seed)
    g["9"]={"class_type":"SaveImage","inputs":{"images":["8",0],"filename_prefix":"photo"}}
    if image:
        g["10"]={"class_type":"LoadImage","inputs":{"image":image,"upload":"image"}}
        g["11"]={"class_type":"ImageScale","inputs":{"image":["10",0],"width":w,"height":h,
                 "upscale_method":"lanczos","crop":"center"}}
        g["12"]={"class_type":"VAEEncode","inputs":{"pixels":["11",0],"vae":["3",0]}}
        g["7"]["inputs"]["latent_image"]=["12",0]
        g["7"]["inputs"]["denoise"]=round(float(denoise),2)
    else:
        g["6"]={"class_type":"EmptySD3LatentImage","inputs":{"width":w,"height":h,"batch_size":1}}
        g["7"]["inputs"]["latent_image"]=["6",0]
    return g

def wf_inpaint(p,steps,cfg,seed,image,mask,denoise=1.0,feather=24,grow=8,neg=None):
    """Перерисовка по маске: белое в маске переписывается, остальное остаётся пиксель в пиксель."""
    g=_chroma_base(p,neg,steps,cfg,seed)
    g["10"]={"class_type":"LoadImage","inputs":{"image":image,"upload":"image"}}
    g["20"]={"class_type":"LoadImage","inputs":{"image":mask,"upload":"image"}}
    g["21"]={"class_type":"ImageToMask","inputs":{"image":["20",0],"channel":"red"}}
    g["22"]={"class_type":"GrowMask","inputs":{"mask":["21",0],"expand":int(grow),"tapered_corners":True}}
    g["23"]={"class_type":"FeatherMask","inputs":{"mask":["22",0],"left":int(feather),"top":int(feather),
             "right":int(feather),"bottom":int(feather)}}
    g["12"]={"class_type":"VAEEncode","inputs":{"pixels":["10",0],"vae":["3",0]}}
    g["24"]={"class_type":"SetLatentNoiseMask","inputs":{"samples":["12",0],"mask":["23",0]}}
    g["7"]["inputs"]["latent_image"]=["24",0]
    g["7"]["inputs"]["denoise"]=round(float(denoise),2)
    g["25"]={"class_type":"ImageCompositeMasked","inputs":{"destination":["10",0],"source":["8",0],
             "mask":["23",0],"x":0,"y":0,"resize_source":False}}
    g["9"]={"class_type":"SaveImage","inputs":{"images":["25",0],"filename_prefix":"inpaint"}}
    return g

def wf_video(p,w,h,frames,steps,cfg,seed,image=None,neg=None,shift=8.0):
    g={
     "1":{"class_type":"UNETLoader","inputs":{"unet_name":"wan2.2_ti2v_5B_fp16.safetensors","weight_dtype":"default"}},
     "12":{"class_type":"ModelSamplingSD3","inputs":{"model":["1",0],"shift":float(shift)}},
     "2":{"class_type":"CLIPLoader","inputs":{"clip_name":"umt5_xxl_fp8_e4m3fn_scaled.safetensors","type":"wan"}},
     "3":{"class_type":"VAELoader","inputs":{"vae_name":"wan2.2_vae.safetensors"}},
     "4":{"class_type":"CLIPTextEncode","inputs":{"clip":["2",0],"text":p}},
     "5":{"class_type":"CLIPTextEncode","inputs":{"clip":["2",0],"text":neg or WAN_NEG}},
     "6":{"class_type":"Wan22ImageToVideoLatent","inputs":{"vae":["3",0],"width":w,"height":h,
          "length":frames,"batch_size":1}},
     "7":{"class_type":"KSampler","inputs":{"model":["12",0],"positive":["4",0],"negative":["5",0],
          "latent_image":["6",0],"seed":seed,"steps":steps,"cfg":cfg,
          "sampler_name":"uni_pc","scheduler":"simple","denoise":1.0}},
     "8":{"class_type":"VAEDecode","inputs":{"samples":["7",0],"vae":["3",0]}},
     "9":{"class_type":"SaveAnimatedWEBP","inputs":{"images":["8",0],"filename_prefix":"video",
          "fps":24.0,"lossless":False,"quality":90,"method":"default"}},
    }
    if image:
        g["10"]={"class_type":"LoadImage","inputs":{"image":image,"upload":"image"}}
        g["11"]={"class_type":"ImageScale","inputs":{"image":["10",0],"width":w,"height":h,
                 "upscale_method":"lanczos","crop":"center"}}
        g["6"]["inputs"]["start_image"]=["11",0]
    return g

def run(jid, graph):
    j=JOBS[jid]
    try:
        r=urllib.request.urlopen(urllib.request.Request(COMFY+"/prompt",
          data=json.dumps({"prompt":graph,"client_id":jid}).encode(),
          headers={"Content-Type":"application/json"}), timeout=60)
        b=json.load(r)
        if "error" in b:
            j.update(state="err", error=json.dumps(b["error"],ensure_ascii=False)[:400]); return
        pid=b["prompt_id"]; t0=time.time()
        while time.time()-t0<3600:
            try: h=json.load(urllib.request.urlopen(f"{COMFY}/history/{pid}",timeout=30))
            except Exception: time.sleep(2); continue
            if pid in h:
                st=h[pid].get("status",{}); files=[]
                for _,v in h[pid].get("outputs",{}).items():
                    for k in ("images","gifs","videos"):
                        for f in (v.get(k) or []):
                            if f.get("type")=="output": files.append(f["filename"])
                if st.get("status_str")=="success" and files:
                    j.update(state="ok",files=files,sec=round(time.time()-t0,1))
                else:
                    j.update(state="err",error=" ".join(str(x)[:300] for x in st.get("messages",[])[-3:]) or "не получилось")
                return
            j["sec"]=round(time.time()-t0,1); time.sleep(2)
        j.update(state="err",error="слишком долго")
    except Exception as e:
        j.update(state="err",error=str(e)[:400])

SZ={"photo":{"vert":(768,1344),"sq":(1024,1024),"horiz":(1344,768)},
    "video":{"vert":(704,1280),"sq":(960,960),"horiz":(1280,704)}}

@app.post("/api/gen")
def gen():
    d=request.get_json(force=True)
    mode=d.get("mode","photo"); p=(d.get("prompt") or "").strip()
    if not p: return jsonify(error="Не написан запрос"),400
    seed=int(d.get("seed") or 0) or int(time.time()*1000)%(10**9)
    neg=(d.get("neg") or "").strip() or None
    img=d.get("image") or None
    steps=int(d.get("steps") or (26 if mode!="video" else 20))
    cfg=float(d.get("cfg") or (4.0 if mode!="video" else 5.0))
    if mode=="inpaint":
        if not img or not d.get("mask"): return jsonify(error="Нужны фото и обведённая область"),400
        g=wf_inpaint(p,steps,cfg,seed,img,d["mask"],float(d.get("denoise",1.0)),
                     int(d.get("feather",24)),int(d.get("grow",8)),neg)
        w=h=0
    elif mode=="photo":
        w,h=SZ["photo"].get(d.get("size","vert"),(768,1344))
        g=wf_photo(p,w,h,steps,cfg,seed,img,float(d.get("denoise",0.75)),neg)
    else:
        w,h=SZ["video"].get(d.get("size","vert"),(704,1280))
        frames=min(121,max(25,int(float(d.get("secs",2))*24)+1))
        g=wf_video(p,w,h,frames,steps,cfg,seed,img,neg,float(d.get("shift",8.0)))
    jid=uuid.uuid4().hex[:8]
    JOBS[jid]={"state":"run","sec":0,"mode":mode,"seed":seed,"w":w,"h":h}
    threading.Thread(target=run,args=(jid,g),daemon=True).start()
    return jsonify(job=jid,seed=seed)

@app.get("/api/job/<jid>")
def job(jid): return jsonify(JOBS.get(jid,{"state":"err","error":"нет такой задачи"}))

@app.post("/api/upload")
def upload():
    f=request.files.get("file")
    if not f: return jsonify(error="нет файла"),400
    os.makedirs(IN,exist_ok=True)
    safe="".join(c for c in (f.filename or "img.png") if c.isalnum() or c in "._-")[-40:]
    name=f"up_{uuid.uuid4().hex[:8]}_{safe or 'img.png'}"
    f.save(os.path.join(IN,name))
    return jsonify(name=name)

@app.get("/in/<path:n>")
def infile(n):
    p=os.path.join(IN,n); return send_file(p) if os.path.exists(p) else ("нет",404)

@app.get("/file/<path:n>")
def outfile(n):
    p=os.path.join(OUT,n); return send_file(p) if os.path.exists(p) else ("нет",404)

@app.get("/api/recent")
def recent():
    try:
        fs=[(os.path.getmtime(os.path.join(OUT,f)),f) for f in os.listdir(OUT)
            if f.lower().endswith((".png",".webp",".jpg"))]
        fs.sort(reverse=True); return jsonify(files=[f for _,f in fs[:30]])
    except Exception: return jsonify(files=[])

@app.get("/api/stats")
def stats():
    try:
        s=json.load(urllib.request.urlopen(COMFY+"/system_stats",timeout=10))
        dv=(s.get("devices") or [{}])[0]
        q=json.load(urllib.request.urlopen(COMFY+"/queue",timeout=10))
        return jsonify(free=round(dv.get("vram_free",0)/1024**3,1),
                       total=round(dv.get("vram_total",0)/1024**3,1),
                       queue=len(q.get("queue_running",[]))+len(q.get("queue_pending",[])))
    except Exception as e: return jsonify(error=str(e)[:120])

@app.get("/")
def index():
    return Response(open("/home/ubuntu/panel.html",encoding="utf-8").read(),
                    mimetype="text/html; charset=utf-8")

if __name__=="__main__":
    app.run(host="127.0.0.1",port=8090,threaded=True)
