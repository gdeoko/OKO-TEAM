#!/usr/bin/env python3
import os, re
from huggingface_hub import HfApi, hf_hub_download
api=HfApi(); BASE="/home/ubuntu/ComfyUI/models"
TOK=os.environ.get("HF_TOKEN") or None

def files(repo):
    try: return api.list_repo_files(repo, token=TOK)
    except Exception as e: print(f"  -- {repo}: {str(e)[:70]}"); return []

def get(repo, pats, dest, label):
    fs=files(repo)
    if not fs: return None
    for pat in pats:
        m=sorted([f for f in fs if re.search(pat,f,re.I)], key=len)
        if not m: continue
        f=m[0]
        d=os.path.join(BASE,dest); os.makedirs(d,exist_ok=True)
        out=os.path.join(d, os.path.basename(f))
        if os.path.exists(out) and os.path.getsize(out)>1e8:
            print(f"  уже есть: {os.path.basename(f)}"); return out
        try:
            print(f"  качаю [{label}] {repo} :: {f}", flush=True)
            p=hf_hub_download(repo_id=repo, filename=f, local_dir=d, token=TOK)
            if os.path.abspath(p)!=os.path.abspath(out):
                try: os.replace(p,out)
                except Exception: out=p
            print(f"  ГОТОВО: {os.path.basename(out)} {round(os.path.getsize(out)/1e9,2)} ГБ", flush=True)
            return out
        except Exception as e:
            print(f"  не вышло: {str(e)[:90]}")
    return None

print("=== VAE для Chroma (пробую зеркала по очереди)")
vae=None
for repo,pat in [("black-forest-labs/FLUX.1-schnell", r"^ae\.safetensors$"),
                 ("Comfy-Org/Lumina_Image_2.0_Repackaged", r"ae\.safetensors$"),
                 ("lodestones/Chroma1-HD", r"ae\.safetensors$|vae.*safetensors$"),
                 ("silveroxides/Chroma1-HD-GGUF", r"ae\.safetensors$|vae.*safetensors$"),
                 ("Comfy-Org/flux1-schnell", r"ae\.safetensors$|vae.*safetensors$"),
                 ("Kijai/flux-fp8", r"ae\.safetensors$")]:
    vae=get(repo,[pat],"vae","flux-vae")
    if vae: break
if not vae: print("  !!! VAE для Chroma не нашла")

print()
print("=== WAN 2.2 — видео")
R="Comfy-Org/Wan_2.2_ComfyUI_Repackaged"
get(R,[r"wan2\.2_ti2v_5B_fp16\.safetensors$"],"diffusion_models","wan-5B")
get(R,[r"umt5_xxl_fp8_e4m3fn_scaled\.safetensors$"],"text_encoders","umt5")
get(R,[r"wan2\.2_vae\.safetensors$"],"vae","wan-vae")

print()
print("=== ИТОГО")
tot=0
for root,_,fs_ in os.walk(BASE):
    for f in fs_:
        p=os.path.join(root,f); s=os.path.getsize(p)
        if s>1e8: tot+=s; print(f"  {round(s/1e9,2):>6} ГБ  {os.path.relpath(p,BASE)}")
print(f"  ВСЕГО: {round(tot/1e9,1)} ГБ")
print("ЗАКАЧКА-ФИНИШ")
