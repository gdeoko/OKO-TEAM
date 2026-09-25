#!/usr/bin/env python3
"""Страница каталога AMBERRY: переименовать кнопки и вписать свои строки.

## Зачем она есть

Каталог состоит из двух слоёв. Код держит то, что делает кадр рабочим —
сохранение лица, кожу, анатомию, свет, объектив, композицию, запреты,
три с лишним тысячи знаков на сценарий. Владелец держит две вещи:
как называется кнопка и что происходит в кадре.

Второй слой жил в файле на сервере и правился блокнотом по SSH. Это
работает ровно один раз. Сорок восемь сценариев, правки каждый день,
владелец читает с телефона — нужна страница.

## Что она делает и чего НЕ делает

ДЕЛАЕТ: показывает всё дерево (раздел → подраздел → вариант), даёт у
каждого варианта ДВЕ строки и одну кнопку «Сохранить». Сохранение
пишет `каталог.json`, а бот замечает изменение файла сам, в течение
секунды. Перезапускать нечего, root не нужен.

  1. Что происходит — по-русски. Видит русский клиент.
  2. То же для модели — по-английски. Видит модель, и она же
     показывается английскому клиенту.

Названия кнопок правятся по желанию, за «Переименовать»: у всех сорока
восьми они уже есть, и трогают их редко. «Убрать» прячет вариант,
подраздел или целый раздел — именно прячет, не удаляет: промпт живёт в
коде, и стёртый из браузера он бы не вернулся.

НЕ ДЕЛАЕТ: не переводит. Переводчика в схеме нет вовсе, и он не нужен:
английский текст владелец пишет в любом случае — для модели, — и он
описывает ровно то же самое, что русский. Заводить третье поле под
английскую подпись значило бы просить написать одно и то же дважды.

## Как запускается

    export AMBERRY_ADMIN_PASS=...          обязательно
    export AMBERRY_ADMIN_USER=amberry      по умолчанию
    export AMBERRY_ADMIN_PORT=8090
    python3 admin.py

Слушает 127.0.0.1. Наружу выводится туннелем с HTTPS (cloudflared) —
Basic-авторизация по открытому HTTP означала бы пароль открытым
текстом в каждом запросе.
"""

import hmac
import json
import os
import sys
import time
import base64
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import unquote

ЗДЕСЬ = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.join(ЗДЕСЬ, "..", "bot"))
sys.path.insert(0, os.path.join(ЗДЕСЬ, "..", "brand-amberry"))

import catalog          # noqa: E402
import данные           # noqa: E402
import prompts          # noqa: E402
import запрет           # noqa: E402
import pricing          # noqa: E402
import франшиза         # noqa: E402
import brand            # noqa: E402
import store as _store  # noqa: E402

import панель           # noqa: E402
import сводка           # noqa: E402

# База бота. Панель читает ту же самую, что бот пишет, — отдельной
# копии нет и быть не может: цифры в панели обязаны совпадать с тем,
# что человек видит у себя в боте секунду назад.
БАЗА = os.environ.get("ROCKET_DB", "rocket_bot.db")
store = _store.Store(БАЗА)

ПОЛЬЗОВАТЕЛЬ = os.environ.get("AMBERRY_ADMIN_USER", "amberry")
ПАРОЛЬ = os.environ.get("AMBERRY_ADMIN_PASS", "")
ПОРТ = int(os.environ.get("AMBERRY_ADMIN_PORT", "8090"))
АДРЕС = os.environ.get("AMBERRY_ADMIN_HOST", "127.0.0.1")

# Тормоз для подбора пароля. Страница стоит за туннелем с постоянным
# адресом, то есть доступна всему интернету, а пароль у неё один.
# Считаем промахи по адресу и после пятого держим паузу.
_ПРОМАХИ = {}
ПРОМАХОВ_ДО_ПАУЗЫ = 5
ПАУЗА = 2.0


def проверить_пароль(заголовок, кто):
    """Basic-авторизация. Сравнение постоянного времени — не суеверие:
    обычное `==` выходит на первом несовпавшем символе, и по времени
    ответа пароль подбирается по букве."""
    промахи = _ПРОМАХИ.get(кто, 0)
    if промахи >= ПРОМАХОВ_ДО_ПАУЗЫ:
        time.sleep(ПАУЗА)
    if not заголовок or not заголовок.startswith("Basic "):
        return False
    try:
        сырое = base64.b64decode(заголовок[6:]).decode("utf-8", "replace")
    except Exception:
        return False
    логин, _, пароль = сырое.partition(":")
    # Сравниваем БАЙТЫ. `compare_digest` на строках отказывается
    # работать, если в них есть не-ASCII, и падает TypeError — то есть
    # пароль с кириллицей или с «ё» ронял всю страницу пятисоткой
    # вместо честного «нужен пароль», и понять почему было невозможно.
    ок = (hmac.compare_digest(логин.encode(), ПОЛЬЗОВАТЕЛЬ.encode())
          and hmac.compare_digest(пароль.encode(), ПАРОЛЬ.encode()))
    if ок:
        _ПРОМАХИ.pop(кто, None)
    else:
        _ПРОМАХИ[кто] = промахи + 1
    return ок


def разобрать_правки(тело):
    """JSON из браузера -> то, что можно писать в файл.

    Ключи проверяются по каталогу. Правка приходит из браузера, и
    принимать оттуда произвольные ключи означало бы складывать в файл
    что угодно, включая имена, которые бот никогда не прочитает.
    """
    сырое = json.loads(тело.decode("utf-8"))
    if not isinstance(сырое, dict):
        raise ValueError("ожидался объект")
    известные = catalog.известные_ключи()
    чистое, чужих = {}, []
    for ключ, знач in сырое.items():
        if ключ not in известные:
            чужих.append(ключ)
            continue
        if not isinstance(знач, dict):
            continue
        чистое[ключ] = {п: str(знач.get(п) or "").strip() for п in данные.ПОЛЯ}
    return чистое, чужих


# ---------------------------------------------------------------------
# СТРАНИЦА
#
# Один файл, без внешних библиотек и шрифтов. Не из аскетизма: страница
# живёт на сервере бота за туннелем, и каждая внешняя ссылка — ещё одна
# причина, по которой она однажды не откроется с телефона в метро.
# ---------------------------------------------------------------------

СТРАНИЦА = """<!doctype html>
<html lang="ru"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="robots" content="noindex,nofollow">
<title>AMBERRY · Каталог</title>
<style>
 :root {
   --neon: {{NEON}}; --glow: {{GLOW}}; --deep: {{DEEP}}; --amber: {{AMBER}};
   --ink: {{INK}}; --line: {{LINE}}; --white: {{WHITE}}; --mute: {{MUTE}};
   --gut: 16px;
 }
 * { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
 html, body { margin: 0; padding: 0; }
 body {
   background: var(--ink); color: var(--white); min-height: 100vh;
   font: 15px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto,
         "Helvetica Neue", Arial, sans-serif;
   padding: 0 var(--gut) 140px;
 }
 header {
   position: sticky; top: 0; z-index: 20; background: var(--ink);
   padding: 14px 0 10px; border-bottom: 1px solid var(--line);
   margin: 0 calc(var(--gut) * -1); padding-left: var(--gut);
   padding-right: var(--gut);
 }
 .brand { display: flex; align-items: baseline; gap: 10px; }
 .brand b { font-size: 19px; letter-spacing: .14em; color: var(--neon); }
 .brand span { color: var(--mute); font-size: 13px; }
 .счёт { margin-top: 6px; color: var(--mute); font-size: 13px; }
 .счёт i { color: var(--amber); font-style: normal; }

 h2 {
   font-size: 12px; letter-spacing: .18em; text-transform: uppercase;
   color: var(--neon); margin: 26px 0 2px;
 }
 h2 small { display:block; text-transform:none; letter-spacing:0;
            color: var(--mute); font-size: 12px; margin-top: 4px; }
 h3 {
   font-size: 15px; margin: 18px 0 8px; color: var(--white);
   display: flex; align-items: center; gap: 8px;
 }
 h3 em { font-style: normal; color: var(--mute); font-size: 12px;
         font-weight: 400; }

 .карта {
   border: 1px solid var(--line); border-radius: 12px; padding: 12px;
   margin-bottom: 10px; background: #000;
 }
 .карта.есть { border-color: var(--deep); }
 .шапка { display: flex; align-items: center; gap: 8px; cursor: pointer;
          user-select: none; }
 .точка { width: 8px; height: 8px; border-radius: 50%; flex: none;
          background: var(--line); }
 .карта.есть .точка { background: var(--neon); }
 .имя { font-weight: 600; flex: 1; min-width: 0; overflow: hidden;
        text-overflow: ellipsis; white-space: nowrap; }
 .цена { color: var(--mute); font-size: 12px; flex: none; }
 .тело { display: none; margin-top: 12px; }
 .карта.открыта .тело { display: block; }
 .подпись { color: var(--mute); font-size: 12px; margin: 0 0 10px; }
 .группа { color: var(--glow); font-size: 11px; letter-spacing: .14em;
           text-transform: uppercase; margin: 16px 0 0;
           padding-top: 12px; border-top: 1px solid var(--line); }

 /* Убранное не исчезает со страницы — иначе вернуть его было бы
    нечем. Оно гаснет и показывает, что убрано. */
 .убрать { background: none; border: 1px solid var(--line); color: var(--mute);
           border-radius: 8px; padding: 5px 10px; font: 500 12px/1 inherit;
           flex: none; cursor: pointer; }
 .убрать:hover { border-color: var(--neon); color: var(--neon); }
 .скрыто > .шапка > .имя, .скрыто > .шапка > .цена { opacity: .35;
                                                     text-decoration: line-through; }
 .скрыто > .тело { opacity: .4; }
 .скрыто { border-style: dashed; }
 .скрыто .точка { background: var(--line) !important; }
 .убрать.вернуть { border-color: var(--amber); color: var(--amber); }
 h3 .убрать { margin-left: auto; }
 h2 .убрать { margin-left: 12px; vertical-align: middle; }
 h3.скрыто-заг, h2.скрыто-заг { opacity: .45; }
 .тускло { opacity: .3; }
 .тускло .убрать { pointer-events: none; }

 h4 { font-size: 14px; margin: 14px 0 6px 12px; color: var(--glow);
      display: flex; align-items: center; gap: 8px; font-weight: 600; }
 h4 em { font-style: normal; color: var(--mute); font-size: 12px;
         font-weight: 400; }
 h4 .убрать { margin-left: auto; }
 h2 span, h3 span, h4 span { flex: 1; min-width: 0; }
 h2 { display: flex; align-items: center; gap: 8px; }
 /* Блок переименования ветки живёт под её заголовком и по умолчанию
    свёрнут: заголовков в дереве полтора десятка, и развёрнутые поля
    у каждого утопили бы варианты, ради которых сюда заходят. */
 .ветка-имена { margin: 0 0 8px; padding-top: 0; border-top: 0; }
 .карта.место .цена { display: none; }

 /* Русский текст в поле «для модели» — самая дорогая опечатка здесь:
    модель молчит, а брак виден только на готовой картинке, когда коины
    уже списаны. Поэтому карточка кричит. */
 .карта.беда { border-color: var(--amber); }
 .карта.беда .точка { background: var(--amber); }
 .тревога { display: none; color: var(--amber); font-size: 12px;
            margin: 6px 0 0; }
 .карта.беда .тревога { display: block; }

 /* Второстепенное — переименование и «убрать» — уезжает вниз карточки
    одной строкой. Наверху остаются две строки, ради которых сюда и
    заходят. */
 .ещё { display: flex; align-items: center; gap: 12px; flex-wrap: wrap;
        margin-top: 14px; padding-top: 12px; border-top: 1px solid var(--line); }
 .ещё .имена { flex-basis: 100%; order: 3; }
 .ссылка { background: none; border: 0; color: var(--mute); padding: 0;
           font: inherit; font-size: 13px; cursor: pointer;
           text-decoration: underline dotted; }
 .ссылка:hover { color: var(--glow); }
 .ещё .убрать { margin-left: auto; }
 h3.скрыто-заг > span, h2.скрыто-заг > span:first-child {
   text-decoration: line-through; }

 label { display: block; font-size: 11px; letter-spacing: .1em;
         text-transform: uppercase; color: var(--mute); margin: 10px 0 4px; }
 input, textarea {
   width: 100%; background: var(--ink); color: var(--white);
   border: 1px solid var(--line); border-radius: 8px; padding: 10px;
   font: inherit; resize: vertical;
 }
 input:focus, textarea:focus { outline: none; border-color: var(--neon); }
 textarea { min-height: 72px; }
 .правлено input, .правлено textarea { border-color: var(--amber); }

 .врезка {
   border: 1px solid var(--deep); border-radius: 12px; padding: 12px;
   margin: 16px 0 4px; background: #000;
 }
 .врезка p { color: var(--mute); font-size: 12px; margin: 4px 0 0; }
 .врезка textarea { min-height: 96px; }

 footer {
   position: fixed; left: 0; right: 0; bottom: 0; z-index: 30;
   background: rgba(11,10,13,.96); border-top: 1px solid var(--line);
   padding: 12px var(--gut) calc(12px + env(safe-area-inset-bottom));
   display: flex; align-items: center; gap: 12px;
 }
 button {
   background: var(--neon); color: #fff; border: 0; border-radius: 10px;
   padding: 13px 20px; font: 600 15px/1 inherit; cursor: pointer; flex: none;
 }
 button[disabled] { background: var(--line); color: var(--mute); cursor: default; }
 .статус { color: var(--mute); font-size: 13px; flex: 1; min-width: 0; }
 .статус.ок { color: var(--neon); }
 .статус.плохо { color: var(--amber); }
</style></head><body>

<header>
  <div class="brand"><b>AMBERRY</b><span>каталог</span></div>
  <div class="счёт" id="счёт"></div>
</header>

<div id="дерево"></div>

<footer>
  <div class="статус" id="статус">Загружаю…</div>
  <button id="сохранить" disabled>Сохранить</button>
</footer>

<script>
const $ = (s, r) => (r || document).querySelector(s);
let ДЕРЕВО = null;

// Что убрано из бота. Держится отдельным множеством, а не полем формы:
// убирать можно разделы и подразделы, у которых никаких полей нет.
const СКРЫТЫЕ = new Set();
// Все ключи дерева — по ним на сохранении рассылается «скрыт» или
// пусто. Без полного списка снятая галочка не доехала бы до файла:
// сервер пишет то, что прислали, а не разницу.
const ВСЕ_КЛЮЧИ = [];

function эк(s) { return (s || "").replace(/[&<>"]/g,
  c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }

function поле(вид, ключ, имя, метка, значение, подсказка) {
  const тег = вид === "input"
    ? `<input data-k="${ключ}" data-f="${имя}" value="${эк(значение)}"
              placeholder="${эк(подсказка)}">`
    : `<textarea data-k="${ключ}" data-f="${имя}"
                 placeholder="${эк(подсказка)}">${эк(значение)}</textarea>`;
  return `<label>${метка}</label>${тег}`;
}

function кнУбрать(ключ, скрыт) {
  return `<button class="убрать${скрыт ? " вернуть" : ""}" data-hide="${ключ}"
    >${скрыт ? "Вернуть" : "Убрать"}</button>`;
}

function именаБлок(в) {
  return `<div class="ещё">
      <button class="ссылка" data-more="${в.ключ}">Переименовать</button>
      <div class="имена" hidden>
        ${поле("input", в.ключ, "название", "Название — по-русски",
               в.название, в.название_по_умолчанию)}
        ${поле("input", в.ключ, "название_en", "Название — in English",
               в.название_en, в.название_en_по_умолчанию)}
      </div>
      ${кнУбрать(в.ключ, в.скрыт)}
      ${в.свой ? `<button class="убрать" data-снести="${в.ключ}"
                    title="Кнопку завёл ты — её можно стереть насовсем"
                  >Удалить</button>` : ""}
    </div>`;
}

function карта(в, родители) {
  const есть = в.строка ? " есть" : "";
  const где = в.пара ? `в кадре: ${эк(в.пара)}` : `ракурс: ${эк(в.подпись)}`;
  const ещё = (в.работает_ещё || []).map(
    x => `· та же строка работает в «${эк(x.узел)}» за ${x.коины} 😏`).join("<br>");
  return `<div class="карта${есть}${в.скрыт ? " скрыто" : ""}${
      в.кириллица ? " беда" : ""}"
    data-k="${в.ключ}" data-p="${родители.join(" ")}">
    <div class="шапка"><i class="точка"></i>
      <span class="имя">${эк(в.название || в.название_по_умолчанию)}</span>
      <span class="цена">${в.коины} 😏</span></div>
    <div class="тело">
      <p class="подпись">${где} · фото: ${в.фото[0]}${
        в.фото[1] !== в.фото[0] ? "–" + в.фото[1] : ""} · промпт ${
        в.промпт_длина} знаков${ещё ? "<br>" + ещё : ""}</p>
      ${поле("area", в.ключ, "строка_рус", "Что происходит — по-русски",
             в.строка_рус, "как увидит русский клиент")}
      ${поле("area", в.ключ, "строка", "То же для модели — English",
             в.строка, "english only; это же увидит английский клиент")}
      <p class="тревога">В английском поле русские буквы. Модель их не
         поймёт — кадр выйдет не тот, а коины спишутся.</p>
      ${именаБлок(в)}
    </div></div>`;
}

function местоКарта(м) {
  return `<div class="карта место${м.скрыт ? " скрыто" : ""}" data-k="${м.ключ}"
    data-p="">
    <div class="шапка"><i class="точка"></i>
      <span class="имя">${эк(м.название || м.название_по_умолчанию)}</span></div>
    <div class="тело">
      <p class="подпись">${эк(м.подпись)}</p>
      ${именаБлок(м)}
    </div></div>`;
}

// Дерево рисуется рекурсивно: уровней три, и они неровные — у «Соло»
// внутри есть ещё разбивка, у «Группового» нет. Писать отдельную
// отрисовку на каждый уровень значило бы переписывать её при каждой
// правке структуры.
function сказать(текст, плохо) {
  $("#статус").textContent = текст;
  $("#статус").className = "статус" + (плохо ? " плохо" : " ок");
}

async function послать(путь, тело) {
  try {
    const r = await fetch(путь, {
      method: "POST", headers: {"Content-Type": "application/json"},
      body: JSON.stringify(тело)});
    return await r.json();
  } catch (e) {
    return {ошибка: e.message};
  }
}

// Перерисовать дерево целиком. Своя кнопка появляется и исчезает
// сразу, без перезагрузки страницы: иначе владелец жмёт «завести» и
// не видит результата.
async function загрузить() {
  const r = await fetch("/api/дерево");
  нарисовать(await r.json());
}

// СВОЯ КНОПКА. Технический слой промпта — свет, объектив, анатомия,
// кожа, запреты — она получает ровно такой же, как кнопки из кода: он
// собирается автоматически. Владелец пишет то же, что и всегда: как
// кнопка называется и что происходит в кадре.
function формаДобавления(узел) {
  return `<div class="карта своя-новая" data-узел="${узел}">
    <div class="шапка"><i class="точка"></i>
      <span class="имя">Своя кнопка</span></div>
    <div class="тело">
      <p class="подпись">Появится в боте сразу, перезапуск не нужен.
         Свет, анатомия и запреты подставятся те же, что у остальных.</p>
      <label>Название кнопки</label>
      <input data-н="название" placeholder="как увидит клиент">
      <label>Что происходит — по-русски</label>
      <textarea data-н="строка_рус" placeholder="как увидит русский клиент"></textarea>
      <label>То же для модели — English</label>
      <textarea data-н="строка" placeholder="english only"></textarea>
      <label>Вид и цена</label>
      <select data-н="вид">
        <option value="i2i">Фото</option>
        <option value="i2v_5">Ролик 5 секунд</option>
        <option value="i2v_10">Ролик 10 секунд</option>
      </select>
      <button class="ссылка" data-завести="${узел}">Завести кнопку</button>
    </div></div>`;
}

async function завести(узел, корень) {
  const бери = н => {
    const э = корень.querySelector(`[data-н="${н}"]`);
    return э ? э.value.trim() : "";
  };
  const назв = бери("название");
  if (!назв) { сказать("Впиши название кнопки", true); return; }
  сказать("Завожу…");
  const о = await послать("/api/каталог/добавить", {
    узел, название: назв, строка: бери("строка"),
    строка_рус: бери("строка_рус"), вид: бери("вид") || "i2i"});
  if (о && о.ключ) {
    сказать("Кнопка «" + назв + "» заведена");
    await загрузить();
  } else {
    сказать((о && о.ошибка) || "не получилось", true);
  }
}

async function снести(ключ) {
  if (!confirm("Удалить эту кнопку насовсем? Вернуть будет нельзя.")) return;
  const о = await послать("/api/каталог/удалить", {ключ});
  if (о && о.ок) {
    сказать("Кнопка удалена");
    await загрузить();
  } else {
    сказать((о && о.ошибка) || "не получилось", true);
  }
}

function ветка(у, глубина, родители) {
  ВСЕ_КЛЮЧИ.push(у.ключ);
  if (у.скрыт) СКРЫТЫЕ.add(у.ключ);
  const тег = глубина === 0 ? "h2" : (глубина === 1 ? "h3" : "h4");
  const сколько = у.варианты.length
    ? ` <em>${у.варианты.length} вариантов</em>` : "";
  let h = `<${тег} data-z="${у.ключ}" data-p="${родители.join(" ")}"
      class="${у.скрыт ? "скрыто-заг" : ""}"><span>${
      эк(у.название || у.название_по_умолчанию)}</span>${сколько}${
      кнУбрать(у.ключ, у.скрыт)}</${тег}>`;
  h += `<div class="ещё ветка-имена" data-for="${у.ключ}">
      <button class="ссылка" data-more="${у.ключ}">Переименовать</button>
      <div class="имена" hidden>
        ${поле("input", у.ключ, "название", "Название — по-русски",
               у.название, у.название_по_умолчанию)}
        ${поле("input", у.ключ, "название_en", "Название — in English",
               у.название_en, у.название_en_по_умолчанию)}
      </div></div>`;
  const внутрь = родители.concat([у.ключ]);
  for (const в of у.варианты) {
    ВСЕ_КЛЮЧИ.push(в.ключ);
    if (в.скрыт) СКРЫТЫЕ.add(в.ключ);
    h += карта(в, внутрь);
  }
  if (у.варианты.length)
    h += формаДобавления(у.ключ);
  if (!у.варианты.length && !у.дети.length)
    h += `<p class="подпись">Клиент пишет описание сам — править нечего.</p>`;
  for (const д of у.дети) h += ветка(д, глубина + 1, внутрь);
  return h;
}

function нарисовать(д) {
  ДЕРЕВО = д;
  ВСЕ_КЛЮЧИ.length = 0;
  СКРЫТЫЕ.clear();
  const o = д.обязательное;
  let h = `<div class="врезка">
    <h2>Обязательная строка</h2>
    <p>Дописывается к <b>своему промпту</b> клиента автоматически, чтобы
       бот не выдал одетый кадр за деньги.</p>
    ${поле("area", o.ключ, "строка_рус", "По-русски (для памяти)",
           o.строка_рус, o.по_умолчанию_рус)}
    ${поле("area", o.ключ, "строка", "Для модели — English",
           o.строка, o.по_умолчанию)}
  </div>`;

  for (const р of д.разделы) h += ветка(р, 0, []);

  h += `<h2 data-z="_места"><span>Места</span></h2>
    <p class="подпись">Обстановка. Ставится к любому варианту, когда
    клиент хочет фон не такой, как на его снимке. Убранное место просто
    не предлагается.</p>`;
  for (const м of д.места) {
    ВСЕ_КЛЮЧИ.push(м.ключ);
    if (м.скрыт) СКРЫТЫЕ.add(м.ключ);
    h += местоКарта(м);
  }

  $("#дерево").innerHTML = h;
  счёт();
  $("#статус").textContent = "Правь что нужно и жми «Сохранить».";
  $("#статус").className = "статус";
}

function счёт() {
  const поля = [...document.querySelectorAll('textarea[data-f="строка"]')]
    .filter(t => t.dataset.k !== ДЕРЕВО.обязательное.ключ);
  const есть = поля.filter(t => t.value.trim()).length;
  // Скрытый вариант остаётся в дереве, но в бот не попадает — значит
  // и считать его видимым нельзя.
  const видно = поля.filter(t => !спрятан(t.closest(".карта"))).length;
  $("#счёт").innerHTML = `Наполнено <i>${есть}</i> из ${ДЕРЕВО.всего} вариантов`
    + (видно < ДЕРЕВО.всего ? ` · в боте видно <i>${видно}</i>` : "");
  тени();
}

// Предок спрятан — спрятано и всё, что внутри. Предки записаны прямо
// на элементе: искать их обходом соседей значит завести второй способ
// считать то же самое, и он однажды разойдётся с ботом.
function подПрятанным(эл) {
  const цепь = (эл.dataset.p || "").split(" ").filter(Boolean);
  return цепь.some(к => СКРЫТЫЕ.has(к));
}

// Убранный раздел уносит с собой подразделы и варианты. На странице
// они остаются — вернуть их иначе было бы нечем, — но должны
// выглядеть выключенными: живой на вид вариант внутри перечёркнутого
// раздела читается как «этот всё-таки работает».
function тени() {
  for (const эл of document.querySelectorAll("[data-p]")) {
    эл.classList.toggle("тускло", подПрятанным(эл));
  }
}

// Вариант спрятан сам или вместе со своим подразделом или разделом.
// Ровно то же правило, что в боте (catalog.Scene.скрыт), поэтому
// родители записаны на самой карточке: искать их обходом соседей
// значит завести второй способ считать то же самое.
function спрятан(карт) {
  if (!карт) return false;
  return СКРЫТЫЕ.has(карт.dataset.k) || подПрятанным(карт);
}

function собрать() {
  const из = {};
  for (const el of document.querySelectorAll("[data-k][data-f]")) {
    (из[el.dataset.k] = из[el.dataset.k] || {})[el.dataset.f] = el.value.trim();
  }
  // «Скрыт» рассылается по ВСЕМ ключам, а не только по спрятанным:
  // сервер записывает присланное целиком, и снятая отметка иначе не
  // доехала бы — пункт остался бы убранным навсегда.
  //
  // Видимое помечается НУЛЁМ, а не пустотой. Пустое поле бот читает
  // как «владелец про этот пункт ничего не говорил» и берёт умолчание
  // кода, а у части пунктов умолчание — «убран» (catalog.СНЯТО_ПО_
  // УМОЛЧАНИЮ, например «ММ геи»). Пустота вернула бы их обратно на
  // следующем же сохранении.
  for (const к of ВСЕ_КЛЮЧИ) {
    (из[к] = из[к] || {})["скрыт"] = СКРЫТЫЕ.has(к) ? "1" : "0";
  }
  return из;
}

function правки_есть(текст) {
  $("#сохранить").disabled = false;
  $("#статус").textContent = текст || "Есть несохранённые правки.";
  $("#статус").className = "статус плохо";
}

document.addEventListener("click", e => {
  const м = e.target.closest("[data-more]");
  if (м) {
    const где = м.parentElement.querySelector(".имена");
    где.hidden = !где.hidden;
    м.textContent = где.hidden ? "Переименовать кнопку" : "Свернуть названия";
    return;
  }
  const б = e.target.closest("[data-hide]");
  if (б) {
    const к = б.dataset.hide;
    const теперь = !СКРЫТЫЕ.has(к);
    теперь ? СКРЫТЫЕ.add(к) : СКРЫТЫЕ.delete(к);
    б.textContent = теперь ? "Вернуть" : "Убрать";
    б.classList.toggle("вернуть", теперь);
    const где = б.closest(".карта") || б.closest("h2, h3, h4");
    if (где) где.classList.toggle(где.tagName === "DIV" ? "скрыто" : "скрыто-заг",
                                  теперь);
    счёт();
    правки_есть();
    return;                        // не сворачивать карточку заодно
  }
  const з = e.target.closest("[data-завести]");
  if (з) {
    завести(з.dataset.завести, з.closest(".карта"));
    return;
  }
  const у = e.target.closest("[data-снести]");
  if (у) {
    снести(у.dataset.снести);
    return;
  }
  const ш = e.target.closest(".шапка");
  if (ш) ш.parentElement.classList.toggle("открыта");
});

document.addEventListener("input", e => {
  if (!e.target.dataset || !e.target.dataset.k) return;
  e.target.classList.add("правлено");
  const к = e.target.closest(".карта");
  if (к) {
    const стр = к.querySelector('textarea[data-f="строка"]');
    к.classList.toggle("есть", !!(стр && стр.value.trim()));
    if (стр) к.classList.toggle("беда", /[а-яё]/i.test(стр.value));
    const имя = к.querySelector('input[data-f="название"]');
    if (имя) к.querySelector(".имя").textContent =
      имя.value.trim() || имя.placeholder;
  }
  счёт();
  правки_есть();
});

$("#сохранить").addEventListener("click", async () => {
  const b = $("#сохранить");
  b.disabled = true;
  $("#статус").textContent = "Сохраняю…";
  $("#статус").className = "статус";
  try {
    const r = await fetch("/api/сохранить", {
      method: "POST", headers: {"Content-Type": "application/json"},
      body: JSON.stringify(собрать()),
    });
    const j = await r.json();
    if (!r.ok) throw new Error(j.ошибка || r.status);
    $("#статус").textContent =
      `Сохранено: ${j.записей} записей. Бот подхватит за секунду.`;
    $("#статус").className = "статус ок";
    document.querySelectorAll(".правлено")
      .forEach(el => el.classList.remove("правлено"));
  } catch (e) {
    $("#статус").textContent = "Не сохранилось: " + e.message;
    $("#статус").className = "статус плохо";
    b.disabled = false;
  }
});

загрузить().catch(e => {
  $("#статус").textContent = "Не загрузилось: " + e.message;
  $("#статус").className = "статус плохо";
});
</script></body></html>
"""


def страница():
    """Подстановка простой заменой меток, а не через `%`.

    В шаблоне лежит CSS, а в CSS есть проценты: `width: 100%`,
    `border-radius: 50%`. При `%`-форматировании любой из них роняет
    страницу целиком — и не на правке стилей, а при следующем запросе,
    сообщением про аргументы формата. Один раз уже уронил.
    """
    цвета = {"NEON": brand.NEON, "GLOW": brand.GLOW, "DEEP": brand.DEEP,
             "AMBER": brand.AMBER, "INK": brand.INK, "LINE": brand.LINE,
             "WHITE": brand.WHITE, "MUTE": brand.MUTE}
    текст = СТРАНИЦА
    for имя, знач in цвета.items():
        текст = текст.replace("{{" + имя + "}}", знач)
    return текст


class Обработчик(BaseHTTPRequestHandler):
    server_version = "amberry-admin"
    sys_version = ""                  # версию питона наружу не сообщаем

    def log_message(self, формат, *арг):
        print(f"{self.address_string()} {формат % арг}", flush=True)

    # ---------- служебное ----------

    def _ответ(self, код, тело, тип="application/json; charset=utf-8",
               ещё=None):
        if isinstance(тело, (dict, list)):
            тело = json.dumps(тело, ensure_ascii=False).encode()
        elif isinstance(тело, str):
            тело = тело.encode()
        self.send_response(код)
        self.send_header("Content-Type", тип)
        self.send_header("Content-Length", str(len(тело)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Referrer-Policy", "no-referrer")
        for k, v in (ещё or {}).items():
            self.send_header(k, v)
        self.end_headers()
        self.wfile.write(тело)

    def _впустить(self):
        if not ПАРОЛЬ:
            # Пустой пароль — не «открыто всем», а незаконченная
            # настройка. Открывать каталог миру молча нельзя.
            self._ответ(503, {"ошибка": "AMBERRY_ADMIN_PASS не задан"})
            return False
        if проверить_пароль(self.headers.get("Authorization"),
                            self.client_address[0]):
            return True
        self._ответ(401, {"ошибка": "нужен пароль"},
                    ещё={"WWW-Authenticate": 'Basic realm="AMBERRY"'})
        return False

    # ---------- запросы ----------

    @property
    def путь(self):
        """Кириллица в адресе приезжает процентами: браузер кодирует
        `/api/дерево` в `/api/%D0%B4...`. Сравнивать надо расшифрованное,
        иначе адрес работает из curl и не работает из браузера."""
        return unquote(self.path.split("?", 1)[0])

    def поле(self, имя):
        """Значение из строки запроса. Кириллица приезжает процентами —
        как и в самом адресе, см. `путь`."""
        _, _, хвост = self.path.partition("?")
        for кусок in хвост.split("&"):
            ключ, _, зн = кусок.partition("=")
            if unquote(ключ) == имя:
                return unquote(зн.replace("+", " "))
        return ""

    def тело(self, предел=200_000):
        длина = int(self.headers.get("Content-Length") or 0)
        if длина > предел:
            raise ValueError("слишком длинно")
        return json.loads(self.rfile.read(длина).decode("utf-8") or "{}")

    def do_GET(self):
        if not self._впустить():
            return
        п = self.путь
        if п in ("/", "/index.html"):
            self._ответ(200, панель.страница(brand.logo_data_uri()),
                        "text/html; charset=utf-8")
            return
        # Прежняя страница кнопок цела и живёт своим адресом: панель
        # показывает её разделом «Каталог» в рамке. Переписывать то, чем
        # владелец пользуется каждый день, ради одного вида — лишний
        # риск на ровном месте.
        if п == "/каталог":
            self._ответ(200, страница(), "text/html; charset=utf-8")
            return
        if п == "/api/дерево":
            catalog.перечитать()
            self._ответ(200, catalog.дерево())
            return
        if п == "/api/запрет":
            self._ответ(200, запрет.состояние())
            return
        if п == "/api/прайс":
            self._ответ(200, pricing.состояние())
            return
        if п == "/api/сводка":
            self._ответ(200, сводка.срез(store, pricing, catalog))
            return
        if п == "/api/люди":
            self._ответ(200, {"люди": store.люди(self.поле("поиск"))})
            return
        if п == "/api/оплаты":
            self._ответ(200, {"оплаты": store.оплаты()})
            return
        if п == "/api/работы":
            рр = store.работы_все()
            for р in рр:
                р["имя"] = _имя_работы(р)
            self._ответ(200, {"работы": рр})
            return
        if п == "/api/поддержка":
            self._ответ(200, {"диалоги": store.поддержка_диалоги()})
            return
        if п.startswith("/api/поддержка/"):
            кто = п.rsplit("/", 1)[1]
            if not кто.isdigit():
                self._ответ(400, {"ошибка": "нужен номер"})
                return
            человек = store.user(int(кто)) or {}
            self._ответ(200, {"письма": store.поддержка_диалог(int(кто)),
                              "username": человек.get("username")})
            return
        if п == "/api/рассылки":
            self._ответ(200, {"рассылки": store.рассылки()})
            return
        if п == "/api/рассылка/ход":
            self._ответ(200, {"ход": сводка.состояние()})
            return
        if п == "/api/рассылка/сколько":
            кому = self.поле("кому") or "всем"
            self._ответ(200, {"сколько": len(store.рассылка_кому(кому))})
            return
        if п == "/api/услуги":
            self._ответ(200, сводка.услуги(pricing, catalog))
            return
        if п == "/api/франшиза":
            self._ответ(200, сводка.партнёры(store, франшиза))
            return
        if п.startswith("/api/франшиза/токен/"):
            # Полный токен отдаётся ТОЛЬКО по отдельному запросу и
            # только на карточку одного партнёра: в общем списке он
            # лежал бы в исходном коде страницы, а это ключ от чужого
            # бота.
            кто = п.rsplit("/", 1)[1]
            if not кто.isdigit():
                self._ответ(400, {"ошибка": "нужен номер"})
                return
            п_ = store.партнёр(int(кто)) or {}
            self._ответ(200, {"токен": п_.get("токен") or ""})
            return
        self._ответ(404, {"ошибка": "нет такой страницы"})

    def _действие(self, путь, д):
        """Кнопки панели. Каждое действие отвечает тем, что изменилось,
        — страница по ответу перерисовывает только свой раздел."""
        if путь == "/api/запрет/сохранить":
            д2 = запрет.записать(слова_=д.get("слова"),
                                 исключения_=д.get("исключения"))
            print("запрет изменён: слов %d, исключений %d"
                  % (len(д2["слова"]), len(д2["исключения"])), flush=True)
            self._ответ(200, д2)
            return
        if путь == "/api/запрет/вернуть":
            д2 = запрет.вернуть_базовые()
            print("запрет возвращён к базовому: %d слов"
                  % len(д2["слова"]), flush=True)
            self._ответ(200, д2)
            return
        if путь == "/api/запрет/проверить":
            # Примерка: владелец вставляет фразу и сразу видит, что с
            # ней будет. Без этого настройка списка — гадание.
            плохо, что = запрет.нельзя(str(д.get("текст") or ""))
            self._ответ(200, {"запрещено": плохо, "слово": что})
            return
        if путь == "/api/каталог/добавить":
            # СВОЯ КНОПКА ВЛАДЕЛЬЦА. Технический слой промпта она
            # получает ровно такой же, как кнопки из кода: он
            # собирается автоматически и от способа заведения не
            # зависит. Владелец пишет только то же, что и всегда, —
            # что происходит в кадре.
            назв = str(д.get("название") or "").strip()
            строка = str(д.get("строка") or "").strip()
            if not назв:
                self._ответ(400, {"ошибка": "нужно название кнопки"})
                return
            ключ = catalog.добавить_свой(
                название=назв, строка=строка,
                строка_рус=str(д.get("строка_рус") or "").strip(),
                вид=str(д.get("вид") or "i2i"),
                узел_=str(д.get("узел") or ""),
                подпись=str(д.get("подпись") or "").strip(),
                название_en=str(д.get("название_en") or "").strip())
            print("своя кнопка заведена:", ключ, назв, flush=True)
            self._ответ(200, {"ок": True, "ключ": ключ})
            return
        if путь == "/api/каталог/удалить":
            # Удаляется НАСОВСЕМ и только своя. Кнопку из кода этот
            # вызов не трогает — там три тысячи знаков промпта,
            # стёртые из браузера они бы не вернулись.
            ключ = str(д.get("ключ") or "")
            убрали = catalog.убрать_свой(ключ)
            print("своя кнопка удалена:" if убрали
                  else "удалить нельзя (кнопка из кода):", ключ, flush=True)
            self._ответ(200 if убрали else 400,
                        {"ок": убрали} if убрали else
                        {"ошибка": "эту кнопку можно только спрятать"})
            return
        if путь == "/api/прайс/сохранить":
            д2 = pricing.записать(пакеты=д.get("пакеты"), виды=д.get("виды"))
            print("прайс изменён: ступеней %d" % len(д2["пакеты"]), flush=True)
            self._ответ(200, д2)
            return
        if путь == "/api/прайс/вернуть":
            д2 = pricing.вернуть_как_в_коде()
            print("прайс возвращён к коду", flush=True)
            self._ответ(200, д2)
            return
        if путь == "/api/человек/блок":
            store.заблокировать(int(д["tg_id"]), bool(д.get("блок", True)))
            self._ответ(200, {"ок": True})
            return
        if путь == "/api/человек/удалить":
            # Удаление необратимо и стирает переписку, оплаты и работы.
            # Подтверждение спрашивает страница; здесь только делаем.
            итог = store.забыть(int(д["tg_id"]))
            self._ответ(200, {"ок": True, "удалено": итог})
            return
        if путь == "/api/поддержка/ответ":
            текст = (д.get("текст") or "").strip()
            if not текст:
                self._ответ(400, {"ошибка": "пустой ответ"})
                return
            ушло, насмерть = сводка.ответить(store, int(д["tg_id"]), текст)
            self._ответ(200, {"ушло": ушло,
                              "почему": "человек выгнал бота" if насмерть
                                        else ("" if ушло else "телеграм не принял")})
            return
        if путь == "/api/рассылка":
            текст = (д.get("текст") or "").strip()
            if not текст:
                self._ответ(400, {"ошибка": "пустое письмо"})
                return
            ид, сколько = сводка.разослать(store, текст,
                                           д.get("кому") or "всем")
            print(f"рассылка {ид}: {сколько} адресатов", flush=True)
            self._ответ(200, {"ид": ид, "сколько": сколько})
            return
        if путь == "/api/франшиза/состояние":
            store.партнёр_состояние(int(д["tg_id"]), str(д["состояние"]))
            self._ответ(200, {"ок": True})
            return
        if путь == "/api/франшиза/рубильник":
            # ОДНО НАЖАТИЕ ГАСИТ И ПОДНИМАЕТ КОПИЮ ПАРТНЁРА.
            #
            # Гашение НЕ стирает ничего: база партнёра, его работы и
            # его env остаются на месте. Выключение - это спор о
            # деньгах или пауза, и вернуть копию надо будет тем же
            # нажатием. Удаление данных партнёра - отдельное решение
            # владельца и не с этой кнопки.
            import партнёры as копии
            кто = int(д["tg_id"])
            включить = bool(д.get("включить"))
            п_ = store.партнёр(кто) or {}
            if включить:
                if not п_.get("токен"):
                    self._ответ(400, {"ошибка": "партнёр ещё не прислал токен"})
                    return
                ок, сказал = копии.пуск(кто, п_["токен"], п_.get("бот") or "")
            else:
                ок, сказал = копии.стоп(кто)
            if ок:
                store.партнёр_состояние(кто, "запущен" if включить
                                        else "остановлен")
            self._ответ(200 if ок else 400,
                        {"ок": ок, "жив": ок and включить,
                         "ошибка": "" if ок else сказал})
            return
        if путь == "/api/франшиза/учёт":
            # Деньги здесь только ЗАПИСЫВАЮТСЯ. Перевести партнёру
            # панель не может и не должна.
            store.партнёр_учёт(int(д["tg_id"]),
                               выручка=д.get("выручка"),
                               выплачено=д.get("выплачено"),
                               доля=д.get("доля"))
            self._ответ(200, {"ок": True})
            return
        if путь == "/api/услуги/спрятать":
            ид = str(д.get("ид") or "")
            if ид not in {p["id"] for p in pricing.PACKS}:
                self._ответ(400, {"ошибка": "нет такой ступени"})
                return
            правки = dict(данные.загрузить())
            своё = dict(правки.get("pack:" + ид) or {})
            своё["скрыт"] = "1" if д.get("скрыт") else "0"
            правки["pack:" + ид] = своё
            данные.сохранить(правки)
            catalog.перечитать()
            self._ответ(200, {"ок": True})
            return
        self._ответ(404, {"ошибка": "нет такого действия"})

    def do_POST(self):
        if not self._впустить():
            return
        if not self.путь.startswith("/api/"):
            self._ответ(404, {"ошибка": "нет такой страницы"})
            return
        if self.путь != "/api/сохранить":
            # Всё, кроме сохранения каталога, — действия панели. У них
            # своё тело запроса, и прогонять его через разбор правок
            # каталога нельзя: он ждёт совсем другой словарь.
            try:
                self._действие(self.путь, self.тело())
            except Exception as e:                      # noqa: BLE001
                self._ответ(400, {"ошибка": str(e)[:200]})
            return
        длина = int(self.headers.get("Content-Length") or 0)
        if длина > 1_000_000:
            self._ответ(413, {"ошибка": "слишком большая правка"})
            return
        try:
            правки, чужих = разобрать_правки(self.rfile.read(длина))
        except Exception as e:
            self._ответ(400, {"ошибка": f"не разобрала: {str(e)[:200]}"})
            return
        # Спрятать всё до последнего — это бот с пустым меню и без
        # единой кнопки, за которую платят. Ошибиться так легко (жмёшь
        # «убрать» подряд), а заметить трудно: страница-то выглядит
        # полной, скрытые пункты с неё никуда не деваются.
        if not catalog.что_то_осталось(правки):
            self._ответ(400, {"ошибка": "так в боте не останется ни одного "
                                        "варианта — верни хотя бы один"})
            return
        try:
            записей = данные.сохранить(правки)
        except OSError as e:
            self._ответ(500, {"ошибка": f"не пишется на диск: {str(e)[:200]}"})
            return
        # Перечитать СРАЗУ: страница тут же запрашивает дерево заново, и
        # ждать секунду кэша ей незачем.
        catalog.перечитать()
        наполнено = sum(1 for s in catalog.все_сценарии() if s.наполнен)
        print(f"сохранено {записей} записей, наполнено {наполнено}", flush=True)
        self._ответ(200, {"записей": записей, "наполнено": наполнено,
                          "чужих_ключей": чужих})


def _имя_работы(р):
    """Что человеку показывать вместо ключа сценария."""
    if р.get("scene"):
        try:
            return catalog.scene(р["scene"]).title
        except KeyError:
            pass
    try:
        return pricing.job(р["kind"]).title
    except KeyError:
        return р.get("kind") or ""


def main():
    if not ПАРОЛЬ:
        print("ВНИМАНИЕ: AMBERRY_ADMIN_PASS не задан — страница закрыта",
              flush=True)
    print(f"каталог AMBERRY на http://{АДРЕС}:{ПОРТ}  "
          f"(сценариев {len(catalog.все_сценарии())}, "
          f"файл {данные.ФАЙЛ})", flush=True)
    ThreadingHTTPServer((АДРЕС, ПОРТ), Обработчик).serve_forever()


if __name__ == "__main__":
    main()
