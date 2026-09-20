#!/usr/bin/env python3
"""Простая панель генерации для телефона. Говорит с ComfyUI по API."""
import json, time, uuid, os, threading, urllib.request
from flask import Flask, request, jsonify, send_file, Response

COMFY="http://127.0.0.1:8188"
OUT="/home/ubuntu/ComfyUI/output"
IN="/home/ubuntu/ComfyUI/input"
app=Flask(__name__)
JOBS={}

NEG="low quality, blurry, deformed, extra limbs, bad anatomy, watermark, text"

def wf_photo(p, w, h, steps=26, seed=None):
    return {
     "1":{"class_type":"UnetLoaderGGUF","inputs":{"unet_name":"Chroma1-HD-Q8_0.gguf"}},
     "2":{"class_type":"CLIPLoader","inputs":{"clip_name":"t5xxl_fp8_e4m3fn_scaled.safetensors","type":"chroma"}},
     "3":{"class_type":"VAELoader","inputs":{"vae_name":"ae.safetensors"}},
     "4":{"class_type":"CLIPTextEncode","inputs":{"clip":["2",0],"text":p}},
     "5":{"class_type":"CLIPTextEncode","inputs":{"clip":["2",0],"text":NEG}},
     "6":{"class_type":"EmptySD3LatentImage","inputs":{"width":w,"height":h,"batch_size":1}},
     "7":{"class_type":"KSampler","inputs":{"model":["1",0],"positive":["4",0],"negative":["5",0],
          "latent_image":["6",0],"seed":seed or int(time.time())%10**9,"steps":steps,"cfg":4.0,
          "sampler_name":"euler","scheduler":"beta","denoise":1.0}},
     "8":{"class_type":"VAEDecode","inputs":{"samples":["7",0],"vae":["3",0]}},
     "9":{"class_type":"SaveImage","inputs":{"images":["8",0],"filename_prefix":"photo"}},
    }

def wf_video(p, w, h, frames, steps=20, image=None, seed=None):
    g={
     "1":{"class_type":"UNETLoader","inputs":{"unet_name":"wan2.2_ti2v_5B_fp16.safetensors","weight_dtype":"default"}},
     "2":{"class_type":"CLIPLoader","inputs":{"clip_name":"umt5_xxl_fp8_e4m3fn_scaled.safetensors","type":"wan"}},
     "3":{"class_type":"VAELoader","inputs":{"vae_name":"wan2.2_vae.safetensors"}},
     "4":{"class_type":"CLIPTextEncode","inputs":{"clip":["2",0],"text":p}},
     "5":{"class_type":"CLIPTextEncode","inputs":{"clip":["2",0],"text":NEG}},
     "6":{"class_type":"Wan22ImageToVideoLatent","inputs":{"vae":["3",0],"width":w,"height":h,"length":frames,"batch_size":1}},
     "7":{"class_type":"KSampler","inputs":{"model":["1",0],"positive":["4",0],"negative":["5",0],
          "latent_image":["6",0],"seed":seed or int(time.time())%10**9,"steps":steps,"cfg":5.0,
          "sampler_name":"uni_pc","scheduler":"simple","denoise":1.0}},
     "8":{"class_type":"VAEDecode","inputs":{"samples":["7",0],"vae":["3",0]}},
     "9":{"class_type":"SaveAnimatedWEBP","inputs":{"images":["8",0],"filename_prefix":"video",
          "fps":24.0,"lossless":False,"quality":88,"method":"default"}},
    }
    if image:
        g["10"]={"class_type":"LoadImage","inputs":{"image":image,"upload":"image"}}
        g["6"]["inputs"]["start_image"]=["10",0]
    return g

def run(job_id, graph):
    try:
        r=urllib.request.urlopen(urllib.request.Request(COMFY+"/prompt",
            data=json.dumps({"prompt":graph,"client_id":job_id}).encode(),
            headers={"Content-Type":"application/json"}), timeout=60)
        pid=json.load(r)["prompt_id"]
        JOBS[job_id]["pid"]=pid
        t0=time.time()
        while time.time()-t0 < 3600:
            try:
                h=json.load(urllib.request.urlopen(f"{COMFY}/history/{pid}", timeout=30))
            except Exception:
                time.sleep(2); continue
            if pid in h:
                st=h[pid].get("status",{})
                files=[]
                for n,v in h[pid].get("outputs",{}).items():
                    for k in ("images","gifs","videos"):
                        for f in (v.get(k) or []):
                            files.append(f.get("filename"))
                if st.get("status_str")=="success" and files:
                    JOBS[job_id].update(state="ok", files=files, sec=round(time.time()-t0,1))
                else:
                    msg=""
                    for m in st.get("messages",[])[-3:]:
                        msg += str(m)[:300]+" "
                    JOBS[job_id].update(state="err", error=msg or "не получилось")
                return
            JOBS[job_id]["sec"]=round(time.time()-t0,1)
            time.sleep(2)
        JOBS[job_id].update(state="err", error="слишком долго")
    except Exception as e:
        JOBS[job_id].update(state="err", error=str(e)[:300])

@app.post("/api/gen")
def gen():
    d=request.get_json(force=True)
    mode=d.get("mode","photo"); p=(d.get("prompt") or "").strip()
    if not p: return jsonify(error="пустой запрос"), 400
    size=d.get("size","vert")
    if mode=="photo":
        w,h = (768,1344) if size=="vert" else ((1024,1024) if size=="sq" else (1344,768))
        g=wf_photo(p,w,h)
    else:
        w,h = (704,1280) if size=="vert" else ((960,960) if size=="sq" else (1280,704))
        secs=int(d.get("secs",2)); frames=min(121, max(25, secs*24+1))
        g=wf_video(p,w,h,frames,image=d.get("image"))
    jid=str(uuid.uuid4())[:8]
    JOBS[jid]={"state":"run","sec":0,"mode":mode}
    threading.Thread(target=run,args=(jid,g),daemon=True).start()
    return jsonify(job=jid)

@app.get("/api/job/<jid>")
def job(jid):
    return jsonify(JOBS.get(jid,{"state":"нет такой задачи"}))

@app.post("/api/upload")
def upload():
    f=request.files.get("file")
    if not f: return jsonify(error="нет файла"),400
    os.makedirs(IN,exist_ok=True)
    name=f"up_{uuid.uuid4().hex[:8]}_{f.filename}"
    f.save(os.path.join(IN,name))
    return jsonify(name=name)

@app.get("/file/<path:name>")
def file(name):
    p=os.path.join(OUT,name)
    if not os.path.exists(p): return "нет", 404
    return send_file(p)

@app.get("/api/stats")
def stats():
    try:
        s=json.load(urllib.request.urlopen(COMFY+"/system_stats",timeout=10))
        dev=(s.get("devices") or [{}])[0]
        return jsonify(free=round(dev.get("vram_free",0)/1024**3,1),
                       total=round(dev.get("vram_total",0)/1024**3,1))
    except Exception as e: return jsonify(error=str(e)[:100])

@app.get("/")
def index():
    return Response(PAGE, mimetype="text/html; charset=utf-8")

PAGE = open("/home/ubuntu/panel.html", encoding="utf-8").read()

if __name__=="__main__":
    app.run(host="127.0.0.1", port=8090, threaded=True)
