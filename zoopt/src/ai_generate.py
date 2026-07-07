# -*- coding: utf-8 -*-
"""
Генерация премиум-иллюстраций для плёнок ЗооОпт через бесплатные Hugging Face Spaces
(FLUX.1-Krea-dev). Скачивает результаты в assets/ai/ и нормализует под бренд-палитру.
"""
import os
import sys
import time
import shutil
from gradio_client import Client

HERE = os.path.dirname(os.path.abspath(__file__))
AI_DIR = os.path.join(os.path.dirname(HERE), "assets", "ai")
os.makedirs(AI_DIR, exist_ok=True)

SPACE = "mcp-tools/FLUX.1-Krea-dev"

STYLE = ("Bold, iconic, high contrast, crisp clean edges, flat vector graphic logo style, "
         "corporate branding, premium Aesop Muji pet-boutique aesthetic, generous negative space, "
         "no text, no letters, no words.")

EMBLEM = ("Flat vector emblem, minimalist premium pet brand. A big bright warm yellow circle "
          "like a full moon, centered on a soft ivory background. Inside the circle, a clean elegant "
          "solid black silhouette of {subj}. A subtle thin lime-green decorative leaf sprig accent. ")

SCENE = ("Flat vector illustration on a soft ivory background, minimalist premium pet brand. {subj}. "
         "Lime-green and black shapes with small warm-yellow accents, thin elegant lime-green leaf sprigs. ")

JOBS = {
    # категорийные эмблемы (квадрат)
    "emblem_dog":    (EMBLEM.format(subj="a sitting golden retriever dog in side profile, smooth confident curves"), 1024, 1024),
    "emblem_cat":    (EMBLEM.format(subj="a sitting cat in side profile with an elegant curled tail"), 1024, 1024),
    "emblem_rodent": (EMBLEM.format(subj="a plump cute hamster and a small budgerigar parrot side by side"), 1024, 1024),
    "emblem_aqua":   (EMBLEM.format(subj="a tropical fish and a small friendly turtle side by side"), 1024, 1024),
    # нижние сцены (портрет/квадрат)
    "scene_dogtoys": (SCENE.format(subj="a neat flat-lay of dog accessories: a food bowl, a bone, a collar leash"), 1024, 896),
    "scene_cattoys": (SCENE.format(subj="a neat arrangement of cat toys: a ball of yarn, a scratching post, a toy mouse"), 1024, 896),
    "scene_birds":   (SCENE.format(subj="small animal and bird supplies: an exercise wheel, a perch, a seed feeder"), 1024, 896),
    "scene_aqua":    (SCENE.format(subj="a stylized aquarium scene with gentle waves, bubbles and water plants"), 1024, 896),
}


def generate(names, retries=3):
    client = Client(SPACE)
    done = {}
    for name in names:
        prompt, w, h = JOBS[name]
        full = prompt + STYLE
        for attempt in range(retries):
            try:
                res = client.predict(prompt=full, width=w, height=h, guidance_scale=4.5,
                                     num_inference_steps=24, randomize_seed=True, api_name="/infer")
                img = res[0]
                path = img.get("path") if isinstance(img, dict) else img
                if path and os.path.exists(path):
                    out = os.path.join(AI_DIR, name + ".png")
                    # webp -> png
                    from PIL import Image
                    Image.open(path).convert("RGB").save(out)
                    done[name] = out
                    print("  +", name, "->", os.path.getsize(out), "b")
                    break
            except Exception as e:
                print(f"  [!] {name} attempt {attempt+1}: {e}")
                time.sleep(2 * (attempt + 1))
    return done


if __name__ == "__main__":
    names = sys.argv[1:] or list(JOBS.keys())
    print(f"Генерирую {len(names)}: {names}")
    generate(names)
