"""Reproducible layout-only preview from the actual VPN template and stylesheet."""
from pathlib import Path
import json

root = Path(__file__).resolve().parent.parent
frame = (root / 'rocketvpn/frame.html').read_text()
start = frame.index('    <div class="rv-пульт"')
end = frame.index('    <!-- В ПРОЁМЕ ЛЮКА', start)
panel = frame[start:end]
css = (root / 'rocketvpn/assets/rv.css').read_text()
fixture = ('<!doctype html><html lang="ru" class="рв-слова-в-сцене рв-живая-рубка рв-финал-пульт" data-тема="тёмная">'
    '<meta name="viewport" content="width=device-width,initial-scale=1"><style>' + css +
    '</style><style>html,body{margin:0;height:100%;background:#101729}.rv-кадр{position:fixed;inset:0;height:100%;width:100%}</style>'
    '<div class="rv-кадр">' + panel + '</div></html>')
fixture = json.dumps(fixture, ensure_ascii=False).replace('</script', '<\\/script')
html = '''<!doctype html><html lang="ru"><meta charset="utf-8"><title>Rocket · проверка финальной панели</title>
<style>body{background:#1c2432;color:#edf4ff;font:15px system-ui;margin:20px}button,select{font:inherit;padding:10px;margin:4px;border-radius:8px}iframe{display:block;border:1px solid #607089;margin-top:16px}p{max-width:75ch}</style>
<h1>Финальная панель VPN</h1><p>Проверка настоящей разметки и CSS. 3D-сцена здесь не отображается, производительность графики не измеряется.</p>
<label>Экран <select id="size"><option>320×568</option><option>390×844</option><option>667×375</option><option>844×390</option><option>1440×900</option></select></label>
<label><input type="checkbox" id="font">3D-шрифт не загрузился</label><p><output id="metrics" role="status"></output></p><iframe title="Финальная панель VPN"></iframe>
<script>const fixture=FIXTURE;const size=document.getElementById('size'),font=document.getElementById('font'),frame=document.querySelector('iframe');
function measure(){const doc=frame.contentDocument,panel=doc.querySelector('.рв-фин-впр'),answer=doc.querySelector('.рв-впр-обёртка'),actions=Array.from(doc.querySelectorAll('.рв-фин-кн a,.рв-фин-кн button'));const p=panel.getBoundingClientRect(),rects=actions.map(el=>el.getBoundingClientRect()),w=Number(frame.width),h=Number(frame.height);document.getElementById('metrics').textContent=JSON.stringify({screen:size.value,fontMissing:font.checked,position:frame.contentWindow.getComputedStyle(panel).position,panel:{x:Math.round(p.x),y:Math.round(p.y),width:Math.round(p.width),height:Math.round(p.height)},answerHeight:answer.clientHeight,actionsWithinViewport:rects.every(r=>r.left>=0&&r.right<=w&&r.top>=0&&r.bottom<=h),actionsBelowPanel:rects.every(r=>r.top>=p.bottom),textFits:answer.scrollWidth<=answer.clientWidth});}
frame.onload=()=>{measure();frame.contentDocument.fonts.ready.then(measure);};
function render(){document.getElementById('metrics').textContent='Измеряем…';const [w,h]=size.value.split('×').map(Number);frame.width=w;frame.height=h;frame.srcdoc=font.checked?fixture.replace('рв-слова-в-сцене ',''):fixture;}
size.onchange=font.onchange=render;render();</script></html>'''
(root / 'review/finale.html').write_text(html.replace('FIXTURE', fixture))
print('Generated CSS-only final panel review')
