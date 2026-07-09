"""Тесты пред-фильтра. Запуск: python -m pytest oko-agents-review/wave1/ -q"""

from filter_prefilter import prefilter


def test_stop_word_sex_hard_skip():
    r = prefilter("Нужна вебкам модель, оплата ежедневно, интим")
    assert r.should_respond is False
    assert r.score == 0
    assert r.risk_level == "high"
    assert r.stop_words_found


def test_stop_word_no_pay():
    r = prefilter("Тестовое задание без оплаты, за портфолио, потом обсудим")
    assert r.should_respond is False
    assert r.stop_words_found


def test_good_smm_vacancy_autoreply():
    r = prefilter("Ищу SMM для стоматологической клиники, Instagram и ролики, "
                  "бюджет 40-60 тыс/мес, от 3 месяцев")
    assert r.should_respond is True
    assert r.score >= 60
    assert r.niche_detected in ("смм", "контент")
    assert r.budget_detected_rub == [40000, 60000]


def test_landing_with_budget_and_urgency():
    r = prefilter("Сделать лендинг под ключ для автосервиса, бюджет до 80к, срочно")
    assert r.should_respond is True
    assert r.niche_detected == "сайт"
    assert r.urgency == "срочно"
    assert r.budget_detected_rub == 80000


def test_app_usd_budget_converted():
    r = prefilter("Требуется разработчик приложения iOS/Android, MVP, $5000")
    assert r.niche_detected == "приложение"
    assert isinstance(r.budget_detected_rub, int)
    assert r.budget_detected_rub >= 400000  # 5000 * 95


def test_too_short():
    r = prefilter("Привет")
    assert r.should_respond is False
    assert r.score == 0


def test_vague_goes_to_claude():
    r = prefilter("Ищем человека вести проект, детали в личке")
    assert r.should_respond is False
    assert r.needs_claude is True


def test_schema_keys_match_prompt():
    r = prefilter("Нужен телеграм-бот для записи клиентов, бюджет 30000 руб").to_dict()
    for key in ("should_respond", "score", "niche_detected",
                "budget_detected_rub", "urgency", "reason",
                "stop_words_found", "risk_level"):
        assert key in r
