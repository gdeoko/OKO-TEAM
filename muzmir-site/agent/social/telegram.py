"""
Адаптер Telegram: публикация поста в канал @kc_mus_mir.

Креды из окружения (в git не класть):
    MUZMIR_TG_BOT_TOKEN — токен бота (бот должен быть админом канала);
    MUZMIR_TG_CHANNEL   — @username канала или числовой chat_id
                          (по умолчанию @kc_mus_mir).

Если токена нет — тихий фолбэк с логом.
"""
from __future__ import annotations

import os
from typing import Optional

from ._base import http_post_form, ok, skipped, logger

DEFAULT_CHANNEL = "@kc_mus_mir"


class TelegramAdapter:
    platform = "telegram"

    def __init__(self, token: Optional[str] = None, channel: Optional[str] = None):
        self.token = token or os.environ.get("MUZMIR_TG_BOT_TOKEN", "")
        self.channel = channel or os.environ.get("MUZMIR_TG_CHANNEL", DEFAULT_CHANNEL)

    def available(self) -> bool:
        return bool(self.token and self.channel)

    def _api(self, method: str) -> str:
        return f"https://api.telegram.org/bot{self.token}/{method}"

    def post(self, text: str, photo_url: Optional[str] = None, **kwargs) -> dict:
        """
        Публикует пост в канал. Если задан photo_url — отправляет фото с подписью.
        Ссылки на Telegram в text не проверяются здесь: за правила текста отвечает
        content.py / brain.sanitize.
        """
        if not self.available():
            return skipped(self.platform, "нет MUZMIR_TG_BOT_TOKEN / MUZMIR_TG_CHANNEL")
        try:
            if photo_url:
                data = {"chat_id": self.channel, "photo": photo_url,
                        "caption": text[:1024]}
                resp = http_post_form(self._api("sendPhoto"), data)
            else:
                data = {"chat_id": self.channel, "text": text,
                        "disable_web_page_preview": "true"}
                resp = http_post_form(self._api("sendMessage"), data)
        except Exception as e:
            return skipped(self.platform, f"сеть недоступна: {e}")
        if not resp.get("ok"):
            msg = resp.get("description", "unknown")
            logger.warning("[telegram] API error: %s", msg)
            return {"ok": False, "platform": self.platform, "error": msg}
        mid = resp.get("result", {}).get("message_id")
        logger.info("[telegram] опубликовано message_id=%s", mid)
        return ok(self.platform, message_id=mid)


def post(text: str, **kwargs) -> dict:
    """Функциональная обёртка над TelegramAdapter.post."""
    return TelegramAdapter().post(text, **kwargs)
