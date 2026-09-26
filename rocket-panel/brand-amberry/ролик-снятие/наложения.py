#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Наложения поверх видео: живой интерфейс бота, прозрачным PNG.

Одной кнопки мало - по ней не понять, что это вообще кнопка и что
происходит. Здесь набор элементов, которые бот показывает клиенту
по-настоящему, и на каждый ролик из него собирается СВОЙ расклад:

    кнопка      кнопка бота, обычная и нажатая
    пузырь      сообщение бота с аватаркой, без фона чата
    работа      «Генерирую…» со счётчиком секунд и полосой
    цена        «1 коин = 1 фото» с монетой
    готово      зелёная галочка «Готово за 26 с»
    списано     «−1 коин», всплывает и тает

РАЗНООБРАЗИЕ - ПРАВИЛО, А НЕ УКРАШЕНИЕ. Лента, где каждый ролик
повторяет предыдущий наложениями, читается как штамповка с первого
десятка. Поэтому `расклад()` каждый раз выбирает другой набор, другие
места и другие секунды, отталкиваясь от имени файла: один и тот же
ролик собирается одинаково, разные - по-разному.

    python3 наложения.py <вид> <out.png> [текст] [состояние]
"""
import asyncio
import base64
import hashlib
import os
import random
import sys

ТУТ = os.path.dirname(os.path.abspath(__file__))
БРЕНД = os.path.dirname(ТУТ)
ФОНТЫ = "/home/user/OKO-TEAM/.claude/skills/reels-machine/fonts"
АВАТАР = os.path.join(БРЕНД, "amberry-avatar-256.png")
ЛОГО = os.path.join(БРЕНД, "amberry-icon-512-alpha.png")

РОЗ, ВИО, ЛАЙМ = "#FF0A8C", "#7A2BFF", "#9AFF00"


def b64(путь, mime):
    with open(путь, "rb") as ф:
        return "data:%s;base64,%s" % (mime, base64.b64encode(ф.read()).decode())


def шрифт(имя):
    with open(os.path.join(ФОНТЫ, имя), "rb") as ф:
        return base64.b64encode(ф.read()).decode()


ОБЩЕЕ = """
@font-face{font-family:M9;src:url(data:font/ttf;base64,__M9__)}
@font-face{font-family:M7;src:url(data:font/ttf;base64,__M7__)}
*{margin:0;padding:0;box-sizing:border-box}
:root{--roz:%s;--vio:%s;--lime:%s}
html,body{width:__Ш__px;height:__В__px;overflow:hidden;background:transparent;
  display:flex;align-items:center;justify-content:center}
/* Тёмного нигде нет - только свет: это правило владельца от 26.09.2026.
   Читаемость держат белое ядро буквы, цветное свечение и розовый контур. */
.св{color:#fff;-webkit-text-stroke:2px rgba(255,10,140,.9);paint-order:stroke fill;
  text-shadow:0 0 8px #fff,0 0 22px var(--roz),0 0 48px var(--roz)}
.стекло{background:linear-gradient(135deg,rgba(255,10,140,.42),rgba(122,43,255,.30));
  border:5px solid var(--roz);border-radius:26px;
  box-shadow:0 0 30px #ff0a8ccc,0 0 78px #ff0a8c77,inset 0 0 40px #ff0a8c44}
""" % (РОЗ, ВИО, ЛАЙМ)

ВИДЫ = {}

ВИДЫ["кнопка"] = ОБЩЕЕ + """
.э{padding:32px 60px;font-family:M7;font-size:52px;white-space:nowrap}
.э.нажата{box-shadow:0 0 40px #ff0a8cff,0 0 120px #ff0a8ccc,inset 0 0 60px #ff0a8c77;
  background:linear-gradient(135deg,rgba(255,10,140,.62),rgba(122,43,255,.42))}
"""

ВИДЫ["пузырь"] = ОБЩЕЕ + """
.э{display:flex;align-items:center;gap:22px;padding:26px 38px 26px 26px;
  font-family:M7;font-size:44px;max-width:__Ш__px;line-height:1.25}
.э img{width:84px;height:84px;border-radius:50%;flex:0 0 84px;
  box-shadow:0 0 24px #ff0a8c99}
"""

ВИДЫ["работа"] = ОБЩЕЕ + """
.э{display:flex;flex-direction:column;gap:18px;padding:28px 44px;font-family:M7;font-size:46px}
.стр{display:flex;align-items:center;gap:20px;white-space:nowrap}
.круг{width:48px;height:48px;border-radius:50%;border:6px solid rgba(255,255,255,.25);
  border-top-color:#fff;box-shadow:0 0 18px var(--roz)}
.пол{height:12px;border-radius:8px;background:rgba(255,255,255,.18);overflow:hidden;
  box-shadow:inset 0 0 14px #ff0a8c55}
.пол i{display:block;height:100%;width:__ДОЛЯ__%;
  background:linear-gradient(90deg,var(--roz),var(--vio));box-shadow:0 0 22px var(--roz)}
"""

ВИДЫ["цена"] = ОБЩЕЕ + """
.э{display:flex;align-items:center;gap:20px;padding:26px 46px;font-family:M9;font-size:50px;
  white-space:nowrap}
.э img{width:66px;height:66px}
.э b{color:#fff;-webkit-text-stroke:2px rgba(154,255,0,.9);
  text-shadow:0 0 8px #fff,0 0 22px var(--lime),0 0 46px var(--lime)}
"""

ВИДЫ["готово"] = ОБЩЕЕ + """
.э{display:flex;align-items:center;gap:20px;padding:26px 46px;font-family:M7;font-size:46px;
  white-space:nowrap;border-color:var(--lime);
  background:linear-gradient(135deg,rgba(154,255,0,.26),rgba(122,43,255,.22));
  box-shadow:0 0 30px #9aff00cc,0 0 78px #9aff0066,inset 0 0 40px #9aff0033}
.э .г{font-size:56px;color:#fff;-webkit-text-stroke:2px rgba(154,255,0,.9);
  text-shadow:0 0 8px #fff,0 0 24px var(--lime)}
"""

ВИДЫ["списано"] = ОБЩЕЕ + """
.э{display:flex;align-items:center;gap:16px;padding:20px 38px;font-family:M9;font-size:52px;
  white-space:nowrap}
.э img{width:58px;height:58px}
"""


def html(вид, текст="", состояние="", ш=760, в=200, доля=62):
    стиль = (ВИДЫ[вид].replace("__M9__", шрифт("montserrat-v31-cyrillic_latin-900.ttf"))
             .replace("__M7__", шрифт("montserrat-v31-cyrillic_latin-700.ttf"))
             .replace("__Ш__", str(ш)).replace("__В__", str(в))
             .replace("__ДОЛЯ__", str(доля)))
    монета = ('<img src="%s">' % b64(ЛОГО, "image/png"))
    нутро = {
        "кнопка": '<div class="э стекло св %s">%s</div>' % (состояние, текст),
        "пузырь": '<div class="э стекло св"><img src="%s"><span>%s</span></div>'
                  % (b64(АВАТАР, "image/png"), текст),
        "работа": '<div class="э стекло св"><div class="стр"><div class="круг"></div>'
                  '<span>%s</span></div><div class="пол"><i></i></div></div>' % текст,
        "цена": '<div class="э стекло св">%s<span>%s</span></div>' % (монета, текст),
        "готово": '<div class="э стекло св"><span class="г">✓</span><span>%s</span></div>' % текст,
        "списано": '<div class="э стекло св">%s<span>%s</span></div>' % (монета, текст),
    }[вид]
    return ('<!doctype html><html lang="ru"><head><meta charset="utf-8">'
            '<style>%s</style></head><body>%s</body></html>' % (стиль, нутро))


async def _снять(разметка, выход, ш, в):
    from playwright.async_api import async_playwright
    врем = выход + ".html"
    with open(врем, "w", encoding="utf-8") as ф:
        ф.write(разметка)
    async with async_playwright() as p:
        бр = await p.chromium.launch(headless=True, args=["--no-sandbox",
             "--force-color-profile=srgb", "--disable-lcd-text"])
        к = await бр.new_context(viewport={"width": ш, "height": в}, device_scale_factor=1)
        стр = await к.new_page()
        await стр.goto("file://" + os.path.abspath(врем), wait_until="load")
        await стр.wait_for_timeout(260)
        await стр.screenshot(path=выход, omit_background=True)
        await бр.close()
    os.remove(врем)
    return выход


def сделать(вид, выход, текст="", состояние="", ш=760, в=200, доля=62):
    return asyncio.run(_снять(html(вид, текст, состояние, ш, в, доля), выход, ш, в))


# Что бот говорит на самом деле - эти строки живут в его коде.
ПУЗЫРИ = ["Пришли снимок — сделаю фото",
          "Что делаем?",
          "Готово. Смотри, что вышло",
          "Один коин — одно фото"]
ЦЕНЫ = ["1 коин = 1 фото", "5 коинов = ролик 5 с", "Первое — бесплатно"]
РАБОТЫ = ["Генерирую… 0:07", "Генерирую… 0:14", "Считаю на карте…"]
ГОТОВО = ["Готово за 26 с", "Готово", "Кадр принят"]
КНОПКИ = [("Раздеть", "Соло"), ("Раздеть", "Своё фото"), ("Видео", "Соло"),
          ("Раздеть", "Групповое")]


def расклад(семя, до_мути):
    """Свой набор наложений на каждый ролик. Семя - имя файла: один и тот
    же ролик собирается одинаково, разные - по-разному."""
    сл = random.Random(hashlib.sha1(str(семя).encode()).hexdigest())
    пара = сл.choice(КНОПКИ)
    набор = [
        {"вид": "кнопка", "текст": пара[0], "нажатие": True},
        {"вид": "кнопка", "текст": пара[1], "нажатие": True},
    ]
    лишние = сл.sample(["пузырь", "работа", "цена", "готово", "списано"],
                       сл.choice([1, 2]))
    for в_ in лишние:
        набор.append({"вид": в_, "текст": {
            "пузырь": сл.choice(ПУЗЫРИ), "работа": сл.choice(РАБОТЫ),
            "цена": сл.choice(ЦЕНЫ), "готово": сл.choice(ГОТОВО),
            "списано": "−1 коин"}[в_], "нажатие": False})
    сл.shuffle(набор)

    # Раскладываем по времени встык, с паузами, и по высоте - в нижней
    # трети, но не всегда на одном месте: лента не должна узнавать кадр.
    доля = до_мути / max(1, len(набор))
    места = [0.60, 0.66, 0.72, 0.55]
    сл.shuffle(места)
    for i, э in enumerate(набор):
        н = i * доля + доля * 0.10
        э["вход"] = round(н, 2)
        э["уход"] = round(min(до_мути, н + доля * 0.78), 2)
        э["нажат_в"] = round(н + доля * 0.40, 2)
        э["y"] = места[i % len(места)] + сл.uniform(-0.02, 0.02)
    return набор


if __name__ == "__main__":
    а = sys.argv[1:]
    if len(а) < 2:
        raise SystemExit(__doc__)
    print(сделать(а[0], а[1], а[2] if len(а) > 2 else "",
                  а[3] if len(а) > 3 else ""))
