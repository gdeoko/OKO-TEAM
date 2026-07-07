# OKO Brain — второй мозг (Obsidian-совместимый vault)

Память Claude по всем проектам OKO TEAM. Живёт в git, доступна из любой сессии.

## Как подключить в Obsidian (телефон/ПК)
1. Obsidian → Open folder as vault → выбрать папку `brain/` из клона репо.
2. Синк: плагин **Obsidian Git** (community) → укажет на этот репозиторий, pull/push по кнопке.
   Либо просто `git pull` в Termux: `git clone https://github.com/gdeoko/OKO-TEAM && cd OKO-TEAM && git pull`.

## Правила для Claude (в каждой сессии)
- В НАЧАЛЕ: прочитать `Claude/Projects/<проект>.md` + 2 последние записи в `Claude/Sessions/`.
- В КОНЦЕ: дописать сессию в `Claude/Sessions/YYYY-MM-DD-<проект>.md` (факты, пути, решения, незакрытое).
- Инфраструктурные грабли и обходы — в `Claude/Инфраструктура.md`, не в головах.
