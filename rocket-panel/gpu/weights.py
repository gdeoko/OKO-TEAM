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

# ВТОРОЕ ПОКОЛЕНИЕ. Две сборки «всё в одном» вместо пяти файлов:
# ускорители, кодировщик и VAE уже внутри, отдельные text_encoders и vae
# не нужны. Прежние Chroma, Wan 2.2 5B, T5 и FLUX VAE УДАЛЕНЫ — если они
# остались на диске с прошлой установки, их можно смело стереть, это
# 33 ГБ.
#
# Обе под Apache 2.0: лицензия не ограничивает ни содержание, ни
# коммерческое использование. Именно поэтому не берём ничего на базе
# FLUX.1-dev, Pony и NoobAI.

print("=== ФОТО — Qwen-Image-Edit-Rapid-AIO (NSFW v23), ~28 ГБ")
фото=get("Phr00t/Qwen-Image-Edit-Rapid-AIO",
         [r"NSFW.*v23.*\.safetensors$", r"NSFW.*\.safetensors$", r"\.safetensors$"],
         "checkpoints","qwen-rapid")
if not фото: print("  !!! сборка для фото не скачалась — панель не поднимется")

print()
print("=== ВИДЕО — WAN2.2-14B-Rapid-AllInOne (mega NSFW v12.2), ~23 ГБ")
# Автор сборки объявил, что больше её не обновляет: работать не
# перестанет, но новых версий не будет. Поэтому имя версии фиксировано,
# а не «возьми самое свежее».
видео=get("Phr00t/WAN2.2-14B-Rapid-AllInOne",
          [r"mega.*nsfw.*v12\.2.*\.safetensors$", r"mega.*nsfw.*\.safetensors$",
           r"mega.*\.safetensors$"],
          "checkpoints","wan-rapid")
if not видео: print("  !!! сборка для видео не скачалась — видео работать не будет")

print()
print("=== ИТОГО")
tot=0
for root,_,fs_ in os.walk(BASE):
    for f in fs_:
        p=os.path.join(root,f); s=os.path.getsize(p)
        if s>1e8: tot+=s; print(f"  {round(s/1e9,2):>6} ГБ  {os.path.relpath(p,BASE)}")
print(f"  ВСЕГО: {round(tot/1e9,1)} ГБ")
print("ЗАКАЧКА-ФИНИШ")
