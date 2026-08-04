# EXORA — BRAND PACK

Официальный бренд-пак **Exora Crypto Exchange**.
Собран программно из мастер-логотипа A1 Aurora Liquid.

## Структура

```
logo/
  png/   exora-logo-{aurora,mint,white,black,mono-graphite}-{32,48,64,128,256,512,1024,2048}.png
         exora-logo-{on-white,on-black}-{512,1024,2048}.png            — с фоном для лockup
  jpg/   exora-logo-*-*.jpg                                            — flatten на белый, для email/веб-редакторов
  svg/   exora-logo-{aurora,mint,white,black,mono-graphite}.svg        — embedded raster (для веб/print)
         exora-logo-{...}-vector.svg                                   — true vector (потрайс), для favicon/print
  pdf/   exora-logo-{aurora,mint,white,black,mono-graphite}.pdf        — вектор в PDF, для типографии
         exora-logo-{on-white,on-black}.pdf                            — с фоном
  ico/   exora-logo-{цвет}.ico  favicon.ico                            — multi-size (16/32/48/64/128/256)

vector/
  exora-logo.svg / .pdf / -1024.png                                    — основной логотип (aurora)
  exora-logo-on-black.svg / .pdf / -1024.png                           — версия для тёмного фона

BRAND_PREVIEW.html                                                     — открой в браузере — все варианты
```

## Цвета бренда

| Название         | HEX       | Применение |
|------------------|-----------|-----------|
| **Aurora**       | multi-grad `#5ED29C→#3FBF86→#5AC8FF→#A78BFA` | Основной логотип |
| **Mint**         | `#5ED29C`  | Акцентный цвет UI, CTA-кнопки, ссылки |
| **Mint dark**    | `#3FBF86`  | Тени и hover-состояния |
| **Dark**         | `#062018`  | Текст на mint-плитке, лого на светлом фоне |
| **Void**         | `#04070E`  | Основной фон приложения, wallpaper |
| **White**        | `#FFFFFF`  | Логотип на тёмном фоне |
| **Graphite**     | `#2B3540`  | Monochrome-версия для документов |

## Как выбрать вариант

- **aurora** — везде, где показывается основной логотип (сайт, mini-app, соцсети, презентации).
- **mint** — сплошная mint-заливка. Для монохромных применений, где нельзя градиент (гравировка, печать 1 цветом).
- **white** — только на тёмном фоне.
- **black** — только на светлом фоне (документы, счета, письма на белой бумаге).
- **mono-graphite** — приглушённый чёрно-серый для нейтральных документов.
- **on-white / on-black** — logo с уже вставленным фоном, для случаев где нужна flat plate (наклейки, значки, printing).

## Формат — под задачу

| Формат | Применение |
|---|---|
| **SVG** | Веб (favicon, сайт, mini-app), печать (плоттер, гравировка), Figma/Sketch |
| **PNG** | Соцсети, презентации, email, WordPress, любые растровые задачи |
| **JPG** | Email-подписи, WhatsApp/Telegram, где нужен фон (не поддерживают прозрачность) |
| **PDF** | Типография, полиграфия (визитки, буклеты, ролл-апы), AutoCAD, Illustrator |
| **ICO** | Favicon на сайте (favicon.ico в корне) |

## Размеры PNG — под задачу

- `32/48` — favicon, Slack/Discord, мелкие иконки в чатах
- `64/128` — reply-клавиатура Telegram, миниатюры
- `256` — карточки соцсетей, аватар канала
- `512/1024` — обложки, презентации, App Store icons
- `2048` — печать, широкоформатные баннеры, retina displays

## Правила использования

1. **Не искажать пропорции** — только пропорциональное масштабирование.
2. **Не перекрашивать** вне утверждённого набора цветов.
3. **Минимальный размер** — 32px по короткой стороне (favicon работает от 16px).
4. **Отступ безопасной зоны** — 12% от размера логотипа со всех сторон.
5. **Не помещать** на пёстрый / контрастный фон, где логотип теряется. Используйте `on-white` / `on-black` версии.
6. **Не добавлять** тени, обводки, эффекты поверх — логотип уже финализирован.

## Как использовать в приложении

- **Telegram bot avatar**: `logo/png/exora-logo-aurora-512.png`
- **Веб favicon**: `logo/ico/favicon.ico` + `logo/svg/exora-logo-aurora-vector.svg`
- **Mini-app иконка**: `logo/png/exora-logo-aurora-256.png`
- **Обложка канала**: `logo/png/exora-logo-on-black-2048.png`
- **Печать / визитки**: `logo/pdf/exora-logo-aurora.pdf`

---

Exora Crypto Exchange · 2026 · концепт A1 Aurora Liquid
