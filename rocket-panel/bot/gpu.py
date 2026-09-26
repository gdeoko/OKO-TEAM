"""Клиент к панели генерации на GPU-сервере.

Панель живёт за паролем (Caddy) и туннелем. Здесь только запуск задания
и ожидание результата — вся логика схем на стороне панели.
"""

import json, os, time, base64, threading, urllib.request, urllib.error, urllib.parse

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


# НЕСКОЛЬКО КАРТ. В файле адресов - по строке на карту, основная
# первой (пишет карта/адрес_васт.sh). Задание держится за ОДНУ карту от
# загрузки снимков до скачивания результата: файлы и номер задания живут
# на той карте, где их создали, и соседняя про них не знает. Поэтому
# карта выбирается в начале задания и хранится в потоке (`выбрать`).
#
# КАК ВЫБИРАЕМ. Короче очередь - лучше. При равной очереди - карта, на
# которой последним считался тот же РОД работы (фото или видео): сборки
# фото и видео весят 28 и 23 ГБ, и карта, получившая вперемешку фото и
# ролик, перекидывает их с диска - на одной карте это стоило одиннадцати
# минут ожидания в час пик. Два рода на двух картах перекидывать нечего.
ШТРАФ_ЧУЖОГО_РОДА = 1.5     # в «местах очереди»


class Gpu:
    def __init__(self, base_url, login, password, timeout=30):
        self._из_env = (base_url or "").rstrip("/")
        self.auth = base64.b64encode(f"{login}:{password}".encode()).decode()
        self.timeout = timeout
        self._поток = threading.local()
        self._род_карты = {}          # адрес -> какой род считал последним
        self._занято = {}             # адрес -> сколько заданий мы на неё отдали
        self._замок = threading.Lock()

    def карты(self):
        """Все адреса на СЕЙЧАС, а не на момент запуска бота."""
        try:
            with open(ФАЙЛ_АДРЕСА, encoding="utf-8") as ф:
                адреса = [с.strip().rstrip("/") for с in ф
                          if с.strip() and not с.lstrip().startswith("#")]
            if адреса:
                return адреса
        except OSError:
            pass
        return [self._из_env] if self._из_env else []

    @property
    def base(self):
        """Карта этого задания, а без выбора - основная."""
        своя = getattr(self._поток, "карта", None)
        if своя:
            return своя
        к = self.карты()
        return к[0] if к else ""

    def выбрать(self, род=None):
        """Закрепить за текущим потоком лучшую карту. Возвращает адрес.

        Одна карта - никаких опросов, как было всегда. Несколько - каждая
        спрашивается о своей очереди коротко; молчащая пропускается, чтобы
        задание не ушло на мёртвую машину.
        """
        все = self.карты()
        if len(все) <= 1:
            self._поток.карта = все[0] if все else None
            return self._поток.карта
        лучшая, счёт_лучшей = None, None
        for адрес in все:
            try:
                s = self._req("api/stats", адрес=адрес, timeout=6)
                очередь = int((s or {}).get("queue") or 0)
            except GpuError:
                continue
            with self._замок:
                очередь = max(очередь, self._занято.get(адрес, 0))
                чужой = род and self._род_карты.get(адрес) not in (None, род)
            счёт = очередь + (ШТРАФ_ЧУЖОГО_РОДА if чужой else 0)
            if счёт_лучшей is None or счёт < счёт_лучшей:
                лучшая, счёт_лучшей = адрес, счёт
        лучшая = лучшая or все[0]
        with self._замок:
            self._занято[лучшая] = self._занято.get(лучшая, 0) + 1
            if род:
                self._род_карты[лучшая] = род
        self._поток.карта = лучшая
        return лучшая

    def отпустить(self):
        карта = getattr(self._поток, "карта", None)
        if карта:
            with self._замок:
                self._занято[карта] = max(0, self._занято.get(карта, 0) - 1)
        self._поток.карта = None

    @property
    def настроена(self):
        """Адрес панели задан. Карта арендуется почасово, и бо́льшую
        часть времени её нет вовсе — это нормальное состояние, а не
        поломка."""
        return bool(self.base)

    def _req(self, path, data=None, files=None, method=None, адрес=None,
             timeout=None):
        # Адреса нет — говорим об этом своей ошибкой. Без этой проверки
        # urllib.request.Request падал с ValueError «unknown url type:
        # '/api/stats'», а ValueError никто не ловит: бот не запускался
        # вовсе, хотя без карты обязан работать — баланс, пакеты,
        # оплата, кабинет и архив от неё не зависят.
        if not (адрес or self.настроена):
            raise GpuError("видеокарта не подключена (нет ROCKET_GPU_URL)")
        url = f"{адрес or self.base}/{path.lstrip('/')}"
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
            with urllib.request.urlopen(req, timeout=timeout or self.timeout) as r:
                raw = r.read()
                ctype = r.headers.get("Content-Type", "")
                return json.loads(raw) if "json" in ctype else raw
        except urllib.error.HTTPError as e:
            raise GpuError(f"{e.code}: {e.read()[:200].decode('utf-8','replace')}") from None
        except Exception as e:
            raise GpuError(str(e)[:200]) from None

    # --- операции ---

    def alive(self):
        """Жива ЛЮБАЯ из карт, а не только первая.

        Бот спрашивает это перед каждой генерацией (`железо.нужна`), и до
        появления второй карты вопрос был об одной машине. Спрашивать
        только первую нельзя: встанет основная - и бот откажет всем,
        хотя соседняя карта свободна. А встать она может буднично, от
        кончившихся на Vast денег.
        """
        своя = getattr(self._поток, "карта", None)
        for адрес in ([своя] if своя else self.карты()):
            try:
                s = self._req("api/stats", адрес=адрес)
                if isinstance(s, dict) and "total" in s:
                    return True
            except GpuError:
                continue
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
