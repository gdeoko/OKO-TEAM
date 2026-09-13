# -*- coding: utf-8 -*-
"""Перенос настоящего логотипа из SVG в Lottie, без перерисовки от руки.

Правило владельца: логотип только настоящий и с сохранением пропорций.
Поэтому фирменная «R» с ракетой не рисуется заново, а берётся из
`assets/brand/rocketcdn-logo-vector.svg` и `assets/rocketvpn-logo.svg`
и переводится в фигуры Lottie один в один.

Чего в .tgs нет и что здесь делается вместо этого:
  растровые вставки (в логотипе ими залит шлейф) - заменяются вектором,
  тени-фильтры - опускаются, они и так не читаются в размере строки.
"""

import re
import xml.etree.ElementTree as ET

from tgs import val

NS = "{http://www.w3.org/2000/svg}"


# --- разбор атрибута d --------------------------------------------------

_NUM = re.compile(r"[-+]?(?:\d*\.\d+|\d+\.?)(?:[eE][-+]?\d+)?")


def _nums(s):
    return [float(x) for x in _NUM.findall(s)]


def parse_path(d):
    """SVG-путь -> список контуров [(точки, замкнут)].

    Точка: (x, y, in_x, in_y, out_x, out_y) - касательные абсолютные,
    приводятся к относительным уже при выводе.
    """
    tokens = re.findall(r"([MmLlHhVvCcSsQqTtAaZz])([^MmLlHhVvCcSsQqTtAaZz]*)",
                        d)
    contours, pts = [], []
    cx = cy = sx = sy = 0.0
    prev_c2 = None   # вторая опорная точка прошлой кубической - для S
    prev_q = None    # опорная точка прошлой квадратичной - для T

    def add(x, y):
        pts.append([x, y, x, y, x, y])

    for cmd, argstr in tokens:
        a = _nums(argstr)
        rel = cmd.islower()
        c = cmd.upper()

        if c == "M":
            for i in range(0, len(a) - 1, 2):
                x, y = a[i], a[i + 1]
                if rel:
                    x, y = cx + x, cy + y
                if i == 0:
                    if pts:
                        contours.append((pts, False))
                        pts = []
                    sx, sy = x, y
                    add(x, y)
                else:
                    add(x, y)
                cx, cy = x, y
            prev_c2 = prev_q = None

        elif c in "LHV":
            if c == "L":
                seq = [(a[i], a[i + 1]) for i in range(0, len(a) - 1, 2)]
            elif c == "H":
                seq = [(v, 0 if rel else cy) for v in a]
            else:
                seq = [(0 if rel else cx, v) for v in a]
            for x, y in seq:
                if rel:
                    x, y = cx + x, cy + y
                add(x, y)
                cx, cy = x, y
            prev_c2 = prev_q = None

        elif c in "CS":
            step = 6 if c == "C" else 4
            for i in range(0, len(a) - step + 1, step):
                if c == "C":
                    x1, y1, x2, y2, x, y = a[i:i + 6]
                    if rel:
                        x1, y1, x2, y2, x, y = (cx + x1, cy + y1, cx + x2,
                                                cy + y2, cx + x, cy + y)
                else:
                    x2, y2, x, y = a[i:i + 4]
                    if rel:
                        x2, y2, x, y = cx + x2, cy + y2, cx + x, cy + y
                    # зеркалим прошлую опорную - так работает S
                    if prev_c2:
                        x1, y1 = 2 * cx - prev_c2[0], 2 * cy - prev_c2[1]
                    else:
                        x1, y1 = cx, cy
                if pts:
                    pts[-1][4], pts[-1][5] = x1, y1
                add(x, y)
                pts[-1][2], pts[-1][3] = x2, y2
                prev_c2 = (x2, y2)
                cx, cy = x, y
            prev_q = None

        elif c in "QT":
            step = 4 if c == "Q" else 2
            for i in range(0, len(a) - step + 1, step):
                if c == "Q":
                    qx, qy, x, y = a[i:i + 4]
                    if rel:
                        qx, qy, x, y = cx + qx, cy + qy, cx + x, cy + y
                else:
                    x, y = a[i:i + 2]
                    if rel:
                        x, y = cx + x, cy + y
                    if prev_q:
                        qx, qy = 2 * cx - prev_q[0], 2 * cy - prev_q[1]
                    else:
                        qx, qy = cx, cy
                # квадратичная -> кубическая, Lottie знает только кубические
                c1 = (cx + 2.0 / 3 * (qx - cx), cy + 2.0 / 3 * (qy - cy))
                c2 = (x + 2.0 / 3 * (qx - x), y + 2.0 / 3 * (qy - y))
                if pts:
                    pts[-1][4], pts[-1][5] = c1
                add(x, y)
                pts[-1][2], pts[-1][3] = c2
                prev_q = (qx, qy)
                cx, cy = x, y
            prev_c2 = None

        elif c == "A":
            for i in range(0, len(a) - 6, 7):
                rx, ry, rot, laf, sf, x, y = a[i:i + 7]
                if rel:
                    x, y = cx + x, cy + y
                for seg in _arc(cx, cy, rx, ry, rot, laf, sf, x, y):
                    x1, y1, x2, y2, ex, ey = seg
                    if pts:
                        pts[-1][4], pts[-1][5] = x1, y1
                    add(ex, ey)
                    pts[-1][2], pts[-1][3] = x2, y2
                cx, cy = x, y
            prev_c2 = prev_q = None

        elif c == "Z":
            if pts:
                contours.append((pts, True))
                pts = []
            cx, cy = sx, sy
            prev_c2 = prev_q = None

    if pts:
        contours.append((pts, False))
    return contours


def _arc(x0, y0, rx, ry, rot, laf, sf, x, y):
    """Дуга -> кубические куски. В логотипе дуги редки, но круглые
    скобки буквы через них и заданы."""
    import math
    if rx == 0 or ry == 0 or (x0 == x and y0 == y):
        return []
    rx, ry = abs(rx), abs(ry)
    fi = math.radians(rot)
    cosf, sinf = math.cos(fi), math.sin(fi)
    dx2, dy2 = (x0 - x) / 2.0, (y0 - y) / 2.0
    x1 = cosf * dx2 + sinf * dy2
    y1 = -sinf * dx2 + cosf * dy2
    lam = x1 * x1 / (rx * rx) + y1 * y1 / (ry * ry)
    if lam > 1:
        s = math.sqrt(lam)
        rx, ry = rx * s, ry * s
    sign = -1 if laf == sf else 1
    num = rx * rx * ry * ry - rx * rx * y1 * y1 - ry * ry * x1 * x1
    den = rx * rx * y1 * y1 + ry * ry * x1 * x1
    co = sign * math.sqrt(max(num / den, 0)) if den else 0
    cx1, cy1 = co * rx * y1 / ry, -co * ry * x1 / rx
    cx = cosf * cx1 - sinf * cy1 + (x0 + x) / 2.0
    cy = sinf * cx1 + cosf * cy1 + (y0 + y) / 2.0

    def ang(ux, uy, vx, vy):
        d = (math.hypot(ux, uy) * math.hypot(vx, vy))
        if not d:
            return 0
        c = max(-1, min(1, (ux * vx + uy * vy) / d))
        a = math.acos(c)
        return -a if ux * vy - uy * vx < 0 else a

    th0 = ang(1, 0, (x1 - cx1) / rx, (y1 - cy1) / ry)
    dth = ang((x1 - cx1) / rx, (y1 - cy1) / ry,
              (-x1 - cx1) / rx, (-y1 - cy1) / ry)
    if not sf and dth > 0:
        dth -= 2 * math.pi
    elif sf and dth < 0:
        dth += 2 * math.pi

    out = []
    n = int(math.ceil(abs(dth / (math.pi / 2))))
    for i in range(n):
        a0 = th0 + dth * i / n
        a1 = th0 + dth * (i + 1) / n
        t = 4.0 / 3 * math.tan((a1 - a0) / 4)

        def pt(ang_):
            px = cosf * rx * math.cos(ang_) - sinf * ry * math.sin(ang_) + cx
            py = sinf * rx * math.cos(ang_) + cosf * ry * math.sin(ang_) + cy
            return px, py

        def dp(ang_):
            px = -cosf * rx * math.sin(ang_) - sinf * ry * math.cos(ang_)
            py = -sinf * rx * math.sin(ang_) + cosf * ry * math.cos(ang_)
            return px, py

        p0, p1 = pt(a0), pt(a1)
        d0, d1 = dp(a0), dp(a1)
        out.append((p0[0] + t * d0[0], p0[1] + t * d0[1],
                    p1[0] - t * d1[0], p1[1] - t * d1[1], p1[0], p1[1]))
    return out


# --- трансформации ------------------------------------------------------

def parse_transform(s):
    """transform -> матрица (a, b, c, d, e, f)."""
    m = (1.0, 0, 0, 1.0, 0, 0)
    if not s:
        return m
    for name, args in re.findall(r"(\w+)\s*\(([^)]*)\)", s):
        a = _nums(args)
        if name == "matrix" and len(a) == 6:
            n = tuple(a)
        elif name == "translate":
            n = (1, 0, 0, 1, a[0], a[1] if len(a) > 1 else 0)
        elif name == "scale":
            sx = a[0]
            sy = a[1] if len(a) > 1 else sx
            n = (sx, 0, 0, sy, 0, 0)
        elif name == "rotate":
            import math
            r = math.radians(a[0])
            n = (math.cos(r), math.sin(r), -math.sin(r), math.cos(r), 0, 0)
            if len(a) >= 3:
                m = mul(m, (1, 0, 0, 1, a[1], a[2]))
                m = mul(m, n)
                m = mul(m, (1, 0, 0, 1, -a[1], -a[2]))
                continue
        else:
            continue
        m = mul(m, n)
    return m


def mul(m, n):
    a1, b1, c1, d1, e1, f1 = m
    a2, b2, c2, d2, e2, f2 = n
    return (a1 * a2 + c1 * b2, b1 * a2 + d1 * b2,
            a1 * c2 + c1 * d2, b1 * c2 + d1 * d2,
            a1 * e2 + c1 * f2 + e1, b1 * e2 + d1 * f2 + f1)


def apply(m, x, y):
    a, b, c, d, e, f = m
    return a * x + c * y + e, b * x + d * y + f


# --- цвет и градиенты ---------------------------------------------------

NAMED = {"white": "#FFFFFF", "black": "#000000", "none": None,
         "red": "#FF0000", "blue": "#0000FF"}


def _hex(c):
    """Цвет SVG -> [r, g, b] долями."""
    if not c:
        return None
    c = c.strip()
    if c.lower() in NAMED:
        c = NAMED[c.lower()]
        if c is None:
            return None
    if c.startswith("#"):
        h = c[1:]
        if len(h) == 3:
            h = "".join(ch * 2 for ch in h)
        return [int(h[i:i + 2], 16) / 255.0 for i in (0, 2, 4)]
    m = re.match(r"rgba?\(([^)]*)\)", c)
    if m:
        p = _nums(m.group(1))
        return [p[0] / 255.0, p[1] / 255.0, p[2] / 255.0]
    return None


def read_gradients(root):
    """Собрать определения градиентов по id."""
    out = {}
    for kind in ("linearGradient", "radialGradient"):
        for g in root.iter(NS + kind):
            gid = g.get("id")
            if not gid:
                continue
            stops = []
            for s in g.iter(NS + "stop"):
                off = float(s.get("offset", 0) or 0)
                col = _hex(s.get("stop-color", "#000000")) or [0, 0, 0]
                op = float(s.get("stop-opacity", 1) or 1)
                stops.append((off, col, op))
            if not stops:
                continue
            out[gid] = {
                "kind": 1 if kind == "linearGradient" else 2,
                "stops": stops,
                "x1": float(g.get("x1", 0) or 0), "y1": float(g.get("y1", 0) or 0),
                "x2": float(g.get("x2", 0) or 0), "y2": float(g.get("y2", 0) or 0),
                "cx": float(g.get("cx", 0) or 0), "cy": float(g.get("cy", 0) or 0),
                "r": float(g.get("r", 0) or 0),
                "tr": parse_transform(g.get("gradientTransform")),
            }
    return out


def _grad_fill(gd, m, opacity):
    """Градиент SVG -> заливка Lottie, с учётом трансформаций."""
    gm = mul(m, gd["tr"])
    if gd["kind"] == 1:
        p0 = apply(gm, gd["x1"], gd["y1"])
        p1 = apply(gm, gd["x2"], gd["y2"])
    else:
        p0 = apply(gm, gd["cx"], gd["cy"])
        p1 = apply(gm, gd["cx"] + gd["r"], gd["cy"])
    cols, alphas = [], []
    transparent = False
    for off, col, op in gd["stops"]:
        cols += [off] + col
        alphas += [off, op]
        if op < 1:
            transparent = True
    k = cols + alphas if transparent else cols
    return {"ty": "gf", "t": gd["kind"], "o": val(opacity), "r": 1,
            "s": val([p0[0], p0[1]]), "e": val([p1[0], p1[1]]),
            "g": {"p": len(gd["stops"]), "k": val(k)}}


# --- обход документа ----------------------------------------------------

def _shape_from(el, m):
    """Геометрия элемента -> фигуры Lottie в мировых координатах."""
    tag = el.tag.replace(NS, "")
    out = []
    if tag == "path":
        d = el.get("d")
        if not d:
            return out
        for pts, closed in parse_path(d):
            v, i, o = [], [], []
            for p in pts:
                vx, vy = apply(m, p[0], p[1])
                ix, iy = apply(m, p[2], p[3])
                ox, oy = apply(m, p[4], p[5])
                v.append([vx, vy])
                i.append([ix - vx, iy - vy])   # касательные относительны вершине
                o.append([ox - vx, oy - vy])
            out.append({"ty": "sh", "ks": val({"i": i, "o": o, "v": v,
                                               "c": closed})})
    elif tag == "rect":
        x = float(el.get("x", 0) or 0); y = float(el.get("y", 0) or 0)
        w = float(el.get("width", 0) or 0); h = float(el.get("height", 0) or 0)
        rx = float(el.get("rx", 0) or 0)
        cx, cy = apply(m, x + w / 2.0, y + h / 2.0)
        sx = (m[0] ** 2 + m[1] ** 2) ** 0.5
        sy = (m[2] ** 2 + m[3] ** 2) ** 0.5
        out.append({"ty": "rc", "p": val([cx, cy]),
                    "s": val([w * sx, h * sy]), "r": val(rx * sx)})
    elif tag in ("circle", "ellipse"):
        cx0 = float(el.get("cx", 0) or 0); cy0 = float(el.get("cy", 0) or 0)
        if tag == "circle":
            rx = ry = float(el.get("r", 0) or 0)
        else:
            rx = float(el.get("rx", 0) or 0); ry = float(el.get("ry", 0) or 0)
        cx, cy = apply(m, cx0, cy0)
        sx = (m[0] ** 2 + m[1] ** 2) ** 0.5
        sy = (m[2] ** 2 + m[3] ** 2) ** 0.5
        out.append({"ty": "el", "p": val([cx, cy]),
                    "s": val([rx * 2 * sx, ry * 2 * sy])})
    return out


def convert(svg_path, skip_raster=True):
    """SVG -> список групп Lottie в координатах исходного viewBox.

    Возвращает (группы, ширина, высота). Элементы с растровой заливкой
    пропускаются: в .tgs картинок нет, их рисуем вектором отдельно.
    """
    tree = ET.parse(svg_path)
    root = tree.getroot()
    grads = read_gradients(root)
    vb = root.get("viewBox")
    if vb:
        p = _nums(vb)
        w, h = p[2], p[3]
    else:
        w = float(root.get("width", 512)); h = float(root.get("height", 512))

    groups = []
    skipped = []

    def walk(node, m, inherited_op=1.0):
        for el in node:
            tag = el.tag.replace(NS, "")
            if tag in ("defs", "pattern", "linearGradient", "radialGradient",
                       "filter", "clipPath", "mask", "image", "use", "title"):
                continue
            lm = mul(m, parse_transform(el.get("transform")))
            op = inherited_op * float(el.get("opacity", 1) or 1)
            if tag == "g":
                walk(el, lm, op)
                continue
            f = el.get("fill")
            if f is None:
                f = "#000000"
            if f == "none":
                continue
            fo = float(el.get("fill-opacity", 1) or 1) * op
            shapes = _shape_from(el, lm)
            if not shapes:
                continue
            gm = re.match(r"url\(#([^)]+)\)", f or "")
            if gm:
                gid = gm.group(1)
                if gid not in grads:
                    # это растровый pattern - его рисуем вектором вручную
                    skipped.append((tag, el.get("x"), el.get("y"),
                                    el.get("width"), el.get("height")))
                    continue
                style = _grad_fill(grads[gid], lm, round(fo * 100, 2))
            else:
                col = _hex(f)
                if col is None:
                    continue
                style = {"ty": "fl", "c": val(col), "o": val(round(fo * 100, 2)),
                         "r": 1}
            groups.append({"ty": "gr", "nm": el.get("id") or tag,
                           "it": shapes + [style, {
                               "ty": "tr", "p": val([0, 0]), "a": val([0, 0]),
                               "s": val([100, 100]), "r": val(0),
                               "o": val(100)}]})

    walk(root, (1.0, 0, 0, 1.0, 0, 0))
    convert.skipped = skipped
    return groups, w, h
