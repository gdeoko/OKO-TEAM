# -*- coding: utf-8 -*-
"""Черты клиентки в готовом ролике, покадрово.

Модель видео перерисовывает лицо при движении: на фото узнаваемость
0.82, а в снятом с него ролике падает до 0.55-0.67. Человек платит за
ролик с СОБОЙ, поэтому лицо правится в каждом кадре тем же переносом,
что и на фото.

Замер на кнопке `un_close`: 0.669 до, 0.817 после, обработка 34 секунды
на пятисекундный ролик.

ЗВУК БЕРЁТСЯ ИЗ ИСХОДНИКА и не пересчитывается: перенос лица его не
трогает, а без дорожки ролик перестаёт быть тем, за что заплачено (за
звук мы и платим 0.02 за секунду).

КАДР БЕЗ ЛИЦА ПРОПУСКАЕТСЯ МОЛЧА. На части кадров голова уходит из вида
или смазана движением; вставлять туда лицо насильно значит получить
мерцание, которое заметнее, чем чужие черты на двух кадрах из ста.

Шаг необязательный: нет внешнего питона или модели - ролик уходит как
есть, без осечки. Включается тем же `OKO_SWAP`, что и лицо на фото.
"""
import json
import os
import subprocess
import tempfile

import лицо_своп

_СКРИПТ = r'''
import json, os, sys, av, cv2, numpy as np, insightface
from insightface.app import FaceAnalysis
зад = json.load(open(sys.argv[1]))
а = FaceAnalysis(name="buffalo_l", providers=["CPUExecutionProvider"])
а.prepare(ctx_id=-1, det_size=(640, 640))
св = insightface.model_zoo.get_model(зад["модель"],
                                     providers=["CPUExecutionProvider"])
исх = cv2.imread(зад["снимок"])
лица = а.get(исх)
if not лица:
    print(json.dumps({"беда": "на снимке клиента лица нет"})); sys.exit()
лисх = max(лица, key=lambda f: f.bbox[2] - f.bbox[0])
вх = зад["вход"]
к = av.open(вх)
вид = [s for s in к.streams if s.type == "video"][0]
фпс = float(вид.average_rate or 24)
Ш, В = вид.codec_context.width, вид.codec_context.height
кадры = [cv2.cvtColor(np.array(f.to_image()), cv2.COLOR_RGB2BGR)
         for f in av.open(вх).decode(video=0)]
правлено = 0
из = []
for ф in кадры:
    л = а.get(ф)
    if л:
        ц = max(л, key=lambda f: f.bbox[2] - f.bbox[0])
        try:
            ф = св.get(ф, ц, лисх, paste_back=True); правлено += 1
        except Exception:
            pass
    из.append(ф)
врем = зад["куда"] + ".tmp.mp4"
о = av.open(врем, "w")
сво = о.add_stream("libx264", rate=int(round(фпс)))
сво.width, сво.height, сво.pix_fmt = Ш, В, "yuv420p"
for ф in из:
    о.mux(сво.encode(av.VideoFrame.from_ndarray(
        cv2.cvtColor(ф, cv2.COLOR_BGR2RGB), format="rgb24")))
for п in сво.encode(None):
    о.mux(п)
о.close()
им = av.open(вх)
if any(s.type == "audio" for s in им.streams):
    ви = av.open(врем); вых = av.open(зад["куда"], "w")
    вп = вых.add_stream_from_template(
        [s for s in ви.streams if s.type == "video"][0])
    ап = вых.add_stream_from_template(
        [s for s in им.streams if s.type == "audio"][0])
    for п in ви.demux(video=0):
        if п.dts is None: continue
        п.stream = вп; вых.mux(п)
    for п in им.demux(audio=0):
        if п.dts is None: continue
        п.stream = ап; вых.mux(п)
    вых.close(); os.remove(врем)
else:
    os.rename(врем, зад["куда"])
print(json.dumps({"кадров": len(кадры), "правлено": правлено}))
'''


def доступен():
    return лицо_своп.доступен()


def наложить(ролик_байты, снимок_клиента):
    """Ролик с чертами клиентки или исходный, если шаг недоступен."""
    if not доступен() or not ролик_байты or снимок_клиента is None:
        return ролик_байты
    import cv2
    with tempfile.TemporaryDirectory() as пап:
        зад = {"модель": лицо_своп.МОДЕЛЬ,
               "снимок": os.path.join(пап, "снимок.png"),
               "вход": os.path.join(пап, "вход.mp4"),
               "куда": os.path.join(пап, "итог.mp4")}
        cv2.imwrite(зад["снимок"], снимок_клиента)
        open(зад["вход"], "wb").write(ролик_байты)
        файл = os.path.join(пап, "зад.json")
        json.dump(зад, open(файл, "w"))
        скрипт = os.path.join(пап, "видео.py")
        open(скрипт, "w").write(_СКРИПТ)
        try:
            о = subprocess.run([лицо_своп.ПИТОН, скрипт, файл],
                               capture_output=True, timeout=900)
            строки = о.stdout.decode("utf-8", "ignore").strip().splitlines()
            ответ = json.loads(строки[-1]) if строки else {}
        except Exception as e:                              # noqa: BLE001
            print("ВИДЕО лицо: не вышло: %s" % str(e)[:140], flush=True)
            return ролик_байты
        if ответ.get("беда") or not os.path.exists(зад["куда"]):
            print("ВИДЕО лицо: %s" % ответ.get("беда", "файла нет"),
                  flush=True)
            return ролик_байты
        print("ВИДЕО лицо: правлено %s кадров из %s"
              % (ответ.get("правлено"), ответ.get("кадров")), flush=True)
        return open(зад["куда"], "rb").read()
