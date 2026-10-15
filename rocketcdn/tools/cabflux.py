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
    "Interior of a modern spacecraft cockpit seen from the pilot seat, photorealistic, "
    "shot straight ahead, symmetrical. In the exact centre one very large viewport opening "
    "filled with pure solid black, absolutely empty: no stars, no glass, no reflection, no "
    "glare, no light of any kind inside it. "
    "{share} "
    "Around the opening on all four sides one seamless moulded cockpit frame: {layout}. "
    "A continuous thin bright cyan light line runs all the way around the opening just "
    "inside the frame edge, following its shape exactly, like a light guide set into a "
    "recessed channel. "
    "The design language is current generation spaceflight, year 2035: smooth continuous "
    "surfaces with almost no visible seams, soft touch matte dark charcoal composite, "
    "brushed titanium accents, gently radiused corners, flush frameless glass panels "
    "sitting perfectly level with the surface, precision machined, clinically clean, "
    "expensive, minimal. "
    "The only illumination is cool cyan: the light line around the opening, a faint cyan "
    "glow from the flush glass panels, a few tiny white status points. Everything else is "
    "deep charcoal and near black. Strong contrast, deep shadow, cinematic, calm. "
    "Absolutely no mechanical keyboard, no keycaps, no rows of physical buttons, no toggle "
    "switches, no rotary dials, no analogue gauges, no CRT monitors, no green screens, no "
    "exposed wiring, no rivets, no clutter, no retro, nothing from the nineteen eighties, "
    "no white plastic, no beige. No text, no letters, no numbers, no logos, no people, no "
    "hands, nothing at all inside the black opening. "
    "Perfectly symmetrical left to right, perfectly level, razor sharp across the whole "
    "frame, 8K, high dynamic range, photoreal, shot on a full frame cinema camera."
)

VIEWS = {
    "широкая": {
        "w": 1536, "h": 864,
        "share": "The black opening covers the central 76 percent of the width and "
                 "74 percent of the height, so the frame is a narrow even band: about "
                 "12 percent of the width on each side, 11 percent of the height along "
                 "the top and 15 percent along the bottom. The frame never gets wider "
                 "than that anywhere.",
        "layout": "a shallow console ledge across the bottom carrying two wide flush glass "
                  "panels glowing faint cyan, slim smooth pillars left and right, a plain "
                  "overhead brow. The frame is a narrow even band and never gets wider "
                  "than the shares given above, the opening takes up most of the picture",
    },
    "высокая": {
        "w": 832, "h": 1664,
        "share": "The black opening covers the central 76 percent of the width and "
                 "74 percent of the height, so the frame is a narrow even band: about "
                 "12 percent of the width on each side, 11 percent of the height along "
                 "the top and 15 percent along the bottom. The frame never gets wider "
                 "than that anywhere.",
        "layout": "a shallow console ledge across the bottom carrying one wide flush glass "
                  "panel glowing faint cyan, very slim smooth jambs left and right, a plain "
                  "overhead brow. The frame is a narrow even band and never gets wider "
                  "than the shares given above, the opening takes up most of the picture",
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
