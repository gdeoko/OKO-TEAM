#!/usr/bin/env python3
"""Аватарка лица в фирменном неоне БЕЗ пересборки лица.

Генерация портрета по описанию (даже с листом ракурсов референсом) даёт
ПОХОЖУЮ женщину, а не ту же: на аватарках Maria и Julia от 01.10.2026
лицо заметно разошлось с паспортом, и владелец их снял. Поэтому лицо не
рисуется заново - берётся готовый крупный план из листа ракурсов
(`основа-<лицо>.jpg`, центральная панель нижнего ряда, фас), и модель
меняет ТОЛЬКО свет, фон и одежду.

Лицо на основе уже по центру кадра: панель фаса симметрична, и кроп
берётся по её середине.

    python3 неон_на_аватарку.py мария юлия
"""
import base64
import json
import os
import subprocess
import sys
import time

КЛЮЧ = os.environ.get("APIMODELS_KEY", "")
БАЗА = "https://api.apimodels.app/v1"
МОДЕЛЬ = os.environ.get("AMBERRY_IMG_MODEL", "gpt-image-2")
ТУТ = os.path.dirname(os.path.abspath(__file__))

ПРОМПТ = """
Take the woman from the attached photograph and keep her EXACTLY as she is.
Same face, same bone structure, same eyes and eye colour, same nose, same
lips, same hair colour and hairstyle, same freckles, same skin tone, same
age, same expression. This is a photograph of one specific person and her
identity must survive untouched - do not beautify her, do not slim her face,
do not change her features, do not swap her for a prettier model.

CHANGE ONLY THE LIGHT, THE BACKGROUND AND THE TOP:

Background becomes pitch black (#07060A) with vertical neon tubes glowing far
behind her, heavily defocused into soft pink and violet bokeh, faint
volumetric haze catching the beams. Nothing else is in the background.

Lighting becomes the brand's: her FACE stays lit by a soft neutral beauty
light so the natural skin tone reads clearly, never washed in colour. The
neon works as EDGE light only - a hot pink #FF0A8C rim from behind her left
shoulder tracing the cheek, jaw and hair edge, and a violet #7A2BFF rim from
behind her right separating the silhouette from the darkness.

She wears a magenta satin top with a THIN STRAP CLEARLY VISIBLE over the
shoulder, so the shoulder never reads as bare. Tasteful and modest, fit for a
public profile picture.

FRAMING: square 1:1, tight head-and-shoulders crop, HER FACE EXACTLY IN THE
CENTRE of the frame - eyes on the horizontal middle line, equal space to the
left and to the right, cropped just below the collarbones. Leave the lowest
sixth of the frame calm and uncluttered.

Photographic quality: 8K, ultra sharp on the iris, real skin texture with
visible pores, cinematic neon grading, rich true blacks, no plastic
smoothing. Strictly no text, no letters, no watermark, no logo, no border,
no second person, no hands in frame.
""".strip()

ОТРИЦАНИЕ = ("different face, different woman, changed facial features, "
             "changed eye colour, changed hair colour, beautified face, "
             "slimmer face, younger face, extra text, watermark, logo, "
             "border, frame, collage, second person, bare shoulder, nudity")


def в_дата(путь):
    вид = "png" if путь.lower().endswith(".png") else "jpeg"
    with open(путь, "rb") as ф:
        return "data:image/%s;base64,%s" % (вид, base64.b64encode(ф.read()).decode())


def зов(аргументы, таймаут=180):
    р = subprocess.run(
        ["curl", "-s", "-m", str(таймаут), "-H", "Authorization: Bearer " + КЛЮЧ,
         "-H", "Content-Type: application/json"] + аргументы,
        capture_output=True, timeout=таймаут + 30)
    о = json.loads(р.stdout or b"{}")
    return о.get("data") or о


def сделать(кто):
    исход = os.path.join(ТУТ, "основа-%s.jpg" % кто)
    if not os.path.exists(исход):
        print("нет основы:", исход)
        return None
    кадр = в_дата(исход)
    тело = {"model": МОДЕЛЬ, "prompt": ПРОМПТ, "aspect_ratio": "1:1",
            "resolution": "2K", "negative_prompt": ОТРИЦАНИЕ,
            "image": [кадр], "image_urls": [кадр]}
    врем = "/tmp/neon-%s.json" % кто
    with open(врем, "w") as ф:
        json.dump(тело, ф)
    try:
        д = зов(["-X", "POST", БАЗА + "/images/generations", "-d", "@" + врем])
    finally:
        os.remove(врем)
    задача = д.get("taskId")
    if not задача:
        print("%s: задачу не приняли: %s" % (кто, str(д)[:200]))
        return None
    print("%s: задача %s" % (кто, задача), flush=True)
    было = ""
    до = time.time() + 900
    while time.time() < до:
        time.sleep(6)
        с = зов([БАЗА + "/images/generations?task_id=" + задача], 60)
        сост = (с.get("state") or "").lower()
        if сост != было:
            print("  %s ... %s" % (кто, сост), flush=True)
            было = сост
        ссылки = с.get("resultUrls") or []
        if ссылки:
            путь = os.path.join(ТУТ, "аватар-%s.jpg" % кто)
            subprocess.run(["curl", "-s", "-m", "180", "-o", путь, ссылки[0]],
                           check=True, timeout=200)
            print("  %s готово: %.0f КБ, %s кредита" % (
                кто, os.path.getsize(путь) / 1024, с.get("credits")), flush=True)
            return путь
        if сост in ("failed", "error"):
            print("  %s отказ: %s" % (кто, с.get("failMsg")))
            return None
    print("  %s не дождались" % кто)
    return None


if __name__ == "__main__":
    if not КЛЮЧ:
        raise SystemExit("нет APIMODELS_KEY")
    for к in sys.argv[1:] or ["мария"]:
        сделать(к)
