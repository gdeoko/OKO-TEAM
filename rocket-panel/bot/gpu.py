"""Клиент к панели генерации на GPU-сервере.

Панель живёт за паролем (Caddy) и туннелем. Здесь только запуск задания
и ожидание результата — вся логика схем на стороне панели.
"""

import json, os, time, base64, urllib.request, urllib.error, urllib.parse

# ГДЕ ЛЕЖИТ ЖИВОЙ АДРЕС КАРТЫ.
#
# Карта гасится в простое и поднимается заново под запрос, а туннель
# `trycloudflare` при каждом подъёме выдаёт НОВЫЙ адрес. Раньше адрес
# брался из переменной окружения — то есть чтобы бот о нём узнал, бота
# надо перезапустить. А будит карту сам бот, посреди запроса живого
# человека: перезапуск в этот момент убил бы и запрос, и деньги за него.
#
# Поэтому адрес читается из ФАЙЛА и перечитывается перед каждым
# обращением. Файл пишет `карта.py` сразу после подъёма. Нет файла —
# берём переменную окружения, как раньше.
ФАЙЛ_АДРЕСА = os.environ.get("ROCKET_GPU_URL_FILE",
                             "/srv/amberry/карта_адрес.txt")


class GpuError(Exception):
    pass


class Gpu:
    def __init__(self, base_url, login, password, timeout=30):
        self._из_env = (base_url or "").rstrip("/")
        self.auth = base64.b64encode(f"{login}:{password}".encode()).decode()
        self.timeout = timeout

    @property
    def base(self):
        """Адрес панели на СЕЙЧАС, а не на момент запуска бота."""
        try:
            with open(ФАЙЛ_АДРЕСА, encoding="utf-8") as ф:
                из_файла = ф.read().strip().rstrip("/")
            if из_файла:
                return из_файла
        except OSError:
            pass
        return self._из_env

    @property
    def настроена(self):
        """Адрес панели задан. Карта арендуется почасово, и бо́льшую
        часть времени её нет вовсе — это нормальное состояние, а не
        поломка."""
        return bool(self.base)

    def _req(self, path, data=None, files=None, method=None):
        # Адреса нет — говорим об этом своей ошибкой. Без этой проверки
        # urllib.request.Request падал с ValueError «unknown url type:
        # '/api/stats'», а ValueError никто не ловит: бот не запускался
        # вовсе, хотя без карты обязан работать — баланс, пакеты,
        # оплата, кабинет и архив от неё не зависят.
        if not self.настроена:
            raise GpuError("видеокарта не подключена (нет ROCKET_GPU_URL)")
        url = f"{self.base}/{path.lstrip('/')}"
        headers = {"Authorization": f"Basic {self.auth}"}
        body = None
        if files:
            boundary = "----rocket" + str(int(time.time() * 1000))
            parts = []
            for name, (fname, content) in files.items():
                parts.append(
                    f"--{boundary}\r\n"
                    f'Content-Disposition: form-data; name="{name}"; filename="{fname}"\r\n'
                    f"Content-Type: application/octet-stream\r\n\r\n".encode() + content + b"\r\n"
                )
            body = b"".join(p if isinstance(p, bytes) else p.encode() for p in parts)
            body += f"--{boundary}--\r\n".encode()
            headers["Content-Type"] = f"multipart/form-data; boundary={boundary}"
        elif data is not None:
            body = json.dumps(data).encode()
            headers["Content-Type"] = "application/json"
        try:
            # Сборка запроса ВНУТРИ try: кривой адрес роняет уже её, и
            # раньше эта ошибка пролетала мимо всех обработчиков.
            req = urllib.request.Request(url, data=body, headers=headers,
                                         method=method)
            with urllib.request.urlopen(req, timeout=self.timeout) as r:
                raw = r.read()
                ctype = r.headers.get("Content-Type", "")
                return json.loads(raw) if "json" in ctype else raw
        except urllib.error.HTTPError as e:
            raise GpuError(f"{e.code}: {e.read()[:200].decode('utf-8','replace')}") from None
        except Exception as e:
            raise GpuError(str(e)[:200]) from None

    # --- операции ---

    def alive(self):
        try:
            s = self._req("api/stats")
            return isinstance(s, dict) and "total" in s
        except GpuError:
            return False

    def free_vram(self):
        s = self._req("api/stats")
        return s.get("free"), s.get("total"), s.get("queue", 0)

    def upload(self, filename, content):
        r = self._req("api/upload", files={"file": (filename, content)})
        if not isinstance(r, dict) or not r.get("name"):
            raise GpuError(f"загрузка не удалась: {str(r)[:150]}")
        return r["name"]

    def start(self, **params):
        r = self._req("api/gen", data=params)
        if not isinstance(r, dict) or not r.get("job"):
            raise GpuError(str(r.get("error", r))[:200] if isinstance(r, dict) else str(r)[:200])
        return r["job"], r.get("seed")

    def poll(self, job_id):
        return self._req(f"api/job/{job_id}")

    def wait(self, job_id, limit=900, on_tick=None):
        """Ждёт результат. on_tick(секунд) — чтобы показывать прогресс."""
        t0 = time.time()
        last = -1
        while time.time() - t0 < limit:
            j = self.poll(job_id)
            st = j.get("state")
            if st == "ok":
                return j
            if st == "err":
                raise GpuError(j.get("error") or "генерация не удалась")
            sec = int(j.get("sec") or 0)
            if on_tick and sec != last:
                on_tick(sec); last = sec
            time.sleep(2)
        raise GpuError("слишком долго, отменяю")

    def fetch(self, filename):
        """Забрать готовый файл."""
        return self._req(f"file/{urllib.parse.quote(filename)}")
