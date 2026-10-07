# -*- coding: utf-8 -*-
"""Убираем вывеску «КЛАСТЕР» с фасада: клонируем чистый кусок той же полосы слева."""
from PIL import Image, ImageFilter

ИСХ = "/opt/oko-poster/klaster_svet/EV-01-svet-tur.png"
КУДА = "/opt/oko-poster/klaster_svet/EV-01-svet-tur-bez-vyveski.png"

и = Image.open(ИСХ).convert("RGB")
# Донор: та же светлая полоса фасада левее вывески, текста там нет.
донор = и.crop((1082, 444, 1190, 498))
цель = (1190, 446, 1315, 500)
кусок = донор.resize((цель[2] - цель[0], цель[3] - цель[1]))
и.paste(кусок, (цель[0], цель[1]))
# Мягкий шов по вертикальной границе склейки.
шов = и.crop((цель[0] - 4, цель[1], цель[0] + 4, цель[3]))
и.paste(шов.filter(ImageFilter.GaussianBlur(1.0)), (цель[0] - 4, цель[1]))
и.save(КУДА)
print("готово", КУДА)

п = и.crop((1036, 357, 1541, 583))
п.resize((п.width * 2, п.height * 2)).save("/tmp/ev01_patch2.jpg", quality=90)
