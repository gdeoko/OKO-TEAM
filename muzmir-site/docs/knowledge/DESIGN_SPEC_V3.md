# DESIGN SPEC V3 — КЦ «Музыкальный Мир» (единый контракт для всех агентов)

Цель: сайт-«приложение будущего». Светлая премиум-тема ПО УМОЛЧАНИЮ + тёмная по кнопке. Много моушена,
3D, инфографики, плавности. Идеальная адаптация (mobile-first, без обрезаний/переносов). Без эмодзи в UI — только SVG.

## Темы (CSS-переменные в :root = СВЕТЛАЯ по умолчанию; [data-theme="dark"] = тёмная)
СВЕТЛАЯ (база, по ТЗ):
--bg:#FFFCF5; --bg-2:#FFF8E1; --panel:rgba(255,255,255,.72); --panel-solid:#fff; --parchment:#F9F2E4;
--text:#1B2340; --text-dim:#4a4636; --muted:#6a6353;
--gold:#C9A84C; --gold-2:#B8973B; --gold-deep:#8B6F1F; --gold-ink:#7a5e18; --cta:#C8A147;
--grad-gold:linear-gradient(135deg,#E6C766,#C9A84C 45%,#8B6F1F);
--line:rgba(139,111,31,.16); --glass-brd:rgba(201,168,76,.28);
--mint:#8FBC94; --peach:#F5C89C; --error:#C85757; --warning:#E0A946; --info:#5A7A9E;
ТЁМНАЯ ([data-theme="dark"]) — как сейчас: --bg:#0b0a0d; --bg-2:#121016; --text:#F3ECDA; --gold:#E8C25A; и т.д. (сохранить текущую тёмную палитру).
Кнопка темы: «+» добавляет тёмную (иконка луна/солнце), localStorage 'muzmir-theme', ДЕФОЛТ 'light'.

## Шрифты (Google Fonts, кириллица)
--ff-display:"Playfair Display",Georgia,serif;   /* крупные заголовки h1/h2 */
--ff-serif:"Playfair Display",serif;             /* подзаголовки h3 */
--ff-body:"Manrope",system-ui,sans-serif;        /* текст */
--ff-script:"Marck Script",cursive;              /* акцентные подписи, эйброу-росчерки, диплом-стиль */
Подключение: один <link> Playfair Display(400..900)+Manrope(400..800)+Marck+Script в layout, preconnect. Убрать @import из CSS.

## Анимированный фон (глобальный, за контентом, z-index:0, pointer-events:none)
Компонент `.bg-fx` в layout (fixed, inset:0). Реализация в app.js (Canvas 2D, GPU-friendly, rAF, reduced-motion off):
- Слой 1: плавающие ноты/звёзды (золотые, полупрозрачные, медленный дрейф).
- Слой 2: мягкие движущиеся glow-orbs (радиальные золотые пятна, параллакс на скролл/мышь).
- Слой 3: тонкая линованная нотная сетка с маской (едва видна).
Светлая тема — тёплое золото на кремовом; тёмная — золото на чёрном. Производительно (≤60fps, off на prefers-reduced-motion и на маломощных — проверять hardwareConcurrency).

## Ключевые компоненты (классы — использовать эти имена во ВСЕХ страницах)
- Кнопки: `.btn .btn--primary`(gradient gold), `.btn--ghost`, `.btn--lg`, `.btn--block`, `.btn:active` press, `.btn.is-loading`+`.spinner`.
- Карточки: `.card`(стекло+золотая рамка через ::before), `.card--3d`(tilt на hover:hover), `.card:hover` подъём.
- Сетки: `.grid .grid-2 .grid-3 .grid-4` (адаптив: 3/4→2 на ≤960, →1 на ≤640).
- Секции: `.section`, `.section--tint`, `.section-head`(eyebrow+h2+gold-rule), `.eyebrow`(Marck Script росчерк), `.gold-rule`.
- Инфографика: `.stat`(счётчик), `.stat-ring`(SVG-кольцо прогресса), `.bar`(горизонт. прогресс), `.kpi`(карточка-метрика с дельтой), `.timeline`(вертикальная веха), `.donut`(SVG), `.map-heat`(регионы). Анимация появления по IntersectionObserver.
- Значки: `.badge--open`(mint,дышит), `.badge--closed`(error), `.badge--intl`(gold), `.badge--judging`(warning).
- Формы: `.field`,`.field.error`,`.err-msg`,floating-label, focus-кольцо; `input,select,textarea` стекло; `color-scheme:light dark`.
- Аккордеон: `.acc-item .acc-q(button,aria-expanded) .acc-a` (grid-template-rows 0fr→1fr).
- Ленты/хиро: `.hero`(градиент+bg-fx поверх), `.hero-logo`(float), `.hero h1`(Playfair, gold-clip), `.hero-cta`.
- Нижний appnav (моб): `.appnav`+`.appnav-ind`(активная пилюля). Sticky-хедер `.header.scrolled`.
- Тосты `.toast(.--success/.--error)`, skeleton `.skeleton`(shimmer), reading-progress `.read-progress`.
- Модалка входа: `.auth-modal`(overlay+card), кнопки `.auth-btn--vk .auth-btn--max .auth-btn--email .auth-btn--phone`.

## Моушен-принципы
Только transform/opacity, rAF, GPU. Каскад stagger детям сеток (--i*70ms). View Transitions на навигацию. Tilt/parallax только hover:hover. ВСЁ под prefers-reduced-motion (глобальный kill-switch сохранить). Плавно, дорого, не «цирк».

## Регистрация/вход (1 клик, при входе на сайт)
Модалка `.auth-modal` появляется для гостя (можно закрыть, не навязчиво; повторно — кнопка «Войти»).
Способы: [ВК] и [MAX] — крупные быстрые кнопки сверху; ниже — [Почта] и [Телефон].
- ВК: OAuth (api/v1/oauth_vk.php уже есть — доработать: подтянуть имя+фото в users, добавить в subscribers).
- MAX: кнопка OAuth «Войти через MAX» (Max ID / VK-совместимый OAuth). Если креды не заданы в env — кнопка ведёт на инструкцию/выключена gracefully.
- Почта: email + пароль ИЛИ magic-link/OTP на почту.
- Телефон: ввод номера → OTP (если SMS-провайдер задан в env; иначе callback/скрытый код — graceful).
После регистрации: авто-создание users (имя, фото-URL), запись в subscribers(status='confirmed', source), редирект в /cabinet. Имя+фото показываются в кабинете и в шапке.

## Адаптация (жёстко)
Mobile-first 320px+. Никаких горизонтальных скроллов, обрезаний, кривых переносов. Тап-таргет ≥44px.
Длинные слова/URL — overflow-wrap:anywhere. Таблицы — в .scroll-x. Меню — бургер ≤1180px + нижний appnav. Safe-area (iOS) везде (хедер, appnav, TMA). Проверять 320/360/390/768/1024/1440.

## Тон/правила (ТЗ)
«Вы» с заглавной; короткое тире «-» (НЕ «—»); кавычки «ёлочки»; без эмодзи в UI; без AI-лексики; директор Ильясов А.И. — указывать (по решению Даниэля); цены — на страницах конкурсов/наград можно. Бренд: официально-патриотичный, премиальный, музыкальный.
