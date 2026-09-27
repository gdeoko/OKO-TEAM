#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Блок «знак + название» для нижней части рамки.

Почему знак и название рисуются здесь, а не берутся из заставки: в
заставке они вплавлены в неоновый фон, и вырезка либо тащит фон за
собой, либо съедает слово AMBERRY целиком (так и вышло 27.09.2026 -
знак остался, названия под ним не было).

Поэтому из видео берётся ТОЛЬКО девушка, а знак с названием ставятся
отдельным слоем: настоящий файл знака, ровные пропорции, неон как в
заголовке сверху - у продукта одно лицо.

    python3 лого.py [выход.png]
"""
import asyncio
import base64
import os
import sys

ТУТ = os.path.dirname(os.path.abspath(__file__))
БРЕНД = os.path.dirname(ТУТ)
ФОНТЫ = "/home/user/OKO-TEAM/.claude/skills/reels-machine/fonts"
# Правило владельца: лого только настоящее, в base64, пропорции не трогать.
ЗНАК = os.path.join(БРЕНД, "amberry-icon-512-alpha.png")


def _b64(путь):
    with open(путь, "rb") as ф:
        return base64.b64encode(ф.read()).decode()


def разметка(ш, в, знак_px, кегль):
    return ("<!doctype html><html lang=\"ru\"><head><meta charset=\"utf-8\"><style>"
            "@font-face{font-family:M9;src:url(data:font/ttf;base64,%s)}"
            "*{margin:0;padding:0;box-sizing:border-box}"
            "html,body{width:%dpx;height:%dpx;background:transparent;"
            "display:flex;flex-direction:column;align-items:center;"
            "justify-content:center;gap:%dpx}"
            ".знак{width:%dpx;height:%dpx;object-fit:contain;"
            "filter:drop-shadow(0 0 18px rgba(255,10,140,.85))"
            " drop-shadow(0 0 46px rgba(255,10,140,.55))}"
            # Тот же неон, что у заголовка сверху: белое ядро буквы,
            # розовая трубка по глифу, свечение наружу.
            ".имя{font-family:M9,sans-serif;font-size:%dpx;line-height:1;"
            "letter-spacing:%dpx;text-indent:%dpx;color:#fff;text-transform:uppercase;"
            "-webkit-text-stroke:3px rgba(255,10,140,.92);paint-order:stroke fill;"
            "text-shadow:0 0 8px #fff,0 0 26px #FF0A8C,0 0 60px #FF0A8C}"
            "</style></head><body>"
            "<img class=\"знак\" src=\"data:image/png;base64,%s\">"
            "<div class=\"имя\">Amberry</div>"
            "</body></html>"
            % (_b64(os.path.join(ФОНТЫ, "montserrat-v31-cyrillic_latin-900.ttf")),
               ш, в, max(6, кегль // 6), знак_px, знак_px,
               кегль, кегль // 8, кегль // 8, _b64(ЗНАК)))


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


def сделать(выход=None, ш=520, в=474, знак_px=286, кегль=66):
    выход = выход or os.path.join(ТУТ, "лого.png")
    return asyncio.run(_снять(разметка(ш, в, знак_px, кегль), выход, ш, в))


if __name__ == "__main__":
    print(сделать(sys.argv[1] if len(sys.argv) > 1 else None))
