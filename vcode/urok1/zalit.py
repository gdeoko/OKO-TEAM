# -*- coding: utf-8 -*-
"""Залить ролик урока на сервер кусками и привязать к уроку.

    python3 zalit.py remotion/out/urok.mp4 b1-l1 [обложка.jpg]

Ролик на одиннадцать минут в один запрос не проходит, поэтому он уезжает
кусками по 12 МБ: первый создаёт файл, остальные дописываются.
"""
import base64
import json
import os
import subprocess
import sys
import tempfile

КУСОК = 12 * 1024 * 1024
АДРЕС = os.environ.get("VLIONOFF_URL", "https://okoteam.top/vlionoff/")


def ключ() -> str:
    к = os.environ.get("VLIONOFF_ADMIN", "")
    if к:
        return к
    путь = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "app",
                        "core", "config.local.php")
    try:
        import re
        текст = open(путь, encoding="utf-8").read()
        м = re.search(r"'admin_token'\s*=>\s*'([^']+)'", текст)
        if м:
            return м.group(1)
    except OSError:
        pass
    return ""


def запрос(путь: str, тело: dict) -> dict:
    временный = tempfile.NamedTemporaryFile("w", suffix=".json", delete=False, encoding="utf-8")
    json.dump(тело, временный)
    временный.close()
    р = subprocess.run(["curl", "-sS", "--cacert", "/root/.ccr/ca-bundle.crt", "-m", "900",
                        "-X", "POST", АДРЕС + "api/index.php?r=" + путь,
                        "-H", "Content-Type: application/json",
                        "-H", "X-VCODE-ADMIN: " + ключ(),
                        "--data-binary", "@" + временный.name],
                       capture_output=True, text=True)
    os.unlink(временный.name)
    try:
        return json.loads(р.stdout)
    except Exception:
        return {"ok": False, "почему": (р.stdout or р.stderr)[:300]}


def залить(файл: str, имя: str, папка: str = "uroki") -> str:
    размер = os.path.getsize(файл)
    путь = ""
    with open(файл, "rb") as ф:
        номер = 0
        while True:
            кусок = ф.read(КУСОК)
            if not кусок:
                break
            ответ = запрос("admin/upload", {
                "name": имя, "dir": папка, "append": 1 if номер else 0,
                "data": base64.b64encode(кусок).decode()})
            if not ответ.get("ok"):
                print("кусок %d не ушёл: %s" % (номер, ответ))
                return ""
            путь = ответ["path"]
            номер += 1
            print("  кусок %d: %d из %d байт" % (номер, ответ.get("bytes", 0), размер), flush=True)
    return путь


def главное() -> int:
    файл, слаг = sys.argv[1], sys.argv[2]
    обложка = sys.argv[3] if len(sys.argv) > 3 else ""
    имя = "%s.mp4" % слаг
    путь = залить(файл, имя)
    if not путь:
        return 1
    print("ролик на сервере:", путь)
    о = запрос("admin/lesson/media", {"slug": слаг, "field": "video", "path": путь})
    print("привязка ролика:", о)
    if обложка and os.path.exists(обложка):
        п = залить(обложка, "%s.jpg" % слаг, "img")
        if п:
            print("обложка на сервере:", п)
            print("привязка обложки:", запрос("admin/lesson/media",
                                              {"slug": слаг, "field": "cover", "path": п}))
    return 0


if __name__ == "__main__":
    raise SystemExit(главное())
