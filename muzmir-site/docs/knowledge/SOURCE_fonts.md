# 🔤 ТИПОГРАФИКА

## Все шрифты — свободные (open-source), поддержка кириллицы

---

## 🎯 ОСНОВНЫЕ ШРИФТЫ

### 1. Playfair Display (Заголовки)
- **Стиль:** Serif, премиум, классический
- **Применение:** H1, H2, H3, названия конкурсов, дипломы
- **CDN:** `https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400..900;1,400..900&display=swap`
- **Локально:** скачать с Google Fonts
- **Веса:** 400, 500, 600, 700, 800, 900

**Пример CSS:**
```css
h1, h2, h3, .title {
    font-family: 'Playfair Display', Georgia, serif;
    font-weight: 700;
    color: var(--gold-dark);
}
```

---

### 2. Manrope (Основной текст)
- **Стиль:** Sans-serif, современный, читаемый
- **Применение:** body, кнопки, формы, навигация
- **CDN:** `https://fonts.googleapis.com/css2?family=Manrope:wght@200..800&display=swap`
- **Веса:** 300, 400, 500, 600, 700

**Пример CSS:**
```css
body, p, span, div, button, input {
    font-family: 'Manrope', 'Segoe UI', sans-serif;
    font-weight: 400;
    color: var(--navy);
    line-height: 1.6;
}
```

---

### 3. Marck Script (Рукописный)
- **Стиль:** Handwritten, элегантный
- **Применение:** цитаты, подписи на дипломах, слоганы
- **CDN:** `https://fonts.googleapis.com/css2?family=Marck+Script&display=swap`
- **Веса:** 400

**Пример CSS:**
```css
.signature, .quote {
    font-family: 'Marck Script', 'Georgia', cursive;
    font-size: 1.5em;
    color: var(--gold-dark);
}
```

---

## 📏 РАЗМЕРЫ (RESPONSIVE)

### Desktop (>= 1024px)
- H1: 48-64px
- H2: 36-48px
- H3: 24-32px
- H4: 20-24px
- Body: 16-18px
- Small: 14px
- Caption: 12px

### Tablet (768-1023px)
- H1: 36-48px
- H2: 28-36px
- H3: 22-28px
- Body: 16px

### Mobile (< 768px)
- H1: 28-36px
- H2: 24-28px
- H3: 20-24px
- Body: 15-16px

---

## 📐 CSS-ПЕРЕМЕННЫЕ

```css
:root {
    /* Размеры */
    --font-size-xs: 0.75rem;    /* 12px */
    --font-size-sm: 0.875rem;   /* 14px */
    --font-size-base: 1rem;     /* 16px */
    --font-size-lg: 1.125rem;   /* 18px */
    --font-size-xl: 1.25rem;    /* 20px */
    --font-size-2xl: 1.5rem;    /* 24px */
    --font-size-3xl: 2rem;      /* 32px */
    --font-size-4xl: 2.5rem;    /* 40px */
    --font-size-5xl: 3rem;      /* 48px */
    --font-size-6xl: 4rem;      /* 64px */

    /* Веса */
    --font-weight-light: 300;
    --font-weight-normal: 400;
    --font-weight-medium: 500;
    --font-weight-semibold: 600;
    --font-weight-bold: 700;
    --font-weight-extra: 800;

    /* Интерлиньяж */
    --line-height-tight: 1.2;
    --line-height-normal: 1.5;
    --line-height-relaxed: 1.75;
    --line-height-loose: 2;

    /* Межбуквенное расстояние */
    --letter-spacing-tight: -0.02em;
    --letter-spacing-normal: 0;
    --letter-spacing-wide: 0.05em;
    --letter-spacing-wider: 0.1em;
}
```

---

## 🎨 ПРАВИЛА ИСПОЛЬЗОВАНИЯ

1. **Заголовки** — только Playfair Display (крупные, торжественные)
2. **Текст** — только Manrope (комфортный для чтения)
3. **Подписи, цитаты, слоганы** — Marck Script (акцент)
4. **Числа и статистика** — Manrope Bold + увеличенный размер
5. **UPPERCASE только для мелких меток** (не для заголовков)
6. **Никакого CAPS в основных заголовках** — только Title Case

---

## 🖨️ ДЛЯ ДИПЛОМОВ (PDF)

Дипломы генерируются в PDF, шрифты встраиваются:
- **Название диплома** ("ДИПЛОМ", "ЛАУРЕАТ 1 степени"): Playfair Display Bold, 60px
- **ФИО**: Playfair Display Bold, 40px (или Marck Script для элегантности)
- **Основной текст**: Manrope, 18px
- **Номер и дата**: Manrope, 12px

---

## КОНЕЦ ФАЙЛА
