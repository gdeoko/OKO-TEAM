#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Последний шаг перед публикацией: обложка первым кадром и музыка.

По канону завода обложка ставится ПЕРВЫМ КАДРОМ ролика (`НОРМЫ
ПРОИЗВОДСТВА`, раздел 1): площадка берёт превью именно оттуда, и без
этого в ленте показывается случайный кадр из середины.

Кадр ровно один: 1/30 секунды зритель не замечает, а площадка видит.
Ставить обложку на полсекунды нельзя - ролик начнётся с картинки, и
первые полсекунды, которые решают досмотр, уйдут в никуда.

    python3 финал.py <ролик.mp4> <обложка.png> [выход.mp4] [семя_музыки]
"""
import os
import re
import subprocess
import sys

ТУТ = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(ТУТ, "ролик-снятие"))
import звук as З                                              # noqa: E402

Ш, В, КАДРЫ = 1080, 1920, 30


def ffmpeg():
    for п in ("/usr/bin/ffmpeg", "/usr/local/bin/ffmpeg"):
        if os.path.exists(п):
            return п
    import imageio_ffmpeg
    return imageio_ffmpeg.get_ffmpeg_exe()


def сведения(в):
    п = subprocess.run([ffmpeg(), "-hide_banner", "-i", в],
                       capture_output=True, text=True)
    м = re.search(r"Duration: (\d+):(\d+):([\d.]+)", п.stderr)
    ч, мин, с = м.groups()
    длина = int(ч)*3600 + int(мин)*60 + float(с)
    return длина, ("Audio:" in п.stderr)


def оформить(ролик, обложка, выход=None, семя=None, музыка=True):
    раб = os.path.join(ТУТ, ".работа-финал")
    os.makedirs(раб, exist_ok=True)
    выход = выход or ролик.replace(".mp4", "-готово.mp4")
    семя = семя or os.path.basename(ролик)
    длина, свой_звук = сведения(ролик)

    # Обложка приводится к размеру кадра и кладётся ровно на первый кадр.
    об = os.path.join(раб, "обложка.png")
    subprocess.run([ffmpeg(), "-y", "-hide_banner", "-loglevel", "error",
                    "-i", обложка,
                    "-vf", f"scale={Ш}:{В}:force_original_aspect_ratio=increase,"
                           f"crop={Ш}:{В}", об], check=True)

    с_обложкой = os.path.join(раб, "с-обложкой.mp4")
    subprocess.run([ffmpeg(), "-y", "-hide_banner", "-loglevel", "error",
                    "-i", ролик, "-i", об,
                    "-filter_complex",
                    f"[1:v]scale={Ш}:{В},format=rgba,loop=loop=-1:size=1:start=0,"
                    f"fps={КАДРЫ},setpts=N/FRAME_RATE/TB[об];"
                    f"[0:v][об]overlay=0:0:enable='lt(t,{1.0/КАДРЫ:.4f})':"
                    f"format=auto:shortest=1[вых]",
                    "-map", "[вых]"] + (["-map", "0:a"] if свой_звук else []) + [
                    "-c:v", "libx264", "-preset", "medium", "-crf", "18",
                    "-pix_fmt", "yuv420p"] + (["-c:a", "copy"] if свой_звук else []) + [
                    "-movflags", "+faststart", с_обложкой], check=True)

    if свой_звук or not музыка:
        subprocess.run([ffmpeg(), "-y", "-hide_banner", "-loglevel", "error",
                        "-i", с_обложкой, "-c", "copy", "-movflags", "+faststart",
                        выход], check=True)
    else:
        дор = None
        try:
            дор = З.дорожка(семя, длина, [], ffmpeg(),
                            os.path.join(раб, "звук.m4a"))
        except Exception as e:
            print("музыка не собралась (%s)" % e, flush=True)
        if дор:
            subprocess.run([ffmpeg(), "-y", "-hide_banner", "-loglevel", "error",
                            "-i", с_обложкой, "-i", дор, "-map", "0:v", "-map", "1:a",
                            "-c:v", "copy", "-c:a", "aac", "-b:a", "192k",
                            "-shortest", "-movflags", "+faststart", выход],
                           check=True)
        else:
            subprocess.run([ffmpeg(), "-y", "-hide_banner", "-loglevel", "error",
                            "-i", с_обложкой, "-c", "copy",
                            "-movflags", "+faststart", выход], check=True)

    print("готово:", выход, os.path.getsize(выход), "байт",
          "| свой звук:", "был" if свой_звук else "добавлена музыка", flush=True)
    return выход


if __name__ == "__main__":
    а = sys.argv[1:]
    if len(а) < 2:
        raise SystemExit(__doc__)
    оформить(а[0], а[1], а[2] if len(а) > 2 else None,
             а[3] if len(а) > 3 else None)
