"""Страница админ-панели AMBERRY: разметка, стиль и поведение.

Один самодостаточный файл на браузер — ни одной внешней ссылки. Панель
стоит за паролем и туннелем; тянуть с чужих сайтов шрифты и библиотеки
значило бы сообщать им адрес панели и время каждого захода владельца.

Графики нарисованы SVG прямо в браузере, без библиотек: столбики и
ломаная по десятку точек — это двадцать строк кода, а любая готовая
библиотека весит сотни килобайт и живёт на CDN.

Цвета и шрифт — бренда: чёрный, неон #FF0A8C. Эмодзи в разметке нет,
значки нарисованы SVG — правило владельца.

Разделы:

    Сводка      плитки и графики: люди, деньги, работы, визиты
    Люди        таблица с поиском, блокировка и удаление
    Оплаты      кто и когда платил
    Работы      что считалось, чем кончилось
    Поддержка   переписка с людьми и ответ прямо отсюда
    Рассылка    письмо всем или части, с ходом отправки
    Услуги      ступени оплаты и цены видов работ, можно спрятать
    Каталог     прежняя страница кнопок, целиком
    Реклама     каналы для закупки: аудит аудитории, контакты, цена, план

Данные страница берёт у `/api/*` (см. `admin.py`), ничего не считает
сама и ничего не хранит между заходами.
"""


def страница(знак_data_uri=""):
    знак = (f'<img class="знак" src="{знак_data_uri}" alt="">'
            if знак_data_uri else "")
    return ШАБЛОН.replace("{{ЗНАК}}", знак)


ШАБЛОН = r"""<!doctype html>
<html lang="ru"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="robots" content="noindex,nofollow">
<title>AMBERRY — панель</title>
<style>
:root{
  --неон:#FF0A8C; --неон2:#7A2BFF;
  --фон:#07060A; --карта:#121016; --край:#241F2C;
  --текст:#F3EFF7; --тихо:#9A93A8; --зелёный:#31D07A; --красный:#FF4D5E;
}
*{box-sizing:border-box}
html,body{margin:0;padding:0;background:var(--фон);color:var(--текст);
  font:15px/1.45 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;
  -webkit-text-size-adjust:100%}

/* ЖИВОЙ ФОН. Два размытых пятна неона, медленно плывущие по экрану.
   Дёшево (две точки градиента, без canvas и без скриптов) и не мешает
   читать цифры: всё, что выше, лежит на непрозрачных карточках. */
.фон{position:fixed;inset:0;z-index:0;overflow:hidden;pointer-events:none}
.пятно{position:absolute;width:60vmax;height:60vmax;border-radius:50%;
  filter:blur(90px);opacity:.30}
.пятно.а{background:radial-gradient(circle,var(--неон),transparent 65%);
  animation:плыть1 34s ease-in-out infinite}
.пятно.б{background:radial-gradient(circle,var(--неон2),transparent 65%);
  animation:плыть2 44s ease-in-out infinite}
@keyframes плыть1{
  0%{transform:translate(-18vw,-14vh)}
  50%{transform:translate(42vw,26vh)}
  100%{transform:translate(-18vw,-14vh)}}
@keyframes плыть2{
  0%{transform:translate(58vw,8vh)}
  50%{transform:translate(-6vw,52vh)}
  100%{transform:translate(58vw,8vh)}}
@media (prefers-reduced-motion:reduce){.пятно{animation:none}}

.верх{position:sticky;top:0;z-index:30;display:flex;align-items:center;
  gap:12px;padding:12px 16px;padding-top:calc(12px + env(safe-area-inset-top));
  background:rgba(7,6,10,.86);backdrop-filter:blur(14px);
  border-bottom:1px solid var(--край)}
.знак{width:26px;height:26px;border-radius:7px;display:block}
.имя{font-weight:800;letter-spacing:.14em;font-size:14px}
.раздел_имя{color:var(--тихо);font-size:13px;margin-left:auto}

.бургер{width:40px;height:34px;border:1px solid var(--край);border-radius:10px;
  background:var(--карта);display:grid;place-items:center;cursor:pointer;flex:none}
.бургер span,.бургер span::before,.бургер span::after{
  content:"";display:block;width:16px;height:2px;background:var(--текст);
  border-radius:2px;transition:transform .22s ease,opacity .22s ease}
.бургер span::before{transform:translateY(-5px)}
.бургер span::after{transform:translateY(3px)}
body.меню_открыто .бургер span{background:transparent}
body.меню_открыто .бургер span::before{transform:rotate(45deg)}
body.меню_открыто .бургер span::after{transform:rotate(-45deg) translateY(0)}

.тень{position:fixed;inset:0;z-index:38;background:rgba(0,0,0,.6);
  opacity:0;pointer-events:none;transition:opacity .2s}
body.меню_открыто .тень{opacity:1;pointer-events:auto}
.меню{position:fixed;z-index:40;top:0;bottom:0;left:0;width:252px;
  transform:translateX(-102%);transition:transform .24s ease;
  background:#0C0A11;border-right:1px solid var(--край);
  padding:16px 12px;padding-top:calc(16px + env(safe-area-inset-top));
  display:flex;flex-direction:column;gap:4px;overflow:auto}
body.меню_открыто .меню{transform:none}
.меню a{display:flex;align-items:center;gap:10px;padding:11px 12px;
  border-radius:11px;color:var(--текст);text-decoration:none;font-weight:600}
.меню a:hover{background:#17131F}
.меню a.тут{background:linear-gradient(90deg,rgba(255,10,140,.20),transparent);
  box-shadow:inset 2px 0 0 var(--неон)}
.меню svg{width:18px;height:18px;flex:none;stroke:var(--неон);fill:none;
  stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
.меню .счёт{margin-left:auto;background:var(--неон);color:#fff;font-size:11px;
  font-weight:800;border-radius:999px;padding:1px 7px}

main{position:relative;z-index:1;padding:16px;max-width:1180px;margin:0 auto;
  padding-bottom:calc(32px + env(safe-area-inset-bottom))}
section{display:none}
section.тут{display:block;animation:въезд .22s ease}
@keyframes въезд{from{opacity:0;transform:translateY(8px)}to{opacity:1}}

h2{margin:0 0 14px;font-size:20px;letter-spacing:.01em}
h3{margin:0 0 10px;font-size:14px;color:var(--тихо);font-weight:700;
  letter-spacing:.08em;text-transform:uppercase}

.карта{background:var(--карта);border:1px solid var(--край);border-radius:16px;
  padding:16px;margin-bottom:14px}
.плитки{display:grid;gap:10px;margin-bottom:14px;
  grid-template-columns:repeat(auto-fill,minmax(150px,1fr))}
.плитка{background:var(--карта);border:1px solid var(--край);border-radius:14px;
  padding:13px 14px;position:relative;overflow:hidden}
.плитка::after{content:"";position:absolute;inset:auto 0 0 0;height:2px;
  background:linear-gradient(90deg,var(--неон),transparent)}
.плитка .цифра{font-size:25px;font-weight:800;letter-spacing:-.02em}
.плитка .подпись{color:var(--тихо);font-size:12px;margin-top:2px}
.плитка .прирост{color:var(--зелёный);font-size:12px;font-weight:700}

table{width:100%;border-collapse:collapse;font-size:14px}
th{text-align:left;color:var(--тихо);font-weight:700;font-size:12px;
  text-transform:uppercase;letter-spacing:.06em;padding:0 10px 8px}
td{padding:10px;border-top:1px solid var(--край);vertical-align:middle}
tr.заблокирован td{opacity:.45}
.обёртка{overflow-x:auto;-webkit-overflow-scrolling:touch}

input,textarea,select{width:100%;background:#0B0910;color:var(--текст);
  border:1px solid var(--край);border-radius:11px;padding:11px 13px;
  font:inherit;outline:none}
input:focus,textarea:focus,select:focus{border-color:var(--неон)}
textarea{min-height:120px;resize:vertical}
.кн{display:inline-flex;align-items:center;gap:7px;border:0;cursor:pointer;
  background:var(--неон);color:#fff;font-weight:700;font:inherit;font-weight:700;
  border-radius:11px;padding:10px 16px}
.кн.тихая{background:#1B1723;color:var(--текст);border:1px solid var(--край)}
.кн.опасная{background:#2A1016;color:var(--красный);
  border:1px solid rgba(255,77,94,.4)}
.кн:disabled{opacity:.5;cursor:default}
.ряд{display:flex;gap:10px;align-items:center;flex-wrap:wrap}

.метка{display:inline-block;font-size:11px;font-weight:800;border-radius:999px;
  padding:2px 9px;letter-spacing:.04em}
.метка.ок{background:rgba(49,208,122,.16);color:var(--зелёный)}
.метка.плохо{background:rgba(255,77,94,.16);color:var(--красный)}
.метка.тихо{background:#1B1723;color:var(--тихо)}
.рк_сетка{display:grid;gap:10px;grid-template-columns:repeat(auto-fill,minmax(300px,1fr))}
.рк{background:var(--карта);border:1px solid var(--край);border-radius:16px;padding:14px;
  display:flex;flex-direction:column;gap:9px;position:relative}
.рк.в_плане{border-color:var(--неон);box-shadow:0 0 0 1px var(--неон) inset}
.рк .шапка{display:flex;gap:10px;align-items:flex-start}
.рк .назв{font-weight:800;font-size:15px;line-height:1.25;word-break:break-word}
.рк .ник{color:var(--тихо);font-size:12px}
.рк .цифры{display:grid;grid-template-columns:repeat(3,1fr);gap:6px}
.рк .цифры div{background:#0B0910;border:1px solid var(--край);border-radius:10px;padding:7px 8px}
.рк .цифры b{display:block;font-size:15px}
.рк .цифры span{color:var(--тихо);font-size:11px}
.рк ul{margin:0;padding-left:16px;font-size:12px;line-height:1.45}
.рк li.п{color:var(--красный)} .рк li.о{color:#F5B83D} .рк li.х{color:var(--зелёный)}
.рк .цена{font-size:20px;font-weight:800}
.рк .цена small{display:block;color:var(--тихо);font-size:11px;font-weight:600}
.рк .низ{display:flex;gap:8px;flex-wrap:wrap;margin-top:auto}
.рк .низ .кн{flex:1;justify-content:center;text-decoration:none;white-space:nowrap;font-size:13px;padding:10px 12px}
.способы{display:flex;flex-direction:column;gap:6px}
.способ{display:flex;justify-content:space-between;gap:10px;align-items:center;text-decoration:none;
  color:var(--текст);background:#0B0910;border:1px solid var(--край);border-radius:10px;padding:8px 10px;font-size:13px}
.способ b{font-weight:800;word-break:break-all}
.способ span{color:var(--тихо);font-size:11px;text-align:right}
.метка.жёлтая{background:rgba(245,184,61,.16);color:#F5B83D}
.чип{border:1px solid var(--край);background:#0B0910;color:var(--текст);border-radius:999px;
  padding:7px 12px;font-size:12px;font-weight:700;cursor:pointer}
.чип.тут{border-color:var(--неон);color:var(--неон)}

/* ПУЗЫРЬ: pre-wrap только на ТЕКСТЕ, не на всём пузыре. Раньше он
   стоял на пузыре целиком, и перенос с отступом из самого шаблона
   печатались перед словами - первая строка каждого письма уезжала
   вправо. */
.пузырь{max-width:80%;padding:9px 13px;border-radius:16px;margin-bottom:6px;
  word-break:break-word;line-height:1.4}
.пузырь .т{white-space:pre-wrap}
.пузырь.он{background:#1D1827;border-bottom-left-radius:5px}
.пузырь.мы{background:linear-gradient(135deg,var(--неон),var(--неон2));
  color:#fff;margin-left:auto;border-bottom-right-radius:5px}
.пузырь.мы .когда{color:rgba(255,255,255,.72);text-align:right}
.день{text-align:center;font-size:11px;color:var(--тихо);margin:14px 0 8px;
  letter-spacing:.06em;text-transform:uppercase}

/* СПИСОК ОБРАЩЕНИЙ - карточками, а не таблицей. В таблице кнопка
   «Открыть» на телефоне вылезала за край карточки; здесь нажимается
   вся строка, и кнопка не нужна вовсе. */
.обр{display:flex;gap:12px;align-items:flex-start;padding:13px 12px;
  border-radius:14px;cursor:pointer;border:1px solid transparent;
  transition:background .15s}
.обр:hover{background:#17131F}
.обр+.обр{margin-top:4px}
.обр.ждёт{border-color:rgba(255,10,140,.35);background:rgba(255,10,140,.06)}
.обр .обр-круг{flex:none;width:40px;height:40px;border-radius:50%;
  display:grid;place-items:center;font-weight:800;font-size:15px;
  background:#231C2E;color:var(--неон)}
.обр .обр-тело{flex:1;min-width:0}
.обр .обр-верх{display:flex;justify-content:space-between;gap:8px}
.обр .обр-кто{font-weight:800;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.обр .обр-превью{color:var(--тихо);font-size:13px;margin-top:3px;
  overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.чипы{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px}
.чип{border:1px solid var(--край);border-radius:999px;padding:6px 13px;
  font-size:13px;font-weight:700;background:transparent;color:inherit;cursor:pointer}
.чип.да{background:var(--неон);border-color:var(--неон);color:#fff}

/* ДИАЛОГ: шапка, лента, поле ответа прилипает к низу. */
.шапка-д{display:flex;gap:12px;align-items:center;margin-bottom:10px}
.шапка-д .шд-тело{flex:1;min-width:0}
.факты{display:flex;gap:6px;flex-wrap:wrap;margin:6px 0 10px}
.факт{font-size:12px;padding:3px 9px;border-radius:999px;background:#1D1827}
.лента{max-height:50vh;overflow:auto;padding:4px 2px 8px}
.низ-д{position:sticky;bottom:0;background:var(--карта,#120F18);padding-top:8px}
.быстро{display:flex;gap:6px;overflow-x:auto;padding-bottom:8px;
  scrollbar-width:none}
.быстро .чип{white-space:nowrap;font-weight:600}
.когда{font-size:11px;color:var(--тихо);margin-top:3px}

.пусто{color:var(--тихо);padding:22px 0;text-align:center}
.полоса{height:7px;border-radius:999px;background:#1B1723;overflow:hidden}
.полоса i{display:block;height:100%;background:var(--неон);transition:width .3s}
iframe{width:100%;height:78vh;border:1px solid var(--край);border-radius:16px;
  background:#000}
@media(max-width:560px){
  main{padding:12px}
  .плитка .цифра{font-size:21px}
  td,th{padding:8px 6px}
}

/* НА ТЕЛЕФОНЕ ТАБЛИЦА СТАНОВИТСЯ КАРТОЧКАМИ. Владелец смотрит панель
   с телефона (это записано в правилах проекта), а таблица с кнопками
   «Заблокировать» и «Удалить» в шесть столбцов уезжает за правый край:
   кнопки видны наполовину, и жать их приходится вслепую. Заголовок
   столбца переезжает к самой ячейке — атрибутом data-л. */
@media(max-width:700px){
  table.карточками, table.карточками tbody, table.карточками tr,
  table.карточками td{display:block;width:100%}
  table.карточками tr:first-child{display:none}
  table.карточками tr{background:#17131F;border:1px solid var(--край);
    border-radius:13px;padding:10px 12px;margin-bottom:10px}
  table.карточками td{border:0;padding:4px 0;display:flex;
    justify-content:space-between;align-items:center;gap:12px}
  table.карточками td::before{content:attr(data-л);color:var(--тихо);
    font-size:12px;text-transform:uppercase;letter-spacing:.06em}
  table.карточками td:last-child{padding-top:10px}
  table.карточками td:last-child::before{content:""}
  table.карточками .ряд{width:100%}
  table.карточками .ряд .кн{flex:1;justify-content:center}
}
</style></head>
<body>
<div class="фон"><div class="пятно а"></div><div class="пятно б"></div></div>

<div class="верх">
  <button class="бургер" id="бургер" aria-label="Меню"><span></span></button>
  {{ЗНАК}}<div class="имя">AMBERRY</div>
  <div class="раздел_имя" id="где"></div>
</div>

<div class="тень" id="тень"></div>
<nav class="меню" id="меню"></nav>

<main>
  <section id="р_сводка" class="тут">
    <h2>Сводка</h2>
    <div class="плитки" id="плитки"></div>
    <h3 style="margin:4px 0 10px">Видеокарта</h3>
    <div class="плитки" id="плитки_карты"></div>
    <div class="карта"><h3>Новые люди за 30 дней</h3><div id="г_люди"></div></div>
    <div class="карта"><h3>Куплено коинов за 30 дней</h3><div id="г_деньги"></div></div>
    <div class="карта"><h3>Генерации за 30 дней</h3><div id="г_работы"></div></div>
    <div class="карта"><h3>Что нажимают чаще всего</h3><div id="г_кнопки"></div></div>
  </section>

  <section id="р_люди">
    <h2>Люди</h2>
    <div class="карта">
      <div class="ряд"><input id="поиск" placeholder="id или @имя"
        style="flex:1;min-width:180px"><button class="кн" id="искать">Найти</button></div>
    </div>
    <div class="карта обёртка"><div id="т_люди"></div></div>
  </section>

  <section id="р_оплаты"><h2>Оплаты</h2>
    <div class="карта обёртка"><div id="т_оплаты"></div></div></section>

  <section id="р_работы"><h2>Генерации</h2>
    <div class="карта обёртка"><div id="т_работы"></div></div></section>

  <section id="р_поддержка"><h2>Поддержка</h2>
    <div class="карта" id="сп_диалоги"></div>
    <div class="карта" id="сп_переписка" style="display:none"></div></section>

  <section id="р_прайс"><h2>Прайс</h2>
    <div class="карта">
      <h3>Ступени покупки коинов</h3>
      <p class="когда">Правится всё: сколько коинов, сколько рублей, цена
         у конкурента. Порядок не важен — ступени сами встают по
         возрастанию цены. Пустой список вернёт цены из кода: магазин без
         кнопки «купить» хуже старой цены.</p>
      <div id="пр_пакеты" style="margin-top:12px"></div>
      <div class="ряд" style="margin-top:10px">
        <button class="кн" id="пр_ступень">Добавить ступень</button>
        <span class="когда" id="пр_ход"></span>
      </div>
    </div>

    <div class="карта">
      <h3>Виды работ</h3>
      <p class="когда">Цена в кристаллах (12 кристаллов = 1 коин),
         название и подпись под кнопкой. «В продаже» снимает кнопку из
         бота, но цену и название оставляет: у снятого вида остаётся
         история прошлых генераций, и стёртый он уронил бы «Мои работы».
         Себестоимость считается по замеру карты и не правится.</p>
      <div id="пр_виды" style="margin-top:12px"></div>
    </div>

    <div class="карта">
      <div class="ряд" style="justify-content:space-between">
        <span class="когда" id="пр_итог"></span>
        <button class="кн тихая" id="пр_вернуть">Вернуть цены из кода</button>
      </div>
    </div>
  </section>

  <section id="р_запрет"><h2>Запрет слов</h2>
    <div class="карта">
      <h3>Примерка</h3>
      <p class="когда">Вставь фразу и посмотри, что с ней будет. Проверка
         идёт тем же кодом, что и в боте.</p>
      <div class="ряд" style="margin-top:8px">
        <input id="зап_проба" placeholder="например: school uniform, 22 years old"
               style="flex:1;min-width:220px">
        <button class="кн" id="зап_проверить">Проверить</button>
      </div>
      <div id="зап_итог" style="margin-top:10px"></div>
      <p class="когда" style="margin-top:10px">Кроме списка ниже есть одно
         правило в коде, его из панели не убрать: возраст цифрами меньше 18
         («14 лет», «14 years old», «12yo»). Оно срабатывает даже при пустом
         списке слов.</p>
    </div>

    <div class="карта">
      <h3>Запрещённые слова</h3>
      <p class="когда">Сравнение идёт ЦЕЛЫМИ СЛОВАМИ: <b>child</b> не
         поймает «childish» или «kidney». Нужно любое окончание —
         поставь звёздочку: <b>детск*</b> ловит «детское» и «детская».
         Регистр и растянутые буквы не важны. Правится как угодно:
         добавил, удалил, работает сразу.</p>
      <div class="ряд" style="margin-top:8px">
        <input id="зап_новое" placeholder="слово, оборот или корень*"
               style="flex:1;min-width:200px">
        <button class="кн" id="зап_добавить">Добавить</button>
      </div>
      <div id="зап_слова_список" style="margin-top:12px;max-height:420px;
           overflow:auto"></div>
      <div class="ряд" style="margin-top:12px;justify-content:space-between">
        <span class="когда" id="зап_ход"></span>
        <button class="кн тихая" id="зап_вернуть">Вернуть базовый список</button>
      </div>
    </div>

    <div class="карта">
      <h3>Исключения</h3>
      <p class="когда">Обороты, при которых запрет не срабатывает вовсе.
         Самый быстрый способ погасить ложную придирку, не трогая список.</p>
      <div class="ряд" style="margin-top:8px">
        <input id="зап_новое_искл" placeholder="оборот, который разрешён"
               style="flex:1;min-width:200px">
        <button class="кн" id="зап_добавить_искл">Добавить</button>
      </div>
      <div id="зап_искл_список" style="margin-top:12px"></div>
    </div>
  </section>

  <section id="р_рассылка"><h2>Рассылка</h2>
    <div class="карта">
      <h3>Новое письмо</h3>
      <div class="ряд" style="margin-bottom:10px">
        <select id="кому" style="max-width:220px">
          <option value="всем">Всем</option>
          <option value="платившим">Только платившим</option>
          <option value="без оплат">Только без оплат</option>
        </select>
        <span class="когда" id="сколько_кому"></span>
      </div>
      <textarea id="письмо" placeholder="Текст письма. Можно &lt;b&gt;жирным&lt;/b&gt;."></textarea>
      <div class="ряд" style="margin-top:10px">
        <button class="кн" id="послать">Отправить</button>
        <span class="когда" id="ход"></span>
      </div>
      <div class="полоса" style="margin-top:10px"><i id="полоса" style="width:0"></i></div>
    </div>
    <div class="карта obёртка"><h3>Прошлые рассылки</h3><div id="т_рассылки"></div></div>
  </section>

  <section id="р_услуги"><h2>Услуги</h2>
    <div class="карта"><h3>Ступени оплаты</h3><div id="т_пакеты"></div></div>
    <div class="карта"><h3>Цены видов работ</h3><div id="т_работы_цены"></div></div>
  </section>

  <section id="р_франшиза"><h2>Франшиза</h2>
    <div class="карта" id="фр_итого"></div>
    <div class="карта обёртка"><div id="т_франшиза"></div></div>
    <div class="карта"><h3>О выплатах</h3>
      <p class="когда" style="margin:0">Панель только считает, сколько
      причитается партнёру. Перевод делает владелец руками: он необратим,
      а ошибка в доле или в реквизитах не откатывается ничем. После
      перевода впишите сумму в «Выплачено».</p></div>
  </section>

  <section id="р_реклама"><h2>Реклама в каналах</h2>
    <div class="плитки" id="рк_план"></div>
    <div class="карта">
      <div class="ряд" id="рк_фильтры"></div>
      <p class="когда" id="рк_про" style="margin:10px 0 0"></p>
    </div>
    <div id="рк_список" class="рк_сетка"></div>
  </section>

  <section id="р_каталог"><h2>Каталог кнопок</h2>
    <div class="карта" style="padding:8px"><iframe src="/каталог" title="Каталог"></iframe></div>
  </section>
</main>

<script>
const $ = s => document.querySelector(s);
/* Кириллица в адресной строке живёт процентами: `#люди` браузер
   отдаёт как `#%D0%BB%D1%8E%D0%B4%D0%B8`, и сравнение с «люди» не
   сходится — панель молча оставалась на сводке. */
const хэш = () => { try { return decodeURIComponent(location.hash.slice(1)); }
                    catch(e){ return ""; } };
const эк = s => String(s==null?"":s).replace(/[&<>"]/g,
  c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const дата = t => t ? new Date(t*1000).toLocaleString("ru-RU",
  {day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"}) : "";

const РАЗДЕЛЫ = [
  ["сводка","Сводка","M3 13h4l3 7 4-16 3 9h4"],
  ["люди","Люди","M16 19v-1a4 4 0 0 0-8 0v1M12 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6"],
  ["оплаты","Оплаты","M3 7h18v10H3zM3 11h18"],
  ["работы","Генерации","M4 5h16v14H4zM8 5v14M4 9h16"],
  ["поддержка","Поддержка","M21 12a8 8 0 1 1-3-6.2L21 4v6h-6"],
  ["рассылка","Рассылка","M3 6l9 6 9-6M3 6h18v12H3z"],
  ["услуги","Услуги","M12 3v18M7 7h7a3 3 0 0 1 0 6H8a3 3 0 0 0 0 6h8"],
  ["франшиза","Франшиза","M5 20h14M7 20V9l5-5 5 5v11M10 20v-5h4v5"],
  ["каталог","Каталог","M4 5h7v14H4zM13 5h7v14h-7z"],
  ["реклама","Реклама","M3 11v2a1 1 0 0 0 1 1h2l5 4V6L6 10H4a1 1 0 0 0-1 1zM16 8a5 5 0 0 1 0 8M19 5a9 9 0 0 1 0 14"],
  ["прайс","Прайс","M7 7h.01M3 11V5a2 2 0 0 1 2-2h6l10 10-8 8L3 11z"],
  ["запрет","Запрет слов","M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18M5.6 5.6l12.8 12.8"],
];
let непрочитано = 0;

function меню(){
  $("#меню").innerHTML = РАЗДЕЛЫ.map(([к,имя,d]) =>
    `<a href="#${к}" data-к="${к}">
       <svg viewBox="0 0 24 24"><path d="${d}"/></svg>${имя}
       ${к==="поддержка"&&непрочитано?`<span class="счёт">${непрочитано}</span>`:""}
     </a>`).join("");
}

function открыть(к){
  к = РАЗДЕЛЫ.some(р => р[0]===к) ? к : "сводка";
  document.querySelectorAll("section").forEach(s => s.classList.remove("тут"));
  $("#р_"+к).classList.add("тут");
  document.querySelectorAll(".меню a").forEach(a =>
    a.classList.toggle("тут", a.dataset.к===к));
  $("#где").textContent = (РАЗДЕЛЫ.find(р=>р[0]===к)||[])[1] || "";
  document.body.classList.remove("меню_открыто");
  (ЗАГРУЗКА[к]||(()=>{}))();
}

// ---- прайс ----
let ПРАЙС = {пакеты:[], виды:[], как_в_коде:true};

function поле_прайса(знач, ключ, к, шир){
  return `<input value="${эк(знач)}" data-п="${ключ}" data-к="${к}"
            style="width:${шир||86}px">`;
}

function рисовать_прайс(){
  $("#пр_пакеты").innerHTML = `
    <div class="ряд когда" style="gap:8px;padding-bottom:6px">
      <span style="width:86px">код</span><span style="width:86px">коинов</span>
      <span style="width:86px">рублей</span><span style="width:86px">у рынка</span>
      <span style="flex:1">за коин</span></div>` +
    (ПРАЙС.пакеты||[]).map((п,i) => `
      <div class="ряд" style="gap:8px;padding:5px 0;border-bottom:1px solid var(--край)">
        ${поле_прайса(п.id,"id",i)}
        ${поле_прайса(п.coins,"coins",i)}
        ${поле_прайса(п.rub,"rub",i)}
        ${поле_прайса(п.market_rub,"market_rub",i)}
        <span class="когда" style="flex:1">${(п.rub/п.coins).toFixed(0)} ₽</span>
        <button class="кн тихая" data-снять="${i}">Удалить</button>
      </div>`).join("");

  $("#пр_виды").innerHTML = (ПРАЙС.виды||[]).map((в,i) => `
    <div style="padding:9px 0;border-bottom:1px solid var(--край)">
      <div class="ряд" style="gap:8px;flex-wrap:wrap">
        <input value="${эк(в.title)}" data-в="title" data-к="${i}"
               style="flex:1;min-width:150px">
        <input value="${эк(в.crystals)}" data-в="crystals" data-к="${i}"
               style="width:80px" title="кристаллов">
        <label class="когда" style="display:flex;align-items:center;gap:5px">
          <input type="checkbox" data-в="в_продаже" data-к="${i}"
                 ${в.в_продаже ? "checked" : ""}>в продаже</label>
      </div>
      <div class="ряд" style="gap:8px;margin-top:6px">
        <input value="${эк(в.note)}" data-в="note" data-к="${i}"
               style="flex:1;min-width:150px" placeholder="подпись под кнопкой">
      </div>
      <div class="когда" style="margin-top:5px">
        ${эк(в.key)} · ${в.coins} коин · себестоимость ${в.себестоимость_руб} ₽
        · клиенту ${в.цена_руб} ₽
        · снимков ${в.фото_нужно[0]}–${в.фото_нужно[1]}
      </div>
    </div>`).join("");

  $("#пр_вернуть").style.display = ПРАЙС.как_в_коде ? "none" : "";
  $("#пр_итог").textContent = ПРАЙС.как_в_коде
    ? "цены как в коде" : "цены правлены из админки";

  document.querySelectorAll("#пр_пакеты [data-п]").forEach(э => {
    э.onchange = () => {
      const п = ПРАЙС.пакеты[+э.dataset.к];
      п[э.dataset.п] = э.dataset.п === "id" ? э.value.trim() : +э.value;
      сохранить_прайс();
    };
  });
  document.querySelectorAll("#пр_пакеты [data-снять]").forEach(б => {
    б.onclick = () => {
      ПРАЙС.пакеты.splice(+б.dataset.снять, 1);
      сохранить_прайс();
    };
  });
  document.querySelectorAll("#пр_виды [data-в]").forEach(э => {
    э.onchange = () => {
      const в = ПРАЙС.виды[+э.dataset.к];
      в[э.dataset.в] = э.type === "checkbox" ? э.checked
                     : (э.dataset.в === "crystals" ? +э.value : э.value);
      сохранить_прайс();
    };
  });
}

async function сохранить_прайс(){
  $("#пр_ход").textContent = "сохраняю…";
  const виды = {};
  (ПРАЙС.виды||[]).forEach(в => {
    виды[в.key] = {title: в.title, crystals: в.crystals, note: в.note,
                   в_продаже: в.в_продаже, фото_нужно: в.фото_нужно};
  });
  ПРАЙС = await послать("/api/прайс/сохранить",
                        {пакеты: ПРАЙС.пакеты, виды});
  рисовать_прайс();
  $("#пр_ход").textContent = "";
}

$("#пр_ступень").onclick = () => {
  const п = ПРАЙС.пакеты || [];
  const пос = п[п.length-1] || {coins:5, rub:250, market_rub:359};
  п.push({id: "p" + (п.length+1), coins: пос.coins*2,
          rub: пос.rub*2, market_rub: пос.market_rub*2});
  сохранить_прайс();
};

$("#пр_вернуть").onclick = async () => {
  if (!confirm("Вернуть все цены к тем, что в коде? Твои правки пропадут.")) return;
  ПРАЙС = await послать("/api/прайс/вернуть", {});
  рисовать_прайс();
};

// ---- запрет слов ----
let ЗАП = {слова:[], исключения:[], базовые:[], как_базовые:true};

function строка_запрета(с, какие){
  return `<div class="ряд" style="justify-content:space-between;gap:8px;
            padding:7px 0;border-bottom:1px solid var(--край)">
            <span>${эк(с)}</span>
            <button class="кн тихая" data-убрать="${эк(с)}"
                    data-какие="${какие}">Удалить</button>
          </div>`;
}

function рисовать_запрет(){
  const пусто = `<p class="когда">Пусто. Запрет не работает вовсе.</p>`;
  $("#зап_слова_список").innerHTML = (ЗАП.слова||[]).length
    ? ЗАП.слова.map(с => строка_запрета(с, "слова")).join("") : пусто;
  $("#зап_искл_список").innerHTML = (ЗАП.исключения||[]).length
    ? ЗАП.исключения.map(с => строка_запрета(с, "исключения")).join("")
    : `<p class="когда">Пока пусто.</p>`;
  $("#зап_вернуть").style.display = ЗАП.как_базовые ? "none" : "";
  document.querySelectorAll("[data-убрать]").forEach(б => {
    б.onclick = () => {
      const к = б.dataset.какие;
      ЗАП[к] = ЗАП[к].filter(x => x !== б.dataset.убрать);
      сохранить_запрет();
    };
  });
}

async function сохранить_запрет(){
  $("#зап_ход").textContent = "сохраняю…";
  ЗАП = await послать("/api/запрет/сохранить",
                      {слова: ЗАП.слова, исключения: ЗАП.исключения});
  рисовать_запрет();
  $("#зап_ход").textContent = `слов ${ЗАП.слова.length}`;
  setTimeout(()=>{$("#зап_ход").textContent="";}, 3000);
}

function добавить_запрет(поле, какие){
  const з = поле.value.trim();
  if (!з) return;
  if (!ЗАП[какие].includes(з)) ЗАП[какие].push(з);
  поле.value = "";
  сохранить_запрет();
}

$("#зап_добавить").onclick = () => добавить_запрет($("#зап_новое"), "слова");
$("#зап_добавить_искл").onclick =
  () => добавить_запрет($("#зап_новое_искл"), "исключения");
$("#зап_новое").addEventListener("keydown",
  e => { if (e.key==="Enter") $("#зап_добавить").click(); });
$("#зап_новое_искл").addEventListener("keydown",
  e => { if (e.key==="Enter") $("#зап_добавить_искл").click(); });

$("#зап_вернуть").onclick = async () => {
  if (!confirm("Вернуть список слов к базовому? Твои правки в нём пропадут.")) return;
  ЗАП = await послать("/api/запрет/вернуть", {});
  рисовать_запрет();
};

$("#зап_проверить").onclick = async () => {
  const текст = $("#зап_проба").value.trim();
  if (!текст) return;
  const о = await послать("/api/запрет/проверить", {текст});
  $("#зап_итог").innerHTML = о.запрещено
    ? `<span class="метка плохо">запрещено</span> поймало слово
       <b>${эк(о.слово)}</b>`
    : `<span class="метка ок">пройдёт</span> ни одно слово не сработало`;
};

$("#бургер").onclick = () => document.body.classList.toggle("меню_открыто");
$("#тень").onclick = () => document.body.classList.remove("меню_открыто");
addEventListener("hashchange", () => открыть(хэш()));

async function взять(п){
  const о = await fetch(п, {headers:{"Accept":"application/json"}});
  if(!о.ok) throw new Error(await о.text());
  return о.json();
}
async function послать(п, тело){
  const о = await fetch(п, {method:"POST",
    headers:{"Content-Type":"application/json"}, body:JSON.stringify(тело)});
  const д = await о.json().catch(()=>({}));
  if(!о.ok) throw new Error(д.ошибка || о.status);
  return д;
}

/* ---------- графики ---------- */
/* Столбики: по одному на день. Подписей у столбиков нет нарочно —
   тридцать дат на телефоне превращаются в серую кашу; вместо них
   подпись у крайних и всплывающая у каждого. */
function столбики(куда, пары, цвет){
  const у = $(куда);
  if(!пары || !пары.length){ у.innerHTML = '<div class="пусто">Пока пусто</div>'; return; }
  const Ш=Math.max(pairsШ(пары),300), В=140, макс=Math.max(...пары.map(p=>p[1]),1);
  const ш = Ш/пары.length;
  const столб = пары.map((p,i)=>{
    const h = Math.max(2, p[1]/макс*(В-26));
    return `<rect x="${i*ш+ш*0.15}" y="${В-18-h}" width="${ш*0.7}" height="${h}"
      rx="2" fill="${цвет}"><title>${эк(p[0])}: ${p[1]}</title></rect>`;
  }).join("");
  у.innerHTML =
    `<svg viewBox="0 0 ${Ш} ${В}" width="100%" height="${В}" preserveAspectRatio="none">
       ${столб}
     </svg>
     <div class="когда" style="display:flex;justify-content:space-between">
       <span>${эк(пары[0][0])}</span><span>макс ${макс}</span>
       <span>${эк(пары[пары.length-1][0])}</span></div>`;
}
const pairsШ = п => п.length*18;

function полосы(куда, пары){
  const у = $(куда);
  if(!пары.length){ у.innerHTML='<div class="пусто">Пока пусто</div>'; return; }
  const макс = Math.max(...пары.map(p=>p.сколько),1);
  у.innerHTML = пары.map(p=>`
    <div style="margin-bottom:9px">
      <div class="ряд" style="justify-content:space-between">
        <span>${эк(p.имя)}</span><b>${p.сколько}</b></div>
      <div class="полоса"><i style="width:${p.сколько/макс*100}%"></i></div>
    </div>`).join("");
}

/* ---------- разделы ---------- */

// ---- реклама ----
let РК = {каналы:[]}, РК_ФИЛЬТР = "все", РК_СОРТ = "вердикт";
const РК_ПЛАН_КЛЮЧ = "amberry_рк_план";
function рк_план(){ try { return new Set(JSON.parse(localStorage.getItem(РК_ПЛАН_КЛЮЧ)||"[]")); }
                    catch(e){ return new Set(); } }
function рк_сохранить(н){ try { localStorage.setItem(РК_ПЛАН_КЛЮЧ, JSON.stringify([...н])); } catch(e){} }
const рк_число = n => (n||0).toLocaleString("ru-RU");
const рк_кратко = n => n>=1e6 ? (n/1e6).toFixed(1).replace(".0","")+" млн"
                   : n>=1e3 ? Math.round(n/1e3)+" тыс" : String(n||0);
function рк_биржа(к){ return (к.купить||[]).find(x=>x.вид==="биржа"&&x.принимает); }
function рк_главная(к){
  const б = рк_биржа(к);
  if (б) return {url:б.url, текст:"Купить на Telega.in"};
  const л = (к.купить||[]).find(x=>x.ник);
  return л ? {url:"https://t.me/"+л.ник, текст:"Написать @"+л.ник}
           : {url:"https://t.me/"+к.u, текст:"Открыть канал"};
}
function рк_способы(к){
  return (к.купить||[]).map(x => x.вид==="биржа"
    ? `<a class="способ" href="${эк(x.url)}" target="_blank" rel="noopener noreferrer">
         <b>Telega.in</b><span>${x.принимает?"сделка с гарантией, оплата сразу":"заявки сейчас закрыты"}</span></a>`
    : `<a class="способ" href="https://t.me/${эк(x.ник)}" target="_blank" rel="noopener noreferrer">
         <b>@${эк(x.ник)}</b><span>${эк(x.вид)}</span></a>`).join("");
}
function рисовать_рекламу(){
  const план = рк_план();
  const группы = ["все","купить сразу","в плане","живой","с оговорками","рискованный",
                  ...new Set(РК.каналы.map(к=>к.группа))];
  $("#рк_фильтры").innerHTML = группы.map(г =>
    `<button class="чип ${г===РК_ФИЛЬТР?"тут":""}" data-рк-ф="${эк(г)}">${эк(г)}</button>`).join("") +
    `<select id="рк_сорт" style="width:auto;margin-left:auto">
       ${[["вердикт","сначала живые"],["охват","по охвату"],["цена","дешевле"],["err","по вовлечённости"],["выгода","дешёвый просмотр"]]
         .map(([к,и])=>`<option value="${к}" ${к===РК_СОРТ?"selected":""}>${и}</option>`).join("")}
     </select>`;
  $("#рк_про").innerHTML = `Собрано ${эк(РК.собрано)} по публичным лентам каналов и рейтингам TGStat.
    Цена с пометкой «Telega.in» - настоящая цена биржи, там можно оплатить сразу со сделкой-гарантией.
    Остальные - <b>оценка</b> по рыночной цене за тысячу просмотров, точную называет админ.
    Переходы - 1% от охвата поста, осторожно. Отметьте каналы - внизу сложится план закупки.`;
  const пор = {"живой":0,"с оговорками":1,"рискованный":2};
  let сп = РК.каналы.filter(к => РК_ФИЛЬТР==="все" ? true
          : РК_ФИЛЬТР==="в плане" ? план.has(к.u)
          : РК_ФИЛЬТР==="купить сразу" ? !!рк_биржа(к)
          : (к.вердикт===РК_ФИЛЬТР || к.группа===РК_ФИЛЬТР));
  const сорт = {вердикт:(а,б)=>пор[а.вердикт]-пор[б.вердикт]||б.охват-а.охват,
                охват:(а,б)=>б.охват-а.охват, цена:(а,б)=>а.цена-б.цена,
                err:(а,б)=>б.err-а.err,
                выгода:(а,б)=>а.цена/Math.max(а.охват,1)-б.цена/Math.max(б.охват,1)};
  сп.sort(сорт[РК_СОРТ]);
  $("#рк_список").innerHTML = сп.map(к => {
    const м = к.вердикт==="живой"?"ок":к.вердикт==="рискованный"?"плохо":"жёлтая";
    const пункты = [...к.плохо.map(т=>`<li class="п">${эк(т)}</li>`),
                    ...к.так_себе.map(т=>`<li class="о">${эк(т)}</li>`),
                    ...к.хорошо.map(т=>`<li class="х">${эк(т)}</li>`)].join("");
    const в = план.has(к.u);
    return `<div class="рк ${в?"в_плане":""}">
      <div class="шапка"><div style="flex:1">
        <div class="назв">${эк(к.название)}</div>
        <div class="ник">@${эк(к.u)} · ${эк(к.группа)}</div></div>
        <span class="метка ${м}">${эк(к.вердикт)}</span></div>
      <div class="цифры">
        <div><b>${рк_кратко(к.подписчиков)}</b><span>подписчиков</span></div>
        <div><b>${рк_кратко(к.охват)}</b><span>охват поста</span></div>
        <div><b>${к.err}%</b><span>ERR</span></div></div>
      <ul>${пункты}</ul>
      <div class="цена">${к.цена_откуда.startsWith("цена Telega")?"":"≈ "}${рк_число(к.цена)} ₽<small>${эк(к.цена_откуда)} · ~${рк_число(к.переходов)} переходов</small></div>
      <div class="способы">${рк_способы(к)}</div>
      <div class="низ">
        <a class="кн тихая" href="https://t.me/${эк(к.u)}" target="_blank" rel="noopener noreferrer">Открыть канал</a>
        <a class="кн" href="${эк(рк_главная(к).url)}" target="_blank" rel="noopener noreferrer">${эк(рк_главная(к).текст)}</a>
        <button class="кн тихая" data-рк-план="${эк(к.u)}" style="flex:0 0 auto">${в?"Убрать":"В план"}</button>
      </div></div>`;
  }).join("") || `<div class="карта когда">Нет каналов под этот фильтр</div>`;
  const выбр = РК.каналы.filter(к=>план.has(к.u));
  const сумма = выбр.reduce((с,к)=>с+к.цена,0), охв = выбр.reduce((с,к)=>с+к.охват,0),
        пер = выбр.reduce((с,к)=>с+к.переходов,0);
  $("#рк_план").innerHTML = [
    ["Каналов в плане", выбр.length, "из "+РК.каналы.length],
    ["Бюджет, ≈ ₽", рк_число(сумма), ""],
    ["Охват, просмотров", рк_кратко(охв), ""],
    ["Переходов в бота, ≈", рк_число(пер), пер?"≈ "+Math.round(сумма/пер)+" ₽ за переход":""],
  ].map(([п,ц,д])=>`<div class="плитка"><div class="цифра">${ц}</div>
     <div class="подпись">${п}</div><div class="прирост">${д}</div></div>`).join("");
}
document.addEventListener("click", е => {
  const ф = е.target.closest("[data-рк-ф]");
  if (ф){ РК_ФИЛЬТР = ф.getAttribute("data-рк-ф"); рисовать_рекламу(); return; }
  const п = е.target.closest("[data-рк-план]");
  if (п){ const н = рк_план(), u = п.getAttribute("data-рк-план");
          н.has(u) ? н.delete(u) : н.add(u); рк_сохранить(н); рисовать_рекламу(); }
});
document.addEventListener("change", е => {
  if (е.target.id==="рк_сорт"){ РК_СОРТ = е.target.value; рисовать_рекламу(); }
});

// ---- видеокарта: остаток на Vast ----
async function карта_плитки(){
  const к = await взять("/api/карта");
  if (!к || к.остаток==null){
    $("#плитки_карты").innerHTML = `<div class="плитка"><div class="подпись">Сторож баланса ещё не отчитался</div></div>`;
    return;
  }
  const ч = к.часов, тревога = ч!=null && ч < 24;
  const срок = ч==null ? "машина не запущена" : ч >= 48 ? Math.floor(ч/24)+" сут" : Math.round(ч)+" ч";
  const пл = [
    ["Остаток на Vast", "$"+к.остаток.toFixed(2), тревога?"пополнить срочно":""],
    ["Хватит на", срок, "при $"+(к.в_сутки||0).toFixed(1)+" в сутки"],
    ["Расход за сутки", "$"+(к.за_сутки||0).toFixed(2), ""],
    ["Расход за месяц", "$"+(к.за_месяц||0).toFixed(2), "по падению остатка"],
  ];
  $("#плитки_карты").innerHTML = пл.map(([п,ц,пр],i)=>`
    <div class="плитка"${i<2&&тревога?' style="border-color:var(--красный)"':""}><div class="цифра">${ц}</div>
      <div class="подпись">${п}</div>
      ${пр?`<div class="прирост"${i===0&&тревога?' style="color:var(--красный)"':""}>${пр}</div>`:""}</div>`).join("");
}

const ЗАГРУЗКА = {
  async реклама(){
    РК = await взять("/api/реклама");
    рисовать_рекламу();
  },
  async прайс(){
    ПРАЙС = await взять("/api/прайс");
    рисовать_прайс();
  },
  async запрет(){
    ЗАП = await взять("/api/запрет");
    рисовать_запрет();
  },
  async сводка(){
    const д = await взять("/api/сводка");
    непрочитано = д.поддержка_новых; меню(); открыть_подсветить();
    const пл = [
      ["Людей", д.людей, д.людей_сутки ? "+"+д.людей_сутки+" за сутки" : ""],
      ["Платящих", д.платящих, ""],
      ["Куплено коинов", д.куплено, ""],
      ["Потрачено коинов", д.потрачено, ""],
      ["Генераций", д.работ, д.работ_сутки ? "+"+д.работ_сутки+" за сутки" : ""],
      ["Осечек", д.брака, ""],
      ["Писем без ответа", д.поддержка_новых, ""],
      ["Заблокированных", д.заблокированных, ""],
    ];
    $("#плитки").innerHTML = пл.map(([п,ц,пр])=>`
      <div class="плитка"><div class="цифра">${ц}</div>
        <div class="подпись">${п}</div>
        ${пр?`<div class="прирост">${пр}</div>`:""}</div>`).join("");
    столбики("#г_люди", д.новые_по_дням, "var(--неон)");
    столбики("#г_деньги", д.деньги_по_дням, "#7A2BFF");
    столбики("#г_работы", д.работы_по_дням, "#31D07A");
    полосы("#г_кнопки", д.топ_кнопок);
    карта_плитки().catch(()=>{});
  },

  async люди(){
    const д = await взять("/api/люди?поиск="+encodeURIComponent($("#поиск").value||""));
    $("#т_люди").innerHTML = д.люди.length ? `<table class="карточками">
      <tr><th>Кто</th><th>Пришёл</th><th>Баланс</th><th>Куплено</th>
          <th>Работ</th><th></th></tr>
      ${д.люди.map(ч=>`<tr class="${ч.blocked?"заблокирован":""}">
        <td data-л="Кто"><b>${ч.username?"@"+эк(ч.username):эк(ч.tg_id)}</b>
            <div class="когда">${эк(ч.tg_id)}</div></td>
        <td data-л="Пришёл">${дата(ч.created_at)}</td>
        <td data-л="Баланс">${ч.баланс}</td>
        <td data-л="Куплено">${ч.куплено}</td>
        <td data-л="Работ">${ч.работ}</td>
        <td><div class="ряд">
          <input data-сколько="${ч.tg_id}" inputmode="numeric"
            placeholder="коинов" style="max-width:88px">
          <button class="кн" data-начислить="${ч.tg_id}">Начислить</button>
          <button class="кн тихая" data-блок="${ч.tg_id}" data-как="${ч.blocked?0:1}">
            ${ч.blocked?"Разблокировать":"Заблокировать"}</button>
          <button class="кн опасная" data-удалить="${ч.tg_id}">Удалить</button>
        </div></td></tr>`).join("")}</table>` :
      '<div class="пусто">Никого не нашлось</div>';
  },

  async оплаты(){
    const д = await взять("/api/оплаты");
    $("#т_оплаты").innerHTML = д.оплаты.length ? `<table class="карточками">
      <tr><th>Когда</th><th>Кто</th><th>Коинов</th><th>За что</th></tr>
      ${д.оплаты.map(о=>`<tr><td data-л="Когда">${дата(о.at)}</td>
        <td data-л="Кто">${о.username?"@"+эк(о.username):эк(о.tg_id)}</td>
        <td data-л="Коинов"><b>+${о.delta}</b></td>
        <td data-л="За что">${эк(о.reason)}</td></tr>`).join("")}</table>` :
      '<div class="пусто">Оплат пока нет</div>';
  },

  async работы(){
    const д = await взять("/api/работы");
    $("#т_работы").innerHTML = д.работы.length ? `<table class="карточками">
      <tr><th>Когда</th><th>Кто</th><th>Что</th><th>Коинов</th><th>Итог</th></tr>
      ${д.работы.map(р=>`<tr><td data-л="Когда">${дата(р.at)}</td>
        <td data-л="Кто">${р.username?"@"+эк(р.username):эк(р.tg_id)}</td>
        <td data-л="Что">${эк(р.имя||р.kind)}</td>
        <td data-л="Коинов">${р.coins}</td>
        <td data-л="Итог"><span class="метка ${р.state==="ok"?"ок":(р.state==="err"?"плохо":"тихо")}">
          ${р.state==="ok"?"готово":(р.state==="err"?"осечка":"считает")}</span>
          ${р.error?`<div class="когда">${эк(р.error).slice(0,80)}</div>`:""}</td>
        </tr>`).join("")}</table>` :
      '<div class="пусто">Генераций пока нет</div>';
  },

  async поддержка(){
    clearInterval(обновлять_диалог); открыт_диалог = null;
    $("#сп_переписка").style.display = "none";
    $("#сп_диалоги").style.display = "";
    const д = await взять("/api/поддержка");
    непрочитано = д.диалоги.filter(x=>x.ждёт).length; меню(); открыть_подсветить();
    const ждут = д.диалоги.filter(x=>x.ждёт);
    // Фильтр по умолчанию - «Ждут ответа»: это и есть работа на сегодня.
    // Все переписки подряд нужны реже, их держим одним нажатием дальше.
    const список = фильтр_подд==="ждут" ? ждут : д.диалоги;
    $("#сп_диалоги").innerHTML = `
      <div class="чипы">
        <button class="чип ${фильтр_подд==="ждут"?"да":""}" data-фильтр="ждут">
          Ждут ответа · ${ждут.length}</button>
        <button class="чип ${фильтр_подд==="все"?"да":""}" data-фильтр="все">
          Все · ${д.диалоги.length}</button>
      </div>` + (список.length ? список.map(р=>`
      <div class="обр ${р.ждёт?"ждёт":""}" data-диалог="${р.tg_id}">
        <div class="обр-круг">${эк(((р.username||"?")[0]||"?").toUpperCase())}</div>
        <div class="обр-тело">
          <div class="обр-верх"><span class="обр-кто">${р.username?"@"+эк(р.username):эк(р.tg_id)}</span>
            <span class="когда" style="margin:0">${дата(р.at)}</span></div>
          <div class="обр-превью">${р.последний==="мы"?"Вы: ":""}${эк(р.последнее)}</div>
          <div class="ряд" style="gap:6px;margin-top:6px">
            ${р.ждёт?'<span class="метка плохо">ждёт ответа</span>'
              : р.закрыто?'<span class="метка тихо">закрыто</span>'
              : '<span class="метка ок">отвечено</span>'}
            <span class="метка тихо">${р.всего} писем</span></div>
        </div></div>`).join("")
      : `<div class="пусто">${фильтр_подд==="ждут"
            ? "Все ответы даны" : "Писем пока не было"}</div>`);
  },

  async рассылка(){
    const д = await взять("/api/рассылки");
    $("#т_рассылки").innerHTML = д.рассылки.length ? `<table>
      <tr><th>Когда</th><th>Кому</th><th>Дошло</th><th>Отказ</th><th>Итог</th></tr>
      ${д.рассылки.map(р=>`<tr><td>${дата(р.at)}</td><td>${эк(р.кому)}</td>
        <td>${р.дошло} из ${р.всего}</td><td>${р.отказ}</td>
        <td><span class="метка ${р.состояние==="готова"?"ок":"тихо"}">
          ${эк(р.состояние)}</span></td></tr>`).join("")}</table>` :
      '<div class="пусто">Рассылок ещё не было</div>';
    ход();
  },

  async услуги(){
    const д = await взять("/api/услуги");
    $("#т_пакеты").innerHTML = `<div class="обёртка"><table class="карточками">
      <tr><th>Ступень</th><th>Коинов</th><th>Рублей</th><th>За коин</th>
          <th>Скидка</th><th></th></tr>
      ${д.пакеты.map(п=>`<tr class="${п.скрыт?"заблокирован":""}">
        <td data-л="Ступень">${эк(п.ид)}</td>
        <td data-л="Коинов">${п.коинов}</td>
        <td data-л="Рублей">${п.рублей} ₽</td>
        <td data-л="За коин">${п.за_коин} ₽</td>
        <td data-л="Скидка">${п.скидка}%</td>
        <td><button class="кн тихая" data-пакет="${п.ид}" data-как="${п.скрыт?0:1}">
          ${п.скрыт?"Вернуть":"Убрать"}</button></td></tr>`).join("")}
      </table></div>`;
    $("#т_работы_цены").innerHTML = `<div class="обёртка"><table>
      <tr><th>Вид работы</th><th>Коинов</th></tr>
      ${д.работы.map(р=>`<tr><td>${эк(р.имя)}</td><td>${р.коинов}</td></tr>`).join("")}
      </table></div>`;
  },

  async франшиза(){
    const д = await взять("/api/франшиза");
    $("#фр_итого").innerHTML = `
      <div class="плитки" style="margin:0">
        <div class="плитка"><div class="цифра">${д.партнёры.length}</div>
          <div class="подпись">Партнёров</div></div>
        <div class="плитка"><div class="цифра">${д.к_выплате_всего}</div>
          <div class="подпись">К выплате, ₽</div></div>
        <div class="плитка"><div class="цифра">${д.выручка_копий} ₽</div>
          <div class="подпись">Заработали копии</div></div>
        <div class="плитка"><div class="цифра">${д.цена_руб} ₽</div>
          <div class="подпись">Цена франшизы</div></div>
      </div>`;
    $("#т_франшиза").innerHTML = д.партнёры.length ? `<table class="карточками">
      <tr><th>Кто</th><th>Бот</th><th>Работает</th><th>Состояние</th>
          <th>Выручка</th>
          <th>Доля</th><th>Выплачено</th><th>К выплате</th><th></th></tr>
      ${д.партнёры.map(п=>`<tr>
        <td data-л="Кто"><b>${п.username?"@"+эк(п.username):эк(п.tg_id)}</b>
          <div class="когда">${эк(п.tg_id)}</div></td>
        <td data-л="Бот">${эк(п.бот||"-")}
          ${п.есть_токен?`<div class="когда">токен ${эк(п.токен_хвост)}
            <button class="кн тихая" style="padding:2px 8px;font-size:11px"
              data-токен="${п.tg_id}">показать</button></div>`:""}</td>
        <td data-л="Работает">${п.есть_токен?`
          <button class="кн ${п.жив?"":"тихая"}" data-рубильник="${п.tg_id}"
            data-включить="${п.жив?0:1}">${п.жив?"Выключить":"Включить"}</button>
          <div class="когда">${п.жив?"копия отвечает":"копия погашена"}<br>
            ${п.клиентов} клиентов · ${п.выручка_копии} ₽</div>
          `:'<span class="когда">нет токена</span>'}</td>
        <td data-л="Состояние"><select data-сост="${п.tg_id}"
            style="max-width:150px">
          ${["ждёт токен","в работе","запущен","остановлен"].map(с=>
            `<option${с===п.состояние?" selected":""}>${с}</option>`).join("")}
        </select></td>
        <td data-л="Выручка"><div class="когда">бот насчитал
          ${п.выручка_копии} ₽</div>
          <input data-поле="выручка" data-кто="${п.tg_id}"
          value="${п.выручка}" inputmode="numeric" style="max-width:110px"></td>
        <td data-л="Доля"><input data-поле="доля" data-кто="${п.tg_id}"
          value="${п.доля}" inputmode="numeric" style="max-width:80px"></td>
        <td data-л="Выплачено"><input data-поле="выплачено" data-кто="${п.tg_id}"
          value="${п.выплачено}" inputmode="numeric" style="max-width:110px"></td>
        <td data-л="К выплате"><b>${п.к_выплате}</b></td>
        <td><button class="кн" data-учёт="${п.tg_id}">Записать</button></td>
      </tr>`).join("")}</table>` :
      '<div class="пусто">Франшизу ещё никто не купил</div>';
  },

  каталог(){},
};

function открыть_подсветить(){
  const к = хэш() || "сводка";
  document.querySelectorAll(".меню a").forEach(a =>
    a.classList.toggle("тут", a.dataset.к===к));
}

/* ---------- действия ---------- */
document.addEventListener("click", async e => {
  // Карточка обращения - не кнопка, а строка целиком: на телефоне в
  // неё попадают пальцем, а не целятся в маленькое «Открыть».
  const обр = e.target.closest(".обр[data-диалог]");
  if(обр && !e.target.closest("button")){
    открыть_диалог(+обр.dataset.диалог).catch(ош=>alert("Не вышло: "+ош.message));
    return;
  }
  const б = e.target.closest("button");
  if(!б) return;
  try{
    if(б.dataset.блок){
      await послать("/api/человек/блок",
        {tg_id:+б.dataset.блок, блок: б.dataset.как==="1"});
      ЗАГРУЗКА.люди();
    } else if(б.dataset.удалить){
      if(!confirm("Удалить человека и всю его историю? Это не отменить."))
        return;
      await послать("/api/человек/удалить", {tg_id:+б.dataset.удалить});
      ЗАГРУЗКА.люди();
    } else if(б.dataset.диалог){
      открыть_диалог(+б.dataset.диалог);
    } else if(б.dataset.токен){
      const д = await взять("/api/франшиза/токен/"+б.dataset.токен);
      prompt("Токен бота партнёра (скопируйте и закройте):", д.токен||"");
    } else if(б.dataset["начислить"]){
      const кто = б.dataset["начислить"];
      const поле = document.querySelector(`input[data-сколько="${кто}"]`);
      const сколько = +(поле && поле.value) || 0;
      if(!сколько){ alert("Сколько коинов начислить?"); return; }
      // Спрашиваем подтверждение: коины начисляются мгновенно и
      // списать их обратно эта кнопка не умеет.
      if(!confirm(`Начислить ${сколько} коинов? Отменить будет нельзя.`))
        return;
      const почему = prompt("За что? (запишется в журнал)",
                            "подарок от владельца") || "";
      try{
        const о = await послать("/api/человек/начислить",
          {tg_id:+кто, сколько, почему});
        if(поле) поле.value = "";
        alert("Начислено. Баланс теперь: " + о.баланс);
      }catch(ош){ alert("Не вышло: "+ош.message); }
      ЗАГРУЗКА.люди();
    } else if(б.dataset["рубильник"]){
      const вкл = б.dataset["включить"]==="1";
      // Спрашиваем только на ВЫКЛЮЧЕНИЕ: у партнёра в этот момент
      // могут идти чужие генерации, и промах по кнопке гасит боевого
      // бота. Включение безвредно, его подтверждать незачем.
      if(!вкл && !confirm("Выключить бота партнёра? Его клиенты перестанут "+
                          "получать ответы. Данные останутся на месте."))
        return;
      б.disabled = true; б.textContent = вкл ? "Поднимаю…" : "Гашу…";
      try{
        await послать("/api/франшиза/рубильник",
          {tg_id:+б.dataset["рубильник"], включить:вкл});
      }catch(ош){ alert("Не вышло: "+ош.message); }
      ЗАГРУЗКА.франшиза();
    } else if(б.dataset["учёт"]){
      const кто = б.dataset["учёт"];
      const поле = и => {
        const э = document.querySelector(
          `input[data-кто="${кто}"][data-поле="${и}"]`);
        return э ? +э.value || 0 : undefined;
      };
      await послать("/api/франшиза/учёт", {tg_id:+кто,
        выручка:поле("выручка"), доля:поле("доля"),
        выплачено:поле("выплачено")});
      ЗАГРУЗКА.франшиза();
    } else if(б.dataset.пакет){
      await послать("/api/услуги/спрятать",
        {ид:б.dataset.пакет, скрыт: б.dataset.как==="1"});
      ЗАГРУЗКА.услуги();
    } else if(б.id==="искать"){
      ЗАГРУЗКА.люди();
    } else if(б.id==="послать"){
      const т = $("#письмо").value.trim();
      if(!т) return;
      if(!confirm("Отправить письмо? Отменить будет нельзя.")) return;
      б.disabled = true;
      await послать("/api/рассылка", {текст:т, кому:$("#кому").value});
      $("#письмо").value = "";
      ход();
    } else if(б.dataset.фильтр){
      фильтр_подд = б.dataset.фильтр; ЗАГРУЗКА.поддержка();
    } else if(б.dataset.быстро){
      const поле = $("#ответ");
      if(поле){ поле.value = (поле.value ? поле.value.trimEnd()+"\n\n" : "")
        + БЫСТРО[+б.dataset.быстро]; поле.focus(); }
    } else if(б.id==="закрыть_обр"){
      await послать("/api/поддержка/закрыть", {tg_id:+б.dataset.кому});
      ЗАГРУЗКА.поддержка();
    } else if(б.id==="назад_к_списку"){
      ЗАГРУЗКА.поддержка();
    } else if(б.id==="ответить"){
      const т = $("#ответ").value.trim();
      if(!т) return;
      б.disabled = true;
      const д = await послать("/api/поддержка/ответ",
        {tg_id:+б.dataset.кому, текст:т});
      б.disabled = false;
      if(!д.ушло){ alert("Телеграм не принял: "+(д.почему||"")); return; }
      $("#ответ").value = "";
      открыть_диалог(+б.dataset.кому);
    }
  }catch(ош){ alert("Не вышло: "+ош.message); б.disabled = false; }
});

// БЫСТРЫЕ ОТВЕТЫ. Самые частые реплики поддержки одним нажатием - в
// поле, а не сразу клиенту: шаблон почти всегда надо дописать под
// человека, и отправка без правки выглядит как ответ робота.
const БЫСТРО = [
  "Уточни, пожалуйста: что делал, какой раздел и примерно во сколько.",
  "Проверили - коины за неудачную генерацию вернулись на баланс.",
  "Оплата дошла, коины зачислены. Обнови меню - /start.",
  "Смотрим, ответим здесь же в течение часа.",
  "Попробуй другое фото: лицо целиком, без масок и сильных фильтров.",
];

let фильтр_подд = "ждут", открыт_диалог = null, обновлять_диалог = null;
let видно_писем = 0;

function день(ts){
  return new Date(ts*1000).toLocaleDateString("ru-RU",
    {day:"numeric", month:"long"});
}

async function открыть_диалог(id, тихо){
  const д = await взять("/api/поддержка/"+id);
  // Автообновление перерисовывает только если пришло новое - иначе
  // поле ответа сбрасывалось бы под пальцами каждые десять секунд.
  if(тихо && д.письма.length === видно_писем) return;
  const черновик = тихо && $("#ответ") ? $("#ответ").value : "";
  видно_писем = д.письма.length;
  открыт_диалог = id;
  $("#сп_диалоги").style.display = "none";
  const о = $("#сп_переписка");
  о.style.display = "";
  let был = "";
  const лента = д.письма.map(п=>{
    const дн = день(п.at);
    const раздел = дн!==был ? `<div class="день">${дн}</div>` : "";
    был = дн;
    return раздел + `<div class="пузырь ${п.откого==="мы"?"мы":"он"}"><div class="т">${эк(п.текст)}</div><div class="когда">${new Date(п.at*1000).toLocaleTimeString("ru-RU",{hour:"2-digit",minute:"2-digit"})}</div></div>`;
  }).join("");
  о.innerHTML = `
    <div class="шапка-д">
      <button class="кн тихая" id="назад_к_списку" aria-label="К списку">←</button>
      <div class="кружок" style="width:40px;height:40px;border-radius:50%;
        display:grid;place-items:center;font-weight:800;background:#231C2E;
        color:var(--неон)">${эк(((д.username||"?")[0]||"?").toUpperCase())}</div>
      <div class="шд-тело"><b>${д.username?"@"+эк(д.username):"без ника"}</b>
        <div class="когда" style="margin:0">${эк(id)}</div></div>
      <button class="кн тихая" id="закрыть_обр" data-кому="${id}">Закрыть</button>
    </div>
    <div class="факты">
      <span class="факт">Баланс ${д.баланс}</span>
      <span class="факт">Куплено ${д.куплено}</span>
      <span class="факт">Работ ${д.работ}</span>
      ${д.осечек?`<span class="факт" style="color:var(--красный)">Осечек ${д.осечек}</span>`:""}
      ${д.с?`<span class="факт">С ${дата(д.с)}</span>`:""}
    </div>
    <div class="лента">${лента || '<div class="пусто">Писем нет</div>'}</div>
    <div class="низ-д">
      <div class="быстро">${БЫСТРО.map((т,н)=>
        `<button class="чип" data-быстро="${н}">${эк(т.length>34?т.slice(0,32)+"…":т)}</button>`).join("")}</div>
      <textarea id="ответ" placeholder="Ответ уйдёт от имени бота. Ctrl+Enter - отправить"
        style="min-height:84px">${эк(черновик)}</textarea>
      <div class="ряд" style="margin-top:8px;justify-content:space-between">
        <span class="когда" style="margin:0">Клиент не увидит ни имени, ни ника</span>
        <button class="кн" id="ответить" data-кому="${id}">Отправить</button></div>
    </div>`;
  o_прокрутить(о);
  clearInterval(обновлять_диалог);
  обновлять_диалог = setInterval(()=>{
    if(открыт_диалог===id && document.visibilityState==="visible")
      открыть_диалог(id, true).catch(()=>{});
  }, 10000);
}
function o_прокрутить(о){
  const л = о.querySelector(".лента");
  if(л) л.scrollTop = л.scrollHeight;
}
document.addEventListener("keydown", e=>{
  if(e.target && e.target.id==="ответ" && e.key==="Enter" && (e.ctrlKey||e.metaKey)){
    e.preventDefault(); const б=$("#ответить"); if(б) б.click();
  }
});

/* Ход рассылки опрашивается раз в две секунды и только пока она идёт:
   полоса, которая дёргается на пустом месте, читается как поломка. */
let таймер = null;
async function ход(){
  clearTimeout(таймер);
  const д = await взять("/api/рассылка/ход");
  const с = д.ход;
  if(с.ид){
    const всё = с.дошло + с.отказ;
    $("#ход").textContent = `идёт: ${всё} из ${с.всего}, отказов ${с.отказ}`;
    $("#полоса").style.width = (с.всего ? всё/с.всего*100 : 0) + "%";
    $("#послать").disabled = true;
    таймер = setTimeout(ход, 2000);
  } else {
    $("#ход").textContent = "";
    $("#полоса").style.width = "0";
    $("#послать").disabled = false;
    ЗАГРУЗКА.рассылка_список && ЗАГРУЗКА.рассылка_список();
  }
}

$("#поиск").addEventListener("keydown", e => { if(e.key==="Enter") ЗАГРУЗКА.люди(); });
document.addEventListener("change", async e => {
  const с = e.target.closest("select[data-сост]");
  if(!с) return;
  try{
    await послать("/api/франшиза/состояние",
      {tg_id:+с.dataset["сост"], состояние:с.value});
    ЗАГРУЗКА.франшиза();
  }catch(ош){ alert("Не вышло: "+ош.message); }
});

$("#кому").addEventListener("change", сколько_кому);
async function сколько_кому(){
  const д = await взять("/api/рассылка/сколько?кому="+
    encodeURIComponent($("#кому").value));
  $("#сколько_кому").textContent = "адресатов: " + д.сколько;
}

меню();
открыть(хэш());
сколько_кому().catch(()=>{});
</script>
</body></html>
"""
