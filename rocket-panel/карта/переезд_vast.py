#!/usr/bin/env python3
"""Переезд и добавление карт на Vast одной командой. Запускать на сервере бота от root.

Зачем. Постоянного тома на Vast нет: диск машины живёт вместе с ней.
Пропала машина у хозяина - руками собирать новую час и больше. Здесь
тот же путь, разложенный на шаги, каждый из которых можно повторить:

    подобрать [N]             карты по нашим правилам, дешёвые первыми (бесплатно)
    взять <offer> --да        арендовать (ДЕНЬГИ: с этой минуты идёт почасовая оплата)
    ждать <машина>            дождаться запуска, показать ssh
    собрать <машина>          залить наш код панели и собрать карту (gpu/сборка_пода.sh):
                              ComfyUI, модели из открытых источников, панель, туннель
    подключить <машина> <имя> дать боту: имя main - заменить основную,
                              любое другое - дополнительная карта на время пика
    отключить <имя>           убрать дополнительную карту из раздачи
    вернуть <машина> --да     удалить машину и перестать платить

Правила выбора карты (ВЕБКАМ_КАРТА_VAST.md): смотреть мощность
`gpu_max_power` от 450 Вт, а не `dlperf`; надёжность от 0,98; канал
от 500 Мбит - модели качаются из открытых источников; диск от 200 ГБ.
После сборки карту обязательно прогнать приёмкой под нагрузкой
(карта/приёмка_карты.py): «задушенные» машины в 14 раз медленнее.

Чего сборка НЕ ставит (в открытых источниках этого нет): лоры
flat_chest_qwen и qwen-image-edit-plus-nsfw, 21 опору (ГЛУБИНА) и 21
позу (ПОЗЫ), эталоны. Их оригиналы - на боевой карте и на диске
Hyperstack `rocket-models`. Без них карта генерирует, но кнопки с
позой идут без опоры, а «плоская грудь» без лоры.

Ключ - VAST_API_KEY в /etc/amberry-card.env.
"""
import json
import os
import subprocess
import sys
import time
import urllib.request

API = "https://console.vast.ai/api/v0"
КОД = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "gpu")
ОБРАЗ = "pytorch/pytorch:2.11.0-cuda12.8-cudnn9-devel"
ДИСК = 200
# Как у боевой карты: образ pytorch оставляет права на authorized_keys,
# которые sshd отвергает, а ключи Vast дописывает уже ПОСЛЕ старта -
# поэтому права чинятся в цикле первые полторы минуты.
ONSTART = ("( for i in $(seq 1 90); do mkdir -p /root/.ssh; chmod 700 /root/.ssh; "
           "chown -R root:root /root/.ssh; [ -f /root/.ssh/authorized_keys ] && "
           "chmod 600 /root/.ssh/authorized_keys; sleep 5; done ) >/dev/null 2>&1 & "
           "sleep 10; nvidia-smi --query-gpu=name,power.limit,memory.total --format=csv")
ФАЙЛЫ_ПАНЕЛИ = ("panel.py", "panel.html", "weights.py", "приёмка.py", "сходство.py",
                "нормы.json", "сборка_пода.sh")
КЛЮЧ_SSH = "/root/.ssh/vast_amberry"
ДОП = "/etc/amberry-cards.d"
ОСНОВНАЯ = "/etc/amberry-card.env"


def env(путь):
    д = {}
    try:
        for с in open(путь, encoding="utf-8"):
            if "=" in с and not с.lstrip().startswith("#"):
                к, _, з = с.strip().partition("=")
                д[к] = з.strip().strip('"')
    except OSError:
        pass
    return д


def ключ():
    к = env(ОСНОВНАЯ).get("VAST_API_KEY") or os.environ.get("VAST_API_KEY")
    if not к:
        raise SystemExit("нет VAST_API_KEY в " + ОСНОВНАЯ)
    return к


def vast(метод, путь, тело=None):
    зап = urllib.request.Request(
        API + путь, method=метод,
        data=json.dumps(тело).encode() if тело is not None else None,
        headers={"Authorization": "Bearer " + ключ(),
                 "Content-Type": "application/json"})
    with urllib.request.urlopen(зап, timeout=60) as о:
        return json.loads(о.read() or b"{}")


def машина(ид):
    return vast("GET", f"/instances/{ид}/").get("instances") or {}


def ssh_машины(м):
    return m_host(м), int(м.get("ssh_port") or 0)


def m_host(м):
    return "root@" + (м.get("ssh_host") or "")


def ssh(м, команда, вход=None, ждать=3600):
    хост, порт = ssh_машины(м)
    return subprocess.run(
        ["ssh", "-o", "StrictHostKeyChecking=no", "-o", "UserKnownHostsFile=/dev/null",
         "-o", "BatchMode=yes", "-o", "ConnectTimeout=20", "-i", КЛЮЧ_SSH,
         "-p", str(порт), хост, команда],
        input=вход, capture_output=True, timeout=ждать)


# ---------- шаги ----------

def подобрать(сколько=8):
    запрос = {
        "gpu_name": {"in": ["RTX PRO 6000 S", "RTX PRO 6000 WS"]},
        "num_gpus": {"eq": 1}, "rentable": {"eq": True},
        "reliability2": {"gte": 0.98}, "disk_space": {"gte": ДИСК},
        "gpu_max_power": {"gte": 450}, "inet_down": {"gte": 500},
        "order": [["dph_total", "asc"]], "type": "on-demand", "limit": 40,
    }
    предложения = vast("POST", "/bundles/", запрос).get("offers") or []
    print(f"{'offer':>9}  {'карта':16} {'$/ч':>6} {'Вт':>4} {'надёжн':>6}  "
          f"{'канал↓':>7}  где")
    for п in предложения[:сколько]:
        print(f"{п['id']:>9}  {п.get('gpu_name',''):16} {п.get('dph_total',0):>6.3f} "
              f"{int(п.get('gpu_max_power') or 0):>4} {п.get('reliability2',0):>6.3f}  "
              f"{int(п.get('inet_down') or 0):>6}M  {п.get('geolocation','')}")
    if not предложения:
        print("по нашим правилам сейчас ничего нет")


def взять(offer, метка, да):
    if not да:
        raise SystemExit("аренда - это деньги: добавьте --да, если решение принято")
    о = vast("PUT", f"/asks/{offer}/", {
        "client_id": "me", "image": ОБРАЗ, "disk": ДИСК, "label": метка,
        "onstart": ONSTART, "runtype": "ssh",
    })
    if not о.get("success"):
        raise SystemExit(f"Vast не дал машину: {о}")
    print(f"машина {о.get('new_contract')} арендована, метка {метка}. "
          f"Дальше: ждать {о.get('new_contract')}")


def ждать(ид, предел=900):
    н = time.time()
    while time.time() - н < предел:
        м = машина(ид)
        if м.get("actual_status") == "running" and м.get("ssh_host"):
            # ssh может ещё не пускать: права на ключи чинятся onstart-ом
            if ssh(м, "true", ждать=40).returncode == 0:
                print(f"работает: ssh -i {КЛЮЧ_SSH} -p {м['ssh_port']} {m_host(м)}")
                return м
        time.sleep(10)
    raise SystemExit("машина не поднялась за %d с" % предел)


def собрать(ид):
    м = машина(ид)
    бот = env("/etc/amberry.env")
    пароль = бот.get("ROCKET_GPU_PASS", "")
    if not пароль:
        raise SystemExit("нет ROCKET_GPU_PASS в /etc/amberry.env")
    # Наш код панели - одним архивом через stdin, как и всё остальное.
    архив = subprocess.run(["tar", "czf", "-", "-C", КОД, *ФАЙЛЫ_ПАНЕЛИ],
                           capture_output=True, check=True).stdout
    р = ssh(м, "mkdir -p /root && tar xzf - -C /root && ls /root | wc -l", вход=архив, ждать=300)
    if р.returncode:
        raise SystemExit("код не залился: " + р.stderr.decode()[-300:])
    print("код панели на месте, собираю (журнал /root/sborka.log, обычно 10-20 мин)...")
    р = ssh(м, f"GPU_USER=rocket GPU_PASS='{пароль}' bash /root/сборка_пода.sh", ждать=3600)
    print(р.stdout.decode()[-2500:])
    if "СБОРКА ГОТОВА" not in р.stdout.decode("utf-8", "replace"):
        raise SystemExit("сборка не дошла до конца - смотреть /root/sborka.log на карте")
    print("готово. Перед боем: приёмка под нагрузкой (карта/приёмка_карты.py), "
          "затем: подключить", ид, "<имя>")


def подключить(ид, имя):
    м = машина(ид)
    хост, порт = ssh_машины(м)
    if имя == "main":
        строки = [с for с in open(ОСНОВНАЯ, encoding="utf-8").read().splitlines()
                  if not с.startswith(("VAST_HOST=", "VAST_PORT="))]
        os.replace(ОСНОВНАЯ, ОСНОВНАЯ + time.strftime(".bak-%Y%m%d-%H%M%S"))
        with open(ОСНОВНАЯ, "w", encoding="utf-8") as ф:
            ф.write("\n".join(строки + [f"VAST_HOST={хост}", f"VAST_PORT={порт}",
                                        f"# машина {ид}, подключена {time.strftime('%d.%m.%Y %H:%M')}"]) + "\n")
        os.chmod(ОСНОВНАЯ, 0o600)
    else:
        os.makedirs(ДОП, exist_ok=True)
        путь = os.path.join(ДОП, имя + ".env")
        with open(путь, "w", encoding="utf-8") as ф:
            ф.write(f"# дополнительная карта, машина {ид}\nVAST_HOST={хост}\nVAST_PORT={порт}\n")
        os.chmod(путь, 0o600)
    subprocess.run(["bash", "/opt/amberry-card/адрес_васт.sh"], check=False)
    print(open("/srv/amberry/карта_адрес.txt").read())


def отключить(имя):
    путь = os.path.join(ДОП, имя + ".env")
    if not os.path.exists(путь):
        raise SystemExit("такой дополнительной карты нет")
    os.remove(путь)
    try:
        os.remove(f"/srv/amberry/карты/{имя}.txt")
    except OSError:
        pass
    subprocess.run(["bash", "/opt/amberry-card/адрес_васт.sh"], check=False)
    print("убрана из раздачи. Машина при этом ЕЩЁ РАБОТАЕТ и стоит денег - вернуть <машина> --да")


def вернуть(ид, да):
    if not да:
        raise SystemExit("удаление необратимо: всё на диске машины пропадёт. Добавьте --да")
    if str(ид) in open(ОСНОВНАЯ, encoding="utf-8").read():
        raise SystemExit("это основная карта бота - сначала подключите другую как main")
    print(vast("DELETE", f"/instances/{ид}/"))


if __name__ == "__main__":
    а = sys.argv[1:]
    да = "--да" in а
    а = [x for x in а if x != "--да"]
    if not а:
        print(__doc__)
    elif а[0] == "подобрать":
        подобрать(int(а[1]) if len(а) > 1 else 8)
    elif а[0] == "взять" and len(а) >= 2:
        взять(а[1], а[2] if len(а) > 2 else "amberry-доп", да)
    elif а[0] == "ждать" and len(а) == 2:
        ждать(а[1])
    elif а[0] == "собрать" and len(а) == 2:
        собрать(а[1])
    elif а[0] == "подключить" and len(а) == 3:
        подключить(а[1], а[2])
    elif а[0] == "отключить" and len(а) == 2:
        отключить(а[1])
    elif а[0] == "вернуть" and len(а) == 2:
        вернуть(а[1], да)
    else:
        print(__doc__)
