"""
HTTP-сервер мозг-агента КЦ «Музыкальный Мир».

Лёгкий сервер на stdlib (без внешних зависимостей). Если установлен Flask —
можно поднять и на нём, но по умолчанию используется http.server, чтобы работать
в любом окружении.

Эндпоинты:
    GET  /health                      — проверка живости.
    POST /chat   {text, user?}        — ответ участнику (brain.answer).
    POST /event  {type, competition}  — сгенерировать пост и разослать по соцсетям.

Авторизация: заголовок Authorization: Bearer <MUZMIR_AGENT_TOKEN>
или ?token=... Если MUZMIR_AGENT_TOKEN не задан — авторизация не требуется
(режим локальной разработки).

Сайт КЦ проксирует свои /api/v1/agent/chat и /api/v1/agent/webhook сюда
(см. config.php: agent_url, agent_token).

Запуск:
    MUZMIR_AGENT_TOKEN=secret python3 agent/server.py
    (порт по умолчанию 8090, переопределяется MUZMIR_AGENT_PORT)
"""
from __future__ import annotations

import json
import os
import sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs

# Поддержка запуска и как модуль (python -m agent.server), и как файл.
if __package__:
    from .brain import answer
    from .content import build_post, full_text
    from . import social
else:  # pragma: no cover
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    from brain import answer  # type: ignore
    from content import build_post, full_text  # type: ignore
    import social  # type: ignore

EVENT_MAP = {
    # событие сайта -> событие контента
    "open": "open",
    "competition_open": "open",
    "closing": "closing",
    "closing_soon": "closing",
    "closed": "closed",
    "competition_closed": "closed",
    "results": "results",
    "results_published": "results",
}


def _agent_token() -> str:
    return os.environ.get("MUZMIR_AGENT_TOKEN", "")


class Handler(BaseHTTPRequestHandler):
    server_version = "MuzmirAgent/1.0"

    # --- утилиты -------------------------------------------------------- #
    def _send(self, code: int, payload: dict):
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _authorized(self, query: dict) -> bool:
        want = _agent_token()
        if not want:
            return True  # режим разработки без токена
        auth = self.headers.get("Authorization", "")
        if auth.startswith("Bearer ") and auth[7:].strip() == want:
            return True
        if query.get("token", [""])[0] == want:
            return True
        return False

    def _read_json(self) -> dict:
        length = int(self.headers.get("Content-Length", 0) or 0)
        if length <= 0:
            return {}
        raw = self.rfile.read(length)
        try:
            return json.loads(raw.decode("utf-8"))
        except Exception:
            return {}

    def log_message(self, fmt, *args):  # тише в проде
        if os.environ.get("MUZMIR_AGENT_DEBUG"):
            super().log_message(fmt, *args)

    # --- маршруты ------------------------------------------------------- #
    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path in ("/health", "/", "/healthz"):
            self._send(200, {"ok": True, "service": "muzmir-agent"})
            return
        self._send(404, {"ok": False, "error": "not found"})

    def do_POST(self):
        parsed = urlparse(self.path)
        query = parse_qs(parsed.query)
        path = parsed.path.rstrip("/") or "/"

        if not self._authorized(query):
            self._send(401, {"ok": False, "error": "unauthorized"})
            return

        data = self._read_json()

        # Маршрутизация:
        #   /event, /webhook           -> событие сайта (пост-афиша + рассылка);
        #   /chat и всё остальное      -> чат.
        # Сайт (api/v1/_boot.php: agent_chat_proxy) шлёт чат POST-ом на базовый
        # agent_url (путь "/"), а события emit_event() шлёт на agent_url + "/event".
        # Поэтому "/" и любой путь с суффиксом /chat трактуем как чат.
        if path.endswith("/event") or path.endswith("/webhook"):
            self._handle_event(data)
        elif path.endswith("/chat") or path in ("/", ""):
            self._handle_chat(data)
        else:
            self._send(404, {"ok": False, "error": "not found"})

    def _handle_chat(self, data: dict):
        text = (data.get("text") or data.get("message") or "").strip()
        user = data.get("user") or data.get("user_context")
        if not text:
            self._send(400, {"ok": False, "error": "text is required"})
            return
        reply = answer(text, user_context=user)
        self._send(200, {"ok": True, "reply": reply})

    def _handle_event(self, data: dict):
        raw_type = (data.get("type") or data.get("event") or "").strip()
        event = EVENT_MAP.get(raw_type)
        competition = data.get("competition") or {}
        if not event:
            self._send(400, {"ok": False,
                             "error": f"unknown event type: {raw_type}",
                             "supported": sorted(set(EVENT_MAP.values()))})
            return
        post = build_post(event, competition)
        text = full_text(event, competition)
        # Разослать по всем адаптерам (те, у кого нет кредов, вернут skipped).
        results = social.broadcast(text)
        self._send(200, {
            "ok": True,
            "event": event,
            "post": post,
            "delivery": results,
        })


def run(port=None):
    port = int(port or os.environ.get("MUZMIR_AGENT_PORT", 8090))
    httpd = ThreadingHTTPServer(("0.0.0.0", port), Handler)
    print(f"muzmir-agent на 0.0.0.0:{port} "
          f"(auth {'вкл' if _agent_token() else 'выкл'})")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        httpd.shutdown()


if __name__ == "__main__":
    run()
