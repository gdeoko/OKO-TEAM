"""Насколько свежий кадр похож на ТОТ САМЫЙ, который принял владелец.

Работает НА КАРТЕ, рядом с генерацией. Ничего не стоит и не упирается
ни в какие квоты — а квоты и подвели: у Gemini «платный» ключ оказался
бесплатным (20 запросов в сутки), у Claude API нулевой баланс.

## Чем меряем

CLIP ViT-L/14 переводит картинку в вектор, и близость двух векторов —
это близость СОДЕРЖАНИЯ, а не пикселей. Для нашей задачи это ровно то,
что нужно: поза, ракурс, число людей, общая композиция дают высокое
сходство; другая поза, потерянный человек, обрезанная голова, лишняя
одежда — низкое. Лицо и обстановка при этом могут меняться сколько
угодно (у каждого клиента они свои), и на сходство это влияет слабо.

## Чего НЕ меряем

Мелкую анатомию: пальцы, зубы, ногти. Их CLIP не видит, и это к
лучшему — владелец принял кадры, где с пальцами не всё идеально, и
придирка к ним означала бы три лишние генерации на каждую кнопку.

## Как пользоваться

    python3 skhozhest.py эталоны.json            # посчитать эталоны
    python3 skhozhest.py --проверь файл.png ключ # сходство с эталоном

Эталоны считаются один раз и лежат в `/home/ubuntu/etalony.npz`.
"""
import json
import os
import sys

import numpy as np
import torch
from PIL import Image
from transformers import CLIPModel, CLIPProcessor

МОДЕЛЬ = "openai/clip-vit-large-patch14"
ФАЙЛ = os.environ.get("AMBERRY_ETALONS_NPZ", "/home/ubuntu/etalony.npz")
_м = _п = None


def _загрузить():
    """Модель поднимается на ПРОЦЕССОРЕ, и это не экономия, а
    необходимость: на карте живёт ComfyUI и занимает 42 ГБ из 48.
    Одна картинка считается на процессоре меньше секунды — быстрее,
    чем генерация, ради которой всё и затевалось."""
    global _м, _п
    if _м is None:
        _м = CLIPModel.from_pretrained(МОДЕЛЬ).eval()
        _п = CLIPProcessor.from_pretrained(МОДЕЛЬ)
    return _м, _п


def вектор(путь):
    """Один вектор на картинку.

    `get_image_features` в transformers 5 отдаёт признаки ПО ТОКЕНАМ
    (1, 257, 1024), а не один вектор на картинку, как раньше. Нам нужен
    именно один: берём pooler у зрительной башни и прогоняем через её
    проекцию — это и есть то, что раньше возвращалось.
    """
    м, п = _загрузить()
    и = Image.open(путь).convert("RGB")
    с = п(images=и, return_tensors="pt")
    with torch.no_grad():
        out = м.vision_model(pixel_values=с["pixel_values"])
        pooled = out.pooler_output if hasattr(out, "pooler_output") else out[1]
        в = м.visual_projection(pooled)[0]
    return (в / в.norm()).numpy()


def сходство(а, б):
    return float(np.dot(а, б))


def посчитать_эталоны(карта):
    """карта: {ключ_кнопки: путь_к_принятому_кадру}"""
    out = {}
    for ключ, путь in карта.items():
        if os.path.exists(путь):
            out[ключ] = вектор(путь)
            print("эталон", ключ, flush=True)
        else:
            print("НЕТ ФАЙЛА", ключ, путь, flush=True)
    np.savez(ФАЙЛ, **out)
    return out


def эталоны():
    if not os.path.exists(ФАЙЛ):
        return {}
    d = np.load(ФАЙЛ)
    return {k: d[k] for k in d.files}


def проверить(путь, ключ):
    э = эталоны()
    if ключ not in э:
        return None
    return сходство(вектор(путь), э[ключ])


if __name__ == "__main__":
    if sys.argv[1] == "--проверь":
        print(json.dumps({"сходство": проверить(sys.argv[2], sys.argv[3])}))
    else:
        посчитать_эталоны(json.load(open(sys.argv[1], encoding="utf-8")))
