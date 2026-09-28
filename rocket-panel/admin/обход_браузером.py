#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Обход админки настоящим браузером: все разделы, все пункты меню.

## Зачем он есть

28.09.2026 владелец сказал «админка легла и не открывается». Проверка
кодом ответа на это отвечала 200, тесты на разметку были зелёные, а
панель действительно не работала. Оба способа врали, и каждый по-своему:

  * **код ответа** видит, что сервер отдал страницу, и не видит, что
    скрипт на ней упал на первом же обращении к серверу;
  * **тест на разметку** видит кнопку и не видит, что нажатие на неё
    не делает ничего.

За тот день так потерялось пять вещей, и все одного рода: разметка
цела, код пропал. `взять` и `послать` (сорок вызовов на двоих),
`столбики` и `полосы` (графики сводки), обработчик бургера, слушатель
смены раздела. Панель при этом выглядела живой.

Браузер видит то же, что владелец: упавший скрипт, пустой раздел,
мёртвую кнопку.

## Как запускать

Имена переменных латиницей нарочно: bash не берёт кириллицу в
имени переменной и падает невнятным «command not found».

    python3 обход_браузером.py                       по умолчанию
    ADMIN_PASS=... python3 обход_браузером.py         с паролем
    ADMIN_URL=https://... ADMIN_PASS=... python3 обход_браузером.py

Код возврата 1, если нашлась хоть одна беда: годится для предстартовой
проверки.
"""
import asyncio
import json
import os
import sys
import urllib.parse

from playwright.async_api import async_playwright

АДРЕС = os.environ.get("ADMIN_URL", "https://62-112-10-168.nip.io")
ЛОГИН = {"username": os.environ.get("ADMIN_USER", "amberry"),
         "password": os.environ.get("ADMIN_PASS", "")}
БРАУЗЕР = os.environ.get("PW_CHROMIUM", "/opt/pw-browsers/chromium")

РАЗДЕЛЫ = ["сводка", "люди", "оплаты", "работы", "поддержка", "рассылка",
           "услуги", "франшиза", "каталог", "реклама", "прайс", "сервисы",
           "запрет", "фото"]

# Разделы, которые живут в рамке: их содержимое считается внутри неё.
# Без этого «Каталог» выглядел пустым - innerText секции внутрь рамки
# не заглядывает, и обход ругался на исправный раздел.
В_РАМКЕ = {"каталог": "/каталог"}

# Ниже этого числа знаков раздел считается пустым. Тридцать, потому что
# у пустого остаётся только заголовок.
МИНИМУМ = 30


async def главное():
    беды, сводка = [], {}
    async with async_playwright() as п:
        бр = await п.chromium.launch(
            executable_path=БРАУЗЕР,
            args=["--no-sandbox", "--ignore-certificate-errors"])
        # Узкое окно нарочно: владелец открывает панель с телефона, и
        # меню там сдвинуто за край экрана. Бургер на широком окне не
        # нужен вовсе, и его поломка осталась бы незамеченной.
        к = await бр.new_context(http_credentials=ЛОГИН,
                                 ignore_https_errors=True,
                                 viewport={"width": 430, "height": 900})
        стр = await к.new_page()

        ошибки = []
        стр.on("console", lambda с: ошибки.append(с.text)
               if с.type == "error" else None)
        стр.on("pageerror", lambda e: ошибки.append(str(e)))
        стр.on("response", lambda о: ошибки.append(f"{о.status} {о.url}")
               if о.status >= 400 else None)

        await стр.goto(АДРЕС, wait_until="networkidle", timeout=60000)
        await стр.wait_for_timeout(1500)
        if ошибки:
            беды.append(f"при загрузке: {ошибки[:2]}")

        # --- бургер: на телефоне без него меню не открыть вовсе
        было = await стр.evaluate(
            "document.body.classList.contains('меню_открыто')")
        await стр.click("#бургер", force=True)
        await стр.wait_for_timeout(400)
        if было == await стр.evaluate(
                "document.body.classList.contains('меню_открыто')"):
            беды.append("бургер не открывает меню")

        пункты = await стр.evaluate(
            "[...document.querySelectorAll('.меню a')].map(a=>a.dataset.к)")
        нет = [р for р in РАЗДЕЛЫ if р not in пункты]
        if нет:
            беды.append(f"нет пунктов меню: {нет}")

        for р in РАЗДЕЛЫ:
            ошибки.clear()
            # Жмём настоящий пункт меню, а не подменяем адрес: владелец
            # жалуется именно на нажатие, подмена адреса эту беду обходит.
            await стр.evaluate("document.body.classList.add('меню_открыто')")
            await стр.wait_for_timeout(250)
            try:
                await стр.click(f".меню a[data-к='{р}']", timeout=15000)
            except Exception as e:                      # noqa: BLE001
                беды.append(f"{р}: пункт меню не нажимается ({str(e)[:60]})")
                continue
            await стр.wait_for_timeout(2200)

            видно = await стр.evaluate(
                f"!!document.querySelector('#р_{р}')?.classList.contains('тут')")
            if р in В_РАМКЕ:
                знаков = 0
                for рамка in стр.frames:
                    # Адрес рамки приходит в процентной кодировке
                    # (`/%D0%BA%D0%B0...` вместо `/каталог`), и прямое
                    # сравнение не сходится - раздел выглядел пустым.
                    адрес = urllib.parse.unquote(рамка.url)
                    if адрес.endswith(В_РАМКЕ[р]):
                        знаков = max(знаков, await рамка.evaluate(
                            "document.body.innerText.trim().length"))
            else:
                знаков = await стр.evaluate(
                    f"(document.querySelector('#р_{р}')?.innerText||'')"
                    ".trim().length")

            сводка[р] = {"видно": видно, "знаков": знаков,
                         "ошибок": len(ошибки)}
            if not видно:
                беды.append(f"{р}: раздел не показывается")
            if ошибки:
                беды.append(f"{р}: {ошибки[:2]}")
            if знаков < МИНИМУМ:
                беды.append(f"{р}: раздел пустой ({знаков} знаков)")

        await бр.close()

    print(json.dumps(сводка, ensure_ascii=False, indent=1))
    if беды:
        print("\n=== БЕДЫ")
        for б in беды:
            print("  -", б)
    else:
        print(f"\n=== БЕД НЕТ: {len(РАЗДЕЛЫ)} разделов, ошибок скрипта ноль")
    return 1 if беды else 0


if __name__ == "__main__":
    if not ЛОГИН["password"]:
        sys.exit("нет пароля: ADMIN_PASS=... python3 обход_браузером.py")
    sys.exit(asyncio.run(главное()))
