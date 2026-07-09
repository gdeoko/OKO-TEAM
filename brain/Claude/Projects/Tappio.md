# Tappio (контракт №005/2026, ИМПЕРИЯ)
Ветка: `tappio.app`. Материалы: `tappio-app/` (пакет клиента 01-09 + README + PRODUCTION_PLAN.md).
Клиент: Александр Мурашко @a_trafico. 3 iOS-app: Spy (cyan #00D9FF), Brainova (purple #9B5DE5), Tape (gold #F4C430). Контент English/USA.
Задача: 500 роликов + 16 каруселей за 60 дней + контент-план HTML.
Микс (директива Даниэля 08.07): 50% viral / 30% value / 20% sell. По app: Spy 250 / Brain 175 / Tape 75 (v3.6).
Источник правды: TAPPIO_SISTEMA_CONTEXT_v3.6_FINAL.txt (не 09_INSTRUCTIONS - там противоречия, разбор в tappio-app/README.md).
Пайплайн (проверен 08.07 в облаке): edge-tts через $HTTPS_PROXY (голос+тайминги) → Pexels/Pixabay стоки + UI-симуляция Playwright + HF Spaces → overlays HTML→PNG → ffmpeg 6.1 (apt ставить: apt-get install -y ffmpeg; репо PHP ppa ругается - игнорить). Ключи из secrets.env.b64 сорсить В ТОМ ЖЕ shell-вызове. GEMINI_API_KEY в env НЕТ.
Статус: план утверждается, дальше батч 01 (10 роликов) + скелет контент-плана.

## Хостинг Системы (09.07.2026)
Система Роста на Higgsfield: https://tappio-sistema.higgsfield.app/sistema
website_id: 5a124749-fdad-486a-9d43-02eb585af9b1, slug: tappio-sistema
Файл лежит как app/public/sistema.html (фреймворк редиректит /sistema.html -> /sistema).
Обновление: website_repo_access -> заменить app/public/sistema.html -> push -> deploy_website.
CF-токен в env - user-scoped (cfut_), Pages недоступны. HF-токен read-only (Spaces создавать нельзя). Higgsfield - рабочий хост.
