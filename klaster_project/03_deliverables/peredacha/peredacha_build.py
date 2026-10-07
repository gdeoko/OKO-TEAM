# -*- coding: utf-8 -*-
"""Сборка страницы передачи проекта «Кластер». Страница самодостаточная:
ни одного внешнего запроса, лого внутри файлом base64."""
import base64, io, os

БАЗА = os.path.dirname(os.path.abspath(__file__))
ЛОГО = os.path.join(БАЗА, 'klaster-znak-belyi.png')
ВЫХОД = os.path.join(БАЗА, 'klaster.html')

with open(ЛОГО, 'rb') as f:
    знak = 'data:image/png;base64,' + base64.b64encode(f.read()).decode()


def ряд(название, значение, примечание=''):
    доп = u'<em>%s</em>' % примечание if примечание else ''
    return u'<div class="rw"><b>%s</b><span>%s%s</span></div>' % (название, значение, доп)


СТИЛЬ = u'''
*{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{margin:0;background:#F4F2ED;color:#2B2B2A;
 font:16px/1.6 Manrope,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif}
.obl{max-width:880px;margin:0 auto;padding:0 18px}
.shapka{background:#3C3C3B;color:#fff;padding:30px 0 34px}
.shapka .znak{display:flex;align-items:center;gap:14px}
.shapka .znak img{width:46px;height:46px;display:block}
.shapka .znak span{font:600 13px/1.2 Manrope,sans-serif;letter-spacing:.14em;
 text-transform:uppercase;color:rgba(255,255,255,.72)}
h1{font:600 clamp(26px,6vw,38px)/1.1 Oswald,Manrope,sans-serif;text-transform:uppercase;
 margin:22px 0 10px;letter-spacing:.01em}
.pod{margin:0;color:rgba(255,255,255,.78);font-size:15px;max-width:620px}
.meta{margin:18px 0 0;display:flex;flex-wrap:wrap;gap:8px}
.meta i{font-style:normal;background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.16);
 border-radius:4px;padding:5px 10px;font-size:12.5px;color:rgba(255,255,255,.86)}
section{background:#fff;border:1px solid #E6E3DC;border-radius:8px;
 padding:22px 22px 24px;margin:18px 0}
section>h2{font:600 15px/1.25 Oswald,Manrope,sans-serif;text-transform:uppercase;
 letter-spacing:.08em;margin:0 0 4px;color:#3C3C3B}
section>h2+.hint{margin:0 0 16px;color:#6E6B64;font-size:13.5px}
.rw{display:grid;grid-template-columns:200px 1fr;gap:4px 18px;
 padding:11px 0;border-top:1px solid #EFEDE7}
.rw:first-of-type{border-top:0}
.rw b{font-weight:600;font-size:14px;color:#6E6B64}
.rw span{font-size:15px;word-break:break-word}
.rw em{display:block;font-style:normal;color:#6E6B64;font-size:13px;margin-top:3px}
a{color:#8A6200}
ul{margin:10px 0 0;padding:0;list-style:none}
ul li{position:relative;padding-left:18px;margin:0 0 7px;font-size:15px}
ul li::before{content:"";position:absolute;left:3px;top:9px;width:6px;height:6px;
 border-radius:50%;background:#DFAB00}
ol{margin:10px 0 0;padding-left:22px}
ol li{margin:0 0 8px;font-size:15px}
.vazhno{background:#FFF8E4;border:1px solid #F0DFA6;border-radius:6px;
 padding:14px 16px;margin:16px 0 0;font-size:14.5px}
.vazhno b{display:block;margin-bottom:5px}
code{background:#F4F2ED;border:1px solid #E6E3DC;border-radius:4px;
 padding:1px 6px;font:13.5px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace}
.podval{color:#6E6B64;font-size:13.5px;padding:8px 0 34px;text-align:center}
@media (max-width:620px){
 .rw{grid-template-columns:1fr;gap:2px;padding:10px 0}
 .rw b{font-size:12.5px;letter-spacing:.04em;text-transform:uppercase}
 section{padding:18px 16px 20px;border-radius:6px}
 .obl{padding:0 14px}
}
@media print{body{background:#fff}section{break-inside:avoid}}
'''

HTML = u'''<!doctype html>
<html lang="ru"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Передача проекта «Кластер», ООО «Активити»</title>
<style>%(стиль)s</style>
</head><body>

<header class="shapka"><div class="obl">
  <div class="znak"><img src="%(знак)s" alt="Знак бизнес-парка «Кластер»"><span>Бизнес-парк «Кластер» · ООО «Активити»</span></div>
  <h1>Передача проекта</h1>
  <p class="pod">Что сделано, где это живёт, как этим управлять и какие доступы переходят
  к заказчику. Страница закрыта паролем и не индексируется поисковиками.</p>
  <div class="meta"><i>Договор 005/2026 от 24.06.2026</i><i>Исполнитель: OKO TEAM</i><i>Обновлено 07.10.2026</i></div>
</div></header>

<main class="obl">

<section>
  <h2>Сайт</h2>
  <p class="hint">Основной результат работ, работает на нашем сервере, домен указан на него.</p>
  %(сайт)s
  <ul>
    <li>Главная собрана из 14 блоков: что за парк, как выглядит сегодня, транспорт и метро «Каспийская», шаттл от «Царицыно», подъём грузов, параметры помещений, НДС к зачёту, инфраструктура, свободные блоки, что заменили при реновации, условия для брокеров, частые вопросы и форма подбора.</li>
    <li>Интерактивная схема района: пешие маршруты до метро и до вокзального комплекса МЦД и МЖД, новая эстакада, выходы метро, выезды на Каширское и Варшавское шоссе. Маршрут загорается при наведении, на телефоне по касанию.</li>
    <li>Трёхмерные модели блоков и видеообзор корпуса. На телефонах и при экономии трафика тяжёлое не грузится, вместо него статичный кадр.</li>
    <li>Служебные страницы: политика обработки данных, страница выездов на шоссе, своя страница 404 в фирменном стиле.</li>
    <li>Проверено на ширинах 320, 390, 768 и 1440 точек: горизонтальной прокрутки нет, ошибок в консоли нет, битых ссылок нет, у всех изображений заполнены подписи для незрячих.</li>
  </ul>
</section>

<section>
  <h2>Заявки с сайта</h2>
  <p class="hint">Путь заявки от формы до менеджера. Ничего не теряется: уходит сразу в двух направлениях.</p>
  <ol>
    <li>Посетитель заполняет форму подбора помещения в конце главной страницы.</li>
    <li>Форма отправляет данные на <code>/api/lead.php</code> на том же домене.</li>
    <li>Обработчик пишет заявку в Telegram менеджерам через бота <b>@aktivitiorderbot</b> и дублирует письмом на почту отдела аренды.</li>
  </ol>
  <div class="vazhno"><b>Если заявки перестали приходить</b>
  Проверьте по очереди: бот не заблокирован менеджером, менеджер не вышел из рабочей группы,
  почта принимает письма от бота. Доступы и ключи для этой проверки лежат на сервере
  в закрытом файле настроек, в коде сайта их нет и в браузер они не отдаются.</div>
</section>

<section>
  <h2>Аналитика посещений</h2>
  <p class="hint">Свой счётчик, без внешних сервисов и без персональных данных.</p>
  <ul>
    <li>Считаем: просмотры, глубину прокрутки, нажатия на телефон и кнопки, начало и отправку формы, время на странице.</li>
    <li>Данные ложатся суточными файлами вне корня сайта, адрес посетителя хранится только в виде необратимого хеша.</li>
    <li>Сторонних пикселей и рекламных трекеров на сайте нет.</li>
  </ul>
</section>

<section>
  <h2>Где это живёт</h2>
  <p class="hint">Техническая часть. Нужна тому, кто будет вести сайт дальше.</p>
  %(инфра)s
</section>

<section>
  <h2>Материалы и архив проекта</h2>
  <p class="hint">Всё, что сделано за период работы, и прямые ссылки на это.
  Ссылки живые, проверены %(дата)s.</p>
  %(материалы)s
  <div class="vazhno"><b>Пакеты сдачи по дням</b>
  Каждый день работы сложен в отдельную страницу с результатами: что сделано,
  что вышло, какие материалы готовы.
  %(дни)s</div>
</section>

<section>
  <h2>Доступы, которые переходят к заказчику</h2>
  <p class="hint">Перечень ниже. Сами пароли и ключи передаём отдельно, лично в рабочем
  чате или на почту подписанта: на странице их нет.</p>
  %(dostupy)s
</section>

<section>
  <h2>Что осталось за заказчиком</h2>
  <p class="hint">Четыре пункта, которые мы не можем закрыть без вас.</p>
  <ul>
    <li>Лист планировки района в векторе или PDF. Сейчас на сайте растровая копия, по ней схема и строилась.</li>
    <li>Описание Telegram-канала <b>@radialnya</b> устарело, там старые сведения о парке.</li>
    <li>Перенаправление старого домена <b>activity.su</b> на clusterspace.ru. Домен в вашем аккаунте регистратора, нужен доступ или ваша правка: переадресация только по HTTP, почта на домене должна продолжать работать.</li>
    <li>Решение, публиковать ли на сайте цену машиноместа 6 000 рублей в месяц.</li>
  </ul>
</section>

<section>
  <h2>Контакты исполнителя</h2>
  %(контакты)s
</section>

</main>
<p class="podval">OKO TEAM · страница передачи проекта «Кластер» · закрыта паролем, не индексируется</p>
</body></html>
'''

сайт = u''.join([
    ряд(u'Адрес', u'<a href="https://clusterspace.ru/">clusterspace.ru</a>',
        u'и www.clusterspace.ru, с перенаправлением на основной адрес'),
    ряд(u'Защищённое соединение', u'Сертификат Let’s Encrypt',
        u'продлевается автоматически, вмешательство не нужно'),
    ряд(u'Для поисковиков', u'robots.txt и sitemap.xml на месте',
        u'страница передачи и служебные адреса закрыты от индексации'),
    ряд(u'Телефон на сайте', u'8 985 331-02-71', u'отдел аренды, в шапке и в подвале'),
])

инфра = u''.join([
    ряд(u'Сервер', u'Ubuntu 26.04 LTS, nginx, PHP 8.5', u'хост msk-1-vm-f3d9, адрес 104.171.132.45'),
    ряд(u'Папка сайта', u'<code>/var/www/klaster-site</code>',
        u'данные счётчика отдельно, в <code>/var/www/klaster-data</code>, вне корня сайта'),
    ряд(u'Домен', u'clusterspace.ru, имена серверов Selectel',
        u'запись A указывает на сервер выше'),
    ряд(u'Сертификат', u'certbot, служба проверяет продление дважды в сутки'),
    ряд(u'Резервные копии', u'Каждая правка главной страницы сохраняет предыдущую версию рядом',
        u'откат возможен на любую из них'),
    ряд(u'Безопасность', u'Включены HSTS, запрет подбора типа файла, запрет встраивания в чужие страницы, строгая политика переходов',
        u'версия сервера в ответах скрыта'),
])

dostupy = u''.join([
    ряд(u'Домен clusterspace.ru', u'Регистратор и панель DNS'),
    ряд(u'Сервер', u'Доступ к папке сайта и настройкам nginx'),
    ряд(u'Telegram-бот заявок', u'@aktivitiorderbot и рабочая группа приёма заявок'),
    ряд(u'Почта заявок', u'Ящик, на который дублируются заявки с сайта'),
    ряд(u'Соцсети парка', u'Telegram-канал, VK, площадки публикаций'),
    ряд(u'Материалы', u'Логотип во всех форматах, брендбук, фотографии, рендеры, схемы, тексты'),
])

ДАТА = u'07.10.2026'
П = u'https://okoteam.top'

материалы = u''.join([
    ряд(u'Боевой сайт', u'<a href="https://clusterspace.ru/">clusterspace.ru</a>',
        u'то, что видит арендатор'),
    ряд(u'Демо-копия сайта', u'<a href="%s/klaster/">okoteam.top/klaster</a>' % П,
        u'для согласований и правок, счётчик на копии отключён'),
    ряд(u'Панель проекта', u'<a href="%s/klient/klaster/?k=Oko2026">okoteam.top/klient/klaster</a>' % П,
        u'пакеты сдачи по дням и отчёты по конкурентам в одном месте'),
    ряд(u'Контент-пакет', u'<a href="%s/klaster-kontent/">okoteam.top/klaster-kontent</a>' % П,
        u'56 единиц: посты, карусели, обложки, готовый ролик'),
    ряд(u'Разведка конкурентов', u'<a href="%s/razvedka-klaster-2026-09-22/">сводка 22.09</a> и '
        u'<a href="%s/klaster-kontent/razvedka-2026-09-05.html">сводка 05.09</a>' % (П, П),
        u'кто и чем берёт арендатора, что из этого берём себе'),
    ряд(u'Презентация объекта', u'<a href="%s/klaster/assets/files/klaster-presentation.pdf">PDF, 8,6 МБ</a>' % П),
    ряд(u'Бренд-пак', u'<a href="%s/klaster/assets/brand/klaster-brand-pack.zip">архив, 3,9 МБ</a>' % П,
        u'логотип во всех форматах и размерах, вектор, обзорный лист'),
    ряд(u'Видео для сайта', u'<a href="%s/klaster/assets/video/live_hero.mp4">шесть роликов</a>' % П,
        u'фасад, ворота, цех, переговорная, конференция, главный кадр'),
    ряд(u'Фотографии и рендеры', u'169 файлов в демо-копии сайта',
        u'каталог <code>/klaster/assets/img/</code>, оттуда же берёт боевой сайт'),
])

ДНИ = [(u'6 сентября', u'den_2026-09-06_2c084d48c2dc130c45231193'),
       (u'10 сентября', u'den_2026-09-10_aef83e3ad1c70c47539db2d5'),
       (u'27 сентября', u'den_2026-09-27_a1ab488d07f753232202345c'),
       (u'30 сентября', u'den_2026-09-30_1ef41b20f7e040721a0455f3'),
       (u'3 октября', u'den_2026-10-03_f152d2ba0a4296862d433a0d'),
       (u'4 октября', u'den_2026-10-04_9bffeb721716c0eff8b8119c'),
       (u'5 октября', u'den_2026-10-05_55db7b68d2701b461f2b2bba'),
       (u'6 октября', u'den_2026-10-06_2a6d93a68c107aed90ba401a')]
дни = u'<div style="margin-top:10px;display:flex;flex-wrap:wrap;gap:8px">' + u''.join(
    u'<a href="%s/klient/klaster/%s.html" style="background:#fff;border:1px solid #E6D9A8;'
    u'border-radius:5px;padding:6px 11px;text-decoration:none;font-size:13.5px">%s</a>' % (П, ф, н)
    for н, ф in ДНИ) + u'</div>'

контакты = u''.join([
    ряд(u'Исполнитель', u'Ильясов Даниэль Альбертович, OKO TEAM'),
    ряд(u'Телефон', u'<a href="tel:+79779955566">+7 977 995-55-66</a>'),
    ряд(u'Почта', u'<a href="mailto:okoteam.top@gmail.com">okoteam.top@gmail.com</a>'),
    ряд(u'Telegram', u'@ktodaniel'),
    ряд(u'Сайт', u'<a href="https://okoteam.top/">okoteam.top</a>'),
])

итог = HTML % {'стиль': СТИЛЬ, 'знак': знak, 'сайт': сайт, 'инфра': инфра,
               'dostupy': dostupy, 'контакты': контакты, 'материалы': материалы,
               'дни': дни, 'дата': ДАТА}
io.open(ВЫХОД, 'w', encoding='utf-8').write(итог)
print(u'собрано, символов %d, килобайт %.1f' % (len(итог), len(итог.encode('utf-8'))/1024.0))
