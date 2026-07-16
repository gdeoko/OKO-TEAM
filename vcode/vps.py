# -*- coding: utf-8 -*-
"""V.CODE — «руки» через VPS-агент OKO (чистый IP).
Скачивание роликов и метрики (аналитика) для тех площадок, что заблокированы
из песочницы. yt-dlp + curl_cffi уже установлены на VPS (/opt/oko-poster/bin/yt-dlp).

Нужны env: OKO_POSTER_URL, OKO_POSTER_TOKEN (в secrets.env.b64).

CLI:
  python3 vcode/vps.py meta  <url>                 # JSON-метрики (views/likes/comments)
  python3 vcode/vps.py dl    <url> <dest.mp4>      # скачать ролик на VPS и забрать сюда
  python3 vcode/vps.py exec  '<shell>'             # произвольная команда на VPS
Python:
  from vcode.vps import vps_exec, vps_meta, vps_dl
"""
import os, sys, json, base64, subprocess

CA=os.environ.get("CA_BUNDLE","/root/.ccr/ca-bundle.crt")
URL=os.environ.get("OKO_POSTER_URL","")
TOK=os.environ.get("OKO_POSTER_TOKEN","")
YTDLP="/opt/oko-poster/bin/yt-dlp"
CHROME_PROFILE="/opt/oko-poster/profile"  # залогиненный Chrome (IG-сессия) для --cookies-from-browser

def _ck(url):
    """Для Instagram подставляем куки из Chrome-профиля VPS (публичное без кук закрыто)."""
    return f' --cookies-from-browser "chromium:{CHROME_PROFILE}"' if "instagram.com" in url else ""

def vps_exec(cmd, timeout=240):
    """Выполнить shell-команду на VPS, вернуть (stdout, stderr)."""
    if not URL or not TOK: raise RuntimeError("нет OKO_POSTER_URL/OKO_POSTER_TOKEN (source secrets.env)")
    payload=json.dumps({"cmd":cmd})
    r=subprocess.run(["curl","-s","--cacert",CA,"-m",str(timeout),"-X","POST",URL,
        "-H",f"Authorization: Bearer {TOK}","-H","Content-Type: application/json",
        "--data-binary",payload], capture_output=True, timeout=timeout+20)
    try: d=json.loads(r.stdout.decode() or "{}")
    except Exception as e: raise RuntimeError(f"ответ VPS не JSON: {r.stdout[:200]!r} ({e})")
    return d.get("stdout",""), d.get("stderr","")

def vps_meta(url):
    """Метрики ролика (views/likes/comments/uploader) через yt-dlp -J на VPS.
    Извлечение полей делаем НА VPS (канал exec не тянет полный -J)."""
    keys=["title","view_count","like_count","comment_count","repost_count",
          "duration","uploader","channel","webpage_url","upload_date"]
    py=("import sys,json;d=json.load(sys.stdin);"
        f"k={keys};print(json.dumps({{x:d.get(x) for x in k}},ensure_ascii=False))")
    out,err=vps_exec(f'{YTDLP}{_ck(url)} -J {json.dumps(url)} 2>/dev/null | python3 -c {json.dumps(py)}')
    out=out.strip()
    if not out: raise RuntimeError(f"пусто (площадка закрыта без кук?): {err[:200]}")
    return json.loads(out.splitlines()[-1])

def vps_dl(url, dest, maxmb=45):
    """Скачать ролик на VPS (лучший mp4 ≤1080p) и забрать байты сюда через base64."""
    tmp="/opt/oko-poster/tmp/vc_dl.mp4"
    cmd=(f'mkdir -p /opt/oko-poster/tmp && rm -f {tmp} && '
         f'{YTDLP}{_ck(url)} -f "bv*[height<=1080]+ba/b[height<=1080]/b" --merge-output-format mp4 '
         f'-o {tmp} {json.dumps(url)} >/dev/null 2>&1; '
         f'sz=$(stat -c%s {tmp} 2>/dev/null || echo 0); echo "SIZE=$sz"; '
         f'if [ "$sz" -gt 0 ] && [ "$sz" -lt {maxmb*1024*1024} ]; then base64 -w0 {tmp}; fi')
    out,err=vps_exec(cmd, timeout=300)
    line,_,b64=out.partition("\n")
    sz=int(line.replace("SIZE=","").strip() or 0)
    if sz==0: raise RuntimeError(f"скачать не вышло: {err[:200]}")
    if not b64: raise RuntimeError(f"файл {sz} б больше лимита {maxmb}МБ — забирай через R2")
    with open(dest,"wb") as f: f.write(base64.b64decode(b64))
    return {"dest":dest,"bytes":sz}

def main():
    if len(sys.argv)<3: print(__doc__); return
    op=sys.argv[1]
    if op=="meta": print(json.dumps(vps_meta(sys.argv[2]), ensure_ascii=False, indent=1))
    elif op=="dl": print(json.dumps(vps_dl(sys.argv[2], sys.argv[3]), ensure_ascii=False))
    elif op=="exec":
        o,e=vps_exec(sys.argv[2]); print(o);
        if e: sys.stderr.write(e)
    else: print("op: meta|dl|exec")

if __name__=="__main__": main()
