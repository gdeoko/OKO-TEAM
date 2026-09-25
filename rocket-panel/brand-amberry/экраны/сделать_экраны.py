#!/usr/bin/env python3
"""Обложки разделов бота: та же героиня, своя сцена на каждый экран.

## Зачем отдельный скрипт, а не шесть промптов руками

Карточек шесть, и у них общего гораздо больше, чем различий: одна и
та же героиня с одним и тем же лицом, макияжем и сложением, один и
тот же неоновый павильон, один логотип, одно требование к качеству.
Руками это разошлось бы на второй карточке - где-то забылась бы
строка про плоский живот, где-то про макияж, и раздел «Пополнить»
показывал бы другую девушку, чем старт.

Поэтому общее лежит в `_части.json` (вырезано из выверенного промпта
заставки), а на экран приходится ровно три строки: ПОЗА, СЦЕНА и
НАДПИСЬ. Меняется только то, что обязано меняться.

## Почему поза и предмет разные

Владелец просил, чтобы героиня «была в позах и ракурсах по смыслу
картинки и делала действия в соответствии с разделом». Карточка
раздела - это не декорация, а подсказка: по ней должно быть понятно,
куда человек попал, ещё до того как он прочтёт подпись.

## Надпись встроена в сцену

Как на заставке: неоновая вывеска в кадре, а не текст, положенный
поверх. Наложенный текст читается как баннер из стокового шаблона,
встроенный - как снятая реклама.

Запуск:  python3 сделать_экраны.py [ключ ...]
Без ключей делает все. Ключи: buy unlim fr ref cab
"""
import base64
import json
import os
import sys
import time
import urllib.error
import urllib.request

КЛЮЧ = os.environ["APIMODELS_KEY"]
БАЗА = "https://api.apimodels.app/v1"
# doubao, а не GPT: GPT-модерация отбивает эту съёмку, проверено
# четырежды. Отказ бесплатный, но времени стоит.
МОДЕЛЬ = os.environ.get("AMB_MODEL", "doubao-seedream-5-0-pro")

ЗДЕСЬ = os.path.dirname(os.path.abspath(__file__))
ЧАСТИ = json.load(open(os.path.join(ЗДЕСЬ, "_части.json"), encoding="utf-8"))

# --- ЭКРАНЫ -----------------------------------------------------------
# надпись: ровно то, что будет набрано неоном. Вторая строка мельче.
ЭКРАНЫ = {
    "buy": {
        "надпись": ("ПОПОЛНИТЬ", "БОЛЬШЕ КАДРОВ - ДЕШЕВЛЕ"),
        "поза": (
            "She stands three quarters to camera, weight on one hip, "
            "one hand lifted at chest height with the palm turned up, "
            "holding a small cluster of glowing magenta coins that float "
            "just above her fingers; her other hand rests on her hip. "
            "She looks straight into the lens with a knowing half smile, "
            "chin slightly down, clearly offering what is in her hand."),
        "сцена": (
            "Around her, a slow spiral of glossy magenta coins stamped "
            "with a tiny raspberry mark rises from the wet floor and "
            "drifts upward through the neon beams, some catching sharp "
            "specular highlights, some falling out of focus. A few coins "
            "lie on the mirror floor and reflect in it."),
    },
    "unlim": {
        "надпись": ("БЕЗЛИМИТ", "МЕСЯЦ БЕЗ СЧЁТА КАДРОВ"),
        "поза": (
            "She sits on the edge of a low glossy black podium, back "
            "long and straight, one leg extended and the other bent, "
            "leaning back slightly on one straight arm in a relaxed "
            "queenly pose. Her free hand rests on her thigh. She looks "
            "down into the lens with calm confidence, a small smile, "
            "chin lowered - the posture of someone who owns the room "
            "and is in no hurry."),
        "сцена": (
            "A slim magenta neon crown hovers in the air above and "
            "slightly behind her head, glowing softly and reflecting on "
            "the wet floor. Behind her the neon tubes are arranged like "
            "a wide throne arch. An infinity symbol drawn in the same "
            "neon glows faintly low on the left, small and unobtrusive."),
    },
    "fr": {
        "надпись": ("СВОЙ БОТ", "ФРАНШИЗА AMBERRY"),
        "поза": (
            "She stands facing the camera, weight on one hip, holding a "
            "modern black smartphone upright in one hand at chest height, "
            "screen turned towards the lens and glowing magenta; her "
            "other hand gestures open toward it, presenting it. Direct "
            "confident eye contact, small proud smile."),
        "сцена": (
            "Behind her, three more identical smartphones float upright "
            "in a receding row, each glowing with the same magenta screen "
            "light, slightly out of focus, suggesting one bot multiplied "
            "into many. All screens are plain glowing magenta with NO "
            "readable interface, no icons and no text on them. Their "
            "light reflects on the wet floor."),
    },
    "ref": {
        "надпись": ("ПОЗОВИ ДРУЗЕЙ", "КАДРЫ ОБОИМ"),
        "поза": (
            "She stands turned slightly to camera, one arm raised high "
            "and out to the side in a wide welcoming beckoning gesture, "
            "fingers open, as if calling someone over from across the "
            "room; her other hand rests on her hip. Bright open smile, "
            "looking straight into the lens, chin up."),
        "сцена": (
            "From her raised hand, a glowing magenta line of light "
            "sweeps outward and splits into two branching streams that "
            "arc away into the dark, each ending in a small bright node "
            "of light. Fine magenta particles trail along the streams. "
            "The branching light reflects across the wet floor."),
    },
    "sup": {
        "надпись": ("ПОДДЕРЖКА", "НАПИШИ - РАЗБЕРЁМСЯ"),
        "поза": (
            "She stands facing the camera, weight on one hip, both "
            "hands relaxed at her sides, one palm turned slightly "
            "outward in a calm open gesture. Head level and turned "
            "just a little to the lens, warm attentive smile, direct "
            "friendly eye contact - listening, not selling. No hand "
            "near her face or head."),
        "сцена": (
            "Beside her, two rounded speech bubbles drawn in glowing "
            "magenta neon float in the dark at different heights, one "
            "larger and one smaller, completely EMPTY with nothing "
            "written inside them. Soft magenta particles drift between "
            "them. Both bubbles reflect on the wet floor."),
    },
    "cab": {
        "надпись": ("ЛИЧНЫЙ КАБИНЕТ", "ТВОЙ БАЛАНС И РАБОТЫ"),
        "поза": (
            "She stands facing the camera, weight on one hip, both arms "
            "relaxed and open at her sides with the palms turned "
            "slightly forward in a calm welcoming gesture, as if saying "
            "«this is yours». Head level, looking straight into the "
            "lens with a soft warm smile. Relaxed, unhurried, at home "
            "here."),
        "сцена": (
            "Around her, several glowing magenta picture frames of "
            "different sizes float in the dark at different depths, "
            "empty and softly lit from within, like a gallery hung in "
            "mid air - her saved work waiting on the walls. The frames "
            "are plain glowing rectangles with nothing drawn inside "
            "them. Fine magenta particles drift between them. The "
            "frames reflect on the wet floor."),
    },
}

ОБЩЕЕ_НАЧАЛО = """
A premium key-art banner for a neon night-club style adult brand called
AMBERRY. Landscape orientation, 16:9, wide cinematic frame. A finished
advertising hero image: the typography is built INTO the scene as
physical neon signage and glowing light, never pasted flat on top.
"""

ОТРИЦАНИЕ = (
    "child, teenager, underage, blurry, deformed hands, extra fingers, "
    "extra limbs, warped anatomy, plastic skin, misspelled text, "
    "garbled letters, wrapped text, text running off frame, readable "
    "interface text, fake ui text, watermark, second person, grey "
    "background, washed out blacks, belly fat, soft stomach, belly roll, "
    "muffin top, thick waist, skin fold, skin crease, wrinkled stomach, "
    "love handles, side roll, bent torso, compressed waist, wide waist, "
    "straight torso, thick midsection, rectangular silhouette, flat "
    "backside, small hips, boyish figure, bare face, no makeup, washed "
    "out features, pale flat lips, invisible brows, wet hair")


def промпт(э):
    большая, малая = э["надпись"]
    return "\n\n".join([
        ОБЩЕЕ_НАЧАЛО.strip(),
        ЧАСТИ["модель"],
        "HER POSE. " + э["поза"],
        "THE ACTION AND PROPS. " + э["сцена"],
        ЧАСТИ["свет"],
        ЧАСТИ["логотип"],
        # Надпись описываем тем же способом, что и на заставке: две
        # строки, крупная неоном и мелкая белым, обе в левой половине.
        'THE TYPOGRAPHY, built as real neon in the scene. The word '
        f'"{большая}" in a wide geometric sans serif, all capitals, '
        'generously letterspaced, glowing hot magenta #FF0A8C as a '
        'genuine neon tube with a white hot inner core, soft bloom and a '
        'clean reflection on the wet floor, sitting in the LEFT HALF of '
        'the frame, vertically centred, directly under the berry mark. '
        f'Below it, much smaller and calmer, the line "{малая}" in clean '
        'white #FFFFFF capitals, lit softly rather than glowing. Both '
        'lines must fit on ONE line each inside the left half, never '
        'wrapping and never running past the edge of the frame. Both '
        'spelled EXACTLY as written here, with correct Cyrillic '
        'letterforms. No other text anywhere in the image, no watermark, '
        'no signature, no readable interface text.',
        "COMPOSITION. The LEFT HALF is a calm dark field holding only "
        "the berry mark and the two lines of type, with generous empty "
        "black around them; the model and her props occupy the RIGHT "
        "HALF; the wet floor and its reflections fill the bottom fifth "
        "across the whole width.",
        ЧАСТИ["качество"],
    ])


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
        return {"_http": e.code,
                "_ошибка": e.read().decode("utf-8", "replace")[:600]}


def сделать(ключ, референсы):
    э = ЭКРАНЫ[ключ]
    тело = {"model": МОДЕЛЬ, "prompt": промпт(э), "aspect_ratio": "16:9",
            "resolution": "2K", "negative_prompt": ОТРИЦАНИЕ,
            "image": референсы, "image_urls": референсы}
    о = зов("/images/generations", тело)
    tid = (о.get("data") or {}).get("taskId") or о.get("taskId") or о.get("id")
    if not tid:
        print(ключ, "НЕ СОЗДАН:", json.dumps(о, ensure_ascii=False)[:300])
        return ""
    н = time.time()
    while time.time() - н < 900:
        time.sleep(6)
        с = зов("/images/generations?task_id=" + str(tid), метод="GET")
        д = с.get("data") or с
        сост = (д.get("state") or д.get("status") or "").lower()
        if сост in ("completed", "succeeded", "success"):
            url = (д.get("resultUrls") or [""])[0]
            print("%-6s готов за %3.0f с  %s" % (ключ, time.time() - н, url),
                  flush=True)
            return url
        if сост in ("failed", "error"):
            print(ключ, "ОШИБКА:", json.dumps(д, ensure_ascii=False)[:400])
            return ""
    print(ключ, "не дождались")
    return ""


if __name__ == "__main__":
    хочу = [к for к in sys.argv[1:] if к in ЭКРАНЫ] or list(ЭКРАНЫ)
    # Референсом идёт ФИНАЛЬНАЯ заставка: с неё берутся лицо, макияж,
    # сложение и фирменный свет. Без неё каждая карточка дала бы свою
    # девушку, и набор рассыпался бы.
    реф = [картинка_в_дата(os.path.join(ЗДЕСЬ, "..", "start",
                                        "заставка-16x9.jpg")),
           картинка_в_дата(os.path.join(ЗДЕСЬ, "..",
                                        "amberry-icon-512.png"))]
    итог = {}
    for к in хочу:
        u = сделать(к, реф)
        if u:
            итог[к] = u
    open(os.path.join(ЗДЕСЬ, "_адреса.json"), "w", encoding="utf-8").write(
        json.dumps(итог, ensure_ascii=False, indent=1))
    print(json.dumps(итог, ensure_ascii=False, indent=1))
