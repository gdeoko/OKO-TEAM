# -*- coding: utf-8 -*-
"""Сборка пакета на согласование по любому проекту.

Собирает месяц в одну страницу: единицы по дням, тексты, слайды, промпты и
готовые визуалы, если они уже сгенерированы.

    python3 paket.py diesel [папка-с-картинками] > paket.html
"""
import re, sys, os, glob, base64, html, json

ПЛОЩАДКИ = {"Telegram": "tg", "Instagram": "ig", "ВКонтакте": "vk",
            "Дзен": "dzen", "vc.ru": "vc", "РБК": "rbk"}

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
.ed{background:#fff;border:1px solid #e3e3df;border-radius:12px;padding:18px;margin-bottom:14px}
.ed-h{display:flex;flex-wrap:wrap;align-items:center;gap:8px;margin-bottom:12px}
.pl{font-size:12px;font-weight:700;letter-spacing:.4px;text-transform:uppercase;
 padding:4px 9px;border-radius:5px;background:#1c1c1e;color:#fff}
.pl.ig{background:#c13584}.pl.tg{background:#2aabee}
.pl.vk{background:#0077ff}.pl.dzen{background:#000}.pl.vc{background:#f552a0}
.tip{font-size:13px;color:#6b6b70}
.titul{font-size:18px;font-weight:700;line-height:1.35;margin:2px 0 12px}
.txt{white-space:pre-wrap;background:#fbfbfa;border-left:3px solid #8a8a8f;
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
.net{margin-top:14px;background:#f4f4f2;border:1px dashed #b6b6b0;border-radius:10px;
 padding:12px 14px;font-size:13px;color:#5a5a55}
.tags{margin-top:10px;font-size:13px;color:#8a8a8f}
.foot{margin-top:44px;padding-top:20px;border-top:1px solid #d9d9d4;font-size:14px;color:#6b6b70}
@media(max-width:520px){.wrap{padding:20px 13px 60px}h1{font-size:22px}.titul{font-size:16px}}
"""


def площадка(заголовок):
    for имя, код in ПЛОЩАДКИ.items():
        if заголовок.startswith(имя):
            return имя, код
    return заголовок.split("·")[0].strip(), "etc"


def картинка(папка, ключ):
    if not папка or not ключ:
        return None
    for расширение in (".png", ".jpg"):
        путь = os.path.join(папка, ключ + расширение)
        if os.path.exists(путь) and os.path.getsize(путь) > 40000:
            мим = "png" if расширение == ".png" else "jpeg"
            with open(путь, "rb") as ф:
                return f"data:image/{мим};base64," + base64.b64encode(ф.read()).decode()
    return None


def разобрать(проект):
    дни = []
    for файл in sorted(glob.glob(os.path.join(проект, "NEDELYA_*.md"))):
        неделя = "Неделя " + re.search(r"NEDELYA_(\d)", файл).group(1)
        src = open(файл, encoding="utf-8").read()
        части = re.split(r"\n# ([^\n]{1,28})\n", src)
        for i in range(1, len(части) - 1, 2):
            метка, тело = части[i], части[i + 1]
            единицы = []
            for кусок in re.split(r"\n## ", тело)[1:]:
                строки = кусок.split("\n")
                загол = строки[0].strip()
                if not re.match(r"(Instagram|Telegram|ВКонтакте|Дзен|vc\.ru|РБК)", загол):
                    continue
                тело_ед = "\n".join(строки[1:])
                m = re.search(r"\*\*([^*\n]+)\*\*", тело_ед)
                титул = m.group(1).strip() if m else ""
                m = re.search(r"```\n(.*?)\n```", тело_ед, re.S)
                текст = m.group(1) if m else ""
                слайды = re.findall(r"\*\*(\d+)\.\*\* ([^\n]+)\n> ([^\n]+)", тело_ед)
                m = re.search(r"[Вв]изуал:\s*([^\n]+)", тело_ед)
                визуал = m.group(1).strip() if m else ""
                m = re.search(r"промпт `([^`]+)`", тело_ед)
                промпт = m.group(1) if m else ""
                m = re.search(r"Хештеги:\s*([^\n]+)", тело_ед)
                теги = m.group(1).strip() if m else ""
                единицы.append(dict(загол=загол, титул=титул, текст=текст, слайды=слайды,
                                    визуал=визуал, промпт=промпт, теги=теги))
            if единицы:
                дни.append((неделя, метка, единицы))
    return дни


def сборка(проект, картинки, имя_клиента):
    дни = разобрать(проект)
    всего = sum(len(е) for _, _, е in дни)
    нужно = sum(1 for _, _, е in дни for u in е if u["промпт"])
    готово = sum(1 for _, _, е in дни for u in е if картинка(картинки, u["промпт"]))
    o = ['<!doctype html><html lang="ru"><meta charset="utf-8">',
         '<meta name="viewport" content="width=device-width,initial-scale=1">',
         f'<title>{html.escape(имя_клиента)}: контент на согласование</title>',
         f'<style>{CSS}</style><div class="wrap">',
         f'<header><h1>{html.escape(имя_клиента)}: контент на месяц</h1>',
         '<div class="sub">Подготовила команда OKO. Публикуем после вашего подтверждения. '
         'Правки принимаем по любому пункту.</div></header>',
         '<div class="svodka">',
         f'<div class="chip"><b>{всего}</b>публикаций</div>',
         '<div class="chip"><b>4</b>недели</div>',
         f'<div class="chip"><b>{готово}/{нужно}</b>визуалов готово</div>',
         '</div>']
    текущая = None
    for неделя, метка, единицы in дни:
        if неделя != текущая:
            текущая = неделя
            o.append(f'<h2 class="ned">{html.escape(неделя)}</h2>')
        o.append(f'<section class="den"><div class="den-h"><span class="d">{html.escape(метка)}</span></div>')
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
                for н, шапка, под in u["слайды"]:
                    o.append(f'<div class="sl"><div class="n">{н}</div><div class="c">'
                             f'<b>{html.escape(шапка.strip())}</b><span>{html.escape(под.strip())}</span>'
                             f'</div></div>')
                o.append('</div>')
            if u["промпт"]:
                d = картинка(картинки, u["промпт"])
                if d:
                    o.append(f'<figure><img src="{d}" alt="">'
                             f'<figcaption>{html.escape(u["визуал"])}</figcaption></figure>')
                else:
                    o.append(f'<div class="net">Визуал в работе: {html.escape(u["визуал"])}</div>')
            if u["теги"]:
                o.append(f'<div class="tags">{html.escape(u["теги"])}</div>')
            o.append('</article>')
        o.append('</section>')
    o.append('<div class="foot">Что нужно от вас: подтвердить, что фактура верна и тон подходит. '
             'Если по какому-то пункту есть правка, напишите день и площадку, поправим и покажем снова.'
             '<br><br>После подтверждения запускаем публикацию по этому графику.</div>')
    o.append('</div></html>')
    return "\n".join(o)


ИМЕНА = {"diesel": "DIESEL", "ducks": "DUCK'S GAME SPACE", "metanoya": "МЕТАНОЙА",
         "muzmir": "Музыкальный мир", "tappio": "TAPPIO", "zanovosti": "Зановости"}

if __name__ == "__main__":
    проект = sys.argv[1]
    картинки = sys.argv[2] if len(sys.argv) > 2 else ""
    sys.stdout.write(сборка(проект, картинки, ИМЕНА.get(проект, проект)))
