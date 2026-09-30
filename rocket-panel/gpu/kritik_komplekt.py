#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Критик по комплекту: референс + результат кнопки + живые эталоны.

Задание владельца 30.09.2026: «все 7 файлов критику задачей одной». Один
кадр критик уже умеет (`kritik.py`), но дефект виден только в сравнении:
«лицо другое» - значит не то, что на референсе; «кожа каша» - значит не
такая, как на живом снимке. Поэтому модель получает все кадры сразу и
знает роль каждого.

    python3 kritik_komplekt.py <референс> <результат> <эталон1> ... [--зоны]
"""
import os
import sys

sys.path.insert(0, "/root")
import kritik  # noqa: E402

ВОПРОС = (
    "You are a strict quality inspector for an AI image generator.\n"
    "IMAGE 1 is the clothed reference photo of the woman: this is WHO she "
    "is - her face, her hair, her body shape.\n"
    "IMAGE 2 is the AI-generated result made from image 1. Inspect ONLY "
    "image 2.\n"
    "IMAGES 3 and further are REAL photographs of real women in a similar "
    "pose: they show how real skin, real anatomy and real light look.\n\n"
    "List every defect of IMAGE 2, comparing it to image 1 (identity, body "
    "shape) and to the real photos (realism). Check each category:\n"
    "1. FACE: distorted, melted, asymmetric eyes, wrong teeth; is it the "
    "same woman as image 1 or a different face?\n"
    "2. BODY SHAPE: does it keep the build of image 1 (slim, small bust, "
    "narrow waist) or is it changed, stretched, too thin, too heavy?\n"
    "3. SKIN: plastic, waxy, airbrushed, painted brush strokes, "
    "illustration or vector look, black dots or spots, white streaks, "
    "rainbow stains, oily wet shine, oversharpening, compared with the "
    "real photos.\n"
    "4. GENITALS AND BREASTS: correct realistic female anatomy like the "
    "real photos, or blurred, melted, mush, wrong shape, male organs drawn "
    "on a woman, missing parts.\n"
    "5. HANDS AND LIMBS: fused, extra or missing fingers, limbs merging "
    "into each other or into the body, bent the wrong way.\n"
    "6. LEFTOVERS: clothing remnants, extra people, text, artefacts, "
    "visible edit seams.\n\n"
    "Answer as a numbered list of defects, each with its category and "
    "where exactly it is. If a category has no defect, write the category "
    "name and 'OK'. At the end give one line: SCORE x/10 for realism of "
    "image 2 against the real photos.")


def разобрать_комплект(пути, максимум=900):
    """Все кадры одним вопросом. Каждый сжимается до 1024 по длинной
    стороне: семь полноразмерных кадров не влезают в контекст модели."""
    import tempfile
    from PIL import Image
    with tempfile.TemporaryDirectory() as д:
        малые = []
        for i, п in enumerate(пути):
            и = Image.open(п).convert("RGB")
            и.thumbnail((1024, 1024))
            к = os.path.join(д, "%02d.jpg" % i)
            и.save(к, quality=95)
            малые.append(к)
        # Тот же `спросить`, что и у одиночного разбора: штраф за повтор и
        # чистка одинаковых пунктов живут в одном месте.
        _, нет = kritik.зоны_по_скелету(пути[1])
        return kritik.спросить(малые, ВОПРОС + kritik.чего_нет(нет), максимум)


if __name__ == "__main__":
    арг = [a for a in sys.argv[1:] if not a.startswith("--")]
    if len(арг) < 3:
        raise SystemExit(__doc__)
    print("=" * 70)
    print("КОМПЛЕКТ: референс, результат и %d живых эталонов" % (len(арг) - 2))
    print("=" * 70)
    print(разобрать_комплект(арг), flush=True)
    if "--зоны" in sys.argv:
        print()
        print("=" * 70)
        print("РЕЗУЛЬТАТ ПО ЗОНАМ (увеличенные куски)")
        print("=" * 70)
        итог = kritik.разобрать(арг[1], зоны=True, референс=арг[0])
        if isinstance(итог, dict):
            for к, в in итог.items():
                print("--- %s ---" % к)
                print(в, flush=True)
        else:
            print(итог, flush=True)
