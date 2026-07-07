# -*- coding: utf-8 -*-
"""
Единая точка правды дизайна оклейки витрины ЗооОпт.
Все цвета — CMYK (для типографии), все размеры — в сантиметрах реального изделия.
Печатная геометрия: bleed 5 мм со всех сторон + метки реза (crop marks).
"""
import os
from reportlab.lib.units import mm
from reportlab.lib.colors import CMYKColor
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

# ------------------------------------------------------------------ пути
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ASSETS = os.path.join(ROOT, "assets")
FONTS = os.path.join(ASSETS, "fonts")
SIL = os.path.join(ASSETS, "silhouettes")
OUTPUT = os.path.join(ROOT, "output")

# ------------------------------------------------------------------ печать
BLEED_MM = 5.0            # вылет под порез
MARK_LEN_MM = 5.0         # длина метки реза (в зоне вылета)
MARK_WEIGHT = 0.25 * mm   # толщина метки реза (~0.7pt)

# ------------------------------------------------------------------ цвета (CMYK 0..1)
def _cmyk(c, m, y, k):
    return CMYKColor(c / 100.0, m / 100.0, y / 100.0, k / 100.0)

IVORY      = _cmyk(3, 4, 9, 0)      # #F5F1E8 фон
GREEN      = _cmyk(78, 12, 100, 1)  # #1B8A3A основной
GREEN_DARK = _cmyk(85, 35, 100, 28) # #0F5C24 тёмный
YELLOW     = _cmyk(0, 13, 100, 0)   # #FFD500 акцент
BLACK      = _cmyk(0, 0, 0, 100)    # #0A0A0A текстовый чёрный
RICH_BLACK = _cmyk(60, 40, 40, 100) # глубокий чёрный для крупных плашек

# ------------------------------------------------------------------ шрифты
F_HEAD   = "Unbounded-Bold"     # заголовки
F_BLACK  = "Unbounded-Black"    # сверхжирные крупные буквы/цифры
F_HEAD_S = "Unbounded-SemiBold"
F_SUB    = "Onest-Medium"       # подписи
F_SUB_R  = "Onest-Regular"
F_SUB_B  = "Onest-Bold"

_FONT_FILES = {
    F_HEAD:   "Unbounded-Bold.ttf",
    F_BLACK:  "Unbounded-Black.ttf",
    F_HEAD_S: "Unbounded-SemiBold.ttf",
    F_SUB:    "Onest-Medium.ttf",
    F_SUB_R:  "Onest-Regular.ttf",
    F_SUB_B:  "Onest-Bold.ttf",
}

_registered = False
def register_fonts():
    global _registered
    if _registered:
        return
    for name, fn in _FONT_FILES.items():
        pdfmetrics.registerFont(TTFont(name, os.path.join(FONTS, fn)))
    _registered = True


# ================================================================== Panel
class Panel:
    """
    Одна плёнка. Работаем в сантиметрах реального изделия.
    Система координат хелперов: X слева-направо (0..W), Y СВЕРХУ-вниз (0..H),
    что удобно для верстки. Внутри переводим в нижне-левую систему reportlab.
    """
    def __init__(self, name, w_cm, h_cm, subtitle=""):
        register_fonts()
        os.makedirs(OUTPUT, exist_ok=True)
        self.name = name
        self.w = w_cm
        self.h = h_cm
        self.subtitle = subtitle
        self.bleed = BLEED_MM / 10.0  # в см
        page_w = (w_cm + 2 * self.bleed) * (10 * mm)   # см->мм->pt
        page_h = (h_cm + 2 * self.bleed) * (10 * mm)
        self.page_w = page_w
        self.page_h = page_h
        self.path = os.path.join(OUTPUT, f"{name}.pdf")
        self.c = canvas.Canvas(self.path, pagesize=(page_w, page_h))
        self.c.setTitle(f"ZoOpt vitrina — {name}")
        # дефолтный шрифт — встроенный, чтобы reportlab не тянул Helvetica в ресурсы
        self.c.setFont(F_HEAD, 12)

    # ---- перевод координат (см, сверху) -> pt reportlab (снизу) ----
    def X(self, x_cm):
        return (self.bleed + x_cm) * (10 * mm)

    def Y(self, y_cm):  # y сверху
        return (self.bleed + (self.h - y_cm)) * (10 * mm)

    def S(self, cm):    # масштаб длины см->pt
        return cm * (10 * mm)

    @property
    def cx(self):       # центр по X, см
        return self.w / 2.0

    # ---------------------------------------------------------- фон
    def background(self):
        c = self.c
        c.setFillColor(IVORY)
        c.rect(0, 0, self.page_w, self.page_h, stroke=0, fill=1)

    # -------------------------------------------- вертикальные полосы
    def edge_stripes(self, width_cm=3.0, color=GREEN):
        """Тонкие зелёные вертикальные полосы по левому и правому краю (в вылет)."""
        c = self.c
        c.setFillColor(color)
        # левая — от нижнего вылета до верхнего
        c.rect(0, 0, self.X(width_cm), self.page_h, stroke=0, fill=1)
        c.rect(self.X(self.w - width_cm), 0, self.page_w - self.X(self.w - width_cm),
               self.page_h, stroke=0, fill=1)

    # ------------------------------------------------ метки реза
    def crop_marks(self):
        c = self.c
        c.setStrokeColor(BLACK)
        c.setLineWidth(MARK_WEIGHT)
        m = MARK_LEN_MM * mm
        # четыре угла обрезного формата
        corners = [
            (self.X(0), self.Y(0)),        # низ-лево  (в pt это низ-лево трима)
            (self.X(self.w), self.Y(0)),   # низ-право
            (self.X(0), self.Y(self.h)),   # верх-лево
            (self.X(self.w), self.Y(self.h)),  # верх-право
        ]
        for (x, y) in corners:
            sx = -1 if x < self.page_w / 2 else 1
            sy = -1 if y < self.page_h / 2 else 1
            # горизонтальная и вертикальная метки в зоне вылета
            c.line(x, y, x + sx * m, y)
            c.line(x, y, x, y + sy * m)

    # ---------------------------------------------------- листочки
    def leaf(self, x_cm, y_cm, size_cm=6.0, angle=0, color=GREEN):
        """Декоративный лист-лапка (тонкий, элегантный) как на жёлтом баннере."""
        c = self.c
        c.saveState()
        c.translate(self.X(x_cm), self.Y(y_cm))
        c.rotate(angle)
        s = self.S(size_cm)
        c.setFillColor(color)
        p = c.beginPath()
        p.moveTo(0, 0)
        p.curveTo(0.30 * s, 0.15 * s, 0.55 * s, 0.55 * s, 0.5 * s, s)
        p.curveTo(0.15 * s, 0.7 * s, -0.05 * s, 0.35 * s, 0, 0)
        c.drawPath(p, stroke=0, fill=1)
        # центральная прожилка
        c.setStrokeColor(IVORY)
        c.setLineWidth(0.06 * s)
        vein = c.beginPath()
        vein.moveTo(0.05 * s, 0.06 * s)
        vein.curveTo(0.22 * s, 0.35 * s, 0.34 * s, 0.6 * s, 0.42 * s, 0.9 * s)
        c.drawPath(vein, stroke=1, fill=0)
        c.restoreState()

    def corner_leaves(self, size_cm=5.5):
        """Пара листочков в верхних углах панели (внутри полос)."""
        self.leaf(4.2, 4.0, size_cm, angle=-35)
        self.leaf(self.w - 4.2, 4.0, size_cm, angle=35, color=GREEN)

    # ------------------------------------------------------ логотип
    def logo_corner(self, height_cm=8.0, margin_cm=3.0, which="left"):
        """Маленький логотип в верхнем углу верхней плёнки."""
        return self._logo(os.path.join(ASSETS, "logo.png"),
                          height_cm, margin_cm, which)

    def _logo(self, img, height_cm, margin_cm, which):
        from reportlab.lib.utils import ImageReader
        ir = ImageReader(img)
        iw, ih = ir.getSize()
        w_cm = height_cm * iw / ih
        y = margin_cm
        if which == "left":
            x = margin_cm + 3.0  # с запасом от зелёной полосы
        elif which == "right":
            x = self.w - margin_cm - 3.0 - w_cm
        else:  # center
            x = self.cx - w_cm / 2.0
        self.c.drawImage(ir, self.X(x), self.Y(y + height_cm),
                         width=self.S(w_cm), height=self.S(height_cm),
                         mask='auto')
        return (x, y, w_cm, height_cm)

    def logo_center(self, y_cm, height_cm):
        from reportlab.lib.utils import ImageReader
        ir = ImageReader(os.path.join(ASSETS, "logo.png"))
        iw, ih = ir.getSize()
        w_cm = height_cm * iw / ih
        self.c.drawImage(ir, self.X(self.cx - w_cm / 2.0), self.Y(y_cm + height_cm),
                         width=self.S(w_cm), height=self.S(height_cm), mask='auto')
        return w_cm

    def brand_lockup(self, y_top_cm, emblem_h_cm, wordmark_cap_cm, tagline=True):
        """Логотип-локап: растровая эмблема (акцент) + ВЕКТОРНЫЙ шрифтовой знак
        «ЗОО»(зел.)+«ОПТ»(чёрн.) + подпись «СКЛАД · МАРКЕТ».
        Шрифтовая часть чёткая на любом размере; эмблема — растр (см. README)."""
        from reportlab.lib.utils import ImageReader
        ir = ImageReader(os.path.join(ASSETS, "emblem.png"))
        iw, ih = ir.getSize()
        em_w = emblem_h_cm * iw / ih
        self.c.drawImage(ir, self.X(self.cx - em_w / 2.0), self.Y(y_top_cm + emblem_h_cm),
                         width=self.S(em_w), height=self.S(emblem_h_cm), mask='auto')
        # шрифтовой знак — вписываем по ширине панели
        y_word = y_top_cm + emblem_h_cm + wordmark_cap_cm + 2.0
        left, right = "ЗОО", "ОПТ"
        max_w = self.S(self.w - 12)
        pt = self.S(wordmark_cap_cm) / 0.72
        while pt > 4 and pdfmetrics.stringWidth(left + right, F_BLACK, pt) > max_w:
            pt *= 0.97
        w_left = pdfmetrics.stringWidth(left, F_BLACK, pt)
        w_right = pdfmetrics.stringWidth(right, F_BLACK, pt)
        total = w_left + w_right
        x0 = self.X(self.cx) - total / 2.0
        yb = self.Y(y_word)
        t = self.c.beginText(x0, yb); t.setFont(F_BLACK, pt)
        t.setFillColor(GREEN); t.textOut(left)
        t.setFillColor(BLACK); t.textOut(right)
        self.c.drawText(t)
        if tagline:
            self.text(self.cx, y_word + wordmark_cap_cm * 0.7 + 1.2,
                      "СКЛАД · МАРКЕТ", F_HEAD_S, wordmark_cap_cm * 0.28,
                      BLACK, tracking=wordmark_cap_cm * 0.06)
        return y_word

    def emblem_center(self, x_cm, y_cm, height_cm):
        from reportlab.lib.utils import ImageReader
        ir = ImageReader(os.path.join(ASSETS, "emblem.png"))
        iw, ih = ir.getSize()
        w_cm = height_cm * iw / ih
        self.c.drawImage(ir, self.X(x_cm - w_cm / 2.0), self.Y(y_cm + height_cm),
                         width=self.S(w_cm), height=self.S(height_cm), mask='auto')

    # ------------------------------------------------ жёлтый круг «луна»
    def moon_circle(self, x_cm, y_cm, diameter_cm, color=YELLOW):
        c = self.c
        c.setFillColor(color)
        r = self.S(diameter_cm / 2.0)
        c.circle(self.X(x_cm), self.Y(y_cm), r, stroke=0, fill=1)

    def ai_scene(self, name, cx_cm, cy_cm, max_w_cm, max_h_cm):
        """Премиум AI-иллюстрация (assets/ai/cut_<name>.png) вписанная в бокс по центру."""
        from reportlab.lib.utils import ImageReader
        ir = ImageReader(os.path.join(ASSETS, "ai", f"cut_{name}.png"))
        iw, ih = ir.getSize()
        scale = min(max_w_cm / iw, max_h_cm / ih)
        w, h = iw * scale, ih * scale
        self.c.drawImage(ir, self.X(cx_cm - w / 2.0), self.Y(cy_cm + h / 2.0),
                         width=self.S(w), height=self.S(h), mask='auto')

    def ai_moon(self, name, x_cm, y_cm, diameter_cm, fill_frac=0.76):
        """Жёлтый круг бренда + премиум AI-силуэт (assets/ai/sil_<name>.png) по центру."""
        from reportlab.lib.utils import ImageReader
        self.moon_circle(x_cm, y_cm, diameter_cm)
        ir = ImageReader(os.path.join(ASSETS, "ai", f"sil_{name}.png"))
        iw, ih = ir.getSize()
        maxd = diameter_cm * fill_frac
        if iw >= ih:
            w = maxd; h = maxd * ih / iw
        else:
            h = maxd; w = maxd * iw / ih
        self.c.drawImage(ir, self.X(x_cm - w / 2.0), self.Y(y_cm + h / 2.0),
                         width=self.S(w), height=self.S(h), mask='auto')

    # ---------------------------------------------------------- текст
    def _draw_text(self, x_pt, y_pt, s, font, pt, color, align, track_pt):
        """Отрисовка строки текст-объектом с поддержкой межбуквенного трекинга."""
        c = self.c
        width = pdfmetrics.stringWidth(s, font, pt) + (track_pt or 0) * max(0, len(s) - 1)
        if align == "center":
            x0 = x_pt - width / 2.0
        elif align == "right":
            x0 = x_pt - width
        else:
            x0 = x_pt
        t = c.beginText(x0, y_pt)
        t.setFont(font, pt)
        t.setFillColor(color)
        t.setCharSpace(track_pt or 0)   # всегда явно — иначе трекинг «протекает» на следующий текст
        t.textOut(s)
        c.drawText(t)

    def text(self, x_cm, y_cm, s, font=F_HEAD, size_cm=6.0, color=BLACK,
             align="center", tracking=None):
        """y_cm — базовая линия (сверху). size_cm — кегль в см (высота ~ прописной)."""
        pt = self.S(size_cm) / 0.72  # см -> pt кегля с поправкой на высоту капса
        track_pt = self.S(tracking) if tracking else 0
        self._draw_text(self.X(x_cm), self.Y(y_cm), s, font, pt, color, align, track_pt)

    def text_fit(self, y_cm, s, font=F_HEAD, size_cm=6.0, color=BLACK,
                 max_w_cm=None, tracking=None):
        """Центрированный текст с автоуменьшением, чтобы влезть по ширине."""
        if max_w_cm is None:
            max_w_cm = self.w - 8.0
        register_fonts()
        pt = self.S(size_cm) / 0.72
        while pt > 4:
            w = pdfmetrics.stringWidth(s, font, pt)
            extra = self.S(tracking) * max(0, len(s) - 1) if tracking else 0
            if w + extra <= self.S(max_w_cm):
                break
            pt *= 0.96
        track_pt = self.S(tracking) if tracking else 0
        self._draw_text(self.X(self.cx), self.Y(y_cm), s, font, pt, color, "center", track_pt)
        return pt

    # ---------------------------------------------------------- QR
    def qr(self, x_cm, y_cm, size_cm, url, dark=BLACK, light=IVORY):
        import qrcode
        from qrcode.image.svg import SvgPathImage
        q = qrcode.QRCode(border=1, error_correction=qrcode.constants.ERROR_CORRECT_M)
        q.add_data(url)
        q.make(fit=True)
        m = q.get_matrix()
        n = len(m)
        cell = self.S(size_cm) / n
        c = self.c
        c.setFillColor(light)
        c.rect(self.X(x_cm), self.Y(y_cm + size_cm), self.S(size_cm), self.S(size_cm),
               stroke=0, fill=1)
        c.setFillColor(dark)
        x0 = self.X(x_cm)
        y0 = self.Y(y_cm + size_cm)
        for r in range(n):
            for col in range(n):
                if m[r][col]:
                    c.rect(x0 + col * cell, y0 + (n - 1 - r) * cell,
                           cell + 0.3, cell + 0.3, stroke=0, fill=1)

    # ------------------------------------------------------- служебное
    def frame_thin(self, inset_cm=2.0, color=GREEN, weight_cm=0.15):
        c = self.c
        c.setStrokeColor(color)
        c.setLineWidth(self.S(weight_cm))
        c.rect(self.X(inset_cm), self.Y(self.h - inset_cm),
               self.S(self.w - 2 * inset_cm), self.S(self.h - 2 * inset_cm),
               stroke=1, fill=0)

    def finish(self, marks=True):
        if marks:
            self.crop_marks()
        self.c.showPage()
        self.c.save()
        return self.path


def base_panel(name, w_cm, h_cm, top=True, logo=True, subtitle=""):
    """Готовая заготовка: фон + полосы + (логотип) + метки. Возвращает Panel."""
    p = Panel(name, w_cm, h_cm, subtitle)
    p.background()
    p.edge_stripes()
    return p
