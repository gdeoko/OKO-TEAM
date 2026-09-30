#!/usr/bin/env python3
"""
Промпт поверхности тела: общая часть плюс своя суть.

Заказчик задал форму точно: не кусок породы, а КРАСИВАЯ ПОВЕРХНОСТЬ
ВБЛИЗИ, во весь кадр 16:9, без чёрного фона. Отсюда общая часть: снято
с малой высоты, поверхность заполняет кадр от края до края, неба и
горизонта нет, пустоты нет.

Своя суть у каждого тела лежит в тела.json и описывает, что именно
видно: у Марса дюны и русло, у Юпитера пояса и вихри, у Солнца
грануляция и пятно.

  python3 tools/surf/промпт.py mars > mars.txt
"""
import json
import os
import sys

ОБЩЕЕ = """Create one single ultra photorealistic image: {суть}.

FRAMING, THIS IS THE MOST IMPORTANT PART. The surface fills the ENTIRE frame from edge to edge, corner to corner. There is no sky, no horizon, no black space, no void, no background of any kind: every pixel of the picture is surface. The camera looks down at the ground from low altitude at a slight angle, the way a survey aircraft or a low orbital camera sees it. Wide landscape format, sixteen by nine.

SCALE AND DETAIL. Close enough that texture is readable everywhere: individual features, grains, ripples, cracks and edges are all resolved. Fine micro detail across the whole frame, nothing smeared, nothing empty, no large featureless areas. The eye should find something to read in every part of the picture.

LIGHT. A single natural key light low in the sky, raking across the surface so that every relief feature casts its own shadow and the terrain reads three dimensional. Deep but not crushed shadows, highlights that hold detail. Nothing blown out, no overexposure anywhere, no lens flare, no glow, no bloom.

COLOUR. Authentic and restrained, true to what this body actually looks like, the palette of a real scientific photograph rather than a poster. Rich but never garish.

CAMERA. The look of a real photograph from a survey camera: sharp corner to corner, high dynamic range, natural depth, no vignette, no chromatic aberration, no film grain, no visible noise.

STRICTLY FORBIDDEN: any text, any lettering, any numbers, any labels, any watermark, any logo, any measuring scale, any grid, any user interface, any frame or border, any person, any hand, any animal, any building, any road, any vehicle, any spacecraft, any rover, any footprint, any track, any horizon line, any sky, any stars, any black empty background, any cartoon or illustration style, any painting look.

Photoreal, razor sharp, highest resolution available, wide landscape sixteen by nine. Return only the image."""


def построить(ид):
    п = os.path.join(os.path.dirname(os.path.abspath(__file__)), "тела.json")
    т = json.load(open(п, encoding="utf-8"))
    if ид not in т:
        raise SystemExit("нет тела: " + ид)
    return ОБЩЕЕ.format(суть=т[ид]["суть"])


if __name__ == "__main__":
    print(построить(sys.argv[1]))
