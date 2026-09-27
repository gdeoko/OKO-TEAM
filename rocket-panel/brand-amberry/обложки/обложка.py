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

        "The headline is pure white with a thin magenta %s outline traced "
        "around each glyph and a soft outer glow in the same colour, like a "
        "neon tube. The subheadline is lime %s. All text is horizontally centred. Letters "
        "must never overlap the woman's face. Text must never run off the "
        "edge of the frame: if a line is too long, set it smaller rather than "
        "cropping it. "
        "\n\n"
        "THE LOGO. Do NOT draw any logo, brand mark, icon, emblem or wordmark "
        "anywhere in this image. The first supplied reference image is shown "
        "to you only so you match the brand colours: the real mark is added "
        "afterwards, as an exact file, into the clean bottom band. A mark "
        "drawn by you would be a second, wrong logo in the same frame. "
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
        % (роз, вио, заголовок, подзаголовок, роз, лайм))


# ЗНАК И ПОДПИСЬ ВШИВАЮТСЯ КОДОМ, А НЕ РИСУЮТСЯ МОДЕЛЬЮ.
#
# Канон завода про текст внутри промпта остаётся: заголовок и подзаголовок
# модель пишет сама. Но знак бренда - отдельное правило («лого неизменно
# никогда»): нарисованный моделью, он похож, а не точен, и рядом с точным
# файлом даёт два лого в одном кадре. Значок Telegram по той же причине:
# узнаваемая форма, которую модель уверенно портит.
#
# Поэтому низ кадра генерится пустым, а сюда кодом ложатся настоящий знак
# и строка с ником.
ЗНАК = os.path.join(os.path.dirname(ТУТ), "amberry-icon-512-alpha.png")
ТГ_ЗНАК = ('<svg viewBox="0 0 496 512"><path fill="#2AABEE" d="M248 8C111 8 0 119 0 '
           '256s111 248 248 248 248-111 248-248S385 8 248 8zm121.8 169.9l-40.7 '
           '191.8c-3 13.6-11.1 16.9-22.4 10.5l-62-45.7-29.9 28.8c-3.3 3.3-6.1 '
           '6.1-12.5 6.1l4.4-63.1 114.9-103.8c5-4.4-1.1-6.9-7.7-2.5l-142 '
           '89.4-61.2-19.1c-13.3-4.2-13.6-13.3 2.8-19.7l239.1-92.2c11.1-4 '
           '20.8 2.7 17.2 19.5z"/></svg>')


def подпись(выход, ник="@theamberrybot", ш=1080, в=460):
    """Прозрачный PNG: знак, под ним значок Telegram и ник."""
    import asyncio
    import base64
    from playwright.async_api import async_playwright

    with open(ЗНАК, "rb") as ф:
        лого = "data:image/png;base64," + base64.b64encode(ф.read()).decode()
    шрифты = "/home/user/OKO-TEAM/.claude/skills/reels-machine/fonts"
    with open(os.path.join(шрифты, "montserrat-v31-cyrillic_latin-700.ttf"), "rb") as ф:
        м7 = base64.b64encode(ф.read()).decode()

    разметка = (
        "<!doctype html><html><head><meta charset=\"utf-8\"><style>"
        "@font-face{font-family:M7;src:url(data:font/ttf;base64,%s)}"
        "*{margin:0;padding:0;box-sizing:border-box}"
        "html,body{width:%dpx;height:%dpx;"
        # Мягкий градиент снизу, а не плашка: правило «тёмного нет нигде»
        # про наложения в РОЛИКЕ, где кадр движется. На обложке фигура
        # часто доходит до низа, и без градиента знак ложится прямо на
        # тело - так и вышло в первой пробе.
        "background:linear-gradient(to bottom,rgba(0,0,0,0) 0%%,"
        "rgba(0,0,0,.35) 26%%,rgba(0,0,0,.78) 58%%,rgba(0,0,0,.94) 100%%);"
        "display:flex;flex-direction:column;align-items:center;"
        "justify-content:flex-end;gap:16px;padding-bottom:30px}"
        ".знак{width:148px;height:148px;object-fit:contain;"
        # Знак стоит поверх кадра, и кадр под ним бывает светлым: без
        # плотной подложки из собственного свечения он теряется на коже.
        "filter:drop-shadow(0 0 18px rgba(0,0,0,.9)) "
        "drop-shadow(0 0 34px rgba(255,10,140,.85)) "
        "drop-shadow(0 0 70px rgba(255,10,140,.45))}"
        ".ник{display:flex;align-items:center;gap:14px;font-family:M7;"
        "font-size:46px;color:#fff;letter-spacing:.5px;"
        "text-shadow:0 0 10px rgba(0,0,0,.55),0 0 26px rgba(255,10,140,.5)}"
        ".ник svg{width:52px;height:52px;"
        "filter:drop-shadow(0 0 14px rgba(42,171,238,.85))}"
        "</style></head><body>"
        "<img class=\"знак\" src=\"%s\">"
        "<div class=\"ник\">%s<span>%s</span></div>"
        "</body></html>" % (м7, ш, в, лого, ТГ_ЗНАК, ник))

    async def снять():
        врем = выход + ".html"
        with open(врем, "w", encoding="utf-8") as ф:
            ф.write(разметка)
        async with async_playwright() as p:
            бр = await p.chromium.launch(headless=True, args=["--no-sandbox"])
            к = await бр.new_context(viewport={"width": ш, "height": в},
                                     device_scale_factor=1)
            стр = await к.new_page()
            await стр.goto("file://" + os.path.abspath(врем), wait_until="load")
            await стр.wait_for_timeout(260)
            await стр.screenshot(path=выход, omit_background=True)
            await бр.close()
        os.remove(врем)
        return выход

    return asyncio.run(снять())


def вшить_подпись(картинка, ник="@theamberrybot"):
    """Кладёт знак и ник в чистую нижнюю полосу готовой обложки."""
    п = подпись(картинка + ".подпись.png", ник)
    врем = картинка + ".свод.png"
    ffmpeg = "/usr/local/bin/ffmpeg" if os.path.exists("/usr/local/bin/ffmpeg") else "ffmpeg"
    subprocess.run([ffmpeg, "-y", "-hide_banner", "-loglevel", "error",
                    "-i", картинка, "-i", п,
                    "-filter_complex",
                    "[0:v]scale=1080:1920:force_original_aspect_ratio=increase,"
                    "crop=1080:1920[ф];[ф][1:v]overlay=0:H-h",
                    врем], check=True)
    os.replace(врем, картинка)
    os.remove(п)
    return картинка


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
            вшить_подпись(выход, ник)
            print("готово:", выход, os.path.getsize(выход), "байт",
                  "(знак и ник вшиты)", flush=True)
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
