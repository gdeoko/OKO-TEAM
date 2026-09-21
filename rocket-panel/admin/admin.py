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
каждого варианта три поля (название кнопки, строка по-русски для
экрана, строка по-английски для модели) и одну кнопку «Сохранить».
Сохранение пишет `каталог.json`, а бот замечает изменение файла сам, в
течение секунды. Перезапускать нечего, root не нужен.

НЕ ДЕЛАЕТ: не переводит. Русское поле показывается ЧЕЛОВЕКУ на экране
сценария до оплаты, английское уходит МОДЕЛИ. Модели обучены на
английском, русский там даёт мусор — причём молча, на готовой картинке,
когда коины уже списаны. Поля два, и заполняются оба.

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
   --neon: %(NEON)s; --glow: %(GLOW)s; --deep: %(DEEP)s; --amber: %(AMBER)s;
   --ink: %(INK)s; --line: %(LINE)s; --white: %(WHITE)s; --mute: %(MUTE)s;
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
 .точка { width: 8px; height: 8px; border-radius: 50%%; flex: none;
          background: var(--line); }
 .карта.есть .точка { background: var(--neon); }
 .имя { font-weight: 600; flex: 1; min-width: 0; overflow: hidden;
        text-overflow: ellipsis; white-space: nowrap; }
 .цена { color: var(--mute); font-size: 12px; flex: none; }
 .тело { display: none; margin-top: 12px; }
 .карта.открыта .тело { display: block; }
 .подпись { color: var(--mute); font-size: 12px; margin: 0 0 10px; }

 label { display: block; font-size: 11px; letter-spacing: .1em;
         text-transform: uppercase; color: var(--mute); margin: 10px 0 4px; }
 input, textarea {
   width: 100%%; background: var(--ink); color: var(--white);
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

function карта(в) {
  const есть = в.строка ? " есть" : "";
  const где = в.пара ? `в кадре: ${эк(в.пара)}`
            : (в.место ? `место: ${эк(в.место)}` : `ракурс: ${эк(в.подпись)}`);
  return `<div class="карта${есть}" data-k="${в.ключ}">
    <div class="шапка"><i class="точка"></i>
      <span class="имя">${эк(в.название || в.название_по_умолчанию)}</span>
      <span class="цена">${в.коины} 😏</span></div>
    <div class="тело">
      <p class="подпись">${где} · фото: ${в.фото[0]}${
        в.фото[1] !== в.фото[0] ? "–" + в.фото[1] : ""} · промпт ${
        в.промпт_длина} знаков</p>
      ${поле("input", в.ключ, "название", "Название кнопки",
             в.название, в.название_по_умолчанию)}
      ${поле("area", в.ключ, "строка_рус", "Что происходит — по-русски (видит клиент)",
             в.строка_рус, "коротко, 2–5 слов")}
      ${поле("area", в.ключ, "строка", "То же по-английски (уходит модели)",
             в.строка, "english only — модель обучена на нём")}
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
    ${поле("area", o.ключ, "строка", "По-английски (уходит модели)",
           o.строка, o.по_умолчанию)}
  </div>`;

  for (const р of д.разделы) {
    h += `<h2>${эк(р.название)}<small>${эк(р.подзаголовок)}</small></h2>`;
    for (const под of р.подразделы) {
      h += `<h3>${эк(под.название)} <em>${под.варианты.length
            ? под.варианты.length + " вариантов" : "без вариантов"}</em></h3>`;
      h += под.варианты.map(карта).join("");
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
  const всего = ДЕРЕВО.всего;
  const есть = document.querySelectorAll('textarea[data-f="строка"]')
    .length ? [...document.querySelectorAll('textarea[data-f="строка"]')]
      .filter(t => t.dataset.k !== ДЕРЕВО.обязательное.ключ && t.value.trim())
      .length : 0;
  $("#счёт").innerHTML = `Наполнено <i>${есть}</i> из ${всего} вариантов`;
}

function собрать() {
  const из = {};
  for (const el of document.querySelectorAll("[data-k][data-f]")) {
    (из[el.dataset.k] = из[el.dataset.k] || {})[el.dataset.f] = el.value.trim();
  }
  return из;
}

document.addEventListener("click", e => {
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
  $("#сохранить").disabled = false;
  $("#статус").textContent = "Есть несохранённые правки.";
  $("#статус").className = "статус плохо";
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
    return СТРАНИЦА % {
        "NEON": brand.NEON, "GLOW": brand.GLOW, "DEEP": brand.DEEP,
        "AMBER": brand.AMBER, "INK": brand.INK, "LINE": brand.LINE,
        "WHITE": brand.WHITE, "MUTE": brand.MUTE,
    }


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
