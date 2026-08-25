# -*- coding: utf-8 -*-
"""Собирает пакет контента на согласование клиенту в одну HTML-страницу.

Берёт НЕДЕЛЯ_1_ГОТОВО.md, раскладывает по дням и площадкам, подставляет
готовые визуалы и честно помечает те, что ещё в работе. Даты сдвигает на
новый график: контент писался под 20-26.08, согласование сдвинуло старт.

    python3 build_paket.py [папка-с-визуалами] > paket.html
"""
import re, sys, os, base64, html
from datetime import date

ПАПКА = os.path.dirname(os.path.abspath(__file__))
ФАЙЛЫ = [("Неделя 1", "НЕДЕЛЯ_1_ЧИСТОВИК.md"),
         ("Неделя 2", "НЕДЕЛЯ_2.md"),
         ("Неделя 3", "НЕДЕЛЯ_3.md"),
         ("Неделя 4", "НЕДЕЛЯ_4.md"),
         ("Виральный блок: промышленность и город", "VIRAL_1.md"),
         ("Виральный блок: деньги и люди", "VIRAL_2.md"),
         ("Карусели пользы", "KARUSELI_POLZA.md"),
         ("Продающий блок", "PRODAZHI.md")]
VIS = sys.argv[1] if len(sys.argv) > 1 else ""

# старая дата -> новая: неделя едет на 25.08 (вт) - 31.08 (пн)
СДВИГ = {
    "20.08 ЧТ": ("25.08", "вторник"),
    "21.08 ПТ": ("26.08", "среда"),
    "22.08 СБ": ("27.08", "четверг"),
    "23.08 ВС": ("28.08", "пятница"),
    "24.08 ПН": ("29.08", "суббота"),
    "25.08 ВТ": ("30.08", "воскресенье"),
    "26.08 СР": ("31.08", "понедельник"),
}

ПЛОЩАДКИ = {
    "Telegram": "tg", "Instagram": "ig", "ВКонтакте": "vk",
    "Дзен": "dzen", "vc.ru": "vc", "РБК": "rbk",
}


def площадка(заголовок):
    for имя, код in ПЛОЩАДКИ.items():
        if заголовок.startswith(имя):
            return имя, код
    return заголовок.split("·")[0].strip(), "etc"


def картинка(промпт_id):
    """Возвращает data-URI готового визуала или None."""
    if not VIS or not промпт_id:
        return None
    for ext in (".jpg", ".png"):
        p = os.path.join(VIS, промпт_id + ext)
        if os.path.exists(p):
            mime = "jpeg" if ext == ".jpg" else "png"
            with open(p, "rb") as f:
                return f"data:image/{mime};base64," + base64.b64encode(f.read()).decode()
    return None


def разобрать_файл(путь):
    src = open(путь, encoding="utf-8").read()
    части = re.split(r"\n# ([^\n]{1,28})\n", src)
    # файл без внутренних заголовков разбирается целиком одним разделом
    if len(части) < 3:
        части = ["", "", src]
    дни = []
    for i in range(1, len(части) - 1, 2):
        метка, тело = части[i], части[i + 1]
        единицы = []
        куски = re.split(r"\n## ", тело)
        for кусок in куски[1:]:
            строки = кусок.split("\n")
            загол = строки[0].strip()
            # служебные разделы в пакет не идут: единица начинается с площадки
            if not re.match(r"(Instagram|Telegram|ВКонтакте|Дзен|vc\.ru|РБК)", загол):
                continue
            тело_ед = "\n".join(строки[1:])
            # заголовок публикации - первая **жирная** строка
            m = re.search(r"\*\*([^*]+)\*\*", тело_ед)
            титул = m.group(1).strip() if m else ""
            # текст в ```блоке```
            m = re.search(r"```\n(.*?)\n```", тело_ед, re.S)
            текст = m.group(1) if m else ""
            # слайды карусели
            слайды = re.findall(r"\*\*(\d+)\.\*\* ([^\n]+)\n> ([^\n]+)", тело_ед)
            # визуал и промпт
            m = re.search(r"[Вв]изуал:\s*([^\n]+)", тело_ед)
            визуал = m.group(1).strip() if m else ""
            m = re.search(r"промпт `([^`]+)`", тело_ед)
            промпт = m.group(1) if m else ""
            m = re.search(r"Хештеги:\s*([^\n]+)", тело_ед)
            теги = m.group(1).strip() if m else ""
            единицы.append(dict(загол=загол, титул=титул, текст=текст, слайды=слайды,
                                визуал=визуал, промпт=промпт, теги=теги))
        дни.append((метка, единицы))
    return дни


def разобрать():
    все = []
    for имя, файл in ФАЙЛЫ:
        п = os.path.join(ПАПКА, файл)
        if not os.path.exists(п):
            continue
        for метка, единицы in разобрать_файл(п):
            все.append((имя, метка, единицы))
    return все


CSS = """
*{box-sizing:border-box;margin:0;padding:0}
body{font:16px/1.6 -apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;
 color:#1c1c1e;background:#f6f6f4;-webkit-text-size-adjust:100%}
.wrap{max-width:860px;margin:0 auto;padding:28px 18px 80px}
header{border-bottom:2px solid #1c1c1e;padding-bottom:20px;margin-bottom:8px}
h1{font-size:26px;letter-spacing:-.5px;line-height:1.2}
.sub{color:#6b6b70;margin-top:8px;font-size:15px}
.svodka{display:flex;flex-wrap:wrap;gap:10px;margin:22px 0 34px}
.chip{background:#fff;border:1px solid #e3e3df;border-radius:8px;padding:10px 14px;font-size:14px}
.chip b{display:block;font-size:20px;color:#1c1c1e;margin-bottom:2px}
.ned{font-size:15px;letter-spacing:1.6px;text-transform:uppercase;color:#8a8a8f;
 margin:46px 0 -8px;padding-bottom:6px;border-bottom:2px solid #1c1c1e}
.den{margin-top:34px}
.den-h{display:flex;align-items:baseline;gap:10px;padding-bottom:8px;
 border-bottom:1px solid #d9d9d4;margin-bottom:18px}
.den-h .d{font-size:20px;font-weight:700}
.den-h .w{color:#8a8a8f;font-size:14px}
.ed{background:#fff;border:1px solid #e3e3df;border-radius:12px;padding:18px;margin-bottom:14px}
.ed-h{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin-bottom:12px}
.pl{font-size:12px;font-weight:700;letter-spacing:.4px;text-transform:uppercase;
 padding:4px 9px;border-radius:5px;background:#1c1c1e;color:#fff}
.pl.ig{background:#c13584}.pl.tg{background:#2aabee}
.pl.vk{background:#0077ff}.pl.dzen{background:#000}.pl.vc{background:#f552a0}
.pl.rbk{background:#d40000}
.tip{font-size:13px;color:#6b6b70}
.titul{font-size:18px;font-weight:700;line-height:1.35;margin:2px 0 12px}
.txt{white-space:pre-wrap;background:#fbfbfa;border-left:3px solid #e8a317;
 padding:14px 16px;border-radius:0 8px 8px 0;font-size:15px}
.slides{display:grid;gap:8px;margin-top:6px}
.sl{display:flex;gap:10px;background:#fbfbfa;border-radius:8px;padding:10px 12px}
.sl .n{flex:0 0 26px;height:26px;border-radius:50%;background:#1c1c1e;color:#fff;
 display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700}
.sl .c b{display:block;font-size:14px;letter-spacing:.2px}
.sl .c span{font-size:13px;color:#55555a}
figure{margin:14px 0 0}
figure img{width:100%;border-radius:10px;display:block;border:1px solid #e3e3df}
figcaption{font-size:13px;color:#6b6b70;margin-top:7px}
.net{margin-top:14px;background:#fff8e8;border:1px dashed #e8a317;border-radius:10px;
 padding:12px 14px;font-size:13px;color:#6b5a2a}
.tags{margin-top:10px;font-size:13px;color:#8a8a8f}
.foot{margin-top:44px;padding-top:20px;border-top:1px solid #d9d9d4;font-size:14px;color:#6b6b70}
@media(max-width:520px){.wrap{padding:20px 13px 60px}h1{font-size:22px}.titul{font-size:16px}}
"""


def сборка():
    дни = разобрать()
    всего = sum(len(e) for _, _, e in дни)
    сгенерено = sum(1 for _, _, e in дни for u in e if u["промпт"] and картинка(u["промпт"]))
    нужно = sum(1 for _, _, e in дни for u in e if u["промпт"])

    o = ['<!doctype html><html lang="ru"><meta charset="utf-8">',
         '<meta name="viewport" content="width=device-width,initial-scale=1">',
         '<title>Кластер: контент на согласование</title>',
         f'<style>{CSS}</style><div class="wrap">',
         '<header><h1>Контент на месяц, на согласование</h1>',
         '<div class="sub">Бизнес-парк «Кластер» · подготовила команда OKO<br>'
         'Публикуем после вашего подтверждения. Правки принимаем по любому пункту.</div></header>',
         '<div class="svodka">',
         f'<div class="chip"><b>{всего}</b>публикаций</div>',
         '<div class="chip"><b>6</b>площадок</div>',
         '<div class="chip"><b>4</b>недели плюс блоки</div>',
         f'<div class="chip"><b>{сгенерено}/{нужно}</b>визуалов готово</div>',
         '</div>']

    текущая_неделя = None
    for неделя, метка, единицы in дни:
        if неделя != текущая_неделя:
            текущая_неделя = неделя
            o.append(f'<h2 class="ned">{html.escape(неделя)}</h2>')
        новая, днед = СДВИГ.get(метка, (метка, ""))
        o.append(f'<section class="den"><div class="den-h"><span class="d">{новая}</span>'
                 f'<span class="w">{днед}</span></div>')
        for u in единицы:
            имя, код = площадка(u["загол"])
            хвост = u["загол"][len(имя):].lstrip(" ·").strip()
            o.append(f'<article class="ed"><div class="ed-h"><span class="pl {код}">{html.escape(имя)}</span>'
                     f'<span class="tip">{html.escape(хвост)}</span></div>')
            if u["титул"]:
                o.append(f'<div class="titul">{html.escape(u["титул"])}</div>')
            if u["текст"]:
                o.append(f'<div class="txt">{html.escape(u["текст"])}</div>')
            if u["слайды"]:
                o.append('<div class="slides">')
                for n, шапка, под in u["слайды"]:
                    o.append(f'<div class="sl"><div class="n">{n}</div><div class="c">'
                             f'<b>{html.escape(шапка.strip())}</b><span>{html.escape(под.strip())}</span>'
                             f'</div></div>')
                o.append('</div>')
            if u["промпт"]:
                d = картинка(u["промпт"])
                if d:
                    o.append(f'<figure><img src="{d}" alt="">'
                             f'<figcaption>{html.escape(u["визуал"])}</figcaption></figure>')
                else:
                    o.append(f'<div class="net">Визуал в работе: {html.escape(u["визуал"])}</div>')
            if u["теги"]:
                o.append(f'<div class="tags">{html.escape(u["теги"])}</div>')
            o.append('</article>')
        o.append('</section>')

    o.append('<div class="foot">Что нужно от вас: подтвердить, что фактура верна '
             'и тон подходит. Если по какому-то пункту есть правка, напишите номер дня '
             'и площадку, поправим и покажем снова.<br><br>'
             'После подтверждения запускаем публикацию по этому графику.</div>')
    o.append('</div></html>')
    return "\n".join(o)


if __name__ == "__main__":
    sys.stdout.write(сборка())
