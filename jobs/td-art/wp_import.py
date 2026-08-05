#!/usr/bin/env python3
"""
Автоматический импорт 106 редиректов в td-art.ru (WP-плагин Redirection).

Использование:
  export TDART_LOGIN=admin
  export TDART_PASS='<новый рабочий пароль>'
  python3 wp_import.py            # прогон под ключ: логин → плагин → импорт → верификация
  python3 wp_import.py --dry-run  # только логин + разведка (проверить что пароль работает)

Логин делается через wp-login.php с cookie beget=begetok (иначе Beget шлёт JS-заглушку).
Хромиум — /opt/pw-browsers/chromium-1194/chrome-linux/chrome (уже в окружении).
Скриншоты на каждом шаге → shots/.
"""
import argparse, os, sys, time, subprocess
from pathlib import Path
from playwright.sync_api import sync_playwright, TimeoutError as PWTimeout

HERE = Path(__file__).parent
CSV = HERE / "redirection_plugin.csv"
SHOTS = HERE / "shots"
SHOTS.mkdir(exist_ok=True)
CHROME = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome"
SITE = "https://td-art.ru"
UA = "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"


def curl_verify(pilot_paths):
    """Быстрая проверка 301 через curl (у нас beget-cookie в порядке)."""
    print("\n[verify] curl -I по пилотным URL:")
    ok = 0
    for p in pilot_paths:
        r = subprocess.run(
            ["curl", "-sSI", "-b", "beget=begetok", "-m", "10", f"{SITE}{p}"],
            capture_output=True, text=True, timeout=15,
        )
        head = r.stdout.strip().split("\n")
        code = next((l.split()[1] for l in head if l.startswith("HTTP/2 ") or l.startswith("HTTP/1")), "?")
        loc = next((l.split(":", 1)[1].strip() for l in head if l.lower().startswith("location:")), "-")
        marker = "OK" if code == "301" and "design.td-art.ru" in loc else "FAIL"
        if marker == "OK": ok += 1
        print(f"  [{marker}] {code:4s}  {p:60s}  → {loc}")
    print(f"[verify] {ok}/{len(pilot_paths)} проходят как 301 на design.td-art.ru\n")
    return ok


def shot(page, name):
    p = SHOTS / f"{time.strftime('%H%M%S')}_{name}.png"
    page.screenshot(path=str(p), full_page=True)
    print(f"  📸 {p.name}")


def wait_and(page, selector, timeout=15000):
    page.wait_for_selector(selector, timeout=timeout)
    return page.locator(selector)


def login(page, user, pw):
    print(f"[login] {SITE}/wp-login.php as {user}…")
    # cookie beget=begetok уже стоит в ctx.add_cookies — ждём просто первый рендер
    for attempt in range(3):
        try:
            page.goto(f"{SITE}/wp-login.php", wait_until="load", timeout=25000)
            page.wait_for_selector("#user_login", timeout=15000)
            break
        except PWTimeout:
            print(f"[login] попытка {attempt+1}/3 — форма не появилась, перезагружаю…")
            try:
                page.reload(wait_until="load", timeout=25000)
            except Exception:
                pass
    else:
        print("[login] не удалось получить wp-login форму за 3 попытки")
        shot(page, "login_no_form")
        return False
    page.fill("#user_login", user)
    page.fill("#user_pass", pw)
    page.click("#wp-submit")
    try:
        page.wait_for_url("**/wp-admin/**", timeout=15000)
        print("[login] OK — попали в wp-admin")
        return True
    except PWTimeout:
        err = page.locator("#login_error").text_content(timeout=2000) if page.locator("#login_error").count() else ""
        print(f"[login] FAIL: {err.strip()[:200]}")
        shot(page, "login_fail")
        return False


def install_redirection(page):
    """Plugins → Add New → Search 'Redirection' → Install Now → Activate."""
    print("[plugin] проверяю установлен ли Redirection…")
    page.goto(f"{SITE}/wp-admin/plugins.php", wait_until="domcontentloaded")
    if page.locator("tr[data-slug='redirection']").count() > 0:
        row = page.locator("tr[data-slug='redirection']").first
        classes = row.get_attribute("class") or ""
        if "active" in classes:
            print("[plugin] Redirection уже активен ✓"); return True
        act = row.locator("a.edit").filter(has_text="Активировать") | row.locator("a").filter(has_text="Activate")
        if act.count():
            act.first.click(); page.wait_for_load_state("domcontentloaded")
            print("[plugin] Активирован ✓"); return True

    print("[plugin] ставлю с нуля через Add New…")
    page.goto(f"{SITE}/wp-admin/plugin-install.php?s=redirection&tab=search&type=term",
              wait_until="domcontentloaded")
    card = page.locator("div.plugin-card-redirection").first
    card.wait_for(timeout=20000)
    install_btn = card.locator("a.install-now")
    install_btn.click()
    # ждём смены кнопки Install → Activate
    activate = card.locator("a.activate-now")
    activate.wait_for(timeout=60000)
    activate.click()
    page.wait_for_url("**/wp-admin/**", timeout=30000)
    print("[plugin] Redirection установлен и активен ✓")
    return True


def skip_wizard(page):
    """Первый заход в Tools→Redirection показывает wizard. Пропускаем."""
    page.goto(f"{SITE}/wp-admin/tools.php?page=redirection.php", wait_until="domcontentloaded")
    time.sleep(2)
    # если wizard — есть кнопка "Начать настройку" / "Start Setup" / "Continue Setup"
    for label in ["Начать настройку", "Продолжить настройку", "Start Setup", "Continue Setup",
                  "Готово", "Finish Setup", "Finished! Ready to start"]:
        btn = page.locator(f"button:has-text('{label}'), a:has-text('{label}')")
        if btn.count():
            print(f"[wizard] click «{label}»")
            btn.first.click()
            time.sleep(3)


def import_csv(page):
    """Redirection → Import/Export → загрузить redirection_plugin.csv → Upload."""
    page.goto(f"{SITE}/wp-admin/tools.php?page=redirection.php&sub=io", wait_until="domcontentloaded")
    time.sleep(2)
    shot(page, "before_import")

    # найти input type=file
    file_input = page.locator("input[type='file']").first
    file_input.wait_for(timeout=15000)
    file_input.set_input_files(str(CSV))
    print(f"[import] выбран файл: {CSV.name} ({CSV.stat().st_size} байт)")

    # кнопка Upload / Загрузить
    for label in ["Upload", "Загрузить", "Импорт", "Import"]:
        btn = page.locator(f"button:has-text('{label}')")
        if btn.count():
            btn.first.click()
            break
    # ждём подтверждение "Imported N redirects"
    page.wait_for_selector("text=/import/i", timeout=60000)
    time.sleep(3)
    shot(page, "after_import")

    # получим счётчик из UI
    body = page.locator("body").text_content()[:2000]
    print(f"[import] UI ответ: {body[:400]}…")


def move_regex_to_end(page):
    """В списке редиректов regex catch-all `/(.*)` должен быть последним."""
    page.goto(f"{SITE}/wp-admin/tools.php?page=redirection.php", wait_until="domcontentloaded")
    time.sleep(2)
    # Скрин списка
    shot(page, "list_after_import")
    # Не двигаем автоматически (drag через Playwright хрупок в React-UI Redirection).
    # Просто фиксируем — regex-строку /(.*) видно в списке.
    rows = page.locator("tr.status-enabled")
    print(f"[list] активных редиректов в списке: {rows.count()}")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry-run", action="store_true", help="только логин + разведка")
    args = ap.parse_args()

    user = os.environ.get("TDART_LOGIN", "admin")
    pw = os.environ.get("TDART_PASS", "")
    if not pw:
        print("ERROR: env TDART_PASS не задан", file=sys.stderr); sys.exit(2)

    proxy_url = os.environ.get("HTTPS_PROXY") or os.environ.get("https_proxy")
    args = [
        "--no-sandbox", "--disable-dev-shm-usage",
        "--ignore-certificate-errors",
    ]
    if proxy_url:
        args += [f"--proxy-server={proxy_url}"]
    launch_kw = {"executable_path": CHROME, "args": args, "headless": True}

    with sync_playwright() as p:
        b = p.chromium.launch(**launch_kw)
        ctx_kw = {
            "user_agent": UA,
            "viewport": {"width": 1440, "height": 900},
            "ignore_https_errors": True,  # доверяем реtermed TLS прокси
        }
        ctx = b.new_context(**ctx_kw)
        # Beget cookie заранее — иначе первый GET вернёт JS-заглушку
        ctx.add_cookies([{
            "name": "beget", "value": "begetok",
            "domain": ".td-art.ru", "path": "/",
        }])
        page = ctx.new_page()

        if not login(page, user, pw):
            b.close(); sys.exit(3)
        shot(page, "wp_dashboard")

        if args.dry_run:
            print("[dry-run] логин прошёл — доступ рабочий. Останавливаюсь.")
            b.close(); return

        install_redirection(page)
        skip_wizard(page)
        import_csv(page)
        move_regex_to_end(page)

        pilot = [
            "/design-project/dom/", "/design-project/kvartira/",
            "/design-project/avtorskiy-nadzor/", "/contacts/", "/portfolio/arbat/",
            "/random-нет-такой-страницы/",  # проверка regex catch-all
        ]
        curl_verify(pilot)

        b.close()
        print("\n✅ Импорт завершён. Скрины: shots/. Отчёт готов для клиента.")


if __name__ == "__main__":
    main()
