# -*- coding: utf-8 -*-
"""Лицо на готовом кадре: подмена черт и возврат резкости.

## Два шага, и они разные

`inswapper` ставит ЛИЧНОСТЬ: глаза, нос, рот, форму челюсти. Замер на
парном кадре - сходство с живым фото поднялось с 0.23 и 0.44 до 0.89 и
0.92 при пороге «тот же человек» 0.45.

`GPEN-512` возвращает РЕЗКОСТЬ, которую подмена теряет: внутри
`inswapper` работает в 128 точек, и резкость лица падает с 952 до 117
по Лапласу. GPEN поднимает её до 356, сходство при этом теряет сотые.
Личность он не переносит вовсе: на кадре без подмены сходство как было
0.20 и 0.44, так и осталось. Поэтому он идёт ПОСЛЕ, а не вместо.

Сравнивались трое. GFPGAN 1.4: резкость 216, сходство 0.850. CodeFormer:
250 и 0.857. GPEN-512: 356 и 0.867. Выиграл GPEN по обоим числам.

## Кто есть кто решает сходство, а не пол

`insightface` на лежащем мужчине в парном кадре определил пол как
женский, и подмена отдала Марку лицо Марии. Поэтому роли раздаются
перебором: из двух раскладов берётся тот, где сумма сходств выше.

## Два прохода, и донор ровно один

Второй проход по уже подменённому лицу поднимает сходство ещё немного.
Третий не даёт ничего. Усреднять эмбеддинг по нескольким фото донора
ВРЕДНО: фронт и профиль вместе дали 0.82 вместо 0.91.

## Шаг мягко отключается

Нет внешнего питона, нет весов - кадр уходит как есть. Это хуже, но это
кадр, а не осечка.
"""
import json
import os
import subprocess
import tempfile

ПИТОН = os.environ.get("OKO_FACE_PY") or ""
СВОП = os.path.expanduser(os.environ.get(
    "OKO_SWAP_MODEL", "~/.insightface/models/inswapper_128.onnx"))
GPEN = os.path.expanduser(os.environ.get(
    "OKO_GPEN_MODEL", "~/.face/gpen_bfr_512.onnx"))

_СКРИПТ = r'''
import json, sys, os
import cv2, numpy as np, insightface, onnxruntime
from insightface.app import FaceAnalysis

зад = json.load(open(sys.argv[1]))
апп = FaceAnalysis(name="buffalo_l", providers=["CPUExecutionProvider"])
апп.prepare(ctx_id=-1, det_size=(640, 640))

# ЛИЦА ИЩУТСЯ НА УМЕНЬШЕННОЙ КОПИИ, А ТОЧКИ ПЕРЕСЧИТЫВАЮТСЯ ВВЕРХ.
#
# На кадре 3840 точек распознаватель нашёл ОДНО лицо из двух: внутри он
# ужимает картинку до 640 и мелкое лицо после такого ужатия пропадает.
# Мужчине из-за этого не ставилось лицо вовсе (сходство 0.15). На копии
# в 1536 находятся оба, а подмена работает по точкам, и точки масштаб
# переживают.
from insightface.app.common import Face
СТОРОНА = 1536

def лица_на(к):
    м = min(1.0, СТОРОНА / float(max(к.shape[:2])))
    малый = к if м == 1.0 else cv2.resize(
        к, (int(к.shape[1] * м), int(к.shape[0] * м)),
        interpolation=cv2.INTER_AREA)
    найдено = апп.get(малый)
    if м == 1.0:
        return sorted(найдено, key=lambda z: z.bbox[0])
    итог = []
    for л in найдено:
        н = Face(bbox=(л.bbox / м).astype("float32"),
                 kps=(л.kps / м).astype("float32"),
                 det_score=л.det_score, embedding=л.embedding)
        itog_sex = getattr(л, "gender", None)
        if itog_sex is not None:
            н.gender = л.gender
        итог.append(н)
    return sorted(итог, key=lambda z: z.bbox[0])

кадр = cv2.imread(зад["кадр"])
итог = кадр.copy()
отчёт = {"лиц": 0, "роли": [], "резкость": {}}

def сх(a, b):
    return float(np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b)))

доноры = {}
for роль, путь in зад["доноры"].items():
    к = cv2.imread(путь)
    если = апп.get(к) if к is not None else []
    if если:
        доноры[роль] = max(если, key=lambda z: (z.bbox[2]-z.bbox[0]))
отчёт["доноров"] = len(доноры)

def раздать(лица):
    """Кто есть кто по сходству: пол insightface на лежащем теле врёт."""
    имена = list(доноры)
    if not имена or not лица:
        return []
    if len(лица) == 2 and len(имена) == 2:
        a, b = лица
        прямо = (сх(a.normed_embedding, доноры[имена[0]].normed_embedding)
                 + сх(b.normed_embedding, доноры[имена[1]].normed_embedding))
        крест = (сх(a.normed_embedding, доноры[имена[1]].normed_embedding)
                 + сх(b.normed_embedding, доноры[имена[0]].normed_embedding))
        return ([(a, имена[0]), (b, имена[1])] if прямо >= крест
                else [(a, имена[1]), (b, имена[0])])
    return [(л, max(имена, key=lambda н: сх(л.normed_embedding,
            доноры[н].normed_embedding))) for л in лица]

def резкость(к, рамка):
    x1, y1, x2, y2 = [int(v) for v in рамка]
    кусок = к[max(0, y1):y2, max(0, x1):x2]
    if кусок.size == 0:
        return 0.0
    return float(cv2.Laplacian(cv2.cvtColor(кусок, cv2.COLOR_BGR2GRAY),
                               cv2.CV_64F).var())

if доноры and зад.get("своп") and os.path.exists(зад["своп"]):
    мен = insightface.model_zoo.get_model(
        зад["своп"], providers=["CPUExecutionProvider"])
    for _ in range(2):
        лица = лица_на(итог)
        отчёт["лиц"] = len(лица)
        for л, имя in раздать(лица):
            итог = мен.get(итог, л, доноры[имя], paste_back=True)
    отчёт["роли"] = [и for _, и in раздать(лица_на(итог))]

# ---- возврат резкости ----
ШАБЛОН = np.array([[192.98138, 239.94708], [318.90277, 240.19366],
                   [256.63416, 314.01935], [201.26117, 371.41043],
                   [313.08905, 371.15118]], np.float32)

def вырезать(к, точки, сторона=512):
    м = ШАБЛОН * (сторона / 512.0)
    матрица, _ = cv2.estimateAffinePartial2D(
        np.asarray(точки, np.float32), м, method=cv2.LMEDS)
    return cv2.warpAffine(к, матрица, (сторона, сторона),
                          borderMode=cv2.BORDER_REPLICATE), матрица

def вклеить(к, лицо, матрица, перо=0.08):
    обратно = cv2.invertAffineTransform(матрица)
    с = лицо.shape[0]
    маска = np.ones((с, с), np.float32)
    поле = int(с * перо)
    маска[:поле] = маска[-поле:] = 0
    маска[:, :поле] = маска[:, -поле:] = 0
    маска = cv2.GaussianBlur(маска, (0, 0), с * 0.04)
    м3 = np.clip(cv2.warpAffine(маска, обратно, (к.shape[1], к.shape[0])),
                 0, 1)[:, :, None]
    л = cv2.warpAffine(лицо, обратно, (к.shape[1], к.shape[0]))
    return (л * м3 + к * (1 - м3)).astype(np.uint8)

if зад.get("резче") and os.path.exists(зад["резче"]):
    о = onnxruntime.SessionOptions()
    o_уровень = 3
    о.log_severity_level = o_уровень
    сес = onnxruntime.InferenceSession(
        зад["резче"], о, providers=["CPUExecutionProvider"])
    for л in лица_на(итог):
        отчёт["резкость"].setdefault("до", []).append(
            round(резкость(итог, л.bbox)))
        вырез, матрица = вырезать(итог, л.kps)
        х = cv2.cvtColor(cv2.resize(вырез, (512, 512)), cv2.COLOR_BGR2RGB)
        х = ((х.astype(np.float32) / 255.0 - 0.5) / 0.5).transpose(2, 0, 1)
        у = сес.run(None, {сес.get_inputs()[0].name: х[None]})[0][0]
        у = np.clip(у.transpose(1, 2, 0), -1, 1)
        лучше = cv2.cvtColor(((у + 1) / 2 * 255).astype(np.uint8),
                             cv2.COLOR_RGB2BGR)
        итог = вклеить(итог, лучше, матрица)
    for л in лица_на(итог):
        отчёт["резкость"].setdefault("после", []).append(
            round(резкость(итог, л.bbox)))

for роль, донор in доноры.items():
    лица = лица_на(итог)
    if лица:
        отчёт.setdefault("сходство", {})[роль] = round(max(
            сх(л.normed_embedding, донор.normed_embedding) for л in лица), 3)
cv2.imwrite(зад["выход"], итог)
print(json.dumps(отчёт, ensure_ascii=False))
'''


def доступен():
    return bool(ПИТОН and os.path.exists(ПИТОН) and os.path.exists(СВОП))


def поставить(кадр_путь, доноры, выход=None, резче=True):
    """Подменить лица и вернуть резкость. Возвращает (путь, отчёт).

    `доноры` - словарь роль -> путь к фото человека. Роль любая, она
    нужна только отчёту: кто есть кто решается сходством.
    """
    выход = выход or кадр_путь
    if not доступен():
        return кадр_путь, {"пропущено": "нет питона или модели"}
    зад = {"кадр": кадр_путь, "выход": выход, "доноры": доноры,
           "своп": СВОП, "резче": GPEN if резче else ""}
    with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False,
                                     encoding="utf-8") as ф:
        json.dump(зад, ф, ensure_ascii=False)
        путь_зад = ф.name
    with tempfile.NamedTemporaryFile("w", suffix=".py", delete=False,
                                     encoding="utf-8") as ф:
        ф.write(_СКРИПТ)
        путь_скр = ф.name
    try:
        о = subprocess.run([ПИТОН, путь_скр, путь_зад],
                           capture_output=True, timeout=600)
        строки = (о.stdout or b"").decode().strip().splitlines()
        отчёт = json.loads(строки[-1]) if строки else {}
        return выход, отчёт
    except Exception as e:                                  # noqa: BLE001
        print("ЛИЦО: %s" % str(e)[:160], flush=True)
        return кадр_путь, {"ошибка": str(e)[:160]}
    finally:
        for п in (путь_зад, путь_скр):
            try:
                os.unlink(п)
            except OSError:
                pass
