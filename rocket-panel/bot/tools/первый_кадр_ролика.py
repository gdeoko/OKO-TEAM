# -*- coding: utf-8 -*-
"""Взял ли ролик наш кадр первым. Числом, а не на глаз.

Из ролика вынимается самый первый кадр и сравнивается с тем снимком,
который мы отправили: среднее отклонение по яркости. Свой кадр даёт
единицы, чужой — десятки. Это единственный способ поймать подмену:
сервис на неправильное поле отвечает 200 и снимает ролик с нуля."""
import os, subprocess, sys
from PIL import Image, ImageChops, ImageStat

РОЛИК = sys.argv[1]
СНИМОК = sys.argv[2]
кадр = "/tmp/f0.png"
subprocess.run(["ffmpeg", "-nostdin", "-v", "error", "-y", "-i", РОЛИК,
                "-frames:v", "1", кадр], check=True)
а = Image.open(кадр).convert("L")
б = Image.open(СНИМОК).convert("L").resize(а.size)
о = ImageStat.Stat(ImageChops.difference(а, б)).mean[0]
print("%-44s первый кадр против снимка: отклонение %.1f -> %s"
      % (os.path.basename(РОЛИК), о,
         "ЭТО НАШ КАДР" if о < 12 else "кадр ЧУЖОЙ, снято с нуля"))
