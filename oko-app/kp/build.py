# -*- coding: utf-8 -*-
import re, html, pathlib
BASE = pathlib.Path("/tmp/claude-0/-home-user-OKO-TEAM/6128eb90-b8e0-5d74-8a3a-298c6d212b0e/scratchpad")
tpl = (BASE/"kp_oko/kp_v4_template.html").read_text()
logo = "data:image/png;base64," + (BASE/"logo_b64.txt").read_text().strip()
# reuse lava links from build.py
src = (BASE/"kp_oko/build.py").read_text()
LK = {m.group(1): m.group(2) for m in re.finditer(r'^([LR]\d+)="([^"]+)"', src, re.M)}
L1000, L2000, L3000 = LK['L1000'], LK['L2000'], LK['L3000']
R1000, R2000, R3000 = LK['R1000'], LK['R2000'], LK['R3000']
CK = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>'

def vcard(folder, fid, tag, name, desc, url, label="Открыть", vid=True):
    media = (f'<video class="lazyvid" data-src="kp-media/{folder}/{fid}.mp4" poster="kp-media/{folder}/{fid}.jpg" muted loop playsinline preload="none"></video>'
             if vid else f'<img src="kp-media/{folder}/{fid}.jpg" alt="{html.escape(name)}" loading="lazy">')
    return (f'<div class="vcard"><div class="vc-media"><span class="vc-tag">{tag}</span>{media}</div>'
            f'<div class="vc-body"><div class="vc-name">{html.escape(name)}</div><div class="vc-desc">{html.escape(desc)}</div>'
            f'<a class="vc-open" href="{url}" target="_blank" rel="noopener">{label} →</a></div></div>')

# --- SITES (igloo #1, trionn #2, ... ducks/evenes last) ---
SITES = [
 ("igloo","Уровень · WebGL","igloo.inc","3D-кристалл, WebGL и скролл-кинематика — планка мира.","https://igloo.inc"),
 ("trionn","Уровень · 3D","TRIONN","Дизайн-студия: 3D-объекты, плавный моушен, интерактив.","https://trionn.com"),
 ("airpods","Скролл-видео","Apple · AirPods Pro","Эталон скролл-видео: кадр разворачивается по скроллу.","https://www.apple.com/airpods-pro/"),
 ("rivian","Кино-скролл","Rivian","Кинематографичный скролл-опыт вокруг продукта.","https://rivian.com"),
 ("activetheory","WebGL / XR","Active Theory","Награждённые WebGL/XR-миры мирового уровня.","https://activetheory.net"),
 ("cuberto","Моушен","Cuberto","Плавные интеракции и моушен — такой уровень под ключ.","https://cuberto.com"),
 ("basement","Студия","Basement","Клиенты MrBeast, KidSuper — премиум разработка.","https://basement.studio"),
 ("zajno","Моушен","Zajno · motion","Круговые reveal-эффекты и моушен-сторителлинг.","https://motion.zajno.com"),
 ("adoratorio","Арт-WebGL","Adoratorio","Арт-WebGL студия из Brescia / Amsterdam.","https://adoratorio.studio"),
 ("robinnoguier","Портфолио","Robin Noguier","Award-портфолио: типографика и моушен.","https://robin-noguier.com"),
 ("playdate","Моушен","Panic · Playdate","Игровой скролл-сторителлинг Panic.","https://play.date"),
 ("metaquest","3D-опыт","Meta Quest","Иммерсивный продуктовый 3D-опыт.","https://www.meta.com/quest"),
 ("gsap","Моушен","GSAP","Библиотека анимаций — сама как моушен-сайт.","https://gsap.com"),
 ("ducks","Наш кейс","DUCK'S GAME","Наш премиум моушен-сайт: 3D, скролл, интерактив.","https://ducks.games"),
 ("evenes","Наш кейс · 3D","Evene's","Наш моушен-сайт агентства: Three.js, 3D, интерактив.","https://evenes.site"),
]
site_cards = "\n".join(vcard("sites", fid, tag, name, desc, url, "Открыть сайт") for fid,tag,name,desc,url in SITES)

# --- SYSTEMS ---
SYS = [
 ("s1","Артём Бриус","Блогер-миллионник. Единая система: сайт и медиа-хаб.","https://okoteam.top/sistema"),
 ("s6","Коптилыч","Полная система медийности: контент, стратегия, аналитика.","https://okoteam.top/sistema"),
 ("s5","Сан Саныч","Система роста от стратегии до контента — новая аудитория.","https://okoteam.top/media/sansanych-sistem"),
 ("s3","Катя","Стратегия, контент и ведение — клиенты на постоянной основе.","https://okoteam.top/media/Ekaterina-sistem"),
 ("s7","МиндОС","Образование: система медийности и поток клиентов.","https://okoteam.top/media/mindOS-sistem"),
 ("s2","Ковры · UK","Чистка ковров (UK): онлайн, соцсети, поток заявок.","https://mcrfloorcare.co.uk/sistem"),
 ("s4","Система OKO · демо","Живой кабинет: контент-план 90 дней, воронки, CRM, аналитика.","https://okoteam.top/sistema"),
]
sys_cards = "\n".join(vcard("sys", fid, "Система", name, desc, url, "Смотреть") for fid,name,desc,url in SYS)

# --- REELS ---
reel_lbl = ["Моушен","Динамика","Промо","Reels","Бренд","Обзор"]
reel_desc = ["Динамичный моушен с анимацией лого и субтитрами.","Промо-ролик под соцсети: ритм и энергия.","Reels для охватов: хук, монтаж, титры.","Бренд-ролик: стиль, темп, айдентика.","Продуктовый обзор с инфографикой.","Вертикальный клип для ленты и Shorts."]
reel_cards = "\n".join(vcard("reels", f"r{i}", "Монтаж", f"Ролик · {reel_lbl[i-1]}", reel_desc[i-1], "https://t.me/ktodaniel", "Заказать монтаж") for i in range(1,7))

# --- LEAD (реальные аккаунты, фото-скрины) ---
LEADS = [
 ("crimeanmasha","@crimeanmasha","Личный бренд · Лиссабон","+216% · 5К → 15.8К","https://instagram.com/crimeanmasha"),
 ("allayavedma","@alla_yavedma","Эзотерика · автор","305.6К подписчиков","https://instagram.com/alla_yavedma"),
 ("magazin1nav","@magazin1.nav","ТАЧШОП · маркетплейс","347К подписчиков","https://instagram.com/magazin1.nav"),
 ("silamudrosti","Сила мудрости","Психология · развитие","398К подписчиков","https://instagram.com/sila_mudrosti"),
 ("dryazdan","@dryazdan","Стоматология · косметология","286К подписчиков","https://instagram.com/dryazdan"),
 ("sayacollection","@sayacollection.tj","Женская одежда · Душанбе","90.4К подписчиков","https://instagram.com/sayacollection.tj"),
 ("kee","Kee","Психология людей · YouTube","212К подписчиков","https://youtube.com/@Kee0111"),
 ("hiddenlibrary","The Hidden Library","История · знания · YouTube","202К подписчиков","https://youtube.com/@thehiddenlibrary33"),
]
lead_cards = "\n".join(vcard("lead", fid, "Ведение", name, f"{note} · {metric}", url, "Открыть профиль", vid=False) for fid,name,note,metric,url in LEADS)

# --- TIERS (accordion, per-day, struck price, region) ---
def tli(label, detail, hl=False):
    lab = f'<b class="mark">{label}</b>' if hl else html.escape(label)
    return (f'<div class="tli{" hl" if hl else ""}"><div class="tli-q"><span class="ck">{CK}</span>{lab}<span class="ar">›</span></div>'
            f'<div class="tli-a"><div>{html.escape(detail)}</div></div></div>')

def tier(name, tag, feat, usd_old, rub_old, usd_day, rub_day, usd_tot, rub_tot, lava_u, lava_r, days, items):
    lis = "".join(tli(*it) for it in items)
    return (f'<div class="tier{" feat" if feat else ""}">'
            f'<div class="tier-name">{name}</div><div class="tier-tag">{tag}</div>'
            f'<div class="tier-oldprice" data-usd="{usd_old}" data-rub="{rub_old}">{usd_old}</div>'
            f'<div class="tier-perday"><b data-usd="{usd_day}" data-rub="{rub_day}">{usd_day}</b><span>в день</span></div>'
            f'<div class="tier-total">{days} · полная <b data-usd="{usd_tot}" data-rub="{rub_tot}">{usd_tot}</b> · рассрочка</div>'
            f'<ul class="tier-list">{lis}</ul>'
            f'<div class="tier-btns">'
            f'<a href="{lava_u}" data-usd="{lava_u}" data-rub="{lava_r}" target="_blank" class="btn btn-lime btn-sm pay-btn">Запустить</a>'
            f'<a href="contracts/Договор_OKO_{name}.docx" download class="btn btn-outline-lime btn-sm">Скачать договор</a>'
            f'</div></div>')

tiers = (
 tier("СТАРТ","Запуск бизнеса под ключ",False,"$5 000","500 000&#8201;₽","$17","1 600&#8201;₽","$1000","100 000&#8201;₽",L1000,R1000,"60 дней · 2 мес",[
   ("Продающий лендинг + Telegram-бот","Быстрый цепляющий сайт под вашу нишу + бот, который принимает заявки 24/7."),
   ("Брендбук + оформление 5 соцсетей","Логотип, цвета, шрифты, единый стиль и оформление шапок/актуального в 5 сетях."),
   ("Система роста OKO","Стратегия, воронки и контент-план на 90 дней — живой интерактивный кабинет."),
   ("Контент-завод: 100 роликов","Сто вертикальных моушен-роликов с анимацией лого и субтитрами.",True),
   ("1 ИИ-агент + «мозг»","Подключение, настройка и сопровождение одного агента, который ведёт клиентов.",True),
 ]),
 tier("БИЗНЕС","Рост и автоматизация",True,"$10 000","1 000 000&#8201;₽","$22","2 200&#8201;₽","$2000","200 000&#8201;₽",L2000,R2000,"90 дней · 3 мес",[
   ("Многостраничный сайт + бот","Полноценный сайт с разделами, каталогом/услугами и умным ботом."),
   ("Система роста с аналитикой и админкой","Кабинет с метриками, воронками и управлением — всё видно в одном месте."),
   ("Оформление и ведение соцсетей под ключ","Мы ведём соцсети за вас: контент, публикации, ответы, рост."),
   ("Штаб 5 ИИ-агентов с админкой","Пять агентов: продажи, диалоги, прогрев, закрытие — под вашим контролем.",True),
   ("Контент-завод: 300 роликов","Триста роликов в потоке — стабильный контент каждый месяц.",True),
 ]),
 tier("ИМПЕРИЯ","Полный digital под ключ",False,"$15 000","1 500 000&#8201;₽","$25","2 500&#8201;₽","$3000","300 000&#8201;₽",L3000,R3000,"120 дней · 4 мес",[
   ("Премиум моушен-сайт (3D/WebGL) + приложение","Сайт мирового уровня как в этом КП: 3D, скролл-кинематика + мобильное приложение."),
   ("Полная система роста + ведение всех соцсетей","Максимальная система и ведение всех площадок под ключ."),
   ("Штаб ИИ-агентов + голос + CRM + аналитика","Полный штаб с голосом, CRM и сквозной аналитикой сделок.",True),
   ("Контент-завод: 500 роликов","Пятьсот роликов в месяц — максимальная медийность.",True),
   ("Персональный менеджер и приоритет","Ваш менеджер на связи и приоритет в очереди на задачи."),
 ]),
)

# --- REVIEWS ---
SND = '<svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M3 9v6h4l5 5V4L7 9H3z"/></svg>'
PLAY = '<svg width="16" height="16" viewBox="0 0 24 24" fill="#000"><polygon points="6 4 20 12 6 20 6 4"/></svg>'
def vrev(fid, name):
    return (f'<div class="rcirc" onclick="playCirc(this)"><div class="rcirc-v">'
            f'<video src="kp-media/rev/{fid}.mp4" poster="kp-media/rev/{fid}.jpg" muted loop playsinline preload="none" data-lazy></video>'
            f'<span class="snd">{SND}</span></div><div class="rcirc-nm">{html.escape(name)}</div></div>')
vrev_circles = "".join([vrev("rv16","Владислав"),vrev("rv99","Даниил"),vrev("rv91","Сан Саныч"),vrev("rv95","Александр"),vrev("rv17","Владислав Н.")])
def voice(fid, name):
    return (f'<div class="rcirc voice"><div class="rcirc-v"><button class="rcirc-play" onclick="playVoice(this)">{PLAY}</button>'
            f'<audio src="kp-media/rev/{fid}.mp3" preload="none"></audio></div><div class="rcirc-nm">{html.escape(name)}</div></div>')
voice_circles = "".join([voice("vo15","RAVEN"),voice("vo24","ДИМА"),voice("vo92","Артём")])

def trev(name, text):
    ini = name.strip()[:1].upper()
    return (f'<div class="trev"><div class="trev-h"><div class="trev-av">{ini}</div>'
            f'<div><div class="trev-nm">{html.escape(name)}</div><div class="trev-st">★★★★★</div></div></div>'
            f'<div class="trev-tx">{html.escape(text)}</div></div>')
TREV = [
 ("MALIKA","Даниэль, безмерно счастлива, что познакомилась с вами — всё оперативно, качественно и без воды. Теперь есть понимание, как система соцсетей работает изнутри!"),
 ("чаппа","Давно хотел разобраться с медийностью — и всё стало ясно! Создали аккаунты, оформили, настроили. Постинг автоматический в 10 сетях. Очень доволен."),
 ("Клиент OKO","Упаковка медийности прошла на ура. Было 2,4к подписчиков, стало 3,7к. Ребята знают, что делают. Спасибо!"),
 ("Анастасия","Спасибо команде за креатив, подачу и оперативность. Помогли упаковать все соцсети и объяснить стратегию. Монтажёры и SMM — крутые!"),
 ("Виктория","Упаковали все соцсети красиво и стильно. Спасибо монтажёру за ролики, дизайнеру за оформление и SMM за публикации в срок. Супер!"),
 ("Vito","Спасибо за помощь в создании и настройке соцсетей. Посмотрел на медийку с другой стороны. Отсняли, обработали и запостили — здорово и вдохновляюще!"),
 ("Тамара","То, что ты для меня создал — очень крутой продукт! Меня буквально упаковали. От души благодарю!"),
 ("Ирина","Благодарю за разбор блога — разложили всё по полочкам и дали идеи. Вы профессионалы и даёте огромную пользу новичкам."),
]
trev_cards = "\n".join(trev(n,t) for n,t in TREV)

# --- SUBSTITUTE ---
out = tpl
for k,v in [("__LOGO__",logo),("__SITE_CARDS__",site_cards),("__SYS_CARDS__",sys_cards),("__REEL_CARDS__",reel_cards),
            ("__LEAD_CARDS__",lead_cards),("__TIERS__","".join(tiers)),
            ("__VREV_CIRCLES__",vrev_circles),("__VOICE_CIRCLES__",voice_circles),("__TREV_CARDS__",trev_cards),
            ("__CK__",CK)]:
    out = out.replace(k,v)
left = set(re.findall(r"__[A-Z0-9_]+__", out))
print("leftover tokens:", left)
outp = BASE/"kp_oko/kp_v4.html"
outp.write_text(out)
print("written", outp, f"{len(out)//1024} KB")
