#!/usr/bin/env python3
"""
Генератор трёх целевых файлов из redirects.csv Антона:
  - redirection_plugin.csv  (импорт в WP-плагин Redirection)
  - redirects.htaccess      (Apache mod_rewrite fallback)
  - redirects.json          (WP-CLI / REST API плагина Redirection)

Правила разбора:
  * source_url приведён к path на td-art.ru: обрезаем протокол+хост.
  * www.td-art.ru и http://td-art.ru обрабатываются на уровне .htaccess
    (canonical), поэтому в CSV/JSON плагина не попадают.
  * regex-строка "/(.*)" помечается regex=1 и всегда идёт ПОСЛЕДНЕЙ.
  * При дублях path — оставляем первое вхождение, пишем в лог stderr.
"""
import csv, json, re, sys
from pathlib import Path
from urllib.parse import urlparse

SRC = Path(__file__).parent / "redirects.csv"
OUT_CSV = Path(__file__).parent / "redirection_plugin.csv"
OUT_JSON = Path(__file__).parent / "redirects.json"
OUT_HT = Path(__file__).parent / "redirects.htaccess"

CANONICAL_HOST = "td-art.ru"


def normalize_source(raw: str) -> tuple[str, bool, str]:
    """Вернёт (path_for_plugin, is_canonical_host, note).
    is_canonical_host=False → редирект решается на уровне сервера (.htaccess),
    в плагин не попадёт.
    """
    raw = raw.strip()
    if raw.startswith("/(") or raw.startswith("^"):
        return raw, True, "regex"
    u = urlparse(raw)
    host = (u.netloc or "").lower()
    path = u.path or "/"
    if u.query:
        path += "?" + u.query
    if host == CANONICAL_HOST:
        return path, True, ""
    if host in ("www.td-art.ru",):
        return path, False, "www-host"
    if u.scheme == "http" and host == CANONICAL_HOST:
        return path, False, "http-scheme"
    if host == "" and raw.startswith("/"):
        return raw, True, "relative"
    # прочие хосты (например http://td-art.ru — распарсится с netloc=td-art.ru)
    if host == CANONICAL_HOST:
        return path, True, ""
    return path, False, f"other-host:{host}"


def main() -> int:
    rows = []
    with SRC.open(encoding="utf-8") as fh:
        reader = csv.reader(fh)
        header = next(reader, None)
        # header: source_url,target_url,301 — 3-я колонка это код
        for i, row in enumerate(reader, start=2):
            if not row or not row[0].strip():
                continue
            src, tgt = row[0].strip(), row[1].strip()
            code = int((row[2].strip() if len(row) > 2 and row[2].strip() else "301"))
            rows.append((i, src, tgt, code))

    # Разбор
    plugin_rows = []           # (source_path, target, regex, code)
    server_only = []           # www/http/иные хосты → в .htaccess
    seen_paths = set()
    catch_all = None
    dupes = []

    for lineno, src, tgt, code in rows:
        path, is_canonical, note = normalize_source(src)
        if note == "regex":
            catch_all = (path, tgt, 1, code)
            continue
        if not is_canonical:
            server_only.append((src, tgt, code, note))
            continue
        if path in seen_paths:
            dupes.append((lineno, path, tgt))
            continue
        seen_paths.add(path)
        plugin_rows.append((path, tgt, 0, code))

    if catch_all is not None:
        plugin_rows.append(catch_all)

    # ---------- redirection_plugin.csv ----------
    with OUT_CSV.open("w", encoding="utf-8", newline="") as fh:
        w = csv.writer(fh)
        w.writerow(["source_url", "target_url", "regex", "http_code"])
        for row in plugin_rows:
            w.writerow(row)

    # ---------- redirects.json (родной формат Redirection) ----------
    json_items = []
    for pos, (src, tgt, is_regex, code) in enumerate(plugin_rows):
        json_items.append({
            "url": src,
            "match_url": src,
            "match_type": "url",
            "action_type": "url",
            "action_code": code,
            "action_data": {"url": tgt, "regex": bool(is_regex), "flags": {}},
            "regex": bool(is_regex),
            "position": pos,
            "status": "enabled",
            "group_id": 1,
            "title": ""
        })
    OUT_JSON.write_text(
        json.dumps({
            "version": 5,
            "meta": {
                "site": "https://td-art.ru",
                "target_site": "https://design.td-art.ru",
                "generated_by": "OKO-TEAM jobs/td-art/gen.py",
                "total_items": len(json_items),
                "notes": [
                    "canonical редирект www→non-www и http→https сделан на уровне .htaccess",
                    "последний item — regex catch-all /(.*), должен быть В КОНЦЕ группы",
                ],
            },
            "groups": [
                {"id": 1, "name": "td-art → design.td-art", "module_id": 1, "enabled": True}
            ],
            "redirects": json_items,
        }, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    # ---------- redirects.htaccess ----------
    lines = [
        "# =========================================================",
        "# td-art.ru → design.td-art.ru — 301 редиректы (fallback)",
        "# Источник: jobs/td-art/redirects.csv (106 строк от Антона)",
        "# Сгенерировано: jobs/td-art/gen.py",
        "# Если WP-плагин Redirection импортирован — этот файл НЕ обязателен,",
        "# но canonical-блок (www→non-www, http→https) держать в .htaccess ВСЕГДА.",
        "# =========================================================",
        "",
        "<IfModule mod_rewrite.c>",
        "RewriteEngine On",
        "",
        "# --- canonical: www → non-www ---",
        "RewriteCond %{HTTP_HOST} ^www\\.td-art\\.ru$ [NC]",
        "RewriteRule ^(.*)$ https://td-art.ru/$1 [R=301,L]",
        "",
        "# --- canonical: http → https ---",
        "RewriteCond %{HTTPS} off",
        "RewriteRule ^(.*)$ https://td-art.ru/$1 [R=301,L]",
        "",
        "# --- точные редиректы (в порядке из таблицы) ---",
    ]
    for path, tgt, is_regex, code in plugin_rows:
        if is_regex:
            continue  # regex-catch-all → отдельно, в самом конце
        # Redirect 301 работает по префиксу, но нам нужно ТОЧНОЕ совпадение
        # → используем RewriteRule с ^path$
        # экранируем спецсимволы regex в path
        safe_path = path.lstrip("/")
        safe_path_re = re.escape(safe_path)
        lines.append(f"RewriteRule ^{safe_path_re}$ {tgt} [R=301,L]")

    if catch_all is not None:
        _, tgt, _, code = catch_all
        lines += [
            "",
            "# --- catch-all: всё остальное на td-art.ru → folio ---",
            f"RewriteRule ^(.*)$ {tgt} [R=301,L]",
        ]

    lines += ["</IfModule>", ""]
    OUT_HT.write_text("\n".join(lines), encoding="utf-8")

    # ---------- отчёт ----------
    print(f"[gen] исходник: {SRC.name} — {len(rows)} строк данных", file=sys.stderr)
    print(f"[gen] server-only (www/http): {len(server_only)}", file=sys.stderr)
    for src, tgt, code, note in server_only:
        print(f"      · {note}: {src} → {tgt}", file=sys.stderr)
    print(f"[gen] дубликаты path (пропущены): {len(dupes)}", file=sys.stderr)
    for lineno, path, tgt in dupes:
        print(f"      · line {lineno}: {path} → {tgt}", file=sys.stderr)
    print(f"[gen] plugin_rows: {len(plugin_rows)} (в т.ч. regex: {1 if catch_all else 0})", file=sys.stderr)
    print(f"[gen] → {OUT_CSV.name}", file=sys.stderr)
    print(f"[gen] → {OUT_JSON.name}", file=sys.stderr)
    print(f"[gen] → {OUT_HT.name}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    sys.exit(main())
