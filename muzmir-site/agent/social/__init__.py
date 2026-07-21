"""
Адаптеры соцсетей мозг-агента КЦ «Музыкальный Мир».

Каждый адаптер имеет функцию post(...) и класс с методом post(...),
читает креды из окружения и делает тихий фолбэк с логом, если кредов нет
(реальные доступы Музмира ещё не переданы). Это позволяет собрать и протестировать
весь конвейер публикаций до подключения реальных токенов.
"""
from .vk import VKAdapter, post as vk_post
from .telegram import TelegramAdapter, post as tg_post
from .youtube import YouTubeAdapter, post as yt_post

__all__ = [
    "VKAdapter", "vk_post",
    "TelegramAdapter", "tg_post",
    "YouTubeAdapter", "yt_post",
    "broadcast",
]


def broadcast(text: str, **kwargs) -> dict:
    """Публикует текст во все доступные площадки. Возвращает статус по каждой."""
    return {
        "vk": vk_post(text, **kwargs),
        "telegram": tg_post(text, **kwargs),
        "youtube": yt_post(text, **kwargs),
    }
