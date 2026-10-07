# -*- coding: utf-8 -*-
"""Полная страница передачи проекта «Кластер».

Собирается НА СЕРВЕРЕ: значения доступов берутся из мастер-хранилища и
secrets.env и никуда больше не уходят. Результат — один самодостаточный файл
/opt/oko-poster/peredacha/klaster.html, он отдаётся только по паролю.
"""
import base64, io, json, os, re, subprocess

ХРАНИЛИЩЕ = '/opt/oko-poster/cfg/OKO_MASTER_VAULT.md'
АРХИВ = '/opt/oko-poster/peredacha/arhiv'
ВЫХОД = '/opt/oko-poster/peredacha/klaster.html'
ЛОГО = '/var/www/klaster-site/assets/logo/klaster-znak-belyi.png'
ПАРОЛЬ = 'Klaster-2026-Peredacha'
П = 'https://okoteam.top'
ДАТА = '07.10.2026'

# ---------- разбор мастер-хранилища ----------
def разделы_хранилища():
    строки = io.open(ХРАНИЛИЩЕ, encoding='utf-8', errors='replace').read().splitlines()
    начало = None
    for i, l in enumerate(строки):
        if l.startswith('## 15.') and 'АКТИВИТИ' in l:
            начало = i
            break
    if начало is None:
        return []
    куски = []
    текущий = None
    for l in строки[начало:]:
        if l.startswith('## ') and не_наш(l) and текущий is not None:
            break
        if l.startswith('### ') or l.startswith('## '):
            if текущий:
                куски.append(текущий)
            текущий = {'имя': l.lstrip('# ').strip(), 'строки': []}
        elif текущий is not None:
            текущий['строки'].append(l)
    if текущий:
        куски.append(текущий)
    return [к for к in куски if к['строки']]


def не_наш(l):
    верх = l.upper()
    return ('КЛАСТЕР' not in верх and 'АКТИВИТИ' not in верх
            and 'ПОЧТА РОССИИ' in верх or l.startswith('## ПОЧТА РОССИИ'))


def таблица_в_html(строки):
    """Markdown-таблицы и обычный текст -> HTML. Значения не трогаем."""
    куски = []
    буфер = []

    def слить_таблицу():
        if not буфер:
            return
        ряды = [р for р in буфер if not re.match(r'^\s*\|[\s:|-]+\|\s*$', р)]
        html = ['<table class="tb">']
        for n, р in enumerate(ряды):
            ячейки = [я.strip() for я in р.strip().strip('|').split('|')]
            тег = 'th' if n == 0 else 'td'
            html.append('<tr>' + ''.join('<%s>%s</%s>' % (тег, оформить(я), тег) for я in ячейки) + '</tr>')
        html.append('</table>')
        куски.append(''.join(html))
        буфер.clear()

    абзац = []
    for л in строки:
        if л.strip().startswith('|'):
            if абзац:
                куски.append('<p>%s</p>' % оформить(' '.join(абзац)))
                абзац = []
            буфер.append(л)
        else:
            слить_таблицу()
            if л.strip():
                абзац.append(л.strip())
            elif абзац:
                куски.append('<p>%s</p>' % оформить(' '.join(абзац)))
                абзац = []
    слить_таблицу()
    if абзац:
        куски.append('<p>%s</p>' % оформить(' '.join(абзац)))
    return ''.join(куски)


def оформить(т):
    т = (т.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
          .replace('\\|', '|'))
    т = re.sub(r'`([^`]+)`', r'<code>\1</code>', т)
    т = re.sub(r'\*\*([^*]+)\*\*', r'<b>\1</b>', т)
    т = re.sub(r'(?<![\w/@.-])((?:https?://|www\.)[^\s<>"]+)',
               lambda m: '<a href="%s" target="_blank" rel="noopener">%s</a>'
               % (m.group(1) if m.group(1).startswith('http') else 'https://' + m.group(1), m.group(1)), т)
    return т


# ---------- живые значения ----------
def из_boevogo():
    путь = '/opt/oko-poster/peredacha/live_cfg.json'
    if os.path.exists(путь):
        return json.load(io.open(путь, encoding='utf-8'))
    return {}


def из_окружения():
    нужно = ['ACTIVITI_TG_BOT_USERNAME', 'ACTIVITI_TG_BOT_TOKEN', 'ACTIVITI_TG_MANAGER_IDS',
             'ACTIVITI_GMAIL', 'ACTIVITI_GMAIL_PASS', 'ACTIVITI_GMAIL_APP_PASS',
             'ACTIVITI_LEADS_GROUP', 'ACTIVITI_LEADS_THREAD', 'ACTIVITI_LEADS_INVITE',
             'ACTIVITI_HANDLE', 'YANDEX_VC_LOGIN', 'YANDEX_VC_PASS']
    из = {}
    путь = '/opt/oko-poster/cfg/secrets.env'
    if os.path.exists(путь):
        for л in io.open(путь, encoding='utf-8', errors='replace'):
            м = re.match(r'(?:export\s+)?([A-Z0-9_]+)\s*=\s*(.*)', л.strip())
            if м and м.group(1) in нужно:
                из[м.group(1)] = м.group(2).strip().strip('"\'')
    return из


def опись_архива():
    итог = []
    for корень, папки, файлы in os.walk(АРХИВ):
        if корень == АРХИВ:
            continue
        отн = os.path.relpath(корень, АРХИВ)
        if отн.count(os.sep) > 1:
            continue
        n = 0
        s = 0
        for к2, _, ф2 in os.walk(корень):
            for ф in ф2:
                n += 1
                s += os.path.getsize(os.path.join(к2, ф))
        if n:
            итог.append((отн, n, s))
    return sorted(итог)


def вес(b):
    if b >= 1073741824:
        return '%.1f ГБ' % (b / 1073741824.0)
    if b >= 1048576:
        return '%.1f МБ' % (b / 1048576.0)
    return '%.0f КБ' % (b / 1024.0)


def из_hranilishcha():
    т = io.open(ХРАНИЛИЩЕ, encoding='utf-8', errors='replace').read()
    из = {}
    м = re.search(r'Яндекс[^|\n]*\|[^|\n]*?логин\s+(\S+?)\s*[,/]\s*пароль\s+(\S+)', т)
    if not м:
        м = re.search(r'вход Яндекс\s+(\S+)\s*/\s*(\S+)', т)
    if м:
        из['YANDEX_VC_LOGIN'], из['YANDEX_VC_PASS'] = м.group(1), м.group(2).rstrip('|').strip()
    м = re.search(r'(-100\d{10,})', т)
    if м:
        из['ACTIVITI_LEADS_GROUP'] = м.group(1)
    м = re.search(r'app-пароль Google:\s*([A-Za-z ]{12,24})', т)
    if м:
        из['ACTIVITI_GMAIL_APP_PASS'] = м.group(1).strip()
    return из


env = из_окружения()
бой = из_boevogo()
хран = из_hranilishcha()
for ключ, зн in хран.items():
    if not env.get(ключ):
        env[ключ] = зн
env.setdefault('ACTIVITI_TG_BOT_TOKEN', бой.get('TG_TOKEN', ''))
env.setdefault('ACTIVITI_TG_MANAGER_IDS', бой.get('TG_IDS', ''))
env.setdefault('ACTIVITI_GMAIL', бой.get('GMAIL', ''))
env.setdefault('ACTIVITI_GMAIL_APP_PASS', бой.get('GMAIL_APP', ''))
env.setdefault('ACTIVITI_TG_BOT_USERNAME', 'aktivitiorderbot')
env.setdefault('ACTIVITI_HANDLE', 'aktiviti.official')
знак = 'data:image/png;base64,' + base64.b64encode(open(ЛОГО, 'rb').read()).decode()
к = ПАРОЛЬ

# ---------- содержимое ----------
def ряд(a, b, c=''):
    пусто = re.sub(r'<[^>]+>|\s|:|,', '', str(b)) == ''
    if пусто:
        return ''
    c = re.sub(r'(пароль|пароль приложения для SMTP|приглашение)\s*:\s*(<code></code>)?\s*(?=,|$)', '', c or '')
    c = c.strip(' ,')
    доп = '<em>%s</em>' % c if c else ''
    return '<div class="rw"><b>%s</b><span>%s%s</span></div>' % (a, b, доп)


зая = ''.join([
    ряд('Бот заявок', '@%s' % env.get('ACTIVITI_TG_BOT_USERNAME', 'aktivitiorderbot'),
        'токен: <code>%s</code>' % env.get('ACTIVITI_TG_BOT_TOKEN', '')),
    ряд('Кому уходит в Telegram', '<code>%s</code>' % env.get('ACTIVITI_TG_MANAGER_IDS', ''),
        'id руководителей, по ним бот шлёт заявку в личные сообщения'),
    ряд('Рабочая группа', '<code>%s</code>' % env.get('ACTIVITI_LEADS_GROUP', ''),
        'форум «ООО «АКТИВИТИ»», ветка заявок %s, приглашение: %s'
        % (env.get('ACTIVITI_LEADS_THREAD', ''), env.get('ACTIVITI_LEADS_INVITE', ''))),
    ряд('Почта отправителя', env.get('ACTIVITI_GMAIL', ''),
        'пароль: <code>%s</code>, пароль приложения для SMTP: <code>%s</code>'
        % (env.get('ACTIVITI_GMAIL_PASS', ''), env.get('ACTIVITI_GMAIL_APP_PASS', ''))),
    ряд('Кому уходит письмо', 'ddouglas@activity.su', 'задано в настройках сайта, меняется там же'),
    ряд('Яндекс ID (Дзен, vc.ru)', env.get('YANDEX_VC_LOGIN', ''),
        'пароль: <code>%s</code>' % env.get('YANDEX_VC_PASS', '')),
    ряд('Единый ник соцсетей', env.get('ACTIVITI_HANDLE', ''), 'плюс klasterofficial на части площадок'),
])

материалы = ''.join([
    ряд('Боевой сайт', '<a href="https://clusterspace.ru/">clusterspace.ru</a>'),
    ряд('Демо-копия сайта', '<a href="%s/klaster/">okoteam.top/klaster</a>' % П,
        'для согласований, счётчик отключён'),
    ряд('Панель проекта', '<a href="%s/klient/klaster/?k=Oko2026">okoteam.top/klient/klaster</a>' % П,
        'пакеты сдачи по дням и отчёты по конкурентам, пароль Oko2026'),
    ряд('Архив всех материалов', '<a href="arhiv.php?k=%s">открыть архив</a>' % к,
        'файлы из рабочего чата и готовые пакеты, скачивание по одному или архивом'),
    ряд('Контент-пакет', '<a href="%s/klaster-kontent/">okoteam.top/klaster-kontent</a>' % П,
        '56 единиц: посты, карусели, обложки, готовый ролик'),
    ряд('Разведка конкурентов', '<a href="%s/razvedka-klaster-2026-09-22/">сводка 22.09</a>, '
        '<a href="%s/klaster-kontent/razvedka-2026-09-05.html">сводка 05.09</a>' % (П, П)),
    ряд('Презентация объекта', '<a href="%s/klaster/assets/files/klaster-presentation.pdf">PDF, 8,6 МБ</a>' % П),
    ряд('Бренд-пак', '<a href="%s/klaster/assets/brand/klaster-brand-pack.zip">архив, 3,9 МБ</a>' % П,
        'логотип во всех форматах и размерах, вектор, обзорный лист'),
    ряд('Видео для сайта', '<a href="%s/klaster/assets/video/live_hero.mp4">шесть роликов</a>' % П),
    ряд('Фотографии и рендеры', '169 файлов', 'каталог <code>/klaster/assets/img/</code>'),
])

ДНИ = [('6 сентября', 'den_2026-09-06_2c084d48c2dc130c45231193'),
       ('10 сентября', 'den_2026-09-10_aef83e3ad1c70c47539db2d5'),
       ('27 сентября', 'den_2026-09-27_a1ab488d07f753232202345c'),
       ('30 сентября', 'den_2026-09-30_1ef41b20f7e040721a0455f3'),
       ('3 октября', 'den_2026-10-03_f152d2ba0a4296862d433a0d'),
       ('4 октября', 'den_2026-10-04_9bffeb721716c0eff8b8119c'),
       ('5 октября', 'den_2026-10-05_55db7b68d2701b461f2b2bba'),
       ('6 октября', 'den_2026-10-06_2a6d93a68c107aed90ba401a')]
дни = ('<div class="chips">' + ''.join(
    '<a href="%s/klient/klaster/%s.html">%s</a>' % (П, ф, н) for н, ф in ДНИ) + '</div>')

def файлы_папки(имя):
    путь = os.path.join(АРХИВ, имя)
    если = []
    if not os.path.isdir(путь):
        return ''
    for ф in sorted(os.listdir(путь)):
        п = os.path.join(путь, ф)
        if os.path.isfile(п):
            если.append('<a href="fayl.php?k=%s&p=%s&d=1">%s <i>%s</i></a>'
                        % (к, (имя + '/' + ф).replace(' ', '%20'), ф, вес(os.path.getsize(п))))
    return '<div class="chips">' + ''.join(если) + '</div>' if если else ''


строки_архива = ''.join(
    ряд(имя, '%d файлов, %s' % (n, вес(s)),
        '<a href="arhiv.php?k=%s&dir=%s">открыть</a>' % (к, имя))
    for имя, n, s in опись_архива())

инфра = ''.join([
    ряд('Где лежит сайт', '<code>/var/www/klaster-site</code> на сервере OKO',
        'Ubuntu 26.04, nginx, PHP 8.5, хост msk-1-vm-f3d9, адрес 104.171.132.45'),
    ряд('Данные счётчика', '<code>/var/www/klaster-data/events/ГГГГ-ММ-ДД.jsonl</code>',
        'вне корня сайта, адрес посетителя только хешем'),
    ряд('Обработчик заявок', '<code>/var/www/klaster-site/api/lead.php</code>',
        'настройки и ключи: <code>api/config.php</code>, права 0640'),
    ряд('Сертификат', 'Let’s Encrypt, certbot', 'продление автоматическое, проверка дважды в сутки'),
    ряд('Резервные копии', 'каждая правка главной страницы сохраняет предыдущую рядом'),
    ряд('Исходники', 'репозиторий gdeoko/oko-team, папка <code>klaster_project</code>',
        'сайт в <code>03_deliverables/website</code>, инструкция деплоя там же'),
])

люди = ''.join([
    ряд('Собственник', 'Doberman, @doberman985'),
    ряд('По доверенности', 'Александр Стамат, @astamat2'),
    ряд('Маркетинг', 'Диана Дуглас @DianaDouglas, +7 964 770 70 20, ddouglas@activity.su; Аврора @avroradozortseva'),
    ряд('Общая почта', 'office@activity.su, телефон +7 936 245 04 30'),
    ряд('Айтишник заказчика', 'Eugene, @paraveller', 'ему уходят записи DNS'),
    ряд('Исполнитель', 'Ильясов Даниэль Альбертович, OKO TEAM',
        '+7 977 995-55-66, okoteam.top@gmail.com, @ktodaniel'),
])

после = ''.join([
    ряд('1. Сменить пароли', 'Gmail проекта, Яндекс ID, панель Timeweb Cloud, пароль этой страницы',
        'после смены пришлите новые значения тому, кто ведёт сайт'),
    ряд('2. Перевыпустить токены', 'токен бота заявок через @BotFather, API-токен Timeweb',
        'старые перестанут работать, в настройках сайта поставить новые'),
    ряд('3. Проверить доставку заявок', 'каждый руководитель открывает бота и жмёт «Старт»',
        'без этого личные сообщения от бота не доходят'),
    ряд('4. Решить по хостингу', 'сайт остаётся у нас или переезжает на ваш сервер Timeweb',
        'сервер klaster-aktiviti в вашем аккаунте уже заведён, оплата не внесена'),
    ряд('5. Продлить домен', 'clusterspace.ru оплачен до 09.12.2026', 'регистратор в вашем аккаунте'),
    ряд('6. Удалить эту страницу', 'после приёмки скажите, и мы её снимем',
        'здесь собраны все ключи проекта, хранить её долго не нужно'),
])

открыто = ''.join([
    '<li>Лист планировки района в векторе или PDF: на сайте растровая копия.</li>',
    '<li>Описание Telegram-канала <b>@radialnya</b> устарело.</li>',
    '<li>Перенаправление <b>activity.su</b> на clusterspace.ru: домен в вашем аккаунте Рег.ру.</li>',
    '<li>Решение, публиковать ли цену машиноместа 6 000 рублей в месяц.</li>',
    '<li>Ник канала в Telegram меняет только создатель, у нас права админа.</li>',
])

# разделы мастер-хранилища как есть, но без нашей внутренней кухни
НЕ_ОТДАЁМ_РАЗДЕЛЫ = ('МЕХАНИКА ГЕНЕРАЦИИ',)
НЕ_ОТДАЁМ_СТРОКИ = ('VNC', 'socks', 'SOCKS', 'xray', 'PAC ', 'aktiviti.pac',
                    'view-8811858f7234', '10811', '9333')


def наше_внутреннее(л):
    return any(м in л for м in НЕ_ОТДАЁМ_СТРОКИ)


хранилище_html = []
убрано = 0
for р in разделы_хранилища():
    имя = р['имя']
    if any(м in имя.upper() for м in НЕ_ОТДАЁМ_РАЗДЕЛЫ):
        убрано += 1
        continue
    if имя.startswith('15.'):
        имя = 'Реестр проекта в хранилище OKO'
    строки = []
    for л in р['строки']:
        if наше_внутреннее(л):
            убрано += 1
            continue
        строки.append(л)
    if not [л for л in строки if л.strip()]:
        continue
    хранилище_html.append('<h3>%s</h3>%s' % (оформить(имя), таблица_в_html(строки)))
хранилище_html = ''.join(хранилище_html)
print('скрыто внутренних строк и разделов: %d' % убрано)

СТИЛЬ = '''
*{box-sizing:border-box}html{-webkit-text-size-adjust:100%}
body{margin:0;background:#F4F2ED;color:#2B2B2A;font:16px/1.6 Manrope,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif}
.obl{max-width:900px;margin:0 auto;padding:0 18px}
.shapka{background:#3C3C3B;color:#fff;padding:30px 0 34px}
.znak{display:flex;align-items:center;gap:14px}
.znak img{width:46px;height:46px;display:block}
.znak span{font:600 13px/1.2 Manrope,sans-serif;letter-spacing:.14em;text-transform:uppercase;color:rgba(255,255,255,.72)}
h1{font:600 clamp(26px,6vw,38px)/1.1 Oswald,Manrope,sans-serif;text-transform:uppercase;margin:22px 0 10px}
.pod{margin:0;color:rgba(255,255,255,.78);font-size:15px;max-width:640px}
.meta{margin:18px 0 0;display:flex;flex-wrap:wrap;gap:8px}
.meta i{font-style:normal;background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.16);border-radius:4px;padding:5px 10px;font-size:12.5px}
section{background:#fff;border:1px solid #E6E3DC;border-radius:8px;padding:22px 22px 24px;margin:18px 0}
section>h2{font:600 15px/1.25 Oswald,Manrope,sans-serif;text-transform:uppercase;letter-spacing:.08em;margin:0 0 4px;color:#3C3C3B}
section>h2+.hint{margin:0 0 16px;color:#6E6B64;font-size:13.5px}
h3{font:600 14px/1.3 Oswald,Manrope,sans-serif;text-transform:uppercase;letter-spacing:.06em;margin:22px 0 8px;color:#3C3C3B}
.rw{display:grid;grid-template-columns:210px 1fr;gap:4px 18px;padding:11px 0;border-top:1px solid #EFEDE7}
.rw:first-of-type{border-top:0}
.rw b{font-weight:600;font-size:14px;color:#6E6B64}
.rw span{font-size:15px;word-break:break-word}
.rw em{display:block;font-style:normal;color:#6E6B64;font-size:13px;margin-top:3px}
a{color:#8A6200}
code{background:#F4F2ED;border:1px solid #E6E3DC;border-radius:4px;padding:1px 6px;font:13px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace;word-break:break-all}
ul{margin:10px 0 0;padding:0;list-style:none}
ul li{position:relative;padding-left:18px;margin:0 0 7px;font-size:15px}
ul li::before{content:"";position:absolute;left:3px;top:9px;width:6px;height:6px;border-radius:50%;background:#DFAB00}
.vazhno{background:#FFF8E4;border:1px solid #F0DFA6;border-radius:6px;padding:14px 16px;margin:16px 0 0;font-size:14.5px}
.vazhno b{display:block;margin-bottom:5px}
.chips{margin-top:10px;display:flex;flex-wrap:wrap;gap:8px}
.chips a{background:#fff;border:1px solid #E6D9A8;border-radius:5px;padding:6px 11px;text-decoration:none;font-size:13.5px}
.chips a i{font-style:normal;color:#6E6B64;font-size:12px;margin-left:5px}
.tb{width:100%;border-collapse:collapse;margin:8px 0 14px;font-size:14px}
.tb th{text-align:left;background:#F4F2ED;color:#6E6B64;font-weight:600;font-size:12.5px;text-transform:uppercase;letter-spacing:.05em}
.tb{table-layout:fixed}
.tb th:first-child,.tb td:first-child{width:170px}
.tb th,.tb td{border:1px solid #EFEDE7;padding:8px 10px;vertical-align:top;overflow-wrap:anywhere}
.podval{color:#6E6B64;font-size:13.5px;padding:8px 0 34px;text-align:center}
@media (max-width:620px){
 .rw{grid-template-columns:1fr;gap:2px;padding:10px 0}
 .rw b{font-size:12.5px;letter-spacing:.04em;text-transform:uppercase}
 section{padding:18px 16px 20px}
 .tb,.tb tbody,.tb tr,.tb td,.tb th{display:block;width:100%}
 .tb tr{border:1px solid #EFEDE7;border-radius:6px;margin-bottom:10px;padding:4px}
 .tb th,.tb td{border:0;padding:5px 8px}
 .tb tr:first-child{display:none}
}
@media print{body{background:#fff}section{break-inside:avoid}}
'''

HTML = '''<!doctype html><html lang="ru"><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Передача проекта «Кластер», ООО «Активити»</title>
<style>%(стиль)s</style></head><body>
<header class="shapka"><div class="obl">
<div class="znak"><img src="%(знак)s" alt="Знак бизнес-парка «Кластер»"><span>Бизнес-парк «Кластер» · ООО «Активити»</span></div>
<h1>Передача проекта</h1>
<p class="pod">Полная передача: все доступы, ключи и пароли, все материалы за период работы
с прямыми ссылками, вся техническая часть. Страница закрыта паролем и не индексируется.</p>
<div class="meta"><i>Договор 005/2026 от 24.06.2026</i><i>Исполнитель: OKO TEAM</i><i>Собрано %(дата)s</i></div>
</div></header>
<main class="obl">

<section>
<h2>Доступы и ключи проекта</h2>
<p class="hint">Всё, что нужно, чтобы вести проект без нас. Значения действующие, проверены %(дата)s.</p>
%(заявки)s
<div class="vazhno"><b>Сразу после приёмки смените пароли</b>
Эти значения передаются в открытом виде и разойдутся по перепискам. Порядок смены ниже,
в разделе «Что сделать после приёмки».</div>
</section>

<section>
<h2>Реестр проекта целиком</h2>
<p class="hint">Выгрузка из нашего рабочего реестра: сервер заказчика, домены, почта, бот,
соцсети, где что лежит. Как есть, ничего не вырезано.</p>
%(хранилище)s
</section>

<section>
<h2>Материалы и архив</h2>
<p class="hint">Всё сделанное за период работы. Ссылки живые, проверены %(дата)s.</p>
%(материалы)s
<div class="vazhno"><b>Пакеты сдачи по дням</b>
Каждый рабочий день сложен в отдельную страницу с результатами.
%(дни)s</div>
<h3>Что лежит в архиве</h3>
%(архив)s
<h3>Пакеты одним файлом</h3>
<p class="hint">Готовые архивы: брендбук, сайт, контент-план, соцсети, Система OKO,
рабочие заметки, оригиналы заказчика.</p>
%(пакеты)s
<h3>Переписка по веткам</h3>
<p class="hint">Все вложения рабочего чата, разложенные по темам форума.</p>
%(ветки)s
</section>

<section>
<h2>Техническая часть</h2>
<p class="hint">Для того, кто будет вести сайт дальше.</p>
%(инфра)s
</section>

<section>
<h2>Люди и контакты</h2>
%(люди)s
</section>

<section>
<h2>Что сделать после приёмки</h2>
<p class="hint">Шесть шагов по порядку.</p>
%(после)s
</section>

<section>
<h2>Что осталось открытым</h2>
<ul>%(открыто)s</ul>
</section>

</main>
<p class="podval">OKO TEAM · полная передача проекта «Кластер» · страница закрыта паролем и не индексируется</p>
</body></html>'''

итог = HTML % {'стиль': СТИЛЬ, 'знак': знак, 'дата': ДАТА, 'заявки': зая,
               'хранилище': хранилище_html, 'материалы': материалы, 'дни': дни,
               'архив': строки_архива,
               'пакеты': файлы_папки('pakety'), 'ветки': файлы_папки('chat_zip'), 'инфра': инфра, 'люди': люди,
               'после': после, 'открыто': открыто}
io.open(ВЫХОД, 'w', encoding='utf-8').write(итог)
os.chmod(ВЫХОД, 0o644)
print('страница собрана: %d символов, %.1f КБ' % (len(итог), len(итог.encode('utf-8')) / 1024.0))
print('разделов из хранилища: %d' % len(разделы_хранилища()))
print('папок в архиве: %d' % len(опись_архива()))
