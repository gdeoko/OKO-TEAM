#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Обложка ролика: gpt-image-2, лого первым референсом, текст внутри промпта.

Канон завода (`НОРМЫ_ПРОИЗВОДСТВА`, раздел 1.35):

* движок **gpt-image-2**, не seedream: на кириллице seedream «дорисовывает
  похоже» и сыплет опечатки, а обложка это лицо ролика;
* промпт **от 3000 знаков**, на английском;
* **логотип первым референсом**, всегда;
* **весь текст обложки внутри промпта, в кавычках**. Наложение готовым
  слоем поверх картинки это брак: текст должен быть частью кадра;
* формат **9:16 всегда**, обложка ставится ПЕРВЫМ КАДРОМ ролика.

Референсом идёт ещё и кадр из самого ролика: поза и одежда на обложке
обязаны совпасть с тем, что внутри, иначе обложка обещает не то.

    python3 обложка.py <формат> <заголовок> <подзаголовок> [выход.png]
"""
import json
import os
import subprocess
import sys
import time

ТУТ = os.path.dirname(os.path.abspath(__file__))
БАЗА = "https://api.apimodels.app/v1"
МОДЕЛЬ = "gpt-image-2"

# Референсы уже выложены публично: API берёт их только ссылкой, не файлом.
ЛОГО = "https://okoteam.top/gen-ref/ref-logo-12569.png"
КАДРЫ = {
    "1": "https://okoteam.top/gen-ref/ref-f1-12569.jpg",
    "2": "https://okoteam.top/gen-ref/ref-f2-12570.jpg",
    "3": "https://okoteam.top/gen-ref/ref-f3-12570.jpg",
}

# Бренд: чёрный плюс розовый неон и лайм, Bebas Neue и Montserrat.
БРЕНД = ("#FF0A8C", "#7A2BFF", "#9AFF00")


def ключ():
    к = os.environ.get("APIMODELS_KEY", "")
    if к:
        return к
    import re
    путь = os.path.expanduser("~/OKO_MASTER_VAULT.md")
    if os.path.exists(путь):
        м = re.search(r"APIMODELS_KEY=(\S+)", open(путь, encoding="utf-8").read())
        if м:
            return м.group(1)
    return ""


def промпт(заголовок, подзаголовок, ник="@theamberrybot"):
    """Английский промпт от 3000 знаков. Текст внутри, в кавычках.

    Длина тут не прихоть: короткий промпт gpt-image-2 достраивает сам, и
    достраивает он стоковой рекламой. Каждая названная вещь - свет,
    материал, место надписи, чего в кадре быть не должно - это минус одна
    выдумка модели."""
    роз, вио, лайм = БРЕНД
    return (
        "Ultra-premium vertical 9:16 cover image for a short-form video, "
        "designed to stop the scroll in a social feed on a phone screen. "
        "This is a finished graphic design piece, not a photograph with text "
        "pasted on top: the typography and the image are one composition. "
        "\n\n"
        "COMPOSITION AND LAYOUT. The frame is divided by an invisible grid. "
        "The photographic subject occupies the lower two thirds of the frame, "
        "cropped so that her figure reads instantly at thumbnail size. The "
        "upper third is deliberate negative space, dark and uncluttered, "
        "reserved for the headline. A narrow strip along the very bottom, "
        "about eight percent of the height, is reserved for the handle. "
        "Nothing important touches the outer edges: keep a clean margin of at "
        "least five percent on every side, because feeds crop covers. "
        "\n\n"
        "THE SUBJECT. Use the supplied photograph of the woman as the visual "
        "reference for her appearance, pose, body and clothing: same face, "
        "same hair, same swimwear, same posture. She is standing confidently, "
        "seen from the front, calm and self-possessed. Photo-real skin with "
        "pores and fine texture, no plastic airbrushing, no beauty filter. "
        "She is lit from the side by a hard key light and rimmed from behind "
        "by a magenta glow, so her silhouette separates crisply from the "
        "background. Nothing revealing, nothing exposed: she is dressed "
        "exactly as in the reference and the image is suitable for a public "
        "feed. "
        "\n\n"
        "BACKGROUND AND LIGHT. Deep matte black studio void behind her, with "
        "a soft radial gradient of magenta %s bleeding up from the lower "
        "corners and a cooler violet %s haze in the upper corners. Fine film "
        "grain across the whole frame. A faint horizontal scanline texture, "
        "barely visible, suggesting a screen. Volumetric light haze around "
        "the rim light. No clutter, no props, no furniture, no windows. "
        "\n\n"
        "TYPOGRAPHY, AND THIS IS THE MOST IMPORTANT PART. Render the "
        "following Russian text EXACTLY as written, letter for letter, with "
        "correct Cyrillic glyphs and no invented characters, no misspellings, "
        "no Latin substitutions: "
        "\n"
        "Headline, set in a heavy condensed sans-serif in full capitals, "
        "occupying the upper third, two lines maximum, tightly leaded: "
        "\"%s\". "
        "\n"
        "Subheadline directly beneath it, in a lighter weight at roughly "
        "forty percent of the headline size, one line: \"%s\". "
        "\n"
        "Handle along the bottom strip, small, in a clean medium weight: "
        "\"%s\". "
        "\n"
        "The headline is pure white with a thin magenta %s outline traced "
        "around each glyph and a soft outer glow in the same colour, like a "
        "neon tube. The subheadline is lime %s. The handle is white at "
        "seventy percent opacity. All text is horizontally centred. Letters "
        "must never overlap the woman's face. Text must never run off the "
        "edge of the frame: if a line is too long, set it smaller rather than "
        "cropping it. "
        "\n\n"
        "THE LOGO. The first supplied reference image is the brand mark. "
        "Place it small in the upper left corner, at about nine percent of "
        "the frame width, exactly as supplied: do not redraw it, do not "
        "recolour it, do not stretch it, do not add a wordmark next to it, do "
        "not invent a different logo. Leave clean space around it. "
        "\n\n"
        "MOOD AND CRAFT. The overall feeling is premium, nocturnal, a little "
        "dangerous, closer to a film poster than to an advertisement. "
        "Commercial-grade retouching, deliberate colour grading, true blacks. "
        "\n\n"
        "STRICTLY AVOID: any text other than the three strings quoted above, "
        "watermarks, stock-photo look, cheap drop shadows behind the letters, "
        "dark boxes or plates behind the text, borders or frames around the "
        "image, collage layouts, additional people, extra limbs, extra "
        "fingers, deformed hands, distorted face, nudity, underwear, "
        "see-through fabric, emoji, arrows, badges, price tags, QR codes. "
        "Quality: 8K, ultra sharp, commercial poster grade."
        % (роз, вио, заголовок, подзаголовок, ник, роз, лайм))


def зов(аргументы, таймаут=90):
    р = subprocess.run(["curl", "-s", "-m", str(таймаут),
                        "-H", "Authorization: Bearer " + ключ(),
                        "-H", "Content-Type: application/json"] + аргументы,
                       capture_output=True, timeout=таймаут + 20)
    о = json.loads(р.stdout or b"{}")
    if о.get("code") not in (200, None):
        raise RuntimeError("APIMODELS: " + str(о)[:300])
    return о.get("data") or {}


def сделать(формат, заголовок, подзаголовок, выход=None, ник="@theamberrybot"):
    выход = выход or os.path.join(ТУТ, "обложка-формат%s.png" % формат)
    п = промпт(заголовок, подзаголовок, ник)
    print("промпт %d знаков (норма от 3000)" % len(п), flush=True)
    тело = {"model": МОДЕЛЬ, "prompt": п, "aspect_ratio": "9:16",
            "resolution": "2K", "quality": "high",
            # Лого ПЕРВЫМ, кадр из ролика вторым: порядок референсов - правило.
            "image_urls": [ЛОГО, КАДРЫ[str(формат)]]}
    д = зов(["-X", "POST", БАЗА + "/images/generations", "-d", json.dumps(тело)])
    задача = д.get("taskId") or д.get("task_id")
    if not задача:
        raise RuntimeError("задачу не приняли: " + str(д)[:300])
    print("задача", задача, flush=True)

    было = ""
    до = time.time() + 900          # gpt-image-2 в high отвечает до 9 минут
    while time.time() < до:
        д = зов([БАЗА + "/images/generations?task_id=" + задача], 40)
        сост = (д.get("state") or "").lower()
        if сост != было:
            print("  ...", сост or "(пусто)", flush=True)
            было = сост
        ссылки = д.get("resultUrls") or []
        if ссылки:
            subprocess.run(["curl", "-s", "-m", "180", "-o", выход, ссылки[0]],
                           check=True, timeout=200)
            print("готово:", выход, os.path.getsize(выход), "байт", flush=True)
            return выход
        if сост in ("failed", "error"):
            raise RuntimeError("отказ: " + str(д)[:300])
        time.sleep(5)
    raise RuntimeError("не дождались задачи " + задача)


if __name__ == "__main__":
    а = sys.argv[1:]
    if len(а) < 3:
        raise SystemExit(__doc__)
    сделать(а[0], а[1], а[2], а[3] if len(а) > 3 else None)
