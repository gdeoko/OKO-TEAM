# -*- coding: utf-8 -*-
"""Ядро сборки анимированных стикеров Rocket CDN / Rocket VPN.

Один источник рисует и стикер 512x512, и эмодзи 100x100: геометрия живёт
в координатах 512, а размер задаётся масштабом корневого слоя. Поэтому
пары получаются один в один, а не двумя похожими рисунками.

Telegram принимает .tgs = gzip(Lottie JSON) и умеет не всё, что умеет
Lottie: ни картинок, ни текста, ни масок, ни слой-эффектов. Здесь только
фигуры, градиенты, обводки и trim path - то, что рисует rlottie.
"""

import gzip
import json
import math
import os

# --- размеры и время ---------------------------------------------------

CANVAS = 512           # в этих координатах рисуем всегда
STICKER = 512          # холст стикера
EMOJI = 100            # холст кастом-эмодзи
FPS = 60
DUR = 180              # 3 секунды, предел Telegram
MAX_BYTES = 64 * 1024  # предел веса .tgs

# --- палитра бренда (rc.css проекта) -----------------------------------

INK = "#050C15"        # theme-color сайта
INK_2 = "#091320"
CYAN = "#42B2DC"       # --cyan, основной CDN
CYAN_DEEP = "#0A5897"  # --cyan-2
CYAN_LIT = "#7FD8FA"   # светлый край градиента
CYAN_PALE = "#B8ECFF"
VIOLET = "#8A59F6"     # --violet, основной VPN
VIOLET_DEEP = "#5B32C9"
VIOLET_LIT = "#B49BFF" # --violet-tx
MIST = "#E2E8F0"       # --mist
WHITE = "#F3F7FB"
SILVER = "#CFE9F5"
STEEL = "#94A3B8"


def rgb(h):
    """#RRGGBB -> [r, g, b] в долях единицы, как ждёт Lottie."""
    h = h.lstrip("#")
    return [int(h[i:i + 2], 16) / 255.0 for i in (0, 2, 4)]


# --- значения: статичное и анимированное -------------------------------

def val(v):
    """Постоянное значение свойства."""
    return {"a": 0, "k": v}


def anim(frames, easing=True):
    """Ключевые кадры: [(кадр, значение), ...].

    Плавность по умолчанию - мягкое замедление к каждому ключу; так
    движение читается как живое, а не как линейная протяжка.
    """
    keys = []
    for i, (t, v) in enumerate(frames):
        k = {"t": t, "s": v if isinstance(v, list) else [v]}
        if i < len(frames) - 1:
            if easing:
                k["i"] = {"x": [0.42], "y": [1.0]}
                k["o"] = {"x": [0.58], "y": [0.0]}
            else:
                k["i"] = {"x": [1.0], "y": [1.0]}
                k["o"] = {"x": [0.0], "y": [0.0]}
        keys.append(k)
    return {"a": 1, "k": keys}


def spin(turns=1, start=0, dur=DUR):
    """Ровное вращение без рывка на стыке петли."""
    return {"a": 1, "k": [
        {"t": 0, "s": [start], "i": {"x": [1.0], "y": [1.0]},
         "o": {"x": [0.0], "y": [0.0]}},
        {"t": dur, "s": [start + 360 * turns]},
    ]}


# --- геометрия ---------------------------------------------------------

def path(points, closed=True):
    """Путь из вершин. Точка: (x, y) - угол, или (x, y, ix, iy, ox, oy) -
    с касательными (они задаются относительно самой вершины)."""
    v, i, o = [], [], []
    for p in points:
        v.append([p[0], p[1]])
        if len(p) == 6:
            i.append([p[2], p[3]])
            o.append([p[4], p[5]])
        else:
            i.append([0, 0])
            o.append([0, 0])
    return {"ty": "sh", "ks": val({"i": i, "o": o, "v": v, "c": closed})}


def circle(cx, cy, r):
    return {"ty": "el", "p": val([cx, cy]), "s": val([r * 2, r * 2])}


def ellipse(cx, cy, rx, ry):
    return {"ty": "el", "p": val([cx, cy]), "s": val([rx * 2, ry * 2])}


def rect(cx, cy, w, h, r=0):
    return {"ty": "rc", "p": val([cx, cy]), "s": val([w, h]), "r": val(r)}


def star(cx, cy, r_out, r_in, points, rot=0):
    return {"ty": "sr", "sy": 1, "p": val([cx, cy]), "or": val(r_out),
            "ir": val(r_in), "pt": val(points), "r": val(rot),
            "os": val(0), "is": val(0)}


def poly(cx, cy, r, sides, rot=0):
    return {"ty": "sr", "sy": 2, "p": val([cx, cy]), "or": val(r),
            "pt": val(sides), "r": val(rot), "os": val(0)}


# --- заливки и обводки -------------------------------------------------

def fill(color, opacity=100):
    o = opacity if isinstance(opacity, dict) else val(opacity)
    return {"ty": "fl", "c": val(rgb(color)), "o": o, "r": 1}


def stroke(color, width, opacity=100, cap=2, join=2):
    o = opacity if isinstance(opacity, dict) else val(opacity)
    w = width if isinstance(width, dict) else val(width)
    return {"ty": "st", "c": val(rgb(color)), "o": o, "w": w,
            "lc": cap, "lj": join, "ml": 4}


def _stops(colors):
    """Цветовые точки градиента -> плоский список Lottie."""
    out = []
    for pos, c in colors:
        out += [pos] + rgb(c)
    return out


def grad(colors, p0, p1, kind=1, opacity=100):
    """Градиентная заливка. kind=1 линейный, 2 радиальный."""
    o = opacity if isinstance(opacity, dict) else val(opacity)
    return {"ty": "gf", "t": kind, "o": o, "r": 1,
            "s": val(list(p0)), "e": val(list(p1)),
            "g": {"p": len(colors), "k": val(_stops(colors))}}


def grad_stroke(colors, p0, p1, width, kind=1, opacity=100):
    o = opacity if isinstance(opacity, dict) else val(opacity)
    w = width if isinstance(width, dict) else val(width)
    return {"ty": "gs", "t": kind, "o": o, "w": w, "lc": 2, "lj": 2, "ml": 4,
            "s": val(list(p0)), "e": val(list(p1)),
            "g": {"p": len(colors), "k": val(_stops(colors))}}


def trim(start=0, end=100, offset=0):
    """Обрезка контура - ею рисуется линия, которая чертится на глазах."""
    s = start if isinstance(start, dict) else val(start)
    e = end if isinstance(end, dict) else val(end)
    of = offset if isinstance(offset, dict) else val(offset)
    return {"ty": "tm", "s": s, "e": e, "o": of, "m": 1}


def repeat(count, offset_xy=(0, 0), rotate=0, scale=(100, 100), anchor=(0, 0)):
    """Повторитель: копии фигуры по кругу или в ряд."""
    return {"ty": "rp", "c": val(count), "o": val(0), "m": 1,
            "tr": {"ty": "tr", "p": val(list(offset_xy)), "a": val(list(anchor)),
                   "s": val(list(scale)), "r": val(rotate),
                   "so": val(100), "eo": val(100), "o": val(0)}}


def gtr(pos=(0, 0), anchor=(0, 0), scale=(100, 100), rot=0, opacity=100,
        skew=None):
    """Трансформация группы."""
    t = {
        "ty": "tr",
        "p": pos if isinstance(pos, dict) else val(list(pos)),
        "a": anchor if isinstance(anchor, dict) else val(list(anchor)),
        "s": scale if isinstance(scale, dict) else val(list(scale)),
        "r": rot if isinstance(rot, dict) else val(rot),
        "o": opacity if isinstance(opacity, dict) else val(opacity),
    }
    if skew is not None:
        t["sk"] = skew if isinstance(skew, dict) else val(skew)
        t["sa"] = val(0)
    return t


def _stack(items):
    """Развернуть стопку вложенных групп.

    Рисующий перечисляет слои снизу вверх, Lottie же считает первый
    элемент верхним. Переворачиваем только стопку групп: внутри одной
    группы порядок «фигура, потом заливка» менять нельзя, иначе стиль
    отвяжется от фигуры.
    """
    items = list(items)
    if len(items) > 1 and all(i.get("ty") == "gr" for i in items):
        return list(reversed(items))
    return items


def group(items, transform=None, name="g"):
    """Группа фигур. Трансформация обязана остаться последней."""
    return {"ty": "gr", "nm": name,
            "it": _stack(items) + [transform or gtr()]}


# --- слой и композиция -------------------------------------------------

def layer(shapes, name="l", ind=1, start=0, end=DUR, opacity=100,
          pos=None, rot=0, scale=None):
    """Слой фигур. Якорь в центре холста, чтобы масштаб под эмодзи
    сжимал картинку целиком и ничего не уезжало.

    Фигуры, как и слои, перечисляются снизу вверх."""
    c = CANVAS / 2.0
    shapes = _stack(shapes)
    return {
        "ddd": 0, "ind": ind, "ty": 4, "nm": name, "sr": 1,
        "ks": {
            "o": opacity if isinstance(opacity, dict) else val(opacity),
            "r": rot if isinstance(rot, dict) else val(rot),
            "p": pos if isinstance(pos, dict) else val(list(pos or [c, c])),
            "a": val([c, c]),
            "s": scale if isinstance(scale, dict) else val(list(scale or [100, 100])),
        },
        "ao": 0, "shapes": shapes, "ip": start, "op": end, "st": 0, "bm": 0,
    }


def compose(layers, size, name="sticker", zoom=1.0, shift=(0.0, 0.0)):
    """Собрать Lottie нужного холста.

    Слои нарисованы в 512; для эмодзи весь кадр ужимается одним
    коэффициентом - отсюда и берётся точное соответствие пары.

    Список пишется снизу вверх, как думает рисующий: сперва фон, следом
    то, что на нём лежит. Lottie же считает первый слой верхним, поэтому
    здесь порядок переворачивается.
    """
    k = size / float(CANVAS)
    c = CANVAS / 2.0
    out = []
    for i, lay in enumerate(reversed(layers)):
        l = json.loads(json.dumps(lay))
        l["ind"] = i + 1
        ks = l["ks"]
        # zoom раздвигает картинку от центра холста, shift двигает её
        # целиком: ими второй проход сборки ставит все предметы пака в
        # один размер и на один центр
        dx, dy = shift

        def px(v, i):
            return (c + (v - c) * zoom + (dx if i == 0 else dy)) * k

        if ks["p"]["a"] == 0:
            p = ks["p"]["k"]
            ks["p"] = val([px(p[0], 0), px(p[1], 1)])
        else:
            for key in ks["p"]["k"]:
                key["s"] = [px(v, i) for i, v in enumerate(key["s"])]
        if ks["s"]["a"] == 0:
            ks["s"] = val([v * k * zoom for v in ks["s"]["k"]])
        else:
            for key in ks["s"]["k"]:
                key["s"] = [v * k * zoom for v in key["s"]]
        out.append(l)
    return {
        "v": "5.5.7", "fr": FPS, "ip": 0, "op": DUR,
        "w": size, "h": size, "nm": name, "ddd": 0,
        "assets": [], "layers": out,
    }


# --- запись и проверка -------------------------------------------------

def save_tgs(data, dest):
    """Записать .tgs. mtime=0 - чтобы одинаковый рисунок давал
    одинаковый файл и сборка была воспроизводимой."""
    raw = json.dumps(data, separators=(",", ":"), ensure_ascii=False)
    raw = raw.encode("utf-8")
    os.makedirs(os.path.dirname(dest), exist_ok=True)
    with open(dest, "wb") as f:
        with gzip.GzipFile(fileobj=f, mode="wb", compresslevel=9, mtime=0) as g:
            g.write(raw)
    return os.path.getsize(dest)


def check(data, size, dest):
    """Проверить файл по требованиям Telegram. Возвращает список бед."""
    bad = []
    if data["w"] != size or data["h"] != size:
        bad.append("холст %dx%d вместо %d" % (data["w"], data["h"], size))
    if data["fr"] not in (30, 60):
        bad.append("fps %s, нужен 30 или 60" % data["fr"])
    if data["op"] > 180:
        bad.append("длина %d кадров, предел 180" % data["op"])
    n = os.path.getsize(dest)
    if n > MAX_BYTES:
        bad.append("вес %d Б, предел %d" % (n, MAX_BYTES))
    for l in data["layers"]:
        if l["ty"] != 4:
            bad.append("слой '%s' типа %d, Telegram ждёт фигуры" %
                       (l.get("nm"), l["ty"]))
        if "hasMask" in l or "masksProperties" in l:
            bad.append("слой '%s' с маской, она не поддержана" % l.get("nm"))
        if "ef" in l:
            bad.append("слой '%s' с эффектом, он не поддержан" % l.get("nm"))
    return bad


# --- мелкие помощники --------------------------------------------------

def on_circle(cx, cy, r, deg):
    """Точка на окружности; 0 градусов - вверх, дальше по часовой."""
    a = math.radians(deg - 90)
    return cx + r * math.cos(a), cy + r * math.sin(a)


def pulse(lo, hi, times=2, dur=DUR, start_lo=True):
    """Ритмичное дыхание значения от lo до hi и обратно."""
    steps = times * 2
    frames = []
    for i in range(steps + 1):
        t = int(round(dur * i / steps))
        v = (lo if i % 2 == 0 else hi) if start_lo else (hi if i % 2 == 0 else lo)
        frames.append((t, v))
    return anim(frames)
