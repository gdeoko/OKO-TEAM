"""
Генерация текста поста-афиши под событие конкурса по правилам текстов КЦ.

События:
    open     — приём заявок открыт;
    closing  — последние дни приёма (использует days_left);
    closed   — приём заявок завершён;
    results  — опубликованы результаты.

Функция build_post(event, competition) -> dict возвращает:
    {"title": ..., "text": ..., "signature": ..., "hashtags": [...]}

Тексты собираются шаблонно (без обращения к LLM — быстро и предсказуемо),
затем при желании их можно улучшить через brain.sanitize. Все правила текстов
КЦ соблюдены: «Вы», без эмодзи, короткие тире, «ёлочки», без Telegram-ссылок,
без AI-лексики, без упоминания гендиректора.
"""
from __future__ import annotations

from typing import Optional

try:
    from .brain import sanitize
except Exception:  # запуск как отдельного скрипта
    from brain import sanitize  # type: ignore

SIGNATURE = "КЦ «Музыкальный Мир»"
SITE = "музыкальный-мир.рф"

BASE_TAGS = [
    "#МузыкальныйМир", "#конкурс", "#творчество",
    "#фестиваль", "#таланты",
]


def _name(competition: dict) -> str:
    n = (competition or {}).get("name") or "конкурс"
    return f"«{n}»" if not n.startswith("«") else n


def _type_line(competition: dict) -> str:
    t = (competition or {}).get("type") or ""
    t = t.strip().lower()
    if "международ" in t:
        return "Международный конкурс"
    if "всеросс" in t:
        return "Всероссийский конкурс"
    return "Творческий конкурс"


def _end_date(competition: dict) -> str:
    return (competition or {}).get("end_date") or ""


def build_post(event: str, competition: Optional[dict] = None) -> dict:
    """Собирает пост под событие. Возвращает словарь с полями поста."""
    competition = competition or {}
    name = _name(competition)
    type_line = _type_line(competition)
    end = _end_date(competition)
    days_left = competition.get("days_left")
    url = competition.get("url") or f"https://{SITE}"

    if event == "open":
        title = f"Открыт приём заявок - {name}"
        lines = [
            f"{type_line} {name}. Приём заявок открыт.",
            "Приглашаем солистов, дуэты, ансамбли и коллективы во всех "
            "номинациях: вокал, инструмент, хореография, художественное слово, "
            "театр и другие.",
        ]
        if end:
            lines.append(f"Приём заявок до {end}.")
        lines.append(f"Подать заявку и прочитать положение можно на сайте {SITE}.")
        lines.append("Ждём Ваши выступления.")

    elif event == "closing":
        dl = f"Осталось {days_left} дн." if days_left else "Приём завершается"
        title = f"{dl} - {name}"
        lines = [
            f"{type_line} {name}. {dl} до конца приёма заявок.",
            "Успейте подать работу и побороться за дипломы Лауреата и Гран-при.",
        ]
        if end:
            lines.append(f"Приём заявок до {end}.")
        lines.append(f"Заявка - на сайте {SITE}.")

    elif event == "closed":
        title = f"Приём заявок завершён - {name}"
        lines = [
            f"{type_line} {name}. Приём заявок завершён.",
            "Благодарим всех участников. Жюри приступает к оценке работ.",
            "Результаты будут опубликованы после подведения итогов, каждый "
            "участник получит письмо с дипломом на указанный email.",
        ]

    elif event == "results":
        title = f"Результаты конкурса - {name}"
        lines = [
            f"{type_line} {name}. Итоги подведены.",
            "Дипломы Гран-при, Лауреатов и Дипломантов направлены участникам на "
            "email. Подлинность диплома можно проверить по номеру и QR-коду на "
            "сайте.",
            "Поздравляем победителей и благодарим педагогов.",
            f"Протокол и образцы наград - на сайте {SITE}.",
        ]
    else:
        title = name
        lines = [f"{type_line} {name}. Подробности на сайте {SITE}."]

    text = title + "\n\n" + "\n".join(lines)
    tags = BASE_TAGS.copy()
    if competition.get("name"):
        tag = "#" + "".join(ch for ch in competition["name"] if ch.isalnum())
        if len(tag) > 1:
            tags.append(tag)

    return {
        "title": sanitize(title),
        "text": sanitize(text),
        "signature": SIGNATURE,
        "hashtags": tags,
        "url": url,
    }


def full_text(event: str, competition: Optional[dict] = None) -> str:
    """Готовый текст поста с подписью и хэштегами (для соцсетей)."""
    p = build_post(event, competition)
    return sanitize(p["text"] + "\n\n" + " ".join(p["hashtags"]))


if __name__ == "__main__":
    demo = {"name": "Мировая Сцена", "type": "международный",
            "end_date": "31 марта 2026", "days_left": 3}
    for ev in ("open", "closing", "closed", "results"):
        print("=" * 40, ev)
        print(full_text(ev, demo))
