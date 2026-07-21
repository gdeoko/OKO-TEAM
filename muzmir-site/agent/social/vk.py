"""
Адаптер ВКонтакте: публикация записи в сообщество music_world.online.

Креды из окружения (в git не класть):
    MUZMIR_VK_TOKEN       — сервисный/групповой токен с правами wall,manage;
    MUZMIR_VK_GROUP_ID    — числовой id сообщества (без минуса);
    MUZMIR_VK_API_VERSION — версия API (по умолчанию 5.199).

Если токена нет — тихий фолбэк с логом (реальные доступы Музмира ещё не переданы).
"""
from __future__ import annotations

import os
from typing import Optional

from ._base import http_post_form, ok, skipped, logger

VK_API = "https://api.vk.com/method"


class VKAdapter:
    platform = "vk"

    def __init__(self, token: Optional[str] = None, group_id: Optional[str] = None):
        self.token = token or os.environ.get("MUZMIR_VK_TOKEN", "")
        self.group_id = group_id or os.environ.get("MUZMIR_VK_GROUP_ID", "")
        self.api_version = os.environ.get("MUZMIR_VK_API_VERSION", "5.199")

    def available(self) -> bool:
        return bool(self.token and self.group_id)

    def post(self, text: str, attachments: Optional[str] = None, **kwargs) -> dict:
        """
        Публикует запись на стене сообщества.
        text        — текст поста;
        attachments — строка вложений VK (photo<owner>_<id>,...), опционально.
        """
        if not self.available():
            return skipped(self.platform, "нет MUZMIR_VK_TOKEN / MUZMIR_VK_GROUP_ID")
        params = {
            "owner_id": f"-{self.group_id.lstrip('-')}",
            "from_group": 1,
            "message": text,
            "access_token": self.token,
            "v": self.api_version,
        }
        if attachments:
            params["attachments"] = attachments
        try:
            resp = http_post_form(f"{VK_API}/wall.post", params)
        except Exception as e:
            return skipped(self.platform, f"сеть недоступна: {e}")
        if "error" in resp:
            msg = resp["error"].get("error_msg", "unknown")
            logger.warning("[vk] API error: %s", msg)
            return {"ok": False, "platform": self.platform, "error": msg}
        post_id = resp.get("response", {}).get("post_id")
        logger.info("[vk] опубликовано post_id=%s", post_id)
        return ok(self.platform, post_id=post_id)


def post(text: str, **kwargs) -> dict:
    """Функциональная обёртка над VKAdapter.post."""
    return VKAdapter().post(text, **kwargs)
