"""Клиент к панели генерации на GPU-сервере.

Панель живёт за паролем (Caddy) и туннелем. Здесь только запуск задания
и ожидание результата — вся логика схем на стороне панели.
"""

import json, time, base64, urllib.request, urllib.error, urllib.parse


class GpuError(Exception):
    pass


class Gpu:
    def __init__(self, base_url, login, password, timeout=30):
        self.base = base_url.rstrip("/")
        self.auth = base64.b64encode(f"{login}:{password}".encode()).decode()
        self.timeout = timeout

    def _req(self, path, data=None, files=None, method=None):
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
        req = urllib.request.Request(url, data=body, headers=headers, method=method)
        try:
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
