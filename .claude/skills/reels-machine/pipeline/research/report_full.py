#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""ПОЛНЫЙ отчёт-анализ конкурентов (перед КАЖДЫМ роликом). Из research.json + analysis.json →
текст + PDF: по каждому ролику 1М+ (канал/подписчики/просмотры/лайки/комменты/ER/длит/ССЫЛКА)
+ хук/механика/воронка/почему залетел; разбор хуков (частые слова); вывод для наших роликов.

  python report_full.py research.json analysis.json out.txt [--pdf out.pdf] [--niche "..."]
analysis.json: {"<id>":{"hook","scenario","mechanic","funnel","why_viral","product","borrow"},"synthesis":"..."}
"""
import os,sys,json,argparse,subprocess,datetime,re,collections

def hn(n):
    try:n=float(n)
    except:return "—"
    for u,d in [("M",1e6),("K",1e3)]:
        if n>=d:return f"{n/d:.1f}{u}".replace(".0","")
    return str(int(n))
def er(it):
    v=it.get("views") or 0;l=it.get("likes") or 0;c=it.get("comments") or 0
    return f"{100*(l+c)/v:.2f}%" if v else "—"

def txt_report(R,A,niche):
    date=datetime.datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC")
    L=[f"АНАЛИЗ КОНКУРЕНТОВ V.CODE — YouTube, ролики 1M+",
       f"{date} · ниша: {niche}", "="*54, ""]
    for i,it in enumerate(R,1):
        a=A.get(it["id"],{})
        L+=[f"{i}. {it.get('title','')}",
            f"   канал: {it.get('channel','?')} ({hn(it.get('followers'))} подп.)",
            f"   {hn(it.get('views'))} просм · {hn(it.get('likes'))} лайк · {hn(it.get('comments'))} комм · ER {er(it)} · {it.get('duration','?')}с",
            f"   {it.get('url','')}"]
        if a.get("hook"): L.append(f"   ХУК: {a['hook']}")
        if a.get("mechanic"): L.append(f"   МЕХАНИКА: {a['mechanic']}")
        if a.get("funnel"): L.append(f"   ВОРОНКА: {a['funnel']}")
        if a.get("why_viral"): L.append(f"   ПОЧЕМУ 1М+: {a['why_viral']}")
        L.append("")
    # разбор хуков: частые слова в заголовках
    words=collections.Counter()
    for it in R:
        for w in re.findall(r"[A-Za-zА-Яа-яё0-9]{4,}", (it.get("title") or "").lower()):
            words[w]+=1
    top=", ".join(f"{w}({n})" for w,n in words.most_common(8))
    L+=["="*54,"РАЗБОР ХУКОВ (что заходит):", f"частые слова в заголовках-миллионниках: {top}"]
    if A.get("synthesis"): L+=["", "ВЫВОД ДЛЯ НАШИХ РОЛИКОВ:", A["synthesis"]]
    return "\n".join(L)

def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("research");ap.add_argument("analysis");ap.add_argument("out")
    ap.add_argument("--pdf",default=None);ap.add_argument("--niche",default="")
    a=ap.parse_args()
    R=json.load(open(a.research));A=json.load(open(a.analysis)) if os.path.exists(a.analysis) else {}
    body=txt_report(R,A,a.niche); open(a.out,"w",encoding="utf-8").write(body)
    if a.pdf:
        # текст → PDF через простой HTML (моно, кликабельные ссылки)
        html=a.out+".html"
        esc=body.replace("&","&amp;").replace("<","&lt;")
        esc=re.sub(r"(https?://[^\s]+)", r'<a href="\1">\1</a>', esc)
        open(html,"w",encoding="utf-8").write(
          f"<meta charset=utf-8><body style='background:#0a0a0a;color:#eee;font-family:monospace;font-size:15px;padding:30px;white-space:pre-wrap'>"
          f"<div style='color:#EA5920;font-weight:bold'>{esc}</div></body>")
        import glob
        chr=([x for x in ["/opt/pw-browsers/chromium-1194/chrome-linux/chrome","/opt/pw-browsers/chromium"] if os.path.exists(x)]+["chromium"])[0]
        subprocess.run([chr,"--headless","--no-sandbox","--disable-gpu",f"--print-to-pdf={a.pdf}","--no-pdf-header-footer",f"file://{os.path.abspath(html)}"],capture_output=True,timeout=90)
    print(a.pdf or a.out)
if __name__=="__main__": main()
