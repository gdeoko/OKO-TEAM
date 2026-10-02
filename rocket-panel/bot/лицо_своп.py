# -*- coding: utf-8 -*-
"""Последний шаг лица: перенос черт клиентки на готовый кадр.

Klein переносит личность приблизительно: на кнопках, где голова мелкая
или повёрнута, узнаваемость падает до «спорно». Замер по двадцати
кнопкам: средняя 0.52, уверенно узнаётся девять из двадцати. После
этого шага - 0.84 и восемнадцать из двадцати.

Шаг НЕОБЯЗАТЕЛЬНЫЙ и мягко отключается: нет модели или нет внешнего
питона - кадр уходит как есть, без осечки.

ЧТО ДЕЛАЕТСЯ ПОСЛЕ ПЕРЕНОСА. Перенос работает на маленьком квадрате и
приносит освещение исходного снимка, поэтому лицо выходит глаже и
светлее тела, и глаз читает его как аппликацию. Правим по самому кадру:
средний тон и разброс яркости лица подтягиваем к коже ВОКРУГ него, и
добавляем ровно столько зерна, сколько на этой коже есть. Область правки
берём как РАЗНИЦУ кадров до и после: овал по долям кадра залезал на фон
и оставлял прямоугольный след.

Модель переноса (`inswapper_128.onnx`) лежит рядом с распознавателем:
`~/.insightface/models/`. Её лицензия разрешает исследования и не
разрешает коммерческое применение, поэтому шаг включается явно -
`OKO_SWAP=1` - и решение остаётся за владельцем.
"""
import json
import os
import subprocess
import tempfile

ПИТОН = os.environ.get("OKO_FACE_PY") or ""
ВКЛЮЧЁН = os.environ.get("OKO_SWAP", "") not in ("", "0", "нет")
МОДЕЛЬ = os.path.expanduser(
    os.environ.get("OKO_SWAP_MODEL",
                   "~/.insightface/models/inswapper_128.onnx"))

_СКРИПТ = r'''
import json, sys, cv2, numpy as np, insightface
from insightface.app import FaceAnalysis
зад = json.load(open(sys.argv[1]))
а = FaceAnalysis(name="buffalo_l", providers=["CPUExecutionProvider"])
а.prepare(ctx_id=-1, det_size=(640, 640))
св = insightface.model_zoo.get_model(зад["модель"],
                                     providers=["CPUExecutionProvider"])
исх = cv2.imread(зад["снимок"])
лица_исх = а.get(исх)
if not лица_исх:
    print(json.dumps({"беда": "на снимке клиента лица нет"})); sys.exit()
лицо_исх = max(лица_исх, key=lambda f: f.bbox[2] - f.bbox[0])
к = cv2.imread(зад["кадр"])
h, w = к.shape[:2]
л = а.get(к)
if not л:
    print(json.dumps({"беда": "на кадре лица нет"})); sys.exit()
ц = max(л, key=lambda f: f.bbox[2] - f.bbox[0])
до = к.copy()
out = св.get(к, ц, лицо_исх, paste_back=True)
if out.shape[:2] != (h, w):
    out = cv2.resize(out, (w, h), interpolation=cv2.INTER_AREA)

# --- свет, цвет и зерно лица как у остального кадра ---
л2 = а.get(out)
if л2:
    f = max(л2, key=lambda x: x.bbox[2] - x.bbox[0])
    x0, y0, x1, y1 = [int(v) for v in f.bbox]
    ш, в = x1 - x0, y1 - y0
    изм = (np.abs(out.astype(np.int16) - до.astype(np.int16)).max(axis=2) > 6
           ).astype(np.uint8) * 255
    изм = cv2.morphologyEx(изм, cv2.MORPH_CLOSE, np.ones((31, 31), np.uint8))
    изм = cv2.erode(изм, np.ones((7, 7), np.uint8))
    овал = np.zeros((h, w), np.uint8)
    cv2.ellipse(овал, ((x0 + x1) // 2, (y0 + y1) // 2 + в // 10),
                (int(ш * 0.62), int(в * 0.70)), 0, 0, 360, 255, -1)
    м = cv2.bitwise_and(изм, овал)
    кольцо = cv2.dilate(м, np.ones((max(9, в // 3), max(9, в // 3)),
                                   np.uint8)) > 0
    кольцо &= (м == 0)
    if (м > 0).sum() > 200 and кольцо.sum() > 300:
        lab = cv2.cvtColor(out, cv2.COLOR_BGR2LAB).astype(np.float32)
        внутр = м > 0
        for c in range(3):
            mi, si = lab[..., c][внутр].mean(), lab[..., c][внутр].std() + 1e-3
            mo, so = lab[..., c][кольцо].mean(), lab[..., c][кольцо].std() + 1e-3
            сила = 0.55 if c == 0 else 0.9
            lab[..., c][внутр] = ((lab[..., c][внутр] - mi)
                                  * (1 + (so / si - 1) * 0.35)
                                  + mi + (mo - mi) * сила)
        нов = cv2.cvtColor(np.clip(lab, 0, 255).astype(np.uint8),
                           cv2.COLOR_LAB2BGR).astype(np.float32)
        g = cv2.cvtColor(out, cv2.COLOR_BGR2GRAY).astype(np.float32)
        д = g - cv2.GaussianBlur(g, (0, 0), 1.5)
        доб = max(0.0, д[кольцо].std() ** 2 - д[внутр].std() ** 2) ** 0.5
        if доб > 0.3:
            нов += np.random.default_rng(7).normal(0, доб, (h, w, 1))
        мм = (cv2.GaussianBlur(м, (0, 0), max(3.0, в * 0.14))
              .astype(np.float32)[:, :, None] / 255)
        out = np.clip(out * (1 - мм) + нов * мм, 0, 255).astype(np.uint8)
cv2.imwrite(зад["куда"], out)
print(json.dumps({"ок": True}))
'''


def доступен():
    return (ВКЛЮЧЁН and bool(ПИТОН) and os.path.exists(ПИТОН)
            and os.path.exists(МОДЕЛЬ))


def наложить(кадр, снимок_клиента):
    """Кадр с чертами клиентки или исходный кадр, если шаг недоступен."""
    if not доступен() or кадр is None or снимок_клиента is None:
        return кадр
    import cv2
    with tempfile.TemporaryDirectory() as пап:
        зад = {"модель": МОДЕЛЬ,
               "снимок": os.path.join(пап, "снимок.png"),
               "кадр": os.path.join(пап, "кадр.png"),
               "куда": os.path.join(пап, "итог.png")}
        cv2.imwrite(зад["снимок"], снимок_клиента)
        cv2.imwrite(зад["кадр"], кадр)
        файл = os.path.join(пап, "зад.json")
        json.dump(зад, open(файл, "w"))
        скрипт = os.path.join(пап, "своп.py")
        open(скрипт, "w").write(_СКРИПТ)
        try:
            о = subprocess.run([ПИТОН, скрипт, файл], capture_output=True,
                               timeout=240)
            строки = о.stdout.decode("utf-8", "ignore").strip().splitlines()
            ответ = json.loads(строки[-1]) if строки else {}
        except Exception as e:                              # noqa: BLE001
            print("ЛИЦО своп: не вышло: %s" % str(e)[:140], flush=True)
            return кадр
        if ответ.get("беда"):
            print("ЛИЦО своп: %s" % ответ["беда"], flush=True)
            return кадр
        из = cv2.imread(зад["куда"])
        return из if из is not None else кадр
