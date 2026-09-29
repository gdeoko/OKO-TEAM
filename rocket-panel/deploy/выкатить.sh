#!/bin/bash
# ВЫКАТКА ПРАВОК В БОЙ. Одной командой, потому что порознь забывается.
#
# 29.09.2026 это стоило владельцу лишнего круга. Я поправила промпт,
# залила файл на сервер и отчиталась - а служба `amberry` держала в
# памяти СТАРЫЙ модуль: питон читает `prompts.py` один раз, при
# импорте. Владелец получил кадр по старому тексту, с теми же точками
# и той же растительностью, которые я объявила починенными.
#
# То же и с картой: панель там своя, и файл на сервере ей не указ, пока
# его не скопировали и не перезапустили `supervisorctl restart panel`.
#
# Значит выкатка это не «залить», а «залить И перезапустить», и обе
# половины должны жить в одном месте.
#
# Имена переменных латиницей: bash не умеет кириллицу в именах.
set -u

case "${1:-всё}" in
  бот|всё)
    systemctl restart amberry
    sleep 4
    echo "бот: $(systemctl is-active amberry)"
    ;;&
  карта|всё)
    # Панель живёт на карте, и файл ей нужно ещё донести.
    if [ -f /srv/amberry/panel.py ]; then
      set -a; . /etc/amberry-card.env 2>/dev/null; set +a
      scp -o StrictHostKeyChecking=no -i "${VAST_KEY:-/root/.ssh/vast_amberry}" \
          -P "${VAST_PORT:-10404}" /srv/amberry/panel.py \
          "${VAST_HOST:-root@ssh5.vast.ai}:/root/panel.py" \
        && ssh -o StrictHostKeyChecking=no -i "${VAST_KEY:-/root/.ssh/vast_amberry}" \
               -p "${VAST_PORT:-10404}" "${VAST_HOST:-root@ssh5.vast.ai}" \
               'supervisorctl restart panel' \
        && echo "карта: панель перезапущена"
    fi
    ;;
esac

echo "--- что в бою"
/opt/amberry/.venv/bin/python - <<'PY'
import sys
sys.path.insert(0, "/opt/amberry/rocket-panel/bot")
import prompts
опасные = ("pores", "pubic", "hairless", "grain", "bikini", "oiled")
for имя in ("КОЖА", "КАЧЕСТВО", "ТЕКСТ_ПРОХОДА"):
    т = getattr(prompts, имя, "").lower()
    плохо = [с for с in опасные if с in т]
    print(f"{имя:15s} {'ЕСТЬ ' + ', '.join(плохо) if плохо else 'чисто'}")
PY
