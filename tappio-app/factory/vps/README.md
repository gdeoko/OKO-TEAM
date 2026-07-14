# VPS постинг-агент (okoagents.okoteam.top / /opt/oko-poster)

Доступ по HTTPS (в secrets: OKO_VPS_CTRL_URL, OKO_VPS_CTRL_TOKEN). Хелпер: vps_exec.py.
Control API: POST /exec {"cmd":"..."} -> {exit,stdout,stderr} (выполняет как okoposter в /opt/oko-poster); GET /health; GET /logs.

Окружение (проверено 14.07.2026): Node 22, Python 3.14, ffmpeg 8, Docker 29, Playwright 1.49 + Chromium headless (pw-browsers/). Браузер грузит страницы (проверено на hooppy.ru).
Креды Hoopy для браузер-агента: HOOPPY_LOGIN, HOOPPY_PASSWORD (в secrets). API-токен Hoopy: HOOPPY_API_TOKEN.

Назначение:
- Постинг-ядро: Hoopy API (upload+create post) + YouTube напрямую (официально).
- Браузер-автоматизация: логин в кабинет Hoopy -> подключение аккаунтов/создание проектов (чего нет в API) -> полный доступ, self-serve под ОКО АПП.

Использование: python3 vps_exec.py '<shell>' [timeout]  (env OKO_VPS_CTRL_URL/TOKEN из secrets).
