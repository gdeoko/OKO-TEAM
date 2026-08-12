"""
Мозг-агент КЦ «Музыкальный Мир».

Отвечает на вопросы участников о конкурсах, заявках и наградах, опираясь на
базу знаний Центра (agent/knowledge.md). LLM — через Gemini-прокси OKO.

Публичное API:
    answer(question, user_context=None) -> str

Сеть: HTTPS через corporate-прокси окружения. Для верификации TLS используется
CA-бандл /root/.ccr/ca-bundle.crt (если есть). Все внешние вызовы имеют таймаут
и тихий фолбэк — агент не должен падать, если LLM недоступен.

Секреты только из окружения (в git не класть):
    GEMINI_API_KEY         — один ключ или несколько через запятую;
    GEMINI_API_KEY_1..N    — альтернативная форма для ротации;
    GEMINI_PROXY_URL       — базовый URL прокси (по умолчанию OKO-прокси);
    GEMINI_MODEL           — модель (по умолчанию gemini-flash-latest).
"""
from __future__ import annotations

import json
import os
import time
from pathlib import Path
from typing import Optional

try:  # requests не обязателен — есть stdlib-фолбэк
    import requests  # type: ignore
except Exception:  # pragma: no cover
    requests = None

import urllib.request
import urllib.error

# --------------------------------------------------------------------------- #
# Конфигурация
# --------------------------------------------------------------------------- #

BASE_DIR = Path(__file__).resolve().parent
KNOWLEDGE_FILE = BASE_DIR / "knowledge.md"

DEFAULT_PROXY = "https://gemini-proxy.okoteam.workers.dev"
DEFAULT_MODEL = "gemini-flash-latest"
CA_BUNDLE = "/root/.ccr/ca-bundle.crt"
HTTP_TIMEOUT = 45

# Правила текстов КЦ — зашиты жёстко, повторяют docs/CONVENTIONS.md.
SYSTEM_PROMPT = """Ты — ассистент поддержки Культурного центра «Музыкальный Мир»
(творческие онлайн-конкурсы и фестивали). Отвечаешь участникам, педагогам и
родителям по вопросам конкурсов, заявок, оценивания и наград.

Отвечай ТОЛЬКО на основе базы знаний ниже. Если факта в базе нет — не выдумывай,
предложи уточнить в Оргкомитете и дай телефон и email из базы.

Строгие правила текста (нарушать нельзя):
1. Обращение к человеку — только «Вы» с заглавной буквы.
2. Никаких эмодзи и смайликов.
3. Никакой AI-лексики: не использовать слова «уникальный», «реализовать»,
   «ключевой», «контекст», «синергия», «важно отметить», «в современном мире».
4. Тире — только короткое «-». Длинное тире «—» запрещено.
5. Кавычки — «ёлочки», вложенные „лапки". Прямые кавычки не использовать.
6. Без конструкций-оппозиций «не только... но и», «не просто», «это не».
7. Не называть ФИО руководителя и слова «Генеральный директор» — только
   «Оргкомитет».
8. Не давать ссылок на Telegram в ответах. Из контактов — телефон, email, адрес.
9. Отвечай кратко, по делу, вежливо и по-деловому. Русский язык.
10. Не обещай сроков и сумм, которых нет в базе знаний.

База знаний:
---
{knowledge}
---
"""

_KNOWLEDGE_CACHE: Optional[str] = None


def load_knowledge() -> str:
    """Читает базу знаний с диска (кэшируется в процессе)."""
    global _KNOWLEDGE_CACHE
    if _KNOWLEDGE_CACHE is None:
        try:
            _KNOWLEDGE_CACHE = KNOWLEDGE_FILE.read_text(encoding="utf-8")
        except Exception:
            _KNOWLEDGE_CACHE = "(база знаний недоступна)"
    return _KNOWLEDGE_CACHE


def _api_keys() -> list[str]:
    """Собирает ключи Gemini из окружения с поддержкой ротации."""
    keys: list[str] = []
    raw = os.environ.get("GEMINI_API_KEY", "")
    for part in raw.split(","):
        part = part.strip()
        if part:
            keys.append(part)
    for i in range(1, 10):
        v = os.environ.get(f"GEMINI_API_KEY_{i}", "").strip()
        if v:
            keys.append(v)
    # уникализируем, сохраняя порядок
    seen: set[str] = set()
    out: list[str] = []
    for k in keys:
        if k not in seen:
            seen.add(k)
            out.append(k)
    return out


def _proxy_base() -> str:
    return os.environ.get("GEMINI_PROXY_URL", DEFAULT_PROXY).rstrip("/")


def _model() -> str:
    return os.environ.get("GEMINI_MODEL", DEFAULT_MODEL)


def _verify_arg():
    """Значение для requests verify / stdlib context."""
    return CA_BUNDLE if os.path.exists(CA_BUNDLE) else True


# --------------------------------------------------------------------------- #
# Вызов LLM
# --------------------------------------------------------------------------- #

def _build_payload(system_text: str, user_text: str) -> dict:
    return {
        "system_instruction": {"parts": [{"text": system_text}]},
        "contents": [{"role": "user", "parts": [{"text": user_text}]}],
        "generationConfig": {"temperature": 0.3, "maxOutputTokens": 800},
    }


def _post_json(url: str, headers: dict, payload: dict) -> dict:
    """POST JSON через requests или stdlib. Бросает исключение при сбое."""
    data = json.dumps(payload).encode("utf-8")
    if requests is not None:
        r = requests.post(
            url, headers=headers, data=data,
            timeout=HTTP_TIMEOUT, verify=_verify_arg(),
        )
        if r.status_code >= 400:
            raise RuntimeError(f"HTTP {r.status_code}: {r.text[:300]}")
        return r.json()
    # stdlib-фолбэк
    import ssl
    ctx = ssl.create_default_context(
        cafile=CA_BUNDLE if os.path.exists(CA_BUNDLE) else None
    )
    req = urllib.request.Request(url, data=data, headers=headers, method="POST")
    with urllib.request.urlopen(req, timeout=HTTP_TIMEOUT, context=ctx) as resp:
        return json.loads(resp.read().decode("utf-8"))


def _extract_text(resp: dict) -> str:
    if "error" in resp:
        raise RuntimeError(str(resp["error"])[:300])
    cands = resp.get("candidates") or []
    if not cands:
        raise RuntimeError("Gemini: пустой ответ")
    parts = cands[0].get("content", {}).get("parts", [])
    return "".join(p.get("text", "") for p in parts).strip()


def _call_gemini(system_text: str, user_text: str) -> str:
    """Вызывает Gemini через прокси с ротацией ключей. Ошибки — наверх."""
    keys = _api_keys()
    if not keys:
        raise RuntimeError("GEMINI_API_KEY не задан")
    base = _proxy_base()
    model = _model()
    url = f"{base}/v1beta/models/{model}:generateContent"
    payload = _build_payload(system_text, user_text)

    last_err: Optional[Exception] = None
    for key in keys:
        headers = {
            "Content-Type": "application/json",
            "X-goog-api-key": key,
        }
        try:
            resp = _post_json(url, headers, payload)
            return _extract_text(resp)
        except Exception as e:  # ключ мог упереться в лимит — пробуем следующий
            last_err = e
            time.sleep(0.3)
            continue
    raise RuntimeError(f"Gemini недоступен: {last_err}")


# --------------------------------------------------------------------------- #
# Пост-обработка текста под правила КЦ (страховка на случай, если LLM ошибся)
# --------------------------------------------------------------------------- #

def sanitize(text: str) -> str:
    """Приводит ответ к правилам текстов КЦ. Идемпотентно."""
    if not text:
        return text
    t = text
    # длинные тире -> короткое
    t = t.replace("—", "-").replace("–", "-")
    # прямые кавычки -> ёлочки (парная замена по очереди)
    out = []
    open_qt = True
    for ch in t:
        if ch == '"':
            out.append("«" if open_qt else "»")
            open_qt = not open_qt
        else:
            out.append(ch)
    t = "".join(out)
    # убираем эмодзи и прочие символы вне базовых плоскостей
    t = "".join(ch for ch in t if ord(ch) < 0x2190 or ch in "«»„")
    # схлопываем лишние пробелы/переносы
    while "   " in t:
        t = t.replace("   ", " ")
    while "\n\n\n" in t:
        t = t.replace("\n\n\n", "\n\n")
    return t.strip()


FALLBACK_ANSWER = (
    "Сейчас не удаётся ответить автоматически. Пожалуйста, напишите на "
    "kulturniy.centr.mir@mail.ru или позвоните по телефону +7 (950) 945-99-00 "
    "(Пн-Пт 09:00-18:00). Оргкомитет поможет с Вашим вопросом."
)


# --------------------------------------------------------------------------- #
# Публичное API
# --------------------------------------------------------------------------- #

def answer(question: str, user_context: Optional[dict] = None) -> str:
    """
    Отвечает на вопрос участника.

    question      — текст вопроса.
    user_context  — опциональный словарь данных авторизованного пользователя
                    (имя, номера заявок, статусы). Передаётся в промпт, чтобы
                    ответ был персональным. Секреты сюда не кладём.
    """
    question = (question or "").strip()
    if not question:
        return "Задайте, пожалуйста, вопрос о конкурсе, заявке или награде."

    system_text = SYSTEM_PROMPT.format(knowledge=load_knowledge())

    user_text = question
    if user_context:
        try:
            ctx = json.dumps(user_context, ensure_ascii=False)
        except Exception:
            ctx = str(user_context)
        user_text = (
            f"Данные пользователя (используй при необходимости, не раскрывай "
            f"лишнего): {ctx}\n\nВопрос: {question}"
        )

    try:
        raw = _call_gemini(system_text, user_text)
    except Exception:
        return FALLBACK_ANSWER
    result = sanitize(raw)
    return result or FALLBACK_ANSWER


if __name__ == "__main__":
    import sys
    q = " ".join(sys.argv[1:]) or "Как подать заявку и когда придут результаты?"
    print(answer(q))
