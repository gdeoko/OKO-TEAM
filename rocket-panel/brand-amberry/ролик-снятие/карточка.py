#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Наложения Формата 2: финальная карточка и кнопки бота. Прозрачный PNG.

Формат 2 складывает ffmpeg, а не браузер: Chromium не пишет видео с
альфой, и запись играющего мутного кадра 1080x1920 в headless теряет
кадры. Но ОДИН кадр с прозрачностью он снимает прекрасно
(`omit_background`), поэтому вид карточки живёт здесь в HTML и CSS - там
же, где он живёт у Формата 1, - а не переписывается второй раз на PIL.
Разойдутся два описания одного и того же - разойдётся и вид.

    python3 карточка.py карточка out.png "ПРОДОЛЖЕНИЕ В БОТЕ" [неон]
    python3 карточка.py ряд      каталог/ "ПРОДОЛЖЕНИЕ В БОТЕ" [неон]
    python3 карточка.py кнопка   out.png "Раздеть" [нажата]

КАРТОЧКА ОДНА НА ОБА ФОРМАТА. Разница только в подложке: Формату 1 -
тёмный неоновый фон (`неон`), Формату 2 - ничего, под ней идёт мутный
кадр. Сам блок, его состав и расстановка одинаковы, и живут в одном
месте: два описания одного и того же неизбежно разойдутся.

КНОПКИ ПРОЗРАЧНЫЕ, И ТЁМНОГО В НИХ НЕТ. Решение владельца 26.09.2026:
плотная чёрная плитка смотрится дёшево, даже будучи точной копией кнопки
бота. Осталось розовое стекло со свечением, состояний два: обычное и
нажатое.

СОСТАВ КАРТОЧКИ ПОСТОЯНЕН и меняться не должен: лого, «РАЗДЕНЬ И ОЖИВИ
ЛЮБОЕ ФОТО», «ПЕРВОЕ ФОТО БЕСПЛАТНО», значок Telegram с ником, призыв.
Разный в ней ровно один элемент - призыв.

ФОНА И ЗАТЕМНЕНИЯ У КАРТОЧКИ НЕТ. Под ней продолжает двигаться мутный
силуэт, и это половина смысла: ролик не обрывается стоп-кадром, видно,
что там что-то происходит. Тёмную подложку владелец отверг 26.09.2026 -
смотрится дёшево. Читаемость держится на свечении по самим буквам:
плотная тень вплотную к глифу плюс мягкий ореол. Под текстом видно кадр,
а не прямоугольник.

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

# Тёмный неоновый фон Формата 1. Во Формате 2 его нет: там под карточкой
# идёт мутный кадр. Вид самой карточки при этом ОДИН И ТОТ ЖЕ - два
# описания одного и того же разойдутся, и разойдётся вид.
ФОН = """
#фон{position:absolute;inset:0;overflow:hidden;background:
  radial-gradient(75% 55% at 50% 38%,#2c1030 0%,#170a20 46%,#0a0710 100%)}
#фон .orb{position:absolute;border-radius:50%;filter:blur(90px);opacity:.5}
#фон .orb.p{width:520px;height:520px;background:var(--pink);top:-120px;right:-120px}
#фон .orb.v{width:480px;height:480px;background:var(--vio);bottom:-140px;left:-120px}
"""

ЖИВАЯ = """
/* ПОЯВЛЕНИЕ. Карточка проявляется, а не выскакивает готовой: выскочившая
   читается как баннер поверх чужого видео, проявленная - как часть
   ролика. Для съёмки покадрово все анимации ПОСТАВЛЕНЫ НА ПАУЗУ, а нужный
   момент выбирается отрицательной задержкой: браузер тогда рисует кадр
   ровно этого мгновения. Это единственный способ снять анимацию с
   прозрачностью - видео с альфой Chromium не пишет. */
#блок>*{animation-duration:.85s;animation-fill-mode:both;
  animation-timing-function:cubic-bezier(.2,1.25,.35,1);animation-play-state:paused}
#блок .lg{animation-name:всплыть}
#блок .headline{animation-name:поднять;animation-delay:.10s}
#блок .free{animation-name:поднять;animation-delay:.20s}
#блок .tgline{animation-name:поднять;animation-delay:.28s}
#блок .cta{animation-name:вырасти;animation-delay:.36s}
#рамка{animation:проявить .85s both;animation-play-state:paused}
@keyframes всплыть{from{opacity:0;transform:scale(.55) translateY(26px)}to{opacity:1;transform:none}}
@keyframes поднять{from{opacity:0;transform:translateY(34px)}to{opacity:1;transform:none}}
@keyframes вырасти{from{opacity:0;transform:scale(.86)}to{opacity:1;transform:none}}
@keyframes проявить{from{opacity:0}to{opacity:1}}
"""

КАРТОЧКА = ОБЩЕЕ + ФОН + ЖИВАЯ + """
/* Неоновая рамка по краю. Без неё муть читается как брак кодека, а не
   как замысел: глаз должен увидеть, что так задумано. */
#рамка{position:absolute;inset:12px;border:5px solid var(--pink);border-radius:32px;
  box-shadow:0 0 46px #ff0a8c66,inset 0 0 46px #ff0a8c2e}
/* ЗАТЕМНЕНИЯ НЕТ. Решение владельца 26.09.2026: тёмная подложка под
   текстом смотрится дёшево, и от неё отказались совсем - остаётся одна
   муть. Читаемость даёт не прямоугольник, а свечение по самим буквам:
   плотная тень вплотную к глифу плюс мягкий ореол. Тень идёт за буквой,
   а не за блоком, поэтому кадр остаётся открытым целиком. */
#блок{position:absolute;left:0;right:0;top:50%;transform:translateY(-50%);
  display:flex;flex-direction:column;align-items:center;gap:22px;padding:0 48px}
#блок .lg{width:190px;height:190px;filter:drop-shadow(0 0 46px #ff0a8caa)}
/* НЕОНОВАЯ ТРУБКА ВМЕСТО ТЁМНЫХ ТЕНЕЙ. Решение владельца 26.09.2026:
   тёмного нет нигде - ни подложек, ни обводок, ни теней под буквами.
   Читаемость даёт свет, а не темнота: ядро буквы белое, вокруг цветное
   свечение в три слоя. Такая строка держится и на светлом кадре, и на
   чёрном, и выглядит дороже плоской заливки - это тот же приём, что у
   `неон()` в ../цензура/замутить.py и на аватарках. */
.headline{font-family:M9;font-size:82px;line-height:1.04;text-align:center;color:#fff;
  text-transform:uppercase;letter-spacing:1px;
  text-shadow:0 0 8px rgba(255,255,255,.9),0 0 26px rgba(255,255,255,.45),
    0 0 58px rgba(255,10,140,.55),0 0 110px rgba(255,10,140,.35)}
.headline .hi{color:#fff;
  text-shadow:0 0 7px #fff,0 0 18px var(--pink),0 0 40px var(--pink),0 0 84px var(--pink)}
.free{font-family:M9;font-size:50px;color:#fff;letter-spacing:1px;
  text-shadow:0 0 7px rgba(255,255,255,.9),0 0 24px rgba(255,255,255,.4),
    0 0 52px rgba(255,10,140,.45)}
.free span{color:#fff;
  text-shadow:0 0 7px #fff,0 0 18px var(--lime),0 0 40px var(--lime),0 0 78px #9aff00aa}
/* Контур по букве - РОЗОВЫЙ, а не тёмный. На светлом кадре белая буква
   с белым же свечением сливается с фоном, и единственное, что ей нужно,
   это край. Тёмная обводка его дала бы, но владелец тёмное снял; цветная
   трубка даёт тот же край и остаётся в бренде. paint-order кладёт контур
   ПОД заливку, иначе он съедает тонкие штрихи букв. */
.headline,.free{-webkit-text-stroke:3px rgba(255,10,140,.92);paint-order:stroke fill}
.cta{-webkit-text-stroke:2px rgba(255,10,140,.85);paint-order:stroke fill}
.nk{-webkit-text-stroke:2px rgba(122,43,255,.85);paint-order:stroke fill}
.tgline{display:flex;align-items:center;gap:16px}
.tgline svg{width:54px;height:54px;filter:drop-shadow(0 0 16px #2aabeecc)}
.nk{font-family:M7;font-size:44px;color:#fff;
  text-shadow:0 0 7px rgba(255,255,255,.85),0 0 22px rgba(122,43,255,.8),0 0 48px rgba(122,43,255,.5)}
.cta{font-family:M9;font-size:56px;white-space:nowrap;color:#fff;
  text-shadow:0 0 7px #fff,0 0 18px var(--pink),0 0 42px var(--pink),0 0 82px var(--pink);
  padding:22px 48px;border:5px solid var(--pink);border-radius:22px;
  box-shadow:0 0 26px #ff0a8cbb,0 0 70px #ff0a8c66,inset 0 0 30px #ff0a8c33;
  background:linear-gradient(135deg,rgba(255,10,140,.18),rgba(122,43,255,.12))}
"""

# Кнопка бота, вынутая из чата. Стиль тот же, что в самом боте
# (`../../bot/ui.py`): тёмная плитка, холодная рамка, у главной - розовая.
# Подложка полупрозрачная: сплошная читается как картинка, наклеенная
# поверх чужого видео.
КНОПКА = ОБЩЕЕ + """
body{display:flex;align-items:center;justify-content:center}
/* КНОПКА СТЕКЛЯННАЯ, ТЁМНОГО В НЕЙ НЕТ. Решение владельца 26.09.2026:
   плотная тёмная плитка смотрится дёшево, даже будучи точной копией
   кнопки бота, и тёмная тень под стеклянной - тоже. Осталось розовое
   стекло со свечением: держится светом, а не темнотой.
   backdrop-filter здесь бесполезен - кнопка снимается отдельным кадром,
   позади неё пусто, размывать нечего. */
.btn{background:linear-gradient(135deg,rgba(255,10,140,.42),rgba(122,43,255,.30));
  border:5px solid var(--pink);border-radius:26px;
  padding:32px 60px;color:#fff;font-family:M7;font-size:52px;white-space:nowrap;
  -webkit-text-stroke:2px rgba(255,10,140,.9);paint-order:stroke fill;
  text-shadow:0 0 8px #fff,0 0 24px var(--pink),0 0 52px var(--pink);
  box-shadow:0 0 30px #ff0a8ccc,0 0 78px #ff0a8c77,inset 0 0 40px #ff0a8c44}
/* Нажатие - та же плитка, вспышка ярче. */
.btn.нажата{box-shadow:0 0 40px #ff0a8cff,0 0 120px #ff0a8ccc,inset 0 0 60px #ff0a8c77;
  background:linear-gradient(135deg,rgba(255,10,140,.62),rgba(122,43,255,.42))}
"""

ТГ_ЗНАК = ('<svg viewBox="0 0 496 512"><path fill="#2AABEE" d="M248 8C111 8 0 119 0 '
           '256s111 248 248 248 248-111 248-248S385 8 248 8zm121.8 169.9l-40.7 '
           '191.8c-3 13.6-11.1 16.9-22.4 10.5l-62-45.7-29.9 28.8c-3.3 3.3-6.1 '
           '6.1-12.5 6.1l4.4-63.1 114.9-103.8c5-4.4-1.1-6.9-7.7-2.5l-142 '
           '89.4-61.2-19.1c-13.3-4.2-13.6-13.3 2.8-19.7l239.1-92.2c11.1-4 20.8 2.7 '
           '17.2 19.5z"/></svg>')


def html_карточки(призыв, ш, в, фон=False):
    стиль = (КАРТОЧКА.replace("__M9__", шрифт("montserrat-v31-cyrillic_latin-900.ttf"))
             .replace("__M7__", шрифт("montserrat-v31-cyrillic_latin-700.ttf"))
             .replace("__Ш__", str(ш)).replace("__В__", str(в)))
    подложка = ('<div id="фон"><div class="orb p"></div>'
                '<div class="orb v"></div></div>') if фон else ''
    return f"""<!doctype html><html lang="ru"><head><meta charset="utf-8">
<style>{стиль}</style></head><body>
{подложка}<div id="рамка"></div>
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
/* Момент анимации: снимаем кадр за кадром, сдвигая задержку назад.
   Собственная задержка элемента сохраняется, иначе порядок появления
   рассыплется и всё выскочит разом. */
window.момент=function(t){{
  document.querySelectorAll('#блок>*,#рамка').forEach(function(э){{
    var своя=parseFloat(э.dataset.задержка||'');
    if(isNaN(своя)){{ своя=parseFloat(getComputedStyle(э).animationDelay)||0;
                      э.dataset.задержка=своя; }}
    э.style.animationDelay=(своя-t)+'s';
  }});
  document.documentElement.dataset.кадр=String(t);
}};
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
            await стр.evaluate("()=>window.момент && window.момент(3)")
        except Exception:
            pass                                 # у кнопки ни подгонки, ни анимации
        await стр.screenshot(path=выход, omit_background=True)
        await бр.close()
    os.remove(врем)
    return выход


async def _снять_ряд(html, каталог, кадров, секунд, ш, в):
    from playwright.async_api import async_playwright
    os.makedirs(каталог, exist_ok=True)
    врем = os.path.join(каталог, "_кадр.html")
    with open(врем, "w", encoding="utf-8") as ф:
        ф.write(html)
    пути = []
    async with async_playwright() as p:
        бр = await p.chromium.launch(headless=True, args=["--no-sandbox",
             "--force-color-profile=srgb", "--disable-lcd-text"])
        к = await бр.new_context(viewport={"width": ш, "height": в},
                                 device_scale_factor=1)
        стр = await к.new_page()
        await стр.goto("file://" + os.path.abspath(врем), wait_until="load")
        await стр.wait_for_timeout(300)
        for i in range(кадров):
            t = секунд * i / max(1, кадров - 1)
            await стр.evaluate("t=>window.момент(t)", t)
            п = os.path.join(каталог, "кадр%03d.png" % i)
            await стр.screenshot(path=п, omit_background=True)
            пути.append(п)
        await бр.close()
    os.remove(врем)
    return пути


def ряд(каталог, призыв=None, кадров=26, секунд=1.25, ш=1080, в=1920, фон=False):
    """Последовательность кадров появления карточки. Ею ffmpeg и накрывает муть."""
    призыв = призыв or ПРИЗЫВЫ[0]
    return asyncio.run(_снять_ряд(html_карточки(призыв, ш, в, фон),
                                  каталог, кадров, секунд, ш, в))


def карточка(выход, призыв=None, ш=1080, в=1920, фон=False):
    """фон=True - вид Формата 1 (тёмный неон), фон=False - Формата 2 (прозрачно)."""
    призыв = призыв or ПРИЗЫВЫ[0]
    return asyncio.run(снять(html_карточки(призыв, ш, в, фон), выход, ш, в))


def кнопка(выход, текст, состояние="", ш=760, в=200):
    return asyncio.run(снять(html_кнопки(текст, состояние, ш, в), выход, ш, в))


if __name__ == "__main__":
    арг = sys.argv[1:]
    if len(арг) < 2:
        raise SystemExit(__doc__)
    что, выход = арг[0], арг[1]
    if что == "карточка":
        print(карточка(выход, арг[2] if len(арг) > 2 else None,
                       фон=(len(арг) > 3 and арг[3] == "неон")))
    elif что == "ряд":
        пути = ряд(выход, арг[2] if len(арг) > 2 else None,
                   фон=(len(арг) > 3 and арг[3] == "неон"))
        print(len(пути), "кадров в", выход)
    elif что == "кнопка":
        print(кнопка(выход, арг[2], арг[3] if len(арг) > 3 else ""))
    else:
        raise SystemExit(__doc__)
