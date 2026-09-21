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
import brand            # noqa: E402

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
    ок = (hmac.compare_digest(логин, ПОЛЬЗОВАТЕЛЬ)
          and hmac.compare_digest(пароль, ПАРОЛЬ))
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

function карта(в, подКлюч, разделКлюч) {
  const есть = в.строка ? " есть" : "";
  const где = в.пара ? `в кадре: ${эк(в.пара)}`
            : (в.место ? `место: ${эк(в.место)}` : `ракурс: ${эк(в.подпись)}`);
  return `<div class="карта${есть}${в.скрыт ? " скрыто" : ""}"
    data-k="${в.ключ}" data-p="${подКлюч}" data-r="${разделКлюч}">
    <div class="шапка"><i class="точка"></i>
      <span class="имя">${эк(в.название || в.название_по_умолчанию)}</span>
      <span class="цена">${в.коины} 😏</span></div>
    <div class="тело">
      <p class="подпись">${где} · фото: ${в.фото[0]}${
        в.фото[1] !== в.фото[0] ? "–" + в.фото[1] : ""} · промпт ${
        в.промпт_длина} знаков</p>
      ${поле("area", в.ключ, "строка_рус", "Что происходит — по-русски",
             в.строка_рус, "как увидит русский клиент")}
      ${поле("area", в.ключ, "строка", "То же для модели — English",
             в.строка, "english only; это же увидит английский клиент")}
      <div class="ещё">
        <button class="ссылка" data-more="${в.ключ}">Переименовать кнопку</button>
        <div class="имена" hidden>
          ${поле("input", в.ключ, "название", "Название — по-русски",
                 в.название, в.название_по_умолчанию)}
          ${поле("input", в.ключ, "название_en", "Название — in English",
                 в.название_en, в.название_en_по_умолчанию)}
        </div>
        ${кнУбрать(в.ключ, в.скрыт)}
      </div>
    </div></div>`;
}

function нарисовать(д) {
  ДЕРЕВО = д;
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

  ВСЕ_КЛЮЧИ.length = 0;
  СКРЫТЫЕ.clear();
  for (const р of д.разделы) {
    ВСЕ_КЛЮЧИ.push(р.ключ);
    if (р.скрыт) СКРЫТЫЕ.add(р.ключ);
    h += `<h2 data-z="${р.ключ}" class="${р.скрыт ? "скрыто-заг" : ""}"
           ><span>${эк(р.название)}</span>${кнУбрать(р.ключ, р.скрыт)
           }<small>${эк(р.подзаголовок)}</small></h2>`;
    for (const под of р.подразделы) {
      ВСЕ_КЛЮЧИ.push(под.ключ);
      if (под.скрыт) СКРЫТЫЕ.add(под.ключ);
      h += `<h3 data-z="${под.ключ}" class="${под.скрыт ? "скрыто-заг" : ""}"
            ><span>${эк(под.название)}</span> <em>${под.варианты.length
            ? под.варианты.length + " вариантов" : "без вариантов"}</em>${
            кнУбрать(под.ключ, под.скрыт)}</h3>`;
      for (const в of под.варианты) {
        ВСЕ_КЛЮЧИ.push(в.ключ);
        if (в.скрыт) СКРЫТЫЕ.add(в.ключ);
      }
      h += под.варианты.map(в => карта(в, под.ключ, р.ключ)).join("");
      if (!под.варианты.length)
        h += `<p class="подпись">Клиент пишет описание сам — править нечего.</p>`;
    }
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

// Убранный раздел уносит с собой подразделы и варианты. На странице
// они остаются — вернуть их иначе было бы нечем, — но должны
// выглядеть выключенными: живой на вид вариант внутри перечёркнутого
// раздела читается как «этот всё-таки работает».
function тени() {
  for (const карт of document.querySelectorAll(".карта")) {
    const d = карт.dataset;
    карт.classList.toggle("тускло", СКРЫТЫЕ.has(d.p) || СКРЫТЫЕ.has(d.r));
  }
  for (const h of document.querySelectorAll("h3[data-z]")) {
    const карт = h.nextElementSibling;
    const раздел = карт && карт.dataset ? карт.dataset.r : null;
    h.classList.toggle("тускло", !!раздел && СКРЫТЫЕ.has(раздел));
  }
}

// Вариант спрятан сам или вместе со своим подразделом или разделом.
// Ровно то же правило, что в боте (catalog.Scene.скрыт), поэтому
// родители записаны на самой карточке: искать их обходом соседей
// значит завести второй способ считать то же самое.
function спрятан(карт) {
  if (!карт) return false;
  const d = карт.dataset;
  return СКРЫТЫЕ.has(d.k) || СКРЫТЫЕ.has(d.p) || СКРЫТЫЕ.has(d.r);
}

function собрать() {
  const из = {};
  for (const el of document.querySelectorAll("[data-k][data-f]")) {
    (из[el.dataset.k] = из[el.dataset.k] || {})[el.dataset.f] = el.value.trim();
  }
  // «Скрыт» рассылается по ВСЕМ ключам, а не только по спрятанным:
  // сервер записывает присланное целиком, и снятая отметка иначе не
  // доехала бы — пункт остался бы убранным навсегда.
  for (const к of ВСЕ_КЛЮЧИ) {
    (из[к] = из[к] || {})["скрыт"] = СКРЫТЫЕ.has(к) ? "1" : "";
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
    const где = б.closest(".карта") || б.closest("h2, h3");
    if (где) где.classList.toggle(где.tagName === "DIV" ? "скрыто" : "скрыто-заг",
                                  теперь);
    счёт();
    правки_есть();
    return;                        // не сворачивать карточку заодно
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

fetch("/api/дерево").then(r => r.json()).then(нарисовать).catch(e => {
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

    def do_GET(self):
        if not self._впустить():
            return
        if self.путь in ("/", "/index.html"):
            self._ответ(200, страница(), "text/html; charset=utf-8")
            return
        if self.путь == "/api/дерево":
            catalog.перечитать()
            self._ответ(200, catalog.дерево())
            return
        self._ответ(404, {"ошибка": "нет такой страницы"})

    def do_POST(self):
        if not self._впустить():
            return
        if not self.путь.startswith("/api/"):
            self._ответ(404, {"ошибка": "нет такой страницы"})
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
