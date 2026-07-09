"""
OKO Agents — Wave 1: детерминированный пред-фильтр вакансий.

Дешёвый первый проход БЕЗ обращения к Claude:
  • мгновенно режет стоп-темы (секс, наркотики, скам, работа без оплаты);
  • детектит нишу и бюджет по ключевым словам/регуляркам;
  • даёт score 0-100 и решение should_respond.

Смысл: ~70% входящих вакансий классифицируются здесь бесплатно.
В Claude (generators/filter.py) уходит только «серая зона» (score 20-59)
для точной оценки. Это снижает расход API в разы.

Схема ответа совпадает с prompts/filter.md, чтобы Claude-фильтр и
пред-фильтр были взаимозаменяемы для sender'а.

Запуск теста:  python -m pytest oko-agents-review/wave1/test_filter_prefilter.py
Демо:          python oko-agents-review/wave1/filter_prefilter.py
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field, asdict


# ─────────────────────────────────────────────────────────────
# Словари. Держим здесь, а не в vault, т.к. это техническая логика,
# а не «стиль». Ниши синхронизированы с docs/00_OVERVIEW.md.
# ─────────────────────────────────────────────────────────────

# Немедленный skip. Слова в нормальной форме, матчим по вхождению основы.
STOP_WORDS: tuple[str, ...] = (
    # adult
    "секс", "эрот", "adult", "вебкам", "webcam", "порно", "интим", "18+",
    "escort", "эскорт",
    # наркотики
    "наркот", "закладк", "мефедрон", "гашиш", "шишк", "марихуан",
    # финансовые схемы / скам
    "обнал", "дроппер", "дроп ", "серые схем", "серую схем", "нелегал",
    # эксплуатация
    "без оплаты", "бесплатно за отзыв", "за портфолио", "за отзыв",
    "тестовое без оплаты", "пришлите паспорт", "скан паспорта",
    "предоплата с вашей", "внесите депозит",
)

# Ниши → вес приоритета (выше = теплее). Ключевые слова.
NICHE_KEYWORDS: dict[str, tuple[tuple[str, ...], int]] = {
    "приложение": (("приложени", "мобильн прил", "ios", "android", "mvp", "saas"), 22),
    "сайт":       (("сайт", "лендинг", "landing", "веб-разраб", "вёрстк", "верстк", "интернет-магазин"), 20),
    "бот":        (("телеграм-бот", "тг-бот", "бот ", "chatbot", "чат-бот", "автоворонк"), 20),
    "система":    (("система роста", "штаб", "бизнес-план", "контент-план под ключ"), 22),
    "контент":    (("контент", "ролик", "reels", "рилс", "shorts", "видеомонтаж", "монтаж", "нарезк"), 16),
    "смм":        (("smm", "смм", "ведение соцсет", "инстаграм", "instagram", "таргет", "продвижен"), 16),
    "маркетинг":  (("маркетинг", "воронк", "трафик", "seo", "контекст", "digital", "стратег"), 14),
}

# Ниши-заказчики из docs (не тип работы, а сфера) — небольшой бонус доверия.
GOOD_INDUSTRY = (
    "клиник", "стоматолог", "медицин", "юрист", "юридическ", "автосервис",
    "ремонт", "красот", "салон", "инфобиз", "коуч", "эксперт", "магазин",
    "ecommerce", "e-commerce", "товарк", "b2b", "крипт", "финтех",
    "ставк", "казино", "эзотер", "event", "мероприят",
)

# Срочность
URGENCY_NOW = ("срочно", "сегодня", "сейчас", "asap", "вчера", "горит")
URGENCY_LONG = ("долгосроч", "постоянн", "на длительн", "от 3 месяц", "штат")

# Регулярки бюджета: «40-60 тыс», «от 50000 руб», «100к», «$500»
_RE_RANGE_K = re.compile(r"(\d[\d\s]{0,6})\s*[-–—]\s*(\d[\d\s]{0,6})\s*(?:тыс|к\b|k\b|000)", re.I)
_RE_SINGLE_K = re.compile(r"(?:от|бюджет|до|цена|оплат\w*)\D{0,8}(\d[\d\s]{0,6})\s*(?:тыс|к\b|k\b)", re.I)
_RE_RUB = re.compile(r"(\d[\d\s]{3,9})\s*(?:руб|₽|р\.)", re.I)
_RE_USD = re.compile(r"\$\s*(\d[\d\s]{1,7})", re.I)


@dataclass
class FilterResult:
    should_respond: bool
    score: int
    niche_detected: str
    budget_detected_rub: object  # None | int | [min,max]
    urgency: str
    reason: str
    stop_words_found: list[str] = field(default_factory=list)
    risk_level: str = "low"
    needs_claude: bool = False   # True → передать в Claude-фильтр для уточнения

    def to_dict(self) -> dict:
        return asdict(self)


def _norm(text: str) -> str:
    return re.sub(r"\s+", " ", (text or "").lower()).strip()


def _digits(s: str) -> int:
    return int(re.sub(r"\D", "", s) or 0)


def _extract_budget(text: str):
    """Возвращает None | int(руб) | [min,max] руб. USD → грубо ×95."""
    m = _RE_RANGE_K.search(text)
    if m:
        lo, hi = _digits(m.group(1)) * 1000, _digits(m.group(2)) * 1000
        if lo and hi and lo <= hi:
            return [lo, hi]
    m = _RE_SINGLE_K.search(text)
    if m:
        v = _digits(m.group(1)) * 1000
        if v:
            return v
    m = _RE_RUB.search(text)
    if m:
        v = _digits(m.group(1))
        if v >= 1000:
            return v
    m = _RE_USD.search(text)
    if m:
        v = _digits(m.group(1))
        if v:
            return v * 95
    return None


def prefilter(vacancy_text: str) -> FilterResult:
    """Детерминированный пред-фильтр. Быстро и без сети."""
    t = _norm(vacancy_text)

    if not t or len(t) < 12:
        return FilterResult(False, 0, "другое", None, "неизвестно",
                            "пустой или слишком короткий текст", risk_level="low")

    # 1) Стоп-слова → мгновенный skip
    found = [w.strip() for w in STOP_WORDS if w in t]
    if found:
        return FilterResult(False, 0, "другое", None, "неизвестно",
                            "найдены стоп-слова", stop_words_found=found, risk_level="high")

    # 2) Ниша (берём наиболее весомую совпавшую)
    niche, niche_weight = "другое", 0
    for name, (keys, weight) in NICHE_KEYWORDS.items():
        if any(k in t for k in keys) and weight > niche_weight:
            niche, niche_weight = name, weight

    # 3) Бюджет
    budget = _extract_budget(t)

    # 4) Срочность
    if any(k in t for k in URGENCY_NOW):
        urgency = "срочно"
    elif any(k in t for k in URGENCY_LONG):
        urgency = "долгосрочно"
    else:
        urgency = "неизвестно"

    # 5) Score
    score = 30                                    # база «есть текст, не стоп»
    score += niche_weight                         # +14..22 за нашу нишу
    if any(k in t for k in GOOD_INDUSTRY):
        score += 8                                # знакомая сфера заказчика
    if budget is not None:
        b = budget[0] if isinstance(budget, list) else budget
        if b >= 100000: score += 22
        elif b >= 40000: score += 15
        elif b >= 15000: score += 8
        else: score += 2                          # микро-бюджет
    if urgency == "срочно": score += 6
    if len(t) > 220: score += 4                   # развёрнутое ТЗ = серьёзнее
    score = max(0, min(100, score))

    # 6) Решение. Серую зону отдаём Claude.
    if niche == "другое" and budget is None:
        # не поняли ни нишу, ни деньги — пусть решает Claude
        return FilterResult(False, score, niche, budget, urgency,
                            "ниша и бюджет не распознаны — нужна проверка Claude",
                            needs_claude=True, risk_level="medium")

    should = score >= 40
    needs_claude = 20 <= score < 40               # пограничные — на подтверждение
    reason = (f"ниша: {niche}"
              + (f", бюджет: {budget}" if budget is not None else ", бюджет не указан")
              + f", срочность: {urgency}, score {score}")
    return FilterResult(should, score, niche, budget, urgency, reason,
                        needs_claude=needs_claude, risk_level="low")


if __name__ == "__main__":
    import json
    samples = [
        "Ищу SMM-специалиста для стоматологической клиники в СПб. Instagram, ролики, посты. Бюджет 40-60 тыс/мес, срок от 3 месяцев.",
        "Нужен вебкам-моделью на удалёнке, оплата ежедневно",
        "Сделать лендинг под ключ для автосервиса, бюджет до 80к, срочно",
        "Тестовое задание без оплаты, за портфолио. Потом обсудим.",
        "Привет",
        "Требуется разработчик приложения iOS/Android для доставки, MVP, $5000",
        "Ищем человека вести проект, детали в лс",
    ]
    for s in samples:
        r = prefilter(s)
        print(json.dumps(r.to_dict(), ensure_ascii=False))
