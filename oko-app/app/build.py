#!/usr/bin/env python3
"""Сборка OKO APP: split-bundle (index.html + app.js + app.css) с аналитикой.

Что делает:
- prototype/index.html — критичный шелл: base.html + screens + overlays + <head>-инъекции
  (аналитика, preload, lazy-загрузчик app.js/app.css). НЕ трогает base.html — все
  правки идут через chain-patch на финальном HTML.
- prototype/app.js     — весь модульный JS (defer, off-critical-path).
- prototype/app.css    — весь модульный CSS (non-blocking через media=print + onload).

Аналитика — три сервиса, единая точка вызова window.okoTrack(event, props):
  - Yandex Metrika (goals: reachGoal)
  - Amplitude (product analytics: track)
  - Sentry (breadcrumbs + JS error tracking)
Ключи-плейсхолдеры (YOUR_YMK_ID / YOUR_AMPLITUDE_API_KEY / YOUR_SENTRY_DSN) — Даниэль
подменит на VPS (см. site/config.example.php: ymk_id / amplitude_key / sentry_dsn).

Auto-track (через chain-patch собранного JS + monkey-patch в bootstrap):
  page_view — обёртка над showTab (bootstrap)
  sign_up   — hook в regSave() (chain-patch)
  lesson_complete — hook в acG.done=true (chain-patch)
  purchase  — hook в payLavaOpen() (chain-patch)
  share     — monkey-patch над navigator.share (bootstrap)

Модуль = папка app/modules/<name>/ с файлами (все необязательные):
  style.css    -> в app.css в порядке ORDER
  screen.html  -> перед </main> в index.html
  overlay.html -> перед supabase-скриптом в index.html
  script.js    -> в app.js в порядке ORDER
"""
import os, sys, re

HERE = os.path.dirname(os.path.abspath(__file__))
OUT_DIR = os.path.join(HERE, '..', 'prototype')
OUT_HTML = os.path.join(OUT_DIR, 'index.html')
OUT_JS = os.path.join(OUT_DIR, 'app.js')
OUT_CSS = os.path.join(OUT_DIR, 'app.css')

ORDER = [
    'core-ext',        # кошелёк-ядро, i18n-ядро, попапы, печать, verified, admin-auth
    'registration',    # полная регистрация + попапы онбординга
    'wallet',          # экран кошелька / лицевой счёт
    'games',           # игры: рулетка + дорога
    'academy-content', # академия: контент-пак уроков (window.AC_PACK) — ДО academy
    'academy-enrich',  # академия: обогащение уроков (window.AC_ENRICH) — ДО academy
    'academy',         # академия: уроки, тесты, сертификаты
    'academy-plus',    # академия+: ленивые блоки, таймлайн, XP, заметки, комменты, рек-система
    'ads',             # рекламный кабинет
    'legal',           # юр-документы RU/EN
    'verify-stickers', # верификация + стикеры/TON-эмодзи
    'i18n-settings',   # язык в настройках + переводы хрома
    'admin-hq',        # HQ-окно и расширение админки
    'market-pro',      # биржа: кабинет продавца + пакеты услуг OKO
    'feed-algo',       # алгоритмы рекомендаций ленты по интересам
    'demo-content',    # живое наполнение: чаты, каналы, сторис
    'chats-plus',      # мессенджер+: статусы, поиск, закреп, скорость голосовых
    'calls',           # звонки: групповая конференция + личный
    'profile-social',  # чужие профили, подписки, соцграф
    'stories-plus',    # редактор сторис, просмотры
    'settings-plus',   # настройки: сессии, уведомления, кэш, аккаунт
    'notifs-plus',     # центр уведомлений: чипы-фильтры, свайп-действия
    'tour',            # интерактивный тур по приложению
    'navstack',        # единый стек навигации: назад везде
    'tg-webapp',       # интеграция Telegram Mini App (@okoappbot)
    'pwa',             # установка на главный экран + service worker
    'paywall',         # locked-функции, паволлы, триггеры подписки
    'partner-plus',    # партнёрка: уровни, лидерборд, промо, дип-линки
    'channels',        # платные каналы/курсы с комиссией 10%
    'ui-chrome',       # глобальный хром: шапка/навигация/safe-area/полировка
    'wow-eye',         # интерактивный 3D-стеклянный глаз на auth-экране
    'wow-motion',      # финальный вау-пак: типографика, моушен, микро-интеракции
    'viral',           # виральные механики шеринга (/u/@username, sharable сертификаты, reels-цитаты, weekly-story, серия шеринга) — патчит академию/партнёрку/игры/ленту, поэтому грузится ПОСЛЕ них
]

# ===== аналитика: три сервиса + единая обёртка window.okoTrack =====
# Ключи-плейсхолдеры — Даниэль подменит на VPS (config.php: ymk_id/amplitude_key/sentry_dsn).
ANALYTICS_HEAD = r"""<!-- ============ OKO ANALYTICS (Yandex Metrika + Amplitude + Sentry) ============ -->
<script>
window.OKO_ANALYTICS = window.OKO_ANALYTICS || {
  ymk: 'YOUR_YMK_ID',
  amp: 'YOUR_AMPLITUDE_API_KEY',
  sentry: 'YOUR_SENTRY_DSN'
};
window.okoTrack = function(event, props){
  try{ window.ym && ym(window.OKO_ANALYTICS.ymk, 'reachGoal', event, props||{}); }catch(e){}
  try{ window.amplitude && amplitude.track && amplitude.track(event, props||{}); }catch(e){}
  try{ window.Sentry && Sentry.addBreadcrumb && Sentry.addBreadcrumb({category:'oko', message:event, level:'info', data:props||{}}); }catch(e){}
};
/* Yandex Metrika (загружает mc.yandex.ru асинхронно) */
(function(m,e,t,r,i,k,a){m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};m[i].l=1*new Date();for(var j=0;j<document.scripts.length;j++){if(document.scripts[j].src===r){return;}}k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)})(window,document,'script','https://mc.yandex.ru/metrika/tag.js','ym');
try{ ym(window.OKO_ANALYTICS.ymk, 'init', {clickmap:true,trackLinks:true,accurateTrackBounce:true,webvisor:true}); }catch(e){}
</script>
<script async src="https://cdn.amplitude.com/libs/analytics-browser-2.0.0-min.js.gz"
  onload="try{window.amplitude && amplitude.init(window.OKO_ANALYTICS.amp);}catch(e){}"></script>
<script async src="https://browser.sentry-cdn.com/7.x/bundle.min.js" crossorigin="anonymous"
  onload="try{window.Sentry && Sentry.init({dsn:window.OKO_ANALYTICS.sentry, tracesSampleRate:0.1});}catch(e){}"></script>
"""

# ===== preload / preconnect критических ресурсов =====
PRELOAD_HEAD = r"""<!-- ============ OKO CRITICAL PRELOAD ============ -->
<link rel="preload" href="oko-logo-512.png" as="image">
<link rel="preconnect" href="https://okoteam.top">
<link rel="dns-prefetch" href="https://api.telegram.org">
<link rel="dns-prefetch" href="https://mc.yandex.ru">
<link rel="dns-prefetch" href="https://cdn.amplitude.com">
<link rel="dns-prefetch" href="https://browser.sentry-cdn.com">
<link rel="preload" as="script" href="app.js">
<link rel="preload" as="style" href="app.css">
"""

# ===== bootstrap-loader: подгрузка app.css / app.js вне критического пути + monkey-patch =====
BOOTSTRAP_LOADER = r"""<!-- ============ OKO LAZY BUNDLE LOADER ============ -->
<link rel="stylesheet" href="app.css" media="print" onload="this.media='all'">
<noscript><link rel="stylesheet" href="app.css"></noscript>
<script defer src="app.js"></script>
<script>
/* Обёртки над встроенными в base.html функциями — для авто-трека page_view / share.
   showTab существует в inline-скрипте base.html, поэтому оборачиваем по мере
   готовности; navigator.share патчим сразу. */
(function(){
  try{
    if(navigator.share){
      var _origShare = navigator.share.bind(navigator);
      navigator.share = function(data){
        try{ window.okoTrack && okoTrack('share', {url:(data&&data.url)||location.href, title:(data&&data.title)||''}); }catch(e){}
        return _origShare(data);
      };
    }
  }catch(e){}
  var _tick = setInterval(function(){
    var doneTab = false, donePay = false;
    if(typeof window.showTab === 'function' && !window.showTab.__okoWrapped){
      var _orig = window.showTab;
      window.showTab = function(t){
        try{ window.okoTrack && okoTrack('page_view', {tab:t}); }catch(e){}
        return _orig.apply(this, arguments);
      };
      window.showTab.__okoWrapped = true;
    }
    if(typeof window.showTab === 'function' && window.showTab.__okoWrapped) doneTab = true;

    if(typeof window.payLavaOpen === 'function' && !window.payLavaOpen.__okoWrapped){
      var _origPay = window.payLavaOpen;
      window.payLavaOpen = function(){
        try{
          window.okoTrack && okoTrack('purchase', {
            method:'lava',
            product:(typeof window.payState!=='undefined' && window.payState && window.payState.product)||''
          });
        }catch(e){}
        return _origPay.apply(this, arguments);
      };
      window.payLavaOpen.__okoWrapped = true;
    }
    if(typeof window.payLavaOpen === 'function' && window.payLavaOpen.__okoWrapped) donePay = true;

    if(doneTab && donePay) clearInterval(_tick);
  }, 50);
  setTimeout(function(){ clearInterval(_tick); }, 10000);
})();
</script>
"""

# ===== A11y-полировка: focus-visible + prefers-reduced-motion =====
A11Y_CSS = r"""/* ============ OKO A11Y polish ============ */
button:focus-visible,a:focus-visible,input:focus-visible,textarea:focus-visible,select:focus-visible,[role="button"]:focus-visible,[tabindex]:focus-visible{
  outline:2px solid var(--lime,#9AFF00);outline-offset:2px;border-radius:6px
}
@media (prefers-reduced-motion:reduce){
  *,*::before,*::after{animation-duration:.01ms!important;animation-iteration-count:1!important;transition-duration:.01ms!important;scroll-behavior:auto!important}
}
"""

def read(p):
    with open(p, encoding='utf-8') as f:
        return f.read()

def write(p, s):
    os.makedirs(os.path.dirname(p), exist_ok=True)
    with open(p, 'w', encoding='utf-8') as f:
        f.write(s)

def collect(kind):
    parts = []
    for name in ORDER:
        p = os.path.join(HERE, 'modules', name, kind)
        if os.path.exists(p):
            parts.append(f'\n/* ===== module: {name} ===== */\n' if kind.endswith(('.css', '.js'))
                         else f'\n<!-- ===== module: {name} ===== -->\n')
            parts.append(read(p))
    return ''.join(parts)

def patch_analytics_calls(js):
    """Chain-patch: вставляет okoTrack(...) в известные триггеры внутри собранного app.js."""
    # sign_up: обёртка над regSave() (модуль registration)
    old_regsave = "function regSave(data){ try{ localStorage.setItem('oko-registration', JSON.stringify(data)); }catch(e){} }"
    new_regsave = ("function regSave(data){ try{ localStorage.setItem('oko-registration', JSON.stringify(data)); }catch(e){}"
                   " try{ window.okoTrack && okoTrack('sign_up', {method:(data&&data.method)||'unknown', at:Date.now()}); }catch(e){} }")
    if old_regsave in js:
        js = js.replace(old_regsave, new_regsave, 1)

    # lesson_complete: мини-игра пройдена (модуль academy, acG.done=true в acBucketCheck)
    old_ac = "acG.done = true;\n  acRenderBucket(document.getElementById('acGameBox'));"
    new_ac = ("acG.done = true;\n  acRenderBucket(document.getElementById('acGameBox'));\n"
              "  try{ window.okoTrack && okoTrack('lesson_complete', {group:(typeof acG!=='undefined'&&acG.k)||'', wrong:(typeof acG!=='undefined'?acG.wrong:null)}); }catch(e){}")
    if old_ac in js:
        js = js.replace(old_ac, new_ac, 1)

    # purchase: payLavaOpen() определён в base.html — оборачиваем monkey-patch'ем в bootstrap.

    return js

def patch_html_a11y(html):
    """A11y: alt="" на <img> без alt, role=button+tabindex на кликабельных div/span.
    Работает ТОЛЬКО вне <script>...</script>, чтобы не портить JS-строки."""
    parts = re.split(r'(<script[^>]*>[\s\S]*?</script>)', html)
    for i in range(0, len(parts), 2):  # чётные — не-скрипт
        # <img> без alt
        parts[i] = re.sub(
            r'<img((?![^>]*\balt=)[^>]*?)/?>',
            r'<img\1 alt="">',
            parts[i]
        )
        # <div|span> с onclick без role -> role="button" tabindex="0"
        parts[i] = re.sub(
            r'<(div|span)((?![^>]*\brole=)(?=[^>]*\bonclick=)[^>]*?)>',
            r'<\1\2 role="button" tabindex="0">',
            parts[i]
        )
        # icon-only <button> (нет текста, только <svg>) — aria-label из title/data-label,
        # либо, если ничего нет, generic "Кнопка". Ищем <button ...><svg .../> ... </button>
        # без aria-label и без текста между тегами.
        def _btn_fix(m):
            attrs = m.group(1) or ''
            inner = m.group(2) or ''
            if 'aria-label' in attrs:
                return m.group(0)
            # Есть ли текст (не svg/use/path)?
            text = re.sub(r'<[^>]+>', '', inner).strip()
            if text:
                return m.group(0)
            # Пытаемся достать title=
            t = re.search(r'\btitle="([^"]+)"', attrs)
            label = t.group(1) if t else 'Кнопка'
            return f'<button{attrs} aria-label="{label}">{inner}</button>'
        parts[i] = re.sub(r'<button([^>]*)>([\s\S]*?)</button>', _btn_fix, parts[i])
    return ''.join(parts)

def main():
    out_html = sys.argv[1] if len(sys.argv) > 1 else OUT_HTML
    # если пользователь передал кастомный путь под index.html — кладём app.js/css рядом
    if out_html != OUT_HTML:
        out_dir = os.path.dirname(out_html) or '.'
        out_js = os.path.join(out_dir, 'app.js')
        out_css = os.path.join(out_dir, 'app.css')
    else:
        out_js = OUT_JS
        out_css = OUT_CSS

    base = read(os.path.join(HERE, 'base.html'))
    css_mod = collect('style.css')
    js_mod = collect('script.js')
    screens = collect('screen.html')
    overlays = collect('overlay.html')
    ver = read(os.path.join(HERE, 'VERSION')).strip()

    # Chain-patch собранного JS: инъекция вызовов okoTrack в известные триггеры
    js_mod = patch_analytics_calls(js_mod)

    # Записываем внешние бандлы
    write(out_js, f"/* OKO app bundle v{ver} — modules, off-critical */\n{js_mod}")
    write(out_css, f"/* OKO app css v{ver} — modules, non-blocking */\n{css_mod}")

    # Собираем index.html из base.html + screens + overlays (модульные CSS/JS — вынесены)
    out = base
    out = out.replace('/* @MODULES:CSS */', '/* модульный CSS вынесен в app.css (lazy) */')
    out = out.replace('<!-- @MODULES:SCREENS -->', screens + '\n')
    out = out.replace('<!-- @MODULES:OVERLAYS -->', overlays + '\n')
    out = out.replace('/* @MODULES:JS */', '/* модульный JS вынесен в app.js (defer) */')

    # Инъекция в <head>: preload + аналитика + a11y-css + bootstrap-loader
    head_inject = (
        '\n' + PRELOAD_HEAD
        + '\n' + ANALYTICS_HEAD
        + '\n<style>\n' + A11Y_CSS + '</style>\n'
        + BOOTSTRAP_LOADER
    )
    out = out.replace('</head>', head_inject + '\n</head>', 1)

    # A11y-пасс: alt/role/tabindex/aria-label (только вне <script>)
    out = patch_html_a11y(out)

    # Версия сборки
    out = re.sub(r'сборка v[0-9.]+', f'сборка v{ver}', out)

    write(out_html, out)

    kb_html = len(out) // 1024
    kb_js = len(js_mod) // 1024
    kb_css = len(css_mod) // 1024
    total = kb_html + kb_js + kb_css
    print(f'OK -> v{ver}')
    print(f'  {out_html}   {kb_html} KB (critical shell, first paint)')
    print(f'  {out_js}     {kb_js} KB (modules JS, defer)')
    print(f'  {out_css}    {kb_css} KB (modules CSS, non-blocking)')
    print(f'  total {total} KB (было ~5700 KB одним файлом)')

if __name__ == '__main__':
    main()
