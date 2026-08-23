#!/usr/bin/env python3
"""
Кадры рубки через бесплатный ZeroGPU: FLUX.1-dev, при отказе schnell.

Почему не кабинет ChatGPT, которым снят прошлый кадр: 23.08 Cloudflare
закрыл адрес сервера и по четвёртой версии, и по шестой, а через
заграничные выходы страница открывается, но ответ модели не доходит -
поток висит и обрывается по времени. Проверено на короткой задаче
«нарисуй яблоко»: четыре минуты пустого ответа. Пока это так, кадры
берём тем, что работает без браузера.

  python3 tools/cabflux.py широкая 4 б    # четыре кандидата горизонта, серия б
  python3 tools/cabflux.py высокая 4 б    # четыре кандидата вертикали, серия б

Серия отделяет заходы друг от друга: у каждой свои зёрна, и удачный
кадр прошлого захода не затирается новым.

Кладёт в assets/gen/cab/cand/<вид>-<номер>.png. Дальше глазами
выбирается лучший и переносится в <вид>.png.
"""
import os
import shutil
import sys

from gradio_client import Client

SPACES = ["black-forest-labs/FLUX.1-dev", "black-forest-labs/FLUX.1-schnell"]
OUT = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                   "assets", "gen", "cab", "cand")

BASE = (
    "First person view from the pilot seat of a spacecraft cockpit, photorealistic. "
    "In the exact centre a large rounded rectangle viewport opening filled with pure "
    "solid black, completely empty, no stars, no glass, no reflection, no glare. "
    "{share} "
    "Around it on all four sides a continuous machined console frame: {layout}. "
    "Dark graphite anodized aluminium and gunmetal, brushed satin metal, chamfered "
    "edges with thin specular highlights, countersunk hex bolts, deep panel seams, "
    "recessed wells, raised plates, real thickness and depth, ambient occlusion in "
    "every crevice, micro scratches and faint dust. "
    "On the bottom shelf a row of chunky square backlit keycaps glowing lime green, "
    "two knurled metal rotary dials, a chrome throttle lever with black rubber grip, "
    "two small recessed screens glowing lime green with radar and telemetry graphics. "
    "The pillars carry toggle switches under raised metal guards and small round amber "
    "and lime indicator lamps. The overhead panel has covered switches with red safety "
    "flaps and a linear vent grille with fine slats. "
    "The cockpit is dark, lit only from inside by lime green keycap backlight, amber "
    "indicator lamps and a soft cool white strip under the overhead lip. Strong "
    "contrast, deep shadows, cinematic. Near monochrome graphite with lime green as "
    "the only saturated accent. "
    "No text, no letters, no numbers, no logos, no people, no hands, nothing at all "
    "inside the black opening. Symmetrical, level, sharp focus everywhere, 8K, "
    "photoreal practical film set."
)

VIEWS = {
    "широкая": {
        "w": 1344, "h": 768,
        "share": "The black opening covers the central 76 percent of the width and "
                 "74 percent of the height, so the frame is a narrow even band: about "
                 "12 percent of the width on each side, 11 percent of the height along "
                 "the top and 15 percent along the bottom. The frame never gets wider "
                 "than that anywhere.",
        "layout": "a wide instrument shelf across the bottom, vertical control pillars "
                  "left and right, an overhead switch panel across the top",
    },
    "высокая": {
        "w": 704, "h": 1408,
        "share": "The black opening covers the central 76 percent of the width and "
                 "74 percent of the height, so the frame is a narrow even band: about "
                 "12 percent of the width on each side, 11 percent of the height along "
                 "the top and 15 percent along the bottom. The frame never gets wider "
                 "than that anywhere.",
        "layout": "a shallow instrument shelf across the bottom carrying most of the "
                  "controls in one dense row, narrow vertical jambs left and right, a "
                  "slim overhead switch panel across the top",
    },
}


def gen(view, n, ser="а"):
    v = VIEWS[view]
    prompt = BASE.format(share=v["share"], layout=v["layout"])
    os.makedirs(OUT, exist_ok=True)
    tok = os.environ.get("HF_TOKEN")
    done = 0
    for i in range(n):
        got = False
        for sp in SPACES:
            steps = 28 if "dev" in sp else 4
            try:
                c = Client(sp, token=tok, verbose=False)
                r = c.predict(prompt=prompt, seed=(1000 if ser == "а" else 5000) + i * 37, randomize_seed=False,
                              width=v["w"], height=v["h"], guidance_scale=3.5,
                              num_inference_steps=steps, api_name="/infer")
                p = r[0] if isinstance(r, (list, tuple)) else r
                if isinstance(p, dict):
                    p = p.get("path") or p.get("url")
                dst = os.path.join(OUT, "%s-%s%d.png" % (view, ser, i + 1))
                shutil.copy(p, dst)
                print("готов", dst, os.path.getsize(dst) // 1024, "КБ", sp.split("/")[-1])
                got = True
                done += 1
                break
            except Exception as e:
                print("мимо", sp.split("/")[-1], str(e)[:160])
        if not got:
            print("кандидат", i + 1, "не вышел вовсе")
    print("всего", done, "из", n)


if __name__ == "__main__":
    if len(sys.argv) < 2:
        raise SystemExit(__doc__)
    gen(sys.argv[1], int(sys.argv[2]) if len(sys.argv) > 2 else 3,
        sys.argv[3] if len(sys.argv) > 3 else "а")
