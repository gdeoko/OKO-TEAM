/* ═══════════════════════════════════════════════════════════
   Rocket CDN × RocketVPN · единый корабельный переключатель

   RocketVPN не открывает второй плоский интерфейс поверх сайта.
   Он живёт в том же мире: в мобильном меню — как продукт, а в
   кабине — как смена сигнала правого голографического проектора.
   Переключение сопровождается короткой помехой, после которой
   меняется состояние самого прибора, а не весь макет страницы.
   ═══════════════════════════════════════════════════════════ */
(function (g) {
"use strict";

var doc = document, root = doc.documentElement;
var MODE_KEY = "rcdn.product";
var AB_KEY = "rcdn.ab.vpn";
var mode = "cdn", variant = "a", glitchT = 0;

try {
  mode = localStorage.getItem(MODE_KEY) === "vpn" ? "vpn" : "cdn";
  variant = localStorage.getItem(AB_KEY) || "";
  if (variant !== "a" && variant !== "b") {
    variant = Math.random() < 0.5 ? "a" : "b";
    localStorage.setItem(AB_KEY, variant);
  }
} catch (e) { mode = "cdn"; variant = "a"; }

function ru() { return doc.documentElement.lang !== "en"; }

function sound(kind) {
  var s = g.RC_SOUND;
  if (!s) return;
  try {
    if (kind === "jump" && s.hyper) s.hyper();
    else if (s.uiConfirm) s.uiConfirm();
    else if (s.blip) s.blip(760, 0.12, "sine", 0.035);
  } catch (e) {}
}

function track(label) {
  if (!g.RC_track) return;
  try { g.RC_track("product", "vpn-" + variant + ":" + label); } catch (e) {}
}

function flight() { return doc.querySelector(".rc-flight"); }

function closeHolo() {
  var f = flight(), h = f && f.querySelector(".rc-vpn-holo");
  if (!h) return;
  h.classList.remove("on");
  f.classList.remove("rcf-vpn-open");
  setTimeout(function () { if (!h.classList.contains("on")) h.hidden = true; }, 280);
}

function openHolo() {
  ensureFlight();
  var f = flight(), h = f && f.querySelector(".rc-vpn-holo");
  if (!h) return;
  h.hidden = false;
  f.classList.add("rcf-vpn-open");
  requestAnimationFrame(function () { h.classList.add("on"); });
}

function paint() {
  root.setAttribute("data-product", mode);
  root.setAttribute("data-vpn-ab", variant);
  var buttons = doc.querySelectorAll(".js-vpn-mode");
  for (var i = 0; i < buttons.length; i++) {
    buttons[i].setAttribute("aria-pressed", mode === "vpn" ? "true" : "false");
    buttons[i].classList.toggle("on", mode === "vpn");
    var tx = buttons[i].querySelector("[data-vpn-label]");
    if (tx) {
      tx.textContent = mode === "vpn"
        ? (ru() ? "Вернуть Rocket CDN" : "Return to Rocket CDN")
        : (variant === "a"
          ? (ru() ? "Открыть RocketVPN" : "Open RocketVPN")
          : (ru() ? "Защищённый контур VPN" : "Secure VPN circuit"));
    }
  }
  var status = doc.querySelectorAll("[data-vpn-status]");
  for (i = 0; i < status.length; i++) {
    status[i].textContent = mode === "vpn"
      ? (ru() ? "КОНТУР VPN ВЫБРАН" : "VPN CIRCUIT SELECTED")
      : (ru() ? "КОНТУР CDN АКТИВЕН" : "CDN CIRCUIT ACTIVE");
  }
}

function setMode(next, source, show) {
  next = next === "vpn" ? "vpn" : "cdn";
  if (glitchT) clearTimeout(glitchT);
  root.classList.remove("rc-product-glitch");
  void root.offsetWidth;
  root.classList.add("rc-product-glitch");
  glitchT = setTimeout(function () { root.classList.remove("rc-product-glitch"); }, 680);

  mode = next;
  try { localStorage.setItem(MODE_KEY, mode); } catch (e) {}
  paint();
  sound(mode === "vpn" ? "jump" : "confirm");
  track((source || "switch") + "-" + mode);
  try {
    dispatchEvent(new CustomEvent("rc:product", {
      detail: { product: mode, source: source || "switch", variant: variant }
    }));
  } catch (e2) {}

  if (mode === "vpn" && show !== false) openHolo();
  else if (mode === "cdn") closeHolo();
}

function toggle(source) {
  setMode(mode === "vpn" ? "cdn" : "vpn", source, true);
}

function ensureDrawer() {
  var d = doc.getElementById("drawer");
  if (!d || d.querySelector(".rc-vpn-entry")) return;
  var b = doc.createElement("button");
  b.type = "button";
  b.className = "rc-vpn-entry js-vpn-mode";
  b.innerHTML =
    '<span class="rc-vpn-entry-mark"><img src="assets/rocketvpn-logo.webp" alt="" aria-hidden="true" width="48" height="48" loading="lazy" decoding="async"></span>' +
    '<span><b>RocketVPN</b><i data-vpn-label></i></span>' +
    '<em aria-hidden="true"></em>';
  var tools = d.querySelector(".drawer-tools");
  d.insertBefore(b, tools || null);
}

function ensureFlight() {
  var f = flight();
  if (!f || f.querySelector(".rc-vpn-projector")) return;

  var p = doc.createElement("button");
  p.type = "button";
  p.className = "rc-vpn-projector js-vpn-mode";
  p.setAttribute("aria-label", ru() ? "Переключить голограмму Rocket CDN на RocketVPN" : "Switch Rocket CDN hologram to RocketVPN");
  p.innerHTML =
    '<span class="rc-vpn-projector-scan" aria-hidden="true"></span>' +
    '<img src="assets/rocketvpn-logo.webp" alt="" width="128" height="128" decoding="async">' +
    '<b data-vpn-status></b>';
  f.appendChild(p);

  var h = doc.createElement("section");
  h.className = "rc-vpn-holo";
  h.hidden = true;
  h.setAttribute("role", "dialog");
  h.setAttribute("aria-modal", "false");
  h.setAttribute("aria-label", "RocketVPN");
  h.innerHTML =
    '<div class="rc-vpn-holo-in">' +
      '<button type="button" class="rc-vpn-x" aria-label="' + (ru() ? "Закрыть" : "Close") + '">×</button>' +
      '<div class="rc-vpn-brand"><img src="assets/rocketvpn-logo.webp" alt="RocketVPN" width="128" height="128">' +
        '<span><i>SECURE RELAY / RC-VPN</i><b>RocketVPN</b><u data-vpn-status></u></span></div>' +
      '<div class="rc-vpn-grid">' +
        '<span><i>' + (ru() ? "МАРШРУТ" : "ROUTE") + '</i><b>' + (ru() ? "автовыбор" : "automatic") + '</b></span>' +
        '<span><i>' + (ru() ? "КОНТУР" : "CIRCUIT") + '</i><b>' + (ru() ? "изолирован" : "isolated") + '</b></span>' +
        '<span><i>' + (ru() ? "СТАТУС" : "STATUS") + '</i><b class="ok">' + (ru() ? "готов" : "ready") + '</b></span>' +
      '</div>' +
      '<p>' + (ru()
        ? "Тот же корабельный интерфейс, другой маршрут трафика. Режим RocketVPN встроен в проект как отдельный защищённый контур без подмены кабины."
        : "The same cockpit, a different traffic route. RocketVPN is integrated as a secure circuit without replacing the cabin.") + '</p>' +
      '<div class="rc-vpn-actions">' +
        '<a href="https://rocketvpn.top" target="_blank" rel="noopener">' + (ru() ? "Открыть RocketVPN" : "Open RocketVPN") + '</a>' +
        '<a href="https://t.me/rocket_cdn_bot?start=contest" target="_blank" rel="noopener">' + (ru() ? "Розыгрыш · пригласить друзей" : "Giveaway · invite friends") + '</a>' +
        '<button type="button" class="js-vpn-back">' + (ru() ? "Вернуть контур CDN" : "Return to CDN") + '</button>' +
      '</div>' +
    '</div>';
  f.appendChild(h);

  h.querySelector(".rc-vpn-x").addEventListener("click", closeHolo);
  h.querySelector(".js-vpn-back").addEventListener("click", function () {
    setMode("cdn", "hologram", false);
  });
  paint();
}

function bind() {
  ensureDrawer();
  ensureFlight();
  paint();

  doc.addEventListener("click", function (e) {
    var b = e.target.closest ? e.target.closest(".js-vpn-mode") : null;
    if (!b) return;
    e.preventDefault();
    toggle(b.classList.contains("rc-vpn-projector") ? "cockpit" : "drawer");
  });

  /* Полёт строится лениво и пересобирается при смене языка. Поэтому
     наблюдатель остаётся активным: ensureFlight() идемпотентен, а
     потерянный после relang проектор восстанавливается автоматически. */
  if (g.MutationObserver) {
    var mo = new MutationObserver(function () {
      if (!flight()) return;
      ensureFlight();
    });
    mo.observe(doc.body, { childList: true, subtree: true });
  }

  doc.addEventListener("rc:lang", function () {
    /* Сам полёт при смене языка пересобирается. Новый экземпляр
       получит корректные строки; меню обновляем сразу. */
    var old = doc.querySelector(".rc-vpn-entry");
    if (old) old.parentNode.removeChild(old);
    ensureDrawer();
    ensureFlight();
    paint();
  });
}

g.RC_VPN = {
  mode: function () { return mode; },
  set: function (v) { setMode(v, "api", true); },
  open: openHolo,
  variant: function () { return variant; }
};

if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", bind);
else bind();

})(window);
