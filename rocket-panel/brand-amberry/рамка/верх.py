#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Верхняя полоса рамки: заголовок бренда, «бесплатно», ник со значком.

То же, что стоит в аутро, но теперь не в конце ролика, а сверху и весь
ролик (решение владельца 27.09.2026). Состав постоянный и меняться не
должен - это лицо продукта:

    РАЗДЕНЬ И ОЖИВИ ЛЮБОЕ ФОТО
    ПЕРВОЕ ФОТО БЕСПЛАТНО
    значок Telegram + @theamberrybot

    python3 верх.py [выход.png]
"""
import asyncio
import base64
import os
import sys

ТУТ = os.path.dirname(os.path.abspath(__file__))
БРЕНД = os.path.dirname(ТУТ)
ФОНТЫ = "/home/user/OKO-TEAM/.claude/skills/reels-machine/fonts"

ТГ_ЗНАК = ('<svg viewBox="0 0 496 512"><path fill="#2AABEE" d="M248 8C111 8 0 119 0 '
           '256s111 248 248 248 248-111 248-248S385 8 248 8zm121.8 169.9l-40.7 '
           '191.8c-3 13.6-11.1 16.9-22.4 10.5l-62-45.7-29.9 28.8c-3.3 3.3-6.1 '
           '6.1-12.5 6.1l4.4-63.1 114.9-103.8c5-4.4-1.1-6.9-7.7-2.5l-142 '
           '89.4-61.2-19.1c-13.3-4.2-13.6-13.3 2.8-19.7l239.1-92.2c11.1-4 '
           '20.8 2.7 17.2 19.5z"/></svg>')


def шрифт(имя):
    with open(os.path.join(ФОНТЫ, имя), "rb") as ф:
        return base64.b64encode(ф.read()).decode()


def разметка(ш, в):
    return ("<!doctype html><html lang=\"ru\"><head><meta charset=\"utf-8\"><style>"
            "@font-face{font-family:M9;src:url(data:font/ttf;base64,%s)}"
            "@font-face{font-family:M7;src:url(data:font/ttf;base64,%s)}"
            "*{margin:0;padding:0;box-sizing:border-box}"
            "html,body{width:%dpx;height:%dpx;background:transparent;"
            "display:flex;flex-direction:column;align-items:center;"
            "justify-content:center;gap:16px}"
            # Тёмных подложек нет - правило владельца. Читаемость держат
            # белое ядро буквы, розовая трубка по глифу и свечение.
            # Bebas Neue в бренде нет - карточка аутро набрана
            # Montserrat 900, и рамка обязана совпасть с ней, иначе у
            # продукта два разных лица.
            ".заг{font-family:M9,sans-serif;font-size:92px;line-height:.9;"
            "text-align:center;text-transform:uppercase;color:#fff;"
            "-webkit-text-stroke:4px rgba(255,10,140,.92);paint-order:stroke fill;"
            "text-shadow:0 0 10px #fff,0 0 30px #FF0A8C,0 0 70px #FF0A8C}"
            ".заг i{font-style:normal;color:#FF0A8C;-webkit-text-stroke:0;"
            "text-shadow:0 0 14px #FF0A8C,0 0 44px #FF0A8C}"
            ".бес{font-family:M9,sans-serif;font-size:42px;letter-spacing:2px;"
            "color:#fff;text-shadow:0 0 8px rgba(0,0,0,.8),0 0 22px #FF0A8C}"
            ".бес b{color:#9AFF00;text-shadow:0 0 10px #9AFF00,0 0 34px #9AFF00}"
            ".ник{display:flex;align-items:center;gap:12px;font-family:M7,sans-serif;"
            "font-size:40px;color:#fff;text-shadow:0 0 8px rgba(0,0,0,.75)}"
            ".ник svg{width:46px;height:46px;"
            "filter:drop-shadow(0 0 12px rgba(42,171,238,.9))}"
            "</style></head><body>"
            "<div class=\"заг\">Раздень <i>и&nbsp;оживи</i><br>любое фото</div>"
            "<div class=\"бес\">ПЕРВОЕ ФОТО <b>БЕСПЛАТНО</b></div>"
            "<div class=\"ник\">%s<span>@theamberrybot</span></div>"
            "</body></html>"
            % (шрифт("montserrat-v31-cyrillic_latin-900.ttf"),
               шрифт("montserrat-v31-cyrillic_latin-700.ttf"),
               ш, в, ТГ_ЗНАК))


async def _снять(html, выход, ш, в):
    from playwright.async_api import async_playwright
    врем = выход + ".html"
    with open(врем, "w", encoding="utf-8") as ф:
        ф.write(html)
    async with async_playwright() as p:
        бр = await p.chromium.launch(headless=True, args=["--no-sandbox"])
        к = await бр.new_context(viewport={"width": ш, "height": в},
                                 device_scale_factor=1)
        стр = await к.new_page()
        await стр.goto("file://" + os.path.abspath(врем), wait_until="load")
        await стр.wait_for_timeout(280)
        await стр.screenshot(path=выход, omit_background=True)
        await бр.close()
    os.remove(врем)
    return выход


def сделать(выход=None, ш=1080, в=470):
    выход = выход or os.path.join(ТУТ, "верх.png")
    return asyncio.run(_снять(разметка(ш, в), выход, ш, в))


if __name__ == "__main__":
    print(сделать(sys.argv[1] if len(sys.argv) > 1 else None))
