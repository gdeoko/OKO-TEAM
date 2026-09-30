#!/usr/bin/env python3
"""
Удвоение кадра рубки с дорисовкой микрорельефа.

Заказчик написал коротко: «качество ужасное, расплывчато». Он прав, и
причина арифметическая. Кадр генератора 1536 точек в ширину ложится на
монитор 2560, а на телефоне 832 точки ложатся на 1170 физических при
тройной плотности - то есть на 2500. Одна точка снимка растягивается на
две-три точки экрана, и мыло неизбежно, каким бы хорошим ни был кадр.

Простое увеличение не помогает: оно растягивает те же данные. Здесь
работает finegrain-image-enhancer на ZeroGPU - он идёт по кадру
плитками и дорисовывает то, чего в исходнике не было: зерно металла,
кромку фаски, отражение в стекле. На выходе кадр вдвое больше и резче
по-настоящему.

  python3 tools/cabup.py вход.png выход.png [кратность]

Идёт долго, несколько минут на кадр: запускать отвязанным процессом.
"""
import os
import shutil
import sys

from gradio_client import Client, handle_file

SPACE = "finegrain/finegrain-image-enhancer"

PROMPT = ("machined titanium and charcoal composite surfaces, flush glass panels, "
          "crisp chamfered edges, fine brushed metal grain, sharp specular highlights, "
          "clean cyan light lines, high detail photographic texture")
NEG = ("blurry, soft focus, painted, illustration, cartoon, plastic toy, noise, "
       "jpeg artifacts, oversharpened halo, text, letters, watermark")


def up(src, dst, factor=2):
    tok = os.environ.get("HF_TOKEN")
    c = Client(SPACE, token=tok, verbose=False)
    r = c.predict(
        input_image=handle_file(src),
        prompt=PROMPT,
        negative_prompt=NEG,
        seed=42,
        upscale_factor=factor,
        controlnet_scale=0.6,
        controlnet_decay=1.0,
        condition_scale=6,
        tile_width=112,
        tile_height=144,
        denoise_strength=0.32,
        num_inference_steps=18,
        solver="DDIM",
        api_name="/process",
    )
    # Возвращает пару «до и после»: берём вторую.
    after = r[1] if isinstance(r, (list, tuple)) and len(r) > 1 else r
    if isinstance(after, dict):
        after = after.get("path") or after.get("url")
    shutil.copy(after, dst)
    print("готово", dst, os.path.getsize(dst) // 1024, "КБ")


if __name__ == "__main__":
    if len(sys.argv) < 3:
        raise SystemExit(__doc__)
    up(sys.argv[1], sys.argv[2], int(sys.argv[3]) if len(sys.argv) > 3 else 2)
