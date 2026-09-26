#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Наложения Формата 2: финальная карточка и кнопки бота. Прозрачный PNG.

Формат 2 складывает ffmpeg, а не браузер: Chromium не пишет видео с
альфой, и запись играющего мутного кадра 1080x1920 в headless теряет
кадры. Но ОДИН кадр с прозрачностью он снимает прекрасно
(`omit_background`), поэтому вид карточки живёт здесь в HTML и CSS - там
же, где он живёт у Формата 1, - а не переписывается второй раз на PIL.
Разойдутся два описания одного и того же - разойдётся и вид.

    python3 карточка.py карточка out.png "ПРОДОЛЖЕНИЕ В БОТЕ"
    python3 карточка.py кнопка   out.png "Раздеть" [горячая|нажата]

СОСТАВ КАРТОЧКИ ПОСТОЯНЕН и меняться не должен: лого, «РАЗДЕНЬ И ОЖИВИ
ЛЮБОЕ ФОТО», «ПЕРВОЕ ФОТО БЕСПЛАТНО», значок Telegram с ником, призыв.
Разный в ней ровно один элемент - призыв.

ФОНА У КАРТОЧКИ НЕТ. Под ней продолжает двигаться мутный силуэт, и это
половина смысла: ролик не обрывается стоп-кадром, видно, что там что-то
происходит. Читаемость даёт не фон, а затемнение к низу и неоновая
обводка букв - то же решение, что в `../цензура/замутить.py`.

БЛОК СТОИТ В ЦЕНТРЕ. Решение владельца 26.09.2026: в середине кадра
карточка закрывает собой ещё часть того, что показывать нельзя, то есть
работает второй ступенью цензуры поверх мути. Открытыми остаются верх и
низ - там видно, что силуэт продолжает двигаться, и ролик не читается как
стоп-кадр. Закрывать лист целиком по-прежнему нельзя: получится та самая
чёрная заставка, от которой ушли.
"""
import asyncio
import base64
import os
import sys

ТУТ = os.path.dirname(os.path.abspath(__file__))
БРЕНД = os.path.dirname(ТУТ)
ФОНТЫ = "/home/user/OKO-TEAM/.claude/skills/reels-machine/fonts"
ЛОГО = os.path.join(БРЕНД, "amberry-icon-512-alpha.png")

# Те же призывы, что у Формата 1 и у хвоста: ведём в бота, слова разные.
ПРИЗЫВЫ = [
    "ССЫЛКА В КОММЕНТАРИЯХ",
    "ССЫЛКА В ПРОФИЛЕ",
    "ПОДРОБНЕЕ В БОТЕ",
    "ПРОДОЛЖЕНИЕ В TELEGRAM",
    "ЖМИ ССЫЛКУ В ШАПКЕ",
    "ССЫЛКА ПОД ВИДЕО",
]


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
:root{--pink:#FF0A8C;--vio:#7A2BFF;--lime:#9AFF00}
html,body{width:__Ш__px;height:__В__px;overflow:hidden;background:transparent}
"""

КАРТОЧКА = ОБЩЕЕ + """
/* Неоновая рамка по краю. Без неё муть читается как брак кодека, а не
   как замысел: глаз должен увидеть, что так задумано. */
#рамка{position:absolute;inset:12px;border:5px solid var(--pink);border-radius:32px;
  box-shadow:0 0 46px #ff0a8c66,inset 0 0 46px #ff0a8c2e}
/* Затемнение ПОЛОСОЙ ПО ЦЕНТРУ, а не к низу. Решение владельца
   26.09.2026: карточка стоит в середине кадра и закрывает собой ещё
   часть того, что показывать нельзя, - то есть работает не только как
   подпись, но и как вторая ступень цензуры поверх мути. Верх и низ
   остаются открытыми: там и видно, что силуэт продолжает двигаться. */
#тень{position:absolute;inset:0;background:linear-gradient(to bottom,
  rgba(7,6,10,0) 6%,rgba(7,6,10,.60) 24%,rgba(7,6,10,.92) 42%,
  rgba(7,6,10,.92) 66%,rgba(7,6,10,.60) 84%,rgba(7,6,10,0) 97%)}
#блок{position:absolute;left:0;right:0;top:50%;transform:translateY(-50%);
  display:flex;flex-direction:column;align-items:center;gap:22px;padding:0 48px}
#блок .lg{width:190px;height:190px;filter:drop-shadow(0 0 46px #ff0a8caa)}
.headline{font-family:M9;font-size:82px;line-height:1.04;text-align:center;color:#fff;
  text-transform:uppercase;letter-spacing:1px;text-shadow:0 4px 28px #000c}
.headline .hi{color:var(--pink);text-shadow:0 0 30px var(--pink),0 4px 28px #000c}
.free{font-family:M9;font-size:50px;color:#fff;letter-spacing:1px;text-shadow:0 4px 24px #000c}
.free span{color:var(--lime);text-shadow:0 0 24px #9aff0088}
.tgline{display:flex;align-items:center;gap:16px}
.tgline svg{width:54px;height:54px;filter:drop-shadow(0 0 12px #2aabee88)}
.nk{font-family:M7;font-size:44px;color:#cfe0ee;text-shadow:0 3px 20px #000c}
.cta{font-family:M9;font-size:56px;white-space:nowrap;color:var(--pink);text-shadow:0 0 26px var(--pink);
  padding:22px 48px;border:4px solid var(--pink);border-radius:22px;
  box-shadow:0 0 34px #ff0a8c55,inset 0 0 22px #ff0a8c22;background:rgba(10,7,16,.34)}
"""

# Кнопка бота, вынутая из чата. Стиль тот же, что в самом боте
# (`../../bot/ui.py`): тёмная плитка, холодная рамка, у главной - розовая.
# Подложка полупрозрачная: сплошная читается как картинка, наклеенная
# поверх чужого видео.
КНОПКА = ОБЩЕЕ + """
body{display:flex;align-items:center;justify-content:center}
/* Плитка ПЛОТНАЯ, а не полупрозрачная. backdrop-filter здесь бесполезен:
   кнопка снимается отдельным кадром, позади неё пусто, размывать нечего -
   а поверх светлого кадра полупрозрачная плитка выцветает в розовое
   пятно и перестаёт быть похожей на кнопку бота. */
.btn{background:#0e1620;border:3px solid #24384a;border-radius:26px;
  padding:32px 60px;color:#dbe7f2;font-family:M7;font-size:52px;white-space:nowrap;
  box-shadow:0 14px 48px #000a}
.btn.горячая{border-color:var(--pink);color:#fff;
  box-shadow:0 0 38px #ff0a8c66,0 14px 48px #000a}
/* Нажатие - вспышка розовым ПОВЕРХ тёмной плитки, а не вместо неё. */
.btn.нажата{border-color:var(--pink);color:#fff;
  background:linear-gradient(135deg,#3a0c26,#2a1040);
  box-shadow:0 0 78px #ff0a8ccc,0 0 30px #ff0a8c88 inset,0 14px 48px #000a}
"""

ТГ_ЗНАК = ('<svg viewBox="0 0 496 512"><path fill="#2AABEE" d="M248 8C111 8 0 119 0 '
           '256s111 248 248 248 248-111 248-248S385 8 248 8zm121.8 169.9l-40.7 '
           '191.8c-3 13.6-11.1 16.9-22.4 10.5l-62-45.7-29.9 28.8c-3.3 3.3-6.1 '
           '6.1-12.5 6.1l4.4-63.1 114.9-103.8c5-4.4-1.1-6.9-7.7-2.5l-142 '
           '89.4-61.2-19.1c-13.3-4.2-13.6-13.3 2.8-19.7l239.1-92.2c11.1-4 20.8 2.7 '
           '17.2 19.5z"/></svg>')


def html_карточки(призыв, ш, в):
    стиль = (КАРТОЧКА.replace("__M9__", шрифт("montserrat-v31-cyrillic_latin-900.ttf"))
             .replace("__M7__", шрифт("montserrat-v31-cyrillic_latin-700.ttf"))
             .replace("__Ш__", str(ш)).replace("__В__", str(в)))
    return f"""<!doctype html><html lang="ru"><head><meta charset="utf-8">
<style>{стиль}</style></head><body>
<div id="рамка"></div><div id="тень"></div>
<div id="блок">
  <img class="lg" src="{b64(ЛОГО, 'image/png')}">
  <div class="headline">РАЗДЕНЬ <span class="hi">И&nbsp;ОЖИВИ</span> ЛЮБОЕ ФОТО</div>
  <div class="free">ПЕРВОЕ ФОТО <span>БЕСПЛАТНО</span></div>
  <div class="tgline">{ТГ_ЗНАК}<span class="nk">@theamberrybot</span></div>
  <div class="cta">{призыв}</div>
</div>
<script>
/* Призыв разный по длине, а рамка одна. Ширину меряем у самой строки и
   сбавляем кегль, пока не влезет: перенос выкидывает текст из рамки. */
(function(){{
  var c=document.querySelector('.cta'), б=document.getElementById('блок');
  var есть=б.clientWidth-parseFloat(getComputedStyle(б).paddingLeft)*2;
  for(var р=56;р>26 && c.scrollWidth>есть;р-=2) c.style.fontSize=р+'px';
  document.documentElement.dataset.fit='1';
}})();
</script></body></html>"""


def html_кнопки(текст, состояние, ш, в):
    стиль = (КНОПКА.replace("__M9__", шрифт("montserrat-v31-cyrillic_latin-900.ttf"))
             .replace("__M7__", шрифт("montserrat-v31-cyrillic_latin-700.ttf"))
             .replace("__Ш__", str(ш)).replace("__В__", str(в)))
    класс = "btn " + (состояние or "")
    return (f"""<!doctype html><html lang="ru"><head><meta charset="utf-8">"""
            f"""<style>{стиль}</style></head><body>"""
            f"""<div class="{класс.strip()}">{текст}</div></body></html>""")


async def снять(html, выход, ш, в):
    """Один кадр с прозрачностью. Видео с альфой Chromium не пишет, кадр - пишет."""
    from playwright.async_api import async_playwright
    врем = выход + ".html"
    with open(врем, "w", encoding="utf-8") as ф:
        ф.write(html)
    async with async_playwright() as p:
        бр = await p.chromium.launch(headless=True, args=["--no-sandbox",
             "--force-color-profile=srgb", "--disable-lcd-text"])
        к = await бр.new_context(viewport={"width": ш, "height": в},
                                 device_scale_factor=1)
        стр = await к.new_page()
        await стр.goto("file://" + os.path.abspath(врем), wait_until="load")
        await стр.wait_for_timeout(300)          # дать шрифтам встать
        try:                                     # карточка подгоняет призыв сама
            await стр.wait_for_function("()=>document.documentElement.dataset.fit==='1'",
                                        timeout=3000)
        except Exception:
            pass                                 # у кнопки подгонки нет
        await стр.screenshot(path=выход, omit_background=True)
        await бр.close()
    os.remove(врем)
    return выход


def карточка(выход, призыв=None, ш=1080, в=1920):
    призыв = призыв or ПРИЗЫВЫ[0]
    return asyncio.run(снять(html_карточки(призыв, ш, в), выход, ш, в))


def кнопка(выход, текст, состояние="горячая", ш=760, в=200):
    return asyncio.run(снять(html_кнопки(текст, состояние, ш, в), выход, ш, в))


if __name__ == "__main__":
    арг = sys.argv[1:]
    if len(арг) < 2:
        raise SystemExit(__doc__)
    что, выход = арг[0], арг[1]
    if что == "карточка":
        print(карточка(выход, арг[2] if len(арг) > 2 else None))
    elif что == "кнопка":
        print(кнопка(выход, арг[2], арг[3] if len(арг) > 3 else "горячая"))
    else:
        raise SystemExit(__doc__)
