"""
Адаптер YouTube (Data API v3): обновление описания видео и загрузка роликов
на канал КЦ. Полная загрузка требует OAuth-доступа канала — до передачи реальных
кредов Музмира адаптер работает в режиме тихого фолбэка.

Креды из окружения (в git не класть):
    MUZMIR_YT_API_KEY        — API-ключ (для публичного чтения);
    MUZMIR_YT_ACCESS_TOKEN   — OAuth access token (для записи/загрузки);
    MUZMIR_YT_CHANNEL_ID     — id канала.

Так как YouTube в правилах КЦ - запрещённая для конкурсных ссылок платформа,
адаптер используется только для собственного канала-витрины КЦ (анонсы/записи
онлайн-концертов), не для приёма конкурсных работ.
"""
from __future__ import annotations

import json
import os
from typing import Optional

from ._base import ok, skipped, logger, _verify, HTTP_TIMEOUT

try:
    import requests  # type: ignore
except Exception:  # pragma: no cover
    requests = None

YT_API = "https://www.googleapis.com/youtube/v3"


class YouTubeAdapter:
    platform = "youtube"

    def __init__(self, access_token: Optional[str] = None):
        self.api_key = os.environ.get("MUZMIR_YT_API_KEY", "")
        self.access_token = access_token or os.environ.get("MUZMIR_YT_ACCESS_TOKEN", "")
        self.channel_id = os.environ.get("MUZMIR_YT_CHANNEL_ID", "")

    def available(self) -> bool:
        # Для записи (post) нужен OAuth-токен.
        return bool(self.access_token)

    def post(self, text: str, video_id: Optional[str] = None,
             title: Optional[str] = None, **kwargs) -> dict:
        """
        Обновляет описание (и опционально заголовок) существующего видео.
        Загрузка новых файлов вынесена в upload() (требует resumable upload).
        """
        if not self.available():
            return skipped(self.platform, "нет MUZMIR_YT_ACCESS_TOKEN (OAuth)")
        if not video_id:
            return skipped(self.platform, "не указан video_id для обновления описания")
        if requests is None:
            return skipped(self.platform, "requests недоступен для YouTube API")
        body = {
            "id": video_id,
            "snippet": {
                "categoryId": "10",  # Music
                "description": text,
            },
        }
        if title:
            body["snippet"]["title"] = title
        try:
            r = requests.put(
                f"{YT_API}/videos",
                params={"part": "snippet"},
                headers={"Authorization": f"Bearer {self.access_token}",
                         "Content-Type": "application/json"},
                data=json.dumps(body),
                timeout=HTTP_TIMEOUT, verify=_verify(),
            )
        except Exception as e:
            return skipped(self.platform, f"сеть недоступна: {e}")
        if r.status_code >= 400:
            logger.warning("[youtube] API error %s: %s", r.status_code, r.text[:200])
            return {"ok": False, "platform": self.platform,
                    "error": f"HTTP {r.status_code}"}
        logger.info("[youtube] описание video_id=%s обновлено", video_id)
        return ok(self.platform, video_id=video_id)

    def upload(self, file_path: str, title: str, description: str = "",
               tags: Optional[list] = None, privacy: str = "unlisted") -> dict:
        """
        Загрузка ролика на канал (resumable upload). Требует OAuth-токен и
        библиотеку requests. До передачи реальных кредов - тихий фолбэк.
        """
        if not self.available():
            return skipped(self.platform, "нет MUZMIR_YT_ACCESS_TOKEN (OAuth)")
        if not os.path.exists(file_path):
            return skipped(self.platform, f"файл не найден: {file_path}")
        if requests is None:
            return skipped(self.platform, "requests недоступен для загрузки")
        # Полный resumable-upload реализуется при подключении реального канала.
        logger.info("[youtube] запрос загрузки '%s' (%s) - ожидает реальных кредов",
                    title, file_path)
        return skipped(self.platform, "upload будет включён после передачи OAuth-кредов канала")


def post(text: str, **kwargs) -> dict:
    """Функциональная обёртка над YouTubeAdapter.post."""
    return YouTubeAdapter().post(text, **kwargs)
