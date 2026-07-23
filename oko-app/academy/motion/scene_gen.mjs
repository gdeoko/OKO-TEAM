#!/usr/bin/env node
/* Урок → сцена (JSON) для моушен-движка. Анти-повтор через глобальный индекс урока.
   Аргументы env: LESSON (json файла урока), GIDX (глобальный индекс 0..N), DUR (длина VO, сек),
                  KICK (лейбл блока), VOTEXT (файл текста озвучки для караоке), OUT (выходной json). */
import fs from 'fs';
const L = JSON.parse(fs.readFileSync(process.env.LESSON,'utf8'));
const GIDX = +(process.env.GIDX||0);
const DUR = +(process.env.DUR||30);
const KICK = process.env.KICK||'АКАДЕМИЯ OKO';
const voText = process.env.VOTEXT ? fs.readFileSync(process.env.VOTEXT,'utf8') : '';

const strip = s => (s||'').replace(/<[^>]+>/g,'').replace(/\s+/g,' ').trim();
/* анти-повтор: палитра/фон/стиль обложки/анимация буллетов — по индексу с шагом-простым */
const pal = (GIDX*3) % 5;
const bg  = (GIDX*2) % 3;
const seed = 1000 + GIDX*7;

/* сегменты: обложка + по слайду point + опц. stat + аутро; тайминг ∝ длине текста */
const slides = L.slides || [];
const weights = [];
const segsRaw = [];
// cover
segsRaw.push({type:'cover', w: 2.2, eyebrow:KICK, title:(L.c1||L.title||'').toUpperCase(), sub: L.c2? (L.c1?'':'')+strip(L.sub):strip(L.sub||'')});
// найти яркое число для stat
let statSeg=null;
for(const s of slides){ for(const p of s.pts||[]){ const m=strip(p).match(/(\d[\d\s]{0,6}\d|\d)\s?(%|₽|k|К)?/); if(m && +m[1].replace(/\s/g,'')>1 && !statSeg){ const val=+m[1].replace(/\s/g,''); if(val>=3){ statSeg={type:'stat', w:1.6, value:val, suffix:(m[2]||''), cap:strip(s.t)}; } } } }
// points (по слайдам)
slides.forEach((s)=>{
  const pts = (s.pts||[]).slice(0,4).map(p=>p.replace(/<b>/g,'<b>').trim());
  const len = strip(s.t).length + pts.reduce((a,p)=>a+strip(p).length,0);
  segsRaw.push({type:'point', w: Math.max(2.0, len/28), eyebrow:'РАЗБОР', title:strip(s.t), svg:s.svg||'', points:pts});
});
if(statSeg) segsRaw.splice(Math.min(segsRaw.length, 2+Math.floor(slides.length/2)),0,statSeg);
// outro
segsRaw.push({type:'outro', w:1.8, eyebrow:'ИТОГ', title:(L.c2||'ПРИМЕНЯЙ').toUpperCase(), sub:'Пройди тест и игру — закрепи урок'});

const totW = segsRaw.reduce((a,s)=>a+s.w,0);
let t=0; const segs=[];
segsRaw.forEach(s=>{ const len = +(DUR * s.w/totW).toFixed(2); segs.push(Object.assign({at:+t.toFixed(2), len}, s)); t+=len; });
// подчистить последний, чтобы сумма = DUR
if(segs.length){ segs[segs.length-1].len = +(DUR - segs[segs.length-1].at).toFixed(2); }

/* караоке: слова текста озвучки равномерно по DUR */
let karaoke=null;
if(voText){ const words=strip(voText).split(' ').filter(Boolean); const step=DUR/Math.max(1,words.length); karaoke=words.map((w,i)=>({w,t:+(i*step).toFixed(2)})); }

const scene={ seed, pal, bg, dur:+DUR.toFixed(2), segs, karaoke };
fs.writeFileSync(process.env.OUT, JSON.stringify(scene));
console.log('scene: segs='+segs.length+' dur='+DUR.toFixed(1)+' pal='+pal+' bg='+bg+(statSeg?' +stat':''));
