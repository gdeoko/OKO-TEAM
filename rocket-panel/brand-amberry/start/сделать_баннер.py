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
FULL EVENING GLAM MAKEUP, professionally applied - this is a lit
advertising shoot, not a morning selfie, and a bare face reads as
«just out of the shower» against all this neon.

Eyes done and done strongly: smoky shadow blended warm through the
socket, a clean black winged liner lifting the outer corner, tightlined
upper lash line, thick fluttery lashes with real separation, a touch of
inner corner highlight so the grey blue iris pops against the dark.
Brows groomed, brushed up and defined with a clear tail, a shade deeper
than her hair so they frame the face instead of vanishing into it.

Skin finished like a campaign: smooth luminous base, soft contour under
the cheekbone and along the jaw, warm blush swept high on the cheek,
and a bright highlight on the cheekbone, brow bone, bridge of the nose
and cupid's bow catching the magenta light.

Lips full and glossy in a rich berry pink close to the brand magenta,
lined cleanly, with a wet shine in the centre.

Her FEATURES stay exactly as specified - same face, same bone
structure, same person. Makeup adds definition and contrast, it does
not restyle her into someone else, and the skin still shows real pore
texture rather than an airbrushed mask.

HER FIGURE. A full, curvaceous hourglass build — this is the single most
important change from the previous version of this banner, and the
BUST is the part that must change most. She has a large, full, heavy
chest: a deep neckline of cleavage, real volume and natural downward
weight filling the halter top completely so the fabric is stretched
taut over it, a visible soft swell above the neckline. The previous
attempt left her flat chested and that is exactly what must not happen
again. Pair that bust with wide rounded hips and a
large, full, high and rounded backside - heavy and shapely, projecting
clearly behind the line of her back, the single widest point of her
silhouette - over strong shapely thighs.

HER MIDSECTION IS THE OTHER HALF OF THIS, and it must go the OPPOSITE
way from the bust and hips: a flat, taut, athletic stomach. Tight
abdominal wall with a faint visible line down the centre and the soft
suggestion of upper abs, the obliques cutting a clean sharp line into
the narrow waist. No soft belly, no roll or fold over the waistband, no
pooch below the navel, no thickness through the middle. She trains: the
waist is hard and flat while the chest and hips are full.

HER WAIST IS THE NARROWEST POINT OF THE WHOLE FIGURE and it must be
dramatically narrow - a true model waist. It cuts in sharply just under
the ribs and stays tight all the way to the hip bones, so that the
outline of her body makes a clean deep hourglass: wide chest, very
narrow middle, wide hips. The difference between waist and hip must be
obvious at a glance, an exaggerated editorial waist to hip ratio. Small
ribcage, tight compact midsection, nothing thick or straight through
the middle.

The skin across her whole midsection is SMOOTH AND UNBROKEN from the
ribs to the hip bones - one clean continuous surface, taut over the
muscle, with no crease, no fold, no pinch, no gathered line at the
side of the waist and nothing spilling over the waistband. Flawless
editorial retouch quality on the body while the face and skin stay
natural and pored. That contrast
between a heavy bust, a hard flat stomach and wide hips IS the
silhouette being asked for. The silhouette should read as unmistakably voluptuous and
womanly from across a room, at thumbnail size, before any detail is
legible: a pronounced waist to hip ratio, a clear S curve through the
torso and hip. Soft realistic flesh with believable weight and gentle
skin dynamics, never rigid or plastic, never airbrushed into a
mannequin. She is an adult woman in her mid twenties with a mature,
developed figure. Her FACE stays exactly as specified above and in the
reference sheet — the build changes, the person does not.

HER POSE. Confident editorial stance, not a catalogue pose. SHE FACES
THE CAMERA, front on, turned only about twenty degrees off the lens, so
her chest and her whole waistline are open to camera and fully visible.
Her front is to the camera, not her back.

Weight on one leg with that hip pushed out sideways, so the hip and
thigh flare wide against the narrow waist and the curve reads even from
the front. Chin slightly down, looking into the lens with a small easy
smile. One hand lifted into her hair, the other relaxed along her thigh.

Her spine is LONG AND STRAIGHT, torso lifted and elongated, ribcage
pulled up away from the hips, shoulders back and down. The S curve comes
from the HIPS ONLY. She does not bend, lean or compress sideways at the
waist: side bending is what gathers the skin of the flank into folds,
and there must be none. The stretch through her middle is what keeps it
smooth. One
hand lifted to run her fingers back through her hair near the temple, the
other arm relaxed along her side, fingers softly separated. Framed from the knees up so the whole backside and hip line fits in frame with room to spare, her full height fitting the frame height with clear margin above her hair. Exactly five clearly rendered fingers on each visible hand,
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
the line "РАЗДЕВАЕТ И ОЖИВЛЯЕТ ЛЮБОЕ ФОТО" in clean white #FFFFFF
capitals, lit softly rather than glowing. This line is LONGER than the
word above it, so letterspace it only moderately and set it narrower
than AMBERRY: it must fit on ONE single line inside the left half,
never wrapping to a second line and never running wider than the neon
word above it or past the edge of the frame. Both lines spelled EXACTLY
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
             "misspelled text, garbled letters, wrapped text, text running off frame, "
             "watermark, second person, "
             "belly fat, soft stomach, belly roll, muffin top, thick waist, "
             "skin fold, skin crease, wrinkled stomach, pinched waist skin, "
             "love handles, side roll, bent torso, compressed waist, "
             "flat backside, small hips, boyish figure, wide waist, "
             "straight torso, thick midsection, rectangular silhouette, "
             "bare face, no makeup, washed out features, pale flat lips, "
             "invisible brows, wet hair, "
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
