#!/usr/bin/env python3
"""Панель генерации ROCKET. Говорит с ComfyUI по API."""
import json, time, uuid, os, threading, urllib.request
from flask import Flask, request, jsonify, send_file, Response

COMFY="http://127.0.0.1:8188"
OUT="/home/ubuntu/ComfyUI/output"
IN="/home/ubuntu/ComfyUI/input"
app=Flask(__name__); app.config["MAX_CONTENT_LENGTH"]=40*1024*1024
JOBS={}
NEG="low quality, blurry, deformed, extra limbs, bad anatomy, watermark, text, jpeg artifacts"

def wf_photo(p, w, h, steps, cfg, seed, image=None, strength=0.75, neg=NEG):
    g={
     "1":{"class_type":"UnetLoaderGGUF","inputs":{"unet_name":"Chroma1-HD-Q8_0.gguf"}},
     "2":{"class_type":"CLIPLoader","inputs":{"clip_name":"t5xxl_fp8_e4m3fn_scaled.safetensors","type":"chroma"}},
     "3":{"class_type":"VAELoader","inputs":{"vae_name":"ae.safetensors"}},
     "4":{"class_type":"CLIPTextEncode","inputs":{"clip":["2",0],"text":p}},
     "5":{"class_type":"CLIPTextEncode","inputs":{"clip":["2",0],"text":neg}},
     "7":{"class_type":"KSampler","inputs":{"model":["1",0],"positive":["4",0],"negative":["5",0],
          "seed":seed,"steps":steps,"cfg":cfg,"sampler_name":"euler","scheduler":"beta","denoise":1.0}},
     "8":{"class_type":"VAEDecode","inputs":{"samples":["7",0],"vae":["3",0]}},
     "9":{"class_type":"SaveImage","inputs":{"images":["8",0],"filename_prefix":"photo"}},
    }
    if image:
        # по референсу: кодируем картинку и досочиняем поверх
        g["10"]={"class_type":"LoadImage","inputs":{"image":image,"upload":"image"}}
        g["11"]={"class_type":"ImageScale","inputs":{"image":["10",0],"width":w,"height":h,
                 "upscale_method":"lanczos","crop":"center"}}
        g["12"]={"class_type":"VAEEncode","inputs":{"pixels":["11",0],"vae":["3",0]}}
        g["7"]["inputs"]["latent_image"]=["12",0]
        g["7"]["inputs"]["denoise"]=round(float(strength),2)
    else:
        g["6"]={"class_type":"EmptySD3LatentImage","inputs":{"width":w,"height":h,"batch_size":1}}
        g["7"]["inputs"]["latent_image"]=["6",0]
    return g

def wf_video(p, w, h, frames, steps, cfg, seed, image=None, neg=NEG):
    g={
     "1":{"class_type":"UNETLoader","inputs":{"unet_name":"wan2.2_ti2v_5B_fp16.safetensors","weight_dtype":"default"}},
     "2":{"class_type":"CLIPLoader","inputs":{"clip_name":"umt5_xxl_fp8_e4m3fn_scaled.safetensors","type":"wan"}},
     "3":{"class_type":"VAELoader","inputs":{"vae_name":"wan2.2_vae.safetensors"}},
     "4":{"class_type":"CLIPTextEncode","inputs":{"clip":["2",0],"text":p}},
     "5":{"class_type":"CLIPTextEncode","inputs":{"clip":["2",0],"text":neg}},
     "6":{"class_type":"Wan22ImageToVideoLatent","inputs":{"vae":["3",0],"width":w,"height":h,
          "length":frames,"batch_size":1}},
     "7":{"class_type":"KSampler","inputs":{"model":["1",0],"positive":["4",0],"negative":["5",0],
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

def run(job_id, graph):
    j=JOBS[job_id]
    try:
        r=urllib.request.urlopen(urllib.request.Request(COMFY+"/prompt",
            data=json.dumps({"prompt":graph,"client_id":job_id}).encode(),
            headers={"Content-Type":"application/json"}), timeout=60)
        body=json.load(r)
        if "error" in body:
            j.update(state="err", error=json.dumps(body["error"], ensure_ascii=False)[:400]); return
        pid=body["prompt_id"]; t0=time.time()
        while time.time()-t0 < 3600:
            try: h=json.load(urllib.request.urlopen(f"{COMFY}/history/{pid}", timeout=30))
            except Exception: time.sleep(2); continue
            if pid in h:
                st=h[pid].get("status",{}); files=[]
                for _,v in h[pid].get("outputs",{}).items():
                    for k in ("images","gifs","videos"):
                        for f in (v.get(k) or []):
                            if f.get("type")=="output": files.append(f.get("filename"))
                if st.get("status_str")=="success" and files:
                    j.update(state="ok", files=files, sec=round(time.time()-t0,1))
                else:
                    m=" ".join(str(x)[:300] for x in st.get("messages",[])[-3:])
                    j.update(state="err", error=m or "не получилось")
                return
            j["sec"]=round(time.time()-t0,1)
            time.sleep(2)
        j.update(state="err", error="слишком долго")
    except Exception as e:
        j.update(state="err", error=str(e)[:400])

SIZES={"photo":{"vert":(768,1344),"sq":(1024,1024),"horiz":(1344,768)},
       "video":{"vert":(704,1280),"sq":(960,960),"horiz":(1280,704)}}

@app.post("/api/gen")
def gen():
    d=request.get_json(force=True)
    mode=d.get("mode","photo"); p=(d.get("prompt") or "").strip()
    if not p: return jsonify(error="Не написан запрос"), 400
    seed=int(d.get("seed") or 0) or int(time.time()*1000)%(10**9)
    neg=(d.get("neg") or "").strip() or NEG
    w,h=SIZES["photo" if mode=="photo" else "video"].get(d.get("size","vert"),(768,1344))
    img=d.get("image") or None
    if mode=="photo":
        g=wf_photo(p,w,h,int(d.get("steps",26)),float(d.get("cfg",4.0)),seed,
                   img,float(d.get("strength",0.75)),neg)
    else:
        secs=float(d.get("secs",2)); frames=min(121,max(25,int(secs*24)+1))
        g=wf_video(p,w,h,frames,int(d.get("steps",20)),float(d.get("cfg",5.0)),seed,img,neg)
    jid=uuid.uuid4().hex[:8]
    JOBS[jid]={"state":"run","sec":0,"mode":mode,"seed":seed,"w":w,"h":h}
    threading.Thread(target=run,args=(jid,g),daemon=True).start()
    return jsonify(job=jid, seed=seed)

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

@app.get("/in/<path:name>")
def infile(name):
    p=os.path.join(IN,name)
    return send_file(p) if os.path.exists(p) else ("нет",404)

@app.get("/file/<path:name>")
def outfile(name):
    p=os.path.join(OUT,name)
    return send_file(p) if os.path.exists(p) else ("нет",404)

@app.get("/api/recent")
def recent():
    try:
        fs=[(os.path.getmtime(os.path.join(OUT,f)),f) for f in os.listdir(OUT)
            if f.lower().endswith((".png",".webp",".jpg",".mp4"))]
        fs.sort(reverse=True)
        return jsonify(files=[f for _,f in fs[:24]])
    except Exception: return jsonify(files=[])

@app.get("/api/stats")
def stats():
    try:
        s=json.load(urllib.request.urlopen(COMFY+"/system_stats",timeout=10))
        d=(s.get("devices") or [{}])[0]
        q=json.load(urllib.request.urlopen(COMFY+"/queue",timeout=10))
        return jsonify(free=round(d.get("vram_free",0)/1024**3,1),
                       total=round(d.get("vram_total",0)/1024**3,1),
                       queue=len(q.get("queue_running",[]))+len(q.get("queue_pending",[])))
    except Exception as e: return jsonify(error=str(e)[:120])

@app.get("/")
def index():
    return Response(open("/home/ubuntu/panel.html",encoding="utf-8").read(),
                    mimetype="text/html; charset=utf-8")

if __name__=="__main__":
    app.run(host="127.0.0.1", port=8090, threaded=True)
