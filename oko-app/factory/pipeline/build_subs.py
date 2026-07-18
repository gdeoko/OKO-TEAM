import os,json,subprocess
W=os.path.dirname(os.path.abspath(__file__))
d=json.load(open(W+"/words.json")); WORDS=d["words"]; TOTAL=d["total"]; SS=d["seg_start"]
# group consecutive same-seg words into lines
def maxw(seg): return 2  # uniform: 2 words per line everywhere
lines=[]; cur=[]
for wd in WORDS:
    if cur and (wd["seg"]!=cur[-1]["seg"] or len(cur)>=maxw(wd["seg"]) or
                len(" ".join(x["w"] for x in cur))>=15):
        lines.append(cur); cur=[]
    cur.append(wd)
if cur: lines.append(cur)
# per-line: start=first word start, end=last word end (+tail)
LINES=[]
for ln in lines:
    seg=ln[0]["seg"]
    LINES.append({"seg":seg,"start":ln[0]["start"],"end":ln[-1]["end"],
                  "words":[{"w":w["w"],"s":w["start"],"e":w["end"]} for w in ln]})
# uniform styling: ONE font (Soyuz), bottom, no border, active word amber text
FB="file:///tmp/claude-0/-home-user-OKO-TEAM/f1a565bc-8f30-56e2-87d2-1ade6002be0e/scratchpad/factory/reelsmachineskill_3/reels-machine/fonts"
_U={"font":"soyuz","y":1615,"size":76,"treat":"amberText"}
STYLE={s:_U for s in ["s1","s2","s3","s4","s5","s6"]}
HTML=("""<!doctype html><html><head><meta charset="utf-8"><style>
@font-face{font-family:'soyuz';src:url('%FB%/SoyuzGrotesk-Bold.ttf')}
@font-face{font-family:'mont';src:url('%FB%/montserrat-v31-cyrillic_latin-900.ttf')}""".replace("%FB%",FB)+"""
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:1080px;height:1920px;background:transparent;overflow:hidden}
#stage{position:absolute;inset:0}
.line{position:absolute;left:0;width:1080px;display:flex;flex-wrap:wrap;justify-content:center;
  gap:0 22px;padding:0 90px;transform-origin:center}
.w{display:inline-block;color:#F6F4F1;white-space:nowrap;
  text-shadow:0 4px 22px rgba(0,0,0,.9),0 1px 3px rgba(0,0,0,.9);transform-origin:center bottom}
.w.done{color:#F6F4F1}
.w.next{color:rgba(246,244,241,.42)}
.w.act{color:#FF7A3C}
.w.blk{color:#0c0a08;background:#EA5920;border-radius:14px;padding:2px 16px;
  box-shadow:0 10px 30px rgba(234,89,32,.45);text-shadow:none}
</style></head><body>
<div id="stage"></div>
<script>
const LINES=__LINES__, STYLE=__STYLE__, TOTAL=__TOTAL__;
const stage=document.getElementById('stage');
function ease(x){return 1-Math.pow(1-x,3)} function clamp(x){return Math.max(0,Math.min(1,x))}
function render(t){
  const ts=t*TOTAL;
  stage.innerHTML='';
  // find active line (last line whose start<=ts and ts<end+tail)
  let cur=null;
  for(const L of LINES){ if(ts>=L.start-0.12 && ts<=L.end+0.35){ cur=L; } }
  if(!cur) return;
  const st=STYLE[cur.seg]||STYLE.s3;
  const div=document.createElement('div'); div.className='line';
  const fs=st.size;
  div.style.fontFamily=st.font; div.style.fontSize=fs+'px';
  div.style.top=(st.y-fs)+'px';
  // line enter animation
  const inp=ease(clamp((ts-(cur.start-0.12))/0.22));
  const outp=ease(clamp((ts-(cur.end+0.12))/0.23));
  div.style.opacity=inp*(1-outp);
  div.style.transform='translateY('+((1-inp)*26 + outp*-14)+'px)';
  for(const wd of cur.words){
    const s=document.createElement('span'); s.textContent=wd.w;
    const active = ts>=wd.s-0.04 && ts<wd.e+0.02;
    const done = ts>=wd.e;
    let cls='w '+(active?'':(done?'done':'next'));
    if(active){ cls += (st.treat==='block'?' blk':' act'); }
    s.className=cls;
    if(active){ const pop=ease(clamp((ts-wd.s)/0.13)); s.style.transform='scale('+(1.0+0.13*(1-Math.abs(1-2*pop)))+')'; }
    div.appendChild(s);
  }
  stage.appendChild(div);
}
window.render=render; render(0);
</script></body></html>""")
html=(HTML.replace("__LINES__",json.dumps(LINES,ensure_ascii=False))
          .replace("__STYLE__",json.dumps(STYLE,ensure_ascii=False))
          .replace("__TOTAL__",str(TOTAL)))
os.makedirs(W+"/ig/html",exist_ok=True)
open(W+"/ig/html/subs.html","w").write(html)
print("subs.html built; lines",len(LINES))
