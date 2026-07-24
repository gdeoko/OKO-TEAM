#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
ГЛУБОКАЯ РАЗВЕДКА под КОНКРЕТНЫЙ ролик — реальная раскадровка + транскрипт + метрики
10 свежих миллионников ниши. Отсюда с дата-центр-IP чужое видео целиком не качается (403),
НО работает обход: storyboard-спрайты YouTube (сетки кадров по всему ролику, отдаются с CDN
картинок) + авто-субтитры (полный сценарий с таймингом) + метаданные (просмотры/лайки/комменты).
Этого достаточно, чтобы РЕАЛЬНО разобрать хук/темп/структуру/сценарий/воронку — не выдумывая.

Пишет пакет в analysis/refs/<reel_id>/:
  meta.json           — метрики + ссылки 10 конкурентов
  transcript_<i>.txt  — расшифровка каждого
  board_<i>.jpg        — склеенная раскадровка каждого (кадры по всему ролику)
  INDEX.md            — сводка для человека/модели

Дальше живая сессия (Claude) СМОТРИТ board_*.jpg + читает transcript_*.txt и пишет разбор
в бота + build_spec.json, по которому строится наш ролик. Без шаблона.

Вызов: python3 recon_deep.py <spy|brain|tape> <reel_id> [N=10]
"""
import json, os, sys, subprocess, re, email
from email import policy
HERE = os.path.dirname(os.path.abspath(__file__))
AN = os.path.join(HERE, "analysis")
CA = os.environ.get('CURL_CA', '/root/.ccr/ca-bundle.crt')
sys.path.insert(0, HERE)
import recon as R   # переиспользуем поиск/дедуп/метрики


def ytdlp(args, timeout=120):
    try:
        return subprocess.run(["yt-dlp", "--no-warnings"] + args,
                              capture_output=True, text=True, timeout=timeout)
    except Exception:
        return None


def transcript(vid, out):
    """Авто-субтитры -> чистый текст сценария (без таймкодов)."""
    tmp = f"/tmp/tr_{vid}"
    r = ytdlp(["--skip-download", "--write-auto-subs", "--sub-lang", "en",
               "--sub-format", "vtt", "-o", tmp + ".%(ext)s",
               f"https://www.youtube.com/watch?v={vid}"], 90)
    vtt = tmp + ".en.vtt"
    if not os.path.exists(vtt):
        return ""
    seen, lines = set(), []
    for ln in open(vtt, encoding="utf-8", errors="ignore"):
        ln = ln.strip()
        if not ln or "-->" in ln or ln.startswith(("WEBVTT", "Kind", "Language")):
            continue
        ln = re.sub(r"<[^>]+>", "", ln)          # снять теги/таймкоды слов
        ln = re.sub(r"\[.*?\]", "", ln).strip()
        if ln and ln not in seen:
            seen.add(ln); lines.append(ln)
    try: os.remove(vtt)
    except Exception: pass
    txt = " ".join(lines)
    open(out, "w", encoding="utf-8").write(txt)
    return txt


def storyboard(vid, out):
    """Storyboard-спрайты YouTube -> одна вертикальная склейка кадров (раскадровка ролика)."""
    tmp = f"/tmp/sb_{vid}.mhtml"
    r = ytdlp(["-f", "sb0/sb1/sb2", "-o", tmp,
               f"https://www.youtube.com/watch?v={vid}"], 90)
    if not os.path.exists(tmp):
        return False
    grids = []
    try:
        msg = email.message_from_bytes(open(tmp, "rb").read(), policy=policy.default)
        for part in msg.walk():
            if part.get_content_type().startswith("image/"):
                pl = part.get_payload(decode=True)
                if pl:
                    g = f"/tmp/g_{vid}_{len(grids)}.jpg"
                    open(g, "wb").write(pl); grids.append(g)
    except Exception:
        return False
    try: os.remove(tmp)
    except Exception: pass
    if not grids:
        return False
    # берём до 4 сеток равномерно по ролику и клеим вертикально (обзор всего монтажа)
    pick = grids[:: max(1, len(grids) // 4)][:4] or grids[:1]
    if len(pick) == 1:
        subprocess.run(["ffmpeg", "-y", "-i", pick[0], "-vf", "scale=640:-1", out],
                       capture_output=True)
    else:
        cmd = ["ffmpeg", "-y"]
        for p in pick:
            cmd += ["-i", p]
        cmd += ["-filter_complex", f"vstack=inputs={len(pick)},scale=640:-1", out]
        subprocess.run(cmd, capture_output=True)
    for g in grids:
        try: os.remove(g)
        except Exception: pass
    return os.path.exists(out)


def main():
    app = sys.argv[1] if len(sys.argv) > 1 else "spy"
    reel_id = sys.argv[2] if len(sys.argv) > 2 else app
    n = int(sys.argv[3]) if len(sys.argv) > 3 else 10
    # без двойного поиска: берём список из свежего latest_<app>.json (его пишет recon brief),
    # иначе — ищем сами
    latest = os.path.join(AN, f"latest_{app}.json")
    if os.path.exists(latest):
        res = json.load(open(latest))
    else:
        res = R.recon_app(app)                  # свежие 10 (дедуп по recon_seen), приоритет 1M+
    comp = (res.get("millions_list") or res.get("top") or [])[:n]
    refdir = os.path.join(AN, "refs", reel_id)
    os.makedirs(refdir, exist_ok=True)
    meta = {"app": app, "reel_id": reel_id, "niche": res["niche"],
            "brand": res["brand_name"], "code": res["code"], "competitors": []}
    idx = [f"# РЕФЫ для {reel_id} ({res['niche']}) — 10 миллионников\n"]
    got_board = got_tr = 0
    for i, r in enumerate(comp, 1):
        vid = r["id"]
        tpath = os.path.join(refdir, f"transcript_{i}.txt")
        bpath = os.path.join(refdir, f"board_{i}.jpg")
        tr = transcript(vid, tpath)
        bd = storyboard(vid, bpath)
        got_tr += 1 if tr else 0
        got_board += 1 if bd else 0
        er = round((r.get("likes", 0) + r.get("comments", 0)) / max(1, r["views"]) * 100, 2)
        meta["competitors"].append({
            "n": i, "id": vid, "title": r["title"], "url": f"https://youtu.be/{vid}",
            "views": r["views"], "likes": r["likes"], "comments": r["comments"],
            "channel": r["channel"], "subs": r.get("followers", 0), "dur": r.get("dur", 0),
            "er": er, "has_transcript": bool(tr), "has_board": bd,
            "transcript_file": f"transcript_{i}.txt" if tr else "", "board_file": f"board_{i}.jpg" if bd else "",
        })
        idx.append(f"\n## {i}. {r['title'][:80]}\n"
                   f"{r['views']:,} просм · {r['likes']:,}❤ · {r['comments']:,}💬 · ER {er}% · {r.get('dur',0)}с · {r['channel']}\n"
                   f"{('раскадровка: board_%d.jpg' % i) if bd else 'раскадровки нет'} · "
                   f"{('транскрипт: transcript_%d.txt (%d симв)' % (i, len(tr))) if tr else 'транскрипта нет'}\n"
                   .replace(",", " "))
    json.dump(meta, open(os.path.join(refdir, "meta.json"), "w"), ensure_ascii=False, indent=1)
    open(os.path.join(refdir, "INDEX.md"), "w", encoding="utf-8").write("".join(idx))
    print(f"DEEP {reel_id} ({app}): конкурентов={len(comp)} раскадровок={got_board} транскриптов={got_tr} -> analysis/refs/{reel_id}/")


if __name__ == "__main__":
    main()
