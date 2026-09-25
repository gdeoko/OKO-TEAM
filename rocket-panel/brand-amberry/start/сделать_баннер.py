#!/usr/bin/env python3
"""Стартовый баннер AMBERRY через APIMODELS.

Собирается из трёх вещей, и ни одна не выдумывается на месте:
  * НИКА — героиня бота. Внешность взята из её канонического листа
    (`listy7/nika.txt`), а не описана заново: там лицо задано
    измерениями, и любое «примерно такая блондинка» даёт другую
    девушку. Сам лист прикладывается референсом.
  * ЛОГОТИП — `amberry-icon-512.png`, малиновая ягода бренда.
  * ЦВЕТА — из `tokens.css`: неон #FF0A8C, свечение #FF5CB4,
    глубокий #8A0F52, чистый чёрный фон.

Текст в картинку встраивается СЦЕНОЙ, а не накладывается сверху:
владелец просил «текст встроен в сцену дизайна».
"""
import base64
import json
import os
import sys
import time
import urllib.request

КЛЮЧ = os.environ["APIMODELS_KEY"]
БАЗА = "https://api.apimodels.app/v1"
МОДЕЛЬ = os.environ.get("AMB_MODEL", "gpt-image-2.5-sunburst")

ПРОМПТ = """
A premium vertical key-art banner for a neon night-club style brand called
AMBERRY. Landscape orientation, 16:9, wide cinematic frame. A finished advertising hero image: the
typography is built INTO the scene as physical neon signage and glowing
light, never pasted flat on top.

THE MODEL. One adult fashion model, the same woman as in the attached
reference sheet, standing as the hero of the frame in the RIGHT HALF of the wide canvas. Keep her recognisably her: ash blonde hair, straight and
heavy, centre parted, falling to the middle of her back; grey blue eyes
with a dark limbal ring; light cool skin; a wide face with generous
cheekbone span, large eyes set wide apart, a softly concave nose bridge,
a mouth of average width. Elegant sloping shoulders, a long neck,
straight confident posture. Luminous natural skin with real pore texture.
Minimal makeup, natural brows, natural lip colour.

HER FIGURE. A full, curvaceous hourglass build — this is the single most
important change from the previous version of this banner, and the
BUST is the part that must change most. She has a large, full, heavy
chest: a deep neckline of cleavage, real volume and natural downward
weight filling the halter top completely so the fabric is stretched
taut over it, a visible soft swell above the neckline. The previous
attempt left her flat chested and that is exactly what must not happen
again. Pair that bust with a clearly nipped narrow waist, wide rounded
hips and full rounded glutes, strong shapely thighs. The silhouette should read as unmistakably voluptuous and
womanly from across a room, at thumbnail size, before any detail is
legible: a pronounced waist to hip ratio, a clear S curve through the
torso and hip. Soft realistic flesh with believable weight and gentle
skin dynamics, never rigid or plastic, never airbrushed into a
mannequin. She is an adult woman in her mid twenties with a mature,
developed figure. Her FACE stays exactly as specified above and in the
reference sheet — the build changes, the person does not.

HER POSE. Confident editorial stance, not a catalogue pose. Turned about
twenty degrees from camera, facing mostly TOWARDS the lens so her chest
and waistline are fully visible, weight on one hip to throw the hip out
in a strong S curve, chin slightly down, looking into the lens with a
small easy smile. Her front is to the camera, not her back. One
hand lifted to run her fingers back through her hair near the temple, the
other arm relaxed along her side, fingers softly separated. Framed from mid calf up so the full hip and thigh line reads, her full height fitting the frame height with clear margin above her hair. Exactly five clearly rendered fingers on each visible hand,
correct knuckle and nail anatomy.

WARDROBE. Modest mainstream fashion swimwear in a single solid neon pink,
colour #FF0A8C, matte fabric, no print and no contrast trim — a classic
triangle halter top with narrow ties behind the neck and a matching
full coverage high waisted brief with a smooth wide band straight across
the hip. Exactly the kind of swimwear photographed for a mainstream
department store catalogue: fully covered, tasteful, editorial. Not a
thong, not a micro cut, not sheer anywhere.

THE SET AND LIGHT. Pure black studio void, #000000, no grey lift. Behind
her, tall vertical neon tubes in hot magenta #FF0A8C and softer pink
#FF5CB4 glow out of the darkness, slightly out of focus, some bending
into arcs, with a deep wine #8A0F52 falloff where the light dies into
black. A wet black mirror floor throws long liquid reflections of every
neon and of her legs, with fine concentric ripples spreading outward.
Thin volumetric haze so every light source carries a visible beam. A
strong magenta rim light from behind and above draws a bright hot line
along her shoulder, waist and hip and separates her from the black. A
soft key from forty five degrees in front keeps her face open and clearly
lit. Two tiny distant amber #FFB020 point lights far in the background
depth, used sparingly.

THE LOGO. The AMBERRY raspberry mark from the second attached reference —
a glossy three dimensional berry built of rounded magenta spheres with a
single leaf on top — floats in the LEFT HALF of the frame above the wordmark, large and crisp, in the same glossy neon magenta with specular highlights, casting
its own pink glow and its own reflection on the wet floor below. Keep its
proportions and shape exactly as in the reference. Do not redraw it as a
different fruit and do not flatten it.

THE TYPOGRAPHY, built as real neon in the scene. The word "AMBERRY" in a
wide geometric sans serif, all capitals, generously letterspaced, glowing
hot magenta #FF0A8C as a genuine neon tube with a white hot inner core,
soft bloom and a clean reflection on the wet floor, sitting in the LEFT HALF of the frame, vertically centred, directly under the berry mark. Below it, much smaller and calmer,
the line "ОЖИВЛЯЕТ ЛЮБОЕ ФОТО" in clean white #FFFFFF capitals, widely
letterspaced, lit softly rather than glowing. Both lines spelled EXACTLY
as written here, with correct Cyrillic letterforms on the second line. No
other text, no watermark, no signature, no UI elements, no buttons, no
phone frame.

COMPOSITION. The LEFT HALF is a calm dark field holding only the berry mark and the two lines of type, with generous empty black around them; the model occupies the RIGHT HALF; the wet floor and its reflections fill the bottom fifth across the whole width. A strong
diagonal of neon tubes leads the eye from the logo down to her face.

QUALITY. Full frame camera, 85mm lens at f/2.0, sharp focus on her eyes,
shallow natural depth of field falling into the neon background.
Commercial advertising photography, 8K, ultra sharp, photorealistic skin,
cinematic colour grading, rich true blacks, no banding, no plastic
smoothing, no CGI doll look.
""".strip()

ОТРИЦАНИЕ = ("child, teenager, underage, blurry, deformed hands, extra "
             "fingers, extra limbs, warped anatomy, plastic skin, "
             "misspelled text, garbled letters, watermark, second person, "
             "grey background, washed out blacks")


def картинка_в_дата(путь):
    with open(путь, "rb") as ф:
        д = base64.b64encode(ф.read()).decode()
    вид = "png" if путь.lower().endswith(".png") else "jpeg"
    return "data:image/%s;base64,%s" % (вид, д)


def зов(путь, тело=None, метод=None, таймаут=180):
    данные = json.dumps(тело).encode() if тело is not None else None
    з = urllib.request.Request(БАЗА + путь, data=данные, method=метод,
                               headers={"Authorization": "Bearer " + КЛЮЧ,
                                        "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(з, timeout=таймаут) as о:
            return json.load(о)
    except urllib.error.HTTPError as e:
        тело_ошибки = e.read().decode("utf-8", "replace")[:900]
        return {"_http": e.code, "_ошибка": тело_ошибки}


референсы = [картинка_в_дата(p) for p in sys.argv[1:] if os.path.exists(p)]
print("референсов приложено: %d" % len(референсы), flush=True)

тело = {"model": МОДЕЛЬ, "prompt": ПРОМПТ,
        "aspect_ratio": "16:9", "resolution": "2K",
        "negative_prompt": ОТРИЦАНИЕ}
if референсы:
    # У агрегаторов поле называется по-разному; шлём оба ходовых имени.
    # Лишнее поле сервер обычно игнорирует, а недостающее стоило бы нам
    # генерации без референса — то есть другой девушки.
    тело["image"] = референсы
    тело["image_urls"] = референсы

о = зов("/images/generations", тело)
print("ответ:", json.dumps({k: v for k, v in о.items() if k != "data"},
                           ensure_ascii=False)[:600], flush=True)
tid = (о.get("data") or {}).get("taskId") or о.get("taskId") or о.get("id")
if not tid:
    print("ЗАДАЧА НЕ СОЗДАНА"); raise SystemExit(1)
print("задача:", tid, flush=True)

н = time.time()
while time.time() - н < 900:
    time.sleep(6)
    с = зов("/images/generations?task_id=" + str(tid), метод="GET")
    д = с.get("data") or с
    сост = (д.get("state") or д.get("status") or "").lower()
    if сост in ("completed", "succeeded", "success"):
        print("ГОТОВО за %.0f с" % (time.time() - н), flush=True)
        print(json.dumps(д, ensure_ascii=False)[:1200], flush=True)
        break
    if сост in ("failed", "error"):
        print("ОШИБКА:", json.dumps(д, ensure_ascii=False)[:800]); break
    print("  %s ... %.0f с" % (сост or "?", time.time() - н), flush=True)
