"""Цены бота. Единственный источник правды по деньгам.

Всё считается в жетонах. Курс к доллару задан здесь и больше нигде.
Опорные цифры себестоимости — замеры на нашей A6000 (0,50 $/час):

    фото 1024              4,0 с   0,00056 $
    фото по референсу     10,0 с   0,0014  $
    ролик 2 с, горизонт   61,0 с   0,0085  $
    ролик 2 с, вертикаль 149,0 с   0,0207  $

То есть себестоимость — копейки. Цена ставится от ценности для клиента,
а не от затрат; себестоимость нужна лишь чтобы видеть маржу и ловить
случаи, когда тариф уходит в минус.
"""

TOKENS_PER_USD = 100
USD_RUB = 92

# Стоимость карты в секунду, доллары. Отсюда считается себестоимость.
GPU_USD_PER_SECOND = 0.50 / 3600


class Job:
    """Вид генерации: чего стоит клиенту и сколько занимает карту."""

    def __init__(self, key, title, tokens, seconds, note=""):
        self.key = key
        self.title = title
        self.tokens = tokens
        self.seconds = seconds
        self.note = note

    @property
    def cost_usd(self):
        """Себестоимость: сколько карты съедает одна такая генерация."""
        return self.seconds * GPU_USD_PER_SECOND

    @property
    def price_usd(self):
        return self.tokens / TOKENS_PER_USD

    @property
    def margin(self):
        """Во сколько раз цена выше себестоимости."""
        c = self.cost_usd
        return float("inf") if c == 0 else self.price_usd / c


JOBS = {
    j.key: j
    for j in [
        Job("photo",       "Фото",              3,  4.0,  "по описанию"),
        Job("photo_ref",   "Фото по образцу",   6, 10.0,  "с вашим фото, поза и сцена любые"),
        Job("inpaint",     "Правка фото",       6, 12.0,  "меняем обведённое, лицо не трогаем"),
        Job("video_2",     "Ролик 2 секунды",  40, 149.0, "вертикальный"),
        Job("video_3",     "Ролик 3 секунды",  60, 220.0, "вертикальный"),
        Job("video_5",     "Ролик 5 секунд",  100, 370.0, "вертикальный"),
        Job("animate",     "Оживить фото",     40, 149.0, "ваше фото оживает"),
    ]
}

# Пакеты жетонов. Купленные не сгорают никогда.
PACKS = [
    {"id": "p1", "tokens": 300,   "usd": 5,   "bonus": 0},
    {"id": "p2", "tokens": 700,   "usd": 10,  "bonus": 100},
    {"id": "p3", "tokens": 2000,  "usd": 25,  "bonus": 500},
    {"id": "p4", "tokens": 5000,  "usd": 50,  "bonus": 2000},
    {"id": "p5", "tokens": 12000, "usd": 100, "bonus": 6000},
]

# Сколько жетонов даём новичку, чтобы он попробовал до всякой оплаты.
WELCOME_TOKENS = 30

# Сколько получает пригласивший и приглашённый.
REFERRAL_INVITER = 100
REFERRAL_INVITEE = 50


def job(key):
    if key not in JOBS:
        raise KeyError(f"неизвестный вид генерации: {key}")
    return JOBS[key]


def pack(pack_id):
    for p in PACKS:
        if p["id"] == pack_id:
            return p
    raise KeyError(f"неизвестный пакет: {pack_id}")


def pack_total(pack_id):
    """Сколько жетонов реально придёт на баланс, с бонусом."""
    p = pack(pack_id)
    return p["tokens"] + p["bonus"]


def rub(usd):
    return round(usd * USD_RUB)


def tokens_to_rub(tokens):
    return rub(tokens / TOKENS_PER_USD)
