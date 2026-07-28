# -*- coding: utf-8 -*-
import json, html, pathlib
BASE = pathlib.Path("/tmp/claude-0/-home-user-OKO-TEAM/6128eb90-b8e0-5d74-8a3a-298c6d212b0e/scratchpad")
tpl = (BASE/"kp_oko/kp_v2_template.html").read_text()

# --- logo data-uri ---
logo = "data:image/png;base64," + (BASE/"logo_b64.txt").read_text().strip()

# --- screenshots ---
shots = json.load(open(BASE/"kp_assets/shots_b64.json"))
shotsm = json.load(open(BASE/"kp_assets/shots_mob_b64.json"))  # mobile phone-tall

# --- lava links ---
L1000="https://app.lava.top/products/1b338bb5-72a1-4820-9241-0a821ba2193d/a27800ae-8d40-4771-8800-741d8f2f4544?paymentParams=CiAgICAgICAgewogICAgICAgICAgImludm9pY2VJZCI6ICIxMDg4OGQ3MC0zOGFkLTRmODAtYTM5NS0yMDljMjI2ODRmMGUiLAogICAgICAgICAgInBheW1lbnRTZXR0aW5ncyI6IHsiaWQiOiIxMDg4OGQ3MC0zOGFkLTRmODAtYTM5NS0yMDljMjI2ODRmMGUiLCJ0eXBlIjoiaW52b2ljZSIsInN0YXR1cyI6Im5ldyIsImFtb3VudF90b3RhbCI6eyJjdXJyZW5jeSI6IlVTRCIsImFtb3VudCI6MTAwMC4wMH0sInByb3ZpZGVyIjp7Im5hbWUiOiJ1bmxpbWludCIsInBhcmFtZXRlcnMiOnsicmVkaXJlY3RfdXJsIjoiaHR0cHM6Ly9jYXJkcGF5LmNvbS9NSS9wYXltZW50Lmh0bWw_dXVpZD1jR0dDRjBoNkcxYTM2MTU3MEdnMzBBZUQiLCJpZnJhbWVBbGxvd2VkIjoidHJ1ZSJ9fX0KICAgICAgICB9CiAgICAgIA"
L2000="https://app.lava.top/products/1b338bb5-72a1-4820-9241-0a821ba2193d/a27800ae-8d40-4771-8800-741d8f2f4544?paymentParams=CiAgICAgICAgewogICAgICAgICAgImludm9pY2VJZCI6ICIyZjdlYjI2OC1hZTcwLTQzZGItYWM0OC05MjExMmJhMDI0MTEiLAogICAgICAgICAgInBheW1lbnRTZXR0aW5ncyI6IHsiaWQiOiIyZjdlYjI2OC1hZTcwLTQzZGItYWM0OC05MjExMmJhMDI0MTEiLCJ0eXBlIjoiaW52b2ljZSIsInN0YXR1cyI6Im5ldyIsImFtb3VudF90b3RhbCI6eyJjdXJyZW5jeSI6IlVTRCIsImFtb3VudCI6MjAwMC4wMH0sInByb3ZpZGVyIjp7Im5hbWUiOiJ1bmxpbWludCIsInBhcmFtZXRlcnMiOnsicmVkaXJlY3RfdXJsIjoiaHR0cHM6Ly9jYXJkcGF5LmNvbS9NSS9wYXltZW50Lmh0bWw_dXVpZD1lZDRGZmdmMEhoR2hmQ2c3ZjBiRUFHODYiLCJpZnJhbWVBbGxvd2VkIjoidHJ1ZSJ9fX0KICAgICAgICB9CiAgICAgIA"
L3000="https://app.lava.top/products/1b338bb5-72a1-4820-9241-0a821ba2193d/a27800ae-8d40-4771-8800-741d8f2f4544?paymentParams=CiAgICAgICAgewogICAgICAgICAgImludm9pY2VJZCI6ICIxN2RiOWRiZi0xZjhhLTQzMjktODBlNS1iNzFmMDI3Y2M2MDYiLAogICAgICAgICAgInBheW1lbnRTZXR0aW5ncyI6IHsiaWQiOiIxN2RiOWRiZi0xZjhhLTQzMjktODBlNS1iNzFmMDI3Y2M2MDYiLCJ0eXBlIjoiaW52b2ljZSIsInN0YXR1cyI6Im5ldyIsImFtb3VudF90b3RhbCI6eyJjdXJyZW5jeSI6IlVTRCIsImFtb3VudCI6MzAwMC4wMH0sInByb3ZpZGVyIjp7Im5hbWUiOiJ1bmxpbWludCIsInBhcmFtZXRlcnMiOnsicmVkaXJlY3RfdXJsIjoiaHR0cHM6Ly9jYXJkcGF5LmNvbS9NSS9wYXltZW50Lmh0bWw_dXVpZD1nZ2dEZmM3QzM4MEdhQTM0RjM4SDRCYWIiLCJpZnJhbWVBbGxvd2VkIjoidHJ1ZSJ9fX0KICAgICAgICB9CiAgICAgIA"

# RUB links (RF-friendly provider, для оплаты российской картой)
R1000="https://app.lava.top/products/1b338bb5-72a1-4820-9241-0a821ba2193d/a27800ae-8d40-4771-8800-741d8f2f4544?paymentParams=CiAgICAgICAgewogICAgICAgICAgImludm9pY2VJZCI6ICIzNGNhMjJmZi0zOTc0LTRiNTQtODExZS04NWMzM2E2ZTFhNTciLAogICAgICAgICAgInBheW1lbnRTZXR0aW5ncyI6IHsiaWQiOiIzNGNhMjJmZi0zOTc0LTRiNTQtODExZS04NWMzM2E2ZTFhNTciLCJ0eXBlIjoiaW52b2ljZSIsInN0YXR1cyI6Im5ldyIsImFtb3VudF90b3RhbCI6eyJjdXJyZW5jeSI6IlJVQiIsImFtb3VudCI6MTAwMDAwLjAwfSwicHJvdmlkZXIiOnsibmFtZSI6InNtYXJ0X2dsb2NhbCIsInBhcmFtZXRlcnMiOnsic3R5bGVzaGVldCI6Imh0dHBzOi8vd2lkZ2V0LnNtYXJ0LWdsb2NhbC5jb20vcGF5bWVudC1mb3JtLmNzcyIsInNjcmlwdCI6Imh0dHBzOi8vd2lkZ2V0LnNtYXJ0LWdsb2NhbC5jb20vcGF5bWVudC1mb3JtLmpzIiwicHVibGljX3Rva2VuIjoiOWM0ZTE0Mjc0OGQ5NjUyMTg5MjE3NGI1MDQ0NDQ5YTFkMThhNTcwNWE2Njg5MGUwNTk1NGE5ZjgwY2M0N2VjZSIsImlmcmFtZUFsbG93ZWQiOiJ0cnVlIn19fQogICAgICAgIH0KICAgICAg"
R2000="https://app.lava.top/products/1b338bb5-72a1-4820-9241-0a821ba2193d/a27800ae-8d40-4771-8800-741d8f2f4544?paymentParams=CiAgICAgICAgewogICAgICAgICAgImludm9pY2VJZCI6ICIyZDYwMGUyYy04ZTFmLTQ3YzItYjg4OS1jMzQxODgwNTViMWYiLAogICAgICAgICAgInBheW1lbnRTZXR0aW5ncyI6IHsiaWQiOiIyZDYwMGUyYy04ZTFmLTQ3YzItYjg4OS1jMzQxODgwNTViMWYiLCJ0eXBlIjoiaW52b2ljZSIsInN0YXR1cyI6Im5ldyIsImFtb3VudF90b3RhbCI6eyJjdXJyZW5jeSI6IlJVQiIsImFtb3VudCI6MjAwMDAwLjAwfSwicHJvdmlkZXIiOnsibmFtZSI6InNtYXJ0X2dsb2NhbCIsInBhcmFtZXRlcnMiOnsic3R5bGVzaGVldCI6Imh0dHBzOi8vd2lkZ2V0LnNtYXJ0LWdsb2NhbC5jb20vcGF5bWVudC1mb3JtLmNzcyIsInNjcmlwdCI6Imh0dHBzOi8vd2lkZ2V0LnNtYXJ0LWdsb2NhbC5jb20vcGF5bWVudC1mb3JtLmpzIiwicHVibGljX3Rva2VuIjoiMjQ1ZDFkODVhNGJlY2RlMzg5YTExMjA1NTgxMDk2OTllNzgwN2JjMDJhYzkyMDM2NzM5NDQzM2U4MDFlYTdkNyIsImlmcmFtZUFsbG93ZWQiOiJ0cnVlIn19fQogICAgICAgIH0KICAgICAg"
R3000="https://app.lava.top/products/1b338bb5-72a1-4820-9241-0a821ba2193d/a27800ae-8d40-4771-8800-741d8f2f4544?paymentParams=CiAgICAgICAgewogICAgICAgICAgImludm9pY2VJZCI6ICJiYjFiNjhiMS01MjkxLTQ0ZjEtOTMwYS1lYTAzZGIxMzQwNzciLAogICAgICAgICAgInBheW1lbnRTZXR0aW5ncyI6IHsiaWQiOiJiYjFiNjhiMS01MjkxLTQ0ZjEtOTMwYS1lYTAzZGIxMzQwNzciLCJ0eXBlIjoiaW52b2ljZSIsInN0YXR1cyI6Im5ldyIsImFtb3VudF90b3RhbCI6eyJjdXJyZW5jeSI6IlJVQiIsImFtb3VudCI6MzAwMDAwLjAwfSwicHJvdmlkZXIiOnsibmFtZSI6InNtYXJ0X2dsb2NhbCIsInBhcmFtZXRlcnMiOnsic3R5bGVzaGVldCI6Imh0dHBzOi8vd2lkZ2V0LnNtYXJ0LWdsb2NhbC5jb20vcGF5bWVudC1mb3JtLmNzcyIsInNjcmlwdCI6Imh0dHBzOi8vd2lkZ2V0LnNtYXJ0LWdsb2NhbC5jb20vcGF5bWVudC1mb3JtLmpzIiwicHVibGljX3Rva2VuIjoiOTgzZGRmMzk3Y2FkNWQ3YWJiZmIwYTc2MWVmYzYxN2I4YzVmZDU1NDgzNGU0M2JiMzIwNzQ1MmU4ZDM4NjRkMyIsImlmcmFtZUFsbG93ZWQiOiJ0cnVlIn19fQogICAgICAgIH0KICAgICAg"
CK='<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>'

# --- КОНТЕНТ-ЗАВОД: 6 реальных монтажных роликов (kp-media/reels/rN.mp4) ---
reel_labels=["Моушен","Динамика","Промо","Reels","Бренд","Обзор"]
# marquee (мелкие плитки, авто-прокрутка вверху)
marquee="".join(
    f'<div class="mq-item"><video class="lazyvid" muted loop playsinline preload="none" poster="kp-media/reels/r{i}.jpg" data-src="kp-media/reels/r{i}.mp4"></video><span class="tag">{lb}</span></div>'
    for i,lb in enumerate(reel_labels,1))
# reel-cards (в карточке 03, как vidcard)
reel_descs=["Динамичный моушен-ролик с анимацией лого и субтитрами.","Промо-ролик под соцсети, ритм и энергия.","Reels для охватов: хук, монтаж, титры.","Бренд-ролик: стиль, темп, айдентика.","Продуктовый обзор с инфографикой.","Вертикальный клип для ленты и Shorts."]
reel_cards="".join(
    f'<div class="vidcard"><div class="vc-media"><span class="vc-tag">Монтаж</span>'
    f'<video class="lazyvid" data-src="kp-media/reels/r{i}.mp4" poster="kp-media/reels/r{i}.jpg" muted loop playsinline preload="none"></video></div>'
    f'<div class="vc-body"><div class="vc-name">Ролик · {lb}</div><div class="vc-desc">{reel_descs[i-1]}</div>'
    f'<div class="vc-links"><a class="pri" href="https://t.me/ktodaniel" target="_blank" rel="noopener">Заказать монтаж</a></div></div></div>'
    for i,lb in enumerate(reel_labels,1))

def vidcard(folder,fid,tag,name,desc,watch,order=None,watch_label="Смотреть"):
    links=f'<a class="pri" href="{watch}" target="_blank" rel="noopener">{watch_label}</a>'
    if order: links+=f'<a href="{order}" target="_blank" rel="noopener">Заказать такую же</a>'
    return (f'<div class="vidcard"><div class="vc-media"><span class="vc-tag">{tag}</span>'
            f'<video class="lazyvid" data-src="kp-media/{folder}/{fid}.mp4" poster="kp-media/{folder}/{fid}.jpg" muted loop playsinline preload="none"></video></div>'
            f'<div class="vc-body"><div class="vc-name">{name}</div><div class="vc-desc">{desc}</div>'
            f'<div class="vc-links">{links}</div></div></div>')

# СИСТЕМЫ — 7 видео-демо реальных систем (кейсы + ссылки)
SYS=[
 ("s1","Система","Артём Бриус","Блогер-миллионник. Единая система — сайт и медиа-хаб, объединяющий все платформы, контент и продукты в одном месте.","https://briusteam.ru","https://okoteam.top/web"),
 ("s6","Система","Коптилыч · Система роста","Полная система медийности: контент, соцсети, стратегия и аналитика — бизнес растёт и привлекает клиентов на автомате.","https://okoteam.top/sistema","https://okoteam.top/sistema"),
 ("s5","Система","Сан Саныч · Система роста","Эксперт и предприниматель. Система медийности от стратегии до контента — новая аудитория и масштаб бизнеса.","https://okoteam.top/media/sansanych-sistem","https://okoteam.top/sistema"),
 ("s3","Система","Катя · Система роста","Эксперт в нише. Стратегия, контент и ведение соцсетей — клиенты на постоянной основе.","https://okoteam.top/media/Ekaterina-sistem","https://okoteam.top/sistema"),
 ("s7","Система","МиндОС · Система роста","Образование и развитие. Система медийности выводит бренд на новую аудиторию и стабильный поток клиентов.","https://okoteam.top/media/mindOS-sistem","https://okoteam.top/sistema"),
 ("s2","Система · UK","Ковры · Система роста","Чистка и химчистка ковров (UK). Выход в онлайн, клиенты через соцсети, стабильный поток заявок.","https://mcrfloorcare.co.uk/sistem","https://okoteam.top/sistema"),
 ("s4","Система","Система OKO · демо","Живой кабинет: контент-план 90 дней, воронки, CRM, трекеры роста и аналитика — всё в одном месте.","https://okoteam.top/sistema","https://okoteam.top/sistema"),
]
sys_vids="\n".join(vidcard("sys",fid,tag,name,desc,watch,order) for fid,tag,name,desc,watch,order in SYS)

# САЙТЫ — наши кейсы (видео экрана) + моушен-сайты уровня igloo.inc (референсы)
SITES_OKO=[
 ("screens","site_koptylich","Наш кейс","Коптилыч","Бренд домашних копчёностей: сайт, магазин, академия — запуск с нуля.","http://koptylich.ru/meat","https://okoteam.top/web"),
 ("screens","site_mcr","Наш кейс · UK","MCR Floor Care","Клининг ковров, Великобритания: лендинг, калькулятор, заявки.","http://mcrfloorcare.co.uk","https://okoteam.top/web"),
 ("screens","site_evenes","Наш кейс · 3D","Evene's","Премиальный моушен-сайт агентства: 3D, Three.js, интерактив.","http://evenes.site","https://okoteam.top/web"),
]
SITES_REF=[
 ("sites","cuberto","Уровень · моушен","Cuberto","Плавные интеракции и моушен мирового уровня — так мы собираем премиум-сайты под ключ.","https://cuberto.com","https://okoteam.top/web"),
 ("sites","14islands","Уровень · моушен","14islands","Анимации и сторителлинг — эталон, на который мы работаем.","https://14islands.com","https://okoteam.top/web"),
 ("sites","aristide","Уровень · WebGL","Aristide Benoist","Кинематографичный WebGL и типографика — планка топовых моушен-сайтов.","https://www.aristidebenoist.com","https://okoteam.top/web"),
]
# site_vids собирается после проверки записей (см. ниже переменную SITE_OK)
def build_site_vids(ref_ok):
    cards=[vidcard(f,fid,tag,name,desc,watch,order) for f,fid,tag,name,desc,watch,order in SITES_OKO]
    for f,fid,tag,name,desc,watch,order in SITES_REF:
        if fid in ref_ok:
            cards.append(vidcard(f,fid,tag,name,desc,watch,order))
    return "\n".join(cards)
import os as _os
_refdir=str(BASE/"kp_deploy/kp-media/sites")
SITE_OK=set(f[:-4] for f in _os.listdir(_refdir) if f.endswith('.mp4')) if _os.path.isdir(_refdir) else set()
site_vids=build_site_vids(SITE_OK)

# ВЕДЕНИЕ — карточки с анимированными графиками (реальные цифры из портфолио)
def leadcard(plat,name,note,badge,num,sub,bars,url):
    spans="".join(f'<span style="--h:{h}%"></span>' for h in bars)
    return (f'<div class="leadcard"><div class="lc-top"><div><div class="lc-plat">{plat}</div>'
            f'<div class="lc-name">{name}</div></div><div class="lc-badge">{badge}</div></div>'
            f'<div class="lc-note">{note}</div><div class="lc-chart">{spans}</div>'
            f'<div class="lc-metric"><div class="lc-num">{num}</div><div class="lc-sub">{sub}</div></div>'
            f'<a class="lc-open" href="{url}" target="_blank" rel="noopener">Открыть профиль →</a></div>')
LEADS=[
 ("Instagram","Владимир Алексеев","Контент, медийность и маркетинг","1.5M","1 500 000+","подписчиков",[22,30,42,55,70,85,100],"https://instagram.com/vladimiralekseev"),
 ("Instagram","Артём Бриус","Ведение, стратегия, медийность","1M+","1 000 000+","подписчиков",[30,38,50,60,72,88,100],"https://briusteam.ru"),
 ("Instagram","@chef_sansanych","Шеф-повар · гастро-клуб","+217%","6К → 19К","за 3 недели",[20,28,40,55,72,88,100],"https://instagram.com/chef_sansanych"),
 ("Instagram","@dryazdan","Стоматология · косметология","+43%","200К → 286К","за 2 месяца",[40,50,58,66,78,90,100],"https://instagram.com/dryazdan"),
 ("TikTok","@koptylich","Копчение · академия","0 → 14K","с нуля","за 1 месяц",[8,18,30,45,62,82,100],"https://okoteam.top/sistema"),
 ("Instagram","@tort1kg","Кондитерская","+230%","рост продаж","стратегия + Reels",[18,30,44,58,70,86,100],"https://instagram.com/tort1kg"),
 ("Instagram","@crimeanmasha","Личный бренд · Лиссабон","+216%","5К → 15.8К","за 3 недели",[20,30,42,56,70,86,100],"https://instagram.com/crimeanmasha"),
 ("Telegram","@briusnespit","Артём Бриус · Telegram","+23 000","подписчиков","ведение канала",[24,34,46,58,72,86,100],"https://t.me/briusnespit"),
]
lead_cards="\n".join(leadcard(*l) for l in LEADS)

# --- РЕАЛЬНЫЕ видео-отзывы (скачаны из @okoreviews через аккаунт ktodaniel) ---
SND='<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M3 9v6h4l5 5V4L7 9H3z"/></svg>'
def vidrev(fid,name):
    return (f'<div class="reel" onclick="playRev(this)">'
            f'<video src="kp-media/rev/{fid}.mp4" poster="kp-media/rev/{fid}.jpg" muted loop playsinline preload="none" data-lazy></video>'
            f'<span class="rl-name">{name}</span><span class="rl-snd">{SND}</span></div>')
vreviews="".join([
    vidrev("rv16","Владислав Никишин"),
    vidrev("rv99","Кочетов Даниил"),
    vidrev("rv91","Сан Саныч"),
    vidrev("rv95","Александр"),
    vidrev("rv17","Владислав Никишин"),
])
PLAY='<svg width="18" height="18" viewBox="0 0 24 24" fill="#000"><polygon points="6 4 20 12 6 20 6 4"/></svg>'
def voicecard(fid,name):
    return (f'<div class="voice"><button class="voice-btn" onclick="playVoice(this)">{PLAY}</button>'
            f'<div class="voice-wave"></div><div class="voice-nm">{name}</div>'
            f'<audio src="kp-media/rev/{fid}.mp3" preload="none"></audio></div>')
voices="\n".join([voicecard("vo15","RAVEN · медийка"),voicecard("vo24","ДИМА"),voicecard("vo92","Артём")])

# --- text reviews ---
def trev(name,text,url=None):
    ini=name.strip()[:1].upper()
    media=f'<a class="rev-media" href="{url}" target="_blank" rel="noopener">Смотреть в @okoreviews →</a>' if url else ''
    return (f'<div class="rev"><div class="rev-h"><div class="rev-av">{ini}</div>'
            f'<div><div class="rev-nm">{html.escape(name)}</div><div class="rev-st">★★★★★</div></div></div>'
            f'<div class="rev-tx">{html.escape(text)}</div>{media}</div>')
treviews="\n".join([
    trev("MALIKA · медийка","Даниэль, выражаю Вам благодарность! Безмерно счастлива, что познакомилась с вами — всё оперативно, качественно, профессионально и без воды. Наконец есть понимание, как система соцсетей устроена изнутри и как с ней грамотно взаимодействовать для максимального результата!","https://t.me/okoreviews/14"),
    trev("чаппа","Давно хотел разобраться с медийностью — и благодаря услуге всё стало ясно! Создали аккаунты, красиво оформили, настроили. Постинг теперь автоматический: публикую видео в 10 сетях одновременно с описаниями и хештегами. Очень доволен результатом.","https://t.me/okoreviews/20"),
    trev("Клиент OKO","Упаковка медийности прошла на ура. Давно хотел повысить продажи, но трафика было мало. Долго думал, стоит ли услуга денег — ни разу не пожалел. Итог: было 2,4к подписчиков, стало 3,7к. Ребята знают, что делают. Спасибо!","https://t.me/okoreviews/37"),
    trev("Анастасия","Хочу поблагодарить команду за креатив, подачу и оперативность. Помогли упаковать все соцсети, разъяснить стратегию ведения. Монтажёры и SMM — крутые. Благодарю, дальнейшего развития и успеха!","https://t.me/okoreviews/51"),
    trev("Виктория","Большое спасибо команде за проделанную работу! Упаковали все социальные сети красиво и стильно, мне очень нравится. Спасибо монтажёру за ролики, дизайнеру за оформление и SMM за публикации в срок. Всё просто супер!","https://t.me/okoreviews/58"),
    trev("Vitо","Спасибо за помощь в создании и настройке соцсетей и объяснение всех нюансов. Посмотрел на медийку с другой стороны, глубже вник в процесс. За время работы отсняли, обработали и запостили видео — получилось здорово и вдохновляюще!","https://t.me/okoreviews/59"),
    trev("Тамара","Осваиваю то, что ты для меня создал — это реально очень крутой продукт! Просто меня упаковали. Осталось научиться пользоваться всеми инструментами, которые ты дал. От души благодарю!","https://t.me/okoreviews/39"),
    trev("Ирина","Благодарю за разбор моего блога — помогли разложить всё по полочкам и дали много идей для продвижения. Вы профессионалы и даёте огромную пользу тем, кто только начинает путь в соцсетях. Помогаете обрести полное понимание, как развивать бренд.","https://t.me/okoreviews/77"),
    trev("Роберт","Выглядит завораживающе! Посмотрел карточки — подходы интересные. Спасибо Екатерине за дизайн, а Даниэлю за информацию!","https://t.me/okoreviews/30"),
    trev("Полина","Выглядит очень интересно и превосходно! У каждой карточки свой дизайн, насыщенные и сочные цвета. Прям вау — дизайнер на славу постарался!","https://t.me/okoreviews/32"),
])

out = tpl
for k,v in [("__LOGO__",logo),("__LAVA1000__",L1000),("__LAVA2000__",L2000),("__LAVA3000__",L3000),
            ("__RUB1000__",R1000),("__RUB2000__",R2000),("__RUB3000__",R3000),
            ("__CK__",CK),("__MARQUEE__",marquee),("__REEL_CARDS__",reel_cards),
            ("__SYS_VIDS__",sys_vids),("__SITE_VIDS__",site_vids),
            ("__LEAD_CARDS__",lead_cards),("__VREVIEWS__",vreviews),("__VOICES__",voices),("__TREVIEWS__",treviews)]:
    out = out.replace(k,v)

# check no leftover placeholders
import re
left=set(re.findall(r"__[A-Z0-9_]+__",out))
print("leftover tokens:",left)
outp = BASE/"kp_oko/kp_v2.html"
outp.write_text(out)
print("written",outp,f"{len(out)//1024} KB")
