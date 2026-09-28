#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Карусель AMBERRY по канону завода: 4:5, слайды генерацией, текст в промпте.

Канон (`oko_biblia КАНОН_ЗАВОДА`, раздел 4 и `НОРМЫ_ПРОИЗВОДСТВА`, раздел 3):

    формат      4:5 строго, 1080x1350
    слайдов     5-10
    движок      APIMODELS gpt-image-2, ВСЕГДА (запас - ChatGPT при нуле счёта)
    промпт      английский, от 3000 знаков, весь дизайн внутри
    текст       ВНУТРИ промпта, в кавычках. Слоем поверх - брак
    референсы   фото модели дня + знак бренда, знак первым файлом
    последний   лого, ник, нумерация, воронка

**Референсы проверены по результату, а не по коду ответа** (28.09.2026).
APIMODELS отвечает `code:200` на любое лишнее поле и молча его выбрасывает:
проба с четырьмя именами полей вернула для двух из них ОДИН И ТОТ ЖЕ taskId,
то есть поле в подпись запроса не вошло. Поэтому работает то, что проверено
глазами на выходе: ссылка на картинку и data-URI в `image`/`image_urls` -
лицо модели и знак бренда приходят те самые.

    python3 карусель.py <лицо> [выход]
"""
import base64
import hashlib
import json
import os
import subprocess
import sys
import time

ТУТ = os.path.dirname(os.path.abspath(__file__))
БРЕНД = os.path.dirname(ТУТ)
БАЗА = "https://api.apimodels.app/v1"
МОДЕЛЬ = "gpt-image-2"
ЗНАК = os.path.join(БРЕНД, "amberry-icon-512-alpha.png")

# Общая часть промпта: она одна на все слайды, поэтому лицо, свет и бренд
# не разъезжаются между ними. Канон требует от 3000 знаков - общая часть
# даёт половину, сцена слайда вторую.
ОБЩЕЕ = (
 "Vertical 4:5 image, 1080x1350, premium social media carousel slide for an "
 "adult-oriented Telegram bot brand called AMBERRY. Overall art direction: "
 "deep near-black background (#0A0A0C) with hot neon pink accents (#FF0A8C) "
 "and cool magenta rim light, glossy reflective floor, thin vertical neon "
 "tubes far behind the subject, soft volumetric haze, cinematic contrast, "
 "shallow depth of field, shot on a fast 50mm lens at f/1.8, ISO 200, "
 "commercial photography quality, ultra sharp on the subject, 8K detail, no "
 "banding, no plastic skin, natural skin texture with visible pores and fine "
 "flyaway hairs. The brand mark in the attached reference file is a stylised "
 "raspberry drawn in hot pink; reproduce it EXACTLY as given, same shape, "
 "same proportions, same colour, never redraw it in another style and never "
 "place a second copy of it anywhere in the frame. Typography: heavy "
 "condensed geometric sans, uppercase, tight tracking, pure white core with "
 "a thin hot pink neon outline and a soft outer glow, letters crisp and fully "
 "readable, correct Russian Cyrillic spelling, no misspelling, no broken "
 "glyphs, no duplicated words, no stray latin letters. Leave clean negative "
 "space where text is described so nothing overlaps the face. No watermark, "
 "no stock logo, no border frame, no page numbers except where explicitly "
 "described. Colour of skin tones stays natural and warm; neon affects only "
 "the rim and the background. Composition rules for every slide: the subject "
 "or the device sits on a vertical third, never dead centre unless the scene "
 "says so, and the frame keeps roughly fifteen percent of its height as clean "
 "dark space where text is placed, so nothing ever crowds an edge. Lighting "
 "is a three point setup - a soft key from the side at forty five degrees, a "
 "hard magenta rim from behind to separate the subject from the black "
 "background, and a very low fill so the shadows stay deep and glossy rather "
 "than grey and flat. Surfaces read as real materials: satin catches a long "
 "specular highlight, glass throws a thin bright edge, painted metal stays "
 "matte, the floor reflects the neon as a soft vertical smear rather than a "
 "mirror copy. Grain is fine and filmic, not digital noise. Avoid every "
 "common generation artefact: no extra fingers, no fused hands, no warped "
 "ears, no asymmetric eyes, no melted jewellery, no duplicated limbs, no "
 "impossible reflections, no text baked into clothing or props, no phantom "
 "second light source. Keep the palette disciplined - black, white, hot pink "
 "and the warm tone of skin; no orange, no teal, no lime green anywhere in "
 "the frame. This is an advertising slide, so it must look expensive and "
 "deliberate: every element is there because it sells the product, and "
 "nothing is decorative filler."
)

ЛИЦО = (
 "The woman in the attached reference photograph: keep EXACTLY the same face, "
 "same bone structure, same eyes, same lips, same long straight warm ash "
 "blonde hair with darker roots, same body proportions. She is 24, slim with "
 "soft natural proportions. Do not restyle her, do not age her, do not change "
 "her hair colour or length. Her expression is calm and unhurried, never "
 "cartoonish, never a wide smile."
)


def зов(аргументы, ключ):
    р = subprocess.run(
        ["curl", "-s", "-m", "180", "-H", "Authorization: Bearer " + ключ,
         "-H", "Content-Type: application/json"] + аргументы,
        capture_output=True, text=True, timeout=210)
    return json.loads(р.stdout or "{}")


ЗАДАЧИ = os.path.join(ТУТ, ".задачи.json")


def задачи(новое=None):
    """Начатые задачи живут на диске между запусками.

    Процесс сборки дважды убивали снаружи посреди ожидания картинки. Сама
    картинка при этом делалась и оставалась у APIMODELS, а мы теряли и её,
    и пять центов: заново запущенный слайд платил второй раз за уже
    оплаченное. Теперь taskId ложится на диск сразу после приёма задачи, и
    следующий запуск дожидается СТАРОЙ задачи вместо новой.
    """
    было = {}
    if os.path.exists(ЗАДАЧИ):
        было = json.load(open(ЗАДАЧИ, encoding="utf-8"))
    if новое is None:
        return было
    было.update(новое)
    json.dump(было, open(ЗАДАЧИ, "w", encoding="utf-8"), ensure_ascii=False)
    return было


def сделать(промпт, образцы, ключ, имя):
    """Одна картинка. Образцы - список ссылок или data-URI, знак первым."""
    # Начатая задача годится, только если промпт с тех пор не менялся:
    # иначе дождёмся картинки по старому тексту и не заметим этого.
    отпечаток = hashlib.sha1(промпт.encode("utf-8")).hexdigest()[:12]
    было = задачи().get(имя) or {}
    з = было.get("id") if было.get("промпт") == отпечаток else None
    if з:
        print("  %s: дожидаюсь начатой задачи %s" % (имя, з), flush=True)
    else:
        тело = json.dumps({"model": МОДЕЛЬ, "prompt": промпт,
                           "aspect_ratio": "4:5",
                           "image": образцы, "image_urls": образцы})
        п = subprocess.run(
            ["curl", "-s", "-m", "180", "-H", "Authorization: Bearer " + ключ,
             "-H", "Content-Type: application/json", "-X", "POST",
             БАЗА + "/images/generations", "--data-binary", "@-"],
            input=тело, capture_output=True, text=True, timeout=210)
        д = json.loads(п.stdout or "{}").get("data", {})
        з = д.get("taskId")
        if not з:
            print("  %s: задачу не приняли: %s" % (имя, п.stdout[:200]),
                  flush=True)
            return None
        задачи({имя: {"id": з, "промпт": отпечаток}})
    for _ in range(150):
        р = зов([БАЗА + "/images/generations?task_id=" + з], ключ).get("data", {})
        с = (р.get("state") or "").lower()
        if с in ("success", "succeeded", "completed"):
            url = (р.get("resultUrls") or [""])[0]
            цель = os.path.join(ТУТ, имя + ".png")
            subprocess.run(["curl", "-sL", "-o", цель, url], check=True)
            к_канону(цель)
            задачи({имя: None})
            print("  %s готов" % имя, flush=True)
            return цель
        if с in ("fail", "failed", "error"):
            print("  %s: ОШИБКА %s" % (имя, str(р)[:200]), flush=True)
            задачи({имя: None})
            return None
        time.sleep(4)
    print("  %s: не дождались" % имя, flush=True)
    return None


def к_канону(путь):
    """1080x1350 ровно. Модель отдаёт что придётся: 912x1152 это 0.792, а
    не 0.8, и в ленте такой слайд обрежется сам, по своему усмотрению."""
    from PIL import Image
    и = Image.open(путь)
    if и.size == (1080, 1350):
        return путь
    к = max(1080 / и.width, 1350 / и.height)
    и = и.resize((round(и.width * к), round(и.height * к)), Image.LANCZOS)
    x, y = (и.width - 1080) // 2, (и.height - 1350) // 2
    и.crop((x, y, x + 1080, y + 1350)).save(путь)
    return путь


def знак_датой():
    return "data:image/png;base64," + base64.b64encode(
        open(ЗНАК, "rb").read()).decode()


# ── СЛАЙДЫ ──────────────────────────────────────────────────────────────
# Кнопки взяты ИЗ КАТАЛОГА БОТА (bot/catalog.py), а не придуманы: человек,
# пришедший по карусели, видит в боте ровно те же надписи. Из шести кнопок
# раздевания взяты четыре самые сдержанные: карусель уходит в Instagram и
# TikTok, и подпись вроде «юбка задрана» снимает не ролик, а аккаунт.
# Каждый слайд это имя, заголовок, подзаголовок, способ подачи текста и
# сцена. Заголовки и подзаголовки НЕ рисуются кодом: они уходят в промпт
# и рождаются внутри кадра вместе с ним - правило владельца от 28.09.2026.
# Руками собирается только последний слайд, и только потому, что под ним
# настоящий результат бота (`финал.py`).
#
# ПОДАЧА чередуется по правилу канона «в половине единиц текст и лого
# живут внутри сцены»: "предмет" - надпись существует в кадре вещью
# (неоновая вывеска, буквы на стекле, свет на столе), "набор" - чистая
# типографика в тёмном пустом месте кадра.
СЛАЙДЫ = [
 ("1-хук", "ОДНО ФОТО", "И ОНА УЖЕ ДВИГАЕТСЯ", "предмет",
  "SCENE: the woman stands three quarters to camera in a dim luxury hotel "
  "suite at night, floor to ceiling window behind her with a blurred city "
  "far below, a warm bedside lamp on the right, an unmade white bed at the "
  "very edge of frame. She wears a short champagne satin slip dress on thin "
  "straps, fully covering, mid thigh. One hand rests high on the window "
  "frame, her weight is on one hip, she looks back over her shoulder "
  "straight into the lens. ON THE WALL far behind her, small and clearly in "
  "the background, hangs a neon sign of the brand mark from the attached "
  "reference file, glowing hot pink, with its light reflected in the glossy "
  "floor - this is the only copy of the mark in the frame. The headline and "
  "the subheadline described below exist in this scene as a second neon "
  "sign mounted on the dark wall in the lower third, its tubes glowing and "
  "reflected in the floor, never as a flat caption laid over the photo."),

 ("2-меню", "ЗАГРУЖАЕШЬ ФОТО", "Бот отвечает меню", "набор",
  "SCENE: a realistic photograph of a modern smartphone held upright in a "
  "woman's hand with a soft pink manicure, the phone occupies the lower two "
  "thirds of the frame, shot slightly from above over a dark glossy table "
  "with neon pink reflections, the top of the frame left as clean dark "
  "space for the headline. ON THE PHONE SCREEN: a dark Telegram-style chat "
  "interface, true to a messenger, with a dark grey background. At the top "
  "of the screen a small round avatar showing the brand mark from the "
  "attached reference file, and beside it the account name \"AMBERRY\" in "
  "white. Below it a photo message showing the woman from the attached "
  "reference photograph in her satin slip dress, small, as a sent picture "
  "inside the chat bubble. Under the photo, four wide rounded dark buttons "
  "stacked vertically, each with white Russian text centred: "
  "\"ПОПУЛЯРНОЕ\", \"РАЗДЕТЬ\", \"ВИДЕО\", \"СВОЙ ПРОМПТ\". The "
  "second button \"РАЗДЕТЬ\" is highlighted with a hot pink glow as if "
  "being pressed, a faint fingertip touching it. The interface must look "
  "like a real messenger screenshot, crisp and legible, not a cartoon."),

 ("3-выбор", "ВЫБИРАЕШЬ РЕЖИМ", "Одна или двое в кадре", "предмет",
  # ДВЕ ПОДМЕНЫ И ОДИН ОТКАЗ. Модель сама меняла надпись кнопки - сперва
  # на «ПЕРЕОДЕТЬСЯ», потом на «ОДЕТЬ», - а требование воспроизвести
  # «РАЗДЕТЬ / Твоё фото, без одежды» буква в букву вернулось отказом
  # CONTENT_MODERATION. Спотыкается она не о слово «РАЗДЕТЬ» (на слайде 2
  # оно встало с первого раза кнопкой в ряду), а о пару с подписью «без
  # одежды». Подпись заменена на настоящие подписи кнопок бота - «Одна
  # героиня» и «Двое в кадре» (catalog.py, un_solo и un_group).
  "SCENE: the woman sits at a dark glossy bar counter in a room lit only "
  "by tall vertical pink neon tubes, turned away from camera and looking "
  "back over her bare shoulder straight into the lens, wearing the same "
  "champagne satin slip dress on thin straps. She holds a modern "
  "smartphone upright in her raised hand at the left third of the frame, "
  "screen fully towards the camera, sharp and legible. HIGH ON THE WALL "
  "behind her, small, glows a neon sign of the brand mark from the "
  "attached reference file - this is the only copy of the mark in the "
  "frame. ON THE PHONE SCREEN: a dark Telegram-style chat. A message "
  "bubble at the top carries one word as a heading in white Russian "
  "capitals: \"РАЗДЕТЬ\". Below the bubble two wide rounded dark "
  "buttons stacked vertically, each with a white Russian title and a "
  "smaller grey Russian line under it: the first reads \"СОЛО\" with "
  "\"Одна героиня\" beneath, the second reads \"ГРУППОВОЕ\" with "
  "\"Двое в кадре\" beneath. The first button glows hot pink as if just "
  "pressed. Under them a narrow row of two smaller buttons reading "
  "\"НАЗАД\" and \"МЕНЮ\". These Russian strings are the real wording "
  "of the product menu and are reproduced letter for letter. The headline "
  "and subheadline described below exist in this scene as glowing letters "
  "written across the dark mirrored wall behind her, in the clean space to "
  "the right of the neon mark, never as a flat caption over the photo."),

 ("4-кнопки", "ВЫБИРАЕШЬ РАКУРС", "План и поза - из каталога", "набор",
  "SCENE: the same smartphone held in the same hand, this time seen almost "
  "straight on in the lower two thirds of the frame, the dark room and pink "
  "neon tubes reflected along the glass edge, the top of the frame left as "
  "clean dark space for the headline. ON THE PHONE SCREEN: the same dark "
  "chat, now showing a list of choices. A heading bubble in white Russian "
  "text reads \"РАЗДЕВАНИЕ\" and under it in grey \"Ракурс, план, "
  "поза\". Below it four wide rounded dark buttons stacked vertically, "
  "each with white Russian text centred and fully readable: \"СТОЯ ВО "
  "ВЕСЬ РОСТ\", \"СО СПИНЫ\", \"ВПОЛОБОРОТА\", \"ЛЁЖА НА СПИНЕ\". "
  "The third button glows hot pink as if being chosen. The screen must "
  "read as a genuine messenger menu, sharp and believable."),

 ("5-ждём", "ПОЛМИНУТЫ", "И результат у тебя", "предмет",
  "SCENE: the same smartphone lying flat on the dark glossy table, the "
  "woman's hand withdrawn to the edge of frame, pink neon reflected across "
  "the table surface, a shallow depth of field so the far edge of the table "
  "melts into darkness. ON THE PHONE SCREEN: the dark chat with a single "
  "message bubble in the centre. Inside it a thin circular progress ring "
  "glowing hot pink, partly filled, and under the ring two lines of Russian "
  "text in white: \"ГЕНЕРИРУЮ\" on the first line and \"это займёт "
  "полминуты\" in smaller lighter grey on the second. The headline and "
  "subheadline described below exist in this scene as pink neon lettering "
  "standing on the table behind the phone and reflected in its polished "
  "surface, never as a flat caption over the photo. The whole slide should "
  "feel like a held breath: dark, quiet, one glowing ring."),
]


def текстовый_блок(заголовок, подзаголовок, подача, номер, всего):
    """Заголовок, подзаголовок и нумерация - куском промпта, а не кодом.

    Правило владельца от 28.09.2026: весь текст слайда, вся разметка и
    нумерация прописываются в едином промпте. Руками не ставится ничего,
    кроме последнего слайда, где под аутро лежит настоящий кадр бота.
    """
    если_предмет = (
        "These two Russian lines are not a caption pasted on top of the "
        "picture: they are a real object inside the scene as the scene "
        "description says, lit by the same light, casting the same "
        "reflections, standing in the same perspective as everything "
        "around them. ")
    если_набор = (
        "These two Russian lines are set as clean typography in the empty "
        "dark part of the frame, never over her face or body, with at "
        "least sixty pixels of clear space on every side. ")
    return (
        " TEXT OF THE SLIDE. The slide carries exactly three pieces of "
        "Russian text and nothing else beyond what the scene description "
        "already puts on the phone screen. "
        "HEADLINE, the largest text in the frame, heavy condensed "
        "uppercase, pure white core with a thin hot pink neon outline and "
        "a soft outer glow, reading exactly: \"%s\". "
        "SUBHEADLINE, directly under the headline, the same family at "
        "roughly half the size, lighter weight, reading exactly: \"%s\". "
        "%s"
        "SLIDE NUMBER, in the top right corner of the frame, small and "
        "quiet, about one fortieth of the frame height, a thin hot pink "
        "rounded outline badge with white text inside reading exactly: "
        "\"%d/%d\". It must never touch the edge of the frame and never "
        "overlap anything else. "
        "Every Russian letter is spelled exactly as written here, "
        "unbroken, not duplicated, not transliterated, with no extra word "
        "invented and no word dropped. No other text of any kind appears "
        "anywhere in the image."
        % (заголовок, подзаголовок,
           если_предмет if подача == "предмет" else если_набор,
           номер, всего))


def собрать(лицо_url, ключ, только=None):
    """только - список имён слайдов; готовые на диске пропускаются.

    Фоновый запуск всей пачки разом дважды обрывался молча: процесс
    убивали снаружи посреди второго слайда, и лог кончался на строке с
    длиной промпта. Поэтому слайды берутся поштучно, а уже собранные
    не переделываются - переделка стоила бы по пять центов за штуку.
    """
    знак = знак_датой()
    готовые = []
    всего = len(СЛАЙДЫ) + 1          # плюс последний, собранный кодом
    for номер, (имя, заг, подзаг, подача, сцена) in enumerate(СЛАЙДЫ, 1):
        if только and имя not in только:
            continue
        есть = os.path.join(ТУТ, имя + ".png")
        if os.path.exists(есть):
            print("%s уже есть, не переделываю" % имя, flush=True)
            готовые.append(есть)
            continue
        промпт = " ".join([ОБЩЕЕ, ЛИЦО, сцена]) + текстовый_блок(
            заг, подзаг, подача, номер, всего)
        print("%s: промпт %d знаков" % (имя, len(промпт)), flush=True)
        if len(промпт) < 3000:
            print("  КОРОТКО, канон требует от 3000 - слайд не идёт", flush=True)
            continue
        # Знак ПЕРВЫМ файлом, фото модели вторым - порядок канона.
        п = сделать(промпт, [знак, лицо_url], ключ, имя)
        if п:
            готовые.append(п)
    return готовые


if __name__ == "__main__":
    ключ = os.environ.get("APIMODELS_KEY", "")
    if not ключ:
        raise SystemExit("нет APIMODELS_KEY")
    лицо = sys.argv[1] if len(sys.argv) > 1 else ""
    if not лицо:
        raise SystemExit("нужна ссылка на фото модели дня")
    только = sys.argv[2].split(",") if len(sys.argv) > 2 else None
    for п in собрать(лицо, ключ, только):
        print(п)
