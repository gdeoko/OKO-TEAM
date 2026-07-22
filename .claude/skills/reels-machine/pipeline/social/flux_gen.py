#!/usr/bin/env python3
# Бесплатная генерация премиум-визуала под сцены (FLUX.1-schnell через HF).
# python flux_gen.py "детальный промпт" out.png [W H]
import os, sys, shutil
from gradio_client import Client
def gen(prompt, out, w=832, h=1216):
    c = Client("black-forest-labs/FLUX.1-schnell", token=os.environ.get("HF_TOKEN"))
    r = c.predict(prompt, 0, True, w, h, 4, api_name="/infer")
    src = r[0] if isinstance(r, (list, tuple)) else r
    path = src.get("path") if isinstance(src, dict) else src
    shutil.copy(path, out); return out
if __name__ == "__main__":
    w, h = (int(sys.argv[4]), int(sys.argv[5])) if len(sys.argv) > 5 else (832, 1216)
    print(gen(sys.argv[1], sys.argv[2] if len(sys.argv) > 2 else "out.png", w, h))
