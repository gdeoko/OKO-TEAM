"""
Общий фундамент адаптеров: HTTP через прокси-окружение с TLS-бандлом,
единый лог и формат результата.
"""
from __future__ import annotations

import json
import logging
import os
import urllib.parse
import urllib.request
from typing import Optional

try:
    import requests  # type: ignore
except Exception:  # pragma: no cover
    requests = None

CA_BUNDLE = "/root/.ccr/ca-bundle.crt"
HTTP_TIMEOUT = 30

logger = logging.getLogger("muzmir.agent.social")
if not logger.handlers:
    _h = logging.StreamHandler()
    _h.setFormatter(logging.Formatter("[%(asctime)s] %(name)s %(levelname)s: %(message)s"))
    logger.addHandler(_h)
    logger.setLevel(logging.INFO)


def _verify():
    return CA_BUNDLE if os.path.exists(CA_BUNDLE) else True


def ok(platform: str, **extra) -> dict:
    r = {"ok": True, "platform": platform}
    r.update(extra)
    return r


def skipped(platform: str, reason: str) -> dict:
    """Тихий фолбэк, когда кредов нет или сервис недоступен."""
    logger.info("[%s] пропуск публикации: %s", platform, reason)
    return {"ok": False, "platform": platform, "skipped": True, "reason": reason}


def http_get(url: str, params: dict) -> dict:
    """GET c JSON-ответом через requests или stdlib."""
    if requests is not None:
        r = requests.get(url, params=params, timeout=HTTP_TIMEOUT, verify=_verify())
        return r.json()
    import ssl
    ctx = ssl.create_default_context(cafile=CA_BUNDLE if os.path.exists(CA_BUNDLE) else None)
    full = url + "?" + urllib.parse.urlencode(params)
    with urllib.request.urlopen(full, timeout=HTTP_TIMEOUT, context=ctx) as resp:
        return json.loads(resp.read().decode("utf-8"))


def http_post_form(url: str, data: dict) -> dict:
    """POST application/x-www-form-urlencoded с JSON-ответом."""
    if requests is not None:
        r = requests.post(url, data=data, timeout=HTTP_TIMEOUT, verify=_verify())
        return r.json()
    import ssl
    ctx = ssl.create_default_context(cafile=CA_BUNDLE if os.path.exists(CA_BUNDLE) else None)
    body = urllib.parse.urlencode(data).encode("utf-8")
    req = urllib.request.Request(url, data=body, method="POST")
    with urllib.request.urlopen(req, timeout=HTTP_TIMEOUT, context=ctx) as resp:
        return json.loads(resp.read().decode("utf-8"))
